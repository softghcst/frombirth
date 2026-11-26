// My Investigations in a real browser, at phone and desktop widths: the Work tab entry, applying to a
// department through the screen, accepting the academy, then (time moved on through the engine) a
// detective's case file: its tabs, a witness interview chosen from the question picker, an
// investigative step, the notebook showing the claim, and the same file after saving and reloading.
//
// Needs Playwright with Chromium (preinstalled in the cloud sandbox).
// Run with: node tests/investigations-ui.mjs
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { console.log('Playwright is not installed here; skipping the browser test.'); process.exit(0); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8000 + Math.floor(Math.random() * 900);
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const url = `http://127.0.0.1:${port}/index.html`;
const problems = [];
const passed = [];
const check = (cond, text) => { (cond ? passed : problems).push(text); };
const browser = await chromium.launch();
const errors = [];
const fits = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function openHub(page) {
  for (let i = 0; i < 3 && await page.locator('[data-panel]:not([hidden]) [data-panel-close]').count(); i++) await page.click('[data-panel-close]');
  await page.click('.tab-btn[data-tab="work"]');
  // The entry is a row on the Work tab, inside whichever section holds the job's own actions: open it if it is folded.
  const entry = page.locator('[data-act="investigations"]').first();
  // It lives in the Work tab's Special careers section.
  if (!(await entry.isVisible())) {
    const special = page.locator('.sec-row', { hasText: /Special careers/i }).first();
    if (await special.count()) { await special.click(); await page.waitForTimeout(120); }
  }
  await entry.click();
  await page.waitForSelector('[data-inv]');
}
const closeHub = async (page) => { while (await page.locator('#modal-root [data-close]').count()) { await page.locator('#modal-root [data-close]').last().click(); await page.waitForTimeout(80); } };
const dismissMessages = async (page) => { for (let i = 0; i < 4 && await page.locator('#modal-root [data-ok]').count(); i++) { await page.locator('#modal-root [data-ok]').last().click(); await page.waitForTimeout(80); } };

async function run(viewport) {
  const w = viewport.width;
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(`${w}px: ${e.message}`));
  await page.goto(url);
  await page.waitForSelector('[data-random]');
  await page.click('[data-random]');
  await page.waitForSelector('.tab-btn[data-tab="work"]');
  await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const core = await import('/js/engine/investigations/core.js');
    const p = store.state.player;
    p.age = 26; p.countryId = 'us'; p.city = 'Chicago'; p.legal.record = []; p.stats.health = 85; p.stats.intellect = 75; p.stats.charm = 70;
    if (!p.education.degrees.some((d) => d.type === 'high')) p.education.degrees.push({ type: 'high', age: 18 });
    store.state.month = 0;
    Object.assign(core.I(p).skills, { interviewing: 60, ethics: 60, reasoning: 60, writing: 60, law: 50 });
  });
  await openHub(page);
  check(await page.locator('[data-inv] [data-act="hintOk"]').count() === 1, `${w}px: the first visit shows a short tip`);
  await page.locator('[data-inv] [data-act="hintOk"]').first().click();
  await page.waitForTimeout(80);
  check(await page.locator('[data-inv] [data-act="hintOk"]').count() === 0, `${w}px: the tip is gone once read`);
  const sections = await page.locator('[data-inv] [data-sec]').allInnerTexts();
  check(sections.some((s) => /Departments|Agencies/i.test(s)) && !sections.some((s) => /^Cases$|Active Cases/i.test(s)), `${w}px: a newcomer sees the departments, no caseload`);
  check(sections.length <= 7 && await page.locator('[data-inv] [role="tab"]').count() === sections.length, `${w}px: tabs, a handful of them (${sections.join(', ')})`);
  check(await page.locator('[data-inv] [data-sec="more"]').count() === 1, `${w}px: paths not open yet wait behind one More Careers tab`);
  check(/Ways in/i.test(await page.locator('[data-inv]').innerText()) && /Senior ranks/i.test(await page.locator('[data-inv]').innerText()), `${w}px: a newcomer sees the ways in, and that senior ranks ask for a degree`);
  await page.locator('[data-inv] [data-sec]', { hasText: /Departments|Agencies/ }).first().click();
  await page.locator('[data-inv] [data-act="applyPolice"]').first().click();
  await dismissMessages(page);
  const app = await page.evaluate(async () => { const { store } = await import('/js/state.js'); return store.state.player.investigator.apps[0]; });
  check(app?.status === 'pending', `${w}px: the application is made through the screen and is pending`);
  // Time moves on to the decision; an offer is accepted on screen.
  await page.evaluate(async () => { const { store } = await import('/js/state.js'); const a = store.state.player.investigator.apps[0]; a.due = store.state.year * 12 + (store.state.month ?? 0); a.outcome = 'offer'; });
  await closeHub(page);
  await openHub(page);
  await dismissMessages(page);
  // The hub opens on its home screen: where you stand, and every section as a row.
  await page.locator('[data-inv] [data-act="acceptAcademy"]').first().click();
  await dismissMessages(page);
  const ac = await page.evaluate(async () => { const { store } = await import('/js/state.js'); const r = store.state.player.investigator; return { status: r.academy?.status, career: store.state.player.career.careerId }; });
  check(ac.status === 'enrolled' && ac.career === 'police', `${w}px: accepting the offer starts the academy (${ac.status})`);
  check(await page.locator('[data-inv] [data-act="academy"]').count() >= 5, `${w}px: academy training is on screen`);
  await page.locator('[data-inv] [data-act="academy"]').first().click();
  await dismissMessages(page);
  check(await fits(page), `${w}px: My Investigations fits the screen`);
  await closeHub(page);
  // Years later, through the engine: a detective with a burglary case.
  const invId = await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const C = await import('/js/engine/investigations/careers.js');
    const A = await import('/js/engine/investigations/agencies.js');
    const W = await import('/js/engine/investigations/casework.js');
    const r = store.state.player.investigator;
    r.academy.status = 'graduated'; r.stage = 'officer'; r.job.rank = 'officer';
    const a = A.agency(r.job.agencyId);
    C.becomeDetective(store.state.player, r, a, a.units.property ? 'property' : Object.keys(a.units)[0]);
    const inv = W.openCase('burglary', { ownerId: a.id, truth: 'insider', title: 'The Ashford Street Burglary' });
    r.caseIds.push(inv.id);
    return inv.id;
  });
  await openHub(page);
  await dismissMessages(page);
  await page.locator('[data-inv] [data-sec]', { hasText: /^Cases$|Active Cases/ }).first().click();
  check((await page.locator('[data-inv]').innerText()).includes('The Ashford Street Burglary'), `${w}px: the case is in Active Cases`);
  check(await page.locator('[data-inv] [data-act="support"]').count() >= 1, `${w}px: a case can ask for support from the caseload page`);
  await page.locator('[data-inv] [data-act="support"]').first().click();
  await dismissMessages(page);
  await page.locator('[data-inv] [data-act="openCase"]').first().click();
  await page.waitForSelector('[data-case]');
  check(await page.locator('[data-case] [data-tab="actions"].on').count() === 1, `${w}px: a case being worked opens on its actions`);
  const tabs = await page.locator('[data-case] [data-tab]').allInnerTexts();
  check(tabs.some((t) => /Notebook/i.test(t)) && tabs.some((t) => /Evidence/i.test(t)) && !tabs.some((t) => /Court/i.test(t)), `${w}px: the case file has its tabs, and no court tab before any charge (${tabs.join(', ')})`);
  for (const t of tabs) { await page.locator('[data-case] [data-tab]', { hasText: t }).first().click(); await page.waitForTimeout(60); }
  await page.locator('[data-case] [data-tab]', { hasText: 'Investigative Actions' }).first().click();
  // A witness interview, the question chosen from the picker.
  await page.locator('[data-case] [data-act="interview"]').first().click();
  await page.waitForSelector('#modal-root .choice-btn');
  const qs = await page.locator('#modal-root .choice-btn').allInnerTexts();
  check(qs.some((q) => /what they observed/i.test(q)) && !qs.some((q) => /inconsistency/i.test(q)), `${w}px: interview questions are offered, and "clarify an inconsistency" only when there is one`);
  await page.locator('#modal-root .choice-btn', { hasText: 'what they observed' }).first().click();
  await dismissMessages(page);
  await page.locator('[data-case] [data-act="step"]').first().click();
  await dismissMessages(page);
  await page.locator('[data-case] [data-tab]', { hasText: 'Notebook' }).first().click();
  const book = await page.locator('[data-case]').innerText();
  check(/Reported claims/i.test(book) && /Known facts/i.test(book) && /Hypotheses/i.test(book), `${w}px: the notebook keeps facts, claims and hypotheses apart`);
  check(await fits(page), `${w}px: the case file fits the screen`);
  await closeHub(page);
  // Save and reload: the same case, partner and file.
  const before = await page.evaluate(async (id) => { const { store } = await import('/js/state.js'); const { saveGame } = await import('/js/save.js'); saveGame(store.state); const f = store.state.justice.investigations[id].file; return { slot: store.state.slotId, partner: store.state.player.investigator.people.partnerId, asked: Object.values(f.witnesses).map((x) => x.asked.length).join(), log: f.log.length }; }, invId);
  await page.reload();
  await page.click(`[data-load="${before.slot}"]`);
  await page.waitForSelector('.tab-btn[data-tab="work"]');
  const after = await page.evaluate(async (id) => { const { store } = await import('/js/state.js'); const f = store.state.justice.investigations[id]?.file; return { partner: store.state.player.investigator.people.partnerId, asked: f ? Object.values(f.witnesses).map((x) => x.asked.length).join() : null, log: f?.log.length }; }, invId);
  check(after.partner === before.partner && after.asked === before.asked && after.log === before.log, `${w}px: after reloading, the partner and the case file are as they were`);
  // A forensic pathologist's referrals, and the Public Safety page, on the same screen.
  await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const medCore = await import('/js/engine/medicine/core.js');
    const FM = await import('/js/engine/investigations/forensicMed.js');
    const p = store.state.player;
    const m = medCore.M(p);
    m.completed = [{ specialtyId: 'pathology' }, { specialtyId: 'forensic_path' }]; m.license = { status: 'full', countryId: 'us' }; m.training = null; m.stage = 'practice';
    FM.forensicYear(p);
    p.investigator.stats.years = 9;
  });
  await openHub(page);
  await dismissMessages(page);
  await page.locator('[data-inv] [data-sec]', { hasText: 'Death Investigations' }).first().click();
  check(/Cause of death and manner of death are different findings/i.test(await page.locator('[data-inv]').innerText()), `${w}px: a forensic pathologist sees their referrals, cause and manner kept apart`);
  await page.locator('[data-inv] [data-act="death"]').first().click();
  await dismissMessages(page);
  // The tabs stay in view on every page.
  check(await page.locator('[data-inv] [role="tab"]').count() >= 3, `${w}px: the tabs stay at the top of every page`);
  await page.locator('[data-inv] [data-sec]', { hasText: /Other Work|Public Safety/ }).first().click();
  check(/Budget this year/i.test(await page.locator('[data-inv]').innerText()), `${w}px: the Public Safety page shows the department's budget and oversight`);
  check(await fits(page), `${w}px: the new pages fit the screen`);
  await closeHub(page);
  // The row has its own icon, and the Family Archive keeps the career.
  await dismissMessages(page);
  await page.evaluate(() => document.querySelector('.tab-btn[data-tab="work"]').click()); await page.waitForTimeout(200);
  const rowText = await page.evaluate(() => document.querySelector('[data-act="investigations"]')?.textContent ?? '');
  check(rowText.includes('🕵️'), `${w}px: the law enforcement row has its icon, whatever the job title`);
  await page.evaluate(() => document.querySelector('.tab-btn[data-tab="people"]').click()); await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('[data-top="archive"]').click()); await page.waitForTimeout(250);
  await page.locator('#modal-root [data-go="investigations"]').click(); await page.waitForTimeout(200);
  const legacy = await page.locator('#modal-root .modal').last().innerText();
  check(/Law enforcement in the family/i.test(legacy) && /you/i.test(legacy) && /Years of service/i.test(legacy), `${w}px: Family Archive → Law enforcement legacy shows the career`);
  check(await fits(page), `${w}px: the archive page fits the screen`);
  await closeHub(page);
  await page.close();
}

try {
  await run({ width: 390, height: 844 });
  await run({ width: 1280, height: 860 });
} catch (e) {
  problems.push(`the browser run stopped: ${e.message.split('\n').slice(0, 3).join(' | ')}`);
} finally {
  await browser.close();
  server.kill();
}
for (const e of errors) problems.push(`page error: ${e}`);
console.log(`${passed.length} checks passed.`);
if (problems.length) { console.log('PROBLEMS:'); for (const x of problems) console.log(` - ${x}`); process.exit(1); }
console.log('My Investigations works in the browser, on a phone and on a desktop.');
