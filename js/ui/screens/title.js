// Title screen: start a life, resume a saved life, or visit the graveyard.
import { idolWork } from '../../engine/kpop.js';
import { openWorld } from '../world.js';
import { openSettings, cloudLine } from '../settings.js';
import * as cloud from '../../sync/cloud.js';
import { esc, fmtMoney } from '../../util.js';
import { COUNTRIES } from '../../data/countries.js';
import { listSlots, loadGame, deleteSlot, getGraveyard, epitaphsEarned, peekGame, timelinesOf } from '../../save.js';
import { createLife } from '../../engine/characterGen.js';
import { avatarSvg } from '../avatar.js';
import { confirmModal } from '../modals.js';
import { openEpitaphCollection } from './obituary.js';
import { EPITAPHS, EPITAPH_BY_ID } from '../../data/epitaphs.js';
import { ageLabel } from '../../engine/turns.js';
import { markSvg, icon } from '../kit.js';

const MARK = markSvg();

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
            <small>${s.dead ? `Died at ${s.age} · choose who carries on` : `Age ${esc(ageLabel(s.age, s.month))} · ${c.flag} ${esc(c.name)} · ${fmtMoney(s.netWorth, c)}`}</small>
            ${s.timeline ? `<small class="timeline-tag">${esc(s.timeline.name)}${s.timeline.note ? ` · parted at ${esc(ageLabel(s.timeline.age, s.timeline.month))}: ${esc(s.timeline.note)}` : ''}</small>` : ''}</div>
        </button>
        ${s.timeline && timelinesOf(s.timeline.root).length > 1 ? `<button class="icon-btn" data-compare="${s.timeline.root}" aria-label="Compare timelines">⇄</button>` : ''}
        <button class="icon-btn" data-delete="${s.slotId}" aria-label="Delete ${esc(s.name)}">✕</button>
      </div>`;
  }).join('');

  const graveRows = graves.map((g, i) => {
    const c = COUNTRIES[g.countryId];
    return `
      <button class="row" data-grave="${i}">
        <div class="avatar glyph grave-glyph" aria-hidden="true">🪦</div>
        <div class="main"><strong>${esc(g.fullName)}</strong>
          <small>${g.birthYear}–${g.deathYear} · ${esc(EPITAPH_BY_ID[g.epitaphIds?.[0]]?.title ?? `died of ${g.causeOfDeath}`)}</small></div>
        <div class="side">Age ${g.ageAtDeath}<br>${fmtMoney(g.netWorth, c)}</div>
      </button>`;
  }).join('');

  app.innerHTML = `
    <main class="title-screen">
      <div class="title-hero">${MARK}<h1>Pathways</h1><p>One Life. One Year at a Time.</p></div>
      <div class="btn-stack title-actions">
        <button class="btn peach big" data-random>${icon('sparkle')}Begin a Random Life</button>
        <button class="btn" data-design>${icon('id')}Design a Life</button>
        <div class="btn-row">
          <button class="btn" data-world>${icon('globe')}The World</button>
          <button class="btn" data-settings>${icon('settings')}Settings</button>
        </div>
      </div>
      ${cloud.signedIn() ? `<p class="muted sync-line" data-sync-line>${esc(cloudLine())}</p>` : ''}
      <div class="title-section"><h2>Saved Lives</h2>
        ${slotRows || '<p class="empty">No lives in progress.</p>'}</div>
      <div class="title-section"><h2>Graveyard</h2>
        ${graveRows || '<p class="empty">Nobody is buried here yet.</p>'}
        ${graves.length ? `<button class="btn" data-epitaphs style="margin-top:10px">Epitaphs Earned: ${epitaphsEarned().length} of ${EPITAPHS.length}</button>` : ''}</div>
    </main>`;

  app.querySelector('[data-random]').addEventListener('click', () => hooks.onPlay(createLife()));
  app.querySelector('[data-design]').addEventListener('click', () => hooks.onDesign());
  app.querySelector('.title-screen').addEventListener('click', async (e) => {
    const cmp = e.target.closest('[data-compare]');
    if (cmp) return compareTimelines(cmp.dataset.compare);
    const load = e.target.closest('[data-load]');
    const del = e.target.closest('[data-delete]');
    const grave = e.target.closest('[data-grave]');
    if (e.target.closest('[data-epitaphs]')) return openEpitaphCollection();
    if (e.target.closest('[data-world]')) return openWorld({ choose: 'Begin a life here', onChoose: (id) => hooks.onPlay(createLife({ countryId: id })) });
    if (e.target.closest('[data-settings]')) return openSettings({ onChange: () => renderTitle(app, hooks) }).then(() => renderTitle(app, hooks));
    if (load) {
      const state = loadGame(load.dataset.load);
      if (state) hooks.onPlay(state);
    } else if (del) {
      const slot = slots.find((s) => s.slotId === del.dataset.delete);
      const sure = await confirmModal({
        title: `Delete ${slot.name}?`,
        body: slot.dead ? 'The grave stays, but nobody will carry this family on. This cannot be undone.' : 'This saved life will be removed without a grave. This cannot be undone.',
        yes: 'Delete', danger: true,
      });
      if (sure) { deleteSlot(slot.slotId); renderTitle(app, hooks); }
    } else if (grave) {
      hooks.onViewGrave(graves[Number(grave.dataset.grave)]);
    }
  });
}

/** The timelines of one life, side by side: where each has got to. */
function compareTimelines(root) {
  const rows = timelinesOf(root).map((m) => ({ m, st: peekGame(m.slotId) })).filter((x) => x.st).sort((a, b) => (a.m.timeline?.age ?? -1) - (b.m.timeline?.age ?? -1));
  const cell = (x) => {
    const p = x.st.player;
    const c = COUNTRIES[p.countryId];
    const people = Object.values(x.st.npcs).filter((n) => n.alive);
    const love = people.find((n) => n.role === 'spouse') ?? people.find((n) => n.role === 'partner');
    const kids = people.filter((n) => n.role === 'child').length;
    const last = (p.milestones ?? []).filter((m) => !m.private || m.shared).slice(-3).reverse();
    return `<div class="card timeline-card"><h3>${esc(x.m.timeline?.name ?? 'The first telling')}</h3>
      ${x.m.timeline?.note ? `<p class="muted">Parted at ${esc(ageLabel(x.m.timeline.age, x.m.timeline.month))}: ${esc(x.m.timeline.note)}</p>` : '<p class="muted">The road first taken.</p>'}
      <div class="kv"><span>Now</span><span>${p.alive ? `Age ${esc(ageLabel(p.age, x.st.month))}` : `Died at ${p.age}`} · ${c.flag} ${esc(p.city)}</span></div>
      <div class="kv"><span>Work</span><span>${esc(p.politics?.title ?? (idolWork(p)?.current ? idolWork(p).title : null) ?? p.career.title ?? (p.education.enrolled ? 'Studying' : p.career.retired ? 'Retired' : 'Not working'))}</span></div>
      <div class="kv"><span>Worth</span><span>${fmtMoney(x.m.netWorth, c)}</span></div>
      <div class="kv"><span>Love</span><span>${love ? `${esc(love.firstName)}${love.role === 'spouse' ? ' (married)' : ''}` : 'Nobody'}${kids ? ` · ${kids} ${kids === 1 ? 'child' : 'children'}` : ''}</span></div>
      <div class="kv"><span>Mood · health</span><span>${Math.round(p.stats.mood)}% · ${Math.round(p.stats.health)}%</span></div>
      ${last.length ? `<div class="section-label">Lately</div>${last.map((t) => `<p class="muted">Age ${t.age}: ${esc(t.text)}</p>`).join('')}` : ''}</div>`;
  };
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="whatif-title"><div class="eyebrow">What if?</div><h2 id="whatif-title">One life, ${rows.length} ways</h2>
    ${rows.map(cell).join('')}
    <button class="btn primary" data-ok style="margin-top:10px">Close</button></div>`;
  scrim.addEventListener('click', (e) => { if (e.target === scrim || e.target.closest('[data-ok]')) scrim.remove(); });
  document.getElementById('modal-root').appendChild(scrim);
}
