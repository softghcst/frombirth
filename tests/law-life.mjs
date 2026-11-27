// A legal life around the cases: pro bono work, what heavy work does to a family, pride and shame, and retirement
// (a judge's mandatory age under the law in force, or a lawyer's own choice), looked back on.
// Run with: node tests/law-life.mjs
import { store, rng, ls, lp, lc, check, finish, lawyer, playCase, turn } from './helpers/lawSetup.mjs';
const life = await import('../js/engine/lawLife.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { EVENT_BY_ID } = await import('../js/data/events/index.js');
rng.seed(131);
const p = () => store.state.player;
const L = () => ls.lawOf(p());

// Pro bono: once a half-year, no fee, and it counts.
lawyer('lawyer');
const opts = life.proBonoOptions();
check(opts.length === 3, `three people who cannot pay (${opts.map((o) => o.id).join(', ')})`);
const r = life.takeProBono(opts[0].id);
const c = lc.caseById(r.caseId);
check(r.ok && c.fee.model === 'pro_bono' && c.proBono, 'a pro bono case, without a fee');
check(!life.takeProBono(opts[1].id).ok && /half-year/.test(life.proBonoWhy()), 'one a half-year');
const integ = L().rep.integrity;
playCase(c); turn();
check(c.fee.amount === 0 && L().proBono.done === 1 && L().rep.integrity > integ, 'when it closes: no fee, and a better name for integrity');
check(/A judge/.test((() => { lawyer('judiciary'); return life.proBonoWhy(); })()), 'a judge does not take clients, pro bono or otherwise');

// The family: a heavy stretch strains a marriage, now and then.
let seen = false;
for (let i = 0; i < 40 && !seen; i++) {
  lawyer('lawyer');
  const sp = makeNpc({ role: 'spouse', countryId: p().countryId, age: 30, relationship: 70 });
  store.state.npcs[sp.id] = sp; p().npcIds.push(sp.id);
  for (const id of ['burglary', 'fraud', 'assault', 'homicide']) { const x = lc.createCase(id); x.awaiting = { what: 'trial', since: ls.nowM(), turn: ls.nowM() }; }
  store.state.pendingEvents = [];
  life.tickLawLife();
  if (store.state.pendingEvents.some((e) => e.id === 'law_family_strain')) {
    seen = true;
    const before = sp.meters.relationship;
    life.strainChoice('work');
    check(sp.meters.relationship < before, 'burying yourself in the work costs the marriage');
  }
}
check(seen && EVENT_BY_ID.law_family_strain, 'a full desk and trials waiting bring a scene at home');
// And it is rare: never twice within five years, however busy.
{
  lawyer('lawyer');
  const sp = makeNpc({ role: 'spouse', countryId: p().countryId, age: 30, relationship: 70 });
  store.state.npcs[sp.id] = sp; p().npcIds.push(sp.id);
  for (const id of ['burglary', 'fraud', 'assault', 'homicide']) { const x = lc.createCase(id); x.awaiting = { what: 'trial', since: ls.nowM(), turn: ls.nowM() }; }
  let n = 0;
  for (let half = 0; half < 10; half++) { store.state.pendingEvents = []; life.tickLawLife(); if (store.state.pendingEvents.some((e) => e.id === 'law_family_strain')) n++; store.state.month = (store.state.month ?? 0) + 6; if (store.state.month >= 12) { store.state.month -= 12; store.state.year += 1; } }
  check(n <= 1, `at most once in five busy years (${n})`);
}

// Pride and shame.
lawyer('lawyer');
const mom = makeNpc({ role: 'parent', countryId: p().countryId, age: 60, relationship: 60 });
store.state.npcs[mom.id] = mom; p().npcIds.push(mom.id);
life.familyHears('win'); check(mom.meters.relationship === 63, 'a big public win: the family is proud');
lc.discipline('suspended'); check(mom.meters.relationship < 63, 'a suspension: they hear about that too');

// Retirement: a judge at the age the law sets.
lawyer('judiciary');
store.state.year = 2020;
check(life.judicialRetirementAge('us') === 70 && life.judicialRetirementAge('ca') === 75, 'judges retire at 70 in US states, 75 in Canada');
lawyer('judiciary', { countryId: 'uk' }); store.state.year = 2010;
check(life.judicialRetirementAge('uk') === 70, 'in England, 70 in 2010');
store.state.year = 2023;
check(life.judicialRetirementAge('uk') === 75, 'and 75 from 2022');
lawyer('judiciary');
store.state.year = 2020;
p().age = 70;
L().benchRecord = Array.from({ length: 12 }, (_, i) => ({ caseId: `x${i}`, title: 'A matter', ruling: 'for', right: true, year: 2010 + i }));
store.state.pendingEvents = [];
life.tickLawLife();
check(L().retired?.how === 'mandatory' && p().career.careerId !== 'judiciary', 'at 70, a state judge retires');
check(store.state.pendingEvents.some((e) => e.id === 'law_retirement'), 'with a last day to look back on');
check(lp.legalLegacy(p().id, p().id).some((e) => /portrait/i.test(e.title)), 'a long-serving judge\'s portrait hangs in the courthouse');
// A lawyer by choice.
lawyer('lawyer');
p().age = 50;
check(!life.retire('choice').ok, 'not before 55');
p().age = 62;
const open = lc.createCase('contract_dispute');
const rr = life.retire('choice');
check(rr.ok && open.done && L().retired && /retired/i.test(lp.mayPractice()), `retired: the files handed on, no more practice (${rr.text})`);
check(life.retirementChoice('mentor') && L().mentoring, 'and a retired lawyer can still mentor');
finish('A legal life has its pro bono work, its family, and its last day.');
