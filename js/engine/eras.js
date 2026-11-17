// The eras' year: run from the year processor as soon as the world's year
// has moved. It records crossing into a new era (once), and from later phases
// applies what the era changes. The rules themselves are in engine/history.js.
import { store, player, log, milestone } from '../state.js';
import { getEra, getEraTransition, syncWorld, currencyFor, secondaryShare, childRisk, involved, atWar, MODERN_YEAR } from './history.js';
import { EVENTS } from '../data/history.js';
import { holdPhase, post } from './economy.js';
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { roleLabel } from './relationships.js';
import { convertMoney } from './emigration.js';
import { rule } from './rules.js';
import { LAW_HISTORY } from '../data/history.js';
import { COUNTRIES } from '../data/countries.js';
import { theCountry, fmtMoney } from '../util.js';

/**
 * The era record of a life, created once. `money` says how this life's amounts are
 * kept: 'era' (in the money of the year) or 'modern' (a life saved before eras that
 * was already in the past keeps today's money, so its fortune is not rewritten).
 * `applied` is the year and country the life's amounts are currently expressed in.
 */
export function ensureEra(state = store.state, o = {}) {
  if (!state) return null;
  if (!state.era) {
    const legacyPast = o.legacy && state.year < MODERN_YEAR;
    state.era = { v: 1, money: legacyPast ? 'modern' : 'era', applied: { year: state.year, countryId: state.player.countryId },
      transitions: [], seen: {}, events: {}, laws: {} };
  }
  state.era.transitions ??= [];
  state.era.seen ??= {};
  state.era.events ??= {};
  state.era.laws ??= {};
  return state.era;
}

/** Puts the world's currencies in step with a life (used when a life is loaded or created). */
export function alignWorld(state = store.state) {
  const e = ensureEra(state);
  syncWorld(e.applied?.year ?? state.year, e.money);
}

/** Records the move into a new era: one journal entry and one milestone, never repeated. */
function noteTransition(state) {
  const e = state.era;
  const t = getEraTransition(state.year - 1, state.year);
  if (!t || e.seen[`era:${t.to.id}`]) return null;
  e.seen[`era:${t.to.id}`] = state.year;
  e.transitions.push({ year: state.year, from: t.from.id, to: t.to.id, age: state.player.age });
  log(`A new era begins: ${t.to.name}. ${t.to.description}`, 'system', 'neutral');
  milestone(`Lived into a new era: ${t.to.name} (${state.year}).`, 'era');
  return t;
}

/**
 * Everyone's money, in the new year's terms. Wages, prices, savings and debts move
 * together (so no money is made or lost by the change itself), and a currency that
 * is replaced is converted once, at its official rate. Uses the same conversion as
 * moving abroad (engine/emigration.js).
 */
function revalue(state) {
  const e = state.era;
  const p = state.player;
  const from = currencyFor(p.countryId, e.applied?.year ?? state.year, e.money);
  const to = currencyFor(p.countryId, state.year, e.money);
  if (!from || !to || from.scale === to.scale) return null;
  const k = to.scale / from.scale;
  convertMoney(k);
  const x = (n) => Math.round((n ?? 0) * k);
  p.career.salary = x(p.career.salary);
  if (p.career.partTime) p.career.partTime.salary = x(p.career.partTime.salary);
  if (p.politics?.salary) p.politics.salary = x(p.politics.salary);
  if (from.code !== to.code) {
    const key = `${p.countryId}:${from.code}>${to.code}`;
    if (!e.conversions?.[key]) {
      (e.conversions ??= {})[key] = state.year;
      log(`${theCountry(COUNTRIES[p.countryId].name).replace(/^the/, 'The')} has changed its money: the ${from.name ?? from.code} is replaced by the ${to.name ?? to.code}. Your savings were converted at ${from.official === false ? 'the game\'s rate (the real reform wiped out most savings)' : 'the official rate'}, and are now ${fmtMoney(p.finance.cash, { currency: to })}.`, 'system', 'neutral');
    }
  }
  return k;
}

const LAW_NEWS = {
  womenVote: (v, place) => (v ? `Women in ${place} have won the right to vote.` : null),
  votingAge: (v, place) => `The voting age in ${place} is now ${v}.`,
  sameSexMarriage: (v, place) => (v ? `Same-sex couples in ${place} can marry now.` : null),
  divorce: (v, place) => (v ? `Divorce is legal in ${place} now.` : null),
  deathPenalty: (v, place) => (v ? null : `${place.replace(/^the/, 'The')} has abolished the death penalty.`),
  conscription: (v, place) => (v ? `${place.replace(/^the/, 'The')} has brought in compulsory military service.` : `Compulsory military service in ${place} has ended.`),
  alcohol: (v, place) => (v ? `Alcohol is legal again in ${place}.` : `Alcohol has been banned in ${place}.`),
  lgbt: (v, place) => ({ limited: `Being gay is no longer a crime in ${place}.`, equal: `${place.replace(/^the/, 'The')} now protects gay and transgender people in law.` }[v] ?? null),
  schoolLeavingAge: (v, place) => `Children in ${place} now stay at school until ${v}.`,
  marriageBar: (v, place) => (v ? null : `Married women in ${place} may now keep their jobs in teaching and public service.`),
  womenInLaw: (v, place) => (v ? `Women in ${place} may now practise law.` : null),
  womenInUniform: (v, place) => (v ? `The police, fire service and armed forces in ${place} are open to women now.` : null),
};
const lawsNow = (countryId) => Object.fromEntries(Object.keys(LAW_HISTORY).map((id) => [id, rule(id, countryId)]));

/** The eras' part of the year. Runs right after the world's year has moved on. */
export function tickEra() {
  const state = store.state;
  const e = ensureEra(state);
  // The world's currencies as this life's amounts are kept, then into the new year.
  syncWorld(e.applied?.year ?? state.year - 1, e.money);
  const here = player().countryId;
  const lawsBefore = lawsNow(here);
  noteTransition(state);
  revalue(state);
  e.applied = { year: state.year, countryId: here };
  syncWorld(state.year, e.money);
  // A law that changed this year where the player lives, as history changed it.
  const lawsAfter = lawsNow(here);
  const place = theCountry(COUNTRIES[here].name);
  for (const [id, v] of Object.entries(lawsAfter)) {
    if (v === lawsBefore[id] || player().age < 8) continue;
    const line = LAW_NEWS[id]?.(v, place);
    if (line && e.laws[`${here}:${id}:${state.year}`] == null) { e.laws[`${here}:${id}:${state.year}`] = v; log(line, 'system', 'neutral'); }
  }
  childMortality(state);
  tickEvents(state);
  offerScenes(state);
}

/** The year when an event reached a country (a war, from the year it entered). */
const startFor = (ev, id) => Math.max(ev.from, ev.entry?.[id] ?? ev.from);

/**
 * The broad events of the time, as they touch the player: news when they begin and end,
 * economies held in a boom or a slump, and in wartime the call-up and the danger to the
 * men of the family. No battles, and nobody real.
 */
function tickEvents(state) {
  const p = state.player;
  const here = p.countryId;
  const e = state.era;
  const y = state.year;
  for (const ev of EVENTS) {
    // Economies anywhere follow the event while it lasts.
    if (ev.economy && y >= ev.from && y <= ev.to && !e.events[`${ev.id}:economy:${y}`]) {
      e.events[`${ev.id}:economy:${y}`] = true;
      for (const id of (ev.who.includes('*') ? Object.keys(COUNTRIES) : ev.who)) if (COUNTRIES[id]) holdPhase(id, ev.economy, ev.to);
    }
    const mine = involved(ev, here, y);
    if (mine && y === startFor(ev, here) && !e.events[`${ev.id}:begin`]) {
      e.events[`${ev.id}:begin`] = y;
      const text = ev.independence ? `${theCountry(COUNTRIES[here].name).replace(/^the/, 'The')} is independent now.` : ev.begin;
      if (text) post(ev.who.includes('*') ? null : here, 'history', text, ev.war || ev.economy === 'slump' || ev.extraRisk ? 'bad' : 'neutral', p.age >= 6);
      if (ev.war && p.age >= 6) queueScene(state, 'era_war_news', { words: { war: ev.name } }, `warNews:${ev.id}`);
      if (ev.id === 'depression' && p.age >= 14) queueScene(state, 'era_hard_times', {}, 'hardTimes');
    }
    if (e.events[`${ev.id}:begin`] && y === ev.to + 1 && !e.events[`${ev.id}:end`]) {
      e.events[`${ev.id}:end`] = y;
      if (ev.end) post(null, 'history', ev.end, 'good', p.age >= 6);
      if (ev.war && p.age >= 6) queueScene(state, 'era_peace', { words: { war: ev.name } }, `peace:${ev.id}`);
    }
    if (!mine || !ev.war) continue;
    // The call-up: young men, where the law says so, while the country is at war.
    const man = (p.flags.trueGender ?? p.gender) === 'male';
    if (man && p.age >= 18 && p.age <= 35 && rule('conscription', here) && !p.legal?.incarceration && !p.flags.served?.[ev.id]) queueScene(state, 'era_call_up', { words: { war: ev.name, id: ev.id } }, `callUp:${ev.id}`);
    // Men of fighting age in the family: a few do not come home. At most one loss a year.
    const men = p.npcIds.map((id) => state.npcs[id]).filter((n) => n?.alive && n.gender === 'male' && n.age >= 18 && n.age <= 40 && !n.flags.abroad && n.role !== 'pet');
    const lost = men.find(() => rng.chance(ev.risk ?? 0));
    if (lost) {
      lost.alive = false;
      lost.flags.diedYear = y;
      lost.flags.diedIn = ev.id;
      log(`Your ${roleLabel(lost).toLowerCase()} ${lost.firstName} was killed in ${ev.name}. He was ${lost.age}.`, 'system', 'bad');
      p.stats.mood = clamp(p.stats.mood - Math.round(10 + lost.meters.relationship / 6));
    }
  }
  // Serving in a war is dangerous.
  if (p.flags.serving && atWar(here, y) && rng.chance(0.02)) p.flags.warDeath = true;
  if (p.flags.serving && !atWar(here, y)) {
    const w = p.flags.serving;
    delete p.flags.serving;
    log('You came home from the war.', 'system', 'good');
    milestone(`Came home from ${w}.`, 'era');
  }
}

/** Queues an era scene once, keyed so it never comes back. */
function queueScene(state, id, cast, key) {
  if (state.era.seen[key]) return;
  state.era.seen[key] = state.year;
  if (!state.pendingEvents.some((x) => x.id === id)) state.pendingEvents.push({ id, cast });
}

/**
 * Young children in the family who do not survive: in earlier eras a real part of family life.
 * The player themself is spared (a life does not end before it starts); nobody is, in the present.
 */
function childMortality(state) {
  const risk = childRisk(state.year);
  if (!risk) return;
  const p = state.player;
  for (const id of p.npcIds) {
    const n = state.npcs[id];
    if (!n?.alive || n.age >= 5 || !['child', 'sibling', 'grandchild', 'greatgrandchild', 'niece'].includes(n.role)) continue;
    if (!rng.chance(risk)) continue;
    n.alive = false;
    n.flags.diedYear = state.year;
    log(`Your ${roleLabel(n).toLowerCase()} ${n.firstName} died of an illness at ${n.age}. In these years, many families lost a child.`, 'system', 'bad');
    p.stats.mood = clamp(p.stats.mood - (n.role === 'child' ? 25 : 12));
  }
}

/** Era scenes found in what is actually happening, queued like any other scene. */
function offerScenes(state) {
  const p = state.player;
  const queue = (id, cast = {}) => { if (!state.pendingEvents.some((x) => x.id === id)) state.pendingEvents.push({ id, cast }); };
  // The leaving age, in a time when most children left school then.
  const ed = p.education;
  const leaving = rule('schoolLeavingAge', p.countryId);
  if (ed?.enrolled && ['elementary', 'middle', 'high'].includes(ed.stage) && p.age === leaving && leaving < 18 && secondaryShare(state.year) < 0.95 && !state.era.seen.leaveSchool) {
    state.era.seen.leaveSchool = state.year;
    queue('era_leave_school', { words: { age: String(p.age) } });
  }
}

export { getEra };
