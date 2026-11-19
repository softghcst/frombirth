// Curated colors for the CharacterAvatar system. Each list is an array of
// hex colors, ordered so neighboring entries are neighbors by eye; skin
// runs from lightest to deepest (the order is how inheritance finds a tone
// between two parents). Each has a parallel list of ids: saves store the id,
// so a color can be retuned here without touching anyone's save.

export const SKIN_TONES = ['#fbe3d3', '#f6d5bb', '#f0c2a8', '#e8b68c', '#dead8b', '#dda36c', '#d49b72', '#c99766', '#bc8253', '#a56b42', '#8b5431', '#73442b', '#5a3420', '#432519'];
export const SKIN_TONE_IDS = ['porcelain', 'ivory', 'rose_beige', 'sand', 'beige', 'golden', 'caramel', 'olive', 'tan', 'bronze', 'chestnut', 'umber', 'espresso', 'ebony'];
/**
 * Natural, bare lips on men, one pair per skin tone above (same order). From porcelain to olive both lips are one
 * color, a nude a shade deeper than the skin, warming from golden so it does not blend into the cheeks. From tan down
 * they are two-toned: the upper lip a deeper shade of the skin, the lower softer and turned toward a muted rose-brown,
 * so the mouth reads by its own fills rather than its outline. Chosen by lightness, chroma and hue against each skin:
 * on tan
 * the lower lip parts from the cheeks by hue at much the cheeks' own lightness; on the deepest, a rich upper and a
 * softer rose-brown lower. Lipstick replaces both.
 */
export const NATURAL_LIP_UPPER = ['#e0bcac', '#dcb19c', '#d7a38f', '#d19a7f', '#c6947e', '#c98a72', '#bc826b', '#b67d63', '#a76d4c', '#8c5839', '#71442a', '#5c3522', '#472718', '#371d13'];
export const NATURAL_LIP_LOWER = ['#e0bcac', '#dcb19c', '#d7a38f', '#d19a7f', '#c6947e', '#c98a72', '#bc826b', '#b67d63', '#ae776c', '#a76a5c', '#935b4d', '#865143', '#76483c', '#6a4238'];
export const SKIN_TONE_NAMES = ['Porcelain', 'Ivory', 'Rose beige', 'Sand', 'Beige', 'Golden', 'Caramel', 'Olive', 'Tan', 'Bronze', 'Chestnut', 'Umber', 'Espresso', 'Ebony'];

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

/** Colors an everyday outfit can be dyed. */
export const OUTFIT_COLORS = ['#2f4d7a', '#7a2f3b', '#2f6a4a', '#e0b23a', '#6b4aa0', '#e07a5f', '#3a3a3f', '#f2efe8', '#c77ba6', '#4fa3c7'];
export const OUTFIT_COLOR_IDS = ['navy', 'wine', 'forest', 'mustard', 'violet', 'terracotta', 'charcoal', 'cream', 'rose', 'sky'];
export const OUTFIT_COLOR_NAMES = ['Navy', 'Wine', 'Forest', 'Mustard', 'Violet', 'Terracotta', 'Charcoal', 'Cream', 'Rose', 'Sky'];
