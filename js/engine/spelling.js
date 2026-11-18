// The game is written in American English. A save made when it used British spellings is converted once, when it
// is loaded: every key, every id and every lowercase word in its text that changed spelling (data/spelling.js).
import { US_SPELLING } from '../data/spelling.js';

const esc = (w) => w.replace(/[-.]/g, (c) => `\\${c}`);
const WORDS = new RegExp(`(?<![A-Za-z0-9_])(${Object.keys(US_SPELLING).sort((a, b) => b.length - a.length).map(esc).join('|')})(?![A-Za-z0-9_])`, 'g');
const fix = (s) => (s.length > 1 ? s.replace(WORDS, (w) => US_SPELLING[w]) : s);

function walk(x) {
  if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) { const v = x[i]; if (typeof v === 'string') x[i] = fix(v); else if (v && typeof v === 'object') walk(v); }
    return;
  }
  for (const k of Object.keys(x)) {
    const v = x[k];
    if (v && typeof v === 'object') walk(v);
    const nv = typeof v === 'string' ? fix(v) : v;
    const nk = fix(k);
    if (nk !== k) { delete x[k]; x[nk] = nv; } else if (nv !== v) x[k] = nv;
  }
}

/** Converts a save to American spellings, once. */
export function americanize(state) {
  if (!state || state.spelling === 'us') return state;
  walk(state);
  state.spelling = 'us';
  return state;
}
