// Vehicles: licences, what is for sale, buying, servicing, selling, and the
// yearly depreciation, running costs and crash risk.
import { rng } from '../rng.js';
import { uid, clamp, localMoney, fmtMoney } from '../util.js';
import { player, country, log, milestone } from '../state.js';
import { resolve } from './conditions.js';
import { market } from './market.js';
import { borrow, loanOffer } from './loans.js';
import { VEHICLE_TYPES, VEHICLE_BY_ID, COLOURS, DRIVING_TEST, FLYING_LESSONS, SERVICE_COST, VEHICLE_AGE } from '../data/vehicles.js';

/** Lower-cases a name's first letter, unless it starts with an acronym (BMX, SUV). */
const lower = (name) => (/^[A-Z]{2}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const assetOf = (id) => player().assets.find((a) => a.id === id);
export const vehicles = () => player().assets.filter((a) => a.kind === 'vehicle');
export const vehicleTypeOf = (a) => VEHICLE_BY_ID[a.catalogId];

const yearActs = () => {
  const p = player();
  if (p.flags.carActs?.age !== p.age) p.flags.carActs = { age: p.age, test: 0, flying: 0, out: {} };
  return p.flags.carActs;
};

const worth = (type, age, condition) =>
  Math.max(localMoney(type.price * 0.03, country()),
    Math.round(type.price * country().currency.scale * (1 - type.dep) ** age * (0.5 + 0.5 * condition / 100)));

// ---------- Licences ----------

export const hasLicence = () => !!player().flags.canDrive;
export const hasPilotLicence = () => !!player().flags.pilotLicence;

function passChance(spec) {
  let chance = spec.base;
  for (const [path, w] of Object.entries(spec.factors)) chance += w * ((Number(resolve(path)) || 0) - 50) / 100;
  return clamp(chance, 0.05, 0.95);
}

export const canTakeDrivingTest = () => player().age >= DRIVING_TEST.minAge && !hasLicence();
export function takeDrivingTest() {
  const p = player();
  const c = country();
  const fee = localMoney(DRIVING_TEST.fee, c);
  if (!canTakeDrivingTest()) return result(false, 'You cannot take the test right now.', 'neutral');
  if (yearActs().test) return result(false, 'The next test slot is next year.', 'neutral');
  if (p.finance.cash < fee) return result(false, `Lessons and the test cost ${fmtMoney(fee, c)}.`, 'neutral');
  yearActs().test = 1;
  p.finance.cash -= fee;
  if (!rng.chance(passChance(DRIVING_TEST.pass))) {
    const text = 'You failed your driving test: you mounted the kerb on the way out of the test centre.';
    log(text, 'system', 'bad');
    return result(false, text);
  }
  p.flags.canDrive = true;
  const text = 'You passed your driving test.';
  log(text, 'system', 'good');
  milestone('Passed the driving test.', 'life');
  return result(true, text);
}

export const canLearnToFly = () => player().age >= FLYING_LESSONS.minAge && !hasPilotLicence();
export function learnToFly() {
  const p = player();
  const c = country();
  const fee = localMoney(FLYING_LESSONS.fee, c);
  if (!canLearnToFly()) return result(false, 'You cannot do that right now.', 'neutral');
  if (yearActs().flying) return result(false, 'You have had your flying hours for this year.', 'neutral');
  if (p.finance.cash < fee) return result(false, `A year of flying lessons costs ${fmtMoney(fee, c)}.`, 'neutral');
  yearActs().flying = 1;
  p.finance.cash -= fee;
  if (!rng.chance(passChance(FLYING_LESSONS.pass))) {
    const text = 'You spent the year learning to fly and failed the final check ride. You can try again next year.';
    log(text, 'system', 'bad');
    return result(false, text);
  }
  p.flags.pilotLicence = true;
  const text = 'You earned your pilot\'s licence.';
  log(text, 'system', 'good');
  milestone('Earned a pilot\'s licence.', 'life');
  return result(true, text);
}

// ---------- Buying and selling ----------

/** This year's vehicles for sale: new and used. */
export function listings() {
  const p = player();
  const m = market();
  if (m.listings?.age !== p.age || !m.listings.vehicle) {
    // What is on offer suits the buyer's age: children see bikes and boards.
    const fits = (t) => p.age >= (t.minAge ?? VEHICLE_AGE) && p.age <= (t.maxAge ?? 200);
    const open = VEHICLE_TYPES.filter(fits);
    const road = open.filter((t) => t.cls === 'car' || t.cls === 'bike');
    const cycles = open.filter((t) => t.cls === 'cycle');
    const list = [];
    for (let i = 0; i < (road.length ? 14 : 7) && open.length; i++) {
      const type = road.length ? (i < 7 ? rng.pick(road) : i < 10 && cycles.length ? rng.pick(cycles) : rng.pick(open)) : rng.pick(open);
      const age = rng.chance(type.cls === 'cycle' ? 0.5 : 0.3) ? 0 : rng.int(1, type.cls === 'cycle' ? 6 : 14);
      const condition = age === 0 ? 100 : clamp(100 - age * 5 + rng.int(-10, 8), 15, 98);
      list.push({ id: uid('lst'), typeId: type.id, age, condition,
        name: `${age === 0 ? 'New' : `${age}-year-old`} ${rng.pick(COLOURS)} ${lower(type.name)}`,
        price: worth(type, age, condition) });
    }
    m.listings = { ...(m.listings?.age === p.age ? m.listings : {}), age: p.age, vehicle: list.sort((a, b) => a.price - b.price) };
  }
  return m.listings.vehicle.map((l) => {
    const type = VEHICLE_BY_ID[l.typeId];
    const blocked = type.needs === 'licence' && !hasLicence() ? 'You need a driving licence.'
      : type.needs === 'pilot' && !hasPilotLicence() ? 'You need a pilot\'s licence.' : '';
    return { ...l, cls: type.cls, blocked, finance: loanOffer(l.price) };
  });
}

/** @param {'cash'|'loan'} how */
export function buyVehicle(listingId, how = 'cash') {
  const p = player();
  const c = country();
  const l = market().listings?.vehicle.find((x) => x.id === listingId);
  if (!l) return result(false, 'That one has gone.', 'neutral');
  const type = VEHICLE_BY_ID[l.typeId];
  if (p.age < (type.minAge ?? VEHICLE_AGE)) return result(false, 'You are too young for that.', 'neutral');
  if (how === 'loan' && p.age < 18) return result(false, 'Nobody lends money to a child.', 'neutral');
  if (how === 'loan') {
    const lent = borrow(l.price, 'car');
    if (!lent.ok) return lent;
  }
  if (p.finance.cash < l.price) return result(false, 'You cannot afford it.', 'neutral');
  p.finance.cash -= l.price;
  p.assets.push({ id: uid('asset'), kind: 'vehicle', catalogId: l.typeId, name: l.name.replace(/^New |^\d+-year-old /, '').replace(/^./, (ch) => ch.toUpperCase()),
    purchasePrice: l.price, value: l.price, boughtAtAge: p.age, condition: l.condition, age: l.age, vehicleClass: type.cls });
  market().listings.vehicle = market().listings.vehicle.filter((x) => x.id !== listingId);
  const text = `You bought ${/^(8|11|18)-|^[aeiou]/i.test(l.name) ? 'an' : 'a'} ${l.name.toLowerCase()} for ${fmtMoney(l.price, c)}${how === 'loan' ? ', on finance' : ''}.`;
  log(text, 'system', 'good');
  return result(true, text);
}

export const serviceCost = (a) => localMoney(vehicleTypeOf(a).price * SERVICE_COST, country());

export function service(id) {
  const p = player();
  const a = assetOf(id);
  const cost = serviceCost(a);
  if (a.condition >= 95) return result(false, 'It is running perfectly.', 'neutral');
  if (p.finance.cash < cost) return result(false, 'You cannot afford the garage bill.', 'neutral');
  p.finance.cash -= cost;
  a.condition = clamp(a.condition + 40);
  a.value = worth(vehicleTypeOf(a), a.age, a.condition);
  const text = `You had the ${a.name.toLowerCase()} serviced for ${fmtMoney(cost, country())}.`;
  log(text);
  return result(true, text, 'neutral');
}

/** A day out. Good for the mood; once a year per vehicle. */
export function takeOut(id) {
  const p = player();
  const a = assetOf(id);
  const type = vehicleTypeOf(a);
  if (yearActs().out[id]) return result(false, 'You have already had your big day out in it this year.', 'neutral');
  yearActs().out[id] = true;
  p.stats.mood = clamp(p.stats.mood + type.joy);
  const text = { car: `You took the ${a.name.toLowerCase()} out on an empty road with the windows down.`,
    bike: `You took the ${a.name.toLowerCase()} out through the hills.`,
    boat: `You spent a long day on the water in the ${a.name.toLowerCase()}.`,
    cycle: `You spent a whole day out on the ${a.name.toLowerCase()} and came home filthy and happy.`,
    plane: `You took the ${a.name.toLowerCase()} up above the clouds.` }[type.cls];
  log(text, 'system', 'good');
  return result(true, text);
}

export function sellVehicle(id) {
  const p = player();
  const a = assetOf(id);
  p.finance.cash += a.value;
  p.assets = p.assets.filter((x) => x !== a);
  const text = `You sold the ${a.name.toLowerCase()} for ${fmtMoney(a.value, country())}.`;
  log(text);
  return result(true, text, 'neutral');
}

/** A forced sale goes cheap. Used when debts are called in. */
export function repossessVehicle(a) {
  const p = player();
  const raised = Math.round(a.value * 0.8);
  p.finance.cash += raised;
  p.assets = p.assets.filter((x) => x !== a);
  return raised;
}

/** Changes the player's main vehicle from an event. */
export function hitVehicle(condition) {
  const a = vehicles().sort((x, y) => y.value - x.value)[0];
  if (!a) return;
  a.condition = clamp(a.condition + condition);
  a.value = worth(vehicleTypeOf(a), a.age, a.condition);
}

/** Yearly: age, wear, running costs, and the chance of a crash. @returns {?string} cause of death */
export function tickVehicles() {
  const p = player();
  const c = country();
  let crashed = false;
  for (const a of vehicles()) {
    const type = vehicleTypeOf(a);
    a.age += 1;
    a.condition = clamp(a.condition - rng.int(3, 8));
    a.value = worth(type, a.age, a.condition);
    // A child's bike is kept going by whoever looks after them.
    if (p.age >= 18) p.finance.cash -= Math.round(type.price * c.currency.scale * type.maint * (1.3 - a.condition / 100 * 0.6));

    const chance = 0.012 * type.risk * (1.7 - a.condition / 100) * (1 + p.hidden.crazy / 150);
    if (crashed || !rng.chance(chance)) continue;
    crashed = true;
    const what = { car: 'crashed', bike: 'came off', cycle: 'came off', boat: 'ran aground in', plane: 'made a forced landing in' }[type.cls];
    const roll = rng.next();
    if (roll < (type.cls === 'plane' ? 0.25 : type.cls === 'bike' ? 0.08 : type.cls === 'cycle' ? 0.006 : 0.03)) {
      return { car: 'a car crash', bike: 'a motorbike crash', cycle: 'a cycling accident', boat: 'a boating accident', plane: 'a plane crash' }[type.cls];
    }
    if (roll < 0.35) {
      p.stats.health = clamp(p.stats.health - rng.int(12, 30));
      p.assets = p.assets.filter((x) => x !== a);
      log(`You ${what} the ${a.name.toLowerCase()} and were badly hurt. It was written off.`, 'system', 'bad');
    } else {
      a.condition = clamp(a.condition - 30);
      a.value = worth(type, a.age, a.condition);
      p.stats.health = clamp(p.stats.health - rng.int(0, 6));
      log(`You ${what} the ${a.name.toLowerCase()}. You walked away; it will need work.`, 'system', 'bad');
    }
  }
  return null;
}

/** A vehicle given as a present (see the giveVehicle effect). @returns {?object} the new asset */
export function giveVehicle(typeId) {
  const p = player();
  const type = VEHICLE_BY_ID[typeId];
  if (!type) return null;
  const price = worth(type, 0, 100);
  const a = { id: uid('asset'), kind: 'vehicle', catalogId: type.id, name: `${rng.pick(COLOURS).replace(/^./, (ch) => ch.toUpperCase())} ${lower(type.name)}`,
    purchasePrice: 0, value: price, boughtAtAge: p.age, condition: 100, age: 0, vehicleClass: type.cls };
  p.assets.push(a);
  return a;
}
