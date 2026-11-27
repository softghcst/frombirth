// Living Families & Growing Up, feature by feature, in the real game: blended families, teenage life, moving out,
// dating to marriage, and foster care; their scenes, their money, and every turn length.
// Run with: node tests/family-life.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceTurn } = await import('../js/engine/turns.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { applyChoice } = await import('../js/engine/eventEngine.js').catch(() => ({}));
const { EVENT_BY_ID } = await import('../js/data/events/index.js');
const LF = await import('../js/engine/livingFamilies.js');
const FL = await import('../js/engine/familyLife.js');
const { roleLabel } = await import('../js/engine/relationships.js');
const { houseParty } = await import('../js/engine/cliques.js');
const { blended, teen, home, love, care } = FL;

rng.seed(20261128);
const problems = [];
const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m) => ok.push(problems.length ? `(after problems) ${m}` : m);

const life = (age = 30, year = 2020, want = () => true) => {
  for (let i = 0; i < 30; i++) {
    store.state = createLife({ countryId: 'us', year: year - age });
    if (store.state.player.royal || !want(store.state)) continue;
    break;
  }
  const s = store.state;
  s.player.age = age; s.year = year; s.month = 0;
  s.player.finance.cash = 200000;
  delete s.livingFamilies;
  LF.ensureLivingFamilies(s);
  return s;
};
/** Moves the calendar on k months (the player's age left as it is) and lets the family's months catch up. */
const pass = (s, k = 1) => { for (let i = 0; i < k; i++) { s.month = (s.month ?? 0) + 1; if (s.month >= 12) { s.month = 0; s.year += 1; } } return LF.processThrough(s); };
const twoParents = (s) => s.player.npcIds.filter((id) => s.npcs[id]?.role === 'parent' && s.npcs[id].alive).length === 2;
const npc = (s, role, age, extra = {}) => {
  const n = structuredClone(Object.values(s.npcs).find((x) => x.role !== 'pet'));
  n.id = `npc_test_${role}_${Object.keys(s.npcs).length}`;
  Object.assign(n, { role, age, alive: true, flags: {}, ...extra });
  n.meters = { ...n.meters, relationship: extra.relationship ?? 70 };
  s.npcs[n.id] = n; s.player.npcIds.push(n.id);
  return n;
};

// ---------- Every scene a feature queues exists, and its choices reach the right engine ----------
{
  const ids = ['fl_parents_split', 'fl_stepparent_meet', 'fl_pressure_drink', 'fl_pressure_vape', 'fl_pressure_dare', 'fl_pressure_skip', 'fl_bff_trouble', 'fl_rent_arrears', 'fl_eviction_notice', 'fl_wedding_day', 'fl_cold_feet', 'fl_placement_offer', 'fl_kinship', 'fl_care_review'];
  for (const id of ids) {
    const e = EVENT_BY_ID[id];
    check(e && e.queuedOnly && e.choices.length >= 2, `scene ${id} exists, is queued only, and has choices`);
    for (const c of e?.choices ?? []) for (const o of c.outcomes) for (const fx of o.effects) check(fx.type === 'family' && fx.value.split(':').length === 3, `${id}: each choice is a family effect`);
  }
  section('scenes: all fourteen exist and route to their engines');
}

// ---------- Blended families ----------
{
  const s = life(9, 2020, twoParents);
  const p = s.player;
  p.flags.parentsStatus = 'together';
  blended.separateParents(s);
  const c = blended.custody(s);
  check(p.flags.livesWithParents && LF.householdOf(s) === (c.kind === 'shared' ? 'parents' : c.withNpc.gender === 'male' ? 'father' : 'mother'), `who the child lives with follows custody (${LF.householdOf(s)})`);
  check(s.pendingEvents.some((e) => e.id === 'fl_parents_split'), 'the separation is a scene');
  check(!blended.askToMove(s).ok, 'a nine-year-old cannot ask to move');
  check(blended.visitOtherParent(s).ok && !blended.visitOtherParent(s).ok, 'a weekend with the other parent, once a season');
  p.age = 16;
  let moved = false;
  for (let y = 0; y < 6 && !moved; y++) { s.year += 1; moved = blended.askToMove(s).ok; }
  check(moved && blended.custody(s).with === c.other, 'a teenager who keeps asking can move to the other parent');
  const r = blended.parentRemarries(s, blended.custody(s).withNpc);
  const step = s.npcs[r.stepId];
  check(/Step(father|mother|parent)/.test(roleLabel(step)), `a stepparent is labeled (${roleLabel(step)})`);
  check(blended.stepActions(step, s).some((a) => a.id === 'fl:step:know'), 'a stepparent has actions on their page');
  step.meters.relationship = 80;
  check(FL.familyAct('fl:step:know', step).ok && step.meters.relationship > 80, 'getting to know them brings you closer');
  check(blended.stepActions(step, s).some((a) => a.id === 'fl:step:call'), 'close enough, you can call them Mom or Dad');
  // The player's own marriage can bring stepchildren, and a stepchild can be adopted.
  const a = life(34);
  const spouse = npc(a, 'spouse', 39, { marriedAtAge: 34 });
  let kids = [];
  for (let i = 0; i < 40 && !kids.length; i++) { spouse.flags.stepKidsChecked = false; spouse.id += 'x'; a.npcs[spouse.id] = spouse; a.player.npcIds.push(spouse.id); kids = blended.onMarriage(spouse, a); }
  check(kids.length && kids.every((k) => k.role === 'stepchild' && k.parentIds[0] === spouse.id), 'a spouse with children brings stepchildren');
  const kid = kids[0];
  kid.age = 8; kid.meters.relationship = 90;
  let adopted = false;
  for (let i = 0; i < 12 && !adopted; i++) { delete kid.flags.adoptAsked; kid.id += 'y'; a.npcs[kid.id] = kid; adopted = blended.adoptStepchild(kid, a).ok; }
  check(adopted && kid.role === 'child' && kid.adopted, 'a stepchild can be adopted with consent');
  section('blended: custody, visits, a teenager\'s say, stepparents, stepchildren and adoption');
}

// ---------- Teenage life ----------
{
  const s = life(15);
  const p = s.player;
  const parent = s.npcs[p.npcIds.find((id) => s.npcs[id]?.role === 'parent')];
  parent.strictness = 90;
  const strict = teen.curfew(s);
  parent.strictness = 10;
  const easy = teen.curfew(s);
  check(strict < easy, `a strict parent sets an earlier curfew (${strict} vs ${easy})`);
  check(teen.nightOut(s, 'curfew').ok && !teen.nightOut(s, 'curfew').ok, 'one night out a season');
  // Caught breaking curfew: grounded, and grounding keeps you in.
  parent.strictness = 100;
  let grounded = null;
  for (let i = 0; i < 30 && !grounded; i++) { s.month = (s.month + 3) % 12; if (s.month === 0) s.year++; teen.nightOut(s, 'late'); grounded = teen.grounded(s); }
  check(grounded, 'staying out late can get you grounded');
  s.month = (s.month + 3) % 12; if (s.month === 0) s.year++;
  if (teen.grounded(s)) {
    check(!teen.nightOut(s, 'curfew').ok && /grounded/.test(teen.nightOut(s, 'curfew').text), 'grounded: no nights out');
    p.education.enrolled = true; p.education.stage = 'high';
    check(/grounded/i.test(houseParty().text), 'grounded: no house party either (cliques.js)');
  }
  pass(s, 6);
  // Driving: a permit, then supervised hours that count toward the test.
  p.age = 16;
  const before = p.flags.drivePractice ?? 0;
  check(teen.getPermit(s).ok && teen.practiceDriving(s).ok && (p.flags.drivePractice ?? 0) === before + 1, 'a learner\'s permit and practice hours (the test counts them)');
  // Prom at 17.
  p.age = 17; p.education.enrolled = true; p.education.stage = 'high';
  check(teen.promWithFriends(s).ok && teen.promOutfit('borrowed', s).ok, 'prom with friends, and an outfit');
  s.livingFamilies.teen.grounded = null; p.flags.groundedYear = null;
  check(teen.goToProm('diner', s).ok && !teen.goToProm('diner', s).ok, 'prom night happens once');
  // Peer pressure: say no, and it counts.
  const pal = npc(s, 'friend', 17);
  check(FL.familyLifeChoice('teen:pressure_drink:no', { them: pal.id }) && s.livingFamilies.teen.pressure.no === 1, 'saying no to pressure is remembered');
  section('teen: curfews follow strictness, grounding keeps you in, permits, prom, peer pressure');
}

// ---------- Moving out: the lease is billed through the year's money, once ----------
{
  const s = life(24);
  const p = s.player;
  p.flags.livesWithParents = true; p.education.enrolled = false; p.homeId = null;
  p.career = p.career ?? {};
  check(home.moveOut('room', null, s).ok, 'moving out');
  const l = home.lease(s);
  const perMonth = l.monthlyRent + l.monthlyBills;
  const year = s.year;
  pass(s, 11);
  advanceYear(); // the turn of the year: the last month, then the year's money
  const billed = s.livingFamilies.home.billed[year];
  check(!billed, 'the year\'s lease bill is taken once by the year\'s money');
  check(s.livingFamilies.home.arrears === 0, `and paid in full (${s.livingFamilies.home.arrears} owed)`);
  check(perMonth > 0 && home.lease(s).monthlyRent > l.monthlyRent - 1, 'the rent is a real amount');
  check(home.lease(s)?.end > year * 12 + 12, 'the lease renewed');
  // Back home: the lease ends early, a month from the deposit.
  const parent = home.homeToGoBackTo(s);
  if (parent) {
    parent.meters.relationship = 100;
    let back = false;
    for (let i = 0; i < 8 && !back; i++) { s.month = (s.month + 1) % 12; back = home.moveBackHome(s).ok; }
    check(back && p.flags.livesWithParents && !home.lease(s), 'moving back home ends the lease');
  }
  // Arrears: the landlord writes; then a notice; then eviction.
  const e = life(26);
  e.player.flags.livesWithParents = false; e.player.education.enrolled = false; e.player.homeId = null;
  home.moveOut('studio', null, e);
  e.livingFamilies.home.arrears = home.lease(e).monthlyRent * 3;
  pass(e, 1);
  check(e.pendingEvents.some((x) => x.id === 'fl_eviction_notice'), 'far behind on rent: an eviction notice');
  pass(e, 8);
  check(!home.lease(e) && LF.timeline(e).some((x) => x.kind === 'evicted'), 'not paid within six months: evicted');
  check(home.practiceSkill('cooking', e).ok && !home.practiceSkill('cooking', e).ok && home.skills(e).cooking > 10, 'cooking practice, once a season');
  section('moving out: lease billed once by the year\'s money, renewals, moving back, arrears and eviction, life skills');
}

// ---------- Dating, engagement and marriage ----------
{
  const s = life(28);
  const p = s.player;
  const n = npc(s, 'partner', 29, { relationship: 85 });
  n.flags.since = 26;
  check(love.stageOf(n, s) === 'dating', 'a new partner is dating');
  let ex = false;
  for (let i = 0; i < 10 && !ex; i++) { s.month = (s.month + 3) % 12; if (s.month === 0) s.year++; ex = love.defineRelationship(n.id, s).ok; }
  check(ex && ['exclusive', 'serious'].includes(love.stageOf(n, s)), 'asking to be exclusive');
  n.flags.livingTogether = s.year;
  pass(s, 1);
  check(n.flags.livesTogether && love.stageOf(n, s) === 'living together', 'moving in is read everywhere as living together');
  n.flags.views = { marriage: 'no' };
  check(love.marriageView(n) < 0, 'a partner who does not believe in marriage is harder to propose to');
  n.flags.engaged = true;
  pass(s, 1);
  const dated = love.setWeddingDate(n.id, 3, s);
  const party = love.engagementParty(n.id, s);
  check(dated.ok && party.ok, `a date, and an engagement party (${dated.text} / ${party.text})`);
  pass(s, 4);
  check(s.pendingEvents.some((x) => x.id === 'fl_wedding_day'), 'the wedding day comes, as a scene');
  check(/postpone/i.test(FL.familyLifeChoice('love:wedding_day:postpone', { them: n.id })) && love.engagement(n, s).weddingMonth > LF.lived(s), 'it can be postponed');
  // Widowed.
  n.role = 'spouse'; n.flags.engaged = false; n.alive = false;
  pass(s, 2);
  check(love.widowed(s).length === 1 && p.flags.widowed?.npcId === n.id, 'a spouse who dies leaves the player widowed');
  check(!love.readyToLoveAgain(s).ok, 'too soon to move on');
  section('love: stages, exclusivity, living together, engagement, the wedding day, widowhood');
}

// ---------- Foster care and guardianship ----------
{
  const s = life(32);
  const p = s.player;
  p.flags.livesWithParents = false; p.hidden.karma = 90;
  check(care.applyToFoster(s).ok, 'apply to foster');
  check(care.training(s).ok && !care.training(s).ok, 'training, a session a season');
  pass(s, 4);
  check(care.carer(s).status === 'approved', `approved after the home study (${care.carer(s).status})`);
  for (let i = 0; i < 40 && !s.livingFamilies.care.offer; i++) pass(s, 1);
  check(s.livingFamilies.care.offer && s.pendingEvents.some((x) => x.id === 'fl_placement_offer'), 'the agency calls with a placement');
  const r = care.answerOffer(true, s);
  const child = s.npcs[r.childId];
  check(r.ok && child.role === 'fosterchild' && /Foster/.test(roleLabel(child)), 'a child is placed: a real person in the family');
  check(care.careActions(child, s).length >= 2, 'a child in care has actions on their page');
  check(FL.familyAct('fl:care:time', child).ok, 'time together');
  // The allowance is paid at the turn of the year.
  pass(s, 3);
  const owed = s.livingFamilies.care.owed;
  const cash = p.finance.cash;
  check(owed > 0 && care.payAllowance(s) === owed && p.finance.cash === cash + owed, 'the fostering allowance is paid');
  // Adoption after six months, if the plan allows.
  child.meters.relationship = 90; child.age = 6;
  const x = care.placements(s).find((y) => y.childId === child.id);
  x.reason = 'abandoned'; x.start -= 7;
  check(care.adoptFromCare(child, s).ok && child.role === 'child' && child.adopted && child.flags.fromCare, 'adopted from foster care');
  // Aging out.
  const teenKid = npc(s, 'fosterchild', 17);
  s.livingFamilies.care.placements.push({ id: 'place_x', childId: teenKid.id, kind: 'foster', start: LF.lived(s) - 2, plan: 24, reason: 'neglect', visits: 0, end: null, outcome: null });
  teenKid.age = 18;
  pass(s, 1);
  check(s.livingFamilies.care.placements.find((y) => y.id === 'place_x').outcome === 'aged_out' && teenKid.flags.title === 'Former foster child', 'at 18, a child ages out of care');
  check(LF.validateLivingFamilies(s).length === 0, `valid (${LF.validateLivingFamilies(s).join('; ')})`);
  section('fostering: application, training, approval, an offer, a placement, the allowance, adoption, aging out');
}

// ---------- Every turn length: the months are kept up with, and played once ----------
{
  for (const step of [12, 6, 3]) {
    const s = life(14);
    s.settings.step = step;
    let fine = true;
    for (let t = 0; t < (36 / step); t++) {
      advanceTurn(s);
      s.pendingEvents = [];
      // The months are worked out at the turn of the year; between, they wait (never ahead of the calendar).
      if (s.month === 0 && s.livingFamilies.through !== LF.lived(s)) fine = false;
      if (s.livingFamilies.through > LF.lived(s)) fine = false;
    }
    check(fine, `${step}-month turns: every month lived is processed at the turn of the year, none twice, none early`);
  }
  section('turns: 3, 6 and 12 months all keep the family\'s months up to date');
}
// The same life, two years in 3-month turns and in 12-month turns: the family comes out exactly the same.
{
  const runs = [12, 3].map((step) => {
    rng.seed(4242);
    store.state = createLife({ countryId: 'us', year: 2008 });
    const s = store.state;
    s.settings.step = step;
    s.player.age = 8; s.player.flags.parentsStatus = 'together';
    for (let t = 0; t < 72 / step; t++) { advanceTurn(s); s.pendingEvents = []; }
    return JSON.stringify(s.livingFamilies);
  });
  check(runs[0] === runs[1], 'six years in 12- and 3-month turns: the family record is identical');
  section('turn lengths: identical outcomes');
}

void applyChoice;
if (problems.length) { console.log(`PROBLEMS:\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log(ok.map((x) => ` ✓ ${x}`).join('\n'));
console.log('Families grow, split, blend, move out, marry and take children in.');
