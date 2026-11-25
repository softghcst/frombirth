// Birthdays: a life is born on a day of its own; each age comes on that day a year later, and shorter turns move the
// date on by three or six months; the star sign matches the date; the seasons, the storms and the travel calendar all
// keep to the year as it is lived, from one birthday to the next. Run with: node tests/birthday.mjs
import { store } from '../js/state.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceTurn, setStep, seasonNow } from '../js/engine/turns.js';
import { birthdayFor, starSign, dateNow, yearSpan, yearOfDate, birthDate, calendarMonth } from '../js/engine/birthday.js';
import { weatherOf, lifeWeather } from '../js/engine/disasters.js';
import { today } from '../js/engine/documents.js';

const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); };
const life = (o = {}) => { for (;;) { store.state = createLife({ countryId: 'us', city: 'Chicago', ...o }); if (!store.state.player.royal) return store.state.player; } };

// Every day of the year can be a birthday, and none is February 29.
const months = new Set(); const days = new Set();
for (let i = 0; i < 3000; i++) { const b = birthdayFor(`x${i}`); months.add(b.m); days.add(`${b.m}-${b.d}`); check(!(b.m === 1 && b.d > 28), `no February ${b.d}`); }
check(months.size === 12 && days.size > 340, `birthdays fall all through the year (${days.size} days seen)`);

// A new life has a birthday, says it, and its first year starts on it.
let p = life();
check(!!p.birthday, 'a new life has a birthday');
check(store.state.journal[0].text.includes(`born on ${birthDate(p)}`), `the life story opens on the birthday (${store.state.journal[0].text})`);
check(today() === dateNow() && dateNow().endsWith(`-${String(p.birthday.m + 1).padStart(2, '0')}-${String(p.birthday.d).padStart(2, '0')}`), `the calendar starts on the birthday (${today()})`);

// Star signs, at their edges.
const sign = (m, d) => starSign({ m, d }).name;
check(sign(0, 1) === 'Capricorn' && sign(0, 20) === 'Aquarius' && sign(2, 20) === 'Pisces' && sign(2, 21) === 'Aries' && sign(6, 23) === 'Leo' && sign(11, 21) === 'Sagittarius' && sign(11, 22) === 'Capricorn', 'star signs change on the right days');

// Each age on the birthday; six-month and three-month turns move the date on by those months.
p = life({ birthday: { m: 7, d: 23 } });
const y0 = store.state.year;
advanceTurn();
check(dateNow() === `${y0 + 1}-08-23` && p.age === 1, `a year on, the same day (${dateNow()}, age ${p.age})`);
setStep(6);
advanceTurn();
check(dateNow() === `${y0 + 2}-02-23` && p.age === 1, `six months on: February 23 of the next year, still 1 (${dateNow()})`);
check(today() === `${y0 + 1}-08-23` || today() >= `${y0 + 1}-08-23`, 'the travel calendar has not gone backward');
advanceTurn();
check(dateNow() === `${y0 + 2}-08-23` && p.age === 2, `and six more: the birthday again, age 2 (${dateNow()})`);
setStep(3);
advanceTurn();
check(dateNow() === `${y0 + 2}-11-23`, `three months on: November 23 (${dateNow()})`);

// The seasons follow the date: born in August in Chicago, a birthday comes in summer.
p = life({ birthday: { m: 7, d: 10 } });
check(seasonNow() === 'summer' && calendarMonth(0) === 7, `an August birthday is in summer (${seasonNow()})`);
p = life({ birthday: { m: 0, d: 10 } });
check(seasonNow() === 'winter', `a January birthday is in winter (${seasonNow()})`);

// The year's storms are those from one birthday to the next, across two calendar years.
p = life({ birthday: { m: 5, d: 1 }, countryId: 'jp', city: 'Tokyo' });
const yr = store.state.year;
const mine = lifeWeather('jp', yr).map((e) => e.id).sort();
const want = [...weatherOf('jp', yr).filter((e) => e.month >= 5), ...weatherOf('jp', yr + 1).filter((e) => e.month < 5)].map((e) => e.id).sort();
check(JSON.stringify(mine) === JSON.stringify(want), 'the year of a life holds the storms from June to the next May');
check(lifeWeather('jp', yr).every((e) => e.lm === (e.month - 5 + 12) % 12), 'and counts their months from the birthday');

// The travel year runs from the birthday to the day before the next.
const span = yearSpan();
check(span.start === `${yr}-06-01` && span.end === `${yr + 1}-05-31`, `the travel year runs June 1 to May 31 (${span.start} to ${span.end})`);
check(yearOfDate(`${yr + 1}-03-01`) === yr && yearOfDate(`${yr + 1}-06-01`) === yr + 1, 'a date in March belongs to the year begun last June');

// A life saved before birthdays were kept carries on from January 1.
p = life();
delete p.birthday;
check(yearSpan().start === `${store.state.year}-01-01` && birthDate(p).startsWith('January 1,'), 'an older life without a birthday reads as January 1');
// Loaded, it is given a day of its own (the same every load); saved mid-year, at its next turn of the year.
{
  const { saveGame, peekGame } = await import('../js/save.js');
  const mem = new Map();
  globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  saveGame(store.state);
  const back = peekGame(store.state.slotId);
  {
    const q = back.player;
    check(JSON.stringify(q.birthday) === JSON.stringify(birthdayFor(q.id)), 'an older life, loaded, gets its own birthday');
  }
  const r = life(); delete r.birthday; setStep(6); advanceTurn();
  check(!r.birthday, 'mid-year, an older life waits for the turn of the year');
  store.state.pendingEvents = []; advanceTurn();
  check(JSON.stringify(r.birthday) === JSON.stringify(birthdayFor(r.id)), 'and gets its birthday when the year turns');
}

if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('Every life has its own birthday, and its years run from it.');
