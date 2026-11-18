// Owning a business in another country: starting one there without moving,
// opening a branch abroad, and the one route by which a business can lead to
// living there. Everything else is the business engine's (engine/business.js):
// the accounts are kept in the money of the country the business is in, its
// profit is taxed there, and what it pays its owner is changed into the money
// of wherever the owner lives and taxed there as income, once.
//
// Owning a business abroad gives no right to live or work in that country.
// The only way it counts is the business-owner route (engine/immigration.js),
// which is an application like any other, for owners of a business that has
// traded for a year and employs people there.
import { clamp, fmtMoney, uid, theCountry, localMoney } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { BUSINESS_BY_ID } from '../data/business.js';
import * as biz from './business.js';
import { registerEmployer } from './employers.js';
import { payForeign, quoteForeign, convert } from './currency.js';
import { recordEvent } from './chronicle.js';
import { rightToLive } from './citizenship.js';
import { capitalCity } from './geo.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const nameOf = (id) => theCountry(COUNTRIES[id]?.name ?? id);
/** What registering a company owned from abroad costs (base units): lawyers, a local address, the registration. Fictional. */
export const FOREIGN_SETUP = 4000;

/** What starting a business of a kind in another country would cost, in that country's money and in the player's. */
export function quoteAbroad(typeId, countryId, city = capitalCity(countryId)) {
  const t = BUSINESS_BY_ID[typeId];
  if (!t || !COUNTRIES[countryId]) return null;
  const f = biz.figures(t, countryId, city);
  const there = COUNTRIES[countryId];
  const total = Math.round(f.startup + localMoney(FOREIGN_SETUP, there) + f.wage * 0.6); // the premises, the paperwork, and a manager's first months
  const q = quoteForeign(there.currency.code, total);
  return { type: t, countryId, city, startup: f.startup, total, code: there.currency.code, fromCash: q.fromCash, fee: q.fee, ok: q.ok, wage: f.wage };
}

/** Why the player may not start this business abroad, or ''. */
export function abroadBlock(typeId, countryId) {
  const p = player();
  const t = BUSINESS_BY_ID[typeId];
  if (!t) return 'There is no such business.';
  if (countryId === p.countryId) return 'That is where you live: start it at home.';
  const local = biz.startBlock(t);
  if (local) return local;
  if (t.solo) return 'This kind of business is the owner\'s own work: it cannot be run from another country.';
  if (p.politics && p.politics.tier >= 2) return `Holding office as ${p.politics.title} rules out running a business.`;
  return '';
}

/**
 * Starts a business in another country, run from the start by a manager
 * hired there. The money goes from the player's savings at today's rate, less
 * the bank's fee, into the business's own account in local money.
 */
export function startAbroad(typeId, countryId, city, name) {
  const p = player();
  const there = COUNTRIES[countryId];
  const block = abroadBlock(typeId, countryId);
  if (block) return result(false, block, 'neutral');
  const where = there.cities.includes(city) ? city : capitalCity(countryId);
  const q = quoteAbroad(typeId, countryId, where);
  if (!q.ok) return result(false, `Setting it up comes to ${fmtMoney(q.total, there)}, about ${fmtMoney(q.fromCash, country())} of your money with the exchange. You do not have it.`, 'neutral');
  payForeign(q.code, q.total, `Opening a business in ${there.name}`);
  const title = (name || biz.suggestName(q.type)).slice(0, 40);
  const e = registerEmployer({ name: title, family: q.type.family, tracks: [q.type.track], countryId, city: where });
  const b = { id: uid('biz'), typeId, name: title, countryId, city: where, employerId: e.id, founded: store.state.year, foundedAge: p.age, years: 0,
    status: 'open', stake: 1, partners: [], cash: q.total - q.startup - localMoney(FOREIGN_SETUP, there), debt: 0, debtYears: 0, sites: 1, staff: [], others: 0,
    reputation: 24, quality: 50, marketing: 1, pricing: 'standard', ownerHours: 0, draw: 'half', overdrawn: 0, last: null, payout: 0, payoutPaid: true, candidates: null,
    history: [], heirId: null, ownerNpcId: null, foreignOwned: true };
  biz.businesses(p).push(b);
  b.history.push({ year: store.state.year, text: `${p.firstName} ${p.lastName}, living in ${there === COUNTRIES[p.countryId] ? 'the country' : nameOf(p.countryId)}, opened ${title} in ${where}.` });
  // A manager from the start: the owner is not there.
  const hired = biz.hire(b, 0);
  const staff = biz.staffOf(b)[0];
  if (!hired.ok || !staff) return result(false, `${title} is registered, but nobody could be hired to run it.`, 'bad');
  biz.setManager(b, staff.npc.id);
  recordEvent({ key: `biz:${b.id}:opened`, type: 'business', title: `Opened ${title} in ${where}, ${there.name}`, place: { countryId, city: where }, significance: 2, privacy: 'family' });
  milestone(`Opened ${title} in ${there.name}.`, 'career');
  const text = `${title} opens in ${where}, ${nameOf(countryId)}. ${staff.npc.firstName} ${staff.npc.lastName} runs it day to day. It cost ${fmtMoney(q.fromCash, country())} of your money, changed at today's rate. Its accounts are kept in ${q.code} and its profit is taxed there. Owning it gives you no right to live or work in ${nameOf(countryId)}.`;
  log(text, 'system', 'good');
  return result(true, text, 'good', { business: b });
}

/**
 * Opens a branch of an established business in another country: a business
 * of its own there, with the same name and its own manager, paid for out of
 * the first business's money.
 */
export function openBranchAbroad(parentId, countryId, city) {
  const p = player();
  const parent = biz.business(parentId);
  if (!parent || parent.status !== 'open') return result(false, 'That business is not trading.', 'neutral');
  if (countryId === parent.countryId) return result(false, 'A branch in the same country is a new site: expand instead.', 'neutral');
  if (!biz.managerOf(parent)) return result(false, 'A branch abroad needs someone you trust running the first one. Appoint a manager.', 'neutral');
  if (parent.reputation < 60) return result(false, 'Its name does not travel yet. Build its reputation at home first.', 'neutral');
  if (biz.businesses(p).some((x) => x.parentId === parent.id && x.countryId === countryId && x.status === 'open')) return result(false, `${parent.name} already has a branch in ${nameOf(countryId)}.`, 'neutral');
  const there = COUNTRIES[countryId];
  const where = there.cities.includes(city) ? city : capitalCity(countryId);
  const q = quoteAbroad(parent.typeId, countryId, where);
  const cost = Math.ceil(convert(q.total, q.code, COUNTRIES[parent.countryId].currency.code) * 1.015); // the bank's fee on the transfer
  if (parent.cash < cost) return result(false, `A branch there would take ${fmtMoney(cost, COUNTRIES[parent.countryId])} from ${parent.name}. It has ${fmtMoney(parent.cash, COUNTRIES[parent.countryId])}.`, 'neutral');
  parent.cash -= cost;
  const e = registerEmployer({ name: `${parent.name} ${where}`, family: q.type.family, tracks: [q.type.track], countryId, city: where });
  const b = { id: uid('biz'), typeId: parent.typeId, name: `${parent.name} ${where}`.slice(0, 40), countryId, city: where, employerId: e.id, founded: store.state.year, foundedAge: p.age, years: 0,
    status: 'open', stake: parent.stake, partners: [], cash: q.total - q.startup - localMoney(FOREIGN_SETUP, there), debt: 0, debtYears: 0, sites: 1, staff: [], others: 0,
    reputation: clamp(Math.round(parent.reputation * 0.6), 20, 70), quality: parent.quality, marketing: 1, pricing: parent.pricing, ownerHours: 0, draw: 'half', overdrawn: 0, last: null, payout: 0, payoutPaid: true,
    candidates: null, history: [], heirId: null, ownerNpcId: null, foreignOwned: countryId !== p.countryId, parentId: parent.id };
  biz.businesses(p).push(b);
  parent.history.push({ year: store.state.year, text: `${parent.name} opened a branch in ${where}, ${there.name}.` });
  const hired = biz.hire(b, 0);
  const staff = biz.staffOf(b)[0];
  if (hired.ok && staff) biz.setManager(b, staff.npc.id);
  recordEvent({ key: `biz:${b.id}:branch`, type: 'business', title: `${parent.name} opened in ${where}, ${there.name}`, place: { countryId, city: where }, significance: 2, privacy: 'family' });
  milestone(`${parent.name} opened in ${there.name}.`, 'career');
  const text = `${parent.name} opens in ${where}, ${nameOf(countryId)}, with ${staff ? `${staff.npc.firstName} ${staff.npc.lastName} in charge` : 'nobody yet in charge'}. It keeps its own accounts there, in ${q.code}, and pays its tax there.`;
  log(text, 'system', 'good');
  return result(true, text, 'good', { business: b });
}

/** The player's businesses abroad, for the hub: where, how they did, and what they mean for papers. */
export function businessesAbroad(p = player()) {
  return biz.openBusinesses(p).filter((b) => b.countryId !== p.countryId).map((b) => ({ id: b.id, name: b.name, countryId: b.countryId, city: b.city, years: b.years, staff: biz.headcount(b),
    manager: biz.managerOf(b)?.firstName ?? null, profit: b.last?.profit ?? null, code: COUNTRIES[b.countryId].currency.code, canLive: rightToLive(b.countryId, p) }));
}

/** Whether an owner qualifies for the business-owner route into a country: an open business there, traded a year, employing people. */
export function ownerRoute(countryId, p = player()) {
  const b = biz.openBusinesses(p).find((x) => x.countryId === countryId && x.stake >= 0.5);
  if (!b) return { eligible: false, why: 'You own no business there (half or more of it).' };
  if (b.years < 1) return { eligible: false, why: `${b.name} has not yet traded for a full year.` };
  if (biz.headcount(b) < 2) return { eligible: false, why: `${b.name} must employ at least two people there.` };
  if ((b.last?.profit ?? 0) < 0 && b.overdrawn > 0) return { eligible: false, why: `${b.name} is losing money and overdrawn.` };
  return { eligible: true, business: b };
}
