// Browser check of My Health → Reproductive health → Birth Control & Family Planning at phone and desktop widths:
// the section and its page open, every tab fits without sideways scrolling, four methods compare on their
// characteristics, and an arm implant can be chosen through the screens (a clinician picked, a visit paid), then shown
// as the current method and kept on reload. Needs Playwright. Run with: node tests/contraception-ui.mjs
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
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => localStorage.setItem('pathways.birthGlobe', 'off')); await page.click('[data-random]');
  await page.waitForSelector('[data-year]');
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  // A twenty-three-year-old in the US, with money and a partner, opening My Health on Reproductive health.
  await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const { makeNpc } = await import('/js/engine/npcFactory.js');
    const p = store.state.player;
    p.countryId = 'us'; p.city = (await import('/js/data/countries.js')).COUNTRIES.us.cities[0];
    p.age = 23; p.birthYear = store.state.year - 23; p.gender = 'female'; p.flags.bornAs = 'female'; p.flags.identity = null;
    p.legal.incarceration = null; p.finance.cash = 50000; p.flags.livesWithParents = false;
    const n = makeNpc({ role: 'partner', countryId: 'us', age: 24, gender: 'male', relationship: 80 }); n.flags.bornAs = 'male';
    store.state.npcs[n.id] = n; p.npcIds.push(n.id);
    const { openHealth } = await import('/js/ui/health/hub.js');
    window.__api = { changed() {}, rerender() {} };
    openHealth(window.__api, { section: 'repro' });
  });
  const modal = '#modal-root .scrim:last-child .modal';
  await page.waitForSelector(modal);
  const overflow = () => page.evaluate(() => { const m = [...document.querySelectorAll('#modal-root .modal')].pop(); return m.scrollWidth > m.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth; });
  const text = () => page.evaluate(() => [...document.querySelectorAll('#modal-root .modal')].pop().innerText);
  check(/Birth control & family planning/i.test(await text()) && /Life stage/i.test(await text()), `${label}: Reproductive health shows birth control and the life stage`);
  check(!(await overflow()), `${label}: the section does not scroll sideways`);
  await page.click(`${modal} [data-act="bc"]`);
  check(/Birth Control & Family Planning/.test(await text()), `${label}: the page opens`);
  const tabs = await page.locator(`${modal} [data-bctab]`).evaluateAll((els) => els.map((x) => x.dataset.bctab));
  check(['current', 'explore', 'compare', 'eligibility', 'appointments', 'concerns', 'change', 'planning', 'history'].every((t) => tabs.includes(t)), `${label}: nine sections (${tabs.join(', ')})`);
  for (const t of tabs) {
    await page.click(`${modal} [data-bctab="${t}"]`);
    check(!(await overflow()), `${label}: ${t} does not scroll sideways`);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/bc-${label}-${t}.png` });
  }
  await page.click(`${modal} [data-bctab="compare"]`);
  const cmp = await text();
  check(['Hormonal IUD (larger)', 'Copper IUD', 'Arm implant', 'Combined pill'].every((n) => cmp.toLowerCase().includes(n.toLowerCase())) && /Pregnancies, first year/i.test(cmp) && !/score|safety:/i.test(cmp), `${label}: four methods compared on characteristics, no score`);
  // Choose an implant from Explore: a clinician, then it is in use.
  await page.click(`${modal} [data-bctab="explore"]`);
  await page.click(`${modal} [data-act="bcStart"][data-arg="implant"]`);
  await page.waitForSelector('#modal-root .scrim:last-child .choice-btn:not([disabled])');
  await page.locator('#modal-root .scrim:last-child .choice-btn:not([disabled])').first().click();
  await page.waitForTimeout(150);
  // The result message, then back to the page.
  const msg = await text();
  check(/places your arm implant/i.test(msg), `${label}: the implant is placed (${msg.slice(0, 90)})`);
  await page.locator('#modal-root .scrim:last-child .btn').first().click();
  await page.waitForTimeout(100);
  await page.click(`${modal} [data-bctab="current"]`);
  const cur = await text();
  check(/Arm implant/i.test(cur) && /In use/i.test(cur) && /Replacement or removal by/i.test(cur), `${label}: the current method shows status and when it is due`);
  check(!(await overflow()), `${label}: the current method does not scroll sideways`);
  const saved = await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const { saveGame, loadGame } = await import('/js/save.js');
    saveGame(store.state);
    const back = loadGame(store.state.slotId);
    return back.player.health.contraception.methods.map((r) => `${r.methodId}:${r.status}:${r.deviceId ? 1 : 0}`);
  });
  check(saved.length === 1 && saved[0] === 'implant:active:1', `${label}: saved and reloaded: one implant (${saved.join(', ')})`);
  // The partner's profile: "Try for a baby" is there, greyed out, with the reason (the implant) underneath.
  const baby = await page.evaluate(async () => {
    document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove());
    const { store } = await import('/js/state.js');
    const p = store.state.player;
    const n = p.npcIds.map((id) => store.state.npcs[id]).find((x) => x?.role === 'partner');
    const { openNpc } = await import('/js/ui/tabs/people.js');
    openNpc(n, window.__api);
    await new Promise((r) => setTimeout(r, 150));
    const b = document.querySelector('#modal-root [data-act="baby"]');
    const ivf = document.querySelector('#modal-root [data-act="ivf"]');
    return b ? { disabled: b.disabled, text: b.innerText, why: b.querySelector('small')?.innerText ?? '', ivf: ivf ? ivf.disabled : null } : null;
  });
  check(baby && baby.disabled && /implant/i.test(baby.why) && /removed first/i.test(baby.why) && baby.ivf !== false, `${label}: "Try for a baby" is greyed out with the reason underneath (${JSON.stringify(baby)})`);
  if (process.env.SHOT) { await page.evaluate(() => document.querySelector('#modal-root [data-act="baby"]')?.scrollIntoView({ block: 'center' })); await page.screenshot({ path: `${process.env.SHOT}/bc-${label}-baby.png` }); }
  check(!(await overflow()), `${label}: the profile does not scroll sideways`);
  // No method now, and not planning a pregnancy: a night together brings the emergency contraception choice at once.
  const ec = await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const C = await import('/js/engine/health/contraception.js');
    const p = store.state.player;
    for (const r of C.active(p)) if (C.def(r).remove) C.removeDevice(r.id, { provider: C.defaultProvider(C.def(r).remove) });
    C.legacySwitch(false); C.setPlanning('not');
    const n = p.npcIds.map((id) => store.state.npcs[id]).find((x) => x?.role === 'partner');
    // What the game does with scenes an action queued (ui/shell.js pending): here, note the emergency decision was there.
    window.__pending = async () => { if (store.state.pendingEvents.some((e) => e.id === 'repro_ec')) window.__ecSeen = true; store.state.pendingEvents = []; };
    document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove());
    const { openNpc } = await import('/js/ui/tabs/people.js');
    for (let i = 0; i < 25; i++) {
      n.meters.relationship = 95; n.flags.acts = {};
      openNpc(n, { changed() {}, rerender() {}, pending: window.__pending });
      await new Promise((r) => setTimeout(r, 80));
      const b = document.querySelector('#modal-root [data-act="bondIntimate"], #modal-root [data-act="hookUp"]');
      if (!b) return 'no button';
      b.click();
      await new Promise((r) => setTimeout(r, 120));
      document.querySelector('#modal-root .scrim:last-child .btn')?.click(); // the night's message
      await new Promise((r) => setTimeout(r, 120));
      if (window.__ecSeen) return 'shown';
      document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove());
    }
    return 'never';
  }).catch((e) => `error ${e.message}`);
  check(ec === 'shown', `${label}: the emergency contraception decision is asked straight after the night (${ec})`);
  check(!errors.length, `${label}: no page errors (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('Birth control and family planning work in the browser, on a phone and a desktop.');
