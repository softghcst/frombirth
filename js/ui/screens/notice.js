// A moment before the title screen, every time the game opens: the people and events are fiction, and nothing in it
// is advice. It moves on by itself after a couple of seconds; a tap or a key moves on at once. Settings → About
// Pathways shows the same words.
//
// Automated browsers (navigator.webdriver: the checks in tests/) skip it, so they start at the title screen as before,
// unless the address asks for it (?notice).
import { openModal } from '../modals.js';

const LINES = [
  'All characters and events in this game are fictional. Any resemblance to real people or events is coincidental.',
  'Nothing here is medical, legal or financial advice.',
];
/** How long it stays, in milliseconds. */
export const NOTICE_MS = 2600;

/** Whether to show it before the title screen. */
export function noticeDue() {
  const asked = typeof location !== 'undefined' && /[?&]notice\b/.test(location.search);
  return asked || !(typeof navigator !== 'undefined' && navigator.webdriver);
}

/** The notice, then the title screen (onDone). */
export function renderNotice(app, onDone) {
  app.innerHTML = `<main class="notice-screen" role="status" data-notice>${LINES.map((t) => `<p>${t}</p>`).join('')}</main>`;
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    removeEventListener('keydown', go);
    onDone();
  };
  const timer = setTimeout(go, NOTICE_MS);
  app.querySelector('[data-notice]').addEventListener('click', go);
  addEventListener('keydown', go);
}

/** The same words, from Settings. */
export function openNotice() {
  return new Promise((resolve) => {
    const m = openModal(`<h2>About Pathways</h2>${LINES.map((t) => `<p class="body">${t}</p>`).join('')}<button class="btn primary" data-close style="margin-top:14px">Close</button>`, { dismissable: true, onDismiss: resolve });
    m.el.querySelector('[data-close]').addEventListener('click', () => { m.close(); resolve(); });
  });
}
