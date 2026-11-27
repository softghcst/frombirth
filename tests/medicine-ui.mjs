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
  await page.evaluate(() => localStorage.setItem('pathways.birthGlobe', 'off')); await page.click('[data-random]');
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
  check(/Trainee doctor, year 1 of 3/i.test(await text()) && /Every patient has a story/i.test(await text()), `${label}: the overview shows the residency year, under its subtitle`);
  check(!(await overflow()), `${label}: the overview does not scroll sideways`);
  check(await page.locator('#modal-root .scrim:last-child .modal.modal-full').count() === 1 && /My Medical Career/.test(await page.locator('#modal-root .scrim:last-child .modal-bartitle').innerText()), `${label}: My Medical Career is a full screen, its name in the bar with Back`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/medicine-${label}-overview.png` });
  const tabs = await page.locator(`${modal} [data-sec]`).evaluateAll((els) => els.map((x) => x.dataset.sec));
  check(['overview', 'training', 'active', 'hospital', 'history'].every((t) => tabs.includes(t)) && tabs.length <= 6 && !/My Clinic/.test(await text()), `${label}: a resident sees a handful of tabs, and no clinic (${tabs.join(', ')})`);
  for (const sec of tabs) {
    await page.click(`${modal} [data-sec="${sec}"]`);
    check(!(await overflow()), `${label}: ${sec} does not scroll sideways`);
  }
  // Hospital Life: every hub tab.
  await page.click(`${modal} [data-sec="hospital"]`);
  const hubs = await page.locator(`${modal} [data-hub]`).evaluateAll((els) => els.map((x) => x.dataset.hub));
  check(['department', 'colleagues', 'patients', 'training', 'stories'].every((t) => hubs.includes(t)) && hubs.length <= 7, `${label}: Hospital Life has a handful of tabs (${hubs.join(', ')})`);
  for (const h of hubs) { await page.click(`${modal} [data-hub="${h}"]`); check(!(await overflow()), `${label}: hospital ${h} does not scroll sideways`); }
  await page.click(`${modal} [data-sec="active"]`);
  check(/Active cases \(3 of 3/i.test(await text()), `${label}: a resident has three active cases this year`);
  // Work the first case: a test, a diagnosis, a plan.
  await page.locator(`${modal} [data-act="case"]`).first().click();
  await page.waitForTimeout(100);
  const caseModal = '#modal-root .scrim:last-child .modal';
  check(/Confidential · supervised/i.test(await text()) && /Assessment/i.test(await text()), `${label}: a resident's case is confidential, supervised, and shows its stage`);
  check(await page.locator(`${caseModal} .avatar`).count() > 0, `${label}: the patient has a face`);
  const triage = page.locator(`${caseModal} [data-act="triage"]`);
  if (await triage.count()) await triage.first().click();
  await page.locator(`${caseModal} [data-act="test"]:not([disabled])`).first().click();
  check(/Diagnostic evaluation/i.test(await text()), `${label}: the stage moves with the work`);
  await page.locator(`${caseModal} [data-act="dx"]`).first().click();
  await page.locator(`${caseModal} [data-act="plan"]:not([disabled])`).first().click();
  for (let i = 0; i < 6 && await page.locator(`${caseModal} [data-act="or"]`).count(); i++) await page.locator(`${caseModal} [data-act="or"]`).first().click();
  const decide = page.locator(`${caseModal} [data-act="decide"]`);
  if (await decide.count()) await decide.first().click();
  check(/Outcome/i.test(await text()), `${label}: the case reaches an outcome`);
  const follow = page.locator(`${caseModal} [data-act="follow"]`);
  if (await follow.count()) { await follow.click(); check(/Follow-up booked/i.test(await text()), `${label}: a follow-up can be arranged`); }
  check(!(await overflow()), `${label}: the case does not scroll sideways`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/medicine-${label}-case.png`, fullPage: false });
  await page.locator(`${caseModal} [data-close]`).click();
  // A colleague's profile from Hospital Life, and Back to the same tab.
  await page.click(`${modal} [data-sec="hospital"]`);
  await page.click(`${modal} [data-hub="colleagues"]`);
  const people = page.locator(`${modal} [data-act="person"]`);
  check(await people.count() > 0, `${label}: hospital life lists the people you train with`);
  if (await people.count()) {
    await people.first().click();
    await page.waitForTimeout(150);
    const all = await page.evaluate(() => [...document.querySelectorAll('#modal-root .modal')].pop().textContent);
    check(/trained together|Supervised your/i.test(all), `${label}: the profile shows what you share`);
    await page.locator('#modal-root .scrim:last-child .modal [data-close]').click();
    await page.waitForTimeout(150);
    check(await page.locator(`${modal} [data-hub="colleagues"].on`).count() === 1, `${label}: Back returns to My Colleagues`);
  }
  await page.click(`${modal} [data-hub="colleagues"]`);
  await page.locator(`${modal} [data-act="colAct"]`).first().click();
  await page.waitForTimeout(100);
  check(/Spend time together/.test(await text()), `${label}: colleagues have actions`);
  await page.locator('#modal-root .scrim:last-child [data-cancel]').click();
  // As a qualified physician: jobs across the country, an employer's profile, an interview; and a clinic.
  await page.evaluate(async () => {
    document.querySelectorAll('#modal-root .scrim').forEach((x) => x.remove());
    const { store } = await import('/js/state.js');
    const m = store.state.player.medicine;
    m.training = null; m.completed.push({ specialtyId: 'internal', kind: 'residency', from: 2000, to: 2003 });
    m.license = { status: 'full', countryId: 'us' }; m.stage = 'practice';
    for (const k of Object.keys(m.skills)) m.skills[k] = 90;
    store.state.player.career.employerId = null;
    const { openMedicine } = await import('/js/ui/medicine.js');
    openMedicine(window.__api, { section: 'hospital', hub: 'jobs' });
  });
  await page.waitForTimeout(150);
  await page.click(`${modal} [data-act="scope"]`);
  check(await page.locator(`${modal} [data-act="post"]`).count() > 1, `${label}: hospital jobs across the country are listed`);
  check(!(await overflow()), `${label}: the jobs list does not scroll sideways`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/medicine-${label}-jobs.png` });
  await page.locator(`${modal} [data-act="review"]`).first().click();
  await page.waitForTimeout(100);
  check(/Departments:/.test(await text()), `${label}: an employer can be reviewed`);
  await page.locator('#modal-root .scrim:last-child .modal button').last().click();
  let interviewed = false;
  for (const b of await page.locator(`${modal} [data-act="post"]:not([disabled])`).all()) {
    await b.click(); await page.waitForTimeout(80);
    await page.locator('#modal-root .scrim:last-child .modal button').last().click(); await page.waitForTimeout(80);
    if (await page.locator(`${modal} [data-act="answer"]`).count()) { interviewed = true; break; }
  }
  check(interviewed, `${label}: an application can lead to an interview`);
  if (interviewed) {
    for (let i = 0; i < 3; i++) { await page.locator(`${modal} [data-act="answer"]`).first().click(); await page.waitForTimeout(80); await page.locator('#modal-root .scrim:last-child .modal button').last().click(); await page.waitForTimeout(80); }
    check(!(await page.locator(`${modal} [data-act="answer"]`).count()), `${label}: the interview is answered to the end`);
  }
  await page.click(`${modal} [data-sec="hospital"]`);
  check(await page.locator(`${modal} [data-act="open"]:not([disabled])`).count() > 0, `${label}: a qualified internist can open a practice`);
  check(!(await overflow()), `${label}: My Clinic does not scroll sideways`);
  check(!errors.length, `${label}: no errors in the page (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'My Medical Career works on a phone and a desktop.');
process.exit(problems.length ? 1 : 0);
