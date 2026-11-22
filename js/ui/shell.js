// The in-game screen: identity header, stat meters, journal, year button,
// five-tab dock, and the loop that walks the player through queued scenarios.
import { watchTitles } from './titles.js';
import { forkGame } from '../save.js';
import { turningPoint, turningNote } from '../engine/turning.js';
import { store, player, country, prunePending } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import { saveGame, pushUndo, popUndo, undoDepth, peekUndo } from '../save.js';
import { advanceTurn, ageText, nextTurnText, stepOf, monthOf } from '../engine/turns.js';
import { getEvent, resolveChoice, stillFits } from '../engine/eventEngine.js';
import { die } from '../engine/death.js';
import { educationLine } from '../engine/education.js';
import { styledName, standing } from '../engine/royalty.js';
import { ROYAL_RANKS } from '../data/royalty.js';
import { avatarSvg, dressOfPlayer } from './avatar.js';
import { syncMeters } from './meter.js';
import { eventModal, outcomeModal, confirmModal, openModal, pickModal } from './modals.js';
import { summarize } from '../engine/yearSummary.js';
import { idolWork } from '../engine/kpop.js';
import { portrait } from './tabs/people.js';
import { roleLabel } from '../engine/relationships.js';
import { TABS } from './tabs/index.js';
import { runJustice } from './justice.js';
import { openHealth } from './health/hub.js';
import { careWaiting } from '../engine/health/index.js';
import { openMoney } from './tabs/holdings.js';
import { bookAction } from '../engine/ledger.js';
import { openAnimalProfile } from './animals.js';
import { openAthleticsAt } from './sports.js';
import { icon } from './kit.js';
import { sectionize, show as showSection, SEP } from './sections.js';
import { lineMemory, lineMemoryHtml, milestonesAt, milestoneHtml } from './memories.js';
import { openSettings } from './settings.js';

function occupationLine(p) {
  if (p.legal.incarceration) return 'Incarcerated';
  if (p.politics) return `${p.politics.title}${p.career.title && p.politics.tier < 2 ? ` · ${p.career.title}` : ''}`;
  const idol = idolWork(p);
  if (idol?.current) return idol.title;
  if (p.career.title) return p.career.title;
  if (p.royal && ROYAL_RANKS.includes(p.royal.rank) && (p.age >= 18 || !p.education.enrolled)) return standing(p);
  if (p.education.enrolled) return educationLine(p);
  if (p.career.retired) return 'Retired';
  if (p.age < 5) return p.age < 2 ? 'Infant' : 'Toddler';
  return p.age < 18 ? 'Not in school' : 'Unemployed';
}

/**
 * @param {HTMLElement} app
 * @param {{onExit:Function, onDeath:Function, onRestore:(state:object)=>void}} hooks
 */
export function mountGame(app, hooks) {
  watchTitles();
  let activeTab = null;
  /** The section open inside the tab (its title), or null for the tab's list. */
  let openSection = null;
  let busy = false;
  /** Set while the player is reading a line of the life story they came to from somewhere else. */
  let storyReturn = null;

  app.innerHTML = `
    <div class="game">
      <main class="stage" aria-label="Your life">
      <div class="idcard">
        <div class="avatar" data-avatar></div>
        <div class="who"><h1 data-name></h1><p class="who-line" data-line1></p><p class="who-job" data-line2></p></div>
        <button class="purse" data-purse aria-label="Open My Money"><div class="amount num" data-cash></div><div class="label">Money</div></button>
        <button class="icon-btn menu-btn" data-menu aria-label="Menu" aria-haspopup="dialog">${icon('menu')}</button>
      </div>
      <div class="sheet-area">
      <div class="journal" data-journal role="log" aria-live="polite" aria-label="Your life so far" tabindex="0"></div>
      <button class="story-back" data-story-back hidden></button>
      <section class="panel" data-panel aria-labelledby="panel-title" hidden>
        <div class="panel-head"><button class="icon-btn back-btn" data-panel-close aria-label="Back to your life">${icon('back')}</button>
          <h2 data-panel-title id="panel-title"></h2></div>
        <div class="panel-body" data-panel-body></div>
      </section>
      </div>
      </main>
      <footer class="dock">
        <div class="dock-info">
          <span class="dock-age num" data-dock-age></span>
          <button class="undo-btn" data-undo aria-label="Age down: take back the last year"><span class="undo-pill">${icon('undo')}<small>Age down</small></span></button>
        </div>
        <div class="dock-main">
          <div class="meters" data-meters></div>
          <button class="year-btn" data-year></button>
        </div>
        <nav aria-label="Sections">
          ${TABS.map((t) => `
            <button class="tab-btn" data-tab="${t.id}" aria-label="${esc(t.title)}">
              <svg viewBox="0 0 24 24" aria-hidden="true">${t.icon}</svg><span>${esc(t.short)}</span>
            </button>`).join('')}
        </nav>
      </footer>
    </div>`;

  const $ = (sel) => app.querySelector(sel);
  const journalEl = $('[data-journal]');
  const panelEl = $('[data-panel]');
  const panelBody = $('[data-panel-body]');
  const yearBtn = $('[data-year]');

  // Whatever the last action did to the player's money is written in the ledger before the life is saved.
  const persist = () => { if (player().alive) { bookAction(); saveGame(store.state); } };

  const tabApi = {
    /** Call after a tab action changes state. */
    changed() {
      // An action in a tab can be fatal; the obituary follows straight away.
      if (!player().alive && store.lastObituary) { closePanel(); return finish(store.lastObituary); }
      persist(); render();
      return undefined;
    },
    exitToTitle() { persist(); hooks.onExit(); },
    endLife() { closePanel(); finish(die('sudden unexplained causes')); },
    /**
     * Shows the line of the life story that tells one moment in an animal's life, with a way back to
     * wherever the player came from: the panel that was open is put back, then `onBack` restores the rest.
     */
    showStory(eventId, { label, onBack }) {
      storyReturn = { tab: activeTab, section: openSection, onBack };
      closePanel();
      const line = journalEl.querySelector(`[data-ev="${eventId}"]`);
      journalEl.querySelectorAll('.lit').forEach((x) => x.classList.remove('lit'));
      if (line) { line.classList.add('lit'); line.scrollIntoView({ block: 'center' }); }
      const btn = $('[data-story-back]');
      btn.textContent = `← ${label}`;
      btn.hidden = false;
    },
    /** Takes any open court case through to its verdict. */
    async justice() { busy = true; renderHeader(); await runJustice(tabApi); busy = false; render(); },
  };

  function renderHeader() {
    const p = player();
    const c = country();
    $('[data-avatar]').innerHTML = avatarSvg({
      age: p.age, gender: p.gender, appearance: p.appearance, seed: p.id, mood: p.stats.mood, label: `${p.firstName} ${p.lastName}`, ...dressOfPlayer(p),
    });
    $('[data-name]').textContent = styledName(p);
    const line1 = $('[data-line1]');
    const ageNow = `Age ${ageText(p)}`;
    // A new age gets a brief glow, so the year turning over is felt without slowing anything down.
    if (line1.dataset.age && line1.dataset.age !== ageNow) { line1.classList.remove('aged'); void line1.offsetWidth; line1.classList.add('aged'); }
    line1.dataset.age = ageNow;
    line1.innerHTML = `<span class="age-pill">${esc(ageNow)}</span><span class="place">${esc(p.city)}, ${esc(c.name)} ${c.flag}</span>`;
    $('[data-line2]').textContent = occupationLine(p);
    const cashEl = $('[data-cash]');
    cashEl.textContent = fmtMoney(p.finance.cash, c);
    cashEl.classList.toggle('neg', p.finance.cash < 0);
    syncMeters($('[data-meters]'), [['Mood', p.stats.mood], ['Health', p.stats.health], ['Intellect', p.stats.intellect], ['Charm', p.stats.charm]]);
    $('[data-dock-age]').textContent = `${ageNow} · ${store.state.year}`;
    // Age up: an arrow, the words, and a badge with what comes next (the next age, or the season for shorter turns).
    const turn = nextTurnText();
    const next = turn.sub.replace(/^→\s*/, '');
    const toAge = /^\d+$/.test(next);
    const badgeWas = yearBtn.querySelector('.yb-badge')?.textContent;
    yearBtn.innerHTML = `${icon('up', 'yb-arrow')}<span class="yb-label">${esc(turn.label)}</span><small class="yb-badge${badgeWas && badgeWas !== next ? ' changed' : ''}">${esc(next)}</small>`;
    yearBtn.setAttribute('aria-label', `${turn.label}, to ${toAge ? `age ${next}` : next}`);
    yearBtn.disabled = busy || !p.alive;
    const undo = $('[data-undo]');
    undo.disabled = busy || !undoDepth(store.state.slotId);
    undo.hidden = p.age === 0 && !undoDepth(store.state.slotId);
    // With turns shorter than a year, undo takes back a turn, not a year.
    const byTurn = stepOf() !== 12 || monthOf() !== 0;
    undo.querySelector('small').textContent = byTurn ? 'Go back' : 'Age down';
    undo.setAttribute('aria-label', byTurn ? 'Go back: take back the last turn' : 'Age down: take back the last year');
  }

  let shownEntries = -1; // entries on screen at the last draw; newer ones fade in
  function renderJournal() {
    const p = player();
    const journal = store.state.journal;
    const fresh = shownEntries >= 0 && journal.length > shownEntries ? shownEntries : journal.length;
    let html = '';
    let age = -1;
    let month = 0;
    let memories = 0; // a few per age at most: memories stay special
    let usedArt = new Set();
    const closeAge = () => {
      if (age < 0) return;
      // The milestones of the year, as scrapbook cards, unless a line of the year already told it.
      for (const m of milestonesAt(p, age)) {
        if (memories >= 2) break;
        const card = milestoneHtml(m);
        const art = card.match(/data-memory="([a-z]+)"/)[1];
        if (usedArt.has(art)) continue;
        usedArt.add(art);
        memories += 1;
        html += card;
      }
      html += '</section>';
    };
    journal.forEach((entry, i) => {
      if (entry.age !== age) {
        closeAge();
        age = entry.age;
        month = 0;
        memories = 0;
        usedArt = new Set();
        html += `<section class="age-block${i >= fresh ? ' fresh' : ''}"><h2 class="age-head">Age ${age} <small>${p.birthYear + age}</small></h2>`;
      }
      // Turns shorter than a year: each part of the year under its own heading.
      if ((entry.month ?? 0) !== month) {
        month = entry.month ?? 0;
        if (month) html += `<h3 class="season-head">${month} months <small>${esc(entry.kind === 'season' ? entry.text.replace(/\.$/, '') : '')}</small></h3>`;
      }
      if (entry.kind === 'season') return; // the heading says it
      const enter = i >= fresh ? ` fresh" style="--i:${Math.min(i - fresh, 8)}` : '';
      // A line that tells a moment in an animal's life opens that animal's profile, at that memory.
      const link = entry.animal ? ` linked" data-animal="${esc(entry.animal.id)}" data-ev="${esc(entry.animal.ev)}" role="button" tabindex="0`
        // A line about sport opens the page of My Athletics it is about: the season, the event, the team, the coach.
        : entry.sport ? ` linked" data-sport-screen="${esc(entry.sport.screen)}" data-sport-id="${esc(entry.sport.id ?? '')}" role="button" tabindex="0` : '';
      const mem = !link && memories < 2 && lineMemory(entry);
      if (mem && !usedArt.has(mem.art)) {
        usedArt.add(mem.art);
        memories += 1;
        html += lineMemoryHtml(entry, mem, enter ? ` fresh" style="--i:${Math.min(i - fresh, 8)}` : '');
        return;
      }
      html += `<p class="entry ${entry.kind} ${entry.tone}${link}${enter}">${esc(entry.text)}</p>`;
    });
    closeAge();
    journalEl.innerHTML = html;
    shownEntries = journal.length;
    journalEl.scrollTop = journalEl.scrollHeight;
  }

  function renderPanel() {
    app.querySelectorAll('.tab-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.tab === activeTab));
    // A dot on Self when care needs the player: a decision to make, or an appointment this week.
    const waiting = player().alive ? careWaiting() : null;
    const self = app.querySelector('.tab-btn[data-tab="self"]');
    if (self) { self.classList.toggle('badge', !!waiting); self.setAttribute('aria-label', waiting ? `Self (${waiting.short})` : 'Self'); }
    const tab = TABS.find((t) => t.id === activeTab);
    panelEl.hidden = !tab;
    // A section takes the whole screen below the header: the dock steps aside until the player goes back.
    const wasOpen = app.querySelector('.game').classList.contains('in-tab');
    app.querySelector('.game').classList.toggle('in-tab', !!tab);
    if (!tab) { if (wasOpen && !busy && !document.querySelector('#modal-root .scrim')) yearBtn.focus({ preventScroll: true }); return; }
    panelBody.onclick = null;
    tab.render(panelBody, tabApi);
    openSection = sectionize(panelBody, openSection);
    titleSection(tab);
    // Keyboard focus moves into the section: the tab that opened it is out of sight now.
    if (!wasOpen && !panelEl.contains(document.activeElement)) $('[data-panel-close]').focus({ preventScroll: true });
  }

  function render() { renderHeader(); renderJournal(); renderPanel(); }

  function closePanel() { activeTab = null; openSection = null; renderPanel(); }
  /** Opens a section of the tab, or goes back to the tab's list (null). Focus follows: into the section, or back to its row. */
  function goSection(title) {
    const tab = TABS.find((t) => t.id === activeTab);
    if (!tab) return; // (the tab was closed under it: nothing to open a section of)
    const was = openSection;
    openSection = showSection(panelBody, title);
    titleSection(tab);
    panelBody.scrollTop = 0;
    const target = openSection && (!was || openSection.length > was.length) ? [...panelBody.querySelectorAll('.sec-body.shown')].pop().querySelector('button:not([disabled])')
      : was && panelBody.querySelector(`.sec-row[data-sec="${CSS.escape(was)}"]`);
    (target ?? $('[data-panel-close]')).focus({ preventScroll: true });
  }
  /** The header names the section open (its last part), and the back button says where it goes. */
  function titleSection(tab) {
    const parts = openSection ? openSection.split(SEP) : [];
    $('[data-panel-title]').textContent = parts.at(-1) ?? tab.title;
    $('[data-panel-close]').setAttribute('aria-label', parts.length ? `Back to ${parts.at(-2) ?? tab.title}` : 'Back to your life');
  }
  // Back: out of a section to the one around it, then to the tab's list, then out of the tab.
  const goBack = () => (openSection ? goSection(openSection.split(SEP).slice(0, -1).join(SEP) || null) : closePanel());
  panelBody.addEventListener('click', (e) => { const row = e.target.closest('.sec-row[data-sec]'); if (row) goSection(row.dataset.sec); });
  function leaveStory() { storyReturn = null; $('[data-story-back]').hidden = true; journalEl.querySelectorAll('.lit').forEach((x) => x.classList.remove('lit')); }

  function finish(entry) {
    render();
    hooks.onDeath(entry);
  }

  /** Walks through every queued scenario; safe to call after a reload. */
  async function runPending() {
    const state = store.state;
    busy = true;
    renderHeader();
    // Each result is shown at the top of the next scene's card, and only the last one gets a card of its own.
    let previous = null;
    while (state.pendingEvents.length && player().alive) {
      // An earlier scene may have taken someone away (a pet that died, a person who left): scenes about them go too.
      prunePending(state);
      if (!state.pendingEvents.length) break;
      const pending = state.pendingEvents[0];
      const ev = getEvent(pending.id);
      if (!ev || !stillFits(pending, state)) { state.pendingEvents.shift(); continue; } // gone, or no longer fits the life
      const index = await eventModal(ev, pending.cast, { ...(turningPoint(ev) ? { onFork: () => forkGame(state, turningNote(ev, pending.cast)) } : {}), previous });
      const result = resolveChoice(ev, index, pending.cast);
      state.pendingEvents.shift();
      persist();
      render();
      previous = result;
      if (result.death) { await outcomeModal(result); busy = false; return finish(die(result.death)); }
      if (player().stats.health <= 0) { await outcomeModal(result); busy = false; return finish(die('failing health')); }
    }
    if (previous && player().alive) await outcomeModal(previous);
    busy = false;
    renderHeader();
    // The button was disabled while the year ran, which drops keyboard focus; give it back.
    if (keepFocus && !document.querySelector('#modal-root .scrim')) yearBtn.focus({ preventScroll: true });
    keepFocus = false;
  }

  let keepFocus = false;
  // One press, one turn: the whole turn holds the button, and a second tap a moment later is a double tap, not a turn.
  let advancing = false;
  let lastPress = -Infinity;
  async function nextYear() {
    if (busy || advancing || performance.now() - lastPress < 400) return;
    advancing = true;
    lastPress = performance.now();
    try { await liveTurn(); } finally { advancing = false; }
  }

  async function liveTurn() {
    leaveStory();
    keepFocus = document.activeElement === yearBtn;
    closePanel();
    pushUndo(store.state); // so this turn can be taken back
    const aliveBefore = player().npcIds.filter((id) => store.state.npcs[id]?.alive);
    advanceTurn(); // a year, or six or three months of one (engine/turns.js)
    if (!player().alive) return finish(store.lastObituary);
    persist();
    render();
    await runPending();
    if (player().alive) await deathNotice(aliveBefore);
    if (player().alive && player().legal.pending) await tabApi.justice();
    await yearUpdate();
    await healthNotice();
  }

  /** Someone in the player's life died this turn: a notice for each, before anything else about the year. */
  async function deathNotice(aliveBefore) {
    const state = store.state;
    const gone = aliveBefore.map((id) => state.npcs[id]).filter((n) => n && !n.alive);
    if (!gone.length) return;
    const card = (n) => {
      const died = n.flags.diedYear ?? state.year;
      const born = died - n.age;
      const who = roleLabel(n);
      const r = n.meters?.relationship ?? 0;
      const feel = n.role === 'pet' ? (r >= 60 ? `${n.firstName} was family. The house is very quiet.` : `You will miss ${n.firstName}.`)
        : r >= 70 ? 'You were close. It will take a long time.' : r >= 40 ? `You will miss ${n.firstName}.` : 'You had drifted apart, but it still hurts.';
      return `<div class="death-card">${portrait(n)}<div class="main">
        <strong>${esc(n.firstName)}${n.role === 'pet' ? '' : ` ${esc(n.lastName)}`}</strong>
        <small>${esc(who)} · ${born} – ${died} · age ${n.age}</small>
        <p class="body">${esc(feel)}</p></div></div>`;
    };
    await new Promise((resolve) => {
      const m = openModal(`
        <div class="eyebrow">In memory</div>
        <h2>${gone.length === 1 ? `${esc(gone[0].firstName)} has died` : `${gone.length} people you loved have died`}</h2>
        ${gone.map(card).join('')}
        <div class="btn-row" style="margin-top:14px"><button class="btn primary" data-ok>Close</button></div>`, { dismissable: true, tone: 'neutral', onDismiss: resolve });
      m.el.querySelector('[data-ok]').addEventListener('click', () => { m.close(); resolve(); });
    });
  }

  /** The yearly life update: what this year changed, from the saved state. Shown once per year. */
  async function yearUpdate() {
    const state = store.state;
    const r = state.yearReport;
    // The yearly update is there to look at (Pursuits, Your life this year), and pops up only for players who turn it on.
    if (!r || r.shown || !player().alive || state.settings?.yearSummary !== true) return;
    r.shown = true;
    persist();
    const s = summarize(r.before, state, r.planLines);
    await new Promise((resolve) => {
      const m = openModal(`
        <div class="eyebrow">${s.year}</div>
        <h2>Age ${s.from} → ${s.to}</h2>
        ${s.quiet ? '<p class="body">A quiet year. Those count too.</p>' : s.sections.map((x) => `<div class="section-label">${esc(x.title)}</div>${x.lines.map((l) => `<p class="yu-line">${esc(l)}</p>`).join('')}`).join('')}
        <div class="btn-row" style="margin-top:14px"><button class="btn" data-off>Stop showing these after each year</button><button class="btn primary" data-ok>Continue</button></div>`, { dismissable: true, onDismiss: resolve });
      m.el.querySelector('[data-ok]').addEventListener('click', () => { m.close(); resolve(); });
      m.el.querySelector('[data-off]').addEventListener('click', () => { state.settings = { ...(state.settings ?? {}), yearSummary: false }; persist(); m.close(); resolve(); });
    });
  }

  /** After a year, a care decision that is waiting is put in front of the player, once. */
  async function healthNotice() {
    const w = player().alive ? careWaiting() : null;
    if (!w?.decision || busy) return;
    const go = await confirmModal({ title: 'Your care', body: w.text, yes: 'Open My Health', no: 'Later' });
    if (go) openHealth(tabApi, { section: 'overview' });
  }

  yearBtn.addEventListener('click', nextYear);
  $('[data-undo]').addEventListener('click', async () => {
    if (busy) return;
    const to = peekUndo(store.state.slotId);
    if (!to) return;
    const where = to.month ? `${to.age === 0 ? '' : `${to.age} ${to.age === 1 ? 'year' : 'years'}, `}${to.month} months` : `age ${to.age}`;
    const turnWord = to.month || store.state.month ? 'turn' : 'year';
    const sure = await confirmModal({ title: `Go back to ${where}?`, body: `Everything that happened since then is undone. You can go back a few ${turnWord}s, one at a time, as far as there is room on this device to keep them.`, yes: turnWord === 'year' ? 'Age down' : 'Go back' });
    if (!sure) return;
    const earlier = popUndo(store.state.slotId);
    if (earlier) { saveGame(earlier); hooks.onRestore(earlier); }
  });
  $('[data-panel-close]').addEventListener('click', goBack);
  // Escape goes back from a section, unless a dialog is open.
  panelEl.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.querySelector('#modal-root .scrim')) { e.preventDefault(); goBack(); } });
  // The menu: the things a player reaches for from anywhere in a life.
  $('[data-menu]').addEventListener('click', async () => {
    if (busy) return;
    const pick = await pickModal({ title: 'Menu', cancel: 'Close', options: [
      { value: 'money', label: 'My Money' },
      { value: 'settings', label: 'Settings' },
      { value: 'exit', label: 'Save and quit' },
    ] });
    if (pick === 'money' && player().alive) openMoney(tabApi);
    if (pick === 'settings') { await openSettings(); tabApi.changed(); }
    if (pick === 'exit') tabApi.exitToTitle();
  });
  $('[data-purse]').addEventListener('click', () => { if (!busy && player().alive) openMoney(tabApi); });
  $('[data-story-back]').addEventListener('click', () => {
    const back = storyReturn;
    leaveStory();
    if (!back) return;
    activeTab = back.tab;
    openSection = back.section ?? null;
    renderPanel();
    back.onBack();
  });
  const openFromStory = (e) => {
    const sportLine = e.target.closest('.entry[data-sport-screen]');
    if (sportLine && !busy && (e.type !== 'keydown' || e.key === 'Enter')) { leaveStory(); return openAthleticsAt(tabApi, { screen: sportLine.dataset.sportScreen, id: sportLine.dataset.sportId || null }); }
    const line = e.target.closest('.entry[data-animal]');
    if (!line || busy || (e.type === 'keydown' && e.key !== 'Enter')) return;
    leaveStory();
    openAnimalProfile(tabApi, line.dataset.animal, { tab: 'memories', open: line.dataset.ev });
  };
  journalEl.addEventListener('click', openFromStory);
  journalEl.addEventListener('keydown', openFromStory);
  app.querySelector('.dock nav').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn || busy) return;
    leaveStory();
    activeTab = activeTab === btn.dataset.tab ? null : btn.dataset.tab;
    openSection = null;
    renderPanel();
  });

  render();
  persist();
  (async () => {
    if (store.state.pendingEvents.length) await runPending();
    if (player().alive && player().legal.pending) await tabApi.justice();
  })();
}
