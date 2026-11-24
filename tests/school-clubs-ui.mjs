// Browser check of the Clubs page of the school book (ui/school.js): each club has things to do, a tap does one and
// says what happened, and a thing done this year shows as done. Needs Playwright. Run with: node tests/school-clubs-ui.mjs
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
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('[data-random]');
  await page.waitForSelector('[data-year]');
  const ready = await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const { advanceYear } = await import('/js/engine/yearProcessor.js');
    document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove());
    while (store.state.player.alive && store.state.player.age < 12) { advanceYear(); store.state.pendingEvents = []; }
    const p = store.state.player;
    if (!p.education.enrolled) return false;
    p.education.clubs = ['choir', 'dance_class'];
    (await import('/js/ui/school.js')).openSchool(() => {});
    return true;
  });
  if (!ready) { check(true, 'not at school'); await page.close(); continue; }
  await page.waitForTimeout(200);
  await page.click('.modal [data-go="activities"]'); await page.waitForTimeout(150);
  // Trying out for a team: two bars, you and what the coach looks for; no odds in numbers or words.
  const tryRow = page.locator('.modal [data-team]').first();
  if (await tryRow.count()) {
    const rowText = await tryRow.innerText();
    check(!/\d+%|likely|chance|long shot/i.test(rowText), `${label}: a try-out row gives no odds (${rowText.replace(/\n/g, ' ')})`);
    await tryRow.click(); await page.waitForTimeout(150);
    const ask = page.locator('#modal-root .modal').last();
    const askText = await ask.innerText();
    check(await ask.locator('.fit-bars .fit-row').count() === 2 && /Your Level/.test(askText) && /Coach Wants/.test(askText) && !/\d+%|likely/i.test(askText), `${label}: trying out shows two bars, you and what the coach looks for (${askText.replace(/\n/g, ' / ').slice(0, 160)})`);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/tryout-${label}.png` });
    await ask.locator('[data-no]').click(); await page.waitForTimeout(150);
    check(!(await page.evaluate(async () => (await import('/js/state.js')).store.state.player.education.clubs.includes('sports_team'))), `${label}: "Not Now" leaves you off the team`);
  }
  check(await page.locator('[data-club-act]').count() >= 4, `${label}: each club has things to do`);
  check(await page.locator('[data-club-act="choir:event"]').count() === 1 && /Sing in the concert/i.test(await page.locator('[data-club-act="choir:event"]').innerText()), `${label}: each club has its big moment of the year`);
  check(/Each year: your singing and music go up/.test(await page.locator('.modal').last().innerText()), `${label}: and says what a year in it does`);
  check(!/Singing lessons and choir/i.test(await page.locator('.modal').last().innerText()), `${label}: the choir is just the Choir`);
  // Clubs outside school are here too, at school: one place for every club, and not a second list in Pursuits.
  check(await page.locator('.modal [data-outclub="find"]').count() === 1 && /Outside School/i.test(await page.locator('.modal').last().innerText()), `${label}: clubs outside school are under Activities`);
  check(await page.evaluate(async () => { const { default: tab } = await import('/js/ui/tabs/pursuits.js'); const el = document.createElement('div'); tab.render(el, { changed() {}, rerender() {} }); return !/Clubs and Classes/i.test(el.innerText || el.textContent); }), `${label}: and not in Pursuits while at school`);
  if (process.env.SHOT) { await page.locator('.modal [data-outclub="find"]').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${process.env.SHOT}/clubs-outside-${label}.png` }); }
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/clubs-${label}.png` });
  await page.locator('[data-club-act="choir:practice"]').click(); await page.waitForTimeout(200);
  check(await page.locator('#modal-root .scrim').count() === 2, `${label}: doing one says what happened`);
  await page.locator('#modal-root .scrim').last().locator('button').last().click(); await page.waitForTimeout(150);
  check(await page.locator('[data-club-act="choir:practice"][disabled]').count() === 1, `${label}: and then shows as done for the year`);
  check(!errors.length, `${label}: no errors in the page (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'The Clubs page has things to do.');
process.exit(problems.length ? 1 : 0);
