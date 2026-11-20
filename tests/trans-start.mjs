// A transgender life chosen in the designer: Sex is what they are registered as at birth; Transgender (yes) makes them
// the other, or non-binary. A trans boy is registered a girl and comes to know he is a boy, and the card says so.
// Run with: node tests/trans-start.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const who = await import('../js/engine/identity.js');
const { identityRows } = await import('../js/ui/identity.js');

rng.seed(20261122);
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };
const card = () => Object.fromEntries(identityRows());

for (const [sex, gender, word, knows] of [['female', 'male', 'Girl', 'a boy'], ['male', 'female', 'Boy', 'a girl']]) {
  const born = sex;
  let s; do { s = createLife({ countryId: 'us', sex, trans: true }); } while (s.player.royal);
  store.state = s; const p = s.player;
  check(p.gender === born && p.flags.bornAs === born && p.flags.trueGender === gender, `${gender} + transgender: registered ${born} at birth, truly ${gender} (${p.gender}/${p.flags.trueGender})`);
  p.age = 11;
  who.identity().knows = true;
  const c = card();
  check(c.Gender === word, `${gender}: the card says "${c.Gender}"`);
  check(c.Inside === `${knows.replace(/^a /, '').replace(/^./, (x) => x.toUpperCase())}, inside. Not living it yet.`, `${gender}: they know they are ${knows} ("${c.Inside}")`);
}
// Sex alone, not transgender: as registered. Non-binary: registered as the sex chosen, truly non-binary.
{ let s; do { s = createLife({ countryId: 'us', sex: 'female', trans: false }); } while (s.player.royal);
  check(s.player.gender === 'female' && !s.player.flags.trueGender, 'female, not transgender: a girl');
  do { s = createLife({ countryId: 'us', sex: 'male', gender: 'nonbinary', trans: true }); } while (s.player.royal);
  check(s.player.gender === 'male' && s.player.flags.trueGender === 'nonbinary', `male, non-binary: registered male, truly non-binary (${s.player.gender}/${s.player.flags.trueGender})`);
  do { s = createLife({ countryId: 'us', sex: 'female' }); } while (s.player.royal);
  check(s.player.flags.bornAs === 'female', 'sex chosen, transgender left to chance: still registered female'); }
let s; do { s = createLife({ countryId: 'us', sex: 'male', trans: false }); } while (s.player.royal);
store.state = s; s.player.age = 30;
check(card().Gender === 'Man' && !card().Inside && !card().Exploring, 'a man who is not transgender is simply a man');

// ---------- The journey: questioning, trying things, and an answer ----------
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { deathRoll } = await import('../js/engine/death.js');
deathRoll.spared = true;
const year = () => { const p = store.state.player; p.stats.health = Math.max(p.stats.health, 80); advanceYear(); p.legal.pending = null; p.legal.incarceration = null; };
const fresh = (o) => { let s; do { s = createLife({ countryId: 'us', ...o }); } while (s.player.royal); store.state = s; return s.player; };
const exploreAll = () => { for (const x of who.exploreOptions().filter((o) => !o.why && o.id !== 'counselor').slice(0, 2)) who.explore(x.id); };

// A trans boy who goes looking finds out; nothing medical is offered before he does.
{
  const p = fresh({ sex: 'female', trans: true });
  p.flags.realizeAge = 30; // the feeling would come late: this one goes looking first
  while (p.age < 12) year();
  check(!who.canQuestion(), 'a child of 12 does not question their gender here: that starts in the teenage years');
  while (p.age < 13) year();
  check(!who.canStartHrt() && !who.surgeryOptions().length && !who.discovered(), 'before finding out, no hormones or surgery are offered');
  check(who.canQuestion() && who.startQuestioning().ok && card().Exploring === 'Just starting', `anyone can start questioning (${card().Exploring})`);
  let years = 0;
  while (who.quest().stage === 'questioning' && years++ < 8) { exploreAll(); if (who.quest().stage === 'questioning') year(); }
  check(who.quest().stage === 'found' && who.identity().knows, `exploring, a trans boy finds out (${who.quest().stage}, clarity ${who.quest().clarity})`);
  check(card().Inside === 'Boy, inside. Not living it yet.', `the card: ${card().Inside}`);
  check(p.milestones.some((m) => /Realized you are transgender/.test(m.text)), 'it is a milestone');
  while (p.age < 16) year();
  check(who.canStartHrt(), 'now hormone therapy can be asked for (with a parent\'s consent under 18)');
  check(who.liveAs('male').ok && p.gender === 'male' && !card().Inside, 'he lives as a boy, and the card says so');
}

// A cis girl who explores finds it is not for her, and can ask again years later.
{
  const p = fresh({ sex: 'female', trans: false });
  while (p.age < 14) year();
  who.startQuestioning();
  let years = 0;
  while (who.quest().stage === 'questioning' && years++ < 8) { exploreAll(); if (who.quest().stage === 'questioning') year(); }
  check(who.quest().stage === 'settled' && !who.identity().knows && p.gender === 'female', `exploring, a girl who is not trans settles it (${who.quest().stage})`);
  check(!who.canStartHrt() && !who.canQuestion(), 'nothing medical, and not again straight away');
  for (let i = 0; i < 5; i++) year();
  check(who.canQuestion(), 'five years on, she can ask again if she wants');
}

// A trans girl who never looks: the feeling comes, and pushing it away costs.
{
  const p = fresh({ sex: 'male', trans: true });
  p.flags.realizeAge = 15;
  while (p.age < 14) { year(); store.state.pendingEvents = []; }
  year();
  const ev = store.state.pendingEvents.find((e) => e.id === 'gender_feeling');
  check(ev && ev.cast.words.born === 'boy', `at ${p.age} the feeling comes: "when people call you a ${ev?.cast.words.born}"`);
  const { feelingChoice } = who;
  store.state.pendingEvents = [];
  p.stats.mood = 70;
  feelingChoice('push');
  const after = p.stats.mood;
  year(); store.state.pendingEvents = [];
  check(after < 70 && p.stats.mood <= after, `pushing it away hurts, and keeps hurting (${70} → ${after} → ${p.stats.mood})`);
  year();
  check(store.state.pendingEvents.some((e) => e.id === 'gender_feeling') || p.age - who.quest().nudged < 3, 'and it comes back');
  store.state.pendingEvents = [];
  feelingChoice('look');
  check(who.quest().stage === 'questioning' && who.quest().clarity >= 30, 'looking into it starts the questioning, with a head start');
}

// When the feeling comes, for those who never go looking: any time from the teenage years into the thirties.
{
  const ages = [];
  for (let i = 0; i < 300; i++) { const s = createLife({ countryId: 'us', sex: i % 2 ? 'male' : 'female', trans: true }); ages.push(s.player.flags.realizeAge); }
  check(Math.min(...ages) >= 13 && Math.max(...ages) >= 30 && ages.some((a) => a >= 18 && a < 25), `the feeling comes at 13 at the earliest, sometimes not till the thirties (${Math.min(...ages)}–${Math.max(...ages)})`);
}

if (problems.length) { console.log(`${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Gender and transgender at creation mean what they say.');
