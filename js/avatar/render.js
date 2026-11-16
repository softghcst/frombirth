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
export function dressOfPlayer(p) {
  return { jailed: !!p.legal?.incarceration, royal: p.royal && !p.royal.waiting ? royalDress(p.royal.rank) : null,
    career: p.career?.careerId && !p.career.retired ? { id: p.career.careerId, level: p.career.level ?? 0 } : null };
}

/** A colour part-way from a to b. Kept for older callers. */
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
  const look = resolveLook(o.appearance, seed, o.gender);
  const age = o.age ?? 25;
  // Lipstick is a grown-up's choice: children's lips stay their natural colour.
  if (age < 13) look.colors.lip = mixHex(look.colors.skin, '#b8444f', 0.4);
  return characterAvatarSvg(look, { age, gender: o.gender, mood: o.mood, jailed: o.jailed, royal: o.royal, career: o.career, emotion: o.emotion, label: o.label },
    { size: o.size, viewBox: o.viewBox });
}
