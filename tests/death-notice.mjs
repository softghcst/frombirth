// Browser check of the death notice: when someone in the player's life dies during a turn, Age Up shows a notice
// for them, with their name, what they were to the player, and their years; and a pet's kind reads as words.
// Needs Playwright (preinstalled where the checks run). Serves the game itself. Run with: node tests/death-notice.mjs
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
  await page.evaluate(() => localStorage.setItem('frombirth.birthGlobe', 'off')); await page.click('[data-random]');
  await page.waitForSelector('[data-year]');
  // Clear whatever the new life opens with.
  for (let i = 0; i < 20; i++) {
    if (await page.locator('.modal .choice-btn:not([disabled])').count()) await page.locator('.modal .choice-btn:not([disabled])').first().click();
    else if (await page.locator('.modal [data-ok]').count()) await page.locator('.modal [data-ok]').last().click();
    else break;
    await page.waitForTimeout(120);
  }
  // A guinea pig at the end of its life: it dies at the next Age Up.
  const id = await page.evaluate(async () => {
    const S = await import('/js/state.js');
    const { makeNpc } = await import('/js/engine/npcFactory.js');
    const st = S.store.state; const p = st.player;
    p.age = 11; p.birthYear = st.year - 11;
    const n = makeNpc({ role: 'pet', countryId: p.countryId, age: 6, relationship: 80 });
    n.species = 'guinea_pig'; n.firstName = 'Toffee'; n.lastName = ''; n.lifespan = 6;
    st.npcs[n.id] = n; p.npcIds.push(n.id);
    st.pendingEvents = []; st.settings = { ...(st.settings ?? {}), yearSummary: false };
    S.store.notify();
    return n.id;
  });
  await page.waitForTimeout(150);
  if (await page.locator('[data-panel]:not([hidden])').count()) await page.click('[data-panel-close]');
  await page.click('[data-year]');
  let seen = false;
  for (let i = 0; i < 30 && !seen; i++) {
    await page.waitForTimeout(150);
    // Someone else can die the same year (another pet, a grandparent): their notices are closed until Toffee's.
    if (await page.locator('.modal .notice-head').count() && /In memory/i.test(await page.locator('.modal').last().innerText())) {
      if (/Toffee/.test(await page.locator('.modal').last().innerText())) { seen = true; break; }
      // A person's notice asks about the funeral (choice buttons); a pet's has only OK.
      const ok = page.locator('.modal:last-of-type [data-ok], .scrim:last-child [data-ok]');
      if (await ok.count()) await ok.last().click({ timeout: 3000 }).catch(() => {});
      else if (await page.locator('.modal .choice-btn:not([disabled])').count()) await page.locator('.modal .choice-btn:not([disabled])').last().click({ timeout: 3000 }).catch(() => {});
      continue;
    }
    if (await page.locator('.modal .choice-btn:not([disabled])').count()) await page.locator('.modal .choice-btn:not([disabled])').first().click();
    else if (await page.locator('.modal [data-ok]').count()) await page.locator('.modal [data-ok]').last().click();
  }
  const dead = await page.evaluate(async (x) => !(await import('/js/state.js')).store.state.npcs[x].alive, id);
  check(dead, `${label}: the guinea pig died this turn`);
  check(seen, `${label}: Age Up shows a death notice`);
  if (seen) {
    const text = await page.locator('.modal').last().innerText();
    check(/Toffee/.test(text) && /In memory/i.test(text) && /has died\. They were \d+\./.test(text), `${label}: the notice names them, and their age (${text.replace(/\n/g, ' / ')})`);
    check(!(await page.locator('.modal [data-attend]').count()), `${label}: an animal has no funeral to go to`);
    check(/guinea pig/i.test(text) && !/guinea_pig/.test(text), `${label}: a pet's kind is written as words`);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/death-${label}.png` });
    await page.locator('.modal [data-ok]').last().click(); await page.waitForTimeout(150);
    // Another notice may follow (someone else can die in the same turn): this one, the guinea pig's, is gone.
    check(!(await page.locator('.modal .notice-head', { hasText: 'Toffee' }).count()), `${label}: the notice closes`);
  }
  check(!errors.length, `${label}: no errors in the page (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'Deaths are noticed.');
process.exit(problems.length ? 1 : 0);
