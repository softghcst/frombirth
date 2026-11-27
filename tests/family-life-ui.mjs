// Browser check of Family Life (ui/familyLife.js) at phone and desktop widths: it opens from People; the tabs a life
// has at its age are there; a teenager goes out with friends; a 24-year-old signs a lease and sees a month's money; a
// relationship shows its stage; a 30-year-old applies to foster; the timeline fills; a turn and a reload keep it all;
// nothing scrolls sideways; no page errors.
// Needs Playwright (preinstalled where the checks run). Serves the game itself. Run with: node tests/family-life-ui.mjs
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
const shots = process.env.FAMILY_SHOTS;
if (shots) await mkdir(shots, { recursive: true });

const problems = []; const oks = [];
const check = (c, m) => { if (!c) problems.push(m); else oks.push(m); };
const browser = await chromium.launch();

/** Clicks through scenes and messages until the game is waiting for the next turn. */
async function settle(page) {
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(60);
    if (await page.locator('.fl-modal').count()) return;
    const choice = page.locator('#modal-root .scrim:last-child .choice-btn:not([disabled])');
    const ok = page.locator('#modal-root .scrim:last-child [data-ok], #modal-root .scrim:last-child [data-no]');
    if (await choice.count()) { await choice.first().click(); continue; }
    if (await ok.count()) { await ok.first().click(); continue; }
    if (await page.locator('[data-year]:not([disabled])').count()) return;
  }
}
/** After an action: clicks through what it says, until Family Life is back (and has stayed back a moment). */
async function back(page) {
  let calm = 0;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(100);
    const ok = page.locator('#modal-root .scrim:last-child [data-ok]');
    const choice = page.locator('#modal-root .scrim:last-child .choice-btn:not([disabled])');
    if (await choice.count()) { await choice.first().click(); calm = 0; continue; }
    if (await ok.count()) { await ok.first().click(); calm = 0; continue; }
    if (await page.locator('#modal-root .scrim:last-child .fl-modal').count()) { if (++calm >= 4) return true; } else calm = 0;
  }
  return !!(await page.locator('.fl-modal').count());
}
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
const noSpill = (page) => page.evaluate(() => {
  const m = document.querySelector('.fl-modal');
  if (!m) return 'no modal';
  const edge = m.getBoundingClientRect().right;
  const out = [...m.querySelectorAll('*')].filter((e) => !e.closest('.zoo-tabs') && e.getBoundingClientRect().right > edge + 1).slice(0, 3).map((e) => `${e.tagName}.${e.className?.baseVal ?? e.className}`);
  return document.documentElement.scrollWidth > innerWidth + 1 ? 'page' : out.join(', ');
});
const setLife = (page, fn) => page.evaluate(async (src) => {
  const { store } = await import('/js/state.js');
  const p = store.state.player;
  // eslint-disable-next-line no-new-func
  new Function('store', 'p', src)(store, p);
  store.state.pendingEvents = [];
  store.notify();
}, fn);
async function openFamily(page) {
  // Close whatever is open, and wait until nothing comes back for a moment (an action's result closes the screen,
  // shows what happened, then reopens it).
  for (let i = 0, calm = 0; i < 60 && calm < 5; i++) {
    await page.waitForTimeout(100);
    if (!(await page.locator('#modal-root .scrim').count())) { calm++; continue; }
    calm = 0;
    const top = page.locator('#modal-root .scrim:last-child');
    if (await top.locator('[data-ok]').count()) await top.locator('[data-ok]').first().click();
    else if (await top.locator('.choice-btn:not([disabled])').count()) await top.locator('.choice-btn:not([disabled])').first().click();
    else if (await top.locator('.modal-back:visible').count()) await top.locator('.modal-back:visible').first().click();
  }
  if (await page.locator('[data-panel]:not([hidden])').count()) await page.click('[data-panel-close]').catch(() => {});
  await page.click('.tab-btn[data-tab="people"]'); await page.waitForTimeout(250);
  await page.click('[data-top="familyLife"]'); await page.waitForSelector('.fl-modal');
}
const tab = async (page, id) => { await page.click(`.fl-modal [data-tab="${id}"]`); await page.waitForTimeout(150); };
const tabs = (page) => page.$$eval('.fl-modal [role="tab"]', (b) => b.map((x) => x.textContent.trim()));
const text = (page) => page.locator('.fl-modal [data-body]').innerText();

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

  // A teenager.
  await setLife(page, "p.age = 15; p.royal = undefined; p.legal.incarceration = null; p.flags.livesWithParents = true; p.flags.care = null;");
  await openFamily(page);
  const t15 = await tabs(page);
  check(t15.includes('Family') && t15.includes('Teen life') && t15.includes('Love') && !t15.includes('Fostering'), `${name}: a 15-year-old has Family, Teen life and Love (${t15.join(', ')})`);
  check(/Where you live/i.test(await text(page)), `${name}: Family shows where you live`);
  await shot(page, `${name}-family`);
  await tab(page, 'teen');
  check(/Curfew/i.test(await text(page)) && /Prom/i.test(await text(page)) && /Driving/i.test(await text(page)), `${name}: Teen life shows the rules, prom and driving`);
  check(await noSpill(page) === '', `${name}: Teen life fits (${await noSpill(page)})`);
  await shot(page, `${name}-teen`);
  await page.click('.fl-modal [data-act="out"]');
  check(await back(page), `${name}: a night out says what happened and comes back`);
  check(await page.locator('.fl-modal [data-tab="teen"].on').count() === 1, `${name}: back on the same tab`);

  // Moving out at 24.
  await setLife(page, "p.age = 24; p.flags.livesWithParents = true; p.education.enrolled = false; p.homeId = null; p.finance.cash = 1e12;");
  await openFamily(page);
  await tab(page, 'home');
  check(await page.locator('.fl-modal [data-place]').count() === 3, `${name}: three kinds of place to move to`);
  await page.click('.fl-modal [data-place="studio"]');
  await page.waitForSelector('#modal-root .scrim:last-child [data-yes]');
  await page.click('#modal-root .scrim:last-child [data-yes]');
  await back(page);
  await tab(page, 'home');
  const homeText = await text(page);
  check(/Your place/i.test(homeText) && /A month's money/i.test(homeText) && /Left over/i.test(homeText), `${name}: after signing, the lease and a month's money are shown`);
  check(await noSpill(page) === '', `${name}: Home fits (${await noSpill(page)})`);
  await shot(page, `${name}-home`);

  // A relationship.
  await setLife(page, "const n = Object.values(store.state.npcs).find((x) => x.alive && x.role !== 'pet' && x.role !== 'parent' && p.npcIds.includes(x.id)) ?? Object.values(store.state.npcs).find((x) => x.role !== 'pet'); n.role = 'partner'; n.age = 25; n.alive = true; n.flags.since = 23; n.meters.relationship = 80; if (!p.npcIds.includes(n.id)) p.npcIds.push(n.id);");
  await openFamily(page);
  await tab(page, 'love');
  check(await page.locator('.fl-modal .fl-stages .chip').count() === 6 && await page.locator('.fl-modal .fl-stages .chip.on').count() === 1, `${name}: the relationship shows its six stages, one current`);
  await page.click('.fl-modal [data-act="dtr"]');
  check(await back(page), `${name}: asking to be exclusive is answered`);
  await shot(page, `${name}-love`);

  // Fostering at 30.
  await setLife(page, "p.age = 30; p.legal.record = []; p.flags.livesWithParents = false;");
  await openFamily(page);
  check((await tabs(page)).includes('Fostering'), `${name}: a 30-year-old has Fostering`);
  await tab(page, 'care');
  await page.click('.fl-modal [data-act="apply"]');
  await back(page);
  await tab(page, 'care');
  check(/assessed/i.test(await text(page)), `${name}: the application is being assessed`);
  check(await noSpill(page) === '', `${name}: Fostering fits (${await noSpill(page)})`);
  await shot(page, `${name}-care`);

  // A turn, then a reload: everything is still there.
  await page.locator('.fl-modal .modal-back:visible').first().click();
  await page.waitForTimeout(200);
  if (await page.locator('[data-panel]:not([hidden])').count()) await page.click('[data-panel-close]');
  await page.click('[data-year]');
  await settle(page);
  await page.reload(); await page.waitForTimeout(400);
  const cont = page.locator('[data-load]');
  if (await cont.count()) await cont.first().click();
  await page.waitForSelector('[data-year]');
  await settle(page);
  await openFamily(page);
  await tab(page, 'home');
  check(/Your place/i.test(await text(page)), `${name}: the lease is still there after a turn and a reload`);
  await tab(page, 'timeline');
  check(/moved|lease|foster|exclusive/i.test(await text(page)), `${name}: the timeline tells the family's story`);
  await shot(page, `${name}-timeline`);
  check(!errors.length, `${name}: no page errors (${errors.slice(0, 3).join(' | ')})`);
  await context.close();
}

await browser.close();
server.close();
if (problems.length) { console.log(`PROBLEMS:\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log(oks.map((x) => ` ✓ ${x}`).join('\n'));
console.log('Family Life opens, acts and keeps its place, at phone and desktop widths.');
