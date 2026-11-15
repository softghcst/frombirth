// Annual money flow: income, tax, living costs, loan payments.
import { player, country, log } from '../state.js';
import { fmtMoney, localMoney } from '../util.js';

/** Cash plus asset equity minus debts. Takes the state so save.js can call it. */
export function netWorth(state) {
  const p = state.player;
  const assets = p.assets.reduce(
    (sum, a) => sum + a.value * (a.units ?? 1) - (a.mortgage?.principal ?? 0), 0);
  const debt = p.finance.loans.reduce((sum, l) => sum + l.principal, 0);
  return Math.round(p.finance.cash + assets - debt);
}

export function tickFinance() {
  const p = player();
  const c = country();
  const f = p.finance;

  const gross = (p.career.salary || 0) + (p.career.partTime?.salary || 0)
    + (p.career.retired ? p.career.pensionPerYear : 0);
  if (gross > 0) {
    const tax = Math.round(gross * c.incomeTax);
    f.cash += gross - tax;
    f.lifetimeEarned += gross;
    f.lifetimeTaxPaid += tax;
    log(`You earned ${fmtMoney(gross, c)} and paid ${fmtMoney(tax, c)} in tax.`);
  }

  // Living costs start once you support yourself.
  if (!p.flags.livesWithParents && p.age >= 18 && !p.education.enrolled) {
    const base = localMoney(14000, c);
    const lifestyle = Math.round(Math.max(0, gross) * 0.25);
    f.cash -= base + lifestyle;
  }

  for (const loan of f.loans) {
    // Student loans are frozen while you study, and repayments wait until you
    // have an income (interest keeps building in the meantime).
    if (loan.kind === 'student' && p.education.enrolled) continue;
    if (loan.kind === 'student' && gross <= 0) {
      loan.principal += Math.round(loan.principal * loan.rate);
      continue;
    }
    const interest = Math.round(loan.principal * loan.rate);
    const payment = Math.min(
      loan.principal + interest,
      Math.round((loan.principal + interest) / Math.max(1, loan.yearsLeft)));
    loan.principal = loan.principal + interest - payment;
    loan.yearsLeft = Math.max(0, loan.yearsLeft - 1);
    f.cash -= payment;
  }
  f.loans = f.loans.filter((l) => l.principal > 0);
}
