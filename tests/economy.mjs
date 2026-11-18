// Checks the world that moves by itself: economies, crises, news, and people who move. Run with: node tests/economy.mjs
import { ROOTS } from '../js/data/economy.js';
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { COUNTRIES, COUNTRY_LIST } from '../js/data/countries.js';
import { LIVING, BASE_LIVING, CRISES } from '../js/data/living.js';
import { PHASES, TURN, CRISIS_END, CRISIS_START, CRISIS_FX } from '../js/data/economy.js';
import * as econ from '../js/engine/economy.js';
import { routes } from '../js/engine/immigration.js';
import { mayLeave } from '../js/engine/living.js';
import { tickFx, unitsPerBase } from '../js/engine/currency.js';
import { makeNpc } from '../js/engine/npcFactory.js';
import { profile } from '../js/engine/world.js';

rng.seed(90210);
ROOTS.parentFromAbroad = 0; // these checks are about plain families; families with roots abroad are tested in world-scenarios.mjs
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (id, age = 25) => { do { store.state = createLife({ countryId: id }); } while (store.state.player.royal); const p = store.state.player; p.age = age; p.birthYear = store.state.year; store.state.year += age; p.flags.livesWithParents = false; p.education.enrolled = false; return p; };
// The world only turns while the player lives (advanceYear returns for the dead): a death on the road or at work would
// freeze it for the rest of a long run, so the test life is brought back.
const year = () => { if (!store.state.player.alive) { store.state.player.alive = true; store.state.over = false; } advanceYear(); store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = 90; };

// 1. Tables.
for (const [from, o] of Object.entries(TURN)) { check(!!PHASES[from], `unknown phase ${from}`); for (const [to, ch] of Object.entries(o)) check(!!PHASES[to] && ch > 0 && ch < 1, `bad turn ${from}→${to}`); }
for (const k of Object.keys(CRISES)) check(!!CRISIS_END[k] && CRISIS_FX[k] != null, `crisis ${k} has no way of ending, or no effect on the currency`);
for (const k of Object.keys(CRISIS_START.kinds)) check(!!CRISES[k], `a crisis that can start but does not exist: ${k}`);
section('tables: phases, turns and crises all name real things');

// 2. Without a save the reference data shows through, untouched.
store.state = null;
check(LIVING.ua.crisis === BASE_LIVING.ua.crisis && LIVING.ve.inflation === BASE_LIVING.ve.inflation, 'with no life loaded, a place is as the reference data has it');
check(!profile('ua').game.some(([k]) => k === 'Economy now'), 'and the explorer does not invent an economy for it');
section('reference: unchanged, and readable with no life loaded');

// 3. A long run: the world moves, believably, and says so in good order.
const before = JSON.stringify(BASE_LIVING);
let p = life('ve', 20);
const startCrises = COUNTRY_LIST.filter((c) => LIVING[c.id].crisis).length;
const seen = { boom: 0, steady: 0, slump: 0 };
for (let i = 0; i < 70; i++) { try { year(); } catch (err) { problems.push(`year ${i} failed: ${err.message}`); break; } for (const c of COUNTRY_LIST) seen[econ.phaseOf(c.id)] += 1; }
const total = seen.boom + seen.steady + seen.slump;
check(seen.steady / total > 0.45 && seen.boom / total > 0.08 && seen.slump / total > 0.06 && seen.slump / total < 0.35, `most years are steady, with booms and recessions (${JSON.stringify(seen)})`);
const w = store.state.world;
const kinds = w.news.reduce((m, n) => ({ ...m, [n.kind]: (m[n.kind] ?? 0) + 1 }), {});
check(w.news.length > 30 && w.news.length <= 150, `news was kept, and capped (${w.news.length})`);
for (const n of w.news) { check(/^[A-Z]/.test(n.text) && !/undefined|\{|NaN/.test(n.text) && n.year, `badly worded news: ${n.text}`); check(n.placeId == null || !!COUNTRIES[n.placeId], `news about nowhere: ${n.text}`); }
const ended = Object.values(w.places).filter((e) => 'crisis' in e && e.crisis === null).length;
const endCrises = COUNTRY_LIST.filter((c) => LIVING[c.id].crisis).length;
check(ended >= 2, `over seventy years some crises ended (${ended})`);
check(endCrises >= 1 && endCrises <= startCrises + 8, `the world neither heals completely nor falls apart (${startCrises} crises at the start, ${endCrises} at the end)`);
check(JSON.stringify(BASE_LIVING) === before, 'the reference data was not rewritten');
for (const c of COUNTRY_LIST) check(['low', 'high', 'extreme'].includes(LIVING[c.id].inflation) && (LIVING[c.id].crisis === null || !!CRISES[LIVING[c.id].crisis]), `${c.id}: illegal crisis or inflation`);
section(`a seventy-year run: ${w.news.length} items of news (${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(', ')}); ${ended} crises ended`);

// 4. The save carries the world; a new life starts from the reference.
const saved = JSON.parse(JSON.stringify(store.state));
const changed = COUNTRY_LIST.find((c) => LIVING[c.id].crisis !== BASE_LIVING[c.id].crisis);
check(!!changed, 'something changed that can be checked');
if (changed) {
  const now = LIVING[changed.id].crisis;
  life('us'); check(LIVING[changed.id].crisis === BASE_LIVING[changed.id].crisis, 'a new life sees the reference world again');
  store.state = saved; check(LIVING[changed.id].crisis === now, 'a loaded save sees its own');
}
section('saves: each life has its own world');

// 5. What a change means in play.
p = life('ua', 30); p.gender = 'male'; p.flags.bornAs = 'male'; p.finance.cash = 1e7;
if (BASE_LIVING.ua.crisis === 'war') {
  check(!mayLeave().ok && routes('pl').find((r) => r.id === 'protection').eligible, 'at war: men may not leave, and protection abroad is open');
  store.state.world = { places: { ua: { phase: 'steady', since: store.state.year, crisis: null } }, news: [] };
  check(mayLeave().ok && !routes('pl').find((r) => r.id === 'protection').eligible, 'peace: the border opens, and the protection route closes');
}
p = life('us', 30);
store.state.world = { places: { us: { phase: 'slump', since: store.state.year } }, news: [] };
check(econ.hiringClimate() < 0 && econ.layoffChance() > 0.03 && econ.housingDrift() < 0 && econ.outlook().name === 'Recession', 'a recession: harder to be hired, easier to be laid off, houses fall');
check(econ.fxBias('USD') > 0 && econ.fxBias('JPY') === 0, 'and the currency is pulled weaker, others are not');
const u0 = unitsPerBase('USD'); for (let i = 0; i < 25; i++) tickFx();
check(unitsPerBase('USD') > u0 * 0.98, 'which shows in the rate over time');
store.state.world.places.us.phase = 'boom';
check(econ.hiringClimate() > 0 && econ.layoffChance() < 0.012 && profile('us').game.some(([k, v]) => k === 'Economy now' && v === 'Boom'), 'a boom does the opposite, and the explorer shows it');
section('in play: crises and phases change borders, routes, hiring, layoffs, houses and the currency');

// 6. News reaches the player only where they have ties.
p = life('us', 30); const kin = makeNpc({ role: 'sibling', countryId: 'us', age: 33 }); kin.flags.abroad = 'jp'; store.state.npcs[kin.id] = kin; p.npcIds.push(kin.id);
check(econ.ties().has('us') && econ.ties().has('jp') && !econ.ties().has('fr'), 'ties: home and where family lives');
const j0 = store.state.journal.length;
econ.post('fr', 'economy', 'France: a test.'); check(store.state.journal.length === j0, 'news from elsewhere stays out of the journal');
econ.post('jp', 'economy', 'Japan: a test.'); check(store.state.journal.length === j0 + 1, 'news from where a sister lives is in it');
check(econ.news().length === 2 && econ.news()[0].yours && !econ.news()[1].yours, 'the news list marks what is yours');
section('news: everything is recorded; the journal carries only what touches the player');

// 7. People move.
let left = 0; let back = 0; let near = 0; let minors = 0;
for (let k = 0; k < 30; k++) {
  p = life(k % 2 ? 've' : 'pl', 30);
  for (let i = 0; i < 6; i++) { const n = makeNpc({ role: i % 2 ? 'friend' : 'sibling', countryId: p.countryId, age: 25 + i }); n.meters.relationship = 80; store.state.npcs[n.id] = n; p.npcIds.push(n.id); }
  const kid = makeNpc({ role: 'child', countryId: p.countryId, age: 3 }); store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id);
  for (let i = 0; i < 14; i++) { econ.tickMoves(); if (typeof kid.flags.abroad === 'string') minors += 1; }
  const j = store.state.journal.map((x) => x.text).join(' | ');
  left += (j.match(/has moved to (?!.*nearer)/g) ?? []).length; back += (j.match(/has come home/g) ?? []).length; near += (j.match(/nearer to you/g) ?? []).length;
  for (const n of Object.values(store.state.npcs)) check(!n.flags.abroad || (typeof n.flags.abroad === 'string' && !!COUNTRIES[n.flags.abroad] && n.flags.abroad !== p.countryId), 'someone is abroad in the country the player lives in, or nowhere');
}
check(left >= 6 && left <= 150, `some brothers, sisters and friends move abroad (${left} in thirty lives of fourteen years)`);
check(back + near >= 1, `and some come back (${back} home, ${near} to be near)`);
check(minors === 0, 'small children do not emigrate on their own');
section(`people: ${left} moved away, ${back} came home, ${near} moved nearer`);

// 8. Wars can begin, rarely, and only in a deeply unstable country; never as one named country against another.
{
  const { WAR_START } = await import('../js/data/economy.js');
  const { COUNTRY_LIST: ALL } = await import('../js/data/countries.js');
  p = life('pl', 30);
  const saved = WAR_START.chance; WAR_START.chance = 0.25;
  for (let i = 0; i < 12; i++) econ.tickEconomy();
  WAR_START.chance = saved;
  const begun = store.state.world.news.filter((n) => n.kind === 'crisis' && /Armed conflict has broken out/.test(n.text));
  check(begun.length > 0, 'with the odds raised, wars begin');
  for (const n of begun) {
    check(LIVING[n.placeId] && BASE_LIVING[n.placeId] && (LIVING[n.placeId].stability ?? 100) < WAR_START.below, `a war began somewhere stable: ${n.placeId}`);
    const others = ALL.filter((c) => c.id !== n.placeId && n.text.includes(c.name));
    check(!others.length, `a war's report names another country: ${n.text}`);
  }
  // At war: men of fighting age may not leave, and the protection route opens for the country's citizens.
  const at = begun[0]?.placeId;
  if (at) {
    p = life(at, 30); p.gender = 'male'; p.flags.bornAs = 'male'; p.finance.cash = 1e9;
    store.state.world = { places: { [at]: { phase: 'slump', since: store.state.year, crisis: 'war', crisisSince: store.state.year } }, news: [] };
    check(!mayLeave().ok, 'men of fighting age may not leave a country at war');
    const prot = routes('pl').find((r) => r.id === 'protection'); check(prot?.eligible, 'and its citizens may seek protection abroad');
  }
  section(`war: ${begun.length} began in twelve years at raised odds, each in an unstable country, none naming an enemy`);
}

// 9. A family that moves takes no half-finished scenes about the people it left behind.
{
  const { renderText } = await import('../js/engine/eventEngine.js');
  const { EVENT_BY_ID } = await import('../js/data/events/index.js');
  const { ROOTS } = await import('../js/data/economy.js');
  const was = ROOTS.familyLeaves; ROOTS.familyLeaves = 0.5;
  let scenes = 0; let blank = 0; let moved = 0;
  for (let k = 0; k < 16; k++) {
    store.state = createLife({ countryId: ['us', 'br', 'pl', 'in'][k % 4] });
    const start = store.state.player.countryId;
    for (let y = 0; y < 8; y++) {
      advanceYear();
      for (const e of store.state.pendingEvents) { const ev = EVENT_BY_ID[e.id]; if (!ev) continue; scenes += 1; if (/\{[a-z]+\}/.test(renderText(ev.text, e.cast))) blank += 1; }
      store.state.pendingEvents = [];
    }
    if (store.state.player.countryId !== start) moved += 1;
  }
  ROOTS.familyLeaves = was;
  check(moved > 3 && blank === 0, `no scene names someone who is gone (${blank} of ${scenes} scenes, in ${moved} families that moved)`);
  section(`moves: ${moved} families moved; none of ${scenes} scenes named someone left behind`);
}

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 25)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('The world turns.');
