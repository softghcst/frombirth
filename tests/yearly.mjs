// The yearly gameplay model: one Age Up is one year; every yearly step runs
// once; actions happen in the current year and are limited; plans carry on by
// themselves; the yearly summary reports only what happened; the full-year
// integration scenario; and a family carried through several generations.
// Run with: node tests/yearly.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const { store, npcsByRole } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear, runYearSteps, YEARLY } = await import('../js/engine/yearProcessor.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { CAREERS } = await import('../js/data/careers.js');
const career = await import('../js/engine/career.js');
const edu = await import('../js/engine/education.js');
const rel = await import('../js/engine/relationships.js');
const kids = await import('../js/engine/children.js');
const social = await import('../js/engine/social.js');
const plans = await import('../js/engine/plans.js');
const { summarize, snapshot } = await import('../js/engine/yearSummary.js');
const { netWorth } = await import('../js/engine/finance.js');
const R = await import('../js/engine/health/record.js');
const care = await import('../js/engine/health/care.js');
const ther = await import('../js/engine/health/therapy.js');
const course = await import('../js/engine/health/course.js');
const meds = await import('../js/engine/health/meds.js');
const { CONDITION_BY_ID } = await import('../js/data/health/conditions.js');
const { now } = await import('../js/engine/health/util.js');
const { continueAs, heirs } = await import('../js/engine/legacy.js');
const { die } = await import('../js/engine/death.js');

rng.seed(1900);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);

function adult(age = 30, countryId = 'uk') {
  do { store.state = createLife({ countryId }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age;
  p.flags.livesWithParents = false; p.education.enrolled = false; p.education.degrees = [{ type: 'high', gpa: 3, age: 18 }];
  p.finance.cash = 50000; p.career.careerId = null; p.legal.incarceration = null;
  store.state.pendingEvents = [];
  return p;
}
const ageUp = () => { advanceYear(); store.state.pendingEvents = []; };
const roundTrip = () => { saveGame(store.state); store.state = loadGame(store.state.slotId); return store.state.player; };

// ---------- 1. One Age Up is one year, and every step runs once ----------
{
  const p = adult(30);
  const friend = makeNpc({ role: 'friend', countryId: 'uk', age: 30, relationship: 60 }); store.state.npcs[friend.id] = friend; p.npcIds.push(friend.id);
  const year = store.state.year;
  const ages = Object.fromEntries(p.npcIds.map((id) => [id, store.state.npcs[id].age]));
  ageUp();
  check(store.state.year === year + 1 && p.age === 31, 'one Age Up advances exactly one year');
  check(p.npcIds.every((id) => !store.state.npcs[id] || !store.state.npcs[id].alive || store.state.npcs[id].age === ages[id] + 1 || ages[id] === undefined), 'everyone ages exactly once');
  check(YEARLY.every(([id]) => store.state.yearMarks[id] === store.state.year), `every registered step ran for the year (${YEARLY.length} steps)`);
  // Running the steps again for the same year does nothing at all.
  const before = JSON.stringify({ cash: p.finance.cash, npcs: p.npcIds.map((id) => store.state.npcs[id]?.age), journal: store.state.journal.length, health: p.stats.health });
  runYearSteps();
  check(JSON.stringify({ cash: p.finance.cash, npcs: p.npcIds.map((id) => store.state.npcs[id]?.age), journal: store.state.journal.length, health: p.stats.health }) === before, 'running the year again changes nothing');
  // Loading a save does not repeat a year.
  const y = store.state.year;
  const back = roundTrip();
  check(store.state.year === y && back.age === 31, 'loading a save does not advance or repeat a year');
  check(store.state.yearReport?.year === y, 'the year keeps a report of what it started from');
}
section('one Age Up is exactly one year; every yearly step runs once; reloading repeats nothing');

// ---------- 2. Actions happen now, and are limited ----------
{
  const p = adult(28);
  career.hire(CAREERS.find((c) => c.id === 'office'), 0, 60);
  check(career.workHarder().ok && !career.workHarder().ok, 'working harder counts once a year');
  const perf = p.career.performance;
  for (let i = 0; i < 20; i++) career.workHarder();
  check(p.career.performance === perf, 'clicking it again does not add up');
  const friend = makeNpc({ role: 'friend', countryId: 'uk', age: 28, relationship: 50 }); store.state.npcs[friend.id] = friend; p.npcIds.push(friend.id);
  const r1 = rel.interact(friend.id, 'spendTime');
  const level = friend.meters.relationship;
  for (let i = 0; i < 10; i++) rel.interact(friend.id, 'spendTime');
  check(r1.ok && friend.meters.relationship === level, 'spending time with someone counts once a year, however often it is clicked');
  // Income is paid once a year, at Age Up.
  const earned = p.finance.lifetimeEarned;
  ageUp();
  const paid = p.finance.lifetimeEarned - earned;
  check(paid > 0, 'a year\'s salary is paid at Age Up');
  runYearSteps();
  check(p.finance.lifetimeEarned - earned === paid, 'and only once');
  // School: a student is enrolled now; a degree takes years.
  const s = adult(18);
  s.education.degrees = [{ type: 'high', gpa: 3.4, age: 18 }];
  const prog = edu.programmeOptions().find((o) => o.id === 'university' || o.stage === 'university');
  if (prog) {
    edu.enrol(prog.id, prog.subjects?.[0]?.id ?? prog.majors?.[0]?.id, 'parents');
    const degrees = s.education.degrees.length;
    check(s.education.degrees.length === degrees && !s.education.degrees.some((d) => d.type === 'university'), 'enrolling at university does not award a degree');
  }
  // Practice and posts have their own yearly allowances.
  adult(20);
  social.createAccount('tester');
  let posts = 0;
  for (let i = 0; i < 50; i++) if (social.post().ok) posts++;
  check(posts < 50 && posts > 0, `posting is limited each year (${posts} posts allowed)`);
}
section('actions resolve in the current year; work, closeness, practice and posts cannot be farmed');

// ---------- 3. Plans carry on by themselves, once a year ----------
{
  const p = adult(32);
  plans.setHobby('swimming', 'painting');
  plans.setSavings(5000, 1000);
  kids.getPet();
  const pet = npcsByRole('pet').at(-1);
  plans.setPetCare(pet.id, 'enrichment');
  const swim = p.skills?.swimming ?? 0;
  const cash = p.finance.cash;
  const lines = plans.livePlans(p);
  check(lines.length >= 3, 'a year of plans: hobby, savings and pet care each happen');
  check((p.skills.swimming ?? 0) > swim, 'the hobby is practised');
  check(p.finance.savings === 1000 && p.finance.cash < cash - 1000, 'savings are set aside and pet care paid for');
  const after = { cash: p.finance.cash, savings: p.finance.savings, swim: p.skills.swimming };
  check(plans.livePlans(p).length === 0 && JSON.stringify({ cash: p.finance.cash, savings: p.finance.savings, swim: p.skills.swimming }) === JSON.stringify(after), 'plans run once per year: a second call changes nothing');
  check(netWorth(store.state) >= p.finance.cash + p.finance.savings - 1, 'savings count in net worth');
  // A celebration happens now, once per occasion per year.
  const sis = makeNpc({ role: 'sibling', countryId: 'uk', age: 34, relationship: 50 }); store.state.npcs[sis.id] = sis; p.npcIds.push(sis.id);
  const r = plans.celebrate('birthday', [sis.id], 'simple');
  const warm = sis.meters.relationship;
  check(r.ok && warm === 53 && !plans.celebrate('birthday', [sis.id], 'lavish').ok && sis.meters.relationship === warm, 'a birthday is celebrated once a year');
  // Traditions come round every year without being asked, and pass on.
  check(plans.startTradition('sunday', 'simple').ok && !plans.startTradition('sunday', 'simple').ok, 'a tradition is started once');
  ageUp();
  const t = p.plans.traditions[0];
  check(t.years === 0, 'this year\'s plans had already run, so Age Up does not run them a second time');
  ageUp();
  check(t.years === 1, 'the next year, the tradition happens by itself');
  ageUp();
  check(t.years === 2, 'and again the year after, once');
  // A plan survives a reload.
  const back = roundTrip();
  check(back.plans.hobby.main === 'swimming' && back.plans.traditions[0].years === 2 && back.plans.pets[pet.id] === 'enrichment', 'plans survive a reload');
}
section('plans: hobby, savings, pet care and traditions carry on by themselves, once a year, and survive a reload');

// ---------- 4. The yearly summary reports only what happened ----------
{
  const p = adult(40);
  const before = snapshot();
  const quiet = summarize(before, store.state, []);
  check(quiet.quiet && !quiet.sections.length, 'a year in which nothing happened gives a quiet summary, with nothing invented');
  const baby = makeNpc({ role: 'child', countryId: 'uk', age: 0, relationship: 90 }); store.state.npcs[baby.id] = baby; p.npcIds.push(baby.id);
  const mum = Object.values(store.state.npcs).find((n) => n.role === 'parent' && n.alive);
  if (mum) mum.alive = false;
  career.hire(CAREERS.find((c) => c.id === 'office'), 0, 60);
  const s = summarize(before, store.state, ['Swimming: 10% to 18%.']);
  const all = s.sections.flatMap((x) => x.lines).join(' ');
  check(all.includes(`${baby.firstName} was born`) && (!mum || all.includes(`${mum.firstName}`)) && /started work/.test(all) && /Swimming/.test(all), 'the summary reports births, deaths, work and plans that really happened');
  check(s.sections[0].title === 'Big moments', 'major life events come first');
  check(!/paycheck|fed|feeding/i.test(all), 'routine things are left out');
}
section('the yearly summary: from saved outcomes, major events first, routine left out, quiet years allowed');

// ---------- 4b. Years inside, and the law in the summary ----------
{
  const { imprison } = await import('../js/engine/justice.js');
  const p = adult(30);
  const before = snapshot();
  imprison(4, 1);
  check(p.legal.incarceration && plans.setPrisonPriority('rehabilitation').ok, 'inside, a priority for the years is chosen once');
  const mum = Object.values(store.state.npcs).find((n) => n.role === 'parent' && n.alive);
  const k = p.legal.incarceration;
  const conduct = k.conduct;
  const lines = plans.livePlans(p);
  check(lines.some((l) => /rehabilitation/.test(l)) && k.conduct > conduct, 'the year inside goes into it without clicking');
  const s = summarize(before, store.state, lines);
  check(s.sections.flatMap((x) => x.lines).some((l) => /sent to prison/.test(l)), 'the yearly update reports going to prison');
  plans.setPrisonPriority('family');
  ageUp();
  if (mum && p.legal.incarceration) {
    const rel0 = mum.meters.relationship;
    ageUp();
    check(p.age === 32 && (mum.meters.relationship >= rel0 - 2 || !p.legal.incarceration), 'family contact keeps people close while inside, and the years still pass');
  }
  check(store.state.year >= before.year + 2 && p.legal.incarceration?.served >= 1 || !p.legal.incarceration, 'time served counts year by year');
}
section('prison: a yearly priority chosen once, family contact while inside, and the summary reports it');

// ---------- 5. The full year: many things at once, one Age Up ----------
{
  const p = adult(30);
  const job = CAREERS.find((c) => c.id === 'office');
  career.hire(job, 0, 60);
  plans.setSavings(10000, 2000);
  const friend = makeNpc({ role: 'friend', countryId: 'uk', age: 30, relationship: 45 }); store.state.npcs[friend.id] = friend; p.npcIds.push(friend.id);
  rel.interact(friend.id, 'spendTime');
  plans.setHobby('painting');
  // The game has no separate sports-club engine: a sport as the main practice focus stands in for it.
  plans.plansOf().hobby.second = 'swimming';
  kids.getPet();
  const pet = npcsByRole('pet').at(-1);
  const petAge = pet.age;
  // A treatment plan: a diagnosed condition, and therapy that runs through the year.
  const rec = course.begin(CONDITION_BY_ID.gad, p, { severity: 55 }); rec.onsetWk = now() - 40;
  const gp = care.facilitiesHere().find((f) => f.defId === 'primary');
  const seen = care.seekAssessment('mental', gp.id, 'gp');
  // An assessment can be inconclusive; for this fixture, the GP records what was found if it was.
  const dx = R.activeDiagnoses().find((d) => d.conditionId === 'gad') ?? care.foundByDoctor(rec, 'primary', 'gp');
  const where = dx && ther.findProviders('cbt', 'gad').find((x) => x.ok);
  const started = where ? ther.startTherapy({ therapyId: 'cbt', facilityId: where.facilityId, providerId: where.providerId, dxId: dx.id }) : null;
  check(seen.ok && dx && started?.ok, `the assessment happened now, and therapy began (${seen.text.slice(0, 80)}…)`);
  const sessionsBefore = R.healthOf().therapies[0]?.attended ?? 0;
  social.createAccount('fullyear');
  plans.setOnline('consistent');
  const followers = p.social.followers;
  const party = plans.celebrate('birthday', [friend.id], 'generous');
  check(party.ok, 'a birthday party happens now');
  const year = store.state.year;
  const earned = p.finance.lifetimeEarned;
  const paint = p.skills?.painting ?? 0;
  const friendship = friend.meters.relationship;
  const ledger = R.healthOf().ledger.length;
  const milestones = p.milestones.length;
  ageUp();
  const h = R.healthOf();
  check(store.state.year === year + 1 && p.age === 31, 'exactly one year passed');
  check(p.finance.lifetimeEarned - earned > 0, 'the salary was paid');
  check(p.finance.savings >= 2000, 'savings grew');
  check(friend.alive && friend.age === 31, 'the friend lived the year too');
  check((p.skills.painting ?? 0) > paint, 'the hobby progressed');
  check(pet.age === petAge + 1 && pet.meters.relationship > 0, 'the pet aged, and was looked after');
  check(h.therapies[0].attended > sessionsBefore && h.therapies[0].attended <= 52, `therapy went on through the year (${h.therapies[0].attended} sessions)`);
  check(p.social.followers !== followers || p.social.posts > 0, 'the posting routine happened');
  check(new Set(h.ledger.map((x) => x.ref)).size === h.ledger.length && h.ledger.length > ledger, 'care was paid for, and nothing twice');
  check(store.state.yearReport?.planLines?.length >= 3, 'the year\'s plans are in the yearly report');
  const summary = summarize(store.state.yearReport.before, store.state, store.state.yearReport.planLines);
  check(summary.sections.some((x) => x.title === 'Health') && summary.sections.some((x) => x.title === 'Money'), 'the yearly summary covers health and money');
  void friendship; void milestones;
  // Save and reload: everything as it was.
  const snap = JSON.stringify({ y: store.state.year, cash: p.finance.cash, sav: p.finance.savings, t: h.therapies.map((c) => c.attended), pet: pet.age, plans: p.plans });
  const back = roundTrip();
  check(JSON.stringify({ y: store.state.year, cash: back.finance.cash, sav: back.finance.savings, t: back.health.therapies.map((c) => c.attended), pet: store.state.npcs[pet.id].age, plans: back.plans }) === snap, 'a reload leaves the whole year as it was');
}
section('the full year: job, savings, a friend, a hobby and sport, a pet, therapy, posting and a party, then one Age Up and a reload');

// ---------- 6. Several generations ----------
{
  const p0 = adult(30);
  const spouse = makeNpc({ role: 'spouse', countryId: 'uk', age: 30, relationship: 80 }); store.state.npcs[spouse.id] = spouse; p0.npcIds.push(spouse.id);
  plans.startTradition('summer', 'simple');
  const startYear = store.state.year;
  const archive = [];
  let generation = 1;
  for (let g = 0; g < 3; g++) {
    const p = store.state.player;
    // Each generation has a child, lives some years, and dies; the next carries on.
    if (!npcsByRole('child').length) { const kid = kids.newborn(npcsByRole('spouse')[0]); kid.age = 2; }
    for (let y = 0; y < 8 && p.alive; y++) ageUp();
    if (!p.alive) break;
    const yearAtDeath = store.state.year;
    archive.push({ name: `${p.firstName} ${p.lastName}`, id: p.id, milestones: p.milestones.length });
    die('old age');
    const heir = heirs().find((n) => n.role === 'child');
    if (!heir) break;
    const next = continueAs(heir.id);
    check(next && next.year === yearAtDeath, 'the heir carries on in the same year: the world does not reset');
    store.state = next;
    generation++;
    const np = next.player;
    check(np.generation === generation, 'the generation count goes up by one');
    check(np.plans?.traditions?.some((t) => t.idea === 'summer'), 'the family tradition carries on to the next generation');
    check(Object.values(next.npcs).some((n) => n.flags?.ancestor && `${n.firstName} ${n.lastName}` === archive.at(-1).name), 'the previous generation is kept, as an ancestor');
    np.age = Math.max(np.age, 25); np.flags.livesWithParents = false;
    const sp = makeNpc({ role: 'spouse', countryId: np.countryId, age: np.age, relationship: 80 }); next.npcs[sp.id] = sp; np.npcIds.push(sp.id);
  }
  check(generation >= 3, `three generations lived (${generation})`);
  check(store.state.year >= startYear + 16, 'the world year moved on continuously');
  const back = roundTrip();
  check(back.generation === generation && back.plans.traditions.length >= 1, 'the latest generation saves and loads with its inheritance');
}
section('generations: heirs carry on in the same world year, traditions pass down, ancestors are kept, saves load');

console.log(ok.map((x) => `ok  ${x}`).join('\n'));
if (problems.length) { console.log(`\n${problems.length} problem(s):\n${problems.join('\n')}`); process.exit(1); }
console.log('\nThe yearly model holds.');
