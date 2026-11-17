// Who looks after a child when no parent can. A parent is at home unless they
// have died, are in prison, or live abroad. With none at home, a child goes to
// a grandparent, then to an aunt, uncle or grown-up brother or sister, and only
// when nobody in the family can, into foster care. It lasts until a parent can
// take them back (released, home from abroad), or until they are grown.
//
// The arrangement is kept on the player: p.flags.care =
//   { kind: 'grandparent'|'relative'|'sibling'|'foster', guardianId, since, until: 'release'|'adult', reason }
import { rng } from '../rng.js';
import { clamp, localMoney } from '../util.js';
import { store, player, country, log, milestone, npcsByRole } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { remember } from './conditions.js';
import * as k from './cases.js';
import { roleLabel } from './relationships.js';

/** Under this age, someone has to look after you. */
export const CARE_AGE = 18;
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
    return null;
  }
  return place(parents);
}

function place(parents) {
  const p = player();
  const alive = parents.filter((n) => n.alive);
  const why = parents.length ? parents.map((n) => `your ${roleLabel(n).toLowerCase()} ${n.firstName} ${absence(n)}`).join(' and ') : 'there is no parent at home';
  const until = alive.length ? 'release' : 'adult';
  const [kind, g] = candidates()[0] ?? ['foster', foster()];
  const was = p.flags.care;
  p.flags.care = { kind, guardianId: g.id, since: store.state.year, until, reason: why };
  p.flags.livesWithParents = true;
  g.meters.relationship = clamp(g.meters.relationship + 8);
  g.lastInteractionAge = p.age;
  p.stats.mood = clamp(p.stats.mood - (kind === 'foster' ? 12 : 6));
  remember(g, 'tookYouIn', 'They took you in when your parents could not look after you.');
  const temp = until === 'release' ? ' for now, until you can go home' : '';
  const text = kind === 'foster'
    ? `With ${why}, and nobody in the family able to take you, you go into foster care${temp}. You live with ${g.firstName} ${g.lastName}.`
    : `With ${why}, you go to live with your ${roleLabel(g).toLowerCase()} ${g.firstName}${temp}.`;
  log(text, 'system', kind === 'foster' ? 'bad' : 'neutral');
  if (!was) milestone(kind === 'foster' ? 'Went into foster care.' : `Went to live with ${roleLabel(g).toLowerCase()} ${g.firstName}.`, 'family');
  k.note(p.id, 'care', kind === 'foster' ? 'Placed in foster care.' : `Placed with ${g.firstName} ${g.lastName}.`);
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
  p.flags.care = null;
  p.flags.livesWithParents = true;
  parent.meters.relationship = clamp(parent.meters.relationship + 6);
  p.stats.mood = clamp(p.stats.mood + 8);
  if (g && kind === 'foster') { g.role = 'friend'; g.flags.title = 'Former foster carer'; }
  const text = `${parent.firstName} can look after you again. You go home${g ? `, and ${g.firstName} says the door is always open` : ''}.`;
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
