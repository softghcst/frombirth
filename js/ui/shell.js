// The in-game screen: identity header, stat meters, journal, year button,
// five-tab dock, and the loop that walks the player through queued scenarios.
import { store, player, country } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import { saveGame } from '../save.js';
import { advanceYear } from '../engine/yearProcessor.js';
import { getEvent, resolveChoice } from '../engine/eventEngine.js';
import { die } from '../engine/death.js';
import { educationLine } from '../engine/education.js';
import { avatarSvg } from './avatar.js';
import { meterHtml } from './meter.js';
import { eventModal, outcomeModal } from './modals.js';
import { TABS } from './tabs/index.js';

function occupationLine(p) {
  if (p.legal.incarceration) return 'Incarcerated';
  if (p.career.title) return p.career.title;
  if (p.education.enrolled) return educationLine(p);
  if (p.career.retired) return 'Retired';
  if (p.age < 5) return p.age < 2 ? 'Infant' : 'Toddler';
  return p.age < 18 ? 'Not in school' : 'Unemployed';
}

/**
 * @param {HTMLElement} app
 * @param {{onExit:Function, onDeath:Function}} hooks
 */
export function mountGame(app, hooks) {
  let activeTab = null;
  let busy = false;

  app.innerHTML = `
    <section class="game">
      <div class="stage">
      <header class="idcard">
        <div class="avatar" data-avatar></div>
        <div class="who"><h1 data-name></h1><p data-line1></p><p data-line2></p></div>
        <div class="purse"><div class="label">Bank</div><div class="amount num" data-cash></div></div>
      </header>
      <div class="meters" data-meters></div>
      <main class="journal" data-journal aria-live="polite"></main>
      <section class="panel" data-panel hidden>
        <div class="panel-head"><h2 data-panel-title></h2>
          <button class="icon-btn" data-panel-close aria-label="Close panel">✕</button></div>
        <div class="panel-body" data-panel-body></div>
      </section>
      </div>
      <footer class="dock">
        <button class="year-btn" data-year></button>
        <nav aria-label="Sections">
          ${TABS.map((t) => `
            <button class="tab-btn" data-tab="${t.id}" aria-label="${esc(t.title)}">
              <svg viewBox="0 0 24 24" aria-hidden="true">${t.icon}</svg>${esc(t.short)}
            </button>`).join('')}
        </nav>
      </footer>
    </section>`;

  const $ = (sel) => app.querySelector(sel);
  const journalEl = $('[data-journal]');
  const panelEl = $('[data-panel]');
  const panelBody = $('[data-panel-body]');
  const yearBtn = $('[data-year]');

  const persist = () => { if (player().alive) saveGame(store.state); };

  const tabApi = {
    /** Call after a tab action changes state. */
    changed() { persist(); render(); },
    exitToTitle() { persist(); hooks.onExit(); },
    endLife() { closePanel(); finish(die('sudden unexplained causes')); },
  };

  function renderHeader() {
    const p = player();
    const c = country();
    $('[data-avatar]').innerHTML = avatarSvg({
      age: p.age, gender: p.gender, appearance: p.appearance,
      jailed: !!p.legal.incarceration, mood: p.stats.mood,
    });
    $('[data-name]').textContent = `${p.firstName} ${p.lastName}`;
    $('[data-line1]').textContent = `Age ${p.age} · ${p.city}, ${c.name} ${c.flag}`;
    $('[data-line2]').textContent = occupationLine(p);
    const cashEl = $('[data-cash]');
    cashEl.textContent = fmtMoney(p.finance.cash, c);
    cashEl.classList.toggle('neg', p.finance.cash < 0);
    $('[data-meters]').innerHTML = meterHtml('Mood', p.stats.mood) + meterHtml('Health', p.stats.health)
      + meterHtml('Intellect', p.stats.intellect) + meterHtml('Charm', p.stats.charm);
    yearBtn.innerHTML = `Live another year <small>→ age ${p.age + 1}</small>`;
    yearBtn.disabled = busy || !p.alive;
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
      html += `<p class="entry ${entry.kind} ${entry.tone}">${esc(entry.text)}</p>`;
    }
    journalEl.innerHTML = html;
    journalEl.scrollTop = journalEl.scrollHeight;
  }

  function renderPanel() {
    app.querySelectorAll('.tab-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.tab === activeTab));
    const tab = TABS.find((t) => t.id === activeTab);
    panelEl.hidden = !tab;
    if (!tab) return;
    $('[data-panel-title]').textContent = tab.title;
    panelBody.onclick = null;
    tab.render(panelBody, tabApi);
  }

  function render() { renderHeader(); renderJournal(); renderPanel(); }

  function closePanel() { activeTab = null; renderPanel(); }

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
      const index = await eventModal(ev, pending.cast);
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
  }

  async function nextYear() {
    if (busy) return;
    closePanel();
    advanceYear();
    if (!player().alive) return finish(store.lastObituary);
    persist();
    render();
    await runPending();
  }

  yearBtn.addEventListener('click', nextYear);
  $('[data-panel-close]').addEventListener('click', closePanel);
  app.querySelector('.dock nav').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn || busy) return;
    activeTab = activeTab === btn.dataset.tab ? null : btn.dataset.tab;
    renderPanel();
  });

  render();
  persist();
  if (store.state.pendingEvents.length) runPending();
}
