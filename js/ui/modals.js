// Promise-based modals. Scenario modals cannot be dismissed without choosing.
import { esc, fmtMoney } from '../util.js';
import { country } from '../state.js';
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
  const close = () => scrim.remove();
  if (opts.dismissable) {
    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) { close(); opts.onDismiss?.(); }
    });
  }
  root().appendChild(scrim);
  return { el: scrim.firstElementChild, close };
}

/** Shows a scenario and resolves with the index of the chosen option. */
export function eventModal(ev, cast) {
  return new Promise((resolve) => {
    const choices = choiceStates(ev, cast).map((c, i) => `
      <button class="choice-btn" data-i="${i}" ${c.enabled ? '' : 'disabled'}>
        ${esc(renderText(c.label, cast))}
        ${c.enabled ? '' : '<small>Not available to you right now</small>'}
      </button>`).join('');
    const m = openModal(`
      <div class="eyebrow">${esc(ev.category)}</div>
      <p class="scene">${esc(renderText(ev.text, cast))}</p>
      ${choices}`);
    m.el.addEventListener('click', (e) => {
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

/** Shows what happened after a choice. */
export function outcomeModal(result) {
  return messageModal({ body: result.text, tone: result.tone, changes: result.changes, serif: true });
}

/** A single-button notice. */
export function messageModal({ eyebrow, title, body, tone = 'neutral', changes, button = 'Continue', serif }) {
  return new Promise((resolve) => {
    const m = openModal(`
      ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}
      ${title ? `<h2>${esc(title)}</h2>` : ''}
      <p class="${serif ? 'scene' : 'body'}">${esc(body)}</p>
      ${changeChips(changes)}
      <button class="btn primary" data-ok>${esc(button)}</button>`, { tone });
    m.el.querySelector('[data-ok]').addEventListener('click', () => { m.close(); resolve(); });
  });
}

/** @returns {Promise<boolean>} */
export function confirmModal({ title, body, yes = 'Confirm', no = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const m = openModal(`
      <h2>${esc(title)}</h2>
      <p class="body">${esc(body)}</p>
      <div class="btn-row">
        <button class="btn" data-no>${esc(no)}</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(yes)}</button>
      </div>`, { dismissable: true, onDismiss: () => resolve(false) });
    m.el.querySelector('[data-no]').addEventListener('click', () => { m.close(); resolve(false); });
    m.el.querySelector('[data-yes]').addEventListener('click', () => { m.close(); resolve(true); });
  });
}

/**
 * A list of options to pick from. Resolves with the chosen value, or null if cancelled.
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
          ${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}
        </button>`).join('')}
      <button class="btn" data-cancel style="margin-top:14px">${esc(cancel)}</button>`,
    { dismissable: true, onDismiss: () => resolve(null) });
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
 * Asks for a short piece of text. Resolves the trimmed text, or null if cancelled.
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
      </form>`, { dismissable: true, onDismiss: () => resolve(null) });
    m.el.querySelector('[data-cancel]').addEventListener('click', () => { m.close(); resolve(null); });
    m.el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = m.el.querySelector('#m-input').value.trim();
      m.close();
      resolve(text || null);
    });
  });
}
