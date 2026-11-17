// Requirement evaluation against the live player. Paths are dotted lookups on
// the Character (e.g. "stats.intellect", "hidden.karma", "flags.metRival"),
// plus computed paths in SPECIAL, plus two scene-aware forms that look at the
// people cast in the current scene:
//   cast.<key>.<meter>      e.g. cast.director.relationship  (0–100), or cast.kid.age
//   memory.<key>.<memory>   e.g. memory.manager.coveredShift (100 if they remember it, else 0)
import { rule, may } from './rules.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { store, player, country, livingNpcs, npcMatches } from '../state.js';
import { MONARCHIES, ROYAL_RANKS } from '../data/royalty.js';
import { SYSTEMS } from '../data/politics.js';

/** Singing, dance and acting together. The weakest of the three drags it down. */
export function tripleThreat(p = player()) {
  const t = [p.talents.singing ?? 0, p.talents.dance ?? 0, p.talents.acting ?? 0];
  return Math.round((t[0] + t[1] + t[2]) / 6 + Math.min(...t) / 2);
}

const SPECIAL = {
  roles: () => livingNpcs().map((n) => n.role),
  // Country facts, for scenes: living.safety, living.infra, living.stability, living.graft, living.inflation, living.crisis
  living: () => country().living,
  hazards: () => country().living.hazards,
  conscription: () => rule('conscription'),
  inCrisis: () => !!country().living.crisis,
  // Royalty: monarchy (the country has a crown), isRoyal (in the royal family), isNoble (holds a noble title),
  // reigning, royalBy ('birth' | 'marriage' | 'honour' | null). The public's opinion is plain 'royal.image'.
  monarchy: () => !!MONARCHIES[country().id] && store.state.dynasties?.[country().id]?.status !== 'abolished',
  // Whether the crown the player wears governs (executive or absolute), or only advises.
  crownGoverns: (p) => { const cid = p.royal?.countryId; const d = store.state.dynasties?.[cid]; return ['executive', 'absolute'].includes(d?.type ?? MONARCHIES[cid]?.type); },
  isRoyal: (p) => !!p.royal && ROYAL_RANKS.includes(p.royal.rank),
  isNoble: (p) => !!p.royal && !p.royal.waiting && !ROYAL_RANKS.includes(p.royal.rank) && p.royal.rank !== 'knight',
  titled: (p) => !!p.royal,
  reigning: (p) => !!p.royal?.reigning,
  royalBy: (p) => p.royal?.by ?? null,
  // Politics: inOffice, officeTier (1 council … 5 head of government), democracy (voters choose), partyState.
  // Approval is plain 'politics.approval'.
  // True in the year a general election is held (engine/polity.js).
  electionYear: () => { const w = store.state.polities?.[country().id]; return !!w && w.calendar?.general === store.state.year; },
  // A law passed in the last year; an election that left no party with a majority.
  recentLaw: () => { const w = store.state.polities?.[country().id]; return !!w && w.laws.some((l) => store.state.year - l.year <= 1 && !l.refused && !l.over); },
  hung: () => { const w = store.state.polities?.[country().id]; const e = w?.elections[w.elections.length - 1]; return !!e && store.state.year - e.year <= 1 && ['coalition', 'minority'].includes(e.govt?.kind); },
  inOffice: (p) => !!p.politics,
  officeTier: (p) => p.politics?.tier ?? 0,
  democracy: () => ['presidential', 'parliamentary'].includes(SYSTEMS[country().id]?.kind),
  partyState: () => SYSTEMS[country().id]?.kind === 'party',
  // The royal household: the posts the player has filled, and whether the family owns property of its own.
  staffPosts: (p) => p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role === 'staff').map((n) => n.flags.staff),
  ownsEstate: (p) => (store.state.dynasties?.[p.royal?.countryId]?.residences ?? []).some((r) => r.owner === 'private' && !r.sold),
  conditionIds: (p) => p.conditions.map((c) => c.id),
  inventoryIds: (p) => p.inventory.map((i) => i.id),
  degreeTypes: (p) => p.education.degrees.map((d) => d.type),
  /** Cash expressed in base units so events can compare across currencies. */
  cashBase: (p) => p.finance.cash / country().currency.scale,
  jailed: (p) => !!p.legal.incarceration,
  employed: (p) => !!p.career.careerId,
  // Working life (engine/worklife.js, business.js): the field of the main job, whether the player manages people or owns a business, and the week.
  workFamily: (p) => CAREER_BY_ID[p.career.careerId]?.family ?? null,
  salaried: (p) => !!p.career.careerId && CAREER_BY_ID[p.career.careerId].type === 'fulltime',
  single: (p) => !p.npcIds.some((id) => { const n = store.state.npcs[id]; return n?.alive && ['partner', 'spouse'].includes(n.role); }),
  ownsBusiness: (p) => (p.businesses ?? []).some((b) => b.status === 'open'),
  yearsInRole: (p) => p.career.yearsInRole ?? 0,
  workStress: (p) => p.career.stress ?? 0,
  hasYoungChild: (p) => p.npcIds.some((id) => { const n = store.state.npcs[id]; return n?.alive && n.role === 'child' && n.age < 12; }),
  tripleThreat: (p) => tripleThreat(p),
  ownsProperty: (p) => p.assets.some((a) => a.kind === 'property'),
  ownsHome: (p) => !!p.homeId && p.assets.some((a) => a.id === p.homeId),
  hasTenant: (p) => p.assets.some((a) => a.tenant),
  ownsVehicle: (p) => p.assets.some((a) => a.kind === 'vehicle'),
  /** Value of investments in base units. */
  investedBase: (p) => p.assets.filter((a) => a.kind === 'security')
    .reduce((s, a) => s + a.value * a.units, 0) / country().currency.scale,
};

export const hasMemory = (npc, key) => !!npc?.memories?.some((m) => m.key === key);

/** Records something an NPC will remember about the player. One entry per key. */
export function remember(npc, key, text) {
  if (!npc) return;
  npc.memories ??= [];
  if (!hasMemory(npc, key)) npc.memories.push({ key, text, age: player().age });
}

export function resolve(path, cast = {}) {
  const p = player();
  if (SPECIAL[path]) return SPECIAL[path](p);
  const parts = path.split('.');
  if (SPECIAL[parts[0]]) return parts.slice(1).reduce((o, k) => (o == null ? undefined : o[k]), SPECIAL[parts[0]](p)) ?? null;
  if (parts[0] === 'cast' || parts[0] === 'memory') {
    const npc = store.state.npcs[cast[parts[1]]];
    if (!npc?.alive) return 0;
    if (parts[0] === 'memory') return hasMemory(npc, parts[2]) ? 100 : 0;
    if (parts[2] === 'flags') return npc.flags[parts[3]] ? 100 : 0;
    return parts[2] === 'age' ? npc.age : npc.meters[parts[2]];
  }
  return parts.reduce((o, k) => (o == null ? undefined : o[k]), p);
}

/** @param {import('../types.js').Requirement} req */
export function meets(req, cast) {
  const v = resolve(req.path, cast);
  switch (req.op) {
    case '>=': return (v ?? 0) >= req.value;
    case '<=': return (v ?? 0) <= req.value;
    case '==': return (v ?? false) === req.value;
    case '!=': return (v ?? false) !== req.value;
    case 'in': return req.value.includes(v);
    case 'has': return Array.isArray(v) && v.includes(req.value);
    case 'lacks': return !Array.isArray(v) || !v.includes(req.value);
    default: return false;
  }
}

export const meetsAll = (reqs = [], cast) => reqs.every((r) => meets(r, cast));

/** True when a living NPC fits the role spec (also 'mother', 'father', 'tag:<name>'). */
export const hasNpc = (spec) => livingNpcs().some((n) => npcMatches(n, spec));
