// Schools and clubs for bright, techy and argumentative kids: a STEM magnet school, a school for gifted children, a law
// and public service academy; robotics, engineering, science olympiad, mock trial, Model UN. They teach real skills
// (coding, robotics, math, science, public speaking), and those skills count toward degrees and work in tech,
// engineering and law. Run with: node tests/gifted-schools.mjs
import { store } from '../js/state.js';
import { createLife } from '../js/engine/characterGen.js';
import { KIND_BY_ID } from '../js/data/education.js';
import { CLUB_BY_ID } from '../js/data/schools.js';
import { barred, scholarshipFor } from '../js/engine/schooling.js';
import { applyMods } from '../js/engine/genetics.js';
import { majorEdge, workEdge } from '../js/engine/aptitudes.js';
import { CAREER_BY_ID } from '../js/data/careers.js';

const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); };
const life = () => { for (;;) { store.state = createLife({ countryId: 'us' }); if (!store.state.player.royal) return store.state.player; } };

const p = life();
p.age = 13; p.birthYear = store.state.year - 13;
p.flags.wealth = 'middle';

// The schools exist, and say what they are.
for (const id of ['stem', 'gifted', 'law']) check(KIND_BY_ID[id]?.blurb && KIND_BY_ID[id].needs?.entry?.test, `${id}: a school with an entrance test`);

// A child who codes gets into the STEM school even without top marks; one who does neither does not.
p.stats.intellect = 45; p.skills = { coding: 70 };
check(barred(KIND_BY_ID.stem, 'middle', p) === '', `coding gets you into the STEM school (${barred(KIND_BY_ID.stem, 'middle', p)})`);
p.skills = {};
check(/entrance test/.test(barred(KIND_BY_ID.stem, 'middle', p)), `without it, the entrance test is failed (${barred(KIND_BY_ID.stem, 'middle', p)})`);

// The gifted school is for the very brightest; the brightest go free.
p.stats.intellect = 70;
check(/assessment/.test(barred(KIND_BY_ID.gifted, 'middle', p)), 'the gifted school turns down a bright but not gifted child');
p.stats.intellect = 92;
check(scholarshipFor(KIND_BY_ID.gifted, p)?.off === 1, 'a gifted child goes free');
check(barred(KIND_BY_ID.gifted, 'elementary', p) === '' || /fees/.test(barred(KIND_BY_ID.gifted, 'elementary', p)), 'gifted children can start young');

// A family that cannot pay is helped: the gifted school costs them nothing.
{
  const fam = await import('../js/engine/schooling.js');
  const { feeFor } = fam;
  check(KIND_BY_ID.gifted.aid === 'need' && typeof feeFor(KIND_BY_ID.gifted, p) === 'number', 'the gifted school has aid by need');
}

// A good talker gets into the law academy.
p.stats.intellect = 40; p.skills = { public_speaking: 60 };
check(barred(KIND_BY_ID.law, 'middle', p) === '', 'public speaking gets you into the law academy');

// A year at each teaches the skills it is for.
p.skills = {};
applyMods(p, KIND_BY_ID.stem.yearly);
check(p.skills.coding >= 3 && p.skills.robotics >= 2 && p.skills.math >= 2, `a year at the STEM school teaches coding and robotics (${JSON.stringify(p.skills)})`);
applyMods(p, KIND_BY_ID.law.yearly);
check(p.skills.public_speaking >= 3, 'a year at the law academy teaches public speaking');

// The clubs teach their skills too.
p.skills = {};
for (const id of ['robotics', 'coding', 'mock_trial', 'science_olympiad', 'math_club', 'engineering', 'model_un', 'debate', 'chess']) {
  check(!!CLUB_BY_ID[id], `there is a ${id} club`);
  const before = JSON.stringify(p.skills);
  applyMods(p, CLUB_BY_ID[id].yearly);
  check(JSON.stringify(p.skills) !== before, `the ${id} club teaches a skill`);
}
check(p.skills.robotics >= 5 && p.skills.coding >= 5 && p.skills.public_speaking >= 4, 'robotics, coding and public speaking grow');
p.skills.coding = 99; applyMods(p, CLUB_BY_ID.coding.yearly);
check(p.skills.coding === 100, 'skills stop at 100');

// And the skills count: toward computer science and engineering degrees, and work as an engineer or a lawyer.
const bare = { skills: {}, talents: {}, stats: {} };
const built = { skills: { coding: 70, robotics: 70, math: 70, public_speaking: 70, writing: 60 }, talents: {}, stats: {} };
check(majorEdge('computer_science', built) > majorEdge('computer_science', bare) && majorEdge('engineering', built) > 0.3, 'coding and robotics help with computer science and engineering');
check(majorEdge('political_science', built) > 0.3 && majorEdge('criminal_justice', built) > 0.3, 'public speaking helps on the way to law school');
check(workEdge(CAREER_BY_ID.lawyer, built) > 0.3 && workEdge(CAREER_BY_ID.engineer, built) > 0.3, 'and in getting work as a lawyer or an engineer');

// Clubs are joined at school only (School › Activities): not by someone out of school.
{
  const { canJoinClubs } = await import('../js/engine/education.js');
  const { titleCase } = await import('../js/ui/titles.js');
  const q = life();
  q.age = 15; q.birthYear = store.state.year - 15;
  q.education.enrolled = false;
  check(!canJoinClubs(), 'someone out of school cannot join school clubs');
  check(titleCase('STEM magnet school') === 'STEM Magnet School' && titleCase('School for gifted children') === 'School for Gifted Children' && titleCase('Law and public service academy') === 'Law and Public Service Academy', 'school names read in Title Case');
}

// Skipping a grade, and starting college early.
{
  const edu = await import('../js/engine/education.js');
  const q = life();
  q.age = 9; q.birthYear = store.state.year - 9;
  q.education.enrolled = true; q.education.stage = 'elementary'; q.education.gpa = 3.9; q.stats.intellect = 70;
  check(/far ahead/.test(edu.skipBlock(q)), 'an ordinary child cannot skip a grade');
  q.stats.intellect = 95;
  let r = { ok: false };
  for (let i = 0; i < 20 && !r.ok; i++) { q.flags.skipAskedAge = null; r = edu.skipGrade(); }
  check(r.ok && q.education.ahead === 1, `a gifted child can skip a grade (${r.text})`);
  check(q.career.stress > 30, 'being the youngest in class is its own pressure');
  for (let i = 0; i < 20; i++) { q.flags.skipAskedAge = null; edu.skipGrade(); }
  check(q.education.ahead === edu.MAX_AHEAD, `two grades ahead at most (${q.education.ahead})`);
  // Ahead in the stages: a child two years ahead starts middle school two years early.
  q.age = 9; q.education.stage = 'elementary';
  edu.tickEducation();
  check(q.education.stage === 'middle', `two grades ahead, middle school comes at ${q.age} (${q.education.stage})`);

  const t = life();
  t.age = 15; t.birthYear = store.state.year - 15;
  t.education.enrolled = true; t.education.stage = 'high'; t.education.gpa = 3.9; t.stats.intellect = 70;
  check(/top marks/.test(edu.earlyCollegeBlock(t)), 'an ordinary student cannot leave for college early');
  t.stats.intellect = 92;
  const c = edu.startCollegeEarly();
  check(c.ok && t.education.degrees.some((d) => d.type === 'high') && !t.education.enrolled, `a gifted 15-year-old finishes school early (${c.text})`);
}

// Summer programs: camps teach; competitions are placed in, and wins count on applications. A coach's letter counts too.
{
  const summer = await import('../js/engine/summer.js');
  const uni = await import('../js/engine/university.js');
  const k = life();
  k.age = 14; k.birthYear = store.state.year - 14; k.education.enrolled = true; k.education.stage = 'high'; k.education.clubs = [];
  k.skills = {};
  // A family that can pay for a camp (this checks what the camp teaches, not what a family can afford).
  for (const n of Object.values(store.state.npcs)) if (n.alive && n.role === 'parent' && k.npcIds.includes(n.id)) { n.wealth = 60; n.meters.money = 60; }
  const opts = summer.summerOptions(k);
  check(opts.some((o) => o.id === 'coding_camp') && opts.find((o) => o.id === 'robotics_comp')?.why, 'camps are open; the robotics competition needs the team');
  summer.goToSummer('coding_camp', k);
  check(k.skills.coding >= 6, 'coding camp teaches coding');
  check(/summer/.test(summer.goToSummer('math_olympiad', k).text), 'one summer a year');
  // A gifted mathematician places, and climbs the levels.
  k.stats.intellect = 99; k.skills.math = 99;
  const before = uni.profile('mathematics').activities;
  for (let i = 0; i < 4; i++) { k.age += 1; summer.goToSummer('math_olympiad', k); }
  const a = summer.awardsOf(k);
  check(a.count >= 2 && a.firsts >= 1, `wins and places are kept (${a.list.map((x) => x.name).join('; ')})`);
  check(a.list.some((x) => /State|National/.test(x.name)), 'and the level climbs from city to state to national');
  check(uni.profile('mathematics').activities > before, 'awards count on a college application');
  // A recommendation: from someone who knows you well.
  const coach = { firstName: 'Ana', lastName: 'Ruiz', alive: true, meters: { relationship: 40 }, flags: { tag: 'coach', title: 'Robotics coach' } };
  check(!summer.askForRecommendation([coach], k).ok && !coach.flags.wouldRecommend, 'a coach who barely knows you will not write one');
  k.age += 1; coach.meters.relationship = 80;
  check(summer.askForRecommendation([coach], k).ok && coach.flags.wouldRecommend, 'one who does will');
}

// Out of school: a child who is not at one joins a youth mock trial program (Pursuits) and can enter a debate tournament.
{
  const clubLife = await import('../js/engine/clubs.js');
  const { summerOptions } = await import('../js/engine/summer.js');
  const k = life();
  k.age = 13; k.birthYear = store.state.year - 13; k.skills = { ...(k.skills ?? {}), public_speaking: 5 };
  k.education.stage = 'none'; k.education.enrolled = false; k.education.clubs = [];
  const dt = () => summerOptions(k).find((o) => o.id === 'debate_tournament');
  check(/join the club/.test(dt()?.why ?? ''), 'a debate tournament needs a team');
  const r = clubLife.join('youth_mock_trial');
  check(r.ok, `a 13-year-old joins youth mock trial (${r.text})`);
  check(!dt()?.why, `and can then enter the debate tournament (${dt()?.why})`);
}

if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('Bright, techy and argumentative kids have schools and clubs of their own, and they count.');
