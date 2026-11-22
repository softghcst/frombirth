// Looking after animals: where they come from, what they cost, what a
// household can take on, the vet, insurance, fostering, and giving one up.
//
// Everything here is written into the family's record (engine/animals.js).
// Places are kept beside it, in state.animals.places, so they outlast a life:
//   shelters[city]  an animal rescue: its people, and the animals waiting there.
//                   Those animals are real records (family: false) that stay
//                   the same from one visit to the next until someone takes them.
//   clinics[city]   a vet's surgery: its vets and what it charges.
// Money goes through one ledger, state.animals.ledger. Every charge has an id
// and a key (year, animal, what for): the same thing is never charged twice,
// and insurance pays back once against one charge.
import { store } from '../state.js';
import { rng } from '../rng.js';
import { clamp, cap, localCost, fmtMoney, theCountry } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { SPECIES, speciesOf, SPACES, ROUTINES, VET_SERVICES, INSURANCE, PERMIT_FEE } from '../data/animals.js';
import { PROPERTY_BY_ID } from '../data/properties.js';
import { makeNpc } from './npcFactory.js';
import * as zoo from './animals.js';

const T = zoo.tools;
const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const S = (state) => state ?? store.state;
const say = (state, text, tone = 'neutral') => { const e = { age: state.player.age, text, kind: 'system', tone }; state.journal.push(e); return e; };
const list = (xs) => xs.join(', ').replace(/, ([^,]*)$/, ' and $1');
const an = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

// ---------- Places ----------

export function places(state = store.state) {
  const A = zoo.ensure(state);
  A.places ??= {};
  for (const k of ['shelters', 'clinics', 'schools', 'stables', 'shows']) A.places[k] ??= {};
  return A.places;
}
export const cityKey = (state = store.state) => `${state.player.countryId}:${state.player.city}`;
/** A local name nobody has to be told twice: the same for the same place, every time. */
export function localName(countryId, key, gender) {
  const c = COUNTRIES[countryId];
  const roll = T.seeded(key);
  const g = gender ?? roll.pick(['female', 'male']);
  return { name: `${roll.pick(c.names[g] ?? c.names.female)} ${roll.pick(c.names.last)}`, gender: g };
}

/** The animal rescue in the player's city, made the first time anyone looks for it. */
export function shelter(state = store.state) {
  const P = places(state);
  const key = cityKey(state);
  if (!P.shelters[key]) {
    const { city, countryId } = state.player;
    const roll = T.seeded(`shelter:${key}`);
    P.shelters[key] = { id: `shelter:${key}`, key, city, countryId,
      name: roll.pick([`${city} Animal Rescue`, `Second Chance ${city}`, `The ${city} Dogs and Cats Home`, `Paws of ${city}`, `${city} Animal Shelter`]),
      capacity: roll.int(6, 9), feeK: 0.8 + roll.int(0, 5) / 10, founded: state.year - roll.int(4, 40),
      staff: [{ ...localName(countryId, `${key}:manager`), role: 'Manager' }, { ...localName(countryId, `${key}:care`), role: 'Animal care' }, { ...localName(countryId, `${key}:adoptions`), role: 'Adoptions' }],
      stockYear: null, seq: 0 };
  }
  return P.shelters[key];
}

const FARM_INTAKE = [['chicken', 42], ['duck', 14], ['goat', 20], ['sheep', 14], ['donkey', 7], ['pony', 3]];
/** The farm animal rescue near the player: hens at the end of their laying, goats nobody could fence in, a donkey or two. */
export function farmRescue(state = store.state) {
  const P = places(state);
  const key = `${cityKey(state)}:farm`;
  if (!P.shelters[key]) {
    const { city, countryId } = state.player;
    const roll = T.seeded(`farm:${key}`);
    P.shelters[key] = { id: `shelter:${key}`, key, city, countryId, farm: true, name: roll.pick([`${city} Farm Animal Rescue`, `Hen and Hoof, ${city}`, `The ${city} Smallholders' Rehoming Scheme`]),
      capacity: roll.int(6, 10), feeK: 0.8 + roll.int(0, 5) / 10, founded: state.year - roll.int(3, 30),
      staff: [{ ...localName(countryId, `${key}:manager`), role: 'Manager' }, { ...localName(countryId, `${key}:care`), role: 'Stockperson' }], stockYear: null, seq: 0 };
  }
  return P.shelters[key];
}

const HISTORIES = ['Found as a stray, with no chip and nobody looking.', 'Given up when their owner moved somewhere that did not allow animals.', 'Their owner died, and nobody in the family could take them.',
  'Came in from a home with far too many animals.', 'Handed in by someone who could no longer afford the vet.', 'Born at the shelter.', 'Left behind when a tenancy ended.'];
const FARM_HISTORIES = ['Came from a farm that was giving up.', 'A laying hen at the end of her working life.', 'Kept as a pet by someone who did not have the land.', 'Bottle-reared, and too tame to go back to a flock.', 'Found wandering on a road.'];
const INTAKE = [['dog', 34], ['cat', 34], ['rabbit', 9], ['guinea_pig', 6], ['hamster', 4], ['rat', 3], ['mouse', 2], ['budgie', 4], ['ferret', 3], ['parrot', 2], ['leopard_gecko', 2], ['bearded_dragon', 2], ['corn_snake', 2], ['tortoise', 1]];

/** The animals waiting at a shelter now. They are the same ones as last time, less any who found homes, plus new arrivals. */
export function shelterAnimals(sh = shelter(), state = store.state) {
  const A = zoo.ensure(state);
  const there = () => zoo.everyAnimal(state).filter((a) => a.status === 'living' && !a.inCircle && zoo.homeOf(a)?.key === sh.id);
  if (sh.stockYear !== state.year) {
    const years = sh.stockYear == null ? 0 : state.year - sh.stockYear;
    for (const a of there()) {
      // Time has passed: some have gone to other homes, and the very old have died.
      const roll = T.seeded(`${a.id}:${state.year}`);
      const old = a.born != null && state.year - a.born >= a.lifespan;
      if (!old && !(years > 0 && roll.chance(1 - 0.7 ** years))) continue;
      if (a.family === false) { delete A.byId[a.id]; continue; }
      // One the family once knew: its story is finished properly, not dropped.
      if (old) { a.status = 'deceased'; a.died = state.year; a.ageAtDeath = state.year - a.born; for (const l of [a.ownerships, a.care, a.homes]) T.closeOpen(l, state.year, 'death');
        T.record(state, { type: 'died', animalId: a.id, people: [], sig: 2, text: `${a.name} died at the age of ${a.ageAtDeath}, in the care of ${sh.name}.` });
      } else zoo.leaveToOrg(state, a, { placed: true, why: 'adopted', org: { id: null, org: sh.id, name: sh.name } });
    }
    const roll = T.seeded(`${sh.id}:${state.year}`);
    const want = roll.int(4, sh.capacity);
    const banned = (id) => SPECIES[id].banned.includes(sh.countryId);
    for (let guard = 0; there().length < want && guard < 30; guard++) {
      const r = T.seeded(`${sh.id}:${state.year}:${++sh.seq}`);
      const sp = SPECIES[r.weighted((sh.farm ? FARM_INTAKE : INTAKE).filter(([id]) => !banned(id)), (x) => x[1])[0]];
      const lifespan = r.int(sp.lifespan[0], sp.lifespan[1]);
      const taken = new Set(there().map((a) => a.name));
      const names = sp.names.filter((n) => !taken.has(n));
      const share = r.weighted([[0.04, 3], [0.2, 4], [0.45, 3], [0.75, 2]], (x) => x[1])[0];
      zoo.register({ id: `an_${T.hash(`${sh.id}:${sh.seq}`).toString(36)}${sh.seq}`, firstName: r.pick(names.length ? names : sp.names), species: sp.id,
        age: Math.max(0, Math.min(lifespan - 1, Math.round(lifespan * share * (0.6 + r.next() * 0.8)))), lifespan, alive: true, meters: { relationship: 50 } },
      { state, stock: sh, origin: 'shelter', history: sh.farm ? r.pick(FARM_HISTORIES) : r.pick(HISTORIES) });
    }
    sh.stockYear = state.year;
  }
  return there().sort((x, y) => x.name.localeCompare(y.name));
}

/** The vet's surgery in the player's city. */
export function clinic(state = store.state) {
  const P = places(state);
  const key = cityKey(state);
  if (!P.clinics[key]) {
    const { city, countryId } = state.player;
    const roll = T.seeded(`clinic:${key}`);
    const lead = localName(countryId, `${key}:vet1`);
    P.clinics[key] = { id: `clinic:${key}`, key, city, countryId,
      name: roll.pick([`${city} Veterinary Surgery`, `${lead.name.split(' ')[1]} & Partners Vets`, `The ${city} Animal Clinic`, `Riverside Vets, ${city}`]),
      priceK: 0.85 + roll.int(0, 5) / 10, lowCost: roll.chance(0.6),
      vets: [{ ...lead, role: 'Veterinary surgeon' }, { ...localName(countryId, `${key}:vet2`), role: 'Veterinary surgeon' }, { ...localName(countryId, `${key}:nurse`), role: 'Veterinary nurse' }] };
  }
  return P.clinics[key];
}

// ---------- The people at these places ----------

/**
 * Someone who works at one of these places, as a person in the player's life: made the first time the
 * player deals with them, and the same person every time after. Each place keeps who it has introduced.
 * @param {object} place  a shelter, clinic, yard, school or training club
 * @param {number} i      which of its people
 */
export function meetStaff(place, i = 0, state = store.state) {
  const p = state.player;
  const who = (place.staff ?? place.vets)?.[i];
  if (!who) return null;
  place.met ??= {};
  let n = place.met[i] ? state.npcs[place.met[i]] : null;
  if (!n) {
    const [firstName, ...rest] = who.name.split(' ');
    n = makeNpc({ role: 'friend', countryId: place.countryId, age: 26 + (T.hash(`${place.id}:${i}`) % 30), gender: who.gender, firstName, lastName: rest.join(' '), relationship: 35 });
    n.occupation = who.role.toLowerCase(); n.flags.tag = `staff:${place.id}:${i}`; n.flags.title = `${who.role}, ${place.name}`;
    // Someone met through work does not drift out of the record the way an old school friend does.
    state.npcs[n.id] = n;
    place.met[i] = n.id;
  }
  if (!n.alive) return null;
  if (!p.npcIds.includes(n.id)) p.npcIds.push(n.id);
  n.lastInteractionAge = p.age;
  n.meters.relationship = clamp(n.meters.relationship + 2);
  return n;
}

// ---------- Renting with animals ----------

/**
 * What the landlord allows, for the place the player rents now. Decided when they move in, and
 * fixed for as long as they stay. Animals already in the house are allowed for: the player found a
 * place that would take them, and pays a little more rent for it.
 *   'any'    animals welcome, with a deposit      'small'  caged animals, fish and cats only
 *   'none'   no animals at all
 */
export function rentalPolicy(state = store.state) {
  const p = state.player;
  if (p.homeId || p.flags.livesWithParents || p.legal?.incarceration) return null;
  const key = `${p.countryId}:${p.city}:${p.flags.emigratedAge ?? 0}:${p.flags.rentalSince ?? 0}`;
  if (p.flags.petPolicy?.key !== key) {
    const roll = T.seeded(`rent:${p.id}:${key}`);
    let kind = roll.weighted([['any', 4], ['small', 3], ['none', 3]], (x) => x[1])[0];
    const here = zoo.householdAnimals(state).filter((a) => !a.board);
    const needs = here.some((a) => !SMALL_OK(a)) ? 'any' : here.length ? 'small' : null;
    const premium = needs && (kind === 'none' || (kind === 'small' && needs === 'any'));
    if (premium) kind = needs;
    p.flags.petPolicy = { key, kind, premium: !!premium, since: state.year };
  }
  return p.flags.petPolicy;
}
const SMALL_OK = (a) => speciesOf(a.speciesId).space === 'small' || a.speciesId === 'cat' || speciesOf(a.speciesId).group === 'reptile';
export const PET_DEPOSIT = 300;
export const PET_RENT = 360;

/** The things an animal needs at home on the first day, by kind. Bought once, and kept. */
const KIT = {
  dog: ['a bed', 'bowls', 'a lead and collar', 'a crate'], cat: ['a bed', 'bowls', 'a litter tray', 'a scratching post'], rabbit: ['a large pen', 'a hay rack', 'a hide'],
  guinea_pig: ['a large pen', 'a hay rack', 'two hides'], hamster: ['a large enclosure', 'a wheel', 'deep bedding'], rat: ['a tall cage', 'hammocks'], mouse: ['a tank with deep bedding', 'a wheel'],
  ferret: ['a cage', 'hammocks', 'tunnels'], parrot: ['a large cage', 'perches', 'foraging toys'], budgie: ['a flight cage', 'perches'], fish: ['a tank', 'a filter', 'a heater'],
  leopard_gecko: ['a vivarium', 'a heat mat', 'hides'], bearded_dragon: ['a large vivarium', 'a UV lamp', 'a basking lamp'], corn_snake: ['a secure vivarium', 'a heat mat', 'hides'], tortoise: ['a tortoise table', 'a UV lamp', 'an outdoor run'],
  chicken: ['a fox-proof coop', 'a feeder'], duck: ['a duck house', 'a small pond'], goat: ['a field shelter', 'a hay rack'], sheep: ['a field shelter'],
  horse: ['a headcollar', 'rugs', 'grooming kit', 'tack'], pony: ['a headcollar', 'rugs', 'grooming kit', 'tack'], donkey: ['a headcollar', 'a field shelter'],
};
const KIT_COST = { small: 120, room: 220, yard: 300, land: 900 };
/** Sets a new animal up at home: the kit is bought once and goes in the player's things. */
export function setUpHome(a, state = store.state) {
  const p = state.player; const c = COUNTRIES[p.countryId];
  const items = KIT[a.speciesId] ?? ['what it needs'];
  const cost = localCost(KIT_COST[speciesOf(a.speciesId).space] ?? 200, c);
  const tx = pay(state, Math.min(cost, Math.max(0, p.finance.cash)), 'supplies', a.id, `kit|${a.id}`);
  if (!(p.inventory ?? []).some((x) => x.forAnimal === a.id)) (p.inventory ??= []).push({ id: `kit_${a.id}`, name: `${cap(list(items))}, for ${a.name}`, kind: 'animal', value: 0, forAnimal: a.id });
  a.kit = items;
  return tx.amount;
}

// ---------- Money ----------

/** Takes money once for one thing. `key` names the thing: asking again with the same key takes nothing. */
export function pay(state, amount, kind, animalId, key) {
  const A = zoo.ensure(state);
  A.ledger ??= [];
  const had = A.ledger.find((t) => t.k === key);
  if (had) return had;
  const p = state.player;
  p.finance.cash -= amount;
  const tx = { id: `tx_${A.ledger.length + 1}`, k: key, year: state.year, age: p.age, gen: p.generation ?? 1, kind, animalId, amount, currency: COUNTRIES[p.countryId].currency.code };
  A.ledger.push(tx);
  return tx;
}
export const ledgerOf = (animalId, state = store.state) => (zoo.ensure(state).ledger ?? []).filter((t) => t.animalId === animalId);
export const spentThisYear = (state = store.state) => (zoo.ensure(state).ledger ?? []).filter((t) => t.year === state.year && t.gen === (state.player.generation ?? 1)).reduce((s, t) => s + t.amount, 0);

// ---------- What a household can take on ----------

const ROOM = { trailer: 'room', studio: 'room', condo: 'room', house: 'yard', townhouse: 'yard', country: 'land', mansion: 'land' };
/** How much room the player's home has for animals. */
export function homeSpace(state = store.state) {
  const p = state.player;
  if (p.legal?.incarceration) return null;
  const home = p.homeId ? p.assets.find((x) => x.id === p.homeId) : null;
  if (home) return ROOM[home.catalogId] ?? 'room';
  if (p.flags.livesWithParents) return 'yard';
  if (p.education?.enrolled && p.education.housing === 'dorm') return 'small';
  return 'room';
}
const SPACE_WORDS = { small: 'a quiet corner', room: 'a home with a room to call its own', yard: 'a home with a garden', land: 'land: a paddock, a field, somewhere with grass' };
/** The least room this individual needs. A big, tireless dog needs a garden; a quiet one of the same size may not. */
export function spaceNeeded(a) {
  const sp = speciesOf(a.speciesId);
  if (a.speciesId === 'dog' && a.appearance.size === 'large' && (a.temperament.activity ?? 50) >= 65) return 'yard';
  return sp.space ?? 'room';
}
const loadOf = (a) => speciesOf(a.speciesId).load ?? 0.5;
/** How many animals' worth of care the household can give, and how much of it is spoken for. */
export function careCapacity(state = store.state) {
  const p = state.player;
  const space = homeSpace(state);
  const adults = 1 + T.livingBy(state, ['spouse']).filter((n) => !n.flags.abroad).length;
  const total = p.flags.livesWithParents && !p.homeId ? 3.5 : 1.25 + adults * 0.75 + (space === 'yard' ? 1 : space === 'land' ? 3.5 : 0);
  // Horses kept at a livery yard are looked after there; they do not use up the household's hands.
  const used = zoo.householdAnimals(state).filter((a) => !a.board).reduce((s, a) => s + loadOf(a), 0);
  return { total, used: Math.round(used * 100) / 100, free: Math.round((total - used) * 100) / 100 };
}

/** What a year of looking after this animal costs its owner, in local money. */
export function yearlyCost(a, state = store.state) {
  const c = COUNTRIES[state.player.countryId];
  const sp = speciesOf(a.speciesId);
  const care = localCost((sp.cost ?? 300) * (ROUTINES[a.routine ?? 'standard']?.k ?? 1), c);
  return { care, insurance: a.insurance?.premium ?? 0, board: a.board?.fee ?? 0, total: care + (a.insurance?.premium ?? 0) + (a.board?.fee ?? 0) };
}
/** Whether the player is the one who pays for this animal. */
export const paysFor = (a, state = store.state) => a.status === 'living' && a.inCircle && !a.foster && zoo.ownerOf(a)?.id === state.player.id;

// ---------- Animals getting to know each other ----------

const HUNTERS = ['dog', 'cat', 'ferret'];
const PREY = ['rabbit', 'hamster', 'guinea_pig', 'rat', 'budgie', 'parrot', 'fish', 'chicken', 'duck'];
const pairKey = (x, y) => [x, y].sort().join('|');
const pairCap = (a, b) => ((HUNTERS.includes(a.speciesId) && PREY.includes(b.speciesId)) || (HUNTERS.includes(b.speciesId) && PREY.includes(a.speciesId)) ? 25
  : a.speciesId === b.speciesId ? 96 : a.speciesId === 'fish' || b.speciesId === 'fish' ? 30 : 85);
export const pairWord = (v, top) => (top <= 25 ? 'kept safely apart' : v < 30 ? 'wary of each other' : v < 55 ? 'tolerating each other' : v < 75 ? 'comfortable together' : 'close companions');
/** How a newcomer and each animal already in the house are likely to get on, before they have met. */
export function outlook(a, state = store.state) {
  return zoo.householdAnimals(state).filter((b) => b.id !== a.id).map((b) => {
    const top = pairCap(a, b);
    const roll = T.seeded(pairKey(a.id, b.id));
    const start = top <= 25 ? 10 : clamp(Math.round((a.speciesId === b.speciesId ? 48 : 30) + ((a.temperament.sociability ?? 50) + (b.temperament.sociability ?? 50) - 100) / 5 + roll.int(-8, 8)), 5, top);
    return { other: b, start, top, text: top <= 25 ? `${b.name} is ${an(speciesOf(b.speciesId).name)} ${speciesOf(b.speciesId).name}: the two must always be kept apart, in separate rooms.`
      : start < 30 ? `${b.name} may take a long time to accept ${a.name}. Slow introductions, separate spaces at first.` : start < 55 ? `${b.name} and ${a.name} should settle with careful introductions.` : `${b.name} is likely to welcome the company.` };
  });
}
function introduce(state, a) {
  const A = zoo.ensure(state);
  A.pairs ??= {};
  for (const o of outlook(a, state)) A.pairs[pairKey(a.id, o.other.id)] ??= { a: a.id, b: o.other.id, value: o.start, top: o.top, since: state.year };
}
/** The other animals this one knows, and how they get on. */
export function companionsOf(a, state = store.state) {
  return Object.values(zoo.ensure(state).pairs ?? {}).filter((x) => x.a === a.id || x.b === a.id).map((x) => ({ other: zoo.animalById(x.a === a.id ? x.b : x.a, state), value: x.value, since: x.since, word: pairWord(x.value, x.top) })).filter((x) => x.other);
}

// ---------- Adoption ----------

/**
 * Whether the player's household can take this animal, and what it would mean.
 * Nothing here turns on being rich: it is room, hands, the law, and being able to cover the first months.
 * @returns {{ok:boolean, problems:string[], notes:string[], fee:number, yearly:number}}
 */
export function adoptionCheck(animalId, { foster = false, state = store.state } = {}) {
  const a = zoo.animalById(animalId, state);
  const p = state.player;
  const c = COUNTRIES[p.countryId];
  const sp = speciesOf(a.speciesId);
  const sh = Object.values(places(state).shelters).find((x) => x.id === zoo.homeOf(a)?.key) ?? shelter(state);
  const fee = foster ? 0 : localCost((sp.fee ?? 50) * sh.feeK, c);
  const yearly = localCost(sp.cost ?? 300, c);
  const problems = []; const notes = [];
  if (p.age < 18) problems.push('You are too young to sign for an animal. This is a decision for the adults of the house.');
  const space = homeSpace(state);
  if (!space) problems.push('You have nowhere to keep an animal.');
  if (sp.banned.includes(p.countryId)) problems.push(`It is against the law to keep ${an(sp.name)} ${sp.name} in ${theCountry(c.name)}.`);
  const need = spaceNeeded(a);
  if (space && SPACES.indexOf(space) < SPACES.indexOf(need)) problems.push(`${a.name} needs ${SPACE_WORDS[need]}. Where you live now does not have it.`);
  const capNow = careCapacity(state);
  if (capNow.free < loadOf(a)) problems.push('Your household already has as many animals as it can look after properly.');
  if (sp.permit.includes(p.countryId) && !foster) notes.push(`Keeping ${an(sp.name)} ${sp.name} in ${theCountry(c.name)} needs a license: ${fmtMoney(localCost(PERMIT_FEE, c), c)}, applied for with the adoption.`);
  if (sp.group === 'reptile') notes.push(`${cap(sp.name)}s need heat and light all their lives, and a vet who knows reptiles.${a.speciesId === 'tortoise' ? ' A tortoise may well outlive you: someone will need to take it on.' : ''}`);
  const lease = rentalPolicy(state);
  if (lease && ['companion', 'reptile'].includes(speciesOf(a.speciesId).group)) {
    if (lease.kind === 'none') problems.push('Your tenancy does not allow animals. The landlord would not budge.');
    else if (lease.kind === 'small' && !SMALL_OK(a)) problems.push(`Your landlord allows cats and caged animals only. ${a.name} would not be allowed.`);
    else if (!foster && !(state.animals?.ledger ?? []).some((t) => t.k === `deposit|${lease.key}`)) notes.push(`Your landlord asks for a pet deposit of ${fmtMoney(localCost(PET_DEPOSIT, c), c)}.`);
  }
  const partner = T.livingBy(state, ['spouse', 'partner']).find((n) => n.flags.livesTogether || n.role === 'spouse');
  if (partner && T.seeded(`objects:${partner.id}`).chance(0.25)) notes.push(`${partner.firstName} is not keen on another animal in the house, and will say so.`);
  if (!foster && p.finance.cash < fee + Math.round(yearly / 2)) problems.push(`You could not cover the ${fmtMoney(fee, c)} fee and the first months of food and supplies.`);
  for (const o of outlook(a, state)) notes.push(o.text);
  if (speciesOf(a.speciesId).group === 'equine') notes.push(`${a.name} would be a companion on your land, not a riding horse: ${zoo.pronoun(a)} needs shelter, a farrier and another equine for company.`);
  if (['chicken', 'duck', 'goat', 'sheep'].includes(a.speciesId) && !zoo.householdAnimals(state).some((b) => b.speciesId === a.speciesId)) notes.push(`${cap(sp.name)}s are flock animals: one alone is unhappy. Take two.`);
  if (a.speciesId === 'dog' && need === 'room' && a.appearance.size !== 'small') notes.push(`With no garden, ${a.name} will need long walks every day.`);
  if (['guinea_pig', 'rat', 'rabbit', 'budgie'].includes(a.speciesId) && !zoo.householdAnimals(state).some((b) => b.speciesId === a.speciesId)) notes.push(`${cap(sp.name)}s do best with another of their own kind.`);
  if (zoo.stageOf(a, state) === 'senior') notes.push(`${a.name} is in later life: fewer years, and more visits to the vet.`);
  if (foster) notes.push(`${sh.name} pays the vet's bills while ${a.name} is with you. Food and everyday things are yours to provide.`);
  return { ok: !problems.length, problems, notes, fee, yearly, shelter: sh };
}

/** The animal's entry among the people the player knows: the player's own bond with it, and what they can do together. */
function makeHandle(state, a, bond) {
  const p = state.player;
  const npc = makeNpc({ role: 'pet', countryId: p.countryId, lastName: p.lastName, age: zoo.ageOf(a, state) ?? 0, firstName: a.name, relationship: bond });
  npc.id = a.id; npc.species = a.speciesId; npc.lifespan = a.lifespan; npc.lastInteractionAge = p.age;
  if (a.sex) npc.gender = a.sex;
  delete npc.traits; delete npc.orientation;
  state.npcs[npc.id] = npc;
  if (!p.npcIds.includes(npc.id)) p.npcIds.push(npc.id);
  return npc;
}
const firstBondWith = (a) => Math.round(clamp(38 + ((a.temperament.sociability ?? 50) - 50) / 4 + ((a.temperament.affection ?? 50) - 50) / 5 + ((a.temperament.confidence ?? 50) - 50) / 6, 15, 70));

/** Adopts an animal that is waiting at a shelter. The fee is taken once. */
export function adopt(animalId, state = store.state) {
  const a = zoo.animalById(animalId, state);
  if (!a || a.inCircle || a.status !== 'living') return result(false, 'That animal is not waiting for a home.', 'neutral');
  const check = adoptionCheck(animalId, { state });
  if (!check.ok) return result(false, check.problems[0], 'neutral');
  const p = state.player; const c = COUNTRIES[p.countryId];
  const sp = speciesOf(a.speciesId);
  pay(state, check.fee, 'adoption', a.id, `adoption|${a.id}|${state.year}`);
  if (sp.permit.includes(p.countryId)) { pay(state, localCost(PERMIT_FEE, c), 'permit', a.id, `permit|${a.id}`); a.permit = { year: state.year, countryId: p.countryId }; }
  const lease = rentalPolicy(state);
  if (lease && lease.kind !== 'none' && speciesOf(a.speciesId).group === 'companion') pay(state, localCost(PET_DEPOSIT, c), 'deposit', null, `deposit|${lease.key}`);
  const npc = makeHandle(state, a, firstBondWith(a));
  const text = `You signed the papers at ${check.shelter.name} and came home with ${a.name}, ${an(zoo.stageOf(a, state))} ${zoo.stageOf(a, state)}${zoo.stageOf(a, state).includes(sp.name) ? '' : ` ${sp.name}`}. The fee was ${fmtMoney(check.fee, c)}.`;
  zoo.register(npc, { state, origin: 'shelter', fee: check.fee, shelterName: check.shelter.name, storyEntry: say(state, text, 'good') });
  a.adoptedFrom = check.shelter.id;
  introduce(state, a);
  setUpHome(a, state);
  meetStaff(check.shelter, 2, state); // the person who handles adoptions
  // A partner who did not want another animal says so, once.
  const partner = T.livingBy(state, ['spouse', 'partner']).find((n) => n.flags.livesTogether || n.role === 'spouse');
  if (partner && T.seeded(`objects:${partner.id}`).chance(0.25)) { partner.meters.relationship = clamp(partner.meters.relationship - 6); say(state, `${partner.firstName} had said not yet. Now there is ${a.name}, and a conversation still to finish.`, 'bad'); }
  p.stats.mood = clamp(p.stats.mood + 8);
  return result(true, text, 'good', { animalId: a.id });
}

/** "Get a pet" in one step: the first animal at the local shelter that the household can properly take. */
export function quickAdopt(state = store.state) {
  const stock = shelterAnimals(shelter(state), state);
  const fit = stock.filter((a) => adoptionCheck(a.id, { state }).ok).sort((x, y) => Number(['dog', 'cat'].includes(y.speciesId)) - Number(['dog', 'cat'].includes(x.speciesId)));
  if (fit.length) return adopt(fit[0].id, state);
  return result(false, stock.length ? adoptionCheck(stock[0].id, { state }).problems[0] : 'The shelter has no animals waiting just now.', 'neutral');
}

/**
 * The family takes an animal in because a child asked. The adults decide: on room, on hands, on money.
 * It is theirs, not the child's; the child helps.
 */
export function familyAdopts(state = store.state) {
  const p = state.player;
  const parents = T.livingBy(state, ['parent']);
  if (!parents.length || !p.flags.livesWithParents) return { ok: false, text: 'There is nobody to ask.' };
  const have = zoo.householdAnimals(state);
  const means = Math.max(...parents.map((n) => n.wealth ?? n.meters.money ?? 40));
  if (have.reduce((s, x) => s + loadOf(x), 0) >= 2.5) return { ok: false, text: 'They say the house has enough animals to look after already.' };
  if (means < 22) return { ok: false, text: 'They sit you down and explain, gently, what a vet costs. Not this year.' };
  const stock = shelterAnimals(shelter(state), state).filter((a) => ['dog', 'cat', 'rabbit', 'guinea_pig'].includes(a.speciesId) && outlook(a, state).every((o) => o.top > 25));
  if (!stock.length) return { ok: false, text: 'You all go to the shelter. Nobody there is right for your house, this time.' };
  const roll = T.seeded(`family:${p.id}:${state.year}`);
  const a = roll.pick(stock);
  const sh = shelter(state);
  const npc = makeHandle(state, a, clamp(firstBondWith(a) + 12));
  zoo.register(npc, { state, origin: 'shelter', shelterName: sh.name, pending: true, quiet: true });
  T.record(state, { type: 'adopted', animalId: a.id, people: [zoo.ownerOf(a), ...zoo.helpersOf(a), T.ref(state, p.id)], sig: 3, pending: true,
    text: `${zoo.ownerOf(a).name} adopted ${a.name}, ${an(speciesOf(a.speciesId).name)} ${speciesOf(a.speciesId).name}, from ${sh.name} after ${p.firstName} asked for one.`,
    memories: [T.memory(T.ref(state, p.id), `You asked, and asked, and one Saturday they said yes. ${a.name} came home in the back seat.`, `${p.firstName} had asked for months.`)] });
  introduce(state, a);
  return { ok: true, animalId: a.id, text: `You all go to ${sh.name}, and come home with ${a.name}, ${an(speciesOf(a.speciesId).name)} ${speciesOf(a.speciesId).name}. ${cap(zoo.pronoun(a))} is the family's, and your job is to help.` };
}

// ---------- Fostering ----------

export function foster(animalId, state = store.state) {
  const a = zoo.animalById(animalId, state);
  if (!a || a.inCircle || a.status !== 'living') return result(false, 'That animal is not waiting for a home.', 'neutral');
  const check = adoptionCheck(animalId, { foster: true, state });
  if (!check.ok) return result(false, check.problems[0], 'neutral');
  const npc = makeHandle(state, a, firstBondWith(a));
  const text = `You agreed to foster ${a.name} for ${check.shelter.name}: a home for now, until a permanent one is found.`;
  zoo.register(npc, { state, foster: check.shelter, storyEntry: say(state, text, 'good') });
  meetStaff(check.shelter, 2, state);
  state.player.flags.animalExperience = true;
  introduce(state, a);
  return result(true, text, 'good', { animalId: a.id });
}
/** What can be decided about a foster placement now. */
export const fosterChoices = (a) => (a.foster ? [{ id: 'adopt', label: `Apply to adopt ${a.name}` }, { id: 'return', label: 'Let them go to a permanent home' }] : []);
/**
 * 'adopt'  the fosterer applies like anyone else; nothing about fostering makes the animal theirs
 * 'keep'   another year                'return'  the placement ends: a family is found, or it goes back to wait
 */
export function fosterDecision(animalId, what, state = store.state) {
  const a = zoo.animalById(animalId, state);
  const p = state.player; const c = COUNTRIES[p.countryId];
  if (!a?.foster || !state.npcs[a.id]) return result(false, 'There is nothing to decide.', 'neutral');
  const org = { id: a.foster.org, name: a.foster.name };
  const sp = speciesOf(a.speciesId);
  if (what === 'keep') { a.foster.review = state.year + 1; a.foster.extended = (a.foster.extended ?? 0) + 1; return result(true, `${a.name} stays with you another year. ${org.name} will keep looking.`, 'neutral'); }
  if (what === 'adopt') {
    const sh = Object.values(places(state).shelters).find((x) => x.id === org.id);
    const fee = localCost((sp.fee ?? 50) * (sh?.feeK ?? 1), c);
    if (p.age < 18) return result(false, 'You are too young to sign for an animal.', 'neutral');
    if (p.finance.cash < fee) return result(false, `The adoption fee is ${fmtMoney(fee, c)}. You do not have it.`, 'neutral');
    pay(state, fee, 'adoption', a.id, `adoption|${a.id}|${state.year}`);
    const me = T.ref(state, p.id);
    a.fostered = { ...a.foster, until: state.year, adopted: true }; delete a.foster;
    T.setOwner(state, a, me, 'adopted');
    a.origin = { ...a.origin, how: 'shelter', fee, currency: c.currency.code };
    const text = `${org.name} approved your application. ${a.name} is not going anywhere: ${zoo.pronoun(a)} is yours. The fee was ${fmtMoney(fee, c)}.`;
    T.record(state, { type: 'adopted', animalId: a.id, people: [me, ...zoo.helpersOf(a)], sig: 3, story: text, tone: 'good',
      text: `${me.name} adopted ${a.name} after fostering ${zoo.pronoun(a, 'them')} for ${org.name}.`,
      memories: [T.memory(me, `You had been calling ${a.name} yours for months before it was true.`, `${p.firstName} had been calling ${a.name} theirs for months.`)] });
    p.stats.mood = clamp(p.stats.mood + 8);
    return result(true, text);
  }
  const bond = state.npcs[a.id].meters.relationship;
  const found = T.seeded(`${a.id}:placed:${state.year}`).chance(0.75);
  const text = found ? `A family came for ${a.name}. ${cap(zoo.pronoun(a))} went without looking back, which is what you wanted, and it stung anyway.`
    : `${a.name} went back to ${org.name} to wait for a permanent home.`;
  zoo.leaveToOrg(state, a, { placed: found, why: 'the foster placement ended', story: text, tone: 'neutral',
    text: found ? `${a.name} left ${p.firstName}'s foster care for a permanent home with a new family.` : `${a.name}'s foster placement with ${p.firstName} ended; ${zoo.pronoun(a)} went back to ${org.name}.`,
    memories: [T.memory(T.ref(state, p.id), bond >= 65 ? `Letting ${a.name} go was the hardest part of doing it right.` : `You were glad to have given ${a.name} somewhere to wait.`, `${p.firstName} fostered ${a.name} until a home was found.`)] });
  p.stats.mood = clamp(p.stats.mood - Math.round(bond / 20));
  p.hidden.karma = clamp(p.hidden.karma + 3);
  return result(true, text, 'neutral');
}

// ---------- Giving an animal up ----------

/** Who could take an animal the player can no longer keep: family first, then a rescue. */
export function rehomeOptions(animalId, state = store.state) {
  const a = zoo.animalById(animalId, state);
  const p = state.player;
  if (!a || a.status !== 'living' || !state.npcs[a.id] || a.foster || zoo.ownerOf(a)?.id !== p.id) return [];
  const kin = T.livingBy(state, ['spouse', 'child', 'sibling', 'parent', 'grandchild', 'friend']).filter((n) => n.age >= 18 && !n.flags.abroad && n.meters.relationship >= 45)
    .sort((x, y) => (zoo.bondOf(a, y.id) ?? 0) - (zoo.bondOf(a, x.id) ?? 0) || y.meters.relationship - x.meters.relationship).slice(0, 6); // those the animal knows, then those closest to the player
  return [...kin.map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: `${cap(zoo.kinWord(state, n.id) ?? n.role)}${zoo.bondOf(a, n.id) != null ? ` · already knows ${a.name}` : ''}` })),
    ...(speciesOf(a.speciesId).group === 'companion' ? [{ value: 'shelter', label: shelter(state).name, sub: 'They will look for a new home. You will not be told where.' }] : [])];
}
export function rehome(animalId, to, state = store.state) {
  const a = zoo.animalById(animalId, state);
  const p = state.player;
  if (!rehomeOptions(animalId, state).some((o) => o.value === to)) return result(false, 'That is not possible.', 'neutral');
  const bond = state.npcs[a.id].meters.relationship;
  const me = T.ref(state, p.id);
  p.stats.mood = clamp(p.stats.mood - Math.round(4 + bond / 12));
  if (to === 'shelter') {
    const sh = shelter(state);
    const text = `You took ${a.name} to ${sh.name} and signed ${zoo.pronoun(a, 'them')} over. ${cap(zoo.pronoun(a))} watched you leave.`;
    zoo.leaveToOrg(state, a, { why: 'given up', org: { id: null, org: sh.id, name: sh.name }, story: text, tone: 'bad',
      text: `${me.name} could no longer keep ${a.name}, and gave ${zoo.pronoun(a, 'them')} into the care of ${sh.name}.`,
      memories: [T.memory(me, `You still think about whether ${a.name} understood.`, `${p.firstName} gave ${a.name} up, and did not talk about it.`)] });
    p.hidden.karma = clamp(p.hidden.karma - 3);
    return result(true, text, 'bad');
  }
  const who = T.ref(state, to);
  T.setOwner(state, a, who, 'rehomed within the family'); T.setPrimary(state, a, who, 'rehomed');
  for (const x of a.care) if (x.to == null && x.role === 'helper') { x.to = state.year; x.ended = 'rehomed'; }
  T.firstBond(a, who, 10);
  if (!a.board) T.setHome(state, a, T.homeWith(state, who)); // a horse at livery stays at its yard; its new owner pays
  delete a.insurance;
  const text = `${a.name} lives with ${zoo.whoPhrase(state, who)} now. You can still visit.`;
  T.record(state, { type: 'care', animalId: a.id, people: [me, who], sig: 3, key: `rehome:${to}`, story: text,
    text: `${me.name} could no longer keep ${a.name}. ${who.name} took ${zoo.pronoun(a, 'them')} in and became ${zoo.pronoun(a, 'their')} owner.`,
    memories: [T.memory(me, `It was the right home for ${a.name}. That did not make it easy.`, `${p.firstName} found ${a.name} a home in the family.`), T.memory(who, `${a.name} came to you from ${p.firstName}.`, `${who.name.split(' ')[0]} took ${a.name} in.`)] });
  return result(true, text, 'neutral');
}

// ---------- Everyday care ----------

export function setRoutine(animalId, routine, state = store.state) {
  const a = zoo.animalById(animalId, state);
  if (!a || !paysFor(a, state) || !ROUTINES[routine]) return result(false, 'That is not yours to decide.', 'neutral');
  a.routine = routine;
  return result(true, `${a.name} is on ${ROUTINES[routine].name.toLowerCase()} from now on.`, 'neutral');
}

// ---------- The vet ----------

const canTake = (a, state) => a.status === 'living' && !!state.npcs[a.id]?.alive && state.player.age >= 16
  && (zoo.livesWithPlayer(a.id, state) || zoo.ownerOf(a)?.id === state.player.id || zoo.primaryOf(a)?.id === state.player.id);
/** What the vet offers this animal this year, with prices. */
export function vetServices(animalId, state = store.state) {
  const a = zoo.animalById(animalId, state);
  if (!a || !canTake(a, state)) return [];
  const sp = speciesOf(a.speciesId);
  if (!sp.exam) return [];
  const cl = clinic(state);
  const c = COUNTRIES[state.player.countryId];
  const A = zoo.ensure(state);
  return VET_SERVICES.filter((s) => (!s.only || s.only.includes(a.speciesId)) && (!s.senior || zoo.stageOf(a, state) === 'senior')).map((s) => {
    const price = a.foster ? 0 : localCost(sp.exam * s.k * cl.priceK, c);
    const done = (A.ledger ?? []).some((t) => t.k === `vet|${a.id}|${s.id}|${state.year}`);
    return { ...s, price, done, affordable: state.player.finance.cash >= price };
  });
}
export function vetVisit(animalId, serviceId, state = store.state) {
  const a = zoo.animalById(animalId, state);
  const svc = vetServices(animalId, state).find((s) => s.id === serviceId);
  const p = state.player; const c = COUNTRIES[p.countryId];
  if (!a || !svc) return result(false, 'The vet cannot do that for this animal.', 'neutral');
  if (svc.done) return result(false, `${a.name} has already had that this year.`, 'neutral');
  if (!svc.affordable) return result(false, `That costs ${fmtMoney(svc.price, c)}. You do not have it.`, 'neutral');
  const cl = clinic(state);
  const npc = state.npcs[a.id];
  const tx = pay(state, svc.price, 'vet', a.id, `vet|${a.id}|${svc.id}|${state.year}`);
  const vi = a.vetIndex ??= T.hash(a.id) % 2; // an animal is seen by the same vet, year after year
  const vet = cl.vets[vi];
  meetStaff(cl, vi, state);
  const roll = T.seeded(`${a.id}:${svc.id}:${state.year}`);
  let note = { wellness: 'Yearly check-up. Nothing to worry about.', vaccination: 'Vaccinations given.', dental: 'Teeth checked and cleaned.', senior: 'Senior health screen. Results as expected for the age.' }[svc.id];
  let more = '';
  if (svc.id === 'vaccination') a.vaccinated = state.year;
  if (svc.id === 'wellness' || svc.id === 'senior') {
    a.lastCheck = state.year;
    npc.meters.health = clamp(npc.meters.health + roll.int(1, 4));
    if (roll.chance(svc.id === 'senior' ? 0.3 : 0.12)) {
      note = `${svc.name}. Something small was found early, and dealt with before it became something large.`;
      more = ` ${vet.name.split(' ')[0]} found something small, early, and dealt with it.`;
      npc.meters.health = clamp(npc.meters.health + 3);
      // Care in later life can buy time. Not much, and not always.
      if (zoo.stageOf(a, state) === 'senior' && (a.lifeBonus ?? 0) < 2) { a.lifeBonus = (a.lifeBonus ?? 0) + 1; a.lifespan += 1; npc.lifespan += 1; }
    }
  }
  if (svc.id === 'dental') npc.meters.health = clamp(npc.meters.health + 2);
  a.health.push({ id: `h${a.health.length + 1}`, year: state.year, age: zoo.ageOf(a, state), kind: 'vet', service: svc.id, note, cost: svc.price, currency: c.currency.code,
    recovered: null, paidBy: svc.price ? T.ref(state, p.id) : null, clinic: cl.name, vet: vet.name, txId: tx.id, eventId: null });
  npc.lastInteractionAge = p.age;
  const text = `You took ${a.name} to ${cl.name} for ${svc.name.toLowerCase()}${svc.price ? `: ${fmtMoney(svc.price, c)}` : `; ${a.foster.name} paid`}.${more}`;
  say(state, text, 'neutral');
  return result(true, text, 'neutral');
}

// ---------- Insurance ----------

export function insuranceQuote(animalId, state = store.state) {
  const a = zoo.animalById(animalId, state);
  const sp = speciesOf(a.speciesId);
  const c = COUNTRIES[state.player.countryId];
  if (!paysFor(a, state)) return { available: false, why: 'Only an owner can insure an animal.' };
  if (!sp.insure) return { available: false, why: `Nobody sells insurance for ${an(sp.name)} ${sp.name}.` };
  if (a.insurance) return { available: false, why: `${a.name} is already insured.`, premium: a.insurance.premium };
  if (zoo.stageOf(a, state) === 'senior') return { available: false, why: `Insurers will not start a policy for an animal of ${a.name}'s age.` };
  const share = (zoo.ageOf(a, state) ?? 0) / Math.max(1, a.lifespan);
  return { available: true, premium: localCost(sp.insure * (1 + share), c), deductible: localCost(INSURANCE.deductible, c), rate: INSURANCE.rate, yearCap: localCost(INSURANCE.yearCap, c) };
}
export function insure(animalId, state = store.state) {
  const a = zoo.animalById(animalId, state);
  const q = insuranceQuote(animalId, state);
  const c = COUNTRIES[state.player.countryId];
  if (!q.available) return result(false, q.why, 'neutral');
  if (state.player.finance.cash < q.premium) return result(false, `The first year's premium is ${fmtMoney(q.premium, c)}. You do not have it.`, 'neutral');
  a.insurance = { since: state.year, premium: q.premium, deductible: q.deductible, rate: q.rate, yearCap: q.yearCap, paidUntil: state.year, claimed: {} };
  pay(state, q.premium, 'insurance', a.id, `insurance|${a.id}|${state.year}`);
  const text = `You insured ${a.name}: ${fmtMoney(q.premium, c)} a year. It pays ${Math.round(q.rate * 100)}% of illness and injury after the first ${fmtMoney(q.deductible, c)}, and nothing toward routine care.`;
  say(state, text);
  return result(true, text, 'neutral');
}
export function cancelInsurance(animalId, state = store.state) {
  const a = zoo.animalById(animalId, state);
  if (!a?.insurance) return result(false, 'There is no policy to cancel.', 'neutral');
  delete a.insurance;
  return result(true, `${a.name}'s insurance is canceled.`, 'neutral');
}
/** Pays back what the policy owes against one bill. Once for each bill, and never above the year's limit. */
function claim(state, a, tx) {
  const pol = a.insurance;
  if (!pol || !['treatment', 'emergency'].includes(tx.kind)) return 0;
  const A = zoo.ensure(state);
  if (A.ledger.some((t) => t.refOf === tx.id)) return 0;
  const left = pol.yearCap - (pol.claimed[state.year] ?? 0);
  const back = Math.max(0, Math.min(left, Math.round((tx.amount - pol.deductible) * pol.rate)));
  if (!back) return 0;
  pol.claimed[state.year] = (pol.claimed[state.year] ?? 0) + back;
  const r = pay(state, -back, 'insurance payout', a.id, `payout|${tx.id}`);
  r.refOf = tx.id;
  return back;
}

// ---------- Illness and emergencies: the choices in the scenes ----------

/**
 * A choice made in one of the animal scenes (data/events/animals.js).
 * @param {{do:string, costBase?:number, chance?:number}} v
 * @returns {string} what to add to the scene's outcome
 */
export function sceneChoice(v, cast, state = store.state) {
  const p = state.player; const c = COUNTRIES[p.countryId];
  const a = zoo.animalById(cast.pet, state);
  const npc = a && state.npcs[a.id];
  if (v.do === 'familyAdopt') { const r = familyAdopts(state); if (r.ok) cast.pet = r.animalId; return r.text; }
  if (!a || !npc) return '';
  const they = cap(zoo.pronoun(a));
  if (v.do === 'treat') {
    const cl = clinic(state);
    const emergency = v.kind === 'emergency';
    const price = a.foster ? 0 : localCost(v.costBase * cl.priceK * (emergency ? 1 : cl.lowCost && p.finance.cash < localCost(v.costBase * 3, c) ? 0.6 : 1), c);
    const tx = pay(state, Math.min(price, Math.max(0, p.finance.cash)), emergency ? 'emergency' : 'treatment', a.id, `${v.kind}|${a.id}|${state.year}`);
    const back = claim(state, a, tx);
    const checked = a.lastCheck != null && state.year - a.lastCheck <= 1;
    const well = rng.chance(clamp((v.chance ?? 0.85) + (checked ? 0.05 : 0) + (npc.meters.health - 60) / 400, 0.2, 0.97));
    const vet = cl.vets[T.hash(`${a.id}:${state.year}:e`) % 2];
    const entry = { id: `h${a.health.length + 1}`, year: state.year, age: zoo.ageOf(a, state), kind: 'vet', service: emergency ? 'emergency' : 'treatment',
      note: emergency ? (well ? 'Emergency treatment. Came through it.' : 'Emergency treatment. Everything possible was done.') : (well ? 'Treated for an illness, and recovered.' : 'Treated for an illness. It will need managing from now on.'),
      cost: tx.amount, currency: c.currency.code, recovered: well, paidBy: tx.amount ? T.ref(state, p.id) : null, clinic: cl.name, vet: vet.name, txId: tx.id, reimbursed: back, eventId: null };
    a.health.push(entry);
    const money = `${tx.amount ? `It cost ${fmtMoney(tx.amount, c)}.` : `${a.foster?.name ?? 'The rescue'} paid the bill.`}${back ? ` The insurance paid back ${fmtMoney(back, c)}.` : ''}${price > tx.amount ? ' The clinic let you pay what you could.' : ''}`;
    if (well) {
      npc.meters.health = clamp(npc.meters.health + (emergency ? -4 : 2));
      npc.meters.relationship = clamp(npc.meters.relationship + 6);
      const ev = T.record(state, { type: emergency ? 'emergency' : 'recovery', animalId: a.id, people: [T.ref(state, p.id)], sig: emergency ? 3 : 2, key: entry.id, pending: true,
        text: emergency ? `${a.name} was rushed to ${cl.name} by ${T.fullName(p)}, and came through it.` : `${a.name} was treated at ${cl.name}, and recovered.`,
        memories: [T.memory(T.ref(state, p.id), emergency ? `The drive to the vet with ${a.name}, and every red light on the way.` : `The week ${a.name} was ill, and the relief when it was over.`, `${p.firstName} got ${a.name} to the vet in time.`)] });
      entry.eventId = ev.id;
      return `${vet.name} ${emergency ? 'worked on' : 'treated'} ${a.name}, and ${zoo.pronoun(a)} came through. ${money}`;
    }
    if (emergency) { npc.alive = false; zoo.animalDied(npc, state); p.stats.mood = clamp(p.stats.mood - Math.round(8 + npc.meters.relationship / 5)); return `${vet.name} did everything that could be done. It was not enough. ${money}`; }
    (a.conditions ??= []).push({ name: 'a long-term condition', since: state.year });
    npc.meters.health = clamp(npc.meters.health - 12);
    return `${a.name} is better, but not cured: it will need watching for the rest of ${zoo.pronoun(a, 'their')} life. ${money}`;
  }
  if (v.do === 'wait') {
    const well = rng.chance(clamp((v.chance ?? 0.5) + (npc.meters.health - 60) / 300, 0.1, 0.9));
    a.health.push({ id: `h${a.health.length + 1}`, year: state.year, age: zoo.ageOf(a, state), kind: 'illness', note: well ? 'Unwell for some days. Recovered at home without seeing a vet.' : v.kind === 'emergency' ? 'An emergency that was not taken to a vet.' : 'Unwell, and worse before better. Not seen by a vet.',
      cost: 0, currency: c.currency.code, recovered: well, paidBy: null, eventId: null });
    if (well) { npc.meters.relationship = clamp(npc.meters.relationship + 2); return `${they} came right in ${zoo.pronoun(a, 'their')} own time.`; }
    if (v.kind === 'emergency' && rng.chance(0.55)) { npc.alive = false; zoo.animalDied(npc, state); p.stats.mood = clamp(p.stats.mood - Math.round(12 + npc.meters.relationship / 4)); p.hidden.karma = clamp(p.hidden.karma - 4); return `By morning it was too late. You will always know what you did not do.`; }
    npc.meters.health = clamp(npc.meters.health - 14); npc.meters.relationship = clamp(npc.meters.relationship - 4); p.stats.mood = clamp(p.stats.mood - 6);
    return `${they} got worse before ${zoo.pronoun(a)} got better, and is not quite what ${zoo.pronoun(a)} was.`;
  }
  if (v.do === 'foster') return fosterDecision(a.id, v.what, state).text;
  if (v.do === 'settle') {
    // Help with settling in, or with something that has become a habit: slow, kind, and it works by degrees.
    const gain = v.help === 'trainer' ? 9 : v.help === 'vet' ? 6 : 5;
    if (v.costBase) pay(state, localCost(v.costBase, c), 'training', a.id, `settle|${a.id}|${state.year}`);
    npc.meters.relationship = clamp(npc.meters.relationship + gain);
    a.settled = (a.settled ?? 0) + gain;
    return v.costBase ? `It cost ${fmtMoney(localCost(v.costBase, c), c)}.` : '';
  }
  if (v.do === 'routine') { a.routine = v.routine; return ''; }
  if (v.do === 'askToTake') {
    // The family decides, and what they weigh is the animal: who it is closest to, and whether it could live well with the player.
    const owner = zoo.ownerOf(a);
    const theirs = owner?.id ? zoo.bondOf(a, owner.id) ?? 60 : 60;
    const room = homeSpace(state) && SPACES.indexOf(homeSpace(state)) >= SPACES.indexOf(spaceNeeded(a)) && careCapacity(state).free >= loadOf(a);
    if (!room) { npc.meters.relationship = clamp(npc.meters.relationship + 2); return `They ask where ${a.name} would live, and you hear the answer as you say it. ${they} stays.`; }
    if (npc.meters.relationship < theirs + 8) return `${cap(zoo.whoPhrase(state, owner))} says, kindly, that ${a.name} is settled here and is staying. You can visit whenever you like.`;
    const me = T.ref(state, p.id);
    T.setOwner(state, a, me, 'given by the family'); T.setPrimary(state, a, me, 'moved in with them');
    T.setHome(state, a, zoo.playerHome(state));
    introduce(state, a);
    T.record(state, { type: 'care', animalId: a.id, people: [owner, me], sig: 3, key: `took:${p.id}`, pending: true,
      text: `${owner.name} agreed that ${a.name} should go and live with ${me.name}, who became ${zoo.pronoun(a, 'their')} owner.`,
      memories: [T.memory(me, `They said ${a.name} had chosen you years ago.`, `${p.firstName} took ${a.name} to live with them.`), T.memory(owner, `Letting ${a.name} go with ${p.firstName} was right. The house was quiet for a long time.`, `${owner.name.split(' ')[0]} let ${a.name} go with ${p.firstName}.`)] });
    return `${cap(zoo.whoPhrase(state, owner))} looks at ${a.name}, who is sitting on your feet, and says it was never really in doubt. ${a.name} is yours.`;
  }
  if (v.do === 'visit') { npc.meters.relationship = clamp(npc.meters.relationship + 8); npc.lastInteractionAge = p.age; T.setBond(a, T.ref(state, p.id), npc.meters.relationship); return ''; }
  return '';
}

// ---------- The year ----------

/** Yearly, after the record itself has been brought up to date. Runs once for each year. */
export function tickCare(state = store.state) {
  const A = zoo.ensure(state);
  if (A.careYear === state.year) return;
  A.careYear = state.year;
  const p = state.player; const c = COUNTRIES[p.countryId];
  const mine = zoo.allAnimals(state).filter((a) => a.status === 'living' && a.inCircle && state.npcs[a.id]?.alive);

  // What it cost. One line in the life story, however many animals.
  let spent = 0; const short = [];
  for (const a of mine) {
    if (!(paysFor(a, state) || (a.foster && zoo.primaryOf(a)?.id === p.id))) continue;
    const cost = yearlyCost(a, state);
    const due = cost.care + cost.board;
    const can = Math.max(0, Math.min(due, p.finance.cash));
    const tx = pay(state, can, 'care', a.id, `care|${a.id}|${state.year}`);
    spent += tx.amount;
    if (can < due) { short.push(a); a.stretched = state.year; state.npcs[a.id].meters.health = clamp(state.npcs[a.id].meters.health - 2); }
    if (a.insurance) {
      if (p.finance.cash >= a.insurance.premium) { spent += pay(state, a.insurance.premium, 'insurance', a.id, `insurance|${a.id}|${state.year}`).amount; a.insurance.paidUntil = state.year; } else { delete a.insurance; say(state, `You could not pay ${a.name}'s insurance. The policy has lapsed.`, 'bad'); }
    }
  }
  const lease = rentalPolicy(state);
  if (lease?.premium && mine.some((a) => zoo.livesWithPlayer(a.id, state) && speciesOf(a.speciesId).group === 'companion')) spent += pay(state, Math.min(localCost(PET_RENT, c), Math.max(0, p.finance.cash)), 'pet rent', null, `petrent|${lease.key}|${state.year}`).amount;
  if (spent > 0) say(state, `Looking after ${list(mine.filter((a) => paysFor(a, state) || a.foster).map((a) => a.name))} cost ${fmtMoney(spent, c)} this year.`);
  if (short.length) say(state, `Money was too short to look after ${list(short.map((a) => a.name))} as well as you wanted. A food bank and the low-cost clinic made up some of the difference.`, 'bad');

  for (const a of mine) {
    const npc = state.npcs[a.id];
    const stage = zoo.stageOf(a, state);
    const roll = T.seeded(`${a.id}:year:${state.year}`);
    // Health follows care: a good routine and a vet who knows the animal help; age does what age does.
    let d = 0;
    if (a.routine === 'enriched' || (a.routine === 'senior' && stage === 'senior')) d += 1;
    if (a.lastCheck != null && state.year - a.lastCheck <= 1) d += 1;
    if (stage === 'senior' || stage === 'old') d -= roll.int(0, 3);
    if ((a.conditions ?? []).length) d -= 1;
    npc.meters.health = clamp(npc.meters.health + d);
    if ((stage === 'senior' || stage === 'old') && !a.seniorNoted && zoo.livesWithPlayer(a.id, state)) {
      a.seniorNoted = state.year;
      say(state, `${a.name} is getting older: slower on the stairs, grayer round the face. ${paysFor(a, state) ? 'It may be time to change how you look after ' + zoo.pronoun(a, 'them') + '.' : ''}`.trim());
    }
  }

  // The animals of the house get used to each other, a little each year.
  for (const pr of Object.values(A.pairs ?? {})) {
    const x = A.byId[pr.a]; const y = A.byId[pr.b];
    if (!x || !y || x.status !== 'living' || y.status !== 'living' || zoo.homeOf(x)?.key !== zoo.homeOf(y)?.key) continue;
    const before = pr.value;
    pr.value = Math.min(pr.top, pr.value + T.seeded(`${pr.a}|${pr.b}:${state.year}`).int(2, 9));
    if (before < 75 && pr.value >= 75 && x.family !== false) {
      T.record(state, { type: 'companions', animalId: x.id, people: [], sig: 2, key: `pair:${pr.b}`,
        story: zoo.livesWithPlayer(x.id, state) ? `${x.name} and ${y.name} have started sleeping in the same patch of sun.` : null,
        text: `${x.name} and ${y.name} became close companions.` });
    }
  }

  if (!p.alive || p.legal?.incarceration) return;
  const waiting = new Set(state.pendingEvents.map((e) => e.id));
  // A foster placement comes up for review.
  for (const a of mine) {
    if (a.foster && state.year >= a.foster.review && !waiting.has('foster_review')) { state.pendingEvents.push({ id: 'foster_review', cast: { pet: a.id } }); waiting.add('foster_review'); }
  }
  const queue = (id, a) => { if (!waiting.has(id)) { state.pendingEvents.push({ id, cast: { pet: a.id } }); waiting.add(id); } };
  const seenAt = (id) => state.eventHistory.find((h) => h.id === id)?.lastAge ?? -99;
  for (const a of mine) {
    const npc = state.npcs[a.id];
    const roll = T.seeded(`${a.id}:scene:${state.year}`);
    const mineToKeep = paysFor(a, state) || !!a.foster;
    const arrived = a.homes[a.homes.length - 1]?.from;
    // The first year somewhere new is hard for an animal that startles easily.
    if (mineToKeep && arrived === state.year - 1 && !a.settled && ((a.temperament.confidence ?? 50) < 40 || (a.temperament.adaptability ?? 50) < 35) && ['dog', 'cat', 'rabbit', 'parrot', 'ferret'].includes(a.speciesId)) queue('new_home_nerves', a);
    if (mineToKeep && a.seniorNoted === state.year && (a.routine ?? 'standard') === 'standard') queue('older_animal', a);
    const away = !zoo.livesWithPlayer(a.id, state) && zoo.homeOf(a)?.hh === 'parents' && !npc.flags.abroad;
    if (away && zoo.eventsOf(a.id, state).some((e) => e.type === 'stayed' && e.year === state.year) && npc.meters.relationship >= 75 && p.age >= 18) queue('take_them_with_you', a);
    else if (away && npc.meters.relationship >= 45 && p.age - seenAt('home_for_holidays') >= 3 && roll.chance(0.3)) queue('home_for_holidays', a);
    if (a.speciesId === 'dog' && zoo.livesWithPlayer(a.id, state) && p.age >= 16 && p.age - seenAt('walk_neighbor') >= 12 && roll.chance(0.1)) queue('walk_neighbor', a);
  }
  // Illness is uncommon, and less common in an animal that is looked after. At most one such scene in a year.
  if (p.age >= 12) {
    for (const a of mine.filter((x) => zoo.livesWithPlayer(x.id, state) && speciesOf(x.speciesId).exam)) {
      if (waiting.has('animal_unwell') || waiting.has('animal_emergency') || waiting.has('pet_poorly')) break;
      const stage = zoo.stageOf(a, state);
      const care = (a.vaccinated != null && state.year - a.vaccinated <= 3 ? 0.6 : 1) * (a.lastCheck != null && state.year - a.lastCheck <= 2 ? 0.8 : 1);
      if (rng.chance(0.012)) { state.pendingEvents.push({ id: 'animal_emergency', cast: { pet: a.id } }); waiting.add('animal_emergency'); } else if (rng.chance((stage === 'senior' ? 0.09 : 0.035) * care)) { state.pendingEvents.push({ id: 'animal_unwell', cast: { pet: a.id } }); waiting.add('animal_unwell'); }
    }
  }
}

// ---------- Checking ----------

/** How many of a currency make one base unit, for the country that uses it. */
const scaleOf = (code, state) => Object.values(COUNTRIES).find((c) => c.currency.code === code)?.currency.scale ?? COUNTRIES[state.player.countryId].currency.scale;

/** Everything wrong with the money and the places. An empty list means they are sound. */
export function auditCare(state = store.state) {
  const A = zoo.ensure(state);
  const bad = [];
  const keys = new Set(); const ids = new Set();
  for (const t of A.ledger ?? []) {
    if (keys.has(t.k)) bad.push(`charged twice: ${t.k}`);
    if (ids.has(t.id)) bad.push(`two charges share an id: ${t.id}`);
    keys.add(t.k); ids.add(t.id);
    if (!t.currency) bad.push(`${t.id}: no currency`);
    if (t.refOf) { const of = A.ledger.find((x) => x.id === t.refOf); if (!of) bad.push(`${t.id}: pays back a bill that does not exist`); else if (-t.amount > of.amount && t.kind !== 'prize') bad.push(`${t.id}: pays back more than the bill`); }
    else if (t.amount < 0 && t.kind !== 'sale') bad.push(`${t.id}: money from nowhere`);
    if (t.kind === 'sale' && ledgerOf(t.animalId, state).filter((x) => x.kind === 'sale').length > 1) bad.push(`${t.id}: the same animal sold twice`);
    // (each payment is judged in its own currency: a family that has moved country keeps its old records in the old money)
    if (t.kind === 'prize' && -t.amount > 400 * scaleOf(t.currency, state) * 3) bad.push(`${t.id}: a prize larger than any class pays`);
  }
  for (const pr of Object.values(A.pairs ?? {})) if (pr.value > pr.top) bad.push(`${pr.a}|${pr.b}: closer than they could be`);
  for (const a of zoo.everyAnimal(state)) {
    if (a.family === false && (a.inCircle || state.npcs[a.id])) bad.push(`${a.name}: in the player's life but not the family's`);
    if (a.foster && zoo.ownerOf(a)?.id) bad.push(`${a.name}: fostered, but owned by a person`);
    if (a.insurance && !paysFor(a, state)) bad.push(`${a.name}: insured by someone who does not own it`);
  }
  return bad;
}

// ---------- Moving country ----------

/** Countries that hold arriving animals in quarantine for a while, at the owner's cost. A gameplay simplification of real rules. */
const QUARANTINE = ['au', 'nz', 'jp', 'sg', 'hk', 'tw', 'is', 'mu'];
const TRAVEL = { small: 160, room: 900, yard: 1100, land: 6500 };
/**
 * What it would take to bring each of the household's animals to another country.
 * @returns {{a:object, cost:number, ok:boolean, why:string, quarantine:boolean}[]}
 */
export function travelPlan(destId, state = store.state) {
  const p = state.player; const c = COUNTRIES[p.countryId];
  return zoo.householdAnimals(state).filter((a) => state.npcs[a.id] && (paysFor(a, state) || a.foster)).map((a) => {
    const sp = speciesOf(a.speciesId);
    const q = QUARANTINE.includes(destId) && sp.group !== 'farm';
    const cost = localCost((TRAVEL[spaceNeeded(a)] ?? 900) * (q ? 2.2 : 1), c);
    const why = a.foster ? `${a.name} belongs to ${a.foster.name}, and goes back to them.`
      : sp.banned.includes(destId) ? `It is against the law to keep ${an(sp.name)} ${sp.name} in ${theCountry(COUNTRIES[destId].name)}.`
        : a.speciesId === 'fish' ? 'Fish do not survive a move between countries well. A friend could take the tank.'
          : sp.group === 'farm' ? `Farm animals are not moved abroad as pets. ${a.name} would stay behind with someone who can keep ${zoo.pronoun(a, 'them')}.` : '';
    return { a, cost: why ? 0 : cost, ok: !why, why, quarantine: q && !why };
  });
}
/**
 * Before the household leaves: papers, transport and, where needed, quarantine for those coming; a home for those not.
 * Called by emigration once the move is certain.
 * @param {'bring'|'leave'} choice  bring every animal that can come, or find them all homes here
 */
export function prepareMove(destId, choice = 'bring', state = store.state, forced = false) {
  const p = state.player; const c = COUNTRIES[p.countryId];
  const out = { coming: [], staying: [] };
  for (const t of travelPlan(destId, state)) {
    const a = t.a;
    if (a.foster) { fosterDecision(a.id, 'return', state); out.staying.push(a.name); continue; }
    if (t.ok && choice === 'bring' && (forced || p.finance.cash >= t.cost)) {
      if (!forced) pay(state, t.cost, 'transport', a.id, `move|${a.id}|${state.year}|${destId}`);
      a.health.push({ id: `h${a.health.length + 1}`, year: state.year, age: zoo.ageOf(a, state), kind: 'vet', service: 'travel', cost: 0, currency: c.currency.code, recovered: null, eventId: null,
        note: `Identification, vaccinations and a health certificate for the move to ${COUNTRIES[destId].name}${t.quarantine ? ', and a spell in quarantine on arrival' : ''}.` });
      out.coming.push(a.name);
      continue;
    }
    // Not coming: family first, then the rescue. The record keeps them either way.
    const to = rehomeOptions(a.id, state).find((o) => o.value !== 'shelter' && !state.npcs[o.value]?.flags.willComeAge)?.value ?? 'shelter';
    if (rehomeOptions(a.id, state).some((o) => o.value === to)) rehome(a.id, to, state);
    else zoo.leaveToOrg(state, a, { why: 'the family moved abroad', text: `${a.name} stayed behind when the family moved abroad, in the care of a rescue.` });
    out.staying.push(a.name);
  }
  return out;
}

// ---------- Volunteering ----------

/**
 * A year of Saturday mornings at the shelter: walking dogs, cleaning out, sitting with the frightened ones.
 * It earns nothing. It teaches a good deal, and the people there remember who turned up.
 */
export function volunteer(state = store.state) {
  const p = state.player;
  if (p.age < 14) return result(false, 'The shelter takes volunteers from fourteen.', 'neutral');
  if (p.legal?.incarceration) return result(false, 'Not from in here.', 'neutral');
  if (p.flags.volunteeredAge === p.age) return result(false, 'You have given your Saturdays this year already.', 'neutral');
  const sh = shelter(state);
  const stock = shelterAnimals(sh, state);
  p.flags.volunteeredAge = p.age;
  p.flags.volunteerYears = (p.flags.volunteerYears ?? 0) + 1;
  p.hidden.karma = clamp(p.hidden.karma + 3);
  p.stats.mood = clamp(p.stats.mood + 3);
  if (p.flags.volunteerYears >= 2) p.flags.animalExperience = true;
  // Someone there becomes someone in the player's life.
  let met = '';
  if (p.flags.volunteerYears === 2 && !p.npcIds.some((id) => state.npcs[id]?.flags.tag === 'shelter')) {
    const who = sh.staff[2];
    const [firstName, ...rest] = who.name.split(' ');
    const n = makeNpc({ role: 'friend', countryId: sh.countryId, age: clamp(p.age + rng.int(-8, 15), 18, 75), gender: who.gender, firstName, lastName: rest.join(' '), relationship: 50 });
    n.occupation = 'shelter worker'; n.flags.tag = 'shelter'; n.flags.title = `Friend from ${sh.name}`;
    state.npcs[n.id] = n; p.npcIds.push(n.id);
    met = ` ${firstName}, who runs adoptions, has started saving you the dogs nobody else can walk.`;
  }
  // The animals there get to know a regular face.
  for (const a of stock.slice(0, 3)) T.setBond(a, T.ref(state, p.id), clamp((zoo.bondOf(a, p.id) ?? 25) + rng.int(6, 14)));
  const text = `You spent the year's Saturdays at ${sh.name}${stock.length ? `, mostly with ${stock.slice(0, 2).map((a) => a.name).join(' and ')}` : ''}.${met}`;
  say(state, text, 'good');
  return result(true, text, 'good');
}
