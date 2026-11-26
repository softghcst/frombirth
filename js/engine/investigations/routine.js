// The groundwork of a case file, in one step: the scene documentation, the specialist or examiner, and records that
// need no court order. Interviews, people of interest, laboratory requests and court orders stay with the player: they
// are judgment. Uses engine/investigations/casework.js as any screen would, hour by hour.
import { investigation, steps, act, workLeft } from './casework.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const ROUTINE = ['scene', 'specialist', 'examiner', 'records', 'urgency', 'family', 'search', 'support'];

/** The groundwork steps open on this file now. */
export function groundworkSteps(invId) {
  const inv = investigation(invId);
  return inv ? steps(inv).filter((s) => ROUTINE.includes(s.id) && !s.needsAuth) : [];
}
/** Does the groundwork, while there are hours for it this year. */
export function groundwork(invId) {
  const inv = investigation(invId);
  if (!inv) return result(false, 'There is no such file.', 'neutral');
  const done = [];
  for (const s of groundworkSteps(invId)) {
    if (workLeft(inv) <= 0) break;
    const r = act(invId, s.id);
    if (r.ok) done.push(s.label.replace(/^./, (x) => x.toLowerCase()));
  }
  if (!done.length) return result(false, workLeft(inv) <= 0 ? 'No hours left on this case this year.' : 'The groundwork is done.', 'neutral');
  return result(true, `Groundwork done: ${done.join('; ')}. The interviews and the hard calls are yours.`, 'good', { done });
}
