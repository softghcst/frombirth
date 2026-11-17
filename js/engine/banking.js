// Banking: accounts that hold money apart from everyday cash, savings goals
// that are met only by money actually saved, a budget measured against what
// was actually spent, and the overview of what a person has and owes.
//
// Bank accounts live in the ledger and nowhere else (engine/ledger.js). Money
// moves between an account and the player's everyday money in the same
// currency: p.finance.cash for the currency of the country they live in, or
// the holding in p.finance.accounts for any other. An account keeps the
// currency it was opened in for good, whatever country its owner moves to.
//
// The banks, their accounts and their rates are invented (data/money.js).
import { store, player, country, npcsByRole, log, milestone } from '../state.js';
import { fmtMoney, localMoney, localCost } from '../util.js';
import { convert, currencyOf } from './currency.js';
import { isHigher } from './education.js';
import { ledgerOf, book, post, toMinor, fromMinor, Money, yearTotals, compact } from './ledger.js';
import { decimalsOf, PRODUCTS, BANKS, BANK_BY_ID, MAX_ACCOUNTS, GOAL_KINDS, CATEGORIES, BUDGET_CATEGORIES, FAMILY_LAW_OF, PENSION_PLAN } from '../data/money.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const home = () => country().currency.code;
const L = () => ledgerOf();
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/** An exact amount, with the currency's own small change. */
export function fmtExact(minor, code) {
  const d = decimalsOf(code);
  const body = (Math.abs(minor) / 10 ** d).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${minor < 0 ? '-' : ''}${currencyOf(code)?.symbol ?? `${code} `}${body}`;
}
/** A round amount of any currency. */
const fmtUnits = (units, code) => `${units < 0 ? '-' : ''}${currencyOf(code)?.symbol ?? `${code} `}${Math.abs(Math.round(units)).toLocaleString('en-US')}`;

// ---------- Everyday money in one currency ----------

const walletUnits = (cur) => (cur === home() ? player().finance.cash : player().finance.accounts?.[cur] ?? 0);
/** Changes the game's own balance by an exact amount, and makes sure the ledger has the matching account. */
export function moveWallet(cur, minor) {
  const f = player().finance;
  const d = 10 ** decimalsOf(cur);
  if (cur === home()) f.cash = (Math.round(f.cash * d) + minor) / d;
  else {
    const a = (f.accounts ??= {});
    a[cur] = (Math.round((a[cur] ?? 0) * d) + minor) / d;
    if (!a[cur]) delete a[cur];
  }
  return ((L().accounts[`wallet:${cur}`] ??= { id: `wallet:${cur}`, kind: 'wallet', cur, bal: 0 })).id;
}
/** Posts a movement between everyday money and bank accounts. The ledger is brought up to date first, so the two stay in step. */
export function move(desc, bankEntries, { cat = 'transfer', key, walletCur, walletMinor = 0, nominal } = {}) {
  book();
  const entries = [...bankEntries];
  if (walletMinor) entries.push([moveWallet(walletCur, walletMinor), walletMinor]);
  for (const [c, cur, amt] of nominal ?? []) {
    if (!amt) continue;
    const id = `n:${c}:${cur}`;
    L().accounts[id] ??= { id, kind: 'nominal', cur, cat: c, bal: 0 };
    entries.push([id, amt]);
  }
  const done = post(L(), { year: store.state.year, age: player().age, cat, desc, src: 'bank', key, entries });
  if (!done.ok) throw new Error(`Bank: ${done.why}`);
  return done.tx;
}

// ---------- Banks and what they offer ----------

const hashOf = (s) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
/** The banks with branches where the player lives, this year. */
export function banksHere(countryId = player().countryId, year = store.state.year) {
  return BANKS.filter((b) => year >= (b.since ?? 0) && hashOf(b.id + countryId) % 10 < b.reach);
}
const guardian = () => npcsByRole('parent')[0] ?? npcsByRole('grandparent')[0] ?? null;
const openCount = () => accounts().filter((a) => a.product !== 'pension').length;

/** Whether the player may open this kind of account today, and why not. */
export function eligible(productId, bank = null) {
  const p = player();
  const pr = PRODUCTS[productId];
  const year = store.state.year;
  if (!pr) return { ok: false, reason: 'There is no such account.' };
  if (bank && !bank.products.includes(productId)) return { ok: false, reason: `${bank.name} does not offer one.` };
  if (year < pr.since) return { ok: false, reason: 'Accounts like this do not exist yet.' };
  if (p.legal.incarceration) return { ok: false, reason: 'Not from a cell.' };
  if (openCount() >= MAX_ACCOUNTS) return { ok: false, reason: `You already have ${MAX_ACCOUNTS} accounts. Close one first.` };
  if (p.age < pr.minAge) return { ok: false, reason: `You need to be ${pr.minAge}.` };
  if (pr.maxAge != null && p.age > pr.maxAge) return { ok: false, reason: `It is for people of ${pr.maxAge} and under.` };
  if (pr.needs === 'guardian' && !guardian()) return { ok: false, reason: 'A parent or guardian has to open it with you.' };
  if (pr.needs === 'student' && !(p.education.enrolled && isHigher(p.education.stage))) return { ok: false, reason: 'It is for people in higher education.' };
  return { ok: true, reason: '' };
}
/** The yearly rate an account of this kind pays at this bank, in basis points. */
export const rateAt = (productId, bank) => Math.max(0, PRODUCTS[productId].rateBp + (PRODUCTS[productId].rateBp ? bank.bonusBp : 0));
/** The smallest opening balance, in whole units of local money. */
export const minimumFor = (productId) => (PRODUCTS[productId].min ? localMoney(PRODUCTS[productId].min, country()) : 0);

/** What every bank here offers, with whether the player can have it. */
export function offers() {
  return banksHere().map((bank) => ({ bank, products: bank.products.map((id) => ({ id, ...PRODUCTS[id], rateBp: rateAt(id, bank), minimum: minimumFor(id),
    fee: id === 'current' && bank.fee ? localCost(bank.fee, country()) : 0, ...eligible(id, bank) })).filter((x) => store.state.year >= x.since) }));
}

// ---------- Accounts ----------

const describe = (a) => ({ ...a, bank: BANK_BY_ID[a.bankId], units: fromMinor(a.bal, a.cur),
  locked: (a.matures != null && store.state.year < a.matures) || (a.unlockAge != null && player().age < a.unlockAge), share: shareOf(a),
  goal: (player().finance.goals ?? []).find((g) => g.accountId === a.id && (g.status === 'active' || g.status === 'paused')) ?? null });
/** The player's open bank accounts. */
export const accounts = () => Object.values(store.state.ledger?.accounts ?? {}).filter((a) => a.kind === 'bank' && a.closed == null).map(describe);
export const accountById = (id) => { const a = store.state.ledger?.accounts[id]; return a?.kind === 'bank' ? describe(a) : null; };
/** Accounts that were closed: kept, with their history, for as long as the ledger remembers. */
export const closedAccounts = () => Object.values(store.state.ledger?.accounts ?? {}).filter((a) => a.kind === 'bank' && a.closed != null);

/**
 * How much of an account is the player's. A joint account belongs to two
 * people: evenly where the law shares things equally, and otherwise by what each put in.
 */
export function shareOf(a, state = store.state) {
  if (!a.joint) return 1;
  if ((FAMILY_LAW_OF[state.player.countryId] ?? 'equal') === 'equal') return 0.5;
  const you = Math.max(0, a.contrib?.you ?? 0); const them = Math.max(0, a.contrib?.them ?? 0);
  return you + them > 0 ? you / (you + them) : 0.5;
}

/** Everything in the bank that is the player's, in the money of the country they live in. */
export function bankWorth(state = store.state) {
  const h = state.ledger?.home;
  let sum = 0;
  for (const a of Object.values(state.ledger?.accounts ?? {})) {
    if (a.kind !== 'bank' || a.closed != null || !a.bal) continue;
    const mine = fromMinor(a.bal, a.cur) * shareOf(a, state);
    if (a.cur === h) sum += mine;
    else if (state === store.state) sum += convert(mine, a.cur, home());
  }
  return sum;
}

const whole = (units) => Number.isInteger(units) && units > 0;

/**
 * Opens an account at a bank where the player lives, in local money.
 * @param {number} [units]  an opening deposit from everyday money, in whole units
 */
export function openAccount(bankId, productId, units = 0) {
  const p = player();
  const bank = BANK_BY_ID[bankId];
  if (!bank || !banksHere().includes(bank)) return result(false, 'That bank has no branch here.', 'neutral');
  const can = eligible(productId, bank);
  if (!can.ok) return result(false, can.reason, 'neutral');
  const pr = PRODUCTS[productId];
  const cur = home();
  const min = minimumFor(productId);
  if (units && !whole(units)) return result(false, 'Choose a whole amount.', 'neutral');
  if (units < min) return result(false, `It needs ${fmtUnits(min, cur)} to open.`, 'neutral');
  if (units > Math.floor(p.finance.cash)) return result(false, `You have ${fmtMoney(p.finance.cash, country())}.`, 'neutral');
  const ledger = L();
  const first = !Object.values(ledger.accounts).some((a) => a.kind === 'bank');
  const id = `bank:${ledger.nb = (ledger.nb ?? 0) + 1}`;
  const g = pr.needs === 'guardian' ? guardian() : null;
  ledger.accounts[id] = { id, kind: 'bank', cur, bal: 0, bankId, product: productId, name: pr.name, opened: store.state.year, openedAge: p.age,
    rateBp: rateAt(productId, bank), feeMinor: productId === 'current' && bank.fee ? toMinor(localCost(bank.fee, country()), cur) : 0,
    // An owner owns the money. A custodian can see the account and must agree to it; the money is not theirs.
    owners: [{ id: p.id, role: 'owner' }, ...(g ? [{ id: g.id, role: 'custodian' }] : [])],
    ...(pr.cap ? { capMinor: toMinor(localMoney(pr.cap, country()), cur) } : {}), ...(pr.term ? { matures: store.state.year + pr.term } : {}) };
  if (units) move(`Opening deposit: ${pr.name}, ${bank.name}`, [[id, toMinor(units, cur)]], { walletCur: cur, walletMinor: -toMinor(units, cur) });
  const text = `You opened ${/^[aeiou]/i.test(pr.name) ? 'an' : 'a'} ${lower(pr.name)} with ${bank.name}${units ? ` and paid in ${fmtUnits(units, cur)}` : ''}${g ? `. ${g.firstName} signed for it with you` : ''}.`;
  log(text, 'system', 'good');
  if (first) milestone('Opened a first bank account.', 'money');
  checkGoals();
  return { ...result(true, text), id };
}

/** Pays everyday money into an account. Whole units. */
export function deposit(id, units) {
  const a = accountById(id);
  if (!a || a.closed != null) return result(false, 'That account is closed.', 'neutral');
  if (a.matures != null) return result(false, 'A fixed deposit takes one payment, on the day it is opened.', 'neutral');
  if (!whole(units)) return result(false, 'Choose a whole amount.', 'neutral');
  if (units > Math.floor(walletUnits(a.cur))) return result(false, `You have ${fmtUnits(Math.max(0, Math.floor(walletUnits(a.cur))), a.cur)} to pay in.`, 'neutral');
  const m = toMinor(units, a.cur);
  if (a.capMinor && a.bal + m > a.capMinor) return result(false, `This account holds at most ${fmtExact(a.capMinor, a.cur)}.`, 'neutral');
  move(`Paid into ${lower(a.name)}`, [[id, m]], { walletCur: a.cur, walletMinor: -m });
  if (a.joint) { const c = (store.state.ledger.accounts[id].contrib ??= { you: 0, them: 0 }); c.you += m; }
  checkGoals();
  return result(true, `You paid ${fmtUnits(units, a.cur)} into your ${lower(a.name)}.`, 'neutral');
}

/** Takes money out of an account into everyday money. Whole units. */
export function withdraw(id, units) {
  const a = accountById(id);
  if (!a || a.closed != null) return result(false, 'That account is closed.', 'neutral');
  if (a.locked) return result(false, a.unlockAge != null ? `It is locked until you are ${a.unlockAge}. Taking it early costs a quarter of it.` : `It is locked until ${a.matures}. You can break the deposit, at a cost.`, 'neutral');
  if (!whole(units)) return result(false, 'Choose a whole amount.', 'neutral');
  const m = toMinor(units, a.cur);
  if (m > a.bal) return result(false, `There is ${fmtExact(a.bal, a.cur)} in it.`, 'neutral');
  move(`Taken out of ${lower(a.name)}`, [[id, -m]], { walletCur: a.cur, walletMinor: m });
  if (a.joint) {
    const acct = store.state.ledger.accounts[id]; (acct.contrib ??= { you: 0, them: 0 }).you -= m;
    // Taking most of what is shared, without a word, is noticed.
    const other = store.state.npcs[a.joint];
    if (other?.alive && m > a.bal / 2 && a.bal > 0) { other.meters.relationship = Math.max(0, other.meters.relationship - 10); log(`${other.firstName} noticed how much you took out of the account you share.`, 'system', 'bad'); }
  }
  return result(true, `You took ${fmtUnits(units, a.cur)} out of your ${lower(a.name)}.`, 'neutral');
}

/** Moves money straight from one of the player's accounts to another in the same currency. */
export function transfer(fromId, toId, units) {
  const a = accountById(fromId);
  const b = accountById(toId);
  if (!a || !b || a.id === b.id) return result(false, 'Choose two different accounts.', 'neutral');
  if (a.cur !== b.cur) return result(false, `One account is in ${a.cur} and the other in ${b.cur}. Take the money out and change it first.`, 'neutral');
  if (a.locked || b.matures != null) return result(false, 'One of those is locked.', 'neutral');
  if (a.joint || b.joint) return result(false, 'Money goes into or out of a joint account through your everyday money, so that it is clear whose it was.', 'neutral');
  if (!whole(units)) return result(false, 'Choose a whole amount.', 'neutral');
  const m = toMinor(units, a.cur);
  if (m > a.bal) return result(false, `There is ${fmtExact(a.bal, a.cur)} in it.`, 'neutral');
  if (b.capMinor && b.bal + m > b.capMinor) return result(false, `That account holds at most ${fmtExact(b.capMinor, b.cur)}.`, 'neutral');
  move(`Moved from ${lower(a.name)} to ${lower(b.name)}`, [[a.id, -m], [b.id, m]]);
  checkGoals();
  return result(true, `You moved ${fmtUnits(units, a.cur)} from your ${lower(a.name)} to your ${lower(b.name)}.`, 'neutral');
}

/** What breaking a fixed deposit early costs: a year of its interest. */
export const breakCost = (a) => (!a.locked ? 0 : a.unlockAge != null ? Money.bp(a.bal, PENSION_PLAN.earlyPenalty * 10000) : Math.min(a.bal, Money.bp(a.bal, a.rateBp)));

/** Empties an account into everyday money and closes it. Its history stays. */
function payOut(a, why) {
  const penalty = breakCost(a);
  let pay = a.bal - penalty;
  // Money held in another currency is kept in whole units: the odd fraction stays with the bank.
  const odd = a.cur === home() ? 0 : pay % 10 ** decimalsOf(a.cur);
  pay -= odd;
  if (a.bal) {
    move(why, [[a.id, -a.bal]], { cat: penalty + odd && !pay ? 'fees' : 'transfer', walletCur: a.cur, walletMinor: pay, nominal: [['fees', a.cur, penalty + odd]] });
  }
  store.state.ledger.accounts[a.id].closed = store.state.year;
  for (const g of player().finance.goals ?? []) if (g.accountId === a.id && g.status === 'active') g.status = 'paused';
  return { pay, penalty };
}

export function closeAccount(id) {
  const a = accountById(id);
  if (!a || a.closed != null) return result(false, 'That account is already closed.', 'neutral');
  const { pay, penalty } = payOut(a, `Closed ${lower(a.name)}, ${a.bank.name}`);
  const text = `You closed your ${lower(a.name)} with ${a.bank.name}${pay ? ` and took out ${fmtExact(pay, a.cur)}` : ''}${penalty ? `. Breaking it early cost ${fmtExact(penalty, a.cur)}` : ''}.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/**
 * When everyday money has gone below nothing: the bank takes what is owed
 * from the player's other accounts before it charges interest or anything is
 * sold. Instant-access accounts first; fixed deposits last, and at a cost.
 * @returns {number} how much was moved, in local money
 */
export function coverShortfall() {
  const p = player();
  if (p.finance.cash >= 0) return 0;
  const cur = home();
  let moved = 0;
  const order = (a) => (a.locked ? 2 : a.product === 'current' ? 0 : 1);
  for (const a of accounts().filter((x) => x.cur === cur && x.product !== 'youth' && x.product !== 'pension' && !x.joint).sort((x, y) => order(x) - order(y))) {
    const need = Math.ceil(-p.finance.cash);
    if (need <= 0) break;
    if (a.locked) {
      const { pay, penalty } = payOut(a, `Fixed deposit broken to cover what was owed: ${a.bank.name}`);
      moved += fromMinor(pay, cur);
      log(`Your fixed deposit with ${a.bank.name} was broken to cover what you owed. It cost ${fmtExact(penalty, cur)} in lost interest.`, 'system', 'bad');
      continue;
    }
    const take = Math.min(need, Math.floor(fromMinor(a.bal, cur)));
    if (take <= 0) continue;
    const m = toMinor(take, cur);
    move(`Moved from ${lower(a.name)} to cover what was owed`, [[a.id, -m]], { walletCur: cur, walletMinor: m });
    moved += take;
    log(`${fmtUnits(take, cur)} was moved from your ${lower(a.name)} to cover what you owed.`, 'system', 'neutral');
  }
  return moved;
}

/**
 * At death: every account is closed, once. A joint account passes to the
 * other owner; an account with a living person named on it passes to them;
 * both stay outside the estate. Everything else joins the estate. Call before
 * the estate is counted.
 * @returns {{to:string, name:string, amount:number, how:string}[]} what passed outside the estate, in local money
 */
export function closeForEstate() {
  const outside = [];
  if (!store.state.ledger) return outside;
  for (const a of accounts()) {
    const acct = store.state.ledger.accounts[a.id];
    const to = store.state.npcs[a.joint ?? a.beneficiary];
    if (acct.bal && to?.alive) {
      const units = Math.round(a.cur === home() ? fromMinor(acct.bal, a.cur) : convert(fromMinor(acct.bal, a.cur), a.cur, home()));
      if (to.life) to.life.savings += units; else to.savings = (to.savings ?? 0) + units;
      outside.push({ to: to.id, name: `${to.firstName} ${to.lastName}`, amount: units, how: a.joint ? 'a joint account' : `named on the ${lower(a.name)}` });
      move(`${a.name}: passed to ${to.firstName} ${to.lastName} on death`, [[a.id, -acct.bal]], { cat: 'transfer', nominal: [['jointPartner', a.cur, acct.bal]] });
    } else if (acct.bal) move(`${a.name} closed on death: the balance passes to the estate`, [[a.id, -acct.bal]], { walletCur: a.cur, walletMinor: acct.bal });
    acct.closed = store.state.year;
  }
  book({ cat: 'auto' });
  return outside;
}

/** Names who an account goes to when its owner dies, or with null nobody. */
export function nameOnAccount(id, npcId) {
  const a = accountById(id);
  if (!a || a.closed != null) return result(false, 'That account is closed.', 'neutral');
  if (a.joint) return result(false, 'A joint account already passes to the other owner.', 'neutral');
  const n = npcId ? store.state.npcs[npcId] : null;
  if (npcId && !n?.alive) return result(false, 'Choose someone living.', 'neutral');
  const acct = store.state.ledger.accounts[id];
  if (n) acct.beneficiary = n.id; else delete acct.beneficiary;
  return result(true, n ? `If you die, your ${lower(a.name)} goes straight to ${n.firstName} ${n.lastName}, outside your will.` : `Your ${lower(a.name)} will pass under your will.`, 'neutral');
}

// ---------- The year ----------

/** Yearly, before the rest of the year's money: interest month by month, fees, and accounts that change with age. */
export function tickBanking() {
  const p = player();
  const year = store.state.year;
  const ledger = L();
  let earned = 0;
  for (const a of accounts()) {
    const acct = ledger.accounts[a.id];
    // Twelve months of interest, each on the balance the month before left behind.
    let bal = acct.bal; let interest = 0;
    for (let m = 0; m < 12 && acct.rateBp; m++) { const i = Money.bp(bal, acct.rateBp, 120000); bal += i; interest += i; }
    if (interest > 0) {
      move(`Interest for the year at ${(acct.rateBp / 100).toFixed(2)}%: ${lower(a.name)}`, [[a.id, interest]], { cat: 'interestIncome', key: `interest:${a.id}:${year}`, nominal: [['interestIncome', a.cur, -interest]] });
      if (a.cur === home()) earned += interest;
    }
    const fee = Math.min(acct.feeMinor ?? 0, acct.bal);
    if (fee > 0) move(`Yearly charge: ${lower(a.name)}, ${a.bank.name}`, [[a.id, -fee]], { cat: 'fees', key: `fee:${a.id}:${year}`, nominal: [['fees', a.cur, fee]] });

    // The other owner of a joint account has died: it belongs to the survivor.
    if (acct.joint && !store.state.npcs[acct.joint]?.alive) {
      const who = store.state.npcs[acct.joint]?.firstName ?? 'The other owner';
      delete acct.joint; acct.owners = acct.owners.filter((o) => o.role === 'owner'); acct.name = PRODUCTS[acct.product].name;
      log(`${who} has died. The account you shared is yours alone now.`, 'system', 'neutral');
    }
    const becomes = (product, line) => {
      acct.product = product; acct.name = PRODUCTS[product].name; acct.rateBp = rateAt(product, a.bank);
      acct.owners = acct.owners.filter((o) => o.role === 'owner'); delete acct.capMinor; delete acct.matures;
      log(line, 'system', 'neutral');
    };
    if (acct.product === 'youth' && p.age >= 18) becomes('savings', `You are 18. Your young saver account with ${a.bank.name} is an ordinary savings account now, and yours alone.`);
    else if (acct.product === 'student' && !(p.education.enrolled && isHigher(p.education.stage))) becomes(a.bank.products.includes('current') ? 'current' : 'savings', `Your student account with ${a.bank.name} has become an ordinary account.`);
    else if (acct.matures != null && year >= acct.matures) becomes('savings', `Your fixed deposit with ${a.bank.name} has matured. The money is yours to move again.`);
  }
  if (earned > 0) {
    p.finance.lifetimeEarned += fromMinor(earned, home());
    log(`Your savings earned ${fmtExact(earned, home())} in interest.`, 'system', 'good');
  }
}

/** Yearly, after the year's money has moved: goals, the budget, and tidying the book. */
export function tickMoneyReview() {
  const p = player();
  checkGoals();
  for (const g of p.finance.goals ?? []) {
    if (g.status === 'active' && g.deadlineAge != null && p.age > g.deadlineAge && !g.late) {
      g.late = true;
      log(`You meant to have saved for ${lower(g.name)} by ${g.deadlineAge}. You are not there yet.`, 'system', 'neutral');
    }
  }
  const b = budgetView();
  if (p.age >= 18 && b.rows.some((r) => r.limit != null)) {
    const over = b.rows.filter((r) => r.limit != null && r.actual > r.limit);
    if (over.length) log(`You spent more than you planned on ${over.map((r) => lower(r.name)).join(', ')}.`, 'system', 'neutral');
    else log('You kept within every limit in your budget this year.', 'system', 'good');
  }
  // Debt cleared is a thing that happened, not a thing that is claimed: it is read from what is owed.
  const owes = p.finance.loans.length > 0 || p.assets.some((a) => a.mortgage);
  if (owes) p.flags.hadDebt = true;
  else if (p.flags.hadDebt) { p.flags.hadDebt = false; milestone('Became free of debt.', 'money'); log('You owe nobody anything. Every debt is paid.', 'system', 'good'); }
  compact(L(), store.state.year);
}

// ---------- Savings goals ----------
// p.finance.goals = [{ id, kind, name, target (minor units), cur, accountId, deadlineAge, status, createdYear, createdAge, doneYear, doneAge }]
// A goal is met by the balance of the account it is tied to, and by nothing else.

const goals = () => (player().finance.goals ??= []);
export const goalList = () => goals().map((g) => {
  const a = store.state.ledger?.accounts[g.accountId];
  const saved = g.status === 'completed' ? g.target : a && a.closed == null ? Math.min(a.bal, g.target) : 0;
  return { ...g, saved, share: g.target ? saved / g.target : 0, account: a ? describe(a) : null };
});

/** A sensible target for a kind of goal, in whole units of local money. */
export function suggestedTarget(kindId) {
  const k = GOAL_KINDS.find((x) => x.id === kindId);
  const c = country();
  if (k?.base) return localCost(k.base, c);
  // An emergency fund: three months of what the last year actually cost, or of an ordinary life here.
  const spent = fromMinor(yearTotals(L(), store.state.year, home()).out, home());
  return Math.max(localCost(3000, c), Math.round(spent / 4 / 100) * 100);
}

export function addGoal({ kind, name, target, accountId, deadlineAge = null }) {
  const p = player();
  const a = accountById(accountId);
  if (!a || a.closed != null) return result(false, 'A goal needs an account to save into.', 'neutral');
  if (a.goal) return result(false, `That account is already saving for ${lower(a.goal.name)}.`, 'neutral');
  if (!whole(target)) return result(false, 'Choose an amount to aim for.', 'neutral');
  if (deadlineAge != null && deadlineAge <= p.age) return result(false, 'Choose an age you have not reached yet.', 'neutral');
  const title = (name ?? GOAL_KINDS.find((k) => k.id === kind)?.name ?? 'A goal').slice(0, 40);
  goals().push({ id: `goal${goals().length + 1}_${store.state.year}`, kind: kind ?? 'custom', name: title, target: toMinor(target, a.cur), cur: a.cur,
    accountId, deadlineAge, status: 'active', createdYear: store.state.year, createdAge: p.age });
  const text = `You are saving for ${lower(title)}: ${fmtUnits(target, a.cur)}, in your ${lower(a.name)}.`;
  log(text, 'system', 'neutral');
  checkGoals();
  return result(true, text, 'neutral');
}

/** Changes a goal that is still open. What has already happened stays as it was. */
export function updateGoal(id, { target, status, deadlineAge } = {}) {
  const g = goals().find((x) => x.id === id);
  if (!g) return result(false, 'There is no such goal.', 'neutral');
  if (g.status === 'completed' || g.status === 'abandoned') return result(false, 'That goal is finished.', 'neutral');
  if (target != null) { if (!whole(target)) return result(false, 'Choose an amount to aim for.', 'neutral'); g.target = toMinor(target, g.cur); }
  if (deadlineAge !== undefined) g.deadlineAge = deadlineAge;
  if (status) {
    if (!['active', 'paused', 'abandoned'].includes(status)) return result(false, 'A goal is finished by saving the money.', 'neutral');
    if (status === 'active' && !accountById(g.accountId)) return result(false, 'The account it was saving into is closed.', 'neutral');
    g.status = status;
    if (status === 'abandoned') { g.doneYear = store.state.year; log(`You gave up saving for ${lower(g.name)}.`, 'system', 'neutral'); }
  }
  checkGoals();
  return result(true, status === 'abandoned' ? 'The goal is set aside. The money is still yours.' : 'Changed.', 'neutral');
}

/** Marks as met every goal whose money is really there. */
export function checkGoals() {
  const p = player();
  for (const g of p.finance.goals ?? []) {
    if (g.status !== 'active') continue;
    const a = store.state.ledger?.accounts[g.accountId];
    if (!a || a.closed != null || a.bal < g.target) continue;
    g.status = 'completed'; g.doneYear = store.state.year; g.doneAge = p.age;
    log(`You have saved ${fmtExact(g.target, g.cur)} for ${lower(g.name)}. It is all there.`, 'system', 'good');
    milestone(`Saved up for ${lower(g.name)}.`, 'money');
  }
}

// ---------- Budget ----------
// p.finance.budget = { limits: { category: whole units a year } }

/** Sets, or with null removes, the most the player means to spend on something in a year. */
export function setLimit(cat, units) {
  if (!BUDGET_CATEGORIES.includes(cat)) return result(false, 'That is not something to budget for.', 'neutral');
  const b = (player().finance.budget ??= { limits: {} });
  if (units == null) delete b.limits[cat];
  else if (!Number.isInteger(units) || units < 0) return result(false, 'Choose a whole amount.', 'neutral');
  else b.limits[cat] = units;
  return result(true, units == null ? 'Limit removed.' : `You mean to spend no more than ${fmtUnits(units, home())} a year on ${lower(CATEGORIES[cat].name)}.`, 'neutral');
}

/** What was planned against what actually happened in a year, in whole units of local money. */
export function budgetView(year = store.state.year) {
  const cur = home();
  const t = yearTotals(L(), year, cur);
  const limits = player().finance.budget?.limits ?? {};
  const u = (m) => Math.round(fromMinor(m ?? 0, cur));
  const rows = BUDGET_CATEGORIES.map((cat) => ({ cat, name: CATEGORIES[cat].name, actual: u(t.expense[cat]), limit: limits[cat] ?? null }))
    .filter((r) => r.actual || r.limit != null);
  const fixed = Object.entries(t.expense).filter(([cat]) => !CATEGORIES[cat].budget).map(([cat, m]) => ({ cat, name: CATEGORIES[cat].name, actual: u(m) }));
  return { year, cur, income: u(t.in), spent: u(t.out), left: u(t.in - t.out), saved: u(t.saved), rows, fixed,
    incomeBy: Object.entries(t.income).map(([cat, m]) => ({ cat, name: CATEGORIES[cat].name, amount: u(m) })),
    planned: rows.reduce((s, r) => s + (r.limit ?? r.actual), 0) };
}

// ---------- Overview ----------

/**
 * What the player has and owes, in whole units of local money. The parts add
 * up to exactly the net worth the rest of the game uses (engine/finance.js).
 */
export function overview() {
  const p = player();
  const f = p.finance;
  const cur = home();
  const sum = (list, fn) => list.reduce((s, a) => s + fn(a), 0);
  const foreign = Object.entries(f.accounts ?? {}).reduce((s, [code, n]) => s + (code === cur ? n : convert(n, code, cur)), 0);
  const of = (kind) => p.assets.filter((a) => a.kind === kind);
  const others = p.assets.filter((a) => !['security', 'property', 'vehicle', 'business'].includes(a.kind));
  const parts = {
    cash: f.cash, foreign, bank: bankWorth(),
    investments: sum(of('security'), (a) => a.value * (a.units ?? 1)),
    business: sum(of('business'), (a) => a.value), property: sum(of('property'), (a) => a.value), vehicles: sum(of('vehicle'), (a) => a.value), other: sum(others, (a) => a.value * (a.units ?? 1)),
    loans: sum(f.loans, (l) => l.principal), mortgages: sum(p.assets, (a) => a.mortgage?.principal ?? 0),
    cards: sum(f.cards ?? [], (k) => k.balance), lent: sum(f.lent ?? [], (l) => l.left),
  };
  const assets = parts.cash + parts.foreign + parts.bank + parts.investments + parts.property + parts.vehicles + parts.other + parts.lent + parts.business;
  const liabilities = parts.loans + parts.mortgages + parts.cards;
  const t = yearTotals(L(), store.state.year, cur);
  return { cur, ...parts, assets, liabilities, netWorth: Math.round(assets - liabilities),
    income: Math.round(fromMinor(t.in, cur)), spent: Math.round(fromMinor(t.out, cur)) };
}
