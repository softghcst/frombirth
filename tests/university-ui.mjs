// Browser check of the university planner at phone width: choosing a subject shows the top places for it, ranked and
// marked reach / match / safety, with "show more"; two to four places can be compared side by side without sideways
// scrolling; audition coaching can be bought; and every page has a Back button.
// Needs Playwright (preinstalled where the checks run). Serves the game itself. Run with: node tests/university-ui.mjs
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
  const page = await browser.newPage({ viewport, deviceScaleFactor: label === 'phone' ? 2 : 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('[data-random]');
  await page.waitForSelector('[data-year]');
  await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  // A seventeen-year-old at school, strong at all three of singing, dance and acting, who lives in the United States.
  await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const p = store.state.player;
    p.countryId = 'us'; p.city = (await import('/js/data/countries.js')).COUNTRIES.us.cities[0];
    p.age = 17; p.birthYear = store.state.year - 17;
    Object.assign(p.education, { enrolled: true, stage: 'high', gpa: 3.5, apps: null });
    Object.assign(p.talents, { singing: 78, dance: 78, acting: 78 });
    p.finance.cash = 500000; p.legal.incarceration = null;
    const { openUniversity } = await import('/js/ui/university.js');
    window.__api = { changed() {}, rerender() {} };
    openUniversity(window.__api, { funding: async () => 'parents', housing: async () => ({}) });
  });
  await page.waitForSelector('.dyn-modal');
  const modal = '#modal-root .dyn-modal';
  const overflow = () => page.evaluate(() => { const m = [...document.querySelectorAll('#modal-root .modal')].pop(); return m.scrollWidth > m.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth; });
  check(await page.locator(`${modal} .modal-back`).count() === 1, `${label}: the planner has a Back button`);

  // Choose the subject.
  await page.click(`${modal} [data-major]`);
  await page.locator('.choice-btn', { hasText: 'Musical Theater (BFA)' }).click();
  await page.waitForTimeout(150);
  const cards = () => page.locator(`${modal} .sub-card`).count();
  check(await cards() === 8, `${label}: the top eight places are shown (${await cards()})`);
  const intro = await page.locator(`${modal} .dyn-body > p.muted`).first().innerText();
  check(/top 8 of \d+/.test(intro) && /best first/.test(intro) && /turned away is common|being turned away is common/.test(intro), `${label}: it says how many there are, that they are best first, and that being turned away is common ("${intro.slice(0, 90)}…")`);
  const first = await page.locator(`${modal} .sub-card`).first().innerText();
  check(/#1/.test(first) && /Elite/.test(first) && /(Reach|Match|Safety) for you/.test(first) && /about \d+% of applicants/.test(first) && /Private, costly/.test(first), `${label}: the first place is the top-ranked, with reach / match / safety, its acceptance rate, and "costly"`);
  const fits = await page.locator(`${modal} .sub-card .chip`).allInnerTexts();
  check(fits.filter((t) => /for you/.test(t)).length === 8, `${label}: every place on the list says reach, match or safety`);
  check(!(await overflow()), `${label}: the list does not scroll sideways`);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/uni-list-${label}.png` });

  // Show more.
  await page.click(`${modal} [data-more]`);
  const all = await cards();
  check(all > 8 && all >= 11, `${label}: show more shows all of them (${all})`);
  check(await page.locator(`${modal} [data-less]`).count() === 1, `${label}: and offers to show fewer again`);
  await page.click(`${modal} [data-less]`);
  check(await cards() === 8, `${label}: back to the top eight`);

  // Compare.
  await page.locator(`${modal} [data-cmp]`).nth(0).click();
  check(/Pick one more/.test(await page.locator(`${modal} .dyn-body`).innerText()), `${label}: one place chosen asks for another`);
  check(await page.locator(`${modal} [data-compare]`).count() === 0, `${label}: and does not offer a comparison of one`);
  await page.locator(`${modal} [data-cmp]`).nth(3).click();
  await page.locator(`${modal} [data-cmp]`).nth(7).click();
  check(await page.locator(`${modal} [data-compare]`).count() === 1, `${label}: three places chosen offer a comparison`);
  await page.locator(`${modal} [data-cmp]`).nth(1).click();
  await page.locator(`${modal} [data-cmp]`).nth(2).click();
  check(/up to 4/.test(await page.locator('#modal-root .modal').last().innerText()), `${label}: a fifth is refused, saying why`);
  await page.locator('#modal-root [data-ok]').click();
  await page.click(`${modal} [data-compare]`);
  await page.waitForSelector('.cmp-block');
  const blocks = await page.locator('#modal-root .cmp-block').count();
  check(blocks >= 9, `${label}: the comparison has a block per attribute (${blocks})`);
  const text = await page.locator('#modal-root .modal').last().innerText();
  for (const word of ['Tuition a year', 'Your chances', 'Places offered', 'Help with the cost', 'Length of the course', 'How it is decided']) check(text.toLowerCase().includes(word.toLowerCase()), `${label}: the comparison has "${word}"`);
  check(/✓/.test(text), `${label}: the better one on a line is marked`);
  check(await page.evaluate(() => { const m = [...document.querySelectorAll('#modal-root .modal')].pop(); return m.scrollWidth <= m.clientWidth + 1; }), `${label}: the comparison does not scroll sideways`);
  check(await page.locator('#modal-root .modal').last().locator('.modal-back').count() === 1, `${label}: the comparison has a Back button`);
  await page.waitForTimeout(450);
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/uni-compare-${label}.png` });
  await page.locator('#modal-root .modal-back').last().click();
  check(await page.locator('#modal-root .scrim').count() === 1, `${label}: Back from the comparison returns to the planner`);

  // Apply: add two places, see the limit, buy coaching.
  await page.locator(`${modal} [data-pick]`).nth(0).click();
  await page.locator(`${modal} [data-pick]`).nth(4).click();
  await page.click(`${modal} [data-tab="applying"]`);
  const applying = await page.locator(`${modal} .dyn-body`).innerText();
  check(/2 of 8/.test(applying), `${label}: an audition course allows eight places (${applying.match(/\d of \d+/)?.[0]})`);
  check(/audition coaching/i.test(applying) && /Prepared so far: 0 of up to 18/.test(applying), `${label}: audition coaching is offered`);
  await page.click(`${modal} [data-coach]`);
  await page.locator('#modal-root [data-ok]').click();
  await page.waitForTimeout(150);
  const after = await page.locator(`${modal} .dyn-body`).innerText();
  check(/Prepared so far: 6 of up to 18/.test(after) && /Done this year/.test(after), `${label}: after coaching it says so, and that it is done this year`);
  check(!(await overflow()), `${label}: the applying page does not scroll sideways`);

  // Send, and the answers say how many times.
  await page.click(`${modal} [data-send]`);
  await page.locator('#modal-root [data-yes]').click();
  await page.locator('#modal-root [data-ok]').click();
  await page.waitForTimeout(150);
  check(await page.locator(`${modal} .tone-good, ${modal} .tone-bad, ${modal} .tone-neutral`).count() >= 2, `${label}: the answers come back`);
  // Back leaves it.
  await page.locator(`${modal} .modal-back`).click();
  check(await page.locator('#modal-root .scrim').count() === 0, `${label}: Back closes the planner`);
  check(!errors.length, `${label}: no errors in the page (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'The university planner works on a phone and a desktop.');
process.exit(problems.length ? 1 : 0);
