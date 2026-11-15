// Inherited traits and parent occupations used at birth. Phase 2 extends both.
export const TRAITS = [
  { id: 'bookish', name: 'Bookish', desc: 'Picks things up quickly.', stats: { intellect: 10 } },
  { id: 'radiant', name: 'Radiant', desc: 'People notice you.', stats: { charm: 10 } },
  { id: 'hardy', name: 'Hardy', desc: 'Rarely gets sick.', stats: { health: 10 } },
  { id: 'sunny', name: 'Sunny', desc: 'Bounces back fast.', stats: { mood: 10 } },
  { id: 'steady', name: 'Steady', desc: 'Sticks with things.', hidden: { discipline: 15 } },
  { id: 'stubborn', name: 'Stubborn', desc: 'Hard to talk out of anything.', hidden: { willpower: 15 } },
  { id: 'restless', name: 'Restless', desc: 'Bores easily, acts first.', hidden: { crazy: 15, discipline: -10 } },
  { id: 'gentle', name: 'Gentle', desc: 'Kind by default.', hidden: { karma: 15 } },
];

export const OCCUPATIONS = [
  { title: 'nurse', wealth: [35, 60] },
  { title: 'electrician', wealth: [35, 60] },
  { title: 'school teacher', wealth: [30, 55] },
  { title: 'bus driver', wealth: [20, 40] },
  { title: 'line cook', wealth: [10, 30] },
  { title: 'accountant', wealth: [45, 70] },
  { title: 'software engineer', wealth: [55, 85] },
  { title: 'warehouse picker', wealth: [10, 30] },
  { title: 'dentist', wealth: [65, 90] },
  { title: 'florist', wealth: [20, 45] },
  { title: 'police officer', wealth: [35, 55] },
  { title: 'lawyer', wealth: [60, 95] },
  { title: 'farmhand', wealth: [10, 30] },
  { title: 'hair stylist', wealth: [20, 45] },
  { title: 'civil engineer', wealth: [50, 75] },
  { title: 'shop owner', wealth: [30, 80] },
  { title: 'stay-at-home parent', wealth: [15, 60] },
  { title: 'unemployed', wealth: [0, 15] },
];

export const PETS = [
  { species: 'dog', names: ['Biscuit', 'Juno', 'Pepper', 'Moose', 'Olive'], lifespan: 14 },
  { species: 'cat', names: ['Miso', 'Pickle', 'Shadow', 'Clementine', 'Figaro'], lifespan: 17 },
  { species: 'rabbit', names: ['Clover', 'Thistle', 'Button'], lifespan: 9 },
  { species: 'parrot', names: ['Captain', 'Mango', 'Echo'], lifespan: 40 },
];
