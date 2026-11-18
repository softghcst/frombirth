// The player's independent practice: services offered, at what price, for how
// many hours a week; inquiries from clients; contracts that take time and are
// paid only when the work is done; reputation that grows or falls with each.
//
//   p.career.freelance = {
//     services: { [id]: { rate:'budget'|'market'|'premium'|'luxury', rep:0–100, done, failed, clients:{ name: loyalty } } },
//     hoursOffered,                     hours a week available for freelance work
//     inquiries: [Inquiry], inquiryAge  this year's requests (made once a year)
//     contracts: [Contract],            active ones take time; finished ones are paid by payroll, once
//     done                              contracts completed, all services
//   }
//   Contract: { id, service, serviceName, client, hours, fee, age, status:'active'|'done'|'failed'|'cancelled', paid, partial }
//
// Work cannot be conjured: inquiries come once a year, in proportion to the
// hours offered, and every accepted contract uses those hours.
import { rng } from '../rng.js';
import { clamp, fmtMoney, localWage, uid } from '../util.js';
import { store, player, country, log } from '../state.js';
import { COUNTRIES, COUNTRY_LIST } from '../data/countries.js';
import { speaks, languagesOf } from './languages.js';
import { SERVICES, SERVICE_BY_ID, RATES } from '../data/freelance.js';
import { serviceExists } from '../data/eras.js';
import { resolve } from './conditions.js';
import { career as careerState, canFit, freelanceHours, weeklyLoad, workLaw } from './worklife.js';
import { hereCity } from './cities.js';
import { phase } from './economy.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const RATE_BY_ID = Object.fromEntries(RATES.map((r) => [r.id, r]));
const fl = () => careerState().freelance;

/** Why the player cannot offer a service, or ''. */
export function serviceBlock(s) {
  const p = player();
  const c = careerState();
  if (!serviceExists(s.id, store.state.year)) return `Nobody does this for a living in ${store.state.year}.`;
  if (p.age < Math.max(s.minAge, Math.min(workLaw().workAge, s.minAge + 2))) return `You need to be ${s.minAge}.`;
  const short = Object.entries(s.req).find(([path, min]) => (Number(resolve(path)) || 0) < min);
  if (short) return 'You are not good enough at it yet to charge for it.';
  if (s.programme && !p.education.degrees.some((d) => d.type === s.programme)) return 'Needs a hair and makeup license.';
  if (s.languages) {
    const own = new Set(languagesOf(p.birthCountryId));
    const second = COUNTRY_LIST.some((x) => languagesOf(x.id).some((l) => !own.has(l)) && (speaks(x.id, p) ?? 0) >= 60);
    if (!second) return 'You need a second language, spoken well.';
  }
  if (s.licence === 'driving' && p.age < 21) return 'You need to be 21 and have a license.';
  if (s.experience && Object.values(c.experience).reduce((a, b) => a + b, 0) < s.experience) return `Clients want ${s.experience} years of experience first.`;
  return '';
}

/** Every service, with whether it is open and how the player is doing at it. */
export function services() {
  const f = fl();
  return SERVICES.map((s) => {
    const mine = f.services[s.id];
    return { ...s, block: serviceBlock(s), offered: !!mine, rep: mine?.rep ?? 0, rateId: mine?.rate ?? 'market', done: mine?.done ?? 0,
      hourly: hourly(s, mine?.rate ?? 'market'), clients: Object.keys(mine?.clients ?? {}).length };
  });
}

/** What an hour costs a client, locally. */
export const hourly = (s, rateId) => localWage(s.rate * RATE_BY_ID[rateId].k * hereCity().pay, country());

/** Starts (or reprices) a service. */
export function offer(id, rateId = 'market') {
  const s = SERVICE_BY_ID[id];
  const block = serviceBlock(s);
  if (block) return result(false, block, 'neutral');
  const f = fl();
  const had = f.services[id];
  f.services[id] = { rate: rateId, rep: had?.rep ?? 25, done: had?.done ?? 0, failed: had?.failed ?? 0, clients: had?.clients ?? {} };
  if (!f.hoursOffered) f.hoursOffered = 8;
  return result(true, had ? `You now charge ${fmtMoney(hourly(s, rateId), country())} an hour for ${s.name.toLowerCase()}.`
    : `You put the word out: ${s.name.toLowerCase()}, ${fmtMoney(hourly(s, rateId), country())} an hour.`);
}

/** Stops offering a service. Active contracts are still finished. */
export function withdraw(id) {
  delete fl().services[id];
  return result(true, 'You stop taking new work of that kind.', 'neutral');
}

/** Sets the hours a week the player is open for freelance work. */
export function setAvailability(hours) {
  fl().hoursOffered = hours;
  return result(true, hours ? `You are taking on up to ${hours} hours a week of freelance work.` : 'You are not taking on freelance work.', 'neutral');
}

/**
 * How many clients ask in a year: more with reputation, skill and demand,
 * fewer at higher prices, never in proportion to clicks.
 */
export function interest(s, mine) {
  const skill = Number(resolve(s.skill)) || 40;
  const price = RATE_BY_ID[mine.rate].k;
  // A good reputation carries a higher price; a new name does better cheap.
  const priceFit = clamp(1.25 - (price - 1) * (1.1 - mine.rep / 120) - Math.max(0, 0.85 - price) * 0.3, 0.15, 1.6);
  const city = { capital: 1.2, largest: 1.15, city: 1 }[hereCity().kind];
  const market = 1 + phase().hiring;
  return Math.max(0, s.demand * priceFit * (0.5 + mine.rep / 100) * (0.6 + skill / 125) * city * market);
}

/** This year's inquiries, made the first time the player looks. */
export function inquiries() {
  const p = player();
  const f = fl();
  if (f.inquiryAge === p.age) return f.inquiries;
  f.inquiryAge = p.age;
  f.inquiries = [];
  const offered = Object.entries(f.services);
  if (!offered.length || !f.hoursOffered) return f.inquiries;
  const capacity = f.hoursOffered * 48; // hours a year
  let budget = capacity * 1.6; // clients ask for more than can be done; the player chooses
  for (const [id, mine] of offered) {
    const s = SERVICE_BY_ID[id];
    if (!s || serviceBlock(s)) continue;
    const n = Math.round(interest(s, mine) * (1 + f.hoursOffered / 10) + rng.around(0, 0.8));
    const regulars = Object.entries(mine.clients).filter(([, loyal]) => loyal >= 2).map(([name]) => name);
    for (let i = 0; i < n && budget > 0; i++) {
      const hours = rng.int(s.job[0], s.job[1]);
      budget -= hours;
      const regular = regulars.length && rng.chance(0.5) ? regulars.splice(rng.int(0, regulars.length - 1), 1)[0] : null;
      const client = regular ?? clientName();
      const fee = Math.round(hourly(s, mine.rate) * hours * rng.around(1, 0.08));
      f.inquiries.push({ id: uid('inq'), service: id, serviceName: s.name, client, regular: !!regular, hours, fee });
    }
  }
  return f.inquiries;
}

function clientName() {
  const names = COUNTRIES[player().countryId].names;
  const kind = rng.chance(0.4) ? 'business' : 'person';
  return kind === 'business' ? `${rng.pick(names.last)} ${rng.pick(['& Co.', 'Ltd', 'Studio', 'Bakery', 'Garage', 'Dental', 'Events', 'Agency'])}`
    : `${rng.pick([...names.female, ...names.male])} ${rng.pick(names.last)}`;
}

/** Accepts an inquiry as a contract, if the hours fit. */
export function acceptInquiry(id) {
  const p = player();
  const f = fl();
  const q = f.inquiries.find((x) => x.id === id);
  if (!q) return result(false, 'That client has found someone else.', 'neutral');
  const weekly = Math.ceil(q.hours / 48);
  if (freelanceHours() + weekly > f.hoursOffered) return result(false, `That is more than the ${f.hoursOffered} hours a week you set aside for freelance work.`, 'neutral');
  const fit = canFit(weekly, { kind: 'freelance' });
  if (!fit.ok) return fit;
  f.inquiries = f.inquiries.filter((x) => x.id !== id);
  f.contracts.push({ id: uid('gig'), service: q.service, serviceName: q.serviceName, client: q.client, hours: q.hours, fee: q.fee, age: p.age, status: 'active', paid: false, partial: 0 });
  return result(true, `You agree to do ${q.serviceName.toLowerCase()} for ${q.client}: about ${q.hours} hours, for ${fmtMoney(q.fee, country())} on completion.`);
}

/** Asks a client for more. They may agree, or go elsewhere. */
export function counterOffer(id) {
  const f = fl();
  const q = f.inquiries.find((x) => x.id === id);
  if (!q || q.countered) return result(false, 'You have already asked.', 'neutral');
  q.countered = true;
  const rep = f.services[q.service]?.rep ?? 25;
  if (rng.chance(clamp(0.25 + rep / 150 + (q.regular ? 0.2 : 0), 0.1, 0.85))) {
    q.fee = Math.round(q.fee * 1.15);
    return result(true, `${q.client} agrees to ${fmtMoney(q.fee, country())}.`);
  }
  if (rng.chance(0.5)) { f.inquiries = f.inquiries.filter((x) => x.id !== id); return result(false, `${q.client} goes with someone cheaper.`); }
  return result(false, `${q.client} says the original price is all they can do.`, 'neutral');
}

export const declineInquiry = (id) => { fl().inquiries = fl().inquiries.filter((x) => x.id !== id); return result(true, 'You pass on it.', 'neutral'); };

/** Drops a contract part-way. The client pays for nothing, and remembers. */
export function cancelContract(id) {
  const f = fl();
  const k = f.contracts.find((x) => x.id === id && x.status === 'active');
  if (!k) return result(false, 'There is no such contract.', 'neutral');
  k.status = 'cancelled';
  k.paid = true;
  const mine = f.services[k.service];
  if (mine) { mine.rep = clamp(mine.rep - 8); delete mine.clients[k.client]; }
  return result(true, `You tell ${k.client} you cannot finish. They are not happy.`, 'neutral');
}

/**
 * At the end of the year: each active contract is finished, or not. Finished
 * work is paid by payroll (once); failed work gets a part payment at most.
 * @returns {string[]} journal lines
 */
export function tickFreelance() {
  const p = player();
  const c = careerState();
  const f = c.freelance;
  const lines = [];
  const load = weeklyLoad(p, p.age - 1);
  const overloaded = Math.max(0, load.total - 60) / 40;
  let earned = 0;
  let done = 0;
  for (const k of f.contracts) {
    if (k.status !== 'active') continue;
    const s = SERVICE_BY_ID[k.service];
    const mine = f.services[k.service] ?? { rep: 25, done: 0, failed: 0, clients: {} };
    const skill = Number(resolve(s?.skill ?? 'stats.intellect')) || 40;
    const quality = clamp(0.55 + (skill - 50) / 90 + mine.rep / 400 + (p.hidden.discipline - 50) / 200 - overloaded + rng.around(0, 0.15), 0.05, 0.98);
    if (rng.chance(quality)) {
      k.status = 'done';
      mine.done = (mine.done ?? 0) + 1;
      mine.rep = clamp(mine.rep + (quality > 0.8 ? 5 : 3));
      mine.clients[k.client] = (mine.clients[k.client] ?? 0) + 1;
      f.done = (f.done ?? 0) + 1;
      earned += k.fee;
      done += 1;
      if (s?.track) c.experience[s.track] = Math.round(((c.experience[s.track] ?? 0) + k.hours / 1900) * 10) / 10;
    } else {
      k.status = 'failed';
      k.partial = Math.round(k.fee * rng.int(0, 4) / 10); // whatever part of the work the client accepts
      mine.failed = (mine.failed ?? 0) + 1;
      mine.rep = clamp(mine.rep - rng.int(6, 12));
      delete mine.clients[k.client];
      lines.push(`The ${k.serviceName.toLowerCase()} job for ${k.client} went badly. ${k.partial ? `They paid ${fmtMoney(k.partial, country())} for what they could use.` : 'They paid nothing.'}`);
    }
    if (f.services[k.service]) f.services[k.service] = mine;
  }
  if (done) lines.push(`You finished ${done} freelance ${done === 1 ? 'job' : 'jobs'} this year, for ${fmtMoney(earned, country())}.`);
  // Keep the record short: paid contracts older than three years are summarised by the counts above.
  f.contracts = f.contracts.filter((k) => !k.paid || k.age >= p.age - 3);
  f.inquiries = [];
  return lines;
}

/** Totals for display. */
export function freelanceSummary() {
  const f = fl();
  const active = f.contracts.filter((k) => k.status === 'active');
  return { active, hours: freelanceHours(), offered: f.hoursOffered, done: f.done ?? 0, services: Object.keys(f.services).length,
    due: active.reduce((s, k) => s + k.fee, 0) };
}
