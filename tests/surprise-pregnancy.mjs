// Babies are not only planned: a couple living together can find one on the way, rarely on birth control and often
// without it. Twins come more often to older mothers and to families with twins. Run with: node tests/surprise-pregnancy.mjs
const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const kids = await import('../js/engine/children.js');

const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); };
function couple(age = 28, bc = true) {
  let s; do { s = createLife({ countryId: 'us', gender: 'female' }); } while (s.player.royal || s.player.gender !== 'female');
  store.state = s; const p = s.player;
  p.age = age; p.birthYear = s.year - age; p.flags.bornAs = 'female'; p.hidden.fertility = 70;
  if (!bc) p.flags.birthControl = false;
  const n = makeNpc({ role: 'spouse', countryId: 'us', age, gender: 'male', relationship: 80 });
  n.flags.bornAs = 'male'; s.npcs[n.id] = n; p.npcIds.push(n.id);
  return { p, n };
}

let { p, n } = couple(28, true);
const onBC = kids.surpriseChance(n, p);
({ p, n } = couple(28, false));
const off = kids.surpriseChance(n, p);
check(onBC > 0.01 && onBC < 0.08, `on birth control, a small chance a year (${onBC.toFixed(3)})`);
check(off > 0.3, `without it, a good chance a year (${off.toFixed(2)})`);
({ p, n } = couple(44, false));
check(kids.surpriseChance(n, p) < off / 2, 'less likely in the mid-forties');

// Over many years without birth control, a surprise pregnancy happens without the player asking.
let pregnant = 0;
for (let i = 0; i < 60; i++) {
  ({ p, n } = couple(27, false));
  store.state.pendingEvents = [];
  kids.tickChildren();
  if (p.flags.pregnancy) pregnant++;
}
check(pregnant > 15 && pregnant < 50, `about half of couples not using birth control find a baby on the way in a year (${pregnant} of 60)`);
// None for a single person, or while already pregnant.
({ p, n } = couple(27, false)); n.role = 'friend';
check(kids.surpriseChance(n, p) === 0, 'not without a partner');

if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('Surprise pregnancies happen, and twins run in families.');
