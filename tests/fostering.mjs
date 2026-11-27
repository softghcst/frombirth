// Foster care, kinship care and guardianship, with the player as the carer (engine/fostering.js). The vertical slice:
// approval through training, a background check and a home study; a child placed, who is a real person with parents
// who stay their parents; reviews once a year; going home when the family is ready (the carer cannot block it); a
// guardianship that is not an adoption; an adoption only once a court has ended the parents' rights; a relative's
// child in kinship care; turning 18; save and reload with nobody duplicated.
// Run with: node tests/fostering.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] ?? null };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { roleLabel } = await import('../js/engine/relationships.js');
const N = await import('../js/engine/neighborhood.js');
const F = await import('../js/engine/fostering.js');
const K = await import('../js/engine/kinship.js');
const chron = await import('../js/engine/chronicle.js');

rng.seed(2468);
const problems = [];
let passed = 0;
const check = (c, m) => { if (c) passed++; else { problems.push(m); console.log(` ✗ ${m}`); } };
const year = () => { store.state.pendingEvents = []; advanceYear(); store.state.player.alive = true; };
const household = () => { const H = N.hoods(); return H.cur ? H.hhs[H.cur.hh].m : []; };

/** An adult of thirty in a rented home of their own, now. */
function carer({ age = 30, countryId = 'us', year0 = null } = {}) {
  let s;
  do { s = createLife({ countryId, ...(year0 ? { year: year0 } : {}) }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  p.age = age; p.birthYear = s.year - age;
  p.flags.livesWithParents = false; p.education.enrolled = false; p.finance.cash = 30000;
  N.settle(s, { quiet: true }); N.syncHousehold(s);
  return p;
}

// ---------- Who can foster ----------
{
  const young = carer({ age: 20 });
  check(/21/.test(F.applyBlock(young)), 'under 21, not yet');
  const home = carer(); home.flags.livesWithParents = true;
  check(/home of your own/.test(F.applyBlock(home)), 'living with parents, not yet');
  const old = carer({ year0: 1925 });
  check(/no licensed foster care/.test(F.applyBlock(old)), 'before licensed foster care existed, not at all');
  const poor = carer(); poor.finance.cash = -5000;
  check(F.applyBlock(poor) === '', 'being short of money is no bar to applying');
}

// ---------- Approval ----------
{
  const p = carer();
  p.legal.record.push({ convicted: true, crime: 'theft', age: 22 });
  F.applyToFoster(); year();
  check(F.fostering().status === 'declined' && /record/.test(F.fostering().declinedWhy), 'a criminal record ends an application');
}
const p = carer();
check(F.applyToFoster().ok && F.fostering().status === 'applying', 'applying starts a year of training, a check and a home study');
check(!F.applyToFoster().ok, 'and only one application at a time');
year();
const f = F.fostering();
check(f.status === 'approved' && f.steps.training && f.steps.background && f.steps.home, 'a year later: approved, each step done');
delete f.offer; store.state.pendingEvents = [];

// ---------- A placement ----------
const ref = F.referral({ age: 9, reason: 'illness' });
const kid = ref.child;
const [mom] = ref.parents;
check(kid.parentIds.length >= 1 && kid.parentIds.every((id) => store.state.npcs[id]), 'the child has real parents');
check(!store.state.player.npcIds.includes(kid.id), 'before saying yes, the child is not yet in the player\'s life');
check(F.acceptPlacement(ref).ok, 'saying yes');
const pl = F.placementOf(kid.id);
check(pl && pl.status === 'active' && pl.goal === 'reunification' && pl.rights === 'intact' && pl.authority === 'day-to-day care', 'a placement: active, aiming at home, parents\' rights intact, the carer\'s authority day-to-day');
check(kid.role === 'fosterchild' && roleLabel(kid).startsWith('Foster'), `the child is a foster child (${roleLabel(kid)})`);
check(household().includes(kid.id), 'living in the player\'s household');
check(K.bioParentIdsOf(kid).join() === K.legalParentIdsOf(kid).join() && K.bioParentIdsOf(kid).includes(mom.id), 'the parents are still the child\'s biological and legal parents');
check(!kid.adopted && !kid.adoptionInfo, 'foster care is not adoption');
check(chron.events((e) => e.type === 'care_placement').length === 1, 'the placement is a canonical event');
check(store.state.pendingEvents.some((e) => e.id === 'fc_welcome'), 'and a welcome scene');
check(mom.legal == null || !mom.legal?.record?.length, 'no crime is invented for the child\'s parents');

// Reviews once a year; the plan follows the family, not the carer.
year();
check(pl.reviews.length === 1, 'a review after a year');
const kept = pl.progress;
year();
check(pl.reviews.length === 2 || pl.status !== 'active', 'one review a year');
if (pl.status === 'active') { pl.progress = 90; kid.meters.relationship = 100; year(); }
check(pl.status === 'reunified', 'when the family is ready, the child goes home, however close the carer has grown');
check(kid.role === 'friend' && !household().includes(kid.id) && kid.parentIds.includes(mom.id), 'home with their family; still in touch; still their parents\' child');
check(chron.events((e) => e.type === 'care_reunification').length === 1, 'the reunification is on the record');
void kept;

// ---------- Guardianship and adoption ----------
const ref2 = F.referral({ age: 11, reason: 'crisis' });
F.acceptPlacement(ref2);
const kid2 = ref2.child; const pl2 = F.placementOf(kid2.id);
check(!F.adoptFromCare(kid2.id).ok, 'adoption is not possible while the parents\' rights are intact');
check(!F.becomeGuardian(kid2.id).ok, 'nor guardianship while the plan is going home');
pl2.goal = 'permanency';
const last2 = kid2.lastName;
check(F.becomeGuardian(kid2.id).ok, 'guardianship once the plan is a permanent home');
check(kid2.role === 'ward' && kid2.lastName === last2 && !kid2.adopted && K.legalParentIdsOf(kid2).every((id) => ref2.parents.some((x) => x.id === id)), 'a ward keeps their name and their legal parents: no adoption record');
check(household().includes(kid2.id), 'and lives with their guardian');

const ref3 = F.referral({ age: 6, reason: 'crisis' });
F.acceptPlacement(ref3);
const kid3 = ref3.child; const pl3 = F.placementOf(kid3.id);
pl3.goal = 'permanency'; pl3.rights = 'ended';
const birth3 = [...kid3.parentIds];
check(F.adoptFromCare(kid3.id).ok, 'adoption once a court has ended the parents\' rights');
check(kid3.role === 'child' && kid3.adopted && !!kid3.adoptionInfo, 'through the ordinary adoption record');
check(K.bioParentIdsOf(kid3).join() === birth3.join() && K.legalParentIdsOf(kid3).includes(store.state.player.id), 'birth parents kept apart from the legal parent: the player');
check(F.placements().filter((x) => x.childId === kid3.id).length === 1, 'one placement for the child, now closed');

// An older child is asked.
const ref4 = F.referral({ age: 14, reason: 'crisis' });
F.acceptPlacement(ref4); const pl4 = F.placementOf(ref4.child.id); pl4.goal = 'permanency'; pl4.rights = 'ended'; ref4.child.meters.relationship = 30;
check(!F.adoptFromCare(ref4.child.id).ok, 'a fourteen-year-old who is not ready can say no to adoption');
check(F.activePlacements().length <= F.MAX_PLACED, 'never more children placed than the household can take');

// ---------- Kinship care ----------
{
  const q = carer();
  const sib = makeNpc({ role: 'sibling', countryId: 'us', age: 34 }); sib.alive = false;
  const niece = makeNpc({ role: 'niece', countryId: 'us', age: 8 }); niece.parentIds = [sib.id];
  for (const n of [sib, niece]) { store.state.npcs[n.id] = n; q.npcIds.push(n.id); }
  check(F.kinNeeding().some((n) => n.id === niece.id), 'a niece with no parent able to care for her needs a home');
  check(F.takeInKin(niece.id).ok, 'family can take her in, without being approved foster carers');
  const kp = F.placementOf(niece.id);
  check(kp.kind === 'kinship' && niece.role === 'niece' && household().includes(niece.id), 'kinship care: she stays a niece, and lives with family');
  check(!niece.adopted && niece.parentIds.includes(sib.id), 'kinship care is not adoption');
  niece.age = 18; year();
  check(kp.status === 'aged out', 'at 18 the placement ends');
}

// ---------- Poverty is never a reason ----------
{
  const q = carer();
  const own = makeNpc({ role: 'child', countryId: 'us', age: 5 }); store.state.npcs[own.id] = own; q.npcIds.push(own.id);
  for (let i = 0; i < 4; i++) { q.finance.cash = -20000; year(); }
  check(own.role === 'child' && !own.flags.placementId && !q.flags.care, 'a family short of money keeps its child');
}

// ---------- Save and reload ----------
store.state = (() => { const s = store.state; return s; })();
{
  const s = (() => { carer(); F.applyToFoster(); year(); delete F.fostering().offer; const r = F.referral({ age: 10 }); F.acceptPlacement(r); return store.state; })();
  const childId = F.activePlacements()[0].childId;
  saveGame(s);
  const back = loadGame(s.slotId);
  store.state = back;
  const pls = back.player.fostering.placements;
  check(pls.length === 1 && pls[0].childId === childId && back.npcs[childId]?.role === 'fosterchild', 'after reload: the placement and the child');
  check(back.player.npcIds.filter((id) => id === childId).length === 1, 'the child is in the player\'s life once');
  check(back.npcs[childId].parentIds.every((id) => back.npcs[id]), 'with their parents');
}

if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log(`${passed} checks passed. Fostering: a child with their own family, a plan decided at reviews, and guardianship, kinship care and adoption kept distinct.`);
