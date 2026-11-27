// My Origins (People → More): an adopted character's story, as far as they know it. Shows only what the character has
// learned (engine/origins.js originsView); nobody in the birth family is named before they are found.
import { store } from '../state.js';
import { esc } from '../util.js';
import * as org from '../engine/origins.js';
import { openModal, messageModal, pickModal } from './modals.js';
import { navRow, navGroup, lockedRow } from './kit.js';

const kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><span>${esc(v)}</span></div>`;
const card = (title, html, attr = '') => (html ? `<div class="card origins-card" ${attr}><h3>${esc(title)}</h3>${html}</div>` : '');

/** The row on People → More: shown for adopted characters (greyed until they know). */
export function originsRow() {
  if (!org.isAdoptee()) return null;
  const v = org.originsView();
  return v.aware ? navRow({ attrs: 'data-top="origins"', label: 'My Origins', sub: v.kindLine, ico: 'tree' }) : lockedRow('My Origins', v.why, 'tree');
}

/**
 * @param {{changed:Function, pending?:Function}} api
 * @param {(npc:object) => void} [openPerson]  opens someone's profile (People tab)
 */
export function openOrigins(api, openPerson) {
  const m = openModal('<div data-origins></div>', { dismissable: true, full: true, title: 'My Origins' });
  const el = m.el.querySelector('[data-origins]');
  const draw = () => {
    const v = org.originsView();
    if (!v) { el.innerHTML = '<p class="empty">There is nothing on file.</p>'; return; }
    if (!v.aware) { el.innerHTML = `<h2>My Origins</h2><p class="body muted">${esc(v.why)}</p>`; return; }
    const acts = org.originActions();
    const kidActs = acts.filter((a) => ['talkParents', 'askStory', 'photos', 'askBirth', 'heritage', 'trusted', 'childLetter'].includes(a.id));
    const searchActs = acts.filter((a) => !kidActs.includes(a));
    const actRows = (list) => navGroup(list.map((a) => (a.why ? lockedRow(a.label, a.why, 'sparkle') : navRow({ attrs: `data-act="${a.id}"`, label: a.label, sub: a.sub, ico: 'sparkle' }))));
    el.innerHTML = `
      <h2>My Origins</h2>
      <p class="body muted" data-kind>${esc(v.kindLine)}</p>
      ${card('My Story', v.story.map(([k, val]) => kv(k, val)).join(''), 'data-sec="story"')}
      ${card('Adoptive Family', v.family.map((f) => `<button class="kv kv-btn" data-person="${f.id}"><span>${esc(f.role)}</span><span>${esc(f.name)}${f.alive ? '' : ' (died)'}</span></button>`).join('') || '<p class="muted">Nobody on record.</p>', 'data-sec="family"')}
      ${card('What I Know', v.known.length ? `<ul class="origins-facts">${v.known.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="muted">Not much yet.</p>', 'data-sec="know"')}
      ${card('Birth Family', v.birth.map((b) => (b.id
    ? `<button class="kv kv-btn" data-kin="${b.id}"><span>${esc(b.label)}</span><span>${esc(b.name)}${b.note ? `<small class="muted"> · ${esc(b.note)}</small>` : ''}</span></button>`
    : `<div class="kv"><span>${esc(b.label)}</span><span class="muted">${esc(b.name)}</span></div>`)).join(''), 'data-sec="birth"')}
      ${card('Talk and Learn', actRows(kidActs), 'data-sec="learn"')}
      ${card('Search', `${kv('Search', v.search.status)}${kv('Curiosity', v.search.curiosity)}${v.search.pending.length ? kv('Waiting on', v.search.pending.join(', ')) : ''}
        <p class="muted" style="margin:8px 0">${esc(v.search.access)}</p>${actRows(searchActs)}`, 'data-sec="search"')}
      ${card('Messages & Contact', v.messages.length ? v.messages.map((x) => kv(String(x.year), x.text)).join('') : '<p class="muted">No messages yet.</p>', 'data-sec="messages"')}
      ${card('Family Connections', v.connections.length ? v.connections.map((c) => `<button class="kv kv-btn" data-kin="${c.id}"><span>${esc(c.label)}</span><span>${esc(c.name)} <small class="muted">· ${esc(c.status)}</small></span></button>`).join('') : '<p class="muted">Nobody from your birth family is in your life right now.</p>', 'data-sec="connections"')}
      ${card('Memories', v.memories.length ? v.memories.map((x) => kv(`Age ${x.age}`, x.text)).join('') : '', 'data-sec="memories"')}`;
  };
  draw();
  el.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act) {
      const r = org.doOriginAction(act);
      api.changed?.();
      await messageModal({ body: r.text, tone: r.tone });
      if (store.state.pendingEvents.length) await api.pending?.();
      return draw();
    }
    const kin = e.target.closest('[data-kin]')?.dataset.kin;
    if (kin) {
      const n = store.state.npcs[kin];
      const opts = org.relativeActions(kin).map((a) => ({ value: a.id, label: a.label, sub: a.why, disabled: !!a.why }));
      if (store.state.player.npcIds.includes(kin) && openPerson) opts.unshift({ value: 'profile', label: 'See their profile' });
      const pick = await pickModal({ title: org.knownName(n).replace(/^./, (c) => c.toUpperCase()), body: org.birthLabel(n), options: opts.length ? opts : [{ value: null, label: 'Nothing to do now', disabled: true }], cancel: 'Back' });
      if (!pick) return undefined;
      if (pick === 'profile') { m.close(); return openPerson(n); }
      const r = org.doRelativeAction(kin, pick);
      api.changed?.();
      await messageModal({ body: r.text, tone: r.tone });
      return draw();
    }
    const person = e.target.closest('[data-person]')?.dataset.person;
    if (person && openPerson) { m.close(); return openPerson(store.state.npcs[person]); }
    return undefined;
  });
  return m;
}
