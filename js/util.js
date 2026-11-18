export const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/**
 * A new id. While a life is being played, ids come from a counter saved with that life (with a tag for its save slot,
 * so they never meet ids from another life or the random ids of older saves): living the same year again after a
 * reload makes the same people with the same ids, and so the same luck. Otherwise, a random id.
 */
let idSource = () => null;
export const setIdSource = (fn) => { idSource = fn; };
export const uid = (prefix = 'id') => {
  const t = idSource();
  if (t?.slotId) {
    t.idSeq = (t.idSeq ?? 0) + 1;
    let h = 0; for (const ch of t.slotId) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
    return `${prefix}_q${h.toString(36).slice(0, 5)}${t.idSeq.toString(36)}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
};

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
