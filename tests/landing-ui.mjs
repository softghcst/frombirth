// Browser check of the landing page: three appearances (Afterglow, Midnight, Daydream) on one layout, chosen in
// Settings and kept, apart from the theme and the app icon; the official logo; real saved lives that continue the
// right life, with deleting kept behind a menu and a confirmation; Past Lives from the real graves; every button
// working; nothing scrolling sideways on narrow phones; and nothing stored changed by looking.
// Needs Playwright (preinstalled where the checks run). Run with: node tests/landing-ui.mjs   (SHOT=dir for screenshots)
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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
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
const toTitle = async (page) => {
  for (let i = 0; i < 30 && !(await page.locator('[data-random]').count()); i++) {
    await page.locator('#app button, #modal-root button').filter({ hasText: /continue|start|ok|got it|begin/i }).first().click({ timeout: 500 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  await page.waitForSelector('[data-random]');
};
const look = (page) => page.evaluate(() => document.querySelector('.title-screen')?.dataset.landing);
const stored = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
const freshPage = async (o = {}) => {
  const page = await browser.newPage({ viewport: o.viewport ?? { width: 390, height: 844 }, deviceScaleFactor: o.shot ? 2 : 1, colorScheme: o.scheme ?? 'light' });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  return page;
};

// 1. Each appearance, with a real saved life and a real grave; the same layout for all three.
const layouts = {};
for (const id of ['afterglow', 'midnight', 'daydream']) {
  const page = await freshPage({ shot: true, scheme: id === 'midnight' ? 'dark' : 'light' });
  await page.evaluate(async (l) => {
    localStorage.setItem('frombirth.landing', l);
    const { createLife } = await import('/js/engine/characterGen.js');
    const { saveGame } = await import('/js/save.js');
    const s = createLife({ countryId: 'kr' }); s.player.age = 7; saveGame(s);
  }, id);
  await page.reload();
  await toTitle(page);
  check(await look(page) === id, `${id}: the landing page is drawn as ${id}`);
  const hero = await page.evaluate(() => getComputedStyle(document.querySelector('.lp-hero'), '::before').backgroundImage);
  check(new RegExp(`hero_${id}\\.webp`).test(hero), `${id}: its own scenery is behind the logo`);
  const logo = await page.evaluate(() => { const i = document.querySelector('.lp-logo'); return { src: i.getAttribute('src'), alt: i.alt, ok: i.complete && i.naturalWidth > 0, w: i.getBoundingClientRect().width }; });
  check(/from_birth_logo/.test(logo.src) && logo.alt === 'From Birth' && logo.ok && logo.w >= 120 && logo.w <= 182, `${id}: the official logo, phone-sized (${logo.w})`);
  check(await page.locator('.lp-card [data-load]').count() === 1 && /Age 7/.test(await page.locator('.lp-card').first().innerText()), `${id}: the saved life is shown, with its age`);
  layouts[id] = await page.evaluate(() => ['.lp-logo', '[data-random]', '[data-design]', '[data-world]', '[data-settings]', '#lp-lives', '#lp-past'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height)]; }));
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${id}: nothing scrolls sideways`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/landing-${id}.png` });
  check(!page.errors.length, `${id}: no page errors (${page.errors.join('; ')})`);
  await page.close();
}
check(JSON.stringify(layouts.afterglow) === JSON.stringify(layouts.midnight) && JSON.stringify(layouts.midnight) === JSON.stringify(layouts.daydream), 'all three appearances share exactly the same layout');

// 2. Following the theme by default; the choice is kept, and is apart from the theme and the app icon.
{
  const page = await freshPage({ scheme: 'dark' });
  await page.reload(); await toTitle(page);
  check(await look(page) === 'midnight', 'by default, a dark device shows Midnight');
  await page.evaluate(async () => (await import('/js/theme.js')).setTheme('light'));
  await page.reload(); await toTitle(page);
  check(await look(page) === 'afterglow', 'and a light theme shows Afterglow');
  // Settings → Appearance → Landing Page: Daydream.
  await page.click('[data-settings]');
  await page.locator('#modal-root .choice-btn', { hasText: 'Appearance' }).click();
  await page.locator('#modal-root .choice-btn', { hasText: 'Landing Page' }).click();
  await page.waitForSelector('.lpk-grid');
  check(await page.locator('.lpk-opt[role="radio"]').count() === 4 && await page.locator('.lpk-opt[aria-checked="true"]').getAttribute('data-landing-opt') === 'auto', 'four choices, following the theme by default');
  check(await page.evaluate(() => [...document.querySelectorAll('.lpk-thumb')].every((t) => /hero_/.test(getComputedStyle(t).backgroundImage) || t.classList.contains('lpk-auto'))), 'each shows a picture of its scene');
  await page.locator('[data-landing-opt="daydream"]').click();
  check(await page.locator('.lpk-opt[aria-checked="true"]').getAttribute('data-landing-opt') === 'daydream', 'Daydream is chosen');
  await page.locator('[data-landing-opt="daydream"]').focus();
  await page.keyboard.press('ArrowLeft');
  check(await page.evaluate(() => localStorage.getItem('frombirth.landing')) === 'midnight', 'the arrow keys choose too');
  await page.keyboard.press('ArrowRight');
  const icon = await page.evaluate(() => localStorage.getItem('frombirth.appIcon'));
  const theme = await page.evaluate(() => localStorage.getItem('frombirth.theme'));
  await page.locator('#modal-root [data-done]').click();
  await page.reload(); await toTitle(page);
  check(await look(page) === 'daydream', 'the choice is kept after a reload');
  check(icon === null && theme === 'light', 'choosing a landing page leaves the app icon and the theme alone');
  await page.evaluate(async () => (await import('/js/theme.js')).setTheme('dark'));
  await page.evaluate(async () => (await import('/js/appIcon.js')).setAppIcon('midnight'));
  await page.reload(); await toTitle(page);
  check(await look(page) === 'daydream', 'changing the theme or the app icon leaves the landing page alone');
  check(!page.errors.length, `settings: no page errors (${page.errors.join('; ')})`);
  await page.close();
}

// 3. The buttons, the lives, the graves, and nothing changed by looking.
{
  const page = await freshPage();
  await page.reload(); await toTitle(page);
  check(/Your next life is waiting/.test(await page.locator('#lp-lives').locator('..').innerText()) && /Your stories will live on here/.test(await page.locator('#lp-past').locator('..').innerText()), 'with nothing saved, the welcoming empty states show');
  check(await page.locator('.lp-card').count() === 0, 'and no made-up lives');
  // Two real lives and a real grave.
  const ids = await page.evaluate(async () => {
    const { createLife } = await import('/js/engine/characterGen.js');
    const { saveGame, addToGraveyard } = await import('/js/save.js');
    const a = createLife({ countryId: 'us' }); a.player.age = 31; saveGame(a);
    const b = createLife({ countryId: 'jp' }); b.player.age = 12; saveGame(b);
    addToGraveyard({ id: 'grave_t', fullName: 'Ada Old', gender: 'female', ageAtDeath: 88, birthYear: 1900, deathYear: 1988, causeOfDeath: 'old age', netWorth: 0, countryId: 'uk', city: 'London', epitaphIds: [], milestones: [], counters: {}, generation: 1,
      portrait: { gender: 'female', appearance: a.player.appearance, seed: 'ada' } });
    return { a: a.slotId, b: b.slotId, an: a.player.firstName, bn: b.player.firstName };
  });
  await page.reload(); await toTitle(page);
  const before = await stored(page);
  check(await page.locator('.lp-card [data-load]').count() === 2 && await page.locator('[data-grave]').count() === 1, 'two lives and one past life are listed');
  check(/Ada Old/.test(await page.locator('[data-grave]').innerText()) && /1900–1988/.test(await page.locator('[data-grave]').innerText()), 'the past life is the real record');
  check(await page.evaluate(() => !!document.querySelector('[data-grave] .lp-face svg')), 'with the face it had');
  // The menu: Back keeps everything; Delete asks, and Cancel keeps the save.
  await page.locator(`[data-more="${ids.b}"]`).click();
  check(/Delete this life/.test(await page.locator('#modal-root').innerText()), 'the menu offers deleting, apart from the card');
  await page.locator('#modal-root .choice-btn', { hasText: 'Delete this life' }).click();
  await page.waitForTimeout(150);
  await page.locator('#modal-root button', { hasText: /cancel|keep|no/i }).last().click();
  await page.waitForTimeout(150);
  check(await page.locator(`[data-load="${ids.b}"]`).count() === 1 && JSON.stringify(await stored(page)) === JSON.stringify(before), 'canceling a delete keeps the life, and nothing stored has changed');
  // Continue loads the right life.
  await page.locator(`[data-load="${ids.b}"]`).click();
  await page.waitForSelector('[data-year]');
  check(await page.evaluate(async () => (await import('/js/state.js')).store.state.slotId) === ids.b, 'Continue loads the life that was tapped');
  await page.evaluate(() => { sessionStorage.clear(); localStorage.removeItem('frombirth.session.playing'); }); await page.goto(`http://localhost:${port}/index.html`); await toTitle(page);
  // The other buttons open what they always opened.
  await page.click('[data-world]');
  check(await page.locator('#modal-root .scrim').count() >= 1, 'The World opens');
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  await page.click('[data-settings]');
  check(/Appearance/.test(await page.locator('#modal-root').innerText()), 'Settings opens');
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  await page.click('[data-design]');
  await page.waitForTimeout(300);
  check(!(await page.locator('[data-random]').count()), 'Design a Life opens the creator');
  await page.evaluate(() => { sessionStorage.clear(); localStorage.removeItem('frombirth.session.playing'); }); await page.goto(`http://localhost:${port}/index.html`); await toTitle(page);
  await page.click('[data-random]');
  await page.waitForSelector('[data-year]', { timeout: 8000 }).catch(() => {});
  check(await page.locator('[data-year]').count() > 0, 'Begin a Random Life starts a life');
  check(!page.errors.length, `lives: no page errors (${page.errors.join('; ')})`);
  await page.close();
}

// 4. Narrow phones: nothing clipped or scrolling sideways.
for (const width of [320, 360, 430]) {
  const page = await freshPage({ viewport: { width, height: 700 } });
  await page.evaluate(async () => { const { createLife } = await import('/js/engine/characterGen.js'); const { saveGame } = await import('/js/save.js'); const s = createLife(); s.player.firstName = 'Maximiliana-Josephine'; saveGame(s); });
  await page.reload(); await toTitle(page);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && [...document.querySelectorAll('.lp-btn, .lp-util, .lp-card')].every((e) => e.getBoundingClientRect().right <= window.innerWidth + 1)), `${width}px: nothing scrolls sideways or is clipped`);
  const h = await page.evaluate(() => document.querySelector('[data-random]').getBoundingClientRect().height);
  check(h >= 56 && h <= 66, `${width}px: the main button is a comfortable size (${h})`);
  await page.close();
}

await browser.close();
server.close();
if (problems.length) { console.log(`${problems.length} problem(s):\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log('Every life starts here.');
