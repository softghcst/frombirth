// A tour of the game at phone size: every main tab and the career screens, with a screenshot of each and a check for
// anything that runs off the screen or is too small to tap. Run with: node scripts/phone-tour.mjs <outdir>
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2] ?? '/tmp/tour';
const root = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  try { const body = await readFile(path.endsWith('/') ? join(path, 'index.html') : path); res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end(); }
}).listen(0);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/index.html`);
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.evaluate(() => localStorage.setItem('frombirth.birthGlobe', 'off')); await page.click('[data-random]'); await page.waitForSelector('[data-year]');
const clear = () => page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
await clear();
const report = [];
/** Screenshot, and what runs off a 390px screen or is too small to tap. */
async function audit(name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/${name}.png` });
  const r = await page.evaluate(() => {
    const W = window.innerWidth;
    const scope = document.querySelector('#modal-root .modal:last-of-type') ?? document.body;
    const off = [];
    for (const el of scope.querySelectorAll('*')) {
      const b = el.getBoundingClientRect();
      if (b.width && b.right > W + 1 && getComputedStyle(el).position !== 'fixed') {
        // Ignore children of horizontally scrolling strips, which are meant to scroll.
        let p = el.parentElement, scroller = false;
        while (p && p !== scope) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') { scroller = true; break; } p = p.parentElement; }
        if (!scroller) off.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.innerText ?? '').trim().slice(0, 40)}" right=${Math.round(b.right)}`);
      }
    }
    const small = [...scope.querySelectorAll('button:not([disabled])')].filter((b) => { const r = b.getBoundingClientRect(); return r.width && r.height && r.height < 30; }).map((b) => `"${b.innerText.trim().slice(0, 30)}" h=${Math.round(b.getBoundingClientRect().height)}`);
    return { hscroll: document.documentElement.scrollWidth > W + 1, off: off.slice(0, 6), small: [...new Set(small)].slice(0, 6) };
  });
  report.push({ name, ...r });
}
const tab = async (id) => { await clear(); await page.evaluate((t) => { const b = document.querySelector(`.tab-btn[data-tab="${t}"]`); if (!b.classList.contains('active')) b.click(); }, id); await page.waitForTimeout(250); };
const tabs = await page.evaluate(() => [...document.querySelectorAll('.tab-btn')].map((b) => b.dataset.tab));
for (const t of tabs) { await tab(t); await audit(`tab-${t}`); }

// A lawyer with cases, a doctor, a detective: set up through the engines, then their screens.
const engine = (fn) => page.evaluate(fn);
await engine(async () => {
  const { store } = await import('/js/state.js');
  const career = await import('/js/engine/career.js'); const { CAREER_BY_ID } = await import('/js/data/careers.js');
  const ls = await import('/js/engine/lawSchool.js'); const lp = await import('/js/engine/lawPractice.js'); const lc = await import('/js/engine/lawCases.js');
  const p = store.state.player;
  p.countryId = 'us'; p.city = 'Chicago'; p.age = 45; p.birthYear = store.state.year - 45; p.finance.cash = 5e6; p.legal.incarceration = null;
  p.education.degrees.push({ type: 'high', gpa: 3.7, age: 18 }, { type: 'university', majorId: 'political_science', gpa: 3.8, age: 22 }, { type: 'law', majorId: 'political_science', gpa: 3.7, age: 25 });
  const L = ls.lawOf(p);
  L.bar.admitted = { year: store.state.year - 15, m: ls.nowM(), where: 'United States', body: 'admission to the state bar' };
  (p.flags.licenses ??= []).push('law');
  career.hire(CAREER_BY_ID.prosecutor, 2, 70, 'tour');
  p.career.experience = { prosecutor: 16 };
  for (const id of ['burglary', 'fraud', 'drug_supply']) { const c = lc.createCase(id, { role: 'prosecution' }); c.awaiting = id === 'fraud' ? { what: 'trial', since: ls.nowM(), turn: ls.nowM() } : null; }
  store.notify();
});
await tab('work'); await audit('work-lawyer');
await page.evaluate(() => document.querySelector('[data-act="law"]').click()); await page.waitForTimeout(300);
await audit('law-guide');
await page.evaluate(() => document.querySelector('#modal-root [data-guideok]')?.click()); await page.waitForTimeout(200);
const lawTabs = await page.evaluate(() => [...document.querySelectorAll('#modal-root .law-hub [data-tab]')].map((b) => b.dataset.tab));
for (const t of lawTabs) { await page.evaluate((x) => document.querySelector(`#modal-root .law-hub [data-tab="${x}"]`).click(), t); await audit(`law-${t}`); }
await page.evaluate(() => document.querySelector('#modal-root .law-hub [data-tab="cases"]').click()); await page.waitForTimeout(150);
await page.evaluate(() => document.querySelector('#modal-root .law-hub [data-case]').click()); await audit('law-case');
await page.evaluate(() => document.querySelector('#modal-root .law-hub [data-back]')?.click());
await page.evaluate(() => document.querySelector('#modal-root .law-hub [data-tab="progress"]').click()); await page.waitForTimeout(150);
await page.evaluate(() => document.querySelector('#modal-root [data-seek="da"]')?.click()); await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('#modal-root .modal:last-of-type [data-yes]')?.click()); await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('#modal-root .modal:last-of-type [data-ok]')?.click()); await page.waitForTimeout(300);
await audit('law-campaign');
await clear();

// A doctor.
await engine(async () => {
  const { store } = await import('/js/state.js');
  const core = await import('/js/engine/medicine/core.js'); const train = await import('/js/engine/medicine/training.js');
  const { trainingSites } = await import('/js/engine/medicine/hospitals.js'); const cases = await import('/js/engine/medicine/cases.js');
  const p = store.state.player;
  const m = core.M(p); m.license = { status: 'full', countryId: 'us' };
  train.startPost('gensurg', trainingSites('gensurg', p.countryId, p.city)[0].e.id, 'attending');
  cases.caseload(m, p);
  store.notify();
});
await tab('work'); await audit('work-doctor');
// The career screens open straight from their modules: the Work tab's entry to them depends on the job held.
const openScreen = (mod, fn) => page.evaluate(async ([m, f]) => { (await import(m))[f]({ changed() {}, rerender() {} }); }, [mod, fn]);
const tabsIn = (sel) => page.evaluate((q) => [...document.querySelectorAll(q)].map((b) => b.innerText.trim()), sel);
const clickTab = (sel, i) => page.evaluate(([q, k]) => document.querySelectorAll(q)[k].click(), [sel, i]);
const slug = (t) => t.replace(/\W+/g, '-').toLowerCase();
await openScreen('/js/ui/medicine.js', 'openMedicine'); await page.waitForTimeout(300); await audit('medicine-hub');
const medSel = '#modal-root [data-med] [role="tab"]';
for (const [i, t] of (await tabsIn(medSel)).entries()) { await clickTab(medSel, i); await audit(`medicine-${slug(t)}`); }
await clear();

// A detective.
await engine(async () => {
  const { store } = await import('/js/state.js');
  const icore = await import('/js/engine/investigations/core.js'); const A = await import('/js/engine/investigations/agencies.js'); const W = await import('/js/engine/investigations/casework.js');
  const p = store.state.player;
  const a = A.agencyOf('municipal', p.countryId, p.city);
  const r = icore.I(p);
  r.job = { agencyId: a.id, employerId: a.employerId, rank: 'detective', detective: true, specialty: 'property', since: store.state.year, rankSince: store.state.year };
  const inv = W.openCase('burglary', { ownerId: a.id, truth: 'insider' });
  r.caseIds.push(inv.id);
  store.notify();
});
await openScreen('/js/ui/investigations.js', 'openInvestigations'); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelectorAll('#modal-root .modal:not(:has([data-inv])) [data-ok]').forEach((b) => b.click())); await page.waitForTimeout(150);
await audit('investigations-hub');
const invSel = '#modal-root [data-inv] [role="tab"]';
for (const [i, t] of (await tabsIn(invSel)).entries()) { await clickTab(invSel, i); await audit(`investigations-${slug(t)}`); }
await page.evaluate(() => document.querySelector('#modal-root [data-inv] [data-sec="cases"]')?.click()); await page.waitForTimeout(150);
await page.evaluate(() => document.querySelector('#modal-root [data-inv] [data-act="openCase"]')?.click()); await page.waitForTimeout(300);
const caseSel = '#modal-root [data-case] [role="tab"]';
for (const [i, t] of (await tabsIn(caseSel)).entries()) { await clickTab(caseSel, i); await audit(`case-${slug(t)}`); }
await clear();

console.log(JSON.stringify({ report: report.filter((r) => r.hscroll || r.off.length || r.small.length), errors, screens: report.map((r) => r.name) }, null, 1));
await browser.close(); server.close();
