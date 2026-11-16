// The arithmetic of marks. Pure functions with no imports, so the rules can
// be tested on their own (tests/schooling.mjs).
//
// Marks run from 0 to 4 inside the game. Ability and marks are different
// things: a year's mark comes from ability, work, interest, attendance and
// teaching together, and work counts for as much as ability does.

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * One subject's mark for one year.
 * @param {object} f
 * @param {number} f.ability     natural ability for the subject, 0–100
 * @param {number} f.effort      how hard the year was worked, 0–100
 * @param {number} f.discipline  0–100
 * @param {number} f.interest    interest in the subject, 0–100
 * @param {number} [f.absences]  days of school skipped, as the game counts them
 * @param {number} [f.teaching]  what the school and the teacher add, about -0.2..0.5
 * @param {number} [f.focus]     extra attention given to this subject this year, 0 or 1
 * @param {number} [f.support]   tutoring or other help, as marks (0.3 is a tutor)
 * @param {number} [f.luck]      about -0.25..0.25
 * @returns {number} 0–4
 */
export function yearMark(f) {
  const base = f.ability * 0.36 + f.effort * 0.34 + f.discipline * 0.1 + f.interest * 0.2;
  let g = base / 25;
  g += (f.teaching ?? 0) + (f.focus ? 0.35 : 0) + (f.support ?? 0) + (f.luck ?? 0);
  g -= (f.absences ?? 0) * 0.12;
  return clamp(Math.round(g * 100) / 100, 0, 4);
}

/** A running mark: mostly what it was, moved towards this year's. A first year stands as it is. */
export const carry = (before, year) => (before == null ? year : Math.round((before * 0.55 + year * 0.45) * 100) / 100);

/** How interest in a subject moves in a year: success and good teaching feed it, failure and dull lessons starve it. */
export function nextInterest(interest, mark, o = {}) {
  let n = interest + (mark - 2.2) * 3 + (o.teacher ?? 0) + (o.club ? 5 : 0) + (o.focus ? 2 : 0);
  // Interests drift back towards the middle unless something keeps feeding them.
  n += (50 - n) * 0.04;
  return clamp(Math.round(n), 0, 100);
}

/** Why a mark came out as it did, in plain words. */
export function reason(f, mark) {
  if ((f.absences ?? 0) >= 3) return 'you missed too many lessons';
  if (mark >= 3.2) {
    if (f.effort >= 65 && f.ability < 55) return 'you worked steadily all year, and it showed';
    if (f.ability >= 70 && f.effort < 45) return 'it comes easily to you, even without much work';
    if (f.interest >= 70) return 'you love it, and it does not feel like work';
    return 'you kept up with the work all year';
  }
  if (mark < 2) {
    if (f.ability >= 65 && f.effort < 45) return 'you could do it, and did not do the work';
    if (f.interest < 35) return 'it bores you, and you let it slide';
    if (f.effort >= 60) return 'you worked at it, and it still would not come';
    return 'you never quite got on top of it';
  }
  return f.effort >= 60 ? 'steady work kept you level' : 'you did enough, and no more';
}

/** A mark as a country writes it. */
export function showMark(g, grading) {
  if (g == null) return '';
  switch (grading) {
    case 'letters': return g >= 3.7 ? 'A*' : g >= 3.3 ? 'A' : g >= 2.7 ? 'B' : g >= 2 ? 'C' : g >= 1.4 ? 'D' : g >= 0.9 ? 'E' : 'U';
    case 'twenty': return `${(Math.round(g * 5 * 2) / 2).toString().replace('.', ',')}/20`;
    case 'german': return (Math.round((6 - g * 1.25) * 10) / 10).toFixed(1); // 1 is the best mark, 6 the worst
    case 'ten': return `${(Math.round(g * 2.5 * 10) / 10).toFixed(1)}/10`;
    case 'percent': return `${Math.round(30 + g * 17.5)}%`;
    default: return g.toFixed(2);
  }
}
/** What the marking scheme is called, for the screens. */
export const gradingNote = (grading) => ({ letters: 'Marked from A* down to U.', twenty: 'Marked out of 20.', german: 'Marked from 1 (the best) to 6.', ten: 'Marked out of 10.', percent: 'Marked as a percentage.', gpa: 'Marked as a grade point average, out of 4.' })[grading] ?? '';

/** Which of a country's stages a child of an age belongs in, or null. stages: [{ id, start }], oldest last. */
export function stageFor(age, stages, leavingAge = 18) {
  if (age >= leavingAge) return null;
  let found = null;
  for (const s of stages) if (age >= s.start) found = s;
  return found;
}
