// Who may see what in a case. One case, many professions, each with its own lawful view of it.
// These functions are the only way the screens read a case file; they build a new object holding
// only what the role is entitled to, so access is enforced here, not by hiding things on screen.
// The incident's truth (who really did it, what really happened) is never copied into any view.
//
//   investigator  the file: facts, claims, hypotheses, leads, items, laboratory reports, legal steps
//   forensic      the items sent to their laboratory, and the requests
//   prosecutor    the file as referred, with what must be disclosed to the defense
//   defense       what has been disclosed: the evidence in the case, the statements, the reports
//   judge         what has been put before the court, and the rulings
//   journalist    the public record: what was charged and decided in open court
//   archive       the same public record, for the Family Archive
import { store } from '../../state.js';
import { OFFENSE_BY_ID, EVIDENCE } from '../../data/justice.js';
import { TEMPLATES, LAB, LAB_RESULTS } from '../../data/investigations.js';
import * as k from '../cases.js';
import { me, dateWords } from './core.js';
import { standings, contradictions, caseStatus, incidentOf } from './casework.js';
import { ownerName } from './agencies.js';

const npc = (id) => store.state.npcs[id] ?? null;
const nm = (id) => (id === me() ? 'You' : npc(id) ? `${npc(id).firstName} ${npc(id).lastName}` : 'Unknown');
const ROLES = ['investigator', 'forensic', 'prosecutor', 'defense', 'judge', 'journalist', 'archive'];

/** The court case that came from an investigation, if any. */
const courtCase = (inv) => (inv.file?.courtCaseId ? k.J().cases[inv.file.courtCaseId] : null);
/** Whether a case is sealed: then nothing of it is public. */
const sealed = (inv) => { const c = courtCase(inv); return !!(c?.sealed || (c?.juvenile)); };

/** The public record of a case: what happened in open court, never the investigation. */
export function publicRecord(inv) {
  const c = courtCase(inv);
  const inc = incidentOf(inv);
  if (!c || sealed(inv)) return null; // an investigation that never reached court is not public
  const off = OFFENSE_BY_ID[c.charges[0]?.offenseId] ?? OFFENSE_BY_ID[inc.offenseId];
  const outcome = c.stage === 'sentenced' ? 'convicted' : c.stage === 'acquitted' ? 'acquitted' : c.stage === 'dismissed' ? 'dismissed' : c.stage === 'quashed' ? 'conviction quashed on appeal' : 'pending';
  return { caseId: c.id, title: `${off?.name ?? 'A criminal case'} in ${inc.city}, ${c.year}`, charge: off?.name ?? null, defendant: nm(c.defendantId), year: c.year, court: c.court, outcome,
    agency: ownerName(inv.agencyId) };
}

/**
 * A view of one case for one role. Returns null when the role has no access at all.
 * @param {object} inv  the investigation (engine/cases.js)
 * @param {string} role  one of ROLES
 * @param {string} [viewerId]  for forensic: the analyst; for others, the person viewing
 */
export function view(inv, role, viewerId = me()) {
  if (!ROLES.includes(role)) throw new Error(`Unknown role: ${role}`);
  const f = inv?.file;
  if (!f) return null;
  if (role === 'journalist' || role === 'archive') return publicRecord(inv);
  const c = courtCase(inv);
  const t = TEMPLATES[f.template];
  const base = { id: inv.id, title: f.title, kind: t.name, agency: ownerName(inv.agencyId), opened: dateWords(f.opened), status: caseStatus(inv) };
  if (role === 'forensic') {
    const mine = f.labs.filter((l) => l.analystId === viewerId);
    if (!mine.length) return null;
    return { ...base, requests: mine.map((l) => ({ id: l.id, item: f.items.find((x) => x.id === l.itemId)?.label, discipline: LAB[l.discipline].name, due: dateWords(l.due), status: l.status,
      result: l.status === 'reported' ? LAB_RESULTS[l.result] : null, integrity: f.items.find((x) => x.id === l.itemId)?.integrity })) };
  }
  if (role === 'investigator') {
    if (!inv.investigatorIds.includes(viewerId) && !(f.taskForceId && store.state.investigations?.taskForces?.[f.taskForceId]?.memberIds.includes(viewerId))) return null;
    const got = f.clues.filter((x) => x.found);
    return { ...base, lead: nm(f.leadId), partner: f.partnerId ? nm(f.partnerId) : null,
      facts: got.filter((x) => x.kind === 'fact' && x.text).map((x) => ({ id: x.id, text: x.text })),
      claims: got.filter((x) => x.kind === 'claim').map((x) => ({ id: x.id, text: x.text, by: nm(x.sourceId), confidence: x.confidence })),
      hypotheses: Object.values(standings(inv)).map(({ key, text, status, why }) => ({ key, text, status, why })),
      contradictions: contradictions(inv).map(([a, b]) => [a.text, b.text]),
      people: f.people.map((x) => ({ id: x.id, name: nm(x.id), role: x.role })).concat(f.poi.map((id) => ({ id, name: nm(id), role: f.cleared.includes(id) ? 'cleared' : inv.suspectIds.includes(id) ? 'suspect' : 'person of interest' }))),
      items: f.items.map((it) => ({ id: it.id, label: it.label, kind: EVIDENCE[it.kind]?.name, custody: it.custody.map((x) => `${dateWords(x.at)}: ${x.act} (${nm(x.by)})`), integrity: it.integrity })),
      labs: f.labs.map((l) => ({ id: l.id, item: f.items.find((x) => x.id === l.itemId)?.label, discipline: LAB[l.discipline].name, due: dateWords(l.due), status: l.status, text: l.status === 'reported' ? l.text : null })),
      leads: f.leads, auths: f.auths.map((a) => ({ kind: a.kind, judge: nm(a.judgeId), decision: a.decision, at: dateWords(a.at) })),
      report: f.report ? { complete: f.report.complete, at: dateWords(f.report.at) } : null, referral: f.referral ? { ...f.referral, prosecutor: nm(f.referral.prosecutorId), suspect: nm(f.referral.suspectId) } : null,
      court: c ? { stage: c.stage, defendant: nm(c.defendantId), due: c.trialDue ? dateWords(c.trialDue) : null } : null, outcome: f.outcome, log: f.log.map((x) => ({ at: dateWords(x.at), text: x.text })),
      evidenceIds: [...inv.evidenceIds] };
  }
  if (!c) return null; // the court roles see a case only once it is in court
  // What the law requires the defense to receive: every statement and result, including what cuts the other way.
  // A report that left things out does not change what exists; it changes whether the defense was told (casework.settleCourt).
  const omitted = new Set(f.report?.omitted ?? []);
  const evidence = c.evidenceIds.map((id) => k.J().evidence[id]).filter(Boolean).map((e) => ({ id: e.id, kind: EVIDENCE[e.kind]?.name, summary: e.summary, lawful: e.lawful, admissible: e.admissible }));
  const statements = f.clues.filter((x) => x.found && x.kind === 'claim').map((x) => ({ id: x.id, text: x.text, by: nm(x.sourceId) }));
  if (role === 'prosecutor') {
    return { ...base, defendant: nm(c.defendantId), evidence, statements, labs: f.labs.filter((l) => l.status === 'reported').map((l) => ({ discipline: LAB[l.discipline].name, text: l.text })),
      disclose: statements, notDisclosed: statements.filter((s) => omitted.has(s.id)).map((s) => s.id), stage: c.stage };
  }
  if (role === 'defense') {
    return { ...base, defendant: nm(c.defendantId), evidence, statements: statements.filter((s) => !omitted.has(s.id)), labs: f.labs.filter((l) => l.status === 'reported').map((l) => ({ discipline: LAB[l.discipline].name, text: l.text })),
      custody: f.items.filter((it) => it.integrity !== 'ok').map((it) => `${it.label}: a gap in the custody record`), stage: c.stage };
  }
  if (role === 'judge') return { ...base, defendant: nm(c.defendantId), evidence: evidence.filter((e) => e.admissible !== false), rulings: c.rulings, stage: c.stage };
  return null;
}
export { ROLES };
