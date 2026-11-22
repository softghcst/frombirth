// Browser check of the life designer's dropdowns and royal births, and of the one-form way to kill someone.
//   - Sex, transgender, sexuality and the rest are dropdowns.
//   - Monarchies are listed first; choosing one shows "Born into" right under the country, with that country's titles.
//   - Choosing "Heir to the throne" is born first in line.
//   - Killing someone is one form: who, and how, each a dropdown.
// Needs Playwright (preinstalled where the checks run). Run with: node tests/creator-royal-ui.mjs
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
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('[data-design]');
  await page.waitForSelector('#f-country');
  for (const id of ['f-sex', 'f-trans', 'f-orientation', 'f-talent', 'f-background', 'f-health']) check(await page.locator(`select#${id}`).count() === 1, `${label}: ${id.slice(2)} is a dropdown`);
  check(!(await page.locator('.picker').count()), `${label}: no rows of option buttons left`);
  const first = await page.locator('#f-country optgroup').first().getAttribute('label');
  check(/Monarch/.test(first ?? ''), `${label}: monarchies are listed first (${first})`);
  check(await page.locator('[data-rank-field]').isHidden(), `${label}: "Born into" is hidden until a monarchy is chosen`);
  await page.selectOption('#f-sex', 'female');
  await page.selectOption('#f-country', 'uk');
  await page.waitForTimeout(100);
  check(await page.locator('[data-rank-field]').isVisible(), `${label}: choosing the United Kingdom shows "Born into"`);
  const ranks = await page.locator('#f-birthRank option').allInnerTexts();
  check(ranks.some((x) => /Princess/.test(x)) && ranks.some((x) => /Heir/.test(x)) && ranks.some((x) => /Commoner/.test(x)), `${label}: with that country's titles for a girl (${ranks.join(' | ')})`);
  const pos = await page.evaluate(() => { const a = document.querySelector('#f-country').getBoundingClientRect().top; const b = document.querySelector('#f-birthRank').getBoundingClientRect().top; const c = document.querySelector('#f-city').getBoundingClientRect().top; return a < b && b < c; });
  check(pos, `${label}: "Born into" sits right under the country`);
  if (process.env.SHOT) { await page.locator('#f-country').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${process.env.SHOT}/creator-${label}.png` }); }
  // Japan: only men inherit, so no heir option for a girl.
  await page.selectOption('#f-country', 'jp'); await page.waitForTimeout(80);
  check(!(await page.locator('#f-birthRank option[value="heir"]').count()), `${label}: no "Heir to the throne" for a girl where only men inherit`);
  await page.selectOption('#f-sex', 'male'); await page.waitForTimeout(80);
  check(await page.locator('#f-birthRank option[value="heir"]').count() === 1, `${label}: and it is there for a boy`);
  // Born heir, in the United Kingdom.
  await page.selectOption('#f-country', 'uk'); await page.waitForTimeout(80);
  await page.selectOption('#f-birthRank', 'heir');
  await page.click('form [type="submit"]');
  await page.waitForSelector('[data-year]');
  const royal = await page.evaluate(async () => (await import('/js/state.js')).store.state.player.royal);
  check(royal?.rank === 'heir' && royal.line === 1, `${label}: "Heir to the throne" is born first in line (${JSON.stringify(royal)})`);
  // Killing someone: one form with two dropdowns.
  await page.evaluate(async () => { document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()); const { store } = await import('/js/state.js'); const p = store.state.player; p.age = 25; p.birthYear = store.state.year - 25; p.flags.livesWithParents = false; store.state.pendingEvents = []; store.notify(); });
  await page.waitForTimeout(150);
  if (await page.locator('[data-panel]:not([hidden])').count()) await page.click('[data-panel-close]');
  await page.locator('[data-tab="pursuits"]').click(); await page.waitForTimeout(150);
  const crime = page.locator('[data-crime]');
  if (await page.locator('.sec-row[data-sec="Crime"]').count()) { await page.locator('.sec-row[data-sec="Crime"]').click(); await page.waitForTimeout(150); }
  if (await crime.count()) {
    await crime.first().click(); await page.waitForTimeout(150);
    await page.locator('.modal .choice-btn', { hasText: 'Kill someone' }).click(); await page.waitForTimeout(150);
    check(await page.locator('.modal select#k-who').count() === 1 && await page.locator('.modal select#k-how').count() === 1, `${label}: killing someone is one form with a who and a how`);
    const ways = await page.locator('#k-how option').allInnerTexts();
    check(ways.some((x) => /dirty rag/.test(x)) && ways.some((x) => /wedgie/i.test(x)), `${label}: silly ways among the serious ones`);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/kill-${label}.png` });
    await page.selectOption('#k-how', 'dirty_rag');
    await page.click('.modal [data-go]'); await page.waitForTimeout(250);
    const text = await page.locator('.modal').last().innerText();
    check(/rag|witnesses|goes wrong/i.test(text), `${label}: doing it says what happened (${text.slice(0, 120)})`);
  } else check(false, `${label}: the crime button is on Pursuits`);
  check(!errors.length, `${label}: no errors in the page (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'Dropdowns, crowns and a quick way to kill.');
process.exit(problems.length ? 1 : 0);
