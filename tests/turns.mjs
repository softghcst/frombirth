// Turn length: a year (default), six months or three months. The year itself still happens once, so money and records
// come out the same whatever the turn length; the turns in between bring scenes for their season, and never touch the
// game's own dice. Run with: node tests/turns.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { EVENTS, EVENT_BY_ID } = await import('../js/data/events/index.js');
const { resolveChoice, renderText } = await import('../js/engine/eventEngine.js');
const turns = await import('../js/engine/turns.js');
const cal = await import('../js/engine/calendar.js');
const { COUNTRIES } = await import('../js/data/countries.js');

rng.seed(20261118);
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m, n) => ok.push(problems.length === n ? m : `(failed) ${m}`);
const S = () => store.state; const P = () => store.state.player;
const life = (countryId = 'us', city = 'Chicago') => { for (;;) { store.state = createLife({ countryId, city }); if (!P().royal) return P(); } };

// 1. The calendar.
{
  const n = problems.length;
  life();
  check(turns.stepOf() === 12 && turns.monthOf() === 0, 'a year a turn is the default');
  const y0 = S().year; const a0 = P().age;
  turns.advanceTurn(); S().pendingEvents = [];
  check(S().year === y0 + 1 && P().age === a0 + 1 && turns.monthOf() === 0, 'a year-long turn is a year');
  turns.setStep(3);
  const seen = [];
  for (let i = 0; i < 4; i++) { turns.advanceTurn(); S().pendingEvents = []; seen.push([S().year, P().age, turns.monthOf()]); }
  check(JSON.stringify(seen) === JSON.stringify([[y0 + 1, a0 + 1, 3], [y0 + 1, a0 + 1, 6], [y0 + 1, a0 + 1, 9], [y0 + 2, a0 + 2, 0]]), `four three-month turns make one year, and the birthday comes with the year (${JSON.stringify(seen)})`);
  check(turns.ageText(P()) === `${P().age}`, 'at the turn of the year the age is whole');
  turns.advanceTurn(); S().pendingEvents = [];
  check(turns.ageText(P()) === (P().age === 1 ? '1 year, 3 months' : `${P().age} years, 3 months`) && /3 months/.test(turns.nextTurnText().label), `partway through, the age has months (${turns.ageText(P())}), and the button says what is next`);
  // A change partway through a year waits for the next year.
  const r = turns.setStep(12);
  check(r.ok && turns.stepOf() === 3 && S().settings.nextStep === 12, 'a change partway through a year waits');
  for (let i = 0; i < 3; i++) { turns.advanceTurn(); S().pendingEvents = []; }
  check(turns.monthOf() === 0 && turns.stepOf() === 12 && !S().settings.nextStep, 'and takes effect when the year turns');
  turns.setStep(6);
  turns.advanceTurn(); S().pendingEvents = [];
  check(turns.monthOf() === 6, 'six-month turns stop halfway through the year');
  check(!turns.setStep(5).ok, 'only the three lengths');
  // Seasons follow the hemisphere.
  check(turns.seasonAt(6, 'us') === 'summer' && turns.seasonAt(6, 'au') === 'winter' && turns.seasonAt(0, 'nz') === 'summer', 'seasons run the other way round in the south');
  // Each country has its own climate: the tropics have rainy and dry seasons, South Asia the monsoon, the Gulf a hot season.
  check(Object.keys(COUNTRIES).every((id) => cal.CLIMATE[id]), 'every country has a climate');
  const at = (m, id) => turns.seasonAt(m, id);
  check(at(7, 'in') === 'monsoon' && at(0, 'in') === 'cool' && at(4, 'pk') === 'hot', 'India and Pakistan: cool, hot, then the monsoon');
  check(at(7, 'ng') === 'wet' && at(0, 'ng') === 'dry' && at(1, 'br') === 'wet' && at(7, 'br') === 'dry', 'the tropics: rainy and dry seasons, either way round');
  check(at(3, 'ke') === 'wet' && at(7, 'ke') === 'dry' && at(10, 'ke') === 'wet' && at(0, 'ec') === 'dry', 'the equator: long rains, short rains, drier months between');
  check(at(6, 'ae') === 'hot' && at(0, 'sa') === 'cool' && at(3, 'eg') === 'mild', 'the desert: a hot season, a cool one, mild months');
  check(cal.schoolStart('us') === 8 && cal.schoolStart('jp') === 3 && cal.schoolStart('au') === 1 && cal.schoolStart('in') === 5, 'school years start when they do there');
  check(JSON.stringify(turns.turnSeasons(3, 3, 'us')) === JSON.stringify(['winter', 'spring']) && turns.turnSeasons(12, 6, 'us').includes('fall'), 'a turn covers the seasons of its months');
  // Saved and loaded partway through.
  saveGame(S()); const m = turns.monthOf(); store.state = loadGame(S().slotId);
  check(turns.monthOf() === m && turns.stepOf() === 6, 'the calendar is saved');
  section('calendar: four quarters or two halves make a year; birthdays at the turn of the year; changes wait for the year; seasons by hemisphere', n);
}

// 2. Money and records come out the same whatever the turn length, when the scenes between years are left alone.
{
  const n = problems.length;
  life('uk', 'London');
  const start = structuredClone(S());
  // New people get ids from the clock and Math.random (util.uid), and some luck is keyed to a person's id: both are
  // made to repeat for each run, so the runs differ only in their turn length.
  const realNow = Date.now; const realRandom = Math.random;
  const repeatable = () => { let t = 1.8e12; let s = 12345; Date.now = () => (t += 1000); Math.random = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); };
  // answer: also answer the year's own scenes (those drawn at the turn of the year), the same way in every mode. A scene
  // tied to a season is held for its season with shorter turns, and left alone in every mode here.
  const play = (step, answer = false) => {
    store.state = structuredClone(start);
    turns.setStep(step);
    rng.seed(777);
    repeatable();
    const turnsPerYear = 12 / step;
    for (let i = 0; i < 25 * turnsPerYear && P().alive; i++) {
      const r = turns.advanceTurn();
      if (answer && r.year) {
        for (const pe of S().pendingEvents.slice()) {
          const ev = EVENT_BY_ID[pe.id];
          if (!ev || ev.between || ev.hood || ev.timing?.seasons || !P().alive) continue; // neighborhood scenes come when their month does (engine/neighborhood.js)
          const pick = ev.choices.findIndex((c) => !c.requires?.length);
          const res = resolveChoice(ev, pick, pe.cast);
          if (res.death) break;
        }
      }
      S().pendingEvents = [];
    }
    return S();
  };
  const strip = (st) => {
    const x = structuredClone(st);
    // Disasters are told as they strike with shorter turns, so the year's recap of them is worded differently; what they
    // did (money, health, homes) is compared with everything else.
    x.journal = x.journal.filter((j) => !j.month && j.kind !== 'season' && !j.disaster && !j.hood); // neighborhood lines are told in their month (engine/neighborhood.js)
    if (x.disasters) { delete x.disasters.told; delete x.disasters.warned; }
    delete x.month; delete x.settings; delete x.updatedAt; delete x.idSeq; delete x.held;
    if (x.ledger) delete x.ledger.jn; // where the ledger last read the life story, which has the seasons in it too
    // Ids are counted in the life (util.uid; random ones before a life exists): they are numbered by first appearance instead.
    const seen = new Map();
    // Compared with keys in a fixed order: the order a record's fields were first written in is not an outcome.
    const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
    return JSON.stringify(sorted(x)).replace(/\b([a-z]+)_(q[a-z0-9]{5,}|[a-z0-9]{10,})\b/g, (m) => { if (!seen.has(m)) seen.set(m, `#${seen.size}`); return seen.get(m); });
  };
  const a = play(12); const ja = strip(a); const ra = rng.state();
  const b = play(3); const jb = strip(b); const rb = rng.state();
  const c = play(6); const jc = strip(c);
  Date.now = realNow; Math.random = realRandom;
  check(ja === jb && ja === jc, 'twenty-five years come out exactly the same in all three turn lengths');
  check(ra === rb, 'and the game\'s dice end in the same place');
  // And with the year's own scenes answered the same way: the same scenes are drawn, and the same luck follows them.
  const a2 = strip(play(12, true)); const r2a = rng.state();
  const b2 = strip(play(3, true)); const r2b = rng.state();
  const c2 = strip(play(6, true));
  Date.now = realNow; Math.random = realRandom;
  check(a2 === b2 && a2 === c2 && r2a === r2b, 'answering the year\'s own scenes, twenty-five years still come out the same in all three turn lengths');
  if (ja !== jb) {
    const A = JSON.parse(ja); const B = JSON.parse(jb);
    for (const k of Object.keys(A)) if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) { problems.push(`  first difference under "${k}"`); break; }
  }
  section('the same life: identical money, records and dice with one-year, six-month and three-month turns', n);
}

// 3. Scenes between years.
{
  const n = problems.length;
  const between = EVENTS.filter((e) => e.between);
  check(between.length >= 30, `about thirty scenes for the turns between years (${between.length})`);
  for (const e of between) {
    check(e.between.queued || (Array.isArray(e.between.steps) && e.between.steps.every((s) => [3, 6].includes(s))), `${e.id}: belongs to six- or three-month turns`);
    check(!e.between.seasons || e.between.seasons.every((s) => cal.SEASON_NAMES[s]), `${e.id}: real seasons`);
  }
  // Year-long turns never see them.
  life();
  const ids = new Set();
  for (let i = 0; i < 40 && P().alive; i++) { turns.advanceTurn(); for (const pe of S().pendingEvents) ids.add(pe.id); S().pendingEvents = []; }
  check(![...ids].some((id) => EVENT_BY_ID[id]?.between), 'with year-long turns there are no in-between scenes');
  // Three-month turns do, and each fits the life and the season.
  const got = new Map(); const everyday = new Map(); const lived = {};
  const PLACES = [['us', 'Chicago'], ['au', 'Sydney'], ['in', 'Mumbai'], ['br', 'São Paulo'], ['ke', 'Nairobi'], ['eg', 'Cairo'], ['ng', 'Lagos'], ['uk', 'London']];
  for (let t = 0; t < PLACES.length; t++) {
    try { life(...PLACES[t]); } catch { life(PLACES[t][0], undefined); }
    turns.setStep(3);
    for (let i = 0; i < 4 * 45 && P().alive; i++) {
      const before = turns.monthOf();
      turns.advanceTurn();
      if (!turns.monthOf()) lived[P().countryId] = (lived[P().countryId] ?? 0) + 1;
      const between = turns.monthOf() !== 0;
      for (const pe of S().pendingEvents.splice(0)) {
        const ev = EVENT_BY_ID[pe.id];
        if (ev && !ev.between && !ev.hood && between && pe.id !== 'disaster_forecast') { // a neighborhood scene comes in the month it happens (engine/neighborhood.js) // a forecast is queued by the turn itself (engine/disasters.js)
          // One of the year's ordinary scenes, on a turn between years: more chances with shorter turns.
          everyday.set(pe.id, (everyday.get(pe.id) ?? 0) + 1);
          check(!ev.priority && !ev.queuedOnly, `${pe.id}: only ordinary scenes come between years, not the year's story beats`);
          check(P().age >= ev.ageRange[0] && P().age <= ev.ageRange[1], `${pe.id} fits the age`);
          const dice = rng.state();
          resolveChoice(ev, ev.choices.findIndex((c) => !c.requires?.length), pe.cast);
          check(rng.state() === dice, `${pe.id}: choosing it between years leaves the game's dice alone`);
          continue;
        }
        if (!ev?.between) continue;
        got.set(pe.id, (got.get(pe.id) ?? 0) + 1);
        const end = turns.monthOf() || 12;
        const seasons = turns.turnSeasons(end, 3, P().countryId);
        check(!ev.between.seasons || ev.between.seasons.some((s) => seasons.includes(s)), `${pe.id} came in its season (${seasons.join('/')}, ${P().countryId}, from month ${before})`);
        check(!ev.between.when || ev.between.when(P(), S()), `${pe.id} fits the life it came to`);
        check(P().age >= ev.ageRange[0] && P().age <= ev.ageRange[1], `${pe.id} fits the age`);
        const text = renderText(ev.text, pe.cast);
        check(!/\{|undefined/.test(text), `${pe.id}: the text is complete (${text})`);
        // Choosing does not touch the game's dice.
        const dice = rng.state();
        resolveChoice(ev, 0, pe.cast);
        check(rng.state() === dice, `${pe.id}: choosing leaves the game's dice alone`);
      }
      S().pendingEvents = []; // follow-ups queued by a choice are their own scenes, not the turn's draw
    }
  }
  check(got.size >= 20, `many different seasonal scenes come up over eight lives in seven climates (${got.size})`);
  // Each of these needs a life long enough in the right climate to have seen it.
  if ((lived.in ?? 0) >= 15) check(got.has('between_monsoon'), 'the monsoon comes in India');
  if ((lived.ng ?? 0) + (lived.br ?? 0) + (lived.ke ?? 0) >= 15) check(got.has('between_rains_arrive'), 'the rains come in the tropics');
  if ((lived.eg ?? 0) + (lived.in ?? 0) >= 15) check(got.has('between_hot_season'), 'the hot season comes in the desert and South Asia');
  const ordinaryCount = [...everyday.values()].reduce((a, b) => a + b, 0);
  check(ordinaryCount >= 8 * 40 && everyday.size >= 30, `ordinary scenes come up between years as well (${ordinaryCount} times, ${everyday.size} different)`);
  const winterUS = [...got.keys()].some((id) => EVENT_BY_ID[id].between.seasons?.includes('winter'));
  check(winterUS, 'winter scenes come up too (the last part of the year has its season)');
  section('scenes between years: only with shorter turns, in their season and hemisphere, fitting the life, on their own luck', n);
}

// 4. Scenes tied to a moment, the undo button, and ages with months.
{
  const n = problems.length;
  const timed = EVENTS.filter((e) => e.timing);
  check(timed.some((e) => e.timing.yearTurn) && timed.some((e) => e.timing.seasons), 'birthday and New Year scenes, and season scenes, are marked');
  // In many three-month lives: a birthday scene only when the year turns; a season scene only in its season.
  for (let t = 0; t < 8; t++) {
    life(t % 2 ? 'au' : 'uk', t % 2 ? 'Sydney' : 'London');
    turns.setStep(t % 3 ? 3 : 6);
    for (let i = 0; i < 4 * 40 && P().alive; i++) {
      turns.advanceTurn();
      const m = turns.monthOf();
      const seasons = turns.turnSeasons(m || 12, turns.stepOf(), P().countryId);
      for (const pe of S().pendingEvents.splice(0)) {
        const ev = EVENT_BY_ID[pe.id];
        if (!ev?.timing) continue;
        if (ev.timing.yearTurn) check(m === 0, `${pe.id} comes only when the year turns (month ${m})`);
        if (ev.timing.seasons) check(ev.timing.seasons.some((x) => seasons.includes(x)), `${pe.id} comes only in its season (${seasons.join('/')} in ${P().countryId})`);
      }
    }
  }
  // Undo reaches three years back whatever the turn length, and says where it goes.
  const { pushUndo, peekUndo, undoDepth } = await import('../js/save.js');
  life(); turns.setStep(3);
  for (let i = 0; i < 16; i++) { pushUndo(S()); turns.advanceTurn(); S().pendingEvents = []; }
  const { UNDO_BUDGET, saveGame } = await import('../js/save.js');
  const held = JSON.parse(localStorage.getItem(`pathways.undo.${S().slotId}`) ?? '[]');
  check(undoDepth(S().slotId) >= 2 && undoDepth(S().slotId) <= 12 && held.reduce((n, x) => n + x.length, 0) <= UNDO_BUDGET, `undo keeps as many turns as fit its share of storage (${undoDepth(S().slotId)})`);
  // A full browser: five million characters for everything. The life's own save always wins over its undo history.
  const room = 5000000; const real = { set: localStorage.setItem };
  localStorage.setItem = (k, v) => { let used = 0; for (const [kk, vv] of disk) if (kk !== k) used += kk.length + vv.length; if (used + k.length + String(v).length > room) throw new Error('QuotaExceededError'); disk.set(k, String(v)); };
  let failed = 0;
  for (let i = 0; i < 4 * 25 && P().alive; i++) { pushUndo(S()); turns.advanceTurn(); S().pendingEvents = []; if (!saveGame(S())) failed++; }
  localStorage.setItem = real.set;
  check(failed === 0, `with storage nearly full, the life still saves every turn (${failed} failed)`);
  const to = peekUndo(S().slotId);
  check(to && to.month === 9 && to.age === P().age - 1, `going back from the turn of a year lands on its last quarter (${JSON.stringify(to)})`);
  check(turns.ageLabel(0, 3) === '3 months' && turns.ageLabel(1, 6) === '1 year, 6 months' && turns.ageLabel(40, 9) === '40 years, 9 months' && turns.ageLabel(7, 0) === '7', 'ages read naturally');
  section('timing: birthdays at the turn of the year, season scenes in their season; undo by the turn, as far back as storage allows, and the life always saves', n);
}

for (const m of ok) console.log(`ok   ${m}`);
for (const m of problems) console.log(`FAIL ${m}`);
if (problems.length) { console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Time moves in years, halves or quarters, and the year is the same.');
