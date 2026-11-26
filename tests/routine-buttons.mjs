// One button for the routine part of a case, in medicine and in investigations, as in law: the standard workup for a
// patient (only the tests the presentation calls for), and the groundwork of a case file (never the interviews, the
// laboratory requests or a court order). The judgment stays with the player. Run with: node tests/routine-buttons.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] ?? null };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const core = await import('../js/engine/medicine/core.js');
const train = await import('../js/engine/medicine/training.js');
const cases = await import('../js/engine/medicine/cases.js');
const routine = await import('../js/engine/medicine/routine.js');
const { trainingSites } = await import('../js/engine/medicine/hospitals.js');
const { CASE_BY_ID } = await import('../js/data/medicineCases.js');
const icore = await import('../js/engine/investigations/core.js');
const A = await import('../js/engine/investigations/agencies.js');
const W = await import('../js/engine/investigations/casework.js');
const RT = await import('../js/engine/investigations/routine.js');

rng.seed(424242);
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); console.log(`${c ? ' ✓' : ' ✗'} ${m}`); };
const life = (age) => {
  do { store.state = createLife({ countryId: 'us' }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age; p.education.enrolled = false; p.legal.record = []; p.stats.health = 90; p.finance.cash = 1e6;
  return p;
};

// Medicine: the standard workup.
{
  const p = life(34);
  const m = core.M(p);
  m.license = { status: 'full', countryId: 'us' };
  train.startPost('gensurg', trainingSites('gensurg', p.countryId, p.city)[0].e.id, 'attending');
  const list = cases.caseload(m, p);
  const c = list.find((x) => routine.workupTests(x.id).length) ?? list[0];
  const fx = CASE_BY_ID[c.fixtureId];
  const want = routine.workupTests(c.id);
  check(want.length > 0 && want.every((t) => fx.tests.find((x) => x.test === t).value === 'useful'), `the standard workup is the tests this presentation calls for (${want.join(', ')})`);
  const r = routine.standardWorkup(c.id);
  const v = cases.caseView(c.id);
  check(r.ok && want.every((t) => v.tests.find((x) => x.id === t)?.done), `one button orders them, results in the chart (${r.text})`);
  check(!v.tests.some((t) => t.done && ['unsafe', 'low'].includes(fx.tests.find((x) => x.test === t.id).value)), 'never a risky or useless test');
  check(!v.dx && !v.plan, 'the diagnosis and the plan are left to the physician');
  check(!routine.standardWorkup(c.id).ok, 'and once it is done, it is done');
}

// Investigations: the groundwork.
{
  const p = life(32);
  const a = A.agencyOf('municipal', p.countryId, p.city);
  const r = icore.I(p);
  r.job = { agencyId: a.id, employerId: a.employerId, rank: 'detective', detective: true, specialty: 'property', since: store.state.year, rankSince: store.state.year };
  const inv = W.openCase('burglary', { ownerId: a.id, truth: 'insider' });
  r.caseIds.push(inv.id);
  if (!W.canWork(inv)) { inv.investigatorIds = [p.id]; inv.leadId = p.id; }
  const ground = RT.groundworkSteps(inv.id);
  check(ground.length >= 1 && ground.some((s) => s.id === 'scene'), `the groundwork: ${ground.map((s) => s.id).join(', ')}`);
  const res = RT.groundwork(inv.id);
  check(res.ok && inv.file.done.scene, `one button does it (${res.text.slice(0, 90)})`);
  const left = W.steps(inv).map((s) => s.id);
  check(!left.includes('scene') && Object.values(inv.file.witnesses).every((w) => !w.asked.length), 'the interviews are still the detective\'s to do');
  check(!inv.file.labs.length && !inv.file.auths.length, 'and no laboratory request or court order was made for them');
}

if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log('The routine is one button; the judgment is the player\'s.');
