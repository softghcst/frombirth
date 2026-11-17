// Side jobs: part-time work held beside (or instead of) a main job. The
// first part-time job lives in p.career.partTime, as it always has; any more
// go in p.career.sides. Both are paid by the hour, through payroll.
//
//   side: { id, careerId?, jobId?, employerId?, title, place?, hours, salary, since, campus?, perf }
import { rng } from '../rng.js';
import { clamp, uid } from '../util.js';
import { store, player, npcsByRole, log } from '../state.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { PART_TIME_BY_ID } from '../data/partTimeJobs.js';
import { makeNpc } from './npcFactory.js';
import { employer, chronicle } from './employers.js';
import { career as careerState } from './worklife.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

/** Every part-time job the player holds, the original slot first. */
export function allSides() {
  const c = careerState();
  return [...(c.partTime ? [{ ...c.partTime, id: 'pt', slot: true }] : []), ...c.sides];
}

/** A part-time job taken from an opening (engine/hiring.js accept). */
export function takeSide(offer) {
  const p = player();
  const c = careerState();
  const e = employer(offer.employerId);
  const side = { id: uid('side'), careerId: offer.careerId, employerId: offer.employerId, title: offer.title, place: e?.name, hours: offer.hours,
    salary: offer.salary, since: p.age, perf: 50 };
  // A manager to remember you, as with any job.
  const m = makeNpc({ role: 'colleague', countryId: p.countryId, age: rng.int(24, 55), relationship: rng.int(45, 60) });
  m.flags.title = `Manager at ${e?.name ?? 'work'}`;
  m.flags.workedWith = e?.name;
  m.flags.sideOf = side.id;
  m.lastInteractionAge = p.age;
  store.state.npcs[m.id] = m;
  p.npcIds.push(m.id);
  side.managerId = m.id;
  c.sides.push(side);
  p.counters.jobsHeld += 1;
  chronicle(e, `${p.firstName} ${p.lastName} joined as a part-time ${offer.title.toLowerCase()}.`);
  const text = `You start as a part-time ${offer.title.toLowerCase()} at ${e?.name ?? 'a new place'}, ${offer.hours} hours a week. Your manager is ${m.firstName}.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** Leaves one part-time job. id: 'pt' for the original slot, or a side's id. */
export function quitSide(id, exit = 'quit') {
  const p = player();
  const c = careerState();
  if (id === 'pt') {
    if (!c.partTime) return result(false, 'You do not have that job.', 'neutral');
    const j = c.partTime;
    c.history.push({ careerId: j.jobId, title: j.title, from: j.since, to: p.age, exit, kind: 'parttime', employer: j.place });
    c.partTime = null;
    for (const m of npcsByRole('tag:manager')) { m.flags.tag = 'formerManager'; m.flags.title = 'Former manager'; }
    return result(true, `You left your job as ${j.title.toLowerCase()}.`, 'neutral');
  }
  const s = c.sides.find((x) => x.id === id);
  if (!s) return result(false, 'You do not have that job.', 'neutral');
  c.sides = c.sides.filter((x) => x.id !== id);
  c.history.push({ careerId: s.careerId ?? s.jobId, title: s.title, from: s.since, to: p.age, exit, kind: 'side', employerId: s.employerId, employer: s.place });
  const m = store.state.npcs[s.managerId];
  if (m) m.flags.title = 'Former manager';
  const text = `You left your part-time job as ${s.title.toLowerCase()}${s.place ? ` at ${s.place}` : ''}.`;
  log(text);
  return result(true, text, 'neutral');
}

/**
 * Once a year: part-time work builds experience, can lead to a full-time
 * offer, and campus jobs are reviewed when the course ends.
 * @returns {string[]} journal lines
 */
export function tickSides() {
  const p = player();
  const c = careerState();
  const lines = [];
  const studying = p.education.enrolled && ['university', 'community', 'graduate', 'doctorate', 'medical', 'law', 'nursing', 'teaching', 'business', 'dental', 'pharmacy', 'veterinary'].includes(p.education.stage);
  for (const s of allSides()) {
    const base = s.slot ? PART_TIME_BY_ID[s.jobId] : null;
    const track = s.careerId ?? base?.next;
    if (track && CAREER_BY_ID[track]) c.experience[track] = Math.round(((c.experience[track] ?? 0) + Math.min(1, s.hours / 40)) * 10) / 10;
    const campus = s.campus ?? base?.campus;
    if (campus && !studying) {
      // The course is over. Some campus jobs become something more; the rest end.
      const next = base?.next;
      if (next && CAREER_BY_ID[next] && rng.chance(0.4)) {
        (p.flags.standing ??= {})[next] = store.state.year;
        lines.push(`Your course is over, and with it your job as ${s.title.toLowerCase()}. Your supervisor would take you on full-time if you apply.`);
      } else lines.push(`Your course is over, and so is your job as ${s.title.toLowerCase()}: it is only for students.`);
      quitSide(s.id, 'course ended');
      continue;
    }
    // A good part-timer is noticed.
    if (!s.slot) {
      const real = c.sides.find((x) => x.id === s.id);
      real.perf = clamp(Math.round(real.perf + (p.hidden.discipline - 50) / 10 + rng.int(-6, 8)));
      if (real.perf >= 70 && rng.chance(0.1)) { real.salary = Math.round(real.salary * 1.05); lines.push(`Your hourly rate as ${s.title.toLowerCase()} went up.`); }
    }
  }
  return lines;
}
