// Every job moves: solid work earns promotions in time (strong work sooner), the title follows the rank in each
// career, the top rank keeps earning raises, and poor work brings a warning, then can cost the job.
// Run with: node tests/promotions.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: () => null };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const career = await import('../js/engine/career.js');
const { CAREER_BY_ID } = await import('../js/data/careers.js');
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); console.log(`${c ? ' ✓' : ' ✗'} ${m}`); };
const life = (id, perf) => {
  do { store.state = createLife({ countryId: 'us' }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = 26; p.birthYear = store.state.year - 26; p.education.enrolled = false; p.education.stage = 'none';
  p.education.degrees.push({ type: 'high', gpa: 3.5, age: 18 }, { type: 'university', majorId: 'education', gpa: 3.5, age: 22 });
  career.hire(CAREER_BY_ID[id], 0, perf, 'test');
  return p;
};
const years = (p, n, perf) => { for (let i = 0; i < n && p.career.careerId; i++) { if (perf != null) p.career.performance = perf; p.stats.health = 90; p.legal.pending = null; p.alive = true; advanceYear(); store.state.pendingEvents = []; } };

// Solid work moves up in time; strong work sooner.
for (const id of ['teacher', 'office', 'nurse', 'software']) {
  let solid = 0; let strong = 0; const titles = new Set();
  for (let i = 0; i < 6; i++) {
    // Promoted at some point in twelve years (an economic layoff later does not undo it).
    const promoted = () => store.state.journal.some((e) => /You were promoted to/.test(e.text));
    rng.seed(100 + i); const a = life(id, 58); years(a, 12, 58); if (promoted()) { solid++; if (a.career.careerId === id) titles.add(a.career.title); }
    rng.seed(100 + i); const b = life(id, 82); years(b, 12, 82); if (promoted()) strong++;
  }
  check(solid >= 3, `${id}: solid work is promoted within twelve years in most lives (${solid} of 6; ${[...titles].join(', ')})`);
  check(strong >= solid - 1, `${id}: strong work about as often or more (${strong} of 6)`);
}
// The title follows the rank, in the career's own words.
rng.seed(7); const t = life('teacher', 85); const first = t.career.title; years(t, 15, 85);
check(t.career.level >= 1 && t.career.title !== first && CAREER_BY_ID.teacher.levels.some((l) => l.title === t.career.title || t.career.title.includes(l.title.split(' ').pop())), `a teacher's title changes with the rank (${first} → ${t.career.title})`);
// At the top, raises carry on.
rng.seed(8); const top = life('office', 85);
const C = CAREER_BY_ID.office; top.career.level = C.levels.length - 1; top.career.title = C.levels.at(-1).title; top.career.yearsInRole = 0;
const pay0 = top.career.salary; years(top, 6, 85);
check(top.career.careerId === 'office' && top.career.salary > pay0, `at the top rank, raises go on (${pay0} → ${top.career.salary})`);
// Poor work: a warning, then the job may go.
let warned = 0; let fired = 0;
for (let i = 0; i < 8; i++) {
  rng.seed(300 + i); const w = life('office', 30); const before = store.state.journal.length;
  years(w, 5, 30);
  if (store.state.journal.slice(before).some((e) => /formal warning/.test(e.text))) warned++;
  if (!w.career.careerId || w.career.careerId !== 'office') fired++;
}
check(warned >= 6, `poor work brings a formal warning first (${warned} of 8)`);
check(fired >= 6, `and if it goes on, the job goes (${fired} of 8 within five years)`);
if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log('Every job moves, up for good work and out for poor work.');
