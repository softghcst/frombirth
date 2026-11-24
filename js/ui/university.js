// Planning for university, as a book: the institutions of the country side
// by side, the applications being put together, and each institution's
// answer with its reasons and what it would cost. Rules: engine/university.js.
import { fitBars } from './fitBars.js';
import { player, country } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import * as uni from '../engine/university.js';
import { MAJOR_BY_ID } from '../data/majors.js';
import { MAX_COMPARE } from '../data/universities.js';
import { openModal, pickModal, messageModal, confirmModal } from './modals.js';

const OUTCOME = { accepted: 'A place', conditional: 'A place, if your marks hold', waitlisted: 'On the waiting list', deferred: 'Asked to apply again next year', rejected: 'No place' };
const TONE = { accepted: 'good', conditional: 'good', waitlisted: 'neutral', deferred: 'neutral', rejected: 'bad' };

const FIT_CLASS = { Reach: 'bad', Match: 'neutral', Safety: 'good' };
const ratePhrase = (x) => (x == null ? '' : x >= 0.995 ? 'Open to all' : `about ${Math.max(1, Math.round(x * 100))}% of applicants are offered a place`);
const triesLine = (u) => (u.attempts ? `You have applied here ${u.attempts} ${u.attempts === 1 ? 'time' : 'times'}.${u.audition ? ' Coming back better prepared is common, and panels notice.' : ''}` : '');

function pageCatalog(r, ui) {
  const c = country();
  const major = MAJOR_BY_ID[r.majorId];
  const list = uni.shortlist({ all: ui.showAll });
  const more = list.total - list.shown;
  const max = uni.maxApplications(r.majorId);
  return `<button class="btn ${major ? '' : 'primary'}" data-major style="width:100%;margin-bottom:10px">${major ? `Subject: ${esc(major.name)} <small>change</small>` : 'First, choose what you want to study'}</button>
    ${major ? `<p class="muted" style="margin-bottom:8px">${ui.showAll ? `All ${list.total} places that teach ${esc(major.name)}` : `The top ${list.shown} of ${list.total} places for ${esc(major.name)}`}, best first. You can apply to ${max}.${major.audition ? ' Audition courses are won in the room: being turned away is common, and many who are accepted tried more than once.' : ''}</p>` : ''}
    ${ui.compare.size >= 2 ? `<button class="btn primary" data-compare style="width:100%;margin-bottom:10px">Compare ${ui.compare.size} places side by side</button>` : ui.compare.size === 1 ? '<p class="muted" style="margin-bottom:8px">Pick one more place to compare.</p>' : ''}
    ${list.rows.map((u) => `<div class="card sub-card ${u.chosen ? 'on' : ''}">
      <div class="sub-head"><strong>${major ? `<span class="muted">#${u.rank}</span> ` : ''}${esc(u.name)}</strong><span>${esc(u.city)}</span></div>
      ${u.fit ? `<p style="margin:2px 0 6px"><span class="chip ${FIT_CLASS[u.fit]}">${esc(u.fit)} for you</span>${u.private ? ' <span class="chip">Private, costly</span>' : ''}</p>` : ''}
      <p class="muted">${esc(u.label)}, founded ${u.founded}. ${esc(u.blurb)}</p>
      <div class="kv"><span>Reputation</span><span>${esc(u.reputation)}</span></div>
      <div class="kv"><span>Getting in</span><span>${esc(u.entry)}${u.acceptance != null ? ` · ${esc(ratePhrase(u.acceptance))}` : ''}</span></div>
      <div class="kv"><span>Tuition</span><span>${u.tuition ? `${fmtMoney(u.tuition, c)} a year` : 'None'}</span></div>
      <div class="kv"><span>Living there</span><span>${u.living ? `about ${fmtMoney(u.living, c)} a year` : 'You study from home'}${u.nearHome ? ' · or live at home' : ''}</span></div>
      ${major ? `<div class="kv"><span>For ${esc(major.name)}</span><span>${u.strong ? 'Known for it' : 'Taught, not famous for it'}</span></div>${u.bars ? fitBars({ ...u.bars, youLabel: 'Your application', needLabel: 'What they look for' }) : u.chances ? `<div class="kv"><span>Getting a place</span><span><strong>${esc(u.chances)}</strong></span></div>` : ''}` : ''}
      ${u.attempts ? `<p class="dyn-reach">${esc(triesLine(u))}</p>` : ''}
      ${u.family.length ? `<p class="dyn-reach">${esc(u.family.join(', '))} studied here.</p>` : ''}
      <div class="btn-row">
        ${r.sent ? '' : `<button class="btn" data-pick="${u.id}" ${major && u.taught ? '' : 'disabled'}>${u.chosen ? 'Take off your list' : 'Add to your applications'}</button>`}
        <button class="btn ${ui.compare.has(u.id) ? 'primary' : ''}" data-cmp="${u.id}" aria-pressed="${ui.compare.has(u.id)}">${ui.compare.has(u.id) ? 'Comparing' : 'Compare'}</button>
      </div></div>`).join('')}
    ${more > 0 ? `<button class="btn" data-more style="width:100%">Show ${more} more ${more === 1 ? 'place' : 'places'}</button>` : ui.showAll && list.total > 8 ? '<button class="btn" data-less style="width:100%">Show only the top places</button>' : ''}`;
}

function coachCard() {
  const k = uni.coaching();
  if (!k.show) return '';
  return `<div class="section-label">Audition coaching</div>
    <p class="muted">${esc(k.blurb)} Prepared so far: ${k.points} of up to ${k.cap} points.</p>
    <button class="btn" data-coach ${k.can ? '' : 'disabled'} style="width:100%">${k.can ? `Take a year of coaching · ${fmtMoney(k.cost, country())}` : esc(k.why)}</button>`;
}

function pageApplying(r) {
  const major = MAJOR_BY_ID[r.majorId];
  if (r.sent) return '<p class="muted">Applications sent.</p>';
  const chosen = uni.browse().filter((u) => u.chosen);
  const st = uni.statements().find((s) => s.id === r.statement);
  return `<div class="kv"><span>Subject</span><span>${major ? esc(major.name) : 'Not chosen'}</span></div>
    <div class="kv"><span>Places</span><span>${chosen.length} of ${uni.maxApplications(r.majorId)}</span></div>
    ${chosen.map((u) => `<div class="kv"><span>${esc(u.name)}${u.attempts ? ` <small>(applied ${u.attempts}×)</small>` : ''}</span><span>${esc(u.chances)}</span></div>${u.bars ? fitBars({ ...u.bars, youLabel: 'Your application', needLabel: 'What they look for' }) : ''}`).join('') || '<p class="muted">Add places from the first page.</p>'}
    ${coachCard()}
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
    ${a.tries > 1 ? `<p class="muted">This was your ${a.tries === 2 ? 'second' : a.tries === 3 ? 'third' : `${a.tries}th`} time applying here.${a.outcome === 'rejected' ? ' Many people are accepted on a later try.' : ''}</p>` : ''}
    ${a.outcome === 'accepted' || a.outcome === 'conditional' ? `<div class="kv"><span>Tuition</span><span>${a.tuition ? `${fmtMoney(a.tuition, c)} a year` : 'None'}</span></div>
      ${a.aidText ? `<div class="kv"><span>Help offered</span><span>${esc(a.aidText[0].toUpperCase() + a.aidText.slice(1))}</span></div><div class="kv"><span>You would pay</span><span><strong>${fmtMoney(a.net, c)} a year</strong></span></div>${a.aid.keep ? '<p class="muted">The scholarship lasts while your marks stay up.</p>' : ''}` : a.tuition ? '<p class="muted">No help with the cost was offered.</p>' : ''}
      <div class="kv"><span>Living there</span><span>${a.living ? `about ${fmtMoney(a.living, c)} a year` : 'From home'}${a.aid?.housing ? ' · a room is included' : ''}</span></div>` : ''}
    ${a.canAccept ? `<button class="btn primary" data-accept="${a.instId}">Take this place</button>` : ''}
    ${a.canHold ? `<button class="btn" data-hold="${a.instId}">Ask them to keep it for a year</button>` : ''}
    ${a.canAppeal ? `<button class="btn" data-appeal="${a.instId}">Ask them to look again</button>` : ''}</div>`).join('')
    + (list.some((a) => a.outcome === 'conditional') ? '' : '');
}

/** Places side by side: one block per attribute, a line per place, the better one marked. Stacked, so it fits a phone. */
function openCompare(ids) {
  const rows = uni.compare(ids);
  const names = rows[0]?.values.map((v) => v.name) ?? [];
  openModal(`
    <div class="eyebrow">Compare</div>
    <h2>${names.length} places side by side</h2>
    ${rows.map((row) => `<div class="cmp-block"><div class="section-label">${esc(row.label)}</div>
      ${row.values.map((v) => `<div class="kv ${v.best ? 'cmp-best' : ''}"><span>${esc(v.name)}</span><span>${v.best ? '✓ ' : ''}${esc(v.text)}</span></div>${v.bars ? fitBars({ ...v.bars, youLabel: 'Your application', needLabel: 'What they look for' }) : ''}`).join('')}</div>`).join('')}
    <p class="muted" style="margin-top:10px">✓ marks the better one on that line. Where you stand is for you as you are now, and changes with your audition, marks and preparation.</p>`, { dismissable: true });
}

/**
 * Opens the planner.
 * @param {{changed:Function}} api
 * @param {{funding:Function, housing:Function}} ask  the funding and housing pickers the Work tab already has
 */
export function openUniversity(api, ask) {
  const tabs = [['catalog', 'Places'], ['applying', 'Applying'], ['answers', 'Answers']];
  let tab = uni.plan()?.sent ? 'answers' : 'catalog';
  const ui = { showAll: false, compare: new Set() };
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
    body.innerHTML = !r ? '<p class="muted">There is nothing to plan just now.</p>' : tab === 'catalog' ? pageCatalog(r, ui) : tab === 'applying' ? pageApplying(r) : pageAnswers(r);
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
    if (e.target.closest('[data-more]')) { ui.showAll = true; return draw(true); }
    if (e.target.closest('[data-less]')) { ui.showAll = false; return draw(); }
    const cmp = e.target.closest('[data-cmp]');
    if (cmp) {
      const id = cmp.dataset.cmp;
      if (ui.compare.has(id)) ui.compare.delete(id);
      else if (ui.compare.size >= MAX_COMPARE) { await say({ text: `You can compare up to ${MAX_COMPARE} places at once. Take one off first.`, tone: 'neutral' }); return draw(true); }
      else ui.compare.add(id);
      return draw(true);
    }
    if (e.target.closest('[data-compare]')) return openCompare([...ui.compare]);
    if (e.target.closest('[data-coach]')) { await say(uni.takeCoaching()); return draw(true); }
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
