// Beyond practice: a judicial clerkship after law school, and a law faculty with teaching, writing and a tenure vote.
// Run with: node tests/law-academy.mjs
import { store, rng, ls, lp, check, finish, lawyer, turn } from './helpers/lawSetup.mjs';
const acad = await import('../js/engine/lawAcademy.js');
rng.seed(101);
const p = () => store.state.player;
const L = () => ls.lawOf(p());

// A clerkship: strong grades, once, a year with a judge.
lawyer('lawyer');
p().education.degrees.find((d) => d.type === 'law').gpa = 3.2;
check(/top of the class/.test(acad.clerkshipWhy()), 'judges choose clerks from the top of the class');
let ok = false;
for (let i = 0; i < 12 && !ok; i++) { lawyer('lawyer'); p().education.degrees.find((d) => d.type === 'law').gpa = 3.8; ok = acad.applyClerkship().ok; }
check(ok && acad.clerking() && p().career.title === 'Judicial law clerk', 'a strong graduate is chosen to clerk for a judge');
const offers0 = (L().offers ?? []).length;
store.state.settings = { ...(store.state.settings ?? {}), step: 6 };
turn();
check(L().caseIds.length === 0 && (L().offers ?? []).length === offers0, 'a law clerk works for the judge, not on cases of their own');
const research = L().skills.research;
turn(); turn();
check(L().formerClerk && !acad.clerking() && L().skills.research > research, 'after a year, a former clerk, with the research to show for it');
check(/clerked already/.test(acad.clerkshipWhy()), 'once only');

// The academy: a faculty vote, a term's duties, and tenure in the sixth year.
let hired = false;
for (let i = 0; i < 20 && !hired; i++) { lawyer('lawyer'); L().formerClerk = true; p().education.degrees.find((d) => d.type === 'law').gpa = 3.8; hired = acad.applyProfessor().ok; }
check(hired && p().career.careerId === 'academic' && /assistant professor of law/i.test(p().career.title), `the faculty votes a new professor in (${p().career.title})`);
const duties = acad.professorDuties().map((d) => d.id);
check(['teach', 'write', 'mentor'].every((x) => duties.includes(x)), 'a term: teaching, writing, students');
check(acad.professorDuty('write', 'article').ok && L().professor.articles === 1 && !acad.professorDuty('write', 'article').ok, 'an article, once a term');
// Tenure: a good record usually wins it; it is a vote, not a promotion by time.
const vote = (articles, teaching) => {
  let granted = 0;
  for (let i = 0; i < 20; i++) {
    lawyer('lawyer'); L().formerClerk = true; p().education.degrees.find((d) => d.type === 'law').gpa = 3.9;
    let h = false; for (let j = 0; j < 20 && !h; j++) { L().tried = {}; h = acad.applyProfessor().ok; }
    L().professor.articles = articles; L().professor.teaching = teaching; L().professor.since = store.state.year - 6;
    acad.tickAcademy();
    if (L().professor.tenure === 'granted') granted++;
  }
  return granted;
};
const strong = vote(6, 75); const weak = vote(0, 40);
check(strong > weak && strong >= 14, `tenure follows the record (${strong} of 20 with six articles and good teaching, ${weak} with none)`);
lawyer('lawyer'); L().formerClerk = true; p().education.degrees.find((d) => d.type === 'law').gpa = 3.9;
for (let j = 0; j < 20 && !acad.professing(); j++) { L().tried = {}; acad.applyProfessor(); }
L().professor.articles = 8; L().professor.teaching = 90; L().professor.since = store.state.year - 6;
for (let i = 0; i < 6 && L().professor.tenure !== 'granted'; i++) { L().professor.tenure = null; acad.tickAcademy(); }
check(L().tenured && /tenured/.test(p().career.title), `tenure: ${p().career.title}`);
check(lp.standing && typeof lp.standing(p()) === 'number', 'standing still computes');
finish('Clerks and professors have their own paths.');
