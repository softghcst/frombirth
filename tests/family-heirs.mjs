// Continuing as an heir, in a blended family (engine/legacy.js with engine/blended.js and engine/fostering.js): the
// spouse's child by someone else becomes the heir's step-sibling, a child the couple share stays a full sibling, a child
// of the old life by another partner is a half-sibling, the old life's close step-parent and step-sibling stay as
// step-relatives, a child raised in the household in foster care stays in touch, and a placement that was active ends
// on the record. Run with: node tests/family-heirs.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] ?? null };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { ensureLife } = await import('../js/engine/npcLives.js');
const { continueAs } = await import('../js/engine/legacy.js');
const { roleLabel } = await import('../js/engine/relationships.js');
const K = await import('../js/engine/kinship.js');
const F = await import('../js/engine/fostering.js');

rng.seed(8642);
const problems = [];
let passed = 0;
const check = (c, m) => { if (c) passed++; else { problems.push(m); console.log(` ✗ ${m}`); } };

let s; do { s = createLife({ countryId: 'us' }); } while (s.player.royal);
store.state = s;
const p = s.player;
p.age = 62; p.birthYear = s.year - 62; p.flags.livesWithParents = false;
const add = (o, extra = {}) => { const n = makeNpc({ countryId: 'us', ...o }); Object.assign(n, extra); s.npcs[n.id] = n; p.npcIds.push(n.id); ensureLife(n); return n; };
const spouse = add({ role: 'spouse', age: 60, relationship: 80 }); spouse.marriedAtAge = 40;
const exPartner = add({ role: 'ex', age: 61, relationship: 30 });
const heir = add({ role: 'child', age: 30, relationship: 85 }); heir.parentIds = [spouse.id];
const full = add({ role: 'child', age: 27, relationship: 80 }); full.parentIds = [spouse.id];
const half = add({ role: 'child', age: 35, relationship: 70 }); half.parentIds = [exPartner.id];
const stepkid = add({ role: 'stepchild', age: 33, relationship: 70 }); stepkid.parentIds = [spouse.id, makeNpc({ role: 'friend', countryId: 'us', age: 63 }).id]; stepkid.flags.stepVia = spouse.id;
const stepdad = add({ role: 'stepparent', age: 85, relationship: 70 }); stepdad.flags.partnerOf = 'someone'; stepdad.flags.married = true;
const stepsis = add({ role: 'stepsibling', age: 64, relationship: 60 });
const coldStep = add({ role: 'stepsibling', age: 66, relationship: 20 });
// A child placed in foster care, close; and the placement on the record.
p.fostering = { status: 'approved', steps: {}, placements: [] };
const fc = add({ role: 'fosterchild', age: 12, relationship: 75 });
p.fostering.placements.push({ id: 'pl1', childId: fc.id, kind: 'foster', start: s.year - 3, end: null, status: 'active', parentIds: [], reviews: [], goal: 'reunification', rights: 'intact' });
fc.flags.placementId = 'pl1';
// The heir's parent died? No: the spouse is alive. The old life ends here.
p.alive = false;

const next = continueAs(heir.id);
check(!!next, 'continuing as the eldest child works');
store.state = next;
const P = next.player;
const role = (n) => next.npcs[n.id]?.role ?? null;
check(role(spouse) === 'parent', 'the spouse is the heir\'s parent');
check(role(full) === 'sibling' && K.siblingKind(P, next.npcs[full.id]) === 'full', `a child of both is a full sibling (${K.siblingKind(P, next.npcs[full.id])})`);
check(role(half) === 'sibling' && K.siblingKind(P, next.npcs[half.id]) === 'half', `a child of the old life by an ex is a half-sibling (${K.siblingKind(P, next.npcs[half.id])})`);
check(typeof next.npcs[half.id].flags.half === 'string' && next.npcs[next.npcs[half.id].flags.half], 'and the shared parent is written down, as a person');
check(role(stepkid) === 'sibling' && K.siblingKind(P, next.npcs[stepkid.id]) === 'half', 'the spouse\'s child by someone else shares the spouse with the heir: a half-sibling');
check(role(stepdad) === 'relative' && /Step-grand/.test(roleLabel(next.npcs[stepdad.id])), `a close step-parent of the old life is a step-grandparent (${roleLabel(next.npcs[stepdad.id])})`);
check(role(stepsis) === 'relative' && /Step-/.test(roleLabel(next.npcs[stepsis.id])), `a close step-sister is a step-aunt (${roleLabel(next.npcs[stepsis.id])})`);
check(role(coldStep) === null, 'a step-relative who was never close is not carried over');
check(role(fc) === 'friend' && !next.npcs[fc.id].flags.placementId, `a child raised in care, close to the family, stays in touch (${roleLabel(next.npcs[fc.id])})`);
check(p.fostering.placements[0].status === 'ended' && /agency/.test(p.fostering.placements[0].outcome), 'and the placement ended on the record when the carer died');
check(new Set(P.npcIds).size === P.npcIds.length, 'nobody twice');

// The spouse's child who is not the heir's sibling at all (a spouse who is not the heir's parent): a step-sibling.
{
  let t; do { t = createLife({ countryId: 'us' }); } while (t.player.royal);
  store.state = t;
  const q = t.player; q.age = 55; q.birthYear = t.year - 55;
  const a = (o) => { const n = makeNpc({ countryId: 'us', ...o }); t.npcs[n.id] = n; q.npcIds.push(n.id); ensureLife(n); return n; };
  const firstPartner = a({ role: 'ex', age: 56 });
  const second = a({ role: 'spouse', age: 54, relationship: 80 }); second.marriedAtAge = 45;
  const h2 = a({ role: 'child', age: 28 }); h2.parentIds = [firstPartner.id];
  const sk = a({ role: 'stepchild', age: 25, relationship: 60 }); sk.parentIds = [second.id]; sk.flags.stepVia = second.id;
  q.alive = false;
  const n2 = continueAs(h2.id);
  store.state = n2;
  check(n2.npcs[sk.id]?.role === 'stepsibling' && K.siblingKind(n2.player, n2.npcs[sk.id]) === 'step', 'the old life\'s stepchild is the heir\'s step-sibling, not a half-sibling');
}

if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log(`${passed} checks passed. A blended family carries on: step-, half- and full siblings told apart, and people raised in care still family.`);
