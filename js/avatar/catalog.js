// The parts catalogue: every piece of avatar artwork, grouped by feature,
// plus the rules for turning whatever is in a save into a complete appearance.
//
// An appearance has two halves, saved on each character:
//   inherited: what they were born with. Set once, at birth, never changed.
//              face, skin, eyeShape, eyeColor, brows, nose, lips,
//              hairColor (natural), hairTexture, marks[]
//   style:     how they wear it today. Changed at the salon.
//              hair (cut), hairDye, glasses, facialHair, makeup, lipColor
// Children are built from their parents' `inherited` halves only, so a
// parent's dye or haircut never reaches a child.
import { SKIN_TONES } from './parts/skin.js';
import { FACES } from './parts/face.js';
import { EYE_SHAPES, EYE_COLORS } from './parts/eyes.js';
import { BROWS } from './parts/brows.js';
import { NOSES } from './parts/nose.js';
import { LIPS, LIP_COLORS } from './parts/lips.js';
import { HAIR_STYLES, HAIR_COLORS, HAIR_TEXTURES } from './parts/hair.js';
import { MARKS, GLASSES, FACIAL_HAIR, MAKEUP } from './parts/extras.js';

/** Every list of parts, by the key it is saved under. */
export const CATALOG = {
  face: FACES, skin: SKIN_TONES, eyeShape: EYE_SHAPES, eyeColor: EYE_COLORS, brows: BROWS, nose: NOSES, lips: LIPS,
  hairColor: HAIR_COLORS.filter((c) => c.natural), hairTexture: HAIR_TEXTURES, marks: MARKS,
  hair: HAIR_STYLES, hairDye: HAIR_COLORS, glasses: GLASSES, facialHair: FACIAL_HAIR, makeup: MAKEUP, lipColor: LIP_COLORS,
};

/** Born with: one id each, except marks, which is a list of ids. */
export const INHERITED_KEYS = ['face', 'skin', 'eyeShape', 'eyeColor', 'brows', 'nose', 'lips', 'hairColor', 'hairTexture'];
/** Styling: hair must have a value; the others may be null (none). */
export const STYLE_KEYS = ['hair', 'hairDye', 'glasses', 'facialHair', 'makeup', 'lipColor'];

const INDEX = Object.fromEntries(Object.entries(CATALOG).map(([k, list]) => [k, Object.fromEntries(list.map((x) => [x.id, x]))]));
// Any hair colour can be looked up, natural or not.
INDEX.anyHair = Object.fromEntries(HAIR_COLORS.map((x) => [x.id, x]));

/** The part with this id, or undefined. */
export const part = (key, id) => INDEX[key]?.[id];
export const has = (key, id) => !!part(key, id);

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** A stable choice from a list for a given seed: the same seed always gives the same part. */
const seeded = (list, seed, salt) => list[hash(`${seed}:${salt}`) % list.length];

// Saves made before this avatar system stored four numbers. These tables
// carry those characters over to the closest new parts.
const OLD_SKIN = ['ivory', 'sand', 'golden', 'tan', 'chestnut', 'espresso'];
const OLD_HAIR = ['black', 'brown', 'light_brown', 'blonde', 'auburn'];
const OLD_EYES = ['dark_brown', 'blue', 'green', 'hazel'];
const OLD_STYLE = ['short_crop', 'side_part', 'long_straight'];

/** Styles that suit a natural texture (never the shaved head). */
export const stylesFor = (texture) => HAIR_STYLES.filter((s) => s.textures.includes(texture));

/**
 * Returns a complete, valid appearance for whatever was saved: a current
 * one (returned with any gaps filled), an old four-number one, or nothing.
 * Missing pieces are chosen from the seed, so the same character always
 * gets the same face. Unknown ids (artwork that was removed) fall back the
 * same way. The input is not changed.
 * @param {object} [a]  saved appearance, any version
 * @param {string} [seed]  usually the character's id
 */
export function normalize(a, seed = 'x') {
  const src = a?.inherited ?? {};
  const old = a && !a.inherited ? a : {};
  const from = {
    skin: OLD_SKIN[old.skin], hairColor: OLD_HAIR[old.hair], eyeColor: OLD_EYES[old.eyes],
  };
  const inherited = {};
  for (const key of INHERITED_KEYS) {
    const id = src[key] ?? from[key];
    inherited[key] = has(key, id) ? id : seeded(CATALOG[key], seed, key).id;
  }
  // Old saves had no texture: derive one that fits, so the haircut below suits it.
  inherited.marks = Array.isArray(src.marks) ? src.marks.filter((id) => has('marks', id))
    : hash(`${seed}:marks`) % 9 === 0 ? ['freckles'] : [];

  const st = a?.style ?? {};
  const style = {};
  const suited = stylesFor(inherited.hairTexture);
  const oldCut = OLD_STYLE[old.hairStyle];
  style.hair = has('hair', st.hair) ? st.hair : has('hair', oldCut) ? oldCut : seeded(suited.length ? suited : HAIR_STYLES, seed, 'hair').id;
  style.hairDye = INDEX.anyHair[st.hairDye] ? st.hairDye : null;
  for (const key of ['glasses', 'facialHair', 'makeup', 'lipColor']) style[key] = has(key, st[key]) ? st[key] : null;
  return { v: 2, inherited, style };
}

/** How deep a character's inherited skin tone is, 0 (lightest) upwards. */
export const skinDepth = (appearance, seed) => part('skin', normalize(appearance, seed).inherited.skin).depth;

/** The colour the hair shows as today: the dye if there is one, else the natural colour. */
export const hairHex = (appearance) => (INDEX.anyHair[appearance.style.hairDye] ?? INDEX.anyHair[appearance.inherited.hairColor]).hex;

export { SKIN_TONES, FACES, EYE_SHAPES, EYE_COLORS, BROWS, NOSES, LIPS, LIP_COLORS, HAIR_STYLES, HAIR_COLORS, HAIR_TEXTURES,
  MARKS, GLASSES, FACIAL_HAIR, MAKEUP };
