// The parts catalog: every piece of avatar artwork (from the generated
// manifest, js/avatarManifest.js) and every color (js/avatarPalettes.js),
// grouped by feature, plus the rules for turning whatever is in a save into
// a complete appearance.
//
// An appearance has two halves, saved on each character:
//   inherited: what they were born with. Set once, at birth, never changed.
//              head, skin, eyes, eyeColor, brows, nose, lips, hairColor (natural), hairTexture, marks[]
//   style:     how they wear it today. Changed at the salon or in the wardrobe.
//              hair (cut), hairDye, glasses, facialHair, makeup, lipColor, jewelry[], outfit, outfitColor, hat
// Children are built from their parents' `inherited` halves only, so a
// parent's dye, haircut or clothes never reach a child.
//
// Saves from the earlier avatar system (v2, drawn shapes) and the first one
// (four numbers) are converted on load. The conversion is deterministic: an
// old part id always becomes the same new part, so a family that shared a
// nose still shares one, and nobody's face changes between loads.
import { AVATAR_MANIFEST, PART_BY_ID } from '../avatarManifest.js';
import * as PAL from '../avatarPalettes.js';
import { HAIR_TYPE, SUITS, TEXTURES, RESTING, OUTFITS, ROYAL, EXPRESSION, WITHDRAWN } from './curation.js';
import { mixHex } from './color.js';

const named = (ids, hexes, names, extra = () => ({})) => ids.map((id, i) => ({ id, name: names[i], hex: hexes[i], ...extra(i) }));
const parts = (folder, keep = () => true) => AVATAR_MANIFEST[folder].filter(keep).map((p) => ({ id: p.id, name: p.label, file: p.file, tags: p.tags ?? {} }));

export const SKIN_TONES = named(PAL.SKIN_TONE_IDS, PAL.SKIN_TONES, PAL.SKIN_TONE_NAMES, (i) => ({ depth: i, base: PAL.SKIN_TONES[i] }));
export const HAIR_COLORS = named(PAL.HAIR_COLOR_IDS, PAL.HAIR_COLORS, PAL.HAIR_COLOR_NAMES, (i) => ({ natural: i < PAL.NATURAL_HAIR }));
export const EYE_COLORS = named(PAL.EYE_COLOR_IDS, PAL.EYE_COLORS, PAL.EYE_COLOR_NAMES);
export const LIP_COLORS = named(PAL.LIP_COLOR_IDS, PAL.LIP_COLORS, PAL.LIP_COLOR_NAMES);
export const OUTFIT_COLORS = named(PAL.OUTFIT_COLOR_IDS, PAL.OUTFIT_COLORS, PAL.OUTFIT_COLOR_NAMES);
export const HAIR_TEXTURES = TEXTURES.map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1) }));
/** Born-with marks, drawn with the make-up artwork. */
export const MARKS = [
  { id: 'freckles', name: 'Freckles', file: 'makeup_04_freckles' },
  { id: 'dense_freckles', name: 'Lots of freckles', file: 'makeup_11_dense_freckles' },
  { id: 'beauty_mark', name: 'Beauty mark', file: 'makeup_06_beauty_mark' },
];
const MARK_FILES = new Set(MARKS.map((m) => m.file));

const AUTO_OUTFIT = /prison|police|swat|military|firefighter|doctor|grad|^outfit_baby|babybib|royal|prince|princess|queen|duchess|duke|emperor|imperial|noble|admiral|armor|ermine|jabot|capelet|doublet/;
export const HEADS = parts('heads', (p) => p.tags?.age === 'adult');
export const HAIR_STYLES = parts('hair', (p) => !/baby/.test(p.id)).map((h) => ({ ...h, type: HAIR_TYPE[h.id] ?? 'straight' }));
export const BABY_HAIR = parts('hair', (p) => /baby/.test(p.id));

/** Every list of options, by the key it is saved under. */
export const CATALOG = {
  head: HEADS, skin: SKIN_TONES, eyes: parts('eyes', (p) => p.id !== EXPRESSION.crying), // crying eyes appear only when something sad is happening
  eyeColor: EYE_COLORS, brows: parts('eyebrows'), nose: parts('noses'), lips: parts('lips'),
  hairColor: HAIR_COLORS.filter((c) => c.natural), hairTexture: HAIR_TEXTURES, marks: MARKS,
  hair: HAIR_STYLES, hairDye: HAIR_COLORS, glasses: parts('glasses'), facialHair: parts('facial_hair'),
  makeup: parts('makeup', (p) => !MARK_FILES.has(p.id)), lipColor: LIP_COLORS, jewelry: parts('jewelry'),
  outfit: parts('clothes', (p) => !AUTO_OUTFIT.test(p.id)), outfitColor: OUTFIT_COLORS, hat: [],
};

/**
 * A person's own proportions, part of what they are born with: each is a
 * whole number of steps from -2 to 2 (0 is as drawn). Saved as inherited.tweaks.
 */
export const TWEAKS = [
  { id: 'eyeGap', name: 'Eye spacing', low: 'Closer', high: 'Wider' },
  { id: 'eyeSize', name: 'Eye size', low: 'Smaller', high: 'Bigger' },
  { id: 'eyeY', name: 'Eye height', low: 'Lower', high: 'Higher' },
  { id: 'noseSize', name: 'Nose size', low: 'Smaller', high: 'Bigger' },
  { id: 'lipSize', name: 'Mouth size', low: 'Smaller', high: 'Bigger' },
];
export const cleanTweaks = (t) => Object.fromEntries(TWEAKS.map((k) => [k.id, Math.max(-2, Math.min(2, Math.round(Number(t?.[k.id]) || 0)))]));

/** Born with: one id each, except marks, which is a list of ids. */
export const INHERITED_KEYS = ['head', 'skin', 'eyes', 'eyeColor', 'brows', 'nose', 'lips', 'hairColor', 'hairTexture'];
/** Styling: hair must have a value ('bald' for none); jewelry is a list; the others may be null (none). */
export const STYLE_KEYS = ['hair', 'hairDye', 'glasses', 'facialHair', 'makeup', 'lipColor', 'jewelry', 'outfit', 'outfitColor', 'hat'];
/** The proportions of someone's face. */
export const shownTweaks = (a) => ({ ...a.inherited.tweaks });

const INDEX = Object.fromEntries(Object.entries(CATALOG).map(([k, list]) => [k, Object.fromEntries(list.map((x) => [x.id, x]))]));
INDEX.anyHair = Object.fromEntries(HAIR_COLORS.map((x) => [x.id, x]));
INDEX.hair.bald = { id: 'bald', name: 'Shaved', type: 'any' };

/** The option with this id, or undefined. */
export const part = (key, id) => INDEX[key]?.[id];
export const has = (key, id) => !!part(key, id);

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
const seeded = (list, seed, salt) => list[hash(`${seed}:${salt}`) % list.length];
const resting = (key) => {
  const folder = { eyes: 'eyes', brows: 'eyebrows', nose: 'noses', lips: 'lips' }[key];
  return CATALOG[key].filter((x) => RESTING[folder].includes(x.id));
};
/** The styles that suit a natural texture. */
export const stylesFor = (texture) => HAIR_STYLES.filter((s) => (SUITS[texture] ?? SUITS.straight).includes(s.type));

// ---------- Older saves ----------

const OLD_SKIN = ['ivory', 'sand', 'golden', 'tan', 'chestnut', 'espresso'];
const OLD_HAIR = ['black', 'brown', 'light_brown', 'blonde', 'auburn'];
const OLD_EYES = ['dark_brown', 'blue', 'green', 'hazel'];
const OLD_STYLE_NUM = ['short_crop', 'side_part', 'long_straight'];
const OLD_FACE = { oval: 'head_17_dimple_oval', round: 'head_15_cherubic', square: 'head_13_athletic', heart: 'head_11_pixie', long: 'head_18_long_rect', diamond: 'head_16_angular' };
// Face shapes that have been withdrawn: anyone saved with one keeps the nearest shape that remains.
const GONE_HEAD = { face_01_oval: 'head_17_dimple_oval', face_02_round: 'head_15_cherubic', face_03_square: 'head_13_athletic', face_04_heart: 'head_11_pixie', face_05_diamond: 'head_16_angular', face_06_pear: 'head_14_almond' };
const OLD_HAIRSTYLE = {
  bald: 'bald', buzz: 'hair_boy_short_10', short_crop: 'hair_boy_short_06', side_part: 'hair_boy_short_02', pixie: 'hair_girl_short_02', waves: 'hair_boy_short_10',
  curls_tight: 'hair_boy_short_11', coils: 'hair_girl_short_14', braids: 'hair_girl_long_09', locs: 'hair_boy_medium_09', bob: 'hair_girl_short_01',
  long_straight: 'hair_girl_long_02', long_wavy: 'hair_girl_long_01', long_curly: 'hair_girl_long_07', ponytail: 'hair_boy_updo_11_high_ponytail', bun: 'hair_updo_03', puffs: 'hair_updo_09',
};
const OLD_GLASSES = { round: 'glasses_1', square: 'glasses_3', cat_eye: 'glasses_2', aviator: 'glasses_4' };
const OLD_BEARD = { stubble: 'facial_hair_06_stubble', mustache: 'facial_hair_02_handlebar_mustache', goatee: 'facial_hair_03_pointed_goatee',
  beard: 'facial_hair_01_shaped_beard', full_beard: 'facial_hair_04_bushy_full_beard' };
const OLD_MAKEUP = { soft: 'makeup_01_soft_blush', defined: 'makeup_02_winged_eyeliner', bold: 'makeup_12_smoky_wing' };
/**
 * The random pools as they were when the earlier avatar system's saves were first converted. An old shape
 * id is converted from these, then moved off anything since withdrawn, so it always lands on the same part
 * and relatives who shared it still do.
 */
const OLD_RESTING = {
  eyes: ['eyes_6', 'eyes_8', 'eyes_9', 'eyes_10', 'eyes_11', 'eyes_16', 'eyes_18', 'eyes_19', 'eyes_22', 'eyes_25'],
  lips: ['lips_1', 'lips_4', 'lips_6', 'lips_7', 'lips_8', 'lips_9', 'lips_10', 'lips_11', 'lips_12', 'lips_14'],
  nose: ['nose_3', 'nose_5', 'nose_6', 'nose_7', 'nose_8', 'nose_9', 'nose_10', 'nose_11', 'nose_12', 'nose_13', 'nose_14', 'nose_15', 'nose_16', 'nose_17',
    'nose_18', 'nose_19', 'nose_20', 'nose_22', 'nose_23'],
};
/** A shape that has been withdrawn becomes the nearest one kept; any other id is left as it is. */
export const current = (key, id) => WITHDRAWN[key]?.[id] ?? id;
const fromOld = (key, oldId) => {
  if (!oldId) return null;
  // Sorted as the manifest lists them: the earlier pools were in that order, and the pick depends on it.
  const pool = OLD_RESTING[key] ? [...OLD_RESTING[key]].sort().map((id) => ({ id })) : resting(key);
  return current(key, seeded(pool, oldId, key).id);
};

/**
 * Returns a complete, valid appearance for whatever was saved: a current one
 * (gaps filled), one from either earlier avatar system, or nothing. Missing
 * pieces are chosen from the seed (usually the character's id), so the same
 * character always gets the same face. The input is not changed.
 */
export function normalize(a, seed = 'x') {
  const src = a?.inherited ?? {};
  const v2 = a?.v === 2 || (a?.inherited && a.v !== 3);
  const old = a && !a.inherited ? a : {};
  const legacy = {
    skin: OLD_SKIN[old.skin], hairColor: OLD_HAIR[old.hair], eyeColor: OLD_EYES[old.eyes],
    head: v2 ? OLD_FACE[src.face] : undefined, eyes: v2 ? fromOld('eyes', src.eyeShape) : undefined,
    brows: v2 ? fromOld('brows', src.brows) : undefined, nose: v2 ? fromOld('nose', src.nose) : undefined, lips: v2 ? fromOld('lips', src.lips) : undefined,
  };
  const inherited = {};
  for (const key of INHERITED_KEYS) {
    let id = (v2 && legacy[key] !== undefined ? legacy[key] : src[key]) ?? legacy[key];
    if (key === 'head' && GONE_HEAD[id]) id = GONE_HEAD[id];
    id = current(key, id);
    const pool = ['eyes', 'brows', 'nose', 'lips'].includes(key) ? resting(key) : CATALOG[key];
    inherited[key] = has(key, id) ? id : seeded(pool, seed, key).id;
  }
  inherited.tweaks = cleanTweaks(src.tweaks);
  inherited.marks = Array.isArray(src.marks) ? src.marks.filter((id) => has('marks', id))
    : hash(`${seed}:marks`) % 9 === 0 ? ['freckles'] : [];

  const st = a?.style ?? {};
  const style = {};
  const oldCut = v2 ? OLD_HAIRSTYLE[st.hair] : OLD_HAIRSTYLE[OLD_STYLE_NUM[old.hairStyle]];
  const suited = stylesFor(inherited.hairTexture);
  style.hair = has('hair', st.hair) ? st.hair : oldCut ?? seeded(suited.length ? suited : HAIR_STYLES, seed, 'hair').id;
  style.hairDye = INDEX.anyHair[st.hairDye] ? st.hairDye : null;
  style.glasses = has('glasses', st.glasses) ? st.glasses : (v2 && OLD_GLASSES[st.glasses]) || null;
  style.facialHair = has('facialHair', st.facialHair) ? st.facialHair : (v2 && OLD_BEARD[st.facialHair]) || null;
  style.makeup = has('makeup', st.makeup) ? st.makeup : (v2 && OLD_MAKEUP[st.makeup]) || null;
  style.lipColor = has('lipColor', st.lipColor) ? st.lipColor : null;
  style.jewelry = Array.isArray(st.jewelry) ? st.jewelry.filter((id) => has('jewelry', id)) : [];
  style.outfit = has('outfit', st.outfit) ? st.outfit : seeded(CATALOG.outfit.filter((o) => OUTFITS.any.includes(o.id)), seed, 'outfit').id;
  style.outfitColor = has('outfitColor', st.outfitColor) ? st.outfitColor : null;
  style.hat = has('hat', st.hat) ? st.hat : null;
  // Earlier saves kept surgery separately; it is simply the person's face now.
  if (st.tweaks) inherited.tweaks = cleanTweaks(st.tweaks);
  return { v: 3, inherited, style };
}

/** How deep a character's inherited skin tone is, 0 (lightest) upwards. */
export const skinDepth = (appearance, seed) => part('skin', normalize(appearance, seed).inherited.skin).depth;

/** The color the hair shows as today: the dye if there is one, else the natural color. */
export const hairHex = (appearance) => (INDEX.anyHair[appearance.style.hairDye] ?? INDEX.anyHair[appearance.inherited.hairColor]).hex;

/**
 * Everything the renderer needs, from an appearance: which part fills each
 * layer, and the colors. Baby hair and baby clothes are chosen from the
 * seed and the hair texture, so a baby grows into the same person.
 */
export function resolveLook(appearance, seed = 'x', gender) {
  const a = normalize(appearance, seed);
  const g = a.inherited;
  const st = a.style;
  const skin = part('skin', g.skin);
  const natural = INDEX.anyHair[g.hairColor].hex;
  const babyHair = g.hairTexture === 'coily' ? ['hair_baby_04_mini_puff', 'hair_baby_05_twin_puffs', 'hair_baby_08_baby_ringlets']
    : g.hairTexture === 'curly' ? ['hair_baby_01_curl_tuft', 'hair_baby_08_baby_ringlets', 'hair_baby_04_mini_puff']
      : ['hair_baby_03_wispy_strands', 'hair_baby_06_boy_wave', 'hair_baby_10_toddler_fringe', 'hair_baby_02_fountain_pony'];
  const sex = gender === 'female' ? 'female' : 'male';
  return {
    tweaks: g.tweaks, head: g.head, eyes: g.eyes, eyebrows: g.brows, nose: g.nose, lips: g.lips,
    hair: st.hair === 'bald' ? null : st.hair, babyHair: seeded(babyHair, seed, 'babyhair'),
    facialHair: st.facialHair, makeup: st.makeup ? [st.makeup] : [], marks: g.marks.map((m) => part('marks', m).file),
    jewelry: st.jewelry, glasses: st.glasses, clothes: st.outfit, hat: st.hat,
    babyClothes: seeded(OUTFITS.baby, seed, 'babyclothes'), royalOutfit: seeded(ROYAL.outfits[sex], seed, 'royal'),
    colors: {
      skin: skin.hex, hair: hairHex(a), dyed: !!st.hairDye, brow: mixHex(natural, '#1c1210', 0.22), eye: part('eyeColor', g.eyeColor).hex,
      lip: st.lipColor ? part('lipColor', st.lipColor).hex : mixHex(skin.hex, '#b8444f', skin.depth >= 8 ? 0.34 : 0.42),
      blush: mixHex(skin.hex, '#f0506a', skin.depth >= 7 ? 0.4 : 0.48),
      outfit: st.outfitColor ? part('outfitColor', st.outfitColor).hex : null,
    },
  };
}

export { PART_BY_ID };
