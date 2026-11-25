// Children: pregnancy, birth, adoption, growing up, and grandchildren. Also
// getting a pet. Children carry their own stats and talents so a later phase
// can let the player continue as one of them.
import { birthdayFor, dateNow } from './birthday.js';
import { makeBirthInfo, dayInYearJustLived, birthdayFromDate, playerBirthInfo, adoptionInfoFor } from './birthTag.js';
import { announce } from './pregnancyChoice.js';
import { childbirthRisk } from './history.js';
import { atBirth, held } from './citizenship.js';
import { noteBirth } from './globalLife.js';
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, localCost } from '../util.js';
import { store, player, country, npcsByRole, livingNpcs, log, milestone } from '../state.js';
import { makeNpc, makePet } from './npcFactory.js';
import { inheritAppearance, inheritTraits, inheritTalents, inheritStats, addedTalents } from './genetics.js';
import { spendAction, PET_PRICE, canGetPet } from './relationships.js';
import { childGenome, genomeOf } from './health/heredity.js';
import { quickAdopt } from './animalCare.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

export const ADOPTION_FEE = 15000;
export const CHILD_COST = 5000; // per child under 18, per year, base units
const MAX_CHILDBEARING_AGE = 47;

function addNpc(npc) {
  store.state.npcs[npc.id] = npc;
  player().npcIds.push(npc.id);
  npc.lastInteractionAge = player().age;
  return npc;
}

/** The player as a set of genes, in the shape genetics.js expects of a parent. */
const playerGenes = () => {
  const p = player();
  return { appearance: p.appearance, traits: p.traits, talents: p.talents,
    meters: { intellect: p.stats.intellect, charm: p.stats.charm, health: p.stats.health, crazy: p.hidden.crazy } };
};
const npcGenes = (npc) => ({ appearance: npc.appearance, traits: npc.traits ?? [], talents: npc.talents ?? {}, meters: npc.meters });

/** True when the player and this person could have a baby together. */
export function canConceive(npc) {
  const p = player();
  const mine = p.flags.bornAs ?? p.gender;
  const theirs = npc.flags?.bornAs ?? npc.gender;
  if ([mine, theirs].sort().join('+') !== 'female+male') return false;
  if (p.flags.identity?.bottom) return false;
  if (p.age < 18 || npc.age < 18) return false;
  const motherAge = mine === 'female' ? p.age : npc.age;
  return motherAge <= MAX_CHILDBEARING_AGE;
}

/** Starts a pregnancy. @returns {string} what the player is told */
export function conceive(npc, planned) {
  const p = player();
  p.flags.pregnancy = { dueAge: p.age + 1, otherId: npc.id };
  const said = p.gender === 'female' ? (planned ? 'You are pregnant.' : 'A few weeks later, the test is positive. You are pregnant.')
    : (planned ? `${npc.firstName} is pregnant.` : `A few weeks later, ${npc.firstName} tells you they are pregnant.`);
  announce(npc, said);
  return said;
}

export const canTryForBaby = (npc) =>
  (npc.role === 'spouse' || npc.role === 'partner') && canConceive(npc) && !player().flags.pregnancy
  && !player().legal.incarceration;

/** The chance a try works, by the mother's age and fertility: good when young, falling after 35, low past 42. */
function conceiveChance(motherAge, fertility) {
  const byAge = motherAge <= 34 ? 0.55 : motherAge <= 38 ? 0.4 : motherAge <= 42 ? 0.2 : 0.08;
  return clamp(byAge * (0.6 + (fertility ?? 50) / 125), 0.04, 0.85);
}

/** Trying for a baby: as often as the couple likes, each try a fresh chance. */
export function tryForBaby(npcId) {
  const p = player();
  const npc = store.state.npcs[npcId];
  if (!canTryForBaby(npc)) return result(false, 'That is not possible right now.', 'neutral');
  const motherAge = p.gender === 'female' ? p.age : npc.age;
  if (!rng.chance(conceiveChance(motherAge, p.hidden.fertility))) {
    const text = `You and ${npc.firstName} tried for a baby. Not this time.`;
    log(text);
    return result(false, text, 'neutral');
  }
  const text = `You and ${npc.firstName} tried for a baby. ${conceive(npc, true)}`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** A round of IVF: from 1978, at a clinic's price; a much better chance, and twins (or more) about twice as often. */
export const IVF_COST = 15000;
export const ivfOpen = (npc) => canTryForBaby(npc) && store.state.year >= 1978;
export const ivfPrice = () => localMoney(IVF_COST, country());
export function tryIvf(npcId) {
  const p = player();
  const npc = store.state.npcs[npcId];
  if (!ivfOpen(npc)) return result(false, store.state.year < 1978 ? 'IVF does not exist yet.' : 'That is not possible right now.', 'neutral');
  const cost = ivfPrice();
  if (p.finance.cash < cost) return result(false, `A round of IVF costs ${fmtMoney(cost, country())}.`, 'neutral');
  p.finance.cash -= cost;
  const motherAge = p.gender === 'female' ? p.age : npc.age;
  const chance = clamp(conceiveChance(motherAge, p.hidden.fertility) * 1.6 + 0.1, 0.15, 0.9);
  if (!rng.chance(chance)) {
    const text = `A round of IVF with ${npc.firstName}: weeks of appointments and hope, and then a negative test. It cost ${fmtMoney(cost, country())}.`;
    log(text, 'system', 'bad');
    return result(false, text, 'neutral');
  }
  const text = `A round of IVF with ${npc.firstName}. ${conceive(npc, true)} It cost ${fmtMoney(cost, country())}.`;
  p.flags.pregnancy.ivf = true;
  log(text, 'system', 'good');
  return result(true, text);
}

export function newborn(other) {
  const p = player();
  const me = playerGenes();
  const them = other?.appearance ? npcGenes(other) : me;
  const [mother, father] = p.gender === 'female' ? [me, them] : [them, me];
  const child = makeNpc({ role: 'child', countryId: p.countryId, lastName: p.lastName, age: 0,
    relationship: rng.int(75, 95), appearance: inheritAppearance(mother, father) });
  const born = inheritStats(mother, father);
  child.stats = born.stats;
  child.hidden = born.hidden;
  child.talents = inheritTalents(mother, father);
  child.traits = inheritTraits(mother, father).traits;
  child.meters.intellect = born.stats.intellect;
  child.meters.charm = born.stats.charm;
  child.meters.health = born.stats.health;
  child.parentIds = other ? [other.id] : [];
  // Nationality: each parent's, and the place's own where being born there is enough.
  child.citizenships = atBirth(p.countryId, [held(p), other ? held(other) : []], store.state.year);
  // Genes come from the two biological parents; a parent's diagnosis is never copied to a child.
  const mine = genomeOf(p); const theirs = other ? genomeOf(other) : null;
  const sex = child.gender === 'male' ? 'male' : 'female';
  child.genome = p.gender === 'female' ? childGenome(mine, theirs, child.id, sex) : childGenome(theirs, mine, child.id, sex);
  child.bornIn = p.countryId;
  child.birthCity = p.city;
  const added = addNpc(child);
  noteBirth(child);
  return added;
}

/** A clock time some minutes later: "11:58 PM" and 5 is "12:03 AM". */
function later(time, minutes) {
  const [, h, m, ap] = time.match(/(\d+):(\d+) (AM|PM)/);
  const t = ((Number(h) % 12) + (ap === 'PM' ? 12 : 0)) * 60 + Number(m) + minutes;
  const hh = Math.floor(t / 60) % 24;
  return `${hh % 12 || 12}:${String(t % 60).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}

/** What several babies born together are called. */
export const MULTIPLES = { 2: 'twins', 3: 'triplets', 4: 'quadruplets' };

function birth() {
  const p = player();
  const other = store.state.npcs[p.flags.pregnancy.otherId];
  const ivf = !!p.flags.pregnancy.ivf;
  p.flags.pregnancy = null;
  const babies = [newborn(other)];
  // Twins now and then; triplets and quadruplets very rarely (about 1 birth in 700, and 1 in 7,000). IVF doubles the chance.
  if (rng.chance(ivf ? 0.05 : 0.025)) {
    babies.push(newborn(other));
    if (rng.chance(ivf ? 0.12 : 0.06)) { babies.push(newborn(other)); if (rng.chance(ivf ? 0.2 : 0.1)) babies.push(newborn(other)); }
  }
  // The hospital tag (engine/birthTag.js): the day, during the year just lived, the time, the size, the doctor. Twins
  // share the day and the doctor, a few minutes apart, and are each a little smaller.
  const date = dayInYearJustLived(babies[0].id);
  playerBirthInfo(p); // the player's own size at birth, kept, so the baby leans toward the same one their tag shows
  babies.forEach((b, i) => {
    b.birthInfo = makeBirthInfo(b, { date, countryId: p.countryId, city: p.city, parents: [p, other], twin: babies.length > 1 ? babies.length : false });
    if (i) { const first = babies[0].birthInfo; b.birthInfo = { ...b.birthInfo, doctor: first.doctor, place: first.place, room: first.room, atHome: first.atHome, time: later(babies[i - 1].birthInfo.time, 4 + (b.birthInfo.weightOz % 14)) }; }
    b.birthday = birthdayFromDate(date);
    b.flags.birthTag = 'new'; // shown when the turn is over (ui/shell.js birthNotice)
  });
  const kind = (n) => (n.gender === 'male' ? 'boy' : 'girl');
  const many = MULTIPLES[babies.length];
  const names = babies.map((b) => b.firstName);
  const text = babies.length > 1
    ? `${p.gender === 'female' ? 'You gave birth to' : `${other?.firstName ?? 'Your partner'} gave birth to`} ${many}: ${names.slice(0, -1).join(', ')} and ${names.at(-1)}.`
    : `${p.gender === 'female' ? 'You gave birth to' : `${other?.firstName ?? 'Your partner'} gave birth to`} a baby ${kind(babies[0])}, ${babies[0].firstName}.`;
  log(`${text} You can change the name from the People tab.`, 'system', 'good');
  // Historical Eras: in earlier years childbirth was dangerous for the mother (engine/history.js).
  if (rng.chance(childbirthRisk())) {
    if (p.gender === 'female') p.flags.birthDeath = true;
    else if (other?.alive) { other.alive = false; other.flags.diedYear = store.state.year; log(`${other.firstName} did not survive the birth. The midwife did everything she could.`, 'system', 'bad'); p.stats.mood = clamp(p.stats.mood - 30); }
  }
  milestone(babies.length > 1 ? `${MULTIPLES[babies.length].replace(/^./, (c) => c.toUpperCase())} ${names.slice(0, -1).join(', ')} and ${names.at(-1)} were born.` : `${babies[0].firstName} was born.`, 'family');
  p.stats.mood = clamp(p.stats.mood + 14);
  if (other?.alive && (other.role === 'spouse' || other.role === 'partner')) {
    other.meters.relationship = clamp(other.meters.relationship + 6);
  }
}

export const canAdopt = () => {
  const p = player();
  return p.age >= 21 && !p.legal.incarceration && npcsByRole('child').filter((k) => k.age < 18).length < 6;
};

export function adopt() {
  const p = player();
  const c = country();
  const fee = localMoney(ADOPTION_FEE, c);
  if (!canAdopt()) return result(false, 'You cannot adopt right now.', 'neutral');
  if (p.finance.cash < fee) return result(false, `Adoption costs ${fmtMoney(fee, c)} in fees. You do not have it.`, 'neutral');
  if (p.flags.adoptedAtAge === p.age) return result(false, 'The agency handles one application a year.', 'neutral');
  p.flags.adoptedAtAge = p.age;
  p.finance.cash -= fee;
  const child = addNpc(makeNpc({ role: 'child', countryId: p.countryId, lastName: p.lastName, age: rng.int(0, 8),
    relationship: rng.int(45, 70) }));
  child.adopted = true;
  // The day they came home (ui/birthTag.js adoption card).
  const partner = livingNpcs().find((n) => ['spouse', 'partner'].includes(n.role));
  child.birthday ??= birthdayFor(child.id);
  child.adoptionInfo = adoptionInfoFor(child, { date: dateNow(), countryId: c.id, city: p.city, by: [p.id, ...(partner ? [partner.id] : [])] });
  child.flags.adoptionCard = 'new';
  child.stats = { mood: 60, health: child.meters.health, intellect: child.meters.intellect, charm: child.meters.charm };
  child.talents = { music: rng.int(0, 60), sports: rng.int(0, 60), acting: rng.int(0, 60), crime: rng.int(0, 60),
    singing: rng.int(0, 60), dance: rng.int(0, 60) };
  addedTalents(child.talents, () => 30, 0, 60);
  p.stats.mood = clamp(p.stats.mood + 12);
  p.hidden.karma = clamp(p.hidden.karma + 8);
  const text = `After a year of forms and home visits, you adopted ${child.firstName}, age ${child.age}. The fees came to ${fmtMoney(fee, c)}.`;
  log(text, 'system', 'good');
  milestone(`Adopted ${child.firstName}.`, 'family');
  return { ...result(true, text), childId: child.id };
}

/** How long a name may be, and what it may be made of: letters (any alphabet, accents too), spaces, hyphens, apostrophes. */
export const NAME_LIMITS = { first: 20, last: 30 };
const NAME_OK = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;
/** A name as typed, tidied: spaces trimmed and collapsed. Null if it will not do. */
export function cleanName(name, max) {
  const s = String(name ?? '').trim().replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-');
  return s && s.length <= max && NAME_OK.test(s) && !/[-' .]{2}/.test(s) && !/[-]$/.test(s) ? s : null;
}
const HISPANIC = new Set('es mx ar co cl pe ve cu do ec gt bo py uy sv hn ni cr pa pr'.split(' '));
const LUSOPHONE = new Set(['pt', 'br', 'ao']);
/**
 * The last names a baby could be given: the player's, their partner's, both joined, or both the way the country does
 * it (father's then mother's in Spanish-speaking countries, mother's then father's in Portuguese-speaking ones). The
 * first is the usual choice where they live.
 */
export function surnameChoices(baby, p = player()) {
  const other = (baby.parentIds ?? []).map((id) => store.state.npcs[id]).find(Boolean);
  const mine = p.lastName;
  const theirs = other?.lastName;
  if (!theirs || theirs === mine) return [{ value: mine, label: mine }];
  const [mom, dad] = p.gender === 'female' ? [mine, theirs] : [theirs, mine];
  const first = (s) => s.split(/[ -]/)[0];
  const local = HISPANIC.has(p.countryId) ? `${first(dad)} ${first(mom)}` : LUSOPHONE.has(p.countryId) ? `${first(mom)} ${first(dad)}` : null;
  const list = [
    ...(local ? [{ value: local, label: `${local} (both, as is the custom here)` }] : []),
    { value: mine, label: `${mine} (yours)` },
    { value: theirs, label: `${theirs} (${other.firstName}'s)` },
    { value: `${first(mine)}-${first(theirs)}`, label: `${first(mine)}-${first(theirs)}` },
    { value: `${first(theirs)}-${first(mine)}`, label: `${first(theirs)}-${first(mine)}` },
  ];
  return list.filter((x, i) => x.value.length <= NAME_LIMITS.last && list.findIndex((y) => y.value === x.value) === i);
}

/**
 * Names a newborn, at birth: first name and last name. The day's lines in the life story are written with the name
 * the baby is given, not the one the game first put down.
 */
export function nameBaby(npcId, first, last) {
  const npc = store.state.npcs[npcId];
  const f = cleanName(first, NAME_LIMITS.first);
  const l = cleanName(last, NAME_LIMITS.last);
  if (!npc || !canRename(npc)) return result(false, 'That baby cannot be named now.', 'neutral');
  if (!f) return result(false, `A first name is up to ${NAME_LIMITS.first} letters: letters, spaces, hyphens and apostrophes.`, 'neutral');
  if (!l) return result(false, `A last name is up to ${NAME_LIMITS.last} letters: letters, spaces, hyphens and apostrophes.`, 'neutral');
  const old = npc.firstName;
  npc.firstName = f;
  npc.lastName = l;
  const p = player();
  // Whole names only, in any alphabet: "José" and "Zoë" too (\\b does not count accented letters as letters).
  const re = new RegExp(`(?<![\\p{L}\\p{M}])${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{M}])`, 'gu');
  for (const e of store.state.journal.filter((x) => x.age === p.age)) e.text = e.text.replace(re, f);
  for (const m of p.milestones.filter((x) => x.age === p.age)) m.text = m.text.replace(re, f);
  return result(true, `Welcome, ${f} ${l}.`, 'good');
}

/** Only babies can be renamed. */
export const canRename = (npc) => npc.role === 'child' && npc.age <= 1 && !npc.adopted;
export function renameChild(npcId, name) {
  const npc = store.state.npcs[npcId];
  const clean = String(name ?? '').trim().slice(0, 20);
  if (!clean || !canRename(npc)) return result(false, 'That name will not do.', 'neutral');
  const old = npc.firstName;
  npc.firstName = clean;
  const text = `${old} is now called ${clean}.`;
  log(text);
  return result(true, text, 'neutral');
}

/** Adopts the first animal at the local shelter that the household can properly take (engine/animalCare.js). */
export function getPet() {
  return quickAdopt();
}

/** What the children cost this year, in local money. */
export function childCosts() {
  const minors = npcsByRole('child').filter((k) => k.age < 18).length;
  return minors * localCost(CHILD_COST, country());
}

/** Yearly: births. What children go on to do is in npcLives.js. */
export function tickChildren() {
  const p = player();
  if (p.flags.pregnancy && p.age >= p.flags.pregnancy.dueAge) birth();
}
