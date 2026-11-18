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

export const TRIES_PER_YEAR = 2;
const TERMS = {
  top: { cut: [0.12, 0.2], clout: 1.35, label: 'A leading agency' },
  mid: { cut: [0.08, 0.16], clout: 1, label: 'A solid agency' },
  small: { cut: [0.05, 0.12], clout: 0.7, label: 'A small agency' },
};
export const tierLabel = (tier) => TERMS[tier]?.label ?? 'An agency';

/** An agent's own terms, rolled once. Better agencies usually cost more; not always. */
export function rollTerms(tier) {
  const t = TERMS[tier] ?? TERMS.mid;
  return { commission: Math.round((t.cut[0] + rng.next() * (t.cut[1] - t.cut[0])) * 100) / 100, clout: Math.round(clamp(t.clout + rng.around(0, 0.15), 0.5, 1.6) * 100) / 100 };
}

/** Fills in terms for agents made before terms existed. */
export function ensureTerms(n, tier) {
  const a = n?.flags.agent;
  if (!a) return null;
  if (a.commission == null) Object.assign(a, rollTerms(tier ?? a.tier ?? 'mid'));
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
  p.fame ??= {};
  p.fame.agentSearch ??= {};
  const s = p.fame.agentSearch[kind];
  if (!s || s.age !== p.age) p.fame.agentSearch[kind] = { age: p.age, tries: 0, shown: s?.age === p.age ? s.shown : [], offer: null };
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
