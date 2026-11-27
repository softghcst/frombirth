// In the app: the on-screen keyboard goes away when the player taps outside the field they were typing in, as in
// other iPhone apps (a WebView keeps it up otherwise). In a browser nothing changes.
import { isNative } from './native.js';

const typing = (el) => !!el && (el.matches?.('input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), textarea, select, [contenteditable=""], [contenteditable="true"]'));

export function watchKeyboard(root = typeof document !== 'undefined' ? document : null) {
  if (!root || !isNative() || root.__keyboard) return false;
  root.__keyboard = true;
  root.addEventListener('touchstart', (e) => {
    const active = root.activeElement;
    if (!typing(active)) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t && (typing(t) || t.closest('label'))) return;
    active.blur();
  }, { capture: true, passive: true });
  return true;
}
