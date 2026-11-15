// School stages, programmes after high school, housing, cliques and clubs.
// Everything here is plain data: edit values or add entries freely.

/** Compulsory schooling. `start` is the age a stage begins. */
export const SCHOOL_STAGES = [
  { id: 'elementary', start: 5, label: 'elementary school' },
  { id: 'middle', start: 11, label: 'middle school' },
  { id: 'high', start: 14, label: 'high school' },
];
export const SCHOOL_LEAVING_AGE = 18;
export const DROPOUT_AGE = 16;

/**
 * Programmes after high school. tuition is base units per year (0 where the
 * country funds university; trade schools always charge).
 * needs: degree type required to apply. minGpa is checked against that degree.
 * kind 'trade' programmes have no major and award a licence.
 */
export const PROGRAMMES = {
  university: { id: 'university', label: 'University', years: 4, tuition: 14000, needs: 'high', minGpa: 2.0,
    blurb: 'A four-year degree in a subject you choose.' },
  cosmetology: { id: 'cosmetology', label: 'Cosmetology school', kind: 'trade', years: 1, tuition: 9000,
    needs: 'high', minGpa: 0, yearly: { stats: { charm: 3 }, hidden: { discipline: 2 } },
    blurb: 'Trade school. One year to a licence in hair and makeup.' },
  graduate: { id: 'graduate', label: 'Graduate school', years: 2, tuition: 18000, needs: 'university', minGpa: 3.0,
    blurb: 'Two more years for a master\'s in your subject.' },
  medical: { id: 'medical', label: 'Medical school', years: 4, tuition: 38000, needs: 'university', minGpa: 3.6,
    blurb: 'Four gruelling years. Needs a science or health degree.' },
  law: { id: 'law', label: 'Law school', years: 3, tuition: 32000, needs: 'university', minGpa: 3.4,
    blurb: 'Three years of case law and very little sleep.' },
};

/** Where you live while studying. cost is base units per year. */
export const HOUSING = {
  home: { id: 'home', label: 'Live at home', cost: 0,
    blurb: 'Free. You commute, and your parents still expect you at dinner.' },
  dorm: { id: 'dorm', label: 'Campus dorm', cost: 9000,
    blurb: 'Right in the middle of everything, sharing a corridor with strangers.' },
  apartment: { id: 'apartment', label: 'Off-campus apartment', cost: 7000,
    blurb: 'Split the rent with a roommate. Your own rules, your own dishes.' },
};

/** High-school social groups. `needs` gates entry; `yearly` applies each year you stay. */
export const CLIQUES = [
  { id: 'brains', name: 'The Brains', desc: 'Library at lunch, top of every class.',
    needs: { 'stats.intellect': 60 }, yearly: { stats: { intellect: 1 } }, gpa: 0.15 },
  { id: 'athletes', name: 'The Athletes', desc: 'Team kit, early training, loud tables.',
    needs: { 'talents.sports': 50 }, yearly: { stats: { health: 1 }, talents: { sports: 2 } } },
  { id: 'artists', name: 'The Artists', desc: 'Paint under the fingernails, band after school.',
    needs: { 'talents.music|talents.acting|talents.singing|talents.dance': 45 },
    yearly: { talents: { music: 2, acting: 2, singing: 1, dance: 1 } } },
  { id: 'populars', name: 'The In-Crowd', desc: 'Everyone knows their names.',
    needs: { 'stats.charm': 65 }, yearly: { stats: { charm: 1, mood: 1 } }, gpa: -0.05 },
  { id: 'rebels', name: 'The Rebels', desc: 'Behind the bike sheds, never in assembly.',
    needs: {}, yearly: { stats: { mood: 1 }, talents: { crime: 2 }, hidden: { discipline: -2 } }, gpa: -0.15 },
  { id: 'loners', name: 'On your own', desc: 'Headphones in. Nobody bothers you.',
    needs: {}, yearly: { hidden: { willpower: 1 } } },
];
export const CLIQUE_BY_ID = Object.fromEntries(CLIQUES.map((c) => [c.id, c]));

/**
 * Clubs, teams and classes. `from` is the youngest age you can join.
 * tryout: skill check to get in (omit for open ones). yearly: gains each year.
 * contact: joining introduces you to this person, who then appears in scenes
 * as 'tag:<tag>' and remembers what you do.
 */
export const CLUBS = [
  { id: 'dance_class', name: 'Dance classes', from: 4, blurb: 'Ballet, tap and jazz.',
    yearly: { talents: { dance: 5 }, stats: { health: 1 } } },
  { id: 'choir', name: 'Singing lessons and choir', from: 6, blurb: 'Scales, harmonies, breath.',
    yearly: { talents: { singing: 5, music: 1 } } },
  { id: 'youth_theatre', name: 'Youth theatre', from: 6, blurb: 'Saturday-morning acting classes.',
    yearly: { talents: { acting: 4 }, stats: { charm: 1 } } },
  { id: 'musical_theatre', name: 'Musical theatre company', from: 11,
    blurb: 'The school\'s big shows. You need to sing, dance and act.',
    tryout: { base: 0.4, factors: { 'talents.singing': 0.45, 'talents.dance': 0.45, 'talents.acting': 0.45 } },
    yearly: { talents: { singing: 3, dance: 3, acting: 3 } },
    contact: { tag: 'director', title: 'Drama director', role: 'mentor', ageRange: [28, 55] } },
  { id: 'sports_team', name: 'Sports team', from: 11, tryout: { base: 0.4, factors: { 'talents.sports': 0.9, 'stats.health': 0.2 } },
    yearly: { talents: { sports: 4 }, stats: { health: 2 } } },
  { id: 'band', name: 'School band', from: 11, tryout: { base: 0.45, factors: { 'talents.music': 0.9 } },
    yearly: { talents: { music: 4 } } },
  { id: 'drama', name: 'Drama club', from: 11, tryout: { base: 0.5, factors: { 'talents.acting': 0.8, 'stats.charm': 0.2 } },
    yearly: { talents: { acting: 4 }, stats: { charm: 1 } } },
  { id: 'chess', name: 'Chess club', from: 11, tryout: { base: 0.6, factors: { 'stats.intellect': 0.7 } },
    yearly: { stats: { intellect: 2 } } },
  { id: 'debate', name: 'Debate team', from: 11, tryout: { base: 0.45, factors: { 'stats.intellect': 0.5, 'stats.charm': 0.4 } },
    yearly: { stats: { intellect: 1, charm: 1 } } },
  { id: 'council', name: 'Student council', from: 11, tryout: { base: 0.35, factors: { 'stats.charm': 0.9 } },
    yearly: { stats: { charm: 2 }, hidden: { discipline: 1 } } },
  { id: 'paper', name: 'School newspaper', from: 11, tryout: { base: 0.6, factors: { 'stats.intellect': 0.5 } },
    yearly: { stats: { intellect: 1 }, hidden: { discipline: 2 } } },
  { id: 'volunteers', name: 'Volunteer group', from: 11,
    yearly: { hidden: { karma: 4 }, stats: { mood: 1 } } },
];
export const CLUB_BY_ID = Object.fromEntries(CLUBS.map((c) => [c.id, c]));
export const MAX_CLUBS = 3;
