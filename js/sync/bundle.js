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
 *
 * All or nothing: every new or changed life is written first, then the lists. If anything cannot be written (the
 * device's storage is full, say), everything already written is put back as it was, nothing is removed, and an
 * Error is thrown. Lives that the bundle no longer holds are removed only once everything else is in place.
 * @returns {{added:number, updated:number, removed:number}}
 */
export function apply(bundle) {
  const before = read(K_INDEX, []);
  const counts = { added: 0, updated: 0, removed: 0 };
  const undo = []; // [key, the raw value it had (null: there was none)]
  const put = (key, raw) => {
    let had = null;
    try { had = localStorage.getItem(key); } catch { /* unreadable: treated as absent */ }
    try { localStorage.setItem(key, raw); } catch { return false; }
    undo.push([key, had]);
    return true;
  };
  const rollback = () => {
    for (const [key, had] of undo.reverse()) {
      try { if (had == null) localStorage.removeItem(key); else localStorage.setItem(key, had); } catch { /* best effort */ }
    }
  };
  const fail = () => {
    rollback();
    throw new Error('There is not enough storage on this device to bring these saves in. Nothing here was changed. Delete a life you no longer need, or free some space, and try again.');
  };
  const replacing = [];
  for (const [id, s] of Object.entries(bundle.slots)) {
    const had = before.find((m) => m.slotId === id);
    let present = false;
    try { present = localStorage.getItem(K_SLOT + id) != null; } catch { /* treated as absent */ }
    if (had && had.updatedAt === s.updatedAt && present) continue;
    if (!put(K_SLOT + id, JSON.stringify(s))) fail();
    replacing.push(id);
    counts[had ? 'updated' : 'added'] += 1;
  }
  // A life here that the bundle neither holds nor says was deleted (one this device could not read, say) is kept, and
  // stays on the list: only a deletion on purpose removes a life.
  const kept = before.filter((m) => !bundle.slots[m.slotId] && !bundle.deleted?.slots?.[m.slotId]);
  if (!put(K_INDEX, JSON.stringify([...bundle.index, ...kept])) || !put(K_GRAVE, JSON.stringify(bundle.graveyard))
    || !put(K_PEOPLE, JSON.stringify(bundle.people)) || !put(K_GONE, JSON.stringify(bundle.deleted))) fail();
  // Everything is in place: now the years that could be taken back for a changed life (they belong to the old copy),
  // and the lives the bundle no longer holds, can go.
  for (const id of replacing) { try { localStorage.removeItem(K_UNDO + id); } catch { /* ignore */ } }
  for (const m of before) {
    if (bundle.slots[m.slotId] || !bundle.deleted?.slots?.[m.slotId]) continue;
    try { localStorage.removeItem(K_SLOT + m.slotId); localStorage.removeItem(K_UNDO + m.slotId); } catch { /* ignore */ }
    counts.removed += 1;
  }
  return counts;
}

/**
 * Checks a bundle before anything is done with it, and tidies what can be tidied safely. A life that is not a life
 * (no player) is left out and reported; nothing that is a life is ever dropped. Duplicate entries become one; a life
 * without an entry in the list of saved lives is given a plain one, so it can be found on the title screen.
 * @returns {{bundle:Bundle, problems:string[]}}
 */
export function validate(b) {
  const problems = [];
  if (!b || typeof b !== 'object' || typeof b.slots !== 'object' || b.slots === null || Array.isArray(b.slots)) {
    throw new Error('That is not a From Birth transfer code, or part of it is missing.');
  }
  const slots = {};
  for (const [id, s] of Object.entries(b.slots)) {
    if (!s || typeof s !== 'object' || !s.player || typeof s.player !== 'object' || typeof s.player.firstName !== 'string') {
      problems.push(`A saved life (${id}) is damaged and was left out.`);
      continue;
    }
    if (s.slotId !== id) s.slotId = id;
    slots[id] = s;
  }
  const index = [];
  const seen = new Set();
  for (const m of Array.isArray(b.index) ? b.index : []) {
    if (!m?.slotId || !slots[m.slotId] || seen.has(m.slotId)) continue;
    seen.add(m.slotId);
    index.push({ ...m, updatedAt: slots[m.slotId].updatedAt ?? m.updatedAt ?? 0 });
  }
  for (const [id, s] of Object.entries(slots)) {
    if (seen.has(id)) continue;
    const p = s.player;
    index.push({ slotId: id, name: `${p.firstName} ${p.lastName ?? ''}`.trim(), age: p.age ?? 0, month: s.month ?? 0, gender: p.gender,
      appearance: p.appearance, countryId: p.countryId, netWorth: 0, dead: p.alive === false, updatedAt: s.updatedAt ?? 0, timeline: s.timeline ?? null });
  }
  const once = (list, what) => {
    const out = []; const ids = new Set();
    for (const x of Array.isArray(list) ? list : []) {
      if (!x || typeof x !== 'object' || !x.id) { problems.push(`A damaged ${what} was left out.`); continue; }
      if (ids.has(x.id)) continue;
      ids.add(x.id); out.push(x);
    }
    return out;
  };
  const deleted = emptyGone();
  for (const kind of Object.keys(deleted)) {
    for (const [id, t] of Object.entries(b.deleted?.[kind] ?? {})) if (Number.isFinite(t)) deleted[kind][id] = t;
  }
  return { bundle: { v: 1, at: Number(b.at) || 0, slots, index, graveyard: once(b.graveyard, 'grave'), people: once(b.people, 'person'), deleted }, problems };
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
  const { bundle, problems } = validate(b);
  for (const p of problems) console.warn('transfer code:', p);
  return bundle;
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

/**
 * Everything on this device as a transfer code, read back and compared before it is handed over, so a code that
 * would not load again is never given out. Throws a plain-words Error if it does not read back the same.
 */
export async function exportCode() {
  const bundle = collect();
  const code = await encode(bundle);
  if (!(await verify(code, bundle))) throw new Error('The transfer code did not read back correctly, so it was not given out. Try again; your saves here are unchanged.');
  return code;
}

/** Whether a code reads back as exactly what the bundle holds. */
export async function verify(code, bundle) {
  try { return fingerprint(await decode(code)) === fingerprint(validate(bundle).bundle); } catch { return false; }
}
