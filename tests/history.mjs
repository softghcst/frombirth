// Lives in the past: prices shown at the level of their year, and history
// (depressions, wars, call-ups, conscription, the news) happening to them.
//   node tests/history.mjs
import { store } from '../js/state.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { fmtMoney, priceLevel } from '../js/util.js';
import { COUNTRIES } from '../js/data/countries.js';
import { HISTORY, PRESENT, PRICE_INDEX } from '../js/data/history.js';
import { rule } from '../js/engine/rules.js';
import { phaseOf } from '../js/engine/economy.js';
import { tickHistory, underWay } from '../js/engine/history.js';

const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const step = (s) => { advanceYear(); s.pendingEvents = []; const p = s.player; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 70); };

// 1. Prices.
check(PRICE_INDEX.every(([y], i) => i === 0 || y > PRICE_INDEX[i - 1][0]) && PRICE_INDEX.at(-1)[0] === PRESENT && PRICE_INDEX.at(-1)[1] === 1, 'the price index runs in order up to the present');
check(priceLevel(1950) < priceLevel(1980) && priceLevel(1980) < priceLevel(2010) && priceLevel(PRESENT) === 1 && priceLevel(PRESENT + 30) === 1, 'prices rise to today\'s, and stay there');
store.state = { year: 1950 };
const then = fmtMoney(45000, COUNTRIES.us);
store.state = { year: PRESENT + 1 };
const now = fmtMoney(45000, COUNTRIES.us);
check(then === '$3,375' && now === '$45,000', `a typical wage reads ${then} in 1950 and ${now} today`);
store.state = { year: 1950 };
check(fmtMoney(4, COUNTRIES.uk) === '£0.30', `small sums keep their pennies (${fmtMoney(4, COUNTRIES.uk)})`);
section('prices: shown at the level of their year, today\'s from the present on');

// 2. A life from 1920: the Depression, the war, the draft, the end of it.
let s = createLife({ countryId: 'us', startYear: 1920, gender: 'male' });
store.state = s;
let p = s.player;
p.gender = 'male';
const seen = { slump1931: false, draft1950: false, noDraft1980: true, callUps: 0, war: false };
for (let i = 0; i < 62 && p.alive; i++) {
  advanceYear();
  if (s.pendingEvents.some((e) => e.id === 'call_up_papers')) seen.callUps += 1;
  s.pendingEvents = []; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 85);
  if (s.year === 1931) seen.slump1931 = phaseOf('us') === 'slump';
  if (s.year === 1950) seen.draft1950 = rule('conscription', 'us') === true;
  if (s.year === 1980 && rule('conscription', 'us')) seen.noDraft1980 = false;
  if (s.year >= 1941 && s.year <= 1945 && p.countryId !== 'us') seen.left = true;
  if (s.year === 1943) seen.war = underWay(1943, 'us').some((ev) => ev.kind === 'draft');
}
check(seen.slump1931 || seen.left, 'the Great Depression: the economy is in a slump in 1931');
check(seen.draft1950, 'the draft is the law in 1950');
check(seen.noDraft1980, 'and ended by 1980');
check(seen.war, 'the United States was at war in 1943');
check(!p.alive || seen.left || seen.callUps >= 1, `a young American man was called up (${seen.callUps} times)`);
check(s.journal.some((j) => /walked on the Moon/.test(j.text)), 'he remembers the Moon landing');
section(`a life from 1920: the Depression, ${seen.callUps} call-ups, the draft, the Moon`);

// 3. Women are not called up; a life begun in a war finds it under way; the present has no history to meet.
s = createLife({ countryId: 'uk', startYear: 1920, gender: 'female' });
store.state = s;
p = s.player;
p.gender = 'female';
let calls = 0;
for (let i = 0; i < 30 && p.alive; i++) { advanceYear(); if (s.pendingEvents.some((e) => e.id === 'call_up_papers')) calls += 1; step(s); }
check(calls === 0, 'women are not called up');
s = createLife({ countryId: 'uk', startYear: 1942 });
store.state = s;
step(s);
check(rule('conscription', 'uk') === true && phaseOf('uk') === 'slump', 'a life begun in 1942 finds Britain at war, with national service');
s = createLife({ countryId: 'us' });
store.state = s;
const lines = tickHistory();
check(lines.length === 0 && !rule('conscription', 'us'), 'a life begun today has no history to meet');
check(HISTORY.every((ev) => ev.year < PRESENT && (ev.until ?? ev.year) <= PRESENT), 'every event is in the past');
section('history: men of age called up, women not; mid-war starts; nothing for lives begun today');

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 30)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('History is what happened.');
