// Moving Out & Independence (18+). Choosing to move out (a studio, a flat shared with a friend, or a room in a house
// share), signing a lease, what a month of rent and bills actually costs, renewing or giving notice, falling behind
// and the eviction letter, moving back home, and the skills of looking after yourself (cooking, cleaning, a budget).
//
// Money: nothing is charged twice. The yearly living costs stay in engine/finance.js; while the player has a lease, the
// lease's months are billed into home.billed[year] here, month by month, and finance uses that in place of its own rent
// estimate for those months (leaseBill). A lease is priced from the same estimate, so a life without one costs the same
// as before. The deposit is paid on moving out and returned (less any arrears) on leaving.
//
//   LF().home = { lease: { kind, monthlyRent, monthlyBills, start, end, notice, deposit, roommateId, status } | null,
//                 billed: { [year]: amount }, arrears, warned, skills: { cooking, cleaning, budgeting },
//                 movedOut: month | null, movedBack: month | null, acted: {} }
import { store, log, milestone } from '../state.js';
import { clamp, localCost, fmtMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { RENT_AND_BILLS } from '../data/properties.js';
import { rentFactor } from './policy.js';
import { housingK } from './cities.js';
import { takeRoommate, endRoommate, roommate, roommateOptions } from './neighborhoodLife.js';
import { storyBeat } from './storyDirector.js';
import { LF, lived, nowMonth, yearOfMonth, recordEvent, dice, withDice, onMonth, done, fail, leaseOk } from './livingFamilies.js';

const S = () => store.state;
const H = (state = S()) => { const h = LF(state).home; h.billed ??= {}; h.skills ??= { cooking: 10, cleaning: 15, budgeting: 10 }; h.arrears ??= 0; return h; };
const C = (state = S()) => COUNTRIES[state.player.countryId];
const turnKey = (state = S()) => `${state.year}:${state.month ?? 0}`;

/** The kinds of place a first home can be. `share`: of the full rent and bills for a place in this city. */
export const PLACES = [
  { id: 'room', name: 'A room in a house share', share: 0.45, blurb: 'Your own room; the kitchen and bathroom shared with strangers.' },
  { id: 'share', name: 'A flat shared with a friend', share: 0.6, blurb: 'Half a two-bedroom flat, with someone you know.' },
  { id: 'studio', name: 'A studio of your own', share: 1, blurb: 'One room, a kitchenette, and nobody else\'s dishes.' },
];
export const LEASE_MONTHS = 12;
/** What a month of rent plus bills costs here, for a whole place: the same estimate the yearly living costs use. */
export function monthlyFull(state = S()) {
  const c = C(state);
  return Math.round(localCost(RENT_AND_BILLS, c) * rentFactor(c.id) * (0.5 + 0.5 * housingK()) / 12);
}
/** A place's monthly rent and bills, split as most leases split them. */
export function priceOf(placeId, state = S()) {
  const pl = PLACES.find((x) => x.id === placeId);
  const total = Math.round(monthlyFull(state) * pl.share);
  const rent = Math.round(total * 0.72);
  return { rent, bills: total - rent, total, deposit: rent };
}
export const lease = (state = S()) => { const l = H(state).lease; return l && l.status === 'active' ? l : null; };
export const skills = (state = S()) => H(state).skills;

/** Why the player cannot move out now, or ''. */
export function whyNotMoveOut(state = S()) {
  const p = state.player;
  if (p.age < 18) return 'From 18.';
  if (p.legal?.incarceration) return 'Not from where you are.';
  if (lease(state)) return 'You already have a lease.';
  if (p.homeId) return 'You live in a home you own.';
  if (p.education?.enrolled && p.education.housing !== 'home') return 'You live in student housing (change it from school).';
  if (p.flags.care) return 'You are in care until 18.';
  return '';
}

/** Moving out: sign a year's lease on a place, pay the deposit, and take a roommate if it is a shared flat. */
export function moveOut(placeId, roommateId = null, state = S()) {
  const p = state.player;
  const why = whyNotMoveOut(state) || (!leaseOk(state, p.id).ok ? leaseOk(state, p.id).text : '');
  if (why) return fail(why);
  const pl = PLACES.find((x) => x.id === placeId);
  if (!pl) return fail('Choose a place.');
  const price = priceOf(placeId, state);
  const c = C(state);
  if (p.finance.cash < price.deposit) return fail(`The deposit is ${fmtMoney(price.deposit, c)}, and you do not have it.`);
  p.finance.cash -= price.deposit;
  const wasHome = p.flags.livesWithParents;
  p.flags.livesWithParents = false;
  if (p.education?.enrolled) p.education.housing = 'apartment';
  const h = H(state);
  const start = nowMonth(state);
  h.lease = { kind: placeId, monthlyRent: price.rent, monthlyBills: price.bills, start, end: start + LEASE_MONTHS, notice: false, deposit: price.deposit, roommateId: null, status: 'active' };
  h.movedOut = start;
  let mate = '';
  if (placeId === 'share') {
    const r = withDice(state, `roommate/${start}`, () => takeRoommate(roommateId, state));
    if (r.ok) { h.lease.roommateId = roommate(state)?.id ?? null; mate = ` ${roommate(state)?.firstName ?? 'Your roommate'} moves in with you.`; }
  }
  const text = `${wasHome ? 'You move out of the family home' : 'You move'} into ${pl.name.replace(/^A /, 'a ').toLowerCase()}: ${fmtMoney(price.rent, c)} a month in rent and about ${fmtMoney(price.bills, c)} in bills, on a ${LEASE_MONTHS}-month lease.${mate}`;
  log(text, 'home', 'good');
  if (wasHome) milestone('Moved out of the family home.', 'life');
  recordEvent(state, 'moved_out', [p.id, ...(h.lease.roommateId ? [h.lease.roommateId] : [])], text);
  return done(text);
}

/** Give notice: the lease ends at its end date, and the deposit comes back then. */
export function giveNotice(state = S()) {
  const l = lease(state);
  if (!l) return fail('You do not have a lease.');
  if (l.notice) return fail('You have already given notice.');
  l.notice = true;
  const text = `You give your landlord notice. You leave when the lease ends, in ${Math.max(1, l.end - nowMonth(state))} months.`;
  log(text, 'home', 'neutral');
  return done(text);
}
export function withdrawNotice(state = S()) {
  const l = lease(state);
  if (!l?.notice) return fail('You have not given notice.');
  l.notice = false;
  return done('You tell the landlord you are staying after all. They are glad to hear it.');
}

/** Ends the lease now: early, with a month's rent as a fee, unless it has run its course. Returns the deposit. */
function endLease(state, why, { fee = true, quiet = false } = {}) {
  const p = state.player;
  const h = H(state);
  const l = h.lease;
  if (!l || l.status !== 'active') return 0;
  const c = C(state);
  const early = fee && nowMonth(state) < l.end;
  const charge = early ? l.monthlyRent : 0;
  const back = Math.max(0, l.deposit - charge - h.arrears);
  h.arrears = Math.max(0, h.arrears - l.deposit);
  p.finance.cash += back;
  l.status = 'ended';
  l.ended = nowMonth(state);
  l.why = why;
  if (l.roommateId && roommate(state)?.id === l.roommateId) endRoommate(state);
  if (!quiet) log(`You hand back the keys${early ? ` early: a month's rent, ${fmtMoney(charge, c)}, comes out of the deposit` : ''}.${back ? ` ${fmtMoney(back, c)} of the deposit comes back.` : ''}`, 'home', 'neutral');
  recordEvent(state, 'lease_ended', [p.id], `The lease ended: ${why}.`);
  return back;
}

/** Whether the parents would have the player back, and who. */
export function homeToGoBackTo(state = S()) {
  const p = state.player;
  const ps = p.npcIds.map((id) => state.npcs[id]).filter((n) => n?.alive && n.role === 'parent' && !n.flags.abroad);
  return ps.sort((a, b) => b.meters.relationship - a.meters.relationship)[0] ?? null;
}
export function whyNotMoveBack(state = S()) {
  const p = state.player;
  if (p.flags.livesWithParents) return 'You live with your family.';
  if (p.age < 18) return '';
  if (p.legal?.incarceration) return 'Not from where you are.';
  if (!homeToGoBackTo(state)) return 'There is no family home to go back to.';
  if (p.npcIds.some((id) => state.npcs[id]?.alive && state.npcs[id].role === 'spouse')) return 'You live with your spouse.';
  return '';
}
/** Asks to move back in with family. They may say yes gladly, with conditions, or no. */
export function moveBackHome(state = S()) {
  const p = state.player;
  const why = whyNotMoveBack(state);
  if (why) return fail(why);
  const parent = homeToGoBackTo(state);
  const d = dice(state, 'home', 'back', lived(state));
  if (!d.chance(clamp(0.35 + parent.meters.relationship / 120, 0.1, 0.97))) {
    parent.meters.relationship = clamp(parent.meters.relationship - 3);
    const text = `${parent.firstName} says it is not a good time, and does not quite meet your eye.`;
    log(text, 'home', 'bad');
    return fail(text, 'bad');
  }
  endLease(state, 'moved back home');
  if (p.homeId) p.homeId = null;
  p.flags.livesWithParents = true;
  if (p.education?.enrolled) p.education.housing = 'home';
  H(state).movedBack = nowMonth(state);
  p.stats.mood = clamp(p.stats.mood - 2);
  const text = `You move back into your old room. ${parent.firstName} has kept the posters up. ${d.pick(['There will be rules, apparently.', 'It is good to be fed.', 'It is only for a while.'])}`;
  log(text, 'home', 'neutral');
  recordEvent(state, 'moved_back', [p.id, parent.id], text);
  return done(text, 'neutral');
}

// ---------- Looking after yourself ----------

export const SKILLS = [
  { id: 'cooking', name: 'Cook for the week', done: 'You batch-cook a pot of something on Sunday and eat well all week.', mood: 2, health: 1 },
  { id: 'cleaning', name: 'Deep clean the place', done: 'You clean behind things you did not know existed. It looks like a home.', mood: 3, health: 0 },
  { id: 'budgeting', name: 'Sit down and do a budget', done: 'You go through a month of statements line by line. You know where it all goes now.', mood: 1, health: 0 },
];
export const SKILL_NAMES = { cooking: 'Cooking', cleaning: 'Keeping house', budgeting: 'Budgeting' };
/** Practice a life skill. Each once a season. */
export function practiceSkill(id, state = S()) {
  const p = state.player;
  const s = SKILLS.find((x) => x.id === id);
  if (!s) return fail('Nothing to practice.');
  if (p.age < 16) return fail('From 16.');
  const h = H(state);
  h.acted ??= {};
  if (h.acted[id] === turnKey(state)) return fail('You have done that this season.');
  h.acted[id] = turnKey(state);
  const gain = Math.max(2, Math.round(12 * (1 - h.skills[id] / 110)));
  h.skills[id] = clamp(h.skills[id] + gain);
  p.stats.mood = clamp(p.stats.mood + s.mood);
  p.stats.health = clamp(p.stats.health + s.health);
  if (id === 'cleaning') { const r = roommate(state); if (r) r.meters.relationship = clamp(r.meters.relationship + 3); }
  log(s.done, 'home', 'good');
  return done(`${s.done} (${SKILL_NAMES[id]}: ${h.skills[id]}%.)`);
}

/** A month's money, for the Home screen: what comes in and what goes on the place. */
export function monthlyBudget(state = S()) {
  const p = state.player;
  const l = lease(state);
  const income = Math.round((p.career?.salary ?? 0) / 12);
  const groceries = Math.round(monthlyFull(state) * 0.25 * (1 - (H(state).skills.cooking / 400)));
  const housing = l ? l.monthlyRent + l.monthlyBills : 0;
  return { income, rent: l?.monthlyRent ?? 0, bills: l?.monthlyBills ?? 0, groceries, left: income - housing - groceries, arrears: H(state).arrears };
}

// ---------- Finance (engine/finance.js asks these) ----------

/**
 * The lease months billed for a year, taken once (the yearly living costs ask for the year just ended). null when
 * there was no lease that year; otherwise { amount, months }.
 */
export function leaseBill(year, state = S()) {
  const h = LF(state).home;
  const b = h?.billed?.[year];
  if (!b) return null;
  delete h.billed[year];
  return b;
}
/** What was actually paid of a lease bill: anything short is arrears, and the landlord writes. */
export function rentPaid(paid, owed, state = S()) {
  const h = H(state);
  if (paid >= owed) { if (h.arrears && paid > owed) h.arrears = Math.max(0, h.arrears - (paid - owed)); return; }
  h.arrears += owed - paid;
  if (lease(state)) storyBeat('fl_rent_arrears', {}, { source: 'family', must: true });
}

// ---------- Each month ----------

onMonth('independence', (state, m) => {
  const p = state.player;
  const h = H(state);
  const l = h.lease;
  if (!l || l.status !== 'active') return;
  // Someone else's move ends it: back home after a course, prison, a home bought and moved into.
  if (p.flags.livesWithParents || p.legal?.incarceration || p.homeId || !p.alive) {
    endLease(state, p.homeId ? 'moved into a home of your own' : 'moved out', { fee: false, quiet: !p.alive });
    return;
  }
  if (m < l.start) return;
  const y = yearOfMonth(m);
  const bill = (h.billed[y] ??= { amount: 0, months: 0 });
  bill.amount += l.monthlyRent + l.monthlyBills;
  bill.months += 1;
  if (m + 1 >= l.end) {
    if (l.notice) { endLease(state, 'the lease ran out', { fee: false }); log('Your lease is up. Where you live next is up to you.', 'home', 'neutral'); return; }
    l.end += LEASE_MONTHS;
    const rise = Math.round(l.monthlyRent * 0.03);
    l.monthlyRent += rise;
    log(`Your lease renews for another year. The rent goes up by ${fmtMoney(rise, COUNTRIES[p.countryId])} a month.`, 'home', 'neutral');
  }
  // Behind by more than two months' rent: a warning, then, if it is not cleared within the year, eviction.
  if (h.arrears > l.monthlyRent * 2) {
    if (!h.warned) { h.warned = m; storyBeat('fl_eviction_notice', {}, { source: 'family', must: true }); }
    else if (m - h.warned >= 6) {
      const parent = homeToGoBackTo(state);
      endLease(state, 'eviction', { fee: false });
      h.warned = null;
      if (parent) { p.flags.livesWithParents = true; parent.meters.relationship = clamp(parent.meters.relationship - 4); }
      else p.flags.sharedHousing = true;
      const text = `The bailiffs come for the keys. You are evicted${parent ? `, and go back to ${parent.firstName}'s` : ', and sleep on a friend\'s sofa for a while'}.`;
      log(text, 'home', 'bad');
      milestone('Evicted.', 'life');
      recordEvent(state, 'evicted', [p.id], text);
    }
  } else if (h.warned && h.arrears <= l.monthlyRent) h.warned = null;
});

/** Choices in the home scenes. */
export function homeChoice(story, choice, state = S()) {
  const p = state.player;
  const h = H(state);
  const c = C(state);
  if (story === 'rent_arrears' || story === 'eviction_notice') {
    if (choice === 'pay') {
      const pay = Math.min(p.finance.cash, h.arrears);
      p.finance.cash -= pay;
      h.arrears -= pay;
      if (h.arrears <= 0) h.warned = null;
      return pay ? `You pay ${fmtMoney(pay, c)} of what you owe.${h.arrears > 0 ? ` ${fmtMoney(h.arrears, c)} is still outstanding.` : ' You are square with the landlord.'}` : 'You have nothing to pay it with.';
    }
    if (choice === 'home') { const r = moveBackHome(state); return r.text; }
    return 'You put the letter in a drawer.';
  }
  return '';
}
