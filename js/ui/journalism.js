// Journalism: the special career's page (engine/journalism.js). Find the story. Verify the facts. Tell the world.
//   Overview      the newsroom (or newsrooms to apply to), the editor, the beat, standing and complaints
//   Assignments   this year's stories, each opening its notebook
//   Published     what ran, with any corrections
//   Career        the record: history and prizes
// The notebook shows what the reporter has found and from whom: never the truth of a claim.
import { player, store } from '../state.js';
import { esc } from '../util.js';
import { openModal, messageModal, pickModal, confirmModal } from './modals.js';
import { meterHtml } from './meter.js';
import { avatarSvg } from './avatar.js';
import { openNpc } from './tabs/people.js';
import * as jn from '../engine/journalism.js';
import * as special from '../engine/specialCareer.js';
import { OUTLET_KINDS, BEATS, QUESTIONS, ATTRIBUTION, STATUS, ACTIONS_A_YEAR } from '../data/journalism.js';

const kv = (rows) => rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
const btn = (act, label, o = {}) => `<button type="button" class="btn ${o.cls ?? ''}" data-act="${act}"${o.arg != null ? ` data-arg="${esc(o.arg)}"` : ''}${o.disabled ? ' disabled' : ''}>${esc(label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`;
const face = (n) => `<div class="avatar">${avatarSvg({ age: n.age, gender: n.gender, appearance: n.appearance, seed: n.id, mood: n.meters.relationship, label: n.firstName })}</div>`;
const row = (act, arg, main, sub, side = '', n = null) => `<button type="button" class="row world-row" data-act="${act}" data-arg="${esc(arg)}">${n ? face(n) : ''}<div class="main"><strong>${esc(main)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${side ? `<div class="side">${esc(side)}</div>` : ''}</button>`;
const npc = (id) => store.state.npcs[id] ?? null;
const pill = (st) => `<span class="hl-pill ${STATUS[st]?.tone === 'good' ? 'good' : STATUS[st]?.tone === 'bad' ? 'bad' : ''}">${esc(STATUS[st]?.name ?? st)}</span>`;
const STAGE = { assigned: 'Assigned', reporting: 'Reporting', drafted: 'Drafted', revise: 'Sent back', approved: 'Approved', published: 'Published', spiked: 'Dropped', expired: 'Missed' };
const month = (m) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][((m % 12) + 12) % 12];
const when = (at) => `${month(at % 12)} ${Math.floor(at / 12)}`;

const TABS = [['overview', 'Overview'], ['assignments', 'Assignments'], ['published', 'Published'], ['career', 'Career']];

const VIEWS = {
  overview(p) {
    const j = jn.J(p);
    if (!jn.isReporter(p)) {
      const here = jn.outletsHere(p);
      const school = p.age >= 10 && p.age <= 19 && p.education?.enrolled;
      return `<div class="card"><h3>Journalism</h3><p class="muted" style="margin:0">Find the story. Verify the facts. Tell the world. Newsrooms hire interns (students and recent graduates) and junior reporters (from 18, with a degree, an internship, or clips to show).</p>
          ${kv([['Writing', String(Math.round(j.skills.writing))], ['Reporting', String(Math.round(j.skills.reporting))], ['School paper articles', String(j.school.articles)], ...(j.intern ? [['Internship', `${jn.outlet(j.intern.outletId)?.name}, ${j.intern.year}`]] : [])])}</div>
        ${school ? `<div class="btn-stack">${btn('school', 'Write for the school paper', { sub: 'Once a year. Clips count when you apply.' })}</div>` : ''}
        <div class="section-label">Newsrooms in ${esc(p.city)}</div>
        ${here.map((o) => { const ed = npc(o.editorId); const wi = jn.applyWhy(o, 'intern', p); const wj = jn.applyWhy(o, 'junior', p);
    return `<div class="card"><h3>${esc(o.name)}</h3>${kv([['What it is', `${OUTLET_KINDS[o.kind].name} (${o.medium})`], ['Reputation', `${o.reputation}/100`], ['Audience', `about ${o.audience.toLocaleString('en-US')}`], ['Standards', o.standards >= 0.75 ? 'Exacting' : o.standards >= 0.55 ? 'Careful' : 'Relaxed']])}
            ${ed ? row('person', ed.id, `${ed.firstName} ${ed.lastName}`, 'Editor', '', ed) : ''}
            <div class="btn-stack" style="margin-top:6px">${btn('apply', 'Apply as a junior reporter', { arg: `${o.id}:junior`, disabled: !!wj, sub: wj || 'Start at the bottom: local stories first.' })}${btn('apply', 'Apply for an internship', { arg: `${o.id}:intern`, disabled: !!wi, sub: wi || 'A year of research, fact-checking and briefs.' })}</div></div>`; }).join('')}`;
    }
    const o = jn.outlet(j.outletId);
    const ed = npc(o.editorId);
    jn.raiseComplaints(p);
    const waiting = jn.myPubs(p).filter((x) => x.complaint?.raised && !x.complaint.resolved);
    return `<div class="card"><h3>${esc(p.career.title)}, ${esc(o.name)}</h3>${kv([['Beat', BEATS[j.beat].name], ['Since', String(j.since)], ['Time left this year', `${jn.actionsLeft(p)} of ${ACTIONS_A_YEAR} actions`], ['Stories published', String(jn.myPubs(p).length)]])}
        ${ed ? row('person', ed.id, `${ed.firstName} ${ed.lastName}`, 'Your editor', `${Math.round(ed.meters.relationship)}%`, ed) : ''}
        <div class="btn-stack" style="margin-top:6px">${btn('beat', 'Change beat', { sub: BEATS[j.beat].blurb })}</div></div>
      ${waiting.map((x) => `<div class="card"><h3>A complaint about "${esc(x.headline)}"</h3><p class="muted" style="margin:0">Someone says this was wrong: "${esc(x.claims.find((c) => c.id === x.complaint.claimId)?.text ?? '')}". Recheck your notes, then decide.</p>
        <div class="btn-stack" style="margin-top:6px">${btn('correct', 'Run a correction', { arg: x.id, cls: 'primary' })}${btn('stand', 'Stand by it', { arg: x.id })}${btn('pub', 'Read the story', { arg: x.id })}</div></div>`).join('')}
      <div class="card"><h3>Your standing</h3><p class="muted" style="margin:0 0 6px">Kept apart on purpose: being right, being trusted, and being known are different things.</p>
        ${meterHtml('Accuracy', j.rep.accuracy, true)}${meterHtml('Trust of sources and readers', j.rep.trust, true)}${meterHtml('Recognition', j.rep.recognition, true)}</div>
      <div class="card"><h3>Your skills</h3>${kv(Object.entries(j.skills).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), String(Math.round(v))]))}</div>`;
  },

  assignments(p) {
    if (!jn.isReporter(p)) return '<p class="empty">Assignments come with a newsroom job.</p>';
    const list = jn.myStories(p).sort((a, b) => b.created - a.created);
    const live = list.filter((s) => !['published', 'spiked', 'expired'].includes(s.status));
    const done = list.filter((s) => ['published', 'spiked', 'expired'].includes(s.status));
    const r = (s) => row('story', s.id, s.title, `${BEATS[s.beat].name} · ${STAGE[s.status] ?? s.status}${s.deadline && !['published', 'spiked', 'expired'].includes(s.status) ? ` · due by ${when(s.deadline)}` : ''}`);
    return `<p class="muted">Every assignment is about something that really happened. Report it, check it, write it, and send it to your editor.</p>
      <div class="section-label">Working on</div>${live.map(r).join('') || '<p class="empty">Nothing open. New assignments come with the year.</p>'}
      ${done.length ? `<div class="section-label">Done</div>${done.slice(0, 20).map(r).join('')}` : ''}`;
  },

  /** One story's notebook: what is known, from whom, and what still needs checking. */
  story(p, id) {
    const nb = jn.notebook(id);
    if (!nb) return '<p class="empty">That story is gone.</p>';
    const ed = npc(nb.editorId);
    const live = !['published', 'spiked', 'expired'].includes(nb.status);
    const heard = (c) => c.heard.map((h) => `${h.offRecord ? '(off the record) ' : ''}${h.from}: ${h.says ? 'yes' : 'no'}`).join(' · ');
    return `<div class="card"><h3>${esc(nb.title)}</h3>${kv([['Status', STAGE[nb.status] ?? nb.status], ['Beat', BEATS[nb.beat].name], ['About', nb.subject ?? '—'], ['For', nb.outlet], ...(nb.deadline ? [['Due by', when(nb.deadline)]] : [])])}
        ${ed ? row('person', ed.id, `${ed.firstName} ${ed.lastName}`, 'Editor', '', ed) : ''}</div>
      ${nb.review?.notes?.length && nb.status === 'revise' ? `<div class="card"><h3>Your editor's notes</h3>${nb.review.notes.map((x) => `<p style="margin:4px 0">${esc(x)}</p>`).join('')}</div>` : ''}
      <div class="section-label">Claims</div>
      ${nb.claims.map((c) => `<div class="card jn-claim"><div class="kv"><span>${esc(c.text)}${c.kind === 'allegation' ? ' <small class="muted">(allegation)</small>' : c.kind === 'opinion' ? ' <small class="muted">(opinion)</small>' : ''}</span><span>${pill(c.status)}</span></div>
        ${c.heard.length ? `<small class="muted">${esc(heard(c))}</small>` : `<small class="muted">${esc(STATUS[c.status].sub)}</small>`}</div>`).join('')}
      <div class="section-label">Sources</div>
      ${nb.sources.map((x) => `${x.npcId && npc(x.npcId) ? row('person', x.npcId, x.name, `${x.role}${x.wantsConfidential ? ' · wants to stay unnamed' : ''}`, x.agreed === true ? 'Talked' : x.agreed === false ? 'Declined' : '', npc(x.npcId)) : `<div class="kv"><span>${esc(x.name)}</span><span>${esc(x.role)}</span></div>`}
        ${live ? `<div class="btn-stack" style="margin:-4px 0 10px">${btn('interview', x.asked ? 'Asked this year' : `Interview ${x.name.split(' ')[0]}`, { arg: `${nb.id}|${x.id}`, disabled: x.asked })}</div>` : ''}`).join('')}
      <div class="section-label">Records</div>
      ${nb.docs.map((d) => `<div class="kv"><span>${esc(d.title)}</span><span>${d.read ? 'Read' : d.public ? '' : 'Not available'}</span></div>${live && !d.read ? `<div class="btn-stack" style="margin:-2px 0 10px">${btn('read', d.public ? 'Read it' : 'Try to get it', { arg: `${nb.id}|${d.id}`, sub: d.public ? '' : 'Closed to reporters' })}</div>` : ''}`).join('')}
      ${live ? `<div class="section-label">Writing it</div><div class="btn-stack">
        ${btn('comment', nb.comment ? `They ${nb.comment.said}` : 'Ask them for comment', { arg: nb.id, disabled: !!nb.comment, sub: nb.needsComment ? 'Needed before an allegation runs.' : '' })}
        ${nb.needsLegal ? btn('legal', nb.legal ? 'The lawyer has read it' : 'Have the lawyer read it', { arg: nb.id, disabled: !!nb.legal, sub: nb.legal?.notes ?? '' }) : ''}
        ${btn('draft', nb.draft ? 'Rewrite the draft' : 'Write the draft', { arg: nb.id, sub: nb.draft ? `"${nb.draft.headlineText}"` : 'Choose what goes in, and the headline.' })}
        ${nb.draft && nb.status !== 'approved' ? btn('submit', 'Send it to your editor', { arg: nb.id, cls: 'primary' }) : ''}
        ${nb.status === 'approved' ? btn('publish', 'Publish', { arg: nb.id, cls: 'primary', sub: 'It runs once, as it is.' }) : ''}
        ${btn('spike', 'Drop the story', { arg: nb.id, sub: 'Not every story stands up. That is a decision too.' })}</div>` : ''}
      ${nb.pubId ? `<div class="btn-stack">${btn('pub', 'Read it as it ran', { arg: nb.pubId })}</div>` : ''}`;
  },

  published(p) {
    const list = jn.myPubs(p);
    return list.map((x) => row('pub', x.id, x.headline, `${x.outlet} · ${when(x.at)}${x.corrections.length ? ` · ${x.corrections.length} correction` : ''}`, `${x.readers.toLocaleString('en-US')}`)).join('') || '<p class="empty">Nothing published yet.</p>';
  },

  pub(p, id) {
    const x = jn.S().pubs[id];
    if (!x) return '<p class="empty">Not found.</p>';
    return `<div class="card jn-article"><h3>${esc(x.headline)}</h3><p class="muted" style="margin:0 0 8px">By ${esc(x.byline)} · ${esc(x.outlet)} · ${esc(when(x.at))}</p><p style="margin:0">${esc(x.body)}</p>
        ${x.corrections.map((c) => `<p class="muted" style="margin:8px 0 0"><strong>${esc(c.text)}</strong> (${esc(when(c.at))})</p>`).join('')}</div>
      ${x.sources.length ? `<div class="section-label">Sources</div>${x.sources.map((s) => (s.npcId && npc(s.npcId) ? row('person', s.npcId, s.name, ATTRIBUTION[s.attribution].name, '', npc(s.npcId)) : `<div class="kv"><span>${esc(s.name)}</span><span>${esc(ATTRIBUTION[s.attribution].name)}</span></div>`)).join('')}` : ''}
      ${kv([['Readers', x.readers.toLocaleString('en-US')]])}`;
  },

  career(p) {
    const j = jn.J(p);
    return `<div class="card"><h3>Your journalism</h3>${kv([['Stories published', String(jn.myPubs(p).length)], ['Corrections run', String(jn.myPubs(p).reduce((n, x) => n + x.corrections.length, 0))], ['Prizes', String(j.awards.length)]])}</div>
      ${j.awards.length ? `<div class="section-label">Prizes</div>${j.awards.map((a) => `<div class="kv"><span>${esc(a.name)}</span><span>${a.year}</span></div>`).join('')}` : ''}
      <div class="section-label">History</div>${[...j.history].reverse().map((h) => `<div class="kv"><span>${h.year}</span><span>${esc(h.text)}</span></div>`).join('') || '<p class="empty">Nothing yet.</p>'}`;
  },
};

/** The draft: which claims go in (checked against the notebook), and the headline. */
async function draftFlow(id, x) {
  const nb = jn.notebook(id);
  const opts = nb.claims.map((c) => `<label><input type="checkbox" name="c" value="${esc(c.id)}" ${['verified', 'supported'].includes(c.status) ? 'checked' : ''}> ${esc(c.text)} <small class="muted">${esc(STATUS[c.status].name)}</small></label>`).join('');
  const heads = jn.headlines(id);
  const chosen = await new Promise((resolve) => {
    const m = openModal(`<p class="body">What is checked is stated as fact if the evidence holds it up; anything else is attributed to who said it, or left out.</p>
      <form novalidate><fieldset class="field dl-checks"><legend>What goes in</legend>${opts}</fieldset>
      <div class="field"><label for="jn-h">Headline</label><select id="jn-h">${heads.map((h) => `<option value="${esc(h.id)}">${esc(h.text)} (${esc(h.sub)})</option>`).join('')}</select></div>
      <div class="btn-row"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn primary">Save the draft</button></div></form>`, { dismissable: true, full: true, title: 'Write the draft', onDismiss: () => resolve(null) });
    m.el.querySelector('[data-cancel]').addEventListener('click', () => { m.close(); resolve(null); });
    m.el.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); const f = e.target; resolve({ include: [...f.querySelectorAll('input[name="c"]:checked')].map((i) => i.value), headline: f.querySelector('#jn-h').value }); m.close(); });
  });
  if (chosen) await x.say(jn.draft(id, chosen.include, chosen.headline));
}

const ACTIONS = {
  person: (id, x) => { x.close(); openNpc(npc(id), x.api, () => openJournalism(x.api, { view: x.top().view, arg: x.top().arg })); },
  school: (_, x) => x.say(jn.schoolArticle()),
  apply: (arg, x) => { const [id, role] = arg.split(':'); return x.say(jn.apply(id, role)); },
  async beat(_, x) {
    const p = player();
    const b = await pickModal({ title: 'Your beat', cancel: 'Back', options: Object.entries(BEATS).map(([k, v]) => ({ value: k, label: v.name, sub: v.minLevel > (p.career.level ?? 0) ? 'From senior reporter' : v.blurb, disabled: v.minLevel > (p.career.level ?? 0) })) });
    if (b) await x.say(jn.setBeat(b));
  },
  story: (id, x) => x.go('story', id),
  pub: (id, x) => x.go('pub', id),
  async interview(arg, x) {
    const [sid, src] = arg.split('|');
    const s = jn.notebook(sid).sources.find((y) => y.id === src);
    let att = 'record';
    if (s.wantsConfidential) {
      att = await pickModal({ title: `${s.name} will talk, but not on the record`, body: 'Agree how you can use what they say. Whatever they tell you still has to be checked.', cancel: 'Do without them',
        options: ['background', 'confidential', 'off'].map((k) => ({ value: k, label: ATTRIBUTION[k].name, sub: ATTRIBUTION[k].sub })) });
      if (!att) return;
    }
    const qs = [];
    for (let i = 0; i < 3; i++) {
      const q = await pickModal({ title: i ? 'Anything else?' : `Interviewing ${s.name}`, body: i ? '' : 'Ask up to three questions.', cancel: i ? 'That is all' : 'Cancel',
        options: Object.entries(QUESTIONS).filter(([k]) => !qs.includes(k)).map(([k, v]) => ({ value: k, label: v.label })) });
      if (!q) break;
      qs.push(q);
    }
    if (qs.length) await x.say(jn.interview(sid, src, qs, att));
  },
  read: (arg, x) => { const [sid, d] = arg.split('|'); return x.say(jn.readDoc(sid, d)); },
  comment: (id, x) => x.say(jn.askComment(id)),
  legal: (id, x) => x.say(jn.legalReview(id)),
  draft: (id, x) => draftFlow(id, x),
  submit: (id, x) => x.say(jn.submit(id)),
  async publish(id, x) { if (await confirmModal({ title: 'Publish it?', body: 'It runs as it is. What it gets wrong, you will answer for.', yes: 'Publish' })) await x.say(jn.publish(id)); },
  async spike(id, x) { if (await confirmModal({ title: 'Drop the story?', body: 'It will not run.', yes: 'Drop it' })) await x.say(jn.spike(id)); },
  correct: (id, x) => x.say(jn.answerComplaint(id, true)),
  stand: (id, x) => x.say(jn.answerComplaint(id, false)),
};

/** Opens the Journalism page. */
export function openJournalism(api, start = {}) {
  const p0 = player();
  if (p0.career?.careerId === 'journalist') jn.migrateJournalist(p0);
  const st = { stack: [{ view: start.view ?? 'overview', arg: start.arg ?? null }] };
  const modal = openModal('<div data-jn></div>', { dismissable: true, full: true, title: 'Journalism' });
  modal.el.classList.add('world-modal');
  const root = modal.el.querySelector('[data-jn]');
  const top = () => st.stack[st.stack.length - 1];
  const render = () => {
    const p = player();
    const t = top();
    const deep = st.stack.length > 1;
    const now = special.current(p);
    const banner = now && now !== 'journalism' ? `<div class="card"><p class="muted" style="margin:0">You are ${esc(special.SPECIAL_BY_ID[now].noun)}. One special career at a time: to take up journalism, leave ${esc(special.SPECIAL_BY_ID[now].name.toLowerCase())} first.</p></div>` : '';
    root.innerHTML = `${deep ? '<button type="button" class="btn small" data-back>← Back</button>' : `<div class="world-groups fame-tabs" role="tablist">${TABS.map(([id, label]) => `<button type="button" role="tab" class="world-group av-chip ${id === t.view ? 'on' : ''}" aria-selected="${id === t.view}" data-tab="${id}">${esc(label)}</button>`).join('')}</div>`}
      ${banner}<div style="margin-top:10px">${(VIEWS[t.view] ?? VIEWS.overview)(p, t.arg)}</div>
      ${now === 'journalism' && !deep && t.view === 'career' ? `<div class="btn-stack" style="margin-top:12px">${btn('leave', 'Leave journalism', { cls: 'danger', sub: 'Your published work is kept.' })}</div>` : ''}
      <div class="btn-stack" style="margin-top:12px"><button type="button" class="btn" data-close>Close</button></div>`;
  };
  const refresh = () => { api?.changed?.(); render(); };
  const say = async (r) => { refresh(); if (r?.text) await messageModal({ body: r.text, tone: r.tone }); render(); };
  const go = (view, arg) => { st.stack.push({ view, arg }); render(); modal.el.scrollTop = 0; };
  ACTIONS.leave = async (_, x) => { if (await confirmModal({ title: 'Leave journalism?', body: 'You leave the newsroom. What you published stays published.', yes: 'Leave', danger: true })) await x.say(special.leave()); };
  root.addEventListener('click', async (e) => {
    const tt = e.target;
    if (tt.closest('[data-close]')) return modal.close();
    if (tt.closest('[data-back]')) { st.stack.pop(); render(); return undefined; }
    const tab = tt.closest('[data-tab]');
    if (tab) { st.stack = [{ view: tab.dataset.tab, arg: null }]; render(); return undefined; }
    const b = tt.closest('[data-act]');
    if (!b || b.disabled) return undefined;
    const fn = ACTIONS[b.dataset.act];
    if (fn) await fn(b.dataset.arg, { st, say, refresh, render, go, api, top, close: () => modal.close() });
    return undefined;
  });
  render();
  return modal;
}
