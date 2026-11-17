// Checks the scenes of working life (js/data/events/career.js) by playing every outcome of every one, and the
// rules around them: a relationship at work, children who lean towards a parent's work without being forced,
// and royals with professions. Run with: node tests/worklife.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { makeNpc } from '../js/engine/npcFactory.js';
import { ensureLife } from '../js/engine/npcLives.js';
import { CAREER_BY_ID } from '../js/data/careers.js';
import careerScenes from '../js/data/events/career.js';
import { applyEffects } from '../js/engine/effects.js';
import { renderText } from '../js/engine/eventEngine.js';
import { meets } from '../js/engine/conditions.js';
import * as career from '../js/engine/career.js';
import * as work from '../js/engine/worklife.js';
import * as place from '../js/engine/workplace.js';
import * as biz from '../js/engine/business.js';
import * as hiring from '../js/engine/hiring.js';
import * as market from '../js/engine/employers.js';
import { romanceActions } from '../js/engine/romance.js';
import { workChoice, queueWorkScenes, partnerAtWork } from '../js/engine/workEvents.js';
import * as couple from '../js/engine/couple.js';
import { tickFinance } from '../js/engine/finance.js';
import { recordJob } from '../js/engine/career.js';

rng.seed(31337);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const add = (role, age, rel = 75) => { const p = store.state.player; const n = makeNpc({ role, countryId: p.countryId, age, relationship: rel }); store.state.npcs[n.id] = n; p.npcIds.push(n.id); return n; };
/** A working adult with a job, a spouse, a young child, and a business. */
function life(trackId = 'marketing', level = 1) {
  do { store.state = createLife({ countryId: 'us' }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = 34; p.birthYear = store.state.year - 34; p.flags.livesWithParents = false; p.education.enrolled = false; p.education.stage = 'none';
  p.legal.record = []; p.stats.health = 85; p.finance.cash = 400000;
  career.hire(CAREER_BY_ID[trackId], level, 70, 'Test.');
  const love = add('spouse', 35, 80); love.marriedAtAge = 28;
  const kid = add('child', 8, 85);
  return { p, love, kid };
}
const year = () => { advanceYear(); store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 85); };

// 1. Every outcome of every scene runs, and says something sensible.
const FIELD_TRACK = { health: 'nurse', education: 'teacher', tech: 'software', hospitality: 'kitchen', trades: 'construction', retail: 'retail', government: 'civil_service', science: 'lab',
  transport: 'driver', safety: 'security', media: 'publishing', law: 'paralegal', land: 'farming', corporate: 'office', sport: 'recreation' };
let played = 0;
const keys = new Set();
for (const ev of careerScenes) {
  const fam = ev.requires?.find((r) => r.path === 'workFamily')?.value[0];
  ev.choices.forEach((ch, ci) => ch.outcomes.forEach((o, oi) => {
    const { p, love, kid } = life(FIELD_TRACK[fam] ?? 'marketing');
    if (ev.requires?.some((r) => r.path === 'ownsBusiness')) biz.start('cafe', 'Scene Café');
    const t = place.team();
    const cast = {};
    for (const [k, spec] of Object.entries(ev.cast ?? {})) cast[k] = { 'tag:boss': t.boss, coworker: t.coworkers[0], spouse: love, child: kid }[spec]?.id;
    if (ev.queuedOnly) { if (/\{love\}/.test(ev.text)) cast.love = love.id; if (/\{kid\}/.test(ev.text)) cast.kid = kid.id; }
    if (/\{mate\}/.test(o.text + ev.text) && !cast.mate) cast.mate = t.coworkers[0].id;
    for (const k of Object.keys(ev.cast ?? {})) check(!!cast[k], `${ev.id}: nobody to play {${k}}`);
    for (const e of o.effects) if (e.type === 'work') keys.add(String(e.value).split(':')[0]);
    try {
      const ctx = { cast: { ...cast } };
      applyEffects(o.effects, ctx);
      const text = renderText(`${ev.text} ${ch.label} ${o.text}`, ctx.cast) + (ctx.note ? ` ${ctx.note}` : '');
      check(!/\{[a-zA-Z]+\}|undefined|NaN/.test(text), `${ev.id} choice ${ci} outcome ${oi}: badly rendered: ${text.slice(0, 160)}`);
      check(Number.isFinite(p.finance.cash) && Number.isFinite(p.career.salary ?? 0) && Number.isFinite(work.career().stress), `${ev.id}: figures went wrong`);
      year(); // and the life goes on
      played += 1;
    } catch (err) { problems.push(`${ev.id} choice ${ci} outcome ${oi}: ${err.stack.split('\n').slice(0, 3).join(' ')}`); }
  }));
}
for (const k of keys) check(['bonus', 'partTime', 'overtime', 'stress', 'satisfaction', 'newBoss', 'acquired', 'voluntary', 'biz', 'romance', 'inspire', 'couple'].includes(k), `a scene asks for a work choice nobody handles: ${k}`);
// The requirements the scenes use are ones the game can answer.
{
  const { p } = life('nurse');
  for (const ev of careerScenes) for (const r of ev.requires ?? []) { try { meets(r, {}); } catch (err) { problems.push(`${ev.id}: requirement ${r.path} failed: ${err.message}`); } }
  check(meets({ path: 'workFamily', op: 'in', value: ['health'] }) && meets({ path: 'salaried', op: '==', value: true }) && !meets({ path: 'ownsBusiness', op: '==', value: true }), 'a nurse is salaried, in health, and owns no business');
  check(p.career.careerId === 'nurse', 'the nurse is a nurse');
}
section(`scenes: ${careerScenes.length} scenes, ${played} outcomes played through, each followed by a year of life`);

// 2. What the choices do.
{
  const { p } = life('accountant');
  const c = work.career();
  const pay0 = c.salary; const cash0 = p.finance.cash; const hours0 = c.hours;
  check(/bonus/.test(workChoice('bonus:0.05')) && p.finance.cash === cash0 + Math.round(pay0 * 0.05), 'a bonus is a share of salary, paid once');
  workChoice('partTime');
  check(c.hours < hours0 && c.salary < pay0 && Math.abs(c.salary / pay0 - c.hours / hours0) < 0.02, 'a shorter week is paid pro rata');
  const e = market.employer(c.employerId);
  const culture = e.culture;
  workChoice('acquired');
  check(e.culture !== culture && e.history.some((h) => /bought/.test(h.text)), 'an employer that is bought changes, and remembers it');
  const before = p.finance.cash;
  workChoice('voluntary');
  check(!c.careerId && p.finance.cash > before && c.history.some((h) => h.exit === 'laid off') && !!c.benefit, 'voluntary redundancy pays, ends the job, and leaves a claim to benefit');
}
{
  life('marketing');
  const t = place.team();
  const old = t.boss;
  const ctx = { cast: {} };
  applyEffects([{ type: 'addNpc', target: 'newcomer', value: { role: 'coworker', ageOffset: 6, relationship: 55 } }, { type: 'work', value: 'newBoss' }], ctx);
  const now = place.team().boss;
  check(now.id === ctx.cast.newcomer && now.id !== old.id && store.state.npcs[old.id] && ['colleague', 'friend'].includes(old.role), 'a new boss takes over, and the old one is still someone you know');
}
section('choices: bonuses, shorter weeks, takeovers, redundancy and a change of boss all change the real state');

// 3. A relationship at work.
{
  const { p, love } = life('marketing');
  love.role = 'ex'; // single again
  const t = place.team();
  const mate = t.coworkers[0];
  mate.age = 33; mate.meters.relationship = 80;
  check(romanceActions(mate).some((a) => a.id === 'askOut'), 'a coworker can be asked out');
  place.tickWorkplace();
  mate.flags.report = true;
  check(!romanceActions(mate).some((a) => a.id === 'askOut'), 'someone who reports to you cannot');
  delete mate.flags.report;
  workChoice('romance:start', { mate: mate.id });
  check(mate.role === 'partner' && p.flags.workRomance?.id === mate.id && !p.flags.workRomance.declared && partnerAtWork()?.id === mate.id, 'a relationship that starts at work is known to the game as one');
  let noticed = false;
  for (let i = 0; i < 12 && !noticed; i++) { store.state.pendingEvents = []; queueWorkScenes(); noticed = store.state.pendingEvents.some((x) => x.id === 'work_romance_noticed'); }
  check(noticed, 'sooner or later, people notice');
  workChoice('romance:declare', { love: mate.id });
  store.state.pendingEvents = []; store.state.eventHistory = [];
  for (let i = 0; i < 6; i++) queueWorkScenes();
  check(!store.state.pendingEvents.some((x) => x.id === 'work_romance_noticed'), 'once it is declared, it is not a secret to be found out');
  // One comes to have a say over the other: that has to be dealt with.
  mate.life.job.level = work.career().level + 3;
  store.state.pendingEvents = [];
  queueWorkScenes();
  check(store.state.pendingEvents.some((x) => x.id === 'work_romance_conflict'), 'a partner with power over the other\'s work is a conflict the game raises');
  workChoice('romance:move', { love: mate.id });
  check(!partnerAtWork() && mate.role === 'partner', 'moving one of them ends the conflict, not the relationship');
}
section('romance at work: allowed between equals, not with a report; noticed, declared, and separated from power');

// 4. Children: a lean, never a rule.
{
  let followed = 0; let leaned = 0; let own = 0;
  for (let i = 0; i < 60; i++) {
    const { kid } = life('teacher');
    kid.age = 17;
    if (i % 3 === 0) { workChoice('inspire:yes', { kid: kid.id }); leaned += 1; check(kid.flags.inspiredBy === 'education', 'a child shown the work is inspired by that field'); }
    if (i % 3 === 1) { workChoice('inspire:own', { kid: kid.id }); own += 1; }
    kid.life = undefined; kid.age = 30;
    ensureLife(kid);
    for (let y = 0; y < 3 && !kid.life.job; y++) year();
    const fam = CAREER_BY_ID[kid.life.job?.careerId]?.family;
    if (fam === 'education') followed += 1;
    if (i % 3 === 1) check(!kid.flags.followed, 'a child told to find their own way was not steered');
  }
  check(followed < 60 * 0.6, `children are not made to follow a parent (${followed} of 60 did)`);
  section(`children: ${followed} of 60 went into a parent's field; none were forced, and the ${own} told to find their own way were left to`);
}

// 5. Royals.
{
  const { p } = life('marketing');
  career.quitCareer();
  p.royal = { rank: 'royal', waiting: false, image: 50, countryId: p.countryId };
  check(!career.royalWorkBlock(CAREER_BY_ID.doctor) && !career.royalWorkBlock(CAREER_BY_ID.academic), 'a member of the royal family may have a profession');
  check(!!career.royalWorkBlock(CAREER_BY_ID.civil_service), 'but not inside the government');
  p.royal.rank = 'heir';
  check(!!career.royalWorkBlock(CAREER_BY_ID.doctor) && !career.royalWorkBlock(CAREER_BY_ID.officer), 'the heir serves only the crown and the armed forces');
  check(biz.startBlock({ needs: {}, id: 'x' }).length > 0, 'and does not go into trade');
  p.royal.rank = 'royal';
  p.education.degrees.push({ type: 'high', gpa: 3.5, age: 18 }, { type: 'university', majorId: 'nursing', gpa: 3.6, age: 22 });
  const e = market.placeAt('nurse', p.countryId, p.city);
  const post = market.openPosting(e, { careerId: 'nurse', level: 0 });
  post.partTime = false;
  check(hiring.apply(post.id).kind === 'interview', 'a princess can interview for a nursing job like anyone else');
  const img = p.royal.image;
  career.hire(CAREER_BY_ID.nurse, 0, 60, 'Test.');
  check(p.royal.image > img && work.career().careerId === 'nurse', 'and the public thinks the better of it');
}
section('royals: the monarch and heir are bound; the rest of the family may work, outside government');

// 6. Two careers, one household.
{
  const { p, love, kid } = life('accountant', 1);
  kid.age = 3;
  ensureLife(love);
  love.life.edu.stage = 'done'; love.life.edu.yearsLeft = 0;
  love.life.job = { careerId: 'teacher', level: 1, title: 'Teacher', salary: 50000, years: 3, employerId: market.placeAt('teacher', p.countryId, p.city).id };
  const h = couple.plan();
  check(h.lead === 'balanced' && h.childcare === 'shared', 'a household starts with both careers equal and the childcare shared');
  const shared = couple.careHours();
  check(shared === 6 && work.weeklyLoad().rows.some((r) => r.kind === 'care' && r.hours === 6), `a toddler takes six hours of each parent's week when it is shared (${shared})`);
  h.childcare = 'me'; const me = couple.careHours();
  h.childcare = 'them'; const them = couple.careHours();
  h.childcare = 'paid'; const paidH = couple.careHours();
  check(me > shared && them < shared && paidH < shared, `who looks after the children changes the player's week (${me}, ${shared}, ${them}, ${paidH})`);
  check(couple.careCost() > 0, 'paid childcare costs money');
  const cashPaid = (() => { const before = p.finance.cash; store.state.year += 1; p.career.paidYear = store.state.year; tickFinance(); return before - p.finance.cash; })();
  h.childcare = 'shared';
  const cashShared = (() => { const before = p.finance.cash; store.state.year += 1; p.career.paidYear = store.state.year; tickFinance(); return before - p.finance.cash; })();
  check(cashPaid > cashShared, `paid childcare comes out of the household's money (${cashPaid} against ${cashShared})`);
  // Agreeing a plan.
  love.meters.relationship = 70;
  const give = couple.proposePlan({ lead: 'theirs' });
  check(give.ok && h.lead === 'theirs' && love.meters.relationship > 70, 'putting their career first is always agreed, and appreciated');
  check(!couple.proposePlan({ lead: 'balanced' }).ok, 'and it is talked about once a year');
  let refused = 0; let agreed = 0;
  for (let i = 0; i < 200; i++) {
    h.lead = 'balanced'; h.askedAge = null; love.meters.relationship = 55;
    const r = couple.proposePlan({ lead: 'mine' });
    if (r.ok) agreed += 1; else refused += 1;
  }
  check(refused > 10 && agreed > 10, `asking them to give way is sometimes agreed and sometimes refused (${agreed} yes, ${refused} no)`);
  h.lead = 'balanced'; h.askedAge = null; love.meters.relationship = 95;
  const sal = love.life.job.salary;
  let went = false;
  for (let i = 0; i < 30 && !went; i++) { h.askedAge = null; h.childcare = 'shared'; delete love.flags.partTimeForKids; love.life.job.salary = sal; went = couple.proposePlan({ childcare: 'them' }).ok; }
  check(went && love.flags.partTimeForKids && love.life.job.salary === Math.round(sal * 0.6), 'a spouse who takes on the childcare goes part-time, on part-time pay');
  h.askedAge = null;
  couple.proposePlan({ childcare: 'me' });
  check(!love.flags.partTimeForKids && Math.abs(love.life.job.salary - sal) <= 1, 'and goes back to full time when it changes');
  // Both careers feel the plan.
  const factor = (lead, care) => { h.lead = lead; h.childcare = care; return couple.spouseFactor(love); };
  check(factor('theirs', 'me') > factor('balanced', 'shared') && factor('balanced', 'shared') > factor('mine', 'them'), 'the spouse\'s prospects follow the plan');
  h.lead = 'mine'; const up = couple.leadFactor(); h.lead = 'theirs'; const down = couple.leadFactor();
  check(up > 1 && down < 1, 'and so do the player\'s');
  h.lead = 'balanced'; h.childcare = 'shared';
  // Moving city for the player's job.
  let kept = 0; let lost = 0;
  for (let i = 0; i < 40; i++) {
    love.life.job = { careerId: 'teacher', level: 1, title: 'Teacher', salary: 50000, years: 3, employerId: null };
    love.meters.relationship = 70;
    couple.spouseFollows(p.city);
    if (love.life.job) kept += 1; else { lost += 1; check(love.meters.relationship < 70 && love.life.lastJob, 'a spouse who gives up a job to move is out of work, and it is felt'); }
  }
  check(kept > 2 && lost > 15, `moving city for a job usually costs a spouse theirs (${lost} of 40 lost it)`);
  love.life.job = { careerId: 'software', level: 1, title: 'Developer', salary: 90000, years: 3, employerId: null };
  couple.spouseFollows(p.city);
  check(!!love.life.job, 'work that can be done from anywhere comes along');
  // Losing a job, retraining.
  love.life.lastJob = { careerId: 'software', level: 1 }; love.life.job = null; love.flags.lostJobAge = p.age;
  store.state.pendingEvents = []; p.flags.familySceneAge = null; store.state.eventHistory = store.state.eventHistory.filter((x) => !x.id.startsWith('hh_'));
  couple.tickCouple();
  check(store.state.pendingEvents.some((x) => x.id === 'hh_spouse_out_of_work'), 'a spouse losing their job comes to the kitchen table');
  workChoice('couple:retrain', { love: love.id });
  check(love.flags.retraining && !love.life.job && love.occupation === 'student', 'they can go back to college');
  const field = CAREER_BY_ID[love.flags.retraining.careerId].family;
  p.age += 2;
  couple.tickCouple();
  check(love.life.job && CAREER_BY_ID[love.life.job.careerId].family === field && field !== 'tech', 'and come out of it in a new field');
}
section('households: a plan agreed between two careers shapes both, the week, the bills, a move, and how it feels');

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 30)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('Work and life, in balance or not.');
