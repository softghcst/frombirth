// Stress is real, and the more you take on, the more of it you carry: school, homework, clubs, lessons, martial arts,
// training and jobs all count toward the week, for children and students as for adults. Stress hurts health, mood and
// marks; a young person stretched too far is asked what gives. Children's paid work is held to what the law allows.
// Run with: node tests/stress.mjs
import { store } from '../js/state.js';
import { createLife } from '../js/engine/characterGen.js';
import { weeklyLoad, tickWorkLife, canFit, unload, CHILD_ODD_JOBS, MINOR_WEEK, workLaw } from '../js/engine/worklife.js';
import * as pt from '../js/engine/partTime.js';
import * as fl from '../js/engine/freelance.js';
import { studyBarrier } from '../js/engine/health/access.js';

const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); };
const life = () => { for (;;) { store.state = createLife({ countryId: 'us' }); if (!store.state.player.royal) return store.state.player; } };
const teen = (age = 15) => {
  const p = life();
  p.age = age; p.birthYear = store.state.year - age;
  p.education.enrolled = true; p.education.stage = age < 14 ? 'middle' : 'high'; p.education.clubs = []; p.education.effort = 50;
  return p;
};

// Everything counts toward the week.
{
  const p = teen();
  const base = weeklyLoad(p).total;
  p.education.clubs = ['robotics', 'debate', 'chess'];
  p.flags.lessons = { taken: {}, year: { age: p.age, ids: ['piano', 'swimming'] } };
  p.flags.martialActs = { age: p.age, n: 2 };
  const busy = weeklyLoad(p);
  check(busy.rows.some((r) => r.label === 'Homework') && busy.rows.some((r) => r.label === 'Clubs') && busy.rows.some((r) => r.label === 'Lessons') && busy.rows.some((r) => r.label === 'Martial arts'),
    `homework, clubs, lessons and martial arts are part of the week (${busy.rows.map((r) => r.label).join(', ')})`);
  check(busy.total >= base + 9 + 4 + 4, `and they add up (${base} → ${busy.total} hours)`);
}

// The more you take on, the greater the stress.
const stressAfter = (fill) => {
  const p = teen();
  fill(p);
  p.career.stress = 30;
  for (let i = 0; i < 3; i++) { p.age += 1; p.flags.lessons && (p.flags.lessons.year.age = p.age - 1); p.flags.martialActs && (p.flags.martialActs.age = p.age - 1); tickWorkLife(); store.state.pendingEvents = []; }
  return p.career.stress;
};
const light = stressAfter(() => {});
const heavy = stressAfter((p) => {
  p.education.clubs = ['robotics', 'debate', 'chess']; p.education.effort = 90;
  p.clubs = { now: { scouts: {}, running: {} }, past: [] };
  p.flags.lessons = { taken: {}, year: { age: p.age, ids: ['piano', 'swimming', 'violin'] } };
  p.flags.martialActs = { age: p.age, n: 2 };
  p.career.partTime = { jobId: 'cafe', title: 'Café assistant', place: 'the café', salary: 1, hours: 12, since: p.age };
});
check(heavy > light + 20, `a teen who takes on everything is far more stressed than one who does not (${light} against ${heavy})`);

// A demanding school is felt.
{
  const pub = stressAfter(() => {});
  const gifted = stressAfter((p) => { store.state.schools = { s1: { kind: 'gifted' } }; p.education.place = { schoolId: 's1' }; });
  check(gifted > pub, `a gifted school's pressure adds to stress (${pub} against ${gifted})`);
}

// What stress does: health, and marks.
{
  const p = teen();
  p.career.stress = 90; p.stats.health = 80;
  const barrier = studyBarrier(p);
  check(barrier > 0.15, `high stress gets in the way of marks (${barrier})`);
  p.career.stress = 30;
  check(studyBarrier(p) < barrier, 'and less when calm');
  p.career.stress = 95; p.education.clubs = ['robotics', 'debate', 'chess']; p.education.effort = 95;
  p.flags.lessons = { taken: {}, year: { age: p.age, ids: ['piano', 'swimming', 'violin'] } };
  p.age += 1; p.flags.lessons.year.age = p.age - 1;
  store.state.pendingEvents = [];
  tickWorkLife();
  check(p.stats.health < 80, `a year near the top costs health (${p.stats.health})`);
  check(store.state.pendingEvents.some((e) => e.id === 'overloaded'), 'and a young person who has taken on too much is asked what gives');
  const before = p.career.stress;
  unload('club');
  check(p.education.clubs.length === 2 && p.career.stress < before, 'dropping a club takes some of it away');
}

// Children's paid work: within the law, and within a week that leaves room for being a child.
{
  const p = teen(12);
  check(!canFit(CHILD_ODD_JOBS + 1, { kind: 'freelance' }).ok && canFit(CHILD_ODD_JOBS - 2, { kind: 'freelance' }).ok, `a 12-year-old may do a few hours of odd jobs, no more (${CHILD_ODD_JOBS})`);
  const q = teen(15);
  const law = workLaw();
  for (const o of pt.jobOptions()) pt.takeJob(o.id);
  check(weeklyLoad(q).paid <= law.minorHours, `a 15-year-old's jobs stay within the law (${weeklyLoad(q).paid} of ${law.minorHours})`);
  for (const sv of fl.services()) fl.offer(sv.id);
  fl.setAvailability(30);
  check(q.career.freelance.hoursOffered + weeklyLoad(q).paid - 0 <= law.minorHours, `and so does freelance work on top (${q.career.freelance.hoursOffered} offered)`);
  check(MINOR_WEEK <= 60, 'a minor\'s whole week has a ceiling');
}

if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('The more you take on, the more stress you carry; and children work only what the law allows.');
