// Browser check: someone with a special career opens it straight from the Work row, without going through Special
// careers; the job details are one row further. Run with: node tests/work-direct-ui.mjs
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
const check = (c, m) => { if (!c) problems.push(m); console.log(`${c ? ' ✓' : ' ✗'} ${m}`); };
const browser = await chromium.launch();
for (const [label, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.evaluate(() => localStorage.setItem('frombirth.birthGlobe', 'off')); await page.click('[data-random]'); await page.waitForSelector('[data-year]');
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const special = await import('/js/engine/specialCareer.js');
    const p = store.state.player; p.age = 24; p.birthYear = store.state.year - 24; p.legal.incarceration = null;
    special.claim('music');
    store.notify();
  });
  await page.evaluate(() => document.querySelector('.tab-btn[data-tab="work"]').click()); await page.waitForTimeout(250);
  if (label === 'phone') {
    // Every special career's row, the law and medicine included, in one list, each description read in full.
    await page.evaluate(() => [...document.querySelectorAll('.sec-row')].find((x) => /Special Careers/i.test(x.innerText))?.click()); await page.waitForTimeout(250);
    const cut = await page.evaluate(() => [...document.querySelectorAll('.nav-row .nr-main small')].filter((s) => s.offsetParent && s.scrollWidth > s.clientWidth + 1).map((s) => s.innerText));
    check(!cut.length, `${label}: no special career's description is cut off (${cut.join('; ')})`);
    check(!/training and ranks/i.test(await page.locator('body').innerText()), `${label}: one list, not two`);
    await page.evaluate(() => document.querySelector('.tab-btn[data-tab="self"]').click()); await page.waitForTimeout(150);
    await page.evaluate(() => document.querySelector('.tab-btn[data-tab="work"]').click()); await page.waitForTimeout(250);
  }
  const direct = page.locator('.sec-row[data-act="sc:music"]');
  check(await direct.count() >= 1 && /Music/.test(await direct.first().innerText()) && /Your career/.test(await direct.first().innerText()), `${label}: the Work row is the special career, by name`);
  check(/🎸/.test(await direct.first().innerText()) && !/^\s*My /m.test(await direct.first().innerText()), `${label}: with the field's picture, and no "My" in the name`);
  check(await page.locator('.sec-row', { hasText: 'Job Details' }).count() === 1, `${label}: the job's details are one row further`);
  await direct.first().click(); await page.waitForTimeout(300);
  check(await page.locator('#modal-root .modal').count() >= 1, `${label}: one tap opens the career's own screen`);
  // Without a special career, Work is the job as before.
  await page.evaluate(async () => { document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()); const { store } = await import('/js/state.js'); const special = await import('/js/engine/specialCareer.js'); special.leave(); store.notify(); });
  await page.evaluate(() => document.querySelector('.tab-btn[data-tab="self"]').click()); await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('.tab-btn[data-tab="work"]').click()); await page.waitForTimeout(250);
  check(await page.locator('.sec-row[data-act^="sc:"]').count() === 0, `${label}: without one, no special career row`);
  const youLabel = () => page.evaluate(() => [...document.querySelectorAll('.section-label')].some((x) => /^you$/i.test(x.innerText.trim())));
  const workRow = () => page.locator('.sec-row[data-sec="Work"]').first();
  // Out of work: nothing at the top for a job that is not there.
  const unemployed = await page.evaluate(async () => { const { store } = await import('/js/state.js'); return !store.state.player.career.careerId; });
  if (unemployed) check(!(await workRow().isVisible().catch(() => false)) || !/Performance/.test(await workRow().innerText()), `${label}: unemployed, no job row with a bar`);
  // A job: it is the first row, named for the job, with how it is going as a bar.
  await page.evaluate(async () => { const { store } = await import('/js/state.js'); const career = await import('/js/engine/career.js'); const { CAREERS } = await import('/js/data/careers.js'); career.hire(CAREERS.find((c) => c.id === 'retail') ?? CAREERS[0], 0, 60, 'test'); store.notify(); });
  await page.evaluate(() => document.querySelector('.tab-btn[data-tab="self"]').click()); await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('.tab-btn[data-tab="work"]').click()); await page.waitForTimeout(250);
  const title = await page.evaluate(async () => { const { store } = await import('/js/state.js'); return store.state.player.career.title; });
  const first = page.locator('.sec-row:visible').first();
  check(await youLabel() && (await first.getAttribute('data-sec')) === 'Work' && new RegExp(title, 'i').test(await first.innerText()) && await first.locator('.nr-bar[aria-label="Performance"]').count() === 1, `${label}: a job is the first row under You, named "${title}", with a performance bar`);
  check(!errors.length, `${label}: no page errors (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log('A special career is one tap from Work.');
