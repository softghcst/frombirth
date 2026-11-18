// Builds NPC records. Every NPC carries the same seven meters.
import { parentOccupations, worldYear } from './history.js';
import { rng } from '../rng.js';
import { uid, clamp, localMoney, localWage } from '../util.js';
import { COUNTRIES, surnameFor } from '../data/countries.js';
import { store } from '../state.js';
import { getPeople } from '../people.js';
import { ensureStyled } from '../avatar/inherit.js';
import { OCCUPATIONS, BACKGROUNDS, PETS } from '../data/traits.js';
import { randomAppearance, randomTraits, randomTalents } from './genetics.js';

// Kept in step with ORIENTATIONS in engine/identity.js (which cannot be imported here without a loop).
const ORIENTATION_WEIGHTS = [['straight', 86], ['gay', 5], ['bisexual', 5.5], ['pansexual', 1.5], ['asexual', 2]];

// Relatives are named by the family; everyone else may be somebody from the player's own list (Settings).
const FAMILY_ROLES = ['parent', 'sibling', 'child', 'grandparent', 'grandchild', 'greatgrandchild', 'relative', 'niece', 'pet'];
const KNOWN_CHANCE = 0.6;

/** Someone from "People you know" who has not yet appeared in this life, or null. */
function someoneKnown(o) {
  const state = store.state;
  if (!state || o.firstName || FAMILY_ROLES.includes(o.role)) return null;
  // Someone who has dropped out of the player's life (an old classmate, say) can turn up again later.
  const used = Object.values(state.npcs).map((n) => n.flags?.knownId).filter(Boolean);
  const free = getPeople().filter((x) => !used.includes(x.id) && (!o.gender || x.gender === o.gender));
  if (!free.length || !rng.chance(KNOWN_CHANCE)) return null;
  return rng.pick(free);
}

const meter = (mean = 55, spread = 35) => Math.round(clamp(rng.around(mean, spread)));

/** A local first name nobody in the current life already has, where one is left. */
function freshName(pool) {
  const state = store.state;
  if (!state) return rng.pick(pool);
  const taken = new Set([state.player.firstName, ...Object.values(state.npcs).map((n) => n.firstName)]);
  const free = pool.filter((n) => !taken.has(n));
  return rng.pick(free.length ? free : pool);
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
  const known = someoneKnown(o);
  const gender = known?.gender ?? o.gender ?? rng.pick(['male', 'female']);
  const npc = {
    id: uid('npc'),
    firstName: known?.first ?? o.firstName ?? freshName(names[gender] ?? names.female, gender),
    lastName: known?.last && !o.lastName ? known.last : surnameFor(o.countryId, o.lastName ?? rng.pick(names.last), gender),
    gender,
    age: Math.max(0, Math.round(o.age)),
    alive: true,
    role: o.role,
    bornIn: o.countryId, // where they are from: their nationality follows from it unless recorded otherwise
    meters: {
      relationship: Math.round(clamp(o.relationship ?? rng.around(60, 25))),
      money: meter(45), crazy: meter(30), intellect: meter(), charm: meter(),
      health: meter(80, 20), generosity: meter(),
    },
    appearance: ensureStyled(o.appearance ?? randomAppearance(o.skinHint, gender), gender),
    traits: randomTraits(),
    lastInteractionAge: -1,
    flags: known ? { known: true, knownId: known.id } : {},
  };
  if (o.role !== 'pet') {
    npc.orientation = o.orientation ?? rng.weighted(ORIENTATION_WEIGHTS, (x) => x[1])[0];
    if (rng.chance(0.012)) npc.flags.trans = true;
  }
  if (o.role === 'parent') {
    const preset = BACKGROUNDS[o.background];
    // Professions take years of training; very young parents do not hold them.
    const trained = (j) => npc.age >= (j.income >= 130000 ? 30 : j.income >= 70000 ? 25 : 18);
    // The jobs of the year the child is born into (Historical Eras); in the present, today's list.
    const jobs = parentOccupations(worldYear());
    const fitting = jobs.filter((j) => (!preset || preset.fits(j)) && trained(j));
    const job = rng.pick(fitting.length ? fitting : jobs.filter(trained));
    npc.occupation = job.title;
    npc.wealth = rng.int(Math.max(job.wealth[0], preset?.floor ?? 0), job.wealth[1]);
    npc.income = localWage(job.income * rng.around(1, 0.15), country);
    npc.savings = localWage(npc.wealth ** 2 * 60 * rng.around(1, 0.3), country);
    npc.meters.money = npc.wealth;
    npc.strictness = meter(50, 40);
    npc.talents = randomTalents();
  }
  return npc;
}

/** @param {string} [species]  one of the kinds in PETS; left out, any of them */
export function makePet(countryId, lastName, relationship = 75, species) {
  const kind = PETS.find((k) => k.species === species) ?? rng.pick(PETS);
  const pet = makeNpc({
    role: 'pet', countryId, lastName, age: rng.int(0, Math.min(4, kind.lifespan - 2)),
    firstName: rng.pick(kind.names), relationship,
  });
  pet.species = kind.species;
  pet.lifespan = kind.lifespan + rng.int(-1, 3);
  delete pet.traits;
  return pet;
}
