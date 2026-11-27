// Becoming an investigator, and the career after: recruitment by a real agency, the academy, field
// training and probation, selection for a detective unit, promotions that need a vacancy and a
// selection, the federal agencies' own hiring and academies, the private investigator's license,
// transfers, leaving and retirement.
//
// Nothing here is automatic. An application is decided by the agency on what the life shows, and
// may be refused; an academy may need more time or be failed; a detective seat or a rank needs a
// vacancy, and others apply for it too. Each step is dated (core.at/now) when it starts and becomes
// known when the calendar reaches it, so the length of a turn changes nothing.
import { inForce, decertified } from './reform.js';
import { clamp } from '../../util.js';
import { rng } from '../../rng.js';
import { store, player, log } from '../../state.js';
import { COUNTRIES } from '../../data/countries.js';
import { CAREER_BY_ID } from '../../data/careers.js';
import { AGENCY_KINDS, POLICE_RANKS, DETECTIVE_RANKS, FEDERAL, FEDERAL_RANKS, SPECIALTIES, PI_LICENSE, PI_EXPERIENCE, FEDERAL_BACKGROUNDS, STUDY, coverageOf } from '../../data/investigations.js';
import { hire, promote, quitCareer } from '../career.js';
import { ensureCareer } from '../worklife.js';
import { residency, rightToLive } from '../citizenship.js';
import { relocate, moveBlock } from '../cities.js';
import { techAvailable } from '../digital/tech.js';
import { storyBeat } from '../storyDirector.js';
import { oddsWords } from '../odds.js';
import { I, rec, W, now, at, year, me, nextId, result, note, grow, regard, seeded, once, reputationOf, skillAvg, working, dateWords } from './core.js';
import { agency, agencyOf, agenciesHere, office, officeOf, federalCities, vacancies, staffer, employerOf } from './agencies.js';
import { trainingBonus } from './policing.js';
import { jobBlock as jobBlockSpecial } from '../specialCareer.js';

const npc = (id) => store.state.npcs[id] ?? null;
const name = (id) => { const n = npc(id); return n ? `${n.firstName} ${n.lastName}` : 'someone'; };
/** Puts a colleague into the player's life (the People tab), as who they are at work. */
export function meet(id, title) {
  const p = player();
  const n = npc(id);
  if (!n?.alive) return null;
  if (!p.npcIds.includes(id)) p.npcIds.push(id);
  if (n.role === 'official') n.role = 'coworker';
  n.flags.title = title;
  n.lastInteractionAge = p.age;
  return n;
}

// ---------- What the life shows ----------

const hasDegree = (p, type) => p.education.degrees.some((d) => d.type === type);
const university = (p) => p.education.degrees.some((d) => ['university', 'masters', 'doctorate', 'law', 'medical'].includes(d.type));
const advanced = (p) => p.education.degrees.some((d) => ['masters', 'doctorate', 'law', 'medical'].includes(d.type));
const highSchool = (p) => university(p) || hasDegree(p, 'high');
/** Serious convictions on the record (sealed and juvenile ones excepted). */
const record = (p) => (p.legal?.record ?? []).filter((r) => !r.sealed && !r.juvenile);
/** The subjects of the player's degrees (law school counts as law). */
const subjects = (p) => p.education.degrees.filter((d) => ['university', 'masters', 'doctorate', 'law'].includes(d.type)).map((d) => (d.type === 'law' ? 'law' : d.majorId)).filter(Boolean);
/** Degrees the player holds that are relevant to a path ('police', 'detective', 'pi') or a unit. */
export const studied = (path, p = player()) => subjects(p).filter((m) => (path in STUDY.unit ? STUDY.unit[path] : STUDY[path] ?? []).includes(m));
export const hasDegree_ = (p = player()) => university(p);
/**
 * What a relevant degree has already taught: once per degree, a head start in the skills it covers. Called whenever the
 * record is looked at for work, so a degree finished part-time while serving counts from then on.
 */
export function studyCredit(p = player(), r = I(p)) {
  r.studyCredit ??= {};
  for (const m of subjects(p)) {
    if (r.studyCredit[m] || !STUDY.skills[m]) continue;
    r.studyCredit[m] = year();
    for (const k of STUDY.skills[m]) grow(k, 8, r);
  }
}
/** Years of full-time work, across every career. */
export const workYears = (p = player()) => Object.values(ensureCareer(p.career).experience ?? {}).reduce((s, y) => s + y, 0);
const yearsIn = (p, ids) => ids.reduce((s, id) => s + (ensureCareer(p.career).experience?.[id] ?? 0), 0);
/** What makes a candidate stand out to a federal agency: a background, not only police work. */
export function backgrounds(p = player()) {
  const majors = p.education.degrees.map((d) => d.majorId).filter(Boolean);
  const out = Object.entries(FEDERAL_BACKGROUNDS).filter(([, list]) => majors.some((m) => list.includes(m))).map(([id]) => id);
  if (yearsIn(p, ['police', 'detective']) >= 2) out.push('law_enforcement');
  if (p.flags.served || yearsIn(p, ['enlisted', 'officer_corps']) >= 2) out.push('military');
  return [...new Set(out)];
}

// ---------- Preparing ----------

/** Things a hopeful can do before applying: once each a year. */
export const PREP = {
  study: { label: 'Study for the entrance assessment', skill: ['reasoning', 'law'] },
  fitness: { label: 'Train for the fitness assessment', stat: 'health' },
  writing: { label: 'Practice writing clear reports', skill: ['writing'] },
  ride: { label: 'Go on a community ride-along or open day', skill: ['observation'], interest: true },
};
export function prepare(id) {
  const p = player();
  const r = I();
  const d = PREP[id];
  if (!d) return result(false, 'Nothing to do.', 'neutral');
  if (!once(`prep:${id}`)) return result(false, 'You have done that this year.', 'neutral');
  r.prep[id] = (r.prep[id] ?? 0) + 1;
  for (const s of d.skill ?? []) grow(s, 4);
  if (d.stat) p.stats.health = clamp(p.stats.health + 2);
  if (d.interest) r.interest += 1;
  return result(true, { study: 'You worked through the practice assessments, and the law questions make more sense now.', fitness: 'You trained for the fitness assessment three mornings a week.',
    writing: 'You practiced writing short, accurate reports: who, what, when, where, and nothing you did not see.', ride: 'You spent an evening with officers on patrol. Most of it was paperwork and talking to people.' }[id]);
}

// ---------- Police recruitment ----------

/** Why the player cannot apply to this agency, or [] when they can. Each agency kind has its own rules. */
export function policeUnmet(a, p = player()) {
  const d = AGENCY_KINDS[a.kind];
  const out = [];
  if (p.age < d.minAge) out.push(`Applicants must be at least ${d.minAge}.`);
  if (d.maxAge && p.age > d.maxAge) out.push(`Applicants must be ${d.maxAge} or younger.`);
  if (!highSchool(p)) out.push('Needs a high school diploma or the equivalent.');
  if (record(p).some((x) => (x.severity ?? 2) >= 2)) out.push('A serious criminal record rules this out.');
  if (decertified(p)) out.push('Your certification was revoked after a dismissal for misconduct: no department here may hire you.');
  if (p.legal.incarceration || p.legal.pending) out.push('Not with a criminal case open.');
  if (coverageOf(a.countryId) === 'full' ? !rightToLive(a.countryId, p) && residency(p).status !== 'permanent_resident' : !residency(p).workAuthorized) out.push('Needs to be a citizen or permanent resident here.');
  if (p.countryId !== a.countryId) out.push('Only people living here can apply.');
  const r = rec(p);
  if (r?.job && r.job.agencyId === a.id) out.push('You already work here.');
  if (r?.apps.some((x) => x.ownerId === a.id && x.status === 'pending')) out.push('Your application is already with them.');
  if (r?.academy?.status === 'enrolled') out.push('You are at the academy.');
  return out;
}

/**
 * Applies to a police agency. The written assessment, fitness, interview, background and medical are all
 * judged now, on what the life shows, and the decision comes three months later.
 */
export function applyPolice(agencyId) {
  const p = player();
  const r = I();
  const a = agency(agencyId);
  if (!a) return result(false, 'There is no such agency.', 'neutral');
  { const sc = jobBlockSpecial('police', p); if (sc) return result(false, sc, 'neutral'); }
  const no = policeUnmet(a, p);
  if (no.length) return result(false, no[0], 'neutral');
  if (!once(`apply:${agencyId}`)) return result(false, 'They take one application a year from the same person.', 'neutral');
  studyCredit(p, r);
  const roll = seeded(`${me()}/${a.id}/${year()}`);
  const base = policeBase(p, r);
  const scores = Object.fromEntries(Object.entries(base).map(([k, [mean, spread]]) => [k, clamp(mean + roll.int(-spread, spread))]));
  const pass = Object.entries(POLICE_PASS).every(([k, min]) => scores[k] >= min);
  const app = { id: nextId('app'), kind: 'police', ownerId: a.id, filed: now(), due: now() + 3, scores, outcome: pass ? 'offer' : 'refused', status: 'pending',
    why: pass ? '' : Object.entries(POLICE_PASS).filter(([s, min]) => scores[s] < min).map(([s]) => s)[0],
    close: !pass && Object.entries(POLICE_PASS).filter(([s, min]) => scores[s] < min).every(([s, min]) => min - scores[s] <= 4) };
  r.apps.push(app);
  r.family ??= 'police';
  if (r.stage === 'none') r.stage = 'applying';
  note(`Applied to ${a.name}.`, 'career', { log: false });
  return result(true, `Your application to ${a.name} is in: a written assessment, a fitness test, an interview, a background check and a medical. You will hear by ${dateWords(app.due)}.`, 'neutral');
}

/** What each part of the police assessment asks (out of 100). */
export const POLICE_PASS = { written: 50, fitness: 45, interview: 45, background: 55, medical: 45 };
/** Each part's expected score and its spread of luck, before the luck. */
function policeBase(p, r) {
  return {
    written: [p.stats.intellect * 0.5 + skillAvg(['reasoning', 'law', 'writing'], r) * 0.5 + r.prep.study * 4 + (university(p) ? 4 : 0) + (studied('police', p).length ? 6 : 0), 10],
    fitness: [p.stats.health * 0.8 + r.prep.fitness * 6, 10],
    interview: [p.stats.charm * 0.5 + skillAvg(['interviewing', 'ethics'], r) * 0.5 + r.interest * 3, 12],
    background: [80 - record(p).length * 25 + (p.hidden.karma - 50) / 3, 5],
    medical: [p.stats.health, 5],
  };
}
/** The chance of an offer before applying, in plain words, and the weakest part of the assessment. */
export function policeOdds(p = player()) {
  const r = I(p);
  const base = policeBase(p, r);
  let chance = 1;
  let weakest = null;
  let low = Infinity;
  for (const [k, [mean, spread]] of Object.entries(base)) {
    const m = clamp(mean);
    const pk = Math.max(0, Math.min(1, (m + spread - POLICE_PASS[k] + 1) / (2 * spread + 1)));
    chance *= pk;
    if (pk < low) { low = pk; weakest = k; }
  }
  return { chance, words: oddsWords(chance), weakest: low < 0.95 ? weakest : null };
}

const WHY = { written: 'the written assessment', fitness: 'the fitness assessment', interview: 'the interview', background: 'the background check', medical: 'the medical' };
/** What would help next time, for each part of the assessment. */
export const WHY_HELP = { written: 'Studying for the entrance assessment helps.', fitness: 'Training for the fitness assessment helps, a little more each year you do it.', interview: 'A ride-along or open day helps you talk about the work.', background: 'A background check looks at your record and your conduct.', medical: 'Looking after your health helps.' };

/** Decisions whose date has come, made known. Called from the year and whenever the hub is opened. */
export function settleApplications(p = player()) {
  const r = rec(p);
  if (!r) return [];
  const out = [];
  // Promotions are settled by settlePromotions, which applies the new rank; closing them here first lost it.
  for (const app of r.apps.filter((x) => x.status === 'pending' && x.due <= now() && x.kind !== 'promotion')) {
    if (app.kind === 'federal') { const s = federalStage(app); if (s) out.push(s); continue; }
    app.status = app.outcome;
    const who = agency(app.ownerId)?.name ?? office(app.ownerId)?.name ?? 'The agency';
    // Refused, with nothing else pending: no longer applying (the record of the application stays).
    if (app.kind === 'police' && app.outcome !== 'offer' && r.stage === 'applying' && !r.apps.some((x) => x !== app && x.status === 'pending' && x.kind === 'police')) r.stage = 'none';
    if (app.kind === 'police') out.push(app.outcome === 'offer' ? `${who} has offered you a place at the academy.` : `${who} will not take your application further: ${WHY[app.why] ?? 'the panel chose others'} was not strong enough this time.${app.close ? ' It was close.' : ''} ${WHY_HELP[app.why] ?? ''} You can apply again next year.`);
    if (app.kind === 'detective') out.push(settleDetective(app));
    if (app.kind === 'license') out.push(settleLicense(app));
  }
  for (const line of out) log(line, 'system', 'neutral');
  return out;
}

/** Takes up an offer: the academy begins now, paid as a recruit. */
export function acceptAcademy(appId) {
  const p = player();
  const r = I();
  const app = r.apps.find((x) => x.id === appId && x.status === 'offer');
  if (!app) return result(false, 'There is no offer to accept.', 'neutral');
  const a = agency(app.ownerId);
  const d = AGENCY_KINDS[a.kind];
  app.status = 'accepted';
  studyCredit(p, r);
  hire(CAREER_BY_ID.police, 0, 55, 'academy', { employerId: a.employerId });
  p.career.title = 'Police recruit';
  const classmates = [0, 1].map(() => staffer(a.countryId, 'officer', 'Police recruit', { agencyId: a.id, rank: 'recruit', age: Math.max(21, p.age + rng.int(-3, 3)) }).id);
  r.academy = { ownerId: a.id, start: now(), end: now() + d.academyMonths, extended: false, status: 'enrolled', marks: { law: 0, writing: 0, communication: 0, ethics: 0, deescalation: 0, fitness: 0 },
    assessed: false, classmateIds: classmates, federal: null };
  r.people.classmateIds = [...new Set([...r.people.classmateIds, ...classmates])];
  meet(classmates[0], 'Academy classmate');
  r.family = 'police';
  r.stage = 'academy';
  r.job = { agencyId: a.id, employerId: a.employerId, rank: 'recruit', detective: false, specialty: null, since: year(), rankSince: year(), probationEnd: null };
  r.stats.agencies = [...new Set([...r.stats.agencies, a.id])];
  note(`Began the academy at ${a.name}.`, 'career', { key: `academy:${a.id}`, milestone: `Entered the police academy: ${a.name}.` });
  return result(true, `You start at the academy in ${dateWords(now())}. It runs to ${dateWords(r.academy.end)}. ${name(classmates[0])} is in your class.`);
}
export function declineOffer(appId) {
  const app = rec()?.apps.find((x) => x.id === appId && x.status === 'offer');
  if (!app) return result(false, 'There is no offer.', 'neutral');
  app.status = 'declined';
  return result(true, 'You declined. The offer will not be held.', 'neutral');
}

// ---------- The academy ----------

/** What a recruit (or a federal trainee) can do: each once a year. */
export const ACADEMY = {
  study: { label: 'Study criminal law and procedure', marks: ['law'], skills: ['law', 'reasoning'] },
  write: { label: 'Practice report writing', marks: ['writing'], skills: ['writing'] },
  talk: { label: 'Work on communication and de-escalation', marks: ['communication', 'deescalation'], skills: ['interviewing'] },
  ethics: { label: 'Take the ethics seminar seriously', marks: ['ethics'], skills: ['ethics'] },
  fitness: { label: 'Train for the physical readiness standard', marks: ['fitness'] },
  feedback: { label: 'Ask an instructor for feedback', marks: [], skills: ['writing', 'reasoning'], feedback: true },
};
export function academyAct(id) {
  const p = player();
  const r = I();
  const ac = r.academy;
  if (ac?.status !== 'enrolled') return result(false, 'You are not at an academy.', 'neutral');
  const d = ACADEMY[id];
  if (!d || !once(`academy:${id}`)) return result(false, 'You have done that this year.', 'neutral');
  for (const m of d.marks) ac.marks[m] += 1;
  for (const s of d.skills ?? []) grow(s, 4);
  if (id === 'fitness') p.stats.health = clamp(p.stats.health + 2);
  // Under a national use-of-force standard, de-escalation is taught as the core of the job (reform.js).
  if (id === 'talk' && inForce(p.countryId, 'force')) { ac.marks.deescalation += 1; grow('interviewing', 2); }
  if (d.feedback) { const weak = Object.entries(ac.marks).sort((x, y) => x[1] - y[1])[0][0]; return result(true, `The instructor was direct: your ${weak.replace('deescalation', 'de-escalation')} needs the most work before graduation.`, 'neutral'); }
  return result(true, { study: 'You read the statutes until they made sense, then read them again.', write: 'Your reports came back with fewer red marks each week.', talk: 'In the role-plays you learned to slow a situation down instead of speeding it up.',
    ethics: 'The ethics seminar was mostly cases where the right thing cost someone something.', fitness: 'You met the physical readiness standard with room to spare.' }[id]);
}
/** How ready for graduation: the marks earned, the skills built, and health. Not the number of turns. */
const readiness = (r, p) => {
  const ac = r.academy;
  const marks = Object.values(ac.marks).reduce((s, v) => s + Math.min(2, v), 0) * 4;
  return clamp(skillAvg(['law', 'writing', 'interviewing', 'ethics'], r) * 0.6 + marks + (p.stats.health - 50) / 3 + p.stats.intellect / 8 + trainingBonus(ac.ownerId) + (studied('police', p).length ? 4 : 0));
};

/** The academy's end, when the calendar reaches it: graduate, more time (once), or not. */
export function settleAcademy(p = player()) {
  const r = rec(p);
  const ac = r?.academy;
  if (ac?.status !== 'enrolled' || now() < ac.end) return null;
  // Dated from the academy's own end, not from whenever the game next looks: on a yearly turn the academy still ends,
  // and field training starts, on the day it would have on a shorter one.
  const roll = seeded(`${me()}/${ac.ownerId}/${ac.end}`);
  const score = readiness(r, p) + roll.int(-8, 8);
  if (score >= 50) return graduate(p, r);
  if (!ac.extended) {
    ac.extended = true; ac.end += 2;
    log('The academy needs more from you: two more months of training before you can graduate.', 'system', 'neutral');
    return now() >= ac.end ? settleAcademy(p) : 'more'; // the two months may already have passed in this turn
  }
  ac.status = 'failed';
  quitCareer(); // the job was the place at the academy: it ends with it
  r.stage = 'none';
  r.job = null;
  note('Did not complete the academy. You can apply again next year.', 'career', { tone: 'bad' });
  return 'failed';
}
function graduate(p, r) {
  const ac = r.academy;
  ac.status = 'graduated';
  ac.graduated = ac.end; // the day the academy ended, however long the turn
  if (ac.federal) return federalGraduate(p, r);
  const a = agency(ac.ownerId);
  const d = AGENCY_KINDS[a.kind];
  const fto = a.ftoIds[0];
  r.people.ftoId = fto;
  meet(fto, 'Field training officer');
  r.people.mentorId ??= fto;
  r.stage = 'field';
  r.job.rank = 'probationary';
  r.job.rankSince = year();
  r.job.fieldEnd = ac.graduated + d.fieldMonths;
  r.job.probationEnd = ac.graduated + d.probationMonths;
  p.career.title = (d.titles ?? [])[1] ?? 'Probationary officer';
  note(`Graduated from the academy at ${a.name}.`, 'career', { key: `graduated:${a.id}`, milestone: 'Graduated from the police academy.', significance: 2 });
  return 'graduated';
}

/** Extensions of field training a department gives before it decides: about a year of them. */
export const FTO_EXTENSIONS = 4;
export const FTO_SKILLS = ['writing', 'observation', 'interviewing', 'ethics'];

/**
 * The field training officer's reviews, one at the end of each stretch of training that has passed: the first at the
 * end of field training, then every three months. Every review whose date has come is held, in order, however long
 * the turn (a year's turn holds four at once), each with its own roll, so the outcome is the same at any turn length.
 * The player hears once: signed off, or how many months were added and what to work on. After the last extension the
 * department decides: a narrow pass, or a last chance to ask for (a scene, inv_fto_last_chance).
 */
function fieldReviews(p, r, j) {
  const fto = name(r.people.ftoId);
  const score = (at) => skillAvg(FTO_SKILLS, r) + (r.acted.field ?? 0) + seeded(`${me()}/fto/${at}`).int(-10, 10);
  let added = 0;
  while (r.stage === 'field' && now() >= j.fieldEnd) {
    const s = score(j.fieldEnd);
    if (s >= 30) {
      r.stage = 'probation';
      // Probation runs on past a late sign-off: at least six months as a probationary officer on their own.
      j.probationEnd = Math.max(j.probationEnd ?? 0, j.fieldEnd + 6);
      note(`${fto} signed off your field training${(j.ftoExtensions ?? 0) ? ` after ${j.ftoExtensions * 3} extra months` : ''}.`, 'career', { log: true });
      return;
    }
    if ((j.ftoExtensions ?? 0) >= FTO_EXTENSIONS) {
      if (s >= 22) {
        r.stage = 'probation';
        j.probationEnd = Math.max(j.probationEnd ?? 0, j.fieldEnd + 6);
        note(`At the last review, ${fto} signed off your field training, just. Your sergeant will be watching your probation closely.`, 'career', { log: true });
        regard('reliability', -2);
        return;
      }
      j.ftoLastChance = j.fieldEnd;
      const asked = storyBeat('inv_fto_last_chance', { words: { fto, months: String(j.ftoExtensions * 3) } }, { source: 'investigations', must: true });
      if (!asked) ftoLetGo(p, r);
      return;
    }
    j.ftoExtensions = (j.ftoExtensions ?? 0) + 1;
    j.fieldEnd += 3;
    added += 3;
  }
  if (!added) return;
  // What is holding them back, and the patrol work that builds it (My Investigations).
  const weakest = [...FTO_SKILLS].sort((a, b) => (r.skills[a] ?? 0) - (r.skills[b] ?? 0))[0];
  const act = Object.values(PATROL).find((x) => x.skills.includes(weakest));
  const left = FTO_EXTENSIONS - j.ftoExtensions;
  log(`${fto} wants ${added === 3 ? 'three' : added === 6 ? 'six' : added === 9 ? 'nine' : 'twelve'} more months of field training before signing you off: your ${weakest} is not there yet.${act ? ` "${act.label}" in My Investigations is the way to build it.` : ''} ${left ? `The department will extend field training ${left === 1 ? 'once more' : `${left} more times`} at most.` : 'There will be no more extensions after this.'}`, 'system', 'bad');
}

/** The department lets a trainee go who has not passed field training. */
function ftoLetGo(p, r) {
  note('The department let you go at the end of field training.', 'career', { log: true, milestone: 'Did not complete police field training.' });
  jobEnded(p, r, 'dismissed');
  quitCareer();
}

/** The last-chance conversation (inv_fto_last_chance): one final three months, or not. */
export function ftoLastChance(ask) {
  const p = player();
  const r = rec(p);
  const j = r?.job;
  if (!j?.ftoLastChance || r.stage !== 'field') return null;
  const at = j.ftoLastChance;
  delete j.ftoLastChance;
  if (ask && seeded(`${me()}/fto-last/${at}`).chance(clamp(0.35 + (r.skills.ethics ?? 0) / 200 + (r.skills.teamwork ?? 0) / 300, 0.2, 0.8))) {
    j.fieldEnd = at + 3;
    j.ftoExtensions = FTO_EXTENSIONS - 1; // one review more: pass it, or the decision is final
    return 'The captain agrees to three more months. Your field training officer says it plainly: this is the last.';
  }
  ftoLetGo(p, r);
  return ask ? 'The captain listens, and says no. You hand in your badge at the front desk.' : 'You hand in your badge at the front desk.';
}

/** Field training and probation, as the calendar reaches their ends. */
export function settleProbation(p = player()) {
  const r = rec(p);
  if (!r?.job || r.family !== 'police') return null;
  const j = r.job;
  if (r.stage === 'field' && j.fieldEnd && now() >= j.fieldEnd && !j.ftoLastChance) fieldReviews(p, r, j);
  if (r.stage === 'probation' && j.probationEnd && now() >= j.probationEnd) {
    r.stage = 'officer';
    j.rank = 'officer';
    j.rankSince = year();
    const a = agency(j.agencyId);
    p.career.title = (AGENCY_KINDS[a?.kind]?.titles ?? [])[2] ?? 'Police officer';
    note(`Completed probation at ${a?.name ?? 'the department'}.`, 'career', { key: `probation:${j.agencyId}`, milestone: `Became a ${p.career.title.toLowerCase()}.` });
  }
  return r.stage;
}

/** What an officer in field training or on patrol does: each once a year, and it builds the skills a detective needs. */
export const PATROL = {
  report: { label: 'Write up an incident report', skills: ['writing', 'observation'], texts: ['A shoplifting report, then a lost bicycle. Your field training officer read both and returned one.', 'A burglary at a dry cleaner: you wrote what you saw at the back door, and what the owner only thought.', 'Three reports before lunch. The one that mattered was the shortest.'] },
  call: { label: 'Respond to a call for help', skills: ['interviewing', 'ethics'], texts: ['A neighbor dispute over a fence. Nobody was arrested; both sides went home a little calmer.', 'A man on a bridge, a long talk, and a ride to the hospital he agreed to in the end.', 'A child lost at the fair, found asleep under a stall twenty minutes later.'] },
  reporting: { label: 'Take a statement from a reporting person', skills: ['interviewing', 'writing'], texts: ['A woman whose car was broken into. You wrote down exactly what she said, and what she was not sure of.', 'An old man sure his neighbor took his mail. You took it all down, and the neighbor\'s side too.', 'A shop owner who saw the thief\'s face. You asked how long he had looked, and wrote that down too.'] },
  observe: { label: 'Document what you observe on shift', skills: ['observation', 'timeline'], texts: ['You noted times, plates and details. Most of it was nothing. Some of it might not be.', 'The same van outside the same warehouse three nights running. You wrote it down and passed it on.', 'A quiet shift. Your notes are still the best record of it.'] },
  supervisor: { label: 'Ask your supervisor about a hard call', skills: ['law', 'ethics'], texts: ['Your sergeant walked you through what the law allowed, and what it did not.', 'You and your sergeant went over a search you were unsure of. You were right to be unsure.', 'Your sergeant asked what you would do differently. You had an answer.'] },
  community: { label: 'Get to know the people on your beat', skills: ['teamwork', 'interviewing'], texts: ['The shop owners on your beat know your name now, and you know theirs.', 'The kids at the basketball court stopped going quiet when you walk past.', 'A woman you helped last year waves you over to say her son got the job.'] },
  assist: { label: 'Assist a detective on a case', skills: ['evidence', 'reasoning'], texts: ['You canvassed a street for a detective and wrote down what three neighbors saw. One detail mattered.', 'A detective asked for your notes from a night months ago. They were good enough to use.', 'You sat in on an interview and watched how a detective lets silence do the work.'] },
};
export function patrol(id) {
  const r = I();
  if (!['field', 'probation', 'officer'].includes(r.stage) || r.job?.detective) return result(false, 'That is patrol work.', 'neutral');
  const d = PATROL[id];
  if (!d || !once(`patrol:${id}`)) return result(false, 'You have done that this year.', 'neutral');
  for (const s of d.skills) grow(s, 3);
  r.acted.field = (r.acted.field ?? 0) + 1;
  regard('reliability', 1);
  if (id === 'community') regard('teamwork', 1);
  // A different moment each year (the same three sentences every year read like a form).
  const texts = d.texts.filter((t) => !(id === 'supervisor' && r.stage === 'officer' && t.startsWith('Your sergeant walked')));
  return result(true, texts[(year() + id.length) % texts.length], 'neutral');
}

// ---------- Detective selection ----------

/** Patrol work done for the player each year (on), or left to them (off). */
export function setAutoPatrol(on) {
  const r = I();
  r.autoPatrol = !!on;
  if (on) for (const { id } of patrolLeft(r)) patrol(id);
  return result(true, on ? 'Your routine patrol work is done for you each year now. Cases and choices stay yours.' : 'You choose your patrol work yourself again.', 'neutral');
}
/** The year's patrol work, done for a player who asked for it (the yearly step, engine/investigations/index.js). */
export function autoPatrolYear(r = rec()) {
  if (!r?.autoPatrol) return;
  for (const { id } of patrolLeft(r)) patrol(id);
}

/** Patrol work not yet done this year (each can be done once a year). */
export function patrolLeft(r = rec()) {
  if (!r || !['field', 'probation', 'officer'].includes(r.stage) || r.job?.detective) return [];
  const done = r.acted?.year === year() ? r.acted : {};
  return Object.entries(PATROL).filter(([id]) => !done[`patrol:${id}`]).map(([id, x]) => ({ id, label: x.label, skills: x.skills }));
}

/** Why an officer cannot apply for detective work yet, or []. Experience, not arrests, decides. */
export function detectiveUnmet(p = player()) {
  const r = rec(p);
  const out = [];
  if (!r?.job || r.family !== 'police') return ['Detectives are selected from serving officers.'];

  if (['academy', 'field', 'probation'].includes(r.stage)) out.push('Finish probation first.');
  const years = year() - (r.job.since ?? year());
  if (years < 3 && !r.job.legacy) out.push(`Needs three years as an officer (you have ${Math.max(0, years)}).`);
  if (reputationOf(r) < 40) out.push('Your record of reliable work is not strong enough yet.');
  if (r.apps.some((x) => x.kind === 'detective' && x.status === 'pending')) out.push('Your application is with the panel.');
  return out;
}
/** Applies for an open seat in a unit. Another officer applies too; the panel chooses. */
export function applyDetective(vacancyId) {
  const p = player();
  const r = I();
  const a = agency(r.job?.agencyId);
  if (!a) return result(false, 'You are not with a department.', 'neutral');
  const no = detectiveUnmet(p);
  if (no.length) return result(false, no[0], 'neutral');
  const v = vacancies(a, 'detective').find((x) => x.id === vacancyId);
  if (!v) return result(false, 'That seat is no longer open.', 'neutral');
  if (!once('apply:detective')) return result(false, 'One application a year.', 'neutral');
  const s = SPECIALTIES[v.unit];
  const asDetective = r.job.detective ? year() - (r.job.detectiveSince ?? year()) : 0;
  if (s.years && asDetective < s.years) return result(false, `${s.name} takes detectives with ${s.years} years in investigations first.`, 'neutral');
  const roll = seeded(`${me()}/${v.id}`);
  studyCredit(p, r);
  // A relevant degree helps; one that fits the unit (accounting for fraud, cybersecurity for cybercrime) helps more.
  const mine = skillAvg(['reasoning', 'writing', 'evidence', 'interviewing'], r) * 0.6 + reputationOf(r) * 0.4 + (s.skill ? r.skills[s.skill] / 5 : 0) + (studied('detective', p).length ? 4 : 0) + (studied(v.unit, p).length ? 6 : 0) + roll.int(-10, 10);
  const rival = staffer(a.countryId, 'officer', 'Police officer', { agencyId: a.id, rank: 'officer', age: Math.max(25, p.age + roll.int(-4, 6)) });
  const theirs = 45 + roll.int(-8, 18);
  v.applicants.push(me(), rival.id);
  r.apps.push({ id: nextId('app'), kind: 'detective', ownerId: a.id, vacancyId: v.id, unit: v.unit, filed: now(), due: now() + 2, status: 'pending', outcome: mine >= theirs && mine >= 38 ? 'selected' : 'not_selected',
    rivalId: rival.id, scores: { mine: Math.round(mine), theirs: Math.round(theirs) } });
  return result(true, `You applied for the ${s.name.toLowerCase()} seat. There is an assessment and a panel interview; ${name(rival.id)} has applied too. The panel decides by ${dateWords(now() + 2)}.`, 'neutral');
}
function settleDetective(app) {
  const p = player();
  const r = I();
  const a = agency(app.ownerId);
  const v = a?.vacancies.find((x) => x.id === app.vacancyId);
  const s = SPECIALTIES[app.unit];
  if (app.outcome !== 'selected') {
    if (v) { v.status = 'filled'; v.filledBy = app.rivalId; }
    npc(app.rivalId).flags.inv.rank = 'detective';
    a.units[app.unit]?.memberIds.push(app.rivalId);
    r.people.rivalId ??= app.rivalId;
    return `The panel chose ${name(app.rivalId)} for the ${s.name.toLowerCase()} seat. Your feedback: keep building your reports and your casework, and apply again.`;
  }
  if (v) { v.status = 'filled'; v.filledBy = me(); }
  becomeDetective(p, r, a, app.unit);
  return `You were selected: detective, ${s.name.toLowerCase()}.`;
}
/** Becomes a detective in a unit: the assignment, a persistent partner, and the unit's supervisor. */
export function becomeDetective(p, r, a, unitId) {
  const u = a.units[unitId] ?? a.units.general ?? Object.values(a.units)[0];
  if (r.job.detective) {
    // A transfer between units: the same detective, rank and seniority, in another unit.
    const old = a.units[r.job.specialty];
    if (old) old.memberIds = old.memberIds.filter((id) => id !== me());
    r.job = { ...r.job, specialty: u.specialty, unit: u.specialty };
  } else {
    hire(CAREER_BY_ID.detective, 0, 60, 'selection', { employerId: a.employerId });
    r.job = { ...r.job, detective: true, rank: 'detective', specialty: u.specialty, unit: u.specialty, rankSince: year(), detectiveSince: year() };
  }
  r.stage = 'detective';
  if (!u.memberIds.includes(me())) u.memberIds.push(me());
  const partner = u.memberIds.find((id) => id !== me() && npc(id)?.alive) ?? staffer(a.countryId, 'detective', 'Detective', { agencyId: a.id, rank: 'detective', specialty: u.specialty }).id;
  if (r.people.partnerId && r.people.partnerId !== partner) r.people.formerPartnerIds.push(r.people.partnerId);
  r.people.partnerId = partner;
  r.people.supervisorId = u.headId;
  meet(partner, 'Detective partner');
  meet(u.headId, 'Detective sergeant');
  r.stats.units = [...new Set([...r.stats.units, u.specialty])];
  p.career.title = `${rankName(r.job.rank, r) ?? 'Detective'}, ${SPECIALTIES[u.specialty].name.toLowerCase()}`;
  note(`Became a detective in ${SPECIALTIES[u.specialty].name.toLowerCase()} at ${a.name}.`, 'career', { key: `detective:${a.id}:${u.specialty}`, milestone: `Became a detective: ${SPECIALTIES[u.specialty].name}.`, significance: 2 });
}

/** A rank's name where the player serves: a UK force has constables and inspectors, a Japanese one junsa and keibu. */
export function rankName(rankId, r = rec()) {
  if (r?.family === 'federal') return FEDERAL_RANKS[rankId]?.name ?? null;
  const d = AGENCY_KINDS[agency(r?.job?.agencyId)?.kind];
  return d?.rankNames?.[rankId] ?? d?.detectiveNames?.[rankId] ?? POLICE_RANKS[rankId]?.name ?? DETECTIVE_RANKS[rankId]?.name ?? null;
}

// ---------- Promotions ----------

/** The next ranks open to the player, and what each asks. Nothing is offered without a vacancy. */
export function promotionOptions(p = player()) {
  const r = rec(p);
  if (!r?.job || r.retired) return [];
  const table = r.family === 'federal' ? FEDERAL_RANKS : r.job.detective ? DETECTIVE_RANKS : POLICE_RANKS;
  const cur = table[r.job.rank];
  if (!cur) return [];
  const next = Object.entries(table).filter(([, x]) => x.order === cur.order + 1).map(([id, x]) => ({ id, ...x, name: rankName(id, r) ?? x.name }));
  return next.map((x) => {
    const served = year() - (r.job.rankSince ?? year());
    let block = '';
    if (STUDY.degreeRanks.includes(x.id) && !university(p)) block = 'Senior posts ask for a bachelor\'s degree. Many officers study part-time while serving.';
    else if (served < (x.years ?? 3)) block = `Needs ${x.years ?? 3} years at your rank (you have ${served}).`;
    else if (reputationOf(r) < (x.leader ? 58 : 50)) block = 'Your professional record needs to be stronger.';
    else if (x.leader && r.skills.leadership < 35) block = 'Needs more leadership experience.';
    else if (r.apps.some((a) => a.kind === 'promotion' && a.status === 'pending')) block = 'Your application is being considered.';
    return { ...x, block, how: x.appointed ? 'Selection by the agency\'s leadership' : x.exam ? 'An examination and a panel' : 'A review of your work' };
  });
}
/** Applies for the next rank. A vacancy is needed (seeded, the same for any turn length); a rival may be chosen. */
export function seekPromotion(rankId) {
  const p = player();
  const r = I();
  const o = promotionOptions(p).find((x) => x.id === rankId);
  if (!o) return result(false, 'There is no such step.', 'neutral');
  if (o.block) return result(false, o.block, 'neutral');
  if (!once('promotion')) return result(false, 'One attempt a year.', 'neutral');
  const roll = seeded(`${me()}/promo/${rankId}/${year()}`);
  const vacancy = roll.chance(o.top ? 0.25 : o.appointed ? 0.4 : 0.6);
  if (!vacancy) return result(true, `There is no ${o.name.toLowerCase()} vacancy this year. You will be considered when one opens.`, 'neutral');
  const mine = reputationOf(r) * 0.5 + r.skills.leadership * (o.leader ? 0.3 : 0.1) + skillAvg(['reasoning', 'management', 'law'], r) * 0.3 + roll.int(-10, 10);
  const owner = r.job.agencyId ? agency(r.job.agencyId) : office(r.job.officeId);
  const rival = r.people.rivalId && npc(r.people.rivalId)?.alive ? npc(r.people.rivalId) : staffer(p.countryId, 'officer', 'Colleague', { agencyId: owner?.id });
  const theirs = 50 + roll.int(-10, 15);
  r.people.rivalId = rival.id;
  r.apps.push({ id: nextId('app'), kind: 'promotion', ownerId: owner?.id, rank: rankId, filed: now(), due: now() + 2, status: 'pending', outcome: mine >= theirs ? 'promoted' : 'passed_over', rivalId: rival.id });
  return result(true, `There is a ${o.name.toLowerCase()} vacancy. ${o.how}. ${name(rival.id)} is in the running too. You will hear by ${dateWords(now() + 2)}.`, 'neutral');
}
/** A promotion decision, when its date comes. */
export function settlePromotions(p = player()) {
  const r = rec(p);
  if (!r) return [];
  const out = [];
  for (const app of r.apps.filter((x) => x.kind === 'promotion' && x.status === 'pending' && x.due <= now())) {
    app.status = app.outcome;
    if (app.outcome !== 'promoted') { out.push(`${name(app.rivalId)} got the promotion. Your time may come.`); regard('reliability', 0); continue; }
    const table = r.family === 'federal' ? FEDERAL_RANKS : r.job.detective ? DETECTIVE_RANKS : POLICE_RANKS;
    const x = table[app.rank];
    r.job.rank = app.rank;
    r.job.rankSince = year();
    while (p.career.level < x.level && promote()) { /* the payroll follows the rank */ }
    const title = rankName(app.rank, r) ?? x.name;
    p.career.title = title;
    if (x.leader) grow('leadership', 5);
    if (app.rank === 'chief') { const a = agency(r.job.agencyId); if (a) { const old = npc(a.chiefId); if (old) { old.occupation = 'Retired chief of police'; old.flags.justice.retired = year(); } a.chiefId = me(); } }
    note(`Promoted to ${title.toLowerCase()}.`, 'career', { key: `rank:${app.rank}:${app.ownerId}`, milestone: `Promoted to ${title.toLowerCase()}.`, significance: x.leader ? 2 : 1 });
    out.push(`You are now ${title.toLowerCase()}.`);
  }
  for (const line of out) log(line, 'system', 'neutral');
  return out;
}

// ---------- Federal agencies ----------

/** Why the player cannot apply to a federal agency, or []. Each agency has its own rules (simplified: data/investigations.js). */
export function federalUnmet(key, p = player()) {
  const d = FEDERAL[key];
  const e = d.eligibility;
  const out = [];
  if (year() < d.since) return [`The ${d.short} does not exist yet.`];
  if (!rightToLive(e.citizen, p)) out.push('Applicants must be US citizens.');
  if (p.age < e.minAge) out.push(`Applicants must be at least ${e.minAge}.`);
  if (p.age > e.maxAge && !p.flags.served) out.push(`Applicants must be appointed by ${e.maxAge + 1} (veterans may have more time).`);
  if (!university(p)) out.push('Needs a bachelor\'s degree.');
  // Some agencies ask for a particular background (IRS Criminal Investigation: accounting coursework).
  if (e.background && !backgrounds(p).includes(e.background)) out.push(`Needs a background in ${e.background} (coursework or a degree).`);
  const need = advanced(p) && e.advancedDegreeYears != null ? e.advancedDegreeYears : e.experienceYears;
  if (workYears(p) < need) out.push(`Needs ${need} year${need === 1 ? '' : 's'} of full-time professional work.`);
  if (record(p).length) out.push('A criminal record rules this out.');
  if (p.stats.health < e.fitness) out.push('Needs to meet the fitness standard.');
  if (rec(p)?.apps.some((x) => x.kind === 'federal' && x.status === 'pending')) out.push('You have an application in progress.');
  if (rec(p)?.job?.agencyKind === key && rec(p)?.family === 'federal') out.push(`You are with the ${d.short} already.`);
  return out;
}
/** Applies to a federal agency. Each stage is decided now and made known when its date comes. */
export function applyFederal(key) {
  const p = player();
  const r = I();
  const d = FEDERAL[key];
  { const sc = jobBlockSpecial(d?.career ?? 'federal', p); if (sc) return result(false, sc, 'neutral'); }
  const no = federalUnmet(key, p);
  if (no.length) return result(false, no[0], 'neutral');
  if (!once(`apply:${key}`)) return result(false, 'One application a year.', 'neutral');
  const roll = seeded(`${me()}/${key}/${year()}`);
  const bg = backgrounds(p);
  const fit = (bg.length ? 8 : 0) + (bg.includes('law_enforcement') ? 4 : 0);
  const stages = [
    { id: 'assessment', name: 'the assessment', score: clamp(p.stats.intellect * 0.5 + skillAvg(['reasoning', 'writing', 'law'], rec(p)) * 0.4 + fit + roll.int(-12, 12)), min: 52 },
    { id: 'interview', name: 'the interview', score: clamp(p.stats.charm * 0.4 + skillAvg(['interviewing', 'ethics', 'teamwork'], rec(p)) * 0.5 + fit + roll.int(-12, 12)), min: 50 },
    { id: 'background', name: 'the background investigation', score: clamp(85 + (p.hidden.karma - 50) / 2 - (p.flags.debtTrouble ? 25 : 0) + roll.int(-10, 5)), min: 55 },
    { id: 'fitness', name: 'the fitness test', score: clamp(p.stats.health * 0.85 + r.prep.fitness * 5 + roll.int(-10, 10)), min: 50 },
  ];
  const at0 = now();
  stages.forEach((s, i) => { s.due = at0 + 3 * (i + 1); s.pass = s.score >= s.min; s.known = false; });
  // Passing every stage is not the end: agencies hire to their needs.
  const selected = stages.every((s) => s.pass) && roll.chance(0.75);
  const app = { id: nextId('app'), kind: 'federal', agency: key, filed: at0, due: stages[0].due, stages, decisionDue: at0 + 14, selected, status: 'pending', backgrounds: bg };
  r.apps.push(app);
  note(`Applied to the ${d.short}.`, 'career', { key: `fedapp:${key}:${year()}`, milestone: null, log: false });
  return result(true, `Your application to the ${d.name} is in. ${bg.length ? `They look for backgrounds like yours (${bg.join(', ').replace(/_/g, ' ')}). ` : ''}Each stage takes months: the first result comes by ${dateWords(stages[0].due)}.`, 'neutral');
}
/** The next known stage of a federal application. */
function federalStage(app) {
  for (const s of app.stages) {
    if (s.known) continue;
    if (s.due > now()) { app.due = s.due; return null; }
    s.known = true;
    if (!s.pass) { app.status = 'refused'; return `The ${FEDERAL[app.agency].short} has ended your application after ${s.name}. You may apply again in a later year.`; }
  }
  if (now() < app.decisionDue) { app.due = app.decisionDue; return null; }
  app.status = app.selected ? 'offer' : 'refused';
  return app.selected ? `The ${FEDERAL[app.agency].short} has offered you a place in the next class at ${FEDERAL[app.agency].academy}.` : `You passed every stage, but the ${FEDERAL[app.agency].short} has not selected you this time. You can apply again.`;
}
/** Takes a federal offer: training at the agency's own academy, as a trainee. */
export function acceptFederal(appId) {
  const p = player();
  const r = I();
  const app = r.apps.find((x) => x.id === appId && x.kind === 'federal' && x.status === 'offer');
  if (!app) return result(false, 'There is no offer.', 'neutral');
  const d = FEDERAL[app.agency];
  app.status = 'accepted';
  if (r.job && r.family === 'police') { note(`Left ${agency(r.job.agencyId)?.name ?? 'the department'} for the ${d.short}.`, 'career', { log: false }); r.people.formerPartnerIds.push(...[r.people.partnerId].filter(Boolean)); }
  hire(CAREER_BY_ID[d.career], 0, 55, 'academy');
  p.career.title = `${d.title ?? 'Special agent'} trainee`;
  r.family = 'federal';
  r.stage = 'federal_training';
  const classmates = [0, 1].map(() => staffer('us', 'detective', 'Special agent trainee', { rank: 'trainee', age: Math.max(23, p.age + rng.int(-4, 4)) }).id);
  r.academy = { ownerId: null, federal: app.agency, start: now(), end: now() + d.academyMonths, extended: false, status: 'enrolled',
    marks: { law: 0, writing: 0, communication: 0, ethics: 0, deescalation: 0, fitness: 0 }, classmateIds: classmates };
  meet(classmates[0], 'Academy classmate');
  r.people.classmateIds = [...new Set([...r.people.classmateIds, ...classmates])];
  r.job = { agencyKind: app.agency, officeId: null, employerId: null, rank: 'trainee', detective: false, since: year(), rankSince: year() };
  note(`Began training at ${d.academy}.`, 'career', { key: `fedacademy:${app.agency}`, milestone: `Began training as a ${d.short} special agent.`, significance: 2 });
  return result(true, `You report to ${d.academy} in ${dateWords(now())}. Training runs to ${dateWords(r.academy.end)}.`);
}
/** After a federal academy: an assignment to a field office, chosen by the agency's needs (the player's wish counts a little). */
function federalGraduate(p, r) {
  const key = r.academy.federal;
  const d = FEDERAL[key];
  const cities = federalCities();
  const roll = seeded(`${me()}/${key}/office/${r.academy.end}`);
  const city = r.academy.wish && roll.chance(0.4) ? r.academy.wish : roll.pick(cities);
  const o = officeOf(key, city);
  r.job.officeId = o.id;
  r.job.employerId = o.employerId;
  r.job.rank = 'agent';
  r.job.rankSince = year();
  r.job.probationEnd = (r.academy?.graduated ?? now()) + 24;
  r.stage = 'agent';
  const moved = city !== p.city;
  r.pendingMove = moved ? city : null;
  p.career.employerId = o.employerId;
  p.career.title = d.title ?? 'Special agent';
  const partner = o.agentIds[0];
  r.people.partnerId = partner;
  r.people.supervisorId = o.supervisorIds[0];
  meet(partner, `Special agent, ${d.short}`);
  meet(o.supervisorIds[0], 'Supervisory special agent');
  r.stats.agencies = [...new Set([...r.stats.agencies, o.id])];
  note(`Graduated as a ${d.short} special agent, assigned to ${o.name}.`, 'career', { key: `fedgrad:${key}`, milestone: `Became a ${d.short} special agent: ${o.name}.`, significance: 3 });
  return 'graduated';
}
/** Moves to the city of the assigned field office (the move is part of the job). */
export function reportToOffice() {
  const r = I();
  if (!r.pendingMove) return result(false, 'You are where you were assigned.', 'neutral');
  const block = moveBlock();
  if (block) return result(false, block, 'neutral');
  const city = r.pendingMove;
  const p = player();
  const job = { ...p.career };
  const res = relocate(city);
  if (!res.ok) return res;
  // The agency moved them: the post stays theirs whatever the move does to an ordinary job.
  if (p.career.careerId !== job.careerId) Object.assign(p.career, job);
  r.pendingMove = null;
  return result(true, `You moved to ${city} to take up the post.`);
}

// ---------- Private investigation ----------

export const piLicenseRule = (countryId) => PI_LICENSE[countryId] ?? PI_LICENSE.default;
/** Why the player cannot apply for a private investigator's license, or []. */
export function licenseUnmet(p = player()) {
  const rule = piLicenseRule(p.countryId);
  const out = [];
  if (p.age < rule.minAge) out.push(`Applicants must be ${rule.minAge}.`);
  const y = yearsIn(p, PI_EXPERIENCE);
  const need = Math.max(0, rule.experienceYears - (studied('pi', p).length ? 1 : 0));
  if (y < need && !university(p)) out.push(`Needs ${need} years of investigative or related work (you have ${y}), or a degree and supervised experience.`);
  if (record(p).length) out.push('A criminal record rules this out.');
  if (rec(p)?.license?.status === 'licensed' && rec(p).license.countryId === p.countryId) out.push('You hold a license here.');
  if (rec(p)?.apps.some((x) => x.kind === 'license' && x.status === 'pending')) out.push('Your application is being processed.');
  return out;
}
export function applyLicense() {
  const p = player();
  const r = I();
  const rule = piLicenseRule(p.countryId);
  { const sc = jobBlockSpecial('private_investigator', p); if (sc) return result(false, sc, 'neutral'); }
  const no = licenseUnmet(p);
  if (no.length) return result(false, no[0], 'neutral');
  const fee = Math.round(rule.fee * (COUNTRIES[p.countryId].currency?.scale ?? 1));
  if (p.finance.cash < fee) return result(false, 'You cannot cover the application fee.', 'neutral');
  if (!once('apply:license')) return result(false, 'One application a year.', 'neutral');
  p.finance.cash -= fee;
  const roll = seeded(`${me()}/license/${year()}`);
  const pass = skillAvg(['law', 'ethics', 'writing'], r) + p.stats.intellect / 4 + roll.int(-10, 10) >= 40;
  r.apps.push({ id: nextId('app'), kind: 'license', countryId: p.countryId, filed: now(), due: now() + 2, status: 'pending', outcome: pass ? 'licensed' : 'failed' });
  return result(true, `You applied for a ${rule.name}${rule.exam ? ' and sat the exam' : ''}. The board decides by ${dateWords(now() + 2)}.`, 'neutral');
}
function settleLicense(app) {
  const r = I();
  if (app.outcome !== 'licensed') return 'You did not pass the licensing exam this time. You can try again next year.';
  r.license = { status: 'licensed', countryId: app.countryId, since: year(), name: piLicenseRule(app.countryId).name };
  note(`Licensed as a private investigator.`, 'career', { key: `pilicense:${app.countryId}`, milestone: 'Licensed as a private investigator.' });
  return 'You are a licensed private investigator. A license gives no police powers: no warrants, no arrests beyond any citizen\'s, no access to police records.';
}
export const licensed = (p = player()) => rec(p)?.license?.status === 'licensed' && rec(p).license.countryId === p.countryId;

// ---------- Leaving ----------

/** The job ended (quit, let go, retired, or another job): the record stays, the powers go. */
export function jobEnded(p, r, why) {
  if (!r.job) return;
  const owner = r.job.agencyId ? agency(r.job.agencyId)?.name : office(r.job.officeId)?.name;
  note(`${why === 'retired' ? 'Retired from' : 'Left'} ${owner ?? 'investigative work'}.`, 'career', { key: `left:${r.job.agencyId ?? r.job.officeId}:${year()}`, milestone: why === 'retired' ? `Retired from ${owner ?? 'investigative work'}.` : null, log: false });
  const u = r.job.agencyId && agency(r.job.agencyId)?.units?.[r.job.specialty];
  if (u) u.memberIds = u.memberIds.filter((id) => id !== me());
  r.past = [...(r.past ?? []), { ...r.job, until: year(), why }];
  // Open cases do not leave with the investigator: each passes to a colleague, with the file as it is (serial.js).
  for (const id of r.caseIds) {
    const inv = store.state.justice?.investigations?.[id];
    const f = inv?.file;
    if (!f || f.outcome || f.leadId !== me()) continue;
    const next = (r.people.partnerId && npc(r.people.partnerId)?.alive ? r.people.partnerId : null) ?? (u?.memberIds ?? []).find((x) => x !== me() && npc(x)?.alive) ?? null;
    if (!next) continue;
    f.handoff = [...(f.handoff ?? []), { from: me(), to: next, at: now(), why }];
    f.leadId = next;
    inv.investigatorIds = [next, ...inv.investigatorIds.filter((x) => x !== next)];
    f.log.push({ at: now(), text: `${p.firstName} ${p.lastName} ${why === 'retired' ? 'retired' : 'left'}; the case passed to ${name(next)}, with everything in the file.` });
  }
  if (r.people.partnerId) r.people.formerPartnerIds.push(r.people.partnerId);
  r.people.partnerId = null;
  r.job = null;
  r.stage = why === 'retired' ? 'retired' : 'former';
  if (why === 'retired') r.retired = { year: year() };
}
