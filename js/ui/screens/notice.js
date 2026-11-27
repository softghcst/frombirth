// A short notice before the first life: it is all fiction, hard things can happen in it (told plainly), and nothing
// in it is advice. Shown once on a device, before the title screen; Settings → About Pathways shows it again.
//
// Automated browsers (navigator.webdriver: the checks in tests/) skip it, so they start at the title screen as before,
// unless the address asks for it (?notice).
import { markSvg } from '../kit.js';
import { openModal } from '../modals.js';

export const NOTICE_KEY = 'pathways.notice';
const VERSION = '1';

const PARAGRAPHS = [
  'All characters and events in Pathways are fictional. Any resemblance to real people is coincidental.',
  'Nothing here is medical, legal or financial advice.',
];
const body = () => PARAGRAPHS.map((t) => `<p>${t}</p>`).join('');

let seen;
try { seen = localStorage.getItem(NOTICE_KEY) === VERSION; } catch { seen = false; }
/** Whether to show the notice before the title screen. */
export function noticeDue() {
  if (seen) return false;
  const asked = typeof location !== 'undefined' && /[?&]notice\b/.test(location.search);
  return asked || !(typeof navigator !== 'undefined' && navigator.webdriver);
}
function markSeen() {
  seen = true;
  try { localStorage.setItem(NOTICE_KEY, VERSION); } catch { /* storage unavailable: shown again next time */ }
}

/** The notice as a screen of its own, before the title. */
export function renderNotice(app, onDone) {
  app.innerHTML = `
    <main class="title-screen notice-screen">
      <div class="notice">
        <div class="title-hero">${markSvg()}<h1>Just so you know</h1></div>
        <div class="card notice-card">${body()}</div>
        <button class="btn peach big" data-notice-ok>I understand</button>
      </div>
    </main>`;
  const ok = app.querySelector('[data-notice-ok]');
  ok.addEventListener('click', () => { markSeen(); onDone(); });
  ok.focus({ preventScroll: true });
}

/** The same notice, from Settings. */
export function openNotice() {
  return new Promise((resolve) => {
    const m = openModal(`<h2>About Pathways</h2><div class="notice-card">${body()}</div><button class="btn primary" data-close style="margin-top:14px">Close</button>`, { dismissable: true, onDismiss: resolve });
    m.el.querySelector('[data-close]').addEventListener('click', () => { m.close(); resolve(); });
  });
}
