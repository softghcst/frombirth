// The rules of the house a teenager lives in: a curfew, set by the parent (or carer) who sets the rules, kept from
// year to year, and changed by asking (engine/together.js 'curfew'), never by sneaking (which loses trust instead).
// Stricter parents start earlier; a teenager who keeps their word earns later. Nothing here is a punishment ladder:
// rules are ordinary, and a rule is not mistreatment.
//
//   p.houseRules = { curfew: hour (21 = 9 pm), setBy: npc id, since: year, history: [{ year, curfew, why }] }
import { store, player } from '../state.js';
import { inFamilyHome } from './kinship.js';

const npc = (id) => store.state.npcs[id] ?? null;
export const EARLIEST = 20;
export const LATEST = 24;

/** "10 pm", "midnight". */
export const hourText = (h) => (h >= 24 ? 'midnight' : `${h > 12 ? h - 12 : h} pm`);

/** Who sets the rules where the player lives: the parent they mainly live with, or their carer. */
export function ruleSetter(p = player()) {
  if (p.flags.care?.guardianId) return npc(p.flags.care.guardianId);
  const parents = p.npcIds.map(npc).filter((n) => n?.alive && n.role === 'parent' && inFamilyHome(n));
  return parents.sort((a, b) => (b.strictness ?? 50) - (a.strictness ?? 50))[0] ?? null;
}

/** The house rules, set the first time they matter (at thirteen, living at home). */
export function houseRules(p = player()) {
  if (p.age < 13 || p.age >= 18 || !p.flags.livesWithParents) return null;
  if (p.houseRules) return p.houseRules;
  const by = ruleSetter(p);
  const strict = by?.strictness ?? 50;
  const curfew = strict >= 70 ? 21 : strict >= 40 ? 22 : 23;
  p.houseRules = { curfew, setBy: by?.id ?? null, since: store.state.year, history: [{ year: store.state.year, curfew, why: 'set' }] };
  return p.houseRules;
}

/** A later curfew, agreed. */
export function laterCurfew(why = 'asked') {
  const r = houseRules();
  if (!r) return null;
  r.curfew = Math.min(LATEST, r.curfew + 1);
  r.history.push({ year: store.state.year, curfew: r.curfew, why });
  return r.curfew;
}
/** An earlier one, after trust was broken. */
export function earlierCurfew(why = 'broke the rules') {
  const r = houseRules();
  if (!r) return null;
  r.curfew = Math.max(EARLIEST, r.curfew - 1);
  r.history.push({ year: store.state.year, curfew: r.curfew, why });
  return r.curfew;
}
