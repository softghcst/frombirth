// Planning for university, as a book: the institutions of the country side
// by side, the applications being put together, and each institution's
// answer with its reasons and what it would cost. Rules: engine/university.js.
import { player, country } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import * as uni from '../engine/university.js';
import { MAJOR_BY_ID } from '../data/majors.js';
import { MAX_APPLICATIONS } from '../data/universities.js';
import { openModal, pickModal, messageModal, confirmModal } from './modals.js';

const OUTCOME = { accepted: 'A place', conditional: 'A place, if your marks hold', waitlisted: 'On the waiting list', deferred: 'Asked to apply again next year', rejected: 'No place' };
const TONE = { accepted: 'good', conditional: 'good', waitlisted: 'neutral', deferred: 'neutral', rejected: 'bad' };

function pageCatalog(r) {
  const c = country();
  const major = MAJOR_BY_ID[r.majorId];
  return `<button class="btn ${major ? '' : 'primary'}" data-major style="width:100%;margin-bottom:10px">${major ? `Subject: ${esc(major.name)} <small>change</small>` : 'First, choose what you want to study'}</button>
    <p class="muted" style="margin-bottom:8px">The famous ones are not the best for everyone. Look at what each would cost, and what it is good at.</p>
    ${uni.browse().map((u) => `<div class="card sub-card ${u.chosen ? 'on' : ''}">
      <div class="sub-head"><strong>${esc(u.name)}</strong><span>${esc(u.city)}</span></div>
      <p class="muted">${esc(u.label)}, founded ${u.founded}. ${esc(u.blurb)}</p>
      <div class="kv"><span>Reputation</span><span>${esc(u.reputation)}</span></div>
      <div class="kv"><span>Getting in</span><span>${esc(u.entry)}</span></div>
      <div class="kv"><span>Tuition</span><span>${u.tuition ? `${fmtMoney(u.tuition, c)} a year` : 'None'}</span></div>
      <div class="kv"><span>Living there</span><span>${u.living ? `about ${fmtMoney(u.living, c)} a year` : 'You study from home'}${u.nearHome ? ' · or live at home' : ''}</span></div>
      ${major ? `<div class="kv"><span>For ${esc(major.name)}</span><span>${u.strong ? 'Known for it' : 'Taught, not famous for it'}</span></div><div class="kv"><span>Your chances</span><span><strong>${esc(u.chances)}</strong></span></div>` : ''}
      ${u.family.length ? `<p class="dyn-reach">${esc(u.family.join(', '))} studied here.</p>` : ''}
      ${r.sent ? '' : `<button class="btn" data-pick="${u.id}" ${major && u.taught ? '' : 'disabled'}>${u.chosen ? 'Take off your list' : 'Add to your applications'}</button>`}</div>`).join('')}`;
}

function pageApplying(r) {
  const major = MAJOR_BY_ID[r.majorId];
  if (r.sent) return '<p class="muted">Your applications have gone. The answers are on the next page.</p>';
  const chosen = uni.browse().filter((u) => u.chosen);
  const st = uni.statements().find((s) => s.id === r.statement);
  return `<div class="kv"><span>Subject</span><span>${major ? esc(major.name) : 'Not chosen'}</span></div>
    <div class="kv"><span>Places</span><span>${chosen.length} of ${MAX_APPLICATIONS}</span></div>
    ${chosen.map((u) => `<div class="kv"><span>${esc(u.name)}</span><span>${esc(u.chances)}</span></div>`).join('') || '<p class="muted">Add places from the first page. A mix is wise: one you dream of, some you expect, one you are sure of.</p>'}
    <div class="section-label">Your personal statement</div>
    <p class="muted">${st ? esc(st.name) : 'Not written yet.'}</p>
    <button class="btn" data-statement style="width:100%">${st ? 'Rewrite it' : 'Write it'}</button>
    <button class="btn primary" data-send style="width:100%;margin-top:14px" ${major && chosen.length ? '' : 'disabled'}>Send your applications</button>
    <p class="muted" style="margin-top:8px">${player().education.enrolled ? 'You are still at school, so offers will depend on your final marks.' : 'You have your results, so answers are final.'} One round a year.</p>`;
}

function pageAnswers(r) {
  const c = country();
  const list = uni.answers();
  if (!list.length) return '<p class="muted">Nothing has been sent yet.</p>';
  return list.map((a) => `<div class="card sub-card tone-${TONE[a.outcome]}">
    <div class="sub-head"><strong>${esc(a.name)}</strong><span>${esc(a.city)}</span></div>
    <p><strong>${OUTCOME[a.outcome]}</strong>${a.outcome === 'conditional' ? `: you need ${esc(a.conditionText)} or better.` : ''}${a.held ? ' Held for a year.' : ''}</p>
    ${(a.reasons ?? []).map((t) => `<p class="muted">${esc(t)}</p>`).join('')}
    ${a.outcome === 'accepted' || a.outcome === 'conditional' ? `<div class="kv"><span>Tuition</span><span>${a.tuition ? `${fmtMoney(a.tuition, c)} a year` : 'None'}</span></div>
      ${a.aidText ? `<div class="kv"><span>Help offered</span><span>${esc(a.aidText[0].toUpperCase() + a.aidText.slice(1))}</span></div><div class="kv"><span>You would pay</span><span><strong>${fmtMoney(a.net, c)} a year</strong></span></div>${a.aid.keep ? '<p class="muted">The scholarship lasts while your marks stay up.</p>' : ''}` : a.tuition ? '<p class="muted">No help with the cost was offered.</p>' : ''}
      <div class="kv"><span>Living there</span><span>${a.living ? `about ${fmtMoney(a.living, c)} a year` : 'From home'}${a.aid?.housing ? ' · a room is included' : ''}</span></div>` : ''}
    ${a.canAccept ? `<button class="btn primary" data-accept="${a.instId}">Take this place</button>` : ''}
    ${a.canHold ? `<button class="btn" data-hold="${a.instId}">Ask them to keep it for a year</button>` : ''}
    ${a.canAppeal ? `<button class="btn" data-appeal="${a.instId}">Ask them to look again</button>` : ''}</div>`).join('')
    + (list.some((a) => a.outcome === 'conditional') ? '<p class="muted">Conditional places are confirmed or withdrawn when your final marks come in.</p>' : '');
}

/**
 * Opens the planner.
 * @param {{changed:Function}} api
 * @param {{funding:Function, housing:Function}} ask  the funding and housing pickers the Work tab already has
 */
export function openUniversity(api, ask) {
  const tabs = [['catalog', 'Places'], ['applying', 'Applying'], ['answers', 'Answers']];
  let tab = uni.plan()?.sent ? 'answers' : 'catalog';
  const m = openModal(`
    <div class="dyn-head"><div><div class="eyebrow">Education</div><h2>University</h2></div>
      <button class="icon-btn" data-close aria-label="Close">✕</button></div>
    <div class="dyn-tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" data-tab="${id}">${label}</button>`).join('')}</div>
    <div class="dyn-body" data-body></div>`, { dismissable: true });
  m.el.classList.add('dyn-modal');
  const body = m.el.querySelector('[data-body]');
  function draw(keep = false) {
    const r = uni.plan();
    const top = body.scrollTop;
    m.el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    body.innerHTML = !r ? '<p class="muted">There is nothing to plan just now.</p>' : tab === 'catalog' ? pageCatalog(r) : tab === 'applying' ? pageApplying(r) : pageAnswers(r);
    body.scrollTop = keep ? top : 0;
  }
  const say = async (r) => { api.changed(); await messageModal({ body: r.text, tone: r.tone }); };
  m.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) return m.close();
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; return draw(); }
    if (e.target.closest('[data-major]')) {
      const id = await pickModal({ title: 'What do you want to study?', cancel: 'Back', body: 'One subject for the whole round. Some are entered by audition, not marks.',
        options: uni.majorsOpen().map((x) => ({ value: x.id, label: x.name, sub: x.audition ? 'By audition.' : '' })) });
      if (id) { const r = uni.setMajor(id); if (!r.ok) await say(r); api.changed(); }
      return draw();
    }
    const pick = e.target.closest('[data-pick]');
    if (pick) { const r = uni.toggle(pick.dataset.pick); if (!r.ok) await say(r); api.changed(); return draw(true); }
    if (e.target.closest('[data-statement]')) {
      const id = await pickModal({ title: 'Your personal statement', cancel: 'Back', body: 'One page to say who you are. It counts for a little, everywhere.', options: uni.statements().map((s) => ({ value: s.id, label: s.name, sub: s.sub })) });
      if (id) { uni.setStatement(id); api.changed(); }
      return draw(true);
    }
    if (e.target.closest('[data-send]')) {
      if (!(await confirmModal({ title: 'Send them?', body: 'You can apply once a year, and nothing can be changed afterward.', yes: 'Send' }))) return undefined;
      await say(uni.send());
      tab = 'answers';
      return draw();
    }
    const appeal = e.target.closest('[data-appeal]');
    if (appeal) { await say(uni.appeal(appeal.dataset.appeal)); return draw(true); }
    const hold = e.target.closest('[data-hold]');
    if (hold) { await say(uni.hold(hold.dataset.hold)); return draw(true); }
    const accept = e.target.closest('[data-accept]');
    if (accept) {
      const a = uni.answers().find((x) => x.instId === accept.dataset.accept);
      const free = a.net === 0;
      const funding = free ? 'scholarship' : await ask.funding(api, a.net, 4, { scholarship: null });
      if (!funding) return undefined;
      const living = await ask.housing(!!a.aid?.housing) ?? {};
      const r = uni.accept(a.instId, funding, living);
      await say(r);
      if (r.ok) m.close();
      return undefined;
    }
    return undefined;
  });
  draw();
}
