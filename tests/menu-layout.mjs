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
// Answers or closes whatever is open (a yes/no question, such as whether to see a doctor, is answered no). Notices come one after another (a scene, then a birth, then the year's update), each
// opening a moment after the last has closed: it stops only once nothing has opened for a while.
const settle = async () => {
  let quiet = 0;
  for (let i = 0; i < 40 && quiet < 3; i++) {
    const c = page.locator('#modal-root .scrim:last-child .choice-btn:not([disabled])');
    const o = page.locator('#modal-root .scrim:last-child :is([data-ok], [data-cancel], [data-no], .modal-back)');
    if (await c.count()) { quiet = 0; await c.first().click(); } else if (await o.count()) { quiet = 0; await o.last().click(); } else quiet += 1;
    await page.waitForTimeout(quiet ? 120 : 60);
  }
};
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
check(JSON.stringify(await labels()) === JSON.stringify(['You', 'Find Work']), `work: You, then Find work (${await labels()})`);
let rs = await rows();
check(rs.some((r) => r.label === 'Jobs' && r.locked && /^From age \d+$/.test(r.line)), 'work: Jobs is greyed for a child, with the age it opens');
check(rs.at(-1)?.label === 'Special Careers' && !rs.at(-1).locked, 'work: Special careers closes the list');
check(rs.some((r) => r.label === 'Military' && r.locked && /From age 18/i.test(r.line)), 'work: Military is greyed until 18');
await page.evaluate(() => document.querySelector('[data-sec="Special careers"]').click()); await page.waitForTimeout(250);
const special = await page.evaluate(() => [...document.querySelectorAll('.sec-body.shown .nav-row, .sec-body.shown .sec-row')].filter((r) => r.offsetParent).map((r) => `${r.querySelector('.nr-label')?.textContent.trim()}${r.disabled ? ' (locked)' : ''}`));
check(['My Fame', 'K-pop Idol', 'My Athletics', 'Politics'].every((n) => special.some((x) => x.startsWith(n))), `Special careers holds fame, K-pop, athletics and politics (${special.join(', ')})`);
check(special.some((x) => /K-pop Idol \(locked\)/.test(x)) && special.some((x) => /Politics \(locked\)/.test(x)), 'with K-pop and politics greyed for a child');
await tab('holdings');
rs = await rows();
const prop = rs.find((r) => r.label === 'Browse Property');
check(prop?.locked && prop.line === 'From age 18', 'holdings: property is greyed until 18');
const before = await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').length);
await page.evaluate(() => [...document.querySelectorAll('.nav-row.locked')].forEach((b) => b.click()));
await page.waitForTimeout(150);
check(await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').length) === before, 'a greyed row cannot be opened');
await tab('self');
rs = await rows();
check(rs.some((r) => r.label === 'Look for Love' && r.locked && /From age 14/.test(r.line)), 'self: Look for Love is greyed until 14 (with Adopt a Child, under Love and Family)');

// The same player, grown: the rows open.
await page.evaluate(async () => { const S = await import('/js/state.js'); const p = S.store.state.player; p.age = 30; p.birthYear = S.store.state.year - 30; p.flags.livesWithParents = false; p.education.enrolled = false; });
await tab('holdings');
rs = await rows();
check(['Browse Property', 'Invest', 'Borrow Money'].every((n) => rs.find((r) => r.label === n && !r.locked)), 'holdings: at 30 property, investing and borrowing are open');
await tab('work');
rs = await rows();
check(rs.some((r) => /^Jobs/.test(r.label) && !r.locked), 'work: at 30 Jobs is open');
check(rs.some((r) => r.label === 'Military' && !r.locked), 'work: at 30 Military is open');
// Joining: the way in, then the branch from a dropdown, then basic training.
await page.evaluate(async () => { const S = await import('/js/state.js'); const p = S.store.state.player; p.stats.health = 90; p.legal.incarceration = null; });
await tab('work');
await page.waitForSelector('[data-act="military"]', { state: 'attached' });  // the tab is drawn before it is used: on a busy machine it takes a moment
await page.evaluate(() => document.querySelector('[data-act="military"]').click()); await page.waitForTimeout(250);
await page.locator('#modal-root .choice-btn', { hasText: 'Enlist' }).click(); await page.waitForTimeout(250);
const branches = await page.locator('#modal-root select#m-pick option').allInnerTexts();
check(branches.length >= 3, `the branch is picked from a dropdown (${branches.join(', ')})`);
await page.locator('#modal-root [data-go]').click(); await page.waitForTimeout(300);
check(/contract/i.test(await page.locator('#modal-root .modal').last().innerText()), 'enlisting says what was signed');
await page.locator('#modal-root .modal').last().locator('[data-ok]').click(); await page.waitForTimeout(300);
check(/basic training/i.test(await page.locator('#modal-root .modal').last().innerText()), 'and basic training follows at once');
for (let i = 0; i < 6 && await page.locator('#modal-root .scrim').count(); i++) { const c = page.locator('#modal-root .choice-btn:not([disabled])'); if (await c.count()) await c.first().click(); else await page.locator('#modal-root .modal').last().locator('[data-ok]').click(); await page.waitForTimeout(200); }
await tab('work');
rs = await rows();
check(rs.some((r) => r.label === 'Military' && /, /.test(r.line)), 'serving: the row shows rank and branch');
check(!errors.length, `no errors in the page (${errors.join('; ')})`);
await browser.close(); server.close();
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'Every tab is an organized list, with what is not open yet greyed.');
process.exit(problems.length ? 1 : 0);
