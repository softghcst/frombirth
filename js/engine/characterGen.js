// Creates a brand-new life: the player, their family and the opening journal.
import { settle as settleHood } from './neighborhood.js';
import { syncWorld } from './history.js';
import { ensureEra } from './eras.js';
import { atBirth, held } from './citizenship.js';
import { ensureGlobal } from './globalLife.js';
import { bornKnown } from './fame.js';
import { EARLIEST_START } from '../data/eras.js';
import { fromAbroad, rollsRoots } from './economy.js';
import { rng } from '../rng.js';
import { bornInto, birthKind, titleOf, dress } from './royalty.js';
import { seatFamily, nameOf, monarchOf, bloodParent, relationToMonarch } from './dynasty.js';
import { uid, theCountry } from '../util.js';
import { COUNTRIES, COUNTRY_LIST, surnameFor } from '../data/countries.js';
import { TRAIT_BY_ID } from '../data/traits.js';
import { ILLNESS_BY_ID } from '../data/illnesses.js';
import { generateFamily } from './familyGen.js';
import { inheritAppearance, inheritTraits, inheritTalents, inheritStats, rollBirthConditions,
  applyMods, unknownParent } from './genetics.js';
import { SCHEMA_VERSION } from '../save.js';
import { rollLongevity } from './death.js';
import { healthAtBirth } from './health/index.js';
import { normalize, skinDepth, INHERITED_KEYS } from '../avatar/catalog.js';
import { rollOrientation, attractedTo, TRANS_RATE } from './identity.js';
import { ensureStyled, cloneAppearance } from '../avatar/inherit.js';
import { startingSense } from './achievements.js';
import { register as registerAnimal, reconcile as reconcileAnimals } from './animals.js';

/**
 * Every option is optional; anything left out is rolled.
 * @param {Object} [opts]
 * @param {string} [opts.firstName]
 * @param {string} [opts.lastName]
 * @param {'male'|'female'|'nonbinary'} [opts.gender]
 * @param {string} [opts.countryId]
 * @param {string} [opts.city]
 * @param {object} [opts.appearance]  a complete appearance from the editor; left out, the face is inherited
 * @param {'music'|'sports'|'acting'|'crime'|'singing'|'dance'} [opts.talent]  a guaranteed natural gift
 * @param {'struggling'|'comfortable'|'wealthy'} [opts.background]
 * @param {string} [opts.orientation]  one of ORIENTATIONS in engine/identity.js
 * @param {'commoner'|'noble'|'royal'} [opts.birthRank]  only matters in a monarchy; left out, a title at birth is rare
 * @param {boolean} [opts.trans]  whether `gender` differs from the one registered at birth
 * @returns {import('../types.js').GameState}
 */
export function createLife(opts = {}) {
  rng.seed((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);

  const c = COUNTRIES[opts.countryId] ?? rng.pick(COUNTRY_LIST);
  // `identityGender` is who they are. A transgender character is registered as something else at birth.
  const identityGender = opts.gender ?? rng.pick(['male', 'female']);
  const trans = opts.trans ?? rng.chance(TRANS_RATE);
  const gender = !trans ? identityGender : identityGender === 'male' ? 'female' : identityGender === 'female' ? 'male' : rng.pick(['male', 'female']);
  const orientation = opts.orientation ?? rollOrientation();
  const lastName = surnameFor(c.id, opts.lastName?.trim() || rng.pick(c.names.last), gender);
  const firstName = opts.firstName?.trim()
    || rng.pick(c.names[gender] ?? [...c.names.male, ...c.names.female]);
  const city = opts.city && c.cities.includes(opts.city) ? opts.city : rng.pick(c.cities);
  // A life starts in the present unless told otherwise (tests start lives in other eras: the Digital World follows the year).
  // Two ways to start in the past. `startYear` is the player's choice on the new-life screen, kept within the years
  // the eras cover; `year` is the engine's own (tests start lives anywhere history goes, e.g. 1790).
  const now = new Date().getFullYear();
  const year = Number.isInteger(opts.year) ? Math.min(now, opts.year)
    : Number.isInteger(opts.startYear) ? Math.max(EARLIEST_START, Math.min(now, opts.startYear)) : now;
  // Money, prices and currencies of the year the life begins in (engine/history.js).
  syncWorld(year);

  // Family first, then the child is derived from the parents.
  // A designed face: the family is built to resemble it.
  const designed = opts.appearance?.inherited ? normalize(opts.appearance, 'designed') : null;
  const fam = generateFamily(c, lastName, { background: opts.background, skinHint: designed ? skinDepth(designed) : undefined, avoidNames: [firstName] });
  // A royal child: the house is built around the family before the child is drawn from it.
  const birth = birthKind(c.id, opts.birthRank);
  const seat = birth === 'royal' ? seatFamily(c, year, fam, gender) : null;
  const { mother, father } = fam;
  const genes = father ?? unknownParent(mother);
  // One family in ten has a parent who came from another country. Their own parents, if living, are still there.
  let roots = null;
  if (!birth && rollsRoots('parentFromAbroad')) {
    const parent = father && rng.chance(0.5) ? father : mother;
    const from = fromAbroad(parent, c.id, { settled: true, keepSurname: parent === father, year });
    const theirs = fam.grandparents.filter((g) => g.flags.side === (parent === father ? 'paternal' : 'maternal'));
    for (const g of theirs) { g.bornIn = from; g.firstName = rng.pick(COUNTRIES[from].names[g.gender] ?? COUNTRIES[from].names.female); g.flags.abroad = from; g.flags.from = from; }
    roots = { parent, from, there: theirs.length };
  }
  const family = [mother, ...(father ? [father] : []), ...fam.siblings, ...fam.grandparents, ...fam.pets];

  if (designed) {
    // Each feature the player chose is given to one parent or the other, so the child visibly takes after them.
    for (const key of INHERITED_KEYS) {
      if (key === 'skin') continue;
      const parent = father && rng.chance(0.5) ? father : mother;
      if (rng.chance(0.8)) parent.appearance.inherited[key] = designed.inherited[key];
    }
  }
  const appearance = ensureStyled(designed ?? inheritAppearance(mother, genes), gender);
  if (fam.twin) { fam.twin.age = 0; if (rng.chance(0.4)) fam.twin.appearance = cloneAppearance(appearance); }

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
    assets: [], inventory: [], homeId: null,
    npcIds: family.map((n) => n.id),
    legal: { record: [], incarceration: null, heat: 0 },
    social: { handle: null, followers: 0, posts: 0, viral: 0, boughtFollowers: 0 },
    flags: { livesWithParents: true, parentsStatus: fam.status, longevity: 0,
      // People born in a territory ordinarily hold the nationality of the state it belongs to.
      ...(c.place?.nationalityOf ? { citizenOf: [c.place.nationalityOf] } : {}) },
    // Citizenship is its own record: birthplace, residence and nationality are three different things.
    citizenships: atBirth(c.id, [held(mother), father ? held(father) : []], year),
    locations: [{ countryId: c.id, city, from: year }],
    milestones: [{ age: 0, text: `Born in ${city}, ${c.name}.`, kind: 'life' }],
    counters: { crimes: 0, kills: 0, donated: 0, gambled: 0, yearsJailed: 0, escapes: 0,
      livesSaved: 0, spouses: 0, jobsHeld: 0, countriesLived: 1 },
    alive: true, generation: 1,
    orientation, skills: {},
  };
  player.flags.bornAs = gender;
  player.flags.interestedIn = attractedTo(orientation, identityGender);
  // A transgender child works out who they are some time in childhood.
  if (trans) { player.flags.trueGender = identityGender; player.flags.realizeAge = rng.int(4, 14); }
  // Natural gifts make the matching skills come faster all life long.
  player.flags.gifts = Object.entries(player.talents).filter(([, v]) => v >= 65).map(([k]) => k);
  // Growing up around how their parents handle money gives a child a little to start from (engine/achievements.js).
  player.flags.moneySense = startingSense([mother, father]);

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
  const an = (job) => `${/^[aeiou]/i.test(job) ? 'an' : 'a'} ${job}`;
  const j = (text, tone = 'neutral') => ({ age: 0, text, kind: 'system', tone });
  const kind = gender === 'male' ? 'a boy' : gender === 'female' ? 'a girl' : 'a baby';
  const journal = [
    j(`You are born in ${city}, ${c.name}: ${kind} named ${firstName} ${lastName}.`),
    j(`Your mother is ${mother.firstName}, ${an(mother.occupation)}, age ${mother.age}.`),
  ];
  if (father) {
    journal.push(j(`Your father is ${father.firstName}, ${an(father.occupation)}, age ${father.age}.`));
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
  if (roots) journal.push(j(`Your ${roots.parent.gender === 'male' ? 'father' : 'mother'} came to ${theCountry(c.name)} from ${theCountry(COUNTRIES[roots.from].name)}${roots.there ? `, where your grandparent${roots.there > 1 ? 's' : ''} on that side still live${roots.there > 1 ? '' : 's'}` : ''}.`));
  if (fam.grandparents.length) {
    journal.push(j(`You have ${fam.grandparents.length} living grandparent${fam.grandparents.length > 1 ? 's' : ''}.`));
  }
  for (const pet of fam.pets) journal.push(j(`The family ${pet.species}, ${pet.firstName}, sniffs you suspiciously.`));
  for (const b of born) journal.push(j(b.desc, b.stats?.health < 0 || b.illness ? 'bad' : 'neutral'));
  for (const id of traits) {
    const who = sources[id];
    if (who !== 'self') journal.push(j(`You have your ${who}'s ${TRAIT_BY_ID[id].name.toLowerCase()} nature.`));
  }
  // Born to a title, in a country that has them.
  bornInto(player, birth, seat);
  if (player.royal) {
    const royalBlood = ['heir', 'royal'].includes(player.royal.rank);
    for (const par of [mother, father].filter(Boolean)) {
      par.occupation = royalBlood ? 'member of the royal family' : 'landed aristocrat';
      par.wealth = Math.max(par.wealth, royalBlood ? 97 : 85);
      par.meters.money = par.wealth;
      par.savings = Math.max(par.savings, Math.round(par.savings * 6));
    }
    player.hidden.fame = royalBlood ? 70 : 15;
    bornKnown(player, player.hidden.fame, royalBlood ? 'royal' : 'aristocrat'); // engine/fame.js: a royal is publicly known; an aristocrat has a known name
    const what = royalBlood ? 'a member of the royal family' : 'a landed aristocrat';
    for (const e of journal) {
      if (/^Your (mother|father) is /.test(e.text)) e.text = e.text.replace(/, an? [^,]+, age/, `, ${what}, age`);
      if (/^Your family (is|does) /.test(e.text)) e.text = royalBlood ? 'Your family lives in a palace.' : 'Your family has land, a great house, and a name older than the country\'s laws.';
    }
    let born = `You are born into the nobility. One day you will be ${titleOf(c.id, player.royal.rank, gender)}.`;
    if (seat) {
      const d = seat.dynasty;
      const mon = monarchOf(d);
      const me = Object.values(d.people).find((x) => x.isPlayer);
      const rel = relationToMonarch(d, me.id).replace(/^(eldest|second|third|fourth|fifth) /, '');
      born = `You are born into the ${d.name}: ${titleOf(c.id, player.royal.rank, gender)} ${firstName}, ${rel} of ${nameOf(d, mon)}${player.royal.line ? `, and ${player.royal.line === 1 ? 'heir to the throne' : `number ${player.royal.line} in line to the throne`}` : ''}. The guns fire a salute.`;
    }
    journal.splice(1, 0, j(born, 'good'));
  }
  player.flags.longevity = rollLongevity();
  if (player.flags.longevity >= 8) journal.push(j('People in your family tend to live to a great age.', 'good'));
  const gift = Object.entries(player.talents).find(([, v]) => v >= 75);
  if (gift) journal.push(j(`Something about you hints at a gift for ${gift[0]}.`, 'good'));

  const state = {
    schemaVersion: SCHEMA_VERSION, spelling: 'us', slotId: uid('life'),
    createdAt: Date.now(), updatedAt: Date.now(), year,
    player, npcs: Object.fromEntries(family.map((n) => [n.id, n])),
    journal, market: { prices: {}, history: {}, cycle: 0 },
    eventHistory: [], pendingEvents: [], rngSeed: rng.state(),
    // This year's occasions and the family's traditions (engine/moments.js): made here, so a life is built the same way whatever the turn length.
    moments: { year, done: {}, social: 0, bonds: {}, invites: [], log: [] }, traditions: [],
    settings: { theme: 'auto' },
    ...(seat ? { dynasties: { [c.id]: seat.dynasty } } : {}),
  };
  if (seat) dress(seat.dynasty, state);
  // Genomes for the family and the child, and what the child is born with (not yet recognized by anyone).
  healthAtBirth(state, opts.health);
  // The family's animals were there first: they go on the family's record with the line that introduces them.
  for (const pet of fam.pets) registerAnimal(pet, { state, origin: 'family', storyEntry: journal.find((e) => !e.animal && e.text.startsWith(`The family ${pet.species}, ${pet.firstName},`)) });
  reconcileAnimals(state);
  player.birthCity = player.city;
  ensureGlobal(state);
  ensureEra(state); // a new life keeps its money in the money of its own years
  settleHood(state); // the family home, in a neighborhood with neighbors (engine/neighborhood.js)
  return state;
}
