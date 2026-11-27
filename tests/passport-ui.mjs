// Browser check of papers for a trip, and of My Passport: a trip abroad is booked with no passport and no visa to chase
// (both are sorted with the booking), taken, and then stamped in the passport, which opens as a little book whose
// pages can be turned. Phone width.
// Needs Playwright (preinstalled where the checks run). Serves the game itself. Run with: node tests/passport-ui.mjs
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
await page.evaluate(() => localStorage.setItem('pathways.birthGlobe', 'off')); await page.click('[data-random]');
await page.waitForSelector('[data-year]');
await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
// A thirty-year-old in London with no passport, booking a week in Beijing (where a visitor needs a visa) and one in Paris.
const r = await page.evaluate(async () => {
  const { store } = await import('/js/state.js');
  const p = store.state.player;
  p.birthday = { m: 0, d: 1 }; store.state.today = `${store.state.year}-01-01`; p.countryId = 'uk'; p.city = 'London'; p.age = 30; p.birthYear = store.state.year - 30; p.finance.cash = 500000; p.legal.incarceration = null;
  p.documents = (p.documents ?? []).filter((d) => d.type !== 'passport');
  const travel = await import('/js/engine/travel.js');
  const docs = await import('/js/engine/documents.js');
  const y = store.state.year;
  const take = (countryId, city, m) => {
    const t = travel.startPlan('vacation');
    travel.updatePlan(t.id, { destination: { countryId, city }, depart: `${y}-${m}-02`, ret: `${y}-${m}-09`, mode: 'jet', stay: 'hotel' });
    const before = travel.problems(t);
    const c = travel.confirm(t.id);
    const g = c.ok ? travel.takeTrip(t.id) : { ok: false };
    return { before, booked: c.ok, text: c.text, went: g.ok, stamp: /new stamp/.test(g.text ?? '') };
  };
  return { cn: take('cn', 'Beijing', '05'), fr: take('fr', 'Paris', '08'), passport: !!docs.validPassport(p) };
});
check(!r.cn.before.some((x) => /visa|passport/i.test(x)), `no passport or visa to chase before booking (${r.cn.before})`);
check(r.cn.booked && r.cn.went && r.passport, `booked and taken, with a passport issued on the way (${r.cn.text})`);
check(r.cn.stamp && r.fr.stamp, 'each trip notice mentions the new stamp');
await page.evaluate(async () => { (await import('/js/ui/passportBook.js')).openPassportBook(); });
await page.waitForSelector('.pp-book');
const shot = async (name) => { if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/${name}.png` }); };
check(await page.locator('.pp-photo .pp-pic svg').count() >= 1 && /NATIONALITY/i.test(await page.locator('.pp-photo').innerText()), 'the passport opens at the photo page');
check(/2 stamps/.test(await page.locator('[data-pp-count]').innerText()), `it counts the stamps (${await page.locator('[data-pp-count]').innerText()})`);
check(await page.locator('#modal-root .modal-back:visible').count() === 0, 'with its own Close, and no Back as well');
await page.waitForTimeout(600);
await shot('passport-photo');
await page.click('[data-pp-next]');
await page.waitForTimeout(100);
const stamps = await page.locator('.pp-stamp').allInnerTexts();
check(stamps.length === 2 && stamps.some((x) => /CHINA/.test(x) && /BEIJING/.test(x)) && stamps.some((x) => /FRANCE/.test(x)), `a stamp for each country, with the city and date (${stamps.join(' | ')})`);
check(await page.locator('[data-pp-next]').isDisabled() && !(await page.locator('[data-pp-prev]').isDisabled()), 'and the pages turn');
const wide = await page.evaluate(() => { const m = [...document.querySelectorAll('#modal-root .modal')].pop(); return m.scrollWidth > m.clientWidth + 1; });
check(!wide, 'nothing runs off the side at phone width');
await shot('passport-stamps');
check(!errors.length, `no page errors (${errors.join('; ')})`);
await browser.close();
server.close();
if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log('Trips abroad need no paperwork, and every one is stamped in a passport you can leaf through.');
