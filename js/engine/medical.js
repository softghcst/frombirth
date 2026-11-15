// Doctors, check-ups, therapy and cosmetic surgery.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { player, country, log, milestone } from '../state.js';
import { addCondition, cureCondition } from './health.js';
import { ILLNESS_BY_ID } from '../data/illnesses.js';
import { TREATMENTS, PUBLIC_CARE_SHARE, CHECKUP_COST, THERAPY_COST, SURGERIES, SURGEONS } from '../data/activities.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

function acts() {
  const p = player();
  if (p.flags.medActs?.age !== p.age) p.flags.medActs = { age: p.age, seen: {} };
  return p.flags.medActs;
}

/** What the patient pays: almost nothing where care is public, or behind bars. */
export function careCost(base) {
  const c = country();
  if (player().legal.incarceration) return 0;
  return localMoney(base * (c.freeHealthcare ? PUBLIC_CARE_SHARE : 1), c);
}

/** Conditions a doctor could do something about, with what it would cost. */
export function treatable() {
  const p = player();
  return p.conditions.filter((c) => TREATMENTS[c.id]).map((c) => {
    const t = TREATMENTS[c.id];
    const cost = careCost(t.cost);
    return { id: c.id, name: c.name, cost, manage: !!t.manage, managed: !!c.treated,
      seen: !!acts().seen[c.id], affordable: p.finance.cash >= cost };
  });
}

export function seeDoctor(conditionId) {
  const p = player();
  const c = country();
  const cond = p.conditions.find((x) => x.id === conditionId);
  const t = TREATMENTS[conditionId];
  if (!cond || !t) return result(false, 'There is nothing to treat.', 'neutral');
  if (acts().seen[conditionId]) return result(false, 'The doctor has done what can be done this year.', 'neutral');
  const cost = careCost(t.cost);
  if (p.finance.cash < cost) return result(false, `Treatment costs ${fmtMoney(cost, c)}. You do not have it.`, 'neutral');
  acts().seen[conditionId] = true;
  p.finance.cash -= cost;
  const paid = cost ? ` It cost ${fmtMoney(cost, c)}.` : '';
  const plain = cond.name.replace(/^an? /, '');

  if (!rng.chance(t.chance)) {
    const text = `The treatment for your ${plain} did not take. The doctor wants to try again next year.${paid}`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  if (t.manage) {
    cond.treated = true;
    const text = `Your ${plain} cannot be cured, but it is under control now. Stay on the treatment and it will trouble you far less.${paid}`;
    log(text, 'system', 'good');
    return result(true, text);
  }
  cureCondition(conditionId);
  p.stats.health = clamp(p.stats.health + Math.round(cond.severity / 6));
  const text = `The doctor treated your ${plain}, and it worked.${paid}`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** A yearly check-up: a small boost, and early warning that makes illness less likely next year. */
export function checkUp() {
  const p = player();
  const c = country();
  const cost = careCost(CHECKUP_COST);
  if (acts().checkup) return result(false, 'You have had your check-up this year.', 'neutral');
  if (p.finance.cash < cost) return result(false, 'You cannot afford the appointment.', 'neutral');
  acts().checkup = true;
  p.finance.cash -= cost;
  p.flags.checkupAge = p.age;
  p.stats.health = clamp(p.stats.health + 2);
  const found = p.conditions.filter((x) => TREATMENTS[x.id] && !x.treated);
  const text = found.length
    ? `The doctor ran the tests and wants to treat your ${found.map((x) => x.name.replace(/^an? /, '')).join(' and ')}.`
    : 'The doctor ran the tests and found nothing to worry about. Catching things early keeps it that way.';
  log(text, 'system', found.length ? 'neutral' : 'good');
  return result(true, text, found.length ? 'neutral' : 'good');
}

export function therapy() {
  const p = player();
  const c = country();
  const cost = careCost(THERAPY_COST);
  if (acts().therapy) return result(false, 'You have a standing appointment already this year.', 'neutral');
  if (p.finance.cash < cost) return result(false, `A year of sessions costs ${fmtMoney(cost, c)}.`, 'neutral');
  acts().therapy = true;
  p.finance.cash -= cost;
  p.stats.mood = clamp(p.stats.mood + rng.int(8, 14));
  p.hidden.crazy = clamp(p.hidden.crazy - 4);
  p.hidden.willpower = clamp(p.hidden.willpower + 2);
  const text = 'An hour a week, saying things out loud that you had only ever thought. You feel lighter.';
  log(text, 'system', 'good');
  return result(true, text);
}

// ---------- Cosmetic surgery ----------

/** Procedures open to the player, priced for each kind of surgeon. */
export function surgeryOptions() {
  const p = player();
  return SURGERIES.filter((s) => p.age >= s.minAge);
}
export function surgeonOptions(procedureId) {
  const p = player();
  const proc = SURGERIES.find((s) => s.id === procedureId);
  return SURGEONS.map((s) => {
    const cost = localMoney(proc.cost * s.cost, country());
    const risk = Math.min(0.9, proc.risk * s.risk);
    return { id: s.id, name: s.name, blurb: s.blurb, cost, affordable: p.finance.cash >= cost,
      risk: risk >= 0.2 ? 'high' : risk >= 0.07 ? 'moderate' : 'low' };
  });
}
export const canHaveSurgery = () => player().age >= 18 && !player().legal.incarceration;

export function haveSurgery(procedureId, surgeonId) {
  const p = player();
  const c = country();
  const proc = SURGERIES.find((s) => s.id === procedureId);
  const surgeon = SURGEONS.find((s) => s.id === surgeonId);
  const cost = localMoney(proc.cost * surgeon.cost, c);
  if (!canHaveSurgery() || p.age < proc.minAge) return result(false, 'That is not available to you.', 'neutral');
  if (acts().surgery) return result(false, 'You are still healing from the last one. Give it a year.', 'neutral');
  if (p.finance.cash < cost) return result(false, 'You cannot afford it.', 'neutral');
  acts().surgery = true;
  p.finance.cash -= cost;
  p.counters.surgeries = (p.counters.surgeries ?? 0) + 1;
  const name = proc.name.toLowerCase();

  if (rng.chance(Math.min(0.9, proc.risk * surgeon.risk))) {
    const loss = rng.int(8, 20);
    p.stats.charm = clamp(p.stats.charm - loss);
    p.stats.mood = clamp(p.stats.mood - 15);
    p.stats.health = clamp(p.stats.health - rng.int(3, 10));
    addCondition('botched_surgery');
    const text = `Your ${name} went wrong. When the bandages come off, you do not recognise what is underneath. It cost ${fmtMoney(cost, c)}, and a doctor may be able to repair some of it.`;
    log(text, 'system', 'bad');
    milestone(`Had a ${name} that went badly wrong.`, 'life');
    return result(false, text);
  }
  const gain = rng.int(proc.gain[0], proc.gain[1]);
  p.stats.charm = clamp(p.stats.charm + gain);
  p.stats.mood = clamp(p.stats.mood + 6);
  const text = `Your ${name} went well. Once the swelling goes down, you like what you see. It cost ${fmtMoney(cost, c)}.`;
  log(text, 'system', 'good');
  return result(true, text);
}

export const conditionInfo = (id) => ILLNESS_BY_ID[id];
