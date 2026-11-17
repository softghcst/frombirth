// Trusts: money set aside for someone else, held for them until they reach an
// age, and no longer the giver's.
//
// A deliberately simple, documented game rule, not any country's trust law:
//   - money put into a trust has left the player for good: it is not in
//     their net worth, and they cannot take it back;
//   - a trustee (a bank) holds it and it grows slowly; the trustee does not own it;
//   - it is paid to the beneficiary when they reach the release age, whether
//     or not the player is still alive;
//   - if the beneficiary dies first, it returns to whoever set it up.
// A trust is an account in the ledger of kind 'trust' (engine/ledger.js).
import { store, player, country, log, milestone } from '../state.js';
import { fmtMoney, localMoney } from '../util.js';
import { ledgerOf, toMinor, fromMinor, Money, post, book } from './ledger.js';
import { move, moveWallet, fmtExact } from './banking.js';

export const TRUST = { min: 5000, fee: 0.01, growthBp: 300, max: 4 };
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const home = () => country().currency.code;
const all = (state = store.state) => Object.values(state.ledger?.accounts ?? {}).filter((a) => a.kind === 'trust');
/** Trusts the player set up that still hold money. */
export const trusts = () => all().filter((a) => a.closed == null && !a.held);
/** A trust somebody else set up, held for the player until they are old enough. */
export const heldForYou = () => all().filter((a) => a.closed == null && a.held);
const who = (id) => store.state.npcs[id];

/** People a trust can be set up for: the young in the family, mostly. */
export const trustCandidates = () => player().npcIds.map(who).filter((n) => n?.alive && ['child', 'grandchild', 'greatgrandchild', 'niece', 'sibling', 'relative'].includes(n.role));

export function createTrust({ beneficiaryId, amount, releaseAge = 25 }) {
  const p = player();
  const c = country();
  const n = who(beneficiaryId);
  amount = Math.floor(amount);
  const min = localMoney(TRUST.min, c);
  if (p.age < 18) return result(false, 'You need to be 18.', 'neutral');
  if (!n?.alive || !trustCandidates().includes(n)) return result(false, 'Choose someone in your family.', 'neutral');
  if (trusts().length >= TRUST.max) return result(false, `You already have ${TRUST.max} trusts.`, 'neutral');
  if (trusts().some((t) => t.beneficiaryId === beneficiaryId)) return result(false, `There is already a trust for ${n.firstName}. You can add to it.`, 'neutral');
  if (!(releaseAge > n.age) || releaseAge > 40) return result(false, 'Choose an age they have not reached yet, up to 40.', 'neutral');
  if (!(amount >= min)) return result(false, `A trust needs at least ${fmtMoney(min, c)}.`, 'neutral');
  const fee = Math.ceil(amount * TRUST.fee);
  if (p.finance.cash < amount + fee) return result(false, `With the fee of ${fmtMoney(fee, c)}, you do not have enough.`, 'neutral');
  const L = ledgerOf();
  const cur = home();
  const id = `trust:${L.nt = (L.nt ?? 0) + 1}`;
  L.accounts[id] = { id, kind: 'trust', cur, bal: 0, name: `Trust for ${n.firstName} ${n.lastName}`, beneficiaryId, releaseAge, trustee: 'bank', opened: store.state.year, settlor: `${p.firstName} ${p.lastName}` };
  move(`Put into trust for ${n.firstName}`, [[id, toMinor(amount, cur)]], { cat: 'trust', walletCur: cur, walletMinor: -toMinor(amount + fee, cur), nominal: [['fees', cur, toMinor(fee, cur)]] });
  n.meters.relationship = Math.min(100, n.meters.relationship + (n.age >= 12 ? 5 : 0));
  const text = `You put ${fmtMoney(amount, c)} into a trust for ${n.firstName}, to be theirs at ${releaseAge}. The money is no longer yours. Setting it up cost ${fmtMoney(fee, c)}.`;
  log(text, 'system', 'good');
  milestone(`Set up a trust for ${n.firstName}.`, 'money');
  return { ...result(true, text), id };
}

export function addToTrust(id, amount) {
  const p = player();
  const t = trusts().find((x) => x.id === id);
  amount = Math.floor(amount);
  if (!t) return result(false, 'That trust has been paid out.', 'neutral');
  if (t.cur !== home()) return result(false, `It is held in ${t.cur}.`, 'neutral');
  if (!(amount > 0) || p.finance.cash < amount) return result(false, 'You do not have that much.', 'neutral');
  move(`Added to the ${t.name.charAt(0).toLowerCase() + t.name.slice(1)}`, [[id, toMinor(amount, t.cur)]], { cat: 'trust', walletCur: t.cur, walletMinor: -toMinor(amount, t.cur) });
  return result(true, `You added ${fmtMoney(amount, country())}. The trust now holds ${fmtExact(store.state.ledger.accounts[id].bal, t.cur)}.`, 'neutral');
}

const nominal = (L, cat, cur) => { const id = `n:${cat}:${cur}`; L.accounts[id] ??= { id, kind: 'nominal', cur, cat, bal: 0 }; return id; };
const entry = (L, t, desc, cat, entries, key) => post(L, { year: store.state.year, age: player().age, cat, desc, src: 'trust', key, entries });

/** Pays a trust out to the person it was for. */
function release(t) {
  const L = store.state.ledger;
  const n = who(t.beneficiaryId);
  const units = Math.round(fromMinor(t.bal, t.cur));
  entry(L, t, `${t.name}: paid out to ${n.firstName} at ${n.age}`, 'trust', [[t.id, -t.bal], [nominal(L, 'trust', t.cur), t.bal]]);
  if (n.life) n.life.savings += units; else n.savings = (n.savings ?? 0) + units;
  n.meters.relationship = Math.min(100, n.meters.relationship + 8);
  t.closed = store.state.year; t.paid = units;
  log(`${n.firstName} is ${n.age}. The trust you set up has paid them ${fmtExact(toMinor(units, t.cur), t.cur)}.`, 'system', 'good');
}

/** Yearly: trusts grow a little, pay out when the time comes, and one held for the player becomes theirs. */
export function tickTrusts() {
  const L = store.state.ledger;
  if (!L) return;
  const p = player();
  for (const t of all().filter((x) => x.closed == null)) {
    const g = Money.bp(t.bal, TRUST.growthBp);
    if (g > 0) entry(L, t, `${t.name}: the year's growth`, 'trustGrowth', [[t.id, g], [nominal(L, 'trustGrowth', t.cur), -g]], `trust:${t.id}:${store.state.year}`);
    if (t.held) {
      if (p.age < t.releaseAge) continue;
      book();
      const sum = t.bal;
      const wallet = moveWallet(t.cur, t.bal);
      entry(L, t, `${t.name}: it is yours now`, 'inheritance', [[t.id, -t.bal], [wallet, t.bal]]);
      log(`You are ${p.age}. The trust ${t.settlor} left for you is yours: ${fmtExact(sum, t.cur)}.`, 'system', 'good');
      p.milestones.push({ age: p.age, text: `Came into the trust ${t.settlor} left.`, kind: 'money' });
      t.closed = store.state.year;
      continue;
    }
    const n = who(t.beneficiaryId);
    if (!n?.alive) { // it comes back to whoever set it up
      book();
      const wallet = moveWallet(t.cur, t.bal);
      entry(L, t, `${t.name}: returned, as they have died`, 'trust', [[t.id, -t.bal], [wallet, t.bal]]);
      t.closed = store.state.year;
      log(`The trust you set up for ${n?.firstName ?? 'them'} has come back to you.`, 'system', 'neutral');
    } else if (n.age >= t.releaseAge) release(t);
  }
}

/**
 * At the player's death: a trust whose beneficiary is old enough pays out now.
 * The rest carry on being held; they were never part of the estate.
 * @returns {{to:string, name:string, amount:number, how:string, held:boolean}[]}
 */
export function trustsAtDeath() {
  const out = [];
  for (const t of trusts()) {
    const n = who(t.beneficiaryId);
    if (!n?.alive) continue;
    const amount = Math.round(fromMinor(t.bal, t.cur));
    const held = n.age < t.releaseAge;
    out.push({ to: n.id, name: `${n.firstName} ${n.lastName}`, amount, how: held ? `a trust, held until they are ${t.releaseAge}` : 'a trust', held, cur: t.cur, releaseAge: t.releaseAge });
    if (!held) release(t);
  }
  return out;
}

/**
 * When an heir carries on: a trust that was being held for them moves into
 * their own books, still held, still not theirs to spend until the age set.
 */
export function carryTrust(old, next, heirId, settlor) {
  for (const t of all(old)) {
    if (t.closed != null || t.held || t.beneficiaryId !== heirId || !t.bal) continue;
    const L = ledgerOf(next);
    const id = `trust:${L.nt = (L.nt ?? 0) + 1}`;
    L.accounts[id] = { id, kind: 'trust', cur: t.cur, bal: 0, name: `Trust from ${settlor}`, held: true, releaseAge: t.releaseAge, trustee: 'bank', opened: t.opened, settlor };
    const n = `n:trust:${t.cur}`;
    L.accounts[n] ??= { id: n, kind: 'nominal', cur: t.cur, cat: 'trust', bal: 0 };
    post(L, { year: next.year, age: next.player.age, cat: 'trust', src: 'estate', desc: `Held in trust for you, set up by ${settlor}`, entries: [[id, t.bal], [n, -t.bal]] });
  }
}
