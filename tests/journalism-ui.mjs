// Browser check of the Journalism career at phone and desktop widths: the Work tab lists it, the newsrooms can be
// applied to, a story notebook shows claims, sources and records (closed ones refused), and everything fits.
// Needs Playwright (preinstalled where the checks run). Serves the game itself. Run with: node tests/journalism-ui.mjs
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
for (const [label, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: label === 'phone' ? 2 : 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('[data-random]');
  await page.waitForSelector('[data-year]');
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const p = store.state.player;
    p.countryId = 'us'; p.city = (await import('/js/data/countries.js')).COUNTRIES.us.cities[0];
    p.age = 23; p.birthYear = store.state.year - 23; p.legal.incarceration = null; p.career.careerId = null;
    p.education.enrolled = false; p.education.stage = 'none';
    p.education.degrees.push({ type: 'university', majorId: 'journalism', gpa: 3.5, age: 22 });
    store.notify();
  });
  // The Work tab lists Journalism among the special careers.
  await page.click('.tab-btn[data-tab="work"]'); await page.waitForTimeout(200);
  await page.click('.sec-row[data-sec="Special careers"]'); await page.waitForTimeout(200);
  check(await page.locator('[data-act="sc:journalism"]').count() === 1, `${label}: Journalism is a special career on the Work tab`);
  await page.click('[data-act="sc:journalism"]'); await page.waitForTimeout(300);
  check(await page.locator('#modal-root .modal-full').count() === 1 && /Newsrooms in/i.test(await page.locator('#modal-root .modal').last().innerText()), `${label}: the page lists the city's newsrooms`);
  // Apply until a newsroom hires (a new year each round, as in play). Hiring is a roll: enough rounds that an
  // unlucky run of them does not fail the check.
  for (let i = 0; i < 30; i++) {
    const hired = await page.evaluate(async () => (await import('/js/engine/journalism.js')).isReporter());
    if (hired) break;
    const b = page.locator('#modal-root [data-act="apply"]:not([disabled])').first();
    if (await b.count()) { await b.click(); await page.waitForTimeout(150); await page.locator('#modal-root .scrim:last-child [data-ok], #modal-root .scrim:last-child .btn.primary').last().click().catch(() => {}); await page.waitForTimeout(150); }
    else await page.evaluate(async () => { const { store } = await import('/js/state.js'); store.state.year += 1; });
    await page.locator('#modal-root [data-tab="overview"]').click().catch(() => {}); await page.waitForTimeout(100);
  }
  check(await page.evaluate(async () => (await import('/js/engine/journalism.js')).isReporter()), `${label}: a newsroom hires the player`);
  await page.locator('#modal-root [data-tab="assignments"]').click(); await page.waitForTimeout(200);
  check(await page.locator('#modal-root [data-act="story"]').count() >= 2, `${label}: assignments are listed`);
  await page.locator('#modal-root [data-act="story"]').first().click(); await page.waitForTimeout(200);
  const text = await page.locator('#modal-root .modal').last().innerText();
  check(/Claims/i.test(text) && /Sources/i.test(text) && /Records/i.test(text) && /Not checked/i.test(text), `${label}: the notebook shows claims (not yet checked), sources and records`);
  const read = page.locator('#modal-root [data-act="read"]').first();
  await read.click(); await page.waitForTimeout(200);
  check(/confirms|does not bear out|not available|Sealed|stay sealed/i.test(await page.locator('#modal-root .scrim:last-child').innerText()), `${label}: reading a record reports what it shows`);
  await page.locator('#modal-root .scrim:last-child [data-ok], #modal-root .scrim:last-child .btn.primary').last().click().catch(() => {}); await page.waitForTimeout(150);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${label}: nothing scrolls sideways`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/journalism-${label}.png` });
  // An editor's desk: reporters' drafts to approve, send back or spike.
  await page.evaluate(async () => { const { store } = await import('/js/state.js'); store.state.player.career.level = 3; });
  await page.evaluate(() => document.querySelector("#modal-root [data-back]").click()); await page.waitForTimeout(200);
  await page.locator('#modal-root [data-tab="overview"]').click(); await page.waitForTimeout(200);
  check(/Your desk/i.test(await page.locator('#modal-root .modal').last().innerText()) && await page.locator('#modal-root [data-act="desk"]').count() === 9, `${label}: an editor sees three drafts, each to decide`);
  await page.locator('#modal-root [data-act="desk"]').nth(1).click(); await page.waitForTimeout(200);
  await page.locator('#modal-root .scrim:last-child [data-ok], #modal-root .scrim:last-child .btn.primary').last().click().catch(() => {}); await page.waitForTimeout(150);
  check(/Sent back/i.test(await page.locator('#modal-root .modal').last().innerText()), `${label}: the decision is recorded`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/journalism-desk-${label}.png`, fullPage: true });
  await page.locator('#modal-root [data-tab="career"]').click(); await page.waitForTimeout(200);
  check(await page.locator('#modal-root [data-act="takeleave"]').count() === 1, `${label}: leave can be taken from the Career tab`);
  check(!errors.length, `${label}: no page errors (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
if (problems.length) { console.log(`${problems.length} problem(s):\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log('The newsroom works in the browser.');
