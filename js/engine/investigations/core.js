// The investigative career's records: what the world keeps (agencies, offices, laboratories,
// applications, task forces, private inquiries, complaints) and what an investigator keeps
// (training, employment, skills, reputation, cases, history). Everything else in
// engine/investigations reads and writes through here.
//
//   state.investigations = {
//     v, seq,                          version, and a counter for ids that are the same on every load
//     agencies:   { [id]: Agency },    police departments, sheriff's offices, state and national police (agencies.js)
//     offices:    { [id]: Office },    federal field offices (agencies.js)
//     labs:       { [id]: Lab },       a laboratory per agency or office, with its analysts
//     taskForces: { [id]: TaskForce }, agencies working one case together (casework.js)
//     inquiries:  { [id]: Inquiry },   missing-person inquiries and private engagements (casework.js, private.js)
//     complaints: { [id]: Complaint }, professional-conduct complaints (oversight.js)
//   }
//   player.investigator: the investigator's own record (see blank() below). Made when first needed.
//
// The criminal case itself is never kept here: an investigation is the one in engine/cases.js
// (store.state.justice), and its case file is a field on that same record (inv.file), so the
// detective, the laboratory, the prosecutor, the defense and the court all read one case.
//
// Time: anything that takes time (an academy, a laboratory request, a court date) is given a date
// in months, `at(year, month)`, when it starts. It is decided then and becomes known when the
// calendar reaches it, so 3-, 6- and 12-month turns give the same results on the same dates.
//
// Privacy: case files are confidential. The career (academies, agencies, ranks, units, public
// honors) is public and recorded with recordEvent(privacy 'public'); cases reach the public record
// only through what a court does in public (views.js).
import { rng } from '../../rng.js';
import { clamp } from '../../util.js';
import { store, player, log, milestone } from '../../state.js';
import { recordEvent } from '../chronicle.js';
import { SKILLS, REPUTATION } from '../../data/investigations.js';

export const VERSION = 1;
export const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
export const year = () => store.state.year;
/** The player's id as other records hold it. */
export const me = (p = player()) => p.id ?? 'player';
/** Now, in months since year 0: the clock everything with a duration is measured on. */
export const now = (state = store.state) => state.year * 12 + (state.month ?? 0);
export const at = (y, m = 0) => y * 12 + m;
/** A month count as words, for the screen. */
export function dateWords(idx) {
  const y = Math.floor(idx / 12);
  const m = idx - y * 12;
  return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m]} ${y}`;
}

/** The world's investigative records. */
export function W(state = store.state) {
  const w = (state.investigations ??= {});
  w.v ??= VERSION;
  w.seq ??= 0;
  for (const k of ['agencies', 'offices', 'labs', 'taskForces', 'inquiries', 'complaints']) w[k] ??= {};
  return w;
}
export const nextId = (prefix) => `${prefix}_${++W().seq}`;

/** A blank investigator record. */
function blank() {
  return {
    v: VERSION, family: null, stage: 'none',
    apps: [], academy: null, job: null, license: null, retired: null,
    skills: Object.fromEntries(Object.keys(SKILLS).map((k) => [k, SKILLS[k].advanced ? 10 : 25])),
    rep: Object.fromEntries(REPUTATION.map((k) => [k, 50])),
    stats: { years: 0, agencies: [], units: [], assigned: 0, completed: 0, referred: 0, charged: 0, declined: 0, convicted: 0, acquitted: 0, dismissed: 0,
      cleared: 0, cold: 0, reopened: 0, court: 0, awards: [], unknownBefore: false },
    caseIds: [], inquiryIds: [], history: [], discipline: [],
    people: { ftoId: null, partnerId: null, supervisorId: null, mentorId: null, analystId: null, prosecutorId: null, classmateIds: [], formerPartnerIds: [] },
    scenes: {}, acted: {}, interest: 0, prep: { study: 0, fitness: 0, writing: 0 },
  };
}

/** The investigator's record, made if it is not there. */
export function I(p = player()) {
  p.investigator ??= blank();
  const r = p.investigator;
  const fresh = blank();
  for (const [k, v] of Object.entries(fresh)) if (r[k] === undefined) r[k] = v;
  for (const k of Object.keys(SKILLS)) r.skills[k] ??= fresh.skills[k];
  for (const k of REPUTATION) r.rep[k] ??= 50;
  for (const [k, v] of Object.entries(fresh.stats)) r.stats[k] ??= v;
  for (const [k, v] of Object.entries(fresh.people)) r.people[k] ??= v;
  return r;
}
/** The record if there is one, without making it. */
export const rec = (p = player()) => p.investigator ?? null;

/** Once-a-year actions: true the first time this year, false after. */
export function once(key, r = I()) {
  if (r.acted.year !== year()) r.acted = { year: year() };
  if (r.acted[key]) return false;
  r.acted[key] = true;
  return true;
}
export const doneThisYear = (key, r = rec()) => !!r && r.acted.year === year() && !!r.acted[key];

/** Moves a skill, within 0-100. */
export function grow(skill, by, r = I()) { r.skills[skill] = clamp(Math.round((r.skills[skill] + by) * 10) / 10); }
/** Moves a reputation measure, within 0-100. */
export function regard(k, by, r = I()) { r.rep[k] = clamp(Math.round(r.rep[k] + by)); }

/**
 * Professional reputation: how the work is done, never how many people were arrested or convicted.
 * Publicity is not part of it (fame is kept by engine/fame.js, separately).
 */
export function reputationOf(r = rec()) {
  if (!r) return 0;
  const x = r.rep;
  const base = x.integrity * 0.22 + x.skill * 0.2 + x.reports * 0.14 + x.ethics * 0.16 + x.reliability * 0.12 + x.teamwork * 0.1 + x.leadership * 0.06;
  const marks = r.discipline.filter((d) => d.year > year() - 10 && d.finding === 'substantiated').length * 8;
  return clamp(Math.round(base - marks));
}
/** The skills an investigative task leans on, averaged. */
export const skillAvg = (keys, r = rec()) => (r ? keys.reduce((s, k) => s + (r.skills[k] ?? 0), 0) / keys.length : 25);

/** A line in the investigator's public career history (and the life story). */
export function note(text, kind = 'career', o = {}) {
  const r = I();
  const p = player();
  r.history.push({ year: year(), age: p.age, text, kind });
  if (o.log !== false) log(text, 'system', o.tone ?? 'good');
  if (o.milestone) milestone(o.milestone, 'career');
  if (o.key) recordEvent({ key: `inv:${p.archiveId ?? p.id ?? p.firstName}:${o.key}`, kind: 'investigative_career', text: o.milestone ?? text, privacy: 'public', significance: o.significance ?? 1 });
}

/** Stable pick from a list by a key, without touching the game's dice (things made the same on every load). */
export function seeded(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let s = h >>> 0;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (a, b) => a + Math.floor(next() * (b - a + 1)), pick: (arr) => arr[Math.floor(next() * arr.length)], chance: (p) => next() < p };
}
/** A chance roll on the game's dice. */
export const roll = (p) => rng.chance(clamp(p, 0, 1));

/** Whether the player is at work as an investigator of any kind now. */
export const working = (r = rec()) => !!r?.job && !r.retired;
export const onFederal = (r = rec()) => working(r) && r.family === 'federal';
export const onPolice = (r = rec()) => working(r) && r.family === 'police';
export const isDetective = (r = rec()) => onPolice(r) && !!r.job.detective;

/**
 * Brings older saves up to date. Run on every load: it only adds what is missing, so running it twice
 * changes nothing. A police officer or detective from before this engine keeps their job, title and
 * years; nothing of their past casework is made up: totals from before are recorded as unknown.
 */
export function migrateInvestigations(state) {
  if (!state?.player) return state;
  W(state);
  const p = state.player;
  const job = p.career?.careerId;
  const legacy = ['police', 'detective', 'fbi_agent', 'dea_agent', 'atf_agent'].includes(job);
  if (!p.investigator && legacy) {
    const save = store.state;
    store.state = state;
    try {
      const r = I(p);
      r.legacy = true;
      r.stats.unknownBefore = true;
      r.family = job === 'police' || job === 'detective' ? 'police' : 'federal';
      const rank = job === 'detective'
        ? ['detective', 'detective_sergeant', 'detective_lieutenant'][Math.min(2, p.career.level ?? 0)]
        : job === 'police' ? ['officer', 'sergeant', 'lieutenant', 'chief'][Math.min(3, p.career.level ?? 0)]
          : ['agent', 'senior_agent', 'supervisory', 'sac'][Math.min(3, p.career.level ?? 0)];
      r.stage = job === 'detective' ? 'detective' : r.family === 'federal' ? 'agent' : 'officer';
      // The employer the career engine already holds stays the employer; the agency record wraps it on first use.
      r.job = { agencyId: null, employerId: p.career.employerId ?? null, rank, detective: job === 'detective', specialty: job === 'detective' ? 'general' : null,
        since: state.year - (p.career.yearsInRole ?? 0), rankSince: state.year, legacy: true, agencyKind: r.family === 'federal' ? { fbi_agent: 'fbi', dea_agent: 'dea', atf_agent: 'atf' }[job] : null };
      r.stats.years = p.career.yearsInField ?? p.career.yearsInRole ?? 0;
      r.history.push({ year: state.year, age: p.age, text: 'In the job since before this record was kept.', kind: 'career' });
    } finally { store.state = save; }
  }
  if (p.investigator) p.investigator.v = VERSION;
  state.investigations.v = VERSION;
  return state;
}

const LEADER_RANKS = ['sergeant', 'lieutenant', 'captain', 'deputy_chief', 'chief', 'detective_sergeant', 'detective_lieutenant', 'supervisory', 'asac', 'sac'];
/**
 * Whether one of the two supervises the other at work: the player's supervisor, or someone in the agency the player
 * leads. Romance is never offered across that line (engine/romance.js asks).
 */
export function supervisionBetween(npc, p = player()) {
  const r = rec(p);
  if (!r?.job || !npc) return false;
  if (r.people.supervisorId === npc.id || r.people.ftoId === npc.id && ['field', 'probation'].includes(r.stage)) return true;
  const mine = r.job.agencyId ?? r.job.officeId;
  return LEADER_RANKS.includes(r.job.rank) && !!npc.flags?.inv && npc.flags.inv.agencyId === mine && !LEADER_RANKS.includes(npc.flags.inv.rank);
}

/** A name for anyone a record holds: the player, someone living in the save, or an ancestor in the family's legacy. */
export function nameOfId(id, state = store.state) {
  if (!id) return 'someone';
  if (id === state.player?.id) return 'you';
  const n = state.npcs?.[id];
  if (n) return `${n.firstName} ${n.lastName}`;
  return state.investigations?.legacies?.find((x) => x.id === id)?.name ?? 'someone';
}
/** The family's investigators before this life (public career summaries only). */
export const legacies = (state = store.state) => state.investigations?.legacies ?? [];
