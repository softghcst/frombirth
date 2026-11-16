// Work & School tab: where you stand, what you have committed to, who can
// open doors for you, and every school, housing and part-time-job action.
// Full careers arrive in Phase 4.
import { politicsCard, politicsAction } from '../politics.js';
import { player, country, livingNpcs } from '../../state.js';
import { esc, fmtMoney } from '../../util.js';
import * as edu from '../../engine/education.js';
import * as job from '../../engine/partTime.js';
import { roleLabel } from '../../engine/relationships.js';
import { tripleThreat } from '../../engine/conditions.js';
import { PROGRAMMES, HOUSING, CLIQUE_BY_ID, CLUB_BY_ID, MAX_CLUBS, TRADES, PRIORITY_BY_ID } from '../../data/schools.js';
import { MAJORS, MAJOR_BY_ID } from '../../data/majors.js';
import { meterHtml } from '../meter.js';
import { messageModal, pickModal, confirmModal } from '../modals.js';
import { careerCard, careerButtons, careerHandlers } from './workCareer.js';

const FUNDING = { scholarship: 'Scholarship', parents: 'Paid by parents', loan: 'Student loan',
  self: 'Paying your own way', public: 'Publicly funded' };

const degreeLabel = (d) => (d.school ?? edu.stageLabel(d.type))
  + (edu.subjectName(d.type, d.majorId) ? ` (${edu.subjectName(d.type, d.majorId)})` : '');
const years = (n) => `${n} ${n === 1 ? 'year' : 'years'}`;
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

async function choosePriority(api) {
  const id = await pickModal({
    title: 'What comes first this year?',
    body: 'You cannot do everything. Whatever you put first grows; something else gives.',
    options: edu.priorityOptions().map((o) => ({
      value: o.id, label: o.name + (o.current ? ' (current)' : ''), disabled: !o.available,
      sub: o.available ? o.desc : 'You need a part-time job for this.',
    })),
  });
  if (id) await report(api, edu.setPriority(id));
}

async function chooseGapYear(api) {
  const c = country();
  const id = await pickModal({
    title: 'Take a year out',
    body: 'One year, once. You cannot apply anywhere until it is over.',
    options: edu.gapYearOptions().map((g) => ({
      value: g.id, label: g.name, disabled: !g.affordable,
      sub: `${g.desc} ${g.cost ? `Costs ${fmtMoney(g.cost, c)}.` : g.pays ? `Earns about ${fmtMoney(g.pays, c)}.` : 'Costs nothing, pays nothing.'}`,
    })),
  });
  if (id) await report(api, edu.takeGapYear(id));
}

async function chooseNewMajor(api) {
  const e = player().education;
  const id = await pickModal({
    title: 'Switch major',
    body: e.yearInStage >= 1
      ? 'You are past your first year, so switching adds a year, and a year of fees.'
      : 'You are in your first year, so switching costs nothing.',
    options: edu.switchOptions().map((m) => ({
      value: m.id, label: m.name, disabled: !m.allowed,
      sub: !m.allowed ? `Needs a GPA of ${m.minGpa.toFixed(1)}.`
        : m.audition ? `By audition: about ${Math.round(m.chance * 100)}% chance.` : 'Open to you.',
    })),
  });
  if (id) await report(api, edu.switchMajor(id));
}

/** Major picker shared by university and community college. */
function pickMajor(progId) {
  const p = player();
  const gpa = edu.entryGpa();
  const community = progId === 'community';
  return pickModal({
    title: community ? 'What will you study?' : 'Choose a major',
    body: community
      ? 'Community college takes everyone. Pick the subject you mean to carry on with.'
      : `Your GPA is ${gpa.toFixed(2)}. Harder subjects want better grades.`,
    options: MAJORS.filter((m) => !(community && m.audition)).map((m) => ({
      value: m.id, label: m.name, disabled: !community && gpa < m.minGpa,
      sub: m.audition
        ? `${m.blurb} Entry by audition (your triple-threat score is ${tripleThreat(p)}): about ${Math.round(edu.admissionChance('university', m.id) * 100)}% at a typical school.`
        : `${m.difficulty >= 0.45 ? 'Demanding' : m.difficulty >= 0.25 ? 'Moderate' : 'Gentle'} workload`
          + (community ? '' : ` · needs GPA ${m.minGpa.toFixed(1)}`)
          + (m.tracks.length ? ` · opens ${m.tracks.join(' and ')} school` : ''),
    })),
  });
}

/** Funding picker. Resolves a funding id, 'public' when nothing is owed, or null. */
async function chooseFunding(api, fee, length, offer) {
  const c = country();
  const p = player();
  if (!fee) return 'public';
  let askedParents = false;
  for (;;) {
    const funding = await pickModal({
      title: 'How will you pay?',
      body: `Tuition is ${fmtMoney(fee, c)} a year for ${years(length)}.`,
      cancel: 'Turn the place down',
      options: [
        ...(offer.scholarship ? [{ value: 'scholarship', label: 'Accept the scholarship',
          sub: `Free while your GPA stays above 2.5.${offer.housingAid ? ' Includes a dorm room.' : ''}` }] : []),
        { value: 'parents', label: 'Ask your parents', sub: askedParents ? 'They already said no.' : 'They might say no.', disabled: askedParents },
        { value: 'loan', label: 'Take a student loan', sub: '5% interest. Repayments start once you are earning.' },
        { value: 'self', label: 'Pay from savings', sub: `You have ${fmtMoney(p.finance.cash, c)}.`, disabled: p.finance.cash < fee },
      ],
    });
    if (funding !== 'parents') return funding;
    askedParents = true;
    const answer = edu.askParentsToPay();
    api.changed();
    await messageModal({ body: answer.text, tone: answer.tone });
    if (answer.ok) return 'parents';
  }
}

/** Compare the answers from each university and pick one. Resolves the offer or null. */
function chooseOffer(offers) {
  const c = country();
  return pickModal({
    title: 'Compare your offers',
    body: 'Each school answered separately. Look at the cost after aid and what each is known for.',
    cancel: 'Turn them all down',
    options: offers.map((o) => ({
      value: o, label: o.name + (o.accepted ? '' : ': rejected'), disabled: !o.accepted,
      sub: o.accepted
        ? `${o.knownFor} ${o.fit ? 'Known for your subject.' : ''} `
          + (o.scholarship ? `Offers ${o.scholarship}${o.housingAid ? ' with a dorm room' : ''}: tuition ${fmtMoney(0, c)} instead of ${fmtMoney(o.tuition, c)} a year.`
            : o.tuition ? `No aid: ${fmtMoney(o.tuition, c)} a year.` : 'No tuition.')
        : o.knownFor,
    })),
  });
}

/** What comes next: programme → subject → decision(s) → funding → housing → enrol. */
async function applyFlow(api) {
  const c = country();
  const progId = await pickModal({
    title: 'What comes next?',
    body: 'Compare what each route costs, what it pays, and how long it takes.',
    options: edu.programmeOptions().map((o) => ({
      value: o.id, label: o.label, disabled: !o.eligible,
      sub: o.eligible
        ? `${o.blurb} ${years(o.years)}, ${o.stipend ? `pays ${fmtMoney(o.stipend, c)} a year` : o.tuition ? `from ${fmtMoney(o.tuition, c)} a year` : 'no tuition'}.`
        : o.reason,
    })),
  });
  if (!progId) return;
  const prog = PROGRAMMES[progId];

  // Apprenticeship: pick a trade, get taken on, start. Paid, living at home.
  if (progId === 'apprenticeship') {
    const trade = await pickModal({ title: 'Which trade?', options: TRADES.map((t) => ({ value: t.id, label: t.name })) });
    if (!trade) return;
    const d = edu.applyTo(progId, trade);
    api.changed();
    await messageModal({ eyebrow: 'Apprenticeship', body: d.text, tone: d.accepted ? 'good' : 'bad' });
    if (d.accepted) { edu.enrol(progId, trade, 'public', {}); api.changed(); }
    return;
  }

  let subjectId;
  if (progId === 'university' || progId === 'community') {
    subjectId = await pickMajor(progId);
    if (!subjectId) return;
  }

  let offer;
  let school = null;
  let fee;
  let length = prog.years;
  if (progId === 'university') {
    const round = edu.universityOffers(subjectId);
    api.changed();
    await messageModal({ eyebrow: 'Admissions', body: round.text, tone: round.accepted ? 'good' : 'bad' });
    if (!round.accepted) return;
    offer = await chooseOffer(round.offers);
    if (!offer) return;
    school = { id: offer.id, name: offer.name };
    fee = offer.tuition;
    if (edu.isTransfer()) length = 2;
  } else {
    offer = edu.applyTo(progId, subjectId);
    api.changed();
    await messageModal({ eyebrow: 'Admissions', body: offer.text, tone: offer.accepted ? 'good' : 'bad' });
    if (!offer.accepted) return;
    fee = edu.tuitionFor(progId);
  }

  const funding = await chooseFunding(api, fee, length, offer);
  if (!funding) return;
  const housingAid = funding === 'scholarship' && offer.housingAid;
  const living = await chooseHousing(housingAid) ?? {};
  edu.enrol(progId, subjectId, funding, { ...living, housingAid }, school);
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
  if (edu.canSetPriority()) rows.push(['Putting first', PRIORITY_BY_ID[e.priority]?.name ?? 'Nothing in particular']);
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
    if (edu.canSetPriority()) school.push(['priority', 'Choose what comes first this year']);
    if (edu.canAskForTutor()) school.push(['tutor', 'Ask your parents for a tutor']);
    if (edu.canJoinClubs()) school.push(['club', 'Clubs and classes']);
    if (e.enrolled && e.stage === 'high') school.push(['clique', 'Choose your crowd']);
    if (e.enrolled && edu.isHigher(e.stage)) school.push(['housing', 'Change where you live']);
    if (edu.canSwitchMajor()) school.push(['switch', 'Switch major']);
    const leftSchool = !e.enrolled && (e.degrees.some((d) => d.type === 'high') || p.age >= 16);
    if (leftSchool) school.push(['apply', 'Plan what comes next']);
    if (edu.canTakeGapYear()) school.push(['gap', 'Take a gap year']);
    if (edu.canDropOut()) school.push(['drop', 'Drop out']);

    const work = careerButtons();

    const btns = (list) => (list.length ? `<div class="btn-stack" style="margin-bottom:14px">
      ${list.map(([id, label]) => `<button class="btn ${['drop', 'quit', 'quitcareer'].includes(id) ? 'danger' : ['apply', 'findwork'].includes(id) && !k.careerId ? 'primary' : ''}" data-act="${id}">${esc(label)}</button>`).join('')}
    </div>` : '');

    const past = k.history.length
      ? k.history.map((h) => `<div class="kv"><span>${esc(h.title)}</span><span>Age ${h.from}–${h.to}</span></div>`).join('')
      : '<p class="muted">No past jobs.</p>';

    el.innerHTML = `
      <div class="card"><h3>Education</h3>${educationCard(p, c)}</div>
      ${btns(school)}
      <div class="card"><h3>Commitments</h3>${commitments(p, c)}</div>
      ${contacts()}
      ${careerCard()}
      ${btns(work)}
      ${politicsCard()}
      <div class="card"><h3>Work history</h3>${past}</div>`;

    el.onclick = (ev) => {
      const pol = ev.target.closest('[data-pol]')?.dataset.pol;
      if (pol) return politicsAction(pol, api);
      const id = ev.target.closest('[data-act]')?.dataset.act;
      if (!id) return;
      ({ ...careerHandlers(api), study: () => report(api, edu.studyHard()), slack: () => report(api, edu.slackOff()),
        skip: () => report(api, edu.skipSchool()), tutor: () => report(api, edu.askForTutor()),
        club: () => chooseClub(api), clique: () => chooseClique(api), housing: () => changeHousing(api),
        drop: () => leaveSchool(api), apply: () => applyFlow(api), priority: () => choosePriority(api),
        gap: () => chooseGapYear(api), switch: () => chooseNewMajor(api),
        findjob: () => findJob(api), cover: () => report(api, job.coverShift()), quit: () => quitJob(api) })[id]();
    };
  },
};
