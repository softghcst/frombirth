// A business of the player's own: started with real money, run for better or
// worse, and worth only what it is worth.
//
// What is kept apart, on purpose:
//   - the business's money (its till) is not the owner's money. Takings go
//     into the till; the owner sees only what they choose to take out, and
//     that is taxed as income when they do;
//   - the owner's wealth counts their stake at its value, not the takings;
//   - owning it is not running it. An heir can inherit a stake; a manager runs it.
// A business that fails takes what was put into it, and nothing more: nobody
// comes after the owner for its debts. The types and figures are invented.
//   asset = { id, kind: 'business', catalogId, name, stake, till, value, purchasePrice, boughtAtAge,
//             founded, manager: 'you'|'hired', payout: 0|0.5|1, scale, lossYears, profits: [], takings }
import { store, player, country, log, milestone } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { uid, fmtMoney, localCost, clamp } from '../util.js';
import { rng } from '../rng.js';
import { BUSINESS_TYPES, BUSINESS } from '../data/money.js';
import { book, toMinor } from './ledger.js';
import { phaseOf } from './economy.js';
import { recordLoss } from './insurance.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const TYPE = Object.fromEntries(BUSINESS_TYPES.map((t) => [t.id, t]));
export const businessTypeOf = (a) => TYPE[a.catalogId];
export const businesses = () => player().assets.filter((a) => a.kind === 'business');
export const businessById = (id) => businesses().find((a) => a.id === id);
const NAMES = ['Harbour', 'Kite', 'Lantern', 'Juniper', 'Fieldfare', 'Marrow', 'Tallow', 'Wren', 'Copper', 'Saltmarsh'];

/** What the player's stake is worth: their share of the till, and of a few years of profit. */
function revalue(a) {
  const recent = a.profits.slice(-3);
  const avg = recent.length ? recent.reduce((s, x) => s + x, 0) / recent.length : 0;
  a.value = Math.max(0, Math.round((Math.max(0, a.till) + Math.max(0, avg) * BUSINESS.multiple) * a.stake));
}

export function startOptions() {
  const p = player();
  const c = country();
  return BUSINESS_TYPES.map((t) => {
    const cost = localCost(t.cost, c);
    let reason = '';
    if (p.age < BUSINESS.minAge) reason = `You need to be ${BUSINESS.minAge}.`;
    else if (p.legal.incarceration) reason = 'Not from a cell.';
    else if (businesses().length >= 3) reason = 'Three businesses are enough for anyone.';
    else if (p.finance.cash < cost) reason = `It takes ${fmtMoney(cost, c)} to start.`;
    return { ...t, cost, ok: !reason, reason };
  });
}

export function startBusiness(typeId) {
  const p = player();
  const c = country();
  const o = startOptions().find((x) => x.id === typeId);
  if (!o) return result(false, 'There is no such business.', 'neutral');
  if (!o.ok) return result(false, o.reason, 'neutral');
  p.finance.cash -= o.cost;
  const name = `${rng.pick(NAMES)} ${o.name}`;
  // Half of what is put in is spent setting up; the rest is the money the business starts with.
  const a = { id: uid('asset'), kind: 'business', catalogId: o.id, name, stake: 1, till: Math.round(o.cost * 0.5), value: 0, purchasePrice: o.cost, boughtAtAge: p.age,
    founded: store.state.year, manager: 'you', payout: 0.5, scale: 0.5, lossYears: 0, profits: [], takings: 0 };
  revalue(a);
  p.assets.push(a);
  const text = `You started ${name}. It took ${fmtMoney(o.cost, c)}: half went on setting up, and half is in the till. That money is the business's now, not yours.`;
  log(text, 'system', 'good');
  milestone(`Started a business: ${name}.`, 'money');
  book({ cat: 'business', src: 'action', desc: text });
  return result(true, text);
}

/** Puts more of the player's own money into the business. */
export function fundBusiness(id, amount) {
  const p = player();
  const a = businessById(id);
  amount = Math.floor(amount);
  if (!a) return result(false, 'You do not own it.', 'neutral');
  if (!(amount > 0) || p.finance.cash < amount) return result(false, 'You do not have that much.', 'neutral');
  p.finance.cash -= amount; a.till += Math.round(amount); a.purchasePrice += amount; // other owners do not pay in; they are diluted by nothing
  revalue(a);
  const text = `You put ${fmtMoney(amount, country())} of your own money into ${a.name}.`;
  log(text, 'system', 'neutral');
  book({ cat: 'business', src: 'action', desc: text });
  return result(true, text, 'neutral');
}

export function setBusiness(id, { manager, payout } = {}) {
  const a = businessById(id);
  if (!a) return result(false, 'You do not own it.', 'neutral');
  if (manager === 'you' && a.inherited && !a.learned) return result(false, 'You own it, but you have never run it. Keep the manager for now, or learn the business first.', 'neutral');
  if (manager === 'you' || manager === 'hired') a.manager = manager;
  if ([0, 0.5, 1].includes(payout)) a.payout = payout;
  return result(true, `${a.name}: ${a.manager === 'you' ? 'you run it yourself' : 'a manager runs it'}, and ${a.payout === 0 ? 'the profits stay in the business' : a.payout === 1 ? 'you take out all the profit you can' : 'you take out half the profit'}.`, 'neutral');
}

/** An heir spends a year learning the business they were left, so that they can run it. */
export function learnBusiness(id) {
  const p = player();
  const a = businessById(id);
  if (!a?.inherited || a.learned) return result(false, 'There is nothing to learn that you do not know.', 'neutral');
  if (a.learnYear === store.state.year) return result(false, 'You are already spending this year on it.', 'neutral');
  a.learnYear = store.state.year;
  if (p.stats.intellect + p.stats.charm + rng.int(0, 60) < 110) { const text = `You spent the year in the back office of ${a.name}. You are not ready to run it yet.`; log(text, 'system', 'neutral'); return result(false, text, 'neutral'); }
  a.learned = true;
  const text = `After a year beside the manager, you know how ${a.name} works. You could run it yourself now.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** Tax on a gain when a stake is sold: half the income-tax rate, as for investments. */
const gainsTax = (gain) => Math.max(0, Math.round(gain * country().incomeTax * 0.5));

/** What a share of the business would sell for. */
export const stakePrice = (a, fraction) => Math.round(a.value * (fraction / a.stake) * 0.9);
/** People the player knows who could afford a share, and would consider one. */
export function buyersFor(id, fraction) {
  const a = businessById(id);
  if (!a) return [];
  const price = stakePrice(a, fraction);
  return player().npcIds.map((x) => store.state.npcs[x]).filter((n) => n?.alive && n.age >= 21 && n.role !== 'pet' && (n.life?.savings ?? n.savings ?? 0) >= price);
}
const savingsOf = (n) => n.life?.savings ?? n.savings ?? 0;
const spend = (n, d) => { if (n.life) n.life.savings -= d; else n.savings = (n.savings ?? 0) - d; };
const earn = (n, d) => { if (n.life) n.life.savings += d; else n.savings = (n.savings ?? 0) + d; };

/**
 * Sells part of the business: to someone the player knows, who pays from their
 * own savings and can say no, or to an outside investor, who becomes someone
 * the player knows. Either way they own their share from then on, and are paid
 * their part of any profit taken out.
 */
export function sellStake(id, fraction, buyerId = null) {
  const p = player();
  const c = country();
  const a = businessById(id);
  if (!a) return result(false, 'You do not own it.', 'neutral');
  if (!(fraction > 0) || fraction >= a.stake) return result(false, 'To sell all of it, sell the business.', 'neutral');
  if (a.value <= 0) return result(false, 'Nobody will buy into a business that is worth nothing.', 'neutral');
  const price = stakePrice(a, fraction);
  let buyer = buyerId ? store.state.npcs[buyerId] : null;
  if (buyerId) {
    if (!buyer?.alive || savingsOf(buyer) < price) return result(false, 'They do not have that kind of money.', 'neutral');
    // A friend or relative will put money in only if they trust you, and if the business looks like it works.
    const doing = a.profits.slice(-2).reduce((s, x) => s + x, 0);
    if (buyer.meters.relationship < 55 || (doing <= 0 && rng.chance(0.7))) {
      const text = `${buyer.firstName} thought about it, and said no. ${doing <= 0 ? 'The figures did not persuade them.' : 'They would rather keep their money where it is.'}`;
      log(text, 'system', 'neutral');
      return result(false, text, 'neutral');
    }
    spend(buyer, price);
  } else {
    buyer = makeNpc({ role: 'friend', countryId: p.countryId, age: rng.int(35, 65), relationship: rng.int(40, 60) });
    buyer.flags.tag = 'investor'; buyer.flags.title = `Investor in ${a.name}`;
    store.state.npcs[buyer.id] = buyer; p.npcIds.push(buyer.id);
  }
  const part = (a.partners ??= []).find((x) => x.npcId === buyer.id);
  if (part) part.stake = Math.round((part.stake + fraction) * 1000) / 1000; else a.partners.push({ npcId: buyer.id, stake: fraction, since: store.state.year });
  buyer.lastInteractionAge = p.age;
  const cost = a.purchasePrice * (fraction / a.stake);
  const tax = gainsTax(price - cost);
  p.finance.cash += price - tax; p.finance.lifetimeTaxPaid += tax;
  a.purchasePrice -= cost; a.stake = Math.round((a.stake - fraction) * 1000) / 1000;
  revalue(a);
  const text = `You sold ${Math.round(fraction * 100)}% of ${a.name} to ${buyerId ? '' : 'an investor, '}${buyer.firstName} ${buyer.lastName}, for ${fmtMoney(price, c)}${tax ? `, and paid ${fmtMoney(tax, c)} tax on the gain` : ''}. You own ${Math.round(a.stake * 100)}% of it now.`;
  log(text, 'system', 'neutral');
  book({ cat: 'business', src: 'action', desc: text, split: [['tax', toMinor(tax, c.currency.code)]] });
  return result(true, text, 'neutral');
}

export const salePrice = (a) => Math.round(a.value * (1 - BUSINESS.saleFee));
/** Sells the whole of the player's stake. @param {number} [haircut] a forced sale fetches less */
export function sellBusiness(id, haircut = 1) {
  const p = player();
  const c = country();
  const a = businessById(id);
  if (!a) return result(false, 'You do not own it.', 'neutral');
  const price = Math.round(salePrice(a) * haircut);
  const tax = gainsTax(price - a.purchasePrice);
  p.finance.cash += price - tax; p.finance.lifetimeTaxPaid += tax;
  p.assets = p.assets.filter((x) => x !== a);
  const text = `You sold ${a.stake < 1 ? `your ${Math.round(a.stake * 100)}% of ` : ''}${a.name} for ${fmtMoney(price, c)}${tax ? `, and paid ${fmtMoney(tax, c)} tax on the gain` : ''}.`;
  log(text, 'system', price >= a.purchasePrice ? 'good' : 'neutral');
  if (haircut === 1) milestone(`Sold ${a.name}.`, 'money');
  book({ cat: 'business', src: 'action', desc: text, split: [['tax', toMinor(tax, c.currency.code)]] });
  return { ...result(true, text, 'neutral'), raised: price - tax };
}

/** Yearly: a year of trading. Profit stays in the till unless the owner takes it out. */
export function tickBusiness() {
  const p = player();
  const c = country();
  for (const a of businesses()) {
    const t = businessTypeOf(a);
    const climate = { boom: 1.12, steady: 1, slump: 0.85 }[phaseOf()] ?? 0.75; // anything worse than a recession
    const skill = a.manager === 'you' ? clamp(p.stats[t.skill], 10, 100) / 60 * (p.career.careerId ? 0.75 : 1) : 0.85; // two jobs are done less well than one
    a.takings = Math.round(localCost(t.takings, c) * a.scale * climate * rng.around(1, t.swing * 0.25));
    let profit = Math.round(a.takings * (t.margin * skill + rng.around(0, t.swing * 0.08)));
    if (a.manager === 'hired' && profit > 0) profit = Math.round(profit * (1 - BUSINESS.managerShare)); // the manager is paid from what they make
    const companyTax = profit > 0 ? Math.round(profit * c.incomeTax * 0.6) : 0;
    profit -= companyTax;
    a.till += profit;
    // Now and then: a fire, a flood, a break-in. The business bears it; insurance, if it has any, can pay it back.
    if (rng.chance(BUSINESS.mishap)) {
      const what = rng.pick(['fire', 'flood', 'break-in']);
      const hit = Math.round(a.takings * rng.int(5, 25) / 100);
      const before = a.till;
      a.till -= hit; profit -= hit;
      recordLoss({ id: a.id, name: a.name, value: before }, before, a.till, what);
      log(`A ${what} at ${a.name} cost the business ${fmtMoney(hit, c)}.`, 'system', 'bad');
    }
    a.profits.push(profit);
    if (a.profits.length > 6) a.profits.shift();
    a.scale = clamp(a.scale + (profit > 0 ? 0.12 : -0.05), 0.3, 2.2);
    a.lossYears = a.till < 0 ? a.lossYears + 1 : 0;

    // What the owner takes out is theirs, and taxed as theirs. What stays is the business's.
    const reserve = Math.round(localCost(t.cost, c) * 0.2);
    let taken = 0; let tax = 0;
    if (profit > 0 && a.payout > 0 && a.till > reserve) {
      const out = Math.min(a.till - reserve, Math.round(profit * a.payout));
      a.till -= out; // every owner is paid in proportion
      taken = Math.round(out * a.stake);
      for (const x of a.partners ?? []) { const n = store.state.npcs[x.npcId]; if (n?.alive) earn(n, Math.round(out * x.stake)); }
      tax = Math.round(taken * c.incomeTax * 0.5);
      p.finance.cash += taken - tax; p.finance.lifetimeEarned += taken; p.finance.lifetimeTaxPaid += tax;
    }
    revalue(a);
    log(`${a.name} ${profit >= 0 ? `made ${fmtMoney(profit, c)}` : `lost ${fmtMoney(-profit, c)}`} this year${taken ? `. You took out ${fmtMoney(taken, c)} and paid ${fmtMoney(tax, c)} tax on it` : ''}.`, 'system', profit >= 0 ? 'good' : 'bad');
    if (taken) book({ cat: 'distribution', src: 'year', desc: `Profit taken from ${a.name}`, split: [['tax', toMinor(tax, c.currency.code)]] });

    if (a.lossYears >= BUSINESS.failAfter) {
      p.assets = p.assets.filter((x) => x !== a);
      p.stats.mood = clamp(p.stats.mood - 10);
      log(`${a.name} ran out of money and closed. What you put into it is gone; nothing more is owed.`, 'system', 'bad');
      milestone(`${a.name} failed.`, 'money');
    }
  }
}

export const businessLine = (a) => `${businessTypeOf(a).name} · ${a.stake < 1 ? `you own ${Math.round(a.stake * 100)}%` : 'yours outright'} · ${a.manager === 'you' ? 'you run it' : 'run by a manager'}`;
