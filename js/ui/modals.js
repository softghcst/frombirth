// Promise-based modals. Scenario modals cannot be dismissed without choosing.
import { esc, fmtMoney } from '../util.js';
import { store, country } from '../state.js';
import { avatarSvg } from '../avatar/render.js';
import { roleLabel } from '../engine/relationships.js';
import { renderText, choiceStates } from '../engine/eventEngine.js';

const root = () => document.getElementById('modal-root');

/**
 * @param {string} html  inner markup of the modal card
 * @param {{tone?:string, dismissable?:boolean, onDismiss?:Function}} [opts]
 */
export function openModal(html, opts = {}) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="modal ${opts.tone ? `tone-${opts.tone}` : ''}" role="dialog" aria-modal="true">${html}</div>`;
  // Focus goes into the dialog, and back to where it was when the dialog closes.
  // A dialog opened from inside another returns focus where that one would have.
  const opener = document.activeElement;
  const returnTo = opener?.closest?.('.modal')?._returnTo ?? opener;
  const close = () => {
    scrim.remove();
    const still = document.querySelector('#modal-root .scrim:last-child .modal');
    if (still) { (still.querySelector('button:not([disabled]):not(.modal-back)') ?? still).focus({ preventScroll: true }); return; }
    const target = returnTo?.isConnected ? returnTo : document.querySelector('[data-year]');
    target?.focus?.({ preventScroll: true });
  };
  if (opts.dismissable) {
    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) { close(); opts.onDismiss?.(); }
    });
    scrim.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); opts.onDismiss?.(); } });
  }
  root().appendChild(scrim);
  const card = scrim.firstElementChild;
  card._returnTo = returnTo;
  // Every page that can be closed has a way back, in plain sight: "‹ Back", top left, staying there however far
  // down the page has been scrolled, unless the page shows its own back button (see sync below). (Scenes that must be answered have none. A page that draws its own ✕ in a header
  // keeps working, but that one is tucked away: there is one way back, and it is always in the same place.) Opened from
  // inside another page, Back returns to it; opened from a tab, it returns to the tab.
  // back: false, for a pop-up with its own way out (Close, Cancel, Not yet): tapping outside still closes it, with no
  // Back as well. The question, choice and text pop-ups below all have their own.
  if (opts.dismissable && opts.back !== false) {
    const row = document.createElement('div');
    row.className = 'modal-backrow';
    row.innerHTML = '<button type="button" class="modal-back" aria-label="Back"><span aria-hidden="true">‹</span> Back</button>';
    // A page with levels of its own (a screen opened from a screen) has its own back control: this one presses it, so Back
    // steps out one level at a time and only leaves the page from the first.
    row.firstElementChild.addEventListener('click', () => {
      const inner = card.querySelector('[data-back]:not(.modal-back)');
      if (inner && !inner.disabled) { inner.click(); return; }
      close(); opts.onDismiss?.();
    });
    card.prepend(row);
    card.classList.add('has-back');
    // One way back, never two: while the page shows a back button of its own ("← All places", "← Back" on a deeper
    // level), this one is hidden, and it returns when the page has none (its first level).
    const sync = () => {
      const own = [...card.querySelectorAll('[data-back]:not(.modal-back)')].some((b) => !b.disabled && b.getClientRects().length > 0);
      if (row.hidden !== own) row.hidden = own;
    };
    // Pages redraw their own contents; the row is put back if one wipes it.
    new MutationObserver(() => { if (!row.isConnected) card.prepend(row); sync(); })
      .observe(card, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'disabled', 'class', 'style'] });
    sync();
  }
  nameDialog(card);
  card.setAttribute('tabindex', '-1');
  // Only things that can take focus: an SVG <use href> inside a portrait matches [href] but cannot.
  (card.querySelector('button:not([disabled]):not(.modal-back), a[href], input, select, textarea, summary') ?? card).focus({ preventScroll: true });
  return { el: card, close };
}

let dialogSeq = 0;
/** Gives a dialog an accessible name: its heading, or failing that its first line of text. */
function nameDialog(card) {
  if (card.hasAttribute('aria-label') || card.hasAttribute('aria-labelledby')) return;
  const head = card.querySelector('h1, h2, h3, .eyebrow, .scene, .body, p');
  if (!head) { card.setAttribute('aria-label', 'Dialog'); return; }
  head.id ||= `dialog-title-${++dialogSeq}`;
  card.setAttribute('aria-labelledby', head.id);
}

/**
 * A scene that is news about someone (ev.notice = {who, emoji, title}): their face, name and who they are to the
 * player on a band, then the emoji and the title, as a notice. '' when the scene is not one, or they are not known.
 */
function noticeOf(ev, cast) {
  const id = ev.notice && (cast?.[ev.notice.who] ?? cast?.words?.[ev.notice.who]);
  const n = id && store.state.npcs[id];
  if (!n) return '';
  const face = `<div class="avatar">${avatarSvg({ age: n.age, gender: n.gender, appearance: n.appearance, seed: n.id, mood: n.meters?.relationship ?? 60, label: n.firstName })}</div>`;
  return `<div class="notice-head">${face}<div class="notice-who"><strong>${esc(n.firstName)} ${esc(n.lastName ?? '')}</strong><small>${esc(roleLabel(n))}</small></div></div>
    <h2 class="pick-title"><span class="pick-emoji" aria-hidden="true">${esc(renderText(ev.notice.emoji, cast))}</span>${esc(renderText(ev.notice.title, cast))}</h2>`;
}

/** Shows a scenario and resolves with the index of the chosen option. */
export function eventModal(ev, cast, opts = {}) {
  return new Promise((resolve) => {
    const choices = choiceStates(ev, cast).map((c, i) => (c.hidden ? '' : `
      <button class="choice-btn" data-i="${i}" ${c.enabled ? '' : 'disabled'}>
        ${esc(renderText(c.label, cast))}
        ${c.enabled ? '' : '<small>Not available to you right now</small>'}
      </button>`)).join('');
    // What came of the scene before, on this card: one tap per scene instead of two.
    const before = opts.previous ? `<div class="prev-outcome tone-${esc(opts.previous.tone ?? 'neutral')}"><p>${esc(opts.previous.text)}</p>${changeChips(opts.previous.changes)}</div>` : '';
    const m = openModal(`
      ${before}
      ${noticeOf(ev, cast) || `<div class="eyebrow">${esc(ev.category)}</div>`}
      <p class="scene">${esc(renderText(ev.text, cast))}</p>
      ${choices}
      ${opts.onFork ? '<button class="whatif-btn" data-fork>What if? <small>Keep this moment, and live both choices</small></button>' : ''}`);
    m.el.addEventListener('click', async (e) => {
      const fork = e.target.closest('[data-fork]');
      if (fork) {
        // Kept once: the button says what happened, and the choice is still to make.
        fork.disabled = true;
        const r = await opts.onFork();
        fork.innerHTML = `${r.ok ? 'Kept.' : 'Not kept.'} <small>${esc(r.text)}</small>`;
        return;
      }
      const btn = e.target.closest('.choice-btn');
      if (!btn || btn.disabled) return;
      m.close();
      resolve(Number(btn.dataset.i));
    });
  });
}

function changeChips(changes) {
  if (!changes?.length) return '';
  const c = country();
  return `<div class="chips">${changes.map((ch) => {
    const sign = ch.delta > 0 ? '+' : '';
    const value = ch.money ? `${ch.delta > 0 ? '+' : ''}${fmtMoney(ch.delta, c)}` : `${sign}${ch.delta}`;
    return `<span class="chip ${ch.delta >= 0 ? 'up' : 'down'}">${esc(ch.label)} ${value}</span>`;
  }).join('')}</div>`;
}

/**
 * A moment on a trip: what happened, and the choices (each with its cost, if any). What came of the moment before is
 * shown on top, as with the year's scenes. Resolves to the chosen index.
 */
export function tripSceneModal({ eyebrow, text, choices, previous }) {
  return new Promise((resolve) => {
    const c = country();
    const before = previous ? `<div class="prev-outcome tone-${esc(previous.tone ?? 'neutral')}"><p>${esc(previous.text)}</p>${changeChips(previous.changes)}</div>` : '';
    const m = openModal(`${before}<div class="eyebrow">${esc(eyebrow)}</div><p class="scene">${esc(text)}</p>
      ${choices.map((ch, i) => `<button class="choice-btn" data-i="${i}" ${ch.ok ? '' : 'disabled'}>${esc(ch.label)}${ch.cost ? `<small>${esc(fmtMoney(ch.cost, c))}${ch.ok ? '' : ', more than you have'}</small>` : ''}</button>`).join('')}`);
    m.el.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice-btn');
      if (!btn || btn.disabled) return;
      m.close();
      resolve(Number(btn.dataset.i));
    });
  });
}

/** Shows what happened after a choice. */
export function outcomeModal(result) {
  return messageModal({ body: result.text, tone: result.tone, changes: result.changes, serif: true });
}

/** A single-button notice. */
export function messageModal({ eyebrow, title, body, tone = 'neutral', changes, button = 'Continue', serif, previous }) {
  return new Promise((resolve) => {
    const m = openModal(`
      ${previous ? `<div class="prev-outcome tone-${esc(previous.tone ?? 'neutral')}"><p>${esc(previous.text)}</p>${changeChips(previous.changes)}</div>` : ''}
      ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}
      ${title ? `<h2>${esc(title)}</h2>` : ''}
      <p class="${serif ? 'scene' : 'body'}">${esc(body)}</p>
      ${changeChips(changes)}
      <button class="btn primary" data-ok>${esc(button)}</button>`, { tone });
    m.el.querySelector('[data-ok]').addEventListener('click', () => { m.close(); resolve(); });
  });
}

/** @returns {Promise<boolean>} */
export function confirmModal({ title, body, yes = 'Confirm', no = 'Cancel', danger = false, html = '' }) {
  return new Promise((resolve) => {
    const m = openModal(`
      <h2>${esc(title)}</h2>
      <p class="body">${esc(body)}</p>${html}
      <div class="btn-row">
        <button class="btn" data-no>${esc(no)}</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(yes)}</button>
      </div>`, { dismissable: true, back: false, onDismiss: () => resolve(false) });
    m.el.querySelector('[data-no]').addEventListener('click', () => { m.close(); resolve(false); });
    m.el.querySelector('[data-yes]').addEventListener('click', () => { m.close(); resolve(true); });
  });
}

/**
 * A list of options to pick from. Resolves with the chosen value, or null if canceled.
 * @param {{title:string, body?:string, cancel?:string,
 *          options:{value:any, label:string, sub?:string, disabled?:boolean}[]}} o
 */
export function pickModal({ title, body, options, cancel = 'Cancel' }) {
  return new Promise((resolve) => {
    const m = openModal(`
      <h2>${esc(title)}</h2>
      ${body ? `<p class="body">${esc(body)}</p>` : ''}
      ${options.map((o, i) => `
        <button class="choice-btn" data-i="${i}" ${o.disabled ? 'disabled' : ''}>
          ${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}${o.html ?? ''}
        </button>`).join('')}
      <button class="btn" data-cancel style="margin-top:14px">${esc(cancel)}</button>`,
    { dismissable: true, back: false, onDismiss: () => resolve(null) });
    m.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-cancel]')) { m.close(); return resolve(null); }
      const btn = e.target.closest('.choice-btn');
      if (!btn || btn.disabled) return;
      m.close();
      resolve(options[Number(btn.dataset.i)].value);
    });
  });
}

/**
 * Asks for a short piece of text. Resolves the trimmed text, or null if canceled.
 * @param {{title:string, label:string, value?:string, maxLength?:number}} o
 */
export function inputModal({ title, label, value = '', maxLength = 24 }) {
  return new Promise((resolve) => {
    const m = openModal(`
      <h2>${esc(title)}</h2>
      <form novalidate>
        <div class="field"><label for="m-input">${esc(label)}</label>
          <input id="m-input" maxlength="${maxLength}" autocomplete="off" value="${esc(value)}"></div>
        <div class="btn-row">
          <button type="button" class="btn" data-cancel>Cancel</button>
          <button type="submit" class="btn primary">Save</button>
        </div>
      </form>`, { dismissable: true, back: false, onDismiss: () => resolve(null) });
    m.el.querySelector('[data-cancel]').addEventListener('click', () => { m.close(); resolve(null); });
    m.el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = m.el.querySelector('#m-input').value.trim();
      m.close();
      resolve(text || null);
    });
  });
}

/**
 * A short dialog with one choice made from a dropdown, so a long list does not crowd the screen: an emoji and a title,
 * a line of text, "Pick an activity:" and the dropdown, and one button. Resolves the chosen value, or null if left.
 * @param {{eyebrow?:string, emoji?:string, title:string, body?:string, label?:string, button?:string,
 *          options:{value:any, label:string, disabled?:boolean}[]}} o
 */
export function selectModal({ eyebrow, emoji, title, body, label = 'Choose', button = 'Go', options }) {
  return new Promise((resolve) => {
    const first = options.findIndex((o) => !o.disabled);
    const m = openModal(`
      ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}
      <h2 class="pick-title">${emoji ? `<span class="pick-emoji" aria-hidden="true">${emoji}</span>` : ''}${esc(title)}</h2>
      ${body ? `<p class="body pick-body">${esc(body)}</p>` : ''}
      <div class="field pick-field"><label for="m-pick">${esc(label)}</label>
        <select id="m-pick">${options.map((o, i) => `<option value="${i}" ${o.disabled ? 'disabled' : ''} ${i === first ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>
      <button class="btn primary" data-go ${first < 0 ? 'disabled' : ''}>${esc(button)}</button>`,
    { dismissable: true, onDismiss: () => resolve(null) });
    m.el.querySelector('[data-go]').addEventListener('click', () => {
      const i = Number(m.el.querySelector('#m-pick').value);
      m.close();
      resolve(options[i]?.value ?? null);
    });
  });
}
