// Checks home renovations: what fits which home, the space each has, contractors and how well they work, fixing and
// removing, what it does to the home's worth, mood and running costs, and that only owned homes can be renovated.
// Run with: node tests/renovations.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const estate = await import('../js/engine/realEstate.js');
const reno = await import('../js/engine/renovations.js');
const { SPACE, RENOVATION_BY_ID } = await import('../js/data/renovations.js');
const { audit, bookAction, ledgerOf } = await import('../js/engine/ledger.js');
const { saveGame, loadGame } = await import('../js/save.js');

rng.seed(4242);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };

function life(year = 2025) {
  do { store.state = createLife({ countryId: 'us' }); } while (store.state.player.royal);
  const p = store.state.player;
  store.state.year = year; p.age = 40; p.birthYear = year - 40; p.flags.livesWithParents = false;
  p.finance.cash = 50_000_000;
  ledgerOf();
  return p;
}
let n = 0;
/** A home of this kind, owned outright, worth what the market says. */
function owned(type, live = true) {
  const p = store.state.player;
  const a = { id: `asset_t${n += 1}`, kind: 'property', catalogId: type, name: `Test ${type} ${n}`, purchasePrice: 0, value: 0, boughtAtAge: p.age, condition: 80, quality: 1, mortgage: null, tenant: null, countryId: p.countryId, city: p.city };
  p.assets.push(a); estate.revalue(a); a.purchasePrice = a.value;
  if (live) p.homeId = a.id;
  return a;
}
const ids = (a) => reno.fitting(a).map((x) => x.r.id);

// ---------- 1. Only what fits ----------
let p = life(2025);
const studio = owned('studio');
check(!ids(studio).includes('home_theater') && !ids(studio).includes('pool') && !ids(studio).includes('man_cave'), 'a studio has no room for a home theater, a pool or a man cave');
check(ids(studio).includes('kitchen') && ids(studio).includes('soundproofing'), 'but a studio can have a new kitchen and soundproofing');
const condo = owned('condo');
check(!ids(condo).includes('pool') && !ids(condo).includes('garden') && ids(condo).includes('home_gym'), 'an apartment has no yard for a pool or a garden, but room for a home gym');
const house = owned('house');
check(['pool', 'home_theater', 'man_cave', 'garden', 'game_room', 'extension'].every((x) => ids(house).includes(x)), 'a family house can have a pool, a home theater, a man cave, a garden, a game room and an extension');
check(!ids(house).includes('wine_cellar') && !ids(house).includes('tennis_court'), 'a wine cellar and a tennis court are for the biggest homes');
const mansion = owned('mansion');
check(['wine_cellar', 'tennis_court', 'library', 'guest_suite'].every((x) => ids(mansion).includes(x)), 'a mansion can have them all');
check(reno.spaceOf(studio) === SPACE.studio && reno.spaceOf(condo) === SPACE.condo && reno.spaceOf(house) === SPACE.house && reno.spaceOf(mansion) === SPACE.mansion && SPACE.studio < SPACE.house && SPACE.house < SPACE.mansion, 'a bigger home holds more renovations');
store.state.year = 1930;
check(!ids(house).includes('home_theater') && !ids(house).includes('air_conditioning') && ids(house).includes('indoor_bathroom') && ids(house).includes('central_heating'), 'in 1930: no home theater or air conditioning, but an indoor bathroom and central heating');
store.state.year = 2025;
check(!ids(house).includes('indoor_bathroom'), 'and nobody adds an indoor bathroom in 2025');
section('only what would really fit a home, and of its time, is offered');

// ---------- 2. Adding: paid, done, worth less than it cost ----------
p = life(2025);
const h = owned('house');
let worthBefore = h.value; let cashBefore = p.finance.cash;
const kitchenQuote = reno.quote(h, 'kitchen', 'solid');
let r = reno.addRenovation(h.id, 'kitchen', 'solid');
check(r.ok && reno.renovationsOf(h).length === 1 && reno.renovationsOf(h)[0].by && reno.renovationsOf(h)[0].tier === 'solid', `a kitchen is added, with who did it recorded (${r.text})`);
check(cashBefore - p.finance.cash === r.cost && r.cost >= kitchenQuote, 'it is paid for, at the price quoted (more only if it ran over budget)');
check(h.value > worthBefore - 1 || r.how === 'poor', 'the home is worth more');
check(h.value - worthBefore < r.cost, 'but never by as much as it cost: a renovation is for living with');
check(!reno.addRenovation(h.id, 'kitchen', 'solid').ok, 'the same renovation cannot be added twice');
check(reno.quote(h, 'pool', 'budget') < reno.quote(h, 'pool', 'solid') && reno.quote(h, 'pool', 'solid') < reno.quote(h, 'pool', 'premium'), 'a premium firm costs more than an ordinary one, and a cheap one less');
check(reno.quote(owned('mansion', false), 'kitchen') > reno.quote(owned('studio', false), 'kitchen'), 'a kitchen in a mansion costs more than one in a studio');
check(!reno.addRenovation(h.id, 'wine_cellar', 'solid').ok, 'something that does not fit is refused');
p.finance.cash = 10;
check(!reno.addRenovation(h.id, 'pool', 'solid').ok && reno.renovationsOf(h).length === 1, 'without the money, nothing is done');
p.finance.cash = 50_000_000;
section('a renovation is paid for, recorded, and adds less than it costs');

// ---------- 3. The space a home has ----------
p = life(2025);
const flat = owned('condo');
const fits = reno.fitting(flat).filter((x) => x.ok).map((x) => x.r.id);
for (const id of fits.slice(0, SPACE.condo)) reno.addRenovation(flat.id, id, 'premium');
check(reno.usedOf(flat) === SPACE.condo, `a condo takes ${SPACE.condo}`);
const full = reno.fitting(flat).find((x) => !reno.renovationsOf(flat).some((y) => y.id === x.r.id));
check(full && !full.ok && /No space left/.test(full.why) && !reno.addRenovation(flat.id, full.r.id, 'premium').ok, 'and not one more');
const big = owned('house');
const before = reno.spaceOf(big);
reno.addRenovation(big.id, 'extension', 'premium');
check(reno.spaceOf(big) === before + 1 && reno.usedOf(big) === 0, 'an extension makes room for one more, and takes none itself');
section('each home has room for so many, and an extension makes one more');

// ---------- 4. Contractors: who does the work matters ----------
p = life(2025);
const firms = reno.contractors(owned('house', false));
check(firms.length === 3 && new Set(firms.map((f) => f.name)).size === 3 && firms[0].stars < firms[2].stars, 'three firms in town, by name, the dearest the best rated');
check(JSON.stringify(reno.contractors(owned('house', false))) === JSON.stringify(firms), 'the same firms every time in the same city');
const tally = { budget: { great: 0, poor: 0, over: 0 }, premium: { great: 0, poor: 0, over: 0 } };
for (const tier of ['budget', 'premium']) {
  for (let i = 0; i < 300; i++) {
    const a = owned('house', false);
    const cost = reno.quote(a, 'game_room', tier);
    const res = reno.addRenovation(a.id, 'game_room', tier);
    tally[tier][res.how] = (tally[tier][res.how] ?? 0) + 1;
    if (res.cost > cost) tally[tier].over += 1;
    p.assets = p.assets.filter((x) => x.id !== a.id);
  }
}
check(tally.premium.great > tally.budget.great * 2, `a premium firm does great work far more often (${tally.premium.great} vs ${tally.budget.great} of 300)`);
check(tally.budget.poor + tally.budget.over > (tally.premium.poor + tally.premium.over) * 4, `a cheap firm goes wrong far more often (${tally.budget.poor} shoddy and ${tally.budget.over} over budget, vs ${tally.premium.poor} and ${tally.premium.over})`);
// However lucky a cheap job, the home never gains as much as was paid: across every kind, firm and result.
{
  let worst = 0;
  for (const id of ['kitchen', 'central_heating', 'pool', 'garden', 'extension', 'solar_panels']) {
    for (const tier of ['budget', 'solid', 'premium']) {
      for (let i = 0; i < 25; i++) {
        const a = owned('mansion', false);
        const was = a.value;
        const res = reno.addRenovation(a.id, id, tier);
        if (res.ok) worst = Math.max(worst, (a.value - was) / res.cost);
        p.assets = p.assets.filter((x) => x.id !== a.id);
      }
    }
  }
  check(worst > 0 && worst < 1, `no renovation ever adds as much as it cost (at most ${Math.round(worst * 100)}% of the price)`);
}
section('a better contractor costs more and does better work; a cheap one is a gamble');

// ---------- 5. Fixing shoddy work, and taking things out ----------
p = life(2025);
const fixer = owned('house');
const worth0 = fixer.value; const q0 = fixer.quality;
let shoddy = null;
for (let i = 0; i < 80 && !shoddy; i++) {
  const a = owned('house', false);
  if (reno.addRenovation(a.id, 'home_theater', 'budget').how === 'poor') shoddy = a; else p.assets = p.assets.filter((x) => x.id !== a.id);
}
check(!!shoddy && reno.doneList(shoddy).some((t) => /shoddy/.test(t)), 'shoddy work happens, and says so');
if (shoddy) {
  const comfortShoddy = reno.comfortOf(shoddy);
  check(comfortShoddy === 0, 'shoddy work adds nothing to living there');
  let fixed = false;
  for (let i = 0; i < 10 && !fixed; i++) fixed = reno.fixRenovation(shoddy.id, 'home_theater', 'premium').ok;
  check(fixed && reno.renovationsOf(shoddy)[0].result !== 'poor' && reno.comfortOf(shoddy) > 0, 'a good firm can put it right');
  check(!reno.fixRenovation(shoddy.id, 'home_theater', 'premium').ok, 'and good work has nothing to fix');
}
reno.addRenovation(fixer.id, 'pool', 'solid');
const withPool = fixer.value;
r = reno.removeRenovation(fixer.id, 'pool');
check(r.ok && !reno.renovationsOf(fixer).length && Math.abs(fixer.quality - q0) < 1e-9 && Math.abs(fixer.value - worth0) <= 1 && withPool !== worth0, 'taking it out frees the space and the home is worth what it was without it');
reno.addRenovation(fixer.id, 'extension', 'solid');
for (const id of ['kitchen', 'pool', 'garden', 'man_cave', 'home_theater', 'game_room', 'workshop']) reno.addRenovation(fixer.id, id, 'premium');
check(reno.usedOf(fixer) === reno.spaceOf(fixer) && !reno.removeRenovation(fixer.id, 'extension').ok, 'an extension holding a full house cannot be taken out first');
section('shoddy work can be put right, and anything can be taken out again');

// ---------- 6. Living with it: mood, running costs ----------
p = life(2025);
const homeA = owned('house');
const { PROPERTY_BY_ID } = await import('../js/data/properties.js');
const baseRate = PROPERTY_BY_ID.house.upkeep;
reno.addRenovation(homeA.id, 'solar_panels', 'premium');
check(estate.upkeepRate(homeA) < baseRate, 'solar panels lower the running costs');
reno.addRenovation(homeA.id, 'pool', 'premium');
check(estate.upkeepRate(homeA) > baseRate - 0.003, 'a pool raises them');
for (const id of ['kitchen', 'home_theater', 'man_cave', 'game_room', 'garden']) reno.addRenovation(homeA.id, id, 'premium');
const { COMFORT_CAP } = await import('../js/data/renovations.js');
check(reno.comfortOf(homeA) <= COMFORT_CAP && reno.comfortOf(homeA) > 0, `living with them lifts the mood, up to a limit (${reno.comfortOf(homeA)} of ${COMFORT_CAP})`);
p.stats.mood = 40;
estate.tickProperties();
check(p.stats.mood > 40 + Math.round(PROPERTY_BY_ID.house.comfort / 3), 'a renovated home lifts the mood more than a plain one');
section('renovations change what it is like to live there, and what it costs to run');

// ---------- 7. Only owned homes; kept in the save ----------
p = life(2025);
p.homeId = null;
check(!reno.addRenovation('asset_nope', 'kitchen', 'solid').ok, 'a home the player does not own cannot be renovated');
const keep = owned('townhouse');
reno.addRenovation(keep.id, 'home_office', 'solid');
const keptValue = keep.value;
bookAction();
check(audit().length === 0, 'the books balance');
saveGame(store.state); store.state = loadGame(store.state.slotId);
const back = store.state?.player?.assets?.find((a) => a.id === keep.id);
check(back && back.renovations?.[0]?.id === 'home_office' && back.value === keptValue, 'renovations are kept in the save');
section('only owned homes, apartments included, and they are kept in the save');

// ---------- 8. What they do for the people living there ----------
{
  const mo = await import('../js/engine/moments.js');
  const skills = await import('../js/engine/skills.js');
  const { makeNpc } = await import('../js/engine/npcFactory.js');
  const person = (role, age, rel = 60) => { const n = makeNpc({ role, countryId: p.countryId, age, relationship: rel }); store.state.npcs[n.id] = n; p.npcIds.push(n.id); return n; };
  const only = (ids, type = 'house') => { p.assets = []; const a = owned(type); for (const id of ids) reno.addRenovation(a.id, id, 'premium'); for (const r of a.renovations ?? []) r.result = 'good'; return a; };
  p = life(2025); p.education.enrolled = false;
  for (const n of Object.values(store.state.npcs)) n.alive = false; p.npcIds = []; store.state.traditions = [];
  person('parent', 60); person('sibling', 35); person('friend', 40);
  // Hosting: a new kitchen for family occasions, a game room for a game night.
  only([]); store.state.moments = null;
  const xmas = mo.thisYear().find((x) => x.holiday); const night = mo.thisYear().find((x) => x.occasion === 'game_night');
  const plainHost = mo.costOf(xmas, 3); const plainNight = mo.costOf(night, 3);
  only(['kitchen', 'game_room']);
  check(mo.costOf(xmas, 3) < plainHost * 0.75 && mo.costOf(night, 3) < plainNight, `a new kitchen makes hosting a holiday cheaper (${plainHost} to ${mo.costOf(xmas, 3)}), a game room a game night`);
  check(reno.homePerk('kitchen') && !reno.homePerk('pool'), 'and only what the home has counts');
  const kept = p.assets[0]; kept.renovations[0].result = 'poor';
  check(!reno.homePerk('kitchen'), 'shoddy work does nothing');
  // Practice and repairs.
  const practiced = (ids) => { let t = 0; for (let i = 0; i < 30; i++) { only(ids); p.flags.skillActs = null; p.talents.music = 30; p.finance.cash = 1e7; const r = skills.practice('guitar'); t += r.gained ?? 0; } return t; };
  check(practiced(['music_studio']) > practiced([]), 'a music studio makes music practice go faster');
  const shed = only([]); shed.condition = 50; const repairs = estate.renovationCost(shed.id);
  only(['workshop']); p.assets[0].condition = 50; p.assets[0].value = shed.value;
  check(estate.renovationCost(p.assets[0].id) < repairs, 'a workshop makes repairs cheaper');
  // A year at home: a gym, a library, a garden, a treehouse.
  only(['home_gym', 'library', 'garden', 'treehouse'], 'country'); // a library needs a big home
  p.stats.health = 50; p.stats.intellect = 50; p.skills = {};
  const kid = person('child', 8, 50);
  reno.tickHomeLife();
  check(p.stats.health === 51 && p.stats.intellect === 51 && p.skills.gardening >= 2 && kid.meters.relationship === 52, 'a year at home: a gym, a library, a garden and a treehouse each do their part');
  // Scenes: over the years, a pool party with a friend, and the garden's harvest.
  only(['pool', 'garden']);
  const seen = new Set();
  for (let y = 0; y < 20; y++) { store.state.pendingEvents = []; store.state.year += 1; reno.tickHomeLife(); for (const e of store.state.pendingEvents) seen.add(e.id); }
  check(seen.has('home_pool_party') && seen.has('home_harvest'), `a pool brings summer parties and a garden a harvest (${[...seen].join(', ')})`);
  // A renter has none of it.
  p.homeId = null; p.stats.health = 50; reno.tickHomeLife();
  check(p.stats.health === 50, 'nothing for a home you do not live in');
}
section('renovations do something for the people living there, and the screen says what');

for (const line of ok) console.log(`ok   ${line}`);
if (problems.length) { for (const m of problems) console.log(`FAIL ${m}`); console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Renovations hold together.');
void RENOVATION_BY_ID;
