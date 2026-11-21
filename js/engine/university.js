// Getting into university: the institutions of a country, the player's round
// of applications, each institution's answer and the help it offers, and
// taking up a place. How an application is judged is in engine/admissions.js;
// life once enrolled is in engine/education.js.
//
// The world:
//   state.universities  { id: { id, kind, name, countryId, city, founded, alumni: [names] } }
//     Made once for each country, from the patterns in data/universities.js, and kept for good.
// On the player:
//   p.education.tries = { majorId: { instId: { n, best, last, outcomes: [] } } }  every place applied to, and how it went: kept across rounds
//   p.education.auditionPrep = { points, year }  coaching for the audition room, kept across rounds
//   p.education.apps = { age, majorId, statement, sent, list: [application], appealed, held }
//     application: { instId, outcome, score, condition, reasons, aid, tuition }
//     held: { instId, until }  a place kept open for a year
//   p.education.aid / aidKeep / aidParts   the share of tuition waived while enrolled, and the mark that keeps it
import { universityAccess } from './history.js';
import { rng } from '../rng.js';
import { clamp, localCost, fmtMoney } from '../util.js';
import { store, player, country, npcsByRole, livingNpcs, log } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { UNIVERSITY_KIND_BY_ID, UNI_PLACES, UNI_SAINTS, MAX_APPLICATIONS, MAX_APPLICATIONS_AUDITION, STATEMENTS, BFA_PLANS, BFA_DEFAULT, AUDITION_COACHING } from '../data/universities.js';
import { PROGRAMS } from '../data/schools.js';
import { SCHOOL_TYPE_BY_ID } from '../data/schools.js';
import { MAJOR_BY_ID } from '../data/majors.js';
import { CAREERS } from '../data/careers.js';
import { OCCUPATIONS } from '../data/traits.js';
import { assess, meets, aid as aidFor, outlook, luckRange, acceptanceRate, fitOf, chanceOf } from './admissions.js';
import { book } from './ledger.js';
import { tripleThreat } from './conditions.js';
import { wealthTier } from './living.js';
import * as edu from './education.js';
import { arriveAt } from './edlegacy.js';
import { localUniPatterns, fillName } from '../data/localNames.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', more = {}) => ({ ok, text, tone, ...more });
const noise = (n) => (rng.next() * 2 - 1) * n;
const all = () => (store.state.universities ??= {});

/** The subjects at school that bear on a degree: advanced courses in them count with admissions. */
const RELEVANT = { engineering: ['math', 'science'], mathematics: ['math'], computer_science: ['math', 'technology'], chemistry: ['science'], biology: ['science'], nursing: ['science'],
  english: ['literature'], journalism: ['literature'], communications: ['literature'], history: ['history'], political_science: ['government', 'history'], finance: ['economics', 'math'], business: ['economics'],
  psychology: ['science'], education: ['literature'], criminal_justice: ['government'], art: ['art'], music: ['music'], theater: ['theater'], musical_theater: ['theater', 'music'], musical_theater_bfa: ['theater', 'music'] };

// ---------- The institutions ----------

/** The universities of a country, made the first time they are needed and then kept. */
export function catalog(countryId = player().countryId) {
  const have = Object.values(all()).filter((u) => u.countryId === countryId);
  if (have.length) { addBfaPrograms(countryId); return Object.values(all()).filter((u) => u.countryId === countryId).map(view); }
  const c = COUNTRIES[countryId];
  const cities = [...c.cities].sort(() => rng.next() - 0.5);
  const taken = new Set();
  const plan = ['ancient', 'research', 'research', 'technical', 'regional', 'regional', 'college', 'conservatoire', 'open'];
  // Where universities run big sports programs, there are many more of them to recruit and be recruited by.
  if (['us', 'ca'].includes(countryId)) plan.push('research', 'research', 'research', 'research', 'regional', 'regional', 'regional', 'college', 'college', 'college');
  plan.forEach((kindId, i) => {
    const kind = UNIVERSITY_KIND_BY_ID[kindId];
    const city = cities[i % cities.length];
    let name = '';
    for (let t = 0; t < 12 && (!name || taken.has(name)); t++) {
      const local = localUniPatterns(kindId, countryId);
      name = local ? fillName(local[(i + t) % local.length], countryId, city, (xs) => rng.pick(xs))
        : kind.names[(i + t) % kind.names.length].replace('{city}', city).replace('{place}', rng.pick(UNI_PLACES)).replace('{saint}', rng.pick(UNI_SAINTS)).replace('{country}', c.name);
    }
    taken.add(name);
    const id = `uni_${countryId}_${i}`;
    all()[id] = { id, kind: kindId, name, countryId, city, founded: store.state.year - (kindId === 'ancient' ? rng.int(300, 800) : kindId === 'open' ? rng.int(20, 60) : rng.int(40, 220)), alumni: [] };
  });
  addBfaPrograms(countryId);
  return Object.values(all()).filter((u) => u.countryId === countryId).map(view);
}

/** A small stable hash, so the programs added later never disturb the game's seeded dice. */
const hash = (str) => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

/**
 * The musical theater BFA programs a country has (data/universities.js), added to its universities if they are not
 * there: a life begun before they existed finds them the next time it looks. Names, places and standing come from a
 * stable hash of the country and the program, not from the game's random numbers.
 */
function addBfaPrograms(countryId) {
  const want = BFA_PLANS[countryId] ?? BFA_DEFAULT;
  const c = COUNTRIES[countryId];
  const mine = Object.values(all()).filter((u) => u.countryId === countryId);
  const taken = new Set(mine.map((u) => u.name));
  const had = {};
  for (const u of mine) had[u.kind] = (had[u.kind] ?? 0) + 1;
  const seen = {};
  for (const kindId of want) {
    seen[kindId] = (seen[kindId] ?? 0) + 1;
    if ((had[kindId] ?? 0) >= seen[kindId]) continue;
    const kind = UNIVERSITY_KIND_BY_ID[kindId];
    const n = Object.keys(all()).length;
    const key = `${countryId}/${kindId}/${seen[kindId]}`;
    const city = c.cities[Math.floor(hash(`${key}/city`) * c.cities.length)];
    const pick = (xs, salt) => xs[Math.floor(hash(`${key}/${salt}`) * xs.length)];
    let name = '';
    for (let t = 0; t < 12 && (!name || taken.has(name)); t++) {
      const local = localUniPatterns(kindId, countryId);
      const pattern = (local ?? kind.names)[(seen[kindId] + t) % (local ?? kind.names).length];
      name = pattern.replace('{city}', city).replace('{place}', pick(UNI_PLACES, `place${t}`)).replace('{saint}', pick(UNI_SAINTS, `saint${t}`)).replace('{country}', c.name);
    }
    taken.add(name);
    const id = `uni_${countryId}_bfa${n}`;
    all()[id] = { id, kind: kindId, name, countryId, city, founded: store.state.year - Math.round(40 + hash(`${key}/founded`) * 170), alumni: [], rep: kind.rep + Math.round(hash(`${key}/rep`) * 8 - 4) };
  }
}
/** An institution with everything its kind gives it. */
function view(u) { return { ...UNIVERSITY_KIND_BY_ID[u.kind], ...u, kindId: u.kind }; }
/** The institution by id. Lives begun before the catalog existed attended one of three kinds of school: those still resolve. */
export function uniOf(id) {
  if (!id) return null;
  const u = all()[id];
  return u ? view(u) : SCHOOL_TYPE_BY_ID[id] ?? null;
}

// ---------- The applicant ----------

/** Whether someone has a degree, as far as can be told: from their own record if they have one, or from the work they do. */
function hasDegree(n) {
  if (n.life?.edu) return (n.life.edu.degrees ?? []).some((d) => ['university', 'graduate', 'medical', 'law'].includes(d));
  // Parents are known by the work they do: the professions are the ones that took a degree to enter.
  const job = OCCUPATIONS.find((j) => j.title === n.occupation);
  if (job) return job.income >= 70000;
  const title = String(n.occupation ?? '').toLowerCase();
  return !!title && CAREERS.some((c) => (c.req?.degree === 'university' || c.req?.majors || ['medical', 'law'].includes(c.req?.program)) && c.levels.some((l) => l.title.toLowerCase() === title));
}
/** Whether the player would be the first in their family to go to university: neither parent went, nor any family name is on an alumni roll. */
export function firstInFamily() {
  const p = player();
  const parents = npcsByRole('parent');
  if (!parents.length || parents.some(hasDegree)) return false;
  return !Object.values(all()).some((u) => u.alumni.some((n) => n.endsWith(` ${p.lastName}`)));
}

/** Whether the player has anything to plan: nearing the end of school, or out of it with a leaving qualification. */
export function canPlan() {
  const p = player();
  const e = p.education;
  if (p.legal.incarceration) return false;
  if (e.enrolled && e.stage === 'high' && p.age >= 16) return true;
  return !e.enrolled && e.degrees.some((d) => d.type === 'high' || d.type === 'community');
}
const atSchool = () => { const e = player().education; return e.enrolled && e.stage === 'high'; };

/** The player as an admissions office would see them, for a subject. */
export function profile(majorId, inst = null) {
  const p = player();
  const e = p.education;
  const major = MAJOR_BY_ID[majorId];
  const school = atSchool();
  const courses = school ? e.courses : e.degrees.find((d) => d.type === 'high')?.courses;
  const advanced = (courses?.advanced ?? []).filter((id) => (RELEVANT[majorId] ?? []).includes(id)).length;
  const recs = Math.min(2, livingNpcs().filter((n) => n.flags.wouldRecommend).length + (p.flags.teacherRec ? 1 : 0));
  const clubs = Object.values(e.clubLife ?? {});
  const activities = Math.round(clamp(25 + clubs.reduce((s, c) => s + c.standing / 3 + (c.role === 'leader' ? 15 : 0), 0) + (p.flags.gapVolunteer ? 12 : 0) + (p.flags.performances?.length ?? 0) * 3));
  const plan = e.apps;
  const tier = wealthTier();
  const parents = npcsByRole('parent');
  const surname = p.lastName;
  return {
    access: universityAccess(), // Historical Eras: how many students universities took in these years
    mark: school ? e.gpa : edu.entryGpa(), predicted: school, advanced, recs, activities,
    statement: plan?.statementValue ?? 0,
    audition: major?.audition ? Math.round(clamp(tripleThreat(p) + (p.flags.directorRec ? 8 : 0) + Math.min(10, (p.flags.performances?.length ?? 0) * 2) + (e.auditionPrep?.points ?? 0))) : null,
    attempts: inst && majorId ? triesOf(majorId, inst.id).n : 0,
    priorBest: inst && majorId ? triesOf(majorId, inst.id).best : null,
    // A university that offered an athletic scholarship (engine/sportsLife.js) backs the application, and pays what it offered.
    athlete: !!sportOffer(p, inst) || (!!p.flags.athlete?.recruited && !p.flags.athlete.recruited.instId) || (!!p.flags.coachRec && p.talents.sports >= 65),
    athleticFraction: sportOffer(p, inst)?.fraction,
    need: tier === 'poor' ? 2 : tier === 'middle' ? 1 : 0,
    firstInFamily: firstInFamily(),
    legacy: !!inst && inst.alumni.some((n) => n.endsWith(` ${surname}`)),
    transfer: edu.isTransfer(),
  };
}

/** Every time the player has applied to a place for a subject: how many, their best audition, and what came of each. */
export const triesOf = (majorId, instId) => player().education.tries?.[majorId]?.[instId] ?? { n: 0, best: null, last: null, outcomes: [] };
function noteTry(majorId, instId, audition, outcome) {
  const e = player().education;
  const t = ((e.tries ??= {})[majorId] ??= {})[instId] ??= { n: 0, best: null, last: null, outcomes: [] };
  t.n += 1; t.last = store.state.year; t.outcomes.push(outcome);
  if (audition != null) t.best = Math.max(t.best ?? 0, audition);
}
/** How many places one round can go to, for a subject. */
export const maxApplications = (majorId) => (MAJOR_BY_ID[majorId]?.audition ? MAX_APPLICATIONS_AUDITION : MAX_APPLICATIONS);

/** The accepted athletic scholarship offer from this institution, if there is one. */
const sportOffer = (p, inst) => (inst ? (p.flags.sportOffers ?? []).find((o) => o.accepted && o.instId === inst.id) : null);

/** Whether an institution teaches a subject at all. */
export const teaches = (u, majorId) => (MAJOR_BY_ID[majorId]?.programOnly ? u.strong.includes(majorId) : !u.only || u.strong.includes(majorId));

/** What a year would cost at an institution, before any help: tuition and living away. */
export function costs(instId) {
  const u = uniOf(instId);
  const base = edu.tuitionFor('university') || (u?.private ? Math.round(localCost(PROGRAMS.university.tuition, country())) : 0); // a conservatory charges even where the state pays for university
  const tuition = Math.round(base * (u?.tuitionMult ?? 1));
  return { tuition, living: Math.round(edu.housingCost('dorm') * (u?.living ?? 1)) };
}
const barWord = (u) => (u.open ? 'Open to anyone' : u.bar >= 3.3 ? 'Very hard to get into' : u.bar >= 2.8 ? 'Hard to get into' : u.bar >= 2.4 ? 'Takes good students' : 'Takes most who apply');
const repWord = (u) => (u.rep >= 90 ? 'Famous everywhere' : u.rep >= 78 ? 'Very well regarded' : u.rep >= 62 ? 'Well regarded' : u.rep >= 50 ? 'Solid, and known locally' : 'Little known');

/** The catalog as the planner shows it, for the subject the player has in mind. */
export function browse() {
  const p = player();
  const plan = p.education.apps;
  const majorId = plan?.majorId ?? null;
  const major = MAJOR_BY_ID[majorId];
  return catalog(p.countryId).map((u) => {
    const c = costs(u.id);
    return { id: u.id, name: u.name, label: u.label, city: u.city, founded: u.founded, blurb: u.blurb, reputation: repWord(u), entry: barWord(u), tuition: c.tuition, living: c.living,
      strong: major ? u.strong.includes(majorId) : false, taught: !major || teaches(u, majorId), chances: !major ? '' : teaches(u, majorId) ? outlook(profile(majorId, u), u, major) : 'Not taught here', nearHome: u.city === p.city, family: u.alumni.filter((n) => n.endsWith(` ${p.lastName}`)),
      chosen: !!plan?.list.some((a) => a.instId === u.id),
      fit: major && teaches(u, majorId) ? FIT_WORD[fitOf(profile(majorId, u), u, major)] : '', acceptance: major && teaches(u, majorId) ? acceptanceRate(u, major) : null,
      attempts: major ? triesOf(majorId, u.id).n : 0, audition: !!major?.audition, private: !!u.private, rep: u.rep };
  });
}

// ---------- Choosing where: the short list, and side by side ----------

const FIT_WORD = { safety: 'Safety', match: 'Match', reach: 'Reach' };
/** How strong a place is for a subject: its standing, what it is known for, and (for performance) whether it is built for it. */
const programScore = (u, majorId) => (u.rep ?? 50) + (majorId && u.strong.includes(majorId) ? 10 : 0) + (MAJOR_BY_ID[majorId]?.audition && u.arts ? 6 : 0);

/**
 * The places that teach the subject the player has in mind, best first, each marked reach, match or safety for them.
 * Only the top few are shown until they ask for more.
 * @param {{limit?:number, all?:boolean}} [o]
 * @returns {{rows:object[], total:number, shown:number, major:?object}}
 */
export function shortlist(o = {}) {
  const limit = o.limit ?? 8;
  const rows = browse().filter((u) => u.taught).map((u) => ({ ...u, score: programScore(uniOf(u.id), uni_major()) }));
  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  rows.forEach((r, i) => { r.rank = i + 1; });
  const shown = o.all ? rows : rows.slice(0, limit);
  return { rows: shown, total: rows.length, shown: shown.length, major: MAJOR_BY_ID[uni_major()] ?? null };
}
const uni_major = () => player().education.apps?.majorId ?? null;

/** Side by side: attribute rows, each with a value for every place named (up to four). `best` marks the one to prefer. */
export function compare(ids) {
  const p = player();
  const c = country();
  const majorId = uni_major();
  const major = MAJOR_BY_ID[majorId] ?? null;
  const rows = ids.slice(0, 4).map((id) => uniOf(id)).filter(Boolean).map((u) => {
    const cost = costs(u.id);
    const who = major ? profile(majorId, u) : null;
    const chance = major && teaches(u, majorId) ? chanceOf(who, u, major) : null;
    const tries = major ? triesOf(majorId, u.id) : { n: 0 };
    const helpMax = Math.min(1, Math.max(u.merit ?? 0, major?.audition && u.arts ? 0.5 : 0) + (u.needAid ?? 0));
    return { u, cost, chance, rate: major ? acceptanceRate(u, major) : null, tries, helpMax, who };
  });
  const best = (get, dir) => { const vals = rows.map(get); const target = dir > 0 ? Math.max(...vals) : Math.min(...vals); const flags = vals.map((v) => v === target && rows.length > 1); return flags.every(Boolean) ? flags.map(() => false) : flags; }; // (nothing is "better" where all are the same)
  const col = (label, get, o2 = {}) => {
    const flags = o2.best ? best((r) => o2.best.value(r), o2.best.dir) : null;
    return { label, values: rows.map((r, i) => ({ id: r.u.id, name: r.u.name, text: get(r), best: flags ? flags[i] : false })) };
  };
  const pct = (x) => (x == null ? '—' : x >= 0.995 ? 'Open to all' : `${Math.max(1, Math.round(x * 100))}%`);
  const odds = (x, u) => (u.open ? 'Open to all' : `about ${Math.min(99, Math.max(1, Math.round(x * 100)))}%`); // nobody is ever certain
  const out = [
    col('Where', (r) => `${r.u.city}, ${COUNTRIES[r.u.countryId]?.name ?? ''}`),
    col('Kind of place', (r) => r.u.label),
    col('Tuition a year', (r) => (r.cost.tuition ? fmtMoney(r.cost.tuition, c) : 'None'), { best: { value: (r) => r.cost.tuition, dir: -1 } }),
    col('Living there a year', (r) => (r.cost.living ? `about ${fmtMoney(r.cost.living, c)}` : 'From home')),
    col('Length of the course', () => `${PROGRAMS.university.years} years`),
    col('Help with the cost', (r) => (r.helpMax ? `up to ${Math.round(r.helpMax * 100)}% of tuition, for merit, performance or need` : 'little or none')),
  ];
  if (major) {
    out.push(
      col('Known for this subject', (r) => (r.u.strong.includes(majorId) ? 'Yes' : 'Taught, not famous for it')),
      col(major.audition ? 'Places offered, of those who audition' : 'Places offered, of those who apply', (r) => pct(r.rate), { best: { value: (r) => r.rate ?? 0, dir: 1 } }),
      col('Your chances', (r) => (r.chance == null ? 'Not taught here' : r.u.open ? 'Open to all' : `${FIT_WORD[fitOf(r.who, r.u, major)]}: ${odds(r.chance, r.u)}`), { best: { value: (r) => r.chance ?? 0, dir: 1 } }),
      col('How it is decided', (r) => (major.audition ? `An audition, and marks of ${(Math.max(0, (major.minGpa ?? 0) - 0.3 - (r.u.lenient ?? 0))).toFixed(1)} or better` : 'Your marks and what you have done')),
    );
    if (rows.some((r) => r.tries.n)) out.push(col('Times you have applied', (r) => (r.tries.n ? `${r.tries.n} (${r.tries.outcomes.map((o) => ({ accepted: 'accepted', conditional: 'offered', waitlisted: 'waiting list', deferred: 'asked back', rejected: 'turned away' })[o] ?? o).join(', ')})` : 'Never')));
  }
  out.push(col('What it gives you', (r) => ({ network: 'An alumni contact when you graduate', home: 'Cheap, and near home', mentor: 'A professor who knows you from day one' })[r.u.perk] ?? '—'));
  // What decides a choice first; where it is and what kind of place it is, last.
  const ORDER = [/^Your chances/, /^Places offered/, /^Tuition/, /^Help with/, /^Times you/, /^Living/, /^How it is decided/, /^Known for/, /^Length/, /^What it gives/, /^Where/, /^Kind of/];
  out.sort((a, b) => ORDER.findIndex((r) => r.test(a.label)) - ORDER.findIndex((r) => r.test(b.label)));
  return out;
}

/** Practice for the audition room: what a year of coaching would do, and whether it can be had now. */
export function coaching() {
  const p = player();
  const e = p.education;
  const major = MAJOR_BY_ID[e.apps?.majorId];
  const points = e.auditionPrep?.points ?? 0;
  const cost = Math.round(localCost(AUDITION_COACHING.cost, country()));
  let why = '';
  if (!major?.audition) why = 'Only for courses entered by audition.';
  else if (e.auditionPrep?.year === store.state.year) why = 'Done this year.';
  else if (points >= AUDITION_COACHING.cap) why = 'You are as prepared as coaching can make you.';
  else if (p.finance.cash < cost) why = 'You cannot afford it.';
  return { points, cap: AUDITION_COACHING.cap, add: AUDITION_COACHING.points, cost, blurb: AUDITION_COACHING.blurb, show: !!major?.audition, can: !why, why };
}
export function takeCoaching() {
  const p = player();
  const e = p.education;
  const c = coaching();
  if (!c.can) return result(false, c.why || 'Not now.', 'neutral');
  p.finance.cash -= c.cost;
  book({ cat: 'education', src: 'action', desc: 'Audition coaching' });
  const gain = Math.min(c.add, c.cap - c.points);
  e.auditionPrep = { points: c.points + gain, year: store.state.year };
  return result(true, `A year of coaching (${fmtMoney(c.cost, country())}) makes you sharper in the room: about ${gain} points on the day.`, 'good');
}

// ---------- A round of applications ----------

function round() {
  const p = player();
  const e = p.education;
  if (!e.apps || (e.apps.sent && e.apps.age !== p.age && !e.apps.list.some((a) => a.outcome === 'accepted' || a.outcome === 'conditional' || a.outcome === 'waitlisted'))) e.apps = { age: p.age, majorId: e.apps?.majorId ?? null, statement: null, statementValue: 0, sent: false, list: [] };
  return e.apps;
}
export const plan = () => (canPlan() ? round() : null);
export const majorsOpen = () => Object.values(MAJOR_BY_ID).map((m) => ({ id: m.id, name: m.name, audition: !!m.audition, minGpa: m.minGpa }));

export function setMajor(id) {
  const r = round();
  if (r.sent) return result(false, 'Your applications have gone. Next year you can apply for something else.', 'neutral');
  if (!MAJOR_BY_ID[id]) return result(false, 'There is no such course.', 'neutral');
  r.majorId = id;
  r.list = r.list.filter((a) => teaches(uniOf(a.instId), id)); // places that do not teach it come off the list
  return result(true, `You will apply to study ${MAJOR_BY_ID[id].name}.`, 'neutral');
}
export function toggle(instId) {
  const r = round();
  if (r.sent) return result(false, 'Your applications have gone.', 'neutral');
  if (!uniOf(instId)) return result(false, 'There is no such place.', 'neutral');
  const at = r.list.findIndex((a) => a.instId === instId);
  if (at >= 0) { r.list.splice(at, 1); return result(true, 'Taken off your list.', 'neutral'); }
  if (r.majorId && !teaches(uniOf(instId), r.majorId)) return result(false, `${uniOf(instId).name} does not teach ${MAJOR_BY_ID[r.majorId].name}.`, 'neutral');
  if (r.list.length >= maxApplications(r.majorId)) return result(false, `You can apply to ${maxApplications(r.majorId)} places in a year.`, 'neutral');
  r.list.push({ instId, outcome: null });
  return result(true, 'Added to your list.', 'neutral');
}
export const statements = () => STATEMENTS;
export function setStatement(id) {
  const p = player();
  const r = round();
  const s = STATEMENTS.find((x) => x.id === id);
  if (!s || r.sent) return result(false, 'Too late to change it.', 'neutral');
  r.statement = id;
  // A story about something hard is remembered if it can be told well, and awkward if it cannot.
  r.statementValue = s.risky ? (rng.chance(clamp(0.3 + (p.stats.intellect - 50) / 120 + (p.stats.charm - 50) / 200, 0.1, 0.85)) ? 2 : -1) : s.value;
  return result(true, 'Your personal statement is written.', 'neutral');
}

/** Sends the applications. Each institution answers for itself. */
export function send() {
  const p = player();
  const r = round();
  if (r.sent) return result(false, 'You have already applied this year.', 'neutral');
  const major = MAJOR_BY_ID[r.majorId];
  if (!major) return result(false, 'Choose what you want to study first.', 'neutral');
  if (!r.list.length) return result(false, 'Add at least one place to your list.', 'neutral');
  if (!r.statement) setStatement('honest');
  r.sent = true; r.age = p.age;
  for (const a of r.list) {
    const u = uniOf(a.instId);
    const who = profile(r.majorId, u);
    const d = assess(who, u, major, noise(luckRange(u, major)));
    noteTry(r.majorId, u.id, who.audition, d.outcome);
    Object.assign(a, { outcome: d.outcome, score: d.score, condition: d.condition ?? null, reasons: d.reasons, tuition: costs(a.instId).tuition,
      aid: d.outcome === 'accepted' || d.outcome === 'conditional' ? aidFor(who, u, major, d.score) : null });
  }
  const count = (o) => r.list.filter((a) => a.outcome === o).length;
  const yes = count('accepted') + count('conditional');
  if (!yes) p.stats.mood = clamp(p.stats.mood - 6);
  const text = `You applied to ${r.list.length} ${r.list.length === 1 ? 'place' : 'places'} to study ${major.name}. ${yes ? `${yes} offered you a place${count('conditional') ? ', depending on your final marks' : ''}` : 'None offered you a place'}${count('waitlisted') ? `; ${count('waitlisted')} put you on a waiting list` : ''}${count('deferred') ? `; ${count('deferred')} asked you to apply again next year` : ''}.${major.audition && !yes ? ' Turned away is common for these programs: many people who are now on stage were refused once, or twice, and went back better prepared.' : ''}`;
  log(text, 'system', yes ? 'good' : 'bad');
  return result(yes > 0, text);
}

/** Answers as the planner shows them. */
export function answers() {
  const p = player();
  const r = p.education.apps;
  if (!r?.sent) return [];
  const ready = !atSchool();
  return r.list.map((a) => {
    const u = uniOf(a.instId);
    const net = a.aid ? Math.round(a.tuition * (1 - a.aid.fraction)) : a.tuition;
    return { ...a, tries: triesOf(r.majorId, a.instId).n, name: u.name, label: u.label, city: u.city, net, living: costs(a.instId).living,
      aidText: a.aid?.parts.length ? a.aid.parts.map((x) => ({ merit: 'a scholarship for your record', athletic: 'an athletic scholarship', arts: 'a scholarship for performance', need: 'a grant because of what your family can afford' })[x.kind]).join(' and ') : '',
      conditionText: a.condition != null ? edu.markText(a.condition) : '', held: r.held?.instId === a.instId,
      canAccept: ready && a.outcome === 'accepted', canHold: ready && a.outcome === 'accepted' && !r.held, canAppeal: !r.appealed && ['rejected', 'deferred'].includes(a.outcome) && a.score >= -0.35 };
  });
}

/** A waiting list moves, or does not. @returns {?string} the good news, if there is any */
function offList(r, a) {
  const u = uniOf(a.instId);
  if (rng.chance(clamp(0.35 + a.score * 2, 0.1, 0.7))) {
    a.outcome = 'accepted';
    a.aid = aidFor(profile(r.majorId, u), u, MAJOR_BY_ID[r.majorId], a.score);
    a.reasons = [...(a.reasons ?? []), 'A place came free from the waiting list.'];
    return `A place has come free at ${u.name}.`;
  }
  a.outcome = 'rejected';
  a.reasons = [...(a.reasons ?? []), 'No place came free from the waiting list.'];
  return null;
}

/** School results are in: conditional offers stand or fall, and waiting lists move. */
export function onResults() {
  const p = player();
  const r = p.education.apps;
  if (!r?.sent) return;
  const final = edu.entryGpa();
  const lines = [];
  for (const a of r.list) {
    const u = uniOf(a.instId);
    if (a.outcome === 'conditional') {
      if (meets(a.condition, final, noise(0.15))) { a.outcome = 'accepted'; lines.push(`${u.name} has confirmed your place.`); }
      else { a.outcome = 'rejected'; a.aid = null; a.reasons = [`Your final marks fell short of what the offer asked for.`]; lines.push(`${u.name} has withdrawn its offer: your marks fell short.`); }
    } else if (a.outcome === 'waitlisted') { const got = offList(r, a); if (got) lines.push(got); }
  }
  if (lines.length) log(`Results day. ${lines.join(' ')}`, 'system', r.list.some((a) => a.outcome === 'accepted') ? 'good' : 'bad');
}

/** Asks an institution to look again. Once a round; it rarely works. */
export function appeal(instId) {
  const r = player().education.apps;
  const a = r?.list.find((x) => x.instId === instId);
  if (!a || r.appealed || !['rejected', 'deferred'].includes(a.outcome)) return result(false, 'There is nothing to appeal.', 'neutral');
  r.appealed = true;
  const u = uniOf(instId);
  if (a.score >= -0.35 && rng.chance(0.22)) {
    a.outcome = atSchool() ? 'conditional' : 'accepted';
    if (a.outcome === 'conditional') a.condition = Math.max(0, Math.round((u.bar - 0.3) * 10) / 10);
    a.aid = aidFor(profile(r.majorId, u), u, MAJOR_BY_ID[r.majorId], a.score);
    a.reasons = [...(a.reasons ?? []), 'On a second look, it changed its mind.'];
    return result(true, `${u.name} has looked again, and offers you a place.`);
  }
  return result(false, `${u.name} has looked again, and its answer is the same.`);
}

/** Keeps a place open for a year. One place, once. */
export function hold(instId) {
  const p = player();
  const r = p.education.apps;
  const a = r?.list.find((x) => x.instId === instId);
  if (!a || a.outcome !== 'accepted' || r.held) return result(false, 'That place cannot be held.', 'neutral');
  r.held = { instId, until: p.age + 1 };
  return result(true, `${uniOf(instId).name} will keep your place for a year.`, 'neutral');
}

/**
 * Takes up a place.
 * @param {string} funding  how the part not covered by aid is paid: 'parents' | 'loan' | 'self'
 * @param {{housing?:string, roommateId?:string}} [living]
 */
export function accept(instId, funding, living = {}) {
  const p = player();
  const e = p.education;
  const r = e.apps;
  const a = r?.list.find((x) => x.instId === instId);
  if (!a || a.outcome !== 'accepted' || atSchool() || e.enrolled) return result(false, 'You cannot take up that place now.', 'neutral');
  const u = uniOf(instId);
  const fraction = a.aid?.fraction ?? 0;
  edu.enroll('university', r.majorId, fraction >= 1 ? 'scholarship' : funding, { ...living, housingAid: !!a.aid?.housing }, { id: u.id, name: u.name, aid: a.aid });
  e.apps = null;
  arriveAt(u.name);
  return result(true, `You are going to ${u.name}.`);
}

/** Yearly: a round nobody acted on lapses, and a held place is lost if it is not taken up. */
export function tickApplications() {
  const p = player();
  const r = p.education.apps;
  if (!r) return;
  if (r.held && p.age > r.held.until) { log(`The place ${uniOf(r.held.instId)?.name ?? 'the university'} was holding for you has lapsed.`, 'system', 'bad'); p.education.apps = null; return; }
  // Someone who applied with their results already in hears from the waiting lists within the year.
  if (r.sent && !atSchool()) {
    const news = r.list.filter((a) => a.outcome === 'waitlisted').map((a) => offList(r, a)).filter(Boolean);
    if (news.length) log(news.join(' '), 'system', 'good');
  }
  if (r.sent && !r.held && p.age - r.age >= 2) p.education.apps = null;
}

/** Someone has graduated: the institution remembers the name. */
export function remember(instId) {
  const u = all()[instId];
  const p = player();
  const name = `${p.firstName} ${p.lastName}`;
  if (u && !u.alumni.includes(name)) u.alumni.push(name);
}
