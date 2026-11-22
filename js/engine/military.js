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

const result = (ok, text, tone = ok ? 'good' : 'neutral') => ({ ok, text, tone });
const year = () => store.state.year;
const queue = (id, words = {}) => { if (!store.state.pendingEvents.some((e) => e.id === id)) store.state.pendingEvents.push({ id, cast: { words } }); };

/** The service the player is in, or null. */
export const serving = (p = player()) => (p.career.careerId && p.career.military ? p.career.military : null);
/** National service rules here, or null where there is no peacetime call-up. */
export const callUp = (countryId = player().countryId) => (rule('conscription', countryId) ? NATIONAL_SERVICE[countryId] ?? NATIONAL_SERVICE.default : null);
const owes = (p, ns) => !!ns && (ns.who === 'all' || (p.flags.trueGender ?? p.gender) === 'male');

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
      endJob('completed national service');
      p.flags.nationalService = 'served'; p.flags.veteran = true;
      log('You finished your national service, and went home.', 'system', 'good');
      milestone('Completed national service.', 'career');
    } else if (!m.conscript && m.until && year() >= m.until) queue('mil_contract_end', { branch: m.branch, years: String(year() - (m.start ?? year())) });
  }
  // National service: called up at eighteen, or when a deferral runs out.
  const ns = callUp();
  if (!m && ns && owes(p, ns) && !p.legal.incarceration) {
    const done = p.flags.nationalService;
    const deferred = done && typeof done === 'object' ? done.deferredTo : null;
    if ((!done && p.age >= 18 && p.age <= 20) || (deferred && p.age >= deferred)) {
      queue('mil_national_service', { months: String(ns.months), place: country().name });
    }
  }
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
