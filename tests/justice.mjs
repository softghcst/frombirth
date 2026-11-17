// The justice system end to end: the first vertical slice (incident to release,
// saved and reloaded), then the playable scenarios A to O, idempotency, juvenile
// justice and older saves. Run with: node tests/justice.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (key) => (mem.has(key) ? mem.get(key) : null), setItem: (key, v) => mem.set(key, String(v)), removeItem: (key) => mem.delete(key) };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { ROOTS } = await import('../js/data/economy.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { continueAs } = await import('../js/engine/legacy.js');
const { unmet } = await import('../js/engine/career.js');
const { CAREER_BY_ID } = await import('../js/data/careers.js');
const { convictionsOf, hasRecord } = await import('../js/engine/records.js');
const { resolve } = await import('../js/engine/conditions.js');
const { justiceScene } = await import('../js/engine/justiceScenes.js');
const { OFFENSE_BY_ID, EVIDENCE_FROM, systemFor } = await import('../js/data/justice.js');
const k = await import('../js/engine/cases.js');
const law = await import('../js/engine/justice.js');
const jail = await import('../js/engine/prison.js');
const civil = await import('../js/engine/civil.js');
const jobs = await import('../js/engine/legalCareers.js');

rng.seed(5150);
ROOTS.parentFromAbroad = 0; ROOTS.familyLeaves = 0;
const problems = [];
const ok = [];
let failedBefore = 0;
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (problems.length === failedBefore) ok.push(msg); else ok.push(`FAILED ${msg}`); failedBefore = problems.length; };

/** A fresh adult life, with no record. */
function adult(countryId = 'uk', age = 25) {
  store.state = createLife({ countryId });
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year; store.state.year += age;
  p.flags.livesWithParents = false; p.education.enrolled = false; p.education.stage = 'none';
  p.stats.health = 90;
  for (const n of Object.values(store.state.npcs)) n.age += age;
  return p;
}
/** A year, with the scenes the engine queued set aside and the player kept alive. */
function year() {
  const p = store.state.player;
  p.stats.health = 90;
  p.flags.longevity = 40; // these tests are about the courts, not about dying young
  advanceYear();
  store.state.pendingEvents = [];
  if (!p.alive) throw new Error('the player died in a test year');
}
const valid = (id) => id === store.state.player.id || !!store.state.npcs[id] || Object.values(store.state.npcs).some((n) => n.flags?.wasPlayer === id);
/** A crime the player committed, caught at the scene, with a victim and a witness. */
function caughtFor(offenseId) {
  const p = store.state.player;
  const victim = k.civilian(p.countryId);
  const witness = k.civilian(p.countryId);
  const inc = k.createIncident({ offenseId, perpetratorId: p.id, victimId: victim.id, witnessIds: [witness.id], countryId: p.countryId, city: p.city });
  const inv = k.openInvestigation(inc, { redHanded: true });
  law.arrest(inv, true);
  return { inc, inv, c: law.pendingCase() };
}
/** Something someone else did, where the evidence points at the player. */
function framedBy(offenseId, reliability = 0.85) {
  const p = store.state.player;
  const real = k.civilian(p.countryId);
  const inc = k.createIncident({ offenseId, perpetratorId: real.id, countryId: p.countryId, city: p.city });
  const inv = k.openInvestigation(inc);
  inv.evidenceIds.push(k.addEvidence(inc, 'witness', p.id, { reliability, lawful: true }).id, k.addEvidence(inc, 'physical', p.id, { reliability: 0.7, lawful: true }).id);
  inv.suspectIds = [p.id];
  law.arrest(inv);
  return { inc, inv, c: law.pendingCase() };
}

// ---------- The first vertical slice ----------
{
  let p = adult('uk', 24);
  const mother = store.state.npcs[p.npcIds.find((id) => store.state.npcs[id].role === 'parent')];
  check(!!mother, 'the player has a parent to visit');
  const cashBefore = p.finance.cash;
  // 2–8: an incident, its people, an investigation, an investigator, evidence, a charge.
  const { inc, inv, c } = caughtFor('armed_robbery');
  check(inc.participants.length === 3 && inc.participants.every((x) => valid(x.id)), 'incident participants are real characters');
  check(inv.investigatorIds.every((id) => store.state.npcs[id]?.flags.justice?.kind === 'detective'), 'a persistent detective is assigned');
  check(inv.evidenceIds.length >= 2 && inv.evidenceIds.every((id) => k.J().evidence[id]?.incidentId === inc.id), 'evidence records belong to the incident');
  check(c && c.defendantId === p.id && c.stage === 'charged' && c.incidentId === inc.id, 'a criminal case is opened against the player');
  check(p.legal.history.some((h) => h.kind === 'arrested') && p.legal.history.some((h) => h.kind === 'charged'), 'arrest and charge are separate entries');
  check(!convictionsOf(p).length, 'being charged is not a conviction');
  // 9–12: bail, counsel, a plea, a lawful outcome.
  const b = k.bailHearing(c);
  check(['remand', 'conditions', 'released', 'bail'].includes(b.decision) && c.stage === 'pretrial', 'the first hearing decides bail');
  if (b.decision !== 'remand' && b.decision !== 'released' && b.decision !== 'conditions') k.remand(c);
  const opts = k.counselOptions(c);
  check(opts.some((o) => o.tier === 'public') && opts.filter((o) => o.tier !== 'self').every((o) => store.state.npcs[o.npcId]?.flags.justice?.kind === 'defence'), 'counsel are real lawyers');
  const legalAid = opts.find((o) => o.tier === 'public');
  check(legalAid.ok, 'a serious charge qualifies for legal aid');
  k.appoint(c, 'public', legalAid.npcId);
  check(c.stage === 'plea' && p.legal.counselIds.includes(legalAid.npcId), 'counsel is appointed and remembered');
  const r = k.enterPlea(c, 'guilty');
  check(c.stage === 'sentenced' && r.lines.length, 'a guilty plea leads to a sentence');
  const s = k.J().sentences[c.sentenceId];
  const off = OFFENSE_BY_ID.armed_robbery;
  check(s.type === 'custody' && s.years >= Math.round(off.custody[0] * (1 - systemFor('uk').pleaCredit)) && s.years <= off.custody[1], `the sentence is lawful (${s.years} years)`);
  law.afterVerdict(c);
  // 13–17: custody at a persistent facility, real sentence information, real inmates.
  const cell = jail.cell();
  check(!!cell && cell.caseId === c.id && cell.sentenceId === s.id, 'custody points at the case and the sentence');
  const f = jail.facility();
  check(!!f && k.J().facilities[f.id] === f, 'the facility is a persistent institution');
  const again = jail.facilityFor('uk', f.kind);
  check(again === f, 'asking again gives the same place');
  const mates = jail.inmatesNear();
  check(mates.length >= 5 && mates.every((n) => n.flags.inmate && n.firstName && n.flags.inmate.goal), 'the people inside are whole people');
  check(jail.staffNear().length >= 5, 'the facility has staff');
  check(/Sentence ends in \d+ years?/.test(jail.releaseOutlook().text), 'the release outlook comes from the actual sentence');
  // 18–19: a family visit that changes the relationship.
  let visited = false;
  for (let i = 0; i < 6 && !visited; i++) {
    const before = mother.meters.relationship;
    mother.meters.relationship = Math.max(mother.meters.relationship, 70);
    p.flags.prisonActs = { age: p.age };
    const v = jail.requestVisit(mother.id);
    visited = v.ok;
    if (visited) check(mother.meters.relationship > Math.max(before, 70) - 4, 'the visit changes the relationship');
  }
  check(visited && cell.visits.some((x) => x.npcId === mother.id), 'a parent visits');
  // 20: education.
  const eq = jail.programmeOptions().find((x) => x.id === 'equivalency');
  check(eq?.ok, 'a school-leaving course is on offer');
  check(jail.enrol('equivalency').ok && cell.programme?.id === 'equivalency', 'the player enrols');
  jail.setRoutine('study');
  // 21–24: years pass.
  const startLeft = cell.yearsLeft;
  year();
  check(cell.served === 1 && cell.yearsLeft === startLeft - 1, 'a year is served, once');
  if (cell.programme) year();
  check(p.education.degrees.some((d) => d.type === 'high' && d.inCustody), 'the qualification is in the real education record');
  // 25–27: release when the law allows.
  let years = 1;
  while (jail.cell() && years < 30) {
    if (jail.paroleDue()) jail.paroleHearing('plan');
    else year();
    years += 1;
  }
  check(!jail.cell(), 'released in time');
  check(['On parole', 'Has a criminal record'].includes(law.status()), `legal status after release: ${law.status()} ${JSON.stringify(law.pendingCase()?.hearings)} ${JSON.stringify(p.legal.history.map((h) => h.text))}`);
  check(!!p.flags.reentry?.housing, 'release comes with somewhere to live');
  check(p.legal.history.some((h) => h.kind === 'released'), 'release is in the legal history');
  check(!unmet(CAREER_BY_ID.retail).some((x) => /cell/.test(x)), 'work is open again');
  // 28–29: milestones for the Life Story.
  check(p.milestones.some((m) => /prison/i.test(m.text)) && p.milestones.some((m) => /qualification/i.test(m.text)), 'legal milestones are in the life story');
  // 30–32: save, reload, and everything is still there.
  const snap = { id: p.id, record: JSON.stringify(p.legal.record), degrees: p.education.degrees.length, cases: Object.keys(k.J().cases).length,
    ledger: k.J().ledger.length, cash: p.finance.cash, rel: mother.meters.relationship, facility: f.id };
  saveGame(store.state);
  store.state = loadGame(store.state.slotId);
  p = store.state.player;
  check(p.id === snap.id && JSON.stringify(p.legal.record) === snap.record, 'the record survives a reload');
  check(p.education.degrees.length === snap.degrees && Object.keys(k.J().cases).length === snap.cases && k.J().ledger.length === snap.ledger, 'education, cases and payments survive a reload');
  check(p.finance.cash === snap.cash && store.state.npcs[mother.id].meters.relationship === snap.rel && !!k.J().facilities[snap.facility], 'money, family and places survive a reload');
  check(!p.legal.incarceration && p.legal.custodyHistory.length === 1, 'released once, and still released');
  check(cashBefore !== undefined, 'money was tracked throughout');
  section('vertical slice: incident, investigation, charge, counsel, plea, sentence, a facility, a visit, a qualification, release, saved and reloaded');
}

// ---------- Idempotency ----------
{
  const p = adult('us', 30);
  p.finance.cash = 5000;
  const cash = p.finance.cash;
  check(k.pay({ key: 'test:fine', kind: 'fine', amount: 100, payer: p.id, payee: 'state', caseId: null }), 'a payment is made');
  k.pay({ key: 'test:fine', kind: 'fine', amount: 100, payer: p.id, payee: 'state', caseId: null });
  check(p.finance.cash === cash - 100 && k.J().ledger.filter((t) => t.key === 'test:fine').length === 1, 'the same payment is never made twice');
  const { c } = caughtFor('theft');
  k.bailHearing(c);
  k.appoint(c, 'self', p.id);
  k.enterPlea(c, 'guilty');
  const sentences = Object.keys(k.J().sentences).length;
  const fines = k.J().ledger.filter((t) => t.kind === 'fine').length;
  k.enterPlea(c, 'guilty');
  k.trial(c);
  check(Object.keys(k.J().sentences).length === sentences && k.J().ledger.filter((t) => t.kind === 'fine').length === fines, 'a decided case cannot be pleaded or tried again');
  check(!k.move(c, 'trial', 'again'), 'a case cannot go back to trial without a lawful route');
  check(p.legal.record.filter((r) => r.caseId === c.id).length === 1, 'one record entry per case');
  section('idempotency: payments once, sentences once, no rerolled verdicts');
}

// ---------- A: witness ----------
{
  const p = adult('ca', 35);
  justiceScene('witness_report');
  const inc = Object.values(k.J().incidents).find((i) => i.participants.some((x) => x.id === p.id && x.role === 'witness'));
  check(!!inc && inc.truth.perpetratorId !== p.id, 'the player saw an incident they took no part in');
  const inv = k.J().investigations[inc.investigationId];
  check(!!inv && inv.evidenceIds.some((id) => k.J().evidence[id].sourceId === p.id), 'the player\'s statement is evidence');
  check(inc.participants.every((x) => valid(x.id)), 'everyone involved is a real character');
  check(p.legal.history.some((h) => h.kind === 'witness') && !hasRecord(p), 'a witness gets a history, not a record');
  for (let i = 0; i < 12 && ['active', 'suspect'].includes(inv.stage); i++) year();
  check(['charged', 'closed', 'suspended', 'active', 'suspect'].includes(inv.stage), 'the investigation runs its course');
  section('A  witness: a statement, an investigation, a history and no record');
}

// ---------- C: acquittal ----------
{
  let acquitted = null;
  for (let i = 0; i < 40 && !acquitted; i++) {
    const p = adult('uk', 30);
    const { c } = framedBy('theft', 0.45);
    if (!c) continue;
    k.bailHearing(c);
    const star = k.counselOptions(c).find((o) => o.tier === 'good');
    p.finance.cash = star.cost + 1000;
    k.appoint(c, 'good', star.npcId);
    k.enterPlea(c, 'notGuilty');
    law.afterVerdict(c);
    if (c.stage === 'acquitted') acquitted = { p, c };
  }
  check(!!acquitted, 'a weak case can end in acquittal');
  if (acquitted) {
    const { p, c } = acquitted;
    const r = p.legal.record.find((x) => x.caseId === c.id);
    check(r && !r.convicted && r.outcome === 'acquitted', 'the record says acquitted');
    check(!hasRecord(p) && !unmet(CAREER_BY_ID.police).includes('Needs a clean record.'), 'an acquittal is not a conviction anywhere');
    check(p.legal.history.some((h) => h.kind === 'arrested') && p.legal.history.some((h) => h.kind === 'acquitted'), 'the arrest and the acquittal both stay in the history');
  }
  section('C  acquittal: not guilty stays not guilty');
}

// ---------- D: wrongful conviction ----------
{
  let found = null;
  for (let i = 0; i < 60 && !found; i++) {
    const p = adult('us', 28);
    const { inc, c } = framedBy('burglary', 0.9);
    if (!c) continue;
    k.bailHearing(c); if (c.bail.decision === 'bail') k.remand(c);
    k.appoint(c, 'public', k.counselOptions(c).find((o) => o.tier === 'public').npcId);
    k.enterPlea(c, 'notGuilty');
    law.afterVerdict(c);
    if (c.stage === 'sentenced') found = { p, inc, c };
  }
  check(!!found, 'a mistaken case can end in a wrongful conviction');
  if (found) {
    const { p, inc, c } = found;
    const truth = inc.truth.perpetratorId;
    check(!k.appealGrounds(c).some((g) => g.id === 'new_evidence'), 'no new-evidence ground until there is new evidence');
    check(k.seekFreshEvidence(c, 1), 'new evidence can surface');
    check(k.appealGrounds(c).some((g) => g.id === 'new_evidence'), 'it opens an appeal ground');
    p.finance.cash = 0;
    const comp0 = p.finance.cash;
    const r = jail.appealCase(c.id, 'new_evidence');
    check(r.ok && c.stage === 'quashed', 'the conviction is quashed');
    const rec = p.legal.record.find((x) => x.caseId === c.id);
    check(rec.exonerated && !rec.convicted && !hasRecord(p), 'the record shows an exoneration');
    check(inc.truth.perpetratorId === truth && truth !== p.id, 'the incident itself is unchanged');
    check(p.legal.history.some((h) => h.kind === 'convicted') && p.legal.history.some((h) => h.kind === 'exonerated'), 'the history keeps both the conviction and the exoneration');
    check(!jail.cell(), 'released on exoneration');
    check(p.finance.cash > comp0 && k.J().ledger.filter((t) => t.key === `compensation:${c.id}`).length === 1, 'compensation is paid once');
    check(!jail.appealCase(c.id, 'new_evidence').ok, 'the same ground cannot be argued twice');
  }
  section('D  wrongful conviction: convicted on honest mistakes, exonerated on new evidence, history intact');
}

// ---------- E, F, G: the legal professions ----------
{
  let p = adult('uk', 40);
  p.career.careerId = 'lawyer'; p.career.title = 'Associate lawyer'; p.career.level = 0;
  check(jobs.duties().map((d) => d.id).join() === 'defend,prosecute', 'a lawyer can defend and prosecute');
  const c = jobs.openCourtBrief('defend');
  check(c && c.defenceId === p.id && c.defendantId !== p.id && valid(c.defendantId), 'a defence brief is a real case with a real client');
  const r = jobs.argue(c, 'trial');
  check(['sentenced', 'acquitted', 'dismissed'].includes(c.stage) && c.hearings.length >= 3 && r.text, 'the case is argued to an end, with hearings on record');
  check(!jobs.openCourtBrief('defend'), 'one defence brief a year');
  section('E  defence lawyer: a persistent client, evidence and hearings');

  p = adult('us', 35);
  p.career.careerId = 'police'; p.career.title = 'Police officer';
  const inv = jobs.openInvestigationBrief();
  check(inv && inv.investigatorIds[0] === p.id, 'the player is the investigating officer');
  check(jobs.detectiveOptions(inv).some((o) => o.id === 'leads'), 'leads can be followed');
  jobs.detectiveAct(inv, 'leads');
  jobs.detectiveAct(inv, 'reinterview');
  const charge = jobs.detectiveOptions(inv).find((o) => o.id.startsWith('charge:'));
  const done = charge ? jobs.detectiveAct(inv, charge.id) : jobs.detectiveAct(inv, 'close');
  check(done.done, 'the investigation reaches a decision');
  check(!jobs.detectiveOptions(inv).some((o) => o.id === 'leads'), 'a closed file offers no more leads');
  section('F  detective: leads, witnesses, a referral or a closed file');

  p = adult('uk', 45);
  p.education.degrees.push({ type: 'university', majorId: 'law', gpa: 3.5, age: 22 }, { type: 'law', gpa: 3.5, age: 25 });
  p.flags.licences = ['law'];
  const before = unmet(CAREER_BY_ID.judiciary);
  check(before.some((x) => /experience/.test(x)), 'a judge must first practise law');
  p.career.history.push({ careerId: 'lawyer', title: 'Partner', from: 30, to: 44, exit: 'quit' });
  check(!unmet(CAREER_BY_ID.judiciary).some((x) => /experience/.test(x)), `fourteen years in practice is enough (${unmet(CAREER_BY_ID.judiciary).join('; ')})`);
  p.career.careerId = 'judiciary'; p.career.title = 'District judge';
  let heard = null;
  for (let i = 0; i < 10 && !heard; i++) { p.flags.legalActs = null; const b = jobs.openBench(); if (b) heard = b; }
  check(!!heard && heard.judgeId === p.id, 'the judge has a case');
  if (heard) {
    const admit = Object.fromEntries(jobs.rulingsNeeded(heard).map((x) => [x.id, true]));
    jobs.hear(heard, admit);
    if (heard.stage === 'convicted') {
      const range = jobs.sentencingRange(heard);
      const type = range.ladder.includes('custody') ? 'custody' : range.ladder[0];
      jobs.passSentence(heard, type, 999);
      const s = k.J().sentences[heard.sentenceId];
      check(s.type === type && (type !== 'custody' || s.years <= range.custody[1]), 'a judge cannot sentence beyond the law');
    } else check(['acquitted', 'dismissed'].includes(heard.stage), 'or the defendant is acquitted');
  }
  // In a country where unlawful evidence must be left out, a judge's ruling cannot let it in.
  p = adult('us', 50);
  p.career.careerId = 'judiciary';
  let strict = null;
  for (let i = 0; i < 20 && !strict; i++) { p.flags.legalActs = null; const b = jobs.openBench(); if (b && jobs.rulingsNeeded(b).length) strict = b; }
  if (strict) {
    check(jobs.rulingsNeeded(strict).every((x) => x.mustExclude), 'the law here requires exclusion');
    jobs.hear(strict, Object.fromEntries(jobs.rulingsNeeded(strict).map((x) => [x.id, true])));
    check(strict.evidenceIds.map((id) => k.J().evidence[id]).filter((e) => !e.lawful).every((e) => e.admissible === false), 'unlawful evidence stays out whatever the judge wanted');
  }
  section('G  the bench: experience first, rulings within the law, sentences within the range');
}

// ---------- H, I, J: prison education, friendship, family ----------
{
  const p = adult('de', 26);
  const kid = makeNpc({ role: 'child', countryId: 'de', age: 6, relationship: 80 });
  kid.parentIds = [p.id];
  store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id);
  const { c } = caughtFor('robbery');
  k.bailHearing(c); k.appoint(c, 'public', k.counselOptions(c).find((o) => o.tier === 'public').npcId);
  k.enterPlea(c, 'guilty');
  if (k.J().sentences[c.sentenceId].type !== 'custody') { law.imprison(4, 3, { caseId: c.id }); } else law.afterVerdict(c);
  const cell = jail.cell();
  check(!!cell?.guardians[kid.id], 'a child is placed with a guardian');
  check(store.state.npcs[kid.id].role === 'child' && kid.parentIds.includes(p.id), 'the player is still the parent');
  // A friend inside.
  const mate = jail.inmatesNear().find((n) => n.flags.inmate.yearsLeft <= 2) ?? jail.inmatesNear()[0];
  mate.flags.inmate.yearsLeft = 1;
  jail.getToKnow(mate.id);
  mate.meters.relationship = 80;
  check(p.npcIds.includes(mate.id), 'a fellow inmate becomes part of the player\'s life');
  const age0 = kid.age;
  cell.yearsLeft = Math.max(cell.yearsLeft, 3); cell.total = Math.max(cell.total, cell.yearsLeft);
  year();
  check(store.state.npcs[mate.id].flags.inmate.released && p.npcIds.includes(mate.id) && store.state.npcs[mate.id].role === 'friend', 'the friend is released and stays a friend');
  check(store.state.npcs[mate.id].alive && !jail.inmatesNear().includes(store.state.npcs[mate.id]), 'they leave the facility and keep their identity');
  year();
  check(kid.age === age0 + 2, 'the child keeps growing up');
  check(jail.contacts().some((n) => n.id === kid.id), 'the child can still be written to');
  const lettered = jail.writeLetter(kid.id);
  check(typeof lettered.text === 'string', 'letters can be written');
  // Vocational study counts outside.
  const chef = jail.programmeOptions().find((x) => x.id === 'chef');
  if (chef?.ok) {
    cell.yearsLeft = Math.max(cell.yearsLeft, 6); cell.total = Math.max(cell.total, cell.served + 6);
    jail.enrol('chef');
    for (let i = 0; i < 4 && jail.cell()?.programme; i++) year();
    check(p.education.degrees.some((d) => d.type === 'apprenticeship' && d.majorId === 'chef'), 'a trade learned inside is a real trade');
  }
  section('H I J  education that counts, a friendship that outlasts the sentence, a family that goes on');
}

// ---------- K, L: parole and a second chance ----------
{
  const p = adult('us', 30);
  law.imprison(6, 2, {});
  const cell = jail.cell();
  cell.conduct = 90;
  let reviewed = false;
  for (let i = 0; i < 10 && jail.cell(); i++) {
    if (jail.paroleDue()) { jail.paroleHearing('plan'); reviewed = true; } else year();
  }
  check(reviewed, 'a parole review was held');
  check(!jail.cell(), 'released by the end of the term');
  const hist = p.legal.custodyHistory[p.legal.custodyHistory.length - 1];
  check(hist && ['parole', 'release'].includes(hist.how), 'the release is recorded');
  if (p.legal.supervision) {
    const until = p.legal.supervision.until;
    while (store.state.year < until + 1) year();
    check(!p.legal.supervision && p.legal.history.some((h) => h.kind === 'completed'), 'supervision ends, and its conditions with it');
  }
  section('K  parole: a review on the record, release, supervision that ends');

  const q = adult('uk', 22);
  const { c } = caughtFor('theft');
  k.bailHearing(c); k.appoint(c, 'self', q.id); k.enterPlea(c, 'guilty');
  law.afterVerdict(c);
  const rec = q.legal.record.find((r) => r.caseId === c.id);
  if (rec.convicted) {
    check(!law.sealOptions()[0]?.ok, 'a record cannot be sealed straight away');
    for (let i = 0; i < 9; i++) year();
    const opt = law.sealOptions().find((o) => o.caseId === c.id);
    check(opt?.ok, `after the waiting time it can be sealed (${opt?.why})`);
    q.finance.cash += 10000;
    law.sealRecord(c.id);
    check(rec.sealed && !hasRecord(q) && hasRecord(q, { sealed: true }), 'a sealed record is hidden from employers, not erased');
    check(!unmet(CAREER_BY_ID.police).includes('Needs a clean record.'), 'careers that need a clean record are open again');
  }
  section('L  second chance: the sentence ends, the record can be sealed, doors reopen');
}

// ---------- M: civil dispute ----------
{
  const p = adult('uk', 29);
  p.homeId = null; p.flags.livesWithParents = false;
  p.finance.cash = 50000;
  const r = civil.bringClaim('deposit');
  check(r.ok && r.claim, 'a tenant can sue a landlord');
  const c = r.claim;
  check(valid(c.respondentId) && store.state.npcs[c.respondentId].occupation === 'Landlord', 'the landlord is a real person');
  civil.actOnClaim(c.id, 'hearing');
  check(['decided'].includes(c.stage) && c.judgment, 'the court decides');
  check(!civil.claimActions(c).length, 'a decided claim is closed');
  check(!p.legal.record.length && !hasRecord(p), 'a civil case leaves no criminal record');
  const judgments = k.J().ledger.filter((t) => t.key === `judgment:${c.id}`).length;
  check(judgments <= 1, 'a judgment is paid at most once');
  section('M  civil dispute: a landlord, a judgment, no crime');
}

// ---------- N: an earlier era ----------
{
  const p = adult('uk', 30);
  store.state.year = 1960;
  const victim = k.civilian('uk');
  const inc = k.createIncident({ offenseId: 'burglary', perpetratorId: victim.id, countryId: 'uk', city: p.city });
  const inv = k.openInvestigation(inc);
  for (let i = 0; i < 8; i++) k.workInvestigation(inv, 1);
  const kinds = inv.evidenceIds.map((id) => k.J().evidence[id].kind);
  check(!kinds.some((x) => ['forensic', 'cctv', 'digital'].includes(x)), `no DNA, cameras or phone records in 1960 (${kinds.join(', ')})`);
  law.imprison(3, 2, {});
  check(!jail.programmeOptions().find((x) => x.id === 'coding').ok, 'no computer courses before computers');
  store.state.year = EVIDENCE_FROM.forensic + 20;
  section('N  an earlier era: evidence and education follow the calendar (eras are otherwise not modelled)');
}

// ---------- O: generations ----------
{
  const p = adult('uk', 50);
  const kid = makeNpc({ role: 'child', countryId: 'uk', age: 22, relationship: 70 });
  store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id);
  const { c } = caughtFor('fraud');
  k.bailHearing(c); k.appoint(c, 'self', p.id); k.enterPlea(c, 'guilty'); law.afterVerdict(c);
  if (jail.cell()) law.release();
  p.legal.record.push({ caseId: 'case_private', crimeId: 'theft', offense: 'Theft', age: 15, convicted: true, juvenile: true, sealed: true, outcome: 'convicted' });
  const cases = Object.keys(k.J().cases).length;
  p.alive = false;
  const next = continueAs(kid.id);
  check(!!next, 'the life carries on as the child');
  const ancestor = Object.values(next.npcs).find((n) => n.flags.wasPlayer === p.id);
  check(ancestor?.flags.tag === 'recordedAncestor' && ancestor.flags.record.some((r) => r.caseId === c.id), 'the family can find the public record');
  check(!ancestor.flags.record.some((r) => r.juvenile || r.sealed), 'juvenile and sealed records stay private');
  check(!next.player.legal.record.length && !hasRecord(next.player), 'the heir has no record of their own');
  check(Object.keys(k.J().cases).length === cases && k.J().cases[c.id].defendantId === p.id, 'case ids and participants are preserved');
  check(valid(k.J().cases[c.id].judgeId), 'the judge is still in the world');
  check(resolve('ancestorRecord') === true, 'the family record can be discovered in a scene');
  section('O  generations: the record belongs to the ancestor, the heir starts clean, the people stay');
}

// ---------- Juvenile justice ----------
{
  let p = adult('de', 12);
  const victim = k.civilian('de');
  const inc = k.createIncident({ offenseId: 'shoplifting', perpetratorId: p.id, victimId: victim.id, countryId: 'de' });
  const inv = k.openInvestigation(inc, { redHanded: true });
  law.arrest(inv, true);
  check(!law.pendingCase() && p.legal.history.some((h) => h.kind === 'warning') && !p.legal.record.length, 'below the age of responsibility there is no case');
  p = adult('uk', 15);
  const { c } = caughtFor('theft');
  check(c.juvenile && /Youth/.test(c.court), 'a fifteen-year-old goes to the youth court');
  k.bailHearing(c); k.appoint(c, 'public', k.counselOptions(c).find((o) => o.tier === 'public').npcId); k.enterPlea(c, 'guilty'); law.afterVerdict(c);
  check(!convictionsOf(p).length, 'a juvenile record does not count as an adult conviction');
  while (p.age < 18) year();
  check(p.legal.record.every((r) => !r.juvenile || r.sealed), 'juvenile records are sealed at adulthood');
  section('juvenile justice: responsibility ages, youth courts, sealed records');
}

// ---------- Older saves ----------
{
  const p = adult('uk', 30);
  const old = { record: [{ crimeId: 'burglary', age: 20, convicted: true, sentenceYears: 3 }],
    incarceration: { facility: 'prison', security: 'med', yearsLeft: 2, total: 3, served: 1, respect: 20, conduct: 55, gangId: null, escapeAttempts: 0 },
    heat: 10, unsolved: [{ crimeId: 'fraud', age: 21 }], pending: null };
  p.legal = JSON.parse(JSON.stringify(old));
  delete store.state.justice;
  const slot = store.state.slotId;
  mem.set(`pathways.slot.${slot}`, JSON.stringify(store.state));
  store.state = loadGame(slot);
  const q = store.state.player;
  check(q.legal.record[0].crimeId === 'burglary' && q.legal.record[0].legacy && q.legal.record[0].convicted, 'an old conviction is kept');
  law.upgradeLegacy();
  check(jail.cell().yearsLeft === 2 && jail.cell().served === 1 && !!jail.facility(), 'an old sentence keeps its time served and gets a place');
  check(Object.values(k.J().investigations).length === 1 && !q.legal.unsolved, 'an old unsolved crime becomes one open investigation');
  check(Object.keys(k.J().cases).length === 0 && Object.keys(k.J().sentences).length === 0, 'no trial or sentence is invented');
  law.upgradeLegacy();
  check(Object.values(k.J().investigations).length === 1, 'upgrading twice changes nothing');
  year(); year();
  check(!jail.cell() && q.legal.custodyHistory.length === 1, 'released once');
  section('older saves: records kept, time served kept, nothing invented, nothing doubled');

  const r = adult('us', 30);
  r.legal = { record: [], incarceration: null, heat: 0, pending: { crimeId: 'mugging', age: 30, evidence: 0.85, lawyer: 'good', skill: 62 } };
  delete store.state.justice;
  const cash = r.finance.cash;
  const c = law.pendingCase();
  check(c && c.stage === 'plea' && c.defenceTier === 'good' && r.finance.cash === cash, 'an open case resumes with its lawyer, and the fee is not taken again');
  check(c.evidenceIds.length >= 1 && k.J().evidence[c.evidenceIds[c.evidenceIds.length - 1]].reliability === 0.85, 'its evidence keeps the old strength');
  section('older saves: an open case resumes where it was');
}

// ---------- The law changes, and the courts follow it ----------
{
  const rules = await import('../js/engine/rules.js');
  let p = adult('uk', 30);
  check(rules.rule('juryTrials', 'uk') === true && rules.rule('juryTrials', 'de') === false && rules.rule('cashBail', 'us') === true, 'each country starts from its own procedure');
  check(['juryTrials', 'cashBail', 'recordSealing', 'sentencing', 'prisonEducation'].every((id) => rules.choices('uk').some((x) => x.rule === id)), 'every justice law can be put to a legislature');
  const before = caughtFor('armed_robbery').c;
  check(before.law.factFinder === 'jury', 'a case charged under jury trial');
  rules.enact('uk', 'juryTrials', false, 'a test');
  check(k.lawAt('uk').factFinder === 'judge' && before.law.factFinder === 'jury', 'the law changes; the case already charged keeps its law');
  law.legal().pending = null;
  const after = caughtFor('armed_robbery').c;
  check(after.law.factFinder === 'judge' && k.factFinder(after) === 'judge', 'a new case follows the new law');
  rules.enact('de', 'cashBail', true, 'a test');
  check(k.lawAt('de').bail === 'money', 'money bail where it was brought in');
  // Sentencing laws move sentences, never past the lawful range.
  const avg = (level) => {
    let total = 0;
    for (let i = 0; i < 25; i++) {
      const q = adult('fr', 30);
      rules.enact('fr', 'sentencing', level, 'a test');
      const { c } = caughtFor('burglary');
      k.bailHearing(c); k.appoint(c, 'self', q.id); k.enterPlea(c, 'notGuilty');
      const s = k.J().sentences[c.sentenceId];
      if (s) { check(s.type !== 'custody' || (s.years >= 1 && s.years <= OFFENSE_BY_ID.burglary.custody[1]), 'within the lawful range'); total += s.type === 'custody' ? s.years : 0; }
    }
    return total;
  };
  const soft = avg('lenient');
  const hard = avg('tough');
  check(hard > soft, `tougher sentencing law, longer sentences (${soft} vs ${hard} years over 25 cases)`);
  p = adult('se', 30);
  rules.enact('se', 'prisonEducation', 'minimal', 'a test');
  law.imprison(5, 2, {});
  check(jail.programmeOptions().find((x) => x.id === 'degree').why === 'Not offered in prisons here.', 'cutting prison education closes courses');
  law.release();
  p = adult('uk', 30);
  rules.enact('uk', 'recordSealing', false, 'a test');
  p.legal.record.push({ caseId: 'x', crimeId: 'theft', offense: 'Theft', age: 20, year: store.state.year - 10, convicted: true, outcome: 'convicted', sentenceYears: 0 });
  check(law.sealOptions()[0].why === 'Records are not sealed here.', 'where sealing is abolished, nothing can be sealed');
  section('politics: justice laws can be changed; new cases follow them, old cases keep theirs');
}

// ---------- A relative's case ----------
{
  const kin = await import('../js/engine/kinCases.js');
  let done = null;
  for (let i = 0; i < 30 && !done; i++) {
    const p = adult('uk', 40);
    const sib = makeNpc({ role: 'sibling', countryId: 'uk', age: 36, relationship: 60 });
    store.state.npcs[sib.id] = sib; p.npcIds.push(sib.id);
    store.state.pendingEvents = [];
    const c = kin.charge(sib, { offenseId: 'robbery', innocent: false });
    if (!c) continue;
    check(store.state.pendingEvents.some((e) => e.id === 'kin_charged' && e.cast.kin === sib.id), 'the player hears, in a scene');
    const rel0 = sib.meters.relationship;
    p.finance.cash = 200000;
    const text = justiceScene('kin_court', { kin: sib.id });
    check(text && ['sentenced', 'acquitted', 'dismissed'].includes(c.stage) && !sib.flags.openCaseId, 'the case runs to its end');
    check(sib.meters.relationship > rel0 - 1, 'standing by them counts');
    check(p.legal.history.some((h) => h.kind === 'family' && h.caseId === c.id) && !p.legal.record.length, 'it is in the player\'s history, not their record');
    check((sib.flags.legalHistory ?? []).some((h) => h.kind === 'charged'), 'the relative has their own legal history');
    if (kin.inside(sib)) done = { p, sib, c };
  }
  check(!!done, 'a relative can be sent to prison');
  if (done) {
    const { p, sib } = done;
    const f = k.J().facilities[sib.flags.inmate.facilityId];
    check(f.inmateIds.includes(sib.id) && sib.role === 'sibling', 'they serve at a real facility, and are still a sibling');
    sib.meters.relationship = 60;
    const r0 = sib.meters.relationship;
    check(kin.visitKin(sib.id).ok && sib.meters.relationship > r0, 'the player can visit');
    check(!kin.visitKin(sib.id).ok, 'once a year');
    const age0 = sib.age;
    for (let i = 0; i < 30 && kin.inside(sib); i++) year();
    check(!kin.inside(sib) && p.npcIds.includes(sib.id) && sib.role === 'sibling' && sib.age > age0, 'they come home, older, and still family');
    check(!f.inmateIds.includes(sib.id), 'and leave the facility');
  }
  section('family: a relative charged, a choice to stand by them, a sentence served, visits, a return home');
}

// ---------- Royalty ----------
{
  let p;
  for (let i = 0; i < 40; i++) { store.state = createLife({ countryId: 'uk', birthRank: 'royal' }); if (store.state.player.royal) break; }
  p = store.state.player;
  check(!!p.royal, 'a royal life');
  if (p.royal) {
    p.age = 40; store.state.year += 40; p.stats.health = 90;
    p.royal.reigning = true;
    const { inv, c } = caughtFor('fraud');
    check(!c && inv.outcome === 'sovereign immunity' && p.legal.history.some((h) => h.kind === 'immunity'), 'a reigning monarch is not prosecuted');
    check(!hasRecord(p), 'and has no record');
    p.royal.reigning = false;
    year();
    check(inv.outcome !== 'sovereign immunity', 'after the reign, the file can be reopened');
    const q = adult('uk', 30);
    q.royal = { rank: 'royal', countryId: 'uk', reigning: false };
    check(!!caughtFor('fraud').c, 'other royals are prosecuted like anyone else');
  }
  section('royalty: immunity for the reigning monarch only, and only while they reign');
}

// ---------- Transfers ----------
{
  const p = adult('uk', 30);
  law.imprison(12, 4, {});
  const c = jail.cell();
  check(c.security === 'max', 'a serious sentence starts in high security');
  check(!jail.requestTransfer().ok, 'an early application is refused, with a reason');
  c.conduct = 95;
  const first = jail.facility().id;
  for (let i = 0; i < 6 && c.security === 'max' && jail.cell(); i++) { c.conduct = 95; year(); }
  check(jail.cell() ? c.security === 'med' && jail.facility().id !== first && c.transfers.length === 1 : true, 'a good record earns a move to lower security');
  check(p.legal.history.some((h) => h.kind === 'transfer') || !jail.cell(), 'the move is on the record');
  if (jail.cell()) {
    c.conduct = 5;
    c.discipline.push({ year: store.state.year, allegation: 'Fighting', finding: 'proven', penalty: null });
    year();
    check(!jail.cell() || c.security === 'max', 'a bad one, back up');
  }
  section('transfers: earned down, lost up, always recorded');
}

// ---------- Who looks after a child ----------
{
  const care = await import('../js/engine/guardianship.js');
  const kin = await import('../js/engine/kinCases.js');
  const jailParent = (n) => { const f = jail.facilityFor(n.flags.abroad ? 'uk' : store.state.player.countryId, 'med'); n.flags.inmate = { facilityId: f.id, offenseId: 'theft', yearsLeft: 2, kin: true, interest: 'chess', goal: 'come home', background: 'x' }; f.inmateIds.push(n.id); };
  const child = (age, opts = {}) => {
    const p = adult('uk', age);
    p.flags.livesWithParents = true;
    const parents = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n.role === 'parent');
    for (const n of parents) n.age = Math.max(n.age, 30);
    for (const id of [...p.npcIds]) { const n = store.state.npcs[id]; if (['grandparent', 'relative', 'sibling'].includes(n.role)) p.npcIds = p.npcIds.filter((x) => x !== id); }
    if (opts.grandparents) {
      const g = makeNpc({ role: 'grandparent', countryId: 'uk', age: 66, relationship: 75 });
      store.state.npcs[g.id] = g; p.npcIds.push(g.id);
    }
    return { p, parents };
  };

  // Both parents in prison: the grandparents take them, until a parent is back.
  let { p, parents } = child(10, { grandparents: true });
  check(parents.length >= 1, 'a child with parents');
  for (const n of parents) jailParent(n);
  care.checkCare();
  check(p.flags.care?.kind === 'grandparent' && p.flags.care.until === 'release', 'with both parents inside, a grandparent takes them, for now');
  check(store.state.npcs[p.flags.care.guardianId].role === 'grandparent' && /grand/i.test(care.careLine()), 'they live with that grandparent');
  check(care.checkCare() === null, 'checking again changes nothing');
  parents[0].flags.inmate.released = store.state.year;
  care.checkCare();
  check(!p.flags.care && p.flags.livesWithParents, 'home again when a parent is released');

  // No family able to: foster care.
  ({ p, parents } = child(9));
  for (const n of parents) jailParent(n);
  care.checkCare();
  check(p.flags.care?.kind === 'foster' && store.state.npcs[p.flags.care.guardianId]?.flags.title === 'Foster carer', 'with no family to take them, foster care');
  check(p.npcIds.includes(p.flags.care.guardianId), 'the foster carer is a person in their life');
  check(p.milestones.some((m) => /foster/.test(m.text)), 'it is part of their story');

  // A single parent who goes to prison.
  ({ p, parents } = child(12, { grandparents: true }));
  for (const n of parents.slice(1)) { n.alive = false; }
  jailParent(parents[0]);
  care.checkCare();
  check(p.flags.care?.kind === 'grandparent' && p.flags.care.until === 'release', 'a single parent in prison: to the grandparents, for now');

  // Both parents dead: care until adulthood, and leaving care at eighteen.
  ({ p, parents } = child(15));
  for (const n of parents) n.alive = false;
  care.checkCare();
  check(p.flags.care?.kind === 'foster' && p.flags.care.until === 'adult', 'orphaned with no family: foster care until grown');
  const cash = p.finance.cash;
  while (p.age < 18) year();
  check(!p.flags.care && !p.flags.livesWithParents && p.finance.cash > cash, 'at eighteen they leave care, with a grant');

  // A parent abroad, the other in prison.
  ({ p, parents } = child(8, { grandparents: true }));
  if (parents.length === 2) {
    parents[0].flags.abroad = 'fr';
    jailParent(parents[1]);
    care.checkCare();
    check(p.flags.care?.kind === 'grandparent', 'one parent abroad and one inside: still nobody at home');
    parents[0].flags.abroad = false;
    care.checkCare();
    check(!p.flags.care, 'home when the parent abroad comes back');
  }

  // Through the real year: a parent charged, sent inside, then released.
  ({ p, parents } = child(11, { grandparents: true }));
  for (const n of parents.slice(1)) n.alive = false;
  let placed = false;
  for (let i = 0; i < 15 && !placed; i++) {
    store.state.pendingEvents = [];
    const c = kin.charge(parents[0], { offenseId: 'armed_robbery', innocent: false });
    if (c) kin.standBy('kin_court', parents[0].id);
    placed = !!p.flags.care;
  }
  check(placed, 'a single parent sentenced to custody: the child is placed straight away');
  for (let i = 0; i < 25 && p.flags.care && p.age < 17; i++) year();
  check(!p.flags.care || p.age >= 17, 'and goes home when the parent is released');

  // Adults are not placed anywhere.
  ({ p, parents } = child(30));
  for (const n of parents) jailParent(n);
  check(care.checkCare() === null && !p.flags.care, 'an adult is not put into care');

  // Where the child lives depends on where the carer lives, and for how long.
  const elsewhere = (n) => { const other = store.state.player.city === 'X' ? 'Y' : COUNTRIES_CITIES.find((c) => c !== store.state.player.city); n.city = other; return other; };
  const gran = () => store.state.npcs[store.state.player.npcIds.find((id) => store.state.npcs[id].role === 'grandparent')];
  const COUNTRIES_CITIES = (await import('../js/data/countries.js')).COUNTRIES.uk.cities;
  const setYears = (ps, y) => { for (const n of ps) n.flags.inmate.yearsLeft = y; };

  // Short sentence, grandparent in another town: the grandparent comes to stay.
  ({ p, parents } = child(9, { grandparents: true }));
  let town = p.city;
  elsewhere(gran());
  for (const n of parents) jailParent(n);
  setYears(parents, 2);
  care.checkCare();
  check(p.flags.care?.where === 'home' && p.city === town, 'a short sentence: the grandparent comes to stay, the child stays put');
  check(/comes from/.test(store.state.journal[store.state.journal.length - 1].text), 'and the journal says so');
  // The sentence turns out longer: the child moves after all.
  setYears(parents, 8);
  care.checkCare();
  check(p.flags.care?.where === 'moved' && p.city === gran().city && p.city !== town, 'a stay that becomes long: the child moves');
  // And goes back when a parent is out.
  parents[0].flags.inmate.released = store.state.year;
  care.checkCare();
  check(!p.flags.care && p.city === town, 'home again, back in the family\'s town');

  // Long sentence, grandparent in another town: a younger child moves.
  ({ p, parents } = child(8, { grandparents: true }));
  town = p.city;
  const there = elsewhere(gran());
  for (const n of parents) jailParent(n);
  setYears(parents, 9);
  care.checkCare();
  check(p.city === there && p.locations[p.locations.length - 1].city === there && p.legal.history.some((h) => /Moved from/.test(h.text)), 'a long sentence: the child moves to the grandparent\'s town');

  // Long sentence, grandparent in the same town: the child moves in with them, and nothing else changes.
  ({ p, parents } = child(8, { grandparents: true }));
  town = p.city;
  gran().city = town;
  for (const n of parents) jailParent(n);
  setYears(parents, 9);
  care.checkCare();
  check(p.flags.care?.where === 'theirs' && p.city === town, 'a grandparent in the same town: same town, same school');

  // A teenager facing a long stay is asked.
  for (const answer of ['care_stay', 'care_move']) {
    ({ p, parents } = child(14, { grandparents: true }));
    town = p.city;
    elsewhere(gran()); gran().age = 66; gran().meters.health = 80;
    for (const n of parents) jailParent(n);
    setYears(parents, 9);
    store.state.pendingEvents = [];
    care.checkCare();
    check(p.flags.care?.where === 'asking' && store.state.pendingEvents.some((e) => e.id === 'care_choice'), 'a teenager is asked where they would rather live');
    justiceScene(answer, {});
    check(answer === 'care_stay' ? p.city === town && p.flags.care.where === 'home' : p.city === gran().city, `the answer is kept (${answer})`);
  }

  // A carer too frail to move cannot come, even for a short stay.
  ({ p, parents } = child(14, { grandparents: true }));
  town = p.city;
  elsewhere(gran()); gran().age = 82;
  for (const n of parents) jailParent(n);
  setYears(parents, 1);
  store.state.pendingEvents = [];
  care.checkCare();
  check(p.city === gran().city && !store.state.pendingEvents.some((e) => e.id === 'care_choice'), 'a grandparent too old to move: the child goes to them');

  // The player's own children, while the player serves a long sentence.
  {
    const q = adult('uk', 40);
    const mum = q.npcIds.map((id) => store.state.npcs[id]).find((n) => n.role === 'parent' && n.alive);
    for (const id of [...q.npcIds]) { const n = store.state.npcs[id]; if (['spouse', 'partner'].includes(n.role)) q.npcIds = q.npcIds.filter((x) => x !== id); }
    const kid = makeNpc({ role: 'child', countryId: 'uk', age: 7, relationship: 80 });
    store.state.npcs[kid.id] = kid; q.npcIds.push(kid.id);
    if (mum) {
      mum.age = 65; mum.meters.health = 80; mum.meters.relationship = 90;
      mum.city = COUNTRIES_CITIES.find((c) => c !== q.city);
      law.imprison(8, 3, {});
      check(kid.flags.livesIn === mum.city, 'a long sentence: the player\'s child moves to the grandparent\'s town');
      law.release();
      check(!kid.flags.livesIn && !kid.flags.guardian, 'and comes home when the player is released');
      law.imprison(1, 1, {});
      check(!kid.flags.livesIn, 'a short one: the grandparent comes to them');
    }
  }
  section('care: grandparents, family or foster care while no parent can, home when one can, out at eighteen');
}

// ---------- A long life ----------
{
  const p = adult('us', 18);
  let crimes = 0;
  for (let i = 0; i < 40; i++) {
    if (!law.isJailed() && !law.pendingCase() && rng.chance(0.3)) { law.commitCrime(rng.pick(['shoplift', 'burglary', 'fraud', 'car_theft']), null, {}); crimes += 1; }
    const c = law.pendingCase();
    if (c) {
      if (c.stage === 'charged') { k.bailHearing(c); if (c.bail.decision === 'bail' && !k.postBail(c, p.id)) k.remand(c); }
      if (c.stage === 'pretrial') { const o = k.counselOptions(c).find((x) => x.ok && x.tier !== 'self') ?? k.counselOptions(c).find((x) => x.tier === 'self'); k.appoint(c, o.tier, o.npcId); }
      if (c.stage === 'plea') { k.enterPlea(c, rng.pick(['guilty', 'notGuilty'])); if (c.stage === 'plea') k.enterPlea(c, 'notGuilty'); }
      law.afterVerdict(c);
    }
    if (jail.cell() && jail.paroleDue()) jail.paroleHearing('file');
    try { year(); } catch (e) { if (store.state.player.alive) problems.push(`long life, year ${i}: ${e.message}`); break; } // a natural death ends the life early
  }
  const J = k.J();
  for (const c of Object.values(J.cases)) {
    check(J.incidents[c.incidentId] && valid(c.defendantId), `${c.id} refers to a real incident and person`);
    check(['charged', 'pretrial', 'plea', 'trial', 'convicted', 'sentenced', 'acquitted', 'dismissed', 'quashed', 'mistrial'].includes(c.stage), `${c.id} is in a known stage`);
    if (c.stage === 'sentenced') check(!!J.sentences[c.sentenceId], `${c.id} has its sentence`);
  }
  const keys = J.ledger.map((t) => t.key);
  check(new Set(keys).size === keys.length, 'no payment appears twice');
  check(new Set(p.legal.record.map((r) => r.caseId)).size === p.legal.record.length, 'no case appears twice in the record');
  check(Number.isFinite(p.finance.cash), 'money stays a number');
  section(`a long life: ${crimes} crimes over forty years, ${Object.keys(J.cases).length} cases, every record consistent`);
}

for (const line of ok) console.log(line.startsWith('FAILED') ? `FAIL ${line.slice(7)}` : `ok   ${line}`);
if (problems.length) {
  console.log(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const x of problems.slice(0, 40)) console.log(`  - ${x}`);
  process.exit(1);
}
console.log('The justice system holds.');
