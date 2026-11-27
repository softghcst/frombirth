// My Origins in a browser, at phone and desktop width: a life designed as "Adopted at birth", the People tab row (greyed
// until the character knows), the My Origins page with its sections, nothing about the birth family shown before it is
// learned, and the actions working. Needs Playwright. Run with: node tests/origins-ui.mjs
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
  const shot = async (name) => { if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/origins-${label}-${name}.png`, fullPage: false }); };
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.evaluate(() => localStorage.setItem('frombirth.birthGlobe', 'off')); await page.click('[data-design]');
  await page.waitForSelector('#f-origin');
  const opts = await page.locator('#f-origin option').allInnerTexts();
  check(['Standard family', 'Adopted at birth', 'Adopted during childhood', 'Raised by relatives', 'Surprise me'].every((o) => opts.some((x) => x.toLowerCase() === o.toLowerCase())), `${label}: the designer offers the family origins (${opts})`);
  await page.selectOption('#f-country', 'us'); await page.waitForTimeout(60);
  await page.fill('#f-year', '2000');
  await page.selectOption('#f-origin', 'birth');
  check(/newborn/.test(await page.locator('[data-origin-note]').innerText()), `${label}: the choice is explained`);
  await page.click('form [type="submit"]');
  await page.waitForSelector('[data-year]');
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  // Royal births skip adoption (a crown is not an adoption story): make sure this life is adopted.
  const info = await page.evaluate(async () => {
    const S = await import('/js/state.js'); const O = await import('/js/engine/origins.js');
    const r = O.myRecord(); const st = S.store.state;
    // A closed adoption, so nothing about the birth family is known yet (an open one shares her name from the start).
    r.contact = 'closed'; st.origins.contacts = {}; st.origins.parentsKnow[r.id].people = {};
    return r ? { kind: r.kind, mother: st.npcs[r.birthParentIds[0]]?.firstName + ' ' + st.npcs[r.birthParentIds[0]]?.lastName, inHouse: st.player.npcIds.includes(r.birthParentIds[0]) } : null;
  });
  check(info?.kind === 'birth' && !info.inHouse, `${label}: the life is adopted at birth, the birth mother outside the household`);
  // Before the character knows: the row is there, greyed.
  await page.evaluate(() => document.querySelector('.tab-btn[data-tab="people"]').click()); await page.waitForTimeout(200);
  const locked = page.locator('.nav-row.locked', { hasText: 'My Origins' });
  check(await locked.count() === 1, `${label}: My Origins is greyed until the character knows`);
  // Ten years on, told by their parents (the parents' telling is set here, not waited for).
  await page.evaluate(async () => {
    const S = await import('/js/state.js'); const O = await import('/js/engine/origins.js');
    const st = S.store.state; const d = 10 - st.player.age; st.player.age = 10; st.year += d; for (const n of Object.values(st.npcs)) n.age += d;
    st.origins.self.awareAge = 4; O.tickOrigins(); st.pendingEvents = [];
  });
  await page.evaluate(() => document.querySelector('.tab-btn[data-tab="self"]')?.click());
  await page.evaluate(() => document.querySelector('.tab-btn[data-tab="people"]').click()); await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('[data-top="origins"]').click()); await page.waitForTimeout(250);
  const text = await page.locator('#modal-root .modal').last().innerText();
  for (const sec of ['My Story', 'Adoptive Family', 'What I Know', 'Birth Family', 'Search', 'Messages & Contact', 'Family Connections']) check(text.includes(sec), `${label}: My Origins has ${sec}`);
  check(/Adopted at birth/i.test(text) && /Raised by/i.test(text), `${label}: the story says how and by whom`);
  check(!text.includes(info.mother), `${label}: the birth mother's name is not shown before it is learned`);
  check(/Birth mother\s*Unknown to you/i.test(text), `${label}: the birth mother is listed, as far as known`);
  check(/From age 18/.test(text), `${label}: records wait for adulthood`);
  const over = await page.evaluate(() => { const m = document.querySelector('#modal-root .modal:last-child'); return m.scrollWidth - m.clientWidth; });
  check(over <= 1 && await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${label}: nothing runs off the side (${over})`);
  await shot('child');
  // A childhood action.
  await page.locator('#modal-root [data-act="talkParents"]').click(); await page.waitForTimeout(200);
  const said = await page.locator('#modal-root .modal').last().innerText();
  check(/listens|quiet|hard/.test(said), `${label}: talking to the parents gets their answer (${said.slice(0, 60)})`);
  await page.locator('#modal-root .modal').last().locator('[data-ok]').click(); await page.waitForTimeout(200);
  check(/Done this year/.test(await page.locator('#modal-root .modal').last().innerText()), `${label}: once a year`);
  await page.locator('#modal-root .modal').last().locator('.modal-back').click(); await page.waitForTimeout(150);
  // Grown up: a records request.
  await page.evaluate(async () => {
    const S = await import('/js/state.js');
    const st = S.store.state; st.player.age = 18; st.year += 8; for (const n of Object.values(st.npcs)) n.age += 8;
  });
  await page.evaluate(() => document.querySelector('[data-top="origins"]').click()); await page.waitForTimeout(250);
  await page.locator('#modal-root [data-act="records"]').click(); await page.waitForTimeout(200);
  check(/form/.test(await page.locator('#modal-root .modal').last().innerText()), `${label}: a records request is made`);
  await page.locator('#modal-root .modal').last().locator('[data-ok]').click(); await page.waitForTimeout(200);
  check(/Waiting on/i.test(await page.locator('#modal-root .modal').last().innerText()), `${label}: and shows as waiting`);
  await shot('adult');
  // The answer comes with the year; the scene can be answered.
  const told = await page.evaluate(async () => {
    const S = await import('/js/state.js'); const { advanceTurn } = await import('/js/engine/turns.js');
    S.store.state.pendingEvents = []; advanceTurn();
    return S.store.state.pendingEvents.map((e) => e.id);
  });
  check(told.includes('org_agency'), `${label}: the records answer comes at the turn of the year (${told})`);
  check(!errors.length, `${label}: no page errors (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
if (problems.length) { console.log(`PROBLEMS:\n${problems.map((p) => ` - ${p}`).join('\n')}`); process.exit(1); }
console.log('My Origins works at phone and desktop width.');
