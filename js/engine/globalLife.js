// The Global Life engine's yearly turn and its records of people and places.
// The pieces live in their own modules (geo, documents, travel, relocation,
// chronicle); this one keeps them in step with the world clock and with the
// people in the save:
//
//   - the year's calendar, papers that run out, decisions due (documents, relocation)
//   - where everyone in the player's life lives, as a history (n.places)
//   - relatives abroad who come to visit, if they want to and can
//   - children growing up with a parent's language at home
//   - settling in after a move, which takes some people longer than others
//   - births, with where they happened and the nationality each child was given
//
// It also brings older saves up to date, deriving only what the save already
// implies and marking it so; nothing is invented.
import { rng } from '../rng.js';
import { clamp, theCountry } from '../util.js';
import { store, player, livingNpcs, log } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { languagesOf } from './languages.js';
import { held } from './citizenship.js';
import { recordEvent, archiveIdOf, rememberHome } from './chronicle.js';
import { tickPapers, entryRule, needsAuthorization, ensureOwnPassport, today, addDays } from './documents.js';
import { tickRelocation } from './relocation.js';
import { tickCredentials } from './credentials.js';
import { openYear, earn, travelState, compactHistory } from './travel.js';
import { placeName } from './geo.js';
import { remember } from './conditions.js';
import { tickAbroadArcs } from './abroadArcs.js';
import { tickChildrenSettling } from './familyMove.js';

const nameOf = (id) => theCountry(COUNTRIES[id]?.name ?? id);
const hash = (s) => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h; };

/** Where someone in the player's life lives now: their own country if they live abroad, otherwise the player's. */
export const npcCountry = (n, p = player()) => (typeof n.flags?.abroad === 'string' && COUNTRIES[n.flags.abroad] ? n.flags.abroad : p.countryId);

/**
 * Keeps a residence history for everyone in the player's life. The first entry
 * for someone the game never followed is derived (marked so); after that each
 * change is written when it happens.
 */
export function syncNpcPlaces(p = player()) {
  const year = store.state.year;
  // People who share the player's home live in the player's city; anyone else, as far as the record goes, in a country.
  const household = (n) => !n.flags.abroad && (n.role === 'spouse' || n.role === 'pet' || (n.role === 'child' && n.age < 18) || (n.role === 'partner' && n.flags.livesTogether) || (n.role === 'parent' && p.flags.livesWithParents));
  for (const n of Object.values(store.state.npcs)) {
    if (!n.alive) { const last = n.places?.[n.places.length - 1]; if (last && last.to == null) last.to = n.flags.diedYear ?? year; continue; }
    const now = npcCountry(n, p);
    const city = household(n) ? p.city ?? null : null;
    if (!n.places) {
      const born = n.bornIn && COUNTRIES[n.bornIn] ? n.bornIn : now;
      n.places = born !== now
        ? [{ countryId: born, city: n.birthCity ?? null, from: year - (n.age ?? 0), to: n.flags.movedYear ?? null, derived: true }, { countryId: now, city, from: n.flags.movedYear ?? null, derived: true }]
        : [{ countryId: now, city: n.birthCity && n.birthCity === city ? city : n.birthCity ?? city, from: year - (n.age ?? 0), derived: true }];
      continue;
    }
    const last = n.places[n.places.length - 1];
    if (last.countryId !== now) { last.to = year; n.places.push({ countryId: now, city, from: year }); }
    else if (city && last.city && last.city !== city) { last.to = year; n.places.push({ countryId: now, city, from: year }); }
    else if (city && !last.city) last.city = city;
  }
}

/** A child's birth: where, and on what basis each nationality came. One event per child. */
export function noteBirth(child, p = player()) {
  child.birthCity ??= p.city;
  const how = { birth: 'by birth there', descent: 'through a parent' };
  const nat = (child.citizenships ?? []).map((c) => `${COUNTRIES[c.jurisdictionId]?.name ?? c.jurisdictionId} (${how[c.acquisitionType] ?? c.acquisitionType})`);
  const abroad = !held(p).includes(p.countryId) || (p.countryId !== p.birthCountryId);
  recordEvent({ key: `birth:${child.id}`, type: 'birth', subject: archiveIdOf(child), people: [archiveIdOf(p)], title: `${child.firstName} was born in ${placeName(p.countryId, p.city)}`,
    text: nat.length ? `Nationality: ${nat.join('; ')}.` : '', place: { countryId: p.countryId, city: p.city }, significance: abroad ? 3 : 2, privacy: 'family', abroad });
}

/** Relatives abroad sometimes come to visit: when they are close, well, free and able to travel. */
export function tickVisits(p = player()) {
  const out = [];
  if (store.state.year === p.birthYear) return out;
  for (const n of livingNpcs()) {
    if (typeof n.flags.abroad !== 'string' || !['parent', 'sibling', 'child', 'grandparent', 'spouse', 'grandchild', 'friend', 'bestfriend'].includes(n.role)) continue;
    if (n.flags.abroad === p.countryId || n.age < 18 || n.age > 88 || n.meters.relationship < 55 || n.meters.health < 40) continue;
    if (!rng.chance(['friend', 'bestfriend'].includes(n.role) ? 0.06 : 0.14)) continue;
    // They need to be able to come: a passport, and whatever the border asks of them.
    const from = today();
    const to = addDays(from, 10);
    if (!ensureOwnPassport(n, from, to)) continue;
    const rule = entryRule(n, p.countryId, 'visit', store.state.year, 10);
    if (needsAuthorization(rule.kind) && rule.kind !== 'eta' && !rng.chance(0.8)) {
      out.push({ text: `${n.firstName} wanted to come and see you, but could not get a visa this year.`, tone: 'neutral' });
      continue;
    }
    n.meters.relationship = clamp(n.meters.relationship + rng.int(4, 9));
    n.lastInteractionAge = p.age;
    p.stats.mood = clamp(p.stats.mood + 3);
    remember(n, `visited_you_${store.state.year}`, `They came to see you in ${p.city}.`);
    recordEvent({ key: `visit:${n.id}:${store.state.year}`, type: 'family_visit', title: `${n.firstName} came from ${nameOf(n.flags.abroad)} to visit`, people: [archiveIdOf(n)],
      place: { countryId: p.countryId, city: p.city }, significance: 2, privacy: 'family' });
    out.push({ text: `${n.firstName} came all the way from ${nameOf(n.flags.abroad)} to see you, and stayed ten days.`, tone: 'good' });
  }
  return out;
}

/**
 * A child living with a parent who grew up with another language picks some
 * of it up, at a pace of their own: nobody is guaranteed fluency in every
 * family language, and none of it is a deficit.
 */
export function tickHeritage(p = player()) {
  if (p.age < 1 || p.age >= 18 || !p.flags.livesWithParents) return null;
  const local = languagesOf(p.countryId);
  let line = null;
  for (const n of livingNpcs().filter((x) => x.role === 'parent' && !x.flags.abroad)) {
    const theirs = languagesOf(n.bornIn ?? '').filter((l) => !local.includes(l) && !languagesOf(p.birthCountryId).includes(l));
    for (const lang of theirs) {
      if (!SKILL_BY_ID[lang]) continue;
      p.skills ??= {};
      const before = p.skills[lang] ?? 0;
      const pace = 2 + (hash(`${p.id}:${lang}`) % 7); // 2 to 8 a year: each child their own
      p.skills[lang] = clamp(before + pace, 0, 90);
      (p.languageLog ??= []).push({ year: store.state.year, lang, source: `at home, from ${n.firstName}`, gain: p.skills[lang] - before });
      if (before < 40 && p.skills[lang] >= 40) line = `You can hold a conversation in ${SKILL_BY_ID[lang].name} now: ${n.firstName} has always spoken it at home.`;
    }
  }
  return line;
}

/**
 * The first years after a move. People with friends nearby, or who are easy
 * in company, find their feet sooner; it is not an illness, and it ends.
 */
export function tickSettling(p = player()) {
  const s = p.flags.settling;
  if (!s || s.countryId !== p.countryId) { if (s) delete p.flags.settling; return null; }
  const years = store.state.year - s.since;
  const friends = livingNpcs().filter((n) => ['friend', 'bestfriend', 'colleague', 'coworker', 'spouse', 'partner'].includes(n.role) && !n.flags.abroad).length;
  const easy = (p.traits ?? []).some((t) => ['sunny', 'radiant', 'restless'].includes(t));
  const hard = (p.traits ?? []).some((t) => ['worrier', 'delicate'].includes(t));
  const ready = years >= (easy ? 1 : hard ? 3 : 2) && friends >= 2;
  if (ready || years >= 5) {
    delete p.flags.settling;
    recordEvent({ key: `belonging:${archiveIdOf(p)}:${s.countryId}:${s.since}`, type: 'belonging', title: `At home in ${COUNTRIES[s.countryId].name}`, place: { countryId: s.countryId, city: p.city }, significance: 1, privacy: 'private' });
    return { text: `Somewhere along the way ${p.city} stopped feeling new. ${COUNTRIES[s.countryId].name} is home now, and so, still, is ${nameOf(p.birthCountryId)}.`, tone: 'good' };
  }
  if (!friends && !easy && rng.chance(0.5)) { p.stats.mood = clamp(p.stats.mood - 3); return { text: `Some days in ${p.city} are lonely. You miss home, and the people in it.`, tone: 'neutral' }; }
  if (easy && rng.chance(0.4)) { p.stats.mood = clamp(p.stats.mood + 2); return { text: `${p.city} is still full of surprises, and you are enjoying most of them.`, tone: 'good' }; }
  return null;
}

/** The turn of the year for papers: the calendar restarts, and decisions due are made. Called just after the clock moves. */
export function openGlobalYear() {
  openYear();
  compactHistory();
  const lines = [];
  for (const t of tickPapers()) lines.push({ text: t, tone: /refused|expired/.test(t) ? 'bad' : /granted/.test(t) ? 'good' : 'neutral' });
  for (const t of tickRelocation()) lines.push({ text: t, tone: /approved/.test(t) ? 'good' : /refused|lapsed/.test(t) ? 'bad' : 'neutral' });
  lines.push(...tickCredentials());
  for (const l of lines) log(l.text, 'system', l.tone);
  return lines;
}

/** The rest of the year's turn: who lives where, visits, languages at home, settling in, achievements. Called once the world has moved. */
export function tickGlobalLife() {
  const p = player();
  const lines = [];
  syncNpcPlaces(p);
  lines.push(...tickVisits(p));
  const h = tickHeritage(p);
  if (h) lines.push({ text: h, tone: 'good' });
  lines.push(...tickChildrenSettling(p));
  const s = tickSettling(p);
  if (s) lines.push(s);
  for (const name of earn(p)) lines.push({ text: `Achievement: ${name}.`, tone: 'good' });
  tickAbroadArcs(p); // at most one story of a life abroad begins, from what is really so
  for (const l of lines) log(l.text, 'system', l.tone);
  for (const a of p.assets) if (a.kind === 'property') rememberHome(a, p);
  // Keep the current home in the record of where they live.
  const cur = (p.locations ?? [])[p.locations?.length - 1];
  if (cur && p.homeId && !(cur.homes ??= []).includes(p.homeId)) cur.homes.push(p.homeId);
  return lines;
}

/**
 * Brings any save up to date. Idempotent. Derives only what the save already
 * implies, and marks it derived. Older trips stay as they were recorded
 * (country and year): no dates, passports or visas are invented for them.
 */
export function ensureGlobal(state) {
  const p = state.player;
  state.canon ??= { events: [] };
  state.archive ??= { people: {} };
  state.today ??= `${state.year}-01-01`;
  if (!state.today.startsWith(String(state.year))) state.today = `${state.year}-01-01`;
  p.archiveId ??= p.id;
  p.travel ??= { trips: [], whereabouts: null, earned: {} };
  p.travel.earned ??= {};
  p.applications ??= [];
  p.finance.receipts ??= [];
  p.documents ??= [];
  // A first life that never moved city still lives in the city it was born in.
  if (p.birthCity === undefined) {
    p.birthCity = !p.locations && (p.generation ?? 1) === 1 && p.birthCountryId === p.countryId ? p.city ?? null : null;
    if (p.birthCity) p.birthCityDerived = true;
  }
  for (const l of p.locations ?? []) { l.homes ??= []; if (!('reason' in l)) l.reason = null; }
  return state;
}

export { travelState };
