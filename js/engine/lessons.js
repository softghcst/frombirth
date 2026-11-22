// Lessons (data/lessons.js): a child asks a parent, who says yes or no by what the family can afford, how generous
// they are and how things are between them, and pays if yes; an adult signs up and pays. A year of lessons makes the
// player a little better at something, less so the better they already are. A few a year, each once a year.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, log } from '../state.js';
import { book } from './ledger.js';
import { spendable, takeFrom } from './npcMoney.js';
import { guardians } from './childhood.js';
import { LESSONS, LESSON_BY_ID, LESSONS_A_YEAR } from '../data/lessons.js';

const result = (ok, text, tone = ok ? 'good' : 'neutral') => ({ ok, text, tone });
const L = () => (player().flags.lessons ??= { taken: {}, year: {} });
const thisYear = () => { const l = L(); if (l.year.age !== player().age) l.year = { age: player().age, ids: [] }; return l.year; };
const cost = (lesson) => localMoney(lesson.cost, country());

/** Whether a child asks a parent (true) or an adult pays for themselves. */
export const asksParents = (p = player()) => p.age < 18 && guardians().length > 0;

/** The lessons open at this age, in this year, with why any cannot be taken. */
export function lessonOptions() {
  const p = player();
  const y = thisYear();
  return LESSONS.filter((l) => p.age >= l.ages[0] && p.age <= l.ages[1] && store.state.year >= (l.from ?? 0)).map((l) => ({
    id: l.id, name: l.name, emoji: l.emoji, cost: cost(l), years: L().taken[l.id] ?? 0,
    why: y.ids.includes(l.id) ? 'Done this year' : y.ids.length >= LESSONS_A_YEAR ? 'Enough lessons this year' : '',
  }));
}
/** The youngest age any lesson is open at. */
export const LESSON_AGE = Math.min(...LESSONS.map((l) => l.ages[0]));

/** Asks for (or signs up for) a year of one. */
export function takeLesson(id) {
  const p = player();
  const lesson = LESSON_BY_ID[id];
  const opt = lessonOptions().find((o) => o.id === id);
  if (!lesson || !opt) return result(false, 'That is not open to you now.');
  if (opt.why) return result(false, `${opt.why}.`);
  const price = opt.cost;
  if (asksParents(p)) {
    // The parent who can best afford it is asked. Money, generosity and closeness decide.
    const parent = guardians().sort((a, b) => spendable(b) - spendable(a))[0];
    const afford = spendable(parent) >= price * 2;
    const chance = clamp(0.45 + (parent.meters.generosity - 50) / 140 + (parent.meters.relationship - 50) / 180 + (afford ? 0.25 : -0.4) - (lesson.cost > 1000 ? 0.1 : 0), 0.04, 0.95);
    thisYear().ids.push(id); // asked: once a year, whatever the answer
    if (!rng.chance(chance) || spendable(parent) < price) {
      const text = afford ? `${parent.firstName} says no to ${lesson.name.toLowerCase()} this year. "Ask me again next year."` : `${parent.firstName} says there is not the money for ${lesson.name.toLowerCase()} just now.`;
      log(text, 'system', 'neutral');
      return result(false, text);
    }
    takeFrom(parent, price);
    return finish(lesson, `${parent.firstName} agreed to pay for ${lesson.name.toLowerCase()} (${fmtMoney(price, country())}).`);
  }
  if (p.finance.cash < price) return result(false, `A year of ${lesson.name.toLowerCase()} costs ${fmtMoney(price, country())}. You do not have it.`);
  p.finance.cash -= price;
  book({ cat: 'leisure', src: 'action', desc: lesson.name });
  thisYear().ids.push(id);
  return finish(lesson, `You signed up for ${lesson.name.toLowerCase()} (${fmtMoney(price, country())}).`);
}

function finish(lesson, opening) {
  const p = player();
  const l = L();
  l.taken[lesson.id] = (l.taken[lesson.id] ?? 0) + 1;
  const gained = [];
  for (const [path, base] of Object.entries(lesson.grows)) {
    const [group, key] = path.split('.');
    const now = p[group][key] ?? 0;
    // A year adds less the better someone already is, and never nothing.
    const add = group === 'stats' && key === 'mood' ? base : Math.max(1, Math.round(base * (1 - now / 130) + rng.int(-1, 1)));
    p[group][key] = clamp(now + add);
    if (group === 'talents') gained.push(key);
  }
  const years = l.taken[lesson.id];
  const text = `${opening} ${years === 1 ? 'A first year of it.' : `${years} years of it now.`}${gained.length ? ` You are a little better at ${gained.join(' and ')}.` : ''}`;
  log(text, 'system', 'good');
  return result(true, text);
}
