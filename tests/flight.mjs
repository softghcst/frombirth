// The flight on a trip by air (engine/flight.js): the boarding pass and its seat, by the window or on the aisle; the
// moment halfway, by cabin and seat; and what it changes. Run with: node tests/flight.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const travel = await import('../js/engine/travel.js');
const flight = await import('../js/engine/flight.js');
const { FLIGHT_MOMENT_BY_ID } = await import('../js/data/flights.js');

rng.seed(20261127);
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const caseOf = (name, fn) => { const k = problems.length; try { fn(); } catch (err) { problems.push(`${name}: threw ${err.stack.split('\n').slice(0, 2).join(' | ')}`); } ok.push(problems.length === k ? name : `(failed) ${name}`); };
const P = () => store.state.player;
let month = 1;
function trip(cabin, mode = 'jet', dest = { countryId: 'jp', city: 'Tokyo' }) {
  const y = store.state.year + 1; const m = String(month++).padStart(2, '0');
  const t = travel.startPlan('vacation');
  travel.updatePlan(t.id, { destination: dest, depart: `${y}-${m}-02`, ret: `${y}-${m}-09`, mode, ...(cabin ? { cabin } : {}), stay: 'hotel' });
  const r = travel.confirm(t.id);
  if (!r.ok) throw new Error(`could not book: ${r.text}`);
  return travel.tripById(t.id);
}
function life() {
  store.state = createLife({ countryId: 'us', city: 'New York' });
  const p = P(); p.age = 30; p.birthYear = store.state.year - 30; p.finance.cash = 1e9; p.legal.incarceration = null; p.flags.livesWithParents = false;
  p.birthday = { m: 0, d: 1 }; store.state.today = `${store.state.year}-01-01`; month = 1;
}

caseOf('a boarding pass, and a seat by the window or on the aisle', () => {
  life();
  const t = trip('economy');
  const bp = flight.boardingPass(t.id);
  check(bp && bp.cabin === 'economy' && bp.chooseSeat && !bp.seat && /^[A-Z]{1,2} \d{3}$/.test(bp.number) && bp.from === 'New York' && bp.to === 'Tokyo', `economy: choose a seat (${JSON.stringify(bp)})`);
  const r = flight.chooseSeat(t.id, 'aisle');
  check(r.ok && /^(2[1-9]|3\d|4[0-8])[CDGH]$/.test(t.flight.seat) && t.flight.side === 'aisle', `the aisle: an aisle letter, in economy's rows (${t.flight.seat})`);
  check(!flight.chooseSeat(t.id, 'window').ok && flight.boardingPass(t.id).seat === t.flight.seat, 'chosen once');
  const w = trip('business'); flight.chooseSeat(w.id, 'window');
  check(/^([5-9]|1[01])[AK]$/.test(w.flight.seat), `business, by the window (${w.flight.seat})`);
  const f = trip('first'); const fb = flight.boardingPass(f.id);
  check(fb.cabin === 'first' && !fb.chooseSeat && /^[12]A$/.test(fb.seat), `first class has its suite, by the window (${fb.seat})`);
  const train = trip(null, 'rail', { countryId: 'us', city: 'Chicago' });
  check(flight.boardingPass(train.id) === null && flight.flightMoment(train.id) === null, 'no boarding pass, and no moment, on a train');
});

caseOf('the moment halfway: by cabin, and by seat', () => {
  life();
  const seen = { economy: new Set(), business: new Set(), first: new Set() };
  for (const cabin of Object.keys(seen)) {
    const t = trip(cabin);
    for (let i = 0; i < 120; i++) {
      t.flight = { side: i % 2 ? 'aisle' : 'window', seat: '1A' };
      const m = flight.flightMoment(t.id);
      if (!m) continue;
      const def = FLIGHT_MOMENT_BY_ID[m.id];
      seen[cabin].add(m.id);
      check(def.cabin.includes(cabin), `${m.id} only in its cabins (${cabin})`);
      check(!def.seat || def.seat === t.flight.side, `${m.id} only at its seat (${t.flight.side})`);
      check(!/\{to\}|\{from\}/.test(m.text + m.choices.join('')), 'the cities are filled in');
    }
  }
  check(seen.first.size >= 3 && seen.business.size >= 3 && seen.economy.size >= 6, `each cabin has its own moments (${Object.entries(seen).map(([k, v]) => `${k} ${v.size}`).join(', ')})`);
  check([...seen.first].every((id) => FLIGHT_MOMENT_BY_ID[id].cabin.includes('first')), 'first class never gets an economy moment');
});

caseOf('what a moment changes: a contact, work, a voucher, rest; and only once', () => {
  life();
  const p = P();
  const a = trip('economy'); a.flight = { decided: true, moment: 'eco_snacks', side: 'window', seat: '30A' };
  const people = p.npcIds.length;
  const r = flight.chooseFlightMoment(a.id, 0);
  const met = store.state.npcs[r.contact];
  check(r.ok && met && p.npcIds.length === people + 1 && /Met on a flight to Tokyo/.test(met.flags.title) && r.changes.some((c) => c.label === 'Mood' && c.delta > 0), `a new friend from the flight (${r.text})`);
  check(!flight.chooseFlightMoment(a.id, 1).ok && flight.flightMoment(a.id) === null, 'answered once');
  p.career = { careerId: 'software', title: 'Engineer', performance: 50, level: 1, retired: false };
  const b = trip('business'); b.flight = { decided: true, moment: 'biz_work', side: 'aisle', seat: '6C' };
  flight.chooseFlightMoment(b.id, 0);
  check(p.career.performance === 54, `work done in the air counts at work (${p.career.performance})`);
  const c = trip('economy'); c.flight = { decided: true, moment: 'eco_overbooked', side: 'aisle', seat: '40C' };
  const cash = p.finance.cash;
  const v = flight.chooseFlightMoment(c.id, 0);
  check(p.finance.cash > cash && v.changes.some((x) => x.money), 'a voucher for giving up a seat');
  const d = trip('first'); d.flight = { decided: true, moment: 'first_bed', side: 'window', seat: '1A' };
  const h = p.stats.health;
  const s = flight.chooseFlightMoment(d.id, 0);
  check(p.stats.health > h && /arrive rested/.test(s.text) && d.flight.arrive === 'rested', `first class: a real bed, and arriving rested (${s.text})`);
  check(d.notes.some((n) => /bed|rested|Eight hours/.test(n)), 'and it is part of the trip');
});

for (const name of ok) console.log(`${name.startsWith('(failed)') ? 'FAIL' : 'ok  '} ${name.replace(/^\(failed\) /, '')}`);
if (problems.length) { console.log(problems.map((x) => `  ✗ ${x}`).join('\n')); process.exit(1); }
console.log('The flight: a boarding pass, a seat, and what can happen in the air.');
