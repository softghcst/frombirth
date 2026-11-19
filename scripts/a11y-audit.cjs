// Accessibility audit: runs axe-core on every main screen and the common dialogs, at phone size.
// A developer tool, not part of the game, which has no dependencies. To run it:
//   python3 -m http.server 8765          (from the repository, in one terminal)
//   mkdir -p /tmp/a11y && cd /tmp/a11y && npm i axe-core@4.10.2 playwright
//   AXE=/tmp/a11y/node_modules/axe-core/axe.min.js node /path/to/scripts/a11y-audit.cjs light   (or dark)
// It prints each violation with the screens it was found on. See docs/ACCESSIBILITY.md.
const { chromium } = require('playwright');
const fs = require('fs');
const AXE = fs.readFileSync(process.env.AXE ?? `${__dirname}/node_modules/axe-core/axe.min.js`, 'utf8');
const scheme = process.argv[2] ?? 'light';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const all = {};
  const run = async (screen) => {
    await p.waitForTimeout(350);
    await p.addScriptTag({ content: AXE });
    const r = await p.evaluate(async () => {
      const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
      return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, v.id === 'color-contrast' ? 60 : 4).map((n) => ({ target: n.target.join(' '), summary: (n.failureSummary || '').split('\n').slice(0, 3).join(' '), html: n.html.slice(0, 140) })), count: v.nodes.length }));
    });
    for (const v of r) {
      const k = v.id;
      all[k] ??= { impact: v.impact, help: v.help, screens: [], examples: [] };
      all[k].screens.push(`${screen}(${v.count})`);
      if (k === 'color-contrast') for (const n of v.nodes) { const m = n.summary.match(/foreground color: (#[0-9a-f]+), background color: (#[0-9a-f]+)/); if (m) { all.pairs ??= {}; all.pairs[`${m[1]} on ${m[2]}`] = (all.pairs[`${m[1]} on ${m[2]}`] ?? 0) + 1; } }
      if (all[k].examples.length < 4) all[k].examples.push(...v.nodes.slice(0, 2).map((n) => `${screen}: ${n.target} :: ${n.html} :: ${n.summary}`));
    }
  };
  const modalOpen = async () => !!(await p.$('.scrim:last-child .modal'));
  const close = async () => { for (let i = 0; i < 4 && await modalOpen(); i++) { const c = await p.$('.scrim:last-child [data-close], .scrim:last-child [data-cancel], .scrim:last-child [data-ok], .scrim:last-child [data-no]'); if (c) await c.click(); else await p.keyboard.press('Escape'); await p.waitForTimeout(200); } };

  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  await run('title');
  const create = await p.$('[data-new], [data-start], button:has-text("New life")'); if (create) { await create.click(); await p.waitForTimeout(400); await run('creator'); }
  await p.evaluate(async () => {
    const { store } = await import('./js/state.js'); const { createLife } = await import('./js/engine/characterGen.js'); const { saveGame } = await import('./js/save.js'); const { advanceYear } = await import('./js/engine/yearProcessor.js');
    do { store.state = createLife({ countryId: 'us', city: 'Chicago', firstName: 'Ana', lastName: 'Lima', gender: 'female', birthRank: 'commoner' }); } while (store.state.player.royal);
    for (let i = 0; i < 24; i++) { advanceYear(); store.state.pendingEvents = []; store.state.player.legal.pending = null; store.state.player.stats.health = 90; }
    store.state.player.finance.cash += 100000;
    saveGame(store.state); store.state = null;
  });
  await p.reload(); await p.waitForTimeout(300); await p.click('[data-load]'); await p.waitForTimeout(600);
  await close();
  await run('life');
  for (const tab of await p.$$eval('[data-tab]', (els) => els.map((e) => e.dataset.tab))) {
    if (await p.locator('[data-panel]:not([hidden])').count()) await p.click('[data-panel-close]');
    await p.click(`[data-tab="${tab}"]`); await p.waitForTimeout(300); await close(); await run(`tab-${tab}`);
  }
  // A few modals.
  if (await p.locator('[data-panel]:not([hidden])').count()) await p.click('[data-panel-close]');
  await p.click('[data-tab="self"]'); await p.waitForTimeout(400);
  for (const [sel, name] of [['[data-passport]', 'passport'], ['[data-world]', 'world'], ['[data-news]', 'news'], ['[data-doctor]', 'doctor']]) {
    const ok = await p.evaluate((q) => { const el = [...document.querySelectorAll(q)].find((e) => e.offsetParent); if (el) el.click(); return !!el; }, sel); if (!ok) { console.log('no', name); continue; } await p.waitForTimeout(400); await run(name); await close();
  }
  if (await p.locator('[data-panel]:not([hidden])').count()) await p.click('[data-panel-close]');
  await p.click('[data-tab="holdings"]'); await p.waitForTimeout(250);
  const prop = await p.evaluate(() => { const el = [...document.querySelectorAll('[data-go="property"]')].find((e) => e.offsetParent); if (el) el.click(); return !!el; }); if (prop) { await p.waitForTimeout(300); await run('pick-modal'); await close(); }

  if (all.pairs) { console.log('CONTRAST PAIRS:', JSON.stringify(all.pairs)); delete all.pairs; }
  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  for (const [id, v] of Object.entries(all).sort((a, c) => order[a[1].impact] - order[c[1].impact])) {
    console.log(`\n[${v.impact}] ${id}: ${v.help}\n  on: ${v.screens.join(', ')}`);
    for (const e of v.examples) console.log('   -', e.slice(0, 330));
  }
  console.log('\nERRORS:', errs.slice(0, 4).join(' | ') || 'none');
  await b.close();
})();
