// Requirement evaluation against the live player. Paths are dotted lookups on
// the Character (e.g. "stats.intellect", "hidden.karma", "flags.metRival"),
// plus a few computed paths listed in SPECIAL.
import { player, country, livingNpcs, npcMatches } from '../state.js';

const SPECIAL = {
  roles: () => livingNpcs().map((n) => n.role),
  conditionIds: (p) => p.conditions.map((c) => c.id),
  inventoryIds: (p) => p.inventory.map((i) => i.id),
  degreeTypes: (p) => p.education.degrees.map((d) => d.type),
  /** Cash expressed in base units so events can compare across currencies. */
  cashBase: (p) => p.finance.cash / country().currency.scale,
  jailed: (p) => !!p.legal.incarceration,
  employed: (p) => !!p.career.careerId,
};

export function resolve(path) {
  const p = player();
  if (SPECIAL[path]) return SPECIAL[path](p);
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), p);
}

/** @param {import('../types.js').Requirement} req */
export function meets(req) {
  const v = resolve(req.path);
  switch (req.op) {
    case '>=': return (v ?? 0) >= req.value;
    case '<=': return (v ?? 0) <= req.value;
    case '==': return (v ?? false) === req.value;
    case '!=': return (v ?? false) !== req.value;
    case 'has': return Array.isArray(v) && v.includes(req.value);
    case 'lacks': return !Array.isArray(v) || !v.includes(req.value);
    default: return false;
  }
}

export const meetsAll = (reqs = []) => reqs.every(meets);

/** True when a living NPC fits the role spec (also accepts 'mother' / 'father'). */
export const hasNpc = (spec) => livingNpcs().some((n) => npcMatches(n, spec));
