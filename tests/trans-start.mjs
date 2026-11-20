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
  check(c['What you know'] === `You are ${knows}. Nobody has been told.`, `${gender}: they know they are ${knows} ("${c['What you know']}")`);
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
check(card().Gender === 'Man' && !card()['What you know'], 'a man who is not transgender is simply a man');

if (problems.length) { console.log(`${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Gender and transgender at creation mean what they say.');
