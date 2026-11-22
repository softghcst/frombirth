// Browser check of the yearly model at phone and desktop widths: the "Your life
// this year" card, setting a plan, Age Up, and the yearly life update.
// Needs Playwright (preinstalled where the checks run). Serves the game itself.
// Run with: node tests/yearly-ui.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

/** Opens a section of the tab on screen: each card on a tab is a row until it is tapped. */
async function openSection(page, title) {
  if (await page.locator('.sec-body.shown').count()) await page.click('[data-panel-close]');
  // A card with a single action is that action, with no section to open.
  if (await page.locator(`.sec-row[data-sec="${title}"]`).count()) await page.locator(`.sec-row[data-sec="${title}"]`).click();
}
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
for (const [label, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('[data-random]');
  await page.waitForSelector('[data-year]');
  const update = () => page.locator('.modal h2', { hasText: '→' }).count();
  const ok = async () => { while ((await page.locator('[data-ok]').count()) && !(await update())) { await page.locator('[data-ok]').last().click(); await page.waitForTimeout(120); } };
  const clear = async () => { for (let i = 0; i < 12 && (await page.locator('.modal .choice-btn:not([disabled])').count()); i++) { await page.locator('.modal .choice-btn:not([disabled])').first().click(); await page.waitForTimeout(120); await ok(); } };
  await clear();
  await page.evaluate(async () => {
    const S = await import('/js/state.js');
    const p = S.store.state.player;
    p.age = 30; p.birthYear = S.store.state.year - 30; p.flags.livesWithParents = false; p.education.enrolled = false; p.finance.cash = 40000 * S.country().currency.scale;
    S.store.state.pendingEvents = [];
    S.store.state.settings = { ...(S.store.state.settings ?? {}), yearSummary: true }; // after each year only when turned on
  });
  await page.locator('[data-tab="pursuits"]').click(); await page.waitForTimeout(150);
  await openSection(page, 'Your life this year');
  check(await page.locator('[data-year-plan="hobby"]').count(), `${label}: the This Year card is on Pursuits`);
  await page.locator('[data-year-plan="hobby"]').click(); await page.waitForTimeout(150);
  await page.locator('.modal .choice-btn', { hasText: 'Swimming' }).first().click(); await page.waitForTimeout(150);
  await page.locator('.modal [data-cancel]').last().click(); await page.waitForTimeout(150);
  await ok();
  check(await page.locator('.card', { hasText: 'Your life this year' }).locator('text=Swimming').count(), `${label}: the hobby plan shows as ongoing`);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(wide, `${label}: no sideways scrolling`);
  await page.locator('[data-panel-close]').click(); await page.locator('[data-panel-close]').click(); // back from the section, then from Pursuits
  await page.locator('[data-year]').click(); await page.waitForTimeout(400);
  let saw = false;
  for (let i = 0; i < 15 && !saw; i++) {
    if (await update()) { saw = true; break; }
    await ok();
    if (await page.locator('.modal .choice-btn:not([disabled])').count()) await page.locator('.modal .choice-btn:not([disabled])').first().click();
    await page.waitForTimeout(150);
  }
  check(saw, `${label}: the yearly life update appears after Age Up`);
  if (saw) {
    check(await page.locator('.modal', { hasText: 'Swimming' }).count(), `${label}: the update reports the hobby practiced through the year`);
  }
  // And it can be looked back on at any time, from Your life this year.
  while (await page.locator('#modal-root .scrim').count()) { const b = page.locator('#modal-root .scrim:last-child [data-ok], #modal-root .scrim:last-child .choice-btn:not([disabled])'); if (!(await b.count())) break; await b.first().click(); await page.waitForTimeout(120); }
  await page.locator('[data-tab="pursuits"]').click(); await page.waitForTimeout(150);
  await openSection(page, 'Your life this year');
  await page.locator('[data-year-plan="lookback"]').click(); await page.waitForTimeout(200);
  check(await update(), `${label}: last year can be looked back on from Your life this year`);
  await page.locator('#modal-root [data-ok]').last().click(); await page.waitForTimeout(120);
  check(!errors.length, `${label}: no page errors (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('The yearly screens work at phone and desktop widths.');
