// Lip shapes. A shape is a few measurements rather than a fixed path, so the
// renderer can bend the mouth into a smile or a frown (the expression) and
// the lips stay recognisably the same shape.
//   width: half the width of the mouth
//   upper / lower: how tall each lip is
//   bow:   how deep the dip in the middle of the top lip is
// IDs are saved in characters: never rename or remove one, only add.
export const LIPS = [
  { id: 'thin', name: 'Thin', width: 7.2, upper: 1.3, lower: 1.9, bow: 0.4 },
  { id: 'full', name: 'Full', width: 7.6, upper: 3.1, lower: 4.1, bow: 0.9 },
  { id: 'cupid', name: 'Cupid\'s bow', width: 6.8, upper: 3.4, lower: 3, bow: 2 },
  { id: 'lower_full', name: 'Fuller lower lip', width: 7.2, upper: 1.7, lower: 4.8, bow: 0.5 },
  { id: 'wide', name: 'Wide', width: 9, upper: 2.1, lower: 2.8, bow: 0.7 },
  { id: 'heart', name: 'Small and round', width: 5.4, upper: 2.9, lower: 3.6, bow: 1.4 },
];

/** Lip colours a salon can apply over the natural one. */
export const LIP_COLORS = [
  { id: 'rose', name: 'Rose', hex: '#c9697a' },
  { id: 'red', name: 'Red', hex: '#b3202e' },
  { id: 'berry', name: 'Berry', hex: '#7c2a4d' },
  { id: 'coral', name: 'Coral', hex: '#e07a5f' },
  { id: 'nude', name: 'Nude', hex: '#b98474' },
  { id: 'black', name: 'Black', hex: '#2b2226' },
];
