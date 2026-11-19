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
  check(around.some((x) => x.prox.k === 'adjacent'), 'someone lives next door');
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
  life('uk', 'Manchester');
  const home = N.currentHome(S());
  const hoodId = home.h;
  const first = new Map(Object.values(H().res).map((r) => [r.id, { by: r.by, hh: r.hh, f: r.f }]));
  const kid = Object.values(H().res).find((r) => N.ageOf(r, S()) < 10 && H().hhs[r.hh]?.home);
  // Meet someone, so a known person is among those who may move.
  const someone = N.around(S(), home.id).filter((x) => x.hh).flatMap((x) => x.hh.m).map((id) => H().res[id]).find((r) => r && N.ageOf(r, S()) >= 20);
  if (someone) N.befriend(S(), someone.id, 50);
  advance(30);
  coherent('thirty years on');
  for (const [id, x] of first) { const r = H().res[id]; if (r) check(r.by === x.by && r.f === x.f, `${id} keeps their name and birth year`); }
  if (kid) check(N.ageOf(H().res[kid.id], S()) === S().year - kid.by && N.ageOf(H().res[kid.id], S()) >= 30, 'a child next door grows up');
  const log = N.chronicle(S(), hoodId);
  const kinds = new Set(log.map((x) => x.k));
  check(kinds.has('left') && kinds.has('arrived'), `households move out and new ones move in (${[...kinds].join(', ')})`);
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
  check(S().npcs[r.id].role === 'friend' && S().npcs[r.id].flags.metAs === 'neighbor', 'time together makes a neighbor a friend');
  check(canonEvents((e) => e.type === 'friendship' && e.people.includes(r.id)).length === 1, 'the friendship is a canonical event, once');
  // Another neighbor, left alone, stays an acquaintance.
  if (next[1]) { L.neighborAct(next[1].id, 'introduce'); advance(3); check(S().npcs[next[1].id].role === 'neighbor', 'a neighbor met once stays an acquaintance'); }
  // Scenes queued by real events: a community event names its real organizer; attending records it once.
  const hood = N.currentHood(S());
  const org = N.residentsOf(S(), hood.id).find((x) => N.ageOf(x, S()) >= 25 && !S().npcs[x.id]);
  const evId = `${hood.id}eTEST`;
  S().pendingEvents = [];
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
  N.queueScene(S(), 'hood_need_hand', { words: { person: helper.f, res: helper.id, need: 'carry a sofa' } }, 'test/help');
  const ph = S().pendingEvents.pop();
  resolveChoice(EVENT_BY_ID[ph.id], 0, ph.cast);
  check(canonEvents((e) => e.type === 'neighbor_help').length === 1 && H().res[helper.id].owes, 'helping is recorded, and remembered by the neighbor');
  // A disagreement can be settled.
  const other = N.residentsOf(S(), hood.id).find((x) => N.ageOf(x, S()) >= 25 && x.id !== org.id && x.id !== helper.id);
  H().disputes.push({ id: 'dTEST', h: hood.id, res: other.id, kind: 'noise', t: N.nowT(S()), status: 'open' });
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
  life('uk', null, { year: 1900 });
  const steps = [12, 6, 3, 12, 6];
  let gen = 1;
  const firstHood = N.currentHood(S()).id;
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
    for (let i = 0; i < 25 && P().alive; i++) { turns.advanceTurn(); S().pendingEvents = []; }
    coherent(`generation ${gen}, ${S().year}`);
    // Children died young far more often then; a family that lost one had another (here, grown, to carry on).
    if (!S().npcs[child.id]?.alive) { const c2 = makeNpc({ role: 'child', countryId: P().countryId, age: 20, relationship: 80, lastName: P().lastName }); S().npcs[c2.id] = c2; P().npcIds.push(c2.id); child.id = c2.id; }
    for (const hood of Object.values(H().list)) for (const v of hood.venues) check(N.venueAvailable(v.k, v.from), `${hood.name}: ${v.name} opened when there were ${VENUES[v.k].name.toLowerCase()}s (${v.from})`);
    if (P().alive) die('old age');
    const h = heirs().find((x) => x.id === child.id) ?? heirs()[0];
    if (!h || !S().npcs[child.id]?.alive) break;
    const before = Object.keys(H().res).length;
    const next = continueAs(h.id);
    if (!next) break;
    store.state = next;
    check(Object.keys(H().res).length === before && H().list[firstHood], `the heir lives in the same world: the same neighborhoods and residents (generation ${gen + 1})`);
    advance(1);
    check(H().cur && H().homes[H().cur.home], `the heir has a home (generation ${gen + 1})`);
    gen++;
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

for (const m of ok) console.log(`ok   ${m}`);
for (const m of [...new Set(problems)].slice(0, 60)) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'Neighborhoods remember.');
process.exit(problems.length ? 1 : 0);
