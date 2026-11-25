// Law school and admission to practice. The education engine still owns enrolling, fees, the years and the degree
// (engine/education.js, program 'law'); this adds what makes law school its own thing: an entrance exam where the
// country has one, first-year courses then electives, short exams on hypotheticals, moot court, mock trial, a
// supervised clinic, internships with supervisors who stay in the player's life, and then the bar: preparation, the
// exam (which can be failed and retaken), a character and fitness review, and admission. A law degree is not a license.
//
// Time runs on one absolute month (year × 12 + month, the World Clock in engine/turns.js), so three-, six- and
// twelve-month turns reach the same terms and sittings: nothing is counted per button press.
import { rng } from '../rng.js';
import { clamp, localCost, fmtMoney } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { recordEvent, archiveIdOf } from './chronicle.js';
import { systemFor, OFFENSE_BY_ID } from '../data/justice.js';
import { convictionsOf } from './records.js';
import { rule } from './rules.js';
import { COUNTRIES } from '../data/countries.js';
import { COUNTRY_LAW, LAW_PROFILES, LEGAL_SKILLS, CORE_COURSES, ELECTIVES, COURSE_BY_ID, SCHOOL_ACTS, INTERNSHIPS, INTERNSHIP_BY_ID, BAR_SUBJECTS, BAR_PASS, SPECIALTY_BY_ID } from '../data/law.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });

// ---------- Shared state ----------

/** The game's month, counted from year 0: the one clock everything legal runs on. */
export const nowM = (state = store.state) => state.year * 12 + (state.month ?? 0);

/** Everything legal about a person: school, the bar, skills, reputation, cases. Created on first use. */
export function lawOf(p = player()) {
  if (!p.law) {
    const base = Math.round(6 + (p.stats?.intellect ?? 50) / 10);
    p.law = { v: 1, skills: Object.fromEntries(LEGAL_SKILLS.map((s) => [s.id, base])),
      rep: { integrity: 55, clients: 50, advocacy: 35, preparation: 45, reliability: 50, recognition: 5 },
      entrance: null, school: null, bar: { attempts: [], prep: null, fitness: null, admitted: null }, internships: [], acts: {},
      caseIds: [], history: [], seen: {}, specialty: null };
  }
  return p.law;
}
/**
 * How lawyers are trained and admitted where someone lives: the justice family's profile, with the country's own
 * documented route laid over it where Pathways has one ('documented'), otherwise labeled 'simplified'.
 */
export function profileFor(countryId = player().countryId) {
  const base = LAW_PROFILES[systemFor(countryId).id];
  const own = COUNTRY_LAW[countryId];
  const depth = countryId === 'us' ? 'full' : own ? 'documented' : 'simplified';
  return { ...base, ...(own ?? {}), entrance: own?.entrance ?? (countryId === 'us' ? base.entrance : { id: 'none', name: '', required: false }), training: own?.training ?? 0,
    depth, family: systemFor(countryId).id, name: own?.name ?? base.name, note: own?.note ?? (depth === 'simplified' ? base.note : own ? 'The route is the documented one; how it plays is simplified.' : base.note) };
}

/** Raises legal skills, softly: each point is harder to gain the higher it is. */
export function gain(p, gains, k = 1) {
  const L = lawOf(p);
  for (const [id, n] of Object.entries(gains ?? {})) {
    const cur = L.skills[id] ?? 10;
    L.skills[id] = Math.round(clamp(cur + n * k * (1.15 - cur / 110)) * 10) / 10;
  }
}
const avg = (L, ids) => ids.reduce((s, id) => s + (L.skills[id] ?? 10), 0) / ids.length;
const aid = () => archiveIdOf(player());

/** Records a milestone of a legal life once, ever, under a key (engine/chronicle.js); restricted details stay private. */
export function canon(key, title, text, o = {}) {
  const ev = recordEvent({ key, type: 'legal_career', title, text, significance: o.sig ?? 2, privacy: o.privacy ?? 'family', ...(o.extra ?? {}) });
  if (ev.year === store.state.year && !ev.logged) { ev.logged = true; if (o.milestone !== false) milestone(title.endsWith('.') ? title : `${title}.`, 'career'); }
  return ev;
}

// ---------- The entrance exam ----------

/** The entrance exam where one is asked for: the LSAT in the United States. Null where admission does not use one. */
export function entrance(p = player()) {
  const prof = profileFor(p.countryId);
  if (prof.entrance.id === 'none') return null;
  if (prof.entrance.id === 'lsat' && store.state.year < 1948) return null; // the LSAT was first given in 1948
  const L = lawOf(p);
  const e = L.entrance ?? {};
  const ready = p.age >= 18 && (p.education.degrees.some((d) => d.type === 'university') || (p.education.stage === 'university' && p.education.yearInStage >= 2));
  return { id: prof.entrance.id, name: prof.entrance.name, required: prof.entrance.required, best: e.best ?? null, tries: e.tries ?? 0, ready,
    canSit: ready && (e.lastM == null || nowM() - e.lastM >= 3), canPrep: ready && (e.prepM == null || nowM() - e.prepM >= 3) };
}
/** A few months of practice tests. */
export function prepEntrance(p = player()) {
  const x = entrance(p);
  if (!x) return result(false, 'There is no entrance exam here.', 'neutral');
  if (!x.canPrep) return result(false, x.ready ? 'You have just spent months on practice tests. Sit it, or give it time.' : 'It is taken near the end of a first degree.', 'neutral');
  const L = lawOf(p);
  L.entrance = { ...(L.entrance ?? {}), prepM: nowM(), prep: Math.min(3, (L.entrance?.prep ?? 0) + 1) };
  gain(p, { analysis: 2, research: 1 });
  return result(true, `You worked through practice ${x.name} tests, timed, at the kitchen table.`, 'neutral');
}
/** Sits it. Scored 120 to 180 for the LSAT; the best score counts. */
export function sitEntrance(p = player()) {
  const x = entrance(p);
  if (!x?.canSit) return result(false, !x ? 'There is no entrance exam here.' : !x.ready ? 'It is taken near the end of a first degree.' : 'The next sitting is a few months away.', 'neutral');
  const L = lawOf(p);
  const prep = L.entrance?.prep ?? 0;
  const raw = clamp((p.stats.intellect - 40) / 60 * 0.55 + avg(L, ['analysis', 'research']) / 100 * 0.25 + prep * 0.06 + (rng.next() - 0.5) * 0.25, 0, 1);
  const score = Math.round(120 + raw * 60);
  L.entrance = { ...(L.entrance ?? {}), lastM: nowM(), tries: x.tries + 1, best: Math.max(score, x.best ?? 0), last: score, prep: 0 };
  log(`You sat the ${x.name} and scored ${score}${x.best && score <= x.best ? `; your best is still ${x.best}` : ''}.`, 'system', score >= 160 ? 'good' : 'neutral');
  return result(true, `You scored ${score} on the ${x.name}.`, score >= 160 ? 'good' : 'neutral', { score });
}
/** What the entrance exam adds to a law school application (engine/education.js admissionChance). */
export function entranceEdge(p = player()) {
  const x = entrance(p);
  if (!x?.best) return 0;
  return clamp((x.best - 152) / 60, -0.25, 0.35);
}
/** Why the player cannot apply to law school yet, or ''. */
export const applyBlock = (p = player()) => { const x = entrance(p); return x?.required && !x.best ? `Needs an ${x.name} score first. Sit it from Law School on the Work tab.` : ''; };

// ---------- Terms and courses ----------

const enrolled = (p) => p.education.enrolled && p.education.stage === 'law';
/** The current school record, started when the player first turns up as a law student. */
export function school(p = player()) {
  const L = lawOf(p);
  if (enrolled(p) && (!L.school || L.school.done)) {
    L.school = { start: nowM(), terms: [], electives: [], probation: false, done: false, schoolName: p.education.schoolName ?? null };
    canon(`law:start:${aid()}:${L.school.start}`, 'Started law school', `Began a ${profileFor(p.countryId).degree} at ${p.education.schoolName ?? 'law school'}.`);
    openTerm(p, L.school.start);
  }
  return L.school;
}
const termOf = (S) => S?.terms.at(-1) ?? null;
/** A new term: first-year core courses for the first two, then electives. */
function openTerm(p, start) {
  const S = lawOf(p).school;
  const n = S.terms.length;
  let courses;
  if (n === 0) courses = ['contracts', 'torts', 'civpro', 'lrw'];
  else if (n === 1) courses = ['crimlaw', 'conlaw', 'property'];
  else {
    const chosen = S.electives.filter((id) => !S.terms.some((t) => t.courses.includes(id))).slice(0, 2);
    const want = SPECIALTY_BY_ID[lawOf(p).specialty]?.id;
    const fill = ELECTIVES.filter((e) => !chosen.includes(e.id) && !S.terms.some((t) => t.courses.includes(e.id)))
      .sort((a, b) => (b.leads.includes(want) ? 1 : 0) - (a.leads.includes(want) ? 1 : 0));
    courses = [...chosen, ...fill.map((e) => e.id)].slice(0, 2);
    S.electives = S.electives.filter((id) => !courses.includes(id));
  }
  const qs = courses.map((id) => ({ course: id, i: rng.int(0, COURSE_BY_ID[id].exam.length - 1) })).slice(0, 2);
  S.terms.push({ n, start, end: start + 6, courses, exam: { qs, answers: null, right: null }, grades: null, gpa: null });
}
/** Electives open to choose for the next term. Two per term. */
export function electiveOptions(p = player()) {
  const S = school(p);
  if (!S) return [];
  const taken = new Set(S.terms.flatMap((t) => t.courses));
  return ELECTIVES.map((e) => ({ id: e.id, name: e.name, leads: e.leads, taken: taken.has(e.id), chosen: S.electives.includes(e.id) }));
}
export function chooseElective(id, p = player()) {
  const S = school(p);
  if (!S) return result(false, 'You are not at law school.', 'neutral');
  if (S.terms.length < 2 && S.terms.length + 1 < 2) return result(false, 'The first year is set for everyone.', 'neutral');
  if (!ELECTIVES.some((e) => e.id === id)) return result(false, 'There is no such course.', 'neutral');
  if (S.terms.some((t) => t.courses.includes(id))) return result(false, 'You have taken it.', 'neutral');
  if (S.electives.includes(id)) { S.electives = S.electives.filter((x) => x !== id); return result(true, 'Taken off your list.', 'neutral'); }
  if (S.electives.length >= 2) return result(false, 'Two electives a term. Take one off first.', 'neutral');
  S.electives.push(id);
  return result(true, `${COURSE_BY_ID[id].name} is on your list for next term.`, 'neutral');
}

/** This term's exam: short hypotheticals from its courses, each with one best answer. Null once answered. */
export function termExam(p = player()) {
  const t = termOf(school(p));
  if (!t || t.exam.answers) return null;
  return { term: t.n, questions: t.exam.qs.map(({ course, i }) => ({ course, courseName: COURSE_BY_ID[course].name, ...COURSE_BY_ID[course].exam[i] })) };
}
/** Answers the term's exam. Each answer counts toward that course's grade; nothing here ends a legal career. */
export function answerExam(answers, p = player()) {
  const ex = termExam(p);
  if (!ex) return result(false, 'There is no exam to sit now.', 'neutral');
  const t = termOf(lawOf(p).school);
  t.exam.answers = answers.slice(0, ex.questions.length);
  t.exam.right = ex.questions.map((qq, i) => answers[i] === qq.right);
  const n = t.exam.right.filter(Boolean).length;
  gain(p, { analysis: n, research: 1 });
  if (t.n === 0) canon(`law:firstExam:${aid()}`, 'First law school exam', `Sat a first exam in ${ex.questions.map((x) => x.courseName).join(' and ')}.`, { milestone: false, sig: 1 });
  return result(n === ex.questions.length, n === ex.questions.length ? 'You knew exactly what each question was testing.' : n ? 'Some of it went well.' : 'You spotted the wrong issues. It happens to everyone once.',
    n === ex.questions.length ? 'good' : 'neutral', { right: t.exam.right, explain: ex.questions.map((qq) => qq.why) });
}

const LETTER = (g) => (g >= 3.85 ? 'A' : g >= 3.5 ? 'A-' : g >= 3.15 ? 'B+' : g >= 2.85 ? 'B' : g >= 2.5 ? 'B-' : g >= 2.15 ? 'C+' : g >= 1.85 ? 'C' : g >= 1 ? 'D' : 'F');
/** Grades a term that has ended: what the student knows, how they prepared, and the exam, if they sat it. */
function gradeTerm(p, t) {
  const L = lawOf(p);
  const studied = L.acts[`study:${t.n}`] ? 0.2 : 0;
  t.grades = {};
  for (const id of t.courses) {
    const c = COURSE_BY_ID[id];
    const skill = avg(L, Object.keys(c.skills));
    const qi = t.exam.qs.findIndex((x) => x.course === id);
    const exam = qi < 0 || !t.exam.right ? 0 : t.exam.right[qi] ? 0.35 : -0.35;
    const g = clamp(2.85 + (skill - 20) / 50 + (p.stats.intellect - 55) / 80 + studied + exam + (rng.next() - 0.5) * 0.6, 0, 4);
    t.grades[id] = Math.round(g * 100) / 100;
    gain(p, c.skills, 0.8);
  }
  const vals = Object.values(t.grades);
  t.gpa = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100;
  const S = L.school;
  if (t.gpa < 2.0) { S.probation = true; log(`Your law school grades this term averaged ${LETTER(t.gpa)}. The dean has put you on academic probation; it lifts with a better term.`, 'system', 'bad'); }
  else if (S.probation && t.gpa >= 2.3) { S.probation = false; log('A better term: you are off academic probation.', 'system', 'good'); }
  else log(`Law school grades this term: ${Object.entries(t.grades).map(([id, g]) => `${COURSE_BY_ID[id].name} ${LETTER(g)}`).join(', ')}.`);
}
/** Terms in a law degree: three years of two terms. */
export const TERMS = 6;
/** Terms a law degree takes where the player studies: two a year, for the country's documented length. */
export const termsFor = (p = player()) => (profileFor(p.countryId).afterBachelor && profileFor(p.countryId).degreeYears ? profileFor(p.countryId).degreeYears * 2 : TERMS);
/** Terms finished and graded. Law school ends after TERMS of them, however the turns fall. */
export const termsDone = (p = player()) => (p.law?.school?.terms ?? []).filter((t) => t.gpa != null).length;

/** The law school GPA so far, or null. Used for the degree (engine/education.js). */
export function lawGpa(p = player()) {
  const ts = (p.law?.school?.terms ?? []).filter((t) => t.gpa != null);
  if (!ts.length) return null;
  return Math.round(ts.reduce((s, t) => s + t.gpa, 0) / ts.length * 100) / 100;
}
export const letter = LETTER;

// ---------- Moot court, mock trial, clinic, study ----------

const schoolYear = (p) => { const S = lawOf(p).school; return S ? Math.floor((nowM() - S.start) / 12) : 0; };
/** What a law student can do now, and what is done for this year. */
export function schoolActs(p = player()) {
  const S = school(p);
  if (!S || S.done) return [];
  const L = lawOf(p);
  const y = schoolYear(p);
  const t = termOf(S);
  return SCHOOL_ACTS.map((a) => {
    const key = a.id === 'study' ? `study:${t.n}` : `${a.id}:${y}`;
    const locked = a.from && y < a.from ? `From your ${a.from === 1 ? 'second' : 'third'} year` : '';
    return { ...a, done: !!L.acts[key], locked, key };
  });
}

/** A study act. Moot court and mock trial have their own exercises (mootCourt, mockTrial); the clinic opens a case. */
export function doSchoolAct(id, p = player()) {
  const a = schoolActs(p).find((x) => x.id === id);
  if (!a) return result(false, 'Not open to you now.', 'neutral');
  if (a.locked) return result(false, a.locked, 'neutral');
  if (a.done) return result(false, 'Done for now.', 'neutral');
  if (['moot', 'mock', 'clinic'].includes(id)) return result(false, 'That one has its own screen.', 'neutral');
  const L = lawOf(p);
  L.acts[a.key] = nowM();
  gain(p, a.gains);
  if (a.friend) {
    const mate = keepPerson(p, 'studyMate', 'friend', 'Law school classmate', rng.int(22, 30));
    return result(true, `You joined a study group. ${mate.firstName} ${mate.lastName} turns out to explain civil procedure better than the professor.`, 'good');
  }
  if (a.mentor) {
    const prof = keepPerson(p, 'lawProfessor', 'mentor', 'Law professor', rng.int(40, 66));
    const noticed = (prof.meters.relationship = clamp(prof.meters.relationship + rng.int(4, 9))) >= 62;
    if (noticed) canon(`law:professor:${aid()}`, 'A professor noticed your work', `Professor ${prof.lastName} took an interest in your writing.`, { milestone: false, sig: 1 });
    return result(true, noticed ? `Professor ${prof.lastName} asks if you have thought about a research assistant job.` : `Professor ${prof.lastName} walks you through the problem you got wrong.`, 'good');
  }
  return result(true, 'You studied hard for the exams.', 'good');
}

/** A person who stays in the player's life, created once for a part of their legal story. */
export function keepPerson(p, tag, role, title, age) {
  const id = lawOf(p).people?.[tag];
  const had = id && store.state.npcs[id];
  if (had?.alive) return had;
  const n = makeNpc({ role, countryId: p.countryId, age, relationship: rng.int(42, 58) });
  n.flags.title = title; n.flags.lawTag = tag;
  store.state.npcs[n.id] = n;
  p.npcIds.push(n.id);
  (lawOf(p).people ??= {})[tag] = n.id;
  return n;
}

/** Moot court: research the question, write the brief, answer the bench. Appellate argument, not a trial. */
export function mootCourt(p = player()) {
  const a = schoolActs(p).find((x) => x.id === 'moot');
  if (!a || a.locked || a.done) return null;
  const pool = ELECTIVES.filter((e) => ['appellate', 'admin', 'crimpro', 'evidence'].includes(e.id));
  const c = pool[(schoolYear(p) + (lawOf(p).school?.start ?? 0)) % pool.length];
  return { problem: c.exam[0], brief: [['Lead with the strongest legal error, and the record that shows it', 'strong'], ['Argue every possible point at equal length', 'scattered'], ['Argue that the result was unfair', 'merits']],
    bench: { text: 'A judge interrupts: "Counsel, does your rule not open the door to every case like this?"', options: [['Answer directly, and explain the limit of the rule', 'strong'], ['Change the subject back to your outline', 'dodge'], ['Say the judge has misunderstood', 'rude']] } };
}
export function finishMoot(answers, p = player()) {
  const m = mootCourt(p);
  if (!m) return result(false, 'Moot court is not open to you now.', 'neutral');
  const L = lawOf(p);
  L.acts[`moot:${schoolYear(p)}`] = nowM();
  const pts = (answers.research === m.problem.right ? 1 : 0) + (answers.brief === 'strong' ? 1 : 0) + (answers.bench === 'strong' ? 1 : answers.bench === 'rude' ? -1 : 0);
  const score = pts + avg(L, ['appellate', 'oral', 'research']) / 40 + (rng.next() - 0.5);
  gain(p, { appellate: 3, oral: 2, research: 1 });
  const place = score >= 3.6 ? 'won' : score >= 2.4 ? 'reached the semifinal' : 'went out in the first round';
  if (place === 'won') { L.honors = [...(L.honors ?? []), `Moot court champion, ${store.state.year}`]; canon(`law:moot:${aid()}:${store.state.year}`, 'Won the moot court competition', 'Argued and won the final before a bench of judges.', { sig: 2 }); }
  return result(place !== 'went out in the first round', `You ${place} of the moot court competition.`, place === 'won' ? 'good' : 'neutral', { place });
}

/** Mock trial: an objection and a cross-examination, from a training case file. */
export function mockTrial(p = player()) {
  const a = schoolActs(p).find((x) => x.id === 'mock');
  if (!a || a.locked || a.done) return null;
  return { objection: { text: 'Opposing counsel asks your witness: "Your sister told you the car was red, didn\'t she?"', valid: 'hearsay',
    options: [['Object: hearsay', 'hearsay'], ['Object: leading', 'leading'], ['Let it go', 'none']] },
  cross: { text: 'Their witness says the driver ran the light. The file shows the witness was facing the other way.', good: 'facing',
    options: [['Ask which way they were facing when they heard the crash', 'facing'], ['Ask them to repeat what they saw', 'repeat'], ['Ask about their job', 'improper']] } };
}
export function finishMock(answers, p = player()) {
  const m = mockTrial(p);
  if (!m) return result(false, 'Mock trial is not open to you now.', 'neutral');
  const L = lawOf(p);
  L.acts[`mock:${schoolYear(p)}`] = nowM();
  const pts = (answers.objection === m.objection.valid ? 1 : answers.objection === 'none' ? 0 : -0.5) + (answers.cross === m.cross.good ? 1 : answers.cross === 'improper' ? -0.5 : 0);
  gain(p, { oral: 2, examination: 2, cross: 1, procedure: 1 });
  const score = pts + avg(L, ['oral', 'cross', 'procedure']) / 45 + (rng.next() - 0.5) * 0.8;
  const good = score >= 2;
  return result(good, good ? 'Your team won its round of mock trial. The judge singled out your cross-examination.' : 'Your team lost its round, but you learned more from losing than you would have from winning.', good ? 'good' : 'neutral');
}

// ---------- Internships ----------

/** Placements open this year. One a year, while at law school. */
export function internshipOptions(p = player()) {
  const S = school(p);
  if (!S || S.done) return [];
  const y = schoolYear(p);
  const L = lawOf(p);
  const had = L.internships.some((x) => x.year === y);
  return INTERNSHIPS.map((x) => ({ ...x, locked: had ? 'One placement a year' : '', done: L.internships.some((i) => i.id === x.id && i.year === y) }));
}
/** Applies. The supervisor stays in the player's life and may give a reference later; it never guarantees a job. */
export function applyInternship(id, p = player()) {
  const o = internshipOptions(p).find((x) => x.id === id);
  if (!o) return result(false, 'There is no such placement.', 'neutral');
  if (o.locked) return result(false, o.locked, 'neutral');
  const L = lawOf(p);
  const gpa = lawGpa(p) ?? 3;
  const chance = clamp(0.3 + (gpa - 3) * 0.5 + avg(L, ['research', 'writing']) / 200 + (id === 'firm' ? -0.1 : 0.1), 0.08, 0.92);
  const y = schoolYear(p);
  if (!rng.chance(chance)) { L.internships.push({ id, year: y, m: nowM(), got: false }); return result(false, `The ${o.name.toLowerCase()} went to someone else this year.`, 'neutral'); }
  const sup = keepPerson(p, `intern_${id}`, 'mentor', o.who, rng.int(36, 62));
  gain(p, o.gains, 1.5);
  if (o.pay) { const pay = localCost(o.pay, country()); p.finance.cash += pay; p.finance.lifetimeEarned += pay; }
  L.internships.push({ id, year: y, m: nowM(), got: true, supervisorId: sup.id, leads: o.leads });
  canon(`law:intern:${aid()}:${id}:${y}`, `A ${o.name.toLowerCase()}`, `Worked under ${sup.firstName} ${sup.lastName}, ${o.who.toLowerCase()}.`, { milestone: false, sig: 1 });
  return result(true, `You got the ${o.name.toLowerCase()}. ${sup.firstName} ${sup.lastName} will supervise you.${o.pay ? ` It pays ${fmtMoney(localCost(o.pay, country()), country())}.` : ''}`, 'good');
}
/** A supervisor who thought well of the player: a reference, for the kind of work they supervised. */
export function referenceFor(careerId, p = player()) {
  for (const i of lawOf(p).internships.filter((x) => x.got && x.leads === careerId)) {
    const n = store.state.npcs[i.supervisorId];
    if (n?.alive && n.meters.relationship >= 55) return n;
  }
  return null;
}

// ---------- Graduation and the bar ----------

/** Has a law degree, or (before 1900, in common-law countries) has read the law with a practicing lawyer. */
export const hasLawDegree = (p = player()) => p.education.degrees.some((d) => d.type === 'law') || !!p.law?.readLaw?.done;

// ---------- Reading the law (before 1900) ----------

/** Before law schools were the way in, a would-be lawyer read the law in a practicing lawyer's office. */
export function canReadLaw(p = player()) {
  const fam = profileFor(p.countryId).family;
  if (store.state.year >= 1900) return 'Law school is the way in now.';
  if (!['american', 'jury', 'bench'].includes(fam)) return 'Not the way in here.';
  if (p.age < 17) return 'From 17.';
  if (p.law?.readLaw) return p.law.readLaw.done ? 'You have read the law.' : 'You are reading the law now.';
  return '';
}
/** Starts two years in a lawyer's office: copying, reading and watching. */
export function startReadingLaw(p = player()) {
  const why = canReadLaw(p);
  if (why) return result(false, why, 'neutral');
  const L = lawOf(p);
  const mentor = keepPerson(p, 'readLawMentor', 'mentor', 'Practicing lawyer', rng.int(40, 66));
  L.readLaw = { start: nowM(), until: nowM() + 24, mentorId: mentor.id, done: false };
  canon(`law:readLaw:${aid()}`, 'Began reading the law', `In the office of ${mentor.firstName} ${mentor.lastName}.`, { sig: 2 });
  return result(true, `You start reading the law in the office of ${mentor.firstName} ${mentor.lastName}: two years of copying, reading and watching.`, 'good');
}
function progressReading(p) {
  const R = p.law?.readLaw;
  if (!R || R.done || nowM() < R.until) return;
  R.done = nowM();
  gain(p, { research: 8, writing: 6, procedure: 6, drafting: 5, counseling: 4 });
  log(`You have read the law for two years. ${store.state.npcs[R.mentorId]?.firstName ?? 'Your mentor'} says you are ready to be examined for the bar.`, 'system', 'good');
}
/** The bar exam by the era: an oral examination before a committee of the bar, before 1900. */
export const barExamName = (p = player()) => (store.state.year < 1900 && ['american', 'jury', 'bench'].includes(profileFor(p.countryId).family) ? 'oral examination before a committee of the bar' : profileFor(p.countryId).exam);
export const admitted = (p = player()) => !!lawOf(p).bar.admitted;

/** Where the player stands with the bar. */
export function barStatus(p = player()) {
  const L = lawOf(p);
  const B = L.bar;
  const prof = profileFor(p.countryId);
  if (B.admitted) return { stage: 'admitted', text: `Admitted ${B.admitted.year}, ${B.admitted.where}.`, prof };
  if (B.fitness === 'barred') return { stage: 'barred', text: `Women cannot yet be admitted to practice in ${COUNTRY_NAME(p.countryId)}. Your exam result stands for when they can.`, prof };
  if (B.training && !B.training.done) return { stage: 'training', text: `In ${B.training.name}: ${Math.max(0, B.training.until - nowM())} months to go before ${prof.admission}.`, prof };
  if (!hasLawDegree(p)) return { stage: 'none', text: 'Taken after a law degree.', prof };
  const last = B.attempts.at(-1);
  const wait = last ? Math.max(0, 6 - (nowM() - last.m)) : 0;
  if (B.fitness === 'deferred' && nowM() - (B.fitnessM ?? 0) < 24) return { stage: 'fitness', text: `The ${prof.fitness} put your admission off. You can ask again in ${24 - (nowM() - B.fitnessM)} months.`, prof };
  return { stage: wait ? 'waiting' : 'open', wait, attempts: B.attempts.length, passedExam: B.attempts.some((a) => a.passed), prepared: !!B.prep && (!last || B.prep.m > last.m), prof,
    text: wait ? `The next sitting is in ${wait} months.` : `You can sit the ${barExamName(p)}.` };
}
/** Preparation for the next sitting: a course (paid) or study alone. */
export function prepareBar(kind = 'self', p = player()) {
  const s = barStatus(p);
  if (!['open', 'waiting'].includes(s.stage)) return result(false, s.text, 'neutral');
  if (s.prepared) return result(false, 'You are already prepared for the next sitting.', 'neutral');
  const L = lawOf(p);
  const cost = kind === 'course' ? localCost(2600, country()) : 0;
  if (cost && p.finance.cash < cost) return result(false, `A bar course costs ${fmtMoney(cost, country())}.`, 'neutral');
  p.finance.cash -= cost;
  L.bar.prep = { kind, m: nowM(), edge: kind === 'course' ? 0.1 : 0.05 + (p.hidden.discipline - 50) / 1000 };
  gain(p, { research: 1, analysis: 2, interpretation: 1 });
  return result(true, kind === 'course' ? `You signed up for a bar course: ${fmtMoney(cost, country())}, and ten weeks of practice questions.` : 'You made a study plan and kept to most of it.', 'neutral');
}
/** The exam's questions: drawn from the core subjects. */
export function barExam(p = player()) {
  const s = barStatus(p);
  if (s.stage !== 'open') return null;
  const L = lawOf(p);
  const seed = L.bar.attempts.length;
  const subjects = BAR_SUBJECTS.map((id, i) => BAR_SUBJECTS[(i + seed * 3) % BAR_SUBJECTS.length]).slice(0, 4);
  return { name: barExamName(p), questions: subjects.map((id) => { const c = COURSE_BY_ID[id]; return { course: id, courseName: c.name, ...c.exam[seed % c.exam.length] }; }) };
}
/**
 * Sits the bar exam. Points from the answers, from what the player knows and from preparation; a pass needs
 * BAR_PASS of the points. On a pass comes the character and fitness review, then admission.
 */
export function takeBar(answers = [], p = player()) {
  const ex = barExam(p);
  if (!ex) return result(false, barStatus(p).text, 'neutral');
  const L = lawOf(p);
  const fee = localCost(800, country());
  if (p.finance.cash < fee) return result(false, `The exam fee is ${fmtMoney(fee, country())}.`, 'neutral');
  p.finance.cash -= fee;
  const right = ex.questions.filter((qq, i) => answers[i] === qq.right).length / ex.questions.length;
  const prep = L.bar.prep && L.bar.prep.m > (L.bar.attempts.at(-1)?.m ?? -1) ? L.bar.prep.edge : -0.04;
  const know = avg(L, ['research', 'analysis', 'interpretation', 'procedure', 'evidence']) / 100;
  const gpa = (p.education.degrees.filter((d) => d.type === 'law').at(-1)?.gpa ?? 3) - 3; // reading the law: an even 3.0
  const score = clamp(right * 0.38 + know * 0.3 + gpa * 0.1 + 0.27 + prep + Math.min(0.06, L.bar.attempts.length * 0.02) + (rng.next() - 0.5) * 0.16, 0, 1);
  const passed = score >= BAR_PASS;
  L.bar.attempts.push({ m: nowM(), year: store.state.year, score: Math.round(score * 100), passed });
  if (!passed) {
    p.stats.mood = clamp(p.stats.mood - 8);
    canon(`law:barFail:${aid()}:${L.bar.attempts.length}`, 'Did not pass the bar exam', `Sat the ${ex.name} and did not pass.`, { milestone: false, privacy: 'private', sig: 1 });
    return result(false, `You did not pass the ${ex.name}. Many good lawyers fail it once. You can sit it again at the next sitting, in six months, or use the degree another way.`, 'bad', { score });
  }
  return fitness(p, ex.name);
}
/** Character and fitness: an honest record is enough; serious recent convictions put admission off. */
function fitness(p, examName) {
  const L = lawOf(p);
  // Historical Eras: in many countries women could study law long before they could be admitted (data/history.js).
  if ((p.flags?.trueGender ?? p.gender) === 'female' && !rule('womenInLaw', p.countryId)) {
    L.bar.fitness = 'barred'; L.bar.fitnessM = nowM();
    return result(false, `You passed the ${examName}, but in ${COUNTRY_NAME(p.countryId)} in ${store.state.year} women cannot yet be admitted to practice law. You can work in the law in other ways until that changes.`, 'bad');
  }
  const recent = convictionsOf(p).filter((r) => (r.year ?? 0) >= store.state.year - 10 && (OFFENSE_BY_ID[r.crimeId]?.severity ?? 1) >= 3);
  const prof = profileFor(p.countryId);
  if (recent.length) {
    L.bar.fitness = 'deferred'; L.bar.fitnessM = nowM();
    return result(false, `You passed the ${examName}, but the ${prof.fitness} put your admission off because of your record. You may ask again in two years.`, 'bad');
  }
  L.bar.fitness = 'cleared';
  if (prof.training) {
    // Practical training comes between the exam and admission: articling, pupillage, the Referendariat...
    L.bar.training = { from: nowM(), until: nowM() + prof.training, name: prof.trainingName };
    canon(`law:barPass:${aid()}`, `Passed the ${examName}`, `Began ${prof.trainingName}.`, { privacy: 'public', sig: 2 });
    return result(true, `You passed the ${examName}. Next comes ${prof.trainingName}: ${prof.training} months before ${prof.admission}.`, 'good');
  }
  return admit(p, examName);
}
/** Admission to practice, at the end of the route. */
function admit(p, examName) {
  const L = lawOf(p);
  const prof = profileFor(p.countryId);
  L.bar.training = L.bar.training ? { ...L.bar.training, done: nowM() } : null;
  L.bar.admitted = { year: store.state.year, m: nowM(), where: COUNTRY_NAME(p.countryId), body: prof.admission };
  (p.flags.licenses ??= []).includes('law') || p.flags.licenses.push('law');
  p.stats.mood = clamp(p.stats.mood + 12);
  canon(`law:admitted:${aid()}`, 'Admitted to practice law', `Passed the ${examName}${L.bar.attempts.length > 1 ? ` at the ${['', 'first', 'second', 'third', 'fourth'][L.bar.attempts.length] ?? 'latest'} attempt` : ''} and was granted ${prof.admission}.`, { sig: 3, privacy: 'public' });
  return result(true, `You passed the ${examName}. After the ${prof.fitness}, you are admitted to practice: ${prof.admission}.`, 'good');
}
const COUNTRY_NAME = (id) => COUNTRIES[id]?.name ?? id;

/** Called when the law degree is conferred (engine/education.js): the record closes, and the bar opens. */
export function graduated(p = player()) {
  const L = lawOf(p);
  const S = L.school;
  if (!S || S.done) return;
  const t = termOf(S);
  if (t && t.gpa == null) gradeTerm(p, t);
  S.done = true; S.endM = nowM();
  const deg = p.education.degrees.filter((d) => d.type === 'law').at(-1);
  if (deg && lawGpa(p) != null) deg.gpa = lawGpa(p); // the degree carries the transcript's final GPA, every term counted
  canon(`law:grad:${aid()}:${S.start}`, 'Graduated from law school', `Earned a ${profileFor(p.countryId).degree}${lawGpa(p) != null ? ` with a ${lawGpa(p).toFixed(2)} GPA` : ''}.`, { sig: 3, privacy: 'public' });
  log(`You graduated from law school. A degree is not a license: next comes the ${profileFor(p.countryId).exam}.`, 'system', 'good');
}

/**
 * Moves law school on to the present month: terms that have ended are graded and the next one opens. Runs on every
 * turn and at the turn of the year (engine/lawPractice.js tickLaw), so any turn length reaches the same terms.
 */
/** Training after the exam ends when its months are done, and admission follows. Run every turn (engine/lawPractice.js). */
export function progressBar(p = player()) {
  progressReading(p);
  const B = p.law?.bar;
  // When the law changes, a woman who passed the exam and was barred is admitted.
  if (B?.fitness === 'barred' && !B.admitted && rule('womenInLaw', p.countryId)) { B.fitness = 'cleared'; return admit(p, barExamName(p)); }
  if (B?.training && !B.training.done && !B.admitted && nowM() >= B.training.until) return admit(p, profileFor(p.countryId).exam);
  return null;
}

export function progressSchool(p = player()) {
  const S = school(p);
  if (!S || S.done) return;
  if (!enrolled(p)) return;
  let guard = 0;
  while (termOf(S) && termOf(S).end <= nowM() && guard++ < 12) {
    const t = termOf(S);
    gradeTerm(p, t);
    if (termsDone(p) >= termsFor(p)) break; // the last term is over: graduation follows
    openTerm(p, t.end);
  }
}
