// Chooses which scenarios fire each year and resolves the player's choices.
import { rng } from '../rng.js';
import { clamp, fmtMoney, localMoney } from '../util.js';
import { store, player, country, npcsByRole, log } from '../state.js';
import { meetsAll, resolve } from './conditions.js';
import { applyEffects } from './effects.js';
import { EVENTS, EVENT_BY_ID } from '../data/events/index.js';

const DEFAULT_COOLDOWN = 10;

export const getEvent = (id) => EVENT_BY_ID[id];

function isEligible(ev) {
  const p = player();
  if (p.age < ev.ageRange[0] || p.age > ev.ageRange[1]) return false;
  const seen = store.state.eventHistory.find((h) => h.id === ev.id);
  if (seen && (ev.once || p.age - seen.lastAge < (ev.cooldown ?? DEFAULT_COOLDOWN))) return false;
  if (!meetsAll(ev.requires)) return false;
  return Object.values(ev.cast ?? {}).every((spec) => npcsByRole(spec).length > 0);
}

/** Binds each cast key to a concrete NPC id. */
function castFor(ev) {
  const cast = {};
  const used = new Set();
  for (const [key, spec] of Object.entries(ev.cast ?? {})) {
    const options = npcsByRole(spec).filter((n) => !used.has(n.id));
    const npc = rng.pick(options.length ? options : npcsByRole(spec));
    cast[key] = npc.id;
    used.add(npc.id);
  }
  return cast;
}

/** Queues 0–3 scenarios for the current year onto state.pendingEvents. */
export function drawEvents() {
  const p = player();
  const count = p.age < 2
    ? (rng.chance(0.5) ? 1 : 0)
    : rng.weighted([1, 2, 3], (n) => ({ 1: 50, 2: 35, 3: 15 })[n]);
  const pool = EVENTS.filter(isEligible);
  for (let i = 0; i < count && pool.length; i++) {
    const ev = rng.weighted(pool);
    pool.splice(pool.indexOf(ev), 1);
    store.state.pendingEvents.push({ id: ev.id, cast: castFor(ev) });
  }
}

/** Fills {tokens}: {name}, {city}, {$50} for money, and cast keys for NPC names. */
export function renderText(text, cast = {}) {
  const p = player();
  const c = country();
  return text.replace(/\{([^}]+)\}/g, (whole, key) => {
    if (key[0] === '$') return fmtMoney(localMoney(Number(key.slice(1)), c), c);
    if (key === 'name') return p.firstName;
    if (key === 'city') return p.city;
    const npc = store.state.npcs[cast[key]];
    return npc ? npc.firstName : whole;
  });
}

/** Success probability for a choice's skill check, 5%–95%. */
export function checkChance(check) {
  let chance = check.base;
  for (const [path, weight] of Object.entries(check.factors ?? {})) {
    chance += weight * ((Number(resolve(path)) || 0) - 50) / 100;
  }
  return clamp(chance, 0.05, 0.95);
}

/** @returns {{label:string, enabled:boolean}[]} */
export const choiceStates = (ev) =>
  ev.choices.map((ch) => ({ label: ch.label, enabled: meetsAll(ch.requires) }));

/**
 * Applies the chosen option and writes the scene to the journal.
 * @returns {{text:string, tone:'good'|'bad'|'neutral', changes:Array, death?:string}}
 */
export function resolveChoice(ev, choiceIndex, cast) {
  const p = player();
  const choice = ev.choices[choiceIndex];
  let result = 'always';
  if (choice.check) result = rng.chance(checkChance(choice.check)) ? 'success' : 'fail';

  let options = choice.outcomes.filter((o) => o.on === result);
  if (!options.length) options = choice.outcomes.filter((o) => o.on === 'always');
  if (!options.length) options = choice.outcomes;
  const outcome = rng.weighted(options);

  const ctx = { cast: { ...cast } };
  const changes = applyEffects(outcome.effects, ctx);
  const text = renderText(outcome.text, ctx.cast);
  const tone = outcome.tone ?? (result === 'success' ? 'good' : result === 'fail' ? 'bad' : 'neutral');

  log(renderText(ev.text, cast), 'event');
  log(renderText(choice.label, cast), 'choice');
  log(text, 'outcome', tone);

  const history = store.state.eventHistory;
  const seen = history.find((h) => h.id === ev.id);
  if (seen) seen.lastAge = p.age; else history.push({ id: ev.id, lastAge: p.age });

  return { text, tone, changes, death: ctx.death };
}
