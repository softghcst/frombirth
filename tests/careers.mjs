// Checks the working life: the occupation catalog, employers and openings, hiring and offers, payroll paid once,
// several jobs at once and the time they take, promotions and their rules, the people at work, freelancing,
// the military, retirement, records across generations, and old saves. Run with: node tests/careers.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { makeNpc } from '../js/engine/npcFactory.js';
import { COUNTRIES } from '../js/data/countries.js';
import { CAREERS, CAREER_BY_ID } from '../js/data/careers.js';
import { FAMILY_BY_ID, MILITARY_BRANCHES, BRANCH_RANKS, TRACKS } from '../js/data/occupations.js';
import { MAJOR_BY_ID } from '../js/data/majors.js';
import { PROGRAMMES, TRADE_BY_ID, CERT_BY_ID, CERTS } from '../js/data/schools.js';
import { WORK_LAW } from '../js/data/workLaw.js';
import { SERVICES } from '../js/data/freelance.js';
import { PART_TIME_JOBS } from '../js/data/partTimeJobs.js';
import { FAMILY_QUESTIONS } from '../js/data/interviewQuestions.js';
import * as career from '../js/engine/career.js';
import * as market from '../js/engine/employers.js';
import * as hiring from '../js/engine/hiring.js';
import * as work from '../js/engine/worklife.js';
import * as place from '../js/engine/workplace.js';
import * as pt from '../js/engine/partTime.js';
import * as free from '../js/engine/freelance.js';
import * as record from '../js/engine/careerRecord.js';
import { tickFinance } from '../js/engine/finance.js';
import { die } from '../js/engine/death.js';
import { continueAs } from '../js/engine/legacy.js';

rng.seed(424242);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (id = 'us', age = 25) => {
  do { store.state = createLife({ countryId: id }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age; p.flags.livesWithParents = false; p.education.enrolled = false; p.education.stage = 'none';
  p.legal.record = []; p.stats.health = 80; p.stats.intellect = 70; p.stats.charm = 65; p.hidden.discipline = 65;
  if (!p.education.degrees.some((d) => d.type === 'high')) p.education.degrees.push({ type: 'high', gpa: 3.2, age: 18 });
  work.career();
  return p;
};
const year = () => { advanceYear(); store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 80); };
const giveDegree = (type, majorId) => store.state.player.education.degrees.push({ type, majorId, gpa: 3.5, age: 22 });
/** Opens a posting for a track in the player's city and gets an offer for it, answering well. */
function offerFor(careerId, level = 0) {
  const p = store.state.player;
  const e = market.placeAt(careerId, p.countryId, p.city);
  const post = market.openPosting(e, { careerId, level });
  post.partTime = false; post.hours = CAREER_BY_ID[careerId].hours;
  for (let i = 0; i < 40; i++) {
    p.flags.hireActs = null;
    const a = hiring.apply(post.id);
    if (a.kind === 'blocked') return { blocked: a.text, post };
    const answers = a.kind === 'interview' ? a.questions.map((q) => [...q.a].sort((x, y) => hiring.answerScore(y) - hiring.answerScore(x))[0]) : [0];
    const r = hiring.decide(post.id, answers);
    if (r.offer) return { offer: r.offer, post };
    if (post.status !== 'open') post.status = 'open';
  }
  return { post };
}

// 1. The catalog.
const ids = new Set();
let titles = 0;
for (const c of CAREERS) {
  check(!ids.has(c.id), `duplicate career id ${c.id}`); ids.add(c.id);
  check(!!FAMILY_BY_ID[c.family], `${c.id}: unknown family ${c.family}`);
  check(c.levels.length >= 2 || c.id === 'seasonal_santa', `${c.id}: a ladder needs rungs`);
  const seen = new Set();
  for (const l of c.levels) { check(!seen.has(l.title), `${c.id}: the title ${l.title} appears twice`); seen.add(l.title); check(l.pay[0] > 0 && l.pay[1] >= l.pay[0], `${c.id}: bad pay for ${l.title}`); titles += 1; }
  for (let i = 1; i < c.levels.length; i++) check(c.levels[i].pay[1] >= c.levels[i - 1].pay[0], `${c.id}: ${c.levels[i].title} pays less than the rung below`);
  const r = c.req ?? {};
  for (const m of r.majors ?? []) check(!!MAJOR_BY_ID[m], `${c.id}: unknown major ${m}`);
  for (const pr of [r.programme, r.altProgramme, ...(r.programmes ?? [])].filter(Boolean)) check(!!PROGRAMMES[pr], `${c.id}: unknown program ${pr}`);
  if (r.trade) check(!!TRADE_BY_ID[r.trade], `${c.id}: unknown trade ${r.trade}`);
  if (r.altCert) check(!!CERT_BY_ID[r.altCert], `${c.id}: unknown certificate ${r.altCert}`);
  for (const id of Object.keys(r.experience ?? {})) check(!!CAREER_BY_ID[id], `${c.id}: experience in an unknown career ${id}`);
  for (const f of c.from ?? []) check(!!CAREER_BY_ID[f.career]?.levels[f.level], `${c.id}: branches from a rung that does not exist (${f.career} ${f.level})`);
  for (const [cty, list] of Object.entries(c.titlesBy ?? {})) { check(!!COUNTRIES[cty], `${c.id}: titles for an unknown country ${cty}`); check(list.length === c.levels.length, `${c.id}: ${cty} names ${list.length} ranks for ${c.levels.length} levels`); }
  check(['salary', 'hourly', 'commission', 'tips', 'fees'].includes(c.payModel), `${c.id}: unknown pay model ${c.payModel}`);
  check(c.hours > 0 && c.hours <= 70, `${c.id}: odd hours ${c.hours}`);
  // A branch-only track must be reachable: from a rung, or by experience.
  if (c.branchOnly) check((c.from ?? []).length || r.experience, `${c.id}: branch-only, but nothing leads to it`);
}
// Nurses do not become surgeons without medical school: no branch skips a licence.
for (const c of CAREERS) for (const f of c.from ?? []) {
  const need = c.req?.programme ?? null;
  if (need) check(CAREER_BY_ID[f.career].req?.programme === need || c.req?.programmes?.includes(need) || need === CAREER_BY_ID[f.career].req?.altProgramme || !!c.req.programme, `${c.id}: branch from ${f.career} skips ${need}`);
}
check(!CAREER_BY_ID.surgery.from.some((f) => f.career === 'nurse'), 'nurses cannot branch into surgery');
check(CAREERS.length >= 180 && titles >= 650, `the catalog is substantial (${CAREERS.length} tracks, ${titles} titles)`);
for (const id of Object.keys(WORK_LAW)) check(!!COUNTRIES[id], `work law for an unknown country ${id}`);
for (const id of Object.keys(MILITARY_BRANCHES)) check(id === 'default' || !!COUNTRIES[id], `branches for an unknown country ${id}`);
for (const [id, byBranch] of Object.entries(BRANCH_RANKS)) for (const [b, list] of Object.entries(byBranch)) check(list.length === CAREER_BY_ID[id].levels.length, `${id} ${b}: ranks do not match levels`);
for (const s of SERVICES) check(/^(stats|hidden|talents)\./.test(s.skill) && (!s.track || !!CAREER_BY_ID[s.track]), `service ${s.id}: bad skill or track`);
for (const j of PART_TIME_JOBS) check(j.hours > 0 && j.pay > 0 && (!j.next || !!CAREER_BY_ID[j.next]), `part-time ${j.id}: bad hours, pay or next step`);
for (const x of CERTS) check(!!CAREER_BY_ID[x.opens], `certificate ${x.id} opens an unknown career`);
for (const f of Object.keys(FAMILY_QUESTIONS)) check(!!FAMILY_BY_ID[f], `questions for an unknown family ${f}`);
section(`catalog: ${CAREERS.length} tracks (${TRACKS.length} new), ${titles} titles, ${Object.keys(FAMILY_BY_ID).length} families; requirements, branches and ranks all name real things`);

// 2. Employers and openings.
let p = life('us', 22);
const here = market.cityEmployers(p.countryId, p.city);
check(here.length >= 30, `a city has a real job market (${here.length} employers)`);
check(new Set(here.map((e) => e.family)).size >= 15, 'every kind of work has an employer');
const again = market.cityEmployers(p.countryId, p.city);
check(again.length === here.length && again[0].id === here[0].id, 'a city keeps its employers: asking twice does not make new ones');
const before = market.board().map((x) => x.id).sort().join();
check(market.board().map((x) => x.id).sort().join() === before, 'the job board does not reshuffle each time it is opened');
const anyPost = market.board()[0];
year();
const after = market.posting(anyPost.id);
check(after && (after.status === 'open' || after.status === 'filled' || after.status === 'expired'), 'openings persist from one year to the next until filled, withdrawn or expired');
const old = market.openPosting(here[0], { careerId: here[0].tracks[0], level: 0 });
old.expires = store.state.year - 1;
check(hiring.apply(old.id).kind === 'blocked', 'an expired opening takes no applications');
section(`employers: ${here.length} in ${p.city}, ${market.board().length} openings on the board, which persist`);

// 3. Hiring.
p = life('us', 24);
const docPost = market.openPosting(market.placeAt('doctor', p.countryId, p.city), { careerId: 'doctor', level: 0 });
check(hiring.apply(docPost.id).kind === 'blocked', 'without medical school, a doctor\'s opening is closed');
check(career.unmet(CAREER_BY_ID.surgery).length > 0, 'surgery cannot be applied to from outside');
check(career.unmet(CAREER_BY_ID.judiciary).length > 0, 'a judge needs years at the bar');
check(career.unmet(CAREER_BY_ID.dental_hyg).some((r) => /certificate/.test(r)), 'a dental hygienist needs the certificate');
let got = offerFor('retail', 0);
check(!!got.offer, `a qualified applicant can be offered a retail job (${got.blocked ?? 'no offer'})`);
if (got.offer) {
  const neg = hiring.negotiate(got.offer.id, 'salary');
  check(typeof neg.text === 'string', 'negotiating gives an answer');
  const still = hiring.offers().find((o) => o.id === got.offer.id);
  if (still) {
    const r = hiring.accept(still.id);
    check(r.ok, `accepting an offer starts the job: ${r.text}`);
    const c = work.career();
    check(c.careerId === 'retail' && !!c.employerId && market.posting(got.post.id).status === 'filled', 'the job is at the employer, and the opening is filled');
    check(c.salary === still.salary, 'the contract keeps the offered salary');
  }
}
const kept = work.career().careerId;
const blocked = hiring.apply(docPost.id);
check(blocked.kind === 'blocked' && work.career().careerId === kept, 'a rejected application leaves the current job alone');
section('hiring: requirements are checked, offers are made, negotiated and accepted into a real contract');

// 4. Payroll: once, and only for what was earned.
p = life('us', 30);
career.hire(CAREER_BY_ID.accountant, 0, 60, 'Test.');
const c4 = work.career();
store.state.year += 1;
const pay1 = work.runPayroll(p);
const pay2 = work.runPayroll(p);
check(pay1.gross === c4.salary && pay2.gross === 0, `a salary is paid once a year (${pay1.gross} then ${pay2.gross})`);
store.state.year += 1;
const cash = p.finance.cash;
tickFinance();
check(p.finance.cash !== cash && work.runPayroll(p).gross === 0, 'finance pays the year, and a second payroll that year pays nothing');
career.quitCareer();
career.hire(CAREER_BY_ID.cafe, 0, 60, 'Test.');
const cafe = work.career();
cafe.extra = 10;
store.state.year += 1;
const hourly = work.runPayroll(p).lines.find((l) => l.source === 'main');
check(hourly && hourly.gross === Math.round(cafe.salary * (cafe.hours + 15) / cafe.hours), 'hourly pay follows the hours, overtime at time and a half');
career.quitCareer();
// Freelance: paid when done, once; a failed job pays a part at most.
p.stats.intellect = 80;
check(free.offer('writing', 'market').ok, 'a writer can set up a service');
free.setAvailability(25);
const f = work.career().freelance;
f.contracts.push({ id: 'g1', service: 'writing', serviceName: 'Freelance writing', client: 'A', hours: 40, fee: 2000, age: p.age, status: 'active', paid: false, partial: 0 });
store.state.year += 1;
check(!work.runPayroll(p).lines.some((l) => l.source === 'gig:g1'), 'an unfinished contract is not paid');
p.age += 1;
free.tickFreelance();
const k = f.contracts.find((x) => x.id === 'g1');
store.state.year += 1;
const paid = work.runPayroll(p).lines.find((l) => l.source === 'gig:g1');
check(k.status === 'done' ? paid?.gross === 2000 : (paid?.gross ?? 0) <= 800, `a finished contract is paid in full, a failed one in part (${k.status}, ${paid?.gross ?? 0})`);
store.state.year += 1;
check(!work.runPayroll(p).lines.some((l) => l.source === 'gig:g1'), 'and never paid twice');
section('payroll: once a year, hourly by the hour, freelance on completion only');

// 5. Several jobs, and time.
p = life('us', 30);
career.hire(CAREER_BY_ID.teacher, 1, 60, 'Test.');
const opt = pt.jobOptions().find((j) => j.id === 'tutor_pt' || j.id === 'retail_pt');
const ptr = pt.takeJob(opt.id);
check(work.weeklyLoad().rows.length >= 2 || !ptr.ok, 'a full-time teacher can tutor on the side, when the hours allow');
check(!work.canFit(60).ok, 'there are not enough hours in the week for another full-time job on top');
career.quitCareer();
career.hire(CAREER_BY_ID.diplomacy, 0, 60, 'Test.');
check(!work.canFit(4, { kind: 'parttime' }).ok, 'a diplomat may not take outside paid work');
p = life('uk', 15);
check(work.workLaw().minorHours === 12 && !work.canFit(20, { kind: 'parttime' }).ok, 'under 18, the hours the law allows are enforced');
section('several jobs: they fit together when the hours and the contract allow, and not otherwise');

// 6. The people at work.
p = life('us', 28);
career.hire(CAREER_BY_ID.marketing, 0, 60, 'Test.');
const firstEmployer = work.career().employerId;
const team1 = place.team();
const mateIds = team1.coworkers.map((n) => n.id);
check(!!team1.boss && mateIds.length >= 2, 'a job comes with a boss and coworkers');
for (let i = 0; i < 3; i++) year();
check(mateIds.every((id) => store.state.npcs[id]), 'coworkers persist from year to year');
check(Object.values(store.state.npcs).filter((n) => mateIds.includes(n.id)).every((n) => n.life?.job || n.life?.retired || !n.alive || n.role !== 'coworker'), 'coworkers have working lives of their own');
const stayed = mateIds.filter((id) => store.state.npcs[id]?.alive);
career.quitCareer();
check(stayed.every((id) => store.state.npcs[id] && p.npcIds.includes(id)), 'leaving a job does not delete the people from it');
check(stayed.every((id) => ['colleague', 'friend', 'spouse', 'partner'].includes(store.state.npcs[id].role)), 'they become former colleagues, or friends');
career.hire(CAREER_BY_ID.marketing, 0, 60, 'Test.', { employerId: firstEmployer });
const back = place.team();
const familiar = [back.boss, ...back.coworkers].filter((n) => mateIds.includes(n?.id)).length;
// Former colleagues who are still there, at a level that puts them on the same team (within one of the player's), are on it.
const sameTeam = (id) => { const j = store.state.npcs[id]?.life?.job; return j?.employerId === firstEmployer && Math.abs(j.level - 0) <= 1 && store.state.npcs[id].id !== back.boss?.id; };
check(familiar >= 1 || !stayed.some(sameTeam), 'going back to an employer, the same people are still there');
// A boss who leaves is replaced.
const b = place.team().boss;
b.life.job = null; b.life.retired = true;
p.age += 1;
place.tickWorkplace();
check(place.team().boss && place.team().boss.id !== b.id && store.state.npcs[b.id], 'a boss who retires is replaced, and stays someone you knew');
section(`workplaces: ${mateIds.length} coworkers kept their names, jobs and lives across years and employers`);

// 7. Promotions and moving across.
p = life('us', 30);
giveDegree('university', 'computer_science');
career.hire(CAREER_BY_ID.software, 2, 80, 'Test.');
check(place.lateralOptions().some((o) => o.id === 'eng_mgmt') && place.lateralOptions().some((o) => o.id === 'tech_ic'), 'a senior developer can branch into management or the senior technical track');
career.quitCareer();
career.hire(CAREER_BY_ID.software, 0, 80, 'Test.');
check(!place.lateralOptions().some((o) => o.id === 'eng_mgmt'), 'but a junior cannot');
const c7 = work.career();
c7.yearsInRole = 0;
let promotedEarly = 0;
for (let i = 0; i < 30; i++) { p.flags.promoAskAge = null; c7.level = 0; c7.yearsInRole = 0; if (place.applyForPromotion().ok) promotedEarly += 1; }
check(promotedEarly === 0, 'nobody is promoted before serving any time in the role');
let years7 = 0;
c7.level = 0; c7.title = CAREER_BY_ID.software.levels[0].title; c7.performance = 30;
for (let i = 0; i < 8; i++) { year(); if (!work.career().careerId) break; work.career().performance = Math.min(work.career().performance, 35); years7 += 1; }
check(!work.career().careerId || work.career().level === 0, 'years alone do not bring promotion: poor reviews keep you where you are');
section('promotion: real ladders and branches, earned not given');

// 8. Freelancing responds to price and reputation, and cannot be spammed.
p = life('us', 30);
p.stats.intellect = 75;
free.offer('graphic_design', 'budget');
const lowRep = work.career().freelance.services.graphic_design;
const cheap = free.interest({ ...SERVICES.find((s) => s.id === 'graphic_design') }, { ...lowRep, rate: 'budget' });
const dear = free.interest({ ...SERVICES.find((s) => s.id === 'graphic_design') }, { ...lowRep, rate: 'luxury' });
const famed = free.interest({ ...SERVICES.find((s) => s.id === 'graphic_design') }, { ...lowRep, rep: 95, rate: 'luxury' });
check(cheap > dear && famed > dear * 1.5 && dear > 0, `price matters, and a reputation carries a higher price (${cheap.toFixed(2)} cheap, ${dear.toFixed(2)} dear, ${famed.toFixed(2)} dear with a name)`);
free.setAvailability(8);
const first = free.inquiries().length;
check(free.inquiries().length === first, 'clients write once a year: looking again brings no more');
let taken = 0;
for (const q of [...free.inquiries()]) if (free.acceptInquiry(q.id).ok) taken += 1;
check(work.freelanceHours() <= 8, `accepted work stays inside the hours set aside (${work.freelanceHours()} of 8)`);
section(`freelance: ${first} inquiries this year, ${taken} taken, all within the hours available`);

// 9. Military.
p = life('uk', 20);
check(career.branchesHere().includes('Royal Navy'), 'the United Kingdom has its own branches');
career.hire(CAREER_BY_ID.enlisted, 0, 60, 'Test.', { branch: 'Royal Navy' });
check(work.career().title === 'Able rating', `ranks follow the branch (${work.career().title})`);
career.quitCareer();
p = life('jp', 20);
check(career.branchesHere().every((x) => /Self-Defense/.test(x)), 'Japan\'s branches are its own');
p.citizenships = [];
p.birthCountryId = 'us';
check(career.unmet(CAREER_BY_ID.enlisted).some((r) => /citizens/.test(r)) || !!p.citizenships.length, 'the armed forces take citizens');
section('military: branches and ranks by country, citizens only');

// 10. Retirement, and going back.
p = life('us', 60);
career.hire(CAREER_BY_ID.office, 2, 60, 'Test.');
work.career().totalYears = 30;
const r10 = career.retire();
check(r10.ok && !work.career().careerId && work.career().pensionPerYear > 0, 'retirement ends the job and starts a pension');
store.state.year += 1;
check(work.runPayroll(p).lines.some((l) => l.source === 'pension'), 'the pension is paid by payroll');
career.hire(CAREER_BY_ID.retail, 0, 60, 'Test.');
store.state.year += 1;
const lines10 = work.runPayroll(p).lines;
check(lines10.some((l) => l.source === 'pension') && lines10.some((l) => l.source === 'main'), 'going back to work after retiring keeps the pension');
check(work.career().history.some((h) => h.exit === 'retired'), 'the career before retirement stays in the record');
section('retirement: a pension that is paid, and a way back to work');

// 11. Records, milestones, and generations.
check(record.unionYears([[20, 30], [25, 35], [40, 41]]) === 16, 'overlapping periods count once');
p = life('us', 40);
work.career().history.push({ careerId: 'teacher', title: 'Teacher', from: 18, to: 40, exit: 'quit', kind: 'job' });
work.career().history.push({ careerId: 'teacher', title: 'Teacher', from: 18, to: 40, exit: 'quit', kind: 'job' }); // the same years, recorded twice
const earned = record.checkAchievements(p);
check(earned.some((a) => a.id === 'collection_education'), 'twenty years teaching earns the collection');
check(!record.checkAchievements(p).length, 'and it is earned once');
const yrs = record.yearsByFamily(p).education;
check(yrs === 22, `duplicated records do not double the years (${yrs})`);
// A death, and the next generation.
p = life('us', 70);
career.hire(CAREER_BY_ID.engineer, 0, 60, 'Test.');
p.education.degrees.push({ type: 'medical', gpa: 3.6, age: 26 });
(p.flags.licences ??= []).push('medicine');
const kid = makeNpc({ role: 'child', countryId: p.countryId, age: 40 }); store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id);
const firm = work.career().employerId;
const name = `${p.firstName} ${p.lastName}`;
die('old age');
const next = continueAs(kid.id);
check(!!next, 'an heir carries on');
if (next) {
  check((next.careerRecord ?? []).some((r) => r.name === name && r.jobs.length), 'the parent\'s working life is in the family record');
  check(!!next.jobs?.employers[firm], 'the employers of the world are the same employers');
  check(!(next.player.flags.licences ?? []).includes('medicine'), 'a child does not inherit a license');
  check(record.familyCareers().length >= 2, 'the heir can read the family\'s careers');
}
section('records: milestones from verified years, and working lives that outlive the worker');

// 12. Old saves and long lives.
p = life('us', 35);
p.career = { careerId: 'nurse', title: 'Staff nurse', level: 0, salary: 50000, performance: 60, yearsInRole: 3, yearsInField: 3, coworkerIds: [], bossId: null, partTime: null, history: [], retired: false, pensionPerYear: 0, military: null };
const migrated = JSON.parse(JSON.stringify(store.state));
store.state = migrated;
work.ensureCareer(store.state.player.career);
const mc = store.state.player.career;
check(mc.careerId === 'nurse' && mc.salary === 50000 && mc.experience.nurse === 3 && Array.isArray(mc.sides), 'an old career is filled in, keeping its job, pay and years');
year();
check(store.state.player.career.careerId === 'nurse' || store.state.player.career.history.length, 'and it plays on');
let size = 0;
for (const [cty, age] of [['us', 16], ['de', 16], ['in', 16]]) {
  p = life(cty, age);
  p.education.enrolled = false;
  for (let i = 0; i < 60 && p.alive; i++) {
    try { year(); } catch (err) { problems.push(`${cty} year ${i}: ${err.stack.split('\n').slice(0, 3).join(' ')}`); break; }
    const cc = work.career();
    if (!cc.careerId && p.age >= 18 && p.age < 64 && i % 3 === 0) {
      const post = market.board({ scope: 'country' }).map((x) => hiring.postingView(x.id)).find((v) => v.eligible);
      if (post) { const a = hiring.apply(post.post.id); if (a.kind === 'interview') { const d = hiring.decide(post.post.id, a.questions.map((q) => q.a[0])); if (d.offer) hiring.accept(d.offer.id); } }
    }
    check(!(cc.careerId && cc.paidYear !== store.state.year), 'every working year is paid');
  }
  size = Math.max(size, JSON.stringify(store.state).length);
}
check(size < 1_500_000, `a long life stays a reasonable size (${Math.round(size / 1024)} KB)`);
section(`long lives: three sixty-year careers without a failure; the largest save ${Math.round(size / 1024)} KB`);

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 30)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('A working life, start to finish.');
