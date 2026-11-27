// One health world. The Health Engine (engine/health) and the medical career (engine/medicine) share it:
//
//   - The same places. The Health Engine's hospital, family practice, public mental health service, private
//     psychiatry clinic and rehabilitation center ARE the hospitals and clinics of the city's health employers
//     (engine/employers.js, engine/medicine/hospitals.js). Where the player works is where people are treated.
//   - The same doctors. A physician who treats someone in the Health Engine is a member of that hospital's staff, in
//     the matching specialty: a colleague of the player's if the player works there, and a doctor the player can be
//     treated by. Doctors who already work there are found before anyone new is made.
//   - The same conditions. A patient the player treats whose diagnosis is one the Health Engine knows (diabetes,
//     depression, asthma, heart disease, cancer and others) has it in their own health record, diagnosed (or not)
//     as the player's work found it.
//   - The same family. A relative of a physician who falls ill is the Health Engine's patient; the physician's part
//     is to help them to the right colleague, not to become their doctor.
import { player } from '../../state.js';
import { CONDITION_BY_ID, nameIn } from '../../data/health/conditions.js';
import { employer } from '../employers.js';
import { staffOf } from '../workplace.js';
import { hospitalsIn } from './hospitals.js';
import { med, year, grow } from './core.js';

/** Which of the city's health employers each Health Engine facility is. */
const FACILITY_KINDS = {
  hospital: ['regional', 'academic', 'government', 'community'],
  primary: ['public_health', 'clinic', 'rural'],
  mental: ['public_health'],
  psychiatry: ['clinic', 'public_health'],
  rehab: ['bone', 'regional', 'academic', 'government'],
};

/** Links a Health Engine facility to the employer it is (made once, kept). A new facility takes the employer's name. */
export function linkFacility(f, def, fresh = false) {
  if (!f || f.employerId || !FACILITY_KINDS[def?.id]) return f;
  const kinds = FACILITY_KINDS[def.id];
  const here = hospitalsIn(f.countryId, f.city);
  const pick = kinds.map((k) => here.filter(({ h }) => h.kind === k).sort((a, b) => b.h.resources - a.h.resources)[0]).find(Boolean);
  if (!pick) return f;
  f.employerId = pick.e.id;
  if (fresh) f.name = pick.e.name;
  return f;
}

/** The medical specialty a Health Engine physician profession is. */
export const PROFESSION_SPECIALTY = {
  gp: 'family', doctor: 'internal', psychiatrist: 'psychiatry', pediatrician: 'pediatrics', neurologist: 'neurology',
  cardiologist: 'cardiology', oncologist: 'heme_onc', ophthalmologist: 'ophthalmology', ent: 'ent', obgyn: 'obgyn', urologist: 'urology',
};
const PHYSICIAN_CAREERS = ['doctor', 'surgery', 'psychiatry'];

/**
 * A physician already on the employer's staff, in the specialty this profession is (never the player). They take on
 * the Health Engine's clinician record, so the same person is a colleague and a treating doctor.
 */
export function staffPhysician(f, profession, exclude = []) {
  const spec = PROFESSION_SPECIALTY[profession];
  const e = f?.employerId ? employer(f.employerId) : null;
  if (!spec || !e) return null;
  const fit = staffOf(e).find((n) => n.alive && !exclude.includes(n.id) && PHYSICIAN_CAREERS.includes(n.life?.job?.careerId) && n.flags.medSpecialty === spec
    && !n.flags.clinician?.retired && (!n.flags.clinician || n.flags.clinician.facilityId === f.id));
  return fit ?? null;
}

/** Makes a Health Engine clinician a member of the employer's staff, in their specialty. */
export function employClinician(npc, f, profession) {
  const spec = PROFESSION_SPECIALTY[profession];
  const e = f?.employerId ? employer(f.employerId) : null;
  if (!spec || !e || !npc) return npc;
  npc.flags.medSpecialty = spec;
  npc.flags.workedWith = e.name;
  npc.life ??= { edu: { stage: 'done', gpa: 3.5, majorId: 'biology', trade: null, degrees: ['university', 'medical'], yearsLeft: 0 }, job: null, savings: 0, aspiration: null,
    partnerId: null, together: 0, married: false, kids: 0, history: [] };
  npc.life.job = { careerId: spec === 'psychiatry' ? 'psychiatry' : 'doctor', level: 1, title: npc.occupation ?? 'Physician', salary: 0, years: npc.flags.clinician?.years ?? 5, employerId: e.id };
  if (!e.staff.includes(npc.id)) e.staff.push(npc.id);
  return npc;
}

/** Diagnoses in the medical cases that are conditions the Health Engine knows. */
export const CASE_TO_HEALTH = {
  hypertension: 'hypertension', t2dm: 'type2_diabetes', asthma: 'asthma', migraine: 'migraine', depression: 'mdd', panic: 'panic',
  epilepsy: 'epilepsy', trauma_reaction: 'ptsd', hearing: 'hearing_loss', chronic_back: 'back_pain', sciatica: 'back_pain', radicular: 'back_pain',
  hf: 'heart_disease', angina: 'heart_disease', mi: 'heart_disease', multivessel: 'heart_disease', three_vessel: 'heart_disease',
  melanoma: 'cancer', lymphoma: 'cancer', early_cancer: 'cancer', larynx_cancer: 'cancer', throat_cancer: 'cancer', testis_cancer: 'cancer',
  bladder_tumor: 'cancer', sarcoma: 'cancer', resectable: 'cancer', localized: 'cancer', early_hormone: 'cancer', widespread: 'cancer',
};

/**
 * After a case: the patient's own health record (engine/health/story.js npcHealth) has the condition, diagnosed if the
 * physician found it. Nothing is added for a diagnosis the Health Engine does not model.
 */
export function recordPatientCondition(patient, fx, c, npcHealth) {
  const id = CASE_TO_HEALTH[fx?.diagnosis];
  if (!patient || !id || !CONDITION_BY_ID[id]) return null;
  const h = npcHealth(patient);
  if (!h) return null;
  let cond = h.conds.find((x) => x.id === id);
  if (!cond) { cond = { id, age: patient.age, diagnosed: false, shared: false }; h.conds.push(cond); }
  if (c.dx === fx.diagnosis && nameIn(CONDITION_BY_ID[id], year())) { cond.diagnosed = true; cond.diagnosedBy = 'player'; cond.diagnosedYear = year(); }
  return cond;
}

/**
 * A relative of a physician has been diagnosed: the physician's choice (data/events/stories/medicine.js med_family_patient).
 * Helping them to a colleague begins real care in the Health Engine; treating them yourself is a boundary crossed.
 */
export function familyPatientChoice(how, n, startCare, condId = null) {
  const m = med();
  if (!n || !m) return '';
  const h = n.health;
  const cond = h?.conds?.find((x) => x.id === condId && x.diagnosed) ?? h?.conds?.find((x) => x.diagnosed && x.age <= n.age && !x.care);
  // Care through the Health Engine: what it would offer anyone; where it offers nothing specific, a colleague's follow-up.
  const care = (cond) => { if (cond && !startCare(n, cond)) cond.care = { v: 2, since: year(), therapy: null, meds: [], stays: [], history: [{ year: year(), text: 'Seen and followed up by a colleague.' }], details: false }; };
  if (how === 'colleague') {
    care(cond);
    n.meters.relationship = Math.min(100, n.meters.relationship + 6);
    grow('professionalism', 1, m);
    return `You make two phone calls and get ${n.firstName} an appointment with the right colleague. You stay their ${n.role === 'child' ? 'parent' : 'family'}, not their doctor.`;
  }
  if (how === 'self') {
    care(cond);
    grow('integrity', -2, m);
    return `You take it on yourself. It feels like love. It is also the thing your training warned against: too close to be objective, and too close to be told everything.`;
  }
  n.meters.relationship = Math.min(100, n.meters.relationship + 4);
  return `You go with ${n.firstName} to appointments, hold the coat, and ask the questions they forget to. Somebody else is the doctor.`;
}

/** Queues the scene when a close relative of a physician is newly diagnosed (called from the Health Engine's year). */
export function maybeFamilyPatient(n, cond, storyBeat) {
  const m = med();
  const p = player();
  if (!m || !(m.job || m.training || m.clinicIds?.length) || !cond?.diagnosed) return;
  if ((m.scenes.familyPatient ?? -99) >= year() - 3) return;
  m.scenes.familyPatient = year();
  storyBeat('med_family_patient', { who: n.id, words: { condition: nameIn(CONDITION_BY_ID[cond.id], year()) ?? 'an illness', condId: cond.id } }, { source: 'medicine', must: true });
  return p;
}

/**
 * The doctors behind the everyday doctor's visit (engine/medical.js): the family doctor at the practice the Health
 * Engine uses, and for cosmetic surgery a plastic surgeon on a city hospital's staff (a renowned one at the best
 * equipped). Never the player themself. Returns null where the city has no such doctor yet (or in an era before them).
 */
export function familyDoctor(facilitiesHere, clinicianAt, p = player()) {
  const f = facilitiesHere(p).find((x) => x.defId === 'primary');
  const doc = f ? clinicianAt(f, 'gp') : null;
  return doc && doc.id !== p.id ? { npc: doc, place: f.name } : null;
}
export function plasticSurgeon(tier, deptHead, p = player()) {
  if (tier === 'budget') return null;
  const all = hospitalsIn(p.countryId, p.city).filter(({ h }) => !['clinic', 'public_health', 'rural'].includes(h.kind)).sort((a, b) => b.h.resources - a.h.resources);
  const here = all.filter(({ h }) => h.depts.includes('plastic'));
  // A city without a plastic surgery department still has a plastic surgeon at its best-equipped hospital.
  if (!here.length && all.length) { all[0].h.depts.push('plastic'); here.push(all[0]); }
  const pick = tier === 'renowned' ? here[0] : here[here.length - 1];
  if (!pick) return null;
  const n = deptHead(pick.h, 'plastic');
  return n && n.id !== p.id ? { npc: n, place: pick.e.name } : null;
}
