// What speaking a language is worth. A language is a skill like any other
// (engine/skills.js); this is where it starts to matter:
//   - moving to a country where it is spoken is easier, and so is finding work there
//   - without it, life abroad is harder, though living there teaches it slowly
//   - employers like it, wherever the player lives
//   - a head of government who speaks a partner's language does better there
import { clamp } from '../util.js';
import { player } from '../state.js';
import { SPOKEN, SKILL_BY_ID } from '../data/skills.js';

const level = (p, id) => Math.round(p.skills?.[id] ?? 0);

/** The languages a country lives in, as skill ids. Empty where the game's common tongue is enough. */
export const languagesOf = (countryId) => Object.entries(SPOKEN).filter(([, where]) => where.includes(countryId)).map(([id]) => id);

/**
 * How well the player speaks the language of a country, 0–100.
 * null: no language is needed there. Someone born there speaks it natively.
 */
export function speaks(countryId, p = player()) {
  const list = languagesOf(countryId);
  if (!list.length) return null;
  if (p.birthCountryId === countryId) return 100;
  // The same language is spoken where they were born: a Brazilian in Portugal, an Austrian in Germany.
  if (list.some((id) => languagesOf(p.birthCountryId).includes(id))) return 100;
  return Math.max(...list.map((id) => level(p, id)));
}
/** In words, for the screens. */
export function fluency(countryId, p = player()) {
  const s = speaks(countryId, p);
  if (s == null || p.birthCountryId === countryId) return '';
  const names = languagesOf(countryId).map((id) => SKILL_BY_ID[id].name).join(' or ');
  return s >= 70 ? `you speak ${names} well` : s >= 40 ? `you get by in ${names}` : s > 0 ? `your ${names} is not yet enough to live in` : `you do not speak ${names}`;
}

/** What it adds to (or takes from) a visa application. */
export function visaEdge(countryId, p = player()) {
  const s = speaks(countryId, p);
  return s == null ? 0 : s >= 70 ? 0.15 : s >= 40 ? 0.08 : -0.08;
}

/** What it does to the odds of being hired, where the player lives now. */
export function hiringEdge(p = player()) {
  // Each language spoken well is something for the application; three is as many as anyone counts.
  const known = Object.keys(SPOKEN).concat('sign_language').filter((id) => level(p, id) >= 60).length;
  let edge = Math.min(3, known) * 0.03;
  const here = speaks(p.countryId, p);
  if (here != null && here < 40) edge -= 0.18; // an interview in a language you cannot follow
  else if (here != null && here < 70) edge -= 0.06;
  return edge;
}

/** Living somewhere teaches its language, slowly: a few points a year, more for the young. */
export function tickLanguages() {
  const p = player();
  if (p.birthCountryId === p.countryId || p.age < 3) return null;
  const list = languagesOf(p.countryId);
  if (!list.length) return null;
  const id = list.reduce((best, x) => (level(p, x) >= level(p, best) ? x : best), list[0]);
  const before = level(p, id);
  if (before >= 85) return null;
  p.skills ??= {};
  p.skills[id] = clamp(before + (p.age < 14 ? 9 : p.age < 30 ? 6 : 4));
  const after = level(p, id);
  const name = SKILL_BY_ID[id].name;
  if (before < 40 && after >= 40) return `After living here a while, you find you can get by in ${name}.`;
  if (before < 70 && after >= 70) return `You catch yourself dreaming in ${name}. You speak it well now.`;
  return null;
}

/** Two weeks somewhere is practice for a language already begun. Returns its name if it improved. */
export function practice(countryId, p = player()) {
  const id = languagesOf(countryId).filter((x) => level(p, x) > 0 && level(p, x) < 85).sort((a, b) => level(p, b) - level(p, a))[0];
  if (!id) return null;
  p.skills[id] = clamp(level(p, id) + 2);
  return SKILL_BY_ID[id].name;
}

/** What a leader's own languages are worth in dealings with a country, 0 or a small bonus. */
export const envoyEdge = (countryId, p = player()) => { const s = speaks(countryId, p); return s != null && p.birthCountryId !== countryId && s >= 50 ? 1 : 0; };
