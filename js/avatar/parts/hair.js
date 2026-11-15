// Hairstyles and hair colours. They are independent: changing the colour
// keeps the cut, and changing the cut keeps the colour.
//
// A style is drawn in two layers on the shared template: `back` goes behind
// the head and shoulders-side of the face, `front` goes over the forehead.
// Each layer is a list of shapes:
//   { d }                a filled path
//   { c: [x, y, r] }     a filled circle (used for curls)
//   { s, w }             a stroked strand of width w (braids, locs);
//                        add `segments: true` to mark it as a plait
// `lines` are fine strokes in a darker shade drawn over the front layer.
// `textures` says which natural hair textures the style suits; a newborn's
// first haircut is chosen from styles that suit the texture they inherited.
// IDs are saved in characters: never rename or remove one, only add.

const CAP = 'M26 43C24 26 35 12.5 50 12.5C65 12.5 76 26 74 43C70.5 31 61 24.5 50 24.5C39 24.5 29.5 31 26 43Z';
const AFRO_RING = Array.from({ length: 15 }, (_, i) => {
  const a = Math.PI * (1.04 + (i / 14) * 0.92);
  return { c: [Math.round((50 + 30 * Math.cos(a)) * 10) / 10, Math.round((41 + 27 * Math.sin(a)) * 10) / 10, 6] };
});

export const HAIR_STYLES = [
  { id: 'bald', name: 'Shaved head', textures: [], back: [], front: [] },
  { id: 'buzz', name: 'Buzz cut', textures: ['straight', 'wavy', 'curly', 'coily'], sheer: 0.82, back: [],
    front: [{ d: 'M26.5 42C24.5 25 35 13.5 50 13.5C65 13.5 75.5 25 73.5 42C72 33 64 25.5 50 25.5C36 25.5 28 33 26.5 42Z' }] },
  { id: 'short_crop', name: 'Short crop', textures: ['straight', 'wavy'], back: [],
    front: [{ d: 'M25 45C21.5 25 33.5 10.5 50 10.5C66.5 10.5 78.5 25 75 45C74.5 38 72 32 68 28.5C59 33.5 44 33 35.5 26.5C30 30.5 26.5 37 25 45Z' }],
    lines: ['M37 24Q47 18.5 60 21'] },
  { id: 'side_part', name: 'Side parting', textures: ['straight'], back: [],
    front: [{ d: 'M24.5 46C21 25 34 10 50 10C67 10 79 25 75.5 46C75 38 72 31 67 27C56 28 42 31 30 39C27 41 25.5 43.5 24.5 46Z' }],
    lines: ['M66 26Q54 14 38 15'] },
  { id: 'pixie', name: 'Pixie cut', textures: ['straight', 'wavy'], back: [],
    front: [{ d: 'M25 44C22 25 34 10.5 50 10.5C66 10.5 78 25 75 44C74 38 72 33 69 30Q60 27 54 31Q44 36 33 31Q28 36 25 44Z' }] },
  { id: 'waves', name: 'Waves', textures: ['wavy'],
    back: [{ d: 'M22 50C19 27 33 9 50 9C67 9 81 27 78 50Q82 58 77 64Q72 60 74 52L74 44L26 44L26 52Q28 60 23 64Q18 58 22 50Z' }],
    front: [{ d: 'M24.5 45C22 26 34 11 50 11C66 11 78 26 75.5 45Q72 37 67 38Q62 30 56 35Q50 28 44 34Q38 29 33 37Q28 37 24.5 45Z' }],
    lines: ['M34 22Q40 17 46 21Q52 25 58 20', 'M30 30Q35 26 40 29'] },
  { id: 'curls_tight', name: 'Tight curls', textures: ['curly', 'coily'],
    back: [{ c: [24.5, 45, 6] }, { c: [75.5, 45, 6] }],
    front: [[30, 30, 7], [37, 22, 7.5], [46, 17, 8], [55, 17, 8], [64, 22, 7.5], [71, 30, 7], [27, 38.5, 5.5], [73, 38.5, 5.5],
      [41, 27, 6], [50, 25, 6.5], [59, 27, 6], [33.5, 34, 5], [66.5, 34, 5]].map((c) => ({ c })) },
  { id: 'coils', name: 'Coils (afro)', textures: ['coily', 'curly'],
    back: [{ d: 'M50 11C68 11 81 24 81 41C81 52 77 60 72 65L28 65C23 60 19 52 19 41C19 24 32 11 50 11Z' }, ...AFRO_RING],
    front: [{ d: 'M25.5 44C23 24 34 13 50 13C66 13 77 24 74.5 44C70 35 62 30.5 50 30.5C38 30.5 30 35 25.5 44Z' }] },
  { id: 'braids', name: 'Braids', textures: ['coily', 'curly', 'wavy', 'straight'],
    back: [['M24 36L17 86', 5], ['M27.5 40L23 94', 5], ['M31 44L29.5 97', 5], ['M76 36L83 86', 5], ['M72.5 40L77 94', 5], ['M69 44L70.5 97', 5]]
      .map(([s, w]) => ({ s, w, segments: true })),
    front: [{ d: CAP }], lines: ['M50 12.5V24.5', 'M41 14L43 26', 'M59 14L57 26', 'M33 18.5L37 29.5', 'M67 18.5L63 29.5'] },
  { id: 'locs', name: 'Locs', textures: ['coily', 'curly'],
    back: [['M24 34L18.5 70', 6.4], ['M28 38L24 76', 6.4], ['M33 42L31.5 80', 6.4], ['M76 34L81.5 70', 6.4], ['M72 38L76 76', 6.4], ['M67 42L68.5 80', 6.4]]
      .map(([s, w]) => ({ s, w })),
    front: [{ d: CAP }], lines: ['M50 12.5V24.5', 'M40 14L42.5 26', 'M60 14L57.5 26'] },
  { id: 'bob', name: 'Bob', textures: ['straight', 'wavy'],
    back: [{ d: 'M21.5 50C19 26 32 8.5 50 8.5C68 8.5 81 26 78.5 50L79 68Q79 76 71 76L29 76Q21 76 21 68Z' }],
    front: [{ d: 'M25.5 44C23 26 34.5 11.5 50 11.5C65.5 11.5 77 26 74.5 44C73 39 71 36 68 34.5C60 37 40 37 32 34.5C29 36 27 39 25.5 44Z' }],
    lines: ['M40 20V35', 'M50 19V36', 'M60 20V35'] },
  { id: 'long_straight', name: 'Long and straight', textures: ['straight'],
    back: [{ d: 'M20 52C17 26 31 7.5 50 7.5C69 7.5 83 26 80 52L83 99L17 99Z' }],
    front: [{ d: 'M25.5 47C23 27 34 11 50 11C66 11 77 27 74.5 47C73 35 64 24 50 20.5C36 24 27 35 25.5 47Z' }],
    lines: ['M50 11V20.5'] },
  { id: 'long_wavy', name: 'Long waves', textures: ['wavy'],
    back: [{ d: 'M19.5 52C16.5 26 31 7.5 50 7.5C69 7.5 83.5 26 80.5 52Q86 61 80.5 70Q86.5 79 80.5 88Q85 95 79 99L21 99Q15 95 19.5 88Q13.5 79 19.5 70Q14 61 19.5 52Z' }],
    front: [{ d: 'M25 47C22 27 34 11 50 11C66 11 78 27 75 47C74 37 70 30 64 26C54 27 40 32 31 41Q27 43.5 25 47Z' }],
    lines: ['M63 25Q52 14 38 15.5'] },
  { id: 'long_curly', name: 'Long curls', textures: ['curly', 'coily'],
    back: [[22, 40, 9], [19, 54, 9], [21, 68, 9], [24, 82, 9], [78, 40, 9], [81, 54, 9], [79, 68, 9], [76, 82, 9], [50, 14, 14], [34, 20, 10], [66, 20, 10]].map((c) => ({ c })),
    front: [[31, 29, 6.5], [39, 22, 7], [50, 19, 7.5], [61, 22, 7], [69, 29, 6.5], [27, 38, 5], [73, 38, 5]].map((c) => ({ c })) },
  { id: 'ponytail', name: 'Ponytail', textures: ['straight', 'wavy', 'curly'],
    back: [{ d: 'M68 22Q90 30 85 62Q83 80 74 92Q80 70 74 48Z' }],
    front: [{ d: CAP }] },
  { id: 'bun', name: 'Top bun', textures: ['straight', 'wavy', 'curly', 'coily'],
    back: [{ c: [50, 8.5, 9.5] }], front: [{ d: CAP }] },
  { id: 'puffs', name: 'Two puffs', textures: ['coily', 'curly'],
    back: [{ c: [26, 18, 12] }, { c: [74, 18, 12] }], front: [{ d: CAP }], lines: ['M50 12.5V24.5'] },
];

/** natural: true colours can be inherited; the rest only come out of a bottle. */
export const HAIR_COLORS = [
  { id: 'black', name: 'Black', hex: '#1f1b1b', natural: true },
  { id: 'dark_brown', name: 'Dark brown', hex: '#3b2618', natural: true },
  { id: 'brown', name: 'Brown', hex: '#5e3b1f', natural: true },
  { id: 'light_brown', name: 'Light brown', hex: '#8b5c32', natural: true },
  { id: 'auburn', name: 'Auburn', hex: '#7c3521', natural: true },
  { id: 'ginger', name: 'Ginger', hex: '#b9571f', natural: true },
  { id: 'dark_blonde', name: 'Dark blonde', hex: '#ae8747', natural: true },
  { id: 'blonde', name: 'Blonde', hex: '#dcb866', natural: true },
  { id: 'platinum', name: 'Platinum', hex: '#ece0c0', natural: false },
  { id: 'silver', name: 'Silver', hex: '#c6ccd4', natural: false },
  { id: 'pink', name: 'Pink', hex: '#e86aa6', natural: false },
  { id: 'red', name: 'Bright red', hex: '#d0242e', natural: false },
  { id: 'purple', name: 'Purple', hex: '#7d4cc2', natural: false },
  { id: 'blue', name: 'Blue', hex: '#3d7bd9', natural: false },
  { id: 'teal', name: 'Teal', hex: '#1f9aa0', natural: false },
  { id: 'green', name: 'Green', hex: '#3fa56b', natural: false },
];

export const HAIR_TEXTURES = [
  { id: 'straight', name: 'Straight' }, { id: 'wavy', name: 'Wavy' }, { id: 'curly', name: 'Curly' }, { id: 'coily', name: 'Coily' },
];
