// Checks that the Health Engine and the medical career are one health world (engine/medicine/healthLink.js):
// the same hospitals and clinics, the same doctors, patients' conditions in their own health records, a physician's
// relative who falls ill, and a physician treated where they work. Run with: node tests/medicine-health.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { makeNpc } from '../js/engine/npcFactory.js';
import { CASE_BY_ID } from '../js/data/medicineCases.js';
import * as core from '../js/engine/medicine/core.js';
import * as train from '../js/engine/medicine/training.js';
import * as cases from '../js/engine/medicine/cases.js';
import * as drama from '../js/engine/medicine/drama.js';
import { hospitalsIn } from '../js/engine/medicine/hospitals.js';
import { maybeFamilyPatient } from '../js/engine/medicine/healthLink.js';
import { storyBeat, yearSteps } from '../js/engine/storyDirector.js';
import { facilitiesHere, clinicianAt } from '../js/engine/health/care.js';
import { admit } from '../js/engine/health/hospital.js';
import { npcHealth } from '../js/engine/health/story.js';
import { employer } from '../js/engine/employers.js';
import { staffOf } from '../js/engine/workplace.js';

rng.seed(2468);
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };
store.state = createLife({ countryId: 'us' });
const p = store.state.player;
p.age = 40; p.finance.cash = 1e6;
p.education.degrees.push({ type: 'university', majorId: 'biology', gpa: 3.8, age: 22 }, { type: 'medical', gpa: 3.6, age: 26 });

// The same places.
const fs = facilitiesHere(p);
const hosp = fs.find((f) => f.defId === 'hospital');
const prim = fs.find((f) => f.defId === 'primary');
const city = hospitalsIn(p.countryId, p.city).map(({ e }) => e.id);
check(hosp?.employerId && city.includes(hosp.employerId) && hosp.name === employer(hosp.employerId).name, `the Health Engine's hospital is one of the city's hospitals (${hosp?.name})`);
check(prim?.employerId && city.includes(prim.employerId), `the family practice is one of the city's health employers (${prim?.name})`);

// The same doctors: the player works there; the hospital's internist is a colleague, and is the one who treats people.
const m = core.M(p);
for (const k of Object.keys(m.skills)) m.skills[k] = 80;
m.completed.push({ specialtyId: 'family', kind: 'residency', from: 2000, to: 2003 });
m.license = { status: 'full', countryId: 'us' };
train.startPost('family', hosp.employerId, 'attending');
const doc = clinicianAt(hosp, 'doctor');
const e = employer(hosp.employerId);
check(doc && doc.life?.job?.employerId === e.id && staffOf(e).includes(doc) && doc.flags.medSpecialty === 'internal', 'the hospital doctor who treats people is on its staff, an internist');
check(clinicianAt(hosp, 'doctor') === doc, 'and stays the same doctor');
const gp = clinicianAt(prim, 'gp');
check(gp && gp.life?.job?.employerId === prim.employerId && gp.flags.medSpecialty === 'family', 'the family practice\'s doctor works there, a family physician');
check(gp?.id !== p.id && doc?.id !== p.id, 'the player is never their own doctor');

// The same conditions: a patient with type 2 diabetes, diagnosed by the player, has it in their health record.
const fx = Object.values(CASE_BY_ID).find((x) => x.diagnosis === 't2dm');
const pt = makeNpc({ role: 'patient', countryId: 'us', age: 55 }); store.state.npcs[pt.id] = pt;
core.W().patients[pt.id] = { id: pt.id, caseIds: [], bornYear: store.state.year - 55 };
core.W().cases.c_dm = { id: 'c_dm', fixtureId: fx.id, patientId: pt.id, specialtyId: 'family', role: 'physician', year: store.state.year, status: 'open', tests: [], dx: null, plan: null, triage: null, decision: null, outcome: null, notes: [] };
m.caseIds.push('c_dm');
cases.setDiagnosis('c_dm', fx.diagnosis);
cases.choosePlan('c_dm', fx.plans.find((x) => x.quality === 'best' && !x.maxYear).id);
for (let i = 0; i < 6 && core.W().cases.c_dm.status === 'or'; i++) cases.orStep('c_dm', cases.caseView('c_dm').or.step.options[0].id);
if (core.W().cases.c_dm.status === 'deciding') cases.decide('c_dm', fx.decision.options[0].id);
const rec = npcHealth(pt).conds.find((x) => x.id === 'type2_diabetes');
check(rec?.diagnosed && rec.diagnosedBy === 'player', 'the patient\'s own health record has the diagnosis the player made');

// The same family: a parent of the physician is diagnosed; the scene offers the right colleague.
const mom = makeNpc({ role: 'parent', countryId: 'us', age: 70, relationship: 80 }); store.state.npcs[mom.id] = mom; p.npcIds.push(mom.id);
const mh = npcHealth(mom);
const cond = { id: 'hypertension', age: mom.age, diagnosed: true, shared: true };
mh.conds.push(cond);
store.state.pendingEvents = [];
yearSteps.on = true;
maybeFamilyPatient(mom, cond, storyBeat);
yearSteps.on = false;
check(store.state.pendingEvents.some((x) => x.id === 'med_family_patient' && x.story?.must), 'a physician\'s parent, newly diagnosed, brings the scene (always told)');
const integrity = m.skills.integrity;
drama.medicineChoice('familyPatient:colleague', { who: mom.id, words: { condId: 'hypertension' } });
check(cond.care && m.skills.integrity === integrity, 'helping them to the right colleague starts their care in the Health Engine');
drama.medicineChoice('familyPatient:self', { who: mom.id, words: { condId: 'hypertension' } });
check(m.skills.integrity < integrity, 'treating family yourself is a boundary crossed');

// The same hospital, as a patient.
store.state.journal = store.state.journal ?? [];
const a = admit('heart', {}, p);
check(a && hosp.id === a.facilityId, 'a physician admitted in their city goes to the hospital where they work');
check(store.state.journal.some((j) => /patient where you work/.test(j.text)), 'and is looked after by colleagues');

// The everyday doctor's visit and cosmetic surgery: the same doctors.
const { surgeonOptions, surgeryOptions } = await import('../js/engine/medical.js');
const proc = surgeryOptions()[0];
if (proc) {
  const opts = surgeonOptions(proc.id);
  const good = opts.find((o) => o.id === 'renowned');
  const surgeon = store.state.npcs[good?.surgeonNpcId];
  check(!!good?.surgeonNpcId && (/plastic/.test(surgeon?.flags.medSpecialty ?? '') && surgeon.life?.job?.employerId), `a renowned surgeon is a plastic surgeon on a hospital's staff (${good?.name})`);
}
if (problems.length) { console.log(`PROBLEMS (${problems.length}):\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log('One health world: the same hospitals, doctors, conditions and family.');
