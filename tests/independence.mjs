// Moving out and back (engine/independence.js), on the neighborhood's real homes and households. The vertical slice:
// a young adult at home looks at places to rent, signs a lease with a friend as a roommate, pays the deposit once,
// lives there through a year (rent charged by the year, the same in 3-, 6- and 12-month turns), moves back home
// (the deposit returned once), and everything survives a save and reload. The age to sign follows the country's law.
// Run with: node tests/independence.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] ?? null };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { advanceTurn } = await import('../js/engine/turns.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { saveGame, loadGame } = await import('../js/save.js');
const N = await import('../js/engine/neighborhood.js');
const I = await import('../js/engine/independence.js');
const chron = await import('../js/engine/chronicle.js');

rng.seed(5150);
const problems = [];
let passed = 0;
const check = (c, m) => { if (c) passed++; else { problems.push(m); console.log(` ✗ ${m}`); } };
const year = () => { store.state.pendingEvents = []; advanceYear(); };
const people = () => store.state.player.npcIds.map((id) => store.state.npcs[id]).filter(Boolean);
const household = () => { const H = N.hoods(); return H.cur ? H.hhs[H.cur.hh].m : []; };
const deposits = (p) => (p.finance.receipts ?? []).filter((t) => t.kind === 'deposit');
const refunds = (p) => (p.finance.receipts ?? []).filter((t) => t.kind === 'refund' && /Deposit/.test(t.memo));

/** A young adult living with both parents, out of school, with some savings. */
function youngAdult(age = 19, countryId = 'us', year0 = null) {
  let s;
  do { s = createLife({ countryId, ...(year0 ? { year: year0 - age } : {}) }); } while (s.player.royal || s.player.flags.parentsStatus !== 'together');
  store.state = s;
  for (let i = 0; i < age; i++) { s.player.stats.health = 95; year(); s.player.alive = true; s.player.legal.incarceration = null; s.player.legal.pending = null; }
  const p = s.player;
  p.flags.livesWithParents = true; delete p.flags.care;
  p.education.enrolled = false; p.education.housing = 'home';
  p.finance.cash = 40000;
  for (const n of people()) if (n.role === 'parent') { n.alive = true; n.meters.relationship = 95; delete n.flags.livesApart; }
  p.flags.parentsStatus = 'together';
  N.syncHousehold();
  return p;
}

// ---------- Who can sign a lease ----------
{
  const p = youngAdult(17);
  check(/18/.test(I.moveOutBlock(p)), `a seventeen-year-old in the US cannot sign a lease (${I.moveOutBlock(p)})`);
  const k = youngAdult(18, 'kr');
  check(I.leaseAge('kr') === 19 && /19/.test(I.moveOutBlock(k)), 'in South Korea, adulthood begins at 19');
  const j = youngAdult(19, 'jp', 1995); j.countryId = 'jp'; // (a family may have emigrated on the way to nineteen)
  check(I.leaseAge('jp') === 20 && !!I.moveOutBlock(j), 'in Japan before 2022, at 20');
}

// ---------- The slice ----------
const p = youngAdult(19);
const parents = people().filter((n) => n.role === 'parent');
const friend = makeNpc({ role: 'friend', countryId: 'us', age: 20, relationship: 72 });
store.state.npcs[friend.id] = friend; p.npcIds.push(friend.id);
check(!I.moveOutBlock(p), 'a nineteen-year-old at home can move out');
const opts = I.rentalOptions();
check(opts.length >= 2 && opts.every((o) => o.deposit > 0 && o.rentYear > o.rentShared), 'there are places to rent, with a deposit, and sharing costs less');
check(I.roommateCandidates().some((n) => n.id === friend.id), 'the friend could share');

const cash0 = p.finance.cash;
const r = I.moveOut(opts[0].profileId, friend.id);
check(r.ok, `moving out works (${r.text})`);
const lease = I.currentLease(p);
check(!!lease && lease.deposit === opts[0].deposit && lease.roommateId === friend.id, 'a lease, with its deposit and the roommate on it');
check(p.finance.cash === cash0 - lease.deposit && deposits(p).length === 1, 'the deposit is paid once, now');
check(!p.flags.livesWithParents && N.dwelling().kind === 'rent', 'the player rents now');
const H = N.hoods();
check(N.homeOf(lease.homeId)?.hh === H.cur.hh, 'the lease is on the home the player lives in');
check(household().includes(friend.id) && !parents.some((n) => household().includes(n.id)), 'the household: the player and the friend, not the parents');
check(store.state.npcs[friend.id] === friend && friend.role === 'friend', 'the roommate is the same friend, not a new person');
check(parents.every((n) => n.alive && n.role === 'parent' && n.meters.relationship >= 90), 'the parents are still the parents, and still close');
const famHh = H.hhs[H.family];
check(!!famHh && parents.every((n) => famHh.m.includes(n.id)) && !famHh.m.includes(`@${p.id}`), 'the family household stays where it was, without the player');
check(chron.events((e) => e.type === 'first_home').length === 1, 'a first home is a canonical event');
check(store.state.pendingEvents.some((e) => e.id === 'home_first_night_shared'), 'the first night is a scene, with the roommate in it');
check(!I.moveOut(opts[0].profileId).ok, 'and nobody signs two leases at once');

// A year in the flat: rent by the year; the same in quarters.
const snapshot = JSON.stringify(store.state);
year();
const afterYear = { cash: p.finance.cash, deposits: deposits(p).length };
check(afterYear.deposits === 1, 'a year on, still one deposit');
check(I.currentLease(p)?.id === lease.id, 'still the same lease');
const q = JSON.parse(snapshot);
store.state = q; q.settings = { ...(q.settings ?? {}), step: 3 }; q.month = 0;
for (let i = 0; i < 4; i++) { q.pendingEvents = []; advanceTurn(); }
check(q.player.finance.cash === afterYear.cash, `four quarters cost what one year did (${q.player.finance.cash} vs ${afterYear.cash})`);
check(deposits(q.player).length === 1 && I.currentLease(q.player)?.id === lease.id, 'and the lease and deposit are the same');

// Moving back home: the family agrees (they are close); the lease ends; the deposit comes back once.
// (The family home has to have room: a family that has filled a small flat is given a house here, so the slice can go on.)
{ const room = I.familyHomeRoom(); if (room && room.living + 1 > room.sleeps) { const Hm = N.hoods(); Hm.homes[Hm.hhs[Hm.family].home].t = 'house'; } }
let back = { ok: false };
for (let i = 0; i < 6 && !back.ok; i++) { for (const n of parents) n.meters.relationship = 95; back = I.moveBackHome(); }
check(back.ok, `moving back home works when the family agrees (${back.text})`);
check(q.player.flags.livesWithParents && N.dwelling().kind === 'family', 'the player lives with family again');
check(household().every((id) => !id.startsWith('npc') || store.state.npcs[id]) && parents.every((n) => household().includes(q.npcs[n.id] ? n.id : n.id)), 'back in the family household, with the parents');
const L = q.player.leases.find((x) => x.id === lease.id);
check(L.end === q.year && L.endWhy === 'moved back home', 'the lease ended, and why');
check(refunds(q.player).length === 1 && refunds(q.player)[0].amount === lease.deposit, 'the deposit came back, once');
year();
check(refunds(q.player).length === 1, 'and not again a year later');
check(q.npcs[friend.id]?.alive && q.player.npcIds.includes(friend.id), 'the friend is still in the player\'s life');
const me = q.player.archiveId ?? q.player.id;
check(N.placesWeCalledHome().filter((x) => x.who === me).length >= 3, 'the homes lived in are all on the record: family, flat, family');

// Save and reload.
saveGame(q);
const re = loadGame(q.slotId);
store.state = re;
check(re.player.leases.length === q.player.leases.length && re.player.leases[0].deposit === lease.deposit, 'after reload: the leases');
check(deposits(re.player).length === 1 && refunds(re.player).length === 1, 'and the deposit, paid once and returned once');
check(re.player.flags.livesWithParents, 'and where the player lives');

// A full house: no room, however welcome.
{
  const k = youngAdult(22);
  const friend2 = makeNpc({ role: 'friend', countryId: 'us', age: 22, relationship: 70 }); store.state.npcs[friend2.id] = friend2; k.npcIds.push(friend2.id);
  I.moveOut(I.rentalOptions()[0].profileId, null);
  const room = I.familyHomeRoom();
  check(room && room.sleeps >= 4 && room.living >= 1, `the family home sleeps ${room?.sleeps}, and ${room?.living} live there`);
  const Hh = N.hoods(); const fam = Hh.hhs[Hh.family];
  const extra = [];
  while (I.familyHomeRoom().living < I.familyHomeRoom().sleeps) { const n = makeNpc({ role: 'sibling', countryId: 'us', age: 10 }); store.state.npcs[n.id] = n; k.npcIds.push(n.id); fam.m.push(n.id); extra.push(n); }
  check(/no room/.test(I.moveBackBlock(k)), `a full family home has no room (${I.moveBackBlock(k)})`);
  fam.m = fam.m.filter((id) => !extra.some((n) => n.id === id));
  check(!/no room/.test(I.moveBackBlock(k)), 'with room again, the way home is open');
}

// Under the age of majority, or in care, the way out is closed; a home owner does not "move back" through this.
{
  const k = youngAdult(19);
  k.flags.care = { kind: 'foster' };
  check(/carer/.test(I.moveOutBlock(k)), 'a young person in care leaves care first');
}

if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log(`${passed} checks passed. Moving out and back: a real home, one deposit, a roommate who is a real friend, and the family still the family.`);
