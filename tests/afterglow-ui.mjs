// Browser check of the Afterglow look: Light, Dark and System appearance (kept after a reload), the life screen's
// header, journal and dock at phone widths, Age Up (exactly one year) and Age down, the five sections, saves that
// load, long names and large sums that fit, portraits in both themes, and no sideways scrolling.
// Needs Playwright (preinstalled where the checks run). Serves the game itself.
// Run with: node tests/afterglow-ui.mjs            (AFTERGLOW_SHOTS=<folder> also saves screenshots of every screen)
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  try { ({ chromium } = require(join(process.execPath, '../../lib/node_modules/playwright'))); } catch { console.log('Playwright is not available here: browser check skipped.'); process.exit(0); }
}
const root = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!path.startsWith(root)) { res.writeHead(403); return res.end(); }
  try { const body = await readFile(path.endsWith('/') ? join(path, 'index.html') : path); res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const shots = process.env.AFTERGLOW_SHOTS;
if (shots) await mkdir(shots, { recursive: true });

const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };
const browser = await chromium.launch();

/** Answers whatever the game puts in front of the player until the year button is free again. */
async function settle(page) {
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(60);
    const choice = page.locator('#modal-root .scrim:last-child .choice-btn:not([disabled])');
    const ok = page.locator('#modal-root .scrim:last-child [data-ok], #modal-root .scrim:last-child [data-no]');
    if (await choice.count()) { await choice.first().click(); continue; }
    if (await ok.count()) { await ok.first().click(); continue; }
    if (await page.locator('[data-year]:not([disabled])').count()) return;
  }
}
const age = (page) => page.evaluate(async () => (await import('/js/state.js')).store.state.player.age);
const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };

for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await shot(page, `title-${scheme}`);

  // System appearance follows the device.
  const want = scheme === 'dark' ? 'rgb(35, 28, 45)' : 'rgb(241, 235, 250)';
  check(await bg(page) === want, `${scheme}: System appearance follows the device (${await bg(page)})`);

  // Character creator.
  await page.click('[data-design]');
  await page.waitForTimeout(250);
  check(await page.locator('.avatar.preview svg, .creator svg').count(), `${scheme}: the creator shows a portrait`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${scheme}: creator has no sideways scrolling`);
  await shot(page, `creator-${scheme}`);
  const edit = page.locator('[data-design-look]');
  if (await edit.count()) {
    await edit.click(); await page.waitForTimeout(300);
    if (await page.locator('.av-screen').count()) {
      check(await page.locator('.av-portrait svg').count(), `${scheme}: the appearance editor shows the portrait`);
      await shot(page, `appearance-editor-${scheme}`);
      await page.locator('.av-screen [data-cancel]').click(); await page.waitForTimeout(200);
    }
  }
  await page.goto(`http://localhost:${port}/index.html`);

  // A life.
  await page.click('[data-random]');
  await page.waitForSelector('[data-year]');
  await settle(page);
  for (let y = 0; y < 6; y++) { await page.click('[data-year]'); await page.waitForTimeout(450); await settle(page); } // a second press within 0.4s is a double tap, and ignored

  // Age Up: exactly one year, and the button names the age to come.
  const before = await age(page);
  const badge = await page.locator('[data-year] .yb-badge').innerText();
  const aria = await page.locator('[data-year]').getAttribute('aria-label');
  check(badge === String(before + 1) && aria === `Age up, to age ${before + 1}`, `${scheme}: Age up shows the next age (badge ${badge}, "${aria}")`);
  check(await page.locator('[data-dock-age]').innerText() === `Age ${before} · ${await page.evaluate(async () => (await import('/js/state.js')).store.state.year)}`, `${scheme}: the dock shows the age and the year`);
  // Every stat in the dock is the one in the game.
  const stats = await page.evaluate(async () => {
    const p = (await import('/js/state.js')).store.state.player;
    return [...document.querySelectorAll('.dock .meter')].map((m) => [m.getAttribute('aria-label'), m.querySelector('.val').textContent,
      `${Math.round(p.stats[{ Mood: 'mood', Health: 'health', Intellect: 'intellect', Charm: 'charm' }[m.getAttribute('aria-label')]])}%`]);
  });
  check(stats.length === 4 && stats.every(([, shown, real]) => shown === real), `${scheme}: the four stats show their values (${JSON.stringify(stats)})`);
  // A quick double tap is one year, not two.
  await page.evaluate(() => { const b = document.querySelector('[data-year]'); b.click(); b.click(); b.click(); });
  await settle(page);
  check(await age(page) === before + 1, `${scheme}: rapid taps advance exactly one year (${before} → ${await age(page)})`);
  check(await page.locator('.age-head', { hasText: `Age ${before + 1}` }).count() === 1, `${scheme}: the journal has a heading for the new age`);
  // The bars follow the game: change a stat, and the dock catches up.
  await page.evaluate(async () => { (await import('/js/state.js')).store.state.player.stats.mood = 12; });
  await page.click('[data-menu]'); await page.locator('#modal-root .choice-btn', { hasText: 'Settings' }).click();
  await page.locator('#modal-root [data-cancel]').click(); await page.waitForTimeout(150); // Settings redraws the life when it closes
  check(await page.locator('.dock .meter[aria-label="Mood"] .val').innerText() === '12%' && await page.locator('.dock .meter[aria-label="Mood"] .fill.low').count() === 1, `${scheme}: a stat bar updates, and turns red when low`);
  await page.waitForTimeout(600);
  await shot(page, `main-${scheme}`);

  // Age down takes it back, after asking.
  await page.click('[data-undo]');
  await page.locator('#modal-root [data-yes]').click();
  await page.waitForSelector('[data-year]'); await settle(page);
  check(await age(page) === before, `${scheme}: Age down goes back one year (${await age(page)})`);

  // The journal scrolls on its own and the dock never sits on it.
  const layout = await page.evaluate(() => {
    const j = document.querySelector('[data-journal]').getBoundingClientRect();
    const d = document.querySelector('.dock').getBoundingClientRect();
    const el = document.querySelector('[data-journal]');
    return { overlap: j.bottom - d.top, scrolls: getComputedStyle(el).overflowY, tall: el.scrollHeight > el.clientHeight };
  });
  check(layout.overlap <= 1, `${scheme}: the dock does not cover the journal (${layout.overlap}px)`);
  check(layout.scrolls === 'auto' && layout.tall, `${scheme}: the journal scrolls by itself`);

  // Portraits are drawn.
  const face = await page.evaluate(() => { const r = document.querySelector('.idcard .avatar svg')?.getBoundingClientRect(); return r ? r.width * r.height : 0; });
  check(face > 1500, `${scheme}: the header portrait is drawn`);

  // The five sections.
  for (const [tab, title] of [['work', 'Work & School'], ['holdings', 'Holdings'], ['people', 'People'], ['pursuits', 'Pursuits'], ['self', 'Self']]) {
    while (await page.locator('[data-panel]:not([hidden])').count()) await page.click('[data-panel-close]');
    await page.click(`.tab-btn[data-tab="${tab}"]`); await page.waitForTimeout(300);
    check(!(await page.locator('.dock').isVisible()), `${scheme}: the dock steps aside while ${tab} is open`);
    check(await page.locator('[data-panel-close]').isVisible(), `${scheme}: ${tab} has a back button`);
    check(await page.locator('[data-panel]:not([hidden]) [data-panel-title]').innerText() === title, `${scheme}: ${tab} opens`);
    const spill = await page.evaluate(() => { const b = document.querySelector('[data-panel-body]'); const edge = b.getBoundingClientRect().right;
      return b.scrollWidth <= b.clientWidth + 1 ? '' : [...b.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > edge + 1).slice(0, 4).map((e) => `${e.tagName}.${e.className?.baseVal ?? e.className}`).join(', ') || 'unknown'; });
    check(!spill, `${scheme}: ${tab} has no sideways scrolling (${spill})`);
    if (tab === 'people') check(await page.locator('.rel-card').count() > 0 && await page.locator('[data-top="tree"]').count() === 1, `${scheme}: People shows relationship cards and the family tree`);
    await shot(page, `${tab}-${scheme}`);
  }
  while (await page.locator('[data-panel]:not([hidden])').count()) await page.click('[data-panel-close]');
  check(await page.locator('.dock').isVisible(), `${scheme}: back brings the dock back`);
  // Everything about work is on the Work tab: jobs, and athletics and politics under Special careers. Back steps out one level at a time.
  await page.click('.tab-btn[data-tab="pursuits"]');
  check(!(await page.locator('[data-panel-body] [data-go="athletics"]').count()), `${scheme}: My Athletics is no longer in Pursuits`);
  await page.click('[data-panel-close]');
  await page.click('.tab-btn[data-tab="work"]');
  const title = () => page.locator('[data-panel-title]').innerText();
  await page.click('.sec-row[data-sec="Special careers"]');
  check(await title() === 'Special Careers' && await page.locator('.sec-body.shown [data-go="athletics"]').isVisible(), `${scheme}: My Athletics is inside Special careers, on the Work tab`);
  await page.click('[data-panel-close]');
  check(await title() === 'Work & School', `${scheme}: back from Special careers goes to the Work & School list`);
  await page.click('[data-panel-close]');
  check(await page.locator('.dock').isVisible(), `${scheme}: and back again returns to the journal`);

  // Settings: choose the other appearance; it holds after a reload.
  const other = scheme === 'dark' ? 'light' : 'dark';
  await page.click('[data-menu]');
  await page.locator('#modal-root .choice-btn', { hasText: 'Settings' }).click();
  await page.waitForTimeout(200);
  await shot(page, `settings-${scheme}`);
  await page.locator('#modal-root .choice-btn', { hasText: 'Appearance' }).click();
  await page.locator('#modal-root .choice-btn', { hasText: other === 'dark' ? 'Dark' : 'Light' }).click();
  await page.waitForTimeout(150);
  check(await page.evaluate(() => document.documentElement.dataset.theme) === other, `${scheme}: choosing ${other} applies it`);
  await page.locator('#modal-root [data-cancel]').last().click();
  await page.reload();
  check(await page.evaluate(() => document.documentElement.dataset.theme) === other, `${scheme}: ${other} is kept after a reload`);
  check(await bg(page) === (other === 'dark' ? 'rgb(35, 28, 45)' : 'rgb(241, 235, 250)'), `${scheme}: the page is drawn ${other} after a reload`);

  // The saved life loads.
  await page.locator('[data-load]').first().click();
  await page.waitForSelector('[data-year]'); await settle(page);
  check(await age(page) === before, `${scheme}: the saved life loads at the age it was left`);

  // The dock at common phone widths: nothing overlaps, nothing scrolls sideways, the journal ends above the dock.
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 760 });
    await page.waitForTimeout(80);
    const d = await page.evaluate(() => {
      const box = (q) => document.querySelector(q).getBoundingClientRect();
      const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const meters = [...document.querySelectorAll('.dock .meter')].map((m) => ({ n: m.querySelector('.name').getBoundingClientRect(), v: m.querySelector('.val').getBoundingClientRect() }));
      const yb = box('[data-year]');
      return {
        wide: document.documentElement.scrollWidth <= innerWidth + 1,
        labels: meters.every(({ n, v }) => n.right <= v.left + 0.5),
        apart: !overlap(box('.dock .meters'), yb),
        tall: yb.height >= 76 && yb.width >= 76,
        tabs: [...document.querySelectorAll('.tab-btn')].every((t) => { const r = t.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.right <= innerWidth; }),
        journal: box('[data-journal]').bottom <= box('.dock').top + 1,
      };
    });
    for (const [k, ok] of Object.entries(d)) check(ok, `${scheme}: at ${width}px the dock is right (${k})`);
    if (width === 375) await shot(page, `dock-375-${scheme === "light" ? "dark" : "light"}`); // by now the run has switched to the other appearance
  }

  // Narrow phone: long names, a long place, a fortune, and every control still reachable.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(async () => {
    const S = await import('/js/state.js');
    const p = S.store.state.player;
    p.firstName = 'Maximiliana-Evangelina'; p.lastName = 'Featherstonehaugh-Wolfeschlegel'; p.city = 'Llanfairpwllgwyngyll-on-the-Sea';
    p.finance.cash = 987654321098 * S.country().currency.scale;
  });
  await page.click('.tab-btn[data-tab="self"]'); await page.click('[data-panel-close]'); // redraws the header
  const fit = await page.evaluate(() => {
    const card = document.querySelector('.idcard').getBoundingClientRect();
    const purse = document.querySelector('.purse').getBoundingClientRect();
    const reach = [...document.querySelectorAll('.tab-btn, [data-year], [data-undo], [data-menu], [data-purse]')].filter((b) => !b.hidden).every((b) => {
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return r.width >= 40 && r.height >= 40 && (hit === b || b.contains(hit));
    });
    return { wide: document.documentElement.scrollWidth <= innerWidth + 1, what: [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 5).map((e) => `${e.tagName}.${e.className?.baseVal ?? e.className}`).join(', '), inside: purse.right <= card.right + 1 && purse.left >= card.left, reach };
  });
  check(fit.wide, `${scheme}: no sideways scrolling at 320px with long names and a fortune (${fit.what})`);
  check(fit.inside, `${scheme}: the money stays inside the header at 320px`);
  check(fit.reach, `${scheme}: every dock and header control is reachable at 320px`);
  await shot(page, `narrow-${other}`);

  check(!errors.length, `${scheme}: no errors on the page (${errors.join('; ')})`);
  await context.close();
}

await browser.close();
server.close();
if (problems.length) { console.log(`${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Afterglow: light, dark and system appearance, the life screen, Age Up and Age down, the five sections, saves and narrow phones all check out.');
