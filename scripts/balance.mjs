// A balance check across careers: many simulated lives in each, twenty years on, with no player choices. Starting pay,
// pay and rank after ten and twenty years, and how many were still in the career. Run with: node scripts/balance.mjs [lives]
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] ?? null };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const career = await import('../js/engine/career.js');
const { CAREER_BY_ID } = await import('../js/data/careers.js');
const ls = await import('../js/engine/lawSchool.js');

const N = Number(process.argv[2] ?? 12);
const CAREERS = ['lawyer', 'prosecutor', 'defender', 'judiciary', 'doctor', 'police', 'software', 'teacher', 'nurse', 'accountant'].filter((id) => CAREER_BY_ID[id]);
const median = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const rows = [];
for (const id of CAREERS) {
  const pay = { 0: [], 10: [], 20: [] }; const level = { 10: [], 20: [] }; let stayed = 0;
  for (let i = 0; i < N; i++) {
    rng.seed(1000 + i);
    do { store.state = createLife({ countryId: 'us' }); } while (store.state.player.royal);
    const p = store.state.player;
    p.age = 28; p.birthYear = store.state.year - 28; p.stats.intellect = 70; p.stats.health = 90; p.education.enrolled = false; p.education.stage = 'none';
    p.education.degrees.push({ type: 'high', gpa: 3.5, age: 18 }, { type: 'university', majorId: 'political_science', gpa: 3.5, age: 22 }, { type: 'law', gpa: 3.4, age: 25 }, { type: 'medical', age: 26 });
    if (['lawyer', 'prosecutor', 'defender', 'judiciary'].includes(id)) { const L = ls.lawOf(p); L.bar.admitted = { year: store.state.year, m: ls.nowM() }; (p.flags.licenses ??= []).push('law'); }
    career.hire(CAREER_BY_ID[id], 0, 60, 'balance');
    pay[0].push(p.career.salary);
    for (let y = 1; y <= 20; y++) {
      p.stats.health = Math.max(p.stats.health, 80); p.legal.pending = null; p.legal.incarceration = null; p.alive = true;
      advanceYear(); store.state.pendingEvents = [];
      if (y === 10 || y === 20) { const here = p.career.careerId === id; pay[y].push(here ? p.career.salary : null); level[y].push(here ? p.career.level : null); if (y === 20 && here) stayed++; }
    }
  }
  rows.push({ career: id, start: median(pay[0]), pay10: median(pay[10]), pay20: median(pay[20]), level10: median(level[10]), level20: median(level[20]), top: CAREER_BY_ID[id].levels.length - 1, stayed: `${stayed}/${N}` });
}
console.table(rows);
