// The app icon: which of From Birth's three icons the player has chosen (Settings → Appearance → App icon).
// The choice is kept on this device, apart from Light/Dark: changing the theme never changes the icon.
// What a platform can do with the choice (change an installed icon, or only the browser tab's) lives in
// js/platform/appIcon.js, so a native build can add its own way without touching Settings.
export const APP_ICON_KEY = 'frombirth.appIcon';
export const DEFAULT_ICON = 'afterglow';

/** The three icons, made from the supplied artwork in assets/branding (sized copies in icons/). */
export const APP_ICONS = [
  { id: 'afterglow', name: 'Afterglow', blurb: 'Default · a peach-to-lavender sunset', master: 'assets/branding/icon_afterglow.png' },
  { id: 'midnight', name: 'Midnight', blurb: 'A deep purple, starry night', master: 'assets/branding/icon_midnight.png' },
  { id: 'daydream', name: 'Daydream', blurb: 'Soft lavender and blue sky', master: 'assets/branding/icon_daydream.png' },
];
export const APP_ICON_BY_ID = Object.fromEntries(APP_ICONS.map((x) => [x.id, x]));
/** A sized copy of an icon: 32, 180, 192, 256, 512 or 1024 pixels. */
export const iconSrc = (id, size = 256) => `icons/icon-${APP_ICON_BY_ID[id] ? id : DEFAULT_ICON}-${size}.png`;

/** The chosen icon (Afterglow unless another was chosen). */
export function getAppIcon() {
  try { const v = localStorage.getItem(APP_ICON_KEY); return APP_ICON_BY_ID[v] ? v : DEFAULT_ICON; } catch { return DEFAULT_ICON; }
}
/** Saves the choice. Afterglow is the default, so choosing it clears the saved choice. @returns {boolean} whether it changed */
export function setAppIcon(id) {
  if (!APP_ICON_BY_ID[id]) return false;
  const before = getAppIcon();
  try { if (id === DEFAULT_ICON) localStorage.removeItem(APP_ICON_KEY); else localStorage.setItem(APP_ICON_KEY, id); } catch { /* storage unavailable: the choice lasts this visit */ }
  return before !== id;
}
export const restoreDefaultIcon = () => setAppIcon(DEFAULT_ICON);
