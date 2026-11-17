// The legal rules the game asks about, and where they differ.
//
// GAMEPLAY CONFIGURATION, COMPILED BY HAND AND UNVERIFIED. These are the
// author's best understanding of the mid-2020s, simplified to one value per
// place. Real law has conditions, exceptions and regional differences that
// are not modelled, and it changes. Nothing here is legal information.
//
// A rule is looked up in layers (engine/rules.js), last one wins:
//   1. DEFAULT        the value in RULES
//   2. parent place   a territory starts from the state it belongs to
//   3. place          PLACE_RULES, and the five flags kept in data/living.js
//   4. region         REGION_RULES, for a state or province inside a place
//   5. enacted        changes made during this life, kept in the save

/**
 * kind: 'age' (a whole number of years), 'flag' (true or false), 'level' (one of `levels`).
 * from: for the five flags that already live in data/living.js, the name they have there.
 */
export const RULES = {
  votingAge: { name: 'Voting age', kind: 'age', default: 18 },
  drivingAge: { name: 'Driving age', kind: 'age', default: 18 },
  drinkingAge: { name: 'Drinking age', kind: 'age', default: 18 },
  gamblingAge: { name: 'Gambling age', kind: 'age', default: 18 },
  marriageAge: { name: 'Marriage age', kind: 'age', default: 18 },
  schoolLeavingAge: { name: 'School-leaving age', kind: 'age', default: 16 },
  retirementAge: { name: 'State pension age', kind: 'age', default: 68 },
  alcohol: { name: 'Alcohol', kind: 'flag', default: true, words: ['Banned', 'Legal'] },
  gambling: { name: 'Gambling', kind: 'flag', default: true, from: 'gambling', words: ['Banned', 'Legal'] },
  divorce: { name: 'Divorce', kind: 'flag', default: true, words: ['Not available', 'Available'] },
  sameSexMarriage: { name: 'Same-sex marriage', kind: 'flag', default: false, from: 'marriage', words: ['Not available', 'Legal'] },
  lgbt: { name: 'LGBT people', kind: 'level', default: 'limited', from: 'lgbt', levels: ['hostile', 'limited', 'equal'],
    words: { equal: 'Protected in law', limited: 'Limited protection', hostile: 'Against the law, or close to it' } },
  deathPenalty: { name: 'Death penalty', kind: 'flag', default: false, from: 'deathPenalty', words: ['Not used', 'In use'] },
  conscription: { name: 'Military service', kind: 'flag', default: false, from: 'conscription', words: ['Voluntary', 'Compulsory'] },
};

/** Where a place differs from the default. Unverified. */
export const PLACE_RULES = {
  us: { drinkingAge: 21, gamblingAge: 21, drivingAge: 16, retirementAge: 67 },
  pr: { drinkingAge: 18, gamblingAge: 18 }, // otherwise as the United States
  ca: { drinkingAge: 19, drivingAge: 16 },
  uk: { drivingAge: 17, retirementAge: 67 },
  ie: { drivingAge: 17 },
  au: { drivingAge: 17 },
  nz: { drivingAge: 16 },
  fr: { drivingAge: 17, retirementAge: 64 },
  de: { drinkingAge: 16, retirementAge: 67 },
  at: { drinkingAge: 16, votingAge: 16 },
  be: { drinkingAge: 16 },
  ch: { drinkingAge: 16 },
  it: { retirementAge: 67 },
  es: { retirementAge: 67 },
  jp: { drinkingAge: 20, retirementAge: 65 },
  kr: { drinkingAge: 19 },
  th: { drinkingAge: 20 },
  id: { drinkingAge: 21, votingAge: 17 },
  in: { drinkingAge: 21, retirementAge: 60 },
  br: { votingAge: 16, retirementAge: 65 },
  ar: { votingAge: 16 },
  ec: { votingAge: 16 },
  cu: { votingAge: 16 },
  ni: { votingAge: 16 },
  sg: { votingAge: 21, gamblingAge: 21 },
  kw: { votingAge: 21, alcohol: false },
  lb: { votingAge: 21 },
  sa: { alcohol: false },
  ir: { alcohol: false },
  af: { alcohol: false },
  ph: { divorce: false },
  ru: { retirementAge: 65 },
};

/**
 * Where part of a place differs from the rest of it, keyed 'place/region'
 * (region ids are in data/cities.js). Only regions that have a city in the
 * game are listed. Unverified, like everything else here.
 */
export const REGION_RULES = {
  // United States: the death penalty is a matter for each state.
  'us/new_york': { deathPenalty: false },
  'us/illinois': { deathPenalty: false },
  'us/washington': { deathPenalty: false },
  'us/colorado': { deathPenalty: false },
  // Canada: the drinking age is set by each province.
  'ca/quebec': { drinkingAge: 18 },
  'ca/alberta': { drinkingAge: 18 },
  'ca/manitoba': { drinkingAge: 18 },
  // India: set by each state.
  'in/maharashtra': { drinkingAge: 25 },
  // United Arab Emirates: set by each emirate.
  'ae/sharjah': { alcohol: false },
};

/** Changes the world may make by itself over the years (engine/rules.js tickRules). */
export const REFORM = {
  chance: 0.06,     // a year in which one place changes one law
  homeBias: 0.3,    // how often that place is where the player lives
};
