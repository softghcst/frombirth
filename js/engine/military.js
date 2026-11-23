// A life in the armed forces, on top of the military careers in data/careers.js ('enlisted' and 'officer', with ranks
// by branch): joining from the Work tab with the branch chosen; basic training; contracts and what happens when one
// ends (sign again for a bonus, leave as a veteran with help for college, or go on to officer training); deployments
// told as scenes, with medals and wounds; and national service, where the law calls people up in peacetime too.
//   c.military = { rank, branch, deployments, honors, medals: [], start, until, conscript?: true }
//   p.flags.nationalService = 'served' | 'civil' | 'refused' | { deferredTo: age }    p.flags.vetEducation = years left
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { CONTRACT, REENLIST_BONUS, VETERAN_EDUCATION_YEARS, POSTINGS, MEDALS, NATIONAL_SERVICE } from '../data/military.js';
import { hire, endJob, unmet, branchesHere, promote } from './career.js';
import { rule } from './rules.js';
import { book } from './ledger.js';
import { held } from './citizenship.js';
import * as sp from './sports.js';
import * as kp from './kpop.js';

const result = (ok, text, tone = ok ? 'good' : 'neutral') => ({ ok, text, tone });
const year = () => store.state.year;
const queue = (id, words = {}) => { if (!store.state.pendingEvents.some((e) => e.id === id)) store.state.pendingEvents.push({ id, cast: { words } }); };

/** The service the player is in, or null. */
export const serving = (p = player()) => (p.career.careerId && p.career.military ? p.career.military : p.flags.nsService ?? null);
/** National service rules here, or null where there is no peacetime call-up. */
export const callUp = (countryId = player().countryId) => (rule('conscription', countryId) ? NATIONAL_SERVICE[countryId] ?? NATIONAL_SERVICE.default : null);
const owes = (p, ns) => !!ns && (ns.who === 'all' || (p.flags.trueGender ?? p.gender) === 'male');
/** The country the player owes national service to, as a citizen: where they live first, else another nationality. */
export function serviceCountry(p = player()) {
  const mine = held(p);
  const where = [p.countryId, ...mine.filter((c) => c !== p.countryId)].filter((c) => mine.includes(c));
  return where.find((c) => owes(p, callUp(c))) ?? null;
}

// ---------- Who the call-up comes to, and how ----------

const IDOL_BY = 28;           // an idol's enlistment, put off as long as the law allows
const CULTURE_MEDAL_BY = 30;  // later still, for an artist honored by the state for culture
const ATHLETE_FROM = 25;      // when a professional athlete is asked to decide
const ATHLETE_BY = 28;
const TEAM_NAME = 'the Armed Forces Athletic Corps';

/** A medal at the World Games, in any sport: exempts an athlete from ordinary service. */
const medalled = (p = player()) => Object.values(sp.myAthlete()?.sports ?? {}).flatMap((e) => e.medals ?? []).find((x) => /World Games/.test(x.games ?? '')) ?? null;
/** An idol (in a group, or training to be one) whose career would stop for service. */
const isIdol = (p = player()) => !!(store.state.kpop && p.idol && (kp.myGroup(p) || kp.trainee(p)));
/** Professional athletes, the main sport first. Baseball in Korea has its own way (engine/asiaBaseball.js). */
const proSport = () => sp.activeSports().find((e) => e.level === 'pro') ?? null;
const ownBaseball = (p, c) => c === 'kr' && sp.activeSports().some((e) => e.id === 'baseball' && e.asia);

function nationalServiceYear(p) {
  const c = serviceCountry(p);
  if (!c) return;
  const ns = callUp(c);
  const done = p.flags.nationalService;
  if (done && typeof done !== 'object') return; // served, exempt, civil or refused
  const deferred = done?.deferredTo ?? null;
  // A medal at the World Games: an athlete serves a few weeks, and the rest in their sport.
  const medal = medalled(p);
  if (medal) {
    p.flags.nationalService = 'exempt';
    log(`Your ${medal.medal} medal at the ${medal.games} exempts you from national service: a few weeks of basic training, and the rest as community service in your sport.`, 'system', 'good');
    milestone('Exempted from national service for a medal.', 'career');
    return;
  }
  if (ownBaseball(p, c)) return;
  if (isIdol(p)) {
    // Every idol puts it off as long as the law allows; when it can wait no longer, the choice of how to go.
    if (p.age >= (deferred ?? IDOL_BY)) queue('mil_ns_idol', { age: String(p.age), group: kp.myGroup(p)?.name ?? 'your agency' });
    return;
  }
  const pro = proSport();
  if (pro) {
    if (p.age >= (deferred ?? ATHLETE_FROM)) queue('mil_ns_athlete', { sport: (pro.id ?? '').replace(/_/g, ' '), by: String(ATHLETE_BY) });
    return;
  }
  // Everyone else, living in the country: called up at eighteen, or when a deferral runs out.
  if (c !== p.countryId) return;
  if ((!done && p.age >= 18 && p.age <= 20) || (deferred && p.age >= deferred)) queue('mil_national_service', { months: String(ns.months), place: country().name });
}

/** Starts a stint of national service: a conscript in the forces, for as long as the law says (rounded up to years). */
function conscript(branch, ns, o = {}) {
  // An athlete keeps their job and their club's contract while serving: the service is its own record, not a new job.
  if (o.athlete) {
    const p = player();
    p.flags.nsService = { branch, conscript: true, start: year(), until: year() + Math.max(1, Math.ceil(ns.months / 12)), medals: [], deployments: 0, ...o };
    return p.flags.nsService;
  }
  hire(CAREER_BY_ID.enlisted, 0, 50, `You report for national service with the ${branch}.`, { branch });
  const n = serving(); if (!n) return null;
  n.conscript = true; n.start = year(); n.until = year() + Math.max(1, Math.ceil(ns.months / 12)); n.medals = [];
  Object.assign(n, o);
  return n;
}

/** The ways in, with why one is closed: enlist (from 18) and officer (with a degree). */
export function joinOptions() {
  const p = player();
  return ['enlisted', 'officer'].map((id) => {
    const car = CAREER_BY_ID[id];
    const why = serving(p) ? 'You are serving already' : unmet(car)[0] ?? '';
    return { id, name: id === 'enlisted' ? 'Enlist' : 'Officer training', why };
  });
}
export const branches = () => branchesHere();

/** Joins: the branch chosen, a contract, and basic training to get through first. */
export function join(path, branch) {
  const p = player();
  const opt = joinOptions().find((o) => o.id === path);
  if (!opt) return result(false, 'That is not a way in.');
  if (opt.why) return result(false, `${opt.why}.`);
  if (!branches().includes(branch)) return result(false, 'Choose a branch.');
  const car = CAREER_BY_ID[path];
  hire(car, 0, 50, path === 'officer' ? `You start officer training in the ${branch}.` : `You sign up with the ${branch}.`, { branch });
  const m = p.career.military;
  if (!m) return result(false, 'It did not go through.');
  m.start = year(); m.until = year() + CONTRACT[path]; m.medals = [];
  queue('mil_basic_training', { branch, kind: path === 'officer' ? 'officer training' : 'basic training' });
  return result(true, `You signed a ${CONTRACT[path]}-year contract with the ${branch}. ${path === 'officer' ? 'Officer training' : 'Basic training'} starts at once.`);
}

/** Once a year: a deployment now and then, the end of a contract, national service starting or ending. */
export function tickMilitary() {
  const p = player();
  const m = serving(p);
  if (m) {
    m.medals ??= [];
    if (m.conscript && year() >= m.until) {
      const idol = m.idol; const athlete = m.athlete;
      if (p.flags.nsService === m) p.flags.nsService = null; else endJob('completed national service');
      p.flags.nationalService = 'served'; p.flags.veteran = true;
      if (idol) {
        // The comeback: the group, the fans who waited, and a first stage again.
        const i = kp.idolOf(p);
        if (i.hiatus?.kind === 'service') kp.endHiatus();
        i.served = true;
        i.pop = clamp((i.pop ?? 0) + (m.farewell ? 6 : 4));
        log(`You are discharged. ${kp.myGroup(p) ? `${kp.myGroup(p).name} is waiting, and so are the fans: the comeback is the talk of the year.` : 'The fans have waited.'}`, 'system', 'good');
        milestone('Discharged from military service: back on stage.', 'fame');
      } else if (athlete) {
        const e = sp.activeSports().find((x) => x.id === athlete);
        if (e && m.kind === 'regular' && m.hours != null) e.plan.hours = m.hours;
        log(`Your service is over${m.kind === 'team' ? `, and with it your time with ${TEAM_NAME}` : ''}. Back to your club.`, 'system', 'good');
        milestone('Completed military service.', 'career');
      } else {
        log('You finished your national service, and went home.', 'system', 'good');
        milestone('Completed national service.', 'career');
      }
    } else if (!m.conscript && m.until && year() >= m.until) queue('mil_contract_end', { branch: m.branch, years: String(year() - (m.start ?? year())) });
  }
  // National service, if the player owes it somewhere (by citizenship): an idol, an athlete and everyone else differ.
  if (!m && !p.legal.incarceration) nationalServiceYear(p);
}

/** A deployment (engine/career.js decides when): told as a scene with choices. */
export function deploy() {
  const m = serving();
  if (!m) return;
  m.deployments += 1;
  queue('mil_deployment', { place: rng.pick(POSTINGS), branch: m.branch });
}

function medal(why) {
  const p = player(); const m = serving(p);
  const name = rng.pick(MEDALS);
  m.medals.push({ name, year: year(), why });
  m.honors = (m.honors ?? 0) + 1;
  p.career.performance = clamp(p.career.performance + 12);
  milestone(`Awarded ${name}.`, 'career');
  return name;
}

/** A choice in one of the military scenes (data/events/stories/military.js). @returns {string} what came of it */
export function militaryChoice(value) {
  const p = player();
  const [scene, choice] = value.split(':');
  const m = serving(p);
  const c = p.career;
  switch (scene) {
    case 'basic': {
      if (!m) return '';
      if (choice === 'quit') { endJob('left basic training'); p.stats.mood = clamp(p.stats.mood - 6); return 'You hand back your kit. It is over before it began.'; }
      // How it goes depends on how fit and how steady the recruit is, and what they choose.
      const steady = (p.stats.health - 50) / 100 + (p.hidden.discipline - 50) / 120;
      if (choice === 'push') {
        if (rng.chance(clamp(0.2 - steady * 0.3, 0.03, 0.35))) { p.stats.health = clamp(p.stats.health - rng.int(4, 10)); c.performance = clamp(c.performance + 2); return 'You pushed too hard and hurt yourself, and finished anyway, limping.'; }
        c.performance = clamp(c.performance + 12); p.hidden.discipline = clamp(p.hidden.discipline + 3);
        return 'You finish near the top of your class. People notice.';
      }
      if (choice === 'help') { c.performance = clamp(c.performance + 6); p.hidden.karma = clamp(p.hidden.karma + 4); return 'You carry someone else through the worst weeks. They will not forget it, and nor will your instructors.'; }
      if (rng.chance(clamp(0.08 - steady * 0.2, 0.01, 0.25))) { endJob('washed out of basic training'); p.stats.mood = clamp(p.stats.mood - 10); return 'Keeping your head down was not enough: you wash out in the sixth week.'; }
      c.performance = clamp(c.performance + 3);
      return 'You get through it, without standing out. That is allowed.';
    }
    case 'deploy': {
      if (!m) return '';
      if (choice === 'volunteer') {
        const roll = rng.next();
        if (roll < 0.2) { p.stats.health = clamp(p.stats.health - rng.int(8, 20)); p.stats.mood = clamp(p.stats.mood - 6); m.wounds = (m.wounds ?? 0) + 1; return 'You volunteer for the dangerous job, and are wounded doing it. You will heal; it will stay with you.'; }
        if (roll < 0.6) return `You volunteer for the dangerous job, and do it well. You are awarded ${medal('volunteered on deployment')}.`;
        c.performance = clamp(c.performance + 6); return 'You volunteer for the dangerous job. It goes to plan, and everyone comes back.';
      }
      if (choice === 'unit') { c.performance = clamp(c.performance + 5); p.hidden.karma = clamp(p.hidden.karma + 3); if (rng.chance(0.15)) return `You keep your people together through a bad week. You are awarded ${medal('looked after the unit')}.`; return 'You keep your people together. Everyone comes home.'; }
      c.performance = clamp(c.performance + 2);
      return 'You do your job and keep your head down. The months pass.';
    }
    case 'contract': {
      if (!m) return '';
      if (choice === 'reenlist') {
        const bonus = localMoney(REENLIST_BONUS, country());
        p.finance.cash += bonus; book({ cat: 'otherIncome', src: 'year', desc: 'Re-enlistment bonus' });
        m.until = year() + CONTRACT[c.careerId] ; m.start = year();
        if (c.performance >= 60 && rng.chance(0.6)) promote();
        return `You sign again for ${CONTRACT[c.careerId]} years, with a ${fmtMoney(bonus, country())} bonus.`;
      }
      if (choice === 'officer') {
        const why = unmet(CAREER_BY_ID.officer)[0];
        if (why || c.careerId === 'officer') return why ? `Not yet: ${why.charAt(0).toLowerCase()}${why.slice(1)}` : '';
        const branch = m.branch;
        endJob('went to officer training');
        hire(CAREER_BY_ID.officer, 0, 55, `You start officer training in the ${branch}.`, { branch });
        const n = serving(); n.start = year(); n.until = year() + CONTRACT.officer; n.medals = [];
        return `You go on to officer training in the ${branch}.`;
      }
      // Leave, honorably, as a veteran: help with college comes with it.
      const full = year() - (m.start ?? year()) >= CONTRACT[c.careerId];
      endJob('honorable discharge');
      p.flags.veteran = true;
      if (full) p.flags.vetEducation = Math.max(p.flags.vetEducation ?? 0, VETERAN_EDUCATION_YEARS);
      milestone('Left the armed forces with an honorable discharge.', 'career');
      return `You leave the service with an honorable discharge.${full ? ` As a veteran, up to ${VETERAN_EDUCATION_YEARS} years of college tuition are paid for you.` : ''}`;
    }
    case 'nsi': return idolChoice(choice);
    case 'nsa': return athleteChoice(choice);
    case 'ns': {
      const ns = callUp();
      if (!ns) return '';
      if (choice === 'serve') {
        const branch = branchesHere()[0];
        hire(CAREER_BY_ID.enlisted, 0, 50, `You report for national service with the ${branch}.`, { branch });
        const n = serving(); if (!n) return '';
        n.conscript = true; n.start = year(); n.until = year() + Math.max(1, Math.round(ns.months / 12)); n.medals = [];
        queue('mil_basic_training', { branch, kind: 'basic training' });
        return `You report for duty: ${ns.months} months with the ${branch}.`;
      }
      if (choice === 'defer') {
        if (!ns.defer || !p.education.enrolled || p.age >= ns.defer) return 'A deferral is refused: you report for duty this year.' + militaryChoice('ns:serve').replace(/^You report/, ' You report');
        p.flags.nationalService = { deferredTo: ns.defer };
        return `Your service is deferred while you study, until you are ${ns.defer}.`;
      }
      if (choice === 'civil') {
        if (!ns.civil) return 'There is no civilian service here.' ;
        p.flags.nationalService = 'civil';
        p.hidden.karma = clamp(p.hidden.karma + 4); p.stats.mood = clamp(p.stats.mood - 2);
        return `You do civilian service instead: ${ns.months + 3} months in a hospital and a care home. It is hard, useful work.`;
      }
      p.flags.nationalService = 'refused';
      p.legal.heat = clamp((p.legal.heat ?? 0) + 30);
      p.stats.mood = clamp(p.stats.mood - 4);
      return 'You refuse to serve. It goes on your record, and the police know your name now.';
    }
    default: return '';
  }
}

/** An idol's enlistment: how to go, or whether to try to put it off once more. */
function idolChoice(choice) {
  const p = player();
  const c = serviceCountry(p);
  const ns = c && callUp(c);
  if (!ns) return '';
  const i = kp.idolOf(p);
  const g = kp.myGroup(p);
  const go = (how, extra = {}) => {
    // A singer may be taken into a military band; most serve like anyone else.
    const band = Math.max(p.talents.singing ?? 0, p.talents.music ?? 0) >= 70 && rng.chance(0.4);
    const branch = how === 'public' ? 'Public service (civilian post)' : band ? `${branchesHere()[0]} (military band)` : branchesHere()[0];
    const m = conscript(branch, ns, { idol: true, ...extra });
    if (!m) return '';
    i.hiatus = { kind: 'service', since: year(), public: 'for military service' };
    if (g) g.history.push({ year: year(), text: `${p.firstName} ${p.lastName} enlisted for military service.` });
    return band ? ' You are taken into the military band.' : '';
  };
  if (choice === 'quiet') { i.pop = clamp((i.pop ?? 0) - 1); const b = go('quiet'); return `You enlist quietly, with a handwritten letter to the fans. They respect it.${b}`; }
  if (choice === 'farewell') { i.pop = clamp((i.pop ?? 0) + 2); const b = go('farewell', { farewell: true }); return `A last fan meeting, a short haircut on camera, and a crowd outside the training camp gate.${b}`; }
  if (choice === 'public') {
    if (p.stats.health >= 55) return 'The medical board finds you fit for active duty. ' + idolChoice('quiet');
    go('public');
    return 'The medical board assigns you to public service: a civilian post, office hours, and no stage.';
  }
  if (choice === 'medal') {
    if (i.medalAsked) return 'You have asked once already. ' + idolChoice('quiet');
    i.medalAsked = year();
    if ((i.pop ?? 0) >= 80 && p.age < CULTURE_MEDAL_BY) {
      p.flags.nationalService = { deferredTo: CULTURE_MEDAL_BY };
      milestone('Honored with a state medal for culture.', 'fame');
      return `For what your music has done for the country's name abroad, you are given a state medal for culture, and with it the right to put off service until you are ${CULTURE_MEDAL_BY}.`;
    }
    i.pop = clamp((i.pop ?? 0) - 3);
    return 'The request is turned down, and reported. Some fans are not pleased that you asked. ' + idolChoice('quiet');
  }
  // Refusing: against the law, and a scandal.
  p.flags.nationalService = 'refused';
  p.legal.heat = clamp((p.legal.heat ?? 0) + 35);
  i.pop = clamp((i.pop ?? 0) - 25);
  if (g) g.history.push({ year: year(), text: `${p.firstName} ${p.lastName} refused military service.` });
  return 'You refuse to enlist. It is in every paper by the morning; the agency issues an apology, and the fans are divided.';
}

/** An athlete's service: the forces' athletic team (keep competing), ordinary service (the sport waits), or later. */
function athleteChoice(choice) {
  const p = player();
  const c = serviceCountry(p);
  const ns = c && callUp(c);
  const e = proSport();
  if (!ns || !e) return '';
  if (choice === 'later') {
    if (p.age < ATHLETE_BY - 1) { p.flags.nationalService = { deferredTo: p.age + 1 }; return `Not yet. It has to be done before you turn ${ATHLETE_BY}.`; }
    return `It cannot wait any longer: you must go before ${ATHLETE_BY}. ` + athleteChoice('regular');
  }
  if (choice === 'team') {
    const good = sp.internals.overall ? sp.internals.overall(e, p) >= 62 : true;
    if (!good) return `${TEAM_NAME.charAt(0).toUpperCase()}${TEAM_NAME.slice(1)} takes only the best, and not you this year. ` + athleteChoice('regular');
    conscript(`${branchesHere()[0]} (${TEAM_NAME})`, ns, { athlete: e.id, kind: 'team' });
    return `${TEAM_NAME.charAt(0).toUpperCase()}${TEAM_NAME.slice(1)} takes you: soldiering, and your sport, in the military league. Your club holds your contract until you are back.`;
  }
  const hours = e.plan?.hours ?? null;
  conscript(branchesHere()[0], ns, { athlete: e.id, kind: 'regular', hours });
  if (e.plan) e.plan.hours = Math.min(e.plan.hours ?? 2, 2);
  return 'You enlist like anyone else. For a year and a half, your sport waits: a couple of hours a week, when you can.';
}

