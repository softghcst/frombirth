// Creates a brand-new life: the player, their family and the opening journal.
import { rng } from '../rng.js';
import { uid, clamp } from '../util.js';
import { COUNTRIES, COUNTRY_LIST } from '../data/countries.js';
import { TRAITS } from '../data/traits.js';
import { makeNpc, makePet } from './npcFactory.js';
import { SCHEMA_VERSION } from '../save.js';

const stat = (mean, spread) => Math.round(clamp(rng.around(mean, spread)));

function rollTalents() {
  const t = { music: rng.int(0, 55), sports: rng.int(0, 55), acting: rng.int(0, 55), crime: rng.int(0, 55) };
  if (rng.chance(0.3)) t[rng.pick(Object.keys(t))] = rng.int(70, 100); // a natural gift
  return t;
}

/**
 * @param {{firstName?:string, lastName?:string, gender?:string, countryId?:string, city?:string}} [opts]
 * @returns {import('../types.js').GameState}
 */
export function createLife(opts = {}) {
  const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  rng.seed(seed);

  const c = COUNTRIES[opts.countryId] ?? rng.pick(COUNTRY_LIST);
  const gender = opts.gender ?? rng.pick(['male', 'female']);
  const lastName = opts.lastName?.trim() || rng.pick(c.names.last);
  const firstName = opts.firstName?.trim()
    || rng.pick(c.names[gender] ?? [...c.names.male, ...c.names.female]);
  const city = opts.city && c.cities.includes(opts.city) ? opts.city : rng.pick(c.cities);
  const year = new Date().getFullYear();

  // Family
  const mother = makeNpc({ role: 'parent', gender: 'female', countryId: c.id, lastName,
    age: rng.int(19, 40), relationship: rng.int(65, 100) });
  const father = makeNpc({ role: 'parent', gender: 'male', countryId: c.id, lastName,
    age: mother.age + rng.int(-3, 8), relationship: rng.int(55, 100) });
  const siblings = [];
  const siblingCount = rng.weighted([0, 1, 2, 3], (n) => [35, 38, 20, 7][n]);
  for (let i = 0; i < siblingCount; i++) {
    const maxAge = Math.max(1, Math.min(14, mother.age - 18));
    siblings.push(makeNpc({ role: 'sibling', countryId: c.id, lastName,
      age: rng.int(1, maxAge), relationship: rng.int(40, 90) }));
  }
  const pet = rng.chance(0.35) ? makePet(c.id, lastName) : null;
  const family = [mother, father, ...siblings, ...(pet ? [pet] : [])];

  // Genetics: brains and looks lean toward the parents' average.
  const stats = {
    mood: stat(80, 20),
    health: stat(85, 18),
    intellect: stat((mother.meters.intellect + father.meters.intellect) / 2, 22),
    charm: stat((mother.meters.charm + father.meters.charm) / 2, 22),
  };
  const hidden = {
    karma: 50, discipline: stat(50, 30), willpower: stat(50, 30),
    fertility: stat(70, 25), fame: 0, crazy: stat((mother.meters.crazy + father.meters.crazy) / 2, 20),
  };
  const traits = [];
  const pool = [...TRAITS];
  for (let i = 0, n = rng.int(1, 2); i < n; i++) {
    const t = pool.splice(rng.int(0, pool.length - 1), 1)[0];
    traits.push(t.id);
    for (const [k, v] of Object.entries(t.stats ?? {})) stats[k] = clamp(stats[k] + v);
    for (const [k, v] of Object.entries(t.hidden ?? {})) hidden[k] = clamp(hidden[k] + v);
  }

  /** @type {import('../types.js').Character} */
  const player = {
    id: uid('pc'), firstName, lastName, gender, age: 0, birthYear: year,
    countryId: c.id, city, birthCountryId: c.id,
    stats, hidden, talents: rollTalents(), traits, conditions: [],
    appearance: { skin: rng.int(0, 5), hair: rng.int(0, 4), hairStyle: rng.int(0, 2), eyes: rng.int(0, 3), weight: 50 },
    education: { stage: 'none', enrolled: false, yearInStage: 0, gpa: 0, effort: 50, absences: 0,
      clique: null, clubs: [], majorId: null, funding: null, degrees: [], expelled: false, droppedOut: false },
    career: { careerId: null, title: null, level: 0, salary: 0, performance: 50, yearsInRole: 0,
      yearsInField: 0, coworkerIds: [], bossId: null, partTime: null, history: [], retired: false,
      pensionPerYear: 0, military: null },
    finance: { cash: 0, loans: [], pension: 0, lifetimeEarned: 0, lifetimeTaxPaid: 0 },
    assets: [], inventory: [],
    npcIds: family.map((n) => n.id),
    legal: { record: [], incarceration: null, heat: 0 },
    social: { handle: null, followers: 0, posts: 0, viral: 0, boughtFollowers: 0 },
    flags: { livesWithParents: true },
    milestones: [{ age: 0, text: `Born in ${city}, ${c.name}.`, kind: 'life' }],
    counters: { crimes: 0, kills: 0, donated: 0, gambled: 0, yearsJailed: 0, escapes: 0,
      livesSaved: 0, spouses: 0, jobsHeld: 0, countriesLived: 1 },
    alive: true, generation: 1,
  };

  const j = (text) => ({ age: 0, text, kind: 'system', tone: 'neutral' });
  const pronoun = gender === 'male' ? 'a boy' : gender === 'female' ? 'a girl' : 'a baby';
  const journal = [
    j(`You are born in ${city}, ${c.name}: ${pronoun} named ${firstName} ${lastName}.`),
    j(`Your mother is ${mother.firstName}, a ${mother.occupation}, age ${mother.age}.`),
    j(`Your father is ${father.firstName}, a ${father.occupation}, age ${father.age}.`),
  ];
  for (const s of siblings) {
    journal.push(j(`You have an older ${s.gender === 'male' ? 'brother' : 'sister'}, ${s.firstName}, age ${s.age}.`));
  }
  if (pet) journal.push(j(`The family ${pet.species}, ${pet.firstName}, sniffs you suspiciously.`));
  const gift = Object.entries(player.talents).find(([, v]) => v >= 70);
  if (gift) journal.push(j(`Something about you hints at a gift for ${gift[0]}.`));

  return {
    schemaVersion: SCHEMA_VERSION, slotId: uid('life'),
    createdAt: Date.now(), updatedAt: Date.now(), year,
    player, npcs: Object.fromEntries(family.map((n) => [n.id, n])),
    journal, market: { prices: {}, history: {}, cycle: 0 },
    eventHistory: [], pendingEvents: [], rngSeed: rng.state(),
    settings: { theme: 'auto' },
  };
}
