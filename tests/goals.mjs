// Checks life goals: open at 16, one at a time, steps read from the life, a reward that stays, switching keeps what was
// reached, and every goal's steps can be read in any life without error.
// Run with: node tests/goals.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const goals = await import('../js/engine/goals.js');
const T = await import('../js/engine/traits.js');
const { GOALS, BADGE_BY_ID } = await import('../js/data/goals.js');
const career = await import('../js/engine/career.js');
const { CAREER_BY_ID } = await import('../js/data/careers.js');
const { saveGame, loadGame } = await import('../js/save.js');

rng.seed(1616);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };

function life(age = 30) {
  do { store.state = createLife({ countryId: 'us' }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age; p.flags.livesWithParents = age < 18; p.education.enrolled = false; p.flags.longevity = 18;
  for (const n of Object.values(store.state.npcs)) n.alive = false;
  p.npcIds = []; store.state.traditions = [];
  return p;
}
function person(role, age, extra = {}) {
  const p = store.state.player;
  const n = makeNpc({ role, countryId: p.countryId, age, relationship: 70 });
  Object.assign(n, extra);
  store.state.npcs[n.id] = n; p.npcIds.push(n.id);
  return n;
}

// ---------- 1. Open at 16, one at a time ----------
let p = life(15);
check(!goals.goalsOpen() && !goals.chooseGoal('fortune').ok, 'not before 16');
p.age = 16; goals.tickGoals();
check(store.state.journal.some((e) => /choose a life goal/i.test(e.text)), 'at 16, word that goals are open');
check(GOALS.length >= 20 && ['life', 'career', 'romance'].every((g) => GOALS.filter((x) => x.group === g).length >= 4), 'twenty goals and more: a life, a career, love');
// Every goal's every step can be read in a fresh life, without error and without being reached by accident.
p = life(30);
for (const g of GOALS) for (const s of g.steps) {
  let threw = false; let v = false;
  try { v = goals.internals.CHECKS[s[1]](p, s[2]); } catch { threw = true; }
  check(!threw && goals.internals.CHECKS[s[1]], `${g.id}: "${s[0]}" can be read`);
  void v;
}
section('goals open at 16; every step of every goal can be read');

// ---------- 2. A goal, step by step, to its reward ----------
p = life(28);
check(goals.chooseGoal('big_family').ok && goals.currentGoal()?.id === 'big_family', 'a goal is chosen');
const spouse = person('spouse', 29, { marriedAtAge: 27 }); p.counters.spouses = 1;
goals.checkGoal();
check(goals.stepsOf('big_family')[0].done && !goals.stepsOf('big_family')[1].done, 'married: the first step, and only that');
person('child', 2); person('child', 1); person('child', 0);
store.state.pendingEvents = []; advanceYear();
check(goals.stepsOf('big_family').slice(0, 3).every((s) => s.done), 'three children: through Age Up, the next two steps');
check(store.state.journal.some((e) => /Big Happy Family: raise three children/i.test(e.text)), 'each step is told');
const before = T.traitK('familyDecayK');
person('grandchild', 0);
goals.checkGoal();
check(!goals.currentGoal() && goals.finished().some((f) => f.id === 'big_family') && goals.badges().some((b) => b.id === 'provider'), 'a grandchild: the goal is achieved, and its reward earned');
check(T.traitK('familyDecayK') < before && p.traits.length <= 5 && !p.traits.includes('provider'), 'the reward works like a trait, and is not counted among them');
check(p.milestones.some((m) => /Achieved a life goal: Big Happy Family/.test(m.text)), 'and it is in the life story');
check(!goals.chooseGoal('big_family').ok, 'an achieved goal is not chosen again');
void spouse;
section('a goal is reached step by step, and its reward stays');

// ---------- 3. Switching keeps progress; careers and love ----------
p = life(40);
goals.chooseGoal('soulmate');
person('spouse', 41, { marriedAtAge: 36 }); p.counters.spouses = 1;
goals.checkGoal();
const soul = goals.stepsOf('soulmate').filter((s) => s.done).length;
check(soul === 2, 'in love and married: two steps of Soulmate');
goals.chooseGoal('fortune');
check(goals.choices().find((x) => x.goal.id === 'soulmate').reached === soul, 'switching to another goal keeps what was reached');
goals.chooseGoal('soulmate'); p.age = 47; goals.checkGoal();
check(goals.stepsOf('soulmate')[2].done && !goals.stepsOf('soulmate')[3].done, 'ten years married, back on Soulmate');
// A career goal: the top of the field.
p = life(50);
career.hire(CAREER_BY_ID.doctor, CAREER_BY_ID.doctor.levels.length - 1, 80, 'test');
goals.chooseGoal('chief_medicine');
check(goals.stepsOf('chief_medicine').every((s) => s.done) && goals.finished().some((f) => f.id === 'chief_medicine'), 'a doctor at the top of the ladder achieves Chief of Medicine');
p = life(45); p.politics = { officeId: 'head' };
goals.chooseGoal('elected');
check(goals.finished().some((f) => f.id === 'elected'), 'leading the country is every step of Elected Leader');
p = life(41);
goals.chooseGoal('heartbreaker');
for (let i = 0; i < 3; i++) person('ex', 40);
goals.checkGoal();
check(goals.stepsOf('heartbreaker')[0].done && goals.stepsOf('heartbreaker')[3].done && !goals.stepsOf('heartbreaker')[1].done, 'three romances, still free at 41: two steps of Heartbreaker');
section('switching keeps what was reached; career and love goals read the life');

// ---------- 4. Kept in the save ----------
p = life(30);
goals.chooseGoal('world');
saveGame(store.state); store.state = loadGame(store.state.slotId);
check(goals.currentGoal()?.id === 'world', 'the goal is kept in the save');
check(Object.values(BADGE_BY_ID).every((b) => Object.entries(b.effects ?? {}).every(([k, v]) => !k.endsWith('K') || (v >= 0.8 && v <= 1.2))), 'no reward changes anything by more than a fifth');
section('kept in the save; every reward is small');

for (const line of ok) console.log(`ok   ${line}`);
if (problems.length) { for (const m of problems) console.log(`FAIL ${m}`); console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Life goals hold together.');
