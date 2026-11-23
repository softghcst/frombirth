// Browser check of taking a trip at phone width: a booked trip is taken in one click ("Go on this trip"), the player is
// home again straight away, and a notice says how it went (where, what was done, what changed). No "Away now" step.
// Needs Playwright (preinstalled where the checks run). Serves the game itself. Run with: node tests/trip-ui.mjs
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
  p.countryId = 'us'; p.city = 'New York'; p.age = 30; p.birthYear = store.state.year - 30;
  p.finance.cash = 500000; p.legal.incarceration = null;
  const travel = await import('/js/engine/travel.js');
  const t = travel.startPlan('vacation');
  const y = store.state.year;
  travel.updatePlan(t.id, { destination: { countryId: 'us', city: 'Chicago' }, depart: `${y}-06-02`, ret: `${y}-06-09`, mode: 'rail', stay: 'hotel', activities: ['museum'] });
  const r = travel.confirm(t.id);
  if (!r.ok) throw new Error(`could not book: ${r.text} ${travel.problems(t)}`);
  const { openExplore } = await import('/js/ui/globalLife.js');
  openExplore({ changed() {}, rerender() {} }, { view: 'trip', params: { id: t.id } });
  return t.id;
});
await page.waitForSelector('.gl-modal');
const go = page.locator('.gl-modal [data-depart]');
check(await go.count() === 1 && /^Leave Now$/.test((await go.innerText()).trim()), `a booked trip has a "Leave Now" button (${await go.innerText()})`);
const before = await page.locator('.gl-modal').innerText();
if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/trip-booked.png` });
check(/The Plan/.test(before) && /Museum/i.test(before) && !/What you did/i.test(before), 'before leaving it shows the plan, not "What you did"');
check(/Cancel This Trip/.test(before) && /Your Share/.test(before), 'buttons and labels are capitalized');
await go.click();
const notice = page.locator('#modal-root .modal', { hasText: 'Back from Chicago' });
await notice.waitFor({ timeout: 5000 }).catch(() => {});
check(await notice.count() === 1, 'one click: a notice says you are back from Chicago');
const text = await notice.innerText().catch(() => '');
check(/museum/i.test(text) && /Home from Chicago/.test(text), `the notice says what you did and that you are home (${text.slice(0, 200)})`);
check(await notice.locator('.chip').count() >= 1, 'and shows what changed');
if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/trip-notice.png` });
await notice.locator('[data-ok]').click();
const after = await page.evaluate(async (id) => { const travel = await import('/js/engine/travel.js'); return { status: travel.tripById(id).status, away: travel.whereabouts().away }; }, tripId);
check(after.status === 'completed' && !after.away, `the trip is over and you are home (${JSON.stringify(after)})`);
check(await page.locator('.gl-modal', { hasText: 'Away now' }).count() === 0, 'there is no "Away now" step');
if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/trip-after.png` });
// A ten-year-old does not choose who pays: the parents (or whoever looks after them) do.
await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
const kid = await page.evaluate(async () => {
  const { store } = await import('/js/state.js');
  const p = store.state.player;
  p.age = 10; p.birthYear = store.state.year - 10; p.finance.cash = 0;
  const travel = await import('/js/engine/travel.js');
  const fam = travel.familyPayer();
  const t = travel.startPlan('vacation');
  const y = store.state.year;
  travel.updatePlan(t.id, { destination: { countryId: 'us', city: 'Chicago' }, depart: `${y}-08-02`, ret: `${y}-08-05`, mode: 'rail', stay: 'hotel', payment: 'split' });
  if (fam) t.travelers.push({ id: fam.people[0].id, status: 'accepted', pays: 'organizer' });
  const { openExplore } = await import('/js/ui/globalLife.js');
  openExplore({ changed() {}, rerender() {} }, { view: 'plan', params: { id: t.id } });
  return { id: t.id, who: fam?.who, payment: t.payment };
});
await page.waitForSelector('.gl-modal');
const plan = await page.locator('.gl-modal').innerText();
check(kid.who && kid.payment === 'organizer', `a child has someone paying and cannot change it (${JSON.stringify(kid)})`);
check(await page.locator('.gl-modal [data-planfield="payment"]').count() === 0 && plan.includes(`${kid.who} `) && /once you are 18/.test(plan), 'the planner says who pays instead of offering a choice');
check(!/<strong>/.test(plan), 'no markup shows as text');
if (process.env.SHOT) { await page.locator('.gl-modal [data-planfield="insurance"]').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${process.env.SHOT}/trip-kid-plan.png` }); }
const booked = await page.evaluate(async (id) => { const travel = await import('/js/engine/travel.js'); const r = travel.confirm(id); return { ok: r.ok, text: r.text }; }, kid.id);
check(booked.ok && booked.text.includes(`${kid.who} paid.`), `booked with no money of their own: the family paid (${JSON.stringify(booked)})`);
const grown = await page.evaluate(async () => { const { store } = await import('/js/state.js'); store.state.player.age = 18; const travel = await import('/js/engine/travel.js'); return travel.choosesPayment(); });
check(grown, 'at 18 you choose who pays');
check(!errors.length, `no page errors (${errors.join('; ')})`);
await browser.close();
server.close();
if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log('Going on a trip is one click, with a notice of how it went.');
