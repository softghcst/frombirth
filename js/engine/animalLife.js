// The rest of life with animals: classes and the trainers who run them,
// behaviour that needs patience, outings and the local pet show, and the
// disagreements animals cause in families.
//
// Everything here works on the family's record (engine/animals.js) and pays
// through the one ledger (engine/animalCare.js).
import { store } from '../state.js';
import { rng } from '../rng.js';
import { clamp, cap, localCost, fmtMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { speciesOf } from '../data/animals.js';
import { makeNpc } from './npcFactory.js';
import * as zoo from './animals.js';
import * as care from './animalCare.js';

const T = zoo.tools;
const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const say = (state, text, tone = 'neutral') => { const e = { age: state.player.age, text, kind: 'system', tone }; state.journal.push(e); return e; };
const mineToRun = (a, state) => a.status === 'living' && !!state.npcs[a.id]?.alive && (care.paysFor(a, state) || !!a.foster || zoo.primaryOf(a)?.id === state.player.id);

// ---------- Classes ----------

/** Courses a training club runs. `teaches` are skills it moves on; `needs` must be learned first; `stages` the ages it takes. */
export const COURSES = {
  puppy: { name: 'Puppy class', species: ['dog'], stages: ['puppy', 'young dog'], teaches: ['name', 'sit', 'come'], cost: 140, blurb: 'Six weeks of sitting, coming back, and meeting other puppies without losing their heads.' },
  obedience: { name: 'Basic obedience', species: ['dog'], teaches: ['come', 'stay', 'leash', 'settle'], cost: 220, blurb: 'Good manners at home and on a lead, a step at a time.' },
  agility: { name: 'Agility', species: ['dog'], stages: ['young dog', 'adult'], needs: ['come', 'stay'], teaches: ['agility'], cost: 320, blurb: 'Jumps, tunnels and weaves, at speed, with a handler.' },
  scent: { name: 'Scent work', species: ['dog'], needs: ['sit'], teaches: ['scent'], cost: 260, blurb: 'Finding a hidden smell. Any dog can, and older dogs love it.' },
  clicker: { name: 'Clicker training for cats', species: ['cat'], teaches: ['carrier', 'handling', 'target'], cost: 120, blurb: 'Yes, cats can be trained. On their terms.' },
  groundwork: { name: 'Groundwork clinic', species: ['horse', 'pony', 'donkey'], teaches: ['halter', 'feet', 'groundwork', 'load'], cost: 280, blurb: 'A weekend a month with a horseman who never raises their voice.' },
};
/** Skills that are learned in a class, not at home. */
export const CLASS_SKILLS = { agility: { name: 'Agility course', learned: 'runs an agility course clear', difficulty: 3 }, scent: { name: 'Finding a hidden scent', learned: 'finds a hidden scent', difficulty: 2 } };

/** The training club in the player's city, with the trainer who runs it. */
export function club(state = store.state) {
  const P = care.places(state);
  P.clubs ??= {};
  const key = care.cityKey(state);
  if (!P.clubs[key]) {
    const { city, countryId } = state.player;
    const roll = T.seeded(`club:${key}`);
    const head = care.localName(countryId, `${key}:trainer`);
    P.clubs[key] = { id: `club:${key}`, key, city, countryId, priceK: 0.8 + roll.int(0, 5) / 10,
      name: roll.pick([`${city} Dog Training Club`, `Good Manners ${city}`, `${head.name.split(' ')[1]}'s Training School`, `The ${city} Canine Society`]),
      staff: [{ ...head, role: 'Trainer' }, { ...care.localName(countryId, `${key}:assistant`), role: 'Assistant trainer' }] };
  }
  return P.clubs[key];
}

/** What the club can offer this animal this year. */
export function coursesFor(id, state = store.state) {
  const a = zoo.animalById(id, state);
  if (!a || !mineToRun(a, state) || state.player.age < 10) return [];
  const c = COUNTRIES[state.player.countryId];
  const cl = club(state);
  const stage = zoo.stageOf(a, state);
  const learned = (k) => (a.training[k]?.progress ?? 0) >= 100;
  return Object.entries(COURSES).filter(([, x]) => x.species.includes(a.speciesId)).map(([cid, x]) => {
    const done = x.teaches.every(learned);
    const taken = (a.classes ?? []).some((k) => k.id === cid && k.year === state.year);
    const why = done ? 'Nothing left to learn here.' : taken ? 'Enrolled this year already.' : x.stages && !x.stages.includes(stage) ? `Not for ${an(stage)} ${stage}.` : (x.needs ?? []).some((k) => !learned(k)) ? `First ${zoo.pronoun(a)} must learn: ${(x.needs ?? []).filter((k) => !learned(k)).map((k) => (zoo.trainingOf(a).find((s) => s.id === k)?.name ?? k).toLowerCase()).join(', ')}.` : '';
    return { id: cid, ...x, price: localCost(x.cost * cl.priceK, c), why, ok: !why && state.player.finance.cash >= localCost(x.cost * cl.priceK, c) };
  });
}
const an = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');

/** A year of weekly classes. Several skills move on at once, faster than at home, and the trainer gets to know them. */
export function enrol(id, courseId, state = store.state) {
  const a = zoo.animalById(id, state);
  const p = state.player; const c = COUNTRIES[p.countryId];
  const offer = coursesFor(id, state).find((x) => x.id === courseId);
  if (!offer) return result(false, 'That class is not for this animal.', 'neutral');
  if (offer.why) return result(false, offer.why, 'neutral');
  if (!offer.ok) return result(false, `The course costs ${fmtMoney(offer.price, c)}. You do not have it.`, 'neutral');
  const cl = club(state);
  care.pay(state, offer.price, 'training', a.id, `class|${a.id}|${courseId}|${state.year}`);
  const trainer = care.meetStaff(cl, 0, state);
  const npc = state.npcs[a.id];
  const trust = zoo.bondOf(a, p.id) ?? 50;
  const learnedNow = [];
  for (const k of offer.teaches) {
    const t = (a.training[k] ??= { progress: 0, sessions: 0, firstYear: state.year, learnedYear: null, by: null });
    if (t.progress >= 100) continue;
    const temper = a.temperament.trainability ?? (100 - (a.temperament.independence ?? 50));
    t.progress = Math.min(100, t.progress + Math.max(10, Math.round(rng.int(30, 50) + (temper - 50) * 0.3 + (trust - 50) * 0.15)));
    t.sessions += 1; t.by = T.ref(state, trainer?.id) ?? { id: null, name: cl.staff[0].name };
    if (t.progress >= 100) { t.learnedYear = state.year; learnedNow.push(k); }
  }
  (a.classes ??= []).push({ id: courseId, year: state.year, club: cl.name });
  npc.meters.relationship = clamp(npc.meters.relationship + 4); npc.lastInteractionAge = p.age;
  const names = learnedNow.map((k) => (CLASS_SKILLS[k]?.learned ?? zoo.trainingOf(a).find((s) => s.id === k)?.learned ?? k));
  const finished = offer.teaches.every((k) => (a.training[k]?.progress ?? 0) >= 100);
  const text = `A year of ${offer.name.toLowerCase()} at ${cl.name} with ${cl.staff[0].name.split(' ')[0]}${names.length ? `. ${a.name} now ${names.join(', and ')}` : `. ${a.name} is getting there`}. It cost ${fmtMoney(offer.price, c)}.`;
  const entry = say(state, text, 'good');
  if (finished) {
    T.record(state, { type: 'trained', animalId: a.id, people: [T.ref(state, p.id), trainer ? T.ref(state, trainer.id) : null], sig: 2, key: `class:${courseId}`, storyEntry: entry,
      text: `${a.name} finished ${offer.name.toLowerCase()} at ${cl.name}, trained by ${cl.staff[0].name}.`,
      memories: [T.memory(T.ref(state, p.id), `${a.name}'s certificate from ${cl.name}, which you pretended not to be proud of.`, `${p.firstName} took ${a.name} through ${offer.name.toLowerCase()}.`)] });
  }
  return result(true, text, 'good');
}

// ---------- Behaviour ----------

/**
 * Things an animal can find hard. None makes it a bad animal; each gets better with the right help,
 * slowly, and worse if met with anger. `who` decides which animals can have it, from their temperament.
 */
export const BEHAVIOURS = {
  separation: { name: 'Distress when left alone', text: 'howls and scratches at the door whenever the house is empty', species: ['dog'], who: (t) => (t.affection ?? 50) > 70 && (t.adaptability ?? 50) < 45 },
  chewing: { name: 'Chewing things', text: 'has chewed a chair leg, a shoe and the corner of a rug', species: ['dog'], young: true, who: (t) => (t.activity ?? 50) > 65 },
  scratching: { name: 'Scratching the furniture', text: 'has shredded the side of the sofa', species: ['cat'], who: (t) => (t.activity ?? 50) > 60 },
  excitement: { name: 'Over-excitement with visitors', text: 'flings themselves at every visitor, and knocked a small child over', species: ['dog'], who: (t) => (t.activity ?? 50) > 70 && (t.sociability ?? 50) > 65 },
  handling: { name: 'Fear of being handled', text: 'panics when picked up, brushed or examined', species: ['dog', 'cat', 'rabbit', 'guinea_pig', 'ferret', 'parrot', 'horse', 'pony'], who: (t) => (t.confidence ?? 50) < 30 },
  biting: { name: 'Nipping when overwhelmed', text: 'has started nipping when things get too much', species: ['parrot', 'ferret', 'rabbit'], who: (t) => (t.sensitivity ?? 50) > 70 },
};
/** Help for a behaviour problem: how much it moves things on, what it costs, and whether it hurts trust. */
export const HELP = {
  trainer: { name: 'A qualified behaviorist', gain: 45, cost: 220, trust: 4 },
  vet: { name: 'A vet\'s check for pain or illness behind it', gain: 25, cost: 90, trust: 2 },
  environment: { name: 'Change the house: safe spaces, routine, things to do', gain: 30, cost: 60, trust: 3 },
  time: { name: 'Patience, and gentle practice', gain: 18, cost: 0, trust: 2 },
  scold: { name: 'Tell them off', gain: -15, cost: 0, trust: -12 },
};
/** An animal's behaviour problem, if it has one, as the player would see it. */
export const behaviourOf = (a) => (a.behaviour && !a.behaviour.resolved ? { ...a.behaviour, ...BEHAVIOURS[a.behaviour.id] } : null);
/** Help with a behaviour problem: chosen in the scene, or from the profile once a year. */
export function helpWith(id, how, state = store.state) {
  const a = zoo.animalById(id, state);
  const b = a && behaviourOf(a);
  const h = HELP[how];
  const p = state.player; const c = COUNTRIES[p.countryId];
  if (!b || !h) return result(false, 'There is nothing to help with.', 'neutral');
  if (a.behaviour.helpedYear === state.year) return result(false, `You have already worked on this with ${a.name} this year.`, 'neutral');
  const cost = h.cost ? localCost(h.cost, c) : 0;
  if (cost && p.finance.cash < cost) return result(false, `That costs ${fmtMoney(cost, c)}. You do not have it.`, 'neutral');
  if (cost) care.pay(state, cost, 'behaviour', a.id, `behaviour|${a.id}|${state.year}`);
  if (how === 'trainer') care.meetStaff(club(state), 0, state);
  a.behaviour.helpedYear = state.year;
  a.behaviour.progress = clamp(a.behaviour.progress + h.gain + rng.int(-5, 8));
  (a.behaviour.tried ??= []).push({ year: state.year, how });
  zoo.nudgeBond(a, p.id, { trust: h.trust, value: h.trust > 0 ? 2 : -4 });
  if (state.npcs[a.id]) state.npcs[a.id].meters.relationship = clamp(state.npcs[a.id].meters.relationship + (h.trust > 0 ? 2 : -6));
  let text;
  if (a.behaviour.progress >= 100) {
    a.behaviour.resolved = state.year;
    text = `${a.name} is past it. It took ${state.year - a.behaviour.since || 1} ${state.year - a.behaviour.since > 1 ? 'years' : 'year'}, and nobody remembers quite when it stopped.`;
    T.record(state, { type: 'trained', animalId: a.id, people: [T.ref(state, p.id)], sig: 2, key: `behaviour:${a.behaviour.id}`, story: text, tone: 'good',
      text: `${a.name} got past ${b.name.toLowerCase()}, with ${HELP[how].name.toLowerCase()}.`,
      memories: [T.memory(T.ref(state, p.id), `How long it took ${a.name}, and how worth it it was.`, `${p.firstName} stuck with ${a.name} through it.`)] });
  } else text = how === 'scold' ? `You told ${a.name} off. It did not help: ${zoo.pronoun(a)} is warier of you now, and no better.` : `${cap(h.name)}. ${a.name} is a little better: about ${a.behaviour.progress}% of the way.`;
  if (!a.behaviour.resolved) say(state, text, how === 'scold' ? 'bad' : 'neutral');
  return result(true, text, how === 'scold' ? 'bad' : 'neutral');
}

// ---------- Outings ----------

/** Things to do with an animal, beyond everyday care. Once each a year. */
export const OUTINGS = {
  dog: [{ id: 'park', label: 'Go to the dog park', text: 'You took {name} to the dog park. {They} ran until {they} could not, then lay at your feet.', meet: 0.35 },
    { id: 'beach', label: 'A day out in the country', text: 'You took {name} somewhere new. {They} smelled every bit of it.' }],
  cat: [{ id: 'puzzle', label: 'Make a puzzle feeder', text: 'You made {name} a puzzle feeder from a box. It was solved, ignored, then slept in.' }],
  rabbit: [{ id: 'garden', label: 'Supervised time in the garden', text: '{name} did a series of leaps in the air for no reason anyone could see.' }],
  guinea_pig: [{ id: 'garden', label: 'Time on the grass in a run', text: '{name} ate the lawn, one blade at a time, with enormous concentration.' }],
  parrot: [{ id: 'shred', label: 'A morning of shredding', text: 'You gave {name} an old phone book. There is no phone book now.' }],
  horse: [{ id: 'trail', label: 'A long trail ride', text: 'You and {name} went out for the whole day, and came back muddy and quiet.', rider: true }],
  pony: [{ id: 'trail', label: 'A long trail ride', text: 'You and {name} went out for the whole day, and came back muddy and quiet.', rider: true }],
  goat: [{ id: 'walk', label: 'Take them for a walk on a lead', text: 'You walked {name} round the field. {They} walked you, mostly.' }],
};
export function outingsFor(id, state = store.state) {
  const a = zoo.animalById(id, state);
  const p = state.player;
  if (!a || a.status !== 'living' || !state.npcs[a.id]?.alive || p.age < 6 || p.legal?.incarceration) return [];
  const here = zoo.livesWithPlayer(a.id, state) || mineToRun(a, state);
  if (!here) return [];
  return (OUTINGS[a.speciesId] ?? []).filter((o) => !o.rider || (p.riding && (a.training.saddle?.progress ?? 0) >= 100)).map((o) => ({ ...o, done: (a.outings ?? []).some((x) => x.id === o.id && x.year === state.year) }));
}
export function outing(id, outingId, state = store.state) {
  const a = zoo.animalById(id, state);
  const o = outingsFor(id, state).find((x) => x.id === outingId);
  const p = state.player;
  if (!o) return result(false, 'You cannot do that with this animal.', 'neutral');
  if (o.done) return result(false, `You have already done that with ${a.name} this year.`, 'neutral');
  (a.outings ??= []).push({ id: o.id, year: state.year });
  const npc = state.npcs[a.id];
  npc.meters.relationship = clamp(npc.meters.relationship + rng.int(3, 7)); npc.meters.health = clamp(npc.meters.health + 1); npc.lastInteractionAge = p.age;
  zoo.nudgeBond(a, p.id, { value: 0, comfort: 2 });
  p.stats.mood = clamp(p.stats.mood + 3);
  const they = zoo.pronoun(a);
  let text = o.text.replace('{name}', a.name).replace('{They}', cap(they)).replace(/\{they\}/g, they);
  // The same faces at the park: one of them becomes someone you know.
  if (o.meet && p.age >= 14 && !p.npcIds.some((x) => state.npcs[x]?.flags.tag === 'dogpark') && rng.chance(o.meet)) {
    const n = makeNpc({ role: 'friend', countryId: p.countryId, age: clamp(p.age + rng.int(-10, 15), 14, 85), relationship: 45 });
    n.flags.tag = 'dogpark'; n.flags.title = 'Friend from the dog park'; state.npcs[n.id] = n; p.npcIds.push(n.id);
    text += ` ${n.firstName} ${n.lastName} was there with a dog of their own. You have started to look out for each other.`;
  }
  say(state, text, 'good');
  return result(true, text, 'good');
}

// ---------- The local pet show ----------

const SHOW_CLASSES = { dog: ['Waggiest tail', 'Best rescue', 'Dog the judge would most like to take home'], cat: ['Most handsome cat', 'Best rescue'], rabbit: ['Best in show: small animals'], guinea_pig: ['Best in show: small animals'], other: ['Best rescue'] };
/** A village-fete pet show, once a year: for fun, not money. */
export function petShow(state = store.state) {
  const P = care.places(state);
  P.fetes ??= {};
  const key = `${care.cityKey(state)}:${state.year}`;
  if (!P.fetes[key]) {
    const roll = T.seeded(`fete:${key}`);
    P.fetes[key] = { id: `fete:${key}`, year: state.year, name: `The ${state.player.city} ${roll.pick(['Summer Fair', 'Community Day', 'Village Fête', 'Animal Fun Day'])} pet show`, judge: care.localName(state.player.countryId, `fete:${key}:judge`).name, entries: {} };
  }
  return P.fetes[key];
}
export function enterPetShow(id, state = store.state) {
  const a = zoo.animalById(id, state);
  const p = state.player; const c = COUNTRIES[p.countryId];
  const show = petShow(state);
  if (!a || !zoo.livesWithPlayer(a.id, state) || !state.npcs[a.id]?.alive || speciesOf(a.speciesId).group !== 'companion' || a.speciesId === 'fish') return result(false, 'That animal cannot be entered.', 'neutral');
  if (show.entries[a.id]) return result(false, `${a.name} has already been entered this year.`, 'neutral');
  const fee = localCost(5, c);
  care.pay(state, Math.min(fee, Math.max(0, p.finance.cash)), 'pet show', a.id, `fete|${show.id}|${a.id}`);
  const roll = T.seeded(`${show.id}:${a.id}`);
  const classes = SHOW_CLASSES[a.speciesId] ?? SHOW_CLASSES.other;
  const cls = a.origin?.how === 'shelter' && classes.includes('Best rescue') && roll.chance(0.5) ? 'Best rescue' : roll.pick(classes);
  const bond = state.npcs[a.id].meters.relationship;
  const learned = zoo.trainingOf(a).filter((s) => s.progress >= 100).length;
  const place = Math.max(1, Math.min(8, Math.round(8 - (bond / 25) - learned * 0.6 - ((a.temperament.sociability ?? 50) - 50) / 25 + roll.int(-2, 2))));
  show.entries[a.id] = { cls, place };
  const text = place === 1 ? `${a.name} won '${cls}' at ${show.name}. The rosette is bigger than ${zoo.pronoun(a, 'their')} head.`
    : place <= 3 ? `${a.name} came ${['', 'first', 'second', 'third'][place]} in '${cls}' at ${show.name}.` : `${a.name} was entered in '${cls}' at ${show.name}, and was more interested in the other animals than the judge.`;
  const entry = say(state, text, place <= 3 ? 'good' : 'neutral');
  if (place <= 3) T.record(state, { type: 'achievement', animalId: a.id, people: [T.ref(state, p.id)], sig: place === 1 ? 2 : 1, key: show.id, storyEntry: entry, text: `${a.name} placed ${place} in '${cls}' at ${show.name}, judged by ${show.judge}.` });
  p.stats.mood = clamp(p.stats.mood + (place === 1 ? 6 : 2));
  return result(true, text, place <= 3 ? 'good' : 'neutral');
}

// ---------- Families and their animals ----------

/**
 * When a marriage or a partnership ends, someone has to decide where the animals go.
 * 'keep'   they stay with the player                  'give'   they go with the ex, who becomes their owner
 * 'share'  they stay with the player, and the ex keeps seeing them
 */
export function custody(id, exId, choice, state = store.state) {
  const a = zoo.animalById(id, state);
  const ex = state.npcs[exId];
  const p = state.player;
  if (!a || !ex || a.status !== 'living') return result(false, 'There is nothing to decide.', 'neutral');
  const exRef = T.ref(state, exId); const me = T.ref(state, p.id);
  const theirs = zoo.bondOf(a, exId) ?? 50; const mine = state.npcs[a.id]?.meters.relationship ?? 50;
  delete a.custody;
  if (choice === 'give') {
    T.setOwner(state, a, exRef, 'went with them after the break-up'); T.setPrimary(state, a, exRef, 'the break-up');
    T.setHome(state, a, T.homeWith(state, exRef));
    ex.meters.relationship = clamp(ex.meters.relationship + 10);
    p.stats.mood = clamp(p.stats.mood - Math.round(mine / 10));
    T.record(state, { type: 'care', animalId: a.id, people: [me, exRef], sig: 3, key: `custody:${exId}`, story: `${a.name} went with ${ex.firstName}.`,
      text: `When ${me.name} and ${exRef.name} separated, ${a.name} went with ${exRef.name}.`,
      memories: [T.memory(me, `Letting ${a.name} go with ${ex.firstName} was the one thing about the break-up you both agreed on.`, `${p.firstName} let ${a.name} go with ${ex.firstName}.`)] });
    return result(true, `${a.name} goes with ${ex.firstName}. ${theirs > mine ? 'It was the right call, and you both know it.' : 'You will miss the weight of them on the bed.'}`, 'neutral');
  }
  if (choice === 'share') {
    a.visits = { who: exRef, since: state.year };
    ex.meters.relationship = clamp(ex.meters.relationship + 6);
    T.record(state, { type: 'care', animalId: a.id, people: [me, exRef], sig: 2, key: `custody:${exId}`, story: `${a.name} stays with you; ${ex.firstName} has ${zoo.pronoun(a, 'them')} every other weekend.`,
      text: `When ${me.name} and ${exRef.name} separated, ${a.name} stayed with ${me.name}, and went on seeing ${exRef.name}.` });
    return result(true, `${a.name} stays with you, and sees ${ex.firstName} every other weekend. It is the most civil arrangement of the whole business.`, 'good');
  }
  ex.meters.relationship = clamp(ex.meters.relationship - (theirs >= 60 ? 12 : 4));
  T.record(state, { type: 'care', animalId: a.id, people: [me, exRef], sig: 2, key: `custody:${exId}`, story: `${a.name} stays with you.`, text: `When ${me.name} and ${exRef.name} separated, ${a.name} stayed with ${me.name}.` });
  return result(true, theirs >= 60 ? `${a.name} stays with you. ${ex.firstName} does not take it well.` : `${a.name} stays with you.`, 'neutral');
}

/** A choice made in one of the scenes in data/events/animals.js that belongs to this file. */
export function lifeChoice(v, cast, state = store.state) {
  if (v.do === 'custody') return custody(cast.pet, cast.ex, v.choice, state).text;
  if (v.do === 'behaviour') return helpWith(cast.pet, v.how, state).text;
  if (v.do === 'chores') {
    const a = zoo.animalById(cast.pet, state); const sib = state.npcs[cast.sib];
    const p = state.player;
    if (!a || !sib) return '';
    if (v.who === 'me') { zoo.nudgeBond(a, p.id, { value: 4, trust: 2 }); p.hidden.discipline = clamp(p.hidden.discipline + 3); return `${a.name} has opinions about the new walking schedule, all of them good.`; }
    if (v.who === 'rota') { sib.meters.relationship = clamp(sib.meters.relationship + 4); zoo.nudgeBond(a, p.id, { value: 2 }); return 'The rota goes on the fridge. It lasts, mostly.'; }
    sib.meters.relationship = clamp(sib.meters.relationship - 6); zoo.nudgeBond(a, p.id, { value: -3 });
    return `${sib.firstName} does it, and makes sure everyone knows.`;
  }
  return '';
}

// ---------- The year ----------

/** Yearly. Behaviour problems that begin, and scenes that a family's situation calls for. Runs once for each year. */
export function tickLife(state = store.state) {
  const A = zoo.ensure(state);
  if (A.lifeYear === state.year) return;
  A.lifeYear = state.year;
  const p = state.player;
  if (!p.alive || p.legal?.incarceration) return;
  const waiting = new Set(state.pendingEvents.map((e) => e.id));
  const queue = (id, cast) => { if (!waiting.has(id)) { state.pendingEvents.push({ id, cast }); waiting.add(id); } };
  for (const a of zoo.allAnimals(state)) {
    if (!mineToRun(a, state) || !zoo.livesWithPlayer(a.id, state)) continue;
    const roll = T.seeded(`${a.id}:behavior:${state.year}`);
    // A behaviour problem starts at most once, early in an animal's time with the family, and only if its nature leans that way.
    if (!a.behaviour && state.year - (a.homes.find((h) => h.hh !== 'shelter' && h.hh !== 'stable')?.from ?? state.year) <= 3) {
      const fits = Object.entries(BEHAVIOURS).filter(([, b]) => b.species.includes(a.speciesId) && b.who(a.temperament) && (!b.young || ['puppy', 'young dog'].includes(zoo.stageOf(a, state))));
      if (fits.length && roll.chance(0.45)) a.behaviour = { id: roll.pick(fits)[0], since: state.year, progress: 0 };
    }
    const b = behaviourOf(a);
    if (b && b.since === state.year && p.age >= 14) queue('animal_behaviour', { pet: a.id, words: { problem: b.text } });
  }
  // A break-up: someone has to decide about the animals they loved too.
  for (const a of zoo.allAnimals(state)) {
    if (!mineToRun(a, state)) continue;
    const ex = a.care.find((c) => c.to === state.year && c.ended === 'left the household' && state.npcs[c.who.id]?.role === 'ex');
    if (ex && (zoo.bondOf(a, ex.who.id) ?? 0) >= 50 && !a.custodyDone?.[ex.who.id]) {
      (a.custodyDone ??= {})[ex.who.id] = true;
      queue('animal_custody', { pet: a.id, ex: ex.who.id });
      break;
    }
  }
  // Children at home argue about whose turn it is.
  if (p.age >= 9 && p.age <= 17 && p.flags.livesWithParents) {
    const dog = zoo.householdAnimals(state).find((a) => a.speciesId === 'dog');
    const sib = T.livingBy(state, ['sibling']).find((n) => n.age >= 7 && n.age <= 20);
    const seen = state.eventHistory.find((h) => h.id === 'whose_turn')?.lastAge ?? -99;
    if (dog && sib && p.age - seen >= 4 && T.seeded(`turn:${p.id}:${state.year}`).chance(0.35)) queue('whose_turn', { pet: dog.id, sib: sib.id });
  }
}
