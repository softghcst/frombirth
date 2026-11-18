// Family tree: every relative, living or dead, laid out by generation.
// Children sit under their parents, with partners shown alongside.
import { store, player } from '../state.js';
import { esc } from '../util.js';
import { roleLabel } from '../engine/relationships.js';
import { openModal } from './modals.js';

const all = () => player().npcIds.map((id) => store.state.npcs[id]).filter(Boolean);

function line(npc, depth, extra = '') {
  const gone = !npc.alive;
  const job = npc.alive && npc.occupation ? ` · ${esc(npc.occupation)}` : '';
  return `<button class="tree-row ${gone ? 'gone' : ''}" style="padding-left:${12 + depth * 18}px" data-tree="${npc.id}">
    <strong>${gone ? '† ' : ''}${esc(npc.firstName)} ${esc(npc.lastName)}</strong>
    <small>${esc(roleLabel(npc))} · ${gone ? `died at ${npc.age}` : `age ${npc.age}`}${job}${extra}</small>
  </button>`;
}

/** A person, their partner, and everyone descended from them. */
function branch(npc, depth, people) {
  const love = people.find((n) => n.role === 'inlaw' && n.flags.partnerOf === npc.id);
  const kids = people.filter((n) => n.parentIds?.includes(npc.id) && n.role !== 'child')
    .sort((a, b) => b.age - a.age);
  return line(npc, depth)
    + (love ? line(love, depth, '') : '')
    + kids.map((k) => branch(k, depth + 1, people)).join('');
}

const section = (title, html) => (html ? `<div class="section-label">${esc(title)}</div>${html}` : '');

/**
 * @param {(npc:object) => void} onPick  called when a relative is tapped
 */
export function openFamilyTree(onPick, onHistory) {
  const p = player();
  const people = all();
  const of = (role) => people.filter((n) => n.role === role).sort((a, b) => b.age - a.age);
  const loves = people.filter((n) => ['spouse', 'partner'].includes(n.role) || (n.role === 'ex' && n.flags.wasSpouse));

  const you = `<div class="tree-row you" style="padding-left:12px"><strong>${esc(p.firstName)} ${esc(p.lastName)}</strong><small>You · age ${p.age}</small></div>`;
  const html = [
    section('Grandparents', of('grandparent').map((n) => line(n, 0)).join('')),
    section('Parents', of('parent').map((n) => line(n, 0)).join('')),
    section('Your generation', you + loves.map((n) => line(n, 0)).join('') + of('sibling').map((n) => branch(n, 0, people)).join('')),
    section('Your children and their families', of('child').map((n) => branch(n, 0, people)).join('')),
  ].join('');

  const m = openModal(`
    <h2>Family tree</h2>
    <p class="body muted">Tap anyone to see their life.</p>
    <div class="tree">${html || '<p class="empty">You have no family on record.</p>'}</div>
    ${onHistory ? '<button class="btn" data-history style="margin-top:14px">Family medical history</button>' : ''}
    <button class="btn" data-close style="margin-top:14px">Close</button>`, { dismissable: true });
  m.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return m.close();
    if (e.target.closest('[data-history]')) { m.close(); return onHistory(); }
    const id = e.target.closest('[data-tree]')?.dataset.tree;
    if (!id) return undefined;
    m.close();
    return onPick(store.state.npcs[id]);
  });
}
