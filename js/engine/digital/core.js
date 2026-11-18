// The Digital World Engine's shared core: where its records live in the save,
// stable ids, who a character id refers to, the year's spare time, and how
// significant moments are written into the life story.
//
// Everything digital lives in `state.digital`, one object per saved life, so
// independent lives never share a social network. Characters are never copied
// here: every record refers to the player or an NPC by their existing id.
import { store, player, log, milestone } from '../../state.js';
import { SPARE_HOURS } from '../../data/digital.js';

export const DIGITAL_VERSION = 1;

/** Caps that keep a long dynasty's save inside browser storage. */
export const LIMITS = { postsPerAccount: 150, commentsPerPost: 12, messagesPerThread: 80, events: 400, ledger: 300, feedBackground: 6 };

/** @returns {object} the digital world of the life being played, created on first use. */
export function world(state = store.state) {
  if (!state.digital) {
    state.digital = {
      v: DIGITAL_VERSION, seq: 0,
      devices: [], accounts: {}, posts: {}, threads: {}, communities: {}, memberships: [],
      projects: {}, streams: [], contracts: {}, ledger: [], reputation: {}, controversies: {},
      events: [], trends: [], safety: [], wellbeing: {}, matches: [], offers: [], arcs: {},
      platformLog: [], time: { year: null, used: 0 }, acts: { year: null },
      // Accounts of people who have died, kept as they were (see legacy.js).
      archive: { ancestors: [] },
    };
  }
  return state.digital;
}

/** A stable id, unique within this life's digital world. Never reused, never changes. */
export function newId(prefix) {
  const d = world();
  d.seq += 1;
  return `${prefix}_${d.seq.toString(36)}`;
}

/** The player or NPC with this id, or null. Digital records only ever point at these. */
export function charOf(id) {
  const s = store.state;
  if (!id) return null;
  if (s.player.id === id) return s.player;
  return s.npcs[id] ?? null;
}
export const isPlayer = (id) => store.state.player.id === id;
export const nameOf = (id) => { const c = charOf(id); return c ? `${c.firstName} ${c.lastName ?? ''}`.trim() : 'Someone'; };
export const firstOf = (id) => charOf(id)?.firstName ?? 'Someone';
export const year = () => store.state.year;

/** Per-year counters for actions that are limited to once or a few times a year. */
export function acts() {
  const d = world();
  if (d.acts.year !== store.state.year) d.acts = { year: store.state.year };
  return d.acts;
}

// ---------- Time ----------

/**
 * Spare hours this year for digital life. School, work and young children
 * come first; what is left is what there is.
 */
export function spareHours(p = player()) {
  let h = SPARE_HOURS.base;
  if (p.education?.enrolled) h -= SPARE_HOURS.school;
  if (p.career?.careerId && !p.career.retired) h -= SPARE_HOURS.fulltime;
  if (p.career?.partTime) h -= SPARE_HOURS.parttime;
  const small = p.npcIds?.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role === 'child' && n.age < 12).length ?? 0;
  h -= Math.min(2, small) * SPARE_HOURS.kids;
  // A limit the player set themselves (Online Reputation → Time and well-being).
  const limit = store.state.digital?.wellbeing?.[p.id]?.limit;
  const cap = { light: 80, moderate: 180 }[limit];
  return Math.max(Math.min(SPARE_HOURS.minimum, cap ?? Infinity), Math.min(h, cap ?? Infinity));
}

export function hoursLeft() {
  const d = world();
  if (d.time.year !== store.state.year) d.time = { year: store.state.year, used: 0 };
  return Math.max(0, spareHours() - d.time.used);
}

/** Spends spare time. @returns {boolean} false (and spends nothing) when there is not enough. */
export function spendHours(h) {
  if (hoursLeft() < h) return false;
  world().time.used += h;
  return true;
}

// ---------- Results ----------

export const result = (ok, text, tone = ok ? 'good' : 'neutral', extra = {}) => ({ ok, text, tone, ...extra });

// ---------- Life story ----------

/**
 * Records a significant digital moment as a canonical life event: in the
 * digital world's own event list (which the Life Story and Family Archive
 * read), as a milestone when `milestoneText` is given, and in the journal.
 * Ordinary posts, likes and messages are never recorded here.
 *
 * @param {{kind:string, charIds:string[], platformId?:string, ref?:{type:string, id:string},
 *          summary:string, visibility?:'public'|'family'|'private', milestoneText?:string, tone?:string, once?:string}} e
 * @returns {?object} the event, or null when a `once` key was already recorded
 */
export function recordEvent(e) {
  const d = world();
  const p = player();
  if (e.once && d.events.some((x) => x.once === e.once)) return null;
  const ev = {
    id: newId('dev'), kind: e.kind, year: store.state.year, age: p.age, charIds: [...new Set(e.charIds)],
    platformId: e.platformId ?? null, ref: e.ref ?? null, summary: e.summary, visibility: e.visibility ?? 'family',
    once: e.once ?? null, ownerId: p.id,
  };
  d.events.push(ev);
  if (d.events.length > LIMITS.events) d.events.splice(0, d.events.length - LIMITS.events);
  if (e.milestoneText) milestone(e.milestoneText, 'digital');
  log(e.summary, 'system', e.tone ?? 'good');
  return ev;
}

/** The digital life events that involve a character, newest first. */
export const eventsOf = (charId) => world().events.filter((e) => e.charIds.includes(charId)).reverse();

// ---------- Reputation (one record per character: never duplicated elsewhere) ----------

/**
 * A character's standing online. Recognition is how many people know the
 * name; credibility is how far they are trusted; loyalty is how much their
 * audience sticks with them. Each change is kept with its cause.
 */
export function reputation(charId) {
  const d = world();
  d.reputation[charId] ??= { recognition: 0, credibility: 60, loyalty: 50, log: [] };
  return d.reputation[charId];
}

/** Changes one part of someone's reputation, recording why. */
export function adjustReputation(charId, part, delta, cause) {
  const r = reputation(charId);
  const before = r[part];
  r[part] = Math.max(0, Math.min(100, Math.round((r[part] + delta) * 10) / 10));
  if (r[part] !== before) {
    r.log.push({ year: store.state.year, part, delta: Math.round((r[part] - before) * 10) / 10, cause });
    if (r.log.length > 60) r.log.shift();
  }
  return r[part];
}

/**
 * Whether the digital world still refers to a character (an account, a
 * conversation, a memory). Such people are never deleted from the save when
 * they leave the player's life: they step off-stage, so every profile link
 * still opens a real person.
 */
export function referenced(id, state = store.state) {
  const d = state.digital;
  if (!d || !id) return false;
  return Object.values(d.accounts).some((a) => a.ownerId === id)
    || Object.values(d.threads).some((t) => t.participants.includes(id) || t.left?.includes(id))
    || d.events.some((e) => e.charIds.includes(id));
}

/** Removes someone from the save, unless the digital world needs them; then they only leave the player's life. */
export function forgetNpc(id, state = store.state) {
  const n = state.npcs[id];
  if (!n) return;
  state.player.npcIds = state.player.npcIds.filter((x) => x !== id);
  if (referenced(id, state)) { n.flags = { ...n.flags, offstage: { year: state.year } }; return; }
  delete state.npcs[id];
}
