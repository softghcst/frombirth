// School progression by age. Phase 3 adds effort actions, cliques, clubs and
// everything after high school; this module already owns the yearly step.
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { player, log, milestone } from '../state.js';

const STAGES = [
  { stage: 'elementary', start: 5, label: 'elementary school' },
  { stage: 'middle', start: 11, label: 'middle school' },
  { stage: 'high', start: 14, label: 'high school' },
];
const LEAVING_AGE = 18;

export const stageLabel = (stage) =>
  ({ none: 'Not in school', elementary: 'Elementary school', middle: 'Middle school',
    high: 'High school', university: 'University', graduate: 'Graduate school',
    medical: 'Medical school', law: 'Law school' })[stage] ?? stage;

/** GPA (0–4) the player would earn this year from brains and effort. */
function yearGpa(p) {
  const raw = p.stats.intellect * 0.6 + p.hidden.discipline * 0.2 + p.education.effort * 0.2;
  return clamp(raw / 25 + rng.around(0, 0.35), 0, 4);
}

export function tickEducation() {
  const p = player();
  const e = p.education;
  if (e.expelled || e.droppedOut) return;

  const next = STAGES.find((s) => s.start === p.age);
  if (next) {
    e.stage = next.stage;
    e.enrolled = true;
    e.yearInStage = 0;
    log(`You started ${next.label}.`);
    return;
  }
  if (!e.enrolled) return;

  e.yearInStage += 1;
  const g = yearGpa(p);
  e.gpa = e.gpa === 0 ? g : Math.round((e.gpa * 0.6 + g * 0.4) * 100) / 100;
  e.gpa = Math.round(e.gpa * 100) / 100;
  p.stats.intellect = clamp(p.stats.intellect + rng.int(0, 2));

  if (e.stage === 'high' && p.age === LEAVING_AGE) {
    e.enrolled = false;
    e.degrees.push({ type: 'high', gpa: e.gpa, age: p.age });
    log(`You graduated from high school with a ${e.gpa.toFixed(2)} GPA.`, 'system', 'good');
    milestone(`Graduated high school (GPA ${e.gpa.toFixed(2)}).`, 'education');
  }
}
