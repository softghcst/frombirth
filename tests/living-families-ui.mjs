// Browser check of the living-family screens at phone and desktop width: moving out (Holdings), fostering (Self ›
// Love and Family), and the step-family in the family tree. Needs Playwright. Run with: node tests/living-families-ui.mjs
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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
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

async function openTab(page, id) {
  for (let i = 0; i < 2 && await page.locator('[data-panel]:not([hidden]) [data-panel-close]').count(); i++) await page.click('[data-panel-close]');
  await page.click(`.tab-btn[data-tab="${id}"]`);
}
const clearModals = (page) => page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 860 }]) {
  const size = viewport.width < 600 ? 'phone' : 'desktop';
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // A life of twenty-five, at home, with a separated family and a step-parent, saved and loaded through the title screen.
  const slot = await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const { createLife } = await import('/js/engine/characterGen.js');
    const { saveGame } = await import('/js/save.js');
    const B = await import('/js/engine/blended.js');
    let s; do { s = createLife({ countryId: 'us' }); } while (s.player.royal || s.player.flags.parentsStatus !== 'together' || Object.values(s.npcs).filter((n) => n.role === 'parent').length !== 2);
    store.state = s;
    const p = s.player;
    const [a, b] = Object.values(s.npcs).filter((n) => n.role === 'parent');
    p.age = 8; B.separateParents(a, b); B.meetParentPartner(a, { kids: 1 });
    p.age = 25; p.birthYear = s.year - 25; p.finance.cash = 50000; p.flags.livesWithParents = true; p.education.enrolled = false;
    s.pendingEvents = [];
    saveGame(s);
    return s.slotId;
  });
  await page.reload();
  await page.click(`[data-load="${slot}"]`);
  await page.waitForSelector('.tab-btn[data-tab="holdings"]');
  await clearModals(page);

  // Moving out.
  await openTab(page, 'holdings');
  await page.waitForSelector('[data-go="moveout"]', { timeout: 5000 }).catch(() => {});
  check(await page.locator('[data-go="moveout"]').count() === 1, `${size}: Holdings offers Move out to an adult at home`);
  await page.click('[data-go="moveout"]');
  await page.locator('#modal-root .choice-btn').first().click();
  await page.locator('#modal-root .choice-btn', { hasText: 'Live alone' }).click();
  await page.waitForSelector('#modal-root [data-ok], #modal-root .btn.primary');
  const said = await page.locator('#modal-root .modal').last().innerText();
  check(/signed a lease/.test(said) && /deposit/.test(said), `${size}: moving out signs a lease and takes a deposit (${said.slice(0, 80)})`);
  await clearModals(page);
  const lives = await page.evaluate(async () => { const { store } = await import('/js/state.js'); return { home: store.state.player.flags.livesWithParents, leases: store.state.player.leases?.length }; });
  check(lives.home === false && lives.leases === 1, `${size}: and the player lives in their own place now`);
  await openTab(page, 'holdings');
  check(await page.locator('[data-go="homes"]').count() === 1, `${size}: with a list of places lived`);

  // Fostering, from the Self tab.
  await openTab(page, 'self');
  await page.click('[data-lovefam="foster"]');
  await page.waitForSelector('#modal-root [data-foster]');
  const text = await page.locator('#modal-root [data-foster]').innerText();
  check(/Fostering/.test(text) && /agency and a court/.test(text), `${size}: the fostering screen explains who decides`);
  check(await page.locator('#modal-root [data-apply]').count() === 1, `${size}: and offers to apply`);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!wide, `${size}: nothing runs off the side`);
  await clearModals(page);

  // The family tree shows the step-family apart from the parents.
  await openTab(page, 'people');
  await page.locator('[data-top="tree"]').first().click();
  await page.waitForSelector('#modal-root .tree');
  const tree = await page.locator('#modal-root .tree').innerText();
  check(/Step-family/i.test(tree) && /lives apart/.test(tree), `${size}: the family tree has a step-family, and says who lives apart`);
  await clearModals(page);
  check(!errors.length, `${size}: no page errors (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
if (problems.length) { console.log(`FAIL living-families-ui:\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('ok living-families-ui');
