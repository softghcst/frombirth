// The health record: one per character, kept on the Character itself
// (player.health). It never copies who the person is; it refers to people by id.
//
// Underlying conditions and diagnoses are kept apart on purpose:
//   conditions  what is actually going on in this person (the simulation's truth),
//               including things nobody has recognized yet
//   diagnoses   what a clinician has concluded, which can be uncertain, revised,
//               or wrong, and which care plans are written against
import { player, store } from '../../state.js';
import { CONDITION_BY_ID, LEGACY_IDS } from '../../data/health/conditions.js';
import { WEEKS, now } from './util.js';

export const SKILL_KEYS = ['mindfulness', 'distress', 'regulation', 'interpersonal', 'coping', 'organization', 'communication', 'independence', 'study'];

/** A blank record. */
export function blankHealth() {
  return {
    v: 2, week: 0,
    conditions: [], diagnoses: [], assessments: [], appointments: [], plans: [], therapies: [], trials: [], proposals: [],
    skills: Object.fromEntries(SKILL_KEYS.map((k) => [k, 0])),
    wellbeing: { stress: 30, sleep: 70, energy: 70, pain: 5 },
    supports: { needs: {}, devices: [], accommodations: [], home: {} },
    lifeNotes: [], ledger: [], careTeam: [], genetic: { tested: {} },
    settings: { follow: false, sensitive: 'full' },
  };
}

/** The player's record, created (or brought up to date) on first use. */
export function healthOf(p = player()) {
  if (!p.health) p.health = blankHealth();
  return p.health;
}

/** Statuses as the rest of the game sees them (see the HealthConditionRecord type). */
export function statusOf(rec) {
  if (rec.status === 'resolved' || rec.status === 'historical') return rec.status;
  if (rec.status === 'in_remission') return 'in_remission';
  const d = diagnosisFor(rec);
  if (d) return 'diagnosed';
  if (rec.dx === 'under_assessment') return 'under_assessment';
  if (rec.dx === 'suspected') return 'suspected';
  return 'active';
}

export const diagnosisFor = (rec, h = healthOf()) => h.diagnoses.find((d) => d.underlyingId === rec.id && d.status === 'active');
export const activeDiagnoses = (h = healthOf()) => h.diagnoses.filter((d) => d.status === 'active');
export const presentConditions = (h = healthOf()) => h.conditions.filter((c) => c.status === 'active' || c.status === 'in_remission');
export const hasCondition = (id, h = healthOf()) => presentConditions(h).some((c) => c.conditionId === id);
export const isDiagnosed = (id, h = healthOf()) => activeDiagnoses(h).some((d) => d.conditionId === id);

/**
 * Starts a condition in this person. It is not recognized by anyone yet:
 * that takes an assessment.
 * @param {object} [o] features: which of the condition's experiences this person has; severity 0–100
 */
export function startCondition(conditionId, o = {}, p = player()) {
  const h = healthOf(p);
  const def = CONDITION_BY_ID[conditionId];
  if (!def) return null;
  const existing = h.conditions.find((c) => c.conditionId === conditionId && c.status !== 'resolved' && c.status !== 'historical');
  if (existing) return existing;
  const rec = {
    id: `cond_${conditionId}_${p.id.slice(-5)}_${h.conditions.length}`,
    conditionId, status: 'active', dx: 'none',
    onsetWk: o.onsetWk ?? now(p), onsetAge: o.onsetAge ?? p.age,
    // Present from birth, but only noticed in daily life from this age on.
    showsAge: o.showsAge ?? null,
    features: o.features ?? pickFeatures(def, p.id),
    severity: Math.round(o.severity ?? 40),
    burden: Math.round(o.severity ?? 40),
    calm: 0, episode: null,
    visibility: 'private', sharedWithFamily: false, disclosedTo: [],
    source: o.source ?? 'simulated',
    history: [{ wk: o.onsetWk ?? now(p), text: o.note ?? 'Began.' }],
  };
  h.conditions.push(rec);
  return rec;
}

/** Each person with a condition has their own mix of its experiences, never necessarily all of them. */
function pickFeatures(def, seed) {
  const f = def.features ?? [];
  if (f.length <= 2) return [...f];
  let x = 0;
  for (const ch of `${seed}${def.id}`) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  const keep = f.filter((_, i) => i === 0 || ((x >>> i) & 1) || ((x >>> (i + 7)) & 1));
  return keep.length >= 2 ? keep : f.slice(0, 2);
}

export function note(rec, text) {
  rec.history.push({ wk: now(), text });
  if (rec.history.length > 60) rec.history.splice(1, rec.history.length - 60);
}

/** A line in the health record's own life notes: what therapy can later talk about. Only real events go here. */
export function lifeNote(topic, text, p = player()) {
  const h = healthOf(p);
  h.lifeNotes.push({ wk: now(p), topic, text, discussed: false });
  if (h.lifeNotes.length > 40) h.lifeNotes.shift();
}

/** Week of the year from 0, for tests and the UI. */
export const weekOfYear = () => healthOf().week ?? 0;

// ---------- Older saves ----------

/**
 * Brings a save from before the health record up to date. Nothing is invented:
 * a legacy "depression" or "anxiety" becomes a recorded condition with a
 * diagnosis marked as migrated, with no provider, no assessment and no therapy
 * history; a legacy one-off therapy year leaves no therapy record behind.
 * Dyslexia no longer costs intellect: the points it took are given back once.
 */
export function migrateHealth(state) {
  const p = state.player;
  if (p.health && p.health.v >= 2) return;
  const keep = store.state;
  store.state = state;
  try {
    const first = !p.health;
    const h = healthOf(p);
    absorbLegacy(p);
    if (first && (p.birth ?? []).includes('dyslexia') && !p.flags.dyslexiaRestored) {
      p.stats.intellect = Math.min(100, p.stats.intellect + 6);
      p.flags.dyslexiaRestored = true;
      startCondition('dyslexia', { onsetAge: 0, onsetWk: p.birthYear * WEEKS, showsAge: 6, severity: 35, source: 'migrated', note: 'Recorded at birth in an older save.' }, p);
    }
    h.v = 2;
  } finally { store.state = keep; }
}

/**
 * Moves conditions from the older yearly illness list into the health record:
 * each becomes a recorded condition with a diagnosis marked as carried over (no
 * clinician, assessment or treatment history is invented). One that was being
 * treated keeps the benefit of that treatment until a care plan replaces it.
 */
export function absorbLegacy(p) {
  const h = healthOf(p);
  for (const c of [...(p.conditions ?? [])]) {
    const id = LEGACY_IDS[c.id];
    if (!id) continue;
    const rec = startCondition(id, { onsetAge: c.sinceAge, onsetWk: (p.birthYear + c.sinceAge) * WEEKS, severity: c.severity ?? 35, source: 'migrated',
      note: 'Recorded before this save had a health record.' }, p);
    if (c.treated) rec.legacyManaged = true;
    if (!h.diagnoses.some((d) => d.underlyingId === rec.id)) {
      h.diagnoses.push({ id: `dx_m_${rec.id}`, conditionId: id, underlyingId: rec.id, status: 'active', wk: rec.onsetWk, providerId: null,
        name: CONDITION_BY_ID[id].name, certainty: 'recorded', migrated: true, history: [{ wk: rec.onsetWk, text: `Carried over from before the health record.${c.treated ? ' It was being treated; the details were not kept.' : ''}` }] });
    }
    rec.dx = 'diagnosed';
    p.conditions = p.conditions.filter((x) => x !== c);
  }
}
