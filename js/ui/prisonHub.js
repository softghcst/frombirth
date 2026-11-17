// Prison life: your story continues, even here. Shown in Pursuits while the
// player is in custody, one section at a time. The section open is
// remembered while the app is open.
import { store, player, country } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import * as jail from '../engine/prison.js';
import * as law from '../engine/justice.js';
import * as k from '../engine/cases.js';
import { roleLabel } from '../engine/relationships.js';
import { LIFE_SENTENCE } from '../data/crimes.js';
import { OFFENSE_BY_ID, PROGRAMME_BY_ID, FACILITY_KINDS } from '../data/justice.js';
import { meterHtml } from './meter.js';
import { messageModal, pickModal, confirmModal } from './modals.js';
import { openNpc } from './tabs/people.js';
import { openCaseFile } from './justice.js';
import { playEscape } from './minigames/escape.js';

let section = 'overview';
const SECTIONS = [['overview', 'Overview'], ['daily', 'Daily life'], ['people', 'People'], ['family', 'Family & visits'], ['education', 'Education'],
  ['work', 'Work'], ['health', 'Health'], ['legal', 'Legal case'], ['release', 'Release']];

const yrs = (n) => `${n} year${n === 1 ? '' : 's'}`;
const row = (n, sub, attr) => `<button class="row" ${attr}="${n.id}"><div class="main"><strong>${esc(n.firstName)} ${esc(n.lastName)}</strong><small>${esc(sub)}</small></div>
  <div class="side">${Math.round(n.meters.relationship)}%</div></button>`;

/** The hub's markup for the current section. */
export function prisonHub() {
  law.upgradeLegacy();
  const c = jail.cell();
  const f = jail.facility();
  const show = SECTIONS.filter(([id]) => id !== 'legal' || jail.custodyCase() || !c.appealed);
  if (!show.some(([id]) => id === section)) section = 'overview';
  const nav = `<div class="hub-nav" role="tablist">${show.map(([id, label]) => `<button role="tab" aria-selected="${id === section}" class="${id === section ? 'on' : ''}" data-hub="${id}">${esc(label)}</button>`).join('')}</div>`;
  return `<p class="muted" style="margin-bottom:8px">Your story continues, even here.</p>${nav}${BODY[section](c, f)}`;
}

const BODY = {
  overview(c, f) {
    const s = k.J().sentences[c.sentenceId];
    const out = jail.releaseOutlook();
    const kids = Object.entries(c.guardians ?? {}).map(([id, g]) => [store.state.npcs[id], g]).filter(([n]) => n?.alive);
    return `<div class="card"><h3>${esc(f?.name ?? 'Custody')}</h3>
      <div class="kv"><span>Kind</span><span>${esc(FACILITY_KINDS[f?.kind]?.name ?? '')}${f ? ` · ${esc(f.city)}` : ''}</span></div>
      <div class="kv"><span>Legal status</span><span>${esc(law.status())}${c.deathRow ? ', on death row' : ''}</span></div>
      ${s ? `<div class="kv"><span>Sentence</span><span>${esc(k.describe(s))} for ${esc(OFFENSE_BY_ID[s.offenseId].name.toLowerCase())}</span></div>` : ''}
      <div class="kv"><span>Served</span><span>${yrs(c.served)}</span></div>
      <div class="kv"><span>Release</span><span>${esc(out.text)}</span></div>
      ${c.programme ? `<div class="kv"><span>Studying</span><span>${esc(PROGRAMME_BY_ID[c.programme.id].name)}</span></div>` : ''}
      ${c.job ? `<div class="kv"><span>Work</span><span>${esc(jail.jobOptions().find((j) => j.id === c.job.id)?.name ?? '')}</span></div>` : ''}
      ${kids.map(([n, g]) => `<div class="kv"><span>${esc(n.firstName)}, ${n.age}</span><span>living with ${g === 'care' ? 'foster carers' : esc(k.nameOf(g))}</span></div>`).join('')}
      <div style="margin-top:10px">${meterHtml('Respect', c.respect, true)}${meterHtml('Conduct', c.conduct, true)}</div>
      <p class="muted" style="margin-top:8px">Conduct, courses and a place to live matter at a parole review. Respect keeps trouble away, but so does asking for help.</p>
      ${jail.paroleDue() ? '<button class="btn primary" data-hub-act="parole" style="margin-top:10px">Prepare for your parole review</button>' : ''}
    </div>`;
  },
  daily(c) {
    return `<div class="card"><h3>How your days go</h3>
      <p class="muted" style="margin-bottom:10px">What the year is built around. It carries on without you having to choose each day.</p>
      <div class="btn-stack">${jail.routineOptions().map((r) => `<button class="btn stacked ${r.now ? 'primary' : ''}" data-routine="${r.id}">${esc(r.name)}<small>${esc(r.blurb)}</small></button>`).join('')}</div></div>
      <div class="card"><h3>This year</h3><div class="btn-stack">
        ${jail.prisonActions().map((a) => `<button class="btn ${a.danger ? 'danger' : ''}" data-prison="${a.id}">${esc(a.label)}</button>`).join('')}
        <button class="btn" data-help="report">Report a threat to staff</button>
        <button class="btn" data-help="mediation">Ask for mediation</button>
        <button class="btn" data-help="transfer">Ask to move wing</button>
      </div></div>
      ${c.discipline.length ? `<div class="card"><h3>Conduct record</h3>${c.discipline.slice(-6).reverse().map((d) => `<div class="kv"><span>${d.year}</span><span>${esc(d.allegation ? `${d.allegation}: ${d.finding}${d.penalty ? ` (${d.penalty})` : ''}` : d.text)}</span></div>`).join('')}</div>` : ''}`;
  },
  people() {
    const mates = jail.inmatesNear();
    const staff = jail.staffNear();
    return `<div class="card"><h3>On your wing</h3>
      ${mates.map((n) => row(n, `${n.age} · loves ${n.flags.inmate.interest} · ${yrs(n.flags.inmate.yearsLeft)} left${player().npcIds.includes(n.id) ? ` · ${roleLabel(n)}` : ''}`, 'data-mate')).join('')}
      <p class="muted" style="margin-top:8px">Tap someone to see who they are. People here have their own lives, goals and release dates.</p></div>
      <div class="card"><h3>Staff</h3>${staff.map((s) => `<button class="row" data-staff="${s.npc.id}"><div class="main"><strong>${esc(s.npc.firstName)} ${esc(s.npc.lastName)}</strong><small>${esc(s.role.name)}</small></div></button>`).join('')}</div>`;
  },
  family(c) {
    const list = jail.contacts();
    return `<div class="card"><h3>Family and friends</h3>
      ${list.length ? list.map((n) => row(n, roleLabel(n) + (n.flags.abroad ? ' · abroad' : '') + (n.age < 18 ? `, ${n.age}` : ''), 'data-contact')).join('') : '<p class="muted">There is nobody on your list.</p>'}
      <p class="muted" style="margin-top:8px">Up to four letters, three calls and two visiting orders a year. People decide for themselves whether to come.</p></div>
      ${c.visits.length ? `<div class="card"><h3>Visits</h3>${c.visits.slice(-8).reverse().map((v) => `<div class="kv"><span>${v.year}</span><span>${esc(k.nameOf(v.npcId))}</span></div>`).join('')}</div>` : ''}`;
  },
  education(c) {
    const list = jail.programmeOptions();
    const done = Object.keys(c.studied ?? {});
    return `<div class="card"><h3>Education</h3>
      ${c.programme ? `<div class="kv"><span>Now</span><span>${esc(PROGRAMME_BY_ID[c.programme.id].name)}: ${Math.min(100, Math.round(c.programme.progress / PROGRAMME_BY_ID[c.programme.id].years * 100))}%</span></div>` : ''}
      ${done.map((id) => `<div class="kv"><span>Completed</span><span>${esc(PROGRAMME_BY_ID[id].name)}</span></div>`).join('')}
      <p class="muted" style="margin:8px 0 10px">Qualifications earned here go on your education record, the same as any other.</p>
      <div class="btn-stack">${list.map((x) => `<button class="btn stacked ${x.now ? 'primary' : ''}" data-course="${x.id}" ${x.ok && !x.now ? '' : 'disabled'}>${esc(x.name)}<small>${esc(x.now ? 'Enrolled.' : x.why || x.blurb)}</small></button>`).join('')}
      ${c.programme ? '<button class="btn" data-hub-act="leaveCourse">Leave the course</button>' : ''}</div></div>`;
  },
  work(c) {
    const cty = country();
    return `<div class="card"><h3>Work</h3>
      <div class="btn-stack">${jail.jobOptions().map((j) => `<button class="btn stacked ${j.now ? 'primary' : ''}" data-job="${j.id}" ${j.ok && !j.now ? '' : 'disabled'}>${esc(j.name)}<small>${esc(j.why || `${fmtMoney(j.pay, cty)} a year${j.now ? ' · your job' : ''}`)}</small></button>`).join('')}</div>
      ${c.work.length ? `<div class="section-label">Hours worked</div>${c.work.slice(-5).reverse().map((w) => `<div class="kv"><span>${w.year}</span><span>${w.hours} hours · ${esc(fmtMoney(w.pay, cty))}</span></div>`).join('')}` : ''}</div>`;
  },
  health() {
    return `<div class="card"><h3>Health and well-being</h3>${meterHtml('Health', player().stats.health, true)}${meterHtml('Mood', player().stats.mood, true)}
      <div class="btn-stack" style="margin-top:10px">
        <button class="btn" data-hub-act="healthcare">See the healthcare team</button>
        <button class="btn" data-hub-act="counselling">Counselling</button>
        <button class="btn" data-hub-act="course">Join a rehabilitation course</button>
      </div></div>`;
  },
  legal() {
    const c = jail.custodyCase();
    if (!c) return `<div class="card"><h3>Your case</h3><p class="muted">This sentence is older than the court records: only its length was kept.</p>
      <button class="btn" data-prison="appeal" style="margin-top:10px">Appeal your sentence</button></div>`;
    const grounds = k.appealGrounds(c);
    return `<div class="card"><h3>Your case</h3>
      <div class="kv"><span>Case</span><span>${esc(OFFENSE_BY_ID[c.charges[0].offenseId].name)} · ${esc(c.court)}</span></div>
      <div class="kv"><span>Appeals</span><span>${c.appealIds.length ? c.appealIds.map((id) => esc(k.J().appeals[id].outcome)).join(', ') : 'None yet'}</span></div>
      <p class="muted" style="margin-top:8px">${grounds.length ? 'You have grounds to appeal. Each ground can be argued once.' : 'There are no grounds left to argue.'}</p>
      <button class="btn" data-file="${esc(c.id)}" style="margin-top:10px">Open the case file</button></div>`;
  },
  release(c) {
    const out = jail.releaseOutlook();
    return `<div class="card"><h3>Sentence and release</h3>
      <div class="kv"><span>Left to serve</span><span>${c.yearsLeft >= LIFE_SENTENCE ? 'Life' : yrs(c.yearsLeft)}</span></div>
      <p style="margin-top:8px">${esc(out.text)}</p>
      ${c.reviews.length ? `<div class="section-label">Parole reviews</div>${c.reviews.map((r) => `<div class="kv"><span>${r.year}</span><span>${r.granted ? 'Granted' : 'Refused'}: ${esc(r.reasons.join(', '))}</span></div>`).join('')}` : ''}
      ${jail.paroleDue() ? '<button class="btn primary" data-hub-act="parole" style="margin-top:10px">Prepare for your parole review</button>' : ''}
      <p class="muted" style="margin-top:10px">On release you go to family if they will have you, or to a hostel, with a release grant. Work and study can pick up where they left off.</p></div>`;
  },
};

async function report(api, r) {
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

async function contact(api, n) {
  const what = await pickModal({ title: `${n.firstName} ${n.lastName}`, body: `${roleLabel(n)}, ${n.age}.`, cancel: 'Back',
    options: [{ value: 'letter', label: 'Write a letter' }, { value: 'call', label: 'Phone them' }, { value: 'visit', label: 'Send a visiting order' }, { value: 'profile', label: 'See their profile' }] });
  if (what === 'profile') return openNpc(n, api, { readOnly: true });
  if (!what) return undefined;
  return report(api, { letter: jail.writeLetter, call: jail.phoneCall, visit: jail.requestVisit }[what](n.id));
}

async function mate(api, n) {
  const what = await pickModal({ title: `${n.firstName} ${n.lastName}`, body: `${n.age}. They ${n.flags.inmate.background}. They want to ${n.flags.inmate.goal}.`, cancel: 'Back',
    options: [{ value: 'know', label: 'Spend time together' }, { value: 'study', label: 'Study together', disabled: !jail.cell().programme }, { value: 'profile', label: 'See their profile' }] });
  if (what === 'profile') return openNpc(n, api, { readOnly: true });
  if (what === 'know') return report(api, jail.getToKnow(n.id));
  if (what === 'study') return report(api, jail.studyTogether(n.id));
  return undefined;
}

async function parole(api) {
  const how = await pickModal({ title: 'Your parole review', body: 'The board reads your record inside and your plans for outside, and listens to you. What you say is part of it, not all of it.', cancel: 'Let them decide on the file',
    options: [{ value: 'responsibility', label: 'Talk about what you did and what has changed' }, { value: 'plan', label: 'Talk about where you will live and what you will do' },
      { value: 'innocence', label: 'Say, again, that you did not do it' }] });
  await report(api, jail.paroleHearing(how ?? 'file'));
}

async function escape(api) {
  const sure = await confirmModal({ title: 'Attempt an escape?', body: 'One attempt a year. Fail and you get two more years. Succeed and you are free, and hunted, and every year on the run could be the one you are caught.', yes: 'Go tonight', danger: true });
  if (!sure) return;
  const layout = jail.escapeLayout();
  if (!jail.beginEscape()) { await messageModal({ body: 'The guards are watching you too closely this year.' }); return; }
  api.changed();
  const out = await playEscape(layout);
  await report(api, jail.finishEscape(out));
}

/** Handles a click in the hub. Returns true when it did. */
export function hubClick(e, api, joinGang) {
  const t = e.target;
  const hub = t.closest('[data-hub]')?.dataset.hub;
  if (hub) { section = hub; api.changed(); return true; }
  const r = t.closest('[data-routine]')?.dataset.routine;
  if (r) { report(api, jail.setRoutine(r)); return true; }
  const course = t.closest('[data-course]')?.dataset.course;
  if (course) { report(api, jail.enrol(course)); return true; }
  const job = t.closest('[data-job]')?.dataset.job;
  if (job) { report(api, jail.takeJob(job)); return true; }
  const help = t.closest('[data-help]')?.dataset.help;
  if (help) { report(api, jail.seekHelp(help)); return true; }
  const file = t.closest('[data-file]')?.dataset.file;
  if (file) { openCaseFile(file, api); return true; }
  const who = t.closest('[data-contact],[data-mate],[data-staff]');
  if (who) {
    const n = store.state.npcs[who.dataset.contact ?? who.dataset.mate ?? who.dataset.staff];
    if (who.dataset.contact) contact(api, n);
    else if (who.dataset.mate) mate(api, n);
    else openNpc(n, api, { readOnly: true });
    return true;
  }
  const act = t.closest('[data-hub-act]')?.dataset.hubAct;
  if (act) {
    if (act === 'parole') parole(api);
    else report(api, { healthcare: jail.healthcare, counselling: jail.counselling, course: jail.joinCourse, leaveCourse: jail.leaveCourse }[act]());
    return true;
  }
  const pr = t.closest('[data-prison]')?.dataset.prison;
  if (pr) {
    if (pr === 'gang') joinGang(api);
    else if (pr === 'escape') escape(api);
    else report(api, { workout: jail.workOut, read: jail.read, leaveGang: jail.leaveGang, riot: jail.startRiot, appeal: jail.appeal }[pr]());
    return true;
  }
  return false;
}
