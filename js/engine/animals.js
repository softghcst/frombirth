// The animals of the family: one record per animal, kept for good.
//
// state.animals = { v, byId, events, seq, seen, tickYear }
//
// An animal is not a person and is not kept as one. Its record here holds who
// it is (species, breed, looks, temperament), who owned it, who cared for it,
// where it lived, what it learned, its health, and how it died. Those are
// separate histories: the owner, the main caregiver and the household can all
// be different, and each can change without the others.
//
// While an animal is in the player's life there is also an entry for it among
// the people they know (state.npcs, role 'pet', THE SAME ID). That entry is
// only the player's side of things: their bond with the animal and the things
// they can do together. When the animal dies, is rehomed, or the story passes
// to the next generation, that entry may go; this record never does.
//
// state.animals.events is the family's record of what happened: one entry per
// moment, never repeated, each naming the animal and the people who were
// there. The lines in the life story (state.journal) that tell the same moment
// carry the event's id, and so do the memories people have of it.
//
// People are named as { id, name }. The name is kept because people leave the
// player's life and ids change hands between generations (see handOver).
import { store } from '../state.js';
import { rng } from '../rng.js';
import { clamp, cap, localMoney, theCountry } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { speciesOf, BREEDS, breedOf, TEMPERAMENT, EVENT_TYPES } from '../data/animals.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

// ---------- A private run of luck for each animal ----------
// Looks and temperament come from the animal's own id, so they are the same
// on every load and drawing them never disturbs the game's dice.

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seeded(key) {
  let s = hash(key) || 1;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    weighted(items, w) { let roll = next() * items.reduce((t, i) => t + w(i), 0); for (const i of items) { roll -= w(i); if (roll < 0) return i; } return items[items.length - 1]; },
  };
}

// ---------- The record ----------

export function ensure(state = store.state) {
  state.animals ??= { v: 1, byId: {}, events: [], seq: 0, seen: null, tickYear: null };
  return state.animals;
}
export const animalById = (id, state = store.state) => ensure(state).byId[id] ?? null;
export const allAnimals = (state = store.state) => Object.values(ensure(state).byId);
const handle = (state, a) => state.npcs[a.id] ?? null;

const fullName = (x) => `${x.firstName} ${x.lastName}`.trim();
/** A person, named so that the record still reads when they are gone. */
function ref(state, id) {
  if (!id) return null;
  if (id === state.player.id) return { id, name: fullName(state.player) };
  const n = state.npcs[id];
  return n ? { id, name: fullName(n) } : null;
}
const isPlayer = (state, id) => id === state.player.id;
const human = (state, id) => (isPlayer(state, id) ? state.player : state.npcs[id] ?? null);
const aliveHuman = (state, id) => { const h = human(state, id); return !!h && h.alive !== false; };

const KIN = { parent: ['father', 'mother', 'parent'], sibling: ['brother', 'sister', 'sibling'], spouse: ['husband', 'wife', 'spouse'], partner: ['partner', 'partner', 'partner'],
  child: ['son', 'daughter', 'child'], grandparent: ['grandfather', 'grandmother', 'grandparent'], grandchild: ['grandson', 'granddaughter', 'grandchild'],
  greatgrandchild: ['great-grandson', 'great-granddaughter', 'great-grandchild'], niece: ['nephew', 'niece', 'sibling\'s child'], relative: ['relative', 'relative', 'relative'], inlaw: ['in-law', 'in-law', 'in-law'], ex: ['ex', 'ex', 'ex'], friend: ['friend', 'friend', 'friend'] };
/** How someone is related to the player, in a word: "mother", "son". Null for people outside the family's record. */
export function kinWord(state, id) {
  const n = state.npcs[id];
  const words = n && KIN[n.role];
  return words ? words[n.gender === 'male' ? 0 : n.gender === 'female' ? 1 : 2] : null;
}
/** "you", "your mother Ana", or a full name for someone no longer in the player's life. */
export function whoPhrase(state, r) {
  if (!r) return 'nobody on record';
  if (isPlayer(state, r.id)) return 'you';
  const kin = kinWord(state, r.id);
  return kin ? `your ${kin} ${state.npcs[r.id].firstName}` : r.name;
}

// ---------- Where the player lives ----------

/** The household the player lives in now. */
export function playerHome(state = store.state) {
  const p = state.player;
  const home = p.homeId ? p.assets.find((a) => a.id === p.homeId) : null;
  const withParents = !home && !!p.flags.livesWithParents;
  return {
    hh: withParents ? 'parents' : 'player',
    key: home ? `prop:${home.id}` : withParents ? 'family-home' : 'rented',
    label: home ? home.name : withParents ? `The ${p.lastName} family home` : 'A rented home',
    city: p.city, countryId: p.countryId,
  };
}
const openOf = (list) => list.find((x) => x.to == null && !x.closed) ?? null;
export const ownerOf = (a) => openOf(a.ownerships)?.who ?? null;
export const primaryOf = (a) => a.care.find((c) => c.to == null && c.role === 'primary')?.who ?? null;
export const helpersOf = (a) => a.care.filter((c) => c.to == null && c.role === 'helper').map((c) => c.who);
export const homeOf = (a) => openOf(a.homes);
/** Whether the animal lives under the same roof as the player. */
export function livesWithPlayer(id, state = store.state) {
  const a = animalById(id, state);
  const h = a && a.status === 'living' ? homeOf(a) : null;
  return !!h && (h.hh === 'player' || (h.hh === 'parents' && !!state.player.flags.livesWithParents && !state.player.homeId));
}
export const householdAnimals = (state = store.state) => allAnimals(state).filter((a) => livesWithPlayer(a.id, state));

function closeOpen(list, year, why) { for (const x of list) if (x.to == null) { x.to = year; if (why) x.ended = why; } }
function setOwner(state, a, who, how) {
  if (ownerOf(a)?.id === who.id && who.id) return;
  closeOpen(a.ownerships, state.year, how);
  a.ownerships.push({ who, from: state.year, to: null, how });
}
function setPrimary(state, a, who, why) {
  if (primaryOf(a)?.id === who.id && who.id) return;
  for (const c of a.care) if (c.to == null && (c.role === 'primary' || c.who.id === who.id)) { c.to = state.year; c.ended = why; }
  a.care.push({ who, role: 'primary', from: state.year, to: null, why });
}
function addHelper(state, a, who) {
  if (a.care.some((c) => c.to == null && c.who.id === who.id)) return;
  a.care.push({ who, role: 'helper', from: state.year, to: null });
}
function setHome(state, a, home) {
  const now = homeOf(a);
  if (now && now.hh === home.hh && now.key === home.key && now.city === home.city && now.countryId === home.countryId) return false;
  closeOpen(a.homes, state.year);
  a.homes.push({ ...home, from: state.year, to: null });
  return true;
}
const homeWith = (state, r) => {
  const n = state.npcs[r.id];
  const abroad = typeof n?.flags.abroad === 'string' && COUNTRIES[n.flags.abroad] ? n.flags.abroad : null;
  return { hh: r.id, key: `with:${r.id}`, label: `${r.name.split(' ')[0]}'s home`, city: abroad ? null : state.player.city, countryId: abroad ?? state.player.countryId };
};

/** How close an animal and a person are, 0–100. Each pair has its own. */
function setBond(a, r, value) { if (r?.id) a.bonds[r.id] = { name: r.name, value: Math.round(clamp(value)) }; }
function firstBond(a, r, lean = 0) {
  if (!r?.id || a.bonds[r.id]) return;
  const roll = seeded(`${a.id}:${r.id}`);
  setBond(a, r, 40 + roll.int(0, 40) + lean + ((a.temperament.affection ?? 50) - 50) / 5);
}
export const bondOf = (a, id) => a.bonds[id]?.value ?? null;

// ---------- Who an animal is ----------

function drawLooks(npc, sp, roll, origin) {
  const breeds = BREEDS[sp.id] ?? [];
  // An animal found or taken in from a shelter is usually of no particular breed, and nobody can say for certain.
  const breed = breeds.length ? roll.weighted(breeds, (b) => b.weight * (b.mix && origin !== 'family' ? 3 : 1)) : null;
  const coats = breed?.coats ?? sp.coats;
  const coat = roll.pick(coats);
  const pattern = roll.pick(breed?.patterns ?? sp.patterns);
  const second = pattern === 'solid' ? null : roll.pick(['white', 'white', 'cream', ...sp.coats.filter((c) => c !== coat)]);
  const mark = roll.chance(0.35) ? roll.pick(['a white tip to the tail', 'one ear that never stands up', 'a notch in the left ear', 'a pale patch over one eye', 'odd-coloured toes', 'a kink in the tail']) : null;
  return {
    breedId: breed?.id ?? null,
    appearance: { coat, second, pattern, eyes: roll.pick(breed?.eyes ?? sp.eyes), size: breed?.size ?? 'small', ears: breed?.ears ?? 'up', length: breed?.length ?? 'short',
      mark: sp.id === 'parrot' || sp.id === 'hamster' ? null : mark },
  };
}
function drawTemperament(sp, roll) {
  const t = {};
  for (const d of sp.temperament) t[d] = Math.round(clamp(50 + (roll.next() + roll.next() + roll.next() - 1.5) / 1.5 * 42, 4, 96));
  return t;
}

/** The living parents of the player, the one closest to the animal first. */
const parentsOf = (state) => state.player.npcIds.map((id) => state.npcs[id]).filter((n) => n?.alive && n.role === 'parent')
  .sort((x, y) => Number(y.gender === 'female') - Number(x.gender === 'female'));
const livingBy = (state, roles) => state.player.npcIds.map((id) => state.npcs[id]).filter((n) => n?.alive && roles.includes(n.role));

/**
 * Puts an animal on the family's record. Safe to call twice: the second call changes nothing.
 * @param {object} npc    the animal's entry among the people the player knows
 * @param {{origin?:'family'|'shelter'|'found'|'unknown', fee?:number, storyEntry?:object, pending?:boolean, state?:object}} [o]
 *   storyEntry  the line in the life story that tells it, if it is already written
 *   pending     the scene engine is about to write that line (see claimStory)
 *   origin  'family'  it was already in the household when the player was born
 *           'shelter' adopted, for a fee        'found' taken in
 *           'unknown' an animal from a life saved before this record existed: nothing is made up about its past
 */
export function register(npc, o = {}) {
  const state = o.state ?? store.state;
  const A = ensure(state);
  if (A.byId[npc.id]) return A.byId[npc.id];
  const p = state.player;
  const origin = o.origin ?? 'unknown';
  const sp = speciesOf(npc.species);
  const roll = seeded(npc.id);
  const looks = drawLooks(npc, sp, roll, origin);
  const alive = npc.alive !== false;
  const known = origin !== 'unknown';
  const a = {
    id: npc.id, name: npc.firstName, speciesId: sp.id === 'other' ? (npc.species ?? 'other') : sp.id,
    breedId: looks.breedId,
    // A breed is on record only where someone would know it. Otherwise it is a guess, and shown as one.
    breedKnown: !!looks.breedId && (origin === 'family' || !!breedOf(sp.id, looks.breedId)?.mix),
    sex: sp.sexes === 'both' ? roll.pick(['female', 'male']) : null,
    born: alive ? state.year - npc.age : null, bornKnown: origin === 'family',
    died: null, ageAtDeath: alive ? null : npc.age, status: alive ? 'living' : 'deceased',
    lifespan: npc.lifespan ?? sp.lifespan[1],
    appearance: looks.appearance, temperament: drawTemperament(sp, roll),
    origin: { how: origin, year: known ? state.year : null, city: known ? p.city : null, countryId: known ? p.countryId : null,
      ...(o.fee ? { fee: o.fee, currency: COUNTRIES[p.countryId].currency.code } : {}) },
    ownerships: [], care: [], homes: [], bonds: {}, training: {}, health: [],
    inCircle: true, memorial: null, firstSeenYear: state.year, firstSeenGen: p.generation ?? 1,
  };
  A.byId[a.id] = a;

  // Who it belongs to, and who looks after it. A child does not own the family dog.
  const parents = parentsOf(state);
  const grown = p.age >= 18;
  const mine = origin !== 'family' && (grown || !parents.length);
  const me = ref(state, p.id);
  const owner = mine ? me : ref(state, parents[0].id);
  const from = known ? state.year : null;
  const how = { family: 'already theirs', shelter: 'adopted', found: 'taken in', unknown: 'unknown' }[origin];
  // The family's animal lives in the family home, whoever in it the player is.
  const home = mine ? playerHome(state) : { ...playerHome(state), hh: 'parents', key: 'family-home', label: `The ${p.lastName} family home` };
  // An animal that had already died when the record began: what is known is how old it was, not when.
  const span = alive ? { from, to: null } : { from: null, to: null, closed: true };
  a.ownerships.push({ who: owner, ...span, how });
  a.care.push({ who: owner, role: 'primary', ...span });
  if (!mine) {
    for (const par of parents.slice(1)) a.care.push({ who: ref(state, par.id), role: 'helper', ...span });
    if (p.age >= 8) a.care.push({ who: me, role: 'helper', ...span });
  } else {
    for (const n of livingBy(state, ['spouse'])) a.care.push({ who: ref(state, n.id), role: 'helper', ...span });
  }
  a.homes.push({ ...home, ...span });

  // Everyone under the same roof has their own relationship with it.
  setBond(a, me, npc.meters.relationship);
  for (const n of livingBy(state, mine && !p.flags.livesWithParents ? ['spouse', 'child'] : ['parent', 'sibling'])) {
    if (n.role === 'child' && n.age >= 18) continue;
    firstBond(a, ref(state, n.id), n.id === owner.id ? 12 : 0);
  }

  if (!known || !alive) return a;
  const kind = `${sp.name}`;
  const where = `${p.city}, ${theCountry(COUNTRIES[p.countryId].name)}`;
  const kinOwner = whoPhrase(state, owner);
  if (origin === 'family') {
    record(state, { type: 'met', animalId: a.id, people: [owner, me], sig: 2, storyEntry: o.storyEntry,
      text: `${a.name} the ${kind} was already part of the ${p.lastName} household when ${p.firstName} was born.`,
      memories: [memory(me, `You cannot remember a time before ${a.name}.`, `${p.firstName} could not remember a time before ${a.name}.`)] });
  } else if (origin === 'shelter') {
    record(state, { type: 'adopted', animalId: a.id, people: [owner, ...helpersOf(a)], sig: 3, storyEntry: o.storyEntry,
      text: `${owner.name} adopted ${a.name}, a ${describeAge(a, state)} ${kind}, from a shelter in ${where}.`,
      memories: [memory(me, `The day ${a.name} came home from the shelter.`, `${p.firstName} brought ${a.name} home from the shelter.`), ...firstImpressions(state, a, me.id)] });
  } else {
    record(state, { type: 'joined', animalId: a.id, people: [owner, ...helpersOf(a)], sig: 3, storyEntry: o.storyEntry, pending: !!o.pending,
      text: mine ? `${owner.name} took in ${a.name}, a ${kind}, in ${where}.` : `${a.name}, a ${kind}, joined the ${p.lastName} household in ${where}. ${cap(kinOwner.replace(/^your /, `${p.firstName}'s `))} took responsibility for ${a.sex === 'male' ? 'him' : a.sex === 'female' ? 'her' : 'them'}.`,
      memories: [memory(me, `The day ${a.name} became yours to look after.`, `${p.firstName} remembered the day ${a.name} arrived.`), ...firstImpressions(state, a, me.id)] });
  }
  return a;
}

const memory = (who, you, they) => ({ who, you, they });
/** How the rest of the household took to a new animal: read from their own bond with it, not invented. */
function firstImpressions(state, a, exceptId) {
  return Object.entries(a.bonds).filter(([id]) => id !== exceptId && state.npcs[id]).slice(0, 2).map(([id, b]) => {
    const who = { id, name: b.name };
    const first = b.name.split(' ')[0];
    return b.value >= 70 ? memory(who, `You and ${a.name} took to each other at once.`, `${first} and ${a.name} took to each other at once.`)
      : b.value < 50 ? memory(who, `You kept a careful distance from ${a.name} at first.`, `${first} kept a careful distance from ${a.name} at first.`)
        : memory(who, `You got used to ${a.name} soon enough.`, `${first} got used to ${a.name} soon enough.`);
  });
}

export function ageOf(a, state = store.state) {
  if (a.status !== 'living') return a.ageAtDeath;
  return handle(state, a)?.age ?? Math.max(0, state.year - a.born);
}
export function stageOf(a, state = store.state) {
  const sp = speciesOf(a.speciesId);
  const share = (ageOf(a, state) ?? 0) / Math.max(1, a.lifespan);
  let name = sp.stages[0][0];
  for (const [n, from] of sp.stages) if (share >= from) name = n;
  return name;
}
const describeAge = (a, state) => { const n = ageOf(a, state); return n < 1 ? 'young' : `${n}-year-old`; };
export const pronoun = (a, form = 'they') => ({ they: { male: 'he', female: 'she' }, them: { male: 'him', female: 'her' }, their: { male: 'his', female: 'her' } })[form][a.sex] ?? form;

// ---------- The family's record of what happened ----------

/**
 * Writes one moment into the record. A moment is written once: the same kind
 * of thing for the same animal in the same year (and `key`) is not repeated.
 * `story` adds a line to the life story; `storyEntry` marks a line already
 * there; `pending` marks the next outcome line the scene engine writes.
 */
function record(state, o) {
  const A = ensure(state);
  const p = state.player;
  const k = `${o.type}|${o.animalId}|${state.year}|${o.key ?? ''}`;
  const had = A.events.find((e) => e.k === k);
  if (had) return had;
  const a = A.byId[o.animalId];
  const home = homeOf(a) ?? a.homes[a.homes.length - 1] ?? null;
  const seen = new Set();
  const ev = {
    id: `ae_${++A.seq}`, k, type: o.type, year: state.year, gen: p.generation ?? 1, age: p.age,
    narrator: ref(state, p.id), animalId: o.animalId,
    people: (o.people ?? []).filter((r) => r && !seen.has(r.id ?? r.name) && seen.add(r.id ?? r.name)),
    home: home?.key ?? null, homeLabel: home?.label ?? null, place: { city: home?.city ?? p.city, countryId: home?.countryId ?? p.countryId },
    text: o.text, story: null, sig: o.sig ?? 1, memories: o.memories ?? [],
  };
  A.events.push(ev);
  const mark = (entry) => { entry.animal = { id: a.id, ev: ev.id }; ev.story = entry.text; };
  if (o.storyEntry) mark(o.storyEntry);
  else if (o.story) { const entry = { age: p.age, text: o.story, kind: 'system', tone: o.tone ?? 'neutral' }; state.journal.push(entry); mark(entry); }
  else if (o.pending) (A.pending ??= []).push(ev.id);
  return ev;
}
/** The scene engine has just written the line that tells a moment recorded during the scene. */
export function claimStory(entry, state = store.state) {
  const A = ensure(state);
  for (const id of A.pending ?? []) {
    const ev = A.events.find((e) => e.id === id);
    if (ev && !ev.story) { entry.animal = { id: ev.animalId, ev: ev.id }; ev.story = entry.text; }
  }
  delete A.pending;
}
export const eventById = (id, state = store.state) => ensure(state).events.find((e) => e.id === id) ?? null;

// ---------- Death, and what is kept ----------

/** Called when an animal in the player's life has died. Writes the line in the life story. */
export function animalDied(npc, state = store.state) {
  const a = register(npc, { state });
  if (a.status === 'deceased') return a;
  const p = state.player;
  const sp = speciesOf(a.speciesId);
  const owner = ownerOf(a);
  setBond(a, ref(state, p.id), npc.meters.relationship);
  a.status = 'deceased'; a.died = state.year; a.ageAtDeath = npc.age;
  const since = a.homes[0]?.from;
  const yours = isPlayer(state, owner?.id);
  const close = Object.entries(a.bonds).filter(([id, b]) => id !== p.id && b.value >= 60 && aliveHuman(state, id)).sort((x, y) => y[1].value - x[1].value).slice(0, 3);
  const years = since != null ? state.year - since : null;
  const mine = memory(ref(state, p.id),
    years ? `You were ${p.age} when ${a.name} died. ${cap(pronoun(a))} had been there for ${years === 1 ? 'a year' : `${years} years`} of your life.` : `You were ${p.age} when ${a.name} died.`,
    `${p.firstName} was ${p.age} when ${a.name} died.`);
  record(state, { type: 'died', animalId: a.id, people: [owner, primaryOf(a), ...helpersOf(a), ...(livesWithPlayer(a.id, state) ? [ref(state, p.id)] : [])], sig: 3, tone: 'bad',
    story: yours ? `Your ${sp.name} ${a.name} died at age ${npc.age}.` : `${a.name}, the family ${sp.name}, died at age ${npc.age}.`,
    text: `${a.name} died at the age of ${npc.age}${a.homes.length ? `, at ${(homeOf(a) ?? a.homes[a.homes.length - 1]).label.replace(/^The /, 'the ').replace(/^A /, 'a ')}` : ''}.`,
    memories: [mine, ...close.map(([id, b]) => { const first = b.name.split(' ')[0]; const who = { id, name: b.name };
      return b.value >= 85 ? memory(who, `You were closest to ${a.name}, and took it hardest.`, `${first} was closest to ${a.name}, and took it hardest.`)
        : memory(who, `You miss ${a.name}.`, `${first} missed ${a.name}.`); })] });
  for (const list of [a.ownerships, a.care, a.homes]) closeOpen(list, state.year, 'death');
  return a;
}

/** A memorial for an animal that has died. Made once. */
export function memorialize(id, state = store.state) {
  const a = animalById(id, state);
  const p = state.player;
  if (!a || a.status !== 'deceased') return result(false, 'There is nothing to remember yet.', 'neutral');
  if (a.memorial) return result(false, `${a.name} already has a memorial.`, 'neutral');
  if (p.age < 5) return result(false, 'You are too young to do this yourself.', 'neutral');
  a.memorial = { year: state.year, by: ref(state, p.id) };
  const ev = record(state, { type: 'memorial', animalId: a.id, people: [ref(state, p.id)], sig: 2, key: 'memorial',
    story: `You made a small memorial for ${a.name}: a photograph, ${pronoun(a, 'their')} collar, a place to stop for a moment.`,
    text: `${fullName(p)} made a memorial for ${a.name}.`,
    memories: [memory(ref(state, p.id), `You chose the photograph of ${a.name} yourself.`, `${p.firstName} chose the photograph of ${a.name}.`)] });
  return result(true, ev.story);
}

// ---------- Continuing care ----------

/** Who could take an animal on when `goneId` no longer can: nearest first. Adults, living, in the same country. */
function successors(state, a, goneId) {
  const p = state.player;
  const fit = (n) => n && n.alive !== false && n.id !== goneId && n.age >= 18 && !n.flags?.abroad && n.role !== 'pet';
  const out = [];
  const add = (id) => { if (id && !out.includes(id) && (isPlayer(state, id) ? p.alive && p.age >= 18 && !p.legal?.incarceration && id !== goneId : fit(state.npcs[id]))) out.push(id); };
  // Its owner, if it was only the caregiver who has gone; then someone who already looks after it: it stays with a face it knows.
  add(ownerOf(a)?.id);
  for (const c of a.care.filter((x) => x.to == null).sort((x, y) => (bondOf(a, y.who.id) ?? 0) - (bondOf(a, x.who.id) ?? 0))) add(c.who.id);
  const order = isPlayer(state, goneId) ? ['spouse', 'child', 'grandchild', 'sibling', 'parent'] : ['parent', 'PLAYER', 'sibling', 'grandparent', 'spouse', 'child'];
  for (const role of order) {
    if (role === 'PLAYER') { add(p.id); continue; }
    for (const n of livingBy(state, [role]).sort((x, y) => (bondOf(a, y.id) ?? 0) - (bondOf(a, x.id) ?? 0) || y.age - x.age)) add(n.id);
  }
  return out;
}

/**
 * Finds a living animal a new keeper when its owner or main caregiver has died
 * or gone. The animal is never left without one: if nobody in the family can
 * take it, it is rehomed through a rescue, and the record keeps it.
 */
function arrangeCare(state, a, goneId, why, quiet = false) {
  const p = state.player;
  const gone = ref(state, goneId) ?? [...a.ownerships, ...a.care].find((x) => x.who.id === goneId)?.who ?? ownerOf(a) ?? primaryOf(a);
  const sp = speciesOf(a.speciesId);
  const next = successors(state, a, goneId)[0];
  const lost = why === 'death' ? `After ${gone.name}'s death` : `When ${gone.name} could no longer keep ${pronoun(a, 'them')}`;
  if (!next) {
    const rescue = { id: null, name: 'a rescue organisation' };
    setOwner(state, a, rescue, 'rehomed'); setPrimary(state, a, rescue, why);
    for (const c of a.care) if (c.to == null && c.role === 'helper') { c.to = state.year; c.ended = why; }
    setHome(state, a, { hh: 'rescue', key: 'rescue', label: 'A new home, found through a rescue', city: a.homes[a.homes.length - 1]?.city ?? p.city, countryId: a.homes[a.homes.length - 1]?.countryId ?? p.countryId });
    record(state, { type: 'rehomed', animalId: a.id, people: [gone], sig: 3, key: 'rehomed',
      story: !quiet ? `Nobody in the family could take ${a.name}. A rescue found ${pronoun(a, 'them')} a new home.` : null,
      text: `${lost}, nobody in the family could take ${a.name}. A rescue organisation found the ${sp.name} a new home.` });
    // No longer in the player's life; still on the record.
    if (state.npcs[a.id]) { a.lastBond = state.npcs[a.id].meters.relationship; delete state.npcs[a.id]; p.npcIds = p.npcIds.filter((id) => id !== a.id); }
    a.inCircle = false;
    return null;
  }
  const who = ref(state, next);
  const wasOwner = ownerOf(a)?.id === goneId || !aliveHuman(state, ownerOf(a)?.id);
  if (wasOwner) setOwner(state, a, who, why === 'death' ? 'inherited' : 'transferred');
  setPrimary(state, a, who, why);
  for (const c of a.care) if (c.to == null && c.who.id === goneId) { c.to = state.year; c.ended = why; }
  firstBond(a, who);
  const same = isPlayer(state, next) ? playerHome(state) : null;
  const before = homeOf(a);
  // It stays where it lives if its new keeper lives there too; otherwise it goes to them.
  const stays = before && ((before.hh === 'parents' && state.npcs[next]?.role === 'parent') || (before.hh === 'player' && !isPlayer(state, goneId) && ['spouse', 'child'].includes(state.npcs[next]?.role)));
  if (!stays) setHome(state, a, same ?? homeWith(state, who));
  const you = isPlayer(state, next);
  record(state, { type: 'care', animalId: a.id, people: [gone, who], sig: 3, key: `care:${next}`,
    story: quiet ? null : you ? `${a.name} is yours to look after now.` : `${cap(whoPhrase(state, who))} has taken over looking after ${a.name}.`,
    text: `${lost}, ${who.name} took over ${a.name}'s care${wasOwner ? ` and became ${pronoun(a, 'their')} owner` : ''}.`,
    memories: [memory(who, `${a.name} came to you when ${gone.name.split(' ')[0]} was gone.`, `${who.name.split(' ')[0]} took ${a.name} in when ${gone.name.split(' ')[0]} was gone.`)] });
  return who;
}

/** The player has died: every animal that depended on them is given a keeper. Called before the life is closed. */
export function settleOnDeath(state = store.state) {
  const p = state.player;
  reconcile(state);
  for (const a of allAnimals(state)) {
    if (a.status !== 'living') continue;
    if (ownerOf(a)?.id === p.id || primaryOf(a)?.id === p.id) arrangeCare(state, a, p.id, 'death', true);
    else for (const c of a.care) if (c.to == null && c.who.id === p.id) { c.to = state.year; c.ended = 'death'; }
  }
}

// ---------- Keeping the record in step with the life ----------

/**
 * Brings the record up to date with the player's life as it stands. Changes
 * nothing if nothing has changed, rolls no dice, and may be called at any time.
 */
export function reconcile(state = store.state) {
  const A = ensure(state);
  const p = state.player;
  // Animals in the player's life that the record has not met: old saves, or anything added by another road.
  for (const id of p.npcIds) {
    const n = state.npcs[id];
    if (n?.role === 'pet' && !A.byId[id]) register(n, { state, origin: 'unknown' });
  }
  for (const a of Object.values(A.byId)) {
    const n = handle(state, a);
    a.inCircle = !!n;
    if (!n) continue;
    a.name = n.firstName;
    setBond(a, ref(state, p.id), n.meters.relationship);
    if (!n.alive && a.status === 'living') animalDied(n, state);
  }

  // The household: moving out, moving house, moving country.
  const home = playerHome(state);
  const seen = A.seen;
  const here = (a) => a.status === 'living' && a.inCircle;
  if (seen && seen.playerId === p.id) {
    const left = seen.hh === 'parents' && home.hh === 'player';
    const moved = seen.city !== home.city || seen.countryId !== home.countryId;
    for (const a of Object.values(A.byId).filter(here)) {
      const at = homeOf(a);
      const owner = ownerOf(a);
      const yours = isPlayer(state, owner?.id) || isPlayer(state, primaryOf(a)?.id);
      if (!at) continue;
      const went = (to, people, sig) => {
        const far = at.countryId !== to.countryId;
        record(state, { type: 'moved', animalId: a.id, people, sig: sig ?? (far ? 3 : 2), key: `moved:${to.city}`,
          story: `${a.name} made the move to ${to.city} with ${yours ? 'you' : 'the family'}.`,
          text: `${a.name} moved with the household from ${at.city} to ${to.city}, ${theCountry(COUNTRIES[to.countryId].name)}.`,
          memories: far && yours ? [memory(ref(state, p.id), `You would not have gone without ${a.name}.`, `${p.firstName} would not have gone without ${a.name}.`)] : [] });
      };
      if (at.hh === 'parents' && home.hh === 'parents') {
        // Still under the family's roof. If the family has moved, so has the animal.
        if (moved && setHome(state, a, { ...at, from: undefined, to: undefined, city: home.city, countryId: home.countryId })) went(home, [owner, ref(state, p.id)]);
        continue;
      }
      if (at.hh === 'parents' && !yours) {
        if (!left) continue;
        // The family's animal stays in the family home. It is not the player's to take.
        for (const c of a.care) if (c.to == null && c.who.id === p.id) { c.to = state.year; c.ended = 'moved out'; }
        record(state, { type: 'stayed', animalId: a.id, people: [owner, ref(state, p.id)], sig: 2, key: 'stayed',
          story: `${a.name} stays in the family home with ${whoPhrase(state, owner)}.`,
          text: `${a.name} stayed in the ${p.lastName} family home with ${owner.name} when ${p.firstName} moved out.`,
          memories: [memory(ref(state, p.id), `Leaving ${a.name} was part of leaving home.`, `${p.firstName} left ${a.name} behind on leaving home.`)] });
        continue;
      }
      if (at.hh !== 'player' && at.hh !== 'parents') continue;
      if (!setHome(state, a, home)) continue;
      if (at.countryId !== home.countryId || at.city !== home.city) went(home, [ref(state, p.id), ...helpersOf(a)]);
      else {
        record(state, { type: 'moved', animalId: a.id, people: [ref(state, p.id)], sig: 1, key: `home:${home.key}`,
          text: `${a.name} moved with ${p.firstName} to ${home.label.replace(/^A /, 'a ').replace(/^The /, 'the ')} in ${home.city}.` });
      }
    }
  }
  A.seen = { playerId: p.id, hh: home.hh, key: home.key, city: home.city, countryId: home.countryId };

  // Nobody is left without a keeper.
  if (p.alive) {
    for (const a of Object.values(A.byId).filter(here)) {
      const owner = ownerOf(a);
      const main = primaryOf(a);
      if (owner?.id && !aliveHuman(state, owner.id)) arrangeCare(state, a, owner.id, state.npcs[owner.id] ? 'death' : 'gone');
      else if (main?.id && !aliveHuman(state, main.id)) arrangeCare(state, a, main.id, state.npcs[main.id] ? 'death' : 'gone');
      for (const c of a.care) if (c.to == null && c.role === 'helper' && c.who.id && !aliveHuman(state, c.who.id)) { c.to = state.year; c.ended = 'death'; }
    }
    // A child of the house starts helping with the family's animals once old enough.
    if (p.age >= 8 && home.hh === 'parents') for (const a of Object.values(A.byId).filter((x) => here(x) && homeOf(x)?.hh === 'parents')) addHelper(state, a, ref(state, p.id));
    // People who have joined the player's household help with its animals.
    for (const a of Object.values(A.byId).filter((x) => here(x) && homeOf(x)?.hh === 'player')) {
      for (const n of livingBy(state, ['spouse'])) { if (!n.flags.abroad) { addHelper(state, a, ref(state, n.id)); firstBond(a, ref(state, n.id)); } }
      for (const n of livingBy(state, ['child'])) { if (n.age < 18 && !n.flags.abroad) { firstBond(a, ref(state, n.id), 8); if (n.age >= 8) addHelper(state, a, ref(state, n.id)); } }
      for (const c of a.care) if (c.to == null && c.role === 'helper' && ['ex', 'enemy'].includes(state.npcs[c.who.id]?.role)) { c.to = state.year; c.ended = 'left the household'; }
    }
  }
  return A;
}

/** Yearly. Runs once for each year, however often it is called. */
export function tickAnimals(state = store.state) {
  const A = reconcile(state);
  if (A.tickYear === state.year) return;
  A.tickYear = state.year;
  for (const a of Object.values(A.byId)) {
    if (a.status !== 'living') continue;
    // The people who look after an animal grow closer to it, slowly.
    for (const c of a.care) {
      if (c.to != null || !c.who.id || isPlayer(state, c.who.id) || !a.bonds[c.who.id]) continue;
      a.bonds[c.who.id].value = Math.round(clamp(a.bonds[c.who.id].value + seeded(`${a.id}:${c.who.id}:${state.year}`).int(0, c.role === 'primary' ? 3 : 2), 0, 97));
    }
    // An animal that has left the player's life still grows old, where it is.
    if (!a.inCircle && a.born != null && state.year - a.born >= a.lifespan) {
      a.status = 'deceased'; a.died = state.year; a.ageAtDeath = state.year - a.born;
      const keeper = primaryOf(a);
      record(state, { type: 'died', animalId: a.id, people: [ownerOf(a), keeper], sig: 2,
        text: `${a.name} died at the age of ${a.ageAtDeath}, in the care of ${keeper?.name ?? 'the people who had taken them in'}.` });
      for (const list of [a.ownerships, a.care, a.homes]) closeOpen(list, state.year, 'death');
    }
  }
}

// ---------- Things done together ----------

/** What can be taught, and how far each has got. */
export function trainingOf(a) {
  return speciesOf(a.speciesId).training.map((s) => ({ ...s, progress: a.training[s.id]?.progress ?? 0, sessions: a.training[s.id]?.sessions ?? 0,
    learnedYear: a.training[s.id]?.learnedYear ?? null, by: a.training[s.id]?.by ?? null }));
}
/** What the player can do with this animal now, beyond what they can do with anyone. */
export function animalActions(id, state = store.state) {
  const a = animalById(id, state);
  const p = state.player;
  const n = a && handle(state, a);
  if (!a || a.status !== 'living' || !n?.alive) return [];
  const out = [];
  if (p.age >= 6 && trainingOf(a).some((s) => s.progress < 100)) out.push({ id: 'train', label: 'Practise training' });
  return out;
}

/**
 * A year's patient practice at one thing, with food and praise. Once a year for each animal.
 * How far it gets depends on the animal, on how close the two are, and on how hard the thing is.
 */
export function train(id, skillId, state = store.state) {
  const a = animalById(id, state);
  const n = a && handle(state, a);
  const p = state.player;
  if (!a || !n?.alive) return result(false, 'They are gone.');
  const skill = speciesOf(a.speciesId).training.find((s) => s.id === skillId);
  if (!skill) return result(false, `That is not something a ${speciesOf(a.speciesId).name} can be asked to do.`, 'neutral');
  const t = (a.training[skill.id] ??= { progress: 0, sessions: 0, firstYear: state.year, learnedYear: null, by: null });
  if (t.progress >= 100) return result(false, `${a.name} already ${skill.learned}.`, 'neutral');
  n.flags.acts ??= {};
  if (n.flags.acts.train === p.age) return result(false, `You and ${a.name} have already worked on something this year.`, 'neutral');
  n.flags.acts.train = p.age;
  n.lastInteractionAge = p.age;
  const stage = stageOf(a, state);
  const temper = a.temperament.trainability ?? (100 - (a.temperament.independence ?? 50));
  const gain = Math.max(8, Math.round(rng.int(28, 46) + (temper - 50) * 0.3 + (n.meters.relationship - 50) * 0.2 - skill.difficulty * 7
    + (stage === 'senior' ? -6 : stage === 'adult' ? 0 : 5) + (p.age < 12 ? -6 : 0)));
  t.progress = Math.min(100, t.progress + gain);
  t.sessions += 1; t.lastYear = state.year; t.by = ref(state, p.id);
  n.meters.relationship = clamp(n.meters.relationship + rng.int(2, 5));
  setBond(a, ref(state, p.id), n.meters.relationship);
  let text; let tone = 'good';
  if (t.progress >= 100) {
    t.learnedYear = state.year;
    const learned = trainingOf(a).filter((s) => s.progress >= 100);
    const first = learned.length === 1;
    text = `${a.name} ${skill.learned}. It took patience, and a great many treats.`;
    const entry = { age: p.age, text, kind: 'system', tone };
    state.journal.push(entry);
    record(state, { type: 'trained', animalId: a.id, people: [ref(state, p.id)], sig: first ? 2 : 1, key: skill.id, storyEntry: entry,
      text: first ? `${a.name} learned ${pronoun(a, 'their')} first lesson with ${fullName(p)}: ${pronoun(a)} ${skill.learned}.` : `${a.name} learned something new with ${fullName(p)}: ${pronoun(a)} ${skill.learned}.`,
      memories: first ? [memory(ref(state, p.id), `The first time ${a.name} got it right, you both looked surprised.`, `${p.firstName} taught ${a.name} ${pronoun(a, 'their')} first lesson.`)] : [] });
    if (learned.length === speciesOf(a.speciesId).training.length && learned.length > 1) {
      record(state, { type: 'achievement', animalId: a.id, people: [ref(state, p.id)], sig: 3, key: 'all',
        story: `${a.name} has learned everything you set out to teach ${pronoun(a, 'them')}.`,
        text: `${a.name} learned everything ${fullName(p)} set out to teach ${pronoun(a, 'them')}: ${learned.map((s) => s.name.toLowerCase()).join(', ')}.` });
    }
  } else {
    tone = 'neutral';
    text = gain >= 30 ? `You and ${a.name} worked on ${skill.name.toLowerCase()}. ${cap(pronoun(a))} is getting there.`
      : `You and ${a.name} worked on ${skill.name.toLowerCase()}. Progress is slow, and that is allowed.`;
    state.journal.push({ age: p.age, text, kind: 'system', tone });
  }
  return { ok: true, text, tone };
}

/**
 * A line in the animal's health record. A visit to the vet that ends in
 * recovery is also a moment the family keeps.
 * @param {{kind:'vet'|'illness', note:string, costBase?:number, recovered?:boolean}} v  the money itself is taken by the scene, once
 */
export function recordHealth(id, v, state = store.state) {
  const a = animalById(id, state) ?? (state.npcs[id]?.role === 'pet' ? register(state.npcs[id], { state }) : null);
  if (!a) return null;
  const p = state.player;
  const c = COUNTRIES[p.countryId];
  const entry = { id: `h${a.health.length + 1}`, year: state.year, age: ageOf(a, state), kind: v.kind, note: v.note,
    cost: v.costBase ? localMoney(v.costBase, c) : 0, currency: c.currency.code, recovered: v.recovered ?? null, paidBy: v.costBase ? ref(state, p.id) : null, eventId: null };
  a.health.push(entry);
  if (v.kind === 'vet' && v.recovered) {
    const ev = record(state, { type: 'recovery', animalId: a.id, people: [ref(state, p.id)], sig: 2, key: entry.id, pending: true,
      text: `${a.name} was taken to the vet by ${fullName(p)}, and recovered.`,
      memories: [memory(ref(state, p.id), `The week ${a.name} would not eat, and the relief when ${pronoun(a)} did.`, `${p.firstName} took ${a.name} to the vet, and was relieved.`)] });
    entry.eventId = ev.id;
  }
  return entry;
}

// ---------- Reading the record ----------

/** Whether the player is, or has been, one of the people responsible for this animal. */
const everKept = (state, a) => [...a.ownerships, ...a.care].some((x) => x.who?.id === state.player.id);
/**
 * How much of an animal's health record the player may see.
 * 'full'    it is theirs, they help look after it, or they live with it
 * 'summary' it is not theirs to read in detail: how many visits, not what for
 */
export function healthAccess(id, state = store.state) {
  const a = animalById(id, state);
  if (!a) return 'summary';
  return everKept(state, a) || livesWithPlayer(id, state) ? 'full' : 'summary';
}

/** How an animal belongs to the family, as the player would say it. */
export function familyLink(a, state = store.state) {
  const sp = speciesOf(a.speciesId).name;
  const owner = ownerOf(a) ?? a.ownerships[a.ownerships.length - 1]?.who ?? null;
  const gone = a.status !== 'living';
  if (isPlayer(state, owner?.id)) return gone ? `Your ${sp}` : homeOf(a)?.hh === 'player' || livesWithPlayer(a.id, state) ? `Your ${sp}` : `Your ${sp}, living elsewhere`;
  const kin = owner?.id ? kinWord(state, owner.id) : null;
  if (kin) return `${gone ? 'Was your' : 'Your'} ${kin} ${state.npcs[owner.id].firstName}'s ${sp}${everKept(state, a) ? ', and partly yours' : ''}`;
  if (!owner?.id && owner) return `Once the family's ${sp}; rehomed through a rescue`;
  return owner ? `${owner.name}'s ${sp}, from the family's past` : `A ${sp} of the family`;
}

/** Everyone who has looked after an animal, the present ones first, each once. */
export function caregiversOf(a, state = store.state) {
  const out = [];
  const seen = new Set();
  const rows = [...a.care].sort((x, y) => Number(y.to == null && !x.closed) - Number(x.to == null && !x.closed) || Number(y.role === 'primary') - Number(x.role === 'primary') || (y.from ?? 0) - (x.from ?? 0));
  for (const c of rows) {
    const key = c.who.id ?? c.who.name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ who: c.who, role: c.role, current: c.to == null && a.status === 'living', from: c.from, to: c.to, bond: c.who.id ? bondOf(a, c.who.id) : null,
      known: !!c.who.id && (isPlayer(state, c.who.id) || !!state.npcs[c.who.id]) });
  }
  return out;
}

/** The moments of one animal's life, oldest first. */
export const eventsOf = (id, state = store.state) => ensure(state).events.filter((e) => e.animalId === id);
/** The ones worth showing on a card. */
export const milestonesOf = (id, state = store.state) => eventsOf(id, state).filter((e) => e.sig >= 2);

/** Every animal that belongs in the family's album: the living, then the remembered, newest first. */
export function albumAnimals(state = store.state, { show = 'all', species = 'all' } = {}) {
  return allAnimals(state)
    .filter((a) => (show === 'all' || (show === 'living') === (a.status === 'living')) && (species === 'all' || a.speciesId === species))
    .sort((x, y) => Number(y.status === 'living') - Number(x.status === 'living') || (y.died ?? y.firstSeenYear ?? 0) - (x.died ?? x.firstSeenYear ?? 0) || x.name.localeCompare(y.name));
}

/** The family's animal timeline. */
export function timeline(state = store.state, { type = 'all', animalId = 'all', minSig = 1 } = {}) {
  return ensure(state).events.filter((e) => (type === 'all' || e.type === type) && (animalId === 'all' || e.animalId === animalId) && e.sig >= minSig)
    .sort((x, y) => x.year - y.year || Number(x.id.slice(3)) - Number(y.id.slice(3)));
}
/** What happened, with animals, under one roof. `key` is a household key (see playerHome). */
export const houseChronicle = (key, state = store.state) => timeline(state).filter((e) => e.home === key);

/** Where in the life story a moment is told: the index of its line, or -1 if it belongs to an earlier life. */
export const storyIndex = (eventId, state = store.state) => state.journal.findIndex((j) => j.animal?.ev === eventId);
/** The life-story lines about animals from one generation of the family, for lives that are over. */
export const storyOfGeneration = (gen, state = store.state) => ensure(state).events.filter((e) => e.gen === gen && e.story);

/** What a moment was called, for a heading. */
export const eventLabel = (e) => EVENT_TYPES[e.type]?.label ?? cap(e.type);

/** A sentence or two about what an animal is like, from its temperament. */
export function temperamentWords(a) {
  const dims = Object.entries(a.temperament).sort((x, y) => Math.abs(y[1] - 50) - Math.abs(x[1] - 50)).slice(0, 3);
  return dims.map(([d, v]) => (v >= 50 ? TEMPERAMENT[d].high : TEMPERAMENT[d].low));
}
export function describeLooks(a) {
  const sp = speciesOf(a.speciesId);
  const b = breedOf(a.speciesId, a.breedId);
  const ap = a.appearance;
  const coat = ap.pattern === 'solid' || !ap.second ? ap.coat : `${ap.coat} and ${ap.second}`;
  const pat = { solid: '', patched: 'patched', saddle: 'with a dark saddle', socks: 'with pale socks', blaze: 'with a pale blaze', tabby: 'tabby', bicolour: 'two-coloured', tortoiseshell: 'tortoiseshell', calico: 'calico', pointed: 'with dark points' }[ap.pattern] ?? '';
  return [`${cap(ap.size)}, ${ap.length}-coated ${sp.name}`, `${cap(coat)}${pat ? `, ${pat}` : ''}`, `${cap(ap.eyes)} eyes`, ...(sp.id === 'dog' || sp.id === 'rabbit' ? [{ up: 'Upright ears', drop: 'Drop ears', half: 'Half-pricked ears', tuft: 'Tufted ears' }[ap.ears]] : []),
    ...(ap.mark ? [cap(ap.mark)] : []), ...(b && !a.breedKnown ? [`Looks like a ${b.name}; nobody knows for certain`] : [])];
}
/** "Golden Retriever", "Mixed breed", or nothing where it is not known. */
export function breedLabel(a) {
  const b = breedOf(a.speciesId, a.breedId);
  return !b ? '' : a.breedKnown ? b.name : `${b.name}?`;
}
/** "2019 – 2031", "b. 2024", or "lived to 12" where the years were never recorded. */
export function lifeDates(a, state = store.state) {
  const born = a.born != null ? `${a.bornKnown ? '' : 'about '}${a.born}` : null;
  if (a.status === 'living') return born ? `Born ${born} · age ${ageOf(a, state)}` : `Age ${ageOf(a, state)}`;
  if (a.died != null) return `${born ?? '?'} – ${a.died} · lived to ${a.ageAtDeath}`;
  return `Lived to ${a.ageAtDeath}; the years were not recorded`;
}

// ---------- From one generation to the next ----------

/**
 * Carries the record into the next life. Nothing is dropped: the animals, who
 * owned and kept them, the homes, the bonds, the moments and the memories all
 * go across. The person who died is now a relative, and the heir is now the
 * player, so every mention of either is moved to their new id.
 * Call after settleOnDeath (in death.js) has given every animal a keeper.
 * @param {object} old   the finished life
 * @param {object} next  the new one, with its people in place
 * @param {{ancestorId:string, heirId:string, assetIds?:Object<string,string>}} ids
 */
export function handOver(old, next, ids) {
  const A = ensure(old);
  next.animals = A;
  const np = next.player;
  const map = { [old.player.id]: ids.ancestorId, [ids.heirId]: np.id };
  const swap = (r) => { if (r?.id && map[r.id]) r.id = map[r.id]; };
  const propKey = (k) => (k?.startsWith('prop:') && ids.assetIds?.[k.slice(5)] ? `prop:${ids.assetIds[k.slice(5)]}` : k);
  for (const a of Object.values(A.byId)) {
    for (const x of [...a.ownerships, ...a.care]) swap(x.who);
    for (const t of Object.values(a.training)) swap(t.by);
    for (const h of a.health) swap(h.paidBy);
    if (a.memorial) swap(a.memorial.by);
    for (const [from, to] of Object.entries(map)) if (a.bonds[from]) { a.bonds[to] = a.bonds[from]; delete a.bonds[from]; }
    for (const h of a.homes) {
      h.key = propKey(h.key);
      // "The player's household" meant the last player's. Closed chapters are kept under that person's name.
      if (h.hh === 'player') h.hh = ids.ancestorId; else if (h.hh === 'parents') h.hh = `parents-of:${ids.ancestorId}`; else if (map[h.hh]) h.hh = map[h.hh];
    }
  }
  for (const e of A.events) { swap(e.narrator); for (const r of e.people) swap(r); for (const m of e.memories) swap(m.who); e.home = propKey(e.home); }

  const home = playerHome(next);
  for (const a of Object.values(A.byId)) {
    const n = next.npcs[a.id];
    a.inCircle = !!n;
    if (a.status !== 'living') continue;
    const keeper = primaryOf(a) ?? ownerOf(a);
    // Where it lives now, said from the new player's side.
    if (keeper?.id === np.id) setHome(next, a, home);
    else if (keeper?.id && next.npcs[keeper.id]) {
      const withFamily = next.npcs[keeper.id].role === 'parent' && np.flags.livesWithParents;
      setHome(next, a, withFamily ? { ...home, hh: 'parents', key: 'family-home', label: `The ${np.lastName} family home` } : homeWith(next, keeper));
    } else if (homeOf(a)?.hh === ids.ancestorId) {
      // It lived with the one who died, and its keeper is nobody the heir knows: it has gone to them.
      setHome(next, a, { ...homeOf(a), hh: keeper?.id ?? 'elsewhere', key: `with:${keeper?.id ?? 'elsewhere'}`, label: keeper ? `${keeper.name.split(' ')[0]}'s home` : 'Elsewhere' });
    }
    if (n) {
      // The heir's own bond with the animal, as it already was.
      if (a.bonds[np.id]) n.meters.relationship = a.bonds[np.id].value;
      setBond(a, ref(next, np.id), n.meters.relationship);
    }
  }
  A.seen = { playerId: np.id, hh: home.hh, key: home.key, city: home.city, countryId: home.countryId };
  A.tickYear = next.year;
  delete A.pending;
  return A;
}

/** Whether a living animal still has a keeper among the heir's people, and so stays in the heir's life. */
export function staysInFamily(old, animalId, heirId, kept) {
  const a = animalById(animalId, old);
  if (!a || a.status !== 'living') return false;
  const keeper = primaryOf(a) ?? ownerOf(a);
  return !!keeper?.id && (keeper.id === heirId || !!kept[keeper.id]);
}

// ---------- Checking the record ----------

/** Everything that is wrong with the record. An empty list means it is sound. */
export function audit(state = store.state) {
  const A = ensure(state);
  const bad = [];
  const ids = new Set();
  for (const [key, a] of Object.entries(A.byId)) {
    if (key !== a.id) bad.push(`${a.name}: filed under the wrong id`);
    if (ids.has(a.id)) bad.push(`${a.name}: recorded twice`);
    ids.add(a.id);
    const open = (list, pred = () => true) => list.filter((x) => x.to == null && !x.closed && pred(x)).length;
    if (a.status === 'living') {
      if (open(a.ownerships) !== 1) bad.push(`${a.name}: ${open(a.ownerships)} owners at once`);
      if (open(a.care, (c) => c.role === 'primary') !== 1) bad.push(`${a.name}: ${open(a.care, (c) => c.role === 'primary')} main caregivers at once`);
      if (open(a.homes) !== 1) bad.push(`${a.name}: ${open(a.homes)} homes at once`);
      if (a.inCircle !== !!state.npcs[a.id]) bad.push(`${a.name}: out of step with the player's life`);
    } else {
      if (open(a.ownerships) || open(a.care) || open(a.homes)) bad.push(`${a.name}: has died but is still owned, kept or housed`);
      if (a.ageAtDeath == null) bad.push(`${a.name}: died at no recorded age`);
    }
    for (const x of [...a.ownerships, ...a.care]) if (!x.who?.name) bad.push(`${a.name}: a keeper with no name`);
  }
  for (const id of state.player.npcIds) if (state.npcs[id]?.role === 'pet' && !A.byId[id]) bad.push(`${state.npcs[id].firstName}: in the player's life but not on the record`);
  const seen = new Set();
  for (const e of A.events) {
    if (seen.has(e.id)) bad.push(`${e.id}: recorded twice`);
    seen.add(e.id);
    if (!A.byId[e.animalId]) bad.push(`${e.id}: about an animal that is not on the record`);
    if (!EVENT_TYPES[e.type]) bad.push(`${e.id}: of an unknown kind (${e.type})`);
  }
  if (new Set(A.events.map((e) => e.k)).size !== A.events.length) bad.push('the same moment is recorded more than once');
  for (const j of state.journal) if (j.animal && (!seen.has(j.animal.ev) || !A.byId[j.animal.id])) bad.push(`a line in the life story points at a moment that is not on record: "${j.text}"`);
  for (const a of Object.values(A.byId)) for (const h of a.health) if (h.eventId && !seen.has(h.eventId)) bad.push(`${a.name}: a health record points at a moment that is not on record`);
  return bad;
}
