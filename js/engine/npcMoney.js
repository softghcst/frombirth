// The finances of the people closest to the player: a spouse or partner, their
// children once grown, their brothers and sisters.
//
// They follow the same rules as the player. A home is bought with a deposit
// they have saved and a mortgage their income will support; a mortgage is paid
// from their own money; a year with no income eats into savings and then
// becomes debt; debt costs interest and is paid down when they can. How they
// go about it depends on who they are, without deciding it.
//
// Everyone further away keeps the single savings figure they always had
// (engine/npcLives.js). That is deliberate: detail where it matters, a
// summary everywhere else.
//   npc.life.fin = { style, home: { name, value, paid, mortgage, payment, yearsLeft, bought } | null, debt, debtRate, history: [] }
import { store, player, country } from '../state.js';
import { localCost, fmtMoney } from '../util.js';
import { rng } from '../rng.js';
import { MORTGAGE } from '../data/properties.js';
import { yearlyPayment } from './loans.js';

export const CLOSE = ['spouse', 'partner', 'child', 'sibling'];
/** People who share the player's household do not buy homes of their own while they do. */
const SHARES_HOME = ['spouse', 'partner'];
const HOUSE = 200000; // a modest home, in base units at local prices
/** The share of take-home pay that would go on rent, which a homeowner keeps. */
const RENT_SHARE = 0.25;
const STYLES = {
  cautious: { name: 'Careful with money', buffer: 0.6, payDown: 0.6, buyAt: 1.3 },
  balanced: { name: 'Sensible with money', buffer: 0.35, payDown: 0.35, buyAt: 1 },
  bold: { name: 'Easy-going about money', buffer: 0.15, payDown: 0.15, buyAt: 0.8 },
};
export const styleName = (id) => STYLES[id]?.name ?? '';

const income = (npc) => Math.round((npc.life.job?.salary ?? npc.life.pension ?? 0) * (1 - country().incomeTax));
const note = (fin, age, text) => { fin.history.push({ age, year: store.state.year, text }); if (fin.history.length > 8) fin.history.shift(); };

/** Someone's own way with money: from their temperament, not their bank balance. */
function styleOf(npc) {
  const m = npc.meters ?? {};
  const t = npc.traits ?? [];
  const lean = (m.crazy ?? 30) - 30 + (t.includes('restless') ? 20 : 0) - (t.includes('steady') || t.includes('worrier') ? 20 : 0) + rng.int(-20, 20);
  return lean > 15 ? 'bold' : lean < -10 ? 'cautious' : 'balanced';
}

export function finOf(npc) {
  if (!npc?.life || !CLOSE.includes(npc.role)) return null;
  return (npc.life.fin ??= { style: styleOf(npc), home: null, debt: 0, debtRate: 0.09, history: [] });
}

/** What someone close has, less what they owe, in local money. */
export function npcWorth(npc) {
  const f = npc?.life?.fin;
  const savings = npc?.life?.savings ?? npc?.savings ?? 0;
  if (!f) return Math.round(savings);
  return Math.round(savings + (f.home ? f.home.value - f.home.mortgage : 0) - f.debt);
}

/** One year of someone close's money, after their earnings have been added to their savings. */
export function tickNpcMoney(npc, quiet = false) {
  const f = finOf(npc);
  if (!f || npc.age < 18) return null;
  const L = npc.life;
  L.savings = Math.round(L.savings);
  const c = country();
  const earns = income(npc);
  const s = STYLES[f.style];

  // Their home: it moves with the housing market, and the mortgage is paid from their own money.
  if (f.home) {
    const h = f.home;
    h.value = Math.max(1, Math.round(h.value * (1 + (store.state.market?.housingMove ?? 0.03))));
    if (h.mortgage > 0) {
      const interest = Math.round(h.mortgage * MORTGAGE.rate);
      const pay = Math.min(h.payment, h.mortgage + interest);
      // Their yearly savings already allow for paying rent; owning, they pay the mortgage instead.
      L.savings -= Math.max(0, pay - earns * RENT_SHARE);
      h.mortgage = Math.max(0, h.mortgage + interest - pay);
      h.yearsLeft = Math.max(0, h.yearsLeft - 1);
      if (!h.mortgage) note(f, npc.age, 'Paid off the mortgage on their home.');
    }
  }
  // Debt costs interest; it is paid down when there is money to spare.
  if (f.debt > 0) {
    f.debt = Math.round(f.debt * (1 + f.debtRate));
    const spare = Math.max(0, L.savings - earns * s.buffer);
    const pay = Math.min(f.debt, Math.round(spare * s.payDown + earns * 0.05));
    if (pay > 0) { L.savings -= pay; f.debt -= pay; if (!f.debt) note(f, npc.age, 'Cleared their debts.'); }
  }
  // Sinking: with debts far beyond what they earn, the home is sold to clear them.
  if (f.home && L.savings < 0 && f.debt + -L.savings > Math.max(earns, localCost(8000, c)) * 2) {
    const raised = Math.round(f.home.value * 0.94) - f.home.mortgage;
    L.savings += raised;
    note(f, npc.age, `Sold ${f.home.name} to clear what they owed.`);
    f.home = null;
    const clear = Math.min(f.debt, Math.max(0, L.savings));
    f.debt -= clear; L.savings -= clear;
  }
  // Running out: savings go first, then they borrow to get by. Nobody's money is bottomless.
  if (L.savings < 0) {
    f.debt += -L.savings;
    L.savings = 0;
    if (!quiet && f.debt > localCost(5000, c) && !f.struggling) { f.struggling = true; note(f, npc.age, 'Fell behind and borrowed to get by.'); }
  } else if (f.debt <= 0) f.struggling = false;
  // A home of their own, when they have saved a deposit and earn enough for a lender to agree.
  if (!f.home && !SHARES_HOME.includes(npc.role) && npc.age >= 24 && npc.age <= 60 && earns > 0 && f.debt === 0) {
    const price = Math.round(localCost(HOUSE, c) * (store.state.market?.housing ?? 1) * (0.6 + rng.next() * 0.8));
    const deposit = Math.round(price * MORTGAGE.deposit * s.buyAt * 1.5);
    const loan = price - deposit;
    const lenderSaysYes = loan <= (L.job?.salary ?? 0) * MORTGAGE.incomeMultiple && npc.age + MORTGAGE.years <= MORTGAGE.maxEndAge + 5;
    if (lenderSaysYes && L.savings >= deposit + earns * s.buffer && rng.chance(0.5)) {
      L.savings -= deposit;
      f.home = { name: rng.pick(['a flat', 'a terraced house', 'a small house', 'a semi-detached house', 'a cottage']), value: price, paid: price, mortgage: loan,
        payment: yearlyPayment(loan, MORTGAGE.rate, MORTGAGE.years), yearsLeft: MORTGAGE.years, bought: store.state.year };
      note(f, npc.age, `Bought ${f.home.name} for ${fmtMoney(price, c)}, with a mortgage.`);
      return 'bought';
    }
  }
  return null;
}

/** Lines for someone's profile. */
export function finRows(npc) {
  const f = npc?.life?.fin;
  if (!f || npc.age < 18) return [];
  const c = country();
  const rows = [['With money', styleName(f.style)]];
  if (f.home) rows.push(['Home', `Owns ${f.home.name}, worth ${fmtMoney(f.home.value, c)}${f.home.mortgage ? `, ${fmtMoney(f.home.mortgage, c)} still on the mortgage` : ', paid for'}`]);
  if (f.debt > 0) rows.push(['Owes', fmtMoney(f.debt, c)]);
  rows.push(['Worth, all told', fmtMoney(npcWorth(npc), c)]);
  return rows;
}

