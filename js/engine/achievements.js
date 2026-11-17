// Money milestones worth marking, and what a person understands about money.
//
// Every achievement is worked out from what actually happened in this life:
// the ledger, the accounts, the debts, the milestones. None can be claimed,
// and none is a score: a life with none of them is not a lesser life.
//
// "Money sense" (0 to 100) is what the player has picked up about money from
// living with it. It helps them spot a bad offer or win an argument with a
// bank. It is not intelligence, and it does not make anyone rich.
import { store, player, country, log } from '../state.js';
import { localCost, fmtMoney } from '../util.js';
import { LESSONS } from '../data/money.js';
import { book } from './ledger.js';
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
  if (p.education.enrolled && p.age === 15 && !p.flags.moneyClass) { p.flags.moneyClass = true; learn(4, 'class'); log('At school this year there was a term of lessons on money: budgets, interest, and what a payslip says.', 'system', 'neutral'); }
  if (p.career.careerId || p.career.partTime) learn(1.5, 'work');
  if (Object.keys(f.budget?.limits ?? {}).length) learn(2, 'budget');
  if (goalList().some((g) => g.status === 'active')) learn(1.5, 'goal');
  if ((f.cards ?? []).some((k) => k.status === 'open' && k.statements.at(-1)?.closing === 0 && k.statements.at(-1)?.spent > 0)) learn(1, 'card');
  if ((f.credit?.marks ?? []).some((m) => m.year === store.state.year)) learn(3, 'trouble'); // hard lessons are still lessons
  if (plan()) learn(1, 'plan');
  achievements(); // note the year anything first became true
}

/** Ways to learn about money on purpose, with what they cost and whether the player can take them now. */
export function lessonOptions() {
  const p = player();
  const done = p.flags.moneyLessonsTaken ?? {};
  return LESSONS.map((l) => {
    const cost = localCost(l.cost, country());
    let reason = '';
    if (p.age < l.minAge) reason = `You need to be ${l.minAge}.`;
    else if (done[l.id] === p.age) reason = 'Once a year is enough.';
    else if (p.finance.cash < cost) reason = `It costs ${fmtMoney(cost, country())}.`;
    return { ...l, cost, ok: !reason, reason };
  });
}
export function takeLesson(id) {
  const p = player();
  const l = lessonOptions().find((x) => x.id === id);
  if (!l) return { ok: false, text: 'There is no such thing.', tone: 'neutral' };
  if (!l.ok) return { ok: false, text: l.reason, tone: 'neutral' };
  p.finance.cash -= l.cost;
  (p.flags.moneyLessonsTaken ??= {})[id] = p.age;
  const before = moneySense();
  learn(l.gain, `lesson:${id}`);
  const text = `${{ book: 'You read it cover to cover, with a pencil.', course: 'Ten Tuesday evenings, a folder of handouts, and a better idea of what you are doing.', adviser: 'An hour of plain questions and plain answers about your own money.' }[id]} (${senseWord()}, ${moneySense()} of 100${moneySense() > before ? '' : ': you knew most of it already'}.)`;
  log(text, 'system', 'good');
  book({ cat: 'learning', src: 'action', desc: l.name });
  return { ok: true, text, tone: 'good' };
}

/** At birth: a child picks up a little of how their parents handle money. It is a start, not a fate. */
export function startingSense(parents) {
  const m = parents.filter(Boolean).map((n) => n.meters?.money ?? 30);
  return m.length ? Math.round(m.reduce((s, x) => s + x, 0) / m.length / 12) : 0;
}
