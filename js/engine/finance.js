// Annual money flow: income, tax, living costs, loan payments, and settling
// up if the account ends the year in the red.
import { rentShare } from './neighborhoodLife.js';
import { housingK } from './cities.js';
import { careCost } from './couple.js';
import { runPayroll } from './worklife.js';
import { foreignWorth, atHome } from './currency.js';
import { rentFactor } from './policy.js';
import { taxBreakdown } from './systems.js';
import { store, player, country, npcsByRole, log, milestone } from '../state.js';
import { fmtMoney, localMoney, localCost, clamp } from '../util.js';
import { childCosts } from './children.js';
import { settleUp } from './loans.js';
import { sell as sellSecurity } from './market.js';
import { repossess } from './realEstate.js';
import { repossessVehicle } from './vehicles.js';
import { RENT_AND_BILLS, BILLS_ONLY } from '../data/properties.js';
import { book, toMinor, Money } from './ledger.js';
import { bankWorth, coverShortfall } from './banking.js';
import { mark, goodYear } from './credit.js';
import { tickCards } from './cards.js';
import { billShare } from './family.js';
import { contribute } from './retirement.js';
import { holdChildPay, releaseChildPay } from './childEarnings.js';
import { traitK } from './traits.js';

/** The first band of spending, at the country's own pay level. */
const localWage30 = (c) => localMoney(30000 * (c.living?.wageK ?? 1), c);

/** Which heading a line of the year's pay belongs under (engine/worklife.js payLines). */
export function payCategory(source) {
  if (source === 'main') return 'salary';
  if (source === 'parttime' || source.startsWith('side:')) return 'partTime';
  if (source.startsWith('gig:')) return 'gigs';
  if (source.startsWith('biz:')) return 'distribution';
  if (source === 'state') return 'statePension';
  if (source === 'benefit') return 'benefits';
  return source === 'pension' ? 'pension' : 'otherIncome';
}
const WORK = new Set(['salary', 'partTime', 'gigs']);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/**
 * The year's pay as twelve monthly payslips: what was earned, the tax and the
 * pension contribution taken from it, and what was paid in. Each column is
 * shared out so that the twelve months add up to exactly the year. The year
 * itself is booked as one transaction; the payslips show how it was made up.
 */
export function payslips({ year, cur, gross, tax, plan, employer, sources }) {
  const m = (n) => Money.allocate(toMinor(Math.max(0, n), cur), Array(12).fill(1));
  const g = m(gross); const t = m(tax); const pl = m(plan); const em = m(employer);
  return { year, cur, from: Object.entries(sources).filter(([, v]) => v > 0).map(([k]) => k),
    months: MONTHS.map((name, i) => ({ name, gross: g[i], tax: t[i], plan: pl[i], employer: em[i], net: g[i] - t[i] - pl[i] })) };
}

/** Tax due on a year's income, in local currency: the country's rate, through its schedule (engine/systems.js). */
export function incomeTax(gross, c = country()) {
  return taxBreakdown(Math.max(0, gross), c).tax;
}

/** What a year of ordinary spending costs at a given income: the more you earn, the more of it you spend. */
export function lifestyleCost(gross, c = country()) {
  const a = localWage30(c);
  const g = Math.max(0, gross);
  return Math.round(Math.min(g, a) * 0.2 + Math.max(0, g - a) * 0.55);
}

/** Cash and money in the bank, plus asset equity, minus debts. Takes the state so save.js can call it. */
export function netWorth(state) {
  const p = state.player;
  const assets = p.assets.reduce(
    (sum, a) => sum + a.value * (a.units ?? 1) - (a.mortgage ? (state === store.state ? atHome(a.mortgage.principal, a.mortgage.code) : a.mortgage.principal) : 0), 0);
  const debt = p.finance.loans.reduce((sum, l) => sum + l.principal, 0) + (p.finance.cards ?? []).reduce((sum, k) => sum + k.balance, 0)
    - (p.finance.lent ?? []).reduce((sum, l) => sum + l.left, 0); // what others owe the player counts for them
  return Math.round(p.finance.cash + (state === store.state ? foreignWorth(p) : 0) + bankWorth(state) + assets - debt);
}

/** Sells an asset in a hurry, for whatever it will fetch. */
function forceSale(asset) {
  book({ cat: 'interest', desc: 'Interest on being overdrawn', src: 'year' });
  const before = player().finance.cash;
  if (asset.kind === 'security') sellSecurity(asset.catalogId, 1);
  else if (asset.kind === 'vehicle') repossessVehicle(asset);
  else repossess(asset);
  book({ cat: asset.kind === 'security' ? 'investments' : asset.kind === 'vehicle' ? 'vehicle' : 'property', desc: `Sold to cover debts: ${asset.name}`, src: 'year' });
  return player().finance.cash - before;
}

export function tickFinance() {
  const p = player();
  const c = country();
  const f = p.finance;
  let everyday = 0; // what the year's ordinary spending came to, for the card statement

  // Money earned as a child is handed over at 18.
  releaseChildPay(p);
  // Every source of income for the year just lived, each paid once (engine/worklife.js).
  const pay = runPayroll(p);
  const gross = pay.gross;
  if (gross > 0) {
    const tax = incomeTax(gross, c);
    // A working child does not hold their own pay: a parent manages it, and the law may set a share aside (engine/childEarnings.js).
    const held = holdChildPay(gross - tax, pay.lines, p);
    f.cash += gross - tax - held;
    f.lifetimeEarned += gross;
    f.lifetimeTaxPaid += tax;
    p.career.lastPay.tax = tax;
    log(`You earned ${fmtMoney(gross, c)}${pay.lines.length > 1 ? ` from ${pay.lines.length} sources` : ''} and paid ${fmtMoney(tax, c)} in tax.`);
    // One entry for the year's pay: each source under its own heading, and the tax taken from it.
    const cur = c.currency.code;
    const sources = {};
    for (const l of pay.lines) { const k = payCategory(l.source); sources[k] = (sources[k] ?? 0) + l.gross; }
    const first = Object.keys(sources).find((k) => sources[k] > 0);
    book({ cat: first, src: 'year', key: `pay:${store.state.year}`, desc: first === 'pension' || first === 'statePension' ? 'Pensions for the year' : 'Pay for the year, after tax',
      split: [['tax', toMinor(tax, cur)], ...Object.entries(sources).filter(([k, v]) => k !== first && v > 0).map(([k, v]) => [k, -toMinor(v, cur)])] });
    const into = contribute(); // the player's own pension plan takes its share of the year's pay
    f.payslips = payslips({ year: store.state.year, cur, gross, tax, plan: into, employer: 0, sources });
    if (pay.lines.some((l) => WORK.has(payCategory(l.source))) && !p.flags.firstPay) {
      p.flags.firstPay = true;
      p.flags.firstPayAge = p.age;
      milestone('Received a first paycheck.', 'money');
      log('Your first pay. Money you earned yourself.', 'system', 'good');
    }
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
  if (!p.flags.livesWithParents && p.age >= 18 && !p.education.enrolled && !p.legal.incarceration) {
    // A spouse who earns pays their share of the household; one who does not is supported.
    // How a couple shares the household's costs is theirs to agree (engine/family.js).
    const share = billShare(gross);
    const housed = p.royal && !p.royal.waiting && ['monarch', 'heir', 'royal'].includes(p.royal.rank);
    // A roommate pays their share of the rent (engine/neighborhoodLife.js); a neighborhood's own costs are already in what the city charges.
    let base = housed ? 0 : Math.round(localCost(p.homeId ? BILLS_ONLY : RENT_AND_BILLS, c) * share * (p.homeId ? 1 : rentFactor(c.id) * (0.5 + 0.5 * housingK()) * rentShare())); // rent is about half of it, and follows the city
    const lifestyle = lifestyleCost(gross, c);
    // Where pay is low against rents, people on ordinary wages do not live alone: they share.
    const takeHome = gross - incomeTax(gross, c);
    const crowded = gross > 0 && !p.homeId && base > takeHome * 0.7;
    if (crowded) {
      base = Math.round(takeHome * 0.32);
      if (p.stats.mood > 40) p.stats.mood = clamp(p.stats.mood - 1);
      if (!p.flags.sharedHousing) log('On what you earn here, a place of your own is out of reach. You share a room, as most people your age do.', 'system', 'neutral');
    }
    p.flags.sharedHousing = crowded;
    const paid = afford(Math.round((base + lifestyle) * traitK('costK', p))); // the frugal live on a little less, a big spender on more (engine/traits.js)
    f.cash -= paid;
    everyday = Math.max(0, paid - base);
    book({ cat: 'living', src: 'year', desc: p.homeId ? 'Bills and everyday spending' : 'Rent, bills and everyday spending',
      split: [['housing', toMinor(Math.min(paid, base), c.currency.code)]] });
  }

  const coParent = npcsByRole('spouse')[0];
  if (p.age >= 18) f.cash -= afford(Math.round(childCosts() * (coParent?.life?.job ? 0.5 : 1) + careCost(p))); // with paid childcare, if the household chose it (engine/couple.js)
  book({ cat: 'childcare', src: 'year', desc: 'Raising your children' });

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
  // What was paid, less what came off the debts, is the interest.
  book({ cat: 'debt', nominal: 'interest', src: 'year', desc: 'Loan repayments' });

  // Adults answer for their debts. Children's allowance never goes this far.
  if (p.age >= 18) {
    const owed = f.loans.length > 0 || p.assets.some((a) => a.mortgage);
    // Money in the bank is taken before interest is charged or anything is sold.
    if (f.cash < 0) coverShortfall();
    // Then the cards: the year's spending, anything still uncovered, and the statement.
    const hadCard = (f.cards ?? []).some((k) => k.status === 'open' && (k.balance > 0 || k.everyday));
    const missed = tickCards(everyday);
    const overdrawn = f.cash < 0;
    const owned = p.assets.length;
    const bankruptBefore = p.flags.bankruptUntil ?? 0;
    settleUp(forceSale);
    const bankrupt = (p.flags.bankruptUntil ?? 0) !== bankruptBefore;
    const how = bankrupt ? p.flags.insolvency : null;
    book({ cat: how && how !== 'arrears' ? 'debtRelief' : how ? 'debt' : 'interest', src: 'year',
      desc: how === 'plan' ? 'Debts set aside by a court repayment plan' : how === 'arrears' ? 'What could not be paid became arrears' : how ? 'Debts written off in bankruptcy' : 'Interest on being overdrawn' });
    // What lenders will remember of this year.
    if (bankrupt) mark(how === 'plan' ? 'plan' : how === 'arrears' ? 'arrears' : 'bankruptcy');
    else if (p.assets.length < owned) mark('forcedSale');
    else if (overdrawn) mark('overdraft');
    else if ((owed || hadCard) && !missed) goodYear();
  }
}
