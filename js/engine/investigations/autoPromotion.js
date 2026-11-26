// Every job moves: an officer, detective or agent doing solid work is considered for the next rank each year without
// having to ask (the same review, vacancy and rival as applying, engine/investigations/careers.js seekPromotion), is
// given a step raise each year as public pay scales do, and one doing poor work is warned, then let go.
import { rng } from '../../rng.js';
import { player, log } from '../../state.js';
import { promotionOptions, seekPromotion } from './careers.js';
import { fire } from '../career.js';

/** Once a year, after the year's work. */
export function considerYear(p = player(), r) {
  if (!r?.job || ['academy', 'federal_training'].includes(r.stage)) return;
  const c = p.career;
  if (!c?.careerId) return;
  const perf = c.performance ?? 50;
  // Poor work: a warning first; a second poor year can cost the job.
  if (perf < 40) {
    if (r.warned) { if (rng.chance(0.6)) { fire('fired'); log('After two poor years, the department let you go.', 'system', 'bad'); return; } }
    else { r.warned = true; log('Your supervisor gave you a formal warning about your work. Another year like this, and you may be let go.', 'system', 'bad'); }
  } else if (perf >= 50) r.warned = false;
  // A step raise, as public pay scales give for each year of service done well.
  if (perf >= 50 && c.salary) { const pct = perf >= 75 ? 3 : 2; c.salary = Math.round(c.salary * (1 + pct / 100)); }
  // The next rank, if the record is there: considered without asking.
  if (perf < 45 || r.apps.some((a) => a.kind === 'promotion' && a.status === 'pending')) return;
  const o = promotionOptions(p).find((x) => !x.block);
  if (!o) return;
  r.eligibleYears ??= {};
  const years = (r.eligibleYears[o.id] = (r.eligibleYears[o.id] ?? 0) + 1);
  seekPromotion(o.id);
  // Seniority counts: after years eligible and in good standing, the next opening is theirs, and in time one opens.
  const app = r.apps.filter((a) => a.kind === 'promotion' && a.status === 'pending' && a.rank === o.id).at(-1);
  if (app && years >= 3) app.outcome = 'promoted';
  else if (!app && years >= 4) r.apps.push({ id: `app_seniority_${o.id}_${p.age}`, kind: 'promotion', rank: o.id, filed: r.stats.years, due: 0, status: 'pending', outcome: 'promoted', rivalId: null });
}
