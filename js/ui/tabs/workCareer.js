// Career half of the Work & School tab: the job card, finding work,
// interviews and auditions, gigs, fame and retirement.
import { store, player, country } from '../../state.js';
import { esc, fmtMoney } from '../../util.js';
import * as career from '../../engine/career.js';
import * as job from '../../engine/partTime.js';
import { meterHtml } from '../meter.js';
import { dutyButtons, runDuty } from '../justice.js';
import { messageModal, pickModal, confirmModal } from '../modals.js';
import { openOccupation } from '../occupation.js';
import { openFame } from '../fame.js';
import { openIdol } from '../kpop.js';
import { workOf } from '../../engine/entertainment.js';
import { employer } from '../../engine/employers.js';
import { workLaw, weeklyLoad, career as careerState } from '../../engine/worklife.js';
import { offers } from '../../engine/hiring.js';
import { icon } from '../kit.js';
import { leads } from '../../engine/recruiters.js';

const kv = (rows) => rows.map(([a, b]) =>
  `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');

async function report(api, r) {
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

/** The card describing the player's working life right now. */
export function careerCard() {
  const p = player();
  const c = country();
  const k = p.career;
  const cur = career.currentCareer();
  const fame = career.fame();
  let body;
  if (cur) {
    const step = career.nextStep();
    const b = career.boss();
    const e = employer(careerState().employerId);
    body = kv([
      ['Role', k.title],
      ...(e ? [['Employer', `${e.name}, ${e.city}`]] : []),
      ['Field', cur.name + (k.military ? ` (${k.military.branch})` : '')],
      [cur.type === 'freelance' ? 'Earnings this year' : 'Salary', `${fmtMoney(k.salary, c)} / year`],
      ['Years in role', String(k.yearsInRole)],
      ...(b ? [[b.flags.title, `${b.firstName} ${b.lastName}`]] : []),
      ...(k.military ? [['Deployments', String(k.military.deployments)]] : []),
      ...(step ? [['Next step', `${step.title}${step.missing.length ? `: needs ${step.missing.join(' and ')}` : step.yearsLeft > 0 ? `, in about ${step.yearsLeft} ${step.yearsLeft === 1 ? 'year' : 'years'} with good reviews` : ', when a good review lands'}`]]
        : [['Next step', 'You are at the top.']]),
      ['Your week', `${weeklyLoad().total} hours, all told`],
    ]) + `<div style="margin-top:10px">${meterHtml('Performance', k.performance, true)}${meterHtml('Satisfaction', careerState().satisfaction, true)}${meterHtml('Stress', careerState().stress, true)}</div>`;
  } else if (k.partTime) {
    body = kv([['Part-time', k.partTime.title], ['Pay', `${fmtMoney(k.partTime.salary, c)} / year`], ['Since', `Age ${k.partTime.since}`]]);
  } else if (k.retired) {
    body = kv([['Status', 'Retired'], ['Pension', `${fmtMoney(k.pensionPerYear, c)} / year`]]);
  } else {
    body = `<p class="muted">${p.age < 5 ? 'You are too young to work.' : p.age < 15 ? 'You are too young for an ordinary job, but children can act.' : 'You do not have a job.'}</p>`;
  }
  const fameRow = fame > 0 || cur?.fame
    ? `<div style="margin-top:10px">${meterHtml('Fame', fame, true)}</div>` : '';
  return `<div class="card info-card"><div class="info-head"><span class="nr-icon">${icon('briefcase')}</span><div><h3>Work</h3><small>${esc(cur ? `${k.title}` : k.partTime ? 'Part-time' : k.retired ? 'Retired' : 'No job right now')}</small></div></div>${body}${fameRow}</div>`;
}

/** Buttons for whatever the player can do about work right now. */
export function careerButtons() {
  const p = player();
  const k = p.career;
  const cur = career.currentCareer();
  const list = [];
  const waiting = offers().length + leads().length;
  if (p.age >= Math.min(15, workLaw().workAge)) list.push(['hub', `Work: jobs, people, freelancing, history${waiting ? ` (${waiting} waiting)` : ''}`]);
  if (p.age >= workLaw().workAge) list.push(['findwork', cur ? 'Look for a different job' : 'Find work']);
  else if (p.age >= 5) list.push(['findwork', cur ? 'Look for other acting work' : 'Audition for acting work']);
  if (cur) {
    list.push(...dutyButtons().map(([id, label]) => [id, label]));
    list.push(['harder', 'Work harder'], ['slack', 'Slack off']);
    if (cur.type !== 'freelance') list.push(['raise', 'Ask for a raise']);
  }
  if (k.partTime) list.push(['cover', 'Cover an extra shift']);
  if (career.canGig()) list.push(['gigs', 'Quick one-off gigs']);
  // My Fame: for anyone with a performer's skills, credits, or a name people know.
  if (p.age >= 5 && (Math.max(p.talents.acting, p.talents.singing, p.talents.dance) >= 25 || workOf(p).credits.length || career.fame() >= 5)) list.push(['myfame', 'My Fame: auditions, work, press and awards']);
  if (p.age >= 12 && (store.state.kpop || (store.state.year >= 1996 && Math.max(p.talents.singing, p.talents.dance) >= 30))) list.push(['myidol', 'K-pop Idol: auditions, training, debut']);
  if (career.fame() >= 10) list.push(['fame', 'Use your fame']);
  if (career.canRetire()) list.push(['retire', 'Retire']);
  if (cur) list.push(['quitcareer', 'Quit your job']);
  if (k.partTime) list.push(['quit', 'Quit your part-time job']);
  return list;
}

/** Walks through one interview question at a time. Resolves the scores. */
async function interview(questions) {
  const scores = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const score = await pickModal({
      title: `Question ${i + 1} of ${questions.length}`,
      body: q.q,
      cancel: 'Say nothing',
      options: q.a.map((a) => ({ value: a.s, label: a.t })),
    });
    scores.push(score ?? 0);
  }
  return scores;
}

async function applyFor(api, id) {
  const start = career.startApplication(id);
  if (start.kind === 'blocked') return messageModal({ body: start.text });
  let answers = [];
  if (start.kind === 'offer') {
    const yes = await confirmModal({ title: 'A standing offer', body: start.text, yes: 'Take the job', no: 'Not now' });
    if (!yes) return undefined;
  } else if (start.kind === 'interview') {
    answers = await interview(start.questions);
  } else if (start.kind === 'audition') {
    const piece = await pickModal({
      title: 'The audition',
      body: 'You get one piece. Choose what shows you at your best.',
      cancel: 'Walk out',
      options: start.pieces.map((x, i) => ({ value: i, label: x.t, sub: x.bonus ? 'A risk. If it comes off, they will remember you.' : '' })),
    });
    if (piece == null) return undefined;
    answers = [piece];
  }
  return report(api, career.finishApplication(id, answers));
}

async function findPartTime(api) {
  const c = country();
  if (!job.canWorkPartTime()) return messageModal({ body: 'Part-time work is for people without a full-time job.' });
  const id = await pickModal({
    title: 'Part-time work',
    body: 'A few shifts a week. Your manager will remember how you behave.',
    options: job.jobOptions().map((j) => ({
      value: j.id, label: j.title, disabled: !j.available,
      sub: j.available ? `At ${j.place}. ${fmtMoney(j.pay, c)} a year.` : j.reason,
    })),
  });
  return id ? report(api, job.takeJob(id)) : undefined;
}

async function findWork(api) {
  const c = country();
  const cat = await pickModal({
    title: 'Find work',
    body: 'Each field has its own way in. Locked jobs say what they need.',
    options: [
      ...career.categories().map((x) => ({ value: x.id, label: x.name })),
      { value: 'parttime', label: 'Part-time work', sub: 'For students and anyone without a full-time job.' },
    ],
  });
  if (!cat) return;
  if (cat === 'parttime') { await findPartTime(api); return; }
  const id = await pickModal({
    title: career.categories().find((x) => x.id === cat).name,
    options: career.careersIn(cat).map((j) => ({
      value: j.id, label: `${j.name}: ${j.title}`, disabled: !j.eligible || (j.applied && !j.offer),
      sub: !j.eligible ? j.reasons.join(' ')
        : j.offer ? `${j.offer} ${fmtMoney(j.pay[0], c)}–${fmtMoney(j.pay[1], c)} a year.`
          : j.applied ? 'You already tried this year.'
            : `${fmtMoney(j.pay[0], c)}–${fmtMoney(j.pay[1], c)} a year.${j.helped ? ' Someone you know improves your odds.' : ''}`,
    })),
  });
  if (id) await applyFor(api, id);
}

async function gigs(api) {
  const c = country();
  const id = await pickModal({
    title: 'Freelance gigs',
    body: 'One-off paid work. The better you are at it, the more it pays.',
    options: career.gigOptions().map((g) => ({
      value: g.id, label: g.name, disabled: !g.available,
      sub: g.available ? `Pays about ${fmtMoney(g.pay, c)}.` : g.reason,
    })),
  });
  if (id) await report(api, career.doGig(id));
}

async function fame(api) {
  const id = await pickModal({
    title: `Fame: ${career.fame()}%`,
    body: 'The more famous you are, the more these pay. They can also go wrong in public.',
    options: career.fameOptions().map((a) => ({ value: a.id, label: a.name, disabled: !a.available, sub: a.reason })),
  });
  if (id) await report(api, career.doFameAction(id));
}

async function retire(api) {
  const yes = await confirmModal({
    title: 'Retire?',
    body: `You would stop work for good on a pension of about ${fmtMoney(career.pensionEstimate(), country())} a year.`,
    yes: 'Retire',
  });
  if (yes) await report(api, career.retire());
}

async function quit(api) {
  const yes = await confirmModal({ title: 'Quit your job?', body: 'You will lose your salary. You can look for other work straight away.', yes: 'Quit', danger: true });
  if (yes) await report(api, career.quitCareer());
}

/** Handlers keyed by button id. */
export const careerHandlers = (api) => ({
  hub: () => openOccupation(api),
  myfame: () => openFame(api),
  myidol: () => openIdol(api),
  findwork: () => (player().age >= workLaw().workAge ? openOccupation(api, 'find') : findWork(api)),
  harder: () => report(api, career.workHarder()),
  slack: () => report(api, career.slackOffAtWork()),
  raise: () => report(api, career.askForRaise()),
  gigs: () => gigs(api),
  fame: () => fame(api),
  retire: () => retire(api),
  quitcareer: () => quit(api),
  'duty:investigate': () => runDuty('investigate', api),
  'duty:defend': () => runDuty('defend', api),
  'duty:prosecute': () => runDuty('prosecute', api),
  'duty:preside': () => runDuty('preside', api),
  'duty:shift': () => runDuty('shift', api),
});
