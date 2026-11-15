// Crimes, lawyers, prison gangs and the numbers behind the justice system.
// Money is in base units; sentences are in years.
//
// A crime succeeds on a skill check: base chance plus weighted stats (each
// centred on 50). Karma works as luck. On failure, `caught` is the chance the
// police have you there and then. Getting away adds `heat`, and unsolved
// crimes can catch up with you later.
export const CRIMES = [
  { id: 'shoplift', charge: 'shoplifting', name: 'Shoplift', minAge: 8, base: 0.65, minor: true,
    factors: { 'talents.crime': 0.6, 'stats.charm': 0.15, 'hidden.karma': 0.2 },
    loot: [10, 150], heat: 5, caught: 0.45, sentence: [0, 1], fine: 400, severity: 1, karma: -3,
    done: 'You walk out with it under your coat.', failed: 'A hand lands on your shoulder at the door.' },
  { id: 'pickpocket', charge: 'theft', name: 'Pick a pocket', minAge: 10, base: 0.55, minor: true,
    factors: { 'talents.crime': 0.7, 'stats.charm': 0.1, 'hidden.karma': 0.2 },
    loot: [20, 400], heat: 6, caught: 0.5, sentence: [0, 1], fine: 600, severity: 1, karma: -4,
    done: 'The wallet is in your pocket before they reach the corner.', failed: 'They feel your hand and turn round.' },
  { id: 'burglary', charge: 'burglary', name: 'Burgle a house', minAge: 14, base: 0.45,
    factors: { 'talents.crime': 0.6, 'stats.intellect': 0.3, 'hidden.karma': 0.2 },
    loot: [600, 9000], heat: 18, caught: 0.55, sentence: [1, 5], severity: 2, karma: -8,
    done: 'In through a back window, out with a full bag.', failed: 'A light comes on upstairs, and then a siren.' },
  { id: 'car_theft', charge: 'car theft', name: 'Steal a car', minAge: 14, base: 0.4,
    factors: { 'talents.crime': 0.65, 'stats.intellect': 0.2, 'hidden.karma': 0.2 },
    loot: [2500, 30000], heat: 22, caught: 0.6, sentence: [1, 6], severity: 2, karma: -8,
    done: 'You drive it straight to a man who asks no questions and pays in cash.', failed: 'The alarm goes, the steering locks, and a patrol car turns into the street.' },
  { id: 'bank_robbery', charge: 'armed robbery', name: 'Rob a bank', minAge: 18, base: 0.18,
    factors: { 'talents.crime': 0.6, 'stats.intellect': 0.35, 'hidden.karma': 0.25 },
    loot: [30000, 500000], heat: 55, caught: 0.8, sentence: [8, 25], severity: 3, karma: -15, danger: 0.12,
    done: 'Ninety seconds, in and out. Nobody is hurt, and the bag is heavy.', failed: 'The silent alarm was not silent to the police.' },
  { id: 'murder', charge: 'murder', name: 'Kill someone', minAge: 18, base: 0.3, target: true,
    factors: { 'talents.crime': 0.5, 'stats.intellect': 0.35, 'hidden.karma': 0.25 },
    loot: [0, 0], heat: 70, caught: 0.75, sentence: [20, 60], severity: 4, karma: -40,
    done: 'It is done, and nobody saw you.', failed: 'It goes wrong. There are witnesses, and they have your face.' },
];
export const CRIME_BY_ID = Object.fromEntries(CRIMES.map((c) => [c.id, c]));

/** Who can stand next to you in court. skill is 0–100; cost is base units. */
export const LAWYERS = [
  { id: 'self', name: 'Represent yourself', cost: 0, skill: null, blurb: 'Free. As good as you are clever.' },
  { id: 'public', name: 'Public defender', cost: 0, skill: 38, blurb: 'Free, overworked, and has four minutes for you.' },
  { id: 'good', name: 'A good defence lawyer', cost: 12000, skill: 64, blurb: 'Knows the judges and reads the file.' },
  { id: 'star', name: 'The best attorney in the city', cost: 90000, skill: 88, blurb: 'Has not lost in years. Charges accordingly.' },
];

/** Prison gangs. All fictional. respect: needed to be let in. */
export const GANGS = [
  { id: 'row', name: 'The Row', respect: 25, perYear: 4, blurb: 'Old-timers who run the kitchen and the phones.' },
  { id: 'north', name: 'Northside', respect: 45, perYear: 7, blurb: 'Loud, loyal, and always in a dispute.' },
  { id: 'quiet', name: 'The Quiet Ones', respect: 65, perYear: 10, blurb: 'Nobody sees them do anything. Nothing happens without them.' },
];

/** Sentences longer than this are life. */
export const LIFE_SENTENCE = 50;
/** Years after which an unsolved crime is forgotten (killing never is). */
export const COLD_CASE_YEARS = 10;
/** Extra years for an escape that fails, and for being recaptured. */
export const ESCAPE_PENALTY = 2;
export const RECAPTURE_PENALTY = 5;
