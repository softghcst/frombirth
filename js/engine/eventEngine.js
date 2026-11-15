// Chooses which scenarios fire each year and resolves the player's choices.
//
// Story features (all optional, all plain data on the event):
//   priority: true      always fires in the first year it is eligible
//   exclusive: 'name'   only one event of this group fires per year
//   queuedOnly: true    never drawn; only reached through a `queue` effect
//   cast: {key: spec}   spec is a role, 'mother'/'father', or 'tag:<contact tag>'
//   outcome.requires    picks a text variant from history (see conditions.js)
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
  if (ev.queuedOnly) return false;
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

/** Queues this year's scenarios onto state.pendingEvents: story beats first. */
export function drawEvents() {
  const p = player();
  const pending = store.state.pendingEvents;
  const pool = EVENTS.filter(isEligible);

  const groups = new Set();
  let stories = 0;
  for (const ev of pool.filter((e) => e.priority)) {
    if (ev.exclusive && groups.has(ev.exclusive)) continue;
    if (ev.exclusive) groups.add(ev.exclusive);
    pending.push({ id: ev.id, cast: castFor(ev) });
    stories += 1;
  }

  const rolled = p.age < 2
    ? (rng.chance(0.5) ? 1 : 0)
    : rng.weighted([1, 2, 3], (n) => ({ 1: 50, 2: 35, 3: 15 })[n]);
  const ordinary = pool.filter((e) => !e.priority && (e.weight ?? 1) > 0 && !groups.has(e.exclusive));
  for (let i = 0; i < rolled - stories && ordinary.length; i++) {
    const ev = rng.weighted(ordinary);
    ordinary.splice(ordinary.indexOf(ev), 1);
    if (ev.exclusive) {
      if (groups.has(ev.exclusive)) continue;
      groups.add(ev.exclusive);
    }
    pending.push({ id: ev.id, cast: castFor(ev) });
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
export function checkChance(check, cast) {
  let chance = check.base;
  for (const [path, weight] of Object.entries(check.factors ?? {})) {
    chance += weight * ((Number(resolve(path, cast)) || 0) - 50) / 100;
  }
  return clamp(chance, 0.05, 0.95);
}

/** @returns {{label:string, enabled:boolean}[]} */
export const choiceStates = (ev, cast) =>
  ev.choices.map((ch) => ({ label: ch.label, enabled: meetsAll(ch.requires, cast) }));

/** Outcomes whose history conditions hold; specific variants beat generic ones. */
function variantsFor(outcomes, on, cast) {
  const matching = outcomes.filter((o) => o.on === on && meetsAll(o.requires, cast));
  const specific = matching.filter((o) => o.requires?.length);
  return specific.length ? specific : matching;
}

/**
 * Applies the chosen option and writes the scene to the journal.
 * @returns {{text:string, tone:'good'|'bad'|'neutral', changes:Array, death?:string}}
 */
export function resolveChoice(ev, choiceIndex, cast) {
  const p = player();
  const state = store.state;
  const choice = ev.choices[choiceIndex];
  let result = 'always';
  if (choice.check) result = rng.chance(checkChance(choice.check, cast)) ? 'success' : 'fail';

  let options = variantsFor(choice.outcomes, result, cast);
  if (!options.length) options = variantsFor(choice.outcomes, 'always', cast);
  if (!options.length) options = choice.outcomes;
  const outcome = rng.weighted(options);

  const ctx = { cast: { ...cast }, queue: [] };
  const changes = applyEffects(outcome.effects, ctx);
  const text = renderText(outcome.text, ctx.cast);
  const tone = outcome.tone ?? (result === 'success' ? 'good' : result === 'fail' ? 'bad' : 'neutral');

  log(renderText(ev.text, cast), 'event');
  log(renderText(choice.label, cast), 'choice');
  log(text, 'outcome', tone);

  const seen = state.eventHistory.find((h) => h.id === ev.id);
  if (seen) seen.lastAge = p.age; else state.eventHistory.push({ id: ev.id, lastAge: p.age });

  // Follow-up scenes run next, with the same people. They go in right behind
  // the scene being resolved (which the caller removes from the front).
  const followUps = ctx.queue
    .filter((id) => EVENT_BY_ID[id] && !state.pendingEvents.some((e) => e.id === id)
      && !(EVENT_BY_ID[id].once && state.eventHistory.some((h) => h.id === id)))
    .map((id) => ({ id, cast: ctx.cast }));
  const at = state.pendingEvents[0]?.id === ev.id ? 1 : 0;
  state.pendingEvents.splice(at, 0, ...followUps);

  return { text, tone, changes, death: ctx.death };
}
