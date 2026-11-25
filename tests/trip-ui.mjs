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
  p.birthday = { m: 0, d: 1 }; store.state.today = `${store.state.year}-01-01`; p.countryId = 'us'; p.city = 'New York'; p.age = 30; p.birthYear = store.state.year - 30;
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
// The trip's moments come first, one card at a time: each a scene with choices; answering moves on.
let moments = 0;
for (; moments < 5; moments++) {
  const scene = page.locator('#modal-root .modal .choice-btn:not([disabled])').first();
  if (!(await scene.count())) { await page.waitForTimeout(300); if (!(await page.locator('#modal-root .modal .choice-btn:not([disabled])').count())) break; }
  if (process.env.SHOT) { await page.waitForTimeout(500); await page.screenshot({ path: `${process.env.SHOT}/trip-moment-${moments}.png` }); }
  if (moments === 0) check(/Chicago · 1 of \d/i.test(await page.locator('#modal-root .modal').last().innerText()), 'a moment says where, and which of how many');
  await page.locator('#modal-root .modal .choice-btn:not([disabled])').first().click();
  await page.waitForTimeout(150);
}
check(moments >= 2, `a week away has moments with choices (${moments})`);
const notice = page.locator('#modal-root .modal', { hasText: 'Back from Chicago' });
await notice.waitFor({ timeout: 5000 }).catch(() => {});
check(await notice.count() === 1, 'then a notice says you are back from Chicago');
const text = await notice.innerText().catch(() => '');
check(/museum/i.test(text) && /Home from Chicago/.test(text), `the notice says what you did and that you are home (${text.slice(0, 200)})`);
check(await notice.locator('.chip').count() >= 1, 'and shows what changed, with what came of the last moment');
if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/trip-notice.png` });
await notice.locator('[data-ok]').click();
const after = await page.evaluate(async (id) => { const travel = await import('/js/engine/travel.js'); return { status: travel.tripById(id).status, away: travel.whereabouts().away }; }, tripId);
check(after.status === 'completed' && !after.away, `the trip is over and you are home (${JSON.stringify(after)})`);
check(await page.locator('.gl-modal', { hasText: 'Away now' }).count() === 0, 'there is no "Away now" step');
if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/trip-after.png` });
// A ten-year-old asks their parents (or whoever looks after them): the answer is shown in words, and booking waits for it.
await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
const kid = await page.evaluate(async () => {
  const { store } = await import('/js/state.js');
  const p = store.state.player;
  p.age = 10; p.birthYear = store.state.year - 10; p.finance.cash = 100000; p.flags.livesWithParents = true; p.homeId = null;
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
check(kid.who && kid.payment === 'family', `a child cannot split a trip with friends; asking is the plan (${JSON.stringify(kid)})`);
const opts = await page.locator('.gl-modal [data-planfield="payment"] option').allInnerTexts();
check(opts.length === 2 && /^Ask Your/i.test(opts[0]) && /Pay It Yourself/i.test(opts[1]), `the dropdown: ask, or pay it yourself (${opts.join(' / ')})`);
check(await page.locator('.gl-modal [data-book]').isDisabled() && /first, or pay it yourself/.test(plan), 'nothing is booked before asking');
check(!/<strong>/.test(plan) && !/\d+%/.test(plan), 'no markup and no percentage shows');
check(!/\$\{|`/.test(plan) && /Country/.test(plan), "the planner shows its fields, never code (From and to, things to do)");
await page.locator('.gl-modal [data-askfamily]').click();
const answer = page.locator('#modal-root .modal', { hasText: kid.who });
await answer.last().waitFor({ timeout: 5000 }).catch(() => {});
const said = await answer.last().innerText().catch(() => '');
check(/said|will pay|will put in|can help|will cover/.test(said) && !/\d+%/.test(said), `the answer comes in words (${said.replace(/\n/g, ' / ').slice(0, 160)})`);
await answer.last().locator('[data-ok]').click().catch(() => {});
await page.waitForTimeout(200);
check(await page.locator('.gl-modal .gl-answer').count() === 1, 'and stays on the plan');
if (process.env.SHOT) { await page.locator('.gl-modal .gl-answer').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${process.env.SHOT}/trip-kid-plan.png` }); }
check(await page.locator('.gl-modal [data-askfamily]').count() === 0, 'one ask per plan');
const booked = await page.evaluate(async (id) => { const travel = await import('/js/engine/travel.js'); const r = travel.confirm(id); return { ok: r.ok, text: r.text }; }, kid.id);
check(booked.ok, `booked once they have answered (${JSON.stringify(booked)})`);
const grown = await page.evaluate(async () => { const { store } = await import('/js/state.js'); const p = store.state.player; p.age = 20; const travel = await import('/js/engine/travel.js'); const home = travel.paymentOptions().map((o) => o.id); p.flags.livesWithParents = false; const out = travel.paymentOptions().map((o) => o.id); return { home, out }; });
check(grown.home.includes('family') && !grown.out.includes('family'), `at 20 you can ask while you live at home, not after moving out (${JSON.stringify(grown)})`);
check(!errors.length, `no page errors (${errors.join('; ')})`);
await browser.close();
server.close();
if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log('Going on a trip is one click, with a notice of how it went.');
