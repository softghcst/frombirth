// Emigrating: applying to move, selling up, converting everything into the
// new currency, and who comes with you.
import { visaEdge, fluency } from './languages.js';
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
import { mayLeave } from './living.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

export const canEmigrate = () => {
  const p = player();
  return p.age >= EMIGRATION.minAge && !p.legal.incarceration && !p.legal.pending && !p.flags.fugitive;
};
export const emigrationFee = () => localMoney(EMIGRATION.fee, country());

/** How likely a country is to let the player in. */
function visaChance(countryId) {
  const p = player();
  const has = (t) => p.education.degrees.some((d) => d.type === t);
  let chance = 0.45;
  if (has('university')) chance += 0.2;
  if (has('medical') || has('law') || has('graduate')) chance += 0.1;
  if (has('apprenticeship') || has('cosmetology')) chance += 0.1;
  if (p.career.careerId) chance += 0.1;
  if (p.legal.record.some((r) => r.convicted && !r.juvenile)) chance -= 0.4;
  if (countryId) chance += visaEdge(countryId, p); // speaking the language counts
  if (countryId && (p.flags.studiedIn ?? []).includes(countryId)) chance += 0.1; // and so does having lived there as a student
  return clamp(chance, 0.05, 0.95);
}

/** Countries the player could move to, with how the move looks. */
export function destinations() {
  const p = player();
  const kin = (id) => livingNpcs().filter((n) => n.flags.abroad === id).length;
  return COUNTRY_LIST.filter((c) => c.id !== p.countryId).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name, flag: c.flag,
    currency: c.currency.code, incomeTax: c.incomeTax, propertyTax: c.propertyTax, freeHealthcare: c.freeHealthcare,
    living: c.living, family: kin(c.id), ownsHome: properties().some((a) => a.countryId === c.id),
    language: fluency(c.id, p),
    outlook: visaChance(c.id) >= 0.7 ? 'Your application looks strong.' : visaChance(c.id) >= 0.4 ? 'Your application could go either way.' : 'This is a long shot.' }));
}

/** People who come without being asked: a spouse, a committed partner, children at home, and pets. */
const comesAnyway = (n) => n.role === 'spouse' || n.role === 'pet' || (n.role === 'child' && n.age < 18)
  || (n.role === 'partner' && (n.flags.livesTogether || n.flags.engaged || n.meters.relationship >= 75));

/** Everyone who would make the move: the household, plus anyone who has agreed to come this year. */
export function household() {
  const p = player();
  return livingNpcs().filter((n) => comesAnyway(n) || n.flags.willComeAge === p.age);
}

/** Relatives who usually stay behind but can be asked: parents, grandparents, grown children, siblings. */
export function askable() {
  const p = player();
  return livingNpcs().filter((n) => !comesAnyway(n) && !n.flags.abroad
    && (['parent', 'grandparent', 'sibling'].includes(n.role) || (n.role === 'child' && n.age >= 18)))
    .map((n) => ({ npc: n, asked: n.flags.askedToComeAge === p.age, coming: n.flags.willComeAge === p.age }));
}

/** Asks one relative to come too. Most say no: they have lives of their own. Once a year each. */
export function askToCome(npcId) {
  const p = player();
  const n = store.state.npcs[npcId];
  if (!n?.alive || n.flags.askedToComeAge === p.age) return result(false, 'You have already had that conversation this year.', 'neutral');
  n.flags.askedToComeAge = p.age;
  const settled = n.life?.job || n.life?.partnerId || n.life?.kids;
  let chance = { parent: 0.12, grandparent: 0.05, child: 0.12, sibling: 0.08 }[n.role] ?? 0.08;
  chance += (n.meters.relationship - 60) / 250;
  if (settled) chance -= 0.1;
  if (n.role === 'parent' && !livingNpcs().some((x) => x.role === 'parent' && x.id !== n.id)) chance += 0.15; // on their own
  if (rng.chance(clamp(chance, 0.02, 0.75))) {
    n.flags.willComeAge = p.age;
    n.meters.relationship = clamp(n.meters.relationship + 5);
    const text = `${n.firstName} thinks about it for a week, then says yes. If the visa comes through, they are coming with you.`;
    log(text, 'system', 'good');
    return result(true, text);
  }
  const text = `${n.firstName} says no. ${n.role === 'grandparent' ? 'They are too old to start again somewhere new.' : settled ? 'Their life is here.' : 'This is home, and they are staying.'}`;
  log(text);
  return result(false, text, 'neutral');
}

/** What it costs to ship one vehicle, in base units. */
const SHIPPING = { cycle: 150, bike: 900, car: 2500, boat: 6000, plane: 4000 };
/** The cost of bringing every vehicle along, in local money. */
export const shippingCost = () => vehicles().reduce((s, a) => s + localMoney(SHIPPING[a.vehicleClass] ?? 2000, country()), 0);

/** Multiplies every stored amount of money by the exchange rate. */
export function convertMoney(rate) {
  const p = player();
  const f = p.finance;
  const x = (n) => Math.round((n ?? 0) * rate);
  f.cash = x(f.cash);
  f.pension = x(f.pension);
  f.lifetimeEarned = x(f.lifetimeEarned);
  f.lifetimeTaxPaid = x(f.lifetimeTaxPaid);
  for (const l of f.loans) l.principal = x(l.principal);
  p.career.pensionPerYear = x(p.career.pensionPerYear);
  for (const a of p.assets) {
    a.purchasePrice = x(a.purchasePrice);
    if (a.costBasis != null) a.costBasis = x(a.costBasis);
    if (a.kind !== 'security') a.value = x(a.value);
    if (a.mortgage) { a.mortgage.principal = x(a.mortgage.principal); a.mortgage.payment = x(a.mortgage.payment); }
    if (a.tenant) a.tenant.rent = x(a.tenant.rent);
  }
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
 * Property is kept (it can be sold or let from anywhere, and lived in again
 * if the player moves back). Vehicles are shipped, or sold if the player prefers.
 * @param {string} countryId
 * @param {{shipVehicles?:boolean}} [opts]
 */
export function emigrate(countryId, opts = {}) {
  const p = player();
  const from = country();
  const to = COUNTRIES[countryId];
  const ship = opts.shipVehicles !== false;
  const shipping = ship ? shippingCost() : 0;
  const fee = emigrationFee();
  // `forced` is exile: no application, no fee, no waiting.
  if (!to || to.id === from.id) return result(false, 'You cannot move there now.', 'neutral');
  if (!opts.forced) {
    if (!canEmigrate()) return result(false, 'You cannot move there now.', 'neutral');
    if (!mayLeave().ok) return result(false, mayLeave().reason, 'neutral');
    if (p.flags.visaAge === p.age) return result(false, 'You have already applied this year. Try again next year.', 'neutral');
    if (p.finance.cash < fee + shipping) return result(false, `Visas, lawyers and shipping come to ${fmtMoney(fee + shipping, from)}. You do not have it.`, 'neutral');
    p.flags.visaAge = p.age;
    p.finance.cash -= Math.round(fee * 0.2); // the application fee is gone either way
    if (!rng.chance(visaChance(to.id))) {
      const text = `${theCountry(to.name).replace(/^the/, 'The')} turned down your visa application. You can apply again next year.`;
      log(text, 'system', 'bad');
      return result(false, text);
    }
    p.finance.cash -= Math.round(fee * 0.8) + shipping;
  }

  // Leave work and study. The house stays where it is; the vehicles follow, or are sold.
  const kept = properties();
  for (const a of kept) a.countryId ??= from.id;
  const shipped = ship ? vehicles().length : 0;
  if (!ship) for (const a of [...vehicles()]) sellVehicle(a.id);
  if (p.career.careerId) quitCareer();
  if (p.career.partTime) p.career.partTime = null;
  leaveForPrison();
  const coming = new Set(household().map((n) => n.id));
  for (const n of livingNpcs()) {
    if (coming.has(n.id)) { if (n.flags.abroad === to.id) n.flags.abroad = false; continue; }
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

  convertMoney(to.currency.scale / from.currency.scale);
  // Those who came will be paid at the new country's level from now on.
  for (const id of coming) { const job = store.state.npcs[id].life?.job; if (job) job.salary = Math.round(job.salary * to.living.wageK / from.living.wageK); }
  p.countryId = to.id;
  p.flags.arrivedYear = store.state.year; // newcomers wait five years before they can vote
  p.city = rng.pick(to.cities);
  p.homeId = null;
  p.flags.livesWithParents = false;
  p.flags.emigratedAge = p.age;
  p.counters.countriesLived += 1;
  stamp(to.id, 'moved');
  market().listings = null;
  for (const a of p.assets.filter((x) => x.kind === 'security')) a.value = priceOf(a.catalogId);
  p.stats.mood = clamp(p.stats.mood + 4);

  const who = [...coming].map((id) => store.state.npcs[id].firstName);
  const back = kept.filter((a) => a.countryId === to.id).length;
  const left = kept.length - back;
  const text = `Your visa came through. You moved to ${p.city}, ${theCountry(to.name)}${who.length ? `, with ${who.join(', ').replace(/, ([^,]*)$/, ' and $1')}` : ''}. `
    + `${shipped ? `Your ${shipped === 1 ? 'vehicle is' : `${shipped} vehicles are`} on a ship behind you. ` : ''}`
    + `${left ? `You still own ${left === 1 ? 'your property' : `${left} properties`} in ${theCountry(from.name)}: let it, sell it, or stay there when you visit. ` : ''}`
    + `${back ? 'You own a home here already, and can move straight in. ' : ''}`
    + `Your money is now in ${to.currency.code}.`;
  log(text, 'system', 'good');
  milestone(`Emigrated from ${theCountry(from.name)} to ${theCountry(to.name)}.`, 'life');
  return result(true, text);
}

// ---------- The passport ----------

/** Records a country in the player's passport: 'born', 'moved' or 'visit'. */
export function stamp(countryId, kind) {
  const p = player();
  const book = p.flags.passport ?? (p.flags.passport = []);
  if (kind === 'visit' && book.some((s) => s.id === countryId && s.kind === 'visit' && s.age === p.age)) return;
  book.push({ id: countryId, kind, age: p.age, year: store.state.year });
}

/**
 * Every country the player has been in, in order, with what they did there.
 * @returns {{countries:{id, name, flag, born:boolean, lived:boolean, lives:boolean, visits:number, first:{age,year}}[], total:number}}
 */
export function passport() {
  const p = player();
  const book = [{ id: p.birthCountryId, kind: 'born', age: 0, year: p.birthYear },
    // Trips taken before the passport was kept are known only by country.
    ...(p.flags.visited ?? []).filter((id) => !(p.flags.passport ?? []).some((s) => s.id === id)).map((id) => ({ id, kind: 'visit', age: null, year: null })),
    ...(p.flags.passport ?? [])];
  if (!book.some((s) => s.id === p.countryId)) book.push({ id: p.countryId, kind: 'moved', age: p.flags.emigratedAge ?? null, year: null });
  const by = new Map();
  for (const s of book) {
    const c = COUNTRIES[s.id];
    if (!c) continue;
    const e = by.get(s.id) ?? { id: c.id, name: c.name, flag: c.flag, born: false, lived: false, lives: c.id === p.countryId, visits: 0, first: { age: s.age, year: s.year } };
    if (s.kind === 'born') e.born = e.lived = true;
    if (s.kind === 'moved') e.lived = true;
    if (s.kind === 'visit') e.visits += 1;
    by.set(s.id, e);
  }
  return { countries: [...by.values()], total: COUNTRY_LIST.length };
}
