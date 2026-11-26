// Officer wellbeing. The work weighs on people: deaths and what is left after them, undercover months, a blown
// cover, complaints, long hours. Strain builds over a career and eases with support, with leave, with time.
//
//   peer support   colleagues trained to listen; nothing goes to the chain of command
//   counseling     confidential, with a psychologist; the department learns only fitness for duty, and only with
//                  the officer's knowledge (the same rule forensicPsych.js keeps)
//   leave          time away; cases wait, a little
// High strain costs health, then judgment. Years of it can end a career early, on a medical retirement.
import { clamp } from '../../util.js';
import { store, player } from '../../state.js';
import { endJob, pensionEstimate } from '../career.js';
import { rec, now, year, result, grow, regard, working, note, once } from './core.js';
import { investigation } from './casework.js';
import { jobEnded } from './careers.js';

const W8 = (r) => { r.wellbeing ??= { strain: 10, high: 0, log: [], support: [] }; return r.wellbeing; };
/** Adds strain from something that happened (called by the work that causes it). */
export function strain(n, why, p = player()) {
  const r = rec(p);
  if (!r) return 0;
  const w = W8(r);
  w.strain = clamp(w.strain + n);
  w.log.push({ year: year(), why, n });
  if (w.log.length > 30) w.log.splice(0, w.log.length - 30);
  return w.strain;
}
export const strainOf = (p = player()) => (rec(p)?.wellbeing?.strain ?? 0);
export const level = (s) => (s >= 85 ? 'At breaking point' : s >= 70 ? 'Heavy' : s >= 45 ? 'Building' : s >= 20 ? 'Manageable' : 'Light');

export const SUPPORT = {
  peer: { label: 'Talk to the peer support team', sub: 'Colleagues trained to listen. Nothing goes up the chain.', ease: 12 },
  counseling: { label: 'See a counselor, confidentially', sub: 'The department learns only whether you are fit for duty.', ease: 20 },
  leave: { label: 'Take some leave', sub: 'Time away. Your cases wait a little.', ease: 28 },
};
export function seekSupport(kind, p = player()) {
  const r = rec(p);
  const d = SUPPORT[kind];
  if (!working(r) || !d) return result(false, 'This is for serving officers.', 'neutral');
  if (!once(`support:${kind}`, r)) return result(false, 'You did that this year.', 'neutral');
  const w = W8(r);
  w.strain = clamp(w.strain - d.ease);
  w.support.push({ year: year(), kind });
  if (kind === 'peer') { grow('teamwork', 1); regard('teamwork', 1); }
  if (kind === 'leave') for (const id of r.caseIds) { const f = investigation(id)?.file; if (f && !f.outcome) { f.extra ??= {}; f.extra[year()] = (f.extra[year()] ?? 0) - 1; } }
  p.stats.health = clamp(p.stats.health + (kind === 'leave' ? 3 : 1));
  return result(true, { peer: 'A colleague who has been there listens for an hour. It helps more than you expected.', counseling: 'The sessions are yours. Nobody at work hears what you say in them.', leave: 'Two weeks away. The cases are there when you get back.' }[kind]);
}

/** The year: the load of the work, and what strain does when it stays high. */
export function wellbeingYear(p = player()) {
  const r = rec(p);
  if (!working(r) || ['academy', 'federal_training'].includes(r.stage)) return [];
  const w = W8(r);
  const out = [];
  const deaths = r.caseIds.map(investigation).filter((x) => x?.file && !x.file.outcome && ['homicide', 'collision', 'family'].includes(x.file.template)).length;
  const open = r.caseIds.map(investigation).filter((x) => x?.file && !x.file.outcome).length;
  const complaints = Object.values(store.state.investigations?.complaints ?? {}).filter((c) => c.subjectId === p.id && c.status === 'open').length;
  strain(deaths * 6 + Math.max(0, open - 2) * 3 + complaints * 5, 'the year\'s work', p);
  w.strain = clamp(w.strain - 6); // time, and life outside work
  if (w.strain >= 70) {
    p.stats.health = clamp(p.stats.health - 3);
    p.career.performance = clamp((p.career.performance ?? 50) - 3);
    w.high += 1;
    out.push('The work is weighing on you: sleep is short, and patience shorter.');
  } else w.high = 0;
  if (w.high >= 3 && !w.offered) { w.offered = year(); out.push('Your doctor and your sergeant both say it: this cannot go on. A medical retirement is possible.'); }
  return out;
}
/** A medical retirement, after years at breaking point: the career ends, with its pension. */
export function medicalRetirement(p = player()) {
  const r = rec(p);
  const w = r?.wellbeing;
  if (!working(r) || !w?.offered) return result(false, 'That is not on offer.', 'neutral');
  const pension = pensionEstimate();
  jobEnded(p, r, 'retired');
  endJob('retired');
  p.career.retired = true;
  p.career.pensionPerYear = Math.max(p.career.pensionPerYear ?? 0, pension);
  w.strain = clamp(w.strain - 40);
  note('Took a medical retirement after years of strain.', 'career', { key: `medretire:${year()}`, milestone: 'Retired on medical grounds' });
  return result(true, 'You hand in the badge. It is not a failure; it is a person who gave the job what they had. The pension is yours.');
}
