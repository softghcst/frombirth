// Skin tones, lightest to deepest, with varied undertones. `depth` is the
// position on the light-to-deep scale and is what inheritance blends.
// The renderer derives shadow, blush and lip colours from `base`.
// IDs are saved in characters: never rename or remove one, only add.
export const SKIN_TONES = [
  { id: 'porcelain', name: 'Porcelain', depth: 0, undertone: 'cool', base: '#f9e2d6' },
  { id: 'ivory', name: 'Ivory', depth: 1, undertone: 'warm', base: '#f5d9bf' },
  { id: 'rose_beige', name: 'Rose beige', depth: 2, undertone: 'cool', base: '#eec4b0' },
  { id: 'sand', name: 'Sand', depth: 3, undertone: 'neutral', base: '#e6bd95' },
  { id: 'golden', name: 'Golden', depth: 4, undertone: 'warm', base: '#dba972' },
  { id: 'olive', name: 'Olive', depth: 5, undertone: 'olive', base: '#c69a6b' },
  { id: 'tan', name: 'Tan', depth: 6, undertone: 'warm', base: '#b98254' },
  { id: 'bronze', name: 'Bronze', depth: 7, undertone: 'neutral', base: '#a06b45' },
  { id: 'chestnut', name: 'Chestnut', depth: 8, undertone: 'warm', base: '#87552f' },
  { id: 'umber', name: 'Umber', depth: 9, undertone: 'cool', base: '#6f4632' },
  { id: 'espresso', name: 'Espresso', depth: 10, undertone: 'neutral', base: '#573525' },
  { id: 'ebony', name: 'Ebony', depth: 11, undertone: 'cool', base: '#3f2720' },
];
