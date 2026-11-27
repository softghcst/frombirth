// The landing page's appearance (Settings → Appearance → Landing Page): Afterglow, Midnight or Daydream; or following
// the light or dark setting (Afterglow in light, Midnight in dark), which is the default; or the time of day by the
// device's clock (Afterglow by day, Midnight at night). Kept on this device under its
// own key, apart from the theme and the app icon (js/theme.js, js/appIcon.js): choosing one never changes the others.
import { isDark } from './theme.js';

export const LANDING_KEY = 'frombirth.landing';
export const LANDINGS = [
  { id: 'auto', name: 'Follow your theme', blurb: 'Afterglow in light mode, Midnight in dark mode' },
  { id: 'clock', name: 'Day and night', blurb: 'Afterglow from 8am, Midnight from 8pm' },
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
/** Night by the device's own clock: from 8pm to 8am. */
export const isNight = (d = new Date()) => d.getHours() >= 20 || d.getHours() < 8;
/** The appearance to draw now: the chosen one, the one that matches light or dark, or the one for the time of day. */
export const landingNow = (id = getLanding(), d = new Date()) => (id === 'auto' ? (isDark() ? 'midnight' : 'afterglow') : id === 'clock' ? (isNight(d) ? 'midnight' : 'afterglow') : id);
