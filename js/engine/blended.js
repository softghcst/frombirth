// Blended families: parents who separate while the player is growing up, the care arrangement that follows, a parent's
// new partner (a step-parent), that partner's children (step-siblings), and the half-brothers and half-sisters a new
// couple may have. Everyone involved is one persistent person (state.npcs), related through the links in
// engine/kinship.js; where they live is the neighborhood's household record (engine/neighborhood.js).
//
// Kept on the player:
//   p.family = {
//     v, bioParentIds, legalParentIds,         the parents a life was born to, and its legal parents
//     separations: [{ year, age, parents:[a,b], leftId, legal:'divorce'|'separation', key }],
//     arrangement: { primaryId, otherId, schedule, since, basis, jurisdiction, simplified, history:[{ year, ... }],
//                    ended?, legacy? } | null
//   }
// On the people: the parent who moved out has flags.livesApart (and flags.hh, their own household); a step-parent is
//   role 'stepparent' with flags.partnerOf (the parent), since, married, liveIn, former, ended; a step-sibling is
//   role 'stepsibling' with parentIds [their parent] and flags.stepVia, liveIn.
//
// Runs once a world year (engine/yearProcessor.js 'blended'), so 3-, 6- and 12-month turns come to the same family.
// The care arrangement is a simplified model: where the child mainly lives and how often they see the other parent.
// It is not decided by money or by who the child likes more, and it is labeled as simplified outside the United States.
import { keyedDice, onOwnDice } from './keyedDice.js';
import { clamp } from '../util.js';
import { store, player, log, milestone } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { inheritAppearance } from './genetics.js';
import { makeBirthInfo, dayInYearJustLived, birthdayFromDate } from './birthTag.js';
import { remember } from './conditions.js';
import { rule } from './rules.js';
import { storyBeat } from './storyDirector.js';
import { recordEvent } from './chronicle.js';
import { houseApart, homeAgain, syncHousehold } from './neighborhood.js';
import { bioParentIdsOf, legalParentIdsOf, livesApart } from './kinship.js';
import { COUNTRIES } from '../data/countries.js';
import { disputed, openCustodyCase, tickFamilyCourt, tickAppeals, setSupport, paySupport, hearChild, askForReview } from './familyCourt.js';

/** This file's dice: keyed to the life, the year and what is being decided (engine/keyedDice.js), never the game's own. */
let rng = keyedDice('family');
const roll = (tag) => { const s = store.state; rng = keyedDice(`family/${s.slotId}/${s.player.id}/${s.year}/${tag}`); };
/** Makes people on dice of their own: the game's sequence of rolls is left where it was. */
const people = (tag, fn) => onOwnDice(`family-people/${store.state.slotId}/${store.state.year}/${tag}`, fn);

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const npc = (id) => store.state.npcs[id] ?? null;
const word = (n, m, f, x) => (n?.gender === 'male' ? m : n?.gender === 'female' ? f : x);
const parentWord = (n) => word(n, 'father', 'mother', 'parent');

/** How often the child is with the parent they do not mainly live with. */
export const SCHEDULES = {
  shared: { name: 'Shared care', line: 'about half the time with each parent' },
  weekends: { name: 'Weekends and holidays', line: 'every other weekend and part of the holidays' },
  holidays: { name: 'School holidays', line: 'school holidays, because of the distance' },
  occasional: { name: 'Now and then', line: 'visits now and then' },
  legacy: { name: 'As it has always been', line: 'as the family has always arranged it' },
};

/** The yearly chances, before era and law. */
const CHANCE = { separate: 0.013, newPartner: 0.1, moveIn: 0.3, marry: 0.28, part: 0.04, partMarried: 0.02, baby: 0.12 };

/** The family record, filled in from what the save already says (idempotent: safe on every load). */
export function migrateFamilyLife(state = store.state) {
  const p = state.player;
  if (!p) return;
  const f = (p.family ??= {});
  const all = p.npcIds.map((id) => state.npcs[id]).filter(Boolean);
  const parents = all.filter((n) => n.role === 'parent' && !n.flags.step && !n.adopted);
  f.bioParentIds ??= parents.map((n) => n.id);
  f.legalParentIds ??= [...f.bioParentIds];
  // A life that began in adoption or kinship care (engine/origins.js): its birth parents are the record's, its legal
  // parents the adoptive ones where there was an adoption; the household it grows up in is the adoptive family.
  const rec = Object.values(state.origins?.records ?? {}).find((r) => r.adopteeId === p.id);
  if (rec && !f.fromOrigins) {
    f.bioParentIds = [...(rec.birthParentIds ?? [])];
    f.legalParentIds = rec.legal === 'adoption' ? (rec.adoptiveParentIds?.length ? [...rec.adoptiveParentIds] : parents.map((n) => n.id)) : [...(rec.legalParentIds?.length ? rec.legalParentIds : rec.birthParentIds ?? [])];
    f.fromOrigins = true;
  }
  f.separations ??= [];
  f.arrangement ??= null;
  // Brothers and sisters made with the life were made from the player's own parents (engine/familyGen.js).
  for (const s of all) {
    if (s.role !== 'sibling' || s.parentIds?.length || s.adopted) continue;
    if (s.flags.half === true) continue; // an old half-sibling whose shared parent was never written down: left unknown
    // An adopted player's brothers and sisters in the household are the adoptive parents' children, not the birth parents'.
    if (rec && !s.flags.birthKin) { const home = parents.map((n) => n.id); if (home.length) s.parentIds = home; continue; }
    if (f.bioParentIds.length) s.parentIds = [...f.bioParentIds];
  }
  // Parents who were apart from the start: the father lived elsewhere (that is what the life has always said).
  if (p.flags.parentsStatus === 'separated' && !f.arrangement && p.age < 18) {
    const away = parents.find((n) => n.gender === 'male' && n.alive);
    const home = parents.find((n) => n !== away && n.alive);
    if (away && home) {
      away.flags.livesApart = true;
      f.arrangement = { primaryId: home.id, otherId: away.id, schedule: 'legacy', since: null, basis: 'unknown', jurisdiction: p.countryId,
        simplified: true, history: [], legacy: true };
    }
  }
  // Two spellings of "living together" were in use; the household reads livingTogether.
  for (const n of all) if (n.flags.livesTogether && !n.flags.livingTogether) n.flags.livingTogether = typeof n.flags.livesTogether === 'number' ? n.flags.livesTogether : state.year;
  f.v = 1;
}

const fam = () => { const p = player(); if (!p.family) migrateFamilyLife(store.state); return p.family; };

/** The player's parents who are alive, as people. */
const parentsNow = () => fam().legalParentIds.map(npc).filter((n) => n?.alive && n.role === 'parent');
/** A parent's current partner (a step-parent who has not parted from them), if any. */
export const partnerOfParent = (parent) => player().npcIds.map(npc).find((n) => n?.alive && n.role === 'stepparent' && !n.flags.former && n.flags.partnerOf === parent.id) ?? null;
/** The step-parents the player has, present and former. */
export const stepParents = () => player().npcIds.map(npc).filter((n) => n?.role === 'stepparent');
export const stepSiblings = () => player().npcIds.map(npc).filter((n) => n?.role === 'stepsibling');
export const arrangement = () => { const a = fam().arrangement; return a && !a.ended ? a : null; };
/** The parent the child mainly lives with, under the arrangement (or null when there is none). */
export const primaryParent = () => npc(arrangement()?.primaryId);

/** Whether a child at this age, in this place and year, can be told the arrangement is one a court would make. */
const simplified = (countryId) => countryId !== 'us';
/** Divorce is in the law of the place and the year (data/history.js); without it, parents separate without one. */
const divorceLegal = (countryId) => rule('divorce', countryId) !== false;
/** Fewer families came apart in earlier years, and fewer still where there was no divorce. */
const eraFactor = (year) => (year < 1945 ? 0.25 : year < 1965 ? 0.45 : year < 1975 ? 0.75 : 1);

/** Where the child mainly lives, and how often they see the other parent: from distance, the year and both parents. */
function chooseSchedule(home, away, year, farAway) {
  if (farAway) return 'holidays';
  if (year < 1970) return 'occasional';
  // Shared care is more common from the 1990s, where both parents have stayed close to the child.
  if (year >= 1990 && home.meters.relationship >= 55 && away.meters.relationship >= 55 && rng.chance(0.4)) return 'shared';
  return 'weekends';
}

/** The yearly step. */
export function tickBlended() {
  const p = player();
  if (!p.alive) return;
  roll('year');
  fam();
  upkeep(p);
  separate(p);
  newPartners(p);
  partnersMoveOn(p);
  newHalfSiblings(p);
}

// ---------- Parents who separate ----------

function separate(p) {
  if (p.flags.parentsStatus !== 'together' || p.age < 2 || p.age > 16 || p.royal || p.flags.care || !p.flags.livesWithParents) return;
  const both = parentsNow();
  if (both.length !== 2) return;
  const legal = divorceLegal(p.countryId);
  const chance = CHANCE.separate * eraFactor(store.state.year) * (legal ? 1 : 0.25);
  if (!rng.chance(chance)) return;
  // Who moves out: more often the father, in most places and years; never decided by money.
  const [a, b] = both;
  const fatherFirst = a.gender === 'male' ? a : b.gender === 'male' ? b : null;
  const leaving = fatherFirst && rng.chance(0.65) ? fatherFirst : rng.pick(both);
  const staying = leaving === a ? b : a;
  separateParents(staying, leaving, { legal: legal ? 'divorce' : 'separation' });
}

/**
 * Two parents separate: one moves to a home of their own. Both stay the child's parents; the child stays one person.
 * Exported for the vertical-slice tests and for any later story that separates them on purpose.
 */
export function separateParents(staying, leaving, { legal = 'divorce', farAway = false, court = null } = {}) {
  roll(`separate/${leaving.id}`);
  const p = player();
  const f = fam();
  const year = store.state.year;
  p.flags.parentsStatus = 'separated';
  leaving.flags.livesApart = true;
  leaving.flags.apartSince = year;
  // Most stay in the same town; some move elsewhere in the country.
  const cities = COUNTRIES[p.countryId]?.cities ?? [];
  const elsewhere = farAway || (cities.length > 1 && rng.chance(0.18));
  leaving.city = elsewhere ? rng.pick(cities.filter((c) => c !== p.city)) ?? p.city : p.city;
  const home = houseApart(store.state, leaving.id, leaving.city, 'separated');
  if (home) leaving.flags.homeId = home.id;
  syncHousehold(store.state);
  const schedule = chooseSchedule(staying, leaving, year, leaving.city !== p.city);
  const key = `family:separation:${[staying.id, leaving.id].sort().join(':')}`;
  f.separations.push({ year, age: p.age, parents: [staying.id, leaving.id], leftId: leaving.id, legal, key });
  f.arrangement = { primaryId: staying.id, otherId: leaving.id, schedule, since: year, ageThen: p.age,
    basis: legal === 'divorce' && year >= 1970 ? 'parenting plan' : 'family agreement', jurisdiction: p.countryId, simplified: simplified(p.countryId),
    history: [{ year, primaryId: staying.id, schedule, why: 'separation' }] };
  const what = legal === 'divorce' ? 'are divorcing' : 'have separated';
  log(`Your parents ${what}. ${leaving.firstName} moved ${leaving.city === p.city ? 'to a place across town' : `to ${leaving.city}`}; you live mostly with ${staying.firstName}, and see ${leaving.firstName} ${SCHEDULES[schedule].line}.`, 'system', 'neutral');
  milestone(`Parents ${legal === 'divorce' ? 'divorced' : 'separated'} when you were ${p.age}.`, 'family');
  recordEvent({ key, type: 'family_separation', title: 'Your parents separated', people: [staying.id, leaving.id], significance: 2, privacy: 'private',
    text: `${staying.firstName} and ${leaving.firstName} separated. ${p.firstName} lived mainly with ${staying.firstName}.` });
  remember(staying, 'separation', `Talked you through the separation when you were ${p.age}.`);
  remember(leaving, 'separation', `Moved out when you were ${p.age}, and kept coming back for you.`);
  p.stats.mood = clamp(p.stats.mood - (p.age < 6 ? 3 : 8));
  storyBeat('blend_separation', { staying: staying.id, leaving: leaving.id, words: { schedule: SCHEDULES[schedule].line } }, { source: 'family', must: true });
  // Child support from the parent who moved out (engine/familyCourt.js); and, where the parents cannot agree, a case.
  setSupport(f.arrangement, leaving, staying);
  if (court ?? disputed(staying, leaving)) openCustodyCase(staying, leaving, f.arrangement);
  return f.arrangement;
}

/** The arrangement kept true to life: a parent who dies, a child who grows up. */
function upkeep(p) {
  const a = arrangement();
  if (!a) return;
  const f = fam();
  const year = store.state.year;
  if (p.age >= 18) { a.ended = year; a.history.push({ year, why: 'grew up' }); return; }
  const home = npc(a.primaryId);
  const other = npc(a.otherId);
  if (home && !home.alive && other?.alive) {
    // The other parent takes the child home with them: still the same child, now living with them.
    a.primaryId = other.id; a.otherId = home.id; a.schedule = null;
    a.history.push({ year, primaryId: other.id, why: 'a parent died' });
    other.flags.livesApart = false;
    homeAgain(store.state, other.id);
    log(`You go to live with ${other.firstName} now.`, 'system', 'neutral');
    f.arrangement = a;
  } else if (other && !other.alive) { a.ended = year; a.history.push({ year, why: 'a parent died' }); }
  if (a.ended) return;
  tickFamilyCourt(a, swapHome); // a case waiting on mediation or a judge is settled, once
  tickAppeals(a, swapHome); // an appeal, or a request to look again, is decided a year on
  paySupport(a); // the year's child support, from one household to the other
}

/** The child asks to live mainly with the other parent. From twelve, they are listened to; not always agreed with. */
export function askToLiveWith(parentId) {
  roll(`live/${parentId}`);
  const p = player();
  const a = arrangement();
  const n = npc(parentId);
  if (!a || !n || a.otherId !== n.id) return result(false, 'You already live with them.', 'neutral');
  if (p.age < 12) return result(false, 'That is a decision for the grown-ups while you are this young.', 'neutral');
  const home = npc(a.primaryId);
  const fair = 0.3 + (n.meters.relationship - 50) / 150 + (p.age - 12) * 0.06 - (home ? (home.meters.relationship - 50) / 300 : 0);
  if (n.city !== p.city && p.age < 16) return result(false, `${n.firstName} lives in ${n.city}. Both of them say it would mean a new school, and not yet.`, 'neutral');
  if (!rng.chance(clamp(fair, 0.1, 0.85))) {
    if (home) home.meters.relationship = clamp(home.meters.relationship - 3);
    return result(false, `Your parents talked it over. For now, the answer is no: things stay as they are. ${n.firstName} says you can see more of each other instead.`, 'neutral');
  }
  swapHome(a, n, 'you asked');
  return result(true, `Your parents agreed. You move in with ${n.firstName}, and see ${home?.firstName ?? 'your other parent'} ${SCHEDULES[a.schedule ?? 'weekends'].line}.`);
}

function swapHome(a, toParent, why) {
  const year = store.state.year;
  const from = npc(a.primaryId);
  a.primaryId = toParent.id; a.otherId = from?.id ?? null;
  a.schedule ??= 'weekends';
  a.history.push({ year, primaryId: toParent.id, schedule: a.schedule, why });
  toParent.flags.livesApart = false;
  if (from && a.support && !a.support.ended) setSupport(a, from, toParent); // support now runs the other way
  if (from) { from.flags.livesApart = true; houseApart(store.state, from.id, from.city ?? player().city, 'the child moved'); }
  homeAgain(store.state, toParent.id);
  player().city = toParent.city ?? player().city;
}

/** From twelve, asks the court to look again at a decision, to live mainly with this parent. */
export function askCourtToLookAgain(parentId) {
  const p = player();
  const n = npc(parentId);
  if (p.age < 12) return result(false, 'You are too young to ask the court yourself.', 'neutral');
  if (!n || arrangement()?.otherId !== n.id) return result(false, 'You already live with them.', 'neutral');
  const r = askForReview(p.id, `${p.firstName}, now ${p.age}, asked to live mainly with ${n.firstName}`);
  const c = r.ok ? (store.state.justice?.family ? Object.values(store.state.justice.family).filter((x) => x.childId === p.id).at(-1) : null) : null;
  if (c) c.reviews.at(-1).wish = n.id;
  return result(r.ok, r.text, r.tone);
}

/** Asks to see the other parent more often: a step up the schedule. */
export function askToSeeMore(parentId) {
  roll(`more/${parentId}`);
  const a = arrangement();
  const n = npc(parentId);
  if (!a || a.otherId !== n?.id) return result(false, 'You live with them already.', 'neutral');
  const next = { occasional: 'weekends', legacy: 'weekends', holidays: null, weekends: 'shared', shared: null }[a.schedule ?? 'weekends'];
  if (!next) return result(false, a.schedule === 'holidays' ? `${n.firstName} lives too far away for more than the holidays.` : 'You already spend half your time with each of them.', 'neutral');
  const home = npc(a.primaryId);
  if (!rng.chance(clamp(0.35 + (n.meters.relationship - 50) / 120 + ((home?.meters.relationship ?? 50) - 50) / 200, 0.1, 0.85))) {
    return result(false, `Your parents could not agree on a new schedule this year. It stays ${SCHEDULES[a.schedule ?? 'weekends'].line}.`, 'neutral');
  }
  a.schedule = next;
  a.history.push({ year: store.state.year, schedule: next, why: 'you asked to see more of them' });
  n.meters.relationship = clamp(n.meters.relationship + 5);
  return result(true, `It is settled: from now on you see ${n.firstName} ${SCHEDULES[next].line}.`);
}

/** Whether the other parent is seen often enough that time together does not fade (engine/relationships.js). */
export function seenOften(n) {
  const a = arrangement();
  return !!a && a.otherId === n.id && ['shared', 'weekends'].includes(a.schedule ?? ''); // an arrangement from an older save keeps how it always worked
}

// ---------- A parent's new partner ----------

function single(parent) { return !partnerOfParent(parent); }

function newPartners(p) {
  if (p.age > 25 || p.royal) return;
  const year = store.state.year;
  for (const parent of parentsNow()) {
    const widowed = parentsNow().length === 1 && bioParentIdsOf(p).length >= 2;
    const apart = p.flags.parentsStatus === 'separated' || p.flags.parentsStatus === 'single' || widowed;
    if (!apart || !single(parent) || parent.age > 62) continue;
    // A parent who has only just separated takes a while.
    const since = fam().separations.at(-1)?.year ?? -Infinity;
    if (year - since < 1) continue;
    if (!rng.chance(CHANCE.newPartner * (year < 1960 ? 0.5 : 1))) continue;
    meetParentPartner(parent);
  }
}

/** A parent begins a serious relationship. Exported for the vertical-slice tests. */
export function meetParentPartner(parent, o = {}) {
  roll(`partner/${parent.id}`);
  return people(`partner/${parent.id}`, () => meetPartnerNow(parent, o));
}
function meetPartnerNow(parent, { kids = null } = {}) {
  const p = player();
  const year = store.state.year;
  const same = rng.chance(rule('sameSexMarriage', p.countryId) ? 0.05 : 0.01);
  const gender = same ? parent.gender : parent.gender === 'male' ? 'female' : 'male';
  const partner = makeNpc({ role: 'stepparent', countryId: p.countryId, gender, age: clamp(parent.age + rng.int(-6, 6), 24, 75), relationship: rng.int(35, 55) });
  partner.flags.partnerOf = parent.id;
  partner.flags.since = year;
  partner.flags.married = false;
  partner.flags.liveIn = false;
  partner.city = parent.city ?? p.city;
  partner.occupation ??= null;
  store.state.npcs[partner.id] = partner;
  p.npcIds.push(partner.id);
  // Some come with children of their own: real people, with a parent of their own and a life ahead of them.
  const count = kids ?? (partner.age >= 26 ? rng.weighted([0, 1, 2], (k) => [55, 30, 15][k]) : 0);
  const taken = new Set([p.firstName, ...p.npcIds.map((id) => npc(id)?.firstName)]);
  for (let i = 0; i < count; i++) {
    const age = clamp(rng.int(Math.max(0, p.age - 6), p.age + 6), 0, Math.max(0, partner.age - 18));
    const g = rng.pick(['male', 'female']);
    const pool = (COUNTRIES[p.countryId].names[g] ?? []).filter((x) => !taken.has(x));
    const kid = makeNpc({ role: 'stepsibling', countryId: p.countryId, lastName: partner.lastName, gender: g, age,
      firstName: pool.length ? rng.pick(pool) : undefined, relationship: rng.int(30, 50), appearance: inheritAppearance(partner, partner) });
    taken.add(kid.firstName);
    kid.parentIds = [partner.id];
    kid.flags.stepVia = partner.id;
    kid.flags.liveIn = false;
    kid.city = partner.city;
    store.state.npcs[kid.id] = kid;
    p.npcIds.push(kid.id);
  }
  log(`${parent.firstName} is seeing someone: ${partner.firstName} ${partner.lastName}${count ? `, who has ${count === 1 ? 'a child' : `${count} children`} of their own` : ''}.`, 'system', 'neutral');
  storyBeat('blend_meet_partner', { parent: parent.id, partner: partner.id }, { source: 'family', weight: 2 });
  return partner;
}

const kidsOf = (partner) => stepSiblings().filter((k) => k.flags.stepVia === partner.id && k.alive);

function partnersMoveOn(p) {
  const year = store.state.year;
  for (const partner of stepParents()) {
    if (!partner.alive || partner.flags.former) continue;
    const parent = npc(partner.flags.partnerOf);
    if (!parent?.alive) { partner.flags.former = true; partner.flags.ended = year; partner.flags.liveIn = false; continue; }
    const years = year - (partner.flags.since ?? year);
    if (rng.chance(partner.flags.married ? CHANCE.partMarried : CHANCE.part)) { part(partner, parent); continue; }
    if (!partner.flags.liveIn && years >= 1 && rng.chance(CHANCE.moveIn)) moveIn(partner, parent);
    else if (partner.flags.liveIn && !partner.flags.married && years >= 2 && rng.chance(CHANCE.marry)) marryParent(partner, parent);
  }
}

/** The partner moves in with the parent: into the family home if that is where the child mainly lives. */
export function moveIn(partner, parent) {
  roll(`movein/${partner.id}`);
  const p = player();
  partner.flags.liveIn = true;
  partner.flags.livedInSince = store.state.year;
  if (livesApart(parent)) {
    if (parent.flags.hh) houseApart(store.state, partner.id, parent.city ?? p.city, 'moved in', parent.flags.hh);
  }
  // Their children mostly come too where the partner has them at home; some live mainly with their other parent.
  for (const k of kidsOf(partner)) if (k.age < 18) k.flags.liveIn = rng.chance(0.55);
  syncHousehold(store.state);
  const home = !livesApart(parent);
  log(`${partner.firstName} moved in with ${parent.firstName}${home ? '. The house is fuller now' : ''}.`, 'system', 'neutral');
  if (home && kidsOf(partner).some((k) => k.flags.liveIn)) storyBeat('blend_new_stepsibling', { kid: kidsOf(partner).find((k) => k.flags.liveIn).id, partner: partner.id }, { source: 'family', weight: 2 });
}

/** A parent remarries. Only where the law of the place and year lets these two marry. */
export function marryParent(partner, parent) {
  const p = player();
  if (partner.gender === parent.gender && !rule('sameSexMarriage', p.countryId)) { partner.flags.committed = true; return false; }
  partner.flags.married = true;
  partner.flags.marriedYear = store.state.year;
  const key = `family:remarriage:${parent.id}:${partner.id}`;
  log(`${parent.firstName} married ${partner.firstName}. ${partner.firstName} is your ${word(partner, 'stepfather', 'stepmother', 'step-parent')} now.`, 'system', 'good');
  milestone(`${parent.firstName} remarried, to ${partner.firstName}.`, 'family');
  recordEvent({ key, type: 'wedding', title: `${parent.firstName} married ${partner.firstName}`, people: [parent.id, partner.id, ...kidsOf(partner).map((k) => k.id)], significance: 2, privacy: 'family' });
  remember(partner, 'stepWedding', `You were there when they married ${parent.firstName}.`);
  storyBeat('blend_parent_wedding', { parent: parent.id, partner: partner.id }, { source: 'family', must: true });
  return true;
}

function part(partner, parent) {
  const year = store.state.year;
  partner.flags.former = true;
  partner.flags.ended = year;
  partner.flags.liveIn = false;
  for (const k of kidsOf(partner)) k.flags.liveIn = false;
  log(`${parent.firstName} and ${partner.firstName} have split up. ${partner.firstName} moves out; you can still see ${word(partner, 'him', 'her', 'them')} if you both want to.`, 'system', 'neutral');
}

// ---------- Half-brothers and half-sisters ----------

function newHalfSiblings(p) {
  if (p.age > 17) return;
  for (const partner of stepParents()) {
    if (!partner.alive || partner.flags.former || !partner.flags.liveIn) continue;
    const parent = npc(partner.flags.partnerOf);
    if (!parent?.alive) continue;
    const mother = [parent, partner].find((x) => x.gender === 'female');
    const father = [parent, partner].find((x) => x.gender === 'male');
    if (!mother || !father || mother.age > 42) continue;
    const halves = p.npcIds.map(npc).filter((n) => n?.role === 'sibling' && n.parentIds?.includes(partner.id)).length;
    if (halves >= 2 || !rng.chance(CHANCE.baby)) continue;
    halfSibling(parent, partner);
  }
}

/** A baby for a parent and their new partner: the player's half-brother or half-sister. */
export function halfSibling(parent, partner) {
  roll(`baby/${partner.id}`);
  return people(`baby/${partner.id}`, () => halfSiblingNow(parent, partner));
}
function halfSiblingNow(parent, partner) {
  const p = player();
  const c = COUNTRIES[p.countryId];
  const mother = [parent, partner].find((x) => x.gender === 'female') ?? parent;
  const father = [parent, partner].find((x) => x.gender === 'male') ?? partner;
  const taken = new Set([p.firstName, ...p.npcIds.map((id) => npc(id)?.firstName)]);
  const gender = rng.pick(['male', 'female']);
  const free = c.names[gender].filter((x) => !taken.has(x));
  const baby = makeNpc({ role: 'sibling', countryId: p.countryId, lastName: father.lastName, age: 0, gender,
    firstName: free.length ? rng.pick(free) : undefined, relationship: rng.int(50, 80), appearance: inheritAppearance(mother, father) });
  baby.parentIds = [parent.id, partner.id];
  baby.flags.half = parent.id;
  baby.city = parent.city ?? p.city;
  if (livesApart(parent)) baby.flags.livesApartWith = parent.id;
  baby.birthInfo = makeBirthInfo(baby, { date: dayInYearJustLived(baby.id), countryId: p.countryId, city: baby.city, parents: [mother, father] });
  baby.birthday = birthdayFromDate(baby.birthInfo.date);
  store.state.npcs[baby.id] = baby;
  p.npcIds.push(baby.id);
  const kind = word(baby, 'brother', 'sister', 'sibling');
  log(`${parent.firstName} and ${partner.firstName} had a baby: your half-${kind}, ${baby.firstName}.`, 'system', 'good');
  recordEvent({ key: `family:birth:${baby.id}`, type: 'birth', title: `${baby.firstName} was born`, people: [parent.id, partner.id, baby.id], significance: 2, privacy: 'family' });
  return baby;
}

// ---------- Scenes ----------

/** A choice in one of the blended-family scenes (data/events/blended.js). */
export function blendedChoice(value, cast = {}) {
  const p = player();
  const bump = (n, d) => { if (n) n.meters.relationship = clamp(n.meters.relationship + d); };
  const staying = npc(cast.staying);
  const leaving = npc(cast.leaving);
  const partner = npc(cast.partner);
  const parent = npc(cast.parent);
  const kid = npc(cast.kid);
  switch (value) {
    case 'sep_both': bump(staying, 4); bump(leaving, 4); return 'They both said the same thing, separately: it was not because of you.';
    case 'sep_quiet': p.stats.mood = clamp(p.stats.mood - 2); return 'You keep it to yourself. Nobody quite knows how you feel about it, including you.';
    case 'sep_ask': { const r = askToLiveWith(leaving?.id); return r.text; }
    case 'court_staying': return hearChild(staying?.id);
    case 'court_leaving': return hearChild(leaving?.id);
    case 'court_both': return hearChild(null);
    case 'meet_warm': bump(partner, 8); return `${partner?.firstName} seems relieved. So, a little, does ${parent?.firstName}.`;
    case 'meet_time': bump(partner, 3); return 'You are polite, and careful. There is time.';
    case 'meet_cool': bump(partner, -4); bump(parent, -2); return `${parent?.firstName} notices. Nobody says anything about it, yet.`;
    case 'wed_glad': bump(partner, 6); bump(parent, 5); return 'You stand up for them. It surprises you how much you mean it.';
    case 'wed_honest': bump(parent, 3); return `${parent?.firstName} listens, and thanks you for saying so. ${partner?.firstName} says nothing has to change between you and anyone.`;
    case 'wed_names': bump(partner, 2); return `${partner?.firstName} says you can call ${word(partner, 'him', 'her', 'them')} whatever feels right. You go on using ${word(partner, 'his', 'her', 'their')} first name.`;
    case 'step_show': bump(kid, 8); return `You show ${kid?.firstName} where everything is. By the end of the week you have a joke between you.`;
    case 'step_space': bump(kid, 3); return 'You leave each other alone at first. It is a relief to both of you.';
    case 'step_rules': bump(kid, -2); return 'You lay down the law about the bathroom. It does not go down well.';
    default: return '';
  }
}

// ---------- The player's own step-children ----------

/**
 * The player marries someone who already has children: those children are the player's step-children. Children the
 * player already knows (with the spouse among their parents) take the role; children the spouse's life says they
 * have, but who were never met, are made now, once, as the people they are: the spouse's, with their own lives.
 */
export function stepchildrenOnMarriage(spouse) {
  const p = player();
  const known = p.npcIds.map(npc).filter((n) => n?.alive && n.parentIds?.includes(spouse.id) && n.role !== 'child');
  for (const k of known) { k.flags.wasRole = k.role; k.role = 'stepchild'; k.flags.stepVia = spouse.id; }
  const want = Math.max(0, (spouse.life?.kids ?? 0) - known.length - p.npcIds.map(npc).filter((n) => n?.role === 'child' && n.parentIds?.includes(spouse.id)).length);
  if (!want) return known;
  roll(`stepkids/${spouse.id}`);
  const made = people(`stepkids/${spouse.id}`, () => {
    const out = [];
    for (let i = 0; i < want; i++) {
      const age = clamp(rng.int(0, Math.max(0, spouse.age - 20)), 0, 30);
      const kid = makeNpc({ role: 'stepchild', countryId: p.countryId, lastName: spouse.lastName, age, relationship: rng.int(30, 55), appearance: inheritAppearance(spouse, spouse) });
      kid.parentIds = [spouse.id];
      kid.flags.stepVia = spouse.id;
      kid.flags.liveIn = age < 18 && rng.chance(0.55);
      store.state.npcs[kid.id] = kid;
      p.npcIds.push(kid.id);
      out.push(kid);
    }
    return out;
  });
  if (made.length) log(`${spouse.firstName}'s ${made.length === 1 ? 'child' : 'children'}, ${made.map((k) => k.firstName).join(' and ')}, ${made.length === 1 ? 'is' : 'are'} your step${made.length === 1 ? word(made[0], 'son', 'daughter', 'child') : 'children'} now.`, 'system', 'neutral');
  return [...known, ...made];
}
