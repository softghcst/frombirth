// A transgender life chosen at creation: "Gender" is who the character is, and they are registered at birth as the
// other. A trans boy is registered a girl and comes to know he is a boy; the Identity card says so the right way round.
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

for (const [gender, born, word, knows] of [['male', 'female', 'Girl', 'a boy'], ['female', 'male', 'Boy', 'a girl']]) {
  let s; do { s = createLife({ countryId: 'us', gender, trans: true }); } while (s.player.royal);
  store.state = s; const p = s.player;
  check(p.gender === born && p.flags.bornAs === born && p.flags.trueGender === gender, `${gender} + transgender: registered ${born} at birth, truly ${gender} (${p.gender}/${p.flags.trueGender})`);
  p.age = 11;
  who.identity().knows = true;
  const c = card();
  check(c.Gender === `${word}, as registered at birth`, `${gender}: the card says "${c.Gender}"`);
  check(c['What you know'] === `You are ${knows}. Nobody has been told.`, `${gender}: they know they are ${knows} ("${c['What you know']}")`);
}
let s; do { s = createLife({ countryId: 'us', gender: 'male', trans: false }); } while (s.player.royal);
store.state = s; s.player.age = 30;
check(card().Gender === 'Man' && !card()['What you know'], 'a man who is not transgender is simply a man');

if (problems.length) { console.log(`${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Gender and transgender at creation mean what they say.');
