import { systemFor } from './justice.js';
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
  retirementAge: { name: 'State pension age', kind: 'age', default: 65 },
  alcohol: { name: 'Alcohol', kind: 'flag', default: true, words: ['Banned', 'Legal'] },
  gambling: { name: 'Gambling', kind: 'flag', default: true, from: 'gambling', words: ['Banned', 'Legal'] },
  divorce: { name: 'Divorce', kind: 'flag', default: true, words: ['Not available', 'Available'] },
  sameSexMarriage: { name: 'Same-sex marriage', kind: 'flag', default: false, from: 'marriage', words: ['Not available', 'Legal'] },
  lgbt: { name: 'LGBT people', kind: 'level', default: 'limited', from: 'lgbt', levels: ['hostile', 'limited', 'equal'],
    words: { equal: 'Protected in law', limited: 'Limited protection', hostile: 'Against the law, or close to it' } },
  deathPenalty: { name: 'Death penalty', kind: 'flag', default: false, from: 'deathPenalty', words: ['Not used', 'In use'] },
  conscription: { name: 'Military service', kind: 'flag', default: false, from: 'conscription', words: ['Voluntary', 'Compulsory'] },
  // Justice. Where a place has no value of its own, these follow the procedure it uses (data/justice.js): `derive`.
  juryTrials: { name: 'Jury trials', kind: 'flag', default: false, derive: (id) => systemFor(id).factFinder === 'jury', words: ['Judges decide', 'Juries for serious charges'] },
  cashBail: { name: 'Money bail', kind: 'flag', default: false, derive: (id) => systemFor(id).bail === 'money', words: ['Release on conditions', 'Release can depend on money'] },
  recordSealing: { name: 'Sealing old records', kind: 'flag', default: true, derive: (id) => systemFor(id).sealAfter !== null, words: ['Records stay for good', 'Old records can be sealed'] },
  sentencing: { name: 'Sentencing', kind: 'level', default: 'standard', levels: ['lenient', 'standard', 'tough'],
    words: { lenient: 'Shorter sentences', standard: 'Ordinary sentences', tough: 'Longer sentences' } },
  prisonEducation: { name: 'Education in prisons', kind: 'level', default: 'standard', levels: ['minimal', 'standard', 'extensive'],
    derive: (id) => { const s = systemFor(id).schooling; return s >= 0.7 ? 'extensive' : s < 0.4 ? 'minimal' : 'standard'; },
    words: { minimal: 'Little on offer', standard: 'Some courses', extensive: 'Courses up to degree level' } },
};

/**
 * Where a place differs from the default.
 * Checked against Wikipedia, at these revisions (see docs/WORLD_DATA.md and scripts/verify-laws.py):
 *   voting ages: "Voting age" rev 1386001635 · drinking ages and alcohol bans: "Legal drinking age" rev 1381514309
 *   pension ages: "Retirement age" rev 1383117283 (the men's age, or the standard full-pension age where a range is given;
 *   countries the table does not cover keep the default). Driving and gambling ages are not yet checked.
 */
export const PLACE_RULES = {
  af: { alcohol: false },
  ar: { votingAge: 16 },
  at: { votingAge: 16, drinkingAge: 16 },
  au: { drivingAge: 17, retirementAge: 67 },
  bd: { drinkingAge: 21, retirementAge: 59 },
  be: { drinkingAge: 16, retirementAge: 66 },
  br: { votingAge: 16 },
  ca: { drivingAge: 16, drinkingAge: 19 },
  ch: { drinkingAge: 16 },
  cn: { retirementAge: 63 },
  co: { retirementAge: 62 },
  cu: { votingAge: 16, drinkingAge: 16 },
  cz: { retirementAge: 64 },
  de: { drinkingAge: 16 },
  dk: { retirementAge: 67 },
  ec: { votingAge: 16 },
  ee: { retirementAge: 64 },
  eg: { drinkingAge: 21, retirementAge: 60 },
  es: { retirementAge: 66 },
  fr: { drivingAge: 17, retirementAge: 64 },
  gr: { votingAge: 17, retirementAge: 67 },
  hk: { retirementAge: 65 },
  id: { votingAge: 17, drinkingAge: 21, retirementAge: 59 },
  ie: { drivingAge: 17, retirementAge: 67 },
  il: { retirementAge: 67 },
  in: { drinkingAge: 21, retirementAge: 60 },
  iq: { retirementAge: 60 },
  ir: { retirementAge: 60, alcohol: false },
  it: { retirementAge: 67 },
  jp: { drinkingAge: 20 },
  kr: { drinkingAge: 19, retirementAge: 60 },
  kw: { votingAge: 21, alcohol: false },
  kz: { drinkingAge: 21, retirementAge: 63 },
  lb: { votingAge: 21, retirementAge: 64 },
  ma: { retirementAge: 63 },
  my: { retirementAge: 60 },
  ni: { votingAge: 16 },
  nl: { retirementAge: 67 },
  no: { retirementAge: 67 },
  np: { votingAge: 16 },
  nz: { drivingAge: 16 },
  pe: { retirementAge: 60 },
  ph: { retirementAge: 60, divorce: false },
  pk: { retirementAge: 60, alcohol: false },
  pr: { drinkingAge: 18, gamblingAge: 18 },
  pt: { retirementAge: 66 },
  qa: { drinkingAge: 21 },
  ru: { retirementAge: 64 },
  sa: { retirementAge: 60, alcohol: false },
  se: { retirementAge: 66 },
  sg: { votingAge: 21, gamblingAge: 21, retirementAge: 63 },
  sk: { retirementAge: 62 },
  th: { drinkingAge: 20, retirementAge: 60 },
  tn: { retirementAge: 62 },
  tr: { retirementAge: 62 },
  tw: { votingAge: 20 },
  ua: { retirementAge: 60 },
  uk: { drivingAge: 17, retirementAge: 66 },
  us: { drivingAge: 16, drinkingAge: 21, gamblingAge: 21, retirementAge: 67, sentencing: 'tough' },
  ve: { retirementAge: 60 },
  vn: { retirementAge: 61 },
  ws: { votingAge: 21, drinkingAge: 21 },
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

/**
 * Laws a state, province or other region may set for itself, where the country lets its regions
 * make law (REGIONAL_COUNTRIES). Everything else is national.
 */
export const REGIONAL_RULES = ['drinkingAge', 'gamblingAge', 'drivingAge', 'gambling', 'alcohol', 'deathPenalty'];
/** Countries whose regions make some of their own law: the federations, and the United Kingdom's devolved nations. */
export const REGIONAL_COUNTRIES = ['us', 'ca', 'au', 'de', 'at', 'ch', 'be', 'mx', 'br', 'ar', 've', 'in', 'pk', 'my', 'ae', 'ru', 'ng', 'et', 'uk', 'es', 'it'];

/** Changes the world may make by itself over the years (engine/rules.js tickRules). */
export const REFORM = {
  chance: 0.06,     // a year in which one place changes one law
  homeBias: 0.3,    // how often that place is where the player lives
};
