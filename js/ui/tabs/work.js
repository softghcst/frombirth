// Work & School tab: school standing and actions, higher-education
// applications, and career standing (career actions arrive in Phase 4).
import { player, country } from '../../state.js';
import { esc, fmtMoney } from '../../util.js';
import * as edu from '../../engine/education.js';
import { PROGRAMMES, CLIQUE_BY_ID, CLUB_BY_ID, MAX_CLUBS } from '../../data/schools.js';
import { MAJORS, MAJOR_BY_ID } from '../../data/majors.js';
import { meterHtml } from '../meter.js';
import { messageModal, pickModal, confirmModal } from '../modals.js';

const FUNDING = { scholarship: 'Scholarship', parents: 'Paid by parents', loan: 'Student loan',
  self: 'Paying your own way', public: 'Publicly funded' };

const degreeLabel = (d) => edu.stageLabel(d.type)
  + (d.majorId && MAJOR_BY_ID[d.majorId] ? ` (${MAJOR_BY_ID[d.majorId].name})` : '');

/** Shows the outcome of an action and refreshes the tab. */
async function report(api, r) {
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

async function chooseClique(api) {
  const id = await pickModal({
    title: 'Who do you sit with?',
    body: 'Your crowd shapes you a little every year. You can change once a year.',
    options: edu.cliqueOptions().map((c) => ({
      value: c.id, label: c.name + (c.current ? ' (current)' : ''),
      sub: c.desc + (c.allowed ? '' : ' They may not have you.'), disabled: c.current,
    })),
  });
  if (id) await report(api, edu.joinClique(id));
}

async function chooseClub(api) {
  const e = player().education;
  const id = await pickModal({
    title: 'Clubs and teams',
    body: `You can belong to ${MAX_CLUBS} at a time. Members improve every year.`,
    options: edu.clubOptions().map((c) => ({
      value: c.id, label: c.joined ? `Leave the ${c.name.toLowerCase()}` : `Join: ${c.name}`,
      sub: c.joined ? 'You are a member.' : c.chance >= 1 ? 'Open to everyone.'
        : `Try-out: roughly ${Math.round(c.chance * 100)}% chance`,
      disabled: !c.joined && e.clubs.length >= MAX_CLUBS,
    })),
  });
  if (!id) return;
  await report(api, e.clubs.includes(id) ? edu.quitClub(id) : edu.joinClub(id));
}

async function leaveSchool(api) {
  const where = edu.stageLabel(player().education.stage).toLowerCase();
  const sure = await confirmModal({
    title: `Drop out of ${where}?`,
    body: edu.isHigher(player().education.stage)
      ? 'You will leave without the degree. Any student loan you have taken still has to be repaid.'
      : 'You will leave without a diploma and cannot go back. Your parents will not be pleased.',
    yes: 'Drop out', danger: true,
  });
  if (sure) await report(api, edu.dropOut());
}

/** Application flow: programme → major → decision → funding → enrol. */
async function applyFlow(api) {
  const c = country();
  const progId = await pickModal({
    title: 'Higher education',
    options: edu.programmeOptions().map((o) => ({
      value: o.id, label: o.label, disabled: !o.eligible,
      sub: o.eligible ? `${o.blurb} ${o.years} years, ${o.tuition ? `${fmtMoney(o.tuition, c)} a year` : 'no tuition'}.` : o.reason,
    })),
  });
  if (!progId) return;

  let majorId;
  if (progId === 'university') {
    const gpa = player().education.degrees.find((d) => d.type === 'high').gpa;
    majorId = await pickModal({
      title: 'Choose a major',
      body: `Your high-school GPA is ${gpa.toFixed(2)}. Harder subjects want better grades.`,
      options: MAJORS.map((m) => ({
        value: m.id, label: m.name, disabled: gpa < m.minGpa,
        sub: `${m.difficulty >= 0.45 ? 'Demanding' : m.difficulty >= 0.25 ? 'Moderate' : 'Gentle'} workload · needs GPA ${m.minGpa.toFixed(1)}`
          + (m.tracks.length ? ` · opens ${m.tracks.join(' and ')} school` : ''),
      })),
    });
    if (!majorId) return;
  }

  const decision = edu.applyTo(progId, majorId);
  api.changed();
  await messageModal({ eyebrow: 'Admissions', body: decision.text, tone: decision.accepted ? 'good' : 'bad' });
  if (!decision.accepted) return;

  const fee = edu.tuitionFor(progId);
  let funding = 'public';
  let askedParents = false;
  while (fee > 0) {
    const p = player();
    funding = await pickModal({
      title: 'How will you pay?',
      body: `Tuition is ${fmtMoney(fee, c)} a year for ${PROGRAMMES[progId].years} years.`,
      cancel: 'Turn the place down',
      options: [
        ...(decision.scholarship ? [{ value: 'scholarship', label: 'Accept the scholarship', sub: 'Free while your GPA stays above 2.5.' }] : []),
        { value: 'parents', label: 'Ask your parents', sub: askedParents ? 'They already said no.' : 'They might say no.', disabled: askedParents },
        { value: 'loan', label: 'Take a student loan', sub: '5% interest. Repayments start once you are earning.' },
        { value: 'self', label: 'Pay from savings', sub: `You have ${fmtMoney(p.finance.cash, c)}.`, disabled: p.finance.cash < fee },
      ],
    });
    if (!funding) return;
    if (funding !== 'parents') break;
    askedParents = true;
    const answer = edu.askParentsToPay();
    api.changed();
    await messageModal({ body: answer.text, tone: answer.tone });
    if (answer.ok) break;
  }
  edu.enrol(progId, majorId, funding);
  api.changed();
}

function educationCard(p, c) {
  const e = p.education;
  if (e.stage === 'none') return '<p class="muted">You have not started school yet.</p>';
  const status = e.enrolled
    ? `Enrolled, year ${e.yearInStage + 1}${edu.isHigher(e.stage) ? ` of ${PROGRAMMES[e.stage].years}` : ''}`
    : e.expelled ? 'Expelled' : e.droppedOut ? 'Dropped out' : 'Not enrolled';
  const loan = edu.studentLoan();
  const rows = [
    ['Stage', edu.educationLine(p)],
    ['Status', status],
    ...(e.enrolled ? [['GPA', e.gpa ? e.gpa.toFixed(2) : 'No grades yet'], ['Absences this year', String(e.absences)]] : []),
    ...(e.enrolled && e.stage === 'high' ? [['Crowd', CLIQUE_BY_ID[e.clique]?.name ?? 'None yet']] : []),
    ...(e.enrolled && e.stage !== 'elementary' ? [['Clubs', e.clubs.map((id) => CLUB_BY_ID[id].name).join(', ') || 'None']] : []),
    ...(e.enrolled && edu.isHigher(e.stage) ? [['Tuition', FUNDING[e.funding] ?? '—']] : []),
    ...(loan ? [['Student loan', fmtMoney(loan.principal, c)]] : []),
    ...e.degrees.map((d) => ['Completed', `${degreeLabel(d)}, GPA ${d.gpa.toFixed(2)}`]),
  ];
  return rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('')
    + (e.enrolled ? `<div style="margin-top:10px">${meterHtml('Effort', e.effort, true)}</div>` : '');
}

export default {
  id: 'work', title: 'Work & School', short: 'Work',
  icon: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  render(el, api) {
    const p = player();
    const c = country();
    const e = p.education;
    const k = p.career;

    const actions = [];
    if (e.enrolled && p.age >= 6) {
      actions.push(['study', 'Study harder'], ['slack', 'Slack off']);
      if (p.age >= 10) actions.push(['skip', edu.isHigher(e.stage) ? 'Skip lectures' : 'Skip school']);
      if (e.stage !== 'elementary') actions.push(['club', 'Clubs and teams']);
      if (e.stage === 'high') actions.push(['clique', 'Choose your crowd']);
      if (edu.canDropOut()) actions.push(['drop', 'Drop out']);
    }
    const canApply = !e.enrolled && e.degrees.some((d) => d.type === 'high');
    if (canApply) actions.push(['apply', 'Apply for higher education']);

    const job = k.title
      ? `
        <div class="kv"><span>Role</span><span>${esc(k.title)}</span></div>
        <div class="kv"><span>Salary</span><span>${fmtMoney(k.salary, c)} / year</span></div>
        <div class="kv"><span>Performance</span><span>${Math.round(k.performance)}%</span></div>
        <div class="kv"><span>Years in role</span><span>${k.yearsInRole}</span></div>`
      : `<p class="muted">${p.age < 15 ? 'You are too young to work.' : k.retired ? 'You are retired.' : 'You do not have a job.'}</p>`;
    const past = k.history.length
      ? k.history.map((h) => `<div class="kv"><span>${esc(h.title)}</span><span>Age ${h.from}–${h.to}</span></div>`).join('')
      : '<p class="muted">No past jobs.</p>';

    el.innerHTML = `
      <div class="card"><h3>Education</h3>${educationCard(p, c)}</div>
      ${actions.length ? `<div class="btn-stack" style="margin-bottom:14px">
        ${actions.map(([id, label]) => `<button class="btn ${id === 'drop' ? 'danger' : id === 'apply' ? 'primary' : ''}" data-edu="${id}">${esc(label)}</button>`).join('')}
      </div>` : ''}
      <div class="card"><h3>Career</h3>${job}</div>
      <div class="card"><h3>Work history</h3>${past}</div>`;

    el.onclick = (ev) => {
      const id = ev.target.closest('[data-edu]')?.dataset.edu;
      if (!id) return;
      const run = { study: () => report(api, edu.studyHard()), slack: () => report(api, edu.slackOff()),
        skip: () => report(api, edu.skipSchool()), club: () => chooseClub(api),
        clique: () => chooseClique(api), drop: () => leaveSchool(api), apply: () => applyFlow(api) }[id];
      run();
    };
  },
};
