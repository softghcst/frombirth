// Two careers, one household. The player and their spouse each have a working
// life (the spouse's is engine/npcLives.js's, with an employer). A household
// plan, agreed between them, says whose career comes first and who looks
// after the children; it costs one or both of them time, money or ground at
// work, and the spouse remembers whether the plan was fair.
//
//   p.household = { lead: 'balanced'|'mine'|'theirs', childcare: 'shared'|'me'|'them'|'paid', since, askedAge, history:[{age,text}] }
//   spouse.flags.partTimeForKids   they cut their hours to look after the children (pay follows)
//   spouse.flags.retraining        { until: age, careerId }  back at college, then a new field
//   spouse.flags.lostJobAge        when they last lost a job (for the scene that follows)
import { rng } from '../rng.js';
import { clamp, fmtMoney, localCost } from '../util.js';
import { store, player, country, npcsByRole, log } from '../state.js';
import { CAREER_BY_ID, CAREERS } from '../data/careers.js';
import { ensureLife } from './npcLives.js';
import { remember } from './conditions.js';
import { housingK } from './cities.js';
import { placeAt } from './employers.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

export const LEADS = {
  balanced: { label: 'Both careers count the same', sub: 'Neither of you moves for the other without agreeing it; neither job always wins.' },
  mine: { label: 'Your career comes first', sub: 'When the two collide, yours wins. It helps you; it costs them, and they will feel it.' },
  theirs: { label: 'Their career comes first', sub: 'You give way when the two collide. It helps them, and costs you some ground.' },
};
export const CARE = {
  shared: { label: 'Share it equally', sub: 'Each of you gives about half the hours.' },
  me: { label: 'You do most of it', sub: 'Your week fills up; their career moves faster.' },
  them: { label: 'They do most of it', sub: 'Their week fills up, and they cut their hours; yours is freer.' },
  paid: { label: 'Pay for childcare', sub: 'A nursery or a nanny. It costs money every year, and gives you both your time.' },
};

/** The player's spouse, if they live together. */
export const spouse = () => npcsByRole('spouse').find((n) => !n.flags.abroad && !n.flags.stayedBehind) ?? null;
/** The household plan, filled in if missing. */
export function plan(p = player()) {
  p.household ??= { lead: 'balanced', childcare: 'shared', since: p.age, askedAge: null, history: [] };
  return p.household;
}

/** Children at home who need looking after, with how much. */
export function youngKids(p = player()) {
  return p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role === 'child' && n.age < 12 && !n.flags.abroad);
}
const careNeed = (kids) => Math.min(32, kids.reduce((s, k) => s + (k.age < 5 ? 12 : 7), 0));

/** Hours a week the player gives to childcare under the plan. */
export function careHours(p = player()) {
  const kids = youngKids(p);
  if (!kids.length) return 0;
  const need = careNeed(kids);
  const care = plan(p).childcare;
  if (!spouse()) return Math.round(need * (care === 'paid' ? 0.3 : 1)); // on your own, it is all yours, unless paid for
  return Math.round(need * { shared: 0.5, me: 0.9, them: 0.15, paid: 0.25 }[care]);
}

/** What paid childcare costs a year, in local money. */
export function careCost(p = player()) {
  if (plan(p).childcare !== 'paid') return 0;
  return youngKids(p).reduce((s, k) => s + localCost(k.age < 5 ? 9000 : 4000, country()), 0) * (0.7 + 0.3 * housingK());
}

/** How the plan tilts the player's chances of promotion. */
export const leadFactor = (p = player()) => (spouse() ? { balanced: 1, mine: 1.15, theirs: 0.85 }[plan(p).lead] : 1);

/** How the plan tilts the spouse's chances of promotion (used by npcLives.tickJob). */
export function spouseFactor(npc) {
  const p = store.state?.player;
  if (!p || npc.role !== 'spouse' || npc.flags.abroad) return 1;
  const h = plan(p);
  const kids = youngKids(p).length > 0;
  const lead = { balanced: 1, mine: 0.75, theirs: 1.35 }[h.lead];
  const care = kids ? { shared: 0.95, me: 1.15, them: 0.6, paid: 1.05 }[h.childcare] : 1;
  return lead * care * (npc.flags.partTimeForKids ? 0.7 : 1);
}

/** What the spouse's working week looks like. */
export function spouseWork(n = spouse()) {
  if (!n) return null;
  ensureLife(n);
  const job = n.life?.job;
  const car = CAREER_BY_ID[job?.careerId];
  const hours = car ? Math.round(car.hours * (n.flags.partTimeForKids ? 0.6 : 1)) : 0;
  const care = youngKids().length ? Math.round(careNeed(youngKids()) * { shared: 0.5, me: 0.1, them: 0.85, paid: 0.25 }[plan().childcare]) : 0;
  return { npc: n, job, career: car, hours, care, retraining: n.flags.retraining ?? null };
}

/**
 * Asks the spouse to agree a plan. Giving way is always accepted; asking them to give way depends on how
 * things stand between you and on what they would be giving up.
 */
export function proposePlan(next) {
  const p = player();
  const n = spouse();
  const h = plan(p);
  if (!n) return result(false, 'This is something to agree with a spouse.', 'neutral');
  if (h.askedAge === p.age) return result(false, 'You have already had this conversation this year.', 'neutral');
  const lead = next.lead ?? h.lead;
  const childcare = next.childcare ?? h.childcare;
  if (lead === h.lead && childcare === h.childcare) return result(false, 'That is the plan you already have.', 'neutral');
  h.askedAge = p.age;
  ensureLife(n);
  const theirs = n.life?.job;
  const ambitious = (theirs?.level ?? 0) >= 1 || ['career_top', 'wealth'].includes(n.life?.aspiration?.id);
  // How much more the new plan asks of them than the old one did.
  const cost = { mine: 1, balanced: 0, theirs: -1 }[lead] - { mine: 1, balanced: 0, theirs: -1 }[h.lead]
    + ({ them: 1, shared: 0, paid: 0, me: -1 }[childcare] - { them: 1, shared: 0, paid: 0, me: -1 }[h.childcare]);
  const money = childcare === 'paid' && h.childcare !== 'paid' && p.finance.cash < careCost({ ...p, household: { ...h, childcare } }) ? 0.15 : 0;
  if (cost > 0) {
    const odds = clamp(0.35 + (n.meters.relationship - 55) / 70 - (ambitious ? 0.15 : 0) + (theirs ? 0 : 0.2) - money, 0.05, 0.9);
    if (!rng.chance(odds)) {
      n.meters.relationship = clamp(n.meters.relationship - 4);
      return result(false, `${n.firstName} hears you out, and says no. ${ambitious ? '"My work matters too."' : '"Not like that."'}`);
    }
    n.meters.relationship = clamp(n.meters.relationship - 2 * cost);
  } else if (cost < 0) {
    n.meters.relationship = clamp(n.meters.relationship + 4);
    remember(n, 'gaveWay', 'You put their career before your own when it mattered.');
  }
  const was = { ...h };
  Object.assign(h, { lead, childcare, since: p.age });
  // Doing most of the childcare means fewer hours at work for them; giving it up means going back.
  if (childcare === 'them' && theirs && !n.flags.partTimeForKids) { n.flags.partTimeForKids = true; theirs.salary = Math.round(theirs.salary * 0.6); }
  if (childcare !== 'them' && n.flags.partTimeForKids && theirs) { delete n.flags.partTimeForKids; theirs.salary = Math.round(theirs.salary / 0.6); }
  const text = `You and ${n.firstName} agree: ${LEADS[lead].label.toLowerCase()}, and for the children, ${CARE[childcare].label.toLowerCase()}.${childcare === 'them' && was.childcare !== 'them' && theirs ? ` ${n.firstName} goes part-time.` : ''}${childcare === 'paid' ? ` It will cost about ${fmtMoney(careCost(), country())} a year.` : ''}`;
  h.history.push({ age: p.age, text });
  if (h.history.length > 12) h.history.shift();
  log(text);
  return result(true, text);
}

/**
 * The player is moving city for their own job. The spouse's job may move
 * with them (if it can be done from anywhere, or the employer has somewhere to
 * put them); otherwise they give it up. @returns {string} what happened, or ''
 */
export function spouseFollows(city) {
  const n = spouse();
  if (!n) return '';
  ensureLife(n);
  const job = n.life?.job;
  const h = plan();
  if (!job) return `${n.firstName} comes with you.`;
  const car = CAREER_BY_ID[job.careerId];
  const keeps = car?.remote === 'remote' || rng.chance(0.25);
  if (keeps) {
    if (car?.remote !== 'remote') { const e = placeAt(job.careerId, player().countryId, city); job.employerId = e.id; if (!e.staff.includes(n.id)) e.staff.push(n.id); }
    n.meters.relationship = clamp(n.meters.relationship - (h.lead === 'mine' ? 0 : 2));
    return car?.remote === 'remote' ? `${n.firstName} keeps their job: it can be done from anywhere.` : `${n.firstName}'s employer finds them a place in ${city}.`;
  }
  n.life.lastJob = { careerId: job.careerId, level: Math.max(0, job.level - 1) };
  n.life.job = null;
  n.occupation = 'between jobs';
  n.flags.lostJobAge = player().age;
  n.flags.gaveUpJobFor = true;
  n.meters.relationship = clamp(n.meters.relationship - (h.lead === 'mine' ? 3 : h.lead === 'theirs' ? 14 : 8));
  remember(n, 'gaveUpJob', 'They gave up their job so you could take yours in another city.');
  return `${n.firstName} gives up their job as ${(job.title ?? 'what they did').toLowerCase()} to come with you${h.lead === 'theirs' ? ', though you had agreed their career would come first' : ''}.`;
}

/**
 * Once a year: the plan's effects on the spouse, and the scene the year calls for.
 * @returns {string[]} journal lines
 */
export function tickCouple() {
  const p = player();
  const n = spouse();
  const lines = [];
  if (!n) return lines;
  ensureLife(n);
  const h = plan(p);
  const L = n.life;
  // Back at college: after it, a fresh start in the new field.
  if (n.flags.retraining && p.age >= n.flags.retraining.until) {
    const car = CAREER_BY_ID[n.flags.retraining.careerId];
    if (car && L) {
      const e = placeAt(car.id, p.countryId, p.city);
      L.job = { careerId: car.id, level: 0, title: car.levels[0].title, salary: Math.round((e.payK ?? 1) * 1000 * car.levels[0].pay[0] * country().currency.scale * (country().living?.wageK ?? 1)), years: 0, employerId: e.id };
      if (!e.staff.includes(n.id)) e.staff.push(n.id);
      n.occupation = car.levels[0].title.toLowerCase();
      lines.push(`${n.firstName} has finished retraining, and starts as ${/^[aeiou]/i.test(n.occupation) ? 'an' : 'a'} ${n.occupation}.`);
    }
    delete n.flags.retraining;
  }
  // Children grow up: a parent who went part-time for them can go back.
  if (n.flags.partTimeForKids && !youngKids(p).length && L?.job) {
    delete n.flags.partTimeForKids;
    L.job.salary = Math.round(L.job.salary / 0.6);
    if (h.childcare === 'them') h.childcare = 'shared';
    lines.push(`The children are older now. ${n.firstName} goes back to full-time work.`);
  }
  // Whether the plan feels fair, year after year.
  const ambitious = (L?.job?.level ?? 0) >= 1 || ['career_top', 'wealth'].includes(L?.aspiration?.id);
  const tilt = (h.lead === 'mine' ? (ambitious ? -2 : -1) : h.lead === 'theirs' ? 1 : 0) + (youngKids(p).length ? { them: -1, me: 1, shared: 0, paid: 0 }[h.childcare] : 0);
  n.meters.relationship = clamp(n.meters.relationship + tilt);
  // Losing a job is noticed at home.
  if (!L?.job && !L?.retired && n.age < 66 && n.flags.lostJobAge == null && L?.lastJob) n.flags.lostJobAge = p.age;
  queueCoupleScene(n);
  return lines;
}

function queueCoupleScene(n) {
  const p = player();
  const st = store.state;
  if (p.flags.familySceneAge === p.age || st.pendingEvents.length >= 2) return;
  const recent = (id, yrs) => st.eventHistory.some((x) => x.id === id && p.age - x.lastAge < yrs);
  const push = (id) => { st.pendingEvents.push({ id, cast: { love: n.id } }); p.flags.familySceneAge = p.age; };
  const load = (() => { try { return p.career.careerId ? (p.career.hours + (p.career.extra ?? 0)) : 0; } catch { return 0; } })();
  const sw = spouseWork(n);
  if (n.flags.lostJobAge != null && p.age - n.flags.lostJobAge <= 1 && !n.life?.job && !n.flags.retraining && !recent('hh_spouse_out_of_work', 4)) { push('hh_spouse_out_of_work'); delete n.flags.lostJobAge; return; }
  if (youngKids(p).length && sw?.job && load >= 45 && sw.hours >= 38 && !recent('hh_both_stretched', 6) && rng.chance(0.4)) { push('hh_both_stretched'); return; }
  if (sw?.job && n.age >= 30 && n.age <= 52 && !n.flags.retraining && !recent('hh_spouse_retrain', 12) && rng.chance(0.06)) { push('hh_spouse_retrain'); return; }
  if (sw?.job && (sw.job.level ?? 0) >= 1 && youngKids(p).length && !recent('hh_spouse_big_job', 8) && rng.chance(0.08)) push('hh_spouse_big_job');
}

/** Choices from the household scenes (data/events/career.js, `couple:` work effects). @returns {string} */
export function coupleChoice(what, cast = {}) {
  const p = player();
  const n = store.state.npcs[cast.love] ?? spouse();
  if (!n) return '';
  ensureLife(n);
  const L = n.life;
  const h = plan(p);
  switch (what) {
    case 'retrain': {
      // Back to college for two years: no income meanwhile, then a new field, chosen from what suits them.
      const options = CAREERS.filter((c) => c.req?.degree === 'university' && !c.req?.program && !c.branchOnly && !c.agencyHire && c.type === 'fulltime' && c.family !== CAREER_BY_ID[L?.job?.careerId ?? L?.lastJob?.careerId]?.family);
      const to = rng.pick(options) ?? CAREERS[0];
      if (L?.job) { L.lastJob = { careerId: L.job.careerId, level: L.job.level }; L.job = null; }
      n.flags.retraining = { until: p.age + 2, careerId: to.id };
      n.occupation = 'student';
      return `${n.firstName} will retrain in ${to.name.toLowerCase()}, and be back at work in two years.`;
    }
    case 'anyJob': {
      if (L && !L.job && L.lastJob) {
        const car = CAREER_BY_ID[L.lastJob.careerId];
        const e = placeAt(car.id, p.countryId, p.city);
        L.job = { careerId: car.id, level: Math.max(0, L.lastJob.level - 1), title: car.levels[Math.max(0, L.lastJob.level - 1)].title, salary: 0, years: 0, employerId: e.id };
        L.job.salary = Math.round(car.levels[L.job.level].pay[0] * 1000 * country().currency.scale * (country().living?.wageK ?? 1));
        n.occupation = L.job.title.toLowerCase();
        if (!e.staff.includes(n.id)) e.staff.push(n.id);
        return `${n.firstName} starts at ${e.name} within the month, a step lower than before.`;
      }
      return '';
    }
    case 'theyLead': h.lead = 'theirs'; h.history.push({ age: p.age, text: 'Agreed that their career comes first.' }); return '';
    case 'iLead': h.lead = 'mine'; h.history.push({ age: p.age, text: 'Agreed that your career comes first.' }); return '';
    case 'iCare': h.childcare = 'me'; if (n.flags.partTimeForKids && L?.job) { delete n.flags.partTimeForKids; L.job.salary = Math.round(L.job.salary / 0.6); } return '';
    case 'theyCare': h.childcare = 'them'; if (!n.flags.partTimeForKids && L?.job) { n.flags.partTimeForKids = true; L.job.salary = Math.round(L.job.salary * 0.6); } return `${n.firstName} goes part-time.`;
    case 'paid': h.childcare = 'paid'; return `Childcare will cost about ${fmtMoney(careCost(), country())} a year.`;
    case 'promote': {
      if (L?.job) {
        const car = CAREER_BY_ID[L.job.careerId];
        const next = Math.min(car.levels.length - 1, L.job.level + 1);
        if (next > L.job.level) { L.job.level = next; L.job.title = car.levels[next].title; L.job.salary = Math.round(L.job.salary * 1.25); n.occupation = L.job.title.toLowerCase(); return `${n.firstName} is now ${/^[aeiou]/i.test(n.occupation) ? 'an' : 'a'} ${n.occupation}.`; }
      }
      return '';
    }
    default: return '';
  }
}

/** Both careers, side by side, for the hub. */
export function householdView() {
  const p = player();
  const n = spouse();
  const sw = spouseWork(n);
  const mine = p.career.salary || 0;
  const theirs = n?.life?.job?.salary ?? 0;
  return { spouse: n, theirs: sw, plan: plan(p), kids: youngKids(p), careHours: careHours(p), careCost: careCost(p), income: { mine, theirs, total: mine + theirs } };
}

