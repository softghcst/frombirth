// Money in more than one currency.
//
// The player's everyday money (p.finance.cash) is always in the currency of
// the country they live in. Beyond that they can hold balances in other
// currencies:
//   p.finance.accounts   { 'MXN': 250000, 'USD': 1200 }   whole units of each currency
//   p.finance.fxLog      [{ year, from, to, paid, received, rate, fee }]   every exchange, with the rate used
//   state.fx             { 'MXN': 1.03 }   how far each currency has drifted from its starting rate
//
// RATES ARE FICTIONAL. Each currency has a fixed starting rate (the `scale`
// in data/countries.js) and wanders a few per cent a year around it. They are
// simulation rates, not market quotes, and the game never presents them as
// real. Amounts are whole units; every conversion rounds down, so money is
// never created by exchanging it.
import { rng } from '../rng.js';
import { clamp, fmtMoney } from '../util.js';
import { store, player, country, log } from '../state.js';
import { COUNTRY_LIST } from '../data/countries.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
/** What a bank keeps when it changes money. */
export const FX_FEE = 0.015;
const LOG_MAX = 40;

/** One record per currency: the first place that uses it stands for it. */
const BY_CODE = {};
for (const c of COUNTRY_LIST) BY_CODE[c.currency.code] ??= { code: c.currency.code, symbol: c.currency.symbol, scale: c.currency.scale, home: c };
export const currencyOf = (code) => BY_CODE[code] ?? null;
export const currencies = () => Object.values(BY_CODE).sort((a, b) => a.code.localeCompare(b.code));
/** Formats an amount in any currency. */
export const fmt = (amount, code) => (BY_CODE[code] ? fmtMoney(amount, { currency: BY_CODE[code] }) : `${Math.round(amount)} ${code}`);

/** Units of a currency per base unit, today. */
export const unitsPerBase = (code) => (BY_CODE[code]?.scale ?? 1) * (store.state?.fx?.[code] ?? 1);
/** How many units of `to` one unit of `from` buys today, before fees. */
export const rate = (from, to) => unitsPerBase(to) / unitsPerBase(from);
/** An amount in one currency, in another, at today's rate. Rounds down. */
export const convert = (amount, from, to) => (from === to ? Math.floor(amount) : Math.floor(amount * rate(from, to)));

/** Yearly: currencies drift a little, and are pulled back towards where they started. */
export function tickFx() {
  const fx = (store.state.fx ??= {});
  for (const code of Object.keys(BY_CODE)) {
    const now = fx[code] ?? 1;
    const next = clamp(now * (1 + rng.around(0, 0.025)) + (1 - now) * 0.08, 0.7, 1.4);
    fx[code] = Math.round(next * 10000) / 10000;
  }
}

const home = () => country().currency.code;
const accounts = () => (player().finance.accounts ??= {});
/** Every balance the player holds: everyday money first, then each foreign account, with what it is worth at home. */
export function balances() {
  const p = player();
  const h = home();
  const list = [{ code: h, amount: Math.round(p.finance.cash), home: true, worth: Math.round(p.finance.cash) }];
  for (const [code, amount] of Object.entries(p.finance.accounts ?? {})) if (amount > 0 && code !== h) list.push({ code, amount, home: false, worth: convert(amount, code, h) });
  return list;
}
/** What all foreign accounts are worth in everyday money, at today's rate and before fees. */
export const foreignWorth = (p = player()) => Object.entries(p.finance.accounts ?? {}).reduce((s, [code, n]) => s + (code === home() ? n : convert(n, code, home())), 0);

/**
 * Changes money from one currency the player holds into another.
 * Either side may be the everyday currency. The bank keeps a fee; the rate used is written down.
 */
export function exchange(from, to, amount) {
  const p = player();
  const h = home();
  amount = Math.floor(amount);
  if (!BY_CODE[from] || !BY_CODE[to] || from === to) return result(false, 'There is nothing to exchange there.', 'neutral');
  if (!(amount > 0)) return result(false, 'Choose an amount.', 'neutral');
  const have = from === h ? Math.floor(p.finance.cash) : accounts()[from] ?? 0;
  if (amount > have) return result(false, `You have ${fmt(have, from)}.`, 'neutral');
  const r = rate(from, to);
  const gross = amount * r;
  const received = Math.floor(gross * (1 - FX_FEE));
  if (received < 1) return result(false, 'That is too little to be worth changing.', 'neutral');
  if (from === h) p.finance.cash -= amount; else accounts()[from] -= amount;
  if (to === h) p.finance.cash += received; else accounts()[to] = (accounts()[to] ?? 0) + received;
  if (accounts()[from] === 0) delete accounts()[from];
  const entry = { year: store.state.year, from, to, paid: amount, received, rate: Math.round(r * 1e6) / 1e6, fee: Math.floor(gross) - received };
  (p.finance.fxLog ??= []).push(entry);
  if (p.finance.fxLog.length > LOG_MAX) p.finance.fxLog.shift();
  const text = `You changed ${fmt(amount, from)} into ${fmt(received, to)}. The bank kept ${fmt(entry.fee, to)}.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/**
 * Moving country: everyday money follows the player into the new currency,
 * except a share they choose to leave behind in the old one.
 * Call before the rest of the player's money is converted.
 * @param {number} keep  0 to 1: the share of cash to leave in the old currency
 * @returns {number} the amount set aside, in the old currency
 */
export function setAside(keep, oldCode) {
  const p = player();
  const amount = Math.floor(Math.max(0, p.finance.cash) * clamp(keep ?? 0, 0, 1));
  if (amount > 0) { p.finance.cash -= amount; accounts()[oldCode] = (accounts()[oldCode] ?? 0) + amount; }
  return amount;
}
/** After a move: an account in the new everyday currency is simply everyday money now. */
export function absorb(newCode) {
  const p = player();
  const n = p.finance.accounts?.[newCode];
  if (n > 0) { p.finance.cash += n; delete p.finance.accounts[newCode]; }
  return n ?? 0;
}
/** At death: everything is counted in one currency, once, so that an estate is neither lost nor doubled. */
export function settleEstate() {
  const p = player();
  const worth = foreignWorth(p);
  if (worth > 0) { p.finance.cash += worth; p.finance.accounts = {}; }
  return worth;
}
