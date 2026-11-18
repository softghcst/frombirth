// The Digital Life vertical slice, played in a real browser (the brief's Part
// 56, steps 1–25): a modern character opens an account, posts, connects with
// a friend, messages them, sees the milestone in their life story, visits the
// friend's profile and comes back to the same place, saves, reloads and finds
// everything as it was; then a life in 1800 finds no social media at all.
//
// Needs Playwright with Chromium (preinstalled in the cloud sandbox).
// Run with: node tests/digital-ui.mjs
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
async function run(viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(`${viewport.width}px: ${e.message}`));
  await page.goto(url);
  await page.waitForSelector('[data-random]');
  const continueModal = async () => { const ok = page.locator('#modal-root [data-ok]').last(); await ok.waitFor(); const text = await page.locator('#modal-root .modal').last().innerText(); await ok.click(); return text; };
  const choose = async (label) => { await page.locator('#modal-root .choice-btn', { hasText: label }).first().click(); };

  // 1. A modern character, with a friend who is already online.
  const setup = await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const { createLife } = await import('/js/engine/characterGen.js');
    const { advanceYear } = await import('/js/engine/yearProcessor.js');
    const { makeNpc } = await import('/js/engine/npcFactory.js');
    const { ensureLife } = await import('/js/engine/npcLives.js');
    const { saveGame } = await import('/js/save.js');
    const acc = await import('/js/engine/digital/accounts.js');
    let s; do { s = createLife({ countryId: 'us', year: 2003 }); } while (s.player.royal);
    store.state = s;
    for (let i = 0; i < 22; i++) { s.player.stats.health = 95; advanceYear(); s.pendingEvents = []; s.player.legal.pending = null; s.player.alive = true; }
    const p = s.player;
    p.finance.cash = 50000;
    p.education.enrolled = false;
    const f = makeNpc({ role: 'friend', countryId: 'us', age: p.age, relationship: 60 });
    // A name nobody else in the world has: the steps below find the friend by name (a random one is sometimes shared).
    f.firstName = 'Marisol'; f.lastName = 'Quennell';
    f.lastInteractionAge = p.age; ensureLife(f);
    s.npcs[f.id] = f; p.npcIds.push(f.id);
    for (const pl of ['hearth', 'murmur', 'glimmer']) acc.makeAccount(f.id, pl, `${f.firstName.toLowerCase()}.${pl}`, { visibility: 'public' });
    saveGame(s);
    return { slot: s.slotId, friendId: f.id, friend: f.firstName, year: s.year, rel: f.meters.relationship };
  });
  await page.reload();
  await page.click(`[data-load="${setup.slot}"]`);
  await page.waitForSelector('.tab-btn[data-tab="pursuits"]');

  // 2. Open Digital Life.
  await page.click('.tab-btn[data-tab="pursuits"]');
  await page.click('[data-digital]');
  await page.waitForSelector('.dl-modal');
  check(await page.locator('.dl-modal h2').innerText() === 'Digital Life', 'Digital Life opens');
  check((await page.locator('.dl-sub').innerText()).includes('Your connections, your creativity, your world.'), 'with its subtitle');
  const navLabels = await page.locator('.dl-nav button').allInnerTexts();
  check(['My Accounts', 'Feed', 'Messages', 'Friends & Connections', 'Communities', 'Create Content', 'Creator Studio', 'Online Reputation', 'Digital Memories', 'Digital History'].every((x) => navLabels.some((y) => y.startsWith(x))), 'all ten sections are there');

  // 3. Available technology.
  check((await page.locator('.dl-body').innerText()).includes('Getting online'), 'the accounts page shows how the character gets online');
  await page.click('.dl-body [data-do="buyDevice"]');
  await choose('Smartphone');
  await continueModal();

  // 4–6. Choose a platform, create an eligible account, save the profile.
  await page.click('.dl-body [data-do="newAccount"]');
  await choose('Hearth');
  await page.fill('#modal-root input[name="handle"]', 'slice_tester');
  await page.fill('#modal-root textarea[name="bio"]', 'Testing, one two.');
  await page.selectOption('#modal-root select[name="visibility"]', 'public');
  await page.locator('#modal-root input[name="interests"][value="music"]').check();
  await page.click('#modal-root button[type="submit"]');
  check((await continueModal()).includes('@slice_tester'), 'an account is created');

  // 7. The profile.
  await page.waitForSelector('.dl-profile');
  check((await page.locator('.dl-profile').innerText()).includes('@slice_tester'), 'the account profile opens');
  await page.click('.dl-body [data-acc="edit"]');
  await page.fill('#modal-root textarea[name="bio"]', 'Bio, edited.');
  await page.click('#modal-root button[type="submit"]');
  await continueModal();
  check((await page.locator('.dl-profile').innerText()).includes('Bio, edited.'), 'the profile can be edited');

  // 8–11. Create a post, publish, simulate, show real numbers.
  await page.click('.dl-nav [data-section="create"]');
  await page.click('.dl-body [data-do="compose"]');
  await page.selectOption('#modal-root select[name="format"]', 'text');
  await page.fill('#modal-root textarea[name="text"]', 'Hello from the vertical slice.');
  await page.click('#modal-root button[type="submit"]');
  await page.click('#modal-root [data-yes]');
  const outcome = await continueModal();
  check(/views/.test(outcome) || /viral|spread|argued|quietly/.test(outcome), `the post is published and its response is reported (${outcome.replace(/\s+/g, ' ').slice(0, 80)})`);
  await page.waitForSelector('.dl-body .dl-metrics');
  const views = await page.evaluate(async () => { const { store } = await import('/js/state.js'); const x = Object.values(store.state.digital.posts).find((y) => y.text === 'Hello from the vertical slice.'); return x.metrics.views; });
  check((await page.locator('.dl-body .dl-metrics').first().innerText()).includes(String(views.toLocaleString('en-US'))), 'the post shows its actual metrics');

  // 12–13. Connect with an existing friend; view their profile.
  await page.click('.dl-nav [data-section="people"]');
  // People the player knows are connected when the account is made; anyone not yet followed has a Follow button.
  if (await page.locator('.dl-body [data-follow]').count()) { await page.locator('.dl-body [data-follow]').first().click(); await continueModal(); }
  check((await page.locator('.dl-body').innerText()).includes(setup.friend), 'the friend is listed among the connections');
  const connected = await page.evaluate(async (fid) => { const { store } = await import('/js/state.js'); const d = store.state.digital; const mine = Object.values(d.accounts).find((a) => a.handle === 'slice_tester'); const theirs = Object.values(d.accounts).find((a) => a.ownerId === fid && a.platformId === 'hearth'); return mine.following.includes(theirs.id) && Object.values(store.state.npcs).filter((n) => n.firstName === store.state.npcs[fid].firstName && n.lastName === store.state.npcs[fid].lastName).length === 1; }, setup.friendId);
  check(connected, 'the player follows the friend\'s own account, and there is still only one of them');

  // 14–16. Message the friend; they answer; the relationship moves.
  await page.click('.dl-nav [data-section="messages"]');
  await page.click('.dl-body [data-do="newMessage"]');
  await choose(setup.friend);
  await choose('Message on Hearth');
  await choose('Catch up');
  const reply = await continueModal();
  check(reply.includes(setup.friend), `the friend replies (${reply.replace(/\s+/g, ' ').slice(0, 70)})`);
  await page.waitForSelector('.dl-chat .dl-msg');
  check(await page.locator('.dl-chat .dl-msg').count() >= 2, 'the conversation shows both messages');
  const rel = await page.evaluate(async (fid) => { const { store } = await import('/js/state.js'); return store.state.npcs[fid].meters.relationship; }, setup.friendId);
  check(rel !== setup.rel, `the relationship changed (${setup.rel} → ${rel})`);

  // 19–21. Tap the friend's portrait, see their real profile, come back to the same conversation.
  await page.locator(`.dl-chat [data-person="${setup.friendId}"]`).first().click();
  await page.waitForFunction((name) => [...document.querySelectorAll('#modal-root .modal')].some((m) => !m.classList.contains('dl-modal') && m.innerText.includes(name)), setup.friend);
  const profile = await page.locator('#modal-root .modal').last().innerText();
  check(profile.includes('Relationship') && profile.includes('Hearth'), 'the portrait opens the existing character profile, with their accounts');
  await page.locator('#modal-root .modal').last().locator('[data-close]').click();
  check(await page.locator('.dl-chat .dl-msg').count() >= 2 && await page.locator('.dl-body [data-back]').count() === 1, 'coming back lands in the same conversation');
  await page.click('.dl-modal [data-close]');
  await page.click('[data-digital]');
  check(await page.locator('.dl-chat .dl-msg').count() >= 2, 'closing and reopening Digital Life keeps the place');

  // 17–18. The milestone in Digital Memories and the Life Story.
  await page.click('.dl-body [data-back]');
  await page.click('.dl-nav [data-section="memories"]');
  check((await page.locator('.dl-body').innerText()).includes('Your first post on Hearth'), 'the first post is a digital memory');
  await page.click('.dl-modal [data-close]');
  await page.click('.tab-btn[data-tab="self"]');
  check((await page.locator('[data-panel-body]').innerText()).includes('Joined Hearth, your first online account.'), 'and a milestone in the life story');

  // Mobile layout: nothing runs off the side.
  await page.click('.tab-btn[data-tab="pursuits"]');
  await page.click('[data-digital]');
  for (const s of ['accounts', 'feed', 'studio', 'history']) {
    await page.click(`.dl-nav [data-section="${s}"]`);
    const over = await page.evaluate(() => { const b = document.querySelector('.dl-body'); return b.scrollWidth - b.clientWidth; });
    check(over <= 1, `${viewport.width}px wide: ${s} fits without sideways scrolling`);
    check(await page.evaluate(() => document.querySelectorAll('.dl-modal button button, .dl-modal button a').length === 0), `${s}: no button is nested inside another`);
    check(await page.evaluate(() => [...document.querySelectorAll('.dl-modal button')].every((b) => (b.innerText.trim() || b.getAttribute('aria-label')))), `${s}: every button has a name`);
  }

  // 22–24. Save, reload, and check everything is still right.
  const before = await page.evaluate(async () => { const { store } = await import('/js/state.js'); const { saveGame } = await import('/js/save.js'); saveGame(store.state); return JSON.stringify(store.state.digital); });
  await page.reload();
  await page.click(`[data-load="${setup.slot}"]`);
  await page.waitForSelector('.tab-btn[data-tab="pursuits"]');
  const after = await page.evaluate(async () => { const { store } = await import('/js/state.js'); return JSON.stringify(store.state.digital); });
  check(before === after, 'after a reload the accounts, posts, engagement, messages and memories are exactly as saved');
  const relAfter = await page.evaluate(async (fid) => { const { store } = await import('/js/state.js'); return store.state.npcs[fid].meters.relationship; }, setup.friendId);
  check(relAfter === rel, 'and so is the relationship');

  // 25. A historical life: no social media.
  const old = await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const { createLife } = await import('/js/engine/characterGen.js');
    const { saveGame } = await import('/js/save.js');
    let s; do { s = createLife({ countryId: 'uk', year: 1790 }); } while (s.player.royal);
    s.year = 1800; s.player.age = 10;
    for (const n of Object.values(s.npcs)) n.age += 10;
    store.state = s; saveGame(s);
    return s.slotId;
  });
  await page.reload();
  await page.click(`[data-load="${old}"]`);
  await page.click('.tab-btn[data-tab="pursuits"]');
  check((await page.locator('[data-digital]').innerText()).includes('Keep in touch'), 'in 1800 the card offers keeping in touch, not social media');
  await page.click('[data-digital]');
  const nav1800 = await page.locator('.dl-nav button').allInnerTexts();
  check(!nav1800.some((x) => /Feed|Creator Studio|Communities/.test(x)), 'and Digital Life shows no feed, communities or creator studio');
  check((await page.locator('.dl-body').innerText()).includes('no internet yet'), 'it says there is no internet yet');
  check(await page.locator('.dl-body [data-reach]').count() > 0, 'and offers letters and visits instead');
  await page.close();
}

/** The rest of Digital Life, at phone width: a life designed to start in 1850, the Family Archive, a creator's routine, dating preferences. */
async function extras() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(`extras: ${e.message}`));
  await page.goto(url);
  await page.waitForSelector('[data-design]');
  const continueModal = async () => { const ok = page.locator('#modal-root [data-ok]').last(); await ok.waitFor(); const t = await page.locator('#modal-root .modal').last().innerText(); await ok.click(); return t; };
  // A life designed to begin in 1850.
  await page.click('[data-design]');
  await page.fill('#f-year', '1930');
  check((await page.locator('[data-era-note]').innerText()).includes('Between the Wars'), 'the creator names the era of the chosen year');
  await page.fill('#f-year', '2010');
  check((await page.locator('[data-era-note]').innerText()).includes('Modern Day'), 'and updates when the year changes');
  await page.fill('#f-year', '1850');
  check((await page.locator('[data-era-note]').innerText()).includes('Early Era'), 'the early era too');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'the creator fits a phone');
  await page.click('form button[type="submit"]');
  await page.waitForSelector('.tab-btn[data-tab="pursuits"]');
  const born = await page.evaluate(async () => { const { store } = await import('/js/state.js'); return { year: store.state.year, birth: store.state.player.birthYear }; });
  check(born.year === 1850 && born.birth === 1850, 'the character creator can start a life in 1850');
  await page.click('.tab-btn[data-tab="self"]');
  check((await page.locator('[data-panel-body]').innerText()).includes('The times: Early Era'), 'the Self tab shows the times');

  // Radio in 1935, through the Pursuits tab.
  const s35 = await page.evaluate(async () => {
    const { createLife } = await import('/js/engine/characterGen.js');
    const { saveGame } = await import('/js/save.js');
    let st; do { st = createLife({ countryId: 'uk', year: 1925 }); } while (st.player.royal);
    st.year = 1935; st.player.age = 10; for (const n of Object.values(st.npcs)) n.age += 10;
    saveGame(st); return st.slotId;
  });
  await page.reload();
  await page.click(`[data-load="${s35}"]`);
  await page.click('.tab-btn[data-tab="pursuits"]');
  check(await page.locator('[data-tune="radio"]').count() === 1 && await page.locator('[data-tune="tv"]').count() === 0, 'in 1935 Pursuits offers the radio, not television');
  await page.click('[data-tune="radio"]');
  await page.locator('#modal-root .choice-btn', { hasText: 'Radio plays' }).click();
  check((await continueModal()).includes('radio plays'), 'an evening of radio plays happens');
  check(await page.locator('[data-tune="radio"]').isDisabled(), 'and is done for the year');
  await page.click('[data-digital]');
  await page.click('.dl-nav [data-section="history"]');
  check((await page.locator('.dl-body').innerText()).includes('Between the Wars'), 'Digital History shows the era of the year');
  await page.click('.dl-modal [data-close]');
  // The Family Archive, from the People tab.
  await page.click('.tab-btn[data-tab="people"]');
  await page.click('[data-top="archive"]');
  await page.click('[data-go="digital"]');
  await page.waitForSelector('.dl-modal');
  check((await page.locator('.dl-body').innerText()).includes('Family Archive'), 'the Family Archive opens from the People tab');
  await page.click('.dl-modal [data-close]');
  // A modern creator: routine and dating preferences through the forms.
  const slot = await page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    const { createLife } = await import('/js/engine/characterGen.js');
    const { saveGame } = await import('/js/save.js');
    const tech = await import('/js/engine/digital/tech.js');
    const acc = await import('/js/engine/digital/accounts.js');
    const creator = await import('/js/engine/digital/creator.js');
    let st; do { st = createLife({ countryId: 'us', year: 1996 }); } while (st.player.royal);
    st.year = 2026; st.player.age = 30; for (const n of Object.values(st.npcs)) n.age += 30;
    for (const n of Object.values(st.npcs)) if (['partner', 'spouse'].includes(n.role)) n.role = 'ex';
    st.player.flags.livesWithParents = false; st.player.finance.cash = 1e5; st.player.flags.interestedIn = 'everyone';
    store.state = st;
    tech.buyDevice('smartphone'); tech.buyDevice('laptop');
    const a = acc.createAccount({ platformId: 'vista', handle: 'ui.creator', visibility: 'public' }).account;
    creator.startChannel(a.id, 'music');
    acc.createAccount({ platformId: 'kindling', handle: 'ui.dater', visibility: 'matches' });
    saveGame(st); return st.slotId;
  });
  await page.reload();
  await page.click(`[data-load="${slot}"]`);
  await page.click('.tab-btn[data-tab="pursuits"]');
  await page.click('[data-digital]');
  await page.click('.dl-nav [data-section="studio"]');
  await page.click('.dl-body [data-chan="routine"]');
  await page.fill('#modal-root input[name="perYear"]', '3');
  await page.click('#modal-root button[type="submit"]');
  check((await continueModal()).includes('Routine set'), 'a posting routine is set from Creator Studio');
  check((await page.locator('.dl-body').innerText()).includes('Routine: 3 a year'), 'and shows on the overview');
  await page.click('.dl-nav [data-section="people"]');
  await page.click('.dl-body [data-do="datingPrefs"]');
  await page.fill('#modal-root input[name="ageMin"]', '27');
  await page.fill('#modal-root input[name="ageMax"]', '33');
  await page.click('#modal-root button[type="submit"]');
  check((await continueModal()).includes('ages 27–33'), 'dating preferences are saved from the form');
  for (const sec of ['accounts', 'feed', 'messages', 'people', 'communities', 'create', 'studio', 'reputation', 'memories', 'history', 'archive']) {
    await page.click(`.dl-nav [data-section="${sec}"]`);
    check(await page.evaluate(() => document.querySelectorAll('.dl-modal button button').length === 0 && document.querySelector('.dl-body').scrollWidth - document.querySelector('.dl-body').clientWidth <= 1), `${sec}: well-formed and fits a phone`);
  }
  await page.close();
}

try {
  await extras();
  await run({ width: 390, height: 844 });
  await run({ width: 1280, height: 860 });
} catch (e) {
  problems.push(`the browser run stopped: ${e.message.split('\n')[0]}`);
} finally {
  await browser.close();
  server.kill();
}
for (const e of errors) problems.push(`page error: ${e}`);
console.log(`${passed.length} checks passed.`);
if (problems.length) { console.log('PROBLEMS:'); for (const x of problems) console.log(` - ${x}`); process.exit(1); }
console.log('The Digital Life vertical slice works end to end, on a phone and on a desktop.');
