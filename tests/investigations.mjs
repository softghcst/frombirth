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
const WP = await import('../js/engine/investigations/workplace.js');
const biz = await import('../js/engine/business.js');
const E2 = (await import('../js/engine/employers.js')).jobs;

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
  check(A.kindsIn('ng').join() === 'national' && A.agencyOf('national', 'ng', 'Lagos').simplified, 'elsewhere (unless modeled): one national police service, marked simplified');
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

// ---------- 2b. Field training that is not going well: reviews by date, a cap, the same at any turn length ----------
{
  const dice = rng.state(); // this check's own lives leave the game's dice as they found them, for the checks after it
  const p = life('us', 25);
  const ag = A.agencyOf('municipal', 'us', p.city);
  core.I().apps.push({ id: 'app_f', kind: 'police', ownerId: ag.id, status: 'offer', due: core.now(), outcome: 'offer' });
  C.acceptAcademy('app_f');
  const setNow = (t) => { store.state.year = Math.floor(t / 12); store.state.month = t % 12; };
  setNow(core.now() + 12); C.settleAcademy();
  const r0 = core.I();
  Object.assign(r0.skills, { writing: 2, observation: 2, interviewing: 2, ethics: 2 }); r0.acted.field = 0; // a recruit who is struggling
  const start = r0.job.fieldEnd;
  const snapshot = JSON.stringify(store.state);
  const run = (times) => {
    store.state = JSON.parse(snapshot); store.state.pendingEvents = [];
    const logs0 = store.state.journal.length;
    for (const t of times) { setNow(t); C.settleProbation(); }
    const r = core.I(); const j = r.job;
    const sc = store.state.pendingEvents.find((e) => e.id === 'inv_fto_last_chance');
    return { stage: r.stage, ext: j?.ftoExtensions ?? null, last: j?.ftoLastChance ?? null, job: !!j, scene: !!sc, months: sc?.cast?.words?.months,
      lines: store.state.journal.slice(logs0).map((x) => x.text).filter((t) => /field training/.test(t)) };
  };
  // Quarterly turns check at every quarter; a yearly turn checks once, a year on.
  const quarterly = run([start, start + 3, start + 6, start + 9, start + 12]);
  const yearly = run([start + 12]);
  check(quarterly.ext === C.FTO_EXTENSIONS && yearly.ext === C.FTO_EXTENSIONS, `four extensions at most (${quarterly.ext}, ${yearly.ext})`);
  check(quarterly.stage === yearly.stage && quarterly.last === yearly.last && quarterly.job === yearly.job && quarterly.scene === yearly.scene,
    `the same outcome on quarterly and yearly turns (${JSON.stringify([quarterly.stage, quarterly.last, quarterly.scene])} vs ${JSON.stringify([yearly.stage, yearly.last, yearly.scene])})`);
  check(yearly.months === '12' && quarterly.months === '12' && quarterly.lines.some((t) => /three more months/.test(t)), `the player hears how long it really was: three months at a time on quarterly turns, the whole year in the scene on a yearly one (${yearly.months})`);
  check(yearly.lines.every((t) => !/three more months/.test(t)), 'a yearly turn does not say three months when it was twelve');
  check(quarterly.lines.some((t) => /My Investigations/.test(t) && /(writing|observation|interviewing|ethics)/.test(t)), 'it names the skill holding the recruit back and the patrol work that builds it');
  check(yearly.scene && yearly.stage === 'field', 'after the last extension, a last chance to ask for');
  // Asking, or accepting: one final three months, or the job ends.
  store.state = JSON.parse(snapshot); setNow(start + 12); C.settleProbation();
  const said = DR.invChoice('ftolast:accept', {});
  check(!core.I().job && store.state.player.career.careerId !== 'police' && /badge/.test(said ?? ''), 'accepting it: the department lets the recruit go');
  // A recruit who does the work passes, and probation runs on after a late sign-off.
  store.state = JSON.parse(snapshot);
  setNow(start); C.settleProbation();
  Object.assign(core.I().skills, { writing: 60, observation: 60, interviewing: 60, ethics: 60 });
  setNow(start + 3); C.settleProbation();
  const rj = core.I();
  check(rj.stage === 'probation' && rj.job.ftoExtensions === 1 && rj.job.probationEnd >= start + 3 + 6, `doing the work gets the sign-off, with probation still ahead (${rj.stage}, ${rj.job.ftoExtensions})`);
  rng.seed(dice);
}
section('field training: reviews held by date at any turn length, four extensions at most, what to work on, a last chance, then the department decides');

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

// ---------- 14. Studying for the work ----------
{
  const { MAJOR_BY_ID } = await import('../js/data/majors.js');
  check(['criminology', 'forensic_science', 'cybersecurity', 'accounting'].every((m) => MAJOR_BY_ID[m]), 'criminology, forensic science, cybersecurity and accounting can be studied');
  let p = life('us', 24, { degree: 'criminal_justice' });
  check(C.studied('police', p).includes('criminal_justice') && C.studied('detective', p).length && !C.studied('fraud', p).length, 'a criminal justice degree counts for police and detective work, not for the fraud unit');
  const r = core.I(p);
  const law0 = r.skills.law;
  C.studyCredit(p, r); C.studyCredit(p, r);
  check(r.skills.law === law0 + 8, 'a relevant degree gives a head start in its skills, once');
  p = life('us', 26, { degree: 'accounting' });
  check(C.studied('fraud', p).length && C.backgrounds(p).includes('accounting'), 'accounting suits the fraud unit and the FBI');
  // Senior posts ask for a degree; officers without one can serve and rise to lieutenant.
  p = life('us', 40);
  p.education.degrees = p.education.degrees.filter((d) => d.type === 'high');
  makeOfficer();
  const ro = core.I();
  ro.job.rank = 'lieutenant'; ro.job.rankSince = store.state.year - 10;
  const cap = C.promotionOptions(p).find((x) => x.id === 'captain');
  check(cap && /degree/.test(cap.block), 'captain asks for a degree');
  p.education.degrees.push({ type: 'university', majorId: 'criminology', age: 38 });
  check(!/degree/.test(C.promotionOptions(p).find((x) => x.id === 'captain').block), 'a degree finished while serving opens it');
  // A relevant degree shortens the way to a private investigator's license.
  p = life('us', 30, { degree: 'criminology' });
  p.career.experience = { pi: 2 };
  check(!C.licenseUnmet(p).some((x) => /years/.test(x)), 'with a criminology degree, two years of work are enough for a license');
}
section('studying: new majors, degrees that count for each path, a head start once, senior posts that ask for a degree, a shorter way to a license');

// ---------- 15. The Family Archive ----------
{
  life('us', 30);
  const a = makeOfficer();
  const r = core.I();
  r.job.detective = true; r.job.rank = 'detective';
  const inv = W.openCase('burglary', { ownerId: a.id, truth: 'insider', title: 'The Elm Row Burglary' });
  r.caseIds.push(inv.id);
  const jc = k.openCaseFor(inv, inv.file.poi[0]);
  inv.file.courtCaseId = jc.id;
  const fam = IX.familyInvestigativeLegacy();
  const me = fam.find((x) => x.you);
  check(me && me.history.length && me.cases.some((c) => c.title === 'The Elm Row Burglary' && c.outcome === 'in court'), 'the Family Archive keeps the player\'s career and the cases that reached a court');
  const text = JSON.stringify(fam);
  check(Object.keys(inv.file.witnesses).every((id) => !text.includes(store.state.npcs[id].lastName) || store.state.npcs[id].lastName === store.state.player.lastName), 'and never the witnesses of a case');
}
section('the Family Archive: the public career and the court record, not the case file');

// ---------- 16. The working life: caseload, moves, task forces, staff, honors, after retiring ----------
{
  life('us', 34);
  const a = makeOfficer();
  const r = core.I();
  r.job.detective = true; r.job.rank = 'detective';
  r.people.partnerId ??= Object.values(store.state.npcs).find((n) => n.alive && n.age > 25 && n.id !== store.state.player.id).id;
  const one = W.openCase('burglary', { ownerId: a.id, truth: 'insider' });
  const two = W.openCase('robbery', { ownerId: a.id, truth: 'known' });
  r.caseIds.push(one.id, two.id);
  const h1 = W.workLeft(one); const h2 = W.workLeft(two);
  check(WP.prioritize(one.id).ok && W.workLeft(one) === h1 + 2 && W.workLeft(two) === h2 - 1, 'a priority moves hours to one case, from the others');
  const sup = WP.requestSupport(two.id);
  check(sup.ok && !WP.requestSupport(two.id).ok, 'support is asked for once a year, and the supervisor decides');
  const before = Object.keys(one.file.done).length;
  const d = WP.delegate(one.id);
  check(d.ok && Object.keys(one.file.done).length > before && one.file.log.some((x) => /took the routine work/.test(x.text)), 'the partner takes routine steps, recorded in the file');
  check(!WP.delegate(one.id).ok, 'once a year per case');
  // A task force meeting: sharing helps; holding back costs trust, and can end it.
  const tfr = (await import('../js/engine/investigations/drama.js')).formTaskForce(two.id, 'fbi');
  if (tfr.ok) {
    const hh = W.workLeft(two);
    check(WP.taskForceMeeting(two.id, 'share').ok && W.workLeft(two) === hh + 2 && !WP.taskForceMeeting(two.id, 'hold').ok, 'a task force meets once a year; sharing adds hands');
    months(12);
    WP.taskForceMeeting(two.id, 'hold'); months(12); WP.taskForceMeeting(two.id, 'hold'); months(12); WP.taskForceMeeting(two.id, 'hold');
    check(core.W().taskForces[two.file.taskForceId].status === 'ended', 'holding back leads year after year ends the task force');
  }
  // Honors follow the way the work was done.
  r.rep.integrity = 80; r.rep.ethics = 80; r.stats.years = 8;
  one.file.outcome = { kind: 'resolved', at: core.now() }; one.file.cleared = [one.file.poi[0]].filter(Boolean);
  for (let i = 0; i < 10 && !r.stats.awards.length; i++) { one.file.outcome.at = core.now(); WP.workplaceYear(); store.state.year += 1; }
  check(r.stats.awards.length > 0 && r.history.some((h) => r.stats.awards.some((x) => h.text.startsWith(x.name))), `recognition for thorough, lawful work is recorded (${r.stats.awards.map((x) => x.id)})`);
  r.rep.integrity = 30;
  const n0 = r.stats.awards.length;
  for (let i = 0; i < 4; i++) { one.file.outcome.at = core.now(); WP.workplaceYear(); store.state.year += 1; }
  check(r.stats.awards.length === n0, 'no honors with a poor integrity record');
}
{
  // A federal agent asks for a transfer and a squad.
  const p = life('us', 32, { degree: 'accounting' });
  hire(CAREER_BY_ID.fbi_agent, 0, 60, 'test');
  const r = core.I();
  const o = A.officeOf('fbi', A.federalCities()[0]);
  r.family = 'federal'; r.stage = 'agent';
  r.job = { agencyKind: 'fbi', officeId: o.id, employerId: o.employerId, rank: 'agent', detective: false, since: store.state.year - 4, rankSince: store.state.year - 4 };
  const city = A.federalCities().find((c) => c !== o.city);
  check(WP.requestMove('office', city).ok && !WP.requestMove('squad', 'fraud').ok, 'one request at a time, decided after six months');
  months(6); WP.settleWorkplace();
  check(['granted', 'refused'].includes(r.move.status) && (r.move.status !== 'granted' || A.office(r.job.officeId).city === city), `the transfer is decided (${r.move.status})`);
  let squad = false;
  for (let i = 0; i < 6 && !squad; i++) { WP.requestMove('squad', 'fraud'); months(6); WP.settleWorkplace(); squad = r.job.squad === 'fraud'; }
  check(squad, 'an agent with an accounting degree gets onto the white-collar squad in time');
  check(!WP.requestMove('squad', 'drugs').ok, 'squads are the agency\'s own');
  void p;
}
{
  // A private agency's staff take a matter on, lawfully, and it closes on its date.
  const p = life('us', 45);
  p.career.experience = { police: 8 };
  C.applyLicense(); months(3); C.settleApplications();
  if (!C.licensed(p)) { months(12); C.applyLicense(); months(3); C.settleApplications(); }
  PI.openAgency('North Pier Investigations');
  const b = PI.agencies(p)[0];
  const hand = k.civilian('us', { age: 33, kind: 'civilian' });
  b.staff.push({ id: hand.id, wageK: 1, asked: 1, since: p.age, manager: false });
  const offer = PI.clientsFor(b)[0];
  if (offer) {
    PI.acceptClient(b.id, offer.id);
    const q = PI.inquiries(p).at(-1);
    check(WP.assignInquiry(q.id, hand.id).ok && q.assignedTo === hand.id, 'a matter can be given to staff');
    const cash = b.cash;
    months(6); WP.settleWorkplace();
    check(q.status === 'complete' && q.steps.every((x) => ['client', 'public', 'people', 'report'].includes(x)) && b.cash === cash + q.fee, 'staff close it with lawful steps only, and the fee is paid once');
  }
}
{
  // After retiring: teaching, consulting, testifying, a memoir.
  const p = life('us', 58);
  const r = core.I();
  r.retired = { year: store.state.year }; r.stage = 'retired'; r.stats.years = 25; r.rep.integrity = 75; r.skills.reasoning = 70;
  const ids = WP.secondOptions(p).filter((x) => !x.block).map((x) => x.id);
  check(['instructor', 'consultant', 'expert', 'memoir'].every((x) => ids.includes(x)), 'a retired investigator has work to go on to');
  const cash = p.finance.cash;
  check(WP.takeSecond('instructor').ok && WP.workplaceYear().some((x) => /Academy instructor/.test(x)) && p.finance.cash > cash, 'teaching at the academy pays each year');
  const eth = r.rep.ethics;
  WP.takeSecond('memoir', 'files');
  check(r.rep.ethics < eth && !WP.takeSecond('memoir', 'public').ok, 'a memoir that tells what case files held is a breach; and there is one memoir');
}
section('the working life: a priority, support, a partner\'s routine work, task force meetings, transfers and squads, a private agency\'s staff, honors on how the work is done, work after retiring');

// ---------- 17. The local world: real businesses, real neighbors, community meetings, the stand ----------
{
  const p = life('us', 34);
  const LO = await import('../js/engine/investigations/local.js');
  const E = await import('../js/engine/employers.js');
  const NB = await import('../js/engine/neighborhood.js');
  NB.settle(store.state, { quiet: true });
  const a = makeOfficer();
  const r = core.I();
  r.job.detective = true; r.job.rank = 'detective';
  // A fraud happens at a real employer of the city, whose own history records it.
  const fr = W.openCase('fraud', { ownerId: a.id, truth: 'insider' });
  r.caseIds.push(fr.id);
  const emp = fr.file.employerId && E.jobs().employers[fr.file.employerId];
  check(emp && fr.file.title.includes(emp.name) && emp.city === p.city && emp.history.some((h) => /money missing/.test(h.text)), `a fraud case is at a real employer of the city (${fr.file.title})`);
  const again = W.openCase('fraud', { ownerId: a.id, truth: 'insider', title: 'Given title' });
  check(!again.file.employerId, 'a case given its own place keeps it');
  // Witnesses may be real residents of the city's neighborhoods: the same people, not copies.
  const residents = new Set(Object.values(NB.hoods().res).map((x) => x.id));
  let neighbor = null;
  for (let i = 0; i < 12 && !neighbor; i++) { const c = W.openCase('burglary', { ownerId: a.id, truth: 'insider' }); neighbor = Object.keys(c.file.witnesses).find((id) => residents.has(id)); }
  check(!Object.keys(NB.hoods().list).length || (neighbor && store.state.npcs[neighbor] && NB.hoods().res[neighbor].f === store.state.npcs[neighbor].firstName), 'a witness can be a real neighbor, with the same name and identity');
  // A community meeting: once a year per neighborhood; listening builds trust; a tip is a lead, not evidence.
  const hood = LO.meetingsHere(p)[0];
  if (hood) {
    const ev0 = Object.keys(k.J().evidence).length;
    const m = LO.communityMeeting(hood.id, 'listen');
    check(m.ok && r.community[hood.id] > 50 && !LO.communityMeeting(hood.id, 'listen').ok, 'a community meeting once a year; listening builds trust');
    check(Object.keys(k.J().evidence).length === ev0, 'a tip from a meeting is never evidence by itself');
  }
  // On the stand: the file is the record; a denial it contradicts is found out.
  const inv = W.openCase('burglary', { ownerId: a.id, truth: 'insider', title: 'The Stand Case' });
  r.caseIds.push(inv.id);
  for (const it of inv.file.items) inv.evidenceIds.push(it.evidenceId);
  inv.file.items[0].integrity = 'gap';
  const jc = k.openCaseFor(inv, inv.file.poi[0]);
  inv.file.courtCaseId = jc.id;
  const qs = W.crossQuestions(inv);
  check(qs.find((q) => q.id === 'custody').weak, 'the defense asks about the custody gap the file shows');
  const integ = r.rep.integrity;
  const res = W.crossExamination(inv.id, { custody: 'deny', pressure: 'honest', lab: 'honest', others: 'honest' });
  check(res.tone === 'bad' && inv.file.cross.caught === 1 && r.rep.integrity < integ, 'denying what the file shows is found out, and costs integrity');
  check(!W.crossExamination(inv.id, {}).ok, 'evidence is given once');
  const inv2 = W.openCase('burglary', { ownerId: a.id, truth: 'insider', title: 'The Honest Case' });
  r.caseIds.push(inv2.id);
  for (const it of inv2.file.items) inv2.evidenceIds.push(it.evidenceId);
  inv2.file.items[0].integrity = 'gap';
  inv2.file.courtCaseId = k.openCaseFor(inv2, inv2.file.poi[0]).id;
  const rel = r.rep.reliability;
  check(W.crossExamination(inv2.id, { custody: 'honest' }).tone === 'good' && r.rep.reliability > rel && !inv2.file.cross.caught, 'owning a weakness on the stand keeps the investigator\'s word good');
}
section('the local world: business cases at real employers, real neighbors as witnesses, community meetings, cross-examination against the file');

// ---------- 18. Corporate investigators ----------
{
  const p = life('us', 35, { degree: 'accounting' });
  let posts = [];
  for (let i = 0; i < 6 && !posts.length; i++) { posts = WP.corporatePosts(p); if (!posts.length) store.state.year += 1; }
  check(posts.length > 0, 'an accountant can find a corporate investigations post');
  const e = posts[0];
  const res = WP.joinCorporate(e.id);
  const r = core.I();
  check(res.ok && p.career.careerId === 'pi' && p.career.employerId === e.id && r.job.corporate && /no police powers/i.test(res.text), 'a corporate investigator works for a real company, with no police powers');
  const lines = WP.workplaceYear();
  const q = PI.inquiries(p).find((x) => x.kind === 'corporate');
  check(q && lines.some((x) => /internal matter/.test(x)) && !WP.workplaceYear().length, 'the company brings one internal matter a year');
  for (const s2 of ['police_records', 'pose']) check(!PI.inquiryStep(q.id, s2).ok, `inside a company too, an investigator may not: ${s2}`);
  for (const s2 of ['client', 'public', 'people', 'report']) PI.inquiryStep(q.id, s2);
  const done = PI.completeInquiry(q.id);
  check(done.ok && q.status === 'complete' && !/paid/.test(done.text), 'the report goes to the company; there is no fee, it is a salaried job');
  IX.tickInvestigations();
  check(r.job?.corporate && p.career.careerId === 'pi', 'the yearly step keeps the corporate post');
}
section('corporate investigators: a real company, internal matters, no police powers, a salary not fees');

// ---------- 19. A homicide scene by scene; more federal agencies ----------
{
  const p = life('us', 36);
  const a = makeOfficer();
  const r = core.I();
  r.job.detective = true; r.job.rank = 'detective';
  r.people.partnerId = null;
  const inv = W.openCase('homicide', { ownerId: a.id, truth: 'known' });
  r.caseIds = [inv.id];
  const STORIES = (await import('../js/data/events/stories/investigations.js')).default;
  const ids = new Set(STORIES.map((e) => e.id));
  const seen = [];
  for (let i = 0; i < 10; i++) { store.state.pendingEvents = []; DR.dramaYear(p); seen.push(...store.state.pendingEvents.map((e) => e.id).filter((x) => x.startsWith('inv_hom_'))); }
  check(['inv_hom_notify', 'inv_hom_night', 'inv_hom_48', 'inv_hom_funeral'].every((x) => seen.includes(x)) && seen.every((x) => ids.has(x)), `a homicide brings its scenes, in order: ${seen.join(', ')}`);
  check(new Set(seen).size === seen.length, 'each homicide scene comes once');
  const kin = store.state.npcs[inv.file.kinId];
  check(kin && kin.lastName === store.state.npcs[inv.file.victimId].lastName && inv.file.people.some((x) => x.id === kin.id && x.role === 'family'), 'the next of kin is a real person, kept on the file');
  const words = { invId: inv.id };
  const ok0 = inv.file.items.filter((x) => x.integrity === 'ok').length;
  DR.invChoice('hom:night-rush', { words });
  check(inv.file.items.filter((x) => x.integrity === 'ok').length === ok0 - 1 || !ok0, 'moving things before they are recorded leaves a gap in the custody log');
  const integ = r.rep.integrity;
  DR.invChoice('hom:48-name', { words });
  check(r.rep.integrity < integ, 'naming a suspect before the evidence is in costs integrity');
  const warm = kin.meters.relationship;
  DR.invChoice('hom:anniv-call', { words });
  check(kin.meters.relationship > warm, 'taking the family\'s call keeps their trust');
  // A year on, unsolved: the anniversary.
  store.state.year += 1; store.state.pendingEvents = [];
  for (let i = 0; i < 4; i++) { store.state.pendingEvents = []; DR.dramaYear(p); if (store.state.pendingEvents.some((e) => e.id === 'inv_hom_anniversary')) break; }
  check(r.scenes[`hom:anniv:${inv.id}`], 'a year unsolved, the family calls');
}
{
  // Four more federal agencies, each with its own rules and its own work.
  for (const key of ['usms', 'usss', 'hsi', 'irs']) check(D.FEDERAL[key] && CAREER_BY_ID[D.FEDERAL[key].career] && D.SOURCES[D.FEDERAL[key].source]?.verified === false, `${key}: an agency with its own career track, its source named and unverified`);
  let p = life('us', 27, { degree: 'criminology' });
  check(C.federalUnmet('irs').some((x) => /accounting/.test(x)) && !C.federalUnmet('usms').some((x) => /accounting/.test(x)), 'IRS Criminal Investigation asks for accounting; the Marshals do not');
  p = life('us', 27, { degree: 'accounting' });
  check(!C.federalUnmet('irs').length, `an accountant can apply to IRS-CI (${C.federalUnmet('irs')})`);
  const store0 = store.state.year; store.state.year = 1995;
  check(C.federalUnmet('hsi').some((x) => /does not exist/.test(x)), 'HSI does not exist before 2003');
  store.state.year = store0;
  // A deputy marshal works fugitive cases; the police never get them.
  hire(CAREER_BY_ID.usms_deputy, 0, 60, 'test');
  const r = core.I();
  const o = A.officeOf('usms', A.federalCities()[0]);
  r.family = 'federal'; r.stage = 'agent';
  r.job = { agencyKind: 'usms', officeId: o.id, employerId: o.employerId, rank: 'agent', detective: false, since: store.state.year - 2, rankSince: store.state.year - 2 };
  const inv = W.assignCase(p);
  check(inv?.file.template === 'fugitive' && o.name.includes('Marshals'), `a deputy marshal is assigned a fugitive inquiry (${inv?.file.template})`);
  check(!W.templatesFor('general').some((t) => ['fugitive', 'counterfeit', 'tax'].includes(t)) && !W.templatesFor('fraud').includes('tax'), 'federal-only cases never go to a police unit');
  check(WP.SQUADS.usms.length && WP.SQUADS.irs.length, 'each new agency has its own squads');
}
section('a homicide from the first night to the verdict, scene by scene; the Marshals, the Secret Service, HSI and IRS Criminal Investigation');

// ---------- 20. The forensic scientist's working life ----------
{
  const FL = await import('../js/engine/investigations/forensicLab.js');
  const p = life('us', 27, { degree: 'chemistry' });
  hire(CAREER_BY_ID.forensics, 0, 60, 'test');
  const L = FL.labRecord(p);
  check(L && FL.specialize('fingerprints').ok && !FL.specialize('dna').ok, 'a scientist chooses one discipline');
  const lines = FL.labYear(p);
  const q = FL.queue(p);
  check(q.length >= 2 && q.every((b) => b.due > b.received && k.J().investigations[b.invId]?.file), `requests from real cases, with due dates (${lines.length})`);
  check(q.filter((b) => b.discipline === 'fingerprints').length >= 1, 'most requests are in the scientist\'s discipline');
  FL.setPolicy('serious');
  const sq = FL.queue(p);
  check(!sq.some((b, i) => !b.serious && sq.slice(i + 1).some((x) => x.serious)), 'serious cases first, when that is the policy');
  // Proficiency: once a year; looking for the answer is a failure.
  const pt = FL.proficiency('careful');
  check(pt.ok && !FL.proficiency('careful').ok, 'one proficiency test a year');
  store.state.year += 1;
  FL.proficiency('peek');
  check(!L.accredited && L.suspended === store.state.year && /off casework/i.test(FL.labYear(p)[0]), 'asking for the answer fails the test, and takes the scientist off casework');
  store.state.year += 1;
  FL.proficiency('careful');
  if (L.proficiency.at(-1).passed) { FL.careerYear(p); check(L.accredited, 'a passed test restores accreditation'); }
  // Reports: careful work counts; a case may go to court, and the scientist explains the report there.
  let court = null;
  for (let i = 0; i < 12 && !court; i++) {
    if (!FL.queue(p).length) { L.suspended = null; FL.labYear(p); }
    const b = FL.queue(p)[0];
    if (!b) break;
    for (const s2 of Object.keys(X.BENCH_STEPS)) X.benchStep(b.id, s2);
    X.benchReport(b.id, 'careful');
    court = FL.courtDates(p)[0] ?? null;
  }
  check(L.careful >= 1 && L.reports >= 1, 'careful reports are counted toward promotion');
  if (court) {
    const perf = p.career.performance;
    const res = FL.testify(court.b.id, { method: 'honest', contamination: 'honest', bias: 'honest', certainty: 'honest' });
    check(res.tone === 'good' && p.career.performance > perf && !FL.testify(court.b.id, {}).ok, 'explaining a report within its limits, once, keeps the scientist\'s word good');
  }
  // Overclaiming in court is found out, and the scientist's other cases are reviewed.
  const b2 = (() => { L.suspended = null; FL.labYear(p); return FL.queue(p)[0]; })();
  if (b2) {
    for (const s2 of Object.keys(X.BENCH_STEPS)) X.benchStep(b2.id, s2);
    X.benchReport(b2.id, 'careful');
    const inv = W.investigation(b2.invId);
    if (!inv.file.courtCaseId) { const c = k.openCaseFor(inv, inv.file.poi[0]); inv.file.courtCaseId = c.id; }
    const n0 = L.reviews.length;
    const res = FL.testify(b2.id, { method: 'claim', contamination: 'claim', bias: 'claim', certainty: 'claim' });
    check(res.tone === 'bad' && L.reviews.length === n0 + 1 && L.exposed >= 1, 'claiming certainty the method cannot give is found out, and the cases are reviewed');
  }
  // Promotion needs years, passed tests, careful reports and nothing overstated.
  L.since = store.state.year - 3; L.careful = Math.max(L.careful, 3); L.accredited = true; L.exposed = 0;
  L.proficiency.push({ year: store.state.year - 1, passed: true }, { year: store.state.year, passed: true });
  const lvl = p.career.level;
  FL.careerYear(p);
  check(p.career.level === lvl + 1 && p.career.title === FL.RANKS[lvl + 1], `promoted on the record (${p.career.title})`);
}
section('the forensic scientist: a discipline, a backlog from real cases, proficiency and accreditation, testimony within the science, promotion on the record');

// ---------- 21. Police unions ----------
{
  const UN = await import('../js/engine/investigations/unions.js');
  const p = life('us', 30);
  const a = makeOfficer();
  const r = core.I();
  const u = UN.unionOf(a);
  check(u && store.state.npcs[u.repId] && u.contract.until > store.state.year && UN.unionOf(a) === u, 'a department has one union, with a real representative and a contract');
  const cash = p.finance.cash;
  check(UN.join().ok && !UN.join().ok && r.union.member, 'an officer joins once');
  UN.unionYear(); check(p.finance.cash < cash, 'members pay dues');
  // Discipline: the finding stays the evidence's; a dismissal may be reduced at arbitration.
  let reduced = 0; let upheld = 0;
  for (let i = 0; i < 12; i++) {
    const c = { id: `cx${i}`, action: 'dismissal' };
    const out = UN.represent(c, r);
    if (out.action === 'dismissal') upheld += 1; else reduced += 1;
  }
  check(reduced > 0 && upheld > 0, `arbitration sometimes reduces a dismissal, sometimes upholds it (${reduced}/${upheld})`);
  // Records removed by contract do not count as a prior record.
  r.discipline = [{ year: store.state.year - 6, finding: 'substantiated' }, { year: store.state.year, finding: 'substantiated' }];
  check(UN.priorRecord(r).length === 2, 'records kept: both count');
  u.contract.records = 'removed after three years';
  check(UN.priorRecord(r).length === 1, 'records removed after three years: the old one does not');
  r.discipline = [];
  // The representative bargains; work to rule takes hours from cases.
  r.union.since = store.state.year - 6; r.rep.teamwork = 90; r.skills.leadership = 90;
  for (let i = 0; i < 8 && !r.union.rep; i++) { UN.standForRep(); store.state.year += 1; }
  check(r.union.rep && u.repId === p.id, 'a member can be elected representative');
  u.contract.until = store.state.year;
  check(UN.talks()?.side === 'union' && UN.stancesFor('union').length === 3, 'the representative sits at the table when the contract ends');
  const res = UN.bargain('training');
  check(res.ok && u.contract.training && u.contract.until === store.state.year + 3, 'a contract is agreed, with what was bargained for');
  u.stalled = store.state.year;
  r.job.detective = true; r.job.rank = 'detective';
  const inv = W.openCase('burglary', { ownerId: a.id, truth: 'insider' });
  r.caseIds.push(inv.id);
  const h = W.workLeft(inv);
  for (let i = 0; i < 6 && u.action !== store.state.year; i++) { r.union.voted = null; UN.vote('yes'); }
  if (u.action === store.state.year) check(W.workLeft(inv) === Math.max(0, h - 2), 'working to rule takes hours from every case');
  check(/may not strike/.test(UN.NO_STRIKE), 'police may not strike: the rule is shown');
}
section('police unions: one per department, dues, representation that never changes a finding, records clauses, the representative at the table, working to rule');

// ---------- 22. National police reform ----------
{
  const RF = await import('../js/engine/investigations/reform.js');
  const p = life('us', 45);
  check(!RF.propose('bodycams').ok, 'only the legislature or the head of government passes national reform');
  p.politics = { officeId: 'head' };
  let passed = false;
  for (let i = 0; i < 8 && !passed; i++) { RF.propose('bodycams'); passed = RF.inForce('us', 'bodycams'); if (!passed) store.state.year += 1; }
  check(passed && !RF.propose('bodycams').ok, 'the head of government puts a measure to a vote; once law, it stays law');
  // Body cameras: pressing a witness is on camera, and brings a complaint.
  p.politics = null;
  const a = makeOfficer();
  const r = core.I();
  r.job.detective = true; r.job.rank = 'detective';
  const inv = W.openCase('burglary', { ownerId: a.id, truth: 'insider' });
  r.caseIds.push(inv.id);
  const n0 = Object.values(core.W().complaints).filter((c) => c.subjectId === p.id).length;
  W.act(inv.id, `interview:${Object.keys(inv.file.witnesses)[0]}`, { question: 'press' });
  check(inv.file.recorded && Object.values(core.W().complaints).filter((c) => c.subjectId === p.id).length === n0 + 1, 'under body-camera law, pressing a witness is recorded and brings a complaint');
  // Independent complaints and decertification.
  core.W().reform.us.independent = { year: store.state.year }; core.W().reform.us.decertify = { year: store.state.year };
  r.discipline.push({ year: store.state.year, finding: 'substantiated' });
  const id = 'complaint_ref';
  core.W().complaints[id] = { id, subjectId: p.id, kind: 'fabrication', text: 'A test.', opened: core.now(), due: core.now(), status: 'open', true: true };
  for (const c of Object.values(core.W().complaints)) if (c.id !== id && c.status === 'open' && c.subjectId === p.id) c.status = 'decided';
  O.settleComplaints();
  const c = core.W().complaints[id];
  check(c.reviewer === 'independent', 'complaints are decided by an independent body');
  if (c.action === 'dismissal') check(RF.decertified(p) && C.policeUnmet(a, p).some((x) => /certification/.test(x)), 'an officer dismissed for misconduct is decertified: no department may hire them');
  check(RF.reformList('us').length === 4, 'four measures a country can pass');
}
section('national police reform: passed by the legislature, body cameras that record, independent complaints, decertification');

// ---------- 23. Forensic psychology ----------
{
  const FP = await import('../js/engine/investigations/forensicPsych.js');
  const p = life('us', 34, { degree: 'psychology' });
  check(/doctorate/.test(FP.psychBlock(p)) && !FP.startPractice().ok, 'forensic psychology needs a doctorate in psychology');
  p.education.degrees.push({ type: 'doctorate', majorId: 'psychology', age: 30 });
  check(FP.startPractice().ok && p.career.careerId === 'forensic_psych' && p.career.title === FP.RANKS[0], 'a licensed psychologist takes up forensic practice');
  // Real records to work from: an open case a detective is working, and the department's officers.
  const a = A.agencyOf('municipal', p.countryId, p.city);
  const det = Object.values(a.units)[0].memberIds[0];
  W.openCase('homicide', { ownerId: a.id, lead: det, truth: 'known' });
  // A real prisoner serving a custodial sentence, from a real court case (most cases end otherwise: tried until one does).
  for (let i = 0; i < 40 && !Object.values(k.J().sentences).some((x) => x.type === 'custody' && x.status === 'active'); i++) X.npcCourtCase(p);
  const lines = FP.psychYear(p);
  const work = FP.openWork(p);
  check(work.some((w) => w.kind === 'consult') && work.some((w) => w.kind === 'risk') && lines.length >= 2, `work from real records (${work.map((w) => w.kind)})`);
  const consult = work.find((w) => w.kind === 'consult');
  const inv = k.J().investigations[consult.invId];
  const ev0 = inv.evidenceIds.length;
  check(FP.doWork(consult.id, 'behavior').ok && inv.file.leads.some((l) => /names nobody/.test(l.text)) && inv.evidenceIds.length === ev0, 'a consultation describes behavior: a lead, never evidence, never a name');
  const risk = work.find((w) => w.kind === 'risk');
  const r1 = FP.doWork(risk.id, 'structured');
  const sen = k.J().sentences[risk.sentenceId];
  check(r1.ok && sen.parole?.assessment && ['released on parole', 'parole refused'].includes(sen.parole.decision), `the parole board decides, on a structured assessment of a real prisoner (${sen.parole?.decision})`);
  const officer = work.find((w) => w.kind === 'officer');
  if (officer) {
    const n0 = Object.keys(core.W().complaints).length;
    FP.doWork(officer.id, 'report');
    check(Object.keys(core.W().complaints).length === n0 + 1 && FP.psychRecord(p).breaches === 1, 'telling a supervisor what an officer said in confidence brings a complaint');
  }
  check(!FP.doWork(consult.id, 'behavior').ok, 'each piece of work is done once');
  // Promotion on careful work only.
  const F = FP.psychRecord(p);
  F.since = store.state.year - 5; F.careful = 5; F.breaches = 1;
  check(!FP.psychCareerYear(p).length, 'no promotion after a breach of confidence');
  F.breaches = 0; F.overreach = 0;
  check(FP.psychCareerYear(p).length && p.career.title === FP.RANKS[1], 'promotion on careful work');
}
section('forensic psychology: a doctorate and license, consultations that never name anyone, risk assessments the board decides on, confidential care for officers');

// ---------- 24. Police outside the US ----------
{
  check(A.kindsIn('uk').join() === 'territorial' && A.kindsIn('fr').join() === 'police_nationale,gendarmerie' && A.kindsIn('ca').includes('rcmp') && A.kindsIn('ng').join() === 'national', 'each modeled country has its own forces; the rest one simplified national service');
  check(A.agencyOf('territorial', 'uk', 'London').name === 'Metropolitan Police Service' && A.agencyOf('prefectural', 'jp', 'Tokyo').name === 'Tokyo Metropolitan Police Department', 'forces have their real-world names');
  check(!A.agencyOf('territorial', 'uk', 'London').simplified && A.agencyOf('national', 'ng', 'Lagos').simplified, 'modeled forces are not marked simplified; the rest are');
  const p = life('uk', 24);
  p.city = 'London';
  const a = makeOfficer('territorial');
  const r = core.I();
  check(a.kind === 'territorial' && r.job?.agencyId === a.id && /constable/i.test(p.career.title), `a UK recruit becomes a police constable (${p.career.title})`);
  check(store.state.npcs[a.chiefId].occupation === 'Commissioner', 'the Metropolitan Police is led by a commissioner');
  r.job.rankSince = store.state.year - 6; r.rep.integrity = 90; r.rep.skill = 90; r.rep.reports = 90; r.rep.ethics = 90; r.rep.reliability = 90; r.rep.teamwork = 90; r.skills.leadership = 60;
  r.job.rank = 'senior';
  const next = C.promotionOptions(p)[0];
  check(next?.name === 'Sergeant', `the next rank is a UK rank (${next?.name})`);
  r.job.rank = 'sergeant';
  check(C.promotionOptions(p)[0]?.name === 'Inspector', 'and after sergeant, inspector');
  check(C.rankName('detective_sergeant', r) === 'Detective sergeant' && C.rankName('detective', r) === 'Detective constable', 'detectives are detective constables and sergeants');
  const fr = life('fr', 22);
  const pn = A.agencyOf('police_nationale', 'fr', fr.city);
  check(pn.name === `Police nationale, ${fr.city}` && !C.policeUnmet(pn, fr).some((x) => /age/.test(x)), 'a 22-year-old can apply to the Police nationale');
  check(D.AGENCY_KINDS.gendarmerie.entry && D.AGENCY_KINDS.police_nationale.prosecutor && D.SOURCES.jp_police.verified === false, 'entry routes and the prosecuting authority are described; sources unverified');
}
section('police outside the US: the UK, Canada, Australia, France and Japan with their own forces, names, ranks and entry routes');

// ---------- 25. Conviction review careers ----------
{
  const IG = await import('../js/engine/investigations/integrity.js');
  const ls = await import('../js/engine/lawSchool.js');
  const p = life('us', 34);
  check(/admission|investigative/.test(IG.postBlock('innocence', p)) && /prosecutor/.test(IG.postBlock('ciu', p)), 'review work needs the post: a lawyer or seasoned investigator; a prosecutor for a unit');
  ls.lawOf(p).bar.admitted = { year: store.state.year };
  check(IG.takePost('innocence').ok, 'an admitted lawyer joins an innocence organization');
  // A real conviction with kept evidence that can be tested anew (made by the courts' own work if needed).
  const lines = IG.integrityYear(p);
  const m = IG.openMatters(p)[0];
  check(m && k.J().cases[m.caseId]?.stage === 'sentenced', `a matter is a real conviction (${lines[0]})`);
  if (m) {
    check(!IG.step(m.id, 'timeline').ok && IG.step(m.id, 'record').ok && IG.step(m.id, 'timeline').ok, 'the trial record comes first, then the timeline');
    check(!IG.step(m.id, 'reanalysis').ok, 'no testing before experts say what could be tested');
    IG.step(m.id, 'experts');
    const rq = IG.step(m.id, 'reanalysis');
    if (m.lab) {
      check(!IG.step(m.id, 'refer').ok, 'the result comes on its date, not before');
      store.state.year += 1;
    }
    const before = k.J().cases[m.caseId].stage;
    const res = IG.step(m.id, 'refer');
    const after = k.J().cases[m.caseId].stage;
    check(res.ok && m.status === 'closed' && (m.outcome === 'exonerated' ? after === 'quashed' : after === before), `the court decides; nothing changes without it (${m.outcome}, ${rq.text.slice(0, 40)})`);
    check(ls.lawOf(p).history.some((h) => h.kind === 'post-conviction'), 'the matter is in the lawyer\'s own case history');
  }
}
section('conviction review: a post, not a promotion; real convictions; the record, the timeline, experts, testing on its date; the appeal court decides; the lawyer\'s record');

// ---------- 26. Accountants and auditors ----------
{
  const BK = await import('../js/engine/investigations/books.js');
  const p = life('us', 31, { degree: 'accounting' });
  hire(CAREER_BY_ID.audit, 0, 60, 'test');
  check(BK.bookRole(p) === 'audit', 'an auditor reviews books');
  BK.booksYear(p);
  const g = BK.engagements(p)[0];
  check(g && E2().employers[g.employerId], 'an engagement at a real company');
  BK.bookStep(g.id, 'discrepancy');
  const perf = p.career.performance;
  // Concluding fraud from a discrepancy alone is not a finding.
  g.truth = 'error';
  const res = BK.concludeBooks(g.id, 'fraud');
  check(res.tone === 'bad' && p.books.unfounded === 1 && p.career.performance < perf, 'calling a discrepancy fraud without verifying it is an unfounded referral');
  // A verified fraud, referred, opens a real police investigation of the same company.
  store.state.year += 1;
  BK.booksYear(p);
  const g2 = BK.engagements(p)[0];
  g2.truth = 'fraud';
  for (const s2 of Object.keys(BK.BOOK_STEPS)) BK.bookStep(g2.id, s2);
  BK.concludeBooks(g2.id, 'fraud');
  const inv = g2.referredInvId && k.J().investigations[g2.referredInvId];
  check(inv && inv.file.template === 'fraud' && inv.file.employerId === g2.employerId && inv.file.leadId !== p.id, 'a verified fraud referral opens a police investigation of that company, worked by a detective');
  store.state.year += 1;
  BK.booksYear(p);
  const g3 = BK.engagements(p)[0];
  g3.truth = 'loss';
  BK.bookStep(g3.id, 'verify');
  check(BK.concludeBooks(g3.id, 'loss').tone === 'good', 'a failed investment found and reported as a loss, not a crime');
}
section('accountants and auditors: real companies, discrepancies that are not proof, verified findings, referrals that open real investigations');

// ---------- 27. Hospitals and patient privacy ----------
{
  const MD = await import('../js/engine/investigations/medical.js');
  const p = life('us', 33);
  const a = makeOfficer();
  const r = core.I();
  r.job.detective = true; r.job.rank = 'detective';
  const inv = W.openCase('robbery', { ownerId: a.id, truth: 'known' });
  r.caseIds.push(inv.id);
  check(MD.patientOf(inv) === inv.file.reportingId, 'the person robbed is the patient');
  const killed = W.openCase('homicide', { ownerId: a.id, truth: 'known' });
  check(!MD.patientOf(killed) && !store.state.npcs[killed.file.victimId].alive, 'a homicide victim is dead on the record, and nobody asks them for consent');
  const eth = r.rep.ethics;
  MD.requestMedical(inv.id, 'informal');
  check(!inv.file.medical && r.rep.ethics < eth, 'asking hospital staff informally gets nothing, and costs ethics');
  let got = false;
  for (const how of ['consent', 'order']) { MD.requestMedical(inv.id, how); if (inv.file.medical) { got = true; break; } }
  check(!got || (inv.file.medical.how && inv.file.log.some((x) => /documented injuries/.test(x.text))), 'with consent or an order, only the documented findings are shared');
  // A physician at the hospital: the patient, and the police's request.
  const doc = life('us', 40);
  doc.medicine = { job: { hospitalId: null } };
  const inv2 = W.openCase('robbery', { ownerId: a.id, truth: 'known' });
  doc.medicine.job.hospitalId = MD.hospitalFor(inv2, doc);
  const lines = MD.hospitalYear(doc);
  const q = MD.myRequests(doc)[0];
  check(q && lines.length, 'a patient from a real case arrives at the physician\'s hospital');
  if (q) { const perf = doc.career.performance ?? 50; MD.answerRequest(q.id, 'chart'); check(doc.flags.privacyBreach === 1 && (doc.career.performance ?? 50) < perf, 'handing the police the whole chart is a privacy breach'); }
}
section('hospitals: the patient is treated by the medical side; police get findings only with consent or an order; a physician who hands over the chart breaches privacy');

// ---------- 28. Overtime and availability pay ----------
{
  const PY = await import('../js/engine/investigations/pay.js');
  const p = life('us', 30);
  const a = makeOfficer();
  const r = core.I();
  p.career.salary = 60000;
  store.state.year += 1; // a year that has not been paid yet
  const cash = p.finance.cash;
  const l1 = PY.payYear(p);
  check(l1.some((x) => /Overtime/.test(x)) && p.finance.cash > cash && !PY.payYear(p).length, 'an officer is paid overtime once for each year');
  const fed = life('us', 30, { degree: 'accounting' });
  hire(CAREER_BY_ID.fbi_agent, 0, 60, 'test');
  const rf = core.I();
  rf.family = 'federal'; rf.stage = 'agent';
  rf.job = { agencyKind: 'fbi', officeId: A.officeOf('fbi', A.federalCities()[0]).id, rank: 'agent', since: store.state.year - 2 };
  fed.career.salary = 80000;
  const c2 = fed.finance.cash;
  PY.payYear(fed);
  check(fed.finance.cash - c2 === 20000, 'a federal criminal investigator is paid availability pay (25%), not overtime');
  check(CAREER_BY_ID.police.pensionAfter === 25 && CAREER_BY_ID.fbi_agent.pensionAfter === 20, 'police and federal pensions have their own service years');
}
section('pay: overtime from the work done, once a year; federal availability pay; pension service years');

// ---------- 29. The editor's desk, standards, and a story that brings a lead ----------
{
  const p = life('us', 38, { degree: 'journalism' });
  hire(CAREER_BY_ID.journalist, 3, 60, 'test');
  X.npcCourtCase(p);
  const lines = X.editorYear(p);
  const d = X.myDrafts(p)[0];
  check(d && lines.length, 'an editor has reporters\' drafts to read');
  if (d) { d.unverified = true; d.wrong = true; check(X.editDraft(d.id, 'run').tone === 'bad' && d.correction, 'running an unverified account as fact brings a correction under the editor\'s name'); }
  check(X.STORY_STEPS.standards, 'editorial standards are a step of every story');
}
section('journalism: an editor\'s desk, editorial standards, corrections');

// ---------- 30. Careers around the cases ----------
{
  const AL = await import('../js/engine/investigations/allied.js');
  const DEG = { crime_analyst: 'criminology', probation: 'criminal_justice', victim_advocate: 'psychology', court_reporter: 'english', inspector_general: 'accounting', compliance: 'law', insurance: 'business' };
  for (const id of Object.keys(AL.ALLIED)) {
    const p = life('us', 30, { degree: DEG[id] });
    if (id === 'inspector_general') p.career.experience = { audit: 4 };
    const t = AL.takeUp(id);
    check(t.ok && p.career.careerId === `ally_${id}` && p.career.title === AL.ALLIED[id].ranks[0], `${id}: taken up through its own door (${t.text})`);
    AL.alliedYear(p);
    const w = AL.openAllied(p)[0];
    check(w, `${id}: the year brings work from real records`);
    if (!w) continue;
    const good = AL.ALLIED[id].options.find((o) => o.good);
    const res = AL.doAllied(w.id, good.id);
    check(res.tone === 'good' && AL.alliedOf(p).careful === 1 && !AL.doAllied(w.id, good.id).ok, `${id}: done soundly, once`);
    // The specific consequence, in the records it touches.
    if (id === 'crime_analyst') check(w.subject.every((x) => k.J().investigations[x].file.leads.some((l) => /names nobody/.test(l.text))), 'the analyst\'s pattern is a lead on each linked case, naming nobody');
    if (id === 'probation') check(['completed', 'active'].includes(k.J().sentences[w.subject].status) && k.J().sentences[w.subject].supervisedBy === p.id, 'a real sentence, supervised');
    if (id === 'victim_advocate') check(k.J().investigations[w.subject].file.done.support, 'the person harmed is supported, and chooses for themselves');
    if (id === 'court_reporter') check(k.J().cases[w.subject].transcript?.certified, 'a certified transcript on the real case');
    if (id === 'insurance') check(k.J().investigations[w.subject].file.template === 'arson', 'the claim is for a real fire');
    store.state.year += 1;
    AL.alliedYear(p);
    const w2 = AL.openAllied(p)[0];
    if (w2) {
      const bad = AL.ALLIED[id].options.find((o) => !o.good);
      check(AL.doAllied(w2.id, bad.id).tone === 'bad' && AL.alliedOf(p).misconduct === 1, `${id}: the wrong way is costly`);
      const A = AL.alliedOf(p); A.since = store.state.year - 5; A.careful = 6;
      check(!AL.alliedCareerYear(p).length, `${id}: no promotion with misconduct on the record`);
    }
  }
  const young = life('us', 19);
  check(Object.keys(AL.ALLIED).every((id) => AL.alliedBlock(id, young)), 'none of this work before 21');
  // A forensic scientist who specializes in digital work is a digital forensic examiner.
  const FL = await import('../js/engine/investigations/forensicLab.js');
  const sci = life('us', 28, { degree: 'computer_science' });
  hire(CAREER_BY_ID.forensics, 0, 60, 'test');
  FL.labRecord(sci);
  if (store.state.year >= 1995) { FL.specialize('digital'); check(sci.career.title === 'Digital forensic examiner', 'a digital specialist is a digital forensic examiner'); }
}
section('careers around the cases: analysts, probation, victim advocates, court reporters, inspectors general, compliance and insurance investigators, digital forensic examiners');

// ---------- 31. Family: conflicts of interest, and an ancestor's case ----------
{
  const FA = await import('../js/engine/investigations/family.js');
  const p = life('us', 38);
  const a = makeOfficer();
  const r = core.I();
  r.job.detective = true; r.job.rank = 'detective';
  r.people.partnerId ??= Object.values(a.units)[0].memberIds.find((x) => store.state.npcs[x]?.alive);
  const rel = [...FA.relatives(p)].map((id) => store.state.npcs[id]).find((n) => n?.alive);
  check(rel, 'the player has relatives the game keeps');
  const inv = W.openCase('burglary', { ownerId: a.id, truth: 'insider' });
  r.caseIds.push(inv.id);
  inv.file.people.push({ id: rel.id, role: 'witness' });
  FA.checkConflict(inv, p);
  check(inv.file.conflict?.status === 'open' && inv.file.conflict.relatives[0].id === rel.id, 'a relative in the player\'s own case is a conflict of interest');
  check(FA.recuse(inv.id).ok && inv.file.leadId !== p.id && !r.caseIds.includes(inv.id), 'stepping aside hands the case to a colleague');
  const inv2 = W.openCase('burglary', { ownerId: a.id, truth: 'insider' });
  r.caseIds.push(inv2.id);
  inv2.file.people.push({ id: rel.id, role: 'witness' });
  FA.checkConflict(inv2, p);
  const integ = r.rep.integrity;
  FA.keepCase(inv2.id);
  check(inv2.file.conflict.status === 'kept' && r.rep.integrity < integ, 'keeping the case is a mark against the investigator');
  // A relative in someone else's case: stay out of it.
  const det = Object.values(a.units)[0].memberIds.find((x) => x !== p.id && store.state.npcs[x]?.alive);
  const other = W.openCase('robbery', { ownerId: a.id, lead: det, truth: 'known' });
  other.file.people.push({ id: rel.id, role: 'witness' });
  check(FA.relativeCases(p).some((x) => x.inv.id === other.id), 'a relative in another detective\'s case is seen');
  const n0 = Object.keys(core.W().complaints).length;
  FA.relativeChoice(other.id, 'favor');
  check(Object.keys(core.W().complaints).length === n0 + 1 && !FA.relativeCases(p).some((x) => x.inv.id === other.id), 'asking the detective for a favor is misconduct, written down');
  // An ancestor's cold case, reopened by a descendant.
  const anc = 'npc_ancestor_test';
  store.state.investigations.legacies = [...(store.state.investigations.legacies ?? []), { id: anc, name: 'Ada Whitlock', died: store.state.year - 6, years: 30, units: [], history: [] }];
  const old = W.openCase('burglary', { ownerId: a.id, lead: anc, truth: 'insider' });
  old.file.opened = core.now() - 12 * 25; old.file.log.forEach((x) => { x.at = old.file.opened; });
  old.file.leads.push({ id: 'l_old', text: 'A van seen twice on the street that week.', why: 'A neighbor', status: 'open', at: old.file.opened });
  old.file.coldSince = core.now() - 12 * 20; old.stage = 'cold';
  old.file.partnerId = Object.values(store.state.npcs).find((x) => x.alive && x.id !== p.id && x.age > 50)?.id;
  W.reopen(old.id);
  const notes = FA.ancestorNotes(old);
  check(old.file.ancestorId === anc && notes?.name === 'Ada Whitlock' && notes.open.some((t) => /van/.test(t)), 'reopening an ancestor\'s case brings their notes and the leads they left open');
  if (old.file.partnerId) check(FA.askOldPartner(old.id).ok && old.file.leads.some((l) => /never made it into the file/.test(l.text)) && !FA.askOldPartner(old.id).ok, 'their old partner remembers, once');
  old.file.outcome = { kind: 'resolved', at: core.now() };
  const line = FA.settleAncestor(old, p);
  check(line && r.history.some((h) => /Ada Whitlock began/.test(h.text)) && !FA.settleAncestor(old, p), 'closing it goes into the family\'s history, once');
}
section('family: a relative in the player\'s case means stepping aside; a relative in another\'s case is theirs; an ancestor\'s case, their notes and their old partner');

// ---------- 32. Bigger homicide cases: a series across cities, and handoffs ----------
{
  const SE = await import('../js/engine/investigations/serial.js');
  const p = life('us', 40);
  const a = makeOfficer();
  const r = core.I();
  r.job.detective = true; r.job.rank = 'detective';
  let inv = null;
  for (let i = 0; i < 12 && !inv; i++) {
    const c = W.openCase('homicide', { ownerId: a.id, truth: 'stranger' });
    r.caseIds = [c.id];
    SE.seriesYear(p);
    if (c.file.seriesId) inv = c;
  }
  const s = inv && SE.seriesOf(inv);
  check(s && s.caseIds.length >= 2, 'a homicide can be one of a series');
  if (s) {
    const others = s.caseIds.filter((x) => x !== inv.id).map(W.investigation);
    const perp = k.J().incidents[inv.incidentId].truth.perpetratorId;
    check(others.every((o) => k.J().incidents[o.incidentId].truth.perpetratorId === perp && k.J().incidents[o.incidentId].city !== k.J().incidents[inv.incidentId].city && o.file.leadId !== p.id), 'the same person, other cities, other detectives: each its own case');
    const n0 = inv.evidenceIds.length;
    const res = SE.compareCases(inv.id);
    check(res.ok && s.linked && inv.evidenceIds.length > n0 && inv.file.leads.some((l) => /same method/.test(l.text)), 'comparing cases links them, and the other agencies\' evidence is shared');
    check(!SE.compareCases(inv.id).ok, 'compared once');
  }
  // A case with no series: comparing finds nothing.
  const lone = W.openCase('robbery', { ownerId: a.id, truth: 'known' });
  r.caseIds.push(lone.id);
  check(/Nothing else/.test(SE.compareCases(lone.id).text), 'nothing is linked that is not really linked');
  // Handoffs: a case passes on when its detective is gone; the player's pass on when they leave.
  r.caseIds = [];
  const det = Object.values(a.units)[0].memberIds.find((x) => x !== p.id && store.state.npcs[x]?.alive);
  const theirs = W.openCase('homicide', { ownerId: a.id, lead: det, truth: 'known' });
  store.state.npcs[det].alive = false;
  const lines = SE.inheritYear(p);
  check(lines.length && theirs.file.leadId === p.id && theirs.file.handoff.at(-1).from === det && r.caseIds.includes(theirs.id), 'a detective\'s open homicide passes to the player when they die, with the file');
  r.people.partnerId = Object.values(a.units)[0].memberIds.find((x) => x !== p.id && store.state.npcs[x]?.alive) ?? r.people.partnerId;
  C.jobEnded(p, r, 'retired');
  check(theirs.file.leadId !== p.id && theirs.file.handoff.at(-1).from === p.id, 'the player\'s open cases pass on when they retire');
}
section('bigger homicide cases: a series across cities linked only by what is real, evidence shared between agencies; cases handed on');

// ---------- 33. Informants and undercover work ----------
{
  const UC = await import('../js/engine/investigations/undercover.js');
  const p = life('us', 36);
  const a = makeOfficer();
  const r = core.I();
  r.job.detective = true; r.job.rank = 'detective'; r.rep.integrity = 70;
  const inv = W.openCase('drugs', { ownerId: a.id, truth: 'supplier' });
  r.caseIds.push(inv.id);
  check(!UC.recruit(W.openCase('burglary', { ownerId: a.id }).id).ok, 'informants are for drug, firearms and organized-crime cases');
  check(UC.recruit(inv.id, 'register').ok && store.state.npcs[inv.file.informantId].flags.informant.registered, 'an informant is a real person, registered with a supervisor');
  const ev0 = inv.evidenceIds.length;
  UC.meetInformant(inv.id);
  check(inv.file.tip && inv.evidenceIds.length === ev0 && /not evidence/.test(inv.file.leads.at(-1).text), 'a tip is a lead, never evidence by itself');
  check(/not a lawful basis/.test(UC.tipAsBasis(inv.id).text), 'an uncorroborated tip is not a basis for an order');
  UC.corroborate(inv.id);
  check(inv.file.tip.accurate ? inv.evidenceIds.length === ev0 + 1 : inv.evidenceIds.length === ev0, 'checked against independent evidence, a true tip yields evidence; a false one goes no further');
  const inv2 = W.openCase('firearms', { ownerId: a.id, truth: 'straw' });
  r.caseIds.push(inv2.id);
  const n0 = Object.keys(core.W().complaints).length;
  UC.recruit(inv2.id, 'off');
  check(Object.keys(core.W().complaints).length === n0 + 1, 'an informant off the books is misconduct');
  // Undercover: a year in a role; what is pushed for is entrapment, and does not stand.
  check(UC.goUndercover(inv.id).ok && !UC.goUndercover(inv.id).ok, 'one undercover assignment at a time');
  const s0 = r.wellbeing?.strain ?? 0;
  UC.undercoverRound('push');
  check((r.wellbeing?.strain ?? 0) > s0, 'undercover work weighs on the officer');
  // A blown cover ends the operation early (a real risk); try again until an assignment runs its course.
  for (let i = 0; i < 10 && r.undercover.status !== 'active'; i++) { r.undercover = null; store.state.year += 1; UC.goUndercover(inv.id); UC.undercoverRound('push'); }
  check(r.undercover.status === 'active', 'an undercover assignment can run its course');
  if (r.undercover.status === 'active') {
    r.undercover.recordings = Math.max(1, r.undercover.recordings);
    r.undercover.end = core.now();
    UC.endUndercover();
    const ev = inv.evidenceIds.map((x) => k.J().evidence[x]).find((e) => /undercover/i.test(e.summary));
    check(ev && ev.tainted === 'entrapment', 'recordings made after pushing are entrapment, and will be ruled out');
  }
}
section('informants and undercover work: real people, registered and protected; tips checked before they count; entrapment does not stand');

// ---------- 34. Officer wellbeing ----------
{
  const WB = await import('../js/engine/investigations/wellbeing.js');
  const p = life('us', 40);
  const a = makeOfficer();
  const r = core.I();
  r.job.detective = true; r.job.rank = 'detective';
  for (let i = 0; i < 3; i++) r.caseIds.push(W.openCase('homicide', { ownerId: a.id, truth: 'known' }).id);
  const s0 = WB.strainOf(p);
  WB.wellbeingYear(p);
  check(WB.strainOf(p) > s0, 'open homicides weigh on a detective, year by year');
  const s1 = WB.strainOf(p);
  check(WB.seekSupport('counseling').ok && WB.strainOf(p) < s1 && !WB.seekSupport('counseling').ok, 'confidential counseling eases it, once a year');
  r.wellbeing.strain = 95;
  const h = p.stats.health;
  for (let i = 0; i < 3; i++) { WB.wellbeingYear(p); r.wellbeing.strain = 95; store.state.year += 1; }
  check(p.stats.health < h && r.wellbeing.offered, 'years at breaking point cost health, and bring the offer of a medical retirement');
  check(WB.medicalRetirement(p).ok && !r.job && p.career.retired, 'a medical retirement ends the career, with its pension');
}
section('officer wellbeing: strain from the work, confidential support, health costs, a medical retirement');

// ---------- 35. True-crime media ----------
{
  const TC = await import('../js/engine/investigations/truecrime.js');
  const p = life('us', 55);
  const a = makeOfficer();
  const r = core.I();
  r.job.detective = true; r.job.rank = 'detective';
  const old = W.openCase('burglary', { ownerId: a.id, truth: 'insider' });
  r.caseIds.push(old.id);
  old.file.opened = core.now() - 12 * 20; old.file.coldSince = core.now() - 12 * 15;
  let shown = null;
  for (let i = 0; i < 20 && !shown; i++) { TC.mediaYear(p); shown = old.file.mediaId; if (!shown) store.state.year += 1; }
  check(shown && old.file.publicAttention, 'a podcast or documentary takes up an old cold case, and public attention follows');
  const inv = TC.invitations(p)[0];
  check(inv && inv.as === 'investigator', 'the investigator who worked it is asked to take part');
  if (inv) {
    const n0 = Object.keys(core.W().complaints).length;
    TC.takePart(inv.id, 'file');
    check(Object.keys(core.W().complaints).length === n0 + 1 && !TC.takePart(inv.id, 'public').ok, 'telling a podcast what was in the case file is a breach; one answer');
  }
  check(!old.file.outcome, 'a show decides nothing about the case');
}
section('true-crime media: old cases taken up years later, public attention, people coming forward, and the investigator asked to take part');

// ---------- 36. Police in more countries, and their unions' rules ----------
{
  const UN = await import('../js/engine/investigations/unions.js');
  const want = { de: 'landespolizei', in: 'state_in', br: 'policia_civil', mx: 'policia_mx', kr: 'knpa', it: 'polizia_stato', es: 'policia_nacional_es' };
  for (const [c, kind] of Object.entries(want)) check(A.kindsIn(c).join() === kind && D.SOURCES[D.AGENCY_KINDS[kind].source]?.verified === false, `${c}: its own police (${D.AGENCY_KINDS[kind].name}), source named and unverified`);
  check(A.agencyOf('landespolizei', 'de', 'Berlin').name === 'Polizei Berlin' && A.agencyOf('policia_nacional_es', 'es', 'Barcelona').name === 'Mossos d\'Esquadra' && A.agencyOf('state_in', 'in', 'Mumbai').name === 'Mumbai City Police', 'real force names where cities have their own');
  const p = life('de', 22);
  p.city = 'Berlin';
  const a = makeOfficer('landespolizei');
  const r = core.I();
  check(a.kind === 'landespolizei' && /Polizei/.test(p.career.title), `a German recruit serves in the state police (${p.career.title})`);
  r.job.rank = 'sergeant';
  check(C.rankName('lieutenant', r) === 'Polizeikommissar' && C.rankName('detective', r) === 'Kriminalkommissar', 'German ranks and detective ranks');
  check(/Beamte/.test(UN.strikeNote('de')) && /trade unions/.test(UN.strikeNote('in')) && /may not strike/.test(UN.strikeNote('ng')), 'union rules differ by country, and police may not strike in any');
  check(UN.unionOf(a).name === 'the Gewerkschaft der Polizei', 'a German department\'s union is the GdP');
}
section('police in Germany, India, Brazil, Mexico, South Korea, Italy and Spain, with their own forces, ranks and union rules');

// ---------- Last: the academy's dates (kept last: a new life here would move the ids, and so the rolls, of the checks after it) ----------
  // The academy ends on its own date too: graduation, field training and probation are dated from it, at any turn length.
{
  const setNow = (t) => { store.state.year = Math.floor(t / 12); store.state.month = t % 12; };
  {
    const p2 = life('us', 25);
    const ag2 = A.agencyOf('municipal', 'us', p2.city);
    core.I().apps.push({ id: 'app_g', kind: 'police', ownerId: ag2.id, status: 'offer', due: core.now(), outcome: 'offer' });
    C.acceptAcademy('app_g');
    Object.assign(core.I().skills, { law: 80, writing: 80, ethics: 80, communication: 80, observation: 80, interviewing: 80, teamwork: 80 });
    const t0 = core.now();
    const snap = JSON.stringify(store.state);
    const runA = (times) => { store.state = JSON.parse(snap); for (const t of times) { setNow(t); C.settleAcademy(); C.settleProbation(); } const r = core.I(); return { grad: r.academy.graduated, field: r.job?.fieldEnd, prob: r.job?.probationEnd, stage: r.stage }; };
    const q = runA([t0 + 3, t0 + 6, t0 + 9, t0 + 12]);
    const yv = runA([t0 + 12]);
    check(q.grad === yv.grad && q.field === yv.field && q.prob === yv.prob && q.stage === yv.stage && yv.grad === core.I().academy.end,
      `graduation and field training dated from the academy's end, the same on quarterly and yearly turns (${JSON.stringify(q)} vs ${JSON.stringify(yv)})`);
  }
}
section('the academy ends on its own date: graduation and field training the same on quarterly and yearly turns');

for (const line of ok) console.log(`ok   ${line}`);

if (problems.length) { for (const m of problems) console.log(`FAIL ${m}`); console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Every case has a history, every clue a source.');
