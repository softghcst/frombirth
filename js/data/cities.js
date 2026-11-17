// Cities: which region each is in, and how it differs from the rest of its country.
//
// GAMEPLAY ESTIMATES, NOT STATISTICS. `housing` and `pay` are multipliers
// against the national level (1 = the country's average in the game): what
// a home costs to buy or rent there, and what jobs pay there. They are the
// author's rough sense of each place, rounded hard, and are not measured
// from any dataset. Region names are real; they were written from general
// knowledge and are unverified.
//
// Twelve countries have a row for every city. Everywhere else a city gets a
// generic profile (engine/cities.js): the capital dearer and better paid,
// the first city listed treated as the largest, the rest at the national level.

/** [city, region, housing, pay] */
const ROWS = {
  us: [['New York', 'New York', 1.7, 1.2], ['Chicago', 'Illinois', 1.0, 1.05], ['Austin', 'Texas', 1.05, 1.02], ['Seattle', 'Washington', 1.45, 1.15], ['Atlanta', 'Georgia', 0.9, 1.0], ['Denver', 'Colorado', 1.15, 1.03]],
  uk: [['London', 'England', 1.8, 1.25], ['Manchester', 'England', 0.9, 0.98], ['Leeds', 'England', 0.8, 0.95], ['Bristol', 'England', 1.1, 1.0], ['Glasgow', 'Scotland', 0.75, 0.95], ['Cardiff', 'Wales', 0.8, 0.93]],
  ca: [['Toronto', 'Ontario', 1.5, 1.1], ['Vancouver', 'British Columbia', 1.7, 1.05], ['Montreal', 'Quebec', 1.0, 0.97], ['Calgary', 'Alberta', 0.95, 1.08], ['Halifax', 'Nova Scotia', 0.85, 0.92], ['Winnipeg', 'Manitoba', 0.7, 0.93]],
  mx: [['Mexico City', 'Mexico City', 1.5, 1.2], ['Guadalajara', 'Jalisco', 1.05, 1.02], ['Monterrey', 'Nuevo León', 1.15, 1.2], ['Puebla', 'Puebla', 0.8, 0.9], ['Mérida', 'Yucatán', 0.85, 0.88], ['Oaxaca', 'Oaxaca', 0.75, 0.8]],
  br: [['São Paulo', 'São Paulo', 1.4, 1.2], ['Rio de Janeiro', 'Rio de Janeiro', 1.35, 1.08], ['Salvador', 'Bahia', 0.8, 0.85], ['Curitiba', 'Paraná', 0.95, 1.0], ['Recife', 'Pernambuco', 0.8, 0.85], ['Belo Horizonte', 'Minas Gerais', 0.9, 0.95]],
  fr: [['Paris', 'Île-de-France', 1.9, 1.25], ['Lyon', 'Auvergne-Rhône-Alpes', 1.1, 1.02], ['Marseille', "Provence-Alpes-Côte d'Azur", 0.85, 0.95], ['Toulouse', 'Occitanie', 0.9, 0.98], ['Nantes', 'Pays de la Loire', 0.95, 0.97], ['Lille', 'Hauts-de-France', 0.8, 0.95]],
  de: [['Berlin', 'Berlin', 1.15, 1.0], ['Hamburg', 'Hamburg', 1.25, 1.08], ['Munich', 'Bavaria', 1.7, 1.18], ['Cologne', 'North Rhine-Westphalia', 1.05, 1.02], ['Leipzig', 'Saxony', 0.7, 0.88], ['Stuttgart', 'Baden-Württemberg', 1.25, 1.15]],
  jp: [['Tokyo', 'Tokyo', 1.7, 1.2], ['Osaka', 'Osaka', 1.05, 1.02], ['Kyoto', 'Kyoto', 1.0, 0.95], ['Sapporo', 'Hokkaido', 0.7, 0.88], ['Fukuoka', 'Fukuoka', 0.8, 0.92], ['Nagoya', 'Aichi', 0.9, 1.02]],
  in: [['Mumbai', 'Maharashtra', 2.0, 1.25], ['Delhi', 'Delhi', 1.4, 1.15], ['Bengaluru', 'Karnataka', 1.3, 1.25], ['Chennai', 'Tamil Nadu', 0.95, 1.0], ['Kolkata', 'West Bengal', 0.75, 0.85], ['Pune', 'Maharashtra', 0.9, 1.05]],
  kr: [['Seoul', 'Seoul', 1.9, 1.15], ['Busan', 'Busan', 0.85, 0.93], ['Incheon', 'Incheon', 1.0, 0.98], ['Daegu', 'Daegu', 0.7, 0.9], ['Daejeon', 'Daejeon', 0.7, 0.95], ['Gwangju', 'Gwangju', 0.6, 0.88]],
  au: [['Sydney', 'New South Wales', 1.6, 1.1], ['Melbourne', 'Victoria', 1.2, 1.05], ['Brisbane', 'Queensland', 1.05, 1.0], ['Perth', 'Western Australia', 0.95, 1.1], ['Adelaide', 'South Australia', 0.85, 0.93], ['Hobart', 'Tasmania', 0.8, 0.88]],
  ae: [['Dubai', 'Dubai', 1.4, 1.15], ['Abu Dhabi', 'Abu Dhabi', 1.25, 1.2], ['Sharjah', 'Sharjah', 0.7, 0.85], ['Al Ain', 'Abu Dhabi', 0.6, 0.85], ['Ajman', 'Ajman', 0.55, 0.8], ['Ras Al Khaimah', 'Ras Al Khaimah', 0.55, 0.8]],
};

/** What each kind of region is called. */
export const REGION_WORD = { us: 'State', uk: 'Country', ca: 'Province', mx: 'State', br: 'State', fr: 'Region', de: 'State', jp: 'Prefecture', in: 'State', kr: 'City', au: 'State', ae: 'Emirate' };

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** countryId → cityName → { region, regionId, housing, pay } */
export const CITY_ROWS = Object.fromEntries(Object.entries(ROWS).map(([id, rows]) => [id,
  Object.fromEntries(rows.map(([city, region, housing, pay]) => [city, { region, regionId: slug(region), housing, pay }]))]));

/** The region whose law applies in a city, if the game has one for it. */
export const regionOf = (countryId, name) => CITY_ROWS[countryId]?.[name]?.regionId ?? null;

/** The generic profiles used everywhere else. */
export const GENERIC = {
  capital: { housing: 1.3, pay: 1.1 },
  largest: { housing: 1.2, pay: 1.08 },
  city: { housing: 0.95, pay: 0.98 },
};

/** Moving house within a country: the movers and a deposit, in base units. */
export const MOVE_COST = 1800;
/** How often an employer has somewhere to send you instead of letting you go. */
export const TRANSFER_CHANCE = 0.4;
