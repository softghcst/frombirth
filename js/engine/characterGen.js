// Creates a brand-new life: the player, their family and the opening journal.
import { rng } from '../rng.js';
import { uid } from '../util.js';
import { COUNTRIES, COUNTRY_LIST } from '../data/countries.js';
import { TRAIT_BY_ID } from '../data/traits.js';
import { ILLNESS_BY_ID } from '../data/illnesses.js';
import { generateFamily } from './familyGen.js';
import { inheritAppearance, inheritTraits, inheritTalents, inheritStats, rollBirthConditions,
  applyMods, unknownParent } from './genetics.js';
import { SCHEMA_VERSION } from '../save.js';

/**
 * Every option is optional; anything left out is rolled.
 * @param {Object} [opts]
 * @param {string} [opts.firstName]
 * @param {string} [opts.lastName]
 * @param {'male'|'female'|'nonbinary'} [opts.gender]
 * @param {string} [opts.countryId]
 * @param {string} [opts.city]
 * @param {{skin?:number, hair?:number, hairStyle?:number, eyes?:number}} [opts.appearance]
 * @param {'music'|'sports'|'acting'|'crime'|'singing'|'dance'} [opts.talent]  a guaranteed natural gift
 * @param {'struggling'|'comfortable'|'wealthy'} [opts.background]
 * @returns {import('../types.js').GameState}
 */
export function createLife(opts = {}) {
  rng.seed((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);

  const c = COUNTRIES[opts.countryId] ?? rng.pick(COUNTRY_LIST);
  const gender = opts.gender ?? rng.pick(['male', 'female']);
  const lastName = opts.lastName?.trim() || rng.pick(c.names.last);
  const firstName = opts.firstName?.trim()
    || rng.pick(c.names[gender] ?? [...c.names.male, ...c.names.female]);
  const city = opts.city && c.cities.includes(opts.city) ? opts.city : rng.pick(c.cities);
  const year = new Date().getFullYear();
  const picked = opts.appearance ?? {};

  // Family first, then the child is derived from the parents.
  const fam = generateFamily(c, lastName, { background: opts.background, skinHint: picked.skin, avoidNames: [firstName] });
  const { mother, father } = fam;
  const genes = father ?? unknownParent(mother);
  const family = [mother, ...(father ? [father] : []), ...fam.siblings, ...fam.grandparents, ...fam.pets];

  const appearance = { ...inheritAppearance(mother, genes) };
  for (const k of ['skin', 'hair', 'hairStyle', 'eyes']) if (picked[k] != null) appearance[k] = picked[k];
  if (fam.twin) { fam.twin.age = 0; if (rng.chance(0.4)) fam.twin.appearance = { ...appearance }; }

  const { stats, hidden } = inheritStats(mother, genes);
  const { traits, sources } = inheritTraits(mother, genes);
  const born = rollBirthConditions();

  /** @type {import('../types.js').Character} */
  const player = {
    id: uid('pc'), firstName, lastName, gender, age: 0, birthYear: year,
    countryId: c.id, city, birthCountryId: c.id,
    stats, hidden, talents: inheritTalents(mother, genes, opts.talent),
    traits, traitSources: sources, birth: born.map((b) => b.id), conditions: [],
    appearance,
    education: { stage: 'none', enrolled: false, yearInStage: 0, gpa: 0, effort: 50, absences: 0,
      clique: null, clubs: [], majorId: null, funding: null, housing: 'home', roommateId: null, housingAid: false,
      degrees: [], expelled: false, droppedOut: false },
    career: { careerId: null, title: null, level: 0, salary: 0, performance: 50, yearsInRole: 0,
      yearsInField: 0, coworkerIds: [], bossId: null, partTime: null, history: [], retired: false,
      pensionPerYear: 0, military: null },
    finance: { cash: 0, loans: [], pension: 0, lifetimeEarned: 0, lifetimeTaxPaid: 0 },
    assets: [], inventory: [],
    npcIds: family.map((n) => n.id),
    legal: { record: [], incarceration: null, heat: 0 },
    social: { handle: null, followers: 0, posts: 0, viral: 0, boughtFollowers: 0 },
    flags: { livesWithParents: true, parentsStatus: fam.status },
    milestones: [{ age: 0, text: `Born in ${city}, ${c.name}.`, kind: 'life' }],
    counters: { crimes: 0, kills: 0, donated: 0, gambled: 0, yearsJailed: 0, escapes: 0,
      livesSaved: 0, spouses: 0, jobsHeld: 0, countriesLived: 1 },
    alive: true, generation: 1,
  };

  for (const id of traits) applyMods(player, TRAIT_BY_ID[id]);
  for (const b of born) {
    applyMods(player, b);
    if (b.illness) {
      const ill = ILLNESS_BY_ID[b.illness];
      player.conditions.push({ id: ill.id, name: ill.name, severity: ill.severity,
        chronic: !!ill.chronic, sinceAge: 0, treated: false });
    }
  }

  // Opening journal
  const j = (text, tone = 'neutral') => ({ age: 0, text, kind: 'system', tone });
  const kind = gender === 'male' ? 'a boy' : gender === 'female' ? 'a girl' : 'a baby';
  const journal = [
    j(`You are born in ${city}, ${c.name}: ${kind} named ${firstName} ${lastName}.`),
    j(`Your mother is ${mother.firstName}, a ${mother.occupation}, age ${mother.age}.`),
  ];
  if (father) {
    journal.push(j(`Your father is ${father.firstName}, a ${father.occupation}, age ${father.age}.`));
    if (fam.status === 'separated') journal.push(j('Your parents are no longer together. You live with your mother.'));
  } else {
    journal.push(j('Your father is not in the picture.'));
  }
  const wealth = [mother, father].filter(Boolean).reduce((s, n) => s + n.wealth, 0) / (father ? 2 : 1);
  journal.push(j(wealth >= 70 ? 'Your family is wealthy.' : wealth >= 40
    ? 'Your family is comfortably off.' : 'Your family does not have much money.'));
  if (fam.twin) {
    journal.push(j(`You are a twin! Your ${fam.twin.gender === 'male' ? 'brother' : 'sister'} ${fam.twin.firstName} was born minutes after you.`, 'good'));
  }
  for (const s of fam.siblings.filter((n) => n !== fam.twin)) {
    journal.push(j(`You have an older ${s.gender === 'male' ? 'brother' : 'sister'}, ${s.firstName}, age ${s.age}.`));
  }
  if (fam.grandparents.length) {
    journal.push(j(`You have ${fam.grandparents.length} living grandparent${fam.grandparents.length > 1 ? 's' : ''}.`));
  }
  for (const pet of fam.pets) journal.push(j(`The family ${pet.species}, ${pet.firstName}, sniffs you suspiciously.`));
  for (const b of born) journal.push(j(b.desc, b.stats?.health < 0 || b.illness ? 'bad' : 'neutral'));
  for (const id of traits) {
    const who = sources[id];
    if (who !== 'self') journal.push(j(`You have your ${who}'s ${TRAIT_BY_ID[id].name.toLowerCase()} nature.`));
  }
  const gift = Object.entries(player.talents).find(([, v]) => v >= 75);
  if (gift) journal.push(j(`Something about you hints at a gift for ${gift[0]}.`, 'good'));

  return {
    schemaVersion: SCHEMA_VERSION, slotId: uid('life'),
    createdAt: Date.now(), updatedAt: Date.now(), year,
    player, npcs: Object.fromEntries(family.map((n) => [n.id, n])),
    journal, market: { prices: {}, history: {}, cycle: 0 },
    eventHistory: [], pendingEvents: [], rngSeed: rng.state(),
    settings: { theme: 'auto' },
  };
}
