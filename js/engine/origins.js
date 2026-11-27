// Adoption, birth families and identity.
//
// One character, two family networks. The player keeps one id; their adoptive family and their birth family are both
// ordinary people in state.npcs, made once and never made again. The adoptive family is the household (player.npcIds,
// role 'parent' / 'sibling'); the birth family lives its own life off-screen (role 'relative', flags.birthKin) until the
// player comes to know them, and is aged, married, moved and buried by tickOrigins() whether or not anyone is looking.
//
// What is TRUE (the save) and what the player KNOWS are kept apart. state.origins.self.people and .facts are what the
// character has learned; nothing else about the birth family is shown. A search reveals the world as it is: it never
// invents a parent, a crime, a death or a sibling. Results come at the turn of the year, one revelation at a time, so a
// 3-, 6- or 12-month turn gives the same story.
//
//   state.origins = {
//     v, records: { [id]: AdoptionRecord },          // the legal and historical facts of each adoption
//     self: FamilyOriginKnowledge | null,            // what the player knows, their curiosity, what they have done
//     search: BirthFamilySearch,                     // requests made and when they answer
//     contacts: { [npcId]: RelativeContact },        // consent, preferences, boundaries and the history of contact
//     inbox: [OriginDiscoveryEvent],                 // results waiting to be told, one a year
//     told: { [key]: year }, log: [ {key, year, age, text} ]
//   }
import { rng } from '../rng.js';
import { store, player, log, milestone } from '../state.js';
import { clamp, theCountry } from '../util.js';
import { COUNTRIES, surnameFor } from '../data/countries.js';
import { makeNpc } from './npcFactory.js';
import { generateFamily } from './familyGen.js';
import { storyBeat } from './storyDirector.js';
import { recordEvent } from './chronicle.js';
import { ADOPTION_FROM, DEFAULT_ADOPTION_FROM, RECORDS_AGE, recordsAccessShares, serviceFrom, REASONS, CONTACT,
  contactShares, tellingShares, CURIOSITY, SURPRISE, kinWord } from '../data/origins.js';

export const VERSION = 1;
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const S = () => store.state;
const npcOf = (id) => S().npcs[id];
const nm = (n) => `${n.firstName} ${n.lastName}`;

/** A number in [0, 1) from a key: the same every time, and none of the game's dice. */
export function seeded(key) {
  let h = 2166136261;
  for (const ch of String(key)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const pickW = (shares, r) => {
  const total = Object.values(shares).reduce((a, b) => a + b, 0);
  let x = r * total;
  for (const [k, w] of Object.entries(shares)) { x -= w; if (x < 0) return k; }
  return Object.keys(shares).at(-1);
};

/** When legal adoption exists in a country. */
export const adoptionFrom = (countryId) => ADOPTION_FROM[countryId] ?? DEFAULT_ADOPTION_FROM;
export const adoptionLegal = (countryId, year) => year >= adoptionFrom(countryId);

// ---------- The record ----------

export function ensureOrigins(state = S()) {
  const o = (state.origins ??= {});
  o.v ??= VERSION;
  o.records ??= {};
  o.self ??= null;
  o.search ??= { status: 'none', since: null, requests: [] };
  o.contacts ??= {};
  o.inbox ??= [];
  o.told ??= {};
  o.log ??= [];
  return o;
}

/** The player's own adoption record, if they were adopted (or raised by relatives). */
export function myRecord(state = S()) {
  const id = state?.origins?.self?.recordId;
  return id ? state.origins.records[id] ?? null : null;
}
export const isAdoptee = (state = S()) => !!myRecord(state);
/** Everyone in the player's birth family, as people in the world (whether the player knows them or not). */
export const birthKin = (state = S()) => Object.values(state.npcs).filter((n) => n.flags?.birthOf === state.player.id);

const LEVELS = ['exists', 'first', 'named', 'located', 'contact', 'met'];
/** How well the player knows of someone in their birth family: null (not at all) up to 'met'. */
export const knowLevel = (id, state = S()) => state.origins?.self?.people?.[id] ?? null;
export const knows = (id, level, state = S()) => LEVELS.indexOf(knowLevel(id, state)) >= LEVELS.indexOf(level);
function learnPerson(id, level) {
  const self = S().origins.self;
  if (!self || !npcOf(id)) return false;
  if (LEVELS.indexOf(level) <= LEVELS.indexOf(self.people[id] ?? '')) return false;
  self.people[id] = level;
  return true;
}
export const knowsFact = (key, state = S()) => !!state.origins?.self?.facts?.[key];
/** The player learns something: written down once, in their record and in the family archive (privately). */
function learn(key, text) {
  const o = S().origins;
  if (!o.self || o.self.facts[key]) return false;
  o.self.facts[key] = { year: S().year, age: player().age, text };
  o.log.push({ key, year: S().year, age: player().age, text });
  recordEvent({ key: `origins:${player().id}:${key}`, type: 'origins', title: text, privacy: 'restricted', significance: 1 });
  return true;
}

/** What the person is called, as far as the player knows: a name, a first name, or "your birth mother". */
export function knownName(n) {
  const lvl = knowLevel(n.id);
  if (!lvl || lvl === 'exists') return `your ${kinWord(n.flags.birthKin, n.gender).toLowerCase()}`;
  if (lvl === 'first') return n.firstName;
  return nm(n);
}

function giveKinFlags(n, kin, pid, extra = {}) {
  n.flags.birthKin = kin;
  n.flags.birthOf = pid;
  n.flags.openness ??= Math.round(clamp(30 + seeded(`${n.id}:open`) * 55 + ((n.meters?.generosity ?? 50) - 50) / 5));
  Object.assign(n.flags, extra);
  return n;
}

function newRecord(o, fields) {
  const id = `adopt_${fields.adopteeId}`;
  o.records[id] ??= { id, birthParentIds: [], adoptiveParentIds: [], legalParentIds: [], birthSiblingIds: [], facts: [], placementHistory: [], ...fields };
  return o.records[id];
}

// ---------- A new life: starting adopted ----------

/**
 * Turns a new life's generated family into a birth family and gives the child the family that raises them.
 * Called by engine/characterGen.js after the child is drawn from their birth parents (so looks, traits and health
 * come from them) and before the home and the neighborhood are settled.
 * @returns {null | {parents:object[], journal:string[]}}
 */
export function applyOrigin(state, { fam, c, year, origin, journal }) {
  if (!origin || origin === 'standard') return null;
  if (origin === 'surprise') origin = pickW(SURPRISE, rng.next());
  if (origin === 'standard') return null;
  const p = state.player;
  // Before legal adoption existed there, a child could still be raised by relatives: that is what happens.
  if (!adoptionLegal(c.id, year) && origin !== 'kinship') origin = 'kinship';
  const o = ensureOrigins(state);
  const { mother, father } = fam;
  const bioIds = [mother, father, ...fam.siblings, ...fam.grandparents].filter(Boolean).map((n) => n.id);
  const lines = [];
  const j = (text, tone = 'neutral') => lines.push({ age: 0, text, kind: 'system', tone });
  const reasonsFor = (when, ok = () => true) => Object.fromEntries(Object.entries(REASONS).filter(([k, r]) => r.when.includes(when) && ok(k)).map(([k, r]) => [k, r.weight]));
  const giveMotherAge = (reason) => { const [a, b] = REASONS[reason].mother; if (mother.age < a || mother.age > b) mother.age = rng.int(a, b); };
  // Older brothers and sisters can be no older than their mother allows.
  const keepSiblings = () => { fam.siblings = fam.siblings.filter((s) => s.flags.twin || s.age <= mother.age - 16); };

  const accessSeed = rng.next();
  const contactSeed = rng.next();
  const fatherNamed = !!father && rng.chance(0.55);
  const fatherUnidentified = !!father && !fatherNamed && rng.chance(0.4);

  if (origin === 'kinship') {
    const reason = pickW(reasonsFor('birth', (k) => ['young_plan', 'health', 'instability', 'incarcerated'].includes(k)), rng.next());
    giveMotherAge(reason); keepSiblings();
    const carersFrom = fam.grandparents.filter((g) => g.flags.side === 'maternal' && g.age <= 72);
    let carers = carersFrom;
    if (!carers.length) {
      // No grandparent able to: the birth mother's sister (or brother) and their partner.
      const auntGender = rng.chance(0.75) ? 'female' : 'male';
      const aunt = makeNpc({ role: 'parent', countryId: c.id, gender: auntGender, age: clamp(mother.age + rng.int(-6, 12), 24, 52), relationship: rng.int(65, 95), lastName: mother.lastName });
      carers = [aunt];
      aunt.flags.title = auntGender === 'female' ? 'Aunt' : 'Uncle';
      if (rng.chance(0.55)) {
        const partner = makeNpc({ role: 'parent', countryId: c.id, gender: auntGender === 'female' ? 'male' : 'female', age: aunt.age + rng.int(-4, 5), relationship: rng.int(55, 90), lastName: aunt.lastName });
        partner.flags.title = partner.gender === 'female' ? 'Aunt' : 'Uncle';
        carers.push(partner);
      }
      for (const a of carers) state.npcs[a.id] = a;
    }
    const legal = !adoptionLegal(c.id, year) ? 'kinship-care' : rng.chance(0.55) ? 'adoption' : 'guardianship';
    for (const g of carers) {
      g.role = 'parent';
      g.flags.title ??= g.gender === 'female' ? 'Grandmother' : 'Grandfather';
      g.flags.kinCarer = true;
      if (legal === 'adoption') g.flags.adoptiveParent = true; else g.flags.guardian = true;
      g.meters.relationship = Math.max(g.meters.relationship, rng.int(65, 92));
      g.flags.originsStance = 'supportive';
      g.wealth ??= rng.int(25, 70); g.income ??= 0; g.savings ??= 0; g.occupation ??= g.age >= 66 ? 'retired' : 'office worker';
    }
    // The birth mother is family, and known: she lives apart, and is in touch.
    mother.role = 'relative';
    giveKinFlags(mother, 'mother', p.id, { title: 'Birth mother' });
    mother.meters.relationship = rng.int(35, 70);
    if (reason === 'incarcerated') mother.flags.originSentence = { from: year - 1, until: year + rng.int(1, 5) };
    const household = [...carers];
    const known = [mother.id];
    for (const s of fam.siblings) {
      giveKinFlags(s, s.flags.twin ? 'sibling' : 'sibling', p.id);
      s.parentIds ??= [mother.id, ...(father ? [father.id] : [])];
      if (s.flags.twin || rng.chance(0.5)) household.push(s); else known.push(s.id);
    }
    for (const s of fam.siblings) if (!household.includes(s)) { s.role = 'sibling'; s.flags.livesApart = true; }
    if (father) { father.role = 'relative'; giveKinFlags(father, 'father', p.id, { title: 'Birth father', unidentified: fatherUnidentified }); }
    for (const g of fam.grandparents.filter((x) => !carers.includes(x))) { g.role = 'relative'; giveKinFlags(g, 'grandparent', p.id, { title: kinWord('grandparent', g.gender) }); }
    for (const g of carers) if (fam.grandparents.includes(g)) delete g.flags.birthKin; // they raise the child: their family, not "birth" family
    const pets = fam.pets.filter(() => carers.some((g) => fam.grandparents.includes(g)) && rng.chance(0.5));
    for (const pet of fam.pets) if (!pets.includes(pet)) delete state.npcs[pet.id];
    fam.pets.splice(0, fam.pets.length, ...pets);
    p.npcIds = [...household.map((n) => n.id), ...known, ...pets.map((x) => x.id)];
    p.flags.parentsStatus = carers.length > 1 ? 'together' : 'single';
    const rec = newRecord(o, { adopteeId: p.id, kind: 'kinship', legal, reason, birthParentIds: [mother.id, ...(father ? [father.id] : [])],
      birthFather: father ? (fatherUnidentified ? 'unidentified' : 'known') : 'unknown', fatherNamed: !!father && !fatherUnidentified,
      adoptiveParentIds: legal === 'adoption' ? carers.map((g) => g.id) : [], guardianIds: legal === 'adoption' ? [] : carers.map((g) => g.id),
      legalParentIds: legal === 'adoption' ? carers.map((g) => g.id) : [mother.id], carerIds: carers.map((g) => g.id),
      birthSiblingIds: fam.siblings.map((s) => s.id), placementYear: year, placementAge: 0, finalizedYear: legal === 'kinship-care' ? null : year + 1,
      status: 'final', birthCountryId: c.id, birthCity: p.city, jurisdiction: c.id, contact: 'open', accessSeed, telling: 'early',
      birthName: null, legalName: { first: p.firstName, last: p.lastName } });
    o.self = { recordId: rec.id, aware: false, awareAge: rng.int(3, 5), telling: 'early', facts: {}, people: {}, curiosity: 'none', done: {} };
    o.parentsKnow = { [rec.id]: { people: { [mother.id]: 'named', ...(father && !fatherUnidentified ? { [father.id]: 'named' } : {}) } } };
    const who = carers.map((g) => g.firstName).join(' and ');
    const what = carers[0].flags.title === 'Grandmother' || carers[0].flags.title === 'Grandfather' ? `your ${carers.length > 1 ? 'grandparents' : carers[0].flags.title.toLowerCase()}` : `your ${carers.map((g) => g.flags.title.toLowerCase()).join(' and ')}`;
    j(`You are raised by ${what}, ${who}. ${legal === 'adoption' ? 'They adopt you, and become your legal parents.' : legal === 'guardianship' ? 'A court makes them your legal guardians; your birth mother is still your legal parent.' : 'It is a family arrangement: there is no law of adoption here yet.'}`);
    j(`Your birth mother, ${mother.firstName}, is ${mother.age}. She lives apart from you and stays in touch.`);
    for (const pet of pets) j(`The family ${pet.species}, ${pet.firstName}, sniffs you suspiciously.`);
    return finish(state, rec, household, lines, journal, bioIds);
  }

  if (origin === 'birth') {
    const reason = pickW(reasonsFor('birth'), rng.next());
    giveMotherAge(reason); keepSiblings();
    const contact = pickW(contactShares('birth', year), contactSeed);
    const lastName = rng.pick(c.names.last);
    const adopt = generateFamily(c, lastName, { avoidNames: [p.firstName, mother.firstName, ...fam.siblings.map((s) => s.firstName)] });
    // A twin is placed with you; a twin generated for the adoptive family is not real.
    const fakeTwin = adopt.siblings.find((s) => s.flags.twin);
    if (fakeTwin) adopt.siblings = adopt.siblings.filter((s) => s !== fakeTwin);
    const parents = [adopt.mother, adopt.father].filter(Boolean);
    for (const par of parents) { par.age = Math.max(par.age, rng.int(27, 34)); par.flags.adoptiveParent = true; par.flags.originsStance = stance(par); }
    for (const s of adopt.siblings) { s.flags.adoptiveSibling = true; s.parentIds = parents.map((x) => x.id); }
    const twin = fam.twin;
    // The birth family: everyone made for the child's birth, living on without them.
    mother.role = 'relative'; giveKinFlags(mother, 'mother', p.id, { title: 'Birth mother' });
    if (reason === 'incarcerated') mother.flags.originSentence = { from: year - 1, until: year + rng.int(1, 6) };
    if (father) { father.role = 'relative'; giveKinFlags(father, 'father', p.id, { title: 'Birth father', unidentified: fatherUnidentified }); if (fam.status === 'together' && rng.chance(0.4)) { mother.flags.withFather = father.id; father.flags.withMother = mother.id; } }
    for (const s of fam.siblings) {
      s.parentIds ??= [mother.id, ...(father ? [father.id] : [])];
      if (s === twin) { giveKinFlags(s, 'sibling', p.id, { adoptedTogether: true }); continue; }
      s.role = 'relative'; giveKinFlags(s, 'sibling', p.id, { title: kinWord('sibling', s.gender) });
    }
    for (const g of fam.grandparents) { g.role = 'relative'; giveKinFlags(g, 'grandparent', p.id, { title: kinWord('grandparent', g.gender) }); }
    for (const pet of fam.pets) delete state.npcs[pet.id];
    fam.pets.splice(0, fam.pets.length, ...adopt.pets);
    const household = [...parents, ...adopt.siblings, ...(twin ? [twin] : []), ...adopt.grandparents];
    for (const n of [...household, ...adopt.pets]) state.npcs[n.id] = n;
    p.npcIds = [...household, ...adopt.pets].map((n) => n.id);
    p.flags.parentsStatus = adopt.status;
    // The child's name: the adoptive family's surname, and the first name they chose. A name from the birth mother, if she gave one, is in the file.
    const birthName = rng.chance(0.5) ? { first: rng.pick(c.names[p.gender] ?? c.names.female), last: mother.lastName } : null;
    const bornAs = p.lastName;
    p.lastName = surnameFor(c.id, lastName, p.gender);
    if (journal[0]) journal[0].text = journal[0].text.replace(` ${p.firstName} ${bornAs}.`, ` ${p.firstName} ${p.lastName}.`);
    if (twin) twin.lastName = surnameFor(c.id, lastName, twin.gender);
    const telling = contact === 'open' ? 'early' : pickW(tellingShares(year), rng.next());
    const rec = newRecord(o, { adopteeId: p.id, kind: 'birth', legal: 'adoption', reason, birthParentIds: [mother.id, ...(father ? [father.id] : [])],
      birthFather: father ? (fatherUnidentified ? 'unidentified' : 'known') : 'unknown', fatherNamed,
      adoptiveParentIds: parents.map((x) => x.id), legalParentIds: parents.map((x) => x.id),
      birthSiblingIds: fam.siblings.map((s) => s.id), placementYear: year, placementAge: 0, finalizedYear: year + 1, status: 'final',
      birthCountryId: c.id, birthCity: p.city, jurisdiction: c.id, contact, accessSeed, telling, birthName,
      legalName: { first: p.firstName, last: p.lastName }, agency: agencyName(c, p.city, rng.next()) });
    o.self = { recordId: rec.id, aware: false, awareAge: awareAgeFor(telling, rng.next()), telling, facts: {}, people: {}, curiosity: 'none', done: {} };
    o.parentsKnow = { [rec.id]: { people: { ...(contact === 'open' ? { [mother.id]: 'named' } : contact === 'mediated' ? { [mother.id]: 'first' } : {}) } } };
    if (contact === 'open' || contact === 'mediated') o.contacts[mother.id] = { status: contact === 'open' ? 'open' : 'mediated', since: year, history: [{ year, what: contact === 'open' ? 'The families agreed to letters, photos and visits.' : 'The agency agreed to pass letters and photos once a year.' }] };
    j(`You are adopted at birth by ${parents.map((x) => x.firstName).join(' and ')} ${p.lastName}${parents.length === 1 ? ', who adopts you on her own' : ''}.`, 'good');
    for (const par of parents) j(`Your ${par.gender === 'male' ? 'father' : 'mother'} is ${par.firstName}, ${an(par.occupation)}, age ${par.age}.`);
    if (twin) j(`You and your twin ${twin.gender === 'male' ? 'brother' : 'sister'}, ${twin.firstName}, are adopted together.`, 'good');
    for (const s of adopt.siblings) j(`You have an older ${s.gender === 'male' ? 'brother' : 'sister'}, ${s.firstName}, age ${s.age}.`);
    if (adopt.grandparents.length) j(`You have ${adopt.grandparents.length} living grandparent${adopt.grandparents.length > 1 ? 's' : ''}.`);
    const w = parents.reduce((s, n) => s + n.wealth, 0) / parents.length;
    j(w >= 70 ? 'Your family is wealthy.' : w >= 40 ? 'Your family is comfortably off.' : 'Your family does not have much money.');
    for (const pet of adopt.pets) j(`The family ${pet.species}, ${pet.firstName}, sniffs you suspiciously.`);
    return finish(state, rec, household, lines, journal, bioIds);
  }

  // Adopted during childhood: life begins with the birth family, and the adoption comes, when it comes, as a real event.
  const single = !father || fam.status === 'single';
  const reason = pickW(reasonsFor('childhood', (k) => k !== 'parent_died' || single), rng.next());
  giveMotherAge(reason); keepSiblings();
  const placementAge = rng.int(2, 7);
  for (const n of [mother, ...(father ? [father] : [])]) giveKinFlags(n, n === mother ? 'mother' : 'father', p.id);
  if (father) father.flags.unidentified = false;
  for (const s of fam.siblings) { giveKinFlags(s, 'sibling', p.id); s.parentIds ??= [mother.id, ...(father ? [father.id] : [])]; }
  for (const g of fam.grandparents) giveKinFlags(g, 'grandparent', p.id);
  const contact = pickW(contactShares('childhood', year + placementAge), contactSeed);
  const telling = 'early';
  const rec = newRecord(o, { adopteeId: p.id, kind: 'childhood', legal: 'adoption', reason, birthParentIds: [mother.id, ...(father ? [father.id] : [])],
    birthFather: father ? 'known' : 'unknown', fatherNamed: !!father,
    birthSiblingIds: fam.siblings.map((s) => s.id), placementYear: year + placementAge, placementAge, finalizedYear: year + placementAge + 1, status: 'planned',
    birthCountryId: c.id, birthCity: p.city, jurisdiction: c.id, contact, accessSeed, telling, birthName: { first: p.firstName, last: p.lastName },
    agency: agencyName(c, p.city, rng.next()),
    placementHistory: reason === 'after_foster' ? [{ kind: 'foster', fromAge: Math.max(1, placementAge - rng.int(1, 2)), toAge: placementAge }] : [] });
  o.self = { recordId: rec.id, aware: false, awareAge: placementAge, telling, facts: {}, people: {}, curiosity: 'none', done: {} };
  o.parentsKnow = { [rec.id]: { people: {} } };
  return { parents: [mother, father].filter(Boolean), journal: null, household: null };
}

/** The adoption, written into the opening journal and the archive; the birth family off the household list. */
function finish(state, rec, household, lines, journal, bioIds) {
  const p = state.player;
  // The opening lines about "your mother" and "your father" were about the birth family: they are replaced.
  const FAMILY_LINE = /^(Your (mother|father) is |Your parents are no longer together|Your father is not in the picture|Your family (is|does) |You are a twin|You have an older |You have \d+ living grandparent|Your (mother|father) came to |The family .+ sniffs you)/;
  const keep = journal.filter((e, i) => i === 0 || !FAMILY_LINE.test(e.text));
  for (const e of keep) e.text = e.text.replace(/^You have your (mother|father)'s (.+) nature\.$/, 'You have a $2 nature.');
  journal.splice(0, journal.length, keep[0], ...lines, ...keep.slice(1));
  state.npcs = state.npcs ?? {};
  for (const id of bioIds) if (state.npcs[id] && !p.npcIds.includes(id)) state.npcs[id].lastInteractionAge = -1;
  p.flags.livesWithParents = true;
  p.milestones.push({ age: 0, text: rec.kind === 'kinship' ? 'Went home with the family who would raise you.' : 'Adopted as a newborn.', kind: 'family' });
  return { parents: household.filter((n) => n.role === 'parent'), journal: lines.map((l) => l.text) };
}

const an = (job) => `${/^[aeiou]/i.test(job ?? '') ? 'an' : 'a'} ${job ?? 'worker'}`;
function stance(par) {
  const r = seeded(`${par.id}:stance`);
  return r < 0.6 ? 'supportive' : r < 0.85 ? 'uncertain' : 'uneasy';
}
function awareAgeFor(telling, r) {
  if (telling === 'early') return 3 + Math.floor(r * 3);
  if (telling === 'gradual') return 6 + Math.floor(r * 3);
  if (telling === 'limited') return 9 + Math.floor(r * 4);
  return 12 + Math.floor(r * 6); // later than expected
}
function agencyName(c, city, r) {
  const names = ['Family Services', 'Children\'s Home Society', 'Adoption Center', 'Family Connections', 'Child and Family Agency'];
  return `${city} ${names[Math.floor(r * names.length)]}`;
}

// ---------- The rules: what is open to the player now ----------

/** The records rules that apply to a request made this year. */
export function recordsAccess(rec, year = S().year) {
  return pickW(recordsAccessShares(rec.jurisdiction, year), rec.accessSeed ?? 0.5);
}
export const serviceOpen = (service, rec, year = S().year) => { const from = serviceFrom(service, rec.jurisdiction); return from != null && year >= from; };

/** Whether the player can search for themselves: an adult, who knows. Minors go through their parents. */
export function searchEligible(p = player()) {
  const self = S().origins?.self;
  if (!self?.aware) return { ok: false, why: 'Not something you know about yet' };
  if (p.age < RECORDS_AGE) return { ok: false, why: `From age ${RECORDS_AGE}, or with your parents` };
  if (p.legal?.incarceration) return { ok: false, why: 'Not from where you are' };
  return { ok: true, why: '' };
}

// ---------- The year: lives go on, results come in ----------

function mortality(n) {
  const h = n.meters?.health ?? 70;
  return Math.min(0.9, (0.0005 + Math.exp((n.age - 92) / 8.5) * 0.3) * (1.75 - h / 100 * 1.1));
}
const CAUSES_YOUNG = ['a car accident', 'a sudden heart condition', 'an illness that turned serious', 'a rare cancer'];
const CAUSES_MID = ['cancer', 'a heart attack', 'a stroke', 'complications after surgery'];
const CAUSES_OLD = ['heart failure', 'pneumonia', 'a stroke', 'old age'];
const causeFor = (n) => { const list = n.age < 40 ? CAUSES_YOUNG : n.age < 70 ? CAUSES_MID : CAUSES_OLD; return list[Math.floor(seeded(`${n.id}:cause`) * list.length)]; };

/** Birth relatives the player is not yet part of the life of: they age and live here (the others age in relationships.js). */
function liveOffscreen(rec) {
  const state = S();
  const p = state.player;
  const year = state.year;
  for (const n of birthKin(state)) {
    if (!n.alive || p.npcIds.includes(n.id)) continue;
    n.age += 1;
    if (rng.chance(mortality(n))) { n.alive = false; n.flags.diedYear = year; n.flags.cause = causeFor(n); continue; }
    if (n.age > 60) n.meters.health = clamp(n.meters.health - rng.int(0, 3));
    const sentence = n.flags.originSentence;
    if (sentence && !sentence.released && year >= sentence.until) sentence.released = year;
    // Their own families: a partner, and children of their own.
    if (['mother', 'father'].includes(n.flags.birthKin) && n.age >= 18 && n.age <= 44) {
      if (!n.flags.partnered && !n.flags.withMother && !n.flags.withFather && rng.chance(0.07)) n.flags.partnered = year;
      const kids = Object.values(state.npcs).filter((k) => k.parentIds?.includes(n.id) && k.flags.birthOf === p.id && k.age < p.age).length;
      const can = n.gender === 'female' ? n.age <= 43 : n.age <= 44 && (n.flags.partnered || n.flags.withMother);
      if (can && kids < 3 && (n.flags.partnered || n.flags.withMother || n.flags.withFather) && rng.chance(0.08) && !(sentence && !sentence.released)) {
        const other = npcOf(n.flags.withMother ?? n.flags.withFather);
        if (!other || n.gender === 'female') haveChild(n, other, rec);
      }
    }
    // Moves: a new city now and then, and a few go abroad.
    if (n.age >= 18 && rng.chance(0.03)) { const c = COUNTRIES[n.countryId ?? n.bornIn ?? p.countryId]; if (c?.cities?.length) n.flags.city = rng.pick(c.cities); }
    if (n.age >= 20 && n.age <= 60 && !n.flags.abroad && rng.chance(0.004)) {
      const away = ['us', 'uk', 'ca', 'au', 'de', 'es', 'mx', 'fr', 'ie', 'nz'].filter((id) => COUNTRIES[id] && id !== (n.bornIn ?? p.countryId));
      n.flags.abroad = rng.pick(away); n.flags.abroadYear = year;
    }
    // How they feel about being found changes slowly with the years: for birth parents, often toward it.
    const drift = (['mother', 'father'].includes(n.flags.birthKin) && n.age >= 40 ? 0.6 : 0) + (rng.next() - 0.5) * 3;
    n.flags.openness = Math.round(clamp((n.flags.openness ?? 50) + drift));
    // What they do on their own side: register to be found, or take a DNA test.
    if (n.age >= 18 && !n.flags.registered && serviceOpen('registry', rec) && n.flags.openness >= 60 && rng.chance(0.04)) n.flags.registered = year;
    if (n.age >= 18 && !n.flags.dnaTested && serviceOpen('dna', rec) && rng.chance((year >= 2014 ? 0.035 : 0.012) * (0.5 + n.flags.openness / 100))) n.flags.dnaTested = year;
  }
}

function haveChild(parent, other, rec) {
  const state = S();
  const p = state.player;
  const gender = rng.pick(['male', 'female']);
  const baby = makeNpc({ role: 'relative', countryId: parent.bornIn ?? p.countryId, lastName: parent.lastName, age: 0, gender, relationship: 30 });
  baby.parentIds = [parent.id, ...(other ? [other.id] : [])];
  const full = other && rec.birthParentIds.includes(other.id) && rec.birthParentIds.includes(parent.id);
  giveKinFlags(baby, full ? 'sibling' : 'half', p.id, { title: kinWord(full ? 'sibling' : 'half', gender) });
  state.npcs[baby.id] = baby;
  if (!rec.birthSiblingIds.includes(baby.id)) rec.birthSiblingIds.push(baby.id);
  return baby;
}

/** The yearly step (engine/yearProcessor.js). Runs once per world year, whatever the turn length. */
export function tickOrigins() {
  const state = S();
  const rec = myRecord(state);
  ensureOrigins(state);
  if (!rec) return;
  const p = state.player;
  const self = state.origins.self;
  liveOffscreen(rec);
  // Brothers and sisters born into the adoptive family later are adoptive siblings.
  for (const id of p.npcIds) { const n = npcOf(id); if (n?.role === 'sibling' && !n.flags.birthKin && !n.flags.adoptiveSibling && rec.kind !== 'kinship') n.flags.adoptiveSibling = true; }
  if (rec.status === 'planned' && p.age >= rec.placementAge) place(rec);
  // Knowing: when the parents tell the child (or the child is old enough to remember the move).
  if (!self.aware && rec.status === 'final' && p.age >= self.awareAge) becomeAware(rec);
  if (!self.aware) return;
  keepArrangement(rec);
  curiosityYear(rec);
  resolveRequests(rec);
  passiveMatches(rec);
  relativesReach(rec);
  contactYear(rec);
  // One revelation a year, and at most one quieter moment: never a pile of news in one turn.
  const told = deliverOne();
  if (!told) reflect(rec);
}

/** A childhood adoption, as it happens: a real placement, with the birth family still the people they are. */
function place(rec) {
  const state = S();
  const p = state.player;
  const c = COUNTRIES[p.countryId];
  const o = state.origins;
  const birth = rec.birthParentIds.map(npcOf).filter(Boolean);
  // The circumstance was set when the life began: it happens now.
  if (rec.reason === 'parent_died') {
    const carer = birth.find((n) => n.alive && n.flags.birthKin === 'mother') ?? birth.find((n) => n.alive);
    if (carer) { carer.alive = false; carer.flags.diedYear = state.year; carer.flags.cause = causeFor(carer); log(`Your ${carer.gender === 'male' ? 'father' : 'mother'} ${carer.firstName} died, at ${carer.age}, of ${carer.flags.cause}.`, 'system', 'bad'); }
  }
  if (rec.reason === 'health') for (const n of birth.filter((x) => x.flags.birthKin === 'mother')) n.meters.health = Math.min(n.meters.health, rng.int(25, 45));
  const lastName = rng.pick(c.names.last);
  const adopt = generateFamily(c, lastName, { avoidNames: [p.firstName, ...p.npcIds.map((id) => npcOf(id)?.firstName).filter(Boolean)] });
  adopt.siblings = adopt.siblings.filter((s) => !s.flags.twin);
  const parents = [adopt.mother, adopt.father].filter(Boolean);
  for (const par of parents) { par.age = Math.max(par.age, rng.int(28 + p.age, 36 + p.age) - p.age); par.flags.adoptiveParent = true; par.flags.originsStance = stance(par); }
  for (const s of adopt.siblings) { s.flags.adoptiveSibling = true; s.parentIds = parents.map((x) => x.id); s.age += 0; }
  // The birth family leaves the household. Brothers and sisters still small may be placed with you, or with another family.
  const together = [];
  for (const id of [...p.npcIds]) {
    const n = npcOf(id);
    if (!n || n.flags.birthOf !== p.id) continue;
    if (n.role === 'sibling' && n.age < 18 && n.alive && (n.flags.twin || seeded(`${n.id}:together`) < 0.5)) { together.push(n); n.flags.adoptedTogether = true; continue; }
    if (n.role === 'sibling' && n.age < 18) n.flags.adoptedElsewhere = state.year;
    n.role = 'relative';
    n.flags.title = kinWord(n.flags.birthKin, n.gender);
  }
  const keepOpen = rec.contact === 'open' ? birth.filter((n) => n.alive && n.flags.birthKin === 'mother') : [];
  // The family's animals stay with the birth family: they leave the child's list, not the world.
  for (const pet of p.npcIds.map(npcOf).filter((n) => n?.role === 'pet')) pet.flags.stayedWith = birth[0]?.id ?? null;
  for (const n of [...parents, ...adopt.siblings, ...adopt.grandparents, ...adopt.pets]) state.npcs[n.id] = n;
  p.npcIds = [...parents, ...adopt.siblings, ...together, ...adopt.grandparents, ...adopt.pets, ...keepOpen].map((n) => n.id);
  p.flags.parentsStatus = adopt.status;
  p.flags.livesWithParents = true;
  for (const t of together) t.lastName = surnameFor(c.id, lastName, t.gender);
  const was = p.lastName;
  if (seeded(`${p.id}:surname`) < 0.7) p.lastName = surnameFor(c.id, lastName, p.gender);
  rec.adoptiveParentIds = parents.map((x) => x.id);
  rec.legalParentIds = parents.map((x) => x.id);
  rec.status = 'final';
  rec.placementYear = state.year;
  rec.finalizedYear = state.year + 1;
  rec.legalName = { first: p.firstName, last: p.lastName };
  if (rec.contact === 'open' || rec.contact === 'mediated') for (const m of birth.filter((x) => x.alive && x.flags.birthKin === 'mother')) o.contacts[m.id] = { status: rec.contact, since: state.year, history: [{ year: state.year, what: rec.contact === 'open' ? 'The families agreed to letters, photos and visits.' : 'The agency agreed to pass letters and photos once a year.' }] };
  // A child of this age remembers the people they lived with: their names are theirs to keep.
  for (const n of birthKin(state)) {
    if (p.age >= 3 && (rec.birthParentIds.includes(n.id) || rec.birthSiblingIds.includes(n.id))) o.self.people[n.id] = 'named';
    else if (p.age >= 4 && n.flags.birthKin === 'grandparent') o.self.people[n.id] = 'first';
  }
  for (const m of keepOpen) { o.self.people[m.id] = 'contact'; m.meters.relationship = clamp(m.meters.relationship - 15); }
  o.parentsKnow[rec.id] = { people: Object.fromEntries(birth.map((n) => [n.id, 'named'])) };
  const names = parents.map((x) => x.firstName).join(' and ');
  log(`${rec.reason === 'after_foster' ? 'After some months with a foster family, you' : 'You'} go to live with a new family: ${names} ${parents[0].lastName}. The adoption is made final the next year.${p.lastName !== was ? ` Your surname becomes ${p.lastName}.` : ''}`, 'system', 'neutral');
  if (together.length) log(`${together.map((t) => t.firstName).join(' and ')} ${together.length > 1 ? 'come' : 'comes'} with you.`, 'system', 'good');
  milestone(`Adopted by ${names} ${parents[0].lastName}.`, 'family');
  recordEvent({ key: `origins:${p.id}:placement`, type: 'adoption', title: `${p.firstName} was adopted by ${names} ${parents[0].lastName}`, privacy: 'family', significance: 2 });
}

function becomeAware(rec) {
  const state = S();
  const self = state.origins.self;
  const p = state.player;
  self.aware = true;
  self.awareYear = state.year;
  self.awareAgeActual = p.age;
  learn('adopted', rec.kind === 'kinship' ? `You know that ${carersLabel(rec)} raise you, and why your birth mother lives apart.` : 'You know you were adopted.');
  // What the parents have shared from the start, in an open arrangement: who your birth mother is.
  const pk = state.origins.parentsKnow?.[rec.id]?.people ?? {};
  if (rec.contact === 'open' || rec.kind === 'kinship') for (const [id, lvl] of Object.entries(pk)) learnPerson(id, lvl);
  if (rec.kind === 'childhood') for (const n of birthKin(state)) if (rec.birthParentIds.includes(n.id) && !knowLevel(n.id)) learnPerson(n.id, 'named');
  // In an open adoption the birth mother is part of the child's life, and so on their list of people.
  for (const id of rec.birthParentIds) {
    const n = npcOf(id);
    if (n?.alive && S().origins.contacts[id]?.status === 'open' && !p.npcIds.includes(id)) { p.npcIds.push(id); learnPerson(id, 'contact'); n.meters.relationship = clamp(rng.int(35, 60)); }
  }
  const late = self.telling === 'late' && rec.kind !== 'childhood';
  const id = rec.kind === 'childhood' ? null : late ? 'org_learn_late' : 'org_story';
  if (id) storyBeat(id, { words: { parents: parentsLabel(rec) } }, { source: 'origins', must: true });
  state.origins.told[id ?? 'aware'] = state.year;
  if (late) self.curiosity = 'mild';
}

const carersLabel = (rec) => (rec.carerIds ?? rec.adoptiveParentIds).map(npcOf).filter(Boolean).map((n) => n.firstName).join(' and ') || 'your family';
const parentsLabel = (rec) => rec.adoptiveParentIds.concat(rec.guardianIds ?? []).map(npcOf).filter(Boolean).map((n) => n.firstName).join(' and ') || 'your parents';

/** Open and mediated arrangements are kept up quietly, and can lapse; nothing is said every year. */
function keepArrangement(rec) {
  const state = S();
  const year = state.year;
  for (const id of rec.birthParentIds) {
    const k = state.origins.contacts[id];
    const n = npcOf(id);
    if (!k || !['open', 'mediated'].includes(k.status)) continue;
    if (!n?.alive) { k.status = 'ended'; k.history.push({ year, what: 'Contact ended.' }); continue; }
    if ((n.flags.openness ?? 50) < 35 && rng.chance(0.15)) {
      k.status = 'lapsed'; k.history.push({ year, what: k.status === 'open' ? 'The visits stopped.' : 'The letters stopped coming.' });
      if (rec.contact !== 'lapsed') rec.contactWas = rec.contact;
      rec.contact = 'lapsed';
      continue;
    }
    k.history.push({ year, what: k.status === 'open' ? `A letter and photos from ${n.firstName}${seeded(`${id}:${year}:visit`) < 0.4 ? ', and a visit' : ''}.` : 'A letter, passed on by the agency.' });
    if (k.history.length > 40) k.history.splice(1, k.history.length - 40);
    if (k.status === 'open') learnPerson(id, 'contact');
  }
}

/** Curiosity comes and goes on its own, a little; the player's own choices move it more. No penalties attached. */
function curiosityYear(rec) {
  const self = S().origins.self;
  const p = player();
  if (p.age < 8 || ['searching', 'break'].includes(self.curiosity)) return;
  const r = seeded(`${p.id}:${S().year}:curious`);
  const next = { none: p.age >= 9 && r < 0.1 ? 'mild' : null, mild: p.age >= 13 && r < 0.08 ? 'exploring' : r > 0.96 ? 'content' : null,
    exploring: r < 0.05 ? 'content' : null, content: r < 0.03 ? 'mild' : null }[self.curiosity];
  if (next) { self.curiosity = next; self.curiosityYear = S().year; }
}

// ---------- Requests, matches and replies ----------

function addRequest(kind, extra = {}) {
  const s = S().origins.search;
  const id = `${kind}_${S().year}_${s.requests.length}`;
  const r = { id, kind, made: S().year, made_m: S().month ?? 0, due: S().year + 1, done: false, ...extra };
  s.requests.push(r);
  if (s.status === 'none' || s.status === 'paused') { s.status = 'active'; s.since ??= S().year; }
  return r;
}
const open = (kind) => S().origins.search.requests.find((r) => r.kind === kind && !r.done);
const lastOf = (kind) => S().origins.search.requests.filter((r) => r.kind === kind).at(-1) ?? null;

/** Queues a result to be told: at the turn of the year, one a year. */
function inbox(item) {
  const o = S().origins;
  if (o.inbox.some((x) => x.key === item.key) || o.told[item.key]) return false;
  o.inbox.push({ ...item, year: S().year });
  return true;
}

function resolveRequests(rec) {
  const state = S();
  const year = state.year;
  for (const r of state.origins.search.requests) {
    if (r.done || year < r.due) continue;
    r.done = year;
    if (r.kind === 'records') recordsAnswer(rec, r);
    if (r.kind === 'intermediary') intermediaryAnswer(rec, r);
    if (r.kind === 'contact') contactAnswer(rec, r);
    if (r.kind === 'agencyLetter') agencyLetterAnswer(rec, r);
  }
}

/** What the records office sends: as much as the law of that place and year allows. Never a name the file does not hold. */
function recordsAnswer(rec, r) {
  const access = recordsAccess(rec, r.made);
  r.access = access;
  const mother = npcOf(rec.birthParentIds.find((id) => npcOf(id)?.flags.birthKin === 'mother'));
  const father = npcOf(rec.birthParentIds.find((id) => npcOf(id)?.flags.birthKin === 'father'));
  const learnFacts = [['reason', REASONS[rec.reason]?.known], ['birthplace', `You were born in ${rec.birthCity}, ${COUNTRIES[rec.birthCountryId]?.name}.`]];
  if (mother) learnFacts.push(['mother:age', `Your birth mother was ${mother.age - (S().year - rec.placementYear) + (rec.placementAge ?? 0)} when you were born.`]);
  const people = {};
  let text;
  const withheld = mother && access === 'conditional' && (mother.flags.openness ?? 50) < 25;
  if (access === 'open' || (access === 'conditional' && !withheld)) {
    if (mother) people[mother.id] = 'named';
    if (father && rec.fatherNamed) people[father.id] = 'named';
    if (rec.birthName) learnFacts.push(['birthName', `The name on your original birth certificate is ${rec.birthName.first} ${rec.birthName.last}.`]);
    learnFacts.push(['father', father && rec.fatherNamed ? 'Your birth father is named on your original birth certificate.' : 'No father is named on your original birth certificate.']);
    text = `Your original birth certificate arrives. ${mother ? `Your birth mother's name is ${nm(mother)}.` : ''} ${father && rec.fatherNamed ? `Your birth father is named too: ${nm(father)}.` : 'The space for a father is blank.'} It gives names, not addresses.`;
  } else if (withheld) {
    learnFacts.push(['motherPrivacy', 'Your birth mother has filed a request that her name be kept private.']);
    text = 'The office sends what it can: the background in your file, and a note. Your birth mother has filed a request for her name to be withheld. The law here honors it. You can still register to be found, and she can change her mind.';
  } else {
    text = `The records are sealed in ${COUNTRIES[rec.jurisdiction] ? theCountry(COUNTRIES[rec.jurisdiction].name) : 'this jurisdiction'}. You are sent the non-identifying background in your file, and told that names can be shared only through an intermediary, a registry where both sides agree, or a court.`;
  }
  inbox({ key: `records:${r.id}`, scene: 'org_agency', words: { what: text }, learn: learnFacts.filter(([, t]) => t), people });
}

/** An intermediary looks for the birth mother (and the father, if the file names him) and asks them first. */
function intermediaryAnswer(rec, r) {
  const targets = rec.birthParentIds.map(npcOf).filter((n) => n && (n.flags.birthKin === 'mother' || rec.fatherNamed));
  const n = targets.find((x) => !S().origins.contacts[x.id] || ['none', 'time'].includes(S().origins.contacts[x.id].status)) ?? null;
  if (!n) { inbox({ key: `intermediary:${r.id}`, scene: 'org_agency', words: { what: 'The intermediary writes back: there is nobody in your file they can look for that you have not already found.' } }); return; }
  if (!n.alive) {
    inbox({ key: `intermediary:${r.id}`, scene: 'org_unanswered', cast: {}, words: { what: `The intermediary found your ${kinWord(n.flags.birthKin, n.gender).toLowerCase()}, ${nm(n)}, in the records: ${n.gender === 'male' ? 'he' : 'she'} died in ${n.flags.diedYear}, at ${n.age}.` },
      learn: [[`died:${n.id}`, `${nm(n)} died in ${n.flags.diedYear}.`]], people: { [n.id]: 'named' } });
    return;
  }
  // Found: the intermediary asks them, and passes on only what they agree to.
  r.target = n.id;
  answerFor(rec, n, 'intermediary', `intermediary:${r.id}`);
}

/** How someone answers a request for contact. Their own nature and circumstances decide; never the plot. */
export function willingness(n, channel, year = S().year) {
  let score = n.flags.openness ?? 50;
  if (channel === 'registry') score += 18; // they asked to be found
  if (channel === 'reach') score += 30;
  if (channel === 'intermediary') score += 4; // asked gently, in confidence
  if (channel === 'dna') score -= 4; // a message out of the blue
  if (n.flags.partnered && ['mother', 'father'].includes(n.flags.birthKin)) score -= 4; // a family that may not know
  score += ((n.meters?.generosity ?? 50) - 50) / 10;
  score += (seeded(`${n.id}:${year}:answer`) - 0.5) * 16;
  return Math.round(score);
}
function answerKind(n, channel, year) {
  if (n.flags.disputes && channel !== 'dna') return 'disputes';
  const w = willingness(n, channel, year);
  if (w >= 66) return 'welcome';
  if (w >= 52) return 'letters';
  if (w >= 40) return 'time';
  if (w >= 26) return 'declined';
  return 'noContact';
}

function answerFor(rec, n, channel, key) {
  const year = S().year;
  const o = S().origins;
  const k = (o.contacts[n.id] ??= { status: 'none', history: [] });
  const kind = answerKind(n, channel, year);
  const who = knowLevel(n.id) && knowLevel(n.id) !== 'exists' ? n.firstName : `your ${kinWord(n.flags.birthKin, n.gender).toLowerCase()}`;
  const sentence = n.flags.originSentence && !n.flags.originSentence.released;
  k.answered = { year, kind, channel };
  const people = { [n.id]: kind === 'welcome' || kind === 'letters' ? 'located' : 'named' };
  const facts = [];
  if (n.flags.abroad) facts.push([`abroad:${n.id}`, `${nm(n)} lives in ${COUNTRIES[n.flags.abroad]?.name ?? 'another country'}.`]);
  if (sentence && kind !== 'noContact') facts.push([`sentence:${n.id}`, `${nm(n)} is serving a prison sentence, which ends in ${n.flags.originSentence.until}.`]);
  if (kind === 'welcome') {
    k.status = sentence ? 'letters' : 'agreed'; k.history.push({ year, what: `${nm(n)} agreed to contact${sentence ? ', by letter for now' : ''}.` });
    inbox({ key, scene: sentence ? 'org_letter' : 'org_meet', cast: { them: n.id }, words: { how: channelWords(channel) }, learn: facts, people, contact: n.id });
  } else if (kind === 'letters') {
    k.status = 'letters'; k.history.push({ year, what: `${nm(n)} agreed to write, and to see how it goes.` });
    inbox({ key, scene: 'org_letter', cast: { them: n.id }, words: { how: channelWords(channel) }, learn: facts, people });
  } else if (kind === 'time') {
    k.status = 'time'; k.retry = year + 2; k.history.push({ year, what: `${nm(n)} asked for time.` });
    inbox({ key, scene: 'org_privacy', cast: { them: n.id }, words: { what: `${cap(who)} has been found, and is not ready. ${n.gender === 'male' ? 'He' : 'She'} asked for time, and did not say no.` }, learn: facts, people: { [n.id]: 'named' } });
  } else if (kind === 'declined') {
    k.status = 'declined'; k.retry = year + 5; k.history.push({ year, what: `${nm(n)} declined contact.` });
    inbox({ key, scene: 'org_privacy', cast: { them: n.id }, words: { what: `${cap(who)} has been found, and has declined contact for now. The message passed on is short and not unkind.` }, learn: facts, people: { [n.id]: 'named' } });
  } else if (kind === 'disputes') {
    k.status = 'disputed'; k.history.push({ year, what: `${nm(n)} disputed the information in the file.` });
    inbox({ key, scene: 'org_complicated', cast: { them: n.id }, words: { what: `${nm(n)} says the file is wrong: ${n.gender === 'male' ? 'he' : 'she'} does not believe ${n.gender === 'male' ? 'he is' : 'she is'} your ${kinWord(n.flags.birthKin, n.gender).toLowerCase()}.` }, people: { [n.id]: 'named' } });
  } else {
    k.status = 'noContact'; k.theirs = 'noContact'; k.history.push({ year, what: `${nm(n)} asked for no contact.` });
    inbox({ key, scene: 'org_privacy', cast: { them: n.id }, words: { what: `${cap(who)} has been found, and has asked for no contact. That request will be respected: you will not be put in touch.` }, learn: [], people: { [n.id]: knowLevel(n.id) === 'exists' || !knowLevel(n.id) ? 'exists' : knowLevel(n.id) } });
  }
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const channelWords = (ch) => ({ intermediary: 'through the intermediary', registry: 'through the registry', dna: 'through the DNA service\'s messages', agency: 'through the agency', direct: 'by a letter forwarded through a tracing service', open: 'as always', reach: 'in their own words' }[ch] ?? 'through the agency');

function contactAnswer(rec, r) {
  const n = npcOf(r.target);
  if (!n) return;
  if (!n.alive) { inbox({ key: `contact:${r.id}`, scene: 'org_unanswered', words: { what: `The letter comes back. ${nm(n)} died in ${n.flags.diedYear}.` }, learn: [[`died:${n.id}`, `${nm(n)} died in ${n.flags.diedYear}.`]] }); return; }
  answerFor(rec, n, r.channel, `contact:${r.id}`);
}

function agencyLetterAnswer(rec, r) {
  const mother = npcOf(rec.birthParentIds.find((id) => npcOf(id)?.flags.birthKin === 'mother'));
  if (!mother?.alive) { inbox({ key: `agency:${r.id}`, scene: 'org_agency', words: { what: 'The agency writes back: they have no current way to reach your birth mother, and your letter stays on file in case she ever asks.' } }); return; }
  // The letter goes on file; if she has kept in touch with the agency, it is passed on.
  if ((mother.flags.openness ?? 50) >= 55 || mother.flags.registered) answerFor(rec, mother, 'agency', `agency:${r.id}`);
  else inbox({ key: `agency:${r.id}`, scene: 'org_agency', words: { what: 'The agency writes back: your letter is on file. They have not heard from your birth mother in years, and will pass it on if she gets in touch.' } });
}

/** A registry match needs both people to have registered; a DNA match needs both to have tested. */
function passiveMatches(rec) {
  const state = S();
  const self = state.origins.self;
  const p = state.player;
  const regAt = self.registered;
  const dnaAt = self.dnaTested;
  for (const n of birthKin(state)) {
    if (!n.alive || p.npcIds.includes(n.id)) continue;
    const k = state.origins.contacts[n.id];
    if (k && !['none', 'time'].includes(k.status)) continue;
    if (regAt && n.flags.registered && n.age >= 18 && state.year > regAt) {
      if (inbox({ key: `registry:${n.id}`, scene: 'org_match', cast: { them: n.id }, words: { how: 'The registry writes: someone registered as your birth relative has asked to be found too.', rel: kinWord(n.flags.birthKin, n.gender).toLowerCase() },
        people: { [n.id]: 'named' }, learn: [[`match:${n.id}`, `A registry match: ${nm(n)}, your ${kinWord(n.flags.birthKin, n.gender).toLowerCase()}.`]], offer: { id: n.id, channel: 'registry' } })) break;
    }
    if (dnaAt && n.flags.dnaTested && n.age >= 18 && state.year > dnaAt) {
      const exact = ['mother', 'father'].includes(n.flags.birthKin);
      const guess = exact ? 'a parent' : n.flags.birthKin === 'sibling' ? 'a full sibling' : 'a half-sibling, grandparent, aunt or uncle';
      const fact = exact || n.flags.birthKin === 'sibling' ? `A DNA match, ${n.firstName}, is very likely ${guess}.` : `A DNA match, ${n.firstName}, is ${guess}: the test cannot tell which.`;
      if (inbox({ key: `dna:${n.id}`, scene: n.flags.birthKin === 'half' || n.flags.birthKin === 'sibling' ? 'org_sibling' : 'org_match', cast: { them: n.id },
        words: { how: `A new close DNA match: ${n.firstName}, shared DNA that suggests ${guess}.`, rel: guess }, people: { [n.id]: 'first' }, learn: [[`match:${n.id}`, fact]], offer: { id: n.id, channel: 'dna' } })) break;
    }
  }
}

/** Some birth relatives reach out themselves: rarely, and only when it is in them to do it. */
function relativesReach(rec) {
  const state = S();
  const p = state.player;
  if (p.age < RECORDS_AGE) return;
  const reachable = rec.contact === 'open' || rec.contact === 'mediated' || state.origins.self.registered || state.origins.self.dnaTested;
  for (const n of birthKin(state)) {
    if (!n.alive || n.age < 18 || p.npcIds.includes(n.id)) continue;
    const k = state.origins.contacts[n.id];
    if (k?.boundary === 'noContact' || (k && !['none', 'lapsed', 'time', 'mediated'].includes(k.status))) continue;
    if ((n.flags.openness ?? 0) < 72 || !(reachable || n.flags.registered)) continue;
    if (seeded(`${n.id}:${state.year}:reach`) < 0.05) {
      if (inbox({ key: `reach:${n.id}:${state.year}`, scene: 'org_reach', cast: { them: n.id }, words: { rel: kinWord(n.flags.birthKin, n.gender).toLowerCase() }, people: { [n.id]: 'named' } })) break;
    }
  }
}

/** Contact that has begun: letters lead somewhere or fade; relationships take time. */
function contactYear(rec) {
  const state = S();
  const p = state.player;
  for (const [id, k] of Object.entries(state.origins.contacts)) {
    const n = npcOf(id);
    if (!n) continue;
    if (!n.alive && !['ended', 'deceased'].includes(k.status) && ['contact', 'letters', 'agreed', 'faded'].includes(k.status)) {
      k.status = 'ended'; k.history.push({ year: state.year, what: `${n.firstName} died.` });
      continue;
    }
    if (k.status === 'contact' && p.npcIds.includes(id)) {
      k.years = (k.years ?? 0) + 1;
      if (n.meters.relationship < 22) k.low = (k.low ?? 0) + 1; else k.low = 0;
      if (k.low >= 2 && !k.boundary) { k.status = 'faded'; k.history.push({ year: state.year, what: 'The calls and messages slowed, and then stopped.' }); }
    }
    if (k.status === 'letters' && (k.letters ?? 0) >= 2 && !k.boundary) {
      const sentence = n.flags.originSentence && !n.flags.originSentence.released;
      const w = willingness(n, 'reach', state.year) + (k.letters ?? 0) * 3;
      if (!sentence && w >= 70) { k.status = 'agreed'; k.history.push({ year: state.year, what: `${n.firstName} asked to meet.` }); inbox({ key: `meet:${id}`, scene: 'org_meet', cast: { them: id }, words: { how: 'after a year of letters' }, contact: id }); }
    }
    if (k.status === 'time' && k.retry && state.year >= k.retry && !k.offeredAgain) {
      k.offeredAgain = true; // the player may ask again; nothing happens by itself
    }
  }
}

/** Tells one waiting result: the scene, and what it reveals becomes known now. @returns {boolean} */
function deliverOne() {
  const o = S().origins;
  if (!o.inbox.length) return false;
  const item = o.inbox.shift();
  o.told[item.key] = S().year;
  for (const [key, text] of item.learn ?? []) learn(key, text);
  for (const [id, lvl] of Object.entries(item.people ?? {})) learnPerson(id, lvl);
  if (item.offer) (o.offers ??= {})[item.offer.id] = { channel: item.offer.channel, year: S().year };
  storyBeat(item.scene, { ...(item.cast ?? {}), words: { ...(item.words ?? {}), key: item.key } }, { source: 'origins', must: true });
  return true;
}

/** The quieter moments, now and then, when they are true: never more than one a year, most of them once in a life. */
function reflect(rec) {
  const state = S();
  const p = state.player;
  const o = state.origins;
  const self = o.self;
  const once = (id) => !o.told[id];
  const r = seeded(`${p.id}:${state.year}:reflect`);
  const beat = (id, cast = {}, key = id) => { o.told[key] = state.year; storyBeat(id, cast, { source: 'origins', weight: 1 }); return true; };
  const yearsSince = (id) => state.year - (o.told[id] ?? -99);
  if (yearsSince('org_story') < 2 && yearsSince('org_learn_late') < 2) return false;
  if (p.age >= 7 && p.age <= 12 && once('org_question') && r < 0.3) return beat('org_question', { words: { parents: parentsLabel(rec) } });
  if (p.age >= 6 && p.age <= 14 && once('org_photo') && r < (rec.contact === 'open' || rec.contact === 'mediated' ? 0.35 : 0.15)) return beat('org_photo', { words: { photo: photoWords(rec) } });
  if (p.age >= 13 && p.age <= 17 && once('org_conversation') && r < 0.3) return beat('org_conversation', { words: { parents: parentsLabel(rec) } });
  if (p.age >= 18 && p.age <= 30 && once('org_should') && o.search.status === 'none' && r < (['mild', 'exploring'].includes(self.curiosity) ? 0.4 : 0.12)) return beat('org_should');
  // Years of searching with nothing found.
  if (o.search.status === 'active' && state.year - (o.search.since ?? state.year) >= 6 && once('org_unanswered') && !birthKin(state).some((n) => knows(n.id, 'named')) && r < 0.5) return beat('org_unanswered', { words: { what: 'Six years of letters, forms and waiting, and no answer that leads anywhere.' } }, 'org_unanswered');
  // Long contact: the relationship as it has become.
  for (const [id, k] of Object.entries(o.contacts)) {
    const n = npcOf(id);
    if (!n?.alive || k.status !== 'contact' || !p.npcIds.includes(id)) continue;
    if ((k.years ?? 0) >= 3 && once(`org_time/${id}`) && r < 0.5) return beat('org_time', { them: id }, `org_time/${id}`);
    // A real callback: a birth relative who has become close comes to a family celebration.
    if ([30, 40, 50, 60, 70].includes(p.age) && n.meters.relationship >= 55 && once(`org_past/${p.age}`)) return beat('org_past', { them: id, words: { age: String(p.age) } }, `org_past/${p.age}`);
  }
  for (const [id, k] of Object.entries(o.contacts)) if (k.status === 'faded' && once(`org_boundaries/${id}`) && npcOf(id)?.alive) return beat('org_boundaries', { them: id }, `org_boundaries/${id}`);
  // Sharing the story with the next generation.
  const kids = p.npcIds.map(npcOf).filter((n) => n?.alive && n.role === 'child' && n.age >= 8 && n.age <= 20);
  if (p.age >= 30 && kids.length && once('org_share') && r < 0.25) return beat('org_share', { them: kids[0].id });
  return false;
}
function photoWords(rec) {
  if (rec.contact === 'open' || rec.contact === 'mediated') return 'a photograph your birth mother sent: a young woman holding a baby, squinting into the sun';
  return 'a photograph from the agency: you, a few days old, wrapped in a hospital blanket';
}

// ---------- What the player can do ----------

const doneThisYear = (key) => S().origins.self?.done?.[key] === S().year;
const markDone = (key) => { S().origins.self.done[key] = S().year; };

/** The actions open to the player now: [{id, label, sub, why}] (why: shown greyed with the reason). */
export function originActions() {
  const state = S();
  const rec = myRecord(state);
  const self = state.origins?.self;
  if (!rec || !self) return [];
  const p = player();
  const a = [];
  const add = (id, label, sub, why = '') => a.push({ id, label, sub, why });
  if (!self.aware) return a;
  const once = (k, txt = 'Done this year') => (doneThisYear(k) ? txt : '');
  const age = (min) => (p.age < min ? `From age ${min}` : '');
  add('talkParents', 'Talk to My Parents', 'How they feel, and how you do', age(4) || once('talkParents'));
  add('askStory', 'Ask About My Adoption Story', 'The story of how you came home', age(4) || once('askStory'));
  add('photos', 'Look at Family Photos', 'Your baby pictures, and any from before', age(5) || once('photos'));
  add('askBirth', 'Ask About My Birth Family', 'What your parents know', age(6) || once('askBirth'));
  add('heritage', 'Learn About My Heritage', 'Where you come from', age(8) || once('heritage'));
  add('trusted', 'Speak to a Trusted Adult', 'Someone outside the family to talk to', age(6) || once('trusted'));
  const mother = npcOf(rec.birthParentIds.find((id) => npcOf(id)?.flags.birthKin === 'mother'));
  const arr = mother && state.origins.contacts[mother.id];
  if (p.age < RECORDS_AGE && arr && ['mediated'].includes(arr.status)) add('childLetter', 'Write to My Birth Mother', 'Through the agency, with your parents', age(7) || once('childLetter'));
  const elig = searchEligible(p);
  const s = state.origins.search;
  add('review', 'Review Available Information', 'What you hold, and what is on file', '');
  add('records', 'Request Eligible Records', recordsLine(rec), elig.why || (open('records') ? 'Waiting for an answer' : lastOf('records') && state.year - lastOf('records').made < 5 ? 'Asked recently: the law may change in time' : ''));
  add('agency', 'Contact the Adoption Agency', 'Leave a letter on file, or ask for news', elig.why || (rec.kind === 'kinship' ? 'There was no agency' : open('agencyLetter') ? 'Waiting for an answer' : once('agency')));
  add('registry', 'Join a Reunion Registry', 'A match only if they register too', elig.why || (!serviceOpen('registry', rec) ? 'Not available here yet' : self.registered ? `Registered in ${self.registered}` : ''));
  add('intermediary', 'Ask an Authorized Intermediary', 'They find and ask, confidentially', elig.why || (!serviceOpen('intermediary', rec) ? 'Not available here yet' : open('intermediary') ? 'Already looking' : lastOf('intermediary') && state.year - lastOf('intermediary').made < 3 ? 'Asked recently' : ''));
  add('public', 'Explore Public Records', 'For someone you can already name', elig.why || (namedKin().length ? once('public') : 'You need a name first'));
  add('dna', 'Take a DNA Test', 'Relatives who have tested, with how sure the match is', elig.why || (!serviceOpen('dna', rec) ? 'Not available yet' : self.dnaTested ? `Tested in ${self.dnaTested}` : ''));
  if (s.status === 'active') add('pause', 'Pause the Search', 'Take a break: nothing is lost', '');
  else if (s.status === 'paused') add('resume', 'Resume the Search', 'Pick it up again', '');
  if (self.curiosity !== 'content') add('content', 'I\'m Comfortable with What I Know', 'Nothing more to look for, for now', p.age < 10 ? 'From age 10' : '');
  return a;
}
function recordsLine(rec) {
  const access = recordsAccess(rec);
  return { open: 'Your original birth certificate, if the law allows', conditional: 'Open, unless a birth parent asked for privacy', restricted: 'Sealed here: background only' }[access];
}
const namedKin = () => birthKin().filter((n) => knows(n.id, 'named'));

/** Does one of the actions in originActions(). @returns {{ok, text, tone}} */
export function doOriginAction(id) {
  const state = S();
  const rec = myRecord(state);
  const self = state.origins?.self;
  if (!rec || !self) return result(false, 'There is nothing on file.', 'neutral');
  const act = originActions().find((x) => x.id === id);
  if (!act) return result(false, 'That is not something you can do.', 'neutral');
  if (act.why) return result(false, act.why, 'neutral');
  const p = player();
  const pk = state.origins.parentsKnow?.[rec.id]?.people ?? {};
  const parents = rec.adoptiveParentIds.concat(rec.guardianIds ?? []).map(npcOf).filter((n) => n?.alive);
  const bumpParents = (d) => { for (const n of parents) n.meters.relationship = clamp(n.meters.relationship + d); };
  const mother = npcOf(rec.birthParentIds.find((x) => npcOf(x)?.flags.birthKin === 'mother'));
  switch (id) {
    case 'talkParents': {
      markDone(id);
      const par = parents[0];
      if (!par) return result(true, 'There is nobody to ask now. You think about what they told you, years ago.', 'neutral');
      const st = par.flags.originsStance ?? 'supportive';
      bumpParents(st === 'uneasy' ? 1 : 3);
      const line = st === 'supportive' ? `${par.firstName} listens to all of it. "Whatever you want to know, we will find out together."`
        : st === 'uncertain' ? `${par.firstName} is quiet for a moment. "I worry I won't have the answers. But ask me anything."`
          : `${par.firstName} finds it hard, and says so. "I love you. Give me a little time with this." It is a start.`;
      return result(true, line, 'neutral');
    }
    case 'askStory': {
      markDone(id);
      learn('story', rec.kind === 'kinship' ? `${carersLabel(rec)} told you how you came to live with them.` : `${parentsLabel(rec)} told you about the day you came home.`);
      bumpParents(2);
      p.stats.mood = clamp(p.stats.mood + 2);
      const placed = rec.placementAge ? `when you were ${rec.placementAge}` : 'when you were a few days old';
      return result(true, rec.kind === 'kinship' ? `${carersLabel(rec)} tell you how you came to live with them, and how much they wanted you to.` : `${parentsLabel(rec)} tell you about the day you came home, ${placed}: the drive, the car seat they could not work out, how small you were.`, 'good');
    }
    case 'photos': {
      markDone(id);
      p.stats.mood = clamp(p.stats.mood + 2);
      if ((rec.contact === 'open' || rec.contact === 'mediated' || rec.contactWas) && mother) { learnPerson(mother.id, pk[mother.id] ?? 'first'); learn('photo', 'You have seen a photograph of your birth mother.'); return result(true, `Among the albums is a photograph of your birth mother${knows(mother.id, 'first') ? `, ${mother.firstName}` : ''}, holding you. You look for your own face in hers.`, 'good'); }
      return result(true, 'Baby pictures: you in a hospital blanket, you at your first birthday covered in cake. Your parents have a story for every one.', 'good');
    }
    case 'askBirth': {
      markDone(id);
      const limited = self.telling === 'limited' && p.age < 16;
      const told = [];
      if (p.age >= 9 && !limited && learn('reason', REASONS[rec.reason]?.known ?? 'Little is written down about why.')) told.push(REASONS[rec.reason]?.known);
      else if (p.age < 9) told.push(rec.kind === 'kinship' ? 'Your birth mother could not look after a baby then, and the family made sure you were looked after.' : 'Your birth mother could not take care of a baby when you were born, and wanted you to have a family.');
      if (mother && p.age >= 12 && !limited && learn('mother:age', `Your birth mother was ${mother.age - (state.year - rec.placementYear) + (rec.placementAge ?? 0)} when you were born.`)) told.push(`She was ${mother.age - (state.year - rec.placementYear) + (rec.placementAge ?? 0)} when you were born.`);
      for (const [nid, lvl] of Object.entries(pk)) {
        const n = npcOf(nid);
        const minAge = lvl === 'named' ? (rec.kind === 'kinship' ? 4 : 8) : 10;
        if (n && p.age >= minAge && !limited && learnPerson(nid, lvl)) told.push(`Your ${kinWord(n.flags.birthKin, n.gender).toLowerCase()}'s name is ${lvl === 'first' ? n.firstName : nm(n)}.`);
      }
      if (rec.birthFather === 'unknown' && p.age >= 12 && learn('father:unknown', 'Your parents were never told who your birth father is.')) told.push('They were never told who your birth father is.');
      if (!rec.birthParentIds.length) told.push('Your parents were told very little; the file was short.');
      bumpParents(parents[0]?.flags.originsStance === 'uneasy' ? 0 : 1);
      if (self.curiosity === 'none') self.curiosity = 'mild';
      return result(true, told.length ? `${parentsLabel(rec)} tell you what they know. ${told.join(' ')}` : `${parentsLabel(rec)} have told you everything they know already. Some of it is simply not known.`, 'neutral');
    }
    case 'heritage': {
      markDone(id);
      learn('birthplace', `You were born in ${rec.birthCity}, ${COUNTRIES[rec.birthCountryId]?.name}.`);
      return result(true, `You were born in ${rec.birthCity}, ${COUNTRIES[rec.birthCountryId]?.name}${rec.birthCountryId === p.countryId ? ', the same country your family lives in' : ''}. You look at it on a map for a long time.`, 'neutral');
    }
    case 'trusted': {
      markDone(id);
      p.stats.mood = clamp(p.stats.mood + 3);
      return result(true, 'You talk it through with someone you trust outside the family. They do not tell you what to feel. It helps.', 'good');
    }
    case 'childLetter': {
      markDone(id);
      const k = state.origins.contacts[mother.id];
      const reply = mother.alive && (mother.flags.openness ?? 50) + (seeded(`${mother.id}:${state.year}:reply`) - 0.5) * 30 >= 45;
      k.history.push({ year: state.year, what: reply ? 'You wrote through the agency, and a letter came back.' : 'You wrote through the agency. No reply came this year.' });
      p.stats.mood = clamp(p.stats.mood + (reply ? 3 : 0));
      return result(true, reply ? 'With your parents\' help you write a letter, and the agency passes it on. Months later, a reply comes back, careful and warm.' : 'With your parents\' help you write a letter, and the agency passes it on. No reply comes this year; the agency says that is not unusual.', reply ? 'good' : 'neutral');
    }
    case 'review': {
      const facts = Object.values(self.facts).map((f) => f.text);
      return result(true, facts.length ? `What you know: ${facts.join(' ')}` : 'You know you were adopted, and not much more yet.', 'neutral');
    }
    case 'records': {
      addRequest('records');
      self.curiosity = 'searching';
      return result(true, 'You fill in the form and send it, with a copy of your ID. The answer will come in the months ahead.', 'neutral');
    }
    case 'agency': {
      markDone(id);
      addRequest('agencyLetter');
      self.curiosity = 'searching';
      return result(true, `You write to ${rec.agency ?? 'the agency'}. They will reply when they can.`, 'neutral');
    }
    case 'registry': {
      self.registered = state.year;
      if (state.origins.search.status === 'none') { state.origins.search.status = 'active'; state.origins.search.since = state.year; }
      return result(true, 'You register. If a birth relative ever registers too, the registry will put you in touch. Nobody is contacted unless both of you have asked.', 'neutral');
    }
    case 'intermediary': {
      addRequest('intermediary', { due: state.year + 1 + Math.floor(seeded(`${p.id}:${state.year}:int`) * 2) });
      self.curiosity = 'searching';
      return result(true, 'An intermediary takes your case. They will look, and if they find someone, they will ask them first. It can take a year or more.', 'neutral');
    }
    case 'public': {
      markDone(id);
      const found = [];
      for (const n of namedKin()) {
        if (!n.alive && learn(`died:${n.id}`, `${nm(n)} died in ${n.flags.diedYear}.`)) found.push(`a death notice for ${nm(n)}, ${n.flags.diedYear}`);
        else if (n.alive && n.flags.abroad && learn(`abroad:${n.id}`, `${nm(n)} lives in ${COUNTRIES[n.flags.abroad]?.name}.`)) found.push(`that ${n.firstName} moved abroad`);
        else if (n.alive && learnPerson(n.id, 'located')) found.push(`${n.firstName} in a public listing for ${n.flags.city ?? COUNTRIES[n.bornIn ?? p.countryId]?.name}`);
      }
      return result(true, found.length ? `In the public records you find ${found.join('; ')}. No address: only enough to know where to send a letter through the proper channel.` : 'You search the public records. Nothing new turns up.', 'neutral');
    }
    case 'dna': {
      self.dnaTested = state.year;
      if (state.origins.search.status === 'none') { state.origins.search.status = 'active'; state.origins.search.since = state.year; }
      return result(true, 'You send off the kit. Matches will appear only with people who have tested too, and a match is not the same as consent to talk.', 'neutral');
    }
    case 'pause': state.origins.search.status = 'paused'; self.curiosity = 'break'; return result(true, 'You put the search away for a while. Anything already asked for will still be answered.', 'neutral');
    case 'resume': state.origins.search.status = 'active'; self.curiosity = 'searching'; return result(true, 'You take the folder out again.', 'neutral');
    case 'content': self.curiosity = 'content'; if (state.origins.search.status === 'active') state.origins.search.status = 'paused'; return result(true, 'You are content with what you know. You can always change your mind.', 'good');
    default: return result(false, 'Nothing happens.', 'neutral');
  }
}

/** What can be done about one known birth relative: [{id, label, why}]. */
export function relativeActions(npcId) {
  const state = S();
  const n = npcOf(npcId);
  const rec = myRecord(state);
  if (!n || !rec || n.flags.birthOf !== player().id || !knowLevel(npcId)) return [];
  const p = player();
  const k = state.origins.contacts[npcId];
  const offer = state.origins.offers?.[npcId];
  const out = [];
  const add = (id, label, why = '') => out.push({ id, label, why });
  const minor = p.age < RECORDS_AGE;
  if (!n.alive) return out;
  const st = k?.status ?? 'none';
  if (k?.boundary === 'break' || k?.boundary === 'noContact') { add('resume', k.boundary === 'noContact' ? 'Lift Your No-Contact Boundary' : 'End the Break'); return out; }
  if (['contact', 'letters', 'agreed', 'open', 'faded'].includes(st)) {
    if (st === 'letters') add('letter', 'Write a Letter', doneThisYear(`letter:${npcId}`) ? 'Written this year' : '');
    if (st === 'contact' || st === 'faded' || st === 'open') add('history', 'Ask About Family History', doneThisYear(`history:${npcId}`) ? 'Asked this year' : '');
    if (st === 'faded') add('reconnect', 'Try to Reconnect', doneThisYear(`reconnect:${npcId}`) ? 'Tried this year' : '');
    if (!minor) { add('break', 'Take a Break from Contact'); add('noContact', 'Set a No-Contact Boundary'); }
    return out;
  }
  if (st === 'noContact' || k?.theirs === 'noContact') { add('request', 'Request Contact', 'They asked for no contact'); return out; }
  if (minor) { add('request', 'Request Contact', `From age ${RECORDS_AGE}`); return out; }
  const channel = offer?.channel ?? (knows(npcId, 'located') ? 'direct' : null);
  const waiting = state.origins.search.requests.some((r) => r.kind === 'contact' && r.target === npcId && !r.done);
  const why = waiting ? 'Waiting for an answer' : !channel ? 'No safe way to reach them yet: try an intermediary or the registry' : (k?.retry && state.year < k.retry) ? `They asked for time: from ${k.retry}` : '';
  add('request', `Request Contact${channel ? ` (${channelWords(channel)})` : ''}`, why);
  return out;
}

export function doRelativeAction(npcId, id) {
  const state = S();
  const n = npcOf(npcId);
  const rec = myRecord(state);
  const act = relativeActions(npcId).find((x) => x.id === id);
  if (!n || !act) return result(false, 'That is not something you can do.', 'neutral');
  if (act.why) return result(false, act.why, 'neutral');
  const p = player();
  const k = (state.origins.contacts[npcId] ??= { status: 'none', history: [] });
  const year = state.year;
  switch (id) {
    case 'request': {
      const channel = state.origins.offers?.[npcId]?.channel ?? 'direct';
      addRequest('contact', { target: npcId, channel });
      k.status = k.status === 'time' || k.status === 'declined' ? k.status : 'requested';
      k.history.push({ year, what: `You asked for contact ${channelWords(channel)}.` });
      return result(true, `Your request goes ${channelWords(channel)}. ${knownName(n) === nm(n) ? n.firstName : 'They'} will decide for themselves; the answer comes when it comes.`, 'neutral');
    }
    case 'letter': {
      markDone(`letter:${npcId}`);
      k.letters = (k.letters ?? 0) + 1;
      k.history.push({ year, what: 'You wrote a letter.' });
      const back = seeded(`${npcId}:${year}:letter`) * 100 < (n.flags.openness ?? 50) + 20;
      if (back) k.history.push({ year, what: `${n.firstName} wrote back.` });
      return result(true, back ? `You write about your life, and ${n.firstName} writes back about theirs.` : `You write about your life. ${n.firstName} has not written back yet.`, 'neutral');
    }
    case 'history': {
      markDone(`history:${npcId}`);
      const facts = [];
      const mother = npcOf(rec.birthParentIds.find((x) => npcOf(x)?.flags.birthKin === 'mother'));
      if (['mother', 'father'].includes(n.flags.birthKin)) {
        if (learn('reason', REASONS[rec.reason]?.known)) facts.push(`${n.firstName} tells you, in their own words, why. It matches the file, mostly.`);
        for (const s of birthKin().filter((x) => rec.birthSiblingIds.includes(x.id) && x.parentIds?.includes(n.id))) if (learnPerson(s.id, 'named')) facts.push(`You have a ${kinWord(s.flags.birthKin, s.gender).toLowerCase()}: ${s.firstName}, ${s.age}.`);
      }
      if (['sibling', 'half'].includes(n.flags.birthKin) && mother && learnPerson(mother.id, 'named')) facts.push(`${n.firstName} tells you about their mother, ${mother.firstName}.`);
      for (const g of birthKin().filter((x) => x.flags.birthKin === 'grandparent')) if (learnPerson(g.id, 'first')) { facts.push(`There is a grandparent, ${g.firstName}${g.alive ? '' : ', no longer living'}.`); break; }
      n.meters.relationship = clamp(n.meters.relationship + 3);
      if (facts.length) learn('siblings', 'Your birth family has told you about its people.');
      return result(true, facts.length ? facts.join(' ') : `${n.firstName} tells you stories about the family: who looks like whom, who could never sing.`, 'neutral');
    }
    case 'reconnect': {
      markDone(`reconnect:${npcId}`);
      const ok = willingness(n, 'reach', year) >= 55;
      if (ok) { k.status = 'contact'; k.low = 0; n.meters.relationship = clamp(n.meters.relationship + 10); k.history.push({ year, what: 'You got back in touch.' }); }
      else k.history.push({ year, what: 'You reached out; it did not go anywhere this time.' });
      return result(true, ok ? `${n.firstName} is glad you called.` : `${n.firstName} replies politely, and briefly.`, 'neutral');
    }
    case 'break': k.boundary = 'break'; k.history.push({ year, what: 'You took a break from contact.' }); return result(true, `You tell ${n.firstName} you need a break. It is your boundary to set.`, 'neutral');
    case 'noContact': {
      k.boundary = 'noContact'; k.history.push({ year, what: 'You asked for no contact.' });
      if (p.npcIds.includes(npcId)) p.npcIds = p.npcIds.filter((x) => x !== npcId);
      return result(true, `You ask ${n.firstName} not to contact you. The request is respected.`, 'neutral');
    }
    case 'resume': {
      const was = k.boundary; delete k.boundary; k.history.push({ year, what: was === 'noContact' ? 'You lifted your no-contact boundary.' : 'You ended your break.' });
      return result(true, was === 'noContact' ? 'You lift the boundary. Whether they want contact now is up to them.' : `You let ${n.firstName} know you are ready to be in touch again.`, 'neutral');
    }
    default: return result(false, 'Nothing happens.', 'neutral');
  }
}

/** Contact begins: the relative joins the player's life, as themselves, with the closeness still to be built. */
function joinLife(n, base) {
  const p = player();
  const o = S().origins;
  if (!p.npcIds.includes(n.id)) p.npcIds.push(n.id);
  n.role = n.role === 'sibling' ? 'sibling' : 'relative';
  n.flags.title = kinWord(n.flags.birthKin, n.gender);
  n.meters.relationship = clamp(base);
  n.lastInteractionAge = p.age;
  learnPerson(n.id, 'met');
  const k = (o.contacts[n.id] ??= { status: 'none', history: [] });
  k.status = 'contact'; k.since ??= S().year; k.years = 0;
  k.history.push({ year: S().year, what: `You met ${n.firstName}.` });
  recordEvent({ key: `origins:${p.id}:met:${n.id}`, type: 'reunion', title: `${p.firstName} met ${n.firstName} ${n.lastName}, ${kinWord(n.flags.birthKin, n.gender).toLowerCase()}`, privacy: 'private', significance: 2 });
  milestone(`Met ${n.firstName}, your ${kinWord(n.flags.birthKin, n.gender).toLowerCase()}.`, 'family');
}

/** A choice in one of the origins scenes (data/events/stories/origins.js). @returns {string} */
export function originsChoice(value, cast = {}) {
  const state = S();
  const rec = myRecord(state);
  if (!rec) return '';
  const [scene, iStr] = String(value).split(':');
  const i = Number(iStr);
  const p = player();
  const self = state.origins.self;
  const n = cast.them ? npcOf(cast.them) : null;
  const k = n ? (state.origins.contacts[n.id] ??= { status: 'none', history: [] }) : null;
  const year = state.year;
  const parents = rec.adoptiveParentIds.concat(rec.guardianIds ?? []).map(npcOf).filter((x) => x?.alive);
  const bumpParents = (d) => { for (const x of parents) x.meters.relationship = clamp(x.meters.relationship + d); };
  switch (scene) {
    case 'org_story': case 'org_learn_late':
      if (i === 0) { self.curiosity = self.curiosity === 'none' ? 'mild' : self.curiosity; bumpParents(2); }
      if (i === 1) bumpParents(scene === 'org_learn_late' ? 0 : 2);
      if (i === 2 && scene === 'org_learn_late') bumpParents(-3);
      return '';
    case 'org_question': case 'org_conversation':
      if (i === 0) { bumpParents(2); if (self.curiosity === 'none') self.curiosity = 'mild'; return doOriginAction('askBirth').text; }
      if (i === 2) self.curiosity = self.curiosity === 'none' ? 'none' : self.curiosity;
      return '';
    case 'org_photo': if (i === 0) self.curiosity = self.curiosity === 'none' ? 'mild' : self.curiosity; return '';
    case 'org_should':
      if (i === 0) { self.curiosity = 'exploring'; state.origins.search.status = state.origins.search.status === 'none' ? 'active' : state.origins.search.status; state.origins.search.since ??= year; return 'My Origins (People) has what you can do next.'; }
      if (i === 2) self.curiosity = 'content';
      return '';
    case 'org_agency': case 'org_match': case 'org_sibling': case 'org_unanswered':
      if (scene === 'org_unanswered' && i === 1) { state.origins.search.status = 'paused'; self.curiosity = 'content'; }
      return '';
    case 'org_reach': {
      if (!n?.alive) return '';
      if (i === 0) { joinLife(n, 28 + Math.round((n.meters.charm ?? 50) / 6)); return `You agree to meet. ${n.firstName} is nervous on the phone, and so are you.`; }
      if (i === 1) { k.status = 'letters'; k.history.push({ year, what: 'You agreed to write first.' }); learnPerson(n.id, 'located'); return 'You suggest letters first. They agree at once.'; }
      if (i === 2) { k.status = 'declined'; k.declinedByYou = year; k.history.push({ year, what: 'You said not now.' }); return 'You say not now. They say they understand, and leave the door open; whether it stays open is up to them.'; }
      k.boundary = 'noContact'; k.history.push({ year, what: 'You asked for no contact.' }); return 'You ask not to be contacted. It is respected.';
    }
    case 'org_letter':
      if (!n?.alive) return '';
      if (i === 0) { k.letters = (k.letters ?? 0) + 1; k.history.push({ year, what: 'You wrote back.' }); return ''; }
      if (i === 1) { k.boundary = 'break'; k.history.push({ year, what: 'You put the letter away for now.' }); return ''; }
      return '';
    case 'org_privacy':
      if (i === 0) { if (self.curiosity === 'searching') self.curiosity = 'exploring'; return ''; }
      if (i === 1 && k && k.status !== 'noContact') { k.history.push({ year, what: 'You left a letter on file, in case they change their mind.' }); return 'Your letter is put on file. It will be there if they ever ask.'; }
      if (i === 2) { state.origins.search.status = 'paused'; self.curiosity = 'break'; }
      return '';
    case 'org_meet': {
      if (!n?.alive) return '';
      // How it goes depends on them as much as on you: warmth meets warmth, and some meetings are hard.
      const fit = (n.flags.openness ?? 50) / 2 + (n.meters.charm ?? 50) / 4 + (seeded(`${n.id}:${year}:meet`) - 0.5) * 30;
      const start = i === 0 ? 30 : i === 1 ? 22 : 15;
      if (fit < 28 && i !== 2) {
        joinLife(n, Math.max(8, start - 10));
        inbox({ key: `complicated:${n.id}`, scene: 'org_complicated', cast: { them: n.id }, words: { what: `The first meeting with ${n.firstName} does not go the way either of you hoped. There are long silences, and one thing said that should not have been.` } });
        return 'It is harder than you expected.';
      }
      joinLife(n, start + Math.round(fit / 3));
      bumpParents(0);
      return i === 0 ? 'Afterwards you sit in the car for a long time before you can drive.' : '';
    }
    case 'org_complicated':
      if (!n) return '';
      if (i === 0) { n.meters.relationship = clamp(n.meters.relationship + 4); if (k.status === 'disputed' && p.npcIds.includes(n.id) === false) { /* nothing more: their view stands */ } return ''; }
      if (i === 1) { k.boundary = 'break'; k.history.push({ year, what: 'You took a break after a hard meeting.' }); return ''; }
      return '';
    case 'org_time': if (n && i === 0) n.meters.relationship = clamp(n.meters.relationship + 6); return '';
    case 'org_past': if (n && i === 0) n.meters.relationship = clamp(n.meters.relationship + 4); return '';
    case 'org_boundaries':
      if (!n) return '';
      if (i === 0) return doRelativeAction(n.id, 'reconnect').text;
      if (i === 1) { k.boundary = 'break'; k.history.push({ year, what: 'You let it rest.' }); }
      return '';
    case 'org_share': if (n && i === 0) n.meters.relationship = clamp(n.meters.relationship + 3); return '';
    default: return '';
  }
}

// ---------- What the player sees ----------

/** Everything the My Origins screen shows, limited to what the character knows. */
export function originsView(state = S()) {
  const rec = myRecord(state);
  if (!rec) return null;
  const self = state.origins.self;
  const p = state.player;
  const parents = (rec.adoptiveParentIds.length ? rec.adoptiveParentIds : rec.carerIds ?? rec.guardianIds ?? []).map((id) => state.npcs[id]).filter(Boolean);
  const kindLine = { birth: 'Adopted at birth', childhood: `Adopted at ${rec.placementAge}`, kinship: rec.legal === 'adoption' ? 'Adopted by relatives' : rec.legal === 'guardianship' ? 'Raised by relatives, under legal guardianship' : 'Raised by relatives' }[rec.kind] ?? 'Adopted';
  const aware = self.aware;
  const story = [];
  if (aware) {
    story.push(['Origin', kindLine]);
    if (parents.length) story.push([rec.kind === 'kinship' ? 'Raised by' : 'Raised by', parents.map((n) => `${n.firstName} ${n.lastName}`).join(' and ')]);
    if (rec.status === 'final' && rec.finalizedYear && rec.kind !== 'kinship') story.push(['Adoption made final', String(rec.finalizedYear)]);
    story.push(['Legal parents', rec.legalParentIds.map((id) => state.npcs[id]).filter(Boolean).map((n) => n.firstName).join(' and ') || 'Not recorded']);
    story.push(['Contact arrangement', CONTACT[rec.contact]?.label ?? 'Not recorded']);
    if (self.facts.birthName && rec.birthName) story.push(['Name at birth', `${rec.birthName.first} ${rec.birthName.last}`]);
    else if (rec.kind === 'childhood' && rec.birthName && (rec.birthName.last !== p.lastName)) story.push(['Name before adoption', `${rec.birthName.first} ${rec.birthName.last}`]);
    story.push(['Legal name', `${p.firstName} ${p.lastName}`]);
  }
  const roleOf = (n) => (n.flags.kinCarer ? n.flags.title : n.role === 'parent' ? (n.gender === 'male' ? 'Father' : n.gender === 'female' ? 'Mother' : 'Parent') : n.flags.title ?? (n.gender === 'male' ? 'Brother' : n.gender === 'female' ? 'Sister' : 'Sibling'));
  const family = p.npcIds.map((id) => state.npcs[id]).filter((n) => n && (n.role === 'parent' || n.role === 'sibling') && !(n.flags.birthKin && n.flags.livesApart))
    .map((n) => ({ id: n.id, name: `${n.firstName} ${n.lastName}`, role: roleOf(n) + (n.flags.adoptedTogether ? ' (adopted with you)' : ''), alive: n.alive, age: n.age }));
  // The birth family, as far as the character knows it. Unknown people are shown as unknown; nobody unknown is listed by name.
  const birth = [];
  if (aware) {
    const mother = rec.birthParentIds.map((id) => state.npcs[id]).find((n) => n?.flags.birthKin === 'mother');
    const father = rec.birthParentIds.map((id) => state.npcs[id]).find((n) => n?.flags.birthKin === 'father');
    const row = (n, kin, gender) => {
      const lvl = n ? knowLevel(n.id, state) : null;
      const k = n ? state.origins.contacts[n.id] : null;
      const label = kinWord(kin, gender);
      if (!n || !lvl || lvl === 'exists') return { id: null, label, name: 'Unknown to you', note: '' };
      const name = lvl === 'first' ? n.firstName : `${n.firstName} ${n.lastName}`;
      const notes = [];
      if (state.origins.self.facts[`died:${n.id}`] || (lvl === 'met' && !n.alive)) notes.push(`Died ${n.flags.diedYear}`);
      if (state.origins.self.facts[`abroad:${n.id}`]) notes.push(`Lives in ${COUNTRIES[n.flags.abroad]?.name}`);
      if (state.origins.self.facts[`sentence:${n.id}`]) notes.push(n.flags.originSentence?.released ? 'Released from prison' : `In prison until ${n.flags.originSentence.until}`);
      notes.push(contactLabel(k));
      return { id: n.id, label, name, note: notes.filter(Boolean).join(' · ') };
    };
    birth.push(row(mother, 'mother', 'female'));
    if (rec.birthFather === 'unknown') birth.push({ id: null, label: 'Birth father', name: knowsFact('father:unknown', state) ? 'Not known to anyone in your file' : 'Unknown to you', note: '' });
    else birth.push(row(father, 'father', 'male'));
    for (const n of birthKin(state)) {
      if (rec.birthParentIds.includes(n.id) || !knowLevel(n.id, state) || knowLevel(n.id, state) === 'exists') continue;
      if (p.npcIds.includes(n.id) && n.flags.adoptedTogether) continue;
      birth.push(row(n, n.flags.birthKin, n.gender));
    }
  }
  const s = state.origins.search;
  const pending = s.requests.filter((r) => !r.done).map((r) => ({ records: 'Records request', intermediary: 'Intermediary search', contact: `Contact request${state.npcs[r.target] && knows(r.target, 'first', state) ? ` to ${state.npcs[r.target].firstName}` : ''}`, agencyLetter: 'Letter to the agency' }[r.kind] ?? r.kind));
  const search = aware ? {
    status: { none: 'Not searching', active: 'Searching', paused: 'Paused' }[s.status], curiosity: CURIOSITY[self.curiosity] ?? '',
    pending, registered: self.registered ?? null, dna: self.dnaTested ?? null,
    access: p.age >= RECORDS_AGE ? { open: 'Original birth records are open to adult adoptees here.', conditional: 'Original birth records are open here, unless a birth parent has asked for privacy.', restricted: 'Original birth records are sealed here; names come only through an intermediary, a registry or a court.' }[recordsAccess(rec)] : `At ${RECORDS_AGE} you can ask for records yourself. Until then, your parents can help.`,
  } : null;
  const messages = [];
  if (aware) for (const [id, k] of Object.entries(state.origins.contacts)) {
    const n = state.npcs[id];
    if (!n || !knowLevel(id, state)) continue;
    for (const h of k.history.slice(-6)) messages.push({ year: h.year, text: h.what.replace(nm(n), knownName(n)).replace(/^./, (c) => c.toUpperCase()) });
  }
  messages.sort((a, b) => b.year - a.year);
  const connections = aware ? Object.entries(state.origins.contacts).filter(([id, k]) => state.npcs[id] && ['contact', 'letters', 'agreed', 'open', 'faded', 'mediated'].includes(k.status) && knowLevel(id, state))
    .map(([id, k]) => ({ id, name: knownName(state.npcs[id]), label: kinWord(state.npcs[id].flags.birthKin, state.npcs[id].gender), status: contactLabel(k), boundary: k.boundary ?? null })) : [];
  const memories = aware ? state.origins.log.slice(-20).reverse().map((m) => ({ age: m.age, text: m.text })) : [];
  return { aware, kindLine, story, family, birth, search, messages: messages.slice(0, 12), connections, memories,
    known: aware ? Object.values(self.facts).map((f) => f.text) : [], why: aware ? '' : 'Not something you know about yet.' };
}
function contactLabel(k) {
  if (!k) return '';
  if (k.boundary === 'noContact') return 'You asked for no contact';
  if (k.boundary === 'break') return 'Taking a break';
  return { open: 'In touch (open adoption)', mediated: 'Letters through the agency', lapsed: 'Contact lapsed', requested: 'Contact requested', agreed: 'Agreed to meet', letters: 'Writing letters', contact: 'In contact', faded: 'Contact faded',
    time: 'Asked for time', declined: 'Declined contact', noContact: 'Asked for no contact', disputed: 'Disputes the records', ended: 'Contact ended', none: '' }[k.status] ?? '';
}

/** The label for a birth relative on the family tree and elsewhere. */
export const birthLabel = (n) => kinWord(n.flags.birthKin, n.gender);

/**
 * A legal guardian (not an adoptive parent) is not the child's legal parent: their estate goes to their own children
 * first (for a grandparent, the birth mother), not to the child they raised as if by a parent's right.
 * @returns {boolean} true if this estate was dealt with here
 */
export function guardianEstate(npc) {
  if (!npc?.flags?.guardian || npc.flags.adoptiveParent) return false;
  const rec = myRecord();
  const mother = rec && npcOf(rec.birthParentIds.find((id) => npcOf(id)?.flags.birthKin === 'mother'));
  const fromGrandparent = npc.flags.title === 'Grandmother' || npc.flags.title === 'Grandfather';
  const amount = Math.max(0, npc.life?.savings ?? npc.savings ?? 0);
  if (fromGrandparent && mother?.alive && amount) { mother.savings = (mother.savings ?? 0) + amount; }
  if (npc.life) npc.life.savings = 0;
  npc.savings = 0;
  if (amount) log(`${npc.firstName}'s estate goes to ${fromGrandparent && mother?.alive ? `${npc.gender === 'male' ? 'his' : 'her'} daughter, your birth mother` : `${npc.gender === 'male' ? 'his' : 'her'} own family`}: a guardian is not a legal parent.`, 'system', 'neutral');
  return true;
}

// ---------- The other side: when the player adopts ----------

/** A child the player adopts gets the same kind of record: their birth parents are not confused with their new ones. */
export function recordPlayerAdoption(child, byIds) {
  const state = S();
  const o = ensureOrigins(state);
  const r = seeded(`${child.id}:contact`);
  const contact = pickW(contactShares('birth', state.year), r);
  const rec = newRecord(o, { adopteeId: child.id, kind: 'by-player', legal: 'adoption', reason: 'unknown', adoptiveParentIds: [...byIds], legalParentIds: [...byIds],
    birthFather: 'unrecorded', birthParents: 'not on record', placementYear: state.year, placementAge: child.age, finalizedYear: state.year + 1, status: 'final',
    birthCountryId: child.bornIn ?? state.player.countryId, jurisdiction: state.player.countryId, contact, accessSeed: seeded(`${child.id}:access`) });
  child.flags.adoptionRecord = rec.id;
  return rec;
}

// ---------- Older saves ----------

/**
 * Brings an older save up to date, once. The player's adopted children get a record of their adoption, with the
 * adoptive parents they already have and no birth parents made up for them. Nothing else is invented: a life saved
 * before adoption origins existed is not made adopted. Safe to run on every load.
 */
export function migrateOrigins(state) {
  const had = state.origins?.v;
  const o = ensureOrigins(state);
  for (const n of Object.values(state.npcs ?? {})) {
    if (!n.adopted || n.role !== 'child' || n.flags?.adoptionRecord) continue;
    if (!state.player?.npcIds?.includes(n.id)) continue;
    const by = n.adoptionInfo?.by?.length ? n.adoptionInfo.by : [state.player.id];
    const year = Number(String(n.adoptionInfo?.date ?? '').slice(0, 4)) || null;
    const rec = newRecord(o, { adopteeId: n.id, kind: 'by-player', legal: 'adoption', reason: 'unknown', adoptiveParentIds: by, legalParentIds: by,
      birthFather: 'unrecorded', birthParents: 'not on record', placementYear: year, placementAge: n.adoptionInfo?.ageThen ?? null, finalizedYear: year,
      status: 'final', birthCountryId: n.bornIn ?? null, jurisdiction: n.adoptionInfo?.countryId ?? state.player.countryId, contact: 'unknown', legacy: true });
    n.flags.adoptionRecord = rec.id;
  }
  o.v = Math.max(had ?? 0, VERSION);
  return state;
}
