// The birth globe (js/ui/birthGlobe.js): a random life begins with the world spinning to where it is born, a card with
// the country, the city and how rare that is, and "Be Born"; a designed life without the odds; a tap skips the spin;
// Settings turns it off. Needs Playwright. Run with: node tests/birth-globe-ui.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  try { ({ chromium } = require(join(process.execPath, '../../lib/node_modules/playwright'))); } catch { console.log('Playwright is not available here: browser check skipped.'); process.exit(0); }
}
const { COUNTRY_LIST } = await import('../js/data/countries.js');
const { birthOdds } = await import('../js/data/births.js');
const root = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!path.startsWith(root)) { res.writeHead(403); return res.end(); }
  try { const body = await readFile(path.endsWith('/') ? join(path, 'index.html') : path); res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };

// Every country has its odds, and they run from very common to ultra rare.
check(COUNTRY_LIST.every((c) => birthOdds(c.id)), `every country has its share of the world's births (${COUNTRY_LIST.filter((c) => !birthOdds(c.id)).map((c) => c.id).join(', ')})`);
check(birthOdds('in').rarity.name === 'Very common' && birthOdds('mc').rarity.name === 'Ultra rare' && birthOdds('uk').rarity.name === 'Uncommon', 'India very common, the United Kingdom uncommon, Monaco ultra rare');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${port}/index.html`);
await page.evaluate(() => localStorage.clear());
await page.reload();
// A random life: the globe, then (a tap skips the spin) the card, then the life.
await page.click('[data-random]');
await page.waitForSelector('.birth-globe canvas', { timeout: 5000 });
check(!(await page.locator('[data-year]').count()), 'the life waits behind the globe');
await page.waitForTimeout(600);
await page.click('.birth-globe');
await page.waitForSelector('.birth-globe.bg-landed', { timeout: 3000 });
const card = await page.locator('.bg-card').innerText();
check(/You are born in/i.test(card) && /% of the world's babies/.test(card) && /(common|rare)/i.test(card), `the card: the country, the city and its rarity (${card.replace(/\n/g, ' | ')})`);
await page.click('[data-born]');
await page.waitForSelector('[data-year]', { timeout: 8000 });
await page.waitForTimeout(600);
const where = await page.evaluate(async () => { const { store } = await import('/js/state.js'); const { COUNTRIES } = await import('/js/data/countries.js'); return { name: COUNTRIES[store.state.player.countryId].name, city: store.state.player.city }; });
check(card.includes(where.name) && card.includes(where.city), `the card names where the life begins (${where.name}, ${where.city})`);
check(!(await page.locator('.birth-globe').count()), 'and the globe is gone');
// A designed life: the chosen country, no odds.
await page.evaluate(async () => { const { createLife } = await import('/js/engine/characterGen.js'); const g = await import('/js/ui/birthGlobe.js'); window.__g = g.openBirthGlobe(createLife({ countryId: 'jp', city: 'Osaka' }), { designed: true }).then(() => { window.__gDone = true; }); });
await page.waitForSelector('.birth-globe', { timeout: 5000 });
await page.click('.birth-globe');
await page.waitForSelector('.birth-globe.bg-landed', { timeout: 3000 });
const chosen = await page.locator('.bg-card').innerText();
check(/You chose to be born in/i.test(chosen) && /Japan/.test(chosen) && /Osaka/.test(chosen) && !/%/.test(chosen), `a designed life: the chosen country, no odds (${chosen.replace(/\n/g, ' | ')})`);
await page.click('[data-born]');
await page.waitForFunction(() => window.__gDone === true, null, { timeout: 3000 });
// Turned off in Settings: a random life begins straight away.
await page.evaluate(async () => { const g = await import('/js/ui/birthGlobe.js'); g.setBirthGlobe(false); });
check(await page.evaluate(() => localStorage.getItem('frombirth.birthGlobe') === 'off'), 'Settings can turn it off');
// (The tab's session is cleared first: a tab that was only away comes back to the life being played.)
await page.evaluate(() => sessionStorage.clear());
const fresh = page;
await fresh.goto(`http://localhost:${port}/index.html`);
await fresh.click('[data-random]');
await fresh.waitForSelector('[data-year]', { timeout: 8000 });
check(!(await fresh.locator('.birth-globe').count()), 'and then a life begins without it');
check(!errors.length, `no page errors (${errors.join('; ')})`);
await browser.close();
server.close();
if (problems.length) { console.log('PROBLEMS:'); for (const p of problems) console.log(` - ${p}`); process.exit(1); }
console.log('A life begins on the globe, where it is born.');
