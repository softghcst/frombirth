// Nationality and residence, kept apart from where someone was born and
// where they live. A person can be born in one place, hold the citizenship
// of another, and live in a third.
//
//   person.citizenships  [{ jurisdictionId, acquisitionType: 'birth'|'descent'|'naturalization'|'restoration', acquiredAt, lostAt? }]
//   p.residency          { jurisdictionId, status, since, workAuthorized, studyAuthorized }
//                        status: 'citizen' | 'permanent_resident' | 'temporary_resident' | 'student' | 'worker'
//   p.locations          [{ countryId, city, from, to? }]   everywhere they have lived, in order
//
// A jurisdiction here is whoever issues the nationality: someone born in
// Puerto Rico holds the United States' (data/world.js, nationalityOf).
// The rules themselves are data (data/citizenship.js) and are gameplay
// configuration, not legal information.
import { hasRecord } from './records.js';
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, theCountry } from '../util.js';
import { store, player, country, livingNpcs, log, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { BIRTHRIGHT, SINGLE, RESIDENCE_YEARS, DEFAULT_YEARS, SPOUSE_YEARS, NATURALIZATION_FEE } from '../data/citizenship.js';
import { speaks } from './languages.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
/** Whose nationality a place confers: its own, or the state it belongs to. */
export const issuer = (placeId) => COUNTRIES[placeId]?.place?.nationalityOf ?? placeId;
const nameOf = (j) => theCountry(COUNTRIES[j]?.name ?? j);

/**
 * The nationalities a person holds now. People from before citizenship was
 * recorded, and people the game never looked at closely, hold the one that
 * goes with where they are from.
 */
export function held(person = player()) {
  if (person.citizenships) {
    const now = person.citizenships.filter((c) => !c.lostAt).map((c) => c.jurisdictionId);
    return [...new Set([...now, ...(person.flags?.citizenOf ?? [])])];
  }
  const p = store.state?.player;
  const from = person.birthCountryId ?? person.bornIn ?? (person.flags?.abroad && typeof person.flags.abroad === 'string' ? person.flags.abroad : null) ?? person.countryId ?? p?.birthCountryId;
  return [...new Set([issuer(from), ...(person.flags?.citizenOf ?? [])])];
}

/**
 * The citizenships a child is born with: each parent's, by descent, and the
 * place's own if it grants citizenship by birth. Never none: a child with no
 * claim anywhere takes the nationality of the place they were born in, which
 * is a gameplay rule against statelessness, not a legal one.
 * @param {string} placeId  where the birth happens
 * @param {string[][]} parents  the nationalities each known parent holds
 */
export function atBirth(placeId, parents, year) {
  const soil = issuer(placeId);
  const out = [];
  const add = (j, acquisitionType) => { if (j && !out.some((c) => c.jurisdictionId === j)) out.push({ jurisdictionId: j, acquisitionType, acquiredAt: year }); };
  if (BIRTHRIGHT.has(soil)) add(soil, 'birth');
  for (const list of parents) for (const j of list ?? []) add(j, j === soil ? 'birth' : 'descent');
  if (!out.length) add(soil, 'birth');
  return out;
}

/** May live there as of right: a citizen of it, or of the state it belongs to. */
export function rightToLive(placeId, person = player()) {
  const mine = held(person);
  return mine.includes(placeId) || mine.includes(issuer(placeId));
}

/** Where the player stands in the country they live in. */
export function residency(p = player()) {
  const here = p.countryId;
  if (rightToLive(here, p)) return { jurisdictionId: here, status: 'citizen', since: p.flags.arrivedYear ?? p.birthYear, workAuthorized: true, studyAuthorized: true };
  const r = p.residency?.jurisdictionId === here ? p.residency : null;
  return r ?? { jurisdictionId: here, status: 'permanent_resident', since: p.flags.arrivedYear ?? store.state.year, workAuthorized: true, studyAuthorized: true };
}
export const STATUS_WORDS = { citizen: 'Citizen', permanent_resident: 'Permanent resident', temporary_resident: 'Temporary resident', student: 'Student visa', worker: 'Work visa', retiree: 'Retirement visa' };

/** Called when the player settles somewhere: the old chapter of their address closes, a new one opens. */
export function settle(placeId, city, status = 'permanent_resident', meta = {}) {
  const p = player();
  const year = store.state.year;
  const list = (p.locations ??= [{ countryId: p.birthCountryId, city: p.birthCity ?? null, from: p.birthYear ?? year - p.age, reason: 'born' }]);
  const last = list[list.length - 1];
  if (last && last.to == null) { last.to = year; if (meta.homeBefore && !(last.homes ??= []).includes(meta.homeBefore)) last.homes.push(meta.homeBefore); }
  list.push({ countryId: placeId, city, from: year, reason: meta.reason ?? null, moveId: meta.moveId ?? null, eventId: meta.eventId ?? null, homes: [] });
  p.residency = rightToLive(placeId, p) ? null
    : { jurisdictionId: placeId, status, since: year, workAuthorized: !['student', 'retiree'].includes(status), studyAuthorized: true };
}
/** Everywhere the player has lived, oldest first. Lives from before this was kept show birthplace and home. */
export function locations(p = player()) {
  if (p.locations) return p.locations;
  const out = [{ countryId: p.birthCountryId, city: p.birthCountryId === p.countryId ? p.city : null, from: p.birthYear ?? store.state.year - p.age }];
  if (p.countryId !== p.birthCountryId) { out[0].to = p.flags.arrivedYear ?? null; out.push({ countryId: p.countryId, city: p.city, from: p.flags.arrivedYear ?? null }); }
  return out;
}

// ---------- Becoming a citizen ----------

/** What it would take to become a citizen of the country the player lives in. */
export function naturalization(p = player()) {
  const here = issuer(p.countryId);
  const c = country();
  const year = store.state.year;
  const mine = held(p);
  if (mine.includes(here)) return { possible: false, why: `You are already a citizen of ${nameOf(here)}.` };
  const spouse = livingNpcs().some((n) => n.role === 'spouse' && held(n).includes(here));
  const base = RESIDENCE_YEARS[here] ?? DEFAULT_YEARS;
  const needs = spouse ? Math.min(base, Math.max(SPOUSE_YEARS, Math.ceil(base / 2))) : base;
  const lived = year - (residency(p).since ?? year);
  const fee = localMoney(NATURALIZATION_FEE, c);
  // Taking a single-nationality citizenship means giving up the rest; and some of the rest give you up.
  const mustRenounce = SINGLE.has(here) ? mine : [];
  const willLose = SINGLE.has(here) ? [] : mine.filter((j) => SINGLE.has(j));
  const convicted = hasRecord(p, { sealed: true });
  let why = '';
  if (p.age < 18) why = 'You must be an adult to apply.';
  else if (base >= 90) why = `${nameOf(here).replace(/^the/, 'The')} does not, in practice, naturalize people who move there.`;
  else if (['student', 'worker', 'temporary_resident', 'retiree'].includes(residency(p).status)) why = 'Citizenship is for permanent residents. Your visa is temporary.';
  else if (lived < needs) why = `You need ${needs} years of residence${spouse ? ' (fewer, as you are married to a citizen)' : ''}. You have ${lived}.`;
  else if (convicted) why = 'A criminal conviction rules the application out.';
  else if (p.flags.natAge === p.age) why = 'You have applied this year. The next sitting is next year.';
  else if (p.finance.cash < fee) why = `The fee is ${fmtMoney(fee, c)}. You do not have it.`;
  const speak = speaks(p.countryId, p);
  const chance = clamp(0.62 + (speak == null ? 0.2 : (speak - 40) / 200) + (p.stats.intellect - 50) / 400, 0.3, 0.97);
  return { possible: !why, why, here, needs, lived, fee, spouse, mustRenounce, willLose, chance,
    outlook: chance >= 0.85 ? 'You should pass the test comfortably.' : chance >= 0.65 ? 'The test will take some study.' : 'The language will make the test hard.' };
}

/** Applies. There is a test; passing it is not certain. */
export function naturalize() {
  const p = player();
  const n = naturalization(p);
  if (!n.possible) return result(false, n.why, 'neutral');
  const c = country();
  const year = store.state.year;
  p.flags.natAge = p.age;
  p.finance.cash -= n.fee;
  if (!rng.chance(n.chance)) {
    const text = `You sat the citizenship test for ${nameOf(n.here)} and did not pass. You can sit it again next year.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  // Lives from before citizenship was recorded get their record now, so that losing one can be written down.
  p.citizenships ??= held(p).map((j) => ({ jurisdictionId: j, acquisitionType: 'birth', acquiredAt: p.birthYear ?? year - p.age }));
  const gone = [...n.mustRenounce, ...n.willLose];
  for (const rec of p.citizenships) if (!rec.lostAt && gone.includes(rec.jurisdictionId)) rec.lostAt = year;
  if (p.flags.citizenOf) p.flags.citizenOf = p.flags.citizenOf.filter((j) => !gone.includes(j));
  p.citizenships.push({ jurisdictionId: n.here, acquisitionType: 'naturalization', acquiredAt: year });
  p.residency = null;
  // Children under eighteen who live with the player become citizens with them. A husband or wife does not: they apply in their own right.
  const kids = livingNpcs().filter((k) => k.role === 'child' && k.age < 18 && !k.flags.abroad && !held(k).includes(n.here));
  for (const k of kids) {
    k.citizenships ??= held(k).map((j) => ({ jurisdictionId: j, acquisitionType: 'birth', acquiredAt: year - k.age }));
    if (SINGLE.has(n.here)) for (const rec of k.citizenships) if (!rec.lostAt) rec.lostAt = year;
    k.citizenships.push({ jurisdictionId: n.here, acquisitionType: 'with a parent', acquiredAt: year });
    k.residency = null;
  }
  p.stats.mood = clamp(p.stats.mood + 8);
  const lost = gone.length ? ` ${n.mustRenounce.length ? 'You gave up' : 'By its own law you lost'} your citizenship of ${gone.map(nameOf).join(' and ')}.` : '';
  const text = `You took the oath. You are a citizen of ${nameOf(n.here)}.${lost}${kids.length ? ` ${kids.map((k) => k.firstName).join(' and ')} became citizen${kids.length > 1 ? 's' : ''} with you.` : ''} It cost ${fmtMoney(n.fee, c)}.`;
  log(text, 'system', 'good');
  milestone(`Became a citizen of ${nameOf(n.here)}.`, 'life');
  return result(true, text);
}

/** Everything the passport page shows about who the player is on paper. */
export function papers(p = player()) {
  const flag = (j) => COUNTRIES[j]?.flag ?? '';
  const how = { birth: 'by birth', descent: 'through a parent', naturalization: 'by naturalization', restoration: 'restored' };
  const records = p.citizenships ?? held(p).map((j) => ({ jurisdictionId: j, acquisitionType: 'birth', acquiredAt: p.birthYear }));
  const r = residency(p);
  return {
    born: { id: p.birthCountryId, name: COUNTRIES[p.birthCountryId]?.name, flag: flag(p.birthCountryId) },
    citizenships: records.map((c) => ({ id: c.jurisdictionId, name: COUNTRIES[c.jurisdictionId]?.name ?? c.jurisdictionId, flag: flag(c.jurisdictionId),
      how: how[c.acquisitionType] ?? '', since: c.acquiredAt ?? null, lost: c.lostAt ?? null })),
    residency: { ...r, name: COUNTRIES[r.jurisdictionId]?.name, flag: flag(r.jurisdictionId), word: STATUS_WORDS[r.status] },
    locations: locations(p).map((l) => ({ ...l, name: COUNTRIES[l.countryId]?.name, flag: flag(l.countryId) })),
    naturalization: naturalization(p),
  };
}
