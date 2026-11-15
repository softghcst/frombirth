// Central store. One GameState is live at a time; UI subscribes for re-render.
import { COUNTRIES } from './data/countries.js';

/** @type {{state: import('./types.js').GameState|null}} */
export const store = {
  state: null,
  lastObituary: null,
  listeners: new Set(),
  set(state) { this.state = state; this.notify(); },
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  notify() { this.listeners.forEach((fn) => fn(this.state)); },
};

export const player = () => store.state.player;
export const country = () => COUNTRIES[player().countryId];

export const livingNpcs = () =>
  player().npcIds.map((id) => store.state.npcs[id]).filter((n) => n && n.alive);

/** Role specs: any NPC role, plus 'mother' / 'father'. */
export function npcMatches(npc, spec) {
  if (spec === 'mother') return npc.role === 'parent' && npc.gender === 'female';
  if (spec === 'father') return npc.role === 'parent' && npc.gender === 'male';
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
