// Browser check that every page that can be closed has a way out in plain sight: a ✕ in the top corner that stays on
// screen however far the page is scrolled, and closes it. Scenes that must be answered get none; a page with its own
// close button does not get a second.
// Needs Playwright (preinstalled where the checks run). Serves the game itself. Run with: node tests/close-buttons.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  try { ({ chromium } = require(join(process.execPath, '../../lib/node_modules/playwright'))); } catch { console.log('Playwright is not available here: browser check skipped.'); process.exit(0); }
}
const root = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!path.startsWith(root)) { res.writeHead(403); return res.end(); }
  try { const body = await readFile(path.endsWith('/') ? join(path, 'index.html') : path); res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };
const browser = await chromium.launch();
const inView = (page) => page.evaluate(() => {
  const x = [...document.querySelectorAll('#modal-root .modal-x')].pop();
  if (!x || x.closest('[hidden]')) return false;
  const r = x.getBoundingClientRect();
  return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.modal-x') === x;
});
for (const [label, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('[data-random]');
  await page.waitForSelector('[data-year]');
  await page.evaluate(() => { document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()); });
  // My Fame: a long page. Scrolled to the bottom, the ✕ is still there, and closes it.
  await page.evaluate(async () => { const { store } = await import('/js/state.js'); const p = store.state.player; p.age = 20; p.birthYear = store.state.year - 20; (await import('/js/ui/fame.js')).openFame({ changed() {}, rerender() {} }); });
  await page.waitForTimeout(250);
  check(await page.locator('#modal-root .modal-x').count() === 1, `${label}: My Fame has a close button`);
  check(await inView(page), `${label}: it is on screen when My Fame opens`);
  await page.evaluate(() => { const m = [...document.querySelectorAll('#modal-root .modal')].pop(); m.scrollTop = m.scrollHeight; });
  await page.waitForTimeout(150);
  check(await inView(page), `${label}: and still on screen at the bottom of the page`);
  const focused = await page.evaluate(() => document.activeElement?.classList.contains('modal-x'));
  check(!focused, `${label}: focus starts on the page, not on the close button`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/close-${label}.png` });
  await page.locator('#modal-root .modal-x').last().click(); await page.waitForTimeout(150);
  check(!(await page.locator('#modal-root .scrim').count()), `${label}: the close button closes it`);
  // A scene that must be answered has none.
  await page.evaluate(async () => { const M = await import('/js/ui/modals.js'); M.openModal('<h2>Choose</h2><button class="choice-btn">Yes</button>'); });
  check(!(await page.locator('#modal-root .modal-x').count()), `${label}: a scene that must be answered has no close button`);
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  // A page with its own close button keeps just that one.
  await page.evaluate(async () => { const M = await import('/js/ui/modals.js'); M.openModal('<div><h2>Own</h2><button class="icon-btn" data-x aria-label="Close">✕</button></div>', { dismissable: true }); });
  await page.waitForTimeout(50);
  check(await page.locator('#modal-root .modal-x:visible').count() === 0, `${label}: a page with its own close button does not get a second`);
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  // My Neighborhood, opened from Pursuits.
  await page.locator('[data-tab="pursuits"]').click(); await page.waitForTimeout(200);
  if (await page.locator('[data-go="neighborhood"]').count()) {
    await page.click('[data-go="neighborhood"]'); await page.waitForTimeout(250);
    const ways = await page.evaluate(() => [...document.querySelectorAll('#modal-root .modal')].pop()?.querySelectorAll('[aria-label="Close"]:not([hidden]):not(.modal-xrow[hidden] *)').length ?? 0);
    check(ways >= 1, `${label}: My Neighborhood has a close button`);
  }
  check(!errors.length, `${label}: no errors in the page (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'Every page has a way out.');
process.exit(problems.length ? 1 : 0);
