// The medical career's records: what the world keeps (hospitals, programs, patients, cases) and
// what a physician keeps (training, credentials, skills, history). Everything else in
// engine/medicine reads and writes through here.
//
//   state.medicine = {
//     v, seq,                        version and a counter for ids that are the same on every load
//     hospitals: { [employerId]: Hospital },   the medical side of a hospital employer (engine/employers.js)
//     programs:  { [id]: Program },  residency and fellowship programs, at hospitals
//     schools:   { [id]: School },   medical and podiatric schools, by country
//     patients:  { [npcId]: { id, caseIds[], firstYear, lastYear, household[] } }   a doctor's patient list (private)
//     cases:     { [id]: Case },     patient cases (private, see engine/medicine/cases.js)
//     episodes:  { [id]: Episode },  one emergency seen by several teams
//   }
//   player.medicine: the physician's own record (see blank() below). Created when it is first needed.
//
// Privacy: patients and their cases are a doctor's confidential files. They never reach the life
// story, the family archive or other people; what is public is the career (schools, training,
// hospitals, posts, public honors), recorded with recordEvent(privacy 'public').
import { rng } from '../../rng.js';
import { clamp } from '../../util.js';
import { store, player, log, milestone } from '../../state.js';
import { recordEvent } from '../chronicle.js';
import { SKILLS, SPECIALTY_BY_ID, qualifiesAs } from '../../data/medicine.js';

export const VERSION = 1;
export const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
export const year = () => store.state.year;

/** The world's medical records. */
export function W(state = store.state) {
  const m = (state.medicine ??= {});
  m.v ??= VERSION;
  m.seq ??= 0;
  for (const k of ['hospitals', 'programs', 'schools', 'patients', 'cases', 'episodes']) m[k] ??= {};
  return m;
}
export const nextId = (prefix) => `${prefix}_${++W().seq}`;

/** A blank physician record. */
function blank() {
  return {
    v: VERSION, route: null, stage: 'none',
    premed: { service: 0, exposure: 0, research: 0, letters: 0, exam: 0, done: {} },
    school: null, match: null, training: null, completed: [], license: { status: 'none' }, boards: [], focus: null,
    job: null, skills: Object.fromEntries(Object.keys(SKILLS).map((k) => [k, 30])),
    experience: { cases: 0, procedures: 0, assisted: 0, years: 0, bySpecialty: {} }, reputation: 40,
    caseIds: [], yearCases: { year: null, n: 0, done: 0 }, history: [], clinicIds: [],
    people: { mentorId: null, supervisorIds: [], colleagueIds: [], rivalIds: [], friendIds: [] },
    scenes: {}, drama: 'balanced', discipline: [], acted: {},
  };
}

/** The physician's record, made if it is not there. */
export function M(p = player()) {
  p.medicine ??= blank();
  const m = p.medicine;
  const fresh = blank();
  for (const [k, v] of Object.entries(fresh)) if (m[k] === undefined) m[k] = v;
  for (const k of Object.keys(SKILLS)) m.skills[k] ??= 30;
  return m;
}
/** The record if there is one, without making it. */
export const med = (p = player()) => p.medicine ?? null;

/** Once-a-year actions: true the first time this year, false after. */
export function once(key, m = M()) {
  if (m.acted.year !== year()) m.acted = { year: year() };
  if (m.acted[key]) return false;
  m.acted[key] = true;
  return true;
}
export const doneThisYear = (key, m = med()) => !!m && m.acted.year === year() && !!m.acted[key];

/** Moves a skill, within 0-100. */
export function grow(skill, by, m = M()) { m.skills[skill] = clamp(Math.round((m.skills[skill] + by) * 10) / 10); }

/**
 * Reputation follows how a doctor practices: judgment, communication, teamwork, professionalism and
 * integrity, with a little for research and leadership. Never patient survival counts.
 */
export function reputationOf(m = med()) {
  if (!m) return 0;
  const s = m.skills;
  const base = s.reasoning * 0.24 + s.communication * 0.18 + s.teamwork * 0.14 + s.professionalism * 0.14 + s.integrity * 0.12
    + s.management * 0.08 + s.research * 0.05 + s.leadership * 0.05;
  const marks = m.discipline.filter((d) => d.year > year() - 10).length * 8;
  return clamp(Math.round(base - marks));
}

/** A line in the physician's public career history (and the life story). */
export function note(text, kind = 'career', o = {}) {
  const m = M();
  const p = player();
  m.history.push({ year: year(), age: p.age, text, kind });
  if (o.log !== false) log(text, 'system', o.tone ?? 'good');
  if (o.milestone) milestone(o.milestone, 'career');
  if (o.key) recordEvent({ key: `med:${p.id ?? p.firstName}:${o.key}`, kind: 'medical_career', text: o.milestone ?? text, privacy: 'public', significance: o.significance ?? 1 });
}

/** The specialties a physician has completed training in (what they are qualified as). */
export const qualified = (m = med()) => [...(m?.completed ?? []).map((c) => qualifiesAs(c.specialtyId)), ...(m?.legacy && m.declared && m.stage === 'practice' ? [m.declared] : [])];
/** The specialty a physician practices now: the last one completed, or the one in training. */
export function currentSpecialty(m = med()) {
  if (!m) return null;
  if (m.training) return m.training.specialtyId;
  const done = m.completed;
  return done.length ? qualifiesAs(done[done.length - 1].specialtyId) : m.declared ?? null;
}
export const specialtyName = (id) => SPECIALTY_BY_ID[id]?.name ?? 'Medicine';

/** Stable pick from a list by a key, without touching the game's dice (for things made the same on every load). */
export function seeded(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let s = h >>> 0;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (a, b) => a + Math.floor(next() * (b - a + 1)), pick: (arr) => arr[Math.floor(next() * arr.length)] };
}

/** A chance roll on the game's dice. */
export const roll = (p) => rng.chance(clamp(p, 0, 1));

/**
 * Brings older saves up to date. Run on every load: it only adds what is missing, so running it
 * twice changes nothing. A doctor from before this engine keeps their job and their years; nothing
 * of their training is made up: their record notes the career began before records were kept, and
 * from now on what they do is tracked.
 */
export function migrateMedicine(state) {
  if (!state?.player) return state;
  W(state);
  const p = state.player;
  const job = p.career?.careerId;
  const degree = (p.education?.degrees ?? []).find((d) => d.type === 'medical' || d.type === 'podiatric');
  const working = ['doctor', 'surgery', 'psychiatry', 'podiatrist'].includes(job);
  if (!p.medicine && (working || degree)) {
    const save = store.state;
    store.state = state;
    try {
      const m = M(p);
      m.legacy = true;
      m.route = degree?.type === 'podiatric' || job === 'podiatrist' ? 'dpm' : 'md';
      m.school = { startYear: null, countryId: degree?.countryId ?? p.countryId, name: degree?.school ?? 'medical school', route: m.route, year: 4, rotations: [], exams: {}, interest: {},
        apply: [], graduated: true, elective: null };
      const licensed = (p.flags?.licenses ?? []).includes(m.route === 'dpm' ? 'podiatric' : 'medical');
      if (licensed || working) m.license = { status: 'full', name: 'a license held before this record was kept', since: null, countryId: p.countryId };
      if (working) {
        // A doctor already at work keeps the job and the level. Their specialty is not invented: surgery
        // and psychiatry say what they are; a physician's is left for the player to name once.
        m.stage = (p.career.level ?? 0) >= 1 ? 'practice' : 'residency';
        if (job === 'surgery') m.declared = 'gensurg';
        else if (job === 'psychiatry') m.declared = 'psychiatry';
        else if (job === 'podiatrist') m.declared = 'podiatry';
        if ((p.career.level ?? 0) >= 1) {
          m.job = { specialtyId: m.declared ?? null, hospitalId: p.career.employerId ?? null, rank: ['attending', 'attending', 'senior', 'chief'][Math.min(3, p.career.level)],
            since: state.year, rankSince: state.year, legacy: true };
        }
        m.history.push({ year: state.year, age: p.age, text: 'Practicing since before this record was kept.', kind: 'career' });
      } else {
        // A graduate with another life: nothing is applied for unless they choose to (My Medical Career).
        m.stage = 'graduate';
        m.reapply = false;
      }
    } finally { store.state = save; }
  }
  if (p.medicine) p.medicine.v = VERSION;
  state.medicine.v = VERSION;
  return state;
}

// ---------- Across generations ----------

/**
 * What the family remembers of a physician's career (the Family Archive): the training, the
 * hospitals, the highest post, the practices. Nothing about any patient.
 */
export function physicianSummary(p) {
  const m = p?.medicine;
  if (!m || (!m.completed.length && !m.school?.graduated && !m.legacy)) return null;
  const jobs = (p.career?.history ?? []).filter((h) => ['doctor', 'surgery', 'psychiatry', 'podiatrist'].includes(h.careerId));
  const hospitals = [...new Set([...m.completed.map((c) => c.hospital), ...jobs.map((h) => h.employer)].filter(Boolean))];
  const hospitalIds = [...new Set([...m.completed.map((c) => c.hospitalId), ...jobs.map((h) => h.employerId), m.job?.hospitalId].filter(Boolean))];
  const ranks = ['attending', 'senior', 'director', 'chief', 'chair', 'cmo'];
  return {
    route: m.route, school: m.school?.name ?? null,
    trained: m.completed.map((c) => ({ specialtyId: c.specialtyId, name: specialtyName(c.specialtyId), from: c.from, to: c.to, hospital: c.hospital ?? null, chief: !!c.chief })),
    as: qualified(m).map((id) => SPECIALTY_BY_ID[id]?.doctor).filter(Boolean),
    boards: m.boards.filter((b) => b.passed).map((b) => specialtyName(b.specialtyId)),
    years: m.experience.years, patients: m.experience.cases, hospitals, hospitalIds,
    topRank: m.topRank ?? (m.job ? m.job.rank : null), topTitle: m.topTitle ?? (m.job ? p.career?.title : null),
    practices: (p.businesses ?? []).filter((b) => b.medical).map((b) => b.name), legacy: !!m.legacy,
    rankOrder: ranks,
  };
}

const MEDICAL_JOB = /physician|surgeon|doctor|psychiatrist|podiatrist|resident|pediatrician|cardiologist|neurologist|dermatologist|radiologist|anesthesiologist|obstetrician|internist/i;

/**
 * Family in medicine: a living parent or grandparent who practices (or practiced), or an ancestor
 * whose medical career is in the Family Archive. The nearest one, for scenes and premed help.
 */
export function medicalFamily(p = player(), state = store.state) {
  const kin = (p.npcIds ?? []).map((id) => state.npcs[id]).filter((n) => n?.alive && ['parent', 'grandparent'].includes(n.role)
    && (['doctor', 'surgery', 'psychiatry', 'podiatrist'].includes(n.life?.job?.careerId) || MEDICAL_JOB.test(n.occupation ?? '')));
  const near = kin.sort((a, b) => (a.role === 'parent' ? 0 : 1) - (b.role === 'parent' ? 0 : 1))[0];
  if (near) return { name: near.firstName, npcId: near.id, role: near.role, alive: near.alive, what: near.occupation || 'a doctor', archived: false };
  const anc = Object.values(state.archive?.people ?? {}).filter((a) => a.medicine).sort((a, b) => (b.died ?? 0) - (a.died ?? 0))[0];
  if (anc) return { name: anc.firstName, npcId: null, role: 'ancestor', alive: false, what: anc.medicine.as?.[0] ?? 'a doctor', archived: true, archiveId: anc.id };
  return null;
}

/** An ancestor in the Family Archive who worked at this hospital, if any. */
export function ancestorAt(hospitalId, state = store.state) {
  return Object.values(state.archive?.people ?? {}).find((a) => a.medicine?.hospitalIds?.includes(hospitalId)) ?? null;
}
