// Browser check that every page that can be closed has the same way back in plain sight: "‹ Back" at the top left, which
// stays on screen however far the page is scrolled, and closes it. Scenes that must be answered get none; a page that
// draws its own ✕ in a header keeps one Back, with its own ✕ tucked away.
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
  const x = [...document.querySelectorAll('#modal-root .modal-back')].pop();
  if (!x || false) return false;
  const r = x.getBoundingClientRect();
  return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.modal-back') === x;
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
  check(await page.locator('#modal-root .modal-back').count() === 1, `${label}: My Fame has a Back button`);
  check(await inView(page), `${label}: it is on screen when My Fame opens`);
  await page.evaluate(() => { const m = [...document.querySelectorAll('#modal-root .modal')].pop(); m.scrollTop = m.scrollHeight; });
  await page.waitForTimeout(150);
  check(await inView(page), `${label}: and still on screen at the bottom of the page`);
  const focused = await page.evaluate(() => document.activeElement?.classList.contains('modal-back'));
  check(!focused, `${label}: focus starts on the page, not on the Back button`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/close-${label}.png` });
  await page.locator('#modal-root .modal-back').last().click(); await page.waitForTimeout(150);
  check(!(await page.locator('#modal-root .scrim').count()), `${label}: the Back button closes it`);
  // A scene that must be answered has none.
  await page.evaluate(async () => { const M = await import('/js/ui/modals.js'); M.openModal('<h2>Choose</h2><button class="choice-btn">Yes</button>'); });
  check(!(await page.locator('#modal-root .modal-back').count()), `${label}: a scene that must be answered has no Back button`);
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  // A page with its own close button keeps just that one.
  await page.evaluate(async () => { const M = await import('/js/ui/modals.js'); M.openModal('<div><h2>Own</h2><button class="icon-btn" data-x aria-label="Close">✕</button></div>', { dismissable: true }); });
  await page.waitForTimeout(50);
  check(await page.locator('#modal-root .modal-back:visible').count() === 1 && await page.locator('#modal-root [data-x]:visible').count() === 0, `${label}: a page with its own ✕ gets one Back, and its own ✕ is tucked away`);
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  // A page with levels of its own: Back presses its own back control, and leaves the page only from the first level.
  await page.evaluate(async () => { const M = await import('/js/ui/modals.js'); const m = M.openModal('<div id="lvl"><h2>Level one</h2><button class="btn" data-next>Deeper</button></div>', { dismissable: true }); m.el.addEventListener('click', (e) => { if (e.target.closest('[data-next]')) m.el.querySelector('#lvl').innerHTML = '<h2>Level two</h2><button class="btn" data-back>Back to one</button>'; if (e.target.closest('[data-back]:not(.modal-back)')) m.el.querySelector('#lvl').innerHTML = '<h2>Level one</h2><button class="btn" data-next>Deeper</button>'; }); });
  await page.click('#modal-root [data-next]'); await page.locator('#modal-root .modal-back').click(); await page.waitForTimeout(80);
  check(await page.locator('#modal-root .scrim').count() === 1 && /Level one/.test(await page.locator('#modal-root .modal').innerText()), `${label}: Back steps out one level at a time`);
  await page.locator('#modal-root .modal-back').click(); await page.waitForTimeout(80);
  check(!(await page.locator('#modal-root .scrim').count()), `${label}: and leaves the page from the first`);
  // My Neighborhood, opened from Pursuits.
  await page.locator('[data-tab="pursuits"]').click(); await page.waitForTimeout(200);
  if (await page.locator('[data-go="neighborhood"]').count()) {
    await page.click('[data-go="neighborhood"]'); await page.waitForTimeout(250);
    const ways = await page.evaluate(() => [...document.querySelectorAll('#modal-root .modal')].pop()?.querySelectorAll('.modal-back').length ?? 0);
    check(ways >= 1, `${label}: My Neighborhood has a Back button`);
  }
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  // A person's profile (it used to have no way back at the top), the health hub, and settings.
  await page.evaluate(() => document.querySelector('.tab-btn[data-tab="people"]')?.click()); await page.waitForTimeout(250);
  const row = page.locator('[data-npc]');
  if (await row.count()) {
    await page.evaluate(() => document.querySelector('[data-npc]').click()); await page.waitForTimeout(300);
    check(await page.locator('#modal-root .modal-back').count() === 1 && await inView(page), `${label}: a person's profile has a Back button in view`);
    const groups = await page.evaluate(() => ({ all: document.querySelectorAll('#modal-root details.action-group').length, open: document.querySelectorAll('#modal-root details.action-group[open]').length }));
    check(groups.all >= 2 && groups.open === 1, `${label}: a profile's actions are in groups, one open (${groups.all} groups, ${groups.open} open)`);
    await page.evaluate(() => { const m = [...document.querySelectorAll('#modal-root .modal')].pop(); m.scrollTop = m.scrollHeight; });
    await page.waitForTimeout(120);
    check(await inView(page), `${label}: and still in view at the bottom of their profile`);
    await page.locator('#modal-root .modal-back').last().click(); await page.waitForTimeout(150);
    check(!(await page.locator('#modal-root .scrim').count()), `${label}: Back leaves the profile`);
  }
  check(!errors.length, `${label}: no errors in the page (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'Every page has a way out.');
process.exit(problems.length ? 1 : 0);
