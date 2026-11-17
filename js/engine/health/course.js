// How conditions begin and change: onset, episodes, remission and recurrence,
// what a person experiences, and how much it gets in the way of daily life.
//
// Treatment effects are worked out per condition and combined, never added up:
// two treatments that each help a little help more together, but nothing can
// take a condition below zero, and the same experience arising from two
// conditions is counted once.
import { rng } from '../../rng.js';
import { store, player, log } from '../../state.js';
import { clamp } from '../../util.js';
import { CONDITIONS, CONDITION_BY_ID, MENTAL } from '../../data/health/conditions.js';
import { SYMPTOMS } from '../../data/health/symptoms.js';
import { healthOf, presentConditions, startCondition, note, diagnosisFor } from './record.js';
import { hazardMultiplier, genomeOf } from './heredity.js';
import { now, seeded, WEEKS } from './util.js';
import { trialBenefit } from './meds.js';
import { therapyEffect, skillsEffect } from './therapy.js';
import { supportEffect } from './access.js';
import { healthMilestone } from './story.js';
import { admit } from './hospital.js';
import { foundByDoctor } from './care.js';

// ---------- Onset ----------

/**
 * Once a year: does anything begin? Each later-onset condition has a small
 * yearly chance inside its age window, scaled by inherited predisposition and,
 * for some, by a hard stretch of life. Birth conditions are decided at birth.
 */
export function rollOnset(p = player()) {
  const h = healthOf(p);
  const g = genomeOf(p);
  const stress = 1 + Math.max(0, h.wellbeing.stress - 50) / 100;
  for (const def of CONDITIONS) {
    if (def.onset.kind !== 'hazard') continue;
    const [a, b] = def.onset.ages;
    if (p.age < a || p.age > b) continue;
    if (h.conditions.some((c) => c.conditionId === def.id && c.status !== 'historical')) continue;
    if (def.sensitive && h.settings.sensitive === 'reduced') continue;
    // Mood and anxiety conditions are more likely to start in a hard year; most are not "caused" by one.
    const s = MENTAL.includes(def.group) ? stress : 1;
    if (!rng.chance(def.onset.rate * hazardMultiplier(g, def.id) * s)) continue;
    begin(def, p);
  }
  // Single-gene and birth conditions that are present but only now begin to show.
  for (const rec of h.conditions) {
    if (rec.showsAge === p.age && rec.status === 'active') noticed(rec, p);
  }
}

/** A condition starts, with a severity and a mix of experiences that belong to this person. */
export function begin(def, p = player(), o = {}) {
  const r = seeded('onset', p.id, def.id, store.state.year);
  const sev = o.severity ?? Math.round(r.range(30, 75));
  const rec = startCondition(def.id, { severity: sev, onsetWk: now(p) - r.int(0, 20), ...o }, p);
  if (def.id === 'bipolar_1' || def.id === 'bipolar_2') rec.episode = { kind: 'depression', startWk: rec.onsetWk, endWk: rec.onsetWk + r.int(8, 22) };
  // Most conditions are not announced: a person notices how life feels, not a name.
  if (def.group === 'mobility' && def.acquired) {
    log('An accident has changed how you get around. It will take time, and support, to find your way with it.', 'system', 'bad');
    if (!o.noAdmit) { admit('spinal', { conditionId: def.id }, p); foundByDoctor(rec, 'hospital', 'doctor', p); }
  }
  // Heart disease is often first found in an emergency.
  if (def.id === 'heart_disease' && !o.noAdmit && (o.attack || r.chance(0.4))) {
    rec.burden = sev;
    admit('heart', { conditionId: def.id }, p);
    foundByDoctor(rec, 'hospital', 'cardiologist', p);
  }
  return rec;
}

function noticed(rec, p) {
  const def = CONDITION_BY_ID[rec.conditionId];
  const line = {
    adhd: 'Teachers have started to say you are bright but "all over the place". Homework goes missing; your attention goes where it likes.',
    autism: 'Some things that are easy for other people take you a lot of energy, and some things that fascinate you leave other people puzzled.',
    dyslexia: 'Reading is harder work for you than for the others in your class, however hard you try.',
    dyscalculia: 'Numbers will not stay put for you the way they seem to for others.',
    dysgraphia: 'Your handwriting takes real effort, and your hand aches after a page.',
    dld: 'Finding the right words, and following fast talk, takes you more effort than other children.',
    tourette: 'You have started to have tics: movements and sounds that come on their own.',
    huntingtons: 'Small, uncontrolled movements have started, and concentrating is harder than it was.',
    lhon: 'Your sight has started to blur in the middle, first in one eye.',
    colour_vision: 'You mix up some colours that other people find obvious.',
    cystic_fibrosis: 'A cough that will not go away, and chest infections one after another.',
  }[def.id];
  if (line) log(line, 'system', 'neutral');
}

// ---------- The weekly course ----------

/** How much each active treatment is helping this condition this week, combined (0–0.95). */
export function treatmentEffect(rec, p = player()) {
  const h = healthOf(p);
  let keep = 1;
  for (const t of h.trials) {
    const b = trialBenefit(t, rec, p);
    if (b > 0) keep *= 1 - b;
  }
  for (const c of h.therapies) {
    const b = therapyEffect(c, rec, p);
    if (b > 0) keep *= 1 - b;
  }
  const s = supportEffect(rec, p);
  if (s > 0) keep *= 1 - s;
  const k = skillsEffect(rec, p);
  if (k > 0) keep *= 1 - k;
  // Treatment from before the health record existed keeps working until a plan replaces it.
  if (rec.legacyManaged && !h.trials.some((t) => t.underlyingId === rec.id)) keep *= 0.4;
  return clamp(1 - keep, 0, 0.95);
}

/** One week of every condition the person has. */
export function weekCourse(p = player()) {
  const h = healthOf(p);
  for (const rec of presentConditions(h)) {
    const def = CONDITION_BY_ID[rec.conditionId];
    if (rec.showsAge != null && p.age < rec.showsAge) { rec.burden = 0; continue; }
    let base = rec.severity;
    if (def.episodes) base = episodeWeek(rec, def, p);
    else if (def.course === 'episodic' || def.course === 'persistent') {
      // Untreated, many conditions still ease with time, at their own pace; treatment speeds it.
      if (rec.status === 'active' && rng.chance((def.remit ?? 0) / WEEKS)) rec.severity = Math.round(rec.severity * 0.75);
    }
    // Cancer grows until it is treated; how early it is found matters most.
    if (def.id === 'cancer' && rec.status === 'active') {
      const treated = healthOf(p).therapies.some((c) => c.therapyId === 'cancer_treatment' && c.status === 'active' && c.conditionIds.includes(rec.id));
      rec.sevF = Math.min(95, (rec.sevF ?? rec.severity) + (treated ? 0 : 0.22));
      rec.severity = Math.round(rec.sevF);
      base = rec.severity;
    }
    // A hard week adds to it for a while, then passes.
    base = Math.min(100, base + (rec.spike ?? 0));
    if (rec.spike) rec.spike = Math.floor(rec.spike * 0.7);
    const eff = treatmentEffect(rec, p);
    const target = Math.round(base * (1 - eff));
    // Change is gradual: a week moves part of the way.
    rec.burden = Math.round(rec.burden + (target - rec.burden) * 0.2);
    rec.effect = Math.round(eff * 100);
    if (def.neurotype || ['sensory', 'mobility', 'genetic'].includes(def.group) || def.id === 'cancer' || def.course === 'progressive') continue; // lifelong, or resolved only by treatment
    remission(rec, def, p);
  }
}

function remission(rec, def, p) {
  rec.calm = rec.burden < 20 ? rec.calm + 1 : 0;
  if (rec.status === 'active' && rec.calm >= (def.id === 'bpd' ? 26 : 8)) {
    rec.status = 'in_remission';
    rec.remissionWk = now(p);
    note(rec, 'In remission.');
    if (diagnosisFor(rec)) healthMilestone(def.id === 'bpd' ? 'Reached a long, steady stretch that once felt out of reach.' : `Recovered from a period of ${def.short}.`, { type: 'remission', id: rec.id }, p);
  } else if (rec.status === 'in_remission') {
    if (rng.chance((def.recur ?? 0) / WEEKS * (rec.effect > 30 ? 0.5 : 1))) {
      rec.status = 'active';
      rec.severity = rng.int(30, 60);
      rec.calm = 0;
      note(rec, 'Came back. Recurrence is common and is not a failure.');
    } else if (now(p) - rec.remissionWk > 156) {
      rec.status = 'resolved';
      note(rec, 'Three years without it coming back.');
    }
  }
}

/**
 * Bipolar disorder: episodes of depression, mania or hypomania with stable
 * stretches between, each lasting weeks or months. Mood stabilisers make
 * episodes less likely; they do not flatten ordinary feelings.
 */
function episodeWeek(rec, def, p) {
  const w = now(p);
  const ep = rec.episode;
  if (ep && w >= ep.endWk) {
    note(rec, `A ${ep.kind} episode ended.`);
    rec.episode = null;
  }
  if (!rec.episode) {
    const prevention = treatmentEffect(rec, p);
    if (rng.chance(0.006 * (1 - prevention * 0.85))) {
      const kinds = Object.entries(def.episodes).filter(([, v]) => v > 0);
      const kind = rng.weighted(kinds, (k) => k[1])[0];
      const len = { depression: rng.int(8, 20), mania: rng.int(3, 10), hypomania: rng.int(1, 4) }[kind];
      rec.episode = { kind, startWk: w, endWk: w + len };
      if (kind !== 'depression') {
        rec.seenHigh = true;
        log(kind === 'mania' ? 'For weeks you have barely slept, and have not needed to. Ideas come faster than you can say them.' : 'You have been sleeping less and doing more, buzzing with plans. People have noticed.', 'system', 'neutral');
        h_reviewOnHigh(rec, p);
      }
    }
  }
  if (!rec.episode) return 12;
  return rec.episode.kind === 'depression' ? 65 : rec.episode.kind === 'mania' ? 80 : 45;
}

/** A first high episode in someone diagnosed with depression: their clinician revisits the diagnosis. */
function h_reviewOnHigh(rec, p) {
  const h = healthOf(p);
  const dx = h.diagnoses.find((d) => d.underlyingId === rec.id && d.status === 'active' && d.conditionId === 'mdd');
  if (dx) dx.flagged = 'high';
}

// ---------- What the person experiences ----------

/**
 * The experiences someone has this week, each counted once, with what might
 * explain it. Undiagnosed conditions show only as experiences: the game does
 * not name a condition nobody has recognised.
 */
export function experiences(p = player()) {
  const h = healthOf(p);
  const out = {};
  for (const rec of presentConditions(h)) {
    if (rec.burden < 12) continue;
    if (rec.showsAge != null && p.age < rec.showsAge) continue;
    for (const s of rec.features) {
      if (!SYMPTOMS[s]) continue;
      const strength = rec.burden;
      if (!out[s] || out[s].strength < strength) out[s] = { id: s, label: SYMPTOMS[s].label, strength, sources: [] };
      out[s].sources.push(rec.id);
    }
  }
  if (h.wellbeing.sleep < 40) out.low_energy ??= { id: 'low_energy', label: SYMPTOMS.low_energy.label, strength: 30, sources: ['sleep_debt'] };
  if (h.wellbeing.stress > 75) out.tension ??= { id: 'tension', label: SYMPTOMS.tension.label, strength: 30, sources: ['stress'] };
  return Object.values(out).sort((a, b) => b.strength - a.strength);
}

/** Impact on each part of daily life: the strongest source for each, never the sum of them. */
export function domainImpact(p = player()) {
  const out = {};
  for (const e of experiences(p)) for (const d of SYMPTOMS[e.id].domains) out[d] = Math.max(out[d] ?? 0, e.strength);
  return out;
}

/** 0–100: how well daily life is going, all things considered. Not a health score; not a happiness score. */
export function dailyFunctioning(p = player()) {
  const d = domainImpact(p);
  const vals = Object.entries(d).filter(([k]) => k !== 'access').map(([, v]) => v).sort((a, b) => b - a);
  const load = (vals[0] ?? 0) * 0.45 + (vals[1] ?? 0) * 0.2 + (vals[2] ?? 0) * 0.1;
  return clamp(Math.round(100 - load));
}

/** In words, for display. */
export const functioningWords = (v) => (v >= 80 ? 'Going well' : v >= 65 ? 'Mostly manageable' : v >= 45 ? 'Harder than usual' : 'A real struggle at the moment');
export const burdenWords = (v) => (v < 12 ? 'Quiet' : v < 30 ? 'Mild' : v < 55 ? 'Moderate' : 'Strong');

/** Stress, sleep, energy and pain move with life and with what a person is living with. */
export function weekWellbeing(p = player()) {
  const h = healthOf(p);
  const d = domainImpact(p);
  const w = h.wellbeing;
  const job = p.career.careerId ? 8 : 0;
  const study = p.education.enrolled ? 6 : 0;
  const money = p.finance.cash < 0 ? 15 : 0;
  const stressTarget = clamp(25 + job + study + money + (d.mood ?? 0) * 0.35 - h.skills.distress * 0.12 - h.skills.coping * 0.08);
  w.stress = Math.round(w.stress + (stressTarget - w.stress) * 0.15);
  w.sleep = Math.round(w.sleep + (clamp(80 - (d.sleep ?? 0) * 0.6 - w.stress * 0.15) - w.sleep) * 0.2);
  w.energy = Math.round(w.energy + (clamp(80 - (d.energy ?? 0) * 0.6 - (100 - w.sleep) * 0.2) - w.energy) * 0.2);
  w.pain = Math.round(w.pain + (clamp((d.pain ?? 0) * 0.7 + (p.conditions.some((c) => c.id === 'back_pain') ? 30 : 0)) - w.pain) * 0.2);
}

/**
 * Once a year, the year's health reaches the mood meter a little. A diagnosis
 * never does this by itself: only what the year was actually like, and only
 * partly, so a person living with a condition can still have a good year.
 */
export function yearMood(p = player()) {
  const d = domainImpact(p);
  const mood = d.mood ?? 0;
  if (mood > 25) p.stats.mood = clamp(p.stats.mood - Math.round((mood - 25) / 8));
  const f = dailyFunctioning(p);
  if (f >= 80 && healthOf(p).conditions.length) p.stats.mood = clamp(p.stats.mood + 1);
}


/**
 * Once a year, long-term physical conditions take their toll on the body, in
 * proportion to how much they are affecting the person after treatment.
 */
export function yearBody(p = player()) {
  for (const rec of presentConditions(healthOf(p))) {
    const def = CONDITION_BY_ID[rec.conditionId];
    if (!def.harm || rec.status !== 'active') continue;
    p.stats.health = clamp(p.stats.health - Math.round(def.harm * rec.burden / 60));
  }
}

/**
 * When a course of cancer treatment ends: remission is likelier the earlier
 * the cancer was found. Decided once, from the person and the course.
 */
export function cancerOutcome(rec, course, p = player()) {
  const stage = rec.stage ?? 2;
  const chance = [0, 0.9, 0.75, 0.5, 0.2][stage] * (0.7 + course.fit * 0.4) * (course.attended / THERAPY_SESSIONS(course));
  if (seeded('cancer', p.id, rec.id, course.id).chance(chance)) {
    rec.status = 'in_remission'; rec.remissionWk = now(p); rec.severity = 5; rec.sevF = 5;
    note(rec, 'In remission after treatment.');
    healthMilestone('Finished cancer treatment, and heard the word remission.', { type: 'remission', id: rec.id }, p, { shareable: true });
    return true;
  }
  rec.severity = Math.max(30, Math.round(rec.severity * 0.7)); rec.sevF = rec.severity;
  note(rec, 'Treatment finished; the cancer is still there. The team talks about what comes next.');
  return false;
}
const THERAPY_SESSIONS = (c) => Math.max(1, c.attended + c.missed);

/** The most serious physical condition, for a cause of death. */
export function seriousCondition(p = player()) {
  if (!p.health) return null;
  const list = presentConditions(p.health).filter((c) => c.status === 'active' && CONDITION_BY_ID[c.conditionId].harm >= 3)
    .map((c) => ({ name: CONDITION_BY_ID[c.conditionId].short, severity: c.burden + (CONDITION_BY_ID[c.conditionId].deadly ? 20 : 0) }));
  return list.sort((a, b) => b.severity - a.severity)[0] ?? null;
}
