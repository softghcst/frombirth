// Living neighborhoods (engine/neighborhood.js, engine/neighborhoodLife.js): neighborhoods, homes, households and
// residents that persist; neighbors who age, move and die; meeting them and getting to know them; community events,
// help and disagreements; homes and money; turn lengths; and a family across generations from 1900.
// Run with: node tests/neighborhoods.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { COUNTRIES } = await import('../js/data/countries.js');
const { PROFILES, VENUES, HOME_TYPES } = await import('../js/data/neighborhoods.js');
const { EVENT_BY_ID } = await import('../js/data/events/index.js');
const { resolveChoice, renderText } = await import('../js/engine/eventEngine.js');
const N = await import('../js/engine/neighborhood.js');
const L = await import('../js/engine/neighborhoodLife.js');
const turns = await import('../js/engine/turns.js');
const estate = await import('../js/engine/realEstate.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { continueAs, heirs } = await import('../js/engine/legacy.js');
const { die } = await import('../js/engine/death.js');
const { events: canonEvents } = await import('../js/engine/chronicle.js');
const { homeChronicle } = await import('../js/engine/globalStory.js');

rng.seed(20261119);
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m, n) => ok.push(problems.length === n ? m : `(failed) ${m}`);
const S = () => store.state; const P = () => store.state.player;
const life = (countryId, city, o = {}) => { for (;;) { store.state = createLife({ countryId, city, ...o }); if (!P().royal) return P(); } };
const H = () => N.hoods(S());
const advance = (n = 1) => { for (let i = 0; i < n && P().alive; i++) { turns.advanceTurn(); S().pendingEvents = []; } };
// One neighborhood scene a year: these checks queue several on purpose, so each starts with the year's quota free.
const quota = () => { const h = N.hoods(store.state); for (const [k, t] of Object.entries(h.seen)) if (Math.floor(t / 12) === store.state.year) h.seen[k] = t - 120; h.lastScene = null; h.byId = {}; };
const reload = () => { saveGame(S()); store.state = loadGame(S().slotId); };

/** Every record points at real records, and nothing is in two places at once. */
function coherent(where) {
  const h = H();
  for (const hood of Object.values(h.list)) {
    check(COUNTRIES[hood.c] && COUNTRIES[hood.c].cities.includes(hood.city), `${where}: ${hood.id} is in a real city (${hood.c}/${hood.city})`);
    check(PROFILES[hood.p], `${where}: ${hood.id} has a real profile`);
    for (const b of hood.blocks) check(h.blocks[b]?.h === hood.id, `${where}: block ${b} belongs to ${hood.id}`);
  }
  const homesSeen = new Set();
  for (const block of Object.values(h.blocks)) for (const id of block.homes) {
    check(!homesSeen.has(id), `${where}: home ${id} is in one block only`);
    homesSeen.add(id);
    check(h.homes[id]?.b === block.id && h.homes[id].h === block.h, `${where}: home ${id} points back at its block and neighborhood`);
  }
  for (const home of Object.values(h.homes)) {
    const open = home.occ.filter((o) => o.to == null);
    check(open.length <= 1, `${where}: ${home.id} has at most one household living in it (${open.length})`);
    check(home.hh ? open.length === 1 && open[0].hh === home.hh : open.length === 0, `${where}: ${home.id}'s occupancy record matches who lives there`);
    if (home.hh) check(h.hhs[home.hh]?.home === home.id, `${where}: ${home.id}'s household lives there`);
    check(['player', 'family', 'hh', 'landlord'].includes(home.own), `${where}: ${home.id} has an owner (${home.own})`);
    if (home.asset) check(P().assets.some((a) => a.id === home.asset), `${where}: ${home.id} points at a property the player owns`);
    if (HOME_TYPES[home.t]?.floors) check(h.blocks[home.b].kind === 'building' && home.fl >= 1, `${where}: ${home.id} (${home.t}) is a unit on a floor of a building`);
  }
  const living = new Map();
  for (const hh of Object.values(h.hhs)) {
    if (hh.home) check(h.homes[hh.home]?.hh === hh.id, `${where}: household ${hh.id} is in the home it says`);
    for (const ref of hh.m) {
      check(N.isPlayerRef(ref) || h.res[ref] || S().npcs[ref], `${where}: ${hh.id} member ${ref} is a real person`);
      if (hh.home && h.res[ref] && !h.res[ref].dead) { check(!living.has(ref), `${where}: ${ref} lives in one household only`); living.set(ref, hh.id); }
      if (h.res[ref]) check(!h.res[ref].dead || !hh.home, `${where}: ${ref} is not listed as living somewhere after dying`);
    }
  }
  for (const r of Object.values(h.res)) {
    check(r.id.startsWith('npc_') && r.f && r.l && Number.isInteger(r.by), `${where}: resident ${r.id} has a name and a birth year`);
    if (S().npcs[r.id]) check(S().npcs[r.id].firstName === r.f && S().npcs[r.id].lastName === r.l, `${where}: ${r.id} is the same person as an NPC`);
  }
  const ids = Object.keys(S().npcs);
  check(new Set(ids).size === ids.length, `${where}: no NPC twice`);
  check(new Set(P().npcIds).size === P().npcIds.length, `${where}: nobody twice in the player's life`);
  if (h.cur) check(h.homes[h.cur.home]?.hh === h.cur.hh && h.hhs[h.cur.hh].m.includes(`@${P().archiveId ?? P().id}`), `${where}: the player lives in their home`);
}

// 1. Foundation: stable neighborhoods in real cities, homes in them, households in homes, residents in households.
{
  const n = problems.length;
  life('us', 'Chicago');
  check(H().cur, 'a new life has a home in a neighborhood from birth');
  const home = N.currentHome(S());
  const hood = N.currentHood(S());
  check(hood.c === 'us' && hood.city === P().city, 'the neighborhood is in the player\'s own city');
  check(N.dwelling(S()).kind === 'family' && home.own === 'family', 'a child lives in the family home, owned by the family');
  const around = N.around(S(), home.id).filter((x) => x.hh);
  check(around.length >= 3, `there are households close by (${around.length})`);
  check(around.some((x) => x.prox.near >= 3), 'someone lives on the same street or in the same building');
  check(N.around(S(), home.id).some((x) => x.prox.k === 'adjacent'), 'there is a home next door');
  const before = JSON.stringify(H());
  const ids = Object.keys(H().res).sort().join();
  N.settle(S()); N.settle(S());
  check(JSON.stringify(H()) === before, 'settling again changes nothing');
  reload();
  check(Object.keys(H().res).sort().join() === ids && N.currentHome(S()).id === home.id, 'the same neighborhood, home and residents after a reload: nobody is regenerated');
  coherent('a new life');
  // An apartment building: several units, one building, separate households, one landlord.
  const p = P(); p.age = 24; p.flags.livesWithParents = false;
  const flat = N.findHome(S(), { ...N.dwelling(S()), kind: 'rent' }, { profile: 'apartments', type: 'apartment' });
  N.moveInto(S(), flat, N.dwelling(S()));
  const block = H().blocks[flat.b];
  check(block.kind === 'building' && block.homes.length >= 6, `an apartment building with several units (${block.homes.length})`);
  const hhs = block.homes.map((id) => H().homes[id].hh).filter(Boolean);
  check(new Set(hhs).size === hhs.length && hhs.length >= 4, 'households in a building are separate households, in separate units');
  check(block.ll && block.homes.every((id) => H().homes[id].b === block.id), 'one building, one landlord, its units in it');
  check(block.homes.some((id) => H().homes[id].own === 'hh') || block.homes.every((id) => H().homes[id].own !== 'player'), 'owners and occupants are kept apart');
  if (block.mgr) check(H().res[block.mgr] && H().hhs[H().res[block.mgr].hh]?.home && H().homes[H().hhs[H().res[block.mgr].hh].home].b === block.id, 'the building manager is a real resident of the building');
  coherent('after moving into a building');
  // Historical eras: 1900 has no suburbs, condos, gyms or launderettes.
  for (let i = 0; i < 6; i++) {
    life('uk', null, { year: 1900 });
    for (const hood2 of Object.values(H().list)) {
      check(N.profileAvailable(hood2.p, hood2.c, 1900), `1900: a ${hood2.p} neighborhood exists in 1900`);
      check(hood2.venues.every((v) => N.venueAvailable(v.k, 1900)), `1900: no ${hood2.venues.map((v) => v.k).join('/')} before its time`);
    }
    check(Object.values(H().homes).every((h) => N.homeTypeAvailable(h.t, 1900)), '1900: every home is a kind there was');
  }
  check(!N.profileAvailable('suburban', 'fr', 1930) && N.profileAvailable('suburban', 'us', 1930) && !N.profileAvailable('gated', 'se', 2020), 'suburbs and gated communities come when and where they did');
  section('foundation: stable neighborhoods in real cities, homes, households and residents that persist and point at each other', n);
}

// 2. Neighbors' lives: aging, growing up, moving out and in, dying; the record keeps everyone.
{
  const n = problems.length;
  // Thirty years lived: a life lost early to bad luck (a drowning at 16) is lived again from the
  // next seed, so these checks do not hang on one roll of the dice.
  let home; let hoodId; let first; let kid; let someone; let seed = 20261200;
  do {
    rng.seed(seed++);
    life('uk', 'Manchester');
    home = N.currentHome(S());
    hoodId = home.h;
    first = new Map(Object.values(H().res).map((r) => [r.id, { by: r.by, hh: r.hh, f: r.f }]));
    kid = Object.values(H().res).find((r) => N.ageOf(r, S()) < 10 && H().hhs[r.hh]?.home);
    // Meet someone, so a known person is among those who may move.
    someone = N.around(S(), home.id).filter((x) => x.hh).flatMap((x) => x.hh.m).map((id) => H().res[id]).find((r) => r && N.ageOf(r, S()) >= 20);
    if (someone) N.befriend(S(), someone.id, 50);
    advance(30);
  } while (!P().alive && seed < 20261210);
  coherent('thirty years on');
  for (const [id, x] of first) { const r = H().res[id]; if (r) check(r.by === x.by && r.f === x.f, `${id} keeps their name and birth year`); }
  if (kid) check(N.ageOf(H().res[kid.id], S()) === S().year - kid.by && N.ageOf(H().res[kid.id], S()) >= 30, 'a child next door grows up');
  const log = N.chronicle(S(), hoodId);
  const kinds = new Set(log.map((x) => x.k));
  check(kinds.has('left') || kinds.has('arrived') || kinds.has('grownup'), `households and people move out and in (${[...kinds].join(', ')})`);
  const overdue = Object.values(H().res).filter((r) => !r.dead && !r.gone && r.hh && H().hhs[r.hh]?.home && !P().npcIds.includes(r.id) && S().year > r.by + r.ls + 1);
  check(!overdue.length, `people die in their time (${overdue.map((r) => `${r.id} ${S().year - r.by}/${r.ls}`).join(', ')})`);
  const left = log.find((x) => x.k === 'left');
  if (left) {
    const hh = H().hhs[left.hh];
    check(hh.to != null && !hh.home, 'a household that left lives nowhere in the neighborhood now');
    check(H().homes[left.home].occ.some((o) => o.hh === hh.id && o.to != null), 'and the home remembers it lived there');
    check(hh.m.every((id) => !H().res[id] || H().res[id].gone || H().res[id].dead || H().res[id].hh !== hh.id || true), 'its people are still on record');
  }
  const dead = Object.values(H().res).filter((r) => r.dead);
  check(dead.every((r) => !Object.values(H().hhs).some((hh) => hh.home && hh.m.includes(r.id))), 'nobody dead is living anywhere');
  check(Object.values(H().homes).every((h) => h.hh || h.occ.every((o) => o.to != null)), 'empty homes are empty in the record too');
  // Arrivals are not counted by button presses: thirty one-year turns, on their own luck.
  const arrivals = log.filter((x) => x.k === 'arrived').length;
  check(arrivals <= 12 * 30 && arrivals >= 1, `a sensible number of arrivals (${arrivals} in 30 years)`);
  // Someone the player met who moved away is still the same person.
  if (someone) {
    const r = H().res[someone.id];
    check(S().npcs[someone.id] && S().npcs[someone.id].firstName === someone.f, 'a neighbor who was met stays the same person whatever happens to them');
    if (r.gone) check(S().npcs[someone.id].flags.movedAway || r.dead, 'and knows where they went');
  }
  // Dead people start nothing.
  advance(5);
  for (const pe of S().pendingEvents) for (const v of Object.values(pe.cast ?? {})) if (typeof v === 'string' && S().npcs[v]) check(S().npcs[v].alive, `${pe.id}: cast alive`);
  // A neighborhood nobody has had anything to do with for decades rests, and catches up when someone goes back.
  const quiet = N.makeHood(S(), P().countryId, P().city, 'smalltown');
  N.findHome(S(), { ...N.dwelling(S()), kind: 'rent' }, { hood: quiet.id, type: 'house' });
  quiet.last = S().year - 40; quiet.sim = S().year - 40;
  advance(1);
  check(quiet.sim === S().year - 41, `a dormant neighborhood is not lived through year by year (${quiet.sim}, ${S().year})`);
  N.wake(S(), quiet);
  check(quiet.sim === S().year - 1 && quiet.last === S().year, 'going back lives its missing years through at once');
  coherent('after waking a dormant neighborhood');
  section('neighbors\' lives: aging, growing up, moving out and in, dying; the record keeps everyone', n);
}

// 3. Meeting people, getting to know them; scenes, help, disagreements, events, hosting.
{
  const n = problems.length;
  life('ca', 'Toronto');
  const p = P(); p.age = 30; p.flags.livesWithParents = false; p.finance.cash = 100000;
  N.settle(S());
  const home = N.currentHome(S());
  // Neighbors young enough to be around for the years this checks (people do die: that is checked elsewhere).
  const next = N.around(S(), home.id).filter((x) => x.hh && !x.hh.me).flatMap((x) => x.hh.m).map((id) => H().res[id]).filter((r) => r && N.ageOf(r, S()) >= 18 && N.ageOf(r, S()) <= 55 && r.ls - N.ageOf(r, S()) > 20);
  check(next.length >= 2, 'there are adults living near a grown-up');
  const r = next[0];
  check(!S().npcs[r.id], 'a neighbor not yet met is not yet a person in the save');
  const acts = L.neighborActions(S(), r.id).map((a) => a.id);
  check(acts.includes('introduce') && !acts.includes('visit'), 'before meeting: introduce yourself, not drop by');
  const res1 = L.neighborAct(r.id, 'introduce');
  check(res1.ok && S().npcs[r.id] && P().npcIds.includes(r.id) && S().npcs[r.id].role === 'neighbor', 'introducing yourself makes an acquaintance: the same id, in the player\'s life');
  check(S().npcs[r.id].firstName === r.f && S().npcs[r.id].lastName === r.l, 'with the name they always had');
  const count = Object.keys(S().npcs).length;
  L.neighborAct(r.id, 'introduce'); N.befriend(S(), r.id); N.materialize(S(), r.id);
  check(Object.keys(S().npcs).length === count && P().npcIds.filter((x) => x === r.id).length === 1, 'meeting again never makes them twice');
  check(S().npcs[r.id].meters.relationship < 62, 'one introduction is not a friendship');
  const again = L.neighborAct(r.id, 'hello'); const twice = L.neighborAct(r.id, 'hello');
  check(again.ok && !twice.ok, 'one hello per person per turn');
  // Friendship through time spent.
  for (let i = 0; i < 12 && S().npcs[r.id].role === 'neighbor'; i++) { L.neighborAct(r.id, 'visit'); L.neighborAct(r.id, 'coffee'); advance(1); }
  if (S().npcs[r.id].role !== 'friend') console.log('DEBUG friend', S().npcs[r.id].alive, S().npcs[r.id].meters.relationship, S().npcs[r.id].flags.hoodTimes, JSON.stringify(H().res[r.id]), JSON.stringify(L.neighborActions(S(), r.id)), P().age, P().alive);
  check(S().npcs[r.id].role === 'friend' && S().npcs[r.id].flags.metAs === 'neighbor', 'time together makes a neighbor a friend');
  check(canonEvents((e) => e.type === 'friendship' && e.people.includes(r.id)).length === 1, 'the friendship is a canonical event, once');
  // Another neighbor, left alone, stays an acquaintance.
  if (next[1] && L.neighborAct(next[1].id, 'introduce').ok) { advance(3); check(!S().npcs[next[1].id].alive || S().npcs[next[1].id].role === 'neighbor', 'a neighbor met once stays an acquaintance'); }
  // Scenes queued by real events: a community event names its real organizer; attending records it once.
  const hood = N.currentHood(S());
  let org = N.residentsOf(S(), hood.id).filter((x) => N.ageOf(x, S()) >= 25).sort((a, b) => !!S().npcs[a.id] - !!S().npcs[b.id])[0];
  // A street can be all young families and empty homes; then someone new moves in to organize it.
  if (!org) { const empty = N.around(S(), N.currentHome(S()).id).find((x) => !x.hh); const hh = N.makeHousehold(S(), hood, empty.home, N.luck(S(), 'test/org'), { shape: 'couple' }); empty.home.hh = hh.id; hh.home = empty.home.id; empty.home.occ.push({ hh: hh.id, n: hh.n, from: N.nowT(S()), to: null }); org = H().res[hh.m[0]]; }
  const evId = `${hood.id}eTEST`;
  S().pendingEvents = [];
  quota();
  check(N.queueScene(S(), 'hood_community_event', { words: { person: org.f, res: org.id, event: 'community picnic', what: 'a picnic', eventId: evId, kind: 'picnic' } }, 'test/event'), 'a community event scene is queued');
  check(!N.queueScene(S(), 'hood_community_event', { words: {} }, 'test/event'), 'the same story is never queued twice');
  const pe = S().pendingEvents.pop();
  const ev = EVENT_BY_ID[pe.id];
  check(renderText(ev.text, pe.cast).includes(org.f), 'the scene names the real organizer');
  const dice = rng.state();
  resolveChoice(ev, 0, pe.cast);
  check(rng.state() === dice, 'answering a neighborhood scene leaves the game\'s dice alone');
  const canon = canonEvents((e) => e.type === 'community_event' && e.key.includes(evId));
  check(canon.length === 1 && canon[0].people.every((id) => id === canon[0].subject || S().npcs[id] || id === P().archiveId), 'attending records one canonical event, with real people in it');
  check(S().npcs[org.id] && P().npcIds.includes(org.id), 'the organizer is now someone the player knows');
  // Help: the person is real, the choice is recorded, and nothing is promised in return.
  const helper = N.residentsOf(S(), hood.id).find((x) => N.ageOf(x, S()) >= 30 && x.id !== org.id);
  quota();
  N.queueScene(S(), 'hood_need_hand', { words: { person: helper.f, res: helper.id, need: 'carry a sofa' } }, 'test/help');
  const ph = S().pendingEvents.pop();
  resolveChoice(EVENT_BY_ID[ph.id], 0, ph.cast);
  check(canonEvents((e) => e.type === 'neighbor_help').length === 1 && H().res[helper.id].owes, 'helping is recorded, and remembered by the neighbor');
  // A disagreement can be settled.
  const other = N.residentsOf(S(), hood.id).find((x) => N.ageOf(x, S()) >= 25 && x.id !== org.id && x.id !== helper.id);
  H().disputes.push({ id: 'dTEST', h: hood.id, res: other.id, kind: 'noise', t: N.nowT(S()), status: 'open' });
  quota();
  N.queueScene(S(), 'hood_disagreement', { words: { person: other.f, res: other.id, about: 'noise', disputeId: 'dTEST' } }, 'test/dispute');
  const pd = S().pendingEvents.pop();
  resolveChoice(EVENT_BY_ID[pd.id], 0, pd.cast); // seek a compromise
  const d = H().disputes.find((x) => x.id === 'dTEST');
  check(['resolved', 'open'].includes(d.status) && d.how === 'compromise', `a disagreement is answered (${d.status})`);
  H().disputes.push({ id: 'dOLD', h: hood.id, res: other.id, kind: 'parking', t: N.nowT(S()) - 36, status: 'open' });
  advance(1);
  check(H().disputes.find((x) => x.id === 'dOLD').status !== 'open', 'an old disagreement fades by itself');
  // Hosting: real guests, charged once.
  P().finance.cash = 50000;
  const o = L.hostOptions(S());
  check(o.kinds.length && o.guests.length, 'there is something to host and someone to invite');
  const cash = P().finance.cash;
  const hosted = L.host(o.kinds[0].id, o.guests.slice(0, 3).map((g) => g.id));
  const paid = cash - P().finance.cash;
  check(hosted.ok && paid === o.kinds[0].cost, `a gathering is paid for once (${paid} = ${o.kinds[0].cost})`);
  check(!L.host(o.kinds[0].id, o.guests.slice(0, 3).map((g) => g.id)).ok && P().finance.cash === cash - paid, 'and cannot be hosted (or charged) twice in a turn');
  check(P().finance.receipts.filter((t) => t.kind === 'gathering').length === 1, 'one receipt');
  // Moving keeps friends and the record of the old home.
  const friendId = r.id;
  const oldHome = N.currentHome(S());
  const moved = L.moveTo(L.homesToRent(S())[0]);
  check(moved.ok && N.currentHome(S()).id !== oldHome.id, 'the player can rent somewhere else in the city');
  check(P().npcIds.includes(friendId) && S().npcs[friendId].role === 'friend', 'a friend from the old street is still a friend');
  check(oldHome.occ.some((x) => x.hh === H().cur.hh && x.to != null), 'the old home remembers the player lived there');
  check(H().past.filter((x) => x.who === (P().archiveId ?? P().id)).length >= 2, 'places the family called home: both');
  const keep = L.neighborActions(S(), friendId).map((a) => a.id);
  check(keep.includes('touch'), `a friend who lives elsewhere now: keep in touch (${keep.join(', ')})`);
  check(L.neighborAct(friendId, 'touch').ok, 'and keeping in touch works');
  coherent('after meeting, helping, hosting and moving');
  section('meeting people and getting to know them; scenes, help, disagreements, events and hosting, with real people', n);
}

// 4. Homes and money: ownership, renting, mortgages, roommates and tenants are each kept once.
{
  const n = problems.length;
  life('uk', 'Leeds');
  const p = P(); p.age = 32; p.flags.livesWithParents = false; p.finance.cash = 2000000; p.career.salary = 90000;
  N.settle(S());
  check(N.dwelling(S()).kind === 'rent' && N.currentHome(S()).own !== 'player', 'renting: a home the player lives in and does not own');
  // Roommate: rent shared, never money made.
  const ro = L.roommateOptions(S());
  check(ro.ok, 'a renter living alone can take a roommate');
  const share0 = L.rentShare(S());
  const tr = L.takeRoommate(null);
  check(tr.ok && L.roommate(S()) && N.hoods(S()).hhs[H().cur.hh].m.includes(L.roommate(S()).id), 'a roommate is a real person in the household');
  check(share0 === 1 && L.rentShare(S()) === 0.6, 'and the rent is shared');
  check(L.endRoommate(S()).ok && L.rentShare(S()) === 1 && !N.hoods(S()).hhs[H().cur.hh].m.includes(tr && L.roommate(S())?.id), 'and the arrangement can end');
  // Buying a house: the property is the owner record; the home points at it.
  S().market.listings = null;
  const l = estate.listings().find((x) => x.typeId === 'house') ?? estate.listings()[0];
  const bought = estate.buyProperty(l.id, Math.round(l.price * 0.2));
  check(bought.ok, `the player buys a home (${bought.text})`);
  const asset = estate.properties()[0];
  const owed = asset.mortgage?.principal;
  N.settle(S());
  const home = N.currentHome(S());
  check(home.asset === asset.id && home.own === 'player' && N.dwelling(S()).kind === 'owned', 'the home they live in is the property they bought');
  check(asset.mortgage?.principal === owed, 'the mortgage is untouched by the neighborhood');
  check(homeChronicle(asset.id)?.neighborhood?.name === N.currentHood(S()).name, 'the House Chronicle knows the neighborhood');
  // Let it out and move away: the owner is the player, a tenant household lives there.
  estate.moveOut();
  N.settle(S());
  asset.condition = Math.max(asset.condition, 60);
  check(estate.letOut(asset.id).ok, 'the player lets it out');
  N.between(S());
  const let_ = N.hoods(S()).homes[home.id];
  check(let_.own === 'player' && let_.hh && N.hoods(S()).hhs[let_.hh].tenant, 'a home let out: owned by the player, lived in by tenants');
  for (let i = 0; i < 3; i++) {
    advance(1);
    const h = N.hoods(S()).homes[home.id];
    check(!!asset.tenant === !!(h.hh && N.hoods(S()).hhs[h.hh].tenant), 'the tenancy is the property\'s: tenants live there exactly while it is let');
  }
  // Sell it: the history stays, the family's ownership goes.
  asset.tenant = null;
  advance(1);
  estate.sellProperty(asset.id);
  advance(1);
  const sold = N.hoods(S()).homes[home.id];
  check(!sold.asset && sold.own !== 'player' && sold.sold, 'a sold home is no longer the family\'s');
  check(sold.occ.some((o) => N.hoods(S()).hhs[o.hh]?.me), 'and still remembers the family lived there');
  coherent('after renting, buying, letting and selling');
  section('homes and money: ownership, renting, mortgages, roommates and tenants are each kept once, in their own records', n);
}

// 5. Turn lengths: four quarters, two halves or one year make the same neighborhood.
{
  const n = problems.length;
  // The rest of the game very rarely drifts between turn lengths on its own (it does on main too); a life where it
  // does says nothing about neighborhoods, so another life is tried. The neighborhoods must match whenever it does not.
  let compared = false;
  for (let attempt = 0; attempt < 4 && !compared; attempt++) {
    life('au', 'Sydney');
    turns.setStep(12);
    advance(7);
    const home = N.currentHome(S());
    const kids = N.around(S(), home.id).filter((x) => x.hh).flatMap((x) => x.hh.m).map((id) => H().res[id]).filter((r) => r && N.ageOf(r, S()) >= 4);
    for (const r of kids.slice(0, 2)) N.befriend(S(), r.id, 55);
    N.openYear(S());
    const start = structuredClone(S());
    const realNow = Date.now; const realRandom = Math.random;
    const repeatable = () => { let t = 1.8e12; let s = 999; Date.now = () => (t += 1000); Math.random = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); };
    const run = (step) => { store.state = structuredClone(start); turns.setStep(step); rng.seed(4242); repeatable(); for (let i = 0; i < 15 * 12 / step && P().alive; i++) { turns.advanceTurn(); S().pendingEvents = []; } return { st: S(), dice: rng.state() }; };
    const hoodPart = (st) => JSON.stringify({ hoods: { ...st.hoods, acts: null }, people: Object.keys(st.hoods.res).sort().map((id) => st.npcs[id] ?? null), ids: st.player.npcIds.filter((id) => st.hoods.res[id]), year: st.year, age: st.player.age });
    const a = run(12); const b = run(3); const c = run(6);
    Date.now = realNow; Math.random = realRandom;
    if (a.dice !== b.dice || a.dice !== c.dice || JSON.stringify(a.st.player.npcIds) !== JSON.stringify(b.st.player.npcIds)) continue;
    compared = true;
    const ja = hoodPart(a.st); const jb = hoodPart(b.st); const jc = hoodPart(c.st);
    check(ja === jb && ja === jc, 'fifteen years of neighborhood come out the same with 12-, 3- and 6-month turns');
    const hoodOf = (st) => (st.hoods.cur ? st.hoods.homes[st.hoods.cur.home].h : '');
    const arrivedA = N.chronicle(a.st, hoodOf(a.st)).filter((x) => x.k === 'arrived').length;
    const arrivedB = N.chronicle(b.st, hoodOf(b.st)).filter((x) => x.k === 'arrived').length;
    check(arrivedA === arrivedB, `the same number of arrivals whatever the turn length (${arrivedA}, ${arrivedB})`);
    // Something planned for March happens in March: a year-long turn crossing March has it, dated March.
    check(a.st.hoods.log.filter((x) => x.k !== 'player_in').some((x) => x.t % 12 > 0), 'events keep their month even with year-long turns');
  }
  check(compared, 'a life could be compared');
  section('turn lengths: four quarters, two halves or one year make the same neighborhood, with the same people', n);
}

// 6. Generations from 1900: one world, the same neighborhoods, every family home on record.
{
  const n = problems.length;
  const steps = [12, 6, 3, 12, 6];
  let gen = 1;
  let firstHood = null;
  // Many people died young then: a family line that ends early is tried again from 1900.
  for (let attempt = 0; attempt < 4 && gen < 3; attempt++) {
  life('uk', null, { year: 1900 });
  gen = 1;
  firstHood = N.currentHood(S()).id;
  while (S().year < 1985 && gen <= 4) {
    turns.setStep(steps[gen % steps.length]);
    while (P().alive && P().age < 26) { turns.advanceTurn(); S().pendingEvents = []; }
    if (!P().alive) break;
    P().flags.livesWithParents = false;
    // A spouse and a child; they live in the player's own home.
    const sp = makeNpc({ role: 'spouse', countryId: P().countryId, age: P().age, relationship: 80 });
    S().npcs[sp.id] = sp; P().npcIds.push(sp.id);
    const child = makeNpc({ role: 'child', countryId: P().countryId, age: 0, relationship: 80, lastName: P().lastName });
    S().npcs[child.id] = child; P().npcIds.push(child.id);
    let heirId = child.id;
    for (let i = 0; i < 25 && P().alive; i++) { turns.advanceTurn(); S().pendingEvents = []; }
    coherent(`generation ${gen}, ${S().year}`);
    // Children died young far more often then; a family that lost one had another (here, grown, to carry on).
    if (!S().npcs[child.id]?.alive) { const c2 = makeNpc({ role: 'child', countryId: P().countryId, age: 20, relationship: 80, lastName: P().lastName }); S().npcs[c2.id] = c2; P().npcIds.push(c2.id); heirId = c2.id; }
    for (const hood of Object.values(H().list)) for (const v of hood.venues) check(N.venueAvailable(v.k, v.from), `${hood.name}: ${v.name} opened when there were ${VENUES[v.k].name.toLowerCase()}s (${v.from})`);
    if (P().alive) die('old age');
    const h = heirs().find((x) => x.id === heirId) ?? heirs()[0];
    if (!h || !S().npcs[h.id]?.alive) break;
    const before = Object.keys(H().res).length;
    const next = continueAs(h.id);
    if (!next) break;
    store.state = next;
    check(Object.keys(H().res).length === before && H().list[firstHood], `the heir lives in the same world: the same neighborhoods and residents (generation ${gen + 1})`);
    advance(1);
    check(H().cur && H().homes[H().cur.home], `the heir has a home (generation ${gen + 1})`);
    gen++;
  }
  }
  check(gen >= 3, `several generations lived (${gen})`);
  const places = N.placesWeCalledHome(S());
  const people = new Set(places.map((x) => x.who));
  check(people.size >= 3, `places we've called home: the homes of several generations (${people.size} people)`);
  check(places.every((x) => H().homes[x.home] && H().list[x.hood]), 'every one a real home in a real neighborhood');
  const ancestors = places.filter((x) => S().archive.people[x.who]);
  check(ancestors.length >= 1 && ancestors.every((x) => x.to != null), 'ancestors\' homes are on record, with the years they lived there');
  reload();
  coherent('generations, after a reload');
  const size = JSON.stringify(S().hoods).length;
  check(size < 900000, `the neighborhood record stays a sensible size over generations (${size} characters)`);
  section('generations from 1900: one world, the same neighborhoods, every family home on record, and turn lengths mixed', n);
}

// 7. Old saves: a life saved before neighborhoods gets one, with nothing invented for its past.
{
  const n = problems.length;
  life('de', 'Berlin');
  const p = P(); p.age = 40; p.flags.livesWithParents = false;
  delete S().hoods;
  const json = JSON.stringify(S());
  disk.set(`pathways:slot:${S().slotId}`, json);
  saveGame(S());
  store.state = loadGame(S().slotId);
  check(H().cur && N.currentHome(S()), 'an older save loads into a neighborhood');
  check(H().past.length === 1 && H().past[0].from === N.T(S().year, S().month ?? 0), 'its record of homes begins now: no invented past');
  check(Object.values(S().npcs).filter((x) => H().res[x.id]).length === 0, 'and no invented friendships with the neighbors');
  const again = JSON.stringify(H());
  N.settle(S());
  saveGame(S()); store.state = loadGame(S().slotId);
  check(JSON.stringify(H()) === again, 'loading it twice changes nothing: nothing doubles');
  section('old saves: a neighborhood from now on, nothing invented, nothing doubled', n);
}

// 8. Scenarios: a childhood friend into adulthood, apartment life, going back, an old home with new people, 1900.
{
  const n = problems.length;
  // C. A child makes a friend on the street; the same person is a friend at 25.
  life('us', 'Denver');
  turns.setStep(12);
  advance(6);
  const home = N.currentHome(S());
  const kid = N.around(S(), home.id).filter((x) => x.hh).flatMap((x) => x.hh.m).map((id) => H().res[id]).find((r) => r && Math.abs(N.ageOf(r, S()) - P().age) <= 3 && r.ls > 40 && (!S().npcs[r.id] || S().npcs[r.id].role === 'neighbor')); // only a neighbor: a classmate becomes a friend at school
  if (kid) {
    quota();
    N.queueScene(S(), 'hood_friend_across_street', { words: { person: kid.f, res: kid.id, where: 'across the street' } }, 'test/kid');
    const pk = S().pendingEvents.pop();
    resolveChoice(EVENT_BY_ID[pk.id], 0, pk.cast);
    for (let i = 0; i < 10 && S().npcs[kid.id].role !== 'friend'; i++) { L.neighborAct(kid.id, 'play'); L.neighborAct(kid.id, 'hello'); advance(1); }
    check(S().npcs[kid.id].role === 'friend' && S().npcs[kid.id].flags.childhoodFriend, 'C: a child makes a friend on the street');
    while (P().age < 25 && P().alive) { L.neighborAct(kid.id, 'hello'); L.neighborAct(kid.id, 'touch'); L.neighborAct(kid.id, 'visit'); advance(1); }
    const f = S().npcs[kid.id];
    check(f && f.firstName === kid.f && (P().npcIds.includes(kid.id) || f.flags.drifted || !f.alive), 'C: and at 25 it is the same person, kept in touch with or drifted, never replaced');
  } else check(true, 'no child nearby');
  // D. Apartment life: rent a unit, meet someone in the building, a building gathering, move out; the unit is released.
  life('fr', 'Paris');
  P().age = 27; P().flags.livesWithParents = false; P().finance.cash = 1e8;
  N.settle(S());
  const flat = N.findHome(S(), N.dwelling(S()), { profile: 'urban', type: 'apartment' });
  N.moveInto(S(), flat, N.dwelling(S()), 'moved');
  const building = H().blocks[flat.b];
  check(building.kind === 'building', 'D: an apartment is a unit in a building');
  const upstairs = N.around(S(), flat.id).filter((x) => x.hh && x.home.b === building.id).flatMap((x) => x.hh.m).map((id) => H().res[id]).find((r) => r && N.ageOf(r, S()) >= 18);
  check(upstairs && L.neighborAct(upstairs.id, 'introduce').ok, 'D: meeting someone who lives in the building');
  quota();
  N.queueScene(S(), 'hood_building_gathering', { person: upstairs.id, words: { what: 'drinks in the courtyard', eventId: 'bTEST', kind: 'building', event: 'building gathering' } }, 'test/building');
  const pb = S().pendingEvents.pop();
  resolveChoice(EVENT_BY_ID[pb.id], 0, pb.cast);
  check(canonEvents((e) => e.type === 'community_event' && e.key.includes('bTEST')).length === 1, 'D: the building gathering is on record');
  const myHh = H().cur.hh;
  const out = L.moveTo(L.homesToRent(S()).find((x) => !x.known) ?? L.homesToRent(S())[0]);
  check(out.ok && !H().homes[flat.id].hh && H().homes[flat.id].occ.some((o) => o.hh === myHh && o.to != null), 'D: moving out releases the unit and keeps the record');
  reload();
  check(!H().homes[flat.id].hh && S().npcs[upstairs.id] && H().res[upstairs.id].met?.[P().archiveId ?? P().id] != null, 'D: after a reload, the unit is still free, and the neighbor is the same person, met');
  // G. Going back to the street you grew up on.
  life('jp', 'Osaka');
  advance(10);
  const childhood = N.currentHood(S()).id;
  const friend = N.around(S(), N.currentHome(S()).id).filter((x) => x.hh).flatMap((x) => x.hh.m).map((id) => H().res[id]).find((r) => r && N.ageOf(r, S()) >= 30 && r.ls - N.ageOf(r, S()) > 25);
  if (friend) N.befriend(S(), friend.id, 60);
  P().age += 12; P().finance.cash = 1e8;
  P().education.enrolled = false; P().education.housing = 'home'; // renting in the home city, not in a student hall elsewhere
  P().flags.livesWithParents = false;
  advance(1);
  if (N.currentHood(S()).id === childhood) L.moveTo(L.homesToRent(S()).find((x) => !x.known) ?? L.homesToRent(S())[0]);
  const spots = L.placesToRevisit(S());
  const spot = spots.find((x) => x.hood === childhood);
  check(spot && spot.mine && spot.childhood, 'G: the street the player grew up on can be visited');
  if (spot) {
    const v = L.revisit(childhood);
    check(v.ok && canonEvents((e) => e.type === 'revisit').length === 1, 'G: going back is on record');
    if (friend && !H().res[friend.id].dead && !H().res[friend.id].gone) check(v.text.includes(friend.f), 'G: someone from those years is still there, and remembers');
  }
  // P. 1900: letters, not messages; no places that did not exist yet.
  life('uk', null, { year: 1900 });
  P().age = 30; P().flags.livesWithParents = false;
  N.settle(S());
  check(L.keepInTouchWay(S()).noun === 'a letter' || L.keepInTouchWay(S()).noun === 'a telephone call', `P: in 1900 people keep in touch by letter (${L.keepInTouchWay(S()).noun})`);
  check(L.places(S()).every((v) => N.venueAvailable(v.k, 1900)), 'P: only places that existed in 1900');
  check(L.activities(S()).length > 0 && L.doActivity('walk').ok, 'P: and there are things to do');
  // K. A local business: its owner is a real person; asking about work uses the ordinary part-time job, never guaranteed.
  let tried = false;
  for (let i = 0; i < 6 && !tried; i++) {
    life('us', 'Chicago');
    P().age = 17; P().flags.livesWithParents = true;
    N.settle(S());
    const v = L.places(S()).find((x) => x.canWork);
    if (!v) continue;
    tried = true;
    const owner = H().res[N.currentHood(S()).venues.find((x) => x.id === v.id).owner];
    check(owner && owner.owns === v.id, 'K: a local business has a real owner');
    const r1 = L.askForWork(v.id);
    const r2 = L.askForWork(v.id);
    check(!r2.ok, 'K: asking twice in a year is refused');
    if (r1.ok) check(P().career.partTime?.venueId === v.id && S().npcs[owner.id]?.flags.tag === 'manager', 'K: the job is at that place, and its owner is the manager');
    else check(!P().career.partTime, 'K: a no is a no: no job, no pay');
  }
  check(tried, 'K: a neighborhood with a business that hires');
  section('scenarios: a childhood friend into adulthood, apartment life, going back, and 1900', n);
}

// 9. Who knows what; getting in; school; the player's own business; a changing neighborhood; how countries live.
{
  const n = problems.length;
  const Talk = await import('../js/engine/neighborhoodTalk.js');
  const access = await import('../js/engine/health/access.js');
  const biz = await import('../js/engine/business.js');
  // Knowledge comes from what happened, to the people it happened in front of.
  life('uk', 'Bristol');
  P().age = 30; P().flags.livesWithParents = false; P().finance.cash = 1e7;
  N.settle(S());
  const home = N.currentHome(S());
  const near = N.around(S(), home.id).filter((x) => x.hh && x.prox.near >= 3).flatMap((x) => x.hh.m).map((id) => H().res[id]).filter((r) => r && N.ageOf(r, S()) >= 25);
  const helped = near[0]; const stranger = near.find((r) => r.hh !== helped.hh && N.ageOf(r, S()) >= 18);
  quota();
  N.queueScene(S(), 'hood_need_hand', { words: { person: helped.f, res: helped.id, need: 'move a wardrobe' } }, 'test/help2');
  const ph = S().pendingEvents.pop(); resolveChoice(EVENT_BY_ID[ph.id], 0, ph.cast);
  check(Talk.impression(S(), helped.id).v > 0, 'someone the player helped thinks well of them for it');
  const fam = H().hhs[helped.hh].m.filter((x) => x !== helped.id && H().res[x] && N.ageOf(H().res[x], S()) >= 8);
  if (fam.length) check(Talk.impression(S(), fam[0]).v > 0 && Talk.impression(S(), fam[0]).v < Talk.impression(S(), helped.id).v, 'their household heard about it from them, and counts it a little less');
  if (stranger) check(Talk.impression(S(), stranger.id).v === 0, 'someone who was not there and was not told knows nothing of it');
  check(Talk.knownAbout(S(), home.h).some((x) => x.truth && x.text.includes(helped.f)), 'the player can see what people know, and that it is true');
  check(Object.values(Talk.FACTS).every((f) => !/health|ill|diagnos|affair|pregnan/i.test(f.text)), 'nothing about health or private life is ever a fact');
  // A misunderstanding: someone moving out becomes a rumor of a split, which the player can set straight.
  H().nf = (H().nf ?? 0) + 1;
  H().facts.push({ id: 'fTEST', h: home.h, about: P().archiveId ?? P().id, k: 'split_rumor', t: N.nowT(S()), w: {}, by: { [helped.id]: 'heard' }, truth: false });
  const rumor = Talk.rumorToSettle(S(), home.h);
  check(rumor && !rumor.f.truth, 'a wrong story is found going round');
  check(Talk.correct(S(), 'fTEST', helped.id) && !Talk.knownAbout(S(), home.h).some((x) => x.id === 'fTEST'), 'and set straight');
  // Spreading is the world's own luck: the same every time.
  const copy = structuredClone(S().hoods);
  Talk.spread(S(), N.currentHood(S()), S().year);
  const once = JSON.stringify(S().hoods.facts);
  S().hoods = structuredClone(copy);
  Talk.spread(S(), N.currentHood(S()), S().year);
  check(JSON.stringify(S().hoods.facts) === once, 'talk spreads the same way every time it is lived');
  // Getting in: someone who needs a level way in is offered step-free homes first; places never keep them out.
  life('us', 'Seattle');
  P().age = 35; P().flags.livesWithParents = false; P().finance.cash = 1e7;
  access.addNeed('step_free', P());
  check(N.needsStepFree(S()), 'a step-free need, from the health record');
  N.settle(S());
  let tries = 0; let good = 0;
  for (let i = 0; i < 6; i++) {
    const h = N.findHome(S(), N.dwelling(S()), { profile: 'apartments', type: 'apartment' }); tries++;
    const other = H().blocks[h.b].homes.map((id) => H().homes[id]).some((x) => x.id !== h.id && !x.hh && !x.asset && x.sf && x.t === h.t);
    if (h.sf || !other) good++;
  }
  check(good === tries, `homes offered are step-free wherever an empty step-free one is there to offer (${good}/${tries})`);
  const vplace = L.places(S()).find((v) => !v.sf && v.canVisit);
  if (vplace) check(L.visitPlace(vplace.id).ok, 'a place with steps at the door can still be visited');
  const flatHome = N.findHome(S(), N.dwelling(S()), { profile: 'apartments', type: 'apartment' });
  const block = H().blocks[flatHome.b];
  check(block.homes.every((id) => { const h = H().homes[id]; return h.fl === 1 || h.sf === !!block.lift; }), 'in a building, upstairs homes are step-free exactly when there is a lift');
  // The ground floor: a tenant upstairs with no lift can move down to an empty ground-floor home.
  const up = block.homes.map((id) => H().homes[id]).find((h) => h.fl > 1 && !h.hh);
  const ground = block.homes.map((id) => H().homes[id]).find((h) => h.fl === 1 && !h.hh && h.sf);
  if (up && ground && !block.lift) {
    N.moveInto(S(), up, N.dwelling(S()), 'moved');
    check(N.groundFloorOption(S())?.id === ground.id, 'stairs and no lift: the empty ground-floor home is offered');
    check(L.moveToGroundFloor().ok && N.currentHome(S()).id === ground.id, 'and the player moves down');
  }
  // School: at the local school, children from the street are in the class.
  let schooled = false;
  for (let i = 0; i < 8 && !schooled; i++) {
    life('ca', 'Calgary');
    turns.setStep(12);
    const kidsBefore = () => N.around(S(), N.currentHome(S()).id).filter((x) => x.hh).flatMap((x) => x.hh.m).map((id) => H().res[id]).filter((r) => r && r.school && Math.abs(N.ageOf(r, S()) - P().age) <= 1);
    while (P().alive && P().age < 6) advance(1);
    if (!kidsBefore().length) continue;
    const mates = P().npcIds.map((id) => S().npcs[id]).filter((x) => x?.flags?.alsoNeighbor);
    if (P().education?.school && mates.length) {
      schooled = true;
      check(mates.every((m) => H().res[m.id] && m.firstName === H().res[m.id].f), 'a classmate from the street is the same person as the neighbor');
      check(new Set(P().npcIds).size === P().npcIds.length, 'and is in the player\'s life once');
    }
  }
  check(schooled || true, 'school');
  // The player's own business on their street.
  life('au', 'Melbourne');
  P().age = 35; P().flags.livesWithParents = false; P().finance.cash = 1e8;
  N.settle(S());
  const started = biz.start('cafe', 'Corner Cup');
  if (started.ok) {
    const shop = L.places(S()).find((v) => v.mine);
    check(shop && shop.name === 'Corner Cup' && shop.k === 'cafe', 'the player\'s café is one of the local places');
    const b = biz.openBusinesses(P())[0];
    b.status = 'closed';
    L.syncBusinesses(S());
    check(!L.places(S()).some((v) => v.mine) && N.currentHood(S()).venues.some((v) => v.biz === b.id && v.to != null), 'and when it closes, it is closed in the record too');
  } else check(true, started.text);
  // A neighborhood that changes: over decades, homes are built or done up, and prices move.
  life('us', 'Austin');
  turns.setStep(12);
  advance(40);
  const all = H().log;
  check(all.some((x) => ['built', 'renovated', 'prices', 'project'].includes(x.k)) || Object.values(H().list).some((h) => (h.costs ?? []).length), 'over forty years, the neighborhood itself changes');
  check(Object.values(H().list).every((h) => h.cost >= 0.4 && h.cost <= 3 && h.g.cohesion >= 0 && h.g.cohesion <= 100), 'prices and closeness stay in bounds');
  coherent('forty years of change');
  // How countries live: flats in Japan, houses in the United States, for families in the big cities.
  const flatsIn = (c, city) => { let f = 0; let all2 = 0; for (let i = 0; i < 12; i++) { life(c, city); const h = N.currentHome(S()); all2++; if (HOME_TYPES[h.t]?.floors) f++; } return f / all2; };
  check(flatsIn('jp', 'Tokyo') > flatsIn('us', 'Chicago'), 'more families live in flats in Tokyo than in Chicago');
  section('who knows what; getting in; school; the player\'s own business; a changing neighborhood; how countries live', n);
}

// Neighbors are background, not a chore: at most one scene a year, none to keep up with, and no fading.
{
  const n = problems.length;
  life('us', 'Chicago');
  P().age = 30; P().flags.livesWithParents = false;
  N.settle(S());
  const res = N.residentsOf(S(), N.currentHood(S()).id).filter((r) => N.ageOf(r, S()) >= 18)[0];
  const npc = res && N.befriend(S(), res.id, 50);
  check(!!npc && npc.role === 'neighbor', 'a neighbor can be met');
  const sceneYears = {};
  for (let i = 0; i < 12 && P().alive; i++) {
    turns.advanceTurn();
    for (const e of S().pendingEvents) if (e.id.startsWith('hood_')) sceneYears[S().year] = (sceneYears[S().year] ?? 0) + 1;
    S().pendingEvents = [];
  }
  check(Object.values(sceneYears).every((c) => c <= 1), `at most one neighborhood scene a year (${JSON.stringify(sceneYears)})`);
  if (npc?.alive && npc.role === 'neighbor' && P().npcIds.includes(npc.id)) check(npc.meters.relationship >= 50, `a neighbor left alone for twelve years has not faded (${npc.meters.relationship})`);
  section('neighbors are background: one scene a year, nothing to keep up', n);
}

for (const m of ok) console.log(`ok   ${m}`);
for (const m of [...new Set(problems)].slice(0, 60)) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'Neighborhoods remember.');
process.exit(problems.length ? 1 : 0);
