// How you measure up, drawn instead of said: two bars, where you are and where they set the bar. No numbers and no
// odds in words; a try-out or an audition can still go either way on the day.
import { esc } from '../util.js';

const width = (x) => Math.max(3, Math.min(100, Math.round(Number(x) || 0)));
const bar = (label, value, cls) => `<div class="fit-row"><span class="fit-label">${esc(label)}</span><span class="fit-track"><i class="${cls}" style="width:${width(value)}%"></i></span></div>`;

/** You against what they look for. `you` and `need` are on a 0–100 scale. */
export function fitBars({ you, need, youLabel = 'You', needLabel = 'What they look for' }) {
  return `<div class="fit-bars" role="img" aria-label="${esc(`${youLabel}, set against ${needLabel.toLowerCase()}`)}">${bar(youLabel, you, 'fit-you')}${bar(needLabel, need, 'fit-need')}</div>`;
}

/** One bar, for how well two things go together (a crowd, a match). */
export const fitBar = (label, value) => `<div class="fit-bars" role="img" aria-label="${esc(label)}">${bar(label, value, 'fit-you')}</div>`;
