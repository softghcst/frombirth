// Living Families & Growing Up: the shared layer under blended families, teenage life, moving out, love and marriage,
// and foster care (engine/blended.js, teenLife.js, independence.js, engagement.js, fostering.js; tied together in
// engine/familyLife.js). It began as the "Living Families foundation" patch and keeps its rules, adapted to this game:
//
// - People are never invented or replaced here. Every id is the player's or an NPC's in state.npcs; the family itself
//   (who is whose parent, spouse or child) stays where it has always been: npc.role, npc.parentIds and npc.flags.
//   What this keeps is only what nothing else did: a timeline of family events, and each feature's own record.
// - Time is counted in months lived: year * 12 + month, where month is 0..11 counted from the player's birthday
//   (engine/turns.js). The month just finished is lived(state). Each feature's monthly step is run once for every month
//   lived, in order, at the turn of the year (engine/familyLife.js), whatever the turn length: a life played in 3-, 6-
//   or 12-month turns comes out exactly the same. What the player does is dated to the month it is done in.
// - Chance here never touches the game's own dice (rng): each month's roll is seeded from the life and the month, so
//   adding these features changes no other roll. Where an NPC must be made (makeNpc draws from the dice), it is made
//   inside withDice(), which seeds the dice for the moment and puts them back exactly as they were.
// - Legal steps (a marriage, a placement in care, a child moving home) are checked by the game's own rules (may(),
//   guardianship.js) before they are recorded; the checks here are the minimum any of them must meet.
//
//   state.livingFamilies = { schema, through, events: [{ id, kind, at, people, text }], nextId,
//     blended: {...}, teen: {...}, home: {...}, love: {...}, care: {...} }   (each feature keeps its own part)
import { store } from '../state.js';
import { rng } from '../rng.js';

export const FAMILY_SCHEMA = 1;
export const FAMILY_FEATURES = Object.freeze(['blended', 'teen', 'independence', 'romance', 'care']);
/** Most family events kept on the timeline; the oldest are dropped first. */
const KEEP_EVENTS = 400;

export const fail = (text, tone = 'neutral') => ({ ok: false, text, tone });
export const done = (text, tone = 'good', extra = {}) => ({ ok: true, text, tone, ...extra });

/** The month just lived, as one number: year * 12 + month - 1. */
export const lived = (state = store.state) => state.year * 12 + (state.month ?? 0) - 1;
/** The month being lived now (the next to finish). */
export const nowMonth = (state = store.state) => state.year * 12 + (state.month ?? 0);
/** The year a month index falls in, and the month within it. */
export const yearOfMonth = (m) => Math.floor(m / 12);
/**
 * The player's age during month m. The year (and their age) turns on their birthday, which the yearly step has already
 * passed when it catches up the months before it: so the age is worked out from the month, not read as it is now.
 */
export const ageIn = (state, m) => state.player.age - (state.year - yearOfMonth(m));
export const monthOfMonth = (m) => ((m % 12) + 12) % 12;

export const person = (state, id) => (id === state?.player?.id ? state.player : state?.npcs?.[id]) ?? null;
const exists = (state, id) => !!person(state, id);

/**
 * The shared record, made on first use and on every load (save.js). Older saves gain it with nothing in it: no past
 * events are made up. The months already lived count as processed.
 */
export function ensureLivingFamilies(state = store.state) {
  if (!state?.player?.id || !state.npcs) throw new Error('Game state with player and NPCs required');
  const f = state.livingFamilies ??= {};
  f.schema = FAMILY_SCHEMA;
  f.nextId ??= 0;
  f.events ??= [];
  f.through ??= lived(state);
  for (const k of ['blended', 'teen', 'home', 'love', 'care']) f[k] ??= {};
  return f;
}
export const LF = (state = store.state) => ensureLivingFamilies(state);

/** Writes a family event on the timeline. Returns it. */
export function recordEvent(state, kind, people, text, extra = {}) {
  const f = ensureLivingFamilies(state);
  const e = { id: `fam_${++f.nextId}`, kind, at: Math.max(lived(state), 0), age: state.player.age, people: [...new Set(people.filter(Boolean))], text, ...extra };
  f.events.push(e);
  if (f.events.length > KEEP_EVENTS) f.events.splice(0, f.events.length - KEEP_EVENTS);
  return e;
}
/** The timeline, newest first, optionally about one person. */
export const timeline = (state = store.state, personId = null) =>
  ensureLivingFamilies(state).events.filter((e) => !personId || e.people.includes(personId)).slice().reverse();

// ---------- Dice of their own ----------

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** A seeded generator for one key (a life, a feature, a month): the same key always rolls the same. */
export function dice(state, ...key) {
  let s = hash(`${state.player.id}|${state.player.birthYear ?? ''}|${key.join('|')}`) || 1;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, chance: (p) => next() < p, int: (a, b) => a + Math.floor(next() * (b - a + 1)), pick: (arr) => arr[Math.floor(next() * arr.length)] };
}
/**
 * Runs fn with the game's dice seeded from a key of its own, then puts them back exactly as they were: for what can
 * only be done with the game's dice (making an NPC), without moving any other roll in the life.
 */
export function withDice(state, key, fn) {
  const saved = rng.state();
  rng.seed(hash(`${state.player.id}|dice|${key}`) || 1);
  try { return fn(); } finally { rng.seed(saved); }
}

// ---------- Months ----------

const STEPS = [];
/**
 * Registers a feature's monthly step: fn(state, m) for each month m lived, in the order registered. Each runs once per
 * month however many turns that month was split across.
 */
export function onMonth(id, fn) {
  if (!STEPS.some((s) => s.id === id)) STEPS.push({ id, fn });
}
/**
 * Runs every feature for each month lived since the last time, up to `through` (the month just lived). Safe to call
 * again: a month is never run twice. Returns how many months were run.
 */
export function processThrough(state = store.state, through = lived(state)) {
  const f = ensureLivingFamilies(state);
  if (!state.player.alive) { f.through = Math.max(f.through, through); return 0; }
  let n = 0;
  // A long gap (a save loaded from long ago, a jump in time) is caught up only for its last two years: nothing older
  // is invented.
  const from = Math.max(f.through + 1, through - 23);
  for (let m = from; m <= through; m++) {
    for (const s of STEPS) {
      try { s.fn(state, m); } catch (e) { if (typeof console !== 'undefined') console.warn(`livingFamilies ${s.id}`, e); }
    }
    f.through = m;
    n++;
  }
  if (f.through < through) f.through = through;
  return n;
}

// ---------- Rules every feature keeps ----------

/** Whether someone is a child (under 18) at this moment. */
export const isMinor = (state, id) => (person(state, id)?.age ?? 0) < 18;
/** The checks every engagement must meet before the romance rules (may('marry')) are asked: two different adults. */
export function engagementOk(state, a, b) {
  if (!exists(state, a) || !exists(state, b)) return fail('Unknown person.');
  if (a === b) return fail('Two different people are needed.');
  if (isMinor(state, a) || isMinor(state, b)) return fail('Engagement is for two adults.');
  return done('');
}
/** The checks every care placement must meet before any agency or court is asked: a child, and an adult to care. */
export function careOk(state, childId, carerId) {
  if (!exists(state, childId) || !exists(state, carerId)) return fail('Unknown person.');
  if (childId === carerId) return fail('A child cannot be their own carer.');
  if (!isMinor(state, childId)) return fail('Care is for children under 18.');
  if (isMinor(state, carerId)) return fail('A carer must be an adult.');
  return done('');
}
/** A lease is for an adult. */
export const leaseOk = (state, tenantId) => (isMinor(state, tenantId) ? fail('You have to be 18 to sign a lease.') : done(''));

/**
 * Who the player lives with now, in one word, read from what the game already records (never stored twice):
 * 'parents' | 'mother' | 'father' | 'care' | 'own' | 'partner' | 'dorm' | 'prison'.
 */
export function householdOf(state = store.state) {
  const p = state.player;
  if (p.legal?.incarceration) return 'prison';
  if (p.flags.care) return 'care';
  if (p.education?.enrolled && p.education.housing === 'dorm') return 'dorm';
  if (p.flags.livesWithParents) {
    const b = state.livingFamilies?.blended;
    const withId = b?.custody?.with;
    const w = withId ? state.npcs[withId] : null;
    if (w?.alive && b?.custody?.kind !== 'shared') return w.gender === 'male' ? 'father' : 'mother';
    return 'parents';
  }
  const partner = Object.values(state.npcs).find((n) => n.alive && p.npcIds.includes(n.id) && (n.role === 'spouse' || (n.role === 'partner' && n.flags.livesTogether)));
  return partner ? 'partner' : 'own';
}

/** Problems with the record: people who are gone from the save, two homes at once, a child in two placements. */
export function validateLivingFamilies(state = store.state) {
  const f = ensureLivingFamilies(state);
  const errors = [];
  for (const e of f.events) for (const id of e.people) if (!exists(state, id)) { errors.push(`Event ${e.id} names someone not in the save: ${id}`); break; }
  const open = (f.care.placements ?? []).filter((x) => x.end == null);
  const kids = new Set();
  for (const x of open) {
    if (!exists(state, x.childId)) errors.push(`Placement ${x.id} has no child`);
    if (kids.has(x.childId)) errors.push(`Child in two placements: ${x.childId}`);
    kids.add(x.childId);
  }
  const lease = f.home.lease;
  if (lease && lease.status === 'active' && state.player.flags.livesWithParents) errors.push('An active lease while living with parents');
  if (f.through > lived(state) + 1) errors.push('Months processed ahead of the calendar');
  return errors;
}
