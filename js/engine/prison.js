// Life inside. A sentence is served at a real place, among people who stay in
// the world: inmates with their own lives and release dates, and staff who
// age, transfer and retire. Life goes on: study that counts outside, work,
// letters, calls and visits, healthcare, parole reviews, release.
//
// The older parts (respect, conduct, gangs, riots, escape) are still here;
// they are not the only way through a sentence.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, log, milestone, npcsByRole, livingNpcs } from '../state.js';
import { release, imprison, legal } from './justice.js';
import * as k from './cases.js';
import { remember } from './conditions.js';
import { GANGS, ESCAPE_PENALTY, RECAPTURE_PENALTY, LIFE_SENTENCE } from '../data/crimes.js';
import { LAYOUTS } from '../data/prisonLayouts.js';
import {
  systemFor, FACILITY_KINDS, PROGRAMMES, PROGRAMME_BY_ID, PRISON_JOBS, PRISON_JOB_BY_ID, ROUTINES, INMATE_LIVES,
  STAFF_ROLES, OFFENSES, OFFENSE_BY_ID, EVIDENCE_FROM, courtsFor,
} from '../data/justice.js';
import { COUNTRIES } from '../data/countries.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
export const cell = () => player().legal.incarceration;
export const gang = () => GANGS.find((g) => g.id === cell()?.gangId) ?? null;
export const isJuvenile = () => cell()?.facility === 'juvenile';
const RANK = { min: 0, med: 1, max: 2 };
const year = () => store.state.year;

function acts() {
  const p = player();
  if (p.flags.prisonActs?.age !== p.age) p.flags.prisonActs = { age: p.age };
  return p.flags.prisonActs;
}
/** Marks a once-a-year action as used; false if it already was. */
const once = (key) => { if (acts()[key]) return false; acts()[key] = true; return true; };
const count = (key, max) => { const a = acts(); a[key] = (a[key] ?? 0) + 1; return a[key] <= max; };
const bump = (key, d) => { cell()[key] = clamp(cell()[key] + d); };

// ---------- Facilities ----------

/** The facility of a kind in a country. Built once, then always the same place. */
export function facilityFor(countryId, kind) {
  const J = k.J();
  const id = `fac_${countryId}_${kind}`;
  if (J.facilities[id]) return J.facilities[id];
  const c = COUNTRIES[countryId];
  const city = rng.pick(c.cities);
  const sys = systemFor(countryId);
  const f = { id, countryId, kind, city, name: `${city} ${rng.pick(FACILITY_KINDS[kind].words)}`, opened: year(),
    capacity: { juvenile: 120, min: 400, med: 900, max: 700 }[kind], conditions: clamp(Math.round(40 + sys.schooling * 40 + rng.int(-10, 10))),
    staff: {}, inmateIds: [], released: [] };
  J.facilities[id] = f;
  staffUp(f);
  while (f.inmateIds.length < 6) f.inmateIds.push(newInmate(f).id);
  return f;
}
export const facility = () => k.J().facilities[cell()?.facilityId] ?? null;

function staffUp(f) {
  for (const r of STAFF_ROLES) {
    const n = store.state.npcs[f.staff[r.id]];
    if (n?.alive && !n.flags.justice?.retired) continue;
    const s = k.civilian(f.countryId, { kind: 'staff', occupation: r.name, age: rng.int(28, 60) });
    s.flags.justice.role = r.id;
    s.flags.justice.facilityId = f.id;
    s.flags.justice.skill = rng.int(40, 80);
    f.staff[r.id] = s.id;
  }
}

/** A person serving a sentence: a whole person, not their offence. */
function newInmate(f) {
  const off = rng.pick(OFFENSES.filter((o) => (f.kind === 'max' ? o.severity >= 3 : f.kind === 'min' ? o.severity <= 3 : o.severity >= 2) && o.custody[1] > 0));
  const n = k.civilian(f.countryId, { kind: 'inmate', age: f.kind === 'juvenile' ? rng.int(14, 17) : rng.int(19, 66), role: 'official',
    gender: player()?.gender === 'female' ? 'female' : 'male' });
  const [lo, hi] = off.custody;
  n.flags.inmate = { facilityId: f.id, offenseId: off.id, yearsLeft: rng.int(Math.max(1, Math.ceil(lo / 2)), Math.max(2, Math.ceil(hi / 2))),
    interest: rng.pick(INMATE_LIVES.interests), goal: rng.pick(INMATE_LIVES.goals), background: rng.pick(INMATE_LIVES.backgrounds),
    studying: rng.chance(0.35) ? rng.pick(PROGRAMMES).id : null, since: year() };
  n.occupation = null;
  (n.flags.record ??= []).push({ crimeId: off.id, offense: off.name, year: year() - rng.int(0, 3), convicted: true, outcome: 'convicted', note: 'before the player knew them' });
  return n;
}

/** The people inside the player's facility, beyond the player. */
export function inmatesNear() {
  const f = facility();
  return f ? f.inmateIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive) : [];
}
export const staffNear = () => {
  const f = facility();
  return f ? STAFF_ROLES.map((r) => ({ role: r, npc: store.state.npcs[f.staff[r.id]] })).filter((x) => x.npc) : [];
};

/** Called when the player arrives: a place, a cell, and arrangements for any children. */
export function admit(c) {
  const p = player();
  const f = facilityFor(p.countryId, c.facility === 'juvenile' ? 'juvenile' : c.security);
  c.facilityId = f.id;
  const mate = rng.pick(f.inmateIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive));
  if (mate) {
    mate.role = 'cellmate';
    mate.meters.relationship = rng.int(30, 55);
    if (!p.npcIds.includes(mate.id)) p.npcIds.push(mate.id);
    log(`You are taken to ${f.name}. Your cellmate is ${mate.firstName} ${mate.lastName}, who ${mate.flags.inmate.background} and spends every spare hour on ${mate.flags.inmate.interest}.`);
  }
  arrangeCare(c);
}

/** Children who lived with the player go to their other parent, a relative, or into care. */
function arrangeCare(c) {
  const kids = npcsByRole('child').filter((n) => n.age < 18 && !n.flags.abroad && !n.flags.livesApart);
  if (!kids.length) return;
  const partner = [...npcsByRole('spouse'), ...npcsByRole('partner')].find((n) => !n.flags.abroad);
  const gran = npcsByRole('parent').filter((n) => n.age < 80).sort((a, b) => b.meters.relationship - a.meters.relationship)[0];
  const sib = npcsByRole('sibling').filter((n) => n.age >= 21).sort((a, b) => b.meters.relationship - a.meters.relationship)[0];
  const carer = partner ?? gran ?? sib ?? null;
  for (const kid of kids) {
    c.guardians[kid.id] = carer?.id ?? 'care';
    kid.flags.guardian = carer ? `${carer.firstName} ${carer.lastName}` : 'foster care';
  }
  const names = kids.map((x) => x.firstName).join(' and ');
  log(carer ? `${names} will live with ${carer.firstName} while you are away. You are still their parent.` : `With nobody in the family able to take them, ${names} go into foster care. You are still their parent, and you can still write.`, 'system', carer ? 'neutral' : 'bad');
}

// ---------- What there is to do ----------

/** The older actions inside: yard, library, gangs, riots, escape. */
export function prisonActions() {
  const c = cell();
  if (!c) return [];
  const a = [{ id: 'workout', label: 'Work out in the yard' }, { id: 'read', label: 'Read in the library' }];
  if (!isJuvenile()) {
    a.push(c.gangId ? { id: 'leaveGang', label: `Leave ${gang().name}`, danger: true } : { id: 'gang', label: 'Join a gang', danger: true });
    a.push({ id: 'riot', label: 'Start a riot', danger: true });
  }
  a.push({ id: 'escape', label: 'Attempt an escape', danger: true });
  return a;
}

export function workOut() {
  const p = player();
  if (!once('workout')) return result(false, 'You have already put the hours in this year.', 'neutral');
  p.stats.health = clamp(p.stats.health + 5);
  p.stats.charm = clamp(p.stats.charm + 1);
  bump('respect', 4);
  const text = 'An hour in the yard every day. You are stronger, and people have noticed.';
  log(text, 'system', 'good');
  return result(true, text);
}

export function read() {
  const p = player();
  if (!once('read')) return result(false, 'You have read everything on the trolley this year.', 'neutral');
  p.stats.intellect = clamp(p.stats.intellect + 3);
  p.stats.mood = clamp(p.stats.mood + 2);
  bump('conduct', 5);
  const text = 'You read your way along the library shelf, one spine at a time.';
  log(text, 'system', 'good');
  return result(true, text);
}

/** How the year is spent when nothing else is chosen. */
export const routineOptions = () => ROUTINES.map((r) => ({ ...r, now: cell()?.routine === r.id }));
export function setRoutine(id) {
  const r = ROUTINES.find((x) => x.id === id);
  if (!r || !cell()) return result(false, 'That is not on offer.', 'neutral');
  cell().routine = id;
  return result(true, `Your days are built around ${r.name.toLowerCase()} now.`, 'neutral');
}

// ---------- Education ----------

const held = (type) => player().education.degrees.some((d) => d.type === type);

/** Courses this facility can offer the player, and why any are closed. */
export function programmeOptions() {
  const f = facility();
  const c = cell();
  if (!f || !c) return [];
  const sys = k.lawAt(f.countryId);
  const sec = f.kind === 'juvenile' ? 'min' : f.kind;
  return PROGRAMMES.map((x) => {
    let why = '';
    if (RANK[sec] > RANK[x.security]) why = 'Not offered at this security level.';
    else if (sys.schooling < x.schooling) why = 'Not offered in prisons here.';
    else if (x.from && year() < x.from) why = 'Not yet available.';
    else if (x.needs && !held(x.needs)) why = 'Needs a school-leaving certificate first.';
    else if (x.notHeld && held(x.notHeld)) why = 'You already have this.';
    else if (c.studied?.[x.id]) why = 'Completed.';
    else if (x.gives && x.years > c.yearsLeft && c.yearsLeft < LIFE_SENTENCE) why = `Takes ${x.years} years; you have ${c.yearsLeft} left. You can finish it outside.`;
    return { ...x, ok: !why, why, now: c.programme?.id === x.id };
  });
}

export function enrol(id) {
  const c = cell();
  const x = programmeOptions().find((y) => y.id === id);
  if (!x?.ok) return result(false, x?.why || 'That course is not on offer.', 'neutral');
  if (c.programme && c.programme.id !== id) return result(false, `Finish ${PROGRAMME_BY_ID[c.programme.id].name.toLowerCase()} first, or leave it.`, 'neutral');
  c.programme = { id, progress: 0, since: year() };
  const teacher = staffNear().find((s) => s.role.id === 'teacher')?.npc;
  const text = `You are enrolled: ${x.name.toLowerCase()}.${teacher ? ` ${teacher.firstName} ${teacher.lastName} runs the class.` : ''}`;
  log(text, 'system', 'good');
  k.note(player().id, 'education', `Began ${x.name.toLowerCase()} in custody.`);
  return result(true, text);
}
export function leaveCourse() {
  const c = cell();
  if (!c?.programme) return result(false, 'You are not on a course.', 'neutral');
  const x = PROGRAMME_BY_ID[c.programme.id];
  c.programme = null;
  return result(true, `You left ${x.name.toLowerCase()}.`, 'neutral');
}

/** A year of study. Completion goes into the real education record. */
function study(c) {
  if (!c.programme) return;
  const p = player();
  const x = PROGRAMME_BY_ID[c.programme.id];
  const pace = c.routine === 'study' ? 1 : 0.7;
  c.programme.progress = Math.round((c.programme.progress + pace * (0.85 + p.stats.intellect / 400)) * 100) / 100;
  if (x.stat) p.stats[x.stat] = clamp(p.stats[x.stat] + 3);
  if (c.programme.progress < x.years) return;
  c.studied[x.id] = year();
  c.programme = null;
  const f = facility();
  if (x.gives) {
    const gpa = Math.round(clamp(2.3 + p.stats.intellect / 80 + (c.routine === 'study' ? 0.3 : 0) + rng.next() * 0.3, 2, 4) * 100) / 100;
    p.education.degrees.push({ ...x.gives, gpa, age: p.age, school: `${f?.name ?? 'Prison'} education department`, countryId: p.countryId, inCustody: true });
    milestone(`Earned a qualification inside: ${x.name.toLowerCase()}.`, 'education');
  }
  p.stats.mood = clamp(p.stats.mood + 6);
  bump('conduct', 6);
  log(`You completed ${x.name.toLowerCase()}.${x.gives ? ' The qualification is yours, and it counts outside.' : ''}`, 'system', 'good');
  k.note(p.id, 'education', `Completed ${x.name.toLowerCase()} in custody.`);
}

// ---------- Work ----------

export function jobOptions() {
  const f = facility();
  const c = cell();
  if (!f || !c) return [];
  const sec = f.kind === 'juvenile' ? 'min' : f.kind;
  const pay = k.lawAt(f.countryId).wage;
  return PRISON_JOBS.map((j) => {
    const why = j.security && RANK[sec] > RANK[j.security] ? 'Only in open conditions.' : j.needs && !held(j.needs) ? 'Needs a school-leaving certificate.' : '';
    return { ...j, ok: !why, why, pay: localMoney(pay * j.pay, country()), now: c.job?.id === j.id };
  });
}
export function takeJob(id) {
  const c = cell();
  const j = jobOptions().find((x) => x.id === id);
  if (!j?.ok) return result(false, j?.why || 'That work is not on offer.', 'neutral');
  c.job = { id, since: year() };
  const text = `You are on the ${j.name.toLowerCase()} detail. It pays ${fmtMoney(j.pay, country())} a year.`;
  log(text);
  return result(true, text, 'neutral');
}

/** A year of work: pay, the skill it trains, and a line in the work record. */
function work(c) {
  if (!c.job) return;
  const p = player();
  const j = PRISON_JOB_BY_ID[c.job.id];
  const f = facility();
  const full = c.routine === 'work' ? 1.3 : 1;
  const pay = Math.round(localMoney(k.lawAt(f.countryId).wage * j.pay, country()) * full);
  k.pay({ key: `wage:${c.id}:${year()}`, kind: 'prison_wage', amount: pay, payer: 'state', payee: p.id, caseId: c.caseId });
  if (j.skill) (p.skills ??= {})[j.skill] = clamp((p.skills[j.skill] ?? 0) + 6 * full);
  if (j.stat) p.stats[j.stat] = clamp(p.stats[j.stat] + 1);
  p.hidden.discipline = clamp(p.hidden.discipline + 2);
  bump('conduct', 4);
  c.work.push({ year: year(), jobId: j.id, hours: Math.round(1200 * full), pay });
}

// ---------- Family and friends ----------

/** Everyone the player can still reach from inside. */
export function contacts() {
  const roles = ['spouse', 'partner', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'friend', 'relative'];
  return livingNpcs().filter((n) => roles.includes(n.role)).sort((a, b) => roles.indexOf(a.role) - roles.indexOf(b.role) || b.meters.relationship - a.meters.relationship);
}

export function writeLetter(npcId) {
  const n = store.state.npcs[npcId];
  if (!n?.alive) return result(false, 'There is nobody to write to.', 'neutral');
  if (!count('letters', 4)) return result(false, 'You have used this year\'s writing paper and stamps.', 'neutral');
  if (acts()[`wrote_${npcId}`]) return result(false, `You have already written to ${n.firstName} this year.`, 'neutral');
  acts()[`wrote_${npcId}`] = true;
  cell().letters += 1;
  const answered = rng.chance(clamp((n.meters.relationship + 20) / 100, 0.15, 0.95));
  n.meters.relationship = clamp(n.meters.relationship + (answered ? rng.int(5, 9) : 2));
  player().stats.mood = clamp(player().stats.mood + (answered ? 4 : 0));
  const text = answered ? `${n.firstName} wrote back: three pages, both sides.` : `You wrote to ${n.firstName}. No reply yet.`;
  if (answered && n.age < 18 && n.role === 'child') remember(n, 'lettersInside', 'Their parent wrote to them from prison, and they wrote back.');
  log(text, 'system', answered ? 'good' : 'neutral');
  return result(answered, text, answered ? 'good' : 'neutral');
}

export function phoneCall(npcId) {
  const n = store.state.npcs[npcId];
  if (!n?.alive) return result(false, 'There is nobody to call.', 'neutral');
  if (!count('calls', 3)) return result(false, 'Your phone credit for the year is gone.', 'neutral');
  const cost = localMoney(15, country());
  if (!k.pay({ key: `call:${cell().id}:${year()}:${acts().calls}`, kind: 'phone', amount: cost, payer: player().id, payee: 'state', caseId: cell().caseId })) return result(false, 'You cannot afford the phone credit.', 'neutral');
  cell().calls += 1;
  n.meters.relationship = clamp(n.meters.relationship + 5);
  player().stats.mood = clamp(player().stats.mood + 4);
  const text = `Ten minutes on the wing phone with ${n.firstName}. The queue behind you grumbles; you do not care.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** Whether someone would come, and if not, why. They decide; not every relative says yes. */
function visitAnswer(n) {
  const c = cell();
  const f = facility();
  if (n.flags.abroad) return { yes: false, why: `${n.firstName} lives abroad. ${year() >= EVIDENCE_FROM.video_call ? 'A video call is the closest you will get.' : 'Letters will have to do.'}` };
  if (n.age < 16) {
    const g = store.state.npcs[c.guardians?.[n.id]];
    if (c.guardians?.[n.id] === 'care') return { yes: rng.chance(0.5), why: `${n.firstName}'s social worker could not arrange it this time.`, with: 'their social worker' };
    if (n.age < 16 && g && g.meters.relationship < 35) return { yes: false, why: `${g.firstName}, who looks after ${n.firstName}, will not bring them.` };
    return { yes: true, with: g ? g.firstName : null };
  }
  if (n.meters.relationship < 25) return { yes: false, why: `${n.firstName} does not want to come.` };
  if (typeof n.savings === 'number' && n.savings < localMoney(50, country()) && rng.chance(0.4)) return { yes: false, why: `${n.firstName} cannot afford the journey to ${f.city} this time.` };
  return { yes: rng.chance(clamp((n.meters.relationship + 10) / 100, 0.2, 0.95)), why: `${n.firstName} said they could not face it this time.` };
}

export function requestVisit(npcId) {
  const n = store.state.npcs[npcId];
  const c = cell();
  if (!n?.alive) return result(false, 'There is nobody to ask.', 'neutral');
  if (!count('visits', 2)) return result(false, 'You have used this year\'s visiting orders.', 'neutral');
  const a = visitAnswer(n);
  if (!a.yes) { log(a.why, 'system', 'neutral'); return result(false, a.why, 'neutral'); }
  c.visits.push({ year: year(), npcId: n.id });
  const tense = n.meters.relationship < 40 && rng.chance(0.5);
  if (tense) {
    n.meters.relationship = clamp(n.meters.relationship - 3);
    const text = `${n.firstName} came${a.with ? ` with ${a.with}` : ''}. It started well and ended in an argument about how you got here. They still came.`;
    log(text, 'system', 'neutral');
    remember(n, 'hardVisit', 'They visited you inside, and it was hard.');
    return result(true, text, 'neutral');
  }
  n.meters.relationship = clamp(n.meters.relationship + rng.int(8, 14));
  player().stats.mood = clamp(player().stats.mood + 7);
  remember(n, 'visitedInside', n.role === 'child' ? 'They came to see their parent in prison.' : 'They visited you inside.');
  const text = `${n.firstName} came to see you${a.with ? `, brought by ${a.with}` : ''}. An hour across a table, and it is the best hour of the month.`;
  log(text, 'system', 'good');
  k.note(player().id, 'visit', `Visited by ${n.firstName} ${n.lastName}.`);
  return result(true, text);
}

// ---------- People inside ----------

/** Getting to know someone on the wing. Only the willing become friends. */
export function getToKnow(npcId) {
  const n = store.state.npcs[npcId];
  const p = player();
  if (!n?.alive || !n.flags.inmate) return result(false, 'They are not here.', 'neutral');
  if (acts()[`met_${npcId}`]) return result(false, `You have already spent time with ${n.firstName} this year.`, 'neutral');
  acts()[`met_${npcId}`] = true;
  if (!p.npcIds.includes(n.id)) { p.npcIds.push(n.id); n.role = 'cellmate'; n.flags.title = 'Met inside'; n.meters.relationship = rng.int(25, 45); }
  const warm = rng.chance(clamp((p.stats.charm + n.meters.relationship) / 150, 0.2, 0.9));
  n.meters.relationship = clamp(n.meters.relationship + (warm ? rng.int(8, 15) : 2));
  const i = n.flags.inmate;
  const text = warm ? `You and ${n.firstName} get talking about ${i.interest}. It turns out they ${i.background}, and they want to ${i.goal}.`
    : `${n.firstName} keeps to themselves, but nods at you now on the landing.`;
  if (warm && n.meters.relationship >= 60) remember(n, 'friendInside', 'You became friends inside.');
  log(text, 'system', warm ? 'good' : 'neutral');
  return result(warm, text, warm ? 'good' : 'neutral');
}

/** Studying alongside a friend inside: both make progress, and the friendship grows. */
export function studyTogether(npcId) {
  const n = store.state.npcs[npcId];
  const c = cell();
  if (!c?.programme) return result(false, 'You need to be on a course first.', 'neutral');
  if (!n?.flags.inmate || !once(`studied_${npcId}`)) return result(false, 'Not this year.', 'neutral');
  n.flags.inmate.studying = c.programme.id;
  c.programme.progress += 0.15;
  n.meters.relationship = clamp(n.meters.relationship + 8);
  remember(n, 'studiedInside', 'You studied together inside.');
  const text = `You and ${n.firstName} quiz each other after lock-up. You are both further on for it.`;
  log(text, 'system', 'good');
  return result(true, text);
}

// ---------- Health, programmes and conduct ----------

export function healthcare() {
  const p = player();
  if (!once('healthcare')) return result(false, 'You have had your appointment this year.', 'neutral');
  const untreated = p.conditions.find((x) => !x.treated);
  if (untreated) {
    const ok = rng.chance(0.7);
    if (ok) untreated.treated = true;
    const text = ok ? `The prison doctor saw you about your ${untreated.name} and started treatment.` : `You were put on a waiting list for your ${untreated.name}.`;
    log(text, 'system', ok ? 'good' : 'neutral');
    return result(ok, text, ok ? 'good' : 'neutral');
  }
  p.stats.health = clamp(p.stats.health + 3);
  const text = 'A check-up in the healthcare unit. Nothing to worry about.';
  log(text, 'system', 'good');
  return result(true, text);
}

export function counselling() {
  const p = player();
  if (!once('counselling')) return result(false, 'Your sessions for the year are booked.', 'neutral');
  p.stats.mood = clamp(p.stats.mood + 7);
  bump('conduct', 4);
  c2().courses = (c2().courses ?? 0) + 0.5;
  const text = 'Weekly sessions with the counsellor. Some weeks you talk about nothing; some weeks about everything.';
  log(text, 'system', 'good');
  return result(true, text);
}
const c2 = () => cell();

export function joinCourse() {
  if (!once('course')) return result(false, 'You are already on a course this year.', 'neutral');
  const c = cell();
  c.courses = (c.courses ?? 0) + 1;
  bump('conduct', 6);
  const text = 'A rehabilitation course: twelve weeks of looking hard at choices, yours included.';
  log(text, 'system', 'good');
  k.note(player().id, 'programme', 'Completed a rehabilitation course in custody.');
  return result(true, text);
}

/** Ways to deal with trouble that are not fighting. */
export function seekHelp(how) {
  const c = cell();
  if (!once(`help_${how}`)) return result(false, 'You have already done that this year.', 'neutral');
  if (how === 'report') { bump('conduct', 6); bump('respect', -4); c.safe = year(); }
  if (how === 'mediation') { bump('respect', 2); bump('conduct', 4); c.safe = year(); }
  if (how === 'transfer') { bump('respect', -6); c.safe = year(); }
  const text = { report: 'You told an officer about the threats. They moved the man concerned to another landing.',
    mediation: 'The chaplain sat you and the other man down. It did not make you friends, but it ended it.',
    transfer: 'You asked for a move to another wing, and got one. Quieter, and further from trouble.' }[how];
  c.discipline.push({ year: year(), kind: 'safety', text });
  log(text, 'system', 'good');
  return result(true, text);
}

/** Records an adjudication: the allegation, and what was found. */
function adjudicate(allegation, proven, penalty) {
  cell().discipline.push({ year: year(), allegation, finding: proven ? 'proven' : 'not proven', penalty: proven ? penalty : null });
}

// ---------- Gangs, riots, escape (unchanged rules, now recorded) ----------

/** @returns {{id, name, blurb, open:boolean, respect:number}[]} */
export const gangOptions = () => GANGS.map((g) => ({ ...g, open: cell().respect >= g.respect }));

export function joinGang(id) {
  const g = GANGS.find((x) => x.id === id);
  if (cell().respect < g.respect) return result(false, `${g.name} will not have you. You need more respect.`, 'neutral');
  cell().gangId = id;
  bump('respect', 10);
  bump('conduct', -10);
  const text = `You are with ${g.name} now. Nobody touches you. The officers have made a note.`;
  log(text);
  return result(true, text, 'neutral');
}

export function leaveGang() {
  const p = player();
  const g = gang();
  if (!g) return result(false, 'You are not in a gang.', 'neutral');
  cell().gangId = null;
  bump('respect', -15);
  const hurt = rng.chance(0.5);
  if (hurt) p.stats.health = clamp(p.stats.health - rng.int(8, 20));
  const text = hurt ? `You walked away from ${g.name}. It cost you a few bruises, and you asked to be moved.`
    : `You walked away from ${g.name}. They let you go, for now.`;
  log(text, 'system', hurt ? 'bad' : 'neutral');
  return result(!hurt, text, hurt ? 'bad' : 'neutral');
}

export function startRiot() {
  const p = player();
  const c = cell();
  if (!once('riot')) return result(false, 'The wing is locked down after the last one.', 'neutral');
  const chance = clamp(0.2 + (c.respect - 40) / 100 + (p.talents.crime - 50) / 250 + (c.gangId ? 0.15 : 0), 0.05, 0.85);
  bump('conduct', -30);
  if (rng.chance(chance)) {
    bump('respect', 25);
    p.stats.mood = clamp(p.stats.mood + 6);
    adjudicate('Inciting disorder', false);
    const text = 'The wing goes up at your word. By the time it is put down, everyone inside knows who started it, and nobody can prove it.';
    log(text, 'system', 'neutral');
    return result(true, text, 'neutral');
  }
  const extra = rng.int(1, 3);
  if (c.yearsLeft < LIFE_SENTENCE) {
    c.yearsLeft += extra; c.total += extra;
    const s = k.J().sentences[c.sentenceId];
    if (s) k.modify(s, extra, 'Added after a proven charge of inciting disorder in custody.');
  }
  adjudicate('Inciting disorder', true, `${extra} added year${extra === 1 ? '' : 's'}`);
  p.stats.health = clamp(p.stats.health - rng.int(5, 18));
  bump('respect', 5);
  const text = `The riot is over in twenty minutes and you are named as the ringleader. A hearing finds it proven: ${extra} more year${extra === 1 ? '' : 's'}.`;
  log(text, 'system', 'bad');
  return result(false, text);
}

// ---------- Appeals from inside ----------

export const APPEAL_COST = 8000;
/** The case behind this sentence, if it has full court records. */
export const custodyCase = () => k.J().cases[cell()?.caseId] ?? null;

/** For sentences from before the court records existed: one appeal against sentence. */
export function appeal() {
  const p = player();
  const c = cell();
  if (custodyCase()) return result(false, 'Appeal through your case file.', 'neutral');
  const cost = localMoney(APPEAL_COST, country());
  if (c.appealed) return result(false, 'You have already appealed.', 'neutral');
  if (p.finance.cash < cost) return result(false, `An appeal lawyer costs ${fmtMoney(cost, country())}.`, 'neutral');
  k.pay({ key: `appeal:${c.id}:legacy`, kind: 'legal_fee', amount: cost, payer: p.id, payee: 'counsel', caseId: null });
  c.appealed = true;
  if (rng.chance(clamp(0.25 + (c.conduct - 50) / 200, 0.05, 0.6))) {
    const cut = Math.max(1, Math.round(c.yearsLeft * 0.4));
    c.yearsLeft -= cut;
    const text = c.yearsLeft <= 0 ? 'Your appeal succeeded, and you are free.' : `Your appeal succeeded. ${cut} year${cut === 1 ? '' : 's'} came off your sentence.`;
    log(text, 'system', 'good');
    if (c.yearsLeft <= 0) release('The gate opens. Your appeal has set you free.');
    return result(true, text);
  }
  const text = 'Three judges read your appeal and dismissed it in a paragraph.';
  log(text, 'system', 'bad');
  return result(false, text);
}

/**
 * Appeals a case on one ground. Legal aid pays where the appellant qualifies.
 * Works from inside or outside.
 */
export function appealCase(caseId, ground) {
  const p = player();
  const c = k.J().cases[caseId];
  if (!c || c.defendantId !== p.id) return result(false, 'There is no such case.', 'neutral');
  const cost = p.finance.cash < localMoney(25000, country()) ? 0 : localMoney(APPEAL_COST, country());
  if (cost && !k.pay({ key: `appeal:${caseId}:${ground}`, kind: 'legal_fee', amount: cost, payer: p.id, payee: c.defenceId ?? 'counsel', caseId })) {
    return result(false, `An appeal costs ${fmtMoney(cost, country())}.`, 'neutral');
  }
  const r = k.fileAppeal(c, ground);
  if (!r) return result(false, 'That ground cannot be argued again.', 'neutral');
  const s = k.J().sentences[c.sentenceId];
  const here = cell();
  if (r.outcome === 'sentence reduced' && here?.caseId === caseId) {
    const last = s.modifications[s.modifications.length - 1];
    const cut = last.from - last.to;
    here.yearsLeft = Math.max(0, here.yearsLeft - cut);
    here.total = Math.max(here.served, here.total - cut);
  }
  log(r.text, 'system', r.outcome === 'dismissed' ? 'bad' : 'good');
  if (['conviction quashed', 'exonerated'].includes(r.outcome)) {
    if (r.outcome === 'exonerated') milestone('Exonerated.', 'crime');
    if (legal().supervision?.caseId === caseId) legal().supervision = null;
    if (here?.caseId === caseId) release(r.outcome === 'exonerated' ? 'You walk out of the gate exonerated. The years cannot be given back; the record, at least, now tells the truth.' : 'Your conviction has been quashed. You are free to go.');
  } else if (here?.caseId === caseId && here.yearsLeft <= 0) release('With the reduced sentence, your time is already served.');
  return result(r.outcome !== 'dismissed', r.text);
}

// ---------- Escape ----------

export const escapeLayout = () => LAYOUTS[{ min: 0, med: 1, max: 2 }[cell().security]];

/** Uses up this year's attempt. @returns {boolean} whether an attempt can start */
export function beginEscape() {
  if (!cell() || !once('escape')) return false;
  cell().escapeAttempts += 1;
  return true;
}

/** Settles an escape attempt once the puzzle is over. */
export function finishEscape(escaped) {
  const p = player();
  const c = cell();
  if (escaped) {
    p.flags.fugitive = { owed: c.yearsLeft, security: c.security, caseId: c.caseId, sentenceId: c.sentenceId, since: year() };
    p.legal.heat = 100;
    p.counters.escapes += 1;
    k.note(p.id, 'escaped', 'Escaped from custody.', c.caseId);
    release('You are over the wall and running. You are free, and you are wanted.', { escape: true });
    milestone('Escaped from prison.', 'crime');
    return result(true, 'You are out. Every police force in the country has your photograph.');
  }
  if (c.yearsLeft < LIFE_SENTENCE) { c.yearsLeft += ESCAPE_PENALTY; c.total += ESCAPE_PENALTY; }
  adjudicate('Attempting to escape', true, `${ESCAPE_PENALTY} added years`);
  bump('conduct', -25);
  bump('respect', 6);
  p.stats.mood = clamp(p.stats.mood - 8);
  const text = `A torch finds you. ${ESCAPE_PENALTY} more years, and a month in segregation to think about it.`;
  log(text, 'system', 'bad');
  return result(false, text);
}

// ---------- Release ----------

/** When the player could get out, as far as the law lets anyone say. */
export function releaseOutlook() {
  const c = cell();
  if (!c) return null;
  const sys = k.lawAt(player().countryId);
  if (c.deathRow) return { text: 'Sentenced to death. Appeals are the only road out.', at: null };
  if (c.total >= LIFE_SENTENCE) return { text: `A life sentence. The parole board can first consider release after ${Math.max(0, 15 - c.served)} more year${15 - c.served === 1 ? '' : 's'}.`, at: null };
  const at = Math.ceil(c.total * sys.releaseAt);
  const left = Math.max(0, at - c.served);
  const end = `Sentence ends in ${c.yearsLeft} year${c.yearsLeft === 1 ? '' : 's'}.`;
  if (sys.release === 'automatic') return { text: `${end} Release on licence ${left ? `in ${left} year${left === 1 ? '' : 's'}` : 'is due'}, under supervision for the rest of the term.`, at };
  return { text: `${end} ${left ? `Eligible for a parole review in ${left} year${left === 1 ? '' : 's'}.` : 'Eligible for parole review.'}`, at };
}

/** A parole review is due, and the player can take part. */
export const paroleDue = () => !!cell()?.paroleDue;

/**
 * The parole board's review. What the player says is part of it, not the
 * whole of it: the record inside and a plan for outside count more.
 * @param {'responsibility'|'plan'|'innocence'|'file'} approach
 */
export function paroleHearing(approach = 'file') {
  const p = player();
  const c = cell();
  if (!c?.paroleDue) return result(false, 'No review is due.', 'neutral');
  c.paroleDue = false;
  const inc = k.J().incidents[custodyCase()?.incidentId];
  const sev = OFFENSE_BY_ID[k.J().sentences[c.sentenceId]?.offenseId]?.severity ?? 3;
  const home = [...npcsByRole('spouse'), ...npcsByRole('partner'), ...npcsByRole('parent'), ...npcsByRole('sibling')].some((n) => n.meters.relationship >= 45 && !n.flags.abroad);
  const studied = Object.keys(c.studied ?? {}).length;
  const reasons = [];
  let score = (c.conduct - 50) / 100 + Math.min(studied, 3) * 0.08 + Math.min(c.courses ?? 0, 3) * 0.05 + (home ? 0.12 : -0.05) - (sev - 2) * 0.07 - (c.gangId ? 0.15 : 0)
    - c.discipline.filter((d) => d.finding === 'proven' && year() - d.year <= 3).length * 0.1 + (rng.next() - 0.5) * 0.15;
  if (approach === 'responsibility') score += inc?.truth.perpetratorId === p.id ? 0.06 : 0;
  if (approach === 'plan') score += home ? 0.05 : 0;
  reasons.push(c.conduct >= 60 ? 'a good record inside' : 'concerns about conduct inside');
  if (studied) reasons.push(`${studied} course${studied === 1 ? '' : 's'} completed`);
  reasons.push(home ? 'somewhere to live on release' : 'no settled address to go to');
  if (c.gangId) reasons.push('gang membership');
  const granted = score >= 0.12;
  const next = sev >= 4 ? 2 : 1;
  c.reviews.push({ year: year(), approach, granted, reasons, next: granted ? null : year() + next });
  c.nextReview = granted ? null : year() + next;
  k.note(p.id, 'parole', `Parole review: ${granted ? 'release granted' : 'release refused'}.`, c.caseId);
  if (granted) {
    release(`The parole board granted your release (${reasons.join(', ')}). You walk out on parole.`, { parole: true });
    return result(true, 'Parole granted.');
  }
  const text = `The parole board refused release for now (${reasons.join(', ')}). The next review is in ${next} year${next === 1 ? '' : 's'}.`;
  log(text, 'system', 'bad');
  return result(false, text);
}

// ---------- The year ----------

/** Facilities change: inmates are released, newcomers arrive, staff move on. */
function tickFacilities() {
  const J = k.J();
  const p = player();
  for (const f of Object.values(J.facilities)) {
    for (const id of [...f.inmateIds]) {
      const n = store.state.npcs[id];
      if (!n?.alive || !n.flags.inmate) { f.inmateIds = f.inmateIds.filter((x) => x !== id); continue; }
      const i = n.flags.inmate;
      i.yearsLeft -= 1;
      if (i.yearsLeft > 0) continue;
      f.inmateIds = f.inmateIds.filter((x) => x !== id);
      f.released.push({ id, year: year() });
      i.released = year();
      i.facilityId = null;
      if (n.flags.justice) n.flags.justice.kind = 'released';
      (n.flags.legalHistory ??= []).push({ year: year(), age: n.age, kind: 'released', text: `Released from ${f.name}.` });
      if (i.kin) {
        // Family stays family.
        if (p.npcIds.includes(id)) log(`${n.firstName} has been released from ${f.name}${p.legal.incarceration ? '' : ', and comes home'}.`, 'system', 'good');
        continue;
      }
      const friend = p.npcIds.includes(id) && n.role === 'cellmate';
      if (friend && n.meters.relationship >= 50) {
        n.role = 'friend';
        n.flags.title = 'Friend (met inside)';
        log(`${n.firstName} ${n.lastName} has been released. They promise to write${cell() ? ' and to visit' : ''}.`, 'system', 'good');
      } else if (friend) p.npcIds = p.npcIds.filter((x) => x !== id);
    }
    while (f.inmateIds.length < 6) f.inmateIds.push(newInmate(f).id);
    staffUp(f);
  }
}

/** Yearly: time served, what the year was spent on, contact, reviews, release, and life on the run. */
export function tickPrison() {
  const p = player();
  const c = cell();
  tickFacilities();

  // On the run: sooner or later someone recognises you.
  if (!c && p.flags.fugitive) {
    if (rng.chance(0.22)) recapture();
    else { p.legal.heat = Math.max(p.legal.heat, 60); p.stats.mood = clamp(p.stats.mood - 3); }
    return;
  }
  if (!c) return;

  c.yearsLeft -= 1;
  c.served += 1;
  p.counters.yearsJailed += 1;
  // How the year felt depends on what filled it, and who stayed in touch.
  const contact = c.visits.filter((v) => v.year === year() - 1 || v.year === year()).length + (acts().letters ?? 0) * 0.5 + (acts().calls ?? 0) * 0.5;
  p.stats.mood = clamp(p.stats.mood - (c.security === 'max' ? 6 : 4) + Math.min(contact, 4) + (c.programme ? 1 : 0));
  if (c.security === 'max') p.stats.health = clamp(p.stats.health - 1);
  if (c.routine === 'fitness') p.stats.health = clamp(p.stats.health + 3);
  if (c.routine === 'programmes') { bump('conduct', 5); c.courses = (c.courses ?? 0) + 0.5; }
  if (c.routine === 'family') for (const n of contacts().slice(0, 2)) n.meters.relationship = clamp(n.meters.relationship + 3);
  study(c);
  work(c);
  for (const n of contacts()) if (n.role === 'cellmate') n.meters.relationship = clamp(n.meters.relationship + 2);

  const g = gang();
  if (g) {
    bump('respect', g.perYear);
    bump('conduct', g.conduct ?? -4);
    if (g.health) p.stats.health = clamp(p.stats.health + g.health);
    if (g.income) {
      const cut = localMoney(g.income, country());
      p.finance.cash += cut;
      log(`Your share of ${g.name}'s business came to ${fmtMoney(cut, country())} this year.`);
    }
  } else bump('respect', -2);
  bump('conduct', 3);

  if (!g && !isJuvenile() && c.respect < 25 && c.safe !== year() - 1 && rng.chance(0.15)) {
    p.stats.health = clamp(p.stats.health - rng.int(4, 10));
    log('There was trouble on the landing, and you got caught up in it. You could ask staff for help, or for a move.', 'system', 'bad');
  }

  // A good record earns a move to lower security; a bad one, a move up.
  if (!isJuvenile() && !c.deathRow) {
    const why = transferCase(c);
    if (why.down) transfer(DOWN[c.security], why.text);
    else if (why.up) transfer(UP[c.security], 'A string of proven offences inside: you are moved to tighter security.');
  }

  // Coming of age inside: the rest of the term is served somewhere else.
  if (isJuvenile() && p.age >= systemFor(p.countryId).adultAge) {
    if (c.yearsLeft <= 0) return release('You were released from youth detention. Your juvenile record is sealed.');
    c.facility = 'prison';
    c.security = 'min';
    const f = facilityFor(p.countryId, 'min');
    c.facilityId = f.id;
    log(`Now an adult, you are moved to ${f.name} for the rest of your term.`);
  }
  if (c.yearsLeft <= 0) return release();
  // Release before the end of the term, as the law here provides.
  const sys = k.lawAt(p.countryId);
  const life = c.total >= LIFE_SENTENCE;
  const at = life ? 15 : Math.ceil(c.total * sys.releaseAt);
  if (!c.deathRow && c.served >= at) {
    if (sys.release === 'automatic' && !life) return release(`You have served the part of your sentence the law requires. You are released on licence for the remaining ${c.yearsLeft} year${c.yearsLeft === 1 ? '' : 's'}.`, { parole: true });
    if (c.paroleDue) paroleHearing('file'); // a review left waiting is decided on the file
    else if (!c.nextReview || year() >= c.nextReview) {
      c.paroleDue = true;
      log('Your case is listed for a parole review. You can prepare for it.', 'system', 'neutral');
    }
  }
  return undefined;
}

// ---------- Transfers ----------

const DOWN = { max: 'med', med: 'min' };
const UP = { min: 'med', med: 'max' };

/** Whether a move is due, and why or why not. */
function transferCase(c) {
  const recent = c.discipline.filter((d) => d.finding === 'proven' && year() - d.year <= 2).length;
  const life = c.total >= LIFE_SENTENCE;
  const enough = c.served >= (life ? 10 : Math.max(2, Math.ceil(c.total / 3)));
  if (UP[c.security] && c.conduct <= 15 && recent >= 1) return { up: true };
  if (!DOWN[c.security]) return { text: 'You are already in open conditions.' };
  if (!enough) return { text: `Not yet: you must serve ${life ? 10 : Math.max(2, Math.ceil(c.total / 3))} years first.` };
  if (recent) return { text: 'Not with a proven offence inside in the last two years.' };
  if (c.gangId) return { text: 'Not while you are in a gang.' };
  if (c.conduct < 75) return { text: 'Your conduct record needs to be better.' };
  return { down: true, text: c.security === 'med' ? 'Your record inside has earned a move to open conditions.' : 'Your record inside has earned a move to lower security.' };
}

/** Moves the player to another facility. Friends stay friends; the cell and the cellmate change. */
function transfer(security, why) {
  const p = player();
  const c = cell();
  const from = facility();
  const f = facilityFor(p.countryId, security);
  for (const mate of npcsByRole('cellmate')) if (mate.flags.inmate?.facilityId === from?.id && mate.meters.relationship < 60) p.npcIds = p.npcIds.filter((id) => id !== mate.id);
  c.security = security;
  c.facilityId = f.id;
  (c.transfers ??= []).push({ year: year(), from: from?.id ?? null, to: f.id, why });
  if (c.job && !jobOptions().find((j) => j.id === c.job.id)?.ok) c.job = null;
  const mate = rng.pick(f.inmateIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && !p.npcIds.includes(n.id)));
  if (mate) { mate.role = 'cellmate'; mate.meters.relationship = rng.int(30, 55); p.npcIds.push(mate.id); }
  k.note(p.id, 'transfer', `Moved to ${f.name}.`, c.caseId);
  log(`${why} You are moved to ${f.name}.${mate ? ` Your new cellmate is ${mate.firstName} ${mate.lastName}.` : ''}`, 'system', UP[from?.kind] === security ? 'bad' : 'good');
}

/** Applying for a move to lower security. The record decides. */
export function requestTransfer() {
  const c = cell();
  if (!c || isJuvenile()) return result(false, 'There is nowhere to move you.', 'neutral');
  if (!once('transfer')) return result(false, 'You have already applied this year.', 'neutral');
  const why = transferCase(c);
  if (!why.down) return result(false, `Your application was refused. ${why.text}`, 'neutral');
  transfer(DOWN[c.security], why.text);
  return result(true, `Your application was granted. You are now at ${facility().name}.`);
}

/** Recaptured after an escape: back to custody, and a new charge. */
function recapture() {
  const p = player();
  const f = p.flags.fugitive;
  p.flags.fugitive = null;
  const inc = k.createIncident({ offenseId: 'escape', perpetratorId: p.id, countryId: p.countryId, city: p.city });
  const inv = k.openInvestigation(inc, { redHanded: true });
  const c = k.decideCharge(inv, p.id);
  let extra = RECAPTURE_PENALTY;
  if (c) {
    k.runToEnd(c, { plea: 'guilty' });
    const s = k.J().sentences[c.sentenceId];
    if (s) { extra = Math.max(1, s.years); s.status = 'active'; }
  }
  log(`You were recognised and recaptured. A court added ${extra} year${extra === 1 ? '' : 's'} for the escape.`, 'system', 'bad');
  imprison(f.owed + extra, 3, { caseId: f.caseId, sentenceId: f.sentenceId });
}

/** The courts that hear appeals here. */
export const appealCourt = () => courtsFor(player().countryId).appeal;
