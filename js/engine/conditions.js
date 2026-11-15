// Requirement evaluation against the live player. Paths are dotted lookups on
// the Character (e.g. "stats.intellect", "hidden.karma", "flags.metRival"),
// plus computed paths in SPECIAL, plus two scene-aware forms that look at the
// people cast in the current scene:
//   cast.<key>.<meter>      e.g. cast.director.relationship  (0–100)
//   memory.<key>.<memory>   e.g. memory.manager.coveredShift (100 if they remember it, else 0)
import { store, player, country, livingNpcs, npcMatches } from '../state.js';

/** Singing, dance and acting together. The weakest of the three drags it down. */
export function tripleThreat(p = player()) {
  const t = [p.talents.singing ?? 0, p.talents.dance ?? 0, p.talents.acting ?? 0];
  return Math.round((t[0] + t[1] + t[2]) / 6 + Math.min(...t) / 2);
}

const SPECIAL = {
  roles: () => livingNpcs().map((n) => n.role),
  conditionIds: (p) => p.conditions.map((c) => c.id),
  inventoryIds: (p) => p.inventory.map((i) => i.id),
  degreeTypes: (p) => p.education.degrees.map((d) => d.type),
  /** Cash expressed in base units so events can compare across currencies. */
  cashBase: (p) => p.finance.cash / country().currency.scale,
  jailed: (p) => !!p.legal.incarceration,
  employed: (p) => !!p.career.careerId,
  tripleThreat: (p) => tripleThreat(p),
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
  if (parts[0] === 'cast' || parts[0] === 'memory') {
    const npc = store.state.npcs[cast[parts[1]]];
    if (!npc?.alive) return 0;
    return parts[0] === 'cast' ? npc.meters[parts[2]] : hasMemory(npc, parts[2]) ? 100 : 0;
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
