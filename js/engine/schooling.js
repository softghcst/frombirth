// School life: the schools of the world, the one the player attends, the
// subjects they take and how they are getting on in each, and the people
// who are there with them. University and training are in engine/education.js;
// the arithmetic of marks is in engine/grades.js; countries' school systems
// and the kinds of school are in data/education.js.
//
// The world:
//   state.schools  { id: { id, name, kind, stage, countryId, city, founded, family: [names], head } }
//     A town's schools persist: the same school is there for the next child, and the next generation.
//   state.alumni   [{ id, firstName, lastName, gender, born, appearance, schoolId, rel, left }]
//     Classmates the player was not close enough to keep as friends. They are not forgotten: they can turn up again.
// On the player:
//   p.education.place     { schoolId, since }        where they are at school now
//   p.education.subjects  { subjectId: { g, y, interest, why } }   g: the running mark; y: this year's
//   p.education.aptitude  { subjectId: -15..15 }     a bent for some subjects, apart from general ability; lifelong
//   p.education.focus     the subject getting extra attention this year
//   p.education.history   [{ schoolId, name, kind, stage, stageName, from, to, how, mark }]
// People: classmates are NPCs with role 'classmate' and flags.schoolId. Teachers are NPCs
// with role 'mentor', flags.tag 'teacher', flags.teaches (a subject), flags.style and flags.skill.
import { subjectEdge } from './aptitudes.js';
import { neighborKidsFor, befriend as befriendNeighbor } from './neighborhood.js';
import { cityOf as cityProfile } from './cities.js';
import { forgetNpc } from './digital/core.js';
import { rng } from '../rng.js';
import { studyBarrier } from './health/access.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, npcsByRole, livingNpcs, log } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { degreeScheme, schoolModel, subjectsAt, SUBJECT_BY_ID, SCHOOL_KINDS, KIND_BY_ID, FEE_CAP, SCHOLARSHIPS, SCHOOL_PLACES, SCHOOL_SAINTS, TEACHING_STYLES, LEAVING_AGE } from '../data/education.js';
import { yearMark, carry, nextInterest, reason, showMark, showDegree, stageFor } from './grades.js';
import { makeNpc } from './npcFactory.js';
import { applyMods } from './genetics.js';
import { wealthTier } from './living.js';
import { tickSchoolLife, advancedPenalty, examEdge } from './schoollife.js';
import { preferredKind } from './royaled.js';
import { localSchoolPatterns, fillName } from '../data/localNames.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const SCHOOL = ['elementary', 'middle', 'high'];
export const atSchool = (p = player()) => p.education.enrolled && SCHOOL.includes(p.education.stage);
const schools = () => (store.state.schools ??= {});
export const school = (id = player().education.place?.schoolId) => schools()[id] ?? null;
/** A value on the player by path; 'a|b' takes the best of several. */
const val = (p, path) => Math.max(...path.split('|').map((one) => one.split('.').reduce((o, k) => o?.[k], p) ?? 0));

/** The country's word for a stage: "Sixth form", "Lycée". */
export const stageName = (stage, countryId = player().countryId) => schoolModel(countryId).stages.find((s) => s.id === stage)?.name ?? stage;
/** The stage a child of this age should be in, in this country, or null. */
export const stageDue = (age, countryId = player().countryId) => stageFor(age, schoolModel(countryId).stages, LEAVING_AGE);
/** A mark as this country writes it. */
export const mark = (g, countryId = player().countryId) => showMark(g, schoolModel(countryId).grading);
/** A university or professional result as this country writes it: "2:1", "14/20", "GPA 3.40". */
export const degreeMark = (g, countryId = player().countryId) => showDegree(g, degreeScheme(countryId));

// ---------- Schools ----------

const title = (s) => s.replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

function nameFor(kind, stage, countryId, city) {
  const taken = new Set(Object.values(schools()).map((s) => s.name));
  // In much of the world schools are named in the country's own language.
  const local = kind.id === 'palace' ? null : localSchoolPatterns(kind.id, stage, countryId);
  if (local) {
    for (let i = 0; i < 16; i++) {
      const name = fillName(rng.pick(local), countryId, city, (xs) => rng.pick(xs), rng.int(2, 60));
      if (!taken.has(name)) return name;
    }
  }
  for (let i = 0; i < 12; i++) {
    const name = rng.pick(kind.suffix).replace('{place}', rng.pick(SCHOOL_PLACES)).replace('{saint}', rng.pick(SCHOOL_SAINTS)).replace('{stage}', title(stageName(stage, countryId)));
    if (!taken.has(name)) return name;
  }
  return `${rng.pick(SCHOOL_PLACES)} ${title(stageName(stage, countryId))} No. ${taken.size + 1}`;
}

/** The school of a kind for a stage in a town. A town has one of each, and it stays. */
/** The school of this kind for this stage in a town, founding one if there is none. Used for the player's children too. */
export function placeFor(kindId, stage, city, countryId) { return findOrFound(kindId, stage, city, countryId); }
function findOrFound(kindId, stage, city, countryId) {
  const kind = KIND_BY_ID[kindId];
  // Boarding schools draw from the whole country, not one town.
  const here = Object.values(schools()).find((s) => s.kind === kindId && s.stage === stage && s.countryId === countryId && (kind.away || s.city === city));
  if (here) return here;
  const id = `sch${Object.keys(schools()).length + 1}_${Math.floor(rng.next() * 1e6).toString(36)}`;
  const c = COUNTRIES[countryId];
  const s = { id, name: kindId === 'home' ? 'Home' : nameFor(kind, stage, countryId, city), kind: kindId, stage, countryId, city, founded: store.state.year - rng.int(8, 160), family: [],
    head: `${rng.pick(rng.chance(0.5) ? c.names.male : c.names.female)} ${rng.pick(c.names.last)}` };
  schools()[id] = s;
  return s;
}

/** The year's fee in base units for this child: the school's fee less a scholarship for an exceptional audition or trial
 *  (a school with entry by talent only). */
export function feeFor(kind, p = player()) {
  if (!kind.fee) return 0;
  const sch = scholarshipFor(kind, p);
  return Math.round(kind.fee * (1 - (sch?.off ?? 0)));
}
export function scholarshipFor(kind, p = player()) {
  return kind.fee && kind.needs?.entry && kind.id !== 'selective' ? SCHOLARSHIPS.find((x) => val(p, kind.needs.entry.path) >= x.min) ?? null : null;
}

/** Where the young person actually lives and goes to school: the agency's dorm in another country if they are a trainee or idol there. */
export function livesAt(p = player()) {
  const r = p.idol?.residence;
  return r && p.age < 18 ? { countryId: r.countryId, city: r.city, sponsored: true } : { countryId: p.countryId, city: p.city, sponsored: false };
}

/** Whether a kind of school would take this child, and the family could manage it. '' if so, else why not. */
export function barred(kind, stage, p = player(), sponsored = false) {
  const tier = wealthTier();
  if (kind.from && SCHOOL.indexOf(stage) < SCHOOL.indexOf(kind.from)) return 'Not for children this young.';
  if (kind.needs?.royal && !(p.royal && !p.royal.waiting)) return 'Only for the royal family.';
  if (kind.needs?.wealth === 'rich' && tier !== 'rich' && !sponsored) return 'The fees are beyond your family.';
  if (kind.needs?.entry && val(p, kind.needs.entry.path) < kind.needs.entry.min) return kind.id === 'selective' ? 'You would not pass the entrance test.' : 'You would not get through the audition or trial.';
  // The fees, less any scholarship for an exceptional audition, against what the family can pay.
  const fee = feeFor(kind, p);
  if (!sponsored && fee > FEE_CAP[tier]) return fee >= 5000 ? `The fees (${fmtMoney(localMoney(fee, country()), country())} a year) are beyond your family, unless an audition is exceptional.` : 'Even small fees are too much at home just now.';
  return '';
}

/** Where the family sends the child. Money, the child's gifts, what the family has always done, and some taste. */
function parentsChoose(stage) {
  const p = player();
  const c = country();
  const ok = (id) => !barred(KIND_BY_ID[id], stage, p);
  // A royal household keeps to what was decided for the child at ten.
  const pref = preferredKind(stage);
  if (pref && ok(pref)) return pref;
  // A school the family already has a history with, if it would still take them.
  const old = Object.values(schools()).find((s) => s.stage === stage && s.countryId === c.id && s.family.length && (KIND_BY_ID[s.kind].away || s.city === p.city) && s.kind !== 'public' && ok(s.kind));
  if (old && rng.chance(0.6)) return old.kind;
  // Having chosen a kind of school once, a family mostly keeps to it.
  const was = school();
  if (was && was.kind !== 'public' && was.kind !== 'home' && ok(was.kind) && rng.chance(0.75)) return was.kind;
  const royal = !!p.royal && !p.royal.waiting;
  if (royal && ok('boarding') && rng.chance(0.7)) return 'boarding';
  if (ok('boarding') && rng.chance(0.2)) return 'boarding';
  if (ok('private') && rng.chance(0.45)) return 'private';
  if (ok('arts') && rng.chance(0.35)) return 'arts';
  if (ok('sports') && rng.chance(0.3)) return 'sports';
  if (ok('selective') && rng.chance(0.5)) return 'selective';
  if (ok('religious') && rng.chance(0.14)) return 'religious';
  if (stage === 'elementary' && rng.chance(0.03)) return 'home';
  return 'public';
}

// ---------- People ----------

function add(npc) {
  store.state.npcs[npc.id] = npc;
  player().npcIds.push(npc.id);
  npc.lastInteractionAge = player().age;
  return npc;
}
function forget(npc) {
  const p = player();
  forgetNpc(npc.id);
}
const classmates = () => npcsByRole('classmate').filter((n) => n.flags.schoolId);
export const teachers = () => livingNpcs().filter((n) => n.flags.tag === 'teacher');

/** A classmate the player was not close to is not deleted from the world: they are remembered, and may come back. */
function remember(npc, s) {
  const list = (store.state.alumni ??= []);
  list.push({ id: npc.id, firstName: npc.firstName, lastName: npc.lastName, gender: npc.gender, born: store.state.year - npc.age, appearance: npc.appearance, schoolId: s?.id ?? npc.flags.schoolId, interest: npc.flags.interest ?? null, clubs: npc.flags.clubs ?? [], rel: npc.meters.relationship, left: store.state.year });
  if (list.length > 40) list.shift();
  forget(npc);
}

/** The class moves on: friends stay friends, some classmates come along, the rest are remembered. */
function partClass(s, keep = 0) {
  for (const n of classmates()) {
    if (n.meters.relationship >= 55 || n.flags.tag || n.flags.title === 'Best friend') { n.role = 'friend'; n.flags.metAt = s?.name; delete n.flags.schoolId; }
    else if (keep && rng.chance(keep)) continue;
    else remember(n, s);
  }
  for (const t of teachers()) {
    if (t.meters.relationship >= 65) { t.flags.tag = 'oldTeacher'; t.flags.title = `Former ${t.flags.title.toLowerCase()}`; } else forget(t);
  }
}

function fillClass(s) {
  const p = player();
  const kind = KIND_BY_ID[s.kind];
  const taken = new Set(p.npcIds.map((id) => store.state.npcs[id]?.firstName));
  for (const n of classmates()) n.flags.schoolId = s.id;
  // At the local school, children from the player's own street are in the class: the same people, not new ones.
  if (s.kind === 'public') for (const id of neighborKidsFor(store.state, p.age, kind.class - classmates().length)) {
    const n = befriendNeighbor(store.state, id, 40, 'classmate');
    if (!n) continue;
    if (n.role === 'neighbor') n.role = 'classmate';
    n.flags.schoolId = s.id; n.flags.alsoNeighbor = true;
    taken.add(n.firstName);
  }
  for (let guard = 0; classmates().length < kind.class && guard < 20; guard++) {
    const mate = makeNpc({ role: 'classmate', countryId: p.countryId, age: p.age, relationship: rng.int(30, 62) });
    if (taken.has(mate.firstName)) continue;
    taken.add(mate.firstName);
    mate.flags.schoolId = s.id;
    add(mate);
  }
  if (s.kind === 'home' || s.onlyPupils) return;
  // Two teachers the child will actually remember: what they teach, and how.
  const list = subjectsAt(s.stage);
  const first = kind.favors ? SUBJECT_BY_ID[rng.pick(kind.favors)] : rng.pick(list);
  const second = rng.pick(list.filter((x) => x.id !== first.id));
  for (const sub of [first, second]) {
    const t = add(makeNpc({ role: 'mentor', countryId: p.countryId, age: rng.int(26, 61), relationship: rng.int(38, 60) }));
    const style = rng.pick(TEACHING_STYLES);
    Object.assign(t.flags, { tag: 'teacher', teaches: sub.id, title: `${sub.name} teacher`, style: style.id, skill: Math.round(clamp(rng.around(58, 28))), schoolId: s.id });
  }
}

// ---------- Starting, moving and leaving ----------

function closeHistory(how) {
  const e = player().education;
  const h = (e.history ?? []).find((x) => x.to == null);
  if (h) { h.to = player().age; h.how = how; h.mark = e.gpa || null; }
}

/** Puts the player in a school. `keep`: how much of the old class comes too. */
function enrollAt(s, keep = 0) {
  const p = player();
  const e = p.education;
  const was = school();
  if (was && was.id !== s.id) partClass(was, keep);
  closeHistory(e.place ? 'moved on' : null);
  e.place = { schoolId: s.id, since: p.age };
  e.schoolKind = s.kind;
  (e.history ??= []).push({ schoolId: s.id, name: s.name, kind: s.kind, stage: s.stage, stageName: stageName(s.stage, s.countryId), from: p.age, to: null });
  const mine = `${p.firstName} ${p.lastName}`;
  if (!s.family.includes(mine)) s.family.push(mine);
  fillClass(s);
  p.flags.boarding = !!KIND_BY_ID[s.kind].away;
  const fresh = !e.subjects;
  const subs = (e.subjects ??= {});
  e.aptitude ??= {};
  for (const sub of subjectsAt(s.stage)) {
    // A bent for a subject is found when it is first met, and is the child's own.
    e.aptitude[sub.id] ??= Math.round(rng.around(0, 14));
    subs[sub.id] ??= { g: null, y: null, interest: Math.round(clamp(50 + e.aptitude[sub.id] + rng.int(-8, 8))) };
  }
  for (const id of Object.keys(subs)) if (!subjectsAt(s.stage).some((x) => x.id === id)) subs[id].done = true; else delete subs[id].done;
  if (e.focus && subs[e.focus]?.done) e.focus = null;
  if (fresh) seedMarks();
}

/** A new stage of school begins. The family decides where, unless the player has already chosen. */
export function enter(stage, chosenKind = null) {
  const p = player();
  const c = country();
  const was = school();
  const kindId = chosenKind ?? parentsChoose(stage);
  const s = findOrFound(kindId, stage, p.city, c.id);
  // Children from one school mostly go on to the next one together, unless this child is sent somewhere else.
  const together = was && was.kind === 'public' && kindId === 'public' ? 0.65 : 0.15;
  enrollAt(s, together);
  const kind = KIND_BY_ID[kindId];
  const been = s.family.filter((n) => n !== `${p.firstName} ${p.lastName}`);
  let text = kindId === 'home' ? `Your ${stageName(stage).toLowerCase()} years will be spent at the kitchen table: your family is teaching you at home.` : `You started at ${s.name}${kind.id === 'public' ? '' : `, a ${kind.name.toLowerCase()}`}.`;
  if (kind.away) text += ' You will live there during the school year, and come home for the holidays.';
  if (been.length) text += ` ${been[been.length - 1]} went here before you.`;
  log(text);
  // A new school is announced: where, what kind, and for how long.
  if (kindId !== 'home') {
    const stages = schoolModel(c.id).stages;
    const at = stages.findIndex((x) => x.id === stage);
    const years = Math.max(1, (stages[at + 1]?.start ?? LEAVING_AGE) - Math.max(p.age, stages[at]?.start ?? p.age));
    store.state.pendingEvents.push({ id: 'school_start', cast: { words: { school: s.name, kind: kind.id === 'public' ? 'Public' : kind.name, stage: stageName(stage), years: String(years) } } });
  }
  // The very first day of school is its own memory.
  const e = p.education;
  const first = classmates()[0];
  if (stage === 'elementary' && !e.firstDay && first) store.state.pendingEvents.push({ id: 'first_day_school', cast: { mate: first.id } });
  if (stage !== 'high') delete e.courses; else delete e.examPlan;
  return s;
}

/** Makes sure a child at school has a school: for lives begun before schools had names, and for arrivals from elsewhere. */
export function ensure() {
  const p = player();
  const e = p.education;
  if (!atSchool(p)) return;
  const s = school();
  if (!s) {
    // An heir carries on at the school they were already at.
    const want = schools()[e.joinSchoolId];
    delete e.joinSchoolId;
    if (want && want.stage === e.stage) { enrollAt(want, 0); seedMarks(); return; }
    enter(e.stage); return;
  }
  // A young trainee or idol who lives in another country (in the agency's dorm, on a trainee visa) goes to school there.
  const lives = livesAt(p);
  if (!KIND_BY_ID[s.kind].away && s.kind !== 'home' && (s.city !== lives.city || s.countryId !== lives.countryId)) {
    // The family has moved, or the dorm is in another country: a new school, and the old class left behind, though not
    // the friends made there. An idol is often taken in by a performing arts school, whose timetable bends around the work.
    const want = lives.sponsored && !barred(KIND_BY_ID.arts, e.stage, p, true) ? 'arts' : barred(KIND_BY_ID[s.kind], e.stage, p, lives.sponsored) ? 'public' : s.kind;
    const next = findOrFound(want, e.stage, lives.city, lives.countryId);
    enrollAt(next, 0);
    log(lives.sponsored ? `You live in ${lives.city} now, so you changed schools: you are at ${next.name}, with a timetable that bends around your training, and everyone is new.` : `With the move, you changed schools: you are at ${next.name} now, and everyone is new.`);
  } else if (barred(KIND_BY_ID[s.kind], e.stage) === 'The fees are beyond your family.') {
    const next = findOrFound('public', e.stage, p.city, p.countryId);
    enrollAt(next, 0);
    log(`Your family can no longer afford ${s.name}. You have moved to ${next.name}.`, 'system', 'bad');
  }
}
/** For a life already under way: marks in each subject start from the overall mark it had. */
function seedMarks() {
  const e = player().education;
  if (!e.gpa) return;
  for (const [id, sub] of Object.entries(e.subjects)) if (sub.g == null && !sub.done) sub.g = Math.round(clamp(e.gpa + (e.aptitude[id] ?? 0) / 30, 0, 4) * 100) / 100;
}

/** School is over, one way or another. `how`: 'completed' | 'left' | 'expelled'. */
export function leave(how = 'completed') {
  const s = school();
  closeHistory(how);
  partClass(s, 0);
  const p = player();
  delete p.education.place;
  p.flags.boarding = false;
}

/** What the player can ask for when a new stage is about to start or has just started: older children get a say. */
export function choices() {
  const p = player();
  const e = p.education;
  if (!atSchool(p) || p.age < 11 || e.choseAt === e.stage) return [];
  const now = school();
  return SCHOOL_KINDS.filter((k) => k.id !== now?.kind && k.id !== 'home').map((k) => ({ id: k.id, name: k.name, blurb: k.blurb, why: barred(k, e.stage, p),
    fee: k.fee ? `${fmtMoney(localMoney(feeFor(k, p), country()), country())} a year, paid by your family${scholarshipFor(k, p) ? ` (with ${scholarshipFor(k, p).name}; the full fee is ${fmtMoney(localMoney(k.fee, country()), country())})` : ''}.` : 'No fees.' }));
}
/** The player asks to change schools. Parents usually agree if it can be done; once per stage. */
export function askToMove(kindId) {
  const p = player();
  const e = p.education;
  const kind = KIND_BY_ID[kindId];
  if (!atSchool(p) || !kind || e.choseAt === e.stage) return result(false, 'You have already had that conversation.', 'neutral');
  const why = barred(kind, e.stage, p);
  if (why) return result(false, why, 'neutral');
  e.choseAt = e.stage;
  const parents = npcsByRole('parent');
  const close = parents.length ? parents.reduce((s, n) => s + n.meters.relationship, 0) / parents.length : 60;
  if (!rng.chance(clamp(0.45 + (close - 50) / 120 + (p.age >= 14 ? 0.2 : 0), 0.15, 0.95))) return result(false, 'Your family listens, and says no. You are staying where you are.');
  const s = findOrFound(kindId, e.stage, p.city, p.countryId);
  enrollAt(s, 0);
  const text = `Your family agrees. You have moved to ${s.name}. The friends you made stay your friends; everyone else is new.`;
  log(text);
  return result(true, text);
}

/**
 * A year in the same room. Some classmates the player simply gets on with,
 * and some they do not: closeness grows or fades by how well two people
 * suit each other, without anything having to happen. The closest becomes a
 * best friend. Anyone who has gone is replaced, so the class stays a class.
 */
function classYear(s) {
  const p = player();
  const kind = KIND_BY_ID[s.kind];
  const friendly = p.education.priority === 'friends' ? 2 : 0;
  for (const n of classmates()) {
    // How well this person and the player suit each other: settled once, and theirs for good.
    n.flags.suits ??= rng.int(-3, 5);
    n.meters.relationship = Math.round(clamp(n.meters.relationship + n.flags.suits + friendly + (p.stats.charm - 50) / 40 + rng.int(-2, 2)));
    n.lastInteractionAge = p.age; // you see them every day
    if (n.flags.title === 'Best friend' && n.meters.relationship < 60) delete n.flags.title;
  }
  const close = classmates().filter((n) => n.meters.relationship >= 72).sort((a, b) => b.meters.relationship - a.meters.relationship)[0];
  if (close && !livingNpcs().some((n) => n.flags.title === 'Best friend')) {
    close.flags.title = 'Best friend';
    log(`${close.firstName} ${close.lastName} from your class has become your best friend.`, 'system', 'good');
  }
  if (classmates().length < kind.class) fillClass({ ...s, kind: s.kind, onlyPupils: true });
  tickSchoolLife();
}

// ---------- The year's work ----------

/** Gives one subject extra attention this year. */
export function setFocus(id) {
  const e = player().education;
  if (!atSchool() || (id && (!e.subjects?.[id] || e.subjects[id].done))) return result(false, 'That is not on your timetable.', 'neutral');
  e.focus = id || null;
  const text = id ? `This year you are giving ${SUBJECT_BY_ID[id].name.toLowerCase()} extra attention.` : 'You are spreading your effort evenly this year.';
  return result(true, text, 'neutral');
}

/** What the state puts into its schools: the same decision governments make about education funding. */
const funding = (countryId) => (store.state.polities?.[countryId]?.policies?.tuition ?? 0) * 0.05;

/**
 * Marks every subject for the year, moves interests, and returns the year's
 * overall mark (0–4). Called once a year for a child at school.
 */
export function markYear() {
  const p = player();
  const e = p.education;
  const s = school();
  if (!s || !e.subjects) return null;
  const kind = KIND_BY_ID[s.kind];
  const live = subjectsAt(e.stage).filter((sub) => e.subjects[sub.id] && !e.subjects[sub.id].done);
  // In the last year, how the exams were prepared for tells on every paper.
  const exam = e.stage === 'high' && p.age >= LEAVING_AGE ? examEdge() : { add: 0, why: '' };
  const tutored = p.flags.tutorAge === p.age - 1;
  const weakest = tutored ? live.reduce((w, sub) => ((e.subjects[sub.id].g ?? 2) < (e.subjects[w.id].g ?? 2) ? sub : w), live[0]) : null;
  const staff = teachers();
  // What gets in the way of showing what a pupil knows (never what they are able to learn).
  const barrier = studyBarrier(p);
  let sum = 0;
  const done = [];
  for (const sub of live) {
    const rec = e.subjects[sub.id];
    // What was learned outside school counts too: coding in Technology, writing in Literature (engine/aptitudes.js).
    const natural = Object.entries(sub.apt).reduce((t, [path, w]) => t + val(p, path) * w, 0) + subjectEdge(sub.id, p) * 12;
    const t = staff.find((x) => x.flags.teaches === sub.id);
    const style = t ? TEACHING_STYLES.find((x) => x.id === t.flags.style) : null;
    const club = (sub.club ?? []).some((id) => e.clubs.includes(id));
    const f = { ability: clamp(natural + (e.aptitude[sub.id] ?? 0)), effort: e.effort, discipline: p.hidden.discipline, interest: rec.interest, absences: e.absences,
      teaching: kind.teach + (kind.favors?.includes(sub.id) ? 0.15 : 0) + (s.kind === 'public' ? (s.funding ?? funding(s.countryId)) + cityProfile(s.countryId, s.city).schools / 100 : 0) + (t ? (t.flags.skill - 50) / 200 + (t.meters.relationship - 50) / 400 : 0),
      focus: e.focus === sub.id ? 1 : 0, support: (weakest?.id === sub.id ? 0.5 : 0) + exam.add - advancedPenalty(sub.id) - barrier, luck: (rng.next() * 2 - 1) * 0.25 };
    const y = yearMark(f);
    rec.y = y;
    rec.g = carry(rec.g, y);
    rec.why = exam.why || reason(f, y);
    rec.interest = nextInterest(rec.interest, y, { teacher: style?.interest ?? 0, club, focus: f.focus });
    sum += y;
    done.push({ sub, y });
  }
  if (kind.yearly) applyMods(p, kind.yearly);
  classYear(s);
  if (p.age >= 7 && done.length) {
    done.sort((a, b) => b.y - a.y);
    const best = done[0];
    const worst = done[done.length - 1];
    log(`School report: best ${best.sub.name.toLowerCase()} ${mark(best.y)}, weakest ${worst.sub.name.toLowerCase()} ${mark(worst.y)}.`, 'system', 'neutral');
  }
  e.focus = null;
  return live.length ? sum / live.length : null;
}

/** Now and then someone from school turns up again in adult life. */
export function tickAlumni() {
  const p = player();
  const list = store.state.alumni ?? [];
  if (p.age < 22 || !list.length || !rng.chance(0.05)) return;
  const i = rng.int(0, list.length - 1);
  const a = list[i];
  if (store.state.npcs[a.id]) { list.splice(i, 1); return; }
  list.splice(i, 1);
  const n = makeNpc({ role: 'friend', countryId: p.countryId, gender: a.gender, age: Math.max(18, store.state.year - a.born), firstName: a.firstName, lastName: a.lastName, relationship: clamp(a.rel + rng.int(-5, 10)), appearance: a.appearance });
  n.id = a.id;
  const s = schools()[a.schoolId];
  n.flags.metAt = s?.name;
  n.flags.title = 'Old classmate';
  add(n);
  log(`${a.firstName} ${a.lastName}, who was in your class${s ? ` at ${s.name}` : ''}, gets in touch out of nowhere. You have ${store.state.year - a.left} years to catch up on.`, 'system', 'good');
}

// ---------- For the screens ----------

/** Everything the education screen shows, from saved state. */
export function view() {
  const p = player();
  const e = p.education;
  const s = school();
  const m = schoolModel(p.countryId);
  const kind = s ? KIND_BY_ID[s.kind] : null;
  return {
    school: s, kind, stage: e.stage, stageName: atSchool(p) ? stageName(e.stage) : null, year: (e.yearInStage ?? 0) + 1, grading: m.grading, leaving: m.leaving,
    overall: e.gpa ? mark(e.gpa) : null, effort: e.effort, absences: e.absences, focus: e.focus,
    subjects: atSchool(p) && e.subjects ? subjectsAt(e.stage).filter((sub) => e.subjects[sub.id] && !e.subjects[sub.id].done).map((sub) => { const r = e.subjects[sub.id]; return { id: sub.id, name: sub.name, advanced: !!e.courses?.advanced.includes(sub.id), mark: r.g == null ? null : mark(r.g), g: r.g, interest: r.interest, why: r.why ?? '', teacher: teachers().find((t) => t.flags.teaches === sub.id) ?? null }; }) : [],
    classmates: classmates(), friends: npcsByRole('friend').filter((n) => n.flags.metAt), teachers: teachers(),
    history: [...(e.history ?? [])].reverse(), fee: kind?.fee ? localMoney(feeFor(kind, p), country()) : 0,
    family: s ? s.family.filter((n) => n !== `${p.firstName} ${p.lastName}`) : [],
  };
}
/** What a teacher is like, in a few words. */
export const teacherLine = (t) => { const style = TEACHING_STYLES.find((x) => x.id === t.flags.style); return `${style?.name ?? 'fair'}${t.flags.skill >= 72 ? ', and very good at it' : t.flags.skill <= 38 ? ', and not much good at it' : ''}`; };
