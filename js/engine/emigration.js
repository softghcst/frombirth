// Emigrating: applying to move, selling up, converting everything into the
// new currency, and who comes with you.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, theCountry } from '../util.js';
import { store, player, country, livingNpcs, log, milestone } from '../state.js';
import { COUNTRIES, COUNTRY_LIST } from '../data/countries.js';
import { quitCareer } from './career.js';
import { leaveForPrison } from './education.js';
import { sellProperty, properties } from './realEstate.js';
import { sellVehicle, vehicles } from './vehicles.js';
import { market, priceOf } from './market.js';
import { EMIGRATION } from '../data/activities.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

export const canEmigrate = () => {
  const p = player();
  return p.age >= EMIGRATION.minAge && !p.legal.incarceration && !p.legal.pending && !p.flags.fugitive;
};
export const emigrationFee = () => localMoney(EMIGRATION.fee, country());

/** How likely a country is to let the player in. */
function visaChance() {
  const p = player();
  const has = (t) => p.education.degrees.some((d) => d.type === t);
  let chance = 0.45;
  if (has('university')) chance += 0.2;
  if (has('medical') || has('law') || has('graduate')) chance += 0.1;
  if (has('apprenticeship') || has('cosmetology')) chance += 0.1;
  if (p.career.careerId) chance += 0.1;
  if (p.legal.record.some((r) => r.convicted && !r.juvenile)) chance -= 0.4;
  return clamp(chance, 0.05, 0.95);
}

/** Countries the player could move to, with how the move looks. */
export function destinations() {
  const here = player().countryId;
  const chance = visaChance();
  return COUNTRY_LIST.filter((c) => c.id !== here).map((c) => ({ id: c.id, name: c.name, flag: c.flag,
    currency: c.currency.code, incomeTax: c.incomeTax, freeHealthcare: c.freeHealthcare,
    outlook: chance >= 0.7 ? 'Your application looks strong.' : chance >= 0.4 ? 'Your application could go either way.' : 'Your record makes this a long shot.' }));
}

/** People who would come: a spouse, a committed partner, children at home, and pets. */
export function household() {
  return livingNpcs().filter((n) => n.role === 'spouse' || n.role === 'pet' || (n.role === 'child' && n.age < 18)
    || (n.role === 'partner' && (n.flags.livesTogether || n.flags.engaged || n.meters.relationship >= 75)));
}

/** Multiplies every stored amount of money by the exchange rate. */
function convert(rate) {
  const p = player();
  const f = p.finance;
  const x = (n) => Math.round((n ?? 0) * rate);
  f.cash = x(f.cash);
  f.pension = x(f.pension);
  f.lifetimeEarned = x(f.lifetimeEarned);
  f.lifetimeTaxPaid = x(f.lifetimeTaxPaid);
  for (const l of f.loans) l.principal = x(l.principal);
  p.career.pensionPerYear = x(p.career.pensionPerYear);
  for (const a of p.assets) { a.purchasePrice = x(a.purchasePrice); if (a.costBasis != null) a.costBasis = x(a.costBasis); }
  for (const n of Object.values(store.state.npcs)) {
    if (n.savings != null) n.savings = x(n.savings);
    if (n.income != null) n.income = x(n.income);
    if (n.life) {
      n.life.savings = x(n.life.savings);
      if (n.life.pension) n.life.pension = x(n.life.pension);
      if (n.life.job) n.life.job.salary = x(n.life.job.salary);
    }
  }
}

/**
 * Applies to move. One application a year. On success the move happens at once.
 */
export function emigrate(countryId) {
  const p = player();
  const from = country();
  const to = COUNTRIES[countryId];
  const fee = emigrationFee();
  if (!canEmigrate() || !to || to.id === from.id) return result(false, 'You cannot move there now.', 'neutral');
  if (p.flags.visaAge === p.age) return result(false, 'You have already applied this year. Try again next year.', 'neutral');
  if (p.finance.cash < fee) return result(false, `Visas, lawyers and shipping come to ${fmtMoney(fee, from)}. You do not have it.`, 'neutral');
  p.flags.visaAge = p.age;
  p.finance.cash -= Math.round(fee * 0.2); // the application fee is gone either way
  if (!rng.chance(visaChance())) {
    const text = `${theCountry(to.name).replace(/^the/, 'The')} turned down your visa application. You can apply again next year.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  p.finance.cash -= Math.round(fee * 0.8);

  // Sell up, leave work and study, and say goodbye.
  for (const a of [...properties()]) sellProperty(a.id);
  for (const a of [...vehicles()]) sellVehicle(a.id);
  if (p.career.careerId) quitCareer();
  if (p.career.partTime) p.career.partTime = null;
  leaveForPrison();
  const coming = new Set(household().map((n) => n.id));
  for (const n of livingNpcs()) {
    if (coming.has(n.id)) continue;
    if (n.role === 'partner') {
      n.role = 'ex';
      log(`${n.firstName} would not come with you. It is over.`, 'system', 'bad');
    } else if (['boss', 'coworker', 'classmate'].includes(n.role)) {
      p.npcIds = p.npcIds.filter((id) => id !== n.id);
      delete store.state.npcs[n.id];
    } else {
      if (n.flags.abroad === to.id) { n.flags.abroad = false; continue; }
      if (n.flags.abroad) continue;
      n.flags.abroad = from.id;
      n.meters.relationship = clamp(n.meters.relationship - 5);
    }
  }

  convert(to.currency.scale / from.currency.scale);
  p.countryId = to.id;
  p.city = rng.pick(to.cities);
  p.homeId = null;
  p.flags.livesWithParents = false;
  p.flags.emigratedAge = p.age;
  p.counters.countriesLived += 1;
  market().listings = null;
  for (const a of p.assets.filter((x) => x.kind === 'security')) a.value = priceOf(a.catalogId);
  p.stats.mood = clamp(p.stats.mood + 4);

  const who = [...coming].map((id) => store.state.npcs[id].firstName);
  const text = `Your visa came through. You sold up and moved to ${p.city}, ${theCountry(to.name)}${who.length ? `, with ${who.join(', ').replace(/, ([^,]*)$/, ' and $1')}` : ''}. Your money is now in ${to.currency.code}, and everything has to be started again.`;
  log(text, 'system', 'good');
  milestone(`Emigrated from ${theCountry(from.name)} to ${theCountry(to.name)}.`, 'life');
  return result(true, text);
}
