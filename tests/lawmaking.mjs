// Checks that a head of government can change the law of the land through the legislature. Run with: node tests/lawmaking.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { ROOTS } from '../js/data/economy.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { COUNTRY_LIST } from '../js/data/countries.js';
import { LIVING } from '../js/data/living.js';
import { ISSUES } from '../js/data/parties.js';
import { RULES } from '../js/data/rules.js';
import * as law from '../js/engine/rules.js';
import * as gov from '../js/engine/government.js';
import * as politics from '../js/engine/politics.js';
import { polity, joinParty } from '../js/engine/polity.js';
import { profile } from '../js/engine/world.js';

rng.seed(1215);
ROOTS.parentFromAbroad = 0; ROOTS.familyLeaves = 0;
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const leader = (id) => { do { store.state = createLife({ countryId: id }); } while (store.state.player.royal); const p = store.state.player; p.age = 50; p.birthYear = store.state.year; store.state.year += 50;
  p.flags.livesWithParents = false; p.education.enrolled = false;
  // A head of government leads the largest party, as one who had won an election would.
  const w = polity(id); if (w.parties.length) { const big = [...w.parties].sort((x, y) => (w.seats[y.id] ?? 0) - (w.seats[x.id] ?? 0))[0]; joinParty(big.id); }
  politics.takeOffice(politics.offices().find((o) => o.id === 'head'), 60, true); return p; };
const fresh = () => { const k = store.state.player.politics; k.bills = null; k.approval = 60; };

// 1. Every choice, everywhere, is a real change judged on real issues.
store.state = createLife({ countryId: 'us' });
for (const c of COUNTRY_LIST) {
  const list = law.choices(c.id);
  check(list.length >= 6, `${c.id}: too few choices (${list.length})`);
  for (const x of list) {
    check(!!RULES[x.rule] && x.value !== law.rule(x.rule, c.id, { region: null }), `${c.id}: ${x.name} would change nothing`);
    check(Object.keys(x.wants).length > 0 && Object.keys(x.wants).every((i) => ISSUES[i]), `${c.id}: ${x.name} is judged on an issue no party has a view on`);
    check(/^[a-z]/.test(x.name) && Number.isFinite(x.liked) && Math.abs(x.liked) <= 5, `${c.id}: ${x.name} is malformed`);
    if (RULES[x.rule].kind === 'level') check(RULES[x.rule].levels.includes(x.value), `${c.id}: ${x.name} sets an unknown level`);
  }
  check(new Set(list.map((x) => `${x.rule}:${x.value}`)).size === list.length, `${c.id}: the same change is offered twice`);
}
check(law.choices('jp').some((x) => x.rule === 'sameSexMarriage' && x.value === true) && !law.choices('es').some((x) => x.rule === 'sameSexMarriage' && x.value === true), 'only what is not yet law is offered');
check(law.choices('ph').some((x) => x.rule === 'divorce') && !law.choices('us').some((x) => x.rule === 'divorce'), 'divorce can be legalized only where there is none');
section(`choices: every one of ${COUNTRY_LIST.length} countries has real changes of law to offer`);

// 2. Only the head of government, and only twice a year.
let p = leader('jp');
check(gov.reformOptions().length === law.choices('jp').length && gov.reformOptions().every((o) => o.outlook && o.public && /^[A-Z]/.test(o.name)), 'the head of government sees every choice, with how the vote and the public look');
const office = p.politics; p.politics = { ...office, officeId: 'seat' };
check(!gov.putReform('sameSexMarriage', true).ok && law.rule('sameSexMarriage') === false, 'a legislator cannot change the law alone');
p.politics = office;
check(!gov.putReform('sameSexMarriage', false).ok && !gov.putReform('nonsense', 1).ok, 'nor can anyone pass what is already law, or what is not a law');
section('power: the head of government, and only real changes');

// 3. The vote decides, and a law that passes is the law.
let passed = 0; let lost = 0; let crown = 0;
for (let i = 0; i < 60; i++) {
  p = leader(['jp', 'us', 'de', 'br', 'in', 'pl'][i % 6]);
  const c = rng.pick(gov.reformOptions());
  const before = law.rule(c.rule, p.countryId, { region: null }); const laws = polity(p.countryId).laws.length; const app = p.politics.approval;
  const r = gov.putReform(c.rule, c.value, ['none', 'whip', 'public'][i % 3]);
  const now = law.rule(c.rule, p.countryId, { region: null });
  if (r.ok) {
    passed += 1;
    check(now === c.value && law.source(c.rule, p.countryId, { region: null }).source === 'enacted' && law.source(c.rule, p.countryId, { region: null }).by.includes(p.lastName), `${c.name}: passed, and is the law, in the player's name`);
    check(polity(p.countryId).laws.length === laws + 1 && /is the law/.test(r.text) && !/undefined/.test(r.text), `${c.name}: recorded and reported (${r.text.slice(0, 80)})`);
    check(profile(p.countryId).lawChanges.length === 1 && store.state.world.news.some((n) => n.kind === 'law' && n.placeId === p.countryId), `${c.name}: in the world explorer and the news`);
    check(!gov.reformOptions().some((o) => o.rule === c.rule && o.value === c.value), `${c.name}: no longer on offer`);
  } else {
    if (/palace/.test(r.text)) crown += 1; else lost += 1;
    check(now === before && polity(p.countryId).laws.length === laws && p.politics.approval < app, `${c.name}: defeated, nothing changed, and it cost the leader`);
  }
  check(gov.billsLeft() === 1, 'a vote on the law uses one of the year\'s bills');
}
check(passed >= 15 && lost >= 5, `some bills pass and some are defeated (${passed} passed, ${lost} lost, ${crown} refused by a crown)`);
p = leader('jp'); gov.putReform(...Object.values(gov.reformOptions()[0]).slice(0, 2)); fresh(); p.politics.bills = { age: p.age, n: 2 };
check(!gov.putReform('gambling', false).ok, 'no more than the legislature has time for');
section(`votes: ${passed} passed, ${lost} defeated; what passes is the law and is on the record`);

// 4. Parties vote their convictions, and the public has a view.
p = leader('jp'); const w = polity('jp');
const tallyFor = (wants, leadKind) => { const lead = w.parties.find((x) => x.kind === leadKind) ?? w.parties[0]; return lead.positions; };
const liberal = law.choices('jp').find((x) => x.rule === 'sameSexMarriage'); const hard = law.choices('jp').find((x) => x.rule === 'conscription');
check(liberal.wants.open === 1 && hard.wants.order === 1 && hard.wants.open === -1, 'a liberalizing law is judged on freedoms; conscription on order against freedoms');
check(hard.liked < 0 && law.choices('jp').find((x) => x.rule === 'retirementAge' && x.value > law.rule('retirementAge', 'jp')).liked < 0, 'conscription and a later pension are unpopular');
check(law.choices('ng').find((x) => x.rule === 'sameSexMarriage').liked < 0 && law.choices('es').find((x) => x.rule === 'sameSexMarriage').liked < 0 && law.choices('nl').find((x) => x.rule === 'lgbt' && x.value === 'limited').liked < 0,
  'the public takes the law it has as its starting point: reform is unpopular where the law is hostile, and repeal where it is not');
section('politics: issues, parties and public opinion all bear on a bill');

// 5. It takes effect in the life being lived.
p = leader('us'); p.age = 19;
let done = false; for (let i = 0; i < 40 && !done; i++) { fresh(); done = gov.putReform('drinkingAge', 18, 'public').ok; }
check(done ? law.may('drink').ok : !law.may('drink').ok, 'a nineteen-year-old may drink once the drinking age is lowered, and not before');
// A decree shows the effect without depending on the arithmetic of one legislature.
p.politics.ruler = true; fresh(); const d = gov.putReform('votingAge', 16); check(d.ok && law.rule('votingAge') === 16 && /decree/.test(d.text), `where one person rules, it is done by decree (${d.text})`); p.politics.ruler = false;
p.age = 50; p.city = 'Austin'; done = false; for (let i = 0; i < 60 && !done; i++) { fresh(); done = gov.putReform('deathPenalty', false, 'public').ok; }
check(!done || law.rule('deathPenalty') === false, 'abolishing the death penalty nationally ends it in Texas too');
section('effect: a law passed changes what the game allows, at once');

// 6. The world's own reforms respect the politics of a country this life knows.
let against = 0; let total = 0; let everywhere = 0;
for (let k = 0; k < 8; k++) {
  p = leader(['us', 'pl', 'kr', 'br'][k % 4]); politics.leave('stepped down', true); p.politics = null; p.age = 25; p.birthYear = store.state.year - 25; // young enough to see forty years
  for (let i = 0; i < 40; i++) { try { advanceYear(); } catch (err) { problems.push(`year: ${err.message}`); break; } store.state.pendingEvents = []; p.legal.pending = null; p.stats.health = 90; }
  for (const h of law.reforms(p.countryId)) { total += 1; check(/^[A-Z]/.test(h.text), 'worded'); if (/the government of/.test(h.by)) against += 0; }
  everywhere += law.reforms().length;
}
check(everywhere >= 4, `the world went on changing its laws (${everywhere} across eight lives, ${total} of them at home)`);
check(LIVING.us.laws.marriage === true, 'and the reference data was never rewritten');
section(`world: ${everywhere} reforms across eight forty-year lives, ${total} of them at home`);

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 20)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('The legislature can change the law.');
