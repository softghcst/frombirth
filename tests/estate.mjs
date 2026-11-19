// A will and the people in it (engine/estateReview.js, engine/death.js): beneficiaries by id; one notice when someone
// named dies, and nothing rewritten; alternates; the playable heir as a separate choice; a review when the family
// changes; the same whatever the length of a turn. Run with: node tests/estate.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store, prunePending } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { ensureLife } = await import('../js/engine/npcLives.js');
const { EVENTS } = await import('../js/data/events/index.js');
const { resolveChoice } = await import('../js/engine/eventEngine.js');
const { ledgerOf } = await import('../js/engine/ledger.js');
const last = await import('../js/engine/death.js');
const review = await import('../js/engine/estateReview.js');
const legacy = await import('../js/engine/legacy.js');
const turns = await import('../js/engine/turns.js');
const save = await import('../js/save.js');

rng.seed(4242);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;

function life(age = 62) {
  do { store.state = createLife({ countryId: 'us' }); } while (S().player.royal);
  const p = P();
  p.age = age; p.birthYear = S().year - age; p.flags.livesWithParents = false; p.education.enrolled = false; p.finance.cash = 300000;
  // Only the family made here: nobody else to inherit by default.
  for (const id of [...p.npcIds]) { const n = S().npcs[id]; if (n && ['child', 'spouse', 'partner', 'grandchild'].includes(n.role)) n.role = 'relative'; }
  ledgerOf();
  return p;
}
function person(role, age, parentId = null) {
  const p = P();
  const n = makeNpc({ role, countryId: p.countryId, age, relationship: 80 });
  ensureLife(n);
  if (parentId) n.parentIds = [parentId];
  S().npcs[n.id] = n; p.npcIds.push(n.id);
  return n;
}
const queued = (id) => S().pendingEvents.filter((e) => e.id === id);
function play(id, value) {
  const i = S().pendingEvents.findIndex((e) => e.id === id);
  const [q] = S().pendingEvents.splice(i, 1);
  const ev = EVENTS.find((e) => e.id === id);
  return resolveChoice(ev, ev.choices.findIndex((x) => x.outcomes[0].effects.some((f) => f.value === value)), q.cast);
}
const named = () => last.willHeirs().map(([n]) => n.id).sort();

// ---------- 1. A beneficiary dies ----------
{
  const p = life();
  const wife = person('spouse', 60);
  const ada = person('child', 35); const ben = person('child', 32);
  const gail = person('grandchild', 10, ada.id);
  last.addHeir(ada.id, true); last.addHeir(ben.id);
  check(JSON.stringify(p.flags.will.heirs.slice().sort()) === JSON.stringify([ada.id, ben.id].sort()) && p.flags.will.heirs.every((id) => id.startsWith('npc_')), 'a will names people by who they are (their id), not by what they are called');
  ada.firstName = 'Adelaide';
  check(named().includes(ada.id), 'a change of name does not take someone out of a will');
  check(review.setAlternate(ada.id, gail.id).ok && review.alternateOf(ada.id) === gail.id && !review.setAlternate(ada.id, ada.id).ok && !review.setAlternate(wife.id, gail.id).ok, 'an alternate can be named for someone in the will (not themselves, and only for someone named)');
  review.tickEstate();
  check(review.notices().length === 0 && !queued('will_beneficiary_died').length, 'while everyone named is alive, there is nothing to review');
  // Ada dies.
  ada.alive = false;
  const raw = JSON.stringify(p.flags.will);
  review.tickEstate();
  const n = review.notices();
  check(n.length === 1 && n[0].kind === 'beneficiary' && n[0].npcId === ada.id && n[0].alternateId === gail.id, 'when someone named dies, there is one notice, about them');
  const q = queued('will_beneficiary_died');
  check(q.length === 1 && /Adelaide/.test(q[0].cast.words.gone) && new RegExp(gail.firstName).test(q[0].cast.words.alt), 'and the player is asked whether to review the will, told who stands in their place');
  prunePending();
  check(queued('will_beneficiary_died').length === 1, 'the question is not lost because it is about someone who has died');
  check(JSON.stringify(p.flags.will) === raw, 'nothing in the will is rewritten');
  check(JSON.stringify(named()) === JSON.stringify([ben.id, gail.id].sort()) && !named().includes(ada.id), 'the dead are not treated as heirs: the alternate named for them takes their place');
  review.tickEstate(); review.tickEstate();
  check(review.notices().length === 1 && queued('will_beneficiary_died').length === 1, 'one notice, however many years pass');
  // Saved and loaded: still one.
  const meta = save.saveGame(S());
  store.state = save.loadGame(meta?.slotId ?? S().slotId);
  review.tickEstate();
  check(review.notices().length === 1 && queued('will_beneficiary_died').length === 1 && P().flags.will.alternates[ada.id] === gail.id, 'and after saving and loading');
  // Put off: it stays on the list and is not asked again.
  play('will_beneficiary_died', 'beneficiary:later');
  review.tickEstate();
  check(review.notices().length === 1 && review.notices()[0].status === 'later' && !queued('will_beneficiary_died').length, 'put off, it stays on the list and is not raised again');
  // The player can still change the will.
  const kid2 = Object.values(S().npcs).find((x) => x.id === ben.id);
  check(last.removeHeir(kid2.id).ok && !named().includes(kid2.id) && P().flags.will.alternates?.[ada.id] === gail.id, 'the will can be changed, and what the change does not mention stays');
  check(review.resolveNotice(review.notices()[0].id, 'done').ok && review.notices().length === 0, 'and the notice marked as reviewed');
}
{
  life();
  const ada = person('child', 35); const ben = person('child', 32);
  last.addHeir(ada.id, true); last.addHeir(ben.id);
  ada.alive = false;
  review.tickEstate();
  check(JSON.stringify(named()) === JSON.stringify([ben.id]) && /nobody in their place/.test(queued('will_beneficiary_died')[0].cast.words.alt), 'with no alternate named, their share goes to the others named, and the player is told so');
  play('will_beneficiary_died', 'beneficiary:review');
  check(review.notices()[0].status === 'review', 'choosing to review keeps it open until it is done');
}
section('a beneficiary\'s death: one notice, nothing rewritten, alternates, deferral, saved');

// ---------- 2. The playable heir is a separate choice ----------
{
  const p = life();
  const ada = person('child', 35); const ben = person('child', 32);
  const friend = person('friend', 60);
  last.addHeir(ada.id, true);
  check(review.chooseHeir(ben.id).ok && review.chosenHeir().id === ben.id && JSON.stringify(named()) === JSON.stringify([ada.id]), 'the one to carry on as is chosen apart from who inherits');
  check(!review.chooseHeir(friend.id).ok && review.chosenHeir().id === ben.id, 'and must be someone the player could carry on as');
  ada.alive = false;
  review.tickEstate();
  check(review.chosenHeir().id === ben.id && !queued('heir_died').length && queued('will_beneficiary_died').length === 1, 'a beneficiary\'s death does not touch that choice');
  ben.alive = false;
  review.tickEstate(); review.tickEstate();
  check(queued('heir_died').length === 1 && review.notices().filter((n) => n.kind === 'heir').length === 1 && /has Passed Away/i.test(EVENTS.find((e) => e.id === 'heir_died').text), 'if the chosen heir dies first, the player is told, once');
  check(review.chosenHeir() === null && p.flags.chosenHeir === ben.id, 'and nobody is chosen in their place for them');
  const cy = person('child', 20);
  check(legacy.heirs().some((h) => h.id === cy.id) && review.chooseHeir(cy.id).ok && review.chosenHeir().id === cy.id, 'the player can choose another');
}
section('the playable heir: its own choice, its own notice, never chosen for the player');

// ---------- 3. When the family changes ----------
{
  const p = life(40);
  const wife = person('spouse', 38);
  const ada = person('child', 8);
  last.addHeir(ada.id, true);
  review.tickEstate();
  p.finance.cash -= 500; review.tickEstate();
  check(review.notices().length === 0, 'ordinary years, and ordinary spending, raise nothing');
  person('child', 0);
  review.tickEstate();
  check(review.notices().length === 1 && review.notices()[0].kind === 'review' && review.notices()[0].reasons.includes('a child was born') && queued('will_review').length === 1, 'a child born since the will was written raises a review');
  p.assets.push({ id: 'asset_x', kind: 'property', name: 'A house', value: 300000 });
  review.tickEstate();
  check(review.notices().length === 1 && review.notices()[0].reasons.length === 2 && queued('will_review').length === 1, 'a second change while one is waiting joins it: one notice, not two');
  const raw = JSON.stringify(p.flags.will);
  play('will_review', 'review:later');
  check(JSON.stringify(p.flags.will) === raw, 'and the will says what it said');
  wife.alive = false;
  review.resolveNotice(review.notices()[0].id, 'done');
  review.tickEstate();
  check(review.notices().some((n) => n.kind === 'review' && n.reasons.includes('your spouse died')), 'a spouse\'s death raises one too');
  // A life with no will written is not nagged about one.
  life(40); person('spouse', 38); review.tickEstate(); person('child', 0); review.tickEstate();
  check(review.notices().length === 0, 'someone who has written no will is not asked to review one');
}
section('reviews when the family changes: one at a time, never for small things');

// ---------- 4. Whatever the length of a turn ----------
{
  life();
  const ada = person('child', 35); const ben = person('child', 32);
  last.addHeir(ada.id, true); last.addHeir(ben.id);
  ada.alive = false;
  S().settings.step = 3;
  turns.advanceTurn();
  const part = review.notices().length;
  for (let i = 0; i < 3 && (S().month ?? 0) !== 0; i++) turns.advanceTurn();
  check(part <= 1 && review.notices().filter((n) => n.kind === 'beneficiary').length === 1, `advancing three months at a time, the death is noticed once, and not lost (${review.notices().length})`);
  for (let i = 0; i < 4; i++) turns.advanceTurn();
  check(review.notices().filter((n) => n.kind === 'beneficiary').length === 1, 'and not again the year after');
}
section('three months at a time or a year: noticed once, not lost');

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of [...new Set(problems)]) console.log(' ✗', p);
  process.exit(1);
}
for (const m of ok) console.log(' ✓', m);
console.log('Wills keep up with the living.');
