// A pregnancy that goes on has its months: three in (morning sickness), six in (the last stretch) and a baby shower.
// Whether it is a boy or a girl, and how many, waits for the birth. Run with: node tests/pregnancy-stages.mjs
const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { conceive } = await import('../js/engine/children.js');
const { decide } = await import('../js/engine/pregnancyChoice.js');
const { advanceTurn } = await import('../js/engine/turns.js');
const { getEvent, resolveChoice } = await import('../js/engine/eventEngine.js');

const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); };
function couple(gender, step = 12) {
  let s; do { s = createLife({ countryId: 'us', gender }); } while (s.player.royal || s.player.gender !== gender);
  store.state = s; const p = s.player;
  p.age = 29; p.birthYear = s.year - 29; p.flags.bornAs = gender; p.finance.cash = 50000;
  s.settings = { ...(s.settings ?? {}), step };
  const n = makeNpc({ role: 'spouse', countryId: 'us', age: 30, gender: gender === 'female' ? 'male' : 'female', relationship: 70 });
  n.flags.bornAs = n.gender; s.npcs[n.id] = n; p.npcIds.push(n.id);
  s.pendingEvents = [];
  return { p, n };
}
const queued = () => store.state.pendingEvents.map((e) => e.id);

// Yearly turns: once kept, all three come, in order.
let { p, n } = couple('female');
conceive(n, true);
check(queued()[0] === 'pregnancy_choice', 'the pregnancy is announced and asked first');
store.state.pendingEvents = [];
decide('keep', { them: n.id });
check(JSON.stringify(queued()) === JSON.stringify(['expecting_3', 'expecting_6', 'expecting_shower']), `three months, six months, the shower (${queued()})`);
for (const id of ['expecting_3', 'expecting_6', 'expecting_shower']) {
  const ev = getEvent(id);
  check(!!ev, `${id} exists`);
  check(!/\b(boy|girl|twins)\b/i.test(ev.text.replace('if it is a boy or a girl', '')), `${id} does not give away the sex or how many`);
}
// The choices do what they say.
const stress0 = p.career?.stress ?? 30;
resolveChoice(getEvent('expecting_3'), 2, store.state.pendingEvents[0].cast); // push through
check((p.career?.stress ?? 30) > stress0, 'pushing through morning sickness adds stress');
const cash0 = p.finance.cash;
resolveChoice(getEvent('expecting_shower'), 0, store.state.pendingEvents[2].cast);
check(p.finance.cash > cash0, 'a big shower brings gifts worth more than it costs');

// Ending it takes the waiting scenes away.
({ p, n } = couple('female'));
conceive(n, true); store.state.pendingEvents = [];
decide('keep', { them: n.id });
decide('end', { them: n.id });
check(!queued().some((id) => id.startsWith('expecting_')), 'an ended pregnancy leaves no scenes waiting');

// The partner's version, for a player who is not the one pregnant.
({ p, n } = couple('male'));
n.flags.heart = { commitment: 95 }; n.meters.relationship = 95;
conceive(n, true); store.state.pendingEvents = [];
for (let i = 0; i < 20 && !queued().length && p.flags.pregnancy; i++) decide('wantkeep', { them: n.id });
if (p.flags.pregnancy?.decided === 'keep') check(queued()[0] === 'expecting_3_partner', `a partner's pregnancy asks how you will be there (${queued()})`);

// Shorter turns: each comes when its month does.
({ p, n } = couple('female', 3));
conceive(n, true); store.state.pendingEvents = [];
decide('keep', { them: n.id });
check(!queued().length, 'on three-month turns nothing is told at once');
store.state.month = 0;
advanceTurn();
check(queued().includes('expecting_3') && !queued().includes('expecting_6'), `three months on: the first (${queued()})`);
store.state.pendingEvents = [];
advanceTurn();
check(queued().includes('expecting_6') && queued().includes('expecting_shower'), `six months on: the second and the shower (${queued()})`);

if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('A pregnancy has its months, and keeps its surprises for the birth.');
