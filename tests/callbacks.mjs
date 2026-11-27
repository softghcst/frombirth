// Callbacks (engine/callbacks.js): people from the player's past come back because of something that really happened.
// Each kind fires only with the history behind it, once per person, and with consequences that stay: a wedding attended,
// a job taken through an old roommate, a school friendship picked up, a former step-parent at a birthday, a step-sibling's
// wedding. And the same in 3-, 6- and 12-month turns. Run with: node tests/callbacks.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] ?? null };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { ensureLife } = await import('../js/engine/npcLives.js');
const { resolveChoice } = await import('../js/engine/eventEngine.js');
const { EVENT_BY_ID } = await import('../js/data/events/index.js');
const { CAREERS } = await import('../js/data/careers.js');
const { unmet } = await import('../js/engine/career.js');
const CB = await import('../js/engine/callbacks.js');
const chron = await import('../js/engine/chronicle.js');

rng.seed(24680);
const problems = [];
let passed = 0;
const check = (c, m) => { if (c) passed++; else { problems.push(m); console.log(` ✗ ${m}`); } };

function adult(age = 35) {
  let s; do { s = createLife({ countryId: 'us' }); } while (s.player.royal);
  store.state = s;
  const p = s.player; p.age = age; p.birthYear = s.year - age; p.flags.livesWithParents = false;
  p.education.degrees.push({ type: 'high', gpa: 3.2, age: 18 });
  return p;
}
const add = (o) => { const s = store.state; const n = makeNpc({ countryId: 'us', ...o }); s.npcs[n.id] = n; s.player.npcIds.push(n.id); ensureLife(n); return n; };
/** Runs the yearly check until it fires (keyed by year, so a few years may pass), or gives up. */
function fireWithin(years = 8) {
  for (let i = 0; i < years; i++) { const r = CB.tickCallbacks(); if (r) return r; store.state.year += 1; }
  return null;
}
const answer = (id, choice) => { const pe = store.state.pendingEvents.find((e) => e.id === id); if (!pe) return null; store.state.pendingEvents = store.state.pendingEvents.filter((e) => e !== pe); return resolveChoice(EVENT_BY_ID[id], choice, pe.cast); };

// Nothing without history.
{
  adult();
  add({ role: 'friend', age: 30, relationship: 80 });
  check(fireWithin(10) === null, 'with no shared history, nobody comes back');
}

// A child who lived with the player in foster care, grown and just married.
{
  const p = adult(50);
  const kid = add({ role: 'friend', age: 26, relationship: 60 });
  kid.flags.formerPlacement = 'pl1'; kid.flags.title = 'Lived with you in foster care';
  p.fostering = { status: 'closed', steps: {}, placements: [{ id: 'pl1', childId: kid.id, start: store.state.year - 15, end: store.state.year - 10, status: 'reunified', reviews: [] }] };
  kid.life.married = true; kid.flags.weddingYear = store.state.year;
  const r = CB.tickCallbacks() ?? (() => { kid.flags.weddingYear = store.state.year + 1; store.state.year += 1; return CB.tickCallbacks(); })();
  check(r?.kind === 'cb_care_wedding' && r.id === kid.id, 'a former foster child\'s wedding invitation, when they have really married');
  const before = kid.meters.relationship;
  answer('cb_care_wedding', 0);
  check(kid.meters.relationship > before && chron.events((e) => e.type === 'reunion').length === 1, 'going: closer, and on the record');
  store.state.year += 1; kid.flags.weddingYear = store.state.year;
  check(CB.tickCallbacks()?.id !== kid.id, 'once per person');
}

// An old roommate, senior now, and a job the player is qualified for.
{
  const p = adult(30);
  const career = CAREERS.find((c) => !unmet(c).length && c.levels.length >= 3);
  const rm = add({ role: 'friend', age: 31, relationship: 55 });
  rm.flags.title = 'Former roommate';
  rm.life.job = { careerId: career.id, level: 2, title: career.levels[2].title, salary: 50000, years: 6 };
  const r = fireWithin(10);
  check(r?.kind === 'cb_roommate_job', `an old roommate calls about an opening (${career.name})`);
  answer('cb_roommate_job', 0);
  check(p.career.careerId === career.id, 'and the player takes the job');
}

// A school friend lost touch with, ten years on.
{
  const p = adult(30);
  const f = add({ role: 'friend', age: 30, relationship: 20 }); f.flags.metAt = 'Lincoln High';
  const r = fireWithin(12);
  check(r?.kind === 'cb_school_friend' && r.id === f.id, 'a school friend gets back in touch, years later');
  answer('cb_school_friend', 0);
  check(f.meters.relationship >= 38, 'and meeting up brings them close again');
  void p;
}

// A former step-parent at a milestone birthday.
{
  const p = adult(40);
  const sp = add({ role: 'stepparent', age: 70, relationship: 70 }); sp.flags.former = true; sp.flags.partnerOf = 'x';
  const r = fireWithin(12);
  check(r?.kind === 'cb_former_step' && r.id === sp.id, 'a former step-parent who stayed close comes to a fortieth birthday');
  const sp2 = add({ role: 'stepparent', age: 72, relationship: 70 }); sp2.flags.former = true; sp2.flags.partnerOf = 'y';
  p.age = 41;
  check(fireWithin(6) === null, 'but not to a forty-first');
}

// The same in 3-, 6- and 12-month turns: the yearly step uses keyed dice.
{
  const { advanceTurn } = await import('../js/engine/turns.js');
  const p = adult(30);
  const f = add({ role: 'friend', age: 30, relationship: 20 }); f.flags.metAt = 'Lincoln High';
  const start = JSON.stringify(store.state);
  const run = (step) => { const s = JSON.parse(start); store.state = s; s.settings = { ...(s.settings ?? {}), step }; s.month = 0; for (let i = 0; i < 12 * (12 / step); i++) { s.pendingEvents = []; s.player.stats.health = 95; const ff = s.npcs[f.id]; if (ff) { ff.lastInteractionAge = s.player.age; ff.meters.relationship = 25; } advanceTurn(); } return JSON.stringify(s.player.flags.callbacks ?? {}); };
  const a = run(3); const b = run(6); const c = run(12);
  check(a === b && b === c && /cb_school_friend/.test(c), `the same callbacks however the years are cut, and one did come (${c})`);
  void p;
}

if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log(`${passed} checks passed. The past comes back only where it happened, once, and the same whatever the turn length.`);
