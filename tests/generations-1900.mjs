// One family from 1900 to the present, a year per Age Up, through every era:
// the world year moves on without a gap from one generation to the next; every
// yearly step runs once a year; nothing exists before its time (online
// accounts, careers, medicines, therapies); the yearly summary can be written
// every year; and each generation saves, loads and keeps its ancestors.
// Run with: node tests/generations-1900.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear, YEARLY } = await import('../js/engine/yearProcessor.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const kids = await import('../js/engine/children.js');
const { continueAs, heirs } = await import('../js/engine/legacy.js');
const { die } = await import('../js/engine/death.js');
const { summarize } = await import('../js/engine/yearSummary.js');
const { getEra, worldYear } = await import('../js/engine/history.js');
const { careerExists } = await import('../js/engine/history.js');
const tech = await import('../js/engine/digital/tech.js');
const acc = await import('../js/engine/digital/accounts.js');
const { PLATFORM_BY_ID } = await import('../js/data/digital.js');
const { MED_BY_ID } = await import('../js/data/health/medications.js');
const { THERAPY_BY_ID } = await import('../js/data/health/therapies.js');
const { medFrom, optionsFor, canOffer } = await import('../js/engine/health/rules.js');
const { yearOf } = await import('../js/engine/health/util.js');

rng.seed(1900);
const problems = [];
const check = (cond, msg) => { if (!cond && !problems.includes(msg)) problems.push(msg); };
const roundTrip = () => { saveGame(store.state); store.state = loadGame(store.state.slotId); return store.state.player; };

function begin() {
  let s;
  do { s = createLife({ countryId: 'uk', year: 1900 }); } while (s.player.royal);
  store.state = s;
  check(store.state.year === 1900 && getEra(1900).id !== 'now', 'the first life begins in 1900, in its own era');
}
begin();

const seenTrials = new Set();
const offered = {}; // year -> medicines a psychiatrist could offer for depression then

/**
 * What a psychiatrist could offer for depression this year, asked the way the game asks: a diagnosis on the
 * record, then the prescribing rules. Nothing may be offered before it existed. The diagnosis is taken off again.
 */
function treatmentToday() {
  const p = store.state.player;
  const y = store.state.year;
  const doc = makeNpc({ role: 'clinician', countryId: p.countryId, age: 45 });
  doc.flags.clinician = { profession: 'psychiatrist' };
  const dx = { id: `dx_probe_${y}`, conditionId: 'mdd', status: 'active', wk: y * 52, providerId: doc.id };
  p.health.diagnoses.push(dx);
  const meds = optionsFor('mdd', doc, p);
  const talking = Object.values(THERAPY_BY_ID).filter((t) => canOffer(t.id, 'mdd', { flags: { clinician: { profession: 'psychologist' } } }, p).ok);
  p.health.diagnoses.splice(p.health.diagnoses.indexOf(dx), 1);
  offered[y] = meds.map((m) => m.id);
  check(meds.every((m) => y >= medFrom(m, 'mdd')), `no medicine offered before its time (${y}: ${meds.map((m) => m.id).join(', ')})`);
  check(talking.every((t) => y >= t.from), `no therapy offered before its time (${y})`);
}
const seenTherapies = new Set();
const eras = new Set([getEra(store.state.year).id]);
let archive = [];
let generation = 1;
let years = 0;
let lines = 1; // families started; a line can end early (a death with no heir), and then a new one begins

/** Lives one year and checks everything that should hold for it. */
function liveYear() {
  const p = store.state.player;
  // The test keeps the family going: good health, no prison, events left unanswered.
  p.stats.health = Math.max(p.stats.health, 85);
  p.legal.pending = null; p.legal.incarceration = null;
  const year = store.state.year;
  const age = p.age;
  advanceYear();
  store.state.pendingEvents = [];
  years++;
  const y = store.state.year;
  eras.add(getEra(y).id);
  if (!p.alive) return;
  check(y === year + 1 && p.age === age + 1, `one Age Up is one year (${year} to ${y})`);
  check(YEARLY.every(([id]) => store.state.yearMarks[id] === y), `every yearly step ran once in ${y}`);
  check(worldYear() === y, `money and prices follow the year (${y})`);
  // Nothing before its time.
  const accounts = acc.activeAccountsOf(p.id);
  check(tech.digitalEra(y, p.countryId) || !accounts.length, `no online accounts before there is an online world (${y})`);
  check(accounts.every((a) => y >= PLATFORM_BY_ID[a.platformId].launch), `no account on a platform before it launched (${y})`);
  check(!p.career?.careerId || careerExists(p.career.careerId, y), `no career before it exists (${p.career?.careerId} in ${y})`);
  const h = p.health;
  for (const t of h?.trials ?? []) {
    if (seenTrials.has(t.id)) continue;
    seenTrials.add(t.id);
    check(yearOf(t.startWk) >= medFrom(MED_BY_ID[t.medicationId], t.conditionId), `no medicine before its time (${t.medicationId} in ${yearOf(t.startWk)})`);
  }
  for (const c of h?.therapies ?? []) {
    if (seenTherapies.has(c.id ?? c.startWk)) continue;
    seenTherapies.add(c.id ?? c.startWk);
    check(yearOf(c.startWk) >= THERAPY_BY_ID[c.therapyId].from, `no therapy before its time (${c.therapyId} in ${yearOf(c.startWk)})`);
  }
  // The yearly life update can be written from what was saved.
  const r = store.state.yearReport;
  let summary = null;
  try { summary = summarize(r.before, store.state, r.planLines); } catch (e) { check(false, `the yearly summary for ${y} fails: ${e.message}`); }
  check(summary && r.year === y, `there is a yearly summary for ${y}`);
}

for (;;) {
while (generation < 6 && store.state.year < 2030) {
  const p = store.state.player;
  // Grow up, settle down, have a child; live until the child is grown; die; the child carries on.
  while (p.alive && p.age < 24) liveYear();
  if (!p.alive) break;
  p.flags.livesWithParents = false;
  if (!Object.values(store.state.npcs).some((n) => n.role === 'spouse' && n.alive && p.npcIds.includes(n.id))) {
    const sp = makeNpc({ role: 'spouse', countryId: p.countryId, age: p.age, relationship: 80 });
    store.state.npcs[sp.id] = sp; p.npcIds.push(sp.id);
  }
  treatmentToday();
  const spouse = p.npcIds.map((id) => store.state.npcs[id]).find((n) => n?.role === 'spouse' && n.alive);
  // Children died young far more often in the early years. A family that lost one had another, as families did.
  let child = kids.newborn(spouse);
  const alive = (n) => store.state.npcs[n.id]?.alive;
  while (p.alive && !(alive(child) && store.state.npcs[child.id].age >= 20)) {
    if (!alive(child) && p.age < 45) child = kids.newborn(spouse);
    else if (!alive(child)) break;
    liveYear();
  }
  treatmentToday();
  if (!alive(child)) break;
  const yearAtDeath = store.state.year;
  archive.push(`${p.firstName} ${p.lastName}`);
  if (p.alive) die('old age');
  const heir = heirs().find((n) => n.id === child.id) ?? heirs().find((n) => n.role === 'child');
  if (!heir) break;
  const next = continueAs(heir.id);
  check(next && next.year === yearAtDeath, `the heir carries on in the same year (${yearAtDeath})`);
  store.state = next;
  generation++;
  check(store.state.player.generation === generation, 'the generation count goes up by one');
  // The heir's family is redrawn around them: parents and grandparents stay as people. The whole line, every
  // generation, is kept in the family archive (engine/chronicle.js), which the family history reads.
  const archived = Object.values(next.archive?.people ?? {}).map((x) => `${x.firstName} ${x.lastName}`);
  check(archive.every((name) => archived.includes(name)), `every earlier generation is in the family archive (generation ${generation})`);
  check(Object.values(next.npcs).some((n) => n.flags?.ancestor && `${n.firstName} ${n.lastName}` === archive.at(-1)), `the generation before is kept as an ancestor (generation ${generation})`);
  const y = store.state.year;
  const back = roundTrip();
  check(store.state.year === y && back.generation === generation, `generation ${generation} saves and loads in ${y}`);
}

if (generation >= 5 || lines >= 6) break;
// The line ended before it could reach the present (a life cut short with no heir to carry on): this is about
// whether a family can live the century a year at a time, so a new family starts from 1900.
lines += 1; generation = 1; years = 0; archive = [];
for (const k of Object.keys(offered)) delete offered[k];
begin();
}
const last = store.state.year;
check(generation >= 5, `at least five generations lived (${generation})`);
check(last >= 2010, `the family reaches the present day (${last})`);
check(years === last - 1900, `the world year moved on without a gap (${years} Age Ups, 1900 to ${last})`);
const years_ = Object.keys(offered).map(Number).sort((a, b) => a - b);
check(offered[years_[0]].length < offered[years_.at(-1)].length, `there is more to offer for depression later in the century (${years_.map((y) => `${y}: ${offered[y].length}`).join('; ')})`);
check(eras.size >= 4, `the family lived through several eras (${[...eras].join(', ')})`);

console.log(`${lines > 1 ? `${lines} families started (a line can end early). ` : ''}Medicines a psychiatrist could offer for depression: ${years_.map((y) => `${y}: ${offered[y].length}`).join(', ')}.`);
console.log(`${generation} generations, ${years} years (1900 to ${last}), eras: ${[...eras].join(', ')}; ${seenTrials.size} medicine trial(s), ${seenTherapies.size} therapy course(s).`);
if (problems.length) { console.log(`\n${problems.length} problem(s):\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log('One family, 1900 to the present, a year at a time.');
