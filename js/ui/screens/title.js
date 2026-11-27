// Title screen: start a life, resume a saved life, or visit the graveyard.
import { birthGlobeOn, openBirthGlobe } from '../birthGlobe.js';
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
import { icon } from '../kit.js';
import { landingNow } from '../../landing.js';
import { pickModal } from '../modals.js';

// Head and shoulders: the part of an avatar a portrait shows.
const BUST = '40 30 440 440';
const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
const BOOK = '<svg viewBox="0 0 48 40" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" aria-hidden="true"><path d="M24 9c-5-4-12-5-20-4v28c8-1 15 0 20 4 5-4 12-5 20-4V5c-8-1-15 0-20 4z"/><path d="M24 9v28"/></svg>';
// A friendly die: a cream cube, a dark outline, five pips showing.
const DICE = `<svg viewBox="0 0 48 48"><g stroke="#2A1530" stroke-width="2.6" stroke-linejoin="round">
  <path d="M24 4 42 13v21L24 44 6 34V13z" fill="#FFF7EC"/><path d="M6 13 24 22 42 13" fill="none"/><path d="M24 22v22" fill="none"/>
  <path d="M24 4 42 13 24 22 6 13z" fill="#FFFDF8"/><path d="M24 22 42 13v21L24 44z" fill="#F2E3D2"/></g>
  <g fill="#2A1530"><ellipse cx="24" cy="13" rx="2.6" ry="1.6"/><circle cx="11" cy="21" r="2"/><circle cx="18.5" cy="32" r="2"/><circle cx="14.6" cy="26.6" r="2"/>
  <circle cx="30" cy="27" r="2"/><circle cx="36" cy="22" r="2"/><circle cx="30" cy="36.5" r="2"/><circle cx="36" cy="31.5" r="2"/></g></svg>`;

/**
 * @param {HTMLElement} app
 * @param {{onPlay:(state:object)=>void, onDesign:Function, onViewGrave:(entry:object)=>void}} hooks
 */
export function renderTitle(app, hooks) {
  const slots = listSlots();
  const graves = getGraveyard();

  // Your Lives: the whole card continues the life; managing it (compare, delete) is in its own menu.
  const slotRows = slots.map((s) => {
    const c = COUNTRIES[s.countryId];
    const where = `${c.flag} ${esc(c.name)}`;
    return `
      <div class="lp-card">
        <button type="button" class="lp-card-main" data-load="${s.slotId}" aria-label="${s.dead ? 'Choose who carries on for' : 'Continue'} ${esc(s.name)}">
          <span class="lp-face" aria-hidden="true">${avatarSvg({ age: s.age, gender: s.gender, face: s.face ?? s.gender, appearance: s.appearance, seed: s.slotId, viewBox: BUST })}</span>
          <span class="lp-who"><strong>${esc(s.name)}</strong>
            <small>${s.dead ? `Died at ${s.age} · ${where}` : `Age ${esc(ageLabel(s.age, s.month))} · ${where} · ${fmtMoney(s.netWorth, c)}`}</small>
            ${s.timeline ? `<small class="timeline-tag">${esc(s.timeline.name)}${s.timeline.note ? ` · parted at ${esc(ageLabel(s.timeline.age, s.timeline.month))}: ${esc(s.timeline.note)}` : ''}</small>` : ''}</span>
          <span class="lp-go" aria-hidden="true">${CHEVRON}${s.dead ? 'Carry on' : 'Continue'}</span>
        </button>
        <button type="button" class="lp-more" data-more="${s.slotId}" aria-haspopup="dialog" aria-label="More for ${esc(s.name)}">⋯</button>
      </div>`;
  }).join('');

  // Past Lives: each a finished story, with the face it had.
  const graveRows = graves.map((g, i) => {
    const c = COUNTRIES[g.countryId];
    const face = g.portrait ? avatarSvg({ age: g.ageAtDeath, gender: g.portrait.gender ?? g.gender, appearance: g.portrait.appearance, seed: g.portrait.seed ?? g.id, viewBox: BUST }) : '<span style="font-size:1.6rem">🕊️</span>';
    return `
      <div class="lp-card">
        <button type="button" class="lp-card-main" data-grave="${i}" aria-label="The life of ${esc(g.fullName)}">
          <span class="lp-face grave" aria-hidden="true">${face}</span>
          <span class="lp-who"><strong>${esc(g.fullName)}</strong>
            <small>${g.birthYear}–${g.deathYear} · ${c ? `${c.flag} ` : ''}${esc(EPITAPH_BY_ID[g.epitaphIds?.[0]]?.title ?? `Died of ${g.causeOfDeath}`)}</small></span>
          <span class="lp-go" aria-hidden="true">${CHEVRON}Age ${g.ageAtDeath}</span>
        </button>
      </div>`;
  }).join('');

  const look = landingNow();
  app.innerHTML = `
    <main class="title-screen" data-landing="${look}">
      <div class="lp-hero">
        <h1 class="lp-logo-h"><img class="lp-logo" src="./assets/branding/from_birth_logo-640.png" width="1123" height="1401" alt="From Birth" decoding="async" fetchpriority="high"></h1>
        <p class="lp-tagline">Your life. Your choices. Your story.</p>
      </div>
      <div class="lp-actions">
        <button type="button" class="lp-btn lp-primary" data-random><span class="lp-art" aria-hidden="true">${DICE}</span><span class="lp-label">Begin a Random Life</span></button>
        <button type="button" class="lp-btn lp-secondary" data-design><span class="lp-art" aria-hidden="true"><span class="avatar-wrap">${avatarSvg({ age: 9, gender: 'female', seed: 'design-a-life', viewBox: BUST })}</span></span><span class="lp-label">Design a Life</span></button>
        <div class="lp-utils">
          <button type="button" class="lp-util" data-world>${icon('globe')}The World</button>
          <button type="button" class="lp-util" data-settings>${icon('settings')}Settings</button>
        </div>
      </div>
      ${cloud.signedIn() ? `<p class="muted sync-line" data-sync-line>${esc(cloudLine())}</p>` : ''}
      <section class="lp-section" aria-labelledby="lp-lives"><h2 id="lp-lives">Your Lives</h2>
        ${slotRows || `<div class="lp-empty"><strong>Your next life is waiting.</strong><p>Begin a random life or design your own story.</p></div>`}</section>
      <section class="lp-section" aria-labelledby="lp-past"><h2 id="lp-past">Past Lives</h2>
        ${graveRows || `<div class="lp-empty">${BOOK}<p>Your stories will live on here.</p></div>`}
        ${graves.length ? `<button type="button" class="lp-epitaphs" data-epitaphs>Epitaphs Earned: ${epitaphsEarned().length} of ${EPITAPHS.length}</button>` : ''}</section>
    </main>`;

  // A random life begins on the birth globe, unless it is turned off in Settings (js/ui/birthGlobe.js).
  app.querySelector('[data-random]').addEventListener('click', async () => {
    const life = createLife();
    if (birthGlobeOn()) await openBirthGlobe(life);
    hooks.onPlay(life);
  });
  app.querySelector('[data-design]').addEventListener('click', () => hooks.onDesign());
  app.querySelector('.title-screen').addEventListener('click', async (e) => {
    const cmp = e.target.closest('[data-compare]');
    if (cmp) return compareTimelines(cmp.dataset.compare);
    const more = e.target.closest('[data-more]');
    if (more) {
      // Managing a saved life, apart from continuing it: nothing here happens without a second, plain choice.
      const slot = slots.find((x) => x.slotId === more.dataset.more);
      const multi = slot.timeline && timelinesOf(slot.timeline.root).length > 1;
      const act = await pickModal({ title: slot.name, cancel: 'Back', options: [{ value: 'open', label: slot.dead ? 'Choose who carries on' : 'Continue this life' },
        ...(multi ? [{ value: 'compare', label: 'Compare timelines', sub: 'Every telling of this life, side by side' }] : []),
        { value: 'delete', label: 'Delete this life', sub: slot.dead ? 'The grave stays.' : 'No grave is made.' }] });
      if (act === 'open') { const st = loadGame(slot.slotId); if (st) hooks.onPlay(st); }
      if (act === 'compare') compareTimelines(slot.timeline.root);
      if (act !== 'delete') return undefined;
      const sure = await confirmModal({
        title: `Delete ${slot.name}?`,
        body: slot.dead ? 'The grave stays, but nobody will carry this family on. This cannot be undone.' : 'This saved life will be removed without a grave. This cannot be undone.',
        yes: 'Delete', danger: true,
      });
      if (sure) { deleteSlot(slot.slotId); renderTitle(app, hooks); }
      return undefined;
    }
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
