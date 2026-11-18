// Moving abroad with children. A child under 18 does not move country on one
// parent's say: if their other parent is alive and is not coming, that parent's
// consent is needed, or a court's permission, or the child stays with them.
// Children who do move start at a new school in the new town, and settle in at
// a pace of their own.
//
//   p.flags.childMoves  { [destId:childId]: { status, year, reason? } }
//     status: 'agreed' | 'refused' | 'court_allowed' | 'court_refused' | 'staying'
//   child.flags.settling  { since, countryId, ease }   a child's first years somewhere new
//
// The odds are gameplay parameters, not family law; a court decides on the
// child's interests as the save shows them (their age, who they are close to,
// why the family is moving), never on who is richer.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, theCountry } from '../util.js';
import { store, player, country, livingNpcs, log } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { household } from './emigration.js';
import { charge, recordEvent, archiveIdOf } from './chronicle.js';
import { remember } from './conditions.js';
import { languagesOf } from './languages.js';
import { newTown } from './kidschool.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const nameOf = (id) => theCountry(COUNTRIES[id]?.name ?? id);
/** What asking a court costs (base units): lawyers and the application. Fictional. */
export const COURT_COST = 4000;

const book = (p) => (p.flags.childMoves ??= {});
const keyOf = (destId, child) => `${destId}:${child.id}`;

/** A child's other parent, if they are alive and someone in the save. */
export function otherParent(child, p = player()) {
  const id = (child.parentIds ?? []).find((x) => x !== p.id);
  const n = id ? store.state.npcs[id] : null;
  return n?.alive ? n : null;
}

/** The children under 18 who would move with the player. */
export const childrenMoving = (destId) => household(destId).filter((n) => n.role === 'child' && n.age < 18);

/**
 * Whether a child's move needs someone else's agreement, and where it stands.
 * Not needed when the other parent is dead, unknown, or coming too.
 */
export function consent(destId, child, p = player()) {
  const op = otherParent(child, p);
  const coming = new Set(household(destId).map((n) => n.id));
  if (!op || coming.has(op.id) || op.flags.abroad === destId) return { needed: false, status: 'not_needed', otherParent: op };
  const rec = book(p)[keyOf(destId, child)];
  return { needed: true, status: rec?.status ?? 'unasked', otherParent: op, reason: rec?.reason ?? null };
}

/** Children whose move is not settled yet: nobody has agreed, and no court has decided, and they are not staying. */
export const unresolved = (destId, p = player()) => childrenMoving(destId).filter((c) => {
  const s = consent(destId, c, p);
  return s.needed && !['agreed', 'court_allowed', 'staying'].includes(s.status);
});
/** Children who will stay with their other parent. */
export const staying = (destId, p = player()) => childrenMoving(destId).filter((c) => consent(destId, c, p).status === 'staying');

/** Asks the other parent. They decide, once per destination. */
export function askConsent(destId, childId, p = player()) {
  const child = store.state.npcs[childId];
  const s = child && consent(destId, child, p);
  if (!s?.needed) return result(false, 'No one else needs to agree.', 'neutral');
  if (s.status !== 'unasked') return result(false, 'You have asked already.', 'neutral');
  const op = s.otherParent;
  const close = op.meters.relationship;
  let k = 0.2 + (close - 50) / 120 + (child.age >= 15 ? 0.1 : 0) - (op.role === 'ex' && close < 30 ? 0.15 : 0);
  if (op.flags.abroad && op.flags.abroad !== p.countryId) k += 0.2; // they already live away from the child
  const yes = rng.chance(clamp(k, 0.05, 0.85));
  book(p)[keyOf(destId, child)] = { status: yes ? 'agreed' : 'refused', year: store.state.year };
  remember(op, `childMove_${child.id}`, yes ? `They agreed to ${child.firstName} moving to ${COUNTRIES[destId].name} with you.` : `They would not agree to ${child.firstName} moving to ${COUNTRIES[destId].name}.`);
  if (!yes) op.meters.relationship = clamp(op.meters.relationship - 4);
  const text = yes ? `${op.firstName} agrees: ${child.firstName} can move to ${nameOf(destId)} with you. You promise visits, and mean it.`
    : `${op.firstName} will not agree to ${child.firstName} moving to ${nameOf(destId)}. You can ask a court, or ${child.firstName} can stay with ${op.firstName}.`;
  log(text, 'system', yes ? 'good' : 'bad');
  return result(yes, text, yes ? 'good' : 'neutral');
}

/**
 * Asks a court for permission to move a child without the other parent's
 * agreement. The court weighs the child's interests as the save shows them.
 */
export function askCourt(destId, childId, reason = null, p = player()) {
  const child = store.state.npcs[childId];
  const s = child && consent(destId, child, p);
  if (!s?.needed || s.status !== 'refused') return result(false, 'A court is asked only after the other parent has said no.', 'neutral');
  const cost = localMoney(COURT_COST, country());
  const paid = charge({ amount: cost, kind: 'legal', memo: `Court application to move ${child.firstName} to ${COUNTRIES[destId].name}`, key: `court:${destId}:${child.id}` });
  if (!paid.ok) return result(false, `Lawyers and the application come to ${fmtMoney(cost, country())}. You do not have it.`, 'neutral');
  const op = s.otherParent;
  let k = 0.4 + (['work', 'family', 'study', 'business', 'right'].includes(reason) ? 0.1 : 0);
  if (child.age >= 12) k += child.meters.relationship >= 70 ? 0.15 : child.meters.relationship < 45 ? -0.2 : 0; // an older child is listened to
  if (op.role === 'spouse' || (!op.flags.abroad && op.meters.relationship >= 40)) k -= 0.1; // a parent close by, in the child's life
  const yes = rng.chance(clamp(k, 0.1, 0.85));
  book(p)[keyOf(destId, child)] = { status: yes ? 'court_allowed' : 'court_refused', year: store.state.year };
  recordEvent({ key: `court:${destId}:${child.id}`, type: 'family_court', title: `A court ${yes ? 'allowed' : 'refused'} ${child.firstName}'s move to ${COUNTRIES[destId].name}`, people: [archiveIdOf(child)], place: { countryId: p.countryId, city: p.city }, privacy: 'private', significance: 2 });
  op.meters.relationship = clamp(op.meters.relationship - 8);
  const text = yes ? `The court allowed ${child.firstName} to move to ${nameOf(destId)} with you, with visits to ${op.firstName} written into the order. It cost ${fmtMoney(cost, country())}.`
    : `The court refused: ${child.firstName} is to stay near ${op.firstName}. If you go, ${child.firstName} stays. It cost ${fmtMoney(cost, country())}.`;
  log(text, 'system', yes ? 'good' : 'bad');
  return result(yes, text, yes ? 'good' : 'bad');
}

/** Decides that a child stays with their other parent. */
export function letStay(destId, childId, p = player()) {
  const child = store.state.npcs[childId];
  const s = child && consent(destId, child, p);
  if (!s?.needed) return result(false, 'There is nobody for them to stay with.', 'neutral');
  book(p)[keyOf(destId, child)] = { status: 'staying', year: store.state.year };
  return result(true, `${child.firstName} will stay with ${s.otherParent.firstName}. You will see each other in the holidays.`, 'neutral');
}

/** At the move: who stays behind, and with whom. Called by emigrate with the case's destination. */
export function childrenStaying(destId, p = player()) {
  return staying(destId, p).map((c) => ({ id: c.id, with: consent(destId, c, p).otherParent?.id ?? null }));
}

/**
 * After the move: each child of school age starts at a school in the new town,
 * and begins to settle in. How easily depends on the child: younger children
 * and easy-going ones sooner, a new language and a worrier later.
 */
export function afterMove(childIds, destId, p = player()) {
  const lines = [];
  for (const id of childIds) {
    const n = store.state.npcs[id];
    if (!n?.alive || n.role !== 'child' || n.age < 4 || n.age >= 18) continue;
    const school = n.age >= 5 ? newTown(n) : '';
    const newLanguage = languagesOf(destId).length && !languagesOf(n.bornIn ?? p.birthCountryId).some((l) => languagesOf(destId).includes(l));
    const traits = n.traits ?? [];
    let ease = 60 - n.age * 2 + (traits.includes('sunny') ? 15 : 0) + (traits.includes('restless') ? 8 : 0) - (traits.includes('worrier') ? 15 : 0) - (newLanguage ? 15 : 0) + rng.int(-15, 15);
    ease = clamp(ease, 5, 95);
    n.flags.settling = { since: store.state.year, countryId: destId, ease };
    const how = ease >= 60 ? 'took to it at once' : ease >= 35 ? 'had a hard first term, and then found their feet' : 'missed their old friends badly, and the first year was long';
    recordEvent({ key: `newschool:${n.id}:${store.state.year}`, type: 'new_school', title: `${n.firstName} started at a new school in ${p.city}`, subject: archiveIdOf(n), people: [archiveIdOf(p)],
      text: `${n.firstName} ${how}.${newLanguage ? ' Everything was in a new language.' : ''}`, place: { countryId: destId, city: p.city }, significance: 2, privacy: 'family' });
    lines.push(`${school ? `${school} ` : ''}${n.firstName} ${how}.`);
  }
  return lines;
}

/** Yearly: children who moved find their feet, some sooner than others. */
export function tickChildrenSettling(p = player()) {
  const out = [];
  for (const n of livingNpcs().filter((x) => x.role === 'child' && x.flags.settling)) {
    const s = n.flags.settling;
    const years = store.state.year - s.since;
    if (s.countryId !== (typeof n.flags.abroad === 'string' ? n.flags.abroad : p.countryId)) { delete n.flags.settling; continue; }
    if (years >= (s.ease >= 60 ? 1 : s.ease >= 35 ? 2 : 3)) {
      delete n.flags.settling;
      n.meters.relationship = clamp(n.meters.relationship + 2);
      out.push({ text: `${n.firstName} has friends here now, and talks about ${p.city} as home.`, tone: 'good' });
    } else if (s.ease < 35 && rng.chance(0.5)) out.push({ text: `${n.firstName} is still finding it hard at school in ${p.city}.`, tone: 'neutral' });
  }
  return out;
}
