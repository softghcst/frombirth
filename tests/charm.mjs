// Activities done for charm: what is offered at what age, what they cost, what they add, and once a year each.
// Run with: node tests/charm.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { deathRoll } = await import('../js/engine/death.js');
const fun = await import('../js/engine/activities.js');
const { CHARM_ACTIVITIES } = await import('../js/data/activities.js');

rng.seed(20261120);
deathRoll.spared = true;
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };
const life = (age) => {
  let s; do { s = createLife({ countryId: 'us' }); } while (s.player.royal);
  store.state = s; const p = s.player;
  p.age = age; p.birthYear = s.year - age; p.finance.cash = 100000; p.legal.incarceration = null;
  return p;
};

// Who can do what.
const ids = (p) => fun.activityOptions().filter((a) => a.charm).map((a) => a.id);
check(ids(life(7)).length === 0, 'a seven-year-old has none of them');
check(ids(life(9)).join() === 'dance', `at nine, dance classes (${ids(life(9))})`);
check(ids(life(30)).length === CHARM_ACTIVITIES.length, 'an adult can do all of them');

// Each adds charm, costs money, once a year.
const p = life(25);
p.stats.charm = 40;
for (const x of CHARM_ACTIVITIES) {
  const before = p.stats.charm; const cash = p.finance.cash;
  const r = fun.charmActivity(x.id);
  check(r.ok && p.stats.charm > before && p.finance.cash < cash, `${x.id}: charm goes up and it is paid for (${before} → ${p.stats.charm})`);
  check(!fun.charmActivity(x.id).ok, `${x.id}: once a year`);
}
check(fun.activityOptions().filter((a) => a.charm).every((a) => a.done), 'the menu shows them done');
advanceYear(); store.state.pendingEvents = [];
check(fun.charmActivity('style').ok, 'and again the next year');

// Diminishing returns, and no money no class.
const q = life(25); q.stats.charm = 95;
fun.charmActivity('dance');
check(q.stats.charm === 95, `at 95 charm a class adds nothing (${q.stats.charm})`);
const r = life(25); r.finance.cash = 0;
check(!fun.charmActivity('style').ok && r.stats.charm === r.stats.charm, 'no money, no stylist');
const j = life(25); j.legal.incarceration = { years: 2 };
check(!fun.activityOptions().some((a) => a.charm), 'not from a cell');

if (problems.length) { console.log(`${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Charm can be worked at.');
