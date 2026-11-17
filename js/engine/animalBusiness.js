// Businesses with animals: pet sitting, a grooming salon, boarding kennels, a
// training school, a riding school, a smallholding.
//
// The game has no business system of its own, so this is a small one, kept
// apart from the household's money:
//   state.animals.businesses[id] = { kind, name, owner, cash, reputation, clients, staff, effort, books[], closed }
// A business has its own cash. What it earns and spends stays in it; the owner
// takes money out (a draw, taxed as income) or puts money in. A business that
// runs out of money and is not rescued closes. Margins are modest, capacity is
// limited, and a business run badly loses clients and reputation.
//
// A smallholding's animals are kept as a flock, counted, not as individual
// pets: their welfare is a number the business answers for, and it is never
// a machine that turns animals into money.
import { store } from '../state.js';
import { rng } from '../rng.js';
import { clamp, cap, localCost, localWage, fmtMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { makeNpc } from './npcFactory.js';
import { incomeTax } from './finance.js';
import * as zoo from './animals.js';
import * as care from './animalCare.js';

const T = zoo.tools;
const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const say = (state, text, tone = 'neutral') => { const e = { age: state.player.age, text, kind: 'system', tone }; state.journal.push(e); return e; };

/**
 * What each kind of business is. Money in base units a year.
 *   start    what it takes to open           premises  rent or upkeep a year     price  what one client pays in a year
 *   perHead  clients one person can look after   base  clients a new business can expect   needs  who may open one (a reason, or '')
 */
export const KINDS = {
  petcare: { name: 'Pet sitting and dog walking', start: 400, premises: 0, price: 520, perHead: 12, base: 5, supplies: 0.4,
    needs: (s) => (s.player.age < 16 ? 'You must be sixteen.' : '') },
  grooming: { name: 'Grooming salon', start: 6000, premises: 9000, price: 380, perHead: 45, base: 18, supplies: 0.18,
    needs: (s) => (s.player.age < 18 ? 'You must be an adult.' : !(s.player.flags.animalExperience || s.player.career.history.some((h) => h.careerId === 'grooming') || s.player.career.careerId === 'grooming') ? 'You need experience with animals first: volunteer, foster, or work as a groomer.' : '') },
  boarding: { name: 'Boarding kennels and cattery', start: 15000, premises: 6000, price: 900, perHead: 22, base: 10, supplies: 0.25,
    needs: (s) => (s.player.age < 18 ? 'You must be an adult.' : care.homeSpace(s) !== 'land' ? 'Kennels need land: a country property of your own.' : '') },
  training: { name: 'Dog training school', start: 3000, premises: 4000, price: 300, perHead: 60, base: 20, supplies: 0.08,
    needs: (s) => (s.player.age < 18 ? 'You must be an adult.' : !(s.player.career.careerId === 'dog_training' || s.player.career.history.some((h) => h.careerId === 'dog_training')) ? 'You need to have worked as a dog trainer.' : '') },
  riding: { name: 'Riding school', start: 40000, premises: 12000, price: 1400, perHead: 16, base: 8, supplies: 0.12, horseCost: 3200,
    needs: (s) => (s.player.age < 21 ? 'You must be twenty-one.' : !s.player.flags.riderAdvanced ? 'You need to ride at an advanced level to teach.' : care.homeSpace(s) !== 'land' ? 'A riding school needs land: a country property of your own.' : '') },
  farm: { name: 'Smallholding', start: 8000, premises: 1500, farm: true,
    needs: (s) => (s.player.age < 18 ? 'You must be an adult.' : care.homeSpace(s) !== 'land' ? 'A smallholding needs land: a country property of your own.' : '') },
};
/** A smallholding's animals: what each head costs to keep well, and what it yields when it is kept well. Base units a year. */
export const LIVESTOCK = {
  hens: { name: 'hens', keep: 18, yield: 26, max: 60, buy: 8 },
  goats: { name: 'dairy goats', keep: 260, yield: 330, max: 12, buy: 180 },
  sheep: { name: 'sheep', keep: 120, yield: 140, max: 30, buy: 140 },
};
const WAGE = 22000;
/** Insurance, licences and an accountant: every business pays them, whatever it earns. */
const OVERHEAD = 450;

export function businesses(state = store.state) { const A = zoo.ensure(state); return (A.businesses ??= {}); }
export const myBusinesses = (state = store.state) => Object.values(businesses(state)).filter((b) => !b.closed && b.owner.id === state.player.id);
const C = (state) => COUNTRIES[state.player.countryId];
const money = (state, base) => localCost(base, C(state));

export function canStart(kind, state = store.state) {
  const k = KINDS[kind];
  if (!k) return { ok: false, why: 'There is no such business.' };
  const p = state.player;
  if (p.legal?.incarceration) return { ok: false, why: 'Not from in here.' };
  if (myBusinesses(state).some((b) => b.kind === kind)) return { ok: false, why: 'You already run one.' };
  const why = k.needs(state);
  if (why) return { ok: false, why };
  const cost = money(state, k.start);
  if (p.finance.cash < cost) return { ok: false, why: `It takes ${fmtMoney(cost, C(state))} to open. You do not have it.`, cost };
  return { ok: true, why: '', cost };
}

/** Opens a business. The start-up money leaves the household for good: equipment, licences, insurance, a sign. */
export function start(kind, state = store.state) {
  const can = canStart(kind, state);
  if (!can.ok) return result(false, can.why, 'neutral');
  const p = state.player; const k = KINDS[kind];
  p.finance.cash -= can.cost;
  const roll = T.seeded(`biz:${p.id}:${kind}`);
  const name = kind === 'petcare' ? `${p.firstName}'s Pet Care` : kind === 'farm' ? `${roll.pick(['Hollow', 'Brook', 'Long Meadow', 'Hill Top', 'Orchard'])} Smallholding` : `${roll.pick([p.lastName, p.city, 'Good Companions', 'Paws and Hooves'])} ${{ grooming: 'Grooming', boarding: 'Kennels', training: 'Dog Training', riding: 'Riding School' }[kind]}`;
  const id = `biz_${Object.keys(businesses(state)).length + 1}_${kind}`;
  const b = { id, kind, name, owner: T.ref(state, p.id), founded: state.year, city: p.city, countryId: p.countryId, currency: C(state).currency.code,
    cash: 0, reputation: 40, clients: 0, staff: 0, effort: 'steady', books: [], closed: null, staffNpc: null,
    ...(k.farm ? { livestock: { hens: 12, goats: 0, sheep: 0 }, welfare: 70 } : {}) };
  businesses(state)[id] = b;
  const text = `You opened ${b.name}. It cost ${fmtMoney(can.cost, C(state))} to set up. The first year will tell.`;
  say(state, text, 'good');
  p.milestones.push({ age: p.age, text: `Opened ${b.name}.`, kind: 'career' });
  return result(true, text, 'good', { id });
}

/** How hard the owner works it. 'easy' suits someone with a job as well; 'push' wins clients and costs the owner. */
export const EFFORT = { easy: { name: 'Ticking over', rep: -2, gain: 0.6 }, steady: { name: 'Steady', rep: 1, gain: 1 }, push: { name: 'Working all hours', rep: 3, gain: 1.35 } };
export function setEffort(id, effort, state = store.state) {
  const b = businesses(state)[id];
  if (!b || b.closed || !EFFORT[effort]) return result(false, 'That is not possible.', 'neutral');
  b.effort = effort;
  return result(true, `${b.name}: ${EFFORT[effort].name.toLowerCase()} from now on.`, 'neutral');
}
/** Takes someone on, or lets someone go. The first person hired is someone the player gets to know. */
export function setStaff(id, n, state = store.state) {
  const b = businesses(state)[id];
  if (!b || b.closed || b.kind === 'petcare' && n > 2 || n < 0 || n > 6) return result(false, 'That is not possible.', 'neutral');
  const p = state.player;
  if (n > 0 && !b.staffNpc) {
    const w = makeNpc({ role: 'coworker', countryId: b.countryId, age: rng.int(19, 55), relationship: 45 });
    w.occupation = KINDS[b.kind].farm ? 'farm hand' : 'animal care assistant'; w.flags.tag = `biz:${b.id}`; w.flags.title = `Works at ${b.name}`;
    state.npcs[w.id] = w; p.npcIds.push(w.id); b.staffNpc = w.id;
  }
  b.staff = n;
  return result(true, n ? `${b.name} now employs ${n} ${n === 1 ? 'person' : 'people'} besides you.` : `${b.name} is just you now.`, 'neutral');
}
/** Money from the business to the owner. Taxed as income, and only what the business actually has. */
export function draw(id, amount, state = store.state) {
  const b = businesses(state)[id];
  const p = state.player;
  amount = Math.round(amount);
  if (!b || b.closed || amount <= 0) return result(false, 'There is nothing to take.', 'neutral');
  if (amount > b.cash) return result(false, `${b.name} only has ${fmtMoney(b.cash, C(state))}.`, 'neutral');
  b.cash -= amount;
  const tax = incomeTax(amount, C(state));
  p.finance.cash += amount - tax; p.finance.lifetimeEarned += amount; p.finance.lifetimeTaxPaid += tax;
  (b.draws ??= []).push({ year: state.year, amount, tax });
  const text = `You took ${fmtMoney(amount, C(state))} out of ${b.name}, and paid ${fmtMoney(tax, C(state))} in tax on it.`;
  say(state, text);
  return result(true, text, 'neutral');
}
/** Money from the owner into the business. */
export function invest(id, amount, state = store.state) {
  const b = businesses(state)[id];
  const p = state.player;
  amount = Math.round(amount);
  if (!b || b.closed || amount <= 0 || p.finance.cash < amount) return result(false, 'You do not have that to put in.', 'neutral');
  p.finance.cash -= amount; b.cash += amount;
  (b.invested ??= []).push({ year: state.year, amount });
  return result(true, `You put ${fmtMoney(amount, C(state))} into ${b.name}.`, 'neutral');
}
/** Buys or sells livestock for a smallholding, within what the land and the business can look after. */
export function stock(id, kind, n, state = store.state) {
  const b = businesses(state)[id];
  const l = LIVESTOCK[kind];
  if (!b?.livestock || !l || b.closed) return result(false, 'That is not possible.', 'neutral');
  const next = b.livestock[kind] + n;
  if (next < 0 || next > l.max) return result(false, `The land will carry at most ${l.max} ${l.name}.`, 'neutral');
  const cost = money(state, l.buy) * n;
  if (n > 0 && b.cash < cost) return result(false, `${b.name} would need ${fmtMoney(cost, C(state))} for that.`, 'neutral');
  if (n > 0) b.cash -= cost; // animals sold on go to other smallholders, for what the business paid at most
  else b.cash += Math.round(money(state, l.buy) * -n * 0.6);
  b.livestock[kind] = next;
  return result(true, `${b.name} now keeps ${next} ${l.name}.`, 'neutral');
}
/** Closes a business: what is left is the owner's, after tax. */
export function close(id, state = store.state, why = 'closed') {
  const b = businesses(state)[id];
  if (!b || b.closed) return result(false, 'That business is not open.', 'neutral');
  if (b.cash > 0 && b.owner.id === state.player.id && state.player.alive) draw(id, b.cash, state);
  b.closed = { year: state.year, why };
  if (b.staffNpc && state.npcs[b.staffNpc]) { const w = state.npcs[b.staffNpc]; w.flags.title = `Used to work at ${b.name}`; }
  const text = `${b.name} has closed${why === 'closed' ? '' : `: ${why}`}.`;
  say(state, text, why === 'closed' ? 'neutral' : 'bad');
  return result(true, text, 'neutral');
}

/** Yearly. Each open business has its year: clients come and go, money comes in and goes out. Runs once for each year. */
export function tickBusinesses(state = store.state) {
  const A = zoo.ensure(state);
  if (A.bizYear === state.year) return;
  A.bizYear = state.year;
  const p = state.player;
  for (const b of Object.values(businesses(state))) {
    if (b.closed || b.founded === state.year) continue;
    const k = KINDS[b.kind];
    const busy = !!p.career.careerId && !p.career.retired; // an owner with a full-time job cannot give it everything
    const effort = EFFORT[busy && b.effort === 'push' ? 'steady' : b.effort];
    const hands = 1 + b.staff - (busy ? 0.5 : 0);
    const roll = T.seeded(`${b.id}:${state.year}`);
    let revenue = 0; let costs = money(state, k.premises) + money(state, OVERHEAD) + Math.round(localWage(WAGE, C(state)) * b.staff);
    if (k.farm) {
      // The flock is cared for well, or it is not. Welfare decides what it yields, and an unwell flock costs more.
      const heads = Object.entries(b.livestock);
      const workload = heads.reduce((s, [kind, n]) => s + n / LIVESTOCK[kind].max, 0);
      b.welfare = Math.round(clamp(b.welfare + (hands - workload * 1.5) * 8 + effort.rep * 2 + roll.int(-6, 4)));
      for (const [kind, n] of heads) {
        costs += money(state, LIVESTOCK[kind].keep) * n;
        revenue += Math.round(money(state, LIVESTOCK[kind].yield) * n * (b.welfare / 85) * (0.75 + roll.next() * 0.4));
      }
      if (b.welfare < 40) { costs += money(state, 600); b.reputation = clamp(b.reputation - 6); }
      // Old animals retire here and live out their days; they are replaced from the same flock.
    } else {
      const capacity = Math.round(k.perHead * hands);
      const target = Math.round((k.base + b.reputation * 0.5) * effort.gain);
      b.clients = Math.max(0, Math.min(capacity, Math.round(b.clients + (target - b.clients) * 0.5 + roll.int(-2, 2))));
      const stretched = b.clients / Math.max(1, capacity);
      revenue = Math.round(money(state, k.price) * b.clients * (0.9 + roll.next() * 0.2));
      costs += Math.round(revenue * k.supplies);
      if (k.horseCost) costs += money(state, k.horseCost) * Math.max(2, Math.ceil(b.clients / 8));
      b.reputation = Math.round(clamp(b.reputation + effort.rep + (stretched > 0.95 ? -4 : stretched < 0.7 ? 1 : 2) + roll.int(-2, 2)));
    }
    if (b.effort === 'push' && !busy) { p.stats.health = clamp(p.stats.health - 2); p.stats.mood = clamp(p.stats.mood - 1); }
    const profit = revenue - costs;
    b.cash += profit;
    b.books.push({ year: state.year, revenue, costs, profit, clients: b.clients, reputation: b.reputation, ...(k.farm ? { welfare: b.welfare } : {}) });
    if (b.owner.id === p.id) say(state, `${b.name}: ${fmtMoney(revenue, C(state))} in, ${fmtMoney(costs, C(state))} out. ${profit >= 0 ? `A profit of ${fmtMoney(profit, C(state))}` : `A loss of ${fmtMoney(-profit, C(state))}`}, kept in the business.`, profit >= 0 ? 'good' : 'bad');
    // Out of money. The owner can put more in; if they cannot, or the business is not theirs to rescue, it closes.
    if (b.cash < 0) {
      const need = -b.cash;
      if (b.owner.id === p.id && p.finance.cash >= need) { invest(b.id, need, state); say(state, `${b.name} ran out of money. You covered the ${fmtMoney(need, C(state))} it was short.`, 'bad'); } else { b.cash = 0; close(b.id, state, 'it ran out of money'); }
    }
  }
}

/** When a life ends: an adult heir takes the business on; otherwise it closes. Call after the record has crossed to the new life. */
export function passOn(old, next, heirId, ancestorId) {
  for (const b of Object.values(businesses(next))) {
    if (b.closed || b.owner.id !== old.player.id) continue;
    if (next.player.age >= 18) { b.owner = T.ref(next, next.player.id); (b.owners ??= []).push({ name: T.fullName(old.player), until: next.year }); say(next, `You have inherited ${b.name}.`, 'good'); } else { b.owner = { id: ancestorId, name: T.fullName(old.player) }; b.closed = { year: next.year, why: `${T.fullName(old.player)} died` }; }
  }
}

export function auditBusinesses(state = store.state) {
  const bad = [];
  for (const b of Object.values(businesses(state))) {
    if (!KINDS[b.kind]) bad.push(`${b.name}: an unknown kind of business`);
    if (b.cash < 0 && !b.closed) bad.push(`${b.name}: open with less than nothing`);
    for (const y of b.books) {
      if (y.revenue < 0 || y.costs < 0) bad.push(`${b.name}: negative takings or costs in ${y.year}`);
      if (y.revenue > 0 && y.profit > y.revenue * 0.6) bad.push(`${b.name}: an impossible margin in ${y.year}`);
    }
    if (new Set(b.books.map((y) => y.year)).size !== b.books.length) bad.push(`${b.name}: a year counted twice`);
    if (b.livestock) for (const [k, n] of Object.entries(b.livestock)) if (n < 0 || n > LIVESTOCK[k].max) bad.push(`${b.name}: an impossible number of ${k}`);
  }
  return bad;
}
