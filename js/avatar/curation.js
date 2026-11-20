// Hand-made notes on the avatar artwork that the filenames cannot carry.
// The manifest (js/avatarManifest.js) is generated; this file is edited by
// hand when artwork is added. Anything not listed here still works: it is
// simply never picked at random, and is always available in the creator.

/**
 * Hair texture of each hairstyle, judged by eye. Textures decide which
 * styles a character is given at random, and are inherited, so a family
 * keeps its hair. 'braids' and 'locs' are styles worn mostly on curly and
 * coily hair.
 */
const T = (ids, type) => Object.fromEntries(ids.map((id) => [id, type]));
export const HAIR_TYPE = {
  ...T(['hair_girl_long_02', 'hair_girl_medium_02', 'hair_girl_medium_06', 'hair_girl_medium_08', 'hair_girl_short_01', 'hair_girl_short_02', 'hair_girl_short_03', 'hair_girl_short_06',
    'hair_boy_long_05', 'hair_boy_long_06', 'hair_boy_medium_06', 'hair_boy_medium_07', 'hair_boy_medium_08', 'hair_boy_short_02', 'hair_boy_short_04', 'hair_boy_short_06', 'hair_boy_short_07',
    'hair_boy_updo_02_samurai', 'hair_boy_updo_04_curtain_bun', 'hair_boy_updo_11_high_ponytail', 'hair_updo_03', 'hair_updo_07'], 'straight'),
  ...T(['hair_girl_long_01', 'hair_girl_long_03', 'hair_girl_long_04', 'hair_girl_long_05', 'hair_girl_long_06', 'hair_girl_long_08', 'hair_girl_medium_01', 'hair_girl_medium_03',
    'hair_girl_medium_04', 'hair_girl_medium_07', 'hair_girl_short_04', 'hair_girl_short_07', 'hair_girl_short_08', 'hair_girl_short_12',
    'hair_boy_long_01', 'hair_boy_long_02', 'hair_boy_long_03', 'hair_boy_long_07', 'hair_boy_long_08', 'hair_boy_medium_01', 'hair_boy_medium_02', 'hair_boy_medium_03',
    'hair_boy_medium_05', 'hair_boy_short_01', 'hair_boy_short_03', 'hair_boy_short_08', 'hair_boy_short_12', 'hair_boy_updo_01_manbun', 'hair_boy_updo_08_royal_lowpony',
    'hair_boy_updo_10_surfer_bun', 'hair_boy_updo_14_double_lowbuns', 'hair_updo_01', 'hair_updo_02', 'hair_updo_05'], 'wavy'),
  ...T(['hair_girl_long_07', 'hair_girl_long_10', 'hair_girl_long_12', 'hair_girl_medium_05', 'hair_girl_medium_14', 'hair_girl_medium_15', 'hair_girl_short_05', 'hair_girl_short_09',
    'hair_boy_long_04', 'hair_boy_long_16', 'hair_boy_medium_04', 'hair_boy_medium_15', 'hair_boy_short_05', 'hair_boy_short_13', 'hair_boy_updo_03_curly_puff',
    'hair_updo_06', 'hair_updo_10', 'hair_updo_14'], 'curly'),
  ...T(['hair_girl_medium_11', 'hair_girl_short_11', 'hair_girl_short_13', 'hair_girl_short_14', 'hair_girl_short_15', 'hair_girl_short_16',
    'hair_boy_medium_12', 'hair_boy_short_09', 'hair_boy_short_10', 'hair_boy_short_11', 'hair_boy_short_15', 'hair_boy_short_16',
    'hair_boy_updo_09_spacebuns', 'hair_boy_updo_15_headband_puff', 'hair_updo_09'], 'coily'),
  ...T(['hair_girl_long_09', 'hair_girl_long_11', 'hair_girl_long_14', 'hair_girl_long_15', 'hair_girl_long_16', 'hair_girl_medium_10', 'hair_girl_medium_12', 'hair_girl_medium_16',
    'hair_girl_short_10', 'hair_boy_long_10', 'hair_boy_long_11', 'hair_boy_long_12', 'hair_boy_long_14', 'hair_boy_long_15', 'hair_boy_medium_10', 'hair_boy_medium_11',
    'hair_boy_medium_16', 'hair_boy_short_14', 'hair_boy_updo_06_braid_bun', 'hair_boy_updo_12_twist_pineapple', 'hair_boy_updo_13_braid_mohawk', 'hair_boy_updo_16_halfup_braids',
    'hair_updo_04', 'hair_updo_08', 'hair_updo_12', 'hair_updo_15', 'hair_updo_16'], 'braids'),
  ...T(['hair_girl_long_13', 'hair_girl_medium_09', 'hair_girl_medium_13', 'hair_boy_long_09', 'hair_boy_long_13', 'hair_boy_medium_09', 'hair_boy_medium_13', 'hair_boy_medium_14',
    'hair_boy_updo_05_loc_bun', 'hair_boy_updo_07_fountain_pony', 'hair_updo_11', 'hair_updo_13'], 'locs'),
};
/** Which hair types suit each natural texture. */
export const SUITS = {
  straight: ['straight', 'wavy'], wavy: ['wavy', 'straight', 'curly'], curly: ['curly', 'wavy', 'braids', 'coily'], coily: ['coily', 'braids', 'locs', 'curly'],
};
export const TEXTURES = ['straight', 'wavy', 'curly', 'coily'];

/** Eyes, mouths and noses that are a resting face (others are expressions, or gags, and are never picked at random). */
export const RESTING = {
  // one family of eyes, so faces drawn at random look like they belong to the same world
  eyes: ['eyes_6', 'eyes_8', 'eyes_9', 'eyes_10', 'eyes_16', 'eyes_18', 'eyes_19', 'eyes_22', 'eyes_25'],
  // neutral or pleasant mouths only
  lips: ['lips_4', 'lips_6', 'lips_7', 'lips_8', 'lips_9', 'lips_10', 'lips_11', 'lips_14'],
  // men's mouths: the men's own (the smirk, the grin and the parted lips showing teeth are left out), and the
  // three neutral ones men and women share (lips_8, lips_9, lips_10); the other women's mouths are feminine
  lipsMasc: ['lips_masc_02', 'lips_masc_03', 'lips_masc_04', 'lips_masc_06', 'lips_masc_07', 'lips_masc_09', 'lips_masc_10',
    'lips_masc_11', 'lips_masc_12', 'lips_masc_13', 'lips_masc_14', 'lips_8', 'lips_9', 'lips_10'],
  noses: ['nose_6', 'nose_7', 'nose_9', 'nose_10', 'nose_11', 'nose_12', 'nose_13', 'nose_14', 'nose_16', 'nose_17',
    'nose_19', 'nose_20', 'nose_23'],
  // relaxed brows: nothing angry, skeptical or comic
  eyebrows: ['brows_10', 'brows_12', 'brows_14', 'brows_15', 'brows_16_feathered', 'brows_6', 'brows_8'],
};
/**
 * Each resting mouth's match in the other set, judged by eye: thin stays thin, full stays full, a bow stays a bow.
 * The neutral mouths both sets share (lips_8, lips_9, lips_10) have no match: they are drawn as they are on anyone.
 * A man is drawn with the `male` match of the mouth he was born with, a woman with the `female` match of hers
 * (lipsFor in js/avatar/catalog.js). What is saved, and passed on to children, is the mouth itself.
 */
export const LIP_MATCH = {
  male: { lips_4: 'lips_masc_04', lips_6: 'lips_masc_14', lips_7: 'lips_masc_09', lips_11: 'lips_masc_03', lips_14: 'lips_masc_13' },
  female: { lips_masc_02: 'lips_8', lips_masc_03: 'lips_11', lips_masc_04: 'lips_4', lips_masc_06: 'lips_10', lips_masc_07: 'lips_14',
    lips_masc_09: 'lips_7', lips_masc_10: 'lips_8', lips_masc_11: 'lips_9', lips_masc_12: 'lips_8', lips_masc_13: 'lips_14', lips_masc_14: 'lips_6' },
};
/** The soft, thin brows every baby and toddler has, whatever they grow into. */
export const BABY_BROWS = 'brows_8';
/**
 * A baby's and toddler's eyes are round and open: eyes they were born with that are one of these are kept; any other
 * shape (heavy-lidded, almond, winged) is drawn as the round one it always maps to, until they are five.
 */
export const BABY_EYES = ['eyes_6', 'eyes_22', 'eyes_16', 'eyes_14'];
export const babyEyes = (id) => (!id || BABY_EYES.includes(id) ? id : BABY_EYES[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7) % BABY_EYES.length]);
/** Expressions the renderer can borrow for a mood. */
export const EXPRESSION = { crying: 'eyes_14', laughing: 'lips_20', grin: 'lips_21', sadBrows: 'brows_11' };
/**
 * How unhappy someone must be (their mood, 0 to 100) for their face to show it: sad brows (EXPRESSION.sadBrows) from
 * `sad` down, as happiness falls or after sad news, and crying eyes from `crying` down. Neither is ever a resting face.
 */
export const LOW_MOOD = { sad: 30, crying: 15 };

/**
 * Eyes, mouths and noses that have been withdrawn because they did not match the style of the rest
 * (cartoon outlines, mouths drawn as a single line). Anyone saved with one is drawn with the nearest
 * one kept, the same one every time, so a face changes as little as it can and families still match.
 * The random pools these were in, before they were withdrawn, are kept in OLD_RESTING (js/avatar/catalog.js)
 * so faces converted from older saves land where they always did.
 */
export const WITHDRAWN = {
  eyes: { eyes_11: 'eyes_22', eyes_12: 'eyes_26', eyes_24: 'eyes_7' },
  lips: { lips_1: 'lips_9', lips_12: 'lips_9', lips_2: 'lips_20', lips_3: 'lips_21', lips_13: 'lips_21', lips_15: 'lips_8', lips_16: 'lips_8', lips_19: 'lips_8' },
  brows: { brows_02: 'brows_10', brows_03: 'brows_12', brows_7: 'brows_04', brows_13: 'brows_04', brows_17_puppy: 'brows_14',
    brows_18_unibrow: 'brows_16_feathered', brows_19_glam_arch: 'brows_10', brows_22_skeptical: 'brows_12', brows_11: 'brows_10' },
  nose: { nose_1: 'nose_6', nose_2: 'nose_6', nose_4: 'nose_6', nose_3: 'nose_7', nose_5: 'nose_9', nose_8: 'nose_10', nose_18: 'nose_19', nose_22: 'nose_17', nose_15: 'nose_11', nose_24: 'nose_7' },
};
/**
 * Parts drawn a little larger or smaller than their file: the artwork is fitted to a box, which leaves a
 * tall, narrow nose looking slight beside the broad ones.
 */
export const PART_SCALE = {
  nose_10: 1.12,
};
/** Brows that come with age, to men: from 84 an old man's brows grow bushy (a woman's keep their shape and gray). */
export const ELDER_BROWS = 'brows_23_elder_bushy';

// Clothes. The old outfits have been withdrawn while new ones are made: every list below is empty, so for now
// nobody wears clothes (portraits show bare shoulders) and the creator hides its Clothes tab. To add clothes, put
// the SVGs in assets/avatars/clothes/ (named outfit_<...>.svg), run python3 scripts/build-avatar-manifest.py, and
// list their ids here. Saves keep no outfit until there is one to give: then everyone is dressed again.

/** Everyday outfits, by who is likelier to wear them at random. Any can be chosen by anyone. */
export const OUTFITS = { any: [], female: [], male: [], baby: [] };

/** Royal dress, by sex where the art suggests it. */
export const ROYAL = {
  outfits: { female: [], male: [], baby: null, monarch: { male: null, female: null } },
  crowns: { monarch: { male: 'crown_01_king', female: 'crown_03_queen' }, heir: { male: 'crown_04_prince_circlet', female: 'crown_02_princess_tiara' },
    royal: { male: null, female: 'crown_02_princess_tiara' }, child: 'crown_04_prince_circlet', noble: 'crown_06_noble_coronet' },
};

/** Work clothes the portrait wears, by career id (engine/career.js). outfit: null until there are work clothes. */
export const CAREER_DRESS = {
  police: { outfit: null, senior: { outfit: null, level: 4 } },
  firefighter: { outfit: null }, enlisted: { outfit: null }, officer: { outfit: null },
  doctor: { outfit: null }, nurse: { outfit: null }, dentist: { outfit: null }, vet: { outfit: null }, pharmacist: { outfit: null }, scientist: { outfit: null },
  lawyer: { outfit: null }, banker: { outfit: null }, accountant: { outfit: null }, political_staff: { outfit: null },
};
/**
 * Baby hair, for babies and toddlers: made for each young head from its own outline (scripts/make_baby_hair.py),
 * drawn from assets/hair_baby/<style>_<head>.svg. Which styles a baby may have depends on their natural texture;
 * null is a baby who is still bald.
 */
export const BABY_HAIR = { styles: ['fuzz', 'wisps', 'curl', 'curls', 'fringe'], heads: ['baby', 'toddler'],
  byTexture: { straight: ['fuzz', 'wisps', 'curl', 'fringe', null], wavy: ['fuzz', 'wisps', 'curl', 'fringe', null], curly: ['curl', 'curls', 'fuzz', null], coily: ['curls', 'fuzz', null] } };
/** A baby hair id ('babyhair_fuzz') -> its style ('fuzz'), or null for any other hair. */
export const babyHairStyle = (id) => (typeof id === 'string' && id.startsWith('babyhair_') && BABY_HAIR.styles.includes(id.slice(9)) ? id.slice(9) : null);

/** Babies and toddlers (under 5) have a binkie in place of a mouth: blue for a boy, pink for a girl (the portrait sets --binkie-color). */
export const PACIFIER = { id: 'pacifier_01', boy: '#5aa7f0', girl: '#f48cc4' };
/** What a prisoner wears, and a graduate: null until there are clothes for them. */
export const PRISON = null;
export const GRADUATION = { outfit: null };

/**
 * Hairstyles that hide an eye or much of the face (measured: see README). Nobody is given one
 * at random; they can still be chosen in the creator or the salon.
 */
export const HAIR_COVERS_FACE = [
  'hair_boy_medium_14', 'hair_girl_long_04', 'hair_boy_long_07', 'hair_girl_medium_01',
  'hair_updo_10', 'hair_updo_02', 'hair_girl_long_11', 'hair_girl_long_03',
  'hair_boy_long_03', 'hair_boy_long_11', 'hair_girl_long_12', 'hair_girl_medium_03',
  'hair_girl_medium_12', 'hair_girl_long_01', 'hair_girl_long_08', 'hair_girl_long_10',
  'hair_boy_medium_13', 'hair_boy_updo_01_manbun', 'hair_boy_medium_01', 'hair_boy_long_04',
  'hair_girl_medium_04', 'hair_girl_long_15',
];
