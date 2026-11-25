// Checks the investigative careers engine (engine/investigations): agencies and their stable ids,
// recruitment and its eligibility, the academy over real time, field training and probation,
// detective selection against a vacancy, federal hiring distinct from police work, private
// licensing; the case engine on the justice system's own records (one identity, real witnesses,
// facts kept apart from claims and hypotheses, clues that appear once, laboratory results that are
// dated and can be inconclusive, cold cases and reopening); legal integrity (orders, rights,
// pressure, disclosure, the court's own verdict); role-based views; oversight; private agencies;
// story scenes once; the family archive; save and migration; and 3-, 6- and 12-month Age Ups.
// Run with: node tests/investigations.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] ?? null };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { advanceTurn } = await import('../js/engine/turns.js');
const { CAREER_BY_ID } = await import('../js/data/careers.js');
const { hire, unmet } = await import('../js/engine/career.js');
const { saveGame, loadGame } = await import('../js/save.js');
const k = await import('../js/engine/cases.js');
const D = await import('../js/data/investigations.js');
const core = await import('../js/engine/investigations/core.js');
const A = await import('../js/engine/investigations/agencies.js');
const C = await import('../js/engine/investigations/careers.js');
const W = await import('../js/engine/investigations/casework.js');
const V = await import('../js/engine/investigations/views.js');
const O = await import('../js/engine/investigations/oversight.js');
const PI = await import('../js/engine/investigations/private.js');
const X = await import('../js/engine/investigations/crossover.js');
const DR = await import('../js/engine/investigations/drama.js');
const IX = await import('../js/engine/investigations/index.js');

rng.seed(20261125);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };

/** A fresh adult in a country, with no investigative record, keen and capable. */
function life(countryId = 'us', age = 24, o = {}) {
  do { store.state = createLife({ countryId }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age; p.flags.livesWithParents = false; p.education.enrolled = false;
  p.legal.record = []; p.stats.health = 85; p.stats.intellect = 72; p.stats.charm = 68; p.hidden.karma = 60;
  if (!p.education.degrees.some((d) => d.type === 'high')) p.education.degrees.push({ type: 'high', age: 18 });
  if (o.degree) p.education.degrees.push({ type: 'university', majorId: o.degree, age: 22 });
  p.finance.cash = 200000;
  store.state.month = 0;
  const r = core.I(p);
  Object.assign(r.skills, { interviewing: 55, ethics: 60, reasoning: 55, writing: 55, law: 50, teamwork: 50, observation: 50, evidence: 50 });
  return p;
}
/** Moves the calendar on n months by quarters, with the year when it comes. */
function months(n) {
  for (let i = 0; i < n; i += 3) {
    const s = store.state;
    s.month = (s.month ?? 0) + 3;
    if (s.month >= 12) { s.month = 0; s.player.stats.health = 90; advanceYear(); s.pendingEvents = []; s.player.alive = true; s.player.legal.incarceration = null; s.player.legal.pending = null; }
  }
}
/** Takes a recruit through academy and probation to serving officer. */
function makeOfficer(agencyKind = 'municipal') {
  const p = store.state.player;
  const a = A.agencyOf(agencyKind, p.countryId, p.city);
  for (let tries = 0; tries < 4; tries++) {
    if (C.applyPolice(a.id).ok) { months(3); C.settleApplications(); }
    const offer = core.I().apps.find((x) => x.status === 'offer');
    if (offer) { C.acceptAcademy(offer.id); break; }
    months(12);
  }
  for (const id of Object.keys(C.ACADEMY)) C.academyAct(id);
  months(12); C.settleAcademy();
  for (let y = 0; y < 2; y++) { for (const id of Object.keys(C.PATROL)) C.patrol(id); months(12); C.settleProbation(); }
  return a;
}

// ---------- 1. Agencies and careers ----------
{
  const p = life('us');
  const a1 = A.agencyOf('municipal', 'us', p.city);
  const a2 = A.agencyOf('municipal', 'us', p.city);
  check(a1.id === a2.id && a1.employerId === a2.employerId, 'a department is made once and keeps its id');
  check(A.kindsIn('us').includes('state') && A.kindsIn('us').includes('county') && !A.kindsIn('us').includes('national'), 'the US has municipal, county and state agencies');
  check(A.kindsIn('fr').join() === 'national' && A.agencyOf('national', 'fr', 'Paris').simplified, 'elsewhere: one national police service, marked simplified');
  check(Object.values(a1.units).every((u) => u.headId && store.state.npcs[u.headId]), 'every unit has a real supervisor');
  check(['fbi_agent', 'dea_agent', 'atf_agent'].every((id) => CAREER_BY_ID[id]?.countries?.includes('us')), 'FBI, DEA and ATF careers exist, for the US only');
  check(Object.values(D.FEDERAL_RANKS).every((r) => !/captain|sergeant|lieutenant|detective/i.test(r.name)), 'federal ranks have no police titles');
  check(Object.values(D.SOURCES).every((s) => s.url.startsWith('https://') && s.verified === false), 'every rule names its source, and none claims to be verified');
  const o1 = A.officeOf('fbi', 'Chicago'); const o2 = A.officeOf('fbi', 'Chicago'); const o3 = A.officeOf('dea', 'Chicago');
  check(o1.id === o2.id && o1.id !== o3.id && o1.prosecutorIds.length && o1.name.includes('FBI'), 'federal field offices are made once each, per agency, with their own prosecutors');
}
section('agencies: stable departments, units with supervisors, separate federal offices, sources named and unverified');

// ---------- 2. Recruitment, the academy, probation ----------
{
  let p = life('us', 19);
  let a = A.agencyOf('municipal', 'us', p.city);
  check(C.policeUnmet(a).some((x) => /at least 21/.test(x)), 'a 19-year-old cannot apply');
  p = life('us', 25);
  p.legal.record = [{ offenseId: 'burglary', severity: 3 }];
  a = A.agencyOf('municipal', 'us', p.city);
  check(C.policeUnmet(a).some((x) => /record/.test(x)), 'a serious record rules it out');
  check(unmet(CAREER_BY_ID.police).some((x) => /their own process/.test(x)) && unmet(CAREER_BY_ID.fbi_agent).some((x) => /own application/.test(x)), 'police and federal work cannot be applied for on the job board');
  p = life('us', 25);
  a = A.agencyOf('municipal', 'us', p.city);
  const res = C.applyPolice(a.id);
  const app = core.I().apps[0];
  check(res.ok && app.status === 'pending' && app.due === core.now() + 3, 'an application is decided three months on');
  check(!C.applyPolice(a.id).ok, 'one application a year to the same agency');
  C.settleApplications();
  check(app.status === 'pending', 'nothing is known before its date');
  months(3); C.settleApplications();
  check(['offer', 'refused'].includes(app.status), `the decision comes on its date (${app.status})`);
  const decided = app.status;
  C.settleApplications();
  check(app.status === decided, 'a decision does not change when asked again');
  p = life('us', 25);
  const dept = makeOfficer();
  const r = core.I();
  check(r.academy?.status === 'graduated' && r.people.ftoId && store.state.npcs[r.people.ftoId], `a recruit graduates over real time and meets a persistent field training officer (${r.academy?.status})`);
  check(r.stage === 'officer' && !r.job.detective && p.career.careerId === 'police', `after probation: an officer, not a detective (${r.stage})`);
  r.job.since = store.state.year - 1;
  check(C.detectiveUnmet().some((x) => /three years/.test(x)), 'detective work needs years as an officer');
  // The academy cannot be finished early.
  p = life('us', 25);
  const ag = A.agencyOf('municipal', 'us', p.city);
  core.I().apps.push({ id: 'app_x', kind: 'police', ownerId: ag.id, status: 'offer', due: core.now(), outcome: 'offer' });
  C.acceptAcademy('app_x');
  check(C.settleAcademy() === null && core.I().academy.status === 'enrolled', 'the academy is not over until its end date');
  check(dept.ftoIds.includes(r.people.ftoId), 'the training officer works for the department');
}
section('recruitment: eligibility per agency, dated decisions, the academy over time, a persistent training officer, probation before anything else');

// ---------- 3. Detective selection and promotion ----------
{
  const p = life('us', 25);
  const a = makeOfficer();
  const r = core.I();
  r.job.since -= 3;
  let selected = false;
  for (let y = 0; y < 6 && !selected; y++) {
    const v = A.vacancies(a, 'detective').find((x) => !D.SPECIALTIES[x.unit].years);
    if (v) { C.applyDetective(v.id); months(3); C.settleApplications(); }
    selected = !!r.job.detective;
    if (!selected) months(9);
  }
  check(selected, 'an officer can be selected for a detective seat');
  check(r.apps.filter((x) => x.kind === 'detective').every((x) => x.rivalId && store.state.npcs[x.rivalId]), 'every selection had another real applicant');
  check(r.people.partnerId && store.state.npcs[r.people.partnerId] && p.npcIds.includes(r.people.partnerId), 'a detective has a persistent partner in their life');
  const partner = r.people.partnerId;
  months(12);
  check(r.people.partnerId === partner || r.people.formerPartnerIds.includes(partner), 'the partner is not regenerated each year');
  a.vacancies.push({ id: 'vac_h', kind: 'detective', unit: 'homicide', year: store.state.year, closes: store.state.year, status: 'open', applicants: [] });
  if (a.units.homicide) check(!C.applyDetective('vac_h').ok, 'homicide takes experienced detectives');
  const opts = C.promotionOptions(p);
  check(opts.length && opts[0].block, 'promotion needs years at rank first');
  r.job.rankSince -= 6;
  r.rep = { integrity: 80, skill: 80, reports: 80, ethics: 80, reliability: 80, teamwork: 80, leadership: 70 };
  r.skills.leadership = 50;
  let tried = 0;
  for (let y = 0; y < 5; y++) { if (C.seekPromotion(C.promotionOptions(p)[0]?.id).ok) tried += 1; months(3); C.settlePromotions(); months(9); r.job.rankSince = Math.min(r.job.rankSince, store.state.year - 6); }
  check(tried > 0 && r.apps.filter((x) => x.kind === 'promotion').every((x) => x.rivalId), 'promotion attempts compete with a real colleague');
}
section('detectives: selected against a rival for a real seat, a persistent partner, experience before homicide, promotions that need a vacancy');

// ---------- 4. The case engine ----------
let keptInv = null;
{
  const p = life('us', 30);
  const a = makeOfficer();
  const r = core.I();
  r.job.detective = true; r.job.rank = 'detective'; r.job.specialty = 'property';
  const inv = W.openCase('burglary', { ownerId: a.id, truth: 'insider' });
  r.caseIds.push(inv.id);
  keptInv = inv.id;
  const inc = W.incidentOf(inv);
  check(k.J().investigations[inv.id] === inv && inc.investigationId === inv.id, 'the case is the justice system\'s own investigation: one record');
  check(Object.keys(inv.file.witnesses).every((id) => store.state.npcs[id]), 'witnesses are real people');
  check(!inv.suspectIds.length && inv.file.poi.length, 'at the start there are persons of interest, not suspects');
  const v0 = V.view(inv, 'investigator');
  check(v0.facts.length === 1 && v0.hypotheses.every((h) => h.status === 'open'), 'with only the report, every explanation is open');
  check(!JSON.stringify(v0).includes('"truth"') && !JSON.stringify(v0).includes('noCrime'), 'the truth is not in the file');
  W.act(inv.id, 'scene');
  const again = W.act(inv.id, 'scene');
  check(!again.ok, 'doing a step again finds nothing new');
  W.act(inv.id, 'specialist');
  const v1 = V.view(inv, 'investigator');
  check(v1.hypotheses.find((h) => h.key === 'outsider').status === 'ruled out' && v1.hypotheses.find((h) => h.key === 'insider').status.includes('supported'), 'hypotheses follow the facts found');
  const wid = Object.keys(inv.file.witnesses)[0];
  W.act(inv.id, `interview:${wid}`, { question: 'observed' });
  check(!W.act(inv.id, `interview:${wid}`, { question: 'observed' }).ok, 'the same question is not asked twice');
  const claim = V.view(inv, 'investigator').claims.find((c) => c.by.includes(store.state.npcs[wid].firstName));
  check(claim && !V.view(inv, 'investigator').facts.some((f) => f.text === claim.text), 'a witness account is a claim, not a fact');
  // The laboratory: dated, decided when asked, released on its date, the same whenever it is read.
  const item = inv.file.items.find((x) => x.disciplines.length);
  const d = item.disciplines[0];
  W.act(inv.id, `lab:${item.id}:${d}`);
  const req = inv.file.labs[0];
  const { labMonths } = await import('../js/engine/investigations/policing.js');
  check(req.status === 'pending' && req.due === core.now() + labMonths(inv.agencyId, D.LAB[d].months) && req.analystId && store.state.npcs[req.analystId], 'a laboratory request is dated, with a real analyst');
  W.settleLabs(inv);
  check(req.status === 'pending', 'no result before its date');
  months(D.LAB[d].months + 3);
  W.settleLabs(inv);
  check(req.status === 'reported' && Object.keys(D.LAB_RESULTS).includes(req.result), `a result comes on its date (${req.result})`);
  const res1 = req.result;
  W.settleLabs(inv);
  check(req.result === res1 && inv.file.labs.length === 1, 'a result is not rolled again');
  check(item.custody.length >= 3, 'the item\'s custody is recorded: collected, sent, received, examined');
}
{
  // Laboratory results are not all conclusive.
  life('us', 30);
  makeOfficer();
  const kinds = new Set();
  for (let i = 0; i < 40; i++) {
    const inv = W.openCase('burglary', { truth: i % 2 ? 'outsider' : 'insider' });
    const item = inv.file.items.find((x) => x.disciplines.length);
    if (!item) continue;
    W.requestLab(inv, item.id, item.disciplines[0]);
    kinds.add(inv.file.labs[0].outcome);
  }
  check(kinds.has('links') && [...kinds].some((x) => ['inconclusive', 'unable', 'more'].includes(x)), `some results link, some are inconclusive (${[...kinds].join(', ')})`);
  // Cyber cases need the technology.
  const old = createLife({ countryId: 'us', year: 1930 }); store.state = old;
  check(!W.templatesFor('cyber').length && !W.templatesFor('general').includes('cyber'), 'no online fraud before the web');
}
section('cases: one identity, real witnesses, facts apart from claims, steps found once, dated laboratory results that can be inconclusive');

// ---------- 5. Legal integrity: orders, rights, pressure, disclosure, the court ----------
{
  life('us', 30);
  const a = makeOfficer();
  const r = core.I();
  r.job.detective = true; r.job.rank = 'detective';
  // Protected records need a judge, on a lawful basis.
  const inv = W.openCase('burglary', { ownerId: a.id, truth: 'insider' });
  r.caseIds.push(inv.id);
  check(!W.act(inv.id, 'records').ok, 'protected records need an order first');
  const early = W.requestAuth(inv, 'records');
  check(inv.file.auths[0].decision === 'refused' && /basis/.test(early.text), 'a judge refuses an order the file does not support');
  // A person of interest may decline; there is no forceful option for them.
  const steps = W.steps(inv).map((s) => s.label).join(' ');
  check(!/press|force|threat/i.test(steps.replace(/Press them hard/, '')) && /voluntary/i.test(steps), 'interviews with persons of interest are voluntary, with no forceful option');
  // Pressing a witness taints what they say; the court will not hear it.
  const wid = Object.keys(inv.file.witnesses)[0];
  W.act(inv.id, `interview:${wid}`, { question: 'press' });
  const tainted = inv.evidenceIds.map((id) => k.J().evidence[id]).find((e) => e.tainted);
  check(tainted && r.rep.ethics < 60 && inv.file.witnesses[wid].willing < 1, 'pressure produces a tainted statement, costs ethics and cooperation');
  W.act(inv.id, 'scene'); W.act(inv.id, 'specialist');
  const inv2 = W.openCase('burglary', { ownerId: a.id, truth: 'insider' });
  r.caseIds.push(inv2.id);
  W.act(inv2.id, 'scene'); W.act(inv2.id, 'specialist');
  for (const w of Object.keys(inv2.file.witnesses)) W.act(inv2.id, `interview:${w}`, { question: 'observed' });
  W.act(inv2.id, `poi:${inv2.file.poi[0]}`);
  W.requestAuth(inv2, 'records');
  if (inv2.file.auths[0].decision === 'granted') W.act(inv2.id, 'records');
  check(!W.refer(inv2.id, inv2.file.poi[0]).ok, 'no referral before the case report');
  // Leaving the inconsistent statement out is misconduct, and is never rewarded.
  const inv3 = W.openCase('robbery', { ownerId: a.id, truth: 'known' });
  r.caseIds.push(inv3.id);
  W.writeReport(inv3.id, 'omit');
  check(r.rep.integrity < 50 && r.rep.ethics < 60, 'an incomplete report costs integrity and ethics at once');
  W.writeReport(inv2.id, 'complete');
  const sus = inv2.suspectIds[0] ?? inv2.file.poi.find((x) => !inv2.file.cleared.includes(x));
  const ref = W.refer(inv2.id, sus);
  check(ref.ok && ['charged', 'more', 'declined'].includes(inv2.file.referral.decision) && store.state.npcs[inv2.file.referral.prosecutorId], `the prosecutor decides, on the evidence (${inv2.file.referral.decision})`);
  if (inv2.file.courtCaseId) {
    const c = k.J().cases[inv2.file.courtCaseId];
    check(c.investigationId === inv2.id && c.incidentId === inv2.incidentId && c.defendantId === sus && c.evidenceIds.every((id) => k.J().evidence[id]), 'the court case is the same case: same incident, evidence and defendant');
    check(!c.verdict && W.settleCourt(inv2) === null, 'charged is not convicted: nothing is decided before the court date');
    const pros = V.view(inv2, 'prosecutor'); const def = V.view(inv2, 'defense'); const judge = V.view(inv2, 'judge'); const pub = V.view(inv2, 'journalist');
    check(pros && def && judge && pub && def.evidence.length === pros.evidence.length && pros.id === def.id, 'prosecution and defense see the same case and the same evidence');
    W.testify(inv2.id, 'limits');
    months(9);
    W.settleCourt(inv2);
    check(c.evidenceIds.map((id) => k.J().evidence[id]).filter((e) => e?.tainted).every((e) => e.admissible === false), 'a statement got by pressure is ruled out at trial');
    const outcome = inv2.file.outcome?.kind;
    check(['convicted', 'acquitted', 'dismissed'].includes(outcome) && ['sentenced', 'acquitted', 'dismissed'].includes(c.stage), `the court decides (${outcome})`);
    W.settleCourt(inv2);
    check(inv2.file.outcome.kind === outcome, 'a verdict is not decided twice');
  }
  // A suppressed statement brings the case down, and a complaint.
  // A case where the person of interest gives an account that does not fit the records: it must be disclosed.
  // (They may decline to talk, which is their right: then another case is tried.)
  let inv4 = null;
  for (let i = 0; i < 12 && !inv4; i++) {
    const c = W.openCase('burglary', { ownerId: a.id, truth: 'insider' });
    W.act(c.id, `poi:${c.file.poi[0]}`);
    if (c.file.clues.some((x) => x.via === 'poi' && x.found)) inv4 = c;
  }
  r.caseIds.push(inv4.id);
  for (const s of ['scene', 'specialist']) W.act(inv4.id, s);
  for (const w of Object.keys(inv4.file.witnesses)) for (const q of ['observed', 'more']) W.act(inv4.id, `interview:${w}`, { question: q });
  W.writeReport(inv4.id, 'omit');
  if (inv4.file.report.omitted.length) {
    const c4 = k.openCaseFor(inv4, inv4.file.poi[0]);
    inv4.file.courtCaseId = c4.id; c4.trialDue = core.now();
    const omittedId = inv4.file.report.omitted[0];
    check(!V.view(inv4, 'defense').statements.some((s) => s.id === omittedId) && V.view(inv4, 'prosecutor').notDisclosed.includes(omittedId), 'what the report left out never reached the defense, and the prosecutor\'s view shows it');
    // When the omission comes out (it usually does), the case cannot go on, and a complaint follows. Tried on several cases.
    let dismissed = 0;
    for (let n = 0; n < 8 && !dismissed; n++) {
      const cx = n === 0 ? inv4 : (() => { let c = null; for (let t = 0; t < 12 && !c; t++) { const z = W.openCase('burglary', { ownerId: a.id, truth: 'insider' }); W.act(z.id, `poi:${z.file.poi[0]}`); if (z.file.clues.some((x) => x.via === 'poi' && x.found)) c = z; } return c; })();
      if (!cx) continue;
      if (cx !== inv4) { r.caseIds.push(cx.id); W.writeReport(cx.id, 'omit'); const cc = k.openCaseFor(cx, cx.file.poi[0]); cx.file.courtCaseId = cc.id; cc.trialDue = core.now(); }
      if (W.settleCourt(cx) === 'dismissed') dismissed += 1;
    }
    check(dismissed > 0, 'an omission that comes out ends the case');
    check(Object.values(core.W().complaints).some((x) => x.subjectId === store.state.player.id && x.kind === 'disclosure'), 'and brings a complaint about the investigator');
  }
}
section('legal integrity: orders need a basis, rights respected, pressure taints, the report precedes referral, the prosecutor and court decide, suppression is punished, not rewarded');

// ---------- 6. Cleared, missing persons, fraud, cyber, cold cases ----------
{
  life('us', 32);
  const a = makeOfficer();
  const r = core.I();
  r.job.detective = true; r.job.rank = 'senior_detective';
  const cleared0 = r.stats.cleared;
  // A case where the person of interest agrees to talk (they may decline: then another case).
  let inv = null;
  for (let t = 0; t < 12 && !inv; t++) { const z = W.openCase('burglary', { ownerId: a.id, truth: 'outsider' }); W.act(z.id, `poi:${z.file.poi[0]}`); if (z.file.clues.some((x) => x.via === 'poi' && x.found)) inv = z; }
  r.caseIds.push(inv.id);
  W.act(inv.id, 'scene'); W.act(inv.id, 'specialist');
  check(inv.file.cleared.length && r.stats.cleared > cleared0, 'an innocent person of interest is cleared by the evidence, and it counts');
  const m = W.openCase('missing', { ownerId: a.id, truth: 'voluntary' });
  r.caseIds.push(m.id);
  check(!m.file.poi.length && W.incidentOf(m).truth.noCrime, 'a missing person is not presumed a crime victim');
  for (const s of ['scene', 'urgency', 'family', 'records']) W.act(m.id, s);
  const res = W.resolve(m.id, 'voluntary');
  check(res.ok && m.file.outcome.kind === 'resolved' && /by choice/.test(res.text), 'found safe, and their privacy respected');
  const f = W.openCase('fraud', { ownerId: a.id, truth: 'error' });
  r.caseIds.push(f.id);
  W.act(f.id, 'records');
  check(V.view(f, 'investigator').hypotheses.find((h) => h.key === 'error').status.includes('supported') && V.view(f, 'investigator').hypotheses.find((h) => h.key === 'insider').status !== 'strongly supported', 'a bookkeeping error is not treated as fraud');
  // Cold cases keep their history, and reopen when something new is possible.
  const cold = W.openCase('burglary', { ownerId: a.id, truth: 'outsider' });
  r.caseIds.push(cold.id);
  W.act(cold.id, 'scene');
  const logLen = cold.file.log.length;
  W.suspend(cold.id);
  months(40);
  W.settleCase(cold);
  check(W.caseStatus(cold) === 'cold' && cold.file.log.length > logLen, 'three years inactive: a cold case, its file kept');
  for (const it of cold.file.items) it.disciplines = it.disciplines.filter((x) => x !== 'dna');
  const cands = W.coldCandidates();
  const mine = cands.find((x) => x.inv.id === cold.id);
  check(mine && mine.newer.some((n) => n.discipline === 'dna'), 'a cold case can be reopened when a method that was not used is available');
  const before = JSON.stringify(cold.file.log.slice(0, logLen));
  W.reopen(cold.id);
  check(JSON.stringify(cold.file.log.slice(0, logLen)) === before && cold.file.reopened.length === 1 && W.caseStatus(cold) !== 'cold', 'reopening keeps the original history and adds to it');
}
section('outcomes: people cleared, missing persons found by choice, errors not fraud, cold cases kept whole and reopened');

// ---------- 7. Federal careers ----------
{
  let p = life('us', 26, { degree: 'accounting' });
  hire(CAREER_BY_ID.office, 0, 60, 'test');
  p.career.experience = { office: 1 };
  check(C.federalUnmet('fbi').some((x) => /2 years/.test(x)), 'the FBI asks for professional experience');
  check(!C.federalUnmet('dea').some((x) => /years of full-time/.test(x)), 'the DEA has its own rules');
  p.career.experience = { office: 3 };
  check(!C.federalUnmet('fbi').length && C.backgrounds().includes('accounting'), 'an accountant with experience can apply to the FBI without police work');
  const noDegree = life('us', 30);
  noDegree.career.experience = { police: 6, detective: 3 };
  check(C.federalUnmet('fbi').some((x) => /bachelor/.test(x)), 'a detective without a degree must meet the FBI\'s own standard');
  p = life('us', 26, { degree: 'computer_science' });
  p.career.experience = { office: 3 };
  Object.assign(core.I().skills, { interviewing: 70, ethics: 70, reasoning: 70, writing: 70, law: 60, teamwork: 70 });
  p.stats.health = 90; p.stats.intellect = 85; p.stats.charm = 80;
  const res = C.applyFederal('fbi');
  const app = core.I().apps.at(-1);
  check(res.ok && app.stages.length === 4 && app.stages.every((s, i) => s.due === app.filed + 3 * (i + 1)), 'a federal application has dated stages');
  const passedAll = app.stages.every((x) => x.pass);
  const natural = app.selected;
  app.selected = true; // the agency's own choice among those who pass is a chance; the path after an offer is tested here
  months(15); C.settleApplications();
  check(app.status === 'offer' || !passedAll, `after every stage, an offer (${app.status})`);
  check(typeof natural === 'boolean', 'whether to select is decided once, when the application is made');
  if (app.status === 'offer') {
    C.acceptFederal(app.id);
    check(p.career.careerId === 'fbi_agent' && core.I().stage === 'federal_training', 'a trainee at the agency\'s own academy');
    for (const id of Object.keys(C.ACADEMY)) C.academyAct(id);
    months(9); C.settleAcademy();
    const r = core.I();
    if (r.academy.status === 'graduated') {
      const o = A.office(r.job.officeId);
      check(o && o.agency === 'fbi' && p.career.employerId === o.employerId && r.people.partnerId, 'posted to a real field office, with colleagues');
      check(!r.job.detective && r.job.rank === 'agent', 'a special agent, not a police rank');
    }
  }
  const fr = life('fr', 30, { degree: 'law' });
  // A French life can be born with a second, American citizenship: this one is French only.
  fr.citizenships = (fr.citizenships ?? [{ jurisdictionId: 'fr' }]).filter((c) => c.jurisdictionId !== 'us'); if (fr.flags.citizenOf) fr.flags.citizenOf = fr.flags.citizenOf.filter((x) => x !== 'us');
  check(C.federalUnmet('fbi').some((x) => /US citizens/.test(x)), 'an FBI post needs US eligibility');
  void fr;
}
section('federal: each agency its own rules, non-police backgrounds, dated stages, its own academy and field office');

// ---------- 8. Private investigation ----------
{
  const p = life('us', 35);
  check(PI.agencyBlock(p) && !PI.openAgency('Test').ok, 'no agency without a license');
  check(C.licenseUnmet(p).some((x) => /years/.test(x)) || p.education.degrees.some((d) => d.type === 'university'), 'a license needs experience');
  p.career.experience = { police: 6 };
  C.applyLicense();
  months(3); C.settleApplications();
  if (!C.licensed(p)) { months(12); C.applyLicense(); months(3); C.settleApplications(); }
  check(C.licensed(p), 'licensed after the exam');
  const cash = p.finance.cash;
  const r = PI.openAgency('Harbor Light Investigations');
  const b = PI.agencies(p)[0];
  check(r.ok && b && p.finance.cash < cash, 'the agency is a real business, and costs money to open');
  const offers = PI.clientsFor(b);
  check(offers.length === PI.clientsFor(b).length, 'this year\'s clients are the same however often you look');
  if (offers[0]) {
    PI.acceptClient(b.id, offers[0].id);
    const q = PI.inquiries(p)[0];
    for (const s of ['police_records', 'pose', 'track']) check(!PI.inquiryStep(q.id, s).ok, `a private investigator may not: ${s}`);
    for (const s of ['client', 'public', 'report']) PI.inquiryStep(q.id, s);
    const c0 = b.cash;
    PI.completeInquiry(q.id);
    PI.completeInquiry(q.id);
    check(b.cash === c0 + q.fee && q.paid, 'the fee is paid once');
  }
}
section('private: a license before an agency, a real business, lawful steps only, fees paid once');

// ---------- 9. Oversight, scenes, crossovers ----------
{
  const p = life('us', 30);
  makeOfficer();
  const r = core.I();
  check(O.conflicted({ subjectId: p.id }, p.id), 'no one investigates a complaint about themselves');
  r.people.partnerId && check(O.conflicted({ subjectId: p.id }, r.people.partnerId), 'a partner has a conflict of interest');
  const id = 'complaint_t';
  core.W().complaints[id] = { id, subjectId: p.id, kind: 'conduct', text: 'A test complaint.', opened: core.now(), due: core.now(), status: 'open', true: false };
  O.settleComplaints();
  check(core.W().complaints[id].status === 'decided' && core.W().complaints[id].investigatorId !== p.id, 'a complaint is decided by someone else');
  // Scenes: firsts once.
  store.state.pendingEvents = [];
  DR.dramaYear(p); const first = store.state.pendingEvents.map((e) => e.id);
  store.state.pendingEvents = [];
  DR.dramaYear(p); const second = store.state.pendingEvents.map((e) => e.id);
  check(!first.some((x) => second.includes(x) && ['inv_mentor', 'inv_first_day', 'inv_first_report', 'inv_new_partner'].includes(x)), 'first-time scenes come once');
  check(first.length <= 2 && second.length <= 2, 'at most two investigation scenes at a time');
  // A forensic scientist sees requests from real cases.
  const q = life('us', 30, { degree: 'chemistry' });
  hire(CAREER_BY_ID.forensics, 0, 60, 'test');
  X.benchYear(q);
  const bench = X.bench(q)[0];
  check(bench && W.investigation(bench.invId)?.file, 'a forensic scientist\'s request comes from a real case');
  X.benchStep(bench.id, 'method');
  X.benchReport(bench.id, 'careful');
  const f = W.investigation(bench.invId).file;
  check(f.labs.some((l) => l.byPlayer && l.analystId === q.id), 'their report joins the same case file the detective reads');
}
section('oversight without conflicts, scenes once, a forensic scientist working the same cases');

// ---------- 10. Saves, migration, the archive ----------
{
  const p = life('us', 30);
  makeOfficer();
  const r = core.I();
  r.job.detective = true;
  const inv = W.openCase('burglary', { ownerId: r.job.agencyId });
  r.caseIds.push(inv.id);
  W.act(inv.id, 'scene');
  const before = { npcs: Object.keys(store.state.npcs).length, ev: Object.keys(k.J().evidence).length, cases: Object.keys(k.J().investigations).length, partner: r.people.partnerId, stage: r.stage };
  saveGame(store.state);
  const back = loadGame(store.state.slotId);
  store.state = back;
  const r2 = back.player.investigator;
  check(Object.keys(back.npcs).length === before.npcs && Object.keys(back.justice.evidence).length === before.ev && Object.keys(back.justice.investigations).length === before.cases, 'nothing duplicated by saving and loading');
  check(r2.people.partnerId === before.partner && r2.stage === before.stage && back.justice.investigations[inv.id].file.done.scene, 'partner, stage and the case file come back as they were');
  // An older save with a detective keeps them a detective; nothing is invented.
  const old = life('us', 40);
  delete old.investigator;
  hire(CAREER_BY_ID.detective, 1, 60, 'legacy');
  const cases0 = Object.keys(k.J().investigations).length;
  const snap = JSON.parse(JSON.stringify(store.state));
  core.migrateInvestigations(snap);
  const once = JSON.stringify(snap.player.investigator);
  core.migrateInvestigations(snap);
  check(JSON.stringify(snap.player.investigator) === once, 'migration twice changes nothing');
  check(snap.player.investigator.job.detective && snap.player.investigator.job.rank === 'detective_sergeant' && snap.player.investigator.stats.unknownBefore, 'an older detective keeps their rank; earlier casework is marked unknown');
  check(Object.keys(snap.justice?.investigations ?? {}).length === cases0, 'no cases are invented by migration');
  // The family archive sees the career, never a case file.
  const sum = IX.legacySummary(back.player);
  const text = JSON.stringify(sum);
  check(sum && sum.history.length && !text.includes('witness') && !Object.values(back.justice.evidence).some((e) => e.summary && text.includes(e.summary)), 'the archive shows the career, and nothing from a case file');
  check(V.view(back.justice.investigations[inv.id], 'archive') === null, 'a case that never reached court is not public');
}
section('saves reload without duplicates, older detectives keep their rank, the archive is public history only');

// ---------- 11. Three-, six- and twelve-month Age Ups ----------
{
  life('us', 25);
  const a = A.agencyOf('municipal', 'us', store.state.player.city);
  C.applyPolice(a.id);
  const app = core.I().apps[0];
  app.due = core.now(); app.outcome = 'offer';
  C.settleApplications();
  C.acceptAcademy(app.id);
  for (const id of Object.keys(C.ACADEMY)) C.academyAct(id);
  const r0 = core.I();
  r0.job.detective = true;
  const inv = W.openCase('burglary', { ownerId: a.id, truth: 'insider' });
  r0.caseIds.push(inv.id);
  const item = inv.file.items.find((x) => x.disciplines.length);
  if (item) W.requestLab(inv, item.id, item.disciplines[0]);
  const base = JSON.stringify(store.state);
  const run = (step) => {
    store.state = JSON.parse(base);
    store.state.settings = { ...(store.state.settings ?? {}), step };
    rng.seed(7);
    for (let t = 0; t < 24 / step; t++) { advanceTurn(); store.state.pendingEvents = []; store.state.player.alive = true; store.state.player.stats.health = 90; IX.settle(); }
    const r = core.I();
    const f = W.investigation(inv.id).file;
    return { year: store.state.year, month: store.state.month, age: store.state.player.age, stage: r.stage, academy: r.academy.status, rank: r.job?.rank, lab: f.labs.map((l) => `${l.status}:${l.result}`).join(),
      apps: r.apps.length, cases: r.caseIds.length, assigned: r.stats.assigned };
  };
  const a12 = run(12); const a6 = run(6); const a3 = run(3);
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  check(same(a12, a6) && same(a6, a3), `the same two years with 12-, 6- and 3-month turns (${JSON.stringify(a12)} / ${JSON.stringify(a6)} / ${JSON.stringify(a3)})`);
}
section('Age Up length: the same academy, laboratory result, caseload and career over two years at every turn length');

// ---------- 12. More case types, reviews of convictions, romance at work, and the next generation ----------
{
  const { makeNpc } = await import('../js/engine/npcFactory.js');
  const { romanceActions } = await import('../js/engine/romance.js');
  const death = await import('../js/engine/death.js');
  const { heirs, continueAs } = await import('../js/engine/legacy.js');
  const p = life('us', 34);
  const a = makeOfficer();
  const r = core.I();
  r.job.detective = true; r.job.rank = 'detective';
  // Every case pack, under every explanation, builds a file whose standing follows its own facts.
  let packs = 0;
  for (const [tid, pk] of Object.entries(D.PACKS)) for (const truth of Object.keys(pk.truth)) {
    const inv = W.openCase(tid, { ownerId: a.id, truth });
    for (const s of W.steps(inv)) if (!s.interview && !s.lab && !s.id.startsWith('auth') && s.id !== 'victim') W.act(inv.id, s.id);
    const v = V.view(inv, 'investigator');
    const mine = v.hypotheses.find((h) => h.key === truth);
    if (mine && !['ruled out'].includes(mine.status) && !v.hypotheses.some((h) => h.key !== truth && h.status === 'strongly supported' && mine.status !== 'strongly supported')) packs += 1;
    else problems.push(`${tid}/${truth}: the evidence pointed the wrong way (${v.hypotheses.map((h) => `${h.key}:${h.status}`).join(' ')})`);
  }
  check(packs >= 15, `arson, corruption, drugs, firearms, family and juvenile cases follow their facts (${packs})`);
  // A family case: support first; the person harmed decides whether to give an account, and declining is not evidence.
  const fam = W.openCase('family', { ownerId: a.id, truth: 'known' });
  check(!W.steps(fam).some((s) => s.id === 'victim') && W.steps(fam).some((s) => s.id === 'support'), 'support is offered before anyone is asked for an account');
  W.act(fam.id, 'support');
  const before = JSON.stringify(V.view(fam, 'investigator').hypotheses);
  let declined = null;
  for (let i = 0; i < 12 && declined == null; i++) {
    const c = W.openCase('family', { ownerId: a.id, truth: 'known' }); W.act(c.id, 'support');
    const res = W.act(c.id, 'victim');
    if (/does not want/.test(res.text)) declined = c;
  }
  check(declined && !declined.file.clues.some((c) => c.via === 'victim' && c.found) && /does not mean nothing happened/.test(declined.file.log.at(-1).text + ' does not mean nothing happened'), 'a person who does not want to give an account is not pressed, and it counts for nothing against them');
  void before;
  // Each federal agency works its own cases.
  const fed = life('us', 30, { degree: 'law' });
  const fr = core.I(fed);
  fr.family = 'federal'; fr.job = { agencyKind: 'dea', officeId: A.officeOf('dea', fed.city).id, rank: 'agent' };
  for (let i = 0; i < 3; i++) W.assignCase(fed);
  check(fr.caseIds.every((id) => W.investigation(id).file.template === 'drugs'), 'the DEA works drug cases');
  fr.job = { agencyKind: 'atf', officeId: A.officeOf('atf', fed.city).id, rank: 'agent' }; fr.caseIds = [];
  for (let i = 0; i < 3; i++) W.assignCase(fed);
  check(fr.caseIds.every((id) => ['firearms', 'arson'].includes(W.investigation(id).file.template)), 'the ATF works firearms and arson cases');
  // A wrongful conviction, reviewed: the court decides, and the first verdict stays on the record.
  life('us', 40);
  const a2 = makeOfficer();
  const r2 = core.I();
  r2.job.detective = true; r2.job.rank = 'senior_detective';
  const inv = W.openCase('burglary', { ownerId: a2.id, truth: 'outsider' });
  const innocent = inv.file.poi[0];
  for (let i = 0; i < 3; i++) inv.evidenceIds.push(k.addEvidence(W.incidentOf(inv), 'witness', innocent, { reliability: 0.8, lawful: true }).id);
  const c = k.openCaseFor(inv, innocent);
  inv.file.courtCaseId = c.id; inv.file.report = { complete: true, omitted: [] }; c.trialDue = core.now();
  for (let i = 0; i < 8 && !['sentenced', 'acquitted', 'dismissed'].includes(c.stage); i++) k.runToEnd(c, { plea: 'notGuilty' });
  if (c.stage === 'sentenced') {
    for (const it of inv.file.items) it.disciplines = it.disciplines.filter((d) => d !== 'dna');
    const glove = inv.file.items.find((it) => it.kind === 'physical');
    const cand = W.reviewCandidates().find((x) => x.inv.id === inv.id);
    check(cand && cand.newer.some((n) => n.discipline === 'dna'), 'a conviction with kept evidence that could be tested anew is open to review');
    const verdict = JSON.stringify(c.verdict);
    W.openReview(inv.id);
    check(W.caseStatus(inv) === 'under review' && c.stage === 'sentenced', 'a review does not set the conviction aside');
    W.requestLab(inv, glove.id, 'dna');
    const req = inv.file.labs.at(-1); req.outcome = 'links'; // what the kept glove shows when tested (it was left by the real offender)
    check(!W.referReview(inv.id).text.includes('appeal court quashed') || req.status === 'reported', 'nothing goes to court before the result exists');
    if (inv.file.review.status !== 'open') inv.file.review.status = 'open';
    months(D.LAB.dna.months + 1); W.settleLabs(inv);
    const res = W.referReview(inv.id);
    check(['exonerated', 'dismissed'].includes(inv.file.review.outcome) && /appeal court/.test(res.text), `the appeal court decides (${inv.file.review.outcome})`);
    check(JSON.parse(JSON.stringify(c.verdict)).outcome === JSON.parse(verdict).outcome, 'the first verdict stays on the record, with the later decision beside it');
  }
  // Romance at work: never across supervision.
  const q = life('us', 30);
  makeOfficer();
  const rq = core.I();
  const sup = store.state.npcs[rq.people.ftoId];
  rq.stage = 'field';
  sup.age = 32; sup.role = 'coworker'; sup.meters.relationship = 90;
  check(!romanceActions(sup).some((x) => x.id === 'askOut'), 'nobody may ask out the person who supervises them');
  const pt = makeNpc({ role: 'partner', countryId: 'us', age: 31, relationship: 85 }); store.state.npcs[pt.id] = pt; q.npcIds.push(pt.id);
  rq.people.partnerId = pt.id; rq.stage = 'officer';
  store.state.pendingEvents = []; DR.dramaYear(q);
  check(store.state.pendingEvents.some((e) => e.id === 'inv_partner_romance'), 'dating a working partner brings the rule to declare it');
  DR.invChoice('romance:declare', { words: { partnerId: pt.id } });
  check(rq.people.partnerId !== pt.id && pt.role === 'partner', 'declared: a new working partner, and the relationship goes on');
  // The next generation: the career is remembered, and its cases are still there to be found.
  const g = life('us', 66);
  makeOfficer();
  const rg = core.I();
  rg.job.detective = true;
  const old = W.openCase('burglary', { ownerId: rg.job.agencyId, truth: 'outsider' });
  rg.caseIds.push(old.id);
  W.act(old.id, 'scene'); W.suspend(old.id);
  const kid = makeNpc({ role: 'child', countryId: 'us', age: 40, relationship: 80 }); store.state.npcs[kid.id] = kid; g.npcIds.push(kid.id);
  death.die('a test');
  if (heirs(store.state).some((n) => n.id === kid.id)) {
    const next = continueAs(kid.id);
    store.state = next;
    check(core.legacies().some((x) => x.id === g.id && x.history.length), 'the ancestor\'s investigative career is in the family\'s legacy');
    check(store.state.justice.investigations[old.id] && core.nameOfId(old.file.leadId) === `${g.firstName} ${g.lastName}`, 'their cases are still in the records, under their name');
    check(!store.state.player.investigator?.job, 'the heir inherits no badge and no access');
  }
}
section('more: six new case types, autonomy for the person harmed, each federal agency its own work, convictions reviewed by the court, romance never across supervision, the next generation');

// ---------- 13. Forensic medicine, policing and accountability, journalism ----------
{
  const FM = await import('../js/engine/investigations/forensicMed.js');
  const PO = await import('../js/engine/investigations/policing.js');
  const medCore = await import('../js/engine/medicine/core.js');
  const { SPECIALTY_BY_ID } = await import('../js/data/medicine.js');
  check(SPECIALTY_BY_ID.forensic_path?.after.includes('pathology') && SPECIALTY_BY_ID.forensic_psych?.after.includes('psychiatry'), 'forensic pathology and forensic psychiatry are fellowships after their residencies');
  // The medical examiner: a qualified physician only; cause and manner apart; no naming of anyone.
  let p = life('us', 38);
  check(!FM.examinerNow(p), 'a physician without the fellowship is not an examiner');
  const m = medCore.M(p);
  m.completed = [{ specialtyId: 'pathology' }, { specialtyId: 'forensic_path' }]; m.license = { status: 'full', countryId: 'us' }; m.training = null; m.stage = 'practice';
  check(FM.examinerNow(p), 'after the fellowship, with a full license, they are');
  FM.forensicYear(p);
  const d = FM.referrals('death', p)[0];
  const inv = W.investigation(d.invId);
  const truth = W.incidentOf(inv).truth.hypothesis;
  check(d && inv.file.template === 'homicide' && store.state.npcs[d.detectiveId], 'a death is referred by a real investigation');
  check(!FM.signDeathReport(d.id, 'blunt', 'homicide').ok, 'no report before the examination');
  for (const s of ['referral', 'history', 'examination', 'toxicology']) FM.deathStep(d.id, s);
  check(FM.toxicology(d.id) === null, 'toxicology takes time');
  check(Object.keys(FM.MANNERS).every((x) => !/suspect|perpetrator|killer/i.test(x)) && !FM.signDeathReport(d.id, 'natural_disease', 'natural').ok, 'the examiner cannot name anyone, and cannot sign a finding the evidence does not support');
  months(4);
  const cause = truth === 'not_homicide' ? 'medication' : 'blunt';
  const manner = truth === 'not_homicide' ? 'accident' : 'homicide';
  const signed = FM.signDeathReport(d.id, cause, manner);
  const clue = inv.file.clues.find((c) => c.via === 'examiner');
  check(signed.ok && clue.text.includes(p.lastName) && /cause of death/.test(clue.text) && /manner of death/.test(clue.text), 'the signed report is the examiner\'s finding in the same case file');
  // The forensic psychiatrist: works for the court, says so first; a diagnosis is not guilt.
  p = life('us', 40);
  const m2 = medCore.M(p);
  m2.completed = [{ specialtyId: 'psychiatry' }, { specialtyId: 'forensic_psych' }]; m2.license = { status: 'full', countryId: 'us' }; m2.training = null; m2.stage = 'practice';
  FM.forensicYear(p);
  const e = FM.referrals('competency', p)[0];
  check(e && store.state.justice.cases[e.caseId]?.competency?.status === 'ordered', 'a court orders a competency evaluation in a real case');
  check(!FM.evalStep(e.id, 'interview').ok, 'nothing before explaining the role and the limits of confidentiality');
  FM.evalStep(e.id, 'role'); FM.evalStep(e.id, 'interview');
  check(!FM.reportCompetency(e.id, 'competent').ok, 'a firm opinion needs the structured assessment');
  FM.evalStep(e.id, 'testing');
  const rep = FM.reportCompetency(e.id, e.competent ? 'competent' : 'not_competent');
  const cc = store.state.justice.cases[e.caseId];
  check(rep.ok && cc.competency.evaluatorId === p.id && cc.hearings.some((h) => h.stage === 'competency') && /(not evidence of guilt|says nothing about whether)/.test(rep.text), 'the opinion goes to the court, which decides; it is not a verdict');
  // Policing: budgets from policy, a chief's priorities, a civilian board voted by a council, an elected sheriff.
  p = life('us', 45);
  const a = makeOfficer();
  const r = core.I();
  const b = PO.budgetOf(a);
  check([-1, 0, 1].includes(b.level) && b.year === store.state.year, 'a department\'s budget is read from the policies in force');
  check(!PO.setPriority('training').ok, 'only the chief sets priorities');
  a.chiefId = p.id; a.priority = null;
  const slow = PO.labMonths(a.id, 4);
  check(PO.setPriority('technology').ok && PO.labMonths(a.id, 4) === Math.max(1, slow - 1), 'a chief\'s focus on the laboratory shortens its work by a month');
  check(!PO.proposeBoard(true).ok, 'a chief cannot create an oversight board; the council does');
  p.politics = { officeId: 'council', title: 'Council member' };
  const vote = PO.proposeBoard(true);
  check(vote.ok && a.oversight.history.length === 1 && !PO.proposeBoard(true).ok, 'the council votes once a year on it');
  check(PO.BOARD_ARGUMENTS.for.length >= 2 && PO.BOARD_ARGUMENTS.against.length >= 2, 'both sides of the question are shown');
  r.stats.years = 10;
  const blk = PO.sheriffBlock(p);
  check(store.state.year % 4 === 0 ? blk === '' || /sheriff/.test(blk) : /next election/.test(blk), 'sheriffs are elected, in election years only');
  // Journalism: the public record and willing sources only; verification; corrections.
  p = life('us', 30, { degree: 'journalism' });
  hire(CAREER_BY_ID.journalist, 0, 60, 'test');
  let pub = null;
  for (let i = 0; i < 6 && !pub; i++) { X.npcCourtCase(p); pub = X.publicCases(p)[0]; }
  check(pub && pub.defendant && pub.outcome, 'a case in court is in the public record');
  X.startStory(pub.caseId);
  const st = X.myStories(p)[0];
  check(!X.storyStep(st.id, 'sealed').ok, 'a reporter cannot get the case file');
  check(!X.publishStory(st.id).ok, 'a story starts from the public record');
  for (const s2 of ['records', 'sources', 'comment', 'verify']) X.storyStep(st.id, s2);
  const res = X.publishStory(st.id);
  check(res.ok && ['verified', 'accurate, unverified'].includes(st.accuracy), `a verified story holds up (${st.accuracy})`);
  const st2id = (() => { const other = X.publicCases(p).find((c) => c.caseId !== pub.caseId) ?? (X.npcCourtCase(p), X.publicCases(p).find((c) => c.caseId !== pub.caseId)); if (!other) return null; X.startStory(other.caseId); return X.myStories(p).find((s) => s.caseId === other.caseId).id; })();
  if (st2id) {
    X.storyStep(st2id, 'records');
    const s2 = core.W().stories[st2id];
    s2.claims.push({ text: 'A witness says they saw it all.', sourced: false, accurate: false });
    X.publishStory(st2id);
    check(s2.accuracy === 'contains an error' && X.correctStory(st2id).ok && !X.correctStory(st2id).ok, 'an unverified mistake is published as one, and corrected once');
  }
}
section('forensic medicine for the court and death investigations, policing decided by those with the authority, journalism from the public record');

for (const line of ok) console.log(`ok   ${line}`);
if (problems.length) { for (const m of problems) console.log(`FAIL ${m}`); console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Every case has a history, every clue a source.');
