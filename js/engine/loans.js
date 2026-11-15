// Borrowing from the bank, paying it back, and what happens when the money
// runs out: overdraft interest, forced sales, and bankruptcy.
import { uid, localMoney, fmtMoney, clamp } from '../util.js';
import { player, country, npcsByRole, log, milestone } from '../state.js';
import { BANK_LOAN, OVERDRAFT_RATE, BANKRUPTCY_YEARS } from '../data/securities.js';

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

  // Nothing left: bankruptcy wipes the slate, at a price.
  const wiped = -f.cash + f.loans.filter((l) => l.kind !== 'student').reduce((s, l) => s + l.principal, 0);
  f.cash = 0;
  f.loans = f.loans.filter((l) => l.kind === 'student');
  p.flags.bankruptUntil = p.age + BANKRUPTCY_YEARS;
  p.stats.mood = clamp(p.stats.mood - 18);
  log(`You were declared bankrupt. ${fmtMoney(wiped, c)} of debt was written off, and no bank will lend to you for ${BANKRUPTCY_YEARS} years.`, 'system', 'bad');
  milestone('Declared bankrupt.', 'money');
}
