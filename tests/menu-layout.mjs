// Every tab is a list of rows, each with a picture and a line saying what it is for; things not open yet are shown
// greyed with why ("From age 18") and cannot be tapped; Work has You, Find work and Special careers. Browser check.
// Needs Playwright. Run with: node tests/menu-layout.mjs
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
await page.click('[data-random]'); await page.waitForSelector('[data-year]');
const settle = async () => { for (let i = 0; i < 25; i++) { const c = page.locator('.modal .choice-btn:not([disabled])'); const o = page.locator('.modal [data-ok], .modal [data-cancel], .modal .modal-back'); if (await c.count()) await c.first().click(); else if (await o.count()) await o.last().click(); else break; await page.waitForTimeout(40); } };
const tab = async (t) => { await settle(); await page.evaluate((t) => document.querySelector(`.tab-btn[data-tab="${t}"]`).click(), t); await page.waitForTimeout(250); };
/** The rows of the open tab's list: label, line, locked, has a picture. */
const rows = () => page.evaluate(() => [...document.querySelectorAll('[data-panel-body] > .nav-group > .nav-row, [data-panel-body] > .nav-group > .sec-row')].filter((r) => r.offsetParent)
  .map((r) => ({ label: r.querySelector('.nr-label')?.textContent.trim(), line: r.querySelector('.nr-main small')?.textContent.trim() ?? '', shown: !!r.querySelector('.nr-main small')?.offsetParent, locked: r.disabled, pic: !!r.querySelector('.nr-icon') })));
const labels = () => page.evaluate(() => [...document.querySelectorAll('[data-panel-body] > .section-label')].map((x) => x.textContent.trim()));

// A young child: most things are greyed, with why.
for (let i = 0; i < 6; i++) { await settle(); await page.evaluate(async () => { const S = await import('/js/state.js'); S.store.state.player.stats.health = 95; }); await page.locator('[data-year]').first().click(); await page.waitForTimeout(30); }
for (const t of ['work', 'holdings', 'people', 'pursuits', 'self']) {
  await tab(t);
  const rs = await rows();
  check(rs.length >= 3, `${t}: a list of rows (${rs.length})`);
  check(rs.every((r) => r.pic), `${t}: every row has a picture`);
  check(rs.every((r) => r.line && r.shown), `${t}: every row says what it is for (${rs.filter((r) => !r.line || !r.shown).map((r) => r.label).join(', ')})`);
}
await tab('work');
check(JSON.stringify(await labels()) === JSON.stringify(['You', 'Find work']), `work: You, then Find work (${await labels()})`);
let rs = await rows();
check(rs.some((r) => r.label === 'Jobs' && r.locked && /^From age \d+$/.test(r.line)), 'work: Jobs is greyed for a child, with the age it opens');
check(rs.at(-1)?.label === 'Special careers' && !rs.at(-1).locked, 'work: Special careers closes the list');
await page.evaluate(() => document.querySelector('[data-sec="Special careers"]').click()); await page.waitForTimeout(250);
const special = await page.evaluate(() => [...document.querySelectorAll('.sec-body.shown .nav-row, .sec-body.shown .sec-row')].filter((r) => r.offsetParent).map((r) => `${r.querySelector('.nr-label')?.textContent.trim()}${r.disabled ? ' (locked)' : ''}`));
check(['My Fame', 'K-pop Idol', 'My Athletics', 'Politics'].every((n) => special.some((x) => x.startsWith(n))), `Special careers holds fame, K-pop, athletics and politics (${special.join(', ')})`);
check(special.some((x) => /K-pop Idol \(locked\)/.test(x)) && special.some((x) => /Politics \(locked\)/.test(x)), 'with K-pop and politics greyed for a child');
await tab('holdings');
rs = await rows();
const prop = rs.find((r) => r.label === 'Browse property');
check(prop?.locked && prop.line === 'From age 18', 'holdings: property is greyed until 18');
const before = await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').length);
await page.evaluate(() => [...document.querySelectorAll('.nav-row.locked')].forEach((b) => b.click()));
await page.waitForTimeout(150);
check(await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').length) === before, 'a greyed row cannot be opened');
await tab('people');
rs = await rows();
check(rs.some((r) => r.label === 'Look for love' && r.locked && /From age 14/.test(r.line)), 'people: Look for love is greyed until 14');

// The same player, grown: the rows open.
await page.evaluate(async () => { const S = await import('/js/state.js'); const p = S.store.state.player; p.age = 30; p.birthYear = S.store.state.year - 30; p.flags.livesWithParents = false; p.education.enrolled = false; });
await tab('holdings');
rs = await rows();
check(['Browse property', 'Invest', 'Borrow money'].every((n) => rs.find((r) => r.label === n && !r.locked)), 'holdings: at 30 property, investing and borrowing are open');
await tab('work');
rs = await rows();
check(rs.some((r) => /^Jobs/.test(r.label) && !r.locked), 'work: at 30 Jobs is open');
check(!errors.length, `no errors in the page (${errors.join('; ')})`);
await browser.close(); server.close();
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'Every tab is an organized list, with what is not open yet greyed.');
process.exit(problems.length ? 1 : 0);
