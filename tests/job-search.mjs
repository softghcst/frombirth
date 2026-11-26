// Checks the ordinary job search: this year's short list (not the whole market, one per line of work, mostly jobs the
// player can do, the same all year, new the next year, longer in a boom and shorter in a recession) and the job
// recruiter (one opening that fits at a time, three looks a year, then nothing until next year). Run with: node tests/job-search.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import * as market from '../js/engine/employers.js';
import * as work from '../js/engine/worklife.js';
import * as search from '../js/engine/jobSearch.js';

rng.seed(8080);
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };
const life = (id = 'us') => {
  do { store.state = createLife({ countryId: id }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = 24; p.birthYear = store.state.year - 24; p.flags.livesWithParents = false; p.education.enrolled = false; p.education.stage = 'none';
  p.legal.record = []; p.stats.health = 80;
  if (!p.education.degrees.some((d) => d.type === 'high')) p.education.degrees.push({ type: 'high', gpa: 3.2, age: 18 });
  work.career();
  return p;
};

for (const id of ['us', 'jp', 'ng', 'fr', 'br']) {
  const p = life(id);
  const list = search.yearList();
  const board = market.board().length;
  check(list.length >= 4 && list.length <= 11 && list.length < board, `${id}: the list is a short one (${list.length} of ${board} openings)`);
  check(new Set(list.map((v) => v.post.careerId)).size === list.length, `${id}: one opening per line of work`);
  check(list.filter((v) => v.eligible).length >= list.length / 2, `${id}: most of the list is open to the player`);
  check(list.every((v, i) => !i || list[i - 1].eligible >= v.eligible), `${id}: what the player can apply for comes first`);
  check(search.yearList().map((v) => v.post.id).join() === list.map((v) => v.post.id).join(), `${id}: the list stays the same through the year`);

  // The recruiter.
  check(search.recruiter().left === 3 && !search.recruiter().view, `${id}: three looks at the start of the year`);
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const r = search.recruiterLook();
    check(r.ok && r.view.eligible, `${id}: look ${i + 1} brings an opening the player qualifies for`);
    if (r.ok) seen.push(r.view.post.id);
    check(r.left === 2 - i, `${id}: ${2 - i} looks left after look ${i + 1}`);
  }
  check(new Set(seen).size === seen.length && seen.every((x) => !list.some((v) => v.post.id === x)), `${id}: each look is a different opening, not one already on the list`);
  const fourth = search.recruiterLook();
  check(!fourth.ok && search.recruiter().done, `${id}: no fourth look in the same year`);
  check(search.recruiter().view?.post.id === seen.at(-1), `${id}: the last pitch is kept to look at again`);

  // A new year: a new list, and the recruiter again.
  const before = list.map((v) => v.post.id).join();
  advanceYear(); store.state.pendingEvents = []; p.legal.pending = null; p.legal.incarceration = null;
  check(search.yearList().map((v) => v.post.id).join() !== before, `${id}: a new list the next year`);
  check(search.recruiter().left === 3 && !search.recruiter().view, `${id}: the recruiter has three new looks the next year`);
}

// The economy changes how long the list is.
const sizes = {};
for (const phase of ['boom', 'slump']) {
  life('us');
  store.state.world ??= { places: {}, news: [] };
  store.state.world.places.us = { phase, since: store.state.year };
  let total = 0;
  for (let i = 0; i < 30; i++) total += search.listSize();
  sizes[phase] = total / 30;
}
check(sizes.boom > sizes.slump + 3, `a boom lists more openings than a recession (${sizes.boom.toFixed(1)} vs ${sizes.slump.toFixed(1)})`);

if (problems.length) { console.log(`${problems.length} problem(s):\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log('The job search works: a short list each year, and a recruiter with three looks.');
