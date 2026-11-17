// Travel, Immigration & Living Abroad: the Global Life engine, end to end.
// Run with: node tests/global-life.mjs
//
// Covers the brief's checklists (travel, immigration, family and generations,
// education, work and money) and its three required vertical slices: a trip
// abroad booked, taken and reloaded; a lawful relocation; and an international
// family carried into the next generation.
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { COUNTRIES } = await import('../js/data/countries.js');
const { CAREERS } = await import('../js/data/careers.js');
const { ROOTS } = await import('../js/data/economy.js');
const { hire } = await import('../js/engine/career.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { newborn } = await import('../js/engine/children.js');
const { continueAs, heirs } = await import('../js/engine/legacy.js');
const { saveGame, loadGame } = await import('../js/save.js');
const geo = await import('../js/engine/geo.js');
const docs = await import('../js/engine/documents.js');
const travel = await import('../js/engine/travel.js');
const reloc = await import('../js/engine/relocation.js');
const chron = await import('../js/engine/chronicle.js');
const story = await import('../js/engine/globalStory.js');
const gl = await import('../js/engine/globalLife.js');
const cit = await import('../js/engine/citizenship.js');
const imm = await import('../js/engine/immigration.js');
const move = await import('../js/engine/emigration.js');

rng.seed(Number(process.env.SEED ?? 20261117));
ROOTS.parentFromAbroad = 0;
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); else ok.push(`(after problems) ${msg}`); };
const life = (countryId, age = 30, cash = 80000, city) => {
  do { store.state = createLife({ countryId }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year; store.state.year += age;
  if (city) p.city = city;
  p.birthCity = p.city;
  p.finance.cash = Math.round(cash * COUNTRIES[countryId].currency.scale);
  p.flags.livesWithParents = age < 18; p.education.enrolled = false; p.legal.record = []; p.legal.pending = null;
  p.education.degrees = age >= 18 ? [{ type: 'high', gpa: 3.2, age: 18 }] : [];
  for (const n of Object.values(store.state.npcs)) if (n.role === 'spouse' || n.role === 'partner') n.role = 'ex';
  return p;
};
const year = (n = 1) => { for (let i = 0; i < n; i++) { advanceYear(); store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.stats.health = 95; p.alive = true; } };
const add = (role, countryId, age, rel = 95) => {
  const n = makeNpc({ role, countryId, age }); n.meters.relationship = rel; n.meters.health = 90; n.savings = 1e7; if (n.life) n.life.savings = 1e7;
  store.state.npcs[n.id] = n; store.state.player.npcIds.push(n.id); return n;
};
const reload = () => { const id = store.state.slotId; check(saveGame(store.state), 'the life saves'); store.state = loadGame(id); return store.state.player; };
const cash = () => store.state.player.finance.cash;

// ---------- Geography ----------
{
  const tk = geo.coords('jp', 'Tokyo'); const ld = geo.coords('uk', 'London');
  check(tk && !tk.approx && Math.abs(tk.lat - 35.69) < 0.1, 'Tokyo is where GeoNames says');
  const d = geo.distanceKm({ countryId: 'jp', city: 'Tokyo' }, { countryId: 'uk', city: 'London' });
  check(d > 9400 && d < 9700, `Tokyo to London is about 9,560 km (got ${d})`);
  check(geo.overland('fr', 'de', 2026) && !geo.overland('fr', 'us', 2026) && !geo.overland('uk', 'fr', 1990) && geo.overland('uk', 'fr', 1995), 'overland travel follows landmasses and the Channel Tunnel');
  check(geo.jurisdictionAt('de', 1980, 'Leipzig').name.startsWith('East Germany') && geo.jurisdictionAt('de', 1980, 'Munich').name.startsWith('West Germany') && !geo.jurisdictionAt('de', 2000).historical, 'Germany in 1980 depends on the city; in 2000 it is Germany');
  check(geo.jurisdictionAt('hr', 1985).name === 'Yugoslavia' && geo.jurisdictionAt('hk', 1990).historical && !geo.jurisdictionAt('hk', 2000).historical, 'Croatia was Yugoslavia, Hong Kong was British, by year');
  // A flight across the date line lands on the date it is there.
  const t = geo.instantAt('2026-03-10', '10:00', 'au');
  const there = geo.localTime(t + 13 * 3600e3, 'us');
  check(there.date === '2026-03-09' || there.date === '2026-03-10', `Sydney 10:00 + 13 hours lands on 9 or 10 March in New York (${there.date} ${there.time})`);
  check(geo.season('au', 7) === 'winter' && geo.season('uk', 7) === 'summer', 'July is winter in Australia');
  section('geography: GeoNames positions, distances, landmasses, time zones, seasons, jurisdictions by year');
}

// ---------- Passports and borders ----------
let p = life('us', 30, 80000, 'New York');
{
  check(!docs.validPassport(p), 'a new adult has no passport until they apply');
  check(!docs.applyPassport(p.id, 'jp').ok, 'no passport from a country one is not a citizen of');
  const r = docs.applyPassport(p.id, 'us');
  check(r.ok && docs.validPassport(p)?.issuer === 'us', 'a citizen gets their passport');
  const ledger = p.finance.ledger.filter((x) => x.kind === 'passport_fee');
  check(ledger.length === 1, 'the fee is written down once');
  check(!docs.applyPassport(p.id, 'us').ok, 'a valid passport is not issued twice');
  check(docs.entryRule(p, 'jp').kind === 'visa_free' && docs.entryRule(p, 'uk').kind === 'eta' && docs.entryRule(p, 'us').kind === 'right', 'an American: Japan visa-free, the UK an ETA, home as of right');
  const fr = life('fr'); check(docs.entryRule(fr, 'de').kind === 'free_movement', 'French to Germany: free movement');
  const ind = life('in'); check(docs.entryRule(ind, 'uk').kind === 'visa' && docs.entryRule(ind, 'uk').name === 'Standard Visitor visa', 'Indian to the UK: a visitor visa, by its own name');
  store.state = { ...store.state }; // keep going with the American
  store.state = createLife({ countryId: 'us' });
  p = life('us', 30, 80000, 'New York');
  docs.applyPassport(p.id, 'us');
  // A passport expiring does not touch citizenship.
  const d = docs.validPassport(p);
  d.expiresOn = `${store.state.year}-01-01`;
  year();
  check(d.status === 'expired' && cit.held(p).includes('us'), 'an expired passport leaves citizenship as it was');
  check(docs.applyPassport(p.id, 'us').ok, 'and a new one can be applied for');
  const lost = docs.validPassport(p);
  check(docs.reportLost(p.id, lost.id).ok && lost.status === 'lost' && !docs.validPassport(p) && cit.held(p).includes('us'), 'a lost passport is unusable; citizenship stays');
  check(docs.applyPassport(p.id, 'us').ok, 'and is replaced');
  section('passports: issued only to nationals, once, expiring and lost without touching citizenship');
}
{
  // Schengen counts days over 180, wherever in the area they were spent.
  const t0 = `${store.state.year}-02-01`;
  docs.addStay(p, 'fr', t0, docs.addDays(t0, 59), 'x');
  const r = docs.readiness(p, 'de', 'visit', docs.addDays(t0, 70), docs.addDays(t0, 109));
  check(!r.ok && r.problems.some((x) => /180 days/.test(x)), 'sixty days in France and forty in Germany within 180 days is too many');
  const r2 = docs.readiness(p, 'de', 'visit', docs.addDays(t0, 70), docs.addDays(t0, 89));
  check(r2.ok, 'twenty days is within the limit');
  check(!docs.readiness(p, 'uk', 'visit', `${store.state.year}-06-01`, `${store.state.year}-06-10`).ok, 'the UK needs an ETA first');
  let a = docs.applyEntry(p.id, 'uk', { from: `${store.state.year}-06-01`, to: `${store.state.year}-06-10`, purpose: 'visit' });
  for (let i = 0; i < 4 && a.app?.status === 'refused'; i++) { year(); a = docs.applyEntry(p.id, 'uk', { from: `${store.state.year}-06-01`, to: `${store.state.year}-06-10`, purpose: 'visit' }); }
  check(a.app && ['approved', 'refused'].includes(a.app.status), `an ETA is decided at once (${a.text})`);
  if (!a.app) a.app = {};
  check(a.app.status === 'approved', 'an ETA is granted, in the end');
  {
    const auth = docs.authorizationFor(p, 'uk', 'visit', `${store.state.year}-06-01`, `${store.state.year}-06-10`);
    check(auth && !auth.permitted.includes('work') && !auth.permitted.includes('study'), 'a visitor is not permitted to work');
  }
  section('borders: free movement, ETAs, visas by name, a rolling 90-in-180 count, no work for visitors');
}
{
  // A visitor visa: pending is not approval; decided when the year turns; the decision is kept.
  const ind = life('in', 35, 80000);
  docs.applyPassport(ind.id, 'in');
  const y = store.state.year + 1;
  const r = docs.applyEntry(ind.id, 'uk', { from: `${y}-05-01`, to: `${y}-05-14`, purpose: 'visit', cost: 1000 });
  check(r.ok && r.app.status === 'submitted' && !docs.authorizationFor(ind, 'uk', 'visit', `${y}-05-01`, `${y}-05-14`), 'submitted is not approved');
  check(!docs.applyEntry(ind.id, 'uk', { from: `${y}-05-01`, to: `${y}-05-14`, purpose: 'visit' }).ok, 'one application at a time');
  year();
  const app = ind.applications.find((a) => a.id === r.app.id);
  check(['approved', 'refused'].includes(app.status) && app.decision?.year === store.state.year, 'decided when the year turned');
  const before = JSON.stringify(app);
  const back = reload();
  const again = back.applications.find((a) => a.id === r.app.id);
  check(JSON.stringify(again) === before, 'the decision survives a reload unchanged');
  year();
  check(back.applications.find((a) => a.id === r.app.id).decision.year === app.decision.year, 'and is never made again');
  if (again.status === 'refused') {
    check(docs.requestReview(again.id).ok && !docs.requestReview(again.id).ok, 'a refusal can be reviewed once');
  }
  section('applications: pending is not approval, the decision is made once at the turn of the year and survives a reload');
}

// ---------- Vertical slice 1: a trip abroad ----------
{
  p = life('us', 34, 90000, 'New York');
  const sp = add('spouse', 'us', 33); sp.marriedAtAge = 30;
  docs.applyPassport(p.id, 'us');
  const plan = travel.startPlan('vacation');
  check(plan.status === 'draft' && !p.finance.ledger.some((x) => x.ref?.tripId === plan.id), 'opening the planner costs nothing');
  travel.updatePlan(plan.id, { destination: { countryId: 'jp', city: 'Kyoto' } });
  const y = store.state.year;
  travel.updatePlan(plan.id, { depart: `${y}-04-02`, ret: `${y}-04-14` });
  check(travel.problems(plan).some((x) => /how to travel/i.test(x)), 'it asks how to travel');
  const modes = travel.modesFor(plan.origin, plan.destination, y).map((m) => m.id);
  check(modes.includes('jet') && !modes.includes('rail') && !modes.includes('car') && !modes.includes('coach_horse'), `New York to Kyoto in ${y}: by air or sea, not overland (${modes})`);
  const inv = travel.invite(plan.id, sp.id);
  check(plan.travelers.find((x) => x.id === sp.id)?.status === (inv.ok ? 'accepted' : 'declined'), 'the answer is stored');
  check(travel.invite(plan.id, sp.id).ok === inv.ok, 'and asking again gets the same answer');
  if (!inv.ok) { plan.travelers.find((x) => x.id === sp.id).status = 'accepted'; docs.ensureOwnPassport(sp, plan.depart, plan.ret); }
  travel.updatePlan(plan.id, { mode: 'jet', cabin: 'economy', stay: 'hotel', activities: ['landmark', 'food', 'museum'] });
  const ent = travel.entryCheck(plan);
  check(ent.length === 2 && ent.every((x) => x.rule.kind === 'visa_free'), 'both travellers: no visa needed for Japan');
  const j = travel.journey(plan.origin, plan.destination, travel.tripById(plan.id) && (await import('../js/data/travel.js')).MODE_BY_ID.jet, plan.depart);
  check(j.legs.length >= 1 && j.hours > 12 && j.hours < 20 && j.legs[j.legs.length - 1].arrive.date >= plan.depart, `the flight takes ${j.hours} hours and arrives on ${j.arriveDate} local time`);
  check(travel.problems(plan).length === 0, `the plan is complete (${travel.problems(plan)})`);
  const q = travel.quote(plan);
  const before = cash();
  const c = travel.confirm(plan.id);
  check(c.ok && plan.status === 'confirmed', 'booked');
  check(before - cash() === q.organizer, `paid exactly the quote (${before - cash()} vs ${q.organizer})`);
  const n = p.finance.ledger.filter((x) => x.ref?.tripId === plan.id).length;
  check(!travel.confirm(plan.id).ok && p.finance.ledger.filter((x) => x.ref?.tripId === plan.id).length === n, 'confirming again charges nothing');
  const d = travel.depart(plan.id);
  check(d.ok && travel.whereabouts().away && travel.whereabouts().countryId === 'jp' && p.countryId === 'us' && p.city === 'New York', 'away in Japan; still living in New York');
  const act = travel.doActivity(plan.id, 'tour');
  check(act.ok, 'something unplanned, paid on the spot');
  check(!travel.doActivity(plan.id, 'tour').ok, 'not twice');
  const h = travel.comeHome(plan.id);
  check(h.ok && plan.status === 'completed' && !travel.whereabouts().away && p.countryId === 'us' && p.city === 'New York', 'home again; the residence never changed');
  check(chron.hasEvent(`trip:${plan.id}`) && chron.hasEvent(`first-abroad:${chron.archiveIdOf(p)}`), 'the trip and the first trip abroad are recorded once');
  check(sp.memories.some((m) => m.key === `trip_${plan.id}`), 'the spouse remembers it');
  check(p.stays.some((s) => s.tripId === plan.id && s.countryId === 'jp') && sp.stays?.some((s) => s.tripId === plan.id), 'days in Japan are counted for both');
  const card = travel.tripCard(plan);
  check(card.travelers.some((x) => x.id === sp.id && x.relation) && card.memories.length >= 1 && card.spent > 0, 'the journal card has the travellers, the memories and the money');
  const spent = cash();
  const events = store.state.canon.events.length;
  p = reload();
  const again = travel.tripById(plan.id);
  check(again?.status === 'completed' && again.travelers.length === 2 && store.state.npcs[sp.id]?.memories.length, 'reloaded: the trip, the companion, the memories');
  check(!travel.comeHome(plan.id).ok && !travel.confirm(plan.id).ok, 'a completed trip cannot be completed or booked again');
  check(cash() === spent && store.state.canon.events.length === events, 'no money or memory moved on reload');
  year(2);
  check(p.finance.ledger.filter((x) => x.ref?.tripId === plan.id && x.amount < 0).length === n + 1, 'later years never charge for it again');
  check(docs.validPassport(p) && store.state.npcs[sp.id].documents.length === 1, 'documents survive');
  section('slice 1: a trip to Kyoto planned, booked once, taken, remembered, reloaded, never charged again');
}

// ---------- More travel ----------
{
  p = life('fr', 40, 90000, 'Paris');
  const y = store.state.year;
  // Cancelling: what comes back depends on the terms and the date.
  const t = travel.startPlan('getaway');
  travel.updatePlan(t.id, { destination: { countryId: 'fr', city: 'Lyon' }, depart: `${y}-06-05`, ret: `${y}-06-08`, mode: 'rail', stay: 'hotel', activities: ['museum'] });
  check(travel.problems(t).length === 0, `a domestic weekend needs no passport (${travel.problems(t)})`);
  const before = cash();
  travel.confirm(t.id);
  const paid = before - cash();
  const r = travel.cancel(t.id);
  check(r.ok && r.refunded > 0 && r.refunded < paid && t.status === 'cancelled', `cancelling early returns most, not all (${r.refunded} of ${paid})`);
  check(!travel.cancel(t.id).ok, 'and only once');
  // Dates.
  const bad = travel.startPlan('vacation');
  travel.updatePlan(bad.id, { destination: { countryId: 'fr', city: 'Nantes' }, depart: `${y - 1}-06-05`, ret: `${y - 1}-06-08` });
  check(travel.problems(bad).some((x) => /passed/.test(x)), 'no travel into the past');
  travel.updatePlan(bad.id, { depart: `${y}-06-05`, ret: `${y}-06-01` });
  check(travel.problems(bad).some((x) => /after the departure/.test(x)), 'no negative trips');
  travel.updatePlan(bad.id, { depart: `${y}-12-28`, ret: `${y + 1}-01-03` });
  check(travel.problems(bad).some((x) => /new year/.test(x)), 'a trip ends in the year it starts');
  travel.updatePlan(bad.id, { depart: `${y}-06-10`, ret: `${y}-06-12` });
  const clash = travel.startPlan('getaway');
  travel.updatePlan(clash.id, { destination: { countryId: 'fr', city: 'Lille' }, depart: `${y}-06-11`, ret: `${y}-06-13`, mode: 'rail', stay: 'hotel' });
  travel.updatePlan(bad.id, { mode: 'rail', stay: 'hotel' });
  travel.confirm(bad.id);
  check(travel.problems(clash).some((x) => /clashes/.test(x)), 'overlapping trips are refused');
  travel.discardPlan(clash.id);
  // Kinds of trip need what they say.
  check(/job/.test(travel.typeBlock('business')) && /wedding/.test(travel.typeBlock('honeymoon')) && /enrolled/.test(travel.typeBlock('semester')), 'business, honeymoon and semester trips need a job, a wedding, a place at university');
  // Historical travel: 1800 has no aircraft, cars or railways, and no passports.
  const from = { countryId: 'uk', city: 'London' }; const to = { countryId: 'fr', city: 'Paris' };
  const m1800 = travel.modesFor(from, to, 1800).map((m) => m.id);
  check(!m1800.includes('jet') && !m1800.includes('rail') && !m1800.includes('car') && m1800.includes('sail'), `London to Paris in 1800: by sea (${m1800})`);
  check(travel.modesFor(from, to, 1800).every((m) => m.from <= 1800), 'only what existed then');
  check(docs.entryRule(p, 'uk', 'visit', 1800).kind === 'none' && docs.entryRule(p, 'uk', 'visit', 1930).kind === 'visa', 'no papers in 1800; visas between the wars');
  const m1950 = travel.modesFor({ countryId: 'us', city: 'New York' }, { countryId: 'uk', city: 'London' }, 1950).map((m) => m.id);
  check(m1950.includes('steamship') && m1950.includes('prop_air') && !m1950.includes('jet'), `New York to London in 1950: liner or propeller plane (${m1950})`);
  // A slow journey takes days, and a pre-war propeller flight stops on the way.
  const slow = travel.journey(from, { countryId: 'it', city: 'Rome' }, (await import('../js/data/travel.js')).MODE_BY_ID.coach_horse, '1800-05-01');
  check(slow.hours > 72, `a stagecoach from London to Rome takes days (${Math.round(slow.hours / 24)})`);
  // A long modern flight changes planes.
  const far = travel.journey({ countryId: 'ar', city: 'Buenos Aires' }, { countryId: 'jp', city: 'Tokyo' }, (await import('../js/data/travel.js')).MODE_BY_ID.jet, `${y}-03-01`);
  check(far.legs.length === 2, `Buenos Aires to Tokyo changes planes (${far.legs.map((l) => l.to.city).join(' > ')})`);
  section('travel: refunds by terms, dates checked, clashes refused, trip kinds need real reasons, 1800 and 1950 travel by what existed');
}
{
  // Companions decide; a child goes with a parent; a minor needs a parent.
  p = life('uk', 38, 90000, 'London');
  docs.applyPassport(p.id, 'uk');
  const kid = add('child', 'uk', 9); kid.parentIds = [];
  const friend = add('friend', 'uk', 38, 20);
  const t = travel.startPlan('family_holiday');
  travel.updatePlan(t.id, { destination: { countryId: 'es', city: 'Valencia' }, depart: `${store.state.year}-07-01`, ret: `${store.state.year}-07-10`, mode: 'jet', stay: 'rental', activities: ['beach'] });
  check(travel.invite(t.id, kid.id).ok, 'your own child comes: it is your decision');
  travel.invite(t.id, friend.id);
  check(t.travelers.find((x) => x.id === friend.id).reason.length > 0, 'a friend gives their answer and a reason');
  check(travel.problems(t).some((x) => /passport/.test(x)), 'the child needs a passport');
  check(docs.passportQuote(kid, 'uk').possible && docs.passportQuote(kid, 'uk').years === 5, 'a parent applies for the child: a five-year passport');
  docs.applyPassport(kid.id, 'uk');
  check(travel.problems(t).length === 0 || travel.problems(t).every((x) => /friend|money/.test(x)), `then it can be booked (${travel.problems(t)})`);
  const young = life('uk', 13, 100, 'London');
  const tt = travel.startPlan('vacation');
  travel.updatePlan(tt.id, { destination: { countryId: 'fr', city: 'Paris' }, depart: `${store.state.year}-08-01`, ret: `${store.state.year}-08-05`, mode: 'rail', stay: 'hotel' });
  check(travel.problems(tt).some((x) => /parent/.test(x)), 'a thirteen-year-old does not go abroad alone');
  section('companions: everyone decides for themselves; children travel with a parent and their own passport');
}

// ---------- Vertical slice 2: a lawful move ----------
let moved;
{
  p = life('mx', 29, 120000, 'Guadalajara');
  p.education.degrees.push({ type: 'university', majorId: 'business', gpa: 3.5, age: 22 });
  hire(CAREERS.find((c) => c.id === 'office'), 1, 60);
  docs.applyPassport(p.id, 'mx');
  const friend = add('friend', 'mx', 29, 85);
  const mum = p.npcIds.map((id) => store.state.npcs[id]).find((n) => n.role === 'parent');
  const dog = add('pet', 'mx', 3, 90); dog.species = 'dog'; dog.firstName = 'Biscuit';
  const home = { id: 'asset_home_gdl', kind: 'property', catalogId: 'condo', name: 'Two-bedroom condo', purchasePrice: 100000, value: 100000, boughtAtAge: 26, condition: 80, quality: 1, mortgage: null, tenant: null, countryId: 'mx', city: 'Guadalajara' };
  p.assets.push(home); p.homeId = home.id;
  const routes = imm.routes('ca');
  const work = routes.find((r) => r.id === 'work');
  check(work.eligible && !routes.find((r) => r.id === 'right'), 'a Mexican graduate may apply for a sponsored job in Canada; Canada is not theirs as of right');
  let app;
  for (let i = 0; i < 8; i++) {
    const r = reloc.applyToMove('ca', 'work', 'Toronto');
    if (r.ok) app = r.app;
    check(!r.ok || app.status === 'submitted', 'a submitted case is pending, not approved');
    check(!r.ok || reloc.checklist(app.id).find((s) => s.id === 'decision').done === false, `the checklist does not mark a decision that has not been made (${app.status}, ${JSON.stringify(reloc.checklist(app.id).find((s) => s.id === 'decision'))})`);
    year();
    if (app.status === 'approved') break;
    p.flags.visaAge = null;
  }
  check(app?.status === 'approved', 'eventually approved');
  check(p.countryId === 'mx' && !cit.held(p).includes('ca'), 'approval moves nobody and makes nobody a citizen');
  const steps = () => reloc.checklist(app.id).filter((s) => !s.done).map((s) => s.id);
  check(steps().includes('housing') && steps().includes('travel') && steps().includes('pets'), 'housing, the journey and the dog are still to arrange');
  check(!reloc.completeMove(app.id).ok, 'the move waits for the checklist');
  reloc.arrange(app.id, { housing: 'employer', money: 0.25, travel: 'plane', pets: Object.fromEntries(p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.role === 'pet' && n.alive).map((n) => [n.id, 'bring'])), shipVehicles: false });
  check(steps().length === 1 && steps()[0] === 'move', `every step done but the move itself (${steps()})`);
  const before = cash();
  const r = reloc.completeMove(app.id);
  check(r.ok && p.countryId === 'ca' && p.city === 'Toronto', `moved to Toronto (${r.text})`);
  check(p.finance.ledger.filter((x) => x.key === `move:${app.id}:apply`).length === 1 && p.finance.ledger.filter((x) => x.key === `move:${app.id}:grant`).length === 1 && before > cash(), 'the application fee and the rest of the visa fee, each paid once');
  check(!cit.held(p).includes('ca') && cit.held(p).includes('mx') && p.birthCountryId === 'mx', 'still Mexican, born in Mexico, not Canadian');
  check(p.residency.status === 'worker' && p.residency.workAuthorized && p.career.careerId, 'a work visa, with the job that sponsored it');
  check(p.locations.length >= 2 && p.locations[p.locations.length - 2].countryId === 'mx' && p.locations[p.locations.length - 2].to === store.state.year && p.locations[p.locations.length - 2].homes.includes(home.id), 'Guadalajara stays in the record, with the flat');
  check(p.assets.some((a) => a.id === home.id), 'the flat is still owned');
  check(friend.alive && p.npcIds.includes(friend.id) && friend.flags.abroad === 'mx', 'the friend in Mexico is still a friend, in Mexico');
  check(!mum || (p.npcIds.includes(mum.id) && mum.flags.abroad === 'mx'), 'and so is mum');
  check(!dog.flags.abroad && store.state.npcs[dog.id] === dog, `the dog came, the same dog (${dog.flags.abroad}, ${dog.alive}, ${dog.role})`);
  const moves = store.state.canon.events.filter((e) => e.type === 'relocation' && e.international);
  check(moves.length === 1 && p.locations[p.locations.length - 1].eventId === moves[0].id, 'one relocation event, linked from the residence record');
  check(!reloc.completeMove(app.id).ok, 'a case is used once');
  p = reload();
  check(p.countryId === 'ca' && !cit.held(p).includes('ca') && p.residency.status === 'worker' && store.state.canon.events.filter((e) => e.type === 'relocation' && e.international).length === 1, 'reloaded: the same status, still not a citizen, still one move');
  // Every view shows the same move.
  const lived = story.placesLived();
  check(lived.length >= 2 && lived[lived.length - 1].move?.id === moves[0].id, 'Places I\'ve Lived shows it');
  const gs = story.globalStory({});
  check(gs.international.some((e) => e.id === moves[0].id) && gs.lines.length >= 1 && gs.markers.some((m) => m.city === 'Toronto'), 'Our Global Story shows it, with a line along the move and a marker in Toronto');
  const hc = story.homeChronicle(home.id);
  check(hc && hc.residents.some((x) => x.id === chron.archiveIdOf(p)) && hc.owner === 'You' && !hc.livedInNow, 'the House Chronicle: you lived there, you own it, you do not live there now');
  moved = { slot: store.state.slotId };
  section('slice 2: Mexico to Toronto: applied, decided at the year\'s turn, arranged, moved; old life, friends, flat and dog intact; no nationality granted');
}
{
  // Permanent residence is not citizenship; naturalisation needs eligibility and a process.
  p = store.state.player;
  for (let i = 0; i < 10 && p.residency?.status === 'worker'; i++) { if (!p.career.careerId) hire(CAREERS.find((c) => c.id === 'office'), 0, 60); p.career.performance = 70; year(); }
  check(p.residency?.status === 'permanent_resident' && !cit.held(p).includes('ca'), 'permanent resident after years of work; still not a citizen');
  check(!cit.naturalisation(p).possible || cit.naturalisation(p).lived >= cit.naturalisation(p).needs, 'naturalisation only once the years are there');
  for (let i = 0; i < 8 && !cit.naturalisation(p).possible; i++) year();
  let got = false;
  for (let i = 0; i < 6 && !got; i++) { p.flags.natAge = null; p.finance.cash += 100000; got = cit.naturalise().ok; if (!got) year(); }
  check(got && cit.held(p).includes('ca') && p.birthCountryId === 'mx', 'naturalised: a Canadian born in Mexico');
  check(docs.applyPassport(p.id, 'ca').ok && docs.validPassport(p, undefined, undefined, 'ca'), 'a Canadian passport follows');
  check(cit.held(p).includes('mx') ? docs.passports(p).filter((d) => d.status === 'valid').length >= 1 : true, 'the Mexican passport is a separate document');
  section('residence and nationality: a work visa became permanent residence, and only an application made a citizen');
}
{
  // Marriage and property grant nothing by themselves.
  p = life('br', 32, 200000, 'São Paulo');
  const sp = add('spouse', 'pt', 32); sp.citizenships = [{ jurisdictionId: 'pt', acquisitionType: 'birth', acquiredAt: 1990 }];
  check(!cit.held(p).includes('pt') && !cit.rightToLive('pt', p), 'married to a Portuguese citizen: not Portuguese');
  check(imm.routes('pt').find((r) => r.id === 'family').eligible && imm.routes('pt').find((r) => r.id === 'family').chance < 1, 'the family route opens, and is still an application');
  p.assets.push({ id: 'asset_lisbon', kind: 'property', catalogId: 'house', name: 'Family house', value: 1, purchasePrice: 1, condition: 80, quality: 1, mortgage: null, tenant: null, countryId: 'pt', city: 'Lisbon' });
  check(!cit.rightToLive('pt', p) && docs.entryRule(p, 'pt').kind !== 'right' && docs.entryRule(p, 'pt').kind !== 'resident', 'owning a house in Lisbon grants no right to live there');
  section('marriage and property: neither grants citizenship or residence');
}
{
  // Retiring abroad: a status of its own, no work, no citizenship.
  p = life('uk', 63, 300000, 'Bristol');
  p.career.retired = true; p.career.pensionPerYear = Math.round(30000 * COUNTRIES.uk.currency.scale);
  const r = imm.routes('pt').find((x) => x.id === 'retire');
  check(r && !r.eligible === false, 'a British pensioner may apply to retire in Portugal');
  let app;
  for (let i = 0; i < 6 && app?.status !== 'approved'; i++) { p.flags.visaAge = null; const a = reloc.applyToMove('pt', 'retire', 'Porto'); if (a.ok) app = a.app; year(); }
  check(app?.status === 'approved', 'approved');
  reloc.arrange(app.id, { housing: 'rent', money: 0, travel: 'plane', pets: Object.fromEntries(p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.role === 'pet').map((n) => [n.id, 'bring'])) });
  docs.applyPassport(p.id, 'uk');
  const m = reloc.completeMove(app.id);
  check(m.ok && p.residency?.status === 'retiree' && !p.residency.workAuthorized && !cit.held(p).includes('pt'), `retired to Porto on a retirement visa: no work, not Portuguese (${m.text})`);
  check(cit.naturalisation(p).possible === false, 'and it is not a road to citizenship by itself');
  year(5);
  check(p.countryId === 'pt' && p.residency?.status === 'retiree', 'renewed while the pension lasts');
  section('retirement abroad: its own status, renewed, no work, no citizenship');
}

// ---------- Children born abroad, and generations ----------
{
  // Mexican parents in Japan: Japan does not give citizenship by birth; Mexico gives it by descent.
  p = life('mx', 30, 100000);
  const sp = add('spouse', 'mx', 30);
  move.emigrate('jp', { forced: true });
  const baby = newborn(sp);
  check(cit.held(baby).includes('mx') && !cit.held(baby).includes('jp') && baby.bornIn === 'jp', `born in Japan to Mexican parents: Mexican by descent, not Japanese (${cit.held(baby)})`);
  check(!(baby.authorizations ?? []).length && !(baby.documents ?? []).length, 'the baby inherits no visa and no passport');
  check(chron.hasEvent(`birth:${baby.id}`), 'the birth is recorded once, with where it happened');
  // In Canada, birth there is enough, and descent adds the parents'.
  p = life('kr', 31, 100000);
  const sp2 = add('spouse', 'es', 31); sp2.citizenships = [{ jurisdictionId: 'es', acquisitionType: 'birth', acquiredAt: 1995 }];
  move.emigrate('ca', { forced: true });
  const kid = newborn(sp2);
  const held = cit.held(kid);
  check(held.includes('ca') && held.includes('es') && kid.citizenships.find((c) => c.jurisdictionId === 'ca').acquisitionType === 'birth' && kid.citizenships.find((c) => c.jurisdictionId === 'es').acquisitionType === 'descent', `a child born in Canada to Korean and Spanish parents: Canadian by birth, Spanish by descent (${held})`);
  check(held.includes('kr') === cit.held(p).includes('kr'), 'Korean by descent only through a parent who holds it');
  // Two passports, two documents.
  for (const j of held) docs.applyPassport(kid.id, j);
  check(docs.passports(kid).filter((d) => d.status === 'valid').length === held.length, 'one passport per nationality, each its own document');
  section('births abroad: nationality by the place\'s law and the parents\', never automatically all of it; no visas inherited');
}
{
  // A child at home with a parent who grew up speaking another language.
  p = life('us', 2, 0, 'Seattle');
  const mum = p.npcIds.map((id) => store.state.npcs[id]).find((n) => n.role === 'parent');
  mum.bornIn = 'kr'; mum.flags.abroad = false;
  year(8);
  check((p.skills.korean ?? 0) > 0 && (p.skills.korean ?? 0) < 90, `a child picks up Korean at home, at their own pace, short of fluency (${p.skills.korean})`);
  check((p.languageLog ?? []).some((x) => x.lang === 'korean' && /at home/.test(x.source)), 'and where it came from is kept');
  section('multilingual families: a parent\'s language picked up at home, gradually');
}
{
  // Vertical slice 3: three generations, three countries.
  p = life('kr', 27, 300000, 'Busan');
  p.education.degrees.push({ type: 'university', majorId: 'business', gpa: 3.4, age: 22 });
  const g1 = chron.archiveIdOf(p);
  let r; for (let i = 0; i < 40 && p.countryId !== 'us'; i++) { p.flags.visaAge = null; r = move.emigrate('us', { route: 'settle', city: 'Seattle' }); }
  check(p.countryId === 'us', 'the first generation moves from Busan to Seattle');
  const sp = add('spouse', 'us', 27);
  const kid = newborn(sp);
  const kidAid = chron.archiveIdOf(kid);
  check(kid.bornIn === 'us' && kid.birthCity === 'Seattle', 'their child is born in Seattle');
  year(3);
  // The family moves again; the child keeps birthplace and nationality.
  let m2; for (let i = 0; i < 40 && p.countryId !== 'ca'; i++) { p.flags.visaAge = null; m2 = move.emigrate('ca', { route: 'settle', city: 'Vancouver' }); }
  check(p.countryId === 'ca' && kid.bornIn === 'us' && cit.held(kid).includes('us'), 'they move to Vancouver; the child is still Seattle-born and American');
  year(20);
  p.stats.health = 95;
  const h = heirs().find((n) => n.id === kid.id) ?? heirs()[0];
  const founderPlaces = p.locations.map((l) => l.countryId).join('>');
  const relocations = store.state.canon.events.filter((e) => e.type === 'relocation').length;
  continueAs(h.id);
  p = store.state.player;
  check(chron.archiveIdOf(p) === kidAid && p.generation === 2, 'the heir is the same person in the family history');
  const founder = store.state.archive.people[g1];
  check(founder && founder.places.map((l) => l.countryId).join('>') === founderPlaces && founder.born.countryId === 'kr', `the founder is archived with every place they lived (${founderPlaces})`);
  check(store.state.canon.events.filter((e) => e.type === 'relocation').length === relocations, 'every move carried over, none duplicated');
  check(p.birthCountryId === 'us' && p.birthCity === 'Seattle' && cit.held(p).includes('us'), 'the heir was born in Seattle and is American');
  const gs = story.globalStory({});
  check(gs.generations.length >= 2 && gs.people.some((x) => x.id === g1 && x.kind === 'archived'), 'Our Global Story has both generations');
  check(gs.markers.some((m) => m.countryId === 'kr') && gs.markers.some((m) => m.countryId === 'us') && gs.markers.some((m) => m.countryId === 'ca'), 'Busan, Seattle and Vancouver are all on the map');
  const ph = story.personHistory(g1);
  check(ph && ph.places.length >= 3 && ph.applicationsPrivate, 'the founder\'s places are open to the family; their applications are not');
  const only1 = story.globalStory({ generation: 1 });
  check(only1.timeline.every((i) => i.person === g1 || gs.people.find((x) => x.id === i.person)?.generation === 1), 'filtering by generation shows only that generation');
  const ancestorNpc = Object.values(store.state.npcs).find((n) => n.flags.archiveId === g1);
  check(ancestorNpc && !ancestorNpc.alive && story.familyPeople().filter((x) => x.id === g1).length === 1, 'the ancestor in the family tree and in the archive is one person');
  p = reload();
  check(story.globalStory({}).people.some((x) => x.id === g1) && store.state.archive.people[g1], 'all of it survives a reload');
  year(1);
  check(store.state.archive.people[g1].places.length >= 3, 'and the next year');
  section('slice 3: Busan, Seattle, Vancouver; a child born abroad becomes the next player with the whole family geography intact');
}

// ---------- Education, work and money ----------
{
  // A semester abroad: a student visa for a stay longer than a visit, credit, and a friend who stays a friend.
  p = life('us', 20, 60000, 'Chicago');
  p.education.enrolled = true; p.education.stage = 'university';
  docs.applyPassport(p.id, 'us');
  let ran = false;
  for (let attempt = 0; attempt < 5 && !ran; attempt++) {
    const y = store.state.year + 1;
    const t = travel.startPlan('semester');
    travel.updatePlan(t.id, { destination: { countryId: 'fr', city: 'Lyon' }, depart: `${y}-02-01`, ret: `${y}-06-15`, mode: 'jet', stay: 'student' });
    check(travel.entryCheck(t)[0].rule.kind === 'study', 'four months in France to study needs a student visa');
    const app = docs.applyEntry(p.id, 'fr', { from: t.depart, to: t.ret, purpose: 'study', cost: 5000 }).app;
    check(app?.status === 'submitted' && app.kind === 'study', 'applied for; decided when the year turns');
    const degrees = p.education.degrees.length;
    year();
    p.education.enrolled = true; p.education.stage = 'university'; p.finance.cash += 20000;
    if (p.applications.find((a) => a.id === app.id).status !== 'approved') continue;
    ran = true;
    check(travel.problems(t).length === 0, `ready (${travel.problems(t)})`);
    travel.confirm(t.id);
    travel.depart(t.id);
    travel.comeHome(t.id);
    check((p.education.abroad ?? []).some((x) => x.countryId === 'fr') && p.education.degrees.length === degrees, 'credit for the term; no degree for a semester');
    const mate = Object.values(store.state.npcs).find((n) => n.flags.metAbroad === t.id);
    check(mate && mate.flags.abroad === 'fr' && p.npcIds.includes(mate.id), 'a classmate from Lyon, kept as a friend in France');
    check(travel.achievements().find((a) => a.id === 'study_abroad').year, 'Study Abroad earned');
  }
  check(ran, 'a student visa was granted within five tries');
  section('study abroad: a student visa, a term\'s credit and no more, and a classmate who persists');
}
{
  // Work: a job offer is not permission to work; visitors may not work; a work trip is paid by the employer.
  p = life('in', 30, 50000, 'Mumbai');
  hire(CAREERS.find((c) => c.id === 'office'), 1, 60);
  docs.applyPassport(p.id, 'in');
  check(docs.entryRule(p, 'us', 'business').kind === 'visa', 'a business visit to the US still needs a visa');
  const y = store.state.year;
  const t = travel.startPlan('business');
  travel.updatePlan(t.id, { destination: { countryId: 'in', city: 'Delhi' }, depart: `${y}-05-01`, ret: `${y}-05-04`, mode: 'jet', stay: 'hotel' });
  const before = cash();
  const q = travel.quote(t);
  check(q.employer > 0 && q.organizer === 0, 'the employer pays for a work trip');
  travel.confirm(t.id);
  check(cash() === before && p.finance.ledger.some((x) => x.ref?.tripId === t.id && x.payer === 'employer'), 'nothing from your own pocket; it is still written down');
  section('work: a business visit is not work, needs its own permission, and the employer pays');
}
{
  // Money: payments once, refunds once, exchange is not income.
  p = life('us', 30, 50000);
  const r1 = chron.charge({ amount: 100, kind: 'test', memo: 't', key: 'k1' });
  const r2 = chron.charge({ amount: 100, kind: 'test', memo: 't', key: 'k1' });
  check(r1.ok && !r2.ok, 'the same booking is never charged twice');
  const back = chron.refund(r1.tx.id, 0.5, 'half');
  check(back.ok && back.amount === 50 && !chron.refund(r1.tx.id, 0.5, 'again').ok, 'refunded once, by its terms');
  section('money: one charge per booking, one refund per charge');
}
{
  // An older save, with trips from before this system: nothing is invented.
  p = life('br', 40, 50000);
  delete store.state.canon; delete p.travel; delete p.documents; delete p.applications; delete p.finance.ledger; delete p.birthCity;
  p.trips = [{ countryId: 'pt', year: store.state.year - 3, age: 37, purpose: 'holiday' }];
  p.flags.visited = ['pt'];
  gl.ensureGlobal(store.state); gl.ensureGlobal(store.state);
  check(store.state.canon.events.length === 0 && !p.documents.length && !p.applications.length && !p.travel.trips.length, 'no passports, visas, trips or events are invented');
  check(travel.collection().countries.some((c) => c.id === 'pt' && c.legacy), 'the old trip is still in the collection, marked as an older record');
  section('saves: older lives migrate without invented history; migration repeats safely');
}
{
  // Two lives, two worlds.
  const a = life('jp', 30, 50000); docs.applyPassport(a.id, 'jp'); saveGame(store.state); const sa = store.state.slotId;
  const b = life('ng', 50, 50000); saveGame(store.state); const sb = store.state.slotId;
  const A = loadGame(sa); const B = loadGame(sb);
  check(A.player.documents.length === 1 && B.player.documents.length === 0 && A.canon !== B.canon, 'saved lives keep their own papers and records');
  section('isolation: separate saved lives never share papers or events');
}

if (problems.length) { console.log('PROBLEMS:'); for (const x of problems) console.log(' -', x); for (const x of ok) console.log('ok  ', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('Travel, immigration and living abroad hold.');
