// Noses. Each is a set of strokes on the shared template, centred on x=50
// with the tip around y=58. They are drawn in a darker shade of the skin.
// `width` is how far the nostrils reach from the centre (used for shading).
// IDs are saved in characters: never rename or remove one, only add.
export const NOSES = [
  { id: 'button', name: 'Button', width: 3,
    d: 'M47.4 57.2Q50 60 52.6 57.2', dots: [[48.4, 57.6], [51.6, 57.6]] },
  { id: 'narrow', name: 'Narrow', width: 2.6,
    d: 'M51.2 52L52 56.6Q50.4 59 47.8 57.6' },
  { id: 'wide', name: 'Wide', width: 5.4,
    d: 'M45 57.8Q44.8 54.8 47.4 55.6M55 57.8Q55.2 54.8 52.6 55.6M46.4 58.8Q50 60.8 53.6 58.8' },
  { id: 'aquiline', name: 'Aquiline', width: 3.4,
    d: 'M51.2 48.5Q54.6 53.5 53 58Q50.2 60.4 47 58.4' },
  { id: 'rounded', name: 'Rounded', width: 4.2,
    d: 'M47.2 55Q45.2 57.4 47.4 58.6Q50 60.6 52.6 58.6Q54.8 57.4 52.8 55' },
  { id: 'upturned', name: 'Upturned', width: 3.2,
    d: 'M51 51.5L51.6 55Q50 57.2 48.2 56.6', dots: [[48.2, 58], [51.8, 58]] },
];
