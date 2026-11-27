// The Story Director: one hand on the pacing of every storyline in a life.
//
// Each storyline already decides what is TRUE to tell (engine/loveStories.js, familyStories.js, sportsArcs.js,
// abroadArcs.js, animalArcs.js, animalLife.js, digital/stories.js, together.js, investigations/drama.js, schoollife.js,
// campus.js, kidschool.js, workEvents.js, moments.js, medicine/drama.js and medicine/story.js): a story whose test fails is never offered, and nothing is invented to tell one. What none of
// them could see was the others, so a busy year could bring a love story, a family story, a hospital drama, a sports
// arc and a life-abroad scene all at once. The Director sees them together.
//
// How it works: a storyline queues its scene with storyBeat() instead of pushing it straight onto the year's
// scenes. It is queued at once (so the order within a turn and every existing test of "is it waiting" still hold),
// tagged with where it came from. Once a world year, as the last of the yearly steps (engine/yearProcessor.js), the
// Director looks at the tagged scenes waiting and keeps, by the life-wide drama setting (Settings, Story drama):
//
//   - every scene marked `must` (a consequence, a once-in-a-life moment such as Match Day or a leadership offer)
//   - and within the year's budget, the optional ones: highest weight first, but taking turns between storylines,
//     and favoring storylines that were quiet last year.
//
// Scenes over the budget are not lost: they wait (state.storyDirector.held) and are offered again first next year,
// for up to two years, as long as the people in them are still alive. Consequences, decisions the player has to
// make and scenes not tagged as story beats are never touched; neither are scenes with their own calendar (the
// neighborhood's months, a season's scenes), which are told when their time comes. Runs once per world year, so a 3-, 6- or 12-month
// Age Up paces stories the same.
//
//   state.storyDirector = { held: [{ ev, meta, since }], history: [{ year, id, source }], quiet: { [source]: year } }
import { store } from '../state.js';

/** How many optional story beats a year can carry, by the drama setting (Settings). */
export const BUDGET = { low: 2, balanced: 3, high: 5 };
export const dramaSetting = (state = store.state) => (BUDGET[state.settings?.drama] ? state.settings.drama : 'balanced');

/** The storylines and their names (for the history and the tests). */
export const SOURCES = {
  love: 'Love and relationships', family: 'Family', medicine: 'Medicine and hospital life', sport: 'Sport', abroad: 'Life abroad',
  animals: 'Animals', digital: 'Digital life', friends: 'Friends', investigations: 'Investigations', school: 'School and campus', work: 'Work', health: 'Health and reproductive care', origins: 'Adoption and birth family',
};

const dir = (state = store.state) => {
  const d = (state.storyDirector ??= {});
  d.held ??= []; d.history ??= []; d.quiet ??= {};
  return d;
};

/** Set by engine/yearProcessor.js while the yearly steps run. */
export const yearSteps = { on: false };

/**
 * Queues a story beat. `meta`: { source, must, weight }. A must-tell beat always plays; an optional one is paced.
 * Returns false (and queues nothing) if the same scene is already waiting.
 */
export function storyBeat(id, cast = {}, meta = {}, state = store.state) {
  if (state.pendingEvents.some((e) => e.id === id && JSON.stringify(e.cast ?? {}) === JSON.stringify(cast ?? {}))) return false;
  // Only beats queued in the yearly steps are paced (the same whatever the turn length); one queued between years by
  // something the player did, or by a season, is told as it comes.
  state.pendingEvents.push(yearSteps.on
    ? { id, cast, story: { source: meta.source ?? 'other', must: !!meta.must, weight: meta.weight ?? 1, year: state.year } }
    : { id, cast });
  return true;
}

/** Whether the people a held scene is about are still alive (a held scene about someone who has died is dropped). */
function stillTrue(ev, state) {
  for (const [k, v] of Object.entries(ev.cast ?? {})) {
    if (k === 'words' || typeof v !== 'string') continue;
    const n = state.npcs?.[v];
    if (n && n.alive === false) return false;
  }
  return true;
}

/** The yearly step: keeps the must-tell beats, paces the optional ones, holds the rest for next year. */
export function directYear(state = store.state) {
  const d = dir(state);
  const pending = state.pendingEvents;
  // Last year's held beats come back first (as long as they are still true and not two years old).
  const back = d.held.filter((h) => state.year - h.since <= 2 && stillTrue(h.ev, state) && !pending.some((e) => e.id === h.ev.id));
  d.held = [];
  for (const h of back) pending.unshift({ ...h.ev, story: { ...h.ev.story, held: true } });
  const beats = pending.filter((e) => e.story && !e.story.must);
  let budget = BUDGET[dramaSetting(state)];
  // Take turns between storylines: the highest-weight beat of each, the quiet storylines first, then round again.
  const bySource = {};
  for (const e of beats) (bySource[e.story.source] ??= []).push(e);
  for (const list of Object.values(bySource)) list.sort((a, b) => (b.story.held ? 1 : 0) - (a.story.held ? 1 : 0) || b.story.weight - a.story.weight);
  const order = Object.keys(bySource).sort((a, b) => (d.quiet[a] ?? -99) - (d.quiet[b] ?? -99));
  const keep = new Set();
  for (let round = 0; budget > 0 && order.some((s) => bySource[s].length > round); round++) {
    for (const s of order) {
      if (budget <= 0) break;
      const e = bySource[s][round];
      if (e) { keep.add(e); budget -= 1; }
    }
  }
  // What is not kept waits; everything kept is written down.
  for (const e of beats) {
    if (keep.has(e)) continue;
    pending.splice(pending.indexOf(e), 1);
    if (!e.story.held) d.held.push({ ev: { id: e.id, cast: e.cast, story: e.story }, since: state.year });
  }
  for (const e of pending.filter((x) => x.story)) {
    d.history.push({ year: state.year, id: e.id, source: e.story.source, must: e.story.must });
    d.quiet[e.story.source] = state.year;
  }
  if (d.history.length > 200) d.history.splice(0, d.history.length - 200);
  return { kept: [...keep].map((e) => e.id), held: d.held.map((h) => h.ev.id) };
}
