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

export function fmtMoney(amount, country) {
  const n = Math.round(amount);
  const body = Math.abs(n).toLocaleString('en-US');
  return `${n < 0 ? '-' : ''}${country.currency.symbol}${body}`;
}

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
