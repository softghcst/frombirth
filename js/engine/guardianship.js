// Who looks after a child when no parent can. A parent is at home unless they
// have died, are in prison, or live abroad. With none at home, a child goes to
// a grandparent, then to an aunt, uncle or grown-up brother or sister, and only
// when nobody in the family can, into foster care. It lasts until a parent can
// take them back (released, home from abroad), or until they are grown.
//
// Where the child lives depends on where the carer lives and for how long:
//   the carer lives in the same town      the child moves in with them: same school, same friends
//   elsewhere, a short absence (<= 2 yr)  the carer comes to stay in the family home
//   elsewhere, a long absence             the child moves to the carer's town: a new school.
//                                         A teenager is asked first; a carer too old or unwell to move cannot come.
// When a parent comes home, a child who moved goes back to the family's town.
//
// The arrangement is kept on the player: p.flags.care =
//   { kind: 'grandparent'|'relative'|'sibling'|'foster', guardianId, since, until: 'release'|'adult', reason,
//     where: 'theirs'|'home'|'moved'|'asking', homeCity, choseStay? }
import { rng } from '../rng.js';
import { clamp, localMoney } from '../util.js';
import { store, player, country, log, milestone, npcsByRole } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { remember } from './conditions.js';
import * as k from './cases.js';
import { roleLabel } from './relationships.js';
import { ensure as ensureSchool } from './schooling.js';

/** Under this age, someone has to look after you. */
export const CARE_AGE = 18;
/** An absence this long or shorter is short: the carer comes to the child. */
export const SHORT_YEARS = 2;
/** From this age a child is asked where they would rather live. */
export const ASK_AGE = 13;
const inside = (n) => !!n?.flags.inmate && !n.flags.inmate.released;
/** Whether a parent is able to look after a child now. */
export const available = (n) => !!n?.alive && !inside(n) && !n.flags.abroad;

/** Why a parent is not at home, in words. */
function absence(n) {
  if (!n.alive) return 'has died';
  if (inside(n)) return 'is in prison';
  if (n.flags.abroad) return 'lives abroad';
  return 'is away';
}

/**
 * The town a relative lives in. Decided the first time it matters and kept:
 * most family lives nearby, some elsewhere in the country.
 */
export function homeOf(n) {
  const p = player();
  if (n.city) return n.city;
  const cities = country().cities;
  const near = { grandparent: 0.65, relative: 0.6, inlaw: 0.6, sibling: 0.75, guardian: 0.9 }[n.role] ?? 0.7;
  n.city = cities.length < 2 || rng.chance(near) ? p.city : rng.pick(cities.filter((c) => c !== p.city));
  return n.city;
}

/** Years until a parent can be expected home; Infinity when none can. */
export function yearsAway(parents) {
  const back = parents.filter((n) => n.alive).map((n) => (inside(n) ? n.flags.inmate.yearsLeft : Infinity));
  return back.length ? Math.min(...back) : Infinity;
}
/** Too old or unwell to uproot themselves for a child. */
const frail = (g) => g.age >= 78 || (g.meters.health ?? 70) < 40;

/**
 * How a carer in another town and a child come to live together.
 * @returns {'theirs'|'home'|'move'}  move in with them nearby; they come to stay; the child moves
 */
export function careWhere(carer, away, childCity = player().city) {
  if (homeOf(carer) === childCity) return 'theirs';
  if (away <= SHORT_YEARS && !frail(carer)) return 'home';
  return 'move';
}

/** The person the player lives with while in care, if any. */
export const guardian = () => store.state.npcs[player().flags.care?.guardianId] ?? null;

/** Where the player lives while in care, in words; null when not in care. */
export function careLine() {
  const c = player().flags.care;
  if (!c) return null;
  const g = guardian();
  if (c.kind === 'foster') return `In foster care${g ? `, with ${g.firstName} ${g.lastName}` : ''}`;
  return g ? `With your ${roleLabel(g).toLowerCase()} ${g.firstName}` : 'With family';
}

/** Family who could take the player in, best placed first. */
function candidates() {
  const fit = (n) => available(n) && n.age >= 21 && n.age <= 85;
  const by = (list) => list.filter(fit).sort((a, b) => b.meters.relationship - a.meters.relationship);
  return [
    ...by(npcsByRole('grandparent')).map((n) => ['grandparent', n]),
    ...by(npcsByRole('relative')).map((n) => ['relative', n]),
    ...by(npcsByRole('sibling')).map((n) => ['sibling', n]),
  ];
}

/**
 * Checks who looks after the player, and changes it if it must. Safe to call
 * at any time; does nothing when nothing has changed.
 * @returns {?string} what changed, in words
 */
export function checkCare() {
  const p = player();
  if (!p?.alive) return null;
  const care = p.flags.care;
  // Grown up: care ends. Leaving foster care comes with a little help.
  if (care && p.age >= CARE_AGE) return leaveCare();
  if (p.age >= CARE_AGE || p.legal.incarceration) return null;
  // Only a child still at home with family needs this: not one already living elsewhere (boarding at a university, say).
  if (!care && !p.flags.livesWithParents) return null;
  const parents = npcsByRole('parent').concat(Object.values(store.state.npcs).filter((n) => n.role === 'parent' && !n.alive && p.npcIds.includes(n.id)));
  const home = parents.filter(available);
  if (home.length) return care ? goHome(home.sort((a, b) => b.meters.relationship - a.meters.relationship)[0]) : null;
  if (care && available(guardian())) {
    // A parent who has died since: the arrangement is now until adulthood.
    if (care.until === 'release' && !parents.some((n) => n.alive)) care.until = 'adult';
    // A short stay that has become a long one: the child may have to move after all.
    if (care.where === 'home' && !care.choseStay && careWhere(guardian(), yearsAway(parents)) === 'move') return longStay(guardian());
    return null;
  }
  return place(parents);
}

function place(parents) {
  const p = player();
  const alive = parents.filter((n) => n.alive);
  const why = parents.length ? parents.map((n) => `your ${roleLabel(n).toLowerCase()} ${n.firstName} ${absence(n)}`).join(' and ') : 'there is no parent at home';
  const until = alive.length ? 'release' : 'adult';
  const away = yearsAway(parents);
  const [kind, g] = candidates()[0] ?? ['foster', foster()];
  const was = p.flags.care;
  const where = careWhere(g, away);
  p.flags.care = { kind, guardianId: g.id, since: store.state.year, until, reason: why, where: where === 'move' ? 'home' : where, homeCity: was?.homeCity ?? p.city };
  p.flags.livesWithParents = true;
  g.meters.relationship = clamp(g.meters.relationship + 8);
  g.lastInteractionAge = p.age;
  p.stats.mood = clamp(p.stats.mood - (kind === 'foster' ? 12 : 6));
  remember(g, 'tookYouIn', 'They took you in when your parents could not look after you.');
  const temp = until === 'release' ? ' for now, until you can go home' : '';
  const who = kind === 'foster' ? `${g.firstName} ${g.lastName}, a foster carer` : `your ${roleLabel(g).toLowerCase()} ${g.firstName}`;
  const lead = kind === 'foster' ? `With ${why}, and nobody in the family able to take you, you go into foster care${temp}.` : `With ${why}, ${who} will look after you${temp}.`;
  const text = where === 'theirs' ? `${lead} You move into ${kind === 'foster' ? 'their' : `${g.firstName}'s`} home, here in ${p.city}. Same school, same friends.`
    : where === 'home' ? `${lead} ${g.firstName} comes from ${homeOf(g)} to stay with you at home, so you can keep your school and your friends.`
      : lead;
  log(text, 'system', kind === 'foster' ? 'bad' : 'neutral');
  if (!was) milestone(kind === 'foster' ? 'Went into foster care.' : `Went to live with ${roleLabel(g).toLowerCase()} ${g.firstName}.`, 'family');
  k.note(p.id, 'care', kind === 'foster' ? 'Placed in foster care.' : `Placed with ${g.firstName} ${g.lastName}.`);
  if (where === 'move') return `${text} ${longStay(g)}`;
  return text;
}

/**
 * A long stay with a carer in another town. A teenager is asked; a younger
 * child moves. A carer too frail to move cannot come, whatever is asked.
 */
function longStay(g) {
  const p = player();
  if (p.age >= ASK_AGE && p.flags.care.kind !== 'foster' && !frail(g)) {
    p.flags.care.where = 'asking';
    store.state.pendingEvents.push({ id: 'care_choice', cast: { carer: g.id, words: { town: homeOf(g), here: p.city } } });
    return `${g.firstName} wants to know where you would rather live.`;
  }
  return moveTo(homeOf(g), g);
}

/** The teenager's answer. @returns {string} */
export function careChoice(value) {
  const p = player();
  const g = guardian();
  const care = p.flags.care;
  if (!care || !g) return '';
  if (value === 'care_stay') {
    care.where = 'home';
    care.choseStay = true;
    g.meters.relationship = clamp(g.meters.relationship + 5);
    return `${g.firstName} packs up in ${homeOf(g)} and moves in with you.`;
  }
  return moveTo(homeOf(g), g);
}

/** The child moves town: a new school, and old friends further away. */
function moveTo(city, g) {
  const p = player();
  const from = p.city;
  if (city === from) return '';
  const year = store.state.year;
  const list = (p.locations ??= [{ countryId: p.countryId, city: from, from: p.birthYear }]);
  const last = list[list.length - 1];
  if (last && last.to == null) last.to = year;
  list.push({ countryId: p.countryId, city, from: year });
  p.city = city;
  if (p.flags.care) p.flags.care.where = 'moved';
  for (const n of npcsByRole('friend').concat(npcsByRole('classmate'))) n.meters.relationship = clamp(n.meters.relationship - 10);
  p.stats.mood = clamp(p.stats.mood - 4);
  ensureSchool();
  const text = g ? `You move to ${city} to live with ${g.firstName}. A new school, and your friends in ${from} are a long way off now.` : `You move back to ${city}.`;
  log(text, 'system', 'neutral');
  k.note(p.id, 'care', `Moved from ${from} to ${city}.`);
  return text;
}

/** A foster carer: a person who stays in the player's life. */
function foster() {
  const p = player();
  const n = makeNpc({ role: 'guardian', countryId: p.countryId, age: rng.int(35, 62), relationship: rng.int(45, 65) });
  n.flags.title = 'Foster carer';
  n.occupation = 'Foster carer';
  n.savings = localMoney(rng.int(2000, 15000), country());
  store.state.npcs[n.id] = n;
  p.npcIds.push(n.id);
  return n;
}

function goHome(parent) {
  const p = player();
  const g = guardian();
  const kind = p.flags.care.kind;
  const back = p.flags.care.homeCity && p.flags.care.homeCity !== p.city ? p.flags.care.homeCity : null;
  p.flags.care = null;
  p.flags.livesWithParents = true;
  if (back) moveTo(back, null);
  parent.meters.relationship = clamp(parent.meters.relationship + 6);
  p.stats.mood = clamp(p.stats.mood + 8);
  if (g && kind === 'foster') { g.role = 'friend'; g.flags.title = 'Former foster carer'; }
  const text = `${parent.firstName} can look after you again. You go home${back ? ` to ${back}` : ''}${g ? `, and ${g.firstName} says the door is always open` : ''}.`;
  log(text, 'system', 'good');
  k.note(p.id, 'care', `Went home to ${parent.firstName}.`);
  return text;
}

function leaveCare() {
  const p = player();
  const c = p.flags.care;
  const g = guardian();
  p.flags.care = null;
  if (c.kind === 'foster') {
    p.flags.livesWithParents = false;
    k.pay({ key: `care_leaver:${p.id}`, kind: 'care_leaver_grant', amount: localMoney(2000, country()), payer: 'state', payee: p.id, caseId: null });
    if (g) { g.role = 'friend'; g.flags.title = 'Former foster carer'; }
    const text = `You turn ${CARE_AGE} and leave care, with a grant to start you off${g ? ` and ${g.firstName}'s number` : ''}.`;
    log(text, 'system', 'neutral');
    milestone('Left foster care.', 'family');
    return text;
  }
  const text = g ? `You are ${CARE_AGE}. ${g.firstName} says you can stay as long as you like.` : `You are ${CARE_AGE}.`;
  log(text);
  return text;
}
