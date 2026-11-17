// Credit cards: a limit, a balance, a statement once a year, and what
// happens when the payment is missed.
//
// A card is borrowing. Money put on it is owed, and never counts as income
// or adds to what the player is worth. The terms are invented (data/money.js).
//   p.finance.cards = [{ id, name, bankId, limit, balance, rateBp, opened, autopay: 'full'|'min',
//                        everyday: bool, missed, status: 'open'|'closed'|'defaulted', statements: [...] }]
import { store, player, country, log, milestone } from '../state.js';
import { fmtMoney, localMoney } from '../util.js';
import { CARDS, BANK_BY_ID } from '../data/money.js';
import { book, toMinor } from './ledger.js';
import { grossIncome, householdIncome, debtService, isBankrupt } from './loans.js';
import { standing, recentDefault, mark } from './credit.js';
import { banksHere } from './banking.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const list = () => (player().finance.cards ??= []);
export const cards = () => list().filter((k) => k.status === 'open');
export const allCards = () => list();
export const cardById = (id) => list().find((k) => k.id === id);
export const available = (k) => Math.max(0, k.limit - k.balance);
export const cardDebt = (p = player()) => (p.finance.cards ?? []).reduce((s, k) => s + k.balance, 0);
/** How much of all card limits is in use, 0 to 1. */
export const utilisation = () => { const open = cards(); const lim = open.reduce((s, k) => s + k.limit, 0); return lim ? open.reduce((s, k) => s + k.balance, 0) / lim : 0; };
/**
 * The least a statement asks for: the year's interest on what is owed, plus a small part of it. The
 * balance has already had the interest added, so paying the minimum always brings it down.
 */
export const minimumDue = (k) => {
  const r = k.rateBp / 10000;
  return Math.min(k.balance, Math.max(Math.round(k.balance * (r + CARDS.minPay) / (1 + r)), localMoney(CARDS.minPayFloor, country())));
};

const tierFor = (s) => (s.standing == null ? CARDS.starter : CARDS.tiers.find((t) => s.standing >= t.min) ?? null);

/** What a card issuer would offer today. */
export function cardOffer() {
  const p = player();
  const income = grossIncome();
  const s = standing({ income: householdIncome(), service: debtService() });
  const bank = banksHere().find((b) => b.products.includes('current')) ?? banksHere()[0];
  let reason = '';
  if (store.state.year < CARDS.since) reason = 'Nobody has thought of credit cards yet.';
  else if (p.age < CARDS.minAge) reason = `You need to be ${CARDS.minAge}.`;
  else if (p.legal.incarceration) reason = 'Not from a cell.';
  else if (cards().length >= CARDS.max) reason = `You already have ${CARDS.max} cards.`;
  else if (isBankrupt()) reason = 'No lender will deal with you yet.';
  else if (recentDefault()) reason = 'Lenders can see the recent trouble on your record.';
  else if (income <= 0) reason = 'The bank wants to see an income of your own.';
  const tier = tierFor(s);
  if (!reason && !tier) reason = 'Your standing with lenders is too poor.';
  return { ok: !reason, reason, bank, name: tier?.name, rateBp: tier?.rateBp, limit: tier ? Math.max(localMoney(500, country()), Math.round(income * tier.limit / 100) * 100) : 0 };
}

export function applyForCard() {
  const p = player();
  const o = cardOffer();
  if (!o.ok) return result(false, o.reason, 'neutral');
  const first = !list().length;
  list().push({ id: `card${list().length + 1}_${store.state.year}`, name: o.name, bankId: o.bank.id, limit: o.limit, balance: 0, rateBp: o.rateBp,
    opened: store.state.year, openedAge: p.age, autopay: 'full', everyday: true, missed: 0, status: 'open', statements: [] });
  const text = `${o.bank.name} gave you a ${o.name.toLowerCase()} with a limit of ${fmtMoney(o.limit, country())}, at ${(o.rateBp / 100).toFixed(1)}% a year on anything you do not pay off.`;
  log(text, 'system', 'neutral');
  if (first) milestone('Took out a first credit card.', 'money');
  book({ cat: 'borrowing', src: 'action', desc: text });
  return result(true, text, 'neutral');
}

/** Pays some or all of a card from everyday money. */
export function payCard(id, amount) {
  const p = player();
  const k = cardById(id);
  amount = Math.floor(amount);
  if (!k || !(amount > 0)) return result(false, 'Choose an amount.', 'neutral');
  if (amount > k.balance) amount = k.balance;
  if (!amount) return result(false, 'There is nothing owing on it.', 'neutral');
  if (p.finance.cash < amount) return result(false, 'You do not have that much to spare.', 'neutral');
  p.finance.cash -= amount; k.balance -= amount;
  const text = `You paid ${fmtMoney(amount, country())} off your ${k.name.toLowerCase()}. ${k.balance ? `${fmtMoney(k.balance, country())} is still owing.` : 'It is clear.'}`;
  log(text, 'system', 'good');
  book({ cat: 'debt', src: 'action', desc: text });
  return result(true, text);
}

/** Takes cash out on a card. It is borrowed money, and the issuer charges for it at once. */
export function cashAdvance(id, amount) {
  const p = player();
  const k = cardById(id);
  amount = Math.floor(amount);
  if (!k || k.status !== 'open' || !(amount > 0)) return result(false, 'Choose an amount.', 'neutral');
  const fee = Math.ceil(amount * CARDS.advanceFee);
  if (amount + fee > available(k)) return result(false, `With the fee that is more than the ${fmtMoney(available(k), country())} left on the card.`, 'neutral');
  p.finance.cash += amount; k.balance += amount + fee;
  const text = `You took ${fmtMoney(amount, country())} in cash on your card. The fee was ${fmtMoney(fee, country())}, and you now owe ${fmtMoney(k.balance, country())} on it.`;
  log(text, 'system', 'neutral');
  book({ cat: 'borrowing', nominal: 'fees', src: 'action', desc: text });
  return result(true, text, 'neutral');
}

export function setCard(id, { autopay, everyday } = {}) {
  const k = cardById(id);
  if (!k || k.status !== 'open') return result(false, 'That card is closed.', 'neutral');
  if (autopay === 'full' || autopay === 'min') k.autopay = autopay;
  if (everyday != null) k.everyday = !!everyday;
  return result(true, `Your ${k.name.toLowerCase()}: ${k.everyday ? 'used for everyday spending' : 'kept for emergencies'}, and ${k.autopay === 'full' ? 'paid off in full' : 'the minimum paid'} each year.`, 'neutral');
}

/** Asks for a higher limit. The issuer decides, on the record and the income it can see. */
export function askForLimit(id) {
  const k = cardById(id);
  if (!k || k.status !== 'open') return result(false, 'That card is closed.', 'neutral');
  if (k.askedYear === store.state.year) return result(false, 'You have asked this year already.', 'neutral');
  k.askedYear = store.state.year;
  const s = standing({ income: householdIncome(), service: debtService() });
  const tier = tierFor(s);
  const want = tier ? Math.round(grossIncome() * tier.limit * 1.25 / 100) * 100 : 0;
  if (k.missed || recentDefault() || want <= k.limit) {
    const text = 'The issuer looked at your record and your income, and left the limit where it is.';
    log(text, 'system', 'neutral');
    return result(false, text, 'neutral');
  }
  k.limit = want;
  const text = `Your limit was raised to ${fmtMoney(want, country())}.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

export function closeCard(id) {
  const k = cardById(id);
  if (!k || k.status !== 'open') return result(false, 'That card is already closed.', 'neutral');
  if (k.balance > 0) return result(false, `Pay off the ${fmtMoney(k.balance, country())} owing first.`, 'neutral');
  k.status = 'closed'; k.closed = store.state.year;
  const text = `You closed your ${k.name.toLowerCase()}. Its history stays on your record.`;
  log(text, 'system', 'neutral');
  book({ cat: 'debt', src: 'action' });
  return result(true, text, 'neutral');
}

/**
 * Yearly, after the year's pay and bills: interest on what was carried over,
 * this year's spending put on the card, anything everyday money could not
 * cover, and then the statement.
 * @param {number} spent  what the year's everyday living cost, already paid from cash
 * @returns {boolean} whether a payment was missed this year
 */
export function tickCards(spent = 0) {
  const p = player();
  const c = country();
  const f = p.finance;
  let anyMissed = false;
  for (const k of cards()) {
    const st = { year: store.state.year, opening: k.balance, interest: 0, spent: 0, fee: 0, paid: 0, reward: 0 };
    // Interest is charged only on what was not paid off last time.
    st.interest = Math.round(k.balance * k.rateBp / 10000);
    k.balance += st.interest;
    // The year's everyday spending goes through the card, if that is how it is used.
    if (k.everyday && spent > 0) { st.spent = Math.min(available(k), Math.round(spent)); spent -= st.spent; f.cash += st.spent; k.balance += st.spent; }
    // Whatever everyday money could not cover lands on the card too, while there is room.
    if (f.cash < 0) { const x = Math.min(available(k), Math.ceil(-f.cash)); st.spent += x; f.cash += x; k.balance += x; }
    const due = minimumDue(k);
    const wants = k.autopay === 'full' ? k.balance : due;
    st.paid = Math.max(0, Math.min(wants, Math.floor(f.cash)));
    if (st.paid < due) { // the minimum was not met
      st.fee = Math.min(localMoney(CARDS.lateFee, c), Math.max(0, k.limit * 2 - k.balance));
      k.balance += st.fee; k.missed += 1; anyMissed = true;
      mark('missed');
      log(`You missed the payment on your ${k.name.toLowerCase()}. A ${fmtMoney(st.fee, c)} fee was added.`, 'system', 'bad');
    } else if (k.balance > 0) k.missed = 0;
    f.cash -= st.paid; k.balance -= st.paid;
    // Paying a card off in full earns a little back.
    if (k.balance === 0 && st.spent > 0 && !st.fee) { st.reward = Math.floor(st.spent * CARDS.reward); f.cash += st.reward; }
    st.closing = k.balance;
    k.statements.push(st);
    if (k.statements.length > 6) k.statements.shift();
    if (st.interest) log(`Your ${k.name.toLowerCase()} charged ${fmtMoney(st.interest, c)} in interest. You owe ${fmtMoney(k.balance, c)} on it.`, 'system', 'bad');
    book({ cat: 'debt', nominal: 'interest', src: 'year', desc: `${k.name} statement: ${BANK_BY_ID[k.bankId]?.name ?? 'the bank'}`,
      split: [['fees', toMinor(st.fee, c.currency.code)], ['otherIncome', -toMinor(st.reward, c.currency.code)]] });
    // Two years without a payment and the issuer gives up on the card: the debt remains, as a loan.
    if (k.missed >= 2) {
      k.status = 'defaulted'; k.closed = store.state.year;
      if (k.balance > 0) f.loans.push({ id: `loan_${k.id}`, kind: 'card debt', principal: k.balance, rate: k.rateBp / 10000, yearsLeft: 6 });
      k.balance = 0;
      mark('default');
      log(`Your ${k.name.toLowerCase()} was cancelled for non-payment. What you owed is now a debt to be repaid over six years.`, 'system', 'bad');
      book({ cat: 'debt', src: 'year', desc: `${k.name} cancelled: the balance became a loan` });
    }
  }
  return anyMissed;
}

/** Bankruptcy or a court plan takes the cards with it. Returns what was owing on them. */
export function surrenderCards() {
  let owed = 0;
  for (const k of cards()) { owed += k.balance; k.balance = 0; k.status = 'closed'; k.closed = store.state.year; }
  return owed;
}
