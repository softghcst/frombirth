// Weather and other natural disasters.
//
// The world's weather is a fact of the playthrough: which storms, floods and earthquakes struck which country in which
// month of which year is worked out from the save and the date alone (weatherOf), so everyone in the game lives through
// the same hurricane, and asking twice gives the same answer. It never draws on the game's own dice.
//
// What it does to the player is settled once a year, for the year just lived (tickDisasters, in the yearly tick): the
// disasters that reached where they live, what they cost, who was hurt, and the news of big ones elsewhere. That is the
// same whatever the turn length. With turns shorter than a year there is more to it as the year goes: storms that can be
// seen coming bring a forecast first, and a chance to prepare or leave, which really does lessen the harm when the
// year's reckoning comes; and each one is told as it strikes (disastersBetween).
//
// state.disasters = { prep: { [eventId]: 'ready' | 'evacuated' | 'stayed' }, told: { [eventId]: year }, warned: { [eventId]: year } }
import { store, log } from '../state.js';
import { clamp, cap, fmtMoney, localMoney, theCountry } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { LIVING } from '../data/living.js';
import { KINDS, SEVERITY, CITY_HAZARDS, countryHazards, STORM_NAMES, STRIKE, NEWS, TSUNAMI, AFTERMATH, AFTER_OF } from '../data/disasters.js';
import { climateOf } from './calendar.js';
import { seeded } from './sportsPlay.js';
import { damageProperty, properties } from './realEstate.js';
import { addCondition } from './health.js';
import { post as postNews, ties } from './economy.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ensure = (state) => (state.disasters ??= { prep: {}, told: {}, warned: {} });

// ---------- Where, and what ----------

/** Every kind of disaster a country can have, from its regions too (a city's list can add to the country's). */
function kindsOf(countryId) {
  const out = new Set(countryHazards(countryId, LIVING[countryId]));
  for (const list of Object.values(CITY_HAZARDS[countryId] ?? {})) for (const k of list) out.add(k);
  return [...out];
}
/** What can strike a city: its own list where the game has one (the United States), the country's otherwise. */
export function hazardsAt(countryId, city) {
  return CITY_HAZARDS[countryId]?.[city] ?? countryHazards(countryId, LIVING[countryId]);
}

/**
 * The disasters of a country in a year: [{ id, kind, severity (0–2), month, name? }], in the order they came. Worked out
 * from the playthrough, the country and the year, so it is the same every time it is asked.
 */
export function weatherOf(countryId, year, state = store.state) {
  const slot = state?.slotId ?? 'world';
  const climate = climateOf(countryId);
  const out = [];
  for (const kind of kindsOf(countryId)) {
    const k = KINDS[kind];
    if (!k.chance) continue;
    const r = seeded(`weather/${slot}/${countryId}/${year}/${kind}`);
    if (!r.chance(k.chance)) continue;
    const count = k.named && r.chance(0.25) ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const roll = r.next();
      const severity = roll < k.weights[0] ? 0 : roll < k.weights[0] + k.weights[1] ? 1 : 2;
      out.push({ id: `${countryId}-${year}-${kind}-${i}`, countryId, year, kind, severity, month: r.pick(k.months(climate, countryId)) });
    }
  }
  // A strong earthquake offshore can send the sea in.
  if (TSUNAMI.has(countryId)) {
    for (const q of out.filter((e) => e.kind === 'earthquake' && e.severity >= 1)) {
      const r = seeded(`tsunami/${slot}/${q.id}`);
      if (r.chance(q.severity === 2 ? 0.6 : 0.25)) out.push({ id: `${q.id}-tsunami`, countryId, year, kind: 'tsunami', severity: q.severity, month: q.month, after: q.id });
    }
  }
  out.sort((a, b) => a.month - b.month || a.id.localeCompare(b.id));
  // Storms are named in the order they come, from the year's list.
  const r = seeded(`names/${slot}/${countryId}/${year}`);
  let n = r.int(0, 6);
  for (const e of out) if (KINDS[e.kind].named) e.name = `${KINDS[e.kind].named} ${STORM_NAMES[n++ % STORM_NAMES.length]}`;
  return out;
}

/** Whether a disaster reached the player's city: one their city can have, and near enough. The same answer every time. */
export function reaches(e, state = store.state) {
  const p = state.player;
  if (e.countryId !== p.countryId || !hazardsAt(p.countryId, p.city).includes(e.kind)) return false;
  return seeded(`reach/${state.slotId}/${e.id}/${p.city}`).chance([0.35, 0.65, 0.9][e.severity]);
}

const an = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
/** The disaster as the subject of a sentence: "Hurricane Cora", "A blizzard", "An earthquake". */
const Kind = (e) => e.name ?? cap(`${an(KINDS[e.kind].name)} ${KINDS[e.kind].name}`);
const what = (e) => e.name ?? `the ${KINDS[e.kind].name}`;
function strikeText(e) {
  return STRIKE[e.kind][e.severity].replace('{name}', e.name ?? cap(KINDS[e.kind].name));
}
/** "In September, " before a line, keeping a storm's name capitalized. */
function inMonth(e, text) {
  const first = e.name && text.startsWith(e.name) ? text : text.charAt(0).toLowerCase() + text.slice(1);
  return `In ${MONTHS[e.month]}, ${first}`;
}
/** A line in the life story about a disaster. Marked, so the turns can tell it apart (it is told as it strikes with shorter turns). */
function say(state, text, tone) {
  const entry = { age: state.player.age, text, kind: 'system', tone, disaster: true };
  if (state.month) entry.month = state.month;
  state.journal.push(entry);
}

// ---------- The year's reckoning ----------

/**
 * Yearly, for the year just lived: each disaster that reached the player, what it did to them, and the news of big
 * ones elsewhere. Two disasters a year at most are felt in person; the rest are news.
 */
export function tickDisasters(state = store.state) {
  const p = state.player;
  if (!p.alive) return;
  const D = ensure(state);
  const year = state.year - 1;
  const c = COUNTRIES[p.countryId];
  const here = weatherOf(p.countryId, year, state);
  const felt = here.filter((e) => reaches(e, state)).sort((a, b) => b.severity - a.severity).slice(0, 2).sort((a, b) => a.month - b.month);
  let worst = null;
  if (!p.legal?.incarceration) {
    for (const e of felt) {
      const { strike, after } = impact(state, e);
      // Told already as it struck (turns shorter than a year): the year's reckoning says only what it cost.
      if (D.told[e.id]) { if (after) say(state, `After ${what(e)}: ${after.charAt(0).toLowerCase()}${after.slice(1)}`, 'bad'); }
      else { say(state, inMonth(e, `${strike}${after ? ` ${after}` : ''}`), e.severity ? 'bad' : 'neutral'); D.told[e.id] = year; }
      if (e.severity >= 1 && (!worst || e.severity > worst.severity)) worst = e;
    }
  }
  // Big ones elsewhere in the country are the country's news.
  for (const e of here.filter((x) => !felt.includes(x) && x.severity >= 1)) {
    postNews(p.countryId, 'disaster', `${Kind(e)} struck elsewhere in ${theCountry(c.name)} in ${MONTHS[e.month]}${e.severity === 2 ? ': a national disaster, with thousands homeless' : ''}.`, 'bad');
  }
  // And big ones around the world are the world's. The player hears of those where they have ties.
  const mine = ties(p);
  let far = null;
  for (const id of Object.keys(COUNTRIES)) {
    if (id === p.countryId) continue;
    for (const e of weatherOf(id, year, state)) {
      if (e.severity < 1) continue;
      const tied = mine.has(id);
      if (e.severity === 2 || tied || seeded(`news/${state.slotId}/${e.id}`).chance(0.2)) {
        postNews(id, 'disaster', newsLine(e), 'bad', tied);
      }
      if (tied && !far) {
        const someone = Object.values(state.npcs).find((n) => n.alive && n.flags?.abroad === id && p.npcIds.includes(n.id) && n.role !== 'ex' && n.role !== 'pet');
        if (someone) far = { e, someone };
      }
    }
  }
  const waiting = new Set(state.pendingEvents.map((x) => x.id));
  if (worst && !waiting.has('disaster_aftermath')) state.pendingEvents.push({ id: 'disaster_aftermath', cast: { words: { after: AFTERMATH[AFTER_OF[worst.kind]].replace('{what}', what(worst)), what: what(worst) } } });
  if (far && p.age >= 12 && !waiting.has('disaster_far_away')) {
    state.pendingEvents.push({ id: 'disaster_far_away', cast: { person: far.someone.id, words: { kind: KINDS[far.e.kind].name, what: what(far.e), where: theCountry(COUNTRIES[far.e.countryId].name) } } });
  }
  // The record of what was told and prepared for only needs this year and the next.
  for (const m of [D.prep, D.told, D.warned]) for (const id of Object.keys(m)) if (Number(id.split('-')[1]) < year) delete m[id];
}

function newsLine(e) {
  const where = theCountry(COUNTRIES[e.countryId].name);
  const kind = e.name ?? KINDS[e.kind].name;
  return NEWS[e.severity].replace('{Kind}', cap(kind)).replace('{kind}', kind).replace('{where}', where);
}

/** What one disaster did to the player. Keyed luck: the same disaster does the same to the same person. Returns the line. */
function impact(state, e) {
  const p = state.player;
  const D = ensure(state);
  const k = KINDS[e.kind];
  const s = e.severity;
  const r = seeded(`impact/${state.slotId}/${e.id}/${p.id}`);
  const c = COUNTRIES[p.countryId];
  const tier = wealthOf(state);
  const prep = D.prep[e.id];
  const shield = { rich: 0.5, middle: 1, poor: 1.4 }[tier];
  const parts = [];
  // The home.
  const damage = Math.round((k.damage[s] ?? 0) * shield * (prep === 'ready' ? 0.55 : 1));
  if (damage > 0) {
    const mine = properties().filter((x) => (x.countryId ?? c.id) === c.id);
    const home = mine.find((x) => x.id === p.homeId) ?? mine[0];
    if (home && r.chance(0.45 + 0.25 * s)) {
      damageProperty(home, damage);
      parts.push(`Your ${home.name.charAt(0).toLowerCase() + home.name.slice(1)} was ${damage >= 40 ? 'wrecked' : damage >= 20 ? 'badly damaged' : 'damaged'}${tier === 'rich' ? ', though the insurance will cover much of it' : ''}.`);
      if (s === 2 && damage >= 40) { p.stats.mood = clamp(p.stats.mood - 6); parts.push('You had to live somewhere else for months while it was made safe.'); }
    } else if (!home && p.age >= 18 && s >= 1 && r.chance(tier === 'poor' ? 0.5 : 0.25)) {
      const lost = Math.min(Math.round(Math.max(0, p.finance.cash) * (tier === 'poor' ? 0.25 : 0.1) * s), localMoney(8000, c));
      if (lost > 0) { p.finance.cash -= lost; parts.push(`The place you rent was hit, and you lost much of what was in it (${fmtMoney(lost, c)}).`); }
    }
  }
  // People.
  const injury = (k.injury[s] ?? 0) * shield * (prep === 'evacuated' ? 0 : prep === 'ready' ? 0.6 : 1);
  if (injury > 0 && r.chance(injury)) {
    p.stats.health = clamp(p.stats.health - r.int(5 + 6 * s, 12 + 10 * s));
    if (s >= 1 && r.chance(0.35)) addCondition('broken_arm');
    parts.push('You were hurt.');
  } else if (prep === 'evacuated' && s >= 1) parts.push('You had left in time.');
  else if (prep === 'ready' && damage > 0) parts.push('The boards and sandbags did their job.');
  if (k.health) {
    const frail = p.age >= 70 || p.age <= 4 ? 2 : 1;
    p.stats.health = clamp(p.stats.health + k.health[s] * frail);
  }
  if (k.cost?.[s] && p.age >= 18) { const cost = localMoney(k.cost[s], c); p.finance.cash -= cost; parts.push(`Food and water cost far more (${fmtMoney(cost, c)} over the year).`); }
  p.stats.mood = clamp(p.stats.mood - (k.mood?.[s] ? -k.mood[s] : 2 + 3 * s));
  return { strike: strikeText(e), after: parts.join(' ') };
}
function wealthOf(state) {
  const p = state.player;
  const worth = (p.finance.cash ?? 0) / (COUNTRIES[p.countryId].currency.scale || 1);
  return worth >= 300000 ? 'rich' : worth >= 10000 ? 'middle' : 'poor';
}

// ---------- Turns shorter than a year ----------

/**
 * A turn between years, or the turn of a year, with turns shorter than a year (engine/turns.js): disasters that struck in
 * the months just lived are told as they happened, and those that can be seen coming in the months ahead bring a
 * forecast (a scene: prepare, leave, or wait). Nothing here changes the year's reckoning except the player's choice.
 * @param {number} end   the month the turn just played ended at (12 for the turn of the year)
 * @param {number} step  the turn length, in months
 */
export function disastersBetween(state, end, step) {
  const p = state.player;
  if (!p.alive || p.legal?.incarceration) return;
  const D = ensure(state);
  const year = end === 12 ? state.year - 1 : state.year;
  // As it happened.
  for (const e of weatherOf(p.countryId, year, state)) {
    if (e.month < end - step || e.month >= end || D.told[e.id] || !reaches(e, state)) continue;
    D.told[e.id] = year;
    say(state, strikeText(e), e.severity ? 'bad' : 'neutral');
  }
  // What is coming: storms, floods and fires that can be seen from a way off, in the next turn's months.
  const nextYear = end === 12 ? state.year : year;
  const from = end % 12;
  const ahead = weatherOf(p.countryId, nextYear, state).filter((e) => KINDS[e.kind].forecast && e.severity >= 1 && e.month >= from && e.month < from + step && !D.warned[e.id] && reaches(e, state));
  const e = ahead.sort((a, b) => b.severity - a.severity)[0];
  if (e && p.age >= 10 && !state.pendingEvents.some((x) => x.id === 'disaster_forecast')) {
    D.warned[e.id] = nextYear;
    state.pendingEvents.push({ id: 'disaster_forecast', cast: { words: { what: what(e), What: Kind(e), when: MONTHS[e.month], eventId: e.id } } });
  }
}

/** A choice made in one of the disaster scenes (data/events/disasters.js). Returns a sentence, or ''. */
export function disasterChoice(v, cast = {}, state = store.state) {
  const D = ensure(state);
  if (v.do === 'prep') {
    const id = cast.words?.eventId;
    if (!id) return '';
    D.prep[id] = v.how;
    return v.how === 'evacuated' ? 'You will be somewhere safe when it comes.' : v.how === 'ready' ? 'You have done what you can.' : '';
  }
  return '';
}

/** The disasters a country has, by name, for the country's description. */
export const hazardNames = (countryId, city) => hazardsAt(countryId, city).map((k) => KINDS[k].plural);
export { SEVERITY };
