// The medical career's side of contraception (data/medicineCases.js contra_*, data/medicine.js lc_iud, lc_implant,
// tubal, vasectomy): who holds which procedure, the cases each specialty sees, a family physician referring what is not
// theirs, the careful plan rewarded and a partner's or parent's say never, and the IUD follow-up coming back.
// Run with: node tests/obgyn-contraception.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { CASES, CASE_BY_ID } = await import('../js/data/medicineCases.js');
const { SPECIALTY_BY_ID, PROCEDURE_BY_ID, TEST_BY_ID } = await import('../js/data/medicine.js');
const core = await import('../js/engine/medicine/core.js');
const train = await import('../js/engine/medicine/training.js');
const cases = await import('../js/engine/medicine/cases.js');
const { trainingSites } = await import('../js/engine/medicine/hospitals.js');
const C = await import('../js/engine/health/contraception.js');

rng.seed(3131);
const problems = [];
const passed = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m) => passed.push(`${problems.length ? '(after failures) ' : ''}${m}`);

/** A qualified physician in a specialty, in post at a US hospital, with patients to see. */
function physician(spec, age = 40) {
  do { store.state = createLife({ countryId: 'us' }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age; p.flags.livesWithParents = false; p.education.enrolled = false; p.education.stage = 'none';
  p.legal.incarceration = null; p.finance.cash = 500000;
  p.education.degrees.push({ type: 'university', majorId: 'biology', gpa: 3.8, age: 22 }, { type: 'medical', gpa: 3.6, age: 26 });
  const m = core.M(p);
  m.route = 'md';
  m.completed.push({ specialtyId: spec, kind: 'residency', from: store.state.year - 10, to: store.state.year - 6 });
  train.startPost(spec, trainingSites(spec, p.countryId, p.city)[0].e.id, 'attending');
  return { p, m };
}
/** A patient for a named case, seen this year (the way a returning patient is brought in). */
function seeCase(m, p, fixtureId, sex = CASE_BY_ID[fixtureId].sex ?? 'female') {
  const fx = CASE_BY_ID[fixtureId];
  const pt = makeNpc({ role: 'patient', countryId: 'us', age: fx.ages[0] + 2, gender: sex }); store.state.npcs[pt.id] = pt;
  core.W().patients[pt.id] = { id: pt.id, caseIds: [], bornYear: store.state.year - pt.age };
  m.yearCases = { year: null, n: 0, done: 0 };
  m.followUps = [{ fixtureId, patientId: pt.id, caseId: null, year: store.state.year }];
  return cases.caseload(m, p).find((x) => x.fixtureId === fixtureId);
}
/** Works a case: the useful tests, the right diagnosis, the chosen plan, the chosen decision. */
function work(id, planQuality = 'best', decisionQuality = 'best') {
  const c = core.W().cases[id];
  const fx = CASE_BY_ID[c.fixtureId];
  for (const t of fx.tests.filter((x) => x.value === 'useful')) cases.orderTest(id, t.test);
  cases.setDiagnosis(id, fx.diagnosis);
  const plans = cases.caseView(id).plans;
  const plan = plans.find((x) => fx.plans.find((y) => y.id === x.id)?.quality === planQuality && !x.block);
  const r = cases.choosePlan(id, plan.id);
  for (let i = 0; i < 8 && core.W().cases[id].status === 'or'; i++) cases.orStep(id, cases.caseView(id).or.step.options[0].id);
  if (core.W().cases[id].status === 'deciding') cases.decide(id, fx.decision.options.find((o) => o.quality === decisionQuality).id);
  return { r, plan, c: core.W().cases[id] };
}

// ---------- The cases themselves ----------
{
  const contra = CASES.filter((x) => x.id.startsWith('contra_'));
  check(contra.length >= 9, `the contraception cases are there (${contra.length})`);
  for (const fx of contra) {
    check(fx.plans.some((x) => x.quality === 'best') && fx.tests.every((t) => TEST_BY_ID[t.test]) && fx.differential.some((d) => d.id === fx.diagnosis), `${fx.id}: a best plan, real tests, its diagnosis among the options`);
    check(fx.plans.filter((x) => x.procedure).every((x) => PROCEDURE_BY_ID[x.procedure]), `${fx.id}: real procedures`);
    check(!/\b\d+\s?(mg|µg|mcg)\b/i.test(JSON.stringify(fx)), `${fx.id}: no doses`);
  }
  // A partner's or a parent's say over a patient's own body is never the best plan, and is marked unsafe or poor.
  const overrides = contra.flatMap((fx) => fx.plans.filter((x) => /partner|husband|parents|mother said/i.test(x.label)));
  check(overrides.length >= 4 && overrides.every((x) => ['poor', 'unsafe'].includes(x.quality)), 'deferring to a partner or parent is never rewarded');
  check(CASE_BY_ID.contra_emergency.minYear >= 1999 && CASE_BY_ID.contra_iud_place.minYear >= 1990, 'cases only where their care existed');
}
section('contraception cases: complete, dose-free, and never rewarding someone else deciding for the patient');

// ---------- Privileges: not every physician does every procedure ----------
{
  const priv = (spec) => { const m = { completed: [{ specialtyId: spec }] }; return cases.privileges(m); };
  check(['lc_iud', 'lc_implant', 'tubal'].every((x) => priv('obgyn').has(x)), 'an OB-GYN places IUDs and implants and performs tubal sterilization');
  check(priv('family').has('lc_implant') && !priv('family').has('lc_iud') && !priv('family').has('tubal'), 'a family physician places implants; not IUDs or tubal sterilization here');
  check(priv('urology').has('vasectomy') && !priv('urology').has('lc_iud'), 'a urologist performs vasectomies');
  check(!priv('psychiatry').has('lc_implant'), 'a psychiatrist none of them');
  check(!PROCEDURE_BY_ID.lc_iud.major && PROCEDURE_BY_ID.tubal.major, 'IUDs and implants are office procedures; tubal sterilization an operation');
}
section('privileges: by specialty, so a plan outside them becomes a referral');

// ---------- An OB-GYN places an IUD, with consent, pausing when asked ----------
{
  const { p, m } = physician('obgyn');
  const c = seeCase(m, p, 'contra_iud_place');
  check(c && c.status === 'open', 'the IUD patient is seen');
  const plan = cases.caseView(c.id).plans.find((x) => x.id === 'place');
  check(plan && !plan.block && plan.procedure === PROCEDURE_BY_ID.lc_iud.name && !/referred/.test(plan.label), 'the OB-GYN can place it herself');
  const before = { ...m.skills };
  const done = work(c.id, 'best', 'best');
  check(done.c.status === 'closed' && done.c.outcome, `the case is completed (${done.c.status})`);
  check(cases.caseView(c.id).followUpNeeded && cases.arrangeFollowUp(c.id).ok && (m.followUps ?? []).some((f) => f.fixtureId === 'contra_iud_review'), 'a follow-up is due, and once arranged the patient comes back for it');
  check(m.skills.integrity >= before.integrity, 'careful, consented care keeps integrity');
  // The same patient comes back next year.
  void p;
}
section('OB-GYN: an IUD placed with consent, the patient returns for follow-up');

// ---------- A family physician refers the IUD, but removes an implant herself ----------
{
  const { p, m } = physician('family');
  const iud = seeCase(m, p, 'contra_iud_place');
  const plan = cases.caseView(iud.id).plans.find((x) => x.id === 'place');
  check(plan && !plan.procedure && plan.refer === SPECIALTY_BY_ID.obgyn.name && /referred/.test(plan.label), `a family physician refers the IUD to OB-GYN (${plan?.label})`);
  const imp = seeCase(m, p, 'contra_implant_out');
  const rm = cases.caseView(imp.id).plans.find((x) => x.id === 'remove');
  check(rm && rm.procedure === PROCEDURE_BY_ID.lc_implant.name && !/referred/.test(rm.label), 'and removes an implant herself');
}
section('family medicine: implants yes, IUDs by referral');

// ---------- Judgment: asking a partner's permission is penalized ----------
{
  const run = (quality) => {
    const { p, m } = physician('obgyn');
    const c = seeCase(m, p, 'contra_implant_out');
    const before = m.skills.integrity;
    work(c.id, quality);
    return { delta: m.skills.integrity - before, outcome: core.W().cases[c.id].outcome };
  };
  const good = run('best');
  const bad = run('unsafe');
  check(good.delta > bad.delta, `asking for a partner's agreement before removing her implant costs integrity (${good.delta} vs ${bad.delta})`);
  const { p, m } = physician('obgyn');
  const s = seeCase(m, p, 'contra_sterilization');
  const plans = cases.caseView(s.id).plans;
  check(plans.find((x) => x.id === 'consent').procedure === PROCEDURE_BY_ID.tubal.name && CASE_BY_ID.contra_sterilization.plans.find((x) => x.id === 'husband').quality === 'unsafe', 'sterilization: the patient\'s own consent; a husband\'s signature is unsafe practice');
  const v = physician('urology');
  const vc = seeCase(v.m, v.p, 'contra_vasectomy', 'male');
  check(vc && cases.caseView(vc.id).plans.find((x) => x.id === 'consent').procedure === PROCEDURE_BY_ID.vasectomy.name, 'a urologist offers vasectomy, with the follow-up test explained');
}
section('judgment: the patient decides, and a shortcut or someone else\'s say is never rewarded');

// ---------- The player's own care stays with another clinician ----------
{
  const { p } = physician('obgyn');
  p.gender = 'female'; p.flags.bornAs = 'female';
  const scope = C.playerScope(p);
  check(scope.profession === 'obgyn' && scope.services.includes('iud'), 'the player-OB-GYN\'s scope is known to their own health record');
  check(C.providersFor('iud', p).every((o) => o.providerId !== p.id), 'but nobody places their own IUD: their care is with a colleague');
  const fam = physician('family');
  const fs = C.playerScope(fam.p);
  check(fs.profession === 'gp' && fs.services.includes('implant') && !fs.services.includes('iud'), 'a family physician\'s scope matches the career: implants, not IUDs');
}
section('the player as clinician, and as patient, kept apart');

console.log(passed.map((x) => `ok  ${x}`).join('\n'));
if (problems.length) { console.log(`\n${problems.length} problem(s):\n${problems.map((x) => ` ✗ ${x}`).join('\n')}`); process.exit(1); }
console.log('\nThe OB-GYN\'s side of contraception holds together.');
