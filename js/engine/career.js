// Careers: finding work, interviews and auditions, the yearly review, raises,
// promotions, getting fired, gigs, fame, and retirement.
import { hiringClimate, layoffChance } from './economy.js';
import { payK } from './cities.js';
import { rule, may } from './rules.js';
import { residency } from './citizenship.js';
import { licenceFor, licensed, examName } from './adulted.js';
import { PROGRAMMES } from '../data/schools.js';
import { hiringEdge } from './languages.js';
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, localWage } from '../util.js';
import { store, player, country, npcsByRole, livingNpcs, log, milestone } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { resolve, remember } from './conditions.js';
import { CAREERS, CAREER_BY_ID, CAREER_CATEGORIES, BRANCHES, RETIREMENT_AGE, EARLY_RETIREMENT_AGE,
  GIGS, MAX_GIGS_PER_YEAR, FAME_ACTIONS } from '../data/careers.js';
import { GENERAL, PRACTICAL, MILITARY, AUDITION_PIECES } from '../data/interviewQuestions.js';
import { MAJOR_BY_ID } from '../data/majors.js';
import { TRADE_BY_ID, CERT_BY_ID } from '../data/schools.js';
import { MILITARY_BRANCHES, BRANCH_RANKS } from '../data/occupations.js';
import { employer, placeAt, payAt, chronicle, tickEmployers } from './employers.js';
import { joinWorkplace, leaveWorkplace, tickWorkplace, vacancyOdds } from './workplace.js';
import { ensureCareer, tickWorkLife, workLaw, canFit } from './worklife.js';
import { tickSides } from './sideJobs.js';
import { tickFreelance } from './freelance.js';
import { tickRecruiters } from './recruiters.js';
import { tickOffers } from './hiring.js';
import { checkAchievements } from './careerRecord.js';
import { tickBusinesses } from './business.js';
import { rightToLive } from './citizenship.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
/** "a teacher", "an ensemble member". */
const an = (noun) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
const K = 1000;
export const STAT_NAMES = { 'stats.health': 'Health', 'stats.intellect': 'Intellect', 'stats.charm': 'Charm',
  'talents.acting': 'Acting', 'talents.singing': 'Singing', 'talents.dance': 'Dance', 'talents.sports': 'Sports',
  'talents.music': 'Music', tripleThreat: 'Triple-threat score', 'social.followers': 'Followers', 'hidden.discipline': 'Discipline' };

/** Per-year action counters; reset when the age changes. */
function acts() {
  const p = player();
  if (p.flags.workActs?.age !== p.age) {
    p.flags.workActs = { age: p.age, harder: 0, slack: 0, raise: 0, applied: {}, gigs: [], fame: {} };
  }
  return p.flags.workActs;
}

const degrees = () => player().education.degrees;
const hasDegree = (type) => degrees().some((d) => d.type === type);
const hasTrade = (id) => degrees().some((d) => d.type === 'apprenticeship' && d.majorId === id);
const bestGpa = () => Math.max(0, ...degrees().filter((d) => d.type !== 'apprenticeship').map((d) => d.gpa));

export const currentCareer = () => CAREER_BY_ID[player().career.careerId];
export const currentLevel = () => currentCareer()?.levels[player().career.level];
export const boss = () => npcsByRole('tag:boss')[0];

// ---------- Requirements ----------

/**
 * Reasons the player cannot be considered for a career. Empty means eligible.
 * o.lateral: moving across from inside the employer (branch-only tracks are open that way).
 * o.ignoreCurrent: the same work at a different employer is not "your current job".
 */
export function unmet(career, o = {}) {
  const p = player();
  const r = career.req ?? {};
  const out = [];
  if (p.legal.incarceration) out.push('Not from a cell.');
  if (career.type !== 'freelance' && !residency(p).workAuthorized) out.push('Your student visa does not allow full-time work.');
  if (p.career.careerId === career.id && !o.ignoreCurrent) out.push('This is your current job.');
  if (career.type === 'military' && !rightToLive(p.countryId, p)) out.push('The armed forces here take citizens only.');
  if (p.age < workLaw().workAge && !career.agesOut) out.push(`You must be ${workLaw().workAge} to work here.`);
  // Some work is reached from inside another career, or after years of it.
  if (r.experience) {
    const have = Object.entries(r.experience).some(([id, yrs]) => (ensureCareer(p.career).experience[id] ?? 0) >= yrs);
    if (!have) out.push(`Needs ${Object.entries(r.experience).map(([id, y]) => `${y} years as ${CAREER_BY_ID[id]?.levels[0].title.toLowerCase() ?? id}`).slice(0, 3).join(', or ')}.`);
  } else if (career.branchOnly && !o.lateral) {
    const from = (career.from ?? []).map((f) => CAREER_BY_ID[f.career]?.levels[f.level]?.title.toLowerCase()).filter(Boolean);
    out.push(from.length ? `Reached from inside a career: as ${from.slice(0, 3).join(', or as ')}, ask to move across.` : 'Reached only from inside a career.');
  }
  for (const prog of r.programmes ?? []) if (!hasDegree(prog)) out.push(`Needs you to have finished ${PROGRAMMES[prog].label.toLowerCase()}.`);
  if (p.education.enrolled && p.education.stage !== 'none' && career.type !== 'freelance' && !p.education.partTime) {
    out.push('Finish or leave your course first.');
  }
  const vouched = !!standingOffer(career);
  if (vouched) { /* someone who knows your work is holding the job for you */ }
  else if (r.altOnly && r.altCert && !degrees().some((d) => d.type === 'certificate' && d.majorId === r.altCert)) out.push(`Needs a ${CERT_BY_ID[r.altCert]?.name.toLowerCase() ?? 'professional'} certificate.`);
  // Some careers have another way in: a certificate in the skill, or a vocational school.
  else if ((r.altCert && degrees().some((d) => d.type === 'certificate' && d.majorId === r.altCert)) || (r.altProgramme && hasDegree(r.altProgramme))) {
    const l = r.altProgramme ? licenceFor(r.altProgramme) : null;
    if (l && !licensed(l)) out.push(`Needs you to pass the ${examName(l)}.`);
  }
  else if (r.degree === 'high' && !degrees().length) out.push('Needs a high-school diploma.');
  else if (r.degree === 'university' && !hasDegree('university')) out.push('Needs a university degree.');
  else if (r.majors && !degrees().some((d) => d.type === 'university' && (r.majors.includes(d.majorId) || r.majors.includes(d.minorId)))) {
    const names = r.majors.slice(0, 3).map((m) => MAJOR_BY_ID[m].name);
    out.push(`Needs a degree in ${names.join(', ')}${r.majors.length > 3 ? ' or similar' : ''}.`);
  }
  if (r.programme && !hasDegree(r.programme)) {
    out.push({ medical: 'Needs a medical degree.', law: 'Needs a law degree.',
      cosmetology: 'Needs a hair and makeup licence.' }[r.programme] ?? `Needs you to have finished ${PROGRAMMES[r.programme].label.toLowerCase()}.`);
  } else if (r.programme && licenceFor(r.programme) && !licensed(licenceFor(r.programme)) && !vouched) {
    // The degree is not the right to practise.
    out.push(`Needs you to pass the ${examName(licenceFor(r.programme))}.`);
  }
  if (r.trade && !hasTrade(r.trade)) out.push(`Needs a completed ${TRADE_BY_ID[r.trade].name.toLowerCase()} apprenticeship.`);
  if (r.minAge && p.age < r.minAge) out.push(`You need to be ${r.minAge}.`);
  if (r.maxAge && p.age > r.maxAge) out.push(`They only take people up to ${r.maxAge}.`);
  for (const [path, min] of Object.entries(r.stats ?? {})) {
    const have = Math.round(Number(resolve(path)) || 0);
    if (have < min) out.push(`Needs ${STAT_NAMES[path] ?? path} of ${min} (yours: ${have}).`);
  }
  if (r.cleanRecord && p.legal.record.some((c) => c.convicted && !c.juvenile)) out.push('Needs a clean record.');
  return out;
}

const doorOpen = (d) => (d.flag ? !!player().flags[d.flag] : hasTrade(d.trade));

/** A standing offer that skips the hiring process, if the player has one. */
function standingOffer(career) {
  const p = player();
  // An employer who liked their intern keeps a job open for them.
  if (p.flags.returnOffer?.careerId === career.id && !p.flags[`usedDoor_${career.id}`]) return { guaranteed: true, level: 0, text: `${p.flags.returnOffer.employer} kept its word: the job was waiting for you.` };
  // A supervisor from a student job who offered to take the player on.
  if (p.flags.standing?.[career.id] >= store.state.year - 2 && !p.flags[`usedDoor_${career.id}`]) return { guaranteed: true, level: 0, text: 'Your old supervisor was as good as their word: the job is yours.' };
  return (career.doors ?? []).find((d) => d.guaranteed && doorOpen(d) && !player().flags[`usedDoor_${career.id}`]);
}

/** How much contacts, history and a matching specialism improve the odds. */
export function doorBonus(career) {
  const p = player();
  let bonus = (career.doors ?? []).filter((d) => !d.guaranteed && doorOpen(d)).reduce((s, d) => s + d.bonus, 0);
  if (career.focus && p.flags.cosmoFocus === career.focus) bonus += 0.25;
  if ((p.flags.internships ?? []).some((i) => i.careerId === career.id)) bonus += 0.2; // they have done the work before
  if (career.req?.altCert && degrees().some((d) => d.type === 'certificate' && d.majorId === career.req.altCert)) bonus += 0.1; // a certificate in exactly this
  if (livingNpcs().some((n) => n.flags.mentor && n.meters.relationship >= 60)) bonus += 0.05; // a word from a mentor
  return bonus + hiringEdge(p) + hiringClimate(); // the economy; and languages: an asset anywhere, and a barrier where you cannot speak the one in use
}

export const payBand = (level) => level.pay.map((k) => Math.round(localWage(k * K, country()) * payK())); // what the work pays in this city
/** The most a level will ever pay, however many raises you collect. */
const payCeiling = (level) => Math.round(payBand(level)[1] * 1.25);
const capSalary = () => {
  const c = player().career;
  const level = currentLevel();
  if (level) c.salary = Math.min(c.salary, payCeiling(level));
};

/** Everything in a category, with what stands between the player and each job. */
export function careersIn(categoryId) {
  return CAREERS.filter((c) => c.category === categoryId).map((c) => {
    const reasons = unmet(c);
    const offer = standingOffer(c);
    const start = c.levels[offer?.level ?? 0];
    return { id: c.id, name: c.name, title: start.title, pay: payBand(start), eligible: !reasons.length,
      reasons, offer: offer?.text ?? '', applied: !!acts().applied[c.id], helped: doorBonus(c) - hiringEdge(player()) > 0 };
  });
}
export const categories = () => CAREER_CATEGORIES;

// ---------- Getting hired ----------

/**
 * Begins an application and says what the player has to do next.
 * @returns {{kind:'blocked'|'offer'|'interview'|'audition'|'portfolio', text?:string, questions?:object[], pieces?:object[]}}
 */
export function startApplication(id) {
  const career = CAREER_BY_ID[id];
  const pr = player().royal;
  if (pr && !pr.waiting && ['monarch', 'heir', 'royal'].includes(pr.rank) && career.type !== 'military') {
    return { kind: 'blocked', text: 'Members of the royal family do not take jobs. The armed forces are the one exception; otherwise you would have to give up your place first.' };
  }
  if (player().politics && player().politics.tier >= 2) return { kind: 'blocked', text: `Being ${player().politics.title} is a full-time job. You would have to resign first.` };
  if (unmet(career).length) return { kind: 'blocked', text: unmet(career)[0] };
  const offer = standingOffer(career);
  if (offer) return { kind: 'offer', text: offer.text };
  if (acts().applied[id]) return { kind: 'blocked', text: 'You already tried for this one this year.' };
  if (career.hire === 'audition') return { kind: 'audition', pieces: AUDITION_PIECES[career.skill] ?? AUDITION_PIECES['talents.acting'] };
  if (career.hire === 'portfolio') return { kind: 'portfolio' };
  const pool = [...({ practical: [...PRACTICAL, ...GENERAL.slice(0, 4)], military: MILITARY }[career.hire] ?? GENERAL)];
  const questions = [];
  while (questions.length < 3 && pool.length) questions.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return { kind: 'interview', questions };
}

/**
 * Finishes an application.
 * @param {string} id
 * @param {number[]} answers  interview: the score of each answer given; audition: [piece index]
 */
export function finishApplication(id, answers = []) {
  const p = player();
  const career = CAREER_BY_ID[id];
  const offer = standingOffer(career);
  if (offer) {
    p.flags[`usedDoor_${id}`] = true;
    return hire(career, offer.level ?? 0, 60, offer.text);
  }
  acts().applied[id] = true;
  const bonus = doorBonus(career);
  const back = p.career.lastField === id ? Math.max(0, (p.career.lastLevel ?? 0) - 1) : 0;

  if (career.hire === 'portfolio') {
    return hire(career, 0, 50, { author: 'You clear a desk, open a blank page, and call yourself a writer.', influencer: 'You set up a ring light and start posting every day.',
      screenwriting: 'You write your first script, and send it to everyone you can find.', photography: 'You put a portfolio online and print some cards.',
      music_prod: 'You turn a spare room into a studio, and start taking sessions.', beekeeping: 'You buy your first hives and a veil.',
      organizing: 'You photograph a before-and-after, and the calls start coming.' }[career.id] ?? `You set yourself up as ${an(career.levels[0].title.toLowerCase())}.`);
  }

  if (career.hire === 'audition') {
    const piece = (AUDITION_PIECES[career.skill] ?? AUDITION_PIECES['talents.acting'])[answers[0] ?? 0];
    const need = career.req.stats?.[career.skill] ?? 50;
    const chance = clamp(0.3 + ((Number(resolve(piece.path)) || 0) - need) / 45 + piece.edge + bonus, 0.03, 0.97);
    if (rng.chance(chance)) {
      return hire(career, back, 55 + (piece.bonus ? 15 : 0), `You chose ${piece.t.toLowerCase()}, and it landed.`);
    }
    p.stats.mood = clamp(p.stats.mood - 5);
    const text = `You chose ${piece.t.toLowerCase()}. "Thank you, we will be in touch." They are not in touch. You can try again next year.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }

  // Interview: how you answered matters most, then how you come across.
  const score = answers.reduce((s, a) => s + a, 0) / (2 * Math.max(1, answers.length));
  const manner = career.hire === 'interview' ? (p.stats.charm - 50) / 250
    : career.hire === 'military' ? (p.stats.health - 50) / 200 + (p.hidden.discipline - 50) / 250
      : (p.hidden.discipline - 50) / 250;
  const grades = bestGpa() ? (bestGpa() - 3) * 0.1 : 0;
  const chance = clamp(0.2 + score * 0.55 + manner + grades + bonus, 0.05, 0.97);
  if (rng.chance(chance)) {
    return hire(career, back, 45 + Math.round(score * 20),
      score >= 0.8 ? 'You answered every question well.' : score >= 0.5 ? 'A solid interview.' : 'It was not a strong interview, but they took a chance on you.');
  }
  p.stats.mood = clamp(p.stats.mood - 4);
  const text = `${score >= 0.8 ? 'You interviewed well, but they went with someone more experienced.' : score >= 0.5
    ? 'A couple of your answers fell flat, and the job went to someone else.' : 'The interview went badly. You could feel it.'} You can try again next year.`;
  log(text, 'system', 'bad');
  return result(false, text);
}

function addNpc(npc) {
  store.state.npcs[npc.id] = npc;
  player().npcIds.push(npc.id);
  npc.lastInteractionAge = player().age;
  return npc;
}

/** People you no longer work with stay in your life: the close ones as friends, the rest as former colleagues. */
const leaveColleagues = () => leaveWorkplace();

/** Files the current job in the history, with where it was. */
export function recordJob(exit) {
  const p = player();
  const c = p.career;
  if (!c.careerId) return;
  const e = employer(c.employerId);
  c.history.push({ careerId: c.careerId, title: c.title, from: p.age - c.yearsInRole, to: p.age, exit, kind: 'job', level: c.level,
    employerId: c.employerId ?? null, employer: e?.name ?? null, city: e?.city ?? p.city, countryId: e?.countryId ?? p.countryId, salary: c.salary });
  if (e) chronicle(e, `${p.firstName} ${p.lastName} left (${exit}) as ${an(c.title.toLowerCase())}.`);
}

/** A title as this country (or service branch) names it. */
export function localTitle(career, level, branch = null) {
  const ranks = BRANCH_RANKS[career.id] ?? {};
  const generic = branch && (ranks[branch] ? branch : Object.keys(ranks).find((k) => branch.endsWith(` ${k}`) || (k === 'Navy' && /Navy|Marinha|Armada|Marine nationale/.test(branch)) || (k === 'Air Force' && /Air Force|Luftwaffe|Air Self|Força Aérea|Fuerza Aérea/.test(branch))));
  return (generic && ranks[generic]?.[level]) ?? career.titlesBy?.[player().countryId]?.[level] ?? career.levels[level].title;
}

/** The service branches of the country the player lives in. */
export const branchesHere = () => MILITARY_BRANCHES[player().countryId] ?? MILITARY_BRANCHES.default;

/**
 * Starts a job. o (all optional): employerId and postingId (where the job is), salary, hours, remote, branch.
 * Without an employer, the player is placed at a fitting one in their city.
 */
export function hire(career, level, performance, how, o = {}) {
  const p = player();
  const c = ensureCareer(p.career);
  const cty = country();

  // A part-time job stays if the hours still work; otherwise it goes.
  if (c.partTime && career.type !== 'freelance' && !canFit(career.hours, { kind: 'job', replacesMain: true }).ok) {
    c.history.push({ careerId: c.partTime.jobId, title: c.partTime.title, from: c.partTime.since, to: p.age, exit: 'moved on', kind: 'parttime', employer: c.partTime.place });
    c.partTime = null;
  }
  if (c.careerId) { recordJob('left for another job'); leaveColleagues(); }
  if (c.retired) c.unretired = true; // back to work after retiring: the pension goes on being paid
  const sameField = c.lastField === career.id;
  const e = career.type === 'freelance' ? null : employer(o.employerId) ?? placeAt(career.id, p.countryId, p.city);
  const branch = career.type === 'military' ? (o.branch ?? rng.pick(branchesHere())) : null;
  const title = localTitle(career, level, branch);
  const [lo, hi] = e ? payAt(e, career, level) : payBand(career.levels[level]);
  c.careerId = career.id;
  c.lastField = career.id;
  c.title = title;
  c.level = level;
  c.salary = o.salary ?? Math.round(lo + (hi - lo) * rng.next() * 0.7);
  c.bandLo = lo;
  c.bandHi = hi;
  c.performance = performance;
  c.yearsInRole = 0;
  c.yearsInField = sameField ? c.yearsInField : 0;
  c.retired = false;
  c.employerId = e?.id ?? null;
  c.postingId = o.postingId ?? null;
  c.startYear = store.state.year;
  c.hours = o.hours ?? career.hours;
  c.extra = 0;
  c.remote = o.remote ?? 'none';
  c.leave = null;
  c.military = career.type === 'military' ? { rank: level, branch, deployments: 0 } : null;
  if (career.type === 'military') p.flags.served = true;
  p.counters.jobsHeld += 1;

  let people = '';
  if (e) {
    const { boss: b } = joinWorkplace(e, career.id, level);
    chronicle(e, `${p.firstName} ${p.lastName} joined as ${an(title.toLowerCase())}.`);
    people = ` You report to ${b.firstName} ${b.lastName}.`;
  }

  const where = c.military ? ` in the ${c.military.branch}` : e ? ` at ${e.name}` : '';
  const lvl = { title };
  let text = `${how} You start as ${an(lvl.title.toLowerCase())}${where} on ${fmtMoney(c.salary, cty)} a year.${people}`;
  if (p.flags.livesWithParents && p.age >= 18 && career.type !== 'freelance') {
    p.flags.livesWithParents = false;
    p.education.housing = 'apartment';
    text += ' With a wage of your own, you move out of the family home.';
  }
  log(text, 'system', 'good');
  if (p.counters.jobsHeld === 1 || !sameField) milestone(`Started work as ${an(lvl.title.toLowerCase())}${where}.`, 'career');
  return result(true, text);
}

/** Puts the player into a job they already held as someone else (see engine/legacy.js). */
export function takeOverJob(job, yearsWorked = 0) {
  const p = player();
  const career = CAREER_BY_ID[job?.careerId];
  if (!career) return;
  const lvl = career.levels[job.level];
  const c = ensureCareer(p.career);
  const e = career.type === 'freelance' ? null : employer(job.employerId) ?? placeAt(career.id, p.countryId, p.city);
  const branch = career.type === 'military' ? rng.pick(branchesHere()) : null;
  Object.assign(c, { careerId: career.id, lastField: career.id, title: localTitle(career, job.level, branch) ?? lvl.title, level: job.level, salary: job.salary,
    performance: 55, yearsInRole: job.years, yearsInField: Math.max(job.years, yearsWorked), totalYears: yearsWorked, retired: false,
    employerId: e?.id ?? null, hours: career.hours, startYear: store.state.year - job.years,
    military: career.type === 'military' ? { rank: job.level, branch, deployments: 0 } : null });
  if (e) [c.bandLo, c.bandHi] = payAt(e, career, job.level);
  c.experience[career.id] = Math.max(c.experience[career.id] ?? 0, Math.max(job.years, yearsWorked));
  p.counters.jobsHeld = 1;
  if (e) joinWorkplace(e, career.id, job.level);
}

// ---------- Actions at work ----------

export function workHarder() {
  const p = player();
  if (!p.career.careerId) return result(false, 'You do not have a job.');
  if (acts().harder) return result(false, 'You are already giving it everything this year.', 'neutral');
  acts().harder = 1;
  // Effort shows most when there is room to improve; at the top it mostly costs you.
  const c = ensureCareer(p.career);
  const gain = Math.round(10 * (1 - c.performance / 110));
  c.performance = clamp(c.performance + gain);
  c.stress = clamp(c.stress + 8);
  p.stats.mood = clamp(p.stats.mood - 4);
  p.hidden.discipline = clamp(p.hidden.discipline + 1);
  const text = gain >= 5 ? 'You came in early and stayed late all year. It has been noticed.' : 'You pushed harder still. You were already doing well; the extra hours mostly cost you sleep.';
  log(text, 'system', 'good');
  return result(true, text);
}

export function slackOffAtWork() {
  const p = player();
  if (!p.career.careerId) return result(false, 'You do not have a job.');
  if (acts().slack) return result(false, 'You are already doing as little as you can get away with.', 'neutral');
  acts().slack = 1;
  p.career.performance = clamp(p.career.performance - 10);
  ensureCareer(p.career).stress = clamp(p.career.stress - 6);
  p.stats.mood = clamp(p.stats.mood + 5);
  const text = 'You did the minimum this year and took every lunch hour in full.';
  log(text);
  return result(true, text, 'neutral');
}

export function askForRaise() {
  const p = player();
  const c = p.career;
  const b = boss();
  if (!c.careerId || currentCareer().type === 'freelance') return result(false, 'There is nobody to ask.');
  if (acts().raise) return result(false, 'You have already asked this year.', 'neutral');
  acts().raise = 1;
  const chance = clamp((c.performance - 45) / 55 + ((b?.meters.relationship ?? 50) - 50) / 200, 0.03, 0.9);
  if (rng.chance(chance)) {
    const pct = rng.int(4, 10);
    c.salary = Math.round(c.salary * (1 + pct / 100));
    capSalary();
    const text = `${b ? b.firstName : 'Your boss'} agreed: a ${pct}% raise, taking you to ${fmtMoney(c.salary, country())} a year.`;
    log(text, 'system', 'good');
    return result(true, text);
  }
  if (b) b.meters.relationship = clamp(b.meters.relationship - (c.performance < 45 ? 10 : 4));
  const text = c.performance < 45
    ? `${b ? b.firstName : 'Your boss'} looked at your last review, then at you. "Now is not the time."`
    : `${b ? b.firstName : 'Your boss'} said the budget is not there this year.`;
  log(text, 'system', 'bad');
  return result(false, text);
}

function endJob(exit) {
  const c = player().career;
  if (c.military && c.yearsInField >= 2) player().flags.veteran = true;
  recordJob(exit);
  leaveColleagues();
  c.lastLevel = c.level;
  c.careerId = null;
  c.title = null;
  c.salary = 0;
  c.level = 0;
  c.yearsInRole = 0;
  c.military = null;
  c.employerId = null;
  c.postingId = null;
  c.extra = 0;
  c.leave = null;
}

export function quitCareer() {
  const c = player().career;
  if (!c.careerId) return result(false, 'You do not have a job.');
  const text = `You handed in your notice as ${an(c.title.toLowerCase())}.`;
  endJob('quit');
  log(text);
  return result(true, text, 'neutral');
}

/** Used by events and the yearly review. */
export function fire(reason = 'fired') {
  const p = player();
  const c = p.career;
  if (!c.careerId) return;
  log(`You were ${reason} from your job as ${an(c.title.toLowerCase())}.`, 'system', 'bad');
  if (reason === 'laid off' || reason === 'let go when the employer closed') {
    const pay = Math.round(c.salary * 0.25);
    p.finance.cash += pay;
    p.finance.lifetimeEarned += pay;
    log(`You were given ${fmtMoney(pay, country())} in severance.`);
    // Where the law provides it, a share of the old wage while looking for the next job.
    const rate = workLaw().unemployment;
    if (rate > 0) {
      ensureCareer(c).benefit = { amount: Math.round(c.salary * rate), yearsLeft: 1 };
      log(`You can claim unemployment benefit for a year: about ${fmtMoney(c.benefit.amount, country())}.`);
    }
  }
  p.stats.mood = clamp(p.stats.mood - 12);
  endJob(reason);
}

export const adjustPerformance = (d) => {
  const c = player().career;
  if (c.careerId) c.performance = clamp(c.performance + d);
};
export const scaleSalary = (m) => {
  const c = player().career;
  if (c.careerId) { c.salary = Math.round(c.salary * m); capSalary(); }
};

/** Thresholds the next level demands that the player does not yet meet. */
function missingFor(level) {
  return Object.entries(level?.needs ?? {})
    .filter(([path, min]) => (Number(resolve(path)) || 0) < min)
    .map(([path, min]) => `${STAT_NAMES[path] ?? path} of ${min.toLocaleString('en-US')}`);
}

/** What stands between the player and the next level, for display. */
export function nextStep() {
  const c = player().career;
  const career = currentCareer();
  const next = career?.levels[c.level + 1];
  if (!next) return null;
  return { title: next.title, missing: missingFor(next), yearsLeft: Math.max(0, career.levels[c.level].years - c.yearsInRole) };
}

export function promote() {
  const p = player();
  const c = p.career;
  const career = currentCareer();
  const next = career?.levels[c.level + 1];
  if (!next) return false;
  c.level += 1;
  c.title = localTitle(career, c.level, c.military?.branch);
  const e = employer(c.employerId);
  const [lo, hi] = e ? payAt(e, career, c.level) : payBand(next);
  c.salary = Math.max(Math.round(c.salary * 1.08), Math.round(lo + (hi - lo) * rng.next() * 0.6));
  c.bandLo = lo;
  c.bandHi = hi;
  c.yearsInRole = 0;
  c.promotions = (c.promotions ?? 0) + 1;
  if (c.military) c.military.rank = c.level;
  if (e) chronicle(e, `${p.firstName} ${p.lastName} was promoted to ${c.title.toLowerCase()}.`);
  p.stats.mood = clamp(p.stats.mood + 10);
  log(`You were promoted to ${c.title.toLowerCase()}, on ${fmtMoney(c.salary, country())} a year.`, 'system', 'good');
  if (c.level === career.levels.length - 1) milestone(`Reached the top of the profession: ${c.title.toLowerCase()}.`, 'career');
  if (career.fame && c.level === career.fame.from) {
    log(`People are starting to recognise you. You are becoming known as a ${career.fame.label.toLowerCase()}.`, 'system', 'good');
  }
  return true;
}

// ---------- Retirement ----------

export const canRetire = () => {
  const p = player();
  const career = currentCareer();
  if (!career) return false;
  return p.age >= EARLY_RETIREMENT_AGE || (career.pensionAfter && p.career.yearsInField >= career.pensionAfter);
};

export function pensionEstimate() {
  const c = ensureCareer(player().career);
  const career = currentCareer();
  let share = Math.min(0.6, (c.totalYears ?? 0) * 0.015);
  if (career?.pensionAfter && c.yearsInField >= career.pensionAfter) share = Math.max(share, 0.5);
  // What the employer put aside is paid out over about twenty years.
  return Math.round(c.salary * share + c.pensionPot / 20);
}

export function retire() {
  const p = player();
  const c = p.career;
  if (!canRetire()) return result(false, 'You cannot retire yet.');
  const pension = pensionEstimate();
  const title = c.title;
  endJob('retired');
  c.retired = true;
  c.retiredAge = p.age;
  c.pensionPerYear = Math.max(c.pensionPerYear ?? 0, pension);
  c.pensionDrawn = true;
  c.pensionPot = 0;
  c.sides = c.sides ?? [];
  const text = `You retired as ${an(title.toLowerCase())} on a pension of ${fmtMoney(c.pensionPerYear, country())} a year.`;
  log(text, 'system', 'good');
  milestone(`Retired as ${an(title.toLowerCase())}.`, 'career');
  return result(true, text);
}

// ---------- Freelance gigs ----------

/** @returns {{id, name, pay:number, available:boolean, reason:string}[]} */
export function gigOptions() {
  const p = player();
  const done = acts().gigs;
  return GIGS.map((g) => {
    let reason = '';
    if (p.age < g.minAge) reason = `You need to be ${g.minAge}.`;
    else if (g.programme && !hasDegree(g.programme)) reason = 'Needs a hair and makeup licence.';
    else {
      const short = Object.entries(g.req).find(([path, min]) => (Number(resolve(path)) || 0) < min);
      if (short) reason = `Needs ${STAT_NAMES[short[0]]} of ${short[1]}.`;
      else if (done.includes(g.id)) reason = 'Already done this year.';
      else if (done.length >= MAX_GIGS_PER_YEAR) reason = `You only have time for ${MAX_GIGS_PER_YEAR} gigs a year.`;
    }
    const skill = Number(resolve(g.skill)) || 0;
    return { id: g.id, name: g.name, pay: localWage(g.pay * (0.6 + skill / 100), country()), available: !reason, reason };
  });
}
export const canGig = () => player().age >= 12 && !player().legal.incarceration;

export function doGig(id) {
  const p = player();
  const g = GIGS.find((x) => x.id === id);
  const option = gigOptions().find((o) => o.id === id);
  if (!option.available) return result(false, option.reason, 'neutral');
  acts().gigs.push(id);
  p.finance.cash += option.pay;
  p.finance.lifetimeEarned += option.pay;
  const [group, key] = g.skill.split('.');
  if (group === 'talents') p.talents[key] = clamp(p.talents[key] + 1);
  p.stats.mood = clamp(p.stats.mood - 1);
  const text = `Gig done: ${g.name.toLowerCase()}. You were paid ${fmtMoney(option.pay, country())}.`;
  log(text, 'system', 'good');
  return result(true, text);
}

// ---------- Fame ----------

export const fame = () => Math.round(player().hidden.fame);

/** @returns {{id, name, available:boolean, reason:string}[]} */
export function fameOptions() {
  const done = acts().fame;
  return FAME_ACTIONS.map((a) => ({ id: a.id, name: a.name, available: fame() >= a.min && !done[a.id],
    reason: fame() < a.min ? `Needs ${a.min}% fame.` : done[a.id] ? 'Already done this year.' : '' }));
}

export function doFameAction(id) {
  const p = player();
  const a = FAME_ACTIONS.find((x) => x.id === id);
  if (!fameOptions().find((o) => o.id === id).available) return result(false, 'Not available right now.', 'neutral');
  acts().fame[id] = true;
  const went = rng.chance(clamp(0.55 + ((Number(resolve(a.skill)) || 0) - 50) / 80, 0.1, 0.95));
  const pay = localMoney(a.cash * (0.5 + fame() / 40) * (went ? 1 : 0.3), country());
  p.finance.cash += pay;
  p.finance.lifetimeEarned += pay;
  p.hidden.fame = clamp(p.hidden.fame + (went ? a.fame : a.risky ? -8 : -1));
  if (a.karma) p.hidden.karma = clamp(p.hidden.karma + a.karma);
  p.stats.mood = clamp(p.stats.mood + (went ? 6 : -6));
  const text = `${went ? a.ok : a.fail} You were paid ${fmtMoney(pay, country())}.`;
  log(text, 'system', went ? 'good' : 'bad');
  if (went && id === 'book') milestone('Published a book.', 'fame');
  return result(went, text);
}

// ---------- The yearly step ----------

/**
 * The whole working year, in order: employers and the market move; the main
 * job is reviewed; side jobs, the workplace, freelance work and recruiters
 * have their year; stress and satisfaction settle; milestones are checked.
 * Payroll comes after, in finance (worklife.runPayroll). @returns {?string} a cause of death
 */
export function tickWork() {
  const p = player();
  tickEmployers();
  tickOffers();
  const death = tickCareer();
  if (death) return death;
  const lines = [...tickSides(), ...tickWorkplace(), ...tickFreelance(), ...tickBusinesses(), ...tickWorkLife(), ...tickRecruiters()];
  for (const l of lines) log(l);
  if (p.age >= 14) checkAchievements(p);
  return null;
}

/** Runs the working year. @returns {?string} a cause of death, in the rare case there is one */
export function tickCareer() {
  const p = player();
  const c = p.career;
  const career = currentCareer();
  const cty = country();
  if (!career) {
    p.hidden.fame = clamp(p.hidden.fame - 3);
    return null;
  }
  // Child performers grow up. What they did as a child follows them.
  if (career.agesOut && p.age >= career.agesOut) {
    const was = c.title.toLowerCase();
    endJob('grew up');
    log(`You are too old for children's parts now. Your years as ${an(was)} are over, and the people who cast grown-ups know your name.`, 'system', 'neutral');
    milestone(`Grew out of child acting${p.flags.childActor ? ', a known face' : ''}.`, 'career');
    return null;
  }
  const level = career.levels[c.level];
  ensureCareer(c);
  const e = employer(c.employerId);
  // The employer may have closed, or be cutting jobs.
  if (e?.closed) { fire('let go when the employer closed'); log(`${e.name} has closed. Everyone who worked there is looking for work.`, 'system', 'bad'); return null; }
  c.yearsInRole += 1;
  c.yearsInField += 1;
  c.experience[career.id] = (c.experience[career.id] ?? 0) + (c.hours < 30 ? 0.5 : 1);
  // How far a child performer got is remembered when they audition as an adult.
  if (career.agesOut) { p.flags.childExtra = true; if (c.level >= 2) p.flags.childActor = true; if (c.level >= 3) p.flags.childStar = true; }
  // Days on set are days out of the classroom.
  if (career.schoolCost && p.education.enrolled) {
    p.education.gpa = Math.max(0, Math.round((p.education.gpa - career.schoolCost * (1 + c.level * 0.5)) * 100) / 100);
  }
  c.totalYears = (c.totalYears ?? 0) + 1;

  // How the year went: skill, discipline, a mentor, how stretched or bored, and luck.
  const craft = career.skill ? ((Number(resolve(career.skill)) || 0) - 60) / 6 : (p.stats.intellect - 55) / 15;
  const mentor = livingNpcs().some((n) => n.flags.mentor && n.meters.relationship >= 55) ? 2 : 0;
  const strain = c.stress > 75 ? -(c.stress - 75) / 4 : c.stress < 15 ? -1 : 0; // some pressure helps; too much does not
  const heart = (c.satisfaction - 55) / 20;
  const away = c.leave && c.leave.age === p.age - 1 ? -3 : 0;
  c.performance = clamp(Math.round(c.performance + (55 - c.performance) * 0.25
    + (p.hidden.discipline - 50) / 12 + craft + mentor + strain + heart + away + rng.int(-6, 6)));
  if (career.skill === 'tripleThreat') for (const k of ['singing', 'dance', 'acting']) p.talents[k] = clamp(p.talents[k] + 1);
  else if (career.skill?.startsWith('talents.')) { const k = career.skill.slice(8); p.talents[k] = clamp(p.talents[k] + 1); }
  // How the work wears on mood and health is worked out in worklife.js (stress, satisfaction, burnout).

  if (career.type === 'freelance') {
    const [lo, hi] = payBand(level);
    c.salary = Math.round(lo + (hi - lo) * clamp(c.performance / 100 + rng.around(0, 0.2), 0, 1));
  }
  if (career.followersPerYear) {
    const gained = Math.round(career.followersPerYear[c.level] * (0.5 + c.performance / 100) * rng.around(1, 0.3));
    p.social.followers += Math.max(0, gained);
  }

  // Military service: deployments are rarer in peacetime, and almost always come home.
  if (c.military && rng.chance(0.22)) {
    c.military.deployments += 1;
    const roll = rng.next();
    if (roll < 0.004) return 'wounds received on deployment';
    if (roll < 0.14) {
      p.stats.health = clamp(p.stats.health - rng.int(8, 18));
      log('You were deployed overseas and came home injured.', 'system', 'bad');
    } else if (roll < 0.3) {
      c.performance = clamp(c.performance + 15);
      log('You were deployed overseas and decorated for what you did there.', 'system', 'good');
      milestone('Decorated on deployment.', 'career');
      c.military.honours = (c.military.honours ?? 0) + 1;
    } else {
      c.performance = clamp(c.performance + 5);
      log('You were deployed overseas. You came home in one piece.');
    }
  }

  // Space: training, and sometimes a mission.
  if (career.id === 'astronaut' && c.level >= 1 && rng.chance(0.3)) {
    c.missions = (c.missions ?? 0) + 1;
    const roll = rng.next();
    if (roll < 0.002) return 'an accident on a space mission';
    if (roll < 0.1) { log('Your mission was cut short by a fault, and you came home early, safely. The investigation clears your crew.', 'system', 'neutral'); c.performance = clamp(c.performance + 3); }
    else {
      c.performance = clamp(c.performance + 10);
      p.hidden.fame = clamp(p.hidden.fame + 6);
      log(rng.pick(['You flew a mission to the space station and ran experiments for months.', 'You launched, docked, and spent your nights watching the Earth turn below you.',
        'You walked in space to repair a failing panel. The pictures went round the world.']), 'system', 'good');
      milestone(c.missions === 1 ? 'Went to space.' : `Flew space mission number ${c.missions}.`, 'career');
    }
  }

  // The review
  const rating = c.performance >= 80 ? 'excellent' : c.performance >= 60 ? 'good' : c.performance >= 40 ? 'adequate' : 'poor';
  if (career.type !== 'freelance') log(`Your annual review as ${an(c.title.toLowerCase())}: ${rating}.`, 'system', rating === 'poor' ? 'bad' : 'neutral');

  if (career.type !== 'freelance' && c.performance < 25 && rng.chance(0.5)) { fire(c.military ? 'discharged' : 'fired'); return null; }
  // Layoffs follow the economy and how the employer is doing; good performers are kept longer.
  const cutting = e && e.health < 30 ? 2.5 : 1;
  if (career.type === 'fulltime' && rng.chance(layoffChance() * cutting * (c.performance >= 75 ? 0.5 : 1))) { fire('laid off'); return null; }

  // Moving up
  const next = career.levels[c.level + 1];
  const served = c.yearsInRole >= level.years;
  const missing = missingFor(next);
  // There are few seats at the very top: it takes an outstanding record, and luck.
  const toTop = next && c.level + 1 === career.levels.length - 1;
  const bar = toTop ? 80 : 62;
  // A promotion needs a seat to be free: big, healthy employers have more of them.
  const odds = clamp(0.2 + (c.performance - bar) / 110 + mentor * 0.03, 0, 0.9) * (toTop ? 0.22 : 1) * vacancyOdds(c);
  if (next && served && c.performance >= bar && !missing.length && rng.chance(odds)) {
    promote();
  } else {
    if (next && served && missing.length && (c.yearsInRole - level.years) % 3 === 0) {
      log(`To move up to ${next.title.toLowerCase()} you need ${missing.join(' and ')}.`);
    } else if (next && served && c.performance >= bar && !missing.length && rng.chance(0.25)) {
      // Someone else got the seat.
      const rival = npcsByRole('coworker').find((n) => !n.flags.report && n.life?.job && n.life.job.level <= c.level);
      if (rival) {
        rival.life.job.level = Math.min(career.levels.length - 1, c.level + 1);
        rival.life.job.title = career.levels[rival.life.job.level].title;
        rival.occupation = rival.life.job.title.toLowerCase();
        log(`The ${next.title.toLowerCase()} post went to ${rival.firstName} ${rival.lastName}. Your turn may come.`, 'system', 'neutral');
      }
    }
    const pct = { excellent: 6, good: 3, adequate: 1, poor: 0 }[rating];
    if (pct && career.type !== 'freelance' && c.salary < payCeiling(level)) {
      c.salary = Math.min(payCeiling(level), Math.round(c.salary * (1 + pct / 100)));
      log(`You were given a ${pct}% raise, to ${fmtMoney(c.salary, cty)}.`);
    }
  }

  // Fame comes with the top of certain careers, and fades without them.
  if (career.fame && c.level >= career.fame.from) {
    p.hidden.fame = clamp(p.hidden.fame + (c.level - career.fame.from + 1) * 4 + c.performance / 25);
  } else {
    p.hidden.fame = clamp(p.hidden.fame - 2);
  }

  // Bodies and careers both have limits.
  const limit = career.retireAge ?? rule('retirementAge');
  if (p.age >= limit) {
    if (career.retireAge) { log('Your body has decided for you: your playing days are over.'); endJob('retired from play'); } else retire();
  }
  return null;
}
