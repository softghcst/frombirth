// How long a turn is: a year (the default), six months or three months.
//
// state.settings.step   12 | 6 | 3, months a turn moves the calendar on
// state.month           0..11, how far into the year it is (0 at the turn of the year)
//
// The year itself still happens once, when the calendar turns: pay, tax, school reports, seasons of sport, health,
// birthdays and everything else in engine/yearProcessor.js run exactly as they do with one-year turns. Money and
// records therefore come out the same in every mode. The turns in between move the calendar on and may bring a scene
// written for that part of the year (data/events/seasons.js). They never draw on the game's own dice: their luck is
// keyed to the life and the date, so a shorter turn length changes nothing the year would have done.
import { store, log } from '../state.js';
import { cap } from '../util.js';
import { advanceYear } from './yearProcessor.js';
import { book } from './ledger.js';
import { drawBetween } from './eventEngine.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

export const STEPS = [12, 6, 3];
export const STEP_NAMES = { 12: 'A year', 6: 'Six months', 3: 'Three months' };
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const stepOf = (state = store.state) => (STEPS.includes(state?.settings?.step) ? state.settings.step : 12);
export const monthOf = (state = store.state) => state?.month ?? 0;

/** Countries where the seasons run the other way round. */
const SOUTHERN = new Set(['au', 'nz', 'za', 'ar', 'cl', 'uy', 'py', 'br', 'bo', 'pe', 'na', 'bw', 'zw', 'mz', 'mg', 'ls', 'sz', 'zm', 'mw', 'fj', 'ws', 'to', 'pg']);
const NORTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'];
const FLIP = { winter: 'summer', summer: 'winter', spring: 'fall', fall: 'spring' };
/** The season at a month where the player lives. */
export function seasonAt(month, countryId) {
  const s = NORTH[((month % 12) + 12) % 12];
  return SOUTHERN.has(countryId) ? FLIP[s] : s;
}
export const seasonNow = (state = store.state) => seasonAt(monthOf(state), state.player.countryId);
/**
 * The seasons of a turn: those of the months it covers, the turn ending at `end` (12 for the turn of the year). The
 * first is the one most of the turn was spent in, for headings.
 */
export function turnSeasons(end, step, countryId) {
  const count = {};
  for (let m = end - step; m < end; m++) { const s = seasonAt(m, countryId); count[s] = (count[s] ?? 0) + 1; }
  return Object.keys(count).sort((a, b) => count[b] - count[a]);
}

/** The player's age, with the months when the turns are shorter than a year: "15", or "15 years, 6 months". */
export function ageText(p, state = store.state) {
  const m = monthOf(state);
  if (!m) return `${p.age}`;
  if (p.age === 0) return `${m} months`;
  return `${p.age} ${p.age === 1 ? 'year' : 'years'}, ${m} months`;
}
/** What the next turn brings, for the button: the next age, or the next season. */
export function nextTurnText(state = store.state) {
  const p = state.player;
  const step = stepOf(state);
  const m = monthOf(state) + step;
  if (m >= 12) return { label: step === 12 ? 'Live another year' : `${step === 3 ? 'Three' : 'Six'} more months`, sub: `→ age ${p.age + 1}` };
  return { label: step === 3 ? 'Three more months' : 'Six more months', sub: `→ ${turnSeasons(m, step, p.countryId)[0]}` };
}

/**
 * Sets the turn length. It takes effect at once at the turn of a year; partway through a year, from the next one, so a
 * year is always made of whole turns.
 */
export function setStep(step, state = store.state) {
  if (!STEPS.includes(step)) return result(false, 'That is not one of the turn lengths.', 'neutral');
  state.settings ??= {};
  if (monthOf(state) === 0) {
    state.settings.step = step;
    delete state.settings.nextStep;
    return result(true, `Each turn is now ${STEP_NAMES[step].toLowerCase()}.`, 'neutral');
  }
  if (step === stepOf(state)) { delete state.settings.nextStep; return result(true, `Each turn stays ${STEP_NAMES[step].toLowerCase()}.`, 'neutral'); }
  state.settings.nextStep = step;
  return result(true, `From the start of next year, each turn will be ${STEP_NAMES[step].toLowerCase()}. This year carries on as it began.`, 'neutral');
}

/**
 * One turn. At the turn of the year it is the year itself (advanceYear). Otherwise the calendar moves on, the season
 * changes, and a scene for that time of year may be queued. @returns {{year:boolean, season?:string}}
 */
export function advanceTurn(state = store.state) {
  const p = state.player;
  if (!p.alive) return { year: false };
  const step = stepOf(state);
  const next = monthOf(state) + step;
  if (next >= 12 || step === 12) {
    state.month = 0;
    if (state.settings?.nextStep) { state.settings.step = state.settings.nextStep; delete state.settings.nextStep; }
    advanceYear();
    // With shorter turns, the last part of the year has its season too: perhaps a scene for it, beside the year's own.
    if (step !== 12 && p.alive) drawBetween(step, turnSeasons(12, step, p.countryId), 0.45);
    return { year: true };
  }
  // Anything the player did with money since the last turn is written down before the season changes.
  book({ state, cat: 'auto', src: 'action' });
  state.month = next;
  const seasons = turnSeasons(next, step, p.countryId);
  log(`${cap(seasons[0])}.`, 'season');
  drawBetween(step, seasons);
  return { year: false, season: seasons[0] };
}
