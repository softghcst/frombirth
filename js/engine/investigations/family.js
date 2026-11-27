// Family and the work. Two things the player's own family brings to an investigative career:
//
//   a conflict of interest   when the player's own relative is a witness, the person reporting, a person of interest
//                            or the defendant in a case the player works, the rule is to step aside: the case goes
//                            to a colleague. Keeping it brings a complaint when it comes out, and the defense can use
//                            it. A relative in trouble in another detective's case is theirs: calling in a favor is
//                            misconduct.
//   an ancestor's case       a cold case an ancestor led and never closed, reopened by a descendant who investigates:
//                            the ancestor's own notes are in the file (what they did and the leads they left open),
//                            their old partner may still remember, and closing it goes into the family's history.
import { clamp } from '../../util.js';
import { store, player } from '../../state.js';
import * as k from '../cases.js';
import { W, I, rec, now, year, me, result, seeded, note, regard, legacies, nameOfId, dateWords } from './core.js';
import { investigation, caseStatus } from './casework.js';

const npc = (id) => store.state.npcs[id] ?? null;
const nm = (id) => nameOfId(id);
const FAMILY_ROLES = ['parent', 'child', 'sibling', 'spouse', 'grandparent', 'grandchild', 'cousin', 'aunt', 'uncle', 'niece', 'nephew', 'partner', 'stepparent', 'stepchild', 'inlaw'];
/** The player's relatives, as the game keeps them. */
export const relatives = (p = player()) => new Set((p.npcIds ?? []).filter((id) => FAMILY_ROLES.includes(npc(id)?.role)));

/** The player's relatives who appear in a case, with what they are in it. */
export function familyIn(inv, p = player()) {
  const f = inv?.file;
  if (!f) return [];
  const fam = relatives(p);
  const out = [];
  for (const x of f.people ?? []) if (fam.has(x.id)) out.push({ id: x.id, role: x.role });
  for (const id of f.poi ?? []) if (fam.has(id) && !out.some((o) => o.id === id)) out.push({ id, role: 'person of interest' });
  const c = f.courtCaseId && k.J().cases[f.courtCaseId];
  if (c && fam.has(c.defendantId) && !out.some((o) => o.id === c.defendantId)) out.push({ id: c.defendantId, role: 'defendant' });
  return out;
}
/** Marks a case the player leads that involves their family (called when a case is assigned or reopened). */
export function checkConflict(inv, p = player()) {
  const f = inv?.file;
  if (!f || f.conflict || f.leadId !== me(p)) return null;
  const fam = familyIn(inv, p);
  if (!fam.length) return null;
  f.conflict = { at: now(), relatives: fam, status: 'open' };
  return f.conflict;
}
/** Steps aside: the case goes to a colleague, as the rule requires. */
export function recuse(invId, p = player()) {
  const inv = investigation(invId);
  const f = inv?.file;
  const r = rec(p);
  if (!f?.conflict || f.conflict.status !== 'open' || f.leadId !== me(p)) return result(false, 'There is nothing to step aside from.', 'neutral');
  const a = Object.values(W().agencies).find((x) => x.id === inv.agencyId);
  const next = r.people.partnerId ?? Object.values(a?.units ?? {}).flatMap((u) => u.memberIds).find((x) => x !== me(p) && npc(x)?.alive) ?? null;
  f.conflict.status = 'recused';
  f.leadId = next;
  inv.investigatorIds = [next, ...inv.investigatorIds.filter((x) => x !== me(p) && x !== next)].filter(Boolean);
  r.caseIds = r.caseIds.filter((x) => x !== invId);
  f.log.push({ at: now(), text: `${p.firstName} ${p.lastName} stepped aside: a relative is involved. ${next ? `${nm(next)} leads the case now.` : 'The unit reassigns it.'}` });
  regard('integrity', 3);
  return result(true, `You tell your sergeant, and step aside. ${next ? `${nm(next)} takes the case.` : 'Someone else will take it.'} It is the rule, and it protects the case as much as you.`);
}
/** Keeps a case with a relative in it. It may come out; then it is a complaint, and the defense has a question for the court. */
export function keepCase(invId, p = player()) {
  const inv = investigation(invId);
  const f = inv?.file;
  if (!f?.conflict || f.conflict.status !== 'open') return result(false, 'There is nothing to decide.', 'neutral');
  f.conflict.status = 'kept';
  regard('integrity', -4);
  if (seeded(`${invId}/conflict`).chance(0.6)) {
    const id = `complaint_conflict_${invId}`;
    W().complaints[id] = { id, subjectId: me(p), kind: 'conflict', text: 'An officer is said to have worked a case involving their own relative.', invId, opened: now(), due: now() + 6, status: 'open', true: true };
    f.conflictKnown = now();
  }
  return result(true, 'You keep it, and say nothing. If it comes out, everything you did on the case will be looked at again.', 'bad');
}
/** A relative in someone else's case: whether the player stays out of it. */
export function relativeCases(p = player()) {
  const fam = relatives(p);
  return Object.values(k.J().investigations).filter((inv) => inv.file && inv.file.leadId !== me(p) && !inv.file.outcome && familyIn(inv, p).length && !(inv.file.familyAsked ?? []).includes(me(p)))
    .map((inv) => ({ inv, fam: familyIn(inv, p) })).filter((x) => x.fam.some((r) => fam.has(r.id)));
}
export function relativeChoice(invId, how, p = player()) {
  const inv = investigation(invId);
  const f = inv?.file;
  if (!f) return result(false, 'There is no such case.', 'neutral');
  (f.familyAsked ??= []).push(me(p));
  const rel = familyIn(inv, p)[0];
  if (how === 'favor') {
    regard('ethics', -8); regard('integrity', -6);
    const id = `complaint_favor_${invId}`;
    W().complaints[id] = { id, subjectId: me(p), kind: 'conflict', text: 'An officer asked a colleague about a case involving their own relative.', invId, opened: now(), due: now() + 6, status: 'open', true: true };
    return result(true, `You call the detective on the case to ask how it looks for ${rel ? nm(rel.id) : 'your relative'}. They write the call down, as they must.`, 'bad');
  }
  const n = rel && npc(rel.id);
  if (n) n.meters.relationship = clamp(n.meters.relationship + (how === 'support' ? 8 : 0));
  return result(true, how === 'support' ? `You stay out of the case, and stand by ${n ? n.firstName : 'them'} as family: a lawyer's name, a lift to the hearing.` : 'You stay out of it entirely.');
}

// ---------- An ancestor's case ----------

/** The ancestor whose case this is, when a descendant has it (the family's public legacy record). */
export function ancestorOf(inv) {
  const lead = inv?.file?.ancestorId ?? inv?.file?.leadId;
  const L = legacies().find((x) => x.id === lead);
  return L ? { id: L.id, name: L.name, died: L.died } : null;
}
/** When a descendant reopens or reviews a case an ancestor led, the file remembers whose it was. */
export function markAncestor(inv) {
  const f = inv?.file;
  if (!f || f.ancestorId) return null;
  const L = legacies().find((x) => x.id === f.formerLeadId);
  if (!L) return null;
  f.ancestorId = L.id;
  f.log.push({ at: now(), text: `Reopened by ${nm(me())}, a descendant of ${L.name}, who first led it.` });
  return L;
}
/** The ancestor's own notes: what was done in their time, and the leads they left open. */
export function ancestorNotes(inv) {
  const f = inv?.file;
  const a = ancestorOf(inv);
  if (!f || !a) return null;
  const until = (a.died ?? year()) * 12;
  return {
    name: a.name,
    done: f.log.filter((x) => x.at < until && !/^Reopened/.test(x.text)).slice(0, 12).map((x) => `${dateWords(x.at)}: ${x.text}`),
    open: f.leads.filter((l) => l.status === 'open' && l.at < until).map((l) => l.text),
  };
}
/** The ancestor's old partner, if alive, may remember what never went into the file. */
export function askOldPartner(invId, p = player()) {
  const inv = investigation(invId);
  const f = inv?.file;
  const a = ancestorOf(inv);
  if (!f || !a) return result(false, 'This is not a family case.', 'neutral');
  if (f.oldPartnerAsked) return result(false, 'You have spoken with them.', 'neutral');
  const old = npc(f.partnerId);
  if (!old?.alive || f.partnerId === me(p)) return result(false, `${a.name}'s partner on the case is no longer living.`, 'neutral');
  f.oldPartnerAsked = now();
  old.meters.relationship = clamp(old.meters.relationship + 10);
  f.leads.push({ id: `oldpartner_${invId}`, text: `${nm(old.id)}, ${a.name}'s partner on the case, remembers a name that never made it into the file. It needs checking.`, why: `${a.name}'s old partner`, status: 'open', at: now() });
  return result(true, `${nm(old.id)} is old now, and sharp. "Your ${seeded(invId).pick(['grandmother', 'grandfather', 'great-aunt', 'great-uncle'])} never let this one go," they say, and tell you what they remember.`);
}
/** Closing an ancestor's case goes into the family's history, once. */
export function settleAncestor(inv, p = player()) {
  const f = inv?.file;
  const a = ancestorOf(inv);
  if (!f?.outcome || !a || f.ancestorClosed || f.leadId !== me(p)) return null;
  f.ancestorClosed = now();
  note(`Closed ${f.title}, the case ${a.name} began in ${Math.floor(f.opened / 12)}.`, 'career', { key: `ancestor:${inv.id}`, milestone: `Finished what ${a.name} began`, significance: 3 });
  return `${f.title} is closed, ${Math.floor((now() - f.opened) / 12)} years after ${a.name} opened it.`;
}
export { caseStatus };
