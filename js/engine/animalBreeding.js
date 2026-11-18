// Breeding, kept small and careful, and the record of who descends from whom.
//
// A litter is a decision with conditions: an adult, healthy dam who has seen
// a vet, a sire who is not her relation, room and hands for the young, and
// no more litters than a body should be asked for. Nothing is sold: young
// the household cannot keep go to homes, and the family makes no money.
//
//   animal.parents   { dam, sire }  ids of recorded parents; absent where parentage was never recorded
//   animal.litters   [{ year, sire, young:[ids] }]      animal.pregnancy  { sire, since, due }
import { store } from '../state.js';
import { clamp, cap, localCost, fmtMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { SPECIES, speciesOf, BREEDS, breedOf } from '../data/animals.js';
import { makeNpc } from './npcFactory.js';
import * as zoo from './animals.js';
import * as care from './animalCare.js';

const T = zoo.tools;
const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const say = (state, text, tone = 'neutral') => { const e = { age: state.player.age, text, kind: 'system', tone }; state.journal.push(e); return e; };

/** Species that may be bred, with: the most litters in a life, years between them, young in a litter, the stud fee and the cost of the birth (base units). */
export const BREEDING = {
  dog: { most: 3, gap: 2, young: [2, 4], stud: 400, birth: 500, mix: 'mixed' },
  cat: { most: 3, gap: 2, young: [2, 4], stud: 250, birth: 350, mix: 'dsh' },
  horse: { most: 4, gap: 2, young: [1, 1], stud: 1200, birth: 1400, mix: 'crossbred' },
  pony: { most: 4, gap: 2, young: [1, 1], stud: 700, birth: 1000, mix: 'crossbred' },
  goat: { most: 4, gap: 1, young: [1, 2], stud: 60, birth: 120, mix: null },
  sheep: { most: 4, gap: 1, young: [1, 2], stud: 50, birth: 100, mix: null },
};
const share = (a, state) => (zoo.ageOf(a, state) ?? 0) / Math.max(1, a.lifespan);
/** Old enough and not too old. */
const prime = (a, state) => share(a, state) >= 0.14 && share(a, state) <= 0.6;

// ---------- Descent ----------

export const damOf = (a, state = store.state) => (a.parents?.dam ? zoo.animalById(a.parents.dam, state) : null);
export const sireOf = (a, state = store.state) => (a.parents?.sire ? zoo.animalById(a.parents.sire, state) : null);
export const offspringOf = (id, state = store.state) => zoo.everyAnimal(state).filter((x) => x.parents?.dam === id || x.parents?.sire === id).sort((x, y) => (x.born ?? 0) - (y.born ?? 0));
/** Every recorded ancestor within `depth` generations. */
export function ancestors(a, depth = 3, state = store.state, seen = new Set()) {
  if (!a || depth <= 0) return seen;
  for (const par of [damOf(a, state), sireOf(a, state)]) if (par && !seen.has(par.id)) { seen.add(par.id); ancestors(par, depth - 1, state, seen); }
  return seen;
}
/** Parent and child, siblings, or sharing a grandparent. */
export function related(x, y, state = store.state) {
  const ax = ancestors(x, 2, state); const ay = ancestors(y, 2, state);
  return ax.has(y.id) || ay.has(x.id) || [...ax].some((id) => ay.has(id));
}
/**
 * An animal's pedigree, as far back as anyone wrote it down.
 * @returns {{animal:object, dam:?object, sire:?object}|null}  nested to `depth`; a missing branch is unknown, not invented
 */
export function pedigree(a, depth = 3, state = store.state) {
  if (!a || depth < 0) return null;
  return { animal: a, dam: depth ? pedigree(damOf(a, state), depth - 1, state) : null, sire: depth ? pedigree(sireOf(a, state), depth - 1, state) : null };
}
/** How an animal's ancestry stands: 'recorded' (both parents on record), 'part' or 'unknown'. A breed name alone proves nothing. */
export const parentage = (a) => (a.parents?.dam && a.parents?.sire ? 'recorded' : a.parents?.dam || a.parents?.sire ? 'part' : 'unknown');

// ---------- Choosing a sire ----------

/** The stud animals a breeder near the player stands: the same ones each time, with their papers. */
export function studs(speciesId, state = store.state) {
  const P = care.places(state);
  const key = `${care.cityKey(state)}:${speciesId}`;
  P.studs ??= {};
  const { city, countryId } = state.player;
  const org = (P.studs[key] ??= { id: `stud:${key}`, key, city, countryId, hh: 'breeder', name: `${care.localName(countryId, `stud:${key}`).name.split(' ')[1]} ${cap(speciesOf(speciesId).name)} Stud, ${city}`, made: 0 });
  const there = () => zoo.everyAnimal(state).filter((a) => a.stud === org.id && a.status === 'living');
  for (let guard = 0; there().filter((a) => prime(a, state)).length < 2 && guard < 6; guard++) {
    const sp = SPECIES[speciesId];
    const r = T.seeded(`${org.id}:${++org.made}`);
    const lifespan = r.int(sp.lifespan[0], sp.lifespan[1]);
    const a = zoo.register({ id: `an_${T.hash(`${org.id}:${org.made}`).toString(36)}t${org.made}`, firstName: sp.names[(T.hash(org.id) + org.made * 5) % sp.names.length], species: speciesId,
      age: Math.max(1, Math.round(lifespan * (0.2 + r.next() * 0.2))), lifespan, alive: true, meters: { relationship: 50 } }, { state, stock: org, origin: 'bought', papers: true, history: 'Stands at stud. Health-tested, with papers.' });
    a.stud = org.id; a.sex = 'male';
  }
  return there().filter((a) => prime(a, state));
}
/** Every male the player could put a dam to: their own, and those at stud. */
export function sires(damId, state = store.state) {
  const dam = zoo.animalById(damId, state);
  if (!dam || !BREEDING[dam.speciesId]) return [];
  const own = zoo.allAnimals(state).filter((a) => a.speciesId === dam.speciesId && a.sex === 'male' && a.status === 'living' && care.paysFor(a, state));
  return [...own, ...studs(dam.speciesId, state)];
}

// ---------- The decision ----------

/** Whether a litter from these two would be a responsible one. */
export function breedingCheck(damId, sireId, state = store.state) {
  const dam = zoo.animalById(damId, state); const sire = zoo.animalById(sireId, state);
  const p = state.player; const c = COUNTRIES[p.countryId];
  const rule = BREEDING[dam?.speciesId];
  const problems = []; const notes = [];
  if (!dam || !rule) return { ok: false, problems: ['That is not an animal to breed from.'], notes };
  const npc = state.npcs[dam.id];
  const own = sire && care.paysFor(sire, state);
  const fee = own ? 0 : localCost(rule.stud, c);
  const birth = localCost(rule.birth * care.clinic(state).priceK, c);
  const young = speciesOf(dam.speciesId);
  if (p.age < 18) problems.push('This is not a decision for a child.');
  if (!care.paysFor(dam, state) || !npc?.alive) problems.push(`${dam.name} is not yours to breed from.`);
  if (dam.sex !== 'female') problems.push(`${dam.name} is not female.`);
  if (!sire || sire.speciesId !== dam.speciesId || sire.sex !== 'male' || sire.status !== 'living') problems.push('That is not a suitable sire.');
  if (dam.pregnancy) problems.push(`${dam.name} is already expecting.`);
  if (!prime(dam, state)) problems.push(share(dam, state) < 0.14 ? `${dam.name} is too young. She has growing of her own to do.` : `${dam.name} is too old to be asked for this.`);
  if (sire && !prime(sire, state)) problems.push(`${sire.name} is not the right age.`);
  if (npc && npc.meters.health < 60) problems.push(`${dam.name} is not in good enough health.`);
  if ((dam.conditions ?? []).length) problems.push(`${dam.name} has a condition she could pass on, or that carrying young would make worse.`);
  if (!(dam.lastCheck != null && state.year - dam.lastCheck <= 1)) problems.push(`${dam.name} needs a check-up first. A vet should say she is fit for it.`);
  const litters = dam.litters ?? [];
  if (litters.length >= rule.most) problems.push(`${dam.name} has had ${litters.length} ${litters.length === 1 ? 'litter' : 'litters'}. That is enough for one lifetime.`);
  if (litters.length && state.year - litters[litters.length - 1].year < rule.gap) problems.push(`${dam.name} needs longer to recover from the last time.`);
  if (sire && related(dam, sire, state)) problems.push(`${dam.name} and ${sire.name} are too closely related.`);
  const room = care.careCapacity(state).free >= (young.load ?? 0.5) * 0.5 || !!dam.board;
  if (!room) problems.push('Your household has no room or hands for young animals, even for the weeks before they go to homes.');
  if (p.finance.cash < fee + birth) problems.push(`The ${fee ? `stud fee and the ` : ''}vet's care around the birth come to ${fmtMoney(fee + birth, c)}. You do not have it.`);
  notes.push(`Any young you cannot keep will go to homes chosen with care. Nothing is sold, and there is no money in it.`);
  if (sire && !own) notes.push(`${sire.name} stands at stud: ${fmtMoney(fee, c)}.`);
  if (sire && (dam.breedId !== sire.breedId || !dam.breedKnown || !sire.breedKnown)) notes.push('The young will be of no particular breed.');
  return { ok: !problems.length, problems, notes, fee, birth };
}
export function breed(damId, sireId, state = store.state) {
  const check = breedingCheck(damId, sireId, state);
  if (!check.ok) return result(false, check.problems[0], 'neutral');
  const dam = zoo.animalById(damId, state); const sire = zoo.animalById(sireId, state);
  if (check.fee) care.pay(state, check.fee, 'stud fee', dam.id, `stud|${dam.id}|${state.year}`);
  dam.pregnancy = { sire: sire.id, since: state.year, due: state.year + 1 };
  sire.keep = true;
  const text = `${dam.name} was put to ${sire.name}. If all goes well, the young will arrive next year.`;
  say(state, text);
  return result(true, text, 'neutral');
}

// ---------- Birth ----------

const pick = (roll, x, y) => (roll.chance(0.5) ? x : y);
/** What a youngster takes from its parents: the body, mostly. Its character is its own, with a family likeness. */
function inherit(kid, dam, sire, roll) {
  const d = dam.appearance; const s = sire.appearance;
  kid.appearance = { coat: roll.chance(0.1) && (d.second || s.second) ? (d.second ?? s.second) : pick(roll, d.coat, s.coat), second: pick(roll, d.second, s.second), pattern: pick(roll, d.pattern, s.pattern),
    eyes: pick(roll, d.eyes, s.eyes), size: pick(roll, d.size, s.size), ears: pick(roll, d.ears, s.ears), length: pick(roll, d.length, s.length), mark: roll.chance(0.25) ? pick(roll, d.mark, s.mark) : kid.appearance.mark };
  if (kid.appearance.pattern !== 'solid' && !kid.appearance.second) kid.appearance.second = 'white';
  const same = dam.breedId === sire.breedId && dam.breedKnown && sire.breedKnown;
  kid.breedId = same ? dam.breedId : BREEDING[kid.speciesId].mix ?? (BREEDS[kid.speciesId] ? dam.breedId : null);
  kid.breedKnown = !!kid.breedId && (same || !!breedOf(kid.speciesId, kid.breedId)?.mix);
  for (const k of Object.keys(kid.temperament)) kid.temperament[k] = Math.round(clamp(kid.temperament[k] * 0.7 + (((dam.temperament[k] ?? 50) + (sire.temperament[k] ?? 50)) / 2) * 0.3, 4, 96));
}

/** Yearly: young that are due are born. Runs once for each year. */
export function tickBreeding(state = store.state) {
  const A = zoo.ensure(state);
  if (A.breedYear === state.year) return;
  A.breedYear = state.year;
  const p = state.player; const c = COUNTRIES[p.countryId];
  for (const dam of zoo.allAnimals(state)) {
    const due = dam.pregnancy;
    if (!due) continue;
    const npc = state.npcs[dam.id];
    if (dam.status !== 'living' || !npc?.alive || !care.paysFor(dam, state)) { delete dam.pregnancy; continue; } // it is someone else's concern now
    if (state.year < due.due) continue;
    delete dam.pregnancy;
    const sire = zoo.animalById(due.sire, state);
    const rule = BREEDING[dam.speciesId]; const sp = speciesOf(dam.speciesId);
    const roll = T.seeded(`${dam.id}:litter:${state.year}`);
    const n = roll.int(rule.young[0], rule.young[1]);
    const cost = Math.min(Math.max(0, p.finance.cash), localCost(rule.birth * care.clinic(state).priceK, c));
    care.pay(state, cost, 'birth', dam.id, `birth|${dam.id}|${state.year}`);
    dam.health.push({ id: `h${dam.health.length + 1}`, year: state.year, age: zoo.ageOf(dam, state), kind: 'vet', service: 'birth', note: `Gave birth to ${n === 1 ? `a ${sp.young}` : `${n} young`}. Mother and young checked over.`, cost, currency: c.currency.code, recovered: true, paidBy: T.ref(state, p.id), clinic: care.clinic(state).name, eventId: null });
    npc.meters.health = clamp(npc.meters.health - 3);
    const me = T.ref(state, p.id);
    const home = zoo.homeOf(dam);
    const taken = new Set(zoo.householdAnimals(state).map((x) => x.name));
    const young = [];
    for (let i = 0; i < n; i++) {
      const names = sp.names.filter((x) => !taken.has(x));
      const name = names.length ? names[roll.int(0, names.length - 1)] : `${sp.names[i % sp.names.length]} II`;
      taken.add(name);
      const kn = makeNpc({ role: 'pet', countryId: p.countryId, lastName: p.lastName, age: 0, firstName: name, relationship: 55 });
      kn.species = dam.speciesId; kn.lifespan = roll.int(sp.lifespan[0], sp.lifespan[1]); delete kn.traits; delete kn.orientation;
      state.npcs[kn.id] = kn; p.npcIds.push(kn.id);
      const kid = zoo.register(kn, { state, origin: 'born', quiet: true, home: { ...home, from: undefined, to: undefined, closed: undefined } });
      kid.parents = { dam: dam.id, sire: sire?.id ?? null };
      if (sire) inherit(kid, dam, sire, roll);
      if (kid.sex) kn.gender = kid.sex;
      if (dam.board) kid.board = { ...dam.board, fee: Math.round(dam.board.fee * 0.5), since: state.year };
      young.push(kid);
    }
    (dam.litters ??= []).push({ year: state.year, sire: sire?.id ?? null, young: young.map((k) => k.id) });
    // The household keeps what it can properly look after. The rest go to homes, at the right age, for nothing.
    for (const k of [...young].reverse()) {
      if (care.careCapacity(state).free >= 0) break;
      zoo.leaveToOrg(state, k, { placed: true, sig: 1, why: 'found a home', text: `${k.name}, one of ${dam.name}'s young, went to a home chosen with care.` });
    }
    const kept = young.filter((k) => state.npcs[k.id]);
    const gone = young.length - kept.length;
    const text = `${dam.name} had ${n === 1 ? `a ${sp.young}` : `${n} young`}${sire ? `, by ${sire.name}` : ''}. ${kept.length ? `You are keeping ${kept.map((k) => k.name).join(' and ')}.` : ''}${gone ? ` ${gone === 1 ? 'One went' : `${gone} went`} to homes you chose yourself.` : ''}`.trim();
    const entry = say(state, text, 'good');
    T.record(state, { type: 'born', animalId: dam.id, people: [me], sig: 2, key: `litter:${state.year}`, storyEntry: entry, text: `${dam.name} gave birth to ${n === 1 ? `a ${sp.young}` : `${n} young`}${sire ? `, sired by ${sire.name}` : ''}.` });
    for (const k of kept) {
      T.record(state, { type: 'born', animalId: k.id, people: [me], sig: 3, key: 'birth',
        text: `${k.name} was born to ${dam.name}${sire ? `, sired by ${sire.name}` : ''}, at ${home.label.replace(/^The /, 'the ').replace(/^A /, 'a ')}.`,
        memories: [T.memory(me, `${k.name}, a few hours old, working out what legs were for.`, `${p.firstName} was there when ${k.name} was born.`)] });
    }
    p.stats.mood = clamp(p.stats.mood + 6);
  }
}

// ---------- Checking ----------

export function auditBreeding(state = store.state) {
  const bad = [];
  for (const a of zoo.everyAnimal(state)) {
    for (const [role, id] of Object.entries(a.parents ?? {})) {
      const par = id ? zoo.animalById(id, state) : null;
      if (id && !par) { bad.push(`${a.name}: a ${role} that is not on record`); continue; }
      if (par && par.speciesId !== a.speciesId) bad.push(`${a.name}: a ${role} of another species`);
      if (par && par.born != null && a.born != null && a.born - par.born < 1) bad.push(`${a.name}: older than its ${role}`);
      if (par && ((role === 'dam' && par.sex !== 'female') || (role === 'sire' && par.sex !== 'male'))) bad.push(`${a.name}: a ${role} of the wrong sex`);
    }
    if (ancestors(a, 12, state).has(a.id)) bad.push(`${a.name}: its own ancestor`);
    const rule = BREEDING[a.speciesId];
    if ((a.litters ?? []).length && (!rule || a.litters.length > rule.most)) bad.push(`${a.name}: more litters than is allowed`);
    for (const l of a.litters ?? []) if (rule && l.young.length > rule.young[1]) bad.push(`${a.name}: a litter larger than the species has`);
    if (a.pregnancy && a.status !== 'living') bad.push(`${a.name}: expecting, but not living`);
  }
  return bad;
}
