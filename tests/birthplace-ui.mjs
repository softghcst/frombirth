// Choosing where to be born, in the life designer: a country, then (for a country with many cities: the US, China, India,
// Japan, Brazil, Russia, Indonesia, Mexico, Germany) its state, province or prefecture and the cities in it,
// or, everywhere else, one list of cities. And moving city in the US: a state, then its cities.
// Needs Playwright. Run with: node tests/birthplace-ui.mjs
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
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.click('[data-design]');
  await page.waitForSelector('#f-country');
  const shown = (sel) => page.locator(sel).isVisible();
  check(!(await shown('#f-region')) && !(await shown('#f-city')), `${label}: nothing below the country until one is chosen`);
  await page.selectOption('#f-country', 'us'); await page.waitForTimeout(80);
  const states = await page.locator('#f-region option').allInnerTexts();
  check(await shown('#f-region') && /State/.test(await page.locator('[data-region-label]').innerText()) && states.length === 52, `${label}: the United States asks for a state (${states.length - 1} with D.C.)`);
  check(!(await shown('#f-city')), `${label}: and the city waits for the state`);
  await page.selectOption('#f-region', 'California'); await page.waitForTimeout(80);
  const ca = (await page.locator('#f-city option').allInnerTexts()).slice(1);
  check(await shown('#f-city') && ['Los Angeles', 'San Diego', 'San Francisco'].every((x) => ca.includes(x)) && ca.length === 3, `${label}: California's cities (${ca})`);
  await page.selectOption('#f-region', 'Alaska'); await page.waitForTimeout(80);
  check(await page.locator('#f-city').inputValue() === 'Anchorage', `${label}: a state with one city has it chosen`);
  await page.selectOption('#f-country', 'nz'); await page.waitForTimeout(80);
  const nzOpts = await page.locator('#f-city option').allInnerTexts();
  check(!(await shown('#f-region')) && /^city$/i.test((await page.locator('[data-city-label]').innerText()).trim()) && nzOpts.includes('Auckland') && !nzOpts.some((x) => x.includes(':')), `${label}: a country with a handful of cities is one list (${nzOpts.slice(0, 3)})`);
  // Big countries with many cities ask for the region first too: Japan by prefecture.
  await page.selectOption('#f-country', 'jp'); await page.waitForTimeout(80);
  check(await shown('#f-region') && /Prefecture/.test(await page.locator('[data-region-label]').innerText()), `${label}: Japan asks for the prefecture`);
  await page.selectOption('#f-region', 'Hokkaido'); await page.waitForTimeout(80);
  const hk = (await page.locator('#f-city option').allInnerTexts()).slice(1);
  check(hk.includes('Sapporo') && hk.includes('Hakodate') && hk.length === 2, `${label}: then Hokkaido's cities (${hk})`);
  for (const [id, word] of [['uk', 'Country'], ['fr', 'Region'], ['ca', 'Province'], ['au', 'State'], ['ng', 'State'], ['pk', 'Province'], ['ph', 'Region'], ['eg', 'Governorate'], ['kr', 'Province'], ['it', 'Region'], ['es', 'Region'], ['tr', 'Province'], ['cn', 'Province'], ['in', 'State'], ['br', 'State'], ['ru', 'Region'], ['id', 'Province'], ['mx', 'State'], ['de', 'State']]) {
    await page.selectOption('#f-country', id); await page.waitForTimeout(60);
    check(await shown('#f-region') && new RegExp(word).test(await page.locator('[data-region-label]').innerText()), `${label}: ${id} asks for the ${word.toLowerCase()} first`);
  }
  await page.selectOption('#f-country', 'eg'); await page.waitForTimeout(80);
  check((await page.locator('[data-city-label]').innerText()).trim().toLowerCase() === 'city', `${label}: a country without regions in the game just asks for the city`);
  // A state chosen, its city left to chance: born in that state.
  await page.selectOption('#f-country', 'us'); await page.waitForTimeout(80);
  await page.selectOption('#f-region', 'Texas'); await page.waitForTimeout(80);
  await page.click('form [type="submit"]');
  await page.waitForSelector('[data-year]');
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  const city = await page.evaluate(async () => (await import('/js/state.js')).store.state.player.city);
  check(['Austin', 'Houston', 'Dallas'].includes(city), `${label}: born in Texas (${city})`);
  // Moving city: the state first, then its cities.
  await page.evaluate(async () => { const S = await import('/js/state.js'); const p = S.store.state.player; p.age = 30; p.flags.livesWithParents = false; p.education.enrolled = false; p.finance.cash = 1e6;
    const L = await import('/js/ui/leisure.js'); window.__move = L.moveCity({ changed() {} }); });
  await page.waitForSelector('#modal-root select#m-pick');
  const opts = await page.locator('#modal-root select#m-pick option').allInnerTexts();
  check(/State/.test(await page.locator('#modal-root .pick-field label').innerText()) && opts.some((x) => /^California \(3 cities\)$/i.test(x)) && opts.length >= 50, `${label}: moving asks for the state first (${opts.length})`);
  await page.selectOption('#modal-root select#m-pick', String(opts.findIndex((x) => /^California/i.test(x))));
  await page.locator('#modal-root [data-go]').click(); await page.waitForTimeout(150);
  const cities = await page.locator('#modal-root .modal').last().locator('.choice-btn').allInnerTexts();
  check(cities.length === 3 && cities.some((x) => /^Los Angeles/.test(x)) && cities.every((x) => /homes/.test(x)), `${label}: then California's cities, each compared with home`);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(over <= 1, `${label}: nothing runs off the side`);
  check(!errors.length, `${label}: no page errors (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
if (problems.length) { console.log(`PROBLEMS:\n${problems.map((p) => ` - ${p}`).join('\n')}`); process.exit(1); }
console.log('Birthplace: country, then region and city in the big countries, or a list of cities.');
