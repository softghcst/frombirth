// The parts catalog: every piece of avatar artwork (from the generated
// manifest, js/avatarManifest.js) and every color (js/avatarPalettes.js),
// grouped by feature, plus the rules for turning whatever is in a save into
// a complete appearance.
//
// An appearance has two halves, saved on each character:
//   inherited: what they were born with. Set once, at birth, never changed.
//              head, skin, eyes, eyeColor, brows, nose, lips, hairColor (natural), hairTexture, marks[]
//   style:     how they wear it today. Changed at the salon or in the wardrobe.
//              hair (cut), hairDye, glasses, makeup, lipColor, jewelry[], outfit, outfitColor, hat
// Children are built from their parents' `inherited` halves only, so a
// parent's dye, haircut or clothes never reach a child.
//
// Saves from the earlier avatar system (v2, drawn shapes) and the first one
// (four numbers) are converted on load. The conversion is deterministic: an
// old part id always becomes the same new part, so a family that shared a
// nose still shares one, and nobody's face changes between loads.
import { AVATAR_MANIFEST, PART_BY_ID } from '../avatarManifest.js';
import * as PAL from '../avatarPalettes.js';
import { BABY_HAIR_BY_TEXTURE, KID_HAIR, KID_OUTFITS, HAIR_TYPE, SUITS, FITTED_TEXTURE, TEXTURES, RESTING, OUTFITS, ROYAL, EXPRESSION, WITHDRAWN, LIP_MATCH, EYE_MATCH } from './curation.js';
import { mixHex } from './color.js';
import { FITTED_HAIR, FITTED_LOADED, kidsMayWear } from './fittedHair.js';
import { cleanHeritage } from './heritage.js';

const named = (ids, hexes, names, extra = () => ({})) => ids.map((id, i) => ({ id, name: names[i], hex: hexes[i], ...extra(i) }));
const parts = (folder, keep = () => true) => AVATAR_MANIFEST[folder].filter(keep).map((p) => ({ id: p.id, name: p.label, file: p.file, tags: p.tags ?? {} }));

export const SKIN_TONES = named(PAL.SKIN_TONE_IDS, PAL.SKIN_TONES, PAL.SKIN_TONE_NAMES, (i) => ({ depth: i, base: PAL.SKIN_TONES[i] }));
/**
 * Each skin tone's depth (its place from lightest to deepest), by id. Anything that changes with depth names the tone
 * it starts at, not a number, so adding a tone between two others never moves where it starts.
 */
export const DEPTH = Object.fromEntries(SKIN_TONES.map((t) => [t.id, t.depth]));
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

const AUTO_OUTFIT = /prison|police|swat|military|firefighter|doctor|grad|^outfit_baby|^outfit_kid_|heir|babybib|royal|prince|princess|queen|duchess|duke|emperor|imperial|noble|admiral|armor|ermine|jabot|capelet|doublet/;
export const HEADS = parts('heads', (p) => p.tags?.age === 'adult');
export const HAIR_STYLES = parts('hair', (p) => !/^hair_(baby|kid)_/.test(p.id)).map((h) => ({ ...h, type: HAIR_TYPE[h.id] ?? 'straight' }));
export const BABY_HAIR = parts('hair', (p) => /baby/.test(p.id));  // none: withdrawn, so babies and toddlers are bald
/**
 * Hairstyles from the fitting pipeline, read from assets/hair_manifest.json (js/avatar/fittedHair.js): offered in the
 * creator and at the salon, drawn from assets/hair_fitted/. They are not in HAIR_STYLES, so the styles picked at
 * random for new people stay as they were.
 */
export const FITTED_STYLES = Object.values(FITTED_HAIR).filter((s) => !s.legacy).map((s) => ({ id: s.id, name: s.name, file: null, fitted: true, clipToHead: !!s.clipToHead, kids: !!s.kids, tags: { length: s.length ?? 'short', gender: s.gender === 'any' ? undefined : s.gender }, type: FITTED_TEXTURE[s.id] ?? s.type ?? 'any', minAge: s.minAge ?? 0, elder: s.elder ?? null, elderOk: s.elderOk ?? null }));
/** Fitted styles that have been withdrawn, and the style a save that used one is given instead. */
export const GONE_FITTED = {
  textured_crop: 'textured_pixie_cut',
  bowl_cut: 'textured_french_crop',
  // The girls' pack, withdrawn.
  '90s_flipped_ponytail': 'half_up_half_down_waves', short_bubble_pigtails: 'space_buns', y2k_spiky_updo_bun: 'messy_top_bun',
  collarbone_butterfly_cut: 'layered_feathered_midi', dutch_halo_braid: 'messy_top_bun', half_up_fountain_bob: 'half_up_half_down_waves',
  retro_60s_bouffant_bob: 'layered_feathered_midi', short_hime_princess_bob: 'layered_feathered_midi',
};
/** The fitted styles that suit a natural texture ('any' suits every texture). */
export const fittedFor = (texture) => FITTED_STYLES.filter((s) => s.type === 'any' || (SUITS[texture] ?? SUITS.straight).includes(s.type));

/** Every list of options, by the key it is saved under. */
export const CATALOG = {
  head: HEADS, skin: SKIN_TONES, eyes: parts('eyes', (p) => p.id !== EXPRESSION.crying).map((e) => (/^eyes_[fm]_/.test(e.id) ? { ...e, name: e.name.replace(/^[FM] /, '').replace(/^./, (ch) => ch.toUpperCase()) } : e)), // crying eyes appear only when something sad is happening
  eyeColor: EYE_COLORS, brows: parts('eyebrows', (p) => p.id !== EXPRESSION.sadBrows), nose: parts('noses'), lips: parts('lips'),
  hairColor: HAIR_COLORS.filter((c) => c.natural), hairTexture: HAIR_TEXTURES, marks: MARKS,
  hair: [...HAIR_STYLES, ...FITTED_STYLES], hairDye: HAIR_COLORS, glasses: parts('glasses'),
  makeup: parts('makeup', (p) => !MARK_FILES.has(p.id)), lipColor: LIP_COLORS, jewelry: parts('jewelry'),
  outfit: parts('clothes', (p) => !AUTO_OUTFIT.test(p.id)), outfitColor: OUTFIT_COLORS, hat: [],
  // Shaped brows from the salon or barber, worn over the brows a person was born with (any of the brows).
  browStyle: parts('eyebrows', (p) => p.id !== EXPRESSION.sadBrows),
  // Beards, from the barbershop: any facial_hair artwork in the manifest (none at the moment).
  beard: AVATAR_MANIFEST.facial_hair ? parts('facial_hair') : [],
  // A baby's and a child's own look, chosen in the editor's Baby and Child views (null: picked for them from the seed).
  babyHair: BABY_HAIR, babyOutfit: parts('clothes', (p) => OUTFITS.baby.includes(p.id)),
  kidHair: [...HAIR_STYLES, ...FITTED_STYLES].filter((h) => kidsMayWear(h.id)),
  kidOutfit: parts('clothes', (p) => [...KID_OUTFITS.any, ...KID_OUTFITS.female, ...KID_OUTFITS.male].includes(p.id)),
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
export const STYLE_KEYS = ['hair', 'hairDye', 'glasses', 'makeup', 'lipColor', 'jewelry', 'outfit', 'outfitColor', 'hat', 'browStyle', 'beard', 'babyHair', 'babyOutfit', 'kidHair', 'kidOutfit'];
/** The proportions of someone's face. */
export const shownTweaks = (a) => ({ ...a.inherited.tweaks });

const INDEX = Object.fromEntries(Object.entries(CATALOG).map(([k, list]) => [k, Object.fromEntries(list.map((x) => [x.id, x]))]));
INDEX.anyHair = Object.fromEntries(HAIR_COLORS.map((x) => [x.id, x]));
INDEX.hair.bald = { id: 'bald', name: 'Shaved', type: 'any' };

/**
 * Mouths are inherited whatever a person's gender, and drawn to suit it: a man is drawn with the men's mouth
 * that matches the one he was born with, a woman with the women's mouth that matches hers (LIP_MATCH in
 * js/avatar/curation.js). So a son with his mother's full lips has full lips too, and the mouth he passes on
 * is still hers. Expressions, and mouths outside the two resting sets, are drawn as they are.
 */
export function lipsFor(id, gender) {
  const match = gender === 'male' ? LIP_MATCH.male : gender === 'female' ? LIP_MATCH.female : null;
  // A men's mouth is never drawn on a woman, nor offered to one: any not matched above is drawn as a neutral one.
  if (gender === 'female' && /^lips_masc_/.test(id ?? '')) return match[id] ?? 'lips_8';
  return match?.[id] ?? id;
}

/**
 * Eyes, drawn to suit a gender. A man's are drawn without lashes or winged liner (EYE_MATCH in js/avatar/curation.js).
 * Eyes made for one gender (traced from pictures: eyes_f_* women's, eyes_m_* men's, scripts/trace_eyes_png.py) are
 * drawn on the other as one of that gender's own, always the same one for the same eyes. Eyes are inherited as they
 * are, so a son passes on his mother's.
 */
export const isWomensEyes = (id) => /^eyes_f_/.test(id ?? '');
export const isMensEyes = (id) => /^eyes_m_/.test(id ?? '');
const MENS_PLAIN = ['eyes_18', 'eyes_19', 'eyes_8', 'eyes_9'];
export function eyesFor(id, gender) {
  if (gender === 'male') {
    if (!isWomensEyes(id)) return EYE_MATCH.male[id] ?? id;
    const own = [...MENS_PLAIN, ...CATALOG.eyes.map((e) => e.id).filter(isMensEyes)];
    return own[hash(id) % own.length];
  }
  if (gender === 'female' && isMensEyes(id)) {
    const own = [...RESTING.eyes, ...CATALOG.eyes.map((e) => e.id).filter(isWomensEyes)];
    return own[hash(id) % own.length];
  }
  return id;
}

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
/** Whether a hairstyle is one for this gender: men's and women's styles go to their own, unisex ones (no tag) to both. */
export const hairSuitsGender = (style, gender) => !gender || !style?.tags?.gender || style.tags.gender === gender;
export const stylesFor = (texture) => HAIR_STYLES.filter((s) => (SUITS[texture] ?? SUITS.straight).includes(s.type));
/** Whether a hairstyle is worn in this texture ('bald' and the 'any' styles suit every texture). */
export const hairSuits = (id, texture) => {
  if (!id || id === 'bald') return true;
  const h = INDEX.hair[id];
  return !h || h.type === 'any' || (SUITS[texture] ?? SUITS.straight).includes(h.type);
};
/**
 * The texture someone's hair shows today: a salon treatment's while it lasts (style.treatment), otherwise the one they
 * were born with, which never changes.
 */
export const hairTextureOf = (appearance) => appearance?.style?.treatment?.texture ?? appearance?.inherited?.hairTexture ?? 'straight';

// ---------- Older saves ----------

const OLD_SKIN = ['ivory', 'sand', 'golden', 'tan', 'chestnut', 'espresso'];
const OLD_HAIR = ['black', 'brown', 'light_brown', 'blonde', 'auburn'];
const OLD_EYES = ['dark_brown', 'blue', 'green', 'hazel'];
const OLD_STYLE_NUM = ['short_crop', 'side_part', 'long_straight'];
const OLD_FACE = { oval: 'head_17_dimple_oval', round: 'head_15_cherubic', square: 'head_13_athletic', heart: 'head_11_pixie', long: 'head_12_sculpted', diamond: 'head_16_angular' };
// Face shapes that have been withdrawn: anyone saved with one keeps the nearest shape that remains.
const GONE_HEAD = { face_01_oval: 'head_17_dimple_oval', face_02_round: 'head_15_cherubic', face_03_square: 'head_13_athletic', face_04_heart: 'head_11_pixie', face_05_diamond: 'head_16_angular', face_06_pear: 'head_14_almond',
  head_18_long_rect: 'head_12_sculpted' };
const OLD_HAIRSTYLE = {
  bald: 'bald', buzz: 'hair_boy_short_10', short_crop: 'hair_boy_short_06', side_part: 'hair_boy_short_02', pixie: 'hair_girl_short_02', waves: 'hair_boy_short_10',
  curls_tight: 'hair_boy_short_11', coils: 'hair_girl_short_14', braids: 'hair_girl_long_09', locs: 'hair_boy_medium_09', bob: 'hair_girl_short_01',
  long_straight: 'hair_girl_long_02', long_wavy: 'hair_girl_long_01', long_curly: 'hair_girl_long_07', ponytail: 'hair_boy_updo_11_high_ponytail', bun: 'hair_updo_03', puffs: 'hair_updo_09',
};
// The glasses and make-up are being redrawn: older saves' choices have nothing to map to, and are dropped.
const OLD_GLASSES = {};
const OLD_MAKEUP = {};
/**
 * The random pools as they were when the earlier avatar system's saves were first converted. An old shape
 * id is converted from these, then moved off anything since withdrawn, so it always lands on the same part
 * and relatives who shared it still do.
 */
const OLD_RESTING = {
  brows: ['brows_02', 'brows_03', 'brows_10', 'brows_12', 'brows_14', 'brows_15', 'brows_16_feathered', 'brows_17_puppy', 'brows_19_glam_arch', 'brows_6', 'brows_8'],
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
  // Where their family comes from (js/avatar/heritage.js), when it is known; older saves have none.
  const heritage = cleanHeritage(src.heritage);
  if (heritage) inherited.heritage = heritage;
  // And the places their family comes from (country ids), likewise.
  const roots = Array.isArray(src.roots) ? src.roots.filter((r) => typeof r === 'string' && /^[a-z]{2}$/.test(r)).slice(0, 4) : [];
  if (roots.length) inherited.roots = roots;
  inherited.marks = Array.isArray(src.marks) ? src.marks.filter((id) => has('marks', id))
    : hash(`${seed}:marks`) % 9 === 0 ? ['freckles'] : [];

  let st = a?.style ?? {};
  const style = {};
  const oldCut = current('hair', v2 ? OLD_HAIRSTYLE[st.hair] : OLD_HAIRSTYLE[OLD_STYLE_NUM[old.hairStyle]]);
  const suited = stylesFor(inherited.hairTexture);
  // A fitted style that has been withdrawn is replaced by the closest one kept, not one picked at random.
  if (GONE_FITTED[st.hair]) st = { ...st, hair: GONE_FITTED[st.hair] };
  // An older style that has been taken out of the game becomes the nearest one kept (WITHDRAWN.hair).
  if (WITHDRAWN.hair[st.hair]) st = { ...st, hair: WITHDRAWN.hair[st.hair] };
  // A saved fitted style is kept even if the hair manifest could not be loaded this time (offline, say):
  // it is simply not drawn until it loads, rather than being replaced for good.
  const unloadedFitted = !FITTED_LOADED && !v2 && typeof st.hair === 'string' && /^[a-z0-9_]+$/.test(st.hair) && !PART_BY_ID[st.hair] && st.hair !== 'bald';
  style.hair = has('hair', st.hair) || unloadedFitted ? st.hair : oldCut ?? seeded(suited.length ? suited : HAIR_STYLES, seed, 'hair').id;
  style.hairDye = INDEX.anyHair[st.hairDye] ? st.hairDye : null;
  style.glasses = has('glasses', st.glasses) ? st.glasses : (v2 && OLD_GLASSES[st.glasses]) || null;
  // Facial hair has been taken out of the game: a beard or mustache in an old save is dropped.
  style.makeup = has('makeup', st.makeup) ? st.makeup : (v2 && OLD_MAKEUP[st.makeup]) || null;
  style.lipColor = has('lipColor', st.lipColor) ? st.lipColor : null;
  style.browStyle = has('browStyle', st.browStyle) ? st.browStyle : null;  // shaped at the salon; null: their own
  style.beard = has('beard', st.beard) ? st.beard : null;
  style.jewelry = Array.isArray(st.jewelry) ? st.jewelry.filter((id) => has('jewelry', id)) : [];
  const wardrobe = CATALOG.outfit.filter((o) => OUTFITS.any.includes(o.id));  // empty while there are no clothes: then nobody wears any
  style.outfit = has('outfit', st.outfit) ? st.outfit : wardrobe.length ? seeded(wardrobe, seed, 'outfit').id : null;
  style.outfitColor = has('outfitColor', st.outfitColor) ? st.outfitColor : null;
  style.hat = has('hat', st.hat) ? st.hat : null;
  // What they wear as a baby and as a child, if chosen (otherwise picked for them in resolveLook).
  for (const k of ['babyHair', 'babyOutfit', 'kidHair', 'kidOutfit']) style[k] = has(k, st[k]) ? st[k] : null;
  // A salon treatment that shows another texture for a time (js/engine/salon.js): kept while it is a real texture.
  const tr = st.treatment;
  style.treatment = tr && TEXTURES.includes(tr.texture) && tr.texture !== inherited.hairTexture ? { texture: tr.texture, kind: String(tr.kind ?? ''), years: Number(tr.years) || 2, ...(tr.from != null ? { from: Number(tr.from), until: Number(tr.until) } : {}) } : null;
  if (st.keepHair) style.keepHair = true;  // hair chosen at the salon in old age: kept, not drawn as an elder's style
  // Earlier saves kept surgery separately; it is simply the person's face now.
  if (st.tweaks) inherited.tweaks = cleanTweaks(st.tweaks);
  return { v: 3, inherited, style };
}

/** How deep a character's inherited skin tone is, 0 (lightest) upwards. */
export const skinDepth = (appearance, seed) => part('skin', normalize(appearance, seed).inherited.skin).depth;

/** The color the hair shows as today: the dye if there is one, else the natural color. */
export const hairHex = (appearance) => (INDEX.anyHair[appearance.style.hairDye] ?? INDEX.anyHair[appearance.inherited.hairColor]).hex;

/**
 * The color of a mouth. Lipstick is worn as chosen, all over. Otherwise a woman's lips are her skin warmed toward rose;
 * a man's are a natural pair for his skin tone (one color on the lighter tones, two from chestnut down) (NATURAL_LIP_UPPER and NATURAL_LIP_LOWER in js/avatarPalettes.js): `lip`
 * colors the lower lip and `lipUpper` the upper. Every resting mouth draws its upper lip in --lip-upper (falling back to
 * the lip color), so the pair shows on every mouth shape, thin, full or smiling.
 */
/** A lipstick's shade on a skin of this depth (PAL.LIP_SHADES), blended between the nearest anchors. */
export function lipShade(id, depth = 8) {
  const ramp = PAL.LIP_SHADES[id];
  if (!ramp) return part('lipColor', id)?.hex ?? null;
  const d = Math.max(ramp[0][0], Math.min(ramp.at(-1)[0], depth));
  const i = Math.max(0, ramp.findIndex(([at]) => at >= d) - 1);
  const [a, b] = [ramp[i], ramp[Math.min(i + 1, ramp.length - 1)]];
  return b[0] === a[0] ? a[1] : mixHex(a[1], b[1], (d - a[0]) / (b[0] - a[0]));
}
export const NATURAL_LIPS = { woman: { rose: '#b8444f', k: 0.42, deepK: 0.34 } };
function lipColors(skin, lipColor, gender) {
  if (lipColor) return { lip: lipShade(lipColor, skin.depth) };
  if (gender !== 'male') { const W = NATURAL_LIPS.woman; return { lip: mixHex(skin.hex, W.rose, skin.depth >= DEPTH.chestnut ? W.deepK : W.k) }; }
  return { lip: PAL.NATURAL_LIP_LOWER[skin.depth], lipUpper: PAL.NATURAL_LIP_UPPER[skin.depth] };
}

/**
 * Everything the renderer needs, from an appearance: which part fills each
 * layer, and the colors. Baby hair and baby clothes are chosen from the
 * seed and the hair texture, so a baby grows into the same person. A child (`child`) wears no lipstick.
 */
export function resolveLook(appearance, seed = 'x', gender, { child = false } = {}) {
  const a = normalize(appearance, seed);
  const g = a.inherited;
  const st = a.style;
  const skin = part('skin', g.skin);
  const natural = INDEX.anyHair[g.hairColor].hex;
  // A baby's hair, by texture (js/avatar/curation.js BABY_HAIR_BY_TEXTURE): being redrawn; until then, none.
  const babyHair = BABY_HAIR_BY_TEXTURE[g.hairTexture] ?? BABY_HAIR_BY_TEXTURE.straight;
  const sex = gender === 'female' ? 'female' : 'male';
  const lips = lipsFor(g.lips, gender);
  const colors = lipColors(skin, child ? null : st.lipColor, gender); // lipstick is a grown-up's choice
  return {
    tweaks: g.tweaks, head: g.head, eyes: eyesFor(g.eyes, gender), eyebrows: st.browStyle ?? g.brows, nose: g.nose, lips, beard: st.beard ?? null,
    hair: st.hair === 'bald' ? null : st.hair, babyHair: st.babyHair ?? (babyHair.length ? seeded(babyHair, seed, 'babyhair') : null),
    keepHair: !!st.keepHair, hairTexture: g.hairTexture,
    // Hair drawn for the kid head (curation.KID_HAIR), for this child's gender and texture, when there is some.
    kidDrawnHair: ((own) => (own.length ? seeded(own, seed, 'kiddrawnhair') : null))(KID_HAIR[sex]?.[g.hairTexture] ?? KID_HAIR[sex]?.straight ?? []),
    // What a child wears while their own style is a grown-up's (a fitted style not marked for children): one of the
    // older styles that suits their hair and gender, picked from the seed so it stays the same through childhood.
    kidHairChosen: !!st.kidHair,
    kidHair: st.kidHair ? st.kidHair : st.hair && st.hair !== 'bald' && !kidsMayWear(st.hair) ? ((own) => seeded(own.length ? own : stylesFor(g.hairTexture).length ? stylesFor(g.hairTexture) : HAIR_STYLES, seed, 'kidhair').id)(stylesFor(g.hairTexture).filter((s) => hairSuitsGender(s, sex))) : null,
    makeup: st.makeup ? [st.makeup] : [], marks: g.marks.map((m) => part('marks', m).file),
    jewelry: st.jewelry, glasses: st.glasses, clothes: st.outfit, hat: st.hat,
    babyClothes: st.babyOutfit ?? (OUTFITS.baby.length ? seeded(OUTFITS.baby, seed, 'babyclothes') : null),
    nobleKidClothes: ROYAL.outfits.nobleKid[sex]?.length ? seeded(ROYAL.outfits.nobleKid[sex], seed, 'noblekid') : null,
    royalKidClothes: ROYAL.outfits.kid[sex]?.length ? seeded(ROYAL.outfits.kid[sex], seed, 'royalkid') : null,
    royalBabyClothes: ROYAL.outfits.baby.length ? seeded(ROYAL.outfits.baby, seed, 'royalbaby') : null,
    kidClothes: st.kidOutfit ? st.kidOutfit : KID_OUTFITS.any.length + KID_OUTFITS[sex].length ? seeded([...KID_OUTFITS.any, ...KID_OUTFITS[sex]], seed, 'kidclothes') : null, royalOutfit: seeded(ROYAL.outfits[sex], seed, 'royal'), monarchOutfit: seeded(ROYAL.outfits.monarch[sex], seed, 'monarch'),
    // The same, for someone under 18: grown-up dress (ROYAL.grownOnly) is not on offer.
    royalOutfitYoung: seeded(ROYAL.outfits[sex].filter((x) => !ROYAL.grownOnly.includes(x)), seed, 'royal'),
    monarchOutfitYoung: seeded(ROYAL.outfits.monarch[sex].filter((x) => !ROYAL.grownOnly.includes(x)), seed, 'monarch'), nobleOutfit: ROYAL.outfits.noble[sex] ? seeded(ROYAL.outfits.noble[sex], seed, 'noble') : null,
    colors: {
      skin: skin.hex, hair: hairHex(a), dyed: !!st.hairDye, brow: mixHex(natural, '#1c1210', 0.22), eye: part('eyeColor', g.eyeColor).hex,
      ...colors,
      blush: mixHex(skin.hex, '#f0506a', skin.depth >= DEPTH.bronze ? 0.4 : 0.48),
      outfit: st.outfitColor ? part('outfitColor', st.outfitColor).hex : null,
    },
  };
}

export { PART_BY_ID };
