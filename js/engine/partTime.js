// Part-time jobs: getting one, covering shifts, quitting. Each job comes with a
// manager who remembers how you behave (contact tag 'manager').
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, localWage } from '../util.js';
import { store, player, country, npcsByRole, log } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { checkChance } from './eventEngine.js';
import { remember } from './conditions.js';
import { PART_TIME_JOBS, PART_TIME_BY_ID, COVER_SHIFT_PAY } from '../data/partTimeJobs.js';
import { resolve } from './conditions.js';
import { canFit, workLaw, career as careerState } from './worklife.js';
import { quitSide, allSides } from './sideJobs.js';
import { uid } from '../util.js';
import { jobBlock as jobBlockSpecial } from './specialCareer.js';

const STUDYING = ['university', 'community', 'graduate', 'doctorate', 'medical', 'law', 'nursing', 'teaching', 'business', 'dental', 'pharmacy', 'veterinary'];

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const yearActs = () => {
  const p = player();
  if (p.flags.jobActs?.age !== p.age) p.flags.jobActs = { age: p.age, applied: {}, covered: 0 };
  return p.flags.jobActs;
};

export const manager = () => npcsByRole('tag:manager')[0];

/** @returns {{id, title, place, pay:number, hours:number, campus:boolean, available:boolean, reason:string}[]} */
export function jobOptions() {
  const p = player();
  const c = country();
  const held = allSides().map((s) => s.jobId);
  return PART_TIME_JOBS.map((j) => {
    let reason = '';
    const short = Object.entries(j.req ?? {}).find(([path, min]) => (Number(resolve(path)) || 0) < min);
    if (j.from && store.state.year < j.from) reason = `There is no such job in ${store.state.year}.`;
    else if (p.age < Math.max(j.minAge, workLaw().workAge)) reason = `You need to be ${Math.max(j.minAge, workLaw().workAge)}.`;
    else if (held.includes(j.id)) reason = 'You already work there.';
    else if (j.campus && !(p.education.enrolled && STUDYING.includes(p.education.stage))) reason = 'Only for students at a university or college.';
    else if (short) reason = 'You are not quite what they are looking for yet.';
    else if (yearActs().applied[j.id]) reason = 'You already applied this year.';
    else { const fit = canFit(j.hours, { kind: 'parttime' }); if (!fit.ok) reason = fit.text; }
    return { id: j.id, title: j.title, place: j.place, pay: localWage(j.pay, c), hours: j.hours, campus: !!j.campus, available: !reason, reason };
  });
}

/** Part-time work fits around school, study, a full-time job, or retirement, as long as the hours allow. */
export const canWorkPartTime = () => {
  const p = player();
  return p.age >= Math.min(15, workLaw().workAge) && !p.legal.incarceration && allSides().length < 3;
};

export function takeJob(id) {
  const p = player();
  const job = PART_TIME_BY_ID[id];
  const c = country();
  if (!canWorkPartTime()) return result(false, 'You cannot take a part-time job right now.');
  { const sc = jobBlockSpecial(id, p, undefined, { partTime: true }); if (sc) return result(false, sc, 'neutral'); }
  const option = jobOptions().find((o) => o.id === id);
  if (!option?.available) return result(false, option?.reason || 'You cannot take that job.', 'neutral');
  yearActs().applied[id] = true;
  if (!rng.chance(checkChance(job.hire))) {
    const text = `You applied at ${job.place}. They went with someone else.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  // The first part-time job has the manager the events know; any more are side jobs with their own.
  const second = !!p.career.partTime;
  if (!second) for (const old of npcsByRole('tag:manager')) { old.flags.tag = 'formerManager'; old.flags.title = 'Former manager'; }
  const boss = makeNpc({ role: second ? 'colleague' : 'boss', countryId: p.countryId, age: rng.int(26, 55), relationship: rng.int(45, 60) });
  if (!second) boss.flags.tag = 'manager';
  boss.flags.title = second ? `Manager at ${job.place}` : 'Manager';
  boss.flags.workedWith = job.place;
  boss.lastInteractionAge = p.age;
  store.state.npcs[boss.id] = boss;
  p.npcIds.push(boss.id);

  const held = { jobId: id, title: job.title, place: job.place, salary: localWage(job.pay, c), hours: job.hours, since: p.age, campus: !!job.campus };
  if (second) careerState().sides.push({ ...held, id: uid('side'), managerId: boss.id, perf: 50 });
  else p.career.partTime = held;
  p.counters.jobsHeld += 1;
  const text = `You got a part-time job as a ${job.title.toLowerCase()} at ${job.place}. Your manager is ${boss.firstName}. It pays ${fmtMoney(p.career.partTime.salary, c)} a year.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** Once a year: extra money, and your manager remembers it. */
export function coverShift() {
  const p = player();
  const boss = manager();
  if (!p.career.partTime) return result(false, 'You do not have a job.');
  if (yearActs().covered >= 1) return result(false, 'You have already covered for someone this year.', 'neutral');
  yearActs().covered += 1;
  const pay = localWage(COVER_SHIFT_PAY, country());
  p.finance.cash += pay;
  p.stats.mood = clamp(p.stats.mood - 2);
  if (boss) {
    boss.meters.relationship = clamp(boss.meters.relationship + 10);
    boss.lastInteractionAge = p.age;
    remember(boss, 'coveredShift', 'You covered a double shift at no notice when someone called in sick.');
  }
  const text = `Someone called in sick and you covered a double shift at no notice. ${boss ? `${boss.firstName} will not forget it. ` : ''}You earned ${fmtMoney(pay, country())}.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** Quits a part-time job: the original one unless another is named. */
export function quitJob(id = 'pt') {
  const r = quitSide(id);
  if (r.ok) log(r.text);
  return r;
}
