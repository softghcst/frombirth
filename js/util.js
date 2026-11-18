export const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

let idCounter = null;
export const uid = (prefix = 'id') => (idCounter == null
  ? `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  : `${prefix}_t${(idCounter++).toString(36)}`);
/**
 * For tests: ids from a counter instead of the clock, so a seeded run makes the same ids, and anything decided from an
 * id (a face, a pace) comes out the same every time. The game never calls this.
 */
export const countedIds = (from = 1) => { idCounter = from; };

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Round a currency amount to something that reads naturally. */
export function niceRound(v) {
  const a = Math.abs(v);
  if (a < 100) return Math.round(v);
  const mag = 10 ** (Math.floor(Math.log10(a)) - 2);
  return Math.round(v / mag) * mag;
}

/** Convert a base (USD-like) amount into the country's local money. */
export const localMoney = (base, country) => niceRound(base * country.currency.scale);
/** Pay: a base amount at the country's wage level. Use for salaries, stipends and anything earned locally. */
export const localWage = (base, country) => niceRound(base * country.currency.scale * (country.living?.wageK ?? 1));
/** Local prices: rent, bills, services, tuition, houses. Imported things (cars, flights) use localMoney. */
export const localCost = (base, country) => niceRound(base * country.currency.scale * (country.living?.costK ?? 1));

export function fmtMoney(amount, country) {
  const n = Math.round(amount);
  const body = Math.abs(n).toLocaleString('en-US');
  return `${n < 0 ? '-' : ''}${country.currency.symbol}${body}`;
}

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** "the United Kingdom", but "Japan". */
export const theCountry = (name) => (/^(United|Netherlands|Philippines|Dominican)/.test(name) ? `the ${name}` : name);
