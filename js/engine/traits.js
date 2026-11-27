// Traits after birth: having one, taking one on, letting one go, and the small, steady effects they have.
//
// A trait's `effects` (data/traits.js) are read where they matter, through traitK and traitAdd: how fast friends
// drift, how a quarrel goes, what a year of living costs. Each is small on its own (a fifth, a few points of mood), and
// a life holds at most MAX_TRAITS, so no trait makes a life.
import { store, player, log, milestone } from '../state.js';
import { TRAITS, TRAIT_BY_ID, MAX_TRAITS } from '../data/traits.js';
import { applyMods } from './genetics.js';

/** Whether someone (the player, by default) has a trait. */
export const hasTrait = (id, p = player()) => !!p?.traits?.includes(id);
/** The trait that cannot be held with this one, either way round. */
export const oppositeOf = (id) => TRAIT_BY_ID[id]?.opposite ?? TRAITS.find((t) => t.opposite === id)?.id ?? null;
/** Whether these traits clash: two that are opposites. */
export const clashes = (id, list) => list.some((x) => oppositeOf(x) === id || oppositeOf(id) === x);

/** Product of a multiplying effect (keys ending in K) across someone's traits: 1 when none has it. */
export function traitK(key, p = player()) {
  let k = 1;
  for (const id of p?.traits ?? []) { const v = TRAIT_BY_ID[id]?.effects?.[key]; if (v != null) k *= v; }
  return k;
}
/** Sum of an adding effect across someone's traits: 0 when none has it. */
export function traitAdd(key, p = player()) {
  let n = 0;
  for (const id of p?.traits ?? []) n += TRAIT_BY_ID[id]?.effects?.[key] ?? 0;
  return n;
}

/**
 * Why a trait cannot be taken on now, or '' if it can: one already held, one that clashes, or a full set.
 * @param {string} id
 */
export function cannotTake(id, p = player()) {
  if (!TRAIT_BY_ID[id]) return 'There is no such trait.';
  if (hasTrait(id, p)) return 'You are that already.';
  const clash = (p.traits ?? []).find((x) => oppositeOf(x) === id || oppositeOf(id) === x);
  if (clash) return `It does not sit with being ${TRAIT_BY_ID[clash].name.toLowerCase()}.`;
  if ((p.traits ?? []).length >= MAX_TRAITS) return `A person has at most ${MAX_TRAITS} traits.`;
  return '';
}

/**
 * Takes on a trait. Its one-time changes (stats, hidden, talents) apply now, as they would have at birth.
 * `source` says where it came from, for the Self tab: 'teen', 'adult', 'midlife', 'scene'.
 */
export function addTrait(id, source = 'scene', p = player()) {
  const why = cannotTake(id, p);
  if (why) return { ok: false, text: why };
  (p.traits ??= []).push(id);
  (p.traitSources ??= {})[id] = source;
  applyMods(p, TRAIT_BY_ID[id]);
  const t = TRAIT_BY_ID[id];
  if (p === player()) milestone(`Became ${t.name.toLowerCase()}.`, 'life');
  return { ok: true, text: `You are ${t.name.toLowerCase()} now.` };
}

/** Lets a trait go: people change. What it did at the time (a stat it raised) stays as it is now. */
export function dropTrait(id, p = player()) {
  if (!hasTrait(id, p)) return { ok: false, text: 'You are not that.' };
  p.traits = p.traits.filter((x) => x !== id);
  if (p.traitSources) delete p.traitSources[id];
  if (p === player()) log(`You are not so ${TRAIT_BY_ID[id].name.toLowerCase()} as you were.`, 'system', 'neutral');
  return { ok: true, text: `You let go of being ${TRAIT_BY_ID[id].name.toLowerCase()}.` };
}

/** How a scene's chance of being drawn shifts with the player's traits: `ev.traits` = { traitId: multiplier }, and love scenes for romantics. */
export function traitWeight(ev, p = player()) {
  let w = 1;
  for (const [id, k] of Object.entries(ev.traits ?? {})) if (hasTrait(id, p)) w *= k;
  if (['love', 'romance', 'dating'].includes(ev.category)) w *= traitK('loveK', p);
  return w;
}

// ---------- The year ----------

/**
 * Once a year: what traits do to a mood over a year. A loner living alone, a family-minded parent with children at
 * home, an ambitious adult with no work, an adventurous one who went nowhere. A few points, never more.
 */
export function tickTraits() {
  const p = player();
  if (!p?.alive || !p.traits?.length) return;
  const state = store.state;
  const live = Object.values(state.npcs).filter((n) => n.alive && p.npcIds.includes(n.id));
  let d = traitAdd('yearMood', p);
  const alone = !p.flags.livesWithParents && p.age >= 18 && !live.some((n) => ['spouse'].includes(n.role) || (n.role === 'partner' && n.flags.livingTogether));
  if (alone) d += traitAdd('aloneMood', p);
  const kids = live.filter((n) => n.role === 'child' && n.age < 18).length;
  if (kids) d += traitAdd('kidsMood', p) * Math.min(3, kids);
  const idle = p.age >= 22 && p.age < 65 && !p.career?.careerId && !p.education?.enrolled && !p.career?.retired && !p.legal?.incarceration;
  if (idle) d += traitAdd('idleMood', p);
  const traveled = (p.travel?.trips ?? []).some((t) => t.status === 'completed' && t.completedYear === state.year) || (p.trips ?? []).some((t) => t.year === state.year && !t.refused);
  d += traveled ? traitAdd('tripMood', p) : traitAdd('stuckMood', p);
  if ((state.player.assets ?? []).some((a) => a.id === p.homeId && (a.renovations ?? []).some((r) => r.id === 'garden' && r.result !== 'poor'))) d += traitAdd('gardenMood', p);
  if (d) p.stats.mood = Math.max(0, Math.min(100, p.stats.mood + d));
}

/** For the tests and the Self tab: every trait a life could have, and whether this one could take it on now. */
export const allTraits = () => TRAITS;
