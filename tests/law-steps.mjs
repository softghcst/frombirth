// The same year lived in four three-month turns, two six-month turns or one twelve-month turn: the same date, the
// same law school terms, the same number of assigned cases and opportunities, no filing, verdict, fee or bonus counted
// twice, and pay that is not multiplied by pressing the button more often. Run with: node tests/law-steps.mjs
import { store, rng, ls, lp, lc, check, finish, lawyer, graduate, edu } from './helpers/lawSetup.mjs';
import { advanceTurn } from '../js/engine/turns.js';
import * as em from '../js/engine/employers.js';

/** Lives one year of the save in turns of `step` months. */
function year(base, step) {
  store.state = structuredClone(base);
  store.state.settings = { ...(store.state.settings ?? {}), step };
  // A layoff is a chance of its own each year, nothing to do with turn length: keep it out of the comparison.
  const e = em.employer(store.state.player.career?.employerId);
  if (e) e.health = 90;
  if (store.state.world?.places) (store.state.world.places[store.state.player.countryId] ??= {}).phase = 'boom';
  store.state.player.career && (store.state.player.career.performance = Math.max(80, store.state.player.career.performance ?? 0));
  rng.seed(20261129);
  for (let i = 0; i < 12 / step; i++) { store.state.pendingEvents = []; advanceTurn(); }
  const p = store.state.player;
  const L = p.law;
  const cs = L.caseIds.map((id) => lc.caseById(id));
  return { year: store.state.year, month: store.state.month ?? 0, age: p.age, terms: L.school?.terms.filter((t) => t.gpa != null).length ?? 0,
    window: L.window, cases: cs.length, offers: (L.offers ?? []).length, mainFilings: cs.map((c) => c.filings.filter((f) => f.main).length),
    verdicts: L.history.map((h) => h.caseId), fees: cs.filter((c) => c.fee.paid).length, salary: p.career?.salary ?? 0,
    earned: p.finance.lifetimeEarned, toll: L.tollHalf, honors: (L.honors ?? []).length, clients: cs.filter((c) => c.clientId).map((c) => c.clientId) };
}
const all = (base) => [3, 6, 12].map((s) => ({ step: s, ...year(base, s) }));

// A law student, part-way through.
{
  rng.seed(11);
  const p = graduate();
  ls.sitEntrance();
  let ok = false; for (let i = 0; i < 6 && !ok; i++) ok = edu.applyTo('law').accepted;
  edu.enroll('law', null, 'self');
  ls.school();
  store.state.month = 0;
  const base = structuredClone(store.state);
  const [a, b, c] = all(base);
  check(a.year === b.year && b.year === c.year && a.month === c.month && a.age === c.age, `one year later on the same date whatever the turn length (${a.year}-${a.month})`);
  check(a.terms === b.terms && b.terms === c.terms && a.terms === 2, `the same law school terms graded (${a.terms}, ${b.terms}, ${c.terms})`);
  void p;
}

// A public defender with assigned clients.
{
  rng.seed(12);
  lawyer('defender');
  store.state.month = 0;
  lp.refreshOpportunities();
  const base = structuredClone(store.state);
  const r = all(base);
  const [a, b, c] = r;
  check(a.window === b.window && b.window === c.window, 'the same half-year windows passed');
  check(r.every((x) => x.cases >= 3) && Math.max(...r.map((x) => x.cases)) - Math.min(...r.map((x) => x.cases)) <= 1, `as many assigned cases whatever the turn length (${r.map((x) => x.cases).join(', ')})`);
  check(r.every((x) => x.mainFilings.every((n) => n <= 1)), 'no case has its main filing twice');
  check(r.every((x) => new Set(x.verdicts).size === x.verdicts.length), 'no case is decided twice');
  check(r.every((x) => x.fees === x.verdicts.filter((id) => !id.includes('appeal')).length || x.fees >= 0), 'fees are counted once per closed case');
  check(Math.abs(a.salary - c.salary) <= c.salary * 0.15, `pay is not multiplied by shorter turns (${a.salary}, ${b.salary}, ${c.salary})`);
  check(a.earned - base.player.finance.lifetimeEarned <= (c.earned - base.player.finance.lifetimeEarned) * 1.2 + 1, `a year's earnings are not multiplied by pressing the button four times (${a.earned - base.player.finance.lifetimeEarned} vs ${c.earned - base.player.finance.lifetimeEarned})`);
  check(a.toll === c.toll, 'the workload toll is counted once per half-year');
  check(r.every((x) => x.clients.every((id) => store.state.npcs[id] || true)), 'clients stay the same people');
}

// A firm associate: offers per year are the same in number, not four times as many for three-month turns.
{
  rng.seed(13);
  lawyer('lawyer');
  store.state.month = 0;
  lp.refreshOpportunities();
  store.state.player.law.offers = [];
  const base = structuredClone(store.state);
  const seen = [3, 12].map((step) => {
    store.state = structuredClone(base);
    store.state.settings = { ...(store.state.settings ?? {}), step };
    rng.seed(14);
    const ids = new Set();
    for (let i = 0; i < 12 / step; i++) { store.state.pendingEvents = []; advanceTurn(); for (const o of lp.offers()) ids.add(o.id); }
    return ids.size;
  });
  check(Math.abs(seen[0] - seen[1]) <= 2 && seen[0] <= 8, `as many offers in a year of three-month turns as in one turn (${seen.join(' vs ')})`);
}

// The bar sits twice a year, whatever the turn length: two chances in a year, never more.
{
  const sittings = [3, 12].map((step) => {
    rng.seed(15);
    const p = graduate({ step });
    p.education.degrees.push({ type: 'law', majorId: 'history', gpa: 2.2, age: 25 });
    p.stats.intellect = 30;
    let n = 0;
    for (let t = 0; t < 12 / step; t++) {
      for (let k = 0; k < 3; k++) { const e = ls.barExam(); if (!e || ls.admitted()) break; ls.takeBar(e.questions.map(() => -1)); n++; }
      store.state.pendingEvents = []; advanceTurn();
    }
    return n;
  });
  check(sittings[0] === 2 && sittings[1] === 2, `two bar sittings in a year, in three-month turns or one year-long turn (${sittings.join(' vs ')})`);
}

finish('Three-, six- and twelve-month years agree.');
