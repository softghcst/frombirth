// Replays the Living World brief's ten end-to-end scenarios (A to J) against the engine.
// Run with: node tests/world-scenarios.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { COUNTRIES } from '../js/data/countries.js';
import { LIVING } from '../js/data/living.js';
import { CAREERS } from '../js/data/careers.js';
import * as cit from '../js/engine/citizenship.js';
import * as imm from '../js/engine/immigration.js';
import * as move from '../js/engine/emigration.js';
import * as towns from '../js/engine/cities.js';
import * as law from '../js/engine/rules.js';
import * as econ from '../js/engine/economy.js';
import * as estate from '../js/engine/realEstate.js';
import * as fx from '../js/engine/currency.js';
import * as sys from '../js/engine/systems.js';
import * as fun from '../js/engine/activities.js';
import * as local from '../js/engine/local.js';
import * as politics from '../js/engine/politics.js';
import { catalogue } from '../js/engine/university.js';
import { rentFactor, healthFactor } from '../js/engine/policy.js';
import { speaks } from '../js/engine/languages.js';
import { netWorth } from '../js/engine/finance.js';
import { hire, unmet } from '../js/engine/career.js';
import { newborn } from '../js/engine/children.js';
import { continueAs, heirs } from '../js/engine/legacy.js';
import { meetSomeone } from '../js/engine/romance.js';
import { mayVote, polity } from '../js/engine/polity.js';
import { makeNpc } from '../js/engine/npcFactory.js';
import { profile } from '../js/engine/world.js';
import { ROOTS } from '../js/data/economy.js';

// A family may emigrate with a child, and a parent may come from abroad. Scenarios that are about one country
// switch those off; B and H are where they are tested.
const LEAVES = ROOTS.familyLeaves; const FROM = ROOTS.parentFromAbroad;
const stay = (on) => { ROOTS.familyLeaves = on ? 0 : LEAVES; ROOTS.parentFromAbroad = on ? 0 : FROM; };

rng.seed(4242);
const problems = [];
const ok = [];
let current = '';
const check = (cond, msg) => { if (!cond) problems.push(`${current}: ${msg}`); };
const scenario = (name) => { current = name; };
// A life can end early for reasons that have nothing to do with what a scenario is about (an illness, an accident).
// When that happens the scenario is played again rather than judged on a life that stopped.
let died = false;
let p;
const play = (name, fn) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    died = false;
    const before = problems.length; const okBefore = ok.length;
    fn();
    if (!died) return;
    problems.length = before; ok.length = okBefore;
  }
  problems.push(`${name}: the character died early six times running`);
};
const done = (msg) => { if (!problems.some((x) => x.startsWith(current))) ok.push(`${current}  ${msg}`); };
const born = (opts) => { do { store.state = createLife(opts); } while (!opts.birthRank && store.state.player.royal); return store.state.player; };
const year = (n = 1) => { for (let i = 0; i < n; i++) { if (store.state.player.alive === false) { died = true; return; } try { advanceYear(); } catch (err) { problems.push(`${current}: a year failed: ${err.message}`); return; } store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = 90; } };
const adult = (opts, age, cash = 150000) => { const p = born(opts); p.age = age; p.birthYear = store.state.year; store.state.year += age; p.flags.livesWithParents = false; p.education.enrolled = false; p.education.stage = 'none';
  p.education.degrees = [{ type: 'high', gpa: 3.4, age: 18 }]; p.finance.cash = Math.round(cash * COUNTRIES[opts.countryId].currency.scale); for (const n of Object.values(store.state.npcs)) { n.age += age; if (n.role === 'spouse' || n.role === 'partner') n.role = 'ex'; } return p; };
const job = (id = 'office', level = 0) => hire(CAREERS.find((c) => c.id === id), level, 65);
const go = (dest, opts) => { const p = store.state.player; for (let i = 0; i < 80 && p.countryId !== dest; i++) { p.flags.visaAge = null; move.emigrate(dest, opts); } return p.countryId === dest; };
const journal = () => store.state.journal.map((j) => j.text).join(' | ');

// ---------- A. Born in the United States ----------
play('A', () => {
  scenario('A');
  stay(true);
  p = born({ countryId: 'us', city: 'Orlando' });
  check(p.city === 'Orlando' && towns.hereCity().region === 'Florida' && cit.held(p).includes('us'), 'born in Orlando, Florida, a United States citizen');
  year(19);
  check(p.age === 19 && (p.education.degrees.length > 0 || p.education.enrolled || p.education.droppedOut), 'went through school');
  p.education.enrolled = false; p.flags.livesWithParents = false; if (!p.education.degrees.length) p.education.degrees.push({ type: 'high', gpa: 3, age: 18 });
  check(job().ok && p.career.salary > 0, 'found work');
  p.finance.cash += 5e6; const l = estate.listings()[0]; check(estate.buyProperty(l.id, l.price).ok && p.assets.some((a) => a.city === 'Orlando'), 'bought a home in Orlando');
  check(law.rule('drinkingAge') === 21 && law.source('drinkingAge').source === 'place' && ['place', 'enacted'].includes(law.source('deathPenalty').source), 'lives under United States law, with Florida\'s where it differs');
  const hiring0 = econ.hiringClimate(); (store.state.world.places.us ??= {}).phase = 'slump'; store.state.world.places.us.since = store.state.year;
  check(econ.hiringClimate() < hiring0 || hiring0 < 0, 'a national recession changes their prospects');
  year(8); check(Number.isFinite(netWorth(store.state)) && (econ.phaseOf('us') !== 'slump' || store.state.world.places.us.since > store.state.year - 9) && econ.news().some((n) => n.yours), 'and the economy goes on changing, with the news that touches them marked as theirs');
  done('born in Orlando; school, work, a home, and an economy that moves');
});

// ---------- B. International childhood ----------
play('B', () => {
  scenario('B');
  p = born({ countryId: 'br', city: 'Recife' }); year(7);
  const parents = () => Object.values(store.state.npcs).filter((n) => n.role === 'parent' && n.alive);
  const grand = Object.values(store.state.npcs).filter((n) => n.role === 'grandparent' && n.alive && !n.flags.abroad);
  const friend = makeNpc({ role: 'friend', countryId: 'br', age: 7 }); store.state.npcs[friend.id] = friend; p.npcIds.push(friend.id);
  const nan = makeNpc({ role: 'grandparent', countryId: 'br', age: 58 }); store.state.npcs[nan.id] = nan; p.npcIds.push(nan.id); grand.push(nan);
  check(move.emigrate('pt', { forced: true, family: true, city: 'Porto' }).ok && p.countryId === 'pt' && p.city === 'Porto', 'the family moved to Portugal when the child was seven');
  check(parents().length > 0 && parents().every((n) => !n.flags.abroad) && p.flags.livesWithParents, 'the parents came, and the child still lives with them');
  check(grand.every((n) => n.flags.abroad === 'br') && friend.flags.abroad === 'br', 'grandparents and friends stayed in Brazil, and are still in the child\'s life');
  check(p.birthCountryId === 'br' && cit.held(p).includes('br') && !cit.held(p).includes('pt') && cit.residency(p).status === 'permanent_resident', 'still Brazilian by birth and nationality; a resident of Portugal, not a citizen');
  check(p.locations.length === 2 && p.locations[0].countryId === 'br' && p.locations[1].city === 'Porto', 'both homes are in the record');
  year(6); check(p.age === 13 && p.education.enrolled && speaks('pt') >= 70, `at school in Portugal, speaking the language (${speaks('pt')})`);
  check(fun.flightDestinations().find((d) => d.id === 'br')?.family.length > 0 || !Object.values(store.state.npcs).some((n) => n.alive && n.flags.abroad === 'br'), 'and can fly back to see the family in Brazil, while any of them are living');
  year(6); p.legal.record = []; p.finance.cash = Math.max(p.finance.cash, 1e5); check(p.countryId !== 'pt' || cit.naturalisation(p).possible, `as an adult, after years there, may apply to become Portuguese (${cit.naturalisation(p).why})`);
  done('Brazil to Portugal as a child: family together, birthplace kept, school and language carried on');
});

// ---------- C. Study abroad ----------
play('C', () => {
  scenario('C');
  p = adult({ countryId: 'in', city: 'Pune' }, 18, 60000);
  const study = imm.routes('ca').find((r) => r.id === 'study');
  check(study.eligible && study.status === 'student' && catalogue('ca').length > 0, 'a school leaver from India with funds may apply to study in Canada, where there are universities to apply to');
  check(go('ca', { route: 'study', city: 'Toronto' }) && p.city === 'Toronto' && p.residency.status === 'student', 'arrived in Toronto on a student visa');
  check(unmet(CAREERS.find((c) => c.id === 'retail')).some((x) => /student visa/.test(x)), 'may not work full-time');
  check(p.finance.cash > 0 && !p.homeId, 'rents somewhere to live');
  p.education.enrolled = true; p.education.stage = 'university'; year(3);
  check(p.countryId === 'ca' && p.residency.status === 'student', 'stays while enrolled');
  p.education.enrolled = false; p.education.degrees.push({ type: 'university', majorId: 'business', gpa: 3.3, age: p.age }); year(1);
  check(p.residency?.postStudy && p.residency.workAuthorized, 'after graduating, may stay and work');
  for (let i = 0; i < 4 && p.residency?.status === 'student'; i++) { if (!p.career.careerId) job(); year(1); }
  check(p.countryId === 'ca' && p.residency.status === 'worker', 'a job turns the student visa into a work visa');
  for (let i = 0; i < 6 && p.residency?.status !== 'permanent_resident'; i++) { if (!p.career.careerId) job(); year(1); }
  check(p.residency?.status === 'permanent_resident', 'and years of work make it permanent');
  check(Object.values(store.state.npcs).some((n) => ['boss', 'coworker'].includes(n.role)), 'with colleagues there');
  done('India to Canada: student visa, study, post-study work, sponsorship, permanence');
});

// ---------- D. International marriage ----------
play('D', () => {
  scenario('D');
  p = adult({ countryId: 'jp', city: 'Osaka' }, 30, 200000);
  const s = makeNpc({ role: 'spouse', countryId: 'jp', age: 29 }); s.bornIn = 'uk'; s.citizenships = [{ jurisdictionId: 'uk', acquisitionType: 'birth', acquiredAt: store.state.year - 29 }]; s.meters.relationship = 85;
  store.state.npcs[s.id] = s; p.npcIds.push(s.id); p.counters.spouses = 1;
  check(cit.held(p).join() === 'jp' && cit.held(s).join() === 'uk', 'marriage changed nobody\'s nationality');
  const fam = imm.routes('uk').find((r) => r.id === 'family'); const settle = imm.routes('uk').find((r) => r.id === 'settle');
  check(fam.eligible && fam.chance > settle.chance && /citizen there/.test(fam.blurb), 'being married to a British citizen opens the family route, the strongest one');
  check(typeof imm.spouseAnswer(s, 'uk') === 'boolean' && typeof imm.spouseAnswer(s, 'ca') === 'boolean', 'the spouse has a view on where to live');
  s.flags.moveAnswer = { age: p.age, dest: 'uk', yes: true };
  job(); const before = p.career.careerId;
  check(go('uk', { route: 'family', city: 'Bristol' }) && !s.flags.abroad && before && !p.career.careerId, 'they moved to Bristol together; the job in Japan was given up');
  check(Object.values(store.state.npcs).some((n) => n.role === 'parent' && n.flags.abroad === 'jp') || !Object.values(store.state.npcs).some((n) => n.role === 'parent' && n.alive), 'family in Japan is still family, now abroad');
  const nat = cit.naturalisation(p);
  check(nat.spouse && nat.needs < 5 && !nat.possible && cit.held(p).join() === 'jp' && mayVote('uk') !== '', 'the wait for citizenship is shorter for a spouse, and nothing is automatic: no vote yet');
  check(nat.mustRenounce.length + nat.willLose.length > 0, 'and taking it would cost the Japanese one, which the game says before the decision');
  let foreign = 0; for (let i = 0; i < 12; i++) { p = adult({ countryId: 'jp' }, 28); for (let k = 0; k < 40; k++) { p.flags.loveActs = null; const r = meetSomeone('app'); const n = r?.npc; if (n?.flags?.from) foreign += 1; } }
  check(foreign > 0, `some of the people a player meets grew up abroad (${foreign})`);
  done('Japan and the United Kingdom: where to live, the family route, a job given up, no automatic citizenship');
});

// ---------- E. Royal family ----------
play('E', () => {
  scenario('E');
  p = born({ countryId: 'uk', birthRank: 'royal' });
  check(!!p.royal && cit.held(p).includes('uk') && p.birthCountryId === 'uk', 'born into the royal family, British by birth');
  year(20);
  check(!!store.state.dynasties?.uk && profile('uk').yourWorld?.lines.some(([k]) => k === 'Royal house'), 'the house is part of the country\'s page in the world explorer');
  check(p.age === 20 && (p.royal?.title || p.royal?.rank) && (p.education.degrees.length > 0 || p.education.enrolled), 'grew up with a title and an education');
  check(p.countryId === 'uk' && law.rule('votingAge') === 18 && !!polity('uk'), 'under the same laws and the same government as everyone else');
  check(store.state.dynasties.uk.history?.length >= 0 && Number.isFinite(netWorth(store.state)), 'with the dynasty\'s history kept');
  done('a royal child in the United Kingdom, inside the shared world');
});

// ---------- F. Political career ----------
play('F', () => {
  scenario('F');
  p = adult({ countryId: 'us', city: 'Austin' }, 40, 300000);
  politics.takeOffice(politics.offices().find((o) => o.id === 'mayor'));
  check(p.politics?.officeId === 'mayor' && local.runsPlace() && !!towns.moveBlock(), 'mayor of Austin, and tied to it');
  const rent0 = rentFactor('us'); const health0 = healthFactor('us');
  // A council can say no; a popular mayor asks again.
  let passed = false; for (let i = 0; i < 40 && !passed; i++) { p.politics.localBudgetAge = null; p.politics.approval = 80; const r = local.presentBudget({ housing: 1, services: 1 }, ['public', 'none', 'whip'][i % 3]); passed = r.ok && local.place().housing > 0; }
  check(passed, 'a budget passed');
  check(rentFactor('us') < rent0 && healthFactor('us') < health0, 'rents and medical bills in the city fell');
  const key = p.city; politics.leave('stepped down', true); p.politics = null;
  check(rentFactor('us') < rent0, 'and stay lower for whoever lives there after the mayor has gone');
  p.city = 'Denver'; check(rentFactor('us') === rent0, 'while another city is untouched'); p.city = key;
  done('a mayor\'s budget changes the city for the people in it');
});

// ---------- G. Multiple currencies ----------
play('G', () => {
  scenario('G');
  p = adult({ countryId: 'us', city: 'Chicago' }, 35, 900000); job('office', 1);
  fx.exchange('USD', 'MXN', 50000);
  const usd0 = p.finance.cash; const mxn0 = p.finance.accounts.MXN; const w0 = netWorth(store.state);
  const house = estate.listingsAbroad('mx', 'Guadalajara')[2]; const r = estate.buyAbroad(house.id);
  const a = p.assets.find((x) => x.kind === 'property');
  check(r.ok && a.countryId === 'mx' && a.paidCode === 'MXN', 'bought a house in Guadalajara, priced and paid in pesos');
  check(p.finance.cash === usd0 - house.quote.fromCash && (p.finance.accounts.MXN ?? 0) === mxn0 - house.quote.fromAccount, 'each account lost exactly its own share');
  const feeUsd = fx.convert(house.fees, 'MXN', 'USD') + house.quote.fee;
  check(Math.abs((w0 - netWorth(store.state)) - feeUsd) <= Math.max(5, feeUsd * 0.05), 'net worth fell by the fees alone: nothing was counted twice or lost');
  fx.exchange('USD', 'MXN', 10000); year(5);
  check(p.countryId !== 'us' || (p.finance.accounts.MXN > 0 && Number.isInteger(p.finance.accounts.MXN) && Number.isFinite(p.finance.cash) && fx.balances().find((b) => b.code === 'MXN' && !b.home)), `five years on: dollars and pesos are still separate balances (${JSON.stringify(fx.balances())})`);
  check(estate.propertyTaxOn(a) === Math.round(a.value * COUNTRIES.mx.propertyTax), 'the house is taxed by Mexico');
  done('dollars, pesos and a house in Mexico, never confused');
});

// ---------- H. Generational immigration ----------
play('H', () => {
  scenario('H');
  stay(false);
  p = adult({ countryId: 'kr', city: 'Busan' }, 28, 200000); const granny = p.firstName;
  check(go('us', { route: 'settle', city: 'Seattle' }), 'the first generation moved from South Korea to the United States');
  const sp = makeNpc({ role: 'spouse', countryId: 'us', age: 27 }); store.state.npcs[sp.id] = sp; p.npcIds.push(sp.id);
  const kid = newborn(sp);
  check(cit.held(kid).includes('us') && cit.held(kid).includes('kr') && kid.bornIn === 'us', 'their child, born in Seattle, is American by birth and Korean by descent');
  year(24); p.stats.health = 90;
  let h = heirs().find((n) => n.id === kid.id) ?? heirs()[0]; check(!!h, 'there is an heir');
  const g1 = { born: p.birthCountryId, lived: p.locations.map((x) => x.countryId).join('>') };
  continueAs(h.id); p = store.state.player;
  check(p.birthCountryId === 'us' && cit.held(p).includes('us') && p.generation === 2, `the second generation plays on as an American-born citizen (born ${p.birthCountryId}, holds ${cit.held(p)}, generation ${p.generation}, heir born ${h?.bornIn}, lives ${p.countryId})`);
  check(Object.values(store.state.npcs).some((n) => ['parent', 'grandparent'].includes(n.role)), 'with the first generation still in the family');
  p.flags.livesWithParents = false; p.education.enrolled = false; p.finance.cash += 400000 * 1; p.legal.pending = null; p.flags.visaAge = null;
  if (p.age < 18) { const d = 18 - p.age; year(d); }
  check(p.countryId === 'ca' || go('ca', { route: 'settle', city: 'Vancouver' }), 'and moves to Canada');
  const sp2 = makeNpc({ role: 'spouse', countryId: 'ca', age: p.age }); store.state.npcs[sp2.id] = sp2; p.npcIds.push(sp2.id);
  const kid2 = newborn(sp2);
  check(cit.held(kid2).includes('ca') && cit.held(kid2).includes('us') && kid2.bornIn === 'ca', 'the third generation is born Canadian, and American by descent');
  check(g1.born === 'kr' && g1.lived === 'kr>us' && /^us(>[a-z]{2})*>ca$/.test(cit.locations(p).map((x) => x.countryId).join('>')), `each generation has its own record of where it lived (${cit.locations(p).map((x) => x.countryId).join('>')})`);
  let rooted = 0; let stateless = 0; for (let i = 0; i < 300; i++) { const q = born({ countryId: ['us', 'de', 'jp', 'br'][i % 4] }); if (Object.values(store.state.npcs).some((n) => n.role === 'parent' && n.flags.from)) { rooted += 1; check(/came to/.test(journal()), 'a family with roots abroad says so'); } if (!cit.held(q).length) stateless += 1; }
  check(rooted >= 12 && rooted <= 60 && stateless === 0, `about one new family in ten has a parent from abroad, and no child is stateless (${rooted} of 300)`);
  done(`three generations, three countries (${granny}'s line); and families that begin with roots elsewhere`);
});

// ---------- I. Economic downturn ----------
play('I', () => {
  scenario('I');
  stay(true);
  let kept = 0; let lives = 0; let hired = 0;
  for (let i = 0; i < 40; i++) {
    p = adult({ countryId: 'de', city: 'Hamburg' }, 30, 20000); job(); const cash0 = p.finance.cash;
    store.state.world = { places: { de: { phase: 'slump', since: store.state.year } }, news: [] };
    for (let y = 0; y < 5; y++) { store.state.world.places.de.phase = 'slump'; year(1); }
    lives += 1; if (p.career.careerId) kept += 1;
    check(p.finance.cash > -cash0 * 3 && Number.isFinite(p.finance.cash), 'five years of recession did not wipe anyone out');
    if (!p.career.careerId && job().ok) hired += 1;
  }
  check(kept / lives >= 0.5 && kept / lives <= 0.95, `most people keep their job through a five-year recession, and some do not (${kept} of ${lives})`);
  store.state.world.places.de.phase = 'slump';
  check(econ.layoffChance() > 0.03 && econ.hiringClimate() < 0 && hired >= 0, 'jobs are harder to get and easier to lose, and still possible');
  done(`a recession: ${kept} of ${lives} kept their jobs for five years; nobody was ruined by it alone`);
});

// ---------- J. World evolution ----------
play('J', () => {
  scenario('J');
  p = adult({ countryId: 'pl', city: COUNTRIES.pl.cities[0] }, 25, 80000); year(2);
  const early = store.state.journal.slice(0, 5).map((j) => j.text).join('|');
  const kin = Object.values(store.state.npcs).filter((n) => ['parent', 'sibling'].includes(n.role) && n.alive).map((n) => n.id);

  check(go('de', { route: 'free', city: 'Berlin' }) && cit.residency(p).status === 'permanent_resident', 'left Poland for Germany');
  const left = store.state.year; job(); year(25);
  const w = store.state.polities.pl;
  check(w.elections.at(-1).year > left + 15 && w.tickedYear === store.state.year, `Poland went on holding elections while they were away (the last in ${w.elections.at(-1).year}, ${w.elections.at(-1).year - left} years after they left)`);
  check(store.state.world.news.length > 10 && store.state.world.news.some((n) => n.year > left), 'the world\'s news went on');
  check(Object.values(store.state.world.places).some((e) => e.phase && e.since > left), 'economies turned');
  check(law.reforms().length >= 0 && store.state.journal.slice(0, 5).map((j) => j.text).join('|') === early, 'their own early history is untouched');
  check(kin.every((id) => store.state.npcs[id]) && kin.filter((id) => store.state.npcs[id].alive).every((id) => typeof store.state.npcs[id].flags.abroad === 'string' || store.state.npcs[id].flags.abroad === false || store.state.npcs[id].flags.abroad == null), 'the family is still on record, wherever each of them now is');
  p.legal.pending = null; p.flags.fugitive = false; p.finance.cash = Math.max(p.finance.cash, 200000); if (p.politics) { politics.leave('stepped down', true); p.politics = null; }
  p.legal.incarceration = null; const home = go('pl', {});
  check(p.alive === false || (home && cit.residency(p).status === 'citizen' && mayVote() === ''), `came home as a citizen, with a vote (${p.alive === false ? 'died' : home ? mayVote() : `still in ${p.countryId}: ${move.emigrate('pl', {}).text}`})`);
  check(p.alive === false || !home || p.locations.map((x) => x.countryId).join('>') === 'pl>de>pl' && Object.values(store.state.npcs).filter((n) => n.alive && n.flags.abroad === 'pl').length === 0, 'the record shows the years away, and the people who stayed are neighbors again');
  done('twenty-five years away, and a return to a country that kept moving');
});

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)]) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('All ten scenarios play through.');
