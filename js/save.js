// localStorage persistence: multiple save slots plus the graveyard.
import { faceGenderOf } from './avatar/render.js';
import { settle as settleHood } from './engine/neighborhood.js';
import { rng } from './rng.js';
import { fameOf } from './engine/fame.js';
import { ensureCareer } from './engine/worklife.js';
import { netWorth } from './engine/finance.js';
import { normalize, hash } from './avatar/catalog.js';
import { ADDED_TALENTS } from './data/talents.js';
import { changed, rememberDeleted, forgetDeleted } from './sync/bundle.js';
import { migrateHealth } from './engine/health/record.js';
import { migrateContraception } from './engine/health/contraception.js';
import { ensureGlobal } from './engine/globalLife.js';
import { ledgerOf } from './engine/ledger.js';
import { reconcile as reconcileAnimals } from './engine/animals.js';
import { migrateDigital } from './engine/digital/tick.js';
import { migrateFamilyLife } from './engine/blended.js';
import { migrateMedicine } from './engine/medicine/core.js';
import { migrateInvestigations } from './engine/investigations/core.js';
import { ensureEra, alignWorld } from './engine/eras.js';
import { adoptOldSport } from './engine/sportsLife.js';
import { americanize } from './engine/spelling.js';
import { giveBirthday } from './engine/birthday.js';
import { giveNativeLanguages } from './engine/languages.js';

export const SCHEMA_VERSION = 2;
const K_INDEX = 'frombirth.index';
const K_SLOT = 'frombirth.slot.';
const K_GRAVE = 'frombirth.graveyard';
const K_UNDO = 'frombirth.undo.';
/** How many years back "age down" can go. */
export const UNDO_YEARS = 3;

/**
 * The game was called Pathways before it was released, and kept its data under "pathways." keys. That data is
 * not carried over (the change came before release): it is cleared once, so it takes up no space.
 */
export function forgetOldName(storages = [globalThis.localStorage, globalThis.sessionStorage]) {
  let removed = 0;
  for (const st of storages) {
    try {
      if (!st) continue;
      const old = [];
      for (let i = 0; i < st.length; i++) { const k = st.key(i); if (k?.startsWith('pathways.') || k?.startsWith('pathways:')) old.push(k); }
      for (const k of old) { st.removeItem(k); removed += 1; }
    } catch { /* storage unavailable */ }
  }
  return removed;
}
forgetOldName();

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
  // Saves from when the game was written in British English: their ids, keys and text, in American spelling.
  americanize(state);
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
  // A life saved before birthdays were kept was born on January 1. Between turns of the year (a yearly turn, or the
  // first month of one), it is given a day of its own now; otherwise at its next turn of the year (engine/turns.js).
  if (!pl.birthday && !(state.month > 0)) giveBirthday(pl);
  // A life saved before native languages were kept: the language of the country they were born in, spoken fully.
  if (pl.birthCountryId) giveNativeLanguages(pl);
  pl.skills ??= {};
  pl.flags.bornAs ??= pl.gender;
  pl.flags.gifts ??= Object.entries(pl.potential ?? pl.talents).filter(([, v]) => v >= 75).map(([k]) => k);
  // Lives saved before art, writing, technology and math and science were talents: each person is given them, from
  // their id so every load agrees, and centered a little toward what they already do well.
  const fillTalents = (who) => {
    if (!who?.talents) return;
    ADDED_TALENTS.forEach((id) => {
      if (who.talents[id] != null) return;
      const roll = (hash(`${who.id}:${id}`) % 1000) / 1000;
      const lean = id === 'art' ? 0 : ['persuasion', 'modeling'].includes(id) ? (who.stats?.charm ?? who.meters?.charm ?? 50) - 50 // the charming ones can talk
        : (who.stats?.intellect ?? who.meters?.intellect ?? 50) - 50; // the bookish ones lean on intellect
      who.talents[id] = Math.round(Math.max(0, Math.min(100, 6 + roll * 50 + lean / 4)));
    });
  };
  fillTalents(pl);
  for (const n of Object.values(state.npcs)) if (n.role !== 'pet') fillTalents(n);
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
  // Lives saved before the health record: conditions carried over, nothing invented.
  migrateHealth(state);
  // Contraception (engine/health/contraception.js): made lazily from the old birth-control switch; nothing invented.
  migrateContraception(state);
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
  fameOf(state.player); // a save's single fame figure becomes a fame profile, with where it came from noted; nothing is invented
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
  // Lives saved before the ledger: what they have today becomes an opening balance. No past is invented,
  // no bills are charged for years that were never recorded, and nobody is paid a "first" wage twice.
  if (!state.ledger) {
    if (pl.finance.lifetimeEarned > 0) pl.flags.firstPay ??= true;
    ledgerOf(state, { desc: 'What you had when the books were opened (from an earlier version of the game)' });
  }
  // Lives saved before the justice records: each record entry is kept as it was,
  // marked as older, with its offense named in today's terms. Nothing is invented:
  // open cases, unsolved crimes and sentences are upgraded the first time they are
  // used (engine/justice.js upgradeLegacy), with no trial history made up for them.
  const legal = pl.legal;
  legal.record ??= [];
  legal.history ??= [];
  legal.counselIds ??= [];
  legal.supervision ??= null;
  const OLD = { shoplift: 'shoplifting', pickpocket: 'theft', vandalism: 'criminal_damage', bike_theft: 'theft', burglary: 'burglary', mugging: 'robbery', car_theft: 'vehicle_theft', fraud: 'fraud', bank_robbery: 'armed_robbery', murder: 'homicide' };
  for (const r of legal.record) {
    if (r.caseId) continue;
    r.caseId = `legacy_${legal.record.indexOf(r)}`;
    r.legacy = true;
    if (OLD[r.crimeId]) { r.oldCrimeId = r.crimeId; r.crimeId = OLD[r.crimeId]; }
    r.outcome ??= r.convicted ? 'convicted' : 'acquitted';
    r.year ??= pl.birthYear + r.age;
  }
  // The other relationships (engine/bonds.js): an older life has none, and none is invented for it. Whether a couple
  // are exclusive is read from what they are (married or engaged: yes; dating: never discussed) the first time it matters.
  state.bonds ??= { seq: 0, list: {} };
  // Travel, papers, residence history and the family's shared record (engine/globalLife.js). Nothing is invented for older lives.
  ensureGlobal(state);
  // The Digital World (engine/digital): older saves keep their account and followers, with nothing invented.
  migrateFamilyLife(state); // parents, step-parents and half-siblings, from what the save already says (engine/blended.js)
  migrateDigital(state);
  // The medical career (engine/medicine): a doctor keeps their job and level; nothing of their training is invented.
  migrateMedicine(state);
  migrateInvestigations(state);
  // Historical Eras: a life saved before eras keeps its money as it was (see engine/eras.js).
  ensureEra(state, { legacy: true });
  // One sports system: a professional career kept under the old separate system becomes the player's sports record.
  if (state.proSport || state.player?.sport?.seasons) adoptOldSport(state);
  // Neighborhoods: an older life gets the neighborhood it lives in now, with today's neighbors and no invented past.
  try { settleHood(state, { quiet: true }); } catch (e) { console.warn('neighborhood', e); }
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
    month: state.month ?? 0, // a turn partway through a year (engine/turns.js)
    gender: p.gender,
    face: faceGenderOf(p), // how the face reads (avatar/render.js): for the saved-lives list
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
  if (!write(K_SLOT + state.slotId, state)) {
    // Out of room: the undo history goes before the life itself does.
    try { localStorage.removeItem(K_UNDO + state.slotId); } catch { /* storage unavailable */ }
    if (!write(K_SLOT + state.slotId, state)) return false;
  }
  return write(K_INDEX, index);
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
  const at = { age: p.age, month: state.month ?? 0, year: state.year, note };
  // A timeline is the same world: the same storms (engine/disasters.js) on both roads.
  state.worldId ??= state.timeline?.root ?? state.slotId;
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
  // The loaded life is the one being played: the world's money and currencies are its year's (Historical Eras), so
  // that living the same years again costs the same as it did the first time.
  alignWorld(state);
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
  // Three years back, however long a turn is (engine/turns.js): four turns a year with three-month turns.
  const perYear = 12 / ([6, 3].includes(state.settings?.step) ? state.settings.step : 12);
  while (list.length > UNDO_YEARS * perYear) list.shift();
  // Never more than a share of the browser's storage: the life's own save must always have room.
  while (list.length > 1 && list.reduce((n, x) => n + x.length, 0) > UNDO_BUDGET) list.shift();
  while (list.length && !write(K_UNDO + state.slotId, list)) list.shift();
  if (!list.length) { try { localStorage.removeItem(K_UNDO + state.slotId); } catch { /* storage unavailable */ } }
}
/**
 * Characters of saved turns the undo history may hold, at most. Browser storage is about five million characters for
 * everything, and a grown life is close to a million: undo keeps as many turns back as fit, often two or three.
 */
export const UNDO_BUDGET = 2500000;
/** Where taking back the last turn would return to: { age, month }, or null. */
export function peekUndo(slotId) {
  const list = read(K_UNDO + slotId, []);
  if (!list.length) return null;
  try { const s = JSON.parse(list[list.length - 1]); return { age: s.player.age, month: s.month ?? 0 }; } catch { return null; }
}
/** How many turns can be taken back for this life. */
export const undoDepth = (slotId) => read(K_UNDO + slotId, []).length;
/** Takes back the most recent turn (a year, or six or three months of one): returns the life as it was before it, or null. */
export function popUndo(slotId) {
  const list = read(K_UNDO + slotId, []);
  const raw = list.pop();
  if (!raw) return null;
  write(K_UNDO + slotId, list);
  const state = migrate(JSON.parse(raw));
  rng.seed(state.rngSeed);
  alignWorld(state); // a year taken back has that year's prices again
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
