// The calendar's seasons, where the player lives. Used by the turns (engine/turns.js) and by the scenes, which can be
// tied to a season (data/events: `timing`).

/** Countries where the seasons run the other way round. */
export const SOUTHERN = new Set(['au', 'nz', 'za', 'ar', 'cl', 'uy', 'py', 'br', 'bo', 'pe', 'na', 'bw', 'zw', 'mz', 'mg', 'ls', 'sz', 'zm', 'mw', 'fj', 'ws', 'to', 'pg']);
const NORTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'];
const FLIP = { winter: 'summer', summer: 'winter', spring: 'fall', fall: 'spring' };
/** The season at a month where the player lives. */
export function seasonAt(month, countryId) {
  const s = NORTH[((month % 12) + 12) % 12];
  return SOUTHERN.has(countryId) ? FLIP[s] : s;
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
