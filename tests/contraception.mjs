// Contraception and family planning (engine/health/contraception.js): the registry, every method's own rules, the
// pregnancy resolvers' use of them, eligibility, providers, money, eras and countries, privacy, saves, the Story
// Director, the 3/6/12-month equivalence, and the required vertical slice (Part 41). Run with: node tests/contraception.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceTurn, setStep } = await import('../js/engine/turns.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const R = await import('../js/engine/health/record.js');
const course = await import('../js/engine/health/course.js');
const story = await import('../js/engine/health/story.js');
const { CONDITION_BY_ID } = await import('../js/data/health/conditions.js');
const D = await import('../js/data/health/contraception.js');
const C = await import('../js/engine/health/contraception.js');
const kids = await import('../js/engine/children.js');
const bonds = await import('../js/engine/bonds.js');
const { EVENT_BY_ID } = await import('../js/data/events/index.js');

rng.seed(4242);
const problems = [];
const passed = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => passed.push(`${problems.length ? '(after failures) ' : ''}${msg}`);

/** An adult in a country and year, solvent, with a clean health record. */
function life({ age = 23, countryId = 'us', bornAs = 'female', year = null, cash = 100000 } = {}) {
  do { store.state = createLife({ countryId, gender: bornAs }); } while (store.state.player.royal);
  const s = store.state; const p = s.player;
  if (year) s.year = year;
  p.age = age; p.birthYear = s.year - age; p.gender = bornAs; p.flags.bornAs = bornAs; p.flags.identity = null;
  p.flags.livesWithParents = false; p.education.enrolled = false; p.legal.incarceration = null;
  p.finance.cash = cash; p.hidden.fertility = 60;
  p.health = R.blankHealth();
  s.month = 0; s.settings ??= {}; s.settings.step = 12; s.pendingEvents = [];
  return p;
}
function partner(p, gender = p.flags.bornAs === 'female' ? 'male' : 'female') {
  const n = makeNpc({ role: 'partner', countryId: p.countryId, age: p.age + 1, gender, relationship: 85 });
  n.flags.bornAs = gender; store.state.npcs[n.id] = n; p.npcIds.push(n.id);
  return n;
}
const prov = (service) => C.defaultProvider(service);
const recOf = (id) => C.cx().methods.find((r) => r.id === id);
const deviceCount = () => C.active().filter((r) => r.deviceId).length;
const turn = () => { store.state.pendingEvents = []; return advanceTurn(store.state); };

// ---------- 1. The registry ----------
{
  const ids = [...D.METHODS.map((m) => m.id), ...D.EMERGENCY.map((e) => e.id)];
  check(new Set(ids).size === ids.length, 'every method and emergency option has its own id');
  for (const m of D.METHODS) {
    check(m.typical != null && m.perfect != null && m.typical >= m.perfect, `${m.id}: typical and perfect use given, typical no better than perfect`);
    check(m.sources?.length && m.sources.every((s) => D.SOURCES[s]?.url && D.SOURCES[s].applies && D.SOURCES[s].checked), `${m.id}: sources with url, jurisdiction and date`);
    check(typeof m.hormonal === 'boolean' && m.category && m.mechanism && m.maintenance && m.from, `${m.id}: category, hormones, mechanism, maintenance, first year`);
  }
  for (const want of ['iud_lng52', 'iud_copper', 'implant', 'coc', 'pop_norethindrone', 'pop_drospirenone', 'patch', 'ring_monthly', 'ring_annual', 'injection', 'condom_external', 'condom_internal', 'diaphragm', 'cervical_cap', 'spermicide', 'fam', 'tubal', 'vasectomy'])
    check(D.METHOD_BY_ID[want], `the registry has ${want}`);
  check(['ec_lng', 'ec_upa', 'ec_cu_iud'].every((id) => D.EC_BY_ID[id]), 'three emergency options');
}
section('registry: unique ids, typical and perfect use, sources with jurisdiction and dates');

// ---------- 2. Durations: device-specific, versioned by year and country ----------
{
  life({ year: 2026 });
  const yrs = (id, c = 'us', y = 2026) => C.durationYears(D.METHOD_BY_ID[id], c, y);
  check(yrs('iud_lng52') === 8 && yrs('iud_lng52', 'us', 2015) === 5 && yrs('iud_lng52', 'de') === 5, `the larger hormonal IUD: 8 years in the US now, 5 before 2022 and elsewhere (${yrs('iud_lng52')})`);
  check(yrs('iud_lng13') === 3 && yrs('iud_lng19') === 5 && yrs('iud_copper') === 10, 'each hormonal IUD has its own duration; copper 10');
  check(yrs('implant') === 3 && yrs('implant', 'us', 1995) === 5, 'the implant: 3 years now, 5 for the earlier multi-rod implant');
  check(yrs('implant', 'uk') === 5, 'the implant: 5 years under NHS guidance (checked 2026-11-26)');
  check(D.METHOD_BY_ID.cervical_cap.typical === 22 && Object.values(D.SOURCES).filter((x) => x.verified).every((x) => x.confirmed), 'figures as checked against the CDC (cervical cap 22%); every verified source says what it confirmed');
  check(D.METHODS.filter((m) => m.procedure === 'iud').every((m) => m.durations.length), 'no IUD is assumed to expire after one shared duration');
}
section('durations: per device, per year and per country, not a universal three years');

// ---------- 3. Hormonal versus copper IUD ----------
{
  const h = D.METHOD_BY_ID.iud_lng52; const cu = D.METHOD_BY_ID.iud_copper;
  check(h.hormonal && !cu.hormonal && cu.hormone == null, 'the copper IUD is nonhormonal');
  check(cu.sideEffects.includes('heavier_bleeding') && !h.sideEffects.includes('heavier_bleeding') && h.bleeding.pattern === 'lighter' && cu.bleeding.pattern === 'heavier', 'different menstrual effects: lighter with hormonal, heavier possible with copper');
  check(cu.emergency && !h.emergency, 'only the copper IUD doubles as emergency contraception');
}
section('hormonal and copper IUDs are different methods');

// ---------- 4. The arm implant: placed, kept, removed ----------
{
  const p = life();
  const r = C.startMethod('implant', { provider: prov('implant') });
  check(r.ok, `an implant can be placed (${r.text})`);
  const rec = recOf(r.recId);
  check(rec.deviceId && rec.expiresAbs === rec.startAbs + 36 && rec.providerId, 'one device record with its expiry and who placed it');
  const appts = R.healthOf(p).appointments.filter((a) => a.kind === 'contraception' && a.status === 'attended').length;
  for (let i = 0; i < 3; i++) turn();
  check(deviceCount() === 1 && recOf(r.recId).status === 'active', 'still one implant after three years less a bit');
  check(R.healthOf(p).appointments.filter((a) => a.kind === 'contraception').length === appts, 'no appointments invented for a device that needs none');
  check(C.stopMethod(r.recId).needsRemoval, 'an implant is not simply "stopped": it is removed by a clinician');
  const out = C.removeDevice(r.recId, { provider: prov('implant') });
  check(out.ok && recOf(r.recId).status === 'removed' && recOf(r.recId).removedBy && deviceCount() === 0, 'removed by a trained clinician, the record kept');
  check(/years ago/.test(out.text), 'the removal remembers when it was placed (a real callback)');
}
section('the arm implant: placement, the same device for years, removal by a clinician');

// ---------- 5 and 6. Pills: adherence, and progestin-only apart from combined ----------
{
  const p = life();
  const c = C.cx();
  c.adherence = 0.2; const careful = C.annualFailure({ methodId: 'coc' });
  c.adherence = 1; const typical = C.annualFailure({ methodId: 'coc' });
  c.adherence = 1.8; const loose = C.annualFailure({ methodId: 'coc' });
  check(careful < typical && typical < loose && Math.abs(typical - 7) < 0.01, `the pill depends on routine: ${careful.toFixed(1)} / ${typical} / ${loose.toFixed(1)} in 100`);
  check(C.annualFailure({ methodId: 'implant' }) === 0.1, 'a device does not depend on routine');
  c.adherence = 1;
  check(C.annualFailure({ methodId: 'pop_norethindrone' }) > C.annualFailure({ methodId: 'pop_drospirenone' }), 'a 3-hour progestin-only pill is less forgiving than a 24-hour one');
  check(D.METHOD_BY_ID.coc.hormone === 'estrogen+progestin' && D.METHOD_BY_ID.pop_norethindrone.hormone === 'progestin', 'combined and progestin-only pills differ in hormones');
  const cocTimes = new Set(D.METHODS.filter((m) => m.family === 'pop').map((m) => m.missWindowHours));
  check(cocTimes.size === 3, 'progestin-only pills do not share one timing rule');
  // Eligibility: migraine with aura rules out estrogen, not progestin-only.
  course.begin(CONDITION_BY_ID.migraine, p, { severity: 50 });
  check(C.eligibility('coc').cat === 3 && C.eligibility('coc').needsReview, 'migraine: whether there is aura must be asked first');
  C.cx().facts.migraineAura = true;
  check(C.eligibility('coc').cat === 4 && !C.eligibility('coc').ok && C.eligibility('pop_norethindrone').ok && C.eligibility('implant').ok, 'migraine with aura: no combined pill, progestin-only and implant fine');
}
section('pills: adherence in the background, progestin-only rules apart from combined');

// ---------- 7, 8, 20, 22, 25. Patch, rings, refills: once a month, never twice ----------
{
  const p = life();
  store.state.settings.step = 3;
  const r = C.startMethod('patch', { provider: prov('prescribe') });
  check(r.ok, `a patch can be started (${r.text})`);
  const supplies = () => Object.keys(C.cx().payments).filter((k) => k.startsWith(`bc:${r.recId}:supply`)).length;
  turn(); turn();
  check(supplies() === 6, `six months of patches, six monthly supplies (${supplies()})`);
  const cash = p.finance.cash; const pays = JSON.stringify(C.cx().payments);
  C.processThrough(C.absNow() - 1); C.processThrough(C.absNow() - 1);
  check(p.finance.cash === cash && JSON.stringify(C.cx().payments) === pays, 'processing the same months again charges nothing (no duplicate expenses or prescriptions)');
  turn(); turn(); turn(); // through the year and into the next
  const renewals = Object.keys(C.cx().payments).filter((k) => k.startsWith(`bc:${r.recId}:renew`)).length;
  check(renewals === 1 && recOf(r.recId).rx.expiresAbs > C.absNow(), `the prescription is renewed once after twelve months (${renewals})`);
  check(!recOf(r.recId).gaps.length, 'no gap while it was kept up');
  // Rings: a monthly ring and a one-year ring have their own schedules.
  life({ year: 2026 });
  const a = C.startMethod('ring_annual', { provider: prov('prescribe') });
  check(a.ok, `a one-year ring in the US (${a.text})`);
  store.state.settings.step = 6; turn(); turn();
  check(Object.keys(C.cx().payments).filter((k) => k.includes(':supply')).length === 1, 'the one-year ring is supplied once a year, not monthly');
  life({ countryId: 'uk' });
  check(!C.availableIn('ring_annual', 'uk') && C.availableIn('ring_monthly', 'uk'), 'the one-year ring is a US profile only; the monthly ring is in the UK');
}
section('patch and rings: their own schedules, refills once, renewals once, never charged twice');

// ---------- 9. The injection: due every three months; missed, it stops protecting ----------
{
  const p = life();
  store.state.settings.step = 3;
  const r = C.startMethod('injection', { provider: prov('injection') });
  check(r.ok && recOf(r.recId).nextDueAbs === recOf(r.recId).startAbs + 3, 'the next injection is due in three months');
  turn(); turn();
  check(recOf(r.recId).doses === 2 && C.riskAt(C.absNow() - 1) < 0.1, `renewed on schedule (${recOf(r.recId).doses} doses), still protecting`);
  recOf(r.recId).autoRenew = false;
  turn();
  const rec = recOf(r.recId);
  check(rec.status === 'overdue' && C.statusOf(rec).key === 'lapsed' && C.riskAt(C.absNow()) > 0.2, 'a missed injection: no longer protecting, and shown as overdue');
  check(!D.METHOD_BY_ID.injection.permanent && D.METHOD_BY_ID.injection.returnMonths > 0, 'not permanent; fertility can take months to return');
  const r2 = C.resume(r.recId);
  check(r2.ok && recOf(r.recId).status === 'active', 'a late injection can be arranged');
  void p;
}
section('injection: renewals on schedule, a missed one stops protecting, fertility returns over months');

// ---------- 10, 23. Barriers, STI protection, combined use ----------
{
  life();
  check(D.METHOD_BY_ID.condom_external.sti && D.METHOD_BY_ID.condom_internal.sti, 'condoms lower STI risk');
  check(D.METHODS.filter((m) => !['condom_external', 'condom_internal'].includes(m.id)).every((m) => !m.sti), 'nothing else is shown as protecting against STIs');
  check(C.startMethod('condom_internal').ok && !C.startMethod('condom_external', {}).ok, 'an internal and an external condom are not used together');
  const pill = C.relRisk({ methodId: 'coc' }); const condom = C.relRisk({ methodId: 'condom_external' });
  const both = C.combine(pill, condom);
  check(both < Math.min(pill, condom) && both > pill * condom, `two methods together: better than either, not naive multiplication (${both.toFixed(4)} between ${(pill * condom).toFixed(4)} and ${pill.toFixed(4)})`);
  // A man's methods: external condoms and vasectomy; not a pill.
  life({ bornAs: 'male' });
  check(C.eligibility('condom_external').ok && C.eligibility('vasectomy').ok && !C.eligibility('coc').ok && !C.eligibility('iud_copper').ok, 'methods follow the body');
}
section('barriers: STI flags, impossible pairs refused, dual use combined defensibly');

// ---------- 11. Fertility awareness ----------
{
  const p = life();
  C.baseline(p).regular = true;
  const reg = C.annualFailure({ methodId: 'fam' });
  C.baseline(p).regular = false;
  const irr = C.annualFailure({ methodId: 'fam' });
  check(irr > reg && C.eligibility('fam').cat === 3, `irregular cycles make it less reliable, and a caution (${reg.toFixed(1)} → ${irr.toFixed(1)})`);
  check(D.METHOD_BY_ID.fam.approximate && D.METHOD_BY_ID.fam.typicalRange, 'labeled approximate, with the published range');
  check(C.relRisk({ methodId: 'fam' }) > 0, 'never perfect');
}
section('fertility awareness: limited by cycles, explicitly approximate, never a guarantee');

// ---------- 12, 23. Emergency contraception: an exposure, a window, one pregnancy at most ----------
{
  const p = life({ year: 2026 });
  const n = makeNpc({ role: 'friend', countryId: 'us', age: 25, gender: 'male', relationship: 90 }); n.flags.bornAs = 'male'; store.state.npcs[n.id] = n; p.npcIds.push(n.id);
  bonds.setBirthControl(false);
  C.setPlanning('not');
  const risk = C.actRisk();
  check(risk.offerEc && risk.mult === 1, 'no method while not planning a pregnancy: emergency contraception is offered');
  const e = C.recordExposure({ npcId: n.id, failed: false, would: true });
  check(store.state.pendingEvents.some((x) => x.id === 'repro_ec' && x.cast.words.exp === e.id), 'the decision is asked at once, not at the next Age Up');
  const opts = C.ecOptions(e.id);
  check(opts.length === 3 && opts.find((o) => o.id === 'ec_lng').route === 'otc', `in the US now: three options, levonorgestrel off the shelf (${opts.map((o) => `${o.id}:${o.route}`).join(', ')})`);
  const lng = C.takeEc(e.id, 'ec_lng');
  check(lng.ok && C.cx().exposures.find((x) => x.id === e.id).status === 'settled', 'taken and settled');
  check(!C.takeEc(e.id, 'ec_upa').ok, 'the same exposure cannot be settled twice');
  const preg = JSON.stringify(p.flags.pregnancy);
  // A second exposure, left open: once the months move on, its window has passed.
  const e2 = C.recordExposure({ npcId: n.id, failed: true, would: false });
  store.state.settings.step = 3; advanceTurn(store.state);
  check(C.ecOptions(e2.id).length === 0 && C.cx().exposures.find((x) => x.id === e2.id).status === 'settled', 'after the window has passed nothing is offered');
  check(!store.state.pendingEvents.some((x) => x.id === 'repro_ec' && x.cast.words.exp === e2.id), 'and its scene, too late now, is not shown');
  check(JSON.stringify(p.flags.pregnancy) === preg || p.flags.pregnancy?.otherId === n.id, 'never more than one pregnancy from these');
  // An exposure the night would have led to: the copper IUD almost always prevents it.
  let prevented = 0;
  for (let i = 0; i < 40; i++) {
    life({ year: 2026 }); const m = makeNpc({ role: 'friend', countryId: 'us', age: 25, gender: 'male', relationship: 90 }); m.flags.bornAs = 'male'; store.state.npcs[m.id] = m;
    const ex = C.recordExposure({ npcId: m.id, failed: true, would: true });
    C.takeEc(ex.id, 'ec_cu_iud');
    if (!store.state.player.flags.pregnancy) prevented++;
  }
  check(prevented >= 37, `a copper IUD prevents nearly all (${prevented} of 40)`);
  check(/does not end/.test(EVENT_BY_ID.repro_ec.text) && !/abort/i.test(JSON.stringify(D.EMERGENCY)), 'emergency contraception is described as preventing, not ending, a pregnancy');
}
section('emergency contraception: after a real exposure, asked at once, gone when its window passes');
// Every night together goes through the same rules: a main partner's night (romance.js hookUp) as much as another's.
{
  const love = await import('../js/engine/romance.js');
  const runs = (setup) => { let preg = 0; for (let i = 0; i < 400; i++) { const p = life(); const n = partner(p); n.role = 'spouse'; p.hidden.fertility = 90; setup(); store.state.pendingEvents = []; n.flags.acts = {}; love.hookUp(n.id); if (p.flags.pregnancy) preg++; } return preg; };
  const none = runs(() => bonds.setBirthControl(false));
  const implant = runs(() => C.startMethod('implant', { provider: prov('implant') }));
  check(none > 5 && implant <= 1, `a main partner's night respects contraception too (${none} with nothing, ${implant} with an implant, in 400)`);
  const p = life(); const n = partner(p); n.role = 'spouse';
  bonds.setBirthControl(false); C.setPlanning('not'); store.state.pendingEvents = [];
  love.hookUp(n.id);
  check(store.state.pendingEvents.some((e) => e.id === 'repro_ec'), 'and brings the emergency contraception decision when it should');
}

// ---------- 13. Permanent contraception: the patient's own consent ----------
{
  const p = life({ age: 34 });
  const n = partner(p);
  check(!C.giveConsent('tubal', { by: n.id, understood: true }).ok, 'a partner cannot consent for the patient');
  check(C.giveConsent('tubal', {}).needsUnderstanding, 'counseling about permanence comes first');
  check(C.giveConsent('tubal', { understood: true }).ok, 'the patient consents');
  const s = C.scheduleProcedure('tubal');
  check(s.ok && C.cx().scheduled.length === 1 && C.cx().scheduled[0].abs > C.absNow(), 'booked for a later month, after the waiting period');
  store.state.settings.step = 3; turn();
  const rec = C.active().find((r) => r.methodId === 'tubal');
  check(rec && rec.permanent && !C.stopMethod(rec.id).ok, 'done, and there is no "stop" button for it');
  check(C.blocksTrying() && /permanent/.test(C.blocksTrying()), 'trying for a baby is not offered as if it were reversible');
  check(!C.blocksTrying(p, { ivf: true }), 'IVF stays possible after a tubal sterilization');
  life({ bornAs: 'male', age: 40 });
  C.giveConsent('vasectomy', { understood: true }, store.state.player);
  C.scheduleProcedure('vasectomy');
  store.state.settings.step = 3; turn();
  const v = C.active().find((r) => r.methodId === 'vasectomy');
  check(v?.status === 'awaiting_confirmation' && C.riskAt(C.absNow()) >= 0.99, 'a vasectomy does not protect until a test confirms it');
  turn(); turn();
  check(C.active().find((r) => r.methodId === 'vasectomy').status === 'active' && C.riskAt(C.absNow()) < 0.01, 'confirmed by the follow-up test, about three months on');
  life({ age: 19 });
  check(!C.eligibility('tubal').ok, 'not offered under 21 in this simplified profile');
}
section('permanent contraception: counseling, the patient\'s own consent, a booked procedure, no undo button');

// ---------- 14. Eligibility: categories, not blanket bans ----------
{
  const p = life({ age: 40 });
  course.begin(CONDITION_BY_ID.heart_disease, p, { severity: 50 });
  check(C.eligibility('coc').cat === 4 && C.eligibility('implant').cat === 2 && C.eligibility('iud_copper').cat === 1, 'heart disease: no estrogen; progestin-only still suitable; copper unaffected');
  const p2 = life({ age: 30 });
  course.begin(CONDITION_BY_ID.hypertension, p2, { severity: 50 });
  const r = C.startMethod('coc', { provider: prov('prescribe') });
  check(!r.ok && r.needsAck, 'high blood pressure: a combined pill needs a careful discussion first');
  check(C.startMethod('coc', { provider: prov('prescribe'), acknowledge: true }).ok, 'and can go ahead after it: the patient chooses');
  const p3 = life({ age: 30 });
  course.begin(CONDITION_BY_ID.asthma, p3, { severity: 50 });
  check(D.METHODS.filter((m) => C.eligibility(m.id).ok).length >= 12, 'a chronic illness does not rule out hormonal contraception wholesale');
}
section('medical eligibility: US MEC-shaped categories from modeled conditions, never invented');

// ---------- 15, 28. Postpartum ----------
{
  const p = life({ age: 29 });
  partner(p);
  store.state.pendingEvents = [];
  C.afterBirth(p);
  check(store.state.pendingEvents.some((e) => e.id === 'repro_postpartum') && !C.active().length, 'a postpartum consultation is offered; nothing is started');
  const opts = Object.fromEntries(C.postpartumOptions().map((o) => [o.id, o]));
  check(opts.coc.cat === 4 && opts.implant.ok && opts.implant.cat <= 2 && opts.iud_copper.cat === 3, 'right after birth: no combined pill, implant fine, IUD after four weeks');
  C.setBreastfeeding(true);
  store.state.month = 1;
  check(C.eligibility('coc').cat === 3, 'breastfeeding in the first six weeks: careful');
  store.state.month = 3;
  check(C.eligibility('coc').cat <= 2, 'later on, generally suitable');
  check(D.METHODS.every((m) => m.id !== 'lam'), 'breastfeeding is not counted as contraception');
}
section('postpartum: method-specific timing, offered not forced, breastfeeding not assumed to protect');

// ---------- 16, 21. Side effects vary; nobody gets all ----------
{
  const counts = { none: 0, some: 0 }; const seen = new Set();
  for (let i = 0; i < 120; i++) {
    life();
    const r = C.startMethod('implant', { provider: prov('implant') });
    const e = recOf(r.recId).effects;
    if (!e.length) counts.none++; else counts.some++;
    e.forEach((x) => seen.add(x.id));
    check(e.every((x) => D.METHOD_BY_ID.implant.sideEffects.includes(x.id)), 'only effects listed for the method');
  }
  check(counts.none > 10 && counts.some > 10 && seen.size >= 4, `side effects vary between people (${counts.none} none, ${counts.some} some, ${seen.size} kinds)`);
  check(!Object.keys(D.SIDE_EFFECTS).some((k) => /infertil|cancer|depression/.test(k)), 'no infertility, cancer or depression is assigned as a routine effect');
  // Reported and reviewed: carry on, change, or stop.
  life();
  const r = C.startMethod('coc', { provider: prov('prescribe') });
  recOf(r.recId).effects = [{ id: 'spotting', label: 'Spotting between periods', noticeAbs: C.absNow(), fadeAbs: null, noticed: true }];
  const rev = C.reportConcern(r.recId);
  check(rev.ok && /your choice/.test(rev.text) && recOf(r.recId).reported.length === 1, 'a concern is reviewed and the choice stays the patient\'s');
  check(C.changeFormulation(r.recId, 'extended').ok && recOf(r.recId).formulation === 'extended', 'a different formulation can be tried');
}
section('side effects: decided per person, often none, reviewed on request, formulation or method can change');

// ---------- 17. Providers ----------
{
  const p = life();
  const list = C.providersFor('iud');
  check(list.some((o) => o.profession === 'obgyn' && o.ok), 'an OB-GYN places IUDs');
  check(!list.some((o) => o.profession === 'nurse'), 'a practice nurse does not');
  check(C.providersFor('prescribe').some((o) => ['nurse_practitioner', 'sexual_health_nurse', 'midwife'].includes(o.profession)), 'not only physicians provide contraception');
  const trained = [];
  for (let i = 0; i < 60; i++) { const npc = makeNpc({ role: 'clinician', countryId: 'us', age: 40 }); npc.flags.clinician = { profession: 'gp', facilityId: 'x' }; trained.push(C.mayProvide(npc, 'iud')); }
  check(trained.some(Boolean) && trained.some((x) => !x), 'some family doctors are trained to place IUDs, some are not');
  check(C.providersFor('counsel').every((o) => o.providerId !== p.id), 'nobody provides their own care');
  p.medicine = { completed: [{ specialtyId: 'obgyn' }] };
  const scope = C.playerScope(p);
  check(scope?.profession === 'obgyn' && scope.services.includes('iud'), 'a player who is an OB-GYN has the scope to provide this care for patients');
}
section('providers: scope by profession and training, physicians and other clinicians');

// ---------- 18, 19. Access, cover and cost ----------
{
  const p = life({ year: 2026 });
  p.career.careerId = 'accountant';
  const covered = C.noCostSharing();
  const r = C.startMethod('iud_copper', { provider: prov('iud') });
  check(r.ok, r.text);
  const claims = p.health.insurance?.claims?.filter((c) => /Copper IUD/.test(c.what)) ?? [];
  if (covered) check(claims.length && claims.every((c) => c.patientPaid === 0 && c.insurerPaid >= 0), 'US with work cover from 2012: no cost sharing for contraception');
  const p2 = life({ year: 2026, cash: 50 });
  p2.career.careerId = null;
  const poor = C.startMethod('implant', { provider: prov('implant') });
  check(!poor.ok && /public sexual health service|lower-cost/.test(poor.text), 'unable to pay: refused with the cheaper routes named, not a pregnancy penalty');
  check(C.startMethod('condom_external').ok, 'off-the-shelf condoms are still within reach');
  const p3 = life({ countryId: 'uk', year: 2026 });
  const c3 = C.priceFor(260, 'care', 1, p3);
  check(c3 === 0, 'UK NHS: contraception free at the point of use (from 1974)');
  const p4 = life({ countryId: 'uk', year: 1970 });
  check(C.priceFor(260, 'care', 1, p4) >= 0 && !C.noCostSharing(p4), 'before 1974, not free in this profile');
  // Minors: depends on the country (simplified), never assumed either way.
  const teen = life({ age: 16, countryId: 'jp', year: 2026 });
  const t = C.startMethod('coc', { provider: prov('prescribe') });
  check(!t.ok && t.minor, 'a teenager in a "guardian" profile is told about the rules, not refused outright');
  check(C.startMethod('coc', { provider: prov('prescribe'), guardian: true }).ok, 'with a parent or guardian involved it can go ahead');
  const uk = life({ age: 16, countryId: 'uk', year: 2026 });
  check(C.startMethod('coc', { provider: prov('prescribe') }).ok, 'in a "confidential" profile a young person can get it confidentially');
  void teen; void uk;
}
section('access and cost: cover, no-cost-sharing rules, cheaper routes, minors by country profile');

// ---------- 24. Encounters are real appointments, once each ----------
{
  const p = life();
  C.startMethod('injection', { provider: prov('injection') });
  store.state.settings.step = 3;
  turn(); turn();
  const n = R.healthOf(p).appointments.filter((a) => a.kind === 'contraception').length;
  C.processThrough(C.absNow() - 1); C.processThrough(C.absNow() - 1);
  check(R.healthOf(p).appointments.filter((a) => a.kind === 'contraception').length === n && n === 2, `the start and one renewal, each an appointment once (${n})`);
}
section('healthcare encounters: recorded in the health record, never duplicated');

// ---------- 26, 35. Privacy ----------
{
  const p = life();
  const n = partner(p);
  C.startMethod('implant', { provider: prov('implant') });
  check(C.visibleTo(n.id) === null && C.visibleTo(p.id), 'nobody else can read the record');
  const legacy = story.legacySummary(p);
  check(!JSON.stringify(legacy).match(/implant|contracep/i), 'the family archive summary carries nothing about contraception');
  check(!p.milestones.some((m) => /implant|IUD|pill|contracep/i.test(m.text)), 'no public milestone about it');
  check(C.partnerMayChange() === false && typeof C.discussWithPartner(n.id).text === 'string' && C.active().length === 1, 'a partner can talk about it and change nothing');
}
section('privacy: the record is the person\'s own, not in archives, not changeable by a partner');

// ---------- 27, 28. Eras and countries ----------
{
  life({ year: 1850 });
  check(!C.availableIn('coc') && !C.availableIn('iud_lng52') && !C.availableIn('implant') && !C.availableIn('condom_external'), 'in 1850: no hormonal methods, no IUDs, no modern condoms yet');
  life({ year: 1890 });
  check(C.availableIn('condom_external') && C.availableIn('diaphragm') && !C.availableIn('fam'), 'by 1890: rubber condoms and diaphragms; no calendar method yet');
  life({ year: 1965 });
  check(C.availableIn('coc') && !C.availableIn('implant') && !C.availableIn('iud_copper'), 'in 1965 the pill, no implant, no copper IUD');
  life({ countryId: 'jp', year: 1995 });
  check(!C.availableIn('coc', 'jp', 1995) && C.availableIn('coc', 'jp', 2000), 'Japan: the pill from 1999');
  check(!C.availableIn('pop_desogestrel', 'us', 2026) && C.availableIn('pop_desogestrel', 'uk', 2026), 'a formulation available in one country and not another');
  check(C.availableIn('iud_lng52', 'uk', 1996) && !C.availableIn('iud_lng52', 'us', 1996), 'the hormonal IUD came to the UK before the US');
}
section('eras and countries: methods only where and when they existed, from documented milestones');

// ---------- 29. Old saves ----------
{
  const p = life();
  delete p.health.contraception; p.flags.birthControl = false;
  saveGame(store.state); const back = loadGame(store.state.slotId); store.state = back;
  const c = C.cx(back.player);
  check(c.legacyDefault === false && c.methods.length === 0, 'an old save that had stopped birth control: no method, none invented');
  const q = life(); partner(q);
  delete q.health.contraception; delete q.flags.birthControl;
  saveGame(store.state); store.state = loadGame(store.state.slotId);
  const c2 = C.cx(store.state.player);
  check(c2.legacyDefault === true && c2.methods.length === 0 && C.protectionWords() === 'birth control', 'an old save "on birth control": the unspecified default, no invented device');
  const n = store.state.npcs[store.state.player.npcIds.at(-1)];
  const chance = kids.surpriseChance(n, store.state.player);
  check(chance > 0.01 && chance < 0.08, `and the same small yearly chance as before (${chance.toFixed(3)})`);
}
section('saves: older lives migrate from the old switch without inventing records');

// ---------- 30. Story Director: context, cooldowns ----------
{
  const p = life({ age: 27 });
  partner(p);
  bonds.setBirthControl(false);
  const seen = [];
  for (let y = 0; y < 8; y++) { store.state.pendingEvents = []; C.closeYear(p); seen.push(store.state.pendingEvents.filter((e) => e.id === 'repro_considering').length); store.state.year++; }
  check(seen.reduce((a, b) => a + b, 0) === 2 && seen[0] === 1, `"Considering birth control" comes rarely, with a cooldown (${seen.join('')})`);
  const q = life({ age: 27 });
  store.state.pendingEvents = []; C.closeYear(q);
  check(!store.state.pendingEvents.some((e) => e.id.startsWith('repro_')), 'nothing without a reason: single, no method, no scene');
  for (const id of ['repro_ec', 'repro_postpartum', 'repro_expiring', 'repro_refill', 'repro_side_effect', 'repro_considering', 'repro_discuss_children', 'repro_permanent', 'repro_followup', 'repro_insurance', 'repro_new_provider'])
    check(EVENT_BY_ID[id]?.queuedOnly, `${id} exists and is only queued by the engine`);
}
section('Story Director: scenes only from saved facts, paced with cooldowns');

// ---------- 22, 31. Pregnancy: no extra calculation, no pregnancy from time alone, step equivalence ----------
{
  // Time alone: a person with no partner, never pregnant, whatever methods and however many turns.
  life({ age: 25 });
  bonds.setBirthControl(false);
  store.state.settings.step = 3;
  for (let i = 0; i < 16; i++) turn();
  check(!store.state.player.flags.pregnancy, 'four years of turns, no partner: no pregnancy from time passing');
  life({ age: 25 });
  for (const id of ['implant', 'coc', 'condom_external']) C.startMethod(id, { provider: prov(C.serviceFor(id)), acknowledge: true });
  check(!store.state.player.flags.pregnancy && !store.state.pendingEvents.some((e) => /pregnancy/.test(e.id)), 'choosing a method starts no pregnancy');
  // Equivalence, part 1: the whole game, the same life and method, 3+3+3+3, 6+6 and 12 months: the contraception
  // record (the months' risks, every payment) comes out the same.
  const full = {};
  for (const seed of [11, 12, 13]) {
    for (const step of [3, 6, 12]) {
      rng.seed(seed * 1000);
      const p = life({ age: 26 }); p.id = `eq_${seed}`; const n = partner(p); n.role = 'spouse'; // the same person each run (ids count up within a process)
      C.startMethod('pop_norethindrone', { provider: prov('prescribe') });
      store.state.settings.step = step;
      rng.seed(seed);
      const before = store.state.year;
      while (store.state.year < before + 2) turn();
      const c = C.cx();
      (full[seed] ??= []).push(JSON.stringify({ risks: c.lastYear.risks.map((x) => x.toFixed(6)), paid: Object.keys(c.payments).sort(), status: c.methods.map((r) => r.status) }));
    }
  }
  check(Object.values(full).every((ks) => ks.every((k) => k === ks[0])), 'the whole game in 3-, 6- and 12-month turns: the same monthly risks, payments and status');
  // Equivalence, part 2: equivalent exposure histories (the same couple, nothing else changing) through the
  // contraception clock and the game's own pregnancy resolver (engine/children.js): the same seeded pregnancies.
  const outcomes = {};
  for (const seed of [11, 12, 13, 14, 15, 16, 17, 18]) {
    for (const step of [3, 6, 12]) {
      rng.seed(seed * 1000);
      const p = life({ age: 26 }); p.id = `eq_${seed}`; const n = partner(p); n.role = 'spouse';
      p.hidden.fertility = 95;
      C.startMethod('pop_norethindrone', { provider: prov('prescribe') });
      C.cx().adherence = 2; // a loose routine: failures are possible
      rng.seed(seed);
      const got = [];
      for (let y = 0; y < 4; y++) {
        for (let m = step; m < 12; m += step) { store.state.month = m; C.between(store.state); }
        C.closeYear(p); p.age += 1; store.state.year += 1; store.state.month = 0;
        kids.tickChildren();
        got.push(p.flags.pregnancy ? 'P' : '-');
        if (p.flags.pregnancy) { p.flags.pregnancy = null; p.flags.pregnancyEnded = null; }
      }
      (outcomes[seed] ??= []).push(got.join(''));
    }
  }
  const same = Object.values(outcomes).every((ks) => ks.every((k) => k === ks[0]));
  check(same, `four 3-month turns, two 6-month turns and one 12-month turn give the same seeded pregnancies (${Object.values(outcomes).map((k) => k.join('/')).join(' ')})`);
  const pregnancies = Object.values(outcomes).map((ks) => ks[0]).join('').split('P').length - 1;
  check(pregnancies > 0 && pregnancies < 20, `on a loosely kept pill some years bring a pregnancy, most do not (${pregnancies} in 32 years)`);
  // A mid-year start: the same in 3-month and 6-month turns when started at the same month.
  const midRisks = [];
  for (const step of [3, 6]) {
    rng.seed(77); const p = life({ age: 26 }); partner(p);
    store.state.settings.step = step;
    while ((store.state.month ?? 0) < 6) turn();
    C.startMethod('iud_copper', { provider: prov('iud') });
    while ((store.state.month ?? 0) !== 0) turn();
    midRisks.push(JSON.stringify(C.cx().lastYear.risks.map((x) => x.toFixed(6))));
  }
  check(midRisks[0] === midRisks[1] && JSON.parse(midRisks[0])[5] === '1.000000' && JSON.parse(midRisks[0])[6] !== '1.000000', 'a method started mid-year counts from its month, the same with either turn length');
  // The yearly chance is never a full year's failure applied per turn: the resolver rolls once a year.
  const p = life({ age: 26 }); const n = partner(p);
  C.startMethod('implant', { provider: prov('implant') });
  const yc = kids.surpriseChance(n, p);
  check(yc > 0 && yc < 0.001, `a whole year on an implant: a tiny chance, never zero (${yc.toExponential(2)})`);
  bonds.setBirthControl(false);
  check(C.blocksTrying() && /removed first/.test(C.blocksTrying()), 'with an implant in place, trying for a baby means having it removed first');
  check(/removed first/.test(C.blocksTrying(p, { ivf: true }) ?? '') && !kids.tryIvf(n.id).ok, 'and IVF too: a reversible method comes out first');
  check(/removed first/.test(kids.tryBlockedBy() ?? ''), 'the People tab gets the same reason to show under the greyed-out button');
}
section('pregnancy: the existing resolvers decide, never from time or choice alone; 3/6/12-month turns agree');

// ---------- 41. The vertical slice ----------
{
  const p = life({ age: 23, year: 2026 });
  partner(p);
  p.career.careerId = null;
  const startCash = p.finance.cash;
  // 2-5. Compare, review eligibility.
  const cmp = C.comparison(['iud_lng52', 'iud_copper', 'implant', 'coc']);
  check(cmp.length === 4 && cmp.every((x) => x.typical && x.maintenance && x.duration && x.sti && x.access) && !cmp.some((x) => 'score' in x || 'safety' in x), 'four methods compared on their characteristics, with no single score');
  check(cmp.every((x) => x.eligibility.ok), 'all four are eligible');
  // 6-11. Consult, choose, pay, start; exact start date recorded.
  const consult = C.consult(prov('counsel'));
  check(consult.ok && /The choice is yours/.test(consult.text), 'a consultation advises; the choice is the patient\'s');
  const iudProvider = C.providersFor('iud').find((o) => o.ok);
  const s = C.startMethod('iud_lng52', { provider: iudProvider });
  check(s.ok, s.text);
  const rec = recOf(s.recId);
  const startAbs = C.absNow();
  check(rec.startAbs === startAbs && C.dateOf(startAbs).match(/\d{4}/) && p.finance.cash < startCash, `started ${C.dateOf(startAbs)}, paid through Finance (${startCash - p.finance.cash})`);
  saveGame(store.state);
  // 12-15. Three months, then six: same device, protecting.
  store.state.settings.step = 3;
  const cashAfterStart = store.state.player.finance.cash;
  turn();
  check(C.riskAt(C.absNow() - 1) < 0.01 && C.statusOf(recOf(s.recId)).key === 'active', 'three months on: protecting');
  turn(); turn();
  check(deviceCount() === 1 && C.cx().methods.length === 1, 'nine months on: still one device, none generated');
  check(store.state.player.finance.cash === cashAfterStart, 'no repeated billing for a device already paid for');
  // 16-17. Duration and replacement.
  check(recOf(s.recId).expiresAbs - recOf(s.recId).startAbs === 96 && /by /.test(C.nextAction(recOf(s.recId))), 'eight years in the US, replacement or removal shown');
  // 18-21. A change: the device out and an implant in, at one visit, history kept.
  const sw = C.switchMethod(s.recId, 'implant', { provider: C.providersFor('implant').find((o) => o.ok) });
  check(sw.ok && recOf(s.recId).status === 'removed' && C.primaryNow().methodId === 'implant' && C.cx().methods.length === 2, 'switched: the IUD removed, the implant active, both on record');
  check(C.riskAt(C.absNow()) < 0.01, 'no gap in protection at the switch');
  // 22-24. Save, reload: everything as it was.
  const before = JSON.stringify({ c: C.cx(), cash: store.state.player.finance.cash, appts: R.healthOf().appointments.length, claims: R.healthOf().insurance?.claims?.length });
  saveGame(store.state);
  store.state = loadGame(store.state.slotId);
  saveGame(store.state);
  store.state = loadGame(store.state.slotId);
  const after = JSON.stringify({ c: C.cx(), cash: store.state.player.finance.cash, appts: R.healthOf().appointments.length, claims: R.healthOf().insurance?.claims?.length });
  check(before === after, 'reloaded twice: status, dates, costs and medical records unchanged');
  check(C.active().filter((r) => r.deviceId).length === 1, 'still one device after two loads');
  // 25. Pregnancy is the resolver's: the contraception record holds no pregnancy of its own.
  check(!('pregnancy' in C.cx()) && typeof kids.surpriseChance === 'function', 'no separate pregnancy calculation in the contraception record');
  // 26. No repeated billing over the rest of the year.
  const cash = store.state.player.finance.cash;
  C.processThrough(C.absNow() - 1);
  check(store.state.player.finance.cash === cash, 'nothing billed twice');
  // 27. Privacy.
  check(story.publicMilestones(store.state.player.milestones).every((m) => !/IUD|implant/i.test(m.text)), 'nothing public about it');
}
section('vertical slice: compare, consult, choose, pay, start, live, switch, save and reload twice');

// ---------- Planning and generations ----------
{
  const p = life({ age: 30 });
  const n = partner(p);
  const r = C.startMethod('implant', { provider: prov('implant') });
  check(C.setPlanning('soon').ok && C.active().length === 1, 'a planning preference changes nothing by itself');
  check(C.removeDevice(r.recId, { provider: prov('implant') }).ok && !C.blocksTrying(), 'after removal, trying is possible');
  check(C.cx().planningHistory.length === 1, 'the change of plans is kept');
  void n;
  // Generations: an heir's record is their own.
  const { heirHealth } = await import('../js/engine/health/index.js');
  check(typeof heirHealth === 'function', 'heirs get their own health record (engine/health/index.js heirHealth)');
  const q = life({ age: 50 });
  C.cx(q).menopauseAge = 49;
  check(C.lifeStage(q) === 'postmenopause' && C.riskAt(C.absNow()) === 0, 'after menopause, no pregnancy risk; contraception history kept');
  q.age = 46;
  check(C.lifeStage(q) === 'perimenopause' && C.riskAt(C.absNow()) > 0, 'in perimenopause, contraception can still matter');
}
section('pregnancy planning and life stages: preferences, removals, menopause timing that varies');

// ---------- A long life ----------
{
  for (const step of [3, 12]) {
    rng.seed(900 + step);
    const p = life({ age: 20, year: 2000 });
    const n = partner(p); n.role = 'spouse';
    store.state.settings.step = step;
    C.startMethod('coc', { provider: prov('prescribe') });
    let bad = '';
    for (let y = 0; y < 30 && p.alive; y++) {
      const before = store.state.year;
      while (store.state.year === before && p.alive) turn();
      if (p.age === 27 && C.primaryNow()?.methodId === 'coc') C.switchMethod(C.primaryNow().id, 'iud_copper', { provider: prov('iud') });
      if (p.age === 36 && C.primaryNow()?.deviceId) C.replaceDevice(C.primaryNow().id, { provider: prov('iud') });
      const act = C.active();
      if (act.filter((r) => !C.def(r).barrier).length > 1) bad ||= `two main methods at ${p.age}`;
      if (new Set(act.filter((r) => r.deviceId).map((r) => r.deviceId)).size !== act.filter((r) => r.deviceId).length) bad ||= `duplicate device at ${p.age}`;
      if (C.cx().processed !== store.state.year * 12 - 1) bad ||= `months not processed through the year at ${p.age}`;
    }
    check(!bad, `thirty years in ${step}-month turns: one main method at a time, no duplicate devices, every month processed (${bad || 'ok'})`);
    check(C.cx().methods.length >= 2 && C.cx().methods.every((r) => r.events.length), 'the whole history kept, each record with its own events');
  }
}
section('long lives: thirty years of turns, switches and replacements, the record stays sound');

console.log(passed.map((x) => `ok  ${x}`).join('\n'));
if (problems.length) { console.log(`\n${problems.length} problem(s):\n${problems.map((x) => ` ✗ ${x}`).join('\n')}`); process.exit(1); }
console.log('\nContraception checks out.');
