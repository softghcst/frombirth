// Teenage life, end to end, on the systems that already carry it (engine/schooling.js, schoollife.js, moments.js,
// together.js) and the new pieces (homecoming, a date who can say no, a teenager's school dance kept to teenagers,
// house rules with a curfew). The vertical slice: a fifteen-year-old at school; persistent classmates; a friendship;
// homecoming, with someone asked who may decline; a memory with the people who were there; the curfew; graduating,
// with the friend still a person in the player's life; save and reload with nobody duplicated.
// Run with: node tests/teen-life.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] ?? null };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { saveGame, loadGame } = await import('../js/save.js');
const M = await import('../js/engine/moments.js');
const T = await import('../js/engine/together.js');
const R = await import('../js/engine/houseRules.js');
const job = await import('../js/engine/partTime.js');

rng.seed(97531);
const problems = [];
let passed = 0;
const check = (c, m) => { if (c) passed++; else { problems.push(m); console.log(` ✗ ${m}`); } };
const people = () => store.state.player.npcIds.map((id) => store.state.npcs[id]).filter(Boolean);
const year = () => { const p = store.state.player; p.stats.health = 95; store.state.pendingEvents = []; advanceYear(); p.alive = true; p.legal.incarceration = null; p.legal.pending = null; delete p.flags.care; };

function teen(age = 15, countryId = 'us', year0 = null) {
  let s; do { s = createLife({ countryId, ...(year0 ? { year: year0 - age } : {}) }); } while (s.player.royal);
  store.state = s;
  for (let i = 0; i < age; i++) year();
  const p = s.player;
  p.flags.livesWithParents = true;
  for (const n of people()) if (n.role === 'parent') { n.alive = true; delete n.flags.livesApart; }
  return p;
}

const p = teen(15);
check(p.education.enrolled && ['high', 'secondary', 'middle'].includes(p.education.stage), `at fifteen, at school (${p.education.stage})`);
const mates = people().filter((n) => n.role === 'classmate');
check(mates.length >= 3, `classmates who are people (${mates.length})`);
const ids0 = new Set(mates.map((n) => n.id));
year();
check(people().filter((n) => n.role === 'classmate' && ids0.has(n.id)).length >= Math.min(3, ids0.size), 'the same classmates a year on: nobody is made again');

// A friendship.
const friend = people().filter((n) => n.role === 'classmate').sort((a, b) => b.meters.relationship - a.meters.relationship)[0];
for (let i = 0; i < 3; i++) { friend.meters.relationship = Math.min(100, friend.meters.relationship + 15); T.doBond(friend.id, 'hangOut'); }
friend.meters.relationship = Math.max(friend.meters.relationship, 80);
friend.flags.title = 'Best friend';

// Homecoming: American, from fourteen, at high school. An adult cannot be brought; the friend may say yes or no.
const items = M.thisYear();
const hc = items.find((x) => x.key === 'homecoming');
check(!!hc && hc.ok !== false, 'homecoming is on this year\'s list');
const adult = makeNpc({ role: 'friend', countryId: 'us', age: 26, relationship: 90 }); store.state.npcs[adult.id] = adult; p.npcIds.push(adult.id);
p.finance.cash = 1000;
const r = M.celebrate({ key: 'homecoming', guests: [friend.id, adult.id] });
check(r.ok, `going to homecoming (${r.text})`);
check(!r.guests.includes(adult.id), 'a teenager does not bring an adult to a school dance');
const entry = store.state.moments.log.at(-1);
check(entry.key === 'homecoming' && (entry.guests.includes(friend.id) || entry.declined?.includes(friend.id)), 'the friend either came or said no, and it is written down');
check(entry.guests.every((id) => store.state.npcs[id]), 'everyone who came is a real person');
if (entry.guests.includes(friend.id)) check(Object.keys(friend.memories ?? {}).length > 0 || JSON.stringify(friend).includes('Homecoming'), 'the friend remembers it');
check(!M.celebrate({ key: 'homecoming', guests: [friend.id] }).ok, 'homecoming once a year');

// Not everywhere, not always.
{ teen(15, 'uk'); check(!M.thisYear().some((x) => x.key === 'homecoming'), 'no homecoming in Britain'); }
{ teen(15, 'us', 1922); check(!M.thisYear().some((x) => x.key === 'homecoming'), 'none before the custom'); }
store.state = (await (async () => store.state)());

// The curfew: set by the parent, kept, changed by asking.
{
  const q = teen(14);
  const rules = R.houseRules(q);
  check(rules && rules.curfew >= R.EARLIEST && rules.curfew <= R.LATEST && rules.setBy, `house rules at fourteen: home by ${R.hourText(rules.curfew)}, set by a parent`);
  const parent = people().find((n) => n.id === rules.setBy);
  parent.meters.trust = 100;
  const before = rules.curfew;
  let asked = T.doBond(parent.id, 'curfew');
  for (let i = 0; i < 5 && rules.curfew === before; i++) { parent.flags.acts = {}; asked = T.doBond(parent.id, 'curfew'); } // even a trusting parent sometimes says no
  check(asked.ok && (rules.curfew === before + 1 || before >= 24), `asking, with trust, gets a later curfew (${asked.text})`);
  year();
  check(R.houseRules(q).curfew === rules.curfew && R.houseRules(q).history.length >= 2, 'and it is kept, with its history');
}

// A group of friends at school: formed from real friends, kept as a record, changing as people do.
{
  const G = await import('../js/engine/friendGroups.js');
  const q = teen(14);
  const close = people().filter((n) => n.role === 'classmate').slice(0, 4);
  for (const n of close) { n.meters.relationship = 80; delete n.flags.circle; }
  let g = null;
  for (let i = 0; i < 6 && !G.activeGroups(q).some((x) => x.from === 'school'); i++) { for (const n of close) { n.meters.relationship = 80; n.lastInteractionAge = q.age; } year(); }
  g = G.activeGroups(q).find((x) => x.from === 'school');
  check(!!g && g.members.length >= 3 && g.members.every((id) => store.state.npcs[id]), 'a group of real friends forms at school');
  check(g && g.name && g.formed && g.history.length >= 1, `with a name, a year and a history (${g?.name})`);
  const one = store.state.npcs[g.members[0]];
  const act = T.doBond(one.id, 'groupHangout');
  check(act.ok && g.history.some((h) => /whole group/.test(h.text)), 'the whole group can get together');
  // Someone moves abroad: they leave the group, still a friend.
  const mover = store.state.npcs[g.members.at(-1)]; mover.flags.abroad = true;
  year();
  check(!g.members.includes(mover.id) && g.history.some((h) => /moved abroad/.test(h.text)) && q.npcIds.includes(mover.id), 'someone who moves abroad leaves the group, but not the player\'s life');
}

// A part-time job interview: one question, three answers; a good one helps.
{
  const P = await import('../js/engine/partTime.js');
  teen(16, 'us');
  const iv = P.interviewFor('cafe');
  check(iv.question && iv.answers.length === 3 && new Set(iv.answers.map((a) => a.id)).size === 3, 'the café asks one question, with three answers');
  const best = '0'; const worst = '2';
  let good = 0; let bad = 0;
  for (let i = 0; i < 30; i++) {
    const q = teen(16, 'us'); q.stats.charm = 50; q.hidden.discipline = 50;
    if (P.takeJob('cafe', best).ok) good++;
    const q2 = teen(16, 'us'); q2.stats.charm = 50; q2.hidden.discipline = 50;
    if (P.takeJob('cafe', worst).ok) bad++;
  }
  check(good > bad, `a good answer gets hired more often than a poor one (${good} vs ${bad} of 30)`);
}

// Teen work follows the law of the place.
{
  teen(13, 'de');
  check(!job.canWorkPartTime(), 'no part-time job at 13 in Germany (work age 15)');
  teen(15, 'us');
  check(job.canWorkPartTime(), 'at 15 in the United States, yes');
}

// Graduating: the friend goes on as a friend.
store.state = store.state;
{
  const q = teen(17);
  const f2 = people().filter((n) => n.role === 'classmate').sort((a, b) => b.meters.relationship - a.meters.relationship)[0];
  f2.meters.relationship = 85;
  for (let i = 0; i < 2 && q.education.enrolled && q.education.stage === 'high'; i++) year();
  check(!(q.education.enrolled && q.education.stage === 'high'), 'school is finished');
  const after = store.state.npcs[f2.id];
  check(after?.alive && q.npcIds.includes(f2.id) && after.role === 'friend', `the school friend is still a friend, the same person (${after?.role})`);
  saveGame(store.state);
  const back = loadGame(store.state.slotId);
  check(back.player.npcIds.filter((id) => id === f2.id).length === 1 && back.npcs[f2.id]?.role === 'friend', 'after reload: one of them, still a friend');
}

if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log(`${passed} checks passed. Teenage life: the same classmates, a friend who can say no, rules that last, and friendships that outlive school.`);
