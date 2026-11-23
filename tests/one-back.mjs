// Browser check: one way back, never two. A page opened in a window gets the window's "‹ Back" only while it shows no
// back button of its own; a place's page ("← All places") has just its own, and the list of places has just the window's.
// Needs Playwright (preinstalled where the checks run). Serves the game itself. Run with: node tests/one-back.mjs
// Set SHOT=/some/dir for screenshots.
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${port}/index.html`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.click('[data-random]');
await page.waitForSelector('[data-year]');
await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
const backs = () => page.evaluate(() => {
  const m = [...document.querySelectorAll('#modal-root .modal')].pop();
  const shown = (b) => b.getClientRects().length > 0;
  return { window: [...m.querySelectorAll('.modal-back')].filter(shown).length, own: [...m.querySelectorAll('[data-back]:not(.modal-back)')].filter(shown).length };
});

// The world: the list of places has the window's Back; a place has only "← All places".
await page.evaluate(async () => { (await import('/js/ui/world.js')).openWorld(); });
await page.waitForSelector('#modal-root .modal [data-search]');
let b = await backs();
check(b.window === 1 && b.own === 0, `the list of places has one Back, the window's (${JSON.stringify(b)})`);
await page.locator('#modal-root .modal [data-search]').fill('Bangladesh');
await page.waitForTimeout(200);
await page.locator('#modal-root .modal .world-list button, #modal-root .modal .world-list [role=button], #modal-root .modal .world-list .world-row').first().click();
await page.waitForTimeout(200);
b = await backs();
check(b.window === 0 && b.own === 1, `a place shows only "← All places", not a second Back above it (${JSON.stringify(b)})`);
if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/place.png` });
await page.locator('#modal-root .modal [data-back]:not(.modal-back)').click();
await page.waitForTimeout(200);
b = await backs();
check(b.window === 1 && b.own === 0, `back on the list, the window's Back returns (${JSON.stringify(b)})`);
await page.locator('#modal-root .modal .modal-back').click();
await page.waitForTimeout(200);
check(await page.locator('#modal-root .modal').count() === 0, 'and it closes the window');

// Explore the World: its first page has the window's Back; a trip opened from it has only its own "← Back".
await page.evaluate(async () => { (await import('/js/ui/globalLife.js')).openExplore({ changed() {}, rerender() {} }); });
await page.waitForSelector('.gl-modal');
b = await backs();
check(b.window === 1 && b.own === 0, `Explore the World's first page has one Back (${JSON.stringify(b)})`);
await page.locator('.gl-modal [data-section], .gl-modal button', { hasText: 'Plan a Trip' }).first().click();
await page.waitForTimeout(200);
b = await backs();
check(b.window + b.own === 1, `every page in it has exactly one Back (${JSON.stringify(b)})`);
check(!errors.length, `no page errors (${errors.join('; ')})`);
await browser.close();
server.close();
if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log('One way back on every page: the window\'s Back only where the page has none of its own.');
