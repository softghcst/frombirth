// Riding: schools and the people who teach in them, a rider's own skills,
// buying and keeping a horse, schooling it, and competing on it.
//
// A horse is not a large dog. It lives at a yard or on land, never in a
// house; it is taught by someone who knows horses; and what the two of them
// can do together depends on both of them.
//
//   player.riding                       the rider: skills, disciplines, lessons taken, results
//   state.animals.places.schools[city]  a riding school: its instructor, and its own horses (real records it owns)
//   state.animals.places.stables[city]  a livery yard: its manager, what it charges, and the horses for sale there
//   state.animals.places.shows[city]    the year's competitions, each run once and kept
import { store } from '../state.js';
import { rng } from '../rng.js';
import { clamp, cap, localCost, fmtMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { SPECIES, speciesOf, RIDER_SKILLS, RIDER_LEVELS, DISCIPLINES, SHOW_LEVELS, LESSON_COST, LIVERY_COST } from '../data/animals.js';
import { makeNpc } from './npcFactory.js';
import * as zoo from './animals.js';
import * as care from './animalCare.js';

const T = zoo.tools;
const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const say = (state, text, tone = 'neutral') => { const e = { age: state.player.age, text, kind: 'system', tone }; state.journal.push(e); return e; };
const isEquine = (a) => speciesOf(a.speciesId).group === 'equine';

// ---------- The rider ----------

export function rider(state = store.state) {
  const p = state.player;
  p.riding ??= { skills: Object.fromEntries(Object.keys(RIDER_SKILLS).map((k) => [k, 0])), disciplines: {}, lessons: 0, since: null, record: [], falls: 0, lastLessonAge: null, lastRideAge: null };
  return p.riding;
}
/** Whether the player has ever sat on a horse. */
export const rides = (state = store.state) => !!state.player.riding?.lessons;
const CORE = ['balance', 'seat', 'reins', 'confidence'];
export function riderLevel(state = store.state) {
  const r = state.player.riding;
  return r ? Math.round(CORE.reduce((s, k) => s + r.skills[k], 0) / CORE.length) : 0;
}
export const levelName = (level) => [...RIDER_LEVELS].reverse().find(([min]) => level >= min)[1];
/** How good the rider is at one way of riding: mostly the skills it leans on, partly time spent at it. */
export function disciplineSkill(id, state = store.state) {
  const r = state.player.riding;
  if (!r) return 0;
  const base = Object.entries(DISCIPLINES[id].needs).reduce((s, [k, w]) => s + r.skills[k] * w, 0);
  return Math.round(base * 0.65 + (r.disciplines[id] ?? 0) * 0.35);
}

// ---------- Places ----------

/** The riding school in the player's city, with its instructor and its own horses. */
export function school(state = store.state) {
  const P = care.places(state);
  const key = care.cityKey(state);
  if (!P.schools[key]) {
    const { city, countryId } = state.player;
    const roll = T.seeded(`school:${key}`);
    const teacher = care.localName(countryId, `${key}:instructor`);
    const sc = { id: `school:${key}`, key, city, countryId, hh: 'stable', name: roll.pick([`${city} Riding School`, `${teacher.name.split(' ')[1]} Equestrian Centre`, `Hollow Farm Riding School, ${city}`, `The ${city} Riding Club`]),
      priceK: 0.8 + roll.int(0, 6) / 10, instructor: { ...teacher, years: roll.int(6, 30) }, instructorNpc: null, founded: state.year - roll.int(5, 50) };
    P.schools[key] = sc;
    // The school's own horses: steady, well-schooled, and used to beginners.
    for (let i = 0; i < 4; i++) {
      const r = T.seeded(`${sc.id}:horse:${i}`);
      const sp = SPECIES[i === 0 ? 'pony' : 'horse'];
      const lifespan = r.int(sp.lifespan[0], sp.lifespan[1]);
      const a = zoo.register({ id: `an_${T.hash(`${sc.id}:${i}`).toString(36)}s${i}`, firstName: sp.names[(T.hash(sc.id) + i * 3) % sp.names.length], species: sp.id, age: r.int(9, 19), lifespan, alive: true, meters: { relationship: 50 } },
        { state, stock: sc, origin: 'bought', papers: true, history: 'A school horse: patient with beginners, and wise to them.' });
      a.school = sc.id;
      a.temperament.confidence = Math.max(a.temperament.confidence, 60); a.temperament.sensitivity = Math.min(a.temperament.sensitivity, 45);
      for (const s of sp.training) a.training[s.id] = { progress: 100, sessions: 3, firstYear: a.born + 3, learnedYear: a.born + 5, by: { id: null, name: teacher.name } };
      a.schooling = { hacking: r.int(55, 85), dressage: r.int(40, 75), jumping: r.int(35, 70) };
    }
  }
  return P.schools[key];
}
export const schoolHorses = (sc = school(), state = store.state) => zoo.everyAnimal(state).filter((a) => a.school === sc.id && a.status === 'living' && zoo.homeOf(a)?.key === sc.id);

/** The livery yard in the player's city: where a horse without land of its own lives, and where horses are sold. */
export function stable(state = store.state) {
  const P = care.places(state);
  const key = care.cityKey(state);
  if (!P.stables[key]) {
    const { city, countryId } = state.player;
    const roll = T.seeded(`stable:${key}`);
    const boss = care.localName(countryId, `${key}:yard`);
    P.stables[key] = { id: `stable:${key}`, key, city, countryId, hh: 'yard', name: roll.pick([`${city} Livery Stables`, `Brook Farm Livery, ${city}`, `${boss.name.split(' ')[1]}'s Yard`, `Long Meadow Stables, ${city}`]),
      feeK: 0.8 + roll.int(0, 6) / 10, staff: [{ ...boss, role: 'Yard manager' }, { ...care.localName(countryId, `${key}:groom`), role: 'Head groom' }, { ...care.localName(countryId, `${key}:farrier`), role: 'Farrier' }],
      saleYear: null, seq: 0 };
  }
  return P.stables[key];
}
export const liveryFee = (state = store.state) => localCost(LIVERY_COST * stable(state).feeK, COUNTRIES[state.player.countryId]);

/** The horses for sale at the yard this year. The same ones on every visit, until they are sold. */
export function horsesForSale(state = store.state) {
  const st = stable(state);
  const A = zoo.ensure(state);
  const there = () => zoo.everyAnimal(state).filter((a) => a.forSale && a.status === 'living' && !a.inCircle && zoo.homeOf(a)?.key === st.id);
  if (st.saleYear !== state.year) {
    for (const a of there()) if (st.saleYear != null && T.seeded(`${a.id}:${state.year}`).chance(0.45) && a.family === false) delete A.byId[a.id];
    for (let guard = 0; there().length < 4 && guard < 12; guard++) {
      const r = T.seeded(`${st.id}:${state.year}:${++st.seq}`);
      const sp = SPECIES[r.weighted([['horse', 7], ['pony', 3]], (x) => x[1])[0]];
      const lifespan = r.int(sp.lifespan[0], sp.lifespan[1]);
      const age = r.weighted([[3, 2], [6, 4], [10, 4], [15, 3], [21, 1]], (x) => x[1])[0] + r.int(0, 2);
      const taken = new Set(there().map((x) => x.name));
      const a = zoo.register({ id: `an_${T.hash(`${st.id}:${st.seq}`).toString(36)}y${st.seq}`, firstName: r.pick(sp.names.filter((n) => !taken.has(n)).concat(sp.names).slice(0, 6)), species: sp.id, age, lifespan, alive: true, meters: { relationship: 50 } },
        { state, stock: st, origin: 'bought', papers: r.chance(0.6), history: r.pick(['Outgrown by a rider who has gone to university.', 'For sale through no fault of their own: the owner has given up riding.', 'Bred here at the yard.', 'A former riding-school horse.', 'Sold on by a competition yard as not quite fast enough.']) });
      a.forSale = true;
      // How far its education has got depends on its age and on the horse.
      const done = age <= 4 ? 1 : age <= 6 ? 3 : sp.training.length;
      sp.training.slice(0, done).forEach((s) => { a.training[s.id] = { progress: 100, sessions: 2, firstYear: a.born + 2, learnedYear: a.born + 3, by: { id: null, name: 'a previous owner' } }; });
      if (done < sp.training.length && done > 0) a.training[sp.training[done].id] = { progress: r.int(20, 70), sessions: 1, firstYear: state.year - 1, learnedYear: null, by: { id: null, name: 'a previous owner' } };
      a.schooling = done === sp.training.length ? { hacking: r.int(30, 80), dressage: r.int(10, 70), jumping: r.int(10, 70) } : {};
      const quality = Object.values(a.schooling).reduce((s, v) => s + v, 0) / 3;
      a.price = Math.round((sp.fee * 3 + quality * 70 + (a.breedKnown && !zoo.breedLabel(a).startsWith('Crossbred') ? 1500 : 0)) * (age > 16 ? 0.5 : age < 5 ? 0.8 : 1) / 50) * 50;
    }
    st.saleYear = state.year;
  }
  return there().sort((x, y) => x.name.localeCompare(y.name));
}
/** Whether a horse has been taught to carry a rider. */
export const backed = (a) => (a.training.saddle?.progress ?? 0) >= 100;

// ---------- Lessons ----------

/** Who pays for a year of lessons: an adult pays for their own; a child's are a parent's decision. */
function lessonTerms(state) {
  const p = state.player; const c = COUNTRIES[p.countryId];
  const price = localCost(LESSON_COST * school(state).priceK, c);
  if (p.age >= 18) return { price, payer: 'you', ok: p.finance.cash >= price, why: `A year of weekly lessons costs ${fmtMoney(price, c)}. You do not have it.` };
  const parents = T.livingBy(state, ['parent']);
  const means = Math.max(0, ...parents.map((n) => n.wealth ?? n.meters.money ?? 0));
  return { price, payer: 'parents', ok: parents.length > 0 && means >= 38, why: parents.length ? 'Riding lessons are more than the family can manage.' : 'There is nobody to pay for lessons.' };
}
export function canLearn(state = store.state) {
  const p = state.player;
  if (p.age < 6) return { ok: false, why: 'The school takes children from six.' };
  if (p.legal?.incarceration) return { ok: false, why: 'Not from in here.' };
  if (state.player.riding?.lastLessonAge === p.age) return { ok: false, why: 'You have had this year\'s lessons.' };
  const t = lessonTerms(state);
  return { ok: t.ok, why: t.ok ? '' : t.why, price: t.price, payer: t.payer };
}
/** The riding instructor as someone in the player's life: made the first time they teach the player, the same person after. */
function instructor(state) {
  const sc = school(state);
  const p = state.player;
  let n = sc.instructorNpc ? state.npcs[sc.instructorNpc] : null;
  if (!n) {
    const [firstName, ...rest] = sc.instructor.name.split(' ');
    n = makeNpc({ role: 'mentor', countryId: sc.countryId, age: 28 + sc.instructor.years, gender: sc.instructor.gender, firstName, lastName: rest.join(' '), relationship: 45 });
    n.occupation = 'riding instructor'; n.flags.tag = 'riding'; n.flags.title = 'Riding instructor'; n.flags.schoolId = sc.id;
    state.npcs[n.id] = n; p.npcIds.push(n.id);
    sc.instructorNpc = n.id;
  } else if (!p.npcIds.includes(n.id)) p.npcIds.push(n.id);
  return n;
}
/**
 * A year of weekly lessons. The rider gets better at everything a little, and at what they chose to
 * work on a little more; it comes more slowly the better they already are.
 * @param {string} [focus]  a discipline to work towards, once the basics are there
 */
export function takeLessons(focus = 'hacking', state = store.state) {
  const p = state.player; const c = COUNTRIES[p.countryId];
  const can = canLearn(state);
  if (!can.ok) return result(false, can.why, 'neutral');
  if (!DISCIPLINES[focus]) return result(false, 'The school does not teach that.', 'neutral');
  const r = rider(state);
  const sc = school(state);
  const before = riderLevel(state);
  if (focus !== 'hacking' && before < 25) return result(false, `${sc.instructor.name.split(' ')[0]} wants you safe at walk, trot and canter before anything else.`, 'neutral');
  if (can.payer === 'you') care.pay(state, can.price, 'lessons', null, `lessons|${p.id}|${state.year}`);
  const teacher = instructor(state);
  const first = r.lessons === 0;
  r.lessons += 1; r.since ??= state.year; r.lastLessonAge = p.age; r.schoolId = sc.id;
  const apt = 1 + ((p.talents?.sports ?? 30) - 40) / 150 + (p.age < 16 ? 0.2 : p.age > 55 ? -0.2 : 0) + (teacher.meters.relationship - 50) / 400;
  for (const k of Object.keys(RIDER_SKILLS)) {
    const lean = DISCIPLINES[focus].needs[k] ? 1.5 : 1;
    r.skills[k] = Math.round(clamp(r.skills[k] + rng.int(4, 9) * apt * lean * (1 - r.skills[k] / 130)));
  }
  r.disciplines[focus] = Math.round(clamp((r.disciplines[focus] ?? 0) + rng.int(7, 13) * apt));
  teacher.meters.relationship = clamp(teacher.meters.relationship + rng.int(2, 6)); teacher.lastInteractionAge = p.age;
  // The school puts a rider on a horse that suits them, and usually the same one.
  const horses = schoolHorses(sc, state);
  const horse = horses.find((h) => h.id === r.schoolHorse) ?? horses.sort((x, y) => (before < 25 ? y.temperament.confidence - x.temperament.confidence : (y.schooling?.[focus] ?? 0) - (x.schooling?.[focus] ?? 0)))[0];
  let fell = '';
  if (rng.chance(clamp(0.1 - r.skills.balance / 1500, 0.02, 0.1))) { r.falls += 1; r.skills.confidence = clamp(r.skills.confidence - 4); p.stats.health = clamp(p.stats.health - 2); fell = ' You came off once, got back on, and were sore for a week.'; }
  const now = riderLevel(state);
  let text = first ? `You started riding lessons at ${sc.name}. ${teacher.firstName} put you on ${horse?.name ?? 'a quiet horse'} and spent the first month on how to stop.${fell}`
    : `A year of lessons with ${teacher.firstName} at ${sc.name}${focus === 'hacking' ? '' : `, working on ${DISCIPLINES[focus].name.toLowerCase()}`}. You ride like ${/^[aeiou]/i.test(levelName(now)) ? 'an' : 'a'} ${levelName(now).toLowerCase()} now.${fell}`;
  if (can.payer === 'you') text += ` It cost ${fmtMoney(can.price, c)}.`;
  const entry = say(state, text, 'good');
  if (horse) {
    r.schoolHorse = horse.id;
    horse.family = true; horse.riders = true;
    T.setBond(horse, T.ref(state, p.id), clamp((zoo.bondOf(horse, p.id) ?? 30) + rng.int(4, 9)));
    const me = T.ref(state, p.id); const who = T.ref(state, teacher.id);
    if (first) {
      T.record(state, { type: 'lesson', animalId: horse.id, people: [me, who], sig: 2, key: `first:${p.id}`, storyEntry: entry,
        text: `${me.name} had a first riding lesson at ${sc.name}, on ${horse.name}, taught by ${who.name}.`,
        memories: [T.memory(me, `How far away the ground was, the first time you sat on ${horse.name}.`, `${p.firstName} learned to ride on ${horse.name}.`), T.memory(who, `You put ${p.firstName} on ${horse.name} because ${horse.name} looks after people.`, `${who.name.split(' ')[0]} taught ${p.firstName} to ride.`)] });
    } else if (levelName(now) !== levelName(before)) {
      T.record(state, { type: 'lesson', animalId: horse.id, people: [me, who], sig: 2, key: `level:${levelName(now)}:${p.id}`, storyEntry: entry,
        text: `${me.name} reached ${levelName(now).toLowerCase()} level as a rider, at ${sc.name} under ${who.name}.` });
    }
  }
  p.stats.mood = clamp(p.stats.mood + 3);
  return result(true, text, 'good');
}

// ---------- Owning a horse ----------

/**
 * Whether this horse and this rider are a sensible match, and whether the player can keep it.
 * A horse that is too much for its rider is not refused outright unless the rider is a beginner:
 * it is said plainly, and it costs them in the saddle afterwards.
 */
export function horseCheck(animalId, state = store.state) {
  const a = zoo.animalById(animalId, state);
  const p = state.player; const c = COUNTRIES[p.countryId];
  const level = riderLevel(state);
  const problems = []; const notes = [];
  const price = localCost(a.price ?? 0, c);
  const ownLand = care.homeSpace(state) === 'land';
  const livery = ownLand ? 0 : liveryFee(state);
  const yearly = localCost(speciesOf(a.speciesId).cost, c) + livery;
  if (p.age < 18) problems.push('You are too young to buy a horse.');
  if (level < 25) problems.push('You are not ready for a horse of your own. Learn to ride first: the school\'s horses will teach you.');
  const sharp = (a.temperament.confidence ?? 50) < 40 || (a.temperament.sensitivity ?? 50) > 70;
  if (!backed(a) && level < 65) problems.push(`${a.name} has not been taught to carry a rider yet. That is work for someone who has done it before.`);
  else if (sharp && level < 45) notes.push(`${a.name} is sharp and easily worried: more horse than a novice should take on. You may find ${zoo.pronoun(a, 'them')} hard going.`);
  if (p.finance.cash < price + Math.round(yearly / 2)) problems.push(`${a.name} costs ${fmtMoney(price, c)}, and a horse costs about ${fmtMoney(yearly, c)} a year to keep after that. You could not cover it.`);
  if (ownLand) notes.push('You have the land to keep a horse at home. It will need the company of another.');
  else notes.push(`With no land of your own, ${a.name} would live at ${stable(state).name}: ${fmtMoney(livery, c)} a year, with turnout, feeding and a farrier arranged.`);
  if (zoo.stageOf(a, state) === 'senior') notes.push(`${a.name} is in later life: gentle hacking, not jumping.`);
  return { ok: !problems.length, problems, notes, price, yearly, livery, ownLand, mismatch: sharp && level < 45 };
}
export function buyHorse(animalId, state = store.state) {
  const a = zoo.animalById(animalId, state);
  if (!a?.forSale || a.inCircle) return result(false, 'That horse is not for sale.', 'neutral');
  const check = horseCheck(animalId, state);
  if (!check.ok) return result(false, check.problems[0], 'neutral');
  const p = state.player; const c = COUNTRIES[p.countryId];
  const st = stable(state);
  care.pay(state, check.price, 'purchase', a.id, `purchase|${a.id}|${state.year}`);
  delete a.forSale;
  const npc = makeNpc({ role: 'pet', countryId: p.countryId, lastName: p.lastName, age: zoo.ageOf(a, state), firstName: a.name, relationship: 35 });
  npc.id = a.id; npc.species = a.speciesId; npc.lifespan = a.lifespan; if (a.sex) npc.gender = a.sex; delete npc.traits; delete npc.orientation;
  state.npcs[npc.id] = npc; p.npcIds.push(npc.id);
  const home = check.ownLand ? zoo.playerHome(state) : { hh: 'stable', key: st.id, label: st.name, city: st.city, countryId: st.countryId };
  const text = `You bought ${a.name}, ${zoo.ageOf(a, state)}-year-old ${zoo.breedLabel(a) || speciesOf(a.speciesId).name}, for ${fmtMoney(check.price, c)}. ${check.ownLand ? `${cap(zoo.pronoun(a))} came home in a trailer and looked the place over.` : `${cap(zoo.pronoun(a))} lives at ${st.name}.`}`;
  zoo.register(npc, { state, origin: 'bought', fee: check.price, quiet: true, home });
  if (!check.ownLand) a.board = { stable: st.id, name: st.name, fee: check.livery, since: state.year };
  if (check.mismatch) a.mismatch = true;
  const me = T.ref(state, p.id);
  T.record(state, { type: 'joined', animalId: a.id, people: [me], sig: 3, storyEntry: say(state, text, 'good'),
    text: `${me.name} bought ${a.name}, a ${zoo.breedLabel(a) || speciesOf(a.speciesId).name}, from ${st.name}.`,
    memories: [T.memory(me, `Signing for ${a.name} and thinking: mine. Then: what have I done.`, `${p.firstName} bought ${a.name}.`)] });
  p.stats.mood = clamp(p.stats.mood + 10);
  return result(true, text, 'good', { animalId: a.id });
}
/** Moves a horse between the yard and the player's own land, or to the yard where the player now lives. */
export function moveHorse(animalId, state = store.state) {
  const a = zoo.animalById(animalId, state);
  const p = state.player; const c = COUNTRIES[p.countryId];
  if (!a || !isEquine(a) || !care.paysFor(a, state)) return result(false, 'That is not yours to arrange.', 'neutral');
  const st = stable(state);
  const at = zoo.homeOf(a);
  const abroad = at.countryId !== p.countryId;
  const cost = at.city === p.city && !abroad ? 0 : localCost(abroad ? 6500 : 450, c);
  if (p.finance.cash < cost) return result(false, `Transport would cost ${fmtMoney(cost, c)}. You do not have it.`, 'neutral');
  const toLand = care.homeSpace(state) === 'land' && at.hh !== 'player';
  if (!toLand && at.key === st.id) return result(false, `${a.name} is already at ${st.name}.`, 'neutral');
  if (cost) care.pay(state, cost, 'transport', a.id, `transport|${a.id}|${state.year}`);
  if (toLand) { T.setHome(state, a, zoo.playerHome(state)); delete a.board; } else { T.setHome(state, a, { hh: 'stable', key: st.id, label: st.name, city: st.city, countryId: st.countryId }); a.board = { stable: st.id, name: st.name, fee: liveryFee(state), since: state.year }; }
  if (state.npcs[a.id]) state.npcs[a.id].flags.abroad = false;
  const text = toLand ? `${a.name} lives at home with you now.` : `${a.name} has moved to ${st.name}${cost ? `. The journey cost ${fmtMoney(cost, c)}` : ''}.`;
  T.record(state, { type: 'moved', animalId: a.id, people: [T.ref(state, p.id)], sig: abroad ? 3 : 1, key: `yard:${zoo.homeOf(a).key}`, story: abroad ? text : null, text: `${a.name} moved to ${zoo.homeOf(a).label}${abroad ? `, in ${COUNTRIES[p.countryId].name}, with papers, a vet's certificate and a long journey` : ''}.` });
  if (!abroad) say(state, text);
  return result(true, text, 'neutral');
}

/** What the player can do with a horse this year. */
export function horseActions(a, state = store.state) {
  const p = state.player;
  const npc = state.npcs[a.id];
  if (!isEquine(a) || a.status !== 'living' || !npc?.alive) return [];
  const out = [];
  const mine = care.paysFor(a, state);
  const far = zoo.homeOf(a)?.city !== p.city || zoo.homeOf(a)?.countryId !== p.countryId;
  if (mine && !far && backed(a) && a.speciesId !== 'donkey' && riderLevel(state) >= 25 && p.riding?.lastRideAge !== p.age) out.push({ id: 'ride', label: `Ride ${a.name}` });
  if (mine && (far || (care.homeSpace(state) === 'land' && zoo.homeOf(a)?.hh === 'stable'))) out.push({ id: 'moveHorse', label: far ? `Bring ${a.name} to where you live now` : `Bring ${a.name} home to your own land` });
  return out;
}
/** What an old horse should be spared. */
export const tooHard = (a, discipline, state = store.state) => !!DISCIPLINES[discipline].hard && zoo.stageOf(a, state) === 'senior';
/**
 * A year of riding one's own horse, schooling it in one way of going. Horse and rider both get
 * better at it, and get to know each other; a mismatched pair gets there more slowly, with more falls.
 */
export function ride(animalId, discipline = 'hacking', state = store.state) {
  const a = zoo.animalById(animalId, state);
  const p = state.player;
  if (!horseActions(a, state).some((x) => x.id === 'ride')) return result(false, 'You cannot ride today.', 'neutral');
  if (!DISCIPLINES[discipline]) return result(false, 'That is not a way of riding.', 'neutral');
  if (tooHard(a, discipline, state)) return result(false, `${a.name} is too old to be asked for ${DISCIPLINES[discipline].name.toLowerCase()}. Gentle hacking suits ${zoo.pronoun(a, 'them')} now.`, 'neutral');
  const r = rider(state); const npc = state.npcs[a.id];
  r.lastRideAge = p.age; npc.lastInteractionAge = p.age;
  const k = a.mismatch ? 0.55 : 1;
  a.schooling ??= {};
  const fit = ((a.temperament[DISCIPLINES[discipline].horse] ?? 50) - 50) / 12;
  a.schooling[discipline] = Math.round(clamp((a.schooling[discipline] ?? 0) + (rng.int(5, 11) + fit + (disciplineSkill(discipline, state) - 40) / 12) * k));
  r.disciplines[discipline] = Math.round(clamp((r.disciplines[discipline] ?? 0) + rng.int(4, 8) * k));
  for (const s of Object.keys(DISCIPLINES[discipline].needs)) r.skills[s] = Math.round(clamp(r.skills[s] + rng.int(1, 3) * (1 - r.skills[s] / 130)));
  npc.meters.relationship = clamp(npc.meters.relationship + rng.int(3, 7) * k);
  T.setBond(a, T.ref(state, p.id), npc.meters.relationship);
  let text = `You rode ${a.name} all year: ${DISCIPLINES[discipline].name.toLowerCase()}, in all weathers. ${a.mismatch ? `${cap(zoo.pronoun(a))} is a lot of horse for you, and it shows.` : `You are starting to know what ${zoo.pronoun(a)} will do before ${zoo.pronoun(a)} does it.`}`;
  if (rng.chance(a.mismatch ? 0.25 : 0.05)) { r.falls += 1; r.skills.confidence = clamp(r.skills.confidence - 5); p.stats.health = clamp(p.stats.health - 3); text += ' You came off once, hard.'; }
  if (a.mismatch && riderLevel(state) >= 45) { delete a.mismatch; text += ` You have grown into ${zoo.pronoun(a, 'them')}.`; }
  say(state, text, 'good');
  p.stats.mood = clamp(p.stats.mood + 4);
  return result(true, text, 'good');
}

// ---------- Competitions ----------

/** The year's competitions near the player. Made once for each year; a class that has been run keeps its result. */
export function shows(state = store.state) {
  const P = care.places(state);
  const key = care.cityKey(state);
  const book = (P.shows[key] ??= {});
  if (!book[state.year]) {
    const { city, countryId } = state.player;
    const roll = T.seeded(`shows:${key}:${state.year}`);
    const kinds = Object.keys(DISCIPLINES).filter((d) => DISCIPLINES[d].show);
    book[state.year] = ['intro', 'novice', 'open', roll.pick(['intro', 'novice'])].map((level, i) => {
      const discipline = kinds[(roll.int(0, 5) + i) % kinds.length];
      return { id: `show:${key}:${state.year}:${i}`, year: state.year, city, countryId, level, discipline, entrants: roll.int(7, 16),
        name: `${roll.pick([`${city} ${['Spring', 'Summer', 'Autumn', 'Midwinter'][i]} Show`, `${school(state).name} ${['Open Day', 'Championship', 'Members\' Show', 'Derby'][i]}`, `The ${city} ${DISCIPLINES[discipline].name} Series`])}: ${SHOW_LEVELS[level].name.toLowerCase()} ${DISCIPLINES[discipline].name.toLowerCase()}`,
        organiser: care.localName(countryId, `${key}:organiser:${i}`).name, judge: care.localName(countryId, `${key}:judge:${state.year}:${i}`).name, result: null };
    });
    for (const y of Object.keys(book)) if (Number(y) < state.year - 1 && !book[y].some((s) => s.result)) delete book[y];
  }
  return book[state.year];
}
const showById = (id, state) => Object.values(care.places(state).shows).flatMap((b) => Object.values(b).flat()).find((s) => s.id === id) ?? null;
/** The horses the player could take into a class: their own, or, at introductory level, the school horse they ride. */
export function mounts(state = store.state) {
  const p = state.player;
  const own = zoo.allAnimals(state).filter((a) => isEquine(a) && a.speciesId !== 'donkey' && care.paysFor(a, state) && backed(a) && zoo.homeOf(a)?.city === p.city);
  const lesson = p.riding?.schoolHorse ? zoo.animalById(p.riding.schoolHorse, state) : null;
  return [...own, ...(lesson && lesson.status === 'living' && lesson.school === school(state).id ? [lesson] : [])];
}
export function showCheck(showId, horseId, state = store.state) {
  const s = showById(showId, state);
  const a = zoo.animalById(horseId, state);
  const lv = SHOW_LEVELS[s.level]; const c = COUNTRIES[state.player.countryId];
  const fee = localCost(lv.fee, c);
  const problems = [];
  if (s.year !== state.year) problems.push('That show is over.');
  if (s.result) problems.push('You have already ridden in that class.');
  if (!mounts(state).some((m) => m.id === horseId)) problems.push('That is not a horse you can enter.');
  if (disciplineSkill(s.discipline, state) < lv.needs) problems.push(`${lv.name} ${DISCIPLINES[s.discipline].name.toLowerCase()} is beyond you for now.`);
  if (a?.school && s.level !== 'intro') problems.push(`The school lends its horses for introductory classes only.`);
  if (a && tooHard(a, s.discipline, state)) problems.push(`${a.name} is too old to be asked for that.`);
  if (state.player.finance.cash < fee) problems.push(`The entry fee is ${fmtMoney(fee, c)}.`);
  return { ok: !problems.length, problems, fee, show: s };
}
/**
 * Rides one class. The result depends on rider and horse together, on how well they know each other,
 * and on the day; it is worked out once from the class and the pair, so it cannot be ridden again for a better one.
 */
export function enterShow(showId, horseId, state = store.state) {
  const chk = showCheck(showId, horseId, state);
  if (!chk.ok) return result(false, chk.problems[0], 'neutral');
  const s = chk.show; const a = zoo.animalById(horseId, state);
  const p = state.player; const c = COUNTRIES[p.countryId];
  const lv = SHOW_LEVELS[s.level]; const d = DISCIPLINES[s.discipline];
  care.pay(state, chk.fee, 'competition', a.id, `show|${s.id}`);
  const roll = T.seeded(`${s.id}:${a.id}:${p.id}`);
  const bond = zoo.bondOf(a, p.id) ?? 30;
  const score = Math.round((disciplineSkill(s.discipline, state) * 0.42 + (a.schooling?.[s.discipline] ?? 0) * 0.33 + bond * 0.15 + (a.temperament[d.horse] ?? 50) * 0.1 + roll.int(-12, 12)) * 10) / 10;
  const field = Array.from({ length: s.entrants - 1 }, () => roll.int(lv.field[0], lv.field[1]) + roll.int(-8, 8));
  const place = 1 + field.filter((x) => x > score).length;
  const prize = place === 1 ? localCost(lv.prize, c) : place === 2 ? localCost(Math.round(lv.prize / 3), c) : 0;
  if (prize) care.pay(state, -prize, 'prize', a.id, `prize|${s.id}`).refOf = (zoo.ensure(state).ledger.find((t) => t.k === `show|${s.id}`)).id;
  s.result = { place, of: s.entrants, score, horseId: a.id, rider: T.ref(state, p.id), prize };
  const r = rider(state);
  const entry = { showId: s.id, name: s.name, discipline: s.discipline, level: s.level, year: state.year, place, of: s.entrants, horseId: a.id, horse: a.name, rider: T.ref(state, p.id) };
  r.record.push(entry); (a.competitions ??= []).push(entry);
  r.disciplines[s.discipline] = Math.round(clamp((r.disciplines[s.discipline] ?? 0) + 4));
  a.schooling ??= {}; a.schooling[s.discipline] = Math.round(clamp((a.schooling[s.discipline] ?? 0) + 3));
  T.setBond(a, T.ref(state, p.id), clamp(bond + 3)); if (state.npcs[a.id]) state.npcs[a.id].meters.relationship = clamp(state.npcs[a.id].meters.relationship + 3);
  const nth = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4] ?? 'th'}`;
  const text = place === 1 ? `You and ${a.name} won the ${s.name}. ${a.name} knew it before the judge did.${prize ? ` The prize was ${fmtMoney(prize, c)}.` : ' A red rosette.'}`
    : place <= 3 ? `You and ${a.name} came ${nth(place)} of ${s.entrants} in the ${s.name}. A rosette for the tack-room wall.${prize ? ` And ${fmtMoney(prize, c)}.` : ''}`
      : `You and ${a.name} came ${nth(place)} of ${s.entrants} in the ${s.name}. ${place > s.entrants * 0.7 ? 'It was not your day.' : 'A tidy round, and something to build on.'}`;
  const me = T.ref(state, p.id);
  T.record(state, { type: 'competition', animalId: a.id, people: [me], sig: place <= 3 ? 3 : 2, key: s.id, storyEntry: say(state, text, place <= 3 ? 'good' : 'neutral'),
    text: `${me.name} rode ${a.name} in the ${s.name} and came ${nth(place)} of ${s.entrants}. Judge: ${s.judge}.`,
    memories: place <= 3 ? [T.memory(me, `${a.name}'s ears, pricked, going into the ring.`, `${p.firstName} and ${a.name} came home with a rosette.`)] : [] });
  p.stats.mood = clamp(p.stats.mood + (place === 1 ? 10 : place <= 3 ? 6 : 1));
  // The same faces turn up at every show. Sooner or later one of them is a friend.
  if (r.record.length === 2 && !p.npcIds.some((id) => state.npcs[id]?.flags.tag === 'rider')) {
    const n = makeNpc({ role: 'friend', countryId: p.countryId, age: clamp(p.age + rng.int(-6, 8), 16, 80), relationship: 45 });
    n.flags.tag = 'rider'; n.flags.title = 'Friend from the show circuit'; state.npcs[n.id] = n; p.npcIds.push(n.id);
    say(state, `You keep parking next to ${n.firstName} ${n.lastName} at shows. You have started saving each other a space.`, 'good');
  }
  return result(true, text, place <= 3 ? 'good' : 'neutral', { place });
}

// ---------- The year ----------

export function tickEquestrian(state = store.state) {
  const A = zoo.ensure(state);
  if (A.horseYear === state.year) return;
  A.horseYear = state.year;
  const p = state.player;
  // A horse left at a yard in a place the player has moved away from is still there, and still theirs.
  for (const a of zoo.allAnimals(state)) {
    if (!isEquine(a) || a.status !== 'living' || !state.npcs[a.id] || !a.board) continue;
    const at = zoo.homeOf(a);
    const far = at.city !== p.city || at.countryId !== p.countryId;
    state.npcs[a.id].flags.abroad = far && at.countryId !== p.countryId ? at.countryId : false;
    if (far && care.paysFor(a, state) && a.farNoted !== at.key) { a.farNoted = at.key; say(state, `${a.name} is still at ${at.label}, in ${at.city}. You can have ${zoo.pronoun(a, 'them')} brought to where you live now.`); }
  }
}

// ---------- Checking ----------

export function auditRiding(state = store.state) {
  const bad = [];
  const P = care.places(state);
  const r = state.player.riding;
  if (r) {
    for (const [k, v] of Object.entries(r.skills)) if (!(v >= 0 && v <= 100)) bad.push(`rider's ${k} out of range`);
    const seen = new Set();
    for (const e of r.record) { if (seen.has(e.showId)) bad.push(`rode ${e.showId} twice`); seen.add(e.showId); }
  }
  for (const s of Object.values(P.shows).flatMap((b) => Object.values(b).flat())) {
    if (s.result && !(s.result.place >= 1 && s.result.place <= s.result.of)) bad.push(`${s.id}: impossible placing`);
    if (s.result && !zoo.animalById(s.result.horseId, state)) bad.push(`${s.id}: ridden on a horse that is not on record`);
  }
  for (const a of zoo.everyAnimal(state)) {
    if (a.board && (!isEquine(a) || zoo.homeOf(a)?.hh !== 'stable') && a.status === 'living') bad.push(`${a.name}: paying livery without living at a yard`);
    for (const c of a.competitions ?? []) if (!showById(c.showId, state)?.result) bad.push(`${a.name}: a result for a class that was never run`);
  }
  return bad;
}
