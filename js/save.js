// localStorage persistence: multiple save slots plus the graveyard.
import { rng } from './rng.js';
import { ensureCareer } from './engine/worklife.js';
import { netWorth } from './engine/finance.js';
import { normalize, hash } from './avatar/catalog.js';
import { changed, rememberDeleted, forgetDeleted } from './sync/bundle.js';
import { reconcile as reconcileAnimals } from './engine/animals.js';

export const SCHEMA_VERSION = 1;
const K_INDEX = 'pathways.index';
const K_SLOT = 'pathways.slot.';
const K_GRAVE = 'pathways.graveyard';
const K_UNDO = 'pathways.undo.';
/** How many years back "age down" can go. */
export const UNDO_YEARS = 3;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { return false; }
  // Saved lives and the graveyard travel to other devices; the age-down history does not.
  if (!key.startsWith(K_UNDO)) changed();
  return true;
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
  // Cities renamed when the world data was checked against its sources: older saves keep working.
  const RENAMED = { do: { 'San Pedro': 'San Pedro de Macorís' } };
  const rename = (o, countryId) => { const to = RENAMED[countryId]?.[o?.city]; if (to) o.city = to; };
  rename(pl, pl.countryId);
  for (const l of pl.locations ?? []) rename(l, l.countryId);
  for (const a of pl.assets ?? []) if (a.kind === 'property') rename(a, a.countryId ?? pl.countryId);
  // The same renaming for employers, their openings, and businesses (engine/employers.js, business.js).
  for (const e of Object.values(state.jobs?.employers ?? {})) rename(e, e.countryId);
  for (const post of Object.values(state.jobs?.postings ?? {})) rename(post, post.countryId);
  for (const [key, ids] of Object.entries(state.jobs?.cities ?? {})) {
    const [cc, city] = key.split('/'); const to = RENAMED[cc]?.[city];
    if (to) { state.jobs.cities[`${cc}/${to}`] = ids; delete state.jobs.cities[key]; }
  }
  for (const b of pl.businesses ?? []) rename(b, b.countryId);
  // Careers before employers, side jobs and the time budget: fill in what the save lacks. Nothing is re-paid.
  ensureCareer(state.player.career);
  state.player.businesses ??= [];
  if (state.player.career.paidYear == null) state.player.career.paidYear = state.year; // this year's pay has already been through the old payroll
  for (const a of Object.values(state.animals?.byId ?? {})) for (const h of a.homes) rename(h, h.countryId);
  for (const e of state.animals?.events ?? []) if (e.place) rename(e.place, e.place.countryId);
  // Lives saved before the family's animals had a record of their own: each is entered once, as it stands,
  // with nothing made up about a past that was never written down.
  reconcileAnimals(state);
  // Animal businesses once had books of their own, before they joined the shared business system (engine/business.js).
  // Any still open in an old save are wound up: what was in them is paid to their owner, once.
  for (const b of Object.values(state.animals?.businesses ?? {})) {
    if (!b.closed && b.owner?.id === state.player.id && b.cash > 0) state.player.finance.cash += b.cash;
    if (!b.closed) b.closed = { year: state.year, why: 'wound up when businesses were brought together' };
    b.cash = 0;
  }
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
    timeline: state.timeline ?? null,
  };
  const index = read(K_INDEX, []).filter((m) => m.slotId !== state.slotId);
  index.push(meta);
  forgetDeleted('slots', state.slotId);
  return write(K_SLOT + state.slotId, state) && write(K_INDEX, index);
}

/** A saved life as it stands, without starting to play it: for comparing timelines. */
export function peekGame(slotId) {
  const state = read(K_SLOT + slotId, null);
  return state ? migrate(state) : null;
}

/** How many timelines one life may have, the first included. Saved lives are large, and browser storage is small. */
export const MAX_TIMELINES = 4;
/** The saved lives that began as the same life. */
export const timelinesOf = (root) => listSlots().filter((m) => (m.timeline?.root ?? m.slotId) === root);

/**
 * "What if?": keeps a copy of this exact moment as a life of its own, so the
 * other choice can be lived too. The copy is a separate saved life; the one
 * being played carries on. Both remember where they parted.
 * @param {object} state  the life as it stands, the choice not yet made
 * @param {string} note   what the moment was, in a few words
 * @returns {{ok:boolean, text:string, slotId?:string}}
 */
export function forkGame(state, note) {
  const root = state.timeline?.root ?? state.slotId;
  const have = timelinesOf(root).length || 1;
  if (have >= MAX_TIMELINES) return { ok: false, text: `This life already has ${MAX_TIMELINES} timelines. Delete one from the title screen to keep another.` };
  const p = state.player;
  const at = { age: p.age, year: state.year, note };
  state.rngSeed = rng.state();
  const copy = JSON.parse(JSON.stringify(state));
  copy.slotId = `life_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  copy.createdAt = Date.now();
  copy.timeline = { root, from: state.slotId, ...at, name: `What if ${have}` };
  // The copy takes its own road from here: a different run of luck, the same past.
  copy.rngSeed = (state.rngSeed ^ (0x9e3779b9 * have)) >>> 0 || 1;
  const keepSeed = rng.state();
  const saved = saveCopy(copy);
  rng.seed(keepSeed);
  if (!saved) { deleteSlot(copy.slotId); return { ok: false, text: 'There is not enough storage left on this device to keep another timeline.' }; }
  state.timeline ??= { root, name: 'The first telling' };
  (state.timeline.forks ??= []).push(at);
  saveGame(state);
  return { ok: true, text: `This moment is kept. "${copy.timeline.name}" is waiting on the title screen, with the choice still to make.`, slotId: copy.slotId };
}
/** Saves a life that is not the one being played, leaving the dice alone. */
function saveCopy(state) {
  const seed = state.rngSeed;
  const done = saveGame(state);
  if (done) { const raw = read(K_SLOT + state.slotId, null); if (raw) { raw.rngSeed = seed; write(K_SLOT + state.slotId, raw); } }
  return done;
}

export function loadGame(slotId) {
  const state = read(K_SLOT + slotId, null);
  if (!state) return null;
  migrate(state);
  rng.seed(state.rngSeed);
  return state;
}

export function deleteSlot(slotId, keepUndo = false) {
  rememberDeleted('slots', slotId);
  try { localStorage.removeItem(K_SLOT + slotId); if (!keepUndo) localStorage.removeItem(K_UNDO + slotId); } catch { /* storage unavailable */ }
  write(K_INDEX, read(K_INDEX, []).filter((m) => m.slotId !== slotId));
}

/**
 * Remembers the life as it stands, so the year about to be lived can be
 * taken back. Called just before the age goes up. If storage is short, older
 * years are dropped rather than failing.
 */
export function pushUndo(state) {
  state.rngSeed = rng.state();
  // Only the life being played keeps its history: it is large, and browser storage is small.
  try { for (const key of Object.keys(localStorage)) if (key.startsWith(K_UNDO) && key !== K_UNDO + state.slotId) localStorage.removeItem(key); } catch { /* storage unavailable */ }
  const list = read(K_UNDO + state.slotId, []);
  list.push(JSON.stringify(state));
  while (list.length > UNDO_YEARS) list.shift();
  while (list.length && !write(K_UNDO + state.slotId, list)) list.shift();
}
/** How many years can be taken back for this life. */
export const undoDepth = (slotId) => read(K_UNDO + slotId, []).length;
/** Takes back the most recent year: returns the life as it was before it, or null. */
export function popUndo(slotId) {
  const list = read(K_UNDO + slotId, []);
  const raw = list.pop();
  if (!raw) return null;
  write(K_UNDO + slotId, list);
  const state = migrate(JSON.parse(raw));
  rng.seed(state.rngSeed);
  return state;
}
/** Removes a grave, when the death it records is taken back. */
export function removeGrave(id) { rememberDeleted('graves', id); write(K_GRAVE, getGraveyard().filter((g) => g.id !== id)); }

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
  entry.buriedAt ??= Date.now();
  list.unshift(entry);
  write(K_GRAVE, list);
}
