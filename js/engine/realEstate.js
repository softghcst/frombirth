// Property: what is for sale, mortgages, living in it, renovating, letting to
// tenants, selling, and the yearly upkeep, wear and repayments.
import { housingK } from './cities.js';
import { rng } from '../rng.js';
import { COUNTRIES } from '../data/countries.js';
import { uid, clamp, fmtMoney, theCountry } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { market, housingIndex } from './market.js';
import { householdIncome, isBankrupt, yearlyPayment } from './loans.js';
import { PROPERTY_TYPES, PROPERTY_BY_ID, STREETS, MORTGAGE, SELLING_FEE, BUYING_FEE, FOREIGN_BUYER_FEE } from '../data/properties.js';
import { rate, fmt, quoteForeign, payForeign, receiveForeign, atHome, payIn, convert } from './currency.js';

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
/** What a property is worth in the money of the country it stands in. */
function nativeWorth(typeId, quality, condition, city, countryId) {
  const at = COUNTRIES[countryId] ?? country();
  const type = PROPERTY_BY_ID[typeId];
  return Math.round(type.price * at.currency.scale * (at.living?.costK ?? 1) * housingIndex(at.id) * housingK(city ?? '', at.id) * quality * (0.6 + 0.4 * condition / 100));
}
/**
 * What a property is worth in the player's everyday money. A property abroad
 * is valued where it stands and brought home at today's rate, so its worth
 * moves with the currency as well as with the market.
 */
function worth(typeId, quality, condition, city = player().city, countryId = player().countryId) {
  const at = COUNTRIES[countryId] ?? country();
  const native = nativeWorth(typeId, quality, condition, city, at.id);
  return at.id === player().countryId ? native : Math.round(native * rate(at.currency.code, country().currency.code));
}
/** The currency of the country a property stands in. */
export const currencyOfProperty = (a) => placeOf(a).currency.code;
/** What is left on a property's mortgage, in everyday money at today's rate. A mortgage is held in the currency it was taken out in. */
export const owedOn = (a) => (a.mortgage ? atHome(a.mortgage.principal, a.mortgage.code) : 0);
/** A tenant's yearly rent, in everyday money. Rent is paid in the money of the place. */
export const rentAtHome = (a) => (a.tenant ? atHome(a.tenant.rent, a.tenant.code) : 0);

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

// ---------- Buying in another country ----------

/**
 * This year's listings in a city abroad, priced in that country's money.
 * @returns {{id, typeId, name, condition, quality, state, price:number, fees:number, code:string, quote:object}[]}
 */
export function listingsAbroad(countryId, city) {
  const p = player();
  const at = COUNTRIES[countryId];
  const m = market();
  const key = `${countryId}/${city}`;
  if (m.abroad?.age !== p.age || m.abroad.key !== key) {
    const list = [];
    const streets = [...STREETS];
    for (let i = 0; i < 6; i++) {
      const type = i < PROPERTY_TYPES.length && rng.chance(0.75) ? PROPERTY_TYPES[i] : rng.pick(PROPERTY_TYPES);
      const condition = rng.int(25, 100);
      const quality = rng.around(1, 0.14);
      const street = streets.splice(rng.int(0, streets.length - 1), 1)[0];
      list.push({ id: uid('lst'), typeId: type.id, name: `${type.name} on ${street}`, condition, quality, price: nativeWorth(type.id, quality, condition, city, countryId) });
    }
    m.abroad = { age: p.age, key, countryId, city, property: list.sort((a, b) => a.price - b.price) };
  }
  const code = at.currency.code;
  return m.abroad.property.map((l) => { const fees = Math.round(l.price * (BUYING_FEE + FOREIGN_BUYER_FEE)); return { ...l, state: describe(l.condition), fees, code, quote: quoteForeign(code, l.price + fees) }; });
}

/**
 * Buys a listing abroad, outright: lenders there do not lend to someone who
 * does not live there. Paid from the account in that currency first, then
 * from everyday money at today's rate.
 */
export function buyAbroad(listingId) {
  const p = player();
  const c = country();
  const m = market().abroad;
  const l = m?.property.find((x) => x.id === listingId);
  if (!l) return result(false, 'That one has gone.', 'neutral');
  if (p.age < 18) return result(false, 'You need to be 18 to buy property.', 'neutral');
  const at = COUNTRIES[m.countryId];
  const code = at.currency.code;
  const fees = Math.round(l.price * (BUYING_FEE + FOREIGN_BUYER_FEE));
  const q = payForeign(code, l.price + fees, `the ${lower(l.name)} in ${m.city}`);
  if (!q) return result(false, 'You do not have enough, in either currency, for the price and the fees.', 'neutral');
  const value = Math.round(l.price * rate(code, c.currency.code));
  const first = !properties().length && !p.flags.ownedProperty;
  p.assets.push({ id: uid('asset'), kind: 'property', catalogId: l.typeId, name: l.name, purchasePrice: value, value, boughtAtAge: p.age,
    condition: l.condition, quality: l.quality, mortgage: null, tenant: null, countryId: at.id, city: m.city, paidNative: l.price, paidCode: code });
  p.flags.ownedProperty = true;
  m.property = m.property.filter((x) => x.id !== listingId);
  const how = [q.fromAccount ? `${fmt(q.fromAccount, code)} from your ${code} account` : '', q.fromCash ? `${fmtMoney(q.fromCash, c)} changed at today's rate${q.fee ? ` (the bank kept ${fmtMoney(q.fee, c)})` : ''}` : ''].filter(Boolean).join(' and ');
  const text = `You bought the ${lower(l.name)} in ${m.city}, ${theCountry(at.name)}, for ${fmt(l.price, code)} plus ${fmt(fees, code)} in fees, paid with ${how}. It is taxed there, and what it is worth to you will move with the ${code}.`;
  log(text, 'system', 'good');
  if (first) milestone(`Bought a first property: the ${lower(l.name)}, in ${theCountry(at.name)}.`, 'money');
  return result(true, text);
}

/**
 * What a lender would do for this price.
 * @returns {{minDeposit:number, maxLoan:number, years:number, rate:number, available:boolean, reason:string}}
 */
export function mortgageTerms(price) {
  const p = player();
  const owed = properties().reduce((s, a) => s + owedOn(a), 0);
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
    mortgage = { principal: loan, rate: t.rate, yearsLeft: t.years, payment: yearlyPayment(loan, t.rate, t.years), code: c.currency.code };
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
  if (a.city && a.city !== p.city && country().cities.includes(a.city)) return result(false, `It is in ${a.city}. You would have to move there to live in it.`, 'neutral');
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
  a.value = worth(a.catalogId, a.quality, a.condition, a.city ?? undefined, a.countryId ?? undefined);
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
  const code = currencyOfProperty(a);
  const yearly = Math.round(rentFor(a) * rng.around(1, 0.08));
  a.tenant = { rent: code === country().currency.code ? yearly : convert(yearly, country().currency.code, code), code, quality: rng.int(15, 100), sinceAge: p.age };
  const text = `You found a tenant for the ${lower(a.name)} at ${code === country().currency.code ? fmtMoney(yearly, country()) : `${fmt(a.tenant.rent, code)} (about ${fmtMoney(yearly, country())})`} a year.`;
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
  player().flags.rentalSince = store.state.year; // a new tenancy, and a new landlord's rules about animals
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
  const code = a.mortgage.code ?? country().currency.code;
  if (!quoteForeign(code, a.mortgage.principal).ok) return result(false, 'You do not have enough to clear it.', 'neutral');
  const paid = payIn(code, a.mortgage.principal, `the mortgage on the ${lower(a.name)}`);
  const text = `You paid off the mortgage on the ${lower(a.name)}: ${code === country().currency.code ? fmtMoney(paid, country()) : `${fmt(a.mortgage.principal, code)}, which cost ${fmtMoney(paid, country())}`}. It is yours outright.`;
  a.mortgage = null;
  log(text, 'system', 'good');
  milestone('Paid off a mortgage.', 'money');
  return result(true, text);
}

/** What selling would leave in the player's hands after fees and the mortgage. */
export const saleProceeds = (a, discount = 1) =>
  Math.round(a.value * discount * (1 - SELLING_FEE) - owedOn(a));

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
  const away = isAbroad(a) ? currencyOfProperty(a) : null;
  // A sale abroad is paid in the money of the place, into the account in that currency.
  const paid = away ? receiveForeign(away, raised * rate(c.currency.code, away)) : 0;
  if (!away) p.finance.cash += raised;
  const gain = a.value - a.purchasePrice;
  const wasHome = p.homeId === id;
  remove(a);
  const text = `You sold the ${lower(a.name)} for ${fmtMoney(a.value, c)}, ${gain >= 0 ? `${fmtMoney(gain, c)} more` : `${fmtMoney(-gain, c)} less`} than you paid. After fees${a.mortgage ? ' and the mortgage' : ''} you kept ${fmtMoney(raised, c)}.${wasHome ? ' You are renting again.' : ''}`;
  const text2 = away ? `${text} It was paid in ${away}: ${fmt(paid, away)} is in your ${away} account.` : text;
  log(text2, 'system', gain >= 0 ? 'good' : 'bad');
  return result(true, text2, gain >= 0 ? 'good' : 'neutral');
}

/** A forced sale goes cheap. Used when debts are called in. */
export function repossess(a) {
  const raised = saleProceeds(a, 0.85);
  player().finance.cash += raised;
  remove(a);
  return Math.round(a.value * 0.85);
}

/** Changes a property from an event: which is 'home', 'rental' or 'any'. */
/** Damage to one particular property (storms, earthquakes, war). */
export function damageProperty(a, amount) {
  a.condition = clamp(a.condition - amount);
  a.value = worth(a.catalogId, a.quality, a.condition, a.city ?? undefined, a.countryId ?? undefined);
}

export function hitProperty(which, { condition = 0, evict: out = false } = {}) {
  const list = properties();
  const a = which === 'home' ? home() : which === 'rental' ? list.find((x) => x.tenant) : home() ?? list[0];
  if (!a) return;
  a.condition = clamp(a.condition + condition);
  if (out) a.tenant = null;
  a.value = worth(a.catalogId, a.quality, a.condition, a.city ?? undefined, a.countryId ?? undefined);
}

/** Yearly: wear, value, upkeep, mortgage payments, and rent from tenants. */
export function tickProperties() {
  const p = player();
  const c = country();
  const f = p.finance;
  let rent = 0;
  let taxPaid = 0;
  let rentTax = 0;
  let rentAbroad = 0;
  let taxAbroad = 0;
  for (const a of properties()) {
    const type = PROPERTY_BY_ID[a.catalogId];
    const hard = a.tenant && a.tenant.quality < 35;
    a.condition = clamp(a.condition - rng.int(0, 2) - (hard ? rng.int(1, 4) : 0));
    a.value = worth(a.catalogId, a.quality, a.condition, a.city ?? undefined, a.countryId ?? undefined);
    const code = currencyOfProperty(a);
    const local = (n) => (code === c.currency.code ? n : convert(n, c.currency.code, code));
    payIn(code, local(Math.round(a.value * type.upkeep)), `upkeep on the ${lower(a.name)}`);
    const due = propertyTaxOn(a);
    if (due) { payIn(code, local(due), `property tax on the ${lower(a.name)}`); f.lifetimeTaxPaid += due; taxPaid += due; }

    if (a.mortgage) {
      const m = a.mortgage;
      m.code ??= c.currency.code; // older saves: a mortgage was always in everyday money
      const interest = Math.round(m.principal * m.rate);
      const pay = Math.min(m.payment, m.principal + interest);
      payIn(m.code, pay, `the mortgage on the ${lower(a.name)}`);
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
        t.code ??= c.currency.code; // older saves: rent was always in everyday money
        const tax = Math.round(t.rent * placeOf(a).incomeTax); // taxed where the property is, in its money
        if (t.code === c.currency.code) { rent += t.rent; rentTax += tax; } else {
          receiveForeign(t.code, t.rent - tax);
          rentAbroad += atHome(t.rent, t.code); taxAbroad += atHome(tax, t.code);
        }
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
    const tax = rentTax;
    f.cash += rent - tax;
    f.lifetimeEarned += rent;
    f.lifetimeTaxPaid += tax;
    log(`Your tenants paid ${fmtMoney(rent, c)} in rent. You paid ${fmtMoney(tax, c)} tax on it.`, 'system', 'good');
  }
  if (rentAbroad) {
    f.lifetimeEarned += rentAbroad;
    f.lifetimeTaxPaid += taxAbroad;
    log(`Rent from your property abroad came to about ${fmtMoney(rentAbroad, c)}, paid into your account there after ${fmtMoney(taxAbroad, c)} of local tax.`, 'system', 'good');
  }
  const h = home();
  if (h) p.stats.mood = clamp(p.stats.mood + Math.round(PROPERTY_BY_ID[h.catalogId].comfort / 3));
}

export { describe as conditionWord };
export const propertyTypeOf = (a) => PROPERTY_BY_ID[a.catalogId];
export const housingMove = () => store.state.market.housingMove ?? 0;
