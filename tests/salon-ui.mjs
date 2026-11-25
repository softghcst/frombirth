// Browser check of a visit to the beauty salon at phone width: the sign, the mirror, the stylist's questions, trying a cut and a
// texture treatment, the bill, paying, and walking out before paying. Needs Playwright. Run with: node tests/salon-ui.mjs
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
await page.click('[data-random]');
await page.waitForSelector('[data-year]');
await page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
const setUp = () => page.evaluate(async () => {
  const { store } = await import('/js/state.js');
  const p = store.state.player; p.age = 28; p.finance.cash = 1e10; p.gender = 'female';  // enough in any currency p.legal.incarceration = null;
  const { normalize } = await import('/js/avatar/catalog.js');
  p.appearance = normalize(p.appearance, p.id); p.appearance.style.treatment = null;
  return { cash: p.finance.cash, hair: p.appearance.style.hair };
});
const before = await setUp();
// The Self tab's Beauty Salon opens the visit.
await page.evaluate(async () => { const { openSalonVisit } = await import('/js/ui/salonVisit.js'); window.__visit = openSalonVisit({ changed() {} }); });
check(await page.locator('.sv-intro .sv-logo-name').count() === 1, 'the visit opens on the salon\'s sign');
await page.waitForSelector('.sv-bubble', { timeout: 5000 });
check(/What are we doing today/.test(await page.locator('.sv-bubble').innerText()), 'the stylist asks what you are in for');
check(await page.locator('.sv-mirror svg').count() === 1, 'you are in the mirror');
const replies = await page.locator('.sv-reply').allInnerTexts();
check(['Haircut', 'Hair Treatment', 'Hair Color'].every((r) => replies.some((x) => x.toLowerCase() === r.toLowerCase())), `the replies are the salon's services (${replies})`);
// A haircut: the mirror changes as one is tried.
await page.click('.sv-reply:has-text("Haircut")');
const mirrorBefore = await page.locator('[data-mirror]').innerHTML();
const pick = page.locator('.av-opt[data-key="hair"]:not(.on)').nth(1);
await pick.click(); await page.waitForTimeout(150);
check(await page.locator('[data-mirror]').innerHTML() !== mirrorBefore, 'trying a cut shows it in the mirror');
await page.click('.sv-reply:has-text("Love it")');
check(/Anything else|What else/.test(await page.locator('.sv-bubble').innerText()), 'and the stylist asks if there is anything else');
// A treatment, then the bill.
await page.click('.sv-reply:has-text("Hair treatment")');
await page.locator('[data-treat]:not(.on)').first().click(); await page.waitForTimeout(150);
await page.click('.sv-reply:has-text("Love it")');
await page.click('.sv-reply:has-text("That\'s everything")');
const receipt = await page.locator('.sv-receipt').innerText();
check(/Haircut/.test(receipt) && /years/.test(receipt) && /Total/.test(receipt), `the bill lists the cut and the treatment (${receipt.replace(/\n/g, ' | ')})`);
await page.locator('.sv-reply').first().click(); await page.waitForTimeout(200);
const after = await page.evaluate(async () => { const { store } = await import('/js/state.js'); const p = store.state.player; return { cash: p.finance.cash, hair: p.appearance.style.hair, tr: p.appearance.style.treatment }; });
check(after.cash < before.cash && after.hair !== before.hair && after.tr?.until > 0, 'paying applies the new look and the treatment');
check(/Look at you/.test(await page.locator('.sv-bubble').innerText()), 'and the stylist admires it');
await page.click('.sv-reply:has-text("Leave")');
check(!(await page.locator('.salon-screen').count()), 'leaving closes the salon');
// Leaving part-way pays nothing.
const before2 = await setUp();
await page.evaluate(async () => { const { openSalonVisit } = await import('/js/ui/salonVisit.js'); openSalonVisit({ changed() {} }, { intro: false }); });
await page.click('.sv-reply:has-text("Hair color")');
await page.locator('.av-opt[data-key="hairDye"]:not(.on)').nth(2).click();
await page.click('[data-leave]');
const after2 = await page.evaluate(async () => { const { store } = await import('/js/state.js'); return store.state.player.finance.cash; });
check(after2 === before2.cash && !(await page.locator('.salon-screen').count()), 'walking out before paying changes nothing');
// Men go to the barbershop; women, trans women included once they live as women, to the salon.
const shops = await page.evaluate(async () => {
  const { store } = await import('/js/state.js'); const { shopFor, openSalonVisit } = await import('/js/ui/salonVisit.js');
  const p = store.state.player; const out = {};
  p.gender = 'female'; p.flags = { ...(p.flags ?? {}), bornAs: 'male' }; out.transWoman = shopFor(p);
  p.gender = 'male'; p.flags.bornAs = 'female'; out.transMan = shopFor(p);
  p.flags.bornAs = 'male';
  const v = openSalonVisit({ changed() {} }, { intro: true });
  out.sub = document.querySelector('.sv-logo-sub')?.textContent; v.close();
  openSalonVisit({ changed() {} }, { intro: false });
  out.barberClass = !!document.querySelector('.salon-screen.sv-barber'); out.bulbs = document.querySelectorAll('.sv-bulbs i').length;
  out.hello = document.querySelector('.sv-bubble')?.textContent;
  out.barberReplies = [...document.querySelectorAll('.sv-reply')].map((x) => x.textContent);
  document.querySelector('[data-leave]').click();
  p.gender = 'female'; openSalonVisit({ changed() {} }, { intro: false });
  out.salonReplies = [...document.querySelectorAll('.sv-reply')].map((x) => x.textContent);
  out.salonBulbs = document.querySelectorAll('.sv-bulbs i').length; out.salonClass = !!document.querySelector('.sv-barber');
  document.querySelector('[data-leave]').click();
  return out;
});
check(shops.transWoman === 'salon' && shops.transMan === 'barber', `the shop follows the gender lived as (${JSON.stringify(shops)})`);
check(shops.sub === 'Barbershop' && shops.barberClass && !shops.bulbs && /Grab a chair/.test(shops.hello), 'a man\'s visit is to the barbershop');
check(shops.barberReplies.includes('Beard grooming') && shops.barberReplies.includes('Eyebrows') && !shops.barberReplies.includes('Makeup'), `the barber offers beard grooming and eyebrows, not makeup (${shops.barberReplies})`);
check(shops.salonReplies.includes('Makeup') && shops.salonReplies.includes('Eyebrows') && !shops.salonReplies.includes('Beard grooming'), `the salon offers makeup and eyebrows (${shops.salonReplies})`);
// Shaped brows are worn over the ones born with, paid for, and kept.
const brows = await page.evaluate(async () => {
  const { store } = await import('/js/state.js'); const { normalize, resolveLook, CATALOG } = await import('/js/avatar/catalog.js'); const salon = await import('/js/engine/salon.js');
  const p = store.state.player; p.appearance = normalize(p.appearance, p.id);
  const born = p.appearance.inherited.brows; const shape = CATALOG.browStyle.find((b) => b.id !== born).id;
  const next = JSON.parse(JSON.stringify(p.appearance)); next.style.browStyle = shape;
  const q = salon.salonQuote(next); const r = salon.applySalon(next);
  return { line: q.lines.map((l) => l.label).join(), ok: r.ok, born: p.appearance.inherited.brows === born, worn: resolveLook(p.appearance, p.id, p.gender).eyebrows === shape, shape };
});
check(/Eyebrow shaping/.test(brows.line) && brows.ok && brows.born && brows.worn, `shaped brows are bought and worn, the natural ones kept (${JSON.stringify(brows)})`);
check(shops.salonBulbs > 0 && !shops.salonClass, 'a woman\'s is to the beauty salon, bulbs round the mirror');
check(!errors.length, `no page errors (${errors.join('; ')})`);
await browser.close();
server.close();
if (problems.length) { console.log(problems.map((p) => `FAIL ${p}`).join('\n')); process.exit(1); }
console.log('The salon visit: a sign, a mirror, a stylist, and a bill.');
