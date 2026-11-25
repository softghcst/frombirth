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
import { OUTLET_KINDS, BEATS, LOCAL_EVENTS, TIPS, QUESTIONS, ATTRIBUTION, STATUS, ACTIONS_A_YEAR, AWARDS } from '../data/journalism.js';
import { RELEASE_TYPES } from '../data/fame.js';
import { makeNpc } from './npcFactory.js';
import { registerEmployer, cityEmployers, employer } from './employers.js';
import { hire, promote } from './career.js';
import { levelOf } from './skills.js';
import { exists } from './fame.js';
import { claim as claimSpecial, whyNot as whySpecial } from './specialCareer.js';
import { publicCases } from './investigations/crossover.js';

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
  const name = kind === 'regional' ? `The ${COUNTRIES[countryId].name} ${word}` : `The ${city} ${word}`;
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
  return p.journalism;
}
export const isReporter = (p = player()) => p.career?.careerId === 'journalist' && !!J(p).outletId;
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
    if (isReporter(p)) return 'You already work in a newsroom. To move, leave journalism first.';
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
  if (!isReporter(p)) return result(false, 'You are not working as a reporter.', 'neutral');
  const b = BEATS[beat];
  if (!b) return result(false, 'There is no such beat.', 'neutral');
  if ((b.minLevel ?? 0) > p.career.level) return result(false, 'Investigations are for senior reporters.', 'neutral');
  J(p).beat = beat;
  return result(true, `You move to the ${b.name.toLowerCase()} beat. New assignments come with the year.`, 'neutral');
}

// ---------- Stories: made from what really happened ----------

const story = (id) => S().stories[id] ?? null;
export const storyOf = story;
export const myStories = (p = player()) => Object.values(S().stories).filter((s) => s.reporterId === p.id);
export const myPubs = (p = player()) => Object.values(S().pubs).filter((x) => x.reporterId === p.id).sort((a, b) => b.at - a.at);

function newStory(p, o, beat, title, extra) {
  const id = nextId('story');
  const s = { id, beat, title, reporterId: p.id, outletId: o.id, editorId: o.editorId, created: now(), year: year(), deadline: beat === 'investigative' ? null : now() + 9,
    status: 'assigned', claims: [], sources: [], docs: [], evidence: [], interviews: [], comment: null, legal: null, draft: null, review: null, pubId: null, links: {}, ...extra };
  S().stories[id] = s;
  return s;
}
const addClaim = (s, c) => { const x = { id: `${s.id}c${s.claims.length + 1}`, kind: 'fact', important: false, ...c }; s.claims.push(x); return x; };
const addSource = (s, c) => { const x = { id: `${s.id}s${s.sources.length + 1}`, knows: [], hidden: false, wantsConfidential: false, ...c }; s.sources.push(x); return x; };
const addDoc = (s, c) => { const x = { id: `${s.id}d${s.docs.length + 1}`, public: true, settles: [], cost: 1, ...c }; s.docs.push(x); return x; };

/** A local story: a real business opening (registered in the city), or a meeting, fair or program with its organizer. */
function localStory(p, o, r) {
  const ev = r.pick(LOCAL_EVENTS);
  const what = r.pick(ev.what);
  const street = r.pick(['Market Street', 'Station Road', 'Elm Avenue', 'Church Lane', 'the old square']);
  const org = makeNpc({ role: 'acquaintance', countryId: p.countryId, age: r.int(28, 66) });
  org.occupation = ev.kind === 'opening' ? `Owner of a ${what}` : `Organizer in ${p.city}`;
  store.state.npcs[org.id] = org;
  const neighbor = makeNpc({ role: 'acquaintance', countryId: p.countryId, age: r.int(20, 80) });
  neighbor.occupation = `Lives in ${p.city}`;
  store.state.npcs[neighbor.id] = neighbor;
  const title = ev.title.replace('{what}', what).replace('{street}', street);
  const s = newStory(p, o, 'local', title, { subject: nameOf(org) });
  if (ev.kind === 'opening') {
    const biz = registerEmployer({ name: `${org.lastName}'s ${what.replace(/^./, (c) => c.toUpperCase())}`, family: 'retail', tracks: [], countryId: p.countryId, city: p.city, owned: false });
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
function courtStory(p, o, r, cases) {
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
  const w = makeNpc({ role: 'acquaintance', countryId: p.countryId, age: r.int(25, 75) });
  w.occupation = `A witness in ${pub.title.split(',')[0].toLowerCase()}`;
  store.state.npcs[w.id] = w;
  const c4true = s.claims.find((x) => x.id === c4.id).truth;
  addSource(s, { npcId: w.id, name: nameOf(w), role: 'A neighbor who was there', type: 'witness', willing: 0.55, knows: [{ claimId: c4.id, says: r.chance(0.7) ? c4true : !c4true }, { claimId: c3.id, says: true }] });
  addSource(s, { institution: true, name: 'The defense', role: 'The defendant\'s lawyer', type: 'lawyer', willing: 0.5, knows: [{ claimId: c3.id, says: false }, { claimId: c1.id, says: true }] });
  addSource(s, { institution: true, name: pub.agency ?? 'The police', role: 'The investigating agency', type: 'official', willing: 0.35, knows: [{ claimId: c1.id, says: true }] });
  return s;
}

/** A sports story, from a season really played (engine/sports): who won, and by how much. */
function sportsStory(p, o, r) {
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
  const coach = makeNpc({ role: 'acquaintance', countryId: p.countryId, age: r.int(35, 62) });
  coach.occupation = `Coach of ${name}`;
  store.state.npcs[coach.id] = coach;
  addSource(s, { npcId: coach.id, name: nameOf(coach), role: `${name}'s coach`, type: 'athlete', willing: 0.7, knows: [{ claimId: c1.id, says: true }, { claimId: c3.id, says: true }, { claimId: c2.id, says: true }] });
  return s;
}

/** A music story, from a record that really came out (engine/music): its chart place, from the published chart. */
function musicStory(p, o, r) {
  const rels = Object.values(store.state.entertainment?.releases ?? {}).filter((x) => x.released != null && x.released >= year() - 1 && store.state.entertainment.acts?.[x.actId]?.countryId === p.countryId
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
function politicsStory(p, o, r) {
  const w = store.state.polities?.[p.countryId];
  const el = w?.elections?.at(-1);
  if (!el || !el.seats || Object.values(S().stories).some((s) => s.links.election === `${p.countryId}:${el.year}` && s.reporterId === p.id)) return null;
  const top = Object.entries(el.seats).sort((a, b) => b[1] - a[1])[0];
  const party = w.parties.find((x) => x.id === top[0]);
  const loser = w.parties.find((x) => x.id !== top[0]);
  const s = newStory(p, o, 'politics', `How the ${el.year} election was won`, { subject: party?.name, links: { election: `${p.countryId}:${el.year}` }, needsComment: true });
  const c1 = addClaim(s, { text: `${party?.name ?? 'The winners'} won the most seats in ${el.year}`, truth: true, important: true });
  const c2 = addClaim(s, { text: `Turnout was ${el.turnout ?? 70}%`, truth: true });
  const c3 = addClaim(s, { text: 'The count was unfair', kind: 'allegation', truth: false });
  addDoc(s, { title: 'The electoral commission\'s published results', settles: [{ claimId: c1.id }, { claimId: c2.id }, { claimId: c3.id }] });
  const lead = (pa) => (pa ? w.figures[pa.leaderId] : null);
  if (lead(party)) addSource(s, { figureId: lead(party).id, name: lead(party).name, role: `Leader of ${party.name}`, type: 'official', willing: 0.45, knows: [{ claimId: c1.id, says: true }] });
  if (lead(loser)) addSource(s, { figureId: lead(loser).id, name: lead(loser).name, role: `Leader of ${loser.name}`, type: 'official', willing: 0.6, knows: [{ claimId: c3.id, says: true }, { claimId: c1.id, says: true }] });
  return s;
}

/** An investigation: a tip about a real employer in the city. Most tips do not stand up as first told. */
function investigativeStory(p, o, r) {
  // A real employer in the city, not a newsroom or a shop the player owns.
  const list = cityEmployers(p.countryId, p.city).filter((x) => x.family !== 'media');
  const e = list.length ? r.pick(list) : null;
  if (!e) return null;
  const tip = r.pick(TIPS);
  const truth = r.chance(0.4);
  const t = (x) => x.replace('{org}', e.name);
  const s = newStory(p, o, 'investigative', t(tip.title), { subject: e.name, links: { employerId: e.id }, needsComment: true, needsLegal: true });
  const main = addClaim(s, { text: t(tip.claim), kind: 'allegation', truth, important: true });
  const record = addClaim(s, { text: `${tip.record} show problems at ${e.name}`, truth });
  const pattern = addClaim(s, { text: 'It has been going on for more than a year', truth: truth && r.chance(0.7) });
  const insider = makeNpc({ role: 'acquaintance', countryId: p.countryId, age: r.int(24, 60) });
  insider.occupation = `Worked at ${e.name}`;
  store.state.npcs[insider.id] = insider;
  const second = makeNpc({ role: 'acquaintance', countryId: p.countryId, age: r.int(24, 60) });
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
  if (!isReporter(p) || j.assigned === year()) return [];
  j.assigned = year();
  const o = outlet(j.outletId);
  const made = [];
  const n = 2 + Math.min(3, p.career.level ?? 0);
  const cases = (() => { try { return publicCases(p); } catch { return []; } })();
  for (let i = 0; i < n; i++) {
    const r = seeded(`${p.id}/${year()}/assign/${i}`);
    const beat = i === 0 || r.chance(0.6) ? j.beat : 'local';
    const s = ({ local: localStory, court: (pp, oo, rr) => courtStory(pp, oo, rr, cases), sports: sportsStory, entertainment: musicStory, politics: politicsStory, investigative: investigativeStory }[beat] ?? localStory)(p, o, r)
      ?? localStory(p, o, r); // nothing on the beat this year: a local story instead
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
  return { id: s.id, title: s.title, beat: s.beat, status: s.status, outlet: outlet(s.outletId)?.name, editorId: s.editorId, deadline: s.deadline, subject: s.subject,
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
  const ed = npc(s.editorId);
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
  if (list.length) return result(false, `${nameOf(ed) || 'Your editor'} sends it back: ${list.join(' ')}`, 'neutral');
  return result(true, `${nameOf(ed) || 'Your editor'} reads it twice and approves it. It can run.`);
}

/** Publishes an approved story, once. The record is kept as it ran; what it got wrong comes back later. */
export function publish(storyId) {
  const p = player();
  const s = story(storyId);
  if (!s || s.reporterId !== p.id) return result(false, 'That story is not yours.', 'neutral');
  if (s.pubId) return result(false, 'It has already run.', 'neutral');
  if (s.status !== 'approved') return result(false, 'The editor has not approved it.', 'neutral');
  const o = outlet(s.outletId);
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
  // A reporter's standing: accuracy, trust and recognition are kept apart, and none is fame.
  j.rep.recognition = clamp(j.rep.recognition + quality / 25);
  if (!errors.length) j.rep.accuracy = clamp(j.rep.accuracy + 2);
  grow('writing', 2); grow('reporting', 2);
  if (p.career) p.career.performance = clamp((p.career.performance ?? 50) + (errors.length ? 1 : 4));
  // What it got wrong comes back: a reader, a source, the subject's lawyer. Some complaints are wrong too.
  const r = seeded(`${id}/complaint`);
  if (errors.length) pub.complaint = { due: now() + r.int(1, 8), claimId: errors[0], real: true, raised: null, resolved: null };
  else if (r.chance(0.12)) pub.complaint = { due: now() + r.int(2, 10), claimId: inc[0].id, real: false, raised: null, resolved: null };
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
  if (!isReporter(p)) return lines;
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
  const made = assignYear(p);
  if (made.length) lines.push(`${made.length} new ${made.length === 1 ? 'assignment is' : 'assignments are'} waiting at ${outlet(j.outletId)?.name}.`);
  return lines;
}

/** Leaving the newsroom (leaving the special career, or the job). Stories in progress are dropped; what ran is kept. */
export function leaveNewsroom(p = player()) {
  const j = J(p);
  for (const s of myStories(p)) if (open(s, p)) s.status = 'spiked';
  if (j.outletId) j.history.push({ year: year(), text: `Left ${outlet(j.outletId)?.name}.` });
  j.outletId = null;
}

