// Annual money flow: income, tax, living costs, loan payments, and settling
// up if the account ends the year in the red.
import { player, country, npcsByRole, log } from '../state.js';
import { fmtMoney, localMoney } from '../util.js';
import { childCosts } from './children.js';
import { settleUp } from './loans.js';
import { sell as sellSecurity } from './market.js';
import { repossess } from './realEstate.js';
import { repossessVehicle } from './vehicles.js';
import { RENT_AND_BILLS, BILLS_ONLY } from '../data/properties.js';

/** Cash plus asset equity minus debts. Takes the state so save.js can call it. */
export function netWorth(state) {
  const p = state.player;
  const assets = p.assets.reduce(
    (sum, a) => sum + a.value * (a.units ?? 1) - (a.mortgage?.principal ?? 0), 0);
  const debt = p.finance.loans.reduce((sum, l) => sum + l.principal, 0);
  return Math.round(p.finance.cash + assets - debt);
}

/** Sells an asset in a hurry, for whatever it will fetch. */
function forceSale(asset) {
  if (asset.kind === 'security') {
    const before = player().finance.cash;
    sellSecurity(asset.catalogId, 1);
    return player().finance.cash - before;
  }
  return asset.kind === 'vehicle' ? repossessVehicle(asset) : repossess(asset);
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

  // With no income at all, the state covers what your savings cannot.
  const afford = (cost) => {
    if (gross > 0 || f.cash >= cost) return cost;
    if (!p.flags.onBenefits) { p.flags.onBenefits = true; log('With no income and no savings, you are living on benefits.', 'system', 'bad'); }
    return Math.max(0, f.cash);
  };
  if (gross > 0) p.flags.onBenefits = false;

  // Living costs start once you support yourself. Rent is the biggest part,
  // and disappears when you live in a home you own.
  if (!p.flags.livesWithParents && p.age >= 18 && !p.education.enrolled) {
    // A spouse who earns pays their share of the household; one who does not is supported.
    const partner = npcsByRole('spouse')[0];
    const share = !partner ? 1 : partner.life?.job || partner.life?.pension ? 0.55 : 1.15;
    const base = Math.round(localMoney(p.homeId ? BILLS_ONLY : RENT_AND_BILLS, c) * share);
    const lifestyle = Math.round(Math.max(0, gross) * 0.2);
    f.cash -= afford(base + lifestyle);
  }

  const coParent = npcsByRole('spouse')[0];
  if (p.age >= 18) f.cash -= afford(Math.round(childCosts() * (coParent?.life?.job ? 0.5 : 1)));

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

  // Adults answer for their debts. Children's pocket money never goes this far.
  if (p.age >= 18) settleUp(forceSale);
}
