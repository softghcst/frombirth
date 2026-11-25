// Browser check of planning a cruise at phone width: choosing the line, the sailing, the stateroom and its view, and the
// home again straight away, and a notice says how it went (where, what was done, what changed). No "Away now" step.
// extras, by clicking the planner itself. Needs Playwright. Run with: node tests/cruise-ui.mjs (SHOT=dir for screenshots)
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
// A thirty-year-old in New York with money, a week in Chicago booked by train, a museum day planned.
const tripId = await page.evaluate(async () => {
  const { store } = await import('/js/state.js');
  const p = store.state.player;
  p.birthday = { m: 0, d: 1 }; store.state.today = `${store.state.year}-01-01`; p.countryId = 'us'; p.city = 'New York'; p.age = 30; p.birthYear = store.state.year - 30;
  p.finance.cash = 500000; p.legal.incarceration = null; p.career.careerId = null; p.flags.livesWithParents = false; p.homeId = 'h1';
  store.state.year = 2024; store.state.today = '2024-02-01';
  const travel = await import('/js/engine/travel.js');
  const t = travel.startPlan('cruise');
  travel.updatePlan(t.id, { depart: '2024-07-08' });
  const { openExplore } = await import('/js/ui/globalLife.js');
  openExplore({ changed() {}, rerender() {} }, { view: 'plan', params: { id: t.id } });
  return t.id;
});
await page.waitForSelector('.gl-modal');
const text = () => page.locator('.gl-modal').innerText();
check(/2 · Cruise/i.test(await text()) && /Coral Bay Cruises/.test(await text()) && !/Huge ships/.test(await text()), 'a cruise plan starts with the cruise lines, names only');
const shotStep = async (h, name) => { if (!process.env.SHOT) return; await page.evaluate((h2) => [...document.querySelectorAll('.gl-modal h3')].find((x) => x.textContent.toLowerCase().includes(h2))?.scrollIntoView(), h); await page.screenshot({ path: `${process.env.SHOT}/${name}.png` }); };
await page.waitForTimeout(600);
await shotStep('2 · cruise', 'c1-lines');
await page.click('.gl-modal input[data-cruise="line"][value="coral_bay"]');
await page.waitForTimeout(150);
check(/Alaska Inside Passage/.test(await text()), 'choosing a line lists its sailings');
await shotStep('2 · cruise', 'c2-sailings');
await page.click('.gl-modal input[data-cruise="itin"][value="alaska_inside"]');
await page.waitForTimeout(150);
check(/Stateroom/i.test(await text()) && /Getting to the port/i.test(await text()) && !/Meridian Cruises/.test(await text()), 'a sailing opens the stateroom step, and the chosen line folds to one line');
await shotStep('stateroom', 'c3-rooms');
await page.click('.gl-modal input[data-cruise="room"][value="balcony"]');
await page.waitForTimeout(150);
await page.selectOption('.gl-modal select[data-cruise="view"]', 'aft');
await page.waitForTimeout(150);
for (const id of ['drinks', 'wifi_stream', 'excursions']) { await page.click(`.gl-modal [data-cruise="extra"][data-value="${id}"]`); await page.waitForTimeout(120); }
await page.click('.gl-modal [data-cruise="port"][data-value="0"]');
await page.waitForTimeout(150);
await page.click('.gl-modal input[name="mode"][value="jet"]');
await page.waitForTimeout(150);
const plan = await page.evaluate(async (id) => { const travel = await import('/js/engine/travel.js'); const t = travel.tripById(id); return { cruise: t.cruise, problems: travel.problems(t), lines: travel.quote(t).lines.map((l) => l.label) }; }, tripId);
check(plan.cruise.room === 'balcony' && plan.cruise.view === 'aft' && plan.cruise.extras.join() === 'drinks,wifi_stream,excursions' && plan.cruise.ports.join() === '0', `the clicks set the plan (${JSON.stringify(plan.cruise)})`);
check(plan.problems.length === 0, `and it can be booked (${plan.problems.join(' / ')})`);
await page.click('.gl-modal .gl-bill details > summary');
await page.waitForTimeout(100);
const shown = await text();
check(/Drinks package/i.test(shown) && /Port fees and taxes/i.test(shown) && /Shore excursions: Juneau/i.test(shown), 'the bill lists the extras');
if (process.env.SHOT) {
  const stepTop = async (h) => page.evaluate((h2) => { const el = [...document.querySelectorAll('.gl-modal h3')].find((x) => x.textContent.toLowerCase().includes(h2.toLowerCase())); if (!el) throw new Error('no step ' + h2 + ': ' + [...document.querySelectorAll('.gl-modal h3')].map((x) => x.textContent).join(' / ')); el.scrollIntoView(); }, h);
  await stepTop('2 · Cruise'); await page.screenshot({ path: `${process.env.SHOT}/cruise-plan-lines.png` });
  await page.evaluate(() => { const el = [...document.querySelectorAll('.gl-modal .section-label')].find((x) => /sailings/i.test(x.textContent)); el?.scrollIntoView(); });
  await page.screenshot({ path: `${process.env.SHOT}/cruise-plan-sailings.png` });
  await page.screenshot({ path: `${process.env.SHOT}/cruise-plan-top.png` });
  await stepTop('Stateroom'); await page.screenshot({ path: `${process.env.SHOT}/cruise-plan-room.png` });
  await stepTop('Extras'); await page.screenshot({ path: `${process.env.SHOT}/cruise-plan-onboard.png` });
  await stepTop('Paying'); await page.screenshot({ path: `${process.env.SHOT}/cruise-plan-bill.png` });
}
check(!errors.length, `no page errors (${errors.join('; ')})`);
await browser.close();
server.close();
if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log('A cruise is planned by clicking: line, sailing, stateroom, view, extras.');
