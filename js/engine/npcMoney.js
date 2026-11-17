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
//   npc.life.fin = { style, home: { name, value, paid, mortgage, payment, yearsLeft, bought } | null, debt, debtRate, invested,
//                    bank: { bankId, name, bal, rateBp, opened } | null,
//                    card: { bankId, limit, balance, rateBp, missed, opened } | null, defaulted: year | null, history: [] }
// life.savings is the money they have to hand; their bank account, investments and card are kept apart from it.
import { store, player, country } from '../state.js';
import { localCost, fmtMoney } from '../util.js';
import { rng } from '../rng.js';
import { MORTGAGE } from '../data/properties.js';
import { yearlyPayment } from './loans.js';
import { banksHere, rateAt } from './banking.js';
import { CARDS } from '../data/money.js';
import { creditModelOf } from './credit.js';

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
  const f = (npc.life.fin ??= { style: styleOf(npc), home: null, debt: 0, debtRate: 0.09, history: [] });
  f.invested ??= 0;
  f.bank ??= null; f.card ??= null; f.defaulted ??= null;
  return f;
}

/** What someone close has, less what they owe, in local money. */
export function npcWorth(npc) {
  const f = npc?.life?.fin;
  const savings = npc?.life?.savings ?? npc?.savings ?? 0;
  if (!f) return Math.round(savings);
  return Math.round(savings + (f.bank?.bal ?? 0) + (f.invested ?? 0) + (f.home ? f.home.value - f.home.mortgage : 0) - f.debt - (f.card?.balance ?? 0));
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
  // Investments follow the same market the player's do, up and down.
  if (f.invested > 0) {
    const h = store.state.market?.history?.index ?? [];
    const r = h.length > 1 ? h[h.length - 1] / h[h.length - 2] - 1 + 0.018 : 0.05;
    f.invested = Math.max(0, Math.round(f.invested * (1 + r)));
  }
  tickCard(npc, f, earns, s, quiet);
  if (f.bank) f.bank.bal = Math.round(f.bank.bal * (1 + f.bank.rateBp / 10000 * (1 - c.incomeTax * 0.5))); // interest, after the tax on it
  // In a hard year, the bank account is drawn on first, then investments are sold, before anything is borrowed.
  if (L.savings < 0 && f.bank?.bal > 0) { const take = Math.min(f.bank.bal, -L.savings); f.bank.bal -= take; L.savings += take; }
  if (L.savings < 0 && f.invested > 0) { const sold = Math.min(f.invested, -L.savings); f.invested -= sold; L.savings += sold; }
  // Running out: savings go first, then they borrow to get by. Nobody's money is bottomless.
  if (L.savings < 0) {
    f.debt += -L.savings;
    L.savings = 0;
    if (!quiet && f.debt > localCost(5000, c) && !f.struggling) { f.struggling = true; note(f, npc.age, 'Fell behind and borrowed to get by.'); }
  } else if (f.debt <= 0) f.struggling = false;
  // Spare money goes into a savings account, up to what they like to have put by; the careful keep more there.
  tickBank(npc, f, earns, s, quiet);
  // Money beyond what they want to keep to hand is invested: more of it by the bold, little by the careful.
  if (npc.age >= 25 && npc.age < 75 && f.debt === 0 && L.savings > earns * (s.buffer + 0.5)) {
    const put = Math.round((L.savings - earns * (s.buffer + 0.5)) * { cautious: 0.15, balanced: 0.35, bold: 0.6 }[f.style]);
    if (put > 0) { L.savings -= put; if (!f.invested) note(f, npc.age, 'Started investing.'); f.invested += put; }
  }
  if (tickRetire(npc, f, earns, quiet)) return 'retired';
  // A home of their own, when they have saved a deposit and earn enough for a lender to agree. The deposit can come from the bank.
  if (!f.home && !SHARES_HOME.includes(npc.role) && npc.age >= 24 && npc.age <= 60 && earns > 0 && f.debt === 0) {
    const price = Math.round(localCost(HOUSE, c) * (store.state.market?.housing ?? 1) * (0.6 + rng.next() * 0.8));
    const deposit = Math.round(price * MORTGAGE.deposit * s.buyAt * 1.5);
    const loan = price - deposit;
    const lenderSaysYes = loan <= (L.job?.salary ?? 0) * MORTGAGE.incomeMultiple && npc.age + MORTGAGE.years <= MORTGAGE.maxEndAge + 5;
    const has = L.savings + (f.bank?.bal ?? 0);
    if (lenderSaysYes && has >= deposit + earns * s.buffer && rng.chance(0.5)) {
      const fromHand = Math.min(deposit, Math.max(0, L.savings));
      L.savings -= fromHand;
      if (deposit > fromHand) f.bank.bal -= deposit - fromHand;
      f.home = { name: rng.pick(['a flat', 'a terraced house', 'a small house', 'a semi-detached house', 'a cottage']), value: price, paid: price, mortgage: loan,
        payment: yearlyPayment(loan, MORTGAGE.rate, MORTGAGE.years), yearsLeft: MORTGAGE.years, bought: store.state.year };
      note(f, npc.age, `Bought ${f.home.name} for ${fmtMoney(price, c)}, with a mortgage.`);
      return 'bought';
    }
  }
  return null;
}

// ---------- A bank account, a card, and retiring ----------

/** Money beyond what they keep to hand goes into the bank, up to what they like to have put by. */
function tickBank(npc, f, earns, s, quiet) {
  const L = npc.life;
  const toHand = earns * 0.15;
  if (L.savings <= toHand || npc.age < 18) return;
  if (!f.bank) {
    const bank = banksHere().find((b) => b.products.includes('savings'));
    if (!bank) return;
    f.bank = { bankId: bank.id, name: bank.name, bal: 0, rateBp: rateAt('savings', bank), opened: store.state.year };
    if (!quiet) note(f, npc.age, `Opened a savings account with ${bank.name}.`);
  }
  const target = earns * (s.buffer + 0.5) * (f.style === 'cautious' ? 2 : 1);
  const put = Math.round(Math.min(L.savings - toHand, Math.max(0, target - f.bank.bal)));
  if (put > 0) { L.savings -= put; f.bank.bal += put; }
}

/**
 * A credit card: the year's everyday spending goes on it (more of it for the
 * easy-going), and it is paid off in full, or the minimum is paid, as suits
 * them. Interest on what is carried; a fee for a missed payment; two missed
 * years and the card is cancelled and the balance becomes their debt. A
 * lender does not offer a new card for some years after that.
 */
function tickCard(npc, f, earns, s, quiet) {
  const L = npc.life;
  const c = country();
  const year = store.state.year;
  // Whether to have a card at all is a choice they make now and then, not every year: most of the easy-going say yes, few of the careful.
  const asks = !f.card && npc.age >= 20 && earns > 0 && store.state.year >= CARDS.since && (f.defaulted == null || year - f.defaulted > 6) && year - (f.cardAsked ?? -99) >= 10;
  if (asks) f.cardAsked = year;
  // Cards are everyday things where lenders share a full record, rarer where they do not.
  const where = { file: 1, registry: 0.55, bank: 0.35 }[creditModelOf(player().countryId)];
  if (asks && rng.chance({ cautious: 0.12, balanced: 0.5, bold: 0.85 }[f.style] * where)) {
    const bank = banksHere().find((b) => b.products.includes('current')) ?? banksHere()[0];
    if (bank) {
      f.card = { bankId: bank.id, limit: Math.max(localCost(500, c), Math.round(earns * 0.15 / 100) * 100), balance: 0, rateBp: f.style === 'bold' ? 2400 : 1900, missed: 0, opened: year };
      if (!quiet) note(f, npc.age, `Took out a credit card with ${bank.name}.`);
    }
    return;
  }
  const k = f.card;
  if (!k) return;
  k.balance += Math.round(k.balance * k.rateBp / 10000);
  // Spending goes on the card rather than out of their pocket.
  const spend = Math.min(Math.max(0, k.limit - k.balance), Math.round(earns * { cautious: 0.04, balanced: 0.08, bold: 0.14 }[f.style]));
  k.balance += spend; L.savings += spend;
  const min = Math.min(k.balance, Math.max(Math.round(k.balance * CARDS.minPay), localCost(CARDS.minPayFloor, c)));
  const want = f.style === 'bold' ? min : k.balance;
  const pay = Math.max(0, Math.min(want, Math.floor(L.savings + (f.bank?.bal ?? 0))));
  if (pay < min) {
    k.missed += 1; k.balance += localCost(CARDS.lateFee, c);
    if (k.missed >= 2) {
      f.debt += k.balance; f.card = null; f.defaulted = year;
      if (!quiet) note(f, npc.age, 'Had their credit card cancelled for missed payments.');
      return;
    }
  } else k.missed = 0;
  const fromHand = Math.min(pay, Math.max(0, L.savings));
  L.savings -= fromHand;
  if (pay > fromHand) f.bank.bal -= pay - fromHand;
  k.balance -= pay;
}

/** Someone with enough put by may stop work before the usual age. */
function tickRetire(npc, f, earns, quiet) {
  const L = npc.life;
  if (!L.job || L.retired || npc.age < 58 || npc.age >= 66) return false;
  const liquid = L.savings + (f.bank?.bal ?? 0) + f.invested - f.debt - (f.card?.balance ?? 0);
  const pension = Math.round(L.job.salary * Math.min(0.6, (L.yearsWorked ?? 0) * 0.015));
  const needs = earns * 0.7; // what a year costs them, roughly
  if (liquid < (needs - pension * 0.8) * (66 - npc.age + 15) || !rng.chance(0.5)) return false;
  L.pension = pension;
  if (!quiet) note(f, npc.age, `Retired early, at ${npc.age}, on what they had put by.`);
  npc.occupation = `retired ${npc.occupation ?? ''}`.trim();
  L.job = null; L.retired = true;
  return true;
}

/** What someone close could lay their hands on: what they have to hand and in the bank. */
export const spendable = (npc) => Math.max(0, Math.round((npc?.life?.savings ?? npc?.savings ?? 0) + (npc?.life?.fin?.bank?.bal ?? 0)));
/** Takes money from someone close: from what is to hand, then from their bank. */
export function takeFrom(npc, amount) {
  const L = npc.life;
  if (!L) { npc.savings = (npc.savings ?? 0) - amount; return; }
  const hand = Math.min(amount, Math.max(0, L.savings));
  L.savings -= hand;
  const rest = amount - hand;
  if (rest > 0 && L.fin?.bank) { const b = Math.min(rest, L.fin.bank.bal); L.fin.bank.bal -= b; L.savings -= rest - b; } else L.savings -= rest;
}

/**
 * Everything someone close leaves, once their debts and card are paid: what
 * they had to hand, in the bank and invested. Their home goes with them
 * (to whoever they live with, off the page). Empties it, so it cannot pass twice.
 */
export function settleNpc(npc) {
  const L = npc.life;
  if (!L) { const x = Math.max(0, npc.savings ?? 0); npc.savings = 0; return x; }
  const f = L.fin;
  const total = L.savings + (f?.bank?.bal ?? 0) + (f?.invested ?? 0) - (f?.debt ?? 0) - (f?.card?.balance ?? 0);
  L.savings = 0;
  if (f) { if (f.bank) f.bank.bal = 0; f.invested = 0; f.debt = 0; if (f.card) f.card.balance = 0; }
  return Math.max(0, Math.round(total));
}

/**
 * Yearly: someone close who is doing well may step in when the player is in
 * trouble. It is their decision: they have to be fond of the player, generous,
 * and able to spare it. Each person helps at most once every few years.
 * @returns {{npc:object, amount:number}|null}
 */
export function familyHelp() {
  const p = player();
  const trouble = p.finance.cash < 0 || p.flags.onBenefits;
  if (!trouble || p.age < 18) return null;
  const need = Math.max(localCost(1500, country()), Math.round(-p.finance.cash));
  const who = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.age >= 21 && ['parent', 'grandparent', ...CLOSE].includes(n.role)
    && (n.meters?.generosity ?? 50) >= 55 && (n.meters?.relationship ?? 0) >= 60 && spendable(n) >= need * 3
    && store.state.year - (n.flags.helpedYear ?? -99) >= 4).sort((a, b) => spendable(b) - spendable(a))[0];
  if (!who || !rng.chance(0.6)) return null;
  const amount = Math.min(need, Math.round(spendable(who) * 0.3));
  takeFrom(who, amount);
  who.flags.helpedYear = store.state.year;
  p.finance.cash += amount;
  return { npc: who, amount };
}

/** Lines for someone's profile. */
export function finRows(npc) {
  const f = npc?.life?.fin;
  if (!f || npc.age < 18) return [];
  const c = country();
  const rows = [['With money', styleName(f.style)]];
  if (f.home) rows.push(['Home', `Owns ${f.home.name}, worth ${fmtMoney(f.home.value, c)}${f.home.mortgage ? `, ${fmtMoney(f.home.mortgage, c)} still on the mortgage` : ', paid for'}`]);
  if (f.invested > 0) rows.push(['Invested', fmtMoney(f.invested, c)]);
  if (f.bank) rows.push(['In the bank', `${fmtMoney(f.bank.bal, c)}, ${f.bank.name}`]);
  if (f.card) rows.push(['Credit card', f.card.balance ? `${fmtMoney(f.card.balance, c)} owing of ${fmtMoney(f.card.limit, c)}` : `Paid off, limit ${fmtMoney(f.card.limit, c)}`]);
  if (f.debt > 0) rows.push(['Owes', fmtMoney(f.debt, c)]);
  rows.push(['Worth, all told', fmtMoney(npcWorth(npc), c)]);
  return rows;
}

