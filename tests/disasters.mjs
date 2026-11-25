// Weather and other disasters: what strikes where and when, the same world for everyone in it, what it does to the
// player, news from elsewhere, and forecasts with turns shorter than a year. Run with: node tests/disasters.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { COUNTRIES } = await import('../js/data/countries.js');
const { LIVING } = await import('../js/data/living.js');
const { EVENT_BY_ID } = await import('../js/data/events/index.js');
const { resolveChoice, renderText } = await import('../js/engine/eventEngine.js');
const { KINDS, CITY_HAZARDS, countryHazards, TSUNAMI, AFTERMATH } = await import('../js/data/disasters.js');
const { climateOf } = await import('../js/engine/calendar.js');
const dis = await import('../js/engine/disasters.js');
const turns = await import('../js/engine/turns.js');

rng.seed(20261118);
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m, n) => ok.push(problems.length === n ? m : `(failed) ${m}`);
const S = () => store.state; const P = () => store.state.player;
const life = (countryId, city) => { for (;;) { store.state = createLife({ countryId, city, birthday: { m: 0, d: 1 } }); if (!P().royal) return P(); } };

// 1. What can strike where.
{
  const n = problems.length;
  for (const id of Object.keys(COUNTRIES)) {
    const h = countryHazards(id, LIVING[id]);
    check(h.length > 0 && h.every((k) => KINDS[k]), `${id}: has hazards, all known`);
  }
  for (const [id, cities] of Object.entries(CITY_HAZARDS)) for (const [city, list] of Object.entries(cities)) {
    check(COUNTRIES[id].cities.includes(city) && list.every((k) => KINDS[k]), `${id}/${city}: a real city with known hazards`);
  }
  const at = (c, city) => dis.hazardsAt(c, city);
  check(!at('us', 'Seattle').includes('hurricane') && !at('us', 'Seattle').includes('tornado') && at('us', 'Seattle').includes('earthquake'), 'Seattle: earthquakes, not hurricanes or tornadoes');
  check(at('us', 'Orlando').includes('hurricane') && at('us', 'Austin').includes('tornado') && at('us', 'Denver').includes('blizzard') && !at('us', 'Orlando').includes('blizzard'), 'Orlando hurricanes, Austin tornadoes, Denver blizzards');
  check(at('in', 'Mumbai').includes('cyclone') && !at('in', 'Mumbai').includes('hurricane') && at('in', 'Mumbai').includes('monsoonFlood'), 'India: cyclones and monsoon floods');
  check(at('jp', 'Tokyo').includes('typhoon') && at('jp', 'Tokyo').includes('tsunami') && at('jp', 'Tokyo').includes('blizzard'), 'Japan: typhoons, tsunamis, snowstorms');
  check(at('eg', 'Cairo').includes('duststorm') && !at('eg', 'Cairo').includes('blizzard'), 'Egypt: dust storms, no blizzards');
  section('where: each country its own hazards; United States cities by region', n);
}

// 2. When: the months each kind comes in, and tsunamis only after a strong earthquake offshore.
{
  const n = problems.length;
  const st = { slotId: 'test-world' };
  let tsunamis = 0;
  for (const id of Object.keys(COUNTRIES)) {
    const cl = climateOf(id);
    for (let y = 2000; y < 2060; y++) {
      const w = dis.weatherOf(id, y, st);
      for (const e of w) {
        if (e.kind === 'tsunami') {
          tsunamis++;
          const q = w.find((x) => x.id === e.after);
          check(TSUNAMI.has(id) && q && q.kind === 'earthquake' && q.severity >= 1 && q.month === e.month, `${e.id}: a tsunami follows a strong earthquake on a coast that has them`);
          continue;
        }
        check(KINDS[e.kind].months(cl, id).includes(e.month), `${e.id}: ${e.kind} in month ${e.month} is in its season for a ${cl} climate`);
      }
    }
  }
  check(tsunamis > 0, `tsunamis happen, rarely (${tsunamis} in sixty years of the world)`);
  const months = (id, kind) => new Set(Array.from({ length: 80 }, (_, i) => dis.weatherOf(id, 2000 + i, st)).flat().filter((e) => e.kind === kind).map((e) => e.month));
  check([...months('us', 'hurricane')].every((m) => m >= 5 && m <= 10), 'Atlantic hurricanes: June to November');
  check([...months('au', 'cyclone')].every((m) => m >= 11 || m <= 3), 'Australian cyclones: the southern summer');
  check([...months('ru', 'blizzard')].every((m) => m >= 10 || m <= 2), 'Russian blizzards: northern winter');
  check([...months('in', 'monsoonFlood')].every((m) => m >= 6 && m <= 8), 'Indian monsoon floods: the monsoon');
  // The same world every time, and the game's dice untouched.
  const dice = rng.state();
  check(JSON.stringify(dis.weatherOf('ph', 2033, st)) === JSON.stringify(dis.weatherOf('ph', 2033, st)), 'the weather of a year is the same every time it is asked');
  check(rng.state() === dice, 'working out the weather does not use the game\'s dice');
  const named = Array.from({ length: 30 }, (_, i) => dis.weatherOf('us', 2000 + i, st)).flat().filter((e) => KINDS[e.kind].named);
  check(named.length > 0 && named.every((e) => /^Hurricane [A-Z][a-z]+$/.test(e.name)), 'hurricanes have names');
  section('when: every kind in its season and hemisphere; tsunamis after big quakes; the same world every time', n);
}

// 3. What it does to the player: only what reaches their city, and preparing helps.
{
  const n = problems.length;
  for (const [c, city] of [['us', 'Seattle'], ['us', 'Orlando'], ['in', 'Mumbai'], ['eg', 'Cairo']]) {
    life(c, city);
    for (let y = S().year; y < S().year + 40; y++) for (const e of dis.weatherOf(c, y)) if (dis.reaches(e)) check(dis.hazardsAt(c, P().city).includes(e.kind), `${city}: only what can strike it reaches it (${e.kind})`);
  }
  // A hurricane that reaches Orlando, felt three ways: unprepared, prepared, and gone.
  life('us', 'Orlando');
  const p = P(); p.age = 30; p.finance.cash = 50000;
  p.assets.push({ id: 'asset_t', kind: 'property', catalogId: 'house', name: 'Family house', value: 300000, purchasePrice: 300000, condition: 90, countryId: 'us', city: 'Orlando' }); p.homeId = 'asset_t';
  let e = null; let year = 0;
  // A year whose life story will tell the hurricane: only the two worst disasters to reach a city in a year are told.
  const told = (y, x) => dis.weatherOf('us', y).filter((z) => dis.reaches(z)).sort((a, b) => b.severity - a.severity).slice(0, 2).some((z) => z.id === x.id);
  for (let y = S().year; y < S().year + 200 && !e; y++) { e = dis.weatherOf('us', y).find((x) => x.kind === 'hurricane' && x.severity >= 1 && dis.reaches(x) && told(y, x)) ?? null; year = y; }
  check(!!e, 'setup: a major hurricane reaches Orlando sooner or later');
  if (e) {
    const base = structuredClone(S());
    const run = (prep) => {
      store.state = structuredClone(base); S().year = year + 1; S().pendingEvents = [];
      if (prep) (S().disasters ??= { prep: {}, told: {}, warned: {} }).prep[e.id] = prep;
      const dice = rng.state(); const h0 = P().stats.health;
      dis.tickDisasters();
      return { condition: P().assets.find((a) => a.id === 'asset_t').condition, hurt: P().stats.health < h0 - 3, dice: rng.state() === dice, scene: S().pendingEvents.find((x) => x.id === 'disaster_aftermath'), line: S().journal.filter((j) => j.disaster).map((j) => j.text).join(' ') };
    };
    const none = run(null); const ready = run('ready'); const gone = run('evacuated');
    check(none.dice && ready.dice && gone.dice, 'what a disaster does is settled without the game\'s dice');
    check(ready.condition >= none.condition, `preparing never makes the damage worse (${none.condition} → ${ready.condition})`);
    // The hurricane's own line (a heatwave the same year can still wear on health).
    const own = gone.line.slice(gone.line.indexOf(e.name));
    check(/You had left in time/.test(own) && !/You were hurt/.test(own.split(/In [A-Z][a-z]+, /)[0]), `nobody who left in time is hurt by it (${own.slice(0, 120)})`);
    check(new RegExp(e.name).test(none.line) && /In [A-Z][a-z]+, Hurricane/.test(none.line), `the life story names the hurricane and the month (${none.line.slice(0, 80)})`);
    // The aftermath is about the worst thing that year: the hurricane, or a flood or tornado that was worse.
    const after = none.scene ? renderText(EVENT_BY_ID.disaster_aftermath.text, none.scene.cast) : '';
    check(after && !/\{/.test(after) && Object.values(AFTERMATH).some((t) => after === t.replace('{what}', none.scene.cast.words.what)), `and an aftermath scene follows, worded for what it was (${after.slice(0, 60)})`);
  }
  section('the player: only what reaches their city; named, dated, an aftermath; preparing and leaving help', n);
}

// 4. News from elsewhere, and someone the player knows who lives there.
{
  const n = problems.length;
  life('uk', 'London');
  const p = P(); p.age = 30;
  let target = null;
  for (let y = S().year; y < S().year + 60 && !target; y++) { const e = dis.weatherOf('ph', y).find((x) => x.severity >= 1); if (e) target = { e, y }; }
  check(!!target, 'setup: a big disaster in the Philippines');
  if (target) {
    const cousin = makeNpc({ role: 'relative', countryId: 'ph', age: 30, relationship: 50 }); cousin.flags.abroad = 'ph'; // room to grow closer
    S().npcs[cousin.id] = cousin;
    // The cousin is the only person the player knows: a life can begin with someone abroad already, somewhere a
    // disaster strikes the same year, and then the scene can be about them instead.
    p.npcIds = [cousin.id];
    S().year = target.y + 1; S().pendingEvents = [];
    dis.tickDisasters();
    const news = (S().world?.news ?? []).filter((x) => x.kind === 'disaster' && x.placeId === 'ph');
    check(news.length > 0, 'the world news reports it');
    check(S().journal.some((j) => /Philippines/.test(j.text)), 'and the player hears of it, because a relative lives there');
    const far = S().pendingEvents.find((x) => x.id === 'disaster_far_away');
    check(far && far.cast.person === cousin.id && /Philippines/.test(renderText(EVENT_BY_ID.disaster_far_away.text, far.cast)), 'a scene: someone they know lives there');
    if (far) { const r0 = cousin.meters.relationship; resolveChoice(EVENT_BY_ID.disaster_far_away, 0, far.cast); check(cousin.meters.relationship > r0, 'calling them brings them closer'); }
  }
  section('news: big disasters elsewhere reach the world news, and the player when it is somewhere they have ties', n);
}

// 5. Turns shorter than a year: told as they strike, and forecast in time to prepare.
{
  const n = problems.length;
  let forecasts = 0; let told = 0; let prepared = 0;
  for (let t = 0; t < 6; t++) {
    life(t % 2 ? 'jp' : 'us', t % 2 ? 'Tokyo' : 'Orlando');
    turns.setStep(3);
    for (let i = 0; i < 4 * 30 && P().alive; i++) {
      turns.advanceTurn();
      told += S().journal.filter((j) => j.disaster && j.month).length > told ? 1 : 0;
      for (const pe of S().pendingEvents.splice(0)) {
        if (pe.id !== 'disaster_forecast') continue;
        forecasts++;
        const id = pe.cast.words.eventId;
        const e = dis.weatherOf(P().countryId, Number(id.split('-')[1])).find((x) => x.id === id);
        check(e && KINDS[e.kind].forecast && e.severity >= 1, `${id}: only big storms, floods and fires are forecast`);
        const ahead = (e.month - turns.monthOf() + 12) % 12;
        check(ahead < turns.stepOf(), `${id}: the forecast comes the turn before (${ahead} months ahead)`);
        resolveChoice(EVENT_BY_ID.disaster_forecast, 1, pe.cast);
        if (S().disasters.prep[id] === 'evacuated') prepared++;
      }
    }
  }
  check(forecasts > 0 && prepared === forecasts, `forecasts come, and the choice is kept for when it strikes (${forecasts} forecasts)`);
  check(told > 0, 'disasters are told as they strike, partway through the year');
  // With year-long turns there are no forecasts.
  life('us', 'Orlando');
  let f12 = 0;
  for (let i = 0; i < 40 && P().alive; i++) { turns.advanceTurn(); f12 += S().pendingEvents.filter((x) => x.id === 'disaster_forecast').length; S().pendingEvents = []; }
  check(f12 === 0, 'with year-long turns there are no forecasts');
  section('shorter turns: forecasts a turn ahead, the choice kept; told as they strike', n);
}

// 6. Found in review, kept fixed.
{
  const n = problems.length;
  // No aftermath scene for small children; no forecast for children (their family gets ready), only for adults.
  let small = 0; let kidForecasts = 0; const seenPrep = new Set();
  for (let t = 0; t < 6; t++) {
    life('us', 'Orlando'); turns.setStep(3);
    for (let i = 0; i < 4 * 17 && P().alive; i++) {
      turns.advanceTurn();
      for (const pe of S().pendingEvents) { if (pe.id === 'disaster_aftermath' && P().age < 8) small++; if (pe.id === 'disaster_forecast' && P().age < 18) kidForecasts++; }
      S().pendingEvents = [];
      // Preparations are cleared once their year is settled: counted as they are made.
      for (const [id, how] of Object.entries(S().disasters?.prep ?? {})) if (how === 'ready' && P().age < 18) seenPrep.add(id);
    }
  }
  check(small === 0, `no aftermath scene for small children (${small})`);
  check(kidForecasts === 0 && seenPrep.size > 0, `children get no forecast to answer; their family gets ready (${kidForecasts}, ${seenPrep.size})`);
  // A What if? timeline and an heir live in the same world: the same weather.
  life('us', 'Orlando');
  const { forkGame } = await import('../js/save.js');
  const before = JSON.stringify(dis.weatherOf('us', S().year + 3));
  const r = forkGame(S(), 'test');
  const { loadGame } = await import('../js/save.js');
  const copy = loadGame(r.slotId);
  check(copy && copy.slotId !== S().slotId && JSON.stringify(dis.weatherOf('us', S().year + 3, copy)) === before, 'a What if? timeline has the same weather as the life it came from');
  // News of a named storm reads well.
  let named = null;
  for (let y = 2000; y < 2400 && !named; y++) named = dis.weatherOf('ph', y, { slotId: 'news' }).find((e) => e.name && e.severity === 2);
  if (named) {
    S().year = named.year + 1; S().worldId = 'news';
    dis.tickDisasters();
    const line = (S().world?.news ?? []).find((x) => x.text.includes(named.name))?.text ?? '';
    check(line && !/a catastrophic [A-Z]/.test(line), `named storms read well in the news (${line.slice(0, 80)})`);
  }
  // A move partway through a year does not rewrite the year: it is reckoned where it began.
  life('us', 'Orlando'); turns.setStep(12);
  for (let i = 0; i < 3; i++) { turns.advanceTurn(); S().pendingEvents = []; }
  // With one-year turns a year begins where the last one's moves left the family (sometimes a family emigrates with a
  // small child): that is where it is reckoned.
  check(S().disasters?.home?.countryId === P().countryId && S().disasters.home.year === S().year, 'where each year began is kept for its reckoning');
  section('review fixes: no aftermath for small children; families prepare for children; forks share the weather; news grammar; the year reckoned where it began', n);
}

for (const m of ok) console.log(`ok   ${m}`);
for (const m of problems) console.log(`FAIL ${m}`);
if (problems.length) { console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Storms, floods and earthquakes come where and when they do.');
