// localStorage persistence: multiple save slots plus the graveyard.
import { rng } from './rng.js';
import { netWorth } from './engine/finance.js';

export const SCHEMA_VERSION = 1;
const K_INDEX = 'pathways.index';
const K_SLOT = 'pathways.slot.';
const K_GRAVE = 'pathways.graveyard';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

/** Bring older saves up to the current schema. */
function migrate(state) {
  state.pendingEvents ??= [];
  state.eventHistory ??= [];
  state.player.birth ??= [];
  state.player.traitSources ??= {};
  const t = state.player.talents;
  t.singing ??= Math.round((t.music ?? 25) * 0.7);
  t.dance ??= Math.round((t.sports ?? 25) * 0.5);
  state.player.education.housing ??= 'home';
  state.player.homeId ??= null;
  state.market ??= { prices: {}, history: {}, cycle: 0 };
  state.schemaVersion = SCHEMA_VERSION;
  return state;
}

/** @returns {import('./types.js').SaveSlotMeta[]} newest first */
export const listSlots = () =>
  read(K_INDEX, []).sort((a, b) => b.updatedAt - a.updatedAt);

export function saveGame(state) {
  state.rngSeed = rng.state();
  state.updatedAt = Date.now();
  const p = state.player;
  const meta = {
    slotId: state.slotId,
    name: `${p.firstName} ${p.lastName}`,
    age: p.age,
    gender: p.gender,
    appearance: p.appearance,
    countryId: p.countryId,
    netWorth: netWorth(state),
    updatedAt: state.updatedAt,
  };
  const index = read(K_INDEX, []).filter((m) => m.slotId !== state.slotId);
  index.push(meta);
  return write(K_SLOT + state.slotId, state) && write(K_INDEX, index);
}

export function loadGame(slotId) {
  const state = read(K_SLOT + slotId, null);
  if (!state) return null;
  migrate(state);
  rng.seed(state.rngSeed);
  return state;
}

export function deleteSlot(slotId) {
  try { localStorage.removeItem(K_SLOT + slotId); } catch { /* storage unavailable */ }
  write(K_INDEX, read(K_INDEX, []).filter((m) => m.slotId !== slotId));
}

/** @returns {import('./types.js').GraveyardEntry[]} most recent first */
export const getGraveyard = () => read(K_GRAVE, []);

export function addToGraveyard(entry) {
  const list = getGraveyard();
  list.unshift(entry);
  write(K_GRAVE, list);
}
