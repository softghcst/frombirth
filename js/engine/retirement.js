// Saving for retirement: a plan of the player's own, paid into from their wages
// (an employer's pension is engine/worklife.js's pensionPot), invested in the game's own market and locked
// until later life.
//
// The plan is a ledger account like any other (engine/banking.js), so it is
// counted once, cannot be spent early without a penalty, and passes on death
// like the rest. The rules are invented (data/money.js); the state pension
// earned by years of work is separate (engine/career.js).
//   p.finance.plan = { accountId, rate }
import { store, player, country, log, milestone } from '../state.js';
import { fmtMoney } from '../util.js';
import { PENSION_PLAN, STATE_PENSION, STATE_PENSION_OF } from '../data/money.js';
import { typicalWage } from './systems.js';
import { ledgerOf, toMinor, fromMinor, Money } from './ledger.js';
import { move, banksHere, accountById, fmtExact } from './banking.js';
import { market } from './market.js';
import { pensionEstimate } from './career.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const home = () => country().currency.code;
/** The player's plan, if it is still open and in the money of the country they live in. */
export function plan() {
  const pl = player().finance.plan;
  const a = pl ? accountById(pl.accountId) : null;
  return a && a.closed == null ? { ...pl, account: a, current: a.cur === home() } : null;
}
/** How much of the pot is in shares: most of it when young, less as retirement nears. */
export const equityShare = (age) => Math.max(0.3, Math.min(0.8, 0.8 - (age - 45) * 0.025));

export function canOpenPlan() {
  const p = player();
  if (store.state.year < PENSION_PLAN.since) return { ok: false, reason: 'Plans like this do not exist yet.' };
  if (p.age < 18) return { ok: false, reason: 'You need to be 18.' };
  if (plan()?.current) return { ok: false, reason: 'You already have one.' };
  if (!banksHere().length) return { ok: false, reason: 'Nobody here offers one.' };
  return { ok: true, reason: '' };
}

export function openPlan(rate = 0.06) {
  const p = player();
  const can = canOpenPlan();
  if (!can.ok) return result(false, can.reason, 'neutral');
  if (!PENSION_PLAN.rates.includes(rate)) return result(false, 'Choose how much to pay in.', 'neutral');
  const L = ledgerOf();
  const id = `bank:${L.nb = (L.nb ?? 0) + 1}`;
  const bank = banksHere()[0];
  L.accounts[id] = { id, kind: 'bank', cur: home(), bal: 0, bankId: bank.id, product: 'pension', name: 'Pension plan', opened: store.state.year, openedAge: p.age,
    rateBp: 0, feeMinor: 0, unlockAge: PENSION_PLAN.unlockAge, owners: [{ id: p.id, role: 'owner' }] };
  p.finance.plan = { accountId: id, rate };
  const text = `You started a pension plan of your own, on top of any pension from work. ${Math.round(rate * 100)}% of your pay goes into it each year, and it is locked until you are ${PENSION_PLAN.unlockAge}.`;
  log(text, 'system', 'good');
  milestone('Started saving for retirement.', 'money');
  return result(true, text);
}

export function setPlanRate(rate) {
  if (!plan()) return result(false, 'You have no pension plan.', 'neutral');
  if (!PENSION_PLAN.rates.includes(rate)) return result(false, 'Choose how much to pay in.', 'neutral');
  player().finance.plan.rate = rate;
  return result(true, rate ? `${Math.round(rate * 100)}% of your pay will go into your pension plan each year.` : 'You have stopped paying into your pension plan. What is in it stays invested.', 'neutral');
}


/** Yearly, when the year's pay has arrived: the player's share leaves their money for the plan. */
export function contribute() {
  const p = player();
  const pl = plan();
  if (!pl || !pl.current || !pl.rate || p.career.retired) return 0;
  const salary = p.career.salary || 0;
  const mine = Math.min(Math.round(salary * pl.rate), Math.max(0, Math.floor(p.finance.cash)));
  if (mine <= 0) return 0;
  const cur = home();
  move('Paid into your pension plan', [[pl.accountId, toMinor(mine, cur)]], { walletCur: cur, walletMinor: -toMinor(mine, cur), key: `plan:${store.state.year}` });
  return mine;
}

/** Yearly: the pot follows the market, for better or worse. */
export function tickPlan() {
  const p = player();
  for (const a of Object.values(store.state.ledger?.accounts ?? {})) {
    if (a.kind !== 'bank' || a.product !== 'pension' || a.closed != null || !a.bal) continue;
    const h = market().history.index;
    const shares = h.length > 1 ? h[h.length - 1] / h[h.length - 2] - 1 : 0;
    const eq = equityShare(p.age);
    const r = Math.max(-0.5, Math.min(0.6, eq * shares + (1 - eq) * PENSION_PLAN.bondReturn));
    const g = Money.bp(Math.abs(a.bal), Math.round(Math.abs(r) * 10000)) * Math.sign(r);
    if (!g) continue;
    move(`Pension plan: the year's ${g > 0 ? 'growth' : 'fall'} (${(r * 100).toFixed(1)}%)`, [[a.id, g]], { cat: 'growth', key: `growth:${a.id}:${store.state.year}`, nominal: [['growth', a.cur, -g]] });
    if (Math.abs(r) > 0.15) log(`Your pension plan ${g > 0 ? 'rose' : 'fell'} ${Math.abs(Math.round(r * 100))}% this year, to ${fmtExact(a.bal, a.cur)}.`, 'system', g > 0 ? 'good' : 'bad');
  }
}

/**
 * A projection, not a promise: what the pot might be at the age it unlocks,
 * if pay and contributions stay as they are and it grows at a steady rate.
 * @returns {{at:number, low:number, mid:number, high:number, pension:number}|null} amounts in local money
 */
export function projection() {
  const p = player();
  const pl = plan();
  if (!pl) return null;
  const years = Math.max(0, PENSION_PLAN.unlockAge - p.age);
  const salary = p.career.retired ? 0 : p.career.salary || 0;
  const yearly = pl.current ? Math.round(salary * pl.rate) : 0;
  const grow = (r) => { let pot = fromMinor(pl.account.bal, pl.account.cur); for (let i = 0; i < years; i++) pot = pot * (1 + r) + yearly; return Math.round(pot); };
  return { at: PENSION_PLAN.unlockAge, years, yearly, low: grow(0.01), mid: grow(0.04), high: grow(0.07), pension: p.career.retired ? p.career.pensionPerYear : pensionEstimate() };
}
export const fmtPlan = (n) => fmtMoney(n, country());

// ---------- The state pension ----------

/** Whether the country where the player lives pays a state pension, and how generous it is. */
export const stateScheme = (countryId = player().countryId) => STATE_PENSION_OF[countryId] ?? STATE_PENSION.fallback;
/**
 * What the state would pay a year, from the age it starts: a share of an
 * ordinary wage here, in full after enough years of work and less for fewer,
 * with a floor for those who hardly worked.
 */
export function statePensionFor(p = player()) {
  const years = p.career.totalYears ?? 0;
  const share = Math.max(STATE_PENSION.floor, Math.min(1, years / STATE_PENSION.full));
  return Math.round(typicalWage(country()) * stateScheme(p.countryId) * share);
}
/** Yearly: at the age it starts, the state pension is paid from then on. Worked out again after a move abroad. */
export function tickStatePension() {
  const p = player();
  if (p.age < STATE_PENSION.age || p.flags.statePension) return;
  p.flags.statePension = statePensionFor(p);
  const text = `You have reached ${STATE_PENSION.age}. The state will pay you a pension of ${fmtMoney(p.flags.statePension, country())} a year, from ${(p.career.totalYears ?? 0) >= STATE_PENSION.full ? 'a full working life' : `${p.career.totalYears ?? 0} years of work`}.`;
  log(text, 'system', 'good');
  milestone('Began drawing a state pension.', 'money');
}
