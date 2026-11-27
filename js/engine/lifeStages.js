// Turning points: at 13, 18 and 45 a person is asked who they are becoming (data/events/lifeStages.js), and offered
// three traits that fit how the last stretch of life was lived. A child who spent their afternoons drawing is offered
// Creative; a teenager with a crowd of friends, Outgoing; a forty-five-year-old with three promotions behind them,
// Ambitious. At 18 and 45 they may also grow out of one they have. None of it is forced: "none of these" is always there.
//
//   p.flags.stageOffer = { age, stage, ids: [three trait ids], drop: traitId | null, full: bool }   the open question
//   p.flags.stagesAsked = { [age]: true }
import { store, player } from '../state.js';
import { keyedDice } from './keyedDice.js';
import { storyBeat } from './storyDirector.js';
import { TRAITS, TRAIT_BY_ID, MAX_TRAITS } from '../data/traits.js';
import { addTrait, dropTrait, cannotTake } from './traits.js';

/** The ages that are turning points, and what each is called. */
export const STAGES = { 13: 'teen', 18: 'adult', 45: 'midlife' };

/** What a child's activities lean toward (data/childhood.js ids). */
const CHILD_LEANS = {
  lullaby: ['musical'], musicclass: ['musical', 'creative'], singing: ['musical', 'dramatic'], tummy: ['athletic'], tumbling: ['athletic'], dance: ['athletic', 'dramatic'],
  stagedance: ['dramatic', 'athletic'], playground: ['outgoing', 'athletic'], swim: ['athletic', 'hardy'], story: ['bookish'], toys: ['creative'], hobby: ['creative', 'steady'],
  babygroup: ['outgoing'], playdate: ['outgoing', 'sunny'], sleepover: ['outgoing'], fair: ['outgoing', 'adventurous'], club: ['outgoing', 'steady'], acting: ['dramatic'], youththeater: ['dramatic', 'musical'], art: ['creative'],
};
const CREATIVE_SKILLS = ['drawing', 'painting', 'photography', 'writing', 'guitar', 'piano', 'singing', 'violin', 'drums', 'acting', 'dance'];

/**
 * How well each trait fits the life so far, from what the game knows of it. Higher fits better; nothing here is luck.
 * @returns {Object<string, number>}
 */
export function fitOf(p = player(), stage = 'adult') {
  const s = {};
  const add = (id, n) => { s[id] = (s[id] ?? 0) + n; };
  const state = store.state;
  const live = Object.values(state.npcs).filter((n) => n.alive && p.npcIds.includes(n.id));
  // Childhood: what the child chose to do, year after year.
  if (stage === 'teen') for (const ids of Object.values(p.flags.childhood?.acts ?? {})) for (const id of ids) for (const t of CHILD_LEANS[id] ?? []) add(t, 0.6);
  // Friends: many, or none.
  const friends = live.filter((n) => ['friend', 'classmate'].includes(n.role) && n.meters.relationship >= 50).length;
  if (friends >= 4) { add('outgoing', 3); add('loyal', 1); } else if (friends <= 1) add('loner', 3);
  // Gifts and nature.
  const t = p.talents ?? {};
  if ((t.music ?? 0) >= 60 || (t.singing ?? 0) >= 60) add('musical', 2);
  if ((t.sports ?? 0) >= 60) add('athletic', 2);
  if ((t.acting ?? 0) >= 60) add('dramatic', 2);
  if ((t.crime ?? 0) >= 40) add('sly', 2);
  const st = p.stats ?? {}; const h = p.hidden ?? {};
  if (st.intellect >= 70) add('bookish', 2);
  if (st.mood >= 70) add('sunny', 2); else if (st.mood <= 35) add('worrier', 2);
  if (st.health >= 80) add('hardy', 1);
  if (st.charm >= 70) add('radiant', 2);
  if (h.karma >= 70) { add('gentle', 2); add('generous', 1); } else if (h.karma <= 30) { add('sly', 1); add('hothead', 1); }
  if (h.discipline >= 65) add('steady', 2); else if (h.discipline <= 35) add('restless', 2);
  if (h.crazy >= 60) { add('restless', 1); add('hothead', 1); }
  // Family.
  const kin = live.filter((n) => ['parent', 'sibling', 'grandparent'].includes(n.role));
  if (kin.length && kin.reduce((a, n) => a + n.meters.relationship, 0) / kin.length >= 70) { add('family_minded', 2); add('loyal', 1); }
  const kids = live.filter((n) => n.role === 'child').length;
  if (kids >= 2) add('family_minded', 2);
  // Love.
  const loves = live.filter((n) => ['partner', 'spouse', 'ex'].includes(n.role)).length + (p.counters?.spouses ?? 0);
  if (loves >= 2) add('romantic', 2);
  const spouse = live.find((n) => n.role === 'spouse');
  if (spouse?.marriedAtAge != null && p.age - spouse.marriedAtAge >= 10) add('loyal', 2);
  // The world, and home.
  const trips = (p.trips ?? []).filter((x) => !x.refused).length + (p.travel?.trips ?? []).filter((x) => x.status === 'completed').length;
  if (trips >= 3) add('adventurous', 2 + Math.min(2, trips / 5));
  const home = (p.assets ?? []).find((a) => a.id === p.homeId);
  if (home && trips === 0) add('homebody', 2);
  if ((home?.renovations ?? []).length >= 3) add('homebody', 1);
  if ((home?.renovations ?? []).some((r) => r.id === 'garden')) add('green_thumb', 2);
  // What they practice.
  const level = (id) => p.skills?.[id] ?? p.talents?.[id] ?? 0;
  if (CREATIVE_SKILLS.some((id) => level(id) >= 30)) add('creative', 2);
  if (level('gardening') >= 20) add('green_thumb', 3);
  // Work and money.
  const promotions = p.career?.promotions ?? 0;
  if (promotions >= 2 || (p.career?.level ?? 0) >= 3) add('ambitious', 3);
  if (p.career?.careerId && (p.career.stress ?? 50) <= 30) add('laid_back', 2);
  const earned = p.finance?.lifetimeEarned ?? 0;
  if (earned > 0 && p.finance.cash >= earned * 0.3) add('frugal', 2);
  else if (earned > 0 && p.finance.cash < earned * 0.05) add('big_spender', 2);
  return s;
}

/** Whether a trait could be offered: not held, not clashing with one held (the one being let go of aside). */
const offerable = (id, p, without = null) => {
  const keep = (p.traits ?? []).filter((x) => x !== without);
  return !keep.includes(id) && !cannotTake(id, { ...p, traits: keep }).replace(/A person has at most.*/, '');
};

/** What to ask at a turning point: three traits that fit, and one that fits least (to grow out of), if any. */
export function offerFor(p = player(), age = p.age) {
  const stage = STAGES[age];
  if (!stage) return null;
  const fit = fitOf(p, stage);
  const d = keyedDice(`stage/${store.state.slotId}/${age}`);
  const held = p.traits ?? [];
  // The one that fits least, to grow out of (not at 13: too soon to have outgrown anything).
  const drop = stage !== 'teen' && held.length ? [...held].sort((a, b) => (fit[a] ?? 0) - (fit[b] ?? 0))[0] : null;
  const full = held.length >= MAX_TRAITS;
  const pool = TRAITS.map((x) => x.id).filter((id) => offerable(id, p, full ? drop : null));
  const ids = [];
  while (ids.length < 3 && pool.length) {
    // The best fits are likeliest, but not certain: two lives alike are not offered quite the same.
    const id = d.weighted(pool, (x) => (fit[x] ?? 0) ** 2 + 0.4);
    pool.splice(pool.indexOf(id), 1);
    if (ids.some((y) => cannotTake(id, { ...p, traits: [y] }))) continue; // two opposites are not offered together
    ids.push(id);
  }
  if (ids.length < 3) return null;
  if (full && !drop) return null;
  return { age, stage, ids, drop, full };
}

const STAGE_WORDS = {
  teen: 'Thirteen. Who you are is starting to show, in what you choose and who you choose it with.',
  adult: 'Eighteen, and grown. The years since thirteen have left their mark.',
  midlife: 'Forty-five. Halfway, more or less. You know yourself better than you did, and you are still changing.',
};
const lower = (id) => TRAIT_BY_ID[id].name.toLowerCase();

/** Once a year: at a turning point, the question, once. Called from the year's steps, after the birthday. */
export function tickLifeStage() {
  const p = player();
  if (!p?.alive || !STAGES[p.age] || p.flags.stagesAsked?.[p.age]) return;
  (p.flags.stagesAsked ??= {})[p.age] = true;
  const o = offerFor(p);
  if (!o) return;
  p.flags.stageOffer = o;
  const words = { stage: STAGE_WORDS[o.stage], drop: o.drop ? lower(o.drop) : '' };
  o.ids.forEach((id, i) => { words[`t${i}`] = TRAIT_BY_ID[id].name; words[`d${i}`] = TRAIT_BY_ID[id].desc.split('. ')[0].replace(/\.$/, ''); });
  storyBeat(o.full ? 'life_stage_full' : o.drop ? 'life_stage_drop' : 'life_stage', { words }, { source: 'other', must: true });
}

/** The answer: '0' '1' '2' take that trait (instead of the one let go, when full), 'drop' lets one go, 'none' stays. */
export function stageChoice(what) {
  const p = player();
  const o = p.flags.stageOffer;
  if (!o) return null;
  p.flags.stageOffer = null;
  const source = o.stage;
  if (what === 'drop' && o.drop) return dropTrait(o.drop).text;
  const id = o.ids[Number(what)];
  if (!id) return null;
  if (o.full && o.drop) dropTrait(o.drop);
  return addTrait(id, source).text;
}
