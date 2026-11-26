// The legal case engine: persistent cases, clients, evidence, filings, deadlines, the courtroom, verdicts, settlements
// and appeals, and how each specialty differs. Run with: node tests/law-cases.mjs
import { store, rng, ls, lp, lc, k, check, finish, turn, lawyer, playCase, saveGame, loadGame } from './helpers/lawSetup.mjs';
import { CASE_TEMPLATES, SPECIALTIES } from '../js/data/law.js';

rng.seed(20261126);
const npc = (id) => store.state.npcs[id];

// ---------- One of every case: identities, parties, roles, stages ----------
{
  lawyer('lawyer');
  const made = Object.keys(CASE_TEMPLATES).map((id) => lc.createCase(id, { role: CASE_TEMPLATES[id].kind === 'criminal' ? (id === 'theft' ? 'prosecution' : 'defense') : undefined, specialty: 'civil_litigation' }));
  const ids = made.map((c) => c.id);
  check(new Set(ids).size === ids.length && ids.every((id) => lc.caseById(id)), 'every case has its own stable id, kept in the justice world');
  check(made.every((c) => !c.clientId || npc(c.clientId)?.alive), 'every client is a persistent person');
  check(made.filter((c) => c.parties.otherId).every((c) => npc(c.parties.otherId)), 'opposing parties are real people');
  check(made.every((c) => lc.ROLE_NAME[c.role]), 'every lawyer has a valid role');
  check(made.every((c) => c.witnesses.every((w) => npc(w.npcId)) && c.evidence.every((e) => e.id && e.label && typeof e.reliability === 'number')), 'witnesses are people, and evidence items are records');
  check(made.filter((c) => c.forum !== 'none').every((c) => npc(c.judgeId)?.flags.justice?.kind === 'judge'), 'every court case has a judge from the bench');
  check(made.filter((c) => c.kind === 'criminal').every((c) => c.justiceCaseId && k.J().cases[c.justiceCaseId]?.defendantId === c.parties.defendantId), 'a criminal case is the Justice Engine\'s own case, with the same defendant');
  const pros = made.find((c) => c.templateId === 'theft');
  check(pros.role === 'prosecution' && !pros.clientId && k.J().cases[pros.justiceCaseId].prosecutorId === store.state.player.id, 'a prosecutor represents the government, not a client');
  const fam = made.find((c) => c.templateId === 'divorce');
  check(npc(fam.clientId).flags.spouseId === fam.parties.otherId && npc(fam.parties.childId).flags.parentIds.includes(fam.clientId), 'a family case is about a real marriage and a real child');
  const dep = made.find((c) => c.templateId === 'dependency');
  check(dep.role === 'childAttorney' && dep.clientId === dep.parties.childId && !dep.jury && /wishes/.test(lc.researchQuestion(dep).why), 'a child\'s attorney represents the child\'s wishes; a guardian ad litem is a different job');
  const imm = made.find((c) => c.templateId === 'removal');
  check(!imm.jury && imm.forum === 'immigration' && !!npc(imm.clientId).flags.originCountryId, 'immigration court has no jury, and the client comes from a real country');
  const deal = made.find((c) => c.templateId === 'acquisition');
  check(deal.forum === 'none' && !deal.judgeId, 'a transaction has no court');
  const stagesOk = made.every((c) => c.stages.every((s) => typeof s.months === 'number') && c.stages[0].s === 'intake');
  check(stagesOk, 'cases start at intake and move through their own stages');
}

// ---------- The courtroom differs by kind ----------
{
  lawyer('lawyer');
  const phases = (id, role) => { const c = lc.createCase(id, { role }); c.awaiting = { what: 'trial', since: ls.nowM(), turn: ls.nowM() }; return lc.courtroom(c).phases.map((x) => x.id); };
  const crim = phases('burglary_hale', 'defense');
  const immi = phases('removal');
  const deal = phases('supply_deal');
  const fam = phases('custody');
  check(['jury', 'opening', 'objection', 'cross', 'closing'].every((x) => crim.includes(x)), `a jury trial: selection, opening, an objection, cross-examination, closing (${crim})`);
  check(!immi.includes('jury') && !immi.includes('objection'), `immigration court: no jury (${immi})`);
  check(deal.join() === 'closing', `a transaction closes without a trial (${deal})`);
  check(!fam.includes('jury'), `family court: no jury (${fam})`);
  check(new Set([crim.join(), immi.join(), deal.join(), fam.join()]).size >= 3, 'different kinds of case do not share one procedure');
}

// ---------- The demonstration trial: The State v. Morgan Hale ----------
{
  const runs = { good: 0, poor: 0, goodSupp: 0 };
  for (let i = 0; i < 24; i++) {
    lawyer('lawyer');
    const c = lc.createCase('burglary_hale', { role: 'defense', specialty: 'criminal_defense' });
    if (i === 0) {
      check(c.title === 'The State v. Morgan Hale' && c.evidence.map((e) => e.id).join() === 'ident,camera,timeline,drill' && c.jury, 'Morgan Hale: a burglary, with an identification, a camera, a timeline and a disputed drill, before a jury');
      check(lc.interview(c).ok && !lc.interview(c).ok, 'the client is interviewed once');
      lc.review(c);
      check(c.evidence.every((e) => e.reviewed), 'the evidence is reviewed, not made up');
      const rq = lc.researchQuestion(c);
      check(lc.research(c, rq.right).ok && /search/.test(rq.why), 'research finds the search issue');
      const f = lc.file(c, 'strong');
      check(f.filing && ['granted', 'denied'].includes(f.filing.ruling) && !lc.file(c, 'strong').ok, `the motion to suppress is filed once and ruled on (${f.filing.ruling})`);
      const drill = c.evidence.find((e) => e.id === 'drill');
      check(f.filing.ruling !== 'granted' || drill.status === 'excluded', 'a granted motion takes the drill out of the case');
      for (let t = 0; t < 12 && !c.awaiting; t++) turn();
      check(c.awaiting?.what === 'trial' && lc.stageOf(c) === 'trial', 'the case reaches trial as the months pass, and waits for the lawyer');
      const day = lc.courtroom(c);
      const r = lc.argue(c, { jury: 'fair', opening: 'theory', objection: 'hearsay', cross: 'lighting', direct: 'open', closing: 'burden' });
      check(['acquitted', 'convicted'].includes(c.outcome.kind) && r.text.length && day.phases.length >= 5, `a verdict: ${c.outcome.kind}`);
      const jc = k.J().cases[c.justiceCaseId];
      check(jc.verdict && jc.verdict.outcome === c.outcome.kind, 'the Justice Engine records the same verdict');
      check(!lc.argue(c, {}).ok && !lc.close(c, { kind: 'acquitted', text: 'x', favorable: 1 }).ok && ls.lawOf().history.length === 1, 'a verdict resolves once');
      if (c.outcome.kind === 'convicted') check(lc.appealGrounds(c).every((g) => g.id) , 'a conviction can be appealed on its record');
      continue;
    }
    // Many trials, played well or badly: preparation and sound choices help; nothing is guaranteed.
    const good = i % 2 === 0;
    if (good) { lc.interview(c); lc.review(c); lc.research(c, lc.researchQuestion(c).right); lc.file(c, 'strong'); }
    for (let t = 0; t < 12 && !c.awaiting; t++) turn();
    lc.argue(c, good ? { jury: 'fair', opening: 'theory', objection: 'hearsay', cross: 'lighting', direct: 'open', closing: 'burden' }
      : { jury: 'improper', opening: 'overpromise', objection: 'relevance', cross: 'improper', direct: 'leading', closing: 'improper' });
    if (!c.outcome) { check(c.mistrials === 1, 'a trial without a verdict is a hung jury: a mistrial, retried later'); continue; } // neither a win nor a loss
    if (c.outcome.kind === 'acquitted') { if (good) runs.good++; else runs.poor++; }
    if (good && c.evidence.find((e) => e.id === 'drill').status === 'excluded') runs.goodSupp++;
  }
  check(runs.good > runs.poor, `good preparation and advocacy win more acquittals than poor (${runs.good} of 12 against ${runs.poor} of 11)`);
  check(runs.good < 12, `but nothing guarantees an acquittal (${runs.good} of 12)`);
}

// ---------- Filings, deadlines and ethics ----------
{
  lawyer('lawyer');
  const c = lc.createCase('contract_dispute');
  const r = lc.file(c, 'improper');
  check(!r.ok && c.filings[0].ruling === 'struck' && ls.lawOf().rep.integrity < 55, 'a motion with no legal basis is struck, and noticed');
  // A routine filing on time when the lawyer has room.
  const d = lc.createCase('dismissal');
  for (let t = 0; t < 3; t++) turn();
  check(d.filings.some((f) => f.main && f.routine) && d.deadlines[0].met === true, 'with room on the desk, a routine filing meets the deadline');
  // Too much work: a deadline is missed, and it costs.
  lawyer('lawyer');
  const many = Array.from({ length: 6 }, () => lc.createCase('assault', { role: 'defense' }));
  const rel = ls.lawOf().rep.reliability;
  for (let t = 0; t < 8; t++) turn();
  check(many.some((x) => x.deadlines.some((dl) => dl.met === false)) && ls.lawOf().rep.reliability < rel, 'a lawyer far over capacity misses deadlines, and loses reliability');
  const e = lc.createCase('divorce');
  e.ethics = { id: 'conceal', m: ls.nowM() };
  const integ = ls.lawOf().rep.integrity;
  check(lc.resolveEthics(e, 'proper').ok && ls.lawOf().rep.integrity > integ, 'refusing to hide evidence is the right call, and it counts');
  const f2 = lc.createCase('divorce'); f2.ethics = { id: 'conceal', m: ls.nowM() };
  lc.resolveEthics(f2, 'improper');
  check(ls.lawOf().misconduct === 1 && ls.lawOf().rep.integrity < integ && !ls.lawOf().bar.disbarred, 'misconduct is punished in proportion: not disbarment for a first mistake');
}

// ---------- Not every case ends in court ----------
{
  lawyer('lawyer');
  const fam = lc.createCase('divorce', { specialty: 'family' });
  lc.interview(fam); lc.review(fam); lc.research(fam, lc.researchQuestion(fam).right); lc.file(fam, 'strong');
  for (let t = 0; t < 6 && !lc.actions(fam).some((a) => a.id === 'negotiate'); t++) turn();
  const offer = lc.currentOffer(fam);
  const r = lc.negotiate(fam, true);
  check(r.ok !== undefined && fam.outcome?.kind === 'settlement' && /%/.test(offer.text), `a divorce settles without a trial (${offer.text})`);
  check(!lc.negotiate(fam, true).ok && ls.lawOf().history.filter((h) => h.caseId === fam.id).length === 1, 'a settlement resolves once');
  const imm = lc.createCase('family_petition', { specialty: 'immigration' });
  const out = playCase(imm);
  check(['approved', 'denied'].includes(out?.kind) && !imm.jury, `an immigration petition is decided by the agency (${out?.kind})`);
  const deal = lc.createCase('supply_deal', { specialty: 'corporate' });
  const d = playCase(deal);
  check(['closed', 'closed_risk'].includes(d?.kind), `a contract is negotiated and signed, no courtroom (${d?.kind})`);
  const will = lc.createCase('will', { specialty: 'estate' });
  const w = playCase(will);
  check(w && (w.favorable <= 0 || npc(will.clientId).flags.will?.by === store.state.player.id), 'a will drafted for a client is the client\'s will on their record');
}

// ---------- Appeals and reload ----------
{
  lawyer('lawyer');
  let c;
  for (let i = 0; i < 20; i++) {
    c = lc.createCase('contract_dispute');
    c.errors.push({ kind: 'motion', text: 'A motion was wrongly denied.' });
    lc.close(c, { kind: 'judgment_against', text: 'Judgment for the other side.', favorable: -0.5, trial: true });
    if (lc.appealGrounds(c).length) break;
  }
  const g = lc.appealGrounds(c);
  check(g.some((x) => x.id === 'motion'), 'a judgment against the client can be appealed on an error in the record');
  const r = lc.fileAppeal(c, 'motion');
  check(r.ok && c.appeal.of === c.id && c.appeal.judgment === 'judgment_against' && !lc.fileAppeal(c, 'motion').ok, 'the appeal is its own docket, tied to the judgment it reviews, filed once');
  for (let t = 0; t < 3; t++) turn();
  check(['affirmed', 'reversed', 'remanded'].includes(c.appeal.outcome), `decided on the record months later: ${c.appeal.outcome}`);
  const before = JSON.stringify({ cases: lc.LC(), law: store.state.player.law });
  saveGame(store.state);
  store.state = loadGame(store.state.slotId);
  check(JSON.stringify({ cases: lc.LC(), law: store.state.player.law }) === before, 'cases, clients and the record survive a save and reload unchanged');
}

// ---------- The remaining specialties play to an end ----------
{
  lawyer('lawyer');
  const ids = ['police_conduct', 'closing_defect', 'boundary', 'trademark', 'license_deal', 'tax_appeal', 'restructure', 'permit_case', 'appeal_brief'];
  const outs = ids.map((id) => { const c = lc.createCase(id); return [id, c, playCase(c)]; });
  check(outs.every(([, , o]) => o && o.kind), `civil rights, real estate, IP, tax, environmental and appellate cases each reach an outcome (${outs.map(([id, , o]) => `${id}:${o?.kind}`).join(', ')})`);
  const appeal = outs.find(([id]) => id === 'appeal_brief')[1];
  check(['reversed', 'affirmed'].includes(appeal.outcome.kind) && !appeal.jury && appeal.witnesses.length === 0, 'an appeal is decided by a panel on the record: reversed or affirmed, no jury, no witnesses');
  const a2 = lc.createCase('appeal_brief'); a2.awaiting = { what: 'hearing', since: ls.nowM(), turn: ls.nowM() };
  const ph = lc.courtroom(a2).phases.map((x) => x.id);
  check(ph.join() === 'opening,bench,closing', `oral argument, a question from the bench, rebuttal (${ph})`);
  const nb = lc.createCase('boundary');
  check(npc(nb.parties.otherId)?.alive && nb.title.includes(npc(nb.parties.otherId).lastName), 'a boundary dispute is with a real neighbor');
  check(lc.forumName(lc.createCase('tax_appeal')) === 'Tax tribunal', 'a tax appeal goes to the tax tribunal');
}

// ---------- Deeper trials: more objections, mitigation, mistrials, partial judgments, more dilemmas ----------
{
  const { ETHICS } = await import('../js/data/law.js');
  check(ETHICS.length >= 8 && ['gift', 'press', 'coaching', 'billing'].every((id) => ETHICS.some((e) => e.id === id)), 'eight ethical dilemmas, including gifts, the press, coaching witnesses and billing');
  lawyer('lawyer');
  const c = lc.createCase('burglary_hale', { role: 'defense' });
  c.awaiting = { what: 'trial', since: ls.nowM(), turn: ls.nowM() };
  const ph = lc.courtroom(c).phases;
  check(ph.some((x) => x.id === 'objection') && ph.some((x) => x.id === 'objection2') && ph.some((x) => x.id === 'mitigation'), `a jury trial has two moments to object, and a plea in mitigation is made ready (${ph.map((x) => x.id)})`);
  const proper = ph.find((x) => x.id === 'objection2');
  // Find a case whose second question is proper, and object to it anyway.
  let pc = c; let pp = proper;
  for (let i = 0; i < 30 && pp.valid !== 'none'; i++) { pc = lc.createCase('burglary', { role: 'defense' }); pc.awaiting = { what: 'trial', since: ls.nowM(), turn: ls.nowM() }; pp = lc.courtroom(pc).phases.find((x) => x.id === 'objection2'); }
  const r = lc.argue(pc, { objection2: 'hearsay' });
  check(pp.valid === 'none' && /question was proper/.test((r.lines ?? []).join(' ') + r.text), 'objecting to a proper question is overruled, and the jury notices');
  let mis = null; let partial = null; let cut = false;
  for (let i = 0; i < 240 && (!mis || !partial || !cut); i++) { // a hung jury needs proof within a hair of the bar: rare, so look long enough
    lawyer('lawyer');
    const t = lc.createCase(i % 2 ? 'contract_dispute' : 'burglary_hale', { role: i % 2 ? undefined : 'defense' });
    t.awaiting = { what: 'trial', since: ls.nowM(), turn: ls.nowM() };
    // A genuinely close civil case: the evidence on each side weighs the same.
    if (t.kind === 'civil') for (const e of t.evidence) { e.reliability = 70; e.weight = e.favors === 'client' ? 3 : 6; }
    const out = lc.argue(t, { mitigation: 'strong', objection: t.kind === 'criminal' ? 'hearsay' : undefined });
    if (out.mistrial && !mis) mis = t;
    if (t.outcome?.kind === 'partial') partial = t;
    if (t.outcome?.kind === 'convicted' && /mitigation took/.test(out.text)) cut = true;
  }
  check(mis && !mis.done && mis.mistrials === 1 && !lc.courtroom(mis), 'a hung jury: a mistrial, and the retrial waits for its date');
  check(partial && partial.outcome.favorable > 0 && partial.outcome.favorable < 1, 'a close civil trial can end in a partial judgment');
  check(cut, 'a plea in mitigation can take years off a custodial sentence');
}

// ---------- Child welfare: four different jobs ----------
{
  lawyer('lawyer');
  const roles = Object.fromEntries(['childAttorney', 'gal', 'parentAttorney', 'childProtection'].map((r) => [r, lc.createCase('dependency', { role: r })]));
  check(roles.childAttorney.clientId === roles.childAttorney.parties.childId, 'the child\'s attorney acts for the child');
  check(!roles.gal.clientId && roles.gal.parties.wardId === roles.gal.parties.childId && /best interests/.test(lc.researchQuestion(roles.gal).why), 'a guardian ad litem has no client, and advises on best interests');
  check(roles.parentAttorney.clientId === roles.parentAttorney.parties.otherId && /service plan|services/.test(lc.researchQuestion(roles.parentAttorney).why), 'a parent\'s attorney acts for the parent, toward reunification');
  const gov = roles.childProtection;
  check(!gov.clientId && lc.strength(gov).mine > 0 && gov.evidence.filter((e) => e.favors === 'other').length >= 1, 'agency counsel relies on the agency\'s evidence');
  check(new Set(Object.values(roles).map((c) => lc.roleName(c))).size === 4, 'four roles, four names: not one universal "kid lawyer"');
}

// ---------- Fame from a public case ----------
{
  const { fameOf } = await import('../js/engine/fame.js');
  lawyer('lawyer');
  const before = fameOf().audiences.public ?? 0;
  const big = lc.createCase('homicide', { role: 'defense' });
  lc.close(big, { kind: 'acquitted', text: 'Not guilty.', favorable: 1, trial: true });
  const small = lc.createCase('divorce');
  const mid = fameOf().audiences.public;
  lc.close(small, { kind: 'settlement', text: 'Settled.', favorable: 0.5 });
  check(mid > before && fameOf().audiences.public === mid, 'a big public trial makes the lawyer better known; a private settlement does not');
}

// ---------- Procedural filings and their deadlines ----------
{
  lawyer('lawyer');
  const d = lc.createCase('burglary_hale', { role: 'defense' });
  const due = lc.proceduralDue(d).map((x) => x.id);
  check(due.includes('bail') && due.includes('discovery') && d.deadlines.filter((x) => x.proc).every((x) => x.due > ls.nowM() - 1), `a criminal defense has a release motion and a discovery request, each with a deadline (${due})`);
  check(lc.actions(d).some((a) => a.id === 'proc:bail'), 'and each is something the lawyer can prepare');
  const r = lc.fileProcedure(d, 'bail', 'strong');
  check(r.text && d.filings.some((f) => f.proc === 'bail') && !lc.proceduralDue(d).some((x) => x.id === 'bail') && !lc.fileProcedure(d, 'bail', 'strong').ok, `a release motion is filed once (${r.text})`);
  const pr = lc.createCase('theft', { role: 'prosecution' });
  check(lc.proceduralDue(pr).some((x) => x.id === 'disclosure' && x.duty), 'a prosecutor must disclose to the defense');
  const integ = ls.lawOf().rep.integrity;
  lc.fileProcedure(pr, 'disclosure', 'improper');
  check(ls.lawOf().rep.integrity < integ - 5 && pr.errors.some((e) => e.kind === 'disclosure'), 'withholding from disclosure is misconduct, and an error on the record');
  const civ = lc.createCase('injury');
  check(['discovery', 'deposition'].every((x) => lc.proceduralDue(civ).some((y) => y.id === x)), 'a civil case has discovery and a deposition');
  for (let t = 0; t < 3; t++) turn();
  check(civ.filings.filter((f) => f.proc).length === 2 && civ.deadlines.filter((x) => x.proc).every((x) => x.met === true), 'left alone, routine versions go in on time');
  check(new Set(civ.filings.map((f) => f.proc ?? 'main')).size === civ.filings.length, 'no filing twice');
  // An appeal whose notice is missed is dismissed.
  lawyer('lawyer');
  const many = Array.from({ length: 7 }, () => lc.createCase('homicide', { role: 'defense' }));
  const ap = lc.createCase('appeal_brief');
  for (let t = 0; t < 2; t++) turn();
  check(ap.done && /not filed in time/.test(ap.outcome.text), 'a notice of appeal missed by a swamped lawyer ends the appeal');
  void many;
}

// ---------- Cases about the world's own people, papers and companies ----------
{
  const { makeNpc } = await import('../js/engine/npcFactory.js');
  const { residency } = await import('../js/engine/citizenship.js');
  const { placeAt, jobs } = await import('../js/engine/employers.js');
  lawyer('lawyer');
  const me = store.state.player;
  // A married couple living in the world, nothing to do with the player.
  const a = makeNpc({ role: 'official', countryId: me.countryId, age: 41 }); const b = makeNpc({ role: 'official', countryId: me.countryId, age: 43 });
  for (const n of [a, b]) { store.state.npcs[n.id] = n; n.life = { ...(n.life ?? {}), married: true }; }
  a.life.partnerId = b.id; b.life.partnerId = a.id;
  let div = null;
  for (let i = 0; i < 20 && !div; i++) { const c = lc.createCase('divorce'); if (c.realCouple) div = c; }
  check(div && [a.id, b.id].includes(div.clientId) && [a.id, b.id].includes(div.parties.otherId), 'a divorce can be a real marriage in the world');
  lc.close(div, { kind: 'settlement', text: 'Settled.', favorable: 0.5 });
  check(!a.life.married && !b.life.married && !a.life.partnerId, 'and the decree ends that marriage on both their records');
  const rem = lc.createCase('removal');
  const cl = npc(rem.clientId);
  check(residency(cl).status === 'temporary_resident' && !residency(cl).workAuthorized === false || residency(cl).status === 'temporary_resident', `a removal client has real papers: ${residency(cl).status}, a citizen of ${cl.citizenships[0].jurisdictionId}`);
  lc.close(rem, { kind: 'approved', text: 'Relief granted.', favorable: 1 });
  check(residency(cl).status === 'permanent_resident', 'relief makes them a permanent resident, in the citizenship engine\'s own record');
  const pet = lc.createCase('family_petition');
  const rel = npc(pet.parties.relativeId);
  check(rel && rel.countryId !== me.countryId, 'a family petition is for a real relative living abroad');
  lc.close(pet, { kind: 'approved', text: 'Approved.', favorable: 1 });
  check(rel.countryId === me.countryId && residency(rel).status === 'permanent_resident', 'approved: the relative comes to live here, as a permanent resident');
  for (const id of ['lawyer', 'engineer', 'scientist', 'journalist']) placeAt(id, me.countryId, me.city);
  const acq = lc.createCase('acquisition');
  const buyer = jobs().employers[acq.parties.clientOrgId]; const target = jobs().employers[acq.parties.otherOrgId];
  check(buyer && target && acq.title.includes(buyer.name), `a corporate deal is between real companies (${acq.title})`);
  lc.close(acq, { kind: 'closed', text: 'Closed.', favorable: 1 });
  check(target.owner === buyer.id && buyer.history.some((h) => h.text.includes(target.name)), 'and the acquisition goes into both companies\' histories');
  const dead = makeNpc({ role: 'official', countryId: me.countryId, age: 80 }); store.state.npcs[dead.id] = dead; dead.alive = false; dead.flags.diedYear = store.state.year;
  const pro = lc.createCase('probate');
  const who = npc(pro.parties.deceasedId);
  check(who && !who.alive && who.flags.diedYear >= store.state.year - 2 && pro.title.includes(who.lastName), `probate settles the estate of someone who really died (${who?.firstName} ${who?.lastName})`);
}

// ---------- Contingency fees follow the law of the country and the kind of case ----------
{
  const model = (country, tid, fee = 'contingency') => { lawyer('lawyer', { countryId: country }); return lc.createCase(tid, { fee }); };
  const us = model('us', 'injury');
  check(us.fee.model === 'contingency' && lc.contingencyRule('injury', 'us').share === 0.33, 'in the US a personal injury claim can be taken for a third of the award');
  check(lc.contingencyRule('injury', 'uk').share === 0.25 && lc.contingencyRule('dismissal', 'uk').share === 0.35, 'in England the share is capped: 25% for injury, 35% for employment');
  check(model('au', 'injury').fee.model === 'hourly' && model('in', 'injury').fee.model === 'hourly', 'in Australia and India a share of the damages is not allowed: billed by the hour');
  check(model('us', 'divorce').fee.model === 'hourly' && !lc.contingencyRule('burglary', 'us').allowed, 'never in a divorce or a criminal case');
  check(model('mx', 'injury').fee.model === 'hourly' && /Not modeled/.test(lc.contingencyRule('injury', 'mx').why), 'where the rules are not modeled, the game does not assume them');
  lawyer('lawyer', { countryId: 'us' });
  const win = lc.createCase('injury', { fee: 'contingency' });
  lc.close(win, { kind: 'judgment', text: 'Judgment.', favorable: 1, trial: true, amount: 90000 });
  check(win.fee.amount === Math.round(90000 * 0.33), `the fee is the lawful share of the award, once (${win.fee.amount})`);
}

// ---------- Specialties are honest ----------
{
  const playable = SPECIALTIES.filter((s) => s.playable);
  check(playable.every((s) => s.cases.length && s.cases.every((id) => CASE_TEMPLATES[id])), 'every playable specialty has real cases');
  check(SPECIALTIES.filter((s) => !s.playable).every((s) => !s.cases.length), 'specialties without cases are not called playable');
}

// One button for the routine steps; the choices that matter stay with the player.
{
  lawyer('lawyer');
  const c = lc.createCase('divorce');
  check(lc.hasRoutine(c), 'a new case has routine steps waiting');
  const r = lc.routine(c);
  check(r.ok && c.tasks.interview && c.tasks.review && !lc.hasRoutine(c), `the routine steps are done in one go (${r.text})`);
  check(!c.research && !c.filings.some((f) => f.main), 'research and the main filing are left to the player');
  const c2 = lc.createCase('contract_dispute');
  const all = lc.routineAll();
  check(all.ok && c2.tasks.review, 'every open case at once');
}

finish('The legal case engine holds.');
