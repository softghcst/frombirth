// The World Explorer: browse every place you can live, search by name, city,
// language or currency, read a place's profile, and compare two. Opened from
// the title screen, the life designer and the Self tab. All of it is read
// from engine/world.js, so it always agrees with the rest of the game.
import { esc } from '../util.js';
import { openModal } from './modals.js';
import * as world from '../engine/world.js';
import { GROUPS } from '../data/world.js';

const kv = (rows) => rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
const card = (c) => `<button type="button" class="row world-row" data-place="${c.id}" aria-label="${esc(c.name)}">
  <div class="world-flag" aria-hidden="true">${c.flag}</div>
  <div class="main"><strong>${esc(c.name)}</strong><small>${esc(c.place.type === 'country' ? '' : `${c.place.typeLabel} · `)}${esc(c.currency.code)} · ${esc(c.place.languages.slice(0, 2).join(', '))}</small></div>
</button>`;

/**
 * @param {{choose?:string, onChoose?:(id:string)=>void, start?:string, home?:string}} [o]
 *   choose: label for a button on each profile (e.g. "Be born here"); onChoose gets the place id.
 *   start: open straight on this place. home: the place to offer comparisons against.
 */
export function openWorld(o = {}) {
  let group = 'All';
  let query = '';
  let open = o.start ?? null;
  let versus = null;
  const modal = openModal('<div data-world></div>', { dismissable: true });
  const root = modal.el.querySelector('[data-world]');
  modal.el.classList.add('world-modal');

  const list = () => {
    const found = world.search(query).filter((c) => group === 'All' || c.place.group === group);
    // Places whose own name matches come first; then those found by a city, language or currency.
    const q = query.trim().toLowerCase();
    const byName = (c) => (q && c.name.toLowerCase().includes(q) ? 0 : 1);
    const sorted = [...found].sort((a, b) => byName(a) - byName(b) || a.name.localeCompare(b.name));
    return `
      <h2 style="margin-top:0">The world</h2>
      <input type="search" class="world-search" placeholder="Search a country, city, language or currency" value="${esc(query)}" aria-label="Search places" data-search>
      <div class="world-groups" role="group" aria-label="Region">${['All', ...GROUPS].map((g) => `<button type="button" class="av-chip world-group ${g === group ? 'on' : ''}" data-group="${esc(g)}" aria-pressed="${g === group}">${esc(g)}</button>`).join('')}</div>
      <p class="muted" style="margin:6px 0">${sorted.length} ${sorted.length === 1 ? 'place' : 'places'}</p>
      <div class="world-list">${sorted.map(card).join('') || '<p class="empty">Nowhere matches that.</p>'}</div>
      <div class="btn-stack" style="margin-top:12px"><button type="button" class="btn" data-close>Close</button></div>`;
  };

  const page = (id) => {
    const p = world.profile(id);
    const cmp = versus && versus !== id ? world.compare(id, versus) : null;
    return `
      <button type="button" class="btn small" data-back>← All places</button>
      <div class="world-head"><div class="world-flag big" aria-hidden="true">${p.flag}</div>
        <div><h2 style="margin:0">${esc(p.name)}</h2><p class="muted" style="margin:0">${esc(p.typeLabel)}</p></div></div>
      ${p.status ? `<p class="world-status">${esc(p.status)}</p>` : ''}
      ${o.choose ? `<div class="btn-stack" style="margin:10px 0"><button type="button" class="btn primary" data-choose="${id}">${esc(o.choose)}</button></div>` : ''}
      ${cmp ? `<div class="card"><h3>Compared with ${esc(cmp.b.name)}</h3>
        <div class="world-compare"><span></span><strong>${esc(cmp.a.name)}</strong><strong>${esc(cmp.b.name)}</strong>
          ${cmp.rows.map(([k, x, y]) => `<span>${esc(k)}</span><span>${esc(x)}</span><span>${esc(y)}</span>`).join('')}</div>
        <p class="muted" style="margin-top:6px">Neither is better: it depends on the life.</p></div>` : ''}
      <div class="card"><h3>About the place</h3>${kv(p.reference)}${p.checks.length ? `<details style="margin-top:8px"><summary class="muted">How this was checked</summary>${kv(p.checks)}</details>` : ''}</div>
      <div class="card"><h3>Cities you can live in</h3>${kv(p.cityLines)}<p class="muted" style="margin-top:6px">Compared with the country as a whole. Rough estimates for play.</p></div>
      <div class="card"><h3>Living here</h3>${kv(p.game)}</div>
      <div class="card"><h3>School</h3>${kv(p.school)}</div>
      <div class="card"><h3>Government</h3>${kv(p.politics)}</div>
      <div class="card"><h3>The law</h3>${kv(p.laws)}${p.lawChecks.length ? `<details style="margin-top:8px"><summary class="muted">How the law was checked</summary>${kv(p.lawChecks)}</details>` : ''}${p.lawChanges.length ? `<div class="section-label">Changed in your world</div>${p.lawChanges.map((n) => `<p style="margin:4px 0">${esc(n)}</p>`).join('')}` : ''}</div>
      ${p.yourWorld ? `<div class="card"><h3>In your world</h3>${kv(p.yourWorld.lines) || '<p class="muted">Nothing of note yet.</p>'}
        ${p.yourWorld.news.length ? `<div class="section-label">Recently</div>${p.yourWorld.news.map((n) => `<p style="margin:4px 0">${esc(n)}</p>`).join('')}` : ''}
        <p class="muted" style="margin-top:6px">This part is the story of your game, not the real world.</p></div>` : ''}
      <p class="muted world-notes">${p.notes.map(esc).join(' ')}</p>
      <div class="btn-stack" style="margin-top:10px">
        ${o.home && o.home !== id ? `<button type="button" class="btn" data-versus="${o.home}">${versus === o.home ? 'Hide the comparison' : 'Compare with where you live'}</button>` : ''}
        <button type="button" class="btn" data-close>Close</button>
      </div>`;
  };

  const render = () => {
    root.innerHTML = open ? page(open) : list();
    if (!open) {
      const input = root.querySelector('[data-search]');
      input.addEventListener('input', () => {
        query = input.value;
        const at = input.selectionStart;
        render();
        const again = root.querySelector('[data-search]');
        again.focus();
        again.setSelectionRange(at, at);
      });
    }
    modal.el.scrollTop = 0;
  };
  root.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-close]')) return modal.close();
    if (t.closest('[data-back]')) { open = null; versus = null; return render(); }
    const g = t.closest('[data-group]');
    if (g) { group = g.dataset.group; return render(); }
    const pl = t.closest('[data-place]');
    if (pl) { open = pl.dataset.place; return render(); }
    const v = t.closest('[data-versus]');
    if (v) { versus = versus ? null : v.dataset.versus; return render(); }
    const ch = t.closest('[data-choose]');
    if (ch) { modal.close(); o.onChoose?.(ch.dataset.choose); }
    return undefined;
  });
  render();
  return modal;
}
