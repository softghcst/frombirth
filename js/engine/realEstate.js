// Property: what is for sale, mortgages, living in it, renovating, letting to
// tenants, selling, and the yearly upkeep, wear and repayments.
import { rng } from '../rng.js';
import { COUNTRIES } from '../data/countries.js';
import { uid, clamp, fmtMoney, theCountry } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { market } from './market.js';
import { householdIncome, isBankrupt, yearlyPayment } from './loans.js';
import { PROPERTY_TYPES, PROPERTY_BY_ID, STREETS, MORTGAGE, SELLING_FEE, BUYING_FEE } from '../data/properties.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
/** "Family house on Elm Street" -> "family house on Elm Street". */
const lower = (name) => name.charAt(0).toLowerCase() + name.slice(1);
const assetOf = (id) => player().assets.find((a) => a.id === id);
export const properties = () => player().assets.filter((a) => a.kind === 'property');
/** The country a property stands in. Older saves did not record it. */
export const placeOf = (a) => COUNTRIES[a.countryId ?? player().countryId];
/** True for a property in a country the player no longer lives in. */
export const isAbroad = (a) => !!a.countryId && a.countryId !== player().countryId;
/** A year's property tax on it, in the money the player uses now. */
export const propertyTaxOn = (a) => Math.round(a.value * placeOf(a).propertyTax);
export const home = () => assetOf(player().homeId);

/** What a property is worth today: the market, its own quality, and its condition. */
function worth(typeId, quality, condition) {
  const type = PROPERTY_BY_ID[typeId];
  return Math.round(type.price * country().currency.scale * market().housing * quality * (0.6 + 0.4 * condition / 100));
}

const describe = (condition) => (condition >= 85 ? 'immaculate' : condition >= 65 ? 'in good order'
  : condition >= 45 ? 'tired' : condition >= 25 ? 'needs work' : 'close to derelict');

/** This year's listings. They change every year. */
export function listings() {
  const p = player();
  const m = market();
  if (m.listings?.age !== p.age || !m.listings.property) {
    const list = [];
    const streets = [...STREETS];
    for (let i = 0; i < 7; i++) {
      const type = i < PROPERTY_TYPES.length && rng.chance(0.75) ? PROPERTY_TYPES[i] : rng.pick(PROPERTY_TYPES);
      const condition = rng.int(25, 100);
      const quality = rng.around(1, 0.14);
      const street = streets.splice(rng.int(0, streets.length - 1), 1)[0];
      list.push({ id: uid('lst'), typeId: type.id, name: `${type.name} on ${street}`, condition, quality,
        price: worth(type.id, quality, condition) });
    }
    m.listings = { ...(m.listings?.age === p.age ? m.listings : {}), age: p.age, property: list.sort((a, b) => a.price - b.price) };
  }
  return m.listings.property.map((l) => ({ ...l, state: describe(l.condition), fees: Math.round(l.price * BUYING_FEE) }));
}

/**
 * What a lender would do for this price.
 * @returns {{minDeposit:number, maxLoan:number, years:number, rate:number, available:boolean, reason:string}}
 */
export function mortgageTerms(price) {
  const p = player();
  const owed = properties().reduce((s, a) => s + (a.mortgage?.principal ?? 0), 0);
  const years = Math.min(MORTGAGE.years, MORTGAGE.maxEndAge - p.age);
  const maxLoan = Math.max(0, Math.round(householdIncome() * MORTGAGE.incomeMultiple - owed));
  let reason = '';
  if (isBankrupt()) reason = 'No lender will give you a mortgage until your bankruptcy is discharged.';
  else if (years < 5) reason = 'Lenders will not start a mortgage at your age.';
  else if (maxLoan <= 0) reason = 'Lenders want to see an income.';
  return { minDeposit: Math.round(price * MORTGAGE.deposit), maxLoan, years, rate: MORTGAGE.rate, available: !reason, reason };
}

/**
 * Buys a listing. deposit is how much of the price is paid in cash; the rest
 * is a mortgage. A deposit equal to the price is a cash purchase.
 */
export function buyProperty(listingId, deposit) {
  const p = player();
  const c = country();
  const l = market().listings?.property.find((x) => x.id === listingId);
  if (!l) return result(false, 'That one has gone.', 'neutral');
  if (p.age < 18) return result(false, 'You need to be 18 to buy property.', 'neutral');
  const fees = Math.round(l.price * BUYING_FEE);
  const loan = l.price - deposit;
  if (p.finance.cash < deposit + fees) return result(false, 'You do not have enough for the deposit and fees.', 'neutral');
  let mortgage = null;
  if (loan > 0) {
    const t = mortgageTerms(l.price);
    if (!t.available) return result(false, t.reason, 'neutral');
    if (deposit < t.minDeposit) return result(false, `The lender wants a deposit of at least ${fmtMoney(t.minDeposit, c)}.`, 'neutral');
    if (loan > t.maxLoan) return result(false, `On your income the most a lender will offer is ${fmtMoney(t.maxLoan, c)}. You would need a bigger deposit.`, 'neutral');
    mortgage = { principal: loan, rate: t.rate, yearsLeft: t.years, payment: yearlyPayment(loan, t.rate, t.years) };
  }
  p.finance.cash -= deposit + fees;
  const first = !properties().length && !p.flags.ownedProperty;
  const asset = { id: uid('asset'), kind: 'property', catalogId: l.typeId, name: l.name, purchasePrice: l.price,
    value: l.price, boughtAtAge: p.age, condition: l.condition, quality: l.quality, mortgage, tenant: null,
    countryId: p.countryId, city: p.city };
  p.assets.push(asset);
  p.flags.ownedProperty = true;
  market().listings.property = market().listings.property.filter((x) => x.id !== listingId);
  const text = `You bought the ${lower(l.name)} for ${fmtMoney(l.price, c)}${mortgage
    ? `, with a deposit of ${fmtMoney(deposit, c)} and a mortgage of ${fmtMoney(loan, c)} (${fmtMoney(mortgage.payment, c)} a year for ${mortgage.yearsLeft} years)`
    : ', in cash'}. Fees came to ${fmtMoney(fees, c)}.`;
  log(text, 'system', 'good');
  if (first) milestone(`Bought a first property: the ${lower(l.name)}.`, 'money');
  if (!p.homeId) moveIn(asset.id, true);
  return result(true, text);
}

export function moveIn(id, quiet = false) {
  const p = player();
  const a = assetOf(id);
  if (a.tenant) return result(false, 'There is a tenant living there.', 'neutral');
  if (isAbroad(a)) return result(false, `It is in ${theCountry(COUNTRIES[a.countryId].name)}. You would have to move back to live in it.`, 'neutral');
  p.homeId = id;
  p.flags.livesWithParents = false;
  const text = `You moved into the ${lower(a.name)}. No more rent.`;
  if (!quiet) log(text, 'system', 'good'); else log(`It is yours, and you have moved in. No more rent.`, 'system', 'good');
  return result(true, text);
}

export function renovationCost(id) {
  return Math.round(assetOf(id).value * 0.08);
}

export function renovate(id) {
  const p = player();
  const a = assetOf(id);
  const cost = renovationCost(id);
  if (a.condition >= 95) return result(false, 'There is nothing left to improve.', 'neutral');
  if (p.finance.cash < cost) return result(false, 'You cannot afford the builders.', 'neutral');
  p.finance.cash -= cost;
  a.condition = clamp(a.condition + 35);
  a.quality *= 1.03;
  a.value = worth(a.catalogId, a.quality, a.condition);
  const text = `You spent ${fmtMoney(cost, country())} renovating the ${lower(a.name)}. It is now worth ${fmtMoney(a.value, country())}.`;
  log(text, 'system', 'good');
  return result(true, text);
}

export function rentFor(a) {
  return Math.round(a.value * PROPERTY_BY_ID[a.catalogId].yield);
}

export function letOut(id) {
  const p = player();
  const a = assetOf(id);
  if (a.tenant) return result(false, 'It is already let.', 'neutral');
  if (p.homeId === id) return result(false, 'You live there. Move out first.', 'neutral');
  if (a.condition < 25) return result(false, 'Nobody will rent it in this state. Renovate it first.', 'neutral');
  a.tenant = { rent: Math.round(rentFor(a) * rng.around(1, 0.08)), quality: rng.int(15, 100), sinceAge: p.age };
  const text = `You found a tenant for the ${lower(a.name)} at ${fmtMoney(a.tenant.rent, country())} a year.`;
  log(text, 'system', 'good');
  return result(true, text);
}

export function evict(id) {
  const a = assetOf(id);
  if (!a.tenant) return result(false, 'There is no tenant.', 'neutral');
  a.tenant = null;
  player().hidden.karma = clamp(player().hidden.karma - 2);
  const text = `You gave your tenant notice. The ${lower(a.name)} is empty.`;
  log(text);
  return result(true, text, 'neutral');
}

export function moveOut() {
  const p = player();
  const a = home();
  if (!a) return result(false, 'You do not live in a place you own.', 'neutral');
  p.homeId = null;
  const text = `You moved out of the ${lower(a.name)} and are renting again.`;
  log(text);
  return result(true, text, 'neutral');
}

export function payOffMortgage(id) {
  const p = player();
  const a = assetOf(id);
  if (!a.mortgage) return result(false, 'There is no mortgage on it.', 'neutral');
  if (p.finance.cash < a.mortgage.principal) return result(false, 'You do not have enough to clear it.', 'neutral');
  p.finance.cash -= a.mortgage.principal;
  const text = `You paid off the mortgage on the ${lower(a.name)}: ${fmtMoney(a.mortgage.principal, country())}. It is yours outright.`;
  a.mortgage = null;
  log(text, 'system', 'good');
  milestone('Paid off a mortgage.', 'money');
  return result(true, text);
}

/** What selling would leave in the player's hands after fees and the mortgage. */
export const saleProceeds = (a, discount = 1) =>
  Math.round(a.value * discount * (1 - SELLING_FEE) - (a.mortgage?.principal ?? 0));

function remove(a) {
  const p = player();
  p.assets = p.assets.filter((x) => x !== a);
  if (p.homeId === a.id) p.homeId = null;
}

export function sellProperty(id) {
  const p = player();
  const c = country();
  const a = assetOf(id);
  const raised = saleProceeds(a);
  p.finance.cash += raised;
  const gain = a.value - a.purchasePrice;
  const wasHome = p.homeId === id;
  remove(a);
  const text = `You sold the ${lower(a.name)} for ${fmtMoney(a.value, c)}, ${gain >= 0 ? `${fmtMoney(gain, c)} more` : `${fmtMoney(-gain, c)} less`} than you paid. After fees${a.mortgage ? ' and the mortgage' : ''} you kept ${fmtMoney(raised, c)}.${wasHome ? ' You are renting again.' : ''}`;
  log(text, 'system', gain >= 0 ? 'good' : 'bad');
  return result(true, text, gain >= 0 ? 'good' : 'neutral');
}

/** A forced sale goes cheap. Used when debts are called in. */
export function repossess(a) {
  const raised = saleProceeds(a, 0.85);
  player().finance.cash += raised;
  remove(a);
  return Math.round(a.value * 0.85);
}

/** Changes a property from an event: which is 'home', 'rental' or 'any'. */
export function hitProperty(which, { condition = 0, evict: out = false } = {}) {
  const list = properties();
  const a = which === 'home' ? home() : which === 'rental' ? list.find((x) => x.tenant) : home() ?? list[0];
  if (!a) return;
  a.condition = clamp(a.condition + condition);
  if (out) a.tenant = null;
  a.value = worth(a.catalogId, a.quality, a.condition);
}

/** Yearly: wear, value, upkeep, mortgage payments, and rent from tenants. */
export function tickProperties() {
  const p = player();
  const c = country();
  const f = p.finance;
  let rent = 0;
  let taxPaid = 0;
  for (const a of properties()) {
    const type = PROPERTY_BY_ID[a.catalogId];
    const hard = a.tenant && a.tenant.quality < 35;
    a.condition = clamp(a.condition - rng.int(0, 2) - (hard ? rng.int(1, 4) : 0));
    a.value = worth(a.catalogId, a.quality, a.condition);
    f.cash -= Math.round(a.value * type.upkeep);
    const due = propertyTaxOn(a);
    if (due) { f.cash -= due; f.lifetimeTaxPaid += due; taxPaid += due; }

    if (a.mortgage) {
      const m = a.mortgage;
      const interest = Math.round(m.principal * m.rate);
      const pay = Math.min(m.payment, m.principal + interest);
      f.cash -= pay;
      m.principal = m.principal + interest - pay;
      m.yearsLeft -= 1;
      if (m.principal <= 1 || m.yearsLeft <= 0) {
        a.mortgage = null;
        log(`You made the last payment on the ${lower(a.name)}. It is yours outright.`, 'system', 'good');
        milestone('Paid off a mortgage.', 'money');
      }
    }

    if (a.tenant) {
      const t = a.tenant;
      if (t.quality < 35 && rng.chance(0.18)) {
        log(`Your tenant at the ${lower(a.name)} paid no rent this year.`, 'system', 'bad');
      } else {
        rent += t.rent;
        t.rent = Math.round(t.rent * 1.02);
      }
      if (rng.chance(0.08)) {
        a.tenant = null;
        log(`Your tenant moved out of the ${lower(a.name)}. It is standing empty.`);
      }
    }
  }
  if (taxPaid) log(`You paid ${fmtMoney(taxPaid, c)} in property tax.`);
  if (rent) {
    const tax = Math.round(rent * c.incomeTax);
    f.cash += rent - tax;
    f.lifetimeEarned += rent;
    f.lifetimeTaxPaid += tax;
    log(`Your tenants paid ${fmtMoney(rent, c)} in rent. You paid ${fmtMoney(tax, c)} tax on it.`, 'system', 'good');
  }
  const h = home();
  if (h) p.stats.mood = clamp(p.stats.mood + Math.round(PROPERTY_BY_ID[h.catalogId].comfort / 3));
}

export { describe as conditionWord };
export const propertyTypeOf = (a) => PROPERTY_BY_ID[a.catalogId];
export const housingMove = () => store.state.market.housingMove ?? 0;
