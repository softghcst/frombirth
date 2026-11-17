// Small shared pieces for the health engine: the care calendar, money, and
// randomness that belongs to one person and never changes on reload.
import { store, player, country } from '../../state.js';
import { careCost } from '../medical.js';
import { claim } from './insurance.js';

export const WEEKS = 52;

/**
 * The care calendar. The rest of the game moves a year at a time; health care
 * moves a week at a time inside that year. A date is one number, an absolute
 * week: year * 52 + week. The week inside the current year is kept on the
 * player's health record and returns to 0 when the year turns.
 */
export const now = (p = player()) => store.state.year * WEEKS + (p.health?.week ?? 0);
export const yearOf = (wk) => Math.floor(wk / WEEKS);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "March 2031" for an absolute week. */
export const when = (wk) => `${MONTHS[Math.min(11, Math.floor((wk % WEEKS) / (WEEKS / 12)))]} ${yearOf(wk)}`;
/** "in 3 weeks", "this week", "2 weeks ago". */
export function rel(wk, from = now()) {
  const d = wk - from;
  if (d === 0) return 'this week';
  if (d === 1) return 'next week';
  if (d > 0) return `in ${d} weeks`;
  return d === -1 ? 'last week' : `${-d} weeks ago`;
}

/** A stable hash of any strings, for randomness that belongs to one person or one course of treatment. */
export function hashOf(...parts) {
  let h = 2166136261;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** A seeded generator (mulberry32) that does not touch the game's own dice. */
export function seeded(...parts) {
  let s = hashOf(...parts) || 1;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    chance: (p) => next() < p,
    range: (a, b) => a + next() * (b - a),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** Standard normal (Box–Muller). */
    normal() { const u = Math.max(1e-12, next()); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next()); },
  };
}

/** The value below which a share p of a standard normal lies (Acklam's approximation). */
export function probit(p) {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const lo = 0.02425;
  if (p < lo) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - lo) return -probit(1 - p);
  const q = p - 0.5; const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

let n = 0;
/** Ids that stay unique within a save and say what they are. */
export const hid = (kind) => `${kind}_${store.state.year.toString(36)}${(now() % WEEKS).toString(36)}${Date.now().toString(36).slice(-4)}${(n++).toString(36)}`;

/**
 * Charges the patient for one thing, once. `ref` names exactly what is being paid
 * for (a session, a month of a prescription); paying the same ref twice does
 * nothing, so a reload or a repeated tick can never charge again.
 * @returns {number} what was paid
 */
export function charge(ref, base, opts = {}) {
  const p = player();
  const h = p.health;
  if (h.ledger.some((x) => x.ref === ref)) return 0;
  const share = base <= 0 ? 0 : Math.round(careCost(base) * (opts.fee ?? 1));
  // Every bill is a claim: what was billed, what the insurer paid, what the patient paid.
  const amount = base <= 0 ? 0 : claim(ref, base, share, opts);
  h.ledger.push({ ref, wk: now(), amount, what: opts.what ?? ref });
  if (h.ledger.length > 600) h.ledger.splice(0, h.ledger.length - 600);
  p.finance.cash -= amount;
  return amount;
}

/** What one item would cost the patient, before paying. */
export const priceOf = (base, fee = 1) => (base <= 0 ? 0 : Math.round(careCost(base) * fee));

export const cty = () => country();
export const yearNow = () => store.state.year;
