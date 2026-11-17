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
import { ensureEra } from '../js/engine/eras.js';
import { heirs, continueAs } from '../js/engine/legacy.js';
import { die } from '../js/engine/death.js';
import { makeNpc } from '../js/engine/npcFactory.js';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
const save = await import('../js/save.js');

rng.seed(19001);
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
  mem.set(`pathways.slot.${s.slotId}`, JSON.stringify(s));
  const back = save.loadGame(s.slotId);
  check(back.era.money === 'era' && back.year === s.year && back.player.finance.cash === cash && back.player.age === s.player.age, 'a present-day save loads unchanged, as a modern life');
  // A life saved before eras, already in the past: keeps today's money.
  const old = createLife({ countryId: 'us', year: 1950 });
  delete old.era;
  mem.set(`pathways.slot.${old.slotId}`, JSON.stringify(old));
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
  const npcJobs = Object.values(store.state.npcs).map((n) => n.life?.job).filter(Boolean);
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
  check(store.state.year === 1910 && unmet(CAREER_BY_ID.lawyer).some((x) => /not admitted to practise law/.test(x)), 'in 1910 a British woman could not practise law');
  const husband = makeNpc({ role: 'spouse', countryId: 'uk', age: 32 }); store.state.npcs[husband.id] = husband; p.npcIds.push(husband.id);
  check(unmet(CAREER_BY_ID.teacher).some((x) => /married women are not allowed/.test(x)), 'and a married woman could not keep a teaching post');
  check(!unmet(CAREER_BY_ID.office).some((x) => /married women|admitted/.test(x)), 'but other work was open to her');
  grow(15); // 1925
  check(!unmet(CAREER_BY_ID.lawyer).some((x) => /not admitted/.test(x)), 'by 1925 women could practise law in the UK');
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
  const p = life({ born: 1900, age: 30 });
  p.flags.livesWithParents = false; p.finance.cash = localMoney(500000, COUNTRIES.us);
  const homes = estate.listings();
  const mid = homes.map((h) => h.price).sort((a, b) => a - b)[Math.floor(homes.length / 2)];
  check(homes.length && mid < 20000, `houses in 1930 cost what they did then (a middling one: ${mid})`);
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
  check(COUNTRIES.de.currency.code === 'EUR' && lines.length === 1 && store.state.era.conversions['de:DEM>EUR'] === 2002, 'the euro arrives in 2002, and savings are converted once');
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
  mem.set(`pathways.slot.${old.slotId}`, JSON.stringify(old));
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
  const at = (year, countryId = 'us', gender = 'female') => { let s; do { s = createLife({ countryId, year: year - 30, gender }); } while (s.player.royal); store.state = s; s.year = year; s.player.age = 30; H.syncWorld(year); return s.player; };
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
  check(said.length === 1, 'the year women won the vote is written in the journal, once');
  check(store.state.journal.some((j) => /Alcohol has been banned/.test(j.text)), 'and so is Prohibition');
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
  const med = await import('../js/engine/medical.js');
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
  check(modern.every((k) => k.alive), 'today, none of the hundred did');
  // What a doctor could do.
  check(H.treatmentIn('diabetes', 1915).manage === false && H.treatmentIn('diabetes', 1930).manage === true, 'diabetes could not be managed before insulin (1922)');
  check(H.treatmentIn('flu', 1930).chance < H.treatmentIn('flu', 1950).chance, 'infections were harder to treat before antibiotics');
  check(H.treatmentIn('cancer', 2026).chance === 1 && H.treatmentIn('depression', 2026).chance === 1, 'today\'s treatments are as before');
  const r = life({ born: 1880, age: 35 });
  r.conditions.push({ id: 'diabetes', name: 'diabetes', severity: 40, chronic: true, sinceAge: 30, treated: false });
  r.finance.cash = 1e6;
  const t = med.treatable().find((x) => x.id === 'diabetes');
  check(t && t.limited && !t.manage, 'in 1915 a doctor can do little for diabetes, and the screen says so');
  med.seeDoctor('diabetes');
  check(!r.conditions.find((c) => c.id === 'diabetes').treated, 'and it cannot be brought under control');
  check(!med.surgeryOptions().some((s) => s.id === 'lipo') && /no such thing/.test(med.therapy().text) === false, 'no liposuction in 1915; talking therapy existed by then');
  // Outcomes do not change on reload: the dice are saved with the life.
  const s = life({ born: 1910, age: 30 });
  save.saveGame(store.state);
  const slot = store.state.slotId;
  grow(10);
  const first = `${store.state.player.alive}:${store.state.journal.length}:${Object.values(store.state.npcs).filter((n) => !n.alive).length}`;
  store.state = save.loadGame(slot);
  grow(10);
  const second = `${store.state.player.alive}:${store.state.journal.length}:${Object.values(store.state.npcs).filter((n) => !n.alive).length}`;
  check(first === second, 'reloading and living the same years gives the same deaths and illnesses');
}

console.log(`${passed.length} checks passed.`);
if (problems.length) { console.log('PROBLEMS:'); for (const x of problems) console.log(` - ${x}`); process.exit(1); }
console.log('The eras hold together.');
