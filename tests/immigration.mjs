// Checks the routes into a country, statuses that run out, and trips. Run with: node tests/immigration.mjs
import { ROOTS } from '../js/data/economy.js';
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { COUNTRIES } from '../js/data/countries.js';
import { FREE_MOVEMENT, WANTED, ROUTE } from '../js/data/immigration.js';
import { CAREERS } from '../js/data/careers.js';
import * as cit from '../js/engine/citizenship.js';
import * as imm from '../js/engine/immigration.js';
import * as move from '../js/engine/emigration.js';
import * as fun from '../js/engine/activities.js';
import * as docs from '../js/engine/documents.js';
import { unmet, hire, quitCareer } from '../js/engine/career.js';
const job = () => { const p = store.state.player; if (!p.career.careerId) hire(CAREERS.find((c) => c.id === 'office'), 0, 60); p.career.performance = 70; };
import { makeNpc } from '../js/engine/npcFactory.js';

rng.seed(20261117);
ROOTS.parentFromAbroad = 0; // these checks are about plain families; families with roots abroad are tested in world-scenarios.mjs
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (id, age = 30) => {
  do { store.state = createLife({ countryId: id }); } while (store.state.player.royal);
  const p = store.state.player; p.age = age; p.birthYear = store.state.year; store.state.year += age;
  p.finance.cash = Math.round(60000 * COUNTRIES[id].currency.scale); p.flags.livesWithParents = false; p.education.enrolled = false; p.legal.record = [];
  p.education.degrees = [{ type: 'high', gpa: 3.2, age: 18 }];
  for (const n of Object.values(store.state.npcs)) if (n.role === 'spouse' || n.role === 'partner') n.role = 'ex';
  return p;
};
const year = () => { advanceYear(); store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.stats.health = 90; };
const by = (id, dest) => imm.routes(dest).find((r) => r.id === id);
const go = (dest, route) => { const p = store.state.player; let r; for (let i = 0; i < 60 && p.countryId !== dest; i++) { p.flags.visaAge = null; r = move.emigrate(dest, { route }); } return r; };

// 0. The configuration names real things.
for (const a of FREE_MOVEMENT) for (const m of a.members) check(!!COUNTRIES[m], `free-movement area ${a.id} names an unknown place: ${m}`);
for (const w of WANTED) check(CAREERS.some((c) => c.id === w), `wanted career does not exist: ${w}`);
section('configuration: free-movement members and wanted careers all exist');

// 1. Which routes are open depends on who is asking.
let p = life('br');
let rs = imm.routes('jp');
check(rs.length >= 6 && rs.every((r) => r.name && r.blurb && (r.eligible ? r.chance > 0 && r.outlook : r.why)), 'every route explains itself, open or closed');
check(!by('work', 'jp').eligible && !by('family', 'jp').eligible && !by('invest', 'jp').eligible && !by('protection', 'jp').eligible, 'no degree, family, fortune or crisis: those four are closed');
check(by('study', 'jp').eligible && by('settle', 'jp').eligible, 'a school leaver with savings can study or try the settlement program');
p.education.degrees.push({ type: 'university', majorId: 'business', gpa: 3.4, age: 22 });
check(by('work', 'jp').eligible && by('work', 'jp').status === 'worker' && by('work', 'jp').years === ROUTE.workYears, 'a degree opens the work route, for a fixed term');
const before = by('work', 'jp').chance; p.career.lastField = 'engineer';
check(by('work', 'jp').chance > before, 'a career employers look for improves the odds');
p.legal.record.push({ convicted: true }); check(by('work', 'jp').chance < before, 'a conviction worsens them'); p.legal.record = [];
p.finance.cash = Math.round(400000 * COUNTRIES.br.currency.scale); check(by('invest', 'jp').eligible, 'enough money opens the investor route');
const kin = makeNpc({ role: 'sibling', countryId: 'br', age: 33 }); kin.flags.abroad = 'jp'; store.state.npcs[kin.id] = kin; p.npcIds.push(kin.id);
check(by('family', 'jp').eligible && !by('family', 'ca').eligible, 'a sister in Japan opens the family route to Japan only');
check(imm.routes('pt').length >= 6 && !imm.routes('pt').some((r) => r.id === 'free'), 'a Brazilian has no free movement into Portugal');
p = life('fr'); check(by('free', 'de')?.eligible && by('free', 'de').chance === 1, 'a French citizen may move to Germany freely');
check(!imm.routes('uk').some((r) => r.id === 'free') && !imm.routes('us').some((r) => r.id === 'free'), 'but not to the United Kingdom or the United States');
p = life('us'); check(imm.routes('pr').length === 1 && imm.routes('pr')[0].id === 'right', 'a United States citizen goes to Puerto Rico as of right');
p = life('nz'); check(by('free', 'au')?.eligible, 'New Zealand to Australia is free movement');
p = life('ua'); const crisis = COUNTRIES.ua.living.crisis;
if (crisis) check(by('protection', 'pl').eligible && by('protection', 'pl').fee === 0, 'someone from a country in crisis may seek protection, without a fee');
section('routes: eligibility and odds follow education, work, family, money, citizenship and crisis');

// 2. A student visa: no full-time work, lapses without study, becomes a work visa with a sponsor.
p = life('br', 20);
let r = go('ca', 'study');
check(p.countryId === 'ca' && p.residency.status === 'student' && p.residency.until === store.state.year + ROUTE.studyYears && !p.residency.workAuthorized, 'arrives as a student, for four years, without the right to work');
check(unmet(CAREERS.find((c) => c.id === 'retail')).some((x) => /student visa/.test(x)), 'full-time work is refused on a student visa');
check(!cit.naturalisation(p).possible && /temporary/.test(cit.naturalisation(p).why), 'a temporary visa does not lead straight to citizenship');
check(/student visa/i.test(r.text), 'the result says what was granted');
year(); // not enrolled a year on: out of status, a year's grace
year();
check(p.residency?.grace || p.countryId === 'br', 'a student who never studies is given a year, then told to go');
for (let i = 0; i < 3 && p.countryId === 'ca'; i++) year();
check(p.countryId === 'br', `and is sent home (now in ${p.countryId})`);
check(p.locations.length === 3 && p.locations[1].to != null, 'the forced return is in the record of where they have lived');
// The good version: graduates, finds a sponsor.
p = life('br', 20); go('ca', 'study');
p.education.enrolled = true; year(); year(); p.education.enrolled = false; p.education.degrees.push({ type: 'university', majorId: 'business', gpa: 3.3, age: p.age });
year();
check(p.countryId === 'ca' && p.residency.postStudy && p.residency.workAuthorized, 'a graduate may stay two years and work');
job();
for (let i = 0; i < 3 && p.residency?.status === 'student'; i++) { year(); job(); }
check(p.countryId === 'ca' && p.residency.status === 'worker', `with a job the student visa becomes a work visa (${p.residency?.status})`);
section('study: no full-time work; lapses without study; graduates may stay, and a sponsor turns it into work');

// 3. A work visa is renewed while employed and becomes permanent after five years.
p = life('in', 28); p.education.degrees.push({ type: 'university', majorId: 'business', gpa: 3.6, age: 22 });
go('de', 'work');
check(p.residency.status === 'worker' && p.residency.until === store.state.year + ROUTE.workYears, 'arrives on a work visa');
for (let i = 0; i < 14 && p.countryId === 'de' && p.residency.status !== 'permanent_resident'; i++) { job(); year(); } // a layoff in a bad year costs a year of grace, not the visa
check(p.countryId === 'de' && p.residency.status === 'permanent_resident' && p.residency.until == null, `seven years of work: permanent (${p.residency?.status}, in ${p.countryId})`);
// Unemployed at renewal: grace, then home.
p = life('in', 28); p.education.degrees.push({ type: 'university', majorId: 'business', gpa: 3.6, age: 22 });
go('de', 'work');
check(!!p.career.careerId, 'the sponsor\'s job comes with the visa');
for (let i = 0; i < 7 && p.countryId === 'de'; i++) { if (p.career.careerId) quitCareer(); year(); }
check(p.countryId === 'in', 'a work visa without work ends, and the holder goes home');
section('work: renewed while employed, permanent after five years, ended without a job');

// 4. A husband or wife decides for themselves.
let stayed = 0; let came = 0;
for (let i = 0; i < 40; i++) {
  p = life('mx', 35);
  const s = makeNpc({ role: 'spouse', countryId: 'mx', age: 34 }); s.meters.relationship = i % 2 ? 30 : 90; store.state.npcs[s.id] = s; p.npcIds.push(s.id);
  const first = imm.spouseAnswer(s, 'es'); check(imm.spouseAnswer(s, 'es') === first, 'the answer does not change when asked again the same year');
  check(move.household('es').some((n) => n.id === s.id) === first, 'the household reflects the answer');
  go('es', 'settle');
  if (p.countryId !== 'es') continue;
  if (s.flags.abroad === 'mx') { stayed += 1; check(s.role === 'spouse' && s.flags.stayedBehind, 'a spouse who stays is still a spouse'); } else came += 1;
}
check(stayed > 3 && came > 3, `some spouses come and some stay (${came} came, ${stayed} stayed)`);
p = life('mx', 35); const s2 = makeNpc({ role: 'spouse', countryId: 'mx', age: 34 }); s2.meters.relationship = 95; store.state.npcs[s2.id] = s2; p.npcIds.push(s2.id);
s2.flags.moveAnswer = { age: p.age, dest: 'es', yes: false }; go('es', 'settle');
let joined = false; for (let i = 0; i < 25 && !joined; i++) { s2.meters.relationship = 95; imm.tickApart(); joined = !s2.flags.abroad; }
check(joined, 'a strong marriage across a border usually ends with them following');
section('family: a spouse may refuse, stays married at a distance, and may follow later');

// 5. Trips are recorded, with their purpose; looking first helps the application.
p = life('us', 30); p.education.degrees.push({ type: 'university', majorId: 'business', gpa: 3.4, age: 22 });
const c0 = by('settle', 'jp').chance;
r = fun.holiday('flight', false, { countryId: 'jp', cabin: 'economy', purpose: 'scouting' });
check(!r.ok && /passport/i.test(r.text), 'no passport, no flight abroad');
check(docs.applyPassport(p.id, 'us').ok, 'a citizen can get a passport');
r = fun.holiday('flight', false, { countryId: 'jp', cabin: 'economy', purpose: 'scouting' });
check(r.ok && p.trips.length === 1 && p.trips[0].purpose === 'scouting' && p.trips[0].countryId === 'jp', 'a trip is recorded with where and why');
check(by('settle', 'jp').chance > c0, 'having gone to look improves a later application');
check(fun.trips(p)[0].what && fun.trips(p)[0].name === 'Japan', 'the passport can list it');
section('travel: a record of trips with their purpose; scouting counts');

// 6. Family members hold a status of their own.
{
  const cit2 = await import('../js/engine/citizenship.js');
  p = life('in', 32); p.education.degrees.push({ type: 'university', majorId: 'business', gpa: 3.6, age: 22 });
  const kid = makeNpc({ role: 'child', countryId: 'in', age: 10 }); store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id);
  const teen = makeNpc({ role: 'child', countryId: 'in', age: 17 }); store.state.npcs[teen.id] = teen; p.npcIds.push(teen.id);
  go('ca', 'work');
  check(p.countryId === 'ca' && kid.residency?.status === 'dependant' && kid.residency.until === p.residency.until, 'a child who moves with a worker is a dependant, for as long as the parent');
  check(/Dependant/.test(imm.familyStatus(kid)) && imm.household().some((h) => h.id === kid.id && /until/.test(h.status)), 'and it shows');
  // The teenager comes of age with no course and no job: a year's grace, then home.
  const idle = () => { if (teen.life) teen.life.job = null; if (teen.life?.edu) teen.life.edu.yearsLeft = 0; };
  idle();
  for (let i = 0; i < 3 && !teen.flags.abroad; i++) { year(); idle(); }
  check(teen.flags.abroad === 'in' || teen.residency?.status === 'student' || teen.residency?.status === 'worker', `a child who comes of age needs a status of their own (${teen.residency?.status ?? 'went home to ' + teen.flags.abroad})`);
  // The parent becomes permanent: so do the dependants.
  p.residency.status = 'permanent_resident'; p.residency.until = null; year();
  check(kid.residency?.status === 'permanent_resident' && kid.residency.until == null, 'when the parent becomes permanent, so does the child');
  // Naturalisation takes the minor children along; a spouse it does not.
  const sp = makeNpc({ role: 'spouse', countryId: 'in', age: 31 }); store.state.npcs[sp.id] = sp; p.npcIds.push(sp.id);
  p.residency.since = store.state.year - 8; p.finance.cash = 1e7; p.stats.intellect = 90; p.skills = { ...(p.skills ?? {}) };
  let r = { ok: false }; for (let i = 0; i < 6 && !r.ok; i++) { p.flags.natAge = null; r = cit2.naturalise(); }
  if (r.ok) {
    check(kid.age < 18 ? cit2.held(kid).includes('ca') : true, 'a child under eighteen becomes a citizen with the parent');
    check(!cit2.held(sp).includes('ca'), 'a spouse does not');
    check(/became citizens? with you/.test(r.text) || kid.age >= 18, 'and the result says so');
  } else problems.push(`could not naturalize for the test: ${r.text}`);
  // A dependant left behind loses their permission.
  p = life('br', 40); p.education.degrees.push({ type: 'university', majorId: 'business', gpa: 3.6, age: 22 });
  const mum = makeNpc({ role: 'parent', countryId: 'br', age: 66 }); store.state.npcs[mum.id] = mum; p.npcIds.push(mum.id); mum.flags.willComeAge = p.age;
  go('de', 'work');
  check(mum.residency?.status === 'dependant', 'a parent who comes along is a dependant');
  mum.flags.abroad = false; p.countryId = 'fr'; // the player has gone; she has not
  for (let i = 0; i < 3 && !mum.flags.abroad; i++) imm.tickFamilyStatus(), store.state.year += 1;
  check(mum.flags.abroad === 'br', 'a dependant whose sponsor has gone must leave within a year');
  section('family: dependants follow the main visa, grow out of it, become permanent or citizens with the parent');
}

if (problems.length) { console.log('PROBLEMS:'); for (const x of problems) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('Routes, visas and trips hold.');
