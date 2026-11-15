// Title screen: start a life, resume a saved life, or visit the graveyard.
import { esc, fmtMoney } from '../../util.js';
import { COUNTRIES } from '../../data/countries.js';
import { listSlots, loadGame, deleteSlot, getGraveyard } from '../../save.js';
import { createLife } from '../../engine/characterGen.js';
import { avatarSvg } from '../avatar.js';
import { confirmModal } from '../modals.js';

const MARK = `
  <svg class="title-mark" viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="15" fill="#2f5d50"/>
    <path d="M18 52c0-12 28-10 28-22S18 22 18 12" fill="none" stroke="#f4efe4" stroke-width="5" stroke-linecap="round"/>
    <circle cx="18" cy="52" r="4.5" fill="#f4efe4"/><circle cx="18" cy="12" r="4.5" fill="#e0b04a"/>
  </svg>`;

/**
 * @param {HTMLElement} app
 * @param {{onPlay:(state:object)=>void, onDesign:Function, onViewGrave:(entry:object)=>void}} hooks
 */
export function renderTitle(app, hooks) {
  const slots = listSlots();
  const graves = getGraveyard();

  const slotRows = slots.map((s) => {
    const c = COUNTRIES[s.countryId];
    return `
      <div class="row">
        <button class="row" data-load="${s.slotId}" style="border:0;margin:0;padding:0;background:none;flex:1;min-width:0">
          <div class="avatar">${avatarSvg({ age: s.age, gender: s.gender, appearance: s.appearance, seed: s.slotId })}</div>
          <div class="main"><strong>${esc(s.name)}</strong>
            <small>Age ${s.age} · ${c.flag} ${esc(c.name)} · ${fmtMoney(s.netWorth, c)}</small></div>
        </button>
        <button class="icon-btn" data-delete="${s.slotId}" aria-label="Delete ${esc(s.name)}">✕</button>
      </div>`;
  }).join('');

  const graveRows = graves.map((g, i) => {
    const c = COUNTRIES[g.countryId];
    return `
      <button class="row" data-grave="${i}">
        <div class="avatar glyph">🪦</div>
        <div class="main"><strong>${esc(g.fullName)}</strong>
          <small>${g.birthYear}–${g.deathYear} · died of ${esc(g.causeOfDeath)}</small></div>
        <div class="side">Age ${g.ageAtDeath}<br>${fmtMoney(g.netWorth, c)}</div>
      </button>`;
  }).join('');

  app.innerHTML = `
    <section class="title-screen">
      <div class="title-hero">${MARK}<h1>Pathways</h1><p>One life. One year at a time.</p></div>
      <div class="btn-stack">
        <button class="btn primary" data-random>Begin a random life</button>
        <button class="btn" data-design>Design a life</button>
      </div>
      <div class="title-section"><h2>Saved lives</h2>
        ${slotRows || '<p class="empty">No lives in progress.</p>'}</div>
      <div class="title-section"><h2>Graveyard</h2>
        ${graveRows || '<p class="empty">Nobody is buried here yet.</p>'}</div>
    </section>`;

  app.querySelector('[data-random]').addEventListener('click', () => hooks.onPlay(createLife()));
  app.querySelector('[data-design]').addEventListener('click', () => hooks.onDesign());
  app.querySelector('.title-screen').addEventListener('click', async (e) => {
    const load = e.target.closest('[data-load]');
    const del = e.target.closest('[data-delete]');
    const grave = e.target.closest('[data-grave]');
    if (load) {
      const state = loadGame(load.dataset.load);
      if (state) hooks.onPlay(state);
    } else if (del) {
      const slot = slots.find((s) => s.slotId === del.dataset.delete);
      const sure = await confirmModal({
        title: `Delete ${slot.name}?`,
        body: 'This saved life will be removed without a grave. This cannot be undone.',
        yes: 'Delete', danger: true,
      });
      if (sure) { deleteSlot(slot.slotId); renderTitle(app, hooks); }
    } else if (grave) {
      hooks.onViewGrave(graves[Number(grave.dataset.grave)]);
    }
  });
}
