// Portraits for the game's screens. Everything is drawn by the
// CharacterAvatar system (js/CharacterAvatar.js) from the artwork in
// assets/avatars/; this file turns what the game knows about a person
// (their saved appearance, age, what they are doing) into a portrait.
import { resolveLook } from './catalog.js';
import { characterAvatarSvg } from '../CharacterAvatar.js';
import { mixHex } from './color.js';

/** A royal or noble rank as portraits dress it: crowns for the royal family, a coronet for the peerage. */
export function royalDress(rank) {
  if (!rank || rank === 'knight') return null;
  return { rank: ['monarch', 'heir', 'royal'].includes(rank) ? rank : 'noble' };
}

/** The player's portrait context: in prison, royal, or at work. */
/**
 * Which way the player's face reads: the body they were born with, until hormones have had a year to work. A trans man
 * who has come out lives as a man (his name, clothes, hair and title change at once), but his face changes with
 * testosterone, not with the announcement; a trans woman's likewise. Someone who is not trans: their gender.
 * The changes that hormones make to a face mostly stay, so a year or more on them keeps the new face even if they stop.
 */
export function faceGenderOf(p) {
  const born = p.flags?.bornAs ?? p.gender;
  const trans = born !== p.gender || (!!p.flags?.trueGender && p.flags.trueGender !== born);
  if (!trans) return p.gender;
  const id = p.flags?.identity ?? {};
  const years = (id.hrtYears ?? 0) + (id.hrtAge != null ? Math.max(0, (p.age ?? 0) - id.hrtAge) : 0);
  if (years < 1) return born;
  const who = p.gender !== born ? p.gender : p.flags.trueGender ?? p.gender;
  return who === 'nonbinary' ? (born === 'male' ? 'female' : 'male') : who;
}

export function dressOfPlayer(p) {
  return { face: faceGenderOf(p), jailed: !!p.legal?.incarceration, royal: p.royal && !p.royal.waiting ? royalDress(p.royal.rank) : null,
    career: p.career?.careerId && !p.career.retired ? { id: p.career.careerId, level: p.career.level ?? 0 } : null };
}

/** A color part-way from a to b. Kept for older callers. */
export const mix = mixHex;

/**
 * @param {{age:number, gender?:string, appearance?:object, seed?:string, jailed?:boolean, mood?:number,
 *          royal?:{rank:string}, career?:{id:string, level?:number}, emotion?:string, label?:string, size?:number, viewBox?:string}} o
 *   appearance may be any saved version, or missing; `seed` (the character's
 *   id) fills gaps the same way every time.
 * @returns {string} inline SVG markup
 */
export function avatarSvg(o) {
  const seed = String(o.seed ?? 'x');
  const age = o.age ?? 25;
  // Lipstick is a grown-up's choice: children's lips stay their natural color.
  // The face (lips and their color, an old man's brows) follows `face` where it is given: see faceGenderOf.
  const look = resolveLook(o.appearance, seed, o.face ?? o.gender, { child: age < 13 });
  return characterAvatarSvg(look, { age, gender: o.gender, face: o.face ?? o.gender, mood: o.mood, jailed: o.jailed, royal: o.royal, career: o.career, emotion: o.emotion, label: o.label },
    { size: o.size, viewBox: o.viewBox });
}
