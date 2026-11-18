export const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

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
/** What a sum earned in one country (at its wage level) is worth in another's money: for sales and shows abroad paid at home. */
export const wageIn = (base, where, payIn) => base * (where.living?.wageK ?? 1) * payIn.currency.scale;
/** Pay: a base amount at the country's wage level. Use for salaries, stipends and anything earned locally. */
export const localWage = (base, country) => niceRound(base * country.currency.scale * (country.living?.wageK ?? 1));
/** Local prices: rent, bills, services, tuition, houses. Imported things (cars, flights) use localMoney. */
export const localCost = (base, country) => niceRound(base * country.currency.scale * (country.living?.costK ?? 1));

// Money is kept at today's values; a life in the past sees it at the prices of its year (data/history.js).
let yearOf = () => null;
let index = null;
/** Lets money be shown at the prices of the game's year (state.js tells it where the year is). */
export const setYearSource = (fn) => { yearOf = fn; };
/** Prices in a year as a share of today's: 1 from the present on. */
export function priceLevel(year) {
  if (!index || year == null || year >= index.present) return 1;
  const t = index.table;
  if (year <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (year <= t[i][0]) { const [y0, v0] = t[i - 1]; const [y1, v1] = t[i]; return v0 + (v1 - v0) * (year - y0) / (y1 - y0); }
  return 1;
}
export const setPriceIndex = (table, present) => { index = { table, present }; };

export function fmtMoney(amount, country) {
  const k = priceLevel(yearOf());
  const v = amount * k;
  // Small sums in the past keep their pennies: a loaf was not free in 1950.
  if (k < 1 && Math.abs(v) < 100 && Math.abs(v) > 0) {
    const body = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${v < 0 ? '-' : ''}${country.currency.symbol}${body}`;
  }
  const n = Math.round(v);
  const body = Math.abs(n).toLocaleString('en-US');
  return `${n < 0 ? '-' : ''}${country.currency.symbol}${body}`;
}

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** "the United Kingdom", but "Japan". */
export const theCountry = (name) => (/^(United|Netherlands|Philippines|Dominican)/.test(name) ? `the ${name}` : name);
