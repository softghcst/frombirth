// The new dialogs and notices in a browser, at phone width: a sleepover picked from a dropdown on a friend; lessons asked
// of a parent from Pursuits; a death notice with the cause and Attend the funeral / Skip it; an illness notice with a face.
// Needs Playwright. Run with: node tests/family-news-ui.mjs
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const shot = async (name) => { if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/${name}.png` }); };
await page.goto(`http://localhost:${port}/index.html`);
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.click('[data-random]'); await page.waitForSelector('[data-year]');
await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
// A ten-year-old with a well-off parent and a close friend.
const ids = await page.evaluate(async () => {
  const S = await import('/js/state.js'); const { makeNpc } = await import('/js/engine/npcFactory.js'); const { ensureLife } = await import('/js/engine/npcLives.js');
  const st = S.store.state; const p = st.player; p.age = 10; p.birthYear = st.year - 10; p.flags.livesWithParents = true;
  const mk = (role, age, rel, first) => { const n = makeNpc({ role, countryId: p.countryId, age, relationship: rel }); ensureLife(n); n.firstName = first; st.npcs[n.id] = n; p.npcIds.push(n.id); return n; };
  const pal = mk('friend', 10, 95, 'Simon'); pal.flags.title = 'Best friend';
  const mom = mk('parent', 40, 85, 'Rosa'); mom.life ??= {}; mom.life.savings = 5e6; mom.savings = 5e6; mom.meters.generosity = 85;
  return { pal: pal.id, mom: mom.id };
});
// 1. Sleepover, from the friend's profile.
await page.evaluate(() => document.querySelector('.tab-btn[data-tab="people"]').click()); await page.waitForTimeout(250);
await page.evaluate((id) => document.querySelector(`[data-npc="${id}"]`).click(), ids.pal); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelectorAll('#modal-root details.action-group').forEach((d) => { d.open = true; }));
await page.locator('#modal-root [data-act="with:sleepover"]').click(); await page.waitForTimeout(250);
check(await page.locator('#modal-root select#m-pick').count() === 1 && /Sleepover/.test(await page.locator('#modal-root .modal').last().innerText()), 'the sleepover asks with a dropdown');
check((await page.locator('#modal-root select#m-pick option').allInnerTexts()).some((x) => /^Sleep out in a tent$/i.test(x)), 'a night in a tent is one of the plans');
await page.selectOption('#modal-root select#m-pick', await page.locator('#modal-root select#m-pick option', { hasText: /sleep out in a tent/i }).getAttribute('value'));
await shot('sleepover');
await page.locator('#modal-root [data-go]').click(); await page.waitForTimeout(300);
const said = await page.locator('#modal-root .modal').last().innerText();
check(/tent|cannot come/.test(said), `and it happens (${said.slice(0, 80)})`);
for (let i = 0; i < 8 && await page.locator('#modal-root .scrim').count(); i++) { const c = page.locator('#modal-root .choice-btn:not([disabled])'); if (await c.count()) await c.first().click(); else await page.locator('#modal-root .modal').last().locator('[data-ok], .modal-back').first().click(); await page.waitForTimeout(150); }
// 2. Lessons, from Pursuits.
await page.evaluate(() => document.querySelector('.tab-btn[data-tab="pursuits"]').click()); await page.waitForTimeout(250);
check(await page.locator('[data-lessons]').count() === 1, 'Pursuits has Lessons');
await page.evaluate(() => document.querySelector('[data-lessons]').click()); await page.waitForTimeout(250);
const lessonOpts = await page.locator('#modal-root select#m-pick option').allInnerTexts();
check(lessonOpts.some((x) => /Voice lessons/i.test(x)) && lessonOpts.some((x) => /Ballet/.test(x)) && /Ask your parents/i.test(await page.locator('#modal-root [data-go]').innerText()), 'lessons: a dropdown, and "Ask your parents"');
await shot('lessons');
await page.locator('#modal-root .modal-back').click(); await page.waitForTimeout(150);
// 3. A death notice: the friend dies in the turn.
await page.evaluate(() => document.querySelector('[data-panel-close]')?.click());
await page.evaluate(async (id) => { const S = await import('/js/state.js'); const n = S.store.state.npcs[id]; n.age = 118; n.meters.health = 0; n.flags.tag = null; S.store.state.player.stats.health = 95; }, ids.pal);
await page.evaluate(async (id) => { const S = await import('/js/state.js'); const { tickRelationships } = await import('/js/engine/relationships.js'); }, ids.pal);
let seen = false;
for (let t = 0; t < 4 && !seen; t++) {
  await page.evaluate(() => document.querySelector('[data-year]').click());
  for (let i = 0; i < 60 && !seen; i++) {
    await page.waitForTimeout(120);
    const txt = await page.evaluate(() => document.querySelector('#modal-root .modal:last-child')?.innerText ?? '');
    // The friend's funeral, not another one: someone else in the family can die in the same turn.
    if (/Go to the funeral/i.test(txt) && /Simon/.test(txt)) { seen = txt; break; }
    const c = page.locator('#modal-root .choice-btn:not([disabled])');
    if (await c.count()) await c.first().click(); else if (await page.locator('#modal-root [data-ok]').count()) await page.locator('#modal-root [data-ok]').last().click();
  }
}
check(seen && /Simon/.test(seen) && /has died at \d+/.test(seen) && /In memory/i.test(seen) && /Stay away/i.test(seen) && /Speak at the funeral/i.test(seen), 'a death is a scene: who, at what age, what of, and the funeral');
check(seen && await page.locator('#modal-root .modal').last().locator('.notice-head .avatar').count() === 1, 'with their face');
check(seen && !(await page.locator('#modal-root .modal').last().locator('.modal-back').count()), 'part of the turn: answered, not closed');
await shot('death');
if (seen) {
  await page.locator('#modal-root .modal').last().locator('.choice-btn', { hasText: /Go to the funeral/i }).click(); await page.waitForTimeout(250);
  check(await page.evaluate(async (id) => (await import('/js/state.js')).store.state.npcs[id].flags.funeral, ids.pal) === 'attended', 'going is recorded, and the family hears of it');
}
await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
// 4. An illness notice, with a face.
const html = await page.evaluate(async (id) => {
  const M = await import('/js/ui/modals.js'); const { getEvent } = await import('/js/engine/eventEngine.js');
  M.eventModal(getEvent('kin_ailment'), { who: id, words: { role: 'mother', ailment: 'diarrhea', emoji: '💩', title: 'Diarrhea' } });
  await new Promise((r) => setTimeout(r, 150));
  return document.querySelector('#modal-root .modal').innerText;
}, ids.mom);
check(/Rosa/.test(html) && /Diarrhea/.test(html) && /Your mother is laid up with diarrhea\./.test(html) && await page.locator('#modal-root .notice-head .avatar').count() === 1, 'an illness is news, with their face, name and who they are');
await shot('ailment');
check(!errors.length, `no errors in the page (${errors.join('; ')})`);
await browser.close(); server.close();
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'The new dialogs and notices work in the browser.');
process.exit(problems.length ? 1 : 0);
