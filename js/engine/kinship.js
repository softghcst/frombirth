// Kinship: how two people in a life are related, worked out from the records that say so. Nothing here is a second
// family graph: each person is one NPC (or the player), and these functions read the links already kept on them.
//
//   biological parents   the player: p.family.bioParentIds (the parents a life was born to). An NPC: npc.parentIds,
//                        except an adopted child (npc.adopted), whose parentIds are their legal parents.
//   legal parents        the player: p.family.legalParentIds (the same people, unless adopted). An NPC: parentIds.
//   step-parent          role 'stepparent': the partner of one of the player's parents (flags.partnerOf), married
//                        to them or not (flags.married). Never a legal parent by being one.
//   step-sibling         role 'stepsibling': a child of a step-parent who is not a child of the player's parents.
//   half-sibling         role 'sibling' with flags.half = the id of the one parent they share.
//
// Old saves: brothers and sisters made with the life carry no parentIds. They were made from the player's own
// parents (engine/familyGen.js), so they are read as sharing them; a half-sibling shares only flags.half.
import { store, player } from '../state.js';

const npc = (id) => store.state.npcs[id] ?? null;
const isPlayer = (x) => !!x && x === player();

/** The parents a life was born to (ids), whether or not they are still alive. */
export function bioParentIdsOf(x) {
  const p = player();
  if (isPlayer(x)) return [...(p.family?.bioParentIds ?? p.npcIds.filter((id) => { const n = npc(id); return n?.role === 'parent' && !n.flags.step && !n.adopted; }))];
  if (!x || x.adopted) return [];
  if (x.parentIds?.length) {
    // The player's own children keep only their other parent: the player is the other.
    return x.role === 'child' ? [...new Set([...x.parentIds, p.id])] : [...x.parentIds];
  }
  if (x.role === 'child') return [p.id];
  if (x.role === 'sibling') {
    const mine = bioParentIdsOf(p);
    return typeof x.flags?.half === 'string' ? mine.filter((id) => id === x.flags.half) : mine;
  }
  return [];
}

/** Legal parents (ids): an adopted child's are the people who adopted them. */
export function legalParentIdsOf(x) {
  const p = player();
  if (isPlayer(x)) return [...(p.family?.legalParentIds ?? bioParentIdsOf(p))];
  if (x?.adopted) return x.role === 'child' ? [...new Set([...(x.parentIds ?? []), p.id])] : [...(x.parentIds ?? [])];
  return bioParentIdsOf(x);
}

/**
 * How two brothers or sisters (or step-siblings) are related.
 * @returns {'twin'|'full'|'half'|'adoptive'|'step'|null}
 */
export function siblingKind(a, b) {
  if (!a || !b || a === b) return null;
  const bioA = bioParentIdsOf(a);
  const bioB = bioParentIdsOf(b);
  const shared = bioA.filter((id) => bioB.includes(id)).length;
  if (shared >= 2) return (a.flags?.twin || b.flags?.twin) && (isPlayer(a) || isPlayer(b)) ? 'twin' : 'full';
  if (shared === 1) return 'half';
  const legalA = legalParentIdsOf(a);
  const legalB = legalParentIdsOf(b);
  if (legalA.some((id) => legalB.includes(id))) return 'adoptive';
  // A step-sibling: one's parent is (or was) the partner of the other's parent.
  const partners = (ids) => ids.flatMap((id) => { const n = npc(id); return n?.flags?.partnerOf ? [n.flags.partnerOf] : []; });
  if (partners(legalA).some((id) => legalB.includes(id)) || partners(legalB).some((id) => legalA.includes(id))) return 'step';
  if (b.role === 'stepsibling' || a.role === 'stepsibling') return 'step';
  return null;
}

/** Whether `n` is the player's biological parent. A step-parent, guardian or foster carer never is. */
export const isBioParent = (n) => !!n && bioParentIdsOf(player()).includes(n.id);
/** Whether `n` is one of the player's legal parents. */
export const isLegalParent = (n) => !!n && legalParentIdsOf(player()).includes(n.id);

/** The player's parents as people: biological and legal, alive or not. */
export function parentsOfPlayer() {
  const ids = [...new Set([...bioParentIdsOf(player()), ...legalParentIdsOf(player())])];
  return ids.map(npc).filter(Boolean);
}

/** Every step-parent the player has had, present and former. */
export const stepParents = () => player().npcIds.map(npc).filter((n) => n?.role === 'stepparent');

/** One line for how someone is related, for labels: "Half-sister (same mother)". */
export function kinNote(n) {
  const p = player();
  if (n.role === 'sibling' || n.role === 'stepsibling') {
    const kind = siblingKind(p, n);
    if (kind === 'half') {
      const shared = bioParentIdsOf(n).find((id) => bioParentIdsOf(p).includes(id));
      const via = npc(shared);
      return via ? `Same ${via.gender === 'male' ? 'father' : via.gender === 'female' ? 'mother' : 'parent'}` : 'One parent in common';
    }
    if (kind === 'step') { const via = npc(n.flags?.stepVia); return via ? `${via.firstName}'s child` : 'Through a parent\'s marriage'; }
    if (kind === 'adoptive') return 'Through adoption';
  }
  if (n.role === 'stepparent') { const of = npc(n.flags?.partnerOf); return of ? `${n.flags.former ? 'Was' : 'Is'} ${of.firstName}'s ${n.flags.married ? 'spouse' : 'partner'}` : ''; }
  return '';
}

// ---------- Who lives in the family home ----------

/** A parent who lives in a home of their own, apart from the child (after a separation). */
export const livesApart = (n) => n?.role === 'parent' && !!n.flags?.livesApart;

/**
 * Whether someone lives in the family home with the player, while the player lives with family
 * (engine/neighborhood.js housemates). A step-parent lives there when they have moved in with the parent who does;
 * a step-brother or step-sister when they mainly live with that step-parent; a half-sibling unless they live with
 * the parent who moved out.
 */
export function inFamilyHome(n) {
  if (!n?.alive || n.flags?.abroad) return false;
  if (n.role === 'parent') return !livesApart(n);
  if (n.role === 'sibling') return n.age < 18 && !n.flags.livesApartWith;
  if (n.role === 'stepparent') { const of = npc(n.flags.partnerOf); return !n.flags.former && !!n.flags.liveIn && !!of?.alive && !livesApart(of); }
  if (n.role === 'stepsibling') { const via = npc(n.flags.stepVia); return n.age < 18 && !!n.flags.liveIn && !!via && inFamilyHome(via); }
  return false;
}
