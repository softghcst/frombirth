// Patients: the cases a physician sees, from medical school to private practice.
//
// Each world year brings a small fixed number of cases (whatever the Age Up length), drawn from
// data/medicineCases.js for the specialty being trained in or practiced. A case is worked step by
// step: the story and examination, tests (each costs time, some are not worth it, a few are harmful),
// a working diagnosis, a plan, sometimes a decision under pressure, then an outcome that is rolled
// once and kept. A follow-up brings the same patient back in a later year.
//
// What the engine rewards is judgment, not doing more: a test that will not change the plan, an
// operation that is not needed, or a plan that skips consent lowers judgment and integrity even when
// the patient does well. Reputation is built from those skills (core.reputationOf), never from
// how many patients survived. A student or resident works under supervision: an unsafe plan may be
// stopped by the supervising physician, and they never operate alone.
//
// Privacy: a patient is a real person in the world (an NPC), but not someone the player "knows":
// they are kept out of the player's people list, and their case is a confidential record held in
// W().cases. Only the physician sees it. The journal mentions a case without the patient's name.
import { rng } from '../../rng.js';
import { clamp } from '../../util.js';
import { store, player, log } from '../../state.js';
import { CASES, CASE_BY_ID } from '../../data/medicineCases.js';
import { TEST_BY_ID, PROCEDURE_BY_ID, SPECIALTY_BY_ID, qualifiesAs } from '../../data/medicine.js';
import { makeNpc } from '../npcFactory.js';
import { M, med, W, year, grow, nextId, result, roll, currentSpecialty, qualified } from './core.js';
import { hospital } from './hospitals.js';

export const CASES_PER_YEAR = 3;
const QUALITY = { best: 90, ok: 65, poor: 35, unsafe: 10 };
const ODDS = { best: [0.8, 0.17], ok: [0.55, 0.35], poor: [0.2, 0.45], unsafe: [0.05, 0.35] };

/** Who the player is in a case: a student presents, a trainee proposes, a qualified physician decides. */
export function roleNow(m = med(), p = player()) {
  if (!m) return null;
  if (m.training) return m.training.kind === 'fellowship' ? 'fellow' : 'resident';
  if (m.job || m.clinicIds?.length || (m.legacy && p.career.careerId)) return 'physician';
  if (p.education.enrolled && ['medical', 'podiatric'].includes(p.education.stage) && (m.school?.year ?? 0) >= 3) return 'student';
  return null;
}
export const supervised = (role) => role === 'student' || role === 'resident';

/** The specialty a year's cases come from. A student's come from this year's rotations. */
function caseSpecialty(m, role) {
  if (role === 'student') {
    const rots = (m.school?.rotations ?? []).filter((r) => r.year === year());
    return rots.length ? rng.pick(rots).specialty : m.route === 'dpm' ? 'podiatry' : 'internal';
  }
  const s = currentSpecialty(m);
  if (s) return s;
  return m.route === 'dpm' ? 'podiatry' : 'internal';
}

/** Case fixtures a physician in a specialty can see this year (fellowships also see their base specialty's). */
export function fixturesFor(specialtyId, when = year()) {
  const s = SPECIALTY_BY_ID[specialtyId];
  const ids = new Set([specialtyId, qualifiesAs(specialtyId)]);
  if (s?.kind === 'fellowship') for (const a of s.after) ids.add(a);
  if (specialtyId === 'ct_integrated') ids.add('ctsurg');
  const direct = CASES.filter((c) => !c.followUpOnly && c.minYear <= when && c.specialty.includes(specialtyId));
  if (direct.length >= 3) return direct;
  return CASES.filter((c) => !c.followUpOnly && c.minYear <= when && c.specialty.some((x) => ids.has(x)));
}

/** A new patient: a person of the right age, not in the player's life. */
function newPatient(fx, p) {
  const [lo, hi] = fx.ages ?? [18, 80];
  const age = lo + Math.floor(rng.next() * (hi - lo + 1));
  const gender = fx.sex === 'female' ? 'female' : fx.sex === 'male' ? 'male' : undefined;
  const n = makeNpc({ role: 'patient', countryId: p.countryId, age, relationship: 50, gender });
  n.flags.patient = true;
  store.state.npcs[n.id] = n;
  W().patients[n.id] = { id: n.id, caseIds: [], firstYear: year(), lastYear: year(), bornYear: year() - age };
  // A child comes with a parent or guardian; some patients come with the relative who looks after them. They are kept
  // with the patient's record, so a follow-up brings the same family back.
  if (fx.guardian || fx.household) {
    const g = makeNpc({ role: 'patient', countryId: p.countryId, age: fx.guardian && age < 18 ? age + 24 + Math.floor(rng.next() * 12) : Math.max(20, age + Math.floor(rng.next() * 20) - 10), relationship: 50, lastName: n.lastName });
    g.flags.patient = true;
    g.flags.patientKin = n.id;
    store.state.npcs[g.id] = g;
    W().patients[n.id].household = [{ id: g.id, as: fx.guardian && age < 18 ? 'parent or guardian' : 'family member' }];
  }
  return n;
}

/** Opens a case for a fixture and a patient. */
function openCase(fx, patient, specialtyId, role, o = {}) {
  const p = player();
  const m = M();
  const id = nextId('case');
  const c = { id, fixtureId: fx.id, patientId: patient.id, specialtyId, role, year: year(), status: 'open', hospitalId: p.career.employerId ?? null,
    clinicId: o.clinicId ?? null, tests: [], dx: null, plan: null, triage: null, decision: null, outcome: null, notes: [], followOf: o.followOf ?? null };
  W().cases[id] = c;
  W().patients[patient.id].caseIds.push(id);
  W().patients[patient.id].lastYear = year();
  m.caseIds.push(id);
  if (fx.episode) {
    const ep = (W().episodes[`${fx.episode}:${year()}`] ??= { id: fx.episode, year: year(), caseIds: [] });
    ep.caseIds.push(id);
  }
  return c;
}

/** This year's cases: made once a year, the same number whatever the Age Up length. Follow-ups come first. */
export function caseload(m = med(), p = player()) {
  if (!m) return [];
  const role = roleNow(m, p);
  if (!role) return [];
  if (m.yearCases.year !== year()) {
    m.yearCases = { year: year(), n: 0, done: 0 };
    const spec = caseSpecialty(m, role);
    const want = role === 'student' ? 1 : CASES_PER_YEAR;
    // Patients who were told to come back.
    for (const due of (m.followUps ?? []).filter((f) => f.year <= year()).slice(0, want)) {
      const fx = CASE_BY_ID[due.fixtureId];
      const patient = store.state.npcs[due.patientId];
      if (!fx || !patient?.alive) continue;
      patient.age = year() - (W().patients[patient.id]?.bornYear ?? year() - patient.age);
      openCase(fx, patient, spec, role, { followOf: due.caseId });
      m.yearCases.n += 1;
    }
    m.followUps = (m.followUps ?? []).filter((f) => f.year > year());
    const pool = fixturesFor(spec).filter((fx) => !(m.seenFixtures ?? []).slice(-12).includes(fx.id));
    const list = pool.length ? pool : fixturesFor(spec);
    const picks = [...list].sort(() => rng.next() - 0.5).slice(0, Math.max(0, want - m.yearCases.n));
    for (const fx of picks) {
      openCase(fx, newPatient(fx, p), spec, role);
      (m.seenFixtures ??= []).push(fx.id);
      m.yearCases.n += 1;
    }
    if (m.seenFixtures?.length > 40) m.seenFixtures.splice(0, m.seenFixtures.length - 40);
  }
  return m.caseIds.map((id) => W().cases[id]).filter((c) => c && c.year === year());
}

/** Open cases this year. */
export const openCases = () => caseload().filter((c) => c.status === 'open');

const fill = (text, c, patient) => String(text ?? '').replaceAll('{patient}', patient ? patient.firstName : 'The patient').replaceAll('{age}', String(patient?.age ?? ''));

/** Everything the physician sees of a case, with the text filled in. Private. */
export function caseView(id) {
  const c = W().cases[id];
  if (!c) return null;
  const fx = CASE_BY_ID[c.fixtureId];
  const patient = store.state.npcs[c.patientId];
  const now = year();
  return {
    id: c.id, status: c.status, role: c.role, label: fx.label, tier: fx.tier, supervised: supervised(c.role),
    patient: patient ? { name: `${patient.firstName} ${patient.lastName}`, first: patient.firstName, age: patient.age, gender: patient.gender } : null,
    guardian: !!fx.guardian, household: !!fx.household, followUp: !!c.followOf,
    family: (W().patients[c.patientId]?.household ?? []).map((x) => ({ name: store.state.npcs[x.id] ? `${store.state.npcs[x.id].firstName} ${store.state.npcs[x.id].lastName}` : 'A relative', as: x.as })),
    // One emergency, several teams: who else is working on the same patient (data/medicineCases.js `episode`).
    teams: fx.episode ? [...new Set(CASES.filter((x) => x.episode === fx.episode && x.id !== fx.id).map((x) => SPECIALTY_BY_ID[x.specialty[0]]?.name).filter(Boolean))] : [],
    intro: fill(fx.intro, c, patient), history: fill(fx.history, c, patient), exam: fill(fx.exam, c, patient),
    tests: fx.tests.filter((t) => (TEST_BY_ID[t.test]?.minYear ?? 0) <= now).map((t) => {
      const done = c.tests.find((x) => x.test === t.test);
      return { id: t.test, name: TEST_BY_ID[t.test]?.name ?? t.test, done: !!done, result: done ? fill(t.result, c, patient) : null };
    }),
    differential: fx.differential, dx: c.dx,
    triage: fx.triage && !c.triage ? { text: fill(fx.triage.text, c, patient), options: fx.triage.options.map(({ id: oid, label }) => ({ id: oid, label })) } : null,
    plans: plansFor(fx, c).map((x) => ({ id: x.id, label: x.label, procedure: x.procedure ? PROCEDURE_BY_ID[x.procedure]?.name : null, refer: x.refer ? SPECIALTY_BY_ID[x.refer]?.name : null, block: x.block })),
    or: c.status === 'or' ? orView(c, patient) : null, operated: c.or ? { procedure: PROCEDURE_BY_ID[c.or.procedure]?.name, choices: c.or.choices, transferred: !!c.or.transferred } : null,
    plan: c.plan, decision: fx.decision && c.plan && !c.decision && c.status === 'deciding' ? { text: fill(fx.decision.text, c, patient), options: fx.decision.options.map(({ id: oid, label }) => ({ id: oid, label })) } : null,
    outcome: c.outcome ? { ...c.outcome, text: fill(fx.outcomes[c.outcome.result], c, patient) } : null, notes: c.notes,
  };
}

/** What a physician may do themselves: the procedures of their completed training, and (supervised) those of their program. */
export function privileges(m = med()) {
  const out = new Set();
  for (const c of m?.completed ?? []) for (const id of [c.specialtyId, qualifiesAs(c.specialtyId)]) for (const x of SPECIALTY_BY_ID[id]?.procedures ?? []) {
    if (PROCEDURE_BY_ID[x]?.needsFocus && m.focus !== PROCEDURE_BY_ID[x].needsFocus) continue;
    out.add(x);
  }
  return out;
}

/** Plans available in this era, with any reason one cannot be done by this physician. */
function plansFor(fx, c) {
  const m = med();
  const now = year();
  return fx.plans.filter((x) => (x.minYear ?? 0) <= now && (x.maxYear ?? 9999) >= now).map((x) => {
    let block = '';
    const proc = x.procedure ? PROCEDURE_BY_ID[x.procedure] : null;
    if (proc && proc.minYear > now) block = `${proc.name} is not yet done in ${now}.`;
    else if (proc && c.role === 'student') block = '';
    else if (proc && c.role === 'physician' && !privileges(m).has(proc.id)) block = `You do not hold privileges for ${proc.name.toLowerCase()}. Refer instead.`;
    return { ...x, block };
  });
}

/** Orders a test. Each case allows a few; the results come back at once. */
export function orderTest(id, testId) {
  const c = W().cases[id];
  if (!c || c.status !== 'open') return result(false, 'That case is closed.', 'neutral');
  const fx = CASE_BY_ID[c.fixtureId];
  const t = fx.tests.find((x) => x.test === testId);
  if (!t || (TEST_BY_ID[testId]?.minYear ?? 0) > year()) return result(false, 'That test is not available here.', 'neutral');
  if (c.tests.some((x) => x.test === testId)) return result(false, 'The result is already in the chart.', 'neutral');
  if (c.tests.length >= 4) return result(false, 'You have ordered enough. Decide with what you have.', 'neutral');
  c.tests.push({ test: testId, value: t.value });
  const m = M();
  if (t.value === 'useful') grow('reasoning', 0.5, m);
  if (t.value === 'low') grow('management', -0.5, m);
  if (t.value === 'unsafe') { grow('professionalism', -1, m); c.notes.push('A test was ordered that put the patient at risk for little gain.'); }
  const patient = store.state.npcs[c.patientId];
  return result(true, fill(t.result, c, patient), t.value === 'unsafe' ? 'bad' : 'neutral');
}

/** The working diagnosis. */
export function setDiagnosis(id, dxId) {
  const c = W().cases[id];
  if (!c || c.status !== 'open') return result(false, 'That case is closed.', 'neutral');
  const fx = CASE_BY_ID[c.fixtureId];
  if (!fx.differential.some((d) => d.id === dxId)) return result(false, 'That is not on the list.', 'neutral');
  c.dx = dxId;
  return result(true, `Working diagnosis: ${fx.differential.find((d) => d.id === dxId).label.toLowerCase()}.`, 'neutral');
}

/** Triage: who is seen first, where a case starts with several arriving at once. */
export function triage(id, optionId) {
  const c = W().cases[id];
  const fx = CASE_BY_ID[c?.fixtureId];
  const o = fx?.triage?.options.find((x) => x.id === optionId);
  if (!o || c.triage) return result(false, 'There is nothing to decide.', 'neutral');
  c.triage = { id: o.id, quality: o.quality };
  grow('reasoning', o.quality === 'best' ? 1 : -0.5);
  return result(true, o.quality === 'best' ? 'You see the sickest patient first.' : 'You start with someone else. The sickest patient waits.', o.quality === 'best' ? 'good' : 'bad');
}

/** Chooses the plan. A case with a decision under pressure waits for it; otherwise the case is resolved. */
export function choosePlan(id, planId) {
  const c = W().cases[id];
  if (!c || c.status !== 'open') return result(false, 'That case is closed.', 'neutral');
  const fx = CASE_BY_ID[c.fixtureId];
  if (fx.triage && !c.triage) return result(false, 'First decide who is seen first.', 'neutral');
  const plan = plansFor(fx, c).find((x) => x.id === planId);
  if (!plan) return result(false, 'That plan is not available.', 'neutral');
  if (plan.block) return result(false, plan.block, 'neutral');
  if (!c.dx) return result(false, 'Settle on a working diagnosis first.', 'neutral');
  c.plan = planId;
  // An operation goes through the operating room: consent, the team, anesthesia, the unexpected, the care after.
  const proc = plan.procedure ? PROCEDURE_BY_ID[plan.procedure] : null;
  if (proc?.major && c.role !== 'student') { startOr(c, proc); return result(true, `${proc.name}: to the operating room.`, 'neutral'); }
  if (fx.decision) { c.status = 'deciding'; return result(true, 'The plan is under way.', 'neutral'); }
  return resolve(c, plan, null);
}

// ---------- The operating room ----------
//
// The same for every surgical specialty: high-level decisions about people and judgment, never how
// an operation is done. The risk of a complication is rolled once, on the way in, from the
// procedure, the surgeon's skill, supervision and the hospital's resources; how the team responds
// to it is the player's. A complication is not a death sentence, and a shortcut is never rewarded.
const OR_STEPS = {
  consent: { text: 'Before anything else: the patient, the operation, its risks, and the alternatives, including not operating.', options: [
    { id: 'full', label: 'Talk it through properly, answer every question, and take consent', q: 'best' },
    { id: 'brief', label: 'Keep it brief: they have already agreed', q: 'poor' }] },
  team: { text: 'Who will be in the room.', options: [
    { id: 'full', label: 'The full team, with an experienced assistant and the right equipment checked', q: 'best' },
    { id: 'available', label: 'Whoever is free: it is late, and they will do', q: 'ok' },
    { id: 'transfer', label: 'Arrange a transfer to a center with more resources', q: 'transfer' }] },
  anesthesia: { text: 'The anesthesia team wants a word before you start.', options: [
    { id: 'plan', label: 'Go through the plan together, including what happens if things change', q: 'best' },
    { id: 'skip', label: 'Start: they know their job', q: 'poor' }] },
  complication: { text: 'Partway through, something is not as expected: more bleeding than there should be, and the numbers on the monitor are changing.', options: [
    { id: 'pause', label: 'Pause, say it out loud to the team, and call a senior colleague', q: 'best' },
    { id: 'stop', label: 'Stop safely, stabilize, and plan to finish another day', q: 'ok' },
    { id: 'press', label: 'Press on and finish quickly', q: 'unsafe' }] },
  after: { text: 'The operation is over. What happens next matters as much.', options: [
    { id: 'plan', label: 'A clear plan for recovery, follow-up booked, and the family told honestly how it went', q: 'best' },
    { id: 'ward', label: 'Routine ward care', q: 'ok' },
    { id: 'early', label: 'Send them home as early as possible to free the bed', q: 'poor' }] },
};
const OR_POINTS = { best: 4, ok: 0, poor: -8, unsafe: -20 };

function startOr(c, proc) {
  const m = M();
  const h = c.hospitalId ? hospital(c.hospitalId) : null;
  const resources = h?.resources ?? 60;
  const risk = proc.risk * (1.3 - m.skills.technical / 100) * (supervised(c.role) ? 0.85 : 1) * (0.6 + (100 - resources) / 100);
  c.status = 'or';
  c.or = { procedure: proc.id, step: 'consent', resources, risk: Math.round(risk * 100) / 100, complication: roll(risk), choices: {}, points: 0 };
}

/** The operating room as the physician sees it: the procedure, the team, the risks, and the step now. */
function orView(c, p) {
  const o = c.or;
  if (!o) return null;
  const proc = PROCEDURE_BY_ID[o.procedure];
  const m = med();
  const sup = (m?.people.supervisorIds ?? []).map((id) => store.state.npcs[id]).find((n) => n?.alive);
  const step = OR_STEPS[o.step];
  return { procedure: proc.name, risk: o.risk >= 0.15 ? 'high' : o.risk >= 0.07 ? 'moderate' : 'low', resources: o.resources >= 80 ? 'a well-equipped center' : o.resources >= 60 ? 'a well-run hospital' : 'a hospital with limited resources',
    team: supervised(c.role) ? `You, with ${sup ? `${sup.firstName} ${sup.lastName}` : 'your supervising surgeon'} scrubbed in and in charge` : c.role === 'fellow' ? 'You, as fellow, with an attending surgeon' : 'You, leading the team',
    step: step ? { id: o.step, text: step.text, options: step.options.map(({ id, label }) => ({ id, label })) } : null, choices: o.choices, patient: p?.firstName ?? 'The patient' };
}

/** One decision in the operating room. */
export function orStep(id, optionId) {
  const c = W().cases[id];
  if (!c || c.status !== 'or') return result(false, 'There is no operation under way.', 'neutral');
  const step = OR_STEPS[c.or.step];
  const o = step?.options.find((x) => x.id === optionId);
  if (!o) return result(false, 'That is not one of the choices.', 'neutral');
  const m = M();
  c.or.choices[c.or.step] = o.id;
  if (o.q === 'transfer') {
    // Sending a patient where they will be safer is good judgment when the risk is high and resources are thin.
    const wise = c.or.resources < 70 || c.or.risk >= 0.15;
    c.or.points += wise ? 6 : -2;
    c.notes.push(wise ? 'You arranged a transfer to a better-equipped center; the operation went ahead there.' : 'You arranged a transfer that was not really needed; it cost the patient a day.');
    c.or.complication = c.or.complication && roll(0.4);
    c.or.transferred = true;
    grow('reasoning', wise ? 1 : 0, m);
    return finishOr(c);
  }
  c.or.points += OR_POINTS[o.q] ?? 0;
  if (o.q === 'unsafe') grow('integrity', -2, m);
  if (o.q === 'best') grow('teamwork', 0.5, m);
  const order = ['consent', 'team', 'anesthesia', ...(c.or.complication ? ['complication'] : []), 'after'];
  const next = order[order.indexOf(c.or.step) + 1];
  if (next) { c.or.step = next; return result(true, next === 'complication' ? 'Something changes.' : 'Next.', next === 'complication' ? 'bad' : 'neutral'); }
  return finishOr(c);
}

function finishOr(c) {
  c.or.step = null;
  const fx = CASE_BY_ID[c.fixtureId];
  if (fx.decision) { c.status = 'deciding'; return result(true, 'Out of the operating room. One more decision.', 'neutral'); }
  c.status = 'open';
  return resolve(c, plansFor(fx, c).find((x) => x.id === c.plan), null);
}

/** The decision under pressure, where a case has one. */
export function decide(id, optionId) {
  const c = W().cases[id];
  if (!c || c.status !== 'deciding') return result(false, 'There is nothing to decide.', 'neutral');
  const fx = CASE_BY_ID[c.fixtureId];
  const o = fx.decision.options.find((x) => x.id === optionId);
  if (!o) return result(false, 'That is not one of the choices.', 'neutral');
  c.decision = { id: o.id, quality: o.quality };
  return resolve(c, plansFor(fx, c).find((x) => x.id === c.plan), o);
}

const STEP_DOWN = { good: 'fair', fair: 'poor', poor: 'poor' };

/** Rolls the outcome once, keeps it, and turns what happened into experience. */
function resolve(c, plan, decision, how = 'played') {
  const p = player();
  const m = M();
  const fx = CASE_BY_ID[c.fixtureId];
  let quality = plan.quality;
  const notes = c.notes;
  // A supervisor reviews a trainee's plan. Most unsafe plans are caught.
  if (supervised(c.role) && quality === 'unsafe' && roll(0.75)) {
    const best = fx.plans.find((x) => x.quality === 'best') ?? plan;
    notes.push(`Your supervising physician stopped the plan and talked it through with you: ${best.label.charAt(0).toLowerCase()}${best.label.slice(1)}.`);
    quality = 'ok';
    grow('reasoning', 0.5, m);
    grow('professionalism', -0.5, m);
  }
  // The steps around the plan: the right test first, the right diagnosis, who was seen first, the decision.
  let points = QUALITY[quality];
  const needs = fx.needs ?? [];
  const missed = needs.filter((t) => !c.tests.some((x) => x.test === t) && (TEST_BY_ID[t]?.minYear ?? 0) <= year());
  if (missed.length) { points -= 15; notes.push(`The ${missed.map((t) => TEST_BY_ID[t]?.name ?? t).join(' and ')} that would have settled it was never done.`); }
  const rightDx = c.dx === fx.diagnosis;
  points += rightDx ? 8 : -12;
  if (c.tests.filter((x) => ['low', 'unsafe'].includes(x.value)).length >= 2) points -= 8;
  if (c.triage) points += { best: 5, ok: 0, poor: -10, unsafe: -15 }[c.triage.quality] ?? 0;
  if (decision) points += { best: 8, ok: 0, poor: -12, unsafe: -25 }[decision.quality] ?? 0;
  if (c.or) points += c.or.points;
  points = clamp(points);
  // The outcome: mostly the care, partly luck. Doing everything right does not guarantee a good result.
  const odds = ODDS[points >= 75 ? 'best' : points >= 52 ? 'ok' : points >= 28 ? 'poor' : 'unsafe'];
  const r = rng.next();
  let res = r < odds[0] ? 'good' : r < odds[0] + odds[1] ? 'fair' : 'poor';
  // An operation carries its own risk, less with skill, more where resources are thin.
  const proc = plan.procedure ? PROCEDURE_BY_ID[plan.procedure] : null;
  let complication = false;
  if (proc && c.or) {
    // The operating room's own decisions, and how the team met the unexpected.
    complication = !!c.or.complication;
    const handled = c.or.choices.complication;
    if (complication && handled === 'press') { res = STEP_DOWN[STEP_DOWN[res]]; notes.push('A complication, and pressing on made it worse. The patient is recovering, slowly.'); }
    else if (complication && handled === 'stop') { res = res === 'good' ? 'fair' : res; notes.push('A complication: you stopped safely, and the operation was finished another day.'); }
    else if (complication) notes.push('A complication: the team paused, called for help, and managed it together.');
  } else if (proc) {
    const h = c.hospitalId ? hospital(c.hospitalId) : null;
    const res0 = h?.resources ?? 60;
    const risk = proc.risk * (1.3 - m.skills.technical / 100) * (supervised(c.role) ? 0.85 : 1) * (0.6 + (100 - res0) / 100);
    if (roll(risk)) { complication = true; res = STEP_DOWN[res]; notes.push('There was a complication during the procedure; the team managed it together.'); }
  }
  if (proc) {
    m.experience[supervised(c.role) || c.role === 'fellow' ? 'assisted' : 'procedures'] += 1;
    grow('technical', supervised(c.role) ? 1 : 1.5, m);
    // An operation that was not needed is never a good result, whatever happens next.
    if (['poor', 'unsafe'].includes(plan.quality)) { grow('integrity', -2, m); notes.push('The procedure was not the right choice for this patient.'); }
  }
  if (plan.refer) notes.push(`Referred to ${SPECIALTY_BY_ID[plan.refer]?.name ?? 'a specialist'} as part of the plan.`);
  c.outcome = { result: res, points, rightDx, complication, how, year: year() };
  // A poor result after care below the standard may bring a complaint or a claim (decided in a later year, engine/medicine/ladder.js).
  // A trainee's care is the program's responsibility; a good-faith decision that went badly is not negligence.
  if (c.role === 'physician' && res === 'poor' && (quality === 'unsafe' || points < 30) && roll(0.3)) {
    (m.claims ??= []).push({ caseId: c.id, year: year(), status: 'open', below: points < 30 || quality === 'unsafe' });
  }
  c.status = 'closed';
  // Experience follows judgment, not luck.
  grow('reasoning', points >= 75 ? 2 : points >= 52 ? 1 : -0.5, m);
  if (points >= 52) grow('communication', fx.guardian || fx.household ? 1 : 0.5, m); // talking a family through a poor plan is not good communication
  if (quality === 'unsafe') grow('integrity', -1, m);
  if (points >= 75) grow('professionalism', 0.5, m);
  m.experience.cases += 1;
  m.experience.bySpecialty[c.specialtyId] = (m.experience.bySpecialty[c.specialtyId] ?? 0) + 1;
  if (m.yearCases.year === c.year) m.yearCases.done += 1;
  // The year's review counts the cases of the year they were seen in (engine/medicine/training.js evaluates it).
  const rv = (m.yearReview?.year === c.year ? m.yearReview : (m.yearReview = { year: c.year, n: 0, quality: 0 }));
  rv.n += 1; rv.quality += points;
  // A patient asked to come back does, in a later year.
  if (fx.followUp && CASE_BY_ID[fx.followUp]) (m.followUps ??= []).push({ fixtureId: fx.followUp, patientId: c.patientId, caseId: c.id, year: c.year + 1 });
  // Someone who was well looked after may remember it (engine/medicine/drama.js reads this years later).
  if (res === 'good' && points >= 75) (m.grateful ??= []).push({ patientId: c.patientId, year: year(), label: fx.label });
  if (how === 'played') log(`A case closed: ${fx.label.toLowerCase()}. ${res === 'good' ? 'The patient did well.' : res === 'fair' ? 'The patient recovered, not completely.' : 'It went badly for the patient.'}`, 'system', res === 'poor' ? 'bad' : 'neutral');
  const patient = store.state.npcs[c.patientId];
  return result(true, fill(fx.outcomes[res], c, patient), res === 'good' ? 'good' : res === 'fair' ? 'neutral' : 'bad', { outcome: res, points });
}

/**
 * The year's cases not worked by hand are handled in the run of a busy year: a plan chosen as a
 * physician of this skill would choose it. Nothing is asked of the player, and nothing is lost.
 */
export function closeYear(m = med()) {
  if (!m) return;
  for (const id of m.caseIds) {
    const c = W().cases[id];
    if (!c || c.status === 'closed' || c.year >= year()) continue;
    const fx = CASE_BY_ID[c.fixtureId];
    const plans = plansFor(fx, c).filter((x) => !x.block);
    if (!plans.length) { c.status = 'closed'; c.outcome = { result: 'fair', points: 50, how: 'referred', year: year() }; continue; }
    const sharp = (m.skills.reasoning + m.skills.management) / 200;
    const want = rng.next() < sharp ? 'best' : rng.next() < 0.75 ? 'ok' : 'poor';
    const plan = plans.find((x) => x.quality === want) ?? plans.find((x) => x.quality === 'best') ?? plans[0];
    if (!c.dx) c.dx = rng.next() < sharp + 0.2 ? fx.diagnosis : fx.differential[fx.differential.length - 1].id;
    if (fx.triage && !c.triage) c.triage = { id: 'auto', quality: 'ok' };
    for (const t of (fx.needs ?? [])) if (!c.tests.some((x) => x.test === t) && rng.next() < sharp + 0.3) c.tests.push({ test: t, value: 'useful' });
    c.plan = plan.id;
    resolve(c, plan, fx.decision ? { quality: rng.next() < sharp ? 'best' : 'ok' } : null, 'busy year');
  }
  // Keep the record list bounded: case details older than thirty years are summarized away.
  const cutoff = year() - 30;
  m.caseIds = m.caseIds.filter((id) => { const c = W().cases[id]; if (c && c.year < cutoff) { delete W().cases[id]; return false; } return !!c; });
}

/** Counts for the career page (no patient names). */
export function caseStats(m = med()) {
  const all = (m?.caseIds ?? []).map((id) => W().cases[id]).filter((c) => c?.status === 'closed');
  const by = { good: 0, fair: 0, poor: 0 };
  for (const c of all) by[c.outcome.result] += 1;
  const judged = all.length ? Math.round(all.reduce((t, c) => t + c.outcome.points, 0) / all.length) : null;
  return { total: m?.experience.cases ?? 0, kept: all.length, ...by, judgment: judged, procedures: m?.experience.procedures ?? 0, assisted: m?.experience.assisted ?? 0 };
}
export { qualified };
