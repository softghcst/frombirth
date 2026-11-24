// The armed forces from the Work tab (engine/military.js): how to join, with the branch picked from a dropdown, or,
// for someone serving, where they are: branch and rank, years in, when the contract ends, deployments and medals.
import { esc } from '../util.js';
import { player, country } from '../state.js';
import * as mil from '../engine/military.js';
import { openModal, pickModal, selectModal, messageModal } from './modals.js';

const kv = (rows) => rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');

export async function openMilitary(api) {
  const p = player();
  const m = mil.serving(p);
  if (m) {
    const medals = (m.medals ?? []).map((x) => `${x.name} (${x.year})`);
    return new Promise((resolve) => {
      const modal = openModal(`<div class="eyebrow">Service</div><h2>${esc(m.conscript ? 'National service' : 'The armed forces')}</h2>
        ${kv([['Branch', m.branch], ['Rank', p.career.title], ['Serving since', String(m.start ?? '')], [m.conscript ? 'Service ends' : 'Contract ends', String(m.until ?? '')],
    ['Deployments', String(m.deployments ?? 0)], ['Medals', medals.length ? medals.join('; ') : 'None yet'], ...(m.wounds ? [['Wounded', `${m.wounds} time${m.wounds === 1 ? '' : 's'}`]] : [])])}
        <p class="muted" style="margin-top:10px">${m.conscript ? 'National service ends on its own when the time is up.' : 'When the contract ends you choose: sign again, go on to officer training, or leave with an honorable discharge.'}</p>
        <button class="btn primary" data-ok style="width:100%;margin-top:12px">Done</button>`, { dismissable: true, onDismiss: resolve });
      modal.el.querySelector('[data-ok]').addEventListener('click', () => { modal.close(); resolve(); });
    });
  }
  const ways = mil.joinOptions();
  const path = await pickModal({ title: 'Military', body: `Join the armed forces of ${country().name}: a contract of a few years, basic training first, and wherever you are sent.`,
    options: ways.map((w) => ({ value: w.id, label: w.name, sub: w.why || (w.id === 'officer' ? 'With a university degree: lead from the start.' : 'From 18. Train, serve, and rise through the ranks.'), disabled: !!w.why })), cancel: 'Back' });
  if (!path) return undefined;
  const branch = await selectModal({ eyebrow: 'Military', emoji: '🎖️', title: path === 'officer' ? 'Officer training' : 'Enlist', body: 'Which branch will you join?', label: 'Branch', button: path === 'officer' ? 'Apply' : 'Sign up',
    options: mil.branches().map((b) => ({ value: b, label: b })) });
  if (!branch) return undefined;
  const r = mil.join(path, branch);
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
  // Basic training starts at once.
  if (r.ok) await api.pending?.();
  return undefined;
}
