// My Legal Career: law school, the bar, cases, the courtroom and a lawyer's progress, from the Work tab.
// "Every case tells a story." Tabs appear only where they mean something: a law student sees school and the bar, not a
// docket (apart from a supervised clinic case); a corporate lawyer never sees a jury. Every number and name shown here
// is read from saved state (engine/lawSchool.js, engine/lawCases.js, engine/lawPractice.js).
import { esc, fmtMoney } from '../util.js';
import { store, player, country } from '../state.js';
import { openModal, pickModal, messageModal, confirmModal, selectModal } from './modals.js';
import { fitBar } from './fitBars.js';
import * as ls from '../engine/lawSchool.js';
import * as lc from '../engine/lawCases.js';
import * as lp from '../engine/lawPractice.js';
import * as camp from '../engine/lawCampaign.js';
import * as acad from '../engine/lawAcademy.js';
import * as life from '../engine/lawLife.js';
import { openCampaign } from './lawCampaignScreen.js';
import { nextStep } from '../engine/career.js';
import { employer } from '../engine/employers.js';
import { caseLaws, eraNotes } from '../engine/realLaw.js';
import { COMPLEXITY, SIMULATION_NOTE, COURSE_BY_ID } from '../data/law.js';

const kv = (a, b) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;
const btn = (label, attrs, cls = '') => `<button type="button" class="btn ${cls}" ${attrs}>${esc(label)}</button>`;
const row = (attrs, title, sub = '', extra = '') => `<button type="button" class="tree-row law-row" ${attrs}><strong>${esc(title)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}${extra}</button>`;
const card = (title, body) => `<div class="card"><h3>${esc(title)}</h3>${body}</div>`;
const nameOf = (id) => { const n = store.state.npcs[id]; return n ? `${n.firstName} ${n.lastName}` : ''; };
const say = (r) => messageModal({ title: r.title, body: r.text, tone: r.tone });
const KIND_NAME = { criminal: 'A Criminal Case', family: 'A Family Matter', child: 'A Child\'s Case', immigration: 'An Immigration Matter', civil: 'A Civil Dispute', transaction: 'A Transaction' };

/** Which tabs make sense for this person now. */
function tabs() {
  const p = player();
  const L = p.law;
  const t = lp.trackOf(p);
  const out = [['overview', 'Overview'], ['education', 'Education & Licensing']];
  const anyCases = (L?.caseIds ?? []).length > 0;
  if (anyCases || t) out.push(['cases', 'My Cases']);
  if (t && !lp.mayPractice(p) && !['prosecutor', 'defender', 'gov_counsel'].includes(t)) out.push(['new', 'New Cases']);
  if (t) out.push(['progress', 'Career Progress'], ['office', t === 'own' ? 'Your Firm' : 'Office']);
  if ((L?.history ?? []).length || ls.admitted(p)) out.push(['history', 'Career History']);
  return out;
}

// ---------- Pages ----------

function overview() {
  const p = player();
  const o = lp.overview(p);
  const S = p.law?.school;
  const lines = [];
  if (o.title) lines.push(kv('Position', `${o.title}${o.trackName ? `, ${o.trackName.toLowerCase()}` : ''}`));
  if (o.specialty) lines.push(kv('Practice', o.specialty.name));
  if (p.law?.retired) lines.push(kv('Retired', `${p.law.retired.year}${p.law.retired.how === 'mandatory' ? ', at the judges\' retirement age' : ''}`));
  if (p.law?.policeYears > 0) lines.push(kv('Before law', `${p.law.policeYears} year${p.law.policeYears === 1 ? '' : 's'} in law enforcement`));
  lines.push(kv('Admitted to practice', o.admitted ? (p.law.bar.admitted.legacy ? 'Yes (before records were kept)' : String(p.law.bar.admitted.year)) : 'Not yet'));
  if (S && !S.done) lines.push(kv('Law school', `Term ${S.terms.length} of ${ls.termsFor(p)}${S.probation ? ' · on probation' : ''}`));
  if (o.track) lines.push(kv('Open cases', `${o.workload.open}`), kv('Years of legal work', String(Math.round(o.years))));
  const s = o.stats;
  const rec = o.track || s.completed ? `<div class="card"><h3>Record</h3>${kv('Cases completed', String(s.completed))}${kv('Trials', `${s.trials} (${s.trialsWon} won, ${s.trialsLost} lost)`)}${kv('Settlements', String(s.settlements))}${kv('Plea agreements', String(s.pleas))}${kv('Dismissals', String(s.dismissals))}${kv('Appeals', String(s.appeals))}
    ${o.legacy ? `<p class="muted">${esc(o.legacy.note)}</p>` : ''}</div>` : '';
  const why = o.why && o.track ? `<p class="muted">${esc(o.why)}</p>` : '';
  return `${lawThisYear(p, o)}${card('Where you stand', lines.join('') + why)}${rec}${o.track ? '' : `<p class="muted">${esc(o.admitted ? 'Apply for legal jobs from Find Work, or open a practice of your own.' : 'Law school, then the bar: both start from the Education & Licensing tab.')}</p>`}`;
}

/**
 * "This year" at the top of My Legal Career: where you stand, the next step, what is holding you back (named), and a
 * button for each useful thing to do now.
 */
function lawThisYear(p, o) {
  if (!o.track) return '';
  const L = p.law ?? {};
  const ns = nextStep();
  const yrs = p.career?.yearsInRole ?? 0;
  const rows = [kv('Now', `${o.title ?? 'Lawyer'}${yrs ? `, ${yrs} year${yrs === 1 ? '' : 's'} in this role` : ''}`),
    kv('Next', ns ? `${ns.title}${ns.yearsLeft ? `, in about ${ns.yearsLeft} year${ns.yearsLeft === 1 ? '' : 's'}` : ''}` : 'You are at the top of this path')];
  const holding = [];
  const acts = [];
  const open = (L.caseIds ?? []).map(lc.caseById).filter((c) => c && !c.done);
  const waiting = open.filter((c) => c.awaiting);
  if (waiting.length) holding.push(`${waiting.length === 1 ? 'A case needs' : `${waiting.length} cases need`} you: a day in court is waiting`);
  if (ns?.missing?.length) holding.push(`To get there: ${ns.missing.join('; ')}`);
  const finished = (L.history ?? []).filter((h) => !h.clinic && h.year);
  const last = finished.length ? Math.max(...finished.map((h) => h.year)) : null;
  const since = last != null ? store.state.year - last : null;
  if ((since ?? o.years) >= 2 && o.years >= 2) holding.push(since == null ? 'You have not finished a case yet: promotions count completed cases' : `You have not finished a case in ${since} years: promotions count completed cases`);
  if ((p.career?.performance ?? 60) < 55) holding.push(`Your performance at work is low (${Math.round(p.career.performance)}): finishing cases well raises it`);
  if (open.length) acts.push(btn(waiting.length ? `Your cases (${waiting.length} need${waiting.length === 1 ? 's' : ''} you)` : `Your cases (${open.length} open)`, 'data-go="cases"', waiting.length ? 'primary' : ''));
  if ((L.offers ?? []).length) acts.push(btn(`New cases (${L.offers.length})`, 'data-go="new"'));
  acts.push(btn(L.autoRoutine ? 'Routine work: done for you (tap to do it yourself)' : 'Let routine work be done for you', 'data-law="autoRoutine"'));
  return `<div class="card this-year-card"><h3>This year</h3>${rows.join('')}${holding.length ? `<div class="section-label">What is holding you back</div>${holding.map((x) => `<p class="body" style="margin:4px 0">${esc(x)}</p>`).join('')}` : ''}${acts.length ? `<div class="btn-stack" style="margin-top:8px">${acts.join('')}</div>` : ''}</div>`;
}

function education() {
  const p = player();
  const L = ls.lawOf(p);
  const prof = ls.profileFor(p.countryId);
  const parts = [];
  const ent = ls.entrance(p);
  if (ent && !ls.hasLawDegree(p) && !(p.education.enrolled && p.education.stage === 'law')) {
    parts.push(card(`The ${ent.name}`, `${kv('Best score', ent.best ? String(ent.best) : 'Not taken')}${kv('Attempts', String(ent.tries))}
      ${ent.ready ? '' : '<p class="muted">Taken near the end of a first degree.</p>'}
      <div class="btn-stack">${btn('Study for It', 'data-law="prepEntrance"', '')}${btn(`Sit the ${ent.name}`, 'data-law="sitEntrance"', 'primary')}</div>
      <p class="muted">Then apply to law school from Plan What Comes Next.</p>`));
  }
  const S = p.law?.school;
  if (S && !S.done && p.education.enrolled && p.education.stage === 'law') {
    const t = S.terms.at(-1);
    const graded = S.terms.filter((x) => x.gpa != null);
    parts.push(card(`Law school · term ${S.terms.length} of ${ls.termsFor(p)}`, `${kv('School', p.education.schoolName ?? 'Law school')}${kv('This term', t.courses.map((id) => COURSE_BY_ID[id].name).join(', '))}
      ${graded.length ? kv('GPA so far', `${ls.lawGpa(p).toFixed(2)}${S.probation ? ' · academic probation' : ''}`) : ''}
      ${ls.termExam(p) ? btn('Sit This Term\'s Exam', 'data-law="exam"', 'primary') : '<p class="muted">Exam done for this term.</p>'}`));
    if (S.terms.length >= 2) {
      parts.push(card('Electives for next term', `<p class="muted">Two a term. Chosen: ${S.electives.map((id) => COURSE_BY_ID[id].name).join(', ') || 'none yet'}.</p>${btn('Choose Electives', 'data-law="electives"')}`));
    }
    const acts = ls.schoolActs(p);
    parts.push(card('Beyond the classes', acts.map((a) => row(`data-sact="${a.id}" ${a.done || a.locked ? 'disabled' : ''}`, a.name, a.locked || (a.done ? 'Done for now' : ''))).join('')
      + row('data-law="internship"', 'Apply for an Internship', L.internships.some((x) => x.year === Math.floor((ls.nowM() - S.start) / 12)) ? 'One placement a year' : 'Judges, firms, prosecutors, defenders, legal aid, agencies')));
  }
  if (S?.done || ls.hasLawDegree(p)) {
    const b = ls.barStatus(p);
    const att = L.bar.attempts;
    const adm = L.bar.admitted;
    parts.push(card(`The ${ls.barExamName(p)}`, `${kv('Status', b.stage === 'admitted' ? (adm?.year && !adm.legacy ? `Admitted in ${adm.year}` : 'Admitted') : b.text)}${att.length ? kv('Attempts', att.map((a) => `${a.year}: ${a.passed ? 'passed' : 'not passed'}`).join('; ')) : ''}
      ${b.stage === 'admitted' || b.stage === 'training' ? '' : `<div class="btn-stack">${!b.prepared ? `${btn('Take a Bar Course', 'data-law="prepCourse"')}${btn('Study on Your Own', 'data-law="prepSelf"')}` : ''}${b.stage === 'open' ? btn(`Sit the ${prof.exam}`, 'data-law="bar"', 'primary') : ''}</div>`}
      ${b.stage === 'admitted' ? '' : `<p class="muted">Then the ${esc(prof.fitness)}, and ${esc(prof.admission)}.</p>`}`));
  }
  const rl = ls.canReadLaw(p);
  if (!rl || p.law?.readLaw) parts.push(card('Reading the law', p.law?.readLaw ? kv('Status', p.law.readLaw.done ? 'Done: you may be examined for the bar' : `In ${nameOf(p.law.readLaw.mentorId)}'s office, ${Math.max(0, p.law.readLaw.until - ls.nowM())} months to go`)
    : `<p class="muted">Before law schools were the way in, lawyers learned in a practicing lawyer's office.</p>${btn('Read the Law', 'data-law="readLaw"', 'primary')}`));
  if (!parts.length) parts.push(`<p class="muted">${esc(p.education.degrees.some((d) => d.type === 'university') ? 'Apply to law school from Plan What Comes Next.' : 'Law school comes after a first degree.')}</p>`);
  const note = prof.depth === 'full' ? '' : `<p class="muted">${esc(prof.name)}: ${esc(prof.note ?? 'a simplified model of how lawyers qualify here.')}</p>`;
  const era = eraNotes(p.countryId);
  // After law school: a clerkship with a judge, or the academy.
  if (ls.admitted(p)) {
    const cw = acad.clerkshipWhy(p); const pw = acad.professorWhy(p);
    const C = L.clerkship;
    const duties = acad.professorDuties(p);
    parts.push(card('Beyond Practice', `${C ? kv('Clerkship', C.done ? 'Done' : `Clerking for Judge ${store.state.npcs[C.judgeId]?.lastName ?? ''}`) : ''}
      ${L.professor ? kv('Law faculty', `${p.career?.careerId === 'academic' ? p.career.title : 'Former professor'} · ${L.professor.articles} article${L.professor.articles === 1 ? '' : 's'}${L.professor.tenure ? ` · tenure ${L.professor.tenure}` : ''}`) : ''}
      ${row(`data-acad="clerk" ${cw ? 'disabled' : ''}`, 'Apply for a Judicial Clerkship', cw || 'A year working for a judge: research, drafting, and how courts decide.')}
      ${row(`data-acad="professor" ${pw ? 'disabled' : ''}`, 'Apply to Teach Law', pw || 'A faculty vote after a job talk. Then teaching, writing, and tenure in year six.')}
      ${duties.length ? `<div class="section-label">This term</div>${duties.map((d) => row(`data-profduty="${d.id}" ${d.done ? 'disabled' : ''}`, d.name, d.done ? 'Done' : '')).join('')}` : ''}`));
  }
  return parts.join('') + note + (era.length ? card(`The law in ${store.state.year}`, era.map((x) => `<p class="muted">${esc(x)}</p>`).join('')) : '');
}

function myCases() {
  const L = ls.lawOf();
  const all = L.caseIds.map(lc.caseById).filter(Boolean);
  const open = all.filter((c) => !c.done);
  const closed = all.filter((c) => c.done).reverse().slice(0, 12);
  const line = (c) => row(`data-case="${c.id}"`, c.title, `${lc.roleName(c)} · ${COMPLEXITY[c.level]} · ${c.done ? c.outcome?.text ?? 'Closed' : lc.STAGE_NAME[lc.stageOf(c)] ?? ''}${c.awaiting && !c.done ? ' · needs you' : ''}`);
  const w = lc.workload();
  // One page for the docket: what needs you now (hearings, then filings due), the open cases, the closed ones, the clients.
  const court = open.filter((c) => c.awaiting && c.awaiting.since <= ls.nowM());
  const due = filingRows().filter((r) => r.due - ls.nowM() <= 3);
  const needs = court.length || due.length ? `<div class="section-label">Needs you</div>${court.map((c) => row(`data-case="${c.id}"`, `In court: ${c.title}`, `${lc.forumName(c)}${c.jury ? ' · jury' : ''}`)).join('')}${due.map(filingRow).join('')}` : '';
  const clientRows = clients(true);
  return `${needs}${open.length ? `<div class="section-label">Open</div>${open.map(line).join('')}` : '<p class="empty">No open cases.</p>'}
    ${lp.trackOf() ? fitBar('Workload', Math.min(100, w.points / w.capacity * 70)) : ''}
    ${open.some(lc.hasRoutine) ? `<div class="btn-row">${btn('Handle Routine Work on All Cases', 'data-routineall', 'primary')}</div>` : ''}
    ${(() => { const why = life.proBonoWhy(); return lp.trackOf() && lp.trackOf() !== 'judiciary' ? `<div class="section-label">Pro bono</div>${row(`data-probono ${why ? 'disabled' : ''}`, 'Take a Pro Bono Case', why || `Represent someone who cannot afford a lawyer, without a fee.${player().countryId === 'us' && store.state.year >= 1983 ? ' ABA Model Rule 6.1 asks every lawyer for 50 hours a year.' : ''}`)}` : ''; })()}
    ${lp.trackOf() ? `<div class="btn-row law-load">${btn('Ask for Support', 'data-load="support"')}${btn('Take Leave', 'data-load="leave"')}</div>` : ''}
    ${closed.length ? `<div class="section-label">Closed</div>${closed.map(line).join('')}` : ''}
    ${clientRows ? `<div class="section-label">Clients</div>${clientRows}` : ''}`;
}

/** Everyone the player has represented, and where their case stands. */
function clients(quiet = false) {
  const all = ls.lawOf().caseIds.map(lc.caseById).filter((c) => c?.clientId);
  const seen = new Map();
  for (const c of all) { const x = seen.get(c.clientId) ?? { id: c.clientId, cases: [] }; x.cases.push(c); seen.set(c.clientId, x); }
  if (!seen.size) return quiet ? '' : '<p class="empty">No clients yet. A prosecutor and agency counsel act for the government, not for clients.</p>';
  return [...seen.values()].map((x) => `<button type="button" class="tree-row" data-npcperson="${x.id}"><strong>${esc(nameOf(x.id))}</strong><small>${esc(x.cases.map((c) => `${c.title}: ${c.done ? c.outcome?.kind ?? 'closed' : lc.STAGE_NAME[lc.stageOf(c)] ?? ''}`).join(' · '))}</small></button>`).join('');
}

/** Every filing still to make, across all open cases, soonest first. */
function filingRows() {
  return ls.lawOf().caseIds.map(lc.caseById).filter((c) => c && !c.done)
    .flatMap((c) => [...lc.proceduralDue(c).map((pf) => ({ c, name: pf.name, due: pf.deadline.due })), ...(c.deadlines.filter((d) => d.id === 'filing' && d.met == null).map((d) => ({ c, name: d.label, due: d.due })))])
    .sort((a, b) => a.due - b.due);
}
const filingRow = (r) => row(`data-case="${r.c.id}"`, r.name, `${r.c.title} · ${r.due - ls.nowM() > 0 ? `due in ${r.due - ls.nowM()} month${r.due - ls.nowM() === 1 ? '' : 's'}` : 'due now'}`);

function newCases() {
  const list = lp.offers();
  if (!list.length) return '<p class="empty">No new cases this half-year. More come in time.</p>';
  return list.map((o) => `<div class="card law-offer"><h3>${esc(o.personal ? `Your ${o.personal.replace(/^./, (x) => x.toUpperCase())} Asks for Help` : o.prominent ? 'A Prominent Client' : o.returning ? 'A Former Client Returns' : KIND_NAME[o.kind] ?? 'A New Case')}</h3>
    <p>${esc(o.summary)}</p>${kv('Complexity', COMPLEXITY[o.level])}${kv('Expected fee', fmtMoney(o.fee, country()))}${o.second ? kv('Your part', 'Second chair, under a supervisor') : ''}
    <div class="btn-row">${btn('Accept', `data-accept="${o.id}"`, 'primary')}${btn('Refer', `data-refer="${o.id}"`)}${btn('Decline', `data-decline="${o.id}"`)}</div></div>`).join('');
}

function progress() {
  const p = player();
  const o = lp.overview(p);
  const ns = nextStep();
  const ops = lp.opportunities(p);
  return `${card(o.title ?? 'Your practice', `${kv('Practice area', o.specialty?.name ?? 'None chosen')}${kv('Years of legal work', String(Math.round(o.years)))}${kv('Cases you lead', `up to ${o.capName}`)}
    ${btn('Change Practice Area', 'data-law="specialty"')}`)}
    ${ns ? card('Next step', `${kv('Next', ns.title)}${ns.yearsLeft ? kv('Years to go', String(ns.yearsLeft)) : ''}${ns.missing.length ? `<p class="muted">Also needed: ${esc(ns.missing.join('; '))}.</p>` : '<p class="muted">Eligible. It depends on your reviews and on a place opening up.</p>'}`) : ''}
    ${campaignCard()}
    ${(() => { const p2 = player(); const L2 = p2.law ?? {}; if (L2.retired) return ''; const age = life.judicialRetirementAge(p2.countryId); const judge = p2.career?.careerId === 'judiciary';
      return card('Retirement', `${judge && age ? `<p class="muted">Judges here must retire at ${age}.</p>` : ''}${row(`data-retire ${p2.age < 55 ? 'disabled' : ''}`, judge ? 'Retire from the Bench' : 'Retire from the Law', p2.age < 55 ? 'From age 55' : 'Close your files and look back on the career.')}`); })()}
    ${ops.length ? card('Opportunities', ops.map((x) => row(`data-seek="${x.id}" ${x.why ? 'disabled' : ''}`, x.name, x.why || (x.how ? `Chosen by: ${x.how}` : ''))).join('')) : ''}
    ${card(o.specialty ? `Skills in ${o.specialty.name}` : 'Skills', o.skills.map((s) => fitBar(s.name, s.v)).join('') + (o.specialty ? '<p class="muted">Named for your practice area. Change areas and they take new names; what you have learned stays.</p>' : ''))}
    ${card('Reputation', o.rep.map((r) => fitBar(r.name, r.v)).join('') + '<p class="muted">Built from how you work, not how many cases you win.</p>')}`;
}

/** A race in progress: a short card here; the trail itself is its own screen (ui/lawCampaignScreen.js). */
function campaignCard() {
  const c = camp.campaignOf();
  if (!c) return '';
  const stage = c.round > camp.ROUNDS ? 'Election Day is here' : `Stretch ${c.round} of ${camp.ROUNDS}`;
  return card(`Running for ${c.title}`, `${kv('Now', stage)}<div class="btn-row">${btn('Open the Campaign', 'data-campopen', 'primary')}</div>`);
}

function office() {
  const p = player();
  const t = lp.trackOf(p);
  if (t === 'own') {
    const f = lp.firmView(p);
    const L = p.law ?? {};
    return card(f.name, `${kv('Founded', String(f.founded))}${kv('Staff', String(f.staff))}${kv('Firm cash', fmtMoney(f.cash, country()))}
      ${kv('Fees', lp.FEE_STRATEGIES[L.fees ?? 'standard'].name)}${kv('Malpractice cover', L.malpractice ? 'Insured' : 'None')}
      <div class="btn-row">${btn('Advertise', 'data-firm="ads"')}${btn('Set Fees', 'data-firm="fees"')}${btn(L.malpractice ? 'Drop Malpractice Cover' : 'Insure Against Malpractice', 'data-firm="insure"')}</div>
      <p class="muted">Hiring staff and the books are run from the business, in Holdings.</p>`)
      + card('Your Lawyers', `${f.associates.length ? f.associates.map((a) => row(`data-partner="${a.id}" ${a.canPartner ? '' : 'disabled'}`, a.name, a.partner ? `Partner since ${a.partnerSince}` : a.canPartner ? `Associate since ${a.since} · Make Partner` : `Associate since ${a.since}`)).join('') : '<p class="empty">Just you, for now.</p>'}
        <div class="btn-row">${btn('Hire an Associate', 'data-firm="hire"')}</div><p class="muted">Associates carry cases and bring in fees. Pass someone over for too long, and they may leave.</p>`);
  }
  const duties = lp.leaderDuties(p);
  const lead = duties.length ? card('Your duties this half-year', duties.map((d) => row(`data-duty="${d.id}" ${d.done ? 'disabled' : ''}`, d.name, d.done ? 'Done' : '')).join('')) : '';
  const bench = t === 'judiciary' ? card('The bench', `<p class="muted">Criminal trials, civil disputes and family matters all come before you. Rule on the evidence; know when to step aside.</p>${btn('Hear the Next Matter', 'data-bench', 'primary')}${(p.law?.benchRecord ?? []).slice(-5).reverse().map((r) => kv(String(r.year), `${r.title}: ${r.reversed ? 'reversed on appeal' : r.right ? 'upheld' : 'stood'}`)).join('')}`) : '';
  const sup = lp.supervisor(p);
  const v = lp.officeView(p);
  return lead + bench + card(p.career.title, `${kv('Employer', v.employer?.name ?? employer(p.career.employerId)?.name ?? 'Your office')}${v.employer?.founded ? kv('Founded', String(v.employer.founded)) : ''}${kv('Reports to', `${sup.firstName} ${sup.lastName}, ${sup.flags.title.toLowerCase()}`)}
      ${(v.employer?.history ?? []).length ? `<div class="section-label">Its history</div>${v.employer.history.map((h) => kv(String(h.year), h.text)).join('')}` : ''}`)
    + (['prosecutor', 'defender', 'gov_counsel'].includes(t) ? '<p class="muted">Cases are assigned by the office every half-year.</p>' : '')
    + card('The court', v.judges.map((j) => `<button type="button" class="tree-row" data-npcperson="${j.id}"><strong>${esc(j.name)}</strong><small>Judge${j.classmate ? ' · your law school classmate' : ''} · ${j.cases ? `${j.cases} of your cases, ${j.decided} decided` : 'none of your cases yet'}</small></button>`).join(''))
    + (v.rivals.length ? card('Rivals', v.rivals.map((r) => `<button type="button" class="tree-row" data-npcperson="${r.id}"><strong>${esc(r.name)}</strong><small>Faced at trial ${r.cases} time${r.cases === 1 ? '' : 's'}</small></button>`).join('')) : '');
}

function history() {
  const me = store.state.player;
  const ev = lp.legalLegacy(me.archiveId ?? me.id, me.archiveId ?? me.id).filter((e) => e.privacy !== 'restricted');
  const H = ls.lawOf().history.slice().reverse().slice(0, 30);
  const R = ls.lawOf().retired;
  const back = R ? card('Looking Back', `${kv('Years in law', String(R.summary.years))}${kv('Cases', `${R.summary.cases} (${R.summary.won} won or resolved well)`)}${R.summary.bench ? kv('Matters heard as a judge', String(R.summary.bench)) : ''}${R.summary.proBono ? kv('Without a fee', String(R.summary.proBono)) : ''}
    ${R.summary.big.length ? `<div class="section-label">Remembered for</div>${R.summary.big.map((b) => `<p class="muted">${esc(b)}</p>`).join('')}` : ''}`) : '';
  return `${back}${ev.length ? card('Milestones', ev.map((e) => kv(String(e.year), e.title)).join('')) : ''}
    ${H.length ? card('Completed cases', H.map((h) => kv(String(h.year), `${h.title}: ${h.outcome}`)).join('')) : '<p class="empty">No completed cases yet.</p>'}`;
}

/** One case: its file, its people, what can be done, and its history. */
function casePage(c) {
  const st = lc.stageOf(c);
  const T = lc.template(c);
  const acts = lc.actions(c);
  const grounds = lc.appealGrounds(c);
  const ev = c.evidence.map((e) => `<div class="law-ev"><strong>${esc(e.label)}</strong><small>${esc(e.reviewed ? `${e.status === 'excluded' ? 'Excluded by the court' : e.admissibility === 'challengeable' ? 'Can be challenged' : 'Admitted'}${e.fromClient ? ' · from the client' : ''}` : 'Not yet reviewed')}</small>${e.reviewed ? fitBar('Reliability', e.reliability) : ''}</div>`).join('');
  const next = c.done ? 'Closed' : c.awaiting ? (c.awaiting.what === 'trial' ? 'Trial: waiting for you' : 'Hearing: waiting for you') : `${lc.STAGE_NAME[c.stages[c.stageIdx + 1]?.s] ?? 'Next stage'} ${c.due - ls.nowM() > 0 ? `in ${c.due - ls.nowM()} month${c.due - ls.nowM() === 1 ? '' : 's'}` : 'next'}`;
  return `<div class="eyebrow">${esc(lc.roleName(c))}</div><h2>${esc(c.title)}</h2>
    <p class="muted">${esc(c.summary)}</p>
    ${card('The case', `${kv('Stage', c.done ? 'Closed' : lc.STAGE_NAME[st] ?? st)}${kv('Where', lc.forumName(c))}${c.jury ? kv('Decided by', 'A jury') : ''}${kv('Complexity', COMPLEXITY[c.level])}${kv('Fee', { salary: 'Salaried: no fee', pro_bono: 'No fee: you are doing this for family or a friend', hourly: 'By the hour', flat: 'A flat fee', contingency: `A share of any award (${Math.round((lc.contingencyRule(c.templateId, c.countryId).share ?? 0) * 100)}%)` }[c.fee.model] ?? c.fee.model)}${kv('Next', next)}
      ${c.clientId ? `<button type="button" class="tree-row" data-npcperson="${c.clientId}"><strong>${esc(nameOf(c.clientId))}</strong><small>Client${c.clientAccount ? ` · ${esc(c.clientAccount)}` : ''}</small></button>` : kv('Client', c.role === 'prosecution' ? 'The government (the people of the state)' : c.role === 'agency' ? 'The agency' : '—')}
      ${c.parties.otherId ? `<button type="button" class="tree-row" data-npcperson="${c.parties.otherId}"><strong>${esc(nameOf(c.parties.otherId))}</strong><small>Other party</small></button>` : c.vars.otherOrg && c.kind !== 'criminal' ? kv('Other party', c.vars.otherOrg) : ''}
      ${c.role === 'prosecution' ? `<button type="button" class="tree-row" data-npcperson="${c.parties.defendantId}"><strong>${esc(nameOf(c.parties.defendantId))}</strong><small>Defendant · not guilty unless proved</small></button>` : ''}
      ${c.knownOfficer ? `<p class="muted">${esc(nameOf(c.knownOfficer.id))}, the ${esc(c.knownOfficer.role.toLowerCase())}, is someone you worked beside on the force.</p>` : ''}
      ${c.judgeId ? `<button type="button" class="tree-row" data-npcperson="${c.judgeId}"><strong>${esc(nameOf(c.judgeId))}</strong><small>Judge</small></button>` : ''}
      ${c.otherCounselId ? `<button type="button" class="tree-row" data-npcperson="${c.otherCounselId}"><strong>${esc(nameOf(c.otherCounselId))}</strong><small>Opposing counsel</small></button>` : ''}
      ${c.supervisorId ? `<button type="button" class="tree-row" data-npcperson="${c.supervisorId}"><strong>${esc(nameOf(c.supervisorId))}</strong><small>${c.clinic ? 'Clinic supervisor' : 'Supervising attorney'}</small></button>` : ''}`)}
    ${acts.length || grounds.length ? `<div class="btn-stack law-acts">${lc.hasRoutine(c) ? btn('Handle the Routine Steps', 'data-cact="routine"', 'primary') : ''}${acts.filter((a) => !lc.hasRoutine(c) || !['interview', 'review'].includes(a.id) && !a.id.startsWith('proc:')).map((a) => btn(a.label, `data-cact="${a.id}"`, a.id === 'court' ? 'primary' : '')).join('')}${grounds.length ? btn('Appeal', 'data-cact="appeal"') : ''}${!c.done && !c.clinic && !c.delegated && (player().career?.level ?? 0) >= 1 ? btn('Delegate Routine Work', 'data-cact="delegate"') : ''}${!c.done && !c.clinic ? btn('Refer to a Colleague', 'data-cact="refer"') : ''}</div>` : ''}
    ${(() => { const laws = caseLaws(c); return card('The law', laws.length ? laws.map(({ law }) => `<div class="law-ev"><strong>${esc(law.name)}</strong><small>${esc(law.summary)}${law.note ? ` ${esc(law.note)}` : ''}</small></div>`).join('')
      : '<p class="muted">Pathways does not list this country\'s laws for this kind of case: the rules here are simplified.</p>'); })()}
    ${card('Evidence', ev || '<p class="muted">No evidence in this file.</p>')}
    ${c.witnesses.length ? card('Witnesses', c.witnesses.map((w) => `<button type="button" class="tree-row" data-npcperson="${w.npcId}"><strong>${esc(nameOf(w.npcId))}</strong><small>${esc(w.role)}${w.examined ? ` · ${w.examined === 'shaken' ? 'shaken on cross' : 'held firm'}` : ''}</small></button>`).join('')) : ''}
    ${c.filings.length ? card('Filings', c.filings.map((f) => kv(f.name, `${f.ruling ?? 'pending'}${f.routine ? ' (routine)' : ''}`)).join('')) : ''}
    ${c.deadlines.length ? card('Deadlines', c.deadlines.map((d) => kv(d.label, d.met == null ? `in ${Math.max(0, d.due - ls.nowM())} months` : d.met ? 'met' : 'missed')).join('')) : ''}
    ${c.outcome ? card('Outcome', `<p>${esc(c.outcome.text)}</p>${c.appeal ? kv('Appeal', c.appeal.outcome ?? 'waiting for the appeal court') : ''}`) : ''}
    ${card('Case history', c.history.slice().reverse().map((h) => kv(String(h.year), h.text)).join(''))}
    <p class="muted">${esc(SIMULATION_NOTE)}</p>`;
}

// ---------- Interactions ----------

async function caseAction(c, id) {
  if (id === 'routine') return say(lc.routine(c));
  if (id === 'interview') return say(lc.interview(c));
  if (id === 'delegate') return say(lp.delegate(c.id));
  if (id === 'review') return say(lc.review(c));
  if (id === 'refer') { if (await confirmModal({ title: 'Refer this case?', body: 'A colleague takes it over. You will not be paid for it.', yes: 'Refer' })) return say(lp.referOut(c.id)); return undefined; }
  if (id === 'research') {
    const q = lc.researchQuestion(c);
    const a = await pickModal({ title: 'Research', body: q.text, options: q.options.map((o, i) => ({ value: i, label: o })) });
    return a == null ? undefined : say(lc.research(c, a));
  }
  if (id === 'file') {
    const f = lc.filingOptions(c);
    const a = await pickModal({ title: f.name, body: 'Choose the argument to put to the court.', options: f.options.map((o) => ({ value: o.kind, label: o.text })) });
    return a == null ? undefined : say(lc.file(c, a));
  }
  if (id === 'negotiate') {
    const o = lc.currentOffer(c);
    const yes = await confirmModal({ title: c.kind === 'criminal' ? 'A plea offer' : 'An offer', body: `${o.text} ${c.kind === 'criminal' && c.role === 'defense' ? 'It is your client\'s decision, on your advice.' : ''}`, yes: 'Accept', no: 'Decline' });
    return say(lc.negotiate(c, yes));
  }
  if (id === 'charging') {
    const a = await pickModal({ title: 'Should you file charges?', body: 'Look at what the evidence can prove, not at what you would like it to prove.', options: [
      { value: 'proceed', label: 'Proceed on the charges' }, { value: 'reduce', label: 'Proceed on a lesser charge' }, { value: 'dismiss', label: 'Drop the charges' }] });
    return a == null ? undefined : say(lc.reviewCharges(c, a));
  }
  if (id === 'ethics') {
    const sc = lc.ethicsScene(c);
    const a = await pickModal({ title: 'A difficult request', body: sc.text, options: sc.options.map((o) => ({ value: o.v, label: o.text })) });
    return a == null ? undefined : say(lc.resolveEthics(c, a));
  }
  if (id === 'appeal') {
    const g = lc.appealGrounds(c);
    const a = await pickModal({ title: 'Appeal', body: 'An appeal is decided on the record of what happened, not by hearing the witnesses again.', options: g.map((x) => ({ value: x.id, label: x.text })) });
    return a == null ? undefined : say(lc.fileAppeal(c, a));
  }
  if (id.startsWith('proc:')) {
    const pf = lc.proceduralDue(c).find((x) => `proc:${x.id}` === id);
    if (!pf) return undefined;
    const a = await pickModal({ title: pf.name, body: `Due in ${Math.max(0, pf.deadline.due - ls.nowM())} month${pf.deadline.due - ls.nowM() === 1 ? '' : 's'}. If you leave it, a routine version goes in, unless you are swamped.`, options: pf.options.map(([t, k]) => ({ value: k, label: t })) });
    return a == null ? undefined : say(lc.fileProcedure(c, pf.id, a));
  }
  if (id === 'court') return courtroom(c);
  return undefined;
}

/** The day in court: one decision at a time, then the result. */
async function courtroom(c) {
  const day = lc.courtroom(c);
  if (!day) return undefined;
  const go = await confirmModal({ title: day.what === 'trial' ? 'The Night Before Trial' : 'Your Day in Court', body: `${c.title}. ${day.judge ? `Judge ${day.judge}.` : ''}${day.opposing ? ` Against ${day.opposing}.` : ''}${day.jury ? ' A jury will decide.' : ''}`, yes: day.what === 'trial' ? 'Go to Court' : 'Begin', no: 'Not Yet' });
  if (!go) return undefined;
  const answers = {};
  for (const ph of day.phases) {
    const a = await pickModal({ title: ph.title, body: ph.text ?? '', options: ph.options.map((o) => ({ value: o.v, label: o.text })), cancel: 'Leave it to routine' });
    if (a == null) break;
    answers[ph.id] = a;
  }
  const r = lc.argue(c, answers);
  return messageModal({ title: c.done ? (c.kind === 'criminal' ? 'The Verdict' : c.kind === 'transaction' ? 'The Closing' : 'The Ruling') : 'Court', body: r.text, tone: r.tone });
}

async function schoolAction(id) {
  if (id === 'autoRoutine') return say(lc.setAutoRoutine(!player().law?.autoRoutine));
  if (id === 'prepEntrance') return say(ls.prepEntrance());
  if (id === 'readLaw') return say(ls.startReadingLaw());
  if (id === 'sitEntrance') return say(ls.sitEntrance());
  if (id === 'prepCourse') return say(ls.prepareBar('course'));
  if (id === 'prepSelf') return say(ls.prepareBar('self'));
  if (id === 'exam' || id === 'bar') {
    const ex = id === 'exam' ? ls.termExam() : ls.barExam();
    if (!ex) return undefined;
    const answers = [];
    for (const q of ex.questions) {
      const a = await pickModal({ title: q.courseName, body: q.text, options: q.options.map((o, i) => ({ value: i, label: o })), cancel: 'Skip this question' });
      answers.push(a ?? -1);
    }
    const r = id === 'exam' ? ls.answerExam(answers) : ls.takeBar(answers);
    return messageModal({ title: id === 'exam' ? 'Your Exam' : 'The Bar Exam Results', body: `${r.text}${r.explain ? `\n\n${r.explain.join('\n')}` : ''}`, tone: r.tone });
  }
  if (id === 'electives') {
    const a = await pickModal({ title: 'Electives', body: 'Two a term. Pick one to add or take off your list.', options: ls.electiveOptions().filter((e) => !e.taken).map((e) => ({ value: e.id, label: `${e.chosen ? '✓ ' : ''}${e.name}` })) });
    return a == null ? undefined : say(ls.chooseElective(a));
  }
  if (id === 'internship') {
    const a = await pickModal({ title: 'Internships', body: 'One placement a year. Each has a supervisor who may vouch for you later; nothing is promised.', options: ls.internshipOptions().map((x) => ({ value: x.id, label: x.name, disabled: !!x.locked, sub: x.locked || x.who })) });
    return a == null ? undefined : say(ls.applyInternship(a));
  }
  if (id === 'specialty') {
    const a = await selectModal({ eyebrow: 'Practice', emoji: '⚖️', title: 'Practice Area', body: 'Where you practice decides the cases you are offered. Areas marked "not yet playable" exist but have no cases yet.', label: 'Practice area', button: 'Choose',
      options: lp.specialtyOptions().filter((s) => s.open).map((s) => ({ value: s.id, label: `${s.name}${s.playable ? '' : ' (not yet playable)'}` })) });
    return a == null ? undefined : say(lp.chooseSpecialty(a));
  }
  return undefined;
}

async function schoolAct(id) {
  if (id === 'moot') {
    const m = ls.mootCourt();
    const research = await pickModal({ title: 'Moot Court: the question', body: m.problem.text, options: m.problem.options.map((o, i) => ({ value: i, label: o })) });
    if (research == null) return undefined;
    const brief = await pickModal({ title: 'Your brief', body: 'How will you write it?', options: m.brief.map(([t, v]) => ({ value: v, label: t })) });
    if (brief == null) return undefined;
    const bench = await pickModal({ title: 'Oral argument', body: m.bench.text, options: m.bench.options.map(([t, v]) => ({ value: v, label: t })) });
    if (bench == null) return undefined;
    return say(ls.finishMoot({ research, brief, bench }));
  }
  if (id === 'mock') {
    const m = ls.mockTrial();
    const objection = await pickModal({ title: 'Mock trial: an objection?', body: m.objection.text, options: m.objection.options.map(([t, v]) => ({ value: v, label: t })) });
    if (objection == null) return undefined;
    const cross = await pickModal({ title: 'Mock trial: cross-examination', body: m.cross.text, options: m.cross.options.map(([t, v]) => ({ value: v, label: t })) });
    if (cross == null) return undefined;
    return say(ls.finishMock({ objection, cross }));
  }
  if (id === 'clinic') return say(lp.clinicCase());
  return say(ls.doSchoolAct(id));
}

// ---------- The screen ----------

/**
 * Opens My Legal Career.
 * @param {{changed:Function, openNpc?:Function}} api
 * @param {{tab?:string, caseId?:string}} [start]
 */
/** A short guide to the legal career: shown the first time the screen opens, and again from How It Works. */
const GUIDE = [
  ['Education & Licensing', 'Law school term by term, then the bar exam. Nobody practices until they are admitted.'],
  ['My Cases', 'Your cases. Anything that needs you is at the top. Handle the Routine Steps does the paperwork; the choices that matter are yours.'],
  ['In court', 'When a case reaches a hearing or trial, you choose your opening, your objections, your questions and your closing.'],
  ['Career Progress', 'Your five skills, named for your practice area, your reputation, and the bigger jobs: partner, District Attorney, judge.'],
  ['What it is not', 'Pathways cites real laws, but how a case turns out is a game. It is not legal advice.'],
];
export function openGuide() {
  const m = openModal(`<div class="eyebrow">How it works</div><h2>Your Legal Career</h2>
    ${GUIDE.map(([t, d], i) => `<div class="kv law-guide"><span><strong>${i + 1}. ${esc(t)}</strong></span></div><p class="muted">${esc(d)}</p>`).join('')}
    <div class="btn-row">${btn('Got It', 'data-guideok', 'primary')}</div>`, { dismissable: true });
  m.el.querySelector('[data-guideok]').addEventListener('click', () => m.close());
  return m;
}

export function openLawCareer(api, start = {}) {
  let tab = start.tab ?? 'overview';
  let caseId = start.caseId ?? null;
  const m = openModal('<div class="law-hub"></div>', { dismissable: true, full: true, title: 'My Legal Career' });
  const host = m.el.querySelector('.law-hub');
  const draw = () => {
    const ts = tabs();
    if (!ts.some(([id]) => id === tab)) tab = 'overview';
    const c = caseId ? lc.caseById(caseId) : null;
    host.innerHTML = c ? `<button type="button" class="btn small law-back" data-back>‹ All Cases</button>${casePage(c)}`
      : `<div class="eyebrow">Every case tells a story.</div> <button type="button" class="btn small" data-guide>How It Works</button>
        <div class="chips law-tabs page-tabs" role="tablist">${ts.map(([id, label]) => `<button type="button" role="tab" class="av-chip ${id === tab ? 'on' : ''}" aria-selected="${id === tab}" data-tab="${id}">${esc(label)}</button>`).join('')}</div>
        <div class="law-page">${{ overview, education, cases: myCases, new: newCases, progress, office, history }[tab]()}</div>`;
  };
  const changed = () => { api.changed?.(); draw(); };
  m.el.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t || t.disabled) return;
    let r;
    if (t.hasAttribute('data-guide')) { openGuide(); return undefined; }
    if (t.dataset.tab || t.dataset.go) { tab = t.dataset.tab ?? t.dataset.go; caseId = null; return draw(); } // a tab, or a shortcut to one
    if (t.hasAttribute('data-back')) { caseId = null; tab = 'cases'; return draw(); }
    if (t.dataset.case) { caseId = t.dataset.case; return draw(); }
    if (t.dataset.npcperson) { const n = store.state.npcs[t.dataset.npcperson]; if (n && api.openNpc) api.openNpc(n); return undefined; }
    if (t.dataset.accept) { r = lp.accept(t.dataset.accept); changed(); await say(r); if (r.caseId) { caseId = r.caseId; } return changed(); }
    if (t.dataset.refer) { await say(lp.decline(t.dataset.refer, true)); return changed(); }
    if (t.dataset.decline) { await say(lp.decline(t.dataset.decline)); return changed(); }
    if (t.dataset.seek) {
      const op = lp.opportunities().find((x) => x.id === t.dataset.seek);
      if (op?.campaign) {
        if (!(await confirmModal({ title: op.name, body: `Chosen by: ${op.how}. There is a filing fee, three stretches of campaigning with a debate, and then the count.`, yes: 'File to Run', no: 'Not Now' }))) return undefined;
        const r2 = camp.declare(op.id); changed();
        if (!r2.ok) return say(r2);
        await say(r2); openCampaign({ changed }); return undefined;
      }
      if (!(await confirmModal({ title: op.name, body: `${op.how ? `Chosen by: ${op.how}. ` : ''}It may not go your way, and you cannot try again for a while.`, yes: 'Go Ahead', no: 'Not Now' }))) return undefined;
      await say(lp.seek(t.dataset.seek)); return changed();
    }
    if (t.hasAttribute('data-campopen')) { openCampaign({ changed }); return undefined; }
    if (t.hasAttribute('data-probono')) {
      const opts = life.proBonoOptions();
      const a = await pickModal({ title: 'Pro Bono', body: 'People who cannot afford a lawyer. You will not be paid; it counts in other ways.', options: opts.map((o) => ({ value: o.id, label: o.summary })) });
      if (a) { const r2 = life.takeProBono(a); await say(r2); if (r2.caseId) { caseId = r2.caseId; } }
      return changed();
    }
    if (t.hasAttribute('data-retire')) {
      if (await confirmModal({ title: 'Retire?', body: 'Your open cases go to colleagues, and your career in law comes to its end. It cannot be undone.', yes: 'Retire', no: 'Not Yet' })) await say(life.retire('choice'));
      return changed();
    }
    if (t.hasAttribute('data-routineall')) { await say(lc.routineAll()); return changed(); }
    if (t.dataset.cact) { const c = lc.caseById(caseId); if (c) await caseAction(c, t.dataset.cact); return changed(); }
    if (t.dataset.duty) {
      const d = lp.leaderDuties().find((x) => x.id === t.dataset.duty);
      const a = await pickModal({ title: d.name, body: d.text ?? '', options: d.options.map(([l, v]) => ({ value: v, label: l })) });
      if (a != null) await say(lp.doDuty(d.id, a));
      return changed();
    }
    if (t.hasAttribute('data-bench')) {
      const c = lp.benchMatter();
      if (!c) { await messageModal({ body: 'Your civil list is done for this half-year.' }); return changed(); }
      if (c.benchCriminal) {
        // A criminal trial: the judge's rulings in order, then the verdict, then (if guilty) the sentence.
        const answers = {};
        for (const st of lp.trialSteps(c)) {
          const a = await pickModal({ title: st.title, body: st.text, options: st.options.map(([l, v]) => ({ value: v, label: l })) });
          if (a == null) return changed();
          answers[st.id] = a;
        }
        const s = await pickModal({ title: 'If the jury convicts: the sentence', body: `The law sets a range for ${(lc.template(c).offense ?? 'this offense').replace(/_/g, ' ')}. What will you impose if the verdict is guilty?`, options: lp.sentenceOptions(c).map(([l, v]) => ({ value: v, label: l })) });
        if (s == null) return changed();
        answers.sentence = s;
        await say(lp.presideTrial(c.id, answers));
        return changed();
      }
      const known = [c.clientId, c.parties.otherId].map((id) => store.state.npcs[id]).find((n) => n && (player().npcIds.includes(n.id) || n.flags.formerClientOf === player().id));
      const donor = c.donorConflict ? store.state.npcs[c.donorConflict.id] : null;
      const tie = donor ? `\n\n${donor.firstName} ${donor.lastName}'s firm gave ${fmtMoney(c.donorConflict.amount, country())} to your election campaign.` : known ? `\n\nYou know ${known.firstName} ${known.lastName}.` : '';
      const a = await pickModal({ title: c.title, body: `${c.summary}\n\nThe evidence: ${c.evidence.map((e) => e.label).join('; ')}.${tie}`,
        options: [...lp.rulingOptions(c).map(([l, v]) => ({ value: v, label: l })), ...(known || donor ? [{ value: 'recuse', label: 'Step aside' }] : [])] });
      if (a != null) await say(lp.rule(c.id, a));
      return changed();
    }
    if (t.dataset.firm === 'fees') {
      const a = await pickModal({ title: 'Your fees', body: 'What you charge decides who comes to you.', options: Object.entries(lp.FEE_STRATEGIES).map(([id, x]) => ({ value: id, label: x.name, sub: x.note })) });
      if (a) await say(lp.setFeeStrategy(a));
      return changed();
    }
    if (t.dataset.firm === 'ads') {
      const a = await pickModal({ title: 'Advertise', body: 'What will the ads say?', options: [{ value: 'honest', label: 'Plain words about what you do and what you charge' }, { value: 'promises', label: '"We win your case, guaranteed"' }] });
      if (a) await say(lp.advertise(a));
      return changed();
    }
    if (t.dataset.acad) { await say(t.dataset.acad === 'clerk' ? acad.applyClerkship() : acad.applyProfessor()); return changed(); }
    if (t.dataset.profduty) {
      const d = acad.professorDuties().find((x) => x.id === t.dataset.profduty);
      const a = await pickModal({ title: d.name, body: d.text, options: d.options.map(([l, v]) => ({ value: v, label: l })) });
      if (a) await say(acad.professorDuty(d.id, a));
      return changed();
    }
    if (t.dataset.firm === 'hire') { await say(lp.hireAssociate()); return changed(); }
    if (t.dataset.partner) { if (await confirmModal({ title: 'Make them a partner?', body: 'They will share in the firm\'s profits from now on.', yes: 'Make Partner', no: 'Not Yet' })) await say(lp.makePartner(t.dataset.partner)); return changed(); }
    if (t.dataset.firm === 'insure') { await say(lp.setMalpractice(!player().law?.malpractice)); return changed(); }
    if (t.dataset.load) { await say(t.dataset.load === 'support' ? lp.askSupport() : lp.takeLeave()); return changed(); }
    if (t.dataset.sact) { await schoolAct(t.dataset.sact); return changed(); }
    if (t.dataset.law) { await schoolAction(t.dataset.law); return changed(); }
    return undefined;
  });
  draw();
  // The first time: a short guide, once per player (it can be opened again from How It Works).
  const p = player();
  if (!p.flags.lawGuideSeen) { p.flags.lawGuideSeen = true; openGuide(); }
  return m;
}

/** A line for the Work tab: what the legal career is doing, or how to start one. */
export function lawRowSub() {
  const p = player();
  const t = lp.trackOf(p);
  const open = (p.law?.caseIds ?? []).map(lc.caseById).filter((c) => c && !c.done);
  if (t) return `${open.length} open case${open.length === 1 ? '' : 's'}${open.some((c) => c.awaiting) ? ' · one needs you' : ''}`;
  if (p.education.enrolled && p.education.stage === 'law') return 'Law school: classes, exams, clinics, internships';
  if (ls.hasLawDegree(p) && !ls.admitted(p)) return 'The bar exam';
  return 'Law school, the bar, and practice';
}
/** Whether the row belongs on the Work tab at all. */
export const showLawRow = (p = player()) => !!p.law || p.age >= 18 && (p.education.degrees.some((d) => d.type === 'university') || p.education.stage === 'university');

/** Family Archive → Professional legacy → Legal careers: each lawyer in the family, and what the family may see of it. */
export function openLegalLegacy() {
  const list = lp.familyLegalLegacy();
  const years = (x) => (x.born ? ` (${x.born}${x.died ? `–${typeof x.died === 'object' ? x.died.year ?? '' : x.died}` : x.you ? '' : '–'})` : '');
  return openModal(`<div class="eyebrow">Professional legacy</div><h2>Legal careers in the family</h2>
    ${list.length ? list.map((x) => card(`${x.name}${years(x)}${x.you ? ' · you' : ''}`, x.milestones.map((m) => kv(String(m.year), m.title)).join(''))).join('')
      : '<p class="empty">Nobody in the family has practiced law yet.</p>'}
    ${(() => { const h = lp.legalHeadlines().slice(0, 8); return h.length ? card('In the papers', h.map((x) => kv(String(x.year), `${x.outlet}: ${x.text}`)).join('')) : ''; })()}
    <p class="muted">Clients' confidential matters are not kept here: only the career, and cases that were public.</p>`, { dismissable: true });
}
