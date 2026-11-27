// A family's life goes on after the player grows up, and a partner's children are part of a relationship from early on.
// - Parents can separate when the player is an adult (no arrangement to make; they are told), and a parent on their
//   own, separated or widowed, may meet someone new up to 75.
// - Someone the player dates may have children (their life says how many). They are met while dating, as the
//   partner's son or daughter; living with their parent, they live with the player; at the wedding they become
//   step-children, with nobody made twice; after a breakup, a child the player never grew close to leaves their life.
// - Moving in with a partner sets livesTogether, the flag the rest of the game reads, and older saves are repaired.
// Run with: node tests/family-later.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { ensureLife } = await import('../js/engine/npcLives.js');
const { deathRoll } = await import('../js/engine/death.js');
const { roleLabel } = await import('../js/engine/relationships.js');
const { resolveChoice } = await import('../js/engine/eventEngine.js');
const { EVENT_BY_ID } = await import('../js/data/events/index.js');
const B = await import('../js/engine/blended.js');
const T = await import('../js/engine/together.js');

rng.seed(20261129);
deathRoll.spared = true; // about families, not about dying young
const problems = [];
let passed = 0;
const check = (c, m) => { if (c) passed++; else { problems.push(m); console.log(` ✗ ${m}`); } };
const S = () => store.state;
const P = () => store.state.player;
const people = () => P().npcIds.map((id) => S().npcs[id]).filter(Boolean);
const year = () => { S().pendingEvents = []; advanceYear(); };

/** A grown-up whose parents are alive and together. */
function grownUp(age = 30) {
  let s;
  do { s = createLife({ countryId: 'us' }); } while (s.player.royal || Object.values(s.npcs).filter((n) => n.role === 'parent').length !== 2);
  store.state = s;
  s.player.age = age; s.player.flags.livesWithParents = false; s.player.flags.parentsStatus = 'together'; s.player.finance.cash = 1e7;
  for (const n of people().filter((x) => x.role === 'parent')) { n.alive = true; n.age = age + 28; delete n.flags.livesApart; }
  return s.player;
}
const add = (o) => { const n = makeNpc({ countryId: 'us', ...o }); S().npcs[n.id] = n; P().npcIds.push(n.id); return n; };

// ---------- Parents, after the player has grown up ----------
{
  grownUp(32);
  const [a, b] = people().filter((n) => n.role === 'parent');
  const r = B.separateParents(a, b, { legal: 'divorce' });
  check(r === null && P().flags.parentsStatus === 'separated' && !P().family.arrangement, 'a grown-up\'s parents can separate: no arrangement to make');
  check(S().pendingEvents.some((e) => e.id === 'blend_separation_adult'), 'they tell the grown-up child (a scene of its own)');
  check(P().family.separations.length === 1, 'the separation is on the record');
  const note = resolveChoice(EVENT_BY_ID.blend_separation_adult, 0, S().pendingEvents.find((e) => e.id === 'blend_separation_adult').cast);
  check(note !== undefined, 'the scene can be answered');
  // On their own, either may meet someone, even with the player long grown up.
  let met = false;
  for (let i = 0; i < 40 && !met; i++) { year(); met = people().some((n) => n.role === 'stepparent'); }
  check(met, 'a separated parent of a grown-up can meet someone new');
}
{
  // A widowed parent too, past sixty.
  // Kept at seventy, they can still die in any of those years: then a new family is tried, as the question is whether a
  // widowed parent who is living can meet someone.
  let met = false;
  for (let tries = 0; tries < 4 && !met; tries++) {
    grownUp(45);
    const [a, b] = people().filter((n) => n.role === 'parent');
    b.alive = false;
    a.age = 70;
    for (let i = 0; i < 60 && !met && a.alive; i++) { year(); a.age = 70; met = people().some((n) => n.role === 'stepparent' && n.flags.partnerOf === a.id); }
  }
  check(met, 'a widowed parent of seventy can find someone again');
}
{
  // In ordinary play it is rare (about one couple in two hundred a year); raised here so the yearly step can be seen
  // doing it on its own.
  const was = B.CHANCE.separate;
  B.CHANCE.separate = 3;
  grownUp(40);
  year();
  B.CHANCE.separate = was;
  check(P().flags.parentsStatus === 'separated' && P().family.separations.at(-1)?.age >= 18, 'the yearly step separates a grown-up\'s parents by itself');
}

// ---------- A partner's children ----------
{
  grownUp(33);
  const partner = add({ role: 'partner', age: 38, relationship: 75 });
  ensureLife(partner);
  partner.life.kids = 2;
  year();
  const kids = B.partnersKids(partner.id);
  check(kids.length === 2 && kids.every((k) => k.parentIds?.[0] === partner.id), `a partner\'s children are real people in the player\'s life (${kids.length})`);
  check(kids.every((k) => roleLabel(k) === `${partner.firstName}'s ${k.gender === 'male' ? 'son' : k.gender === 'female' ? 'daughter' : 'child'}`), `labeled as the partner's children (${kids.map(roleLabel).join(', ')})`);
  const told = S().pendingEvents.find((e) => e.id === 'blend_partner_kids');
  check(told, 'the partner tells the player about them, in a scene');
  if (told) { resolveChoice(EVENT_BY_ID.blend_partner_kids, 0, told.cast); check(S().npcs[told.cast.kid].flags.met, 'asking to meet them, the player meets them'); }
  year();
  check(B.partnersKids(partner.id).length === 2, 'nobody is made twice');
  partner.flags.livesTogether = true;
  year();
  check(kids.filter((k) => k.age < 18).every((k) => k.flags.liveIn), 'living with their parent, a child under 18 lives with the player');
  // The wedding: the same children become step-children.
  partner.role = 'spouse';
  const step = B.stepchildrenOnMarriage(partner);
  check(step.length === 2 && kids.every((k) => k.role === 'stepchild' && !k.flags.title), 'at the wedding, they are the player\'s step-children');
  check(people().filter((n) => n.parentIds?.includes(partner.id)).length === 2, 'and no second set of children is made');
}
{
  grownUp(34);
  const partner = add({ role: 'partner', age: 40, relationship: 70 });
  ensureLife(partner);
  partner.life.kids = 1;
  year();
  const [kid] = B.partnersKids(partner.id);
  check(kid, 'a partner\'s child');
  kid.meters.relationship = 20;
  partner.role = 'ex';
  year();
  check(!P().npcIds.includes(kid.id), 'after a breakup, a child the player never grew close to leaves their life');
}

// ---------- Moving in ----------
{
  grownUp(28);
  const partner = add({ role: 'partner', age: 29, relationship: 90 });
  partner.flags.since = 26; partner.lastInteractionAge = -1;
  // At this relationship a partner says yes nineteen times in twenty; asked again if not ready (the question is what a yes does).
  let r;
  for (let i = 0; i < 5 && !partner.flags.livesTogether; i++) { partner.lastInteractionAge = -1; r = T.doBond(partner.id, 'moveInTogether'); }
  check(partner.flags.livesTogether === true, `moving in together sets livesTogether (${typeof r === 'object' ? r.text : r})`);
  // An older save: a partner moved in with under the old flag is living together once loaded.
  const old = add({ role: 'partner', age: 30 });
  old.flags.livingTogether = 2015;
  B.migrateFamilyLife(S());
  check(old.flags.livesTogether === true, 'an older save is repaired on load');
}

deathRoll.spared = false;
if (problems.length) { console.log(`PROBLEMS:\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log(`${passed} checks: parents\' lives go on, a partner\'s children are met while dating, and moving in is recognized.`);
