// The live appearance editor. The same editor is used by the character
// creator (every feature), the in-game salon (styling only) and the avatar
// lab page. Each feature has its own control, the portrait updates on every
// tap, and nothing is saved until the caller's confirm handler runs.
import { CATALOG, normalize, part } from './catalog.js';
import { avatarSvg } from './render.js';
import { randomAppearance, defaultStyle, cloneAppearance } from './inherit.js';
import { rng } from '../rng.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// kind: 'thumb' draws a small portrait for each option; 'swatch' a colour dot;
// 'chip' a word. half: which half of the appearance the key lives in.
// none: the control has a "none" option. multi: several can be on at once.
const CONTROLS = {
  face: { label: 'Face shape', half: 'inherited', kind: 'thumb' },
  skin: { label: 'Skin tone', half: 'inherited', kind: 'swatch', hex: (x) => x.base },
  marks: { label: 'Details', half: 'inherited', kind: 'chip', multi: true },
  eyeShape: { label: 'Eye shape', half: 'inherited', kind: 'thumb' },
  eyeColor: { label: 'Eye colour', half: 'inherited', kind: 'swatch', hex: (x) => x.hex },
  brows: { label: 'Eyebrows', half: 'inherited', kind: 'thumb' },
  nose: { label: 'Nose', half: 'inherited', kind: 'thumb' },
  lips: { label: 'Lip shape', half: 'inherited', kind: 'thumb' },
  hair: { label: 'Hairstyle', half: 'style', kind: 'thumb' },
  hairColor: { label: 'Natural hair colour', half: 'inherited', kind: 'swatch', hex: (x) => x.hex },
  hairTexture: { label: 'Natural hair texture', half: 'inherited', kind: 'chip' },
  hairDye: { label: 'Hair dye', half: 'style', kind: 'swatch', hex: (x) => x.hex, none: 'Natural' },
  glasses: { label: 'Glasses', half: 'style', kind: 'thumb', none: 'None' },
  facialHair: { label: 'Facial hair', half: 'style', kind: 'thumb', none: 'None', minAge: 16 },
  makeup: { label: 'Make-up', half: 'style', kind: 'chip', none: 'None', minAge: 13 },
  lipColor: { label: 'Lip colour', half: 'style', kind: 'swatch', hex: (x) => x.hex, none: 'Natural', minAge: 13 },
};

const TABS = [
  { id: 'face', name: 'Face', keys: ['face', 'skin', 'marks'] },
  { id: 'eyes', name: 'Eyes', keys: ['eyeShape', 'eyeColor', 'brows'] },
  { id: 'features', name: 'Nose and lips', keys: ['nose', 'lips', 'lipColor'] },
  { id: 'hair', name: 'Hair', keys: ['hair', 'hairDye', 'hairColor', 'hairTexture'] },
  { id: 'extras', name: 'Extras', keys: ['glasses', 'facialHair', 'makeup'] },
];

/**
 * Builds the editor inside `el`.
 * @param {HTMLElement} el
 * @param {{appearance?:object, age?:number, gender?:string, seed?:string, scope?:'all'|'style',
 *          onChange?:(appearance:object)=>void}} o
 *   scope 'style' shows only what a salon can change and leaves inherited features alone.
 * @returns {{get:()=>object, set:(a:object)=>void, randomize:()=>void}}
 */
export function mountAppearanceEditor(el, o = {}) {
  const age = o.age ?? 25;
  const seed = o.seed ?? 'editor';
  const scope = o.scope ?? 'all';
  let a = cloneAppearance(normalize(o.appearance, seed));
  const usable = (key) => (scope === 'all' || CONTROLS[key].half === 'style') && age >= (CONTROLS[key].minAge ?? 0);
  const tabs = TABS.map((t) => ({ ...t, keys: t.keys.filter(usable) })).filter((t) => t.keys.length);
  if (scope === 'style') tabs.sort((x, y) => (y.id === 'hair') - (x.id === 'hair')); // a salon starts with the hair
  let tab = tabs[0].id;

  const draw = (appearance, mood = 66) => avatarSvg({ appearance, age, gender: o.gender, seed, mood });
  const withValue = (key, value) => {
    const next = cloneAppearance(a);
    next[CONTROLS[key].half][key] = value;
    return next;
  };

  function control(key) {
    const c = CONTROLS[key];
    const current = a[c.half][key];
    const isOn = (id) => (c.multi ? current.includes(id) : current === id);
    const options = CATALOG[key].map((x) => {
      const on = isOn(x.id) ? 'on' : '';
      if (c.kind === 'swatch') return `<button type="button" class="av-opt av-swatch ${on}" data-key="${key}" data-id="${x.id}" style="background:${c.hex(x)}" aria-label="${esc(x.name)}" title="${esc(x.name)}"></button>`;
      if (c.kind === 'chip') return `<button type="button" class="av-opt av-chip ${on}" data-key="${key}" data-id="${x.id}">${esc(x.name)}</button>`;
      return `<button type="button" class="av-opt av-thumb ${on}" data-key="${key}" data-id="${x.id}" aria-label="${esc(x.name)}" title="${esc(x.name)}">${draw(withValue(key, x.id))}<span>${esc(x.name)}</span></button>`;
    });
    if (c.none) {
      const on = current == null ? 'on' : '';
      options.unshift(c.kind === 'thumb'
        ? `<button type="button" class="av-opt av-thumb ${on}" data-key="${key}" data-id="">${draw(withValue(key, null))}<span>${esc(c.none)}</span></button>`
        : `<button type="button" class="av-opt av-chip ${on}" data-key="${key}" data-id="">${esc(c.none)}</button>`);
    }
    const chosen = c.multi ? '' : part(key, current)?.name ?? c.none ?? '';
    return `<div class="av-control"><div class="av-label"><strong>${esc(c.label)}</strong><span>${esc(chosen)}</span></div>
      <div class="av-options ${c.kind}">${options.join('')}</div></div>`;
  }

  function render() {
    const t = tabs.find((x) => x.id === tab);
    el.innerHTML = `
      <div class="av-editor">
        <div class="av-stage">
          <div class="av-portrait" data-portrait>${draw(a)}</div>
          <button type="button" class="btn small" data-random>Randomize</button>
        </div>
        <div class="av-tabs" role="tablist">${tabs.map((x) => `<button type="button" role="tab" class="av-tab ${x.id === tab ? 'on' : ''}" data-tab="${x.id}">${esc(x.name)}</button>`).join('')}</div>
        <div class="av-panel">${t.keys.map(control).join('')}</div>
      </div>`;
  }

  el.onclick = (e) => {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { tab = tabBtn.dataset.tab; render(); return; }
    if (e.target.closest('[data-random]')) { api.randomize(); return; }
    const opt = e.target.closest('.av-opt');
    if (!opt) return;
    const key = opt.dataset.key;
    const c = CONTROLS[key];
    const id = opt.dataset.id || null;
    if (c.multi) {
      const list = a[c.half][key];
      a[c.half][key] = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    } else a[c.half][key] = id;
    const scroll = el.querySelector('.av-panel')?.scrollTop ?? 0;
    render();
    const panel = el.querySelector('.av-panel');
    if (panel) panel.scrollTop = scroll;
    o.onChange?.(cloneAppearance(a));
  };

  const api = {
    get: () => cloneAppearance(a),
    set: (next) => { a = cloneAppearance(normalize(next, seed)); render(); },
    randomize() {
      if (scope === 'all') a = randomAppearance(undefined, o.gender);
      else {
        a.style = defaultStyle(a.inherited, o.gender);
        if (rng.chance(0.4)) a.style.hairDye = rng.pick(CATALOG.hairDye).id;
        if (rng.chance(0.25)) a.style.glasses = rng.pick(CATALOG.glasses).id;
      }
      render();
      o.onChange?.(cloneAppearance(a));
    },
  };
  render();
  return api;
}

/**
 * Opens the editor over the whole screen and resolves with the confirmed
 * appearance, or null if the player backs out.
 * @param {{title?:string, appearance?:object, age?:number, gender?:string, seed?:string, scope?:'all'|'style',
 *          note?:(appearance:object)=>string, confirm?:string}} o
 *   note: a line shown above the buttons, recomputed on every change (the salon uses it for the bill).
 */
export function openAppearanceEditor(o = {}) {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'av-screen';
    root.innerHTML = `
      <div class="av-sheet" role="dialog" aria-modal="true" aria-label="${esc(o.title ?? 'Appearance')}">
        <h2>${esc(o.title ?? 'Appearance')}</h2>
        <div data-editor></div>
        <p class="av-note muted" data-note></p>
        <div class="btn-row">
          <button type="button" class="btn" data-cancel>Cancel</button>
          <button type="button" class="btn primary" data-confirm>${esc(o.confirm ?? 'Confirm appearance')}</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    const note = root.querySelector('[data-note]');
    const showNote = (a) => { note.textContent = o.note ? o.note(a) : ''; note.hidden = !note.textContent; };
    const editor = mountAppearanceEditor(root.querySelector('[data-editor]'), { ...o, onChange: showNote });
    showNote(editor.get());
    const done = (value) => { root.remove(); resolve(value); };
    root.querySelector('[data-cancel]').addEventListener('click', () => done(null));
    root.querySelector('[data-confirm]').addEventListener('click', () => done(editor.get()));
  });
}
