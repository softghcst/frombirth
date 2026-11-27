// The Living Families foundation (engine/livingFamilies.js), checked in the real game. These began as the supplied
// patch's own domain tests (identity, distinct legal and care states, no duplicated step relations, minors' limits,
// housing, marriage, care, persistence, idempotent time); each is kept here against the integrated version, where the
// family itself lives on the game's own people rather than in a second record.
// Run with: node tests/living-families.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { saveGame, loadGame } = await import('../js/save.js');
const LF = await import('../js/engine/livingFamilies.js');
const FL = await import('../js/engine/familyLife.js');
const { blended, teen, home, love, care } = FL;

rng.seed(20261127);
const problems = [];
const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m) => ok.push(problems.length ? `(after problems) ${m}` : m);

const life = (age = 30, year = 2020) => {
  do { store.state = createLife({ countryId: 'us', year: year - age }); } while (store.state.player.royal);
  const s = store.state;
  s.player.age = age; s.year = year; s.month = 0;
  s.player.finance.cash = 100000;
  delete s.livingFamilies;
  LF.ensureLivingFamilies(s);
  return s;
};

// 1. Identity and the record: a schema, nothing invented, months counted from now.
{
  const s = life(16);
  const f = LF.ensureLivingFamilies(s);
  check(f.schema === 1 && f.events.length === 0, 'a new record has a schema and no made-up past');
  check(f.through === LF.lived(s), `months already lived count as processed (${f.through} vs ${LF.lived(s)})`);
  check(LF.ageIn(s, LF.lived(s) + 1) === s.player.age && LF.ageIn(s, s.year * 12 - 1) === s.player.age - 1, 'the age during a month is worked out from the month');
  section('identity: a schema, no invented history, months from now');
}

// 2. Minors: no lease, no engagement, no carer; a child can be placed only with an adult.
{
  const s = life(16);
  const p = s.player;
  check(!home.moveOut('studio').ok && /18/.test(home.whyNotMoveOut()), 'a 16-year-old cannot sign a lease');
  const partner = Object.values(s.npcs).find((n) => n.role === 'parent');
  check(!LF.engagementOk(s, p.id, partner.id).ok, 'an engagement needs two adults');
  check(!LF.careOk(s, partner.id, p.id).ok, 'a child cannot be a carer');
  check(!LF.careOk(s, p.id, p.id).ok, 'nobody is their own carer');
  section('minors: no lease, no engagement, never a carer');
}

// 3. Blended families: links recorded once, biological parentage unchanged.
{
  let s; let ps;
  for (let i = 0; i < 20; i++) { s = life(10); ps = Object.values(s.npcs).filter((n) => n.role === 'parent' && n.alive && s.player.npcIds.includes(n.id)); if (ps.length === 2) break; }
  const p = s.player;
  p.flags.parentsStatus = 'together';
  if (ps.length === 2) {
    const before = JSON.stringify(ps.map((n) => n.parentIds ?? null));
    check(blended.separateParents(s).ok && p.flags.parentsStatus === 'separated', 'parents can separate');
    const c = blended.custody(s);
    check(c && c.withNpc && c.otherNpc && c.withNpc !== c.otherNpc, 'custody names the parent the child lives with, and the other');
    check(!blended.separateParents(s).ok, 'a separation happens once');
    const r = blended.parentRemarries(s, c.withNpc);
    check(r.ok && s.npcs[r.stepId]?.role === 'stepparent', 'a parent who meets someone gives the child a stepparent');
    const kids = blended.stepsiblings(s).length;
    check(!blended.parentRemarries(s, c.withNpc).ok, 'the same parent does not get a second stepparent for the child at once');
    check(blended.stepsiblings(s).length === kids, 'no duplicated stepsiblings');
    check(JSON.stringify(ps.map((n) => n.parentIds ?? null)) === before && ps.every((n) => n.role === 'parent'), 'biological parents stay parents');
    check(LF.timeline(s).some((e) => e.kind === 'stepparent'), 'the timeline has it');
  } else check(false, 'the test life has two parents');
  section('blended families: recorded once, parentage unchanged');
}

// 4. Teen milestones are not doubled.
{
  const s = life(17);
  const p = s.player;
  p.education.enrolled = true; p.education.stage = 'high';
  const pal = Object.values(s.npcs).find((n) => n.role !== 'pet' && n.age > 10) ?? null;
  const friend = s.npcs[Object.keys(s.npcs)[0]];
  friend.role = 'friend'; friend.age = 17; friend.alive = true; friend.meters.relationship = 90;
  if (!p.npcIds.includes(friend.id)) p.npcIds.push(friend.id);
  check(teen.chooseBestFriend(friend.id, s).ok && friend.flags.title === 'Best friend', 'a best friend is chosen');
  const once = teen.askToProm(friend.id, s);
  check(!teen.askToProm(friend.id, s).ok, 'asking the same person to prom twice is not two asks');
  check(once.ok || /else/.test(once.text), `prom asks are answered (${once.text})`);
  void pal;
  section('teen milestones: once each');
}

// 5. Housing: an adult signs one lease at a time; leaving returns the deposit.
{
  const s = life(22);
  const p = s.player;
  p.flags.livesWithParents = true; p.education.enrolled = false; p.homeId = null;
  const cash = p.finance.cash;
  const r = home.moveOut('studio', null, s);
  check(r.ok && home.lease(s) && !p.flags.livesWithParents, `an adult moves out on a lease (${r.text})`);
  check(p.finance.cash === cash - home.lease(s).deposit, 'the deposit is paid');
  check(!home.moveOut('room', null, s).ok, 'one lease at a time');
  section('housing: one lease, deposit paid');
}

// 6. Marriage: an engagement first, then the romance rules decide.
{
  const s = life(30);
  const p = s.player;
  const n = Object.values(s.npcs).find((x) => x.role === 'parent');
  n.role = 'partner'; n.age = 30; n.flags.since = 26; n.meters.relationship = 90; n.flags.engaged = false;
  check(!love.setWeddingDate(n.id, 6, s).ok, 'no wedding date without an engagement');
  n.flags.engaged = true;
  LF.processThrough(s, LF.lived(s) + 1);
  check(love.engagement(n, s), 'an engagement is recorded once it begins');
  check(love.setWeddingDate(n.id, 6, s).ok, 'a date can be set');
  check(love.stageOf(n, s) === 'engaged', 'the stage is engaged');
  section('marriage: engagement, a date, the stage');
}

// 7. Care: only through the agency or the family; one placement per child; adoption after six months.
{
  const s = life(35);
  const p = s.player;
  p.flags.livesWithParents = false;
  check(!care.answerOffer(true, s).ok, 'no placement without an offer');
  check(care.applyToFoster(s).ok && care.carer(s).status === 'applying', 'an adult with a home can apply');
  const nephew = Object.values(s.npcs).find((x) => x.role === 'sibling') ?? Object.values(s.npcs)[0];
  nephew.role = 'niece'; nephew.age = 8; nephew.alive = true;
  if (!p.npcIds.includes(nephew.id)) p.npcIds.push(nephew.id);
  check(care.takeInRelative(nephew.id, s).ok, 'a relative\'s child can come to live with the player');
  check(!care.takeInRelative(nephew.id, s).ok, 'not twice');
  check(!care.seekGuardianship(nephew, s).ok, 'guardianship after six months, not at once');
  check(LF.validateLivingFamilies(s).length === 0, `the record is valid (${LF.validateLivingFamilies(s).join('; ')})`);
  section('care: offers, kinship once, guardianship after six months');
}

// 8. Time: a month runs once, however often it is asked; months in one call or four come out the same.
{
  const base = life(20);
  base.player.flags.livesWithParents = true; base.player.education.enrolled = false;
  home.moveOut('studio', null, base);
  const start = LF.lived(base);
  const a = structuredClone(base);
  const b = structuredClone(base);
  store.state = a;
  const n1 = LF.processThrough(a, start + 12);
  check(n1 === 12 && LF.processThrough(a, start + 12) === 0, 'a month is processed once');
  store.state = b;
  for (const k of [3, 6, 9, 12]) LF.processThrough(b, start + k);
  const pick = (s) => JSON.stringify({ home: s.livingFamilies.home, events: s.livingFamilies.events.map((e) => [e.kind, e.at]), care: s.livingFamilies.care });
  check(pick(a) === pick(b), 'twelve months at once, or in four turns, come out the same');
  check(a.livingFamilies.home.lease.end > start + 12, 'the lease renewed once, at its end');
  section('time: idempotent, and the same at any turn length');
}

// 9. Persistence: saved and loaded, nothing lost and nothing broken.
{
  const s = life(25);
  s.slotId = 'lf-test';
  s.player.flags.livesWithParents = true; s.player.education.enrolled = false;
  home.moveOut('room', null, s);
  LF.recordEvent(s, 'test', [s.player.id], 'A test event.');
  saveGame(s);
  const back = loadGame('lf-test');
  check(back && back.livingFamilies?.home?.lease?.kind === 'room', 'the lease survives a save and load');
  check(back.livingFamilies.events.some((e) => e.kind === 'test'), 'the timeline survives');
  check(LF.validateLivingFamilies(back).length === 0, 'and is still valid');
  // An older save, from before these features, gains the record without any invented past.
  const old = structuredClone(back);
  delete old.livingFamilies;
  const partner = Object.values(old.npcs).find((n) => n.role !== 'pet');
  partner.role = 'partner'; partner.flags.livingTogether = 2019;
  if (!old.player.npcIds.includes(partner.id)) old.player.npcIds.push(partner.id);
  FL.migrateFamilyLife(old);
  check(old.livingFamilies.events.length === 0 && partner.flags.livesTogether === true, 'an older save: no invented events; a partner moved in with is living together');
  section('persistence: save and load, and older saves');
}

if (problems.length) { console.log(`PROBLEMS:\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log(ok.map((x) => ` ✓ ${x}`).join('\n'));
console.log('Living families hold together.');
