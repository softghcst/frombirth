// Chooses which scenarios fire each year and resolves the player's choices.
//
// Story features (all optional, all plain data on the event):
//   priority: true      always fires in the first year it is eligible
//   exclusive: 'name'   only one event of this group fires per year
//   queuedOnly: true    never drawn; only reached through a `queue` effect
//   prison: true        fires only while the player is locked up (and nothing else does)
//   cast: {key: spec}   spec is a role, 'mother'/'father', or 'tag:<contact tag>'
//   castRequires: [...] conditions on the people cast, e.g. cast.kid.age >= 14
//   outcome.requires    picks a text variant from history (see conditions.js)
import { headTitle } from './polity.js';
import { latestLaw } from './government.js';
import { rng } from '../rng.js';
import { clamp, fmtMoney, localMoney } from '../util.js';
import { store, player, country, npcsByRole, log } from '../state.js';
import { meetsAll, resolve } from './conditions.js';
import { applyEffects } from './effects.js';
import { EVENTS, EVENT_BY_ID } from '../data/events/index.js';
import { claimStory } from './animals.js';

const DEFAULT_COOLDOWN = 10;

export const getEvent = (id) => EVENT_BY_ID[id];

/** Binds each cast key to a concrete NPC id, preferring people who fit castRequires. */
function castFor(ev) {
  const cast = {};
  const used = new Set();
  for (const [key, spec] of Object.entries(ev.cast ?? {})) {
    const fits = (npc) => meetsAll((ev.castRequires ?? []).filter((r) => r.path.split('.')[1] === key), { [key]: npc.id });
    const free = npcsByRole(spec).filter((n) => !used.has(n.id));
    const options = free.filter(fits);
    const npc = rng.pick(options.length ? options : free.length ? free : npcsByRole(spec));
    cast[key] = npc.id;
    used.add(npc.id);
  }
  return cast;
}

/** The cast for an event if it can fire now, otherwise null. */
function eligibleCast(ev, between = false) {
  const p = player();
  if (ev.queuedOnly) return null;
  // Scenes for the turns between years (data/events/seasons.js) are drawn only then, and yearly scenes never are.
  if (!!ev.between !== between) return null;
  if (!!ev.prison !== !!p.legal.incarceration) return null;
  if (p.age < ev.ageRange[0] || p.age > ev.ageRange[1]) return null;
  const seen = store.state.eventHistory.find((h) => h.id === ev.id);
  if (seen && (ev.once || p.age - seen.lastAge < (ev.cooldown ?? DEFAULT_COOLDOWN))) return null;
  if (!meetsAll(ev.requires)) return null;
  const specs = Object.values(ev.cast ?? {});
  if (!specs.every((spec) => npcsByRole(spec).length >= specs.filter((x) => x === spec).length)) return null;
  const cast = castFor(ev);
  return meetsAll(ev.castRequires, cast) ? cast : null;
}

/** A whole-number key from a string, for luck that belongs to one moment. */
function keyOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Runs fn on a run of luck of its own, keyed to this life and moment, and puts the game's dice back as they were. */
function apart(key, fn) {
  const saved = rng.state();
  rng.seed(keyOf(`${store.state.slotId}/${key}`));
  try { return fn(); } finally { rng.seed(saved); }
}

/**
 * A turn between years (engine/turns.js): perhaps one scene written for this time of year and this turn length.
 * Drawn on luck of its own, so it never changes what the game's dice would have done.
 * @param {number} step  months a turn is (6 or 3)
 * @param {string[]} seasons  the seasons the turn covered where the player lives: 'winter' | 'spring' | 'summer' | 'fall'
 * @param {number} [chance]  how likely a scene is at all
 * @returns {?string} the scene queued
 */
export function drawBetween(step, seasons, chance = 0.8) {
  const state = store.state;
  return apart(`between/${state.year}/${state.month}/${chance}`, () => {
    const pool = [];
    for (const ev of EVENTS) {
      const b = ev.between;
      if (!b || (b.steps && !b.steps.includes(step)) || (b.seasons && !b.seasons.some((x) => seasons.includes(x))) || (b.when && !b.when(player(), state))) continue;
      const cast = eligibleCast(ev, true);
      if (cast) pool.push({ ev, cast });
    }
    if (!pool.length || !rng.chance(chance)) return null;
    const pick = rng.weighted(pool, (x) => x.ev.weight ?? 1);
    state.pendingEvents.push({ id: pick.ev.id, cast: pick.cast });
    return pick.ev.id;
  });
}

/** Queues this year's scenarios onto state.pendingEvents: story beats first. */
export function drawEvents() {
  const p = player();
  const pending = store.state.pendingEvents;
  const pool = [];
  for (const ev of EVENTS) {
    const cast = eligibleCast(ev);
    if (cast) pool.push({ ev, cast });
  }

  const groups = new Set();
  let stories = 0;
  for (const { ev, cast } of pool.filter((x) => x.ev.priority)) {
    if (ev.exclusive && groups.has(ev.exclusive)) continue;
    if (ev.exclusive) groups.add(ev.exclusive);
    pending.push({ id: ev.id, cast });
    stories += 1;
  }

  const rolled = p.age < 2
    ? (rng.chance(0.5) ? 1 : 0)
    : rng.weighted([1, 2, 3], (n) => ({ 1: 50, 2: 35, 3: 15 })[n]);
  const ordinary = pool.filter((x) => !x.ev.priority && (x.ev.weight ?? 1) > 0 && !groups.has(x.ev.exclusive));
  for (let i = 0; i < rolled - stories && ordinary.length; i++) {
    const pickd = rng.weighted(ordinary, (x) => x.ev.weight ?? 1);
    ordinary.splice(ordinary.indexOf(pickd), 1);
    if (pickd.ev.exclusive) {
      if (groups.has(pickd.ev.exclusive)) continue;
      groups.add(pickd.ev.exclusive);
    }
    pending.push({ id: pickd.ev.id, cast: pickd.cast });
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
    if (key === 'pm' || key === 'pmTitle') { const w = store.state.polities?.[c.id]; const h = w?.figures[w.govt.headId]; return key === 'pm' ? (h?.name ?? 'the prime minister') : headTitle(c.id); }
    if (key === 'law') return latestLaw(c.id) ?? 'change the law';
    // Scenes sent by the engine can carry their own words: the name of a minister, the text of a bill.
    if (cast.words && key in cast.words) return cast.words[key];
    const npc = store.state.npcs[cast[key]];
    return npc ? (npc.flags?.royal?.title ? `${npc.flags.royal.title} ${npc.firstName}` : npc.firstName) : whole;
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
  // A scene between years plays out on its own luck too (see drawBetween).
  if (ev.between) return apart(`choice/${store.state.year}/${store.state.month ?? 0}/${ev.id}/${choiceIndex}`, () => resolveNow(ev, choiceIndex, cast));
  return resolveNow(ev, choiceIndex, cast);
}
function resolveNow(ev, choiceIndex, cast) {
  const p = player();
  const state = store.state;
  const choice = ev.choices[choiceIndex];
  let result = 'always';
  if (choice.check) result = rng.chance(checkChance(choice.check, cast)) ? 'success' : 'fail';

  let options = variantsFor(choice.outcomes, result, cast);
  if (!options.length) options = variantsFor(choice.outcomes, 'always', cast);
  if (!options.length) options = choice.outcomes;
  const outcome = rng.weighted(options);

  // `why` is what reputation changes are put down to in the royal's record.
  const ctx = { cast: { ...cast }, queue: [], why: renderText(choice.label, cast).replace(/^./, (c) => c.toLowerCase()) };
  const changes = applyEffects(outcome.effects, ctx);
  const text = renderText(outcome.text, ctx.cast) + (ctx.note ? ` ${ctx.note}` : '');
  const tone = outcome.tone ?? (result === 'success' ? 'good' : result === 'fail' ? 'bad' : 'neutral');

  log(renderText(ev.text, cast), 'event');
  log(renderText(choice.label, cast), 'choice');
  log(text, 'outcome', tone);
  claimStory(store.state.journal[store.state.journal.length - 1]); // a moment in an animal's life, told by this line

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
