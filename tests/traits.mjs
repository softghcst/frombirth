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

// ---------- 4. Turning points: 13, 18, 45 ----------
{
  const LS = await import('../js/engine/lifeStages.js');
  const { advanceYear } = await import('../js/engine/yearProcessor.js');
  const { getEvent, resolveChoice } = await import('../js/engine/eventEngine.js');
  /** Ages a life up to `age`, then answers the turning point, if it came, with choice `i`. */
  const reach = (life0, age, i) => {
    life0.age = age - 1; life0.birthYear = store.state.year - age + 1;
    store.state.pendingEvents = [];
    advanceYear();
    const q = store.state.pendingEvents.find((e) => e.id.startsWith('life_stage'));
    if (q && i != null) resolveChoice(getEvent(q.id), i, q.cast);
    return q;
  };
  p = life(12); p.flags.livesWithParents = true; p.traits = ['bookish'];
  p.flags.childhood = { acts: { 6: ['art', 'hobby'], 7: ['art', 'toys'], 8: ['art'], 9: ['art', 'hobby'], 10: ['art'], 11: ['art', 'toys'], 12: ['art'] } };
  const q13 = reach(p, 13, null);
  check(q13?.id === 'life_stage' && p.flags.stageOffer?.ids.length === 3, 'at thirteen, who are you becoming: three traits to choose from');
  check(!/[{}]/.test(['t0', 'd0', 't1', 't2', 'stage'].map((k) => q13?.cast.words[k] ?? '{').join('')), 'their names and meanings filled in');
  const ids = p.flags.stageOffer.ids;
  resolveChoice(getEvent('life_stage'), 1, q13.cast);
  check(T.hasTrait(ids[1]) && p.traitSources[ids[1]] === 'teen' && !p.flags.stageOffer, 'choosing one takes it on, "as a teenager"');
  check(!reach(p, 14, null), 'and the question is not asked again until the next turning point');
  // Lives fit what they offer: a child who drew every year is offered Creative far more often than one who did not.
  let artist = 0; let plain = 0;
  for (let i = 0; i < 40; i++) {
    p = life(13); p.traits = []; p.flags.childhood = { acts: { 6: ['art'], 7: ['art', 'hobby'], 8: ['art'], 9: ['art', 'toys'], 10: ['art'], 11: ['art'], 12: ['art'] } };
    if (LS.offerFor(p, 13).ids.includes('creative')) artist += 1;
    p = life(13); p.traits = []; p.flags.childhood = { acts: { 6: ['swim'], 7: ['tumbling'], 8: ['swim'], 9: ['playground'], 10: ['swim'] } };
    if (LS.offerFor(p, 13).ids.includes('creative')) plain += 1;
  }
  check(artist > plain * 2 && artist >= 20, `what is offered fits the childhood: Creative to ${artist} of 40 young artists, ${plain} of 40 swimmers`);
  // Forty-five, with three promotions: Ambitious is likely; and something that does not fit can be grown out of.
  let ambitious = 0;
  for (let i = 0; i < 30; i++) { p = life(45); p.traits = ['worrier']; p.career = { careerId: 'office', promotions: 3, level: 3, stress: 60 }; if (LS.offerFor(p, 45).ids.includes('ambitious')) ambitious += 1; }
  check(ambitious >= 18, `three promotions by forty-five: Ambitious is offered (${ambitious} of 30)`);
  p = life(17); p.traits = ['sunny', 'delicate'];
  const q18 = reach(p, 18, null);
  check(q18?.id === 'life_stage_drop' && p.flags.stageOffer.drop && q18.cast.words.drop, 'at eighteen, one trait may be grown out of');
  const gone = p.flags.stageOffer.drop;
  resolveChoice(getEvent('life_stage_drop'), 3, q18.cast);
  check(!T.hasTrait(gone) && p.traits.length === 1, 'growing out of it lets it go');
  // Full: something new means something old goes.
  p = life(44); p.traits = ['sunny', 'steady', 'gentle', 'musical', 'hardy'];
  const q45 = reach(p, 45, null);
  check(q45?.id === 'life_stage_full' && p.flags.stageOffer.ids.every((id) => !T.clashes(id, p.traits.filter((x) => x !== p.flags.stageOffer.drop))), 'with five traits, taking one on means letting one go');
  const off = { ...p.flags.stageOffer };
  resolveChoice(getEvent('life_stage_full'), 0, q45.cast);
  check(p.traits.length === 5 && T.hasTrait(off.ids[0]) && !T.hasTrait(off.drop) && p.traitSources[off.ids[0]] === 'midlife', 'and the count stays at five');
  p = life(17); p.traits = ['sunny'];
  const qn = reach(p, 18, null);
  resolveChoice(getEvent(qn.id), qn.id === 'life_stage_drop' ? 4 : 3, qn.cast);
  check(p.traits.length === 1 && T.hasTrait('sunny'), '"none of these" changes nothing');
  check(!LS.offerFor(p, 30), 'and thirty is not a turning point');
}
section('at 13, 18 and 45: three traits that fit the life so far, one to grow out of, and never more than five');

for (const line of ok) console.log(`ok   ${line}`);
if (problems.length) { for (const m of problems) console.log(`FAIL ${m}`); console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Traits hold together.');
