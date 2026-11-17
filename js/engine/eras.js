// The eras' year: run from the year processor as soon as the world's year
// has moved. It records crossing into a new era (once), and from later phases
// applies what the era changes. The rules themselves are in engine/history.js.
import { store, player, log, milestone } from '../state.js';
import { getEra, getEraTransition, syncWorld, MODERN_YEAR } from './history.js';

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

/** The eras' part of the year. Runs right after the world's year has moved on. */
export function tickEra() {
  const state = store.state;
  const e = ensureEra(state);
  noteTransition(state);
  e.applied = { year: state.year, countryId: player().countryId };
  syncWorld(state.year, e.money);
}

export { getEra };
