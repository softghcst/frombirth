// localStorage persistence: multiple save slots plus the graveyard.
import { rng } from './rng.js';
import { netWorth } from './engine/finance.js';
import { normalize, hash } from './avatar/catalog.js';

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
  state.player.flags.longevity ??= Math.round((Math.random() + Math.random() + Math.random() - 1.5) / 1.5 * 11);
  state.market ??= { prices: {}, history: {}, cycle: 0 };
  // Lives saved before orientation, identity and skills existed.
  const pl = state.player;
  pl.orientation ??= 'straight';
  pl.skills ??= {};
  pl.flags.bornAs ??= pl.gender;
  pl.flags.gifts ??= Object.entries(pl.talents).filter(([, v]) => v >= 75).map(([k]) => k);
  for (const n of Object.values(state.npcs)) if (n.role !== 'pet') n.orientation ??= ['straight', 'straight', 'straight', 'straight', 'straight', 'straight', 'straight', 'straight', 'gay', 'bisexual'][hash(n.id) % 10];
  // Faces saved before the avatar system: give each a complete appearance,
  // chosen from the character's id so it is the same on every load.
  state.player.appearance = normalize(state.player.appearance, state.player.id);
  for (const n of Object.values(state.npcs)) if (n.role !== 'pet') n.appearance = normalize(n.appearance, n.id);
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
    dead: !p.alive,
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

/** Changes a grave after the fact, e.g. to record who carried on. */
export function updateGrave(id, patch) {
  const list = getGraveyard();
  const g = list.find((x) => x.id === id);
  if (!g) return;
  Object.assign(g, patch);
  write(K_GRAVE, list);
}

/** Ids of every epitaph earned across all lives. */
export const epitaphsEarned = () => [...new Set(getGraveyard().flatMap((g) => g.epitaphIds ?? []))];

export function addToGraveyard(entry) {
  const list = getGraveyard();
  list.unshift(entry);
  write(K_GRAVE, list);
}
