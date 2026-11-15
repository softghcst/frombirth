// Heritable traits, parent occupations and pets used when a life begins.

/** Traits pass from parent to child. Mods apply once, at birth. */
export const TRAITS = [
  { id: 'bookish', name: 'Bookish', desc: 'Picks things up quickly.', stats: { intellect: 10 } },
  { id: 'radiant', name: 'Radiant', desc: 'People notice you.', stats: { charm: 10 } },
  { id: 'hardy', name: 'Hardy', desc: 'Rarely gets sick.', stats: { health: 10 } },
  { id: 'sunny', name: 'Sunny', desc: 'Bounces back fast.', stats: { mood: 10 } },
  { id: 'steady', name: 'Steady', desc: 'Sticks with things.', hidden: { discipline: 15 } },
  { id: 'stubborn', name: 'Stubborn', desc: 'Hard to talk out of anything.', hidden: { willpower: 15 } },
  { id: 'restless', name: 'Restless', desc: 'Bores easily, acts first.', hidden: { crazy: 15, discipline: -10 } },
  { id: 'gentle', name: 'Gentle', desc: 'Kind by default.', hidden: { karma: 15 } },
  { id: 'musical', name: 'Musical', desc: 'Hears a tune once and keeps it.', talents: { music: 14 } },
  { id: 'athletic', name: 'Athletic', desc: 'Built to move.', talents: { sports: 14 }, stats: { health: 4 } },
  { id: 'dramatic', name: 'Dramatic', desc: 'Every room is a stage.', talents: { acting: 14 }, hidden: { crazy: 5 } },
  { id: 'sly', name: 'Sly', desc: 'Notices what is unattended.', talents: { crime: 14 }, hidden: { karma: -6 } },
  { id: 'delicate', name: 'Delicate', desc: 'Catches everything going round.', stats: { health: -10 } },
  { id: 'worrier', name: 'Worrier', desc: 'Prepared for the worst, always.', stats: { mood: -8 }, hidden: { discipline: 8 } },
];
export const TRAIT_BY_ID = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

/** wealth: 0–100 range for the parent's Money meter. income: base units per year. */
export const OCCUPATIONS = [
  { title: 'nurse', wealth: [35, 60], income: 62000 },
  { title: 'electrician', wealth: [35, 60], income: 58000 },
  { title: 'school teacher', wealth: [30, 55], income: 52000 },
  { title: 'bus driver', wealth: [20, 40], income: 41000 },
  { title: 'line cook', wealth: [10, 30], income: 29000 },
  { title: 'accountant', wealth: [45, 70], income: 74000 },
  { title: 'software engineer', wealth: [55, 85], income: 115000 },
  { title: 'warehouse picker', wealth: [10, 30], income: 31000 },
  { title: 'dentist', wealth: [65, 90], income: 160000 },
  { title: 'florist', wealth: [20, 45], income: 33000 },
  { title: 'police officer', wealth: [35, 55], income: 60000 },
  { title: 'lawyer', wealth: [60, 95], income: 140000 },
  { title: 'farmhand', wealth: [10, 30], income: 27000 },
  { title: 'hair stylist', wealth: [20, 45], income: 34000 },
  { title: 'civil engineer', wealth: [50, 75], income: 88000 },
  { title: 'shop owner', wealth: [30, 80], income: 65000 },
  { title: 'surgeon', wealth: [80, 98], income: 320000 },
  { title: 'company director', wealth: [75, 100], income: 280000 },
  { title: 'investment banker', wealth: [80, 100], income: 350000 },
  { title: 'cleaner', wealth: [5, 25], income: 24000 },
  { title: 'stay-at-home parent', wealth: [15, 60], income: 0 },
  { title: 'unemployed', wealth: [0, 15], income: 6000 },
];

/** Family background presets for the character creator. */
export const BACKGROUNDS = {
  struggling: { label: 'Struggling', fits: (o) => o.wealth[1] <= 45 },
  comfortable: { label: 'Comfortable', fits: (o) => o.wealth[0] >= 30 && o.wealth[1] <= 85 },
  wealthy: { label: 'Wealthy', fits: (o) => o.wealth[1] >= 80, floor: 70 },
};

export const PETS = [
  { species: 'dog', names: ['Biscuit', 'Juno', 'Pepper', 'Moose', 'Olive'], lifespan: 14 },
  { species: 'cat', names: ['Miso', 'Pickle', 'Shadow', 'Clementine', 'Figaro'], lifespan: 17 },
  { species: 'rabbit', names: ['Clover', 'Thistle', 'Button'], lifespan: 9 },
  { species: 'parrot', names: ['Captain', 'Mango', 'Echo'], lifespan: 40 },
  { species: 'hamster', names: ['Nugget', 'Peanut', 'Gizmo'], lifespan: 3 },
];
