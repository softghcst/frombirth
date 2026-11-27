// The investigative careers engine (From Birth Detective & Federal Investigations). One yearly step,
// run after the working year (engine/yearProcessor.js 'investigations'), and dated steps that are
// settled whenever the calendar has passed their date (an academy's end, a laboratory report, a
// court date). Decided when they start and known when their date comes, so 3-, 6- and 12-month
// Age Ups give the same career on the same dates.
//
//   core.js       records, migration, skills, reputation, dates
//   agencies.js   police departments, sheriff's offices, state and national police, federal field offices, laboratories
//   careers.js    recruitment, academy, field training, probation, detective selection, promotions, federal hiring, licenses
//   casework.js   case files on the justice system's own investigations: clues, witnesses, laboratory, warrants, prosecutors, court
//   views.js      who may see what in a case (investigator, analyst, prosecutor, defense, judge, the public)
//   oversight.js  complaints and professional standards
//   private.js    private investigation, and agencies run on the business engine
//   drama.js      partners, mentors, rivals, task forces, and the stories between them
//   crossover.js  the same cases seen from other careers: forensic scientists and journalists
import { clamp } from '../../util.js';
import { rng } from '../../rng.js';
import { store, player, log } from '../../state.js';
import { CAREER_BY_ID } from '../../data/careers.js';
import { I, rec, W, year, now, me, seeded, reputationOf, grow, regard, migrateInvestigations, legacies } from './core.js';
import { J } from '../cases.js';
import { agencyOf, kindsIn } from './agencies.js';
import { settleApplications, settleAcademy, settleProbation, settlePromotions, jobEnded, licensed, studyCredit, autoPatrolYear } from './careers.js';
import { settleAll, assignCase, investigation, caseStatus, workLeft } from './casework.js';
import { settleComplaints, intake } from './oversight.js';
import { dramaYear, peopleYear, formTaskForce } from './drama.js';
import { benchYear, pressYear } from './crossover.js';
import { forensicYear, examinerNow, evaluatorNow } from './forensicMed.js';
import { promote } from '../career.js';
import { settleWorkplace, workplaceYear } from './workplace.js';
import { labYear, careerYear as labCareerYear } from './forensicLab.js';
import { unionYear } from './unions.js';
import { reformYear } from './reform.js';
import { psychYear, psychCareerYear } from './forensicPsych.js';
import { integrityYear } from './integrity.js';
import { booksYear } from './books.js';
import { hospitalYear } from './medical.js';
import { payYear } from './pay.js';
import { alliedYear, alliedCareerYear } from './allied.js';
import { considerYear } from './autoPromotion.js';
import { settleAncestor } from './family.js';
import { seriesYear, inheritYear } from './serial.js';
import { wellbeingYear } from './wellbeing.js';
import { mediaYear } from './truecrime.js';
import { endUndercover } from './undercover.js';

export * from './core.js';
/** Careers this engine runs (the career engine pays them, but does not review them). */
export const INVESTIGATIVE = ['police', 'detective', 'fbi_agent', 'dea_agent', 'atf_agent', 'usms_deputy', 'usss_agent', 'hsi_agent', 'irs_agent'];

/** Whether this engine reviews the player's job this year. */
export function investigationRuns(careerId, p = player()) {
  return INVESTIGATIVE.includes(careerId) && !!rec(p)?.job;
}

/** Why a job-board application is not how this work is got, or ''. */
export function investigationBlock(careerId, p = player()) {
  if (!INVESTIGATIVE.includes(careerId)) return '';
  if (careerId === 'detective') return 'Detectives are selected from serving officers: see Law Enforcement on the Work tab.';
  if (careerId === 'police') return 'Police agencies recruit through their own process (assessments, an academy, probation): see Law Enforcement on the Work tab.';
  return 'Federal agencies hire through their own application, background investigation and academy: see Law Enforcement on the Work tab.';
}

/** Whether My Investigations has anything to show. */
export const investigationsOpen = (p = player()) => !!rec(p) || examinerNow(p) || evaluatorNow(p) || p.age >= 16 || (store.state.investigations?.legacies?.length ?? 0) > 0 || INVESTIGATIVE.includes(p.career?.careerId) || ['pi', 'forensics', 'journalist'].includes(p.career?.careerId);

/** Everything with a date that has passed. Safe to call any time: each step happens once. */
export function settle(p = player()) {
  const r = rec(p);
  if (!r) return [];
  const out = [...settleApplications(p)];
  const ac = settleAcademy(p);
  if (ac === 'graduated') out.push('You graduated.');
  settleProbation(p);
  out.push(...settlePromotions(p), ...settleAll(p), ...settleComplaints(), ...settleWorkplace(p));
  for (const id of r.caseIds) { const line = settleAncestor(investigation(id), p); if (line) out.push(line); }
  { const line = endUndercover(); if (line) out.push(line); }
  return out;
}

/** The yearly step. */
export function tickInvestigations() {
  const p = player();
  if (!p.alive) return;
  if (!rec(p) && INVESTIGATIVE.includes(p.career.careerId)) migrateInvestigations(store.state);
  // A forensic scientist's laboratory year: requests from real cases, the backlog, promotion (forensicLab.js).
  if (p.career?.careerId === 'forensics') { for (const line of [...labYear(p), ...labCareerYear(p)]) log(line, 'system', 'neutral'); } else benchYear(p);
  forensicYear(p); // a forensic pathologist or psychiatrist gets real referrals (forensicMed.js)
  pressYear(p); // a journalist has cases in court to cover (crossover.js)
  for (const line of [...psychYear(p), ...psychCareerYear(p)]) log(line, 'system', 'neutral'); // a forensic psychologist's work (forensicPsych.js)
  // Other careers that meet the same cases: conviction review, accountants and auditors, hospitals, the editor's desk.
  for (const line of [...integrityYear(p), ...booksYear(p), ...hospitalYear(p), ...alliedYear(p), ...alliedCareerYear(p), ...mediaYear(p)]) log(line, 'system', 'neutral');
  const r = rec(p);
  if (!r) return;
  // The job ended outside this engine (quit, let go, retired, another job): the record stays, the powers go.
  if (r.job && !(r.job.corporate && p.career.careerId === 'pi' && p.career.employerId === r.job.employerId) && !INVESTIGATIVE.includes(p.career.careerId) && r.academy?.status !== 'enrolled') jobEnded(p, r, p.career.retired ? 'retired' : 'left');
  // What the year decided (an application, a promotion, a complaint) waits to be read in My Investigations.
  { const lines = settle(p); if (lines.length) r.unread = [...(r.unread ?? []), ...lines].slice(-12); }
  if (r.job && r.job.legacy && !r.job.agencyId && r.family === 'police') {
    // A legacy officer's department gets its agency record now (the employer stays what it was).
    const a = agencyOf(kindsIn(p.countryId)[0], p.countryId, p.city);
    r.job.agencyId = a.id;
    if (r.job.detective) { const u = a.units[r.job.specialty] ?? a.units.general ?? Object.values(a.units)[0]; r.job.specialty = u.specialty; if (!u.memberIds.includes(me())) u.memberIds.push(me()); r.people.supervisorId ??= u.headId; }
  }
  studyCredit(p, r); // a degree finished while serving (part-time) counts from now on
  autoPatrolYear(r); // routine patrol work, for a player who asked for it to be done for them
  if (r.job && !['academy', 'federal_training'].includes(r.stage)) {
    r.stats.years += 1;
    // A year on the job: the skills its work uses grow a little. Performance follows how the work is done.
    const use = r.job.detective || r.family === 'federal' ? ['reasoning', 'evidence', 'interviewing', 'management'] : ['observation', 'writing', 'interviewing', 'teamwork'];
    for (const s of use) grow(s, 1);
    if (['sergeant', 'lieutenant', 'captain', 'deputy_chief', 'chief', 'detective_sergeant', 'detective_lieutenant', 'supervisory', 'asac', 'sac'].includes(r.job.rank)) grow('leadership', 2);
    // Experience teaches leading too: a seasoned officer or detective is the one newer colleagues ask (promotion to sergeant needs it).
    if (r.stats.years >= 5) grow('leadership', 1);
    p.career.performance = clamp(Math.round(p.career.performance * 0.5 + reputationOf(r) * 0.5 + rng.int(-3, 3)));
    autoProgress(p, r);
    considerYear(p, r); // considered for the next rank, a step raise, or a warning (autoPromotion.js)
    // New cases, for those who investigate: one a year, two for the experienced, never past a caseload of three.
    if (r.job.detective || (r.family === 'federal' && r.job.rank !== 'trainee')) {
      const n = r.stats.years >= 5 ? 2 : 1;
      for (let i = 0; i < n; i++) assignCase(p);
      for (const line of [...inheritYear(p), ...seriesYear(p)]) log(line, 'system', 'neutral'); // serial.js
    }
    taskForces(p, r);
    intake(p);
  }
  // A licensed assistant investigator takes the full title (the 'pi' track's second rung).
  if (p.career.careerId === 'pi' && p.career.level === 0 && licensed(p)) { promote(); p.career.title = 'Private investigator'; }
  for (const line of workplaceYear(p)) log(line, 'system', 'good');
  for (const line of unionYear(p)) log(line, 'system', 'neutral');
  for (const line of reformYear(p)) log(line, 'system', 'neutral');
  for (const line of payYear(p)) log(line, 'system', 'good');
  for (const line of wellbeingYear(p)) log(line, 'system', 'bad');
  { const line = endUndercover(); if (line) log(line, 'system', 'neutral'); }
  peopleYear(p);
  dramaYear(p);
}

/**
 * Cases nobody touched last year are not frozen: the partner (or the unit) does the ordinary work,
 * one step a year, the easy documented things. The player's judgment calls are left for the player.
 */
function autoProgress(p, r) {
  for (const id of r.caseIds) {
    const inv = investigation(id);
    const f = inv?.file;
    if (!f || f.outcome || !['active', 'suspect'].includes(inv.stage)) continue;
    if ((f.work[year() - 1] ?? 0) > 0) continue;
    // Three years with nobody working it: the sergeant sets it aside (inactive, still open), and the caseload has room again.
    const idle = [1, 2, 3].every((n) => !(f.work[year() - n] > 0)) && now() - f.opened >= 36 && !f.courtCaseId && !f.review;
    if (idle) {
      inv.stage = 'suspended';
      f.inactive = now();
      f.log.push({ at: now(), text: 'Three years without work on it: the sergeant set it aside. It stays open, and can be taken up again.' });
      log(`${f.title} has had no work for three years; your sergeant set it aside, and you will get new cases.`, 'system', 'neutral');
      continue;
    }
    const step = ['scene', 'specialist', 'examiner', 'urgency', 'search'].find((s) => !f.done[s] && f.clues.some((c) => c.via === s));
    if (!step) continue;
    f.done[step] = now();
    for (const c of f.clues.filter((x) => x.via === step && !x.found)) { c.found = true; c.at = now(); }
    f.log.push({ at: now(), text: `${f.partnerId ? store.state.npcs[f.partnerId]?.firstName ?? 'Your partner' : 'The unit'} did the routine work on the file: ${step === 'scene' ? 'the scene documentation' : step}.` });
  }
}

/** In the US, a local robbery or fraud case may turn out to be part of a wider pattern: a federal agency joins it, once. */
function taskForces(p, r) {
  if (p.countryId !== 'us' || r.family !== 'police' || !r.job?.detective) return;
  for (const id of r.caseIds) {
    const inv = investigation(id);
    const f = inv?.file;
    if (!f || f.taskForceId || f.outcome || !['robbery', 'fraud', 'cyber'].includes(f.template)) continue;
    if (!seeded(`${inv.id}/tf`).chance(0.3)) continue;
    const res = formTaskForce(inv.id, f.template === 'robbery' ? 'fbi' : 'fbi');
    if (res.ok) { log(res.text, 'system', 'neutral'); const lastTf = Math.max(0, ...Object.entries(r.scenes).filter(([key2]) => key2.startsWith('tf:')).map(([, y]) => y));
      if (!r.scenes[`tf:${inv.id}`] && year() - lastTf >= 4) { r.scenes[`tf:${inv.id}`] = year(); store.state.pendingEvents.push({ id: 'inv_task_force', cast: { words: { case: f.title } } }); } }
    break;
  }
}

/**
 * The public side of an investigative career, for the Family Archive: academies, agencies, units, ranks,
 * honors, retirement, and cases only as far as a court made them public. Never a case file.
 */
export function legacySummary(p) {
  const r = p?.investigator;
  if (!r || (!r.job && !r.past?.length && !r.academy && !r.license)) return null;
  return {
    name: `${p.firstName} ${p.lastName}`,
    family: r.family,
    // The milestones of a career, not its paperwork: each referral is in the court-case list already; repeats are kept once.
    history: r.history.filter((h) => h.kind === 'career' && !/^Referred a case to the prosecutor/.test(h.text))
      .filter((h, i, all) => all.findIndex((x) => x.text === h.text) === i).map((h) => ({ year: h.year, text: h.text })),
    years: r.stats.years, units: r.stats.units, license: r.license ? r.license.name : null,
    retired: r.retired?.year ?? null,
    stats: r.stats.unknownBefore ? { note: 'Casework from before records were kept is not known.' } : { assigned: r.stats.assigned, completed: r.stats.completed, court: r.stats.court, reopened: r.stats.reopened },
  };
}
export { workLeft, caseStatus };

/**
 * Every investigative career in the family, for the Family Archive: the public career of each ancestor and of the
 * player, and the cases they led that went to court (a court record is public; case files and statements are not).
 */
export function familyInvestigativeLegacy(p = player()) {
  const OUT = { sentenced: 'convicted', acquitted: 'acquitted', dismissed: 'dismissed', quashed: 'conviction set aside' };
  const courtCases = (id) => Object.values(J().investigations ?? {}).filter((inv) => inv.file?.leadId === id && inv.file.courtCaseId && J().cases[inv.file.courtCaseId])
    .map((inv) => { const c = J().cases[inv.file.courtCaseId]; return { title: inv.file.title, year: c.year, outcome: OUT[c.stage] ?? 'in court' }; })
    .sort((a, b) => a.year - b.year);
  const list = legacies().map((x) => ({ id: x.id, name: x.name, died: x.died ?? null, years: x.years ?? null, units: x.units ?? [], license: x.license ?? null, retired: x.retired ?? null,
    history: x.history ?? [], cases: courtCases(x.id) }));
  const mine = legacySummary(p);
  if (mine) list.push({ id: p.id, name: mine.name, you: true, years: mine.years, units: mine.units ?? [], license: mine.license, retired: mine.retired, history: mine.history, cases: courtCases(p.id) });
  return list;
}
