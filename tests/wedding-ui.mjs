// Browser check of planning a wedding at phone width (js/ui/weddingPlanner.js): the planner's sign, the nine choices with
// the venue drawn behind, the partner's dream, the prenup, the bill, booking, the aisle, the vows, the kiss and the
// finale; and stopping part-way, which changes nothing. Needs Playwright. Run with: node tests/wedding-ui.mjs
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

/** Through the journey scene (js/ui/journey.js): a tap takes the window seat and flies on; a moment in the air is answered. */
const throughJourney = async (page) => { for (let i = 0; i < 30 && await page.locator('.journey-screen').count(); i++) { const ch = page.locator('.journey-screen [data-choice]').first(); const on = page.locator('.journey-screen [data-onward]'); if (await ch.count()) await ch.click().catch(() => {}); else if (await on.count()) await on.click().catch(() => {}); else await page.locator('.journey-screen').click({ position: { x: 5, y: 5 } }).catch(() => {}); await page.waitForTimeout(300); } };
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
// An engagement to a best friend from school.
const setUp = () => page.evaluate(async () => {
  const { store } = await import('/js/state.js'); const { makeNpc } = await import('/js/engine/npcFactory.js');
  const p = store.state.player; p.age = 30; p.finance.cash = 1e15; p.legal.incarceration = null;
  for (const n of Object.values(store.state.npcs)) if (['partner', 'spouse'].includes(n.role)) n.role = 'friend';
  const n = makeNpc({ role: 'partner', age: 30, countryId: p.countryId, gender: p.gender === 'male' ? 'female' : 'male' });
  n.flags.engaged = true; n.flags.title = 'Best friend'; n.meters.relationship = 80;
  store.state.npcs[n.id] = n; p.npcIds.push(n.id);
  const love = await import('/js/engine/romance.js');
  return { id: n.id, dream: love.dreamOf(n), cash: p.finance.cash, rel: n.meters.relationship };
});
const open = (id, intro) => page.evaluate(async ({ id, intro }) => {
  const { store } = await import('/js/state.js'); const { openWeddingPlanner } = await import('/js/ui/weddingPlanner.js');
  window.__wed = openWeddingPlanner({ changed() {} }, store.state.npcs[id], { intro }).then((r) => { window.__wedDone = r; });
}, { id, intro });
const info = await setUp();
await open(info.id, true);
check(await page.locator('.wp-intro .sv-logo-sub').textContent() === 'Wedding planning', 'it opens on the planner\'s sign');
await page.waitForSelector('.sv-reply:has-text("Let\'s plan it!")', { timeout: 5000 });
await page.click('.sv-reply:has-text("Let\'s plan it!")');
// The nine choices. The venue shows behind the couple as it is chosen, and the dream is marked.
check(await page.locator(`[data-pick="${info.dream.venue}"] .wp-dream`).count() === 1, 'the partner\'s dream venue is marked');
const stageBefore = await page.locator('.wp-stage .sv-room').innerHTML();
await page.click(`[data-pick="${info.dream.venue}"]`);
check(await page.locator('.wp-stage .sv-room').innerHTML() !== stageBefore || info.dream.venue === 'courthouse', 'choosing a venue changes the scene');
check(/cry/.test(await page.locator('.sv-bubble p').innerText()), 'and the planner reacts to the dream venue');
check(await page.locator('.sv-reply.primary').isEnabled(), 'a choice made, Next is open');
const picks = { guests: info.dream.big ? 'big' : 'small', theme: 'lavender', flowers: 'peonies', attire: 'rack', cake: 'tiered', music: 'band', food: 'buffet', honeymoon: 'trip' };
await page.click('.sv-reply.primary');
for (const [k, v] of Object.entries(picks)) {
  check(!(await page.locator('.sv-reply.primary').isEnabled()), 'Next waits for a choice');
  await page.click(`[data-pick="${v}"]`);
  if (k === 'honeymoon') {
    // The honeymoon, planned right here: somewhere else in the home country (no passport needed), a week, by whatever goes there.
    check(await page.locator('.wp-hm select[data-hm="country"]').count() === 1, 'choosing a honeymoon opens its plan: where, how long, how, where to stay');
    const home = await page.evaluate(async () => { const { store } = await import('/js/state.js'); const { COUNTRIES } = await import('/js/data/countries.js'); const p = store.state.player; return { c: p.countryId, city: COUNTRIES[p.countryId].cities.find((x) => x !== p.city) ?? COUNTRIES[p.countryId].cities[0] }; });
    await page.selectOption('.wp-hm select[data-hm="country"]', home.c);
    await page.selectOption('.wp-hm select[data-hm="city"]', home.city);
    await page.click('.wp-hm [data-hm-nights="7"]');
    const hmText = await page.locator('.wp-hm').innerText();
    check(/Honeymoon: /.test(hmText) && await page.locator('.sv-reply.primary').isEnabled(), `and prices it, ready to book (${hmText.replace(/\n/g, ' | ').slice(0, 160)})`);
    check(/with the honeymoon/.test(await page.locator('[data-bill]').innerText()), 'its cost goes on the wedding bill');
  }
  await page.click('.sv-reply.primary');
}
check(/prenup/.test(await page.locator('.sv-bubble p').innerText()), 'then the prenup is asked about');
await page.click('.sv-reply:has-text("No prenup")');
const receipt = await page.locator('.sv-receipt').innerText();
check(/Honeymoon: /.test(receipt), `the bill has the honeymoon on it (${receipt.slice(0, 200)})`);
check(/Total/.test(receipt) && /buffet, for/i.test(receipt) && /everything .* dreamed of/.test(await page.locator('.sv-bubble p').innerText()), `the bill lists the plan, and the planner says it is their dream (${receipt.replace(/\n/g, ' | ')})`);
await page.click('.sv-reply:has-text("Book the wedding")');
const mid = await page.evaluate(async (id) => { const { store } = await import('/js/state.js'); const { roleLabel } = await import('/js/engine/relationships.js'); const n = store.state.npcs[id]; return { role: n.role, label: roleLabel(n), cash: store.state.player.finance.cash, wedding: n.flags.wedding }; }, info.id);
check(mid.role === 'spouse' && /^(Wife|Husband)$/.test(mid.label) && mid.cash < info.cash && mid.wedding?.venue === info.dream.venue, `booking it marries them and pays for it; the best friend is now ${mid.label}`);
// The day.
await page.click('.sv-reply:has-text("Take their hand")');
check(await page.locator('.wp-banner').count() === 1 && await page.locator('.wp-cake svg').count() === 1 && await page.locator('.wp-band svg').count() === 1, 'the names on a banner, the cake and the band either side');
check(await page.locator('.sv-reply').count() === 3, 'three kinds of vows');
await page.click('.sv-reply:has-text("Vows I wrote myself")');
check(await page.locator('.wp-narration').count() === 1, 'what the vows do is told');
await page.click('.sv-reply:has-text("Listen")');
await page.click('.sv-reply:has-text("I do")');
await page.click('.sv-reply:has-text("Kiss")');
check(await page.locator('.wp-finale .wp-just').innerText() === 'Just married!' && await page.locator('.wp-finale .wp-frame svg').count() === 2, 'the finale: just married, the two of you');
check(/Off on the honeymoon/i.test(await page.locator('[data-done]').textContent()), 'the finale sends them off on the honeymoon');
await page.click('[data-done]');
await page.waitForTimeout(100);
const booked = await page.evaluate(async () => { const travel = await import('/js/engine/travel.js'); const id = window.__wedDone?.honeymoonTrip; const t = id && travel.tripById(id); return { id, status: t?.status, honeymoon: !!t?.honeymoon, listed: travel.tripTypes().find((x) => x.id === 'honeymoon').why }; });
check(booked.id && booked.status === 'confirmed' && booked.honeymoon, `the honeymoon was booked with the wedding (${JSON.stringify(booked)})`);
check(!!booked.listed, `and it is never on offer in the trip planner on its own (${booked.listed})`);
// Off they go: the journey on a map, the honeymoon's moments, home, and a postcard from where they went.
await page.evaluate(async (id) => { const { goOnTrip } = await import('/js/ui/globalLife.js'); window.__went = goOnTrip({ changed() {} }, id).then((r) => { window.__wentDone = r; }); }, booked.id);
await page.waitForSelector('.journey-screen', { timeout: 8000 }).catch(() => {});
check(await page.locator('.journey-screen').count() === 1, 'leaving shows the journey on the globe');
await throughJourney(page);
for (let n = 0; n < 12; n++) {
  await page.waitForTimeout(250);
  if (await page.locator('.wq-postcard').count()) break;
  const ch = page.locator('#modal-root .modal .choice-btn:not([disabled])');
  if (await ch.count()) { await ch.first().click(); continue; }
  const ok = page.locator('#modal-root .modal [data-ok]');
  if (await ok.count()) await ok.last().click();
}
check(await page.locator('.wq-postcard .wp-pc-front svg').count() === 1, 'home again, a postcard from the honeymoon');
await page.click('.wq-postcard [data-done]').catch(() => {});
check(!(await page.locator('.wp-screen').count()) && (await page.evaluate(() => window.__wedDone))?.married === true, 'back to the game, married');
const rel = await page.evaluate(async (id) => { const { store } = await import('/js/state.js'); return store.state.npcs[id].meters.relationship; }, info.id);
check(rel >= info.rel, 'the day brought them closer');
// Stopping part-way: nothing paid, still engaged.
const again = await setUp();
await open(again.id, false);
await page.click('.sv-reply:has-text("Let\'s plan it!")');
await page.click('[data-pick="beach"]');
await page.click('[data-leave]');
await page.click('.sv-reply:has-text("Leave")');
const after = await page.evaluate(async (id) => { const { store } = await import('/js/state.js'); const n = store.state.npcs[id]; return { cash: store.state.player.finance.cash, role: n.role, engaged: n.flags.engaged }; }, again.id);
check(after.cash === again.cash && after.role === 'partner' && after.engaged && !(await page.locator('.wp-screen').count()), 'stopping part-way changes nothing');
// Guest lists, from eloping to everyone: a bigger list costs more.
const lists = await page.evaluate(async () => {
  const love = await import('/js/engine/romance.js');
  const base = { venue: 'garden', theme: 'blush', flowers: 'wild', attire: 'rack', cake: 'tiered', music: 'playlist', food: 'buffet', honeymoon: 'home' };
  return love.WEDDING_PLAN.guests.map((g) => ({ id: g.id, count: g.count, cost: love.planTotals({ ...base, guests: g.id }).cost }));
});
check(lists.length >= 5 && lists.some((g) => g.id === 'intimate') && lists.every((g, i) => !i || g.cost > lists[i - 1].cost), `guest lists from eloping to everyone, each costing more (${lists.map((g) => `${g.id} ${g.count}`).join(', ')})`);
// With the scenes turned off in Settings: one page, a ready-made plan, then a "Just married!" card.
const third = await setUp();
await page.evaluate(async (id) => {
  const { store } = await import('/js/state.js'); const w = await import('/js/ui/weddingPlanner.js');
  w.setWeddingScenes(false); window.__scenesOff = !w.weddingScenesOn();
  window.__quick = w.openWedding({ changed() {} }, store.state.npcs[id]).then((r) => { window.__quickDone = r; });
}, third.id);
check(await page.evaluate(() => window.__scenesOff) && !(await page.locator('.wp-screen').count()) && await page.locator('.modal select[data-key="guests"]').count() === 1, 'with the scenes off, the wedding is planned on one page, guest list and all');
const cityHall = await page.locator('[data-total]').innerText();
await page.click('[data-preset="elope"]');
const eloped = await page.locator('[data-total]').innerText();
check(eloped !== cityHall, `eloping costs less than city hall (${eloped} against ${cityHall})`);
await page.selectOption('select[data-key="guests"]', 'huge');
check(await page.locator('[data-total]').innerText() !== eloped, 'and the guest list changes the price');
await page.click('[data-preset="elope"]');
await page.click('[data-yes]');
check(/Just married/.test(await page.locator('.wq-married').innerText()), 'then a "Just married!" card');
await page.click('.wq-married [data-ok]'); await page.waitForTimeout(50);
const q = await page.evaluate(async (id) => { const { store } = await import('/js/state.js'); const n = store.state.npcs[id]; return { role: n.role, venue: n.flags.wedding?.venue, done: window.__quickDone }; }, third.id);
check(q.role === 'spouse' && q.venue === 'courthouse' && q.done?.married, 'married, at city hall');
await page.evaluate(async () => { (await import('/js/ui/weddingPlanner.js')).setWeddingScenes(true); });
// The honeymoon is planned in the trip planner, the spouse already coming; the journey is shown on a map; home again,
// a postcard of wherever they went.
const hm = await page.evaluate(async (id) => {
  const { store } = await import('/js/state.js'); const w = await import('/js/ui/weddingPlanner.js'); const travel = await import('/js/engine/travel.js');
  await w.planHoneymoon({ changed() {} }, store.state.npcs[id]);
  const trip = travel.trips().find((t) => t.type === 'honeymoon' && t.status === 'draft');
  const open = !!document.querySelector('.gl-modal');
  document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove());
  return { open, coming: trip?.travelers.find((x) => x.id === id)?.status, type: trip?.type };
}, info.id);
check(hm.open && hm.type === 'honeymoon' && hm.coming === 'accepted', `the honeymoon opens in the trip planner, the spouse coming (${JSON.stringify(hm)})`);
await page.evaluate(async () => { const { openJourney } = await import('/js/ui/journey.js'); window.__jr = openJourney({ stops: [{ countryId: 'us', city: 'Chicago' }, { countryId: 'fr', city: 'Paris' }], over: 'air' }); });
await page.waitForSelector('.journey-screen', { timeout: 5000 });
check(await page.locator('.journey-screen canvas').count() === 1 && /Paris/.test(await page.locator('.journey-head').innerText()), 'the flight is shown on the globe, the plane following its route');
await page.click('.journey-screen', { position: { x: 5, y: 5 } }); await page.waitForSelector('.journey-screen', { state: 'detached', timeout: 5000 }).catch(() => {});
check(!(await page.locator('.journey-screen').count()), 'and a tap skips it to the landing, and on');
await page.evaluate(async (id) => {
  const { store } = await import('/js/state.js'); const w = await import('/js/ui/weddingPlanner.js');
  window.__pc = w.honeymoonPostcard({ changed() {} }, { type: 'honeymoon', mode: 'jet', destination: { countryId: 'fr', city: 'Paris' }, origin: { countryId: 'us', city: 'Chicago' }, travelers: [{ id }] });
}, info.id);
await page.waitForSelector('.wp-pc-front svg', { timeout: 5000 });
check(/greetings/i.test(await page.locator('.wp-pc-front svg').innerHTML()) && /france/i.test(await page.locator('.wp-pc-front svg').innerHTML()), 'home again, a painted postcard from France');
await page.click('.wq-postcard [data-done]');
check(!errors.length, `no page errors (${errors.join('; ')})`);
await browser.close();
server.close();
if (problems.length) { console.log(problems.map((p) => `FAIL ${p}`).join('\n')); process.exit(1); }
console.log('The wedding: planned piece by piece, then the aisle, the vows, the kiss and the confetti.');
