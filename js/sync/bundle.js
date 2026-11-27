// Everything worth carrying to another device, as one bundle: saved lives,
// the graveyard (and with it every epitaph earned), and People you know.
// Used by the transfer code and by cloud saves.
//
// Bundles can be combined: the newer copy of each life wins, graves and
// people are joined together, and anything deleted on either side stays
// deleted (deletions are remembered for a while as "tombstones").
// The "age down" history is left out: it is large, and only makes sense on
// the device where the years were lived.

const K_INDEX = 'frombirth.index';
const K_SLOT = 'frombirth.slot.';
const K_GRAVE = 'frombirth.graveyard';
const K_UNDO = 'frombirth.undo.';
const K_PEOPLE = 'frombirth.people';
const K_GONE = 'frombirth.deleted';
/** Deletions older than this are forgotten. */
const TOMBSTONE_DAYS = 180;

const listeners = new Set();
/** Called whenever something that travels with a bundle is saved. */
export const onChanged = (fn) => listeners.add(fn);
export function changed() { for (const fn of listeners) { try { fn(); } catch { /* a listener failing must not stop a save */ } } }

function read(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

// ---------- Tombstones ----------

const emptyGone = () => ({ slots: {}, graves: {}, people: {} });
function gone() {
  const g = { ...emptyGone(), ...read(K_GONE, {}) };
  const cutoff = Date.now() - TOMBSTONE_DAYS * 86400000;
  for (const kind of Object.keys(emptyGone())) {
    g[kind] = Object.fromEntries(Object.entries(g[kind] ?? {}).filter(([, t]) => t > cutoff));
  }
  return g;
}
/** Records that something was deleted on purpose, so another device's copy does not bring it back. */
export function rememberDeleted(kind, id) {
  const g = gone();
  g[kind][id] = Date.now();
  write(K_GONE, g);
}
/** A life saved again (an age down after death, say) is no longer deleted. */
export function forgetDeleted(kind, id) {
  const g = read(K_GONE, null);
  if (!g?.[kind]?.[id]) return;
  delete g[kind][id];
  write(K_GONE, g);
}

// ---------- Bundles ----------

/**
 * @typedef {{v:1, at:number, slots:Object<string, object>, index:object[], graveyard:object[], people:object[], deleted:{slots:Object, graves:Object, people:Object}}} Bundle
 */

/** Everything on this device, as a bundle. @returns {Bundle} */
export function collect() {
  const index = read(K_INDEX, []);
  const slots = {};
  for (const m of index) {
    const s = read(K_SLOT + m.slotId, null);
    if (s) slots[m.slotId] = s;
  }
  return { v: 1, at: Date.now(), slots, index: index.filter((m) => slots[m.slotId]), graveyard: read(K_GRAVE, []), people: read(K_PEOPLE, []), deleted: gone() };
}

const newest = (a, b) => ((b?.updatedAt ?? 0) > (a?.updatedAt ?? 0) ? b : a);

/** Two bundles combined into one. Neither is changed. @returns {Bundle} */
export function merge(a, b) {
  const deleted = emptyGone();
  for (const kind of Object.keys(deleted)) {
    for (const src of [a.deleted?.[kind] ?? {}, b.deleted?.[kind] ?? {}]) {
      for (const [id, t] of Object.entries(src)) deleted[kind][id] = Math.max(deleted[kind][id] ?? 0, t);
    }
  }
  const slots = {};
  const index = [];
  for (const id of new Set([...Object.keys(a.slots ?? {}), ...Object.keys(b.slots ?? {})])) {
    const s = newest(a.slots?.[id], b.slots?.[id]);
    if (!s || (deleted.slots[id] ?? 0) >= (s.updatedAt ?? 0)) continue;
    slots[id] = s;
    const fromA = s === a.slots?.[id];
    const meta = (fromA ? a.index : b.index)?.find((m) => m.slotId === id) ?? (fromA ? b.index : a.index)?.find((m) => m.slotId === id);
    if (meta) index.push({ ...meta, updatedAt: s.updatedAt });
  }
  // Graves: one of each. Where both sides have it, keep the one that knows more (who carried on, say).
  const graves = new Map();
  for (const g of [...(a.graveyard ?? []), ...(b.graveyard ?? [])]) {
    if (!g?.id || deleted.graves[g.id]) continue;
    const had = graves.get(g.id);
    if (!had || Object.keys(g).length > Object.keys(had).length) graves.set(g.id, g);
  }
  // Most recently buried first. Graves from before this was recorded keep their order, at the end.
  const graveyard = [...graves.values()].sort((x, y) => (y.buriedAt ?? 0) - (x.buriedAt ?? 0));
  const people = new Map();
  for (const x of [...(a.people ?? []), ...(b.people ?? [])]) if (x?.id && !deleted.people[x.id] && !people.has(x.id)) people.set(x.id, x);
  return { v: 1, at: Date.now(), slots, index, graveyard, people: [...people.values()], deleted };
}

/**
 * Makes this device hold exactly what the bundle holds. Lives that are not
 * changing are left untouched (no rewriting megabytes for nothing).
 * @returns {{added:number, updated:number, removed:number}}
 */
export function apply(bundle) {
  const before = read(K_INDEX, []);
  const counts = { added: 0, updated: 0, removed: 0 };
  for (const m of before) {
    if (bundle.slots[m.slotId]) continue;
    try { localStorage.removeItem(K_SLOT + m.slotId); localStorage.removeItem(K_UNDO + m.slotId); } catch { /* ignore */ }
    counts.removed += 1;
  }
  for (const [id, s] of Object.entries(bundle.slots)) {
    const had = before.find((m) => m.slotId === id);
    if (had && had.updatedAt === s.updatedAt && localStorage.getItem(K_SLOT + id)) continue;
    write(K_SLOT + id, s);
    // The years that could be taken back belong to the old copy of this life.
    try { localStorage.removeItem(K_UNDO + id); } catch { /* ignore */ }
    counts[had ? 'updated' : 'added'] += 1;
  }
  write(K_INDEX, bundle.index);
  write(K_GRAVE, bundle.graveyard);
  write(K_PEOPLE, bundle.people);
  write(K_GONE, bundle.deleted);
  return counts;
}

/** A short summary that is the same for two bundles holding the same things. */
export function fingerprint(b) {
  const slots = Object.entries(b.slots).map(([id, s]) => `${id}@${s.updatedAt}`).sort().join(',');
  const graves = b.graveyard.map((g) => `${g.id}:${Object.keys(g).length}`).sort().join(',');
  const people = b.people.map((x) => x.id).sort().join(',');
  const gone = Object.entries(b.deleted).map(([k, v]) => `${k}:${Object.keys(v).sort().join('.')}`).join('|');
  return `${slots}|${graves}|${people}|${gone}`;
}

/** What a bundle holds, in a few words. */
export function describe(bundle) {
  const lives = Object.values(bundle.slots).filter((s) => s.player?.alive).length;
  const parts = [`${lives} ${lives === 1 ? 'life' : 'lives'}`, `${bundle.graveyard.length} ${bundle.graveyard.length === 1 ? 'grave' : 'graves'}`];
  if (bundle.people.length) parts.push(`${bundle.people.length} ${bundle.people.length === 1 ? 'person you know' : 'people you know'}`);
  return parts.join(', ');
}

// ---------- As text ----------

const PREFIX_GZ = 'FROMBIRTH1:';
const PREFIX_PLAIN = 'FROMBIRTH0:';

function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(text) {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
const streamBytes = async (stream) => new Uint8Array(await new Response(stream).arrayBuffer());

/** A bundle as one line of text, compressed where the browser can. */
export async function encode(bundle) {
  const json = new TextEncoder().encode(JSON.stringify(bundle));
  if (typeof CompressionStream === 'function') {
    const gz = await streamBytes(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip')));
    return PREFIX_GZ + toBase64(gz);
  }
  return PREFIX_PLAIN + toBase64(json);
}

/** Reads text made by encode(). Throws a plain-words Error if it is not one. */
export async function decode(text) {
  let t = String(text ?? '').replace(/\s+/g, '');
  let bytes;
  try {
    // A code made while the game was called Pathways reads the same.
    if (t.startsWith('PATHWAYS1:')) t = PREFIX_GZ + t.slice('PATHWAYS1:'.length);
    else if (t.startsWith('PATHWAYS0:')) t = PREFIX_PLAIN + t.slice('PATHWAYS0:'.length);
    if (t.startsWith(PREFIX_GZ)) {
      if (typeof DecompressionStream !== 'function') throw new Error('old');
      bytes = await streamBytes(new Blob([fromBase64(t.slice(PREFIX_GZ.length))]).stream().pipeThrough(new DecompressionStream('gzip')));
    } else if (t.startsWith(PREFIX_PLAIN)) bytes = fromBase64(t.slice(PREFIX_PLAIN.length));
    else throw new Error('not ours');
  } catch (e) {
    throw new Error(e.message === 'old' ? 'This browser is too old to open that code.' : 'That is not a From Birth transfer code, or part of it is missing.');
  }
  let b;
  try { b = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('That transfer code is damaged. Try copying it again.'); }
  if (b?.v !== 1 || typeof b.slots !== 'object') throw new Error('That is not a From Birth transfer code, or part of it is missing.');
  b.index ??= []; b.graveyard ??= []; b.people ??= []; b.deleted = { ...emptyGone(), ...b.deleted };
  return b;
}

/**
 * Brings a transfer code onto this device.
 * mode 'combine' keeps what is here and adds what is new; 'replace' makes
 * this device a copy of the code (what is here and not in the code is deleted).
 */
export async function importCode(text, mode = 'combine') {
  const incoming = await decode(text);
  const here = collect();
  let result;
  if (mode === 'replace') {
    // Deleting on purpose: remember it, so cloud saves do not bring it back.
    result = { ...incoming, deleted: merge(here, incoming).deleted };
    for (const id of Object.keys(here.slots)) if (!incoming.slots[id]) result.deleted.slots[id] = Date.now();
    for (const g of here.graveyard) if (!incoming.graveyard.some((x) => x.id === g.id)) result.deleted.graves[g.id] = Date.now();
    for (const x of here.people) if (!incoming.people.some((y) => y.id === x.id)) result.deleted.people[x.id] = Date.now();
    for (const kind of Object.keys(emptyGone())) {
      for (const id of Object.keys(result.deleted[kind])) {
        if (kind === 'slots' && incoming.slots[id]) delete result.deleted[kind][id];
        if (kind === 'graves' && incoming.graveyard.some((x) => x.id === id)) delete result.deleted[kind][id];
        if (kind === 'people' && incoming.people.some((x) => x.id === id)) delete result.deleted[kind][id];
      }
    }
  } else result = merge(here, incoming);
  apply(result);
  changed();
  return describe(incoming);
}

export const exportCode = async () => encode(collect());
