// Moving out, and back: an adult who lives with their family takes a lease on a real home in their city, with or
// without a roommate, and can later come home again. Built on the neighborhood's homes and households
// (engine/neighborhood.js), its roommates (engine/neighborhoodLife.js) and the yearly rent in engine/finance.js; this
// file adds only what those did not have: the decision, the lease, the deposit, and the way back.
//
//   p.leases = [{ id, homeId, hoodId, city, countryId, start, end, rentYear, deposit, depositTx, roommateId, why, endWhy }]
//
// Rent itself is charged once a year by engine/finance.js, as it always has been; the lease records what was agreed
// and the deposit, which is paid once (its ledger key) and returned once when the lease ends. Nothing here charges by the
// turn, so 3-, 6- and 12-month turns cost the same.
import { store, player, country, log, milestone } from '../state.js';
import { clamp, fmtMoney, localCost, uid } from '../util.js';
import { rng } from '../rng.js';
import { rule } from './rules.js';
import { charge, refund, recordEvent, archiveIdOf } from './chronicle.js';
import { remember } from './conditions.js';
import * as N from './neighborhood.js';
import { takeRoommate, roommate, endRoommate, roommateOptions } from './neighborhoodLife.js';
import { RENT_AND_BILLS } from '../data/properties.js';
import { PROFILES } from '../data/neighborhoods.js';
import { rentFactor } from './policy.js';
import { housingK } from './cities.js';
import { legalParentIdsOf, livesApart } from './kinship.js';
import { storyBeat } from './storyDirector.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const S = () => store.state;
const npc = (id) => S().npcs[id] ?? null;
const money = (x) => fmtMoney(x, country());

/** The age a person can sign a lease in their own name here (data/rules.js majorityAge; simplified, one age a country). */
export const leaseAge = (countryId = player().countryId) => rule('majorityAge', countryId) ?? 18;

const leases = (p = player()) => (p.leases ??= []);
export const currentLease = (p = player()) => leases(p).find((l) => l.end == null) ?? null;

/** Why the player cannot move out now, or '' if they can. */
export function moveOutBlock(p = player()) {
  if (!p.flags.livesWithParents) return 'You do not live with your family.';
  if (p.legal?.incarceration) return 'Not from a cell.';
  if (p.royal && !p.royal.waiting && ['monarch', 'heir', 'royal'].includes(p.royal.rank)) return 'A royal household does not rent.';
  if (p.flags.care) return 'You live with your carer until you are grown.';
  if (p.age < leaseAge()) return `You have to be ${leaseAge()} to sign a lease here.`;
  if (p.education?.enrolled && p.education.housing === 'dorm') return 'You live in the dorm while you study.';
  return '';
}
export const canMoveOut = () => !moveOutBlock();

/** Roughly what a year's rent and bills come to in a kind of neighborhood: what engine/finance.js will charge. */
function rentYear(profileId, shared) {
  const c = country();
  const cost = PROFILES[profileId]?.cost ?? 1;
  return Math.round(localCost(RENT_AND_BILLS, c) * rentFactor(c.id) * (0.5 + 0.5 * housingK()) * (0.8 + 0.2 * cost) * (shared ? 0.6 : 1));
}

/** Kinds of neighborhood in the player's city with homes to rent, as the year allows. */
export function rentalOptions() {
  const p = player();
  const ids = ['apartments', 'urban', 'suburban', 'smalltown', 'mixed', 'downtown', 'historic'].filter((x) => PROFILES[x] && N.profileAvailable(x, p.countryId, S().year));
  return ids.slice(0, 4).map((id) => ({ profileId: id, name: PROFILES[id].name, rentYear: rentYear(id, false), rentShared: rentYear(id, true), deposit: Math.round(rentYear(id, false) / 12) }));
}

/** Who could share with the player: friends of 18 or more who like them enough (engine/neighborhoodLife.js). */
export function roommateCandidates() {
  return player().npcIds.map(npc).filter((n) => n?.alive && n.role === 'friend' && n.age >= 18 && n.meters.relationship >= 50);
}

/**
 * Moves out of the family home into a rented one: a real, empty home in the chosen kind of neighborhood. `roommate` is a
 * friend's id, 'notice' for someone answering a notice, or null to live alone. The deposit is paid once, now.
 */
export function moveOut(profileId, roommateChoice = null) {
  const p = player();
  const why = moveOutBlock(p);
  if (why) return result(false, why, 'neutral');
  const opt = rentalOptions().find((o) => o.profileId === profileId);
  if (!opt) return result(false, 'There is nothing to rent there just now.', 'neutral');
  const id = uid('lease');
  const paid = charge({ amount: opt.deposit, kind: 'deposit', memo: 'Deposit on a rented home', key: `deposit:${id}`, ref: { lease: id } }, p);
  if (!paid.ok) return result(false, `The deposit is ${money(opt.deposit)}, a month's rent. You have ${money(Math.max(0, p.finance.cash))}.`, 'neutral');
  const first = !leases(p).length;
  p.flags.livesWithParents = false;
  if (!p.education?.enrolled) p.education.housing = 'apartment';
  const d = N.dwelling(S());
  const home = N.findHome(S(), d, { profile: profileId });
  N.moveInto(S(), home, d, first ? 'moved out' : 'moved');
  const hood = N.hoods().list[home.h];
  const lease = { id, homeId: home.id, hoodId: hood.id, city: p.city, countryId: p.countryId, start: S().year, end: null,
    rentYear: opt.rentYear, deposit: opt.deposit, depositTx: paid.tx.id, roommateId: null, why: first ? 'first home' : 'moved' };
  leases(p).push(lease);
  let shared = '';
  if (roommateChoice) {
    const r = takeRoommate(roommateChoice === 'notice' ? null : roommateChoice);
    if (r.ok) { lease.roommateId = roommate()?.id ?? null; shared = ` ${roommate()?.firstName} moves in with you; you split the rent.`; }
  }
  // The family stays the family: nobody is less a parent for the child moving out.
  for (const n of legalParentIdsOf(p).map(npc).filter((x) => x?.alive)) remember(n, 'movedOut', `Helped carry the boxes when you moved out at ${p.age}.`);
  if (first) {
    milestone(`Moved into a place of your own, at ${p.age}.`, 'life');
    recordEvent({ key: `home:first:${archiveIdOf(p)}`, type: 'first_home', title: 'A place of your own', text: `${home.label} in ${hood.name}, ${hood.city}.`,
      place: { countryId: p.countryId, city: p.city }, people: lease.roommateId ? [lease.roommateId] : [], significance: 2, privacy: 'family' });
    storyBeat(lease.roommateId ? 'home_first_night_shared' : 'home_first_night', { ...(lease.roommateId ? { roommate: lease.roommateId } : {}), words: { place: hood.name } }, { source: 'family' });
  }
  const text = `You signed a lease on ${home.label} in ${hood.name} and moved out. You paid ${money(opt.deposit)} as a deposit; rent and bills come to about ${money(lease.roommateId ? opt.rentShared : opt.rentYear)} a year.${shared}`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** Why the player cannot move back to their family now, or ''. */
export function moveBackBlock(p = player()) {
  if (p.flags.livesWithParents) return 'You live with your family already.';
  if (p.homeId) return 'You live in a home you own.';
  if (p.legal?.incarceration) return 'Not from a cell.';
  if (p.royal && !p.royal.waiting) return 'Not as a royal.';
  const H = N.hoods();
  const fam = H.family ? H.hhs[H.family] : null;
  const parents = legalParentIdsOf(p).map(npc).filter((n) => n?.alive && n.role === 'parent' && !livesApart(n));
  if (!fam?.home || !parents.length) return 'There is no family home to go back to.';
  const home = H.homes[fam.home];
  if (H.list[home.h]?.city !== p.city || H.list[home.h]?.c !== p.countryId) return 'Your family lives in another city.';
  if (p.npcIds.some((id) => npc(id)?.role === 'spouse' && npc(id).alive)) return 'You live with your spouse.';
  return '';
}

/**
 * Moves back in with the family: if they agree. They usually do; not always, and not on any terms. The lease ends and
 * the deposit comes back, once. The homes the player has lived in stay on the record (engine/neighborhood.js).
 */
export function moveBackHome() {
  const p = player();
  const why = moveBackBlock(p);
  if (why) return result(false, why, 'neutral');
  const parents = legalParentIdsOf(p).map(npc).filter((n) => n?.alive && n.role === 'parent' && !livesApart(n));
  const warmth = parents.reduce((s, n) => s + n.meters.relationship, 0) / parents.length;
  if (!rng.chance(clamp(0.25 + warmth / 100, 0.2, 0.95))) {
    for (const n of parents) n.meters.relationship = clamp(n.meters.relationship - 2);
    return result(false, `${parents[0].firstName} says not right now: there is no room, and it would not be fair on anyone. You can ask again another year.`, 'neutral');
  }
  const lease = currentLease(p);
  let back = '';
  if (lease) {
    lease.end = S().year; lease.endWhy = 'moved back home';
    const r = refund(lease.depositTx, 1, 'Deposit returned at the end of a lease', p);
    if (r.ok) back = ` The landlord returned your ${money(r.amount)} deposit.`;
  }
  if (roommate()) endRoommate();
  p.flags.livesWithParents = true;
  p.education.housing = 'home';
  const H = N.hoods();
  const home = H.homes[H.hhs[H.family].home];
  N.moveInto(S(), home, N.dwelling(S()), 'moved back home');
  for (const n of parents) remember(n, 'cameHome', `Made up your old room when you came home at ${p.age}.`);
  const text = `You moved back in with ${parents.map((n) => n.firstName).join(' and ')}.${back} Your old room is smaller than you remember.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/** Every home the player has rented, newest first. */
export const leaseHistory = (p = player()) => [...leases(p)].reverse();

/** The lease follows the home: one that ended some other way (bought a home, married, emigrated) is closed honestly. */
export function tickIndependence() {
  const p = player();
  const lease = currentLease(p);
  if (!lease) return;
  const H = N.hoods();
  const here = N.currentHome();
  if (here?.id === lease.homeId && !p.flags.livesWithParents) { if (lease.roommateId && !roommate()) lease.roommateLeft = S().year; return; }
  lease.end = S().year;
  lease.endWhy = p.flags.livesWithParents ? 'moved back home' : p.homeId ? 'bought a home' : 'moved';
  const r = refund(lease.depositTx, 1, 'Deposit returned at the end of a lease', p);
  if (r.ok) log(`Your old landlord returned your ${money(r.amount)} deposit.`, 'system', 'good');
  // Still renting, somewhere else in the city (engine/neighborhoodLife.js moveTo): the new home's lease, on the record.
  if (here && N.dwelling(S())?.kind === 'rent') {
    leases(p).push({ id: uid('lease'), homeId: here.id, hoodId: here.h, city: p.city, countryId: p.countryId, start: S().year, end: null,
      rentYear: lease.rentYear, deposit: 0, depositTx: null, roommateId: roommate()?.id ?? null, why: 'moved within the city' });
  }
  void H;
}

export { roommateOptions };
