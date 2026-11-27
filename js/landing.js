// The landing page's appearance (Settings → Appearance → Landing Page): Afterglow, Midnight or Daydream, or matching
// the light or dark setting (Afterglow by day, Midnight by night), which is the default. Kept on this device under its
// own key, apart from the theme and the app icon (js/theme.js, js/appIcon.js): choosing one never changes the others.
import { isDark } from './theme.js';

export const LANDING_KEY = 'frombirth.landing';
export const LANDINGS = [
  { id: 'auto', name: 'Follow your theme', blurb: 'Afterglow by day, Midnight by night' },
  { id: 'afterglow', name: 'Afterglow', blurb: 'A peach and lavender sunset' },
  { id: 'midnight', name: 'Midnight', blurb: 'A starry night sky' },
  { id: 'daydream', name: 'Daydream', blurb: 'Lavender sky, cream clouds' },
];
export const LANDING_BY_ID = Object.fromEntries(LANDINGS.map((x) => [x.id, x]));

/** The saved choice: 'auto' unless one was chosen. */
export function getLanding() {
  try { const v = localStorage.getItem(LANDING_KEY); return LANDING_BY_ID[v] ? v : 'auto'; } catch { return 'auto'; }
}
/** Saves the choice ('auto' clears it). @returns {boolean} whether it changed */
export function setLanding(id) {
  if (!LANDING_BY_ID[id]) return false;
  const before = getLanding();
  try { if (id === 'auto') localStorage.removeItem(LANDING_KEY); else localStorage.setItem(LANDING_KEY, id); } catch { /* storage unavailable */ }
  return before !== id;
}
/** The appearance to draw now: the chosen one, or the one that matches light or dark. */
export const landingNow = (id = getLanding()) => (id === 'auto' ? (isDark() ? 'midnight' : 'afterglow') : id);
