// Browser check of the legal career, end to end through the screens, at phone and desktop width: the Work tab row,
// the LSAT, law school (an exam, moot court, a clinic case), the bar, a first job, a first client's case worked from
// its file (interview, evidence, research, a filing), a day in court with an objection and a cross-examination, the
// outcome, the record, and the same after a save and reload. Needs Playwright. Run with: node tests/law-ui.mjs
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
const check = (c, m) => { if (!c) problems.push(m); console.log(`${c ? ' ✓' : ' ✗'} ${m}`); };
const browser = await chromium.launch();

for (const [label, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.click('[data-random]'); await page.waitForSelector('[data-year]');
  const clear = () => page.evaluate(() => document.querySelectorAll('#modal-root .scrim').forEach((s) => s.remove()));
  await clear();
  const shot = async (name) => { if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/law-${label}-${name}.png` }); };
  /** Answers the dialog on top: the option whose text matches, or the first. */
  const pick = async (re) => {
    const m = page.locator('#modal-root .modal').last();
    await m.locator('.choice-btn').first().waitFor({ timeout: 4000 });
    const opt = re ? m.locator('.choice-btn', { hasText: re }).first() : m.locator('.choice-btn').first();
    await opt.click(); await page.waitForTimeout(80);
  };
  const ok = async () => { const b = page.locator('#modal-root .modal').last().locator('[data-ok], [data-yes]').first(); await b.waitFor({ timeout: 4000 }); await b.click(); await page.waitForTimeout(80); };
  const hub = () => page.locator('#modal-root .law-hub');
  const engine = (fn, arg) => page.evaluate(fn, arg);
  const turns = (n) => engine(async (k) => { const { advanceTurn } = await import('/js/engine/turns.js'); const { store } = await import('/js/state.js'); for (let i = 0; i < k; i++) { store.state.pendingEvents = []; advanceTurn(); } store.notify(); }, n);

  // A graduate in the US with a first degree.
  await engine(async () => {
    const { store } = await import('/js/state.js');
    const s = store.state; const p = s.player;
    p.countryId = 'us'; p.city = 'New York'; p.age = 22; p.birthYear = s.year - 22; p.stats.intellect = 82; p.finance.cash = 400000; p.legal.incarceration = null;
    p.education.stage = 'none'; p.education.enrolled = false;
    p.education.degrees.push({ type: 'high', gpa: 3.7, age: 18 }, { type: 'university', majorId: 'political_science', gpa: 3.8, age: 22 });
    s.settings = { ...(s.settings ?? {}), step: 6, yearSummary: false };
    store.notify();
  });
  await page.click('.tab-btn[data-tab="work"]'); await page.waitForTimeout(200);
  const rowBtn = page.locator('[data-act="law"]');
  check(await rowBtn.count() === 1 && /My Legal Career/i.test(await rowBtn.innerText()), `${label}: the Work tab has My Legal Career`);
  await rowBtn.click(); await hub().waitFor();
  check(/Every case tells a story/i.test(await hub().innerText()), `${label}: the hub opens, with its subtitle`);
  await hub().locator('[data-tab="education"]').click();
  check(await hub().locator('[data-tab="cases"]').count() === 0 && await hub().locator('[data-tab="new"]').count() === 0, `${label}: no docket for someone who is not a lawyer`);
  await hub().locator('[data-law="sitEntrance"]').click(); await ok();
  check(/Best score\s*1[2-8]\d/i.test(await hub().innerText()), `${label}: the LSAT is sat from the screen and scored`);
  await shot('lsat');
  // Into law school (the application itself is the education engine's, already covered elsewhere).
  await engine(async () => {
    const edu = await import('/js/engine/education.js');
    let ok = false;
    for (let i = 0; i < 12 && !ok; i++) ok = edu.applyTo('law').accepted;
    edu.enroll('law', null, 'self');
    const { store } = await import('/js/state.js'); store.notify();
    return ok;
  }).then((ok) => console.log('   accepted:', ok));
  await page.locator('#modal-root .scrim').last().evaluate((s) => s.remove());
  await rowBtn.click(); await hub().waitFor();
  await hub().locator('[data-tab="education"]').click();
  const schoolText = await hub().innerText();
  check(/term 1 of 6/i.test(schoolText) && /Contracts/.test(schoolText), `${label}: law school, term by term, with first-year courses (${schoolText.replace(/\n/g, ' ').slice(0, 160)})`);
  await hub().locator('[data-law="exam"]').click();
  await pick(); await pick(); await ok();
  check(!(await hub().locator('[data-law="exam"]').count()), `${label}: the term's exam is sat once`);
  await clear();
  await turns(2);
  await rowBtn.click(); await hub().waitFor(); await hub().locator('[data-tab="education"]').click();
  await hub().locator('[data-sact="moot"]').click();
  await pick(); await pick(/strongest/i); await pick(/directly/i); await ok();
  check(await hub().locator('[data-sact="moot"][disabled]').count() === 1, `${label}: moot court, once this year`);
  await hub().locator('[data-sact="clinic"]').click(); await ok();
  await hub().locator('[data-tab="cases"]').click();
  check(/Student attorney \(supervised\)/.test(await hub().innerText()), `${label}: a supervised clinic case, for a student`);
  await shot('school');
  await clear();
  await turns(5);
  // The bar, from the screen.
  await rowBtn.click(); await hub().waitFor(); await hub().locator('[data-tab="education"]').click();
  check(/bar exam/i.test(await hub().innerText()), `${label}: after graduation, the bar exam`);
  await hub().locator('[data-law="prepCourse"]').click(); await ok();
  for (let i = 0; i < 4; i++) {
    const take = hub().locator('[data-law="bar"]');
    if (!(await take.count())) { await clear(); await turns(1); await rowBtn.click(); await hub().waitFor(); await hub().locator('[data-tab="education"]').click(); continue; }
    await take.click();
    for (let q = 0; q < 4; q++) {
      const right = await engine(async (n) => (await import('/js/engine/lawSchool.js')).barExam().questions[n].right, q);
      const m = page.locator('#modal-root .modal').last();
      await m.locator('.choice-btn').nth(right).click(); await page.waitForTimeout(60);
    }
    await ok();
    if (await engine(async () => (await import('/js/engine/lawSchool.js')).admitted())) break;
    await clear(); await turns(1); await rowBtn.click(); await hub().waitFor(); await hub().locator('[data-tab="education"]').click();
    await hub().locator('[data-law="prepSelf"]').click().catch(() => {}); await ok().catch(() => {});
  }
  check(await engine(async () => (await import('/js/engine/lawSchool.js')).admitted()), `${label}: admitted to practice after the bar`);
  await clear();
  // A first job, then the first client from New Cases.
  await engine(async () => {
    const career = await import('/js/engine/career.js'); const { CAREER_BY_ID } = await import('/js/data/careers.js');
    career.hire(CAREER_BY_ID.lawyer, 0, 60, 'test');
    const lp = await import('/js/engine/lawPractice.js'); lp.chooseSpecialty('criminal_defense');
    const L = (await import('/js/engine/lawSchool.js')).lawOf(); L.window = null; L.offers = [];
  });
  await rowBtn.click(); await hub().waitFor();
  await hub().locator('[data-tab="new"]').click();
  check(await hub().locator('[data-accept]').count() >= 1, `${label}: a new lawyer is offered cases`);
  await shot('offers');
  await hub().locator('[data-accept]').first().click(); await ok();
  const page1 = await hub().innerText();
  check(/Interview the client/i.test(page1) && /Evidence/.test(page1) && /Judge/.test(page1) && / v\. /.test(page1), `${label}: the case file opens, with its client, judge and evidence (${page1.replace(/\n/g, ' ').slice(0, 200)})`);
  await hub().locator('[data-cact="interview"]').click(); await ok();
  await hub().locator('[data-cact="review"]').click(); await ok();
  check(await hub().locator('.law-ev .fit-bars').count() >= 1, `${label}: reviewed evidence shows how reliable it is`);
  const rightR = await engine(async () => { const lc = await import('/js/engine/lawCases.js'); const L = (await import('/js/engine/lawSchool.js')).lawOf(); return lc.researchQuestion(lc.caseById(L.caseIds.at(-1))).right; });
  await hub().locator('[data-cact="research"]').click();
  await page.locator('#modal-root .modal').last().locator('.choice-btn').nth(rightR).click(); await ok();
  const file = hub().locator('[data-cact="file"]');
  if (await file.count()) { await file.click(); await pick(); await ok(); }
  check(/Filings/.test(await hub().innerText()), `${label}: the filing is on the file, with the court's ruling`);
  await shot('case');
  await clear();
  await engine(async () => { const { advanceTurn } = await import('/js/engine/turns.js'); const { store } = await import('/js/state.js'); const lc = await import('/js/engine/lawCases.js'); const L = (await import('/js/engine/lawSchool.js')).lawOf(); const c = lc.caseById(L.caseIds.at(-1)); for (let i = 0; i < 12 && !c.awaiting && !c.done; i++) { store.state.pendingEvents = []; advanceTurn(); } store.notify(); });
  await rowBtn.click(); await hub().waitFor(); await hub().locator('[data-tab="cases"]').click();
  const lastId = await engine(async () => (await import('/js/engine/lawSchool.js')).lawOf().caseIds.at(-1));
  check(/needs you/i.test(await hub().innerText()) && /in court:/i.test(await hub().innerText()), `${label}: one docket page puts the day in court at the top, under Needs You`);
  check(await hub().locator('[data-tab="filings"], [data-tab="court"], [data-tab="clients"]').count() === 0, `${label}: no separate tabs for filings, the courtroom and clients`);
  await hub().locator(`[data-case="${lastId}"]`).first().click();
  const court = hub().locator('[data-cact="court"]');
  check(await court.count() === 1, `${label}: the case reaches court and waits for the lawyer`);
  await court.click(); await ok();
  // Each phase in turn: the objection on its proper ground, the cross on what the file shows.
  const phases = await engine(async () => { const lc = await import('/js/engine/lawCases.js'); const L = (await import('/js/engine/lawSchool.js')).lawOf(); return lc.courtroom(lc.caseById(L.caseIds.at(-1))).phases.map((p) => ({ id: p.id, want: p.valid ?? p.good ?? p.options[0].v, values: p.options.map((o) => o.v) })); });
  for (const ph of phases) {
    const m = page.locator('#modal-root .modal').last();
    await m.locator('.choice-btn').first().waitFor();
    await m.locator('.choice-btn').nth(Math.max(0, ph.values.indexOf(ph.want))).click(); await page.waitForTimeout(60);
  }
  const verdict = await page.locator('#modal-root .modal').last().innerText();
  check(/Guilty|Not guilty|Judgment|Approved|Denied|court/i.test(verdict), `${label}: a verdict or ruling (${verdict.replace(/\n/g, ' ').slice(0, 90)})`);
  check(phases.some((x) => x.id === 'objection') || phases.some((x) => x.id === 'cross'), `${label}: the day in court asked for an objection or a cross-examination (${phases.map((x) => x.id).join(', ')})`);
  await shot('verdict');
  await ok();
  check(/Outcome/.test(await hub().innerText()), `${label}: the case shows its outcome`);
  await hub().locator('[data-back]').click();
  await hub().locator('[data-tab="history"]').click();
  check(/Admitted to practice/i.test(await hub().innerText()) && /Completed cases/i.test(await hub().innerText()), `${label}: the history has the admission and the case`);
  // The Family Archive keeps the legal career.
  await clear();
  await page.evaluate(() => document.querySelector('.tab-btn[data-tab="people"]').click()); await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('[data-top="archive"]').click()); await page.waitForTimeout(250);
  await page.locator('#modal-root [data-go="law"]').click(); await page.waitForTimeout(200);
  const legacy = await page.locator('#modal-root .modal').last().innerText();
  check(/Legal careers in the family/i.test(legacy) && /Admitted to practice/i.test(legacy) && /you/i.test(legacy), `${label}: Family Archive → Professional legacy shows the career (${legacy.replace(/\n/g, ' ').slice(0, 120)})`);
  await shot('legacy');
  await clear();
  // A race for District Attorney, from the Progress tab: the trail, the debate, the polls as bars, the count.
  await engine(async () => {
    const { store } = await import('/js/state.js');
    const career = await import('/js/engine/career.js'); const { CAREER_BY_ID } = await import('/js/data/careers.js');
    const p = store.state.player;
    career.hire(CAREER_BY_ID.prosecutor, 2, 70, 'test');
    p.age = 48; p.career.experience = { prosecutor: 16 }; p.finance.cash = 5e6;
    store.notify();
  });
  await page.evaluate(() => document.querySelector('.tab-btn[data-tab="work"]').click()); await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('[data-act="law"]').click()); await hub().waitFor(); await hub().locator('[data-tab="progress"]').click();
  const prog = await hub().innerText();
  check(/Victims & Witnesses|Trial Advocacy/.test(prog) && !/Weighing Evidence/.test(prog), `${label}: a prosecutor's five skills carry a prosecutor's names`);
  await hub().locator('[data-seek="da"]').click(); await ok(); await ok();
  const trail = () => page.locator('#modal-root .law-campaign');
  await trail().waitFor();
  check(/Running for District Attorney/i.test(await trail().innerText()) && await trail().locator('.fit-bars').count() >= 1, `${label}: the campaign is a screen of its own, with the race drawn as bars`);
  check(!/\d+%/.test(await trail().innerText()), `${label}: no percentages on the trail`);
  check(/money/i.test(await trail().innerText()) && /your opponent/i.test(await trail().innerText()), `${label}: what can be done is grouped`);
  await shot('campaign-start');
  await trail().locator('[data-camp="committee"]').click(); await ok();
  await trail().locator('[data-camp="town_hall"]').click(); await ok();
  await trail().locator('[data-campnext]').click(); await ok();
  await trail().locator('[data-campdebate]').click(); await pick(/what you would change/i); await ok();
  await trail().locator('[data-campnext]').click(); await ok();
  await trail().locator('[data-campnext]').click(); await ok();
  await shot('campaign');
  await trail().locator('[data-campvote]').click();
  const count = await page.locator('#modal-root .modal').last().innerText();
  check(/won the election|lost|voters/i.test(count), `${label}: election day (${count.replace(/\n/g, ' ').slice(0, 100)})`);
  await ok();
  await clear();
  // Save, reload, continue: everything is still there, nothing counted twice.
  const before = await engine(async () => { const { store } = await import('/js/state.js'); const { saveGame } = await import('/js/save.js'); saveGame(store.state); const L = store.state.player.law; return { n: L.history.length, cases: L.caseIds.length, cash: store.state.player.finance.cash, slot: store.state.slotId }; });
  await page.reload();
  await page.locator(`[data-load="${before.slot}"]`).click();
  await page.waitForSelector('[data-year]');
  const after = await engine(async () => { const { store } = await import('/js/state.js'); const L = store.state.player.law; return { n: L.history.length, cases: L.caseIds.length, cash: store.state.player.finance.cash }; });
  check(after.n === before.n && after.cases === before.cases && after.cash === before.cash, `${label}: after a reload the record, the cases and the money are as they were (${JSON.stringify(after)})`);
  check(!errors.length, `${label}: no page errors (${errors.join('; ')})`);
  await page.close();
}
await browser.close();
server.close();
if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log('A legal career works through its screens.');
