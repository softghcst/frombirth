// Asking your family to pay for a trip: open while you live with them, at any age; the answer is never a sure thing.
// Run with: node tests/family-pays.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { ensureLife } = await import('../js/engine/npcLives.js');
const { spendable } = await import('../js/engine/npcMoney.js');
const travel = await import('../js/engine/travel.js');

rng.seed(20261124);
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); else console.log(` ✓ ${m}`); };

/** A life at this age, living at home, with one parent of the given closeness, generosity and savings. */
function setup(age, o = {}) {
  let s; do { s = createLife({ countryId: 'us', city: 'New York' }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  p.age = age; p.birthYear = s.year - age; p.flags.livesWithParents = o.home ?? true; p.homeId = null;
  p.finance.cash = o.cash ?? 0; p.legal.incarceration = null;
  for (const id of [...p.npcIds]) if (['parent', 'guardian', 'grandparent'].includes(s.npcs[id]?.role)) s.npcs[id].alive = false;
  const mom = makeNpc({ role: 'parent', countryId: 'us', age: age + 30, relationship: o.rel ?? 90, gender: 'female' });
  s.npcs[mom.id] = mom; p.npcIds.push(mom.id);
  ensureLife(mom); mom.life ??= {}; mom.life.savings = o.savings ?? 200000; if (mom.life.fin?.bank) mom.life.fin.bank.bal = 0;
  mom.meters.generosity = o.giving ?? 80; mom.meters.relationship = o.rel ?? 90;
  return { p, mom };
}
/** A week in Chicago by train, planned and not yet booked. */
function plan(withMom) {
  const t = travel.startPlan('vacation');
  const y = store.state.year;
  travel.updatePlan(t.id, { destination: { countryId: 'us', city: 'Chicago' }, depart: `${y}-06-02`, ret: `${y}-06-09`, mode: 'rail', stay: 'hotel' });
  if (withMom) t.travelers.push({ id: withMom.id, status: 'accepted', pays: 'organizer' });
  return t;
}

// 1. Who can ask.
{
  const { p } = setup(12);
  const opts = travel.paymentOptions().map((o) => o.id);
  check(opts[0] === 'family' && opts.includes('organizer') && !opts.includes('split'), `a child asks or pays it themselves (${opts})`);
  check(travel.startPlan('vacation').payment === 'family', 'a child\'s plan starts with asking');
  setup(19);
  check(travel.paymentOptions().map((o) => o.id).join() === 'family,organizer,split,separate', 'at 19 and still at home: you can still ask, or pay your way');
  setup(19, { home: false });
  check(!travel.familyPayer() && !travel.paymentOptions().some((o) => o.id === 'family'), 'moved out: nobody to ask');
  void p;
}

// 2. A plan waits for an answer; a yes pays its part out of the family's money, a no leaves it to you.
{
  const { p, mom } = setup(15, { cash: 0 });
  const t = plan(mom);
  check(travel.problems(t).some((x) => /Ask your mom first/.test(x)), 'nothing is booked before asking');
  let r = null; let tries = 0;
  // Ask on fresh plans until she says yes to something (she may say no: that is the point).
  for (let tt = t; tries < 30; tries++) {
    r = travel.askFamily(tt.id);
    if (r.ok) { r.trip = tt; break; }
    tt = plan(mom);
  }
  check(r?.ok, `a close, generous mom says yes to something within a few asks (${tries + 1})`);
  const again = travel.askFamily(r.trip.id);
  check(again.text === r.text, 'one ask per plan: asking again gets the same answer');
  const q = travel.quote(r.trip);
  check(q.family > 0 && q.family + q.organizer === q.total - q.employer, `her part and yours add up to the trip (${q.family} + ${q.organizer} = ${q.total})`);
  p.finance.cash = q.organizer;
  const before = spendable(mom);
  const b = travel.confirm(r.trip.id);
  check(b.ok, `booked (${b.text})`);
  check(Math.abs(before - spendable(mom) - q.family) <= 3, `her savings pay her part (${before} → ${spendable(mom)}, part ${q.family})`);
  check(p.finance.cash === 0, 'and your own money pays yours');
  check(!/\d+%/.test(r.text), `the answer is in words, with no percentage (${r.text})`);
}

// 3. Never a sure thing, and not the same thing each time: closeness, money and coming along help, but a yes is not automatic.
{
  const tally = (o, withMom) => {
    const out = { 0: 0, 0.25: 0, 0.5: 0, 1: 0 };
    for (let i = 0; i < 120; i++) {
      const { mom } = setup(o.age ?? 14, o);
      const t = plan(withMom ? mom : null);
      travel.askFamily(t.id);
      out[t.familyAnswer.share]++;
    }
    return out;
  };
  const close = tally({ rel: 95, giving: 85, savings: 500000 });
  const along = tally({ rel: 95, giving: 85, savings: 500000 }, true);
  const cold = tally({ rel: 20, giving: 25, savings: 500000 });
  const broke = tally({ rel: 95, giving: 85, savings: 300 });
  const adult = tally({ age: 24, rel: 95, giving: 85, savings: 500000 });
  console.log('   answers (no / quarter / half / all):', JSON.stringify({ close, along, cold, broke, adult }));
  check(close[0] > 0 && close[1] < 120, 'even a close, comfortable family sometimes says no, and does not always pay it all');
  check(close[0.25] + close[0.5] > 0 && close[1] > 0, 'and their yes comes as all of it, half or a quarter');
  check(along[0] > 0 && along[1] >= close[1] - 10 && along[1] - close[1] < 30, 'coming along helps a little, and is still no sure thing');
  check(cold[0] > close[0] * 2, 'a cold, tight-fisted parent says no far more');
  check(broke[1] === 0 && broke[0] > 100, 'a family with no money to spare cannot pay');
  check(adult[1] < close[1], 'a grown child still at home is helped less than a young one');
}

// 4. What the trip is: a premium cabin or grand hotel, paying for friends too, a second trip this year, all make it a
// harder ask; a well-off family says yes more. A no stands until the plan is made cheaper or smaller.
{
  const { makeNpc: mk } = { makeNpc };
  const yeses = (o, tweak) => {
    let all = 0;
    for (let i = 0; i < 150; i++) {
      const { p, mom } = setup(14, { rel: 90, giving: 75, savings: 500000 });
      mom.wealth = o.wealth ?? 50;
      if (o.paid) p.flags.familyPaidTrips = { [store.state.year]: o.paid };
      const t = plan(null);
      tweak?.(t, p);
      travel.askFamily(t.id);
      all += t.familyAnswer.share === 1 ? 1 : 0;
    }
    return all;
  };
  const plain = yeses({});
  const grand = yeses({}, (t) => travel.updatePlan(t.id, { stay: 'luxury' }));
  const friends = yeses({}, (t, p) => {
    for (let k = 0; k < 2; k++) { const f = mk({ role: 'friend', countryId: 'us', age: 14 }); store.state.npcs[f.id] = f; p.npcIds.push(f.id); t.travelers.push({ id: f.id, status: 'accepted', pays: 'organizer' }); }
  });
  const again = yeses({ paid: 1 });
  const rich = yeses({ wealth: 95 });
  console.log('   whole-trip yeses of 150:', JSON.stringify({ plain, grand, friends, again, rich }));
  check(grand < plain, 'a grand hotel is a harder ask');
  check(friends < plain, 'paying for friends too is a harder ask');
  check(again < plain, 'a second trip this year is a harder ask');
  check(rich > plain, 'a well-off family says yes more');

  // A no stands for the same plan; making it cheaper lets you ask again.
  let t = null, tries = 0;
  for (; tries < 60; tries++) {
    setup(14, { rel: 40, giving: 30, savings: 500000 });
    t = plan(null);
    travel.updatePlan(t.id, { stay: 'luxury' });
    if (!travel.askFamily(t.id).ok) break;
  }
  const no = t.familyAnswer.text;
  check(travel.askFamily(t.id).text.startsWith(no) && /cheaper or smaller/.test(travel.askFamily(t.id).text), 'a no stands for the same plan, with a hint');
  travel.updatePlan(t.id, { stay: 'hostel' });
  travel.askFamily(t.id);
  check(!travel.askFamily(t.id).text.includes('cheaper or smaller') || t.familyAnswer.text !== no, 'made cheaper, it can be asked again');
  // A yes lapses if the plan grows: dearer than asked, it has to be asked again.
  for (tries = 0; tries < 60; tries++) {
    setup(14, { rel: 95, giving: 90, savings: 900000 });
    t = plan(null);
    if (travel.askFamily(t.id).ok) break;
  }
  travel.updatePlan(t.id, { stay: 'luxury' });
  check(travel.problems(t).some((x) => /grown since you asked/.test(x)) && travel.quote(t).family === 0, 'a plan made dearer after a yes has to be asked again');
}

if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log('Asking the family to pay holds.');
