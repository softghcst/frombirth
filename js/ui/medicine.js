// My Medical Career ("Every patient has a story"): one place for a doctor's life, from premedical
// years to private practice. Tabs appear only when they apply to this life: a medical student sees
// no clinic of their own, and someone outside a hospital sees no Hospital Life.
//
//   Overview · Medical Education · Training & Residency · Specialization · My Patients · Active Cases ·
//   Clinical Decisions · Procedures · My Hospital (the Hospital Life hub) · Professional Development ·
//   My Clinic · Career History
//
//   Hospital Life: My Department · My Colleagues · Residents & Fellows · Active Patients · Operating Room ·
//   Training · Hospital Stories · Professional Relationships · Leadership · Career History · Find a Post
//
// Every section reads the medical engine (engine/medicine); every button does something. Patient
// cases are confidential: they are shown here only, to the physician.
import { store, player, country } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import { SPECIALTY_BY_ID, SKILLS, RANKS, DEPARTMENTS, PROCEDURE_BY_ID, PRACTICE_TYPES, ERA, jurisdiction, jurisdictionIn } from '../data/medicine.js';
import { EVENT_BY_ID } from '../data/events/index.js';
// Five skills to follow on screen, not nine: each is the average of the finer ones the engine keeps.
const SKILL_GROUPS = [
  ['Clinical Judgment', ['reasoning', 'research']],
  ['Hands-On Skill', ['technical']],
  ['Bedside Manner', ['communication']],
  ['Teamwork & Leadership', ['teamwork', 'management', 'leadership']],
  ['Professionalism', ['professionalism', 'integrity']],
];
/** The same five, named for the specialty: a surgeon's hands-on skill is surgery; a psychiatrist's bedside manner is the therapeutic relationship. */
const SURGICAL = /surg|ortho|neurosurg|ctsurg|vascular|transplant|colorectal|plastic|hand|spine|foot_ankle|urology|ent|ophthalmology|obgyn|trauma|podiatry/;
function skillNames(spec) {
  const n = SKILL_GROUPS.map(([name]) => name);
  if (!spec) return n;
  if (SURGICAL.test(spec)) n[1] = 'Surgical Skill';
  if (spec === 'emergency' || spec === 'critical_care' || spec === 'pulm_cc' || spec === 'anesthesiology') n[1] = 'Resuscitation & Procedures';
  if (spec === 'radiology' || spec === 'pathology' || spec === 'forensic_path') { n[1] = 'Reading the Images & Slides'; n[2] = 'Explaining Findings'; }
  if (spec === 'psychiatry' || spec === 'forensic_psych') { n[1] = 'Assessment'; n[2] = 'Therapeutic Relationship'; }
  if (/peds|pediatrics|neonatology/.test(spec)) n[2] = 'With Children & Parents';
  if (spec === 'family' || spec === 'internal' || spec === 'general') n[2] = 'Knowing Your Patients';
  return n;
}
import { openModal, messageModal, pickModal, inputModal } from './modals.js';
import { meterHtml } from './meter.js';
import { avatarSvg } from './avatar.js';
import { med, M, W, currentSpecialty, specialtyName, qualified, reputationOf } from '../engine/medicine/core.js';
import * as train from '../engine/medicine/training.js';
import * as routine from '../engine/medicine/routine.js';
import * as cases from '../engine/medicine/cases.js';
import * as ladder from '../engine/medicine/ladder.js';
import * as jobs from '../engine/medicine/jobs.js';
import * as practice from '../engine/medicine/practice.js';
import * as drama from '../engine/medicine/drama.js';
import * as research from '../engine/medicine/research.js';
import * as work from '../engine/worklife.js';
import * as market from '../engine/employers.js';
import * as biz from '../engine/business.js';
import { citiesOf } from '../engine/cities.js';
import { openNpc } from './tabs/people.js';
import { hospitalName, hospital, kindName, deptOf, deptHead } from '../engine/medicine/hospitals.js';
import { screenName } from './careerNames.js';

const kv = (rows) => rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
const btn = (act, label, o = {}) => `<button type="button" class="btn ${o.cls ?? ''}" data-act="${act}"${o.arg != null ? ` data-arg="${esc(o.arg)}"` : ''}${o.disabled ? ' disabled' : ''}>${esc(label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`;
const card = (title, body) => `<div class="card"><h3>${esc(title)}</h3>${body}</div>`;
const muted = (t) => `<p class="muted">${esc(t)}</p>`;
const npc = (id) => (id ? store.state.npcs[id] : null);
const face = (n, size = '') => `<div class="avatar ${size}">${avatarSvg({ age: n.age, gender: n.gender, appearance: n.appearance, seed: n.id, mood: n.meters?.relationship ?? 60, label: n.firstName })}</div>`;
const personRow = (n, side, act = 'person') => `<button type="button" class="row world-row" data-act="${act}" data-arg="${n.id}">${face(n)}<div class="main"><strong>${esc(n.firstName)} ${esc(n.lastName)}</strong><small>${esc(side)}</small></div><div class="side">${Math.round(n.meters.relationship)}%</div></button>`;
const year = () => store.state.year;

/** Whether the medical career page has anything to show. */
export function medicineOpen(p = player()) {
  return !!p.medicine || train.premedOpen(p) || (p.education.enrolled && ['medical', 'podiatric'].includes(p.education.stage));
}

// ---------- Which tabs this life has ----------

const TABS = [['overview', 'Overview'], ['education', 'Medical Education'], ['training', 'Training & Residency'], ['specialization', 'Specialization'],
  ['patients', 'My Patients'], ['active', 'Active Cases'], ['decisions', 'Clinical Decisions'], ['procedures', 'Procedures'], ['hospital', 'My Hospital'],
  ['development', 'Professional Development'], ['clinic', 'My Clinic'], ['history', 'Career History']];

function tabsFor(p, m) {
  const role = m ? cases.roleNow(m, p) : null;
  const closed = (m?.caseIds ?? []).some((id) => W().cases[id]?.status === 'closed');
  return TABS.filter(([id]) => {
    if (id === 'overview') return true;
    if (!m) return id === 'education';
    switch (id) {
      case 'education': return train.premedOpen(p) || !!m.school;
      case 'training': return !!(m.school?.graduated || m.training || m.completed.length || m.match);
      case 'specialization': return !!(m.training || qualified(m).length);
      case 'patients': return (m.caseIds ?? []).length > 0;
      case 'active': return !!role;
      case 'decisions': return closed;
      case 'procedures': return cases.privileges(m).size > 0 || !!m.training || m.experience.procedures + m.experience.assisted > 0;
      case 'hospital': return !!(m.training || m.job || qualified(m).length);
      case 'development': return !!(m.training || m.job || m.clinicIds.length);
      case 'clinic': return qualified(m).length > 0 || m.clinicIds.length > 0; // only where owning one is actually valid
      case 'history': return m.history.length > 0;
      default: return true;
    }
  });
}

/** Fewer tabs: related sections on one page, each under its own heading. A page with one section keeps its own name. */
const MED_GROUPS = [
  ['training', 'Training', ['education', 'training', 'specialization']],
  ['active', 'Patients', ['patients', 'active', 'decisions', 'procedures']],
  ['hospital', 'Hospital & Clinic', ['hospital', 'clinic']],
  ['history', 'Career', ['development', 'history']],
];
function pagesFor(sections) {
  const out = [];
  const used = new Set();
  for (const [id, label] of sections) {
    if (used.has(id)) continue;
    const g = MED_GROUPS.find(([, , ids]) => ids.includes(id));
    const members = g ? sections.filter(([x]) => g[2].includes(x)) : [[id, label]];
    members.forEach(([x]) => used.add(x));
    out.push({ id: g ? g[0] : id, label: g && members.length > 1 ? g[1] : members[0][1], members });
  }
  return out;
}

const HUB = [['department', 'My Department'], ['colleagues', 'My Colleagues'], ['residents', 'Residents & Fellows'], ['patients', 'Active Patients'], ['or', 'Operating Room'],
  ['training', 'Training'], ['stories', 'Hospital Stories'], ['relationships', 'Professional Relationships'], ['leadership', 'Leadership'], ['history', 'Career History'], ['jobs', 'Find a Post']];

function hubFor(p, m) {
  const at = m.training?.hospitalId ?? m.job?.hospitalId;
  const surgical = SPECIALTY_BY_ID[currentSpecialty(m)]?.surgical;
  return HUB.filter(([id]) => {
    if (id === 'jobs') return qualified(m).length > 0 && !m.training;
    if (!at) return false;
    if (id === 'residents') return !!m.training || (m.people.traineeIds ?? []).length > 0;
    if (id === 'or') return !!surgical;
    if (id === 'training') return !!m.training;
    if (id === 'leadership') return !!m.job;
    if (id === 'patients') return !!cases.roleNow(m, p);
    return true;
  });
}

function stageWords(m, p) {
  if (!m) return train.premedOpen(p) ? 'Premedical' : 'Not on the medical route';
  if (m.training) return `${m.training.kind === 'fellowship' ? 'Fellow' : m.training.kind === 'internship' ? 'Intern' : p.countryId === 'us' ? 'Resident' : 'Specialty trainee'}, ${p.countryId === 'us' ? 'PGY-' : 'year '}${m.training.pgy} of ${m.training.years}`;
  if (m.job) return RANKS[m.job.rank]?.title ?? 'Physician';
  if (m.clinicIds.length) return 'In private practice';
  return { school: `Medical school, year ${m.school?.year ?? 1}`, graduate: 'Graduate, without a training place', retired: 'Retired from medicine', none: 'Premedical' }[m.stage] ?? m.stage;
}

// ---------- The tabs ----------

const caseButton = (c) => {
  const v = cases.caseView(c.id);
  const n = npc(c.patientId);
  return `<button type="button" class="row world-row" data-act="case" data-arg="${c.id}">${n ? face(n) : ''}<div class="main"><strong>${esc(v.patient?.name ?? 'Patient')}${v.patient ? `, ${v.patient.age}` : ''}</strong><small>${esc(v.label)} · ${esc(v.specialty)} · ${esc(v.stage)}${v.followUp ? ' · follow-up' : ''}</small></div></button>`;
};

const VIEWS = {
  overview(p, m) {
    const j = jurisdictionIn(p.countryId, store.state.year);
    const gpYears = store.state.year < ERA.gpEra;
    if (!m) return card('Becoming a doctor', `<p>A medical career starts with a university degree in a science or health subject, good grades, and time spent learning what medicine is like. Then four years of medical school, ${gpYears ? 'a year as a hospital intern, and for most doctors of these years, general practice; a few train on for years as residents to specialize.' : 'a residency place applied for, and years of supervised training.'}</p>
      ${kv([['Route here', `${j.entry === 'graduate' ? 'After a university degree' : 'Direct entry in reality; in the game, after a university degree'} · ${j.detail === 'detailed' ? 'modeled in detail' : 'simplified profile'}`], ['Training places', j.selection]])}`);
    const spec = currentSpecialty(m);
    const at = m.training?.hospitalId ?? m.job?.hospitalId;
    const sup = (m.people.supervisorIds ?? []).map(npc).find((n) => n?.alive);
    const open = cases.roleNow(m, p) ? cases.caseload(m, p).filter((c) => c.status !== 'closed').length : 0;
    const chances = [...(jobs.interview(m) ? ['an interview waiting'] : []), ...(jobs.offers(m).length ? [`${jobs.offers(m).length} job offer${jobs.offers(m).length > 1 ? 's' : ''} waiting`] : []),
      ...(m.offer && m.offer.year === year() ? [`an offer to become ${RANKS[m.offer.rank].title.toLowerCase()}`] : []),
      ...(train.fellowshipOptions(m).some((f) => !f.block) ? ['fellowships open to you'] : [])];
    const glance = at ? card('Hospital life', kv([
      ['Hospital', hospitalName(at)], ['Department', spec === 'general' ? 'General Practice' : DEPARTMENTS[deptOf(spec)] ?? 'Medicine'], ['Title', p.career.title ?? '—'],
      ...(sup && m.training ? [['Supervising physician', `${sup.firstName} ${sup.lastName}`]] : []),
      ['Colleagues you know', String([...m.people.colleagueIds, ...m.people.friendIds, ...(m.people.traineeIds ?? [])].filter((id) => npc(id)?.alive).length)],
      ['Patients open this year', String(open)],
      ...(m.training ? [['Training', `${m.training.pgy} of ${m.training.years} years`]] : []),
      ...(chances.length ? [['Opportunities', chances.join('; ')]] : []),
    ])) : '';
    return glance + card(stageWords(m, p), kv([
      ['Route', m.route === 'dpm' ? 'Podiatric medicine (DPM)' : m.route === 'do' ? 'Osteopathic medicine (DO)' : 'Medicine (MD)'],
      ['Specialty', spec ? specialtyName(spec) : 'Not yet chosen'],
      ['License', m.license.status === 'full' ? m.license.name : m.training ? 'Training license: practices under supervision' : 'None yet'],
      ['Reputation', `${reputationOf(m)} (from how you practice, never from survival counts)`],
      ['Jurisdiction', `${p.countryId === 'us' ? 'United States, modeled in detail' : 'Simplified profile: the broad shape, not the rules'}`],
    ])) + card('Skills', SKILL_GROUPS.map(([, ids], i) => meterHtml(skillNames(currentSpecialty(m))[i], Math.round(ids.reduce((t, k) => t + (m.skills[k] ?? 0), 0) / ids.length), true)).join(''));
  },
  education(p, m) {
    let out = '';
    if (train.premedOpen(p)) {
      out += card('Premedical year', `<p class="muted">Each counts toward a medical or podiatric school application, once a year.</p>${train.premedOptions().map((a) => btn('premed', a.name, { arg: a.id, disabled: a.done, sub: a.done ? 'Done this year' : '' })).join('')}
        ${jurisdiction(p.countryId).osteopathic ? btn('doToo', m?.doToo ? 'Apply to MD schools only' : 'Apply to osteopathic (DO) schools too') : ''}
        <p class="muted">Apply to medical or podiatric school from Work &amp; School, like any other program.</p>`);
    }
    const s = m?.school;
    if (s) {
      out += card(`${s.name}${s.graduated ? ' (graduated)' : `, year ${s.year}`}`, kv([
        ['Degree', m.route === 'dpm' ? 'DPM' : m.route === 'do' ? 'DO' : jurisdiction(s.countryId ?? p.countryId).degrees[0]],
        ['Exams', Object.entries(s.exams).map(([id, x]) => `${x.name ?? id.toUpperCase()}: ${x.pass ? 'passed' : 'not passed'}`).join(', ') || 'None sat yet'],
      ]) + (s.rotations.length ? `<div class="section-label">${year() < 1950 ? 'Clerkships' : 'Rotations'}</div>${kv(s.rotations.slice(-12).map((r) => [`${r.name} (${r.year})`, r.grade]))}` : muted('Clinical years begin in year three.'))
        + (!s.graduated && (s.year >= 3 || p.education.yearInStage >= 3) ? applyBlock(m) : ''));
    }
    return out || card('Medical education', muted('Nothing to show yet.'));
  },
  training(p, m) {
    let out = '';
    if (m.stage === 'graduate' && !m.training) {
      out += card('Applying for a training place', `${applyBlock(m)}${btn('research', 'Spend the year in research', { sub: 'A stronger application next time' })}${btn('reapply', m.reapply === false ? 'Apply again this year' : 'Stop applying', { arg: m.reapply === false ? 'on' : 'off' })}`);
    }
    if (m.match) out += card('Applications', kv([['Last applied', `${m.match.year}: ${m.match.applied.map((id) => specialtyName(id)).join(', ')}`], ['Result', m.match.status === 'matched' ? `Matched: ${specialtyName(m.match.specialtyId)} at ${hospitalName(m.match.hospitalId)}` : 'No place that year']]));
    if (m.training) {
      const t = m.training;
      out += card(`${t.kind === 'fellowship' ? 'Fellowship' : t.kind === 'internship' ? 'Internship' : 'Residency'}${t.specialtyId ? `: ${specialtyName(t.specialtyId)}` : ''}`, kv([
        ['Hospital', hospitalName(t.hospitalId)], ['Year', `${t.pgy} of ${t.years}`], ['Started', String(t.startYear)],
        ['Evaluations', t.evals.map((e) => `year ${e.pgy}: ${e.score}`).join(', ') || 'The first comes at the end of the year'],
        ...(t.chief ? [['Chief resident', 'Yes']] : []), ...(t.probation ? [['Remediation', 'Under closer supervision this year']] : []),
      ]) + (t.kind === 'internship' && year() <= 1968 ? `<div class="section-label">After the internship</div>${btn('afterIntern', 'Go into general practice', { arg: 'gp', cls: m.afterInternship === 'gp' ? 'primary' : '' })}${btn('afterIntern', 'Apply for a specialty residency', { arg: 'residency', cls: m.afterInternship === 'residency' ? 'primary' : '' })}${m.afterInternship === 'residency' ? applyBlock(m) : ''}` : '')
        + muted('A trainee decides nothing alone: plans are reviewed, and operations are done with a supervising surgeon.'));
    }
    if (m.completed.length) out += card('Completed training', kv(m.completed.map((c) => [specialtyName(c.specialtyId), `${c.hospital ?? ''} ${c.from}–${c.to}${c.chief ? ', chief resident' : ''}`])));
    return out || card('Training', muted('Nothing yet.'));
  },
  specialization(p, m) {
    const spec = currentSpecialty(m);
    const s = SPECIALTY_BY_ID[spec];
    let out = card(s?.name ?? 'Specialty', kv([['As', s?.doctor ?? '—'], ['Board certification', m.boards.filter((b) => b.passed).map((b) => specialtyName(b.specialtyId)).join(', ') || 'None yet'],
      ['Qualified in', qualified(m).map((id) => specialtyName(id)).join(', ') || 'Still training']]));
    const fel = train.fellowshipOptions(m);
    if (fel.length) out += card('Fellowships', `<p class="muted">Only after the residency they follow from. Places are competitive.</p>${fel.map((f) => btn('fellowship', `${f.name} (${f.years} ${f.years === 1 ? 'year' : 'years'})`, { arg: f.id, disabled: !!f.block && !(m.training?.pgy >= m.training?.years), sub: m.applyFellowship === f.id ? 'Applied' : f.block })).join('')}`);
    if (s?.focus && !m.training) out += card('Focus', s.focus.map((f) => btn('focus', f.replace('_', ' '), { arg: f, cls: m.focus === f ? 'primary' : '' })).join(''));
    if (m.legacy && !m.declared && m.stage === 'practice') out += card('Your specialty', `<p class="muted">You were practicing before this record was kept. Name your specialty once.</p>${btn('declare', 'Name your specialty')}`);
    return out;
  },
  patients(p, m) {
    // The people the physician has looked after, each with their visits: kept as long as their case is on file.
    const mine = Object.values(W().patients).filter((x) => x.caseIds.some((id) => m.caseIds.includes(id)));
    const rows = mine.map((x) => ({ n: npc(x.id), visits: x.caseIds.filter((id) => m.caseIds.includes(id)).map((id) => W().cases[id]).filter(Boolean) })).filter((x) => x.n)
      .sort((a, b) => b.visits.at(-1).year - a.visits.at(-1).year).slice(0, 40);
    const due = (m.followUps ?? []).length;
    return card(`My patients (${rows.length})`, `${muted('Confidential. Each patient is a real person, seen over the years; their records are yours alone.')}${due ? `<p>${due} follow-up${due > 1 ? 's' : ''} booked for next year.</p>` : ''}
      ${rows.map(({ n, visits }) => `<button type="button" class="row world-row" data-act="case" data-arg="${visits.at(-1).id}">${face(n)}<div class="main"><strong>${esc(n.firstName)} ${esc(n.lastName)}</strong><small>${visits.length} visit${visits.length > 1 ? 's' : ''} · last ${visits.at(-1).year}: ${esc(cases.caseView(visits.at(-1).id)?.label ?? '')}</small></div></button>`).join('') || muted('No patients on file.')}`);
  },
  active(p, m) {
    const list = cases.caseload(m, p);
    const role = cases.roleNow(m, p);
    const head = muted(role === 'student' ? 'As a student you examine and present; the team decides.' : cases.supervised(role) ? 'You propose the plan; your supervising physician reviews it.' : 'You decide, within your privileges. Refer what you do not do.');
    const open = list.filter((c) => c.status !== 'closed' || cases.caseView(c.id).followUpNeeded);
    return card(`Active cases (${open.length} of ${list.length} this year)`, head + (open.map(caseButton).join('') || muted('Nothing open this year.'))
      + muted('Cases you do not open are handled in the run of a busy year. They never appear in your life story.'));
  },
  decisions(p, m) {
    const closed = m.caseIds.map((id) => W().cases[id]).filter((c) => c?.status === 'closed').slice(-30).reverse();
    const st = cases.caseStats(m);
    return card('Your record', kv([['Patients seen', String(st.total)], ['Average judgment', st.judgment == null ? '—' : `${st.judgment}/100`], ['Good / partial / poor outcomes', `${st.good} / ${st.fair} / ${st.poor}`]]))
      + muted('Judgment is how the decision was made: the history, the right test, the right diagnosis, a sound plan. A good decision can still meet a poor outcome.')
      + card('Clinical decisions', closed.map((c) => {
        const v = cases.caseView(c.id);
        return `<button type="button" class="row world-row" data-act="case" data-arg="${c.id}"><div class="main"><strong>${esc(v.label)} (${c.year})</strong><small>Diagnosis ${c.outcome.rightDx ? 'right' : 'missed'} · judgment ${c.outcome.points}/100 · outcome ${c.outcome.result}${c.or ? ' · operated' : ''}</small></div></button>`;
      }).join('') || muted('None yet.'));
  },
  procedures(p, m) {
    const priv = [...cases.privileges(m)].map((id) => PROCEDURE_BY_ID[id]).filter(Boolean);
    const ors = m.caseIds.map((id) => W().cases[id]).filter((c) => c?.or).slice(-15).reverse();
    return card('Privileges', priv.length ? kv(priv.map((x) => [x.name, x.major ? 'operating room' : 'office or bedside'])) : muted(m.training ? 'In training, every procedure is supervised: you hold no privileges of your own yet.' : 'None.'))
      + card('Your procedures', kv([['Performed', String(m.experience.procedures)], ['Assisted or supervised', String(m.experience.assisted)]])
        + (ors.map((c) => `<button type="button" class="row world-row" data-act="case" data-arg="${c.id}"><div class="main"><strong>${esc(PROCEDURE_BY_ID[c.or.procedure]?.name ?? 'Procedure')} (${c.year})</strong><small>${c.or.transferred ? 'transferred' : c.or.complication ? 'a complication, managed' : 'uncomplicated'} · outcome ${c.outcome?.result ?? 'pending'}</small></div></button>`).join('')));
  },
  hospital(p, m, st) { return hubView(p, m, st); },
  development(p, m) {
    let out = '';
    const r = research.researchOptions(m, p);
    const rs = m.research;
    if (r.length) out += card('Research and teaching', `${rs ? kv([['Papers', String(rs.papers.length)], ['Projects under way', String(rs.projects.length)], ['Years teaching', String(rs.taught)],
      ...(rs.faculty ? [['Faculty', rs.director ? 'Residency program director' : 'Assistant professor']] : [])]) : ''}${r.map((o) => btn('research', o.name, { arg: o.id, disabled: !!o.block, sub: o.block })).join('')}`);
    const c = p.career;
    if (c.careerId) out += card('Wellbeing', `${meterHtml('Stress', c.stress ?? 0, true)}<p class="muted">A demanding career does not have to cost your health. Asking for help is part of the job.</p>
      ${btn('support', 'Ask for support')}${m.training ? '' : btn('hours', 'Ask for fewer hours')}${btn('leave', 'Take your vacation')}`);
    const level = store.state.settings?.drama ?? 'balanced';
    out += card('Story drama', `<p class="muted">How many of the stories that are true of your life are told each year, hospital life among them (the same setting as in Settings). It never changes how patients fare, and consequences always play.</p>${Object.keys(drama.DRAMA).map((l) => btn('drama', l[0].toUpperCase() + l.slice(1), { arg: l, cls: level === l ? 'primary' : '' })).join('')}`);
    return out;
  },
  clinic(p, m) { return clinicView(p, m); },
  history(p, m) {
    return card('Career history', m.history.length ? kv(m.history.slice().reverse().map((h) => [String(h.year), h.text])) : muted('Nothing yet.'));
  },
};

// ---------- My Hospital: the Hospital Life hub ----------

function hubView(p, m, st) {
  const tabs = hubFor(p, m);
  if (!tabs.length) return card('My hospital', muted('No hospital yet.'));
  // Fewer tabs here too: the department with its leadership, the people together, the stories with the history.
  const pages = [];
  const used = new Set();
  const HG = [['department', 'Your Department', ['department', 'leadership']], ['colleagues', 'People', ['colleagues', 'residents', 'relationships']], ['stories', 'Stories & History', ['stories', 'history']]];
  for (const [id, label] of tabs) {
    if (used.has(id)) continue;
    const g = HG.find(([, , ids]) => ids.includes(id));
    const members = g ? tabs.filter(([x]) => g[2].includes(x)) : [[id, label]];
    members.forEach(([x]) => used.add(x));
    pages.push({ id: g ? g[0] : id, label: g && members.length > 1 ? g[1] : members[0][1], members });
  }
  const pg = pages.find((x) => x.id === st.hub) ?? pages.find((x) => x.members.some(([y]) => y === st.hub)) ?? pages[0];
  st.hub = pg.id;
  const at = m.training?.hospitalId ?? m.job?.hospitalId;
  const head = at ? `<p class="muted">${esc(hospitalName(at))} · ${esc(DEPARTMENTS[deptOf(currentSpecialty(m))] ?? 'Medicine')} · ${esc(p.career.title ?? '')}</p>` : '';
  const body = pg.members.length === 1 ? HUB_VIEWS[pg.members[0][0]](p, m, st, at) : pg.members.map(([y, label]) => `<div class="section-label">${esc(label)}</div>${HUB_VIEWS[y](p, m, st, at)}`).join('');
  return `${head}<div class="world-groups" role="tablist" aria-label="Hospital life">${pages.map((x) => `<button type="button" role="tab" class="world-group av-chip ${x.id === st.hub ? 'on' : ''}" aria-selected="${x.id === st.hub}" data-hub="${x.id}">${esc(x.label)}</button>`).join('')}</div>
    <div style="margin-top:10px">${body}</div>`;
}

const roleOf = (m, n) => [n.id === m.people.mentorId && 'mentor', m.people.supervisorIds.includes(n.id) && 'supervisor', m.people.rivalIds.includes(n.id) && 'rival',
  m.people.friendIds.includes(n.id) && 'friend', (m.people.allyIds ?? []).includes(n.id) && 'you helped them', n.role === 'partner' && 'partner', n.role === 'ex' && 'former partner'].filter(Boolean).join(' · ');

const HUB_VIEWS = {
  department(p, m, st, at) {
    const h = hospital(at);
    const dept = deptOf(currentSpecialty(m));
    const headId = h.heads[dept];
    const lead = headId === (p.id ?? 'player') ? null : headId ? npc(headId) : deptHead(h, dept);
    const e = market.employer(at);
    return card(DEPARTMENTS[dept] ?? 'Medicine', kv([['Hospital', `${hospitalName(at)} (${kindName(h)})`], ['Led by', lead ? `${lead.firstName} ${lead.lastName}` : headId ? 'You' : '—'],
      ['Resources', `${h.resources}/100`], ['Teaching', h.teaching ? 'Runs residency programs' : 'No'], ['The hospital\'s departments', h.depts.map((d) => DEPARTMENTS[d] ?? d).join(', ')]]))
      + (lead ? personRow(lead, `Chief of ${DEPARTMENTS[dept] ?? 'the department'}`) : '')
      + (e?.history?.length ? card('Hospital chronicle', kv(e.history.slice(-8).reverse().map((x) => [String(x.year), x.text]))) : '');
  },
  colleagues(p, m) {
    const ids = [...new Set([m.people.mentorId, ...m.people.supervisorIds, ...m.people.colleagueIds, ...m.people.friendIds].filter(Boolean))];
    const rows = ids.map(npc).filter((n) => n?.alive).map((n) => personRow(n, `${n.flags.title ?? n.occupation ?? ''}${roleOf(m, n) ? ` · ${roleOf(m, n)}` : ''}`));
    return card('My colleagues', `${rows.join('') || muted('Nobody yet.')}${muted('Open someone to see their profile and what you share; Back returns here.')}`);
  },
  residents(p, m) {
    const peers = m.people.colleagueIds.map(npc).filter((n) => n?.alive && n.flags.medRole === 'peer');
    const mine = (m.people.traineeIds ?? []).map(npc).filter((n) => n?.alive);
    return (peers.length && m.training ? card(m.training.kind === 'fellowship' ? 'Co-fellows' : 'Co-residents', peers.map((n) => personRow(n, `${n.flags.title ?? ''}${roleOf(m, n) ? ` · ${roleOf(m, n)}` : ''}`)).join('')) : '')
      + (mine.length ? card('Residents you supervise', mine.map((n) => personRow(n, `Year ${n.flags.pgy ?? 1}`)).join('')) : '');
  },
  patients(p, m) { return VIEWS.active(p, m); },
  or(p, m) {
    const list = cases.caseload(m, p).filter((c) => cases.caseView(c.id).plans.some((x) => x.procedure) || c.or);
    return card('Operating room', `${muted(m.training ? 'You operate with a supervising surgeon scrubbed in and in charge.' : 'Consent, the team, anesthesia, the unexpected, and the care after: the decisions are yours.')}${list.map(caseButton).join('') || muted('No operations on your list this year.')}`);
  },
  training(p, m) { return VIEWS.training(p, m); },
  stories(p, m, st, at) {
    const told = Object.entries(m.scenes).filter(([k, y]) => typeof y === 'number' && (k.startsWith('story:') || EVENT_BY_ID[k])).map(([k, y]) => [y, k.replace('story:', '')])
      .sort((a, b) => b[0] - a[0]).slice(0, 20);
    const title = (id) => { const t = EVENT_BY_ID[id]?.text ?? id; return t.length > 90 ? `${t.slice(0, 88).replace(/\{[^}]*\}/g, '…')}…` : t.replace(/\{[^}]*\}/g, '…'); };
    return card('Hospital stories', told.length ? kv(told.map(([y, id]) => [String(y), title(id)])) : muted('Nothing yet: hospital life is just beginning.'));
  },
  relationships(p, m) {
    const ids = [...new Set([m.people.mentorId, ...m.people.supervisorIds, ...m.people.colleagueIds, ...m.people.friendIds, ...m.people.rivalIds, ...(m.people.allyIds ?? []), ...(m.people.traineeIds ?? [])].filter(Boolean))];
    const pt = p.npcIds.map(npc).find((n) => n?.alive && ['partner', 'spouse', 'ex'].includes(n.role) && n.life?.job && ['doctor', 'surgery', 'psychiatry', 'podiatrist'].includes(n.life.job.careerId));
    if (pt && !ids.includes(pt.id)) ids.push(pt.id);
    const rows = ids.map(npc).filter((n) => n?.alive).map((n) => `<div class="row" style="gap:6px;flex-wrap:wrap">${personRow(n, roleOf(m, n) || (n.flags.title ?? 'Colleague'))}${btn('colAct', 'Actions', { arg: n.id })}</div>`);
    return card('Professional relationships', `${rows.join('') || muted('Nobody yet.')}${muted('Peers may date; supervisors and trainees, chiefs and their staff, owners and employees, and physicians and patients may not. Nothing at work buys consent.')}`);
  },
  leadership(p, m) {
    const need = ladder.nextStepNeeds(m);
    let out = card('Your path', `${kv([['Now', p.career.title ?? '—'], ['Branch', ladder.TRACKS[ladder.trackOf(m)].name], ...(need?.title ? [['Next', `${need.title}${need.selected ? ' (by selection)' : ''}`], ['It needs', need.needs.join(', ') || 'a seat to open']] : need ? [['Next', need.needs.join(', ')]] : [])])}
      ${Object.entries(ladder.TRACKS).map(([id, t]) => btn('track', t.name, { arg: id, cls: ladder.trackOf(m) === id ? 'primary' : '', sub: t.words })).join('')}`);
    if (m.offer && m.offer.year === year()) out += card('An offer', `<p>${esc(hospitalName(m.offer.hospitalId))} offers you the post of ${esc(RANKS[m.offer.rank].title.toLowerCase())}.</p>${btn('offer', 'Accept', { arg: 'yes', cls: 'primary' })}${btn('offer', 'Decline', { arg: 'no' })}`);
    return out;
  },
  history(p, m, st, at) {
    const e = market.employer(at);
    const here = m.history.filter((h) => e && h.text.includes(e.name));
    return card(`At ${hospitalName(at)}`, here.length ? kv(here.slice().reverse().map((h) => [String(h.year), h.text])) : muted('Your history here is just beginning.')) + VIEWS.history(p, m);
  },
  jobs(p, m, st) {
    let out = '';
    const iv = jobs.interview(m);
    if (iv) out += card(`Interview: ${iv.hospital} (question ${iv.number} of ${iv.of})`, `<p>${esc(iv.question)}</p>${iv.options.map((o) => btn('answer', o.label, { arg: o.id })).join('')}`);
    for (const o of jobs.offers(m)) {
      const name = market.employer(o.hospitalId)?.name ?? 'A hospital';
      out += card(`Offer: ${name}`, `${kv([['Post', o.locum ? 'Temporary post, one year' : RANKS[o.rank].title], ['Salary', `${fmtMoney(o.salary, country())} a year`], ['Hours', `${o.hours} a week`], ['On-call', o.call],
        ...(o.bonus ? [['Signing bonus', fmtMoney(o.bonus, country())]] : []), ['Where', `${o.city}${o.city !== p.city ? (o.relocation ? ', move paid' : ', move at your own cost') : ''}`], ...(o.nonCompete ? [['Non-compete', `${o.nonCompete} years in ${o.city} after leaving`]] : [])])}
        ${btn('accept', 'Accept', { arg: o.hospitalId, cls: 'primary' })}${btn('negotiate', 'Negotiate a term', { arg: o.hospitalId, disabled: o.negotiated })}${btn('review', 'Review the employer', { arg: o.hospitalId })}${btn('decline', 'Decline', { arg: o.hospitalId })}`);
    }
    const scope = st.jobScope ?? 'city';
    const posts = jobs.postings(scope, p, m);
    out += card('Hospital jobs', `${btn('scope', scope === 'city' ? 'Show the whole country' : `Show ${p.city} only`, { arg: scope === 'city' ? 'country' : 'city' })}
      ${posts.map((o) => `<div class="row" style="gap:6px;flex-wrap:wrap">${btn('post', `${o.name}${o.away ? ` (${o.city})` : ''}`, { arg: o.id, disabled: !!o.block, sub: o.block || `${o.kind} · ${o.open} opening${o.open === 1 ? '' : 's'}` })}${btn('review', 'Review', { arg: o.id })}</div>`).join('') || muted('No posts in your specialty.')}`);
    return out;
  },
};

// ---------- My Clinic ----------

function clinicView(p, m) {
  const mine = practice.practices(m);
  let out = '';
  for (const b of mine) {
    const c = b.medical?.costs;
    const partners = practice.partnerRecords(b.id);
    out += card(b.name, `${kv([['Kind', b.medical ? (PRACTICE_TYPES[b.medical.practiceType]?.name ?? b.medical.practiceType) : 'Medical practice'], ['Reputation', String(Math.round(b.reputation))], ['Cash', fmtMoney(b.cash, country())],
      ['Debt', fmtMoney(b.debt, country())], ['Sites', String(b.sites)], ['Staff', String(biz.staffOf(b).length + b.others)], ['Your share', `${Math.round(b.stake * 100)}%`],
      ...(b.medical?.services?.length ? [['Services', b.medical.services.map((s) => practice.SERVICES[s]?.name).join(', ')]] : []),
      ...(b.medical?.group ? [['Group', b.medical.group]] : []),
      ...(b.last ? [['Last year', `revenue ${fmtMoney(b.last.revenue, country())}, profit ${fmtMoney(b.last.profit, country())}`]] : []),
      ...(c ? [['Insurance, compliance, upkeep', fmtMoney(c.insurance + c.compliance + c.upkeep + c.services, country())]] : [])])}
      ${partners.length ? `<div class="section-label">Partners</div>${partners.map((x) => kv([[x.name, `${Math.round(x.stake * 100)}% · ${x.role} · ${x.manages ? 'shares management' : 'no management role'} · paid: ${x.comp} · exit: ${x.exit}`]])).join('')}` : ''}
      <div class="section-label">Run the practice</div>
      ${btn('hireRole', 'Hire a physician', { arg: `${b.id}|physician` })}${btn('hireRole', 'Hire a nurse', { arg: `${b.id}|nurse` })}${btn('hireRole', 'Hire a receptionist', { arg: `${b.id}|receptionist` })}
      ${btn('service', 'Add a service', { arg: b.id })}${btn('equipment', 'Buy equipment', { arg: b.id })}${btn('partner', 'Bring in a partner', { arg: b.id })}
      ${partners.filter((x) => !x.id.startsWith('group:')).map((x) => btn('manages', `${x.manages ? 'Take back management from' : 'Share management with'} ${x.name}`, { arg: `${b.id}|${x.id}|${x.manages ? 'off' : 'on'}` })).join('')}
      ${btn('joinGroup', 'Join a medical group', { arg: b.id, disabled: !!b.medical?.group })}${btn('expand', 'Open a second location', { arg: b.id })}
      ${btn('retire', 'Retire from practice', { arg: b.id })}${btn('sell', 'Sell the practice', { arg: b.id })}
      <p class="muted">Staff wages, pricing and the books are also in Work → Business.</p>`);
  }
  if (mine.reduce((t, b) => t + b.sites, 0) >= 2 && !m.groupLeader) out += card('A medical group', `${muted('Two or more sites can become one medical group, which you would lead.')}${btn('formGroup', 'Form a medical group')}`);
  if (m.groupLeader) out += card(m.groupLeader.name, kv([['President since', String(m.groupLeader.since)]]));
  const opts = practice.practiceOptions(m, p);
  out += card('Open a practice', `${muted(practice.ownershipNote(p.countryId))}${opts.map((o) => btn('open', o.name, { arg: o.id, disabled: !!o.block, sub: o.block || `equipment from ${fmtMoney(o.equipment, country())}` })).join('')}`);
  return out;
}

function applyBlock(m) {
  const opts = train.applicationOptions(player(), m);
  const chosen = m.school?.apply ?? [];
  return `<div class="section-label">Residency applications</div>${chosen.length ? `<p>Applying to: ${esc(chosen.map((id) => specialtyName(id)).join(', then '))}</p>` : muted('Not chosen yet: your strongest rotations will be used.')}
    ${btn('apply', 'Choose specialties to apply to')}
    ${btn('local', m?.local ? 'Apply nationwide (may mean moving)' : `Apply only in ${player().city}`, { arg: m?.local ? 'off' : 'on' })}
    ${btn('second', m?.secondRound === false ? 'Enter the second round if unmatched' : 'Skip the second round', { arg: m?.secondRound === false ? 'on' : 'off' })}<p class="muted">${esc(opts.filter((o) => !o.block).length)} specialties open. A place is never guaranteed: competitive ones need a strong application.</p>`;
}

// ---------- A patient case ----------

/** A case, worked step by step: review, evaluate, assess, decide, operate, follow up. */
async function openCase(id, api) {
  // A case is a page of its own, like the career it belongs to: the whole screen, Back in the bar along the top.
  const modal = openModal('<div data-case></div>', { dismissable: true, full: true, title: 'Patient case' });
  const root = modal.el.querySelector('[data-case]');
  let last = '';
  const render = () => {
    const v = cases.caseView(id);
    if (!v) { modal.close(); return; }
    const open = v.status === 'open';
    const n = npc(v.patientId);
    root.innerHTML = `<div class="row" style="border:0;padding:0;background:none">${n ? face(n, 'lg') : ''}<div class="main"><h2 style="margin:0">${esc(v.patient?.name ?? 'Patient')}${v.patient ? `, ${v.patient.age}` : ''}</h2>
        <small>${esc(v.label)} · ${esc(v.specialty)} · <strong>${esc(v.stage)}</strong></small></div></div>
      <p class="muted">Confidential${v.supervised ? ' · supervised' : ''}${v.guardian ? ' · with a parent or guardian' : ''}${v.followUp ? ' · a follow-up visit' : ''}</p>
      ${v.teams.length ? `<p class="muted">One emergency, several teams: ${esc(v.teams.join(', '))} are working on this patient too.</p>` : ''}
      ${v.shared?.length ? `<p class="muted">The shared record so far: ${esc(v.shared.join(' '))}</p>` : ''}
      ${v.family.length ? `<p class="muted">With ${esc(v.family.map((f) => `${f.name}, ${f.as}`).join('; '))}.</p>` : ''}
      <div class="section-label">Reason for the visit</div><p>${esc(v.intro)}</p>
      <div class="section-label">Review the history</div><p>${esc(v.history)}</p>
      <div class="section-label">Review the examination</div><p>${esc(v.exam)}</p>
      ${v.triage ? `<div class="section-label">Who first?</div><p>${esc(v.triage.text)}</p>${v.triage.options.map((o) => btn('triage', o.label, { arg: o.id })).join('')}` : ''}
      <div class="section-label">Tests and imaging</div>${open && routine.workupTests(id).length ? btn('workup', 'Order the Standard Workup', { cls: 'primary', sub: 'The tests this presentation calls for, in one go' }) : ''}${v.tests.map((t) => t.done ? `<p><strong>${esc(t.name)}:</strong> ${esc(t.result)}</p>` : btn('test', t.name, { arg: t.id, disabled: !open })).join('')}
      <div class="section-label">Discuss the assessment</div>${v.differential.map((d) => btn('dx', d.label, { arg: d.id, disabled: !open, cls: v.dx === d.id ? 'primary' : '' })).join('')}
      ${open ? `<div class="section-label">Consider the treatment options</div>${v.plans.map((x) => btn('plan', x.label, { arg: x.id, disabled: !!x.block || !v.dx || !!v.triage, sub: x.block || (x.refer ? `Refers to ${x.refer}` : x.procedure ? `${x.procedure}: the operating room` : '') })).join('')}` : ''}
      ${v.or ? `<div class="card"><h3>Operating room: ${esc(v.or.procedure)}</h3>${kv([['Team', v.or.team], ['Setting', v.or.resources], ['Risk for this patient', v.or.risk]])}
        <p>${esc(v.or.step.text)}</p>${v.or.step.options.map((o) => btn('or', o.label, { arg: o.id })).join('')}</div>` : ''}
      ${v.decision ? `<div class="section-label">Under pressure</div><p>${esc(v.decision.text)}</p>${v.decision.options.map((o) => btn('decide', o.label, { arg: o.id })).join('')}` : ''}
      ${v.outcome ? `<div class="card"><h3>Outcome</h3><p>${esc(v.outcome.text)}</p>${v.notes.map((x) => `<p class="muted">${esc(x)}</p>`).join('')}</div>` : ''}
      ${v.followUpNeeded ? `<div class="section-label">Follow-up</div>${btn('follow', 'Arrange follow-up', { cls: 'primary', sub: 'They will come back next year' })}` : v.followUpBooked ? muted('Follow-up booked for next year.') : ''}
      ${last && !v.outcome ? `<p class="muted">${esc(last)}</p>` : ''}
      <div class="btn-stack" style="margin-top:12px"><button type="button" class="btn" data-close>Close</button></div>`;
  };
  const acts = { or: cases.orStep, test: cases.orderTest, dx: cases.setDiagnosis, plan: cases.choosePlan, decide: cases.decide, triage: cases.triage, follow: (cid) => cases.arrangeFollowUp(cid), workup: (cid) => routine.standardWorkup(cid) };
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

// ---------- Actions ----------

const split = (arg) => String(arg).split('|');
const ACTIONS = {
  premed: (id, x) => x.say(train.doPremed(id)),
  doToo: (_, x) => x.say(train.setDoToo(!med()?.doToo)),
  drama: (level, x) => x.say(drama.setDrama(level)),
  reapply: (on, x) => x.say(train.setReapply(on === 'on')),
  afterIntern: (c, x) => x.say(train.setAfterInternship(c)),
  local: (on, x) => x.say(train.setLocal(on === 'on')),
  second: (on, x) => x.say(train.setSecondRound(on === 'on')),
  research: (id, x) => x.say(id ? research.doResearch(id) : train.researchYear()),
  support: (_, x) => x.say(drama.requestSupport()),
  hours: (_, x) => x.say(work.changeHours(-10)),
  leave: (_, x) => x.say(work.takeLeave('vacation')),
  fellowship: (id, x) => x.say(train.applyForFellowship(id)),
  focus: (f, x) => x.say(ladder.setFocus(f)),
  track: (t, x) => x.say(ladder.setTrack(t)),
  offer: (yes, x) => x.say(ladder.answerOffer(yes === 'yes')),
  post: (id, x) => x.say(jobs.applyFor(id)),
  answer: (i, x) => x.say(jobs.answer(Number(i))),
  scope: (s, x) => { x.st.jobScope = s; x.render(); },
  accept: (id, x) => x.say(jobs.acceptOffer(id)),
  decline: (id, x) => x.say(jobs.declineOffer(id)),
  async negotiate(id, x) {
    const terms = Object.entries(jobs.TERMS);
    const i = await pickModal({ title: 'What will you ask for?', body: 'One ask per offer. They may say no, and very occasionally they offer the post to someone else.', options: terms.map(([, label]) => ({ label })) });
    if (i != null) await x.say(jobs.negotiate(id, terms[i][0]));
  },
  async review(id) {
    const v = jobs.hospitalProfile(id);
    if (!v) return;
    await messageModal({ title: v.name, body: `${v.kind} in ${v.city}. ${v.ownership}. Resources ${v.resources}/100, reputation ${v.reputation}/100. ${v.teaching ? 'Runs residency programs. ' : ''}`
      + `About ${v.physicians} physicians, ${v.nurses} nurses and ${v.administrators} administrators, serving ${v.patients}. Departments: ${v.departments.join(', ')}.`
      + `${v.history.length ? ` Lately: ${v.history.map((h) => h.text).join(' ')}` : ''}` });
  },
  case: async (id, x) => { await openCase(id, x.api); x.refresh(); },
  // A colleague's profile: My Medical Career closes, and Back from the profile brings it back as it was (tab and scroll).
  person: (id, x) => {
    const n = npc(id);
    if (!n) return;
    const keep = { section: x.st.section, hub: x.st.hub, jobScope: x.st.jobScope, scroll: x.scroll() };
    x.close();
    openNpc(n, x.api, () => openMedicine(x.api, keep));
  },
  async colAct(id, x) {
    const opts = drama.colleagueActions(id);
    const n = npc(id);
    const i = await pickModal({ title: `${n.firstName} ${n.lastName}`, body: roleOf(med(), n) || n.flags.title || 'A colleague', options: opts.map((o) => ({ label: o.label, disabled: o.done, sub: o.done ? 'Not again this year' : '' })) });
    if (i != null) await x.say(drama.withColleague(id, opts[i].id));
  },
  async open(id, x) {
    const p = player();
    const plan = {};
    const pick = async (title, entries, body) => { const i = await pickModal({ title, body, options: entries.map(([, v]) => ({ label: v.name ?? v.label ?? v, sub: v.words ?? '' })) }); return i == null ? null : entries[i][0]; };
    plan.city = await pick('Where?', [[p.city, { name: `${p.city} (here)` }], ...citiesOf(p.countryId).filter((c) => c.name !== p.city).map((c) => [c.name, { name: `${c.name} (move there)` }])], 'A practice in another city means moving there.');
    if (plan.city == null) return;
    plan.premises = await pick('Premises', Object.entries(practice.PREMISES));
    if (plan.premises == null) return;
    plan.equipment = await pick('Equipment', Object.entries(practice.EQUIPMENT));
    if (plan.equipment == null) return;
    plan.strategy = await pick('How will it run?', Object.entries(practice.STRATEGY));
    if (plan.strategy == null) return;
    const loan = await pick('Financing', [['0', { name: 'From savings only' }], ['30', { name: 'Borrow 30% of the startup cost' }], ['60', { name: 'Borrow 60% of the startup cost' }]], 'Approvals to operate are applied for as part of opening.');
    if (loan == null) return;
    const f = biz.figures(biz.typeOf({ typeId: 'clinic' }), p.countryId, plan.city);
    plan.borrow = Math.round(f.startup * Number(loan) / 100);
    const name = await inputModal({ title: 'Name the practice', label: 'Name', value: `${p.lastName} ${PRACTICE_TYPES[id]?.name ?? 'Practice'}`.slice(0, 40), maxLength: 40 });
    await x.say(practice.openPractice(id, name || '', plan));
  },
  hireRole: (arg, x) => { const [b, role] = split(arg); return x.say(practice.hireRole(b, role)); },
  async service(id, x) {
    const opts = practice.serviceOptions(id);
    const i = await pickModal({ title: 'Add a service', options: opts.map((o) => ({ label: o.name, disabled: !!o.block, sub: o.block || fmtMoney(o.price, country()) })) });
    if (i != null) await x.say(practice.addService(id, opts[i].id));
  },
  equipment: (id, x) => x.say(biz.invest(biz.business(id), 'equipment')),
  async partner(id, x) {
    const b = biz.business(id);
    const opts = biz.partnerOptions(b);
    if (!opts.length) { await x.say({ text: 'No physician you know is in a position to buy in.', tone: 'neutral' }); return; }
    const i = await pickModal({ title: 'Bring in a partner', body: 'A physician partner buys a quarter of the practice; their terms are written down.', options: opts.map((n) => ({ label: `${n.firstName} ${n.lastName}`, sub: n.occupation ?? '' })) });
    if (i != null) await x.say(practice.bringPartner(id, opts[i].id));
  },
  manages: (arg, x) => { const [b, n, on] = split(arg); return x.say(practice.setPartnerManages(b, n, on === 'on')); },
  joinGroup: (id, x) => x.say(practice.joinGroup(id)),
  formGroup: (_, x) => x.say(practice.formGroup()),
  expand: (id, x) => x.say(biz.expand(biz.business(id))),
  retire: (id, x) => x.say(practice.retireFromPractice(id)),
  sell: (id, x) => x.say(biz.sell(biz.business(id))),
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

/** Opens My Medical Career, at a tab (and, coming back from a profile, at the same place it was left). */
export function openMedicine(api, start = 'overview') {
  const st = typeof start === 'string' ? { section: start } : { section: 'overview', ...start };
  // A screen of its own: the whole screen on a phone, a readable column on a desktop, Back and the name in the bar.
  const modal = openModal('<div data-med></div>', { dismissable: true, full: true, title: screenName('medicine') });
  modal.el.classList.add('world-modal');
  const root = modal.el.querySelector('[data-med]');
  const render = () => {
    const p = player();
    const m = med(p);
    const pages = pagesFor(tabsFor(p, m));
    // A section asked for by name opens the page it is on.
    const pg = pages.find((x) => x.id === st.section) ?? pages.find((x) => x.members.some(([y]) => y === st.section)) ?? pages[0];
    st.section = pg.id;
    const body = pg.members.length === 1 ? VIEWS[pg.members[0][0]](p, m, st) : pg.members.map(([y, label]) => `<div class="section-label">${esc(label)}</div>${VIEWS[y](p, m, st)}`).join('');
    root.innerHTML = `<p class="muted" style="margin:0 0 4px">Every patient has a story.</p>
      <div class="world-groups page-tabs" role="tablist" aria-label="Sections">${pages.map((x) => `<button type="button" role="tab" class="world-group av-chip ${x.id === st.section ? 'on' : ''}" aria-selected="${x.id === st.section}" data-sec="${x.id}">${esc(x.label)}</button>`).join('')}</div>
      <div style="margin-top:10px">${body}</div>`;
  };
  const refresh = () => { api.changed(); render(); };
  const say = async (r) => { refresh(); if (r?.text) await messageModal({ body: r.text, tone: r.tone }); render(); };
  root.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-close]')) { modal.close(); return; }
    const sec = t.closest('[data-sec]');
    if (sec) { st.section = sec.dataset.sec; render(); modal.el.scrollTop = 0; return; }
    const hub = t.closest('[data-hub]');
    if (hub) { st.hub = hub.dataset.hub; render(); return; }
    const b = t.closest('[data-act]');
    if (!b || b.disabled) return;
    const fn = ACTIONS[b.dataset.act];
    if (fn) await fn(b.dataset.arg, { st, say, refresh, render, api, close: () => modal.close(), scroll: () => modal.el.scrollTop });
  });
  render();
  if (st.scroll) requestAnimationFrame(() => { modal.el.scrollTop = st.scroll; });
  return modal;
}
