// School for every child the player is raising: their own, a stepchild at home, and a child placed with them in foster
// care, kinship care or guardianship. A child in care stays at the school they know where they can (with transport) or
// starts at once at the local one and falls back a little; their marks come back as they settle; the carer goes to
// their education plan meeting; their school is the agency's to change, not the carer's alone.
// Run with: node tests/foster-school.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { deathRoll } = await import('../js/engine/death.js');
const F = await import('../js/engine/fostering.js');
const kid = await import('../js/engine/kidschool.js');

rng.seed(20261128);
deathRoll.spared = true; // about school, not about dying young
const problems = [];
let passed = 0;
const check = (c, m) => { if (c) passed++; else { problems.push(m); console.log(` ✗ ${m}`); } };
const year = () => { store.state.pendingEvents = []; advanceYear(); };

const carer = (countryId = 'us') => {
  do { store.state = createLife({ countryId, year: 1990 }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = 35; store.state.year = 2025; p.flags.livesWithParents = false; p.finance.cash = 1e9; p.legal.incarceration = null;
  p.fostering = { status: 'approved', steps: { training: 2024, background: 2024, home: 2024 }, placements: [], approvedYear: 2024, agency: 'County Family Services' };
  return p;
};
const placeChild = (age) => {
  const ref = F.referral({ age });
  const r = F.acceptPlacement(ref);
  return { r, child: ref.child };
};

// A child placed with the player goes to school from the first week.
{
  const p = carer();
  const { r, child } = placeChild(9);
  check(r.ok, `a placement is made (${r.text})`);
  check(child.life?.edu, 'a child in care has a school life of their own');
  check(kid.homeKid(child) && kid.inCare(child) && kid.atSchool(child), 'they count as a child the player is raising, at school');
  check(kid.schoolOf(child) && child.life.edu.fromCare, `they start at a school straight away (${kid.schoolOf(child)?.name})`);
  check(store.state.journal.slice(-4).some((j) => /stays at|starts at/.test(j.text)), 'and the journal says which: their own school, or the local one');
  const acts = kid.actionsFor(child).map((a) => a.id);
  check(acts.includes('homework') && acts.includes('schoolEvent') && acts.includes('carePlan'), `the carer can help with homework, go to school events and the education plan meeting (${acts.join(', ')})`);
  check(!acts.includes('kidSchool'), 'the carer cannot move a child in care to another school alone');
  const m1 = kid.carePlanMeeting(child.id);
  check(m1.ok && /education plan/i.test(m1.text) && child.life.edu.boost > -0.3, `the education plan meeting (${m1.text})`);
  check(!kid.carePlanMeeting(child.id).ok, 'once a year');
  check(kid.homework(child.id, 'gentle').ok, 'homework help, as for any child');
  // Settling: the longer the placement, the more they catch up.
  child.meters.relationship = 70;
  const before = child.life.edu.boost ?? 0;
  child.flags.careSince = store.state.year - 2;
  kid.tickKids();
  check((child.life.edu.boost ?? 0) > before, `a child two years settled catches up (${before} -> ${child.life.edu.boost})`);
  // Through real years: marks are given, and the child stays at school.
  for (let i = 0; i < 2; i++) year();
  check(child.life.edu.gpa > 0 && kid.schoolOf(child), `marks each year in care (${child.life.edu.gpa})`);
  void p;
}

// In England: the Personal Education Plan and the Virtual School.
{
  carer('uk');
  const { child } = placeChild(11);
  const m = kid.carePlanMeeting(child.id);
  check(/Personal Education Plan/.test(m.text) && /Virtual School/.test(m.text), 'in England, the Personal Education Plan with the Virtual School');
}

// Too young for school: no school life yet, and no school actions.
{
  carer();
  const { child } = placeChild(2);
  check(!kid.atSchool(child) && !kid.actionsFor(child).some((a) => a.id === 'carePlan'), 'a toddler in care is not at school yet');
}

// A stepchild who lives with the player goes to school as the player's own children do.
{
  const p = carer();
  const spouse = makeNpc({ role: 'spouse', countryId: 'us', age: 36, relationship: 80 });
  store.state.npcs[spouse.id] = spouse; p.npcIds.push(spouse.id);
  const step = makeNpc({ role: 'stepchild', countryId: 'us', age: 10, relationship: 60 });
  step.parentIds = [spouse.id]; step.flags.stepVia = spouse.id;
  store.state.npcs[step.id] = step; p.npcIds.push(step.id);
  year();
  check(step.life?.edu && kid.atSchool(step) && kid.schoolOf(step), 'a stepchild at home has a school, marks and school actions');
  check(kid.actionsFor(step).some((a) => a.id === 'kidSchool'), 'and their school can be changed, as for one\'s own child');
  spouse.role = 'ex';
  check(!kid.homeKid(step), 'once their parent is no longer the player\'s spouse, they are not the player\'s to school');
}

deathRoll.spared = false;
if (problems.length) { console.log(`PROBLEMS:\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log(`${passed} checks: every child the player raises goes to school; a child in care keeps their school where they can, and catches up as they settle.`);
