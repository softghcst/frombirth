// Animals have one home in the menus: People → Pets & Animals (the hub), which also holds the house chronicle. Holdings
// no longer carries a second "Household animals" card. Browser check, phone width.
// Needs Playwright. Run with: node tests/animal-entry-ui.mjs
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${port}/index.html`);
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.evaluate(() => localStorage.setItem('frombirth.birthGlobe', 'off')); await page.click('[data-random]'); await page.waitForSelector('[data-year]');
const adopted = await page.evaluate(async () => {
  document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove());
  const { store } = await import('/js/state.js'); const zoo = await import('/js/engine/animals.js'); const care = await import('/js/engine/animalCare.js');
  const p = store.state.player; p.birthday = { m: 0, d: 1 }; store.state.today = `${store.state.year}-01-01`; p.age = 30; p.birthYear = store.state.year - 30; p.flags.livesWithParents = false; p.education.enrolled = false; p.finance.cash = 1e10; p.finance.loans = []; // enough in any currency (900,000 dong does not adopt a dog)
  zoo.reconcile(); const l = care.rentalPolicy(); if (l) l.kind = 'any';
  for (const a of care.shelterAnimals()) { if (care.adoptionCheck(a.id).ok && care.adopt(a.id).ok) return a.name; }
  return null;
});
check(adopted, 'a household can take an animal in');
await page.evaluate(() => document.querySelector('.tab-btn[data-tab="holdings"]').click()); await page.waitForTimeout(300);
const holdings = await page.evaluate(() => document.body.innerText);
check(!/Household animals/.test(holdings) && !(await page.locator('[data-go="chronicle"]').count()), 'Holdings has no second animals card');
await page.evaluate(() => document.querySelector('.tab-btn[data-tab="people"]').click()); await page.waitForTimeout(300);
check(await page.locator('[data-top="animals"]').count() === 1, 'People has Pets & Animals');
await page.evaluate(() => document.querySelector('[data-top="animals"]').click());
await page.waitForSelector('#modal-root [data-chronicle]', { timeout: 15000 }).catch(() => {}); // the hub, however busy the machine
const hub = await page.evaluate(() => document.querySelector('#modal-root .modal')?.innerText ?? '');
check(/Pets & Animals/.test(hub) && /My animals/.test(hub), 'it opens the animal hub');
check(/House chronicle/.test(hub), 'which holds the house chronicle');
check(await page.locator('#modal-root .modal-back').count() === 1, 'with one Back button');
await page.locator('#modal-root [data-chronicle]').first().click(); await page.waitForTimeout(400);
const chron = await page.evaluate(() => document.querySelector('#modal-root .modal')?.innerText ?? '');
check(/chronicle|House/i.test(chron) && !/Pets & Animals/.test(chron.split('\n')[0] ?? ''), 'the chronicle opens');
// One way back is shown: the window's, or the page's own where it has one.
await page.locator('#modal-root .modal-back:visible, #modal-root [data-back]:not(.modal-back):visible').last().click(); await page.waitForTimeout(300);
check(/My animals/.test(await page.evaluate(() => document.querySelector('#modal-root .modal')?.innerText ?? '')), 'and Back returns to the hub');
check(!errors.length, `no errors in the page (${errors.join('; ')})`);
await browser.close(); server.close();
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'Animals have one home in the menus.');
process.exit(problems.length ? 1 : 0);
