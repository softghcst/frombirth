// Optional details: marks on the skin (inherited), and glasses, facial hair
// and make-up (styling, changed at the salon).
// IDs are saved in characters: never rename or remove one, only add.

/** Inherited marks. dots are [x, y, radius] on the shared template. */
export const MARKS = [
  { id: 'freckles', name: 'Freckles', dots: [[36, 55, 0.7], [39, 57, 0.6], [33.5, 57.5, 0.6], [37, 59.5, 0.55], [41.5, 54.5, 0.5],
    [64, 55, 0.7], [61, 57, 0.6], [66.5, 57.5, 0.6], [63, 59.5, 0.55], [58.5, 54.5, 0.5], [48, 53.5, 0.5], [52, 53.5, 0.5]] },
  { id: 'beauty_mark', name: 'Beauty mark', dots: [[61.5, 63.5, 0.9]], dark: true },
  { id: 'dimples', name: 'Dimples', strokes: ['M37.5 64Q36.5 66 37.5 68', 'M62.5 64Q63.5 66 62.5 68'] },
];

/** Drawn as strokes over the eyes, which sit at (38,47) and (62,47). */
export const GLASSES = [
  { id: 'round', name: 'Round', d: 'M30.5 47a7.5 7.5 0 1 0 15 0a7.5 7.5 0 1 0-15 0M54.5 47a7.5 7.5 0 1 0 15 0a7.5 7.5 0 1 0-15 0M45.5 46Q50 43.5 54.5 46M30.5 46L25.5 44.5M69.5 46L74.5 44.5' },
  { id: 'square', name: 'Square', d: 'M30 41.5H46V52Q46 53.5 44.5 53.5H31.5Q30 53.5 30 52ZM54 41.5H70V52Q70 53.5 68.5 53.5H55.5Q54 53.5 54 52ZM46 45.5Q50 43.5 54 45.5M30 44.5L25.5 43.5M70 44.5L74.5 43.5', weight: 1.7 },
  { id: 'cat_eye', name: 'Cat-eye', d: 'M30.5 43.5Q29 40 33 41.5L46 42.5Q46 54 38.5 54Q31 54 30.5 43.5ZM69.5 43.5Q71 40 67 41.5L54 42.5Q54 54 61.5 54Q69 54 69.5 43.5ZM46 45.5Q50 43.5 54 45.5M30.5 43L25.5 42M69.5 43L74.5 42', weight: 1.6 },
  { id: 'aviator', name: 'Aviator', d: 'M30 42.5H46Q47 55 38.5 55Q30 55 30 42.5ZM54 42.5H70Q70 55 61.5 55Q53 55 54 42.5ZM46 43.5H54M30 43.5L25.5 43M70 43.5L74.5 43', weight: 1.1, tint: true },
];

/**
 * Facial hair, in the natural hair colour. Only drawn from age 16.
 * fill: a filled shape; `sheer` makes it see-through (stubble).
 * {jaw} in a path is replaced by the chin height of the chosen face shape.
 */
export const FACIAL_HAIR = [
  { id: 'stubble', name: 'Stubble', sheer: 0.28,
    fill: 'M28 56Q30 72 42 {jaw}Q50 {jaw+2} 58 {jaw}Q70 72 72 56Q68 66 60 68Q50 63 40 68Q32 66 28 56Z' },
  { id: 'moustache', name: 'Moustache', fill: 'M41 63.5Q45.5 60 50 62.4Q54.5 60 59 63.5Q54.5 65.4 50 64.2Q45.5 65.4 41 63.5Z' },
  { id: 'goatee', name: 'Goatee',
    fill: 'M41.5 63.5Q45.5 60.4 50 62.6Q54.5 60.4 58.5 63.5Q59.5 70 56.5 {jaw-1}Q50 {jaw+2.5} 43.5 {jaw-1}Q40.5 70 41.5 63.5ZM44.5 66Q50 71.5 55.5 66Q50 63.6 44.5 66Z', rule: 'evenodd' },
  { id: 'beard', name: 'Short beard',
    fill: 'M27 52Q28.5 70 41 {jaw}Q50 {jaw+3} 59 {jaw}Q71.5 70 73 52Q69 63 59.5 63.4Q54.5 60 50 62.4Q45.5 60 40.5 63.4Q31 63 27 52ZM44 66Q50 71.5 56 66Q50 63.6 44 66Z', rule: 'evenodd' },
  { id: 'full_beard', name: 'Full beard',
    fill: 'M26.5 50Q26 72 40 {jaw+4}Q50 {jaw+10} 60 {jaw+4}Q74 72 73.5 50Q69 62.5 59.5 63.2Q54.5 59.8 50 62.2Q45.5 59.8 40.5 63.2Q31 62.5 26.5 50ZM44 66Q50 71.5 56 66Q50 63.6 44 66Z', rule: 'evenodd' },
];

/** Make-up looks. liner draws a wing on the upper lid; blush tints the cheeks. */
export const MAKEUP = [
  { id: 'soft', name: 'Soft', blush: 0.3, liner: false },
  { id: 'defined', name: 'Defined', blush: 0.25, liner: true },
  { id: 'bold', name: 'Bold', blush: 0.4, liner: true, shadow: '#6b4a7a' },
];
