// Borrowing from the bank, paying it back, and what happens when the money
// runs out: overdraft interest, forced sales, and bankruptcy.
import { uid, localMoney, fmtMoney, clamp } from '../util.js';
import { player, country, npcsByRole, log, milestone } from '../state.js';
import { BANK_LOAN, OVERDRAFT_RATE, BANKRUPTCY_YEARS } from '../data/securities.js';
import { INSOLVENCY, INSOLVENCY_OF } from '../data/money.js';
import { store } from '../state.js';
import { recentDefault } from './credit.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

/** What the player earns in a year before tax. */
export function grossIncome() {
  const k = player().career;
  return (k.salary || 0) + (k.partTime?.salary || 0) + (k.retired ? k.pensionPerYear : 0);
}
/** Household income, which is what lenders look at. */
export const householdIncome = () => grossIncome() + (npcsByRole('spouse')[0]?.life?.job?.salary ?? 0);

export const isBankrupt = () => (player().flags.bankruptUntil ?? 0) > player().age;

/** What one year of repayments on a loan comes to. */
export function yearlyPayment(principal, rate, years) {
  return Math.round(principal * rate / (1 - (1 + rate) ** -years));
}

/** Everything owed each year on existing loans and mortgages. */
export function debtService() {
  const p = player();
  const loans = p.finance.loans.filter((l) => l.kind !== 'student')
    .reduce((s, l) => s + yearlyPayment(l.principal, l.rate, Math.max(1, l.yearsLeft)), 0);
  const mortgages = p.assets.reduce((s, a) => s + (a.mortgage?.payment ?? 0), 0);
  return loans + mortgages;
}

/**
 * What the bank would say to a loan of this size.
 * @returns {{amount:number, payment:number, approved:boolean, reason:string}}
 */
export function loanOffer(amount, rate = BANK_LOAN.rate, years = BANK_LOAN.years) {
  const p = player();
  const payment = yearlyPayment(amount, rate, years);
  let reason = '';
  if (p.age < 18) reason = 'You need to be 18.';
  else if (isBankrupt()) reason = 'No bank will lend to you until your bankruptcy is discharged.';
  else if (recentDefault()) reason = 'Lenders can see that things you owned were sold to cover your debts. They will want a few clean years first.';
  else if (householdIncome() <= 0) reason = 'The bank wants to see an income.';
  else if (debtService() + payment > householdIncome() * BANK_LOAN.maxShare) reason = 'Your repayments would be too large for your income.';
  return { amount, payment, approved: !reason, reason };
}

/** The loan sizes on offer, in local money. */
export const loanOptions = () => BANK_LOAN.amounts.map((a) => loanOffer(localMoney(a, country())));

export function borrow(amount, kind = 'bank') {
  const p = player();
  const offer = loanOffer(amount);
  if (!offer.approved) return result(false, offer.reason, 'neutral');
  p.finance.loans.push({ id: uid('loan'), kind, principal: amount, rate: BANK_LOAN.rate, yearsLeft: BANK_LOAN.years });
  p.finance.cash += amount;
  const text = `The bank lent you ${fmtMoney(amount, country())} at ${Math.round(BANK_LOAN.rate * 100)}% over ${BANK_LOAN.years} years: ${fmtMoney(offer.payment, country())} a year.`;
  log(text);
  return result(true, text, 'neutral');
}

export function repayLoan(id) {
  const p = player();
  const loan = p.finance.loans.find((l) => l.id === id);
  if (!loan) return result(false, 'That loan is already cleared.', 'neutral');
  if (p.finance.cash < loan.principal) return result(false, 'You do not have enough to clear it.', 'neutral');
  p.finance.cash -= loan.principal;
  p.finance.loans = p.finance.loans.filter((l) => l !== loan);
  const text = `You paid off your ${loan.kind} loan in full: ${fmtMoney(loan.principal, country())}.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/**
 * Year end. A negative balance is charged interest; a deep one forces the sale
 * of what you own; and if there is nothing left to sell, bankruptcy.
 * @param {(asset:object) => number} forceSale  sells an asset, returns what it raised
 */
export function settleUp(forceSale) {
  const p = player();
  const c = country();
  const f = p.finance;
  if (f.cash >= 0) return;
  const interest = Math.round(-f.cash * OVERDRAFT_RATE);
  f.cash -= interest;
  log(`You are overdrawn. The bank charged ${fmtMoney(interest, c)} in interest.`, 'system', 'bad');

  const limit = Math.max(localMoney(4000, c), grossIncome() * 0.4);
  if (-f.cash <= limit) return;

  // Sell what can be sold, least painful first: investments, vehicles, lets, then home.
  const order = (a) => (a.kind === 'security' ? 0 : a.kind === 'vehicle' ? 1 : a.id === p.homeId ? 3 : 2);
  for (const asset of [...p.assets].sort((x, y) => order(x) - order(y))) {
    if (f.cash >= 0) break;
    const raised = forceSale(asset);
    log(`To cover your debts, your ${asset.name.charAt(0).toLowerCase() + asset.name.slice(1)} was sold for ${fmtMoney(raised, c)}.`, 'system', 'bad');
  }
  if (-f.cash <= limit) return;

  if (isBankrupt()) { f.cash = 0; return; } // already bankrupt: there is nothing more to take

  // Nothing left. What happens next depends on where you live (data/money.js).
  const model = insolvencyOf();
  const cardsOwed = (f.cards ?? []).filter((k) => k.status === 'open').reduce((s, k) => s + k.balance, 0);
  const closeCards = () => { for (const k of f.cards ?? []) if (k.status === 'open') { k.balance = 0; k.status = 'closed'; k.closed = store.state.year; } };
  const owed = -f.cash + cardsOwed + f.loans.filter((l) => l.kind !== 'student').reduce((s, l) => s + l.principal, 0);
  p.stats.mood = clamp(p.stats.mood - 18);
  if (model === 'none') {
    // Nothing is written off: the overdraft becomes arrears, and the other debts stand.
    const rule = INSOLVENCY.none;
    f.loans.push({ id: uid('loan'), kind: 'arrears', principal: Math.round(-f.cash), rate: rule.rate, yearsLeft: rule.years });
    f.cash = 0;
    p.flags.bankruptUntil = p.age + rule.bar;
    p.flags.insolvency = 'arrears';
    log(`You could not pay what you owed, and there is no release from debt here. ${fmtMoney(owed, c)} still stands against you, to be repaid over the years.`, 'system', 'bad');
    milestone('Fell into arrears.', 'money');
    return;
  }
  if (model === 'plan') {
    const rule = INSOLVENCY.plan;
    const keep = Math.round(owed * rule.keep);
    f.cash = 0; closeCards();
    f.loans = [...f.loans.filter((l) => l.kind === 'student'), { id: uid('loan'), kind: 'court plan', principal: keep, rate: 0, yearsLeft: rule.years }];
    p.flags.bankruptUntil = p.age + rule.years;
    p.flags.insolvency = 'plan';
    log(`A court put you on a repayment plan. ${fmtMoney(owed - keep, c)} was written off; you will repay ${fmtMoney(keep, c)} over ${rule.years} years, and no bank will lend to you until it is done.`, 'system', 'bad');
    milestone('Put on a court repayment plan.', 'money');
    return;
  }
  // Discharge: the slate is wiped, at a price. Student loans survive it.
  f.cash = 0; closeCards();
  f.loans = f.loans.filter((l) => l.kind === 'student');
  p.flags.bankruptUntil = p.age + BANKRUPTCY_YEARS;
  p.flags.insolvency = 'bankruptcy';
  log(`You were declared bankrupt. ${fmtMoney(owed, c)} of debt was written off, and no bank will lend to you for ${BANKRUPTCY_YEARS} years.`, 'system', 'bad');
  milestone('Declared bankrupt.', 'money');
}

/** What happens here to someone who cannot pay. */
export const insolvencyOf = (countryId = player().countryId) => INSOLVENCY_OF[countryId] ?? 'discharge';

/**
 * What a lender would offer to replace a loan with: a rate that follows the
 * borrower's standing, over the years the loan has left. Worth taking only if it is cheaper.
 */
export function refinanceOffer(loan, standingNow = null) {
  const p = player();
  const c = country();
  let reason = '';
  const rate = Math.max(0.03, BANK_LOAN.rate - (standingNow == null ? 0 : standingNow >= 80 ? 0.025 : standingNow >= 65 ? 0.012 : 0));
  const fee = Math.round(loan.principal * 0.01);
  if (['court plan', 'arrears'].includes(loan.kind)) reason = 'A debt set by a court cannot be moved.';
  else if (loan.kind === 'student' && p.education.enrolled) reason = 'Not while you are studying.';
  else if (isBankrupt() || recentDefault()) reason = 'No lender will take it on with your record as it is.';
  else if (householdIncome() <= 0) reason = 'A lender wants to see an income.';
  else if (rate >= loan.rate - 0.005) reason = 'Nobody is offering a better rate than you already have.';
  else if (p.finance.cash < fee) reason = `The arrangement fee is ${fmtMoney(fee, c)}.`;
  const years = Math.max(1, loan.yearsLeft);
  const saving = reason ? 0 : loanSchedule(loan).interest - loanSchedule({ ...loan, rate }).interest - fee;
  return { ok: !reason && saving > 0, reason: reason || (saving > 0 ? '' : 'With the fee it would save you nothing.'), rate, fee, years, saving };
}
export function refinance(id, standingNow = null) {
  const p = player();
  const loan = p.finance.loans.find((l) => l.id === id);
  if (!loan) return result(false, 'That loan is already cleared.', 'neutral');
  const o = refinanceOffer(loan, standingNow);
  if (!o.ok) return result(false, o.reason, 'neutral');
  p.finance.cash -= o.fee;
  const was = loan.rate;
  loan.rate = o.rate; loan.refinanced = store.state.year;
  const text = `You moved your ${loan.kind} loan from ${(was * 100).toFixed(1)}% to ${(o.rate * 100).toFixed(1)}%. The fee was ${fmtMoney(o.fee, country())}; if nothing changes it saves about ${fmtMoney(o.saving, country())}.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/**
 * Asking a lender for time. They agree when the borrower really is struggling
 * (no income, or repayments taking most of it), once for each loan: the debt
 * is spread over more years, which costs more interest in the end.
 */
export function askForTime(id) {
  const p = player();
  const loan = p.finance.loans.find((l) => l.id === id);
  if (!loan) return result(false, 'That loan is already cleared.', 'neutral');
  if (loan.eased) return result(false, 'They have already given you more time on this one.', 'neutral');
  if (['court plan'].includes(loan.kind)) return result(false, 'The court set the plan. It is not for the lender to change.', 'neutral');
  const income = householdIncome();
  const hard = income <= 0 || debtService() > income * 0.4 || p.finance.cash < 0;
  if (!hard) { const text = 'The lender looked at your income and what you owe, and said you can manage the payments as they are.'; log(text, 'system', 'neutral'); return result(false, text, 'neutral'); }
  loan.eased = store.state.year; loan.yearsLeft += 3;
  const text = `The lender agreed to spread your ${loan.kind} loan over three more years. Each payment is smaller; in the end you will pay more interest.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/**
 * How a loan runs from here if nothing changes: each year's interest, payment
 * and what is left. It follows the same rule the year itself uses, so it is a
 * projection of the game's own arithmetic, not a promise.
 * @returns {{rows:{year:number, interest:number, payment:number, left:number}[], interest:number, paid:number}}
 */
export function loanSchedule(loan) {
  const rows = [];
  let principal = loan.principal;
  let years = Math.max(1, loan.yearsLeft);
  let interest = 0; let paid = 0;
  for (let y = 1; principal > 0 && y <= 60; y++) {
    const i = Math.round(principal * loan.rate);
    const pay = Math.min(principal + i, Math.round((principal + i) / Math.max(1, years)));
    principal = principal + i - pay;
    years = Math.max(0, years - 1);
    interest += i; paid += pay;
    rows.push({ year: y, interest: i, payment: pay, left: principal });
  }
  return { rows, interest, paid };
}

/** Pays part of a loan early. Whatever is paid comes straight off what is owed. */
export function payDown(id, amount) {
  const p = player();
  const loan = p.finance.loans.find((l) => l.id === id);
  if (!loan) return result(false, 'That loan is already cleared.', 'neutral');
  amount = Math.floor(amount);
  if (!(amount > 0)) return result(false, 'Choose an amount.', 'neutral');
  if (amount >= loan.principal) return repayLoan(id);
  if (p.finance.cash < amount) return result(false, 'You do not have that much to spare.', 'neutral');
  p.finance.cash -= amount;
  loan.principal -= amount;
  const text = `You paid ${fmtMoney(amount, country())} off your ${loan.kind} loan. ${fmtMoney(loan.principal, country())} is left.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** The order to clear debts in, by two common rules. Neither is right for everyone. */
export function payoffOrder(rule = 'rate') {
  const list = [...player().finance.loans];
  return rule === 'rate' ? list.sort((a, b) => b.rate - a.rate || a.principal - b.principal) : list.sort((a, b) => a.principal - b.principal || b.rate - a.rate);
}
