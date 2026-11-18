// Accessibility audit of Explore the World: axe-core on every screen of the hub (31, with the document and journal
// tabs), at phone size, in the light or dark theme, then a keyboard pass. Files are served from the repository by
// the browser itself, so no web server is needed. A developer tool, not part of the game. To run it:
//   mkdir -p /tmp/a11y && cd /tmp/a11y && npm i axe-core@4.10.2 playwright
//   AXE=/tmp/a11y/node_modules/axe-core/axe.min.js node scripts/a11y-explore.cjs light   (or dark)   [save.json]
// With no save file it builds a life in the page: a trip taken, a plan made, a move approved. See docs/ACCESSIBILITY.md.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const AXE = fs.readFileSync(process.env.AXE ?? `${__dirname}/node_modules/axe-core/axe.min.js`, 'utf8');
const scheme = process.argv[2] ?? 'light';
const seed = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, deviceScaleFactor: 1 });
  await ctx.route('http://localhost:8765/**', (route) => {
    let rel = decodeURIComponent(new URL(route.request().url()).pathname); if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] ?? 'application/octet-stream', body: fs.readFileSync(file) });
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  if (seed) await p.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, seed);
  await p.goto('http://localhost:8765/');
  if (!seed) {
    // A life of its own: thirty, with a passport and one trip abroad behind them.
    await p.evaluate(async () => {
      const { store } = await import('./js/state.js'); const { createLife } = await import('./js/engine/characterGen.js'); const { saveGame } = await import('./js/save.js');
      const travel = await import('./js/engine/travel.js'); const docs = await import('./js/engine/documents.js');
      let s; do { s = createLife({ countryId: 'us' }); } while (s.player.royal);
      store.state = s; const pl = s.player; pl.age = 30; s.year += 30; pl.finance.cash = 200000; pl.flags.livesWithParents = false;
      docs.applyPassport(pl.id, 'us');
      const t = travel.startPlan('vacation');
      travel.updatePlan(t.id, { destination: { countryId: 'jp', city: 'Kyoto' }, depart: `${s.year}-03-01`, ret: `${s.year}-03-10`, mode: 'jet', stay: 'hotel', activities: ['landmark'] });
      travel.confirm(t.id); travel.depart(t.id); travel.comeHome(t.id);
      saveGame(s);
    });
    await p.reload();
  }
  await p.click('[data-load]'); await p.waitForSelector('.tab-btn');
  // State for the screens that need it: a plan with everything chosen, an approved move with its checklist.
  const ids = await p.evaluate(async () => {
    const travel = await import('./js/engine/travel.js'); const reloc = await import('./js/engine/relocation.js'); const { store } = await import('./js/state.js');
    const t = travel.startPlan('vacation');
    travel.updatePlan(t.id, { destination: { countryId: 'jp', city: 'Kyoto' }, depart: `${store.state.year}-06-01`, ret: `${store.state.year}-06-10`, mode: 'jet', stay: 'hotel', activities: ['museum'] });
    const r = reloc.applyToMove('pt', 'settle', 'Lisbon');
    if (r.app) { r.app.status = 'approved'; r.app.history.push({ year: store.state.year, status: 'approved' }); }
    const past = travel.trips(['completed'])[0];
    const ev = store.state.canon.events[0];
    const home = Object.keys(store.state.archive?.homes ?? {})[0];
    return { plan: t.id, trip: past?.id, ev: ev?.id, home };
  });
  const all = {};
  const run = async (screen) => {
    await p.waitForTimeout(250);
    await p.addScriptTag({ content: AXE });
    const r = await p.evaluate(async () => {
      const res = await window.axe.run(document.querySelector('.gl-modal') ?? document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
      return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, count: v.nodes.length, nodes: v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} :: ${n.html.slice(0, 120)} :: ${(n.failureSummary || '').split('\n').slice(0, 2).join(' ')}`) }));
    });
    for (const v of r) { const k = v.id; all[k] ??= { impact: v.impact, help: v.help, screens: [], examples: [] }; all[k].screens.push(`${screen}(${v.count})`); if (all[k].examples.length < 4) all[k].examples.push(...v.nodes.slice(0, 2).map((n) => `${screen}: ${n}`)); }
  };
  const hub = () => p.locator('.gl-modal').last();
  const open = async (view, params = {}) => {
    await p.evaluate(async ([v, prm]) => { document.querySelectorAll('.scrim').forEach((s) => s.remove()); const m = await import('./js/ui/globalLife.js'); m.openExplore({ changed() {} }, { view: v, params: prm }); }, [view, params]);
    await hub().waitFor();
  };
  const views = [['discover'], ['destination', { id: 'pt', city: 'Lisbon' }], ['plan', { id: ids.plan }], ['trips'], ...(ids.trip ? [['trip', { id: ids.trip }]] : []),
    ['immigration'], ['lived'], ['residence', { id: '0' }], ['languages'], ['story'], ...(ids.ev ? [['event', { id: ids.ev }]] : []), ...(ids.home ? [['house', { id: ids.home }]] : [])];
  for (const [v, prm] of views) { await open(v, prm ?? {}); await run(v); }
  for (const tab of ['citizenship', 'passports', 'visas', 'residence', 'applications', 'history']) { await open('documents'); await hub().locator(`[data-tab="${tab}"]`).click(); await run(`documents:${tab}`); }
  for (const tab of ['timeline', 'map', 'country', 'year', 'companions', 'favorites', 'collection']) { await open('journal'); await hub().locator(`[data-tab="${tab}"]`).click(); await run(`journal:${tab}`); }
  await open('immigration'); await hub().locator('select[data-dest]').selectOption('jp'); await run('immigration:routes');
  await open('story'); const mk = hub().locator('[data-marker]').first(); if (await mk.count()) { await mk.dispatchEvent('click'); await run('story:marker'); }
  // Keyboard: the hub can be worked without a mouse.
  await open('discover');
  const focus = await p.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName}${a.className ? '.' + a.className.split(' ')[0] : ''}` : 'none'; });
  let reached = 0; const seen = new Set();
  for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); const id = await p.evaluate(() => { const a = document.activeElement; return a && a.closest('.gl-modal') ? (a.dataset.section ?? a.dataset.filter ?? a.dataset.dest ?? a.textContent.trim().slice(0, 20)) : null; }); if (id) { reached += 1; seen.add(id); } }
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const closed = !(await p.$('.gl-modal'));
  console.log(JSON.stringify({ scheme, violations: all, keyboard: { firstFocus: focus, stopsInHub: reached, distinct: seen.size, escapeCloses: closed }, errors: errs }, null, 1));
  await b.close();
})();
