// Private investigation: a licensed investigator's agency, run by the business engine
// (engine/business.js: its staff, cash, rent, partners, sale and closing), and the work clients
// bring to it. A private investigator is not a police officer: no warrants, no arrests beyond any
// citizen's, no police or confidential government records, no surveillance the law does not allow,
// and never pretending to be the police. Those requests are refused, not simulated.
//
//   W().inquiries[id] = { id, kind: 'private', service, clientId, businessId, fee, opened, due, steps[], findings[],
//                         status: 'open'|'complete'|'closed', outcome, paid, expenses }
import { clamp, localMoney, fmtMoney } from '../../util.js';
import { store, player, country, log } from '../../state.js';
import { PI_SERVICES } from '../../data/investigations.js';
import * as biz from '../business.js';
import { chronicle, employer } from '../employers.js';
import * as k from '../cases.js';
import { W, I, rec, now, year, me, nextId, result, note, grow, regard, seeded, skillAvg, dateWords } from './core.js';
import { licensed, piLicenseRule } from './careers.js';

const npc = (id) => store.state.npcs[id] ?? null;
const nm = (id) => (npc(id) ? `${npc(id).firstName} ${npc(id).lastName}` : 'the client');

/** Why the player cannot open an investigation agency (the business engine asks), or ''. */
export function agencyBlock(p = player()) {
  if (!licensed(p)) return `An investigation agency needs its owner to hold a ${piLicenseRule(p.countryId).name} here.`;
  return '';
}
/** The player's investigation agencies still open. */
export const agencies = (p = player()) => biz.businesses(p).filter((b) => b.typeId === 'investigations' && b.status === 'open');

/** Opens an agency through the business engine, offering the chosen services. */
export function openAgency(name, services = ['missing', 'background', 'insurance']) {
  const p = player();
  const block = agencyBlock(p);
  if (block) return result(false, block, 'neutral');
  const r = biz.start('investigations', name || `${p.lastName} Investigations`);
  if (!r.ok) return r;
  const b = biz.businesses(p).at(-1);
  b.investigations = { services: services.filter((s) => PI_SERVICES[s]), rate: 1, since: year() };
  const e = employer(b.employerId);
  if (e) chronicle(e, `${p.firstName} ${p.lastName} opened ${b.name}, a licensed private investigation agency.`);
  I().stats.agencies = [...new Set([...I().stats.agencies, b.id])];
  note(`Opened ${b.name}.`, 'career', { key: `piagency:${b.id}`, milestone: `Opened a private investigation agency: ${b.name}.`, significance: 2, log: false });
  return result(true, `${r.text} ${b.name} is licensed to take private work. It has no police powers.`);
}
/** Sets the agency's price, relative to the usual fee (0.7 to 1.6). Expensive work wins fewer clients. */
export function setRate(bizId, rate) {
  const b = biz.business(bizId);
  if (!b?.investigations) return result(false, 'There is no such agency.', 'neutral');
  b.investigations.rate = clamp(Math.round(rate * 100) / 100, 0.7, 1.6);
  return result(true, `Fees set at ${Math.round(b.investigations.rate * 100)}% of the usual rate.`, 'neutral');
}

/** Clients who come to the agency this year (seeded: the same for any turn length). A high price turns some away. */
export function clientsFor(b) {
  if (!b?.investigations) return [];
  const y = year();
  const key = `${b.id}/${y}`;
  b.investigations.offers ??= {};
  if (!b.investigations.offers[y]) {
    const r = seeded(key);
    const n = Math.max(0, Math.round(1 + b.reputation / 40 - (b.investigations.rate - 1) * 3 + r.int(-1, 1)));
    b.investigations.offers[y] = Array.from({ length: Math.min(4, n) }, () => {
      const service = r.pick(b.investigations.services);
      const client = k.civilian(player().countryId, { kind: 'civilian', age: r.int(28, 70) });
      return { id: nextId('client'), service, clientId: client.id, fee: localMoney(Math.round(PI_SERVICES[service].fee * b.investigations.rate), country()), status: 'offered' };
    });
  }
  return b.investigations.offers[y].filter((o) => o.status === 'offered');
}

/** Takes on a client's matter, under an engagement with a fee. */
export function acceptClient(bizId, offerId) {
  const b = biz.business(bizId);
  const o = b?.investigations?.offers?.[year()]?.find((x) => x.id === offerId && x.status === 'offered');
  if (!o) return result(false, 'That client is no longer waiting.', 'neutral');
  o.status = 'accepted';
  const s = PI_SERVICES[o.service];
  const id = nextId('inq');
  W().inquiries[id] = { id, kind: 'private', service: o.service, clientId: o.clientId, businessId: b.id, fee: o.fee, opened: now(), due: now() + s.months, steps: [], findings: [], status: 'open',
    outcome: null, paid: false, expenses: 0, truth: seeded(id).chance(0.65) ? 'answer' : 'none' };
  I().inquiryIds.push(id);
  return result(true, `Engaged by ${nm(o.clientId)}: ${s.name.toLowerCase()}, for ${fmtMoney(o.fee, country())}. Expected to take until ${dateWords(now() + s.months)}.`);
}
export function declineClient(bizId, offerId) {
  const o = biz.business(bizId)?.investigations?.offers?.[year()]?.find((x) => x.id === offerId);
  if (o) o.status = 'declined';
  return result(true, 'You turned the work down.', 'neutral');
}

/** What a private investigator may do on a matter. Restricted things are listed, and refused, so the line is clear. */
export const PI_STEPS = {
  client: { label: 'Take the client\'s full account', skills: ['interviewing'] },
  public: { label: 'Search public records', skills: ['planning', 'reasoning'], cost: 40 },
  people: { label: 'Talk to people willing to talk', skills: ['interviewing'], cost: 60 },
  observe: { label: 'Observe from public places, where the law allows', skills: ['observation'], cost: 120 },
  report: { label: 'Write the findings up for the client', skills: ['writing'] },
  police_records: { label: 'Get into police or government records', restricted: 'Not something a private investigator may do: those records are confidential, and asking an officer to look is misconduct for both of you.' },
  pose: { label: 'Say you are with the police', restricted: 'Impersonating a police officer is a crime. A private investigator says who they are.' },
  track: { label: 'Put a tracker on someone\'s car', restricted: 'Not without the owner\'s consent or a court\'s order, which a private investigator does not get. It is unlawful surveillance.' },
};
export function inquiryStep(id, step) {
  const q = W().inquiries[id];
  if (!q || q.status !== 'open') return result(false, 'That matter is closed.', 'neutral');
  const d = PI_STEPS[step];
  if (!d) return result(false, 'Nothing to do.', 'neutral');
  if (d.restricted) { regard('ethics', 0); return result(false, d.restricted, 'neutral'); }
  if (q.steps.includes(step)) return result(false, 'Done already: doing it again finds nothing new.', 'neutral');
  q.steps.push(step);
  for (const s of d.skills) grow(s, 2);
  const b = biz.business(q.businessId);
  if (d.cost && b) { const c = localMoney(d.cost, country()); b.cash -= c; q.expenses += c; }
  const r = seeded(`${id}/${step}`);
  const useful = q.truth === 'answer' && r.chance(0.55 + skillAvg(d.skills) / 300);
  const text = { client: `${nm(q.clientId)} told you what they know, and what they want.`, public: useful ? 'The public records turn up an address and a change of name.' : 'The public records have nothing useful.',
    people: useful ? 'A former neighbor remembers where they moved.' : 'Nobody you spoke to knew anything.', observe: useful ? 'From the street, you confirm who lives at the address.' : 'Days of watching from a café window; nothing.',
    report: 'You wrote up what you found, and what you could not confirm.' }[step];
  if (useful && step !== 'report' && step !== 'client') q.findings.push(text);
  return result(true, text, 'neutral');
}
/** Finishes a matter: the report goes to the client, who pays the fee once. An engagement can end without the answer the client wanted. */
export function completeInquiry(id) {
  const q = W().inquiries[id];
  if (!q || q.status !== 'open') return result(false, 'That matter is closed.', 'neutral');
  if (!q.steps.includes('report')) return result(false, 'Write up the findings first.', 'neutral');
  q.status = 'complete';
  q.outcome = q.findings.length ? 'answered' : 'unresolved';
  const b = biz.business(q.businessId);
  const client = npc(q.clientId);
  if (!q.paid && b) { b.cash += q.fee; q.paid = true; }
  if (b) b.reputation = clamp(b.reputation + (q.outcome === 'answered' ? 3 : -1));
  if (client) client.meters.relationship = clamp(client.meters.relationship + (q.outcome === 'answered' ? 12 : 2));
  regard('reliability', q.outcome === 'answered' ? 2 : 0);
  I().stats.completed += 1;
  if (q.kind === 'corporate') return result(true, q.outcome === 'answered' ? `Your report goes to ${nm(q.clientId)}: what you found, and what you could not confirm. If it is a crime, it is for the company to report it to the police.` : `You found nothing to support the concern. ${nm(q.clientId)} closes the matter.`, q.outcome === 'answered' ? 'good' : 'neutral');
  return result(true, q.outcome === 'answered' ? `${nm(q.clientId)} has their answer, and paid ${fmtMoney(q.fee, country())}.` : `You could not find what ${nm(q.clientId)} hoped. They paid the agreed ${fmtMoney(q.fee, country())} for the work, and were disappointed.`, q.outcome === 'answered' ? 'good' : 'neutral');
}
export const inquiries = (p = player()) => (rec(p)?.inquiryIds ?? []).map((id) => W().inquiries[id]).filter(Boolean);
