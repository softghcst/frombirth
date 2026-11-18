// Travel documents and borders. Kept apart from everything they are often
// confused with:
//
//   citizenship        engine/citizenship.js   who you are a national of
//   residence          engine/citizenship.js   where you may live (p.residency)
//   passport           here                    a document issued to a national; it
//                                              can expire, be lost or be replaced,
//                                              and none of that touches citizenship
//   entry permission   here                    what a border asks of a visitor: nothing,
//                                              an electronic authorization, or a visa
//   authorization      here                    a granted permission: where, for what
//                                              (visit, business, study), from when to when
//   application        here                    a request with a fee, a status, a decision
//                                              made once and kept
//   stays              here                    days actually spent in a place, for limits
//                                              counted over a rolling window
//
//   person.documents       [{ id, holderId, type:'passport', issuer, issuedOn, expiresOn, status, history:[] }]
//   person.authorizations  [{ id, personId, jurisdictionId, zone?, type, name, validFrom, validUntil, permitted:[], status, applicationId }]
//   person.stays           [{ countryId, zone?, from, to, tripId }]
//   p.applications         [{ id, personId, kind, jurisdictionId, purpose, status, submittedYear, decideYear, fee, txId, decision?, history:[] }]
//
// The rules are gameplay configuration (data/travel.js), simplified and
// unverified. A decision never depends on nationality or anything about who
// a person is: only on their application and their record.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, theCountry, uid } from '../util.js';
import { store, player, country, livingNpcs, log } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { FREE_MOVEMENT } from '../data/immigration.js';
import { PASSPORT, DOCUMENT_ERAS, ENTRY, DEFAULT_ENTRY, LIBERAL, ON_ARRIVAL, VISIT_AREAS, DECISION } from '../data/travel.js';
import { held, issuer, rightToLive, residency } from './citizenship.js';
import { charge, refund, recordEvent, archiveIdOf } from './chronicle.js';
import { atWar } from './history.js';

const nameOf = (id) => theCountry(COUNTRIES[id]?.name ?? id);
const Name = (id) => nameOf(id).replace(/^the /, 'The ');
const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });

// ---------- Dates ----------

/** Today, inside the year. The year is the world clock's; the day only moves forward, when people travel. */
export const today = () => {
  const t = store.state.today;
  return t && t.startsWith(String(store.state.year)) ? t : `${store.state.year}-01-01`;
};
export const yearOf = (date) => Number(String(date).slice(0, 4));
export const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
const addYears = (date, n) => `${yearOf(date) + n}${String(date).slice(4)}`.replace(/-02-29$/, '-02-28');

/** The documents era a year falls in. */
export const eraOf = (year = store.state.year) => DOCUMENT_ERAS.find((e) => year >= e.from && year <= (e.to ?? Infinity));

// ---------- People ----------

/** A person by id: the player, or someone in the save. */
export const personById = (id) => (id === player().id ? player() : store.state.npcs[id] ?? null);
const isPlayer = (person) => person === player();
const ageOf = (person) => person.age ?? 0;
/** Whether the player may apply for someone: themselves, or their own child under 18. */
export function guardianOf(person) {
  if (isPlayer(person)) return true;
  return person.role === 'child' && ageOf(person) < 18;
}

// ---------- Passports ----------

const docs = (person) => (person.documents ??= []);
export const passports = (person = player()) => docs(person).filter((d) => d.type === 'passport');
/** A passport that is valid on a date (for a trip, through its last day). */
export function validPassport(person, onDate = today(), through = onDate, issuerId = null) {
  return passports(person).find((d) => d.status === 'valid' && d.issuedOn <= onDate && d.expiresOn > through && (!issuerId || d.issuer === issuerId) && held(person).includes(d.issuer)) ?? null;
}
const DOC_WORDS = { valid: 'Valid', expired: 'Expired', lost: 'Reported lost', stolen: 'Reported stolen', canceled: 'Canceled', replaced: 'Replaced' };
export const docWord = (s) => DOC_WORDS[s] ?? s;

/**
 * What applying for a passport would involve, for a person and one of their nationalities.
 * @returns {{possible:boolean, why:string, fee:number, renewal:boolean, years:number}}
 */
export function passportQuote(person, issuerId) {
  const c = country();
  const child = ageOf(person) < PASSPORT.childUnder;
  const years = child ? PASSPORT.childYears : PASSPORT.adultYears;
  const current = passports(person).find((d) => d.issuer === issuerId && d.status === 'valid');
  const lostOne = passports(person).some((d) => d.issuer === issuerId && ['lost', 'stolen'].includes(d.status));
  const fee = localMoney(lostOne ? PASSPORT.replacementFee : child ? PASSPORT.childFee : PASSPORT.fee, c);
  let why = '';
  if (!held(person).includes(issuerId)) why = `${isPlayer(person) ? 'You are' : `${person.firstName} is`} not a citizen of ${nameOf(issuerId)}. A passport is only issued to its own nationals.`;
  else if (!guardianOf(person)) why = 'Adults apply for their own passports.';
  else if (eraOf().id === 'open') why = 'In this period most journeys need no passport at all.';
  else if (current && yearOf(current.expiresOn) > store.state.year + 1) why = `${isPlayer(person) ? 'Your' : 'Their'} passport is valid until ${current.expiresOn}. It can be renewed in its last year.`;
  else if (!lostOne && !current && (store.state.player.applications ?? []).some((a) => a.kind === 'passport' && a.personId === person.id && a.jurisdictionId === issuerId && a.submittedYear === store.state.year && passports(person).some((d) => d.applicationId === a.id && d.status === 'valid'))) why = 'An application has already been made this year.';
  else if (player().finance.cash < fee && !(isPlayer(person) && person.age < 16)) why = `The fee is ${fmtMoney(fee, c)}. You do not have it.`;
  return { possible: !why, why, fee, renewal: !!current, years };
}

/**
 * Applies for a passport. A national is entitled to one: the application is
 * checked and issued within weeks, inside the year, and is never refused for
 * anything but the conditions above.
 */
export function applyPassport(personId, issuerId) {
  const p = player();
  const person = personById(personId);
  if (!person) return result(false, 'There is nobody by that name.', 'neutral');
  const q = passportQuote(person, issuerId);
  if (!q.possible) return result(false, q.why, 'neutral');
  const year = store.state.year;
  // A child's first passport, for a child who is the player: a parent applies and pays.
  const parentsPay = isPlayer(person) && person.age < 16 && p.finance.cash < q.fee;
  const paid = charge({ amount: q.fee, kind: 'passport_fee', memo: `Passport for ${person.firstName}, issued by ${nameOf(issuerId)}`, key: `passport:${person.id}:${issuerId}:${passports(person).length}`,
    ref: { personId: person.id }, payer: parentsPay ? 'parent' : 'player' });
  if (!paid.ok) return result(false, paid.why, 'neutral');
  const app = { id: uid('app'), personId: person.id, kind: 'passport', jurisdictionId: issuerId, purpose: 'travel', status: 'approved', submittedYear: year, decideYear: year,
    fee: q.fee, txId: paid.tx.id, history: [{ year, date: today(), status: 'submitted' }, { year, date: today(), status: 'approved' }] };
  (p.applications ??= []).push(app);
  for (const d of passports(person)) if (d.issuer === issuerId && d.status === 'valid') { d.status = 'replaced'; d.history.push({ year, status: 'replaced' }); }
  const issued = today();
  const doc = { id: uid('doc'), holderId: person.id, type: 'passport', issuer: issuerId, issuedOn: issued, expiresOn: addYears(issued, q.years), status: 'valid',
    applicationId: app.id, history: [{ year, status: 'valid', note: q.renewal ? 'renewed' : 'issued' }] };
  docs(person).push(doc);
  notePassportEvent(person, doc);
  const text = `${isPlayer(person) ? 'Your' : `${person.firstName}'s`} ${q.renewal ? 'new' : ''} passport from ${nameOf(issuerId)} has arrived, valid until ${doc.expiresOn}. ${parentsPay ? 'Your parents paid for it.' : `It cost ${fmtMoney(q.fee, country())}.`}`.replace(/ {2}/g, ' ');
  log(text, 'system', 'good');
  return result(true, text, 'good', { doc });
}

/** Reports a passport lost or stolen. The citizenship it shows is unaffected. */
export function reportLost(personId, docId, how = 'lost') {
  const person = personById(personId);
  const d = person && passports(person).find((x) => x.id === docId);
  if (!d || d.status !== 'valid') return result(false, 'That passport is not in use.', 'neutral');
  d.status = how === 'stolen' ? 'stolen' : 'lost';
  d.history.push({ year: store.state.year, status: d.status });
  const text = `You reported ${isPlayer(person) ? 'your' : `${person.firstName}'s`} passport ${d.status}. It can no longer be used; a replacement can be applied for. Citizenship is not affected.`;
  log(text);
  return result(true, text, 'neutral');
}

// ---------- Entry ----------

const FREE = (a, b) => FREE_MOVEMENT.some((area) => area.members.includes(a) && area.members.includes(b));
const VISIT = (a, b) => VISIT_AREAS.find((area) => area.members.includes(a) && area.members.includes(b)) ?? null;
const ruleOf = (destId) => ENTRY[destId] ?? { ...DEFAULT_ENTRY, free: LIBERAL.includes(destId) ? WIDE_FREE : [] };
// The default's visa-free nationalities: the same broad list the configured destinations use.
const WIDE_FREE = ['at', 'be', 'hr', 'cz', 'dk', 'ee', 'fi', 'fr', 'de', 'gr', 'hu', 'it', 'nl', 'pl', 'pt', 'ro', 'sk', 'es', 'se', 'no', 'ch', 'ie', 'uk', 'us', 'ca', 'au', 'nz', 'jp', 'kr', 'sg', 'mc', 'ad'];
export const zoneOf = (destId) => ENTRY[destId]?.zone ?? null;
const RANK = { right: 0, resident: 1, free_movement: 2, none: 3, visa_free: 4, eta: 5, on_arrival: 6, evisa: 7, visa: 8, study: 9 };

/**
 * What a border asks of a person for a purpose, in a year. The best of all
 * their nationalities for which they hold (or could hold) a passport.
 * @param {'visit'|'business'|'study'} purpose
 * @returns {{kind:string, name:string, nationality:?string, days:?number, rolling:?number, zone:?string, passport:boolean, why:string}}
 */
export function entryRule(person, destId, purpose = 'visit', year = store.state.year, nights = 7) {
  const era = eraOf(year);
  if (era.id === 'open') return { kind: 'none', name: 'No papers needed', nationality: null, days: null, rolling: null, zone: null, passport: false, why: 'Before 1914 most borders asked for nothing.' };
  const mine = held(person);
  const rule = ruleOf(destId);
  const dest = issuer(destId);
  const base = { days: null, rolling: null, zone: null, passport: true };
  if (rightToLive(destId, person)) return { ...base, kind: 'right', name: 'Your own country', nationality: dest, why: 'Citizens may always enter.' };
  // A country at war in that year (Historical Eras, data/history.js) admits no visitors.
  if (atWar(dest, year) && purpose !== 'study') return { ...base, kind: 'closed', name: 'Closed to visitors: at war', nationality: null, why: `${Name(destId)} is at war. Visitors are not being admitted.` };
  const res = isPlayer(person) ? player().residency : null;
  if (res && res.jurisdictionId === destId && player().countryId === destId) return { ...base, kind: 'resident', name: 'Your residence permit', nationality: null, why: 'You are permitted to live there.' };
  const options = [];
  for (const n of mine) {
    if (era.id === 'controls') { options.push({ ...base, kind: 'visa', name: 'Visa', nationality: n, days: 90, why: 'In this period most borders wanted a visa.' }); continue; }
    if (FREE(n, dest)) { options.push({ ...base, kind: 'free_movement', name: 'Free movement', nationality: n, why: `As a citizen of ${nameOf(n)}.` }); continue; }
    if (purpose === 'study' && nights > (rule.days ?? 90)) {
      options.push({ ...base, kind: 'study', name: 'Student visa', nationality: n, why: 'Studying for longer than a visit allows needs a student visa.' });
      continue;
    }
    const area = VISIT(n, dest);
    if (area) { options.push({ ...base, kind: 'visa_free', name: `No visa (${area.name})`, nationality: n, days: rule.days ?? 90, rolling: rule.rolling ?? null, zone: rule.zone ?? null, why: `${area.name}.` }); continue; }
    if (rule.exempt?.includes(n)) { options.push({ ...base, kind: 'visa_free', name: 'No visa needed', nationality: n, days: rule.days, rolling: rule.rolling ?? null, zone: rule.zone ?? null, why: `As a citizen of ${nameOf(n)}.` }); continue; }
    if (rule.free?.includes(n)) {
      if (rule.eta) options.push({ ...base, kind: 'eta', name: rule.eta, nationality: n, days: rule.days, rolling: rule.rolling ?? null, zone: rule.zone ?? null, why: 'An electronic authorization, applied for online before traveling.' });
      else options.push({ ...base, kind: 'visa_free', name: 'No visa needed', nationality: n, days: rule.days, rolling: rule.rolling ?? null, zone: rule.zone ?? null, why: `As a citizen of ${nameOf(n)}.` });
      continue;
    }
    if (ON_ARRIVAL.includes(destId)) { options.push({ ...base, kind: 'on_arrival', name: 'Visa on arrival', nationality: n, days: 30, why: 'Bought at the border or online, for a fee.' }); continue; }
    options.push({ ...base, kind: rule.evisa ? 'evisa' : 'visa', name: rule.visa ?? 'Visitor visa', nationality: n, days: rule.days ?? 90, rolling: rule.rolling ?? null, zone: rule.zone ?? null,
      why: rule.evisa ? 'Applied for online and decided within days.' : 'Applied for in advance. It is decided when the year turns.' });
  }
  if (!options.length) return { ...base, kind: 'visa', name: rule.visa ?? 'Visitor visa', nationality: null, days: 90, why: 'No nationality on record.' };
  // Prefer an option whose passport is in hand, then the easiest.
  options.sort((a, b) => Number(!validPassport(person, today(), today(), a.nationality)) - Number(!validPassport(person, today(), today(), b.nationality)) || RANK[a.kind] - RANK[b.kind]);
  return options[0];
}

/** Whether a kind of entry needs something applied for first. */
export const needsAuthorization = (kind) => ['eta', 'evisa', 'visa', 'study', 'on_arrival'].includes(kind);

const auths = (person) => (person.authorizations ??= []);
const covers = (a, destId) => a.jurisdictionId === destId || (a.zone && a.zone === zoneOf(destId));
/** A granted authorization covering a journey's dates and purpose. */
export function authorizationFor(person, destId, purpose, from, to) {
  return auths(person).find((a) => a.status === 'granted' && covers(a, destId) && a.validFrom <= from && a.validUntil >= to
    && (a.permitted.includes(purpose) || (purpose === 'visit' && a.permitted.includes('business')) || (purpose === 'business' && a.permitted.includes('visit')))) ?? null;
}

// ---------- Days spent ----------

const staysOf = (person) => (person.stays ??= []);
/** Days spent in a place (or its zone) within the `window` days that end on `end`, counting both the day of arrival and of departure. */
export function daysUsed(person, destId, end, window) {
  const zone = zoneOf(destId);
  const start = addDays(end, -(window - 1));
  let n = 0;
  for (const s of staysOf(person)) {
    if (!(s.countryId === destId || (zone && s.zone === zone))) continue;
    const a = s.from > start ? s.from : start;
    const b = s.to < end ? s.to : end;
    if (b >= a) n += daysBetween(a, b) + 1;
  }
  return n;
}
/** Records days actually spent somewhere. */
export function addStay(person, destId, from, to, tripId) {
  staysOf(person).push({ countryId: destId, zone: zoneOf(destId), from, to, tripId });
}

/**
 * Everything that would stop a person crossing a border on these dates:
 * no passport, a passport that runs out, a missing authorization, too many days.
 * @returns {{ok:boolean, rule:object, problems:string[], needs:?string}}  needs: what to apply for
 */
export function readiness(person, destId, purpose, from, to) {
  const who = isPlayer(person) ? 'You' : person.firstName;
  const rule = entryRule(person, destId, purpose, yearOf(from), daysBetween(from, to));
  const problems = [];
  let needs = null;
  if (rule.kind === 'closed') return { ok: false, rule, problems: [rule.why], needs: null };
  if (rule.passport && !validPassport(person, from, to)) {
    problems.push(passports(person).some((d) => d.status === 'valid') ? `${who === 'You' ? 'Your' : `${who}'s`} passport runs out before the journey ends.` : `${who} ${who === 'You' ? 'have' : 'has'} no valid passport.`);
    needs = 'passport';
  }
  if (needsAuthorization(rule.kind) && !authorizationFor(person, destId, purpose === 'study' ? 'study' : purpose, from, to)) {
    problems.push(`${who} need${who === 'You' ? '' : 's'} ${/^[AEIOU]/.test(rule.name) ? 'an' : 'a'} ${rule.name} for ${nameOf(destId)}.`);
    needs ??= rule.kind;
  }
  if (rule.days) {
    const length = daysBetween(from, to) + 1;
    const used = rule.rolling ? daysUsed(person, destId, to, rule.rolling) : 0;
    if (length + used > rule.days) problems.push(rule.rolling
      ? `${who} would spend ${length + used} days in ${rule.zone === 'schengen' ? 'the Schengen area' : nameOf(destId)} in ${rule.rolling} days; ${rule.days} are allowed.`
      : `A visit to ${nameOf(destId)} may last ${rule.days} days at most.`);
  }
  return { ok: !problems.length, rule, problems, needs };
}

// ---------- Applications ----------

const PERMITS = { visit: ['visit', 'business'], business: ['visit', 'business'], study: ['study', 'visit'] };
const KIND_NAMES = { eta: 'electronic authorization', evisa: 'e-visa', visa: 'visitor visa', study: 'student visa', on_arrival: 'visa on arrival' };

/** The fee for an authorization to enter a place, local money. Fictional amounts. */
export function authorizationFee(rule, destId) {
  const base = rule.kind === 'eta' ? (ENTRY[destId]?.etaFee ?? 15) : rule.kind === 'study' ? DECISION.studyFee : rule.kind === 'on_arrival' ? 40 : DECISION.visaFee;
  return localMoney(base, country());
}

/** The chance a decision goes the applicant's way. Fictional; never looks at who the applicant is. */
function odds(app, person) {
  const p = player();
  const base = app.kind === 'eta' || app.kind === 'on_arrival' ? DECISION.eta : app.kind === 'study' ? DECISION.study : DECISION.visa;
  const convicted = isPlayer(person) ? p.legal.record.some((r) => r.convicted && !r.juvenile) : !!person.flags?.convicted;
  const refused = (p.applications ?? []).some((a) => a.personId === person.id && a.status === 'refused' && a.submittedYear >= store.state.year - 3 && a.id !== app.id);
  const trips = (p.travel?.trips ?? []).filter((t) => t.status === 'completed' && t.travelers.some((x) => x.id === person.id && x.status === 'accepted')).length;
  let k = base + (convicted ? DECISION.convicted : 0) + (refused ? DECISION.refusedRecently : 0) + Math.min(3, trips) * DECISION.goodHistory;
  if (app.funds != null && app.cost != null && app.funds < app.cost) k += DECISION.noFunds;
  return clamp(k, 0.05, 0.99);
}
const REFUSALS = {
  funds: 'The officer was not satisfied that the trip could be paid for.',
  record: 'The officer took the criminal record into account.',
  history: 'The officer noted a recent refusal and was not satisfied this time either.',
  general: 'The officer was not satisfied that the visit met the conditions of the visa.',
};
function refusalReason(app, person) {
  const p = player();
  if (app.funds != null && app.cost != null && app.funds < app.cost) return REFUSALS.funds;
  if (isPlayer(person) && p.legal.record.some((r) => r.convicted && !r.juvenile)) return REFUSALS.record;
  if ((p.applications ?? []).some((a) => a.personId === person.id && a.status === 'refused' && a.id !== app.id)) return REFUSALS.history;
  return REFUSALS.general;
}

function grant(app, person) {
  const year = store.state.year;
  const from = app.from ?? today();
  const lasts = app.kind === 'eta' ? 2 : app.kind === 'study' ? 1 : 1;
  const until = app.kind === 'on_arrival' ? (app.to ?? addDays(from, 30)) : app.kind === 'study' ? addDays(app.to ?? addDays(from, 150), 14) : `${yearOf(from) + lasts}-12-31`;
  const rule = app.rule ?? {};
  const a = { id: uid('auth'), personId: person.id, jurisdictionId: app.jurisdictionId, zone: rule.zone ?? null, type: app.kind, name: rule.name ?? KIND_NAMES[app.kind],
    validFrom: app.kind === 'study' ? addDays(from, -14) : today(), validUntil: until, permitted: PERMITS[app.purpose] ?? ['visit'], status: 'granted', applicationId: app.id, issuedYear: year };
  auths(person).push(a);
  app.status = 'approved';
  app.authorizationId = a.id;
  app.history.push({ year, date: today(), status: 'approved' });
  return a;
}

/**
 * Applies for an entry authorization for someone the player may apply for.
 * Electronic authorizations, e-visas and visas on arrival are decided at once;
 * visitor and student visas are decided when the year turns. The decision is
 * made once and kept.
 * @param {{from:string, to:string, purpose:string, tripId?:string, cost?:number}} o
 */
export function applyEntry(personId, destId, o) {
  const p = player();
  const person = personById(personId);
  if (!person) return result(false, 'There is nobody by that name.', 'neutral');
  if (!guardianOf(person) && !o.tripId) return result(false, 'Adults apply for their own visas.', 'neutral');
  const purpose = o.purpose ?? 'visit';
  const rule = entryRule(person, destId, purpose, yearOf(o.from), daysBetween(o.from, o.to));
  if (!needsAuthorization(rule.kind)) return result(false, `${isPlayer(person) ? 'You do' : `${person.firstName} does`} not need to apply: ${rule.name.toLowerCase()}.`, 'neutral');
  if (authorizationFor(person, destId, purpose, o.from, o.to)) return result(false, 'There is already a permission covering those dates.', 'neutral');
  const year = store.state.year;
  const open = (p.applications ?? []).find((a) => a.personId === person.id && a.jurisdictionId === destId && ['submitted', 'under_review', 'review_requested'].includes(a.status));
  if (open) return result(false, 'An application is already being considered.', 'neutral');
  if ((p.applications ?? []).some((a) => a.personId === person.id && a.jurisdictionId === destId && a.status === 'refused' && a.submittedYear === year))
    return result(false, 'It was refused this year. A review can be asked for once; a new application can be made next year.', 'neutral');
  if (rule.passport && !validPassport(person, o.from, o.to)) return result(false, `${isPlayer(person) ? 'You need' : `${person.firstName} needs`} a valid passport first: the application is made with it.`, 'neutral');
  const fee = authorizationFee(rule, destId);
  const paid = charge({ amount: fee, kind: 'visa_fee', memo: `${rule.name} for ${person.firstName}, ${nameOf(destId)}`, key: `entry:${person.id}:${destId}:${o.from}`, ref: { personId: person.id, tripId: o.tripId ?? null } });
  if (!paid.ok) return result(false, paid.why === 'Not enough money.' ? `The fee is ${fmtMoney(fee, country())}. You do not have it.` : paid.why, 'neutral');
  const instant = ['eta', 'evisa', 'on_arrival'].includes(rule.kind);
  const app = { id: uid('app'), personId: person.id, kind: rule.kind, jurisdictionId: destId, purpose, status: 'submitted', submittedYear: year, decideYear: instant ? year : year + 1,
    fee, txId: paid.tx.id, from: o.from, to: o.to, tripId: o.tripId ?? null, cost: o.cost ?? null, funds: o.cost != null ? p.finance.cash : null, reviews: 0,
    rule: { kind: rule.kind, name: rule.name, zone: rule.zone, days: rule.days }, history: [{ year, date: today(), status: 'submitted' }] };
  (p.applications ??= []).push(app);
  if (instant) return decide(app);
  const text = `${isPlayer(person) ? 'Your' : `${person.firstName}'s`} application for ${/^[AEIOU]/.test(rule.name) ? 'an' : 'a'} ${rule.name} for ${nameOf(destId)} is in. It will be decided when the year turns. The fee was ${fmtMoney(fee, country())}.`;
  log(text);
  return result(true, text, 'neutral', { app });
}

/** Makes the decision on an application. Once: a decided application is never decided again. */
function decide(app) {
  const person = personById(app.personId);
  if (!person || !['submitted', 'under_review', 'review_requested'].includes(app.status)) return result(false, 'Nothing to decide.', 'neutral');
  const yes = rng.chance(odds(app, person));
  app.decision = { year: store.state.year, yes };
  const who = isPlayer(person) ? 'Your' : `${person.firstName}'s`;
  if (yes) {
    const a = grant(app, person);
    const text = `${who} ${a.name} for ${nameOf(app.jurisdictionId)} was granted, valid until ${a.validUntil}. It does not allow work.`;
    log(text, 'system', 'good');
    return result(true, text, 'good', { app, authorization: a });
  }
  app.status = 'refused';
  app.reason = refusalReason(app, person);
  app.history.push({ year: store.state.year, date: today(), status: 'refused', note: app.reason });
  const text = `${who} ${app.rule?.name ?? 'visa'} for ${nameOf(app.jurisdictionId)} was refused. ${app.reason}${app.reviews < DECISION.reviews && app.kind !== 'eta' ? ' A review can be asked for, once.' : ''}`;
  log(text, 'system', 'bad');
  return result(false, text, 'bad', { app });
}

/** Asks for a refused application to be looked at again. Once per application; decided when the year turns. */
export function requestReview(appId) {
  const app = (player().applications ?? []).find((a) => a.id === appId);
  if (!app || app.status !== 'refused') return result(false, 'There is nothing to review.', 'neutral');
  if (app.kind === 'eta' || (app.reviews ?? 0) >= DECISION.reviews) return result(false, 'This decision cannot be reviewed again.', 'neutral');
  app.reviews = (app.reviews ?? 0) + 1;
  app.status = 'review_requested';
  app.decideYear = store.state.year + 1;
  app.history.push({ year: store.state.year, date: today(), status: 'review_requested' });
  const text = 'You asked for the decision to be reviewed. The answer will come when the year turns.';
  log(text);
  return result(true, text, 'neutral');
}

/** Withdraws an application still being considered. The fee is not returned. */
export function withdraw(appId) {
  const app = (player().applications ?? []).find((a) => a.id === appId);
  if (!app || !['submitted', 'under_review', 'review_requested'].includes(app.status)) return result(false, 'There is nothing to withdraw.', 'neutral');
  app.status = 'withdrawn';
  app.history.push({ year: store.state.year, date: today(), status: 'withdrawn' });
  return result(true, 'You withdrew the application. The fee is not returned.', 'neutral');
}

/** Yearly: applications due are decided; documents and permissions that have run out are marked so. */
export function tickPapers() {
  const p = player();
  const year = store.state.year;
  const out = [];
  for (const app of p.applications ?? []) {
    if (['submitted', 'under_review', 'review_requested'].includes(app.status) && app.decideYear <= year && app.kind !== 'relocation') out.push(decide(app).text);
  }
  const people = [p, ...Object.values(store.state.npcs).filter((n) => n.documents || n.authorizations)];
  const jan1 = `${year}-01-01`;
  for (const person of people) {
    for (const d of person.documents ?? []) {
      if (d.status === 'valid' && d.expiresOn <= jan1) { d.status = 'expired'; d.history.push({ year, status: 'expired' }); if (person === p) out.push(`Your passport from ${nameOf(d.issuer)} has expired. Your citizenship has not: a new passport can be applied for.`); }
      // A passport cannot outlive the nationality it shows.
      if (d.status === 'valid' && person.alive !== false && !held(person).includes(d.issuer)) { d.status = 'canceled'; d.history.push({ year, status: 'canceled', note: 'nationality no longer held' }); }
    }
    for (const a of person.authorizations ?? []) if (a.status === 'granted' && a.validUntil < jan1) a.status = 'expired';
  }
  return out.filter(Boolean);
}

/** A passport for an adult relative or friend who agrees to travel: they apply and pay for it themselves. */
export function ensureOwnPassport(n, from, to) {
  if (validPassport(n, from, to) || eraOf(yearOf(from)).id === 'open') return true;
  const iss = held(n)[0];
  if (!iss) return false;
  const fee = localMoney(PASSPORT.fee, country());
  const money = n.life?.savings ?? n.savings ?? 0;
  if (money < fee) return false;
  if (n.life) n.life.savings -= fee; else n.savings = money - fee;
  const issued = today();
  docs(n).push({ id: uid('doc'), holderId: n.id, type: 'passport', issuer: iss, issuedOn: issued, expiresOn: addYears(issued, PASSPORT.adultYears), status: 'valid', history: [{ year: store.state.year, status: 'valid', note: 'applied for themselves' }] });
  return true;
}

/** Everything the Documents screen shows, for the player and the children they apply for. */
export function documentsView() {
  const p = player();
  const kids = livingNpcs().filter((n) => n.role === 'child' && n.age < 18);
  const person = (x) => ({
    id: x.id, name: `${x.firstName} ${x.lastName ?? ''}`.trim(), you: x === p,
    nationalities: held(x).map((j) => ({ id: j, name: COUNTRIES[j]?.name ?? j, flag: COUNTRIES[j]?.flag ?? '', quote: passportQuote(x, j) })),
    passports: passports(x).map((d) => ({ ...d, name: COUNTRIES[d.issuer]?.name ?? d.issuer, flag: COUNTRIES[d.issuer]?.flag ?? '', word: docWord(d.status) })),
    authorizations: (x.authorizations ?? []).map((a) => ({ ...a, place: a.zone === 'schengen' ? 'the Schengen area' : COUNTRIES[a.jurisdictionId]?.name ?? a.jurisdictionId })),
  });
  const apps = (p.applications ?? []).slice().reverse().map((a) => ({ ...a, who: personById(a.personId)?.firstName ?? '', place: COUNTRIES[a.jurisdictionId]?.name ?? a.jurisdictionId }));
  return { people: [person(p), ...kids.map(person)], applications: apps, era: eraOf(), residency: residency(p) };
}

/** Records the first passport as part of the family history (a public fact; the application itself stays restricted). */
export function notePassportEvent(person, doc) {
  if (!isPlayer(person) || passports(person).length > 1) return;
  recordEvent({ key: `first-passport:${archiveIdOf(person)}`, type: 'document', title: `First passport, from ${nameOf(doc.issuer)}`, place: { countryId: player().countryId }, privacy: 'private', significance: 1 });
}
export { refund };
