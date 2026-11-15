// Mortality maths and the end of a life. Phase 9 adds epitaph awards,
// estate tax and continuing as a child.
import { rng } from '../rng.js';
import { uid } from '../util.js';
import { store, player, log } from '../state.js';
import { netWorth } from './finance.js';
import { addToGraveyard, deleteSlot } from '../save.js';
import { stageLabel } from './education.js';

/** Yearly chance of dying, given age and a 0–100 health value. */
export function mortalityChance(age, health) {
  const base = 0.0004 + Math.min(0.6, Math.exp((age - 96) / 9) * 0.3);
  return Math.min(0.95, base * (1.7 - health / 100));
}

const ACCIDENTS = ['a traffic accident', 'a fall', 'a house fire', 'drowning', 'a freak accident'];

/** Rolls the yearly death check. @returns {?string} cause, or null if alive */
export function rollDeath() {
  const p = player();
  const worst = [...p.conditions].sort((a, b) => b.severity - a.severity)[0];
  if (p.stats.health <= 0) return worst ? worst.name.replace(/^an? /, '') : 'failing health';
  if (!rng.chance(mortalityChance(p.age, p.stats.health))) return null;
  if (worst && worst.severity >= 45 && rng.chance(0.7)) return worst.name.replace(/^an? /, '');
  return p.age >= 70 ? 'old age' : rng.pick(ACCIDENTS);
}

function lastOccupation(p) {
  if (p.career.title) return p.career.title;
  if (p.career.retired) return 'Retired';
  const last = p.career.history[p.career.history.length - 1];
  if (last) return `Former ${last.title}`;
  if (p.education.enrolled) return `Student (${stageLabel(p.education.stage).toLowerCase()})`;
  return p.age < 5 ? 'Infant' : 'Unemployed';
}

/** Ends the current life, files it in the graveyard and frees the save slot. */
export function die(cause) {
  const state = store.state;
  const p = player();
  if (!p.alive) return store.lastObituary;
  p.alive = false;
  log(`You died of ${cause} at age ${p.age}.`, 'system', 'bad');

  /** @type {import('../types.js').GraveyardEntry} */
  const entry = {
    id: uid('grave'),
    fullName: `${p.firstName} ${p.lastName}`,
    gender: p.gender,
    ageAtDeath: p.age,
    birthYear: p.birthYear,
    deathYear: state.year,
    causeOfDeath: cause,
    netWorth: netWorth(state),
    countryId: p.countryId,
    city: p.city,
    lastOccupation: lastOccupation(p),
    epitaphIds: [],
    childrenCount: p.npcIds.filter((id) => state.npcs[id]?.role === 'child').length,
    milestones: p.milestones,
    counters: p.counters,
    generation: p.generation,
    continuedAsNpcId: null,
  };
  addToGraveyard(entry);
  deleteSlot(state.slotId);
  store.lastObituary = entry;
  return entry;
}
