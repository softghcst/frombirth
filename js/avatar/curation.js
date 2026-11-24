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
  ...T(['hair_girl_medium_08', 'hair_girl_short_01', 'hair_girl_short_02', 'hair_girl_short_03', 'hair_boy_long_05', 'hair_boy_short_02', 'hair_boy_short_04', 'hair_boy_short_06', 'hair_boy_short_07',
    'hair_boy_updo_02_samurai', 'hair_boy_updo_04_curtain_bun', 'hair_boy_updo_11_high_ponytail', 'hair_updo_03', 'hair_updo_07'], 'straight'),
  ...T(['hair_girl_long_01', 'hair_girl_long_03', 'hair_girl_long_04', 'hair_girl_long_06', 'hair_girl_long_08', 'hair_girl_medium_01', 'hair_girl_medium_03',
    'hair_girl_medium_04', 'hair_girl_short_04', 'hair_girl_short_07', 'hair_girl_short_08', 'hair_girl_short_12',
    'hair_boy_long_01', 'hair_boy_long_02', 'hair_boy_long_03', 'hair_boy_long_07', 'hair_boy_medium_01', 'hair_boy_medium_02', 'hair_boy_medium_03',
    'hair_boy_short_01', 'hair_boy_short_03', 'hair_boy_short_08', 'hair_boy_short_12', 'hair_boy_updo_01_manbun', 'hair_boy_updo_08_royal_lowpony',
    'hair_boy_updo_10_surfer_bun', 'hair_boy_updo_14_double_lowbuns', 'hair_updo_01', 'hair_updo_02', 'hair_updo_05'], 'wavy'),
  ...T(['hair_girl_long_07', 'hair_girl_long_10', 'hair_girl_long_12', 'hair_girl_medium_14', 'hair_girl_medium_15', 'hair_girl_short_05', 'hair_girl_short_09',
    'hair_boy_long_04', 'hair_boy_long_16', 'hair_boy_medium_04', 'hair_boy_medium_15', 'hair_boy_short_05', 'hair_boy_short_13', 'hair_boy_updo_03_curly_puff',
    'hair_updo_06', 'hair_updo_10', 'hair_updo_14'], 'curly'),
  ...T(['hair_girl_medium_11', 'hair_girl_short_11', 'hair_girl_short_13', 'hair_girl_short_14', 'hair_girl_short_15', 'hair_girl_short_16',
    'hair_boy_medium_12', 'hair_boy_short_09', 'hair_boy_short_10', 'hair_boy_short_11', 'hair_boy_short_15', 'hair_boy_short_16',
    'hair_boy_updo_09_spacebuns', 'hair_boy_updo_15_headband_puff', 'hair_updo_09'], 'coily'),
  ...T(['hair_girl_long_09', 'hair_girl_long_11', 'hair_girl_long_15', 'hair_girl_long_16', 'hair_girl_medium_10', 'hair_girl_medium_12', 'hair_girl_medium_16',
    'hair_girl_short_10', 'hair_boy_long_10', 'hair_boy_long_11', 'hair_boy_long_12', 'hair_boy_long_15', 'hair_boy_medium_10', 'hair_boy_medium_11',
    'hair_boy_medium_16', 'hair_boy_short_14', 'hair_boy_updo_06_braid_bun', 'hair_boy_updo_12_twist_pineapple', 'hair_boy_updo_13_braid_mohawk', 'hair_boy_updo_16_halfup_braids',
    'hair_updo_04', 'hair_updo_08', 'hair_updo_12', 'hair_updo_15', 'hair_updo_16'], 'braids'),
  ...T(['hair_girl_long_13', 'hair_girl_medium_09', 'hair_girl_medium_13', 'hair_boy_long_09', 'hair_boy_long_13', 'hair_boy_medium_09', 'hair_boy_medium_13', 'hair_boy_updo_05_loc_bun', 'hair_boy_updo_07_fountain_pony', 'hair_updo_11', 'hair_updo_13'], 'locs'),
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
    hair_girl_long_02: 'hair_boy_updo_10_surfer_bun',
    hair_girl_long_05: 'hair_boy_updo_10_surfer_bun',
    hair_boy_medium_07: 'hair_boy_short_08',
    hair_boy_medium_06: 'hair_boy_short_08',
    hair_boy_medium_08: 'hair_boy_short_08',
    hair_boy_medium_05: 'hair_boy_short_01',
    hair_boy_medium_14: 'hair_boy_updo_07_fountain_pony',
    hair_girl_long_14: 'hair_boy_long_10',
    hair_boy_long_14: 'hair_boy_long_10',
    hair_girl_medium_02: 'hair_girl_short_12',
    hair_girl_medium_06: 'hair_girl_short_12',
    hair_girl_short_06: 'hair_girl_short_12',
    hair_girl_medium_07: 'hair_girl_short_12',
    hair_girl_medium_05: 'hair_girl_short_09',
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

/** Everyday outfits, by who is likelier to wear them at random. Any can be chosen by anyone. */
/**
 * What a child of 7 to 13 (the kid head) wears: children's clothes, never a grown-up's (from 14, their own style). Empty for now:
 * the children's clothes are being redrawn, and until they are added here a child is drawn with no outfit.
 */
/**
 * A baby's hair (under 3), by hair texture: drawn on the baby template (assets/clothes_templates/baby_head_template.png)
 * and placed as drawn. Being redrawn: until styles are added here, a baby has no hair drawn.
 */
export const BABY_HAIR_BY_TEXTURE = { straight: ['hair_baby_straight_01_soft_fringe', 'hair_baby_straight_02_side_swoop'], wavy: [], curly: [], coily: [] };

export const KID_OUTFITS = { any: [], female: [], male: [] };

export const OUTFITS = {
  any: ['outfit_01_tee', 'outfit_02_sweater', 'outfit_14_cardigan', 'outfit_17_flannel', 'outfit_18_varsity', 'outfit_21_hoodie', 'outfit_22_denim', 'outfit_24_leather',
    'outfit_27_trackjacket', 'outfit_28_hawaiian', 'outfit_29_denim_striped', 'outfit_30_fleece', 'outfit_31_overalls', 'outfit_32_moto_jacket', 'outfit_54_denim_jacket_tee',
    'outfit_55_zip_hoodie', 'outfit_56_vneck_sweater', 'outfit_57_polo_shirt', 'outfit_58_tank_top'],
  female: ['outfit_13_offshoulder', 'outfit_15_squareknit', 'outfit_16_glamhalter', 'outfit_33_sailor_bow', 'outfit_34_wrap_blouse', 'outfit_35_peterpan_vest', 'outfit_36_floral_corset',
    'outfit_59_lightning_sweatshirt', 'outfit_61_high_neck_top', 'outfit_62_cropped_moto_jacket'],
  male: ['outfit_03_suit', 'outfit_23_polo', 'outfit_25_waistcoat'],
  // What a baby or toddler wears (0 to 6, one head): drawn on its template, assets/clothes_templates/baby_head_template.png.
  baby: ['outfit_baby_01_cream_onesie', 'outfit_baby_02_overalls', 'outfit_baby_03_dot_bib', 'outfit_baby_04_bowtie_vest', 'outfit_baby_05_star_pajamas', 'outfit_baby_07_cable_sweater', 'outfit_baby_09_yellow_collar',
    'outfit_baby_10_suspenders_bowtie'],
};

/** Royal dress, by sex where the art suggests it. */
export const ROYAL = {
  outfits: { female: ['outfit_09_princess_gown', 'outfit_45_princess_sweetheart', 'outfit_52_princess_starlight', 'outfit_10_queen_collar', 'outfit_11_duchess_square', 'outfit_12_royal_capelet', 'outfit_05_royal'],
    male: ['outfit_05_royal', 'outfit_20_prince_military', 'outfit_46_prince_epaulettes', 'outfit_37_emperor_ermine', 'outfit_38_fairytale_prince', 'outfit_39_royal_admiral', 'outfit_40_duke_brocade',
      'outfit_42_imperial_tunic', 'outfit_43_noble_jabot', 'outfit_44_prince_doublet'], baby: ['outfit_baby_06_royal_cape', 'outfit_baby_08_royal_christening_gown'], monarch: { male: ['outfit_37_emperor_ermine', 'outfit_47_sovereign_ermine'], female: ['outfit_10_queen_collar', 'outfit_47_sovereign_ermine', 'outfit_51_imperial_fan_collar', 'outfit_53_imperial_ruby'] },
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
  police: { outfit: 'outfit_police_01', senior: { outfit: 'outfit_swat_02', level: 4 } },
  firefighter: { outfit: 'outfit_firefighter_01' },
  enlisted: { outfit: 'outfit_military_01' },
  officer: { outfit: 'outfit_military_01' },
  doctor: { outfit: 'outfit_06_doctor' }, nurse: { outfit: 'outfit_06_doctor' }, dentist: { outfit: 'outfit_06_doctor' }, vet: { outfit: 'outfit_06_doctor' },
  pharmacist: { outfit: 'outfit_06_doctor' }, scientist: { outfit: 'outfit_06_doctor' },
  lawyer: { outfit: 'outfit_03_suit' }, banker: { outfit: 'outfit_19_tuxedo' }, accountant: { outfit: 'outfit_03_suit' }, political_staff: { outfit: 'outfit_03_suit' },
};
export const PRISON = 'outfit_07_prison';
export const GRADUATION = { outfit: 'outfit_08_grad' };

/**
 * Hairstyles that hide an eye or much of the face (measured: see README). Nobody is given one
 * at random; they can still be chosen in the creator or the salon.
 */
export const HAIR_COVERS_FACE = [
  'hair_girl_long_04', 'hair_boy_long_07', 'hair_girl_medium_01',
  'hair_updo_10', 'hair_updo_02', 'hair_girl_long_11', 'hair_girl_long_03',
  'hair_boy_long_03', 'hair_boy_long_11', 'hair_girl_long_12', 'hair_girl_medium_03',
  'hair_girl_medium_12', 'hair_girl_long_01', 'hair_girl_long_08', 'hair_girl_long_10',
  'hair_boy_medium_13', 'hair_boy_updo_01_manbun', 'hair_boy_medium_01', 'hair_boy_long_04',
  'hair_girl_medium_04', 'hair_girl_long_15',
];
