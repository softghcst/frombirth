// Curated colors for the CharacterAvatar system. Each list is an array of
// hex colors, ordered so neighboring entries are neighbors by eye; skin
// runs from lightest to deepest (the order is how inheritance finds a tone
// between two parents). Each has a parallel list of ids: saves store the id,
// so a color can be retuned here without touching anyone's save.

export const SKIN_TONES = ['#fbe3d3', '#f6d5bb', '#f0c2a8', '#e8b68c', '#dead8b', '#dda36c', '#d49b72', '#c99766', '#bc8253', '#a56b42', '#8b5431', '#73442b', '#683b25', '#5a3420', '#4f2e21', '#432519', '#391f17'];
export const SKIN_TONE_IDS = ['porcelain', 'ivory', 'rose_beige', 'sand', 'beige', 'golden', 'caramel', 'olive', 'tan', 'bronze', 'chestnut', 'umber', 'cocoa', 'espresso', 'sable', 'ebony', 'onyx'];
/**
 * Natural, bare lips on men, one pair per skin tone above (same order). From porcelain to bronze both lips are one
 * color, a nude a shade deeper than the skin, warming from golden so it does not blend into the cheeks. From chestnut
 * down they are two-toned: the upper lip a rich, deeper shade of the skin, the lower a little lighter, a warm brown
 * with only a hint of rose, so the mouth reads by its own fills rather than its outline. Chosen by lightness, chroma
 * and hue against each skin. Lipstick replaces both.
 */
export const NATURAL_LIP_UPPER = ['#e0bcac', '#dcb19c', '#d7a38f', '#d19a7f', '#c6947e', '#c98a72', '#bc826b', '#b67d63', '#aa6f57', '#935c45', '#71442a', '#5c3522', '#522e1d', '#472718', '#3f2216', '#371d13', '#2d1810'];
export const NATURAL_LIP_LOWER = ['#e0bcac', '#dcb19c', '#d7a38f', '#d19a7f', '#c6947e', '#c98a72', '#bc826b', '#b67d63', '#aa6f57', '#935c45', '#865744', '#794c3b', '#724838', '#6a4334', '#644032', '#5f3c31', '#53342a'];
export const SKIN_TONE_NAMES = ['Porcelain', 'Ivory', 'Rose beige', 'Sand', 'Beige', 'Golden', 'Caramel', 'Olive', 'Tan', 'Bronze', 'Chestnut', 'Umber', 'Cocoa', 'Espresso', 'Sable', 'Ebony', 'Onyx'];

/** Natural colors first (the first NATURAL_HAIR of them), then dyes. */
export const HAIR_COLORS = ['#1d1514', '#3b2417', '#5c3a21', '#8a5a33', '#7f3420', '#c0602a', '#b58a4c', '#e1bf70',
  '#efe3c4', '#c9ced6', '#ec74ad', '#d02c33', '#8452c8', '#3f7ee0', '#1fa3a6', '#3fae6f'];
export const HAIR_COLOR_IDS = ['black', 'dark_brown', 'brown', 'light_brown', 'auburn', 'ginger', 'dark_blonde', 'blonde',
  'platinum', 'silver', 'pink', 'red', 'purple', 'blue', 'teal', 'green'];
export const HAIR_COLOR_NAMES = ['Black', 'Dark brown', 'Brown', 'Light brown', 'Auburn', 'Ginger', 'Dark blonde', 'Blonde',
  'Platinum', 'Silver', 'Pink', 'Bright red', 'Purple', 'Blue', 'Teal', 'Green'];
export const NATURAL_HAIR = 8;
/** What hair turns to with age. */
export const GRAY_HAIR = '#dcd8d0';

export const EYE_COLORS = ['#3b2416', '#6b4024', '#8f6c30', '#b47c2a', '#4f8248', '#3f76b6', '#7d8996'];
export const EYE_COLOR_IDS = ['dark_brown', 'brown', 'hazel', 'amber', 'green', 'blue', 'gray'];
export const EYE_COLOR_NAMES = ['Dark brown', 'Brown', 'Hazel', 'Amber', 'Green', 'Blue', 'Gray'];

/** Lip colors (make-up). With none chosen, lips are a natural shade worked out from the skin. */
export const LIP_COLORS = ['#c96a7b', '#b6222f', '#7e2b4e', '#e27c60', '#bd8777', '#2b2226'];
export const LIP_COLOR_IDS = ['rose', 'red', 'berry', 'coral', 'nude', 'black'];
export const LIP_COLOR_NAMES = ['Rose', 'Red', 'Berry', 'Coral', 'Nude', 'Black'];
/**
 * Each lipstick, as it is worn on each skin: [skin depth, color] anchors from the lightest skin (0) to the deepest (16),
 * blended between them (lipShade in js/avatar/catalog.js). The way makeup ranges are made for different skins: a rose is
 * a soft pink on fair skin and a deep mauve rose on deep skin; a red goes from a bright blue-red to a rich wine-red;
 * a nude is always a little deeper and warmer than the skin, from pinky beige to deep cocoa, never ashy or chalky.
 */
export const LIP_SHADES = {
  rose: [[0, '#d97f90'], [5, '#c86a7c'], [9, '#ab5468'], [13, '#8c3f57'], [16, '#743349']],
  red: [[0, '#c4232f'], [5, '#b51f2c'], [9, '#a31a29'], [13, '#8c1626'], [16, '#741221']],
  berry: [[0, '#93365c'], [5, '#842e52'], [9, '#722646'], [13, '#5f1f3c'], [16, '#4e1832']],
  coral: [[0, '#ee8c70'], [5, '#e2785a'], [9, '#cf6444'], [13, '#b44f32'], [16, '#963f27']],
  nude: [[0, '#d69a8d'], [3, '#c9897a'], [6, '#b67966'], [9, '#975d48'], [10, '#7d4835'], [11, '#6b3d2c'], [12, '#5f3526'], [13, '#552f22'], [14, '#4b291e'], [15, '#3c2018'], [16, '#311a12']],
  black: [[0, '#2f2528'], [8, '#2a2023'], [16, '#1f171a']],
};

/** Colors an everyday outfit can be dyed. */
export const OUTFIT_COLORS = ['#2f4d7a', '#7a2f3b', '#2f6a4a', '#e0b23a', '#6b4aa0', '#e07a5f', '#3a3a3f', '#f2efe8', '#c77ba6', '#4fa3c7'];
export const OUTFIT_COLOR_IDS = ['navy', 'wine', 'forest', 'mustard', 'violet', 'terracotta', 'charcoal', 'cream', 'rose', 'sky'];
export const OUTFIT_COLOR_NAMES = ['Navy', 'Wine', 'Forest', 'Mustard', 'Violet', 'Terracotta', 'Charcoal', 'Cream', 'Rose', 'Sky'];
