// Checks the legal rule engine: layers, overrides, what it allows, and laws that change. Run with: node tests/rules.mjs
import { ROOTS } from '../js/data/economy.js';
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { COUNTRIES, COUNTRY_LIST } from '../js/data/countries.js';
import { LIVING } from '../js/data/living.js';
import { RULES, PLACE_RULES, REGION_RULES } from '../js/data/rules.js';
import * as law from '../js/engine/rules.js';
import { canGamble } from '../js/engine/gambling.js';
import { mayVote } from '../js/engine/polity.js';
import { activityOptions } from '../js/engine/activities.js';
import { divorce } from '../js/engine/romance.js';
import { makeNpc } from '../js/engine/npcFactory.js';
import { profile } from '../js/engine/world.js';

rng.seed(77001);
ROOTS.parentFromAbroad = 0; // these checks are about plain families; families with roots abroad are tested in world-scenarios.mjs
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (id, age = 30) => { do { store.state = createLife({ countryId: id }); } while (store.state.player.royal); const p = store.state.player; p.age = age; p.birthYear = store.state.year; store.state.year += age; p.finance.cash = 1e6; return p; };

// 1. The tables are well formed.
for (const [id, def] of Object.entries(RULES)) {
  check(['age', 'flag', 'level'].includes(def.kind) && def.name, `rule ${id} is malformed`);
  check(def.kind !== 'age' || Number.isInteger(def.default) || (def.hidden && def.default === null), `rule ${id}: an age must be a whole number`);
  check(def.kind !== 'level' || def.levels.includes(def.default), `rule ${id}: default is not one of its levels`);
  check(!def.from || Object.values(LIVING).every((L) => L.laws[def.from] !== undefined), `rule ${id}: living data lacks ${def.from}`);
}
for (const [place, o] of Object.entries(PLACE_RULES)) {
  check(!!COUNTRIES[place], `rules name an unknown place: ${place}`);
  for (const [id, v] of Object.entries(o)) {
    const def = RULES[id];
    check(!!def && !def.from, `${place}.${id}: unknown rule, or one that belongs in living data`);
    if (def?.kind === 'age') check(Number.isInteger(v) && v >= 10 && v <= 75, `${place}.${id}: not a sensible age (${v})`); // compulsory schooling ends at 10 in some countries
    if (def?.kind === 'flag') check(typeof v === 'boolean', `${place}.${id}: must be true or false`);
  }
}
for (const key of Object.keys(REGION_RULES)) check(!!COUNTRIES[key.split('/')[0]], `regional rules name an unknown place: ${key}`);
section('tables: every rule and every override is well formed');

// 2. Every place answers every question, with a value of the right kind.
life('us');
for (const c of COUNTRY_LIST) for (const row of law.sheet(c.id)) {
  check(row.text && row.value !== undefined, `${c.id}.${row.id} has no answer`);
  check(RULES[row.id].kind !== 'age' || Number.isInteger(row.value), `${c.id}.${row.id} is not a whole number`);
}
section(`coverage: ${COUNTRY_LIST.length} places answer all ${Object.keys(RULES).length} rules`);

// 3. Layers: default, parent, place, region, enacted.
check(law.source('drinkingAge', 'mx').source === 'default' && law.rule('drinkingAge', 'mx') === 18, 'no override: the default');
check(law.rule('drinkingAge', 'us') === 21 && law.source('drinkingAge', 'us').source === 'place', 'a place overrides the default');
check(law.rule('retirementAge', 'pr') === law.rule('retirementAge', 'us') && law.source('retirementAge', 'pr').source === 'parent', 'a territory starts from the state it belongs to');
check(law.rule('drinkingAge', 'pr') === 18 && law.source('drinkingAge', 'pr').source === 'place', 'and overrides it where it differs');
check(law.rule('sameSexMarriage', 'jp') === LIVING.jp.laws.marriage && law.rule('deathPenalty', 'us', { region: null }) === LIVING.us.laws.deathPenalty, 'the five older flags still come from living data');
check(law.lawsOf('ng').lgbt === 'hostile', 'older code gets the shape it expects');
REGION_RULES['us/test'] = { gamblingAge: 18, gambling: false };
check(law.rule('gamblingAge', 'us', { region: 'test' }) === 18 && law.rule('gambling', 'us', { region: 'test' }) === false && law.rule('gamblingAge', 'us', { region: null }) === 21, 'a region overrides its place, for that region only');
check(law.sheet('us', { region: 'test' }).find((r) => r.id === 'gambling').note === 'local law', 'and says so');
let p = life('us'); p.regionId = 'test';
check(!canGamble() && /against the law/.test(law.may('gamble').why), 'the region the player lives in is the one that counts');
delete REGION_RULES['us/test'];
section('layers: default, parent state, place, region, each overriding the last');

// 4. What the law allows, in play.
p = life('us', 19); p.regionId = 'illinois'; // casinos from 21 (New York, Washington and Georgia admit from 18)
check(!canGamble() && /21/.test(law.may('gamble').why) && !activityOptions().some((a) => a.id === 'night'), 'at 19 in the United States: no casino, no bar');
p = life('uk', 19); check(canGamble() && activityOptions().some((a) => a.id === 'night'), 'at 19 in the United Kingdom: both');
p = life('sa', 30); check(!law.may('drink').ok && /banned/.test(law.may('drink').why) && !activityOptions().some((a) => a.id === 'night'), 'no night out where alcohol is banned');
p = life('br', 16); check(mayVote() === '' || !/too young/.test(mayVote()), 'sixteen-year-olds vote in Brazil');
p = life('us', 16); check(/too young/.test(mayVote()), 'but not in the United States');
check(law.may('drive').ok, 'though they may drive there'); p = life('de', 16); check(!law.may('drive').ok, 'and not in Germany');
p = life('jp', 30); p.gender = 'female';
check(!law.may('marry', { partner: { gender: 'female' } }).ok && law.may('marry', { partner: { gender: 'male' } }).ok, 'marriage follows the law of the place');
p = life('ph', 35); const s = makeNpc({ role: 'spouse', countryId: 'ph', age: 34 }); store.state.npcs[s.id] = s; p.npcIds.push(s.id); p.counters.spouses = 1;
const r1 = divorce(s.id); const r2 = r1.ok ? null : divorce(s.id);
check(r1.ok ? /annulled/.test(r1.text) : /no divorce/.test(r1.text) && /next year/.test(r2.text), 'no divorce in the Philippines: an annulment, once a year');
p = life('in', 19); p.gender = 'female'; check(law.may('marry').ok, 'a woman of 19 may marry in India'); p.gender = 'male'; check(!law.may('marry').ok && /21/.test(law.may('marry').why), 'a man of 19 may not: the law sets 21 for men');
check(/21 for men, 18 for women/.test(law.sheet('in').find((r) => r.id === 'marriageAge').text), 'and the law card says so');
for (const c of COUNTRY_LIST) for (const g of ['male', 'female']) { p = store.state.player; p.countryId = c.id; p.gender = g; p.age = 17; check(!law.may('marry').ok, `${c.id}: nobody marries at 17 in the game, whatever the law allows`); }
section('in play: ages and bans decide what is offered, with the reason');

// 5. Laws change, are remembered, and never produce an illegal value.
p = life('jp', 30);
const e = law.enact('jp', 'sameSexMarriage', true);
check(law.rule('sameSexMarriage', 'jp') === true && law.source('sameSexMarriage', 'jp').source === 'enacted' && /legalized same-sex marriage/.test(e.text), 'an enacted law overrides everything, and reads properly');
check(law.may('marry', { partner: { gender: p.gender } }).ok, 'and takes effect at once');
check(profile('jp').lawChanges.length === 1 && profile('jp').laws.some(([k, v]) => k === 'Same-sex marriage' && /changed in/.test(v)), 'the world explorer shows the change');
check(LIVING.jp.laws.marriage === false, 'the reference data is not rewritten: the change lives in the save');
const saved = JSON.parse(JSON.stringify(store.state)); life('jp'); check(law.rule('sameSexMarriage', 'jp') === false, 'a new life starts from the reference law');
store.state = saved; check(law.rule('sameSexMarriage', 'jp') === true, 'a loaded save keeps its own');
let changes = 0;
for (let k = 0; k < 6; k++) {
  p = life(['us', 'eg', 'kr', 'ph', 'pl', 'ng'][k], 20);
  for (let i = 0; i < 60 && p.alive !== false && !store.state.over; i++) { try { advanceYear(); } catch (err) { problems.push(`year failed: ${err.message}`); break; } store.state.pendingEvents = []; p.legal.pending = null; p.stats.health = 90; }
  for (const h of law.reforms()) {
    changes += 1;
    const def = RULES[h.id];
    check(h.from !== h.to, `a reform changed nothing: ${h.text}`);
    check(def.kind !== 'level' || def.levels.includes(h.to), `illegal level: ${h.text}`);
    check(def.kind !== 'flag' || typeof h.to === 'boolean', `illegal flag: ${h.text}`);
    check(/^[A-Z]/.test(h.text) && !/undefined/.test(h.text), `badly worded: ${h.text}`);
  }
}
check(changes >= 3 && changes <= 60, `over six sixty-year lives the world changed its laws a believable number of times (${changes})`);
section(`change: enacted law is kept in the save; ${changes} reforms across six lives, all well formed`);

// 6. Every law is checked against its source (scripts/verify-laws.py), and nothing disagrees unexplained.
{
  const { LAW_CHECKED } = await import('../js/data/lawVerification.js');
  const { COUNTRY_LIST: ALL } = await import('../js/data/countries.js');
  let ok = 0; let review = 0;
  for (const c of ALL) {
    const r = LAW_CHECKED[c.id];
    check(!!r && Object.keys(r).length >= 10, `${c.id}: no law verification (run scripts/verify-laws.py --write)`);
    for (const [k, v] of Object.entries(r ?? {})) { check(v.status !== 'mismatch', `${c.id}.${k} disagrees with its source: ${v.note ?? ''}`); if (v.status === 'ok') ok += 1; if (v.status === 'review') review += 1; }
  }
  section(`verification: ${ok} laws confirmed against sources, ${review} differ for recorded reasons, none disagree unexplained`);
}

// 7. Regional law, as checked against its sources (data/rules.js REGION_RULES).
{
  const at = (id, place, region) => law.rule(id, place, { region });
  check(at('deathPenalty', 'us', 'texas') === true && at('deathPenalty', 'us', 'new_york') === false && at('deathPenalty', 'us', 'colorado') === false, 'US: Texas keeps the death penalty; New York and Colorado do not');
  check(at('gamblingAge', 'us', 'georgia') === 18 && at('gamblingAge', 'us', 'illinois') === 21, 'US: the casino age is 18 in Georgia, 21 in Illinois');
  check(at('gamblingAge', 'ca', 'ontario') === 19 && at('gamblingAge', 'ca', 'quebec') === 18 && at('drinkingAge', 'ca', 'quebec') === 18 && at('drinkingAge', 'ca', 'ontario') === 19, 'Canada: ages by province');
  check(at('gamblingAge', 'de', 'bavaria') === 21 && at('gamblingAge', 'de', 'berlin') === 18, 'Germany: casinos from 21 in Bavaria, 18 in Berlin');
  check(at('drinkingAge', 'in', 'delhi') === 25 && at('drinkingAge', 'in', 'maharashtra') === 25 && at('drinkingAge', 'in', 'west_bengal') === 21, 'India: 25 in Delhi and Maharashtra, 21 elsewhere');
  check(at('alcohol', 'ae', 'sharjah') === false && at('drinkingAge', 'ae', 'dubai') === 21 && at('drinkingAge', 'ae', 'ras_al_khaimah') === 18, 'UAE: dry Sharjah, 21 in Dubai, 18 in Ras Al Khaimah');
  check(at('alcohol', 'ng', 'around:Kano') === false && at('alcohol', 'ng', 'around:Lagos') === true, 'Nigeria: alcohol banned in Kano, not in Lagos');
  check(law.rule('drinkingAge', 'my', { region: null }) === 21 && law.rule('drinkingAge', 'py', { region: null }) === 20, 'Malaysia 21 and Paraguay 20');
  for (const key of Object.keys(REGION_RULES)) {
    const [place, region] = key.split('/');
    const cities = COUNTRIES[place]?.cities ?? [];
    check(cities.some((c) => law.lawRegion(place, c) === region), `${key}: no city in the game lies in this region`);
  }
  section('regional law: the checked values, and every region named has a city in the game');
}

if (problems.length) { console.log('PROBLEMS:'); for (const x of problems) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('The law is in order.');
