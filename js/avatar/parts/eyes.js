// Eye shapes and eye colours. They are independent: changing one keeps the other.
//
// A shape is drawn for the eye on the viewer's right, centred on (0,0), with
// the outer corner at +x. The renderer mirrors it for the other eye.
//   white: the closed outline of the eye opening (the iris is clipped to it)
//   lash:  the upper lid line, drawn as a stroke
//   fold:  optional skin-coloured lid that hangs over the top of the eye
//   iris:  [x, y, radius] of the iris inside the opening
// IDs are saved in characters: never rename or remove one, only add.
export const EYE_SHAPES = [
  { id: 'almond', name: 'Almond',
    white: 'M-6.6 0.6Q-2.5-4.3 2.6-3.3Q6-2.4 7.2 0Q3.2 3.5-1.4 3.4Q-5 3-6.6 0.6Z',
    lash: 'M-6.8 0.7Q-2.5-4.5 2.6-3.5Q6.2-2.6 7.6-0.2', iris: [0.2, -0.3, 3.2] },
  { id: 'round', name: 'Round',
    white: 'M-6 0Q-5.2-5.6 0-5.6Q5.2-5.6 6 0Q5.2 4.4 0 4.4Q-5.2 4.4-6 0Z',
    lash: 'M-6.2 0.2Q-5.4-5.9 0-5.9Q5.4-5.9 6.4 0', iris: [0, -0.5, 3.6] },
  { id: 'hooded', name: 'Hooded',
    white: 'M-6.6 0.9Q-2.2-2.7 2.6-2.4Q6-1.8 7.2 0.7Q3.2 3.4-1.4 3.2Q-5 2.8-6.6 0.9Z',
    lash: 'M-6.8 1Q-2.2-2.9 2.6-2.6Q6.2-2 7.6 0.6',
    fold: 'M-7.4-0.2Q-2-6.4 4-5.2Q7.6-3.8 8.2 0.2Q5.6-2.4 2.6-2.7Q-2.2-3-6.8 0.9Z', iris: [0.2, 0.3, 3] },
  { id: 'upturned', name: 'Upturned',
    white: 'M-6.6 1.6Q-2-3.6 3-3.7Q6.2-3.6 7.8-2.4Q5.2 2.6 0 3.4Q-4.2 3.4-6.6 1.6Z',
    lash: 'M-6.8 1.7Q-2-3.8 3-3.9Q6.4-3.8 8.6-3', iris: [0.6, -0.3, 3.1] },
  { id: 'downturned', name: 'Downturned',
    white: 'M-6.6-0.8Q-2-4.2 2.4-3Q5.8-1.6 7.4 1.4Q3.4 3.6-1 3.2Q-5 2.4-6.6-0.8Z',
    lash: 'M-6.8-0.8Q-2-4.4 2.4-3.2Q6-1.8 7.9 1.6', iris: [0, -0.2, 3.1] },
  { id: 'monolid', name: 'Monolid',
    white: 'M-6.8 0.8Q-2-2.4 2.6-2.2Q6.2-1.6 7.4 0.4Q3.6 2.8-1 2.8Q-5 2.6-6.8 0.8Z',
    lash: 'M-7 0.9Q-2-2.7 2.6-2.5Q6.4-1.9 7.9 0.2', iris: [0.2, 0.2, 2.8] },
];

export const EYE_COLORS = [
  { id: 'dark_brown', name: 'Dark brown', hex: '#3b2416' },
  { id: 'brown', name: 'Brown', hex: '#6a4022' },
  { id: 'hazel', name: 'Hazel', hex: '#8c6a2f' },
  { id: 'amber', name: 'Amber', hex: '#b07a2a' },
  { id: 'green', name: 'Green', hex: '#4f7d46' },
  { id: 'blue', name: 'Blue', hex: '#3f72b0' },
  { id: 'gray', name: 'Gray', hex: '#7b8794' },
];
