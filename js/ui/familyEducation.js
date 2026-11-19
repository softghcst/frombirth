// The family's education across generations: who went where, what they
// earned, and who taught them. Data from engine/edlegacy.js.
import { esc } from '../util.js';
import { openModal } from './modals.js';
import { familyRecord } from '../engine/edlegacy.js';

const person = (r, label) => `
  <div class="card" style="margin-bottom:10px">
    <div class="section-label" style="margin-top:0">${esc(label)}</div>
    <strong>${esc(r.name)}</strong> <small class="muted">born ${r.born}${r.died ? `, died ${r.died}` : ''}</small>
    ${r.schools.length ? `<div class="kv"><span>Schools</span><span>${esc(r.schools.join(', '))}</span></div>` : ''}
    ${r.degrees.filter((d) => d.type !== 'high').map((d) => `<div class="kv"><span>${d.year}</span><span>${esc(d.label)}</span></div>`).join('')}
    ${r.degrees.some((d) => d.type === 'high') ? '' : '<div class="kv"><span>School</span><span>Left without a qualification</span></div>'}
    ${r.first ? '<div class="kv"><span>First</span><span>The first in the family to graduate from university</span></div>' : ''}
    ${r.mentor ? `<div class="kv"><span>Remembered</span><span>${esc(r.mentor)}</span></div>` : ''}
    ${r.honors.length ? `<p class="muted" style="margin:6px 0 0">${r.honors.map(esc).join(' ')}</p>` : ''}
  </div>`;

export function openFamilyEducation() {
  const { past, mine, kids } = familyRecord();
  const gens = [...past, mine];
  const modal = openModal(`
    <h2 style="margin-top:0">Family schooling</h2>
    
    ${gens.map((r) => person(r, r.current ? 'You' : `Generation ${r.gen}`)).join('')}
    ${kids.length ? `<div class="card"><div class="section-label" style="margin-top:0">Your children</div>
      ${kids.map((k) => `<div class="kv"><span>${esc(k.name)}, ${k.age}</span><span>${esc([k.schools.slice(-1)[0], k.uni].filter(Boolean).join('; ') || (k.age < 5 ? 'Not at school yet' : '—'))}</span></div>`).join('')}</div>` : ''}
    <div class="btn-stack" style="margin-top:12px"><button class="btn" data-close>Close</button></div>`, { dismissable: true });
  modal.el.querySelector('[data-close]').onclick = () => modal.close();
}
