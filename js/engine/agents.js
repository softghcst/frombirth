// Agents, shopped for. Every agent is a person with their own terms: the cut
// they take, how much weight they carry with the people who hire (clout), and a
// list of clients the player can look through before signing. Looking for an
// agent shows one at a time; turning one down and looking again is allowed, but
// only twice a year, for each kind of agent.
//
//   npc.flags.agent = { kind:'talent'|'literary', orgId|agency, tier, standard, commission, clout, clients:[npcId] }
//   p.fame.agentSearch[kind] = { age, tries, shown:[npcId], offer: npcId|null }
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player } from '../state.js';
import { fameOf } from './fame.js';

export const TRIES_PER_YEAR = 2;
const TERMS = {
  top: { cut: [0.12, 0.2], clout: 1.35, label: 'A leading agency' },
  mid: { cut: [0.08, 0.16], clout: 1, label: 'A solid agency' },
  small: { cut: [0.05, 0.12], clout: 0.7, label: 'A small agency' },
};
export const tierLabel = (tier) => TERMS[tier]?.label ?? 'An agency';

/** What each kind of agent usually takes. Sports agents take least; managers and model agencies most. */
export const CUTS = { talent: [0.05, 0.2], literary: [0.1, 0.2], sports: [0.03, 0.1], music: [0.1, 0.25], model: [0.15, 0.25] };
export const KIND_NAMES = { talent: 'agent', literary: 'literary agent', sports: 'sports agent', music: 'manager', model: 'booker' };

/** An agent's own terms, rolled once. Better agencies usually cost more; not always. */
export function rollTerms(tier, kind = 'talent') {
  const t = TERMS[tier] ?? TERMS.mid;
  const [lo, hi] = CUTS[kind] ?? CUTS.talent;
  const span = hi - lo;
  // Where in the kind's range this agent sits: the leading agencies towards the top of it.
  const at = { top: [0.5, 1], mid: [0.25, 0.75], small: [0, 0.5] }[tier] ?? [0, 1];
  const k = at[0] + rng.next() * (at[1] - at[0]);
  return { commission: Math.round((lo + span * k) * 100) / 100, clout: Math.round(clamp(t.clout + rng.around(0, 0.15), 0.5, 1.6) * 100) / 100 };
}

/**
 * Asks an agent for a smaller cut, once a year. A client worth more to them than they are to the client gets it;
 * pushing without the name to back it up can end the arrangement. @param holder the player's record of the agent
 * ({ npcId, commission }), changed in place. @param worth how much the player is worth to them (0–100: fame, results).
 */
export function askLowerCut(kind, holder, worth, p = player()) {
  const s = search(kind, p);
  if (!holder) return { ok: false, text: 'You have no one to ask.', tone: 'neutral' };
  if (s.askedCut) return { ok: false, text: 'You asked this year already.', tone: 'neutral' };
  s.askedCut = true;
  const n = store.state.npcs[holder.npcId];
  const floor = (CUTS[kind] ?? CUTS.talent)[0];
  if (holder.commission <= floor) return { ok: false, text: 'They are already taking as little as anyone does.', tone: 'neutral' };
  if (rng.chance(clamp((worth - 25) / 55, 0.05, 0.9))) {
    holder.commission = Math.max(floor, Math.round((holder.commission - 0.02) * 100) / 100);
    if (n?.flags.agent) n.meters.relationship = clamp(n.meters.relationship - 3);
    return { ok: true, text: `${n ? n.firstName : 'They'} agree${n ? 's' : ''}: ${Math.round(holder.commission * 100)}% from now on.`, tone: 'good' };
  }
  if (n) n.meters.relationship = clamp(n.meters.relationship - 8);
  if (worth < 20 && rng.chance(0.25)) return { ok: false, dropped: true, text: `${n ? n.firstName : 'They'} take${n ? 's' : ''} it badly, and ${n ? 'decides' : 'decide'} you are more trouble than you are worth.`, tone: 'bad' };
  return { ok: false, text: '"That is the rate." They do not budge.', tone: 'neutral' };
}

/** Makes a pool of agents of one kind: people at agencies with terms and (optionally) clients. */
export function makeAgents(kind, countryId, o) {
  const c = o.country;
  return ['top', 'top', 'mid', 'mid', 'small', 'small'].map((tier, i) => {
    const agency = o.agencyNames[i % o.agencyNames.length].replace('{S}', rng.pick(c.names.last)).replace('{S2}', rng.pick(c.names.last)).replace('{W}', rng.pick(o.words)).replace('{C}', c.cities[0]);
    const n = o.makeNpc({ role: 'performer', countryId, age: rng.int(30, 64), relationship: rng.int(40, 55) });
    n.occupation = KIND_NAMES[kind];
    n.flags.agent = { kind, agency, tier, standard: { top: 60, mid: 35, small: 10 }[tier] + rng.int(-5, 5), clients: [], ...rollTerms(tier, kind) };
    for (const cl of o.clients(tier)) { cl.flags.star ??= {}; cl.flags.star.agentId = n.id; n.flags.agent.clients.push(cl.id); }
    store.state.npcs[n.id] = n;
    return n.id;
  });
}

/** Fills in terms for agents made before terms existed. */
export function ensureTerms(n, tier) {
  const a = n?.flags.agent;
  if (!a) return null;
  if (a.commission == null) Object.assign(a, rollTerms(tier ?? a.tier ?? 'mid', a.kind ?? 'talent'));
  a.tier ??= tier ?? 'mid';
  a.clients ??= [];
  return a;
}

/** The people an agent represents, best known first: the player can look them up. */
export function clientsOf(n) {
  return (n?.flags.agent?.clients ?? []).map((id) => (id === 'player' ? null : store.state.npcs[id])).filter((c) => c?.alive !== false && c)
    .sort((a, b) => (b.flags.star?.fame ?? 0) - (a.flags.star?.fame ?? 0));
}

/** This year's search for an agent of one kind. */
export function search(kind, p = player()) {
  fameOf(p).agentSearch ??= {}; // the full fame profile, never a bare stub
  const s = p.fame.agentSearch[kind];
  if (!s || s.age !== p.age) p.fame.agentSearch[kind] = { age: p.age, tries: 0, shown: [], offer: null, askedCut: false };
  return p.fame.agentSearch[kind];
}
export const triesLeft = (kind, p = player()) => TRIES_PER_YEAR - search(kind, p).tries;

/**
 * One look: uses a try, and shows one agent from those who would take the player on (not one already
 * shown this year). @param willing  the agents who would say yes. @returns {?object} the agent, or null
 */
export function look(kind, willing, p = player()) {
  const s = search(kind, p);
  if (s.tries >= TRIES_PER_YEAR) return { error: 'You have looked twice this year. Try again next year.' };
  s.tries += 1;
  const fresh = willing.filter((n) => !s.shown.includes(n.id));
  const pickFrom = fresh.length ? fresh : [];
  if (!pickFrom.length) { s.offer = null; return { none: true }; }
  const n = rng.pick(pickFrom);
  s.shown.push(n.id);
  s.offer = n.id;
  return { agent: n };
}

/** The agent currently on offer, if any. */
export const offered = (kind, p = player()) => { const id = search(kind, p).offer; return id ? store.state.npcs[id] ?? null : null; };
export const clearOffer = (kind, p = player()) => { search(kind, p).offer = null; };
