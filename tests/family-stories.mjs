// The thirty stories of data/familyStories.js: each is told only when the world makes it true (private relationships,
// marriages, children in two households, family secrets, what is left behind, being a teenager with someone), once,
// and each of its three choices really changes something. Run with: node tests/family-stories.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { ensureLife } = await import('../js/engine/npcLives.js');
const { EVENTS } = await import('../js/data/events/index.js');
const { resolveChoice } = await import('../js/engine/eventEngine.js');
const { ledgerOf } = await import('../js/engine/ledger.js');
const { localMoney } = await import('../js/util.js');
const bonds = await import('../js/engine/bonds.js');
const fam = await import('../js/engine/familyStories.js');
const { FAMILY } = await import('../js/data/familyStories.js');
const stories = await import('../js/engine/loveStories.js');

rng.seed(Number(process.env.SEED ?? 21));
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;
const ALL = { chance: 1, most: 99 };

function life(age = 30, gender = 'male') {
  do { store.state = createLife({ countryId: 'us', gender }); } while (S().player.royal);
  const p = P();
  p.age = age; p.birthYear = S().year - age; p.gender = gender; delete p.flags.bornAs; delete p.flags.identity;
  p.flags.livesWithParents = age < 18; if (age >= 18) { p.education.enrolled = false; p.education.stage = 'none'; }
  p.flags.interestedIn = 'everyone'; p.stats.charm = 70; p.stats.mood = 60; p.finance.cash = 900000; p.legal.incarceration = null;
  p.flags.pregnancy = null;
  for (const id of [...p.npcIds]) { const n = S().npcs[id]; if (n && ['partner', 'spouse', 'ex', 'friend', 'parent', 'sibling', 'relative', 'child'].includes(n.role)) { n.alive = false; n.role = 'acquaintance'; } }
  ledgerOf();
  return p;
}
function person(role, age = 30, rel = 80, heart = {}, gender = 'female') {
  const p = P();
  const n = makeNpc({ role, countryId: p.countryId, age, relationship: rel, gender });
  ensureLife(n); delete n.flags.bornAs;
  n.flags.heart = { casual: 60, secrecy: 60, commitment: 80, forgiving: 60, ...heart };
  S().npcs[n.id] = n; p.npcIds.push(n.id);
  return n;
}
const kid = (age, parentIds, extra = {}) => { const k = person('child', age, 80); k.parentIds = parentIds; Object.assign(k.flags, extra); return k; };
function begin(npc, type) { const rel = npc.meters.relationship; for (let i = 0; i < 200; i++) { npc.flags.acts = {}; npc.meters.relationship = rel; if (bonds.propose(npc.id, type).ok) return bonds.bondWith(npc.id); } return null; }
const aged = (b, years) => { b.start = { ...b.start, year: b.start.year - years }; };
const queued = (id) => S().pendingEvents.filter((e) => e.id === `fam_${id}`);
const key = {};

/** A world in which this story is true. Returns the person it is about, if any. */
const WORLD = {
  secret_encounter() { life(); const w = person('partner', 30, 80); bonds.primary(); const o = person('friend', 28, 70); const b = begin(o, 'secret'); aged(b, 2); return o; },
  secret_public() { const o = WORLD.secret_encounter(); aged(bonds.bondWith(o.id), 1); return o; },
  secret_clean_break() { const o = WORLD.secret_encounter(); aged(bonds.bondWith(o.id), 1); return o; },
  secret_stayed() { life(); const o = person('friend', 28, 80); const b = begin(o, 'fwb'); bonds.end(o.id, 'ended it'); const e = Object.values(S().bonds.list).find((x) => x.npcId === o.id); e.end = { ...e.end, year: S().year - 4 }; o.meters.relationship = 75; return o; },
  truth_trust() { life(); const w = person('partner', 30, 80); const m = bonds.primary(); m.arc.rebuilding = { since: S().year - 1 }; return w; },
  truth_friend() { life(); person('partner', 30, 80); bonds.primary(); const o = person('friend', 28, 70); const b = begin(o, 'secret'); const f = person('friend', 30, 75); b.knows = { [f.id]: { level: 'knows', year: S().year, how: 'saw', fromId: f.id } }; return f; },
  marriage_question() { life(); const w = person('partner', 30, 85); const m = bonds.primary(); aged(m, 4); return w; },
  marriage_dreams() { life(); const w = person('spouse', 30, 80); bonds.primary(); return w; },
  marriage_city() { return WORLD.marriage_dreams(); },
  marriage_money() { return WORLD.marriage_dreams(); },
  marriage_fight() { life(); const w = person('partner', 30, 30); const m = bonds.primary(); aged(m, 3); return w; },
  marriage_vacation() { life(); const w = person('partner', 30, 85); bonds.primary(); return w; },
  marriage_boundaries() { life(); const w = person('partner', 30, 80); const m = bonds.primary(); m.open = true; aged(m, 2); return w; },
  child_unknown() { life(); const w = person('partner', 30, 80); bonds.primary(); const o = person('friend', 28, 70); const b = begin(o, 'secret'); const k = kid(2, [o.id]); b.childIds = [k.id]; return w; },
  half_meet() { life(); const a = person('partner', 30, 80); const b = person('ex', 30, 50); const k1 = kid(6, [a.id]); const k2 = kid(3, [b.id]); return k1.id < k2.id ? k1 : k2; },
  two_households() { life(); const a = person('ex', 30, 60); const b = person('partner', 30, 70); kid(6, [a.id]); kid(4, [b.id]); },
  questions_past() { life(); const o = person('ex', 30, 50); const k = kid(12, [o.id], { livesWith: o.id }); return k; },
  parent_reaches() { life(); return person('parent', 60, 20); },
  family_gathering() { life(); person('parent', 60, 70); person('sibling', 30, 70); person('relative', 40, 70); },
  blended_family() { life(); const w = person('partner', 30, 80); kid(6, ['someone_else']); return w; },
  secret_story() { life(); const o = person('friend', 28, 70); const b = begin(o, 'fwb'); const f1 = person('friend', 30, 70); const f2 = person('friend', 30, 70); b.knows = { [f1.id]: { level: 'knows' }, [f2.id]: { level: 'knows' } }; bonds.end(o.id, 'ended it'); const e = Object.values(S().bonds.list).find((x) => x.npcId === o.id); e.end = { ...e.end, year: S().year - 4 }; },
  house_history() { const p = life(); p.assets.push({ id: 'h1', kind: 'property', name: 'The house', value: 300000, boughtAtAge: p.age - 12 }); p.homeId = 'h1'; },
  family_decision() { const p = life(); const a = person('child', 10, 80), b = person('child', 8, 80); p.flags.will = { mode: 'simple', heirs: [a.id, b.id], items: {} }; },
  unexpected_responsibility() { life(); return person('parent', 82, 70); },
  legacy_left() { life(); const n = person('parent', 80, 80); n.alive = false; n.flags.diedYear = S().year - 1; return n; },
  teen_crush() { life(16); return person('friend', 16, 85); },
  teen_rumor() { life(15); return person('friend', 15, 70); },
  teen_family() { life(16); return person('partner', 16, 80, {}, 'male'); },
  teen_breakup() { life(16); return person('ex', 16, 40, {}, 'male'); },
  teen_promise() { life(17); return person('partner', 17, 85, {}, 'male'); },
};
const play = (id, i) => {
  const at = S().pendingEvents.findIndex((e) => e.id === `fam_${id}`);
  const [q] = S().pendingEvents.splice(at, 1);
  return resolveChoice(EVENTS.find((e) => e.id === `fam_${id}`), i, q.cast);
};

// ---------- 1. Every story: told when true, with the right person; its choices change the world ----------
check(FAMILY.length === 30 && EVENTS.filter((e) => e.id.startsWith('fam_')).length === 30, 'there are thirty stories, each a scene');
for (const s of FAMILY) {
  const about = WORLD[s.id]();
  S().pendingEvents = []; (S().bonds ??= { seq: 0, list: {} }).told = {};
  fam.tickFamilyStories(ALL);
  const mine = queued(s.id);
  check(mine.length >= 1, `${s.id}: told when it is true`);
  if (!mine.length) continue;
  if (about && s.id !== 'half_meet') check(mine[0].cast.them === about.id || !mine[0].cast.them, `${s.id}: it is about the right person`);
  const before = mine.length;
  S().pendingEvents = S().pendingEvents.filter((e) => e.id !== `fam_${s.id}`).concat(mine.slice(0, 1));
  fam.tickFamilyStories(ALL);
  check(queued(s.id).length === 1, `${s.id}: not told again at once (${queued(s.id).length}, was ${before})`);
  // Each of the three choices, in a fresh copy of the world.
  for (let i = 0; i < 3; i++) {
    const w = WORLD[s.id]();
    S().pendingEvents = []; (S().bonds ??= { seq: 0, list: {} }).told = {};
    fam.tickFamilyStories(ALL);
    if (!queued(s.id).length) { check(false, `${s.id}: world could not be rebuilt for choice ${i}`); continue; }
    const fx = s.choices[i][2];
    const p = P(); const who = w ? S().npcs[w.id] : null;
    const rel = who?.meters.relationship; const mood = p.stats.mood; const cash = p.finance.cash;
    let threw = false;
    try { play(s.id, i); } catch (e) { threw = true; problems.push(`${s.id}/${i} threw: ${e.message}`); }
    if (threw) continue;
    if (fx.rel && who?.alive && s.id !== 'half_meet') check(fx.rel > 0 ? who.meters.relationship > rel : who.meters.relationship < rel || rel <= 5, `${s.id}/${i}: ${fx.rel > 0 ? 'warms' : 'cools'} things with them`);
    if (fx.mood) check(fx.mood > 0 ? p.stats.mood > mood : p.stats.mood < mood, `${s.id}/${i}: it moves the player's mood`);
    if (fx.cost) check(p.finance.cash === cash - localMoney(fx.cost, { currency: { scale: 1 } }) || p.finance.cash < cash, `${s.id}/${i}: it costs real money`);
  }
}
section('all thirty stories: told when true, to the right person, not twice at once; every choice changes something');

// ---------- 2. Not told when it is not true ----------
{
  life(30);
  S().bonds ??= { seq: 0, list: {} };
  let n = 0;
  for (let i = 0; i < 200; i++) { S().pendingEvents = []; fam.tickFamilyStories(ALL); n += S().pendingEvents.filter((e) => e.id.startsWith('fam_')).length; S().year += 1; P().age += 1; }
  check(n === 0, `a life with nobody in it has none of them (${n})`);
  life(30); person('partner', 30, 80); bonds.primary();
  let found = new Set();
  for (let i = 0; i < 40; i++) { S().pendingEvents = []; fam.tickFamilyStories(ALL); for (const e of S().pendingEvents) found.add(e.id); S().year += 1; P().age += 1; }
  check(![...found].some((id) => /secret_|teen_|child_unknown|half_meet|questions_past|legacy|house_history|family_decision|unexpected|parent_reaches/.test(id)), `a life with only a partner has only partner stories (${[...found].join(', ')})`);
}
section('only what is true is told');

// ---------- 3. The setting and the turn ----------
{
  const run = (drama) => {
    let n = 0;
    for (let k = 0; k < 120; k++) { WORLD.marriage_dreams(); S().settings = { ...(S().settings ?? {}), drama }; S().pendingEvents = []; const d = { low: { chance: 0.35, most: 1 }, high: { chance: 0.85, most: 2 } }[drama]; n += fam.tickFamilyStories(d); }
    return n;
  };
  const low = run('low'), high = run('high');
  check(low < high && low > 0, `drama sets the pace (${low} on low, ${high} on high, out of 120 years of marriage)`);
  // At most the setting's number in a year, however many are true.
  WORLD.secret_encounter(); S().pendingEvents = []; (S().bonds ??= { seq: 0, list: {} }).told = {};
  check(fam.tickFamilyStories({ chance: 1, most: 1 }) <= 1, 'one at most in a year');
}
section('drama sets how many; a year tells at most its share');

// ---------- 4. In the year loop, at 12, 6 and 3 months a turn ----------
{
  const { advanceYear } = await import('../js/engine/yearProcessor.js');
  for (const steps of [1, 2, 4]) {
    let told = 0;
    for (let k = 0; k < 8; k++) {
      WORLD.marriage_dreams(); S().settings = { ...(S().settings ?? {}), drama: 'high' }; P().stats.health = 95;
      for (let i = 0; i < steps; i++) { advanceYear(); }
      told += S().pendingEvents.filter((e) => e.id.startsWith('fam_') || e.id.startsWith('love_')).length > 0 ? 1 : 0;
      S().pendingEvents = [];
    }
    check(told >= 1, `with ${steps} years run as ${steps} yearly steps stories are told`);
  }
}
section('told at the yearly step, as with every other story');

// ---------- 5. Tone ----------
{
  const teen = FAMILY.filter((s) => s.ages[1] <= 17);
  check(teen.length === 5 && !/sex|intimate|night together|pregnan|virgin|kiss/i.test(JSON.stringify(teen)), 'the teenage stories are about friends, school, family and feelings');
  check(FAMILY.every((s) => s.choices.every(([label]) => label.length <= 56)), 'every button fits on a screen');
}
section('teenage stories stay about friends and family; labels fit');

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(' ✗', p);
  process.exit(1);
}
for (const m of ok) console.log(' ✓', m);
console.log('The family stories hold together.');
