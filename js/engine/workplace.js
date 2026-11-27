// The people at work. Bosses, coworkers and direct reports are ordinary NPCs
// (the same people the People tab shows) with their own working lives
// (engine/npcLives.js): they are promoted, change jobs, retire. Each knows
// which employer they work for (npc.life.job.employerId), so an employer
// keeps its staff: go back to a place and the same people are there, and a
// coworker who moves on is still the same person at their new job.
//
//   role 'boss'      the player's manager (flags.tag 'boss')
//   role 'coworker'  colleagues; flags.report for the player's direct reports
//   role 'colleague' someone the player used to work with (flags.workedWith = employer name)
//   flags.mentor     someone who has taken the player under their wing; it lasts
//
//   p.career.mentees [{ id, since, promoted }]  juniors the player has helped
import { oddsWords, rollRead, afterWords } from './odds.js';
import { rng } from '../rng.js';
import { clamp, fmtMoney } from '../util.js';
import { store, player, country, npcsByRole, livingNpcs, log, milestone } from '../state.js';
import { CAREER_BY_ID, CAREERS } from '../data/careers.js';
import { makeNpc } from './npcFactory.js';
import { ensureLife } from './npcLives.js';
import { remember } from './conditions.js';
import { employer, chronicle, placeAt, openPosting, payAt } from './employers.js';
import { career as careerState } from './worklife.js';
import { unmet, recordJob, promote, nextStep } from './career.js';
import { feel } from './sentiments.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const an = (noun) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
const MANAGES = /manager|director|head |head$|chief|\blead\b|leader|supervisor|^principal$|captain|foreman|partner|superintendent|dean|editor-in-chief|sergeant|lieutenant|governor|president|chair|postmaster|owner|commander|purser/i;

/** Whether the player's role has people reporting to it. */
export const manages = (c = careerState()) => !!c.careerId && ['fulltime', 'military'].includes(CAREER_BY_ID[c.careerId].type) && MANAGES.test(c.title);

const inLife = (n) => player().npcIds.includes(n.id);
function bring(n, role) {
  const p = player();
  if (!inLife(n)) p.npcIds.push(n.id);
  n.role = role;
  n.lastInteractionAge = p.age;
}

/** Gives someone a job at an employer, in their own working life. */
function employ(n, e, careerId, level) {
  ensureLife(n);
  const car = CAREER_BY_ID[careerId];
  const lv = Math.min(level, car.levels.length - 1);
  const pay = payAt(e, car, lv);
  if (n.life) {
    n.life.job = { careerId, level: lv, title: car.levels[lv].title, salary: Math.round((pay[0] + pay[1]) / 2), years: rng.int(0, 4), employerId: e.id };
    n.life.edu.stage = 'done';
    n.life.edu.yearsLeft = 0;
  }
  n.occupation = car.levels[lv].title.toLowerCase();
  if (!e.staff.includes(n.id)) e.staff.push(n.id);
}

/** Staff of an employer who still work there, alive. */
export const staffOf = (e) => (e?.staff ?? []).map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.life?.job?.employerId === e.id);

function newStaff(e, careerId, level, age, rel) {
  const n = makeNpc({ role: 'coworker', countryId: e.countryId, age, relationship: rel });
  store.state.npcs[n.id] = n;
  employ(n, e, careerId, level);
  return n;
}

/**
 * The people the player works with when they start at an employer: whoever
 * already works there, and new faces where there are not enough.
 */
export function joinWorkplace(e, careerId, level) {
  const p = player();
  const car = CAREER_BY_ID[careerId];
  const staff = staffOf(e).filter((n) => !['spouse', 'partner', 'parent', 'child', 'sibling'].includes(n.role));
  // The boss: someone above the player in this line of work, or in the same field.
  const above = staff.filter((n) => n.life.job.level > level && (n.life.job.careerId === careerId || CAREER_BY_ID[n.life.job.careerId]?.family === car.family))
    .sort((a, b) => a.life.job.level - b.life.job.level);
  let b = above[0];
  if (!b) {
    const top = Math.min(car.levels.length - 1, level + rng.int(1, 2));
    b = newStaff(e, careerId, top, rng.int(32, 58), rng.int(45, 60));
  }
  bring(b, 'boss');
  b.flags.tag = 'boss';
  b.flags.title = car.type === 'military' ? 'Commanding officer' : 'Boss';
  b.flags.workedWith = e.name;
  // Coworkers: up to three who already work there, then new ones to make two.
  // People the player already knows come first: going back to an old employer means familiar faces.
  const mates = staff.filter((n) => n.id !== b.id && Math.abs(n.life.job.level - level) <= 1)
    .sort((x, y) => Number(inLife(y)) - Number(inLife(x))).slice(0, 3);
  while (mates.length < 2) mates.push(newStaff(e, careerId, Math.max(0, level + rng.int(-1, 1)), clamp(p.age + rng.int(-4, 12), 18, 64), rng.int(35, 60)));
  for (const n of mates) {
    const known = inLife(n) && n.role !== 'coworker';
    if (!['friend', 'partner', 'spouse'].includes(n.role)) bring(n, 'coworker');
    n.flags.workedWith = e.name;
    if (known && n.role === 'coworker') n.meters.relationship = clamp(n.meters.relationship + 5); // a familiar face
  }
  return { boss: b, coworkers: mates };
}

/** Leaving an employer: the people stay in the player's life, as former colleagues. */
export function leaveWorkplace() {
  const b = npcsByRole('tag:boss')[0];
  if (b) { b.flags.tag = null; b.flags.title = b.flags.mentor ? 'Mentor' : 'Former boss'; b.role = 'colleague'; }
  for (const n of npcsByRole('coworker')) {
    if (n.meters.relationship >= 60 || n.flags.tag) n.role = 'friend';
    else { n.role = 'colleague'; n.flags.title = n.flags.mentor ? 'Mentor' : 'Former colleague'; }
    delete n.flags.report;
  }
}

// ---------- The year at work ----------

/** Someone at the player's workplace has left it: say so, and keep them as a former colleague. */
function departed(n, why) {
  const was = n.flags.tag === 'boss' ? 'Your boss' : n.flags.report ? 'Your report' : 'Your coworker';
  if (n.flags.tag === 'boss') n.flags.tag = null;
  n.role = n.meters.relationship >= 60 ? 'friend' : 'colleague';
  n.flags.title = n.flags.mentor ? 'Mentor' : n.role === 'colleague' ? 'Former colleague' : n.flags.title;
  delete n.flags.report;
  return `${was} ${n.firstName} ${why}.`;
}

/**
 * Once a year: colleagues get on with their own careers, bosses come and go,
 * mentors appear, managers keep their teams. @returns {string[]} journal lines
 */
export function tickWorkplace() {
  const p = player();
  const c = careerState();
  const lines = [];
  const e = employer(c.employerId);
  if (!c.careerId || !e) return lines;
  const car = CAREER_BY_ID[c.careerId];
  if (car.type === 'freelance') return lines;

  // People who have left: another employer, retirement, or out of work.
  for (const n of [...npcsByRole('coworker'), ...npcsByRole('tag:boss')]) {
    ensureLife(n);
    const job = n.life?.job;
    if (!job) { lines.push(departed(n, n.life?.retired ? 'retired' : 'left the company')); continue; }
    if (!job.employerId) { job.employerId = e.id; if (!e.staff.includes(n.id)) e.staff.push(n.id); }
    if (job.employerId !== e.id) lines.push(departed(n, `moved on, to ${employer(job.employerId)?.name ?? 'another employer'}`));
  }
  // A new boss if the old one went.
  if (!npcsByRole('tag:boss')[0]) {
    const pool = npcsByRole('coworker').filter((n) => !n.flags.report && n.life?.job && n.life.job.level > c.level);
    const b = pool[0] ?? newStaff(e, c.careerId, Math.min(car.levels.length - 1, c.level + 1), rng.int(32, 58), rng.int(40, 58));
    bring(b, 'boss');
    b.flags.tag = 'boss';
    b.flags.title = car.type === 'military' ? 'Commanding officer' : 'Boss';
    b.flags.workedWith = e.name;
    lines.push(`You have a new boss: ${b.firstName} ${b.lastName}.`);
  }
  // Keep a couple of coworkers around.
  const mates = npcsByRole('coworker').filter((n) => !n.flags.report);
  if (mates.length < 2) {
    const n = newStaff(e, c.careerId, c.level, clamp(p.age + rng.int(-8, 8), 18, 64), rng.int(35, 55));
    bring(n, 'coworker');
    n.flags.workedWith = e.name;
    lines.push(`${n.firstName} ${n.lastName} joined your team.`);
  }
  // A manager has a team.
  if (manages(c)) {
    const reports = npcsByRole('coworker').filter((n) => n.flags.report);
    const want = 2 + Math.min(2, c.level - 1);
    for (let i = reports.length; i < want; i++) {
      const n = newStaff(e, c.careerId, 0, rng.int(20, 34), rng.int(40, 60));
      bring(n, 'coworker');
      n.flags.report = true;
      n.flags.title = 'Reports to you';
      n.flags.workedWith = e.name;
    }
  }
  // Mentees who moved up.
  for (const m of c.mentees) {
    const n = store.state.npcs[m.id];
    if (!m.promoted && n?.life?.job && n.life.job.level > (m.level ?? 0)) {
      m.promoted = true;
      lines.push(`${n.firstName}, whom you mentored, was promoted. They say they could not have done it without you.`);
      n.meters.relationship = clamp(n.meters.relationship + 8);
    }
  }
  // A senior colleague who likes the player may take them under their wing.
  if (!livingNpcs().some((n) => n.flags.mentor) && c.level <= 1 && rng.chance(0.3)) {
    const senior = [npcsByRole('tag:boss')[0], ...npcsByRole('coworker')].filter((n) => n && n.meters.relationship >= 65 && (n.life?.job?.level ?? 0) > c.level)[0];
    if (senior) {
      senior.flags.mentor = true;
      remember(senior, 'mentored', 'They took you under their wing early in your career.');
      lines.push(`${senior.firstName} ${senior.lastName} has started looking out for you: advice, introductions, a word in the right ear. A mentor.`);
      milestone(`Found a mentor at work: ${senior.firstName} ${senior.lastName}.`, 'career');
    }
  }
  return lines;
}

/** Former mentors who have moved on sometimes come back with an opening. @returns {?object} a lead */
export function mentorLead() {
  const p = player();
  const c = careerState();
  if (!c.careerId) return null;
  const m = livingNpcs().find((n) => n.flags.mentor && n.life?.job?.employerId && n.life.job.employerId !== c.employerId && n.meters.relationship >= 55);
  if (!m || !rng.chance(0.25)) return null;
  const e = employer(m.life.job.employerId);
  if (!e || e.closed || e.countryId !== p.countryId) return null;
  const car = CAREER_BY_ID[c.careerId];
  const level = Math.min(car.levels.length - 1, c.level + 1);
  if (!e.tracks.includes(car.id)) e.tracks.push(car.id);
  const post = openPosting(e, { careerId: car.id, level });
  if (!post) return null;
  return { from: m.id, postingId: post.id, text: `${m.firstName} ${m.lastName}, your old mentor, is now at ${e.name}. They want you as ${an(post.title.toLowerCase())}.`, bonus: 0.3 };
}

// ---------- Things to do with colleagues ----------

const acts = () => {
  const p = player();
  if (p.flags.colleagueActs?.age !== p.age) p.flags.colleagueActs = { age: p.age, done: {} };
  return p.flags.colleagueActs;
};

/** What the player can do with someone they work with. */
export function colleagueActions(n) {
  const c = careerState();
  const done = acts().done[n.id] ?? [];
  const list = [['lunch', 'Have lunch together'], ['advice', 'Ask for advice'], ['collaborate', 'Work on a project together']];
  if (!n.flags.mentor && (n.life?.job?.level ?? 0) > c.level) list.push(['mentorMe', 'Ask them to mentor you']);
  if (n.flags.report || ((n.life?.job?.level ?? 0) < c.level && n.role === 'coworker')) list.push(['mentorThem', 'Take them under your wing']);
  if (n.flags.report) list.push(['review', 'Give them their review']);
  if (n.meters.relationship < 40) list.push(['clearAir', 'Clear the air']);
  return list.map(([id, label]) => ({ id, label, done: done.includes(id) || done.length >= 2 }));
}

/** Does something with a colleague, once a year each. */
export function withColleague(npcId, kind, how) {
  const p = player();
  const c = careerState();
  const n = store.state.npcs[npcId];
  if (!n?.alive) return result(false, 'They are not around.', 'neutral');
  const done = (acts().done[n.id] ??= []);
  if (done.includes(kind) || done.length >= 2) return result(false, 'You have spent enough time with them this year.', 'neutral');
  done.push(kind);
  n.lastInteractionAge = p.age;
  const rel = (d) => { n.meters.relationship = clamp(n.meters.relationship + d); };
  const perf = (d) => { if (c.careerId) c.performance = clamp(c.performance + d * (1 - c.performance / 140)); };
  switch (kind) {
    case 'lunch': rel(rng.int(3, 8)); return result(true, `Lunch with ${n.firstName}. You learn about their ${n.life?.kids ? 'children' : 'weekend plans'} and they learn you are human.`);
    case 'advice': {
      const wise = (n.meters.intellect + (n.life?.job?.level ?? 0) * 10) / 100;
      rel(3); perf(Math.round(2 + wise * 4));
      return result(true, `${n.firstName} gives you advice you had not thought of. It helps.`);
    }
    case 'collaborate': {
      const good = rng.chance(clamp(0.45 + (n.meters.intellect - 50) / 150 + (n.meters.relationship - 50) / 150, 0.15, 0.9));
      rel(good ? 6 : -4); perf(good ? 6 : -2);
      if (good) remember(n, 'collaborated', 'You worked well together on a project.');
      return result(good, good ? `The project with ${n.firstName} goes well, and the credit is shared.` : `You and ${n.firstName} pull in different directions. It gets done, just about.`);
    }
    case 'mentorMe': {
      const yes = rng.chance(clamp(0.2 + (n.meters.relationship - 40) / 80, 0.05, 0.9));
      if (!yes) { rel(-1); return result(false, `${n.firstName} says they are flattered, but too busy.`); }
      n.flags.mentor = true;
      remember(n, 'mentored', 'They agreed to mentor you.');
      milestone(`Found a mentor: ${n.firstName} ${n.lastName}.`, 'career');
      return result(true, `${n.firstName} agrees to mentor you. Coffee once a month, and honest answers.`);
    }
    case 'mentorThem': {
      if (!c.mentees.some((m) => m.id === n.id)) c.mentees.push({ id: n.id, since: p.age, level: n.life?.job?.level ?? 0, promoted: false });
      rel(8);
      if (n.life?.job) n.life.job.years += 1; // a head start
      remember(n, 'mentoredBy', 'You took them under your wing when they were starting out.');
      return result(true, `You start meeting ${n.firstName} every few weeks. They are quick, and grateful.`);
    }
    case 'review': {
      const tone = how ?? 'fair';
      rel({ generous: 6, fair: 2, tough: -6 }[tone]);
      if (tone === 'tough' && n.life?.job) n.life.job.years += 1;
      if (tone === 'generous' && c.careerId) c.performance = clamp(c.performance - 1);
      return result(true, { generous: `You give ${n.firstName} a glowing review. They will remember it; so will the budget.`,
        fair: `An honest review: what went well, what to work on. ${n.firstName} nods.`,
        tough: `You do not soften it. ${n.firstName} leaves the room quiet, and works harder.` }[tone], 'neutral');
    }
    case 'clearAir': {
      const ok = rng.chance(clamp(0.4 + (p.stats.charm - 50) / 120, 0.1, 0.85));
      rel(ok ? 15 : -5);
      return result(ok, ok ? `You and ${n.firstName} talk it out. Not friends, perhaps, but no longer at war.` : `${n.firstName} is not ready to hear it.`);
    }
    default: return result(false, 'Nothing happens.', 'neutral');
  }
}

// ---------- Moving up, and across ----------

/** Tracks the player could move across into from where they are now. */
export function lateralOptions() {
  const c = careerState();
  if (!c.careerId) return [];
  return CAREERS.filter((t) => (t.from ?? []).some((f) => f.career === c.careerId && c.level >= f.level) && t.id !== c.careerId)
    .map((t) => ({ id: t.id, name: t.name, title: t.levels[0].title, family: t.family }));
}

/**
 * Moves across into a branch track at the same employer: a new ladder, the
 * same people. Requirements of the new track still apply.
 */
export function moveAcross(trackId) {
  const p = player();
  const c = careerState();
  const t = CAREER_BY_ID[trackId];
  const opt = lateralOptions().find((o) => o.id === trackId);
  if (!t || !opt) return result(false, 'That move is not open to you from here.', 'neutral');
  const reasons = unmet(t, { lateral: true }).filter((r) => !/current job/.test(r));
  if (reasons.length) return result(false, reasons[0], 'neutral');
  if (p.flags.lateralAge === p.age) return result(false, 'You have already asked to move this year.', 'neutral');
  p.flags.lateralAge = p.age;
  const b = npcsByRole('tag:boss')[0];
  const odds = clamp(0.3 + (c.performance - 55) / 90 + ((b?.meters.relationship ?? 50) - 50) / 160 + (livingNpcs().some((n) => n.flags.mentor) ? 0.1 : 0), 0.05, 0.9);
  if (!rng.chance(odds)) return result(false, `${b?.firstName ?? 'Your boss'} says there is no opening on that side just now. Keep your reviews strong and ask again.`);
  const e = employer(c.employerId) ?? placeAt(trackId, p.countryId, p.city);
  if (!e.tracks.includes(trackId)) e.tracks.push(trackId);
  recordJob('moved across');
  const pay = payAt(e, t, 0);
  c.careerId = trackId;
  c.lastField = trackId;
  c.level = 0;
  c.title = t.levels[0].title;
  c.salary = Math.max(c.salary, pay[0]);
  [c.bandLo, c.bandHi] = pay;
  c.yearsInRole = 0;
  c.hours = t.hours;
  chronicle(e, `${p.firstName} ${p.lastName} moved across to ${t.levels[0].title.toLowerCase()}.`);
  const text = `You move across to ${an(t.levels[0].title.toLowerCase())} at ${e.name}, on ${fmtMoney(c.salary, country())} a year.`;
  log(text, 'system', 'good');
  milestone(`Moved across to ${t.name.toLowerCase()}.`, 'career');
  return result(true, text);
}

/** How likely the employer is to have a seat at the next level this year. */
export function vacancyOdds(c = careerState()) {
  const e = employer(c.employerId);
  if (!e) return 0.7;
  return clamp({ small: 0.45, medium: 0.7, large: 0.85, major: 0.95 }[e.size] * (0.6 + e.health / 120), 0.15, 1);
}

/** Asks for the next level now, rather than waiting for the review. */
export function applyForPromotion() {
  const p = player();
  const c = careerState();
  const car = CAREER_BY_ID[c.careerId];
  const next = car?.levels[c.level + 1];
  if (!next) return result(false, car ? 'You are at the top of this ladder.' : 'You do not have a job.', 'neutral');
  if (car.type === 'freelance') return result(false, 'Freelancers move up by being good, not by asking.', 'neutral');
  if (p.flags.promoAskAge === p.age) return result(false, 'You have already put yourself forward this year.', 'neutral');
  p.flags.promoAskAge = p.age;
  const step = nextStep();
  if (step.missing.length) return result(false, `To be ${next.title.toLowerCase()} you need ${step.missing.join(' and ')}.`, 'neutral');
  const level = car.levels[c.level];
  if (c.yearsInRole < Math.ceil(level.years * 0.6)) return result(false, `They want to see more time in your current role first: about ${Math.ceil(level.years * 0.6) - c.yearsInRole} more ${Math.ceil(level.years * 0.6) - c.yearsInRole === 1 ? 'year' : 'years'}.`, 'neutral');
  if (!rng.chance(vacancyOdds(c))) return result(false, `There is no ${next.title.toLowerCase()} post open at ${employer(c.employerId)?.name ?? 'your employer'} this year.`, 'neutral');
  const { odds, rival, b } = promotionChance(c);
  const read = rollRead(rng, odds);
  if (read.ok) { promote(); return result(true, `You put yourself forward, and got it. You are now ${an(c.title.toLowerCase())}.${afterWords(read)}`); }
  if (rival && rng.chance(0.5) && rival.life?.job) {
    rival.life.job.level += 1;
    rival.life.job.title = car.levels[rival.life.job.level]?.title ?? rival.life.job.title;
    rival.occupation = rival.life.job.title.toLowerCase();
    rival.meters.relationship = clamp(rival.meters.relationship - 4);
    feel(rival, 'resentful', `they got the ${next.title.toLowerCase()} job you went for`, 50);
    return result(false, `The ${next.title.toLowerCase()} job went to ${rival.firstName} ${rival.lastName}. You were told it was close.`);
  }
  // What held them back, as the boss would put it.
  const why = c.performance < 65 ? 'they want to see stronger work from you first'
    : (b?.meters.relationship ?? 50) < 45 ? `${b?.firstName ?? 'your boss'} is not yet in your corner`
      : 'someone else was a little further along';
  return result(false, `Not this time: ${why}.${afterWords(read)} ${b?.firstName ?? 'Your boss'} says to keep doing what you are doing.`);
}

/** The chance a promotion goes your way if a post is open: your work, your boss, a mentor, a rival. */
function promotionChance(c = careerState()) {
  const rival = npcsByRole('coworker').find((n) => !n.flags.report && n.life?.job?.level === c.level && n.meters.intellect > 60);
  const b = npcsByRole('tag:boss')[0];
  const mentor = livingNpcs().some((n) => n.flags.mentor) ? 0.08 : 0;
  const odds = clamp(0.15 + (c.performance - 60) / 70 + ((b?.meters.relationship ?? 50) - 50) / 200 + mentor - (rival ? 0.1 : 0), 0.03, 0.85);
  return { odds, rival, b };
}
/** The chance of a promotion, in plain words, counting the chance a post is open at all. */
export function promotionOdds() {
  const c = careerState();
  if (!c?.careerId) return '';
  return oddsWords(vacancyOdds(c) * promotionChance(c).odds);
}

/** For the hub: the people at work right now. */
export function team() {
  return { boss: npcsByRole('tag:boss')[0] ?? null, coworkers: npcsByRole('coworker').filter((n) => !n.flags.report), reports: npcsByRole('coworker').filter((n) => n.flags.report),
    mentors: livingNpcs().filter((n) => n.flags.mentor), former: npcsByRole('colleague') };
}
