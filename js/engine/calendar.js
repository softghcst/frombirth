// The calendar's seasons, where the player lives. Used by the turns (engine/turns.js) and by the scenes, which can be
// tied to a season (data/events: `timing`, and the scenes between years in data/events/seasons.js).
//
// GAMEPLAY CONFIGURATION, not a climate atlas: each country has one climate for the whole country, chosen for where most
// people live. Large countries span several (northern Mexico is desert, Brazil's south has four seasons); the game uses
// the one most of the country knows.
//
//   north / south   four seasons: winter, spring, summer, fall (the other way round in the south)
//   tropicNorth     a rainy season about May to October, dry the rest of the year
//   tropicSouth     a rainy season about November to April, dry the rest of the year
//   equator         two rainy seasons (long rains about March to May, short rains about October to December)
//   monsoon         a cool season, a hot season, the monsoon, and the weeks after it
//   desert          a long hot season, a cool season, and mild months between

export const CLIMATE = {};
const put = (type, ids) => { for (const id of ids.split(' ')) CLIMATE[id] = type; };
put('north', 'us uk ca de fr jp kr it es se ie cn pt nl pl tr ch no dk gr ru ua ma be mc ad at hr cz ee fi hu ro rs sk dz tn ge ir lb sy af kz mn tw hk il');
put('south', 'au nz za ar cl uy py');
put('tropicNorth', 'mx cu do jm ht pr bs bz cr sv gt ni pa ph ng gh ve et');
put('tropicSouth', 'br bo pe zw ao pg ws id');
put('equator', 'ec co ke ug cd sg my gy');
put('monsoon', 'in pk bd np th vn');
put('desert', 'eg ae sa kw qa jo iq dj aw');
export const climateOf = (countryId) => CLIMATE[countryId] ?? 'north';

/** Countries where the seasons run the other way round: the southern hemisphere's four seasons. */
export const SOUTHERN = new Set(Object.keys(CLIMATE).filter((id) => CLIMATE[id] === 'south'));

// The season in each month (0 = January), for each climate.
const W = 'winter'; const SP = 'spring'; const SU = 'summer'; const F = 'fall';
const MONTHS = {
  north: [W, W, SP, SP, SP, SU, SU, SU, F, F, F, W],
  south: [SU, SU, F, F, F, W, W, W, SP, SP, SP, SU],
  tropicNorth: ['dry', 'dry', 'dry', 'dry', 'wet', 'wet', 'wet', 'wet', 'wet', 'wet', 'dry', 'dry'],
  tropicSouth: ['wet', 'wet', 'wet', 'wet', 'dry', 'dry', 'dry', 'dry', 'dry', 'dry', 'wet', 'wet'],
  equator: ['dry', 'dry', 'wet', 'wet', 'wet', 'dry', 'dry', 'dry', 'dry', 'wet', 'wet', 'wet'],
  monsoon: ['cool', 'cool', 'hot', 'hot', 'hot', 'monsoon', 'monsoon', 'monsoon', 'monsoon', 'after', 'after', 'cool'],
  desert: ['cool', 'cool', 'mild', 'mild', 'hot', 'hot', 'hot', 'hot', 'hot', 'mild', 'mild', 'cool'],
};
/** How a season is named in a heading or on the button. */
export const SEASON_NAMES = { winter: 'winter', spring: 'spring', summer: 'summer', fall: 'fall', wet: 'the rainy season', dry: 'the dry season',
  monsoon: 'the monsoon', after: 'after the monsoon', hot: 'the hot season', cool: 'the cool season', mild: 'the mild months' };
export const seasonName = (s) => SEASON_NAMES[s] ?? s;

/** The season at a month where the player lives. */
export function seasonAt(month, countryId) {
  return MONTHS[climateOf(countryId)][((month % 12) + 12) % 12];
}
/**
 * The seasons of a turn: those of the months it covers, the turn ending at `end` (12 for the turn of the year). The
 * first is the one most of the turn was spent in, for headings.
 */
export function turnSeasons(end, step, countryId) {
  const count = {};
  for (let m = end - step; m < end; m++) { const s = seasonAt(m, countryId); count[s] = (count[s] ?? 0) + 1; }
  return Object.keys(count).sort((a, b) => count[b] - count[a]);
}
/** Whether the turn just played (ending at `end`, `step` months long) took in a month of the year (0 = January). */
export function turnCovers(end, step, month) {
  for (let m = end - step; m < end; m++) if (((m % 12) + 12) % 12 === month) return true;
  return false;
}

/** Where snow is part of winter for most people. */
export const SNOWY = new Set('us ca de fr jp kr se cn pl tr ch no dk ru ua at cz ee fi hu ro rs sk ge ir kz mn af nl be uk ie it ad hr nz cl ar'.split(' '));
/** Where winter days are short and dark. */
export const DARK_WINTERS = new Set('uk ie ca se no fi dk ee ru de nl be pl'.split(' '));

/** The month the school year starts (0 = January), where the player lives. Most of the north: September. */
const SCHOOL_START = { jp: 3, kr: 2, au: 1, nz: 1, za: 0, br: 1, ar: 2, cl: 2, uy: 2, py: 1, bo: 1, pe: 2, in: 5, pk: 7, bd: 0, np: 3, ph: 5, th: 4,
  id: 6, my: 2, sg: 0, ke: 0, ug: 1, zw: 0, ao: 1, cr: 1, co: 1, pa: 2, sv: 0, gt: 0, ni: 1, pg: 1, ws: 1, af: 2 };
export const schoolStart = (countryId) => SCHOOL_START[countryId] ?? 8;
/** The months of the year's big exams: the end of the school year, the few months before it starts again. */
export const examMonths = (countryId) => [4, 3, 2].map((k) => (schoolStart(countryId) - k + 12) % 12);
