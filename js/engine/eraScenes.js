// What the eras' scenes do. The scenes are in js/data/events/stories/eras.js; the
// history engine (engine/eras.js) decides when they happen.
import { player } from '../state.js';
import { leaveForWork } from './education.js';

/** Resolves a choice in an era scene. Returns the note added to the outcome text. */
export function decide(value, cast) {
  const p = player();
  const [what, choice] = value.split(':');
  if (what === 'school') {
    if (choice === 'leave') return leaveForWork().text;
    p.hidden.discipline = Math.min(100, p.hidden.discipline + 2);
    return '';
  }
  return '';
}
