// Rides out on a bike (pace, time, distance, enjoyment, and what can happen on the way), martial arts (belts and moves,
// and what they are good for in a fight), and a new illness as a choice. Run with: node tests/rides-and-dojo.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { deathRoll } = await import('../js/engine/death.js');
const cars = await import('../js/engine/vehicles.js');
const martial = await import('../js/engine/martial.js');
const { addCondition, ailmentChoice } = await import('../js/engine/health.js');
const { ENCOUNTERS } = await import('../js/data/rides.js');
const { STYLES } = await import('../js/data/martial.js');

rng.seed(20261124);
deathRoll.spared = true;
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };
const life = (age = 14) => {
  let s; do { s = createLife({ countryId: 'us' }); } while (s.player.royal);
  store.state = s; const p = s.player;
  p.age = age; p.birthYear = s.year - age; p.finance.cash = 5000; p.stats.health = 80;
  return p;
};
const bike = (p) => { const a = { id: `asset_test_${p.assets.length}`, kind: 'vehicle', catalogId: 'road_bike', name: 'Road bike', purchasePrice: 1900, value: 1900, boughtAtAge: p.age, condition: 90, age: 1, vehicleClass: 'cycle' }; p.assets.push(a); return a; };

// Rides.
{
  const p = life();
  const a = bike(p);
  check(cars.canRide(a) && cars.ridesLeft(a.id) === 3, 'a bike can be ridden, three times a year');
  const slow = cars.ride(a.id, 'leisurely', 30);
  const fast = cars.ride(a.id, 'speedy', 60);
  const km = (r) => parseFloat(r.distance);
  check(slow.distance && /miles/.test(slow.distance) && slow.joy >= 0 && slow.joy <= 100, `a ride has a distance and an enjoyment (${slow.distance}, ${slow.joy})`);
  check(fast.ok === false || km(fast) > km(slow) * 2, `an hour at speed goes much further than half an hour at leisure (${slow.distance} vs ${fast.distance})`);
  cars.ride(a.id, 'cruising', 15);
  check(!cars.ride(a.id, 'cruising', 15).ok && cars.ridesLeft(a.id) === 0, 'three rides a year');
  let met = 0;
  for (let i = 0; i < 12; i++) { const b = bike(p); for (let j = 0; j < 3; j++) { const r = cars.ride(b.id, 'cruising', 30); if (r.encounter) { met++; check(r.encounter.text && r.encounter.options.length >= 2 && !/\{/.test(r.encounter.text), `an encounter reads right (${r.encounter.id})`); } } }
  check(met >= 4 && met <= 30, `some rides bring something with them (${met} of 36)`);
  check(ENCOUNTERS.length >= 12 && ENCOUNTERS.every((e) => e.options.every((o) => o.good?.[0] && o.bad?.[0])), `a dozen encounters, every option with an outcome (${ENCOUNTERS.length})`);
  const c = bike(p);
  const n = p.assets.length;
  const r = cars.rideEncounter('snatch', 2, c.id); // let it go
  check(r.text && p.assets.length === n - 1, 'letting a thief have the bike loses the bike');
}

// Martial arts: courses, belts, moves.
{
  const p = life(9);
  check(STYLES.length >= 8 && STYLES.every((s) => s.moves.length >= s.ranks.length), 'eight styles, each with a move for every rank');
  const before = martial.fightEdge(p);
  const r1 = martial.takeCourse('taekwondo');
  check(r1.ok && r1.rank === 'White' && r1.moves.length === 1 && r1.moves[0] === 'Eagle Strike', `the first course: a white belt and a first move (${r1.text})`);
  martial.takeCourse('taekwondo');
  check(!martial.takeCourse('taekwondo').ok, 'two courses a year');
  advanceYear(); store.state.pendingEvents = [];
  const r3 = martial.takeCourse('taekwondo');
  check(r3.rank === 'Yellow' || martial.styles().find((x) => x.id === 'taekwondo').rank === 'Yellow', `a new belt after a couple of courses (${r3.text})`);
  check(martial.styles().find((x) => x.id === 'taekwondo').moves.length >= 2, 'and a new move with it');
  check(martial.fightEdge(p) > before && martial.bestMove(p), `training counts in a fight (${martial.fightEdge(p).toFixed(2)}, ${martial.bestMove(p)})`);
  check(!martial.takeCourse('kravmaga').ok, 'krav maga is for twelve and up');
  const q = life(30);
  q.finance.cash = 1e6; // fourteen years of courses, whatever else the years cost
  for (let y = 0; y < 14; y++) { martial.takeCourse('karate'); martial.takeCourse('karate'); advanceYear(); store.state.pendingEvents = []; }
  check(martial.styles().find((x) => x.id === 'karate').black && q.milestones.some((m) => /black belt in karate/i.test(m.text)), 'years of karate: a black belt, and a milestone');
  // A ride's snatch: the move shows as a way to handle it, for someone who knows one.
  const a = bike(q);
  let seen = false;
  for (let i = 0; i < 200 && !seen; i++) { const b = bike(q); for (let j = 0; j < 3 && !seen; j++) { const r = cars.ride(b.id, 'cruising', 30); if (r.encounter?.id === 'snatch') seen = r.encounter.options.some((o) => /Use your/.test(o.label)); } }
  check(seen, 'someone with a move gets to use it when a thief grabs their bike');
  void a;
}

// A new illness: see a doctor, rest, or ignore it.
{
  const p = life(30);
  addCondition('flu');
  const said = ailmentChoice('doctor', { words: { illnessId: 'flu' } });
  check(said && (!p.conditions.some((c) => c.id === 'flu') || /slow to clear/.test(said)), `seeing a doctor sees to it (${said})`);
}

if (problems.length) { console.log(`${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Out on the bike, and into the dojo.');
