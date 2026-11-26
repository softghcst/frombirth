// Employers and the job market. An employer is a persistent organization in a
// city: it has a name, a size, a culture, finances that move with the
// economy, staff the player has met, and a history. Openings come from
// employers (never from nowhere), stay up until they are filled, withdrawn or
// expire, and other people apply for them too.
//
//   state.jobs = {
//     employers: { [id]: Employer },   every organization the world has made
//     cities:    { 'cc/City': [ids] }, which employers a city has (made the first time anyone looks)
//     postings:  { [id]: Posting },    open and recently closed openings
//     seq:       number,               for ids that are the same on every load
//     seen:      { 'cc/City': year },  when the player last looked at a city's market
//   }
//   Employer: { id, name, family, tracks[], countryId, city, size, culture, payK, health, remote,
//               founded, closed, staff[npcIds], history[{year,text}] }
//   Posting:  { id, employerId, careerId, level, title, countryId, city, pay:[lo,hi], hours, partTime,
//               remote, posted, expires, status:'open'|'filled'|'withdrawn'|'expired', filledBy, internal }
//
// Background employers are aggregate: only the people the player has met are
// simulated. Ones the player works for (or did) are detailed.
import { rng } from '../rng.js';
import { clamp, localWage } from '../util.js';
import { store, player } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { CAREERS, CAREER_BY_ID } from '../data/careers.js';
import { FAMILY_BY_ID } from '../data/occupations.js';
import { NAME_PATTERNS, WORDS, SIZES, CULTURES, CITY_FOCUS, FAMILY_BASE, EVERYWHERE, publicOfficeName } from '../data/employers.js';
import { cityOf } from './cities.js';
import { phase } from './economy.js';

const K = 1000;
/** Openings stay up this many years unless filled. */
export const POSTING_LIFE = 2;

/** A small generator of its own, so making a city's employers does not disturb the game's dice. */
function seeded(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let s = h >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (a, b) => a + Math.floor(next() * (b - a + 1)), pick: (arr) => arr[Math.floor(next() * arr.length)], chance: (p) => next() < p };
}

/** The job-market part of the save, made if it is missing. */
export function jobs(state = store.state) {
  state.jobs ??= { employers: {}, cities: {}, postings: {}, seq: 0, seen: {} };
  state.jobs.seen ??= {};
  return state.jobs;
}
const nextId = (prefix) => `${prefix}_${(jobs().seq += 1).toString(36)}`;
const year = () => store.state.year;

export const employer = (id) => (id ? jobs().employers[id] ?? null : null);
export const posting = (id) => (id ? jobs().postings[id] ?? null : null);
export const sizeOf = (e) => SIZES[e.size];
export const cultureOf = (e) => CULTURES[e.culture];
/** Tracks belonging to a family. */
const tracksIn = (family) => CAREERS.filter((c) => c.family === family && c.type !== 'military' && !c.agesOut && !c.agencyHire); // an agency's own track is staffed by the agency (engine/investigations)

function makeName(r, family, countryId, city) {
  const names = COUNTRIES[countryId].names.last;
  const pattern = r.pick(NAME_PATTERNS[family] ?? NAME_PATTERNS.corporate);
  const s = r.pick(names);
  let s2 = r.pick(names);
  if (s2 === s) s2 = names[(names.indexOf(s) + 1) % names.length];
  return pattern.replace('{S}', s).replace('{S2}', s2).replace('{C}', city).replace('{W}', r.pick(WORDS[family] ?? WORDS.corporate));
}

function makeEmployer(r, family, countryId, city) {
  const size = r.next() < 0.45 ? 'small' : r.next() < 0.6 ? 'medium' : r.next() < 0.75 ? 'large' : 'major';
  const own = tracksIn(family);
  // Small places hire for a few kinds of work; big ones for most of their field, and the office work every big organization needs.
  const n = { small: 2, medium: 4, large: 7, major: 12 }[size];
  const tracks = [...own].sort(() => r.next() - 0.5).slice(0, Math.min(own.length, n)).map((c) => c.id);
  if (size === 'large' || size === 'major') for (const id of EVERYWHERE) if (!tracks.includes(id) && r.chance(size === 'major' ? 0.6 : 0.3)) tracks.push(id);
  const id = nextId('emp');
  const e = {
    id, name: makeName(r, family, countryId, city), family, tracks, countryId, city, size,
    culture: r.pick(Object.keys(CULTURES)), payK: Math.round((0.88 + r.next() * 0.26) * 100) / 100,
    health: r.int(45, 85), remote: r.chance(family === 'tech' ? 0.8 : 0.35), founded: (store.state?.year ?? 2000) - r.int(2, 90),
    closed: null, staff: [], history: [],
  };
  jobs().employers[id] = e;
  return e;
}

/**
 * The employers of a city, made the first time anyone asks. Every family is
 * represented at least once, more where the city is known for it.
 */
export function cityEmployers(countryId, city) {
  const J = jobs();
  const key = `${countryId}/${city}`;
  if (!J.cities[key]) {
    const r = seeded(`${key}/${store.state?.player?.birthYear ?? 0}`);
    const c = cityOf(countryId, city);
    const big = c.kind === 'capital' || c.kind === 'largest' ? 1.4 : 1;
    const focus = CITY_FOCUS[key] ?? {};
    const ids = [];
    for (const [family, base] of Object.entries(FAMILY_BASE)) {
      const gov = family === 'government' && c.kind === 'capital' ? 2.5 : 1;
      const count = Math.max(1, Math.round(base * big * gov * (focus[family] ?? 1) * (0.8 + r.next() * 0.4)));
      for (let i = 0; i < count; i++) ids.push(makeEmployer(r, family, countryId, city).id);
    }
    J.cities[key] = ids;
  }
  // A city's market is only kept moving while someone is looking at it. Coming back to one after
  // a while, it has the openings a year or two would have brought: made now, not every year in between.
  const now = store.state?.year ?? 0;
  if ((J.seen[key] ?? -99) < now - POSTING_LIFE) {
    const r = seeded(`${key}/${now}`);
    for (const id of J.cities[key]) {
      const e = J.employers[id];
      if (e.closed || e.sportClub) continue;
      const n = Math.round(sizeOf(e).openings * 1.5 * (0.6 + e.health / 100) + r.next());
      for (let i = 0; i < n; i++) openPosting(e, { r, age: r.int(0, POSTING_LIFE - 1) });
    }
  }
  J.seen[key] = now;
  return J.cities[key].map((id) => J.employers[id]).filter((e) => e && !e.closed && !e.owned && !e.sportClub);
}

/**
 * Puts a business the player owns on the map as an employer, so the people who
 * work there have a real place of work. It is run by engine/business.js, not
 * by the yearly employer tick: no openings appear on the board for it.
 */
export function registerEmployer({ name, family, tracks, countryId, city, owned = true }) {
  cityEmployers(countryId, city);
  const id = nextId('emp');
  const e = { id, name, family, tracks, countryId, city, size: 'small', culture: 'supportive', payK: 1, health: 60, remote: false,
    founded: store.state.year, closed: null, staff: [], history: [], owned };
  jobs().employers[id] = e;
  jobs().cities[`${countryId}/${city}`].push(id);
  return e;
}

/** Employers the player has a connection to: worked there, or knows someone who does. Their stories are kept in detail. */
function connected(e) {
  const p = player();
  return e.owned || e.id === p.career.employerId || (p.career.sides ?? []).some((s) => s.employerId === e.id) || p.career.history.some((h) => h.employerId === e.id) || e.staff.length > 0;
}

/** Every employer that exists in a country (only cities that have been looked at). */
export const countryEmployers = (countryId) => Object.values(jobs().employers).filter((e) => e.countryId === countryId && !e.closed && !e.public);

/** What a level pays at an employer, in the local currency, for a year at full time. */
export function payAt(e, career, level) {
  const lv = career.levels[level];
  const k = cityOf(e.countryId, e.city).pay * e.payK * SIZES[e.size].pay;
  return lv.pay.map((x) => Math.round(localWage(x * K, COUNTRIES[e.countryId]) * k));
}

/** The level an opening is for: most are at the bottom of a ladder, fewer further up. */
function pickLevel(r, career) {
  const top = career.levels.length - 1;
  const roll = r.next();
  const lv = roll < 0.5 ? 0 : roll < 0.78 ? 1 : roll < 0.93 ? 2 : roll < 0.985 ? 3 : 4;
  return Math.min(top, lv);
}

/**
 * A city's public legal office for a job (the prosecutor's office, the public defender's, the court), or null for any
 * other job. Kept apart from the city's list of firms, with an id of its own, so it changes nothing about them.
 */
export function publicOffice(careerId, countryId, city) {
  const name = publicOfficeName(careerId, countryId, city);
  if (!name) return null;
  const id = `emp_pub_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  const J = jobs();
  if (!J.employers[id]) J.employers[id] = { id, name, family: CAREER_BY_ID[careerId]?.family ?? 'law', tracks: [], countryId, city, size: 'large', culture: 'supportive', payK: 1, health: 70, remote: false,
    founded: (store.state?.year ?? 2000) - 90, closed: null, staff: [], history: [], owned: false, public: true };
  const e = J.employers[id];
  if (!e.tracks.includes(careerId)) e.tracks.push(careerId);
  return e;
}

/**
 * Opens a vacancy at an employer.
 * @param {object} e
 * @param {{careerId?:string, level?:number, r?:object, age?:number, internal?:boolean}} [o]
 */
export function openPosting(e, o = {}) {
  const r = o.r ?? rng;
  if (!e.tracks.length) return null;
  const career = CAREER_BY_ID[o.careerId ?? r.pick(e.tracks)];
  if (!career) return null;
  const level = o.level ?? pickLevel(r, career);
  const partTime = !o.internal && ['hourly', 'tips'].includes(career.payModel) && level <= 1 && r.next() < 0.4;
  const hours = partTime ? r.int(3, 6) * 4 : career.hours;
  const full = payAt(e, career, level);
  const pay = partTime ? full.map((x) => Math.round(x * hours / career.hours)) : full;
  const posted = (store.state?.year ?? 0) - (o.age ?? 0);
  const id = nextId('job');
  // A prosecutor's or public defender's post is advertised by the public office, never by a private firm.
  if (!e.public) { const office = publicOffice(career.id, e.countryId, e.city); if (office) e = office; }
  const post = {
    id, employerId: e.id, careerId: career.id, level, title: career.levels[level].title, countryId: e.countryId, city: e.city,
    pay, hours, partTime, remote: e.remote && career.remote !== 'none' ? career.remote : 'none',
    posted, expires: posted + POSTING_LIFE, status: 'open', filledBy: null, internal: !!o.internal,
  };
  jobs().postings[id] = post;
  return post;
}

/** Marks an opening as taken. */
export function fillPosting(id, by) {
  const post = posting(id);
  if (!post || post.status !== 'open') return false;
  post.status = 'filled';
  post.filledBy = by;
  post.filledYear = year();
  return true;
}

export const isOpen = (post) => !!post && post.status === 'open' && post.expires >= year() && !employer(post.employerId)?.closed;

/**
 * Openings the player can see.
 * @param {{scope?:'here'|'country'|'remote', family?:string, partTime?:boolean|null, careerId?:string}} [f]
 */
export function board(f = {}) {
  const p = player();
  const scope = f.scope ?? 'here';
  cityEmployers(p.countryId, p.city);
  return Object.values(jobs().postings).filter((post) => {
    if (!isOpen(post) || post.internal) return false;
    if (post.countryId !== p.countryId) return false;
    if (scope === 'here' && post.city !== p.city) return false;
    if (scope === 'remote' && post.remote !== 'remote') return false;
    if (f.family && CAREER_BY_ID[post.careerId].family !== f.family) return false;
    if (f.careerId && post.careerId !== f.careerId) return false;
    if (f.partTime === true && !post.partTime) return false;
    if (f.partTime === false && post.partTime) return false;
    return true;
  }).sort((a, b) => b.posted - a.posted || a.title.localeCompare(b.title));
}

/** Records something in an employer's history. */
export function chronicle(e, text) {
  if (!e) return;
  e.history.push({ year: year(), text });
  if (e.history.length > 20) e.history.splice(0, e.history.length - 20);
}

/** A reputation out of 100, from what people who work there would say. */
export function reputation(e) {
  const c = CULTURES[e.culture];
  return Math.round(clamp(50 + c.satisfaction * 2 - c.stress + (e.payK - 1) * 80 + (e.health - 60) / 3));
}

/** One line about an employer, for lists. */
export const describe = (e) => `${FAMILY_BY_ID[e.family]?.name ?? 'Business'} · ${SIZES[e.size].label.split(' (')[0]} · ${CULTURES[e.culture].label} · ${e.city}`;

/**
 * Which employer someone with this job works for, in a city: an existing one
 * that hires for the track if there is one, otherwise a fresh one.
 */
export function placeAt(careerId, countryId, city) {
  const career = CAREER_BY_ID[careerId];
  const list = cityEmployers(countryId, city);
  // A public office: the one office of its kind in the city, not a private firm.
  const office = publicOffice(careerId, countryId, city);
  if (office) return office;
  const fits = list.filter((e) => e.tracks.includes(careerId));
  if (fits.length) return rng.pick(fits);
  const same = list.filter((e) => e.family === career.family);
  if (same.length) {
    const e = rng.pick(same);
    e.tracks.push(careerId);
    return e;
  }
  const e = makeEmployer(seeded(`${countryId}/${city}/${careerId}/${jobs().seq}`), career.family, countryId, city);
  e.tracks = [careerId, ...e.tracks.filter((t) => t !== careerId)];
  jobs().cities[`${countryId}/${city}`]?.push(e.id);
  return e;
}

// ---------- The year ----------

/**
 * Employers have a year: finances follow the economy, some grow and hire,
 * some shrink, a few close. Openings expire or are taken by other people.
 * @returns {{closed:object[], cut:object[]}} employers that closed or cut staff this year
 */
export function tickEmployers() {
  const p = player();
  const J = jobs();
  cityEmployers(p.countryId, p.city);
  const ph = phase(p.countryId);
  const out = { closed: [], cut: [] };
  const now = year();
  // Lighten the records of employers nobody is connected to.
  for (const e of Object.values(J.employers)) if (!connected(e) && e.history.length > 3) e.history = e.history.slice(-3);
  for (const e of Object.values(J.employers)) {
    if (e.closed || e.owned || e.sportClub || e.public) continue; // a public office has no market year; a business the player owns is run by engine/business.js; a sports club by engine/sportsLife.js
    const local = e.countryId === p.countryId ? ph : { hiring: 0, layoff: 0.03 };
    const detailed = connected(e);
    const live = (J.seen[`${e.countryId}/${e.city}`] ?? -99) >= now - 1 || detailed; // markets being watched
    e.health = Math.round(clamp(e.health + rng.around(0, 7) + local.hiring * 30 - (local.layoff - 0.03) * 60 + (60 - e.health) * 0.05, 0, 100));
    // Very weak employers close, or cut staff.
    if (e.health < 14 && rng.chance(e.size === 'small' ? 0.45 : e.size === 'medium' ? 0.25 : 0.08)) {
      e.closed = now;
      chronicle(e, `${e.name} closed its doors.`); // kept: the record of a place outlives it
      for (const post of Object.values(J.postings)) if (post.employerId === e.id && post.status === 'open') post.status = 'withdrawn';
      out.closed.push(e);
      continue;
    }
    if (e.health < 30 && rng.chance(0.3 * SIZES[e.size].layoff)) {
      if (detailed) chronicle(e, `${e.name} cut jobs.`);
      out.cut.push(e);
    }
    if (detailed && rng.chance(0.05)) chronicle(e, `${e.name} has new leadership.`);
    if (detailed && e.health > 80 && rng.chance(0.08)) chronicle(e, `${e.name} expanded.`);
    if (!live) continue;
    // New openings: people leave, and healthy employers grow.
    const want = SIZES[e.size].openings * (0.6 + e.health / 100) * (1 + local.hiring * 2);
    const n = Math.floor(want) + (rng.chance(want % 1) ? 1 : 0);
    for (let i = 0; i < n; i++) openPosting(e);
  }
  // Openings: other people take them, or they lapse.
  for (const post of Object.values(J.postings)) {
    if (post.status !== 'open') continue;
    if (post.expires < now) { post.status = 'expired'; continue; }
    const competition = 0.32 + ph.hiring * -1 + (post.level === 0 ? 0.12 : 0);
    if (post.posted < now && rng.chance(clamp(competition, 0.15, 0.6))) fillPosting(post.id, 'someone else');
  }
  // Keep the save small: a closed opening is forgotten after a year, unless the player took it or still holds an offer or lead for it.
  const held = new Set([...p.career.offers ?? [], ...p.career.leads ?? []].map((x) => x.postingId));
  for (const [id, post] of Object.entries(J.postings)) if (post.status !== 'open' && post.filledBy !== 'player' && !held.has(id) && (post.filledYear ?? post.expires) < now - 1) delete J.postings[id];
  return out;
}
