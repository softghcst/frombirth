// Emigrating: applying to move, selling up, converting everything into the
// new currency, and who comes with you.
import { forgetNpc } from './digital/core.js';
import { rightToLive, held, settle } from './citizenship.js';
import { onEmigrate as leaveBusinesses } from './business.js';
import { rate, setAside, absorb } from './currency.js';
import { fluency } from './languages.js';
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, theCountry, uid } from '../util.js';
import { store, player, country, livingNpcs, log, milestone, prunePending } from '../state.js';
import { COUNTRIES, COUNTRY_LIST } from '../data/countries.js';
import { quitCareer, hire, unmet } from './career.js';
import { CAREERS, CAREER_BY_ID } from '../data/careers.js';
import { leaveForPrison } from './education.js';
import { sellProperty, properties } from './realEstate.js';
import { sellVehicle, vehicles } from './vehicles.js';
import { market, priceOf } from './market.js';
import { EMIGRATION } from '../data/activities.js';
import { mayLeave } from './living.js';
import { book } from './ledger.js';
import { routes, bestRoute, spouseAnswer, settleFamily } from './immigration.js';
import { livesWithPlayer, reconcile as reconcileAnimals } from './animals.js';
import { travelPlan, prepareMove } from './animalCare.js';
import { charge, recordEvent, archiveIdOf, rememberHome } from './chronicle.js';
import { placeName } from './geo.js';
import { syncNpcPlaces } from './globalLife.js';
import { cancel as cancelTrip } from './travel.js';
import { childrenStaying, afterMove } from './familyMove.js';

export { routes };
export { travelPlan };

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

export const canEmigrate = () => {
  const p = player();
  return p.age >= EMIGRATION.minAge && !p.legal.incarceration && !p.legal.pending && !p.flags.fugitive;
};
/** The cost of an ordinary application. Each route has its own (immigration.routes). */
export const emigrationFee = () => localMoney(EMIGRATION.fee, country());

// Who may live where as of right, and what nationality anyone holds, is engine/citizenship.js.
export { rightToLive, held as nationalities };

/** Countries the player could move to, with how the move looks. */
export function destinations() {
  const p = player();
  const kin = (id) => livingNpcs().filter((n) => n.flags.abroad === id).length;
  return COUNTRY_LIST.filter((c) => c.id !== p.countryId).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name, flag: c.flag,
    currency: c.currency.code, incomeTax: c.incomeTax, propertyTax: c.propertyTax, freeHealthcare: c.freeHealthcare,
    living: c.living, family: kin(c.id), ownsHome: properties().some((a) => a.countryId === c.id),
    language: fluency(c.id, p),
    right: rightToLive(c.id, p),
    route: bestRoute(c.id)?.name ?? null,
    outlook: rightToLive(c.id, p) ? 'You are a citizen: no visa is needed.' : bestRoute(c.id)?.outlook ?? 'No route is open to you.' }));
}

/** People who come without being asked: a spouse, a committed partner, children at home, and the animals of the player's own household. */
const comesAnyway = (n) => n.role === 'spouse' || (n.role === 'pet' && livesWithPlayer(n.id)) || (n.role === 'child' && n.age < 18)
  || (n.role === 'partner' && (n.flags.livesTogether || n.flags.engaged || n.meters.relationship >= 75));

/**
 * Everyone who would make the move: the household, plus anyone who has agreed to come this year.
 * Given a destination, a husband or wife makes up their own mind (immigration.spouseAnswer).
 */
export function household(destId) {
  const p = player();
  return livingNpcs().filter((n) => (comesAnyway(n) && !(destId && n.role === 'spouse' && !n.flags.abroad && !spouseAnswer(n, destId))) || n.flags.willComeAge === p.age);
}
/** A husband or wife who has decided not to come. */
export const stayingBehind = (destId) => livingNpcs().filter((n) => n.role === 'spouse' && !n.flags.abroad && !spouseAnswer(n, destId));

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
  for (const k of f.cards ?? []) { k.limit = x(k.limit); k.balance = x(k.balance); k.statements = []; }
  for (const l of f.lent ?? []) { l.amount = x(l.amount); l.left = x(l.left); }
  for (const pol of f.policies ?? []) { pol.premium = x(pol.premium); pol.excess = x(pol.excess); pol.cover = x(pol.cover); }
  p.career.pensionPerYear = x(p.career.pensionPerYear);
  if (p.flags.statePension) p.flags.statePension = null; // a state pension is paid by the country you live in: it is worked out again there
  for (const s of f.support ?? []) s.amount = x(s.amount);
  for (const a of p.assets) {
    a.purchasePrice = x(a.purchasePrice);
    if (a.costBasis != null) a.costBasis = x(a.costBasis);
    if (a.kind !== 'security') a.value = x(a.value);
    // A mortgage and a tenancy are in the money they were agreed in (they are given a currency before the move).
    if (a.mortgage && !a.mortgage.code) { a.mortgage.principal = x(a.mortgage.principal); a.mortgage.payment = x(a.mortgage.payment); }
    if (a.tenant && !a.tenant.code) a.tenant.rent = x(a.tenant.rent);
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
 * @param {{shipVehicles?:boolean, keep?:number, route?:string, city?:string, forced?:boolean, family?:boolean, animals?:'bring'|'leave', grant?:object, reason?:string}} [opts]
 *   family: a child's family is moving (use with forced)  route: an id from immigration.routes()
 *   grant: an approved relocation case (engine/relocation.js): the decision is already made and part of the fee paid
 */
export function emigrate(countryId, opts = {}) {
  const p = player();
  const from = country();
  const to = COUNTRIES[countryId];
  const ship = opts.shipVehicles !== false;
  const shipping = ship ? shippingCost() : 0;
  // Animals that come need papers and a way to travel. Those left behind are found homes (opts.animals: 'bring' | 'leave').
  const pets = opts.forced || opts.animals === 'leave' ? 0 : travelPlan(countryId).reduce((s, t) => s + t.cost, 0);
  // `route` is how the player is applying; without one, as a citizen where possible, otherwise the settlement programme.
  const open = opts.forced ? [] : routes(countryId);
  const found = opts.forced ? null : open.find((r) => r.id === opts.route) ?? (opts.route ? null : open.find((r) => r.eligible && ['right', 'free'].includes(r.id)) ?? open.find((r) => r.id === 'settle'));
  // A case decided earlier keeps the status it was granted, whatever the routes look like today.
  const route = opts.grant ? { ...(found ?? {}), id: opts.grant.routeId, name: opts.grant.routeName, status: opts.grant.status_on_arrival, years: opts.grant.years } : found;
  const fee = opts.grant ? opts.grant.remaining ?? 0 : route ? route.fee : 0;
  const moveId = opts.grant?.id ?? uid('move');
  // `forced` is exile: no application, no fee, no waiting.
  if (!to || to.id === from.id) return result(false, 'You cannot move there now.', 'neutral');
  if (opts.grant) {
    // The application was decided earlier (engine/relocation.js). What is left is paying for the grant, the shipping and the animals.
    if (!canEmigrate()) return result(false, 'You cannot move there now.', 'neutral');
    if (!mayLeave().ok) return result(false, mayLeave().reason, 'neutral');
    if (p.finance.cash < fee + shipping + pets) return result(false, `The visa, shipping and the animals' travel come to ${fmtMoney(fee + shipping + pets, from)}. You do not have it.`, 'neutral');
    if (fee) charge({ amount: fee, kind: 'relocation', memo: `The rest of the visa fee: ${to.name}`, key: `move:${moveId}:grant`, ref: { moveId } });
    if (shipping) charge({ amount: shipping, kind: 'relocation', memo: 'Shipping vehicles', key: `move:${moveId}:ship`, ref: { moveId } });
  } else if (!opts.forced) {
    if (!canEmigrate()) return result(false, 'You cannot move there now.', 'neutral');
    if (!mayLeave().ok) return result(false, mayLeave().reason, 'neutral');
    if (!route?.eligible) return result(false, route?.why || 'That route is not open to you.', 'neutral');
    if (p.flags.visaAge === p.age) return result(false, 'You have already applied this year. Try again next year.', 'neutral');
    if (p.finance.cash < fee + shipping + pets) return result(false, `Visas, lawyers, shipping and the animals' travel come to ${fmtMoney(fee + shipping + pets, from)}. You do not have it.`, 'neutral');
    p.flags.visaAge = p.age;
    // The application fee is gone either way.
    charge({ amount: Math.round(fee * 0.2), kind: 'visa_fee', memo: `Application to move to ${to.name}`, key: `move:${moveId}:apply`, ref: { moveId } });
    if (!rng.chance(route.chance)) {
      const text = `${theCountry(to.name).replace(/^the/, 'The')} turned down your ${{ work: 'work visa', study: 'student visa', family: 'family visa', invest: 'investor visa', protection: 'claim for protection' }[route.id] ?? 'visa application'}. You can apply again next year.`;
      log(text, 'system', 'bad');
      return result(false, text);
    }
    charge({ amount: Math.round(fee * 0.8), kind: 'relocation', memo: `Visa granted: ${to.name}`, key: `move:${moveId}:grant`, ref: { moveId } });
    if (shipping) charge({ amount: shipping, kind: 'relocation', memo: 'Shipping vehicles', key: `move:${moveId}:ship`, ref: { moveId } });
  }

  const animals = prepareMove(countryId, opts.animals ?? 'bring', undefined, !!opts.forced);
  // Leave work and study. The house stays where it is; the vehicles follow, or are sold.
  const kept = properties();
  for (const a of kept) a.countryId ??= from.id;
  const homeBefore = p.homeId;
  for (const a of kept) rememberHome(a, p);
  const shipped = ship ? vehicles().length : 0;
  if (!ship) for (const a of [...vehicles()]) sellVehicle(a.id);
  const field = p.career.careerId ?? p.career.lastField; // what a sponsoring employer would hire them for
  const rung = p.career.careerId ? p.career.level : Math.max(0, (p.career.lastLevel ?? 0) - 1);
  if (p.career.careerId) quitCareer();
  if (p.career.partTime) p.career.partTime = null;
  if (p.career.sides) p.career.sides = []; // part-time work is local
  for (const l of leaveBusinesses(to.id)) log(l); // a business with a manager carries on; one without is wound up
  leaveForPrison();
  const there = new Set(livingNpcs().filter((n) => n.flags.abroad === to.id).map((n) => n.id)); // already living where the player is going
  const coming = new Set(household(opts.forced ? null : to.id).map((n) => n.id));
  // A child does not move alone: it is the family that is moving.
  if (opts.family) for (const n of livingNpcs()) if ((n.role === 'parent' && !n.flags.abroad) || (n.role === 'sibling' && n.age < 18 && !n.flags.abroad)) coming.add(n.id);
  // A child whose other parent did not agree, and whom no court allowed to go, stays with that parent (engine/familyMove.js).
  const stayers = opts.forced ? [] : opts.grant ? childrenStaying(countryId) : (opts.childrenStay ?? []).map((id) => ({ id, with: null }));
  for (const s of stayers) { coming.delete(s.id); const n = store.state.npcs[s.id]; if (n) { n.flags.livesWith = s.with; } }
  for (const n of livingNpcs()) {
    if (coming.has(n.id)) { if (n.flags.abroad === to.id) n.flags.abroad = false; delete n.flags.stayedBehind; continue; }
    if (n.role === 'spouse' && !n.flags.abroad) {
      // They would not come. The marriage goes on, at a distance.
      n.flags.abroad = from.id; n.flags.stayedBehind = true;
      n.meters.relationship = clamp(n.meters.relationship - 12);
      log(`${n.firstName} would not leave ${theCountry(from.name)}. You are still married, in two countries.`, 'system', 'bad');
    } else if (n.role === 'partner') {
      n.role = 'ex';
      log(`${n.firstName} would not come with you. It is over.`, 'system', 'bad');
    } else if (n.role === 'classmate') {
      forgetNpc(n.id); // classmates go; anyone the digital world still refers to stays on record, offstage
    } else if (['boss', 'coworker', 'colleague'].includes(n.role)) {
      // People from work stay people the player knows, at a distance.
      if (n.role !== 'colleague') { n.role = 'colleague'; n.flags.tag = null; n.flags.title = n.flags.mentor ? 'Mentor' : 'Former colleague'; }
      if (!n.flags.abroad) n.flags.abroad = from.id;
    } else {
      if (n.flags.abroad === to.id) { n.flags.abroad = false; continue; }
      if (n.flags.abroad) continue;
      n.flags.abroad = from.id;
      n.meters.relationship = clamp(n.meters.relationship - 5);
    }
  }

  prunePending(); // scenes about people who are not coming
  // Trips booked to leave from the old home are cancelled now, on their refund terms, before savings change currency.
  for (const t of (p.travel?.trips ?? []).filter((x) => x.status === 'confirmed' && x.origin.countryId !== to.id)) {
    const c = cancelTrip(t.id);
    if (c.ok) log(`The move meant cancelling your trip to ${COUNTRIES[t.destination.countryId].name}: it was to leave from ${t.origin.city ?? COUNTRIES[t.origin.countryId].name}. ${c.refunded ? `${fmtMoney(c.refunded, from)} came back.` : 'Nothing could be refunded.'}`, 'system', 'neutral');
  }
  // Money follows, at today's rate, except whatever the player chose to leave in the old currency.
  for (const a of p.assets) if (a.kind === 'property') { if (a.mortgage) a.mortgage.code ??= from.currency.code; if (a.tenant) a.tenant.code ??= from.currency.code; }
  book({ cat: 'travel', src: 'action', desc: `Moving to ${to.name}: visas, lawyers and shipping` });
  const leftBehind = setAside(opts.keep, from.currency.code);
  convertMoney(rate(from.currency.code, to.currency.code));
  absorb(to.currency.code);
  // Those who came will be paid at the new country's level from now on.
  for (const id of coming) { const job = store.state.npcs[id].life?.job; if (job) job.salary = Math.round(job.salary * to.living.wageK / from.living.wageK); }
  p.countryId = to.id;
  book({ cat: 'exchange', src: 'action', desc: `Moved to ${to.name}: money and debts are now in ${to.currency.code}` });
  p.flags.arrivedYear = store.state.year; // newcomers wait five years before they can vote
  p.city = opts.city && to.cities.includes(opts.city) ? opts.city : rng.pick(to.cities);
  const returning = (p.locations ?? []).some((l) => l.countryId === to.id && l.to != null && store.state.year - l.to >= 5);
  const ev = recordEvent({ key: `move:${moveId}`, type: 'relocation', international: true, returning, moveId,
    title: `${opts.family ? 'The family moved' : 'Moved'} to ${placeName(to.id, p.city)}`,
    text: `From ${placeName(from.id, (p.locations ?? []).at(-1)?.city ?? null)}${opts.reason ? `, ${opts.reason}` : route?.name ? `: ${route.name.toLowerCase()}` : ''}.`,
    place: { countryId: to.id, city: p.city }, from: { countryId: from.id, city: (p.locations ?? []).at(-1)?.city ?? null },
    people: [...coming].map((id) => archiveIdOf(store.state.npcs[id])), significance: 3, privacy: 'family', propertyId: homeBefore ?? null });
  settle(to.id, p.city, route?.status === 'citizen' ? 'permanent_resident' : route?.status ?? 'permanent_resident', { reason: opts.reason ?? (opts.family ? 'the family moved' : opts.forced ? 'had to leave' : route?.name ?? null), moveId, eventId: ev.id, homeBefore });
  if (p.residency && route) { p.residency.route = route.id; if (route.years) p.residency.until = store.state.year + route.years; }
  settleFamily(to.id, [...coming]);
  p.homeId = null;
  p.flags.livesWithParents = !!opts.family;
  p.flags.emigratedAge = p.age;
  p.counters.countriesLived += 1;
  stamp(to.id, 'moved');
  market().listings = null;
  for (const a of p.assets.filter((x) => x.kind === 'security')) a.value = priceOf(a.catalogId);
  p.stats.mood = clamp(p.stats.mood + 4);

  // A work visa comes with the job that sponsored it: the old field one rung down, or whatever they qualify for.
  let job = '';
  if (route?.id === 'work') {
    const old = CAREER_BY_ID[field];
    const career = old?.type === 'fulltime' && !unmet(old).length ? old : CAREERS.find((k) => k.type === 'fulltime' && k.category === 'professional' && !unmet(k).length) ?? CAREERS.find((k) => k.type === 'fulltime' && !unmet(k).length);
    if (career) { hire(career, career === old ? Math.min(Math.max(0, rung - 1), career.levels.length - 1) : 0, 55, 'Your sponsor was as good as their word.'); job = `You start work as ${p.career.title.toLowerCase()}. `; }
  }
  const who = [...coming].filter((id) => !there.has(id)).map((id) => store.state.npcs[id].firstName);
  const met = [...there].map((id) => store.state.npcs[id]).filter((n) => n?.alive && ['spouse', 'partner', 'parent', 'child', 'sibling'].includes(n.role)).map((n) => n.firstName);
  const back = kept.filter((a) => a.countryId === to.id).length;
  const left = kept.length - back;
  const granted = { business: `Your business-owner permission came through, for ${route?.years} years: you may live here and work in your own business. `, retire: `Your retirement visa came through, for ${route?.years} years. It does not allow work. `, free: 'You needed no visa. ', family: 'Your family visa came through. ', work: `An employer sponsored you: a work visa for ${route?.years} years. `, study: `Your student visa came through, for ${route?.years} years. You may not work full-time on it. `,
    invest: 'Your investor visa came through. ', protection: `You were given protection for ${route?.years} years. ` }[route?.id] ?? 'Your visa came through. ';
  const text = `${opts.family ? 'Your parents had decided, and that was that. ' : opts.forced ? '' : rightToLive(to.id, p) ? 'As a citizen you needed no visa. ' : granted}${opts.family ? 'The family moved to' : 'You moved to'} ${p.city}, ${theCountry(to.name)}${who.length ? `, with ${who.join(', ').replace(/, ([^,]*)$/, ' and $1')}` : ''}. `
    + `${met.length ? `${met.join(', ').replace(/, ([^,]*)$/, ' and $1')} ${met.length === 1 ? 'was' : 'were'} there to meet you. ` : ''}${job}`
    + `${shipped ? `Your ${shipped === 1 ? 'vehicle is' : `${shipped} vehicles are`} on a ship behind you. ` : ''}`
    + `${left ? `You still own ${left === 1 ? 'your property' : `${left} properties`} in ${theCountry(from.name)}: let it, sell it, or stay there when you visit. ` : ''}`
    + `${back ? 'You own a home here already, and can move straight in. ' : ''}`
    + `Your money is now in ${to.currency.code}${leftBehind ? `, apart from what you left in ${from.currency.code}` : ''}.`
    + `${animals.staying.length ? ` ${animals.staying.join(', ').replace(/, ([^,]*)$/, ' and $1')} stayed behind, with people who could keep them.` : ''}`;
  log(text, 'system', 'good');
  milestone(`Emigrated from ${theCountry(from.name)} to ${theCountry(to.name)}.`, 'life');
  reconcileAnimals(); // the animals that came are recorded in their new home at once
  p.flags.settling = { since: store.state.year, countryId: to.id };
  for (const l of afterMove([...coming], to.id)) log(l, 'system', 'neutral'); // the children's new schools
  for (const s of stayers) { const n = store.state.npcs[s.id]; const w = s.with && store.state.npcs[s.with]; if (n) log(`${n.firstName} stayed in ${theCountry(from.name)}${w ? ` with ${w.firstName}` : ''}. You will see each other in the holidays.`, 'system', 'neutral'); }
  syncNpcPlaces(p); // who moved with them, and who stayed, is written down in the year it happened
  return result(true, text, 'good', { moveId, eventId: ev.id });
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
