// The teenage years: a best friend chosen, prom (a date or friends, an outfit, what comes after), and peer pressure from
// a real friend, answered. Played through the actions on people's pages (engine/together.js) and the game's own scenes.
// Run with: node tests/teen-years.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { deathRoll } = await import('../js/engine/death.js');
const { resolveChoice } = await import('../js/engine/eventEngine.js');
const { EVENT_BY_ID } = await import('../js/data/events/index.js');
const T = await import('../js/engine/together.js');
const Y = await import('../js/engine/teenYears.js');
const { houseRules } = await import('../js/engine/houseRules.js');

rng.seed(20261130);
deathRoll.spared = true;
const problems = [];
let passed = 0;
const check = (c, m) => { if (c) passed++; else { problems.push(m); console.log(` ✗ ${m}`); } };
const S = () => store.state;
const P = () => store.state.player;
const acts = (n) => T.bondActions(n).map((a) => a.id);

function teen(age = 15) {
  let s;
  do { s = createLife({ countryId: 'us' }); } while (s.player.royal || !Object.values(s.npcs).some((n) => n.role === 'parent'));
  store.state = s;
  s.player.age = age; s.player.flags.livesWithParents = true; s.player.finance.cash = 1e6;
  s.player.education.enrolled = true; s.player.education.stage = age >= 14 ? 'high' : 'middle';
  return s.player;
}
const friend = (role = 'friend', rel = 70) => {
  const n = makeNpc({ role, countryId: 'us', age: P().age, relationship: rel });
  S().npcs[n.id] = n; P().npcIds.push(n.id);
  return n;
};
const answer = (id, choice) => { const e = S().pendingEvents.find((x) => x.id === id); return e ? resolveChoice(EVENT_BY_ID[id], choice, e.cast) : null; };

// A best friend.
{
  teen(14);
  const a = friend(); const b = friend('classmate', 80);
  check(acts(a).includes('with:bestFriend') && acts(b).includes('with:bestFriend'), 'a close friend or classmate can be made a best friend');
  check(!acts(friend('friend', 30)).includes('with:bestFriend'), 'not someone you are not close to');
  check(T.doBond(a.id, 'with:bestFriend').ok && a.flags.title === 'Best friend', 'a best friend');
  check(T.doBond(b.id, 'with:bestFriend').ok && b.flags.title === 'Best friend' && !a.flags.title && b.role === 'friend', 'only ever one; a classmate made best friend is a friend');
  check(acts(b).includes('with:bffDay') && T.doBond(b.id, 'with:bffDay').ok, 'a whole day with your best friend');
}

// Prom.
{
  teen(17);
  const date = friend('classmate', 95);
  const pal = friend('friend', 70);
  check(acts(date).includes('with:prom') && acts(pal).includes('with:prom'), 'at 17, in high school: ask a classmate, or go with a friend');
  check(!acts(date).includes('with:prom') || T.bondActions(pal).find((a) => a.id === 'with:prom').label === 'Go to prom together, as friends', 'with a friend, you go as friends');
  let went = false;
  for (let i = 0; i < 5 && !went; i++) { delete date.flags.acts; T.doBond(date.id, 'with:prom', 'mall'); went = !!Y.prom()?.dateId; S().year += i ? 0 : 0; }
  if (!went) T.doBond(pal.id, 'with:prom', 'borrowed');
  check(Y.prom()?.dateId && Y.prom().outfit, 'a date (or friends) and an outfit');
  check(!acts(friend('friend', 90)).includes('with:prom'), 'once you are going, no more asking');
  check(S().pendingEvents.some((e) => e.id === 'teenage_prom_night'), 'prom night is a scene');
  const note = answer('teenage_prom_night', 1);
  check(Y.prom().went && Y.prom().after === 'diner' && P().milestones.some((m) => /prom/.test(m.text)), `prom night: the diner after (${note})`);
  teen(15);
  check(!acts(friend('classmate', 95)).includes('with:prom'), 'not at 15');
}

// Peer pressure: offered by a real friend, once a year at most; saying no is remembered; being caught costs curfew.
{
  teen(15);
  const pal = friend('friend', 70);
  let offered = null;
  for (let i = 0; i < 12 && !offered; i++) { S().year += 1; S().pendingEvents = []; Y.tickTeenYears(); offered = S().pendingEvents.find((e) => e.id.startsWith('teenage_pressure_')); }
  check(offered && offered.cast.them === pal.id, 'a friend offers something');
  answer(offered.id, 1);
  check(P().flags.pressure?.no === 1, 'saying no is remembered');
  const before = houseRules()?.curfew;
  let caught = false;
  for (let i = 0; i < 30 && !caught; i++) { S().year += 1; Y.teenYearsChoice('pressure_drink:yes', { them: pal.id }); caught = houseRules()?.curfew < before; }
  check(caught, `going along with it can get you caught: an earlier curfew (${before} -> ${houseRules()?.curfew})`);
  teen(12);
  friend();
  let any = false;
  for (let i = 0; i < 10; i++) { S().year += 1; Y.tickTeenYears(); any ||= S().pendingEvents.some((e) => e.id.startsWith('teenage_pressure_')); }
  check(!any, 'not before 14');
}

// Through real years: the yearly step runs without trouble.
{
  teen(14); friend();
  for (let i = 0; i < 4; i++) { S().pendingEvents = []; advanceYear(); }
  check(P().alive, 'four teenage years go by');
}

deathRoll.spared = false;
if (problems.length) { console.log(`PROBLEMS:\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log(`${passed} checks: a best friend, prom, and peer pressure answered.`);
