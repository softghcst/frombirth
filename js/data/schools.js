// School stages, higher-education programmes, cliques and clubs.

/** Compulsory schooling. `start` is the age a stage begins. */
export const SCHOOL_STAGES = [
  { id: 'elementary', start: 5, label: 'elementary school' },
  { id: 'middle', start: 11, label: 'middle school' },
  { id: 'high', start: 14, label: 'high school' },
];
export const SCHOOL_LEAVING_AGE = 18;
export const DROPOUT_AGE = 16;

/**
 * Higher education. tuition is base units per year (0 where the country funds it).
 * needs: degree type required to apply. minGpa is checked against that degree.
 */
export const PROGRAMMES = {
  university: { id: 'university', label: 'University', years: 4, tuition: 14000, needs: 'high', minGpa: 2.0,
    blurb: 'A four-year degree in a subject you choose.' },
  graduate: { id: 'graduate', label: 'Graduate school', years: 2, tuition: 18000, needs: 'university', minGpa: 2.8,
    blurb: 'Two more years for a master\'s in your subject.' },
  medical: { id: 'medical', label: 'Medical school', years: 4, tuition: 38000, needs: 'university', minGpa: 3.3,
    blurb: 'Four gruelling years. Needs a science or health degree.' },
  law: { id: 'law', label: 'Law school', years: 3, tuition: 32000, needs: 'university', minGpa: 3.0,
    blurb: 'Three years of case law and very little sleep.' },
};

/** High-school social groups. `needs` gates entry; `yearly` applies each year you stay. */
export const CLIQUES = [
  { id: 'brains', name: 'The Brains', desc: 'Library at lunch, top of every class.',
    needs: { 'stats.intellect': 60 }, yearly: { stats: { intellect: 1 } }, gpa: 0.15 },
  { id: 'athletes', name: 'The Athletes', desc: 'Team kit, early training, loud tables.',
    needs: { 'talents.sports': 50 }, yearly: { stats: { health: 1 }, talents: { sports: 2 } } },
  { id: 'artists', name: 'The Artists', desc: 'Paint under the fingernails, band after school.',
    needs: { 'talents.music|talents.acting': 45 }, yearly: { talents: { music: 2, acting: 2 } } },
  { id: 'populars', name: 'The In-Crowd', desc: 'Everyone knows their names.',
    needs: { 'stats.charm': 65 }, yearly: { stats: { charm: 1, mood: 1 } }, gpa: -0.05 },
  { id: 'rebels', name: 'The Rebels', desc: 'Behind the bike sheds, never in assembly.',
    needs: {}, yearly: { stats: { mood: 1 }, talents: { crime: 2 }, hidden: { discipline: -2 } }, gpa: -0.15 },
  { id: 'loners', name: 'On your own', desc: 'Headphones in. Nobody bothers you.',
    needs: {}, yearly: { hidden: { willpower: 1 } } },
];
export const CLIQUE_BY_ID = Object.fromEntries(CLIQUES.map((c) => [c.id, c]));

/**
 * Clubs and teams (middle school upward, at most two at a time).
 * tryout: skill check to get in (omit for open clubs). yearly: gains each year.
 */
export const CLUBS = [
  { id: 'sports_team', name: 'Sports team', tryout: { base: 0.4, factors: { 'talents.sports': 0.9, 'stats.health': 0.2 } },
    yearly: { talents: { sports: 4 }, stats: { health: 2 } } },
  { id: 'band', name: 'School band', tryout: { base: 0.45, factors: { 'talents.music': 0.9 } },
    yearly: { talents: { music: 4 } } },
  { id: 'drama', name: 'Drama club', tryout: { base: 0.5, factors: { 'talents.acting': 0.8, 'stats.charm': 0.2 } },
    yearly: { talents: { acting: 4 }, stats: { charm: 1 } } },
  { id: 'chess', name: 'Chess club', tryout: { base: 0.6, factors: { 'stats.intellect': 0.7 } },
    yearly: { stats: { intellect: 2 } } },
  { id: 'debate', name: 'Debate team', tryout: { base: 0.45, factors: { 'stats.intellect': 0.5, 'stats.charm': 0.4 } },
    yearly: { stats: { intellect: 1, charm: 1 } } },
  { id: 'council', name: 'Student council', tryout: { base: 0.35, factors: { 'stats.charm': 0.9 } },
    yearly: { stats: { charm: 2 }, hidden: { discipline: 1 } } },
  { id: 'paper', name: 'School newspaper', tryout: { base: 0.6, factors: { 'stats.intellect': 0.5 } },
    yearly: { stats: { intellect: 1 }, hidden: { discipline: 2 } } },
  { id: 'volunteers', name: 'Volunteer group',
    yearly: { hidden: { karma: 4 }, stats: { mood: 1 } } },
];
export const CLUB_BY_ID = Object.fromEntries(CLUBS.map((c) => [c.id, c]));
export const MAX_CLUBS = 2;
