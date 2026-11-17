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

console.log(`${passed.length} checks passed.`);
if (problems.length) { console.log('PROBLEMS:'); for (const x of problems) console.log(` - ${x}`); process.exit(1); }
console.log('The eras hold together.');
