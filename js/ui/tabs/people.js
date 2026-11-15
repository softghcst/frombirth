// People tab: everyone in your life, with meters and basic interactions.
import { store, player, livingNpcs } from '../../state.js';
import { esc } from '../../util.js';
import { roleLabel, interact, INTERACTIONS } from '../../engine/relationships.js';
import { avatarSvg, petGlyph } from '../avatar.js';
import { meterHtml, band } from '../meter.js';
import { openModal, messageModal } from '../modals.js';
import { TRAIT_BY_ID } from '../../data/traits.js';

const ORDER = ['spouse', 'partner', 'child', 'parent', 'sibling', 'grandparent', 'mentor', 'friend', 'classmate',
  'coworker', 'boss', 'pet', 'ex', 'enemy', 'cellmate'];

const portrait = (npc) => (npc.role === 'pet'
  ? `<div class="avatar glyph">${petGlyph(npc.species)}</div>`
  : `<div class="avatar">${avatarSvg({ age: npc.age, gender: npc.gender, appearance: npc.appearance, seed: npc.id, mood: npc.meters.relationship })}</div>`);

function openNpc(npc, api) {
  const p = player();
  const m = npc.meters;
  const isPet = npc.role === 'pet';
  const meters = isPet
    ? meterHtml('Bond', m.relationship, true) + meterHtml('Health', m.health, true)
    : [['Relationship', m.relationship], ['Money', m.money], ['Intellect', m.intellect],
      ['Charm', m.charm], ['Health', m.health], ['Generosity', m.generosity], ['Crazy', m.crazy]]
      .map(([n, v]) => meterHtml(n, v, true)).join('');
  const detail = npc.occupation ? ` · ${esc(npc.occupation)}` : '';
  const known = (npc.traits ?? []).map((id) => TRAIT_BY_ID[id]).filter(Boolean);
  const traitChips = known.length
    ? `<div class="chips" style="margin-top:10px">${known.map((t) => `<span class="chip">${esc(t.name)}</span>`).join('')}</div>` : '';
  const history = npc.memories?.length
    ? `<div class="section-label" style="margin-top:0">What they remember</div>
       ${npc.memories.map((m) => `<div class="kv"><span>Age ${m.age}</span><span>${esc(m.text)}</span></div>`).join('')}
       <div style="height:14px"></div>` : '';
  const actions = Object.entries(INTERACTIONS).map(([id, a]) =>
    `<button class="btn" data-act="${id}" ${p.age < a.minAge ? 'disabled' : ''}>${esc(a.label)}</button>`).join('');

  const modal = openModal(`
    <div class="row" style="border:0;padding:0;background:none">
      ${portrait(npc)}
      <div class="main"><strong>${esc(npc.firstName)} ${isPet ? '' : esc(npc.lastName)}</strong>
        <small>${esc(roleLabel(npc))} · age ${npc.age}${detail}</small></div>
    </div>
    ${traitChips}
    <div style="margin:12px 0 16px">${meters}</div>
    ${history}
    <div class="btn-stack">${actions}<button class="btn" data-close>Close</button></div>`,
  { dismissable: true });

  modal.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) return modal.close();
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const result = interact(npc.id, btn.dataset.act);
    modal.close();
    if (result.ok) api.changed();
    await messageModal({ body: result.text, tone: result.ok ? 'good' : 'neutral' });
  });
}

export default {
  id: 'people', title: 'People', short: 'People',
  icon: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17.5" cy="9" r="2.4"/><path d="M16.5 14.2c2.6.3 4.5 2.4 4.5 5.3"/>',
  render(el, api) {
    const list = livingNpcs().sort((a, b) =>
      ORDER.indexOf(a.role) - ORDER.indexOf(b.role) || b.age - a.age);
    if (!list.length) {
      el.innerHTML = '<p class="empty">There is nobody in your life right now.</p>';
      return;
    }
    el.innerHTML = list.map((n) => `
      <button class="row" data-npc="${n.id}">
        ${portrait(n)}
        <div class="main"><strong>${esc(n.firstName)} ${n.role === 'pet' ? '' : esc(n.lastName)}</strong>
          <small>${esc(roleLabel(n))} · age ${n.age}</small></div>
        <div class="side">${Math.round(n.meters.relationship)}%
          <div class="mini"><i class="fill ${band(n.meters.relationship)}" style="width:${n.meters.relationship}%"></i></div></div>
      </button>`).join('');
    el.onclick = (e) => {
      const row = e.target.closest('[data-npc]');
      if (row) openNpc(store.state.npcs[row.dataset.npc], api);
    };
  },
};
