// "Family roots": where someone's family comes from, as places (appearance.inherited.roots; js/avatar/heritage.js).
// Shown as places, never as a heritage or race: "Family roots: Japan and Nigeria."
import { COUNTRIES } from '../data/countries.js';

/** The places, in words, or '' when none are recorded (an older save) or the only one is `except` (nothing to add). */
export function rootsText(appearance, except = null) {
  const ids = (appearance?.inherited?.roots ?? []).filter((id) => COUNTRIES[id]);
  if (!ids.length || (ids.length === 1 && ids[0] === except)) return '';
  const names = ids.map((id) => COUNTRIES[id].name);
  return `Family roots: ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`}.`;
}
