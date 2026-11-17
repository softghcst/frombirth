// The ledger: one book in which every movement of the player's money is
// written down, in double entry.
//
// HOW IT FITS THE REST OF THE GAME
// The game has always kept everyday money in p.finance.cash, money in other
// currencies in p.finance.accounts, and debts in p.finance.loans and on each
// mortgaged property. Dozens of modules change those directly, and they stay
// the single place those balances live. The ledger does not hold a second
// copy to disagree with: it MIRRORS them. Whenever something has changed,
// book() compares the game's balances with the ledger's, and writes one
// balanced transaction for the difference, filed under what caused it.
// Bank accounts are the other way round: they exist only in the ledger.
//
// SIGNS. An entry is a signed change to one account.
//   wallet, bank   what you hold: positive is money you have
//   debt           what you owe: the balance is negative while you owe it
//   nominal        where money came from or went: income is negative, spending positive
//   clearing       the two halves of a currency exchange
// The entries of every transaction add up to nothing in each currency, so the
// balances of all accounts in a currency always add up to nothing too. Money
// cannot appear or vanish in the ledger; it can only move.
//
// AMOUNTS are whole numbers of the currency's smallest unit (cents, or yen:
// see decimalsOf), never fractions, so adding up never drifts.
import { store } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { decimalsOf, CATEGORIES, guessCategory } from '../data/money.js';

/** How many years of individual transactions are kept. Older years survive as yearly totals. */
export const KEEP_YEARS = 5;
const KEEP_MAX = 700;

// ---------- Money ----------

const safe = (n) => { if (!Number.isSafeInteger(n)) throw new Error(`Not a whole amount of money: ${n}`); return n; };
/** Whole or fractional units of a currency, as its smallest unit. */
export const toMinor = (units, code) => safe(Math.round((Number(units) || 0) * 10 ** decimalsOf(code)));
export const fromMinor = (minor, code) => minor / 10 ** decimalsOf(code);

/** Sums of money that know their currency, and refuse to be mixed. */
export const Money = {
  of: (minor, code) => ({ minor: safe(minor), code }),
  same(a, b) { if (a.code !== b.code) throw new Error(`Cannot combine ${a.code} with ${b.code} without an exchange.`); },
  add(a, b) { Money.same(a, b); return Money.of(a.minor + b.minor, a.code); },
  sub(a, b) { Money.same(a, b); return Money.of(a.minor - b.minor, a.code); },
  cmp(a, b) { Money.same(a, b); return Math.sign(a.minor - b.minor); },
  /** A share of an amount in basis points (interest, tax), rounded down. Exact for any size. */
  bp: (minor, bp, per = 10000) => Number(BigInt(safe(minor)) * BigInt(Math.round(bp)) / BigInt(per)),
  /** Splits an amount by weights so that the parts add up to exactly the whole. */
  allocate(minor, weights) {
    const total = weights.reduce((s, w) => s + w, 0);
    if (!(total > 0)) throw new Error('Nothing to share by.');
    const parts = weights.map((w) => Math.floor(minor * w / total));
    let left = minor - parts.reduce((s, x) => s + x, 0);
    for (let i = 0; left > 0; i = (i + 1) % parts.length) if (weights[i] > 0) { parts[i] += 1; left -= 1; }
    return parts;
  },
  /** An amount changed into another currency at a stated rate (units of `to` per unit of `from`). Rounds down. */
  exchange(m, to, rate) {
    return Money.of(Math.floor(m.minor / 10 ** decimalsOf(m.code) * rate * 10 ** decimalsOf(to)), to);
  },
};

// ---------- The book ----------

const homeOf = (state) => COUNTRIES[state.player.countryId].currency.code;
const nominalId = (cat, cur) => `n:${cat}:${cur}`;
const HELD = { wallet: 1, bank: 1 };

function account(L, id, make) {
  return (L.accounts[id] ??= { id, bal: 0, ...make() });
}

/** The game's own balances, as the ledger should show them. */
function mirror(state) {
  const p = state.player;
  const f = p.finance;
  const home = homeOf(state);
  const want = {};
  const wallet = (cur, minor) => { const id = `wallet:${cur}`; (want[id] ??= { kind: 'wallet', cur, bal: 0 }).bal += minor; };
  wallet(home, toMinor(f.cash, home));
  for (const [cur, n] of Object.entries(f.accounts ?? {})) if (n) wallet(cur, toMinor(n, cur));
  for (const l of f.loans ?? []) {
    want[`debt:${l.id}:${home}`] = { kind: 'debt', cur: home, bal: -toMinor(l.principal, home), name: `${l.kind.charAt(0).toUpperCase() + l.kind.slice(1)} loan`, debtKind: l.kind };
  }
  for (const a of p.assets ?? []) {
    if (a.mortgage) want[`debt:${a.id}:${home}`] = { kind: 'debt', cur: home, bal: -toMinor(a.mortgage.principal, home), name: `Mortgage on the ${a.name.charAt(0).toLowerCase() + a.name.slice(1)}`, debtKind: 'mortgage' };
  }
  return want;
}

/** The ledger of a life, created on first use. A life that began before the ledger starts from an opening balance. */
export function ledgerOf(state = store.state, opening = null) {
  if (state.ledger) return state.ledger;
  const L = state.ledger = { v: 1, seq: 1, home: homeOf(state), accounts: {}, tx: [], keys: {}, years: {}, closedThrough: null };
  // Nothing is invented about the past: what the life has today is written down once, as where it started.
  const share = opening?.inheritance ? Math.min(Math.max(0, toMinor(state.player.finance.cash, L.home)), toMinor(opening.inheritance, L.home)) : 0;
  book({ state, cat: 'opening', src: 'migration', key: 'opening', split: share ? [['inheritance', -share]] : [],
    desc: opening?.desc ?? 'What you had when the books were opened' });
  return L;
}

/**
 * Writes a transaction. The entries must add up to nothing in each currency.
 * @param {{year:number, age:number, cat:string, desc:string, src?:string, key?:string, rel?:string, entries:[string, number][]}} t
 * @returns {{ok:boolean, tx?:object, dup?:boolean, why?:string}}
 */
export function post(L, t) {
  if (t.key && L.keys[t.key] != null) return { ok: true, dup: true, tx: L.tx.find((x) => x.key === t.key) };
  if (L.closedThrough != null && t.year <= L.closedThrough) return { ok: false, why: 'That year is closed.' };
  const sums = {};
  const entries = t.entries.filter(([, amt]) => amt !== 0);
  if (!entries.length) return { ok: false, why: 'Nothing moved.' };
  for (const [id, amt] of entries) {
    const a = L.accounts[id];
    if (!a) return { ok: false, why: `No such account: ${id}` };
    if (a.closed != null && a.kind === 'bank') return { ok: false, why: 'That account is closed.' };
    safe(amt);
    sums[a.cur] = (sums[a.cur] ?? 0) + amt;
  }
  for (const [cur, s] of Object.entries(sums)) if (s !== 0) return { ok: false, why: `The entries do not balance in ${cur}.` };

  const tx = { id: `t${L.seq++}`, year: t.year, age: t.age, cat: t.cat, desc: t.desc, src: t.src ?? 'game', status: 'posted', entries };
  if (t.key) { tx.key = t.key; L.keys[t.key] = t.year; }
  if (t.rel) tx.rel = t.rel;
  for (const [id, amt] of entries) {
    const a = L.accounts[id];
    a.bal = safe(a.bal + amt);
    // Yearly totals outlive the transactions themselves.
    const y = ((L.years[t.year] ??= {})[a.cur] ??= {});
    if (a.kind === 'nominal') { const s = (y[a.cat] ??= [0, 0]); if (amt < 0) s[0] -= amt; else s[1] += amt; }
    if (a.kind === 'bank' && t.cat === 'transfer') { const s = (y.saved ??= [0, 0]); if (amt > 0) s[0] += amt; else s[1] -= amt; }
  }
  L.tx.push(tx);
  return { ok: true, tx };
}

/**
 * Books whatever has changed in the game's own balances since the ledger last
 * looked, as one transaction.
 * @param {object} [o]
 * @param {string} [o.cat]      what caused it; 'auto' works it out
 * @param {string} [o.nominal]  where the unexplained part goes, if not `cat` (the interest in a loan payment)
 * @param {[string, number][]} [o.split]  parts of it that belong under other headings: [category, amount in minor units, spending positive]
 * @returns {object|null} the transaction, or null if nothing had changed
 */
export function book(o = {}) {
  const state = o.state ?? store.state;
  if (!state?.player?.finance) return null;
  const L = state.ledger ?? ledgerOf(state);
  const home = homeOf(state);
  const want = mirror(state);
  for (const a of Object.values(L.accounts)) if ((a.kind === 'wallet' || a.kind === 'debt') && !want[a.id]) want[a.id] = { kind: a.kind, cur: a.cur, bal: 0 };

  const entries = [];
  const rest = {};
  let debtMove = 0; const moved = new Set();
  for (const [id, w] of Object.entries(want)) {
    const a = account(L, id, () => ({ kind: w.kind, cur: w.cur, ...(w.name ? { name: w.name, debtKind: w.debtKind, opened: state.year } : {}) }));
    const d = w.bal - a.bal;
    if (!d) continue;
    entries.push([id, d]);
    rest[w.cur] = (rest[w.cur] ?? 0) - d;
    if (w.kind === 'wallet') moved.add(Math.sign(d)); else debtMove += d;
    if (w.kind === 'debt') { if (w.bal === 0) a.closed = state.year; else delete a.closed; }
  }
  if (!entries.length) return null;

  // A change of country turns everything into another currency at once.
  const movedHome = L.home !== home;
  L.home = home;
  let cat = o.cat ?? 'auto';
  const currencies = Object.keys(rest).filter((c) => rest[c] !== 0);
  if (movedHome || (cat === 'auto' && currencies.length > 1 && moved.size > 1 && !debtMove)) cat = 'exchange';
  if (cat === 'auto' && debtMove && currencies.length === 0) cat = debtMove < 0 ? 'borrowing' : 'debt';
  const moneyIn = (rest[home] ?? Object.values(rest)[0] ?? 0) < 0;
  if (cat === 'auto') cat = guessCategory(o.desc, moneyIn);
  // A heading given in advance for a part of the year may turn out to face the wrong way: a cost under "salary".
  else if (o.soft && !o.split?.length && ((CATEGORIES[cat]?.kind === 'income' && !moneyIn) || (CATEGORIES[cat]?.kind === 'expense' && moneyIn))) cat = guessCategory(o.desc, moneyIn);

  for (const [c, amt] of o.split ?? []) {
    if (!amt) continue;
    entries.push([account(L, nominalId(c, home), () => ({ kind: 'nominal', cur: home, cat: c })).id, amt]);
    rest[home] = (rest[home] ?? 0) - amt;
  }
  const filed = o.nominal ?? cat;
  for (const [cur, amt] of Object.entries(rest)) {
    if (!amt) continue;
    const id = cat === 'exchange' ? account(L, `fx:${cur}`, () => ({ kind: 'clearing', cur })).id
      : account(L, nominalId(filed, cur), () => ({ kind: 'nominal', cur, cat: filed })).id;
    entries.push([id, amt]);
  }
  const done = post(L, { year: state.year, age: state.player.age, cat, src: o.src, key: o.key, rel: o.rel,
    desc: (o.desc ?? CATEGORIES[cat]?.name ?? 'Money').slice(0, 120), entries });
  if (!done.ok) throw new Error(`Ledger: ${done.why}`);
  L.jn = state.journal?.length ?? 0;
  return done.tx;
}

/** Books a change made by the player between years, described by the journal line that came with it. */
export function bookAction(state = store.state) {
  if (!state?.player?.finance) return null;
  const L = state.ledger ?? ledgerOf(state);
  const j = state.journal ?? [];
  const line = j.length > (L.jn ?? 0) ? j[j.length - 1].text : null;
  return book({ state, cat: 'auto', src: 'action', desc: line ?? undefined });
}

/** Runs a part of the year and books whatever it did to the player's money under one heading. */
export function booked(cat, desc, fn) {
  const out = fn();
  if (store.state?.player?.alive !== false) book({ cat, desc, src: 'year', soft: true });
  return out;
}

/** Year end: transactions older than a few years are dropped. Their yearly totals, and every balance, remain. */
export function compact(L, year) {
  const from = year - KEEP_YEARS + 1;
  if (L.tx.length && L.tx[0].year < from) {
    L.tx = L.tx.filter((t) => t.year >= from);
    L.closedThrough = from - 1;
    for (const [k, y] of Object.entries(L.keys)) if (y <= L.closedThrough) delete L.keys[k];
  }
  if (L.tx.length > KEEP_MAX) L.tx = L.tx.slice(-KEEP_MAX); // their keys stay, so nothing in an open year can be posted twice
}

// ---------- Reading it ----------

export const balanceOf = (L, id) => L.accounts[id]?.bal ?? 0;

/** What a transaction did to the money you hold, in each currency, and how much moved inside it. */
export function effect(L, tx) {
  const net = {}; const moved = {};
  for (const [id, amt] of tx.entries) {
    const a = L.accounts[id];
    if (!HELD[a.kind]) continue;
    net[a.cur] = (net[a.cur] ?? 0) + amt;
    if (amt > 0) moved[a.cur] = (moved[a.cur] ?? 0) + amt;
  }
  return { net, moved };
}

/**
 * A year's money in and out, by category, in one currency (minor units).
 * Transfers, borrowing and things bought to own are left out of both.
 */
export function yearTotals(L, year, cur) {
  const y = L.years[year]?.[cur] ?? {};
  const out = { income: {}, expense: {}, in: 0, out: 0, saved: (y.saved?.[0] ?? 0) - (y.saved?.[1] ?? 0) };
  for (const [cat, [i, e]] of Object.entries(y)) {
    const kind = CATEGORIES[cat]?.kind;
    if (kind !== 'income' && kind !== 'expense') continue;
    const net = e - i; // spending positive
    if (net > 0) { out.expense[cat] = net; out.out += net; } else if (net < 0) { out.income[cat] = -net; out.in += -net; }
  }
  return out;
}

/**
 * Checks the book. Returns a list of problems; an empty list means it is sound.
 * 1. every transaction balances in every currency
 * 2. every currency's accounts add up to nothing
 * 3. the ledger agrees with the game's own cash and debts
 * 4. no transaction, and no key, is there twice
 */
export function audit(state = store.state) {
  const L = state.ledger;
  const bad = [];
  if (!L) return ['There is no ledger.'];
  const ids = new Set(); const keys = new Set();
  for (const t of L.tx) {
    const sums = {};
    for (const [id, amt] of t.entries) {
      const a = L.accounts[id];
      if (!a) { bad.push(`${t.id}: entry on a missing account ${id}`); continue; }
      if (!Number.isSafeInteger(amt)) bad.push(`${t.id}: ${amt} is not a whole amount`);
      sums[a.cur] = (sums[a.cur] ?? 0) + amt;
    }
    for (const [cur, s] of Object.entries(sums)) if (s) bad.push(`${t.id} does not balance in ${cur}: ${s}`);
    if (ids.has(t.id)) bad.push(`${t.id} appears twice`);
    ids.add(t.id);
    if (t.key) { if (keys.has(t.key)) bad.push(`key ${t.key} appears twice`); keys.add(t.key); }
  }
  const totals = {};
  for (const a of Object.values(L.accounts)) totals[a.cur] = (totals[a.cur] ?? 0) + a.bal;
  for (const [cur, s] of Object.entries(totals)) if (s) bad.push(`${cur} accounts add up to ${s}, not nothing`);
  const want = mirror(state);
  for (const a of Object.values(L.accounts)) {
    if (a.kind !== 'wallet' && a.kind !== 'debt') continue;
    const w = want[a.id]?.bal ?? 0;
    if (w !== a.bal) bad.push(`${a.id}: the ledger says ${a.bal}, the game says ${w}`);
  }
  for (const [id, w] of Object.entries(want)) if (!L.accounts[id] && w.bal) bad.push(`${id} is missing from the ledger`);
  return bad;
}
