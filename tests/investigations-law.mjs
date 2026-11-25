// Investigations and lawyers: a case an investigator referred to court is the case a player defender, prosecutor or
// private lawyer works (engine/investigations/legal.js). The same court case, defendant, witnesses and evidence; what
// the investigation found decides what can be challenged; the court decides once, and the investigation records it.
// Run with: node tests/investigations-law.mjs
import { store, rng, ls, lp, lc, k, check, finish, lawyer, playCase } from './helpers/lawSetup.mjs';
import { CASE_TEMPLATES } from '../js/data/law.js';

const A = await import('../js/engine/investigations/agencies.js');
const W = await import('../js/engine/investigations/casework.js');
const core = await import('../js/engine/investigations/core.js');
const LG = await import('../js/engine/investigations/legal.js');

rng.seed(20261127);

/** A burglary investigated by the city police and referred to court, with its evidence as found. */
function referred(o = {}) {
  const p = store.state.player;
  const a = A.agencyOf('municipal', p.countryId, p.city);
  const inv = W.openCase('burglary', { ownerId: a.id, truth: 'insider' });
  const f = inv.file;
  const poi = f.poi[0] ?? inv.suspectIds[0] ?? Object.values(store.state.npcs).find((n) => n.alive && n.id !== p.id).id;
  // What was collected: each item's evidence, one with a gap in its custody log.
  for (const it of f.items) inv.evidenceIds.push(it.evidenceId);
  if (f.items[0]) f.items[0].integrity = 'gap';
  // A witness statement, got by pressing the witness: the court may rule it out.
  const inc = k.J().incidents[inv.incidentId];
  const wid = Object.keys(f.witnesses)[0];
  const st = k.addEvidence(inc, 'witness', poi, { sourceId: wid, lawful: true, summary: 'A neighbor says they saw the accused at the door.' });
  st.tainted = !!o.tainted;
  inv.evidenceIds.push(st.id);
  // The eyewitness whose account points at the accused, with a real limitation (or none).
  const clue = f.clues.find((x) => x.via === `q:${wid}:observed`);
  if (clue) clue.pointsTo = poi;
  f.witnesses[wid].limitation = o.limitation === undefined ? 'it was dark' : o.limitation;
  f.report = { at: core.now(), complete: !o.omit, omitted: [], quality: 60 };
  if (o.omit) {
    const ex = { id: `c${f.clues.length + 1}`, via: 'test', kind: 'claim', text: 'A second neighbor saw someone else leave.', found: true, confidence: 0.7, pointsTo: null };
    f.clues.push(ex);
    f.report.omitted = [ex.id];
  }
  const jc = k.openCaseFor(inv, poi);
  f.courtCaseId = jc.id;
  jc.trialDue = core.now() + 12;
  return { inv, jc, wid, poi };
}

// ---------- A public defender is assigned the referred case ----------
{
  const p = lawyer('defender');
  const { inv, jc, wid } = referred({ tainted: true });
  check(LG.pendingBriefs('defense', p.countryId).some((x) => x.id === inv.id), 'a referred case in court is waiting for a defense lawyer');
  lp.refreshOpportunities(p);
  const c = LG.lawCaseFor(jc.id);
  check(c && c.investigationId === inv.id && c.role === 'defense', 'the public defender\'s office assigns it to the player, as the defense');
  check(c && c.justiceCaseId === jc.id && c.clientId === jc.defendantId && jc.defenseId === p.id, 'the same court case and the same defendant, now the player\'s client');
  check(c && Object.keys(lc.LC()).filter((id) => lc.LC()[id].justiceCaseId === jc.id).length === 1, 'one lawyer\'s case per court case, not a copy');
  check(c && c.witnesses.every((w) => inv.file.witnesses[w.npcId]) && c.witnesses.length === Object.values(inv.file.witnesses).filter((w) => store.state.npcs[w.id]?.alive).length, 'the witnesses are the investigation\'s own, not new people');
  check(c && c.evidence.every((e) => k.J().evidence[e.evidenceId]) && c.evidence.length === jc.evidenceIds.length, 'every piece of evidence is a record from the investigation');
  const tainted = c?.evidence.find((e) => k.J().evidence[e.evidenceId]?.tainted);
  const gap = c?.evidence.find((e) => e.evidenceId === inv.file.items[0]?.evidenceId);
  check(tainted?.admissibility === 'challengeable' && tainted.basis === 'suggestive_lineup', 'a statement got by pressure can be challenged');
  check(!gap || gap.basis === 'chain_of_custody' || gap.favors === 'client', 'a gap in the custody log is a basis to challenge the item');
  const target = CASE_TEMPLATES[c?.templateId]?.motion?.target;
  check(!target || c.evidence.some((e) => e.id === target && e.favors === 'other'), `the motion is aimed at an item of the investigation's evidence against the client (${target})`);
  check(c?.cross?.witness && c.witnesses.find((w) => w.id === c.cross.witness)?.npcId === wid, 'cross-examination is of the eyewitness whose account points at the client');
  // The court waits for the lawyer: nothing is decided by the investigation's own court step.
  jc.trialDue = core.now();
  check(W.settleCourt(inv) === null && !['sentenced', 'acquitted', 'dismissed'].includes(jc.stage), 'while a lawyer has the case, the court does not decide it without them');
  playCase(c, { answers: undefined });
  check(c.done && ['convicted', 'acquitted', 'plea', 'dismissed'].includes(c.outcome?.kind) || c.mistrials === 1, `the lawyer takes it to its end (${c.outcome?.kind ?? 'mistrial'})`);
  if (c.done) {
    const r = W.settleCourt(inv);
    const kind = inv.file.outcome?.kind;
    check(r && kind && (kind === 'convicted') === (jc.stage === 'sentenced'), `the investigation records the court's decision, from the same case (${kind}, ${jc.stage})`);
    check(W.settleCourt(inv) === null && inv.file.outcome.kind === kind, 'and records it once');
    check(inv.file.log.some((x) => /took the case on, for the defense/.test(x.text)), 'the case file notes who defended it');
  }
}

// ---------- Cross-examination works only on a real limitation ----------
{
  for (const limitation of ['it was dark', null]) {
    const p = lawyer('defender');
    const { jc } = referred({ limitation });
    lp.refreshOpportunities(p);
    const c = LG.lawCaseFor(jc.id);
    c.awaiting = { what: 'trial', since: ls.nowM(), turn: ls.nowM() };
    const day = lc.courtroom(c);
    const cross = day?.phases.find((x) => x.id === 'cross');
    check(cross && cross.real && /sees? |says it was/.test(cross.text), `${limitation ?? 'no limitation'}: the cross is of the real eyewitness`);
    const r = lc.argue(c, { cross: 'sight' });
    const lines = (r.lines ?? []).join(' ') + ' ' + (r.text ?? '');
    if (limitation) check(/admits it was dark/.test(lines) || c.witnesses.some((w) => w.examined === 'shaken'), 'a witness who saw it in the dark admits it');
    else check(/clear view/.test(lines) || c.witnesses.some((w) => w.examined === 'held'), 'a witness who had a clear view holds');
  }
}

// ---------- What an incomplete report left out ----------
{
  let late = 0;
  let seen = 0;
  for (let i = 0; i < 6; i++) {
    lawyer('defender');
    const { inv } = referred({ omit: true });
    const b = LG.brief(inv, 'defense');
    const pros = LG.brief(inv, 'prosecution');
    seen += 1;
    if (b.late) late += 1;
    check(!pros.evidence.some((e) => e.late), 'the prosecution\'s brief has no late disclosure');
    check(!b.late || b.evidence.some((e) => e.late && e.favors === 'client'), 'a statement disclosed late helps the defense');
  }
  check(late > 0, `the omission usually comes out (${late} of ${seen})`);
}

// ---------- A prosecutor is assigned it; a private lawyer is offered it ----------
{
  const p = lawyer('prosecutor');
  const { inv, jc } = referred();
  lp.refreshOpportunities(p);
  const c = LG.lawCaseFor(jc.id);
  check(c && c.role === 'prosecution' && !c.clientId && jc.prosecutorId === p.id, 'a prosecutor is assigned the referred case, for the government');
  check(c && c.evidence.filter((e) => e.favors === 'other').length > 0, 'the evidence against the accused is the prosecution\'s');
  check(inv.file.lawCaseIds?.includes(c?.id), 'the investigation knows which lawyer\'s case it is');

  let offered = null;
  for (let i = 0; i < 8 && !offered; i++) {
    const q = lawyer('lawyer');
    const L = ls.lawOf(q);
    L.specialty = 'criminal_defense';
    referred();
    lp.refreshOpportunities(q);
    offered = (L.offers ?? []).find((o) => o.invId);
  }
  check(offered && /charged with/.test(offered.summary), 'a private criminal defense lawyer may be offered a client from a police investigation');
  if (offered) {
    const r = lp.accept(offered.id);
    const c2 = r.caseId && lc.caseById(r.caseId);
    check(r.ok && c2?.investigationId === offered.invId && c2.role === 'defense', 'accepting it takes the same case on');
  }
}

// ---------- A fatal collision: the hospital, the family's claim, the insurer ----------
{
  const p = lawyer('lawyer');
  const L = ls.lawOf(p);
  L.specialty = 'civil_litigation';
  const a = A.agencyOf('municipal', p.countryId, p.city);
  const inv = W.openCase('collision', { ownerId: a.id, truth: 'careless' });
  const f = inv.file;
  const v = store.state.npcs[f.victimId];
  check(v && !v.alive && v.flags.causeOfDeath, 'the person struck died, and the death is on their record');
  check(!f.hospitalId || f.log.some((x) => /died there/.test(x.text)), 'they died in a real hospital of the city');
  f.outcome = { kind: 'convicted', at: core.now() };
  const LO = await import('../js/engine/investigations/local.js');
  LO.settleClaims();
  const cl = LO.claims()[f.claimId];
  check(cl && cl.familyId === f.reportingId && cl.driverId === f.poi[0] && cl.status === 'open', 'when the investigation ends, the family claims against the driver');
  LO.settleClaims();
  check(Object.values(LO.claims()).filter((x) => x.invId === inv.id).length === 1, 'one claim per collision');
  let offer = null;
  for (let i = 0; i < 10 && !offer; i++) { L.window = null; L.offers = []; lp.refreshOpportunities(p); offer = L.offers.find((o) => o.claimId === cl.id); }
  check(offer && /killed by a car/.test(offer.summary), 'a civil litigator is offered the family\'s claim');
  if (offer) {
    const r = lp.accept(offer.id);
    const c = r.caseId && lc.caseById(r.caseId);
    check(c && c.templateId === 'collision_claim' && c.clientId === cl.familyId && c.parties.otherId === cl.driverId, 'the claim is the real family against the real driver');
    check(c?.evidence.some((e) => e.id === 'conviction' && e.favors === 'client') && c.witnesses[0].weakness === 'speed', 'the conviction and the reconstruction are the family\'s evidence');
    check(cl.status === 'with a lawyer' && cl.lawCaseId === c?.id, 'the claim is with the lawyer');
  }
  // An accident nobody could have avoided: nobody takes the claim, and the insurer refuses it after a year.
  const inv2 = W.openCase('collision', { ownerId: a.id, truth: 'accident' });
  inv2.file.outcome = { kind: 'resolved', finding: 'accident', at: core.now() };
  LO.settleClaims();
  const cl2 = LO.claims()[inv2.file.claimId];
  store.state.year += 1;
  LO.settleClaims();
  check(cl2 && cl2.status === 'settled by insurer' && cl2.amount === 0, 'the insurer refuses a claim the investigation found was an unavoidable accident');
}

finish('A case from an investigation is the case its lawyers work, and the court decides it once.');
