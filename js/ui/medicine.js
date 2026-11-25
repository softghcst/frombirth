// My Medical Career: one place for a doctor's life, from premedical years to private practice.
// Training and applications, this year's patients (worked step by step), the hospital and its
// posts, a practice of one's own, and the people of hospital life. Every section reads the
// medical engine (engine/medicine); every button does something.
//
// Patient cases are confidential: they are shown here only, to the physician.
import { player, country } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import { SPECIALTY_BY_ID, SKILLS, RANKS, DEPARTMENTS, jurisdiction } from '../data/medicine.js';
import { openModal, messageModal, pickModal } from './modals.js';
import { meterHtml } from './meter.js';
import { med, M, currentSpecialty, specialtyName, qualified, reputationOf } from '../engine/medicine/core.js';
import * as train from '../engine/medicine/training.js';
import * as cases from '../engine/medicine/cases.js';
import * as ladder from '../engine/medicine/ladder.js';
import * as jobs from '../engine/medicine/jobs.js';
import * as practice from '../engine/medicine/practice.js';
import { setDrama, DRAMA, requestSupport } from '../engine/medicine/drama.js';
import * as research from '../engine/medicine/research.js';
import * as work from '../engine/worklife.js';
import * as market from '../engine/employers.js';
import { openNpc } from './tabs/people.js';
import { hospitalName, hospital, kindName, deptOf, deptHead } from '../engine/medicine/hospitals.js';
import { store } from '../state.js';

const kv = (rows) => rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
const btn = (act, label, o = {}) => `<button type="button" class="btn ${o.cls ?? ''}" data-act="${act}"${o.arg != null ? ` data-arg="${esc(o.arg)}"` : ''}${o.disabled ? ' disabled' : ''}>${esc(label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`;
const card = (title, body) => `<div class="card"><h3>${esc(title)}</h3>${body}</div>`;
const muted = (t) => `<p class="muted">${esc(t)}</p>`;

/** Whether the medical career page has anything to show. */
export function medicineOpen(p = player()) {
  return !!p.medicine || train.premedOpen(p) || (p.education.enrolled && ['medical', 'podiatric'].includes(p.education.stage));
}

const SECTIONS = [['overview', 'Overview'], ['training', 'Training'], ['patients', 'Patients'], ['hospital', 'Hospital'], ['practice', 'Practice'], ['people', 'People']];

function sectionsFor(p, m) {
  return SECTIONS.filter(([id]) => {
    if (!m) return id === 'overview' || id === 'training';
    if (id === 'patients') return !!cases.roleNow(m, p);
    if (id === 'hospital') return !!(m.training || m.job || qualified(m).length);
    if (id === 'practice') return qualified(m).length > 0 || m.clinicIds.length > 0;
    if (id === 'people') return !!(m.training || m.job);
    return true;
  });
}

function stageWords(m, p) {
  if (!m) return train.premedOpen(p) ? 'Premedical' : 'Not on the medical route';
  if (m.training) return `${m.training.kind === 'fellowship' ? 'Fellow' : m.training.kind === 'internship' ? 'Intern' : p.countryId === 'us' ? 'Resident' : 'Specialty trainee'}, ${p.countryId === 'us' ? 'PGY-' : 'year '}${m.training.pgy} of ${m.training.years}`;
  if (m.job) return RANKS[m.job.rank]?.title ?? 'Physician';
  if (m.clinicIds.length) return 'In private practice';
  return { school: `Medical school, year ${m.school?.year ?? 1}`, graduate: 'Graduate, without a training place', none: 'Premedical' }[m.stage] ?? m.stage;
}

const VIEWS = {
  overview(p, m) {
    const j = jurisdiction(p.countryId);
    if (!m) return card('Becoming a doctor', `<p>A medical career starts with a university degree in a science or health subject, good grades, and time spent learning what medicine is like. Then four years of medical school, a residency place applied for, and years of supervised training.</p>
      ${kv([['Route here', `${j.entry === 'graduate' ? 'After a university degree' : 'Direct entry in reality; in the game, after a university degree'} · ${j.detail === 'detailed' ? 'modeled in detail' : 'simplified profile'}`], ['Training places', j.selection]])}`);
    const spec = currentSpecialty(m);
    // Hospital life at a glance: where, with whom, what is open, what could come next.
    const at = m.training?.hospitalId ?? m.job?.hospitalId;
    const sup = (m.people.supervisorIds ?? []).map((id) => store.state.npcs[id]).find((n) => n?.alive);
    const open = cases.roleNow(m, p) ? cases.caseload(m, p).filter((c) => c.status !== 'closed').length : 0;
    const chances = [...(jobs.offers(m).length ? [`${jobs.offers(m).length} job offer${jobs.offers(m).length > 1 ? 's' : ''} waiting`] : []),
      ...(m.offer && m.offer.year === store.state.year ? [`an offer to become ${RANKS[m.offer.rank].title.toLowerCase()}`] : []),
      ...(train.fellowshipOptions(m).some((f) => !f.block) ? ['fellowships open to you'] : [])];
    const glance = at ? card('Hospital life', kv([
      ['Hospital', hospitalName(at)], ['Department', DEPARTMENTS[deptOf(spec)] ?? 'Medicine'], ['Title', p.career.title ?? '—'],
      ...(sup && m.training ? [['Supervising physician', `${sup.firstName} ${sup.lastName}`]] : []),
      ['Colleagues you know', String([...m.people.colleagueIds, ...m.people.friendIds, ...(m.people.traineeIds ?? [])].filter((id) => store.state.npcs[id]?.alive).length)],
      ['Patients open this year', String(open)],
      ...(m.training ? [['Training', `${m.training.pgy} of ${m.training.years} years`]] : []),
      ...(chances.length ? [['Opportunities', chances.join('; ')]] : []),
    ])) : '';
    return glance + card(stageWords(m, p), kv([
      ['Route', m.route === 'dpm' ? 'Podiatric medicine (DPM)' : m.route === 'do' ? 'Osteopathic medicine (DO)' : 'Medicine (MD)'],
      ['Specialty', spec ? specialtyName(spec) : 'Not yet chosen'],
      ['License', m.license.status === 'full' ? m.license.name : m.training ? 'Training license: practices under supervision' : 'None yet'],
      ['Board certification', m.boards.filter((b) => b.passed).map((b) => specialtyName(b.specialtyId)).join(', ') || 'None'],
      ['Completed training', m.completed.map((c) => `${specialtyName(c.specialtyId)} (${c.from}–${c.to})`).join(', ') || 'None yet'],
      ['Reputation', `${reputationOf(m)} (from how you practice, never from survival counts)`],
      ['Jurisdiction', `${p.countryId === 'us' ? 'United States, modeled in detail' : 'Simplified profile: the broad shape, not the rules'}`],
    ])) + card('Skills', Object.entries(SKILLS).map(([k, label]) => meterHtml(label, m.skills[k], true)).join(''))
      + card('Career history', m.history.length ? `<ul>${m.history.slice(-12).reverse().map((h) => `<li>${esc(String(h.year))}: ${esc(h.text)}</li>`).join('')}</ul>` : muted('Nothing yet.'))
      + card('Hospital drama', `<p class="muted">How often the people of hospital life bring you scenes. It never changes how patients fare.</p>${Object.keys(DRAMA).map((l) => btn('drama', l[0].toUpperCase() + l.slice(1), { arg: l, cls: m.drama === l ? 'primary' : '' })).join('')}`);
  },
  training(p, m) {
    let out = '';
    if (train.premedOpen(p)) {
      out += card('Premedical year', `<p class="muted">Each counts toward a medical or podiatric school application, once a year.</p>${train.premedOptions().map((a) => btn('premed', a.name, { arg: a.id, disabled: a.done, sub: a.done ? 'Done this year' : '' })).join('')}
        ${jurisdiction(p.countryId).osteopathic ? btn('doToo', m?.doToo ? 'Apply to MD schools only' : 'Apply to osteopathic (DO) schools too') : ''}
        <p class="muted">Apply to medical or podiatric school from Work &amp; School, like any other program.</p>`);
    }
    if (!m) return out || card('Training', muted('Nothing to show yet.'));
    if (m.school && !m.school.graduated) {
      const s = m.school;
      out += card(`${s.name}, year ${s.year}`, kv([
        ['Exams', Object.entries(s.exams).map(([id, x]) => `${id.toUpperCase()}: ${x.pass ? 'passed' : 'not passed'}`).join(', ') || 'None sat yet'],
        ['Rotations', s.rotations.slice(-8).map((r) => `${r.name}: ${r.grade}`).join(', ') || 'Clinical years begin in year three'],
      ]) + (s.year >= 3 || p.education.yearInStage >= 3 ? applyBlock(m) : muted('Residency applications open in your final year.')));
    }
    if (m.stage === 'graduate' && !m.training) {
      out += card('Applying for a training place', `${applyBlock(m)}${btn('research', 'Spend the year in research', { sub: 'A stronger application next time' })}${btn('reapply', m.reapply === false ? 'Apply again this year' : 'Stop applying', { arg: m.reapply === false ? 'on' : 'off' })}`);
    }
    if (m.training) {
      const t = m.training;
      out += card(`${t.kind === 'fellowship' ? 'Fellowship' : t.kind === 'internship' ? 'Internship' : 'Residency'}${t.specialtyId ? `: ${specialtyName(t.specialtyId)}` : ''}`, kv([
        ['Hospital', hospitalName(t.hospitalId)], ['Year', `PGY-${t.pgy} of ${t.years}`], ['Started', String(t.startYear)],
        ['Evaluations', t.evals.map((e) => `PGY-${e.pgy}: ${e.score}`).join(', ') || 'The first comes at the end of the year'],
        ...(t.chief ? [['Chief resident', 'Yes']] : []), ...(t.probation ? [['Remediation', 'Under closer supervision this year']] : []),
      ]) + muted('A resident decides nothing alone: plans are reviewed, and operations are done with a supervising surgeon.'));
    }
    const fel = train.fellowshipOptions(m);
    if (fel.length) out += card('Fellowships', `<p class="muted">Only after the residency they follow from. Places are competitive.</p>${fel.map((f) => btn('fellowship', `${f.name} (${f.years} ${f.years === 1 ? 'year' : 'years'})`, { arg: f.id, disabled: !!f.block && !(m.training?.pgy >= m.training?.years), sub: m.applyFellowship === f.id ? 'Applied' : f.block })).join('')}`);
    const s = SPECIALTY_BY_ID[currentSpecialty(m)];
    if (s?.focus && !m.training) out += card('Focus', s.focus.map((f) => btn('focus', f.replace('_', ' '), { arg: f, cls: m.focus === f ? 'primary' : '' })).join(''));
    if (m.legacy && !m.declared && m.stage === 'practice') out += card('Your specialty', `<p class="muted">You were practicing before this record was kept. Name your specialty once.</p>${btn('declare', 'Name your specialty')}`);
    return out;
  },
  patients(p, m) {
    const list = cases.caseload(m, p);
    const role = cases.roleNow(m, p);
    const head = muted(role === 'student' ? 'As a student you examine and present; the team decides.' : cases.supervised(role) ? 'You propose the plan; your supervising physician reviews it.' : 'You decide, within your privileges. Refer what you do not do.');
    const st = cases.caseStats(m);
    return card(`This year's patients (${list.length})`, head + (list.length ? list.map((c) => {
      const v = cases.caseView(c.id);
      return btn('case', `${v.label}${v.followUp ? ' (follow-up)' : ''}`, { arg: c.id, sub: c.status === 'closed' ? `Closed: ${v.outcome.result}` : `${v.patient?.first ?? 'Patient'}, ${v.patient?.age ?? '?'}` });
    }).join('') : muted('No patients this year.')) + muted('Cases you do not open are handled in the run of a busy year. They are confidential and never appear in your life story.'))
      + card('Your record', kv([['Patients seen', String(st.total)], ['Procedures performed', String(st.procedures)], ['Assisted', String(st.assisted)], ['Average judgment', st.judgment == null ? '—' : `${st.judgment}/100`]]));
  },
  hospital(p, m, st = {}) {
    let out = '';
    const where = m.training?.hospitalId ?? m.job?.hospitalId;
    if (where) {
      const h = hospital(where);
      const spec = currentSpecialty(m);
      const dept = deptOf(spec);
      const headId = h.heads[dept];
      const head = headId === (p.id ?? 'player') ? null : (headId ? store.state.npcs[headId] : deptHead(h, dept));
      out += card(hospitalName(where), kv([['Kind', kindName(h)], ['Teaching', h.teaching ? 'Yes, runs residency programs' : 'No'],
        ['Departments', h.depts.map((d) => DEPARTMENTS[d] ?? d).join(', ')],
        ['Your department', `${DEPARTMENTS[dept] ?? 'Medicine'}${head ? `, led by ${head.firstName} ${head.lastName}` : headId ? ', led by you' : ''}`],
        ...(m.job ? [['Your post', p.career.title], ['Since', String(m.job.since)]] : [])]));
    }
    if (m.offer && m.offer.year === store.state.year) out += card('An offer', `<p>${esc(hospitalName(m.offer.hospitalId))} offers you the post of ${esc(RANKS[m.offer.rank].title.toLowerCase())}.</p>${btn('offer', 'Accept', { arg: 'yes', cls: 'primary' })}${btn('offer', 'Decline', { arg: 'no' })}`);
    let jobsOut = '';
    for (const o of jobs.offers(m)) {
      const name = market.employer(o.hospitalId)?.name ?? 'A hospital';
      jobsOut += card(`Offer: ${name}`, `${kv([['Post', RANKS[o.rank].title], ['Salary', `${fmtMoney(o.salary, country())} a year`], ['Where', `${o.city}${o.city !== p.city ? (o.relocation ? ', move paid' : ', move at your own cost') : ''}`]])}
        ${btn('accept', 'Accept', { arg: o.hospitalId, cls: 'primary' })}${btn('negotiate', 'Negotiate', { arg: o.hospitalId, disabled: o.negotiated })}${btn('review', 'Review the employer', { arg: o.hospitalId })}${btn('decline', 'Decline', { arg: o.hospitalId })}`);
    }
    const scope = st.jobScope ?? 'city';
    const posts = jobs.postings(scope, p, m);
    if (posts.length || qualified(m).length) jobsOut += card('Hospital jobs', `${btn('scope', scope === 'city' ? 'Show the whole country' : `Show ${p.city} only`, { arg: scope === 'city' ? 'country' : 'city' })}
      ${posts.map((o) => `<div class="row" style="gap:6px;flex-wrap:wrap">${btn('post', `${o.name}${o.away ? ` (${o.city})` : ''}`, { arg: o.id, disabled: !!o.block, sub: o.block || `${o.kind} · ${o.open} opening${o.open === 1 ? '' : 's'}` })}${btn('review', 'Review', { arg: o.id })}</div>`).join('') || muted('No posts in your specialty.')}`);
    if (!m.job) out = jobsOut + out;
    const r = research.researchOptions(m, p);
    const rs = m.research;
    if (r.length) out += card('Research and teaching', `${rs ? kv([['Papers', String(rs.papers.length)], ['Projects under way', String(rs.projects.length)], ['Years teaching', String(rs.taught)],
      ...(rs.faculty ? [['Faculty', rs.director ? 'Residency program director' : 'Assistant professor']] : [])]) : ''}${r.map((o) => btn('research', o.name, { arg: o.id, disabled: !!o.block, sub: o.block })).join('')}`);
    const c = p.career;
    if (c.careerId) out += card('Wellbeing', `${meterHtml('Stress', c.stress ?? 0, true)}<p class="muted">A demanding career does not have to cost your health. Asking for help is part of the job.</p>
      ${btn('support', 'Ask for support')}${m.training ? '' : btn('hours', 'Ask for fewer hours')}${btn('leave', 'Take your vacation')}`);
    const e = where ? market.employer(where) : null;
    if (e?.history?.length) out += card('Hospital chronicle', `<ul>${e.history.slice(-10).reverse().map((x) => `<li>${esc(String(x.year))}: ${esc(x.text)}</li>`).join('')}</ul>`);
    if (m.job) out += jobsOut;
    return out || card('Hospital', muted('Nothing here yet.'));
  },
  practice(p, m) {
    const mine = practice.practices(m);
    const opts = practice.practiceOptions(m, p);
    return (mine.length ? card('Your practices', mine.map((b) => kv([[b.name, `Reputation ${Math.round(b.reputation)} · cash ${fmtMoney(b.cash, country())} · ${b.sites} site${b.sites > 1 ? 's' : ''}`]])).join('') + muted('Staff, money and expansion are run from Work → Business.')) : '')
      + card('Open a practice', `${muted(practice.ownershipNote(p.countryId))}${opts.map((o) => btn('open', o.name, { arg: o.id, disabled: !!o.block, sub: o.block })).join('')}`);
  },
  people(p, m) {
    const ids = [...new Set([m.people.mentorId, ...m.people.supervisorIds, ...m.people.colleagueIds, ...(m.people.traineeIds ?? [])].filter(Boolean))];
    const rows = ids.map((id) => store.state.npcs[id]).filter((n) => n?.alive).map((n) => btn('person', `${n.firstName} ${n.lastName}`, { arg: n.id,
      sub: `${n.flags.title ?? n.occupation ?? ''}${m.people.rivalIds.includes(n.id) ? ' · rival' : ''}${m.people.friendIds.includes(n.id) ? ' · friend' : ''}${n.id === m.people.mentorId ? ' · mentor' : ''} · ${Math.round(n.meters.relationship)}%` }));
    return card('Hospital life', `${rows.join('') || muted('Nobody yet.')}<p class="muted">Open someone to see their profile and what you share.</p>`);
  },
};

function applyBlock(m) {
  const opts = train.applicationOptions(player(), m);
  const chosen = m.school?.apply ?? [];
  return `<div class="section-label">Residency applications</div>${chosen.length ? `<p>Applying to: ${esc(chosen.map((id) => specialtyName(id)).join(', then '))}</p>` : muted('Not chosen yet: your strongest rotations will be used.')}
    ${btn('apply', 'Choose specialties to apply to')}
    ${btn('local', m?.local ? 'Apply nationwide (may mean moving)' : `Apply only in ${player().city}`, { arg: m?.local ? 'off' : 'on' })}
    ${btn('second', m?.secondRound === false ? 'Enter the second round if unmatched' : 'Skip the second round', { arg: m?.secondRound === false ? 'on' : 'off' })}<p class="muted">${esc(opts.filter((o) => !o.block).length)} specialties open. A place is never guaranteed: competitive ones need a strong application.</p>`;
}

/** A case, worked step by step. */
async function openCase(id, api) {
  const modal = openModal('<div data-case></div>', { dismissable: true });
  const root = modal.el.querySelector('[data-case]');
  let last = '';
  const render = () => {
    const v = cases.caseView(id);
    if (!v) { modal.close(); return; }
    const open = v.status === 'open';
    root.innerHTML = `<h2 style="margin-top:0">${esc(v.label)}</h2>
      <p class="muted">Confidential${v.supervised ? ' · supervised' : ''}${v.guardian ? ' · with a parent or guardian' : ''}</p>
      ${v.teams.length ? `<p class="muted">One emergency, several teams: ${esc(v.teams.join(', '))} are working on this patient too.</p>` : ''}
      ${v.family.length ? `<p class="muted">With ${esc(v.family.map((f) => `${f.name}, ${f.as}`).join('; '))}.</p>` : ''}
      <p>${esc(v.intro)}</p><p><strong>History.</strong> ${esc(v.history)}</p><p><strong>Examination.</strong> ${esc(v.exam)}</p>
      ${v.triage ? `<div class="section-label">Who first?</div><p>${esc(v.triage.text)}</p>${v.triage.options.map((o) => btn('triage', o.label, { arg: o.id })).join('')}` : ''}
      <div class="section-label">Tests</div>${v.tests.map((t) => t.done ? `<p><strong>${esc(t.name)}:</strong> ${esc(t.result)}</p>` : btn('test', t.name, { arg: t.id, disabled: !open })).join('')}
      <div class="section-label">Working diagnosis</div>${v.differential.map((d) => btn('dx', d.label, { arg: d.id, disabled: !open, cls: v.dx === d.id ? 'primary' : '' })).join('')}
      ${open ? `<div class="section-label">Plan</div>${v.plans.map((x) => btn('plan', x.label, { arg: x.id, disabled: !!x.block || !v.dx || !!v.triage, sub: x.block || (x.refer ? `Refers to ${x.refer}` : '') })).join('')}` : ''}
      ${v.or ? `<div class="card"><h3>Operating room: ${esc(v.or.procedure)}</h3>${kv([['Team', v.or.team], ['Setting', v.or.resources], ['Risk for this patient', v.or.risk]])}
        <p>${esc(v.or.step.text)}</p>${v.or.step.options.map((o) => btn('or', o.label, { arg: o.id })).join('')}</div>` : ''}
      ${v.decision ? `<div class="section-label">Under pressure</div><p>${esc(v.decision.text)}</p>${v.decision.options.map((o) => btn('decide', o.label, { arg: o.id })).join('')}` : ''}
      ${v.outcome ? `<div class="card"><h3>Outcome</h3><p>${esc(v.outcome.text)}</p>${v.notes.map((n) => `<p class="muted">${esc(n)}</p>`).join('')}</div>` : ''}
      ${last && !v.outcome ? `<p class="muted">${esc(last)}</p>` : ''}
      <div class="btn-stack" style="margin-top:12px"><button type="button" class="btn" data-close>Close</button></div>`;
  };
  const acts = { or: cases.orStep, test: cases.orderTest, dx: cases.setDiagnosis, plan: cases.choosePlan, decide: cases.decide, triage: cases.triage };
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { modal.close(); return; }
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const r = acts[b.dataset.act]?.(id, b.dataset.arg);
    last = r?.text ?? '';
    api.changed();
    render();
  });
  render();
  return new Promise((resolve) => { const close = modal.close; modal.close = () => { close(); resolve(); }; });
}

const ACTIONS = {
  premed: (id, x) => x.say(train.doPremed(id)),
  doToo: (_, x) => x.say(train.setDoToo(!med()?.doToo)),
  drama: (level, x) => x.say(setDrama(level)),
  reapply: (on, x) => x.say(train.setReapply(on === 'on')),
  local: (on, x) => x.say(train.setLocal(on === 'on')),
  second: (on, x) => x.say(train.setSecondRound(on === 'on')),
  research: (id, x) => x.say(id ? research.doResearch(id) : train.researchYear()),
  support: (_, x) => x.say(requestSupport()),
  hours: (_, x) => x.say(work.changeHours(-10)),
  leave: (_, x) => x.say(work.takeLeave('vacation')),
  fellowship: (id, x) => x.say(train.applyForFellowship(id)),
  focus: (f, x) => x.say(ladder.setFocus(f)),
  offer: (yes, x) => x.say(ladder.answerOffer(yes === 'yes')),
  post: (id, x) => x.say(jobs.applyFor(id)),
  scope: (s, x) => { x.st.jobScope = s; x.render(); },
  accept: (id, x) => x.say(jobs.acceptOffer(id)),
  decline: (id, x) => x.say(jobs.declineOffer(id)),
  negotiate: (id, x) => x.say(jobs.negotiate(id)),
  async review(id) {
    const v = jobs.hospitalProfile(id);
    if (!v) return;
    await messageModal({ title: v.name, body: `${v.kind} in ${v.city}. ${v.ownership}. Resources ${v.resources}/100, reputation ${v.reputation}/100. ${v.teaching ? 'Runs residency programs. ' : ''}`
      + `About ${v.physicians} physicians, ${v.nurses} nurses and ${v.administrators} administrators, serving ${v.patients}. Departments: ${v.departments.join(', ')}.`
      + `${v.history.length ? ` Lately: ${v.history.map((h) => h.text).join(' ')}` : ''}` });
  },
  open: (id, x) => x.say(practice.openPractice(id)),
  case: async (id, x) => { await openCase(id, x.api); x.refresh(); },
  person: (id, x) => { const n = store.state.npcs[id]; if (n) openNpc(n, x.api); },
  async apply(_, x) {
    const opts = train.applicationOptions(player(), M()).filter((o) => !o.block);
    const picked = [];
    for (let i = 0; i < 3; i++) {
      const left = opts.filter((o) => !picked.includes(o.id));
      const choice = await pickModal({ title: i === 0 ? 'Your first choice' : `Choice ${i + 1}`, body: i === 0 ? 'Rank up to three. The first that offers you a place is the one you take.' : 'Add a backup, or stop here.',
        options: left.map((o) => ({ label: o.name, sub: `${o.years} years · ${o.compete >= 0.75 ? 'very competitive' : o.compete >= 0.5 ? 'competitive' : 'open to most'}${o.interest ? ' · you liked the rotation' : ''}` })), cancel: i === 0 ? 'Cancel' : 'Done' });
      if (choice == null) break;
      picked.push(left[choice].id);
    }
    if (picked.length) await x.say(train.setApplications(picked));
  },
  async declare(_, x) {
    const opts = Object.values(SPECIALTY_BY_ID).filter((s) => s.profession === (med().route === 'dpm' ? 'podiatry' : 'medicine') && s.kind !== 'fellowship');
    const i = await pickModal({ title: 'Your specialty', options: opts.map((s) => ({ label: s.name })) });
    if (i == null) return;
    M().declared = opts[i].id;
    if (M().job?.legacy) M().job.specialtyId = opts[i].id;
    await x.say({ text: `Recorded: you practice ${opts[i].name.toLowerCase()}.`, tone: 'neutral' });
  },
};

/** Opens My Medical Career. */
export function openMedicine(api, start = 'overview') {
  const st = { section: start };
  const modal = openModal('<div data-med></div>', { dismissable: true });
  modal.el.classList.add('world-modal');
  const root = modal.el.querySelector('[data-med]');
  const render = () => {
    const p = player();
    const m = med(p);
    const list = sectionsFor(p, m);
    if (!list.some(([id]) => id === st.section)) st.section = 'overview';
    root.innerHTML = `<h2 style="margin-top:0">My Medical Career</h2>
      <div class="world-groups" role="tablist" aria-label="Sections">${list.map(([id, label]) => `<button type="button" role="tab" class="world-group av-chip ${id === st.section ? 'on' : ''}" aria-selected="${id === st.section}" data-sec="${id}">${esc(label)}</button>`).join('')}</div>
      <div style="margin-top:10px">${VIEWS[st.section](p, m, st)}</div>
      <div class="btn-stack" style="margin-top:12px"><button type="button" class="btn" data-close>Close</button></div>`;
  };
  const refresh = () => { api.changed(); render(); };
  const say = async (r) => { refresh(); if (r?.text) await messageModal({ body: r.text, tone: r.tone }); render(); };
  root.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-close]')) { modal.close(); return; }
    const sec = t.closest('[data-sec]');
    if (sec) { st.section = sec.dataset.sec; render(); modal.el.scrollTop = 0; return; }
    const b = t.closest('[data-act]');
    if (!b || b.disabled) return;
    const fn = ACTIONS[b.dataset.act];
    if (fn) await fn(b.dataset.arg, { st, say, refresh, render, api });
  });
  render();
  return modal;
}
