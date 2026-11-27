// Checks traits after birth: the new ones, no opposites, at most five, taken on through a scene, read by checks and by
// the year (friends drift, quarrels, invitations, practice, mood), each a small effect.
// Run with: node tests/traits.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const T = await import('../js/engine/traits.js');
const { TRAITS, TRAIT_BY_ID, MAX_TRAITS } = await import('../js/data/traits.js');
const { applyEffects } = await import('../js/engine/effects.js');
const { resolve } = await import('../js/engine/conditions.js');
const { tickRelationships, interact } = await import('../js/engine/relationships.js');
const mo = await import('../js/engine/moments.js');
const skills = await import('../js/engine/skills.js');

rng.seed(5150);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };

function life(age = 30) {
  do { store.state = createLife({ countryId: 'us' }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age; p.flags.livesWithParents = age < 18; p.education.enrolled = false;
  p.flags.longevity = 18; p.traits = []; p.traitSources = {};
  for (const n of Object.values(store.state.npcs)) n.alive = false;
  p.npcIds = []; store.state.traditions = [];
  return p;
}
function person(role, age, relationship = 60) {
  const p = store.state.player;
  const n = makeNpc({ role, countryId: p.countryId, age, relationship });
  store.state.npcs[n.id] = n; p.npcIds.push(n.id);
  return n;
}

// ---------- 1. The traits, and never two opposites ----------
check(TRAITS.length >= 30, `at least thirty traits (${TRAITS.length})`);
for (const t of TRAITS.filter((x) => x.opposite)) check(TRAIT_BY_ID[t.opposite], `${t.id}'s opposite exists`);
let clash = 0; let over = 0;
for (let i = 0; i < 300; i++) {
  store.state = createLife({ countryId: 'us' });
  const lists = [store.state.player.traits, ...Object.values(store.state.npcs).map((n) => n.traits ?? [])];
  for (const l of lists) { if (l.some((id, j) => T.clashes(id, l.slice(0, j)))) clash += 1; }
  if (store.state.player.traits.length > 3) over += 1;
}
check(clash === 0, `nobody is born with two opposite traits (${clash} were)`);
check(over === 0, 'a newborn has at most three');
section('the traits: thirty and more, and never two opposites');

// ---------- 2. Taking one on, and the limit ----------
let p = life();
const mood0 = p.stats.charm;
check(T.addTrait('outgoing', 'adult').ok && T.hasTrait('outgoing') && p.traitSources.outgoing === 'adult' && p.stats.charm === Math.min(100, mood0 + 3), 'a trait taken on applies its one-time change, and remembers where it came from');
check(!T.addTrait('loner').ok && /outgoing/i.test(T.cannotTake('loner')), 'an outgoing person cannot also be a loner');
check(!T.addTrait('outgoing').ok, 'nor take on the same trait twice');
for (const id of ['romantic', 'creative', 'loyal', 'frugal', 'generous', 'homebody']) T.addTrait(id);
check(p.traits.length === MAX_TRAITS && MAX_TRAITS === 5, `at most ${MAX_TRAITS} traits`);
check(!T.addTrait('ambitious').ok && /at most/.test(T.cannotTake('ambitious')), 'a sixth is refused');
check(T.dropTrait('romantic').ok && !T.hasTrait('romantic') && T.addTrait('ambitious').ok, 'letting one go makes room');
p = life();
applyEffects([{ type: 'trait', value: 'hothead' }], { cast: {} });
check(T.hasTrait('hothead'), 'a scene can give a trait');
check(resolve('trait.hothead') === 100 && resolve('trait.loner') === 50, 'a check can weigh a trait (and one not held weighs nothing)');
check(T.traitWeight({ category: 'love' }) === 1 && (T.addTrait('romantic'), T.traitWeight({ category: 'love' }) > 1), 'love scenes come more often to a romantic');
check(T.traitWeight({ traits: { hothead: 1.5 } }) === 1.5, 'a scene can name the traits it comes more often to');
section('a trait is taken on within the limit, never one that clashes, and checks and scenes read it');

// ---------- 3. What they do over a life: small, and real ----------
/** How much a neglected friend drifts in a year, for someone with these traits. */
function drift(traits) {
  p = life(30); p.traits = traits;
  const f = person('friend', 30, 70); f.lastInteractionAge = 20;
  const before = f.meters.relationship;
  tickRelationships();
  return before - f.meters.relationship;
}
const plain = drift([]); const loyal = drift(['loyal']); const outgoing = drift(['outgoing']);
check(loyal < plain && outgoing < plain && loyal > 0, `friends drift more slowly from the loyal and the outgoing (${loyal}, ${outgoing} against ${plain})`);
/** How much an argument costs, on average. */
function row(traits) {
  let lost = 0;
  for (let i = 0; i < 60; i++) { p = life(30); p.traits = traits; const f = person('friend', 30, 90); interact(f.id, 'argue'); lost += 90 - f.meters.relationship; }
  return lost / 60;
}
const calm = row([]); const hot = row(['hothead']);
check(hot > calm * 1.15 && hot < calm * 1.5, `a hothead's arguments cost more, but not wildly so (${hot.toFixed(1)} against ${calm.toFixed(1)})`);
/** Invitations over twenty years. */
function invites(traits) {
  p = life(30); p.traits = traits;
  for (let i = 0; i < 4; i++) person('friend', 30, 80);
  let total = 0;
  for (let y = 0; y < 20; y++) { store.state.year += 1; store.state.moments = null; mo.startYear(); total += mo.yearState().invites.length; }
  return total;
}
const out = invites(['outgoing']); const alone = invites(['loner']);
check(out > alone, `the outgoing are asked to more than a loner (${out} against ${alone} invitations in twenty years)`);
/** Practice gained in one session of drawing. */
function practiced(traits) {
  let total = 0;
  for (let i = 0; i < 40; i++) { p = life(25); p.traits = traits; p.finance.cash = 1e6; const r = skills.practice('drawing'); total += r.gained ?? 0; }
  return total;
}
const art = practiced(['creative']); const none = practiced([]);
check(art > none, `creative people pick up drawing faster (${art} against ${none})`);
// A year's mood: a loner living alone, a family-minded parent, an ambitious adult with nothing to do.
p = life(35); p.traits = ['loner']; p.stats.mood = 50; T.tickTraits();
check(p.stats.mood === 52, 'a loner living alone is a little happier for it');
p = life(35); p.traits = ['family_minded']; p.stats.mood = 50; person('child', 6); person('child', 9); T.tickTraits();
check(p.stats.mood === 52, 'children at home lift a family-minded parent');
p = life(35); p.traits = ['ambitious']; p.stats.mood = 50; p.career = { careerId: null }; T.tickTraits();
check(p.stats.mood === 46, 'an ambitious adult with no work is unhappy about it');
check(Math.max(...TRAITS.flatMap((t) => Object.entries(t.effects ?? {}).filter(([k]) => /Mood$|^yearMood$|^idleMood$/.test(k)).map(([, v]) => Math.abs(v)))) <= 4, 'no trait moves the mood by more than a few points a year');
check(TRAITS.every((t) => Object.entries(t.effects ?? {}).every(([k, v]) => !k.endsWith('K') || (v >= 0.7 && v <= 1.5))), 'no trait more than halves or doubles anything');
section('traits change a life a little, every year: friends, quarrels, invitations, practice, mood');

for (const line of ok) console.log(`ok   ${line}`);
if (problems.length) { for (const m of problems) console.log(`FAIL ${m}`); console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Traits hold together.');
