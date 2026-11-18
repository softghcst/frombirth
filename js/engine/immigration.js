// Ways of moving to another country, and what happens to the permission
// afterwards. A move is no longer one application with one answer: there
// are routes, each with its own conditions, cost, odds and the status it
// gives on arrival.
//
//   route      who it is for                         status on arrival
//   right      citizens (and their territories)      citizen
//   free       citizens of a free-movement area      permanent resident
//   family     a spouse who is a citizen there, or   permanent resident
//              close family living there
//   work       a qualification and an employer       worker, 4 years, renewable
//   study      a school-leaving qualification and    student, 4 years, no full-time work
//              the funds for a first year
//   invest     a large sum to bring                  permanent resident
//   settle     a points-style programme              permanent resident
//   protection people leaving a country in crisis    temporary resident, 3 years
//
// Temporary statuses run out (tickStatus): they are renewed while their
// reason holds, become permanent after five years, and end otherwise.
// Everything here is gameplay configuration: no route promises anything
// about a real visa.
import { hasRecord } from './records.js';
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, theCountry } from '../util.js';
import { store, player, country, livingNpcs, log } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { FREE_MOVEMENT, WANTED, ROUTE } from '../data/immigration.js';
import { held, issuer, rightToLive, residency } from './citizenship.js';
import { visaEdge } from './languages.js';
import { ownerRoute } from './businessAbroad.js';
import { eraOf } from './documents.js';

const has = (p, t) => p.education.degrees.some((d) => d.type === t);
const convicted = (p) => hasRecord(p, { sealed: true });
/** The free-movement area a place belongs to, if any. */
const areaOf = (id) => FREE_MOVEMENT.find((a) => a.members.includes(id)) ?? null;

/**
 * Every route to a destination, with whether it is open to the player and why not.
 * @returns {{id, name, blurb, eligible:boolean, why:string, fee:number, chance:number, outlook:string, status:string, years:?number}[]}
 */
export function routes(destId, p = player()) {
  const here = country();
  const base = localMoney(ROUTE.fee, here);
  const mine = held(p);
  const lang = visaEdge(destId, p) + ((p.flags.visited ?? []).includes(destId) ? 0.05 : 0) + ((p.flags.studiedIn ?? []).includes(destId) ? 0.1 : 0)
    + ((p.trips ?? []).some((t) => t.countryId === destId && t.purpose === 'scouting') ? 0.08 : 0); // the language, having been there, having studied there, having gone to look
  const crime = convicted(p) ? -0.4 : 0;
  const out = [];
  const add = (id, name, blurb, o) => {
    const chance = o.eligible ? clamp(o.chance, 0.05, 1) : 0;
    out.push({ id, name, blurb, eligible: !!o.eligible, why: o.eligible ? '' : o.why, fee: Math.round(base * (o.fee ?? 1)), chance, status: o.status, years: o.years ?? null,
      outlook: !o.eligible ? '' : chance >= 0.99 ? 'No application to make.' : chance >= 0.7 ? 'Your application looks strong.' : chance >= 0.4 ? 'It could go either way.' : 'This is a long shot.' });
  };

  if (rightToLive(destId, p)) {
    add('right', 'As a citizen', 'It is your country. You may simply go.', { eligible: true, chance: 1, fee: 0.3, status: 'citizen' });
    return out;
  }
  // Before 1914 most countries asked nothing of people who came to settle (simplified): no visa, no application.
  if (eraOf(store.state.year).id === 'open') {
    add('free', 'Settling (no papers needed)', 'In this period most countries ask nothing of a newcomer who comes to live and work. You go, and you stay.', { eligible: p.age >= 16, why: 'You are too young to go alone.', chance: 1, fee: 0.15, status: 'permanent_resident' });
    return out;
  }
  const area = areaOf(destId);
  const free = area && mine.some((j) => area.members.includes(j));
  if (free) add('free', `Free movement (${area.name})`, 'Your citizenship lets you live and work there without a visa.', { eligible: true, chance: 1, fee: 0.3, status: 'permanent_resident' });

  // Family
  const spouse = livingNpcs().find((n) => n.role === 'spouse' && held(n).includes(issuer(destId)));
  const kin = livingNpcs().filter((n) => n.flags.abroad === destId && ['parent', 'child', 'sibling', 'spouse'].includes(n.role));
  const close = spouse || kin.find((n) => n.role !== 'sibling');
  add('family', 'To join family', spouse ? `${spouse.firstName} is a citizen there.` : kin.length ? `${kin[0].firstName} lives there.` : 'For the husbands, wives, parents and children of people who live there.',
    { eligible: !!(spouse || kin.length), why: 'You have no close family there.', chance: (close ? 0.85 : 0.5) + crime, status: 'permanent_resident' });

  // Work
  const qualified = has(p, 'university') || has(p, 'apprenticeship') || has(p, 'cosmetology') || ['medical', 'law', 'graduate', 'nursing', 'teaching', 'doctorate'].some((t) => has(p, t));
  const wanted = WANTED.includes(p.career.careerId) || WANTED.includes(p.career.lastField);
  add('work', 'Sponsored by an employer', 'An employer there offers you a job and applies for you. The permission is tied to working.', {
    eligible: p.age >= 18 && qualified, why: p.age < 18 ? 'You must be an adult.' : 'Employers sponsor people with a degree or a trade.',
    chance: 0.3 + (has(p, 'university') ? 0.15 : 0.08) + (['medical', 'law', 'graduate', 'doctorate'].some((t) => has(p, t)) ? 0.1 : 0) + Math.min(0.2, (p.career.yearsInField ?? 0) / 25)
      + (wanted ? 0.15 : 0) + (p.career.careerId ? 0.05 : 0) + (p.flags.sponsor === destId ? 0.35 : 0) + lang + crime, status: 'worker', years: ROUTE.workYears }); // sponsor: a job offer in hand (engine/recruiters.js)

  // Study
  const funds = localMoney(ROUTE.studyFunds, here);
  const school = has(p, 'high');
  add('study', 'As a student', `A place at a university there. You must show ${fmtMoney(funds, here)} for the first year, and may not work full-time.`, {
    eligible: school && p.age >= 17 && p.age <= 40 && !p.education.enrolled && p.finance.cash >= funds,
    why: !school ? 'You need a school-leaving qualification.' : p.age > 40 || p.age < 17 ? 'Student visas go to people between 17 and 40.' : p.education.enrolled ? 'Finish, or leave, the course you are on first.' : `You must show ${fmtMoney(funds, here)}.`,
    chance: 0.62 + ((p.education.degrees.find((d) => d.type === 'high')?.gpa ?? 2.5) - 2.5) * 0.15 + lang + crime, status: 'student', years: ROUTE.studyYears });

  // Investment
  const stake = localMoney(ROUTE.investStake, here);
  add('invest', 'As an investor', `For people bringing ${fmtMoney(stake, here)} or more. Expensive, and quick.`, {
    eligible: p.age >= 18 && p.finance.cash >= stake, why: `You would need ${fmtMoney(stake, here)}.`, chance: 0.92 + crime, fee: 3, status: 'permanent_resident' });

  // Settlement programme
  add('settle', 'Settlement program', 'Points for education, work, age and language. Slow, but it gives permanent residence.', {
    eligible: p.age >= 18, why: 'You must be an adult.',
    chance: 0.3 + (has(p, 'university') ? 0.2 : 0) + (['medical', 'law', 'graduate', 'doctorate'].some((t) => has(p, t)) ? 0.1 : 0) + (has(p, 'apprenticeship') || has(p, 'cosmetology') ? 0.1 : 0)
      + (p.career.careerId ? 0.1 : 0) + (p.age <= 35 ? 0.05 : p.age >= 50 ? -0.1 : 0) + lang + crime, status: 'permanent_resident' });

  // Owning a business there: only through this route, an application like any other (engine/businessAbroad.js).
  const owner = ownerRoute(destId, p);
  add('business', 'As a business owner', 'For owners of a business there that has traded for a year and employs people. You may work in your own business. Owning one gives no right to live there by itself.', {
    eligible: p.age >= 18 && owner.eligible, why: owner.why, chance: 0.8 + lang + crime, status: 'worker', years: 3 });

  // Retirement: for people with a pension or savings to live on, who will not work there.
  const income = (p.career.pensionPerYear ?? 0) + (p.finance.pension ?? 0) / 20;
  const enough = localMoney(ROUTE.retireIncome, here);
  add('retire', 'To retire', `For people of ${ROUTE.retireAge} or over with a pension, or savings, of ${fmtMoney(enough, here)} a year to live on. Work is not allowed; it is renewed while the money lasts.`, {
    eligible: p.age >= ROUTE.retireAge && (income >= enough || p.finance.cash >= enough * 10),
    why: p.age < ROUTE.retireAge ? `From age ${ROUTE.retireAge}.` : `You would need ${fmtMoney(enough, here)} a year, or ten years of it saved.`,
    chance: 0.85 + crime, status: 'retiree', years: ROUTE.retireYears });

  // Protection
  const crisis = here.living.crisis;
  add('protection', 'Seeking protection', 'For people who cannot safely stay where they are. No fee. The answer is temporary, and uncertain.', {
    eligible: ['war', 'collapse', 'shortages'].includes(crisis) && mine.includes(issuer(here.id)), why: 'This is for people whose own country is in crisis.',
    chance: (crisis === 'war' ? 0.65 : 0.45) + crime * 0.5, fee: 0, status: 'temporary_resident', years: ROUTE.protectionYears });
  return out;
}

/** The best open route, for a one-line summary. */
export function bestRoute(destId) {
  const open = routes(destId).filter((r) => r.eligible);
  return open.sort((a, b) => b.chance - a.chance || a.fee - b.fee)[0] ?? null;
}

// ---------- Who comes ----------

/**
 * Whether a husband or wife will make the move. They decide for themselves,
 * once a year per destination: how things are between you, whether they have
 * work of their own here, and whether it would be going home for them.
 */
export function spouseAnswer(n, destId) {
  const p = player();
  const a = n.flags.moveAnswer;
  if (a && a.age === p.age && a.dest === destId) return a.yes;
  const r = n.meters.relationship;
  let chance = r >= 70 ? 0.92 : r >= 50 ? 0.7 : 0.3;
  if (n.life?.job) chance -= 0.15;
  if (held(n).includes(issuer(destId))) chance += 0.15;
  const yes = rng.chance(clamp(chance, 0.05, 0.98));
  n.flags.moveAnswer = { age: p.age, dest: destId, yes };
  return yes;
}

// ---------- Permission that runs out ----------

const homeOf = (p) => held(p).find((j) => COUNTRIES[j] && j !== p.countryId) ?? p.birthCountryId;

/**
 * Yearly: a temporary status reaches its end. It is renewed while its
 * reason holds, becomes permanent after five years, and otherwise ends.
 * @returns {?string} the id of the country the player must return to, if their permission has ended
 */
export function tickStatus() {
  const p = player();
  const r = p.residency;
  const year = store.state.year;
  if (!r || r.jurisdictionId !== p.countryId || !r.until || rightToLive(p.countryId, p) || p.legal.incarceration) return null;
  const c = country();
  const lived = year - r.since;
  // A student who is not studying: a graduate gets two years to find work; anyone else is out of status.
  if (r.status === 'student' && !r.postStudy && !p.education.enrolled && year > r.since) {
    if (p.education.degrees.some((d) => d.age != null && d.age >= p.age - lived && d.type !== 'high')) {
      r.postStudy = true; r.workAuthorized = true; r.until = year + 2; delete r.grace;
      log(`You graduated. Your visa lets you stay in ${theCountry(c.name)} for two more years to find work.`, 'system', 'good');
      return null;
    }
    r.until = Math.min(r.until, year);
  }
  if (year === r.until - 1) log(`Your ${{ student: 'student visa', worker: 'work visa', temporary_resident: 'protection', retiree: 'retirement visa' }[r.status] ?? 'visa'} in ${theCountry(c.name)} runs out next year.`, 'system', 'neutral');
  if (year < r.until) return null;
  const permanent = (why) => { r.status = 'permanent_resident'; r.until = null; r.workAuthorized = true; log(`${why} You are a permanent resident of ${theCountry(c.name)} now.`, 'system', 'good'); return null; };
  const renew = (years, why) => { r.until = year + years; delete r.grace; log(why, 'system', 'neutral'); return null; };
  if (r.status === 'student') {
    if (p.education.enrolled) return renew(1, 'Your student visa was extended while you finish your course.');
    if (p.career.careerId) { r.status = 'worker'; r.workAuthorized = true; delete r.postStudy; return renew(ROUTE.workYears - 1, 'Your employer sponsored you: your student visa became a work visa.'); }
  } else if (r.status === 'worker' && r.route === 'business') {
    // A business owner's permission lasts while the business trades; after five years it can become permanent, like work.
    if (ownerRoute(p.countryId, p).eligible) return lived >= ROUTE.settledAfter ? permanent(`After ${lived} years running your business here you qualified to stay for good.`) : renew(3, 'Your business-owner permission was renewed.');
  } else if (r.status === 'worker') {
    if (p.career.careerId) return lived >= ROUTE.settledAfter ? permanent(`After ${lived} years of work here you qualified to stay for good.`) : renew(3, 'Your work visa was renewed.');
  } else if (r.status === 'retiree') {
    // Renewed while there is money to live on. It does not turn into permanent residence by itself.
    if ((p.career.pensionPerYear ?? 0) > 0 || p.finance.cash >= localMoney(ROUTE.retireIncome, c) * 2) return renew(ROUTE.retireYears, 'Your retirement visa was renewed.');
  } else if (r.status === 'temporary_resident') {
    if (lived >= ROUTE.settledAfter) return permanent(`After ${lived} years here you were allowed to stay for good.`);
    if (COUNTRIES[homeOf(p)]?.living.crisis) return renew(ROUTE.protectionYears, 'Your protection was renewed: it is still not safe to go back.');
  }
  // One year's grace to put things right, then it ends.
  if (!r.grace) { r.grace = true; r.until = year + 1; log(`Your permission to stay in ${theCountry(c.name)} has run out. You have one year to find ${r.status === 'student' ? 'a course or a sponsor' : 'work'}, or you must leave.`, 'system', 'bad'); return null; }
  const home = homeOf(p);
  if (!COUNTRIES[home] || home === p.countryId) return permanent('The authorities had nowhere to send you.');
  log(`Your permission to stay in ${theCountry(c.name)} has ended, and you have been told to leave.`, 'system', 'bad');
  return home;
}

/** One line for the passport: what the current permission is and when it ends. */
export function statusLine(p = player()) {
  const r = residency(p);
  if (r.status === 'citizen' || !r.until) return '';
  return `Valid until ${r.until}${r.postStudy ? '. You may work while you look for a sponsor.' : r.status === 'student' ? '. Full-time work is not allowed.' : r.status === 'worker' ? '. Renewed while you are employed.' : r.status === 'retiree' ? '. Work is not allowed; renewed while you have money to live on.' : '.'}`;
}

// ---------- Married across a border ----------

/**
 * Yearly: a husband or wife who stayed behind. The distance wears at the
 * marriage; if it is still strong they may decide to follow after all.
 */
export function tickApart() {
  const p = player();
  for (const n of livingNpcs()) {
    if (n.role !== 'spouse' || typeof n.flags.abroad !== 'string' || !n.flags.stayedBehind) continue;
    if (n.flags.abroad === p.countryId) { n.flags.abroad = false; delete n.flags.stayedBehind; continue; }
    if (n.meters.relationship >= 60 && rng.chance(0.25)) {
      n.flags.abroad = false; delete n.flags.stayedBehind;
      n.meters.relationship = clamp(n.meters.relationship + 8);
      if (n.life?.job) n.life.job = null;
      log(`${n.firstName} gave up the life they had kept going without you and moved to ${theCountry(country().name)} to be with you.`, 'system', 'good');
    } else {
      n.meters.relationship = clamp(n.meters.relationship - 4);
      if (rng.chance(0.4)) log(`You and ${n.firstName} are still married across a border. The calls are getting shorter.`, 'system', 'neutral');
    }
  }
}

// ---------- Family members' own permission ----------
// Someone who moves with the player holds a status of their own. Citizens of the place need none. Anyone else is the
// player's dependant: their permission lasts as long as the player's, and becomes permanent when the player's does.
// A child on a dependant visa who grows up needs a status of their own: a course, a job, or a year to leave.

const FAMILY = ['spouse', 'partner', 'child', 'parent', 'sibling', 'grandparent', 'grandchild'];
const npcHome = (n) => held(n).find((j) => COUNTRIES[j]) ?? n.bornIn ?? null;
const STATUS_LINE = { citizen: 'Citizen', permanent_resident: 'Permanent resident', dependant: 'Dependant on your visa', student: 'Student visa', worker: 'Work visa', temporary_resident: 'Temporary resident' };

/** Gives everyone who has just moved with the player a status in the new country. Called by emigrate(). */
export function settleFamily(placeId, ids) {
  const p = player();
  const year = store.state.year;
  const mine = residency(p);
  for (const id of ids) {
    const n = store.state.npcs[id];
    if (!n || !FAMILY.includes(n.role)) continue;
    if (rightToLive(placeId, n)) { n.residency = null; continue; }
    const permanent = mine.status === 'citizen' || mine.status === 'permanent_resident';
    n.residency = { jurisdictionId: placeId, status: permanent ? 'permanent_resident' : 'dependant', since: year, until: permanent ? null : mine.until ?? p.residency?.until ?? null };
  }
}

/** A family member's standing where the player lives, in a few words (or '' if it does not apply). */
export function familyStatus(n, p = player()) {
  if (!n?.alive || n.flags?.abroad || !FAMILY.includes(n.role)) return '';
  if (rightToLive(p.countryId, n)) return '';
  const r = n.residency?.jurisdictionId === p.countryId ? n.residency : null;
  if (!r) return '';
  return `${STATUS_LINE[r.status] ?? r.status}${r.until ? ` until ${r.until}` : ''}`;
}

/** Everyone in the household who is not a citizen here, with their status. For the passport. */
export function household(p = player()) {
  return livingNpcs().filter((n) => FAMILY.includes(n.role) && !n.flags.abroad && n.role !== 'pet').map((n) => {
    const citizen = rightToLive(p.countryId, n);
    const r = n.residency?.jurisdictionId === p.countryId ? n.residency : null;
    return { id: n.id, name: `${n.firstName} ${n.lastName}`, role: n.role, age: n.age, citizen,
      status: citizen ? 'Citizen' : r ? `${STATUS_LINE[r.status] ?? r.status}${r.until ? ` until ${r.until}` : ''}` : 'Permanent resident' };
  });
}

/**
 * Yearly: family members' permission follows the player's, children who come of age find a status of their own,
 * and anyone whose permission has ended goes back to the country they are a citizen of.
 */
export function tickFamilyStatus() {
  const p = player();
  const year = store.state.year;
  const mine = residency(p);
  for (const n of livingNpcs()) {
    const r = n.residency;
    if (!r || !FAMILY.includes(n.role)) continue;
    // Living elsewhere now, or a citizen now: nothing to track.
    if (rightToLive(r.jurisdictionId, n)) { n.residency = null; continue; }
    const withPlayer = !n.flags.abroad && p.countryId === r.jurisdictionId;
    if (r.status === 'dependant') {
      if (!withPlayer) { // the person whose visa it was has gone
        r.until = Math.min(r.until ?? year + 1, year + 1);
      } else if (mine.status === 'citizen' || mine.status === 'permanent_resident') {
        r.status = 'permanent_resident'; r.until = null;
        log(`${n.firstName} is a permanent resident now, as you are.`, 'system', 'good');
        continue;
      } else {
        r.until = mine.until ?? r.until;
        // A child who grows up needs a status of their own.
        if (n.role === 'child' && n.age >= 18) {
          if (n.life?.edu?.yearsLeft > 0) { r.status = 'student'; r.until = year + ROUTE.studyYears; log(`${n.firstName} turned eighteen and is on a student visa of their own now.`, 'system', 'neutral'); continue; }
          if (n.life?.job) { r.status = 'worker'; r.until = year + ROUTE.workYears; log(`${n.firstName} turned eighteen; their employer sponsored a work visa of their own.`, 'system', 'neutral'); continue; }
          if (!r.agedOut) { r.agedOut = true; r.until = year + 1; log(`${n.firstName} is eighteen, and no longer covered by your visa. They have a year to find a course or a job here.`, 'system', 'bad'); continue; }
        }
      }
    } else if (r.status === 'student' || r.status === 'worker') {
      if (year - r.since >= ROUTE.settledAfter && (n.life?.job || n.life?.edu?.yearsLeft > 0)) { r.status = 'permanent_resident'; r.until = null; continue; }
      if (r.until && year >= r.until && (r.status === 'student' ? n.life?.edu?.yearsLeft > 0 : n.life?.job)) { r.until = year + 3; continue; }
    }
    if (r.until && year >= r.until) {
      const home = npcHome(n);
      if (home && home !== p.countryId && COUNTRIES[home]) {
        n.flags.abroad = home;
        n.residency = null;
        n.meters.relationship = clamp(n.meters.relationship - 4);
        log(`${n.firstName}'s permission to stay in ${theCountry(COUNTRIES[r.jurisdictionId].name)} ran out, and they went back to ${theCountry(COUNTRIES[home].name)}.`, 'system', 'bad');
      } else { r.status = 'permanent_resident'; r.until = null; }
    }
  }
}
