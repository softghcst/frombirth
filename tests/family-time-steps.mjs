// The living-family systems through 3-, 6- and 12-month turns: the same life, cut three ways, ends the same. Two lives:
// a child of five whose family may separate, remarry and grow (engine/blended.js), and an adult foster carer renting a
// home of their own, with a roommate (engine/fostering.js, engine/independence.js). Ten years each.
// Run with: node tests/family-time-steps.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] ?? null };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { advanceTurn } = await import('../js/engine/turns.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const I = await import('../js/engine/independence.js');
const F = await import('../js/engine/fostering.js');
const B = await import('../js/engine/blended.js');

const problems = [];
let passed = 0;
const check = (c, m) => { if (c) passed++; else { problems.push(m); console.log(` ✗ ${m}`); } };

/** What has to come out the same. */
function summary(s) {
  const p = s.player;
  const roles = {};
  for (const id of p.npcIds) { const n = s.npcs[id]; if (n) roles[n.role] = (roles[n.role] ?? 0) + 1; }
  return {
    year: s.year, age: p.age, alive: p.alive, cash: p.finance.cash, npcs: [...p.npcIds].sort().join(), roles,
    family: JSON.stringify({ seps: p.family?.separations, arr: p.family?.arrangement, status: p.flags.parentsStatus }),
    steps: p.npcIds.map((id) => s.npcs[id]).filter((n) => n?.role === 'stepparent').map((n) => `${n.id}:${!!n.flags.married}:${!!n.flags.liveIn}:${!!n.flags.former}`).join(),
    fostering: JSON.stringify(p.fostering?.placements?.map((x) => [x.childId, x.status, x.goal, x.rights, x.reviews.length]) ?? null),
    leases: JSON.stringify((p.leases ?? []).map((l) => [l.id, l.start, l.end, l.deposit])),
    receipts: (p.finance.receipts ?? []).length,
    events: (s.archive?.canon?.events ?? s.canon?.events ?? []).length,
  };
}

/** Plays `years` years from a saved start in turns of `step` months, answering nothing (scenes are set aside). */
function play(start, step, years) {
  const s = JSON.parse(start);
  store.state = s;
  rng.seed(s.rngSeed ?? 1);
  s.settings = { ...(s.settings ?? {}), step };
  s.month = 0;
  for (let i = 0; i < years * (12 / step) && s.player.alive; i++) {
    s.player.stats.health = 95;
    s.pendingEvents = [];
    advanceTurn();
    if (s.player.fostering?.offer) F.answerReferral(true); // the same answer whenever the agency asks
  }
  return summary(s);
}

function compare(label, start, years) {
  const a = play(start, 3, years);
  const b = play(start, 6, years);
  const c = play(start, 12, years);
  for (const k of Object.keys(c)) {
    const same = JSON.stringify(a[k]) === JSON.stringify(c[k]) && JSON.stringify(b[k]) === JSON.stringify(c[k]);
    check(same, `${label}: ${k} is the same in 3-, 6- and 12-month turns (${JSON.stringify(a[k]).slice(0, 80)} / ${JSON.stringify(b[k]).slice(0, 80)} / ${JSON.stringify(c[k]).slice(0, 80)})`);
  }
  return c;
}

// A child of five, parents together.
rng.seed(31337);
let s; do { s = createLife({ countryId: 'us' }); } while (s.player.royal || s.player.flags.parentsStatus !== 'together');
store.state = s;
for (let i = 0; i < 5; i++) { s.player.stats.health = 95; s.pendingEvents = []; advanceYear(); s.player.alive = true; }
// Parents who have just separated: the years ahead can bring new partners, step-siblings, a wedding, a baby.
{ const ps = s.player.npcIds.map((id) => s.npcs[id]).filter((n) => n?.role === 'parent' && n.alive); if (ps.length === 2) B.separateParents(ps[0], ps[1]); }
s.pendingEvents = [];
s.rngSeed = rng.state();
const childEnd = compare('a growing family', JSON.stringify(s), 10);
check(childEnd.age === 15, 'ten years on, fifteen');
check(childEnd.steps.length > 0 && (childEnd.roles.stepparent ?? 0) > 0, 'the family really changed in those years: new partners, so the comparison means something');

// An adult renting with a roommate, approved to foster.
rng.seed(4711);
do { s = createLife({ countryId: 'us' }); } while (s.player.royal);
store.state = s;
const p = s.player;
p.age = 30; p.birthYear = s.year - 30; p.flags.livesWithParents = true; p.education.enrolled = false; p.finance.cash = 80000;
const friend = makeNpc({ role: 'friend', countryId: 'us', age: 31, relationship: 80 }); s.npcs[friend.id] = friend; p.npcIds.push(friend.id);
const moved = I.moveOut(I.rentalOptions()[0].profileId, friend.id);
check(moved.ok, 'the carer moves out, with a friend');
F.applyToFoster();
s.rngSeed = rng.state();
const adultEnd = compare('a foster carer who rents', JSON.stringify(s), 10);
check(JSON.parse(adultEnd.fostering).length > 0, 'children really were placed in those years');
check(adultEnd.leases.length > 2 && (p.leases ?? []).length >= 1, 'the lease is on the record');

if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log(`${passed} checks passed. Families, homes and fostering come out the same however the years are cut.`);
