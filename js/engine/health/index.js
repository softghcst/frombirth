// The health engine's front door: the weekly care tick, the yearly tick, and
// setting a new life's health up at birth.
//
// Order inside a week matters and is fixed:
//   1. appointments that fall this week are attended (or missed), and paid once
//   2. what each appointment decides (assessment, review, monitoring)
//   3. therapy sessions and skills practice
//   4. medication weeks: benefit, side effects, follow-ups, monitoring, prescriptions paid
//   5. the course of each condition, then stress, sleep, energy and pain
//   6. goals and milestones, from what actually happened
// A medicine cannot help before it starts, a change cannot happen before a
// review, and an ended prescription is never charged again.
import { store, player, log } from '../../state.js';
import { CONDITION_BY_ID } from '../../data/health/conditions.js';
import { healthOf, startCondition, migrateHealth, absorbLegacy } from './record.js';
import { WEEKS, now } from './util.js';
import { resolveAppointments, assess, resolveSecondOpinion, tickClinicians, checkGoals, clinicianName, attendNow } from './care.js';
import { medWeek, review, considerStart, attendMonitoring, noticeBetterFit } from './meds.js';
import { therapyWeek, setbacks } from './therapy.js';
import { weekCourse, weekWellbeing, rollOnset, yearMood, yearBody } from './course.js';
import { tickPeopleHealth, legacySummary } from './story.js';
import { genomeOf, bornWith } from './heredity.js';
import { hospitalWeek } from './hospital.js';
import { policyNow } from './insurance.js';

/** One week of care for the player. */
export function careWeek(p = player()) {
  const h = healthOf(p);
  const seen = [];
  hospitalWeek(p);
  for (const a of resolveAppointments(p)) { decideVisit(a, p); seen.push(a); }
  therapyWeek(p);
  medWeek(p);
  setbacks(p);
  weekCourse(p);
  weekWellbeing(p);
  checkGoals(p);
  noticeBetterFit(p);
  h.week = Math.min(WEEKS, (h.week ?? 0) + 1);
  return seen;
}

/** What an attended appointment decides: an assessment, a review, a check. */
function decideVisit(a, p) {
  let text = '';
  if (a.kind === 'assessment') text = assess(a, p).text;
  else if (a.kind === 'review' && a.ref?.startsWith('start:')) text = considerStart(a, p);
  else if (a.kind === 'review' && a.ref?.startsWith('second:')) text = resolveSecondOpinion(a, p);
  else if (a.kind === 'review') text = review(a, p);
  else if (a.kind === 'monitoring') text = attendMonitoring(a, p);
  a.outcome = text || a.outcome;
  if (text && a.kind !== 'assessment') log(text, 'system', 'neutral');
  return a.outcome ?? '';
}

/** An appointment the player chose, attended now. Returns what came of it. */
export function seeNow(appt, p = player()) {
  if (!attendNow(appt, p)) return '';
  return decideVisit(appt, p);
}

/**
 * Lets some weeks pass on the care calendar, inside the current year. The rest
 * of the year (school, work, everything else) still turns at "Live another
 * year"; this only moves health care forward to the next thing that matters.
 * @returns {{weeks:number, appointments:object[]}}
 */
export function passWeeks(n, p = player()) {
  const h = healthOf(p);
  let done = 0;
  const seen = [];
  while (done < n && h.week < WEEKS - 1) { seen.push(...careWeek(p)); done++; }
  return { weeks: done, appointments: seen };
}

/** Weeks until the next booked appointment or session, or null. */
export function nextCareWeek(p = player()) {
  const h = healthOf(p);
  const w = now(p);
  const live = h.trials.filter((t) => ['active', 'adjusted', 'under_review', 'tapering'].includes(t.status));
  const dates = [...h.appointments.filter((a) => a.status === 'booked').map((a) => a.wk),
    ...h.therapies.filter((c) => c.status === 'active').map((c) => c.nextWk),
    // Follow-ups and checks that are planned but not yet booked (they are booked a week ahead).
    ...live.map((t) => t.nextReviewWk), ...live.map((t) => t.nextMonitorWk), ...live.filter((t) => t.status === 'tapering').map((t) => t.taperEnd)]
    .filter((x) => x != null && x >= w);
  return dates.length ? Math.min(...dates) - w : null;
}

/** The weeks of the year that are left, run before the year turns. */
export function finishCareYear(p = player()) {
  const h = healthOf(p);
  while (h.week < WEEKS) careWeek(p);
  // The year turns straight after this (engine/yearProcessor.js): the calendar restarts at its first week.
  h.week = 0;
}

/** After the year has turned: the calendar starts again, and the year's slower changes happen. */
export function healthYear(p = player()) {
  const h = healthOf(p);
  h.week = 0;
  rollOnset(p);
  yearMood(p);
  yearBody(p);
  tickClinicians(p);
  tickPeopleHealth(p);
  policyNow(p);
  const open = h.proposals.filter((x) => x.status === 'open');
  if (open.length) log(`${clinicianName(store.state.npcs[open[0].providerId])} is waiting to hear what you would like to do about your treatment. It is in My Health.`, 'system', 'neutral');
}

/**
 * At birth: the genomes of the family and the child, and what the child is
 * born with. Conditions present at birth are not diagnosed; most will be
 * noticed later, some never. A custom life may choose conditions present from
 * birth (validated), which are then recognized in the usual way.
 * @param {object} state  the new GameState (store.state may still be the old one)
 * @param {{conditions?:string[]}} [custom]
 */
export function healthAtBirth(state, custom) {
  const keep = store.state;
  store.state = state;
  try {
    const p = state.player;
    healthOf(p);
    absorbLegacy(p); // born with weak lungs: asthma, in the health record
    for (const id of p.npcIds) genomeOf(state.npcs[id]);
    const g = genomeOf(p);
    const chosen = (custom?.conditions ?? []).filter((id) => BIRTH_CHOICES.includes(id));
    const ids = custom?.conditions ? chosen : bornWith(g, p.id);
    for (const id of ids) {
      const def = CONDITION_BY_ID[id];
      const shows = def.onset.shows ?? [0, 0];
      const showsAge = shows[0] + (Math.abs(hash(p.id + id)) % (shows[1] - shows[0] + 1));
      startCondition(id, { onsetAge: 0, onsetWk: p.birthYear * WEEKS, showsAge, severity: 30 + (hash(id + p.id) % 30), source: custom?.conditions ? 'custom' : 'birth', note: 'Present from birth.' }, p);
    }
  } finally { store.state = keep; }
}

/** What a custom life can choose to be born with: things present from birth, never adult-onset conditions. */
export const BIRTH_CHOICES = ['adhd', 'autism', 'dyslexia', 'dyscalculia', 'dysgraphia', 'dld', 'tourette', 'intellectual', 'deaf', 'blind', 'cerebral_palsy', 'limb_difference', 'cystic_fibrosis', 'hemophilia_a', 'achondroplasia'];

function hash(s) { let x = 0; for (const ch of s) x = (x * 31 + ch.charCodeAt(0)) | 0; return Math.abs(x); }

/** Carries health over to an heir: their own conditions, as far as they were known; never the parent's notes. */
export function heirHealth(next, heirNpc) {
  const keep = store.state;
  store.state = next;
  try {
    const p = next.player;
    healthOf(p);
    p.genome = heirNpc.genome?.v ? heirNpc.genome : undefined;
    for (const c of heirNpc.health?.conds ?? []) {
      const later = c.age > p.age; // present from birth, not yet showing
      const rec = startCondition(c.id, { onsetAge: later ? 0 : c.age, onsetWk: (p.birthYear + (later ? 0 : c.age)) * WEEKS, showsAge: later ? c.age : null, severity: 35, source: 'carried', note: 'From before you took up this life.' }, p);
      if (c.diagnosed && !later && rec) {
        p.health.diagnoses.push({ id: `dx_h_${rec.id}`, conditionId: c.id, underlyingId: rec.id, status: 'active', wk: rec.onsetWk, providerId: null,
          name: CONDITION_BY_ID[c.id].name, certainty: 'recorded', history: [{ wk: rec.onsetWk, text: 'Diagnosed earlier in life. The details were not kept.' }] });
        rec.dx = 'diagnosed';
      }
    }
  } finally { store.state = keep; }
}

/**
 * What in the player's care needs their attention, if anything: a decision a
 * clinician is waiting on, or an appointment or session this week.
 * @returns {{decision:boolean, short:string, text:string}|null}
 */
export function careWaiting(p = player()) {
  const h = p.health;
  if (!h) return null;
  const open = h.proposals.find((x) => x.status === 'open');
  if (open) {
    const who = store.state.npcs[open.providerId];
    return { decision: true, short: 'a care decision is waiting', text: `${clinicianName(who)} is waiting to hear what you would like to do about your treatment.` };
  }
  const w = now(p);
  if (h.appointments.some((a) => a.status === 'booked' && a.wk <= w)) return { decision: false, short: 'an appointment this week', text: 'You have an appointment this week.' };
  return null;
}

export { migrateHealth, legacySummary };
