// Activism: changing things from outside. A cause is a campaign for one side
// of one of the issues the country divides on (data/parties.js). The player
// can join one, build it, and, if it grows strong enough, force a government
// to move.
//
//   p.flags.cause = { id, countryId, since, standing, acts: { age, done } }
//     standing  0–100: how much the movement looks to the player
//   w.movements  { causeId: strength 0–100 }   how loud each cause is in the country
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { LEVERS } from '../data/parties.js';
import { CAUSES, CAUSE_ACTIONS } from '../data/politics.js';
import * as world from './polity.js';
import { post } from './news.js';
import { MONARCHIES } from '../data/royalty.js';
import * as dyn from './dynasty.js';
import { referendum } from './reign.js';

/** The royal house of the country, if it still reigns. */
const crown = (cid) => (MONARCHIES[cid] && store.state.dynasties?.[cid]?.status !== 'abolished' ? dyn.house(cid) : null);

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const ACTS_PER_YEAR = 2;
const cause = (id) => CAUSES.find((x) => x.id === id) ?? null;
/** The lever a cause is trying to move, if a government has one for it. */
const leverFor = (c) => c.lever ?? Object.entries(LEVERS).find(([, L]) => L.follows === c.issue)?.[0] ?? null;
/** Whether protest is dangerous here: where nobody is elected, or the count is not honest. */
const unfree = (cid) => { const w = world.polity(cid); return w.kind === 'party' || w.kind === 'none' || !!world.rigged(cid); };

export const mine = () => { const m = player().flags.cause; return m && m.countryId === player().countryId ? { ...m, ...cause(m.id) } : null; };
export const strength = (id = player().flags.cause?.id) => Math.round(world.polity(player().countryId).movements?.[id] ?? 0);
const grow = (id, n) => { const w = world.polity(player().countryId); (w.movements ??= {})[id] = clamp((w.movements[id] ?? 0) + n); };

/** The causes that can be joined, and what each wants. */
export const causes = () => CAUSES.filter((c) => !c.crown || crown(player().countryId)).map((c) => ({ ...c, strength: strength(c.id) }));

export function join(id) {
  const p = player();
  const c = cause(id);
  if (!c || p.age < 14) return result(false, 'You cannot join that.', 'neutral');
  if ((p.politics?.tier ?? 0) >= 3) return result(false, 'Someone who holds national office does not march behind a banner. Step down first.', 'neutral');
  if (c.crown && p.royal && !p.royal.waiting) return result(false, 'Not with your name. The family would never recover.', 'neutral');
  if (c.crown && !crown(p.countryId)) return result(false, 'There is no crown here to argue about.', 'neutral');
  const had = mine();
  p.flags.cause = { id, countryId: p.countryId, since: store.state.year, standing: 5 };
  if (!strength(id)) grow(id, rng.int(8, 20));
  return result(true, had ? `You leave ${had.name} for ${c.name}.` : `You join ${c.name}. ${c.wants}`, 'neutral');
}
export function leaveCause() {
  const had = mine();
  if (!had) return result(false, 'You belong to no cause.', 'neutral');
  delete player().flags.cause;
  return result(true, `You leave ${had.name}.`, 'neutral');
}

function acts() {
  const p = player();
  const m = p.flags.cause;
  if (m.acts?.age !== p.age) m.acts = { age: p.age, done: 0 };
  return m.acts;
}
export const actsLeft = () => (mine() ? ACTS_PER_YEAR - acts().done : 0);
export function rank() {
  const m = mine();
  return !m ? '' : m.standing >= 70 ? 'its public face' : m.standing >= 40 ? 'an organizer' : m.standing >= 15 ? 'a regular' : 'a new member';
}
export const actions = () => {
  const m = mine();
  const c = country();
  if (!m) return [];
  return CAUSE_ACTIONS.map((a) => ({ id: a.id, name: a.name, sub: `${a.sub}${a.cost ? ` ${fmtMoney(localMoney(a.cost, c), c)}.` : ''}${a.id === 'march' && unfree(c.id) ? ' Here, that can get you arrested.' : ''}`,
    disabled: (a.standing && m.standing < a.standing) || (a.strength && strength() < a.strength) || (a.cost && player().finance.cash < localMoney(a.cost, c)),
    why: a.standing && m.standing < a.standing ? 'You are not yet trusted with this.' : a.strength && strength() < a.strength ? 'The movement is not strong enough to get a hearing.' : '' }));
};

/** The government gives way on what the cause wants. @returns {string|null} what it did */
function concession(m, forced = false) {
  const p = player();
  const w = world.polity(p.countryId);
  if (store.state.year - (w.conceded?.[m.id] ?? -99) < 6) return null;
  const lever = leverFor(m);
  const led = m.standing >= 40;
  let text;
  const d = m.crown ? crown(p.countryId) : null;
  if (m.crown && !d) return null;
  if (m.crown < 0) {
    // What a republican movement wins is the vote itself. How the vote goes is another matter.
    text = `After years of pressure from ${m.name}, a referendum on the monarchy is held. ${referendum(-strength(m.id) / 12)}`;
  } else if (m.crown > 0) {
    d.standing = Math.round(clamp(d.standing + 8));
    text = `After a campaign by ${m.name}, the government has declared a year of celebration for the crown. The country joins in, mostly.`;
  } else if (lever && Math.abs(w.policies[lever] + m.dir) <= 2 && (forced || w.budget - LEVERS[lever].cost * m.dir > -4)) {
    const law = world.enact(w, lever, m.dir, world.figure(w, w.govt.headId)?.name);
    if (!law) return null;
    law.pressed = m.name;
    text = `After months of pressure from ${m.name}, the government has ${law.text}.`;
  } else {
    w.approval = clamp(w.approval - 2);
    text = `Under pressure from ${m.name}, the government has promised a review. It is not a law, but it is not nothing.`;
  }
  post(w, text);
  grow(m.id, -45);
  (w.conceded ??= {})[m.id] = store.state.year; // a government that has given way once does not do it again in a hurry
  p.hidden.fame = clamp(p.hidden.fame + (led ? 6 : 2));
  p.counters.polExp = (p.counters.polExp ?? 0) + (led ? 3 : 1);
  p.stats.mood = clamp(p.stats.mood + 8);
  if (led) milestone(`Led ${m.name} to a victory.`, 'fame');
  return text;
}

/** Does something for the cause. Two things a year. */
export function act(id) {
  const p = player();
  const c = country();
  const m = mine();
  const a = CAUSE_ACTIONS.find((x) => x.id === id);
  if (!m || !a) return result(false, 'You belong to no cause.', 'neutral');
  if (actsLeft() <= 0) return result(false, 'There are only so many evenings in a year.', 'neutral');
  if ((a.standing && m.standing < a.standing) || (a.strength && strength() < a.strength)) return result(false, 'That is not yours to do yet.', 'neutral');
  const cost = a.cost ? localMoney(a.cost, c) : 0;
  if (p.finance.cash < cost) return result(false, 'You cannot afford it.', 'neutral');
  p.finance.cash -= cost;
  acts().done += 1;
  const flag = p.flags.cause;
  let text = a.text;
  let tone = 'neutral';
  let gain = rng.int(a.gain[0], a.gain[1]);
  if (a.factor) gain += (p.stats[a.factor] - 50) / 12;
  flag.standing = Math.round(clamp(flag.standing + a.rise));
  if (a.id === 'march' && rng.chance(unfree(c.id) ? 0.35 : 0.04)) {
    // Arrested: a night in the cells where protest is allowed, real trouble where it is not.
    if (unfree(c.id)) { p.legal.heat = clamp(p.legal.heat + 25); p.stats.health = clamp(p.stats.health - rng.int(3, 10)); text = 'The march is broken up with batons. You are held for three days, photographed, and told your name is on a list now.'; }
    else { const fine = localMoney(400, c); p.finance.cash = Math.max(0, p.finance.cash - fine); text = `The march blocks a road, and you spend a night in a police cell for it. The fine is ${fmtMoney(fine, c)}.`; }
    p.counters.protestArrests = (p.counters.protestArrests ?? 0) + 1;
    flag.standing = Math.round(clamp(flag.standing + 6)); // nothing earns respect in a movement like being arrested for it
    gain += 3; tone = 'bad';
  }
  if (a.exp) p.counters.polExp = Math.min(40, (p.counters.polExp ?? 0) + a.exp);
  grow(m.id, gain);
  if (a.id === 'lobby') {
    const w = world.polity(c.id);
    // A minister listens to numbers, and to a government's own leanings.
    const lead = world.party(w, w.govt.lead);
    const agrees = lead ? (lead.positions[m.issue] ?? 0) * m.dir : 0;
    if (rng.chance(clamp(0.05 + (strength() - 40) / 200 + agrees * 0.08 + (p.stats.charm - 50) / 400, 0.02, 0.5) * (unfree(c.id) ? 0.3 : 1))) { const won = concession(mine()); if (won) return result(true, `You get twenty minutes with a minister, and use every one. ${won}`); }
    text = 'You get twenty minutes with a minister, who listens politely, promises nothing, and looks twice at the clock.';
  }
  log(text, 'system', tone);
  return result(tone !== 'bad', `${text} ${m.name} is ${strength() >= 60 ? 'impossible to ignore' : strength() >= 35 ? 'being talked about' : 'still small'}.`, tone);
}

/** Yearly: movements fade unless fed, and a loud enough one gets its way. */
export function tickActivism() {
  const p = player();
  const w = world.polity(p.countryId);
  const m = mine();
  for (const id of Object.keys(w.movements ?? {})) w.movements[id] = Math.max(0, w.movements[id] - (m?.id === id ? 5 : 8));
  if (!m) return;
  // A cause about the crown moves what the country thinks of it, a little every year it is heard.
  if (m.crown) { const d = crown(p.countryId); if (!d) { delete p.flags.cause; return; } if (rng.chance(strength() / 160)) d.standing = Math.round(clamp(d.standing + m.crown)); }
  if ((p.politics?.tier ?? 0) >= 3) { delete p.flags.cause; log(`Now that you hold national office, you step back from ${m.name}.`, 'system', 'neutral'); return; }
  const s = strength();
  if (s >= 55 && w.kind !== 'none' && rng.chance((s - 50) / 300 * (unfree(p.countryId) ? 0.3 : 1))) { const text = concession(m); if (text) log(text, 'system', 'good'); }
}
