// Dice of their own, for systems added to a life that already has its own sequence of rolls (engine/blended.js,
// engine/fostering.js). The same key gives the same numbers every time, and the game's own dice (rng.js) are never
// touched: a life plays exactly as it did before these systems existed, except where they actually do something.
// The same idea as the neighborhoods' keyed luck (engine/neighborhood.js luck).
import { rng } from '../rng.js';
import { hash } from './sportsPlay.js';

/** A private run of dice for one key, with the same methods as rng (int, chance, pick, weighted, around). */
export function keyedDice(key) {
  let st = hash(String(key)) || 1;
  return {
    ...rng,
    seed(n) { st = (n >>> 0) || 1; },
    state() { return st; },
    next() {
      st = (st + 0x6D2B79F5) >>> 0;
      let t = st;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/**
 * Runs `fn` (making a person, say, which rolls the game's dice inside) on dice of its own, then puts the game's dice
 * back exactly where they were.
 */
export function onOwnDice(key, fn) {
  const saved = rng.state();
  rng.seed(hash(String(key)) || 1);
  try { return fn(); } finally { rng.seed(saved); }
}
