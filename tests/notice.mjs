// The notice before the first life: shown once on a device, before the title screen, at phone and desktop widths; it
// says the people and events are fiction and that nothing is advice; after "I understand" the title screen follows and
// a reload goes straight there; Settings → About Pathways shows it again. Needs Playwright. Run with: node tests/notice.mjs
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
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // A real first visit (the address asks for the notice, as an automated browser would otherwise skip it).
  await page.goto(`http://localhost:${port}/index.html?notice`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-notice-ok]');
  const text = await page.innerText('main');
  check(/Before you begin/i.test(text) && /work of fiction/.test(text) && /coincidence/.test(text) && /not medical, legal or financial advice|Nothing in the game is medical, legal or financial advice/.test(text), `${label}: the notice says it is fiction and not advice`);
  check(!(await page.$('[data-random]')), `${label}: it comes before the title screen`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: no sideways scrolling`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/notice-${label}.png` });
  await page.click('[data-notice-ok]');
  await page.waitForSelector('[data-random]');
  check(true, 'then the title screen');
  await page.reload();
  await page.waitForSelector('[data-random]');
  check(!(await page.$('[data-notice-ok]')), `${label}: once seen, a reload goes straight to the title screen`);
  // Settings → About Pathways shows it again.
  await page.click('[data-settings]');
  await page.locator('#modal-root .choice-btn', { hasText: 'About Pathways' }).click();
  await page.waitForTimeout(100);
  const about = await page.evaluate(() => [...document.querySelectorAll('#modal-root .modal')].pop().innerText);
  check(/About Pathways/i.test(about) && /work of fiction/.test(about), `${label}: Settings shows it again`);
  // An automated browser on a fresh device (the other checks) goes straight to the title screen.
  const fresh = await browser.newPage({ viewport });
  await fresh.goto(`http://localhost:${port}/index.html`);
  await fresh.evaluate(() => localStorage.clear());
  await fresh.reload();
  await fresh.waitForSelector('[data-random]');
  await fresh.close();
  check(!errors.length, `${label}: no page errors (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('The notice comes first, once, and stays within reach.');
