// Money milestones worth marking, and what a person understands about money.
//
// Every achievement is worked out from what actually happened in this life:
// the ledger, the accounts, the debts, the milestones. None can be claimed,
// and none is a score: a life with none of them is not a lesser life.
//
// "Money sense" (0 to 100) is what the player has picked up about money from
// living with it. It helps them spot a bad offer or win an argument with a
// bank. It is not intelligence, and it does not make anyone rich.
import { store, player } from '../state.js';
import { clamp } from '../util.js';
import { bankWorth, goalList, overview } from './banking.js';
import { plan } from './retirement.js';
import { pensionEstimate } from './career.js';

const has = (p, text) => p.milestones.some((m) => m.text.startsWith(text));

export const ACHIEVEMENTS = [
  { id: 'first_pay', name: 'First paycheck', blurb: 'Earn money of your own for the first time.',
    earned: (p) => !!p.flags.firstPay && (p.finance.lifetimeEarned > 0) },
  { id: 'first_goal', name: 'First savings goal', blurb: 'Save what you set out to save.',
    earned: () => goalList().some((g) => g.status === 'completed') },
  { id: 'first_home', name: 'First home', blurb: 'Own the place you live in.',
    earned: (p) => p.assets.some((a) => a.kind === 'property') || has(p, 'Bought') || has(p, 'Paid off a mortgage') },
  { id: 'debt_free', name: 'Free of debt', blurb: 'Owe something, and then pay every bit of it back.',
    earned: (p) => has(p, 'Became free of debt') },
  { id: 'long_investor', name: 'Long-term investor', blurb: 'Hold an investment for ten years.',
    earned: (p) => p.assets.some((a) => a.kind === 'security' && p.age - a.boughtAtAge >= 10) },
  { id: 'builder', name: 'Business builder', blurb: 'Own a business that has traded for five years.',
    earned: (p) => p.assets.some((a) => a.kind === 'business' && !a.inherited && store.state.year - a.founded >= 5) },
  { id: 'retire_ready', name: 'Ready to retire', blurb: 'Have a pension and money of your own that would cover what you spend for twenty years.',
    earned: (p) => { const o = overview(); const pension = p.career.retired ? p.career.pensionPerYear : pensionEstimate(); const own = Math.max(0, o.cash) + bankWorth() + o.investments;
      return p.age >= 50 && o.spent > 0 && pension + own / 20 >= o.spent; } },
  { id: 'independent', name: 'Financially independent', blurb: 'Own enough, apart from your home, that a twenty-fifth of it covers a year of what you spend.',
    earned: (p) => { const o = overview(); return p.age >= 18 && o.spent > 0 && o.liabilities === 0 && (Math.max(0, o.cash) + o.bank + o.investments + o.business) / 25 >= o.spent; } },
  { id: 'generous', name: 'Generous heart', blurb: 'Give away a real share of what you had.',
    earned: (p) => (p.counters.donated ?? 0) >= 5000 || (p.flags.givenBase ?? 0) >= 5000 },
  { id: 'legacy', name: 'Family legacy', blurb: 'Receive something passed down through a will, a trust or an estate.',
    earned: (p) => has(p, 'Inherited from') || has(p, 'Came into the trust') },
];

/** The achievements this life has earned, and the ones it has not. */
export function achievements() {
  const p = player();
  const got = (p.flags.moneyAwards ??= {});
  return ACHIEVEMENTS.map((a) => {
    let ok = false;
    try { ok = !!a.earned(p); } catch { ok = false; }
    if (ok && got[a.id] == null) got[a.id] = p.age; // remembered from the year it first became true
    return { id: a.id, name: a.name, blurb: a.blurb, earned: got[a.id] != null, age: got[a.id] ?? null };
  });
}

// ---------- Money sense ----------

export const moneySense = (p = player()) => clamp(Math.round(p.flags.moneySense ?? 0));
export const senseWord = (v = moneySense()) => (v >= 75 ? 'Shrewd' : v >= 50 ? 'Capable' : v >= 25 ? 'Finding your feet' : 'New to it');
/** Something was learned. Experience teaches less each time it repeats. */
export function learn(amount, why) {
  const p = player();
  const seen = (p.flags.moneyLessons ??= {});
  const times = seen[why] = (seen[why] ?? 0) + 1;
  p.flags.moneySense = clamp((p.flags.moneySense ?? 0) + amount / Math.sqrt(times));
}

/** Yearly: what a year of living with money teaches. */
export function tickSense() {
  const p = player();
  const f = p.finance;
  if (p.age >= 8 && p.age < 18 && f.cash > 0) learn(1, 'pocket');
  if (p.education.enrolled && p.age >= 14) learn(1, 'school');
  if (p.career.careerId || p.career.partTime) learn(1.5, 'work');
  if (Object.keys(f.budget?.limits ?? {}).length) learn(2, 'budget');
  if (goalList().some((g) => g.status === 'active')) learn(1.5, 'goal');
  if ((f.cards ?? []).some((k) => k.status === 'open' && k.statements.at(-1)?.closing === 0 && k.statements.at(-1)?.spent > 0)) learn(1, 'card');
  if ((f.credit?.marks ?? []).some((m) => m.year === store.state.year)) learn(3, 'trouble'); // hard lessons are still lessons
  if (plan()) learn(1, 'plan');
  achievements(); // note the year anything first became true
}
