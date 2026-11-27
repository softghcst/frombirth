// Checks sentiments: feelings about a person, why, how they fade, what they change, clearing the air, and the wedding:
// only someone invited who chose not to come leaves the player hurt.
// Run with: node tests/sentiments.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const S = await import('../js/engine/sentiments.js');
const { remember, resolve } = await import('../js/engine/conditions.js');
const { tickRelationships, interact, basicActions } = await import('../js/engine/relationships.js');
const romance = await import('../js/engine/romance.js');
const wg = await import('../js/engine/weddingGuests.js');

rng.seed(2718);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };

function life(age = 30) {
  do { store.state = createLife({ countryId: 'us' }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age; p.flags.livesWithParents = false; p.education.enrolled = false; p.flags.longevity = 18; p.traits = [];
  for (const n of Object.values(store.state.npcs)) n.alive = false;
  p.npcIds = []; store.state.traditions = [];
  return p;
}
function person(role, age = 30, relationship = 70) {
  const p = store.state.player;
  const n = makeNpc({ role, countryId: p.countryId, age, relationship });
  n.city = p.city; delete n.flags.abroad;
  store.state.npcs[n.id] = n; p.npcIds.push(n.id);
  return n;
}

// ---------- 1. A feeling, why, and how it fades ----------
let p = life();
let f = person('friend');
S.feel(f, 'grateful', 'they covered for you', 60);
S.feel(f, 'grateful', 'they covered for you again', 40);
check(S.sentimentsOf(f).length === 1 && S.strongest(f).strength === 60 && /again/.test(S.strongest(f).why), 'the same feeling again is renewed, never weakened');
S.feel(f, 'hurt', 'they forgot your birthday', 30); S.feel(f, 'admire', 'they ran a marathon', 50);
check(S.sentimentsOf(f).length === 2 && !S.hasSentiment(f, 'hurt'), 'at most two feelings about one person: the weakest goes');
check(S.profileLine(f).length < 70 && /^Grateful: they covered for you again$/.test(S.profileLine(f)), `one short line for the profile ("${S.profileLine(f)}")`);
const g = person('friend'); S.feel(g, 'hurt', 'they missed your party', 45);
g.flags.heart = { forgiving: 90 }; const h = person('friend'); S.feel(h, 'hurt', 'they missed your party', 45); h.flags.heart = { forgiving: 10 };
S.tickSentiments();
check(S.strongest(g).strength < S.strongest(h).strength, 'someone forgiving lets go faster');
for (let i = 0; i < 4; i++) S.tickSentiments();
check(!S.strongest(g) && !S.strongest(h) && store.state.journal.some((e) => /has faded/.test(e.text)), 'feelings fade with the years, and a hard one fading is told');
section('a feeling has a reason, is renewed not weakened, fades, and shows as one short line');

// ---------- 2. From what happens ----------
p = life();
const partner = person('partner', 30, 70);
remember(partner, 'theyCheated', 'They were unfaithful.');
check(S.hasSentiment(partner, 'betrayed') && /unfaithful/.test(S.profileLine(partner)), 'a partner who cheated leaves the player betrayed');
const sis = person('sibling', 32);
remember(sis, 'missedWedding', 'You were not at their wedding.');
check(S.hasSentiment(sis, 'guilty'), 'missing their wedding leaves the player guilty');
remember(sis, 'cameToBirthday', 'Came to your birthday.');
check(S.sentimentsOf(sis).length === 1, 'and an everyday memory leaves nothing');
check(resolve('sentiment.them.guilty', { them: sis.id }) === 100 && resolve('sentiment.them.hurt', { them: sis.id }) === 0, 'a scene can ask how the player feels about someone');
const ex = person('partner', 30, 80); romance.breakUp(ex.id);
check(S.hasSentiment(ex, 'old_flame'), 'parting while still fond leaves an old flame');
const left = person('partner', 30, 40); romance.leftBy(left.id);
check(S.hasSentiment(left, 'hurt'), 'being left leaves the player hurt');
section('feelings come from what happens: cheating, missing their day, breakups');

// ---------- 3. What a feeling changes ----------
function drift(kind) {
  p = life();
  const x = person('friend', 30, 70); x.lastInteractionAge = 20;
  if (kind) S.feel(x, kind, 'test', 80);
  tickRelationships();
  return 70 - x.meters.relationship;
}
const plain = drift(null); const warm = drift('grateful'); const sore = drift('resentful');
check(warm < plain && sore > plain, `closeness drifts slower with gratitude, faster with resentment (${warm}, ${plain}, ${sore})`);
p = life();
const calm = person('friend', 30, 70);
check(!basicActions(calm).some((a) => a.id === 'clearAir'), 'nothing to clear: no "Clear the air"');
S.feel(calm, 'resentful', 'they took your parking space', 60);
check(basicActions(calm).some((a) => a.id === 'clearAir'), 'something between you: "Clear the air" is there');
let cleared = 0;
for (let i = 0; i < 60; i++) {
  p = life(); const x = person('friend', 30, 70); S.feel(x, 'hurt', 'test', 60);
  const r = interact(x.id, 'clearAir');
  if (r.ok && !S.hasSentiment(x, 'hurt')) cleared += 1;
}
check(cleared >= 15 && cleared <= 50, `clearing the air works often, not always (${cleared} of 60)`);
section('feelings change how closeness drifts, and can be talked through');

// ---------- 4. The wedding: only someone invited who chose not to come ----------
let hurt = 0; let wrongHurt = 0; let trials = 0;
for (let i = 0; i < 40; i++) {
  p = life();
  const fiance = person('partner', 30, 90); fiance.flags.engaged = true;
  const kin = [person('parent', 60, 20), person('sibling', 32, 25), person('friend', 30, 35), person('friend', 31, 40)];
  const away = person('friend', 30, 80); away.flags.inmate = { released: false };
  const outsider = person('friend', 30, 35);
  const chosen = [...kin, away].map((n) => n.id);
  const list = wg.holdWedding(fiance, 40, chosen);
  trials += 1;
  check(list.invited.length === chosen.length && !list.invited.includes(outsider.id), 'the planner\'s own list is the one used');
  for (const x of list.couldNot) {
    const n = store.state.npcs[x.id];
    if (x.why === 'did not come' && S.hasSentiment(n, 'hurt')) hurt += 1;
    if (x.why !== 'did not come' && S.hasSentiment(n, 'hurt')) wrongHurt += 1;
  }
  check(!S.hasSentiment(away, 'hurt'), 'someone in prison has a reason: no hurt');
  check(!S.hasSentiment(outsider, 'hurt'), 'someone not invited is not blamed for not coming');
  for (const id of list.came) check(!S.hasSentiment(store.state.npcs[id], 'hurt'), 'nobody who came');
}
check(hurt > 0 && wrongHurt === 0, `an invited guest who chose not to come leaves the player hurt (${hurt} in ${trials} weddings), and nobody with a reason does`);
p = life();
const f2 = person('partner', 30, 90); f2.flags.engaged = true;
const many = Array.from({ length: 50 }, () => person('friend', 30, 60).id);
check(wg.holdWedding(f2, 40, many).invited.length === wg.seatsFor(40), 'never more guests than seats');
const mom = person('parent', 60, 40);
check(wg.invitable(f2)[0].id === mom.id && wg.guestList(f2, 12).includes(mom.id), 'the list to choose from puts family first, and family is asked even when not close');
section('at the wedding, only an invited guest who chose not to come leaves the player hurt');

for (const line of ok) console.log(`ok   ${line}`);
if (problems.length) { for (const m of [...new Set(problems)]) console.log(`FAIL ${m}`); console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Sentiments hold together.');
