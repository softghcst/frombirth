// Stories that take years: arcs that follow the real state of an animal and
// its family, and bring a scene at each turn. Nothing here invents an animal
// or an event: an arc begins only when the record shows it has begun.
//
//   state.animals.arcs[key] = { type, animalId, stage, started, done }
//
//   first      a child's first animal: learning to look after it
//   settling   a nervous rescue, over its first years in a new home
//   training   from a first lesson to a well-taught animal
//   bond       years of closeness, noticed
//   riding     a rider ready for the show ring, whose instructor says so
//   retiring   an older horse, and when to stop asking
//   remember   a year after a much-loved animal died
import { store } from '../state.js';
import { clamp, cap } from '../util.js';
import * as zoo from './animals.js';
import * as care from './animalCare.js';
import * as horse from './equestrian.js';

const T = zoo.tools;
const say = (state, text, tone = 'neutral') => { const e = { age: state.player.age, text, kind: 'system', tone }; state.journal.push(e); return e; };
const arcs = (state) => { const A = zoo.ensure(state); return (A.arcs ??= {}); };
const living = (a, state) => a.status === 'living' && !!state.npcs[a.id]?.alive;

/** The arcs running for an animal, and those it has finished. */
export const arcsOf = (id, state = store.state) => Object.values(arcs(state)).filter((x) => x.animalId === id);
export const ARC_NAMES = { first: 'First pet', settling: 'Rescue and adoption', training: 'Training journey', bond: 'Lifelong bond', riding: 'Equestrian development', retiring: 'An older horse', remember: 'Remembrance' };

function begin(state, type, a, extra = {}) {
  const key = `${type}:${a.id}`;
  const all = arcs(state);
  if (all[key]) return null;
  all[key] = { key, type, animalId: a.id, stage: 0, started: state.year, done: null, ...extra };
  return all[key];
}
const finish = (arc, state) => { arc.done = state.year; };

/** Yearly. Starts arcs the record calls for, and moves running ones on. At most two arc scenes a year. */
export function tickArcs(state = store.state) {
  const A = zoo.ensure(state);
  if (A.arcYear === state.year) return;
  A.arcYear = state.year;
  const p = state.player;
  if (!p.alive || p.legal?.incarceration) return;
  const all = arcs(state);
  const waiting = new Set(state.pendingEvents.map((e) => e.id));
  let budget = 2;
  const queue = (id, cast) => { if (budget > 0 && !waiting.has(id)) { state.pendingEvents.push({ id, cast }); waiting.add(id); budget -= 1; return true; } return false; };
  const me = T.ref(state, p.id);

  for (const a of zoo.allAnimals(state)) {
    const npc = state.npcs[a.id];
    const since = a.homes.find((h) => !['shelter', 'yard', 'breeder', 'stable'].includes(h.hh))?.from ?? a.firstSeenYear;
    // A child's first animal.
    if (living(a, state) && p.age <= 14 && p.age >= 6 && zoo.livesWithPlayer(a.id, state) && since === state.year - 1 && !Object.values(all).some((x) => x.type === 'first')) {
      const arc = begin(state, 'first', a);
      if (arc && queue('arc_first_pet', { pet: a.id })) arc.stage = 1;
    }
    // A nervous rescue.
    if (living(a, state) && a.origin?.how === 'shelter' && (a.temperament.confidence ?? 50) < 45 && zoo.livesWithPlayer(a.id, state)) {
      const arc = begin(state, 'settling', a, { started: since });
      const live = arc ?? all[`settling:${a.id}`];
      if (!live.done) {
        const trust = zoo.bondDetail(a, p.id)?.trust ?? 40;
        if (live.stage === 0 && state.year - live.started >= 1 && p.age >= 12) { if (queue('arc_rescue_nervous', { pet: a.id })) live.stage = 1; } else if (live.stage >= 1 && (trust >= 60 || state.year - live.started >= 4)) {
          finish(live, state);
          T.record(state, { type: 'settled', animalId: a.id, people: [me], sig: 2, key: 'settled', story: `${a.name} has stopped flinching at the door. ${cap(zoo.pronoun(a))} lives here now, in every sense.`, tone: 'good',
            text: `${a.name}, a nervous rescue, settled into the household after ${state.year - since} years.`,
            memories: [T.memory(me, `The first time ${a.name} came to you without being called.`, `${p.firstName} remembered the first time ${a.name} came to them uncalled.`)] });
        }
      }
    }
    // Training, from the first lesson to a well-taught animal.
    const learned = zoo.trainingOf(a).filter((s) => s.progress >= 100).length;
    if (learned >= 1) begin(state, 'training', a);
    const tr = all[`training:${a.id}`];
    if (tr && !tr.done && learned >= Math.min(4, zoo.trainingOf(a).filter((s) => !s.classOnly).length) && learned >= 3) {
      finish(tr, state);
      T.record(state, { type: 'achievement', animalId: a.id, people: [me], sig: 2, key: 'training-journey', story: `${a.name} has come a long way since the first lesson.`, tone: 'good', text: `${a.name} completed a training journey that began in ${tr.started}: ${learned} things learned.` });
    }
    // Years of closeness.
    const b = zoo.bondDetail(a, p.id);
    if (living(a, state) && b && b.value >= 85 && (b.comfort ?? 0) >= 60 && state.year - since >= 8) {
      const arc = begin(state, 'bond', a);
      if (arc) {
        finish(arc, state);
        T.record(state, { type: 'bond', animalId: a.id, people: [me], sig: 3, key: 'lifelong', story: `It occurs to you that ${a.name} has been beside you for ${state.year - since} years.`, tone: 'good',
          text: `${a.name} and ${me.name}: ${state.year - since} years together, and as close as an animal and a person get.`,
          memories: [T.memory(me, `${a.name}, asleep against your feet, as ${zoo.pronoun(a)} has been for years.`, `${p.firstName} and ${a.name} were inseparable.`)] });
      }
    }
    // An older horse, still being asked for the show ring.
    if (living(a, state) && ['horse', 'pony'].includes(a.speciesId) && care.paysFor(a, state) && (a.competitions ?? []).length && zoo.stageOf(a, state) === 'senior') {
      const arc = begin(state, 'retiring', a);
      if (arc && queue('arc_retire_horse', { pet: a.id })) arc.stage = 1;
    }
    // A year after a much-loved animal died.
    if (a.status === 'deceased' && a.died === state.year - 1 && (zoo.bondOf(a, p.id) ?? a.lastBond ?? 0) >= 70 && p.age >= 6) {
      const arc = begin(state, 'remember', a);
      if (arc && queue('arc_remembrance', { pet: a.id, words: { pet: a.name, kind: speciesName(a) } })) arc.stage = 1;
      else if (arc) finish(arc, state);
    }
    if (!npc) continue;
  }
  // A rider ready for the ring, whose instructor says so.
  const r = p.riding;
  if (r && r.lessons >= 3 && horse.riderLevel(state) >= 32 && !r.record.length && !all['riding:rider']) {
    const sc = horse.school(state);
    const teacher = state.npcs[sc.instructorNpc];
    if (teacher?.alive) { all['riding:rider'] = { key: 'riding:rider', type: 'riding', animalId: r.schoolHorse ?? null, stage: 1, started: state.year, done: null }; queue('arc_instructor_suggests', { teacher: teacher.id }); }
  }
}
const speciesName = (a) => ({ guinea_pig: 'guinea pig', leopard_gecko: 'gecko', bearded_dragon: 'dragon', corn_snake: 'snake' }[a.speciesId] ?? a.speciesId);

/** A choice made in one of the arc scenes. */
export function arcChoice(v, cast, state = store.state) {
  const p = state.player;
  const a = cast.pet ? zoo.animalById(cast.pet, state) : null;
  const me = T.ref(state, p.id);
  if (v.do === 'first') {
    const arc = arcs(state)[`first:${a?.id}`];
    if (arc) finish(arc, state);
    if (!a) return '';
    if (v.how === 'chores') {
      zoo.nudgeBond(a, p.id, { value: 6, trust: 6 }); p.hidden.discipline = clamp(p.hidden.discipline + 4);
      T.record(state, { type: 'trained', animalId: a.id, people: [me], sig: 2, key: 'first-pet', pending: true, text: `${me.name} learned to look after ${a.name}: feeding, cleaning, and remembering.`,
        memories: [T.memory(me, `Being trusted with ${a.name}'s breakfast felt like being trusted with something important. It was.`, `${p.firstName} took looking after ${a.name} seriously.`)] });
      return '';
    }
    zoo.nudgeBond(a, p.id, { value: 1 });
    return '';
  }
  if (v.do === 'settle' && a) { zoo.nudgeBond(a, p.id, { trust: v.how === 'space' ? 14 : v.how === 'routine' ? 11 : 6, comfort: 6 }); return ''; }
  if (v.do === 'retire' && a) {
    const arc = arcs(state)[`retiring:${a.id}`]; if (arc) finish(arc, state);
    if (v.how === 'retire') {
      a.retired = state.year;
      T.record(state, { type: 'retired', animalId: a.id, people: [me], sig: 2, key: 'retired', pending: true, text: `${a.name} retired from competition after ${(a.competitions ?? []).length} ${((a.competitions ?? []).length === 1) ? 'show' : 'shows'}, to hack quietly and graze.` });
    }
    return '';
  }
  if (v.do === 'remember' && a) {
    const arc = arcs(state)[`remember:${a.id}`]; if (arc) finish(arc, state);
    if (v.how === 'memorial' && !a.memorial) zoo.memorialize(a.id, state);
    else T.record(state, { type: 'memorial', animalId: a.id, people: [me], sig: 2, key: `year:${state.year}`, pending: true, text: `A year after ${a.name} died, ${me.name} ${v.how === 'photos' ? 'went through the photographs' : 'went back to the places they used to walk'}.`,
      memories: [T.memory(me, v.how === 'photos' ? `The photograph of ${a.name} you had forgotten you took.` : `The walk, without ${a.name}, that was still ${a.name}'s walk.`, `${p.firstName} still thought of ${a.name}.`)] });
    p.stats.mood = clamp(p.stats.mood + 3);
    return '';
  }
  if (v.do === 'compete') {
    const arc = arcs(state)['riding:rider']; if (arc) finish(arc, state);
    if (v.how !== 'yes') return '';
    const show = horse.shows(state).find((s) => s.level === 'intro' && !s.result);
    const mount = horse.mounts(state)[0];
    if (!show || !mount) return 'There is no class you can ride in this year. Next year, then.';
    const r = horse.enterShow(show.id, mount.id, state);
    return r.ok ? r.text : r.text;
  }
  return '';
}
