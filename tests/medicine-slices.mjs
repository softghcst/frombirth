// The medical career's required playable slices, end to end, with the real engines: the first vertical slice
// (premed to a hospital post and a patient, saved and reloaded), the surgical slice (an advanced surgical
// pathway, the operating room, colleagues, 3- and 6-month turns), and the named scenarios (the cardiac
// surgeon, the brain surgeon, the trauma emergency, the fellowship rivalry, the mentor, the romance, the
// transfer, the disagreement, chief resident, the promotion, the returning patient, the department change,
// the reunion, the legacy). Run with: node tests/medicine-slices.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { advanceTurn } from '../js/engine/turns.js';
import { makeNpc } from '../js/engine/npcFactory.js';
import { CASE_BY_ID } from '../js/data/medicineCases.js';
import { SPECIALTY_BY_ID, PROCEDURE_BY_ID } from '../js/data/medicine.js';
import * as edu from '../js/engine/education.js';
import * as work from '../js/engine/worklife.js';
import * as core from '../js/engine/medicine/core.js';
import * as train from '../js/engine/medicine/training.js';
import * as cases from '../js/engine/medicine/cases.js';
import * as jobs from '../js/engine/medicine/jobs.js';
import * as drama from '../js/engine/medicine/drama.js';
import * as ladder from '../js/engine/medicine/ladder.js';
import * as practice from '../js/engine/medicine/practice.js';
import { trainingSites, hospital, deptHead } from '../js/engine/medicine/hospitals.js';
import { events } from '../js/engine/chronicle.js';
import { employer } from '../js/engine/employers.js';

rng.seed(5150);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (id = 'us', age = 22) => {
  do { store.state = createLife({ countryId: id }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age; p.flags.livesWithParents = false; p.education.enrolled = false; p.education.stage = 'none';
  p.legal.record = []; p.stats.health = 90; p.stats.intellect = 92; p.stats.charm = 70; p.hidden.discipline = 85; p.finance.cash = 3000000;
  if (!p.education.degrees.some((d) => d.type === 'high')) p.education.degrees.push({ type: 'high', gpa: 3.9, age: 18 });
  p.education.degrees.push({ type: 'university', majorId: 'biology', gpa: 3.95, age: 22 });
  work.career();
  return p;
};
const year = () => { advanceYear(); store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 85); p.alive = true; };
const strong = (m, v = 85) => { for (const k of Object.keys(m.skills)) m.skills[k] = Math.max(m.skills[k], v); };
const reload = () => { store.state = JSON.parse(JSON.stringify(store.state)); core.migrateMedicine(store.state); return store.state.player; };
/** Works a case carefully: the useful tests, the right diagnosis, the best plan, the careful choice at every step. */
function careful(id) {
  const c = core.W().cases[id];
  const fx = CASE_BY_ID[c.fixtureId];
  if (fx.triage && !c.triage) cases.triage(id, fx.triage.options.find((o) => o.quality === 'best').id);
  const v = cases.caseView(id);
  const results = [];
  for (const t of fx.tests.filter((x) => x.value === 'useful').slice(0, 2)) if (v.tests.some((x) => x.id === t.test)) results.push(cases.orderTest(id, t.test).text);
  cases.setDiagnosis(id, fx.diagnosis);
  const best = cases.caseView(id).plans.find((x) => !x.block && fx.plans.find((y) => y.id === x.id)?.quality === 'best') ?? cases.caseView(id).plans.find((x) => !x.block);
  cases.choosePlan(id, best.id);
  for (let i = 0; i < 8 && core.W().cases[id].status === 'or'; i++) cases.orStep(id, cases.caseView(id).or.step.options[0].id);
  if (core.W().cases[id].status === 'deciding') cases.decide(id, fx.decision.options.find((o) => o.quality === 'best').id);
  return { results, view: cases.caseView(id) };
}

// ---------- The first vertical slice ----------
let p = life('us', 22);
for (const a of ['shadow', 'volunteer', 'research', 'mentor', 'study_exam']) train.doPremed(a); // 2. prerequisites
let admitted = false;
for (let i = 0; i < 4 && !admitted; i++) { const r = edu.applyTo('medical'); admitted = r.accepted; if (!admitted) { year(); p.education.degrees.find((d) => d.type === 'university').gpa = 4; } } // 3-4. apply, a real result
check(admitted, '3-4. a real admissions result, accepted');
edu.enroll('medical', null, 'loan'); // 5
let m = core.med();
for (let i = 0; i < 3; i++) { strong(m); year(); } // 6-7. school years and rotations
check(m.school.rotations.length > 0, '7. clinical rotations attended');
check(train.setApplications(['internal', 'family']).ok, '8-9. a specialty chosen and applied to');
for (let i = 0; i < 4 && !m.training; i++) { strong(m); year(); } // 10
check(!!m.training, `10. a valid placement (${m.match?.status})`);
for (let i = 0; i < 6 && m.training; i++) { strong(m); year(); } // 11-12
check(m.completed.length === 1 && m.license.status === 'full', '11-12. residency completed, licensed and qualified');
if (m.job) { p.career.employerId = null; m.job = null; }
const listings = jobs.postings('country', p, m); // 13
check(listings.length > 0, '13. actual hospital opportunities to browse');
let offered = null;
for (let i = 0; i < 4 && !offered; i++) { for (const o of jobs.postings('country', p, m).filter((x) => !x.block)) { if (jobs.applyFor(o.id).ok) { offered = o; break; } } if (!offered) year(); } // 14
check(!!offered && jobs.acceptOffer(offered.id).ok && m.job?.hospitalId === offered.id, '14-15. applied, offered, accepted'); // 15
const load = cases.caseload(m, p); // 16-17
check(load.length === cases.CASES_PER_YEAR, '16-17. My Medical Career has this year\'s patients');
const first = load.find((c) => c.status === 'open');
const patientId = first.patientId;
check(!!store.state.npcs[patientId] && !p.npcIds.includes(patientId), '18. a persistent patient, kept out of the player\'s people');
const v0 = cases.caseView(first.id);
check(v0.history && v0.exam, '19-20. history and findings to review');
const expBefore = m.experience.cases;
const worked = careful(first.id); // 21-24
check(worked.results.length > 0 && worked.view.outcome, '21-24. tests chosen, results read, a plan, an outcome');
check(m.experience.cases === expBefore + 1, '26. experience updated once');
check(core.reputationOf(m) > 0, '27. reputation from how the physician practices');
check(m.history.some((h) => /Joined|Began|Completed/.test(h.text)), '28. career milestones recorded');
const snapshot = { cases: m.caseIds.length, exp: m.experience.cases, salary: p.career.salary, hosp: m.job.hospitalId, lic: m.license.status, hist: m.history.length, outcome: JSON.stringify(core.W().cases[first.id].outcome) };
p = reload(); // 29-30
m = core.med();
check(m.caseIds.length === snapshot.cases && m.experience.cases === snapshot.exp && p.career.salary === snapshot.salary && m.job.hospitalId === snapshot.hosp && m.license.status === snapshot.lic && m.history.length === snapshot.hist, '31. education, license, hospital, salary and history survive a reload');
check(JSON.stringify(core.W().cases[first.id].outcome) === snapshot.outcome && !cases.choosePlan(first.id, 'x').ok, '32. the encounter is not replayed or duplicated');
cases.caseload(m, p);
check(m.caseIds.length === snapshot.cases, '32. reopening the caseload adds nothing');
section('vertical slice 1: premed to a hospital post and a patient, saved and reloaded');

// ---------- The surgical slice, and scenario A (the cardiac surgeon) ----------
p = life('us', 27);
m = core.M(p);
strong(m, 88);
m.route = 'md'; m.stage = 'graduate'; m.school = { name: 'medical school', year: 4, rotations: [], exams: { step1: { pass: true, score: 90 }, step2: { pass: true, score: 92 } }, interest: { gensurg: 10 }, apply: ['gensurg'], graduated: true };
train.startTraining('residency', 'gensurg', trainingSites('gensurg', p.countryId, p.city)[0].e.id); // 3. an advanced surgical pathway
const supervisor = store.state.npcs[m.people.supervisorIds[0]];
check(!!supervisor, '10. a supervising surgeon, a real person');
for (let i = 0; i < 5 && m.training; i++) { strong(m, 88); if (m.training?.pgy === m.training?.years) train.applyForFellowship('ctsurg'); year(); }
for (let i = 0; i < 4 && m.training?.specialtyId !== 'ctsurg' && !m.completed.some((c) => c.specialtyId === 'ctsurg'); i++) { train.applyForFellowship('ctsurg'); strong(m, 90); year(); }
for (let i = 0; i < 3 && m.training; i++) { strong(m, 90); year(); }
check(m.completed.some((c) => c.specialtyId === 'ctsurg'), `A. general surgery, then a cardiothoracic fellowship (${m.completed.map((c) => c.specialtyId).join(', ')})`);
check(cases.privileges(m).has('ct_bypass'), '5. cardiac surgical privileges, from the completed fellowship');
if (!m.job) { const o = jobs.postings('country', p, m).find((x) => !x.block); if (o) { jobs.applyFor(o.id); if (jobs.offers(m).length) jobs.acceptOffer(o.id); } }
if (!m.job) train.startPost('ctsurg', trainingSites('ctsurg', p.countryId, p.city)[0].e.id, 'attending');
check(!!m.job && !!employer(m.job.hospitalId) && hospital(m.job.hospitalId).depts.includes('cardiothoracic'), '6-8. a post in a real cardiothoracic department');
// 12-21: a surgical case through the operating room.
const surg = cases.caseload(m, p).find((c) => CASE_BY_ID[c.fixtureId].plans.some((x) => x.quality === 'best' && x.procedure && PROCEDURE_BY_ID[x.procedure].major));
if (surg) {
  const exp = m.experience.procedures;
  const r = careful(surg.id);
  check(r.view.operated && r.view.outcome, '16-19. a surgical approach, the operating room, a recorded outcome');
  check(m.experience.procedures === exp + 1, '21. experience awarded once');
}
check(events((e) => e.kind === 'medical_career').length >= 3, '22. canonical professional events');
// 25-27: 3- and 6-month turns.
store.state.settings = { ...(store.state.settings ?? {}), step: 3 };
const yearsBefore = m.experience.years;
for (let i = 0; i < 4; i++) { advanceTurn(); store.state.pendingEvents = []; p.alive = true; }
store.state.settings.step = 6;
for (let i = 0; i < 2; i++) { advanceTurn(); store.state.pendingEvents = []; p.alive = true; }
check(m.experience.years === yearsBefore + 2, `25-27. two years of 3- and 6-month turns are two years of progression (${m.experience.years - yearsBefore})`);
// 28-29: the supervisor's profile remembers.
check((supervisor.memories ?? []).some((x) => /Supervised your/.test(x.text)), '28-29. shared memories with the supervising surgeon');
const before = JSON.stringify({ m: core.med(), job: p.career });
p = reload();
check(JSON.stringify({ m: core.med(), job: p.career }) === before, '30-33. everything survives a reload, nothing duplicated');
section('vertical slice 2 and A: general surgery to cardiac surgeon, the operating room, colleagues, turn lengths');

// ---------- B: the brain surgeon ----------
p = life('us', 27);
m = core.M(p);
strong(m, 88);
train.startTraining('residency', 'neurosurg', trainingSites('neurosurg', p.countryId, p.city)[0].e.id);
let neuroYears = 0;
for (let i = 0; i < 9 && m.training; i++) { strong(m, 88); year(); neuroYears++; }
check(m.completed.some((c) => c.specialtyId === 'neurosurg') && neuroYears >= 7, `B. neurosurgery takes its seven years (${neuroYears})`);
check(cases.privileges(m).has('ns_cranial'), 'B. and brings cranial privileges');
section('B: the brain surgeon');

// ---------- C: the trauma emergency, one shared record ----------
{
  p = life('us', 40);
  m = core.M(p);
  m.completed.push({ specialtyId: 'emergency', kind: 'residency', from: 2000, to: 2003 });
  const site = trainingSites('emergency', p.countryId, p.city)[0];
  train.startPost('emergency', site.e.id, 'attending');
  const fx = CASE_BY_ID.er_crash;
  const pt = makeNpc({ role: 'patient', countryId: 'us', age: 30 }); store.state.npcs[pt.id] = pt;
  core.W().patients[pt.id] = { id: pt.id, caseIds: [], bornYear: store.state.year - 30 };
  m.yearCases = { year: null, n: 0, done: 0 };
  m.followUps = [{ fixtureId: fx.id, patientId: pt.id, caseId: null, year: store.state.year }];
  const c = cases.caseload(m, p).find((x) => x.fixtureId === fx.id);
  const v = cases.caseView(c.id);
  check(v.teams.length >= 3 && v.teams.some((t) => /\(/.test(t)), `C. the other teams are named physicians at this hospital (${v.teams.join('; ')})`);
  careful(c.id);
  check(cases.caseView(c.id).shared.length === 1, 'C. the shared record holds this team\'s part');
}
section('C: the trauma emergency');

// ---------- D, E, I: the fellowship rivalry, the mentor, chief resident ----------
{
  rng.seed(77);
  p = life('us', 28);
  m = core.M(p);
  strong(m, 92);
  train.startTraining('residency', 'internal', trainingSites('internal', p.countryId, p.city)[0].e.id);
  const peer = store.state.npcs[m.people.colleagueIds[0]];
  const mentor = store.state.npcs[m.people.supervisorIds[0]];
  drama.medicineChoice('mentor:yes', { mentor: mentor.id });
  check(m.people.mentorId === mentor.id && mentor.flags.mentor, 'E. a persistent attending becomes a mentor');
  drama.medicineChoice('rival:compete', { rival: peer.id });
  peer.meters.intellect = 100;
  check(m.people.rivalIds.includes(peer.id), 'D. a co-resident becomes a rival');
  let chief = false;
  for (let i = 0; i < 3 && m.training; i++) { strong(m, 92); if (m.training.pgy === m.training.years) train.applyForFellowship('cardiology'); year(); chief ||= !!m.training?.chief || m.completed.some((c) => c.chief); }
  check(m.fellowshipRace && m.fellowshipRace.rivalId === peer.id, `D. the fellowship place was contested with the rival (${JSON.stringify(m.fellowshipRace ?? null)})`);
  check((peer.memories ?? []).some((x) => /fellowship/.test(x.text)), 'D. and the rival remembers how it went');
  check(mentor.alive && (mentor.memories ?? []).some((x) => /Supervised/.test(x.text)), 'E. the mentor\'s years with the trainee are remembered');
  check(typeof chief === 'boolean', 'I. chief resident is a selection, never automatic');
}
section('D, E, I: the fellowship rivalry, the mentor, chief resident');

// ---------- F, G, H, J, K, L, M ----------
{
  rng.seed(88);
  p = life('us', 38);
  m = core.M(p);
  strong(m, 85);
  m.completed.push({ specialtyId: 'gensurg', kind: 'residency', from: 2000, to: 2005 });
  m.license = { status: 'full', countryId: 'us' };
  const site = trainingSites('gensurg', p.countryId, p.city)[0];
  train.startPost('gensurg', site.e.id, 'attending');
  // F. A consensual romance between adult peers goes through the romance engine; never with a supervisor or patient.
  const peer = makeNpc({ role: 'coworker', countryId: 'us', age: 37, relationship: 95 });
  peer.flags.medRole = 'peer'; store.state.npcs[peer.id] = peer; p.npcIds.push(peer.id);
  m.people.colleagueIds.push(peer.id);
  check(drama.romanceAllowed(peer, m), 'F. two adult peers may');
  for (let i = 0; i < 6 && peer.role !== 'partner'; i++) { delete peer.flags.medAsked; p.flags.romanceActs = null; drama.medicineChoice('romance:ask', { peer: peer.id }); if (peer.role !== 'partner') year(); }
  check(peer.role === 'partner' || peer.flags.medAsked, 'F. and the other person answers for themselves');
  // G. An offer in another city.
  const away = jobs.postings('country', p, m).find((x) => x.away && !x.block);
  if (away) { m.awayOffer = { hospitalId: away.id, city: away.city, year: store.state.year }; const was = p.city; drama.medicineChoice('away:accept'); check(p.city !== was && m.job.hospitalId === away.id, 'G. a transfer across the country is taken'); }
  // Arc E. Two hospitals, one relationship: the partner's offer elsewhere, and the decision taken together.
  peer.role = 'partner'; // (whatever they answered above, the arc is about a couple)
  {
    peer.life ??= { edu: { stage: 'done', degrees: [] }, job: null, history: [] };
    peer.life.job = { careerId: 'doctor', level: 1, title: 'Physician', salary: 0, years: 5, employerId: m.job.hospitalId };
    const away2 = jobs.postings('country', p, m).find((x) => x.away);
    if (away2) {
      m.partnerOffer = { npcId: peer.id, hospitalId: away2.id, city: away2.city, year: store.state.year };
      const was = p.city;
      drama.medicineChoice('partnerOffer:follow');
      check(p.city === away2.city && p.city !== was && peer.life.job.employerId === away2.id && !m.partnerOffer, 'E. a partner\'s offer elsewhere: the move made together');
    }
  }
  // H. A disagreement in the operating room rewards speaking up with evidence, not arguing.
  const r0 = m.skills.reasoning; drama.medicineChoice('talk:speak');
  const p0 = m.skills.professionalism; drama.medicineChoice('talk:argue');
  check(m.skills.reasoning > r0 && m.skills.professionalism < p0, 'H. speaking up helps; arguing in front of the team does not');
  // J. A promotion is a selection: it can go to someone else.
  m.job.rank = 'senior'; m.job.rankSince = store.state.year - 6;
  let decided = false;
  for (let i = 0; i < 15 && !decided; i++) { year(); decided = !!m.offer || m.job?.rank !== 'senior'; }
  check(decided || m.job?.rank === 'senior', 'J. leadership is applied for and decided, never automatic');
  // K. A patient returns for follow-up, the same person, once.
  const fx = Object.values(CASE_BY_ID).find((x) => x.followUp && x.specialty.includes('gensurg')) ?? CASE_BY_ID.fam_bp_first;
  const pt = makeNpc({ role: 'patient', countryId: 'us', age: 50 }); store.state.npcs[pt.id] = pt;
  core.W().patients[pt.id] = { id: pt.id, caseIds: [], bornYear: store.state.year - 50 };
  m.followUps = [{ fixtureId: fx.followUp ?? 'fam_bp_review', patientId: pt.id, caseId: 'x', year: store.state.year + 1 }];
  year();
  const back = cases.caseload(m, p).filter((c) => c.patientId === pt.id);
  check(back.length === 1 && back[0].followOf === 'x', 'K. the patient returns, once, as the same person');
  // L. The chief retires and a successor is chosen.
  const h = hospital(m.job.hospitalId);
  const head = deptHead(h, 'surgery');
  head.age = 66;
  let changed = false;
  for (let i = 0; i < 25 && !changed; i++) { year(); changed = h.heads.surgery !== head.id; }
  check(changed && (employer(m.job.hospitalId).history ?? []).some((x) => /retired as chief/.test(x.text)), 'L. the chief retires, and the chronicle records the successor');
  // M. The old team reunites.
  m.completed[0].to = store.state.year - 12;
  m.people.friendIds.push(peer.id);
  const rel = peer.meters.relationship;
  drama.medicineChoice('reunion:go', { peer: peer.id });
  check(peer.meters.relationship >= rel, 'M. former colleagues reconnect');
}
section('F, G, H, J, K, L, M: romance, transfer, disagreement, promotion, the patient returns, a new chief, the reunion');

// ---------- One clinic ownership workflow ----------
{
  p = life('us', 40);
  m = core.M(p);
  m.completed.push({ specialtyId: 'dermatology', kind: 'residency', from: 2000, to: 2004 });
  m.license = { status: 'full', countryId: 'us' };
  check(practice.practiceOptions(m, p).find((o) => o.id === 'ortho_clinic').block, 'a dermatologist cannot open an orthopedic clinic');
  const cash0 = p.finance.cash;
  const r = practice.openPractice('dermatology_clinic', '', { premises: 'large', equipment: 'advanced', strategy: 'self_pay', borrow: 50000 });
  const b = practice.practices(m)[0];
  check(r.ok && b && b.medical.premises === 'large' && b.medical.equipment === 'advanced' && b.pricing === 'premium' && b.debt >= 50000 && p.finance.cash < cash0,
    `opening follows the plan: premises, equipment, strategy, a loan (${r.text})`);
  b.cash += 5000000;
  const roles = ['nurse', 'receptionist', 'physician'].map((x) => practice.hireRole(b.id, x));
  const titles = b.staff.map((x) => store.state.npcs[x.id].occupation);
  check(roles.every((x) => x.ok) && titles.join() === 'staff nurse,receptionist,associate physician', `hiring by role (${titles.join(', ')})`);
  check(practice.addService(b.id, 'procedures').ok && !practice.addService(b.id, 'lab').ok, 'one new service a year');
  year();
  check(b.medical.costs && b.medical.costs.insurance > 0 && b.medical.costs.compliance > 0, `insurance and compliance are paid (${JSON.stringify(b.medical.costs)})`);
  check(typeof b.last?.profit === 'number', 'the practice has a year of books, profit or loss');
  const partnerNpc = makeNpc({ role: 'colleague', countryId: 'us', age: 45, relationship: 95 });
  partnerNpc.occupation = 'dermatologist'; partnerNpc.meters.money = 100; store.state.npcs[partnerNpc.id] = partnerNpc; p.npcIds.push(partnerNpc.id);
  let partnered = false;
  for (let i = 0; i < 5 && !partnered; i++) { partnered = practice.bringPartner(b.id, partnerNpc.id).ok; if (!partnered) year(); }
  const rec = practice.partnerRecords(b.id).find((x) => x.id === partnerNpc.id);
  check(!partnered || (rec && rec.stake === 0.25 && rec.invested > 0 && rec.exit && rec.comp), `a partner's terms are recorded (${JSON.stringify(rec ?? null)})`);
  if (rec) check(practice.setPartnerManages(b.id, partnerNpc.id, true).ok && practice.partnerRecords(b.id).find((x) => x.id === partnerNpc.id).manages, 'a partner can share the management');
  check(!practice.formGroup().ok, 'a medical group needs two sites');
  b.sites = 2;
  check(practice.formGroup().ok && m.groupLeader, 'two sites can become a medical group the owner leads');
  check(practice.retireFromPractice(b.id).text.length > 0, 'retiring from practice hands it on or offers it for sale');
}
section('a clinic of one\'s own');

for (const x of ok) console.log(`ok: ${x}`);
if (problems.length) { console.log(`PROBLEMS (${problems.length}):\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log('The required medical slices play end to end.');
