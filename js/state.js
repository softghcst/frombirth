// Central store. One GameState is live at a time; UI subscribes for re-render.
import { COUNTRIES } from './data/countries.js';
import { setIdSource } from './util.js';

/** @type {{state: import('./types.js').GameState|null}} */
export const store = {
  state: null,
  lastObituary: null,
  listeners: new Set(),
  set(state) { this.state = state; this.notify(); },
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  notify() { this.listeners.forEach((fn) => fn(this.state)); },
};
// New ids are counted in the life being played (util.uid), so a reloaded year makes the same ids again.
setIdSource(() => store.state);

export const player = () => store.state.player;
export const country = () => COUNTRIES[player().countryId];

export const livingNpcs = () =>
  player().npcIds.map((id) => store.state.npcs[id]).filter((n) => n && n.alive);

/** Role specs: any NPC role, 'mother' / 'father', or 'tag:<contact tag>'. */
export function npcMatches(npc, spec) {
  if (spec === 'mother') return npc.role === 'parent' && npc.gender === 'female';
  if (spec === 'father') return npc.role === 'parent' && npc.gender === 'male';
  if (spec.startsWith('tag:')) return npc.flags.tag === spec.slice(4);
  return npc.role === spec;
}

export const npcsByRole = (spec) => livingNpcs().filter((n) => npcMatches(n, spec));

/** Append a line to the journal under the player's current age. */
export function log(text, kind = 'system', tone = 'neutral') {
  store.state.journal.push({ age: player().age, text, kind, tone });
}

export function milestone(text, kind = 'life') {
  player().milestones.push({ age: player().age, text, kind });
}

/**
 * Drops queued scenes that name someone who is no longer in the player's life (left behind on a move, gone from the
 * save). A scene about a classmate the family has moved away from would otherwise open with a blank where the name was.
 */
export function prunePending(state = store.state) {
  if (!state?.pendingEvents?.length) return 0;
  const before = state.pendingEvents.length;
  state.pendingEvents = state.pendingEvents.filter((e) => Object.values(e.cast ?? {}).every((v) => typeof v !== 'string' || !v.startsWith('npc_') || state.npcs[v]?.alive));
  return before - state.pendingEvents.length;
}
