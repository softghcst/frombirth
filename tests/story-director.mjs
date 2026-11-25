// Checks the Story Director (engine/storyDirector.js): every storyline's optional beats are paced together by the
// life's drama setting, taking turns between storylines; must-tell beats always play; what is not told this year
// waits and comes back, and is dropped if the people in it have died; consequences and untagged scenes are never
// touched; and it runs once per world year whatever the turn length. Run with: node tests/story-director.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { advanceTurn } from '../js/engine/turns.js';
import { makeNpc } from '../js/engine/npcFactory.js';
import { storyBeat, directYear, BUDGET, yearSteps } from '../js/engine/storyDirector.js';
yearSteps.on = true; // these beats are queued as if by the yearly steps

rng.seed(808);
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };
store.state = createLife({ countryId: 'us' });
const st = store.state;
const fresh = () => { st.pendingEvents = []; st.storyDirector = undefined; };

// The budget follows the drama setting; must-tell beats always play; untagged scenes are untouched.
for (const level of ['low', 'balanced', 'high']) {
  fresh(); st.settings = { ...(st.settings ?? {}), drama: level };
  st.pendingEvents.push({ id: 'some_consequence', cast: {} });
  for (const src of ['love', 'family', 'medicine', 'sport', 'abroad', 'friends']) { storyBeat(`${src}_a`, {}, { source: src }); storyBeat(`${src}_b`, {}, { source: src }); }
  storyBeat('match_day', {}, { source: 'medicine', must: true });
  directYear();
  const optional = st.pendingEvents.filter((e) => e.story && !e.story.must);
  check(optional.length === BUDGET[level], `${level}: ${BUDGET[level]} optional beats a year (${optional.length})`);
  check(st.pendingEvents.some((e) => e.id === 'match_day') && st.pendingEvents.some((e) => e.id === 'some_consequence'), `${level}: must-tell beats and consequences always play`);
  check(new Set(optional.map((e) => e.story.source)).size === optional.length, `${level}: storylines take turns (${optional.map((e) => e.id).join(', ')})`);
}
// What waits comes back first next year; a beat about someone who has died is dropped.
fresh(); st.settings.drama = 'low';
const n = makeNpc({ role: 'friend', countryId: 'us', age: 30 }); st.npcs[n.id] = n;
for (const src of ['love', 'family', 'sport']) storyBeat(`${src}_x`, {}, { source: src });
storyBeat('friends_y', { pal: n.id }, { source: 'friends' });
directYear();
const heldIds = st.storyDirector.held.map((h) => h.ev.id);
check(heldIds.length === 2, `two beats wait for next year (${heldIds.join(', ')})`);
st.pendingEvents = []; st.year += 1;
if (heldIds.includes('friends_y')) n.alive = false;
directYear();
const back = st.pendingEvents.map((e) => e.id);
check(heldIds.filter((id) => id !== 'friends_y' || n.alive).every((id) => back.includes(id)), `held beats come back first (${back.join(', ')})`);
check(!back.includes('friends_y') || n.alive, 'a held beat about someone who has died is dropped');
// Turn length: once per world year.
yearSteps.on = false;
fresh();
store.state = createLife({ countryId: 'us' });
store.state.settings = { ...(store.state.settings ?? {}), step: 3, drama: 'balanced' };
let runs = 0;
const y0 = store.state.year;
for (let i = 0; i < 8; i++) { advanceTurn(); store.state.pendingEvents = []; store.state.player.alive = true; }
runs = store.state.yearMarks?.storyDirector === y0 + 2 ? 2 : -1;
check(runs === 2, 'the Director runs once a world year with 3-month turns');
// A real life: across twenty years, no year carries more optional beats than the budget allows.
rng.seed(909);
store.state = createLife({ countryId: 'us' });
store.state.settings = { ...(store.state.settings ?? {}), drama: 'balanced' };
let worst = 0;
for (let i = 0; i < 20; i++) {
  advanceYear();
  const optional = store.state.pendingEvents.filter((e) => e.story && !e.story.must && e.story.year >= store.state.year - 2).length;
  worst = Math.max(worst, optional);
  store.state.pendingEvents = []; store.state.player.alive = true; store.state.player.stats.health = Math.max(store.state.player.stats.health, 70);
}
check(worst <= BUDGET.balanced, `a lived life never gets more optional story beats in a year than the budget (${worst})`);
if (problems.length) { console.log(`PROBLEMS (${problems.length}):\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log('The Story Director paces every storyline together.');
