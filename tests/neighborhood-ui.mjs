// Browser check of My Neighborhood (ui/neighborhood.js) at phone and desktop widths: it opens from Pursuits on the
// player's real neighborhood; the street or building is drawn; a neighbor is met from their household and opens in the
// ordinary Character Profile; the same neighbor is there after a turn and after a reload; things to do, community,
// local places and history open; nothing scrolls sideways; no page errors.
// Needs Playwright (preinstalled where the checks run). Serves the game itself. Run with: node tests/neighborhood-ui.mjs
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  try { ({ chromium } = require(join(process.execPath, '../../lib/node_modules/playwright'))); } catch { console.log('Playwright is not available here: browser check skipped.'); process.exit(0); }
}
const root = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!path.startsWith(root)) { res.writeHead(403); return res.end(); }
  try { const body = await readFile(path.endsWith('/') ? join(path, 'index.html') : path); res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const shots = process.env.HOOD_SHOTS;
if (shots) await mkdir(shots, { recursive: true });

const problems = []; const oks = [];
const check = (c, m) => { if (!c) problems.push(m); else oks.push(m); };
const browser = await chromium.launch();

async function settle(page) {
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(60);
    const choice = page.locator('#modal-root .scrim:last-child .choice-btn:not([disabled])');
    const ok = page.locator('#modal-root .scrim:last-child [data-ok], #modal-root .scrim:last-child [data-no]');
    if (await choice.count()) { await choice.first().click(); continue; }
    if (await ok.count()) { await ok.first().click(); continue; }
    if (await page.locator('[data-year]:not([disabled])').count()) return;
  }
}
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
const noSpill = (page) => page.evaluate(() => {
  const m = document.querySelector('.hood-modal');
  if (!m) return 'no modal';
  const edge = m.getBoundingClientRect().right;
  const out = [...m.querySelectorAll('*')].filter((e) => !e.closest('.zoo-tabs') && e.getBoundingClientRect().right > edge + 1).slice(0, 3).map((e) => `${e.tagName}.${e.className?.baseVal ?? e.className}`);
  return document.documentElement.scrollWidth > innerWidth + 1 ? 'page' : out.join(', ');
});
async function openHood(page) {
  if (await page.locator('[data-panel]:not([hidden])').count()) await page.click('[data-panel-close]');
  await page.click('.tab-btn[data-tab="pursuits"]'); await page.waitForTimeout(250);
  await page.click('[data-go="neighborhood"]'); await page.waitForSelector('.hood-modal');
}
const tab = async (page, id) => { await page.click(`.hood-modal [data-set="tab:${id}"]`); await page.waitForTimeout(150); };
const close = async (page) => { for (let i = 0; i < 8 && await page.locator('.hood-modal').count(); i++) { await page.click('.hood-modal .modal-back'); await page.waitForTimeout(150); } }; // (Back steps out one level at a time)

for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('[data-random]');
  await page.waitForSelector('[data-year]');
  await settle(page);
  // A grown-up renting their own place, so there is everything to do.
  await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const N = await import('/js/engine/neighborhood.js');
    const p = store.state.player; p.age = 30; p.flags.livesWithParents = false; p.finance.cash = 50000; p.royal = undefined; p.legal.incarceration = null;
    store.state.pendingEvents = [];
    N.settle(store.state);
    store.notify();
  });
  const truth = await page.evaluate(async () => { const N = await import('/js/engine/neighborhood.js'); const { store } = await import('/js/state.js'); const h = N.currentHood(store.state); return { name: h.name, city: h.city }; });

  await openHood(page);
  check((await page.locator('.hood-modal h2').innerText()) === 'My Neighborhood', `${name}: My Neighborhood opens from Pursuits`);
  check((await page.locator('.hood-modal .zoo-sub').innerText()).includes(truth.name), `${name}: it shows the player's real neighborhood (${truth.name})`);
  check(await page.locator('.hood-modal .zoo-tabs [role="tab"]').count() === 7, `${name}: seven sections`);
  check(!(await noSpill(page)), `${name}: overview has no sideways scrolling (${await noSpill(page)})`);
  await shot(page, `${name}-overview`);

  await tab(page, 'home');
  check(await page.locator('.hood-modal .hood-cell.mine').count() === 1 && await page.locator('.hood-modal .hood-cell').count() >= 5, `${name}: the street or building is drawn, with the player's home in it`);
  check(!(await noSpill(page)), `${name}: my home has no sideways scrolling (${await noSpill(page)})`);
  await shot(page, `${name}-home`);

  // A neighbor: open their household, introduce yourself, open their profile.
  await tab(page, 'neighbors');
  check(await page.locator('.hood-modal [data-hh]').count() >= 2, `${name}: households close by are listed`);
  const hhCount = await page.locator('.hood-modal [data-hh]').count();
  let met = null;
  for (let i = 0; i < hhCount && !met; i++) {
    await page.locator('.hood-modal [data-hh]').nth(i).click(); await page.waitForTimeout(150);
    const intro = page.locator('.hood-modal [data-nact$=":introduce"]:not([disabled])');
    if (await intro.count()) {
      const id = (await intro.first().getAttribute('data-nact')).split(':')[0];
      await intro.first().click(); await page.waitForTimeout(200);
      await page.locator('#modal-root [data-ok]').last().click(); await page.waitForTimeout(250);
      met = id;
    } else { await page.click('.hood-modal [data-back]'); await page.waitForTimeout(120); }
  }
  check(!!met, `${name}: a neighbor can be met from their household`);
  if (met) {
    check(await page.locator(`.hood-modal [data-person="${met}"]`).count() === 1, `${name}: after meeting, they show as a person`);
    await shot(page, `${name}-household`);
    const visit = page.locator(`.hood-modal [data-nact="${met}:hello"]`);
    check(await visit.count() === 1, `${name}: and there are things to do with them`);
    await visit.click(); await page.waitForTimeout(200); await page.locator('#modal-root [data-ok]').last().click(); await page.waitForTimeout(200);
    await page.click(`.hood-modal [data-person="${met}"]`); await page.waitForTimeout(300);
    const profile = await page.evaluate((id) => { const n = document.querySelector('#modal-root'); return n.innerText; }, met);
    const person = await page.evaluate(async (id) => { const { store } = await import('/js/state.js'); const n = store.state.npcs[id]; return `${n.firstName} ${n.lastName}`; }, met);
    check(profile.includes(person), `${name}: tapping them opens the Character Profile (${person})`);
  }
  // Back to the game, a turn of three months, and the same neighbor is still there.
  await page.evaluate(async () => { const { store } = await import('/js/state.js'); document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()); (await import('/js/engine/turns.js')).setStep(3); store.notify(); });
  await page.waitForTimeout(200);
  if (await page.locator('[data-panel]:not([hidden])').count()) await page.click('[data-panel-close]');
  await page.click('[data-year]'); await page.waitForTimeout(450); await settle(page); // a second press within 0.4s is a double tap, and ignored
  await page.click('[data-year]'); await page.waitForTimeout(450); await settle(page); // a second press within 0.4s is a double tap, and ignored
  await page.evaluate(async () => { const { saveGame } = await import('/js/save.js'); const { store } = await import('/js/state.js'); saveGame(store.state); });
  await page.reload(); await page.waitForTimeout(400);
  const cont = page.locator('[data-load]');
  if (await cont.count()) { await cont.first().click(); await page.waitForSelector('[data-year]'); await settle(page); }
  if (met) {
    if (await page.locator('[data-panel]:not([hidden])').count()) await page.click('[data-panel-close]');
    await page.click('.tab-btn[data-tab="people"]'); await page.waitForTimeout(250);
    // Wait for the People tab itself, not a fixed time: under load it can take longer to draw.
    await page.waitForSelector('.tab-btn[data-tab="people"].active, .tab-btn[data-tab="people"][aria-selected="true"], [data-top]', { timeout: 8000 }).catch(() => {});
    await settle(page);
    // A neighbor you have only met is kept off the People tab; it links to them on My Neighborhood instead.
    const role = await page.evaluate(async (id) => (await import('/js/state.js')).store.state.npcs[id]?.role, met);
    if (role === 'neighbor') {
      const where = await page.evaluate((id) => [...document.querySelectorAll(`[data-panel-body] [data-npc="${id}"]`)].map((e) => e.closest('.card, section, .scrim')?.className ?? '?'), met);
      check(where.length === 0, `${name}: a neighbor you have only met is not on the People tab (${where.join(', ')})`);
      check(await page.locator('[data-panel-body] [data-top="neighbors"]').count() === 1, `${name}: the People tab links to the neighbors you know`);
    } else check(await page.locator(`[data-npc="${met}"]`).count() === 1, `${name}: a neighbor who became a friend is on the People tab`);
  }
  await openHood(page);
  await tab(page, 'neighbors');
  await page.click('.hood-modal [data-set="show:known"]'); await page.waitForTimeout(150);
  if (met) check(await page.locator(`.hood-modal [data-person="${met}"]`).count() === 1, `${name}: the same neighbor is there after two three-month turns and a reload`);
  check(!(await noSpill(page)), `${name}: neighbors have no sideways scrolling (${await noSpill(page)})`);

  // Things to do, community, local places, history.
  await tab(page, 'activities');
  const walk = page.locator('.hood-modal [data-act="walk"]:not([aria-disabled])');
  check(await walk.count() === 1, `${name}: things to do are listed`);
  await walk.click(); await page.waitForTimeout(200);
  check(await page.locator('#modal-root [data-ok]').count() >= 1, `${name}: taking a walk tells what happened`);
  await page.locator('#modal-root [data-ok]').last().click(); await page.waitForTimeout(200);
  check(await page.locator('.hood-modal [data-act="walk"][aria-disabled]').count() === 1, `${name}: and is done for this turn`);
  await tab(page, 'community');
  check(await page.locator('.hood-modal [data-host]').count() === 1, `${name}: hosting is offered`);
  await tab(page, 'places');
  check(await page.locator('.hood-modal [data-visit]').count() >= 1, `${name}: local places are listed`);
  await shot(page, `${name}-places`);
  await tab(page, 'history');
  check(await page.locator('.hood-modal [data-hood]').count() >= 1, `${name}: places we've called home are listed`);
  await page.locator('.hood-modal [data-hood]').first().click(); await page.waitForTimeout(200);
  check((await page.locator('.hood-modal .zoo-sub').innerText()).includes('Neighborhood Chronicle'), `${name}: a neighborhood's chronicle opens`);
  check(!(await noSpill(page)), `${name}: the chronicle has no sideways scrolling (${await noSpill(page)})`);
  await shot(page, `${name}-chronicle`);
  await page.click('.hood-modal [data-back]'); await page.waitForTimeout(150);
  check(await page.locator('.hood-modal [data-set="tab:history"][aria-selected="true"]').count() === 1, `${name}: back returns to the section it was opened from`);
  await close(page);
  check(!errors.length, `${name}: no errors in the page (${errors.join(' | ')})`);
  await context.close();
}

await browser.close();
server.close();
for (const m of oks) console.log(`ok   ${m}`);
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'My Neighborhood works in the browser.');
process.exit(problems.length ? 1 : 0);
