// Browser check of a sport's own page, its practice screen and its league, at phone width: a team sport shows the team,
// its place and strength, and a league table with every team's strength; practice shows each skill as a bar, a focus
// to pick, and works on it; an individual sport shows its rating and practice the same way.
// Needs Playwright (preinstalled where the checks run). Serves the game itself. Run with: node tests/sport-desk-ui.mjs
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${port}/index.html`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.click('[data-random]');
await page.waitForSelector('[data-year]');
await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
// A twelve-year-old who plays baseball and tennis, with a season of baseball behind them.
const ok = await page.evaluate(async () => {
  const { store } = await import('/js/state.js');
  const { advanceYear } = await import('/js/engine/yearProcessor.js');
  const sp = await import('/js/engine/sports.js');
  const p = store.state.player;
  p.age = 11; p.birthYear = store.state.year - 11; p.talents.sports = 75; p.stats.health = 90;
  if (!sp.takeUp('baseball').ok) return 'no baseball';
  sp.takeUp('tennis');
  advanceYear(); store.state.pendingEvents = [];
  return 'ok';
});
check(ok === 'ok', `the athlete is set up (${ok})`);
const shot = async (n) => { if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/${n}.png` }); };
await page.evaluate(async () => { (await import('/js/ui/sports.js')).openAthletics({ changed() {}, rerender() {} }); });
await page.waitForSelector('.sport-modal');
await page.locator('.sport-modal [data-sport="baseball"]').first().click();
await page.waitForTimeout(200);
const desk = await page.locator('.sport-modal').innerText();
check(/Team strength/.test(desk) && /\(\d+\/\d+\)/.test(desk), `the sport page shows the team, its place and strength (${desk.slice(0, 200).replace(/\n/g, ' | ')})`);
for (const x of ['League', 'Practice', 'Training Plan', 'Team', 'Stats']) check(desk.includes(x), `and ${x}`);
await shot('sport-desk');
await page.locator('.sport-modal [data-league]').last().click(); await page.waitForTimeout(200);
const rows = await page.locator('.sport-modal .sd-lrow').count();
check(rows >= 4 && await page.locator('.sport-modal .sd-lrow.mine').count() === 1, `the league lists every team, yours marked (${rows})`);
check(/Champions/.test(await page.locator('.sport-modal').innerText()), 'with the champions');
await shot('sport-league');
await page.locator('.sport-modal [data-back]').click(); await page.waitForTimeout(150);
await page.locator('.sport-modal [data-practice]').click(); await page.waitForTimeout(200);
check(await page.locator('.sport-modal .sd-skill').count() >= 4 && await page.locator('.sport-modal select[data-focus]').count() === 1, 'practice shows every skill and a focus to pick');
const skill = await page.locator('.sport-modal select[data-focus] option').nth(1).getAttribute('value');
await page.selectOption('.sport-modal select[data-focus]', skill);
const before = await page.evaluate(async (k) => (await import('/js/engine/sports.js')).entryOf('baseball').skills[k], skill);
await shot('sport-practice');
await page.locator('.sport-modal [data-work]').click(); await page.waitForTimeout(250);
const after = await page.evaluate(async (k) => (await import('/js/engine/sports.js')).entryOf('baseball').skills[k], skill);
check(after >= before && /extra session/i.test(await page.locator('#modal-root .modal').last().innerText()), `working on it practices that skill (${before} → ${after})`);
await page.locator('#modal-root [data-ok]').last().click(); await page.waitForTimeout(200);
check(await page.locator('.sport-modal select[data-focus]').count() === 1 && await page.locator('.sport-modal select[data-focus]').inputValue() === skill, 'and comes back to practice, the same skill chosen');
// An individual sport: a rating instead of a league.
await page.locator('.sport-modal [data-back]').click(); await page.waitForTimeout(150);
await page.locator('.sport-modal [data-back]').click(); await page.waitForTimeout(150);
await page.locator('.sport-modal [data-sport="tennis"]').first().click(); await page.waitForTimeout(200);
const tennis = await page.locator('.sport-modal').innerText();
check(/Rankings/.test(tennis) && /Practice/.test(tennis) && !/Team strength/.test(tennis), 'an individual sport has rankings and practice, and no team');
const wide = await page.evaluate(() => { const m = [...document.querySelectorAll('#modal-root .modal')].pop(); return m.scrollWidth > m.clientWidth + 1; });
check(!wide, 'nothing runs off the side');
check(!errors.length, `no page errors (${errors.join('; ')})`);
await browser.close();
server.close();
if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log('Every sport has its page, practice, and a league or rankings.');
