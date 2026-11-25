// Birthdays: each life is born on a day of its own, and its years run from one birthday to the next.
//
//   p.birthday = { m: 0..11, d: 1..31 }   (never February 29: a leap-day birthday would skip three years in four)
//
// The game's year turns on the player's birthday (engine/yearProcessor.js advanceYear is the birthday), and the
// shorter turns (engine/turns.js) count months from it: state.month is how many months it has been since the last
// birthday. So the date is the birthday plus those months, and the calendar month, for seasons and school terms, is
// the birthday's month plus them. state.year is the year of the last birthday.
//
// A birthday is picked from the life's own id, not with the game's dice, so it draws nothing a seed relies on, and an
// older save given a birthday on loading gets the same one every time. Lives saved before birthdays were kept (on
// January 1) are given one when they load, or, if saved partway through a year, at the next turn of the year.
import { store } from '../state.js';

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** A whole number from a string, the same every time. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A birthday for someone, from their id: any day of the year, each about as likely as any other. */
export function birthdayFor(id) {
  let n = hash(`birthday:${id}`) % 365;
  let m = 0;
  while (n >= DAYS[m]) { n -= DAYS[m]; m += 1; }
  return { m, d: n + 1 };
}

/** The player's birthday: their own, or January 1 until an older life has been given one. */
export const birthdayOf = (p = store.state?.player) => p?.birthday ?? { m: 0, d: 1 };

/** Gives a new life its birthday. */
export function giveBirthday(p) {
  if (!p.birthday) p.birthday = birthdayFor(p.id);
  return p.birthday;
}

const pad = (n) => String(n).padStart(2, '0');
/** "2026-03-14": a date as the game stores it. */
export const isoDate = (year, m, d) => `${year}-${pad(m + 1)}-${pad(Math.min(d, DAYS[m]))}`;

/** The month of the calendar (0 = January) `months` after the last birthday. */
export const calendarMonth = (months = store.state?.month ?? 0, state = store.state) => (birthdayOf(state?.player).m + months) % 12;
/** How many months after the birthday a month of the calendar comes (0 = January): the inverse of calendarMonth. */
export const monthsAfterBirthday = (calMonth, state = store.state) => (((calMonth - birthdayOf(state?.player).m) % 12) + 12) % 12;

/** The date it is now: the last birthday, and the months lived since. */
export function dateNow(state = store.state) {
  const b = birthdayOf(state.player);
  const months = state.month ?? 0;
  const m = b.m + months;
  return isoDate(state.year + Math.floor(m / 12), m % 12, b.d);
}

/** The first day of the year being lived (the last birthday) and its last (the day before the next). */
export function yearSpan(state = store.state) {
  const b = birthdayOf(state.player);
  const start = isoDate(state.year, b.m, b.d);
  const next = new Date(Date.parse(`${isoDate(state.year + 1, b.m, b.d)}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);
  return { start, end: next };
}
/** Which of the player's years a date falls in: the year of the birthday on or before it. */
export function yearOfDate(date, state = store.state) {
  const y = Number(String(date).slice(0, 4));
  const b = birthdayOf(state?.player);
  return String(date).slice(5) < isoDate(y, b.m, b.d).slice(5) ? y - 1 : y;
}

/** "March 14, 2026", or "March 14" without the year. */
export function longDate(date, withYear = true) {
  const [y, m, d] = String(date).split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}${withYear ? `, ${y}` : ''}`;
}
/** The player's date of birth: "March 14, 2011". */
export const birthDate = (p = store.state.player) => longDate(isoDate(p.birthYear, birthdayOf(p).m, birthdayOf(p).d));

/** The star signs, each from the day it begins. */
const SIGNS = [
  [[0, 20], 'Aquarius', '♒'], [[1, 19], 'Pisces', '♓'], [[2, 21], 'Aries', '♈'], [[3, 20], 'Taurus', '♉'], [[4, 21], 'Gemini', '♊'],
  [[5, 21], 'Cancer', '♋'], [[6, 23], 'Leo', '♌'], [[7, 23], 'Virgo', '♍'], [[8, 23], 'Libra', '♎'], [[9, 23], 'Scorpio', '♏'],
  [[10, 22], 'Sagittarius', '♐'], [[11, 22], 'Capricorn', '♑'],
];
/** The star sign of a birthday: { name, symbol }. */
export function starSign(b = birthdayOf()) {
  let sign = SIGNS[SIGNS.length - 1]; // Capricorn runs from December 22 into January
  for (const s of SIGNS) if (b.m > s[0][0] || (b.m === s[0][0] && b.d >= s[0][1])) sign = s;
  return { name: sign[1], symbol: sign[2] };
}
