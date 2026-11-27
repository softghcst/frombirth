// Appearance: Light, Dark, or the System setting. Kept in this browser, apart from any one life, so it
// applies on the title screen too. index.html applies the saved choice before the first paint.
export const THEME_KEY = 'frombirth.theme';
export const THEMES = ['system', 'light', 'dark'];
export const THEME_NAMES = { system: 'System', light: 'Light', dark: 'Dark' };

/** The saved choice: 'system' (the default), 'light' or 'dark'. */
export function getTheme() {
  try { const t = localStorage.getItem(THEME_KEY); return THEMES.includes(t) ? t : 'system'; } catch { return 'system'; }
}

/** Whether the game is drawn dark right now. */
export function isDark(theme = getTheme()) {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Puts the choice on the page: data-theme on <html>, and the browser's own bar color. */
export function applyTheme(theme = getTheme()) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDark(theme) ? '#231C2D' : '#F1EBFA');
}

/** Saves and applies the choice. */
export function setTheme(theme) {
  if (!THEMES.includes(theme)) return;
  try { if (theme === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, theme); } catch { /* storage unavailable */ }
  applyTheme(theme);
}

// Following the system: keep the browser bar in step when the system changes.
if (typeof matchMedia === 'function') {
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (getTheme() === 'system') applyTheme('system'); }); } catch { /* old browsers */ }
}
