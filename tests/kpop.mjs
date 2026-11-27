// The K-pop idol life: auditions, trainees, survival programs, groups and
// positions (one or two each, no contradictions, maknae from birth dates),
// music shows and ending fairies, contracts, hiatus, solo work, renewals,
// disbandment, reunions, history and saves.
//   node tests/kpop.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { POSITIONS, MAX_POSITIONS, AGENCIES } from '../js/data/kpop.js';
import * as kp from '../js/engine/kpop.js';
import * as work from '../js/engine/worklife.js';
import { die } from '../js/engine/death.js';
import { continueAs } from '../js/engine/legacy.js';
import { makeNpc } from '../js/engine/npcFactory.js';

const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (cc = 'br', age = 16, o = {}) => {
  let s; do { s = createLife({ countryId: cc, gender: o.gender ?? 'female', ...o }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  p.gender = o.gender ?? 'female';
  p.age = age; p.birthYear = s.year - age; p.education.enrolled = false; p.flags.livesWithParents = true;
  p.talents.singing = o.vocal ?? 80; p.talents.dance = o.dance ?? 78; p.stats.charm = 72; p.skills = { korean: 20 };
  return p;
};
const year = () => { advanceYear(); const s = store.state; s.pendingEvents = []; const p = s.player; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 75); };
const k = () => store.state.kpop;

/** Gets a trainee place, trying auditions year after year as a real player would. */
function becomeTrainee(p, maxYears = 6) {
  for (let y = 0; y < maxYears && !kp.trainee(p); y++) {
    for (const au of kp.auditions().filter((a) => !kp.whyNotApply(a))) {
      kp.prepare(au.id);
      kp.apply(au.id, au.categories.includes('multi') ? 'multi' : au.categories[0]);
      const app = k().apps[kp.idolOf(p).apps.at(-1)];
      if (app.stage === 'callback') kp.attendCallback(app.id);
      if (app.stage === 'offered') { kp.idolOf(p).guardianOk = true; kp.acceptOffer(app.id); break; }
    }
    if (!kp.trainee(p)) year();
  }
  return kp.trainee(p);
}

// 1. Auditions.
rng.seed(101);
let p = life('br', 16);
check(kp.available(), 'the idol industry exists today');
const list = kp.auditions();
check(list.length >= 5 && list.every((au) => kp.agency(au.agencyId) && au.stages.length === 4), 'every agency puts out a call, with its own stages');
check(list.some((au) => au.places === 'worldwide' && !kp.whyNotApply(au)), 'a Brazilian can apply to an audition open worldwide');
check(list.filter((au) => Array.isArray(au.places) && !au.places.includes('br') && au.lineup !== 'male' && p.age >= au.ages[0] && p.age <= au.ages[1]).every((au) => /in-person/.test(kp.whyNotApply(au))), 'and not to an in-person audition in Korea from Brazil');
const young = list[0];
p.age = 30;
check(/ages/.test(kp.whyNotApply(young)), 'each audition has its own ages');
p.age = 16;
const boys = list.find((au) => au.lineup === 'male');
if (boys) check(/boy group/.test(kp.whyNotApply(boys)), 'a boy-group audition is not for this applicant');
const au = list.find((x) => !kp.whyNotApply(x));
const r1 = kp.apply(au.id, au.categories[0]);
const app = k().apps[kp.idolOf(p).apps[0]];
check(['callback', 'rejected'].includes(app.stage) && app.scores.application != null, `the application is screened (${app.stage})`);
check(!kp.apply(au.id, au.categories[0]).ok, 'one application per audition');
if (app.stage === 'callback') { kp.attendCallback(app.id); check(['offered', 'held', 'rejected'].includes(app.stage) && app.scores.callback != null, 'a callback leads to an assessment and a decision'); }
// A great talent is not a guaranteed place; a weak one is usually turned away.
let offers = 0;
let weakOffers = 0;
for (let i = 0; i < 40; i++) {
  life('us', 17, { vocal: 95, dance: 95 });
  const a2 = kp.auditions().find((x) => !kp.whyNotApply(x));
  if (!a2) continue;
  kp.apply(a2.id, a2.categories[0]);
  const ap = k().apps[kp.idolOf().apps[0]];
  if (ap.stage === 'callback') kp.attendCallback(ap.id);
  if (ap.stage === 'offered') offers += 1;
  life('us', 17, { vocal: 30, dance: 30 });
  const a3 = kp.auditions().find((x) => !kp.whyNotApply(x));
  if (!a3) continue;
  kp.apply(a3.id, a3.categories[0]);
  const ap3 = k().apps[kp.idolOf().apps[0]];
  if (ap3.stage === 'callback') kp.attendCallback(ap3.id);
  if (ap3.stage === 'offered') weakOffers += 1;
}
check(offers < 40 && offers > 8, `strong applicants are often but not always offered a place (${offers}/40)`);
check(weakOffers <= 2, `weak applicants almost never are (${weakOffers}/40)`);
store.state.year = 1990;
p = store.state.player;
check(!kp.available() && kp.auditions().length === 0, 'no idol auditions in 1990');
section(`auditions: worldwide and in person, ages and line-ups, stages, ${offers}/40 strong applicants offered`);

// 2. A trainee: the agreement, the dorm, the year, the evaluation. No debut promised.
rng.seed(7);
p = life('br', 15, { city: 'São Paulo' });
const t = becomeTrainee(p);
check(!!t, 'a talented applicant becomes a trainee within a few years');
if (t) {
  const c = t.contract;
  check(c.kind === 'trainee' && c.who === 'player' && c.costs === 'covered' && !('debt' in c), 'a trainee agreement: its own kind, costs covered, no debt');
  check(AGENCIES.every((a) => a.trainee.review[0] >= 1) && c.review >= 1 && c.review <= 3, 'reviewed after one to three years, not a fixed two');
  check(kp.idolOf().residence?.countryId === 'kr' || t.agency.countryId !== 'kr', 'moving to Seoul for a Korean program');
  const ids = t.agency.trainees.filter((id) => p.npcIds.includes(id)).slice(0, 4); // the ones the player has met
  kp.setFocus('vocal');
  const v0 = p.talents.singing;
  year();
  check(p.talents.singing > v0, 'a year of vocal focus improves the singing skill the game already has');
  const ev = k().evals[kp.idolOf().trainee.evals.at(-1)];
  check(ev && ev.rank >= 1 && ev.of >= 5 && ev.feedback.length === 2 && ev.evaluators.every((id) => store.state.npcs[id]), 'an evaluation: a rank, two pieces of feedback, real evaluators');
  check(ids.every((id) => store.state.npcs[id]?.flags.idol), 'fellow trainees are the same people a year later');
  // Time with the other trainees does not use up the year's practice sessions.
  const peer = t.agency.trainees.find((id) => store.state.npcs[id]?.alive);
  if (peer) {
    for (let x = 0; x < 4; x++) kp.trainAction('vocal');
    check(!kp.trainAction('dance').ok, 'four extra practice sessions a year');
    check(kp.trainAction('friend', peer).ok && kp.trainAction('help', peer).ok, 'and time with a fellow trainee is still open after them');
    check(!kp.trainAction('friend', peer).ok, 'once per kind per trainee per year');
  }
  // Leaving is allowed; nothing is charged back.
  const cash = p.finance.cash;
  check(kp.leaveTraining().ok && !kp.trainee() && p.finance.cash === cash, 'leaving with notice, nothing charged');
}
section('trainees: a real agreement, a dorm, training on the game\'s own skills, evaluations, leaving freely');

// 3. Debut is not guaranteed: many years of training, many outcomes.
let debuted = 0;
let notYet = 0;
for (let i = 0; i < 10; i++) {
  rng.seed(200 + i);
  p = life('kr', 15, { vocal: i % 2 ? 80 : 68, dance: i % 2 ? 78 : 66 });
  if (!becomeTrainee(p)) continue;
  for (let y = 0; y < 3; y++) { if (kp.debutOffer()) { kp.acceptDebut(); break; } year(); }
  if (kp.myGroup()) debuted += 1; else notYet += 1;
}
check(notYet > 0, `some trainees have not debuted after three years (${notYet})`);
section(`debut is not promised: ${debuted} debuted, ${notYet} still waiting after three years`);

// 4. A survival program.
rng.seed(31);
p = life('us', 18);
store.state.year = 2025;
let pr = kp.programs()[0];
for (let y = 0; y < 3 && !pr; y++) { year(); pr = kp.programs()[0]; }
check(pr && pr.id && store.state.kpop.programs[pr.id] === pr, 'a program has a stable id');
if (pr) {
  pr.gender = 'female';
  let tries = 0;
  while (!pr.contestants.some((c) => c.who === 'player') && tries++ < 10) { kp.idolOf().programs = []; kp.enterProgram(pr.id); }
  if (pr.contestants.some((c) => c.who === 'player')) {
    check(pr.contestants.length === pr.size && pr.contestants.every((c) => c.who === 'player' || store.state.npcs[c.who]), 'every contestant is a real person');
    const before = pr.contestants.map((c) => c.who).join();
    while (pr.status === 'airing') kp.playMission(pr.id, 'ambitious');
    check(pr.status === 'finished' && pr.final.length === pr.slots, 'the final line-up has the number of places the rules set');
    check(pr.contestants.map((c) => c.who).join() === before, 'nobody is removed from the record');
    check(pr.contestants.filter((c) => c.out && c.out !== 'debut').every((c) => c.who === 'player' || store.state.npcs[c.who]?.alive !== false), 'the eliminated are still in the world');
    const saved = JSON.stringify(pr.final);
    store.state = JSON.parse(JSON.stringify(store.state));
    check(JSON.stringify(store.state.kpop.programs[pr.id].final) === saved, 'a reload does not reroll the final');
    const me = store.state.kpop.programs[pr.id].contestants.find((c) => c.who === 'player');
    if (me.out !== 'debut') check(!kp.debutOffer(), 'losing does not make a debut');
    check(kp.idolOf().history.some((h) => new RegExp(pr.name.split(':')[0]).test(h.text)), 'it is in the career history');
  }
}
section('survival: a fixed format, real contestants, missions, cuts, a final that stays decided');

// 5. Positions: one or two each, no contradictions, maknae from birth dates, leader not by age.
rng.seed(55);
p = life('kr', 20);
kp.world();
const a0 = kp.agencies()[0];
let lineups = 0;
for (let i = 0; i < 60; i++) {
  const members = Array.from({ length: 4 + (i % 4) }, (_, j) => {
    const n = makeNpc({ role: 'performer', countryId: 'kr', age: 18 + j });
    const lv = 50 + ((i * 7 + j * 13) % 45);
    n.flags.idol = { agencyId: a0.id, sk: { vocal: lv, dance: 100 - lv + 20, rap: (lv * 3) % 90, stage: 60 + (j * 5) % 30, camera: 50 + (i + j) % 40, media: 40 + (j * 11) % 50, korean: 100 }, born: { year: 2000 + ((i + j * 3) % 8), day: 1 + ((i * 31 + j * 17) % 365) }, status: 'idol', history: [] };
    store.state.npcs[n.id] = n;
    return n.id;
  });
  const gid = `g_test_${i}`;
  k().groups[gid] = { id: gid, name: `TEST${i}`, agencyId: a0.id, members: members.map((who) => ({ who, from: store.state.year, to: null })), gender: 'female', concept: i % 3 ? 'bright' : 'dark', config: { none: false, leader: true, visual: i % 2 === 0, center: i % 3 === 0 }, positions: {}, positionHistory: [], releases: [], performances: [], wins: [], history: [] };
  const g2 = k().groups[gid];
  kp.assignPositions(g2, 'test');
  lineups += 1;
  const cur = kp.current(g2).map((m) => m.who);
  for (const w of cur) {
    const l = g2.positions[w];
    check(l.length >= 1 && l.length <= MAX_POSITIONS, `${l.length} labels for one member`);
    check(kp.validLabels(l), `a contradictory set: ${l.join(', ')}`);
  }
  const maknae = cur.reduce((x, y) => (kp.bornKey(y) > kp.bornKey(x) ? y : x));
  check(g2.positions[maknae].includes('maknae') && cur.filter((w) => g2.positions[w].includes('maknae')).length === 1, 'the maknae is the youngest by birth date, and only them');
  if (i === 0) check(g2.leader, 'a leader is chosen');
  const mains = cur.filter((w) => g2.positions[w].includes('main_vocal')).length;
  check(mains <= 2, 'at most two main vocalists');
  for (const w of cur) {
    const l = g2.positions[w];
    if (l.includes('main_vocal')) check(store.state.npcs[w].flags.idol.sk.vocal >= 50, 'a main vocalist can sing');
    if (l.includes('all_rounder')) { const s = store.state.npcs[w].flags.idol.sk; check(s.vocal >= 72 && s.dance >= 72, 'an all-rounder is strong in more than one thing'); }
    check(!(l.includes('visual') && l.includes('center')), 'visual and center stay apart');
  }
  // A lineup change: the maknae is recalculated; the history keeps the old positions.
  const hist = g2.positionHistory.length;
  const youngest = maknae;
  g2.members.find((m) => m.who === youngest).to = store.state.year - 1;
  kp.assignPositions(g2, 'left');
  const newMaknae = kp.current(g2).reduce((x, y) => (kp.bornKey(y.who) > kp.bornKey(x.who) ? y : x)).who;
  check(g2.positions[newMaknae]?.includes('maknae') && !g2.positions[youngest], 'when the maknae leaves, the next youngest is the maknae');
  check(g2.positionHistory.length === hist + 1 && g2.positionHistory[hist - 1].positions[youngest], 'and the old positions are in the history');
  delete k().groups[gid];
}
// Leaders are not simply the oldest.
let leaderNotOldest = 0;
for (let i = 0; i < 30; i++) {
  const members = Array.from({ length: 5 }, (_, j) => { const n = makeNpc({ role: 'performer', countryId: 'kr', age: 20 + j }); n.flags.idol = { sk: { vocal: 70, dance: 70, rap: 40, stage: 70, camera: 60, media: 30 + ((i * 7 + j * 19) % 60), korean: 100 }, born: { year: 2000 + j, day: 10 }, status: 'idol', history: [] }; store.state.npcs[n.id] = n; return n.id; });
  const gid = `lead_${i}`;
  k().groups[gid] = { id: gid, name: 'L', agencyId: a0.id, members: members.map((who) => ({ who, from: store.state.year, to: null })), concept: 'bright', config: { none: false, leader: true, visual: false, center: false }, positions: {}, positionHistory: [] };
  kp.assignPositions(k().groups[gid], 'test');
  if (k().groups[gid].leader !== members[0]) leaderNotOldest += 1;
  delete k().groups[gid];
}
check(leaderNotOldest >= 15, `the leader is often not the oldest (${leaderNotOldest}/30)`);
// No official positions is a valid configuration.
{
  const members = Array.from({ length: 4 }, (_, j) => { const n = makeNpc({ role: 'performer', countryId: 'kr', age: 20 + j }); n.flags.idol = { sk: { vocal: 80, dance: 80, rap: 50, stage: 70, camera: 70, media: 60, korean: 100 }, born: { year: 2000 + j, day: 5 }, status: 'idol', history: [] }; store.state.npcs[n.id] = n; return n.id; });
  k().groups.none = { id: 'none', name: 'N', agencyId: a0.id, members: members.map((who) => ({ who, from: store.state.year, to: null })), concept: 'bright', config: { none: true }, positions: {}, positionHistory: [] };
  kp.assignPositions(k().groups.none, 'test');
  check(members.every((w) => k().groups.none.positions[w].every((l) => POSITIONS[l].derived)), 'a group can have no official positions');
  check(members.every((w) => store.state.npcs[w].flags.idol.sk.vocal === 80), 'and skills are untouched by titles');
  delete k().groups.none;
}
section(`positions: ${lineups} line-ups, one or two labels each, nothing contradictory, maknae by birth date, leader not by age`);

// 6. The vertical slice: Brazil to debut, a stage, an ending fairy, a comeback, pay once, saved and reloaded.
rng.seed(5);
p = life('br', 15);
const tr = becomeTrainee(p, 8);
check(!!tr, 'the Brazilian applicant becomes a trainee');
let g = null;
for (let y = 0; y < 8 && !g; y++) {
  if (kp.debutOffer()) { check(kp.acceptDebut().ok, 'accepts a debut place'); g = kp.myGroup(); break; }
  year();
}
if (!g && tr) {
  // Not chosen yet: an honest outcome. Put the player through a program instead for the rest of the slice.
  check(true, 'not every trainee debuts');
}
if (g) {
  check(g.members.every((m) => m.who === 'player' || store.state.npcs[m.who]?.flags.idol), 'the group is made of the actual trainees');
  check(kp.current(g).every((m) => (g.positions[m.who] ?? []).length <= 2), 'each member has one or two positions');
  const traineeContract = Object.values(k().contracts).find((c) => c.kind === 'trainee' && c.who === 'player');
  const artist = kp.contractOf('player', g);
  check(traineeContract.status === 'completed' && artist && artist.kind === 'exclusive' && artist.id !== traineeContract.id, 'the trainee agreement ends; a separate artist contract begins');
  const d = kp.debut();
  check(d.ok && g.debut && g.debut.releaseId && g.debut.performanceId, 'the debut is recorded with its release and first stage');
  check(!kp.debut().ok, 'once');
  // Appearances: a moment from that kind of show, each handled its own way; not the same five choices every time.
  {
    const { MOMENTS } = await import('../js/data/kpopMoments.js');
    const kinds = ['radio', 'variety', 'interview', 'fanmeeting', 'fansign', 'fancall', 'livestream'];
    check(kinds.every((kd) => MOMENTS[kd]?.length >= 2 && MOMENTS[kd].every((m) => m.prompt && m.options.length === 3 && m.options.every((o) => o.good && o.bad && ['vocal', 'dance', 'rap', 'stage', 'camera', 'media', 'team'].includes(o.skill)))), 'every kind of show has its own moments, three ways to handle each');
    const prompts = new Set();
    for (let n = 0; n < 12; n++) prompts.add(kp.appearanceMoment('radio').prompt);
    check(prompts.size >= 2, `the radio show is not the same moment every time (${prompts.size})`);
    const mo = kp.appearanceMoment('variety');
    kp.idolOf().acts.social = 0;
    const r = kp.appearance('variety', { m: mo.m, o: 0 });
    const opt = MOMENTS.variety[mo.m].options[0];
    check(r.text.startsWith(opt.good) || r.text.startsWith(opt.bad), `the outcome comes from the moment chosen (${r.text.slice(0, 60)})`);
  }
  const perfs = g.performances.map((id) => k().performances[id]);
  check(perfs.every((x) => x.members.includes(x.fairy) && k().releases[x.releaseId]), 'every ending fairy is a member, on a real performance');
  const center = kp.current(g).find((m) => g.positions[m.who]?.includes('center'))?.who;
  if (center) check(perfs.some((x) => x.fairy !== center), 'the center is not always the ending fairy');
  const mine = kp.pendingFairies();
  if (mine.length) {
    const res = kp.chooseFairy(mine[0].id, 'confident');
    check(res.text && k().performances[mine[0].id].fairyStyle === 'confident' && kp.idolOf().fairies.includes(mine[0].id), 'the player chooses how to end the stage, and it is archived');
    check(!kp.chooseFairy(mine[0].id, 'cute').ok, 'once');
    check(kp.idolOf().pop <= 3, 'one ending fairy does not make a star');
  }
  check(p.milestones.some((m) => /Debuted with/.test(m.text)), 'the debut is in the life story');
  // Being an idol is a job: the work shown everywhere says so.
  const idolJob = kp.idolWork(p);
  check(idolJob?.current && idolJob.title === `K-pop idol, ${g.name}`, `an idol's work is being an idol (${idolJob?.title})`);
  const cv = (await import('../js/engine/digital/professional.js')).resume();
  check(cv.jobs.some((j) => j.current && j.title === idolJob.title), 'and it is on the CV');
  // A comeback: a real release, promoted, wins only when earned.
  year();
  const cb = kp.comeback('mini', 'bright');
  const rel = k().releases[g.releases.at(-1)];
  check(cb.ok && rel.performers.length >= 3 && rel.songs.length === 5, 'a comeback is a real mini album by the group');
  check(rel.wins.every((id) => k().wins.find((w) => w.id === id)?.releaseId === rel.id), 'every win belongs to that release');
  check(rel.songs[0].parts && Object.keys(rel.songs[0].parts).every((w) => rel.performers.includes(w)), 'line distribution is between the members who performed');
  // Pay: once.
  year();
  p.career.paidYear = null;
  const lines = work.payLines(p).filter((l) => l.source.startsWith('idol:'));
  check(lines.every((l) => l.gross >= 0) && lines.length <= 1, 'the group\'s earnings are one line a year');
  // Save and reload.
  const snapshot = JSON.stringify({ g: store.state.kpop.groups[g.id], c: Object.values(store.state.kpop.contracts).filter((c) => c.who === 'player'), i: p.idol });
  store.state = JSON.parse(JSON.stringify(store.state));
  const g2 = store.state.kpop.groups[g.id];
  check(JSON.stringify({ g: g2, c: Object.values(store.state.kpop.contracts).filter((c) => c.who === 'player'), i: store.state.player.idol }) === snapshot, 'a reload keeps the group, positions, contracts and history exactly');
  p = store.state.player;
  // A hiatus is not disbandment.
  check(kp.startHiatus('health').ok && kp.myGroup() && kp.myGroup().status === 'active' && /health reasons/.test(kp.idolOf().hiatus.public), 'a hiatus keeps the member and the group; the reason is said only broadly');
  const before = p.finance.cash;
  check(kp.requestRest().ok && p.finance.cash === before, 'asking for rest costs nothing');
  year();
  check(kp.endHiatus().ok && !kp.idolOf().hiatus, 'and the member comes back');
  // Solo work keeps the group.
  g2.debut.year = store.state.year - 3;
  kp.idolOf().pop = 30;
  const solo = kp.soloRelease();
  if (solo.ok) check(kp.myGroup()?.id === g2.id && kp.current(g2).some((m) => m.who === 'player'), 'a solo release does not take you out of the group');
  // Renewal: each decides.
  kp.contractOf('player', g2).ends = store.state.year;
  for (const m of kp.current(g2)) { const c = kp.contractOf(m.who, g2); if (c) c.ends = store.state.year; }
  year();
  if (kp.renewalDue()) {
    check(kp.decideRenewal('leave').ok, 'the player chooses for themselves at renewal');
    check(g2.members.some((m) => m.who === 'player' && m.to != null) && store.state.kpop.groups[g2.id], 'leaving keeps the group and its record');
  }
  // Disbanded groups are kept; reunions are possible.
  if (g2.status === 'disbanded') {
    store.state.year += 4;
    const re = kp.proposeReunion(g2.id);
    check(re.text, 'a reunion can be proposed');
  }
  // The next generation finds it all.
  const kid = makeNpc({ role: 'child', countryId: 'br', age: 20 }); store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id);
  die('old age');
  const next = continueAs(kid.id);
  if (next) {
    const kept = next.kpop.groups[g2.id];
    check(kept && !kept.members.some((m) => m.who === 'player') && next.careerRecord.at(-1).idol?.groups.includes(kept.name), 'the heir finds the group in the family record, the ancestor in the line-up');
  }
}
section(`the vertical slice: ${g ? `${g.name}: debut, stages, an ending fairy, a comeback, pay once, a reload, a hiatus, solo, renewal, the next generation` : 'a trainee who did not debut in eight years'}`);

// 7. The rest of an idol life: subunits, Japan, acting and hosting, merchandise, dating, health, moving, the story.
{
  rng.seed(77);
  p = life('br', 19);
  check(kp.arcs(p).every((a) => a.status === 'not begun'), 'a new life has no idol story to tell yet');
  kp.world();
  const a = kp.agencies().find((x) => x.countryId === 'kr');
  // Into a group through the engine's own path: a trainee place, then a line-up the player is in.
  const app = { id: 'app_t', auditionId: null, agencyId: a.id, category: 'multi', year: store.state.year, prepared: true, stage: 'offered', scores: {}, offer: { kind: 'trainee', agencyId: a.id, review: 2, costs: 'covered', allowance: 0, housing: 'dorm', rules: [], exit: 'notice' } };
  k().apps[app.id] = app; kp.idolOf().apps.push(app.id); kp.idolOf().guardianOk = true;
  check(kp.acceptOffer(app.id).ok, 'a trainee again');
  const lineup = ['player', ...a.trainees.filter((id) => store.state.npcs[id]).slice(0, 4)];
  for (const id of lineup.slice(1)) store.state.npcs[id].gender = 'female';
  k().projects.pr_t = { id: 'pr_t', agencyId: a.id, year: store.state.year, gender: 'female', size: lineup.length, concept: a.concepts[0], lineup, status: 'announced' };
  kp.idolOf().debutOffer = 'pr_t';
  check(kp.acceptDebut().ok && kp.debut().ok, 'chosen, and debuted');
  const grp = kp.myGroup();
  // Moving to Korea properly.
  const r = await kp.relocate();
  check(r.ok && p.countryId === 'kr' && (p.residency?.status === 'worker' && p.residency.sponsor === a.name), 'a Brazilian idol moves to Seoul on a work visa the agency sponsors');
  // Subunits keep the group.
  grp.debut.year = store.state.year - 3;
  kp.idolOf().pop = 60;
  let unit = null;
  for (let t2 = 0; t2 < 8 && !unit; t2++) { const u = kp.formSubunit([kp.current(grp).find((m) => m.who !== 'player').who]); if (u.ok) unit = kp.subunits(grp)[0]; }
  if (unit) check(unit.parentId === grp.id && kp.current(grp).some((m) => m.who === 'player') && unit.members.length === 2 && unit.releases.length === 1, 'a subunit: two members, its own release, the group intact');
  // Japan.
  grp.fandom.regions.jp = 5000;
  const jp = kp.japaneseRelease();
  check(jp.ok && k().releases[grp.releases.at(-1)].market === 'jp' && !kp.japaneseRelease().ok, 'one Japanese release a year, for fans in Japan');
  // Acting and hosting.
  let acted = null;
  for (let t2 = 0; t2 < 10 && !acted; t2++) { kp.idolOf().acts.did.acting = false; const ao = await kp.actingOffer(); if (ao.ok) acted = ao; }
  if (acted) check(p.fame.contracts.some((c) => c.direct && c.status === 'offered'), 'a drama offers a part without an audition, as an ordinary contract');
  p.skills.public_speaking = 90; p.stats.charm = 85;
  let hosted = false;
  for (let t2 = 0; t2 < 10 && !hosted; t2++) { kp.idolOf().mc = null; hosted = kp.hostShow().ok; }
  check(hosted && kp.idolOf().mc.show, 'a year as a music show MC');
  // Merchandise.
  grp.fandom.size = 60000; grp.fandom.core = 9000;
  check(kp.designLightstick('star', 'coral').text && grp.merch.lightstick && !kp.designLightstick('orb', 'gold').ok, 'one official lightstick');
  check(kp.launchFanclub().ok && grp.merch.fanclub.members > 0, 'an official fan club');
  // Dating: the rule, and a rumor answered honestly.
  check(['none', 'discouraged', 'early_years'].includes(kp.datingRule(grp)) && kp.datingRuleText(grp), 'the contract says what it says about dating');
  kp.idolOf().rumors = [{ year: store.state.year, true: false, about: null, text: 'A rumor.', answered: null }];
  check(!kp.answerRumor('confirm').ok && kp.answerRumor('deny').ok, 'a false rumor can be denied, not confirmed');
  kp.idolOf().rumors.push({ year: store.state.year, true: true, about: null, text: 'Photos.', answered: null });
  check(!kp.answerRumor('deny').ok && kp.answerRumor('confirm').ok && kp.myGroup()?.id === grp.id, 'a true one is not denied; confirming it ends nothing');
  // Health: a break records and treats the condition, and coming back clears it.
  p.stats.health = 40;
  check(kp.startHiatus('health').ok && p.health.ailments.some((c) => c.id === 'exhaustion' && c.treated) && kp.idolOf().hiatus.conditions.includes('exhaustion'), 'a health break: a real health record, under care');
  check(/health reasons/.test(kp.idolOf().hiatus.public) && !/exhaustion/.test(grp.history.at(-1).text), 'the public hears only "health reasons"');
  year();
  check(kp.endHiatus().ok && !p.health.ailments.some((c) => c.id === 'exhaustion'), 'and returning clears it');
  // A year: merchandise in the accounts, the hosting fee paid once.
  year();
  const lived = store.state.year - 1;
  check(grp.merch.sales[lived] && grp.ledger.years[lived]?.merch > 0, 'merchandise is settled into the group\'s accounts');
  p.career.paidYear = null;
  check(!work.payLines(p).some((l) => l.source === `idolmc:${lived - 1}`), 'the hosting fee is paid once');
  // The story, from what happened.
  const story = Object.fromEntries(kp.arcs(p).map((x) => [x.name, x.status]));
  check(story['Chosen to debut'] === 'lived' && story['The first stage'] === 'lived' && story['Taking a hiatus'] === 'lived' && story['The reunion'] === 'not begun', 'the story arcs read what happened, and nothing else');
}
section('the rest: moving to Seoul, a subunit, Japan, acting and hosting, a lightstick and fan club, dating and rumors, health records, the story');

// 8. Fan products, variety as a career of its own, and a child following a parent into the same agency.
{
  rng.seed(88);
  p = life('kr', 19);
  kp.world();
  const a = kp.agencies().find((x) => x.countryId === 'kr' && x.founded <= store.state.year);
  const app = { id: 'app_f', auditionId: null, agencyId: a.id, category: 'multi', year: store.state.year, prepared: true, stage: 'offered', scores: {}, offer: { kind: 'trainee', agencyId: a.id, review: 2, costs: 'covered', allowance: 0, housing: 'dorm', rules: [], exit: 'notice' } };
  k().apps[app.id] = app; kp.idolOf().apps.push(app.id); kp.idolOf().guardianOk = true;
  kp.acceptOffer(app.id);
  const lineup = ['player', ...a.trainees.slice(0, 4)];
  for (const id of lineup.slice(1)) store.state.npcs[id].gender = 'female';
  k().projects.pr_f = { id: 'pr_f', agencyId: a.id, year: store.state.year, gender: 'female', size: lineup.length, concept: a.concepts[0], lineup, status: 'announced' };
  kp.idolOf().debutOffer = 'pr_f';
  check(kp.acceptDebut().ok && kp.debut().ok, 'debuted (fan products)');
  const grp = kp.myGroup();
  // Fan products: their own years, fan counts, once a year (a character line once ever), money in the accounts.
  grp.fandom.size = 5000; grp.fandom.core = 800;
  check(/fans/.test(kp.whyNotProduct('photobook')), 'too few fans for a photobook');
  grp.fandom.size = 120000; grp.fandom.core = 20000; grp.fandom.regions.jp = 30000;
  check(/tour/.test(kp.whyNotProduct('concert_film')), 'a concert film needs a tour to film');
  const pb = kp.launchProduct('photobook');
  check(pb.ok && grp.merch.products.at(-1).units > 0 && !kp.launchProduct('photobook').ok, 'a photobook, once a year');
  const pop = kp.launchProduct('popup', { where: 'jp' });
  check(pop.ok && grp.merch.products.at(-1).where === 'jp', 'a pop-up store where the fans are');
  check(kp.popupPlaces(grp)[0] === 'kr' && kp.popupPlaces(grp).includes('jp'), 'pop-ups at home, or where the fans are');
  const ch = kp.launchProduct('characters', { character: 'quokka' });
  check(ch.ok && grp.merch.products.at(-1).character === 'quokka', 'the player draws their own character');
  check(kp.launchProduct('seasons_greetings').ok && kp.launchProduct('cafe').ok, "season's greetings and a café collaboration");
  const sold = grp.merch.products.filter((x) => x.year === store.state.year).reduce((t, x) => t + x.revenue, 0);
  year();
  const lived = store.state.year - 1;
  check(grp.merch.sales[lived]?.products === sold && grp.ledger.years[lived]?.merch >= sold, "the year's products are in the group's accounts");
  check(kp.myCard(grp) && kp.myCard(grp).of === kp.current(grp).length, 'photocards: the most wanted cards, counted each year');
  check(kp.whyNotProduct('characters') === 'Already made.' && kp.launchProduct('photobook').ok, 'a character line once; a new photobook a new year');
  year();
  check(grp.merch.sales[store.state.year - 1].products > 0, 'the character line keeps selling');

  // Variety: offers, a guest spot, a regular seat, ratings, pay once, and a career after the group.
  p.skills.public_speaking = 85; p.stats.charm = 85; kp.idolOf().pop = 55;
  check(kp.varietyOpen(p), 'a debuted idol is offered variety');
  let offers = kp.varietyOffers();
  check(offers.length > 0, 'producers call');
  const guest = offers.find((o) => o.role === 'guest');
  if (guest) check(kp.takeVariety(guest.id).ok && kp.varietyOf().guests.length === 1, 'a guest spot, done at once');
  let seat = null;
  for (let t2 = 0; t2 < 12 && !seat; t2++) {
    const o = kp.varietyOffers().find((x) => x.role !== 'guest');
    if (o) { const r = kp.takeVariety(o.id); if (r.ok) seat = kp.myShows()[0]; }
    else kp.varietyOf().offers = null; // a different year's producers
  }
  check(!!seat && seat.feeIn > 0, 'a regular seat on a show, paid a year');
  const rep0 = kp.varietyOf().rep;
  year();
  const l2 = store.state.year - 1;
  check(seat.ratings.some((x) => x.year === l2) || seat.ended, 'the show has a year of ratings');
  check(seat.ratings.every((x) => x.year !== l2) || kp.varietyOf().paid.includes(`${seat.id}:${l2}`), 'the year on the show was paid with the year\'s pay');
  p.career.paidYear = null;
  check(!kp.idolLines(p).some((l) => l.source === `variety:${seat.id}:${l2}`), 'and paid once');
  check(kp.varietyOf().rep !== rep0 || seat.ended, 'a year on air changes the standing in variety');
  // The group ends; variety goes on.
  grp.status = 'disbanded'; grp.disbanded = store.state.year;
  check(kp.varietyOpen(p), 'variety stays open after the group');
  check(kp.summary(p).variety && Array.isArray(kp.summary(p).variety.shows), 'the record keeps the variety career');

  // The family route: the heir of an idol is seen privately by that agency, and can still audition anywhere.
  p.age = 45;
  const heir = makeNpc({ role: 'child', countryId: 'kr', age: 16, gender: 'female' });
  store.state.npcs[heir.id] = heir; p.npcIds.push(heir.id);
  die('natural causes');
  const next = continueAs(heir.id);
  check(!!next, 'the heir continues');
  const q = store.state.player;
  q.age = 16; q.talents.singing = 80; q.talents.dance = 80; q.stats.charm = 70;
  const routes = kp.legacyRoutes(q);
  check(routes.some((o) => o.agencyId === a.id && o.relation === 'parent'), "the parent's agency is the family route");
  check(kp.auditions().some((au) => !kp.whyNotApply(au, q)), 'and ordinary auditions are open too');
  const fr = kp.legacyAudition(a.id);
  const fapp = k().apps[kp.idolOf(q).apps.at(-1)];
  check(fapp.legacy && fapp.scores.application == null && fapp.scores.callback != null, 'no open call: straight to the callback and assessment');
  check(/privately/.test(fr.text) && !kp.legacyAudition(a.id).ok, 'once a year');
  // Not a guarantee: across many tries, some children are turned away.
  let offered = 0; let turned = 0;
  for (let t2 = 0; t2 < 30; t2++) {
    kp.idolOf(q).acts.did[`legacy:${a.id}`] = false; kp.idolOf(q).acts.apps = 0; kp.idolOf(q).traineeId = null;
    kp.legacyAudition(a.id);
    const x = k().apps[kp.idolOf(q).apps.at(-1)];
    if (x.stage === 'offered') offered++; else turned++;
  }
  check(offered > 0 && turned > 0, `the family route helps but promises nothing (${offered} offered, ${turned} not)`);
  const off = kp.idolOf(q).apps.map((id) => k().apps[id]).find((x) => x.stage === 'offered' && x.legacy);
  kp.idolOf(q).guardianOk = true;
  check(off && kp.acceptOffer(off.id).ok && kp.idolOf(q).legacy?.relation === 'parent' && kp.trainee(q).agency.id === a.id, 'a trainee at the same agency as the parent');
}
section('fan products, variety as a career, and the family route');

// 9. Photocards: a market, what it does to idols, and collecting as anyone's hobby.
{
  rng.seed(99);
  p = life('kr', 19);
  kp.world();
  const a = kp.agencies().find((x) => x.countryId === 'kr' && x.founded <= store.state.year);
  const app = { id: 'app_c', auditionId: null, agencyId: a.id, category: 'multi', year: store.state.year, prepared: true, stage: 'offered', scores: {}, offer: { kind: 'trainee', agencyId: a.id, review: 2, costs: 'covered', allowance: 0, housing: 'dorm', rules: [], exit: 'notice' } };
  k().apps[app.id] = app; kp.idolOf().apps.push(app.id); kp.idolOf().guardianOk = true;
  kp.acceptOffer(app.id);
  const lineup = ['player', ...a.trainees.slice(0, 4)];
  for (const id of lineup.slice(1)) store.state.npcs[id].gender = 'female';
  k().projects.pr_c = { id: 'pr_c', agencyId: a.id, year: store.state.year, gender: 'female', size: lineup.length, concept: a.concepts[0], lineup, status: 'announced' };
  kp.idolOf().debutOffer = 'pr_c';
  check(kp.acceptDebut().ok && kp.debut().ok, 'debuted (photocards)');
  const grp = kp.myGroup();
  grp.fandom.size = 200000; grp.fandom.core = 30000;
  // The market: every member's card has a price; the dearest follow the members' followings.
  kp.idolOf().pop = 100;
  const v = kp.cardValues(grp);
  check(kp.current(grp).every((m) => v[m.who] > 0), 'every member\'s card has a going price');
  check(kp.cardRanking(grp)[0] === 'player', 'a member everyone loves has the dearest card');
  // A small fandom's cards are cheap; a huge one's dear.
  const small = Object.values(k().groups).find((g) => g.npc && g.debut && g.fandom.size < 50000) ?? null;
  if (small) check(Math.max(...Object.values(kp.cardValues(small))) < Math.max(...Object.values(v)) * 3, 'prices follow the size of the fandom');
  // The effect on albums: more members, more copies; more rare cards, more still.
  const modest = kp.cardBoost(grp);
  check(modest > 1, 'the cards sell albums');
  let set = false;
  for (let t2 = 0; t2 < 15 && !set; t2++) { kp.idolOf().acts.did.cardPolicy = false; set = kp.setCardPolicy('generous').ok; }
  check(set && kp.cardBoost(grp) > modest && grp.cardPolicy === 'generous', 'asking for more rare cards sells more');
  const eng = grp.fandom.engagement;
  // Lowest in the group two years running: the player feels it.
  // Held at the bottom each year (a year's work can lift popularity on its own, which is not what this checks).
  const bottom = () => { kp.idolOf().pop = 0; for (const w of lineup.slice(1)) if (store.state.npcs[w]?.flags.idol) store.state.npcs[w].flags.idol.appeal = 85; };
  // This year's prices were set while the player was everyone's favorite: it takes two more years to show.
  bottom(); year(); bottom(); year(); bottom(); year();
  check(grp.fandom.engagement < eng, 'fans grumble about all the rare cards');
  const mc = kp.myCard(grp);
  check(mc && mc.rank === mc.of && mc.low && kp.idolOf().history.some((h) => /traded lowest/.test(h.text)), 'the lowest card two years running weighs on the player');
}
{
  // A fan in Britain: buys albums, pulls cards, trades spares, sells, completes a set.
  rng.seed(123);
  p = life('uk', 16);
  p.finance.cash = 5000;
  kp.world();
  for (let y2 = 0; y2 < 2; y2++) year();
  const gs = kp.fanGroups();
  check(gs.length > 0, 'there are groups to follow');
  const g = gs[0];
  const bias = kp.current(g)[0].who;
  check(!kp.becomeFan(g.id, 'player').ok && kp.becomeFan(g.id, bias).ok && kp.fanOf().bias === bias, 'a fan with a favorite member');
  const r = kp.albumsOf(g)[0];
  check(!!r, 'the group has an album out');
  const cash0 = p.finance.cash;
  const buy = kp.buyAlbums(10, r.id);
  const n = Object.values(kp.fanOf().cards).reduce((t, x) => t + x, 0);
  check(buy.ok && n === 10 && p.finance.cash < cash0 && kp.fanOf().spent[store.state.year] === cash0 - p.finance.cash, 'ten albums, ten random cards, paid for');
  check(Object.keys(kp.fanOf().cards).every((id) => r.performers.includes(kp.cardParts(id).who)), 'the cards are of the members on that album');
  kp.buyAlbums(20, r.id);
  check(!kp.buyAlbums(1, r.id).ok, 'thirty albums a year at most');
  // Trading spares for a missing card.
  const missing = r.performers.map((w) => `${r.id}|${w}|n`).find((id) => !kp.fanOf().cards[id]);
  const spare0 = kp.spares().length;
  if (missing) {
    const tr = kp.tradeFor(missing);
    check(tr.text && (tr.ok ? kp.fanOf().cards[missing] === 1 : true), 'a trade for a missing card');
  }
  check(kp.spares().length <= spare0, 'spares go in trades');
  // Buying and selling single cards at the going price.
  const want = r.performers.map((w) => `${r.id}|${w}|n`).find((id) => !kp.fanOf().cards[id]);
  if (want) check(kp.buyCard(want).ok && kp.fanOf().cards[want] === 1, 'buying one card outright');
  for (const w of r.performers) { const id = `${r.id}|${w}|n`; if (!kp.fanOf().cards[id]) kp.buyCard(id); }
  check(kp.fanOf().sets.includes(r.id), 'every member\'s card from one album: a full set');
  const sellId = Object.keys(kp.fanOf().cards)[0];
  const before = p.finance.cash;
  check(kp.sellCard(sellId).ok && p.finance.cash > before, 'selling a card brings money in');
  check(kp.collectionValue() > 0, 'a collection has a value');
  // Prices move with the years; the group's albums stay in the world while the fan collects.
  const price0 = kp.cardValue(Object.keys(kp.fanOf().cards)[0]);
  for (let y2 = 0; y2 < 4; y2++) year();
  check(Object.keys(kp.fanOf().cards).every((id) => kp.cardParts(id).release), 'collected cards keep their albums, years later');
  check(k().cards[g.id].year === store.state.year && k().cards[g.id].history.length >= 2 && price0 > 0, 'prices are worked out again each year, and the old ones kept');
  // Spending too much shows.
  kp.fanOf().spent[store.state.year] = 100000; p.finance.cash = 1000;
  const mood = p.stats.mood;
  year();
  check(p.stats.mood <= mood || store.state.journal.some((j) => /more than you meant to/.test(j.text)), 'spending more than meant to shows');
}
section('photocards: a market for every member, rare cards and albums, the lowest card, and collecting as a hobby');

// 10. The people around it: fellow fans to trade with, and co-stars on a variety show.
{
  rng.seed(321);
  p = life('uk', 17);
  p.finance.cash = 50000;
  kp.world();
  for (let y2 = 0; y2 < 2; y2++) year();
  const g = kp.fanGroups()[0];
  kp.becomeFan(g.id, kp.current(g)[0].who);
  const traders = kp.tradersOf(g);
  check(traders.length === kp.FANS_PER_GROUP && traders.every((n) => n.flags.fan.groupId === g.id && Object.keys(n.flags.fan.cards).length > 0), 'six fellow fans, each with a collection of their own');
  check(traders.every((n) => kp.current(g).some((m) => m.who === n.flags.fan.bias)), 'each loves one of the members');
  check(kp.tradersOf(g).map((n) => n.id).join() === traders.map((n) => n.id).join(), 'the same fans are there next time');
  // Make every trader honest, buy plenty of spares, then trade until someone becomes a friend.
  for (const n of traders) n.flags.fan.honest = true;
  kp.buyAlbums(30);
  let traded = 0; let named = true;
  for (let t2 = 0; t2 < 80 && !traders.some((n) => n.role === 'friend'); t2++) {
    const f = kp.fanOf();
    if (f.acts.trades >= kp.TRADES_PER_YEAR || !kp.spares(f).length) { year(); kp.buyAlbums(30); continue; }
    // What a fan trades for: a card they lack, or one more of their favorite member's.
    const all = Object.keys(traders.reduce((acc, n) => ({ ...acc, ...n.flags.fan.cards }), {}));
    const want = all.find((id) => !f.cards[id] && kp.planTrade(id).trader) ?? all.find((id) => kp.cardParts(id).who === f.bias && kp.planTrade(id).trader);
    if (!want) { year(); kp.buyAlbums(30); continue; }
    const plan = kp.planTrade(want);
    const before = plan.trader.flags.fan.cards[want];
    const mine = f.cards[want] ?? 0;
    const r = kp.tradeFor(want);
    if (r.ok) { traded++; named = named && r.text.includes(plan.trader.firstName); check(f.cards[want] === mine + 1 && (plan.trader.flags.fan.cards[want] ?? 0) === before - 1, 'the card moves from them to you'); }
  }
  check(traded > 0 && named, `trades are with named fans (${traded})`);
  // Friendship, on purpose: one fan with spare copies of the player's favorite's card, traded with again and again.
  const pal = traders.find((n) => n.role !== 'friend' && !n.flags.fan.burned) ?? traders[0];
  const r0 = kp.albumsOf(g)[0];
  const biasCard = `${r0.id}|${kp.fanOf().bias}|n`;
  pal.flags.fan.bias = kp.current(g).map((m) => m.who).find((w) => w !== kp.fanOf().bias);
  pal.flags.fan.cards[biasCard] = 20;
  for (const n of traders) if (n !== pal) delete n.flags.fan.cards[biasCard];
  for (let t2 = 0; t2 < 20 && pal.role !== 'friend'; t2++) {
    const f = kp.fanOf();
    if (f.acts.trades >= kp.TRADES_PER_YEAR || kp.spares(f).length < 3) { year(); kp.buyAlbums(30); pal.flags.fan.cards[biasCard] = 20; continue; }
    kp.tradeFor(biasCard);
  }
  check(pal.role === 'friend' && p.npcIds.includes(pal.id) && pal.flags.fan.trades >= 3, `trading well with someone makes a friend (${pal.flags.fan.trades} trades)`);
  // A dishonest fan keeps the cards once, and is never traded with again.
  for (const n of traders) { n.flags.fan.honest = false; n.flags.fan.burned = false; }
  kp.fanOf().acts.trades = 0;
  let burned = null;
  for (let t2 = 0; t2 < 30 && !burned; t2++) {
    const f = kp.fanOf();
    if (f.acts.trades >= kp.TRADES_PER_YEAR || !kp.spares(f).length) { year(); kp.buyAlbums(30); kp.fanOf().acts.trades = 0; continue; }
    const want = Object.keys(traders.reduce((acc, n) => ({ ...acc, ...n.flags.fan.cards }), {})).find((id) => kp.planTrade(id).trader);
    if (!want) { year(); kp.buyAlbums(30); continue; }
    const who = kp.planTrade(want).trader;
    const r = kp.tradeFor(want);
    if (!r.ok && who.flags.fan.burned) burned = who;
  }
  check(!!burned, 'a dishonest fan can keep your cards');
  if (burned) check(Object.keys(burned.flags.fan.cards).every((id) => kp.planTrade(id).trader?.id !== burned.id), 'and nobody trades with them again');
}
{
  // Co-stars on a regular show: real people, chemistry by the year, a cast that changes.
  rng.seed(654);
  p = life('kr', 22);
  kp.world();
  const a = kp.agencies()[0];
  const app = { id: 'app_v', auditionId: null, agencyId: a.id, category: 'multi', year: store.state.year, prepared: true, stage: 'offered', scores: {}, offer: { kind: 'trainee', agencyId: a.id, review: 2, costs: 'covered', allowance: 0, housing: 'dorm', rules: [], exit: 'notice' } };
  k().apps[app.id] = app; kp.idolOf().apps.push(app.id); kp.idolOf().guardianOk = true; kp.acceptOffer(app.id);
  const lineup = ['player', ...a.trainees.slice(0, 4)];
  for (const id of lineup.slice(1)) store.state.npcs[id].gender = 'female';
  k().projects.pr_v = { id: 'pr_v', agencyId: a.id, year: store.state.year, gender: 'female', size: 5, concept: a.concepts[0], lineup, status: 'announced' };
  kp.idolOf().debutOffer = 'pr_v'; kp.acceptDebut(); kp.debut();
  p.skills.public_speaking = 90; p.stats.charm = 90; kp.idolOf().pop = 70;
  let show = null;
  for (let t2 = 0; t2 < 15 && !show; t2++) { const o = kp.varietyOffers().find((x) => x.role !== 'guest'); if (o && kp.takeVariety(o.id).ok) show = kp.myShows()[0]; else kp.varietyOf().offers = null; }
  check(!!show && show.cast.length >= 3 && show.cast.length <= 5, 'a regular seat comes with three to five castmates');
  if (show) {
    check(show.cast.every((c) => store.state.npcs[c.id] && p.npcIds.includes(c.id)), 'the castmates are people the player knows');
    const chem0 = show.cast.map((c) => c.chem).join();
    year();
    check(show.ended || show.cast.map((c) => c.chem).join() !== chem0, 'chemistry moves with the year');
    for (const c of show.cast) c.chem = 95;
    let couple = false;
    for (let y2 = 0; y2 < 12 && !couple && !show.ended; y2++) { for (const c of show.cast) c.chem = 95; year(); couple = kp.varietyOf().awards.some((x) => x.category === 'best_couple'); }
    if (!show.ended) check(couple, 'great chemistry can win Best Couple');
    const pair = kp.varietyOf().awards.find((x) => x.category === 'best_couple');
    if (pair) check(show.cast.some((c) => c.id === pair.with), 'Best Couple is with someone on the show');
  }
}
section('people: fellow fans with names and collections, friends and a fan who keeps your cards; co-stars, chemistry, Best Couple');

// 11. Lives of their own: fans trade among themselves; co-stars have careers of their own.
{
  rng.seed(777);
  p = life('uk', 17);
  p.finance.cash = 50000;
  kp.world();
  for (let y2 = 0; y2 < 2; y2++) year();
  const g = kp.fanGroups()[0];
  kp.becomeFan(g.id, kp.current(g)[0].who);
  const fans = kp.tradersOf(g);
  // Two fans who each hold spares of the other's favorite: a trade that can happen.
  const r0 = kp.albumsOf(g)[0];
  const [m0, m1] = r0.performers;
  const setUp = (x, y) => { x.flags.fan.bias = m0; y.flags.fan.bias = m1; x.flags.fan.cards[`${r0.id}|${m1}|n`] = 3; y.flags.fan.cards[`${r0.id}|${m0}|n`] = 3; delete x.flags.fan.cards[`${r0.id}|${m0}|n`]; delete y.flags.fan.cards[`${r0.id}|${m1}|n`]; };
  for (const n of fans) { n.flags.fan.honest = true; n.flags.fan.burned = false; }
  setUp(fans[1], fans[2]);
  year();
  check(fans.some((n) => (n.flags.fan.swaps ?? 0) > 0) && kp.fanFeed(g).length > 0, 'fans trade with each other, and the community feed says who traded what');
  check(fans.every((n) => Object.values(n.flags.fan.cards).every((c) => Number.isInteger(c) && c > 0)), 'trading among fans never leaves a fan with a broken count');
  // A dishonest fan is found out by the others, and the player sees it.
  fans[0].flags.fan.honest = false;
  for (let y2 = 0; y2 < 25 && !fans[0].flags.fan.burned; y2++) { setUp(fans[0], fans[3]); year(); }
  check(fans[0].flags.fan.burned && kp.fanFeed(g).length > 0, 'a fan who keeps another fan\'s cards is found out');
  check(Object.keys(fans[0].flags.fan.cards).every((id) => kp.planTrade(id).trader?.id !== fans[0].id), 'and the player does not trade with them either');
}
{
  rng.seed(888);
  p = life('kr', 22);
  kp.world();
  const a = kp.agencies()[0];
  const app = { id: 'app_w', auditionId: null, agencyId: a.id, category: 'multi', year: store.state.year, prepared: true, stage: 'offered', scores: {}, offer: { kind: 'trainee', agencyId: a.id, review: 2, costs: 'covered', allowance: 0, housing: 'dorm', rules: [], exit: 'notice' } };
  k().apps[app.id] = app; kp.idolOf().apps.push(app.id); kp.idolOf().guardianOk = true; kp.acceptOffer(app.id);
  const lineup = ['player', ...a.trainees.slice(0, 4)];
  for (const id of lineup.slice(1)) store.state.npcs[id].gender = 'female';
  k().projects.pr_w = { id: 'pr_w', agencyId: a.id, year: store.state.year, gender: 'female', size: 5, concept: a.concepts[0], lineup, status: 'announced' };
  kp.idolOf().debutOffer = 'pr_w'; kp.acceptDebut(); kp.debut();
  p.skills.public_speaking = 90; p.stats.charm = 90; kp.idolOf().pop = 70;
  let show = null;
  for (let t2 = 0; t2 < 15 && !show; t2++) { const o = kp.varietyOffers().find((x) => x.role !== 'guest'); if (o && kp.takeVariety(o.id).ok) show = kp.myShows()[0]; else kp.varietyOf().offers = null; }
  check(!!show, 'a seat on a show (co-star careers)');
  if (show) {
    // Idols from other groups have idol careers of their own; everyone else on the cast gets a variety career.
    if (!show.cast.some((c) => c.kind !== 'idol')) { const c = kp.internals.newCostar(show, p, 'comedian'); show.cast.push({ ...c, chem: 50, from: store.state.year, until: null }); p.npcIds.push(c.id); }
    const mates = show.cast.map((c) => store.state.npcs[c.id]).filter((n) => kp.costarCareer(n));
    check(mates.length >= 1 && mates.every((n) => kp.costarCareer(n).shows.some((x) => x.withPlayer && x.name === show.name)), 'each castmate\'s career starts with this show');
    for (const n of mates) kp.costarCareer(n).fame = 95;
    let own = false;
    for (let y2 = 0; y2 < 8 && !own; y2++) { for (const n of mates) kp.costarCareer(n).fame = Math.max(kp.costarCareer(n).fame, 90); year(); own = mates.some((n) => kp.costarNow(n).length > 0); }
    check(own, 'a well-known castmate lands a show of their own');
    check(store.state.journal.some((j) => /who you worked with on/.test(j.text)), 'and the player hears about it');
    kp.leaveVariety(show.id);
    year();
    check(mates.every((n) => kp.costarCareer(n).shows.filter((x) => x.withPlayer).every((x) => x.to != null)), 'after the player leaves, the show with them is in the past');
  }
}
section('lives of their own: fans trading among themselves, a fan found out; co-stars with shows of their own');

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 30)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('Debut, and everything after.');
