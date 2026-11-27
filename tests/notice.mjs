// The notice before the title screen: every time the game opens, the words (fiction; not advice) for a moment, then
// the title screen by itself; a tap moves on at once; no heading or button; Settings → About From Birth shows the words
// again. Needs Playwright. Run with: node tests/notice.mjs. Set SHOT=/some/dir for screenshots.
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
for (const [label, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 }); // one device: tabs share its saves
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // The game opening (the address asks for the notice, as an automated browser would otherwise skip it).
  await page.goto(`http://localhost:${port}/index.html?notice`);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.waitForSelector('[data-notice]');
  const text = await page.innerText('[data-notice]');
  check(/fictional/.test(text) && /coincidental/.test(text) && /not medical, legal or financial advice|Nothing here is medical, legal or financial advice/.test(text), `${label}: fiction, and not advice`);
  check(!(await page.$('[data-notice] h1, [data-notice] button')) && !/just so you know/i.test(text), `${label}: no heading, no button`);
  check(!(await page.$('[data-random]')) && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: before the title screen, fitting the screen`);
  if (process.env.SHOT) { await page.waitForTimeout(500); await page.screenshot({ path: `${process.env.SHOT}/notice-${label}.png` }); }
  // It moves on by itself.
  await page.waitForSelector('[data-random]', { timeout: 6000 });
  check(!(await page.$('[data-notice]')), `${label}: then the title screen, by itself`);
  // A tab that was only away (the phone put it to sleep and brought it back: the page loads again, the session kept)
  // comes back without the notice, to the life.
  await page.click('[data-random]');
  await page.waitForSelector('[data-year]');
  const name = await page.evaluate(async () => (await import('/js/state.js')).store.state.player.firstName);
  await page.goto(`http://localhost:${port}/index.html?notice`); // a load that is not a refresh, in the same tab
  await page.waitForSelector('[data-year]', { timeout: 5000 });
  check(!(await page.$('[data-notice]')) && await page.evaluate(async () => (await import('/js/state.js')).store.state.player.firstName) === name, `${label}: a tab brought back skips the notice and goes straight back to the life (${name})`);
  // A refresh is an opening like any other: the notice, then the title screen.
  await page.reload();
  await page.waitForSelector('[data-notice]');
  await page.click('[data-notice]');
  await page.waitForSelector('[data-random]');
  check(!(await page.$('[data-year]')), `${label}: a refresh opens afresh: the notice, then the title screen`);
  // Opening the game afresh (a new tab: a new session): the notice again, and a tap moves on at once.
  const fresh = await ctx.newPage(); // a new tab, same device: the saves are there, the session is not
  await fresh.goto(`http://localhost:${port}/index.html?notice`);
  await fresh.waitForSelector('[data-notice]');
  const t0 = Date.now();
  await fresh.click('[data-notice]');
  await fresh.waitForSelector('[data-random]', { timeout: 1000 });
  check(Date.now() - t0 < 1000, `${label}: opened afresh, the notice again, and a tap moves on at once`);
  check(await fresh.$$eval('[data-load]', (x) => x.length) >= 1, `${label}: and the title screen lists the life to carry on`);
  await fresh.close();
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-random]');
  // Settings → About From Birth shows the words again.
  await page.click('[data-settings]');
  await page.locator('#modal-root .choice-btn', { hasText: 'About From Birth' }).click();
  await page.waitForTimeout(100);
  const about = await page.evaluate(() => [...document.querySelectorAll('#modal-root .modal')].pop().innerText);
  check(/About From Birth/i.test(about) && /fictional/.test(about), `${label}: Settings shows it again`);
  // An automated browser (the other checks) goes straight to the title screen.
  const plain = await browser.newPage({ viewport });
  await plain.goto(`http://localhost:${port}/index.html`);
  check(!(await plain.$('[data-notice]')), `${label}: automated checks start at the title screen`);
  await plain.waitForSelector('[data-random]');
  await plain.close();
  check(!errors.length, `${label}: no page errors (${errors.join('; ')})`);
  await ctx.close();
}
await browser.close();
server.close();
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('A moment of fine print, then the game.');
