// Builds NPC records. Every NPC carries the same seven meters.
import { rng } from '../rng.js';
import { uid, clamp } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { OCCUPATIONS, PETS } from '../data/traits.js';

const meter = (mean = 55, spread = 35) => Math.round(clamp(rng.around(mean, spread)));

/**
 * @param {Object} o
 * @param {string} o.role
 * @param {string} o.countryId
 * @param {number} o.age
 * @param {string} [o.gender]
 * @param {string} [o.firstName]
 * @param {string} [o.lastName]
 * @param {number} [o.relationship]
 * @param {number} [o.bornAtPlayerAge]
 * @returns {import('../types.js').NPC}
 */
export function makeNpc(o) {
  const names = COUNTRIES[o.countryId].names;
  const gender = o.gender ?? rng.pick(['male', 'female']);
  const npc = {
    id: uid('npc'),
    firstName: o.firstName ?? rng.pick(names[gender] ?? names.female),
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
    lastInteractionAge: -1,
    flags: {},
  };
  if (o.role === 'parent') {
    const job = rng.pick(OCCUPATIONS);
    npc.occupation = job.title;
    npc.wealth = rng.int(job.wealth[0], job.wealth[1]);
    npc.meters.money = npc.wealth;
    npc.strictness = meter(50, 40);
  }
  return npc;
}

export function makePet(countryId, lastName, relationship = 75) {
  const kind = rng.pick(PETS);
  const pet = makeNpc({
    role: 'pet', countryId, lastName, age: rng.int(0, 4),
    firstName: rng.pick(kind.names), relationship,
  });
  pet.species = kind.species;
  pet.lifespan = kind.lifespan + rng.int(-2, 3);
  return pet;
}
