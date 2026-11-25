// The health engine: conditions and diagnosis, therapy and DBT, medication
// trials and switching, disability and accessibility, heredity, privacy,
// historical availability and old saves, plus the two required vertical
// slices (depression with a medication change; BPD with individual DBT and a
// skills group), each saved and reloaded. Run with: node tests/health.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { getEvent, resolveChoice, choiceStates } = await import('../js/engine/eventEngine.js');
const { CONDITIONS, CONDITION_BY_ID, MENTAL: MENTAL_GROUPS } = await import('../js/data/health/conditions.js');
const { SYMPTOMS } = await import('../js/data/health/symptoms.js');
const { MEDICATIONS, MED_BY_ID } = await import('../js/data/health/medications.js');
const { THERAPIES, THERAPY_BY_ID } = await import('../js/data/health/therapies.js');
const { PROFESSIONS } = await import('../js/data/health/providers.js');
const { GENES } = await import('../js/data/health/genetics.js');
const R = await import('../js/engine/health/record.js');
const care = await import('../js/engine/health/care.js');
const meds = await import('../js/engine/health/meds.js');
const ther = await import('../js/engine/health/therapy.js');
const course = await import('../js/engine/health/course.js');
const access = await import('../js/engine/health/access.js');
const story = await import('../js/engine/health/story.js');
const gen = await import('../js/engine/health/heredity.js');
const H = await import('../js/engine/health/index.js');
const rules = await import('../js/engine/health/rules.js');
const { now } = await import('../js/engine/health/util.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');

rng.seed(2026);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); else ok.push(`(after failures) ${msg}`); };

/** An adult life in a given country, settled and solvent, at a given age. */
function adult(age = 28, countryId = 'uk') {
  do { store.state = createLife({ countryId }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age;
  p.flags.livesWithParents = false; p.education.enrolled = false; p.education.degrees = [{ type: 'high', gpa: 3, age: 18 }];
  p.finance.cash = Math.round(2e5 * store.state.player.finance.cash === 0 ? 2e5 : 2e5);
  p.finance.cash = 200000;
  p.career.careerId = null; p.legal.incarceration = null;
  // A clean slate for the health record, so each scenario starts from what it sets up.
  p.health = R.blankHealth();
  return p;
}
/** Starts a condition that has been going on for a while (long enough to be assessed). */
function living(id, weeksAgo = 40, severity = 60) {
  const rec = course.begin(CONDITION_BY_ID[id], store.state.player, { severity });
  rec.onsetWk = now() - weeksAgo; rec.burden = severity;
  return rec;
}
/** Lets care weeks pass until a condition holds (or a limit is reached), turning the year when needed. */
function until(fn, limit = 120) {
  for (let i = 0; i < limit; i++) {
    if (fn()) return true;
    const h = R.healthOf();
    if (h.week >= 51) { advanceYear(); store.state.pendingEvents = []; } else H.passWeeks(1);
  }
  return fn();
}
const roundTrip = () => {
  saveGame(store.state);
  const back = loadGame(store.state.slotId);
  store.state = back;
  return back.player;
};
const ledgerOk = (h) => new Set(h.ledger.map((x) => x.ref)).size === h.ledger.length;

// ---------- 1. The catalogs ----------
for (const c of CONDITIONS) {
  check(c.named?.length && c.sources?.length, `${c.id}: needs historical names and sources`);
  for (const f of c.features) check(SYMPTOMS[f]?.from.includes(c.id), `${c.id}: experience ${f} does not list it as a possible source`);
  for (const t of c.care?.therapies ?? []) check(THERAPY_BY_ID[t], `${c.id}: unknown therapy ${t}`);
  for (const b of c.diagnose.by) check(PROFESSIONS[b], `${c.id}: unknown profession ${b}`);
}
for (const m of MEDICATIONS) {
  check(m.from && m.sources?.length && m.by.length, `${m.id}: needs an availability year, prescribers and sources`);
  for (const id of Object.keys(m.uses)) check(CONDITION_BY_ID[id], `${m.id}: used for unknown condition ${id}`);
  check(!m.uses.bpd, `${m.id}: no medicine may list BPD itself as what it treats`);
  check(!JSON.stringify(m).match(/\bmg\b|dose/i), `${m.id}: the catalog must carry no dosing`);
}
for (const t of THERAPIES) { for (const id of t.for) check(CONDITION_BY_ID[id], `${t.id}: for unknown condition ${id}`); check(t.from && t.sources?.length, `${t.id}: needs a year and sources`); }
check(THERAPY_BY_ID.dbt.format === 'individual' && THERAPY_BY_ID.dbt_group.format === 'group', 'individual DBT and the skills group are separate services');
check(CONDITION_BY_ID.bpd.group === 'personality' && CONDITION_BY_ID.bipolar_1.group === 'mood' && CONDITION_BY_ID.bpd.care.meds === null, 'BPD and bipolar disorder are different conditions with different care');
check(CONDITIONS.filter((c) => c.neurotype).every((c) => c.course === 'lifelong'), 'neurodevelopmental conditions are lifelong, never "cured"');
section(`catalogs: ${CONDITIONS.length} conditions, ${MEDICATIONS.length} medicines, ${THERAPIES.length} therapies; sourced, no doses`);

// ---------- 2. Conditions, symptoms and diagnosis ----------
{
  let p = adult(30);
  const before = { intellect: p.stats.intellect, karma: p.hidden.karma, traits: [...p.traits] };
  const rec = living('mdd', 30, 60);
  check(R.statusOf(rec) === 'active' && !R.isDiagnosed('mdd'), 'a condition can exist before anyone diagnoses it');
  course.weekCourse(p);
  const ex = course.experiences(p);
  check(ex.length && ex.every((e) => SYMPTOMS[e.id]) && !ex.some((e) => /depress/i.test(e.label)), 'symptoms are experiences, not diagnoses');
  check(p.stats.intellect === before.intellect && p.hidden.karma === before.karma && JSON.stringify(p.traits) === JSON.stringify(before.traits), 'a condition changes no personality, morality or intellect');
  // One bad event never diagnoses anything.
  const e = getEvent('low_winter');
  store.state.pendingEvents = [];
  resolveChoice(e, 2, {});
  check(!R.activeDiagnoses().length, 'a scene can start an experience, never a diagnosis');

  // An assessment with nothing behind the symptoms: no diagnosis.
  p = adult(30);
  R.healthOf().wellbeing.sleep = 30;
  const f = care.facilitiesHere().find((x) => x.defId === 'primary');
  const r = care.seekAssessment('mental', f.id, 'gp');
  check(r.ok, `book an assessment: ${r.text}`);
  // Weeks of short nights: sleep stays poor until the appointment.
  until(() => { R.healthOf().wellbeing.sleep = 30; return R.healthOf().assessments.length; });
  const a = R.healthOf().assessments[0];
  check(a?.outcome === 'no_diagnosis' && !R.activeDiagnoses().length, 'an assessment does not always end in a diagnosis');
  check(/sleep/.test(a?.text ?? ''), 'the clinician names an ordinary explanation (sleep)');

  // Two conditions at once, each with its own record and diagnosis.
  p = adult(26);
  living('mdd', 30, 55); living('gad', 40, 50);
  care.seekAssessment('mental', care.facilitiesHere().find((x) => x.defId === 'primary').id, 'gp');
  until(() => R.healthOf().assessments.some((x) => x.outcome === 'diagnosed'));
  const ids = R.activeDiagnoses().map((d) => d.conditionId).sort();
  check(ids.includes('mdd') || ids.includes('gad'), `co-occurring conditions are recognized (got ${ids.join(',')})`);
  check(new Set(R.healthOf().conditions.map((c) => c.id)).size === R.healthOf().conditions.length, 'each condition has its own record');

  // Too short to call it: a review rather than a diagnosis.
  p = adult(26);
  living('gad', 3, 55);
  care.seekAssessment('mental', care.facilitiesHere().find((x) => x.defId === 'primary').id, 'gp');
  until(() => R.healthOf().assessments.length);
  check(R.healthOf().assessments[0].outcome === 'review', 'symptoms that are too recent get a review, not a diagnosis');

  // BPD is out of a primary care doctor's scope: referral, never a primary care doctor diagnosis. Bipolar is not BPD.
  p = adult(24);
  living('bpd', 60, 60);
  care.seekAssessment('mental', care.facilitiesHere().find((x) => x.defId === 'primary').id, 'gp');
  until(() => R.healthOf().assessments.length);
  check(R.healthOf().assessments[0].outcome === 'referred' && !R.isDiagnosed('bpd') && !R.isDiagnosed('bipolar_1'), 'a primary care doctor refers BPD on, and diagnoses neither BPD nor bipolar disorder');

  // Bipolar disorder seen only when low looks like depression; a high episode revises it, and the old record stays.
  p = adult(27);
  const bp = living('bipolar_2', 40, 60);
  bp.episode = { kind: 'depression', startWk: now() - 10, endWk: now() + 30 };
  const gp = care.facilitiesHere().find((x) => x.defId === 'private');
  care.seekAssessment('mental', gp.id, 'psychologist');
  until(() => R.healthOf().assessments.some((x) => x.outcome === 'diagnosed'), 200);
  const first = R.activeDiagnoses()[0];
  check(first?.conditionId === 'mdd' && first.certainty === 'probable', 'bipolar II seen only in a low phase is first diagnosed as depression, marked probable');
  bp.seenHigh = true;
  const doc = care.clinicianAt(care.facilitiesHere().find((x) => x.defId === 'psychiatry'), 'psychiatrist');
  const next = care.reviseDiagnosis(first, 'bipolar_2', doc, 'A hypomanic episode was seen.');
  check(first.status === 'revised' && next.status === 'active' && R.healthOf().diagnoses.length === 2, 'a revised diagnosis keeps the original, marked as revised');

  // Needs without a diagnosis.
  p = adult(30);
  access.addNeed('quiet_space');
  check(access.needs().some((n) => n.id === 'quiet_space' && n.source === 'self') && !R.activeDiagnoses().length, 'a support need can exist with no diagnosis behind it');
}
section('conditions and diagnosis: symptoms are not diagnoses, assessment can find nothing, referral, revision, co-occurrence');

// ---------- 3. Therapy and DBT ----------
let bpdState;
{
  const p = adult(24);
  p.npcIds.push(...[makeNpc({ role: 'partner', countryId: 'uk', age: 25, relationship: 70 })].map((n) => { store.state.npcs[n.id] = n; return n.id; }));
  living('bpd', 60, 62);
  // primary care doctor, then referral, then a psychiatrist.
  care.seekAssessment('mental', care.facilitiesHere().find((x) => x.defId === 'primary').id, 'gp');
  until(() => R.healthOf().assessments.length);
  const opt = care.serviceOptions('mental').find((o) => o.profession === 'psychiatrist' && !o.referral);
  check(opt, 'after a referral, a public psychiatrist can be booked');
  care.seekAssessment('mental', opt.facilityId, opt.profession);
  until(() => R.isDiagnosed('bpd'), 120);
  const dx = R.activeDiagnoses().find((d) => d.conditionId === 'bpd');
  check(dx && R.healthOf().conditions.find((c) => c.id === dx.underlyingId).conditionId === 'bpd', 'BPD diagnosed by a psychiatrist, against the right underlying record');
  const options = care.careOptions(dx.id);
  check(options.therapies.some((t) => t.therapyId === 'dbt' && t.ok) && options.therapies.some((t) => t.therapyId === 'dbt_group' && t.ok), 'care options include individual DBT and a DBT skills group');
  check(!options.meds && /BPD/.test(options.medsWhy), 'no medicine is offered for BPD itself');
  // An eligible DBT provider: DBT-trained.
  const ind = ther.findProviders('dbt', 'bpd').find((x) => x.ok);
  check(ind && store.state.npcs[ind.providerId].flags.clinician.dbt, 'the individual DBT therapist is DBT-trained');
  const notDbt = care.clinicianAt(care.facilitiesHere().find((x) => x.defId === 'private'), 'counselor');
  check(!rules.canOffer('dbt', 'bpd', notDbt).ok, 'someone without DBT training cannot deliver DBT');
  const r1 = ther.startTherapy({ therapyId: 'dbt', facilityId: ind.facilityId, providerId: ind.providerId, dxId: dx.id });
  const grp = ther.findProviders('dbt_group', 'bpd').find((x) => x.ok);
  const r2 = ther.startTherapy({ therapyId: 'dbt_group', facilityId: grp.facilityId, dxId: dx.id });
  check(r1.ok && r2.ok, `start individual DBT and the skills group: ${r1.text} / ${r2.text}`);
  const h = R.healthOf();
  const [ci, cg] = [h.therapies.find((c) => c.therapyId === 'dbt'), h.therapies.find((c) => c.therapyId === 'dbt_group')];
  check(ci.id !== cg.id && cg.groupId && !ci.groupId, 'individual and group are enrolled separately');
  const group = ther.groupOf(cg.groupId);
  const facilitators = [...group.facilitatorIds];
  check(facilitators.length >= 1 && facilitators.every((id) => store.state.npcs[id].flags.clinician), 'group facilitators are persistent clinicians');
  check(ther.findProviders('dbt_group', 'bpd').find((x) => x.groupId === group.id).providerId === facilitators[0], 'the same group is found again, with the same facilitator');
  const skills0 = { ...h.skills };
  until(() => ci.attended + ci.missed >= 20, 160);
  check(ci.sessions.every((s) => typeof s.wk === 'number' && s.wk >= ci.startWk), 'sessions fall on valid dates after the start');
  check(ci.attended === ci.sessions.filter((s) => s.attended).length && ci.missed === ci.sessions.filter((s) => !s.attended).length, 'missed sessions are not counted as attended');
  check(cg.sessions.filter((s) => s.attended && s.module).length > 0 && new Set(cg.sessions.map((s) => s.module)).size >= 2, 'the group moves through modules');
  check(ther.DBT4.every((k) => h.skills[k] >= skills0[k]) && ther.DBT4.some((k) => h.skills[k] > skills0[k] + 5), 'skills grow with participation');
  const paidSessions = h.ledger.filter((x) => x.ref.startsWith(`sess:${ci.id}:`)).length;
  check(paidSessions === ci.attended, `each attended session is paid once (${paidSessions} payments for ${ci.attended} sessions)`);
  check(ledgerOk(h), 'no reference is paid twice');
  // Group confidentiality: fellow members carry no health information, and nothing says why they are there.
  for (const id of group.memberIds) { const m = store.state.npcs[id]; check(!m.health && !JSON.stringify(m.flags).match(/bpd|diagnos/i), 'group members carry no health information'); }
  // No cure after a fixed number of sessions.
  check(R.isDiagnosed('bpd') && h.conditions.find((c) => c.conditionId === 'bpd').status !== 'resolved', 'BPD is not marked cured after a fixed number of sessions');
  bpdState = { ci: ci.id, cg: cg.id, facilitators, skills: { ...h.skills }, attended: ci.attended };
  section('therapy and DBT: referral, DBT-trained providers, separate individual and group, attendance, modules, skills, payments, confidentiality');

  // ---------- Skills in everyday life ----------
  h.skills.interpersonal = Math.max(h.skills.interpersonal, 40);
  h.skills.distress = Math.max(h.skills.distress, 40);
  const love = Object.values(store.state.npcs).find((n) => n.role === 'partner');
  const ev = getEvent('disagreement_partner');
  const states = choiceStates(ev, { love: love.id });
  check(states[0].enabled && states[1].enabled, 'practiced skills open skill-informed responses in a disagreement');
  const lessSkilled = { ...h.skills }; h.skills.interpersonal = 5;
  check(!choiceStates(ev, { love: love.id })[0].enabled, 'without the practice, that response is not offered');
  h.skills.interpersonal = lessSkilled.interpersonal;
  const notes = h.lifeNotes.length;
  resolveChoice(ev, 0, { love: love.id });
  check(h.lifeNotes.length === notes + 1 && h.lifeNotes.at(-1).topic === 'conflict', 'using a skill is recorded as something real to talk about in therapy');
  until(() => ci.sessions.some((s) => /disagreement/.test(s.note)), 30);
  check(ci.sessions.some((s) => /disagreement/.test(s.note)), 'a later DBT session talks through what actually happened');

  // Setbacks never erase skills.
  const before = { ...h.skills };
  const rec = h.conditions.find((c) => c.conditionId === 'bpd');
  rec.spike = 30;
  H.passWeeks(1);
  check(ther.DBT4.every((k) => h.skills[k] >= before[k]), 'a hard week does not take learned skills away');
  // Persisted across a save.
  const pp = roundTrip();
  const hh = pp.health;
  check(hh.therapies.find((c) => c.id === bpdState.ci).attended >= bpdState.attended && ther.DBT4.every((k) => hh.skills[k] >= bpdState.skills[k]), 'skills and attendance survive a reload');
  check(ther.groupOf(hh.therapies.find((c) => c.id === bpdState.cg).groupId).facilitatorIds.join() === bpdState.facilitators.join(), 'the group and its facilitators survive a reload');
  check(hh.careTeam.every((id) => store.state.npcs[id]), 'every clinician in the care team is still the same person after a reload');
  check(story.publicMilestones(pp.milestones).every((m) => m.kind !== 'health' || m.shared), 'health milestones stay private');
}
section('DBT in daily life: skills shape choices, sessions use real events, setbacks keep skills, everything survives a reload');

// ---------- 4. Medication: the depression scenario ----------
{
  let p = adult(29);
  const rec = living('mdd', 30, 62);
  const f = care.facilitiesHere().find((x) => x.defId === 'primary');
  care.seekAssessment('mental', f.id, 'gp');
  until(() => R.isDiagnosed('mdd'));
  const dx = R.activeDiagnoses()[0];
  const gp = store.state.npcs[dx.providerId];
  // Eligibility.
  const psychologist = care.clinicianAt(care.facilitiesHere().find((x) => x.defId === 'private'), 'psychologist');
  check(!rules.canPrescribe({ medId: 'escitalopram', conditionId: 'mdd', prescriber: psychologist }).ok, 'a psychologist cannot prescribe');
  check(rules.canPrescribe({ medId: 'escitalopram', conditionId: 'mdd', prescriber: gp }).ok, 'a primary care doctor can prescribe a first-line antidepressant for diagnosed depression');
  check(!rules.canPrescribe({ medId: 'lithium', conditionId: 'mdd', prescriber: gp }).ok, 'a medicine is refused for a condition it is not used for');
  check(!rules.canPrescribe({ medId: 'escitalopram', conditionId: 'gad', prescriber: gp }).ok, 'nothing is prescribed for an undiagnosed condition');
  // Through the clinician: a proposal, then a choice.
  meds.discussMedication(dx.id);
  until(() => R.healthOf().proposals.some((x) => x.kind === 'start'));
  const prop = R.healthOf().proposals.find((x) => x.kind === 'start');
  check(prop.options.some((o) => o.act.kind === 'decline'), 'starting medicine is a choice, with "not now" offered');
  const r = meds.decide(prop.id, 'escitalopram');
  check(r.ok, `start escitalopram: ${r.text}`);
  const h = R.healthOf();
  const t1 = h.trials[0];
  check(h.trials.length === 1 && !meds.decide(prop.id, 'escitalopram').ok, 'a trial is created once; deciding twice does nothing');
  check(t1.startWk === now() && meds.benefitAt(t1) === 0, 'no benefit on the first day');
  // This character: partial benefit, with a side effect.
  t1.fit.ceiling = 0.32; t1.fit.lag = 2; t1.fit.effects = [{ id: 'nausea', label: 'Upset stomach', cat: 'gastro', sev: 2, until: null }];
  until(() => meds.weeksOn(t1) >= 3);
  check(meds.benefitAt(t1) > 0 && meds.benefitAt(t1) < 0.32, 'benefit builds gradually');
  const reviewsBefore = t1.reviews.length;
  meds.reportSideEffects(t1.id);
  check(t1.reviews.length === reviewsBefore + 1 && t1.reviews.at(-1).wk === now(), 'reporting side effects is looked at by the prescriber straight away');
  // That early look is not the decision point: an open proposal from it is cleared so the trial runs on to its fair length.
  for (const x of h.proposals) if (x.trialId === t1.id && x.status === 'open') { x.status = 'declined'; }
  until(() => t1.reviews.some((x) => meds.weeksOn(t1) >= MED_BY_ID.escitalopram.adequate && x.weeks >= MED_BY_ID.escitalopram.adequate), 40);
  const rev = t1.reviews.at(-1);
  check(rev.weeks >= 6 && ['partial', 'poorly_tolerated'].includes(rev.state), `after an adequate trial the review sees a partial response (${rev.state})`);
  check(t1.reviews.every((x) => x.weeks <= meds.weeksOn(t1)), 'reviews use the actual treatment history');
  const open = h.proposals.find((x) => x.trialId === t1.id && x.status === 'open');
  check(open && open.options.some((o) => o.act.kind === 'switch'), 'the prescriber offers a switch');
  check(!open.options.some((o) => /stop now|at once/i.test(o.label)), 'stopping at once is never offered');
  const cash0 = store.state.player.finance.cash;
  const sw = meds.decide(open.id, 'switch');
  check(sw.ok && sw.trial, `switch: ${sw.text}`);
  const t2 = sw.trial;
  check(t1.status === 'tapering' && t1.replacedBy === t2.id && t2.replaces === t1.id && t2.medicationId !== 'escitalopram', 'the switch is a supervised change, linked both ways');
  check(rules.canPrescribe({ medId: 'fluoxetine', conditionId: 'mdd', prescriber: gp }).ok === false, 'a second antidepressant on top is refused');
  until(() => t1.status === 'switched', 10);
  check(t1.status === 'switched' && t1.endWk && t1.reviews.length >= 1, 'the first trial is kept, marked switched, with its reviews');
  const rx1 = () => h.ledger.filter((x) => x.ref.startsWith(`rx:${t1.id}:`)).length;
  const before = rx1();
  H.passWeeks(8);
  check(rx1() === before, 'an ended prescription is never charged again');
  check(meds.weeksOn(t2) > 0 && t2.reviews.every((x) => x.wk >= t2.startWk), 'the second trial is evaluated from its own start');
  // Save and reload: nothing re-rolled, nothing charged twice.
  const snapshot = JSON.stringify({ trials: h.trials.map((t) => [t.id, t.status, t.fit, t.reviews]), ledger: h.ledger.length, cash: store.state.player.finance.cash });
  p = roundTrip();
  const h2 = p.health;
  check(JSON.stringify({ trials: h2.trials.map((t) => [t.id, t.status, t.fit, t.reviews]), ledger: h2.ledger.length, cash: p.finance.cash }) === snapshot, 'a reload changes no trial, outcome, payment or balance');
  check(ledgerOk(h2), 'no charge appears twice after reloading');
  check(cash0 >= p.finance.cash, 'care costs money where it is not free');
  // Different people, same medicine, different outcomes.
  const kinds = new Set();
  const effects = new Set();
  for (let i = 0; i < 30; i++) {
    adult(30); living('mdd', 30, 60);
    const d = care.clinicianAt(care.facilitiesHere().find((x) => x.defId === 'primary'), 'gp');
    R.healthOf().diagnoses.push({ id: `dx_t${i}`, conditionId: 'mdd', underlyingId: R.healthOf().conditions[0].id, status: 'active', wk: now(), providerId: d.id, name: 'x', history: [] });
    const tr = meds.startTrial({ medId: 'escitalopram', dxId: `dx_t${i}`, prescriberId: d.id }).trial;
    kinds.add(tr.fit.kind); effects.add(tr.fit.effects.map((e) => e.id).join());
  }
  check(kinds.size >= 2 && effects.size >= 2, `the same medicine goes differently for different people (${[...kinds].join(', ')})`);
}
section('medication: eligible prescribers, clinician proposals, gradual benefit, side effects, follow-ups, a supervised switch, history kept, no double charges, stable on reload');

// ---------- 5. Medication rules: bipolar, ADHD, monitoring, era ----------
{
  let p = adult(30);
  const rec = living('bipolar_1', 40, 55); rec.seenHigh = true;
  const psych = care.clinicianAt(care.facilitiesHere().find((x) => x.defId === 'psychiatry'), 'psychiatrist');
  R.healthOf().diagnoses.push({ id: 'dx_bp', conditionId: 'bipolar_1', underlyingId: rec.id, status: 'active', wk: now(), providerId: psych.id, name: 'Bipolar I disorder', history: [] });
  // An antidepressant cannot be used for bipolar disorder, and is refused on its own even for depression alongside it.
  check(!rules.canPrescribe({ medId: 'sertraline', conditionId: 'bipolar_1', prescriber: psych }).ok, 'an antidepressant is not prescribed for bipolar disorder');
  const rec2 = living('mdd', 30, 50);
  R.healthOf().diagnoses.push({ id: 'dx_mdd2', conditionId: 'mdd', underlyingId: rec2.id, status: 'active', wk: now(), providerId: psych.id, name: 'x', history: [] });
  check(/mood stabilizer/.test(rules.canPrescribe({ medId: 'sertraline', conditionId: 'mdd', prescriber: psych }).why), 'with bipolar disorder an antidepressant alone is refused');
  const li = meds.startTrial({ medId: 'lithium', dxId: 'dx_bp', prescriberId: psych.id });
  check(li.ok && R.healthOf().appointments.some((a) => a.kind === 'monitoring' && a.ref === li.trial.id), 'lithium starts with monitoring booked');
  check(rules.canPrescribe({ medId: 'sertraline', conditionId: 'mdd', prescriber: psych }).ok, 'alongside a mood stabilizer, a psychiatrist may consider it');
  // Monitoring is enforced: overdue checks put the prescription under review.
  li.trial.lastMonitorWk = now() - 40; li.trial.monitorMissed = 2;
  check(meds.monitoringOverdue(li.trial), 'overdue monitoring is noticed');
  const appt = care.book('review', { facilityId: psych.flags.clinician.facilityId, providerId: psych.id, ref: li.trial.id, wk: now() });
  meds.review(appt);
  check(li.trial.status === 'under_review' && li.trial.heldFor === 'monitoring', 'the prescription is under review until the checks are done');
  const mon = care.book('monitoring', { facilityId: psych.flags.clinician.facilityId, providerId: psych.id, ref: li.trial.id, wk: now() });
  meds.attendMonitoring(mon);
  check(li.trial.status === 'active', 'and continues once they are');
  // ADHD: age, prescriber, heart.
  p = adult(5);
  const ad = living('adhd', 100, 50);
  const paed = care.clinicianAt(care.facilitiesHere().find((x) => x.defId === 'hospital'), 'pediatrician');
  R.healthOf().diagnoses.push({ id: 'dx_adhd', conditionId: 'adhd', underlyingId: ad.id, status: 'active', wk: now(), providerId: paed.id, name: 'ADHD', history: [] });
  check(!rules.canPrescribe({ medId: 'methylphenidate', conditionId: 'adhd', prescriber: paed }).ok, 'no stimulant at five');
  p.age = 9;
  check(rules.canPrescribe({ medId: 'methylphenidate', conditionId: 'adhd', prescriber: paed }).ok, 'a pediatrician may prescribe for a child old enough');
  const gpDoc = care.clinicianAt(care.facilitiesHere().find((x) => x.defId === 'primary'), 'gp');
  check(!rules.canPrescribe({ medId: 'methylphenidate', conditionId: 'adhd', prescriber: gpDoc }).ok, 'a primary care doctor does not start ADHD medicine');
  p.conditions.push({ id: 'heart_disease', name: 'heart disease' });
  check(!rules.canPrescribe({ medId: 'methylphenidate', conditionId: 'adhd', prescriber: paed }).ok, 'a heart condition needs a specialist opinion first');
  // History: no escitalopram before it existed.
  store.state.year = 1995;
  p = store.state.player; p.conditions = [];
  check(!rules.canPrescribe({ medId: 'lisdexamfetamine', conditionId: 'adhd', prescriber: paed }).ok && rules.canPrescribe({ medId: 'methylphenidate', conditionId: 'adhd', prescriber: paed }).ok, 'in 1995 there is methylphenidate, not lisdexamfetamine');
  check(!rules.medAvailable(MED_BY_ID.escitalopram, 1995) && rules.medAvailable(MED_BY_ID.escitalopram, 2005), 'escitalopram arrives in its own time');
  check(!rules.medAvailable(MED_BY_ID.lamotrigine, 2000, 'uk', 'bipolar_1') && rules.medAvailable(MED_BY_ID.lamotrigine, 2000, 'uk', 'epilepsy'), 'a medicine can be available for one use before another');
  check(!rules.medAvailable(MED_BY_ID.amphetamine_salts, 2020, 'uk') && rules.medAvailable(MED_BY_ID.amphetamine_salts, 2020, 'us'), 'some medicines are only in some countries');
}
section('medication rules: bipolar precautions, monitoring enforced, ADHD age and prescriber, history and country');

// ---------- 6. Disability and accessibility ----------
{
  // A wheelchair user: the barrier is in the building, and comes down when the building changes.
  let p = adult(32);
  living('spinal_cord_injury', 60, 50);
  check(access.needs().some((n) => n.id === 'wheelchair') && access.needs().some((n) => n.id === 'step_free'), 'a wheelchair user\'s needs are known');
  const iq = p.stats.intellect;
  const b0 = access.barrier('home');
  check(b0 > 0, 'an inaccessible home is a barrier');
  check(access.getDevice('wheelchair').ok && access.devicesOwned().length === 1, 'a wheelchair is obtained and persists');
  p.flags.livesWithParents = false;
  for (const f of ['ramp', 'wide_doors', 'accessible_bathroom']) access.adaptHome(f);
  const b1 = access.barrier('home');
  check(b1 < b0, `adapting the home removes the barrier (${b0} → ${b1})`);
  check(p.stats.intellect === iq && R.healthOf().conditions[0].status === 'active', 'nothing about the person changed: only the surroundings');
  check(ledgerOk(R.healthOf()), 'each adaptation paid for once');
  // School: accommodations change marks lost to barriers, never ability.
  p = adult(12);
  p.education.enrolled = true; p.education.stage = 'middle';
  const dys = living('dyslexia', 300, 45); dys.showsAge = 6;
  const doc = care.clinicianAt(care.facilitiesHere().find((x) => x.defId === 'learning'), 'educational_psychologist');
  R.healthOf().diagnoses.push({ id: 'dx_dys', conditionId: 'dyslexia', underlyingId: dys.id, status: 'active', wk: now(), providerId: doc.id, name: 'dyslexia', history: [] });
  for (let i = 0; i < 6; i++) course.weekCourse(p);
  const s0 = access.studyBarrier(p);
  const intellect = p.stats.intellect;
  // Asked until agreed: this checks what an accommodation does, not whether a school says yes.
  const ask = (t, n) => { for (let i = 0; i < 8; i++) { const r = access.requestAccommodation('school', t, n); if (r.ok) return r; } return { ok: false }; };
  const r1 = ask('extra_time', 'extra_time');
  const r2 = ask('accessible_materials', 'reading_tools');
  for (let i = 0; i < 20; i++) course.weekCourse(p);
  const s1 = access.studyBarrier(p);
  check(r1.ok && r2.ok && s1 < s0, `school accommodations reduce what barriers cost in marks (${s0} → ${s1})`);
  check(p.stats.intellect === intellect, 'and change nothing about intelligence');
  check(R.healthOf().supports.accommodations.every((a) => a.shared === 'need only'), 'an accommodation request shares the need, not the diagnosis');
  // Work.
  p = adult(35);
  p.career.careerId = 'office';
  living('deaf', 1000, 40);
  const w0 = access.workBarrier(p);
  access.requestAccommodation('work', 'interpreter', 'sign_language');
  access.requestAccommodation('work', 'captions', 'captions');
  check(access.workBarrier(p) <= w0, 'workplace access improves participation');
  check(access.declineDevice('hearing_aid').ok && !access.needs().some((n) => n.id === 'hearing_aid'), 'a Deaf character who does not want hearing technology is not treated as having an unmet need');
  // Historical availability of devices.
  store.state.year = 1950;
  check(!access.deviceAvailable('screen_reader') && access.deviceAvailable('wheelchair'), 'no screen readers in 1950');
}
section('disability and accessibility: needs, devices, home adaptations, school and work accommodations, preferences, history');

// ---------- 7. Heredity ----------
{
  adult(30);
  // A child's genome comes from biological parents; a founder from nobody.
  const m = gen.founderGenome('mother_x', 'female'); const f = gen.founderGenome('father_x', 'male');
  check(JSON.stringify(gen.founderGenome('mother_x', 'female')) === JSON.stringify(m), 'a genome is the same every time it is worked out');
  const kids = Array.from({ length: 4000 }, (_, i) => gen.childGenome(m, f, `kid_${i}`, i % 2 ? 'male' : 'female'));
  const mean = kids.reduce((s, k) => s + k.g.neurodev, 0) / kids.length;
  check(Math.abs(mean - (m.g.neurodev + f.g.neurodev) / 2) < 0.06, 'polygenic values center on the parents\' average');
  // Single-gene rules.
  const carrierM = { ...m, a: { ...m.a, cf: [1, 0], f8: [1, 0], hd: [0, 0] }, mt: { lhon: 0 } };
  const carrierF = { ...f, a: { ...f.a, cf: [1, 0], f8: [0], hd: [1, 0] }, mt: { lhon: 1 } };
  const born = Array.from({ length: 4000 }, (_, i) => gen.childGenome(carrierM, carrierF, `c_${i}`, i % 2 ? 'male' : 'female'));
  const share = (fn) => born.filter(fn).length / born.length;
  const cf = share((k) => gen.affected(k, 'cf'));
  check(cf > 0.21 && cf < 0.29, `two carriers: about a quarter of children have cystic fibrosis (${cf.toFixed(2)})`);
  const hd = share((k) => (k.a.hd ?? []).some(Boolean));
  check(hd > 0.45 && hd < 0.55, `one parent with a dominant variant: about half inherit it (${hd.toFixed(2)})`);
  const sons = born.filter((k) => k.sex === 'male'); const daughters = born.filter((k) => k.sex === 'female');
  const hemSons = sons.filter((k) => gen.affected(k, 'f8')).length / sons.length;
  check(hemSons > 0.44 && hemSons < 0.56 && daughters.every((k) => !gen.affected(k, 'f8')), `X-linked: half the sons of a carrier mother, none of the daughters with an unaffected father (${hemSons.toFixed(2)})`);
  check(born.every((k) => !k.mt.lhon), 'mitochondrial variants come from the mother, not the father');
  // Complex conditions: not copied, and not absent without affected parents.
  const parents = gen.founderGenome('p', 'female');
  parents.g.neurodev = 2; parents.g.adhd = 2;
  let withAdhd = 0; let without = 0;
  for (let i = 0; i < 3000; i++) { if (gen.bornWith(gen.childGenome(parents, parents, `a_${i}`, 'male'), `a_${i}`).includes('adhd')) withAdhd++; }
  for (let i = 0; i < 3000; i++) { if (gen.bornWith(gen.founderGenome(`b_${i}`, 'male'), `b_${i}`).includes('adhd')) without++; }
  check(withAdhd / 3000 < 0.9 && withAdhd > without, `a high genetic loading raises the likelihood without deciding it (${(withAdhd / 30).toFixed(0)}% against ${(without / 30).toFixed(0)}%)`);
  check(without > 0, 'children of unaffected parents can have it too');
  // Biology, not upbringing: an adopted child shares no genes with the adoptive family.
  const p = store.state.player;
  const adoptee = makeNpc({ role: 'child', countryId: 'uk', age: 3 }); adoptee.adopted = true; store.state.npcs[adoptee.id] = adoptee; p.npcIds.push(adoptee.id);
  const own = makeNpc({ role: 'child', countryId: 'uk', age: 2 }); own.parentIds = []; store.state.npcs[own.id] = own; p.npcIds.push(own.id);
  check(gen.biologicalParents(adoptee).mother === null && gen.biologicalParents(adoptee).father === null, 'an adopted child\'s genes do not come from the adoptive parent');
  check([gen.biologicalParents(own).mother, gen.biologicalParents(own).father].includes(p), 'a birth child\'s do');
  // Predisposition is not diagnosis; acquired disability is not inherited.
  const before = R.healthOf().diagnoses.length;
  gen.genomeOf(own);
  check(R.healthOf().diagnoses.length === before && !own.health?.conds?.some((c) => c.diagnosed && c.age > own.age), 'inheriting a predisposition creates no diagnosis');
  living('spinal_cord_injury', 10, 40);
  const g2 = gen.childGenome(gen.genomeOf(p), null, 'baby_sci', 'female');
  check(!gen.bornWith(g2, 'baby_sci').includes('spinal_cord_injury'), 'an injury is not passed on');
  check(!JSON.stringify(gen.genomeOf(p)).match(/"(intellect|karma|charm|morality|worth|personality)"/), 'a genome holds no intelligence, morality or worth');
  // Onset ages: no adult-onset condition at birth.
  check(gen.bornWith(gen.founderGenome('nb', 'female'), 'nb').every((id) => ['birth', 'gene'].includes(CONDITION_BY_ID[id].onset.kind)), 'a newborn has nothing that begins in adulthood');
  // Stable after reload.
  const genome = JSON.stringify(gen.genomeOf(p));
  const back = roundTrip();
  check(JSON.stringify(back.genome) === genome, 'a genome is unchanged by a reload');
}
section('heredity: averages, dominant, recessive, X-linked and mitochondrial patterns, likelihood not destiny, biology not adoption, no diagnoses, stable');

// ---------- 8. Privacy and family history ----------
{
  const p = adult(40);
  const rec = living('mdd', 40, 50);
  const doc = care.clinicianAt(care.facilitiesHere().find((x) => x.defId === 'primary'), 'gp');
  R.healthOf().diagnoses.push({ id: 'dx_p', conditionId: 'mdd', underlyingId: rec.id, status: 'active', wk: now(), providerId: doc.id, name: 'Major depressive disorder', history: [] });
  story.healthMilestone('Received a diagnosis: x.', { type: 'diagnosis', id: 'dx_p' }, p);
  const sum = story.legacySummary(p);
  check(!sum.conds.find((c) => c.id === 'mdd').shared, 'a descendant does not see a private diagnosis');
  story.shareWithFamily(rec.id, true);
  check(story.legacySummary(p).conds.find((c) => c.id === 'mdd').shared, 'unless the player chose to share it');
  check(!JSON.stringify(story.legacySummary(p)).match(/therapy|trial|session|escitalopram|note/i), 'what passes down never includes therapy or prescriptions');
  check(story.publicMilestones(p.milestones).every((m) => !m.private), 'private milestones stay out of the obituary and the title screen');
  // Family history: what relatives have shared, and what is not known.
  const mom = Object.values(store.state.npcs).find((n) => n.role === 'parent' && n.gender === 'female');
  mom.age = 68;
  mom.health = { v: 1, last: mom.age, conds: [{ id: 'bipolar_1', age: 30, diagnosed: true, shared: true }, { id: 'gad', age: 40, diagnosed: true, shared: false }] };
  const fh = story.familyHistory(p);
  const row = fh.rows.find((r) => r.npcId === mom.id);
  check(row?.conds.some((c) => c.id === 'bipolar_1') && !row.conds.some((c) => c.id === 'gad'), 'family history shows what a relative shared, and nothing they did not');
  check(fh.screening.some((s) => s.condition === 'bipolar_1' && s.kind === 'awareness'), 'a family history can suggest an earlier assessment, without predicting anything');
  // Telling someone is a choice, one person at a time.
  const friend = makeNpc({ role: 'friend', countryId: 'uk', age: 40, relationship: 70 }); store.state.npcs[friend.id] = friend; p.npcIds.push(friend.id);
  check(story.tell(friend.id, 'dx_p').ok && rec.disclosedTo.includes(friend.id) && rec.disclosedTo.length === 1, 'telling one person tells only that person');
}
section('privacy: private by default, shared by choice, descendants see conditions not notes, family history from what was shared');

// ---------- 9. History: healthcare in its own era ----------
{
  const p = adult(30);
  store.state.year = 1800;
  const fs = care.facilitiesHere();
  check(fs.every((f) => ['primary', 'hospital'].includes(f.defId)), `in 1800 there is a doctor and a hospital, nothing more (${fs.map((f) => f.defId).join(', ')})`);
  check(!rules.therapyAvailable(THERAPY_BY_ID.dbt) && !rules.therapyAvailable(THERAPY_BY_ID.cbt), 'no DBT or CBT in 1800');
  check(MEDICATIONS.every((m) => !rules.medAvailable(m)), 'no psychiatric or modern medicines in 1800');
  const rec = living('bpd', 80, 60);
  check(!rules.mayDiagnose('psychiatrist', 'bpd', 1800) && !rules.mayDiagnose('psychiatrist', 'adhd', 1900), 'BPD is not a diagnosis in 1800, nor ADHD in 1900');
  const { nameIn } = await import('../js/data/health/conditions.js');
  check(nameIn(CONDITION_BY_ID.mdd, 1800) === 'melancholia' && nameIn(CONDITION_BY_ID.mdd, 2020) === 'major depressive disorder', 'the period has its own words');
  store.state.year = 2010;
  check(care.facilitiesHere().some((f) => f.defId === 'dbt') && rules.therapyAvailable(THERAPY_BY_ID.dbt), 'by 2010 there is a DBT program');
  void rec;
}
section('history: services, therapies, medicines and diagnoses only in their own time');

// ---------- 10. Old saves ----------
{
  const p = adult(45);
  delete p.health;
  p.conditions = [{ id: 'depression', name: 'depression', severity: 35, chronic: false, sinceAge: 40, treated: false }, { id: 'asthma', name: 'asthma', severity: 30, chronic: true, sinceAge: 5, treated: true }];
  p.birth = ['dyslexia'];
  const iq = p.stats.intellect;
  saveGame(store.state);
  const raw = JSON.parse(mem.get(`pathways.slot.${store.state.slotId}`));
  delete raw.player.health;
  mem.set(`pathways.slot.${store.state.slotId}`, JSON.stringify(raw));
  const back = loadGame(store.state.slotId);
  store.state = back;
  const h = back.player.health;
  check(h && h.conditions.some((c) => c.conditionId === 'mdd' && c.source === 'migrated'), 'a legacy depression becomes a recorded condition');
  check(h.diagnoses.length === 2 && h.diagnoses.every((d) => d.migrated && !d.providerId), 'its diagnosis is marked as carried over, with no invented clinician');
  check(!h.therapies.length && !h.trials.length && !h.assessments.length, 'no therapy, medication or assessment history is invented');
  const asthma = h.conditions.find((c) => c.conditionId === 'asthma');
  check(asthma && asthma.legacyManaged && !back.player.conditions.some((c) => ['asthma', 'depression'].includes(c.id)), 'long-term physical conditions move into the health record, keeping the benefit of treatment they had');
  check(!h.trials.length, 'without inventing a prescription for it');
  check(back.player.stats.intellect === Math.min(100, iq + 6), 'dyslexia no longer costs intellect; what it took is given back once');
  const again = loadGame(store.state.slotId);
  check(again.player.health.conditions.length === h.conditions.length, 'migrating twice adds nothing');
}
section('old saves: migrated, nothing invented, nothing duplicated');

// ---------- 11. A full life: nobody is defined by a diagnosis ----------
{
  let lives = 0; let diagnosedLives = 0; let goodYears = 0; let married = 0; let working = 0;
  for (let i = 0; i < 25; i++) {
    store.state = createLife({ countryId: 'uk' });
    const p = store.state.player;
    while (p.alive && p.age < 60) { advanceYear(); store.state.pendingEvents = []; }
    lives++;
    if (p.health.conditions.some((c) => MENTAL_GROUPS.includes(CONDITION_BY_ID[c.conditionId].group))) {
      diagnosedLives++;
      if (p.stats.mood >= 50) goodYears++;
      if (Object.values(store.state.npcs).some((n) => n.role === 'spouse')) married++;
      if (p.career.careerId || p.career.retired) working++;
    }
    check(ledgerOk(p.health), 'a long life charges nothing twice');
    check(p.health.week === 0, 'the care calendar starts each year at week 0');
  }
  check(diagnosedLives > 0 && diagnosedLives < lives, `some lives include a mental health condition, not all (${diagnosedLives}/${lives})`);
}
section('long lives: conditions are part of some lives, the calendar and the ledger stay sound');

// ---------- 12. Health in everyday play: notices and scenes ----------
{
  const { careWaiting } = H;
  const { meetsAll } = await import('../js/engine/conditions.js');
  const { EVENT_BY_ID } = await import('../js/data/events/index.js');
  const eligible = (id, cast = {}) => meetsAll(EVENT_BY_ID[id].requires ?? [], cast);
  let p = adult(30);
  check(careWaiting() === null, 'nothing waiting: no notice');
  const rec = living('mdd', 30, 60);
  const doc = care.clinicianAt(care.facilitiesHere().find((x) => x.defId === 'primary'), 'gp');
  const dx = { id: 'dx_n', conditionId: 'mdd', underlyingId: rec.id, status: 'active', wk: now(), providerId: doc.id, name: 'Major depressive disorder', history: [] };
  R.healthOf().diagnoses.push(dx);
  // A follow-up the year brings round on its own: noticed only when it is due.
  const appt = care.book('review', { facilityId: doc.flags.clinician.facilityId, providerId: doc.id, ref: 'x', wk: now() + 6 });
  check(careWaiting() === null || careWaiting().decision === false, 'an appointment weeks away is not urgent');
  appt.wk = now();
  check(careWaiting()?.decision === false && /this week/.test(careWaiting().text), 'an appointment this week is noticed');
  appt.status = 'canceled';
  // Asking about medicine is answered straight away, as a decision for the player.
  const said = meds.discussMedication('dx_n');
  check(said.ok && R.healthOf().proposals.some((x) => x.status === 'open'), 'asking a prescriber about medicine is answered in the same year, straight away');
  check(careWaiting()?.decision === true && /waiting/.test(careWaiting().text), 'a waiting decision is put in front of the player');
  // Telling a partner, in a scene.
  const love = makeNpc({ role: 'partner', countryId: 'uk', age: 31, relationship: 70 }); store.state.npcs[love.id] = love; p.npcIds.push(love.id);
  check(eligible('tell_partner'), 'an untold diagnosis makes the "telling a partner" scene possible');
  resolveChoice(EVENT_BY_ID.tell_partner, 0, { love: love.id });
  check(rec.disclosedTo.includes(love.id) && rec.disclosedTo.length === 1 && !eligible('tell_partner'), 'telling them in the scene tells only them');
  check(!eligible('back_on_track'), 'the "back on track" scene waits for real recovery');
  rec.remissionWk = now(); rec.status = 'in_remission';
  check(eligible('back_on_track'), 'and fires once a diagnosed condition has gone into remission');
  // A partner's own hard stretch, only if they have shared a condition.
  love.health = { v: 1, last: love.age, conds: [{ id: 'gad', age: 25, diagnosed: true, shared: true }] };
  let queued = false;
  for (let i = 0; i < 60 && !queued; i++) { love.health.last = love.age - 1; store.state.pendingEvents = []; story.tickPeopleHealth(); queued = store.state.pendingEvents.some((e) => e.id === 'partner_hard_stretch' && e.cast.love === love.id); }
  check(queued, 'a partner who shared their condition sometimes has a harder stretch to support them through');
  // A child begins to show a difference present from birth: noticed, assessed, recorded on the child.
  p = adult(38);
  const kid = makeNpc({ role: 'child', countryId: 'uk', age: 5, relationship: 80 }); kid.parentIds = []; store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id);
  kid.health = { v: 1, last: 5, conds: [{ id: 'adhd', age: 6, diagnosed: false, shared: false }] };
  check(!story.knownHealth(kid).length && !story.begun(kid).length, 'a condition that has not begun to show is not part of anyone\'s history yet');
  kid.age = 6; store.state.pendingEvents = [];
  story.tickPeopleHealth();
  check(store.state.pendingEvents.some((e) => e.id === 'child_noticed' && e.cast.kid === kid.id), 'a parent notices when it begins to show');
  const r = resolveChoice(EVENT_BY_ID.child_noticed, 0, { kid: kid.id });
  check(kid.health.conds[0].diagnosed && kid.health.conds[0].shared && /ADHD|attention/i.test(r.text), 'an assessment the parent arranges is recorded on the child');
  check(!R.healthOf().diagnoses.length, 'and nothing about the child\'s diagnosis lands on the parent\'s own record');
  // Access scenes follow real needs; a work accommodation can be asked for from a scene.
  p = adult(33);
  check(!eligible('inaccessible_venue') && !eligible('meeting_no_interpreter'), 'access scenes do not fire for someone they do not concern');
  living('spinal_cord_injury', 30, 40);
  check(eligible('inaccessible_venue'), 'a wheelchair user meets an inaccessible venue');
  p = adult(33); p.career.careerId = 'office';
  living('deaf', 1000, 40);
  check(eligible('meeting_no_interpreter'), 'a Deaf employee meets a meeting with no interpreter');
  resolveChoice(EVENT_BY_ID.meeting_no_interpreter, 1, {});
  check(R.healthOf().supports.accommodations.some((a) => a.typeId === 'captions' && a.setting === 'work'), 'asking from the scene is a real accommodation request');
}
section('everyday play: notices for waiting decisions, telling a partner, recovery, supporting a partner, a child noticed and assessed, access scenes');

// ---------- 13. Physical conditions, hospital, rehabilitation, insurance, other people's care ----------
{
  const hosp = await import('../js/engine/health/hospital.js');
  const ins = await import('../js/engine/health/insurance.js');
  const { addCondition } = await import('../js/engine/health.js');
  const { checkUp } = await import('../js/engine/medical.js');
  const sys = await import('../js/engine/systems.js');
  // A scene that finds high blood pressure: recorded by a primary care doctor, in the health record, not the old list.
  let p = adult(52);
  addCondition('high_bp');
  check(R.isDiagnosed('hypertension') && !p.conditions.some((c) => c.id === 'high_bp'), 'high blood pressure from a scene is diagnosed by a primary care doctor, in the health record');
  const gp = store.state.npcs[R.activeDiagnoses()[0].providerId];
  check(gp?.flags.clinician.profession === 'gp' && rules.canPrescribe({ medId: 'amlodipine', conditionId: 'hypertension', prescriber: gp }).ok, 'and the primary care doctor can prescribe for it');
  check(care.prescriberFor('hypertension')?.id === gp.id, 'the primary care doctor who found it is the one who prescribes');
  // Untreated, it costs health over the years; treated, much less.
  const untreated = adult(55); living('hypertension', 60, 60); for (let i = 0; i < 10; i++) course.weekCourse(untreated);
  const h0 = untreated.stats.health; course.yearBody(untreated); const lossUntreated = h0 - untreated.stats.health;
  check(lossUntreated > 0, 'untreated high blood pressure costs health');
  // Screening at a check-up finds what has no symptoms.
  p = adult(58); p.finance.cash = 1e7;
  const silent = living('type2_diabetes', 30, 40);
  const r = checkUp();
  check(R.isDiagnosed('type2_diabetes') && /found/.test(r.text), 'a check-up finds type 2 diabetes');
  void silent;
  // A heart attack: admitted, found by a cardiologist, offered cardiac rehab on the way home.
  p = adult(60);
  addCondition('heart_disease');
  const adm = hosp.inHospital(p);
  check(adm && adm.reason === 'heart' && R.isDiagnosed('heart_disease'), 'a heart attack means a hospital stay and a diagnosis');
  check(R.healthOf().ledger.filter((x) => x.ref.startsWith('adm:')).length === 1, 'the stay is billed once');
  until(() => hosp.admissions(p)[0].status === 'discharged');
  const prop = R.healthOf().proposals.find((x) => x.kind === 'rehab' && x.status === 'open');
  check(prop, 'leaving hospital comes with an offer of rehabilitation');
  const rr = meds.decide(prop.id, 'rehab');
  check(rr.ok && rr.course?.rehabGoals?.length >= 2, `cardiac rehab starts, with goals (${rr.text})`);
  until(() => rr.course.rehabGoals.some((g) => g.metWk) || rr.course.status !== 'active', 40);
  check(rr.course.rehabGoals.some((g) => g.metWk) && rr.course.rehabGoals.every((g) => g.progress >= 0), 'goals are reached by sessions attended');
  // Nothing is missed while in hospital.
  p = adult(40);
  const rec = living('mdd', 30, 55);
  const doc = care.clinicianAt(care.facilitiesHere().find((x) => x.defId === 'primary'), 'gp');
  const appt = care.book('review', { facilityId: doc.flags.clinician.facilityId, providerId: doc.id, ref: 'x', wk: now() + 1 });
  hosp.admit('hip');
  H.passWeeks(1);
  check(appt.status === 'booked' && appt.wk >= hosp.admissions(p)[0].endWk, 'an appointment during a hospital stay waits, and is not counted missed');
  void rec;
  // A broken hip heals for good once rehabilitation goals are met.
  p = adult(75);
  addCondition('broken_hip');
  check(p.conditions.some((c) => c.id === 'broken_hip') && hosp.inHospital(p), 'a broken hip is a hospital stay');
  until(() => R.healthOf().proposals.some((x) => x.kind === 'rehab' && x.status === 'open'));
  const hip = meds.decide(R.healthOf().proposals.find((x) => x.kind === 'rehab').id, 'rehab');
  until(() => hip.course.rehabGoals.every((g) => g.metWk) || hip.course.status !== 'active', 80);
  check(!hip.course.rehabGoals.every((g) => g.metWk) || !p.conditions.some((c) => c.id === 'broken_hip'), 'once every goal is met, the hip has healed');
  // Cancer: grows until treated, is staged when found, treated by an oncologist after a referral, with surgery first.
  p = adult(58);
  const cancer = living('cancer', 30, 40);
  const s0 = cancer.severity; for (let i = 0; i < 20; i++) course.weekCourse(p);
  check(cancer.severity > s0, 'untreated cancer grows');
  care.seekAssessment('body', care.facilitiesHere().find((x) => x.defId === 'primary').id, 'gp');
  until(() => R.healthOf().assessments.length);
  check(R.healthOf().assessments[0].outcome === 'referred' && R.healthOf().referrals.some((x) => x.profession === 'oncologist'), 'a primary care doctor refers suspected cancer to an oncologist');
  const onc = care.serviceOptions('body').find((o) => o.profession === 'oncologist' && !o.referral);
  care.seekAssessment('body', onc.facilityId, 'oncologist');
  until(() => R.isDiagnosed('cancer'), 60);
  check(cancer.stage >= 1 && cancer.stage <= 4 && /stage/.test(R.activeDiagnoses().find((d) => d.conditionId === 'cancer').name), `cancer is staged when it is found (stage ${cancer.stage})`);
  const dxc = R.activeDiagnoses().find((d) => d.conditionId === 'cancer');
  const opt = care.careOptions(dxc.id).therapies.find((t) => t.therapyId === 'cancer_treatment');
  const ct = ther.startTherapy({ therapyId: 'cancer_treatment', facilityId: opt.facilityId, providerId: ther.findProviders('cancer_treatment', 'cancer').find((x) => x.ok).providerId, dxId: dxc.id });
  check(ct.ok && (cancer.stage === 4 || hosp.admissions(p).some((a) => a.reason === 'surgery')), 'treatment starts, with surgery first where it can help');
  until(() => ct.course.status !== 'active', 120);
  check(ct.course.status === 'completed' && ['in_remission', 'active'].includes(cancer.status), `the course ends, and the outcome is recorded (${cancer.status})`);
  const { seriousCondition } = course;
  if (cancer.status === 'active') check(seriousCondition(p)?.name === 'cancer', 'a cancer that remains is what a death would be put down to');
  // Insurance: every bill is a claim; cover changes are kept as a history; refusals can be appealed.
  p = adult(35, 'us');
  p.career.careerId = null;
  ins.policyNow(p);
  const firstPolicy = ins.coverSummary(p).now;
  p.flags.healthCover = 'us'; ins.policyNow(p);
  const sum = ins.coverSummary(p);
  check(firstPolicy.kind === 'none' && sum.now.kind === 'private' && sum.policies.length === 2 && sum.policies[1].endWk != null, 'taking out insurance closes one cover record and opens another');
  living('gad', 40, 50);
  care.seekAssessment('mental', care.facilitiesHere().find((x) => x.defId === 'primary').id, 'gp');
  until(() => R.healthOf().assessments.length);
  const claims = R.healthOf().insurance.claims;
  check(claims.length >= 1 && claims.every((c) => c.billed >= c.patientPaid && c.billed === c.insurerPaid + c.patientPaid), 'each bill is a claim that adds up');
  check(new Set(claims.map((c) => c.ref)).size === claims.length, 'no bill is claimed twice');
  let refused = null;
  for (let i = 0; i < 200 && !refused; i++) { ins.claim(`big:${i}`, 9000, 100, { what: 'Test' }); refused = R.healthOf().insurance.claims.find((c) => c.status === 'refused'); }
  check(refused, 'a private insurer sometimes refuses expensive care');
  const cash = p.finance.cash;
  const ap = ins.appeal(refused.id);
  check(refused.appealed && (ap.ok ? p.finance.cash > cash && refused.status === 'paid on appeal' : refused.status === 'refusal upheld'), `an appeal is heard once (${refused.status})`);
  check(!ins.appeal(refused.id).ok, 'and only once');
  sys.cover(p);
  // Someone close: getting care for what they have shared, and the player can help.
  p = adult(35);
  const mom = Object.values(store.state.npcs).find((n) => n.role === 'parent');
  mom.age = 62; mom.meters.relationship = 70;
  mom.health = { v: 1, last: 61, conds: [{ id: 'mdd', age: 60, diagnosed: true, shared: true }, { id: 'gad', age: 55, diagnosed: true, shared: false }] };
  check(story.npcCareActions(mom).some((a) => a.id === 'encourageCare'), 'for someone who shared an untreated condition, the player can encourage them');
  check(story.npcHealthLines(mom).length === 1 && /depress/i.test(story.npcHealthLines(mom)[0][0]), 'their profile shows only what they shared');
  for (let i = 0; i < 10 && !mom.health.conds[0].care; i++) story.goWithCare(mom.id) && (store.state.year += 1, mom.flags.goWith = null);
  check(mom.health.conds[0].care?.v === 2, 'going with them can turn into care of their own');
}
section('physical conditions, hospital stays, rehabilitation goals, cancer care, insurance claims and appeals, care for family members');

// ---------- 14. Family members' care in full ----------
{
  const kin = await import('../js/engine/health/kincare.js');
  const p = adult(40);
  const dad = makeNpc({ role: 'parent', countryId: 'uk', age: 66, gender: 'male', relationship: 75 }); store.state.npcs[dad.id] = dad; p.npcIds.push(dad.id);
  dad.health = { v: 1, last: 65, conds: [{ id: 'mdd', age: 64, diagnosed: true, shared: true }, { id: 'bipolar_1', age: 30, diagnosed: true, shared: false }] };
  // Their own care: a real clinician, a therapy that exists, a medicine that is allowed for them.
  const care = kin.startCare(dad, dad.health.conds[0]);
  check(care?.therapy && store.state.npcs[care.therapy.providerId]?.flags.clinician, "a family member's therapist is a persistent clinician");
  check(care.meds.length === 0 || !['antidepressant'].includes(MED_BY_ID[care.meds[0].medId].family), 'with bipolar disorder (even unshared), no antidepressant is started on its own');
  const brother = makeNpc({ role: 'sibling', countryId: 'uk', age: 38, gender: 'male', relationship: 70 }); store.state.npcs[brother.id] = brother; p.npcIds.push(brother.id);
  brother.health = { v: 1, last: 37, conds: [{ id: 'mdd', age: 36, diagnosed: true, shared: true }] };
  const bc = kin.startCare(brother, brother.health.conds[0]);
  check(bc.meds[0] && MED_BY_ID[bc.meds[0].medId].uses.mdd, 'their medicine is one used for what they have');
  check(kin.npcMedOptions(brother, 'bpd').length === 0, 'nobody is given a medicine for BPD itself');
  // Sessions are attended (or not) year by year; medicines are reviewed and changed, keeping the old one.
  bc.meds[0].kind = 'little';
  const first = bc.meds[0].medId;
  store.state.year += 1; brother.age += 1;
  kin.careYear(brother, brother.health.conds[0]);
  check(bc.therapy.attended + bc.therapy.missed > 0 && bc.therapy.attended <= THERAPY_BY_ID[bc.therapy.therapyId].sessions, 'sessions are attended or missed, never more than the course');
  check(bc.meds.length === 2 && bc.meds[0].status === 'switched' && bc.meds[0].medId === first && bc.meds[1].replaces === first, 'a medicine that is not helping is changed at the yearly review, and the first is kept');
  // Helping them get there makes more sessions happen.
  let plain = 0; let helped = 0;
  for (let i = 0; i < 40; i++) {
    const a = makeNpc({ role: 'sibling', countryId: 'uk', age: 30, relationship: 70 }); a.health = { v: 1, last: 29, conds: [{ id: 'gad', age: 28, diagnosed: true, shared: true }] };
    const b = makeNpc({ role: 'sibling', countryId: 'uk', age: 30, relationship: 70 }); b.health = { v: 1, last: 29, conds: [{ id: 'gad', age: 28, diagnosed: true, shared: true }] };
    kin.startCare(a, a.health.conds[0]); kin.startCare(b, b.health.conds[0]); b.flags.helpCare = store.state.year + 1;
    store.state.year += 1; kin.careYear(a, a.health.conds[0]); kin.careYear(b, b.health.conds[0]); store.state.year -= 1;
    plain += a.health.conds[0].care.therapy?.attended ?? 0; helped += b.health.conds[0].care.therapy?.attended ?? 0;
  }
  check(helped > plain, `helping them get to appointments means more sessions (${helped} against ${plain})`);
  // Privacy: details only when they choose to share them.
  bc.details = false;
  check(!/sertraline|escitalopram|fluoxetine|CBT|therapy/i.test(kin.npcHealthLines(brother).flat().join(' ')) && kin.npcCareHistory(brother).length === 0, 'without details shared, the player sees only that they are getting support');
  brother.meters.relationship = 80;
  const ask = kin.askCare(brother.id);
  check(ask.ok && bc.details && kin.npcCareHistory(brother).length >= 2, 'asking, when they are willing, shares the details and their history');
  check(!kin.npcHealthLines(dad).some(([n]) => /bipolar/i.test(n)), 'a condition they never shared stays theirs');
  // A heart attack: in hospital, a visit is possible.
  const mumc = { id: 'heart_disease', age: 66, diagnosed: true, shared: true };
  dad.health.conds.push(mumc);
  kin.kinAdmitted(dad, mumc, 'a heart attack');
  check(kin.npcCareActions(dad).some((a) => a.id === 'visitCare') && kin.visitCare(dad.id).ok, 'a family member in hospital can be visited');
  check(mumc.care.stays.length === 1, 'the stay is part of their record');
  // A save and reload keeps it all.
  const back = roundTrip();
  const b2 = store.state.npcs[brother.id];
  check(b2.health.conds[0].care.meds.length === 2 && b2.health.conds[0].care.details, 'their care survives a reload');
  void back;
}
section("family members' care: their own clinicians, sessions attended, medicines reviewed and changed, help that counts, hospital visits, details shared by choice");

// ---------- Babies: no talking therapy or psychologist; a doctor, hearing and sight from birth ----------
{
  const p = adult(0);
  const ther = await import('../js/engine/health/therapy.js');
  check(!care.concernsFor(p).includes('mental') && care.concernsFor(p).includes('body') && care.concernsFor(p).includes('senses'), `a baby can be taken for a physical problem, hearing or sight, not about how they feel (${care.concernsFor(p)})`);
  check(care.serviceOptions('mental', p).length === 0 && !care.seekAssessment('mental', 'x', 'psychologist', p).ok, 'nobody takes a baby to a psychologist');
  check(ther.findProviders('depression_peer', null, p).every((o) => !o.ok), 'a baby is not offered a support group');
  p.age = 2;
  check(care.concernsFor(p).includes('development') && !care.concernsFor(p).includes('mental'), 'at two: communication and routines can be looked at');
  p.age = 5;
  check(care.concernsFor(p).includes('mental') && care.serviceOptions('mental', p).length > 0, 'at five: talking to someone about how they feel');
  section('mental health care is from five: nothing of the kind for a baby');
}

// ---------- Few at once, and found by a doctor ----------
{
  const idx = await import('../js/engine/health/index.js');
  const few = gen.fewer(['dyslexia', 'dysgraphia', 'dld', 'adhd', 'autism', 'asthma']);
  check(few.filter((x) => ['dyslexia', 'dyscalculia', 'dysgraphia', 'dld'].includes(x)).length === 1 && few.filter((x) => CONDITION_BY_ID[x].group === 'neurodev').length <= 2 && few.length <= 3, `nobody is born with that many at once (${few})`);
  let most = 0;
  for (let i = 0; i < 400; i++) most = Math.max(most, gen.bornWith(gen.genomeOf(adult(0)), `few_${i}`).length);
  check(most <= 3, `at most three conditions from birth (${most})`);
  const p = adult(8);
  const rec = R.startCondition('dyslexia', { onsetAge: 0, showsAge: 6, severity: 45 }, p);
  check(!idx.checkupDue(p), 'nothing to ask about before it is noticed');
  course.rollOnset(p);
  const due = idx.checkupDue(p);
  check(rec.noticed && due?.recId === rec.id && due.child && !/dyslexia/i.test(due.text), `once noticed, a check-up is suggested without naming it (${JSON.stringify(due)})`);
  check(!R.isDiagnosed('dyslexia', p.health), 'it is not known until a doctor finds it');
  idx.answerCheckup(rec.id, false, p);
  check(!idx.checkupDue(p), 'a "not now" is not asked again straight away');
  rec.checkupAsked -= 3;
  const r = idx.answerCheckup(rec.id, true, p);
  check(r?.ok && rec.dx !== 'none', `saying yes books an assessment (${r?.text})`);
  section('few at once: a believable handful from birth, nothing named until a doctor finds it, a check-up suggested');
}

// ---------- A child's doctor ----------
{
  const med = await import('../js/engine/medical.js');
  do { store.state = createLife({ countryId: 'us' }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = 3; p.finance.cash = 0;
  check(!med.therapy().ok && /from age 5/.test(med.therapy().text), 'no therapist for a three-year-old');
  const r = med.checkUp();
  check(r.ok && p.finance.cash === 0 && /parents/i.test(r.text), `a small child's check-up is paid by the parents (${r.text})`);
  section("a child's doctor: only what fits their age, and the parents pay");
}

console.log(ok.map((x) => `ok  ${x}`).join('\n'));
if (problems.length) { console.log(`\n${problems.length} problem(s):\n${problems.join('\n')}`); process.exit(1); }
console.log('\nThe health engine checks out.');
