// Becoming a doctor: premedical years, medical (or podiatric) school year by year, rotations and
// licensing exams, applying for residency, the Match, residency by postgraduate year (PGY),
// fellowships, the license to practice, and board certification.
//
// Medical school itself is the education stage 'medical' (or 'podiatric') in engine/education.js:
// enrolling, tuition, the GPA and graduating happen there. This module follows the same years and
// adds what medical school is besides a GPA. Everything happens once per world year (the yearly
// step 'medicine' in engine/yearProcessor.js), so a 3-, 6- or 12-month Age Up gives the same
// training; a residency takes its full number of years, never one Age Up.
//
// Nothing is guaranteed: a residency or fellowship place is applied for and may not be offered.
// A resident practices under supervision only; a student has no privileges of their own.
import { rng } from '../../rng.js';
import { clamp } from '../../util.js';
import { store, player, log } from '../../state.js';
import { SPECIALTY_BY_ID, PRIMARY, FELLOWSHIPS, PREMED, ROTATIONS, RESIDENT_TITLES, ERA, jurisdiction, qualifiesAs } from '../../data/medicine.js';
import { hire, endJob } from '../career.js';
import { employer, chronicle } from '../employers.js';
import { citiesOf, relocate, moveCost } from '../cities.js';
import { M, med, year, grow, note, once, result, roll, specialtyName, qualified, ancestorAt, medicalFamily, storyOnce } from './core.js';
import { recordEvent, archiveIdOf } from '../chronicle.js';
import { remember } from '../conditions.js';
import { trainingSites, workplacesFor, careerFor, levelFor, hospital, hospitalName } from './hospitals.js';

const avg = (...xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const an = (w) => `${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`;
const inMedSchool = (p = player()) => p.education.enrolled && ['medical', 'podiatric'].includes(p.education.stage);
const holds = (type, p = player()) => p.education.degrees.some((d) => d.type === type);
export const isPodiatry = (m = med()) => m?.route === 'dpm';

// ---------- Premedical years ----------

/** Who can do premedical activities: someone at university, or a graduate who has not yet started medical school. */
export function premedOpen(p = player()) {
  if (p.age < 17 || inMedSchool(p) || holds('medical', p) || holds('podiatric', p)) return false;
  return (p.education.enrolled && p.education.stage === 'university') || holds('university', p);
}

/** Premedical activities, each once a year. */
export function premedOptions() {
  const m = med();
  const fam = medicalFamily();
  // Family in medicine: a parent's or grandparent's stories, or an ancestor's papers in the Family Archive.
  const extra = fam ? [{ id: 'family_talk', name: fam.archived ? `Read ${fam.name}'s papers in the Family Archive` : `Talk about medicine with ${fam.name}`, adds: { exposure: 1, letters: fam.archived ? 0 : 0.5 } }] : [];
  return [...PREMED, ...extra].map((a) => ({ ...a, done: !!m && m.acted.year === year() && !!m.acted[`premed:${a.id}`] }));
}

/** Does one premedical activity this year. */
export function doPremed(id) {
  const p = player();
  const a = premedOptions().find((x) => x.id === id);
  if (!a) return result(false, 'There is no such thing to do.', 'neutral');
  if (!premedOpen(p)) return result(false, 'Premedical activities are for university students and graduates who have not yet started medical school.', 'neutral');
  const m = M();
  if (!once(`premed:${id}`, m)) return result(false, 'You have already done that this year.', 'neutral');
  for (const [k, v] of Object.entries(a.adds)) m.premed[k] = Math.round((m.premed[k] + v) * 10) / 10;
  m.premed.done[id] = (m.premed.done[id] ?? 0) + 1;
  const said = {
    volunteer: 'You spent your Saturdays at the hospital: wheeling patients, fetching blankets, learning where everything is.',
    shadow: 'You followed a physician through their week. Most of it was paperwork and conversation, which surprised you.',
    research: 'You joined a laboratory project. Mostly you labeled samples, but your name may go on the paper.',
    mentor: 'A professor agreed to advise you, and to write you a letter when the time comes.',
    science_club: 'The science club met on Thursdays. You argued about evolution until the building closed.',
    study_exam: 'You worked through practice papers for the entrance exam, every evening for months.',
    family_talk: medicalFamily()?.archived ? `You read through ${medicalFamily().name}'s old papers: case notes with every name blacked out, and a letter about why they chose medicine.`
      : `${medicalFamily()?.name} talked for hours: the nights on call, the patients they still think about, and what they would do differently.`,
  }[id];
  if (id === 'research') grow('research', 3, m);
  if (id === 'volunteer' || id === 'shadow') grow('communication', 1, m);
  p.stats.mood = clamp(p.stats.mood + (id === 'study_exam' ? -2 : 1));
  log(said);
  return result(true, said);
}

/** US applicants may apply to osteopathic (DO) schools as well as MD ones. */
export function setDoToo(on) { M().doToo = !!on; return result(true, on ? 'You will apply to osteopathic (DO) schools as well.' : 'You will apply to MD schools only.', 'neutral'); }

// ---------- Medical school ----------

/** Starts the student's record the first year of medical (or podiatric) school. */
function startSchool(p, m) {
  const j = jurisdiction(p.countryId);
  const dpm = p.education.stage === 'podiatric';
  const route = dpm ? 'dpm' : j.osteopathic && m.doToo && roll(0.4) ? 'do' : 'md';
  m.route = route;
  m.stage = 'school';
  m.school = { startYear: year(), countryId: p.countryId, name: p.education.schoolName ?? (dpm ? 'podiatric medical school' : 'medical school'), route,
    year: 0, rotations: [], exams: {}, interest: {}, apply: [], graduated: false, elective: null };
  note(`Started ${dpm ? 'podiatric medical school (DPM)' : route === 'do' ? 'osteopathic medical school (DO)' : 'medical school'}.`, 'education', { key: 'school_start', log: false });
}

const EXAM_POINTS = (p, m) => p.stats.intellect * 0.4 + p.education.gpa * 10 + p.hidden.discipline * 0.15 + m.skills.reasoning * 0.25;

/** Sits a medical school exam: a score out of 100 (60 passes). */
function sitSchoolExam(p, m, exam) {
  const prep = m.school.prep === exam.id ? 8 : 0;
  const score = clamp(Math.round(EXAM_POINTS(p, m) + prep + rng.int(-12, 12)));
  const pass = score >= 60;
  const tries = (m.school.exams[exam.id]?.tries ?? 0) + 1;
  m.school.exams[exam.id] = { score, pass, tries, year: year() };
  // USMLE Step 1 has been reported pass or fail since 2022.
  const shown = exam.id === 'step1' && year() >= 2022 ? (pass ? 'passed' : 'did not pass') : pass ? `passed, scoring in the ${score >= 85 ? 'top tenth' : score >= 72 ? 'upper half' : 'lower half'}` : 'did not pass';
  log(`You sat ${exam.name} and ${shown}.${pass ? '' : ' You will sit it again next year.'}`, 'system', pass ? 'good' : 'bad');
  if (pass) grow('reasoning', 2, m);
  else p.stats.mood = clamp(p.stats.mood - 8);
}

const GRADES = [[85, 'Honors'], [70, 'High pass'], [50, 'Pass'], [0, 'Fail']];
/** One clinical rotation: a grade, and how much the student liked it. */
function rotate(p, m, rot) {
  const s = m.skills;
  const like = m.school.interest[rot.specialty] ?? 0;
  const score = clamp(Math.round(avg(s.reasoning, s.communication, s.teamwork, s.professionalism) * 0.6 + p.stats.intellect * 0.25 + p.hidden.discipline * 0.15 + like * 2 + rng.int(-14, 14)));
  const grade = GRADES.find(([min]) => score >= min)[1];
  const liked = rng.int(0, 3) + (grade === 'Honors' ? 2 : grade === 'High pass' ? 1 : 0);
  m.school.interest[rot.specialty] = like + liked;
  m.school.rotations.push({ id: rot.id, specialty: rot.specialty, name: rot.name, grade, score, year: year() });
  grow('communication', 1, m); grow('teamwork', 1, m); grow('reasoning', 1, m);
  if (SPECIALTY_BY_ID[rot.specialty]?.surgical) grow('technical', 1.5, m);
  return { rot, grade };
}

/** The year's work at medical school, after education.js has counted the year. */
function schoolYear(p, m, y) {
  const j = jurisdiction(m.school.countryId);
  const dpm = m.route === 'dpm';
  if (y === 1) storyOnce('med_anatomy_exam', { words: { school: m.school.name } }, m);
  if (y === 3) storyOnce('med_patient_remember', {}, m);
  if (y === 3 && m.route !== 'dpm') storyOnce('med_choosing_specialty', {}, m);
  if (y === 4 || (y === 3 && jurisdiction(m.school.countryId).schoolYears === 4)) storyOnce('med_residency_interview', {}, m);
  if (y <= 2) {
    grow('reasoning', 3, m); grow('professionalism', 1, m); grow('research', 0.5, m);
    log(y === 1 ? 'Your first year of medical school: anatomy, physiology, and more reading than you thought possible.' : 'Second year: how bodies go wrong, and how doctors find out.', 'system', 'neutral');
  } else {
    // Clinical years: rotations, under supervision. A student examines and presents; they decide nothing alone.
    const list = dpm ? [{ id: 'podiatry', name: 'Podiatric medicine and surgery', specialty: 'podiatry', shows: 'foot and ankle clinics, and the operating room' }, ROTATIONS[0], ROTATIONS[1]]
      : y === 3 ? ROTATIONS.slice(0, 6) : [ROTATIONS[6], ROTATIONS[7], ROTATIONS.find((r) => r.id === m.school.elective) ?? ROTATIONS[8 + (m.school.startYear % 2)]];
    const done = list.map((r) => rotate(p, m, r));
    const best = done.filter((d) => d.grade === 'Honors').map((d) => d.rot.name);
    log(`Clinical rotations this year: ${done.map((d) => `${d.rot.name} (${d.grade.toLowerCase()})`).join(', ')}.${best.length ? ` Honors in ${best.join(' and ')}.` : ''}`, 'system', 'neutral');
    store.state.pendingEvents.push({ id: 'med_rotation', cast: { words: { rotation: done[0].rot.name, shows: done[0].rot.shows } } });
  }
  const exams = dpm ? [{ id: 'apmle1', name: 'the first podiatric board exam', year: 2 }, { id: 'apmle2', name: 'the second podiatric board exam', year: 4 }] : j.exams;
  for (const ex of exams) {
    const prior = m.school.exams[ex.id];
    if ((ex.year === y && !prior) || (prior && !prior.pass && y > ex.year)) sitSchoolExam(p, m, ex);
  }
}

/** Specialties a student can apply to, with what each takes. */
export function applicationOptions(p = player(), m = med()) {
  const j = jurisdiction(p.countryId);
  const list = m?.route === 'dpm' ? [SPECIALTY_BY_ID.podiatry] : PRIMARY.filter((s) => s.profession === 'medicine');
  return list.map((s) => {
    let block = '';
    if (year() < s.minYear) block = `There is no ${s.name.toLowerCase()} training in ${year()}.`;
    else if (s.grants && p.countryId !== 'us') block = 'An integrated program: the game models these in the United States only.';
    return { id: s.id, name: s.name, years: s.years, compete: s.compete, surgical: s.surgical, interest: m?.school?.interest[s.id] ?? 0, block };
  });
}

/** Ranks up to three specialties to apply to (the first is the one most wanted). */
export function setApplications(ids) {
  const m = M();
  const ok = applicationOptions().filter((o) => !o.block).map((o) => o.id);
  const list = [...new Set(ids)].filter((id) => ok.includes(id)).slice(0, 3);
  if (!list.length) return result(false, 'Choose at least one specialty you can apply to.', 'neutral');
  (m.school ?? (m.school = { apply: [] })).apply = list;
  return result(true, `You will apply to ${list.map((id) => specialtyName(id)).join(', then ')}.`, 'neutral');
}

/** The default list, if a student never chooses: the rotations they liked best. */
function defaultApplications(m) {
  const opts = applicationOptions().filter((o) => !o.block);
  const ranked = [...opts].sort((a, b) => b.interest - a.interest || a.compete - b.compete);
  return [ranked[0]?.id, ...opts.filter((o) => o.compete <= 0.35).map((o) => o.id)].filter(Boolean).slice(0, 2);
}

// ---------- Applying for training places ----------

/** How strong an application is for a specialty (0-100). */
export function applicationStrength(specialtyId, m = med(), p = player()) {
  const exams = Object.values(m.school?.exams ?? {}).filter((x) => x.pass).map((x) => x.score);
  const examPart = exams.length ? avg(...exams) : 55;
  const rots = (m.school?.rotations ?? []).filter((r) => r.specialty === specialtyId || SPECIALTY_BY_ID[specialtyId]?.after?.includes(r.specialty));
  const rotPart = rots.length ? avg(...rots.map((r) => r.score)) : 55;
  const s = m.skills;
  const evals = (m.evaluations ?? []).slice(-3).map((x) => x.score);
  const evalPart = evals.length ? avg(...evals) : rotPart;
  const letters = clamp(50 + m.premed.letters * 6 + (m.people.mentorId ? 15 : 0));
  return Math.round(examPart * 0.3 + (SPECIALTY_BY_ID[specialtyId].kind === 'fellowship' ? evalPart : rotPart) * 0.25 + s.research * 0.12 + letters * 0.1
    + avg(s.professionalism, s.communication, s.teamwork) * 0.15 + (m.school?.interest?.[specialtyId] ?? 0) * 0.8 + p.stats.intellect * 0.08);
}

/** The chance of a place in a specialty: competitive ones take a stronger application. */
export function placeChance(specialtyId, m = med()) {
  const s = SPECIALTY_BY_ID[specialtyId];
  const strength = applicationStrength(specialtyId, m);
  const tries = (m.match?.tries ?? 0);
  return clamp(0.55 + (strength - 55) / 40 - s.compete * 0.55 - (tries > 0 ? 0.05 : 0), 0.04, 0.95);
}

/**
 * Applies for training places in order of preference; the first that offers one is taken.
 * Before the national match existed, places were offered directly; the result is the same kind of decision.
 */
export function runMatch(kind, wanted) {
  const p = player();
  const m = M();
  const j = jurisdiction(p.countryId);
  const by = j.selection && !(p.countryId === 'us' && year() < ERA.residencyMatch) ? j.selection : 'direct offers from hospitals';
  const what = kind === 'fellowship' ? 'Fellowship applications' : `Applications through ${by}`;
  m.match = { kind, year: year(), applied: [...wanted], tries: (m.match?.kind === kind ? m.match.tries ?? 0 : 0) + 1, status: 'unmatched' };
  for (const id of wanted) {
    // One fellowship place, two strong residents: when a rival from the program applies too, the program chooses
    // between the two applications, on the record. Otherwise it is the ordinary chance of a place.
    const rival = kind === 'fellowship' && SPECIALTY_BY_ID[id].compete >= 0.5
      ? (m.people.rivalIds ?? []).map((x) => store.state.npcs[x]).find((n) => n?.alive && !n.flags.medFellowship) : null;
    if (!rival && !roll(placeChance(id, m))) continue;
    const site = pickSite(id, m, p);
    if (!site) continue;
    if (kind === 'fellowship') {
      if (rival) {
        const theirs = (rival.meters.intellect ?? 50) * 0.7 + rng.int(0, 30);
        const mine = applicationStrength(id, m) * 0.7 + rng.int(0, 30);
        rival.flags.medFellowship = id;
        m.fellowshipRace = { year: year(), specialtyId: id, rivalId: rival.id, won: mine >= theirs };
        if (mine < theirs) {
          remember(rival, `medFellowship:${id}`, `Was chosen over you for the ${specialtyName(id)} fellowship.`);
          log(`There was one ${specialtyName(id)} fellowship place, and the program chose ${rival.firstName} ${rival.lastName}. On paper it was close.`, 'system', 'bad');
          continue;
        }
        remember(rival, `medFellowship:${id}`, `Lost the ${specialtyName(id)} fellowship place to you.`);
        rival.flags.medFellowship = 'missed';
      }
    }
    return matched(kind, id, site, what);
  }
  // A second round for places left unfilled: less competitive programs, for those who opt in (the default).
  if (kind === 'residency' && m.secondRound !== false && m.route !== 'dpm') {
    const left = applicationOptions(p, m).filter((o) => !o.block && !wanted.includes(o.id) && o.compete <= 0.45)
      .sort((a, b) => b.interest - a.interest || a.compete - b.compete).slice(0, 2);
    for (const o of left) {
      if (!roll(placeChance(o.id, m) * 0.7)) continue;
      const site = pickSite(o.id, m, p);
      if (site) return matched(kind, o.id, site, 'In the second round, for places left unfilled');
    }
  }
  if (kind === 'residency') storyOnce('med_match_day_unmatched', { words: { specialty: specialtyName(wanted[0]), day: matchDay(p) } }, m);
  log(`${what}: no place this year in ${wanted.map((id) => specialtyName(id)).join(' or ')}. You can apply again next year.`, 'system', 'bad');
  p.stats.mood = clamp(p.stats.mood - 12);
  note(`Did not match into ${specialtyName(wanted[0])} (${year()}).`, 'career', { log: false });
  return null;
}

/**
 * Where a place is offered. Applying nationwide (the default) can mean another city: a strong
 * application gets the best-resourced program in the country, others wherever there is room.
 * Applying only at home keeps to the player's own city.
 */
function pickSite(id, m, p) {
  const here = trainingSites(id, p.countryId, p.city).map((x) => ({ ...x, city: p.city }));
  const strength = applicationStrength(id, m);
  if (m.local || p.age < 18) return here.length ? (strength >= 70 ? here[0] : here[here.length - 1]) : null;
  const away = citiesOf(p.countryId).filter((c) => c.name !== p.city).flatMap((c) => trainingSites(id, p.countryId, c.name).map((x) => ({ ...x, city: c.name })));
  const all = [...here, ...away];
  if (!all.length) return null;
  if (strength >= 70) return [...all].sort((a, b) => b.h.resources - a.h.resources || (a.city === p.city ? -1 : 1))[0];
  return roll(0.45) && here.length ? here[here.length - 1] : rng.pick(all);
}

/** Takes the place: moving city first if the program is elsewhere (the program pays the move). */
function matched(kind, id, site, what) {
  const p = player();
  const m = M();
  if (kind === 'residency') storyOnce('med_match_day', { words: { specialty: specialtyName(id), hospital: site.e.name, city: site.city, day: matchDay(p) } }, m);
  m.match.status = 'matched';
  m.match.specialtyId = id;
  m.match.hospitalId = site.e.id;
  log(`${what}: you matched into ${specialtyName(id)} at ${site.e.name}${site.city !== p.city ? `, in ${site.city}` : ''}.`, 'system', 'good');
  if (site.city !== p.city) {
    p.finance.cash += moveCost(); // a relocation allowance from the program
    const r = relocate(site.city);
    if (r.ok) m.match.moved = site.city;
    else { p.finance.cash -= moveCost(); log(`You could not move to ${site.city} (${r.text}) and gave up the place.`, 'system', 'bad'); m.match.status = 'declined'; return null; }
  }
  return startTraining(kind, id, site.e.id);
}

/** What the day training places are announced is called: Match Day in the US (from 1952), plainer words elsewhere. */
function matchDay(p) {
  if (p.countryId === 'us') return year() >= ERA.residencyMatch ? 'Match Day' : 'The day the hospital letters arrive';
  if (p.countryId === 'ca') return 'Match Day';
  return 'Results day for specialty training';
}

/** Applying nationwide (may mean moving) or only in the player's own city. */
export function setLocal(on) { M().local = !!on; return result(true, on ? `You will apply only to programs in ${player().city}.` : 'You will apply nationwide, and move if the place is elsewhere.', 'neutral'); }
/** Whether to enter the second round for unfilled places if the first does not work out. */
export function setSecondRound(on) { M().secondRound = !!on; return result(true, on ? 'If you do not match, you will try for places left unfilled.' : 'You will not enter the second round.', 'neutral'); }

/** A research year while waiting to apply again: a stronger application next time. Once a year. */
export function researchYear() {
  const m = M();
  if (m.stage !== 'graduate' || m.training) return result(false, 'That is for graduates waiting to apply again.', 'neutral');
  if (!once('research_year', m)) return result(false, 'You are already doing research this year.', 'neutral');
  grow('research', 6, m); grow('reasoning', 1, m);
  m.premed.letters += 1;
  return result(true, 'You join a research group for the year: a paper in progress, and a professor who will write you a letter.');
}

// ---------- Training ----------

/** Starts a residency, internship or fellowship at a hospital: the job, the supervisor, the record. */
export function startTraining(kind, specialtyId, hospitalId) {
  const p = player();
  const m = M();
  const j = jurisdiction(p.countryId);
  const s = SPECIALTY_BY_ID[specialtyId] ?? null;
  const years = kind === 'internship' ? j.internship : s.years;
  const careerSpec = kind === 'internship' ? 'internal' : specialtyId;
  const career = careerFor(careerSpec);
  const e = employer(hospitalId);
  const how = kind === 'fellowship' ? `Your fellowship in ${s.name} begins.` : kind === 'internship' ? 'Your internship begins: a year on the wards, supervised.' : `Residency in ${s.name} begins.`;
  hire(career, levelFor(kind === 'fellowship' ? 'fellow' : 'resident', career), 55, how, { employerId: hospitalId });
  m.training = { kind, specialtyId: kind === 'internship' ? null : specialtyId, hospitalId, pgy: 1, years, startYear: year(), chief: false, probation: 0, evals: [] };
  if (kind !== 'fellowship') storyOnce('med_first_night', { words: { hospital: e.name } }, m);
  m.stage = kind;
  m.job = null;
  hospital(e);
  // The supervising physician is the person the player reports to; the people beside them are co-residents.
  const boss = p.npcIds.map((id) => store.state.npcs[id]).find((n) => n?.alive && n.flags.tag === 'boss');
  if (boss) {
    boss.flags.title = kind === 'fellowship' ? 'Fellowship director' : 'Supervising attending';
    boss.flags.medRole = 'supervisor';
    m.people.supervisorIds = [...new Set([...m.people.supervisorIds, boss.id])];
  }
  const peers = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.role === 'coworker' && n.flags.workedWith === e.name);
  for (const n of peers) {
    n.flags.title = kind === 'fellowship' ? 'Co-fellow' : 'Co-resident'; n.flags.medRole = 'peer'; n.age = clamp(n.age, p.age - 3, p.age + 6);
    remember(n, `medTrained:${e.id}`, `You trained together at ${e.name}${s ? `, in ${s.name}` : ''}, from ${year()}.`);
  }
  if (boss) remember(boss, `medSupervised:${e.id}`, `Supervised your ${kind === 'fellowship' ? 'fellowship' : 'training'} at ${e.name}, from ${year()}.`);
  m.people.colleagueIds = [...new Set([...m.people.colleagueIds, ...peers.map((n) => n.id)])];
  retitle();
  familyHospital(p, e);
  chronicle(e, `${p.firstName} ${p.lastName} started ${kind === 'fellowship' ? 'a fellowship' : kind === 'internship' ? 'an internship' : 'residency'}${s ? ` in ${s.name}` : ''}.`);
  note(`${kind === 'fellowship' ? 'Began a fellowship' : kind === 'internship' ? 'Began an internship' : 'Began residency'}${s ? ` in ${s.name}` : ''} at ${e.name}.`, 'career',
    { key: `${kind}:${specialtyId ?? 'intern'}:${year()}`, milestone: `${kind === 'fellowship' ? 'Began a fellowship' : kind === 'internship' ? 'Began an internship' : 'Matched into residency'}${s ? ` in ${s.name}` : ''}.`, log: false });
  return m.training;
}

/** Working where a parent or grandparent once worked: the hospital remembers, and so does the family. */
function familyHospital(p, e) {
  const a = ancestorAt(e.id);
  if (!a || a.id === archiveIdOf(p)) return;
  const said = `${a.firstName} ${a.lastName} worked at ${e.name} too. ${a.medicine.topTitle ? `Some of the older staff still remember ${a.firstName} as ${a.medicine.topTitle.toLowerCase()}.` : 'There is a photograph of them in the corridor by the old wing.'}`;
  log(said, 'system', 'good');
  recordEvent({ key: `med:familyHospital:${archiveIdOf(p)}:${e.id}`, kind: 'medical_career', text: `Worked at ${e.name}, where ${a.firstName} ${a.lastName} had worked before.`, privacy: 'family', people: [a.id], significance: 1 });
}

/** The job title that goes with a training year or a post. */
export function retitle(p = player(), m = med()) {
  const c = p.career;
  if (!m || !c.careerId) return;
  const t = m.training;
  if (t) {
    const s = SPECIALTY_BY_ID[t.specialtyId];
    // Before the modern residency system, a doctor in hospital training was a house officer (US, before about 1950).
    const old = year() < 1950;
    c.title = t.kind === 'fellowship' ? `${s.name} fellow` : t.kind === 'internship' ? (old ? 'House officer' : 'Intern') : t.chief ? `Chief resident, ${s.name}`
      : old ? `House officer, ${s.name}${t.pgy > 1 ? ` (year ${t.pgy})` : ''}`
        // Outside the United States the game does not use US titles: a plain "specialty trainee" with the year.
        : p.countryId !== 'us' ? `Specialty trainee, ${s.name} (year ${t.pgy})` : `${RESIDENT_TITLES[t.pgy - 1] ?? 'Resident'}, ${s.name} (PGY-${t.pgy})`;
  } else if (m.job && !(m.job.legacy && !m.job.specialtyId)) {
    const s = SPECIALTY_BY_ID[m.job.specialtyId];
    const doc = s?.doctor ?? 'physician';
    c.title = { attending: year() < 1950 ? `Staff ${doc}` : `Attending ${doc}`, senior: `Senior ${doc}`, director: `Medical director, ${s?.name ?? 'Medicine'}`, chief: m.job.specialtyId === 'gensurg' ? 'Chief of Surgery' : `Chief of ${s?.name ?? 'Medicine'}`,
      chair: `Chair of ${s?.name ?? 'Medicine'}`, cmo: 'Chief medical officer', owner: `${doc[0].toUpperCase()}${doc.slice(1)} in private practice` }[m.job.rank] ?? `Attending ${doc}`;
  }
}

/** Evaluates a training year (0-100) from how the trainee practices: judgment, care, teamwork, the cases. */
function evaluate(p, m) {
  const s = m.skills;
  const cases = (m.yearReview?.year === year() - 1 ? m.yearReview : null);
  const quality = cases && cases.n ? cases.quality / cases.n : 55;
  return clamp(Math.round(avg(s.reasoning, s.professionalism, s.teamwork, s.communication) * 0.55 + quality * 0.25 + p.hidden.discipline * 0.1 + p.stats.intellect * 0.1 + rng.int(-8, 8)));
}

const EVAL_WORDS = [[72, 'exceeds expectations'], [52, 'meets expectations'], [38, 'needs improvement'], [0, 'below expectations']];

/** A year of residency or fellowship: evaluation, growth, the license, the chief year, finishing. */
export function trainingYear() {
  const p = player();
  const m = med();
  const t = m?.training;
  if (!t) return;
  // Leaving the hospital ends the program.
  if (p.career.employerId !== t.hospitalId) {
    note(`Left ${t.kind} in ${specialtyName(t.specialtyId)} before finishing (PGY-${t.pgy}).`, 'career');
    m.training = null;
    m.stage = m.completed.length ? 'practice' : 'graduate';
    return;
  }
  const s = SPECIALTY_BY_ID[t.specialtyId];
  const score = evaluate(p, m);
  const words = EVAL_WORDS.find(([min]) => score >= min)[1];
  t.evals.push({ pgy: t.pgy, score, year: year() });
  (m.evaluations ??= []).push({ year: year(), score, kind: t.kind, specialtyId: t.specialtyId });
  grow('reasoning', 2.5, m); grow('management', 2, m); grow('teamwork', 1.5, m); grow('communication', 1, m); grow('professionalism', 1, m);
  if (s?.surgical || t.kind === 'fellowship' && s?.procedures?.length) grow('technical', 3, m);
  if (t.pgy >= 3) grow('leadership', 1.5, m);
  m.experience.years += 1;
  log(`Your ${t.kind === 'fellowship' ? 'fellowship' : t.kind === 'internship' ? 'internship' : 'residency'} evaluation, PGY-${t.pgy}: ${words}.`, 'system', score >= 52 ? 'good' : 'bad');
  // A weak year means remediation; a second in a row ends the program. Never instantly.
  if (score < 38) {
    t.probation += 1;
    if (t.probation >= 2) {
      log(`After two years below expectations, the program has not renewed your contract. Your ${t.kind} has ended.`, 'system', 'bad');
      note(`Dismissed from ${t.kind}${s ? ` in ${s.name}` : ''} after remediation.`, 'career');
      m.training = null;
      m.stage = m.completed.length ? 'practice' : 'graduate';
      endJob('dismissed from the program');
      return;
    }
    log('You are placed on a remediation plan: closer supervision, and a review at the end of next year.', 'system', 'bad');
  } else t.probation = 0;
  licenseCheck(p, m, t);
  // Chief resident: chosen in the last year from the strongest residents, never certain.
  if (t.kind === 'residency' && t.pgy === t.years - 1 && !t.chief && score >= 60 && roll(0.25 + (score - 60) / 80 + m.skills.leadership / 400)) {
    t.chief = true;
    log(`The faculty chose you as chief resident for your final year in ${s.name}.`, 'system', 'good');
    note(`Chosen as chief resident in ${s.name}.`, 'career', { key: `chief:${t.specialtyId}`, milestone: `Chief resident, ${s.name}.`, log: false });
    grow('leadership', 4, m);
  }
  t.pgy += 1;
  if (t.pgy > t.years) return finishTraining(p, m, t);
  retitle(p, m);
}

/** The license to practice independently: in the US after the first year of residency (Step 3 and a state license). */
function licenseCheck(p, m, t) {
  if (m.license.status === 'full') return;
  const j = jurisdiction(p.countryId);
  const yearsIn = m.experience.years;
  if (yearsIn < j.license.afterTraining) return;
  const dpm = m.route === 'dpm';
  const pass = roll(clamp(0.82 + (m.skills.reasoning - 50) / 200, 0.5, 0.97));
  const name = dpm ? 'the podiatric board exams and a state license' : j.license.name;
  if (!pass) { log(`You did not pass ${dpm ? 'the final podiatric board exam' : p.countryId === 'us' ? 'USMLE Step 3' : 'the registration assessment'} this year. You will sit it again; training goes on under supervision.`, 'system', 'bad'); return; }
  m.license = { status: 'full', name, since: year(), countryId: p.countryId };
  const id = dpm ? 'podiatric' : 'medical';
  if (!(p.flags.licenses ??= []).includes(id)) p.flags.licenses.push(id);
  log(`You hold ${name}: licensed to practice${t ? ', though as a trainee you still practice under supervision' : ''}.`, 'system', 'good');
  note(`Licensed to practice: ${name}.`, 'career', { key: `license:${p.countryId}`, log: false });
}

/** A program finished: the qualification, the boards, then a fellowship or a post. */
function finishTraining(p, m, t) {
  const e = employer(t.hospitalId);
  if (t.kind === 'internship') {
    log('Your internship is complete. Now for specialty training.', 'system', 'good');
    m.training = null;
    const wanted = m.school?.apply?.length ? m.school.apply : defaultApplications(m);
    if (!runMatch('residency', wanted)) { m.stage = 'graduate'; endJob('finished internship'); }
    return;
  }
  const s = SPECIALTY_BY_ID[t.specialtyId];
  m.completed.push({ specialtyId: t.specialtyId, kind: t.kind, hospitalId: t.hospitalId, hospital: e?.name, from: t.startYear, to: year(), chief: t.chief });
  m.training = null;
  const as = SPECIALTY_BY_ID[qualifiesAs(t.specialtyId)];
  note(`Completed ${t.kind} in ${s.name} at ${e?.name ?? 'the hospital'}.`, 'career', { key: `done:${t.specialtyId}`, milestone: `Qualified as ${an(as.doctor)}.`, significance: 2 });
  if (year() >= ERA.boards) boardExam(p, m, qualifiesAs(t.specialtyId));
  // A fellowship applied for in the last year, or a post as an attending.
  const fellowship = m.applyFellowship && fellowshipOptions().find((f) => f.id === m.applyFellowship && !f.block);
  m.applyFellowship = null;
  if (fellowship && runMatch('fellowship', [fellowship.id])) return;
  findPost(p, m, qualifiesAs(t.specialtyId), t.hospitalId);
}

/** Board certification in a specialty (specialist registration, outside the US). */
function boardExam(p, m, specialtyId) {
  const pass = roll(clamp(0.8 + (m.skills.reasoning - 55) / 150, 0.45, 0.96));
  const name = p.countryId === 'us' ? 'board certification' : 'specialist registration';
  const prior = m.boards.find((b) => b.specialtyId === specialtyId);
  if (prior) { prior.passed = pass; prior.year = year(); prior.tries += 1; } else m.boards.push({ specialtyId, passed: pass, year: year(), tries: 1 });
  if (pass) log(`You earned ${name} in ${specialtyName(specialtyId)}.`, 'system', 'good');
  else log(`You did not pass the ${specialtyName(specialtyId)} board exam this time. You can practice, and sit it again next year.`, 'system', 'bad');
}
/** Retakes a failed board exam once a year. */
function boardRetakes(p, m) {
  for (const b of m.boards) if (!b.passed && b.year < year() && b.tries < 4) boardExam(p, m, b.specialtyId);
}

/** Fellowships open to a physician: after the residencies (or fellowships) they lead from. */
export function fellowshipOptions(m = med()) {
  if (!m) return [];
  const done = new Set([...(m.completed ?? []).map((c) => c.specialtyId), ...qualified(m)]);
  const current = m.training?.kind === 'residency' ? m.training.specialtyId : null;
  return FELLOWSHIPS.filter((f) => f.after.some((a) => done.has(a) || a === current) && !done.has(f.id)).map((f) => {
    let block = '';
    if (year() < f.minYear) block = `There is no ${f.name.toLowerCase()} fellowship in ${year()}.`;
    else if (!f.after.some((a) => done.has(a)) && !(m.training?.kind === 'residency' && m.training.pgy >= m.training.years)) block = 'Apply in the final year of your residency.';
    return { id: f.id, name: f.name, years: f.years, compete: f.compete, after: f.after, block };
  });
}

/** Chooses the fellowship to apply for (in the last residency year, or later as an attending). */
export function applyForFellowship(id) {
  const m = M();
  const t = m.training;
  const f = fellowshipOptions(m).find((x) => x.id === id);
  if (!f) return result(false, 'That fellowship does not follow from your training.', 'neutral');
  if (t?.kind === 'residency' && t.pgy >= t.years) { m.applyFellowship = id; return result(true, `You applied for a fellowship in ${f.name}. Places are decided as your residency ends.`, 'neutral'); }
  if (t) return result(false, 'Apply in the final year of your residency.', 'neutral');
  if (f.block) return result(false, f.block, 'neutral');
  if (!once('fellowship', m)) return result(false, 'You have applied for a fellowship this year.', 'neutral');
  const got = runMatch('fellowship', [id]);
  return got ? result(true, `You were offered a fellowship in ${f.name}.`) : result(false, `No fellowship place in ${f.name} this year.`);
}

/** After training: an attending post where one is open, at the training hospital first. */
export function findPost(p, m, specialtyId, preferId = null) {
  const places = workplacesFor(specialtyId, p.countryId, p.city);
  const pref = places.find((x) => x.e.id === preferId);
  const order = [...(pref ? [pref] : []), ...places.filter((x) => x !== pref)];
  for (const { e } of order) {
    if (!roll(clamp(0.45 + (m.skills.reasoning + m.skills.professionalism - 100) / 120 + (e.id === preferId ? 0.2 : 0), 0.15, 0.9))) continue;
    return startPost(specialtyId, e.id, 'attending');
  }
  m.stage = 'practice';
  if (p.career.employerId === preferId) endJob('finished training');
  log(`No attending post in ${specialtyName(specialtyId)} opened in ${p.city} this year. You can apply to hospitals from My Medical Career.`, 'system', 'neutral');
  return null;
}

/** Takes a post at a hospital at a rank. */
export function startPost(specialtyId, hospitalId, rank = 'attending') {
  const p = player();
  const m = M();
  const career = careerFor(specialtyId);
  const e = employer(hospitalId);
  hire(career, levelFor(rank, career), 60, `You join ${e.name} as an attending.`, { employerId: hospitalId });
  m.job = { specialtyId, hospitalId, rank, since: year(), rankSince: year() };
  m.stage = 'practice';
  hospital(e);
  retitle(p, m);
  if (!m.topRank) { m.topRank = rank; m.topTitle = p.career.title; }
  familyHospital(p, e);
  // An old rival from residency, already working here: the past follows you in.
  const rival = (m.people.rivalIds ?? []).map((id) => store.state.npcs[id]).find((n) => n?.alive && n.life?.job?.employerId === hospitalId);
  if (rival) log(`${rival.firstName} ${rival.lastName}, your rival from residency, works at ${e.name} too. They nod at you across the cafeteria.`, 'system', 'neutral');
  note(`Joined ${e.name} as ${an(p.career.title.toLowerCase())}.`, 'career', { key: `post:${hospitalId}:${year()}`, log: false });
  return m.job;
}

/** The yearly training step: medical school, graduation and the Match, residency and fellowship years. */
export function tickTraining() {
  const p = player();
  const e = p.education;
  let m = med();
  // Medical (or podiatric) school, year by year, kept in step with education.js.
  if (inMedSchool(p) || (m?.school && !m.school.graduated && (holds('medical', p) || holds('podiatric', p)))) {
    m = M();
    if (!m.school) startSchool(p, m);
    const target = inMedSchool(p) ? e.yearInStage : jurisdiction(m.school.countryId).schoolYears;
    while (m.school.year < target) { m.school.year += 1; schoolYear(p, m, m.school.year); }
  }
  // Graduation: education.js has awarded the degree; the Match result comes with it.
  if (m?.school && !m.school.graduated && (holds('medical', p) || holds('podiatric', p)) && !inMedSchool(p)) {
    m.school.graduated = true;
    m.stage = 'graduate';
    const failed = Object.values(m.school.exams).some((x) => !x.pass);
    note(`Graduated from ${m.school.name} (${m.route === 'dpm' ? 'DPM' : m.route === 'do' ? 'DO' : 'MD'}).`, 'education', { key: 'graduated', log: false, significance: 2 });
    if (failed) log('An exam is still to pass, so you cannot start residency until you do.', 'system', 'bad');
    else startAfterSchool(p, m);
    return;
  }
  if (!m) return;
  // A graduate without a place: exams retaken, then applications again.
  if (m.stage === 'graduate' && !m.training && !m.job && m.school?.graduated) {
    const failed = Object.values(m.school.exams).filter((x) => !x.pass);
    for (const x of failed) sitSchoolExam(p, m, { id: Object.keys(m.school.exams).find((k) => m.school.exams[k] === x), name: 'the exam you still need' });
    if (!Object.values(m.school.exams).some((x) => !x.pass) && m.reapply !== false) { grow('research', 2, m); startAfterSchool(p, m); }
    return;
  }
  if (m.training) trainingYear();
  boardRetakes(p, m);
}

/** After school: an internship first where the country has one, otherwise straight to residency applications. */
function startAfterSchool(p, m) {
  const j = jurisdiction(p.countryId);
  // Where the license comes with graduation (afterTraining 0), it is sat now, before any training place.
  if (j.license.afterTraining === 0 && m.route !== 'dpm') licenseCheck(p, m, null);
  if (m.route !== 'dpm' && j.internship > 0 && !m.completed.length && !(m.evaluations ?? []).some((x) => x.kind === 'internship')) {
    const site = trainingSites('internal', p.countryId, p.city)[0];
    log(`Every graduate here works ${j.internship === 1 ? 'a supervised year' : `${j.internship} supervised years`} before specialty training.`, 'system', 'neutral');
    return startTraining('internship', 'internal', site.e.id);
  }
  const wanted = m.school.apply?.length ? m.school.apply : defaultApplications(m);
  return runMatch('residency', wanted);
}

/** Whether a graduate wants to keep applying each year (they can stop and do something else). */
export function setReapply(on) { M().reapply = !!on; return result(true, on ? 'You will apply for residency again this year.' : 'You have stopped applying for residency.', 'neutral'); }
