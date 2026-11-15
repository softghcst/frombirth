// Builds NPC records. Every NPC carries the same seven meters.
import { rng } from '../rng.js';
import { uid, clamp, localMoney } from '../util.js';
import { COUNTRIES, EXTRA_NAMES } from '../data/countries.js';
import { store } from '../state.js';
import { OCCUPATIONS, BACKGROUNDS, PETS } from '../data/traits.js';
import { randomAppearance, randomTraits, randomTalents } from './genetics.js';

const meter = (mean = 55, spread = 35) => Math.round(clamp(rng.around(mean, spread)));

/** A first name nobody in the current life already has, where one is left. */
function freshName(pool, gender) {
  const state = store.state;
  if (!state) return rng.pick(pool);
  const taken = new Set([state.player.firstName, ...Object.values(state.npcs).map((n) => n.firstName)]);
  const free = pool.filter((n) => !taken.has(n));
  if (free.length) return rng.pick(free);
  const wider = (EXTRA_NAMES[gender] ?? [...EXTRA_NAMES.male, ...EXTRA_NAMES.female]).filter((n) => !taken.has(n));
  return rng.pick(wider.length ? wider : pool);
}

/**
 * @param {Object} o
 * @param {string} o.role
 * @param {string} o.countryId
 * @param {number} o.age
 * @param {string} [o.gender]
 * @param {string} [o.firstName]
 * @param {string} [o.lastName]
 * @param {number} [o.relationship]
 * @param {object} [o.appearance]  defaults to a random one
 * @param {number} [o.skinHint]    keeps relatives looking related
 * @param {string} [o.background]  key of BACKGROUNDS; parents only
 * @returns {import('../types.js').NPC}
 */
export function makeNpc(o) {
  const country = COUNTRIES[o.countryId];
  const names = country.names;
  const gender = o.gender ?? rng.pick(['male', 'female']);
  const npc = {
    id: uid('npc'),
    firstName: o.firstName ?? freshName(names[gender] ?? names.female, gender),
    lastName: o.lastName ?? rng.pick(names.last),
    gender,
    age: Math.max(0, Math.round(o.age)),
    alive: true,
    role: o.role,
    meters: {
      relationship: Math.round(clamp(o.relationship ?? rng.around(60, 25))),
      money: meter(45), crazy: meter(30), intellect: meter(), charm: meter(),
      health: meter(80, 20), generosity: meter(),
    },
    appearance: o.appearance ?? randomAppearance(o.skinHint),
    traits: randomTraits(),
    lastInteractionAge: -1,
    flags: {},
  };
  if (o.role === 'parent') {
    const preset = BACKGROUNDS[o.background];
    // Professions take years of training; very young parents do not hold them.
    const trained = (j) => npc.age >= (j.income >= 130000 ? 30 : j.income >= 70000 ? 25 : 18);
    const fitting = OCCUPATIONS.filter((j) => (!preset || preset.fits(j)) && trained(j));
    const job = rng.pick(fitting.length ? fitting : OCCUPATIONS.filter(trained));
    npc.occupation = job.title;
    npc.wealth = rng.int(Math.max(job.wealth[0], preset?.floor ?? 0), job.wealth[1]);
    npc.income = localMoney(job.income * rng.around(1, 0.15), country);
    npc.savings = localMoney(npc.wealth ** 2 * 60 * rng.around(1, 0.3), country);
    npc.meters.money = npc.wealth;
    npc.strictness = meter(50, 40);
    npc.talents = randomTalents();
  }
  return npc;
}

export function makePet(countryId, lastName, relationship = 75) {
  const kind = rng.pick(PETS);
  const pet = makeNpc({
    role: 'pet', countryId, lastName, age: rng.int(0, Math.min(4, kind.lifespan - 2)),
    firstName: rng.pick(kind.names), relationship,
  });
  pet.species = kind.species;
  pet.lifespan = kind.lifespan + rng.int(-1, 3);
  delete pet.traits;
  return pet;
}
