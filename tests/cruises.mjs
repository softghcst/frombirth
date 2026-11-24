// Cruises in the trip planner: a line, a sailing, a stateroom and its view, and every extra priced the way cruises are.
// Run with: node tests/cruises.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const travel = await import('../js/engine/travel.js');
const { CRUISE_LINE_BY_ID, ITINERARY_BY_ID } = await import('../js/data/cruises.js');
const { COUNTRIES } = await import('../js/data/countries.js');

rng.seed(424242);
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); else console.log(` ✓ ${m}`); };

/** A grown-up in New York in the given year, with money. */
function life(year = 2024, age = 35) {
  let s; do { s = createLife({ countryId: 'us', city: 'New York', year }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  p.age = age; p.birthYear = s.year - age; p.finance.cash = 500000; p.flags.livesWithParents = false; p.homeId = 'h1'; p.legal.incarceration = null;
  p.career.careerId = null;
  return p;
}
const total = (t) => travel.quote(t).total;
const plan = (o = {}) => {
  const t = travel.startPlan('cruise');
  travel.updatePlan(t.id, { depart: o.depart ?? `${store.state.year}-06-10` });
  travel.updatePlan(t.id, { cruise: { line: o.line ?? 'coral_bay' } });
  travel.updatePlan(t.id, { cruise: { itin: o.itin ?? 'alaska_inside' } });
  if (o.room !== null) travel.updatePlan(t.id, { cruise: { room: o.room ?? 'balcony' } });
  return t;
};

// 1. Every sailing leaves from a real city in the game, and every line sails somewhere it can.
{
  for (const it of Object.values(ITINERARY_BY_ID)) {
    check(COUNTRIES[it.port[0]]?.cities.includes(it.port[1]), `${it.name} leaves from a city in the game (${it.port.join(', ')})`);
    if (it.oneWay) check(COUNTRIES[it.oneWay[0]]?.cities.includes(it.oneWay[1]), `${it.name} ends in a city in the game`);
  }
  for (const l of Object.values(CRUISE_LINE_BY_ID)) check(Object.values(ITINERARY_BY_ID).some((it) => l.regions.includes(it.region)), `${l.name} has sailings`);
}

// 2. Planning: the sailing sets where and when; the port is reached a day early.
{
  life();
  const t = plan();
  check(t.destination.city === 'Seattle' && t.cruise.sail === `${store.state.year}-06-11` && t.ret === `${store.state.year}-06-18`, `Alaska from Seattle: leave ${t.depart}, sail ${t.cruise.sail}, home ${t.ret}`);
  const modes = travel.modesFor(t.origin, t.destination, store.state.year).map((m) => m.id);
  check(modes.includes('jet') && !modes.includes('cruise_ship'), 'getting to the port: fly or drive, not a ship to the ship');
  travel.updatePlan(t.id, { mode: 'jet' });
  check(travel.problems(t).length === 0, `a full plan can be booked (${travel.problems(t).join(' / ')})`);
  const q = travel.quote(t);
  const labels = q.lines.map((l) => l.label).join(' | ');
  check(/Port fees and taxes/.test(labels) && /gratuities/.test(labels) && /night before sailing/.test(labels) && !/Food and getting about/.test(labels), 'the bill: fare, port fees, gratuities, a hotel the night before; food is in the fare');
  check(/single supplement/.test(labels), 'alone in a balcony: the single supplement');
  // Sailing from home: no hotel, sailing the day you leave.
  const home = travel.startPlan('cruise');
  travel.updatePlan(home.id, { depart: `${store.state.year}-03-10`, cruise: { line: 'coral_bay' } });
  travel.updatePlan(home.id, { cruise: { itin: 'bahamas_short' } });
  check(home.cruise.sail === home.depart && !travel.quote(home).lines.some((l) => /night before/.test(l.label)), 'sailing from your own city: aboard the day you leave, no hotel');
  check(!travel.problems(home).some((x) => /where you live/.test(x)), 'and it is not refused as "where you live"');
}

// 3. Prices behave like cruise prices.
{
  life();
  const inside = total(plan({ room: 'inside' }));
  const balcony = total(plan({ room: 'balcony' }));
  const suite = total(plan({ room: 'suite' }));
  check(inside < balcony && balcony < suite, `inside < balcony < suite (${inside} < ${balcony} < ${suite})`);
  const t = plan({ room: 'balcony' });
  const sea = total(t);
  travel.updatePlan(t.id, { cruise: { view: 'obstructed' } });
  const blocked = total(t);
  travel.updatePlan(t.id, { cruise: { view: 'aft' } });
  const aft = total(t);
  check(blocked < sea && aft > sea, `a lifeboat view costs less, an aft wake view more (${blocked} < ${sea} < ${aft})`);
  // Two sharing pay much less each than one alone; a third guest much less again.
  const p = store.state.player;
  const fareOf = (tr) => travel.quote(tr).lines.filter((l) => l.kind === 'cruise' && /^Cruise fare/.test(l.label)).reduce((s, l) => s + l.amount, 0);
  const solo = fareOf(plan({ room: 'balcony' }));
  const two = plan({ room: 'balcony' });
  const friend = makeNpc({ role: 'friend', countryId: 'us', age: 34 }); store.state.npcs[friend.id] = friend; p.npcIds.push(friend.id);
  two.travelers.push({ id: friend.id, status: 'accepted', pays: 'organizer' });
  const pair = fareOf(two);
  const kid = makeNpc({ role: 'friend', countryId: 'us', age: 9 }); store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id);
  two.travelers.push({ id: kid.id, status: 'accepted', pays: 'organizer' });
  const three = fareOf(two);
  check(pair / 2 < solo * 0.6 && three - pair < pair / 2 * 0.6, `per person: alone ${solo}, two sharing ${Math.round(pair / 2)} each, a third guest ${three - pair}`);
}

// 4. Extras: the drinks package for every adult of drinking age, soft drinks for the rest, Wi-Fi by device, excursions by port.
{
  const p = life();
  const t = plan({ room: 'balcony' });
  const teen = makeNpc({ role: 'child', countryId: 'us', age: 19 }); store.state.npcs[teen.id] = teen; p.npcIds.push(teen.id);
  const partner = makeNpc({ role: 'spouse', countryId: 'us', age: 36 }); store.state.npcs[partner.id] = partner; p.npcIds.push(partner.id);
  t.travelers.push({ id: teen.id, status: 'accepted', pays: 'organizer' }, { id: partner.id, status: 'accepted', pays: 'organizer' });
  travel.updatePlan(t.id, { cruise: { extra: 'drinks' } });
  travel.updatePlan(t.id, { cruise: { extra: 'soda' } });
  const lines = travel.quote(t).lines;
  check(lines.some((l) => /Drinks package.*\(2\)/.test(l.label)) && lines.some((l) => /Soft drinks package \(1\)/.test(l.label)), 'from a US port the drinking age is 21: two adults on the drinks package, the 19-year-old on soft drinks');
  travel.updatePlan(t.id, { cruise: { extra: 'wifi_basic' } });
  travel.updatePlan(t.id, { cruise: { extra: 'wifi_stream' } });
  check(t.cruise.extras.filter((x) => /^wifi/.test(x)).join() === 'wifi_stream', 'one Wi-Fi plan at a time');
  const one = total(t);
  travel.updatePlan(t.id, { cruise: { devices: 3 } });
  check(total(t) > one, 'Wi-Fi is priced per device');
  travel.updatePlan(t.id, { cruise: { extra: 'excursions' } });
  const none = total(t);
  travel.updatePlan(t.id, { cruise: { port: 0 } });
  travel.updatePlan(t.id, { cruise: { port: 1 } });
  check(total(t) > none && travel.quote(t).lines.some((l) => /Shore excursions: Juneau, Skagway/.test(l.label)), 'excursions are chosen port by port');
}

// 5. What a line includes is not charged; adults-only lines refuse children; the year decides what exists.
{
  life();
  const t = plan({ line: 'halcyon', itin: 'fjords', room: 'suite' });
  for (const id of ['drinks', 'dining', 'wifi_basic']) travel.updatePlan(t.id, { cruise: { extra: id } });
  const lines = travel.quote(t).lines.map((l) => l.label).join(' | ');
  check(!/Drinks package|Specialty dining|Wi-Fi|gratuities/.test(lines), 'a luxury line charges nothing for drinks, dining, Wi-Fi or tips');
  check(!travel.staterooms(t).some((r) => r.id === 'inside'), 'and has no inside staterooms');
  const p = store.state.player;
  const a = plan({ line: 'tidewater', itin: 'greek_isles', depart: `${store.state.year}-07-01` });
  const child = makeNpc({ role: 'child', countryId: 'us', age: 10 }); store.state.npcs[child.id] = child; p.npcIds.push(child.id);
  a.travelers.push({ id: child.id, status: 'accepted', pays: 'organizer' });
  check(travel.problems(a).some((x) => /adults only/.test(x)), 'an adults-only line will not take a ten-year-old');
  life(1978);
  const old = plan({ line: 'grand_ocean', itin: 'transatlantic', room: null, depart: '1978-05-01' });
  check(!travel.cruiseLines(old).some((l) => l.id === 'coral_bay') && travel.cruiseLines(old).some((l) => l.id === 'sunward'), 'in 1978 there are no big-ship family lines yet');
  const y78 = travel.startPlan('cruise'); travel.updatePlan(y78.id, { depart: '1978-05-01', cruise: { line: 'meridian' } }); travel.updatePlan(y78.id, { cruise: { itin: 'caribbean_west' } });
  check(!travel.staterooms(y78).some((r) => r.id === 'balcony') && !travel.cruiseExtras(y78).some((e) => /^wifi|drinks/.test(e.id)), 'and no balconies, drinks packages or Wi-Fi');
  void old;
}

// 6. Seasons: Alaska only in summer.
{
  life();
  const t = travel.startPlan('cruise');
  travel.updatePlan(t.id, { depart: `${store.state.year}-01-15`, cruise: { line: 'coral_bay' } });
  check(travel.sailings(t).find((x) => x.id === 'alaska_inside')?.why?.includes('only in'), 'Alaska in January: not sailing');
}

// 7. Booked, sailed, home: paid once, a memory of the sea, a happier traveler.
{
  const p = life();
  const t = plan({ room: 'balcony' });
  travel.updatePlan(t.id, { mode: 'jet', cruise: { extra: 'drinks' } });
  const before = p.finance.cash;
  const q = travel.quote(t);
  const b = travel.confirm(t.id);
  const fees = (p.finance.receipts ?? []).filter((x) => x.kind === 'passport_fee').reduce((s, x) => s - x.amount, 0);
  check(b.ok && before - p.finance.cash === q.organizer + Math.abs(fees), `booked and paid once (${q.organizer}, plus ${Math.abs(fees)} for a passport: Victoria is in Canada)`);
  p.stats.mood = 50;
  store.state.today = t.depart;
  const d = travel.depart(t.id);
  check(d.ok, `sailed (${d.text})`);
  const h = travel.comeHome(t.id);
  check(h.ok && /Alaska Inside Passage with Coral Bay Cruises/.test(h.text) && p.stats.mood > 55, `home, with a memory (${h.text})`);
  check(travel.tripCard(t).where.includes('Alaska Inside Passage') && travel.tripCard(t).cruise.room === 'Balcony stateroom', 'the trip card names the sailing and stateroom');
  check(p.flags.cruises?.length === 1, 'the cruise is remembered among the cruises taken');
}

// 8. Ports abroad count: papers for every country the ship stops in, and a stamp for each.
{
  const p = life();
  p.flags.passport = []; p.flags.visited = [];
  const t = travel.startPlan('cruise');
  travel.updatePlan(t.id, { depart: `${store.state.year}-03-10`, cruise: { line: 'coral_bay' } });
  travel.updatePlan(t.id, { cruise: { itin: 'caribbean_west' } });
  travel.updatePlan(t.id, { cruise: { room: 'inside' } });
  travel.updatePlan(t.id, { mode: 'walk' });
  check(travel.countriesOf(t).sort().join() === 'bs,jm,mx', `from New York: the Bahamas, Jamaica and Mexico (${travel.countriesOf(t)})`);
  const entries = travel.entryCheck(t);
  check(entries.length === 3 && entries.some((x) => /Jamaica/.test(x.name)), 'the passport step lists every country the ship stops in');
  check(travel.problems(t).length === 0, `bookable, papers sorted at booking (${travel.problems(t).join(' / ')})`);
  check(travel.confirm(t.id).ok, 'booked');
  store.state.today = t.depart;
  check(travel.depart(t.id).ok, 'sailed');
  const h = travel.comeHome(t.id);
  const stamps = p.flags.passport.filter((x) => x.kind === 'visit').map((x) => x.id).sort().join();
  check(stamps === 'bs,jm,mx', `a stamp for each country ashore (${stamps})`);
  check(['bs', 'jm', 'mx'].every((c) => p.flags.visited.includes(c)), 'and each counts as visited');
  check(['the Bahamas', 'Jamaica', 'Mexico'].every((c) => travel.tripCard(t).notes.some((n) => n.startsWith('Stamped:') && n.includes(c))), 'the trip notes the stamps');
  void h;
}

if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log('Cruises sail.');
