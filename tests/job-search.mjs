// Checks the ordinary job search: this year's short list (not the whole market, one per line of work, mostly jobs the
// player can do, the same all year, mostly new the next year with prominent openings staying up to three, longer in a boom and shorter in a recession) and the job
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

let prominentSeen = 0;
for (const id of ['us', 'jp', 'ng', 'fr', 'br']) {
  const p = life(id);
  const list = search.yearList();
  const board = market.board().length;
  check(list.length >= 6 && list.length <= 16 && list.length < board, `${id}: the list is about a dozen, not the whole market (${list.length} of ${board} openings)`);
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
  const next = search.yearList();
  const stayed = next.filter((v) => list.some((w) => w.post.id === v.post.id));
  check(next.length - stayed.length >= next.length / 2, `${id}: most of the list is new the next year (${stayed.length} of ${next.length} stayed)`);
  check(stayed.every((v) => search.prominent(v.post)), `${id}: only prominent openings stay from one year to the next`);
  const big = list.filter((v) => search.prominent(v.post) && v.post.status === 'open');
  check(big.every((v) => next.some((w) => w.post.id === v.post.id)) || big.length > 5, `${id}: prominent openings are still listed the next year`);
  prominentSeen += big.length;
  check(search.recruiter().left === 3 && !search.recruiter().view, `${id}: the recruiter has three new looks the next year`);
}

check(prominentSeen > 0, 'some prominent openings were listed');

// A prominent opening stays three years, then makes way.
{
  const p = life('us');
  let big;
  for (let i = 0; i < 6 && !big; i++) { big = search.yearList().find((v) => search.prominent(v.post))?.post; if (!big) { advanceYear(); store.state.pendingEvents = []; p.legal.pending = null; p.legal.incarceration = null; } }
  check(!!big, 'a prominent opening comes up within a few years');
  if (big) {
    const years = [];
    for (let i = 0; i < search.PROMINENT_YEARS + 1; i++) {
      years.push(search.yearList().some((v) => v.post.id === big.id));
      advanceYear(); store.state.pendingEvents = []; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 80);
    }
    check(years.slice(0, search.PROMINENT_YEARS).every(Boolean) && !years[search.PROMINENT_YEARS], `a prominent opening is listed for ${search.PROMINENT_YEARS} years, then goes (${years.join(',')})`);
  }
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
console.log('The job search works: about a dozen openings each year, and a recruiter with three looks.');
