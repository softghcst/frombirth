import { systemFor } from './justice.js';
// The legal rules the game asks about, and where they differ.
//
// GAMEPLAY CONFIGURATION, COMPILED BY HAND AND UNVERIFIED. These are the
// author's best understanding of the mid-2020s, simplified to one value per
// place. Real law has conditions, exceptions and regional differences that
// are not modeled, and it changes. Nothing here is legal information.
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
  // The game never lets anyone marry before 18, whatever the law of the place allows (engine/rules.js MARRIAGE_FLOOR).
  marriageAge: { name: 'Marriage age', kind: 'age', default: 18 },
  // Where the law sets a different age for women. Shown with marriageAge, not as a line of its own.
  marriageAgeWomen: { name: 'Marriage age for women', kind: 'age', default: null, hidden: true },
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
  // Historical Eras: laws that today are settled everywhere in the game, but once were not (see data/history.js).
  womenVote: { name: 'Women\'s vote', kind: 'flag', default: true, words: ['Men only', 'Everyone'] },
  marriageBar: { name: 'Married women in teaching and public service', kind: 'flag', default: false, words: ['Allowed', 'Must leave on marrying'] },
  womenInLaw: { name: 'Women in the legal profession', kind: 'flag', default: true, words: ['Not admitted', 'Admitted'] },
  womenInUniform: { name: 'Women in the police, fire service and armed forces', kind: 'flag', default: true, words: ['Not taken', 'Taken'] },
};

/**
 * Where a place differs from the default.
 * Checked against Wikipedia, at these revisions (see docs/WORLD_DATA.md and scripts/verify-laws.py):
 *   voting ages: "Voting age" rev 1386001635 · drinking ages and alcohol bans: "Legal drinking age" rev 1381514309
 *   pension ages: "Retirement age" rev 1383117283 (the men's age, or the standard full-pension age where a range is given;
 *   countries the table does not cover keep the default) · marriage ages: "Marriageable age" rev 1382980745 (without parental or
 *   judicial consent; a separate age for women where the law sets one) · driving: "List of minimum driving ages" rev 1383563696 (the
 *   youngest age to drive a car, supervised or with consent) · gambling: "Gambling age" rev 1385344433 (the casino age where several are given) ·
 *   school-leaving ages: "School-leaving age" rev 1380468003 (the end of compulsory schooling).
 */
export const PLACE_RULES = {
  ae: { drivingAge: 17, gamblingAge: 21, schoolLeavingAge: 18 },
  af: { schoolLeavingAge: 13, alcohol: false },
  ao: { schoolLeavingAge: 12 },
  ar: { votingAge: 16, drivingAge: 17, schoolLeavingAge: 18 },
  at: { votingAge: 16, drivingAge: 17, drinkingAge: 16, schoolLeavingAge: 15 },
  au: { drivingAge: 17, schoolLeavingAge: 17, retirementAge: 67 },
  bd: { drinkingAge: 21, marriageAge: 21, marriageAgeWomen: 18, schoolLeavingAge: 10, retirementAge: 59 },
  be: { drinkingAge: 16, gamblingAge: 21, schoolLeavingAge: 18, retirementAge: 66 },
  br: { votingAge: 16, schoolLeavingAge: 18 },
  bs: { drivingAge: 17 },
  bz: { schoolLeavingAge: 14 },
  ca: { drivingAge: 16, drinkingAge: 19 },
  ch: { drivingAge: 17, drinkingAge: 16, schoolLeavingAge: 15 },
  cl: { drivingAge: 17, schoolLeavingAge: 18 },
  cn: { marriageAge: 22, marriageAgeWomen: 20, retirementAge: 63 },
  co: { drivingAge: 16, schoolLeavingAge: 15, retirementAge: 62 },
  cr: { schoolLeavingAge: 17 },
  cu: { votingAge: 16, drinkingAge: 16 },
  cz: { retirementAge: 64 },
  de: { drinkingAge: 16 },
  dk: { drivingAge: 17, retirementAge: 67 },
  do: { schoolLeavingAge: 18 },
  dz: { marriageAge: 19 },
  ec: { votingAge: 16 },
  ee: { gamblingAge: 21, schoolLeavingAge: 15, retirementAge: 64 },
  eg: { drinkingAge: 21, gamblingAge: 21, schoolLeavingAge: 14, retirementAge: 60 },
  es: { retirementAge: 66 },
  et: { gamblingAge: 21 },
  fr: { drivingAge: 17, retirementAge: 64 },
  ge: { drivingAge: 17, gamblingAge: 25, schoolLeavingAge: 14 },
  gh: { schoolLeavingAge: 15 },
  gr: { votingAge: 17, drivingAge: 17, gamblingAge: 21, schoolLeavingAge: 15, retirementAge: 67 },
  gt: { drivingAge: 16 },
  gy: { drivingAge: 17, schoolLeavingAge: 15 },
  hk: { marriageAge: 21, marriageAgeWomen: 21, retirementAge: 65 },
  hr: { schoolLeavingAge: 15 },
  hu: { drivingAge: 17 },
  id: { votingAge: 17, drivingAge: 17, drinkingAge: 21, marriageAge: 21, schoolLeavingAge: 15, retirementAge: 59 },
  ie: { drivingAge: 17, retirementAge: 67 },
  il: { drivingAge: 17, retirementAge: 67 },
  in: { drinkingAge: 21, gamblingAge: 21, marriageAge: 21, marriageAgeWomen: 18, schoolLeavingAge: 14, retirementAge: 60 },
  iq: { retirementAge: 60 },
  ir: { schoolLeavingAge: 15, retirementAge: 60, alcohol: false },
  it: { drivingAge: 17, retirementAge: 67 },
  jm: { schoolLeavingAge: 14 },
  jp: { drinkingAge: 20, gamblingAge: 20, schoolLeavingAge: 15 },
  ke: { gamblingAge: 21 },
  kr: { drinkingAge: 19, gamblingAge: 19, marriageAge: 19, schoolLeavingAge: 15, retirementAge: 60 },
  kw: { votingAge: 21, schoolLeavingAge: 15, alcohol: false },
  kz: { drinkingAge: 21, gamblingAge: 21, retirementAge: 63 },
  lb: { votingAge: 21, gamblingAge: 21, schoolLeavingAge: 12, retirementAge: 64 },
  ma: { schoolLeavingAge: 13, retirementAge: 63 },
  mn: { schoolLeavingAge: 17 },
  mx: { drivingAge: 16, schoolLeavingAge: 15 },
  my: { drinkingAge: 21, drivingAge: 17, gamblingAge: 21, marriageAge: 21, retirementAge: 60 },
  ng: { schoolLeavingAge: 15 },
  ni: { votingAge: 16 },
  nl: { drivingAge: 17, retirementAge: 67 },
  no: { retirementAge: 67 },
  np: { votingAge: 16, gamblingAge: 21, marriageAge: 20 },
  nz: { drivingAge: 16, gamblingAge: 20 },
  pa: { drivingAge: 16 },
  pe: { retirementAge: 60 },
  pg: { marriageAge: 21 },
  ph: { drivingAge: 17, gamblingAge: 21, marriageAge: 21, schoolLeavingAge: 18, retirementAge: 60, divorce: false },
  pk: { schoolLeavingAge: 10, retirementAge: 60, alcohol: false },
  pl: { schoolLeavingAge: 18 },
  pr: { drivingAge: 18, drinkingAge: 18, gamblingAge: 18, marriageAge: 21 },
  pt: { schoolLeavingAge: 18, retirementAge: 66 },
  py: { drinkingAge: 20, schoolLeavingAge: 14 },
  qa: { drinkingAge: 21 },
  ro: { schoolLeavingAge: 18 },
  rs: { schoolLeavingAge: 14 },
  ru: { schoolLeavingAge: 15, retirementAge: 64 },
  sa: { drivingAge: 17, schoolLeavingAge: 15, retirementAge: 60, alcohol: false },
  se: { gamblingAge: 20, retirementAge: 66 },
  sg: { votingAge: 21, gamblingAge: 21, marriageAge: 21, retirementAge: 63 },
  sk: { drivingAge: 17, retirementAge: 62 },
  sv: { drivingAge: 15 },
  sy: { schoolLeavingAge: 15 },
  th: { drinkingAge: 20, schoolLeavingAge: 15, retirementAge: 60 },
  tn: { retirementAge: 62 },
  tr: { retirementAge: 62 },
  tw: { votingAge: 20, gamblingAge: 20, schoolLeavingAge: 15 },
  ua: { gamblingAge: 21, schoolLeavingAge: 17, retirementAge: 60 },
  ug: { gamblingAge: 25, marriageAge: 21, marriageAgeWomen: 18 },
  uk: { drivingAge: 17, retirementAge: 66 },
  us: { drivingAge: 16, drinkingAge: 21, gamblingAge: 21, retirementAge: 67, sentencing: 'tough' },
  uy: { schoolLeavingAge: 14 },
  ve: { schoolLeavingAge: 14, retirementAge: 60 },
  vn: { gamblingAge: 21, marriageAge: 20, marriageAgeWomen: 18, schoolLeavingAge: 18, retirementAge: 61 },
  ws: { votingAge: 21, drinkingAge: 21, gamblingAge: 21, marriageAge: 21 },
  za: { schoolLeavingAge: 15 },
  zw: { drivingAge: 16 },
};

/**
 * Where part of a place differs from the rest of it, keyed 'place/region'
 * (region ids are in data/cities.js). Only regions that have a city in the
 * game are listed. Unverified, like everything else here.
 */
export const REGION_RULES = {
  // Checked against Wikipedia: "Capital punishment in the United States" (rev 1386383070), "Gambling age" (rev 1385344433),
  // "Legal drinking age" (rev 1381514309) and "Alcohol laws of India" (rev 1378950707). The gambling age is the casino age,
  // as nationally (the first the source gives).
  // United States: the death penalty and the gambling age are matters for each state.
  'us/new_york': { deathPenalty: false, gamblingAge: 18 },  // abolished 2004
  'us/illinois': { deathPenalty: false },                   // 2011
  'us/washington': { deathPenalty: false, gamblingAge: 18 }, // 2023
  'us/colorado': { deathPenalty: false },                   // 2020
  'us/georgia': { gamblingAge: 18 },
  // Canada: the drinking and gambling ages are set by each province.
  'ca/quebec': { drinkingAge: 18 },
  'ca/alberta': { drinkingAge: 18 },
  'ca/manitoba': { drinkingAge: 18 },
  'ca/ontario': { gamblingAge: 19 },
  'ca/british_columbia': { gamblingAge: 19 },
  'ca/nova_scotia': { gamblingAge: 19 },
  // Germany: casinos admit from 21 in Bavaria and Baden-Württemberg.
  'de/bavaria': { gamblingAge: 21 },
  'de/baden_wurttemberg': { gamblingAge: 21 },
  // India: set by each state (Karnataka's law is ambiguous between 18 and 21; the source lists 18).
  'in/maharashtra': { drinkingAge: 25 },
  'in/delhi': { drinkingAge: 25 },
  'in/karnataka': { drinkingAge: 18 },
  // United Arab Emirates: Sharjah bans alcohol; 21 in Dubai, Abu Dhabi and the northern emirates; 18 in Ras Al Khaimah.
  'ae/sharjah': { alcohol: false },
  'ae/dubai': { drinkingAge: 21 },
  'ae/abu_dhabi': { drinkingAge: 21 },
  'ae/ajman': { drinkingAge: 21 },
  // Nigeria: the northern states prohibit alcohol.
  'ng/around:Kano': { alcohol: false },
};

/**
 * Which of the game's laws each country leaves to its states, provinces or other regions. A country not listed makes
 * all of them nationally. Simplified to these six matters. What each claim rests on:
 *   Confirmed by a source (Wikipedia; scripts/verify-laws.py does not check this list automatically):
 *     United States: the death penalty ("Capital punishment in the United States": legal in 27 states), gambling ("each
 *       state is free to regulate or prohibit"), its age (varies by state), driving licenses (issued by each state).
 *     Canada: driving licenses ("issued by each province or territory"), the gambling age (18 or 19 by province).
 *     Australia: driving licenses and road rules ("managed by state and territory governments"); the drinking age
 *       ("all states restrict purchasing to over 18": state liquor law).
 *     Germany: the gambling age ("varies by state").  Mexico: the drinking age ("all Mexican states prohibit..."), and
 *       driving ("Driving license in Mexico": each state sets "the minimum driving age").
 *     India: alcohol ("a subject in the State List") and gambling ("states are entitled to formulate their own laws").
 *     Nigeria: alcohol ("prohibited in northern states").  UAE: alcohol and its age ("Sharjah... banned"; 18 or 21).
 *     Spain: the drinking age (communities raised it to 18 at different times).  Switzerland: the drinking age (Ticino
 *       sets its own).  United Kingdom: drinking ages are given for England and Wales apart from Scotland.
 *   The author's understanding, not confirmed by the sources fetched:
 *     the US drinking age (state law kept at 21 by federal highway money); Canada's gambling and drinking age (provincial
 *     liquor and gaming law); Australia's gambling; Germany's gambling (the Länder's state treaty); Austria's drinking age
 *     (the Länder's youth-protection laws); Argentina's gambling (provincial); Malaysia's gambling (forbidden to Muslims by
 *     state Islamic law); Nigeria's gambling (state lotteries); the UAE's gambling (a federal regulator was set up in 2023,
 *     so this may now be national); Spain's gambling (the communities regulate land-based gambling).
 */
export const REGIONAL_POWERS = {
  us: ['deathPenalty', 'gambling', 'gamblingAge', 'drivingAge', 'drinkingAge'],
  ca: ['gambling', 'gamblingAge', 'drivingAge', 'drinkingAge'],
  au: ['gambling', 'gamblingAge', 'drivingAge', 'drinkingAge'],
  de: ['gambling', 'gamblingAge'],
  at: ['drinkingAge'],
  ch: ['drinkingAge'],
  mx: ['drivingAge', 'drinkingAge'],
  ar: ['gambling', 'gamblingAge'],
  in: ['alcohol', 'drinkingAge', 'gambling', 'gamblingAge'],
  my: ['gambling'],
  ng: ['alcohol', 'gambling'],
  ae: ['alcohol', 'drinkingAge', 'gambling', 'gamblingAge'],
  uk: ['drinkingAge'],
  es: ['drinkingAge', 'gambling', 'gamblingAge'],
};
/** Every law some region somewhere can make. */
export const REGIONAL_RULES = [...new Set(Object.values(REGIONAL_POWERS).flat())];
/** Countries whose regions make some of their own law. */
export const REGIONAL_COUNTRIES = Object.keys(REGIONAL_POWERS);

/** Changes the world may make by itself over the years (engine/rules.js tickRules). */
export const REFORM = {
  chance: 0.06,     // a year in which one place changes one law
  homeBias: 0.3,    // how often that place is where the player lives
};
