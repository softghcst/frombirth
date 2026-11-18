// Things a person can be born with. Rolled once at birth (at most two apply).
// Mods use the same shape as traits; `illness` also starts a health condition.
export const BIRTH_CONDITIONS = [
  { id: 'premature', name: 'Born premature', chance: 0.04,
    desc: 'You arrived six weeks early and spent your first month in an incubator.',
    stats: { health: -12 }, hidden: { willpower: 6 } },
  { id: 'heart_murmur', name: 'Heart murmur', chance: 0.015,
    desc: 'The doctors heard a murmur in your heart at birth.',
    stats: { health: -8 } },
  { id: 'born_asthmatic', name: 'Weak lungs', chance: 0.03,
    desc: 'You were born with weak lungs.', illness: 'asthma', stats: { health: -4 } },
  // Color vision is now inherited (X-linked) through engine/health/heredity.js; kept here so older saves still show it.
  { id: 'colour_blind', name: 'Color blind', chance: 0,
    desc: 'Reds and greens will always look much the same to you.' },
  { id: 'left_handed', name: 'Left-handed', chance: 0.1,
    desc: 'You reach for everything with your left hand.', talents: { music: 4, sports: 3 } },
  // Dyslexia is now part of the health record (inherited, recognised at school). It never lowers intellect.
  { id: 'dyslexia', name: 'Dyslexia', chance: 0,
    desc: 'Letters will not sit still for you, so you learn to work around them.' },
  { id: 'hyperactive', name: 'Boundless energy', chance: 0.05,
    desc: 'You never, ever sit still.',
    hidden: { discipline: -10, crazy: 5 }, talents: { sports: 8 } },
  { id: 'double_jointed', name: 'Double-jointed', chance: 0.03,
    desc: 'Your joints bend in ways that alarm other people.', talents: { sports: 8, acting: 3 } },
  { id: 'perfect_pitch', name: 'Perfect pitch', chance: 0.01,
    desc: 'You can name any note you hear.', talents: { music: 30 } },
  { id: 'photographic_memory', name: 'Photographic memory', chance: 0.007,
    desc: 'You remember everything you see.', stats: { intellect: 15 } },
  { id: 'heterochromia', name: 'Mismatched eyes', chance: 0.006,
    desc: 'Your eyes are two different colors.', stats: { charm: 6 } },
  { id: 'iron_constitution', name: 'Iron constitution', chance: 0.02,
    desc: 'You were a huge, loud, extremely healthy baby.', stats: { health: 12 } },
];

export const BIRTH_BY_ID = Object.fromEntries(BIRTH_CONDITIONS.map((b) => [b.id, b]));
