// Vehicles: licenses, what is for sale, buying, servicing, selling, and the
// yearly depreciation, running costs and crash risk.
import { rule, may } from './rules.js';
import { rng } from '../rng.js';
import { uid, clamp, localMoney, fmtMoney } from '../util.js';
import { player, country, log, milestone } from '../state.js';
import { resolve } from './conditions.js';
import { market } from './market.js';
import { borrow, loanOffer, CAR_LOAN } from './loans.js';
import { VEHICLE_TYPES, VEHICLE_BY_ID, COLORS, DRIVING_TEST, DRIVING_QUIZ, DRIVING_QUESTIONS, FLYING_LESSONS, SERVICE_COST } from '../data/vehicles.js';
import { book } from './ledger.js';
import { PACES, DURATIONS, CRUISE_SPEED, RIDES_A_YEAR, ENCOUNTERS, ENCOUNTER_BY_ID } from '../data/rides.js';
import { bestMove, fightEdge } from './martial.js';
import { recordLoss } from './insurance.js';

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

// ---------- Licenses ----------

export const hasLicense = () => !!player().flags.canDrive;
export const hasPilotLicense = () => !!player().flags.pilotLicense;

function passChance(spec) {
  let chance = spec.base;
  for (const [path, w] of Object.entries(spec.factors)) chance += w * ((Number(resolve(path)) || 0) - 50) / 100;
  return clamp(chance, 0.05, 0.95);
}

/** The age a learner can take the test where they live: the country's driving age (16 in the United States, 18 in much of Europe). */
export const drivingTestAge = () => rule('drivingAge') ?? DRIVING_TEST.minAge;
export const canTakeDrivingTest = () => player().age >= drivingTestAge() && !hasLicense();
/** Tries left this year, and what the next one costs (the first of a year includes the lessons). */
export function drivingTestStatus() {
  const c = country();
  const used = yearActs().test ?? 0;
  return { left: Math.max(0, DRIVING_QUIZ.triesAYear - used), fee: localMoney(used ? DRIVING_QUIZ.retakeFee : DRIVING_TEST.fee, c), retake: used > 0 };
}
/**
 * Starts a test: pays for it, counts the try, and hands back the questions (answers shuffled). Practice with a parent
 * (engine/bonds.js) crosses one wrong answer off each question. The test is kept on the player until it is marked.
 */
export function startDrivingTest() {
  const p = player();
  const c = country();
  if (!canTakeDrivingTest()) return result(false, 'You cannot take the test right now.', 'neutral');
  const st = drivingTestStatus();
  if (!st.left) return result(false, `You have failed ${DRIVING_QUIZ.triesAYear} times this year. You can try again next year.`, 'neutral');
  if (p.finance.cash < st.fee) return result(false, `${st.retake ? 'A retake costs' : 'Lessons and the test cost'} ${fmtMoney(st.fee, c)}.`, 'neutral');
  p.finance.cash -= st.fee;
  yearActs().test = (yearActs().test ?? 0) + 1;
  const pool = [...DRIVING_QUESTIONS.keys()].sort(() => rng.next() - 0.5).slice(0, DRIVING_QUIZ.questions);
  const practiced = (p.flags.drivePractice ?? 0) > 0;
  const questions = pool.map((i) => {
    const [q, answers] = DRIVING_QUESTIONS[i];
    let opts = answers.map((text, k) => ({ text, right: k === 0 }));
    if (practiced) { const wrong = opts.filter((o) => !o.right); const drop = wrong[rng.int(0, wrong.length - 1)]; opts = opts.filter((o) => o !== drop); }
    return { q, options: opts.sort(() => rng.next() - 0.5).map((o) => o.text), right: opts.find((o) => o.right).text };
  });
  p.flags.drivingTest = { questions, year: p.age };
  return { ...result(true, '', 'neutral'), questions: questions.map(({ q, options }) => ({ q, options })), practiced, fee: st.fee };
}
/** Marks the test. `picks` are the answers chosen, in order; a question left unanswered is wrong. */
export function finishDrivingTest(picks = []) {
  const p = player();
  const t = p.flags.drivingTest;
  if (!t) return result(false, 'There is no test to mark.', 'neutral');
  delete p.flags.drivingTest;
  const score = t.questions.filter((x, i) => picks[i] === x.right).length;
  const missed = t.questions.map((x, i) => (picks[i] === x.right ? null : x)).filter(Boolean);
  if (score < DRIVING_QUIZ.passMark) {
    const left = drivingTestStatus().left;
    const text = `You failed your driving test${t.questions.length > 1 ? `: ${score} out of ${t.questions.length}. You needed ${DRIVING_QUIZ.passMark}` : ''}. ${left ? `You can try again this year (${left} ${left === 1 ? 'try' : 'tries'} left).` : 'That was your last try this year.'}`;
    log(text, 'system', 'bad');
    return { ...result(false, text), score, missed: missed.map((x) => ({ q: x.q, right: x.right })) };
  }
  p.flags.canDrive = true;
  const text = `You passed your driving test${t.questions.length > 1 ? `: ${score} out of ${t.questions.length}` : ''}.`;
  log(text, 'system', 'good');
  milestone('Passed the driving test.', 'life');
  book({ cat: 'transport', src: 'action', desc: 'Driving lessons and the test' });
  return { ...result(true, text), score, missed: missed.map((x) => ({ q: x.q, right: x.right })) };
}
/** The old one-step test, for anything that still calls it: answers as well as the player's discipline and wits would. */
export function takeDrivingTest() {
  const r = startDrivingTest();
  if (!r.ok) return r;
  const p = player();
  const t = p.flags.drivingTest;
  const chance = clamp(passChance(DRIVING_TEST.pass) + Math.min(0.15, (p.flags.drivePractice ?? 0) * 0.07), 0.05, 0.97);
  return finishDrivingTest(t.questions.map((x) => (rng.chance(chance + 0.1) ? x.right : x.options.find((o) => o !== x.right))));
}

export const canLearnToFly = () => player().age >= FLYING_LESSONS.minAge && !hasPilotLicense();
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
  p.flags.pilotLicense = true;
  const text = 'You earned your pilot\'s license.';
  log(text, 'system', 'good');
  milestone('Earned a pilot\'s license.', 'life');
  book({ cat: 'transport', src: 'action', desc: text });
  return result(true, text);
}

// ---------- Buying and selling ----------

/** This year's vehicles for sale: new and used. */
export function listings() {
  const p = player();
  const m = market();
  if (m.listings?.age !== p.age || !m.listings.vehicle) {
    // What is on offer suits the buyer's age: children see bikes and boards.
    const fits = (t) => p.age >= (t.minAge ?? rule('drivingAge')) && p.age <= (t.maxAge ?? 200);
    const open = VEHICLE_TYPES.filter(fits);
    const road = open.filter((t) => t.cls === 'car' || t.cls === 'bike');
    const cycles = open.filter((t) => t.cls === 'cycle');
    const list = [];
    for (let i = 0; i < (road.length ? 14 : 7) && open.length; i++) {
      const type = road.length ? (i < 7 ? rng.pick(road) : i < 10 && cycles.length ? rng.pick(cycles) : rng.pick(open)) : rng.pick(open);
      const age = rng.chance(type.cls === 'cycle' ? 0.5 : 0.3) ? 0 : rng.int(1, type.cls === 'cycle' ? 6 : 14);
      const condition = age === 0 ? 100 : clamp(100 - age * 5 + rng.int(-10, 8), 15, 98);
      list.push({ id: uid('lst'), typeId: type.id, age, condition,
        name: `${age === 0 ? 'New' : `${age}-year-old`} ${rng.pick(COLORS)} ${lower(type.name)}`,
        price: worth(type, age, condition) });
    }
    m.listings = { ...(m.listings?.age === p.age ? m.listings : {}), age: p.age, vehicle: list.sort((a, b) => a.price - b.price) };
  }
  return m.listings.vehicle.map((l) => {
    const type = VEHICLE_BY_ID[l.typeId];
    const blocked = type.needs === 'license' && !hasLicense() ? 'You need a driving license.'
      : type.needs === 'pilot' && !hasPilotLicense() ? 'You need a pilot\'s license.' : '';
    return { ...l, cls: type.cls, blocked, finance: loanOffer(l.price, CAR_LOAN.rate, CAR_LOAN.years) };
  });
}

/** @param {'cash'|'loan'} how */
export function buyVehicle(listingId, how = 'cash') {
  const p = player();
  const c = country();
  const l = market().listings?.vehicle.find((x) => x.id === listingId);
  if (!l) return result(false, 'That one has gone.', 'neutral');
  const type = VEHICLE_BY_ID[l.typeId];
  if (p.age < (type.minAge ?? rule('drivingAge'))) return result(false, type.minAge ? 'You are too young for that.' : may('drive').why, 'neutral');
  if (how === 'loan' && p.age < 18) return result(false, 'Nobody lends money to a child.', 'neutral');
  const assetId = uid('asset');
  if (how === 'loan') {
    // The loan is secured on the vehicle: it is the lender's to take back if the loan goes unpaid.
    const lent = borrow(l.price, 'car', assetId);
    if (!lent.ok) return lent;
  }
  if (p.finance.cash < l.price) return result(false, 'You cannot afford it.', 'neutral');
  p.finance.cash -= l.price;
  p.assets.push({ id: assetId, kind: 'vehicle', catalogId: l.typeId, name: l.name.replace(/^New |^\d+-year-old /, '').replace(/^./, (ch) => ch.toUpperCase()),
    purchasePrice: l.price, value: l.price, boughtAtAge: p.age, condition: l.condition, age: l.age, vehicleClass: type.cls });
  market().listings.vehicle = market().listings.vehicle.filter((x) => x.id !== listingId);
  const text = `You bought ${/^(8|11|18)-|^[aeiou]/i.test(l.name) ? 'an' : 'a'} ${l.name.toLowerCase()} for ${fmtMoney(l.price, c)}${how === 'loan' ? ', on finance' : ''}.`;
  log(text, 'system', 'good');
  book({ cat: 'vehicle', src: 'action', desc: text });
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
  book({ cat: 'transport', src: 'action', desc: text });
  return result(true, text, 'neutral');
}

// ---------- Rides ----------

/** What can be ridden or driven out for the day: bikes, boards, motorbikes, cars. */
export const canRide = (a) => ['cycle', 'bike', 'car'].includes(vehicleTypeOf(a)?.cls);
/** Rides left this year on this vehicle. */
export const ridesLeft = (id) => RIDES_A_YEAR - (yearActs().rides?.[id] ?? 0);

/**
 * A ride: the pace and how long. Back come the distance, how much it was enjoyed (0–100), and sometimes an encounter
 * on the way to be handled (rideEncounter).
 */
export function ride(id, paceId = 'cruising', minutes = 30) {
  const p = player();
  const a = assetOf(id);
  const type = a && vehicleTypeOf(a);
  if (!a || !canRide(a)) return result(false, 'That is not something you can go for a ride on.', 'neutral');
  if ((type.cls === 'car' || type.cls === 'bike') && !hasLicense() && p.age < 18) return result(false, 'You need a license to drive it.', 'neutral');
  if (ridesLeft(id) <= 0) return result(false, `${RIDES_A_YEAR} rides a year on it is plenty.`, 'neutral');
  const acts = yearActs();
  acts.rides ??= {};
  acts.rides[id] = (acts.rides[id] ?? 0) + 1;
  const pace = PACES.find((x) => x.id === paceId) ?? PACES[1];
  const km = Math.round(CRUISE_SPEED[type.cls] * pace.speed * (type.id === 'road_bike' ? 1.25 : 1) * (minutes / 60) * rng.around(1, 0.12) * 100) / 100;
  const miles = country().id === 'us' || country().id === 'uk';
  const distance = miles ? `${(km / 1.609).toFixed(2)} miles` : `${km.toFixed(2)} kilometers`;
  let joy = clamp(Math.round(35 + type.joy * 4 + pace.joy + rng.int(-15, 20) - (p.stats.health < 40 ? 15 : 0) + (a.condition < 40 ? -10 : 0)));
  if (type.cls === 'cycle') p.stats.health = clamp(p.stats.health + Math.max(1, Math.round(minutes / 30 * pace.speed)));
  p.stats.mood = clamp(p.stats.mood + Math.round(joy / 20));
  a.condition = clamp((a.condition ?? 80) - Math.round(minutes / 60 * pace.speed));
  // Going fast has its own risk.
  if (rng.chance(0.012 * pace.risk * type.risk * (minutes / 60))) {
    p.stats.health = clamp(p.stats.health - rng.int(6, 14));
    a.condition = clamp(a.condition - 15);
    joy = Math.min(joy, 15);
    const text = `You took a spill on the ${a.name.toLowerCase()}, ${distance} in. Scraped up and sore, but nothing broken.`;
    log(text, 'system', 'bad');
    return { ...result(false, text), distance, joy };
  }
  const where = { cycle: rng.pick(['along the river', 'through a noisy city park', 'out past the edge of town', 'up and down every hill nearby']), bike: rng.pick(['along the coast road', 'out into the hills']), car: rng.pick(['on an empty highway with the windows down', 'out to somewhere you had never been']) }[type.cls];
  const text = `You went for a ${pace.name.toLowerCase()} ride ${where} on your ${a.name.toLowerCase()}.`;
  log(text, 'system', 'good');
  // Sometimes the ride brings something with it.
  const pool = ENCOUNTERS.filter((e) => e.classes.includes(type.cls));
  const enc = rng.chance(0.35) && pool.length ? rng.pick(pool) : null;
  const move = bestMove(p);
  const encounter = enc ? { id: enc.id, assetId: id, text: fill(enc.text, a, move), options: enc.options.map((o, i) => ({ value: i, label: fill(o.label, a, move) })).filter((o) => !enc.options[o.value].needsMove || move) } : null;
  return { ...result(true, text), distance, joy, encounter };
}
const fill = (t, a, move) => t.replace(/\{vehicle\}/g, a.name.toLowerCase()).replace(/\{city\}/g, player().city).replace(/\{move\}/g, move ?? 'training');

/** How an encounter on a ride turns out, for the option chosen. */
export function rideEncounter(encId, optionIndex, assetId) {
  const p = player();
  const enc = ENCOUNTER_BY_ID[encId];
  const o = enc?.options[optionIndex];
  if (!o) return result(false, 'Nothing happens.', 'neutral');
  const a = assetOf(assetId);
  const move = bestMove(p);
  const level = o.lean === 'martial' ? 50 + fightEdge(p) * 160 : o.lean ? Number(resolve(o.lean)) || 50 : null;
  const won = level == null ? true : rng.chance(clamp(0.25 + (level - 40) / 80, 0.08, 0.92));
  const [text, fx] = won ? o.good : o.bad;
  const c = country();
  if (fx.mood) p.stats.mood = clamp(p.stats.mood + fx.mood);
  if (fx.health) p.stats.health = clamp(p.stats.health + fx.health);
  if (fx.charm) p.stats.charm = clamp(p.stats.charm + fx.charm);
  if (fx.karma) p.hidden.karma = clamp(p.hidden.karma + fx.karma);
  if (fx.cash) p.finance.cash += localMoney(fx.cash, c);
  if (fx.followers) p.social.followers = (p.social.followers ?? 0) + fx.followers;
  if (fx.lost && a) { p.assets = p.assets.filter((x) => x.id !== a.id); }
  const said = fill(text, a ?? { name: 'ride' }, move);
  log(said, 'system', won ? 'good' : 'neutral');
  return result(won, said, won ? 'good' : 'neutral');
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

/** The loan secured on a vehicle, if it was bought on finance and not yet paid off. */
export const loanOn = (a) => player().finance.loans.find((l) => l.assetId === a.id) ?? null;
/** What selling would leave once the loan on it is cleared (negative: the sale does not cover the loan). */
export const saleNet = (a) => Math.round(a.value - (loanOn(a)?.principal ?? 0));

/** Clears a vehicle's loan from what it raised. Returns what is left over. */
function settleLoan(a, raised) {
  const p = player();
  const loan = loanOn(a);
  if (!loan) return raised;
  const paid = Math.min(loan.principal, raised);
  loan.principal -= paid;
  delete loan.assetId; // whatever is still owed is no longer secured on anything
  if (loan.principal <= 0) p.finance.loans = p.finance.loans.filter((x) => x !== loan);
  return raised - paid;
}

export function sellVehicle(id) {
  const p = player();
  const a = assetOf(id);
  const loan = loanOn(a);
  const net = saleNet(a);
  if (net < 0 && p.finance.cash < -net) return result(false, `It would fetch ${fmtMoney(a.value, country())}, and you still owe ${fmtMoney(loan.principal, country())} on it. You need ${fmtMoney(-net, country())} more to clear the loan before it can be sold.`, 'neutral');
  p.finance.cash += a.value;
  p.assets = p.assets.filter((x) => x !== a);
  if (loan) { const owed = Math.min(loan.principal, p.finance.cash); p.finance.cash -= owed; loan.principal -= owed; if (loan.principal <= 0) p.finance.loans = p.finance.loans.filter((x) => x !== loan); }
  const text = `You sold the ${a.name.toLowerCase()} for ${fmtMoney(a.value, country())}${loan ? `, and the loan on it was paid off from the sale` : ''}.`;
  log(text);
  book({ cat: 'vehicle', src: 'action', desc: text });
  return result(true, text, 'neutral');
}

/** A forced sale goes cheap. Used when debts are called in. */
export function repossessVehicle(a) {
  const p = player();
  const raised = Math.round(a.value * 0.8);
  p.assets = p.assets.filter((x) => x !== a);
  // A lender with a claim on the vehicle is paid first; only what is left reaches the owner.
  const left = settleLoan(a, raised);
  p.finance.cash += left;
  return raised;
}

/** Changes the player's main vehicle from an event. */
export function hitVehicle(condition) {
  const a = vehicles().sort((x, y) => y.value - x.value)[0];
  if (!a) return;
  const before = a.value;
  a.condition = clamp(a.condition + condition);
  a.value = worth(vehicleTypeOf(a), a.age, a.condition);
  if (condition < 0) recordLoss(a, before, a.value, 'damage');
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
      recordLoss(a, a.value, 0, 'written off in a crash');
      { const loan = loanOn(a); if (loan) delete loan.assetId; } // still owed, with nothing left to secure it
      p.assets = p.assets.filter((x) => x !== a);
      log(`You ${what} the ${a.name.toLowerCase()} and were badly hurt. It was written off.`, 'system', 'bad');
    } else {
      const before = a.value;
      a.condition = clamp(a.condition - 30);
      a.value = worth(type, a.age, a.condition);
      recordLoss(a, before, a.value, 'a crash');
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
  const a = { id: uid('asset'), kind: 'vehicle', catalogId: type.id, name: `${rng.pick(COLORS).replace(/^./, (ch) => ch.toUpperCase())} ${lower(type.name)}`,
    purchasePrice: 0, value: price, boughtAtAge: p.age, condition: 100, age: 0, vehicleClass: type.cls };
  p.assets.push(a);
  return a;
}
