// Historical Eras: the one place the game asks what the year means.
//
// Every system that behaves differently in the past asks here: which era it
// is, what money is worth and what it is called, what the law was, which
// careers and degrees exist, how medicine and mortality stood, and which
// broad events were under way. The answers come from js/data/history.js;
// communication technology stays in the Digital World's registry
// (js/engine/digital/tech.js), which this module reuses rather than copies.
//
// From 2025 on, every answer here is today's game unchanged.
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, log, milestone } from '../state.js';
import { COUNTRIES, COUNTRY_LIST } from '../data/countries.js';
import { ERAS, ERA_BY_ID, MONEY_ANCHORS, CURRENCY_HISTORY, LAW_HISTORY, CAREER_ERAS, PARENT_OCCUPATIONS, MODERN_OCCUPATIONS,
  MAJOR_FROM, UNIVERSITY_ACCESS, SECONDARY, SCENE_FROM, HEALTH, TREATMENT_HISTORY, PROCEDURE_FROM, EVENTS } from '../data/history.js';
import { OCCUPATIONS } from '../data/traits.js';
import { techAvailable } from './digital/tech.js';

export const MODERN_YEAR = 2025;

// ---------- Eras ----------

/** The era a year belongs to. Years before 1800 count as the earliest era. */
export function getEra(year) {
  return ERAS.find((e) => year >= e.from && year <= e.to) ?? (year < ERAS[0].from ? ERAS[0] : ERAS[ERAS.length - 1]);
}
/** The era of the life being played, from the world's year. */
export const currentEra = (state = store.state) => getEra(state?.year ?? MODERN_YEAR);
export const isModern = (year = store.state?.year ?? MODERN_YEAR) => getEra(year).id === 'now';

/** Everything the era says, for a year and country, in one object. */
export function getEraRules(year, countryId) {
  const era = getEra(year);
  return { era, money: moneyIndex(year), currency: currencyFor(countryId, year), universityAccess: UNIVERSITY_ACCESS[era.id], health: HEALTH[era.id] };
}

/** The era a year moved into, if it moved. */
export function getEraTransition(previousYear, currentYear) {
  const a = getEra(previousYear);
  const b = getEra(currentYear);
  return a.id === b.id ? null : { from: a, to: b, year: currentYear };
}

/** The eras someone lived through, born and died (or still alive) in these years. */
export function erasBetween(fromYear, toYear) {
  return ERAS.filter((e) => e.to >= fromYear && e.from <= toYear);
}

// ---------- Money ----------

/**
 * [estimate] What money is worth in a year, relative to today: the era's price level
 * times its real wage. Interpolated (in proportion) between the anchors.
 */
export function moneyIndex(year) {
  if (year >= MODERN_YEAR) return 1;
  const at = (i) => MONEY_ANCHORS[i][1] * MONEY_ANCHORS[i][2];
  if (year <= MONEY_ANCHORS[0][0]) return at(0);
  for (let i = 1; i < MONEY_ANCHORS.length; i++) {
    const [y1] = MONEY_ANCHORS[i];
    if (year <= y1) {
      const [y0] = MONEY_ANCHORS[i - 1];
      const t = (year - y0) / (y1 - y0);
      return Math.exp(Math.log(at(i - 1)) * (1 - t) + Math.log(at(i)) * t);
    }
  }
  return 1;
}

/** Today's currency of every country, kept before any era changes it. */
const MODERN = Object.fromEntries(COUNTRY_LIST.map((c) => [c.id, { ...c.currency }]));
export const modernCurrency = (countryId) => MODERN[countryId];

/**
 * The currency in use in a country in a year, with its `scale`: units per base unit
 * (USD-like, today), including what money was worth then. `money: 'modern'` (lives saved
 * before eras) keeps today's money.
 */
export function currencyFor(countryId, year, money = 'era') {
  const now = MODERN[countryId];
  if (!now) return null;
  if (money === 'modern' || year >= MODERN_YEAR) return { ...now, name: now.code === 'EUR' ? 'euro' : now.code, historical: false };
  const idx = moneyIndex(year);
  const chain = CURRENCY_HISTORY[countryId] ?? [];
  // Walk back from today's currency through each predecessor in use by this year.
  let per = 1;
  let cur = null;
  for (let i = chain.length - 1; i >= 0; i--) {
    if (year > chain[i].until) break;
    per *= chain[i].per;
    cur = chain[i];
  }
  return cur ? { code: cur.code, symbol: cur.symbol, scale: now.scale * per * idx, name: cur.name, historical: true, official: cur.official !== false }
    : { ...now, name: now.code === 'EUR' ? 'euro' : now.code, scale: now.scale * idx, historical: false };
}

/**
 * Sets every country's currency for a year. Amounts in the game are always in the
 * money of the year being played; this keeps formatting and prices in step.
 */
let syncedYear = MODERN_YEAR;
/** The year the world's currencies were last set for (character creation reads it before a life exists). */
export const worldYear = () => syncedYear;
export function syncWorld(year, money = 'era') {
  syncedYear = year;
  for (const c of COUNTRY_LIST) c.currency = currencyFor(c.id, year, money);
  hooks.onSync?.();
}
/** Back to today's money (for the title screen, where saves of different years are listed). */
export function resetWorld() { syncedYear = MODERN_YEAR; for (const c of COUNTRY_LIST) c.currency = { ...MODERN[c.id], historical: false }; hooks.onSync?.(); }
/** Lets the currency module know when currencies change (it keeps its own table of codes). */
export const hooks = { onSync: null };

// ---------- Laws ----------

/** Rules where the historical value is never higher than today's (a school-leaving age is never raised by history). */
const AT_MOST_MODERN = new Set(['schoolLeavingAge']);

/**
 * What the law was in a place in a year, if history says it differed from today's;
 * undefined when today's law applies. `modern` is today's value (for defaults that only
 * apply to some modern values).
 * @returns {{value:any, note:'history'|'era'}|undefined}
 */
export function pastLaw(ruleId, placeId, year, modern) {
  if (year >= MODERN_YEAR) return undefined;
  const table = LAW_HISTORY[ruleId];
  if (!table) return undefined;
  const parent = COUNTRIES[placeId]?.place?.parentId;
  const own = table[placeId] ?? (parent ? table[parent] : undefined);
  const list = own ?? table['*'];
  if (!list) return undefined;
  const hit = list.find((e) => year >= (e.from ?? -Infinity) && year <= e.until && (!e.ifModern || e.ifModern.includes(modern)));
  if (!hit) return undefined;
  // The shared default for being gay only makes things harsher than today, never kinder.
  if (ruleId === 'lgbt' && !own && ['hostile', 'limited', 'equal'].indexOf(hit.value) > ['hostile', 'limited', 'equal'].indexOf(modern)) return undefined;
  if (AT_MOST_MODERN.has(ruleId) && hit.value > modern) return undefined;
  return { value: hit.value, note: own ? 'history' : 'era' };
}
/** True while history fixes this law for the place: the world's own reforms leave it alone until then. */
export const historyHolds = (ruleId, placeId, year = store.state?.year ?? MODERN_YEAR) => pastLaw(ruleId, placeId, year, null) !== undefined;

// ---------- Careers, degrees, occupations ----------

const isWoman = (person) => (person.flags?.trueGender ?? person.gender) === 'female';
const isMarried = (person) => person === store.state?.player
  ? person.npcIds.some((id) => store.state.npcs[id]?.alive && store.state.npcs[id].role === 'spouse')
  : !!person.life?.married;

/**
 * Why a career is not open to someone in a year, or '' when it is. Technology comes
 * from the Digital World's registry; legal limits from the rule engine (passed in, to
 * keep this module free of the rule engine's imports).
 * @param {{id:string}} career
 * @param {object} person
 * @param {(ruleId:string)=>any} rule  the law where the person lives
 */
export function careerBlock(career, person, year, rule) {
  const e = CAREER_ERAS[career.id];
  if (!e) return '';
  if (e.from && year < e.from) return 'There is no such job yet.';
  if (e.tech && !techAvailable(e.tech)) return 'There is no such job yet.';
  if (e.law && rule) {
    if (e.law === 'marriageBar' && isWoman(person) && isMarried(person) && rule('marriageBar')) return 'marriageBar';
    if (e.law !== 'marriageBar' && isWoman(person) && rule(e.law) === false) return e.law;
  }
  return '';
}
export const careerExists = (careerId, year) => { const e = CAREER_ERAS[careerId]; return !e || ((!e.from || year >= e.from) && (!e.tech || techAvailable(e.tech))); };

/** A job's title as it was called when it was taken, or null for today's title. */
export function eraTitle(careerId, level, year) {
  const t = CAREER_ERAS[careerId]?.titles?.[getEra(year).id];
  return t ? t[Math.min(level, t.length - 1)] : null;
}

export const majorOpen = (majorId, year = store.state?.year ?? MODERN_YEAR) => !MAJOR_FROM[majorId] || year >= MAJOR_FROM[majorId];

/** Occupations a newborn's parents might have in a year. In the present: exactly today's list. */
export function parentOccupations(year) {
  if (isModern(year)) return OCCUPATIONS;
  const old = PARENT_OCCUPATIONS.filter((o) => (o.from ?? 0) <= year && (o.until ?? 9999) >= year);
  const today = OCCUPATIONS.filter((o) => !MODERN_OCCUPATIONS[o.title] || MODERN_OCCUPATIONS[o.title] <= year);
  return [...old, ...today];
}

// ---------- Schooling ----------

export const universityAccess = (year = syncedYear) => UNIVERSITY_ACCESS[getEra(year).id];
export const secondaryShare = (year = syncedYear) => SECONDARY[getEra(year).id];

// ---------- Health ----------

/** Live events that raise everyone's risk (a pandemic) in a year. */
const extraRisk = (year) => EVENTS.filter((e) => e.extraRisk && year >= e.from && year <= e.to).reduce((s, e) => s + e.extraRisk, 0);

/** How the era changes mortality at an age: a shift in old-age risk and extra yearly risk. */
export function eraMortality(age, year = store.state?.year ?? MODERN_YEAR) {
  const h = HEALTH[getEra(year).id];
  return { shift: h.shift, extra: (age >= 15 && age <= 60 ? h.adult : 0) + extraRisk(year) * (age >= 5 ? 1 : 0.5) };
}
export const childRisk = (year = store.state?.year ?? MODERN_YEAR) => HEALTH[getEra(year).id].child;
export const childbirthRisk = (year = store.state?.year ?? MODERN_YEAR) => HEALTH[getEra(year).id].childbirth;

/** What a doctor can do for a condition in a year: a success multiplier, and whether long-term management exists. */
export function treatmentIn(conditionId, year = store.state?.year ?? MODERN_YEAR) {
  const hit = (TREATMENT_HISTORY[conditionId] ?? []).find((e) => year >= (e.from ?? -Infinity) && year <= e.until);
  return { chance: hit?.chance ?? 1, manage: hit?.manage ?? true, limited: !!hit };
}
export const procedureOpen = (id, year = store.state?.year ?? MODERN_YEAR) => !PROCEDURE_FROM[id] || year >= PROCEDURE_FROM[id];

// ---------- Scenes ----------

/**
 * Whether a scene belongs to a year and place: within its own `years` and `places`, and not before the
 * reviewed year a present-day scene became possible (data/history.js SCENE_FROM). `late` is a year implied
 * by the scene's wording (the event engine works it out).
 */
export function sceneFits(ev, year, countryId, late = 0) {
  if (ev.years && (year < ev.years[0] || year > ev.years[1])) return false;
  if (ev.places && !ev.places.includes(countryId)) return false;
  if (year < (SCENE_FROM[ev.id] ?? 0) || year < late) return false;
  return true;
}

// ---------- Events ----------

/** Whether a country is caught up in an event in a year (a war counts from the year it entered). */
export function involved(ev, countryId, year) {
  if (year < ev.from || year > ev.to) return false;
  if (ev.who.includes('*')) return true;
  if (!ev.who.includes(countryId)) return false;
  return year >= (ev.entry?.[countryId] ?? ev.from);
}
/** Events under way in a year, for a country: what the news and the eras screen show. */
export const eventsIn = (countryId, year = store.state?.year ?? MODERN_YEAR) => EVENTS.filter((e) => involved(e, countryId, year));
export const atWar = (countryId, year = store.state?.year ?? MODERN_YEAR) => EVENTS.some((e) => e.war && involved(e, countryId, year));

export { ERAS, ERA_BY_ID, EVENTS, clamp, rng, log, milestone, player };
