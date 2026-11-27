// The iOS app's build (www/), in a browser at phone size, as far as a browser can stand in for the app:
//   - the website still loads and plays;
//   - a life played on the website moves into the app through Settings → Transfer saves (copy, paste, load), and
//     opens there at the same age;
//   - the app runs with no connection at all (every request outside the app is refused), with its own fonts, and
//     without a service worker;
//   - Age up with turns of 12, 6 and 3 months;
//   - with a stand-in for the native side (window.Capacitor): haptics, the status bar, the share sheet for transfer
//     files, the on-device save backup and its restore after the WebView's storage is wiped, the keyboard going away
//     on a tap outside, and going to the background and back;
//   - no sideways scrolling on three iPhone widths, light and dark, at normal and larger text; dialogs scroll.
// What it cannot show: real safe areas (a browser reports none), WKWebView itself, VoiceOver, real haptics or
// iCloud backup. Those are on the device checklist in docs/IOS_APP.md.
// Needs Playwright (preinstalled where the checks run). Run with: node tests/app-ui.mjs   (SHOT=dir for screenshots)
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { buildApp } from '../scripts/build-app.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  try { ({ chromium } = require(join(process.execPath, '../../lib/node_modules/playwright'))); } catch { console.log('Playwright is not available here: browser check skipped.'); process.exit(0); }
}

const repo = new URL('..', import.meta.url).pathname;
const www = await mkdtemp(join(tmpdir(), 'frombirth-app-'));
buildApp(www);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const serve = (root) => new Promise((resolve) => {
  const s = createServer(async (req, res) => {
    const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!path.startsWith(root)) { res.writeHead(403); return res.end(); }
    try { const body = await readFile(path.endsWith('/') ? join(path, 'index.html') : path); res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }); res.end(body); }
    catch { res.writeHead(404); res.end(); }
  }).listen(0, () => resolve(s));
});
const webServer = await serve(repo);
const appServer = await serve(www.endsWith('/') ? www : `${www}/`);
const WEB = `http://localhost:${webServer.address().port}`;
const APP = `http://localhost:${appServer.address().port}`;

const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m, n) => ok.push(problems.length === n ? m : `(failed) ${m}`);
const SHOT = process.env.SHOT;
const browser = await chromium.launch();

// ---------- The stand-in for the native side ----------
// Files live here, outside the page, so they outlast a reload and a wiped localStorage, as files in the app's
// Library folder outlast the WebView's storage.
const files = new Map();
const calls = [];
async function nativePage(ctx) {
  const page = await ctx.newPage();
  await page.exposeFunction('__native', (kind, arg) => {
    calls.push({ kind, arg });
    if (kind === 'fs.write') { files.set(arg.path, arg.data); return { uri: `file:///${arg.directory}/${arg.path}` }; }
    if (kind === 'fs.read') return files.has(arg.path) ? { data: files.get(arg.path) } : { error: 'File does not exist' };
    if (kind === 'fs.stat') return files.has(arg.path) ? { size: files.get(arg.path).length } : { error: 'File does not exist' };
    if (kind === 'fs.delete') { const had = files.delete(arg.path); return had ? {} : { error: 'File does not exist' }; }
    if (kind === 'fs.rename') { if (!files.has(arg.from)) return { error: 'File does not exist' }; files.set(arg.to, files.get(arg.from)); files.delete(arg.from); return {}; }
    return {};
  });
  await page.addInitScript(() => {
    const call = async (kind, arg) => { const r = await window.__native(kind, arg); if (r?.error) throw new Error(r.error); return r; };
    const P = {
      Haptics: { impact: (o) => call('haptics.impact', o), notification: (o) => call('haptics.notification', o) },
      StatusBar: { setStyle: (o) => call('statusbar.style', o) },
      Share: { share: (o) => call('share', o) },
      App: { addListener: (ev, fn) => { (window.__appListeners ??= {})[ev] = fn; return Promise.resolve({ remove() {} }); } },
      Keyboard: {},
      Filesystem: {
        writeFile: (o) => call('fs.write', o), readFile: (o) => call('fs.read', o), stat: (o) => call('fs.stat', o),
        deleteFile: (o) => call('fs.delete', o), rename: (o) => call('fs.rename', o),
      },
    };
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', isPluginAvailable: (n) => n in P, registerPlugin: (n) => P[n], Plugins: P };
  });
  return page;
}

// ---------- Playing, through the screens ----------
const errorsOf = (page) => { page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message)); return page; };
async function toTitle(page) {
  for (let i = 0; i < 40 && !(await page.locator('[data-random]').count()); i++) {
    await page.locator('#app button:not([data-random]):not([data-design]):not([data-load]), #modal-root button').filter({ hasText: /continue|start|ok|got it|begin/i }).first().click({ timeout: 500 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  await page.waitForSelector('[data-random]', { timeout: 30000 });
}
/** Answers whatever scenes and messages are open, until none are. */
async function settle(page) {
  for (let i = 0; i < 40; i++) {
    const open = page.locator('#modal-root .modal');
    if (!(await open.count())) return;
    // OK first, then Done/Cancel/Close (a menu), and only then a scene's first answer.
    let clicked = false;
    for (const sel of ['[data-ok]', '[data-cancel]', '[data-close]', '[data-done]', '.choice-btn:not([disabled])', '.btn.primary']) {
      const btn = open.last().locator(sel).first();
      if (await btn.count()) { await btn.click({ timeout: 2000 }).catch(() => {}); clicked = true; break; }
    }
    if (!clicked) await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
  }
}
const player = (page) => page.evaluate(async () => { const { store } = await import('./js/state.js'); const s = store.state; return s ? { age: s.player.age, month: s.month ?? 0, step: s.settings?.step ?? 12, name: s.player.firstName, slotId: s.slotId } : null; });
/** One turn: Age up is pressed (again, if a scene that opened late took the first press) until the calendar moves. */
async function ageUp(page) {
  const was = JSON.stringify(await player(page));
  for (let i = 0; i < 3; i++) {
    await settle(page);
    await page.click('[data-year]');
    for (let t = 0; t < 25 && JSON.stringify(await player(page)) === was; t++) await page.waitForTimeout(100);
    if (JSON.stringify(await player(page)) !== was) break;
  }
  await page.waitForTimeout(250);
  await settle(page);
}
async function choose(page, re) { await page.locator('#modal-root .modal').last().locator('.choice-btn').filter({ hasText: re }).first().click(); await page.waitForTimeout(150); }
async function openSettingsInGame(page) { await settle(page); await page.click('[data-menu]'); await choose(page, /^\s*Settings/); }
async function setStep(page, months) {
  await openSettingsInGame(page);
  await choose(page, /Time per turn/);
  await choose(page, months === 12 ? /A year/ : months === 6 ? /Six months/ : /Three months/);
  await settle(page); // the message, then Settings itself (Done)
  const done = page.locator('#modal-root .modal [data-cancel]');
  if (await done.count()) await done.last().click();
  await settle(page);
}
const startLife = async (page) => {
  await page.evaluate(() => localStorage.setItem('frombirth.birthGlobe', 'off'));
  await page.click('[data-random]');
  await page.waitForSelector('[data-year]', { timeout: 30000 });
  await settle(page);
};

let code = ''; let webLife = null;

// 1. The website still loads and plays, and makes a transfer code through Settings.
{
  const n = problems.length;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = errorsOf(await ctx.newPage());
  await page.goto(`${WEB}/index.html`);
  await toTitle(page);
  check(await page.locator('.lp-logo').count() === 1, 'the website shows its title screen');
  await startLife(page);
  for (let i = 0; i < 6; i++) await ageUp(page);
  webLife = await player(page);
  check(webLife?.age >= 5, `a life is played on the website (age ${webLife?.age})`);
  await openSettingsInGame(page);
  await choose(page, /Transfer saves/);
  await choose(page, /Copy a transfer code/);
  await page.waitForTimeout(300);
  const box = page.locator('#modal-root textarea.code-box');
  code = (await box.count()) ? await box.inputValue() : await page.evaluate(() => navigator.clipboard.readText());
  check(code.startsWith('FROMBIRTH1:'), `Settings → Transfer saves gives a transfer code (${code.slice(0, 14)}…, ${code.length} characters)`);
  check(page.errors.length === 0, `no errors on the website: ${page.errors.join(' | ')}`);
  await ctx.close();
  section('the website still loads, plays, and makes a transfer code', n);
}

// 2. The app: no connection, its own fonts, no service worker; the website's life comes in through Load saves.
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: SHOT ? 2 : 1 });
const outside = [];
await ctx.route('**/*', (route) => { const u = new URL(route.request().url()); if (u.origin === APP) return route.continue(); outside.push(u.href); return route.abort(); });
const page = errorsOf(await nativePage(ctx));
{
  const n = problems.length;
  await page.goto(`${APP}/index.html`);
  await toTitle(page);
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
  check(loaded.includes('Nunito Sans') && loaded.includes('Nunito'), `the app draws its text in its own copies of Nunito Sans and Nunito (${[...new Set(loaded)]})`);
  check(await page.evaluate(async () => (navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0)) === 0, 'the app registers no service worker');
  await page.click('[data-settings]');
  await choose(page, /Transfer saves/);
  await choose(page, /Load saves/);
  await page.fill('#t-code', code);
  await page.click('#modal-root [data-go]');
  await page.waitForSelector('#modal-root .modal:has-text("Saves loaded")', { timeout: 10000 });
  await settle(page);
  const done = page.locator('#modal-root .modal [data-cancel]');
  if (await done.count()) await done.last().click();
  await settle(page);
  await page.waitForSelector(`[data-load="${webLife.slotId}"]`, { timeout: 10000 });
  await page.click(`[data-load="${webLife.slotId}"]`);
  await page.waitForSelector('[data-year]');
  await settle(page);
  const here = await player(page);
  check(here?.slotId === webLife.slotId && here.age === webLife.age && here.name === webLife.name, `the website's life opens in the app as the same person at the same age (${webLife.name}, ${webLife.age} → ${here?.name}, ${here?.age})`);
  section('a life moves from the website into the app through Transfer saves', n);
}

// 3. Age up: a year, six months, three months.
{
  const n = problems.length;
  calls.length = 0;
  const a = (await player(page)).age;
  await ageUp(page);
  check((await player(page)).age === a + 1, '12 months: one turn is a year');
  check(calls.some((c) => c.kind === 'haptics.impact'), 'Age up gives the system\'s own haptic tap in the app');
  await setStep(page, 6);
  let p = await player(page);
  check(p.step === 6 && p.month === 0, `the turn is now six months (${p.step})`);
  await ageUp(page); p = await player(page);
  check(p.age === a + 1 && p.month === 6, `6 months: half way through the year (${p.age}, ${p.month} months)`);
  await ageUp(page); p = await player(page);
  check(p.age === a + 2 && p.month === 0, `6 months: two turns make the year (${p.age})`);
  await setStep(page, 3);
  for (const m of [3, 6, 9]) { await ageUp(page); p = await player(page); check(p.age === a + 2 && p.month === m, `3 months: ${m} months in (${p.age}, ${p.month})`); }
  await ageUp(page); p = await player(page);
  check(p.age === a + 3 && p.month === 0, `3 months: four turns make the year (${p.age})`);
  await setStep(page, 12);
  await ageUp(page); p = await player(page);
  check(p.age === a + 4 && p.step === 12, 'and back to a year a turn');
  section('Age up with turns of 12, 6 and 3 months', n);
}

// 4. The save backup: written in the app's Library, and brought back when the WebView's storage is wiped.
{
  const n = problems.length;
  await page.waitForTimeout(2500); // the backup is written a moment after the last save
  const backup = files.get('saves/backup.fbsave') ?? '';
  check(backup.startsWith('FROMBIRTH1:') && calls.some((c) => c.kind === 'fs.write' && c.arg.directory === 'LIBRARY'), 'the saves are copied to a file in the app\'s Library folder');
  const before = await player(page);
  // Going to the background writes it at once.
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  check(await page.locator('[data-year]').count() === 1 && (await player(page)).age === before.age, 'back from the background, the same life is on screen');
  // The system clears the app's website data.
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.waitForSelector('#modal-root .modal:has-text("Saves recovered")', { timeout: 15000 });
  check(true, 'the app says its saves were recovered');
  await settle(page);
  await toTitle(page);
  await page.click(`[data-load="${before.slotId}"]`);
  await page.waitForSelector('[data-year]');
  await settle(page);
  const back = await player(page);
  check(back.age === before.age && back.month === before.month, `the life is back at the same age (${before.age} → ${back.age})`);
  section('the on-device backup brings lives back after the WebView loses them', n);
}

// 5. A transfer file in the app goes through the share sheet; the theme sets the status bar.
{
  const n = problems.length;
  calls.length = 0;
  await openSettingsInGame(page);
  await choose(page, /Transfer saves/);
  await choose(page, /Save a transfer file/);
  await page.waitForSelector('#modal-root .modal:has-text("Transfer file ready")', { timeout: 10000 });
  const shared = calls.find((c) => c.kind === 'share');
  const file = calls.find((c) => c.kind === 'fs.write' && c.arg.directory === 'CACHE');
  check(shared && file && shared.arg.files?.[0]?.endsWith(file.arg.path) && file.arg.data.startsWith('FROMBIRTH1:'), 'Save a transfer file writes the code and opens the share sheet with it');
  await settle(page);
  const done = page.locator('#modal-root .modal [data-cancel]');
  if (await done.count()) await done.last().click();
  await settle(page);
  calls.length = 0;
  await page.evaluate(async () => { const t = await import('./js/theme.js'); t.setTheme('dark'); t.setTheme('light'); });
  const styles = calls.filter((c) => c.kind === 'statusbar.style').map((c) => c.arg.style);
  check(styles.join() === 'DARK,LIGHT', `the status bar follows the theme (${styles})`);
  section('share sheet and status bar', n);
}

// 6. The keyboard goes away on a tap outside the field.
{
  const n = problems.length;
  await openSettingsInGame(page);
  await choose(page, /Transfer saves/);
  await choose(page, /Load saves/);
  await page.locator('#t-code').tap();
  check(await page.evaluate(() => document.activeElement?.id) === 't-code', 'tapping the code box gives it the keyboard');
  const h = await page.locator('#modal-root .modal h2').last().boundingBox();
  await page.touchscreen.tap(h.x + 10, h.y + h.height / 2);
  check(await page.evaluate(() => document.activeElement?.id) !== 't-code', 'tapping outside it puts the keyboard away');
  await page.locator('#modal-root [data-cancel]').last().click();
  await settle(page);
  const done = page.locator('#modal-root .modal [data-cancel]');
  if (await done.count()) await done.last().click();
  await settle(page);
  section('the keyboard is dismissed by a tap outside', n);
}
check(outside.length === 0, `the app asked for nothing outside itself: ${[...new Set(outside)].slice(0, 5).join(', ')}`);
check(page.errors.length === 0, `no errors in the app: ${page.errors.join(' | ')}`);
ok.push(outside.length === 0 ? 'the app works with no connection at all' : '(failed) the app works with no connection at all');
await ctx.close();

// 7. Phone layouts: no sideways scrolling, light and dark, normal and larger text; dialogs fit and scroll.
{
  const n = problems.length;
  for (const vp of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    for (const scheme of ['light', 'dark']) {
      for (const text of [100, 130]) {
        const c = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true, colorScheme: scheme, deviceScaleFactor: SHOT ? 2 : 1 });
        await c.route('**/*', (route) => (new URL(route.request().url()).origin === APP ? route.continue() : route.abort()));
        const p = errorsOf(await c.newPage());
        const at = `${vp.width}×${vp.height} ${scheme} ${text}%`;
        await p.goto(`${APP}/index.html`);
        if (text !== 100) await p.addStyleTag({ content: `html { font-size: ${text}% !important; }` });
        await toTitle(p);
        const wide = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(await wide() <= 1, `${at}: the title screen does not scroll sideways (${await wide()}px)`);
        await startLife(p);
        await ageUp(p);
        check(await wide() <= 1, `${at}: the game does not scroll sideways (${await wide()}px)`);
        const yb = await p.locator('[data-year]').boundingBox();
        check(yb && yb.y + yb.height <= vp.height && yb.width >= 44 && yb.height >= 44, `${at}: Age up is on screen and big enough to tap`);
        await p.click('[data-menu]');
        await choose(p, /^\s*Settings/);
        const fit = await p.evaluate(() => {
          const m = [...document.querySelectorAll('#modal-root .modal')].pop();
          const r = m.getBoundingClientRect(); const cs = getComputedStyle(m);
          return { inside: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1, scrolls: m.scrollHeight <= m.clientHeight + 1 || /auto|scroll/.test(cs.overflowY), wide: document.documentElement.scrollWidth - innerWidth };
        });
        check(fit.inside && fit.scrolls && fit.wide <= 1, `${at}: Settings fits the screen and scrolls (${JSON.stringify(fit)})`);
        if (SHOT) await p.screenshot({ path: join(SHOT, `app-${vp.width}-${scheme}-${text}.png`) });
        check(p.errors.length === 0, `${at}: no errors (${p.errors.join(' | ')})`);
        await c.close();
      }
    }
  }
  section('phone layouts: three widths, light and dark, normal and larger text', n);
}

await browser.close();
webServer.close(); appServer.close();
await rm(www, { recursive: true, force: true });
for (const line of ok) console.log(line);
if (problems.length) { console.log(`\n${problems.length} problem(s):`); for (const p of problems) console.log(` - ${p}`); process.exit(1); }
console.log('\nThe app runs the game: offline, on a phone, with its saves kept safe.');
