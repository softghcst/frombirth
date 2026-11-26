// Two paths in law that are not practice: a judicial clerkship straight after law school (a year working for a judge,
// researching and drafting; it opens doors), and the academy (a law professor: teaching, writing, and the tenure vote).
//
//   L.clerkship = { judgeId, from, until, done }     L.formerClerk = true once it is done
//   L.professor = { since, articles, teaching, tenure: null | 'granted' | 'denied', leaveBy }
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, log } from '../state.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { lawOf, nowM, admitted, gain, canon, keepPerson, lawGpa } from './lawSchool.js';
import { hire, promote, addPromotionGate, quitCareer } from './career.js';
import * as k from './cases.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const gpaOf = (p) => lawGpa(p) ?? p.education.degrees.find((d) => d.type === 'law')?.gpa ?? 3;
const yearsIn = (p) => Object.entries(p.career?.experience ?? {}).filter(([id]) => ['lawyer', 'prosecutor', 'defender', 'gov_counsel', 'judiciary', 'attorney_general', 'us_attorney', 'solicitor_general', 'academic'].includes(id)).reduce((s, [, y]) => s + y, 0);

// ---------- The clerkship ----------

export const clerking = (p = player()) => { const c = p.law?.clerkship; return !!c && !c.done; };
/** Why a clerkship is not open now, or '' when it is: right after admission, for strong students, once. */
export function clerkshipWhy(p = player()) {
  const L = lawOf(p);
  if (!admitted(p)) return 'After admission to the bar';
  if (L.clerkship) return L.clerkship.done ? 'You have clerked already' : 'You are clerking now';
  if (yearsIn(p) > 3) return 'Clerkships go to new graduates';
  if (gpaOf(p) < 3.3) return 'Judges choose clerks from the top of the class';
  if (L.tried?.clerk != null && nowM() - L.tried.clerk < 12) return 'Applications open again next year';
  return '';
}
/** Applies to clerk for a judge. Strong grades help most. A year as a law clerk, then back to the market, with a name. */
export function applyClerkship(p = player()) {
  const why = clerkshipWhy(p);
  if (why) return result(false, why, 'neutral');
  const L = lawOf(p);
  (L.tried ??= {}).clerk = nowM();
  const chance = clamp(0.25 + (gpaOf(p) - 3.3) * 1.1 + L.rep.recognition / 200, 0.1, 0.85);
  if (!rng.chance(chance)) return result(false, 'The judges you applied to chose other clerks this year.', 'bad');
  const judge = k.pick(k.bench(p.countryId).judges);
  hire(CAREER_BY_ID.gov_counsel, 0, 70, 'clerkship');
  p.career.title = 'Judicial law clerk';
  L.clerkship = { judgeId: judge.id, from: nowM(), until: nowM() + 12, done: false };
  const n = store.state.npcs[judge.id];
  if (n) { n.meters ??= {}; n.meters.relationship = 60; if (!p.npcIds.includes(n.id)) p.npcIds.push(n.id); n.flags.title = `Judge (you clerked for them)`; }
  canon(`law:clerkship:${p.id}`, 'Judicial clerkship', `Clerked for Judge ${n?.lastName ?? ''}.`, { privacy: 'public', sig: 2 });
  return result(true, `Judge ${n?.lastName ?? ''} chose you as a law clerk for the year: research, draft opinions, and see how a court decides.`, 'good');
}

// ---------- The academy ----------

const PROF_TITLES = ['Visiting assistant professor of law', 'Assistant professor of law', 'Professor of law (tenured)', 'Professor of law (tenured)'];
export const professing = (p = player()) => !!p.law?.professor && p.career?.careerId === 'academic';
export function professorWhy(p = player()) {
  const L = lawOf(p);
  if (!admitted(p)) return 'After admission to the bar';
  if (professing(p)) return 'You teach law now';
  if (yearsIn(p) < 3 && !L.formerClerk) return 'After three years in law, or a clerkship';
  if (gpaOf(p) < 3.5 && !L.formerClerk && L.rep.recognition < 45) return 'Law faculties hire from the top of the class, former clerks, or well-known names';
  if (L.tried?.professor != null && nowM() - L.tried.professor < 24) return 'The faculty hires again in two years';
  return '';
}
/** Applies to a law faculty. A vote of the faculty, after a job talk. */
export function applyProfessor(p = player()) {
  const why = professorWhy(p);
  if (why) return result(false, why, 'neutral');
  const L = lawOf(p);
  (L.tried ??= {}).professor = nowM();
  const chance = clamp(0.2 + (gpaOf(p) - 3.3) * 0.6 + (L.formerClerk ? 0.2 : 0) + L.rep.recognition / 250 + (L.skills.research - 50) / 200, 0.08, 0.8);
  if (!rng.chance(chance)) return result(false, 'You gave the job talk. The faculty voted for another candidate.', 'bad');
  hire(CAREER_BY_ID.academic, 1, 65, 'faculty vote');
  p.career.title = PROF_TITLES[1];
  L.professor = { since: store.state.year, articles: 0, teaching: 50, tenure: null };
  canon(`law:professor:${p.id}`, 'Joined a law faculty', `Appointed ${PROF_TITLES[1].toLowerCase()}.`, { privacy: 'public', sig: 2 });
  return result(true, 'The faculty voted you in. You will teach the next generation of lawyers, and write.', 'good');
}
/** A professor's half-year: a class, some writing, the students. Each once. */
export function professorDuties(p = player()) {
  if (!professing(p)) return [];
  const L = lawOf(p);
  const w = Math.floor(nowM() / 6);
  const done = (id) => !!L.profDuties?.[`${w}:${id}`];
  return [
    { id: 'teach', name: 'Teach your class', text: 'Eighty first-year students, and a case none of them has read closely.', options: [['Call on them, kindly, and make them reason it out', 'socratic'], ['Lecture from your notes', 'lecture'], ['Go easy, for good evaluations', 'easy']] },
    { id: 'write', name: 'Write', text: 'There is a question in your field nobody has answered well.', options: [['A careful article, with every source checked', 'article'], ['A provocative op-ed', 'oped'], ['Not this term', 'skip']] },
    { id: 'mentor', name: 'Your students', text: 'Three students want recommendations, and one is struggling.', options: [['Write honest letters, and meet the one who is struggling', 'mentor'], ['Write the letters; no time for more', 'letters']] },
  ].map((d) => ({ ...d, done: done(d.id) }));
}
export function professorDuty(id, choice, p = player()) {
  const d = professorDuties(p).find((x) => x.id === id);
  if (!d || d.done) return result(false, d ? 'Done this term.' : 'Not yours to do.', 'neutral');
  const L = lawOf(p);
  const P = L.professor;
  (L.profDuties ??= {})[`${Math.floor(nowM() / 6)}:${id}`] = choice;
  if (id === 'teach') {
    P.teaching = clamp(P.teaching + { socratic: 6, lecture: 2, easy: -1 }[choice]);
    gain(p, { oral: 1 });
    return result(true, { socratic: 'By the end of the hour, half the room has changed its mind once. Good.', lecture: 'They took good notes.', easy: 'The evaluations will be warm. The students learned less than they could have.' }[choice], choice === 'easy' ? 'neutral' : 'good');
  }
  if (id === 'write') {
    if (choice === 'article') { P.articles += 1; gain(p, { research: 3, writing: 2 }); L.rep.recognition = clamp(L.rep.recognition + 2); return result(true, 'The article is accepted by a law review.', 'good'); }
    if (choice === 'oped') { L.rep.recognition = clamp(L.rep.recognition + 3); return result(true, 'The op-ed is widely shared. Your colleagues ask when the real article is coming.', 'neutral'); }
    return result(true, 'Not this term.', 'neutral');
  }
  P.teaching = clamp(P.teaching + (choice === 'mentor' ? 3 : 1));
  if (choice === 'mentor') { const s = keepPerson(p, 'student', 'colleague', 'Your law student', rng.int(22, 28)); s.meters.relationship = clamp(s.meters.relationship + 10); }
  return result(true, choice === 'mentor' ? 'The struggling student makes it through the term. They will remember who helped.' : 'The letters go out.', 'good');
}

// ---------- Time ----------

/** Each turn: the clerkship ends after its year; a professor's tenure vote comes in their sixth year. */
export function tickAcademy(p = player()) {
  const L = p.law;
  if (!L) return;
  const c = L.clerkship;
  if (c && !c.done && nowM() >= c.until) {
    c.done = true;
    L.formerClerk = true;
    gain(p, { research: 8, writing: 4, oral: 2 });
    L.rep.recognition = clamp(L.rep.recognition + 6);
    if (p.career?.title === 'Judicial law clerk') quitCareer();
    log('Your clerkship has ended. You learned how judges decide, and firms, offices and faculties take note of former clerks.', 'system', 'good');
  }
  const P = L.professor;
  if (P && professing(p) && !P.tenure && store.state.year - P.since >= 6) {
    const chance = clamp(0.15 + P.articles * 0.12 + (P.teaching - 50) / 100, 0.05, 0.92);
    if (rng.chance(chance)) {
      P.tenure = 'granted';
      L.tenured = true;
      promote();
      p.career.title = PROF_TITLES[2];
      canon(`law:tenure:${p.id}`, 'Granted tenure', `The faculty voted to grant tenure after ${store.state.year - P.since} years.`, { privacy: 'public', sig: 3 });
      log('The faculty voted to grant you tenure.', 'system', 'good');
    } else {
      P.tenure = 'denied'; P.leaveBy = store.state.year + 1;
      log('The faculty voted against tenure. You have a year to find your next position.', 'system', 'bad');
    }
  }
  if (P?.tenure === 'denied' && professing(p) && store.state.year >= P.leaveBy) { quitCareer(); P.left = store.state.year; log('Your last year at the law school is over.', 'system', 'neutral'); }
  if (professing(p) && p.career.title && !/law/.test(p.career.title)) p.career.title = PROF_TITLES[Math.min(p.career.level, 3)];
}

// Above an assistant professor, only the tenure vote: the career engine never promotes a law professor on its own.
addPromotionGate((careerId, at) => (careerId === 'academic' && player().law?.professor && at >= 2 && !player().law.tenured ? ['the faculty\'s tenure vote'] : []));
