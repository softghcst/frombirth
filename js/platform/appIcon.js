// What the platform can do with the chosen app icon (js/appIcon.js holds the choice itself).
//   Native (a future iOS or Android build): the app's own alternate-icon call, if the native shell provides one as
//     window.FromBirthNative.setAlternateIcon(name | null).
//   Web and installed web app: the browser tab's icon changes at once. An icon already on a home screen does not:
//     browsers fix it when the app is added, and Afterglow is the icon the install uses.
import { iconSrc, DEFAULT_ICON } from '../appIcon.js';

const nativeShell = () => (typeof window !== 'undefined' && typeof window.FromBirthNative?.setAlternateIcon === 'function' ? window.FromBirthNative : null);
const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };

/** What this platform can do: 'native' (the installed icon changes), or 'web' (the tab's icon only). */
export const iconSupport = () => (nativeShell() ? 'native' : 'web');

/**
 * Puts the chosen icon where the platform allows.
 * @returns {{changedInstalled:boolean, note:string}} what happened, for Settings to say plainly
 */
export function applyAppIcon(id) {
  const shell = nativeShell();
  if (shell) {
    try { shell.setAlternateIcon(id === DEFAULT_ICON ? null : id); return { changedInstalled: true, note: 'Your home screen icon changes now.' }; } catch { /* fall through to the web */ }
  }
  if (typeof document !== 'undefined') {
    const link = document.querySelector('link[rel="icon"]');
    if (link) link.setAttribute('href', `./${iconSrc(id, 32)}`);
  }
  const installed = standalone();
  return { changedInstalled: false, note: id === DEFAULT_ICON ? ''
    : installed ? 'Your choice is saved. An icon already on your home screen stays Afterglow: browsers set it when the app is added, and this one cannot change it afterwards.'
      : 'Your choice is saved, and shown in this tab. If you add From Birth to your home screen, it uses Afterglow: browsers do not allow a web app to change its installed icon.' };
}
