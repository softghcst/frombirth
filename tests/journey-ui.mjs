// The journey on the globe (js/ui/journey.js): a flight's boarding pass and the seat chosen on it, the route flown,
// a moment halfway and its answer, the landing; a cruise without a pass; turned off in Settings, no scene at all.
// Needs Playwright. Run with: node tests/journey-ui.mjs
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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${port}/index.html`);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('frombirth.birthGlobe', 'off'); });
await page.reload();
await page.click('[data-random]');
await page.waitForSelector('[data-year]');
await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
/** Books a trip from New York and sets off on its journey scene; resolves window.__jd when it is over. */
const fly = (o) => page.evaluate(async (o) => {
  const { store } = await import('/js/state.js'); const p = store.state.player;
  p.birthday = { m: 0, d: 1 }; store.state.today = `${store.state.year}-01-01`; p.countryId = 'us'; p.city = 'New York'; p.age = 30; p.birthYear = store.state.year - 30; p.finance.cash = 1e9; p.legal.incarceration = null;
  const travel = await import('/js/engine/travel.js'); const y = store.state.year + 1;
  const t = travel.startPlan('vacation');
  travel.updatePlan(t.id, { destination: o.dest, depart: `${y}-${o.month}-02`, ret: `${y}-${o.month}-09`, mode: o.mode, ...(o.cabin ? { cabin: o.cabin } : {}), stay: 'hotel' });
  const r = travel.confirm(t.id); if (!r.ok) return { err: r.text };
  const trip = travel.tripById(t.id);
  if (o.moment) trip.flight = { decided: true, moment: o.moment };
  const g = await import('/js/ui/globalLife.js'); window.__jd = false; window.__j = g.journeyOf(trip).then(() => { window.__jd = true; });
  return { id: t.id };
}, o);

// Economy to Tokyo: the pass, the aisle, the snacks.
check(!(await fly({ dest: { countryId: 'jp', city: 'Tokyo' }, mode: 'jet', cabin: 'economy', month: '03', moment: 'eco_snacks' })).err, 'setup: a flight to Tokyo booked');
await page.waitForSelector('[data-pass]', { timeout: 6000 });
const pass = await page.locator('[data-pass]').innerText();
check(/Boarding pass/i.test(pass) && /NEW/.test(pass) && /TOK/.test(pass) && /Economy/.test(pass) && await page.locator('[data-side]').count() === 2, `a boarding pass, from New York to Tokyo, in economy, with a choice of seat (${pass.replace(/\n/g, ' | ')})`);
check(await page.locator('.journey-screen canvas').count() === 1 && /Tokyo/.test(await page.locator('.journey-head').innerText()), 'the journey is on the globe');
await page.click('[data-side="aisle"]');
await page.waitForTimeout(200);
check(/^Seat \d+[CDGH]$/.test((await page.locator('[data-seat]').innerText()).trim()), `the aisle seat is on the pass (${await page.locator('[data-seat]').innerText()})`);
await page.waitForSelector('[data-moment]:not([hidden])', { timeout: 12000 });
const m = await page.locator('[data-moment]').innerText();
check(/Halfway to Tokyo/i.test(m) && /snacks/.test(m) && await page.locator('[data-choice]').count() === 2, `halfway, a moment with its choices (${m.replace(/\n/g, ' | ')})`);
await page.click('[data-choice="0"]');
await page.waitForSelector('[data-onward]');
const said = await page.locator('[data-moment]').innerText();
check(/one of your contacts/.test(said) && /Mood \+\d/.test(said), `what happened, and what it changed (${said.replace(/\n/g, ' | ')})`);
await page.click('[data-onward]');
await page.waitForFunction(() => window.__jd === true, null, { timeout: 15000 }).catch(() => {});
check(await page.evaluate(() => window.__jd === true), 'it flies on, lands, and is over');
await page.waitForTimeout(500);
check(!(await page.locator('.journey-screen').count()), 'and the scene is gone');
// First class: a suite by the window, and a Board button; a tap skips ahead.
check(!(await fly({ dest: { countryId: 'fr', city: 'Paris' }, mode: 'jet', cabin: 'first', month: '05' })).err, 'setup: first class to Paris');
await page.waitForSelector('[data-pass]', { timeout: 6000 });
check(/First class/.test(await page.locator('[data-pass]').innerText()) && /Seat [12]A/.test(await page.locator('[data-seat]').innerText()) && await page.locator('[data-board]').count() === 1, 'first class: a suite by the window, and Board');
for (let i = 0; i < 20 && !(await page.evaluate(() => window.__jd)); i++) {
  const ch = page.locator('[data-choice]').first(); const on = page.locator('[data-onward]');
  if (await ch.count()) await ch.click(); else if (await on.count()) await on.click(); else await page.locator('.journey-screen').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.waitForTimeout(250);
}
check(await page.evaluate(() => window.__jd === true), 'taps skip it, through any moment, to the end');
// Turned off in Settings: no scene.
await page.evaluate(async () => { const j = await import('/js/ui/journey.js'); j.setJourneyScenes(false); });
check(!(await fly({ dest: { countryId: 'uk', city: 'London' }, mode: 'jet', cabin: 'economy', month: '07' })).err, 'setup: a flight to London');
await page.waitForTimeout(600);
check(await page.evaluate(() => window.__jd === true) && !(await page.locator('.journey-screen').count()), 'turned off, a trip begins straight away');
check(!errors.length, `no page errors (${errors.join('; ')})`);
await browser.close();
server.close();
if (problems.length) { console.log('PROBLEMS:'); for (const p of problems) console.log(` - ${p}`); process.exit(1); }
console.log('A journey: the pass, the seat, the flight, a moment in the air, and the landing.');
