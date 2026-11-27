// Foster and kinship care, for the carer (engine/fostering.js): becoming approved, a child the agency asks about,
// the children placed with you and the plan for each, and those who have moved on. Not a list of children to choose
// from: the agency asks, one child at a time, and the plan is decided at reviews.
import { esc } from '../util.js';
import { store, player } from '../state.js';
import { openModal, messageModal, confirmModal } from './modals.js';
import * as F from '../engine/fostering.js';

const npc = (id) => store.state.npcs[id] ?? null;
const STATUS = { none: 'Not a foster carer', applying: 'Application in progress', approved: 'Approved foster carer', declined: 'Application declined', closed: 'No longer fostering' };
const GOAL = { reunification: 'Going home to their family', permanency: 'A permanent home' };
const OUTCOME = { reunified: 'Went home', guardianship: 'You became their guardian', adopted: 'Adopted', 'aged out': 'Turned 18', ended: 'Ended' };

function body() {
  const f = F.fostering();
  const p = player();
  const block = F.applyBlock(p);
  const ref = F.pendingReferral();
  const kv = (rows) => rows.map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('');
  const steps = f.status === 'applying' ? kv([['Training', f.steps.training ? 'Done' : 'This year'], ['Background check', f.steps.background ? 'Done' : 'This year'], ['Home study', f.steps.home ? 'Done' : 'This year']]) : '';
  const active = F.activePlacements().map((pl) => {
    const k = npc(pl.childId);
    if (!k) return '';
    const last = pl.reviews.at(-1);
    const acts = [];
    if (pl.goal === 'permanency') acts.push(`<button class="btn small" data-guardian="${k.id}">Become their guardian</button>`);
    if (pl.rights === 'ended') acts.push(`<button class="btn small" data-adopt="${k.id}">Adopt</button>`);
    return `<div class="card" style="margin-top:10px"><h3>${esc(k.firstName)} ${esc(k.lastName)}, ${k.age}</h3>
      ${kv([['Care', pl.kind === 'kinship' ? 'Kinship care: family' : `Foster care, through ${pl.agency}`], ['With you since', String(pl.start)], ['The plan', GOAL[pl.goal] ?? pl.goal],
        ['Their parents', pl.rights === 'ended' ? 'Rights ended by a court' : 'Still their legal parents'], ['Family contact', pl.contact === 'visits' ? 'Visits' : 'Regular contact'],
        ['Your authority', 'Day-to-day care'], ['What helps', k.flags.needs ?? '—']])}
      ${last ? `<p class="muted" style="margin-top:6px">Last review (${last.year}): ${esc(last.said)}</p>` : '<p class="muted" style="margin-top:6px">The first review is a year in.</p>'}
      ${acts.length ? `<div class="btn-row" style="margin-top:8px">${acts.join('')}</div>` : ''}</div>`;
  }).join('');
  const past = F.placements().filter((x) => x.status !== 'active').map((pl) => { const k = npc(pl.childId); return k ? `<div class="kv"><span>${esc(k.firstName)} ${esc(k.lastName)}</span><span>${pl.start}–${pl.end} · ${esc(OUTCOME[pl.status] ?? pl.status)}</span></div>` : ''; }).join('');
  const kin = F.kinNeeding().map((k) => `<div class="kv"><span>${esc(k.firstName)} ${esc(k.lastName)}, ${k.age}: no parent able to care for them</span><span><button class="btn small" data-kin="${k.id}">Take them in</button></span></div>`).join('');
  return `
    <div class="eyebrow">Family</div><h2>Fostering</h2>
    <p class="body">Foster carers give a child a home while their own family cannot. Most children go home in time; the plan is decided by the agency and a court at reviews, with the child's family, not by the carer.${F.simplified() ? ' How fostering works differs by country; this is a simplified version.' : ''}</p>
    <div class="card">${kv([['Status', STATUS[f.status] ?? f.status], ...(f.status === 'declined' && f.declinedWhy ? [['Why', f.declinedWhy]] : [])])}${steps}
      ${block ? `<p class="muted" style="margin-top:8px">${esc(block)}</p>` : '<button class="btn primary" data-apply style="margin-top:10px;width:100%">Apply to foster</button>'}</div>
    ${ref ? `<div class="card" style="margin-top:10px"><h3>The agency is asking</h3><p class="body">${esc(ref.child.firstName)}, ${ref.child.age}, needs a home: ${esc(F.REASONS[ref.reason]?.line ?? '')}.</p>
      <div class="btn-row"><button class="btn" data-ref="no">Not this time</button><button class="btn primary" data-ref="yes">Say yes</button></div></div>` : ''}
    ${kin ? `<div class="section-label">Family who need a home</div>${kin}` : ''}
    ${active ? `<div class="section-label">Living with you</div>${active}` : ''}
    ${past ? `<div class="section-label">Children who lived with you</div>${past}` : ''}
    <button class="btn" data-close style="margin-top:14px;width:100%">Close</button>`;
}

/** Opens the fostering screen. api: the tab api ({ changed }). */
export function openFostering(api) {
  const m = openModal('<div data-foster></div>', { dismissable: true });
  const root = m.el.querySelector('[data-foster]');
  const draw = () => { root.innerHTML = body(); };
  const say = async (r) => { api.changed(); await messageModal({ body: r.text, tone: r.tone }); draw(); };
  root.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-close]')) return m.close();
    if (t.closest('[data-apply]')) {
      if (await confirmModal({ title: 'Apply to foster?', body: 'A year of training evenings, a background check and a home study. Then the agency decides.', yes: 'Apply' })) await say(F.applyToFoster());
      return undefined;
    }
    const ref = t.closest('[data-ref]')?.dataset.ref;
    if (ref) return say(F.answerReferral(ref === 'yes'));
    const g = t.closest('[data-guardian]')?.dataset.guardian;
    if (g && await confirmModal({ title: 'Become their guardian?', body: 'You would have legal responsibility for them until they are grown. Their parents stay their parents, and they keep their name.', yes: 'Ask the court' })) return say(F.becomeGuardian(g));
    const a = t.closest('[data-adopt]')?.dataset.adopt;
    if (a && await confirmModal({ title: 'Adopt?', body: 'Adoption makes you their parent in law, for good. An older child is asked, and can say no.', yes: 'Apply to adopt' })) return say(F.adoptFromCare(a));
    const k = t.closest('[data-kin]')?.dataset.kin;
    if (k) return say(F.takeInKin(k));
    return undefined;
  });
  draw();
  return m;
}
