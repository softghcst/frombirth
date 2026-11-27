// Where the game is running: a browser (the website, or the website added to a home screen), or the From Birth app
// (Capacitor, on iOS; later perhaps Android). Everything native is reached through here, and everything here works,
// quietly doing nothing, in a browser: the game never needs the app to run.
//
// The app's native plugins (package.json: @capacitor/haptics, filesystem, share, app, status-bar, keyboard) are
// reached through the global the app's WebView provides (window.Capacitor), so the website loads nothing extra and
// there is still nothing to build.

/** The game's home on the web: where links that need a web page (a password reset, say) are sent from the app. */
export const WEBSITE = 'https://softghcst.github.io/frombirth/';

const cap = () => (typeof window !== 'undefined' ? window.Capacitor : undefined);

/** True inside the iOS/Android app; false in every browser. */
export function isNative() {
  try { return !!cap()?.isNativePlatform?.(); } catch { return false; }
}

/** 'ios', 'android' or 'web'. */
export function platform() {
  try { return isNative() ? cap().getPlatform() : 'web'; } catch { return 'web'; }
}

const plugins = new Map();
/**
 * A native plugin by its Capacitor name ('Haptics', 'Filesystem', 'Share', 'App', 'StatusBar', 'Keyboard'), or null
 * in a browser or when the app was built without it. Calls on it return promises; callers catch their failures.
 */
export function plugin(name) {
  if (!isNative()) return null;
  if (plugins.has(name)) return plugins.get(name);
  let p = null;
  try {
    const c = cap();
    if (c.isPluginAvailable?.(name) !== false) p = c.registerPlugin?.(name) ?? c.Plugins?.[name] ?? null;
  } catch { p = null; }
  plugins.set(name, p);
  return p;
}

/** Runs a native call, giving `fallback` instead of an error if it fails or there is no such plugin. */
export async function tryNative(name, fn, fallback = null) {
  const p = plugin(name);
  if (!p) return fallback;
  try { return await fn(p); } catch (e) { console.warn(`${name}:`, e?.message ?? e); return fallback; }
}

/** For the tests: forget the plugins looked up so far (a page that pretends to be the app). */
export const resetPlugins = () => plugins.clear();
