// The driving test: one question, right to pass, three tries a year, and practice with a parent helps.
// Run with: node tests/driving.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { deathRoll } = await import('../js/engine/death.js');
const cars = await import('../js/engine/vehicles.js');
const { DRIVING_QUESTIONS, DRIVING_QUIZ } = await import('../js/data/vehicles.js');

rng.seed(20261121);
deathRoll.spared = true;
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };
const life = (age = 17) => {
  let s; do { s = createLife({ countryId: 'us' }); } while (s.player.royal);
  store.state = s; const p = s.player;
  p.age = age; p.birthYear = s.year - age; p.finance.cash = 50000; p.legal.incarceration = null;
  return p;
};
const right = () => store.state.player.flags.drivingTest.questions.map((x) => x.right);
const wrong = () => store.state.player.flags.drivingTest.questions.map((x) => x.options.find((o) => o !== x.right));

check(DRIVING_QUESTIONS.length >= 15 && DRIVING_QUESTIONS.every(([q, a]) => q.endsWith('?') && a.length === 4 && new Set(a).size === 4), `a bank of real questions (${DRIVING_QUESTIONS.length}), four answers each`);

// Too young.
life(16);
check(!cars.startDrivingTest().ok, 'not at 16');

// Answer it right: a license.
{
  const p = life();
  const cash = p.finance.cash;
  const t = cars.startDrivingTest();
  check(t.ok && t.questions.length === 1 && t.questions.every((x) => x.options.length === 4 && x.q), 'one question, four answers');
  check(p.finance.cash < cash, 'the lessons and the test are paid for');
  const r = cars.finishDrivingTest(right());
  check(r.ok && r.score === 1 && cars.hasLicense() && p.milestones.some((m) => /driving test/.test(m.text)), 'all right: passed, and a milestone');
  check(!cars.canTakeDrivingTest(), 'no test once you have a license');
}

// A wrong answer fails, and shows the right one.
{
  life();
  cars.startDrivingTest();
  const r = cars.finishDrivingTest(wrong());
  check(!r.ok && r.score === 0 && r.missed.length === 1 && r.missed[0].right && !cars.hasLicense(), 'a wrong answer fails, and shows the right one');
}

// Three tries a year, retakes cheaper, then wait for next year. Walking out counts as a try.
{
  const p = life();
  const fees = [];
  for (let i = 0; i < 3; i++) { const before = p.finance.cash; check(cars.startDrivingTest().ok, `try ${i + 1} starts`); fees.push(before - p.finance.cash); cars.finishDrivingTest(i === 2 ? [] : wrong()); }
  check(fees[1] < fees[0] && fees[2] === fees[1], `a retake costs less than the lessons and first test (${fees.join(', ')})`);
  check(!cars.startDrivingTest().ok && cars.drivingTestStatus().left === 0, 'after three fails, no more tries this year');
  check(!cars.hasLicense(), 'and no license');
  p.stats.health = 90;
  advanceYear(); store.state.pendingEvents = [];
  check(cars.drivingTestStatus().left === 3 && cars.startDrivingTest().ok, 'next year, three tries again');
  cars.finishDrivingTest(right());
}

// Practice with a parent crosses a wrong answer off each question.
{
  const p = life();
  p.flags.drivePractice = 2;
  const t = cars.startDrivingTest();
  check(t.practiced && t.questions.every((x) => x.options.length === 3), 'practice: one wrong answer crossed off');
  check(cars.finishDrivingTest(right()).ok, 'and the right answer is still there');
}

// The old one-step call still works (wits and discipline answer for you).
{ life(); const r = cars.takeDrivingTest(); check(typeof r.ok === 'boolean' && typeof r.score === 'number', 'the one-step test still answers'); }

if (problems.length) { console.log(`${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Mirror, signal, maneuver.');
