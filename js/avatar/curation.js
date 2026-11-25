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
  ...T(['hair_boy_short_06', 'hair_boy_short_07',
    'hair_boy_updo_02_samurai', 'hair_boy_updo_11_high_ponytail'], 'straight'),
  ...T(['hair_girl_long_06', 'hair_girl_short_04', 'hair_girl_short_12',
    'hair_boy_short_01', 'hair_boy_short_03', 'hair_boy_short_08', 'hair_boy_short_12', 'hair_boy_updo_01_manbun', 'hair_boy_updo_10_surfer_bun', 'hair_updo_02'], 'wavy'),
  ...T(['hair_girl_long_07', 'hair_girl_short_05', 'hair_boy_short_05', 'hair_boy_updo_03_curly_puff'], 'curly'),
  ...T(['hair_girl_medium_11', 'hair_girl_short_11', 'hair_boy_medium_12', 'hair_boy_short_09', 'hair_boy_short_10', 'hair_boy_short_11', 'hair_boy_short_15', 'hair_boy_updo_15_headband_puff'], 'coily'),
  ...T(['hair_girl_long_09', 'hair_girl_long_16', 'hair_girl_medium_12', 'hair_girl_short_10', 'hair_boy_long_10', 'hair_boy_updo_06_braid_bun'], 'braids'),
  ...T(['hair_girl_medium_09', 'hair_boy_updo_05_loc_bun', 'hair_boy_updo_07_fountain_pony'], 'locs'),
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
/**
 * Eyes drawn on a man: the eye shapes with lashes or winged liner (10, 16, 25, 6, 22, 20, and the closed 7) are drawn as
 * the plain shape closest to them (18, 19, 8, 9 have none). The eyes are still inherited as they are, so a son with his
 * mother's eyes passes hers on; only how they are drawn on him changes.
 */
export const EYE_MATCH = {
  male: { eyes_10: 'eyes_8', eyes_16: 'eyes_18', eyes_6: 'eyes_18', eyes_25: 'eyes_9', eyes_22: 'eyes_19', eyes_20: 'eyes_19', eyes_7: 'eyes_9' },
};
export const LIP_MATCH = {
  male: { lips_4: 'lips_masc_04', lips_6: 'lips_masc_14', lips_7: 'lips_masc_09', lips_11: 'lips_masc_03', lips_14: 'lips_masc_13' },
  female: { lips_masc_02: 'lips_8', lips_masc_03: 'lips_11', lips_masc_04: 'lips_4', lips_masc_06: 'lips_10', lips_masc_07: 'lips_14',
    lips_masc_09: 'lips_7', lips_masc_10: 'lips_8', lips_masc_11: 'lips_9', lips_masc_12: 'lips_8', lips_masc_13: 'lips_14', lips_masc_14: 'lips_6' },
};
/** The soft, thin brows every baby and toddler has, whatever they grow into. */
export const BABY_BROWS = 'brows_8';
/**
 * A baby's, toddler's and child's eyes are round and open: eyes they were born with that are one of these are kept; any other
 * shape (heavy-lidded, almond, winged) is drawn as the round one it always maps to, until they are thirteen.
 */
// Round and open, with nothing above the eye that would read as a second pair of brows: eyes_22, and eyes_6 without
// its fold lines (assets/avatars/baby_eyes/baby_eyes_6.svg).
export const BABY_EYES = ['eyes_22', 'baby_eyes_6'];
/** Girls have the round eyes with lashes (eyes_6 without its fold lines), boys eyes_22; with no gender given, the shape the eyes map to. */
export const BABY_EYES_BY_GENDER = { female: 'baby_eyes_6', male: 'eyes_22' };
export const babyEyes = (id, gender) => (BABY_EYES_BY_GENDER[gender] ?? (!id || BABY_EYES.includes(id) ? id : BABY_EYES[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7) % BABY_EYES.length]));
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
  // Hairstyles taken out of the game: each becomes the nearest of the styles kept, by texture and length.
  hair: {
    hair_boy_long_06: 'hair_boy_updo_10_surfer_bun',
    hair_boy_long_08: 'hair_boy_updo_10_surfer_bun',
    hair_girl_long_02: 'hair_girl_long_06',
    hair_girl_long_05: 'hair_girl_long_06',
    hair_boy_medium_07: 'hair_boy_short_08',
    hair_boy_medium_06: 'hair_boy_short_08',
    hair_boy_medium_08: 'hair_boy_short_08',
    hair_boy_medium_05: 'hair_boy_short_01',
    hair_boy_medium_14: 'hair_boy_updo_07_fountain_pony',
    hair_girl_long_14: 'hair_boy_long_10',
    hair_boy_long_14: 'hair_boy_updo_06_braid_bun',
    hair_girl_medium_02: 'hair_girl_short_12',
    hair_girl_medium_06: 'hair_girl_short_12',
    hair_girl_short_06: 'hair_girl_short_12',
    hair_girl_medium_07: 'hair_girl_short_12',
    hair_girl_medium_05: 'hair_girl_long_07',
    hair_boy_long_01: 'hair_boy_updo_01_manbun',
    hair_boy_long_02: 'hair_boy_updo_01_manbun',
    hair_boy_long_03: 'hair_boy_updo_01_manbun',
    hair_boy_long_04: 'hair_boy_updo_03_curly_puff',
    hair_boy_long_05: 'hair_boy_updo_02_samurai',
    hair_boy_long_07: 'hair_boy_updo_01_manbun',
    hair_boy_long_09: 'hair_boy_updo_05_loc_bun',
    hair_boy_long_11: 'hair_boy_updo_06_braid_bun',
    hair_boy_long_12: 'hair_boy_updo_06_braid_bun',
    hair_boy_long_13: 'hair_boy_updo_05_loc_bun',
    hair_boy_long_15: 'hair_boy_updo_06_braid_bun',
    hair_boy_long_16: 'hair_boy_updo_03_curly_puff',
    hair_boy_medium_01: 'hair_boy_short_01',
    hair_boy_medium_02: 'hair_boy_short_01',
    hair_boy_medium_03: 'hair_boy_short_01',
    hair_boy_medium_04: 'hair_boy_short_05',
    hair_boy_medium_09: 'hair_boy_updo_05_loc_bun',
    hair_boy_medium_10: 'hair_boy_updo_06_braid_bun',
    hair_boy_medium_11: 'hair_boy_updo_06_braid_bun',
    hair_boy_medium_13: 'hair_boy_updo_05_loc_bun',
    hair_boy_medium_15: 'hair_boy_short_05',
    hair_boy_medium_16: 'hair_boy_updo_06_braid_bun',
    hair_boy_short_02: 'hair_boy_short_06',
    hair_boy_short_04: 'hair_boy_short_06',
    hair_boy_short_13: 'hair_boy_short_05',
    hair_boy_short_14: 'hair_boy_updo_06_braid_bun',
    hair_boy_short_16: 'hair_boy_short_09',
    hair_boy_updo_04_curtain_bun: 'hair_boy_updo_02_samurai',
    hair_boy_updo_08_royal_lowpony: 'hair_boy_updo_01_manbun',
    hair_boy_updo_09_spacebuns: 'hair_boy_updo_15_headband_puff',
    hair_boy_updo_12_twist_pineapple: 'hair_boy_updo_06_braid_bun',
    hair_boy_updo_13_braid_mohawk: 'hair_boy_updo_06_braid_bun',
    hair_boy_updo_14_double_lowbuns: 'hair_boy_updo_01_manbun',
    hair_boy_updo_16_halfup_braids: 'hair_boy_updo_06_braid_bun',
    hair_girl_long_01: 'hair_girl_long_06',
    hair_girl_long_03: 'hair_girl_long_06',
    hair_girl_long_04: 'hair_girl_long_06',
    hair_girl_long_08: 'hair_girl_long_06',
    hair_girl_long_10: 'hair_girl_long_07',
    hair_girl_long_11: 'hair_boy_long_10',
    hair_girl_long_12: 'hair_girl_long_07',
    hair_girl_long_13: 'hair_girl_medium_09',
    hair_girl_long_15: 'hair_boy_long_10',
    hair_girl_medium_01: 'hair_girl_long_06',
    hair_girl_medium_03: 'hair_girl_long_06',
    hair_girl_medium_04: 'hair_girl_long_06',
    hair_girl_medium_08: 'hair_girl_medium_09',
    hair_girl_medium_10: 'hair_girl_medium_12',
    hair_girl_medium_13: 'hair_girl_medium_09',
    hair_girl_medium_14: 'hair_girl_long_07',
    hair_girl_medium_15: 'hair_girl_long_07',
    hair_girl_medium_16: 'hair_girl_medium_12',
    hair_girl_short_01: 'hair_girl_short_04',
    hair_girl_short_02: 'hair_girl_short_04',
    hair_girl_short_03: 'hair_girl_short_04',
    hair_girl_short_07: 'hair_girl_short_04',
    hair_girl_short_08: 'hair_girl_short_04',
    hair_girl_short_09: 'hair_girl_short_05',
    hair_girl_short_13: 'hair_girl_short_11',
    hair_girl_short_14: 'hair_girl_short_11',
    hair_girl_short_15: 'hair_girl_short_11',
    hair_girl_short_16: 'hair_girl_short_11',
    hair_updo_01: 'hair_updo_02',
    hair_updo_03: 'hair_updo_02',
    hair_updo_04: 'hair_boy_long_10',
    hair_updo_05: 'hair_updo_02',
    hair_updo_06: 'hair_girl_long_07',
    hair_updo_07: 'hair_updo_02',
    hair_updo_08: 'hair_boy_long_10',
    hair_updo_09: 'hair_girl_medium_11',
    hair_updo_10: 'hair_girl_long_07',
    hair_updo_11: 'hair_girl_medium_09',
    hair_updo_12: 'hair_boy_long_10',
    hair_updo_13: 'hair_girl_medium_09',
    hair_updo_14: 'hair_girl_long_07',
    hair_updo_15: 'hair_boy_long_10',
    hair_updo_16: 'hair_boy_long_10',
  },
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
/**
 * Hair in old age: from ELDER_HAIR_AGE (when graying has turned hair mostly white) a woman or man is drawn with one of
 * the elder styles for their gender, unless their own style is one, or they have chosen their hair at the salon since (style.keepHair).
 * The styles: the ids listed here, chosen by hand from the existing ones, and every fitted style whose raw SVG is marked
 * data-elder="female" or "male" (elderHairStyles in js/CharacterAvatar.js).
 */
export const ELDER_HAIR_AGE = 70;
export const ELDER_HAIR = { female: [], male: [] };

// Clothes. The old outfits have been withdrawn while new ones are made: every list below is empty, so for now
// nobody wears clothes (portraits show bare shoulders) and the creator hides its Clothes tab. To add clothes, put
// the SVGs in assets/avatars/clothes/ (named outfit_<...>.svg), run python3 scripts/build-avatar-manifest.py, and
// list their ids here. Saves keep no outfit until there is one to give: then everyone is dressed again.

/** Everyday outfits, by who is likelier to wear them at random. Any can be chosen by anyone. */
/**
 * What a child of 7 to 13 (the kid head) wears: children's clothes, never a grown-up's (from 14, their own style). Empty for now:
 * the children's clothes are being redrawn, and until they are added here a child is drawn with no outfit.
 */
/**
 * A baby's hair (under 3), by hair texture: drawn on the baby template (assets/clothes_templates/baby_head_template.png)
 * and placed as drawn. Being redrawn: until styles are added here, a baby has no hair drawn.
 */
export const BABY_HAIR_BY_TEXTURE = { straight: ['hair_baby_straight_01_soft_fringe', 'hair_baby_straight_02_side_swoop', 'hair_baby_straight_03_fuzzy_crop'], wavy: ['hair_baby_wavy_01_wave_on_top', 'hair_baby_wavy_02_tousled', 'hair_baby_wavy_03_side_ripple'], curly: ['hair_baby_curly_01_curl_fringe', 'hair_baby_curly_02_soft_curls', 'hair_baby_curly_03_curl_tuft'], coily: ['hair_baby_coily_01_afro', 'hair_baby_coily_02_tiny_coils', 'hair_baby_coily_03_little_puff'] };

export const KID_OUTFITS = { any: [], female: [], male: [] };

export const OUTFITS = {
  any: ['outfit_54_denim_jacket_tee', 'outfit_55_zip_hoodie', 'outfit_56_vneck_sweater', 'outfit_57_polo_shirt', 'outfit_58_tank_top'],
  female: ['outfit_59_lightning_sweatshirt', 'outfit_61_high_neck_top', 'outfit_62_cropped_moto_jacket'],
  male: ['outfit_64_flannel_shirt', 'outfit_66_denim_shirt', 'outfit_67_varsity_jacket'],
  // What a baby or toddler wears (0 to 6, one head): drawn on its template, assets/clothes_templates/baby_head_template.png.
  baby: ['outfit_baby_01_cream_onesie', 'outfit_baby_02_overalls', 'outfit_baby_03_dot_bib', 'outfit_baby_04_bowtie_vest', 'outfit_baby_05_star_pajamas', 'outfit_baby_07_cable_sweater', 'outfit_baby_09_yellow_collar',
    'outfit_baby_10_suspenders_bowtie'],
};

/** Royal dress, by sex where the art suggests it. */
export const ROYAL = {
  outfits: { female: ['outfit_45_princess_sweetheart', 'outfit_52_princess_starlight'],
    male: ['outfit_46_prince_epaulettes'], baby: ['outfit_baby_06_royal_cape', 'outfit_baby_08_royal_christening_gown'],
    // A royal child of 7 to 13 (the kid head), drawn on its template: princes and princesses; an empty list is plain children's clothes.
    // The heir to the throne, at that age, wears their own (kidHeir), whichever of the others they were given.
    // A noble child of 7 to 13: the plainer of the royal kids' outfits, with no crown, royal sash, epaulettes or ermine.
    nobleKid: { male: ['outfit_kid_01_royal_tunic', 'outfit_kid_03_royal_blazer', 'outfit_kid_15_noble_riding_jacket'],
      female: ['outfit_kid_08_princess_sailor', 'outfit_kid_13_noble_velvet_dress', 'outfit_kid_14_noble_ribbon_waistcoat'] },
    kidHeir: { male: 'outfit_kid_06_heir_jacket', female: 'outfit_kid_12_heir_princess_starry' },
    kid: { male: ['outfit_kid_01_royal_tunic', 'outfit_kid_02_royal_sailor', 'outfit_kid_03_royal_blazer', 'outfit_kid_04_royal_ceremonial', 'outfit_kid_05_royal_velvet_cape'],
      female: ['outfit_kid_07_princess_dress', 'outfit_kid_08_princess_sailor', 'outfit_kid_09_princess_pinafore', 'outfit_kid_10_princess_ceremonial', 'outfit_kid_11_princess_capelet'] }, monarch: { male: ['outfit_47_sovereign_ermine'], female: ['outfit_47_sovereign_ermine', 'outfit_51_imperial_fan_collar', 'outfit_53_imperial_ruby'] },
    // What a titled noble wears, grown up, with the coronet: a marquess, an earl or a duke alike.
    noble: { female: ['outfit_48_noble_cameo'], male: ['outfit_49_noble_cravat'] },
    // Some titles have their own dress: a duke or a duchess wears this instead.
    nobleByTitle: { duke: { male: ['outfit_50_duke_mantle'], female: ['outfit_50_duke_mantle'] } } },
  // Grown-up dress: worn from 18. A younger royal wears one of the others on their list.
  grownOnly: ['outfit_45_princess_sweetheart', 'outfit_46_prince_epaulettes', 'outfit_47_sovereign_ermine', 'outfit_48_noble_cameo', 'outfit_49_noble_cravat', 'outfit_50_duke_mantle', 'outfit_51_imperial_fan_collar', 'outfit_52_princess_starlight', 'outfit_53_imperial_ruby'],
  crowns: { sovereign: 'crown_09_sovereign', obsidian: 'crown_13_obsidian_sovereign', empress: 'crown_12_empress', emperor: 'crown_14_imperial_laurel', monarch: { male: 'crown_01_king', female: 'crown_15_queen' }, queen: 'crown_15_queen', heir: { male: 'crown_17_crown_prince', female: 'crown_16_crown_princess' },
    royal: { male: 'crown_11_prince_band', female: 'crown_10_princess_tiara' }, child: 'crown_11_prince_band', princess: 'crown_10_princess_tiara', crownPrincess: 'crown_16_crown_princess', crownPrince: 'crown_17_crown_prince', noble: 'crown_06_noble_coronet' },
};

/** Where each crown drawing meets the head: the middle of its lower edge (seat) and its highest point (top), in its 512 frame. */
export const CROWN_SEATS = { crown_09_sovereign: { seat: 167.6, top: 45.9 }, crown_10_princess_tiara: { seat: 154, top: 68.5 },
  crown_11_prince_band: { seat: 173.2, top: 111.4 }, crown_12_empress: { seat: 169, top: 73 }, crown_13_obsidian_sovereign: { seat: 164.2, top: 50.9 },
  crown_14_imperial_laurel: { seat: 161, top: 84 }, crown_15_queen: { seat: 169.6, top: 42.6 }, crown_16_crown_princess: { seat: 161.8, top: 86.8 },
  crown_17_crown_prince: { seat: 172.5, top: 78.8 } };

/** Work clothes the portrait wears, by career id (engine/career.js). */
export const CAREER_DRESS = {
  // The work uniforms (police, firefighter, military, doctor, suit) are being redrawn: until then, people wear their own clothes at work.
};

/** A baby (under 3) has a binky in place of a mouth: blue for a boy, pink for a girl (the portrait sets --binkie-color). */
export const PACIFIER = { id: 'pacifier_01', boy: '#5aa7f0', girl: '#f48cc4' };
/** What a prisoner wears: being redrawn; until then, their own clothes. */
export const PRISON = null;
export const GRADUATION = { outfit: null }; // the gown is being redrawn

/**
 * Hairstyles that hide an eye or much of the face (measured: see README). Nobody is given one
 * at random; they can still be chosen in the creator or the salon.
 */
export const HAIR_COVERS_FACE = [
  'hair_updo_02', 'hair_girl_medium_12', 'hair_boy_updo_01_manbun', ];
