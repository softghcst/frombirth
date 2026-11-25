// Checks the medical career engine: the specialty registry and case fixtures, premedical years,
// medical school (rotations, exams), the Match, residency by PGY year, the license, fellowships
// after residency only, hospitals and posts, patient cases and the operating room, privileges and
// supervision, private practice, hospital drama that never touches outcomes, privacy of patients,
// 3/6/12-month Age Ups, save and reload without duplication, and migration of older saves.
// Run with: node tests/medicine.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { advanceTurn } from '../js/engine/turns.js';
import { CAREER_BY_ID } from '../js/data/careers.js';
import { SPECIALTIES, SPECIALTY_BY_ID, PROCEDURE_BY_ID, TEST_BY_ID, DEPARTMENTS, PRACTICE_TYPES, PRIMARY } from '../js/data/medicine.js';
import { CASES, CASE_BY_ID } from '../js/data/medicineCases.js';
import { EVENT_BY_ID } from '../js/data/events/index.js';
import * as edu from '../js/engine/education.js';
import * as work from '../js/engine/worklife.js';
import * as career from '../js/engine/career.js';
import * as core from '../js/engine/medicine/core.js';
import * as train from '../js/engine/medicine/training.js';
import * as cases from '../js/engine/medicine/cases.js';
import * as ladder from '../js/engine/medicine/ladder.js';
import * as practice from '../js/engine/medicine/practice.js';
import * as drama from '../js/engine/medicine/drama.js';
import * as research from '../js/engine/medicine/research.js';
import { hospitalsIn, trainingSites } from '../js/engine/medicine/hospitals.js';
import { events } from '../js/engine/chronicle.js';
import { COUNTRIES } from '../js/data/countries.js';
import * as biz from '../js/engine/business.js';
import * as market from '../js/engine/employers.js';
import { makeNpc } from '../js/engine/npcFactory.js';
import { die } from '../js/engine/death.js';
import { continueAs } from '../js/engine/legacy.js';

rng.seed(20261125);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (id = 'us', age = 22) => {
  do { store.state = createLife({ countryId: id }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age; p.flags.livesWithParents = false; p.education.enrolled = false; p.education.stage = 'none';
  p.legal.record = []; p.stats.health = 90; p.stats.intellect = 88; p.stats.charm = 70; p.hidden.discipline = 80; p.finance.cash = 2000000;
  if (!p.education.degrees.some((d) => d.type === 'high')) p.education.degrees.push({ type: 'high', gpa: 3.8, age: 18 });
  p.education.degrees.push({ type: 'university', majorId: 'biology', gpa: 3.9, age: 22 });
  work.career();
  return p;
};
const year = () => { advanceYear(); store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 85); p.alive = true; };
const strong = (m) => { for (const k of Object.keys(m.skills)) m.skills[k] = Math.max(m.skills[k], 80); };
/** Works a case the way a careful physician would: the useful tests, the right diagnosis, the best plan. */
function workCase(c, quality = 'best') {
  const fx = CASE_BY_ID[c.fixtureId];
  const v = cases.caseView(c.id);
  if (fx.triage) cases.triage(c.id, fx.triage.options.find((o) => o.quality === 'best').id);
  for (const t of fx.tests.filter((t) => t.value === 'useful').slice(0, 3)) if (v.tests.some((x) => x.id === t.test)) cases.orderTest(c.id, t.test);
  cases.setDiagnosis(c.id, fx.diagnosis);
  const rank = ['unsafe', 'poor', 'ok', 'best'];
  const order = quality === 'best' ? [...rank].reverse() : rank;
  const usable = v.plans.filter((x) => !x.block);
  const plan = order.map((q) => usable.find((x) => fx.plans.find((y) => y.id === x.id).quality === q)).find(Boolean);
  let r = cases.choosePlan(c.id, plan.id);
  // The operating room: the careful choice is listed first at every step; the careless one last.
  for (let i = 0; i < 8 && core.W().cases[c.id].status === 'or'; i++) {
    const opts = cases.caseView(c.id).or.step.options.filter((o) => o.id !== 'transfer');
    r = cases.orStep(c.id, (quality === 'best' ? opts[0] : opts[opts.length - 1]).id);
  }
  if (fx.decision && core.W().cases[c.id].status === 'deciding') return cases.decide(c.id, fx.decision.options.find((o) => o.quality === 'best').id);
  return r;
}

// 1. The registry and the case fixtures hold together.
for (const s of SPECIALTIES) {
  for (const x of s.procedures) check(!!PROCEDURE_BY_ID[x], `${s.id}: unknown procedure ${x}`);
  for (const a of s.after ?? []) check(!!SPECIALTY_BY_ID[a], `${s.id}: follows unknown ${a}`);
  check(s.kind !== 'fellowship' || s.after?.length, `${s.id}: a fellowship must follow a residency`);
  check(!!DEPARTMENTS[s.dept], `${s.id}: unknown department ${s.dept}`);
  check(!s.practice || !!PRACTICE_TYPES[s.practice], `${s.id}: unknown practice ${s.practice}`);
}
check(SPECIALTY_BY_ID.podiatry.profession === 'podiatry' && SPECIALTY_BY_ID.ortho.profession === 'medicine', 'podiatry is its own profession, not orthopedics');
check(SPECIALTY_BY_ID.cardiology.kind === 'fellowship' && SPECIALTY_BY_ID.cardiology.after.includes('internal') && !SPECIALTY_BY_ID.cardiology.surgical && SPECIALTY_BY_ID.ctsurg.surgical, 'cardiology (medicine) is not cardiac surgery');
check(SPECIALTY_BY_ID.neurology.surgical === false && SPECIALTY_BY_ID.neurosurg.surgical === true, 'neurology is not neurosurgery');
const seenIds = new Set();
for (const c of CASES) {
  check(!seenIds.has(c.id), `case ${c.id} twice`); seenIds.add(c.id);
  for (const s of c.specialty) check(!!SPECIALTY_BY_ID[s], `case ${c.id}: unknown specialty ${s}`);
  for (const t of c.tests) check(!!TEST_BY_ID[t.test] && ['useful', 'neutral', 'low', 'unsafe'].includes(t.value), `case ${c.id}: bad test ${t.test}`);
  check(c.differential.some((d) => d.id === c.diagnosis), `case ${c.id}: diagnosis not in the differential`);
  check(c.plans.some((x) => x.quality === 'best'), `case ${c.id}: no best plan`);
  for (const x of c.plans) { check(!x.procedure || !!PROCEDURE_BY_ID[x.procedure], `case ${c.id}: unknown procedure ${x.procedure}`); check(!x.refer || !!SPECIALTY_BY_ID[x.refer], `case ${c.id}: refers to unknown ${x.refer}`); }
  check(['good', 'fair', 'poor'].every((k) => typeof c.outcomes[k] === 'string'), `case ${c.id}: outcomes incomplete`);
  check(!c.followUp || !!CASE_BY_ID[c.followUp], `case ${c.id}: follow-up ${c.followUp} missing`);
  for (const t of c.needs ?? []) check(!!TEST_BY_ID[t], `case ${c.id}: needs unknown test ${t}`);
  check(!/\b\d+\s?(mg|mcg|ml|units?)\b/i.test(JSON.stringify(c)), `case ${c.id}: names a dose`);
}
const playable = SPECIALTIES.filter((s) => cases.fixturesFor(s.id, 2020).length >= 5);
check(playable.length >= 6 && playable.some((s) => s.surgical) && playable.some((s) => !s.surgical), `at least six playable specialties, surgical and not (${playable.length})`);
for (const id of ['med_rotation', 'med_mentor', 'med_rival', 'med_romance', 'med_disclosure', 'med_grateful', 'med_leadership_offer']) check(!!EVENT_BY_ID[id], `scene ${id} registered`);
section(`registry: ${SPECIALTIES.length} specialties, ${CASES.length} cases; playable: ${playable.map((s) => s.id).join(', ')}`);

// 2. Premedical years, medical school, rotations and exams, the Match.
let p = life('us', 22);
check(train.premedOpen(p), 'a biology graduate can do premedical activities');
check(train.doPremed('shadow').ok && !train.doPremed('shadow').ok, 'a premedical activity is once a year');
train.doPremed('research'); train.doPremed('volunteer'); train.doPremed('mentor');
const chance = edu.admissionChance('medical');
check(chance > 0.5, `premedical work and grades make medical school likely (${chance.toFixed(2)})`);
check(career.unmet(CAREER_BY_ID.doctor).length > 0, 'without medical school, a doctor\'s job is closed');
check(edu.applyTo('medical').text.length > 0 && store.state.pendingEvents.some((e) => e.id === 'med_school_interview'), 'applying to medical school brings an interview');
edu.enroll('medical', null, 'loan');
check(p.education.stage === 'medical' && p.education.enrolled, 'enrolled at medical school');
year();
let m = core.med();
check(m?.school?.year === 1 && m.stage === 'school', 'the first year of medical school is recorded');
check(!cases.roleNow(m, p), 'a first-year student has no patients');
year();
check(m.school.exams.step1, 'USMLE Step 1 is sat in year two');
strong(m);
year();
check(m.school.rotations.length >= 5, `clinical rotations in year three (${m.school.rotations.length})`);
check(m.school.rotations.every((r) => ['Honors', 'High pass', 'Pass', 'Fail'].includes(r.grade)), 'rotations are graded');
check(cases.roleNow(m, p) === 'student' && cases.caseload(m, p).length === 1, 'a student sees one supervised case a year');
const sc = cases.caseload(m, p)[0];
const sv = cases.caseView(sc.id);
check(sv.supervised && sv.role === 'student', 'a student case is supervised');
check(!p.npcIds.includes(sc.patientId), 'a patient is not added to the people the player knows');
check(train.fellowshipOptions(m).length === 0, 'no fellowship straight from medical school');
check(train.setApplications(['family', 'internal']).ok, 'applications are ranked');
check(!train.setApplications(['cardiology']).ok, 'a fellowship cannot be applied to from medical school');
year(); // year four: Step 2, then graduation and the Match
let guard = 0;
while (!m.training && guard++ < 4) { strong(m); year(); }
check(m.school.graduated, 'graduated from medical school');
check(!!m.training && m.training.kind === 'residency' && m.training.pgy === 1, `matched into residency (${m.match?.status})`);
check(['doctor', 'surgery', 'psychiatry'].includes(p.career.careerId) && p.career.level === 0, 'a resident is paid at the first level of the career');
check(/PGY-1/.test(p.career.title), `a first-year resident's title says PGY-1 (${p.career.title})`);
check(m.people.supervisorIds.length > 0, 'a resident has a supervising physician');
check(['med_school_interview', 'med_anatomy_exam', 'med_patient_remember', 'med_choosing_specialty', 'med_match_day', 'med_first_night'].every((id) => m.scenes[`story:${id}`]), `the story of becoming a doctor is told (${Object.keys(m.scenes).join(', ')})`);
check(!core.storyOnce('med_first_night', {}, m), 'and each part of it only once');
check(career.unmet(CAREER_BY_ID.doctor, { ignoreCurrent: true }).some((x) => /residency programs/.test(x)), 'physician jobs are not hired from the job board');
section(`school and Match: matched into ${core.specialtyName(m.training?.specialtyId)} at ${p.career.employerId}`);

// 3. Residency: cases, supervision, the license, years that are not skipped.
const spec = m.training.specialtyId;
const res = cases.caseload(m, p);
check(res.length === cases.CASES_PER_YEAR, `a resident has ${cases.CASES_PER_YEAR} cases a year (${res.length})`);
check(cases.caseload(m, p).map((c) => c.id).join() === res.map((c) => c.id).join(), 'opening the caseload again does not make new cases');
check(cases.privileges(m).size === 0, 'a resident holds no independent privileges');
const r1 = workCase(res[0]);
check(r1.ok && core.W().cases[res[0].id].status === 'closed', `a case is worked to an outcome: ${r1.text}`);
const keep = JSON.stringify(core.W().cases[res[0].id].outcome);
check(!cases.choosePlan(res[0].id, 'x').ok && JSON.stringify(core.W().cases[res[0].id].outcome) === keep, 'an outcome is rolled once and kept');
check(!events((e) => e.kind === 'medical_career').some((e) => /patient/i.test(e.text) && res.some((c) => e.text.includes(store.state.npcs[c.patientId].firstName))), 'no patient appears in the public record');
const pgyBefore = m.training.pgy;
strong(m);
year();
check(m.training?.pgy === pgyBefore + 1 || m.completed.length, 'a residency moves one PGY year per world year');
const startedTraining = m.training?.startYear ?? store.state.year - 1;
check(res.every((c) => core.W().cases[c.id].status === 'closed'), 'unworked cases close at the end of the year, without the player');
while (m.training && guard++ < 12) { strong(m); year(); }
check(m.completed.some((c) => c.specialtyId === spec), `completed residency in ${spec}`);
check(m.license.status === 'full' && m.license.since - startedTraining <= 3, `licensed after the first year of residency, or a retake later (${m.license.since - startedTraining})`);
check(m.completed[0].to - m.completed[0].from === SPECIALTY_BY_ID[spec].years, 'a residency takes its full length');
section(`residency complete: ${spec}, ${m.experience.cases} patients, license ${m.license.status}, boards ${m.boards.map((b) => b.passed).join()}`);

// 4. A post, the ladder, fellowships after residency, private practice.
if (!m.job) { for (let i = 0; i < 6 && !m.job; i++) { const o = ladder.postOptions(p, m).find((x) => !x.block); if (o) ladder.applyForPost(o.id); if (!m.job) year(); } }
check(!!m.job && m.job.rank === 'attending' && p.career.level === 1, `an attending post (${p.career.title})`);
check(cases.roleNow(m, p) === 'physician', 'an attending decides their own cases');
check(train.fellowshipOptions(m).every((f) => SPECIALTY_BY_ID[f.id].after.includes(spec) || SPECIALTY_BY_ID[f.id].after.some((a) => m.completed.some((c) => c.specialtyId === a))), 'fellowships offered follow the completed residency');
const pr = practice.practiceOptions(m, p);
const mine = pr.find((o) => !o.block);
check(!!mine === !!SPECIALTY_BY_ID[spec].practice || pr.some((o) => !o.block), 'a practice opens to the specialty trained in');
check(pr.find((o) => o.id === 'dermatology_clinic').block || spec === 'dermatology', 'a dermatology clinic needs dermatology training');
if (mine) {
  const r = practice.openPractice(mine.id);
  check(r.ok && m.clinicIds.length === 1 && p.businesses.at(-1).medical?.practiceType === mine.id, `opened a practice: ${r.text}`);
  const b = p.businesses.at(-1);
  b.cash += 10000000;
  biz.hire(b, 0); biz.hire(b, 0);
  const titles = b.staff.map((x) => store.state.npcs[x.id].occupation);
  check(titles[0] === 'staff nurse' && titles[1] === 'practice manager', `a practice is staffed like one (${titles.join(', ')})`);
  check(biz.partnerOptions(b).every((n) => ['doctor', 'surgery', 'psychiatry', 'podiatrist'].includes(n.life?.job?.careerId) || /physician|surgeon|doctor|psychiatrist|podiatrist/i.test(n.occupation ?? '')), 'a practice takes physicians as partners');
}
for (let i = 0; i < 4; i++) { strong(m); year(); }
check(m.job?.rank === 'attending' || m.job?.rank === 'senior' || !!m.offer || !m.job, 'ranks change only through reviews and offers');
section(`practice: ${m.job ? p.career.title : 'no post'}, ${m.clinicIds.length} practice(s)`);

// 5. Drama never touches outcomes; unsafe plans are not rewarded.
{
  const outcomesWith = (level) => {
    rng.seed(777);
    store.state = createLife({ countryId: 'us' });
    const q = store.state.player; q.age = 35;
    const mm = core.M(q);
    mm.completed.push({ specialtyId: 'internal', kind: 'residency', from: 2000, to: 2003 });
    mm.job = { specialtyId: 'internal', hospitalId: null, rank: 'attending', since: 2003 };
    mm.license = { status: 'full' };
    drama.setDrama(level);
    const list = cases.caseload(mm, q);
    return list.map((c) => { workCase(c); return core.W().cases[c.id].outcome.points; }).join();
  };
  check(outcomesWith('low') === outcomesWith('high'), 'the drama setting does not change patient outcomes');
  const careWith = (quality) => {
    rng.seed(99);
    store.state = createLife({ countryId: 'us' });
    const q = store.state.player; q.age = 35;
    const mm = core.M(q);
    mm.completed.push({ specialtyId: 'family', kind: 'residency', from: 2000, to: 2003 });
    mm.job = { specialtyId: 'family', hospitalId: null, rank: 'attending', since: 2003 };
    for (const c of cases.caseload(mm, q)) workCase(c, quality);
    return mm;
  };
  const careful = careWith('best');
  const careless = careWith('worst');
  check(careless.skills.reasoning < careful.skills.reasoning && careless.skills.integrity <= careful.skills.integrity && core.reputationOf(careless) < core.reputationOf(careful), 'poor care lowers judgment and reputation, whatever the outcome');
  // An unsafe plan, chosen by a physician deciding alone, costs integrity.
  {
    rng.seed(5);
    store.state = createLife({ countryId: 'us' });
    const q = store.state.player; q.age = 40;
    const um = core.M(q);
    um.completed.push({ specialtyId: 'emergency', kind: 'residency', from: 2000, to: 2003 });
    um.job = { specialtyId: 'emergency', hospitalId: null, rank: 'attending', since: 2003 };
    const fx = CASE_BY_ID.er_crash;
    const patient = { id: 'pt_test', firstName: 'Test', lastName: 'Patient', age: 30, alive: true, flags: {} };
    store.state.npcs[patient.id] = patient;
    core.W().patients[patient.id] = { id: patient.id, caseIds: [], bornYear: store.state.year - 30 };
    const id = 'case_test';
    core.W().cases[id] = { id, fixtureId: fx.id, patientId: patient.id, specialtyId: 'emergency', role: 'physician', year: store.state.year, status: 'open', tests: [], dx: null, plan: null, triage: null, decision: null, outcome: null, notes: [] };
    um.caseIds.push(id);
    const before = um.skills.integrity;
    cases.triage(id, 'driver'); cases.setDiagnosis(id, fx.diagnosis);
    cases.choosePlan(id, fx.plans.find((x) => x.quality === 'unsafe').id);
    cases.decide(id, fx.decision.options[0].id);
    check(um.skills.integrity < before, 'an unsafe plan costs integrity');
  }
  const mm = careless;
  check(drama.romanceAllowed({ age: 30, flags: { medRole: 'supervisor' }, role: 'coworker' }, mm) === false && drama.romanceAllowed({ age: 30, flags: { patient: true }, role: 'coworker' }, mm) === false, 'no romance with a supervisor or a patient');
}
{
  rng.seed(606);
  store.state = createLife({ countryId: 'us' });
  const q = store.state.player; q.age = 40;
  const pm = core.M(q);
  pm.completed.push({ specialtyId: 'pediatrics', kind: 'residency', from: 2000, to: 2003 });
  pm.job = { specialtyId: 'pediatrics', hospitalId: null, rank: 'attending', since: 2003 };
  const kids = cases.caseload(pm, q).map((c) => cases.caseView(c.id)).filter((v) => v.guardian && v.patient.age < 16);
  check(kids.length > 0 && kids.every((v) => v.family.length === 1 && v.family[0].as === 'parent or guardian'), 'a child patient comes with a parent or guardian');
  const kinIds = Object.values(core.W().patients).flatMap((x) => (x.household ?? []).map((h) => h.id));
  check(kinIds.every((id) => !q.npcIds.includes(id)), 'a patient\'s family is not added to the player\'s people');
}
// The operating room: a surgeon's case goes through consent, team, anesthesia, the unexpected and aftercare.
{
  const surgery = (choice) => {
    rng.seed(2468);
    store.state = createLife({ countryId: 'us' });
    const q = store.state.player; q.age = 45;
    const sm = core.M(q);
    for (const k of Object.keys(sm.skills)) sm.skills[k] = 80;
    const now = store.state.year;
    const fx = CASES.find((x) => !x.triage && !x.decision && x.minYear <= now && x.plans.some((y) => y.quality === 'best' && y.procedure && PROCEDURE_BY_ID[y.procedure].major
      && (SPECIALTY_BY_ID[x.specialty[0]].procedures ?? []).includes(y.procedure) && (y.minYear ?? 0) <= now && (y.maxYear ?? 9999) >= now));
    sm.completed.push({ specialtyId: fx.specialty[0], kind: 'residency', from: 2000, to: 2005 });
    sm.job = { specialtyId: fx.specialty[0], hospitalId: null, rank: 'attending', since: 2005 };
    const pt = { id: 'pt_or', firstName: 'Pat', lastName: 'Case', age: 50, alive: true, flags: {} };
    store.state.npcs[pt.id] = pt; core.W().patients[pt.id] = { id: pt.id, caseIds: [], bornYear: store.state.year - 50 };
    const id = 'case_or';
    core.W().cases[id] = { id, fixtureId: fx.id, patientId: pt.id, specialtyId: fx.specialty[0], role: 'physician', year: store.state.year, status: 'open', tests: [], dx: null, plan: null, triage: null, decision: null, outcome: null, notes: [] };
    sm.caseIds.push(id);
    cases.setDiagnosis(id, fx.diagnosis);
    cases.choosePlan(id, fx.plans.find((y) => y.quality === 'best').id);
    const went = core.W().cases[id].status === 'or';
    core.W().cases[id].or.complication = true;
    const steps = [];
    while (core.W().cases[id].status === 'or') {
      const v = cases.caseView(id).or;
      steps.push(v.step.id);
      cases.orStep(id, v.step.id === 'complication' ? choice : v.step.options[0].id);
    }
    return { went, steps, outcome: core.W().cases[id].outcome, integrity: sm.skills.integrity };
  };
  const careful = surgery('pause');
  const rushed = surgery('press');
  check(careful.went && careful.steps.join() === 'consent,team,anesthesia,complication,after', `an operation goes through the operating room (${careful.steps.join()})`);
  check(careful.outcome.points > rushed.outcome.points && rushed.integrity < careful.integrity, 'meeting a complication as a team does better than pressing on');
}
section('drama and outcomes kept apart; unsafe care is not rewarded');

// 6. Podiatry is its own route.
p = life('us', 22);
edu.enroll('podiatric', null, 'loan');
for (let i = 0; i < 5; i++) { const mm = core.med(); if (mm) strong(mm); year(); }
m = core.med();
check(m.route === 'dpm', 'a podiatric student is on the DPM route');
check(train.applicationOptions(p, m).every((o) => o.id === 'podiatry'), 'a podiatry graduate applies to podiatry residency only');
check(!m.training || (m.training.specialtyId === 'podiatry' && p.career.careerId === 'podiatrist'), `a podiatry resident works as a podiatrist (${p.career.careerId})`);
check(PROCEDURE_BY_ID.pod_rearfoot.needsFocus === 'reconstructive', 'rearfoot reconstruction needs a reconstructive focus');
section('podiatry: DPM school, podiatry residency, its own career');

// 7. Age Up length: the same training whatever the turn length.
const run = (step) => {
  rng.seed(4242);
  const q = life('us', 26);
  const mm = core.M(q);
  strong(mm);
  const site = trainingSites('internal', q.countryId, q.city)[0];
  train.startTraining('residency', 'internal', site.e.id);
  cases.caseload(mm, q); // the year's patients, whatever the turn length
  store.state.settings = { ...(store.state.settings ?? {}), step };
  const counts = [];
  for (let t = 0; t < (12 / step) * 2; t++) {
    advanceTurn(); store.state.pendingEvents = []; q.alive = true; q.stats.health = 90;
    counts.push(cases.caseload(mm, q).length);
  }
  return { pgy: mm.training?.pgy, years: mm.experience.years, perYear: Math.max(...counts), cases: mm.caseIds.length };
};
const a12 = run(12); const a6 = run(6); const a3 = run(3);
check(a12.pgy === a6.pgy && a6.pgy === a3.pgy && a12.years === a3.years, `PGY years match for 12/6/3-month turns (${a12.pgy}/${a6.pgy}/${a3.pgy})`);
check(a12.perYear === a3.perYear && a3.perYear === cases.CASES_PER_YEAR && a12.cases === a3.cases, `shorter turns bring no extra cases (${a12.cases}/${a6.cases}/${a3.cases})`);
section(`turn lengths: PGY ${a12.pgy}, ${a12.cases} cases over two years at every length`);

// 8. Saves: reload without duplication; older saves migrated without invented history.
{
  const snap = JSON.parse(JSON.stringify(store.state));
  core.migrateMedicine(snap);
  const again = JSON.stringify(core.migrateMedicine(JSON.parse(JSON.stringify(snap))));
  check(again === JSON.stringify(core.migrateMedicine(JSON.parse(again))), 'migration is idempotent');
  store.state = JSON.parse(JSON.stringify(snap));
  const mm = core.med();
  const n = mm.caseIds.length;
  cases.caseload(mm); cases.caseload(mm);
  check(core.med().caseIds.length === n, 'reloading does not duplicate cases');
  // A doctor saved before this engine.
  const old = life('us', 45);
  old.education.degrees.push({ type: 'medical', gpa: 3.4, age: 30 });
  old.flags.licenses = ['medical'];
  career.hire(CAREER_BY_ID.doctor, 2, 60, 'Old save.');
  delete old.medicine; delete store.state.medicine;
  const state = JSON.parse(JSON.stringify(store.state));
  core.migrateMedicine(state);
  const om = state.player.medicine;
  check(om?.legacy && state.player.career.level === 2 && state.player.career.careerId === 'doctor', 'a senior doctor keeps their job and level');
  check(om.completed.length === 0 && om.caseIds.length === 0 && om.people.friendIds.length === 0, 'no training, patients or friendships are invented');
  check(om.license.status === 'full', 'their license is kept');
  const grad = life('us', 40);
  grad.education.degrees.push({ type: 'medical', gpa: 3.4, age: 30 });
  career.hire(CAREER_BY_ID.retail ?? CAREER_BY_ID.office, 0, 60, 'Other work.');
  const gs = JSON.parse(JSON.stringify(store.state)); delete gs.player.medicine;
  core.migrateMedicine(gs);
  check(gs.player.medicine.reapply === false && !gs.player.medicine.training, 'a graduate in other work is not pulled into residency');
}
section('saves: idempotent migration, no duplicate cases, no invented past');

// 8b. Applying nationwide can mean moving; applying at home does not.
{
  const graduate = (local) => {
    rng.seed(local ? 8 : 9);
    const q = life('us', 26);
    q.city = COUNTRIES.us.cities[COUNTRIES.us.cities.length - 1];
    const mm = core.M(q);
    for (const k of Object.keys(mm.skills)) mm.skills[k] = 95;
    q.stats.intellect = 99;
    mm.stage = 'graduate'; mm.school = { name: 'medical school', year: 4, rotations: [], exams: { step1: { pass: true, score: 95 }, step2: { pass: true, score: 95 } }, interest: { internal: 10 }, apply: ['internal'], graduated: true };
    mm.local = local; mm.premed.letters = 5;
    const from = q.city;
    train.runMatch('residency', ['internal']);
    return { from, to: q.city, at: market.employer(q.career.employerId)?.city, matched: !!mm.training };
  };
  const home = graduate(true);
  check(home.matched && home.to === home.from && home.at === home.from, 'applying only at home keeps the player in their city');
  const away = graduate(false);
  check(away.matched && away.at === away.to && away.to !== away.from, `a nationwide place is taken where it is, moving if need be (${away.from} → ${away.to})`);
}
section('the Match: at home, or nationwide with a move');

// 8c. Teaching residents, and claims after care below the standard.
{
  rng.seed(4321);
  const q = life('us', 40);
  const mm = core.M(q);
  strong(mm);
  mm.completed.push({ specialtyId: 'internal', kind: 'residency', from: 2000, to: 2003 });
  mm.license = { status: 'full', countryId: 'us' };
  const site = trainingSites('internal', q.countryId, q.city)[0];
  train.startPost('internal', site.e.id, 'attending');
  year();
  const trainees = (mm.people.traineeIds ?? []).map((id) => store.state.npcs[id]);
  check(trainees.length === 2 && trainees.every((n) => n.flags.medRole === 'trainee'), 'an attending at a teaching hospital supervises residents');
  check(trainees.every((n) => !drama.romanceAllowed(n, mm)), 'and romance with someone you supervise is ruled out');
  mm.claims = [{ caseId: 'x', year: store.state.year, status: 'open', below: true }, { caseId: 'y', year: store.state.year, status: 'open', below: false }];
  const marks = mm.discipline.length;
  year();
  check(mm.claims[0].status === 'upheld' && mm.claims[1].status === 'dismissed' && mm.discipline.length === marks + 1, 'a claim is upheld only where care fell below the standard');
  // A leadership seat can go to someone else; retiring writes the career down.
  const rival = makeNpc({ role: 'coworker', countryId: q.countryId, age: 41 });
  rival.life = { edu: { stage: 'done', gpa: 3.5, majorId: 'biology', trade: null, degrees: [], yearsLeft: 0 }, job: { careerId: 'doctor', level: 1, title: 'Physician', salary: 0, years: 5, employerId: q.career.employerId },
    savings: 0, aspiration: null, partnerId: null, together: 0, married: false, kids: 0, history: [] };
  rival.meters.intellect = 99; store.state.npcs[rival.id] = rival; q.npcIds.push(rival.id);
  mm.people.rivalIds = [rival.id];
  mm.job.rank = 'senior'; mm.job.rankSince = store.state.year - 10;
  for (const k of Object.keys(mm.skills)) mm.skills[k] = 90;
  let lost = false;
  for (let i = 0; i < 12 && !lost && mm.job?.rank === 'senior' && !mm.offer; i++) { year(); lost = /went to .*rival/.test(JSON.stringify(store.state.journal ?? store.state.log ?? '')) || rival.flags.title === 'Medical director'; }
  check(lost || !!mm.offer || mm.job?.rank !== 'senior', 'a leadership seat is contested, and either goes to someone or is offered');
  q.age = 66;
  check(career.retire().ok, 'a physician can retire');
  year();
  check(mm.stage === 'retired' && mm.history.some((h) => /Retired from medicine/.test(h.text)), 'retiring from medicine is recorded');
}
section('teaching residents; claims decided on the care, not the result');

// 8d. Research, wellbeing, and an offer from another city.
{
  rng.seed(1357);
  const q = life('us', 38);
  q.city = COUNTRIES.us.cities[0];
  const rm = core.M(q);
  strong(rm);
  rm.skills.research = 90;
  rm.completed.push({ specialtyId: 'internal', kind: 'residency', from: 2000, to: 2003 });
  rm.license = { status: 'full', countryId: 'us' };
  const site = trainingSites('internal', q.countryId, q.city)[0];
  train.startPost('internal', site.e.id, 'attending');
  check(research.researchOptions(rm, q).find((o) => o.id === 'faculty').block, 'a faculty post needs published work first');
  check(research.doResearch('project').ok && !research.doResearch('project').ok, 'a research project is joined once a year');
  check(research.doResearch('teach').ok, 'an attending at a teaching hospital teaches students');
  let papers = 0;
  for (let i = 0; i < 8; i++) { year(); if (rm.research.projects.length < 2) research.doResearch('project'); research.doResearch('teach'); papers = rm.research.papers.length; }
  check(papers >= 1 && papers <= 8, `research takes years and is not guaranteed (${papers} papers in eight years)`);
  // A hard stretch brings support, not a reward for pushing through.
  q.career.stress = 92;
  store.state.pendingEvents = [];
  rm.scenes = {};
  drama.dramaYear();
  check(store.state.pendingEvents.some((e) => e.id === 'med_strain'), 'a hard stretch is noticed');
  const before = q.career.stress;
  drama.medicineChoice('strain:support');
  check(q.career.stress < before, 'and support helps');
  // An offer elsewhere: taking it moves the player and the post.
  const other = COUNTRIES.us.cities.find((c) => c !== q.city);
  const there = hospitalsIn('us', other).find(({ h }) => h.depts.includes('medicine'));
  rm.awayOffer = { hospitalId: there.e.id, city: other, year: store.state.year };
  drama.medicineChoice('away:accept');
  check(q.city === other && rm.job?.hospitalId === there.e.id && !rm.awayOffer, `an offer in ${other} accepted moves the post there`);
  const integrity0 = rm.skills.integrity;
  drama.medicineChoice('record:refuse');
  check(rm.skills.integrity > integrity0, 'refusing to alter a record is integrity');
  const integrity1 = rm.skills.integrity;
  drama.medicineChoice('gift:accept');
  check(rm.skills.integrity < integrity1, 'accepting a gift from industry is a conflict of interest');
}
section('research and teaching, wellbeing, and an offer from another city');

// 9. Generations: the archive keeps the career, not the patients; the family is a pull, not a path.
{
  rng.seed(31337);
  const doc = life('us', 60);
  const mm = core.M(doc);
  strong(mm);
  const site = trainingSites('family', doc.countryId, doc.city)[0];
  train.startTraining('residency', 'family', site.e.id);
  cases.caseload(mm, doc);
  for (let i = 0; i < 4; i++) { strong(mm); year(); }
  check(mm.completed.length === 1, 'the parent finished residency');
  const hosp = mm.completed[0].hospitalId;
  const patients = mm.caseIds.map((id) => store.state.npcs[core.W().cases[id]?.patientId]?.firstName).filter(Boolean);
  const kid = makeNpc({ role: 'child', countryId: doc.countryId, age: 14 }); store.state.npcs[kid.id] = kid; doc.npcIds.push(kid.id);
  const name = `${doc.firstName} ${doc.lastName}`;
  die('old age');
  const next = continueAs(kid.id);
  check(!!next, 'a doctor\'s child carries the family on');
  if (next) {
    const anc = Object.values(next.archive.people).find((a) => `${a.firstName} ${a.lastName}` === name);
    check(!!anc?.medicine && anc.medicine.trained[0]?.specialtyId === 'family', 'the Family Archive keeps the physician\'s training');
    const text = JSON.stringify(anc?.medicine ?? {});
    check(!patients.some((n) => text.includes(`"${n}"`)) && !('caseIds' in (anc?.medicine ?? {})), 'and nothing about any patient');
    check(Object.keys(next.medicine?.cases ?? {}).length === 0 && Object.keys(next.medicine?.patients ?? {}).length === 0, 'patient files are not inherited');
    check(!next.player.medicine, 'a child inherits no medical record or license');
    const fam = core.medicalFamily(next.player, next);
    check(fam?.archived && fam.name === anc.firstName, `the heir has a doctor in the family archive (${JSON.stringify(fam)})`);
    store.state.pendingEvents = [];
    advanceYear();
    check(store.state.pendingEvents.some((e) => e.id === 'med_family_calling') || next.player.flags.medFamilyScene, 'a doctor\'s child is asked, once, whether medicine is for them');
    store.state.pendingEvents = [];
    const heir = store.state.player;
    heir.age = 22; heir.education.enrolled = false; heir.education.stage = 'none';
    heir.education.degrees.push({ type: 'university', majorId: 'biology', gpa: 3.8, age: 22 });
    check(train.premedOptions().some((o) => o.id === 'family_talk'), 'premed: the family\'s papers can be read');
    check(train.doPremed('family_talk').ok, 'and reading them counts toward an application');
    const hm = core.M(heir);
    strong(hm);
    train.startTraining('residency', 'internal', hosp);
    check(events((e) => /had worked before/.test(e.text)).length === 1, 'training where a parent trained is remembered in the family record');
  }
}
section('generations: the archive keeps the career; the family is a pull, not a path');

if (problems.length) {
  console.log(`PROBLEMS (${problems.length}):\n${problems.map((x) => ` - ${x}`).join('\n')}`);
  for (const x of ok) console.log(`ok: ${x}`);
  process.exit(1);
}
for (const x of ok) console.log(`ok: ${x}`);
console.log('The medical career holds together.');
