import { NEW_PLACES } from './worldNew.js';
// What it is like to live in each country: pay, prices, safety, health
// care, how reliable the power and water are, how stable things are, the
// weather and ground underfoot, the law, and any crisis under way.
//
// These are simplified, rounded pictures of the mid-2020s, written so the
// game feels different from country to country. They are not statistics, and
// countries change: edit a row here and the game follows.
//
// Columns of each row:
//   wage      typical pay, with the United States as 1
//   cost      local prices (rent, food, services), with the United States as 1
//   safety    0–100: how unlikely street crime, burglary and worse are
//   health    0–100: the standard of care an ordinary person gets
//   infra     0–100: how reliable electricity, water and roads are
//   stability 0–100: how calm politics and public order are
//   graft     0–100: how often a bribe is asked for
//   inflation 'low' | 'high' | 'extreme': how fast cash loses its value
//   hazards   what the land and weather can do there
//   laws      marriage: same-sex couples can marry
//             lgbt: 'equal' | 'limited' | 'hostile' (hostile: against the law, or close to it)
//             gambling: casinos and betting are legal
//             deathPenalty: a murder conviction can end in execution
//             conscription: young men are called up for military service
//   crisis    optional: something large and ongoing (see CRISES below)
const row = (wage, cost, safety, health, infra, stability, graft, inflation, hazards, laws, crisis) =>
  ({ wage, cost, safety, health, infra, stability, graft, inflation, hazards, laws, crisis: crisis ?? null });
const law = (marriage, lgbt, gambling, deathPenalty, conscription) => ({ marriage, lgbt, gambling, deathPenalty, conscription });
const Y = true;
const N = false;

export const LIVING = {
  us: row(1.00, 1.00, 62, 78, 90, 68, 22, 'low', ['hurricane', 'wildfire', 'tornado'], law(Y, 'equal', Y, Y, N)),
  uk: row(0.80, 0.95, 72, 80, 90, 74, 18, 'low', ['flood'], law(Y, 'equal', Y, N, N)),
  ca: row(0.85, 0.90, 78, 82, 92, 82, 14, 'low', ['wildfire', 'winter'], law(Y, 'equal', Y, N, N)),
  au: row(0.95, 1.00, 78, 84, 92, 82, 14, 'low', ['wildfire', 'flood', 'heat'], law(Y, 'equal', Y, N, N)),
  de: row(0.85, 0.85, 78, 86, 94, 80, 14, 'low', ['flood'], law(Y, 'equal', Y, N, N)),
  fr: row(0.75, 0.90, 70, 86, 92, 66, 20, 'low', ['heat', 'flood'], law(Y, 'equal', Y, N, N)),
  jp: row(0.65, 0.75, 92, 90, 96, 84, 16, 'low', ['earthquake', 'typhoon'], law(N, 'limited', Y, Y, N)),
  br: row(0.20, 0.40, 38, 62, 70, 52, 55, 'low', ['flood', 'heat'], law(Y, 'equal', Y, N, Y)),
  in: row(0.08, 0.25, 58, 55, 58, 62, 58, 'low', ['flood', 'heat'], law(N, 'limited', N, Y, N)),
  ng: row(0.05, 0.30, 30, 35, 28, 34, 76, 'high', ['flood', 'heat'], law(N, 'hostile', Y, Y, N)),
  mx: row(0.20, 0.40, 36, 62, 72, 50, 66, 'low', ['earthquake', 'hurricane'], law(Y, 'equal', Y, N, Y)),
  kr: row(0.65, 0.75, 86, 90, 96, 76, 26, 'low', ['typhoon'], law(N, 'limited', N, N, Y)),
  it: row(0.60, 0.80, 72, 84, 86, 66, 34, 'low', ['earthquake', 'heat', 'flood'], law(N, 'equal', Y, N, N)),
  es: row(0.55, 0.70, 78, 86, 90, 70, 28, 'low', ['heat', 'wildfire'], law(Y, 'equal', Y, N, N)),
  se: row(0.85, 0.90, 76, 86, 94, 82, 10, 'low', ['winter'], law(Y, 'equal', Y, N, Y)),
  ie: row(0.90, 1.00, 78, 80, 88, 82, 16, 'low', ['flood'], law(Y, 'equal', Y, N, N)),
  za: row(0.20, 0.40, 30, 55, 48, 52, 58, 'low', ['drought', 'flood'], law(Y, 'equal', Y, N, N)),
  cn: row(0.25, 0.45, 84, 72, 90, 70, 50, 'low', ['flood', 'earthquake', 'typhoon'], law(N, 'limited', N, Y, N)),
  ph: row(0.10, 0.35, 52, 55, 60, 56, 62, 'low', ['typhoon', 'earthquake', 'flood'], law(N, 'limited', Y, N, N)),
  ar: row(0.25, 0.40, 52, 70, 76, 50, 58, 'extreme', ['flood', 'heat'], law(Y, 'equal', Y, N, N), 'inflation'),
  ve: row(0.04, 0.35, 22, 30, 30, 24, 84, 'extreme', ['flood'], law(N, 'limited', Y, N, Y), 'collapse'),
  co: row(0.15, 0.35, 40, 64, 70, 48, 58, 'low', ['earthquake', 'flood'], law(Y, 'equal', Y, N, Y)),
  cl: row(0.30, 0.50, 62, 74, 84, 64, 30, 'low', ['earthquake', 'wildfire'], law(Y, 'equal', Y, N, Y)),
  pt: row(0.40, 0.65, 84, 82, 88, 80, 34, 'low', ['wildfire', 'heat'], law(Y, 'equal', Y, N, N)),
  nl: row(0.90, 0.95, 80, 88, 96, 80, 12, 'low', ['flood'], law(Y, 'equal', Y, N, N)),
  pl: row(0.40, 0.50, 82, 76, 88, 70, 38, 'low', ['flood', 'winter'], law(N, 'limited', Y, N, N)),
  tr: row(0.20, 0.35, 62, 70, 80, 46, 60, 'extreme', ['earthquake', 'heat'], law(N, 'limited', N, N, Y), 'inflation'),
  eg: row(0.07, 0.25, 58, 50, 62, 44, 66, 'high', ['heat', 'drought'], law(N, 'hostile', N, Y, Y)),
  th: row(0.15, 0.40, 66, 72, 80, 50, 62, 'low', ['flood', 'heat'], law(Y, 'equal', N, Y, Y)),
  vn: row(0.10, 0.30, 76, 64, 76, 70, 60, 'low', ['typhoon', 'flood'], law(N, 'limited', N, Y, Y)),
  ke: row(0.07, 0.35, 42, 48, 48, 50, 70, 'low', ['drought', 'flood'], law(N, 'hostile', Y, N, N)),
  jm: row(0.15, 0.50, 34, 60, 66, 60, 56, 'low', ['hurricane'], law(N, 'hostile', Y, N, N)),
  nz: row(0.75, 0.90, 80, 82, 90, 86, 10, 'low', ['earthquake', 'flood'], law(Y, 'equal', Y, N, N)),
  ch: row(1.25, 1.40, 90, 92, 98, 90, 10, 'low', ['avalanche'], law(Y, 'equal', Y, N, Y)),
  no: row(1.10, 1.15, 88, 90, 96, 90, 8, 'low', ['winter', 'avalanche'], law(Y, 'equal', Y, N, Y)),
  dk: row(1.00, 1.10, 86, 88, 96, 88, 8, 'low', ['flood'], law(Y, 'equal', Y, N, Y)),
  gr: row(0.35, 0.65, 76, 78, 82, 64, 48, 'low', ['wildfire', 'earthquake', 'heat'], law(Y, 'equal', Y, N, Y)),
  ru: row(0.20, 0.40, 60, 62, 76, 40, 70, 'high', ['winter', 'wildfire'], law(N, 'hostile', N, N, Y), 'sanctions'),
  ua: row(0.10, 0.30, 34, 55, 46, 22, 62, 'high', ['winter'], law(N, 'limited', Y, N, Y), 'war'),
  pe: row(0.15, 0.35, 44, 58, 66, 44, 62, 'low', ['earthquake', 'flood'], law(N, 'limited', Y, N, N)),
  do: row(0.15, 0.40, 44, 56, 62, 60, 66, 'low', ['hurricane'], law(N, 'limited', Y, N, N)),
  cu: row(0.03, 0.30, 70, 62, 34, 46, 54, 'extreme', ['hurricane'], law(Y, 'equal', N, N, Y), 'shortages'),
  gh: row(0.06, 0.35, 56, 48, 52, 66, 58, 'high', ['flood', 'heat'], law(N, 'hostile', Y, N, N)),
  ma: row(0.10, 0.35, 66, 56, 74, 66, 60, 'low', ['earthquake', 'drought'], law(N, 'hostile', Y, N, Y)),
  pk: row(0.05, 0.20, 40, 42, 40, 36, 72, 'high', ['flood', 'heat', 'earthquake'], law(N, 'hostile', N, Y, N)),
  id: row(0.10, 0.30, 62, 56, 66, 64, 62, 'low', ['earthquake', 'volcano', 'flood'], law(N, 'limited', N, Y, N)),
  sg: row(0.90, 1.15, 94, 90, 98, 88, 8, 'low', ['heat'], law(N, 'limited', Y, Y, Y)),
  ae: row(0.80, 0.85, 90, 82, 96, 84, 30, 'low', ['heat'], law(N, 'hostile', N, Y, Y)),
  be: row(0.88, 0.92, 76, 86, 94, 74, 14, 'low', ['flood'], law(Y, 'equal', Y, N, N)),
  mc: row(1.35, 1.60, 96, 92, 98, 92, 8, 'low', ['heat'], law(N, 'equal', Y, N, N)),
  jo: row(0.14, 0.45, 78, 66, 80, 70, 45, 'low', ['drought', 'heat'], law(N, 'limited', N, Y, Y)),
  sa: row(0.62, 0.70, 84, 78, 92, 80, 40, 'low', ['heat', 'drought'], law(N, 'hostile', N, Y, N)),
  kw: row(0.75, 0.80, 88, 80, 94, 76, 35, 'low', ['heat'], law(N, 'hostile', N, Y, Y)),
  qa: row(1.00, 0.95, 92, 86, 97, 86, 25, 'low', ['heat'], law(N, 'hostile', N, Y, Y)),
  my: row(0.28, 0.42, 72, 76, 86, 72, 40, 'low', ['flood', 'heat'], law(N, 'hostile', Y, Y, N)),
};
// The places added by the Living World engine (data/worldNew.js).
for (const [id, r] of Object.entries(NEW_PLACES)) {
  const [wage, cost, safety, health, infra, stability, graft, inflation, hazards, l, crisis] = r[6];
  LIVING[id] = row(wage, cost, safety, health, infra, stability, graft, inflation, hazards, law(...l), crisis);
}

/**
 * The world changes during a life: crises begin and end (engine/economy.js).
 * Those changes live in the save. `crisis` and `inflation` on each row read
 * through this hook first, so every reader sees the world as it now is, and
 * fall back to the values written above. BASE_LIVING keeps the originals.
 */
export const dynamic = { read: null };
export const BASE_LIVING = {};
for (const [id, r] of Object.entries(LIVING)) {
  BASE_LIVING[id] = { crisis: r.crisis, inflation: r.inflation };
  for (const key of ['crisis', 'inflation']) {
    Object.defineProperty(r, key, { enumerable: true, configurable: true, get() { const v = dynamic.read?.(id, key); return v === undefined ? BASE_LIVING[id][key] : v; } });
  }
}

/** Natural hazards: how often they strike in a year, and how they read in the journal. */
export const HAZARDS = {
  earthquake: { name: 'earthquakes', chance: 0.03, strike: 'An earthquake shook the city in the night.', damage: 30, injury: 0.2 },
  hurricane: { name: 'hurricanes', chance: 0.05, strike: 'A hurricane came ashore.', damage: 26, injury: 0.1 },
  typhoon: { name: 'typhoons', chance: 0.05, strike: 'A typhoon tore through.', damage: 24, injury: 0.1 },
  tornado: { name: 'tornadoes', chance: 0.015, strike: 'A tornado touched down a few streets away.', damage: 35, injury: 0.15 },
  flood: { name: 'floods', chance: 0.04, strike: 'The river burst its banks.', damage: 22, injury: 0.05 },
  wildfire: { name: 'wildfires', chance: 0.03, strike: 'Wildfire reached the edge of town.', damage: 30, injury: 0.06 },
  volcano: { name: 'volcanoes', chance: 0.012, strike: 'The volcano woke, and ash fell for a week.', damage: 16, injury: 0.05 },
  avalanche: { name: 'avalanches', chance: 0.006, strike: 'An avalanche closed the valley.', damage: 10, injury: 0.08 },
  heat: { name: 'heatwaves', chance: 0.08, strike: 'A heatwave settled over the country for weeks.', damage: 0, injury: 0, health: -3 },
  drought: { name: 'drought', chance: 0.06, strike: 'The rains failed again. Water is rationed.', damage: 0, injury: 0, mood: -4 },
  winter: { name: 'hard winters', chance: 0.08, strike: 'It was the hardest winter in years.', damage: 0, injury: 0.03, mood: -3 },
};

/** Ongoing crises. Each is described once on arrival and then felt every year. */
export const CRISES = {
  war: { name: 'War', blurb: 'The country is at war. Air-raid sirens are part of the week, and men of fighting age may not leave.',
    yearly: 'Another year of war: sirens, shelters, and bad news from the front.', mood: -6, danger: 0.02, damage: 0.05, exitBan: [18, 60] },
  collapse: { name: 'Economic collapse', blurb: 'The economy has collapsed. Wages buy almost nothing, shelves are bare, and millions have left.',
    yearly: 'Another year of queues, empty shelves and people leaving.', mood: -5, shortages: 0.5 },
  shortages: { name: 'Shortages', blurb: 'Food, fuel and medicine are rationed, and the power goes off most days.',
    yearly: 'Another year of ration books and long queues.', mood: -4, shortages: 0.4 },
  inflation: { name: 'Runaway prices', blurb: 'Prices rise month by month. Nobody keeps savings in cash if they can help it.',
    yearly: null, mood: -2 },
  sanctions: { name: 'Sanctions and mobilisation', blurb: 'The country is under sanctions and at war abroad. Imports are scarce, and men can be called up.',
    yearly: 'Another year of sanctions. More things have quietly vanished from the shops.', mood: -3, callUp: 0.03 },
};

/** How fast cash loses value each year. */
export const INFLATION = { low: 0, high: 0.06, extreme: 0.16 };

/** Words for a 0–100 score. */
export const grade = (v) => (v >= 85 ? 'excellent' : v >= 70 ? 'good' : v >= 55 ? 'fair' : v >= 40 ? 'poor' : 'very poor');
