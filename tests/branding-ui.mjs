// Browser check of the From Birth brand: the landing page shows the supplied logo (no second title), the tagline, the
// same controls; light and dark both look right; Settings → Appearance → App Icon offers the three icons, keeps the
// choice across a reload, apart from the theme, and restores the default; saved lives still load. Phone and desktop.
// Needs Playwright (preinstalled where the checks run). Run with: node tests/branding-ui.mjs   (SHOT=dir for screenshots)
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
const toTitle = async (page) => {
  // Past the opening notice, onto the title screen.
  for (let i = 0; i < 30 && !(await page.locator('[data-random]').count()); i++) {
    // Only a notice in front of the title screen is dismissed: never a button on the title screen itself (a saved life's
    // card says "Continue", and clicking it would load that life and leave the title screen for good).
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('#modal-root button, #app button')].find((x) => !x.closest('.title-screen') && /continue|start|ok|got it|begin/i.test(x.innerText));
      b?.click();
    });
    await page.waitForTimeout(150);
  }
  // A busy machine (the whole suite at once, several browsers) can take a while to draw the title screen.
  await page.waitForSelector('[data-random]', { timeout: 60000 });
};
for (const [label, viewport] of [['phone', { width: 390, height: 844 }], ['small', { width: 320, height: 640 }], ['desktop', { width: 1280, height: 900 }]]) {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: label === 'phone' ? 2 : 1, colorScheme: scheme });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${port}/index.html`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await toTitle(page);
    const tag = `${label}/${scheme}`;
    // The logo, as supplied: loaded, its own proportions, alt text, no card, no second title.
    const logo = await page.evaluate(() => { const i = document.querySelector('.lp-hero img.lp-logo'); const r = i?.getBoundingClientRect();
      return i && { alt: i.alt, loaded: i.complete && i.naturalWidth > 0, w: r.width, h: r.height, left: r.left, right: window.innerWidth - r.right, src: i.getAttribute('src'),
        text: document.querySelector('.lp-hero').innerText.trim(), bg: getComputedStyle(i).backgroundColor, radius: getComputedStyle(i).borderRadius }; });
    check(logo && logo.alt === 'From Birth' && logo.loaded && /from_birth_logo/.test(logo.src), `${tag}: the landing page shows the supplied From Birth logo`);
    check(logo && Math.abs(logo.w / logo.h - 1123 / 1401) < 0.01, `${tag}: the logo keeps its proportions (${logo?.w}x${logo?.h})`);
    check(logo && Math.abs(logo.left - logo.right) < 2, `${tag}: the logo is centered`);
    check(logo && (label === 'desktop' || (logo.w >= 120 && logo.w <= 182)), `${tag}: the logo is phone-sized (${logo?.w})`);
    check(logo && logo.text === 'Your life. Your choices. Your story.' && !(await page.locator('.title-mark').count()), `${tag}: the tagline, and no second title or old mark (${logo?.text})`);
    check(logo && /rgba\(0, 0, 0, 0\)|transparent/.test(logo.bg) && logo.radius === '0px', `${tag}: no card or square behind the logo`);
    const actions = await page.evaluate(() => ['[data-random]', '[data-design]', '[data-world]', '[data-settings]'].every((s) => document.querySelector(s)) && /Your Lives/i.test(document.body.innerText) && /Past Lives/i.test(document.body.innerText));
    check(actions, `${tag}: Begin a Random Life, Design a Life, The World, Settings, Your Lives and Past Lives are all there`);
    const random = await page.locator('[data-random]').boundingBox();
    check(label === 'desktop' || random.y + random.height <= viewport.height, `${tag}: the first button is still on screen`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${tag}: nothing scrolls sideways`);
    check(!/Pathways/.test(await page.evaluate(() => document.body.innerText + document.title)), `${tag}: no "Pathways" anywhere a player can see`);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/brand-title-${label}-${scheme}.png` });
    check(!errors.length, `${tag}: no page errors (${errors.join('; ')})`);
    await page.close();
  }
}

// The app icon, on a phone.
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await toTitle(page);
  const openIcons = async () => {
    await page.evaluate(async () => { document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()); (await import('/js/ui/settings.js')).openAppIcon(); });
    await page.waitForSelector('.appicon-grid');
    await page.waitForFunction(() => [...document.querySelectorAll('.appicon-opt img')].every((i) => i.complete), null, { timeout: 5000 }).catch(() => {});
  };
  await openIcons();
  const state = () => page.evaluate(() => ({ checked: [...document.querySelectorAll('.appicon-opt')].map((b) => `${b.dataset.icon}:${b.getAttribute('aria-checked')}`),
    imgs: [...document.querySelectorAll('.appicon-opt img')].map((i) => i.complete && i.naturalWidth > 0), checks: document.querySelectorAll('.appicon-check').length,
    stored: localStorage.getItem('frombirth.appIcon'), favicon: document.querySelector('link[rel="icon"]').getAttribute('href') }));
  let s = await state();
  check(s.checked.join() === 'afterglow:true,midnight:false,daydream:false' && s.checks === 1, `Afterglow is selected by default (${s.checked})`);
  check(s.imgs.length === 3 && s.imgs.every(Boolean), 'the three icons show as real images');
  const cols = await page.evaluate(() => new Set([...document.querySelectorAll('.appicon-opt')].map((b) => Math.round(b.getBoundingClientRect().top))).size);
  check(cols === 1, 'three to a row');
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/brand-appicon-phone.png` });
  await page.locator('[data-icon="midnight"]').click();
  s = await state();
  check(s.checked.includes('midnight:true') && s.stored === 'midnight' && /midnight-32/.test(s.favicon), `Midnight can be chosen; the tab icon follows (${s.favicon})`);
  check(/home screen/i.test(await page.locator('.appicon-note').innerText()), 'it says plainly that a home-screen icon does not change on the web');
  // Keyboard: the arrow keys move the choice.
  await page.locator('[data-icon="midnight"]').focus();
  await page.keyboard.press('ArrowRight');
  s = await state();
  check(s.checked.includes('daydream:true') && s.stored === 'daydream', 'the arrow keys choose, like any radio group');
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/brand-appicon-daydream.png` });
  // Kept across a reload; the theme does not change it.
  await page.reload();
  await toTitle(page);
  check(/daydream-32/.test(await page.evaluate(() => document.querySelector('link[rel="icon"]').getAttribute('href'))), 'after a reload, the tab icon is still Daydream');
  await page.evaluate(async () => (await import('/js/theme.js')).setTheme('dark'));
  await openIcons();
  s = await state();
  check(s.checked.includes('daydream:true'), 'switching to dark leaves the icon alone');
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/brand-appicon-dark.png` });
  await page.locator('[data-restore]').click();
  s = await state();
  check(s.checked.includes('afterglow:true') && s.stored === null && /favicon|afterglow/.test(s.favicon), 'Restore Default goes back to Afterglow');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'the icon screen fits');
  // A saved life still loads.
  await page.locator('[data-done]').click();
  await page.evaluate(async () => { const { createLife } = await import('/js/engine/characterGen.js'); const { saveGame } = await import('/js/save.js'); const s = createLife(); saveGame(s); });
  await page.reload();
  await toTitle(page);
  const load = page.locator('[data-load]').first();
  check(await load.count() === 1, 'the saved life is listed');
  await load.click();
  await page.waitForSelector('[data-year]', { timeout: 5000 }).catch(() => {});
  check(await page.locator('[data-year]').count() > 0, 'and it loads');
  check(!errors.length, `app icon: no page errors (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
if (problems.length) { console.log(`${problems.length} problem(s):\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log('From Birth, in every light.');
