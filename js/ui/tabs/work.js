// Work & School tab: where you stand, what you have committed to, who can
// open doors for you, and every school, housing and part-time-job action.
// Full careers arrive in Phase 4.
import { majorOpen } from '../../engine/history.js';
import * as adult from '../../engine/adulted.js';
import { CERTS } from '../../data/schools.js';
import * as campusLife from '../../engine/campus.js';
import { openCampus } from '../campus.js';
import * as uni from '../../engine/university.js';
import { openUniversity } from '../university.js';
import * as sch from '../../engine/schooling.js';
import { openSchool } from '../school.js';
import { openFamilyEducation } from '../familyEducation.js';
import { familyRecord } from '../../engine/edlegacy.js';
import { politicsCard, politicsAction } from '../politics.js';
import { openAthletics } from '../sports.js';
import * as special from '../../engine/specialCareer.js';
import * as fameEng from '../../engine/fame.js';
import { store, player, country, livingNpcs } from '../../state.js';
import { esc, fmtMoney } from '../../util.js';
import { fitBars } from '../fitBars.js';
import * as edu from '../../engine/education.js';
import * as job from '../../engine/partTime.js';
import { roleLabel } from '../../engine/relationships.js';
import { PROGRAMS, HOUSING, CLIQUE_BY_ID, CLUB_BY_ID, MAX_CLUBS, TRADES, PRIORITY_BY_ID } from '../../data/schools.js';
import { MAJORS, MAJOR_BY_ID } from '../../data/majors.js';
import { meterHtml } from '../meter.js';
import { messageModal, pickModal, confirmModal } from '../modals.js';
import { careerCard, careerButtons, careerHandlers } from './workCareer.js';
import { navRow, icon, lockedRow, fromAge } from '../kit.js';
import { workLaw } from '../../engine/worklife.js';
import * as military from '../../engine/military.js';
import { openMilitary } from '../military.js';
import * as career from '../../engine/career.js';
import { FAME_MIN_AGE } from '../../data/careers.js';

const FUNDING = { employer: 'Paid by your employer', scholarship: 'Scholarship', parents: 'Paid by parents', loan: 'Student loan',
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
      sub: [c.blurb, c.joined ? 'You are a member.' : c.chance >= 1 ? 'Open to everyone.' : 'By try-out.'].filter(Boolean).join(' '),
      html: !c.joined && c.bars ? fitBars({ ...c.bars, youLabel: 'Your Level', needLabel: 'Club Wants' }) : '',
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
        : m.audition ? 'By audition.' : 'Open to you.',
      html: m.allowed && m.bars ? fitBars({ ...m.bars, youLabel: 'Your Level', needLabel: 'Panel Wants' }) : '',
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
      : `Your school marks: ${sch.mark(gpa)}. Harder subjects want better grades.`,
    options: MAJORS.filter((m) => !(community && m.audition) && majorOpen(m.id)).map((m) => ({
      value: m.id, label: m.name, disabled: !community && gpa < m.minGpa,
      sub: m.audition
        ? `${m.blurb} Entry by audition.`
        : `${m.difficulty >= 0.45 ? 'Demanding' : m.difficulty >= 0.25 ? 'Moderate' : 'Gentle'} workload`
          + (community ? '' : ` · needs ${sch.mark(m.minGpa)} at school`)
          + (m.tracks.length ? ` · opens ${m.tracks.join(' and ')} school` : ''),
      html: m.audition && !community && gpa >= m.minGpa ? fitBars({ ...edu.auditionBars(m.id), youLabel: 'Your Level', needLabel: 'Panel Wants' }) : '',
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
          sub: `Free while your marks stay at ${sch.degreeMark(2.5)} or better.${offer.housingAid ? ' Includes a dorm room.' : ''}` }] : []),
        ...(edu.canAskParents() ? [{ value: 'parents', label: 'Ask your parents', sub: askedParents ? 'They already said no.' : 'They might say no.', disabled: askedParents }] : []),
        ...(p.career.careerId ? [{ value: 'employer', label: 'Ask your employer to pay', sub: p.flags.askedEmployerAge === p.age ? 'You have asked this year.' : 'They do it for people they want to keep.', disabled: p.flags.askedEmployerAge === p.age }] : []),
        { value: 'loan', label: 'Take a student loan', sub: '5% interest. Repayments start once you are earning.' },
        { value: 'self', label: 'Pay from savings', sub: `You have ${fmtMoney(p.finance.cash, c)}.`, disabled: p.finance.cash < fee },
      ],
    });
    if (funding === 'employer') { const yes = adult.askEmployer(); api.changed(); await messageModal({ body: yes.text, tone: yes.tone }); if (yes.ok) return 'employer'; continue; }
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

/** What comes next: program → subject → decision(s) → funding → housing → enroll. */
async function applyFlow(api) {
  const c = country();
  const progId = await pickModal({
    title: 'What comes next?',
    body: 'Compare what each route costs, what it pays, and how long it takes.',
    options: edu.programOptions().map((o) => ({
      value: o.id, label: o.label, disabled: !o.eligible,
      sub: o.eligible
        ? `${o.blurb} ${years(o.years)}, ${o.stipend ? `pays ${fmtMoney(o.stipend, c)} a year` : o.tuition ? `from ${fmtMoney(o.tuition, c)} a year` : 'no tuition'}.`
        : o.reason,
    })),
  });
  if (!progId) return;
  const prog = PROGRAMS[progId];

  // Apprenticeship: pick a trade, get taken on, start. Paid, living at home.
  if (progId === 'apprenticeship') {
    const trade = await pickModal({ title: 'Which trade?', options: TRADES.map((t) => ({ value: t.id, label: t.name })) });
    if (!trade) return;
    const d = edu.applyTo(progId, trade);
    api.changed();
    await messageModal({ eyebrow: 'Apprenticeship', body: d.text, tone: d.accepted ? 'good' : 'bad' });
    if (d.accepted) { edu.enroll(progId, trade, 'public', {}); api.changed(); }
    return;
  }

  if (progId === 'university') return openUniversity(api, { funding: chooseFunding, housing: chooseHousing });

  let subjectId;
  if (progId === 'university' || progId === 'community') {
    subjectId = await pickMajor(progId);
    if (!subjectId) return;
  }
  if (prog.subjects === 'trades') {
    subjectId = await pickModal({ title: 'Which trade?', options: TRADES.map((t) => ({ value: t.id, label: t.name })) });
    if (!subjectId) return;
  }
  if (prog.subjects === 'certs') {
    subjectId = await pickModal({ title: 'A certificate in what?', body: 'Each is a way into a line of work that otherwise asks for a degree. It is harder to be hired that way, but not closed.', options: CERTS.map((t) => ({ value: t.id, label: t.name })) });
    if (!subjectId) return;
  }
  // Alongside a job, or instead of one.
  let partTime = !!prog.adult || prog.id === 'certificate';
  if (!partTime && adult.canPartTime(progId) && (player().career.careerId || player().age >= 25)) {
    const pace = await pickModal({ title: 'Full-time or part-time?', body: 'Part-time takes longer and keeps your job. The fees are the same in the end.',
      options: [{ value: 'part', label: 'Part-time, alongside work', sub: `${years(adult.yearsFor(progId, true))}. Evenings and weekends.` }, { value: 'full', label: 'Full-time', sub: `${years(prog.years)}. You leave your job.` }] });
    if (!pace) return;
    partTime = pace === 'part';
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

  if (partTime) length = adult.yearsFor(progId, true);
  const funding = await chooseFunding(api, partTime && prog.partYears ? Math.round(fee * prog.years / prog.partYears) : fee, length, offer);
  if (!funding) return;
  const housingAid = funding === 'scholarship' && offer.housingAid;
  const living = partTime ? { partTime: true } : await chooseHousing(housingAid) ?? {};
  edu.enroll(progId, subjectId, funding, { ...living, housingAid }, school);
  api.changed();
}

/** A licensing exam: how to prepare, then the result. */
async function sitExam(api) {
  const c = country();
  const o = adult.examOptions()[0];
  if (!o) return undefined;
  if (o.sat) return messageModal({ body: 'You have sat an exam this year. The next sitting is next year.' });
  const prep = await pickModal({ title: `The ${o.name}`, body: `Your degree lets you sit it; passing it lets you practice ${o.profession}. The fee is ${fmtMoney(o.fee, c)}. You can sit it once a year.`,
    options: adult.prepOptions().map((x) => ({ value: x.id, label: x.name, sub: `${x.sub}${x.local ? ` ${fmtMoney(x.local, c)} more.` : ''}` })) });
  if (!prep) return undefined;
  return report(api, adult.sitExam(o.id, prep));
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
  if (e.stage === 'none') return '<p class="muted">Not started yet.</p>';
  const status = e.enrolled
    ? `Enrolled, year ${e.yearInStage + 1}${edu.isHigher(e.stage) ? ` of ${PROGRAMS[e.stage].years}` : ''}`
    : e.expelled ? 'Expelled' : e.droppedOut ? 'Dropped out' : 'Not enrolled';
  const loan = edu.studentLoan();
  const rows = [
    ['Stage', edu.educationLine(p)],
    ['Status', status],
    ...(e.enrolled && sch.atSchool(p) ? [['Overall mark', e.gpa ? sch.mark(e.gpa) : 'No marks yet'], ['Days skipped', String(e.absences)]]
      : e.enrolled ? [['Marks', e.gpa ? sch.degreeMark(e.gpa) : 'No grades yet'], ['Absences', String(e.absences)]] : []),
    ...(e.enrolled && edu.isHigher(e.stage) ? [['Tuition', `${FUNDING[e.funding] ?? '—'}${e.aid > 0 && e.aid < 1 ? ` · ${Math.round(e.aid * 100)}% waived` : ''}`]] : []),
    ...(e.enrolled && e.partTime ? [['Pace', 'Part-time, alongside work']] : []),
    ...(e.thesis ? [['Thesis', `${e.thesis.progress}% written${e.thesis.published ? ` · ${e.thesis.published} published` : ''}`]] : []),
    ...((p.flags.licenses ?? []).length ? [['Licensed in', p.flags.licenses.join(', ')]] : []),
    ...(loan ? [['Student loan', fmtMoney(loan.principal, c)]] : []),
    ...e.degrees.map((d) => ['Completed', d.type === 'high' ? `${d.school ?? 'School'}${d.award ? `: ${d.award}` : ''}, ${sch.mark(d.gpa, d.countryId ?? p.countryId)}` : `${degreeLabel(d)}, ${sch.degreeMark(d.gpa, d.countryId ?? p.countryId)}`]),
  ];
  return kv(rows) + (e.enrolled ? `<div style="margin-top:10px">${meterHtml('Effort', e.effort, true)}</div>` : '');
}

/** Everything currently taking up the player's time. */
function commitments(p, c) {
  const e = p.education;
  const rows = [];
  if (edu.canSetPriority()) rows.push(['Putting first', PRIORITY_BY_ID[e.priority]?.name ?? 'Nothing in particular']);
  for (const id of e.clubs) rows.push([CLUB_BY_ID[id].name, 'Member']);
  if (e.enrolled && ['middle', 'high'].includes(e.stage)) rows.push(['Crowd', CLIQUE_BY_ID[e.clique]?.name ?? 'None yet']);
  if (p.career.partTime) rows.push([p.career.partTime.title, `${fmtMoney(p.career.partTime.salary, c)} a year`]);
  for (const s of p.career.sides ?? []) rows.push([s.title, `${s.hours} h/week, ${fmtMoney(s.salary, c)} a year`]);
  if (p.flags.tutorAge === p.age) rows.push(['Private tutor', 'Two evenings a week']);
  if (e.enrolled && edu.isHigher(e.stage)) {
    const mate = edu.roommate();
    const rent = edu.housingCost();
    rows.push(['Housing', `${HOUSING[e.housing]?.label ?? 'Your own home'}${mate ? ` with ${mate.firstName}` : ''}${rent ? `, ${fmtMoney(rent, c)} a year` : ''}`]);
  }
  return rows.length ? kv(rows) : '';
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

/** Work & School actions that open another screen or a list to choose from, and their icons. */
const NAV_ICONS = { school: 'school', campus: 'school', uniplan: 'book', family: 'family', club: 'star', priority: 'compass', tutor: 'book',
  clique: 'people', housing: 'home', switch: 'book', exam: 'book', apply: 'compass', gap: 'globe', hub: 'briefcase', findwork: 'briefcase',
  myfame: 'star', myidol: 'star', fame: 'sparkle' };
/** Ways into work, as in a job center: the ones open to the player, and the rest greyed with why. */
const FIND = new Set(['hub', 'findwork', 'gigs']);
/** The careers with worlds of their own: fame, idols, sport, politics. */
const SPECIAL = new Set(['myfame', 'myidol', 'fame']); // (the special careers have their own list)
const has = (list, id) => list.find(([x]) => x === id);
const row = ([id, label]) => navRow({ attrs: `data-act="${id}"`, label, ico: NAV_ICONS[id] ?? 'briefcase' });

function findWork(p, list) {
  const rows = [];
  rows.push(has(list, 'hub') ? row(has(list, 'hub')) : lockedRow('Jobs', fromAge(p.age, Math.min(15, workLaw().workAge)) || 'Not open to you now'));
  rows.push(has(list, 'findwork') ? row(has(list, 'findwork')) : lockedRow('Find work', fromAge(p.age, 5) || 'Not open to you now'));
  // The armed forces: open from 18 (or serving now), greyed with why otherwise.
  const mil = military.joinOptions();
  rows.push(military.serving() || mil.some((o) => !o.why) ? navRow({ attrs: 'data-act="military"', label: 'Military', sub: military.serving() ? `${p.career.title}, ${military.serving().branch}` : '' })
    : lockedRow('Military', p.legal.incarceration ? 'Not from where you are' : fromAge(p.age, 18) || mil[0].why));
  if (has(list, 'gigs')) rows.push(row(has(list, 'gigs')));
  return `<div class="section-label">Find work</div><div class="nav-group">${rows.join('')}</div>`;
}

/**
 * Special careers: acting, music, dance, modeling, writing, sports, K-pop and politics, each a career of its own with a
 * page of its own. A life follows one at a time (engine/specialCareer.js): the one taken up is marked, and the others
 * wait, greyed with why, until it is left. Sport for fun stays open to anyone.
 */
function specialCareers(p, list) {
  const now = special.current(p);
  const jailed = p.legal.incarceration ? 'Not from where you are' : '';
  const y = store.state.year;
  const notYet = {
    acting: fromAge(p.age, 5),
    music: fromAge(p.age, 12) || (fameEng.exists('concert') ? '' : 'No one makes a living from music here yet'),
    dance: fromAge(p.age, 6),
    modeling: fromAge(p.age, 14),
    writing: fromAge(p.age, 14) || (fameEng.exists('publishing') ? '' : 'There is no publishing here yet'),
    sports: fromAge(p.age, 4),
    kpop: fromAge(p.age, 12) || (y < 1996 ? 'K-pop begins in the 1990s' : ''),
    politics: fromAge(p.age, 14),
  };
  const rows = special.SPECIAL_CAREERS.map((c) => {
    const why = jailed || notYet[c.id];
    if (why) return lockedRow(c.name, why, c.ico);
    if (now && now !== c.id) {
      // Sport for fun is open to anyone; the rest wait until the career is left.
      if (c.id === 'sports') return navRow({ attrs: 'data-act="sc:sports"', label: c.name, sub: 'For fun only, while you have another career', ico: c.ico });
      return lockedRow(c.name, `You are ${special.SPECIAL_BY_ID[now].noun} now`, c.ico);
    }
    return navRow({ attrs: `data-act="sc:${c.id}"`, label: c.name, sub: now === c.id ? 'Your career' : c.blurb, ico: c.ico, tone: now === c.id ? 'peach' : '' });
  });
  const useFame = has(list, 'fame') ? row(has(list, 'fame')) : career.fame() >= 10 ? lockedRow('Use Your Fame', fromAge(p.age, FAME_MIN_AGE)) : '';
  const politics = !now || now === 'politics' ? politicsCard() : '';
  return `<div class="card"><h3>Special careers</h3>
    <p class="muted" style="margin-bottom:10px">${now ? `You are ${esc(special.SPECIAL_BY_ID[now].noun)}. One special career at a time: to start another, leave this one from its page.` : 'Each is a whole career. You can follow one at a time.'}</p>
    <div class="nav-group">${rows.join('')}${useFame}</div></div>
    ${politics ? `<div id="politics-card">${politics}</div>` : ''}`;
}

/** Opposite choices, shown side by side: Study harder | Slack off. */
const PAIRED = new Set(['study', 'slack', 'skip', 'harder']);
/** Leaving: restrained, set apart, and confirmed where the game already asks. */
const DANGER = new Set(['drop', 'quit', 'quitcareer']);

export default {
  id: 'work', title: 'Work & School', short: 'Work',
  icon: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  render(el, api) {
    const p = player();
    const c = country();
    const e = p.education;
    const k = p.career;

    const school = [];
    if (sch.atSchool(p) || (e.history ?? []).length) school.push(['school', sch.atSchool(p) ? 'Your school' : 'Your school years']);
    // At school, everything about it is on the school screen: studying, clubs and teams, cliques, leaving.
    const atSchoolNow = sch.atSchool(p) && !edu.isHigher(e.stage);
    if (e.enrolled && p.age >= 6 && !atSchoolNow) {
      school.push(['study', 'Study harder'], ['slack', 'Slack off']);
      if (p.age >= 10) school.push(['skip', edu.isHigher(e.stage) ? 'Skip lectures' : 'Skip school']);
    }
    if (edu.canSetPriority()) school.push(['priority', 'What comes first']);
    if (edu.canAskForTutor()) school.push(['tutor', 'Ask for a tutor']);
    if (edu.canJoinClubs() && !atSchoolNow) school.push(['club', 'Clubs and classes']);
    if (campusLife.atUniversity()) school.unshift(['campus', 'University life']);
    if (e.enrolled && edu.isHigher(e.stage)) school.push(['housing', 'Change where you live']);
    if (edu.canSwitchMajor()) school.push(['switch', 'Switch major']);
    const leftSchool = !e.enrolled && (e.degrees.some((d) => d.type === 'high') || p.age >= 16);
    if (uni.canPlan()) school.push(['uniplan', uni.plan()?.sent ? 'University answers' : 'University']);
    if (adult.examOptions().length) school.push(['exam', `Sit the ${adult.examOptions()[0].name}`]);
    if (leftSchool) school.push(['apply', 'Plan what comes next']);
    if (edu.canTakeGapYear()) school.push(['gap', 'Take a gap year']);
    if (edu.canDropOut() && !atSchoolNow) school.push(['drop', 'Drop out']);
    { const fr = familyRecord(); if (fr.past.length || fr.kids.length || p.age >= 18) school.push(['family', 'Family schooling']); }

    const work = careerButtons();
    // Your job's own actions stay with the job; finding work and the special careers have lists of their own below.
    const jobOnly = work.filter(([id]) => !FIND.has(id) && !SPECIAL.has(id));

    // Afterglow: screens open from navigation rows, opposite choices sit side by side, and leaving is set apart.
    // `more`: rows that belong in the same list, after the links (Work keeps athletics, politics and the rest there).
    const btns = (list, more = '') => {
      if (!list.length && !more) return '';
      const nav = list.filter(([id]) => NAV_ICONS[id]);
      const pairs = list.filter(([id]) => PAIRED.has(id));
      const danger = list.filter(([id]) => DANGER.has(id));
      const rest = list.filter(([id]) => !NAV_ICONS[id] && !PAIRED.has(id) && !DANGER.has(id));
      const btn = ([id, label], cls = '') => `<button class="btn${cls}" data-act="${id}">${esc(label)}</button>`;
      return `${pairs.length ? `<div class="btn-pair">${pairs.map((b) => btn(b)).join('')}</div>` : ''}
        ${rest.length ? `<div class="btn-pair">${rest.map((b) => btn(b)).join('')}</div>` : ''}
        ${nav.length ? `<div class="nav-group">${nav.map(([id, label]) => {
    const [main, sub] = label.split(/: (.+)/);
    const lead = ['apply', 'findwork'].includes(id) && !k.careerId;
    return navRow({ attrs: `data-act="${id}"`, label: main, sub: sub ?? '', ico: NAV_ICONS[id], tone: lead ? 'peach' : '' });
  }).join('')}</div>` : ''}${more}
        ${danger.length ? `<div class="btn-pair">${danger.map((b) => btn(b, ' danger')).join('')}</div>` : ''}
        <div style="height:4px"></div>`;
    };

    const past = k.history.length
      ? k.history.map((h) => `<div class="kv"><span>${esc(h.title)}${h.employer ? `, ${esc(h.employer)}` : ''}</span><span>Age ${h.from}–${h.to}</span></div>`).join('')
      : '<p class="muted">No past jobs.</p>';

    el.innerHTML = `
      <div class="section-label">You</div>
      <div class="card info-card"><div class="info-head"><span class="nr-icon">${icon('school')}</span><h3>School</h3></div>${educationCard(p, c)}${btns(school)}</div>
      ${commitments(p, c) ? `<div class="card info-card"><div class="info-head"><span class="nr-icon">${icon('calendar')}</span><h3>Your week</h3></div>${commitments(p, c)}</div>` : ''}
      ${careerCard().replace(/<\/div>\s*$/, () => `${btns(jobOnly, `${contacts()}${k.history.length ? `<div class="card"><h3>Past jobs</h3>${past}</div>` : ''}`)}</div>`)}
      ${findWork(p, work)}
      ${specialCareers(p, work)}`;

    el.onclick = (ev) => {
      if (ev.target.closest('[data-go="athletics"]')) return openAthletics(api);
      const pol = ev.target.closest('[data-pol]')?.dataset.pol;
      if (pol) return politicsAction(pol, api);
      const id = ev.target.closest('[data-act]')?.dataset.act;
      if (!id) return;
      ({ ...careerHandlers(api), school: () => openSchool(() => api.changed()), study: () => report(api, edu.studyHard()), slack: () => report(api, edu.slackOff()),
        skip: () => report(api, edu.skipSchool()), tutor: () => report(api, edu.askForTutor()),
        club: () => chooseClub(api), clique: () => chooseClique(api), housing: () => changeHousing(api), military: () => openMilitary(api),
        drop: () => leaveSchool(api), apply: () => applyFlow(api), exam: () => sitExam(api), family: () => openFamilyEducation(), campus: () => openCampus(api), uniplan: () => openUniversity(api, { funding: chooseFunding, housing: chooseHousing }), priority: () => choosePriority(api),
        gap: () => chooseGapYear(api), switch: () => chooseNewMajor(api),
        findjob: () => findJob(api), cover: () => report(api, job.coverShift()), quit: () => quitJob(api) })[id]();
    };
  },
};
