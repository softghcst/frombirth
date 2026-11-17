// Money between people: how a couple shares the bills, an account held
// jointly, gifts and loans to people the player knows, and pocket money for
// their children.
//
// Nobody's money is anybody else's by default. Marriage merges nothing; a
// partner agrees to an arrangement or does not; a relative can turn a loan
// down; and what is lent is owed back by the person who took it.
//   p.flags.moneyWith = 'separate' | 'equal' | 'income'
//   p.finance.lent    = [{ id, npcId, name, amount, left, year, years, missed, status }]
//   p.flags.allowance = 0 | 1 | 2
import { store, player, country, npcsByRole, log } from '../state.js';
import { fmtMoney, localCost, clamp } from '../util.js';
import { rng } from '../rng.js';
import { FAMILY_LAW, FAMILY_LAW_OF, decimalsOf } from '../data/money.js';
import { book, ledgerOf, toMinor, fromMinor } from './ledger.js';
import { move, banksHere, accounts, rateAt, shareOf } from './banking.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const home = () => country().currency.code;
const npc = (id) => store.state.npcs[id];
const spouse = () => npcsByRole('spouse')[0] ?? null;
const savingsOf = (n) => (n.life ? n.life.savings : n.savings ?? 0);
const addSavings = (n, d) => { if (n.life) n.life.savings += d; else n.savings = (n.savings ?? 0) + d; };
const earns = (n) => n?.life?.job?.salary ?? n?.life?.pension ?? 0;

export const familyLawOf = (countryId = player().countryId) => FAMILY_LAW_OF[countryId] ?? 'equal';
export const familyLaw = () => ({ id: familyLawOf(), ...FAMILY_LAW[familyLawOf()] });

// ---------- A couple's bills ----------

export const ARRANGEMENTS = {
  separate: { name: 'Each pays their own way', line: 'You each cover roughly your own share of the household. Nothing else is shared.' },
  equal: { name: 'Split the bills evenly', line: 'The household costs are halved, whatever each of you earns.' },
  income: { name: 'Share the bills by income', line: 'Whoever earns more pays more of the household costs.' },
};
export const arrangement = () => (ARRANGEMENTS[player().flags.moneyWith] ? player().flags.moneyWith : 'separate');

/**
 * The player's share of the household's costs, as the year's bills use it.
 * With no arrangement made it is what the game has always charged.
 */
export function billShare(yourIncome) {
  const s = spouse();
  if (!s) return 1;
  const theirs = earns(s);
  if (!theirs) return 1.15; // one income supports two people
  const how = arrangement();
  if (how === 'equal') return 0.5;
  if (how === 'income') return clamp(yourIncome / Math.max(1, yourIncome + theirs), 0.15, 0.9);
  return 0.55;
}

/** Proposes a way of sharing the bills. A partner agrees if it is fair to them, or if they love you enough. */
export function proposeArrangement(how) {
  const p = player();
  const s = spouse();
  if (!s) return result(false, 'You are not married.', 'neutral');
  if (!ARRANGEMENTS[how]) return result(false, 'Choose an arrangement.', 'neutral');
  if (how === arrangement()) return result(false, 'That is how you do things already.', 'neutral');
  const mine = (p.career.salary || 0) + (p.career.partTime?.salary || 0);
  const theirs = earns(s);
  // What it would cost them, against what it costs them now.
  const worse = how === 'equal' ? theirs < mine * 0.6 : how === 'income' ? theirs > mine * 1.4 : false;
  if (worse && s.meters.relationship < 70) {
    s.meters.relationship = clamp(s.meters.relationship - 4);
    const text = `${s.firstName} did not agree. ${how === 'equal' ? 'On what they earn, half of everything is more than they can manage.' : 'They would be paying for most of it, and said so.'}`;
    log(text, 'system', 'neutral');
    return result(false, text, 'neutral');
  }
  p.flags.moneyWith = how;
  s.meters.relationship = clamp(s.meters.relationship + (worse ? -2 : 3));
  const text = `You and ${s.firstName} agreed: ${ARRANGEMENTS[how].name.toLowerCase()}.`;
  log(text, 'system', 'good');
  return result(true, text);
}

// ---------- A joint account ----------

export const jointAccounts = () => accounts().filter((a) => a.joint);

/** Opens a savings account in both names. The partner has to want one. */
export function openJoint(units = 0) {
  const p = player();
  const s = spouse();
  const bank = banksHere().find((b) => b.products.includes('savings'));
  if (!s) return result(false, 'A joint account is for a married couple.', 'neutral');
  if (!bank) return result(false, 'No bank here offers one.', 'neutral');
  if (jointAccounts().some((a) => a.joint === s.id)) return result(false, `You and ${s.firstName} already have one.`, 'neutral');
  if (!Number.isInteger(units) || units < 0 || units > Math.floor(p.finance.cash)) return result(false, 'Choose an amount you have.', 'neutral');
  if (s.meters.relationship < 45) {
    const text = `${s.firstName} would rather keep your money apart for now.`;
    log(text, 'system', 'neutral');
    return result(false, text, 'neutral');
  }
  const L = ledgerOf();
  const cur = home();
  const id = `bank:${L.nb = (L.nb ?? 0) + 1}`;
  L.accounts[id] = { id, kind: 'bank', cur, bal: 0, bankId: bank.id, product: 'savings', name: 'Joint savings account', opened: store.state.year, openedAge: p.age,
    rateBp: rateAt('savings', bank), feeMinor: 0, joint: s.id, contrib: { you: 0, them: 0 },
    owners: [{ id: p.id, role: 'owner' }, { id: s.id, role: 'joint_owner' }] };
  if (units) { move('Opening deposit: joint savings account', [[id, toMinor(units, cur)]], { walletCur: cur, walletMinor: -toMinor(units, cur) }); L.accounts[id].contrib.you = toMinor(units, cur); }
  const text = `You and ${s.firstName} opened a joint savings account with ${bank.name}${units ? `, and you paid in ${fmtMoney(units, country())}` : ''}. It belongs to both of you.`;
  log(text, 'system', 'good');
  return { ...result(true, text), id };
}

/** Divides a joint account when a marriage ends: evenly, or by what each put in, as the law here has it. */
export function splitJoint(npcId) {
  const n = npc(npcId);
  let kept = 0;
  for (const a of jointAccounts().filter((x) => x.joint === npcId)) {
    const acct = store.state.ledger.accounts[a.id];
    const d = a.cur === home() ? 1 : 10 ** decimalsOf(a.cur); // money in another currency is kept in whole units
    const mine = Math.floor(acct.bal * shareOf(acct) / d) * d;
    const theirs = acct.bal - mine;
    if (acct.bal) move(`Joint account divided with ${n?.firstName ?? 'your former partner'}`, [[a.id, -acct.bal]], { walletCur: a.cur, walletMinor: mine, nominal: [['jointPartner', a.cur, theirs]] });
    if (n && theirs) addSavings(n, Math.round(fromMinor(theirs, a.cur)));
    acct.closed = store.state.year;
    kept += fromMinor(mine, a.cur);
  }
  return kept;
}

// ---------- Giving and lending ----------

const lent = () => (player().finance.lent ??= []);
export const loansOut = () => lent().filter((l) => l.status === 'open');
const canDeal = (n) => n?.alive && n.age >= 18 && n.role !== 'pet';

/** Gives money to someone. It is theirs: nothing is owed. They may be too proud to take it. */
export function giveMoney(npcId, amount) {
  const p = player();
  const n = npc(npcId);
  amount = Math.floor(amount);
  if (!canDeal(n)) return result(false, 'They cannot take money from you.', 'neutral');
  if (!(amount > 0) || p.finance.cash < amount) return result(false, 'You do not have that much to give.', 'neutral');
  if (n.meters.relationship < 20) {
    const text = `${n.firstName} would not take it. Not from you.`;
    log(text, 'system', 'neutral');
    return result(false, text, 'neutral');
  }
  p.finance.cash -= amount; addSavings(n, amount);
  const weight = Math.min(12, 2 + Math.round(amount / Math.max(1, localCost(2000, country())) * 4));
  n.meters.relationship = clamp(n.meters.relationship + weight);
  n.lastInteractionAge = p.age;
  p.hidden.karma = clamp(p.hidden.karma + 1);
  const text = `You gave ${n.firstName} ${fmtMoney(amount, country())}. It is theirs to keep.`;
  log(text, 'system', 'good');
  book({ cat: 'giftOut', src: 'action', desc: text });
  return result(true, text);
}

/** Lends money to someone, to be paid back over some years without interest. They can say no. */
export function lendMoney(npcId, amount, years = 3) {
  const p = player();
  const n = npc(npcId);
  amount = Math.floor(amount);
  if (!canDeal(n)) return result(false, 'They cannot borrow from you.', 'neutral');
  if (!(amount > 0) || p.finance.cash < amount) return result(false, 'You do not have that much to lend.', 'neutral');
  if (loansOut().some((l) => l.npcId === npcId)) return result(false, `${n.firstName} already owes you money.`, 'neutral');
  // Some people would rather go without than owe.
  if (n.meters.relationship < 30 || (savingsOf(n) > amount * 3 && n.meters.money > 60)) {
    const text = n.meters.relationship < 30 ? `${n.firstName} would rather not owe you anything.` : `${n.firstName} thanked you, and said they can manage.`;
    log(text, 'system', 'neutral');
    return result(false, text, 'neutral');
  }
  p.finance.cash -= amount; addSavings(n, amount);
  lent().push({ id: `lent${lent().length + 1}_${store.state.year}`, npcId, name: `Lent to ${n.firstName} ${n.lastName}`, amount, left: amount, year: store.state.year, years: Math.max(1, years), missed: 0, status: 'open' });
  n.meters.relationship = clamp(n.meters.relationship + 4);
  n.lastInteractionAge = p.age;
  const text = `You lent ${n.firstName} ${fmtMoney(amount, country())}, to be paid back over ${years} ${years === 1 ? 'year' : 'years'}. No interest.`;
  log(text, 'system', 'neutral');
  book({ cat: 'familyLoan', src: 'action', desc: text });
  return result(true, text, 'neutral');
}

/** Lets a debt go. What is left of it becomes a gift. */
export function forgiveLoan(id) {
  const l = lent().find((x) => x.id === id && x.status === 'open');
  if (!l) return result(false, 'That is already settled.', 'neutral');
  const n = npc(l.npcId);
  const was = l.left;
  l.left = 0; l.status = 'forgiven'; l.endYear = store.state.year;
  if (n?.alive) n.meters.relationship = clamp(n.meters.relationship + 12);
  const text = `You told ${n?.firstName ?? 'them'} to forget the ${fmtMoney(was, country())} still owing.`;
  log(text, 'system', 'good');
  book({ cat: 'giftOut', src: 'action', desc: text });
  return result(true, text);
}

/** Yearly: people pay back what they can, if they are the sort who do. */
function tickLent() {
  const p = player();
  const c = country();
  for (const l of loansOut()) {
    const n = npc(l.npcId);
    if (!n?.alive) {
      const was = l.left; l.left = 0; l.status = 'lost'; l.endYear = store.state.year;
      log(`${n?.firstName ?? 'Someone who owed you money'} has died. The ${fmtMoney(was, c)} still owing will not be repaid.`, 'system', 'bad');
      book({ cat: 'losses', src: 'year', desc: `A loan to ${n?.firstName ?? 'someone'} that will never be repaid` });
      continue;
    }
    const due = Math.min(l.left, Math.ceil(l.amount / l.years));
    const willing = rng.chance(clamp(0.55 + n.meters.relationship / 250 - (n.meters.crazy ?? 30) / 300, 0.1, 0.97) );
    if (willing && savingsOf(n) >= due) {
      addSavings(n, -due); p.finance.cash += due; l.left -= due; l.missed = 0;
      if (!l.left) { l.status = 'repaid'; l.endYear = store.state.year; n.meters.relationship = clamp(n.meters.relationship + 3); log(`${n.firstName} paid back the last of what they owed you.`, 'system', 'good'); }
      book({ cat: 'familyLoan', src: 'year', desc: `${n.firstName} repaid ${fmtMoney(due, c)} of what you lent` });
    } else {
      l.missed += 1;
      n.meters.relationship = clamp(n.meters.relationship - 2); // owing money sits between people
      if (l.missed === 1) log(`${n.firstName} did not pay anything back this year.`, 'system', 'neutral');
      if (l.missed === 3) log(`${n.firstName} has paid nothing for three years. You may have to decide what the money is worth to you.`, 'system', 'bad');
    }
  }
}

// ---------- Children ----------

export const ALLOWANCES = [
  { name: 'No pocket money', cost: 0 },
  { name: 'A little pocket money', cost: 250, sense: 1 },
  { name: 'Generous pocket money', cost: 900, sense: 1 },
];
export const allowance = () => clamp(player().flags.allowance ?? 0, 0, 2);
const ofAge = () => npcsByRole('child').filter((k) => k.age >= 5 && k.age < 18);
export const allowanceCost = (level = allowance()) => ofAge().length * localCost(ALLOWANCES[level].cost, country());
export function setAllowance(level) {
  if (!ALLOWANCES[level]) return result(false, 'Choose an amount.', 'neutral');
  player().flags.allowance = level;
  return result(true, `${ALLOWANCES[level].name}${level ? `: ${fmtMoney(localCost(ALLOWANCES[level].cost, country()), country())} a year for each child between 5 and 17` : ''}.`, 'neutral');
}
function tickAllowance() {
  const p = player();
  const level = allowance();
  const kids = ofAge();
  if (!level || !kids.length) return;
  const cost = allowanceCost(level);
  if (p.finance.cash < cost) { log('There was no money for pocket money this year.', 'system', 'neutral'); return; }
  p.finance.cash -= cost;
  for (const k of kids) {
    // Having money of their own to manage teaches something; it does not decide who they become.
    k.flags.moneySense = Math.min(20, (k.flags.moneySense ?? 0) + ALLOWANCES[level].sense);
    k.meters.relationship = clamp(k.meters.relationship + 1);
  }
  book({ cat: 'childcare', src: 'year', desc: 'Pocket money for your children' });
}

/** Yearly: a partner pays into what you share, debts between people move, children get their pocket money. */
export function tickFamilyMoney() {
  const p = player();
  for (const a of jointAccounts()) {
    const s = npc(a.joint);
    if (!s?.alive || s.role !== 'spouse') continue;
    const give = Math.min(Math.max(0, savingsOf(s)), Math.round(earns(s) * (1 - country().incomeTax) * 0.05));
    if (give <= 0 || a.cur !== home()) continue;
    const m = toMinor(give, a.cur);
    move(`${s.firstName} paid into your joint account`, [[a.id, m]], { key: `joint:${a.id}:${store.state.year}`, nominal: [['jointPartner', a.cur, -m]] });
    store.state.ledger.accounts[a.id].contrib.them += m;
    addSavings(s, -give);
  }
  if (p.age >= 18) { tickLent(); tickAllowance(); }
}
