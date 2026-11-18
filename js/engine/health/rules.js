// The clinical rule registry. Every prescription, change and therapy referral
// in the game passes through these checks; nothing in a story event or a UI
// button can go around them. The rules are written from curated guidance
// (NICE, FDA labeling, MedlinePlus), listed in docs/HEALTH.md, and kept small
// enough to read in one sitting.
//
// They are a game's rules, not medical advice: no doses, and nothing here
// should be read as how a real person ought to be treated.
import { store, player, country } from '../../state.js';
import { MED_BY_ID } from '../../data/health/medications.js';
import { THERAPY_BY_ID } from '../../data/health/therapies.js';
import { PROFESSIONS } from '../../data/health/providers.js';
import { CONDITION_BY_ID, nameIn } from '../../data/health/conditions.js';
import { healthOf, isDiagnosed, activeDiagnoses } from './record.js';

const no = (why) => ({ ok: false, why });
const yes = { ok: true, why: '' };

/** The first year a medicine could be prescribed for this condition. */
export function medFrom(med, conditionId) { return med.fromFor?.[conditionId] ?? med.from; }

/** Whether a medicine exists at all, in this year and this country. */
export function medAvailable(med, year = store.state.year, countryId = country().id, conditionId = null) {
  if (year < medFrom(med, conditionId)) return false;
  if (med.countries && !med.countries.includes(countryId)) return false;
  return true;
}

export const therapyAvailable = (t, year = store.state.year) => year >= t.from;
export const professionExists = (id, year = store.state.year) => year >= (PROFESSIONS[id]?.from ?? 9999);

/** Whether this profession may formally diagnose this condition in this year. */
export function mayDiagnose(professionId, conditionId, year = store.state.year) {
  const pro = PROFESSIONS[professionId];
  const def = CONDITION_BY_ID[conditionId];
  if (!pro || !def || !professionExists(professionId, year)) return false;
  if (!nameIn(def, year)) return false; // not yet a recognized condition
  if (def.diagnose.by.includes(professionId)) return true;
  if (pro.only) return pro.only.includes(conditionId);
  return pro.diagnoses.includes(def.group) && !['bpd', 'bipolar_1', 'bipolar_2', 'schizophrenia'].includes(conditionId);
}

const FAMILY_NEEDS_STABILIZER = ['antidepressant'];
const BIPOLAR = ['bipolar_1', 'bipolar_2'];

/**
 * May this prescriber start this medicine for this diagnosed condition, for the player, now?
 * @param {object} o
 * @param {string} o.medId
 * @param {string} o.conditionId    the diagnosis it is for
 * @param {object} o.prescriber     the clinician NPC (flags.clinician.profession)
 * @param {string} [o.replacing]    id of a trial being switched away from (allowed to overlap during the change)
 * @returns {{ok:boolean, why:string}}
 */
export function canPrescribe({ medId, conditionId, prescriber, replacing }, p = player()) {
  const h = healthOf(p);
  const med = MED_BY_ID[medId];
  const def = CONDITION_BY_ID[conditionId];
  if (!med || !def) return no('Unknown medicine or condition.');
  if (!isDiagnosed(conditionId, h)) return no('A medicine is only prescribed for a condition that has been assessed and diagnosed.');
  const pro = prescriber?.flags?.clinician?.profession;
  if (!pro || !med.by.includes(pro) || !(PROFESSIONS[pro]?.prescribes ?? []).includes(med.family)) {
    return no(`${PROFESSIONS[pro]?.name ?? 'This clinician'} cannot prescribe ${med.name.toLowerCase()} here.`);
  }
  if (!med.uses[conditionId]) {
    if (conditionId === 'bpd') return no('No medicine is licensed to treat borderline personality disorder itself. Psychotherapy is the treatment; medicine may be considered for a separate condition that comes with it.');
    return no(`${med.name} is not used for ${def.short}.`);
  }
  if (!medAvailable(med, store.state.year, country().id, conditionId)) {
    return no(store.state.year < medFrom(med, conditionId) ? `${med.name} is not available for this until ${medFrom(med, conditionId)}.` : `${med.name} is not available in this country.`);
  }
  const youth = p.age < med.minAge && !(med.youth ?? []).includes(conditionId);
  if (youth) return no(`${med.name} is not used at ${p.age}.`);
  if (med.youth?.includes(conditionId) && p.age < 18 && pro !== 'psychiatrist') return no('For someone under 18 this needs a specialist psychiatrist.');
  if (med.maxAge && p.age > med.maxAge) return no(`${med.name} is used for children and young people here.`);
  for (const c of med.avoidWith ?? []) if (isDiagnosed(c, h)) return no(`${med.name} is avoided alongside ${CONDITION_BY_ID[c].short}.`);
  // Stimulants and heart problems: a specialist cardiology opinion first (not modeled), so not here.
  if (med.tags.includes('cardio') && p.conditions?.some((c) => c.id === 'heart_disease')) return no('With a heart condition this needs a cardiology opinion first.');

  const active = h.trials.filter((t) => ['active', 'starting', 'adjusted', 'under_review'].includes(t.status) && t.id !== replacing);
  // One medicine of a kind at a time for the same condition; switching overlaps only in a supervised change.
  if (active.some((t) => t.medicationId === medId)) return no(`You are already taking ${med.name.toLowerCase()}.`);
  if (active.some((t) => MED_BY_ID[t.medicationId].family === med.family && med.family === 'antidepressant')) {
    return no('Two antidepressants together is a specialist decision this clinic does not make. A change is done as a supervised switch.');
  }
  if (active.some((t) => MED_BY_ID[t.medicationId].tags.includes('serotonergic')) && med.tags.includes('serotonergic') && med.family !== 'migraine') {
    return no('Combining these needs specialist review because of how they act together.');
  }
  // Bipolar disorder: an antidepressant alone can tip someone into mania or hypomania (NICE CG185).
  if (FAMILY_NEEDS_STABILIZER.includes(med.family) && BIPOLAR.some((b) => isDiagnosed(b, h))) {
    const covered = active.some((t) => ['mood_stabilizer'].includes(MED_BY_ID[t.medicationId].family));
    if (!covered) return no('With bipolar disorder an antidepressant is not started on its own. It would only be considered alongside a mood stabilizer, by a psychiatrist.');
    if (pro !== 'psychiatrist') return no('With bipolar disorder this is a psychiatrist\'s decision.');
  }
  return yes;
}

/** Medicines this prescriber could offer for this diagnosis now, best-supported first. */
export function optionsFor(conditionId, prescriber, p = player(), opts = {}) {
  const order = (m) => (m.uses[conditionId] === 'first' ? 0 : 1);
  return Object.values(MED_BY_ID)
    .filter((m) => m.uses[conditionId] && canPrescribe({ medId: m.id, conditionId, prescriber, replacing: opts.replacing }, p).ok)
    .sort((a, b) => order(a) - order(b));
}

/** May this therapy be offered for this need, by this provider, now? */
export function canOffer(therapyId, conditionId, provider, p = player()) {
  const t = THERAPY_BY_ID[therapyId];
  if (!t) return no('Unknown therapy.');
  if (!therapyAvailable(t)) return no(`${t.name} did not exist yet.`);
  if (p.age < t.minAge || (t.maxAge && p.age > t.maxAge)) return no(`${t.name} is not offered at ${p.age}.`);
  if (conditionId && !t.for.includes(conditionId) && !t.open) return no(`${t.name} is not a treatment for ${CONDITION_BY_ID[conditionId]?.short ?? 'this'}.`);
  if (t.kind === 'peer') return yes;
  const pro = provider?.flags?.clinician?.profession;
  if (!pro || !t.by.includes(pro)) return no(`${t.name} needs a ${t.by.map((b) => PROFESSIONS[b]?.name.toLowerCase()).filter(Boolean).join(' or ')}.`);
  if (t.dbtTrained && !provider.flags.clinician.dbt) return no('Only a DBT-trained therapist can deliver DBT.');
  return yes;
}

/** Diagnoses the player has, for anything that needs one. */
export const diagnosedIds = (p = player()) => activeDiagnoses(healthOf(p)).map((d) => d.conditionId);
