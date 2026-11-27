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
import { OUTLET_KINDS, BEATS, QUESTIONS, ATTRIBUTION, STATUS, ACTIONS_A_YEAR, OWN_KINDS } from '../data/journalism.js';
import { fmtMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { country } from '../state.js';
import { inputModal } from './modals.js';
import { accountsOf } from '../engine/digital/accounts.js';
import { formatOptions, publish as postOnline } from '../engine/digital/content.js';
import { PLATFORM_BY_ID } from '../data/digital.js';

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
      const own = jn.ownedOutlet(p);
      const c = country();
      const ownCard = own ? `<div class="card"><h3>${esc(own.name)}</h3>${kv([['What it is', `${OWN_KINDS[own.ownKind].name}, yours since ${own.founded}`], [own.medium === 'audio' ? 'Listeners' : 'Readers', own.audience.toLocaleString('en-US')], ['Editorial policy', own.editorId ? 'Set by your editor' : own.policy === 'careful' ? 'Careful' : 'Standard'], ['Stories published', String(own.published ?? 0)],
          ...(own.finances.length ? [['Last year', `${fmtMoney(own.finances.at(-1).revenue, c)} in, ${fmtMoney(own.finances.at(-1).costs, c)} out`]] : [['Money', 'Counted at the end of each year']])])}
        ${own.staff.map((x) => { const n = npc(x.npcId); return n ? `${row('person', n.id, `${n.firstName} ${n.lastName}`, `${x.role === 'editor' ? 'Editor' : 'Reporter'} · ${fmtMoney(x.salary, c)} a year`, '', n)}<div class="btn-stack" style="margin:-4px 0 10px">${btn('letgo', `Let ${n.firstName} go`, { arg: n.id })}</div>` : ''; }).join('')}
        <div class="btn-stack" style="margin-top:6px">${btn('hire', 'Hire a reporter', { arg: 'reporter', sub: 'Brings in stories, and readers.' })}${btn('hire', 'Hire an editor', { arg: 'editor', disabled: own.staff.some((x) => x.role === 'editor'), sub: 'Reads every story before it runs.' })}${btn('sell', 'Sell it', { sub: 'A buyer pays for its readers and its record.' })}${btn('close', 'Close it', { cls: 'danger', sub: 'The archive stays up.' })}</div></div>` : '';
      const fwhy = jn.freelanceWhy(p);
      const indie = j.freelance ? `<div class="card"><h3>Freelance</h3>${kv([['Since', String(j.freelance.since)], ['Stories sold', String(jn.myPubs(p).filter((x) => x.fee).length)], ['Earned from them', fmtMoney(jn.myPubs(p).reduce((n, x) => n + (x.fee ?? 0), 0), c)]])}<p class="muted" style="margin:6px 0 0">Report a lead, then pitch it to a newsroom from its notebook. They pay once, when it runs.</p></div>` : '';
      const ways = p.age >= 18 ? `<div class="section-label">Working for yourself</div><div class="btn-stack">${j.freelance ? '' : btn('freelance', 'Go freelance', { disabled: !!fwhy, sub: fwhy || 'Find stories and sell them to newsrooms. No salary.' })}${own ? '' : btn('start', 'Start your own publication', { sub: 'A newsletter, a podcast, a website or a paper, with your own money.' })}</div>` : '';
      const titles = jn.ownedTitles(p);
      const growRows = (t) => kv([['Loyal readers', `${Math.round(t.loyalty ?? 50)}/100`], ['Research', ['None', 'A fact-checker', 'A research desk'][t.research ?? 0]], ['Bureaus', (t.bureaus ?? []).join(', ') || 'None'], ...(t.investor ? [['Investor', `${Math.round(t.investor.share * 100)}% of profits`]] : [])]);
      const growBtns = (t) => `<div class="btn-stack" style="margin-top:6px">${btn('research', 'Research budget', { arg: t.id, sub: 'Checking costs money; mistakes cost readers.' })}${btn('bureau', 'Open a bureau', { arg: t.id, sub: 'Another city to cover.' })}</div>`;
      const sisters = titles.filter((t) => t.id !== own?.id);
      const company = own ? `<div class="section-label">${sisters.length ? 'Your media company' : 'Growing it'}</div>
        <div class="card"><h3>${esc(own.name)}</h3>${growRows(own)}${growBtns(own)}</div>
        ${sisters.map((t) => `<div class="card"><h3>${esc(t.name)}</h3>${kv([['What it is', `${OWN_KINDS[t.ownKind].name}, since ${t.founded}`], [t.medium === 'audio' ? 'Listeners' : 'Readers', t.audience.toLocaleString('en-US')], ['Reputation', `${t.reputation}/100`], ['Staff', String(t.staff.length)],
          ...(t.finances.length ? [['Last year', `${fmtMoney(Math.abs(t.finances.at(-1).net), c)} ${t.finances.at(-1).net >= 0 ? 'made' : 'lost'}`]] : [['Money', 'Counted at the end of each year']])])}${growRows(t)}${growBtns(t)}</div>`).join('')}
        ${sisters.length ? `<div class="section-label">Company history</div>${titles.flatMap((t) => t.history.map((h) => ({ ...h, name: t.name }))).sort((x, y) => y.year - x.year).slice(0, 8).map((h) => `<div class="kv"><span>${h.year}</span><span>${esc(h.name)}: ${esc(h.text)}</span></div>`).join('')}` : ''}
        <div class="btn-stack" style="margin-top:6px">${btn('launch', 'Launch another title', { sub: 'With an editor hired to run it.' })}</div>` : '';
      if (own || j.freelance) return `${ownCard}${company}${indie}${ways}`;
      const school = p.age >= 10 && p.age <= 19 && p.education?.enrolled;
      return `<div class="card"><h3>Journalism</h3><p class="muted" style="margin:0">Find the story. Verify the facts. Tell the world. Newsrooms hire interns (students and recent graduates) and junior reporters (from 18, with a degree, an internship, or clips to show).</p>
          ${kv([['Writing', String(Math.round(j.skills.writing))], ['Reporting', String(Math.round(j.skills.reporting))], ['School paper articles', String(j.school.articles)], ...(j.intern ? [['Internship', `${jn.outlet(j.intern.outletId)?.name}, ${j.intern.year}`]] : [])])}</div>
        ${school ? `<div class="btn-stack">${btn('school', 'Write for the school paper', { sub: 'Once a year. Clips count when you apply.' })}</div>` : ''}
        <div class="section-label">Newsrooms in ${esc(p.city)}</div>
        ${here.map((o) => { const ed = npc(o.editorId); const wi = jn.applyWhy(o, 'intern', p); const wj = jn.applyWhy(o, 'junior', p);
    return `<div class="card"><h3>${esc(o.name)}</h3>${kv([['What it is', `${OUTLET_KINDS[o.kind].name} (${o.medium})`], ['Reputation', `${o.reputation}/100`], ['Audience', `about ${o.audience.toLocaleString('en-US')}`], ['Standards', o.standards >= 0.75 ? 'Exacting' : o.standards >= 0.55 ? 'Careful' : 'Relaxed']])}
            ${ed ? row('person', ed.id, `${ed.firstName} ${ed.lastName}`, 'Editor', '', ed) : ''}
            <div class="btn-stack" style="margin-top:6px">${btn('apply', 'Apply as a junior reporter', { arg: `${o.id}:junior`, disabled: !!wj, sub: wj || 'Start at the bottom: local stories first.' })}${btn('apply', 'Apply for an internship', { arg: `${o.id}:intern`, disabled: !!wi, sub: wi || 'A year of research, fact-checking and briefs.' })}</div></div>`; }).join('')}
        ${ways}`;
    }
    const o = jn.outlet(j.outletId);
    const ed = npc(o.editorId);
    jn.raiseComplaints(p);
    const waiting = jn.myPubs(p).filter((x) => x.complaint?.raised && !x.complaint.resolved);
    return `<div class="card"><h3>${esc(p.career.title)}, ${esc(o.name)}</h3>${kv([['Beat', BEATS[j.beat].name], ['Since', String(j.since)], ['Time left this year', `${jn.actionsLeft(p)} of ${ACTIONS_A_YEAR} actions`], ['Workload', jn.workload(p).text], ['Stories published', String(jn.myPubs(p).length)]])}
        ${ed ? row('person', ed.id, `${ed.firstName} ${ed.lastName}`, 'Your editor', `${Math.round(ed.meters.relationship)}%`, ed) : ''}
        <div class="btn-stack" style="margin-top:6px">${btn('beat', 'Change beat', { sub: BEATS[j.beat].blurb })}</div>
        ${j.leave === store.state.year ? '<p class="muted" style="margin:6px 0 0">You are on leave this year. No assignments; the desk is kept for you.</p>' : ''}</div>
      ${jn.isEditor(p) ? `<div class="card"><h3>Your desk</h3>${kv([['Leadership', `${Math.round(j.rep.leadership ?? 50)}/100`]])}<p class="muted" style="margin:6px 0">Your reporters' drafts, with what their notes support. What you let through, you answer for.</p>
        ${jn.desk(p).map((d) => { const n = npc(d.reporterId); return `<div class="card"><h3>${esc(d.title)}</h3><p class="muted" style="margin:0 0 6px">By ${esc(n ? `${n.firstName} ${n.lastName}` : 'a reporter')}</p>
          ${d.claims.map((c) => `<div class="kv"><span>${esc(c.text)}</span><span>${pill(c.status)}</span></div>`).join('')}
          ${d.decision ? `<p class="muted" style="margin:6px 0 0">${esc({ approve: 'Approved', back: 'Sent back', spike: 'Spiked' }[d.decision])}${d.flaw ? ', and it got something wrong' : ''}.</p>` : `<div class="btn-stack" style="margin-top:6px">${btn('desk', 'Approve it', { arg: `${d.id}|approve` })}${btn('desk', 'Send it back', { arg: `${d.id}|back`, sub: 'Firm up the thin parts.' })}${btn('desk', 'Spike it', { arg: `${d.id}|spike` })}</div>`}</div>`; }).join('')}</div>` : ''}
      ${jn.isBroadcast(o) ? `<div class="card"><h3>${j.anchor ? esc(j.anchor.show) : o.medium === 'television' ? 'On camera' : 'On air'}</h3>
        ${kv([['Delivery', String(Math.round(j.skills.broadcast ?? 15))], ['Segments on air', String(jn.myPubs(p).filter((x) => x.segment).length)], ...(j.anchor ? [['Anchor since', String(j.anchor.since)]] : [])])}
        <div class="btn-stack" style="margin-top:6px">${btn('practice', 'Practice your delivery', { sub: 'Reading copy until it sounds like talking.' })}
          ${j.anchor ? btn('guest', 'Interview a guest', { sub: 'Real people with a public role. They decide whether to come.' }) : btn('anchor', 'Audition for anchor', { disabled: !!jn.anchorAuditionWhy(p), sub: jn.anchorAuditionWhy(p) || 'Chosen by the newsroom, on your work on air.' })}</div></div>` : ''}
      ${waiting.map((x) => `<div class="card"><h3>A complaint about "${esc(x.headline)}"</h3><p class="muted" style="margin:0">Someone says this was wrong: "${esc(x.claims.find((c) => c.id === x.complaint.claimId)?.text ?? '')}". Recheck your notes, then decide.</p>
        <div class="btn-stack" style="margin-top:6px">${btn('correct', 'Run a correction', { arg: x.id, cls: 'primary' })}${btn('stand', 'Stand by it', { arg: x.id })}${btn('pub', 'Read the story', { arg: x.id })}</div></div>`).join('')}
      <div class="card"><h3>Your standing</h3><p class="muted" style="margin:0 0 6px">Kept apart on purpose: being right, being trusted, and being known are different things.</p>
        ${meterHtml('Accuracy', j.rep.accuracy, true)}${meterHtml('Trust of sources and readers', j.rep.trust, true)}${meterHtml('Recognition', j.rep.recognition, true)}</div>
      ${j.posting ? `<div class="card"><h3>Correspondent in ${esc(COUNTRIES[j.posting.countryId].name)}</h3>${kv([['Based in', j.posting.city], ['Posting', `${j.posting.from} to ${j.posting.until}`]])}<div class="btn-stack" style="margin-top:6px">${btn('home', 'Come home early')}</div></div>`
    : `<div class="btn-stack">${btn('posting', 'Ask for a foreign posting', { disabled: !!jn.postingOpenWhy(p), sub: jn.postingOpenWhy(p) || 'Three years reporting from another country. The newsroom arranges the visa.' })}</div>`}
      <div class="section-label">Other newsrooms in ${esc(p.city)}</div>
      ${jn.outletsHere(p).filter((x) => x.id !== o.id).map((x) => { const why = jn.moveWhy(x, p); return `<div class="kv"><span>${esc(x.name)}</span><span>${esc(OUTLET_KINDS[x.kind].name)}</span></div><div class="btn-stack" style="margin:-2px 0 10px">${btn('move', 'Apply to move here', { arg: x.id, disabled: !!why, sub: why || 'At your level. They read your clips.' })}</div>`; }).join('')}
      <div class="card"><h3>Your skills</h3>${kv(Object.entries(j.skills).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), String(Math.round(v))]))}</div>`;
  },

  assignments(p) {
    if (!jn.working(p)) return '<p class="empty">Assignments come with a newsroom job, freelance work, or a publication of your own.</p>';
    const list = jn.myStories(p).sort((a, b) => b.created - a.created);
    const live = list.filter((s) => !['published', 'spiked', 'expired'].includes(s.status));
    const done = list.filter((s) => ['published', 'spiked', 'expired'].includes(s.status));
    const r = (s) => row('story', s.id, s.title, `${BEATS[s.beat].name} · ${STAGE[s.status] ?? s.status}${s.deadline && !['published', 'spiked', 'expired'].includes(s.status) ? ` · due by ${when(s.deadline)}` : ''}`);
    return `<p class="muted">Every assignment is about something that really happened. Report it, check it, write it, and send it to your editor.</p>
      ${jn.isReporter(p) ? `<div class="btn-stack">${btn('lead', 'Pitch a lead of your own', { sub: 'Twice a year. Your editor decides.' })}</div>` : ''}
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
      ${live && nb.race ? `<div class="card"><h3>${nb.race.over ? 'The rival has run it' : 'A rival is on it'}</h3><p class="muted" style="margin:0">${esc(nb.race.outlet)} ${nb.race.over ? 'got there first. Yours can still be the one that is right.' : `is working on the same story, and may run it by ${when(nb.race.by)}. First is not the same as right: what is unchecked can wait, or stay out.`}</p></div>` : ''}
      ${live && nb.conflict ? `<div class="card"><h3>A conflict of interest</h3><p class="muted" style="margin:0 0 6px">This story involves ${esc(nb.conflict)}. ${nb.disclosed ? 'You have disclosed it; the story will say so.' : 'Tell your editor, and the readers.'}</p>${nb.disclosed ? '' : btn('disclose', 'Disclose it', { arg: nb.id })}</div>` : ''}
      ${nb.review?.notes?.length && nb.status === 'revise' ? `<div class="card"><h3>Your editor's notes</h3>${nb.review.notes.map((x) => `<p style="margin:4px 0">${esc(x)}</p>`).join('')}</div>` : ''}
      <div class="section-label">Claims</div>
      ${nb.claims.map((c) => `<div class="card jn-claim"><div class="kv"><span>${esc(c.text)}${c.kind === 'allegation' ? ' <small class="muted">(allegation)</small>' : c.kind === 'opinion' ? ' <small class="muted">(opinion)</small>' : ''}</span><span>${pill(c.status)}</span></div>
        ${c.heard.length ? `<small class="muted">${esc(heard(c))}</small>` : `<small class="muted">${esc(STATUS[c.status].sub)}</small>`}</div>`).join('')}
      <div class="section-label">Sources</div>
      ${nb.sources.map((x) => `${x.npcId && npc(x.npcId) ? row('person', x.npcId, x.name, `${x.role}${x.wantsConfidential ? ' · wants to stay unnamed' : ''}`, x.agreed === true ? 'Talked' : x.agreed === false ? 'Declined' : '', npc(x.npcId)) : `<div class="kv"><span>${esc(x.name)}</span><span>${esc(x.role)}</span></div>`}
        ${live ? `<div class="btn-stack" style="margin:-4px 0 10px">${btn('interview', x.asked ? 'Asked this year' : `Interview ${x.name.split(' ')[0]}`, { arg: `${nb.id}|${x.id}`, disabled: x.asked })}</div>` : ''}`).join('')}
      <div class="section-label">Records</div>
      ${nb.docs.map((d) => `<div class="kv"><span>${esc(d.title)}</span><span>${d.read ? 'Read' : d.public ? '' : 'Not available'}</span></div>${live && !d.read ? `<div class="btn-stack" style="margin:-2px 0 10px">${btn('read', d.public ? 'Read it' : 'Try to get it', { arg: `${nb.id}|${d.id}`, sub: d.public ? '' : 'Closed to reporters' })}</div>` : ''}`).join('')}
      ${live && !nb.commissioned ? `<div class="card"><h3>Not yet sold</h3><p class="muted" style="margin:0">Freelance: pitch it to a newsroom. The more you have reported, the likelier they buy.</p><div class="btn-stack" style="margin-top:6px">${btn('pitch', 'Pitch it to a newsroom', { arg: nb.id })}</div></div>` : ''}
      ${nb.fee ? `<p class="muted">Commissioned: ${esc(fmtMoney(nb.fee, country()))} when it runs.</p>` : ''}
      ${live ? `<div class="section-label">Writing it</div><div class="btn-stack">
        ${btn('comment', nb.comment ? `They ${nb.comment.said}` : 'Ask them for comment', { arg: nb.id, disabled: !!nb.comment, sub: nb.needsComment ? 'Needed before an allegation runs.' : '' })}
        ${nb.needsLegal ? btn('legal', nb.legal ? (nb.beat === 'war' ? 'The censor has read it' : 'The lawyer has read it') : nb.beat === 'war' ? 'Send it to the censor' : 'Have the lawyer read it', { arg: nb.id, disabled: !!nb.legal, sub: nb.legal?.notes ?? '' }) : ''}
        ${jn.isReporter(p) && ['assigned', 'reporting'].includes(nb.status) ? btn('help', 'Ask a colleague for help', { arg: nb.id, sub: 'Once a year: they take one interview.' }) : ''}
        ${btn('draft', nb.draft ? 'Rewrite the draft' : 'Write the draft', { arg: nb.id, sub: nb.draft ? `"${nb.draft.headlineText}"` : 'Choose what goes in, and the headline.' })}
        ${nb.draft && nb.status !== 'approved' ? btn('submit', 'Send it to your editor', { arg: nb.id, cls: 'primary' }) : ''}
        ${nb.status === 'approved' ? (jn.isBroadcast(jn.outlet(jn.storyOf(nb.id).outletId)) ? btn('live', 'Go live', { arg: nb.id, cls: 'primary', sub: 'Present it on air. It goes out once.' }) : btn('publish', 'Publish', { arg: nb.id, cls: 'primary', sub: 'It runs once, as it is.' })) : ''}
        ${btn('spike', 'Drop the story', { arg: nb.id, sub: 'Not every story stands up. That is a decision too.' })}</div>` : ''}
      ${nb.pubId ? `<div class="btn-stack">${btn('pub', 'Read it as it ran', { arg: nb.pubId })}</div>` : ''}`;
  },

  published(p) {
    const list = jn.myPubs(p);
    const docs = jn.myDocumentaries(p);
    const docCards = docs.map((d) => `<div class="card"><h3>${esc(d.title)}</h3>${kv([['Stage', d.released ? `Released ${d.released}` : { research: 'Research', interviews: 'Interviews', production: 'In the edit', legal: d.legal ? 'Cleared by the lawyers' : 'With the lawyers' }[d.stage]]])}
      ${d.released ? '' : `<div class="btn-stack" style="margin-top:6px">${d.stage === 'legal' ? btn('docrelease', d.legal ? 'Release it' : 'Legal review', { arg: d.id }) : btn('docwork', 'Work on it', { arg: d.id, sub: 'A season of it: two actions.' })}</div>`}</div>`).join('');
    const can = list.filter((x) => !jn.documentaryWhy(x.id, p));
    return (docs.length ? `<div class="section-label">Documentaries</div>${docCards}` : '')
      + (can.length ? `<div class="btn-stack">${can.map((x) => btn('doc', `Make a documentary of "${x.headline}"`, { arg: x.id, sub: 'Months of work, and a legal read.' })).join('')}</div>` : '')
      + (docs.length || can.length ? '<div class="section-label">Stories</div>' : '')
      + list.map((x) => row('pub', x.id, x.headline, `${x.outlet} · ${when(x.at)}${x.corrections.length ? ` · ${x.corrections.length} correction` : ''}`, `${x.readers.toLocaleString('en-US')}`)).join('') || '<p class="empty">Nothing published yet.</p>';
  },

  pub(p, id) {
    const x = jn.S().pubs[id];
    if (!x) return '<p class="empty">Not found.</p>';
    return `<div class="card jn-article"><h3>${esc(x.headline)}</h3><p class="muted" style="margin:0 0 8px">By ${esc(x.byline)} · ${esc(x.outlet)} · ${esc(when(x.at))}</p><p style="margin:0">${esc(x.body)}</p>
        ${x.corrections.map((c) => `<p class="muted" style="margin:8px 0 0"><strong>${esc(c.text)}</strong> (${esc(when(c.at))})</p>`).join('')}</div>
      ${x.sources.length ? `<div class="section-label">Sources</div>${x.sources.map((s) => (s.npcId && npc(s.npcId) ? row('person', s.npcId, s.name, ATTRIBUTION[s.attribution].name, '', npc(s.npcId)) : `<div class="kv"><span>${esc(s.name)}</span><span>${esc(ATTRIBUTION[s.attribution].name)}</span></div>`)).join('')}` : ''}
      ${x.segment ? `<div class="card"><h3>On air</h3>${kv([['Delivery', `${x.segment.delivery}/100`], ['What you did', x.segment.choices.map((c) => jn.LIVE_CHOICES[c].label.toLowerCase()).join(', ')]])}${x.segment.note ? `<p class="muted" style="margin:4px 0 0">${esc(x.segment.note)}</p>` : ''}</div>` : ''}
      ${x.reporterId === p.id && store.state.year - x.year <= 1 && accountsOf(p.id).some((a) => a.status === 'active') ? `<div class="btn-stack">${btn('share', 'Share it on your accounts', { arg: x.id, sub: 'A link to the article, from Digital Life.' })}</div>` : ''}
      ${x.reporterId === p.id && !jn.followStoryWhy(x.id, p) ? `<div class="btn-stack">${btn('follow', 'Follow it up', { arg: x.id, sub: 'What has happened since?' })}</div>` : ''}
      ${kv([[x.medium === 'television' ? 'Viewers' : x.medium === 'radio' ? 'Listeners' : 'Readers', x.readers.toLocaleString('en-US')]])}`;
  },

  career(p) {
    const j = jn.J(p);
    const r0 = (v) => `${Math.round(v ?? 0)}/100`;
    const cs = jn.contacts(p);
    return `<div class="card"><h3>Your journalism</h3>${kv([['Stories published', String(jn.myPubs(p).length)], ['Exclusives', String(jn.myPubs(p).filter((x) => x.exclusive).length)], ['Corrections run', String(jn.myPubs(p).reduce((n, x) => n + x.corrections.length, 0))], ['Prizes', String(j.awards.length)]])}</div>
      <div class="card"><h3>Standing</h3><p class="muted" style="margin:0 0 6px">Each is its own: famous is not the same as accurate.</p>${kv([['Accuracy', r0(j.rep.accuracy)], ['Trust of sources and readers', r0(j.rep.trust)], ['Public recognition', r0(j.rep.recognition)], ...(j.rep.leadership != null ? [['Leadership', r0(j.rep.leadership)]] : [])])}
        ${kv([['Reporting', r0(j.skills.reporting)], ['Interviewing', r0(j.skills.interviewing)], ['Verification', r0(j.skills.verification)], ['Writing', r0(j.skills.writing)], ...(j.skills.broadcast != null ? [['On air', r0(j.skills.broadcast)]] : [])])}</div>
      ${cs.length ? `<div class="section-label">Your contacts</div>${cs.slice(0, 12).map((c) => row('person', c.npcId, `${c.n.firstName} ${c.n.lastName}`, `${c.n.occupation ?? ''} · spoken ${c.times} time${c.times === 1 ? '' : 's'}`, c.trust >= 60 ? 'Trusts you' : c.trust < 35 ? 'Wary' : '', c.n)).join('')}` : ''}
      ${j.awards.length ? `<div class="section-label">Prizes</div>${j.awards.map((a) => `<div class="kv"><span>${esc(a.name)}</span><span>${a.year}</span></div>`).join('')}` : ''}
      ${jn.isReporter(p) ? `<div class="btn-stack">${btn('takeleave', 'Take a year\'s leave', { sub: 'A year away from the desk. Your job is kept.' })}${btn('lighter', 'Ask for a lighter year', { sub: 'Fewer assignments next year.' })}</div>` : ''}
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
    const b = await pickModal({ title: 'Your beat', cancel: 'Back', options: Object.entries(BEATS).filter(([, v]) => !v.assigned).map(([k, v]) => { const why = jn.beatWhy(k, p); return { value: k, label: v.name, sub: why || v.blurb, disabled: !!why }; }) });
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
  practice: (_, x) => x.say(jn.practiceDelivery()),
  anchor: (_, x) => x.say(jn.anchorAudition()),
  move: async (id, x) => { if (await confirmModal({ title: `Apply to ${jn.outlet(id)?.name}?`, body: 'If they take you, you move there: stories in progress here are left behind.', yes: 'Apply' })) await x.say(jn.applyMove(id)); },
  async guest(_, x) {
    const g = await pickModal({ title: 'Who to ask on', cancel: 'Back', options: jn.guestChoices().map((y) => ({ value: y.id, label: y.name, sub: y.role })) });
    if (!g) return;
    const how = await pickModal({ title: 'How will you interview them?', cancel: 'Back', options: [{ value: 'fair', label: 'Hard questions, asked fairly', sub: 'Let them answer.' }, { value: 'gotcha', label: 'Go for the headline', sub: 'Noise, not trust.' }] });
    if (how) await x.say(jn.interviewGuest(g, how));
  },
  async live(id, x) {
    const picks = [];
    for (let i = 0; i < 3; i++) {
      const c = await pickModal({ title: i ? 'And then?' : 'You are live', body: i ? '' : 'Three beats, in your own words. The camera does not wait.', cancel: i ? 'Hand back to the studio' : 'Not yet',
        options: Object.entries(jn.LIVE_CHOICES).filter(([k]) => !picks.includes(k)).map(([k, v]) => ({ value: k, label: v.label })) });
      if (!c) break;
      picks.push(c);
    }
    if (picks.length) await x.say(jn.present(id, picks));
  },
  freelance: (_, x) => x.say(jn.goFreelance()),
  async posting(_, x) {
    const p = player();
    const c = await pickModal({ title: 'Where would you like to report from?', body: 'Politics, business, science and everyday life there. Your newsroom arranges the visa.', cancel: 'Back',
      options: Object.values(COUNTRIES).filter((y) => y.id !== p.countryId).sort((a, b) => a.name.localeCompare(b.name)).map((y) => ({ value: y.id, label: `${y.flag ?? ''} ${y.name}`.trim() })) });
    if (c) await x.say(jn.requestPosting(c));
  },
  home: (_, x) => x.say(jn.endPosting()),
  async start(_, x) {
    const p = player();
    const kind = await pickModal({ title: 'Start a publication', body: 'With your own money. Many lose money; the good ones find readers who stay.', cancel: 'Back',
      options: Object.entries(OWN_KINDS).map(([k, v]) => { const why = jn.startWhy(k, p); return { value: k, label: v.name, disabled: !!why, sub: why || `${fmtMoney(jn.startCost(k), country())} to start` }; }) });
    if (!kind) return;
    const name = await inputModal({ title: 'Its name', label: 'What it is called', maxLength: 40 });
    const policy = await pickModal({ title: 'Your editorial policy', body: 'You edit it yourself until you hire an editor.', cancel: 'Back', options: [{ value: 'careful', label: 'Careful', sub: 'Nothing runs on one source.' }, { value: 'standard', label: 'Standard', sub: 'The ordinary bar.' }] });
    if (policy) await x.say(jn.startPublication(kind, name ?? '', policy));
  },
  hire: (role, x) => x.say(jn.hireStaff(role)),
  letgo: async (id, x) => { if (await confirmModal({ title: 'Let them go?', body: 'They will not forget it.', yes: 'Let them go', danger: true })) await x.say(jn.letGo(id)); },
  sell: async (_, x) => { if (await confirmModal({ title: 'Sell it?', body: 'It carries on without you.', yes: 'Sell' })) await x.say(jn.sellPublication()); },
  close: async (_, x) => { if (await confirmModal({ title: 'Close it?', body: 'The last edition goes out. The archive stays up.', yes: 'Close it', danger: true })) await x.say(jn.closePublication()); },
  async pitch(id, x) {
    const s = jn.storyOf(id);
    const o = await pickModal({ title: 'Pitch it to', cancel: 'Back', options: jn.outletsHere().map((y) => ({ value: y.id, label: y.name, disabled: !!s.pitched?.[y.id], sub: s.pitched?.[y.id] ? 'Pitched already' : `${OUTLET_KINDS[y.kind].name} · pays about ${fmtMoney(jn.feeFor(y, s), country())}` })) });
    if (o) await x.say(jn.pitch(id, o));
  },
  async lead(_, x) {
    const p = player();
    const b = await pickModal({ title: 'Pitch a lead', body: 'A story you want to chase, on any beat open to you.', cancel: 'Back', options: Object.entries(BEATS).filter(([, v]) => !v.assigned).map(([k, v]) => { const why = jn.pitchLeadWhy(k, p); return { value: k, label: v.name, sub: why || v.blurb, disabled: !!why }; }) });
    if (b) await x.say(jn.pitchLead(b));
  },
  follow: (id, x) => x.say(jn.followStory(id)),
  disclose: (id, x) => x.say(jn.disclose(id)),
  help: (id, x) => x.say(jn.requestSupport(id)),
  lighter: (_, x) => x.say(jn.askLighterYear()),
  async share(id, x) {
    const p = player();
    const pub = jn.S().pubs[id];
    const accs = accountsOf(p.id).filter((a) => a.status === 'active');
    const accId = accs.length === 1 ? accs[0].id : await pickModal({ title: 'Share it on', cancel: 'Back', options: accs.map((a) => ({ value: a.id, label: PLATFORM_BY_ID[a.platformId]?.name ?? a.platformId, sub: `@${a.handle}` })) });
    if (!accId) return;
    const fmt = formatOptions(accId).find((f) => !f.why && ['text', 'link', 'photo'].includes(f.id)) ?? formatOptions(accId).find((f) => !f.why);
    if (!fmt) { await x.say({ ok: false, text: 'That account cannot take a post right now.', tone: 'neutral' }); return; }
    await x.say(postOnline({ accountId: accId, format: fmt.id, topic: 'work', source: { type: 'article', key: `article:${id}`, text: pub.headline } }));
  },
  async research(id, x) {
    const lv = await pickModal({ title: 'Research budget', cancel: 'Back', options: [{ value: '0', label: 'None', sub: 'Cheapest. Mistakes are yours to find.' }, { value: '1', label: 'A fact-checker', sub: 'Costs more each year.' }, { value: '2', label: 'A research desk', sub: 'Costs a good deal each year.' }] });
    if (lv != null) await x.say(jn.setResearch(id, Number(lv)));
  },
  async bureau(id, x) {
    const p = player();
    const city = await pickModal({ title: 'A bureau in', cancel: 'Back', options: COUNTRIES[p.countryId].cities.filter((c) => c !== p.city).map((c) => { const why = jn.bureauWhy(id, c, p); return { value: c, label: c, sub: why, disabled: !!why }; }) });
    if (city) await x.say(jn.openBureau(id, city));
  },
  async launch(_, x) {
    const p = player();
    const kind = await pickModal({ title: 'Launch another title', body: 'It needs an editor to run it, hired with it.', cancel: 'Back', options: Object.entries(OWN_KINDS).map(([k, v]) => { const why = jn.expandWhy(k, p); return { value: k, label: v.name, disabled: !!why, sub: why || `${fmtMoney(jn.startCost(k), country())} to start` }; }) });
    if (!kind) return;
    const name = await inputModal({ title: 'Its name', label: 'What it is called', maxLength: 40 });
    await x.say(jn.launchTitle(kind, name ?? ''));
  },
  desk: (arg, x) => { const [id, d] = arg.split('|'); return x.say(jn.deskDecide(id, d)); },
  doc: (id, x) => x.say(jn.startDocumentary(id)),
  docwork: (id, x) => x.say(jn.workDocumentary(id)),
  docrelease: (id, x) => x.say(jn.releaseDocumentary(id)),
  async takeleave(_, x) { if (await confirmModal({ title: 'Take a year\'s leave?', body: 'From next year: no assignments for a year.', yes: 'Take leave' })) await x.say(jn.takeLeave()); },
  correct: (id, x) => x.say(jn.answerComplaint(id, true)),
  stand: (id, x) => x.say(jn.answerComplaint(id, false)),
};

/** Opens the Journalism page. */
export function openJournalism(api, start = {}) {
  const p0 = player();
  if (p0.career?.careerId === 'journalist') jn.migrateJournalist(p0);
  const st = { stack: [{ view: start.view ?? 'overview', arg: start.arg ?? null }] };
  const modal = openModal('<div data-jn></div>', { dismissable: true, full: true, title: 'Journalism' });
  modal.el.classList.add('world-modal', 'jn-page');
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

/** Family Archive → Journalism: each journalist in the family and their published work as it ran. Never a notebook or a confidential source. */
export function openJournalismLegacy() {
  const list = jn.familyJournalism();
  return openModal(`<div class="eyebrow">Professional legacy</div><h2>Journalism in the family</h2>
    ${list.length ? list.map((x) => `<div class="card"><h3>${esc(x.name)}</h3>
      ${(x.history ?? []).map((h) => kv([[String(h.year), h.text]])).join('')}
      ${(x.awards ?? []).map((a) => kv([[String(a.year), a.name]])).join('')}
      <div class="section-label">Published</div>${x.pubs.map((y) => `<div class="kv"><span>${y.year} · "${esc(y.headline)}"</span><span>${esc(y.outlet)}</span></div>${y.corrections.map((c) => `<p class="muted" style="margin:0 0 6px">${esc(c)}</p>`).join('')}`).join('')}</div>`).join('')
    : '<p class="empty">Nobody in the family has published journalism yet.</p>'}
    <p class="muted">Only what was published is kept here: reporters' notebooks, drafts and confidential sources stay private.</p>`, { dismissable: true });
}
