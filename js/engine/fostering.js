// Foster care and kinship care, with the player as the carer. A child who comes to live with the player is a real
// person with a family of their own: parents who stay their parents, a reason they are in care that is about their
// family's circumstances (never poverty alone, never a crime invented for them), and a plan that is decided by the
// agency and a court at reviews, not by the carer. Most plans aim at the child going home. Some end in a relative's
// care, a guardianship, or, where parents' rights have ended in law, an adoption through the ordinary adoption route.
//
//   p.fostering = {
//     status: 'none'|'applying'|'approved'|'declined'|'closed', appliedYear, approvedYear, declinedWhy, agency,
//     steps: { training, background, home },          the approval steps, each a year when it was done
//     placements: [{ id, childId, kind:'foster'|'kinship', start, end, status, why, goal, rights:'intact'|'ended',
//                    parentIds, agency, contact, reviews:[{ year, said, progress }], progress, outcome, guardian? }]
//   }
// The child: role 'fosterchild' while placed, with flags.placementId; their parents: role 'fosterfamily' (titled
// "{child}'s mother"), in the world and in the player's life only as the child's family. Nobody is made twice.
//
// Simplified model, labeled as such: approval is a year of training, a background check and a home study; the
// carer's authority is day-to-day care only; reviews are once a world year (3-, 6- and 12-month turns alike).
import { keyedDice, onOwnDice } from './keyedDice.js';
import { clamp, uid } from '../util.js';
import { store, player, log, milestone } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { inheritAppearance } from './genetics.js';
import { remember } from './conditions.js';
import { convictionsOf } from './records.js';
import { recordEvent } from './chronicle.js';
import { storyBeat } from './storyDirector.js';
import { ensureLife } from './npcLives.js';
import { adoptionInfoFor } from './birthTag.js';
import { dateNow } from './birthday.js';
import * as N from './neighborhood.js';
import { COUNTRIES } from '../data/countries.js';

/** This file's dice: keyed to the life, the year and what is being decided (engine/keyedDice.js), never the game's own. */
let rng = keyedDice('foster');
const roll = (tag) => { const s = store.state; rng = keyedDice(`foster/${s.slotId}/${s.player.id}/${s.year}/${tag}`); };
/** Makes people on dice of their own: the game's sequence of rolls is left where it was. */
const people = (tag, fn) => onOwnDice(`foster-people/${store.state.slotId}/${store.state.year}/${tag}`, fn);

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const S = () => store.state;
const npc = (id) => S().npcs[id] ?? null;
const word = (n, m, f, x) => (n?.gender === 'male' ? m : n?.gender === 'female' ? f : x);

/** Licensed foster care as the game models it begins here; before, children in need were boarded out informally. */
export const FOSTER_FROM = 1950;
/** The youngest a foster carer can be (simplified: one age everywhere). */
export const CARER_AGE = 21;
/** How many children can be placed with one household at once. */
export const MAX_PLACED = 2;
/** Why children come into care in this model: the family's circumstances, told plainly and without blame. */
export const REASONS = {
  illness: { line: 'a parent is seriously ill and in the hospital for a long while', recover: 0.45 },
  crisis: { line: 'the family is going through a crisis and cannot care for them just now', recover: 0.4 },
  prison: { line: 'their parent is serving a prison sentence', recover: 0.3 },
  coping: { line: 'their parent is getting help, and cannot look after them while they do', recover: 0.35 },
};

const fost = (p = player()) => {
  const f = (p.fostering ??= { status: 'none', steps: {}, placements: [] });
  f.steps ??= {}; f.placements ??= [];
  return f;
};
export const fostering = () => fost();
export const placements = () => fost().placements;
export const activePlacements = () => placements().filter((x) => x.status === 'active');
export const placementOf = (childId) => placements().find((x) => x.childId === childId && x.status === 'active') ?? null;
export const simplified = (countryId = player().countryId) => countryId !== 'us';

/** Why the player cannot apply to foster now, or ''. Being poor, young-ish or single is never a reason. */
export function applyBlock(p = player()) {
  const f = fost(p);
  if (S().year < FOSTER_FROM) return `There is no licensed foster care here in ${S().year}.`;
  if (p.age < CARER_AGE) return `Foster carers have to be ${CARER_AGE} or older.`;
  if (p.legal?.incarceration) return 'Not from a cell.';
  if (p.flags.livesWithParents) return 'You need a home of your own for a child to live in.';
  if (p.education?.enrolled && p.education.housing === 'dorm') return 'Not from student housing.';
  if (f.status === 'applying') return 'Your application is with the agency.';
  if (f.status === 'approved') return 'You are approved already.';
  if (f.status === 'declined' && f.declinedYear >= S().year - 2) return 'The agency declined your application. You can apply again in a few years.';
  return '';
}

/** Starts an application: training, a background check and a home study, over the year ahead. */
export function applyToFoster() {
  roll('apply');
  const p = player();
  const why = applyBlock(p);
  if (why) return result(false, why, 'neutral');
  const f = fost(p);
  const c = COUNTRIES[p.countryId];
  f.status = 'applying';
  f.appliedYear = S().year;
  f.steps = {};
  f.agency = `${p.city} ${rng.pick(['Family Services', 'Children\'s Services', 'Foster Care Agency', 'Child and Family Agency'])}`;
  return result(true, `You applied to ${f.agency}. Over the next year: training evenings, a background check and a home study, someone walking round your home with a clipboard.${simplified(c.id) ? ' (How this works differs by country; this is a simplified version.)' : ''}`);
}

/** The application moves on once a year: training, the check, the home study, then a decision. */
function tickApplication(p) {
  const f = fost(p);
  if (f.status !== 'applying' || S().year <= f.appliedYear) return;
  f.steps.training ??= S().year;
  f.steps.background ??= S().year;
  f.steps.home ??= S().year;
  // Simplified: a criminal record (sealed ones included) ends the application; so does having no stable home.
  if (convictionsOf(p, { sealed: true, juvenile: false }).length) return decline(f, 'The background check found a criminal record.');
  if (p.flags.livesWithParents || p.legal?.incarceration) return decline(f, 'You no longer have a home of your own for a child to live in.');
  f.status = 'approved';
  f.approvedYear = S().year;
  log(`${f.agency} approved you as a foster carer. They will be in touch when a child needs a home like yours.`, 'system', 'good');
  milestone(`Approved as a foster carer, at ${p.age}.`, 'family');
  recordEvent({ key: `foster:approved:${p.id}:${S().year}`, type: 'foster_approved', title: 'Approved as a foster carer', significance: 1, privacy: 'private' });
  return undefined;
}

function decline(f, why) {
  f.status = 'declined'; f.declinedYear = S().year; f.declinedWhy = why;
  log(`${f.agency} declined your application to foster. ${why}`, 'system', 'neutral');
}

/** Whether the agency might call: an approved carer, room in the household, at home. */
export const canTakePlacement = (p = player()) => fost(p).status === 'approved' && activePlacements().length < MAX_PLACED && !p.legal?.incarceration && !p.flags.livesWithParents;

/**
 * A child who needs a home, with their family: made once, as real people. The child is not yet the player's; they
 * become so only if the player says yes.
 */
export function referral(o = {}) {
  roll('referral');
  return people('referral', () => referralNow(o));
}
function referralNow({ age = null, reason = null } = {}) {
  const p = player();
  const c = COUNTRIES[p.countryId];
  const last = rng.pick(c.names.last);
  const mother = makeNpc({ role: 'fosterfamily', countryId: p.countryId, gender: 'female', lastName: last, age: rng.int(22, 44), relationship: rng.int(30, 55) });
  const father = rng.chance(0.55) ? makeNpc({ role: 'fosterfamily', countryId: p.countryId, gender: 'male', lastName: last, age: mother.age + rng.int(-2, 6), relationship: rng.int(25, 50) }) : null;
  const kidAge = age ?? rng.int(1, 15);
  const child = makeNpc({ role: 'fosterchild', countryId: p.countryId, lastName: last, age: Math.min(kidAge, mother.age - 16), relationship: rng.int(30, 50),
    appearance: inheritAppearance(mother, father ?? mother) });
  child.parentIds = [mother.id, ...(father ? [father.id] : [])];
  for (const parent of [mother, father].filter(Boolean)) { parent.flags.title = `${child.firstName}'s ${word(parent, 'father', 'mother', 'parent')}`; parent.flags.childOf = child.id; }
  const why = reason ?? rng.pick(Object.keys(REASONS));
  if (why === 'prison') (father ?? mother).flags.serving = { since: S().year, until: S().year + rng.int(1, 4) };
  child.flags.careReason = why;
  child.flags.needs = rng.pick(['some help catching up at school', 'a calm house and a routine', 'to stay at the same school if they can', 'to keep seeing their brother at weekends', 'time before they trust anyone']);
  for (const n of [mother, father, child].filter(Boolean)) S().npcs[n.id] = n;
  return { child, parents: [mother, father].filter(Boolean), reason: why };
}

/** Says yes to a referral: the child comes to live with the player. Their parents stay their parents. */
export function acceptPlacement(ref, { kind = 'foster' } = {}) {
  const p = player();
  if (kind === 'foster' && !canTakePlacement(p)) return result(false, 'You cannot take a placement now.', 'neutral');
  const f = fost(p);
  const { child, parents, reason } = ref;
  const id = uid('place');
  const pl = { id, childId: child.id, kind, start: S().year, end: null, status: 'active', why: reason, goal: 'reunification', rights: 'intact',
    parentIds: parents.map((x) => x.id), agency: f.agency ?? `${p.city} Family Services`, contact: reason === 'prison' ? 'visits' : 'regular',
    reviews: [], progress: rng.int(10, 35), authority: 'day-to-day care' };
  f.placements.push(pl);
  child.role = kind === 'kinship' ? child.role : 'fosterchild';
  child.flags.placementId = id;
  child.flags.careSince = S().year;
  child.lastInteractionAge = p.age;
  for (const n of [child, ...parents]) if (!p.npcIds.includes(n.id)) p.npcIds.push(n.id);
  N.syncHousehold(S());
  log(`${child.firstName} ${child.lastName}, ${child.age}, came to live with you${kind === 'kinship' ? '' : ` through ${pl.agency}`}: ${REASONS[reason]?.line ?? 'their family needs time'}. What ${word(child, 'he', 'she', 'they')} needs most: ${child.flags.needs}.`, 'system', 'good');
  recordEvent({ key: `foster:placement:${id}`, type: 'care_placement', title: `${child.firstName} came to live with you`, people: [child.id], significance: 2, privacy: 'private' });
  remember(child, 'placed', `Came to live with you at ${child.age}.`);
  storyBeat('fc_welcome', { kid: child.id, words: { needs: child.flags.needs } }, { source: 'family', must: true });
  return result(true, `${child.firstName} is living with you now.`, 'good');
}

/** Says no to a referral: the agency finds someone else. The child and family are not left in the player's life. */
export function declineReferral(ref) {
  for (const n of [ref.child, ...ref.parents]) delete S().npcs[n.id];
  return result(true, 'You tell the agency you cannot take this placement. They thank you, and find someone else.', 'neutral');
}

// ---------- The year: reviews, and what they decide ----------

/** Once a world year: applications move on; every placement is reviewed; a child who turns 18 is helped onward. */
export function tickFostering() {
  const p = player();
  if (!p.alive) return;
  roll('year');
  fost(p);
  tickApplication(p);
  for (const pl of activePlacements()) review(pl);
  // A relative's child with no parent able to care for them: the family is asked first (kinship care).
  const kin = kinNeeding()[0];
  if (kin && !kin.flags.kinAsked) { kin.flags.kinAsked = S().year; storyBeat('kin_care_offer', { kid: kin.id }, { source: 'family', must: true }); }
  // The agency calls an approved carer with room, about one year in three.
  if (canTakePlacement(p) && !p.fostering.offer && rng.chance(0.35)) {
    const ref = referral();
    p.fostering.offer = { childId: ref.child.id, parentIds: ref.parents.map((x) => x.id), reason: ref.reason, year: S().year };
    storyBeat('fc_referral', { kid: ref.child.id, words: { reason: REASONS[ref.reason].line, age: String(ref.child.age) } }, { source: 'family', must: true });
  }
}

/** The pending referral, as people. */
export function pendingReferral() {
  const o = fost().offer;
  if (!o) return null;
  const child = npc(o.childId);
  return child ? { child, parents: o.parentIds.map(npc).filter(Boolean), reason: o.reason } : null;
}
export function answerReferral(yes) {
  const ref = pendingReferral();
  delete fost().offer;
  if (!ref) return result(false, 'There is no referral waiting.', 'neutral');
  return yes ? acceptPlacement(ref) : declineReferral(ref);
}

function review(pl) {
  const child = npc(pl.childId);
  if (!child?.alive) { close(pl, 'ended', 'The placement ended.'); return; }
  const year = S().year;
  if (year <= pl.start) return; // the first review is a year in
  const parents = pl.parentIds.map(npc).filter((n) => n?.alive);
  // A parent's progress toward having the child home: it follows their circumstances, not the carer's wishes.
  const r = REASONS[pl.why] ?? REASONS.crisis;
  // A parent serving a sentence comes out when it is served (flags.serving, set when the child came into care).
  for (const n of parents) if (n.flags.serving && year >= n.flags.serving.until) delete n.flags.serving;
  const inside = parents.some((n) => n.flags.serving || (n.flags.inmate && !n.flags.inmate.released));
  pl.progress = clamp(pl.progress + (inside ? 0 : Math.round(rng.around(r.recover * 40, 14))), 0, 100);
  const said = [];
  if (child.age >= 18) { ageOut(pl, child); return; }
  if (!parents.length) {
    // No parent left: the plan changes to a permanent home: a relative, a guardianship, or an adoption.
    pl.goal = 'permanency'; pl.rights = 'ended';
    said.push('With no parent able to care for them, the plan is now a permanent home.');
  } else if (pl.progress >= 70) {
    reunify(pl, child, parents);
    return;
  } else if (year - pl.start >= 2 && pl.progress < 25 && pl.goal === 'reunification') {
    // After years without progress, the court can change the plan; only it can end parents' rights.
    pl.goal = 'permanency';
    if (child.age < 14 && rng.chance(0.4)) { pl.rights = 'ended'; said.push('The court has ended the parents\' legal rights. The plan is a permanent home.'); } else said.push('The plan has changed to a permanent home, with the parents still the parents in law.');
  } else said.push(pl.progress >= 45 ? 'The plan is still for them to go home, and it is going well.' : 'The plan is still for them to go home, in time.');
  pl.reviews.push({ year, said: said.join(' '), progress: pl.progress, goal: pl.goal, rights: pl.rights });
  storyBeat('fc_review', { kid: child.id, words: { said: said.join(' ') } }, { source: 'family', weight: 1 });
  if (pl.goal === 'permanency' && !pl.askedPermanency) {
    pl.askedPermanency = year;
    storyBeat('fc_permanency', { kid: child.id, words: { rights: pl.rights === 'ended' ? 'Adoption is possible now, if everyone wants it.' : 'Their parents are still their parents in law: guardianship would keep it so.' } }, { source: 'family', must: true });
  }
}

function close(pl, status, line) {
  pl.status = status; pl.end = S().year; pl.outcome = line;
  const child = npc(pl.childId);
  if (child) { delete child.flags.placementId; child.flags.formerPlacement = pl.id; }
  N.syncHousehold(S());
}

/** The child goes home to their family: a decision made at a review, by the agency and the court. */
function reunify(pl, child, parents) {
  close(pl, 'reunified', `${child.firstName} went home to ${parents.map((n) => n.firstName).join(' and ')}.`);
  child.role = 'friend';
  child.flags.title = 'Lived with you in foster care';
  ensureLife(child);
  log(`${child.firstName} has gone home to ${parents[0].firstName}. The house is quiet. You are invited to the first birthday back.`, 'system', 'neutral');
  recordEvent({ key: `foster:reunified:${pl.id}`, type: 'care_reunification', title: `${child.firstName} went home`, people: [child.id, ...pl.parentIds], significance: 2, privacy: 'private' });
  remember(child, 'wentHome', 'Packed your things with you when you went home, and cried in the car after.');
  storyBeat('fc_goodbye', { kid: child.id }, { source: 'family', must: true });
}

/** At 18, the placement ends; the young person is helped toward a home of their own, or stays on for a while. */
function ageOut(pl, child) {
  const stays = child.meters.relationship >= 60;
  close(pl, 'aged out', stays ? `${child.firstName} turned 18 and stayed on while they found their feet.` : `${child.firstName} turned 18 and moved into a place of their own, with help from the agency.`);
  child.role = 'friend';
  child.flags.title = 'Lived with you in foster care';
  ensureLife(child);
  log(stays ? `${child.firstName} turned 18. The agency's help with housing and college starts now, and ${word(child, 'he', 'she', 'they')} is welcome to stay on with you while it does.` : `${child.firstName} turned 18 and moved into a place of their own, with a grant for the deposit and someone at the agency to call.`, 'system', 'neutral');
}

/** Becomes the child's legal guardian: care and decisions for them, without ending their parents' place in law. */
export function becomeGuardian(childId) {
  const pl = placementOf(childId);
  const child = npc(childId);
  if (!pl || pl.goal !== 'permanency') return result(false, 'Guardianship is for when the plan is a permanent home.', 'neutral');
  close(pl, 'guardianship', `You became ${child.firstName}'s legal guardian.`);
  pl.guardian = { since: S().year, authority: 'legal guardian', until: 18 };
  child.role = 'ward';
  child.flags.guardianOf = player().id;
  child.flags.title = 'Your ward';
  N.syncHousehold(S());
  log(`The court made you ${child.firstName}'s legal guardian. ${child.firstName} keeps ${word(child, 'his', 'her', 'their')} name, and ${word(child, 'his', 'her', 'their')} parents are still ${word(child, 'his', 'her', 'their')} parents.`, 'system', 'good');
  recordEvent({ key: `foster:guardian:${pl.id}`, type: 'guardianship', title: `Became ${child.firstName}'s guardian`, people: [child.id], significance: 2, privacy: 'private' });
  return result(true, `You are ${child.firstName}'s legal guardian now.`);
}

/** Adopts a child in care, where the court has ended the parents' rights: through the ordinary adoption record. */
export function adoptFromCare(childId) {
  const p = player();
  const pl = placementOf(childId);
  const child = npc(childId);
  if (!pl || pl.rights !== 'ended') return result(false, 'Adoption is only possible once a court has ended the parents\' legal rights.', 'neutral');
  if (child.age >= 12 && child.meters.relationship < 55) return result(false, `${child.firstName} is old enough to be asked, and is not ready to say yes. That is allowed.`, 'neutral');
  close(pl, 'adopted', `${child.firstName} was adopted by you.`);
  const partner = p.npcIds.map(npc).find((n) => n?.alive && ['spouse', 'partner'].includes(n.role));
  child.flags.birthParentIds = [...(child.parentIds ?? [])];
  child.parentIds = partner ? [partner.id] : [];
  child.role = 'child';
  child.adopted = true;
  child.adoptionInfo = adoptionInfoFor(child, { date: dateNow(), countryId: p.countryId, city: p.city, by: [p.id, ...(partner ? [partner.id] : [])] });
  child.flags.adoptionCard = 'new';
  child.stats ??= { mood: 60, health: child.meters.health, intellect: child.meters.intellect, charm: child.meters.charm };
  N.syncHousehold(S());
  milestone(`Adopted ${child.firstName}, who had lived with you in foster care.`, 'family');
  recordEvent({ key: `foster:adopted:${pl.id}`, type: 'adoption', title: `${child.firstName} was adopted`, people: [child.id], significance: 3, privacy: 'private' });
  return result(true, `The adoption is final. ${child.firstName} is your ${word(child, 'son', 'daughter', 'child')}.`);
}

// ---------- Kinship care: a relative's child ----------

/** A relative's child under 18 with no parent left to care for them, whom the player could take in. */
export function kinNeeding() {
  const p = player();
  if (p.age < CARER_AGE || p.legal?.incarceration || p.flags.livesWithParents) return [];
  return p.npcIds.map(npc).filter((k) => k?.alive && k.age < 18 && ['grandchild', 'niece'].includes(k.role) && !k.flags.kinCare
    && (k.parentIds ?? []).length && k.parentIds.map(npc).every((x) => !x || !x.alive || (x.flags.inmate && !x.flags.inmate.released) || x.flags.serving));
}

/** Takes in a relative's child. Kinship care: their place in the family is unchanged; the arrangement is a placement. */
export function takeInKin(childId) {
  const kid = kinNeeding().find((k) => k.id === childId);
  if (!kid) return result(false, 'They do not need a home just now.', 'neutral');
  kid.flags.kinCare = true;
  return acceptPlacement({ child: kid, parents: (kid.parentIds ?? []).map(npc).filter(Boolean), reason: kid.parentIds.map(npc).some((x) => x?.alive) ? 'prison' : 'crisis' }, { kind: 'kinship' });
}

/** A choice in a fostering scene (data/events/fostering.js). */
export function fosterChoice(value, cast = {}) {
  const child = npc(cast.kid);
  const bump = (d) => { if (child) child.meters.relationship = clamp(child.meters.relationship + d); };
  switch (value) {
    case 'welcome_room': bump(6); return `You show ${child?.firstName} the room. ${child?.firstName} puts one thing on the shelf, and leaves the rest in the bag. That is all right.`;
    case 'welcome_food': bump(5); return `You ask what ${child?.firstName} likes to eat, and make it. Nobody says much. Everybody eats.`;
    case 'welcome_space': bump(3); return 'You tell them where everything is, and leave them be. You can hear the radio on, quietly.';
    case 'ref_yes': return answerReferral(true).text;
    case 'ref_no': return answerReferral(false).text;
    case 'review_support': bump(3); return 'You tell the reviewer how things are going, and what you have seen. The plan is theirs to make.';
    case 'review_concern': return 'You raise your concerns, and they are written down. The decision is the court\'s.';
    case 'perm_guardian': return becomeGuardian(cast.kid).text;
    case 'perm_adopt': return adoptFromCare(cast.kid).text;
    case 'perm_later': return 'You say you need time to think. Nobody rushes you.';
    case 'kin_yes': return takeInKin(cast.kid).text;
    case 'kin_no': return 'You say you cannot take them in. Another relative, or a foster carer, will.';
    case 'bye_hug': bump(4); return `${child?.firstName} hugs you at the door, quickly, and then again.`;
    case 'bye_keep': bump(2); remember(child, 'keptInTouch', 'Wrote to you after you went home.'); return 'You give them your number, and mean it.';
    default: return '';
  }
}

