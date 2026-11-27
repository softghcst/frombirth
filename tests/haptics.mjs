// Browser check: haptics. Android (the Vibration API): Age up taps, good and bad news buzz differently, a loss is
// heavier, and Settings turns it all off. iPhone (no Vibration API, a touch screen): a hidden on/off switch is flipped
// during the tap, which is how Safari gives a tick. A desktop gets nothing, and nothing breaks.
// Needs Playwright (preinstalled where the checks run). Serves the game itself. Run with: node tests/haptics.mjs
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
const errors = [];

// A phone: `kind` 'android' records vibrate() calls; 'iphone' has no vibrate and a touch screen; 'desktop' has neither.
async function phone(kind) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: kind !== 'desktop' });
  page.on('pageerror', (e) => errors.push(`${kind}: ${e.message}`));
  await page.addInitScript((k) => {
    window.__buzz = []; window.__ticks = 0;
    if (k === 'android') navigator.vibrate = (p) => { window.__buzz.push(p); return true; };
    else { try { Object.defineProperty(Navigator.prototype, 'vibrate', { value: undefined, configurable: true }); } catch {} }
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => (k === 'desktop' ? 0 : 5) });
    document.addEventListener('change', (e) => { if (e.target.matches?.('input[switch]')) window.__ticks += 1; }, true);
  }, kind);
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => localStorage.setItem('pathways.birthGlobe', 'off')); await page.click('[data-random]');
  await page.waitForSelector('[data-year]');
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  return page;
}
const clear = (page) => page.evaluate(() => { window.__buzz = []; window.__ticks = 0; document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()); });

// ---------- Android ----------
{
  const page = await phone('android');
  await clear(page);
  await page.click('[data-year]');
  await page.waitForTimeout(400);
  let buzz = await page.evaluate(() => window.__buzz);
  check(buzz.length >= 1 && buzz[0] === 8, `Age up gives a short tap (${JSON.stringify(buzz)})`);
  await clear(page);
  await page.evaluate(async () => { const m = await import('/js/ui/modals.js'); m.messageModal({ body: 'Good news.', tone: 'good' }); });
  await page.waitForTimeout(100);
  buzz = await page.evaluate(() => window.__buzz);
  check(JSON.stringify(buzz) === JSON.stringify([[10, 60, 16]]), `good news buzzes twice, lightly (${JSON.stringify(buzz)})`);
  await page.locator('#modal-root .modal [data-ok]').last().click();
  buzz = await page.evaluate(() => window.__buzz);
  check(buzz.length === 2 && buzz[1] === 6, `and Continue is a tiny tick (${JSON.stringify(buzz)})`);
  await clear(page);
  await page.evaluate(async () => { const m = await import('/js/ui/modals.js'); m.messageModal({ body: 'Bad news.', tone: 'bad' }); });
  await page.waitForTimeout(100);
  buzz = await page.evaluate(() => window.__buzz);
  check(JSON.stringify(buzz) === JSON.stringify([[28, 50, 28]]), `bad news feels different (${JSON.stringify(buzz)})`);
  await clear(page);
  await page.evaluate(async () => { const m = await import('/js/ui/modals.js'); m.messageModal({ body: 'Nothing much.', tone: 'neutral' }); });
  await page.waitForTimeout(100);
  check((await page.evaluate(() => window.__buzz)).length === 0, 'neutral news does not buzz');
  await clear(page);
  await page.evaluate(async () => { const m = await import('/js/ui/modals.js'); m.eventModal({ id: 'x', category: 'loss', text: 'Someone has died.', choices: [{ label: 'Go to the funeral', outcomes: [] }] }, {}); });
  await page.waitForTimeout(100);
  check(JSON.stringify(await page.evaluate(() => window.__buzz)) === '[45]', 'a death is a heavier buzz');
  // Off in Settings: nothing at all.
  await clear(page);
  await page.evaluate(async () => { (await import('/js/haptics.js')).setHaptics(false); });
  await clear(page);
  // (Not a second Age up: the first may have left a scene waiting, which keeps Age up disabled until it is answered.)
  await page.evaluate(async () => { const m = await import('/js/ui/modals.js'); m.messageModal({ body: 'Good news.', tone: 'good' }); });
  await page.waitForTimeout(100);
  await page.locator('#modal-root .modal [data-ok]').last().click();
  check((await page.evaluate(() => window.__buzz)).length === 0, 'turned off, nothing buzzes: not the news, not the tap');
  check(await page.evaluate(() => localStorage.getItem('pathways.haptics')) === 'off', 'and it stays off on this device');
  // The setting is in Settings, and says what it does.
  await page.evaluate(async () => { document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()); (await import('/js/ui/settings.js')).openSettings(); });
  await page.waitForTimeout(300);
  const row = await page.locator('#modal-root .modal').last().innerText();
  check(/Haptics/.test(row) && /Off/.test(row), 'Settings has Haptics, showing Off');
  await page.close();
}

// ---------- iPhone ----------
{
  const page = await phone('iphone');
  check(await page.evaluate(() => typeof navigator.vibrate !== 'function'), 'the iPhone stand-in has no Vibration API');
  await clear(page);
  await page.click('[data-year]');
  await page.waitForTimeout(300);
  const t = await page.evaluate(() => ({ ticks: window.__ticks, switches: document.querySelectorAll('input[type=checkbox][switch]').length, hidden: [...document.querySelectorAll('input[switch]')].every((i) => i.closest('label').getAttribute('aria-hidden') === 'true') }));
  check(t.ticks >= 1 && t.switches === 1 && t.hidden, `Age up flips the one hidden switch, which Safari answers with a tick (${JSON.stringify(t)})`);
  await page.close();
}

// ---------- Desktop ----------
{
  const page = await phone('desktop');
  await clear(page);
  await page.click('[data-year]');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => window.__ticks === 0 && !document.querySelector('input[switch]')), 'a desktop gets nothing, and nothing is added to the page');
  await page.close();
}

await browser.close();
server.close();
check(!errors.length, `no page errors (${errors.join(' / ')})`);
if (problems.length) { console.log('PROBLEMS:'); for (const m of problems) console.log(` - ${m}`); console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Haptics: a tap on Android, a tick on iPhone, nothing on a desktop, and off when asked.');
