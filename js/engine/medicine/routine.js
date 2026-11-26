// The routine part of a patient's case, in one step: the standard workup (the tests the presentation calls for, never
// the risky or useless ones). The judgment (who first, the diagnosis, the plan, the operating room) stays with the
// player. Kept apart from engine/medicine/cases.js, which it uses as any screen would.
import { W } from './core.js';
import { orderTest } from './cases.js';
import { CASE_BY_ID } from '../../data/medicineCases.js';
import { TEST_BY_ID } from '../../data/medicine.js';
import { store } from '../../state.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });

/** The tests the standard workup would order now: the useful ones not yet in the chart. */
export function workupTests(id) {
  const c = W().cases[id];
  if (!c || c.status !== 'open') return [];
  const fx = CASE_BY_ID[c.fixtureId];
  return fx.tests.filter((t) => t.value === 'useful' && (TEST_BY_ID[t.test]?.minYear ?? 0) <= store.state.year && !c.tests.some((x) => x.test === t.test)).map((t) => t.test);
}
/** Orders the standard workup. */
export function standardWorkup(id) {
  const tests = workupTests(id);
  if (!tests.length) return result(false, 'The standard workup is already in the chart.', 'neutral');
  const done = [];
  for (const t of tests) { const r = orderTest(id, t); if (r.ok) done.push(TEST_BY_ID[t]?.name ?? t); }
  return done.length ? result(true, `Ordered the standard workup: ${done.join(', ')}. The results are in the chart.`, 'good') : result(false, 'You have ordered enough tests already.', 'neutral');
}
