// Heredity: what a child takes from its parents, and what it is born with.
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { TRAITS, TRAIT_BY_ID } from '../data/traits.js';
import { BIRTH_CONDITIONS } from '../data/birthConditions.js';

export const SKIN_TONES = 6;
export const HAIR_COLOURS = 5;
export const HAIR_STYLES = 3;
export const EYE_COLOURS = 4;

const stat = (mean, spread) => Math.round(clamp(rng.around(mean, spread)));

export function randomAppearance(skinHint) {
  return {
    skin: skinHint == null ? rng.int(0, SKIN_TONES - 1) : clamp(skinHint + rng.int(-1, 1), 0, SKIN_TONES - 1),
    hair: rng.int(0, HAIR_COLOURS - 1),
    hairStyle: rng.int(0, HAIR_STYLES - 1),
    eyes: rng.int(0, EYE_COLOURS - 1),
    weight: 50,
  };
}

export const randomTraits = (n = rng.int(1, 2)) => {
  const pool = TRAITS.map((t) => t.id);
  return Array.from({ length: n }, () => pool.splice(rng.int(0, pool.length - 1), 1)[0]);
};

export const randomTalents = () =>
  ({ music: rng.int(0, 55), sports: rng.int(0, 55), acting: rng.int(0, 55), crime: rng.int(0, 55) });

/** Stand-in genome for a parent who is not in the picture. */
export function unknownParent(other) {
  return {
    appearance: randomAppearance(other.appearance.skin),
    traits: randomTraits(1),
    talents: randomTalents(),
    meters: { intellect: stat(55, 35), charm: stat(55, 35), health: stat(80, 20), crazy: stat(30, 35) },
  };
}

/** Skin blends; hair and eye colour come from one parent, with rare surprises. */
export function inheritAppearance(mother, father) {
  const a = mother.appearance;
  const b = father.appearance;
  const drift = rng.chance(0.3) ? rng.pick([-1, 1]) : 0;
  return {
    skin: clamp(Math.round((a.skin + b.skin) / 2 + drift), 0, SKIN_TONES - 1),
    hair: rng.chance(0.1) ? rng.int(0, HAIR_COLOURS - 1) : rng.pick([a.hair, b.hair]),
    hairStyle: rng.int(0, HAIR_STYLES - 1),
    eyes: rng.chance(0.1) ? rng.int(0, EYE_COLOURS - 1) : rng.pick([a.eyes, b.eyes]),
    weight: 50,
  };
}

/**
 * Each parental trait has a 45% chance of passing on; now and then a child
 * shows a trait neither parent has.
 * @returns {{traits:string[], sources:Object<string,'mother'|'father'|'self'>}}
 */
export function inheritTraits(mother, father) {
  const sources = {};
  for (const [who, parent] of [['mother', mother], ['father', father]]) {
    for (const id of parent.traits ?? []) {
      if (TRAIT_BY_ID[id] && !sources[id] && rng.chance(0.45)) sources[id] = who;
    }
  }
  const own = Object.keys(sources).length;
  if (own === 0 || (own < 3 && rng.chance(0.2))) {
    const fresh = TRAITS.map((t) => t.id).filter((id) => !sources[id]);
    sources[rng.pick(fresh)] = 'self';
  }
  const traits = Object.keys(sources).slice(0, 3);
  return { traits, sources: Object.fromEntries(traits.map((id) => [id, sources[id]])) };
}

/** Talents regress toward the parents' average. `gift` forces one to be exceptional. */
export function inheritTalents(mother, father, gift) {
  const t = {};
  for (const key of ['music', 'sports', 'acting', 'crime']) {
    const mean = ((mother.talents?.[key] ?? 28) + (father.talents?.[key] ?? 28)) / 2;
    t[key] = Math.round(clamp(rng.around(mean, 24)));
  }
  const chosen = gift ?? (rng.chance(0.25) ? rng.pick(Object.keys(t)) : null);
  if (chosen) t[chosen] = Math.max(t[chosen], rng.int(75, 100));
  return t;
}

export function inheritStats(mother, father) {
  const avg = (k) => (mother.meters[k] + father.meters[k]) / 2;
  return {
    stats: {
      mood: stat(80, 20),
      health: stat(70 + avg('health') * 0.2, 16),
      intellect: stat(avg('intellect'), 22),
      charm: stat(avg('charm'), 22),
    },
    hidden: {
      karma: 50, discipline: stat(50, 30), willpower: stat(50, 30),
      fertility: stat(70, 25), fame: 0, crazy: stat(avg('crazy'), 20),
    },
  };
}

/** @returns {typeof BIRTH_CONDITIONS} at most two */
export function rollBirthConditions() {
  return BIRTH_CONDITIONS.filter((b) => rng.chance(b.chance)).slice(0, 2);
}

/** Applies a trait's or birth condition's stat, hidden and talent modifiers. */
export function applyMods(person, def) {
  for (const group of ['stats', 'hidden', 'talents']) {
    for (const [k, v] of Object.entries(def[group] ?? {})) {
      person[group][k] = clamp(person[group][k] + v);
    }
  }
}
