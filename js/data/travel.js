// Travel: how people get from place to place, where they stay, what they do
// there, and what a border asks of them. The numbers behind engine/travel.js,
// engine/documents.js and engine/geo.js.
//
// GAMEPLAY CONFIGURATION, NOT TRAVEL OR IMMIGRATION ADVICE.
//   - Transport years are broad global dates (the first railways, the first
//     airlines, the jet age). Real availability varied by country.
//   - Prices are fictional base units, turned into local money like every
//     other price in the game (util.localMoney).
//   - Entry rules are a simplified, hand-compiled picture of the mid-2020s
//     for the game's places, UNVERIFIED and incomplete. Real rules depend on
//     far more than nationality and change often. Processing times and the
//     odds of a decision are fictional parameters, not facts about any
//     government.

/** Places on islands, or reached from the rest of their continent only by sea or air. Overland travel never crosses between groups. */
export const LANDMASS = {
  americas: ['us', 'ca', 'mx', 'bz', 'cr', 'sv', 'gt', 'ni', 'pa', 'ar', 'bo', 'br', 'cl', 'co', 'ec', 'gy', 'py', 'pe', 'uy', 've'],
  hispaniola: ['do', 'ht'],
  // Great Britain has been joined to the mainland by the Channel Tunnel since 1994.
  gb: ['uk'],
};
/** Overland links that opened at a known date: [landmass, landmass, year]. */
export const FIXED_LINKS = [['gb', 'afroeurasia', 1994]];
/** Everything not named above is part of Africa, Europe and Asia, unless it is one of these islands, each its own. */
export const ISLANDS = ['aw', 'bs', 'cu', 'jm', 'pr', 'ie', 'jp', 'au', 'nz', 'ph', 'id', 'tw', 'pg', 'ws'];
/** Countries with no coastline (factual). Used for beaches and ferries. */
export const LANDLOCKED = ['ad', 'at', 'bo', 'py', 'ch', 'cz', 'hu', 'rs', 'sk', 'et', 'ug', 'zw', 'af', 'kz', 'mn', 'np'];

/**
 * Ways to travel. `from`/`to`: the years it is offered (broad global dates).
 * kmh: average speed while moving; hoursPerDay: how long a day's travel lasts
 * (a ship sails through the night, a coach stops at an inn); overhead: hours
 * spent at stations, ports and airports. perKm and base: fictional prices for
 * one traveler. over: 'land' (one landmass), 'sea' (ports, any coast),
 * 'short_sea' (a crossing of up to 600 km), 'air'. maxKm: longest single leg.
 * accessible: whether step-free help is normally arranged (a game simplification).
 */
export const MODES = [
  { id: 'walk', name: 'On foot', from: -Infinity, kmh: 5, hoursPerDay: 8, overhead: 0, perKm: 0, base: 0, over: 'land', maxKm: 60, accessible: false },
  { id: 'coach_horse', name: 'Stagecoach', from: -Infinity, to: 1930, kmh: 10, hoursPerDay: 12, overhead: 1, perKm: 0.25, base: 5, over: 'land', maxKm: 3000, accessible: false },
  { id: 'sail', name: 'Sailing ship', from: -Infinity, to: 1880, kmh: 9, hoursPerDay: 24, overhead: 24, perKm: 0.08, base: 60, over: 'sea', accessible: false },
  { id: 'steamship', name: 'Steamship', from: 1840, to: 1970, kmh: 28, hoursPerDay: 24, overhead: 12, perKm: 0.07, base: 80, over: 'sea', accessible: false },
  { id: 'rail', name: 'Train', from: 1830, kmh: 75, hoursPerDay: 24, overhead: 1, perKm: 0.11, base: 8, over: 'land', maxKm: 9000, accessible: true },
  { id: 'car', name: 'Car', from: 1910, kmh: 70, hoursPerDay: 9, overhead: 0, perKm: 0.14, base: 0, over: 'land', maxKm: 6000, accessible: true },
  { id: 'bus', name: 'Coach (bus)', from: 1920, kmh: 60, hoursPerDay: 14, overhead: 1, perKm: 0.06, base: 5, over: 'land', maxKm: 4000, accessible: true },
  { id: 'ferry', name: 'Ferry', from: 1840, kmh: 32, hoursPerDay: 24, overhead: 2, perKm: 0.18, base: 25, over: 'short_sea', maxKm: 600, accessible: true },
  { id: 'prop_air', name: 'Propeller airliner', from: 1919, to: 1965, kmh: 320, hoursPerDay: 24, overhead: 3, perKm: 0.35, base: 150, over: 'air', maxKm: 4000, stopsEvery: 2500, accessible: false },
  { id: 'cruise_ship', name: 'Cruise ship', from: 1900, kmh: 30, hoursPerDay: 24, overhead: 4, perKm: 0.2, base: 260, over: 'sea', accessible: true, cruise: true, includesStay: true },
  { id: 'jet', name: 'Plane', from: 1958, kmh: 780, hoursPerDay: 24, overhead: 3, perKm: 0.09, base: 90, over: 'air', accessible: true, cabins: true },
];
/** Fare multipliers for a seat on a plane, by cabin (data/activities.js CABINS). */
export const CABIN_FARE = { economy: 1, business: 3.4, first: 6.5 };
/** Airports where a long journey changes planes: [countryId, city]. */
export const HUBS = [['ae', 'Dubai'], ['qa', 'Doha'], ['sg', 'Singapore'], ['uk', 'London'], ['fr', 'Paris'], ['tr', 'Istanbul'], ['us', 'New York'], ['jp', 'Tokyo']];
/** A non-stop flight goes no further than this; beyond it the journey changes planes at a hub. */
export const NONSTOP_KM = 12500;
export const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m]));

/** Where travelers sleep. perNight in base units, per person. kin/own: free, if family lives there or you own a home there. */
export const STAYS = [
  { id: 'inn', name: 'An inn', to: 1900, perNight: 6, comfort: 1, accessible: false },
  { id: 'hostel', name: 'A hostel', from: 1912, perNight: 25, comfort: 1, accessible: false, young: true },
  { id: 'budget', name: 'A budget hotel', from: 1900, perNight: 60, comfort: 2, accessible: true },
  { id: 'hotel', name: 'A comfortable hotel', from: 1850, perNight: 120, comfort: 3, accessible: true },
  { id: 'luxury', name: 'A grand hotel', from: 1850, perNight: 380, comfort: 5, accessible: true },
  { id: 'rental', name: 'A holiday rental', from: 1950, perNight: 70, comfort: 3, accessible: false, shared: true },
  { id: 'student', name: 'A student residence', from: 1900, perNight: 22, comfort: 2, accessible: true, study: true },
  { id: 'kin', name: 'With family', perNight: 0, comfort: 3, accessible: false, kin: true },
  { id: 'own', name: 'Your own home there', perNight: 0, comfort: 4, accessible: true, own: true },
];
export const STAY_BY_ID = Object.fromEntries(STAYS.map((s) => [s.id, s]));

/**
 * Things to do on a trip. cost: base units per person. days: time taken.
 * tags: what the Discover filters match. from: the year it is offered.
 * needs: 'coast' (not landlocked), 'kin' (people you know live there),
 * 'language' (the place has its own language). interest: a talent or skill
 * that makes it mean more. skill: practiced by doing it. mood: what it does
 * for a traveler. significance 1-3: how likely it is to be remembered.
 */
export const ACTIVITIES = [
  { id: 'sights', name: 'Walk the old streets', cost: 0, days: 1, tags: ['cities', 'culture', 'budget'], mood: 3, significance: 1 },
  { id: 'museum', name: 'Spend a day in the museums', cost: 15, days: 1, from: 1850, tags: ['culture', 'history', 'education'], interest: 'intellect', mood: 3, significance: 1 },
  { id: 'landmark', name: 'See the famous landmark', cost: 20, days: 1, tags: ['history', 'culture', 'cities'], mood: 5, significance: 2 },
  { id: 'food', name: 'Eat where the locals eat', cost: 40, days: 0, tags: ['culture', 'romantic'], skill: 'cooking', mood: 4, significance: 1 },
  { id: 'beach', name: 'Days on the beach', cost: 0, days: 2, needs: 'coast', tags: ['beach', 'family', 'budget', 'romantic'], skill: 'swimming', mood: 6, significance: 1 },
  { id: 'hike', name: 'Walk out into the countryside', cost: 0, days: 1, tags: ['nature', 'adventure', 'budget'], health: 2, mood: 4, significance: 1 },
  { id: 'festival', name: 'Join a local festival', cost: 30, days: 1, tags: ['culture'], seasonal: true, mood: 6, significance: 2 },
  { id: 'performance', name: 'Go to a performance', cost: 60, days: 0, tags: ['culture', 'romantic'], interest: ['music', 'acting', 'singing', 'dance'], mood: 5, significance: 2 },
  { id: 'match', name: 'Watch a big match', cost: 70, days: 0, from: 1870, tags: ['adventure'], interest: 'sports', mood: 5, significance: 2 },
  { id: 'photos', name: 'Spend a day taking photographs', cost: 0, days: 1, from: 1890, tags: ['culture', 'nature'], skill: 'photography', interest: 'photography', mood: 3, significance: 1 },
  { id: 'notebook', name: 'Fill a notebook with what you see', cost: 0, days: 0, tags: ['culture'], skill: 'writing', interest: 'writing', mood: 2, significance: 1 },
  { id: 'shopping', name: 'Go shopping', cost: 100, days: 0, tags: ['cities'], mood: 3, significance: 0 },
  { id: 'tour', name: 'Take a guided tour', cost: 50, days: 1, from: 1870, tags: ['history', 'culture', 'family'], intellect: 1, mood: 3, significance: 1 },
  { id: 'kin', name: 'Spend time with the people you know there', cost: 0, days: 2, needs: 'kin', tags: ['family'], mood: 6, significance: 3 },
  { id: 'lessons', name: 'Take a week of language lessons', cost: 120, days: 5, needs: 'language', tags: ['education'], skill: 'language', mood: 1, significance: 1 },
  { id: 'park', name: 'Spend a day at a theme park', cost: 90, days: 1, from: 1955, tags: ['family'], mood: 6, significance: 2, kids: true },
  { id: 'wildlife', name: 'Go out to see the wildlife', cost: 200, days: 2, region: 'Africa', tags: ['nature', 'adventure'], mood: 7, significance: 3 },
  { id: 'campus', name: 'Look round a university', cost: 0, days: 0, tags: ['education'], intellect: 1, mood: 1, significance: 1 },
  { id: 'spa', name: 'A day at the spa', cost: 80, days: 1, from: 1900, tags: ['romantic'], health: 1, mood: 5, significance: 1 },
];
export const ACTIVITY_BY_ID = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a]));

/** The Discover filters. */
export const FILTERS = [
  ['nearby', 'Nearby'], ['international', 'International'], ['budget', 'Budget-friendly'], ['nature', 'Nature'], ['cities', 'Cities'],
  ['beach', 'Beaches'], ['history', 'Historical sites'], ['culture', 'Culture'], ['adventure', 'Adventure'], ['family', 'Family-friendly'],
  ['education', 'Education'], ['romantic', 'Romantic trips'],
];

/**
 * Kinds of trip. group: how the planner lists them. purpose: what the border
 * is told (visit, business, study). Each kind's conditions are checked by
 * engine/travel.tripTypes against the real state of the life.
 */
export const TRIP_TYPES = [
  { id: 'getaway', group: 'Leisure', name: 'Weekend getaway', purpose: 'visit', maxDays: 4 },
  { id: 'vacation', group: 'Leisure', name: 'Vacation', purpose: 'visit' },
  { id: 'family_holiday', group: 'Leisure', name: 'Family vacation', purpose: 'visit', needs: 'family' },
  { id: 'romantic', group: 'Leisure', name: 'Romantic trip', purpose: 'visit', needs: 'partner' },
  { id: 'honeymoon', group: 'Leisure', name: 'Honeymoon', purpose: 'visit', needs: 'newlywed' },
  { id: 'anniversary', group: 'Leisure', name: 'Anniversary trip', purpose: 'visit', needs: 'married' },
  { id: 'backpacking', group: 'Leisure', name: 'Backpacking', purpose: 'visit', minAge: 18, maxAge: 35 },
  { id: 'adventure', group: 'Leisure', name: 'Adventure travel', purpose: 'visit', minAge: 16 },
  { id: 'cultural', group: 'Leisure', name: 'Cultural trip', purpose: 'visit' },
  { id: 'cruise', group: 'Leisure', name: 'Cruise', purpose: 'visit', from: 1900, mode: 'ship' },
  { id: 'visiting', group: 'Personal', name: 'Visiting relatives', purpose: 'visit', needs: 'kinThere' },
  { id: 'scouting', group: 'Personal', name: 'Relocation scouting visit', purpose: 'visit', minAge: 18 },
  { id: 'wedding', group: 'Personal', name: 'Family wedding', purpose: 'visit', needs: 'wedding', maxDays: 14 },
  { id: 'funeral', group: 'Personal', name: 'Funeral', purpose: 'visit', needs: 'funeral', maxDays: 10 },
  { id: 'business', group: 'Professional', name: 'Business trip', purpose: 'business', needs: 'job', maxDays: 14 },
  { id: 'conference', group: 'Professional', name: 'Work conference', purpose: 'business', needs: 'professional', maxDays: 7 },
  { id: 'interview', group: 'Professional', name: 'Job interview abroad', purpose: 'business', needs: 'offer', maxDays: 5 },
  { id: 'immersion', group: 'Educational', name: 'Language immersion', purpose: 'visit', needs: 'language', minAge: 16, minDays: 14 },
  { id: 'semester', group: 'Educational', name: 'University semester abroad', purpose: 'study', needs: 'university', minDays: 90, maxDays: 150 },
];
export const TRIP_TYPE_BY_ID = Object.fromEntries(TRIP_TYPES.map((t) => [t.id, t]));

/** Refund terms, by what was booked. Fraction of the price returned on canceling: [more than 30 days ahead, closer]. */
export const REFUNDS = { transport: [0.8, 0.25], stay: [1, 0.5], activity: [1, 1], insurance: [0, 0] };
/** Travel insurance: a share of the trip's price. It refunds what a disruption costs. */
export const INSURANCE_RATE = 0.06;
/** Food and getting about, per person per day, in base units. */
export const DAILY = 35;

// ---------- Borders ----------

/**
 * The broad shape of travel documents over time. Simplified.
 *   open:     before the First World War most travel needed no passport and no visa.
 *   controls: passports required; visas common.
 *   modern:   the rules below.
 */
export const DOCUMENT_ERAS = [
  { id: 'open', from: -Infinity, to: 1913, passport: false },
  { id: 'controls', from: 1914, to: 1945, passport: true },
  { id: 'modern', from: 1946, passport: true },
];

/** Passports: years of validity and fee (base units), adult and child (under 16). */
export const PASSPORT = { adultYears: 10, childYears: 5, childUnder: 16, fee: 110, childFee: 70, replacementFee: 140 };

const SCHENGEN = ['at', 'be', 'hr', 'cz', 'dk', 'ee', 'fi', 'fr', 'de', 'gr', 'hu', 'it', 'nl', 'pl', 'pt', 'ro', 'sk', 'es', 'se', 'no', 'ch'];
/** Nationalities the game treats as visa-free in most of the destinations below. */
const WIDE = [...SCHENGEN, 'ie', 'uk', 'us', 'ca', 'au', 'nz', 'jp', 'kr', 'sg', 'mc', 'ad'];

/**
 * Areas where neighbors' citizens visit without a visa (on top of free
 * movement, which data/immigration.js defines and which also covers visits).
 * Simplified and UNVERIFIED.
 */
export const VISIT_AREAS = [
  { id: 'mercosur', name: 'South American agreement', members: ['ar', 'br', 'py', 'uy', 'bo', 'cl', 'co', 'ec', 'pe'] },
  { id: 'ecowas', name: 'West African agreement', members: ['gh', 'ng'] },
  { id: 'gcc', name: 'Gulf agreement', members: ['sa', 'ae', 'qa', 'kw'] },
  { id: 'ca4', name: 'Central American agreement', members: ['gt', 'sv', 'ni'] },
  { id: 'asean', name: 'South-East Asian agreement', members: ['sg', 'my', 'th', 'vn', 'id', 'ph'] },
  { id: 'eac', name: 'East African agreement', members: ['ke', 'ug'] },
  { id: 'cta', name: 'Common Travel Area', members: ['uk', 'ie'] },
];

/**
 * Destination rules for visitors (tourism, family visits, business meetings).
 * zone: destinations that count days together (the Schengen area).
 * days: longest stay; rolling: the window in days that `days` is counted over.
 * free: nationalities that need no visa. eta: an electronic authorization those
 * nationalities need first (instant, cheap). exempt: free without even an ETA.
 * visa: what the visitor visa is called there. evisa: applied for online and
 * decided in days rather than at the year's end.
 * Places not listed use DEFAULT_ENTRY. All UNVERIFIED.
 */
const SCHENGEN_RULE = { zone: 'schengen', days: 90, rolling: 180, visa: 'Schengen short-stay visa (type C)',
  free: [...WIDE, 'br', 'ar', 'cl', 'co', 'pe', 'mx', 'uy', 'py', 'cr', 'sv', 'gt', 'ni', 'pa', 've', 'my', 'tw', 'hk', 'il', 'ae', 'ws', 'ua', 'ge', 'rs', 'bs'] };
export const ENTRY = {
  ...Object.fromEntries([...SCHENGEN, 'mc', 'ad'].map((id) => [id, SCHENGEN_RULE])),
  us: { days: 90, visa: 'Visitor visa (B-2)', eta: 'ESTA', etaFee: 21, exempt: ['ca'],
    free: [...SCHENGEN, 'ie', 'uk', 'au', 'nz', 'jp', 'kr', 'sg', 'mc', 'ad', 'tw', 'cl', 'il', 'qa'] },
  uk: { days: 180, visa: 'Standard Visitor visa', eta: 'Electronic Travel Authorization (ETA)', etaFee: 16, exempt: ['ie'],
    free: [...SCHENGEN, 'mc', 'ad', 'ie', 'us', 'ca', 'au', 'nz', 'jp', 'kr', 'sg', 'my', 'tw', 'hk', 'il', 'br', 'ar', 'cl', 'mx', 'uy', 'py', 'cr', 'pa', 'bs', 'ae', 'qa', 'kw', 'sa', 'ws'] },
  ie: { days: 90, visa: 'Short-stay visit visa', exempt: ['uk'], free: [...WIDE, 'br', 'ar', 'cl', 'mx', 'uy', 'my', 'il', 'hk', 'tw'] },
  ca: { days: 180, visa: 'Visitor visa (temporary resident visa)', eta: 'eTA', etaFee: 7, exempt: ['us'],
    free: [...SCHENGEN, 'mc', 'ad', 'ie', 'uk', 'au', 'nz', 'jp', 'kr', 'sg', 'tw', 'hk', 'il', 'cl', 'ws', 'bs'] },
  au: { days: 90, visa: 'Visitor visa (subclass 600)', eta: 'ETA (subclass 601)', etaFee: 14, exempt: ['nz'],
    free: [...SCHENGEN, 'mc', 'ad', 'ie', 'uk', 'us', 'ca', 'jp', 'kr', 'sg', 'my', 'tw', 'hk'] },
  nz: { days: 90, visa: 'Visitor visa', eta: 'NZeTA', etaFee: 13, exempt: ['au'],
    free: [...SCHENGEN, 'mc', 'ad', 'ie', 'uk', 'us', 'ca', 'jp', 'kr', 'sg', 'my', 'tw', 'hk', 'il', 'ar', 'br', 'cl', 'mx', 'uy', 'ae', 'qa', 'kw'] },
  jp: { days: 90, visa: 'Temporary visitor visa', free: [...WIDE, 'tw', 'hk', 'my', 'il', 'ae', 'mx', 'ar', 'cl', 'uy', 'br', 'cr', 'sv', 'gt', 'bs'] },
  kr: { days: 90, visa: 'Short-term visit visa (C-3)', eta: 'K-ETA', etaFee: 8, free: [...WIDE, 'tw', 'hk', 'my', 'il', 'mx', 'br', 'ar', 'cl'] },
  in: { days: 90, visa: 'e-Visa', evisa: true, free: [] },
  cn: { days: 30, visa: 'Tourist visa (L)', free: ['sg', 'my', ...SCHENGEN.filter((x) => !['se', 'no', 'ro'].includes(x)), 'ie', 'au', 'nz', 'jp', 'kr'] },
  br: { days: 90, visa: 'Visitor e-Visa', evisa: true, free: [...SCHENGEN, 'mc', 'ad', 'ie', 'uk', 'nz', 'jp', 'kr', 'sg', 'mx', 'cr', 'sv', 'gt', 'ni', 'pa', 'bs', 'il', 'my', 'hk', 'tw', 've'] },
  ru: { days: 30, visa: 'Tourist visa', evisa: true, free: ['ua', 'ge', 'kz', 'rs', 'ar', 'br', 'cl', 'co', 'pe', 'uy', 'py', 've', 'ec', 'bo', 'cu', 'ni', 'il', 'ae', 'qa', 'mn'] },
  sa: { days: 90, visa: 'Tourist e-Visa', evisa: true, free: [] },
  ae: { days: 90, visa: 'Visit visa', free: [...WIDE, 'br', 'ar', 'cl', 'mx', 'uy', 'my', 'il', 'hk', 'tw', 'kz', 'ua', 'rs', 'ge'] },
  tr: { days: 90, visa: 'e-Visa', evisa: true, free: [...SCHENGEN, 'mc', 'ad', 'ie', 'uk', 'us', 'ca', 'jp', 'kr', 'nz', 'br', 'ar', 'cl', 'co', 'mx', 'uy', 'py', 'my', 'sg', 'ua', 'ge', 'rs', 'kz', 'ae', 'qa', 'kw', 'jo', 'ma', 'tn', 'ir', 'au'] },
};
/**
 * Everywhere else. `liberal` destinations let the WIDE nationalities in
 * without a visa; the rest want a visitor visa from everyone outside their
 * own agreements.
 */
export const DEFAULT_ENTRY = { days: 90, visa: 'Visitor visa' };
export const LIBERAL = ['mx', 'ar', 'cl', 'co', 'pe', 'ec', 'uy', 'py', 'bo', 'cr', 'pa', 'gt', 'sv', 'ni', 'do', 'jm', 'bs', 'bz', 'ht', 'aw', 'pr', 'gy',
  'th', 'my', 'sg', 'ph', 'id', 'tw', 'hk', 'ge', 'rs', 'ua', 'il', 'ma', 'tn', 'za', 'kz', 'mn', 'qa', 'kw', 'jo', 'lb', 'np', 'ws', 'pg', 'al', 'gh', 'ke', 'ug', 'et', 'eg', 'vn'];
/** Where a visitor visa is bought on arrival or online in minutes (for the LIBERAL places' other visitors). Simplified. */
export const ON_ARRIVAL = ['eg', 'jo', 'lb', 'np', 'ke', 'ug', 'et', 'id', 'kz', 'mn', 'ws', 'pg', 'gh'];

/**
 * Fictional gameplay parameters for decisions. Not real approval rates.
 * A decision never looks at nationality, ethnicity or personality: only at
 * the application (funds, purpose, record, history with that border).
 */
export const DECISION = {
  visa: 0.86, eta: 0.97, study: 0.82,
  convicted: -0.35, refusedRecently: -0.1, goodHistory: 0.04, noFunds: -0.2,
  visaFee: 120, studyFee: 220,
  /** How many times a refusal may be reviewed: once. */
  reviews: 1,
};

/** Pets that may travel with a moving household, and the arrangement each needs. Gameplay simplification. */
export const PET_TRAVEL = {
  dog: { cost: 1600, papers: 'a microchip, a rabies vaccination and a health certificate' },
  cat: { cost: 1300, papers: 'a microchip, a rabies vaccination and a health certificate' },
  rabbit: { cost: 700, papers: 'a health certificate' },
  parrot: { cost: 1100, papers: 'a permit for birds and a health certificate', restricted: ['au', 'nz'] },
  hamster: { cost: 300, papers: 'a health certificate', restricted: ['au', 'nz'] },
};

/**
 * Where a place belonged in an earlier period, for the family's history, from
 * 1800. Years only, hand-compiled from well-known dates of independence,
 * unification, partition and renaming, UNVERIFIED; occupations in wartime are
 * not shown. The narrowest period containing a year applies. A place not
 * listed is shown under its present name for every year. Cities named in
 * `cities` follow a different line from the rest of the country.
 * [until (last year under that name), name]
 */
export const JURISDICTIONS = {
  de: { history: [[1990, 'West Germany (Federal Republic of Germany)'], [1948, 'Allied-occupied Germany'], [1944, 'Germany'], [1870, 'German states (the German Confederation)'], [1805, 'Holy Roman Empire (German states)']],
    cities: { Leipzig: [[1990, 'East Germany (German Democratic Republic)'], [1948, 'Allied-occupied Germany'], [1944, 'Germany'], [1870, 'German states (the German Confederation)'], [1805, 'Holy Roman Empire (German states)']],
      Dresden: [[1990, 'East Germany (German Democratic Republic)'], [1948, 'Allied-occupied Germany'], [1944, 'Germany'], [1870, 'German states (the German Confederation)'], [1805, 'Holy Roman Empire (German states)']],
      Berlin: [[1990, 'Berlin (divided city)'], [1948, 'Allied-occupied Germany'], [1944, 'Germany'], [1870, 'Prussia (the German Confederation)'], [1805, 'Prussia (Holy Roman Empire)']] } },
  it: { history: [[1860, 'Italian states (before unification)']] },
  at: { history: [[1918, 'Austria-Hungary'], [1866, 'Austrian Empire']] },
  hu: { history: [[1918, 'Austria-Hungary (Kingdom of Hungary)'], [1866, 'Austrian Empire (Kingdom of Hungary)']] },
  cz: { history: [[1992, 'Czechoslovakia'], [1918, 'Austria-Hungary (Bohemia)']] },
  sk: { history: [[1992, 'Czechoslovakia'], [1918, 'Austria-Hungary (Kingdom of Hungary)']] },
  pl: { history: [[1918, 'Partitioned Poland (Russian, Prussian and Austrian rule)']] },
  ru: { history: [[1991, 'Soviet Union'], [1917, 'Russian Empire']] },
  ua: { history: [[1991, 'Soviet Union (Ukrainian SSR)'], [1917, 'Russian Empire']] },
  kz: { history: [[1991, 'Soviet Union (Kazakh SSR)'], [1917, 'Russian Empire']] },
  ee: { history: [[1991, 'Soviet Union (Estonian SSR)'], [1939, 'Estonia'], [1917, 'Russian Empire']] },
  ge: { history: [[1991, 'Soviet Union (Georgian SSR)'], [1920, 'Democratic Republic of Georgia'], [1917, 'Russian Empire']] },
  fi: { history: [[1917, 'Grand Duchy of Finland (Russian Empire)']] },
  hr: { history: [[1991, 'Yugoslavia'], [1928, 'Kingdom of Serbs, Croats and Slovenes'], [1918, 'Austria-Hungary (Croatia-Slavonia)']] },
  rs: { history: [[2006, 'Serbia and Montenegro'], [1991, 'Yugoslavia'], [1928, 'Kingdom of Serbs, Croats and Slovenes'], [1918, 'Serbia'], [1877, 'Principality of Serbia (Ottoman suzerainty)']] },
  ro: { history: [[1858, 'Principalities of Moldavia and Wallachia']] },
  gr: { history: [[1829, 'Ottoman Empire']] },
  be: { history: [[1830, 'United Kingdom of the Netherlands'], [1814, 'French Empire']] },
  ie: { history: [[1936, 'Irish Free State'], [1921, 'Ireland (part of the United Kingdom)']] },
  no: { history: [[1905, 'Norway (in union with Sweden)'], [1813, 'Denmark-Norway']] },
  tr: { history: [[1922, 'Ottoman Empire']] },
  iq: { history: [[1931, 'Mandatory Iraq (British)'], [1919, 'Ottoman Empire']] },
  sy: { history: [[1945, 'French Mandate for Syria'], [1919, 'Ottoman Empire']] },
  lb: { history: [[1942, 'French Mandate (Greater Lebanon)'], [1919, 'Ottoman Empire']] },
  jo: { history: [[1945, 'Emirate of Transjordan (British Mandate)'], [1919, 'Ottoman Empire']] },
  il: { history: [[1948, 'Mandatory Palestine'], [1917, 'Ottoman Empire']] },
  sa: { history: [[1931, 'Kingdom of Hejaz and Nejd']] },
  eg: { history: [[1921, 'Egypt (British protectorate; before 1914 the Ottoman Khedivate)']] },
  ir: { history: [[1934, 'Persia']] },
  kw: { history: [[1960, 'Kuwait (British protectorate)']] },
  qa: { history: [[1970, 'Qatar (British protectorate)']] },
  ae: { history: [[1970, 'Trucial States (British protectorate)']] },
  hk: { history: [[1997, 'Hong Kong (British dependent territory)'], [1841, 'Qing China']] },
  cn: { history: [[1948, 'Republic of China'], [1911, 'Qing China']] },
  tw: { history: [[1945, 'Taiwan under Japanese rule'], [1894, 'Qing China (Taiwan)']] },
  kr: { history: [[1947, 'Korea under US military administration (south)'], [1945, 'Korea under Japanese rule'], [1909, 'Korean Empire'], [1896, 'Joseon (Korea)']] },
  th: { history: [[1938, 'Siam']] },
  mn: { history: [[1923, 'Bogd Khanate of Mongolia'], [1910, 'Qing China (Outer Mongolia)']] },
  sg: { history: [[1965, 'Malaysia'], [1962, 'Singapore (British colony)']] },
  my: { history: [[1962, 'Federation of Malaya'], [1956, 'Malaya (British)']] },
  in: { history: [[1947, 'British India']] },
  pk: { history: [[1947, 'British India']] },
  bd: { history: [[1971, 'Pakistan (East Pakistan)'], [1947, 'British India']] },
  vn: { history: [[1976, 'Vietnam (divided)'], [1953, 'French Indochina']] },
  id: { history: [[1949, 'Dutch East Indies']] },
  ph: { history: [[1946, 'The Philippines (United States territory)'], [1897, 'Spanish East Indies (the Philippines)']] },
  au: { history: [[1900, 'Australian colonies (British)']] },
  nz: { history: [[1906, 'Colony of New Zealand']] },
  pg: { history: [[1975, 'Territory of Papua and New Guinea (Australian)']] },
  ws: { history: [[1962, 'Western Samoa (New Zealand trust territory)']] },
  ca: { history: [[1866, 'British North America']] },
  jm: { history: [[1962, 'Jamaica (British colony)']] },
  bs: { history: [[1973, 'The Bahamas (British colony)']] },
  bz: { history: [[1981, 'British Honduras']] },
  gy: { history: [[1965, 'British Guiana']] },
  aw: { history: [[1985, 'Netherlands Antilles']] },
  cu: { history: [[1901, 'Cuba (United States military government)'], [1897, 'Spanish Cuba']] },
  pr: { history: [[1897, 'Spanish Puerto Rico']] },
  ht: { history: [[1803, 'Saint-Domingue (French colony)']] },
  mx: { history: [[1820, 'New Spain']] },
  gt: { history: [[1838, 'Federal Republic of Central America'], [1820, 'Captaincy General of Guatemala (Spanish)']] },
  sv: { history: [[1838, 'Federal Republic of Central America'], [1820, 'Captaincy General of Guatemala (Spanish)']] },
  ni: { history: [[1838, 'Federal Republic of Central America'], [1820, 'Captaincy General of Guatemala (Spanish)']] },
  cr: { history: [[1838, 'Federal Republic of Central America'], [1820, 'Captaincy General of Guatemala (Spanish)']] },
  pa: { history: [[1902, 'Colombia (Department of Panama)'], [1820, 'New Granada (Spanish)']] },
  co: { history: [[1830, 'Gran Colombia'], [1818, 'New Granada (Spanish)']] },
  ve: { history: [[1830, 'Gran Colombia'], [1810, 'Captaincy General of Venezuela (Spanish)']] },
  ec: { history: [[1829, 'Gran Colombia'], [1821, 'Royal Audience of Quito (Spanish)']] },
  pe: { history: [[1820, 'Viceroyalty of Peru']] },
  bo: { history: [[1824, 'Upper Peru (Spanish)']] },
  cl: { history: [[1817, 'Captaincy General of Chile (Spanish)']] },
  ar: { history: [[1815, 'Viceroyalty of the Río de la Plata']] },
  py: { history: [[1810, 'Spanish Paraguay']] },
  uy: { history: [[1827, 'Banda Oriental']] },
  br: { history: [[1821, 'Portuguese Brazil']] },
  gh: { history: [[1957, 'Gold Coast (British colony)']] },
  ng: { history: [[1960, 'Nigeria (British colony)']] },
  ke: { history: [[1963, 'Kenya (British colony)']] },
  ug: { history: [[1962, 'Uganda (British protectorate)']] },
  zw: { history: [[1979, 'Rhodesia'], [1964, 'Southern Rhodesia']] },
  za: { history: [[1909, 'Cape Colony and neighboring colonies and republics']] },
  dz: { history: [[1962, 'French Algeria'], [1829, 'Regency of Algiers (Ottoman)']] },
  ma: { history: [[1956, 'Morocco (French and Spanish protectorates)']] },
  tn: { history: [[1956, 'Tunisia (French protectorate)'], [1880, 'Beylik of Tunis (Ottoman)']] },
  cd: { history: [[1997, 'Zaire'], [1970, 'Republic of the Congo (Léopoldville)'], [1960, 'Belgian Congo'], [1907, 'Congo Free State']] },
  ao: { history: [[1975, 'Portuguese Angola']] },
  dj: { history: [[1977, 'French Territory of the Afars and the Issas']] },
};
