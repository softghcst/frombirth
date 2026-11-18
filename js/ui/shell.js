// The in-game screen: identity header, stat meters, journal, year button,
// five-tab dock, and the loop that walks the player through queued scenarios.
import { forkGame } from '../save.js';
import { turningPoint, turningNote } from '../engine/turning.js';
import { store, player, country } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import { saveGame, pushUndo, popUndo, undoDepth } from '../save.js';
import { advanceYear } from '../engine/yearProcessor.js';
import { getEvent, resolveChoice } from '../engine/eventEngine.js';
import { die } from '../engine/death.js';
import { educationLine } from '../engine/education.js';
import { styledName, standing } from '../engine/royalty.js';
import { ROYAL_RANKS } from '../data/royalty.js';
import { avatarSvg, dressOfPlayer } from './avatar.js';
import { meterHtml } from './meter.js';
import { eventModal, outcomeModal, confirmModal, openModal } from './modals.js';
import { summarize } from '../engine/yearSummary.js';
import { TABS } from './tabs/index.js';
import { runJustice } from './justice.js';
import { openHealth } from './health/hub.js';
import { careWaiting } from '../engine/health/index.js';
import { openMoney } from './tabs/holdings.js';
import { bookAction } from '../engine/ledger.js';
import { openAnimalProfile } from './animals.js';

function occupationLine(p) {
  if (p.legal.incarceration) return 'Incarcerated';
  if (p.politics) return `${p.politics.title}${p.career.title && p.politics.tier < 2 ? ` · ${p.career.title}` : ''}`;
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
  let activeTab = null;
  let busy = false;
  /** Set while the player is reading a line of the life story they came to from somewhere else. */
  let storyReturn = null;

  app.innerHTML = `
    <div class="game">
      <main class="stage" aria-label="Your life">
      <div class="idcard">
        <div class="avatar" data-avatar></div>
        <div class="who"><h1 data-name></h1><p data-line1></p><p data-line2></p></div>
        <button class="purse" data-purse aria-label="Open My Money"><div class="label">My Money</div><div class="amount num" data-cash></div></button>
      </div>
      <div class="meters" data-meters></div>
      <div class="sheet-area">
      <div class="journal" data-journal role="log" aria-live="polite" aria-label="Your life so far" tabindex="0"></div>
      <button class="story-back" data-story-back hidden></button>
      <section class="panel" data-panel aria-labelledby="panel-title" hidden>
        <div class="panel-head"><h2 data-panel-title id="panel-title"></h2>
          <button class="icon-btn" data-panel-close aria-label="Close panel">✕</button></div>
        <div class="panel-body" data-panel-body></div>
      </section>
      </div>
      </main>
      <footer class="dock">
        <div class="year-row">
          <button class="undo-btn" data-undo aria-label="Age down: take back the last year">↶<small>Age down</small></button>
          <button class="year-btn" data-year></button>
        </div>
        <nav aria-label="Sections">
          ${TABS.map((t) => `
            <button class="tab-btn" data-tab="${t.id}" aria-label="${esc(t.title)}">
              <svg viewBox="0 0 24 24" aria-hidden="true">${t.icon}</svg>${esc(t.short)}
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
      storyReturn = { tab: activeTab, onBack };
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
    $('[data-line1]').textContent = `Age ${p.age} · ${p.city}, ${c.name} ${c.flag}`;
    $('[data-line2]').textContent = occupationLine(p);
    const cashEl = $('[data-cash]');
    cashEl.textContent = fmtMoney(p.finance.cash, c);
    cashEl.classList.toggle('neg', p.finance.cash < 0);
    $('[data-meters]').innerHTML = meterHtml('Mood', p.stats.mood) + meterHtml('Health', p.stats.health)
      + meterHtml('Intellect', p.stats.intellect) + meterHtml('Charm', p.stats.charm);
    yearBtn.innerHTML = `Live another year <small>→ age ${p.age + 1}</small>`;
    yearBtn.disabled = busy || !p.alive;
    const undo = $('[data-undo]');
    undo.disabled = busy || !undoDepth(store.state.slotId);
    undo.hidden = p.age === 0 && !undoDepth(store.state.slotId);
  }

  function renderJournal() {
    const p = player();
    let html = '';
    let age = -1;
    for (const entry of store.state.journal) {
      if (entry.age !== age) {
        age = entry.age;
        html += `<h2 class="age-head">Age ${age} <small>${p.birthYear + age}</small></h2>`;
      }
      // A line that tells a moment in an animal's life opens that animal's profile, at that memory.
      const link = entry.animal ? ` linked" data-animal="${esc(entry.animal.id)}" data-ev="${esc(entry.animal.ev)}" role="button" tabindex="0` : '';
      html += `<p class="entry ${entry.kind} ${entry.tone}${link}">${esc(entry.text)}</p>`;
    }
    journalEl.innerHTML = html;
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
    if (!tab) return;
    $('[data-panel-title]').textContent = tab.title;
    panelBody.onclick = null;
    tab.render(panelBody, tabApi);
  }

  function render() { renderHeader(); renderJournal(); renderPanel(); }

  function closePanel() { activeTab = null; renderPanel(); }
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
    while (state.pendingEvents.length && player().alive) {
      const pending = state.pendingEvents[0];
      const ev = getEvent(pending.id);
      if (!ev) { state.pendingEvents.shift(); continue; }
      const index = await eventModal(ev, pending.cast, turningPoint(ev) ? { onFork: () => forkGame(state, turningNote(ev, pending.cast)) } : {});
      const result = resolveChoice(ev, index, pending.cast);
      state.pendingEvents.shift();
      persist();
      render();
      await outcomeModal(result);
      if (result.death) { busy = false; return finish(die(result.death)); }
      if (player().stats.health <= 0) { busy = false; return finish(die('failing health')); }
    }
    busy = false;
    renderHeader();
    // The button was disabled while the year ran, which drops keyboard focus; give it back.
    if (keepFocus && !document.querySelector('#modal-root .scrim')) yearBtn.focus({ preventScroll: true });
    keepFocus = false;
  }

  let keepFocus = false;
  async function nextYear() {
    if (busy) return;
    leaveStory();
    keepFocus = document.activeElement === yearBtn;
    closePanel();
    pushUndo(store.state); // so this year can be taken back
    advanceYear();
    if (!player().alive) return finish(store.lastObituary);
    persist();
    render();
    await runPending();
    if (player().alive && player().legal.pending) await tabApi.justice();
    await yearUpdate();
    await healthNotice();
  }

  /** The yearly life update: what this year changed, from the saved state. Shown once per year. */
  async function yearUpdate() {
    const state = store.state;
    const r = state.yearReport;
    if (!r || r.shown || !player().alive || state.settings?.yearSummary === false) return;
    r.shown = true;
    persist();
    const s = summarize(r.before, state, r.planLines);
    await new Promise((resolve) => {
      const m = openModal(`
        <div class="eyebrow">${s.year}</div>
        <h2>Age ${s.from} → ${s.to}</h2>
        ${s.quiet ? '<p class="body">A quiet year. Those count too.</p>' : s.sections.map((x) => `<div class="section-label">${esc(x.title)}</div>${x.lines.map((l) => `<p class="yu-line">${esc(l)}</p>`).join('')}`).join('')}
        <div class="btn-row" style="margin-top:14px"><button class="btn" data-off>Stop showing these</button><button class="btn primary" data-ok>Continue</button></div>`, { dismissable: true, onDismiss: resolve });
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
    const sure = await confirmModal({ title: `Go back to age ${player().age - 1}?`, body: 'Everything that happened this year is undone. You can go back up to three years, one at a time.', yes: 'Age down' });
    if (!sure) return;
    const earlier = popUndo(store.state.slotId);
    if (earlier) { saveGame(earlier); hooks.onRestore(earlier); }
  });
  $('[data-panel-close]').addEventListener('click', closePanel);
  $('[data-purse]').addEventListener('click', () => { if (!busy && player().alive) openMoney(tabApi); });
  $('[data-story-back]').addEventListener('click', () => {
    const back = storyReturn;
    leaveStory();
    if (!back) return;
    activeTab = back.tab;
    renderPanel();
    back.onBack();
  });
  const openFromStory = (e) => {
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
    renderPanel();
  });

  render();
  persist();
  (async () => {
    if (store.state.pendingEvents.length) await runPending();
    if (player().alive && player().legal.pending) await tabApi.justice();
  })();
}
