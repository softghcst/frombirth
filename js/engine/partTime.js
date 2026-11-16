// Part-time jobs: getting one, covering shifts, quitting. Each job comes with a
// manager who remembers how you behave (contact tag 'manager').
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, localWage } from '../util.js';
import { store, player, country, npcsByRole, log } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { checkChance } from './eventEngine.js';
import { remember } from './conditions.js';
import { PART_TIME_JOBS, PART_TIME_BY_ID, COVER_SHIFT_PAY } from '../data/partTimeJobs.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const yearActs = () => {
  const p = player();
  if (p.flags.jobActs?.age !== p.age) p.flags.jobActs = { age: p.age, applied: {}, covered: 0 };
  return p.flags.jobActs;
};

export const manager = () => npcsByRole('tag:manager')[0];

/** @returns {{id, title, place, pay:number, available:boolean, reason:string}[]} */
export function jobOptions() {
  const p = player();
  const c = country();
  return PART_TIME_JOBS.map((j) => {
    let reason = '';
    if (p.age < j.minAge) reason = `You need to be ${j.minAge}.`;
    else if (yearActs().applied[j.id]) reason = 'You already applied this year.';
    return { id: j.id, title: j.title, place: j.place, pay: localWage(j.pay, c), available: !reason, reason };
  });
}

export const canWorkPartTime = () => {
  const p = player();
  return p.age >= 15 && !p.career.careerId && !p.career.partTime && !p.legal.incarceration;
};

export function takeJob(id) {
  const p = player();
  const job = PART_TIME_BY_ID[id];
  const c = country();
  if (!canWorkPartTime()) return result(false, 'You cannot take a part-time job right now.');
  yearActs().applied[id] = true;
  if (!rng.chance(checkChance(job.hire))) {
    const text = `You applied at ${job.place}. They went with someone else.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  // A previous manager stops being your manager.
  for (const old of npcsByRole('tag:manager')) { old.flags.tag = 'formerManager'; old.flags.title = 'Former manager'; }
  const boss = makeNpc({ role: 'boss', countryId: p.countryId, age: rng.int(26, 55), relationship: rng.int(45, 60) });
  boss.flags.tag = 'manager';
  boss.flags.title = 'Manager';
  boss.lastInteractionAge = p.age;
  store.state.npcs[boss.id] = boss;
  p.npcIds.push(boss.id);

  p.career.partTime = { jobId: id, title: job.title, salary: localWage(job.pay, c), since: p.age };
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

export function quitJob() {
  const p = player();
  if (!p.career.partTime) return result(false, 'You do not have a job.');
  const title = p.career.partTime.title;
  p.career.history.push({ careerId: p.career.partTime.jobId, title, from: p.career.partTime.since, to: p.age, exit: 'quit' });
  p.career.partTime = null;
  const boss = manager();
  if (boss) boss.flags.title = 'Former manager';
  const text = `You quit your job as a ${title.toLowerCase()}.`;
  log(text);
  return result(true, text, 'neutral');
}
