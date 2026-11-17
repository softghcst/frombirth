// Checks nationality, residence and money in several currencies. Run with: node tests/citizenship.mjs
import { ROOTS } from '../js/data/economy.js';
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { COUNTRIES } from '../js/data/countries.js';
import { BIRTHRIGHT, SINGLE } from '../js/data/citizenship.js';
import * as cit from '../js/engine/citizenship.js';
import * as fx from '../js/engine/currency.js';
import * as move from '../js/engine/emigration.js';
import { netWorth } from '../js/engine/finance.js';
import { mayVote } from '../js/engine/polity.js';
import { makeNpc } from '../js/engine/npcFactory.js';

rng.seed(424242);
ROOTS.parentFromAbroad = 0; // these checks are about plain families; families with roots abroad are tested in world-scenarios.mjs
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const ids = (list) => list.map((c) => c.jurisdictionId).sort().join();
const life = (id, age = 0) => { store.state = createLife({ countryId: id }); const p = store.state.player; p.age = age; p.birthYear = store.state.year; store.state.year += age; return p; };
const year = () => { advanceYear(); store.state.pendingEvents = []; store.state.player.legal.pending = null; };

// 1. Born with what the rules give, never nothing.
check(ids(cit.atBirth('us', [['mx'], ['mx']], 2030)) === 'mx,us', 'born in the United States to Mexican parents: both');
check(ids(cit.atBirth('de', [['in'], ['in']], 2030)) === 'in', 'born in Germany to Indian parents: Indian only, not German by birth alone');
check(ids(cit.atBirth('jp', [['jp'], ['uk']], 2030)) === 'jp,uk', 'a Japanese and a British parent: both by descent');
check(ids(cit.atBirth('pr', [['fr'], []], 2030)) === 'fr,us', 'born in Puerto Rico: United States citizenship, plus the parent\'s');
check(ids(cit.atBirth('de', [[], []], 2030)) === 'de', 'a child with no claim anywhere is not left stateless');
check(cit.atBirth('us', [['us'], ['us']], 2030).length === 1, 'the same nationality from both parents is recorded once');
for (const j of [...BIRTHRIGHT, ...SINGLE]) check(!!COUNTRIES[j], `citizenship rules name an unknown place: ${j}`);
section('citizenship at birth: by descent, by soil where the place grants it, never stateless');

// 2. Birthplace, residence and citizenship are three records; moving changes only one.
let p = life('br', 30);
p.finance.cash = 400000; p.flags.livesWithParents = false;
let r;
for (let i = 0; i < 30 && p.countryId === 'br'; i++) { p.flags.visaAge = null; r = move.emigrate('pt', {}); }
check(p.countryId === 'pt' && p.birthCountryId === 'br' && cit.held(p).join() === 'br', 'moving to Portugal changes where you live, not where you were born or what you are');
check(cit.residency(p).status === 'permanent_resident' && cit.locations(p).length === 2 && cit.locations(p)[0].to != null, 'residency and location history were not recorded on the move');
check(mayVote('pt') !== '', 'a resident who is not a citizen should not be able to vote');
check(!cit.naturalisation(p).possible && /years of residence/.test(cit.naturalisation(p).why), 'citizenship should need years of residence first');
// Marrying a citizen shortens the wait and confers nothing by itself.
const spouse = makeNpc({ role: 'spouse', countryId: 'pt', age: 30 }); store.state.npcs[spouse.id] = spouse; p.npcIds.push(spouse.id);
check(cit.held(p).join() === 'br' && cit.naturalisation(p).spouse && cit.naturalisation(p).needs === 3, 'marriage should shorten the wait to three years and grant nothing');
for (let i = 0; i < 6; i++) year();
const n = cit.naturalisation(p);
check(n.possible && n.mustRenounce.length === 0, `after six years a spouse should be eligible (${n.why})`);
for (let i = 0; i < 12 && !cit.held(p).includes('pt'); i++) { p.flags.natAge = null; p.finance.cash += 5000; cit.naturalise(); }
check(cit.held(p).sort().join() === 'br,pt' && cit.residency(p).status === 'citizen' && mayVote('pt') === '', 'naturalized: both citizenships, citizen status, and a vote');
section('moving, residency, marriage and naturalization keep birthplace, residence and citizenship apart');

// 3. Single-nationality places.
p = life('fr', 40); p.countryId = 'jp'; p.flags.arrivedYear = store.state.year - 9; p.finance.cash = 9e6;
let nat = cit.naturalisation(p);
check(nat.possible && nat.mustRenounce.join() === 'fr', 'becoming Japanese should mean giving up French citizenship');
for (let i = 0; i < 12 && !cit.held(p).includes('jp'); i++) { p.flags.natAge = null; cit.naturalise(); }
check(cit.held(p).join() === 'jp' && p.citizenships.find((c) => c.jurisdictionId === 'fr').lostAt != null, 'the lost citizenship should be kept in the record, marked as lost');
p = life('in', 40); p.countryId = 'ca'; p.flags.arrivedYear = store.state.year - 5; p.finance.cash = 1e5;
nat = cit.naturalisation(p);
check(nat.possible && nat.willLose.join() === 'in' && nat.mustRenounce.length === 0, 'an Indian citizen who becomes Canadian loses Indian citizenship by India\'s rule');
section('places that allow one nationality are honored in both directions');

// 4. Money in several currencies: nothing is created, and what was done is written down.
p = life('us', 35); p.finance.cash = 100000; p.flags.livesWithParents = false;
store.state.fx = {};
const before = netWorth(store.state);
let x = fx.exchange('USD', 'MXN', 40000);
check(x.ok && p.finance.cash === 60000 && p.finance.accounts.MXN === Math.floor(40000 * fx.rate('USD', 'MXN') * (1 - fx.FX_FEE)), 'exchange did not move the right amounts');
check(netWorth(store.state) <= before && netWorth(store.state) >= before * 0.97, `changing money should cost the fee and no more (${before} → ${netWorth(store.state)})`);
const mxn = p.finance.accounts.MXN;
x = fx.exchange('MXN', 'USD', mxn);
check(p.finance.cash < 100000 && p.finance.cash > 96000 && !p.finance.accounts.MXN, `there and back should lose two fees, not gain (${p.finance.cash})`);
check(p.finance.fxLog.length === 2 && p.finance.fxLog[0].rate > 0 && p.finance.fxLog[0].from === 'USD' && p.finance.fxLog[1].received === p.finance.cash - 60000, 'the exchange record is wrong');
check(!fx.exchange('USD', 'MXN', 1e9).ok && !fx.exchange('USD', 'USD', 5).ok && !fx.exchange('USD', 'XXX', 5).ok && !fx.exchange('USD', 'MXN', -5).ok, 'an impossible exchange went through');
// A hundred round trips never create money.
p.finance.cash = 100000; let last = 100000;
for (let i = 0; i < 100; i++) { fx.exchange('USD', 'JPY', Math.floor(p.finance.cash)); fx.exchange('JPY', 'USD', p.finance.accounts.JPY); check(p.finance.cash <= last, 'a round trip created money'); last = p.finance.cash; }
// Rates drift but stay sane, and a recorded rate does not change afterwards.
const logged = p.finance.fxLog[0].rate;
for (let i = 0; i < 300; i++) fx.tickFx();
check(Object.values(store.state.fx).every((v) => v >= 0.7 && v <= 1.4 && Number.isFinite(v)) && p.finance.fxLog[0].rate === logged, 'rates left their bounds, or history was rewritten');
// Different dollars are different money.
check(fx.fmt(100, 'USD') !== fx.fmt(100, 'CAD') && fx.fmt(100, 'HKD') !== fx.fmt(100, 'AUD') && fx.convert(100, 'USD', 'CAD') !== 100, 'dollars of different countries are being confused');
section('exchanging money costs a fee, never creates money, and keeps the rate it used');

// 5. Moving with money in two currencies; dying with it.
p = life('us', 35); p.finance.cash = 200000; p.flags.livesWithParents = false; store.state.fx = {};
for (let i = 0; i < 30 && p.countryId === 'us'; i++) { p.flags.visaAge = null; move.emigrate('mx', { keep: 0.5 }); }
check(p.countryId === 'mx' && p.finance.accounts.USD > 80000 && p.finance.accounts.USD <= 100000 && p.finance.cash > 80000 * fx.rate('USD', 'MXN') * 0.9, `half should stay in USD and half arrive as pesos (USD ${p.finance.accounts?.USD}, MXN ${p.finance.cash})`);
const worth = netWorth(store.state);
check(Math.abs(worth - (p.finance.cash + fx.convert(p.finance.accounts.USD, 'USD', 'MXN'))) < 5, 'net worth should count both currencies, once');
p.flags.visaAge = null; for (let i = 0; i < 30 && p.countryId === 'mx'; i++) { p.flags.visaAge = null; p.age += 0; move.emigrate('us', {}); }
check(p.countryId === 'us' && !p.finance.accounts.USD && cit.locations(p).length === 3, 'coming home should fold the USD account back into everyday money, and add to the location history');
p.finance.accounts = { EUR: 5000, JPY: 1000000 };
const w0 = netWorth(store.state);
fx.settleEstate();
check(Object.keys(p.finance.accounts).length === 0 && Math.abs(netWorth(store.state) - w0) < 5, 'settling an estate should neither lose nor double foreign money');
section('a move can leave money behind in the old currency; net worth and estates count it once');

// 6. Children, and lives saved before any of this existed.
p = life('kr', 30); p.countryId = 'us'; p.flags.arrivedYear = store.state.year - 2;
const other = makeNpc({ role: 'spouse', countryId: 'us', age: 30 });
check(ids(cit.atBirth(p.countryId, [cit.held(p), cit.held(other)], store.state.year)) === 'kr,us', 'the child of a Korean and an American, born in the United States, should hold both');
check(cit.held(other).join() === 'us' && other.bornIn === 'us', 'people the game creates should have a place they are from');
delete p.citizenships; delete p.locations; delete p.residency; p.birthCountryId = 'kr';
check(cit.held(p).join() === 'kr' && cit.locations(p).length === 2 && cit.residency(p).status === 'permanent_resident' && cit.papers(p).citizenships.length === 1, 'an older save should still have papers');
section('children take after both parents and the place; older saves still load');

for (const m of ok) console.log(`ok   ${m}`);
if (problems.length) { console.log([...new Set(problems)].join('\n')); console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Papers and money are in order.');
