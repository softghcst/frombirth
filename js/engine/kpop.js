// The K-pop idol life: agencies and their trainees, global auditions in
// stages, trainee agreements, years of training with evaluations and no
// promise of debut, survival programs, debut groups made of the actual
// trainees chosen, positions (one or two per member, no contradictions,
// maknae from birth dates), releases, weekly music shows with their own
// scoring, ending fairies, fandoms, exclusive contracts, hiatuses, solo work,
// renewals, disbandment and reunions. Fictional throughout (data/kpop.js).
//
//   state.kpop = { seq, agencies:{id:Agency}, auditions:{}, apps:{}, contracts:{}, evals:{}, programs:{}, groups:{},
//                  releases:{}, performances:{}, wins:[], awards:{}, year }
//   p.idol = { apps:[], traineeId(contract), contracts:[], programs:[], groupId, groups:[], focus, stage, camera, history:[],
//              fairies:[], hiatus, solo:[], acts:{ age, ... }, pop, trust }
//   npc.flags.idol = { agencyId, since, sk:{vocal,dance,rap,stage,camera,media,korean}, born:{year,day}, status, groupId, pop, history:[] }
import { rng } from '../rng.js';
import { clamp, fmtMoney, localWage, wageIn } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { KPOP_ERAS, AGENCIES, AGENCY_BY_ID, FOCUSES, CONCEPTS, POSITIONS, MAX_POSITIONS, MUSIC_SHOWS, PROMO_WEEKS, SURVIVAL_FORMATS, MISSIONS, APPROACHES,
  FAIRY_STYLES, RELEASE_KINDS, KPOP_AWARDS, GROUP_WORDS, SONG_WORDS, FANDOM_WORDS } from '../data/kpop.js';
import { makeNpc } from './npcFactory.js';
import { levelOf } from './skills.js';
import { gain, regard, fameOf } from './fame.js';
import { hasRecord } from './records.js';
import { rightToLive } from './citizenship.js';
import { addCondition, cureCondition } from './health.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const year = () => store.state.year;
const npc = (id) => store.state.npcs[id] ?? null;
const full = (who) => (who === 'player' ? `${player().firstName} ${player().lastName}` : npc(who) ? `${npc(who).firstName} ${npc(who).lastName}` : 'Someone');
const K = () => {
  const st = store.state;
  st.kpop ??= { seq: 0, agencies: {}, auditions: {}, apps: {}, contracts: {}, evals: {}, programs: {}, groups: {}, releases: {}, performances: {}, wins: [], awards: {}, projects: {} };
  return st.kpop;
};
const nextId = (pre) => `${pre}_${(K().seq += 1).toString(36)}`;
export const era = (key, y = year()) => y >= KPOP_ERAS[key];
export const available = (y = year()) => era('agencies', y);

export function idolOf(p = player()) {
  p.idol ??= { apps: [], traineeId: null, contracts: [], programs: [], groupId: null, groups: [], focus: 'balanced', stage: 15, camera: 15, history: [], fairies: [], hiatus: null, solo: [], pop: 0 };
  const i = p.idol;
  if (i.acts?.age !== p.age) i.acts = { age: p.age, apps: 0, sessions: 0, social: 0, did: {} };
  return i;
}
const note = (text, p = player()) => { const i = idolOf(p); i.history.push({ year: year(), age: p.age, text }); if (i.history.length > 120) i.history.shift(); };

// ---------- Skills: the game's own, plus what idol training adds ----------

const birthDay = (p) => (p.flags.birthDay ??= rng.int(1, 365));
/** A member's birth date as a number that sorts: the youngest has the largest. */
export const bornKey = (who) => (who === 'player' ? player().birthYear * 1000 + birthDay(player()) : (npc(who)?.flags.idol?.born.year ?? 0) * 1000 + (npc(who)?.flags.idol?.born.day ?? 0));

/** The player's idol skills, read from the game's own singing, dance and language skills; stage and camera are trained here. */
export function skillsOf(who = 'player') {
  if (who !== 'player') return npc(who)?.flags.idol?.sk ?? { vocal: 40, dance: 40, rap: 30, stage: 40, camera: 40, media: 40, korean: 50 };
  const p = player();
  const i = idolOf(p);
  const korean = p.birthCountryId === 'kr' ? 100 : Math.round(p.skills?.korean ?? 0);
  return { vocal: Math.round(p.talents.singing ?? 0), dance: Math.round(p.talents.dance ?? 0), rap: Math.round(Math.max(levelOf('rap'), (p.talents.music ?? 0) * 0.3)),
    stage: Math.round(i.stage), camera: Math.round(i.camera * 0.7 + (p.stats.charm ?? 50) * 0.3), media: Math.round(levelOf('public_speaking') * 0.7 + (p.stats.charm ?? 50) * 0.3), korean };
}
function raise(who, area, by) {
  if (by <= 0) return;
  const room = (v) => Math.max(0.15, (100 - v) / 100);
  if (who !== 'player') { const sk = npc(who)?.flags.idol?.sk; if (sk) sk[area] = Math.round(clamp(sk[area] + by * room(sk[area]))); return; }
  const p = player();
  const i = idolOf(p);
  p.skills ??= {};
  const up = (v) => clamp(v + by * room(v));
  if (area === 'vocal') p.talents.singing = up(p.talents.singing ?? 0);
  else if (area === 'dance') p.talents.dance = up(p.talents.dance ?? 0);
  else if (area === 'rap') p.skills.rap = up(p.skills.rap ?? 0);
  else if (area === 'media') p.skills.public_speaking = up(p.skills.public_speaking ?? 0);
  else if (area === 'korean') { if (p.birthCountryId !== 'kr') p.skills.korean = up(p.skills.korean ?? 0); }
  else if (area === 'stage') i.stage = up(i.stage);
  else if (area === 'camera') i.camera = up(i.camera);
}
/** How ready someone is for the stage: the overall shape of their skills. */
export function readiness(who) {
  const s = skillsOf(who);
  const top2 = [s.vocal, s.dance, s.rap].sort((a, b) => b - a);
  return Math.round(top2[0] * 0.4 + top2[1] * 0.25 + s.stage * 0.2 + s.camera * 0.1 + s.media * 0.05);
}

// ---------- The world: agencies, staff, trainees, groups ----------

function idolNpc(countryId, o = {}) {
  const age = o.age ?? rng.int(14, 22);
  const n = makeNpc({ role: 'performer', countryId, age, relationship: o.relationship ?? rng.int(35, 55), gender: o.gender });
  const lv = o.level ?? rng.int(40, 75);
  const spike = rng.pick(['vocal', 'dance', 'rap', 'stage']);
  const sk = { vocal: rng.around(lv, 10), dance: rng.around(lv, 10), rap: rng.around(lv - 15, 12), stage: rng.around(lv - 5, 8), camera: rng.around(lv - 5, 10), media: rng.around(lv - 10, 10), korean: countryId === 'kr' ? 100 : rng.int(10, 70) };
  sk[spike] += 12;
  for (const k of Object.keys(sk)) sk[k] = Math.round(clamp(sk[k], 5, 98));
  n.flags.idol = { agencyId: o.agencyId ?? null, since: year(), sk, born: { year: year() - age, day: rng.int(1, 365) }, status: o.status ?? 'trainee', groupId: null, pop: 0, history: [] };
  n.flags.star = { kind: 'idol', fame: 0, born: year() - age, credits: [], skill: { singing: sk.vocal, dance: sk.dance, charm: sk.camera } };
  n.occupation = o.status === 'idol' ? 'idol' : 'idol trainee';
  store.state.npcs[n.id] = n;
  return n;
}

function staffNpc(countryId, job) {
  const n = makeNpc({ role: 'performer', countryId, age: rng.int(30, 60), relationship: rng.int(40, 55) });
  n.occupation = job;
  n.flags.idolStaff = { job, since: year() - rng.int(1, 15) };
  store.state.npcs[n.id] = n;
  return n.id;
}

function makeAgency(def) {
  const country = def.countryId;
  const a = { id: def.id, name: def.name, kind: def.kind, parent: def.parent ?? null, countryId: country, city: def.city, founded: def.founded, reputation: def.reputation, capital: Math.round(def.reputation * 1e6),
    training: def.training, focus: def.focus, concepts: def.concepts, welfare: def.welfare, rap: def.rap, global: !!def.global, trainee: def.trainee, artist: def.artist,
    staff: { vocal: staffNpc(country, 'vocal coach'), dance: staffNpc(country, 'choreographer'), director: staffNpc(country, 'trainee director'), manager: staffNpc(country, 'manager'), producer: staffNpc(country, 'producer') },
    trainees: [], groups: [], dorm: def.trainee.housing === 'dorm' ? { id: `dorm_${def.id}`, city: def.city, residents: [] } : null, lastProject: year() - rng.int(0, 2) };
  const pool = def.global ? ['us', 'kr', 'jp', 'ph', 'th', 'br', 'mx', 'ca', 'au', 'fr'] : ['kr', 'kr', 'kr', 'kr', 'jp', 'cn', 'th', 'us', 'au'];
  for (let i = 0; i < 10; i++) { const n = idolNpc(rng.pick(pool.filter((c) => COUNTRIES[c])), { agencyId: a.id, gender: rng.pick(['female', 'male']) }); a.trainees.push(n.id); }
  return a;
}

/** Makes the industry the first time anyone looks, and opens agencies as their founding years arrive. */
export function world() {
  const k = K();
  for (const def of AGENCIES) {
    if (k.agencies[def.id] || year() < def.founded) continue;
    const a = makeAgency(def);
    k.agencies[a.id] = a;
    // An established agency already has a group or two.
    if (year() - def.founded >= 3) for (let g = 0; g < (def.reputation >= 75 ? 2 : 1); g++) rivalGroup(a, year() - rng.int(1, Math.min(10, year() - def.founded)));
  }
  return k;
}
export const agencies = () => Object.values(world().agencies);
export const agency = (id) => world().agencies[id] ?? null;

function rivalGroup(a, debutYear) {
  const gender = rng.pick(['female', 'male']);
  const size = rng.int(4, 7);
  const members = Array.from({ length: size }, () => idolNpc(a.countryId === 'kr' ? rng.pick(['kr', 'kr', 'kr', 'jp', 'th', 'us', 'cn']) : rng.pick(['us', 'kr', 'ph', 'br']), { agencyId: a.id, gender, level: rng.int(60, 85), status: 'idol', age: rng.int(19, 27) }));
  const g = makeGroup({ agencyId: a.id, name: groupName(), members: members.map((n) => n.id), gender, concept: rng.pick(a.concepts), debutYear, npc: true });
  g.fandom.size = Math.round(10 ** rng.around(4.1 + a.reputation / 80, 0.5));
  g.fandom.core = Math.round(g.fandom.size * 0.12);
  return g;
}

const groupName = () => { const used = new Set(Object.values(K().groups).map((g) => g.name)); let n; let t = 0; do n = `${rng.pick(GROUP_WORDS)}${rng.chance(0.3) ? ` ${rng.pick(['X', '9', 'ONE', 'S', 'TEN'])}` : ''}`; while (used.has(n) && t++ < 50); return n; };
const songTitle = () => `${rng.pick(SONG_WORDS.a)} ${rng.pick(SONG_WORDS.b)}`;

// ---------- Auditions ----------

/** This year's audition calls: each agency's own, with its formats, ages, places and line-up. */
export function auditions() {
  if (!available()) return [];
  const k = world();
  const y = year();
  if (k.auditionYear !== y) {
    k.auditionYear = y;
    for (const [id, au] of Object.entries(k.auditions)) if (au.year < y - 3 && !Object.values(k.apps).some((x) => x.auditionId === id)) delete k.auditions[id];
    for (const a of Object.values(k.agencies).filter((x) => x.founded <= y)) {
      const formats = ['in_person', ...(era('online') ? ['online'] : []), ...(era('global') ? ['global_casting'] : [])];
      const format = a.global ? (era('online') ? 'online' : 'in_person') : rng.pick(formats);
      const au = { id: nextId('aud'), agencyId: a.id, year: y, format, closes: y, ages: a.global ? [15, 23] : [13, 21], lineup: rng.pick(['any', 'any', 'female', 'male']),
        places: format === 'in_person' ? [a.countryId] : 'worldwide', categories: rng.pick([['vocal', 'dance', 'rap', 'multi'], ['vocal', 'dance', 'multi'], ['multi']]).filter((c) => c !== 'rap' || a.rap),
        stages: ['application', 'callback', 'assessment', 'decision'], status: 'open', slots: rng.int(1, 4), needs: rng.pick([null, 'vocal', 'dance', ...(a.rap ? ['rap'] : [])]) };
      k.auditions[au.id] = au;
    }
  }
  return Object.values(k.auditions).filter((au) => au.year === y);
}

/** Why the player cannot apply to an audition, or ''. */
export function whyNotApply(au, p = player()) {
  const i = idolOf(p);
  if (!available()) return 'There is no idol industry yet.';
  if (au.status !== 'open' || au.year !== year()) return 'This call has closed.';
  if (p.age < au.ages[0] || p.age > au.ages[1]) return `This audition is for ages ${au.ages[0]} to ${au.ages[1]}.`;
  if (au.lineup !== 'any' && au.lineup !== p.gender) return `This audition is for a ${au.lineup === 'female' ? 'girl' : 'boy'} group project.`;
  if (au.places !== 'worldwide' && !au.places.includes(p.countryId)) return `This is an in-person audition in ${COUNTRIES[au.places[0]].name}.`;
  if (i.apps.some((id) => K().apps[id]?.auditionId === au.id)) return 'You have already applied to this one.';
  if (i.traineeId && K().contracts[i.traineeId]?.status === 'active') return 'You are already a trainee.';
  if (i.groupId && K().groups[i.groupId]?.status !== 'disbanded' && idolMember(p)) return 'You are already in a group.';
  if (i.acts.apps >= 3) return 'You have applied to three auditions this year; that is enough to prepare properly for.';
  if (p.legal.incarceration) return 'Not from a cell.';
  return '';
}
const idolMember = (p = player()) => { const g = K().groups[idolOf(p).groupId]; return g && g.members.some((m) => m.who === 'player' && m.to == null); };

/** Preparing an audition: a year's worth of practice for the tape. Once per audition. */
export function prepare(auditionId) {
  const i = idolOf();
  i.acts.did[`prep:${auditionId}`] = true;
  return result(true, 'You film the routine forty times, and the song more. It is as ready as it will be.', 'neutral');
}

/** Stage 1: submits an application in a category. It is screened at once. */
export function apply(auditionId, category) {
  const p = player();
  const k = world();
  const au = k.auditions[auditionId];
  if (!au) return result(false, 'No such audition.', 'neutral');
  const why = whyNotApply(au, p);
  if (why) return result(false, why, 'neutral');
  if (!au.categories.includes(category)) return result(false, 'That is not a category this audition takes.', 'neutral');
  const i = idolOf(p);
  i.acts.apps += 1;
  const app = { id: nextId('app'), auditionId, agencyId: au.agencyId, category, year: year(), prepared: !!i.acts.did[`prep:${auditionId}`], stage: 'submitted', scores: {}, outcome: null };
  k.apps[app.id] = app;
  i.apps.push(app.id);
  const s = auditionScore(app, 'application');
  app.scores.application = s.score;
  if (s.score < s.bar) { app.stage = 'rejected'; app.outcome = 'rejected at application'; note(`Applied to ${agency(au.agencyId).name}; not called back.`); return result(false, `${agency(au.agencyId).name} thanks you for applying. You are not being called back this time.`); }
  app.stage = 'callback';
  note(`Called back by ${agency(au.agencyId).name} after an audition tape.`);
  milestone(`Called back by ${agency(au.agencyId).name}.`, 'fame');
  return result(true, `A callback! ${agency(au.agencyId).name} wants to see you ${au.format === 'online' ? 'on a video call' : 'in person'}.`);
}

/** The score for a stage of an audition, against that agency's bar this year. Talent is not enough on its own. */
function auditionScore(app, stage) {
  const p = player();
  const a = agency(app.agencyId);
  const s = skillsOf();
  const by = { vocal: s.vocal, dance: s.dance, rap: s.rap, multi: (s.vocal + s.dance) / 2 * 0.8 + Math.max(s.rap, s.stage) * 0.2 }[app.category];
  const potential = clamp((22 - p.age) * 2, -6, 10); // agencies look for room to grow
  const coachable = ((p.hidden?.discipline ?? 50) - 50) / 10;
  const presence = stage === 'application' ? 0 : (s.stage + s.camera) / 2 * 0.2;
  const score = by * 0.75 + presence + potential + coachable + (app.prepared ? 4 : 0) + rng.around(0, 7);
  // What the company needs this year and how many are applying set the bar.
  const bar = { application: 40, callback: 50, assessment: 58 }[stage] + (a.reputation - 60) * 0.3 + (a.global ? 3 : 0) + rng.around(0, 4);
  return { score: Math.round(score), bar: Math.round(bar) };
}

/** Stages 2–4: attends the callback, then the live assessment and the company's decision. */
export function attendCallback(appId) {
  const p = player();
  const app = K().apps[appId];
  if (!app || app.stage !== 'callback') return result(false, 'There is no callback waiting.', 'neutral');
  const a = agency(app.agencyId);
  const c = auditionScore(app, 'callback');
  app.scores.callback = c.score;
  if (c.score < c.bar) { app.stage = 'rejected'; app.outcome = 'rejected after callback'; note(`Not taken forward by ${a.name} after the callback.`); return result(false, `The callback goes well enough, but ${a.name} does not take you forward.`); }
  const live = auditionScore(app, 'assessment');
  app.scores.assessment = live.score;
  const au = K().auditions[app.auditionId];
  // Passing is not a place: the company has a handful of places, and what it needs this year.
  const needed = !au?.needs || au.needs === app.category || app.category === 'multi';
  if (live.score >= live.bar && rng.chance(clamp(0.5 + (live.score - live.bar) / 40 - (needed ? 0 : 0.2) - (au?.slots === 1 ? 0.1 : 0), 0.2, 0.88))) {
    app.stage = 'offered';
    app.offer = traineeOffer(a);
    milestone(`Offered a trainee contract by ${a.name}.`, 'fame');
    note(`Offered a place as a trainee at ${a.name}.`);
    return result(true, `${a.name} offers you a place as a trainee.`);
  }
  // Close: held on file, or asked back next year.
  if (live.score >= live.bar - 6) { app.stage = 'held'; app.outcome = 'held for another opportunity'; note(`${a.name} kept your audition on file.`); return result(false, `${a.name} says you are close. They will keep your audition on file${au ? '' : ''} and may call you for another project.`, 'neutral'); }
  app.stage = 'rejected'; app.outcome = 'rejected after assessment';
  note(`Rejected by ${a.name} after the live assessment.`);
  return result(false, `${a.name} does not offer you a place this time. You can try again next year, or somewhere else.`);
}

/** The trainee agreement on offer: the agency's own terms (no debt by default). */
function traineeOffer(a) {
  const t = a.trainee;
  return { kind: 'trainee', agencyId: a.id, review: rng.int(t.review[0], t.review[1]), costs: t.costs, allowance: t.allowance, housing: t.housing,
    rules: ['Attend training and evaluations', 'Keep up schooling if under 18', ...(a.welfare < 55 ? ['Phones collected during training hours'] : []), 'Represent the agency respectfully'],
    exit: 'Either side may end the agreement at a review, or with notice; no training costs are charged back' };
}

/** Whether the player needs a guardian's agreement, and has it. Under-18s do. */
export function guardianOk(p = player()) { return p.age >= 18 || !!idolOf(p).guardianOk; }
/** Asks parents or guardians. They say yes more often when the agency treats trainees well, and the child is keeping up at school. */
export function askGuardian(appId) {
  const p = player();
  const app = K().apps[appId];
  if (!app?.offer) return result(false, 'There is no offer to ask about.', 'neutral');
  if (p.age >= 18) return result(true, 'You are an adult: the decision is yours.', 'neutral');
  const i = idolOf(p);
  if (i.guardianAsked === p.age) return result(false, 'You asked this year already.', 'neutral');
  i.guardianAsked = p.age;
  const a = agency(app.agencyId);
  const abroad = a.countryId !== p.countryId;
  const odds = clamp(0.55 + (a.welfare - 60) / 120 - (abroad ? 0.12 : 0) + ((p.education?.gpa ?? 3) - 2.5) / 10, 0.15, 0.95);
  if (rng.chance(odds)) { i.guardianOk = true; return result(true, abroad ? 'Your family talks about it all night. They will let you go, with a phone call every Sunday.' : 'Your family agrees, as long as school does not suffer.'); }
  return result(false, '"Not yet," they say. You can ask again next year.');
}

/** Accepts the trainee agreement: a saved contract, a trainee record, and a place to live. */
export function acceptOffer(appId) {
  const p = player();
  const k = K();
  const app = k.apps[appId];
  if (!app?.offer || app.stage !== 'offered') return result(false, 'That offer is not open.', 'neutral');
  if (!guardianOk(p)) return result(false, 'A parent or guardian has to agree first.', 'neutral');
  const a = agency(app.agencyId);
  // Training somewhere else needs permission to be there: the agency sponsors it, but a criminal record can stop it.
  const abroad = a.countryId !== p.countryId && !rightToLive(a.countryId, p);
  if (abroad && hasRecord(p, { sealed: true })) { app.stage = 'declined'; return result(false, `The trainee visa is refused because of your record. ${a.name} cannot take you.`); }
  const c = { id: nextId('ctr'), ...app.offer, who: 'player', start: year(), reviewAt: year() + app.offer.review, status: 'active', notes: [] };
  k.contracts[c.id] = c;
  app.stage = 'accepted';
  const i = idolOf(p);
  i.traineeId = c.id;
  i.contracts.push(c.id);
  i.trainee = { agencyId: a.id, since: year(), evals: [], rank: null, warned: 0 };
  i.residence = a.countryId !== p.countryId ? { countryId: a.countryId, city: a.city, visa: rightToLive(a.countryId, p) ? 'none needed' : 'trainee visa, sponsored by the agency', since: year() } : null;
  if (a.dorm && (c.housing === 'dorm')) a.dorm.residents.push('player');
  for (const id of a.trainees.slice(0, 4)) { const n = npc(id); if (n && !p.npcIds.includes(n.id)) { p.npcIds.push(n.id); n.role = 'colleague'; n.flags.title = `Trainee at ${a.name}`; n.lastInteractionAge = p.age; } }
  milestone(`Became a trainee at ${a.name}.`, 'career');
  note(`Signed a trainee agreement with ${a.name}${i.residence ? `, moving to ${a.city}` : ''}.`);
  return result(true, `You are a trainee at ${a.name}${i.residence ? `. You move into ${c.housing === 'dorm' ? 'the trainee dorm' : 'a room'} in ${a.city}` : ''}. Nobody has promised you a debut.`);
}
export function declineOffer(appId) { const app = K().apps[appId]; if (app?.stage === 'offered') { app.stage = 'declined'; note(`Turned down a trainee place at ${agency(app.agencyId).name}.`); } return result(true, 'You say no, for now.', 'neutral'); }

// ---------- Training ----------

export const trainee = (p = player()) => { const i = idolOf(p); const c = K().contracts[i.traineeId]; return c?.status === 'active' ? { contract: c, agency: agency(c.agencyId), info: i.trainee } : null; };
export function setFocus(id) { if (!FOCUSES[id]) return result(false, 'No such focus.', 'neutral'); idolOf().focus = id; return result(true, `Your focus this year: ${FOCUSES[id].name.toLowerCase()}.`, 'neutral'); }

/** Extra sessions in the year: practice, a word with a coach, time with another trainee. */
export function trainAction(kind, npcId = null) {
  const p = player();
  const t = trainee(p);
  const i = idolOf(p);
  if (!t && !idolMember(p)) return result(false, 'You are not training anywhere.', 'neutral');
  if (i.acts.sessions >= 4) return result(false, 'You have nothing left this year. Rest is part of training too.', 'neutral');
  i.acts.sessions += 1;
  const a = t?.agency ?? agency(K().groups[i.groupId]?.agencyId);
  if (kind === 'vocal' || kind === 'dance' || kind === 'rap' || kind === 'korean' || kind === 'media' || kind === 'stage') {
    raise('player', kind, 3 + (a?.training ?? 60) / 40);
    p.stats.health = clamp(p.stats.health - 1);
    return result(true, { vocal: 'An extra hour in the practice room with the piano.', dance: 'The mirror, the choreography, again and again.', rap: 'Verses in a notebook, then into the microphone.', korean: 'Flashcards on the bus.', media: 'Mock interviews with a manager pretending to be a host.', stage: 'A run-through on the small stage, with cameras.' }[kind], 'good');
  }
  if (kind === 'coach') { raise('player', rng.pick(['vocal', 'dance', 'stage']), 2); const c = npc(a.staff.vocal); if (c) c.meters.relationship = clamp(c.meters.relationship + 6); return result(true, 'Your coach tells you exactly what is holding you back. It stings, and it is useful.', 'neutral'); }
  if (kind === 'friend' || kind === 'help' || kind === 'support' || kind === 'resolve') {
    const n = npc(npcId);
    if (!n) return result(false, 'They are not here.', 'neutral');
    if (!p.npcIds.includes(n.id)) { p.npcIds.push(n.id); n.role = 'colleague'; n.flags.title = `Trainee at ${a?.name ?? 'the agency'}`; }
    n.meters.relationship = clamp(n.meters.relationship + { friend: 8, help: 5, support: 10, resolve: 12 }[kind]);
    n.lastInteractionAge = p.age;
    if (kind === 'help') raise('player', rng.pick(['vocal', 'dance']), 1.5);
    if (kind === 'support') raise(n.id, 'stage', 2);
    return result(true, { friend: `You and ${n.firstName} end up talking until the practice room closes.`, help: `${n.firstName} shows you the step you keep missing.`, support: `${n.firstName} was shaking before the evaluation. You stayed with them. They will not forget it.`, resolve: `You and ${n.firstName} clear the air. Competing for the same place does not have to mean anything else.` }[kind]);
  }
  return result(false, 'Not something you can do.', 'neutral');
}

/** Asks for rest or a lighter schedule. A good agency says yes; none punishes the asking. */
export function requestRest() {
  const p = player();
  const i = idolOf(p);
  const a = trainee(p)?.agency ?? agency(K().groups[i.groupId]?.agencyId);
  if (!a) return result(false, 'There is no one to ask.', 'neutral');
  if (i.acts.did.rest) return result(false, 'You asked this year already.', 'neutral');
  i.acts.did.rest = true;
  const yes = rng.chance(clamp(0.35 + a.welfare / 120, 0.3, 0.95));
  i.lighter = yes ? p.age : null;
  if (yes) { p.stats.health = clamp(p.stats.health + 6); p.stats.mood = clamp((p.stats.mood ?? 50) + 6); }
  return result(true, yes ? 'Your manager moves things around. A lighter year: you will sleep.' : 'Your manager listens, says the schedule is fixed, and promises to raise it. Nothing is held against you for asking.', yes ? 'good' : 'neutral');
}

/** Leaves the trainee program: notice is given; nothing is charged back. */
export function leaveTraining() {
  const p = player();
  const t = trainee(p);
  if (!t) return result(false, 'You are not a trainee.', 'neutral');
  t.contract.status = 'ended';
  t.contract.ended = { year: year(), by: 'trainee', how: 'notice' };
  endTraineeLife(p, t.agency, 'left');
  note(`Left the trainee program at ${t.agency.name}.`);
  return result(true, `You give notice and leave ${t.agency.name}. The friends come with you; the schedule does not.`, 'neutral');
}
function endTraineeLife(p, a, how) {
  const i = idolOf(p);
  if (a?.dorm) a.dorm.residents = a.dorm.residents.filter((x) => x !== 'player');
  if (i.trainee) i.trainee.ended = { year: year(), how };
  i.traineeId = null;
  i.residence = null;
}

// ---------- Evaluations ----------

const FEEDBACK = {
  vocal: ['Your breath support is not there yet on the high notes.', 'The tone is lovely; stability under choreography is the work now.'],
  dance: ['You are a beat behind on the transitions.', 'Clean lines. Now make it look effortless.'],
  rap: ['The flow is there; the delivery needs more confidence.', 'Your verses are sharp. Breath control on the fast parts.'],
  stage: ['You disappear when you are not singing. Stay in the performance.', 'You own the stage. Keep it.'],
  camera: ['Find the camera. It is looking for you.', 'The camera likes you; trust it.'],
};

/** A trainee's year-end evaluation, kept on the record. */
function evaluate(a, who, roster) {
  const s = skillsOf(who);
  const growth = who === 'player' ? (idolOf().trainee?.lastReadiness != null ? readiness('player') - idolOf().trainee.lastReadiness : 0) : rng.int(0, 6);
  const team = who === 'player' ? Math.round(roster.filter((x) => x !== 'player').map((id) => npc(id)?.meters.relationship ?? 50).reduce((x, y) => x + y, 0) / Math.max(1, roster.length - 1)) : rng.int(40, 70);
  const scores = { vocal: s.vocal, dance: s.dance, rap: s.rap, stage: s.stage, camera: s.camera, team, growth: clamp(50 + growth * 5), readiness: readiness(who) };
  const total = scores.readiness * 0.6 + scores.growth * 0.15 + team * 0.1 + rng.around(0, 6) + (a.concepts.includes('powerful') ? s.dance * 0.05 : s.vocal * 0.05);
  return { scores, total: Math.round(total) };
}

function evaluateAgency(a) {
  const p = player();
  const t = trainee(p);
  const mine = t?.agency.id === a.id;
  const roster = [...a.trainees.filter((id) => npc(id)?.alive !== false && npc(id)?.flags.idol?.status === 'trainee'), ...(mine ? ['player'] : [])];
  const results = roster.map((who) => ({ who, ...evaluate(a, who, roster) })).sort((x, y) => y.total - x.total);
  results.forEach((r, idx) => { r.rank = idx + 1; });
  for (const r of results) if (r.who !== 'player') { const n = npc(r.who); n.flags.idol.lastRank = r.rank; n.flags.idol.evalTotal = r.total; }
  if (!mine) return null;
  const me = results.find((r) => r.who === 'player');
  const i = idolOf(p);
  const pct = me.rank / results.length;
  const s = me.scores;
  const weakest = ['vocal', 'dance', 'stage', 'camera', ...(a.rap ? ['rap'] : [])].sort((x, y) => s[x] - s[y])[0];
  const strongest = ['vocal', 'dance', 'stage', 'camera', ...(a.rap ? ['rap'] : [])].sort((x, y) => s[y] - s[x])[0];
  const outcome = pct <= 0.15 && s.readiness >= 66 ? 'Considered for debut' : pct <= 0.35 ? (s.readiness >= 60 ? 'Ready for advanced assessment' : 'Excellent progress') : s.growth >= 55 ? 'Improving' : pct >= 0.8 && s.growth < 50 ? 'At risk of release' : 'Needs development';
  const ev = { id: nextId('eval'), agencyId: a.id, year: year() - 1, who: 'player', evaluators: [a.staff.director, a.staff.vocal, a.staff.dance], scores: s, rank: me.rank, of: results.length,
    feedback: [FEEDBACK[weakest][0], FEEDBACK[strongest][1]], outcome };
  K().evals[ev.id] = ev;
  i.trainee.evals.push(ev.id);
  i.trainee.rank = me.rank;
  i.trainee.lastReadiness = s.readiness;
  if (outcome === 'At risk of release') i.trainee.warned = (i.trainee.warned ?? 0) + 1;
  else if (['Excellent progress', 'Ready for advanced assessment', 'Considered for debut', 'Improving'].includes(outcome)) i.trainee.warned = 0;
  return ev;
}

// ---------- Debut projects ----------

/** Puts together a debut line-up from the agency's actual trainees: balance, readiness, chemistry, the concept. */
function debutProject(a, o = {}) {
  const k = K();
  const p = player();
  const gender = o.gender ?? rng.pick(['female', 'male']);
  const size = o.size ?? rng.int(4, 7);
  const concept = o.concept ?? rng.pick(a.concepts);
  const t = trainee(p);
  const pool = a.trainees.filter((id) => npc(id)?.alive !== false && npc(id)?.flags.idol?.status === 'trainee' && npc(id).gender === gender && (year() - npc(id).flags.idol.born.year) >= 15);
  const cands = [...pool, ...(t?.agency.id === a.id && p.gender === gender && p.age >= 15 ? ['player'] : [])];
  if (cands.length < size) return null;
  const score = (who) => readiness(who) * 0.7 + (who === 'player' ? (K().evals[idolOf().trainee.evals.at(-1)]?.scores.growth ?? 50) : npc(who).flags.idol.evalTotal ?? 50) * 0.2 + rng.around(0, 5);
  // A line-up needs voices and dancers: the best of each first, then the best of the rest.
  const ranked = [...cands].sort((x, y) => score(y) - score(x));
  const pick = new Set([[...cands].sort((x, y) => skillsOf(y).vocal - skillsOf(x).vocal)[0], [...cands].sort((x, y) => skillsOf(y).dance - skillsOf(x).dance)[0]]);
  for (const who of ranked) { if (pick.size >= size) break; pick.add(who); }
  const pr = { id: nextId('proj'), agencyId: a.id, year: year(), gender, size, concept, lineup: [...pick], status: 'announced', groupId: null, via: o.via ?? 'agency' };
  for (const w of pr.lineup) if (w !== 'player') npc(w).flags.idol.status = 'selected'; // chosen: waiting to debut
  k.projects[pr.id] = pr;
  a.lastProject = year();
  return pr;
}

/** The player's answer to a debut line-up they are in. */
export function debutOffer(p = player()) { const id = idolOf(p).debutOffer; return id ? K().projects[id] : null; }
export function acceptDebut() {
  const p = player();
  const pr = debutOffer(p);
  if (!pr) return result(false, 'There is no debut offer.', 'neutral');
  const a = agency(pr.agencyId);
  pr.lineup = pr.lineup.filter((w) => w === 'player' || npc(w)?.alive !== false && npc(w));
  if (pr.lineup.length < 3) { idolOf(p).debutOffer = null; pr.status = 'lapsed'; return result(false, 'The project has fallen apart: too many of the line-up have gone.', 'neutral'); }
  const g = makeGroup({ agencyId: a.id, name: groupName(), members: pr.lineup, gender: pr.gender, concept: pr.concept, projectId: pr.id, debutYear: null, npc: false });
  pr.groupId = g.id; pr.status = 'formed';
  idolOf(p).debutOffer = null;
  // The trainee agreement ends; an exclusive artist agreement begins, on the agency's own terms.
  const tc = K().contracts[idolOf(p).traineeId];
  if (tc) { tc.status = 'completed'; tc.ended = { year: year(), how: 'debut' }; }
  for (const who of g.members.map((m) => m.who)) signArtist(g, who);
  const i = idolOf(p);
  i.groupId = g.id;
  i.groups.push(g.id);
  i.traineeId = null;
  if (i.trainee) i.trainee.ended = { year: year(), how: 'chosen to debut' };
  for (const m of g.members) if (m.who !== 'player') { const n = npc(m.who); n.flags.idol.status = 'idol'; n.flags.idol.groupId = g.id; if (!p.npcIds.includes(n.id)) p.npcIds.push(n.id); n.role = 'colleague'; n.flags.title = `In ${g.name} with you`; n.lastInteractionAge = p.age; }
  milestone(`Chosen to debut in ${g.name}.`, 'fame');
  note(`Chosen for the debut line-up of ${g.name} at ${a.name}.`);
  return result(true, `You are in ${g.name}: ${g.members.length} members. ${positionsLine(g, 'player')}`);
}
export function declineDebut() {
  const p = player();
  const pr = debutOffer(p);
  if (!pr) return result(false, 'There is no debut offer.', 'neutral');
  pr.lineup = pr.lineup.filter((w) => w !== 'player');
  pr.declined = 'player';
  idolOf(p).debutOffer = null;
  note('Turned down a place in a debut line-up.');
  return result(true, 'You say no. It is your life; the agency will debut the group without you.', 'neutral');
}

// ---------- Survival programs ----------

/** This year's survival programs: made once each year a format runs, with real contestants. */
export function programs() {
  const k = world();
  const y = year();
  if (!era('survival')) return [];
  for (const f of SURVIVAL_FORMATS) {
    if (y < f.from || !k.agencies[f.agency]) continue;
    const key = `${f.id}:${y}`;
    if (Object.values(k.programs).some((x) => x.key === key)) continue;
    if ((y - f.from) % 2 !== 0) continue; // a season every other year
    const a = k.agencies[f.agency];
    k.programs[nextId('show')] = { key, formatId: f.id, name: f.name, season: Math.floor((y - f.from) / 2) + 1, agencyId: a.id, year: y, location: f.location, voting: f.voting, judgeWeight: f.judgeWeight,
      slots: f.slots, size: f.contestants, gender: rng.pick(['female', 'male']), global: !!f.global, judges: [a.staff.director, a.staff.vocal, a.staff.dance], status: 'casting', contestants: [], mission: 0, log: [] };
    const pr = Object.entries(k.programs).find(([, x]) => x.key === key);
    pr[1].id = pr[0];
  }
  return Object.values(k.programs).filter((x) => x.year === y);
}

export function whyNotEnter(pr, p = player()) {
  if (pr.status !== 'casting') return 'The cast is set.';
  if (p.gender !== pr.gender) return `This season is for a ${pr.gender === 'female' ? 'girl' : 'boy'} group.`;
  if (p.age < 15 || p.age > 24) return 'Contestants are 15 to 24.';
  if (!pr.global && !['kr'].includes(p.countryId) && !(trainee(p)?.agency.id === pr.agencyId)) return 'This program casts in Korea, or from the company\'s own trainees.';
  if (idolMember(p)) return 'You are already in a group.';
  if (pr.contestants.some((c) => c.who === 'player')) return 'You are in it.';
  if (trainee(p) && trainee(p).agency.id !== pr.agencyId && !trainee(p).agency.global) return `${trainee(p).agency.name} would have to let you appear.`;
  return '';
}

/** Applies to a program: the producers cast on skill, story and the camera. */
export function enterProgram(programId) {
  const p = player();
  const pr = K().programs[programId];
  if (!pr) return result(false, 'No such program.', 'neutral');
  const why = whyNotEnter(pr, p);
  if (why) return result(false, why, 'neutral');
  const s = skillsOf();
  const odds = clamp((readiness('player') - 40) / 35 + s.camera / 300 + (trainee(p)?.agency.id === pr.agencyId ? 0.3 : 0), 0.05, 0.9);
  idolOf(p).programs.push(programId);
  if (!rng.chance(odds)) { pr.rejected ??= []; pr.rejected.push('player'); note(`Applied to ${pr.name}; not cast.`); return result(false, `${pr.name} does not cast you this season.`); }
  cast(pr, true);
  milestone(`Cast in ${pr.name}.`, 'fame');
  note(`Cast as a contestant in ${pr.name}.`);
  return result(true, `You are one of ${pr.size} contestants in ${pr.name}. The rules are set before the first episode: ${votingLine(pr)}.`);
}
export const votingLine = (pr) => ({ judge: 'the judges decide', fan: 'the fans\' votes decide', mixed: 'judges and fans together', hybrid: 'fans, judges and producers' }[pr.voting]) + ` (${Math.round(pr.judgeWeight * 100)}% judges); ${pr.slots} debut`;

/** Fills a cast with real people: the agency's own trainees first, then hopefuls from everywhere. */
function cast(pr, withPlayer) {
  const a = agency(pr.agencyId);
  if (pr.contestants.length) { if (withPlayer && !pr.contestants.some((c) => c.who === 'player')) pr.contestants.push({ who: 'player', out: null, scores: [], ranks: [] }); return; }
  const own = a.trainees.filter((id) => npc(id)?.flags.idol?.status === 'trainee' && npc(id).gender === pr.gender).slice(0, Math.floor(pr.size / 3));
  const places = pr.global ? ['us', 'kr', 'jp', 'ph', 'th', 'br', 'mx', 'ca', 'au', 'gb', 'fr', 'de', 'in', 'za'].filter((c) => COUNTRIES[c]) : ['kr', 'kr', 'kr', 'jp', 'cn', 'th'];
  const others = Array.from({ length: pr.size - own.length - (withPlayer ? 1 : 0) }, () => idolNpc(rng.pick(places), { gender: pr.gender, level: rng.int(45, 80), status: 'trainee' }).id);
  pr.contestants = [...own, ...others].map((who) => ({ who, out: null, scores: [], ranks: [] }));
  if (withPlayer) pr.contestants.push({ who: 'player', out: null, scores: [], ranks: [] });
  pr.status = 'airing';
}

/** The next mission: everyone performs, the rules rank them, and the cut (if any) is made. The player chooses an approach. */
export function playMission(programId, approach = 'steady') {
  const p = player();
  const pr = K().programs[programId];
  if (!pr || pr.status !== 'airing') return result(false, 'There is no mission waiting.', 'neutral');
  const m = MISSIONS[pr.mission];
  if (!m) return result(false, 'The season is over.', 'neutral');
  const ap = APPROACHES[approach] ?? APPROACHES.steady;
  const alive = pr.contestants.filter((c) => !c.out);
  const teamBoost = alive.some((c) => c.who === 'player') && ap.team ? ap.team : 0;
  for (const c of alive) {
    const s = skillsOf(c.who);
    const base = Object.entries(m.uses).reduce((t, [k2, w]) => t + (k2 === 'team' ? 60 + (c.who === 'player' ? ap.team : rng.int(-5, 8)) : s[k2]) * w, 0);
    const mine = c.who === 'player';
    const perf = base + (mine ? ap.bonus + rng.around(0, ap.spread) : rng.around(0, 8)) + (m.id === 'group' && !mine ? teamBoost / 3 : 0);
    // Fans follow the camera and the story as much as the stage.
    const fans = perf * 0.6 + s.camera * 0.3 + (c.scores.length ? c.scores.at(-1).fans * 0.1 : 0) + rng.around(0, 10);
    c.scores.push({ mission: m.id, judge: Math.round(perf), fans: Math.round(fans) });
  }
  // The ranking, by the season's own rules (fixed when it began).
  const total = (c) => { const last = c.scores.at(-1); const avgJ = c.scores.reduce((t, x) => t + x.judge, 0) / c.scores.length; return (last.judge * 0.6 + avgJ * 0.4) * pr.judgeWeight + last.fans * (1 - pr.judgeWeight); };
  const order = [...alive].sort((x, y) => total(y) - total(x));
  order.forEach((c, idx) => c.ranks.push(idx + 1));
  let text = `${m.name}: you finished ${order.findIndex((c) => c.who === 'player') + 1} of ${order.length}.`;
  if (m.cutTo === 'final') {
    const chosen = order.slice(0, pr.slots);
    for (const c of order) c.out = chosen.includes(c) ? 'debut' : 'finalist';
    pr.status = 'finished';
    pr.final = chosen.map((c) => c.who);
    finishProgram(pr);
    text += pr.final.includes('player') ? ' You are in the debut line-up.' : ' You are not in the final line-up.';
  } else if (m.cutTo) {
    const keep = Math.max(pr.slots + 2, Math.round(alive.length * m.cutTo));
    for (const c of order.slice(keep)) c.out = `eliminated after the ${m.name.toLowerCase()}`;
    if (order.slice(keep).some((c) => c.who === 'player')) text += ' You are eliminated.';
    else text += ` ${order.length - keep} contestants go home.`;
  }
  pr.mission += 1;
  pr.log.push({ mission: m.id, order: order.map((c) => c.who) });
  const me = pr.contestants.find((c) => c.who === 'player');
  if (me?.out && me.out !== 'debut') { note(`${pr.name}: ${me.out === 'finalist' ? 'reached the final, not chosen' : me.out}.`); for (const c of pr.contestants.filter((x) => x.who !== 'player').slice(0, 3)) { const n = npc(c.who); if (n && !p.npcIds.includes(n.id)) { p.npcIds.push(n.id); n.role = 'friend'; n.flags.title = `Met on ${pr.name}`; } } }
  if (me) gain({ audience: 'music', amount: 1.5 + (me.out === 'debut' ? 4 : 0), why: pr.name }, p);
  return result(!me?.out || me.out === 'debut', text, me?.out && me.out !== 'debut' ? 'bad' : 'neutral');
}

function finishProgram(pr) {
  const a = agency(pr.agencyId);
  const p = player();
  const proj = { id: nextId('proj'), agencyId: a.id, year: year(), gender: pr.gender, size: pr.final.length, concept: rng.pick(a.concepts), lineup: pr.final, status: 'announced', via: pr.id };
  K().projects[proj.id] = proj;
  for (const c of pr.contestants) if (c.who !== 'player' && npc(c.who)) { const n = npc(c.who); n.flags.idol.status = c.out === 'debut' ? 'trainee' : 'eliminated'; n.flags.idol.history.push({ year: year(), text: `${pr.name}: ${c.out}` }); if (c.out === 'debut' && !a.trainees.includes(c.who)) a.trainees.push(c.who); }
  if (pr.final.includes('player')) { idolOf(p).debutOffer = proj.id; milestone(`Chosen for the debut line-up on ${pr.name}.`, 'fame'); }
  else formNpcGroup(proj);
}
function formNpcGroup(proj) {
  const a = agency(proj.agencyId);
  const members = proj.lineup.filter((w) => w !== 'player' && npc(w));
  if (members.length < 3) return null;
  const g = makeGroup({ agencyId: a.id, name: groupName(), members, gender: proj.gender, concept: proj.concept, projectId: proj.id, debutYear: year(), npc: true });
  g.fandom.size = Math.round(10 ** rng.around(3.6 + a.reputation / 70, 0.4));
  g.fandom.core = Math.round(g.fandom.size * 0.12);
  for (const w of members) { const n = npc(w); n.flags.idol.status = 'idol'; n.flags.idol.groupId = g.id; }
  proj.groupId = g.id; proj.status = 'formed';
  return g;
}

// ---------- Groups ----------

export const group = (id) => K().groups[id] ?? null;
export const current = (g, y = year()) => g.members.filter((m) => m.from <= y && (m.to == null || m.to >= y) && m.to !== y);
export const myGroup = (p = player()) => (idolMember(p) ? group(idolOf(p).groupId) : null);

function makeGroup(o) {
  const a = agency(o.agencyId);
  const g = { id: nextId('grp'), name: o.name, agencyId: a.id, projectId: o.projectId ?? null, formed: year(), gender: o.gender, market: a.global ? 'global' : 'kr', concept: o.concept, npc: !!o.npc,
    debut: o.debutYear ? { year: o.debutYear } : null, members: o.members.map((who) => ({ who, from: year(), to: null })), status: o.debutYear ? 'active' : 'preparing',
    fandom: { name: null, size: 0, core: 0, regions: {}, engagement: 50, history: [] }, releases: [], performances: [], wins: [], tours: [], awards: [], positions: {}, positionHistory: [],
    config: { none: rng.chance(0.08), leader: rng.chance(0.9), visual: rng.chance(0.6), center: rng.chance(0.5) }, ledger: { revenue: 0, costs: 0, unrecouped: 0, years: {} }, hiatus: null, history: [] };
  K().groups[g.id] = g;
  a.groups.push(g.id);
  assignPositions(g, 'formation');
  g.history.push({ year: year(), text: `${g.name} was formed at ${a.name}.` });
  return g;
}

/** The exclusive artist agreement each member signs at debut: the agency's own term and share. */
function signArtist(g, who) {
  const a = agency(g.agencyId);
  const c = { id: nextId('ctr'), kind: 'exclusive', agencyId: a.id, who, groupId: g.id, start: year(), years: a.artist.years, ends: year() + a.artist.years, artistShare: a.artist.artistShare,
    soloAllowed: a.artist.soloAllowed, obligations: ['Group activities as scheduled', 'Promotion of releases'], agencyDuties: ['Training, production and promotion', 'Settlement of earnings each year'], status: 'active' };
  K().contracts[c.id] = c;
  if (who === 'player') idolOf().contracts.push(c.id);
  return c;
}
export const contractOf = (who, g) => Object.values(K().contracts).find((c) => c.kind === 'exclusive' && c.who === who && c.groupId === g.id && c.status === 'active') ?? null;

// ---------- Positions: one primary, at most one secondary, no contradictions ----------

const RANK_WEIGHT = { main: 3, lead: 2, sub: 1 };
/** Whether a member's labels are a valid set: at most two; one rank per specialty; Visual and Center not together. */
export function validLabels(labels) {
  if (labels.length > MAX_POSITIONS) return false;
  const specs = labels.map((l) => POSITIONS[l]).filter((x) => x?.rank).map((x) => x.specialty);
  if (new Set(specs).size !== specs.length) return false;
  if (labels.includes('visual') && labels.includes('center')) return false;
  return labels.every((l) => POSITIONS[l]);
}

/** The youngest current member, from birth dates (ties go to the later id, consistently). */
export function maknaeOf(g) {
  const cur = current(g);
  return cur.length ? [...cur].sort((x, y) => bornKey(y.who) - bornKey(x.who) || String(y.who).localeCompare(String(x.who)))[0].who : null;
}

/** Leadership: communication, media training, how much the others trust them, reliability. Not age. */
function leaderScore(who, cur) {
  const s = skillsOf(who);
  const trust = who === 'player' ? cur.filter((m) => m.who !== 'player').reduce((t, m) => t + (npc(m.who)?.meters.relationship ?? 50), 0) / Math.max(1, cur.length - 1) : 45 + rng.int(0, 25);
  const reliable = who === 'player' ? player().hidden?.discipline ?? 50 : 50 + rng.int(-10, 15);
  return s.media * 0.4 + trust * 0.3 + reliable * 0.2 + rng.around(0, 4);
}

/**
 * Assigns the group's official positions. Underlying skills are never changed; a member may be good at far
 * more than their one or two titles say. Records the change in the position history.
 */
export function assignPositions(g, reason = 'review') {
  const cur = current(g);
  const ids = cur.map((m) => m.who);
  const S = Object.fromEntries(ids.map((w) => [w, skillsOf(w)]));
  const labels = Object.fromEntries(ids.map((w) => [w, []]));
  const cands = Object.fromEntries(ids.map((w) => [w, []]));
  const maknae = maknaeOf(g);
  if (maknae) labels[maknae].push('maknae');
  if (!g.config.none) {
    if (g.config.leader && ids.length > 1) {
      const kept = g.leader && ids.includes(g.leader) ? g.leader : [...ids].sort((x, y) => leaderScore(y, cur) - leaderScore(x, cur))[0];
      g.leader = kept;
      if (labels[kept].length < MAX_POSITIONS) labels[kept].push('leader');
    } else g.leader = null;
    // Specialty ranks: one rank per specialty per member; two mains where the line-up genuinely has two.
    const spec = (key, min, prefix, withSub) => {
      const order = [...ids].sort((x, y) => S[y][key] - S[x][key]);
      const two = order.length >= 6 && S[order[1]][key] >= 78 && S[order[0]][key] - S[order[1]][key] <= 3;
      order.forEach((w, idx) => {
        const v = S[w][key];
        if (idx < (two ? 2 : 1) && v >= min) cands[w].push([`main_${prefix}`, RANK_WEIGHT.main + v / 100]);
        else if (idx < (two ? 4 : 3) && v >= min - 8) cands[w].push([`lead_${prefix}`, RANK_WEIGHT.lead + v / 100]);
        else if (withSub && v >= min - 20) cands[w].push([`sub_${prefix}`, RANK_WEIGHT.sub + v / 100]);
      });
    };
    spec('vocal', 62, 'vocal', true);
    spec('dance', 62, 'dancer', false);
    for (const w of ids) for (const c of cands[w]) if (c[0] === 'main_dancer' || c[0] === 'lead_dancer') c[0] = c[0] === 'main_dancer' ? 'main_dancer' : 'lead_dancer';
    if (agency(g.agencyId).rap || ['dark', 'powerful', 'experimental', 'rnb'].includes(g.concept)) spec('rap', 58, 'rapper', true);
    for (const w of ids) { const s = S[w]; if (s.vocal >= 72 && s.dance >= 72 && (s.rap >= 62 || s.stage >= 72)) cands[w].push(['all_rounder', 2.4 + (s.vocal + s.dance) / 400]); }
    if (g.config.visual) { const v = [...ids].sort((x, y) => S[y].camera - S[x].camera)[0]; cands[v].push(['visual', 2.2]); }
    if (g.config.center) { const c = [...ids].sort((x, y) => S[y].stage - S[x].stage).find((w) => !cands[w].some((z) => z[0] === 'visual')); if (c) cands[c].push(['center', 2.3]); }
    // Each member takes their strongest candidates that fit: two labels at most, nothing contradictory.
    for (const w of ids) {
      for (const [l] of cands[w].sort((x, y) => y[1] - x[1])) {
        if (labels[w].length >= MAX_POSITIONS) break;
        const next = [...labels[w], l];
        if (validLabels(next)) labels[w] = next;
      }
    }
    // The group needs someone credited with its voice and its dance: the best with room takes it.
    for (const [key, main] of [['vocal', 'main_vocal'], ['dance', 'main_dancer']]) {
      const spc = key === 'vocal' ? 'vocal' : 'dance';
      if (ids.some((w) => labels[w].some((l) => POSITIONS[l].specialty === spc && POSITIONS[l].rank !== 'sub'))) continue;
      const w = [...ids].sort((x, y) => S[y][key] - S[x][key]).find((x) => labels[x].length < MAX_POSITIONS && validLabels([...labels[x], main]));
      if (w && S[w][key] >= 50) labels[w].push(main);
    }
    // Everyone has a primary position.
    for (const w of ids) if (!labels[w].length) labels[w].push(S[w].rap > S[w].vocal + 10 && cands[w].some((c) => c[0].endsWith('rapper')) ? 'sub_rapper' : 'sub_vocal');
  }
  // Order: the primary first (a specialty or responsibility before the derived maknae label, unless it is all there is).
  for (const w of ids) labels[w].sort((x, y) => (x === 'maknae' ? 1 : 0) - (y === 'maknae' ? 1 : 0));
  const before = JSON.stringify(g.positions);
  g.positions = labels;
  if (JSON.stringify(labels) !== before) g.positionHistory.push({ year: year(), reason, positions: JSON.parse(JSON.stringify(labels)), maknae, leader: g.leader });
  return labels;
}
export const labelsOf = (g, who) => g.positions[who] ?? [];
export const positionsLine = (g, who) => { const l = labelsOf(g, who); return l.length ? `${who === 'player' ? 'You are' : `${full(who)} is`} ${l.map((x) => POSITIONS[x].name).join(' · ')}.` : ''; };

/** A member leaves the line-up: the history keeps them; the current positions (and maknae) are worked out again. */
function memberLeaves(g, who, why) {
  const m = g.members.find((x) => x.who === who && x.to == null);
  if (!m) return;
  m.to = year();
  m.why = why;
  if (g.leader === who) g.leader = null;
  g.history.push({ year: year(), text: `${full(who)} left ${g.name} (${why}).` });
  assignPositions(g, `${full(who)} left`);
}

// ---------- Releases and line distribution ----------

/** Who sings, raps and dances what in a song, from the positions and the skills. */
function partsFor(g, ids) {
  const parts = {};
  const S = Object.fromEntries(ids.map((w) => [w, skillsOf(w)]));
  let total = 0;
  for (const w of ids) {
    const l = labelsOf(g, w);
    const vocalW = l.includes('lead_vocal') ? 3.4 : l.includes('main_vocal') ? 3 : l.includes('sub_vocal') ? 1.6 : 1 + S[w].vocal / 100;
    const rapW = l.includes('main_rapper') ? 2.6 : l.includes('lead_rapper') ? 2 : l.includes('sub_rapper') ? 1.2 : 0;
    const w2 = vocalW + rapW + (l.includes('center') ? 0.5 : 0);
    parts[w] = { weight: w2, rap: rapW > 0, climax: false, danceBreak: false, center: false };
    total += w2;
  }
  for (const w of ids) parts[w].share = Math.round(parts[w].weight / total * 100);
  const byVocal = [...ids].sort((x, y) => S[y].vocal - S[x].vocal);
  const climax = byVocal.find((w) => labelsOf(g, w).includes('main_vocal')) ?? byVocal[0];
  parts[climax].climax = true;
  const breaker = [...ids].sort((x, y) => S[y].dance - S[x].dance).find((w) => labelsOf(g, w).includes('main_dancer')) ?? [...ids].sort((x, y) => S[y].dance - S[x].dance)[0];
  parts[breaker].danceBreak = true;
  const centre = ids.find((w) => labelsOf(g, w).includes('center')) ?? rng.pick(ids);
  parts[centre].center = true;
  for (const w of ids) delete parts[w].weight;
  return parts;
}

/** Makes a release: songs with their parts, a music video, and its quality. Reception is decided at promotion. */
function makeRelease(g, kind, concept, o = {}) {
  const a = agency(g.agencyId);
  const ids = current(g).map((m) => m.who).filter((w) => !(o.without ?? []).includes(w));
  const songs = Array.from({ length: RELEASE_KINDS[kind].songs }, (_, idx) => ({ title: idx === 0 && o.title ? o.title : songTitle(), title_track: idx === 0, parts: partsFor(g, ids) }));
  const avg = ids.reduce((t, w) => t + readiness(w), 0) / Math.max(1, ids.length);
  const fit = a.concepts.includes(concept) ? 6 : 0;
  const writing = o.lyrics ? clamp(levelOf('writing') / 10, 0, 8) : 0;
  const r = { id: nextId('rel'), groupId: g.id, solo: o.solo ?? null, kind, title: songs[0].title, year: year(), concept, songs, mv: true, credits: { lyrics: o.lyrics ? ['player'] : [], producer: a.staff.producer },
    performers: ids, quality: Math.round(clamp(avg * 0.55 + a.training * 0.3 + fit + writing + rng.around(0, 8))), cost: RELEASE_KINDS[kind].cost, units: null, chartPeak: null, wins: [], paid: false };
  K().releases[r.id] = r;
  g.releases.push(r.id);
  return r;
}

/** How the release does: digital and physical sales, buzz, chart peak. Not every release is a hit. */
function receive(r, g) {
  const fans = g.fandom;
  const q = r.quality;
  const buzz = (fans.size ** 0.5) * (0.5 + fans.engagement / 100);
  const push = (agency(g.agencyId)?.reputation ?? 60) ** 2 * 4; // the agency's promotion: playlists, advertising, broadcast slots
  r.units = { digital: Math.round((fans.size * 0.4 + (q - 35) ** 2 * 12 + push) * rng.around(1, 0.35)), physical: Math.round((fans.core * 0.9 + fans.size * 0.05) * rng.around(1, 0.25)), social: Math.round(buzz * rng.around(1, 0.4)) };
  r.chartPeak = Math.max(1, Math.round(120 - Math.log10(r.units.digital + 10) * 22 + rng.around(0, 8)));
  r.reception = r.chartPeak <= 10 ? 'a hit' : r.chartPeak <= 40 ? 'did well' : q >= 70 && r.chartPeak > 40 ? 'loved by critics, slow to find listeners' : 'performed modestly';
  return r;
}

// ---------- Promotion: music shows, wins, ending fairies ----------

/** Rival groups release music too, every year: the competition on the shows. */
function rivalReleases() {
  const k = K();
  if (k.rivalYear === year()) return;
  k.rivalYear = year();
  for (const g of Object.values(k.groups).filter((x) => x.npc && x.status === 'active')) {
    if (!rng.chance(0.75)) continue;
    const r = makeRelease(g, rng.pick(['digital_single', 'mini', 'mini', 'full']), g.concept);
    r.songs = [{ title: r.title, title_track: true }]; // a rival's record: the title is enough
    receive(r, g);
    g.fandom.size = Math.round(g.fandom.size * rng.around(1.08, 0.08));
    g.fandom.core = Math.round(g.fandom.size * 0.12);
  }
}

/** A release's score on one show, by that show's own weighting. */
function showScore(r, g, show, week) {
  const w = show.weights;
  const n = (x, scale) => Math.min(100, Math.log10(1 + x) * scale);
  const decay = 1 - (week - 1) * 0.12;
  return Math.round((n(r.units.digital, 18) * w.digital + n(r.units.physical, 20) * w.physical + 70 * w.broadcast + n(r.units.social, 30) * w.social + n(g.fandom.core * (0.5 + g.fandom.engagement / 100), 22) * w.vote) * decay * rng.around(1, 0.06));
}

/** Who gets the last close-up: the director's plan, the concept, a rotation; never automatically the center. */
function pickFairy(g, ids, recent) {
  const weights = ids.map((w) => ({ w, k: (recent[w] ?? 0) >= (w === 'player' ? 1 : 2) ? 0 : (skillsOf(w).camera / 40 + 0.5) / (1 + (recent[w] ?? 0) * 2) }));
  if (weights.every((x) => !x.k)) return rng.pick(ids);
  return rng.weighted(weights, (x) => x.k).w;
}

/** A promotion cycle: weeks on the shows, the performances, any wins, and who ends each stage. */
function promote(r, g) {
  const k = K();
  const p = player();
  rivalReleases();
  const shows = MUSIC_SHOWS.filter((s) => year() >= s.from);
  const ids = r.performers;
  const recent = {};
  const out = { performances: [], wins: [] };
  const rivals = Object.values(k.releases).filter((x) => x.year === year() && x.id !== r.id && x.units && group(x.groupId)?.npc);
  for (let week = 1; week <= PROMO_WEEKS; week++) {
    for (const show of shows) {
      const fairy = pickFairy(g, ids, recent);
      recent[fairy] = (recent[fairy] ?? 0) + 1;
      const S = ids.map((w) => skillsOf(w));
      const stage = Math.round(S.reduce((t, s) => t + (s.vocal * 0.35 + s.dance * 0.35 + s.stage * 0.3), 0) / Math.max(1, S.length) + rng.around(0, 6));
      const highlight = [...ids].sort((x, y) => (skillsOf(y).stage + rng.int(0, 15)) - (skillsOf(x).stage + rng.int(0, 15)))[0];
      const perf = { id: nextId('perf'), groupId: g.id, releaseId: r.id, song: r.title, showId: show.id, show: show.name, year: year(), week, members: ids, stage, highlight,
        fairy, fairyStyle: null, fairyResult: null, fans: stage >= 80 ? 'a stage fans keep sharing' : stage >= 65 ? 'a strong stage' : 'a solid stage', win: false };
      if (fairy !== 'player') { const st = rng.pick(Object.keys(FAIRY_STYLES)); perf.fairyStyle = st; perf.fairyResult = fairyOutcome(fairy, st, r.concept, false).text; }
      // The week's chart: this release against the others out now.
      // The competition that week: the biggest releases out now, a few of them on each show.
      const field = [r, ...[...rivals].sort((x, y) => y.units.digital - x.units.digital).slice(0, 12).sort(() => rng.next() - 0.5).slice(0, 3)];
      const scored = field.map((x) => ({ x, s: showScore(x, group(x.groupId), show, week) })).sort((a2, b2) => b2.s - a2.s);
      if (scored[0].x.id === r.id) {
        perf.win = true;
        const win = { id: nextId('win'), showId: show.id, show: show.name, year: year(), week, releaseId: r.id, groupId: g.id, score: scored[0].s, runnerUp: scored[1]?.x.id ?? null, perfId: perf.id };
        k.wins.push(win);
        g.wins.push(win.id);
        r.wins.push(win.id);
        out.wins.push(win);
      }
      k.performances[perf.id] = perf;
      g.performances.push(perf.id);
      out.performances.push(perf);
      if (fairy === 'player') (idolOf(p).pendingFairies ??= []).push(perf.id);
    }
  }
  return out;
}

/** The ending fairy, resolved: camera, stage, how well the style suits the concept, experience, and chance. */
function fairyOutcome(who, style, concept, mine) {
  const s = skillsOf(who);
  const fits = FAIRY_STYLES[style]?.fits.includes(concept);
  const exp = mine ? idolOf().fairies.length : rng.int(0, 4);
  const score = s.camera * 0.4 + s.stage * 0.2 + s.media * 0.1 + (fits ? 14 : -4) + exp * 2 + rng.around(0, 14);
  const tier = score >= 72 && rng.chance(0.3) ? 'shared' : score >= 62 ? 'memorable' : score >= 50 ? 'positive' : score >= 38 ? 'neutral' : 'awkward';
  return { tier, text: { shared: 'The clip is everywhere by morning.', memorable: 'Fans cannot stop talking about it.', positive: 'Warm comments under the stage video.', neutral: 'It passes without much notice.', awkward: 'A slightly awkward moment that fans find endearing.' }[tier] };
}

/** The player's ending-fairy choice for a performance where the camera came to them. */
export function chooseFairy(perfId, style) {
  const p = player();
  const i = idolOf(p);
  const perf = K().performances[perfId];
  if (!perf || perf.fairy !== 'player' || perf.fairyStyle) return result(false, 'That moment has passed.', 'neutral');
  if (!FAIRY_STYLES[style]) return result(false, 'Not a style.', 'neutral');
  const r = K().releases[perf.releaseId];
  const o = fairyOutcome('player', style, r.concept, true);
  perf.fairyStyle = style;
  perf.fairyResult = o.text;
  perf.fairyTier = o.tier;
  i.fairies.push(perfId);
  i.pendingFairies = (i.pendingFairies ?? []).filter((x) => x !== perfId);
  // A good ending fairy is a fan moment: a little more individual recognition, nothing more.
  const bump = { shared: 3, memorable: 2, positive: 1, neutral: 0, awkward: 0.5 }[o.tier];
  i.pop = clamp(i.pop + bump);
  if (bump) gain({ audience: 'music', amount: bump * 0.6, why: `an ending fairy on ${perf.show}` }, p);
  if (i.fairies.length === 1) milestone(`First ending fairy, on ${perf.show}.`, 'fame');
  note(`Ending fairy on ${perf.show} (${perf.song}): ${FAIRY_STYLES[style].name.toLowerCase()}. ${o.text}`);
  return result(o.tier !== 'awkward', `${FAIRY_STYLES[style].name}. ${o.text}`, o.tier === 'neutral' ? 'neutral' : undefined);
}
export const pendingFairies = (p = player()) => (idolOf(p).pendingFairies ?? []).map((id) => K().performances[id]).filter((x) => x && !x.fairyStyle);

// ---------- Debut and comebacks ----------

const fandomGrowth = (g, r, n) => {
  const f = g.fandom;
  const add = Math.round((r.units.digital * 0.15 + r.units.physical * 0.6) * (0.6 + n.performances.length / 30) + n.wins.length * 1200 + Math.max(0, r.quality - 60) * 150);
  f.size = Math.round(f.size + add);
  f.core = Math.round(f.core + add * 0.15);
  f.engagement = Math.round(clamp(f.engagement + (r.chartPeak <= 20 ? 4 : -1) + n.wins.length));
  const home = agency(g.agencyId).countryId;
  f.regions[home] = Math.round((f.regions[home] ?? 0) + add * 0.7);
  return add;
};

/** The player's group lets them help choose the concept, if the agency gives members a say. */
export function suggestConcept(concept) {
  const g = myGroup();
  if (!g || !CONCEPTS[concept]) return result(false, 'Not now.', 'neutral');
  const a = agency(g.agencyId);
  if (!rng.chance(a.welfare / 100 + (g.debut ? 0.15 : 0))) return result(false, `${a.name} has its own plans for the concept this time.`, 'neutral');
  g.concept = concept;
  return result(true, `The company goes with your idea: ${CONCEPTS[concept].toLowerCase()}.`);
}

/** The debut: the first release, the first stages, the first ending fairies. Recorded once. */
export function debut(g = myGroup()) {
  if (!g || g.status !== 'preparing') return result(false, 'There is no debut to make.', 'neutral');
  const a = agency(g.agencyId);
  const r = makeRelease(g, rng.pick(['single_album', 'mini']), g.concept, { title: songTitle() });
  g.fandom.size = Math.round(800 + a.reputation * 60 + (current(g).reduce((t, m) => t + (m.who === 'player' ? idolOf().pop : npc(m.who)?.flags.idol?.pop ?? 0), 0)) * 300);
  g.fandom.core = Math.round(g.fandom.size * 0.15);
  receive(r, g);
  g.status = 'active';
  const n = promote(r, g);
  g.debut = { year: year(), releaseId: r.id, performanceId: n.performances[0]?.id ?? null };
  fandomGrowth(g, r, n);
  g.history.push({ year: year(), text: `${g.name} debuted with ${r.title}.` });
  for (const m of current(g)) if (m.who !== 'player') { const x = npc(m.who); if (x) { x.flags.idol.status = 'idol'; x.flags.star.fame = Math.min(100, (x.flags.star.fame ?? 0) + 10); } }
  if (current(g).some((m) => m.who === 'player')) {
    const p = player();
    milestone(`Debuted with ${g.name}: ${r.title}.`, 'fame');
    note(`Debuted with ${g.name} on ${n.performances[0]?.show ?? 'the music shows'} with ${r.title}.`);
    gain({ audience: 'music', amount: 4 + Math.log10(g.fandom.size + 10) * 2, why: `debuting with ${g.name}` }, p);
    if (n.wins.length) firstWin(g, n.wins[0]);
  }
  return result(true, `${g.name} debuts with ${r.title}: ${r.reception}${n.wins.length ? `, and wins on ${n.wins[0].show}` : ''}.`, 'good', { release: r, promo: n });
}

function firstWin(g, w) {
  if (g.firstWin) return;
  g.firstWin = w.id;
  g.history.push({ year: year(), text: `First music show win, on ${w.show}.` });
  if (current(g).some((m) => m.who === 'player')) { milestone(`First music show win with ${g.name}, on ${w.show}.`, 'fame'); note(`${g.name}'s first music show win, on ${w.show}. Everyone cried.`); }
}

/** A comeback: a new release, promoted. Two a year at most; the agency weighs in on the concept. */
export function comeback(kind = 'mini', concept = null, o = {}) {
  const p = player();
  const g = myGroup(p);
  if (!g) return result(false, 'You are not in a group.', 'neutral');
  if (g.status !== 'active') return result(false, g.status === 'hiatus' ? 'The group is on a break.' : 'The group cannot promote right now.', 'neutral');
  if (!RELEASE_KINDS[kind]) return result(false, 'Not a kind of release.', 'neutral');
  const thisYear = g.releases.map((id) => K().releases[id]).filter((r) => r.year === year() && !r.solo).length;
  if (thisYear >= 2) return result(false, 'Two comebacks this year is already a lot.', 'neutral');
  const a = agency(g.agencyId);
  const c = concept && CONCEPTS[concept] && (rng.chance(a.welfare / 100) || a.concepts.includes(concept)) ? concept : g.concept;
  const onBreak = idolOf(p).hiatus ? ['player'] : [];
  const r = makeRelease(g, kind, c, { lyrics: !!o.lyrics && levelOf('writing') >= 40, without: onBreak });
  receive(r, g);
  const n = promote(r, g);
  const add = fandomGrowth(g, r, n);
  idolOf(p).workload = (idolOf(p).workload ?? 0) + 1;
  g.history.push({ year: year(), text: `Came back with ${r.title} (${RELEASE_KINDS[kind].name.toLowerCase()}): ${r.reception}.` });
  if (!onBreak.length) {
    gain({ audience: 'music', amount: 2 + Math.log10(add + 10) * 1.5 + n.wins.length, why: `${g.name}: ${r.title}` }, p);
    idolOf(p).pop = clamp(idolOf(p).pop + 1 + n.wins.length * 0.5);
  }
  if (n.wins.length) firstWin(g, n.wins[0]);
  if (r.credits.lyrics.includes('player')) note(`Wrote lyrics on ${r.title}.`);
  return result(true, `${r.title} ${r.reception}${n.wins.length ? `, with ${n.wins.length} music show ${n.wins.length === 1 ? 'win' : 'wins'}` : ', with no music show wins this time'}.`, n.wins.length ? 'good' : 'neutral', { release: r, promo: n });
}

// ---------- Fandom and public life ----------

export function nameFandom(name) {
  const g = myGroup();
  if (!g?.debut) return result(false, 'Fandoms are named after debut.', 'neutral');
  if (g.fandom.name) return result(false, `The fandom is already ${g.fandom.name}.`, 'neutral');
  if (agency(g.agencyId).welfare < 55 && rng.chance(0.5)) { g.fandom.name = rng.pick(FANDOM_WORDS); return result(false, `The company announces it has chosen the name: ${g.fandom.name}.`, 'neutral'); }
  g.fandom.name = String(name || rng.pick(FANDOM_WORDS)).slice(0, 24);
  g.history.push({ year: year(), text: `The fandom became ${g.fandom.name}.` });
  return result(true, `The fandom has a name: ${g.fandom.name}.`);
}

/** Interviews, variety, radio, fan events: how they go depends on media training, and the approach. */
export function appearance(kind, approach = 'professional') {
  const p = player();
  const g = myGroup(p);
  const i = idolOf(p);
  if (!g?.debut) return result(false, 'Debut first.', 'neutral');
  if (i.acts.social >= 3) return result(false, 'Your schedule is full.', 'neutral');
  if (kind === 'fancall' && !era('fanCalls')) return result(false, 'Video calls with fans do not exist yet.', 'neutral');
  if (kind === 'livestream' && !era('fanPlatforms')) return result(false, 'There are no fan platforms to stream on yet.', 'neutral');
  i.acts.social += 1;
  const s = skillsOf();
  const leader = g.leader === 'player';
  const odds = clamp(0.35 + (s.media - 50) / 80 + (approach === 'funny' ? (s.camera - 55) / 100 : 0) + (approach === 'leader' && !leader ? -0.15 : 0), 0.08, 0.92);
  const good = rng.chance(odds);
  raise('player', 'media', 1.5);
  const bump = good ? (kind === 'variety' ? 2 : 1) : 0;
  i.pop = clamp(i.pop + bump);
  g.fandom.engagement = clamp(g.fandom.engagement + (good ? 2 : 0));
  if (bump) gain({ audience: kind === 'variety' ? 'tv' : 'music', amount: bump, why: `a ${kind === 'variety' ? 'variety show' : kind}` }, p);
  const what = { interview: 'the interview', variety: 'the variety show', radio: 'the radio show', fanmeeting: 'the fan meeting', fansign: 'the fansign', fancall: 'the fan call', livestream: 'the livestream' }[kind] ?? 'it';
  const how = { professional: 'You answer carefully and well.', funny: 'You go for the joke.', leader: leader ? 'You speak for the group, as leader.' : 'You let the leader answer most of it.', member: 'You make sure another member gets the spotlight.', music: 'You talk about the music.' }[approach] ?? '';
  return result(good, `${how} ${good ? `It goes over well: ${what} brings you new fans.` : `${what[0].toUpperCase()}${what.slice(1)} is fine; nothing much comes of it.`}`, good ? 'good' : 'neutral');
}

// ---------- Hiatus, workload, welfare ----------

/** A break: for health, personal reasons or rest. The member stays in the group; the reason stays as private as they want. */
export function startHiatus(kind = 'rest') {
  const p = player();
  const g = myGroup(p);
  const i = idolOf(p);
  if (!g && !trainee(p)) return result(false, 'There is nothing to take a break from.', 'neutral');
  if (i.hiatus) return result(false, 'You are already on a break.', 'neutral');
  i.hiatus = { kind, since: year(), public: kind === 'health' ? 'for health reasons' : kind === 'personal' ? 'for personal reasons' : 'to rest' };
  if (g) g.history.push({ year: year(), text: `${full('player')} paused activities ${i.hiatus.public}.` });
  p.stats.health = clamp(p.stats.health + (kind === 'health' ? 8 : 4));
  p.stats.mood = clamp((p.stats.mood ?? 50) + 6);
  healthRecord(kind);
  note(`Paused activities ${i.hiatus.public}.`);
  return result(true, `You step back ${i.hiatus.public}. ${g ? `${g.name} carries on without you for now; you are still a member.` : 'Your place as a trainee is kept.'}`, 'neutral');
}
export function endHiatus() {
  const p = player();
  const i = idolOf(p);
  if (!i.hiatus) return result(false, 'You are not on a break.', 'neutral');
  if (i.hiatus.kind === 'service' && year() - i.hiatus.since < 2) return result(false, 'Military service is not finished yet.', 'neutral');
  const g = myGroup(p);
  if (g) g.history.push({ year: year(), text: `${full('player')} returned to activities.` });
  healthReturn();
  note(`Returned to activities after ${year() - i.hiatus.since || 'less than a'} ${year() - i.hiatus.since === 1 ? 'year' : 'years'}.`);
  i.hiatus = null;
  return result(true, 'You come back gradually: a lighter schedule at first. The fans have been waiting.');
}

// ---------- Tours ----------

export const TOURS = { fan_concert: { name: 'Fan concerts at home', fans: 20000, shows: 4 }, asia: { name: 'An Asia tour', fans: 150000, shows: 12 }, world: { name: 'A world tour', fans: 600000, shows: 24 } };
export function planTour(kind) {
  const g = myGroup();
  const t = TOURS[kind];
  if (!g?.debut || !t) return result(false, 'Not now.', 'neutral');
  if (g.fandom.size < t.fans) return result(false, `${t.name} needs about ${t.fans.toLocaleString('en-US')} fans.`, 'neutral');
  if (g.tours.some((x) => x.year === year())) return result(false, 'One tour a year.', 'neutral');
  const tour = { id: nextId('tour'), kind, name: `${g.name}: ${songTitle()} ${kind === 'fan_concert' ? 'Fan Concert' : 'Tour'}`, year: year(), shows: t.shows, status: 'booked', places: kind === 'world' ? ['kr', 'jp', 'us', 'gb', 'fr', 'br', 'mx', 'th', 'ph', 'au'] : kind === 'asia' ? ['kr', 'jp', 'th', 'ph', 'id', 'sg'] : [agency(g.agencyId).countryId] };
  tour.places = tour.places.filter((c) => COUNTRIES[c]);
  g.tours.push(tour);
  idolOf().workload = (idolOf().workload ?? 0) + (kind === 'world' ? 2 : 1);
  return result(true, `${tour.name}: ${t.shows} shows in ${tour.places.length} ${tour.places.length === 1 ? 'country' : 'countries'}. It plays out over the year.`);
}

// ---------- Solo work ----------

export function soloOk(p = player()) {
  const g = myGroup(p);
  if (!g?.debut) return 'Debut with your group first.';
  const c = contractOf('player', g);
  if (c && !c.soloAllowed) return `${agency(g.agencyId).name}'s contract does not allow solo releases.`;
  if (year() - g.debut.year < 2) return 'The company wants the group established first.';
  if (idolOf(p).pop < 15 && readiness('player') < 70) return 'There is not yet the demand for a solo release.';
  return '';
}
export function soloRelease(kind = 'digital_single') {
  const p = player();
  const why = soloOk(p);
  if (why) return result(false, why, 'neutral');
  const g = myGroup(p);
  if (idolOf(p).solo.some((id) => K().releases[id]?.year === year())) return result(false, 'One solo release a year.', 'neutral');
  const fake = { ...g, id: g.id, fandom: { ...g.fandom, size: Math.round(g.fandom.size * 0.3 + idolOf(p).pop * 2000), core: Math.round(g.fandom.core * 0.4) } };
  const r = makeRelease(g, kind, g.concept, { solo: 'player', title: songTitle(), lyrics: levelOf('writing') >= 40 });
  r.performers = ['player'];
  r.songs.forEach((s) => { s.parts = { player: { share: 100, rap: false, climax: true, danceBreak: true, center: true } }; });
  receive(r, fake);
  const n = promote(r, fake);
  K().groups[g.id] = g; // the group itself is unchanged by a solo release
  idolOf(p).solo.push(r.id);
  if (idolOf(p).solo.length === 1) milestone(`Solo debut: ${r.title}.`, 'fame');
  note(`Released a solo ${RELEASE_KINDS[kind].name.toLowerCase()}, ${r.title}, while staying in ${g.name}.`);
  gain({ audience: 'music', amount: 3 + n.wins.length * 2, why: `solo: ${r.title}` }, p);
  idolOf(p).pop = clamp(idolOf(p).pop + 3);
  return result(true, `Your solo ${r.title} ${r.reception}. You are still in ${g.name}.`);
}

// ---------- Contracts: renewal ----------

export const renewalDue = (p = player()) => idolOf(p).renewal ?? null;
/** The player's own choice at renewal: renew, leave the agency but keep doing group activities (if allowed), or leave. */
export function decideRenewal(choice) {
  const p = player();
  const due = renewalDue(p);
  if (!due) return result(false, 'There is no decision to make.', 'neutral');
  const g = group(due.groupId);
  const a = agency(g.agencyId);
  const c = contractOf('player', g);
  if (c) { c.status = 'ended'; c.ended = { year: year(), how: choice }; }
  idolOf(p).renewal = null;
  if (choice === 'renew') {
    const n = signArtist(g, 'player');
    n.years = rng.int(2, 3); n.ends = year() + n.years; n.artistShare = Math.min(0.7, (c?.artistShare ?? 0.3) + 0.1);
    note(`Renewed with ${a.name} for ${n.years} years.`);
    return result(true, `You renew with ${a.name}: ${n.years} years, a bigger share this time.`);
  }
  if (choice === 'keep_group' && rng.chance(0.5)) {
    idolOf(p).independent = { since: year() };
    note(`Left ${a.name} but kept doing ${g.name} activities by agreement.`);
    return result(true, `You leave ${a.name}, and it agrees you can keep performing with ${g.name}.`);
  }
  memberLeaves(g, 'player', 'did not renew');
  idolOf(p).groupId = null;
  note(`Left ${g.name} and ${a.name} at the end of the contract.`);
  checkGroupFuture(g);
  return result(true, `You leave ${g.name}. The years, the songs and the people stay with you.`, 'neutral');
}
function checkGroupFuture(g) {
  if (current(g).length < 2 && g.status !== 'disbanded') {
    g.status = 'disbanded';
    g.disbanded = year();
    g.history.push({ year: year(), text: `${g.name} disbanded.` });
    if (g.members.some((m) => m.who === 'player')) milestone(`${g.name} disbanded.`, 'fame');
  }
}

/** Years later, a reunion: whoever is willing comes back for a special release. */
export function proposeReunion(groupId) {
  const p = player();
  const g = group(groupId);
  if (!g || g.status !== 'disbanded' || !g.members.some((m) => m.who === 'player')) return result(false, 'There is nothing to reunite.', 'neutral');
  if (year() - (g.disbanded ?? year()) < 3) return result(false, 'It is too soon.', 'neutral');
  const former = [...new Set(g.members.map((m) => m.who))].filter((w) => w !== 'player' && npc(w)?.alive !== false);
  const willing = former.filter((w) => rng.chance(clamp(0.35 + ((npc(w)?.meters.relationship ?? 50) - 50) / 60, 0.1, 0.95)));
  if (willing.length < 1) return result(false, 'Everyone is busy with their own lives.');
  g.status = 'reunited';
  for (const w of ['player', ...willing]) g.members.push({ who: w, from: year(), to: null, reunion: true });
  assignPositions(g, 'reunion');
  const r = makeRelease(g, 'digital_single', g.concept, { title: songTitle() });
  r.kind = 'special';
  receive(r, g);
  g.history.push({ year: year(), text: `${g.name} reunited for ${r.title}.` });
  milestone(`${g.name} reunited for ${r.title}.`, 'fame');
  note(`Reunited with ${willing.map((w) => npc(w).firstName).join(', ')} as ${g.name}.`);
  return result(true, `${g.name} is back for one more song: ${r.title}, with ${willing.map((w) => npc(w).firstName).join(', ')}.`);
}

// ---------- Pay ----------

/** The player's share of the group's settled earnings, and any trainee allowance, each paid once with the year's income. */
export function idolLines(p = player()) {
  const lived = year() - 1;
  const out = [];
  const k = store.state.kpop;
  if (!k) return out;
  for (const gid of idolOf(p).groups ?? []) {
    const g = k.groups[gid];
    const s = g?.ledger.years[lived];
    if (s?.perMember?.player > 0 && !s.paid) out.push({ source: `idol:${gid}:${lived}`, label: `${g.name}: your share of the year's earnings`, gross: s.perMember.player });
  }
  const mc = idolOf(p).mc;
  if (mc?.year === lived && !mc.paid) out.push({ source: `idolmc:${lived}`, label: `Hosting ${mc.show}`, gross: Math.round(wageIn(mc.fee, COUNTRIES.kr ?? COUNTRIES[p.countryId], COUNTRIES[p.countryId])) });
  for (const cid of idolOf(p).contracts ?? []) {
    const c = k.contracts[cid];
    if (c?.kind === 'trainee' && c.allowance > 0 && c.start <= lived && (c.status === 'active' || (c.ended?.year ?? 0) > lived) && !(c.paid ?? []).includes(lived)) {
      out.push({ source: `trainee:${cid}:${lived}`, label: `Trainee allowance, ${agency(c.agencyId).name}`, gross: Math.round(wageIn(c.allowance * 12, COUNTRIES[agency(c.agencyId).countryId], COUNTRIES[p.countryId])) });
    }
  }
  return out;
}
export function markIdolPaid(p = player()) {
  const lived = year() - 1;
  const k = store.state.kpop;
  if (!k) return;
  for (const gid of idolOf(p).groups ?? []) { const s = k.groups[gid]?.ledger.years[lived]; if (s) s.paid = true; }
  if (idolOf(p).mc?.year === lived) idolOf(p).mc.paid = true;
  for (const cid of idolOf(p).contracts ?? []) { const c = k.contracts[cid]; if (c?.kind === 'trainee') (c.paid ??= []).includes(lived) || c.paid.push(lived); }
}

/** A group's year, settled: what came in, what it cost, what the agency recoups first, and the members' share. */
function settle(g, y) {
  const a = agency(g.agencyId);
  const rels = g.releases.map((id) => K().releases[id]).filter((r) => r?.year === y && r.units && !r.solo);
  const rev = rels.reduce((t, r) => t + r.units.digital * 0.6 + r.units.physical * 9, 0) + g.tours.filter((t) => t.year === y && t.gross).reduce((t, x) => t + x.gross, 0) + (g.fandom.size * 0.4);
  const costs = rels.reduce((t, r) => t + r.cost, 0) + g.tours.filter((t) => t.year === y).reduce((t, x) => t + (x.cost ?? 0), 0) + 80000;
  let net = rev - costs - g.ledger.unrecouped;
  g.ledger.unrecouped = net < 0 ? -net : 0;
  net = Math.max(0, net);
  const share = a.artist.artistShare;
  const ids = current(g, y).map((m) => m.who).filter((w) => w !== 'player' || !(idolOf().hiatus?.kind === 'service' && idolOf().hiatus.since < y));
  const per = Math.round(net * share / Math.max(1, ids.length));
  const perMember = {};
  for (const w of ids) perMember[w] = w === 'player' ? Math.round(wageIn(per, COUNTRIES[a.countryId], COUNTRIES[player().countryId])) : per;
  g.ledger.revenue += Math.round(rev); g.ledger.costs += Math.round(costs);
  g.ledger.years[y] = { revenue: Math.round(rev), costs: Math.round(costs), toMembers: Math.round(net * share), perMember, paid: false };
}

// ---------- Awards ----------

function yearAwards(y) {
  const k = K();
  if (y < KPOP_AWARDS.from || k.awards[y]) return;
  const rels = Object.values(k.releases).filter((r) => r.year === y && r.units && !r.solo);
  if (rels.length < 3) return;
  const by = (f) => [...rels].sort((a2, b2) => f(b2) - f(a2));
  const rookies = Object.values(k.groups).filter((g) => g.debut?.year === y);
  const out = {};
  out.song = by((r) => r.units.digital + rng.int(0, 5000))[0].id;
  out.grand = by((r) => r.units.digital + r.units.physical * 5 + rng.int(0, 5000))[0].id;
  out.performance = [...rels].sort((a2, b2) => avgStage(b2) - avgStage(a2))[0].id;
  if (rookies.length) out.rookie = [...rookies].sort((a2, b2) => b2.fandom.size - a2.fandom.size)[0].id;
  k.awards[y] = out;
  const g = myGroup() ?? group(idolOf().groupId);
  if (!g) return;
  for (const [cat, id] of Object.entries(out)) {
    const won = cat === 'rookie' ? id === g.id : k.releases[id]?.groupId === g.id && !k.releases[id]?.solo;
    if (won) { g.awards.push({ year: y, award: KPOP_AWARDS.name, category: cat }); milestone(`${g.name} won ${{ rookie: 'Rookie of the Year', song: 'Song of the Year', grand: 'the Grand Prize', performance: 'Best Performance' }[cat]} at the ${KPOP_AWARDS.name}.`, 'fame'); }
  }
}
const avgStage = (r) => { const ps = (group(r.groupId)?.performances ?? []).map((id) => K().performances[id]).filter((x) => x?.releaseId === r.id); return ps.length ? ps.reduce((t, x) => t + x.stage, 0) / ps.length : 0; };

// ---------- The year ----------

/** Once a year, for the year just lived. Nothing happens unless the player has ever gone near the industry. @returns {string[]} */
export function tickKpop() {
  const st = store.state;
  if (!st.kpop || !available()) return [];
  const p = player();
  const k = world();
  const i = idolOf(p);
  const lived = year() - 1;
  const lines = [];
  // Training: the player's chosen focus, at the agency's level, within what the body can take.
  const t = trainee(p);
  if (t && !i.hiatus) {
    const f = FOCUSES[i.focus] ?? FOCUSES.balanced;
    const k2 = t.agency.training / 70 * (i.lighter === p.age - 1 ? 0.8 : 1);
    for (const [area, by] of Object.entries(f.builds)) raise('player', area, by * k2);
    raise('player', 'stage', 1.5); raise('player', 'camera', 1);
    const strain = Math.max(0, (100 - t.agency.welfare) / 20 - (i.lighter === p.age - 1 ? 2 : 0));
    p.stats.health = clamp(p.stats.health - strain);
  }
  // Every agency: its trainees grow, its evaluations, its debut plans.
  for (const a of Object.values(k.agencies)) {
    for (const id of a.trainees) { const n = npc(id); if (n?.flags.idol?.status === 'trainee') for (const area of ['vocal', 'dance', 'rap', 'stage', 'camera', 'media']) raise(id, area, rng.int(0, 4) * a.training / 75); }
    const ev = evaluateAgency(a);
    if (ev) {
      lines.push(`Your ${lived} evaluation at ${a.name}: ${ev.outcome.toLowerCase()} (ranked ${ev.rank} of ${ev.of}). "${ev.feedback[0]}"`);
      note(`Year-end evaluation: ${ev.outcome}, ${ev.rank} of ${ev.of}.`);
    }
    // Trainees age out or move on; new ones arrive.
    for (const id of [...a.trainees]) { const n = npc(id); const age = n ? year() - n.flags.idol.born.year : 99; if (!n || n.alive === false || (n.flags.idol.status === 'trainee' && age > 24) || n.flags.idol.status === 'eliminated') { if (n && n.flags.idol.status === 'trainee') { n.flags.idol.status = 'left'; n.flags.idol.history.push({ year: year(), text: `Left ${a.name} without debuting.` }); } a.trainees = a.trainees.filter((x) => x !== id); } }
    while (a.trainees.filter((id) => npc(id)?.flags.idol?.status === 'trainee').length < 10) a.trainees.push(idolNpc(a.global ? rng.pick(['us', 'kr', 'jp', 'ph', 'br']) : rng.pick(['kr', 'kr', 'kr', 'jp', 'th', 'us']), { agencyId: a.id, age: rng.int(13, 17) }).id);
    // A debut project every few years, from the agency's own trainees.
    const active = a.groups.map(group).filter((g) => g && ['active', 'preparing'].includes(g.status)).length;
    const playerHere = t?.agency.id === a.id;
    if (year() - a.lastProject >= (playerHere ? rng.int(2, 3) : rng.int(3, 4)) && active < 3) {
      const pr = debutProject(a, { gender: t?.agency.id === a.id && rng.chance(0.6) ? p.gender : undefined });
      if (pr?.lineup.includes('player')) { i.debutOffer = pr.id; lines.push(`${a.name} has announced a new debut line-up, and you are in it.`); milestone(`Named in ${a.name}'s debut line-up.`, 'fame'); }
      else if (pr) { formNpcGroup(pr); if (t?.agency.id === a.id) { lines.push(`${a.name} has announced its new group. You are not in it.`); note(`Not chosen for ${a.name}'s debut line-up.`); } }
    }
  }
  // A debut place left unanswered for a year lapses: the agency debuts the group without the player.
  const offer = i.debutOffer ? k.projects[i.debutOffer] : null;
  if (offer && offer.year < lived) { i.debutOffer = null; offer.lineup = offer.lineup.filter((w) => w !== 'player'); offer.status = 'announced'; formNpcGroup(offer); lines.push(`${agency(offer.agencyId).name} could not wait any longer: the group debuts without you.`); note('A debut place lapsed unanswered.'); }
  // An audition kept on file sometimes leads to a call for another project.
  for (const id of i.apps) {
    const app = k.apps[id];
    if (app?.stage !== 'held' || app.year !== lived || trainee(p) || myGroup(p)) continue;
    if (rng.chance(0.4)) { app.stage = 'offered'; app.offer = traineeOffer(agency(app.agencyId)); lines.push(`${agency(app.agencyId).name} has called back about your audition: they are offering you a trainee place for a new project.`); note(`${agency(app.agencyId).name} called back with a trainee offer.`); }
    else app.outcome = 'held; no call came';
  }
  // The player's trainee review: renewed, or not, with reasons the player has seen coming.
  if (t && t.contract.reviewAt <= year()) {
    if ((i.trainee.warned ?? 0) >= 2) {
      t.contract.status = 'ended'; t.contract.ended = { year: year(), by: 'agency', how: 'not renewed at review' };
      endTraineeLife(p, t.agency, 'not renewed');
      lines.push(`${t.agency.name} does not renew your trainee agreement, after two difficult evaluations. You can audition elsewhere.`);
      note(`${t.agency.name} did not renew the trainee agreement.`);
    } else { t.contract.reviewAt = year() + t.contract.review; t.contract.notes.push(`Renewed at review, ${year()}`); }
  }
  // Survival programs that aired last year finish by their own rules.
  for (const pr of Object.values(k.programs)) {
    if (pr.year >= year()) continue;
    if (pr.status === 'casting') { cast(pr, false); }
    let guard = 0;
    while (pr.status === 'airing' && guard++ < 10) playMission(pr.id, 'steady');
  }
  programs();
  // Groups: a debut that was prepared, settlement, hiatus, military service, renewals.
  for (const g of Object.values(k.groups)) {
    if (g.status === 'preparing' && g.formed < year()) debut(g);
    if (g.debut && g.debut.year <= lived && ['active', 'hiatus', 'reunited', 'negotiating'].includes(g.status)) settle(g, lived);
    // Tours booked last year are played.
    for (const tour of g.tours.filter((x) => x.year === lived && x.status === 'booked')) {
      const per = Math.min(TOURS[tour.kind].fans * 0.4, g.fandom.size * 0.06) * rng.around(1, 0.2);
      tour.sold = Math.round(per * tour.shows); tour.gross = Math.round(tour.sold * 90); tour.cost = Math.round(tour.shows * 60000); tour.status = 'done';
      for (const c of tour.places) g.fandom.regions[c] = Math.round((g.fandom.regions[c] ?? 0) + tour.sold / tour.places.length * 0.5);
      if (current(g).some((m) => m.who === 'player')) { lines.push(`${tour.name}: ${tour.sold.toLocaleString('en-US')} tickets over ${tour.shows} shows.`); gain({ audience: 'music', amount: 3, abroad: tour.places.filter((c) => c !== p.countryId), reach: 0.5, why: tour.name }, p); }
    }
    if (g.debut && !g.fandom.name && year() - g.debut.year >= 1) g.fandom.name = rng.pick(FANDOM_WORDS);
    // Korean men serve in the military, usually in their late twenties: a hiatus, not an ending.
    for (const m of current(g)) {
      const n = m.who === 'player' ? null : npc(m.who);
      if (n && n.gender === 'male' && n.bornIn === 'kr' && year() - n.flags.idol.born.year >= 28 && !n.flags.idol.served && !n.flags.idol.hiatus) { n.flags.idol.hiatus = { kind: 'service', since: year() }; g.history.push({ year: year(), text: `${n.firstName} ${n.lastName} began military service.` }); }
      if (n?.flags.idol.hiatus?.kind === 'service' && year() - n.flags.idol.hiatus.since >= 2) { n.flags.idol.hiatus = null; n.flags.idol.served = true; g.history.push({ year: year(), text: `${n.firstName} ${n.lastName} completed military service and returned.` }); }
      if (n && !n.flags.idol.hiatus && rng.chance(0.03)) { n.flags.idol.hiatus = { kind: rng.pick(['health', 'personal']), since: year() }; g.history.push({ year: year(), text: `${n.firstName} ${n.lastName} paused activities for ${n.flags.idol.hiatus.kind} reasons.` }); }
      else if (n?.flags.idol.hiatus && n.flags.idol.hiatus.kind !== 'service' && year() - n.flags.idol.hiatus.since >= 1 && rng.chance(0.7)) { n.flags.idol.hiatus = null; g.history.push({ year: year(), text: `${n.firstName} ${n.lastName} returned to activities.` }); }
    }
    // Contracts end: each member chooses for themselves.
    if (g.status === 'active' && g.debut) {
      for (const m of current(g)) {
        const c = contractOf(m.who, g);
        if (!c || c.ends > year()) continue;
        if (m.who === 'player') { if (!i.renewal) { i.renewal = { groupId: g.id, due: year() }; lines.push(`${g.name}'s contracts are up. You have a decision to make.`); } continue; }
        const stay = rng.chance(clamp(0.35 + Math.log10(g.fandom.size + 10) / 15, 0.2, 0.85));
        c.status = 'ended'; c.ended = { year: year(), how: stay ? 'renewed' : 'left' };
        if (stay) { const n2 = signArtist(g, m.who); n2.years = rng.int(2, 3); n2.ends = year() + n2.years; } else memberLeaves(g, m.who, 'did not renew');
      }
      checkGroupFuture(g);
    }
    // Old rival groups wind down eventually.
    if (g.npc && g.status === 'active' && g.debut && year() - g.debut.year > rng.int(7, 12)) { g.status = 'disbanded'; g.disbanded = year(); g.history.push({ year: year(), text: `${g.name} disbanded.` }); }
  }
  // The player's own military service, if they are a Korean man in a group in his late twenties.
  const g0 = myGroup(p);
  if (g0 && p.gender === 'male' && (p.birthCountryId === 'kr') && p.age >= 28 && !i.served && !i.hiatus) { i.hiatus = { kind: 'service', since: year(), public: 'for military service' }; i.served = true; lines.push('You begin your military service. The group will be there when you come back.'); note('Began military service.'); }
  if (i.hiatus?.kind === 'service' && year() - i.hiatus.since >= 2) { lines.push('Your military service is over.'); endHiatus(); }
  // Promotions are hard work: health pays for a heavy year at a demanding agency, unless rest was asked for.
  if (g0 && (i.workload ?? 0) >= 2 && !i.hiatus) { const a = agency(g0.agencyId); p.stats.health = clamp(p.stats.health - Math.max(0, (100 - a.welfare) / 15 - (i.lighter === p.age - 1 ? 2 : 0))); if (p.stats.health < 45) lines.push('The schedule is wearing you down. You can ask for rest or take a break: it will not cost you your place.'); }
  i.workloadLast = i.workload ?? 0;
  yearExtras(p, lived, lines);
  i.workload = 0;
  yearAwards(lived);
  rivalReleases();
  forget(p);
  return lines;
}

/** The industry forgets what nobody in this life was part of: old rival releases, past seasons, long-gone groups. */
function forget(p) {
  const k = K();
  const known = new Set(p.npcIds);
  const mine = new Set(idolOf(p).groups ?? []);
  const keepRel = new Set(Object.values(k.groups).filter((g) => mine.has(g.id) || g.members.some((m) => known.has(m.who))).flatMap((g) => g.releases));
  for (const w of k.wins) { keepRel.add(w.releaseId); }
  for (const [id, r] of Object.entries(k.releases)) if (!keepRel.has(id) && r.year < year() - 2) delete k.releases[id];
  for (const g of Object.values(k.groups)) g.releases = g.releases.filter((id) => k.releases[id]);
  for (const [id, pr] of Object.entries(k.programs)) if (pr.year < year() - 3 && !pr.contestants.some((c) => c.who === 'player' || known.has(c.who))) delete k.programs[id];
  for (const [id, g] of Object.entries(k.groups)) {
    if (g.status !== 'disbanded' || mine.has(id) || year() - (g.disbanded ?? year()) < 5 || g.members.some((m) => known.has(m.who))) continue;
    for (const m of g.members) if (!known.has(m.who)) delete store.state.npcs[m.who];
    const a = k.agencies[g.agencyId]; if (a) a.groups = a.groups.filter((x) => x !== id);
    delete k.groups[id];
  }
  // Trainees who left long ago, whom the player never met.
  for (const a of Object.values(k.agencies)) for (const [id, n] of Object.entries(store.state.npcs)) {
    const x = n.flags?.idol;
    if (x && x.agencyId === a.id && ['left', 'eliminated'].includes(x.status) && !known.has(id) && !Object.values(k.groups).some((g) => g.members.some((m) => m.who === id))) delete store.state.npcs[id];
  }
}

// ---------- Across generations ----------

/** The industry carries on in the next life; everything the player did becomes the ancestor's. */
export function carryKpop(old, next, ancestorId) {
  if (!old.kpop) return;
  next.kpop = old.kpop;
  const k = next.kpop;
  const who = (x) => (x === 'player' ? ancestorId ?? 'ancestor' : x);
  const keep = new Set();
  for (const g of Object.values(k.groups)) {
    for (const m of g.members) { m.who = who(m.who); keep.add(m.who); }
    const pos = {}; for (const [w, l] of Object.entries(g.positions)) pos[who(w)] = l; g.positions = pos;
    for (const h of g.positionHistory) { const q = {}; for (const [w, l] of Object.entries(h.positions)) q[who(w)] = l; h.positions = q; h.maknae = who(h.maknae); h.leader = who(h.leader); }
    g.leader = who(g.leader);
    for (const y of Object.values(g.ledger.years)) if (y.perMember?.player != null) { y.perMember[who('player')] = y.perMember.player; delete y.perMember.player; }
  }
  for (const r of Object.values(k.releases)) { r.performers = r.performers.map(who); r.credits.lyrics = r.credits.lyrics.map(who); if (r.solo) r.solo = who(r.solo); for (const s of r.songs) { if (!s.parts) continue; const q = {}; for (const [w, v] of Object.entries(s.parts)) q[who(w)] = v; s.parts = q; } }
  for (const x of Object.values(k.performances)) { x.members = x.members.map(who); x.fairy = who(x.fairy); x.highlight = who(x.highlight); }
  for (const c of Object.values(k.contracts)) c.who = who(c.who);
  for (const pr of Object.values(k.programs)) { for (const c of pr.contestants) c.who = who(c.who); if (pr.final) pr.final = pr.final.map(who); }
  for (const pr of Object.values(k.projects)) pr.lineup = pr.lineup.map(who);
  for (const a of Object.values(k.agencies)) { if (a.dorm) a.dorm.residents = a.dorm.residents.filter((x) => x !== 'player'); for (const id of [...a.trainees, ...Object.values(a.staff)]) keep.add(id); }
  for (const id of keep) if (id && !next.npcs[id] && old.npcs[id]) next.npcs[id] = old.npcs[id];
  next.idolAncestors = [...(old.idolAncestors ?? []), ...(old.player.idol ? [{ npcId: ancestorId ?? null, name: `${old.player.firstName} ${old.player.lastName}`, groups: old.player.idol.groups, history: old.player.idol.history }] : [])];
}

/** A short record of an idol life, for the family's records. */
export function summary(p = player(), st = store.state) {
  const i = p.idol;
  if (!i || (!i.groups?.length && !i.apps?.length)) return null;
  const k = st.kpop;
  const gs = (i.groups ?? []).map((id) => k?.groups[id]).filter(Boolean);
  return { groups: gs.map((g) => g.name), debut: gs[0]?.debut?.year ?? null, wins: gs.reduce((t, g) => t + g.wins.length, 0), fairies: i.fairies.length, solo: i.solo.length, trained: i.trainee ? (i.trainee.ended?.year ?? st.year) - i.trainee.since : 0 };
}

// ---------- Subunits ----------

/** A subunit: two or three members release music as a smaller group. The main group carries on. */
export function formSubunit(memberIds, concept = null) {
  const p = player();
  const g = myGroup(p);
  if (!g?.debut) return result(false, 'Your group has to debut first.', 'neutral');
  if (year() - g.debut.year < 2) return result(false, 'The company wants the full group established first.', 'neutral');
  const ids = [...new Set(['player', ...memberIds])].filter((w) => current(g).some((m) => m.who === w));
  if (ids.length < 2 || ids.length > 3) return result(false, 'A subunit is two or three members.', 'neutral');
  if (Object.values(K().groups).some((x) => x.parentId === g.id && x.status === 'active')) return result(false, `${g.name} already has an active subunit.`, 'neutral');
  if (!rng.chance(clamp(agency(g.agencyId).welfare / 100 + idolOf().pop / 100, 0.3, 0.9))) return result(false, `${agency(g.agencyId).name} says not this year.`, 'neutral');
  const u = makeGroup({ agencyId: g.agencyId, name: `${g.name} ${rng.pick(['U', 'UNIT', 'S', 'DUO', 'TRIO'])}`.replace(/DUO$/, ids.length === 2 ? 'DUO' : 'TRIO'), members: ids, gender: g.gender, concept: concept && CONCEPTS[concept] ? concept : g.concept, debutYear: year(), npc: false });
  u.parentId = g.id;
  u.fandom = { name: g.fandom.name, size: Math.round(g.fandom.size * 0.5), core: Math.round(g.fandom.core * 0.6), regions: { ...g.fandom.regions }, engagement: g.fandom.engagement, history: [] };
  const r = makeRelease(u, 'mini', u.concept, { title: songTitle() });
  receive(r, u);
  const n = promote(r, u);
  u.debut = { year: year(), releaseId: r.id, performanceId: n.performances[0]?.id ?? null };
  for (const w of ids) signArtist(u, w);
  idolOf(p).groups.push(u.id);
  g.history.push({ year: year(), text: `The subunit ${u.name} debuted with ${r.title}.` });
  milestone(`Debuted in the subunit ${u.name}.`, 'fame');
  note(`Debuted in ${g.name}'s subunit ${u.name}, still a member of ${g.name}.`);
  return result(true, `${u.name} debuts with ${r.title}: ${r.reception}${n.wins.length ? `, with ${n.wins.length} music show ${n.wins.length === 1 ? 'win' : 'wins'}` : ''}. You are still in ${g.name}.`);
}
export const subunits = (g) => Object.values(K().groups).filter((x) => x.parentId === g.id);

// ---------- Japanese releases ----------

/** A Japanese release: for a group with fans in Japan; better received if the members speak Japanese. */
export function japaneseRelease() {
  const p = player();
  const g = myGroup(p);
  if (!g?.debut) return result(false, 'Debut first.', 'neutral');
  if (year() < 2000) return result(false, 'Korean groups are not yet releasing in Japan.', 'neutral');
  if ((g.fandom.regions.jp ?? 0) < 2000 && g.fandom.size < 50000) return result(false, 'There are not yet enough fans in Japan for a Japanese release.', 'neutral');
  if (g.releases.some((id) => K().releases[id]?.market === 'jp' && K().releases[id].year === year())) return result(false, 'One Japanese release a year.', 'neutral');
  const r = makeRelease(g, 'single_album', g.concept, { title: `${songTitle()} (Japanese ver.)` });
  r.market = 'jp';
  const jp = Math.round(levelOf('japanese') / 10);
  r.quality = Math.round(clamp(r.quality + jp - 3));
  const base = { ...g, fandom: { ...g.fandom, size: Math.round((g.fandom.regions.jp ?? 0) * 2 + g.fandom.size * 0.15), core: Math.round((g.fandom.regions.jp ?? 0) * 0.4) } };
  receive(r, base);
  r.units.physical = Math.round(r.units.physical * 1.6); // physical singles still matter a great deal in Japan
  g.fandom.regions.jp = Math.round((g.fandom.regions.jp ?? 0) + r.units.physical * 0.3 + r.units.digital * 0.05);
  g.fandom.size = Math.round(g.fandom.size + r.units.physical * 0.2);
  gain({ audience: 'music', amount: 2, abroad: ['jp'], reach: 0.6, why: `${g.name}'s Japanese release` }, p);
  g.history.push({ year: year(), text: `Released ${r.title} in Japan.` });
  if (!g.releases.some((id) => id !== r.id && K().releases[id]?.market === 'jp')) milestone(`${g.name}'s Japanese debut: ${r.title}.`, 'fame');
  return result(true, `${r.title} comes out in Japan: ${r.units.physical.toLocaleString('en-US')} copies sold${jp >= 4 ? '; your Japanese in the interviews helps' : ''}.`);
}

// ---------- Acting and hosting ----------

/** Producers cast known idols in dramas directly. An offer arrives as an ordinary acting contract (My Fame). */
export async function actingOffer() {
  const p = player();
  const g = myGroup(p);
  const i = idolOf(p);
  if (!g?.debut) return result(false, 'Debut first.', 'neutral');
  if (i.acts.did.acting) return result(false, 'You have already asked about acting this year.', 'neutral');
  i.acts.did.acting = true;
  const ent = await import('./entertainment.js');
  const want = clamp((i.pop + (p.talents.acting ?? 30) / 2 + (fameOf(p).headline ?? p.hidden.fame ?? 0) / 2 - 40) / 60, 0.05, 0.8);
  if (!rng.chance(want)) return result(false, 'Your manager puts the word out. No drama is casting an idol this year.', 'neutral');
  const prod = ent.makeProduction('tv', 'network', agency(g.agencyId).countryId === 'kr' ? 'kr' : p.countryId);
  if (!prod) return result(false, 'There is no television to act in yet.', 'neutral');
  const idx = prod.cast.findIndex((r) => !r.who && ['supporting', 'lead'].includes(r.kind)) ;
  const c = idx >= 0 ? ent.castDirect(prod, idx, 'cast as an idol') : null;
  if (!c) return result(false, 'The casting falls through.', 'neutral');
  note(`Offered a part in the drama ${prod.title} without an audition.`);
  return result(true, `${prod.title}, a television drama, wants you for a ${prod.cast[idx].kind} part, no audition needed. The offer is waiting under My Fame → Current work.`);
}

/** A year as a music show's MC: weekly live hosting, good for media skills and recognition. */
export function hostShow() {
  const p = player();
  const g = myGroup(p);
  const i = idolOf(p);
  if (!g?.debut) return result(false, 'Debut first.', 'neutral');
  if (i.mc?.year === year()) return result(false, 'You are already hosting this year.', 'neutral');
  const s = skillsOf();
  if (s.media < 55) return result(false, 'Live hosting needs more media training first.', 'neutral');
  if (!rng.chance(clamp((s.media - 50) / 40 + i.pop / 80, 0.1, 0.85))) return result(false, 'The show picks someone else as MC this year.', 'neutral');
  const show = rng.pick(MUSIC_SHOWS.filter((x) => year() >= x.from));
  i.mc = { year: year(), show: show.name, fee: 40000 };
  raise('player', 'media', 4);
  i.pop = clamp(i.pop + 3);
  gain({ audience: 'tv', amount: 4, why: `hosting ${show.name}` }, p);
  if (!(i.mcYears ?? []).length) milestone(`Became an MC of ${show.name}.`, 'fame');
  (i.mcYears ??= []).push(year());
  note(`Hosted ${show.name} for a year.`);
  return result(true, `You are an MC of ${show.name} this year: every week, live.`);
}

// ---------- Merchandise, lightsticks, the fan club ----------

export const LIGHTSTICK_SHAPES = ['star', 'crescent', 'heart', 'prism', 'orb', 'crown'];
export const LIGHTSTICK_COLORS = ['coral', 'mint', 'lavender', 'gold', 'sky blue', 'rose', 'silver', 'ember red'];
/** The official lightstick: designed once, with the members' input if the agency asks for it. */
export function designLightstick(shape, color) {
  const g = myGroup();
  if (!g?.debut) return result(false, 'Debut first.', 'neutral');
  g.merch ??= { lightstick: null, fanclub: null, sales: {} };
  if (g.merch.lightstick) return result(false, `${g.name} already has its lightstick.`, 'neutral');
  if (g.fandom.size < 15000) return result(false, 'There are not yet the fans for an official lightstick.', 'neutral');
  if (!LIGHTSTICK_SHAPES.includes(shape) || !LIGHTSTICK_COLORS.includes(color)) return result(false, 'Not a design.', 'neutral');
  const asked = rng.chance(agency(g.agencyId).welfare / 100 + 0.2);
  g.merch.lightstick = { shape: asked ? shape : rng.pick(LIGHTSTICK_SHAPES), color: asked ? color : rng.pick(LIGHTSTICK_COLORS), year: year(), byMembers: asked };
  g.history.push({ year: year(), text: `The official lightstick: a ${g.merch.lightstick.color} ${g.merch.lightstick.shape}.` });
  return result(asked, asked ? `The lightstick is yours: a ${color} ${shape}.` : `The company had its own design in mind: a ${g.merch.lightstick.color} ${g.merch.lightstick.shape}.`, asked ? 'good' : 'neutral');
}
/** The official fan club: membership, renewed each year by the devoted core. */
export function launchFanclub() {
  const g = myGroup();
  if (!g?.debut) return result(false, 'Debut first.', 'neutral');
  g.merch ??= { lightstick: null, fanclub: null, sales: {} };
  if (g.merch.fanclub) return result(false, 'The fan club is already open.', 'neutral');
  if (g.fandom.size < 20000) return result(false, 'There are not yet enough fans for an official club.', 'neutral');
  g.merch.fanclub = { since: year(), members: Math.round(g.fandom.core * 0.6), generations: 1 };
  g.history.push({ year: year(), text: `The official fan club${g.fandom.name ? `, ${g.fandom.name},` : ''} opened.` });
  return result(true, `The official fan club opens: ${g.merch.fanclub.members.toLocaleString('en-US')} members in the first days.`);
}
/** A year's merchandise: lightsticks, albums' photocards, fan-club memberships. Into the group's accounts. */
function merchYear(g, y) {
  const m = g.merch;
  if (!m) return 0;
  const ls = m.lightstick ? Math.round(g.fandom.core * 0.25 * 45) : 0;
  const fc = m.fanclub ? Math.round((m.fanclub.members = Math.round(g.fandom.core * 0.6)) * 25) : 0;
  const goods = Math.round(g.fandom.size * 0.6);
  m.sales[y] = { lightsticks: ls, fanclub: fc, goods };
  if (m.fanclub && y > m.fanclub.since) m.fanclub.generations = y - m.fanclub.since + 1;
  return ls + fc + goods;
}

// ---------- Dating: the contract's rule, the private life, the rumors ----------

/** What the agency's contract says about dating: some say nothing, some discourage it, a few ask for none in the first years. */
export const datingRule = (g) => { const a = agency(g.agencyId); return a.datingRule ?? (a.welfare >= 70 ? 'none' : a.welfare >= 55 ? 'discouraged' : 'early_years'); };
const DATING_RULES = { none: 'The contract says nothing about dating.', discouraged: 'The company discourages public relationships, but it is not in the contract.', early_years: 'The contract asks members not to date publicly in their first three years after debut.' };
export const datingRuleText = (g) => DATING_RULES[datingRule(g)];

/** A rumor about the player's love life, which may or may not be true; the player answers it. */
function maybeRumor(p, g) {
  const i = idolOf(p);
  const partner = p.npcIds.map((id) => npc(id)).find((n) => n?.alive && ['partner', 'spouse'].includes(n.role));
  const watched = g.fandom.size / 200000 + i.pop / 200;
  if (!rng.chance(clamp(watched * (partner ? 0.6 : 0.25), 0, 0.5))) return null;
  const real = !!partner && rng.chance(0.6);
  const who = real ? partner : null;
  const r = { year: year(), true: real, about: who?.id ?? null, text: real ? `Photos of ${p.firstName} with ${who.firstName}, ${['at a café', 'leaving a restaurant', 'on a quiet street'][rng.int(0, 2)]}.` : `A rumor says ${p.firstName} is dating ${rng.pick(['a member of another group', 'an actor', 'a stylist'])}.`, answered: null };
  (i.rumors ??= []).push(r);
  return r;
}
/** Answers the latest rumor: confirm (only if true), deny (only if false: lying is not an option), or say nothing. */
export function answerRumor(how) {
  const p = player();
  const i = idolOf(p);
  const g = myGroup(p);
  const r = (i.rumors ?? []).find((x) => !x.answered);
  if (!r || !g) return result(false, 'There is nothing to answer.', 'neutral');
  if (how === 'confirm' && !r.true) return result(false, 'There is nothing to confirm.', 'neutral');
  if (how === 'deny' && r.true) return result(false, 'It is true. You can confirm it, or say nothing.', 'neutral');
  r.answered = how;
  const rule = datingRule(g);
  const early = rule === 'early_years' && year() - (g.debut?.year ?? year()) < 3;
  if (how === 'confirm') {
    // Legally your life is your own: the company may be unhappy, but it cannot end anything over it.
    const warmth = rng.chance(0.55);
    g.fandom.engagement = clamp(g.fandom.engagement + (warmth ? 1 : -4));
    i.pop = clamp(i.pop + (warmth ? 1 : -2));
    regard({ favour: warmth ? 3 : -2, why: 'a relationship confirmed' }, p);
    note(`Confirmed a relationship publicly.`);
    return result(true, `${warmth ? 'Most fans are happy for you.' : 'Some fans take it badly; most move on.'}${early ? ' Your manager reminds you of the contract\'s early-years clause; nothing more comes of it.' : ''}`, warmth ? 'good' : 'neutral');
  }
  if (how === 'deny') { regard({ credibility: 1, why: 'a false rumor denied' }, p); return result(true, 'The company issues a statement: the rumor is not true. It fades.', 'neutral'); }
  return result(true, 'You say nothing. The rumor runs for a week, then something else replaces it.', 'neutral');
}
export const openRumor = (p = player()) => (idolOf(p).rumors ?? []).find((x) => !x.answered) ?? null;

// ---------- Moving to Korea properly ----------

/** A trainee or idol living in the agency's city can move there for good: a sponsored work visa through the immigration system. */
export async function relocate() {
  const p = player();
  const i = idolOf(p);
  const a = trainee(p)?.agency ?? agency(myGroup(p)?.agencyId);
  if (!a) return result(false, 'There is no agency to move for.', 'neutral');
  if (p.countryId === a.countryId) return result(false, 'You already live there.', 'neutral');
  if (p.age < 18) return result(false, 'Under eighteen, you live in the dorm on the trainee visa; the family stays where it is.', 'neutral');
  if (hasRecord(p, { sealed: true })) return result(false, 'The visa is refused because of your record.');
  const { emigrate } = await import('./emigration.js');
  const { settle } = await import('./citizenship.js');
  const r = emigrate(a.countryId, { forced: true, city: a.city });
  if (!r.ok) return r;
  if (!rightToLive(a.countryId, p)) { settle(a.countryId, a.city, 'worker'); if (p.residency) { p.residency.route = 'work'; p.residency.until = year() + 4; p.residency.sponsor = a.name; } }
  i.residence = null;
  note(`Moved to ${a.city} for good, on a work visa sponsored by ${a.name}.`);
  return result(true, `You move to ${a.city} properly: ${rightToLive(a.countryId, p) ? 'as a citizen' : `a work visa, sponsored by ${a.name}, for four years`}.`);
}

// ---------- The story so far ----------

/**
 * The idol life as arcs, read from what actually happened (never invented to fit): each arc is not begun,
 * under way, or lived, with the year it was.
 */
export function arcs(p = player()) {
  const i = idolOf(p);
  const k = store.state.kpop ?? K();
  const has = (re) => i.history.find((h) => re.test(h.text));
  const gs = (i.groups ?? []).map((id) => k.groups[id]).filter(Boolean);
  const main = gs.find((g) => !g.parentId);
  const out = [
    ['The first audition', has(/Applied to|Called back/), null],
    ['Life as a trainee', has(/trainee agreement|Became a trainee|trainee place/), has(/Left the trainee|did not renew the trainee|Chosen for the debut/)],
    ['Evaluation pressure', (i.trainee?.evals ?? []).length ? { year: k.evals[i.trainee.evals[0]]?.year } : null, (i.trainee?.evals ?? []).length >= 2 ? { year: k.evals[i.trainee.evals.at(-1)]?.year } : null],
    ['The survival academy', has(/Cast as a contestant/), has(/reached the final|eliminated|debut line-up on/)],
    ['Chosen to debut', has(/Chosen for the debut line-up|Chosen to debut/), main?.debut ? { year: main.debut.year } : null],
    ['The first stage', main?.debut ? { year: main.debut.year } : null, main?.debut ? { year: main.debut.year } : null],
    ['An ending fairy moment', i.fairies.length ? { year: k.performances[i.fairies[0]]?.year } : null, i.fairies.length ? { year: k.performances[i.fairies[0]]?.year } : null],
    ['The first win', main?.firstWin ? { year: k.wins.find((w) => w.id === main.firstWin)?.year } : null, main?.firstWin ? { year: k.wins.find((w) => w.id === main.firstWin)?.year } : null],
    ['Agency pressure', has(/Paused activities|lighter/), has(/Returned to activities/)],
    ['Taking a hiatus', has(/Paused activities/), has(/Returned to activities/)],
    ['Solo debut', i.solo.length ? { year: k.releases[i.solo[0]]?.year } : null, i.solo.length ? { year: k.releases[i.solo[0]]?.year } : null],
    ['Contract renewal', has(/Renewed with|Left .* at the end of the contract|but kept doing/), has(/Renewed with|Left .* at the end of the contract|but kept doing/)],
    ['The reunion', has(/Reunited with/), has(/Reunited with/)],
  ];
  return out.map(([name, begun, done]) => ({ name, status: done ? 'lived' : begun ? 'under way' : 'not begun', year: (done ?? begun)?.year ?? null }));
}

// ---------- The rest of the year ----------

/** Called from tickKpop: subunits and merchandise settle, health from a hard year, rumors, hosting fees. */
function yearExtras(p, lived, lines) {
  const k = K();
  const i = idolOf(p);
  for (const g of Object.values(k.groups)) {
    if (g.parentId && g.status === 'active' && g.debut && year() - g.debut.year >= 2 && rng.chance(0.4)) { g.status = 'inactive'; g.history.push({ year: year(), text: `${g.name} wound down; the members went back to the main group.` }); }
    if (g.merch && g.ledger?.years?.[lived]) {
      const extra = merchYear(g, lived);
      const s = g.ledger.years[lived];
      if (!s.paid && extra) {
        const share = agency(g.agencyId).artist.artistShare;
        const ids = Object.keys(s.perMember);
        const add = Math.round(extra * share / Math.max(1, ids.length));
        for (const w of ids) s.perMember[w] += w === 'player' ? Math.round(wageIn(add, COUNTRIES[agency(g.agencyId).countryId], COUNTRIES[p.countryId])) : add;
        s.merch = extra;
      }
    }
  }
  const g = myGroup(p);
  // A hard year shows in the body: a health record, which a break and care can clear.
  if (g && (i.workloadLast ?? 0) >= 2 && !i.hiatus) {
    const a = agency(g.agencyId);
    if (rng.chance(clamp((100 - a.welfare) / 250 + (p.stats.health < 50 ? 0.15 : 0), 0.02, 0.4))) {
      const cond = rng.chance(0.5) ? 'exhaustion' : 'dance_injury';
      if (addCondition(cond)) { lines.push(cond === 'exhaustion' ? 'The schedule has caught up with you: a doctor tells you that you are exhausted, and need rest.' : 'You have hurt yourself in rehearsal. It needs rest to heal.'); note(cond === 'exhaustion' ? 'Diagnosed with exhaustion after a hard year.' : 'Injured in rehearsal.'); }
    }
  }
  if (g?.debut) { const r = maybeRumor(p, g); if (r) lines.push(`A story in the press: ${r.text}`); }
  if (i.mc?.year === lived && !i.mc.paid) i.mc.due = true;
}

/** A health break records the condition it is for, and care while on the break clears it. */
function healthRecord(kind) {
  const p = player();
  const i = idolOf(p);
  const idolConds = (p.conditions ?? []).filter((c) => ['exhaustion', 'dance_injury', 'anxiety', 'depression'].includes(c.id));
  if (kind !== 'health') return;
  if (!idolConds.length && p.stats.health < 60) addCondition('exhaustion');
  i.hiatus.conditions = (p.conditions ?? []).filter((c) => ['exhaustion', 'dance_injury', 'anxiety', 'depression'].includes(c.id)).map((c) => c.id);
  for (const c of p.conditions ?? []) if (i.hiatus.conditions.includes(c.id)) c.treated = true; // care while on the break
}
function healthReturn() {
  const p = player();
  const h = idolOf(p).hiatus;
  for (const id of h?.conditions ?? []) if (['exhaustion', 'dance_injury'].includes(id)) cureCondition(id);
}
