// A child performer's pay. A child cannot sign a contract or hold their own earnings: a parent signs for them and
// manages the money until they are 18. What happens to it depends on the parent.
//
// In the United States the states where most child actors work (California, New York and a few others) require a
// share of a minor's pay, 15%, to be paid into a blocked trust account in the child's name (a "Coogan account", after
// Jackie Coogan, whose parents spent his earnings). Nobody can draw on it until the child is 18. Elsewhere there is no
// such rule here, and what is kept is up to the parent.
//
// The parent who manages the money has a way with it, fixed when the first pay comes in:
//   saver      keeps nearly all of it for you
//   coach      keeps most of it and spends some on coaching and classes: your acting comes on faster
//   household  spends a good part on the family's own costs
//   spender    spends most of it
// A little comes to the child as pocket money. At 18 the trust and what the parent kept are handed over; what was
// spent is gone, and the player may have it out with the parent (data/events/early.js, child_money_*).
//
//   p.childPay = { managerId, style, trust, kept, spent, coached, total, released }
import { store, player, country, log, milestone, livingNpcs } from '../state.js';
import { rng } from '../rng.js';
import { clamp, fmtMoney } from '../util.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { book } from './ledger.js';

export const TRUST_SHARE = { us: 0.15 }; // by country: the share the law sets aside
export const POCKET = 0.05; // what comes to the child to spend
export const STYLES = {
  saver: { keep: 0.92, label: 'keeps it for you, nearly all of it' },
  coach: { keep: 0.75, label: 'keeps most of it, and pays for coaching and classes with some' },
  household: { keep: 0.45, label: 'puts a good part of it toward the family\'s costs' },
  spender: { keep: 0.12, label: 'spends most of it' },
};

/** The parent who signs for a working child and manages the pay: the one at home, the closer one first. */
export function managerOf(p = player()) {
  const ps = livingNpcs().filter((n) => n.role === 'parent' && !n.flags.abroad);
  return ps.sort((a, b) => (b.meters?.relationship ?? 50) - (a.meters?.relationship ?? 50))[0] ?? null;
}

/** How a parent goes about a child's money: their nature leans it one way or another, without deciding it. */
function styleOf(n) {
  const t = new Set(n?.traits ?? []);
  const w = { saver: 40, coach: 22, household: 26, spender: 12 };
  if (t.has('gentle') || t.has('steady') || t.has('worrier')) { w.saver += 20; w.spender -= 6; }
  if (t.has('dramatic')) w.coach += 25;
  if (t.has('sly') || t.has('restless')) { w.spender += 22; w.saver -= 15; }
  const roll = rng.next() * Object.values(w).reduce((s, x) => s + Math.max(0, x), 0);
  let acc = 0;
  for (const [k, x] of Object.entries(w)) { acc += Math.max(0, x); if (roll < acc) return k; }
  return 'saver';
}

const isChildWork = (career) => !!career?.agesOut;

/**
 * Takes a working child's pay out of their own hands after tax: the trust's share, the parent's part. Called from
 * finance with the year's take-home pay. @returns {number} what was taken from the child's cash
 */
export function holdChildPay(net, lines, p = player()) {
  if (p.age >= 18 || net <= 0) return 0;
  const career = CAREER_BY_ID[p.career?.careerId];
  if (!isChildWork(career)) return 0;
  const gross = lines.reduce((s, l) => s + l.gross, 0) || 1;
  const main = lines.filter((l) => l.source === 'main').reduce((s, l) => s + l.gross, 0);
  const earned = Math.round(net * main / gross);
  if (earned <= 0) return 0;
  const parent = managerOf(p);
  const cp = (p.childPay ??= { managerId: null, style: null, trust: 0, kept: 0, spent: 0, coached: 0, total: 0, released: false });
  cp.total += earned;
  const trust = Math.round(earned * (TRUST_SHARE[p.countryId] ?? 0));
  cp.trust += trust;
  const pocket = Math.round(earned * POCKET);
  if (!parent) {
    // No parent at home: a guardian or the court holds it all in trust.
    cp.trust += earned - trust - pocket;
    return earned - pocket;
  }
  if (cp.managerId !== parent.id) {
    cp.managerId = parent.id;
    cp.style = styleOf(parent);
    const who = parent.gender === 'female' ? 'Your mother' : parent.gender === 'male' ? 'Your father' : 'Your parent';
    log(`${who} signs your contracts and manages what you earn until you are 18.${trust ? ' By law, 15% goes into a trust account in your name that nobody can touch until then.' : ''} You get a little pocket money from it.`, 'system', 'neutral');
  }
  const rest = earned - trust - pocket;
  const kept = Math.round(rest * STYLES[cp.style].keep);
  cp.kept += kept;
  cp.spent += rest - kept;
  // What a parent spends goes on the household and their own life; some of it ends up in their savings.
  if (parent.life) parent.life.savings = (parent.life.savings ?? 0) + Math.round((rest - kept) * 0.4);
  else parent.savings = (parent.savings ?? 0) + Math.round((rest - kept) * 0.4);
  if (cp.style === 'coach') cp.coached += 1;
  return earned - pocket;
}

/** Coaching paid from a child's pay brings their acting on, a little each year. */
export function coachingYear(p = player()) {
  const cp = p.childPay;
  if (!cp || cp.released || cp.style !== 'coach' || p.age >= 18 || !isChildWork(CAREER_BY_ID[p.career?.careerId])) return '';
  p.talents.acting = clamp((p.talents.acting ?? 0) + 2);
  return 'Some of what you earn goes on an acting coach and classes. It shows.';
}

/** At 18: the trust and what the parent kept are handed over. */
export function releaseChildPay(p = player()) {
  const cp = p.childPay;
  if (!cp || cp.released || p.age < 18) return null;
  cp.released = true;
  const cty = country();
  const handed = cp.trust + cp.kept;
  p.finance.cash += handed;
  if (handed) book({ cat: 'giftIn', src: 'childPay', desc: 'Money earned as a child, handed over at 18' });
  const parent = store.state.npcs[cp.managerId];
  const who = parent ? (parent.gender === 'female' ? 'your mother' : parent.gender === 'male' ? 'your father' : 'your parent') : 'the court';
  const parts = [cp.trust ? `${fmtMoney(cp.trust, cty)} from the trust account nobody could touch` : '', cp.kept ? `${fmtMoney(cp.kept, cty)} that ${who} kept for you` : ''].filter(Boolean);
  log(`You are 18, and the money you earned as a child is yours: ${parts.join(' and ') || 'nothing at all'}.${cp.spent ? ` Of the ${fmtMoney(cp.total, cty)} you earned, ${fmtMoney(cp.spent, cty)} was spent while ${who} managed it.` : ''}`,
    'system', cp.spent > cp.total * 0.5 ? 'bad' : 'good');
  milestone(`Was handed ${fmtMoney(handed, cty)} earned as a child performer.`, 'money');
  // Most of it gone: there is a conversation to be had (data/events/early.js).
  if (parent?.alive && cp.spent > cp.total * 0.5) p.flags.childMoneyGone = parent.gender === 'male' ? 'father' : 'mother';
  return handed;
}

/** What the player does about money a parent spent (scene child_money_*). */
export function childMoneyChoice(how, p = player()) {
  const cp = p.childPay;
  const parent = cp && store.state.npcs[cp.managerId];
  if (!cp || !parent) return '';
  const cty = country();
  p.flags.childMoneyGone = false;
  if (how === 'forgive') return '';
  const have = Math.max(0, parent.life?.savings ?? parent.savings ?? 0);
  if (how === 'ask') {
    const back = Math.round(Math.min(have, cp.spent) * (rng.chance(0.5) ? 0.3 : 0));
    if (back) { if (parent.life) parent.life.savings -= back; else parent.savings -= back; p.finance.cash += back; book({ cat: 'giftIn', src: 'childPay', desc: 'Money a parent gave back' }); }
    return back ? `They give back ${fmtMoney(back, cty)}. It is what they have.` : 'There is nothing to give back. It went on the house, the car, the bills.';
  }
  // sue: the court can order a parent to repay what was not spent for the child's benefit.
  const back = Math.round(Math.min(have, cp.spent * 0.6));
  if (parent.life) parent.life.savings -= back; else parent.savings -= back;
  p.finance.cash += back;
  if (back) book({ cat: 'giftIn', src: 'childPay', desc: 'Repaid by a parent, by order of the court' });
  p.flags.suedParent = true;
  return back ? `The court orders ${fmtMoney(back, cty)} repaid. You win, and you do not speak for a long time.` : 'The court finds for you, but there is nothing left to repay.';
}
