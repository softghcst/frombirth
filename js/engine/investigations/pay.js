// Pay beyond the salary, once per year that passed (the career engine pays the salary itself):
//
//   overtime          police officers and detectives are paid for hours past their shifts. Hours
//                     come from the casework actually done in the year (casework.js f.work), at time and a half,
//                     capped; administrative steps cannot be repeated for money (each step is done once)
//   availability pay  federal criminal investigators (FBI, DEA, ATF, Secret Service, HSI, IRS-CI, and deputy US marshals
//                     once reclassified as criminal investigators after the academy) are paid a fixed share of salary
//                     for being available beyond the workweek, instead of overtime
//
// Law enforcement availability pay is 25% of basic pay (OPM fact sheet, checked 2026-11-26); the rest is simplified.
import { localMoney, fmtMoney } from '../../util.js';
import { store, player, country } from '../../state.js';
import { rec, year, working } from './core.js';
import { investigation } from './casework.js';

export const AVAILABILITY = 0.25;
const LEAP = ['fbi', 'dea', 'atf', 'usss', 'hsi', 'irs', 'usms'];
/** What the year that just passed earned beyond salary. Paid once for each year. */
export function payYear(p = player()) {
  const r = rec(p);
  if (!working(r) || ['academy', 'federal_training'].includes(r.stage)) return [];
  const y = year() - 1;
  r.paid ??= {};
  if (r.paid[y]) return [];
  r.paid[y] = true;
  const salary = p.career?.salary ?? 0;
  if (!salary) return [];
  if (r.family === 'federal' && LEAP.includes(r.job.agencyKind)) {
    const pay = Math.round(salary * AVAILABILITY);
    p.finance.cash += pay;
    r.earned = { year: y, kind: 'availability pay', amount: pay };
    return [`Availability pay for ${y}: ${fmtMoney(pay, country())}.`];
  }
  // Hours past the shift: each investigative step past a normal week's share, and patrol for officers.
  const steps = (r.caseIds ?? []).map(investigation).reduce((s, inv) => s + (inv?.file?.work?.[y] ?? 0), 0);
  const hours = Math.max(0, steps - 6) * 8 + (r.job.detective || r.family === 'federal' ? 0 : 40);
  if (!hours) return [];
  const pay = Math.min(Math.round(salary * 0.2), Math.round((salary / 2080) * 1.5 * hours));
  p.finance.cash += pay;
  r.earned = { year: y, kind: 'overtime', amount: pay, hours };
  return [`Overtime for ${y}: ${hours} hours, ${fmtMoney(pay, country())}.`];
}
export { localMoney };
