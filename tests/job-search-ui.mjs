// Browser check of finding ordinary work at phone and desktop widths: Find work opens a recruiter card and this year's
// short list (no filters, not the whole market); the recruiter shows one opening at a time, three looks a year, then
// no more; tapping an opening on the list offers to apply. Needs Playwright (preinstalled where the checks run).
// Serves the game itself. Run with: node tests/job-search-ui.mjs
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
    p.age = 24; p.birthYear = store.state.year - 24; p.legal.incarceration = null; p.career.careerId = null; p.royal = null;
    p.education.enrolled = false; p.education.stage = 'none'; p.flags.livesWithParents = false;
    if (!p.education.degrees.some((d) => d.type === 'high')) p.education.degrees.push({ type: 'high', gpa: 3.2, age: 18 });
    store.notify();
  });
  await page.click('.tab-btn[data-tab="work"]'); await page.waitForTimeout(200);
  await page.locator('[data-act="findwork"]').first().click(); await page.waitForTimeout(300);
  const modal = page.locator('#modal-root .modal').last();
  const text = await modal.innerText();
  check(/Job recruiter/i.test(text) && /Openings this year/i.test(text), `${label}: Find work shows the recruiter and this year's openings`);
  check(await modal.locator('[data-act="filter"], [data-act="family"], [data-sec]').count() === 0, `${label}: Find work opens the page alone: no filter chips and no row of sections`);
  const rows = await modal.locator('.nav-row[data-act="posting"]').count();
  check(rows >= 6 && rows <= 16, `${label}: about a dozen openings (${rows})`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/job-search-${label}.png` });

  // The recruiter: three looks, then no more.
  await modal.locator('[data-act="recruiter"]').click(); await page.waitForTimeout(200);
  const pitch = page.locator('#modal-root .scrim:last-child .modal');
  check(/look 1 of 3/i.test(await pitch.innerText()), `${label}: the recruiter brings a first opening`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/job-recruiter-${label}.png` });
  await pitch.locator('[data-go="again"]').click(); await page.waitForTimeout(200);
  check(/look 2 of 3/i.test(await page.locator('#modal-root .scrim:last-child .modal').innerText()), `${label}: another look`);
  await page.locator('#modal-root .scrim:last-child [data-go="again"]').click(); await page.waitForTimeout(200);
  const last = page.locator('#modal-root .scrim:last-child .modal');
  check(/look 3 of 3/i.test(await last.innerText()) && await last.locator('[data-go="again"]').isDisabled(), `${label}: the third look is the last this year`);
  await last.locator('[data-go=""]').click(); await page.waitForTimeout(200);
  check(/No more looks this year/i.test(await page.locator('#modal-root .modal').last().innerText()), `${label}: the card says there are no more looks this year`);

  // Tapping an opening offers to apply.
  await page.locator('#modal-root .nav-row[data-act="posting"]:not([disabled])').first().click(); await page.waitForTimeout(200);
  check(/Apply/.test(await page.locator('#modal-root .scrim:last-child .modal').innerText()), `${label}: an opening on the list can be applied for`);
  await page.locator('#modal-root .scrim:last-child [data-cancel]').click(); await page.waitForTimeout(150);
  // Jobs opens a menu of Work's pages; each opens alone, with a way back to the menu.
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  await page.locator('[data-act="hub"]').first().click(); await page.waitForTimeout(300);
  const menu = page.locator('#modal-root .modal').last();
  check(await menu.locator('.nav-row[data-sec]').count() >= 5 && await menu.locator('.av-chip').count() === 0, `${label}: Jobs opens a menu of Work's pages, not a row of tabs`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/work-menu-${label}.png` });
  await menu.locator('.nav-row[data-sec="find"]').click(); await page.waitForTimeout(200);
  check(/Openings this year/i.test(await menu.innerText()) && await menu.locator('[data-sec]').count() === 0, `${label}: a page from the menu opens alone`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/work-page-${label}.png` });
  await menu.locator('.modal-back').click(); await page.waitForTimeout(200);
  check(await menu.locator('.nav-row[data-sec]').count() >= 5, `${label}: Back returns to the menu`);
  // At school: Find a Job points to part-time work instead of a list of jobs that all wait for the course to end.
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const p = store.state.player;
    p.age = 16; p.birthYear = store.state.year - 16; p.education.enrolled = true; p.education.stage = 'high'; p.flags.jobList = null; p.flags.jobRecruiter = null;
    store.notify();
  });
  await page.evaluate(async () => { const { openOccupation } = await import('/js/ui/occupation.js'); openOccupation({ changed() {} }, 'find'); });
  await page.waitForTimeout(300);
  const school = page.locator('#modal-root .modal').last();
  check(/While you are studying/i.test(await school.innerText()) && await school.locator('.nav-row[data-act="posting"]').count() === 0, `${label}: at school, Find a Job points to part-time work`);
  await school.locator('[data-act="gotopart"]').click(); await page.waitForTimeout(200);
  check(/Part-time/i.test(await school.locator('h2').first().innerText()), `${label}: and opens it`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${label}: nothing scrolls sideways`);
  check(!errors.length, `${label}: no page errors (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
if (problems.length) { console.log(`${problems.length} problem(s):\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log('Finding work works in the browser.');
