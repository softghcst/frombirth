// A gift points somewhere beyond its own stage: Math and Science toward medicine, Writing toward journalism and law,
// Acting toward a courtroom, Sports toward the police. Each counts in getting the job and on the first day of the
// career's own skills (engine/aptitudes.js); none counts against anyone. Run with: node tests/talents-careers.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { TALENTS } = await import('../js/data/talents.js');
const { CAREERS } = await import('../js/data/careers.js');
const apt = await import('../js/engine/aptitudes.js');
const { M } = await import('../js/engine/medicine/core.js');
const { I } = await import('../js/engine/investigations/core.js');
const { lawOf } = await import('../js/engine/lawSchool.js');
const { J } = await import('../js/engine/journalism.js');

rng.seed(20261126);
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };
const job = (id) => CAREERS.find((c) => c.id === id);
const life = (gifts = {}) => {
  do { store.state = createLife({ countryId: 'us', year: 2000 }); } while (store.state.player.royal);
  const p = store.state.player;
  for (const t of TALENTS) p.talents[t.id] = 40;
  Object.assign(p.talents, gifts);
  for (const k of Object.keys(p.skills ?? {})) p.skills[k] = 0;
  return p;
};

// Every talent says where it leads.
for (const t of TALENTS) check(typeof t.leadsTo === 'string' && t.leadsTo.length > 10, `${t.id} says what it leads to`);

// Where each gift counts in getting the job.
const plain = life();
const pairs = [['science', 'doctor'], ['science', 'nurse'], ['writing', 'journalist'], ['writing', 'lawyer'], ['acting', 'lawyer'],
  ['sports', 'police'], ['sports', 'firefighter'], ['art', 'dentist'], ['writing', 'author']];
for (const [gift, careerId] of pairs) {
  const c = job(careerId);
  check(c, `${careerId} exists`);
  const before = apt.workEdge(c, plain);
  const p = life({ [gift]: 95 });
  check(apt.workEdge(c, p) > before + 0.1, `a gift for ${gift} helps toward ${careerId} (${before} -> ${apt.workEdge(c, p)})`);
}
// Not everywhere: music is no help in a hospital.
check(apt.workEdge(job('doctor'), life({ music: 99 })) === apt.workEdge(job('doctor'), plain), 'music does not make a doctor');

// The first day of a career's own skills.
const base = life();
const m0 = M(base).skills.reasoning, l0 = lawOf(base).skills.courtroom, j0 = J(base).skills.writing, i0 = I(base).skills.digital;
const gifted = life({ science: 100, acting: 100, writing: 100, tech: 100 });
check(M(gifted).skills.reasoning >= m0 + 10, 'a gift for science: clinical judgment from the first day');
check(M(gifted).skills.communication > M(base).skills.communication, 'a gift for acting: a bedside manner');
check(lawOf(gifted).skills.courtroom >= l0 + 10, 'a gift for acting: the courtroom');
check(J(gifted).skills.writing >= j0 + 10, 'a gift for writing: the newsroom');
check(I(gifted).skills.digital >= i0 + 10, 'a gift for technology: digital evidence');
// An ordinary talent changes nothing, and nothing goes above 100.
const avg = life({ science: 50 });
check(M(avg).skills.reasoning === m0, 'an ordinary talent gives no head start');
check(Object.values(M(gifted).skills).every((v) => v <= 100), 'skills stay within 100');

if (problems.length) { console.log(problems.map((x) => `FAIL ${x}`).join('\n')); process.exit(1); }
console.log('A gift leads somewhere: medicine, law, the newsroom, the police.');
