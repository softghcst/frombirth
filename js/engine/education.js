// Education: compulsory school by age, effort and attendance, cliques, clubs,
// then university, graduate, medical and law school with tuition and funding.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, uid } from '../util.js';
import { store, player, country, npcsByRole, log, milestone } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { applyMods } from './genetics.js';
import { resolve } from './conditions.js';
import { SCHOOL_STAGES, SCHOOL_LEAVING_AGE, DROPOUT_AGE, PROGRAMMES, CLIQUES, CLIQUE_BY_ID,
  CLUBS, CLUB_BY_ID, MAX_CLUBS } from '../data/schools.js';
import { MAJOR_BY_ID } from '../data/majors.js';

const LABELS = { none: 'Not in school', elementary: 'Elementary school', middle: 'Middle school',
  high: 'High school', university: 'University', graduate: 'Graduate school',
  medical: 'Medical school', law: 'Law school' };
export const stageLabel = (stage) => LABELS[stage] ?? stage;
export const isHigher = (stage) => stage in PROGRAMMES;
const round2 = (n) => Math.round(n * 100) / 100;
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

/** One line for the header, e.g. "University · Biology". */
export function educationLine(p) {
  const e = p.education;
  const major = isHigher(e.stage) && MAJOR_BY_ID[e.majorId] ? ` · ${MAJOR_BY_ID[e.majorId].name}` : '';
  return stageLabel(e.stage) + major;
}

/** Per-year action counters; reset when the age changes. */
function acts() {
  const p = player();
  if (p.flags.eduActs?.age !== p.age) {
    p.flags.eduActs = { age: p.age, study: 0, slack: 0, skip: 0, clique: 0, applied: {} };
  }
  return p.flags.eduActs;
}

function checkChance(check) {
  let chance = check.base;
  for (const [path, w] of Object.entries(check.factors ?? {})) {
    chance += w * ((Number(resolve(path)) || 0) - 50) / 100;
  }
  return clamp(chance, 0.05, 0.95);
}

// ---------- Classmates ----------

/** Old classmates you were close to stay on as friends; the rest fade away. */
function turnOverClassmates(addNew) {
  const p = player();
  for (const n of npcsByRole('classmate')) {
    if (n.meters.relationship >= 60) n.role = 'friend';
    else { p.npcIds = p.npcIds.filter((id) => id !== n.id); delete store.state.npcs[n.id]; }
  }
  if (!addNew) return;
  const taken = new Set(p.npcIds.map((id) => store.state.npcs[id]?.firstName));
  for (let i = 0, n = rng.int(2, 3); i < n; i++) {
    const mate = makeNpc({ role: 'classmate', countryId: p.countryId, age: p.age + rng.int(-1, 1),
      relationship: rng.int(30, 65) });
    if (taken.has(mate.firstName)) continue;
    taken.add(mate.firstName);
    store.state.npcs[mate.id] = mate;
    p.npcIds.push(mate.id);
  }
}

// ---------- Money ----------

/** Tuition for one year of a programme, in local currency. */
export function tuitionFor(stage) {
  const c = country();
  return c.freeUniversity ? 0 : localMoney(PROGRAMMES[stage].tuition, c);
}

export const studentLoan = () => player().finance.loans.find((l) => l.kind === 'student');

function borrow(amount) {
  const p = player();
  let loan = studentLoan();
  if (!loan) {
    loan = { id: uid('loan'), kind: 'student', principal: 0, rate: 0.05, yearsLeft: 10 };
    p.finance.loans.push(loan);
  }
  loan.principal += amount;
  loan.yearsLeft = 10;
}

/** Pays one year of tuition according to the current funding arrangement. */
function chargeTuition() {
  const p = player();
  const e = p.education;
  const c = country();
  const fee = tuitionFor(e.stage);
  if (!fee || e.funding === 'scholarship' || e.funding === 'parents') return;
  if (e.funding === 'self' && p.finance.cash >= fee) {
    p.finance.cash -= fee;
    log(`You paid ${fmtMoney(fee, c)} in tuition.`);
    return;
  }
  if (e.funding === 'self') {
    e.funding = 'loan';
    log('You could not cover tuition from savings, so you took out a student loan.', 'system', 'bad');
  }
  borrow(fee);
  log(`${fmtMoney(fee, c)} of tuition was added to your student loan.`);
}

// ---------- Yearly step ----------

function enterStage(stage) {
  const e = player().education;
  e.stage = stage.id;
  e.enrolled = true;
  e.yearInStage = 0;
  turnOverClassmates(true);
  log(`You started ${stage.label}.`);
}

/** GPA earned this year from brains, discipline, effort, attendance and company kept. */
function yearGpa(p) {
  const e = p.education;
  const raw = p.stats.intellect * 0.55 + p.hidden.discipline * 0.15 + e.effort * 0.3;
  let g = raw / 25 + rng.around(0, 0.3);
  g -= e.absences * 0.12;
  if (isHigher(e.stage)) g -= MAJOR_BY_ID[e.majorId]?.difficulty ?? 0.3;
  if (e.stage === 'medical') g -= 0.25;
  if (e.stage === 'law') g -= 0.15;
  g += CLIQUE_BY_ID[e.clique]?.gpa ?? 0;
  return clamp(g, 0, 4);
}

function leaveSchool() {
  const e = player().education;
  e.enrolled = false;
  e.clique = null;
  e.clubs = [];
  e.funding = null;
  turnOverClassmates(false);
}

function graduate() {
  const p = player();
  const e = p.education;
  const gpa = e.gpa.toFixed(2);
  const major = MAJOR_BY_ID[e.majorId];
  e.degrees.push({ type: e.stage, majorId: isHigher(e.stage) ? e.majorId : undefined, gpa: e.gpa, age: p.age });
  const honours = e.gpa >= 3.7 ? ' with top honours' : e.gpa >= 3.3 ? ' with honours' : '';
  const what = {
    high: 'high school',
    university: `university with a degree in ${major?.name}`,
    graduate: `graduate school with a master's in ${major?.name}`,
    medical: 'medical school. You are a doctor',
    law: 'law school',
  }[e.stage];
  log(`You graduated from ${what}${e.stage === 'medical' ? '' : honours} (GPA ${gpa}).`, 'system', 'good');
  milestone(`Graduated ${stageLabel(e.stage).toLowerCase()}${major && isHigher(e.stage) ? ` (${major.name})` : ''}, GPA ${gpa}.`, 'education');
  p.stats.mood = clamp(p.stats.mood + 8);
  if (e.stage === 'high') log('You can apply for university from the Work & School tab.');
  const loan = studentLoan();
  if (loan && isHigher(e.stage)) log(`You owe ${fmtMoney(loan.principal, country())} in student loans. Repayments start once you are earning.`);
  leaveSchool();
}

export function tickEducation() {
  const p = player();
  const e = p.education;

  const starting = SCHOOL_STAGES.find((s) => s.start === p.age);
  if (starting && !e.expelled && !e.droppedOut) { enterStage(starting); return; }
  if (!e.enrolled) return;

  e.yearInStage += 1;
  const g = yearGpa(p);
  e.gpa = round2(e.gpa === 0 ? g : e.gpa * 0.6 + g * 0.4);
  p.stats.intellect = clamp(p.stats.intellect + rng.int(0, 2));

  // What you gained from the company you keep and the clubs you are in.
  const clique = CLIQUE_BY_ID[e.clique];
  if (clique) applyMods(p, clique.yearly);
  for (const id of e.clubs) if (CLUB_BY_ID[id]) applyMods(p, CLUB_BY_ID[id].yearly);
  if (isHigher(e.stage) && MAJOR_BY_ID[e.majorId]) applyMods(p, MAJOR_BY_ID[e.majorId].yearly);

  // Attendance
  if (e.absences >= 4 && !isHigher(e.stage)) {
    e.expelled = true;
    log('You missed so much school that you were expelled.', 'system', 'bad');
    p.stats.mood = clamp(p.stats.mood - 10);
    leaveSchool();
    return;
  }
  e.absences = 0;
  e.effort = Math.round(clamp(e.effort * 0.5 + (30 + p.hidden.discipline * 0.4) * 0.5));

  // Finishing, failing or carrying on
  if (e.stage === 'high' && p.age >= SCHOOL_LEAVING_AGE) return graduate();
  if (!isHigher(e.stage)) return;
  if (e.yearInStage >= PROGRAMMES[e.stage].years) return graduate();
  if (e.gpa < 1.2) {
    log(`Your grades collapsed and ${stageLabel(e.stage).toLowerCase()} asked you to leave.`, 'system', 'bad');
    p.stats.mood = clamp(p.stats.mood - 12);
    leaveSchool();
    return;
  }
  if (e.funding === 'scholarship' && e.gpa < 2.5) {
    e.funding = 'loan';
    log('Your grades slipped and you lost your scholarship.', 'system', 'bad');
  }
  chargeTuition();
}

// ---------- Actions while enrolled ----------

export function studyHard() {
  const p = player();
  const e = p.education;
  if (!e.enrolled) return result(false, 'You are not in school.');
  if (acts().study >= 1) return result(false, 'You have already put in extra hours this year.', 'neutral');
  acts().study += 1;
  e.effort = clamp(e.effort + 25);
  p.stats.intellect = clamp(p.stats.intellect + 1);
  p.stats.mood = clamp(p.stats.mood - 3);
  p.hidden.discipline = clamp(p.hidden.discipline + 1);
  const text = 'You put in extra hours with the books this year.';
  log(text, 'system', 'good');
  return result(true, text);
}

export function slackOff() {
  const p = player();
  const e = p.education;
  if (!e.enrolled) return result(false, 'You are not in school.');
  if (acts().slack >= 1) return result(false, 'You are already doing the bare minimum.', 'neutral');
  acts().slack += 1;
  e.effort = clamp(e.effort - 25);
  p.stats.mood = clamp(p.stats.mood + 4);
  p.hidden.discipline = clamp(p.hidden.discipline - 1);
  const text = 'You coasted through the year doing as little as possible.';
  log(text);
  return result(true, text, 'neutral');
}

export function skipSchool() {
  const p = player();
  const e = p.education;
  if (!e.enrolled) return result(false, 'You are not in school.');
  if (acts().skip >= 4) return result(false, 'You have barely been in as it is.', 'neutral');
  acts().skip += 1;
  e.absences += 1;
  p.stats.mood = clamp(p.stats.mood + 5);
  const caught = !isHigher(e.stage) && rng.chance(0.4);
  if (caught) {
    for (const parent of npcsByRole('parent')) {
      parent.meters.relationship = clamp(parent.meters.relationship - 5);
    }
    p.stats.mood = clamp(p.stats.mood - 7);
  }
  const text = caught
    ? 'You skipped school and the office phoned home. It was not a pleasant evening.'
    : isHigher(e.stage) ? 'You skipped a week of lectures.' : 'You skipped school and nobody noticed.';
  log(text, 'system', caught ? 'bad' : 'neutral');
  const warn = !isHigher(e.stage) && e.absences === 3 ? ' One more absence this year and you will be expelled.' : '';
  return result(true, text + warn, caught ? 'bad' : 'neutral');
}

/** @returns {{id, name, desc, allowed:boolean, current:boolean}[]} */
export function cliqueOptions() {
  const e = player().education;
  return CLIQUES.map((c) => ({
    id: c.id, name: c.name, desc: c.desc, current: e.clique === c.id,
    allowed: Object.entries(c.needs).every(([paths, min]) =>
      paths.split('|').some((path) => (Number(resolve(path)) || 0) >= min)),
  }));
}

export function joinClique(id) {
  const p = player();
  const e = p.education;
  const c = CLIQUE_BY_ID[id];
  if (e.stage !== 'high' || !e.enrolled) return result(false, 'Cliques are a high-school thing.');
  if (acts().clique >= 1) return result(false, 'You already changed who you sit with this year.', 'neutral');
  acts().clique += 1;
  if (!cliqueOptions().find((o) => o.id === id).allowed) {
    p.stats.mood = clamp(p.stats.mood - 5);
    const text = `You tried to sit with ${c.name}. They made it clear you were not one of them.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  e.clique = id;
  const text = id === 'loners' ? 'You decided to keep to yourself.' : `You fell in with ${c.name}.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** @returns {{id, name, joined:boolean, chance:number}[]} */
export function clubOptions() {
  const e = player().education;
  return CLUBS.map((c) => ({ id: c.id, name: c.name, joined: e.clubs.includes(c.id),
    chance: c.tryout ? checkChance(c.tryout) : 1 }));
}

export function joinClub(id) {
  const p = player();
  const e = p.education;
  const club = CLUB_BY_ID[id];
  if (!e.enrolled || e.stage === 'elementary') return result(false, 'There are no clubs for you to join yet.');
  if (e.clubs.includes(id)) return result(false, 'You are already a member.', 'neutral');
  if (e.clubs.length >= MAX_CLUBS) return result(false, `You only have time for ${MAX_CLUBS} clubs. Leave one first.`, 'neutral');
  const tried = acts().applied;
  if (tried[id]) return result(false, 'You already tried out this year. Come back next year.', 'neutral');
  tried[id] = true;
  if (club.tryout && !rng.chance(checkChance(club.tryout))) {
    p.stats.mood = clamp(p.stats.mood - 4);
    const text = `You tried out for the ${club.name.toLowerCase()} and did not make the cut.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  e.clubs.push(id);
  p.stats.mood = clamp(p.stats.mood + 4);
  const text = `You joined the ${club.name.toLowerCase()}.`;
  log(text, 'system', 'good');
  return result(true, text);
}

export function quitClub(id) {
  const e = player().education;
  if (!e.clubs.includes(id)) return result(false, 'You are not a member.');
  e.clubs = e.clubs.filter((c) => c !== id);
  const text = `You left the ${CLUB_BY_ID[id].name.toLowerCase()}.`;
  log(text);
  return result(true, text, 'neutral');
}

export const canDropOut = () => {
  const p = player();
  return p.education.enrolled && (isHigher(p.education.stage) || p.age >= DROPOUT_AGE);
};

export function dropOut() {
  const p = player();
  const e = p.education;
  if (!canDropOut()) return result(false, `You have to stay in school until you are ${DROPOUT_AGE}.`);
  const where = stageLabel(e.stage).toLowerCase();
  if (!isHigher(e.stage)) e.droppedOut = true;
  leaveSchool();
  for (const parent of npcsByRole('parent')) {
    parent.meters.relationship = clamp(parent.meters.relationship - 10);
  }
  const text = `You dropped out of ${where}.`;
  log(text, 'system', 'bad');
  milestone(`Dropped out of ${where}.`, 'education');
  return result(true, text, 'neutral');
}

// ---------- Higher education admissions ----------

const lastDegree = (type) => [...player().education.degrees].reverse().find((d) => d.type === type);

/**
 * Which programmes the player could apply to right now.
 * @returns {{id, label, blurb, years, tuition:number, eligible:boolean, reason:string}[]}
 */
export function programmeOptions() {
  const p = player();
  const e = p.education;
  return Object.values(PROGRAMMES).map((prog) => {
    const base = lastDegree(prog.needs);
    const bachelor = lastDegree('university');
    let reason = '';
    if (e.enrolled) reason = 'You are already studying.';
    else if (p.legal.incarceration) reason = 'Not from a cell.';
    else if (!base) reason = prog.needs === 'high' ? 'Needs a high-school diploma.' : 'Needs a university degree.';
    else if (e.degrees.some((d) => d.type === prog.id) && prog.id !== 'university') reason = 'You already hold this degree.';
    else if (base.gpa < prog.minGpa) reason = `Needs a GPA of ${prog.minGpa.toFixed(1)} (yours: ${base.gpa.toFixed(2)}).`;
    else if (prog.id === 'medical' && !MAJOR_BY_ID[bachelor.majorId]?.tracks.includes('medical')) reason = 'Needs a science or health degree.';
    else if (acts().applied[prog.id]) reason = 'You already applied this year.';
    return { id: prog.id, label: prog.label, blurb: prog.blurb, years: prog.years,
      tuition: tuitionFor(prog.id), eligible: !reason, reason };
  });
}

function admissionChance(progId, majorId) {
  const p = player();
  const iq = p.stats.intellect;
  if (progId === 'university') {
    const m = MAJOR_BY_ID[majorId];
    const gpa = lastDegree('high').gpa;
    if (gpa < m.minGpa) return 0;
    return clamp(0.45 + (gpa - m.minGpa) * 0.45 + (iq - 50) / 200 - m.difficulty * 0.2, 0.05, 0.97);
  }
  const b = lastDegree('university');
  const affinity = MAJOR_BY_ID[b.majorId]?.tracks.includes(progId) ? 0.15 : 0;
  if (progId === 'graduate') return clamp(0.5 + (b.gpa - 2.8) * 0.5 + (iq - 50) / 200, 0.05, 0.97);
  if (progId === 'medical') return clamp(0.3 + (b.gpa - 3.3) * 0.8 + (iq - 60) / 150, 0.05, 0.95);
  return clamp(0.35 + (b.gpa - 3.0) * 0.6 + (iq - 55) / 150 + affinity, 0.05, 0.95);
}

/**
 * Submits an application. One attempt per programme per year.
 * @returns {{accepted:boolean, text:string, scholarship?:string}}
 */
export function applyTo(progId, majorId) {
  const p = player();
  const prog = PROGRAMMES[progId];
  const major = MAJOR_BY_ID[progId === 'university' ? majorId : lastDegree('university').majorId];
  acts().applied[progId] = true;
  const subject = progId === 'university' ? ` to study ${major.name}` : '';

  if (!rng.chance(admissionChance(progId, majorId))) {
    p.stats.mood = clamp(p.stats.mood - 6);
    const text = `Your application to ${prog.label.toLowerCase()}${subject} was rejected. You can try again next year.`;
    log(text, 'system', 'bad');
    return { accepted: false, text };
  }

  // Scholarship offers go to the best grades and the best athletes.
  const base = lastDegree(prog.needs);
  let scholarship;
  if (tuitionFor(progId) > 0) {
    if (rng.chance(base.gpa >= 3.7 ? 0.75 : base.gpa >= 3.4 ? 0.3 : 0)) scholarship = 'an academic scholarship';
    else if (progId === 'university' && p.talents.sports >= 80 && rng.chance(0.6)) scholarship = 'an athletic scholarship';
  }
  const text = `You were accepted to ${prog.label.toLowerCase()}${subject}${scholarship ? ` and offered ${scholarship}` : ''}.`;
  log(text, 'system', 'good');
  return { accepted: true, text, scholarship };
}

/** Rolls whether the parents agree to pay. Can only be asked once per application. */
export function askParentsToPay() {
  const parents = npcsByRole('parent');
  if (!parents.length) return result(false, 'There is nobody to ask.');
  const avg = (f) => parents.reduce((s, n) => s + f(n), 0) / parents.length;
  const chance = clamp(avg((n) => n.wealth) / 100 * 0.7 + avg((n) => n.meters.generosity) / 100 * 0.3
    + avg((n) => n.meters.relationship) / 100 * 0.3 - 0.3, 0.03, 0.95);
  if (rng.chance(chance)) {
    const text = 'Your parents agreed to pay your tuition.';
    log(text, 'system', 'good');
    return result(true, text);
  }
  const text = 'Your parents said they cannot pay for it.';
  log(text, 'system', 'bad');
  return result(false, text);
}

/** Starts the programme. funding: 'scholarship' | 'parents' | 'loan' | 'self' ('public' where tuition is free). */
export function enrol(progId, majorId, funding) {
  const p = player();
  const e = p.education;
  const prog = PROGRAMMES[progId];
  e.stage = progId;
  e.enrolled = true;
  e.yearInStage = 0;
  e.gpa = 0;
  e.absences = 0;
  e.effort = 50;
  e.majorId = progId === 'university' ? majorId : lastDegree('university').majorId;
  e.funding = tuitionFor(progId) === 0 ? 'public' : funding;
  turnOverClassmates(true);
  log(`You enrolled in ${prog.label.toLowerCase()}.`, 'system', 'good');
  chargeTuition();
}
