// What lenders know about the player.
//
// This is a Pathways game measure. It is invented, it is simple on purpose,
// and it is not any real credit score: nothing here predicts what a real
// lender would do. Different places keep different records (data/money.js):
// some share a full file, some only write down serious trouble, and some keep
// no shared record at all, in which case there is no number to show.
//
// Everything is built from things that actually happened in this life: the
// debts in the ledger, and the marks left by going overdrawn, having things
// sold to cover a debt, or going bankrupt.
//   p.finance.credit = { marks: [{ year, age, kind }], onTime: years, since: year }
import { store, player } from '../state.js';
import { CREDIT_MODEL_OF, CREDIT_MODELS } from '../data/money.js';

const SERIOUS = { forcedSale: 1, bankruptcy: 1 };
const MARK_NAMES = { overdraft: 'Went overdrawn', forcedSale: 'Possessions sold to cover debts', bankruptcy: 'Declared bankrupt' };
export const markName = (kind) => MARK_NAMES[kind] ?? kind;

export const creditModelOf = (countryId = player().countryId) => CREDIT_MODEL_OF[countryId] ?? 'bank';
const record = (p = player()) => (p.finance.credit ??= { marks: [], onTime: 0, since: null });

/** Writes down something a lender would remember. The record follows the person, wherever they work or live. */
export function mark(kind) {
  const p = player();
  const r = record(p);
  r.marks.push({ year: store.state.year, age: p.age, kind });
  if (r.marks.length > 40) r.marks.shift();
}

/** A year in which debts were owed and nothing went wrong. */
export function goodYear() {
  const r = record();
  r.onTime += 1;
  r.since ??= store.state.year;
}

/** Serious trouble in the last few years, where anyone keeps a record of it. */
export function recentDefault(years = 5) {
  if (creditModelOf() === 'bank') return false;
  const y = store.state.year;
  return (player().finance.credit?.marks ?? []).some((m) => SERIOUS[m.kind] && y - m.year < years);
}

/**
 * The player's standing with lenders.
 * @param {{income:number, service:number}} now  yearly income and yearly repayments, in local money
 * @returns {{model:string, name:string, line:string, standing:?number, band:?string, marks:object[], onTime:number}}
 *   standing is 0 to 100, and null where no number exists or there is no history yet
 */
export function standing(now = { income: 0, service: 0 }) {
  const p = player();
  const model = creditModelOf(p.countryId);
  const r = p.finance.credit ?? { marks: [], onTime: 0, since: null };
  const y = store.state.year;
  const base = { model, ...CREDIT_MODELS[model], marks: r.marks, onTime: r.onTime, standing: null, band: null };
  if (model === 'bank') return base;
  const recent = (kind, years) => r.marks.filter((m) => m.kind === kind && y - m.year < years).length;
  if (model === 'registry') {
    const listed = recent('forcedSale', 7) + recent('bankruptcy', 7) > 0;
    return { ...base, band: listed ? 'Listed' : 'Clear' };
  }
  if (!r.marks.length && !r.onTime) return { ...base, band: 'No record yet' };
  let s = 50 + Math.min(30, r.onTime * 2) + Math.min(10, r.since == null ? 0 : y - r.since);
  s -= recent('bankruptcy', 7) * 30 + recent('forcedSale', 7) * 15 + recent('overdraft', 3) * 5;
  if (now.income > 0 && now.service / now.income > 0.35) s -= 10;
  s = Math.max(0, Math.min(100, Math.round(s)));
  return { ...base, standing: s, band: s >= 80 ? 'Excellent' : s >= 65 ? 'Good' : s >= 45 ? 'Fair' : s >= 25 ? 'Poor' : 'Very poor' };
}
