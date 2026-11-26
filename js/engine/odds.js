// Chances the player can read: a chance in plain words before a roll, and after it, whether it was close.
// The roll itself is unchanged (one rng.next() against the chance, as rng.chance does), so nothing else in a life
// rolls differently because the game now says how it went.

/** A chance (0-1) in plain words. */
export function oddsWords(chance) {
  if (chance >= 0.8) return 'very likely';
  if (chance >= 0.6) return 'likely';
  if (chance >= 0.4) return 'about even';
  if (chance >= 0.2) return 'unlikely';
  return 'a long shot';
}

/**
 * Rolls against a chance and says how it went.
 * @param {{next: () => number}} dice  the game's rng (or a seeded one)
 * @returns {{ok: boolean, close: boolean, longShot: boolean}} close: missed by a little; longShot: came off at under 30%
 */
export function rollRead(dice, chance) {
  const r = dice.next();
  const ok = r < chance;
  return { ok, close: !ok && r - chance < 0.08, longShot: ok && chance < 0.3 };
}

/** The sentence to add after a result, or ''. */
export const afterWords = (read) => (read.close ? ' It was close: it could have gone either way.' : read.longShot ? ' A long shot that came off.' : '');
