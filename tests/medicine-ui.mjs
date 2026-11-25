// Browser check of My Medical Career at phone and desktop widths: the Work tab offers it, the overview shows a
// resident's year, every section fits without sideways scrolling, and a patient case can be worked to an outcome.
// Needs Playwright (preinstalled where the checks run). Serves the game itself. Run with: node tests/medicine-ui.mjs
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
  // A twenty-six-year-old US medical graduate, starting an internal medicine residency.
  const buttons = await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const p = store.state.player;
    p.countryId = 'us'; p.city = (await import('/js/data/countries.js')).COUNTRIES.us.cities[0];
    p.age = 26; p.birthYear = store.state.year - 26; p.legal.incarceration = null;
    p.education.enrolled = false; p.education.stage = 'none';
    p.education.degrees.push({ type: 'university', majorId: 'biology', gpa: 3.8, age: 22 }, { type: 'medical', gpa: 3.6, age: 26 });
    const core = await import('/js/engine/medicine/core.js');
    const train = await import('/js/engine/medicine/training.js');
    const { trainingSites } = await import('/js/engine/medicine/hospitals.js');
    const m = core.M(p);
    m.route = 'md'; m.stage = 'graduate'; m.school = { name: 'medical school', year: 4, rotations: [], exams: {}, interest: {}, apply: [], graduated: true };
    train.startTraining('residency', 'internal', trainingSites('internal', p.countryId, p.city)[0].e.id);
    const { careerButtons } = await import('/js/ui/tabs/workCareer.js');
    const { openMedicine } = await import('/js/ui/medicine.js');
    window.__api = { changed() {}, rerender() {} };
    openMedicine(window.__api);
    return careerButtons().map((b) => b[1]);
  });
  check(buttons.includes('My Medical Career'), `${label}: the Work tab offers My Medical Career`);
  const modal = '#modal-root .scrim:last-child .modal';
  await page.waitForSelector(modal);
  const overflow = () => page.evaluate(() => { const m = [...document.querySelectorAll('#modal-root .modal')].pop(); return m.scrollWidth > m.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth; });
  const text = () => page.evaluate(() => [...document.querySelectorAll('#modal-root .modal')].pop().innerText);
  check(/Resident, PGY-1 of 3/i.test(await text()), `${label}: the overview shows the residency year`);
  check(!(await overflow()), `${label}: the overview does not scroll sideways`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/medicine-${label}-overview.png` });
  for (const sec of ['training', 'hospital', 'people']) {
    await page.click(`${modal} [data-sec="${sec}"]`);
    check(!(await overflow()), `${label}: ${sec} does not scroll sideways`);
  }
  await page.click(`${modal} [data-sec="patients"]`);
  check(/This year's patients \(3\)/i.test(await text()), `${label}: a resident has three patients this year`);
  // Work the first case: a test, a diagnosis, a plan.
  await page.locator(`${modal} [data-act="case"]`).first().click();
  await page.waitForTimeout(100);
  const caseModal = '#modal-root .scrim:last-child .modal';
  check(/Confidential · supervised/i.test(await text()), `${label}: a resident's case is confidential and supervised`);
  const triage = page.locator(`${caseModal} [data-act="triage"]`);
  if (await triage.count()) await triage.first().click();
  await page.locator(`${caseModal} [data-act="test"]:not([disabled])`).first().click();
  await page.locator(`${caseModal} [data-act="dx"]`).first().click();
  await page.locator(`${caseModal} [data-act="plan"]:not([disabled])`).first().click();
  const decide = page.locator(`${caseModal} [data-act="decide"]`);
  if (await decide.count()) await decide.first().click();
  check(/Outcome/i.test(await text()), `${label}: the case reaches an outcome`);
  check(!(await overflow()), `${label}: the case does not scroll sideways`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/medicine-${label}-case.png`, fullPage: false });
  check(!errors.length, `${label}: no errors in the page (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'My Medical Career works on a phone and a desktop.');
process.exit(problems.length ? 1 : 0);
