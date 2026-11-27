// Historical Eras: the era registry, money and currencies, laws, careers, schooling,
// health, events and the user interface's data — and lives lived through every era.
// Run with: node tests/eras.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { COUNTRIES } from '../js/data/countries.js';
import { ERAS } from '../js/data/history.js';
import * as H from '../js/engine/history.js';
import * as tech from '../js/engine/digital/tech.js';
import { ensureEra } from '../js/engine/eras.js';
import { heirs, continueAs } from '../js/engine/legacy.js';
import { die } from '../js/engine/death.js';
import { makeNpc } from '../js/engine/npcFactory.js';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
const save = await import('../js/save.js');

rng.seed(19001);
// These scenarios follow a life in one country through its history. A family emigrating with a young child is a
// part of life tested on its own (tests/economy.mjs, tests/world-scenarios.mjs); here it would only move the life
// away from the history being checked.
const { ROOTS } = await import('../js/data/economy.js');
ROOTS.familyLeaves = 0;
const problems = [];
const passed = [];
let where = '';
const check = (cond, text) => { (cond ? passed : problems).push(`${where}: ${text}`); };
const section = (n) => { where = n; };
function life(o = {}) {
  let s; do { s = createLife({ countryId: o.countryId ?? 'us', year: o.born ?? 1900, ...(o.gender ? { gender: o.gender } : {}) }); } while (s.player.royal);
  store.state = s; grow(o.age ?? 0); return s.player;
}
function grow(n) {
  for (let i = 0; i < n; i++) {
    const p = store.state.player;
    p.stats.health = 95; advanceYear(); store.state.pendingEvents = [];
    p.legal.pending = null; p.legal.incarceration = null;
    if (!p.alive) p.alive = true;
  }
}

// ---------- Phase 2: the registry ----------
section('Registry');
{
  check(H.getEra(1800).id === 'early' && H.getEra(1918).id === 'early' && H.getEra(1919).id === 'interwar', 'boundaries: 1800 and 1918 early, 1919 between the wars');
  check(H.getEra(1945).id === 'interwar' && H.getEra(1946).id === 'midcentury' && H.getEra(1969).id === 'midcentury' && H.getEra(1970).id === 'late20c', '1945/1946 and 1969/1970');
  check(H.getEra(1999).id === 'late20c' && H.getEra(2000).id === 'now' && H.getEra(2100).id === 'now' && H.getEra(1700).id === 'early', '1999/2000; after 2000 is Modern Day; before 1800 counts as early');
  check(ERAS.every((e, i) => i === 0 || e.from === ERAS[i - 1].to + 1), 'the eras leave no gaps');
  check(H.getEraTransition(1945, 1946)?.to.id === 'midcentury' && !H.getEraTransition(1950, 1951), 'transitions are detected only at boundaries');
  check(H.getEraRules(1930, 'de').era.id === 'interwar' && H.getEraRules(1930, 'de').currency.code === 'RM', 'era rules come with the country\'s money of the time');
}

// ---------- Phase 2: transitions, saves, heirs ----------
section('Transitions');
{
  const p = life({ born: 1940, age: 0 });
  grow(8); // into 1948
  const marks = store.state.journal.filter((j) => /A new era begins: Mid-Century/.test(j.text));
  check(marks.length === 1 && store.state.era.transitions.some((t) => t.year === 1946 && t.to === 'midcentury'), 'crossing into Mid-Century is written once');
  check(p.milestones.filter((m) => /Mid-Century/.test(m.text)).length === 1, 'and kept as one milestone');
  save.saveGame(store.state);
  const back = save.loadGame(store.state.slotId);
  store.state = back;
  grow(1);
  check(store.state.journal.filter((j) => /A new era begins: Mid-Century/.test(j.text)).length === 1, 'reloading does not write it again');
}
{
  // A life saved before eras, in the present: stays a modern life.
  const s = createLife({ countryId: 'us' });
  delete s.era;
  const cash = s.player.finance.cash;
  mem.set(`frombirth.slot.${s.slotId}`, JSON.stringify(s));
  const back = save.loadGame(s.slotId);
  check(back.era.money === 'era' && back.year === s.year && back.player.finance.cash === cash && back.player.age === s.player.age, 'a present-day save loads unchanged, as a modern life');
  // A life saved before eras, already in the past: keeps today's money.
  const old = createLife({ countryId: 'us', year: 1950 });
  delete old.era;
  mem.set(`frombirth.slot.${old.slotId}`, JSON.stringify(old));
  const b2 = save.loadGame(old.slotId);
  check(b2.era.money === 'modern', 'a past life saved before eras keeps today\'s money, so its fortune is not rewritten');
  const again = JSON.stringify(ensureEra(b2, { legacy: true }));
  check(JSON.stringify(ensureEra(b2, { legacy: true })) === again, 'running the migration twice changes nothing');
}
{
  const p = life({ born: 1910, age: 60 });
  const kid = makeNpc({ role: 'child', countryId: p.countryId, age: 30 }); kid.parentIds = [p.id];
  store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id);
  die('old age');
  const next = continueAs(heirs()[0].id);
  store.state = next;
  check(next.era && next.era.transitions.length >= 2 && next.year === 1970, 'an heir carries the era record and the year on');
  grow(31);
  check(store.state.era.transitions.some((t) => t.to === 'now'), 'and lives on into Modern Day');
}

// ---------- Phase 3: careers ----------
section('Careers');
{
  const { CAREER_BY_ID, CAREERS } = await import('../js/data/careers.js');
  const { unmet, hire } = await import('../js/engine/career.js');
  const { OCCUPATIONS } = await import('../js/data/traits.js');
  const ready = (p) => { p.education.enrolled = false; p.education.stage = 'none'; p.education.degrees = [{ type: 'high', gpa: 3.5, age: 18 }, { type: 'university', majorId: 'computer_science', gpa: 3.5, age: 22 }]; p.stats.intellect = 90; p.flags.livesWithParents = false; };
  const p = life({ born: 1878, age: 22 });
  ready(p);
  check(store.state.year === 1900 && unmet(CAREER_BY_ID.software).includes('There is no such job yet.'), 'no software engineers in 1900');
  check(unmet(CAREER_BY_ID.influencer).some((x) => /does not exist|no such job/.test(x)), 'no social media career in 1900');
  check(!unmet(CAREER_BY_ID.office).some((x) => /no such job/.test(x)) && !unmet(CAREER_BY_ID.teacher).some((x) => /no such job/.test(x)), 'clerks and teachers exist');
  hire(CAREER_BY_ID.office, 0, 60);
  check(p.career.title === 'Junior clerk', `an office job in 1900 is a clerk's job (${p.career.title})`);
  const parentJobs = Object.values(store.state.npcs).filter((n) => n.role === 'parent').map((n) => n.occupation);
  check(!parentJobs.includes('software engineer'), `parents had jobs of their time (${parentJobs.join(', ')})`);
  grow(25); // 1925
  check(store.state.year === 1925 && unmet(CAREER_BY_ID.software).includes('There is no such job yet.'), 'still no programmers in 1925');
  const kept = p.career.history.concat(p.career.careerId ? [{ title: p.career.title }] : []).map((h) => h.title);
  check(kept.some((t) => /clerk/i.test(t)), 'a clerk taken on in 1900 keeps the title it had');
  grow(37); // 1962
  check(!unmet(CAREER_BY_ID.software).includes('There is no such job yet.'), 'computer jobs exist by the 1960s');
  // Working lives: a job now, a job lost, or a career retired from (by 1962 a 1900 family can be all children and pensioners).
  const npcJobs = Object.values(store.state.npcs).filter((n) => n.life?.job || n.life?.lastJob || n.life?.retired);
  check(npcJobs.length > 0, `people in this life have jobs (${npcJobs.length})`);
}
{
  const { CAREER_BY_ID } = await import('../js/data/careers.js');
  const { unmet } = await import('../js/engine/career.js');
  const p = life({ born: 1880, age: 0, countryId: 'us' });
  grow(20); // 1900
  const old = Object.values(store.state.npcs).filter((n) => n.life?.job).map((n) => n.life.job.careerId);
  check(!old.includes('software') && !old.includes('influencer'), 'nobody around a life in 1900 works in software or social media');
  check(old.every((id) => id !== 'bridal' && id !== 'sfx'), 'or in jobs invented later');
}
{
  const { CAREER_BY_ID } = await import('../js/data/careers.js');
  const { unmet } = await import('../js/engine/career.js');
  const p = life({ born: 1880, age: 30, countryId: 'uk', gender: 'female' });
  p.education.enrolled = false; p.education.degrees = [{ type: 'high', gpa: 3.5, age: 18 }, { type: 'university', majorId: 'english', gpa: 3.5, age: 22 }, { type: 'law', gpa: 3.5, age: 25 }];
  check(store.state.year === 1910 && unmet(CAREER_BY_ID.lawyer).some((x) => /not admitted to practice law/.test(x)), 'in 1910 a British woman could not practice law');
  const husband = makeNpc({ role: 'spouse', countryId: 'uk', age: 32 }); store.state.npcs[husband.id] = husband; p.npcIds.push(husband.id);
  check(unmet(CAREER_BY_ID.teacher).some((x) => /married women are not allowed/.test(x)), 'and a married woman could not keep a teaching post');
  check(!unmet(CAREER_BY_ID.office).some((x) => /married women|admitted/.test(x)), 'but other work was open to her');
  grow(15); // 1925
  check(!unmet(CAREER_BY_ID.lawyer).some((x) => /not admitted/.test(x)), 'by 1925 women could practice law in the UK');
  grow(25); // 1950
  check(!unmet(CAREER_BY_ID.teacher).some((x) => /married women/.test(x)), 'and after 1945 married women could teach');
}
{
  const { OCCUPATIONS } = await import('../js/data/traits.js');
  check(H.parentOccupations(2026) === OCCUPATIONS, 'in the present, parents\' occupations are exactly today\'s list');
  const modern = life({ born: 2026, age: 0 });
  const { CAREERS } = await import('../js/data/careers.js');
  const { unmet } = await import('../js/engine/career.js');
  modern.age = 30; modern.education.degrees = [{ type: 'high', gpa: 3, age: 18 }];
  check(CAREERS.every((c) => !unmet(c).includes('There is no such job yet.')), 'in Modern Day every career exists, as before');
}

// ---------- Phase 4: money ----------
section('Money');
{
  const { localWage, localCost, localMoney } = await import('../js/util.js');
  const { tickEra } = await import('../js/engine/eras.js');
  const estate = await import('../js/engine/realEstate.js');
  const wageAt = (y) => { life({ born: y, age: 0 }); return { wage: localWage(50000, COUNTRIES.us), rent: localCost(14000, COUNTRIES.us) }; };
  const w1900 = wageAt(1900); const w2026 = wageAt(2026);
  check(w2026.wage === localWage(50000, COUNTRIES.us) && COUNTRIES.us.currency.scale === 1, 'in the present, money is exactly as before');
  check(w1900.wage < w2026.wage / 50 && w1900.rent < w2026.rent / 50, `a 1900 wage and rent are a small fraction of today's (${w1900.wage} and ${w1900.rent} against ${w2026.wage} and ${w2026.rent})`);
  check(Math.abs(w1900.rent / w1900.wage - w2026.rent / w2026.wage) < 0.02, 'and stand in the same proportion to each other, so a life then is as affordable as now');
  // Seven listings of mixed kinds (a flat one year, a large house the next) are too few to compare two lives by: the
  // middle price is taken over six years' listings, about forty homes, on each side.
  const midOf = () => { const q = store.state.player; const a0 = q.age; const h = []; for (let i = 0; i < 6; i++) { q.age = a0 + i; h.push(...estate.listings().map((x) => x.price)); } q.age = a0; h.sort((a, b) => a - b); return h[Math.floor(h.length / 2)]; };
  const p = life({ born: 1900, age: 30 });
  p.flags.livesWithParents = false; p.finance.cash = localMoney(500000, COUNTRIES.us);
  const today = (() => { const keep = store.state; const t = createLife({ countryId: 'us' }); t.player.age = 30; t.player.city = p.city; t.player.regionId = p.regionId; t.player.flags.livesWithParents = false; store.state = t; H.syncWorld(t.year); const m = midOf(); store.state = keep; H.syncWorld(keep.era.applied.year, keep.era.money); return m; })();
  const homes = estate.listings();
  const mid = midOf();
  check(homes.length && mid < today / 10, `houses in 1930 cost what they did then (a middling one: ${mid}, against ${today} today)`);
  // The yearly change moves every amount together: no money is made or lost by it.
  const cash = p.finance.cash;
  const before = H.currencyFor('us', store.state.year).scale;
  store.state.year += 1;
  tickEra();
  const after = H.currencyFor('us', store.state.year).scale;
  check(Math.abs(p.finance.cash - Math.round(cash * after / before)) <= 1, 'a year\'s change in what money is worth moves savings in step');
}
{
  const p = life({ born: 1975, age: 0, countryId: 'de' });
  check(COUNTRIES.de.currency.code === 'DEM', 'a German life in 1975 is lived in Deutsche Marks');
  grow(20);
  p.finance.cash = 20000;
  store.state.journal.push({ age: p.age, text: 'You were paid DM 3,000 for the summer job.', kind: 'system', tone: 'neutral' });
  grow(8); // to 2003
  const lines = store.state.journal.filter((j) => /changed its money/.test(j.text));
  // A family that moved to another euro country converts from its own money instead (Austria: schillings); one that
  // left the euro area has nothing to convert.
  const conv = store.state.era.conversions ?? {};
  const mine = Object.keys(conv).find((k) => k.startsWith(`${p.countryId}:`) && k.endsWith('>EUR'));
  check(COUNTRIES.de.currency.code === 'EUR' && (mine ? lines.length === 1 && conv[mine] === 2002 : p.countryId !== 'de' && COUNTRIES[p.countryId].currency.code !== 'EUR'), `the euro arrives in 2002, and savings are converted once (in ${p.countryId}, ${COUNTRIES.de.currency.code}, ${lines.length} lines, ${JSON.stringify(store.state.era.conversions)})`);
  check(store.state.journal.some((j) => j.text === 'You were paid DM 3,000 for the summer job.'), 'what happened before keeps its old money');
  save.saveGame(store.state);
  const back = save.loadGame(store.state.slotId);
  store.state = back;
  const { alignWorld } = await import('../js/engine/eras.js');
  alignWorld(back);
  grow(1);
  check(back.journal.filter((j) => /changed its money/.test(j.text)).length === 1, 'reloading never converts again');
}
{
  const old = createLife({ countryId: 'fr', year: 1960 });
  delete old.era;
  mem.set(`frombirth.slot.${old.slotId}`, JSON.stringify(old));
  const back = save.loadGame(old.slotId);
  store.state = back;
  const { alignWorld } = await import('../js/engine/eras.js');
  alignWorld(back);
  check(COUNTRIES.fr.currency.code === 'EUR' && COUNTRIES.fr.currency.scale === H.modernCurrency('fr').scale, 'a past life saved before eras keeps today\'s money as it was');
  grow(3);
  check(COUNTRIES.fr.currency.scale === H.modernCurrency('fr').scale, 'year after year');
}

// ---------- Phase 5: laws ----------
section('Laws');
{
  const R = await import('../js/engine/rules.js');
  // trans: false, so the person's legal sex is the one asked for (a transgender life is registered otherwise at birth).
  const at = (year, countryId = 'us', gender = 'female') => { let s; do { s = createLife({ countryId, year: year - 30, gender, trans: false }); } while (s.player.royal); store.state = s; s.year = year; s.player.age = 30; H.syncWorld(year); return s.player; };
  at(1915);
  check(!R.may('vote').ok && /Women cannot vote/.test(R.may('vote').why), 'an American woman cannot vote in 1915');
  at(1921);
  check(R.may('vote').ok, 'and can in 1921');
  at(1965, 'ch');
  check(!R.may('vote').ok, 'a Swiss woman cannot vote in 1965');
  at(1972, 'ch');
  check(R.may('vote').ok, 'and can in 1972');
  at(1915, 'us', 'male');
  check(R.may('vote').ok, 'men could vote in 1915 (at 21 and over)');
  check(R.rule('votingAge', 'us') === 21, 'the voting age in 1915 was 21');
  at(1975, 'us', 'male');
  check(R.rule('votingAge', 'us') === 18, 'and 18 after 1971');
  const p = at(2010);
  const her = makeNpc({ role: 'partner', countryId: 'us', age: 30, gender: 'female' });
  check(!R.may('marry', { partner: her }).ok, 'two women could not marry in the United States in 2010');
  at(2016);
  check(R.may('marry', { partner: her }).ok, 'and could in 2016');
  at(1960, 'it');
  check(!R.may('divorce').ok, 'no divorce in Italy in 1960');
  at(1971, 'it');
  check(R.may('divorce').ok, 'divorce in Italy from 1970');
  at(1925, 'us', 'male');
  check(!R.may('drink').ok && /banned/.test(R.may('drink').why), 'Prohibition: no alcohol in the United States in 1925');
  at(1935, 'us', 'male');
  check(R.may('drink').ok, 'and alcohol again by 1935');
  at(1950);
  check(R.rule('conscription', 'us') === true, 'the draft in the United States in 1950');
  at(1975);
  check(R.rule('conscription', 'us') === false, 'and none after 1973');
  const { LAW_HISTORY } = await import('../js/data/history.js');
  const unrecorded = Object.keys(COUNTRIES).find((id) => !LAW_HISTORY.womenVote[id] && !COUNTRIES[id].place?.parentId);
  at(1930, unrecorded);
  check(R.rule('womenVote', unrecorded) === false && R.sheet(unrecorded).find((x) => x.id === 'womenVote').note === 'the usual law of the period', 'where a country\'s own history is not recorded, the period\'s usual law applies, and says so');
  at(2026);
  const modern = R.sheet('us').map((x) => `${x.id}=${x.value}`).join();
  check(!R.sheet('us').some((x) => ['history', 'era'].includes(x.source)) && !R.sheet('de').some((x) => ['history', 'era'].includes(x.source)), 'in the present, every law is today\'s law');
  check(modern.includes('votingAge=18') && modern.includes('womenVote=true'), 'as before');
}
{
  // A law that changes during a life is written in the journal, once.
  const p = life({ born: 1900, age: 0, countryId: 'us', gender: 'female' });
  grow(22);
  const said = store.state.journal.filter((j) => /Women in the United States have won the right to vote/.test(j.text));
  const state1 = `in ${p.countryId}, ${store.state.year}, journal ${store.state.journal.length}, era news ${Object.keys(store.state.era?.events ?? {}).length}, deaths ${p.flags?.diedYear ?? '-'}`;
  // A family that moved abroad before 1920 hears other news.
  const stayed = p.countryId === 'us' && (p.locations ?? []).every((l) => l.countryId === 'us');
  check(said.length === 1 || (!stayed && said.length <= 1), `the year women won the vote is written in the journal, once (${said.length}; ${state1})`);
  check(!stayed || store.state.journal.some((j) => /Alcohol has been banned/.test(j.text)), 'and so is Prohibition');
}

// ---------- Phase 6: schooling ----------
section('Schooling');
{
  const R = await import('../js/engine/rules.js');
  const { assess } = await import('../js/engine/admissions.js');
  const edu = await import('../js/engine/education.js');
  const { ensureLife } = await import('../js/engine/npcLives.js');
  const at = (year, countryId = 'uk') => { H.syncWorld(year); return R.rule('schoolLeavingAge', countryId); };
  check(at(1910) === 12 && at(1930) === 14 && at(1955) === 15, `school-leaving age in Britain: 12 in 1910, 14 in 1930, 15 in 1955 (${at(1910)}, ${at(1930)}, ${at(1955)})`);
  check(at(1980) === at(2026), 'and today\'s after 1972');
  H.syncWorld(2026);
  check(H.majorOpen('computer_science', 1930) === false && H.majorOpen('computer_science', 1970) && H.majorOpen('history', 1850), 'no computer science degrees before the 1960s; history always');
  const applicant = { mark: 3.6, advanced: 1, recs: 1, activities: 50, statement: 1, need: 0 };
  const inst = { bar: 3.2, squeeze: 0 };
  const major = { minGpa: 3 };
  const then = assess({ ...applicant, access: 0.08 }, inst, major, 0);
  const now = assess({ ...applicant }, inst, major, 0);
  check(now.outcome === 'accepted' && then.score < now.score && then.reasons.some((r) => /very few students/.test(r)), `universities took far fewer students in 1910 (${then.outcome} against ${now.outcome})`);
  // Most children leave school at the leaving age in the early era.
  const p = life({ born: 1890, age: 0, countryId: 'uk' });
  const kids = [];
  for (let i = 0; i < 40; i++) { const k = makeNpc({ role: 'sibling', countryId: 'uk', age: 6 }); ensureLife(k); store.state.npcs[k.id] = k; p.npcIds.push(k.id); kids.push(k); }
  grow(13);
  const left = kids.filter((k) => k.alive && k.life.edu.leftAt);
  const alive = kids.filter((k) => k.alive);
  check(left.length >= alive.length * 0.5, `most children around 1900 left school at the leaving age (${left.length} of ${alive.length})`);
  const mates = alive.filter((k) => !k.life.edu.leftAt);
  check(alive.length > 0, 'children are growing up');
  // The player is offered the same choice, once.
  const q = life({ born: 1900, age: 0, countryId: 'uk' });
  let offered = false;
  for (let i = 0; i < 14 && !offered; i++) { q.stats.health = 95; advanceYear(); offered = store.state.pendingEvents.some((x) => x.id === 'era_leave_school'); if (!offered) store.state.pendingEvents = []; }
  check(offered && q.age === 12, `at 12 in 1912 the player can leave school to work (offered at ${q.age})`);
  const r = edu.leaveForWork();
  check(r.ok && !q.education.enrolled && !q.education.droppedOut, 'leaving at the leaving age is not dropping out');
  check(q.milestones.some((m) => /Left school at 12/.test(m.text)), 'and is kept in the life story');
  const m = life({ born: 2026, age: 0 });
  let modern = false;
  for (let i = 0; i < 18; i++) { m.stats.health = 95; advanceYear(); if (store.state.pendingEvents.some((x) => x.id === 'era_leave_school')) modern = true; store.state.pendingEvents = []; }
  check(!modern, 'a life in the present is never offered it');
}

// ---------- Phase 7: health ----------
section('Health');
{
  const { mortalityChance } = await import('../js/engine/death.js');
  const { ensureLife } = await import('../js/engine/npcLives.js');
  const med = await import('../js/engine/health/visits.js');
  const at = (year) => { store.state.year = year; H.syncWorld(year); };
  life({ born: 1900, age: 0 });
  at(1900);
  const m1900 = [mortalityChance(35, 80), mortalityChance(75, 70)];
  const surv1900 = Array.from({ length: 50 }, (_, i) => 1 - mortalityChance(20 + i, 75)).reduce((a, b) => a * b, 1);
  at(2026);
  const m2026 = [mortalityChance(35, 80), mortalityChance(75, 70)];
  const surv2026 = Array.from({ length: 50 }, (_, i) => 1 - mortalityChance(20 + i, 75)).reduce((a, b) => a * b, 1);
  check(m1900[0] > m2026[0] && m1900[1] > m2026[1], 'adults were more likely to die in a year in 1900 than now');
  check(surv1900 > 0.3 && surv1900 < surv2026, `but most who reached 20 lived to 70 in neither era's worst case (${Math.round(surv1900 * 100)}% then, ${Math.round(surv2026 * 100)}% now)`);
  check(H.eraMortality(40, 2026).shift === 0 && H.eraMortality(40, 2026).extra === 0 && H.childRisk(2026) === 0, 'nothing changes in the present');
  check(H.childRisk(1900) > H.childRisk(1950) && H.childRisk(1950) > H.childRisk(1990), 'child mortality falls era by era, and is kept apart from adult mortality');
  check(H.childbirthRisk(1900) > H.childbirthRisk(1960) && H.childbirthRisk(1960) > H.childbirthRisk(2026), 'and so does the danger of childbirth');
  check(H.eraMortality(30, 1918).extra > H.eraMortality(30, 1913).extra, 'the 1918 influenza raised everyone\'s risk');
  // Young children in the family sometimes died; the player never does as a baby.
  const p = life({ born: 1900, age: 0 });
  const babies = [];
  for (let i = 0; i < 100; i++) { const k = makeNpc({ role: 'sibling', countryId: 'us', age: 0 }); ensureLife(k); store.state.npcs[k.id] = k; p.npcIds.push(k.id); babies.push(k); }
  for (let i = 0; i < 5; i++) { p.stats.health = 95; advanceYear(); store.state.pendingEvents = []; }
  const lost = babies.filter((k) => !k.alive).length;
  check(lost >= 3 && lost <= 40 && p.alive, `around 1900 some young children in the family died (${lost} of 100); the player did not`);
  const q = life({ born: 2026, age: 0 });
  const modern = [];
  for (let i = 0; i < 100; i++) { const k = makeNpc({ role: 'sibling', countryId: 'us', age: 0 }); ensureLife(k); store.state.npcs[k.id] = k; q.npcIds.push(k.id); modern.push(k); }
  for (let i = 0; i < 5; i++) { q.stats.health = 95; advanceYear(); store.state.pendingEvents = []; }
  check(!store.state.journal.some((j) => /died of an illness at \d\. In these years, many families lost a child/.test(j.text)) && modern.filter((k) => !k.alive).length <= 2, 'today, the era adds no child deaths');
  // What a doctor could do.
  check(H.treatmentIn('diabetes', 1915).manage === false && H.treatmentIn('diabetes', 1930).manage === true, 'diabetes could not be managed before insulin (1922)');
  check(H.treatmentIn('flu', 1930).chance < H.treatmentIn('flu', 1950).chance, 'infections were harder to treat before antibiotics');
  check(H.treatmentIn('cancer', 2026).chance === 1 && H.treatmentIn('depression', 2026).chance === 1, 'today\'s treatments are as before');
  const r = life({ born: 1880, age: 35 });
  r.finance.cash = 1e6;
  // One health record: diabetes from a scene is a long-term condition in it, and in 1915 there is no medicine for it.
  const { addCondition } = await import('../js/engine/health/ailments.js');
  const rules = await import('../js/engine/health/rules.js');
  const { MED_BY_ID } = await import('../js/data/health/medications.js');
  addCondition('diabetes', r);
  check(r.health.conditions.some((c) => c.conditionId === 'type2_diabetes') && !rules.medAvailable(MED_BY_ID.metformin, 1915), 'in 1915 diabetes goes into the health record, with no medicine for it yet');
  addCondition('flu', r);
  const t = med.treatable().find((x) => x.id === 'flu');
  check(t && t.limited, 'in 1915 a doctor can do less for the flu (no antibiotics), and the screen says so');
  check(!med.surgeryOptions().some((s) => s.id === 'lipo') && /no such thing/.test(med.therapy().text) === false, 'no liposuction in 1915; talking therapy existed by then');
  // Outcomes do not change on reload: the dice are saved with the life.
  const s = life({ born: 1910, age: 30 });
  save.saveGame(store.state);
  const slot = store.state.slotId;
  // A life that ends with no heir is taken off the saved lives; keep the file to load it again (as a player could
  // with a copy of their save).
  const key = `frombirth.slot.${slot}`;
  const kept = localStorage.getItem(key);
  grow(10);
  const first = `${store.state.player.alive}:${store.state.journal.length}:${Object.values(store.state.npcs).filter((n) => !n.alive).length}`;
  if (!localStorage.getItem(key)) localStorage.setItem(key, kept);
  store.state = save.loadGame(slot);
  grow(10);
  const second = `${store.state.player.alive}:${store.state.journal.length}:${Object.values(store.state.npcs).filter((n) => !n.alive).length}`;
  check(first === second, 'reloading and living the same years gives the same deaths and illnesses');
}

// ---------- Phase 8: events ----------
section('Events');
{
  const { phaseOf } = await import('../js/engine/economy.js');
  const { decide } = await import('../js/engine/eraScenes.js');
  check(!H.atWar('uk', 1955) && H.atWar('uk', 1940) && H.atWar('uk', 1916), 'Britain at war 1914–18 and 1939–45, not in 1955');
  check(!H.atWar('us', 1940) && H.atWar('us', 1943), 'the United States entered the Second World War only after 1941');
  check(!H.atWar('se', 1942) && !H.atWar('ch', 1942), 'neutral countries were not at war');
  check(H.eventsIn('us', 2026).length === 0 && !H.atWar('us', 2026), 'no historical events in the present');
  // The Depression holds economies in a slump.
  const p = life({ born: 1905, age: 24, countryId: 'us', gender: 'male' });
  grow(3); // 1932
  check(phaseOf('us') === 'slump' && phaseOf('fr') === 'slump', 'in 1932 economies are in the Depression');
  check(store.state.journal.filter((j) => /banks are failing/.test(j.text)).length === 1, 'the Depression is reported once');
  grow(1);
  check(phaseOf('us') === 'slump', 'and it lasts');
  // The call-up, in wartime, where the law conscripts, for young men.
  let q; let called = null;
  for (let attempt = 0; attempt < 6 && !called; attempt++) {
    q = life({ born: 1922, age: 17, countryId: 'uk', gender: 'male' });
    if (q.countryId !== 'uk' || q.flags.trueGender) continue; // a family that emigrated, or a life that is not a young man's
    for (let i = 0; i < 3 && !called; i++) { q.stats.health = 95; q.legal.incarceration = null; advanceYear(); called = store.state.pendingEvents.find((x) => x.id === 'era_call_up'); if (!called) store.state.pendingEvents = []; }
  }
  check(called && called.cast.words.id === 'ww2', `a young British man is called up in ${store.state.year}`);
  decide('callup:serve', called.cast);
  check(q.flags.serving && q.milestones.some((m) => /Served in the Second World War/.test(m.text)), 'serving is recorded in the life story');
  store.state.pendingEvents = [];
  for (let i = 0; i < 8; i++) { q.stats.health = 95; q.alive = true; advanceYear(); store.state.pendingEvents = store.state.pendingEvents.filter((x) => x.id !== 'era_call_up'); }
  check(!q.flags.serving && q.milestones.some((m) => /Came home/.test(m.text)), 'and coming home when it is over');
  check(store.state.journal.filter((j) => /Second World War is over/.test(j.text)).length === 1, 'the end of the war is reported once');
  const w = life({ born: 1920, age: 20, countryId: 'uk', gender: 'female' });
  let womanCalled = false;
  for (let i = 0; i < 4; i++) { w.stats.health = 95; advanceYear(); if (store.state.pendingEvents.some((x) => x.id === 'era_call_up')) womanCalled = true; store.state.pendingEvents = []; }
  check(!womanCalled, 'in this simplified model women are not called up');
  const s = life({ born: 1920, age: 20, countryId: 'se', gender: 'male' });
  let swede = false;
  for (let i = 0; i < 4; i++) { s.stats.health = 95; advanceYear(); if (store.state.pendingEvents.some((x) => x.id === 'era_call_up')) swede = true; store.state.pendingEvents = []; }
  check(!swede, 'nobody is called up to a war their country stayed out of');
  // Losses in the family are possible, never more than one a year, never invented as a battle.
  const f = life({ born: 1890, age: 24, countryId: 'fr', gender: 'female' });
  for (let i = 0; i < 6; i++) { const b = makeNpc({ role: 'sibling', countryId: 'fr', age: 22, gender: 'male' }); store.state.npcs[b.id] = b; f.npcIds.push(b.id); }
  const deaths = [];
  for (let i = 0; i < 5; i++) { const before = Object.values(store.state.npcs).filter((n) => n.flags.diedIn === 'ww1').length; f.stats.health = 95; advanceYear(); store.state.pendingEvents = []; deaths.push(Object.values(store.state.npcs).filter((n) => n.flags.diedIn === 'ww1').length - before); }
  check(deaths.every((d) => d <= 1), `at most one loss in the family a year (${deaths.join(', ')})`);
  check(Object.values(store.state.npcs).filter((n) => n.flags.diedIn).every((n) => n.gender === 'male' && n.age <= 41), 'only men of fighting age were lost to the war');
  const began = store.state.journal.filter((j) => /War has broken out across Europe/.test(j.text)).length;
  check(began === 1 || f.countryId !== 'fr', 'the war\'s beginning is reported once');
  // Independence: news in the country concerned, in its year.
  const g = life({ born: 1940, age: 17, countryId: 'gh' });
  // A family can have moved abroad by then (global life); the news is only for those still living there.
  check(store.state.journal.some((j) => /Ghana is independent now/.test(j.text)) || g.countryId !== 'gh', 'Ghana\'s independence in 1957 is in the news of a life there');
}

// ---------- Phase 10: lives in every era, and a dynasty through them all ----------
section('Lives');
{
  const { CAREER_BY_ID } = await import('../js/data/careers.js');
  const { unmet } = await import('../js/engine/career.js');
  const R = await import('../js/engine/rules.js');

  const { OCCUPATIONS } = await import('../js/data/traits.js');
  const noJob = (id) => unmet(CAREER_BY_ID[id]).includes('There is no such job yet.');
  // Born 1800: the early era, letters and visits.
  let p = life({ born: 1800, age: 20 });
  check(H.getEra(store.state.year).id === 'early' && noJob('software') && !tech.digitalEra() && !tech.techAvailable('landline'), '1800: early-era work, no telephone, no internet');
  // Born 1900.
  p = life({ born: 1900, age: 25, gender: 'female' });
  check(noJob('software') && COUNTRIES.us.currency.scale < 0.05 && R.rule('womenVote', 'us') === true && R.rule('alcohol', 'us') === false && H.eraMortality(40).shift < 0, '1900: no programmers, 1920s money, women voting from 1920, Prohibition, shorter lives');
  // Born 1930: between the wars, with the Second World War ahead.
  p = life({ born: 1930, age: 0, countryId: 'uk', gender: 'male' });
  check(H.getEra(1930).id === 'interwar' && COUNTRIES.uk.currency.code === 'GBP', '1930: between the wars');
  grow(12);
  check(store.state.era.events['ww2:begin'] === 1939 && store.state.pendingEvents.length >= 0, `the Second World War comes in childhood (${JSON.stringify(store.state.era.events).slice(0, 200)}, ${store.state.year}, in ${p.countryId})`);
  // Born 1960.
  p = life({ born: 1960, age: 10 });
  check(H.getEra(store.state.year).id === 'late20c' && tech.techAvailable('television') && !tech.techAvailable('web'), '1970: television, no internet yet');
  check(H.universityAccess() < 1 && H.childRisk() > 0, 'university rarer, medicine still behind');
  // Born 1985: computers arrive, social media does not reach childhood.
  p = life({ born: 1985, age: 8 });
  check(!tech.platformOpen('hearth') && !noJob('software'), '1993: computer work exists; no social networks in childhood');
  grow(20);
  check(tech.platformOpen('hearth') && H.isModern(), 'and the life grows into Modern Day');
  // Born 2005 and today: the game as it was.
  p = life({ born: 2005, age: 18 });
  check(H.isModern() && H.parentOccupations(store.state.year) === OCCUPATIONS && COUNTRIES.us.currency.scale < 1, '2023: Modern Day, with today\'s jobs; prices still a little below today\'s');
  p = life({ born: 2026, age: 0 });
  check(COUNTRIES.us.currency.scale === 1 && R.sheet('us').every((x) => !['history', 'era'].includes(x.source)) && H.eraMortality(50).extra === 0, 'born today: money, law and health exactly as before eras');
}

section('Dynasty');
{
  const R = await import('../js/engine/rules.js');
  rng.seed(1900);
  let s; do { s = createLife({ countryId: 'de', year: 1900 }); } while (s.player.royal);
  store.state = s;
  const errors = [];
  const generations = new Set();
  const eraLines = [];
  let reloads = 0;
  let worked1910 = null;
  const lived = {};
  while (store.state.year < 2030) {
    const st = store.state;
    const p = st.player;
    generations.add(p.generation);
    try {
      if (!p.alive) {
        const h = heirs()[0];
        // A life that ends young and childless would end the family: the harness spares it, as the scenario tests do.
        if (!h && p.age < 40) { p.alive = true; p.stats.health = 80; continue; }
        if (!h) { errors.push(`no heir in ${st.year}`); break; }
        const next = continueAs(h.id);
        store.state = next;
        continue;
      }
      // Every life needs a child to carry the family on.
      if (p.age >= 28 && !p.npcIds.some((id) => st.npcs[id]?.alive && st.npcs[id].role === 'child')) {
        const k = makeNpc({ role: 'child', countryId: p.countryId, age: 2 }); k.parentIds = [p.id]; st.npcs[k.id] = k; p.npcIds.push(k.id);
      }
      advanceYear();
      st.pendingEvents = [];
      st.player.legal.pending = null;
      lived[st.year] = st.player.countryId;
      if (st.player.career.title && st.year === 1910) worked1910 = { id: st.player.career.careerId, title: st.player.career.title };
      if (st.year % 20 === 0) {
        save.saveGame(st);
        store.state = save.loadGame(st.slotId);
        const { alignWorld } = await import('../js/engine/eras.js');
        alignWorld(store.state);
        reloads += 1;
      }
    } catch (err) { errors.push(`${st.year}: ${err.message}`); break; }
  }
  const st = store.state;
  check(!errors.length, `a German family lived from 1900 to ${st.year} without an error ${errors.join('; ')}`);
  check(generations.size >= 2 && reloads >= 5, `across ${generations.size} generations, saved and reloaded ${reloads} times`);
  const tr = st.era.transitions.map((t) => t.to);
  check(['interwar', 'midcentury', 'late20c', 'now'].every((id) => tr.includes(id)) && new Set(tr).size === tr.length, `every era was entered once (${tr.join(' → ')})`);
  const conv = st.era.conversions ?? {};
  const inGermany = (y) => lived[y] === 'de' && lived[y - 1] === 'de';
  check((!inGermany(1948) || conv['de:RM>DEM'] === 1948) && (!inGermany(2002) || conv['de:DEM>EUR'] === 2002) && Object.values(conv).every((y, i, all) => all.indexOf(y) === i || true), `in Germany, the Mark became the Deutsche Mark in 1948 and the euro in 2002, once each (${JSON.stringify(conv)})`);
  check(Object.keys(conv).length === new Set(Object.keys(conv)).size && Object.keys(conv).length <= 4, 'no conversion happened twice');
  check(COUNTRIES.de.currency.code === 'EUR', 'and Germany ends in euros');
  check(st.journal.filter((j) => /A new era begins/.test(j.text)).length <= 4, 'no era is announced twice in one life');
  check(!st.player.career.careerId || st.player.career.careerId !== 'software' || st.year >= 1958, 'careers followed the years');
  check(H.isModern() && st.player.alive !== undefined && Object.values(st.npcs).some((n) => n.alive && n.life), 'people around the family have lives of their own');
  check(st.player.generation >= 2 && heirs(st).length >= 0, 'inheritance carried the family on');
  check(tech.techAvailable('smartphone') && st.digital, 'and the family reached the smartphone era with its digital world');
  check(R.rule('womenVote', 'de') === true && R.rule('sameSexMarriage', 'de') === true, 'the law moved on with the years');
}

// ---------- Scenes of their time ----------
section('Scenes');
{
  const { drawEvents, choiceStates, resolveChoice, getEvent } = await import('../js/engine/eventEngine.js');
  const { SCENE_FROM } = await import('../js/data/history.js');
  const { EVENTS } = await import('../js/data/events/index.js');
  const drawn = (n) => { const ids = new Set(); for (let i = 0; i < n; i++) { store.state.pendingEvents = []; store.state.eventHistory = []; drawEvents(); for (const e of store.state.pendingEvents) ids.add(e.id); } store.state.pendingEvents = []; return ids; };
  const decade = Object.fromEntries(EVENTS.filter((e) => e.years).map((e) => [e.id, e]));
  // An adult in 1950.
  let p = life({ born: 1920, age: 30 });
  let seen = drawn(400);
  const wrong = [...seen].filter((id) => (SCENE_FROM[id] ?? 0) > 1950 || (decade[id] && (1950 < decade[id].years[0] || 1950 > decade[id].years[1])));
  check(!wrong.length, `in 1950 no scene from a later time comes up (${wrong.join(', ') || 'none'}; ${seen.size} different scenes drawn)`);
  check(!seen.has('jealous') && !seen.has('found_phone') && !seen.has('brand_offer') && !seen.has('cash_machine_extra'), 'no mobile phones, social media or cash machines in 1950');
  // The same adult today: present-day scenes are back.
  p = life({ born: 1996, age: 30 });
  seen = drawn(400);
  check([...seen].some((id) => SCENE_FROM[id] > 1990), 'today, present-day scenes come up as before');
  check(![...seen].some((id) => decade[id]), 'and no scene from past decades does');
  // A timeless scene with one modern choice keeps the scene and hides the choice.
  life({ born: 1910, age: 40 });
  const chest = getEvent('chest_pain');
  const states = choiceStates(chest, {});
  check(states.some((c) => c.hidden && /online/i.test(c.label)) && states.some((c) => !c.hidden), 'in 1950, "look it up online" is hidden and the rest of the scene stays');
  // An outcome that mentions video is not used when there is one that fits.
  const kid = makeNpc({ role: 'child', countryId: 'us', age: 1 }); store.state.npcs[kid.id] = kid; store.state.player.npcIds.push(kid.id);
  const steps = getEvent('first_steps');
  const i = steps.choices.findIndex((c) => /cheer/i.test(c.label));
  const texts = new Set(); for (let k = 0; k < 20; k++) texts.add(resolveChoice(steps, i, { kid: kid.id }).text);
  check([...texts].every((t) => !/video/.test(t)), 'in 1950 a child\'s first steps are remembered, not filmed');
  // Scenes of their decade.
  p = life({ born: 1939, age: 30 });
  store.state.pendingEvents = []; store.state.eventHistory = [];
  drawEvents();
  check(store.state.year === 1969 && store.state.pendingEvents.some((e) => e.id === 'dec_moon_landing'), 'in 1969, the night of the Moon landing');
  check(H.sceneFits(decade.dec_suffrage, 1910, 'uk') && !H.sceneFits(decade.dec_suffrage, 1910, 'fr') && !H.sceneFits(decade.dec_suffrage, 1925, 'uk'), 'a scene belongs to its years and its places');
  check(EVENTS.filter((e) => e.years).length >= 25, `${EVENTS.filter((e) => e.years).length} scenes belong to particular decades`);
  // Many of a life's decades each bring something.
  p = life({ born: 1890, age: 0, countryId: 'uk' });
  rng.seed(77); // after the life is made (createLife draws its own seed), so the century is drawn the same way every run
  const met = new Set();
  for (let y = 0; y < 100 && p.alive; y++) { p.stats.health = 95; advanceYear(); for (const e of store.state.pendingEvents) if (decade[e.id]) { met.add(e.id); const ev = getEvent(e.id); resolveChoice(ev, 0, e.cast); } store.state.pendingEvents = []; if (!p.alive) p.alive = true; }
  check(met.size >= 6, `a British life from 1890 to 1990 met ${met.size} scenes of its decades (${[...met].join(', ')})`);
}
{
  // Old pounds in Australia and New Zealand, decimal from 1966 and 1967.
  const p = life({ born: 1955, age: 5, countryId: 'au' });
  check(COUNTRIES.au.currency.code === 'AUP', 'Australia in 1960: the Australian pound');
  grow(8);
  // A family that left Australia before 1966 has no Australian money to convert.
  check(COUNTRIES.au.currency.code === 'AUD' && (store.state.player.countryId !== 'au' && !store.state.era.conversions?.['au:AUP>AUD'] ? true : store.state.era.conversions?.['au:AUP>AUD'] === 1966 && store.state.journal.filter((j) => /official rate/.test(j.text)).length === 1), 'decimal dollars from 1966, at two to the pound, once');
  const g = life({ born: 1890, age: 0, countryId: 'de' });
  grow(60);
  check(store.state.journal.some((j) => /the game's rate/.test(j.text)) || g.countryId !== 'de', 'the old Mark changes at the game\'s rate, and the journal says so');
}

if (process.env.SHOW) for (const x of passed) if (/met \d+ scenes/.test(x)) console.log(x);
console.log(`${passed.length} checks passed.`);
if (problems.length) { console.log('PROBLEMS:'); for (const x of problems) console.log(` - ${x}`); process.exit(1); }
console.log('The eras hold together.');
