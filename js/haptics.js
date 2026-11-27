// Haptics: a small tap under the finger for the moments that matter. Kept in this browser, apart from any one life,
// like Appearance (theme.js), and on unless turned off in Settings.
//
// What a phone can do from a web page:
//   Android and most other browsers: the Vibration API, with taps of any length and patterns.
//   iPhone (every browser there is Safari underneath): no Vibration API. Since iOS 18, Safari gives a light tick
//     when an on/off switch (<input type="checkbox" switch>) is flipped, so a hidden one is flipped during a tap.
//     One light tick, only from a real tap; not an official feature, so it may stop working in a later iOS.
//   Desktops: nothing, quietly.
export const HAPTICS_KEY = 'frombirth.haptics';

/** Patterns, in milliseconds: buzz, pause, buzz… On iPhone each is a single light tick. */
const PATTERNS = {
  tap: 8,            // a button that moves the life on
  select: 6,         // choosing an answer
  good: [10, 60, 16], // good news
  bad: [28, 50, 28],  // bad news
  heavy: 45,         // a death, a disaster
};

export function hapticsOn() {
  try { return localStorage.getItem(HAPTICS_KEY) !== 'off'; } catch { return true; }
}
export function setHaptics(on) {
  try { if (on) localStorage.removeItem(HAPTICS_KEY); else localStorage.setItem(HAPTICS_KEY, 'off'); } catch { /* storage unavailable */ }
  if (on) haptic('tap');
}

const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
// A touch screen with no Vibration API: an iPhone or iPad. (Desktop Safari has neither, and gets nothing.)
const isAppleTouch = () => typeof navigator !== 'undefined' && !canVibrate() && (navigator.maxTouchPoints ?? 0) > 0;

let switchLabel = null;
function appleTick() {
  if (typeof document === 'undefined' || !document.body) return;
  if (!switchLabel || !switchLabel.isConnected) {
    switchLabel = document.createElement('label');
    switchLabel.setAttribute('aria-hidden', 'true');
    switchLabel.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    switchLabel.appendChild(input);
    document.body.appendChild(switchLabel);
  }
  switchLabel.click(); // flips the switch: Safari answers with a tick
}

/** One haptic moment by name ('tap', 'select', 'good', 'bad', 'heavy'). Does nothing where it cannot, or when off. */
export function haptic(kind = 'tap') {
  if (!hapticsOn()) return;
  const pattern = PATTERNS[kind] ?? PATTERNS.tap;
  try {
    if (canVibrate()) navigator.vibrate(pattern);
    else if (isAppleTouch()) appleTick();
  } catch { /* never let a buzz break the game */ }
}

/** The tone of a message ('good', 'bad', …) as a haptic, or nothing for neutral news. */
export function hapticForTone(tone) {
  if (tone === 'good') haptic('good');
  else if (tone === 'bad') haptic('bad');
}

/**
 * Taps on the page: Age up, answering a scene, and the main button of a screen. Listened for once, on the document,
 * at the moment of the tap (which iPhone needs).
 */
export function watchTaps(root = typeof document !== 'undefined' ? document : null) {
  if (!root || root.__haptics) return;
  root.__haptics = true;
  root.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target.closest('button') : null;
    if (!el || el.disabled) return;
    if (el.matches('[data-year]')) haptic('tap');
    else if (el.matches('.choice-btn, .modal [data-ok]')) haptic('select');
    else if (el.matches('.btn.primary')) haptic('tap');
  }, true);
}
