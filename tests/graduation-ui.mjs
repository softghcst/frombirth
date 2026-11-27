// Browser check of the graduation card (js/ui/graduation.js) at phone width: finishing high school brings up the card
// after the turn, with the player's name and school on it; "Go to university" opens the university planner; finishing
// a degree brings it up again with "Keep studying"; "Take some time off" just closes it. Needs Playwright.
// Run with: node tests/graduation-ui.mjs
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${port}/index.html`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.evaluate(() => localStorage.setItem('frombirth.birthGlobe', 'off')); await page.click('[data-random]');
await page.waitForSelector('[data-year]');
await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));

/** Ages up, answering whatever comes first (scenes, notices) until the graduation card is up. */
async function ageUpToCard() {
  await page.click('[data-year]');
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.grad').count()) return true;
    const top = page.locator('#modal-root .scrim').last();
    if (!(await top.count())) { await page.waitForTimeout(150); continue; }
    const btn = top.locator('.choice-btn:not([disabled]), .btn.primary, [data-ok], .btn').first();
    if (await btn.count()) await btn.click().catch(() => {});
    await page.waitForTimeout(120);
  }
  return page.locator('.grad').count().then(Boolean);
}

// The last year of high school.
await page.evaluate(async () => {
  const { store } = await import('/js/state.js');
  const p = store.state.player; p.age = 17; p.alive = true; p.legal.incarceration = null; p.stats.health = 100;
  Object.assign(p.education, { stage: 'high', enrolled: true, gpa: 3.8, expelled: false, droppedOut: false, absences: 0 });
});
check(await ageUpToCard(), 'finishing high school brings up the graduation card');
const word = await page.locator('.grad-word').textContent();
check(/^Graduated .+!$/.test(word), `the card says "Graduated …!" (it says "${word}")`);
const name = await page.evaluate(async () => { const { store } = await import('/js/state.js'); const p = store.state.player; return `${p.firstName} ${p.lastName}`; });
check((await page.locator('.grad-name').textContent()) === name, 'the player\'s name is on the diploma');
check(await page.locator('.grad-face svg').count() === 1, 'the player\'s face is on the card');
const steps = await page.locator('[data-step]').evaluateAll((b) => b.map((x) => x.dataset.step));
check(steps.includes('keep') && !steps.includes('uni') && steps.includes('work') && steps.includes('rest'), `the next steps are keep studying, work and time off (${steps})`);
check(await page.evaluate(async () => { const { store } = await import('/js/state.js'); return !store.state.player.flags.gradCard; }), 'the card is shown once');
const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check(!wide, 'nothing runs off the side of the phone');
await page.click('[data-step="keep"]');
const kinds = await page.locator('#modal-root .choice-btn').allInnerTexts();
check(kinds.length === 2 && /Go to (College|University)/.test(kinds[0]) && /Trade School & More/.test(kinds[1]), `Keep Studying asks: university, or trade school and more (${kinds.join(' | ')})`);
// Back returns to the card.
await page.click('#modal-root [data-cancel]');
await page.waitForSelector('.grad');
check(await page.locator('.grad').count() === 1, 'Back from Keep Studying returns to the card');
await page.click('[data-step="keep"]');
await page.locator('#modal-root .choice-btn').first().click();
await page.waitForSelector('.dyn-modal h2:has-text("University")', { timeout: 4000 }).catch(() => {});
check(await page.locator('.dyn-modal h2:has-text("University")').count() === 1, 'Go to university opens the university planner');
await page.click('.dyn-modal .modal-back');
// Whatever else the year had waiting (the yearly notices) is answered, so the next turn can be taken.
for (let quiet = 0; quiet < 4;) {
  const top = page.locator('#modal-root .scrim').last();
  if (!(await top.count())) { quiet++; await page.waitForTimeout(150); continue; }
  quiet = 0;
  const btn = top.locator('[data-cancel], .btn:not(.primary), .btn, .choice-btn').first();
  if (await btn.count()) await btn.click().catch(() => {});
  await page.waitForTimeout(120);
}

// Finishing a degree: Keep studying is offered; time off just closes the card.
await page.evaluate(async () => {
  const { store } = await import('/js/state.js');
  const p = store.state.player; p.age = 21; p.legal.incarceration = null;
  Object.assign(p.education, { stage: 'university', enrolled: true, gpa: 3.5, majorId: 'biology', schoolName: 'Marlowe College', yearInStage: 3, credits: 118, partTime: false });
});
check(await ageUpToCard(), 'finishing university brings up the graduation card');
const steps2 = await page.locator('[data-step]').evaluateAll((b) => b.map((x) => x.dataset.step));
check(steps2.includes('study') && !steps2.includes('uni') && !steps2.includes('keep'), `after a degree it offers more study straight away, not university again (${steps2})`);
check((await page.locator('.grad-school').textContent()).includes('Marlowe College'), 'the university is named on the diploma');
await page.click('[data-step="rest"]');
await page.waitForFunction(() => !document.querySelector('.grad'), null, { timeout: 3000 }).catch(() => {}); // closing has an animation: on a busy machine it takes a moment
check(await page.locator('.grad').count() === 0, 'Take some time off just closes it');

check(!errors.length, `no page errors (${errors.join('; ')})`);
await browser.close();
server.close();
if (problems.length) { console.log(`FAIL graduation-ui:\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('ok graduation-ui');
