// The bridge between investigations and lawyers. A case an investigator referred to a prosecutor is in court as the
// Justice Engine's own case (engine/cases.js); a lawyer who takes it on (engine/lawCases.js, engine/lawPractice.js)
// works that same case: the same defendant, the same witnesses (real people from the investigation, not new ones)
// and the evidence as it was gathered, seen from their side:
//
//   defense      what was disclosed: every item and statement the investigation recorded, except what an incomplete
//                report left out, which may come out late (and then helps the defense)
//   prosecution  the file as referred
//
// Evidence keeps what the investigation found: how reliable it is, and whether it can be challenged (a statement got
// by pressing a witness, a custody record with a gap, something taken without lawful authority). A line of cross-
// examination works only where the witness really had a limitation. The verdict is the court's, written once on the
// Justice Engine's case, and the investigation reads it from there.
import { store, player } from '../../state.js';
import { OFFENSE_BY_ID } from '../../data/justice.js';
import { CASE_TEMPLATES } from '../../data/law.js';
import * as k from '../cases.js';
import { createCase, LC } from '../lawCases.js';
import { seeded, nameOfId, now } from './core.js';

const TERMINAL = ['sentenced', 'acquitted', 'dismissed', 'quashed'];
/** The lawyer's case template whose courtroom fits an offense (its structure; the evidence is the investigation's). */
export function templateFor(offenseId) {
  const off = OFFENSE_BY_ID[offenseId];
  if (['homicide', 'manslaughter'].includes(offenseId)) return 'homicide';
  if (offenseId === 'burglary' || offenseId === 'arson' || off?.category === 'property' && off.severity >= 2) return 'burglary';
  if (off?.category === 'violent') return 'assault';
  return 'theft';
}
/** The lawyer's case linked to a Justice Engine case, if one exists. */
export const lawCaseFor = (justiceCaseId) => Object.values(LC()).find((c) => c.justiceCaseId === justiceCaseId) ?? null;

/** Cases from investigations that are in court and have no lawyer for this side yet. */
export function pendingBriefs(role, countryId = player().countryId) {
  return Object.values(k.J().investigations).filter((inv) => {
    const c = inv.file?.courtCaseId && k.J().cases[inv.file.courtCaseId];
    if (!c || TERMINAL.includes(c.stage) || c.countryId !== countryId) return false;
    if (lawCaseFor(c.id)) return false;
    return role === 'defense' ? c.defenseId !== player().id : c.prosecutorId !== player().id;
  });
}

const KIND = { witness: 'witness_statement', victim: 'witness_statement', officer: 'witness_statement', cctv: 'recording', digital: 'recording', forensic: 'forensic', documents: 'document', financial: 'document', physical: 'physical', admission: 'statement' };
const WEIGHT = { forensic: 4, documents: 4, financial: 4, admission: 5, cctv: 3, digital: 3, physical: 3, witness: 3, victim: 3, officer: 3, character: 1 };

/** The evidence and witnesses of a referred case, as one side's lawyer has them. */
export function brief(inv, role) {
  const f = inv.file;
  const c = k.J().cases[f.courtCaseId];
  const offenseId = c.charges?.[0]?.offenseId ?? k.J().incidents[inv.incidentId]?.offenseId;
  const T = CASE_TEMPLATES[templateFor(offenseId)];
  const omittedClues = (f.report?.omitted ?? []).map((id) => f.clues.find((x) => x.id === id)).filter(Boolean);
  const omitted = new Set(omittedClues.map((x) => x.evidenceId).filter(Boolean));
  const gaps = new Set(f.items.filter((it) => it.integrity === 'gap').map((it) => it.evidenceId));
  const ev = c.evidenceIds.map((id) => k.J().evidence[id]).filter((e) => e && (role !== 'defense' || !omitted.has(e.id)));
  const evidence = ev.map((e) => {
    const basis = e.tainted ? 'suggestive_lineup' : e.lawful === false ? 'unlawful_search' : gaps.has(e.id) ? 'chain_of_custody' : null;
    // "favors" is from the defendant's side, as in the lawyer's templates: 'other' helps the prosecution.
    return { id: e.id, kind: KIND[e.kind] ?? 'document', label: e.summary, favors: e.pointsTo === c.defendantId ? 'other' : 'client', weight: WEIGHT[e.kind] ?? 2,
      reliability: Math.round((e.reliability ?? 0.5) * 100), admissibility: basis ? 'challengeable' : 'ok', basis, evidenceId: e.id };
  });
  // Late disclosure: what the report left out reaches the defense one way or another; when it does, it helps them.
  const late = role === 'defense' && omittedClues.length > 0 && seeded(`${inv.id}/late`).chance(0.65);
  if (late) for (const x of omittedClues) evidence.push({ id: `late_${x.id}`, kind: 'witness_statement', label: `Disclosed late: ${x.text}`, favors: 'client', weight: 3, reliability: Math.round((x.confidence ?? 0.6) * 100), admissibility: 'ok', basis: null, late: true });
  // The motion is aimed at an item the law gives a basis to challenge, if there is one; otherwise at the strongest
  // item against the defendant, where a motion without a basis will be denied.
  if (T.motion?.target) {
    const against = evidence.filter((e) => e.favors === 'other');
    const target = against.find((e) => e.admissibility === 'challengeable') ?? [...against].sort((x, y) => y.weight * y.reliability - x.weight * x.reliability)[0];
    if (target) target.id = T.motion.target;
  }
  // Real witnesses: the people the investigation spoke to who are still living. Their side is where their account points.
  const witnesses = Object.values(f.witnesses).filter((w) => store.state.npcs[w.id]?.alive).map((w) => {
    const clue = f.clues.find((x) => x.via === `q:${w.id}:observed`);
    const side = clue?.pointsTo === c.defendantId ? 'other' : 'client';
    return { id: `w_${w.id}`, npcId: w.id, role: 'Eyewitness', side, credibility: Math.round((clue?.confidence ?? 0.6) * 100), weakness: w.limitation ? 'sight' : null, limitation: w.limitation ?? null };
  });
  // The defense cross-examines the eyewitness whose account points at the defendant, on what they could really see.
  const main = witnesses.find((w) => w.side === 'other');
  const cross = main ? { witness: main.id, text: `${nameOfId(main.npcId)} says it was {client}.`, good: 'sight',
    options: [['Ask about the light, the distance and how long they saw them', 'sight'], ['Ask them to go over it again', 'repeat'], ['Ask about their private life', 'improper'], ['Ask how sure they are', 'repeat']] } : null;
  return { templateId: templateFor(offenseId), evidence, witnesses, cross, late, offenseId };
}

/** Takes a referred case on as a lawyer for one side. The same case, defendant, evidence and witnesses. */
export function takeBrief(invId, role, o = {}) {
  const inv = k.J().investigations[invId];
  const c = inv?.file?.courtCaseId && k.J().cases[inv.file.courtCaseId];
  if (!c || TERMINAL.includes(c.stage)) return null;
  if (lawCaseFor(c.id)) return lawCaseFor(c.id);
  const b = brief(inv, role);
  const lc = createCase(b.templateId, { ...o, role, justiceCaseId: c.id, investigationId: inv.id, offenseId: b.offenseId, evidence: b.evidence, witnesses: b.witnesses, cross: b.cross });
  inv.file.lawCaseIds = [...(inv.file.lawCaseIds ?? []), lc.id];
  inv.file.log.push({ at: now(), text: `${player().firstName} ${player().lastName} took the case on, for the ${role === 'defense' ? 'defense' : 'prosecution'}.` });
  if (b.late) lc.history.push({ m: lc.opened, year: store.state.year, text: 'Statements the investigation did not include in its report were disclosed late.' });
  return lc;
}
/** Whether a lawyer is working this court case now (then the court waits for them). */
export const lawyerOnIt = (justiceCaseId) => { const lc = lawCaseFor(justiceCaseId); return !!lc && !lc.done; };

/**
 * Takes on a family's claim after a fatal collision, for the family. The evidence is what the investigation found: a
 * conviction is strong evidence of fault; a finding that nobody could have avoided it turns the reconstruction against
 * the claim. Questions about speed work only if the investigation found the driver was at fault.
 */
export function takeClaim(claimId, o = {}) {
  const cl = (store.state.investigations?.claims ?? {})[claimId];
  if (!cl || cl.status !== 'open' || cl.lawCaseId) return null;
  const T = CASE_TEMPLATES.collision_claim;
  const fault = cl.outcome === 'convicted' || (cl.outcome !== 'resolved' && cl.finding !== 'accident' && cl.outcome !== 'acquitted');
  const evidence = T.evidence.map((e) => (e.id === 'recon' && !fault ? { ...e, favors: 'other', label: 'The police collision reconstruction: the pedestrian could not be seen in time' } : { ...e }));
  if (cl.outcome === 'convicted') evidence.push({ id: 'conviction', kind: 'document', label: 'The driver\'s criminal conviction for the death', favors: 'client', weight: 5, reliability: 95, admissibility: 'ok' });
  const lc = createCase('collision_claim', { ...o, clientId: cl.familyId, otherId: cl.driverId, evidence,
    witnesses: [{ id: 'driver', npcId: cl.driverId, role: 'The driver', side: 'other', credibility: 55, weakness: fault ? 'speed' : null }] });
  lc.claimId = cl.id;
  cl.lawCaseId = lc.id;
  cl.status = 'with a lawyer';
  k.J().investigations[cl.invId]?.file?.log.push({ at: now(), text: `The family's claim is with a lawyer, ${player().firstName} ${player().lastName}.` });
  return lc;
}
