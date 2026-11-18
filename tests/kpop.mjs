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
p = life('br', 15);
const t = becomeTrainee(p);
check(!!t, 'a talented applicant becomes a trainee within a few years');
if (t) {
  const c = t.contract;
  check(c.kind === 'trainee' && c.who === 'player' && c.costs === 'covered' && !('debt' in c), 'a trainee agreement: its own kind, costs covered, no debt');
  check(AGENCIES.every((a) => a.trainee.review[0] >= 1) && c.review >= 1 && c.review <= 3, 'reviewed after one to three years, not a fixed two');
  check(kp.idolOf().residence?.countryId === 'kr' || t.agency.countryId !== 'kr', 'moving to Seoul for a Korean program');
  const ids = t.agency.trainees.slice(0, 4); // the ones the player has met
  kp.setFocus('vocal');
  const v0 = p.talents.singing;
  year();
  check(p.talents.singing > v0, 'a year of vocal focus improves the singing skill the game already has');
  const ev = k().evals[kp.idolOf().trainee.evals.at(-1)];
  check(ev && ev.rank >= 1 && ev.of >= 5 && ev.feedback.length === 2 && ev.evaluators.every((id) => store.state.npcs[id]), 'an evaluation: a rank, two pieces of feedback, real evaluators');
  check(ids.every((id) => store.state.npcs[id]?.flags.idol), 'fellow trainees are the same people a year later');
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
  const perfs = g.performances.map((id) => k().performances[id]);
  check(perfs.every((x) => x.members.includes(x.fairy) && k().releases[x.releaseId]), 'every ending fairy is a member, on a real performance');
  const centre = kp.current(g).find((m) => g.positions[m.who]?.includes('center'))?.who;
  if (centre) check(perfs.some((x) => x.fairy !== centre), 'the center is not always the ending fairy');
  const mine = kp.pendingFairies();
  if (mine.length) {
    const res = kp.chooseFairy(mine[0].id, 'confident');
    check(res.text && k().performances[mine[0].id].fairyStyle === 'confident' && kp.idolOf().fairies.includes(mine[0].id), 'the player chooses how to end the stage, and it is archived');
    check(!kp.chooseFairy(mine[0].id, 'cute').ok, 'once');
    check(kp.idolOf().pop <= 3, 'one ending fairy does not make a star');
  }
  check(p.milestones.some((m) => /Debuted with/.test(m.text)), 'the debut is in the life story');
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

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 30)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('Debut, and everything after.');
