// Work & School tab: where you stand, what you have committed to, who can
// open doors for you, and every school, housing and part-time-job action.
// Full careers arrive in Phase 4.
import { player, country, livingNpcs } from '../../state.js';
import { esc, fmtMoney } from '../../util.js';
import * as edu from '../../engine/education.js';
import * as job from '../../engine/partTime.js';
import { roleLabel } from '../../engine/relationships.js';
import { tripleThreat } from '../../engine/conditions.js';
import { PROGRAMMES, HOUSING, CLIQUE_BY_ID, CLUB_BY_ID, MAX_CLUBS } from '../../data/schools.js';
import { MAJORS, MAJOR_BY_ID } from '../../data/majors.js';
import { meterHtml } from '../meter.js';
import { messageModal, pickModal, confirmModal } from '../modals.js';

const FUNDING = { scholarship: 'Scholarship', parents: 'Paid by parents', loan: 'Student loan',
  self: 'Paying your own way', public: 'Publicly funded' };

const degreeLabel = (d) => edu.stageLabel(d.type)
  + (d.majorId && MAJOR_BY_ID[d.majorId] ? ` (${MAJOR_BY_ID[d.majorId].name})` : '');
const kv = (rows) => rows.map(([a, b]) =>
  `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');

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
    title: 'Clubs and classes',
    body: `You have time for ${MAX_CLUBS} at once. Each one builds a skill every year you stay.`,
    options: edu.clubOptions().map((c) => ({
      value: c.id, label: c.joined ? `Leave: ${c.name}` : `Join: ${c.name}`,
      sub: [c.blurb, c.joined ? 'You are a member.' : c.chance >= 1 ? 'Open to everyone.'
        : `Try-out: roughly ${Math.round(c.chance * 100)}% chance.`].filter(Boolean).join(' '),
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
      ? 'You will leave without the qualification. Any student loan you have taken still has to be repaid.'
      : 'You will leave without a diploma and cannot go back. Your parents will not be pleased.',
    yes: 'Drop out', danger: true,
  });
  if (sure) await report(api, edu.dropOut());
}

/** Housing picker. Resolves {housing, roommateId} or null. */
async function chooseHousing(housingAid) {
  const c = country();
  const housing = await pickModal({
    title: 'Where will you live?',
    body: 'Rent is charged every year you study. If you cannot cover it, it goes on a student loan.',
    options: edu.housingOptions(housingAid).map((h) => ({
      value: h.id, label: h.label, disabled: !h.available,
      sub: h.available ? `${h.blurb} ${h.cost ? `${fmtMoney(h.cost, c)} a year.` : 'No rent.'} ${h.note}` : h.reason,
    })),
  });
  if (!housing) return null;
  if (housing !== 'apartment') return { housing };
  const friends = edu.roommateCandidates();
  if (!friends.length) return { housing };
  const roommateId = await pickModal({
    title: 'Who will you live with?',
    body: 'Sharing with a friend can bring you closer, or test the friendship.',
    cancel: 'Back',
    options: [
      ...friends.map((f) => ({ value: f.id, label: `${f.firstName} ${f.lastName}`, sub: `Friend · relationship ${Math.round(f.meters.relationship)}%` })),
      { value: 'stranger', label: 'Find a roommate online', sub: 'Someone new.' },
    ],
  });
  if (!roommateId) return null;
  return { housing, roommateId: roommateId === 'stranger' ? undefined : roommateId };
}

async function changeHousing(api) {
  const living = await chooseHousing();
  if (living) await report(api, edu.moveHousing(living.housing, living.roommateId));
}

/** Application flow: programme → major → decision → funding → housing → enrol. */
async function applyFlow(api) {
  const c = country();
  const p = player();
  const progId = await pickModal({
    title: 'After high school',
    body: 'Compare what each route costs and how long it takes.',
    options: edu.programmeOptions().map((o) => ({
      value: o.id, label: o.label, disabled: !o.eligible,
      sub: o.eligible ? `${o.blurb} ${o.years} ${o.years === 1 ? 'year' : 'years'}, ${o.tuition ? `${fmtMoney(o.tuition, c)} a year` : 'no tuition'}.` : o.reason,
    })),
  });
  if (!progId) return;

  let majorId;
  if (progId === 'university') {
    const gpa = p.education.degrees.find((d) => d.type === 'high').gpa;
    majorId = await pickModal({
      title: 'Choose a major',
      body: `Your high-school GPA is ${gpa.toFixed(2)}. Harder subjects want better grades.`,
      options: MAJORS.map((m) => ({
        value: m.id, label: m.name, disabled: gpa < m.minGpa,
        sub: m.audition
          ? `Entry by audition: singing, dance and acting (your triple-threat score is ${tripleThreat(p)}). About ${Math.round(edu.admissionChance('university', m.id) * 100)}% chance.`
          : `${m.difficulty >= 0.45 ? 'Demanding' : m.difficulty >= 0.25 ? 'Moderate' : 'Gentle'} workload · needs GPA ${m.minGpa.toFixed(1)}`
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
    funding = await pickModal({
      title: 'How will you pay?',
      body: `Tuition is ${fmtMoney(fee, c)} a year for ${PROGRAMMES[progId].years} ${PROGRAMMES[progId].years === 1 ? 'year' : 'years'}.`,
      cancel: 'Turn the place down',
      options: [
        ...(decision.scholarship ? [{ value: 'scholarship', label: 'Accept the scholarship',
          sub: `Free while your GPA stays above 2.5.${decision.housingAid ? ' Includes a dorm room.' : ''}` }] : []),
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

  const housingAid = funding === 'scholarship' && decision.housingAid;
  const living = await chooseHousing(housingAid) ?? {};
  edu.enrol(progId, majorId, funding, { ...living, housingAid });
  api.changed();
}

async function findJob(api) {
  const c = country();
  const id = await pickModal({
    title: 'Part-time work',
    body: 'A few shifts a week. Your manager will remember how you behave.',
    options: job.jobOptions().map((j) => ({
      value: j.id, label: j.title, disabled: !j.available,
      sub: j.available ? `At ${j.place}. ${fmtMoney(j.pay, c)} a year.` : j.reason,
    })),
  });
  if (id) await report(api, job.takeJob(id));
}

async function quitJob(api) {
  const sure = await confirmModal({ title: 'Quit your job?', body: 'You will lose the income.', yes: 'Quit', danger: true });
  if (sure) await report(api, job.quitJob());
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
    ...(e.enrolled && edu.isHigher(e.stage) ? [['Tuition', FUNDING[e.funding] ?? '—']] : []),
    ...(loan ? [['Student loan', fmtMoney(loan.principal, c)]] : []),
    ...e.degrees.map((d) => ['Completed', `${degreeLabel(d)}, GPA ${d.gpa.toFixed(2)}`]),
  ];
  return kv(rows) + (e.enrolled ? `<div style="margin-top:10px">${meterHtml('Effort', e.effort, true)}</div>` : '');
}

/** Everything currently taking up the player's time. */
function commitments(p, c) {
  const e = p.education;
  const rows = [];
  for (const id of e.clubs) rows.push([CLUB_BY_ID[id].name, 'Member']);
  if (e.enrolled && e.stage === 'high') rows.push(['Crowd', CLIQUE_BY_ID[e.clique]?.name ?? 'None yet']);
  if (p.career.partTime) rows.push([p.career.partTime.title, `${fmtMoney(p.career.partTime.salary, c)} a year`]);
  if (p.flags.tutorAge === p.age) rows.push(['Private tutor', 'Two evenings a week']);
  if (e.enrolled && edu.isHigher(e.stage)) {
    const mate = edu.roommate();
    const rent = edu.housingCost();
    rows.push(['Housing', `${HOUSING[e.housing].label}${mate ? ` with ${mate.firstName}` : ''}${rent ? `, ${fmtMoney(rent, c)} a year` : ''}`]);
  }
  return rows.length ? kv(rows) : '<p class="muted">Nothing on your plate beyond the basics.</p>';
}

/** People with a title: mentors, managers and others who can open doors. */
function contacts() {
  const list = livingNpcs().filter((n) => n.flags.title);
  if (!list.length) return '';
  return `<div class="card"><h3>Contacts</h3>${list.map((n) => {
    const last = n.memories?.[n.memories.length - 1];
    return `<div class="contact"><strong>${esc(n.firstName)} ${esc(n.lastName)}</strong>
      <small>${esc(roleLabel(n))} · relationship ${Math.round(n.meters.relationship)}%</small>
      <p>${last ? `Remembers: ${esc(last.text)}` : 'Barely knows you yet.'}</p></div>`;
  }).join('')}</div>`;
}

export default {
  id: 'work', title: 'Work & School', short: 'Work',
  icon: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  render(el, api) {
    const p = player();
    const c = country();
    const e = p.education;
    const k = p.career;

    const school = [];
    if (e.enrolled && p.age >= 6) {
      school.push(['study', 'Study harder'], ['slack', 'Slack off']);
      if (p.age >= 10) school.push(['skip', edu.isHigher(e.stage) ? 'Skip lectures' : 'Skip school']);
    }
    if (edu.canAskForTutor()) school.push(['tutor', 'Ask your parents for a tutor']);
    if (edu.canJoinClubs()) school.push(['club', 'Clubs and classes']);
    if (e.enrolled && e.stage === 'high') school.push(['clique', 'Choose your crowd']);
    if (e.enrolled && edu.isHigher(e.stage)) school.push(['housing', 'Change where you live']);
    if (!e.enrolled && e.degrees.some((d) => d.type === 'high')) school.push(['apply', 'Apply for university or trade school']);
    if (edu.canDropOut()) school.push(['drop', 'Drop out']);

    const work = [];
    if (job.canWorkPartTime()) work.push(['findjob', 'Look for part-time work']);
    if (k.partTime) work.push(['cover', 'Cover an extra shift'], ['quit', 'Quit your job']);

    const btns = (list) => (list.length ? `<div class="btn-stack" style="margin-bottom:14px">
      ${list.map(([id, label]) => `<button class="btn ${id === 'drop' || id === 'quit' ? 'danger' : id === 'apply' ? 'primary' : ''}" data-act="${id}">${esc(label)}</button>`).join('')}
    </div>` : '');

    const jobRows = k.title
      ? kv([['Role', k.title], ['Salary', `${fmtMoney(k.salary, c)} / year`],
        ['Performance', `${Math.round(k.performance)}%`], ['Years in role', String(k.yearsInRole)]])
      : k.partTime
        ? kv([['Part-time', k.partTime.title], ['Pay', `${fmtMoney(k.partTime.salary, c)} / year`], ['Since', `Age ${k.partTime.since}`]])
        : `<p class="muted">${p.age < 15 ? 'You are too young to work.' : k.retired ? 'You are retired.' : 'You do not have a job.'}</p>`;
    const past = k.history.length
      ? k.history.map((h) => `<div class="kv"><span>${esc(h.title)}</span><span>Age ${h.from}–${h.to}</span></div>`).join('')
      : '<p class="muted">No past jobs.</p>';

    el.innerHTML = `
      <div class="card"><h3>Education</h3>${educationCard(p, c)}</div>
      ${btns(school)}
      <div class="card"><h3>Commitments</h3>${commitments(p, c)}</div>
      ${contacts()}
      <div class="card"><h3>Work</h3>${jobRows}</div>
      ${btns(work)}
      <div class="card"><h3>Work history</h3>${past}</div>`;

    el.onclick = (ev) => {
      const id = ev.target.closest('[data-act]')?.dataset.act;
      if (!id) return;
      ({ study: () => report(api, edu.studyHard()), slack: () => report(api, edu.slackOff()),
        skip: () => report(api, edu.skipSchool()), tutor: () => report(api, edu.askForTutor()),
        club: () => chooseClub(api), clique: () => chooseClique(api), housing: () => changeHousing(api),
        drop: () => leaveSchool(api), apply: () => applyFlow(api),
        findjob: () => findJob(api), cover: () => report(api, job.coverShift()), quit: () => quitJob(api) })[id]();
    };
  },
};
