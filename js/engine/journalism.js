// Journalism: a special career (engine/specialCareer.js) in which the work is the reporting itself.
//
// A newsroom (an invented outlet in the player's city) hires an intern or a junior reporter. The editor and a
// senior reporter there are real people. Each year the newsroom assigns stories on the reporter's beat, every one
// about something that actually exists in this world: a business that opened (registered as an employer), a court
// case in the public record (engine/investigations), a season that was played (engine/sports), a record that came
// out (engine/music), an election that was held (engine/polity), or a tip about a real employer.
//
// A story is worked in the reporter's notebook: interview the people involved (they can say no; they can be
// wrong), read the public records (never a sealed file or a police case file), ask the subject for comment, then
// draft it, choose a headline, and send it to the editor. A claim's status comes only from the evidence gathered:
// a public record verifies or contradicts it; two independent sources who agree support it; one source is one
// source. The truth of each claim is fixed when the story is made and is never shown. The editor approves, asks for
// a revision, or holds a story, by its readiness and the outlet's standards, never by the reporter's fame. A story
// is published once; what it got wrong comes back as a complaint, and a correction is added, never a rewrite.
//
// All of a year's work happens within that year: the reporter has ACTIONS_A_YEAR actions in a year, whatever the
// turn length, and the newsroom's year (new assignments, promotions, complaints, prizes) is run once a year
// (engine/yearProcessor.js), so three-, six- and twelve-month turns give the same year.
//
//   store.state.newsroom = { seq, outlets: {id}, byCity: {'cc/City': [ids]}, stories: {id}, pubs: {id} }
//   p.journalism = { outletId, beat, since, skills, rep, acts, school, intern, history, awards, routine }
import { clamp } from '../util.js';
import { store, player, log, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { OUTLET_KINDS, BEATS, LOCAL_EVENTS, TIPS, QUESTIONS, ATTRIBUTION, STATUS, ACTIONS_A_YEAR, AWARDS, OWN_KINDS, STAFF_PAY } from '../data/journalism.js';
import { localWage, fmtMoney } from '../util.js';
import { country } from '../state.js';
import { RELEASE_TYPES } from '../data/fame.js';
import { makeNpc } from './npcFactory.js';
import { registerEmployer, cityEmployers, employer } from './employers.js';
import { hire, promote } from './career.js';
import { levelOf } from './skills.js';
import { exists } from './fame.js';
import { claim as claimSpecial, whyNot as whySpecial, leave as leaveSpecial } from './specialCareer.js';
import { publicCases } from './investigations/crossover.js';
import { polity } from './polity.js';
import { askOut } from './romance.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const year = () => store.state.year;
const now = () => store.state.year * 12 + (store.state.month ?? 0);
const npc = (id) => store.state.npcs[id] ?? null;
const nameOf = (n) => (n ? `${n.firstName} ${n.lastName}` : '');

/** A random stream fixed by its key: the same story, the same source, the same answer, whenever it is asked. */
function seeded(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let s = h >>> 0;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (a, b) => a + Math.floor(next() * (b - a + 1)), pick: (arr) => arr[Math.floor(next() * arr.length)], chance: (q) => next() < q };
}

// ---------- The world's newsrooms ----------

export function S(state = store.state) {
  state.newsroom ??= { seq: 0, outlets: {}, byCity: {}, stories: {}, pubs: {} };
  return state.newsroom;
}
const nextId = (prefix) => `${prefix}_${(S().seq += 1).toString(36)}`;

/** Whether a kind of newsroom can exist in this year (radio, television and the web come when they came). */
function kindExists(kind, y = year()) {
  const k = OUTLET_KINDS[kind];
  if (y < k.from) return false;
  if (k.medium === 'radio') return exists('radio', y);
  if (k.medium === 'television') return exists('tv', y);
  if (k.medium === 'online') return exists('digital', y);
  return true;
}

/** A newsroom, with an editor and a senior reporter who are real people, kept for good. */
function makeOutlet(kind, countryId, city, r) {
  const k = OUTLET_KINDS[kind];
  const word = r.pick(k.words);
  // Broadcasters are known by their channel or station, papers by "The ...".
  const name = kind === 'regional' ? `The ${COUNTRIES[countryId].name} ${word}` : kind === 'tv' ? (r.chance(0.4) ? `Channel ${r.int(2, 13)} ${city}` : `${city} ${word}`)
    : k.medium === 'radio' ? `${city} ${word}` : `The ${city} ${word}`;
  const e = registerEmployer({ name, family: 'media', tracks: ['journalist', 'publishing', 'broadcast'], countryId, city, owned: false });
  const id = nextId('outlet');
  const staff = (role, age) => {
    const n = makeNpc({ role: 'colleague', countryId, age, relationship: 50 });
    n.occupation = role;
    n.flags.title = `${role} at ${name}`;
    n.flags.newsroom = { outletId: id, role };
    store.state.npcs[n.id] = n;
    return n.id;
  };
  const o = { id, kind, name, medium: k.medium, countryId, city, founded: year() - r.int(kind === 'digital' || kind === 'investigative' ? 1 : 10, kind === 'local' ? 120 : 60),
    employerId: e.id, editorId: staff('Editor', r.int(38, 61)), seniorId: staff('Senior reporter', r.int(30, 55)),
    standards: Math.round((k.standards[0] + r.next() * (k.standards[1] - k.standards[0])) * 100) / 100,
    reputation: r.int(40, 85), audience: Math.round(k.reach * r.int(8000, 30000)), history: [] };
  S().outlets[id] = o;
  return o;
}

/** The newsrooms of the player's city (made the first time they are looked for, then kept). Ones of a later era open when they can. */
export function outletsHere(p = player()) {
  const key = `${p.countryId}/${p.city}`;
  const list = (S().byCity[key] ??= []);
  for (const kind of Object.keys(OUTLET_KINDS)) {
    if (!kindExists(kind) || list.some((id) => S().outlets[id]?.kind === kind)) continue;
    if (kind === 'investigative' && !seeded(`${key}/investigative`).chance(0.5)) continue;
    list.push(makeOutlet(kind, p.countryId, p.city, seeded(`${key}/${kind}`)).id);
  }
  return list.map((id) => S().outlets[id]).filter(Boolean);
}
export const outlet = (id) => S().outlets[id] ?? null;

// ---------- The reporter ----------

export function J(p = player()) {
  if (!p.journalism) {
    const w = levelOf('writing');
    p.journalism = { outletId: null, beat: 'local', since: null, skills: { reporting: 15 + Math.round(w / 4), interviewing: 15 + Math.round(p.stats.charm / 5), verification: 15, writing: 15 + Math.round(w / 3) },
      rep: { accuracy: 50, trust: 50, recognition: 0 }, acts: { year: null, used: 0 }, school: { articles: 0, year: null }, intern: null, history: [], awards: [], applied: {} };
  }
  p.journalism.skills.broadcast ??= 15; // presenting: kept apart from reporting
  p.journalism.scenes ??= {};
  return p.journalism;
}
export const isReporter = (p = player()) => p.career?.careerId === 'journalist' && !!J(p).outletId;
/** A publication the player owns and runs (never the same as being employed by one). */
export const ownedOutlet = (p = player()) => { const id = p.journalism?.owned; const o = id ? S().outlets[id] : null; return o && !o.closed ? o : null; };
/** Whether the player is working as a journalist at all: on staff, freelance, or running their own publication. */
export const working = (p = player()) => isReporter(p) || !!J(p).freelance || !!ownedOutlet(p);
export const actionsLeft = (p = player()) => { const j = J(p); return j.acts.year === year() ? Math.max(0, ACTIONS_A_YEAR - j.acts.used) : ACTIONS_A_YEAR; };
function spend(n, p = player()) {
  const j = J(p);
  if (j.acts.year !== year()) j.acts = { year: year(), used: 0 };
  if (j.acts.used + n > ACTIONS_A_YEAR) return false;
  j.acts.used += n;
  return true;
}
const grow = (key, by, p = player()) => { const s = J(p).skills; s[key] = clamp(Math.round((s[key] + by * (1 - s[key] / 120)) * 10) / 10); };

/** An older save's journalist keeps their job: their employer is taken as their newsroom, and detail starts from now. */
export function migrateJournalist(p = player()) {
  if (p.career?.careerId !== 'journalist' || J(p).outletId) return;
  const e = employer(p.career.employerId);
  const here = outletsHere(p);
  let o = here.find((x) => x.employerId === p.career.employerId);
  if (!o && e) {
    o = { ...makeOutlet('local', p.countryId, p.city, seeded(`${p.id}/adopted`)), employerId: e.id, name: e.name };
    S().outlets[o.id] = o;
  }
  const j = J(p);
  j.outletId = (o ?? here[0]).id;
  j.since = year();
  j.migrated = true;
}

// ---------- School and internships ----------

/** A school newspaper article: once a year, from ten until school ends. Practice, not professional reporting. */
export function schoolArticle() {
  const p = player();
  if (p.age < 10 || p.age > 19 || !p.education?.enrolled) return result(false, 'The school paper is for students.', 'neutral');
  const j = J(p);
  if (j.school.year === year()) return result(false, 'You have written your piece for the school paper this year.', 'neutral');
  j.school = { articles: j.school.articles + 1, year: year() };
  grow('writing', 3); grow('reporting', 2); grow('interviewing', 1.5);
  const r = seeded(`${p.id}/school/${year()}`);
  const what = r.pick(['the new lunch menu', 'the school play', 'a teacher retiring after thirty years', 'the football team\'s season', 'the science fair', 'a fundraiser for the library']);
  if (j.school.articles === 1) milestone('Wrote your first article, for the school paper.', 'career');
  return result(true, `You write about ${what} for the school paper. ${j.school.articles > 1 ? `That makes ${j.school.articles} pieces.` : 'Your name is on it.'}`);
}

const RELEVANT = ['journalism', 'english', 'communications', 'history', 'political_science'];
/** What a newsroom looks at: writing, what you have done, your degree. Never fame. */
function hireOdds(o, role, p = player()) {
  const j = J(p);
  const degree = p.education.degrees.some((d) => d.type === 'university');
  const relevant = p.education.degrees.some((d) => RELEVANT.includes(d.majorId)) || RELEVANT.includes(p.education.majorId);
  const base = role === 'intern' ? 0.45 : 0.2;
  return clamp(base + (j.skills.writing - 30) / 120 + (relevant ? 0.18 : degree ? 0.08 : 0) + (j.intern ? 0.15 : 0) + Math.min(0.12, j.school.articles * 0.03) + (j.recommended === o.id ? 0.15 : 0)
    - (o.reputation - 55) / 200, 0.04, 0.9);
}
/** Why the player cannot apply here for this, or ''. */
export function applyWhy(o, role, p = player()) {
  if (role === 'intern') {
    if (p.age < 16 || p.age > 27) return 'Internships are for students and recent graduates, 16 to 27.';
    if (!p.education.enrolled && !p.education.degrees.length && p.age > 19) return 'Internships are for students and recent graduates.';
    if (J(p).intern?.year === year()) return 'You are interning this year already.';
  } else {
    if (p.age < 18) return 'Newsrooms hire reporters from 18.';
    if (isReporter(p)) return 'You already work in a newsroom: apply to move instead.';
    const sc = whySpecial('journalism', p, store.state, { replacesJob: true });
    if (sc) return sc;
    const j = J(p);
    if (!p.education.degrees.some((d) => d.type === 'university') && !j.intern && j.school.articles < 3) return 'Newsrooms want a degree, an internship, or clips to show (school paper articles count).';
  }
  if (J(p).applied[`${o.id}:${role}`] === year()) return 'You applied there this year.';
  return '';
}

/** Applies to a newsroom, for an internship or a junior reporter's job. */
export function apply(outletId, role = 'junior') {
  const p = player();
  const o = outlet(outletId);
  if (!o) return result(false, 'There is no such newsroom.', 'neutral');
  const why = applyWhy(o, role, p);
  if (why) return result(false, why, 'neutral');
  const j = J(p);
  j.applied[`${o.id}:${role}`] = year();
  const r = seeded(`${p.id}/${o.id}/${role}/${year()}`);
  const ed = npc(o.editorId);
  if (!r.chance(hireOdds(o, role, p))) return result(false, `${nameOf(ed) || 'The editor'} at ${o.name} thanks you, and takes someone with more clips. Keep writing.`, 'neutral');
  meet(ed, `Your editor at ${o.name}`, p);
  if (role === 'intern') {
    j.intern = { outletId: o.id, year: year() };
    grow('reporting', 4); grow('verification', 4); grow('writing', 3);
    if (r.chance(0.5)) j.recommended = o.id;
    j.history.push({ year: year(), text: `Interned at ${o.name}.` });
    milestone(`Interned at ${o.name}.`, 'career');
    return result(true, `${o.name} takes you on as an intern for the year: fact-checking, research, and a few news briefs of your own. ${j.recommended === o.id ? `${ed?.firstName ?? 'The editor'} says to apply when you are ready.` : ''}`.trim());
  }
  { const sc = claimSpecial('journalism', p, store.state, { replacesJob: true }); if (sc) return result(false, sc, 'neutral'); }
  hire(CAREER_BY_ID.journalist, 0, 55, `You join ${o.name} as a junior reporter.`, { employerId: o.employerId });
  j.outletId = o.id;
  j.since = year();
  j.beat = 'local';
  meet(npc(o.seniorId), `A senior reporter at ${o.name}`, p);
  j.history.push({ year: year(), text: `Joined ${o.name} as a junior reporter.` });
  milestone(`Joined ${o.name} as a junior reporter.`, 'career');
  assignYear(p);
  return result(true, `${o.name} hires you as a junior reporter. ${nameOf(ed)} is your editor. Your first assignments are waiting.`);
}
function meet(n, title, p = player()) {
  if (!n) return;
  if (!p.npcIds.includes(n.id)) { p.npcIds.push(n.id); n.lastInteractionAge = p.age; }
  n.role = n.role === 'colleague' ? n.role : n.role ?? 'colleague';
  n.flags.title = title;
}

/** Changes beat. Investigations come with experience. */
export function setBeat(beat) {
  const p = player();
  if (!working(p)) return result(false, 'You are not working as a reporter.', 'neutral');
  const b = BEATS[beat];
  if (!b) return result(false, 'There is no such beat.', 'neutral');
  const why = beatWhy(beat, p);
  if (why) return result(false, why, 'neutral');
  J(p).beat = beat;
  return result(true, `You move to the ${b.name.toLowerCase()} beat. New assignments come with the year.`, 'neutral');
}

/** Why a beat is not open to this reporter now, or ''. */
export function beatWhy(beat, p = player()) {
  const b = BEATS[beat];
  if (!b) return 'There is no such beat.';
  if ((b.minLevel ?? 0) > (isReporter(p) ? p.career.level : myPubs(p).length >= 6 ? 9 : 0)) return 'Investigations are for senior reporters.';
  if (b.era && year() < b.era) return `Not in ${year()}: the figures are not published yet.`;
  if (beat === 'technology' && !exists('digital')) return `Not in ${year()}: there is no tech industry yet.`;
  if (beat === 'kpop' && p.countryId !== 'kr' && !store.state.kpop) return 'There is no K-pop scene to cover from here.';
  return '';
}

// ---------- Stories: made from what really happened ----------

const story = (id) => S().stories[id] ?? null;
export const storyOf = story;
export const myStories = (p = player()) => Object.values(S().stories).filter((s) => s.reporterId === p.id);
export const myPubs = (p = player()) => Object.values(S().pubs).filter((x) => x.reporterId === p.id).sort((a, b) => b.at - a.at);

function newStory(p, o, beat, title, extra) {
  const id = nextId('story');
  const s = { id, beat, title, reporterId: p.id, outletId: o?.id ?? null, editorId: o?.editorId ?? null, created: now(), year: year(), deadline: beat === 'investigative' ? null : now() + 9,
    status: 'assigned', claims: [], sources: [], docs: [], evidence: [], interviews: [], comment: null, legal: null, draft: null, review: null, pubId: null, links: {}, ...extra };
  S().stories[id] = s;
  return s;
}
const addClaim = (s, c) => { const x = { id: `${s.id}c${s.claims.length + 1}`, kind: 'fact', important: false, ...c }; s.claims.push(x); return x; };
const addSource = (s, c) => { const x = { id: `${s.id}s${s.sources.length + 1}`, knows: [], hidden: false, wantsConfidential: false, ...c }; s.sources.push(x); return x; };
const addDoc = (s, c) => { const x = { id: `${s.id}d${s.docs.length + 1}`, public: true, settles: [], cost: 1, ...c }; s.docs.push(x); return x; };

/** A local story: a real business opening (registered in the city), or a meeting, fair or program with its organizer. */
function localStory(p, o, r, w = { countryId: p.countryId, city: p.city }) {
  const ev = r.pick(LOCAL_EVENTS);
  const what = r.pick(ev.what);
  const street = r.pick(['Market Street', 'Station Road', 'Elm Avenue', 'Church Lane', 'the old square']);
  const org = makeNpc({ role: 'acquaintance', countryId: w.countryId, age: r.int(28, 66) });
  org.occupation = ev.kind === 'opening' ? `Owner of a ${what}` : `Organizer in ${w.city}`;
  store.state.npcs[org.id] = org;
  const neighbor = makeNpc({ role: 'acquaintance', countryId: w.countryId, age: r.int(20, 80) });
  neighbor.occupation = `Lives in ${w.city}`;
  store.state.npcs[neighbor.id] = neighbor;
  const title = ev.title.replace('{what}', what).replace('{street}', street);
  const s = newStory(p, o, 'local', title, { subject: nameOf(org) });
  if (ev.kind === 'opening') {
    const biz = registerEmployer({ name: `${org.lastName}'s ${what.replace(/^./, (c) => c.toUpperCase())}`, family: 'retail', tracks: [], countryId: w.countryId, city: w.city, owned: false });
    s.links.employerId = biz.id;
  }
  const staff = r.int(3, 14);
  const grant = r.chance(0.5);
  const big = r.chance(0.3); // the organizer remembers it bigger than it was
  const c1 = addClaim(s, { text: `The ${what} ${ev.kind === 'opening' ? `opened on ${street}` : 'went ahead as planned'} this year`, truth: true, important: true });
  const c2 = addClaim(s, { text: ev.kind === 'opening' ? `It employs ${big ? staff + 6 : staff} people` : `About ${big ? 400 : 150} people took part`, truth: !big });
  const c3 = addClaim(s, { text: 'The council put money into it', truth: grant });
  const c4 = addClaim(s, { text: 'Neighbors are glad of it', kind: 'opinion', truth: true });
  addSource(s, { npcId: org.id, name: nameOf(org), role: `The ${ev.organizer}`, type: 'community', willing: 0.85, knows: [{ claimId: c1.id, says: true }, { claimId: c2.id, says: true }, { claimId: c3.id, says: r.chance(0.8) ? grant : !grant }] });
  addSource(s, { npcId: neighbor.id, name: nameOf(neighbor), role: 'A neighbor', type: 'community', willing: 0.6, knows: [{ claimId: c1.id, says: true }, { claimId: c4.id, says: true }, { claimId: c2.id, says: !big || r.chance(0.3) }] });
  addDoc(s, { title: ev.kind === 'opening' ? 'The business registration' : 'The council\'s notice of the event', settles: [{ claimId: c1.id }, ...(ev.kind === 'opening' ? [{ claimId: c2.id }] : [])] });
  addDoc(s, { title: 'The council\'s public register of grants', settles: [{ claimId: c3.id }] });
  return s;
}

/** A court story, from a case in the public record (engine/investigations). Only what is public is available. */
function courtStory(p, o, r, cases, w = { countryId: p.countryId, city: p.city }) {
  const pub = cases.find((x) => !Object.values(S().stories).some((s) => s.links.caseId === x.caseId && s.reporterId === p.id));
  if (!pub) return null;
  const s = newStory(p, o, 'court', `${pub.title}: ${pub.outcome === 'pending' ? 'the case goes on' : `the court's decision`}`, { subject: pub.defendant, links: { caseId: pub.caseId }, needsComment: true });
  const convicted = pub.outcome === 'convicted';
  const c1 = addClaim(s, { text: `${pub.defendant} was charged with ${(pub.charge ?? 'an offense').toLowerCase()}`, truth: true, important: true });
  const c2 = addClaim(s, { text: pub.outcome === 'pending' ? 'The case has not yet been decided' : `The case ended: ${pub.outcome}`, truth: true, important: true });
  const c3 = addClaim(s, { text: `${pub.defendant} committed the crime`, kind: 'allegation', truth: convicted, important: true });
  const c4 = addClaim(s, { text: 'A neighbor saw someone at the scene that night', truth: r.chance(0.6) });
  addDoc(s, { title: `The public court record (${pub.court ?? 'the court'})`, settles: [{ claimId: c1.id }, { claimId: c2.id }, ...(pub.outcome !== 'pending' ? [{ claimId: c3.id }] : [])] });
  addDoc(s, { title: 'The police case file', public: false, why: 'Case files are not available to a reporter, and asking someone to leak one puts you both in the wrong. The court record is public.' });
  addDoc(s, { title: 'Sealed witness statements', public: false, why: 'Sealed records stay sealed. A witness who chooses to talk can talk to you.' });
  const wit = makeNpc({ role: 'acquaintance', countryId: w.countryId, age: r.int(25, 75) });
  wit.occupation = `A witness in ${pub.title.split(',')[0].toLowerCase()}`;
  store.state.npcs[wit.id] = wit;
  const c4true = s.claims.find((x) => x.id === c4.id).truth;
  addSource(s, { npcId: wit.id, name: nameOf(wit), role: 'A neighbor who was there', type: 'witness', willing: 0.55, knows: [{ claimId: c4.id, says: r.chance(0.7) ? c4true : !c4true }, { claimId: c3.id, says: true }] });
  addSource(s, { institution: true, name: 'The defense', role: 'The defendant\'s lawyer', type: 'lawyer', willing: 0.5, knows: [{ claimId: c3.id, says: false }, { claimId: c1.id, says: true }] });
  addSource(s, { institution: true, name: pub.agency ?? 'The police', role: 'The investigating agency', type: 'official', willing: 0.35, knows: [{ claimId: c1.id, says: true }] });
  return s;
}

/** A sports story, from a season really played (engine/sports): who won, and by how much. */
function sportsStory(p, o, r, w = { countryId: p.countryId, city: p.city }) {
  const seasons = Object.values(store.state.sports?.seasons ?? {}).filter((x) => x.champion && x.year >= year() - 2 && !Object.values(S().stories).some((s) => s.links.seasonId === x.id && s.reporterId === p.id));
  const season = seasons.sort((a, b) => b.year - a.year)[0];
  if (!season) return null;
  const team = store.state.sports.teams?.[season.champion];
  const name = team?.name ?? 'The champions';
  const s = newStory(p, o, 'sports', `${name} win the ${season.name}`, { subject: name, links: { seasonId: season.id } });
  const c1 = addClaim(s, { text: `${name} won the ${season.name}`, truth: true, important: true });
  const c2 = addClaim(s, { text: `${name} were expected to finish lower`, truth: (season.preview?.[season.champion] ?? 1) > 2 });
  const c3 = addClaim(s, { text: 'It was the best season the club has had', kind: 'opinion', truth: true });
  addDoc(s, { title: 'The official results and table', settles: [{ claimId: c1.id }, { claimId: c2.id }] });
  const coach = makeNpc({ role: 'acquaintance', countryId: w.countryId, age: r.int(35, 62) });
  coach.occupation = `Coach of ${name}`;
  store.state.npcs[coach.id] = coach;
  addSource(s, { npcId: coach.id, name: nameOf(coach), role: `${name}'s coach`, type: 'athlete', willing: 0.7, knows: [{ claimId: c1.id, says: true }, { claimId: c3.id, says: true }, { claimId: c2.id, says: true }] });
  return s;
}

/** A music story, from a record that really came out (engine/music): its chart place, from the published chart. */
function musicStory(p, o, r, w = { countryId: p.countryId, city: p.city }) {
  const rels = Object.values(store.state.entertainment?.releases ?? {}).filter((x) => x.released != null && x.released >= year() - 1 && store.state.entertainment.acts?.[x.actId]?.countryId === w.countryId
    && !Object.values(S().stories).some((s) => s.links.releaseId === x.id && s.reporterId === p.id));
  const rel = rels.sort((a, b) => (a.chart ?? 99) - (b.chart ?? 99))[0];
  if (!rel) return null;
  const a = store.state.entertainment.acts[rel.actId];
  const s = newStory(p, o, 'entertainment', `${a.name}'s ${RELEASE_TYPES[rel.type]?.name.toLowerCase() ?? 'record'} ${rel.title}`, { subject: a.name, links: { releaseId: rel.id, actId: a.id } });
  const charted = !!rel.chart;
  const c1 = addClaim(s, { text: `${rel.title} came out in ${rel.released}`, truth: true, important: true });
  const c2 = addClaim(s, { text: charted ? `It reached number ${rel.chart} in the chart` : 'It reached the top ten', truth: charted || false });
  const c3 = addClaim(s, { text: 'It is their best record', kind: 'opinion', truth: true });
  addDoc(s, { title: 'The published chart', settles: [{ claimId: c1.id }, { claimId: c2.id }] });
  const member = a.members.map((m) => m.who).find((id) => id !== 'player' && npc(id)?.alive);
  if (member) addSource(s, { npcId: member, name: nameOf(npc(member)), role: `Of ${a.name}`, type: 'entertainer', willing: 0.55, knows: [{ claimId: c1.id, says: true }, { claimId: c3.id, says: true }, { claimId: c2.id, says: true }] });
  addSource(s, { institution: true, name: 'The record label', role: 'Press office', type: 'company', willing: 0.6, knows: [{ claimId: c1.id, says: true }, { claimId: c2.id, says: true }] });
  return s;
}

/** A political story, from the country's last general election (engine/polity). */
function politicsStory(p, o, r, w = { countryId: p.countryId, city: p.city }) {
  const pw = polity(w.countryId);
  const el = pw?.elections?.at(-1);
  if (!el || !el.seats || Object.values(S().stories).some((s) => s.links.election === `${w.countryId}:${el.year}` && s.reporterId === p.id)) return null;
  const top = Object.entries(el.seats).sort((a, b) => b[1] - a[1])[0];
  const party = pw.parties.find((x) => x.id === top[0]);
  const loser = pw.parties.find((x) => x.id !== top[0]);
  const s = newStory(p, o, 'politics', `How the ${el.year} election was won`, { subject: party?.name, links: { election: `${w.countryId}:${el.year}` }, needsComment: true });
  const c1 = addClaim(s, { text: `${party?.name ?? 'The winners'} won the most seats in ${el.year}`, truth: true, important: true });
  const c2 = addClaim(s, { text: `Turnout was ${el.turnout ?? 70}%`, truth: true });
  const c3 = addClaim(s, { text: 'The count was unfair', kind: 'allegation', truth: false });
  addDoc(s, { title: 'The electoral commission\'s published results', settles: [{ claimId: c1.id }, { claimId: c2.id }, { claimId: c3.id }] });
  const lead = (pa) => (pa ? pw.figures[pa.leaderId] : null);
  if (lead(party)) addSource(s, { figureId: lead(party).id, name: lead(party).name, role: `Leader of ${party.name}`, type: 'official', willing: 0.45, knows: [{ claimId: c1.id, says: true }] });
  if (lead(loser)) addSource(s, { figureId: lead(loser).id, name: lead(loser).name, role: `Leader of ${loser.name}`, type: 'official', willing: 0.6, knows: [{ claimId: c3.id, says: true }, { claimId: c1.id, says: true }] });
  return s;
}

/** An investigation: a tip about a real employer in the city. Most tips do not stand up as first told. */
function investigativeStory(p, o, r, w = { countryId: p.countryId, city: p.city }) {
  // A real employer in the city, not a newsroom or a shop the player owns.
  const list = cityEmployers(w.countryId, w.city).filter((x) => x.family !== 'media');
  const e = list.length ? r.pick(list) : null;
  if (!e) return null;
  const tip = r.pick(TIPS);
  const truth = r.chance(0.4);
  const t = (x) => x.replace('{org}', e.name);
  const s = newStory(p, o, 'investigative', t(tip.title), { subject: e.name, links: { employerId: e.id }, needsComment: true, needsLegal: true });
  const main = addClaim(s, { text: t(tip.claim), kind: 'allegation', truth, important: true });
  const record = addClaim(s, { text: `${tip.record} show problems at ${e.name}`, truth });
  const pattern = addClaim(s, { text: 'It has been going on for more than a year', truth: truth && r.chance(0.7) });
  const insider = makeNpc({ role: 'acquaintance', countryId: w.countryId, age: r.int(24, 60) });
  insider.occupation = `Worked at ${e.name}`;
  store.state.npcs[insider.id] = insider;
  const second = makeNpc({ role: 'acquaintance', countryId: w.countryId, age: r.int(24, 60) });
  second.occupation = `Works at ${e.name}`;
  store.state.npcs[second.id] = second;
  addSource(s, { npcId: insider.id, name: nameOf(insider), role: `${tip.inside.replace(/^./, (c) => c.toUpperCase())}`, type: 'citizen', willing: 0.8, wantsConfidential: true,
    knows: [{ claimId: main.id, says: true }, { claimId: pattern.id, says: true }], doc: truth && r.chance(0.6) ? { title: 'Copies of internal rotas and pay slips, given to you', settles: [{ claimId: main.id }] } : null });
  addSource(s, { npcId: second.id, name: nameOf(second), role: 'A current employee', type: 'citizen', willing: 0.45, hidden: true, knows: [{ claimId: main.id, says: r.chance(0.75) ? truth : !truth }, { claimId: pattern.id, says: truth }] });
  addSource(s, { institution: true, name: e.name, role: 'The company', type: 'company', willing: 0.5, knows: [{ claimId: main.id, says: false }] });
  addDoc(s, { title: tip.record, settles: [{ claimId: record.id }], cost: 2 });
  addDoc(s, { title: `${e.name}'s internal records`, public: false, why: 'Not lawfully available to you. Getting into them without permission is not reporting. A source may choose to share what they have.' });
  return s;
}

/** This year's assignments for the reporter: on their beat, about things that happened; never invented events. */
export function assignYear(p = player()) {
  const j = J(p);
  if (!working(p) || j.assigned === year()) return [];
  j.assigned = year();
  if (j.leave === year() && isReporter(p)) { p.stats.mood = clamp(p.stats.mood + 10); return []; }
  // On staff, stories come from the newsroom; a freelancer finds their own and sells them; an owner reports for their own.
  const o = isReporter(p) ? outlet(j.outletId) : ownedOutlet(p);
  const made = [];
  const n = isReporter(p) ? 2 + Math.min(3, p.career.level ?? 0) : 2;
  const where = j.posting ? { countryId: j.posting.countryId, city: j.posting.city } : { countryId: p.countryId, city: p.city };
  const cases = (() => { try { return publicCases(p); } catch { return []; } })();
  for (let i = 0; i < n; i++) {
    const r = seeded(`${p.id}/${year()}/assign/${i}`);
    const beat = i === 0 || r.chance(0.6) ? j.beat : 'local';
    // A correspondent posted abroad reports where they are posted; court, sports and music stay with the home desk.
    const abroad = !!j.posting && j.posting.countryId !== p.countryId;
    const b = abroad && ['court', 'sports', 'entertainment'].includes(beat) ? 'local' : beat;
    const gen = { local: localStory, court: (pp, oo, rr, ww) => courtStory(pp, oo, rr, cases, ww), sports: sportsStory, entertainment: musicStory, politics: politicsStory, investigative: investigativeStory,
      business: businessStory, science: scienceStory, kpop: kpopStory, education: educationStory, environment: environmentStory, technology: technologyStory, arts: artsStory, data: dataStory }[b] ?? localStory;
    const s = gen(p, o, r, where) ?? localStory(p, o, r, where); // nothing on the beat this year: a local story instead
    made.push(s);
  }
  return made;
}

// ---------- The notebook ----------

/** What the evidence gathered says of a claim. Never the truth itself. */
export function statusOf(s, c) {
  const ev = s.evidence.filter((e) => e.claimId === c.id && !e.offRecord);
  const doc = ev.filter((e) => e.type === 'doc');
  if (doc.length) return doc.some((e) => e.says) ? 'verified' : 'false';
  const yes = new Set(ev.filter((e) => e.type === 'source' && e.says).map((e) => e.sourceId));
  const no = new Set(ev.filter((e) => e.type === 'source' && !e.says).map((e) => e.sourceId));
  if (yes.size && no.size) return 'disputed';
  if (yes.size >= 2) return 'supported';
  if (yes.size === 1) return 'single';
  if (no.size) return 'disputed';
  return 'open';
}
/** A story as the reporter's notebook shows it: what is known and from whom, with no hidden truth in it. */
export function notebook(id) {
  const s = story(id);
  if (!s) return null;
  return { id: s.id, title: s.title, beat: s.beat, status: s.status, outlet: outlet(s.outletId)?.name ?? 'Not yet sold', editorId: s.editorId, deadline: s.deadline, subject: s.subject,
    fee: s.fee ?? null, commissioned: !!s.outletId, own: !!(s.outletId && outlet(s.outletId)?.ownerId),
    claims: s.claims.map((c) => ({ id: c.id, text: c.text, kind: c.kind, important: c.important, status: statusOf(s, c),
      heard: s.evidence.filter((e) => e.claimId === c.id).map((e) => ({ from: e.type === 'doc' ? s.docs.find((d) => d.id === e.docId)?.title : sourceLabel(s, e.sourceId, e.attribution), says: e.says, offRecord: !!e.offRecord })) })),
    sources: s.sources.filter((x) => !x.hidden).map((x) => ({ id: x.id, name: x.name, role: x.role, npcId: x.npcId ?? null, institution: !!x.institution, asked: s.interviews.some((i) => i.sourceId === x.id), agreed: s.interviews.find((i) => i.sourceId === x.id)?.accepted ?? null, wantsConfidential: x.wantsConfidential })),
    docs: s.docs.filter((d) => !d.secret || d.found).map((d) => ({ id: d.id, title: d.title, public: d.public, why: d.why ?? '', read: s.evidence.some((e) => e.docId === d.id) })),
    comment: s.comment, legal: s.legal, draft: s.draft, review: s.review, pubId: s.pubId, needsComment: !!s.needsComment, needsLegal: !!s.needsLegal };
}
function sourceLabel(s, sourceId, attribution) {
  const x = s.sources.find((y) => y.id === sourceId);
  if (!x) return 'A source';
  return attribution === 'confidential' || attribution === 'background' ? `${x.role} (not named)` : `${x.name}, ${x.role.toLowerCase()}`;
}
const open = (s, p = player()) => s && s.reporterId === p.id && !['published', 'spiked', 'expired'].includes(s.status);

/**
 * Interviews a source: they may say no (as is their right). Questions draw out what they know: what they saw,
 * a record they hold, someone else to ask, their view. A confidential source will not go on the record.
 */
export function interview(storyId, sourceId, questions = ['saw'], attribution = 'record') {
  const p = player();
  const s = story(storyId);
  if (!open(s, p)) return result(false, 'That story is not open.', 'neutral');
  const src = s.sources.find((x) => x.id === sourceId && !x.hidden);
  if (!src) return result(false, 'No such source.', 'neutral');
  if (s.interviews.some((i) => i.sourceId === sourceId && i.year === year())) return result(false, 'You have asked them this year.', 'neutral');
  if (!ATTRIBUTION[attribution]) return result(false, 'Agree how they can be quoted first.', 'neutral');
  if (src.wantsConfidential && attribution === 'record') return result(false, `${src.name} will talk, but not on the record. Agree to keep them unnamed, or do without them.`, 'neutral');
  if (!spend(1, p)) return result(false, 'You are out of time this year.', 'neutral');
  const r = seeded(`${s.id}/${src.id}/${year()}`);
  const yes = r.next() < clamp(src.willing + (J(p).skills.interviewing - 40) / 250, 0.05, 0.95);
  const rec = { sourceId, year: year(), at: now(), accepted: yes, attribution, questions, said: [] };
  s.interviews.push(rec);
  s.status = s.status === 'assigned' ? 'reporting' : s.status;
  if (!yes) return result(false, `${src.name} does not want to talk to a reporter. That is their right.`, 'neutral');
  grow('interviewing', 2);
  const off = attribution === 'off';
  const lines = [];
  for (const q of questions) {
    const d = QUESTIONS[q]?.draws;
    if (d === 'facts') for (const k of src.knows) { const c = s.claims.find((x) => x.id === k.claimId); if (c.kind === 'opinion' || s.evidence.some((e) => e.sourceId === src.id && e.claimId === c.id)) continue; s.evidence.push({ type: 'source', sourceId: src.id, claimId: c.id, says: k.says, attribution, offRecord: off }); lines.push(`${k.says ? 'Says' : 'Says it is not so that'}: ${c.text.charAt(0).toLowerCase()}${c.text.slice(1)}.`); }
    if (d === 'opinion') for (const k of src.knows) { const c = s.claims.find((x) => x.id === k.claimId); if (c.kind !== 'opinion') continue; s.evidence.push({ type: 'source', sourceId: src.id, claimId: c.id, says: k.says, attribution, offRecord: off }); lines.push(`In their view: ${c.text.charAt(0).toLowerCase()}${c.text.slice(1)}.`); }
    if (d === 'documents' && src.doc && !s.docs.some((x) => x.fromSource === src.id)) { addDoc(s, { ...src.doc, fromSource: src.id }); lines.push(`They hand you something: ${src.doc.title.toLowerCase()}.`); }
    else if (d === 'documents') lines.push('They have no records to share.');
    if (d === 'sources') { const h = s.sources.find((x) => x.hidden); if (h) { h.hidden = false; lines.push(`They suggest you talk to ${h.name}, ${h.role.toLowerCase()}.`); } else lines.push('They cannot think of anyone else.'); }
    if (d === 'clarify') {
      const wrong = src.knows.find((k) => { const c = s.claims.find((x) => x.id === k.claimId); return c.kind !== 'opinion' && k.says !== c.truth; });
      if (wrong && r.chance(0.45)) { const e = s.evidence.find((x) => x.sourceId === src.id && x.claimId === wrong.claimId); if (e) e.says = !e.says; wrong.says = !wrong.says; lines.push('Thinking again, they correct something they told you.'); }
      else lines.push('They stand by what they said.');
    }
  }
  rec.said = lines;
  if (src.npcId && npc(src.npcId)) { const n = npc(src.npcId); n.flags.interviewedBy ??= []; if (!n.flags.interviewedBy.includes(s.id)) n.flags.interviewedBy.push(s.id); }
  return result(true, `${src.name} agrees to talk${attribution !== 'record' ? ` (${ATTRIBUTION[attribution].name.toLowerCase()})` : ''}. ${lines.join(' ') || 'They have little to add.'}${off ? ' None of it can be published.' : ''}`, 'neutral');
}

/** Reads a record. Public records only: a sealed file, a police file or a company's private papers are refused. */
export function readDoc(storyId, docId) {
  const p = player();
  const s = story(storyId);
  if (!open(s, p)) return result(false, 'That story is not open.', 'neutral');
  const d = s.docs.find((x) => x.id === docId);
  if (!d) return result(false, 'No such record.', 'neutral');
  if (!d.public && !d.fromSource) return result(false, d.why ?? 'That record is not available to a reporter.', 'neutral');
  if (s.evidence.some((e) => e.docId === docId)) return result(false, 'You have read it.', 'neutral');
  if (!spend(d.cost ?? 1, p)) return result(false, 'You are out of time this year.', 'neutral');
  grow('verification', 2.5); grow('reporting', 1);
  s.status = s.status === 'assigned' ? 'reporting' : s.status;
  const lines = [];
  for (const x of d.settles) {
    const c = s.claims.find((y) => y.id === x.claimId);
    s.evidence.push({ type: 'doc', docId, claimId: c.id, says: c.truth });
    lines.push(`${c.truth ? 'It confirms' : 'It does not bear out'}: ${c.text.charAt(0).toLowerCase()}${c.text.slice(1)}.`);
  }
  return result(true, `${d.title}. ${lines.join(' ') || 'Nothing in it touches the story.'}`, 'neutral');
}

/** Asks the subject of the story for their side. They may decline: the story says so. */
export function askComment(storyId) {
  const p = player();
  const s = story(storyId);
  if (!open(s, p)) return result(false, 'That story is not open.', 'neutral');
  if (s.comment) return result(false, 'You have asked for comment.', 'neutral');
  if (!spend(1, p)) return result(false, 'You are out of time this year.', 'neutral');
  const r = seeded(`${s.id}/comment`);
  const said = r.chance(0.4) ? 'declined to comment' : s.claims.some((c) => c.kind === 'allegation' && c.truth) ? 'said it was looking into the matter' : 'denied it';
  s.comment = { at: now(), said };
  return result(true, `${s.subject ?? 'The subject'} ${said}. That goes in the story.`, 'neutral');
}

/** The newsroom lawyer reads an investigation or court story before it runs. */
export function legalReview(storyId) {
  const p = player();
  const s = story(storyId);
  if (!open(s, p)) return result(false, 'That story is not open.', 'neutral');
  if (s.legal) return result(false, 'It has been read.', 'neutral');
  if (!spend(1, p)) return result(false, 'You are out of time this year.', 'neutral');
  const weak = s.claims.filter((c) => c.kind === 'allegation' && !['verified'].includes(statusOf(s, c)));
  s.legal = { at: now(), notes: weak.length ? `Anything not shown by a record must be attributed, not stated: ${weak.map((c) => c.text.toLowerCase()).join('; ')}.` : 'Nothing that is not backed by the record.' };
  return result(true, `The lawyer reads it. ${s.legal.notes}`, 'neutral');
}

// ---------- Writing, the editor, publishing ----------

/** How a claim goes into the story: as fact when the evidence holds it up; otherwise attributed, or left out. */
const asFactOk = (st) => st === 'verified' || st === 'supported';
/** The headlines the reporter can choose from: straight, attributed, or one that overstates. */
export function headlines(storyId) {
  const s = story(storyId);
  if (!s) return [];
  const main = s.claims.find((c) => c.important && c.kind !== 'opinion' && c.kind !== 'allegation') ?? s.claims[0];
  const alleg = s.claims.find((c) => c.kind === 'allegation');
  const out = [{ id: 'straight', text: main.text, sub: 'Straight news: what the record shows.' }];
  if (alleg) out.push({ id: 'attributed', text: `${alleg.text}, ${s.sources.find((x) => x.knows.some((k) => k.claimId === alleg.id && k.says))?.role.toLowerCase() ?? 'some'} say${s.sources.find((x) => x.knows.some((k) => k.claimId === alleg.id && k.says))?.institution ? 's' : ''}`, sub: 'Attributed: says who claims it.' });
  out.push({ id: 'human', text: `${s.subject ?? 'People'} and ${s.title.charAt(0).toLowerCase()}${s.title.slice(1)}`, sub: 'Human interest.' });
  if (alleg) out.push({ id: 'overstated', text: alleg.text.replace(/^./, (c) => c.toUpperCase()), sub: 'States the allegation as fact.' });
  return out;
}

/** Writes the draft: which claims go in, and the headline. The game assembles the text from the saved notes. */
export function draft(storyId, include, headlineId) {
  const p = player();
  const s = story(storyId);
  if (!open(s, p)) return result(false, 'That story is not open.', 'neutral');
  const h = headlines(storyId).find((x) => x.id === headlineId);
  if (!h) return result(false, 'Choose a headline.', 'neutral');
  const inc = include.filter((id) => s.claims.some((c) => c.id === id));
  if (!inc.length) return result(false, 'Put something in it.', 'neutral');
  if (!spend(1, p)) return result(false, 'You are out of time this year.', 'neutral');
  s.draft = { include: inc, headline: h.id, headlineText: h.text, at: now() };
  s.status = 'drafted';
  grow('writing', 2);
  return result(true, `Drafted: "${h.text}". It goes to ${nameOf(npc(s.editorId)) || 'your editor'} when you send it.`, 'neutral');
}

/** The body of the story, assembled from what the notebook holds: facts as facts, the rest attributed. */
function body(s) {
  const lines = [];
  for (const id of s.draft.include) {
    const c = s.claims.find((x) => x.id === id);
    const st = statusOf(s, c);
    const who = s.evidence.find((e) => e.claimId === c.id && e.type === 'source' && e.says && !e.offRecord);
    if (c.kind === 'opinion') { if (who) lines.push(`"${c.text}," said ${sourceLabel(s, who.sourceId, who.attribution)}.`); continue; }
    if (asFactOk(st) && c.kind !== 'allegation') lines.push(`${c.text}.`);
    else if (c.kind === 'allegation' && st === 'verified') lines.push(`${c.text}, the record shows.`);
    else if (who) lines.push(`${sourceLabel(s, who.sourceId, who.attribution)} says ${c.text.charAt(0).toLowerCase()}${c.text.slice(1)}${st === 'disputed' ? '; others dispute this' : ''}.`);
  }
  if (s.comment) lines.push(`${s.subject ?? 'The subject'} ${s.comment.said}.`);
  return lines.join(' ');
}

/**
 * Sends the draft to the editor. They read it for what it is: claims as facts need the evidence, allegations need
 * attribution and a request for comment, an overstated headline goes back. Never the reporter's fame.
 */
export function submit(storyId) {
  const p = player();
  const s = story(storyId);
  if (!open(s, p)) return result(false, 'That story is not open.', 'neutral');
  if (!s.draft) return result(false, 'Write a draft first.', 'neutral');
  const o = outlet(s.outletId);
  if (!o) return result(false, 'Pitch it to a newsroom first: a freelance story needs someone to run it.', 'neutral');
  const ed = npc(s.editorId) ?? (o.ownerId === p.id ? { firstName: 'You', lastName: '(as editor)' } : null);
  const issues = [];
  const inc = s.draft.include.map((id) => s.claims.find((c) => c.id === id));
  const facts = inc.filter((c) => c.kind === 'fact');
  const st = (c) => statusOf(s, c);
  if (!facts.some((c) => asFactOk(st(c)))) issues.push(o.standards < 0.5 && facts.some((c) => st(c) === 'single') ? null : 'Nothing in it is confirmed yet: a record, or two people who agree.');
  for (const c of facts) if (st(c) === 'false') issues.push(`The record says otherwise: "${c.text}". Take it out.`);
  for (const c of facts) if (st(c) === 'single' && c.important && o.standards >= 0.6) issues.push(`"${c.text}" rests on one source. Find a second, or a record.`);
  const alleg = inc.filter((c) => c.kind === 'allegation');
  if (alleg.length && s.needsComment && !s.comment) issues.push('Ask them for comment before we run an allegation.');
  if (s.needsLegal && !s.legal && alleg.length) issues.push('This needs the lawyer to read it first.');
  if (s.draft.headline === 'overstated' && alleg.some((c) => st(c) !== 'verified')) issues.push('The headline states as fact what we can only attribute.');
  if (inc.some((c) => !s.evidence.some((e) => e.claimId === c.id && !e.offRecord))) issues.push('Some of it has no source at all.');
  if (s.deadline && now() > s.deadline) { s.status = 'expired'; return result(false, 'The moment has passed: the story is dead. It happens.', 'neutral'); }
  const list = issues.filter(Boolean);
  s.review = { at: now(), by: s.editorId, decision: list.length ? 'revise' : 'approved', notes: list };
  s.status = list.length ? 'revise' : 'approved';
  if (o.ownerId === p.id && !npc(s.editorId)) return list.length ? result(false, `Reading it as your own editor, by the policy you set: ${list.join(' ')}`, 'neutral') : result(true, 'You read it as your own editor, by the policy you set. It can run.');
  if (list.length) return result(false, `${nameOf(ed) || 'Your editor'} sends it back: ${list.join(' ')}`, 'neutral');
  return result(true, `${nameOf(ed) || 'Your editor'} reads it twice and approves it. It can run.`);
}

/** Publishes an approved story, once. The record is kept as it ran; what it got wrong comes back later. */
export function publish(storyId, o2 = {}) {
  const p = player();
  const s = story(storyId);
  if (!s || s.reporterId !== p.id) return result(false, 'That story is not yours.', 'neutral');
  if (s.pubId) return result(false, 'It has already run.', 'neutral');
  if (s.status !== 'approved') return result(false, 'The editor has not approved it.', 'neutral');
  const o = outlet(s.outletId);
  if (isBroadcast(o) && !o2.live) return result(false, `On ${o.medium === 'television' ? 'television' : 'the radio'} a story goes out live: present it.`, 'neutral');
  const j = J(p);
  const inc = s.draft.include.map((id) => s.claims.find((c) => c.id === id));
  const asFact = inc.filter((c) => (c.kind === 'fact' && asFactOk(statusOf(s, c))) || (c.kind === 'allegation' && statusOf(s, c) === 'verified'));
  const errors = asFact.filter((c) => !c.truth).map((c) => c.id);
  const quality = Math.round(clamp(40 + asFact.length * 8 + (s.comment ? 6 : 0) + (j.skills.writing - 40) / 3 + (s.beat === 'investigative' ? 12 : 0) - errors.length * 20));
  const id = nextId('pub');
  const pub = { id, storyId: s.id, reporterId: p.id, byline: `${p.firstName} ${p.lastName}`, outletId: o.id, outlet: o.name, medium: o.medium, at: now(), year: year(), beat: s.beat,
    headline: s.draft.headlineText, body: body(s), claims: inc.map((c) => ({ id: c.id, text: c.text, asFact: asFact.includes(c) })), sources: s.sources.filter((x) => s.interviews.some((i) => i.sourceId === x.id && i.accepted && i.attribution !== 'off')).map((x) => {
      const att = s.interviews.find((i) => i.sourceId === x.id).attribution;
      return { name: att === 'record' ? x.name : `${x.role} (not named)`, attribution: att, npcId: att === 'record' ? x.npcId ?? null : null };
    }), errors, quality, readers: Math.round(o.audience * (0.3 + quality / 140)), complaint: null, corrections: [], links: { ...s.links } };
  S().pubs[id] = pub;
  s.pubId = id;
  s.status = 'published';
  // A freelance fee is paid once, for this piece, under its contract; never again for the same work.
  if (s.fee && !pub.feePaid) { pub.fee = s.fee; pub.feePaid = true; p.finance.cash += s.fee; p.finance.lifetimeEarned = (p.finance.lifetimeEarned ?? 0) + s.fee; }
  if (o.ownerId === p.id) o.published = (o.published ?? 0) + 1;
  // A reporter's standing: accuracy, trust and recognition are kept apart, and none is fame.
  j.rep.recognition = clamp(j.rep.recognition + quality / 25);
  if (!errors.length) j.rep.accuracy = clamp(j.rep.accuracy + 2);
  grow('writing', 2); grow('reporting', 2);
  if (p.career) p.career.performance = clamp((p.career.performance ?? 50) + (errors.length ? 1 : 4));
  // What it got wrong comes back: a reader, a source, the subject's lawyer. Some complaints are wrong too.
  const r = seeded(`${id}/complaint`);
  if (errors.length) pub.complaint = { due: now() + r.int(1, 8), claimId: errors[0], real: true, raised: null, resolved: null };
  else if (r.chance(0.12)) pub.complaint = { due: now() + r.int(2, 10), claimId: inc[0].id, real: false, raised: null, resolved: null };
  keepLegacy(p);
  if (!j.history.some((h) => /first byline/i.test(h.text))) { j.history.push({ year: year(), text: `First byline: "${pub.headline}", ${o.name}.` }); milestone(`Your first byline: "${pub.headline}" in ${o.name}.`, 'career'); }
  for (const x of pub.sources) if (x.npcId && npc(x.npcId)) { const n = npc(x.npcId); (n.memories ??= []).push({ age: p.age, text: `Was quoted in your story "${pub.headline}".` }); }
  log(`"${pub.headline}" ran in ${o.name}. About ${pub.readers.toLocaleString('en-US')} people ${o.medium === 'print' ? 'read' : o.medium === 'online' ? 'read' : 'saw or heard'} it.`, 'system', 'good');
  return result(true, `It runs: "${pub.headline}", ${o.name}. About ${pub.readers.toLocaleString('en-US')} ${o.medium === 'television' ? 'viewers' : o.medium === 'radio' ? 'listeners' : 'readers'}.`);
}

/** Drops a story. Not every story stands up; spiking one that does not is a good decision. */
export function spike(storyId) {
  const s = story(storyId);
  if (!open(s)) return result(false, 'That story is not open.', 'neutral');
  s.status = 'spiked';
  const unsupported = s.claims.some((c) => c.kind === 'allegation' && !c.truth);
  if (unsupported) J().rep.trust = clamp(J().rep.trust + 2);
  return result(true, unsupported ? 'You drop it. The allegation never stood up, and the story would not have either.' : 'You drop it. Maybe another time.', 'neutral');
}

/** Complaints come in once they are due (seen when the reporter opens their work, or at the turn of the year). */
export function raiseComplaints(p = player()) {
  const out = [];
  for (const pub of myPubs(p)) {
    const c = pub.complaint;
    if (!c || c.raised || now() < c.due) continue;
    c.raised = now();
    out.push(pub);
  }
  return out;
}
/** Answers a complaint: correct the story, or stand by it. A correction is added; the story as it ran is kept. */
export function answerComplaint(pubId, correct) {
  const p = player();
  const pub = S().pubs[pubId];
  if (!pub || pub.reporterId !== p.id || !pub.complaint?.raised || pub.complaint.resolved) return result(false, 'There is nothing to answer.', 'neutral');
  const j = J(p);
  const claimText = pub.claims.find((c) => c.id === pub.complaint.claimId)?.text ?? 'one claim';
  pub.complaint.resolved = now();
  if (correct) {
    pub.corrections.push({ at: now(), text: pub.complaint.real ? `Correction: an earlier version of this story said "${claimText}". That was not right.` : `Clarification: "${claimText}" was correct; it has been made clearer.` });
    j.rep.trust = clamp(j.rep.trust + (pub.complaint.real ? 3 : 0));
    if (pub.complaint.real) j.rep.accuracy = clamp(j.rep.accuracy - 3);
    return result(true, pub.complaint.real ? 'The correction runs, as prominent as the error. Readers trust a paper that corrects itself.' : 'You add a clarification. It was right; now it is clearer.', 'neutral');
  }
  if (pub.complaint.real) { j.rep.trust = clamp(j.rep.trust - 8); j.rep.accuracy = clamp(j.rep.accuracy - 6); pub.complaint.stood = true; return result(false, 'You stand by it. It was wrong, and it stays wrong in print: people notice.'); }
  pub.complaint.stood = true;
  j.rep.trust = clamp(j.rep.trust + 2);
  return result(true, 'You stand by it, and the record backs you.', 'neutral');
}

// ---------- The newsroom's year ----------

/**
 * Once a year: complaints that are due, last year's stories that died, routine work, a promotion where there is
 * a place and the work earns it, prizes judged on the year's work (never guaranteed), and the new year's assignments.
 */
export function tickJournalism(p = player()) {
  const j = p.journalism;
  if (!j) return [];
  const lines = [];
  if (p.career?.careerId === 'journalist' && !j.outletId) migrateJournalist(p);
  for (const pub of raiseComplaints(p)) lines.push(`A complaint about "${pub.headline}" has come in. It is waiting in your journalism career.`);
  for (const s of myStories(p)) if (open(s, p) && s.deadline && now() > s.deadline) s.status = 'expired';
  const own = ownedOutlet(p);
  if (own) lines.push(...ownedYear(own, p));
  for (const id of J(p).sisters ?? []) { const o = S().outlets[id]; if (o && !o.closed && o.ownerId === p.id) lines.push(...ownedYear(o, p)); }
  keepLegacy(p);
  if (!isReporter(p)) { if (ownedOutlet(p)) newsroomScene(p); if (working(p)) { const made = assignYear(p); if (made.length) lines.push(`${made.length} new leads ${j.freelance ? 'to report and sell' : `for ${own?.name}`}.`); } return lines; }
  const lived = year() - 1;
  const pubs = myPubs(p).filter((x) => x.year === lived);
  // The ordinary run of the work: briefs and updates the newsroom runs without a decision from you.
  j.routine = (j.routine ?? 0) + 1;
  for (const k of ['reporting', 'writing']) grow(k, 1.5, p);
  // A promotion, when the work earns it and there is a place.
  const c = p.career;
  const good = myPubs(p).filter((x) => !x.errors.length && x.year > (j.promotedYear ?? 0)).length;
  const r = seeded(`${p.id}/promote/${year()}`);
  if ((c.yearsInRole ?? 1) >= 1 && good >= 2 + (c.level ?? 0) && j.rep.accuracy >= 50 && c.level < 4 && r.chance(0.6)) {
    if (promote()) { j.promotedYear = year(); j.history.push({ year: year(), text: `Promoted to ${c.title.toLowerCase()}.` }); }
  }
  // Prizes: judged on the year's work against everyone else's. Most good years win nothing.
  const best = pubs.filter((x) => !x.errors.length).sort((a, b) => b.quality - a.quality)[0];
  if (best) {
    const want = best.beat === 'investigative' ? 'investigation' : p.age < 30 ? 'young' : best.beat === 'local' ? 'local' : null;
    const a = AWARDS.find((x) => x.id === want);
    if (a && best.quality >= 70 && seeded(`${p.id}/award/${lived}`).chance(0.2 + (best.quality - 70) / 100)) {
      j.awards.push({ id: a.id, name: a.name, year: lived, pubId: best.id });
      milestone(`Won the ${a.name} for "${best.headline}".`, 'career');
      lines.push(`You won the ${a.name} for "${best.headline}".`);
    }
  }
  if (j.posting && year() >= j.posting.until) lines.push(endPosting(p).text);
  newsroomScene(p);
  // An anchor presents the news through the year without a decision every night.
  if (j.anchor) { j.rep.recognition = clamp(j.rep.recognition + 2); grow('broadcast', 1.5, p); }
  const made = assignYear(p);
  if (made.length) lines.push(`${made.length} new ${made.length === 1 ? 'assignment is' : 'assignments are'} waiting at ${outlet(j.outletId)?.name}.`);
  return lines;
}

/** Leaving the newsroom (leaving the special career, or the job). Stories in progress are dropped; what ran is kept. */
export function leaveNewsroom(p = player()) {
  const j = J(p);
  j.freelance = null;
  for (const s of myStories(p)) if (open(s, p)) s.status = 'spiked';
  if (j.outletId) j.history.push({ year: year(), text: `Left ${outlet(j.outletId)?.name}.` });
  j.outletId = null;
}


// ---------- Broadcast: radio and television ----------
//
// At a radio or television newsroom a story goes out as a segment the reporter presents. A live segment is a short
// run of choices: say what is verified, say what is not yet known, ask a colleague for context, or reach for
// something dramatic that is not established. Inventing on air is never rewarded. Presenting well is a skill of its
// own (broadcast), separate from reporting: a fine researcher can be awkward on camera, and the reverse.

export const isBroadcast = (o) => o && (o.medium === 'radio' || o.medium === 'television');
/** The live choices for presenting an approved story, and what each says about the presenter. */
export const LIVE_CHOICES = {
  verified: { label: 'Lead with what is verified', good: 2 },
  unknown: { label: 'Say clearly what is not yet known', good: 2 },
  context: { label: 'Ask a colleague for context', good: 1 },
  dramatic: { label: 'Reach for the dramatic version', good: -3 },
};

/** Practices on-air delivery: part of the year's work. */
export function practiceDelivery() {
  const p = player();
  if (!isReporter(p) || !isBroadcast(outlet(J(p).outletId))) return result(false, 'That is for radio and television reporters.', 'neutral');
  if (!spend(1, p)) return result(false, 'You are out of time this year.', 'neutral');
  J(p).skills.broadcast ??= 15;
  grow('broadcast', 4, p);
  return result(true, 'An hour in the booth, reading copy back until it sounds like talking. Better.', 'neutral');
}

/**
 * Presents an approved story live, in up to three choices, then it is published as a segment. What was said is kept
 * with it. A dramatic flourish never helps; an invented one is an error on the record.
 */
export function present(storyId, choices = ['verified', 'unknown']) {
  const p = player();
  const s = story(storyId);
  const o = s && outlet(s.outletId);
  if (!isBroadcast(o)) return result(false, 'That story is for print.', 'neutral');
  if (s.status !== 'approved' || s.pubId) return result(false, s.pubId ? 'It has already gone out.' : 'The editor has not approved it.', 'neutral');
  const j = J(p);
  j.skills.broadcast ??= 15;
  const picks = choices.filter((c) => LIVE_CHOICES[c]).slice(0, 3);
  const score = picks.reduce((n, c) => n + LIVE_CHOICES[c].good, 0);
  const r = seeded(`${s.id}/live`);
  const delivery = Math.round(clamp(j.skills.broadcast * 0.6 + score * 8 + r.int(-8, 8) + 15));
  const out = publish(storyId, { live: true });
  if (!out.ok) return out;
  const pub = S().pubs[s.pubId];
  pub.segment = { choices: picks, delivery, live: true };
  if (picks.includes('dramatic')) { j.rep.trust = clamp(j.rep.trust - 4); pub.segment.note = 'You went further than the facts on air.'; }
  grow('broadcast', 3, p);
  j.rep.recognition = clamp(j.rep.recognition + (o.medium === 'television' ? 2 : 1));
  if (!j.history.some((h) => /first live/i.test(h.text))) { j.history.push({ year: year(), text: `First live ${o.medium === 'television' ? 'report on television' : 'report on the radio'}.` }); milestone(`Your first live report, on ${o.name}.`, 'career'); }
  return result(true, `${out.text} You presented it live: ${delivery >= 70 ? 'clear, steady, and right' : delivery >= 50 ? 'fine, if a little stiff' : 'nervous, but the facts were there'}.${picks.includes('dramatic') ? ' The dramatic line did not help, and your producer noticed.' : ''}`, picks.includes('dramatic') ? 'neutral' : 'good');
}

/**
 * An anchor's chair: offered by audition, only at a broadcast newsroom, to a reporter whose on-air work earned it.
 * It is a role on top of the reporting career, never automatic with age or rank.
 */
export function anchorAuditionWhy(p = player()) {
  const j = J(p);
  const o = outlet(j.outletId);
  if (!isReporter(p) || !isBroadcast(o)) return 'Anchors are chosen from reporters at radio and television newsrooms.';
  if (j.anchor) return 'You are already an anchor.';
  const segs = myPubs(p).filter((x) => x.segment && !x.errors.length).length;
  if (segs < 3) return `Three clean segments on air first (${segs} so far).`;
  if ((j.skills.broadcast ?? 0) < 45) return 'Your delivery is not there yet: practice.';
  if (j.auditioned === year()) return 'You auditioned this year.';
  return '';
}
export function anchorAudition() {
  const p = player();
  const why = anchorAuditionWhy(p);
  if (why) return result(false, why, 'neutral');
  const j = J(p);
  j.auditioned = year();
  const o = outlet(j.outletId);
  const r = seeded(`${p.id}/anchor/${year()}`);
  const odds = clamp(0.2 + (j.skills.broadcast - 45) / 60 + (j.rep.accuracy - 50) / 150 + (p.stats.charm - 50) / 200, 0.05, 0.85);
  if (!r.chance(odds)) return result(false, `${o.name} gives the chair to someone else this time. Your reel was good; keep at it.`, 'neutral');
  j.anchor = { since: year(), show: o.medium === 'television' ? `${o.name} Tonight` : `${o.name} at Six` };
  p.career.title = o.medium === 'television' ? 'News anchor' : 'News presenter';
  j.history.push({ year: year(), text: `Became anchor of ${j.anchor.show}.` });
  milestone(`Became the anchor of ${j.anchor.show}.`, 'career');
  return result(true, `You get the chair: ${j.anchor.show} is yours.`);
}

/** People an anchor can ask on: real people of this world with a public role. They decide whether to come. */
export function guestChoices(p = player()) {
  const out = [];
  const w = polity(p.countryId);
  if (w) for (const pa of w.parties.slice(0, 3)) { const f = w.figures[pa.leaderId]; if (f && !f.died) out.push({ id: `fig:${f.id}`, name: f.name, role: `Leader of ${pa.name}`, willing: 0.5 }); }
  for (const a of Object.values(store.state.entertainment?.acts ?? {}).filter((x) => x.countryId === p.countryId && x.status === 'active').slice(0, 4)) {
    const m = a.members.map((x) => x.who).find((id) => id !== 'player' && npc(id)?.alive);
    if (m) out.push({ id: `npc:${m}`, name: nameOf(npc(m)), role: `Of ${a.name}`, willing: 0.55 });
  }
  for (const n of p.npcIds.map(npc).filter((x) => x?.alive && x.flags.star)) out.push({ id: `npc:${n.id}`, name: nameOf(n), role: n.occupation ?? 'A public figure', willing: 0.7 });
  return out;
}
/** An anchor's interview with a guest. Kept as a segment; the guest may decline, as is their right. */
export function interviewGuest(guestId, approach = 'fair') {
  const p = player();
  const j = J(p);
  if (!j.anchor) return result(false, 'That is an anchor\'s work.', 'neutral');
  const g = guestChoices(p).find((x) => x.id === guestId);
  if (!g) return result(false, 'They are not available.', 'neutral');
  if ((j.guests ?? []).some((x) => x.id === guestId && x.year === year())) return result(false, 'They were on this year.', 'neutral');
  if (!spend(2, p)) return result(false, 'You are out of time this year.', 'neutral');
  const r = seeded(`${p.id}/${guestId}/${year()}`);
  if (!r.chance(g.willing + (j.rep.trust - 50) / 200)) { (j.guests ??= []).push({ id: guestId, name: g.name, year: year(), declined: true }); return result(false, `${g.name} declines to come on. Their office is polite about it.`, 'neutral'); }
  const good = approach === 'fair';
  const delivery = Math.round(clamp((j.skills.broadcast ?? 20) * 0.6 + (good ? 20 : 5) + r.int(-10, 10)));
  (j.guests ??= []).push({ id: guestId, name: g.name, role: g.role, year: year(), approach, delivery });
  grow('broadcast', 2, p); grow('interviewing', 2, p);
  if (!good) j.rep.trust = clamp(j.rep.trust - 3);
  j.rep.recognition = clamp(j.rep.recognition + 1.5);
  if (g.id.startsWith('npc:')) { const n = npc(g.id.slice(4)); if (n) (n.memories ??= []).push({ age: p.age, text: `Was a guest on ${j.anchor.show}.` }); }
  return result(true, good ? `${g.name} comes on ${j.anchor.show}. You ask the hard questions plainly, and let them answer. A good conversation.` : `${g.name} comes on, and you go for the headline instead of the answer. It makes noise; it does not make you more trusted.`, good ? 'good' : 'neutral');
}

// ---------- Moving newsrooms ----------

/** A reporter applying to another newsroom, at their level: the work and the record count, never fame. */
export function moveWhy(o, p = player()) {
  const j = J(p);
  if (!isReporter(p)) return 'You need a newsroom job first.';
  if (o.id === j.outletId) return 'You work here.';
  if (j.applied[`${o.id}:move`] === year()) return 'You applied there this year.';
  if (myPubs(p).length < 2) return 'Two published stories first: they will want to see your clips.';
  return '';
}
export function applyMove(outletId) {
  const p = player();
  const o = outlet(outletId);
  if (!o) return result(false, 'There is no such newsroom.', 'neutral');
  const why = moveWhy(o, p);
  if (why) return result(false, why, 'neutral');
  const j = J(p);
  j.applied[`${o.id}:move`] = year();
  const r = seeded(`${p.id}/move/${o.id}/${year()}`);
  const odds = clamp(0.25 + (j.rep.accuracy - 50) / 120 + myPubs(p).filter((x) => !x.errors.length).length * 0.03 - (o.reputation - 55) / 180, 0.05, 0.8);
  if (!r.chance(odds)) return result(false, `${o.name} keeps your clips on file. Not this time.`, 'neutral');
  return moveTo(o, p);
}
function moveTo(o, p = player()) {
  const j = J(p);
  const from = outlet(j.outletId);
  for (const s of myStories(p)) if (open(s, p)) s.status = 'spiked';
  const level = p.career.level ?? 0;
  hire(CAREER_BY_ID.journalist, level, 60, `You move to ${o.name}.`, { employerId: o.employerId });
  j.outletId = o.id;
  j.anchor = null;
  meet(npc(o.editorId), `Your editor at ${o.name}`, p);
  meet(npc(o.seniorId), `A senior reporter at ${o.name}`, p);
  j.history.push({ year: year(), text: `Moved from ${from?.name ?? 'your old newsroom'} to ${o.name}.` });
  j.assigned = null;
  assignYear(p);
  return result(true, `You move to ${o.name}${isBroadcast(o) ? `, ${o.medium === 'television' ? 'in front of a camera' : 'behind a microphone'} now` : ''}. New editor, new desk, new assignments.`);
}

// ---------- The newsroom's people and moments (data/events/stories/newsroom.js) ----------
//
// At most one scene a year, picked from those whose conditions are true of this life, never one seen before: each
// is about real people (the editor, the senior reporter, a friend, a source quoted years ago) and real work.

function sceneOptions(p) {
  if (!isReporter(p)) return ownerScenes(p);
  const j = J(p);
  const o = outlet(j.outletId);
  const ed = npc(o.editorId);
  const senior = npc(o.seniorId);
  const seen = (j.scenes ??= {});
  const pubs = myPubs(p);
  const out = [];
  const add = (id, cast, when = true) => { if (when && !seen[id]) out.push({ id, cast }); };
  add('jn_editor_notes', { words: { editor: ed?.firstName ?? 'Your editor' } }, myStories(p).some((s) => s.review?.decision === 'revise'));
  add('jn_rival_exclusive', { words: { rival: senior ? nameOf(senior) : 'A colleague', first: senior?.firstName ?? 'They' } }, !!senior?.alive && pubs.length >= 1);
  const better = outletsHere(p).filter((x) => x.id !== o.id && OUTLET_KINDS[x.kind].reach > OUTLET_KINDS[o.kind].reach);
  add('jn_offer_elsewhere', { words: { outlet: better[0]?.name ?? '' } }, better.length && j.rep.recognition >= 25 && pubs.filter((x) => !x.errors.length).length >= 3);
  add('jn_paper_trouble', { words: { outlet: o.name } }, o.audience < 15000 && year() - (j.since ?? year()) >= 2);
  add('jn_advertiser', { words: { outlet: o.name } }, pubs.length >= 2);
  const friend = p.npcIds.map(npc).find((n) => n?.alive && ['friend', 'bestFriend'].includes(n.role) && n.age >= 18);
  add('jn_friend_subject', { words: { friend: friend?.firstName ?? '' } }, !!friend && pubs.length >= 1);
  add('jn_reader_letter', { words: { headline: pubs[0]?.headline ?? '' } }, pubs.some((x) => !x.errors.length && x.quality >= 60));
  const quoted = pubs.flatMap((x) => x.sources.filter((s) => s.npcId && npc(s.npcId)?.alive).map((s) => ({ s, x }))).find(({ x }) => year() - x.year >= 2);
  add('jn_source_returns', { words: { source: quoted ? quoted.s.name : '', headline: quoted?.x.headline ?? '' }, npcId: quoted?.s.npcId }, !!quoted);
  add('jn_new_editor', { words: { editor: ed ? nameOf(ed) : '' } }, !!ed && ed.age >= 64);
  add('jn_anchor_audition', { words: { outlet: o.name } }, !anchorAuditionWhy(p));
  // A colleague and the reporter: both adults, peers (never the editor, who supervises them), free to say no.
  const single = !p.npcIds.some((id) => ['spouse', 'partner'].includes(npc(id)?.role));
  add('jn_colleague_spark', { words: { first: senior?.firstName ?? '' }, npcId: senior?.id }, single && !!senior?.alive && p.age >= 18 && senior.age >= 18 && Math.abs(senior.age - p.age) <= 12 && senior.meters.relationship >= 60);
  add('jn_first_assignment', { words: { editor: ed?.firstName ?? 'Your editor' } }, year() - (j.since ?? year()) <= 1 && pubs.length === 0);
  add('jn_interview_wrong', { words: {} }, myStories(p).some((s) => s.interviews.some((i) => !i.accepted)));
  add('jn_tip_arrives', { words: {} }, (p.career.level ?? 0) >= 1 && pubs.length >= 2);
  add('jn_award_night', { words: { prize: j.awards.at(-1)?.name ?? '' } }, j.awards.some((a) => year() - a.year <= 1));
  add('jn_deadline', { words: { title: myStories(p).find((s) => open(s, p) && s.deadline && s.deadline - now() <= 3)?.title ?? '' } }, myStories(p).some((s) => open(s, p) && s.deadline && s.deadline - now() <= 3));
  add('jn_viral', { words: { show: j.anchor?.show ?? '' } }, !!j.anchor && (j.guests ?? []).some((g) => !g.declined && g.approach === 'fair' && g.delivery >= 60));
  const segs = pubs.filter((x) => x.segment);
  const firstPub = pubs.length === 1 ? pubs[0] : null;
  add('jn_first_byline', { words: { headline: firstPub?.headline ?? '', outlet: o.name } }, !!firstPub);
  const disputed = myStories(p).find((s) => open(s, p) && s.claims.some((c) => statusOf(s, c) === 'disputed'));
  add('jn_two_sources', { words: { title: disputed?.title ?? '' } }, !!disputed);
  const silent = myStories(p).find((s) => open(s, p) && s.needsComment && !s.comment && s.interviews.length >= 2);
  add('jn_no_comment', { words: { subject: silent?.subject ?? '' } }, !!silent);
  add('jn_headline_debate', { words: { editor: ed?.firstName ?? 'Your editor' } }, pubs.length >= 3);
  const fixed = pubs.find((x) => x.corrections.length);
  add('jn_correction', { words: { headline: fixed?.headline ?? '' } }, !!fixed);
  add('jn_one_editor_job', { words: { first: senior?.firstName ?? '', outlet: o.name } }, (p.career.level ?? 0) === 2 && !!senior?.alive);
  add('jn_divided', { words: { outlet: o.name } }, pubs.length >= 4);
  add('jn_new_generation', { words: {} }, (p.career.level ?? 0) >= 3 && p.age >= 40);
  add('jn_first_live', { words: { headline: segs[0]?.headline ?? '' } }, segs.length === 1);
  add('jn_breaking', { words: { outlet: o.name } }, isBroadcast(o) && segs.length >= 2);
  add('jn_national_offer', { words: { show: j.anchor?.show ?? '' } }, !!j.anchor && year() - j.anchor.since >= 3 && !j.anchor.national);
  add('jn_retirement_interview', { words: { years: String(year() - (j.since ?? year())) } }, p.age >= 62 && year() - (j.since ?? year()) >= 10);
  return out;
}
/** An owner's moments: an investor, a growing company, the first hire. */
function ownerScenes(p) {
  const j = J(p);
  const o = ownedOutlet(p);
  const seen = (j.scenes ??= {});
  const out = [];
  const add = (id, cast, when = true) => { if (when && !seen[id]) out.push({ id, cast }); };
  const offer = investorOffer(p);
  add('jn_investor', { words: { outlet: o.name, amount: offer ? fmtMoney(offer.amount, country()) : '' } }, !!offer && year() - o.founded >= 2);
  add('jn_first_hire', { words: { outlet: o.name, first: npc(o.staff[0]?.npcId)?.firstName ?? '' } }, o.staff.length === 1 && o.staff[0].role === 'reporter');
  add('jn_expands', { words: { outlet: o.name } }, ownedTitles(p).length >= 2 || o.staff.length >= 3);
  return out;
}
/** Picks this year's newsroom scene, if any. */
function newsroomScene(p) {
  const opts = sceneOptions(p);
  if (!opts.length) return null;
  const r = seeded(`${p.id}/scene/${year()}`);
  if (!r.chance(0.7)) return null;
  const pick = opts[Math.floor(r.next() * opts.length)];
  J(p).scenes[pick.id] = year();
  J(p).sceneCast = pick.cast;
  store.state.pendingEvents.push({ id: pick.id, cast: { words: pick.cast.words } });
  return pick.id;
}

/** The answer to a newsroom scene (effect type 'journalism'). @returns {string} a line for the outcome */
export function journalismChoice(value) {
  const p = player();
  const j = J(p);
  const o = outlet(j.outletId);
  const ed = o && npc(o.editorId);
  const senior = o && npc(o.seniorId);
  const rel = (n, d) => { if (n) n.meters.relationship = clamp(n.meters.relationship + d); };
  switch (value) {
    case 'notes:take': rel(ed, 6); grow('writing', 3); return '';
    case 'notes:argue': rel(ed, -4); return '';
    case 'rival:congratulate': rel(senior, 8); return '';
    case 'rival:team': rel(senior, 10); grow('reporting', 3); j.history.push({ year: year(), text: `Teamed up with ${nameOf(senior)} on a story.` }); return '';
    case 'rival:compete': rel(senior, -5); grow('reporting', 2); return '';
    case 'offer:take': { const better = outletsHere(p).filter((x) => x.id !== o.id && OUTLET_KINDS[x.kind].reach > OUTLET_KINDS[o.kind].reach)[0]; return better ? moveTo(better, p).text : ''; }
    case 'offer:stay': rel(ed, 6); return '';
    case 'trouble:stay': rel(ed, 8); j.rep.trust = clamp(j.rep.trust + 2); return '';
    case 'trouble:leave': return '';
    case 'ad:decline': j.rep.trust = clamp(j.rep.trust + 4); return '';
    case 'ad:editor': j.rep.trust = clamp(j.rep.trust + 3); rel(ed, 4); return '';
    case 'ad:go': j.rep.trust = clamp(j.rep.trust - 10); j.rep.accuracy = clamp(j.rep.accuracy - 4); j.history.push({ year: year(), text: 'Wrote a story an advertiser asked for.' }); return '';
    case 'friend:disclose': j.rep.trust = clamp(j.rep.trust + 3); rel(ed, 3); return '';
    case 'friend:write': j.rep.trust = clamp(j.rep.trust - 6); return '';
    case 'letter:answer': p.stats.mood = clamp(p.stats.mood + 4); j.rep.recognition = clamp(j.rep.recognition + 1); return '';
    case 'letter:keep': p.stats.mood = clamp(p.stats.mood + 3); return '';
    case 'source:listen': return followUp(p);
    case 'source:pass': return '';
    case 'editor:welcome': { if (o && ed) { ed.flags.retired = year(); ed.occupation = 'Retired editor'; const n = makeNpc({ role: 'colleague', countryId: o.countryId, age: 45 }); n.occupation = 'Editor'; n.flags.title = `Your editor at ${o.name}`; n.flags.newsroom = { outletId: o.id, role: 'Editor' }; store.state.npcs[n.id] = n; o.editorId = n.id; meet(n, `Your editor at ${o.name}`, p); o.history.push({ year: year(), text: `${nameOf(ed)} retired as editor; ${nameOf(n)} took over.` }); } return ''; }
    case 'anchor:try': return anchorAudition().text;
    case 'anchor:no': return '';
    case 'retire:yes': return leaveSpecial().text;
    case 'spark:ask': { const n = npc(j.sceneCast?.npcId); return n ? askOut(n.id).text : ''; }
    case 'spark:friends': rel(senior, 6); return '';
    case 'byline:frame': p.stats.mood = clamp(p.stats.mood + 6); return '';
    case 'byline:work': grow('reporting', 1); return '';
    case 'disagree:dig': grow('verification', 3); return '';
    case 'disagree:pick': return 'A disputed claim stays disputed, whoever sounds surer.';
    case 'nocomment:note': j.rep.trust = clamp(j.rep.trust + 1); return '';
    case 'nocomment:chase': grow('interviewing', 1); return '';
    case 'headline:straight': j.rep.trust = clamp(j.rep.trust + 2); return '';
    case 'headline:punchy': j.rep.recognition = clamp(j.rep.recognition + 2); j.rep.trust = clamp(j.rep.trust - 2); return '';
    case 'correction:own': j.rep.accuracy = clamp(j.rep.accuracy + 2); rel(ed, 3); return '';
    case 'correction:quiet': j.rep.trust = clamp(j.rep.trust - 2); return '';
    case 'editorjob:go': rel(senior, -3); j.applyEditor = year(); return '';
    case 'editorjob:back': rel(senior, 8); return '';
    case 'divided:speak': rel(ed, -2); j.rep.trust = clamp(j.rep.trust + 2); return '';
    case 'divided:out': return '';
    case 'mentor:yes': {
      const n = makeNpc({ role: 'colleague', countryId: p.countryId, age: 23, relationship: 60 });
      n.occupation = 'Junior reporter'; n.flags.title = `A junior reporter you mentor at ${o.name}`; n.flags.newsroom = { outletId: o.id, role: 'Junior reporter' };
      store.state.npcs[n.id] = n; meet(n, n.flags.title, p); (o.staff ??= []).push({ npcId: n.id, role: 'reporter', since: year() });
      j.history.push({ year: year(), text: `Began mentoring ${nameOf(n)}.` });
      return `${nameOf(n)} is now someone you know.`;
    }
    case 'mentor:no': return '';
    case 'live:steady': grow('broadcast', 2); return '';
    case 'live:shaky': grow('broadcast', 1); return '';
    case 'breaking:confirmed': j.rep.trust = clamp(j.rep.trust + 3); return '';
    case 'breaking:guess': j.rep.recognition = clamp(j.rep.recognition + 2); j.rep.trust = clamp(j.rep.trust - 5); return '';
    case 'national:take': j.anchor.national = year(); j.rep.recognition = clamp(j.rep.recognition + 8); j.history.push({ year: year(), text: 'Began anchoring a national broadcast.' }); milestone('Began anchoring a national news broadcast.', 'career'); return '';
    case 'national:stay': rel(ed, 6); j.anchor.national = -1; return '';
    case 'investor:take':
    case 'investor:take_push': {
      const own = ownedOutlet(p);
      const off = investorOffer(p);
      if (!own || !off) return '';
      const push = value === 'investor:take_push';
      const amount = push ? Math.round(off.amount * 1.4) : off.amount;
      p.finance.cash += amount;
      own.investor = { since: year(), share: push ? 0.35 : off.share, pushy: push, amount };
      own.history.push({ year: year(), text: `Took ${fmtMoney(amount, country())} from an investor for ${Math.round(own.investor.share * 100)}% of its profits.` });
      return `${fmtMoney(amount, country())} arrives. ${Math.round(own.investor.share * 100)}% of every profit now goes to them${push ? ', and they want sharper headlines' : ''}.`;
    }
    case 'investor:no': { const own = ownedOutlet(p); if (own) own.history.push({ year: year(), text: 'Turned down an investor.' }); return ''; }
    case 'hire:welcome': { const own = ownedOutlet(p); rel(npc(own?.staff[0]?.npcId), 8); return ''; }
    case 'hire:brief': return '';
    case 'expand:celebrate': p.stats.mood = clamp(p.stats.mood + 6); return '';
    case 'expand:careful': return '';
    case 'first:ask': rel(ed, 5); grow('reporting', 2); return '';
    case 'first:alone': grow('reporting', 1); return '';
    case 'refused:respect': j.rep.trust = clamp(j.rep.trust + 2); return '';
    case 'refused:press': j.rep.trust = clamp(j.rep.trust - 4); return '';
    case 'tip:take': { const r = seeded(`${p.id}/tip/${year()}`); const s = investigativeStory(p, o, r, { countryId: p.countryId, city: p.city }); return s ? `"${s.title}" is in your assignments. It may not stand up; most tips do not.` : ''; }
    case 'tip:pass': return '';
    case 'award:thank': rel(ed, 6); p.stats.mood = clamp(p.stats.mood + 6); return '';
    case 'award:quiet': p.stats.mood = clamp(p.stats.mood + 4); return '';
    case 'deadline:push': grow('writing', 1); p.stats.mood = clamp(p.stats.mood - 3); return '';
    case 'deadline:ask': rel(ed, 2); { const s = myStories(p).find((x) => open(x, p) && x.deadline && x.deadline - now() <= 3); if (s) s.deadline += 3; } return 'Your editor gives you three more months.';
    case 'viral:enjoy': j.rep.recognition = clamp(j.rep.recognition + 4); return '';
    case 'viral:back': j.rep.trust = clamp(j.rep.trust + 2); return '';
    case 'retire:no': return '';
    default: return '';
  }
}
/** A source from an old story comes back with something new: a story with them in it again. */
function followUp(p) {
  const j = J(p);
  const id = j.sceneCast?.npcId;
  const n = npc(id);
  if (!n || !isReporter(p)) return '';
  const o = outlet(j.outletId);
  const r = seeded(`${p.id}/followup/${year()}`);
  const s = newStory(p, o, 'local', `What happened next: ${n.firstName} ${n.lastName}'s story, years on`, { subject: nameOf(n) });
  const c1 = addClaim(s, { text: `${nameOf(n)} has started something new in ${p.city}`, truth: true, important: true });
  const c2 = addClaim(s, { text: 'It has grown since the first story', truth: r.chance(0.6) });
  addSource(s, { npcId: n.id, name: nameOf(n), role: 'A source from an old story', type: 'community', willing: 0.95, knows: [{ claimId: c1.id, says: true }, { claimId: c2.id, says: true }] });
  addDoc(s, { title: 'The public business register', settles: [{ claimId: c1.id }, { claimId: c2.id }] });
  return `${n.firstName} remembers how you treated their story. A new one is in your assignments.`;
}

// ---------- Freelance ----------
//
// A freelancer finds stories, reports them, and sells them: a newsroom commissions a piece (or does not), and pays
// its fee once, when it runs. No steady salary; nothing is paid twice for the same work.

export function freelanceWhy(p = player()) {
  const j = J(p);
  if (p.age < 18) return 'From 18.';
  if (isReporter(p)) return 'You have a newsroom job. Leave journalism first to go freelance.';
  if (j.freelance) return 'You are freelance already.';
  const sc = whySpecial('journalism', p);
  if (sc) return sc;
  if (!myPubs(p).length && !j.intern && j.school.articles < 3 && !p.education.degrees.some((d) => RELEVANT.includes(d.majorId))) return 'Editors buy from people with clips: published work, an internship, or a relevant degree.';
  return '';
}
export function goFreelance() {
  const p = player();
  const why = freelanceWhy(p);
  if (why) return result(false, why, 'neutral');
  { const sc = claimSpecial('journalism', p); if (sc) return result(false, sc, 'neutral'); }
  const j = J(p);
  j.freelance = { since: year() };
  j.history.push({ year: year(), text: 'Went freelance.' });
  j.assigned = null;
  assignYear(p);
  return result(true, 'You go freelance: find a story, report it, then sell it. Nobody pays you to wait.', 'neutral');
}
/** What a newsroom pays a freelancer for a piece (local money). */
export const feeFor = (o, s) => Math.round(localWage((s.beat === 'investigative' ? 2400 : 450) * OUTLET_KINDS[o.kind].pay * (0.8 + o.reputation / 250), country()));
/** Pitches a freelance story to a newsroom, once per newsroom. They commission it at a fee, or pass. */
export function pitch(storyId, outletId) {
  const p = player();
  const s = story(storyId);
  const o = outlet(outletId);
  if (!J(p).freelance || !open(s, p)) return result(false, 'That is not a freelance story you are working on.', 'neutral');
  if (s.outletId) return result(false, `${outlet(s.outletId)?.name} has it already.`, 'neutral');
  if (!o || o.ownerId) return result(false, 'There is no such newsroom.', 'neutral');
  s.pitched ??= {};
  if (s.pitched[o.id]) return result(false, 'You pitched it to them already.', 'neutral');
  if (!spend(1, p)) return result(false, 'You are out of time this year.', 'neutral');
  s.pitched[o.id] = year();
  const j = J(p);
  const work = s.evidence.length;
  const r = seeded(`${s.id}/pitch/${o.id}`);
  const odds = clamp(0.2 + work * 0.05 + j.rep.accuracy / 300 + j.rep.recognition / 250 - (o.reputation - 55) / 200, 0.05, 0.85);
  if (!r.chance(odds)) return result(false, `${o.name} passes. ${work < 3 ? 'Report it further and it may sell.' : 'Try another newsroom.'}`, 'neutral');
  s.outletId = o.id; s.editorId = o.editorId; s.fee = feeFor(o, s);
  meet(npc(o.editorId), `An editor at ${o.name} who buys your work`, p);
  return result(true, `${o.name} commissions it: ${fmtMoney(s.fee, country())} when it runs, edited by ${nameOf(npc(o.editorId))}.`);
}

// ---------- A publication of one's own ----------
//
// A newsletter, a podcast, a news website (from the digital era) or a local paper (any era), started with the
// player's own money. The player edits it by the policy they set, can hire real staff (an editor raises the bar a
// reporter's work brings in readers), and its money is counted once a year: readers bring revenue, staff and
// running costs take it. Many lose money. Owning one is not the same as working for one.

/** What it costs to start one, in local money of the time. */
export const startCost = (kind) => Math.round(localWage(OWN_KINDS[kind].cost, country()));
export function startWhy(kind, p = player()) {
  const k = OWN_KINDS[kind];
  if (!k) return 'No such kind.';
  if (p.age < 21) return 'From 21.';
  if (ownedOutlet(p)) return 'You run a publication already.';
  if (isReporter(p)) return 'Leave your newsroom first: running your own is a job in itself.';
  if (k.needs && !exists(k.needs)) return `Not in ${year()}: there is no way to publish it yet.`;
  if (year() < k.from) return `Not in ${year()}.`;
  const sc = whySpecial('journalism', p);
  if (sc) return sc;
  const cost = Math.round(localWage(k.cost, country()));
  if (p.finance.cash < cost) return `It costs ${fmtMoney(cost, country())} to start.`;
  return '';
}
export function startPublication(kind, name, policy = 'careful') {
  const p = player();
  const why = startWhy(kind, p);
  if (why) return result(false, why, 'neutral');
  { const sc = claimSpecial('journalism', p); if (sc) return result(false, sc, 'neutral'); }
  const k = OWN_KINDS[kind];
  const cost = Math.round(localWage(k.cost, country()));
  p.finance.cash -= cost;
  const r = seeded(`${p.id}/own/${year()}`);
  const id = nextId('outlet');
  const title = (name ?? '').trim().slice(0, 40) || `The ${p.city} ${kind === 'podcast' ? 'Report' : kind === 'newsletter' ? 'Letter' : 'News'}`;
  const o = { id, kind: `own_${kind}`, ownKind: kind, name: title, medium: k.medium, countryId: p.countryId, city: p.city, founded: year(), ownerId: p.id, editorId: null, seniorId: null,
    standards: policy === 'careful' ? 0.75 : 0.55, policy, reputation: 40, audience: Math.round(k.start * (0.8 + r.next() * 0.4)), staff: [], finances: [], history: [{ year: year(), text: `Founded by ${p.firstName} ${p.lastName}.` }] };
  S().outlets[id] = o;
  const j = J(p);
  j.owned = id;
  j.history.push({ year: year(), text: `Founded ${title} (${k.name.toLowerCase()}).` });
  milestone(`Founded ${title}, a ${k.name.toLowerCase()} of your own.`, 'career');
  j.assigned = null;
  assignYear(p);
  return result(true, `${title} is launched, for ${fmtMoney(cost, country())}: about ${o.audience.toLocaleString('en-US')} ${k.medium === 'audio' ? 'listeners' : 'readers'} to begin with. You edit it yourself, ${policy === 'careful' ? 'carefully' : 'by ordinary standards'}.`);
}
/** Hires a real person onto the publication: a reporter brings in stories, an editor raises the bar. */
export function hireStaff(role) {
  const p = player();
  const o = ownedOutlet(p);
  if (!o) return result(false, 'You do not run a publication.', 'neutral');
  if (!STAFF_PAY[role]) return result(false, 'No such role.', 'neutral');
  if (role === 'editor' && o.staff.some((x) => x.role === 'editor')) return result(false, 'You have an editor.', 'neutral');
  if (o.staff.length >= 6) return result(false, 'That is as big as it can grow for now.', 'neutral');
  const n = makeNpc({ role: 'colleague', countryId: p.countryId, age: role === 'editor' ? 44 : 27, relationship: 55 });
  n.occupation = role === 'editor' ? 'Editor' : 'Reporter';
  n.flags.title = `${role === 'editor' ? 'Editor' : 'Reporter'} at ${o.name}, which you own`;
  n.flags.newsroom = { outletId: o.id, role };
  store.state.npcs[n.id] = n;
  meet(n, n.flags.title, p);
  const salary = Math.round(localWage(STAFF_PAY[role], country()));
  o.staff.push({ npcId: n.id, role, salary, since: year() });
  if (role === 'editor') { o.editorId = n.id; o.standards = Math.min(0.9, o.standards + 0.1); }
  o.history.push({ year: year(), text: `Hired ${nameOf(n)} as ${role}.` });
  return result(true, `${nameOf(n)} joins ${o.name} as ${role === 'editor' ? 'its editor' : 'a reporter'}, on ${fmtMoney(salary, country())} a year.`);
}
export function letGo(npcId) {
  const o = ownedOutlet();
  const x = o?.staff.find((y) => y.npcId === npcId);
  if (!x) return result(false, 'They do not work for you.', 'neutral');
  o.staff = o.staff.filter((y) => y !== x);
  if (o.editorId === npcId) { o.editorId = null; o.standards = Math.max(0.5, o.standards - 0.1); }
  const n = npc(npcId);
  if (n) { n.meters.relationship = clamp(n.meters.relationship - 15); n.flags.title = `Used to work at ${o.name}`; }
  o.history.push({ year: year(), text: `${nameOf(n)} left.` });
  return result(true, `${nameOf(n)} clears their desk.`, 'neutral');
}
/** A publication's year: readers bring revenue, staff and running costs take it. Many lose money. */
function ownedYear(o, p) {
  const lived = year() - 1;
  if (o.finances.some((f) => f.year === lived) || o.founded > lived) return [];
  const k = OWN_KINDS[o.ownKind];
  const c = country();
  const pubs = myPubs(p).filter((x) => x.outletId === o.id && x.year === lived);
  const r = seeded(`${o.id}/year/${lived}`);
  const reporters = o.staff.filter((x) => x.role === 'reporter').length;
  const good = pubs.filter((x) => !x.errors.length).reduce((n, x) => n + x.quality, 0);
  const bad = pubs.filter((x) => x.errors.length && !x.corrections.length).length;
  // Readers come for the work, and drift away without it.
  const research = o.research ?? 0;
  const bureaus = (o.bureaus ?? []).length;
  const pushy = o.investor?.pushy ? 0.04 : 0; // sensational coverage: readers now, trust later
  const growth = 1 + good / 2500 + reporters * 0.06 + (o.editorId ? 0.03 : 0) + research * 0.025 + bureaus * 0.05 + pushy - bad * 0.08 - 0.1 + (r.next() - 0.5) * 0.1;
  o.audience = Math.max(30, Math.round(o.audience * growth + good * 3));
  const revenue = Math.round(localWage(k.perReader * o.audience, c));
  const costs = Math.round(localWage(k.upkeep * (1 + research * 0.35 + bureaus * 0.4), c)) + o.staff.reduce((n, x) => n + x.salary, 0);
  let net = revenue - costs;
  if (o.investor && net > 0) { const cut = Math.round(net * o.investor.share); net -= cut; o.investor.paid = (o.investor.paid ?? 0) + cut; }
  if (pushy) o.reputation = Math.round(clamp(o.reputation - 4));
  o.reputation = Math.round(clamp(o.reputation + research));
  p.finance.cash += net;
  if (net > 0) p.finance.lifetimeEarned = (p.finance.lifetimeEarned ?? 0) + net;
  o.reputation = Math.round(clamp(o.reputation + good / 200 - bad * 5));
  o.finances.push({ year: lived, revenue, costs, net, audience: o.audience });
  return [`${o.name}'s year: ${fmtMoney(revenue, c)} in, ${fmtMoney(costs, c)} out: ${net >= 0 ? `${fmtMoney(net, c)} made` : `${fmtMoney(-net, c)} lost`}. ${o.audience.toLocaleString('en-US')} ${o.medium === 'audio' ? 'listeners' : 'readers'}.`];
}
/** Closes the publication. What it published stays published. */
export function closePublication() {
  const p = player();
  const o = ownedOutlet(p);
  if (!o) return result(false, 'You do not run a publication.', 'neutral');
  for (const x of o.staff) { const n = npc(x.npcId); if (n) n.flags.title = `Used to work at ${o.name}`; }
  o.staff = [];
  o.closed = year();
  o.history.push({ year: year(), text: 'Closed.' });
  J(p).owned = (J(p).sisters ?? []).shift() ?? null;
  J(p).history.push({ year: year(), text: `Closed ${o.name}.` });
  return result(true, `${o.name} publishes its last edition. The archive stays up.`, 'neutral');
}
/** Sells the publication: a buyer pays for its readers and its record. Their staff go with it. */
export function sellPublication() {
  const p = player();
  const o = ownedOutlet(p);
  if (!o) return result(false, 'You do not run a publication.', 'neutral');
  const last = o.finances.at(-1);
  const price = Math.max(0, Math.round((last?.revenue ?? 0) * 1.5 + localWage(OWN_KINDS[o.ownKind].perReader * o.audience * 0.5, country()) + (last?.net ?? 0)));
  if (price <= 0) return result(false, 'Nobody wants to buy it as it is.', 'neutral');
  p.finance.cash += price;
  o.ownerId = null;
  o.soldTo = 'a buyer';
  o.sold = year();
  o.history.push({ year: year(), text: `Sold for ${fmtMoney(price, country())}.` });
  J(p).owned = (J(p).sisters ?? []).shift() ?? null;
  J(p).history.push({ year: year(), text: `Sold ${o.name}.` });
  return result(true, `You sell ${o.name} for ${fmtMoney(price, country())}. It carries on under its new owner.`);
}

// ---------- More beats: education, environment, technology, arts, data ----------

const person = (w, r, job, age = [28, 62]) => { const n = makeNpc({ role: 'acquaintance', countryId: w.countryId, age: r.int(age[0], age[1]) }); n.occupation = job; store.state.npcs[n.id] = n; return n; };
const employersOf = (w, families) => cityEmployers(w.countryId, w.city).filter((x) => families.includes(x.family));

/** An education story: a real school in the city (or a college that employs people there), its published inspection. */
function educationStory(p, o, r, w = { countryId: p.countryId, city: p.city }) {
  const schools = Object.values(store.state.schools ?? {}).filter((x) => x.countryId === w.countryId && x.city === w.city && x.kind !== 'home');
  const sc = schools.length ? r.pick(schools) : employersOf(w, ['education'])[0];
  if (!sc) return null;
  const name = sc.name;
  const better = r.chance(0.55);
  const s = newStory(p, o, 'education', better ? `Results improve at ${name}` : `${name} under pressure`, { subject: name, links: sc.stage ? { schoolId: sc.id } : { employerId: sc.id }, needsComment: !better });
  const c1 = addClaim(s, { text: `${name} was inspected this year`, truth: true, important: true });
  const c2 = addClaim(s, { text: better ? 'Its results rose this year' : 'Its results fell this year', truth: r.chance(0.7) });
  const c3 = addClaim(s, { text: 'Classes are bigger than they were', truth: r.chance(0.5) });
  const c4 = addClaim(s, { text: 'Parents are happy with the school', kind: 'opinion', truth: true });
  addDoc(s, { title: `The published inspection of ${name}`, settles: [{ claimId: c1.id }, { claimId: c2.id }] });
  addDoc(s, { title: 'Pupils\' records', public: false, why: 'Children\'s school records are private. The inspection reports on the school, not the pupils.' });
  const head = person(w, r, `Head of ${name}`, [40, 62]);
  const teacher = person(w, r, `Teacher at ${name}`, [24, 60]);
  const parent = person(w, r, `Parent at ${name}`, [30, 50]);
  const t2 = s.claims[1].truth; const t3 = s.claims[2].truth;
  addSource(s, { npcId: head.id, name: nameOf(head), role: 'The head of the school', type: 'official', willing: 0.7, knows: [{ claimId: c1.id, says: true }, { claimId: c2.id, says: better }, { claimId: c3.id, says: false }] });
  addSource(s, { npcId: teacher.id, name: nameOf(teacher), role: 'A teacher', type: 'citizen', willing: 0.5, wantsConfidential: true, knows: [{ claimId: c3.id, says: t3 }, { claimId: c2.id, says: r.chance(0.8) ? t2 : !t2 }] });
  addSource(s, { npcId: parent.id, name: nameOf(parent), role: 'A parent', type: 'community', willing: 0.8, knows: [{ claimId: c4.id, says: true }, { claimId: c3.id, says: r.chance(0.7) ? t3 : !t3 }] });
  return s;
}

/** An environment story: a real employer in the city and the public monitoring of the river or air nearby. */
function environmentStory(p, o, r, w = { countryId: p.countryId, city: p.city }) {
  const list = employersOf(w, ['trades', 'transport', 'land', 'science']);
  const e = list.length ? r.pick(list) : null;
  if (!e) return null;
  const what = r.pick(['the river', 'the air near the site', 'the groundwater']);
  const s = newStory(p, o, 'environment', `What is in ${what}? Questions near ${e.name}`, { subject: e.name, links: { employerId: e.id }, needsComment: true });
  const c1 = addClaim(s, { text: `Monitoring of ${what} near ${e.name} was published this year`, truth: true, important: true });
  const c2 = addClaim(s, { text: `Readings near ${e.name} were above the permitted limit`, truth: r.chance(0.4) });
  const c3 = addClaim(s, { text: `${e.name} is to blame for it`, kind: 'allegation', truth: s.claims[1].truth && r.chance(0.5) });
  const c4 = addClaim(s, { text: 'People nearby are worried', kind: 'opinion', truth: true });
  addDoc(s, { title: 'The environment agency\'s published monitoring', settles: [{ claimId: c1.id }, { claimId: c2.id }] });
  addDoc(s, { title: `${e.name}'s internal emails`, public: false, why: 'A company\'s private correspondence is not available. Its permits and the monitoring are.' });
  const sci = person(w, r, 'Environmental scientist', [30, 64]);
  const resident = person(w, r, `Lives near ${e.name}`, [25, 80]);
  const t2 = s.claims[1].truth; const t3 = s.claims[2].truth;
  addSource(s, { institution: true, name: e.name, role: 'The company\'s press office', type: 'company', willing: 0.5, knows: [{ claimId: c2.id, says: false }, { claimId: c3.id, says: false }] });
  addSource(s, { npcId: sci.id, name: nameOf(sci), role: 'An independent environmental scientist', type: 'expert', willing: 0.75, knows: [{ claimId: c2.id, says: r.chance(0.85) ? t2 : !t2 }, { claimId: c3.id, says: r.chance(0.6) ? t3 : !t3 }] });
  addSource(s, { npcId: resident.id, name: nameOf(resident), role: 'A neighbor of the site', type: 'community', willing: 0.85, knows: [{ claimId: c4.id, says: true }, { claimId: c3.id, says: true }] });
  return s;
}

/** A technology story: a real tech company in the city, a product launch, and what users say. Never users' data. */
function technologyStory(p, o, r, w = { countryId: p.countryId, city: p.city }) {
  if (!exists('digital')) return null;
  const list = employersOf(w, ['tech']);
  const e = list.length ? r.pick(list) : null;
  if (!e) return null;
  const thing = r.pick(['app', 'payment service', 'booking system', 'learning platform']);
  const s = newStory(p, o, 'technology', `${e.name} launches a new ${thing}`, { subject: e.name, links: { employerId: e.id }, needsComment: true });
  const users = r.int(5, 90) * 1000;
  const inflated = r.chance(0.45);
  const c1 = addClaim(s, { text: `${e.name} launched its ${thing} this year`, truth: true, important: true });
  const c2 = addClaim(s, { text: `It has ${(inflated ? users * 3 : users).toLocaleString('en-US')} users`, truth: !inflated });
  const c3 = addClaim(s, { text: `The ${thing} leaked users' details`, kind: 'allegation', truth: r.chance(0.2) });
  const c4 = addClaim(s, { text: 'Users like it', kind: 'opinion', truth: true });
  addDoc(s, { title: `${e.name}'s published company filing`, settles: [{ claimId: c1.id }] });
  addDoc(s, { title: 'The data regulator\'s public register of reported breaches', settles: [{ claimId: c3.id }] });
  addDoc(s, { title: 'The users\' accounts', public: false, why: 'People\'s accounts and data are private. No story needs them.' });
  const eng = person(w, r, `Engineer at ${e.name}`, [23, 50]);
  const user = person(w, r, `Uses the ${thing}`, [18, 70]);
  addSource(s, { institution: true, name: e.name, role: 'The company\'s press office', type: 'company', willing: 0.7, knows: [{ claimId: c1.id, says: true }, { claimId: c2.id, says: true }, { claimId: c3.id, says: false }] });
  addSource(s, { npcId: eng.id, name: nameOf(eng), role: 'An engineer at the company', type: 'citizen', willing: 0.45, wantsConfidential: true, knows: [{ claimId: c2.id, says: !inflated }, { claimId: c3.id, says: s.claims[2].truth }] });
  addSource(s, { npcId: user.id, name: nameOf(user), role: 'Someone who uses it', type: 'community', willing: 0.85, knows: [{ claimId: c4.id, says: true }, { claimId: c1.id, says: true }] });
  return s;
}

/** An arts story: a real theater, orchestra or studio in the city opens its season. What critics think is opinion. */
function artsStory(p, o, r, w = { countryId: p.countryId, city: p.city }) {
  const list = employersOf(w, ['arts']);
  const e = list.length ? r.pick(list) : null;
  if (!e) return null;
  const work = r.pick(['a new play', 'a season of new music', 'a revival of an old favorite', 'an exhibition of local artists']);
  const s = newStory(p, o, 'arts', `${e.name} opens ${work}`, { subject: e.name, links: { employerId: e.id } });
  const sold = r.chance(0.5);
  const c1 = addClaim(s, { text: `${e.name} opened ${work} this year`, truth: true, important: true });
  const c2 = addClaim(s, { text: 'The opening night sold out', truth: sold });
  const c3 = addClaim(s, { text: `${e.name} lost its public funding`, truth: r.chance(0.3) });
  const c4 = addClaim(s, { text: 'It is the best thing in the city this year', kind: 'opinion', truth: true });
  addDoc(s, { title: `${e.name}'s published season program`, settles: [{ claimId: c1.id }] });
  addDoc(s, { title: 'The arts council\'s published grants', settles: [{ claimId: c3.id }] });
  addDoc(s, { title: 'The performers\' contracts', public: false, why: 'What performers are paid under contract is private. Public grants are not.' });
  const dir = person(w, r, `Director at ${e.name}`, [32, 70]);
  const critic = person(w, r, 'Critic', [28, 70]);
  const t3 = s.claims[2].truth;
  addSource(s, { npcId: dir.id, name: nameOf(dir), role: 'The director', type: 'official', willing: 0.85, knows: [{ claimId: c1.id, says: true }, { claimId: c2.id, says: true }, { claimId: c3.id, says: t3 }] });
  addSource(s, { npcId: critic.id, name: nameOf(critic), role: 'A critic who was there', type: 'expert', willing: 0.8, knows: [{ claimId: c4.id, says: r.chance(0.6) }, { claimId: c2.id, says: sold }] });
  addSource(s, { institution: true, name: `${e.name} box office`, role: 'The box office', type: 'company', willing: 0.6, knows: [{ claimId: c2.id, says: sold }] });
  return s;
}

/** A data story: the country's real economy this year (engine/economy.js), from the published statistics. */
function dataStory(p, o, r, w = { countryId: p.countryId, city: p.city }) {
  if (year() < 1950) return null;
  const ph = store.state.world?.places?.[w.countryId]?.phase ?? 'steady';
  const cn = COUNTRIES[w.countryId]?.name ?? 'the country';
  const s = newStory(p, o, 'data', `What the figures say about ${cn} this year`, { subject: `${cn}'s statistics office`, links: { phase: ph } });
  const c1 = addClaim(s, { text: 'Unemployment rose this year', truth: ph === 'slump', important: true });
  const c2 = addClaim(s, { text: 'House prices rose this year', truth: ph === 'boom' });
  const c3 = addClaim(s, { text: `${w.city} is doing worse than the rest of ${cn}`, truth: r.chance(0.4) });
  const c4 = addClaim(s, { text: 'The government\'s policies are working', kind: 'opinion', truth: true });
  addDoc(s, { title: `${cn}'s published labor and housing figures`, settles: [{ claimId: c1.id }, { claimId: c2.id }] });
  addDoc(s, { title: 'The figures broken down by city', settles: [{ claimId: c3.id }], cost: 2 });
  addDoc(s, { title: 'Individual tax returns', public: false, why: 'Nobody\'s tax return is a statistic. The published figures are.' });
  const eco = person(w, r, 'Economist', [32, 66]);
  addSource(s, { npcId: eco.id, name: nameOf(eco), role: 'An economist', type: 'expert', willing: 0.8, knows: [{ claimId: c1.id, says: ph === 'slump' }, { claimId: c3.id, says: r.chance(0.7) ? s.claims[2].truth : !s.claims[2].truth }] });
  addSource(s, { institution: true, name: 'The government', role: 'A government spokesperson', type: 'official', willing: 0.7, knows: [{ claimId: c1.id, says: false }, { claimId: c4.id, says: true }, { claimId: c2.id, says: ph !== 'slump' }] });
  return s;
}

// ---------- More beats: business, science, K-pop ----------

/** A business story: a real employer's public filings, a spokesperson, an analyst. Never its bank accounts. */
function businessStory(p, o, r, w = { countryId: p.countryId, city: p.city }) {
  const list = cityEmployers(w.countryId, w.city).filter((x) => x.family !== 'media');
  const e = list.length ? r.pick(list) : null;
  if (!e) return null;
  const growing = r.chance(0.55);
  const s = newStory(p, o, 'business', growing ? `${e.name} expands in ${w.city}` : `Hard times at ${e.name}`, { subject: e.name, links: { employerId: e.id }, needsComment: true });
  const n = r.int(12, 140);
  const c1 = addClaim(s, { text: growing ? `${e.name} is taking on ${n} more staff` : `${e.name} is cutting ${n} jobs`, truth: r.chance(0.75), important: true });
  const c2 = addClaim(s, { text: `${e.name}'s sales ${growing ? 'rose' : 'fell'} last year`, truth: r.chance(0.7) });
  const c3 = addClaim(s, { text: `${e.name} is in financial trouble`, kind: 'allegation', truth: !growing && r.chance(0.35) });
  addDoc(s, { title: `${e.name}'s published annual filing`, settles: [{ claimId: c2.id }] });
  addDoc(s, { title: `${e.name}'s bank accounts`, public: false, why: 'A company\'s bank accounts are private. Its published filings are not.' });
  const an = makeNpc({ role: 'acquaintance', countryId: w.countryId, age: r.int(30, 60) });
  an.occupation = 'Business analyst';
  store.state.npcs[an.id] = an;
  const worker = makeNpc({ role: 'acquaintance', countryId: w.countryId, age: r.int(22, 60) });
  worker.occupation = `Works at ${e.name}`;
  store.state.npcs[worker.id] = worker;
  const c1t = s.claims[0].truth; const c3t = s.claims[2].truth;
  addSource(s, { institution: true, name: e.name, role: 'The company\'s press office', type: 'company', willing: 0.55, knows: [{ claimId: c1.id, says: true }, { claimId: c3.id, says: false }] });
  addSource(s, { npcId: an.id, name: nameOf(an), role: 'An analyst who follows the sector', type: 'expert', willing: 0.75, knows: [{ claimId: c2.id, says: s.claims[1].truth }, { claimId: c3.id, says: r.chance(0.7) ? c3t : !c3t }] });
  addSource(s, { npcId: worker.id, name: nameOf(worker), role: 'An employee', type: 'citizen', willing: 0.5, wantsConfidential: true, knows: [{ claimId: c1.id, says: r.chance(0.8) ? c1t : !c1t }] });
  return s;
}

/** A science story: a study at a real hospital, its researcher and an independent expert. One study proves little. */
function scienceStory(p, o, r, w = { countryId: p.countryId, city: p.city }) {
  const topics = [['a new exercise program', 'back pain'], ['a sleep routine', 'memory in older adults'], ['a reading program', 'children\'s attention'], ['a change in diet', 'blood pressure']];
  const [what, helps] = r.pick(topics);
  const inst = `${w.city} University Hospital`;
  const s = newStory(p, o, 'science', `A study on ${what} and ${helps}`, { subject: inst });
  const size = r.int(40, 400);
  const c1 = addClaim(s, { text: `Researchers at ${inst} published a study this year`, truth: true, important: true });
  const c2 = addClaim(s, { text: `The study followed ${size} people`, truth: true });
  const c3 = addClaim(s, { text: `${what.replace(/^./, (c) => c.toUpperCase())} helps with ${helps}`, kind: 'allegation', truth: r.chance(0.5) });
  addDoc(s, { title: 'The published study', settles: [{ claimId: c1.id }, { claimId: c2.id }] });
  addDoc(s, { title: 'The patients\' medical records', public: false, why: 'Patients\' records are private. The study reports its results without them.' });
  const lead = makeNpc({ role: 'acquaintance', countryId: w.countryId, age: r.int(35, 62) });
  lead.occupation = `Researcher at ${inst}`;
  store.state.npcs[lead.id] = lead;
  const ext = makeNpc({ role: 'acquaintance', countryId: w.countryId, age: r.int(35, 68) });
  ext.occupation = 'Independent researcher';
  store.state.npcs[ext.id] = ext;
  const c3t = s.claims[2].truth;
  addSource(s, { npcId: lead.id, name: nameOf(lead), role: 'The study\'s lead researcher', type: 'scientist', willing: 0.8, knows: [{ claimId: c1.id, says: true }, { claimId: c2.id, says: true }, { claimId: c3.id, says: true }] });
  addSource(s, { npcId: ext.id, name: nameOf(ext), role: 'An independent researcher not involved in the study', type: 'expert', willing: 0.65, knows: [{ claimId: c3.id, says: r.chance(0.75) ? c3t : !c3t }] });
  return s;
}

/** A K-pop story, from a group's real release (engine/kpop): official positions as the agency lists them, rumors kept as rumors. */
function kpopStory(p, o, r, w = { countryId: p.countryId, city: p.city }) {
  const K = store.state.kpop;
  if (!K) return null;
  const rels = Object.values(K.releases ?? {}).filter((x) => x.year >= year() - 1 && !x.solo && K.groups[x.groupId]?.debut && !Object.values(S().stories).some((s) => s.links.kpopRelease === x.id && s.reporterId === p.id));
  const rel = rels.length ? r.pick(rels) : null;
  if (!rel) return null;
  const g = K.groups[rel.groupId];
  const s = newStory(p, o, 'kpop', `${g.name} return with "${rel.title}"`, { subject: g.name, links: { kpopRelease: rel.id, groupId: g.id } });
  const won = (rel.wins ?? []).length > 0;
  const c1 = addClaim(s, { text: `${g.name} released "${rel.title}" in ${rel.year}`, truth: true, important: true });
  const c2 = addClaim(s, { text: `"${rel.title}" won on a music show`, truth: won });
  const members = g.members.filter((m) => m.to == null).map((m) => m.who).filter((id) => id !== 'player' && npc(id)?.alive);
  const lead = members.find((id) => (g.positions?.[id] ?? []).length) ?? members[0];
  const labels = (g.positions?.[lead] ?? []);
  const c3 = lead && labels.length ? addClaim(s, { text: `${nameOf(npc(lead))} is the group's ${labels.map((x) => x.replace(/_/g, ' ')).join(' and ')}`, truth: true }) : null;
  const rumor = lead ? addClaim(s, { text: `${npc(lead)?.firstName} is secretly dating someone`, kind: 'allegation', truth: false }) : null;
  addDoc(s, { title: `The agency's release announcement and official profile`, settles: [{ claimId: c1.id }, ...(c3 ? [{ claimId: c3.id }] : [])] });
  addDoc(s, { title: 'The music show results', settles: [{ claimId: c2.id }] });
  for (const id of members.slice(0, 2)) addSource(s, { npcId: id, name: nameOf(npc(id)), role: `Of ${g.name}`, type: 'entertainer', willing: 0.45, knows: [{ claimId: c1.id, says: true }, ...(c3 ? [{ claimId: c3.id, says: true }] : []), ...(rumor ? [{ claimId: rumor.id, says: false }] : [])] });
  addSource(s, { institution: true, name: 'The agency', role: 'Press office', type: 'company', willing: 0.4, knows: [{ claimId: c1.id, says: true }, { claimId: c2.id, says: won }] });
  addSource(s, { institution: true, name: 'Fan accounts online', role: 'Unverified posts', type: 'citizen', willing: 0.95, knows: rumor ? [{ claimId: rumor.id, says: true }] : [] });
  return s;
}

// ---------- Foreign correspondence ----------
//
// A senior reporter at a newsroom with reach (a regional daily, a television or radio newsroom, a digital newsroom)
// can be posted abroad for three years. The newsroom arranges the journalist's visa; the reporter covers that
// country's politics, business, science and everyday life (not, by default, danger) and comes home after.

const POSTING_KINDS = ['regional', 'tv', 'radio', 'digital'];
export function postingWhy(countryId, p = player()) {
  const j = J(p);
  const o = outlet(j.outletId);
  if (!isReporter(p)) return 'Foreign postings are for staff reporters.';
  if ((p.career.level ?? 0) < 2) return 'Foreign postings go to senior reporters.';
  if (!POSTING_KINDS.includes(o?.kind)) return 'Your newsroom has no foreign desk.';
  if (j.posting) return 'You are posted abroad already.';
  if (!COUNTRIES[countryId] || countryId === p.countryId) return 'Choose another country.';
  if (j.postingAsked === year()) return 'You asked this year.';
  return '';
}
/** Why the reporter cannot ask for a posting at all (before choosing where), or ''. */
export const postingOpenWhy = (p = player()) => { const w = postingWhy(null, p); return w === 'Choose another country.' ? '' : w; };
export function requestPosting(countryId) {
  const p = player();
  const why = postingWhy(countryId, p);
  if (why) return result(false, why, 'neutral');
  const j = J(p);
  j.postingAsked = year();
  const r = seeded(`${p.id}/posting/${countryId}/${year()}`);
  if (!r.chance(clamp(0.35 + (j.rep.accuracy - 50) / 100 + j.rep.recognition / 300, 0.1, 0.85))) return result(false, 'The foreign desk goes to someone else this year.', 'neutral');
  const c = COUNTRIES[countryId];
  j.posting = { countryId, city: c.cities[0], from: year(), until: year() + 3 };
  j.history.push({ year: year(), text: `Posted to ${c.cities[0]}, ${c.name}, as a correspondent.` });
  milestone(`Became ${outlet(j.outletId).name}'s correspondent in ${c.name}.`, 'career');
  j.assigned = null;
  for (const s of myStories(p)) if (open(s, p)) s.status = 'spiked';
  assignYear(p);
  return result(true, `You are posted to ${c.cities[0]} for three years. The newsroom arranges a journalist's visa. Your stories now come from ${c.name}.`);
}
export function endPosting(p = player()) {
  const j = J(p);
  if (!j.posting) return result(false, 'You are not posted abroad.', 'neutral');
  j.history.push({ year: year(), text: `Came home from ${COUNTRIES[j.posting.countryId].name}.` });
  j.posting = null;
  j.assigned = null;
  return result(true, 'You come home to the home desk.', 'neutral');
}

// ---------- The family's record of it ----------
//
// What a descendant can see: each journalist in the family, their newsrooms, prizes and published work as it ran,
// with corrections. Never a notebook, an unpublished draft, or a confidential source's name.

export function familyJournalism() {
  const by = new Map();
  for (const x of Object.values(S().pubs)) {
    if (!by.has(x.reporterId)) by.set(x.reporterId, { id: x.reporterId, name: x.byline, pubs: [] });
    by.get(x.reporterId).pubs.push({ headline: x.headline, outlet: x.outlet, year: x.year, medium: x.medium, corrections: x.corrections.map((c) => c.text), sources: x.sources.map((y) => y.name) });
  }
  const p = player();
  const me = by.get(p.id);
  if (me && p.journalism) { me.history = p.journalism.history; me.awards = p.journalism.awards; }
  for (const [id, x] of Object.entries(S().legacy ?? {})) by.has(id) ? Object.assign(by.get(id), x) : x.history.length && by.set(id, { id, pubs: [], ...x });
  return [...by.values()].map((x) => ({ ...x, pubs: x.pubs.sort((a, b) => a.year - b.year) }));
}
/** Keeps a journalist's public record with the world, so it outlives them (run when they die or the life passes on). */
export function keepLegacy(p = player()) {
  if (!p.journalism) return;
  (S().legacy ??= {})[p.id] = { name: `${p.firstName} ${p.lastName}`, history: [...p.journalism.history], awards: [...p.journalism.awards] };
}

// ---------- When the life passes on ----------

/**
 * Carries the world's newsrooms into the heir's life: the outlets and their people, every publication and the family's
 * record of its journalists. The reporter's unfinished stories end with them. A publication they owned passes to the
 * heir (a family newspaper stays in the family); the heir owns it without having to run it themselves.
 */
export function handOverNewsroom(old, next, heir) {
  const N = old.newsroom;
  if (!N) return;
  const op = old.player;
  if (op.journalism) (N.legacy ??= {})[op.id] = { name: `${op.firstName} ${op.lastName}`, history: [...op.journalism.history], awards: [...op.journalism.awards] };
  for (const s of Object.values(N.stories)) if (s.reporterId === op.id && !['published', 'spiked', 'expired'].includes(s.status)) s.status = 'spiked';
  // The newsrooms' people are the same people.
  for (const o of Object.values(N.outlets)) for (const id of [o.editorId, o.seniorId, ...(o.staff ?? []).map((x) => x.npcId)]) if (id && old.npcs[id] && !next.npcs[id]) next.npcs[id] = old.npcs[id];
  next.newsroom = N;
  const owned = op.journalism?.owned && N.outlets[op.journalism.owned];
  if (owned && !owned.closed) {
    owned.ownerId = heir.id;
    owned.history.push({ year: old.year, text: `Passed from ${op.firstName} ${op.lastName} to ${heir.firstName} ${heir.lastName}.` });
    J(heir).owned = owned.id;
    J(heir).history.push({ year: old.year, text: `Inherited ${owned.name}.` });
  }
  const sisters = (op.journalism?.sisters ?? []).map((id) => N.outlets[id]).filter((o) => o && !o.closed && o.ownerId === op.id);
  for (const o of sisters) {
    o.ownerId = heir.id;
    o.history.push({ year: old.year, text: `Passed to ${heir.firstName} ${heir.lastName}.` });
    (J(heir).sisters ??= []).push(o.id);
    if (!J(heir).owned) { J(heir).owned = o.id; J(heir).sisters = J(heir).sisters.filter((x) => x !== o.id); }
  }
}

// ---------- The editor's desk ----------
//
// An editor (the career's fourth step and above) reads their reporters' work. Each year a few drafts by the
// newsroom's real reporters land on the desk, each with what its notes support. The editor approves, sends back or
// spikes; what they let through that was wrong comes back on the newsroom, and on them.

export const isEditor = (p = player()) => isReporter(p) && (p.career.level ?? 0) >= 3;
const DESK_CLAIMS = [['A council vote is due next month', 'verified'], ['The plan will cost twice what was promised', 'single'], ['Residents are split on it', 'supported'],
  ['The contractor has a record of delays', 'disputed'], ['Two councillors have ties to the developer', 'single'], ['Work starts in the spring', 'verified']];
/** This year's drafts on the editor's desk, made once a year from the newsroom's reporters. */
export function desk(p = player()) {
  const j = J(p);
  if (!isEditor(p)) return [];
  j.desk ??= {};
  if (!j.desk[year()]) {
    const o = outlet(j.outletId);
    const reporters = [o.seniorId, ...(o.staff ?? []).map((x) => x.npcId)].filter((id) => npc(id)?.alive);
    if (!reporters.length) { const n = makeNpc({ role: 'colleague', countryId: o.countryId, age: 29 }); n.occupation = 'Reporter'; n.flags.title = `A reporter at ${o.name}`; n.flags.newsroom = { outletId: o.id, role: 'Reporter' }; store.state.npcs[n.id] = n; (o.staff ??= []).push({ npcId: n.id, role: 'reporter', since: year() }); reporters.push(n.id); }
    const r = seeded(`${p.id}/desk/${year()}`);
    j.desk[year()] = Array.from({ length: 3 }, (_, i) => {
      const who = reporters[i % reporters.length];
      const picks = [...DESK_CLAIMS].sort(() => r.next() - 0.5).slice(0, 3).map(([text, status]) => ({ text, status, truth: status === 'verified' || status === 'supported' ? true : r.chance(0.45) }));
      return { id: `desk_${year()}_${i}`, reporterId: who, title: `${r.pick(['Questions over', 'The cost of', 'Inside'])} ${r.pick(['the bypass plan', 'the new library', 'the harbor deal', 'the school merger'])}`, claims: picks, decision: null };
    });
  }
  return j.desk[year()];
}
/** The editor's call on a draft: approve, send back, or spike. */
export function deskDecide(id, decision) {
  const p = player();
  const d = desk(p).find((x) => x.id === id);
  if (!d || d.decision) return result(false, 'That draft is not waiting.', 'neutral');
  if (!['approve', 'back', 'spike'].includes(decision)) return result(false, 'Approve, send back, or spike.', 'neutral');
  const j = J(p);
  j.rep.leadership ??= 50;
  d.decision = decision;
  const n = npc(d.reporterId);
  const weak = d.claims.filter((c) => ['single', 'disputed'].includes(c.status));
  const wrong = weak.filter((c) => !c.truth);
  if (decision === 'approve') {
    if (wrong.length) { d.flaw = true; j.rep.leadership = clamp(j.rep.leadership - 6); j.rep.trust = clamp(j.rep.trust - 3); if (n) n.meters.relationship = clamp(n.meters.relationship + 4); return result(false, `It runs. Later, "${wrong[0].text}" turns out not to be so: it rested on ${wrong[0].status === 'single' ? 'one source' : 'a disputed account'}, and it was your call.`, 'bad'); }
    j.rep.leadership = clamp(j.rep.leadership + (weak.length ? 1 : 3));
    if (n) n.meters.relationship = clamp(n.meters.relationship + 5);
    return result(true, `It runs, and it holds up.${weak.length ? ' You were lucky with the thin parts.' : ''}`);
  }
  if (decision === 'back') {
    if (n) n.meters.relationship = clamp(n.meters.relationship - (weak.length ? 1 : 5));
    j.rep.leadership = clamp(j.rep.leadership + (weak.length ? 4 : -2));
    return result(true, weak.length ? `${n?.firstName ?? 'The reporter'} goes back to firm up the thin parts. The story is better for it.` : `${n?.firstName ?? 'The reporter'} cannot see what is wrong with it, and neither, on reflection, can you.`, weak.length ? 'good' : 'neutral');
  }
  if (n) n.meters.relationship = clamp(n.meters.relationship - 8);
  j.rep.leadership = clamp(j.rep.leadership + (wrong.length >= 2 ? 3 : -3));
  return result(true, wrong.length >= 2 ? 'You spike it. It would not have stood up.' : `You spike it. ${n?.firstName ?? 'The reporter'} is not happy: most of it was sound.`, 'neutral');
}

// ---------- A documentary ----------
//
// A published investigation that stood up can become a documentary: months of further reporting, the people who
// would go on camera, production, and a legal read before release. Released once.

export function documentaryWhy(pubId, p = player()) {
  const x = S().pubs[pubId];
  if (!x || x.reporterId !== p.id) return 'Not your story.';
  if (x.beat !== 'investigative') return 'Documentaries grow from investigations.';
  if (x.errors.length) return 'Not from a story that got something wrong.';
  if (!x.claims.some((c) => c.asFact)) return 'The investigation has to have stood up on the record.';
  if (!isReporter(p) && !ownedOutlet(p)) return 'You need a newsroom or a publication of your own to make it.';
  if (Object.values(S().docs ?? {}).some((d) => d.pubId === pubId)) return 'There is a documentary of it already.';
  return '';
}
export function startDocumentary(pubId) {
  const p = player();
  const why = documentaryWhy(pubId, p);
  if (why) return result(false, why, 'neutral');
  const x = S().pubs[pubId];
  S().docs ??= {};
  const id = nextId('doc');
  S().docs[id] = { id, pubId, reporterId: p.id, title: `${x.headline}: the documentary`, stage: 'research', progress: 0, legal: false, started: now(), released: null };
  return result(true, 'You start on the documentary. Months of work: more reporting, the people who will go on camera, the edit, the lawyers.', 'neutral');
}
export const myDocumentaries = (p = player()) => Object.values(S().docs ?? {}).filter((d) => d.reporterId === p.id);
const DOC_STAGES = [['research', 3], ['interviews', 2], ['production', 3]];
/** A season of work on it (2 actions): research, interviews, the edit. */
export function workDocumentary(id) {
  const p = player();
  const d = S().docs?.[id];
  if (!d || d.reporterId !== p.id || d.released) return result(false, 'That is not in progress.', 'neutral');
  const i = DOC_STAGES.findIndex(([k]) => k === d.stage);
  if (i < 0) return result(false, 'It is ready for the lawyers.', 'neutral');
  if (!spend(2, p)) return result(false, 'You are out of time this year.', 'neutral');
  d.progress += 1;
  grow('reporting', 2); grow('interviewing', 1);
  if (d.progress >= DOC_STAGES[i][1]) { d.stage = DOC_STAGES[i + 1]?.[0] ?? 'legal'; d.progress = 0; }
  return result(true, { research: 'More records, more context.', interviews: 'People agree to go on camera; one changes their mind.', production: 'The edit: three hours of footage becomes fifty minutes.' }[DOC_STAGES[i][0]] + (d.stage === 'legal' ? ' It is ready for the lawyers.' : ''), 'neutral');
}
export function releaseDocumentary(id) {
  const p = player();
  const d = S().docs?.[id];
  if (!d || d.reporterId !== p.id || d.released) return result(false, 'That is not in progress.', 'neutral');
  if (d.stage !== 'legal') return result(false, 'It is not finished.', 'neutral');
  if (!d.legal) { if (!spend(1, p)) return result(false, 'You are out of time this year.', 'neutral'); d.legal = true; return result(true, 'The lawyers watch it twice, and ask for two lines to be attributed. Done. It can be released.', 'neutral'); }
  d.released = year();
  const j = J(p);
  j.rep.recognition = clamp(j.rep.recognition + 8);
  j.history.push({ year: year(), text: `Released the documentary "${d.title}".` });
  milestone(`Released a documentary: "${d.title}".`, 'career');
  return result(true, `"${d.title}" is released. People who never read the story watch it.`);
}

// ---------- Leave ----------

/** A year away from the newsroom: no assignments, rest, and the job kept. Not every great reporter burns out. */
export function takeLeave() {
  const p = player();
  const j = J(p);
  if (!isReporter(p)) return result(false, 'Leave is for staff reporters.', 'neutral');
  if (j.leave === year() + 1) return result(false, 'Your leave is booked for next year.', 'neutral');
  if ((j.lastLeave ?? -99) > year() - 5) return result(false, 'You had leave recently.', 'neutral');
  j.leave = year() + 1;
  j.lastLeave = year() + 1;
  return result(true, 'Your editor signs off a year\'s leave from next year. The desk will be there when you get back.', 'neutral');
}

// ---------- Your own leads, and following up ----------
//
// A staff reporter can bring their editor a lead of their own on any beat open to them, twice a year; whether the
// editor takes it depends on the reporter's record and how the two get on. A story that ran can be followed up: what
// has happened since, checked the same way. A follow-up may find nothing has changed, and that can be the story.

export function pitchLeadWhy(beat, p = player()) {
  if (!isReporter(p)) return 'Leads are pitched to your editor, on staff.';
  if (J(p).leave === year()) return 'You are on leave.';
  if ((J(p).leads?.[year()] ?? 0) >= 2) return 'You have pitched two this year.';
  return beatWhy(beat, p);
}
export function pitchLead(beat) {
  const p = player();
  const why = pitchLeadWhy(beat, p);
  if (why) return result(false, why, 'neutral');
  if (!spend(1, p)) return result(false, 'You are out of time this year.', 'neutral');
  const j = J(p);
  (j.leads ??= {})[year()] = (j.leads[year()] ?? 0) + 1;
  const o = outlet(j.outletId);
  const ed = npc(o.editorId);
  const r = seeded(`${p.id}/lead/${year()}/${j.leads[year()]}`);
  const yes = r.chance(clamp(0.35 + (j.rep.accuracy - 50) / 150 + ((ed?.meters.relationship ?? 50) - 50) / 200 + myPubs(p).filter((x) => !x.errors.length).length * 0.02, 0.15, 0.9));
  if (!yes) return result(false, `${nameOf(ed) || 'Your editor'} hears you out, and says no: "Not this year. Bring me something firmer."`, 'neutral');
  const w = j.posting ? { countryId: j.posting.countryId, city: j.posting.city } : { countryId: p.countryId, city: p.city };
  const gens = { local: localStory, politics: politicsStory, investigative: investigativeStory, business: businessStory, science: scienceStory, education: educationStory,
    environment: environmentStory, technology: technologyStory, arts: artsStory, data: dataStory, sports: sportsStory, entertainment: musicStory, kpop: kpopStory };
  const s = (gens[beat] ?? localStory)(p, o, r, w) ?? localStory(p, o, r, w);
  s.pitched = { own: true };
  grow('reporting', 1);
  return result(true, `${nameOf(ed) || 'Your editor'} takes it: "${s.title}" is yours. Go and find out whether it stands up.`);
}

export function followStoryWhy(pubId, p = player()) {
  const x = S().pubs[pubId];
  if (!x || x.reporterId !== p.id) return 'Not your story.';
  if (!working(p)) return 'You need to be working as a reporter.';
  if (x.year >= year()) return 'Give it a year: nothing has happened since yet.';
  if (Object.values(S().stories).some((s) => s.links.followOf === pubId)) return 'You have followed it up.';
  return '';
}
/** A follow-up of a published story: what has happened since, with a returning source where there was one. */
export function followStory(pubId) {
  const p = player();
  const why = followStoryWhy(pubId, p);
  if (why) return result(false, why, 'neutral');
  if (!spend(1, p)) return result(false, 'You are out of time this year.', 'neutral');
  const x = S().pubs[pubId];
  const j = J(p);
  const o = isReporter(p) ? outlet(j.outletId) : ownedOutlet(p);
  const r = seeded(`${pubId}/follow`);
  const w = { countryId: p.countryId, city: p.city };
  const changed = r.chance(0.55);
  const s = newStory(p, o, x.beat, `Follow-up: ${x.headline}`, { subject: x.headline, links: { ...x.links, followOf: pubId } });
  const c1 = addClaim(s, { text: `Things have changed since "${x.headline}" ran`, truth: changed, important: true });
  const c2 = addClaim(s, { text: 'The people in charge did what they promised', truth: changed && r.chance(0.6) });
  const c3 = addClaim(s, { text: 'People who were affected say it made a difference', kind: 'opinion', truth: true });
  addDoc(s, { title: 'The public record since the story ran', settles: [{ claimId: c1.id }, { claimId: c2.id }] });
  const back = x.sources.find((y) => y.npcId && npc(y.npcId)?.alive);
  const t2 = s.claims[1].truth;
  if (back) addSource(s, { npcId: back.npcId, name: back.name, role: 'Quoted in the original story', type: 'community', willing: 0.9, knows: [{ claimId: c1.id, says: changed }, { claimId: c3.id, says: true }, { claimId: c2.id, says: r.chance(0.75) ? t2 : !t2 }] });
  const n = person(w, r, `Lives in ${w.city}`, [22, 75]);
  addSource(s, { npcId: n.id, name: nameOf(n), role: 'Someone affected', type: 'community', willing: 0.75, knows: [{ claimId: c3.id, says: true }, { claimId: c1.id, says: r.chance(0.8) ? changed : !changed }] });
  return result(true, `"${s.title}" is in your assignments. Maybe something has changed; maybe nothing has, and that is news too.`, 'neutral');
}

// ---------- A media company ----------
//
// A publication that has lasted can grow: a second title (with an editor hired to run it), a bigger research budget,
// a bureau in another city, outside money. Every one of them costs money every year; none is sure to pay. The owner
// runs the business: what the staff think, and how they live, is their own.

/** Every title the player owns: the first, and any launched since. */
export const ownedTitles = (p = player()) => [ownedOutlet(p), ...(J(p).sisters ?? []).map((id) => S().outlets[id])].filter((o) => o && !o.closed && o.ownerId === p.id);
export function expandWhy(kind, p = player()) {
  const o = ownedOutlet(p);
  if (!o) return 'You need a publication of your own first.';
  if (year() - o.founded < 2) return 'Give the first one two years.';
  if (ownedTitles(p).length >= 4) return 'Four titles is as many as you can run.';
  const k = OWN_KINDS[kind];
  if (!k) return 'No such kind.';
  if (k.needs && !exists(k.needs)) return `Not in ${year()}.`;
  if (year() < k.from) return `Not in ${year()}.`;
  const cost = startCost(kind) + Math.round(localWage(STAFF_PAY.editor, country()));
  if (p.finance.cash < cost) return `It costs ${fmtMoney(cost, country())} to launch, with an editor's first year.`;
  return '';
}
/** Launches another title, with an editor hired to run it. */
export function launchTitle(kind, name) {
  const p = player();
  const why = expandWhy(kind, p);
  if (why) return result(false, why, 'neutral');
  const first = ownedOutlet(p);
  const k = OWN_KINDS[kind];
  p.finance.cash -= startCost(kind);
  const r = seeded(`${p.id}/title/${year()}/${kind}`);
  const id = nextId('outlet');
  const title = (name ?? '').trim().slice(0, 40) || `${first.name} ${kind === 'podcast' ? 'Podcast' : kind === 'newsletter' ? 'Letter' : 'Online'}`;
  const o = { id, kind: `own_${kind}`, ownKind: kind, name: title, medium: k.medium, countryId: p.countryId, city: p.city, founded: year(), ownerId: p.id, editorId: null, seniorId: null,
    standards: first.standards, policy: first.policy, reputation: Math.round((first.reputation + 40) / 2), audience: Math.round(k.start * (0.8 + r.next() * 0.4) + first.audience * 0.05), staff: [], finances: [],
    history: [{ year: year(), text: `Launched by ${p.firstName} ${p.lastName}, alongside ${first.name}.` }] };
  S().outlets[id] = o;
  (J(p).sisters ??= []).push(id);
  const ed = makeNpc({ role: 'colleague', countryId: p.countryId, age: 42, relationship: 55 });
  ed.occupation = 'Editor';
  ed.flags.title = `Editor of ${title}, which you own`;
  ed.flags.newsroom = { outletId: id, role: 'editor' };
  store.state.npcs[ed.id] = ed;
  meet(ed, ed.flags.title, p);
  o.staff.push({ npcId: ed.id, role: 'editor', salary: Math.round(localWage(STAFF_PAY.editor, country())), since: year() });
  o.editorId = ed.id;
  J(p).history.push({ year: year(), text: `Launched ${title}.` });
  milestone(`Launched ${title}: your media company has ${ownedTitles(p).length} titles.`, 'career');
  return result(true, `${title} launches, edited by ${nameOf(ed)}. ${ownedTitles(p).length} titles now.`);
}
/** The research budget of a title: 0 (none), 1 (a fact-checker), 2 (a research desk). Costs more every year. */
export function setResearch(outletId, level) {
  const o = ownedTitles().find((x) => x.id === outletId);
  if (!o) return result(false, 'Not yours.', 'neutral');
  if (![0, 1, 2].includes(level)) return result(false, 'None, a fact-checker, or a research desk.', 'neutral');
  o.research = level;
  o.history.push({ year: year(), text: ['Research budget cut.', 'Hired a fact-checker.', 'Set up a research desk.'][level] });
  return result(true, ['The research budget goes. It saves money.', 'A fact-checker reads everything before it runs. It costs more each year.', 'A research desk: records, data, checking. It costs a good deal each year.'][level], 'neutral');
}
export function bureauWhy(outletId, city, p = player()) {
  const o = ownedTitles(p).find((x) => x.id === outletId);
  if (!o) return 'Not yours.';
  if (!COUNTRIES[p.countryId].cities.includes(city) || city === o.city) return 'Pick another city in the country.';
  if ((o.bureaus ?? []).includes(city)) return 'There is a bureau there.';
  if ((o.bureaus ?? []).length >= 3) return 'Three bureaus is enough.';
  const cost = Math.round(localWage(OWN_KINDS[o.ownKind].upkeep, country()));
  if (p.finance.cash < cost) return `It costs ${fmtMoney(cost, country())} to set up.`;
  return '';
}
/** A bureau in another city: more to cover, more readers, more costs. */
export function openBureau(outletId, city) {
  const p = player();
  const why = bureauWhy(outletId, city, p);
  if (why) return result(false, why, 'neutral');
  const o = S().outlets[outletId];
  const cost = Math.round(localWage(OWN_KINDS[o.ownKind].upkeep, country()));
  p.finance.cash -= cost;
  (o.bureaus ??= []).push(city);
  o.history.push({ year: year(), text: `Opened a bureau in ${city}.` });
  return result(true, `${o.name} opens a bureau in ${city}, for ${fmtMoney(cost, country())}. It will cost more every year.`, 'neutral');
}
/** An investor's offer for a share of the first title (scene 'jn_investor'): money now, a share of every profit after. */
export function investorOffer(p = player()) {
  const o = ownedOutlet(p);
  if (!o || o.investor) return null;
  const last = o.finances.at(-1);
  if (!last) return null;
  const amount = Math.round(Math.max(localWage(OWN_KINDS[o.ownKind].cost, country()), last.revenue * 0.6));
  return { amount, share: 0.25 };
}
