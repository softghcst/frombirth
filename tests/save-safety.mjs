// Saved lives are kept safe: older saves are brought up to date, transfer codes read back exactly before they are
// given out, loading a code twice never makes two of anything, damaged or wrong input changes nothing, a full device
// rolls a load back instead of half-applying it, an unreadable life is never deleted by a sync, and lives that were
// saved but dropped off the list are found again. Run with: node tests/save-safety.mjs
//
// A stand-in for the browser's storage, with a size limit like the real one (about five million characters).
const disk = new Map();
let limit = Infinity;
const used = () => [...disk].reduce((n, [k, v]) => n + k.length + v.length, 0);
globalThis.localStorage = {
  getItem: (k) => (disk.has(k) ? disk.get(k) : null),
  setItem: (k, v) => {
    v = String(v);
    if (used() - (disk.has(k) ? k.length + disk.get(k).length : 0) + k.length + v.length > limit) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
    disk.set(k, v);
  },
  removeItem: (k) => { disk.delete(k); },
  key: (i) => [...disk.keys()][i] ?? null,
  get length() { return disk.size; },
  clear: () => disk.clear(),
};

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const save = await import('../js/save.js');
const bundle = await import('../js/sync/bundle.js');
const turns = await import('../js/engine/turns.js');

rng.seed(20261127);
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m, n) => ok.push(problems.length === n ? m : `(failed) ${m}`);
const snapshot = () => new Map(disk);
const same = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
const life = (opts = {}) => { for (;;) { const s = createLife({ countryId: 'us', ...opts }); if (!s.player.royal) return s; } };
const live = (s, years) => { store.state = s; for (let i = 0; i < years && s.player.alive; i++) { s.pendingEvents = []; turns.advanceTurn(s); s.pendingEvents = []; } return s; };

// 1. An older save (from when the game was called Pathways, before many records existed) loads and is brought up to date.
{
  const n = problems.length;
  disk.clear();
  const s = live(life({ firstName: 'Ada' }), 6);
  const old = JSON.parse(JSON.stringify(s));
  old.schemaVersion = 1;
  for (const k of ['bonds', 'ledger', 'eventHistory', 'pendingEvents', 'market']) delete old[k];
  delete old.player.skills; delete old.player.traitSources; delete old.player.orientation;
  disk.set('pathways.slot.' + s.slotId, JSON.stringify(old));
  disk.set('pathways.index', JSON.stringify([{ slotId: s.slotId, name: 'Ada Old', age: old.player.age, updatedAt: 1 }]));
  check(save.carryOldName([localStorage]) === 2, 'both old keys are carried over to their From Birth names');
  check(!disk.has('pathways.index') && disk.has('frombirth.index'), 'the old key goes only once the new one holds it');
  const back = save.loadGame(s.slotId);
  check(back && back.player.firstName === 'Ada' && back.player.age === s.player.age, 'the old life loads as the same person, at the same age');
  check(back?.schemaVersion === save.SCHEMA_VERSION && back.bonds && back.ledger && Array.isArray(back.eventHistory) && back.player.skills, 'it is brought up to the current schema, with the missing records filled in');
  store.state = back; turns.advanceTurn(back);
  check(back.player.age === s.player.age + 1 && save.saveGame(back), 'and it can be played on and saved');
  section('an older save is carried over and brought up to date', n);
}

// 2. Export and import: the code reads back as exactly what is here, and loads on another device as the same lives.
let code; let here;
{
  const n = problems.length;
  disk.clear();
  const a = live(life({ firstName: 'Bea' }), 30); save.saveGame(a);
  const b = live(life({ firstName: 'Cal' }), 9); turns.setStep(3, b); turns.advanceTurn(b); save.saveGame(b);
  save.addToGraveyard({ id: 'grave_1', name: 'Dot Old', birthYear: 1900, deathYear: 1980 });
  here = bundle.collect();
  code = await bundle.exportCode();
  check(code.startsWith('FROMBIRTH1:'), 'the code is compressed');
  check(await bundle.verify(code, here), 'the code reads back as exactly what is here');
  const before = snapshot();
  disk.clear(); // the other device
  const what = await bundle.importCode(code, 'combine');
  check(/2 lives/.test(what) && /1 grave/.test(what), `the other device is told what came: ${what}`);
  const a2 = save.loadGame(a.slotId); const b2 = save.loadGame(b.slotId);
  check(a2?.player.age === a.player.age && a2.player.firstName === 'Bea', 'the first life arrives at the same age');
  check(b2?.player.age === b.player.age && b2.month === b.month && b2.settings.step === 3, 'the second arrives at the same age and month, with its turn length');
  check(bundle.fingerprint(bundle.collect()) === bundle.fingerprint(here), 'the other device holds exactly what the first did');
  check(save.getGraveyard().length === 1, 'the grave came too');
  disk.clear(); for (const [k, v] of before) disk.set(k, v);
  section('a transfer code is checked before it is given out, and brings the same lives', n);
}

// 3. No duplicates: loading the same code twice, or a code with an entry listed twice, keeps one of each.
{
  const n = problems.length;
  await bundle.importCode(code, 'combine');
  await bundle.importCode(code, 'combine');
  const ids = save.listSlots().map((m) => m.slotId);
  check(ids.length === 2 && new Set(ids).size === 2, 'loading the same code twice keeps two lives, not four');
  check(save.getGraveyard().length === 1, 'and one grave');
  const doubled = JSON.parse(JSON.stringify(here));
  doubled.index.push(...doubled.index); doubled.graveyard.push(...doubled.graveyard);
  const { bundle: tidy } = bundle.validate(doubled);
  check(tidy.index.length === 2 && tidy.graveyard.length === 1, 'a code listing a life or a grave twice is read as one of each');
  disk.set('frombirth.index', JSON.stringify([...JSON.parse(disk.get('frombirth.index')), ...JSON.parse(disk.get('frombirth.index'))]));
  check(save.listSlots().length === 2, 'a list of saved lives with an entry twice shows each life once');
  section('nothing is ever doubled', n);
}

// 4. Wrong or damaged input changes nothing.
{
  const n = problems.length;
  const before = snapshot();
  for (const [bad, why] of [['', 'nothing'], ['hello', 'some other text'], ['FROMBIRTH1:AAAA', 'a cut-off code'], [code.slice(0, code.length / 2), 'half a code'],
    ['FROMBIRTH0:' + Buffer.from('{"v":1,"slots":"nope"}').toString('base64'), 'a code whose lives are not lives'], ['FROMBIRTH0:' + Buffer.from('not json').toString('base64'), 'a damaged code']]) {
    let threw = '';
    try { await bundle.importCode(bad, 'replace'); } catch (e) { threw = e.message; }
    check(threw && !/undefined|TypeError|JSON/.test(threw), `${why}: refused in plain words (${threw})`);
    check(same(before, disk), `${why}: nothing on the device changed`);
  }
  // A code with one damaged life: the good one comes, the damaged one is left out, and nothing else is lost.
  const mixed = JSON.parse(JSON.stringify(here));
  const [goodId, badId] = Object.keys(mixed.slots);
  mixed.slots[badId] = { nonsense: true };
  disk.clear();
  const what = await bundle.importCode(await bundle.encode(mixed), 'combine');
  check(save.loadGame(goodId) && !disk.has('frombirth.slot.' + badId), `a code with a damaged life brings the good one only (${what})`);
  disk.clear(); for (const [k, v] of before) disk.set(k, v);
  section('wrong or damaged codes change nothing', n);
}

// 5. A full device: loading rolls back instead of half-applying, and says so.
{
  const n = problems.length;
  const bigger = JSON.parse(JSON.stringify(here));
  const extra = live(life({ firstName: 'Eve' }), 40); extra.updatedAt = Date.now();
  bigger.slots[extra.slotId] = JSON.parse(JSON.stringify(extra));
  bigger.index.push({ slotId: extra.slotId, name: 'Eve', age: extra.player.age, updatedAt: extra.updatedAt });
  for (const s of Object.values(bigger.slots)) s.updatedAt = Date.now() + 1000; // every life changes
  const before = snapshot();
  // Room to rewrite the lives already here (the same size again), but not to add the new one: the load gets partway.
  limit = used() + Math.floor(JSON.stringify(extra).length / 2);
  const realSet = localStorage.setItem; let wrote = 0;
  localStorage.setItem = (k, v) => { realSet(k, v); if (k.startsWith('frombirth.slot.')) wrote += 1; };
  let threw = '';
  try { await bundle.importCode(await bundle.encode(bigger), 'replace'); } catch (e) { threw = e.message; }
  limit = Infinity; localStorage.setItem = realSet;
  check(wrote >= 1, `the load got partway before the device was full (${wrote} lives written)`);
  check(/not enough storage/i.test(threw), `a load that does not fit is refused: ${threw}`);
  check(same(before, disk), 'and every life, grave and list is exactly as it was');
  section('a full device is never left half-loaded', n);
}

// 6. A life this device cannot read is never deleted by a sync or a combine; it stays, untouched.
{
  const n = problems.length;
  const id = save.listSlots()[0].slotId;
  disk.set('frombirth.slot.' + id, '{"player": {"firstName": "Bea"'); // cut off mid-write
  const raw = disk.get('frombirth.slot.' + id);
  check(save.loadGame(id) === null, 'an unreadable life does not open');
  check(disk.get('frombirth.slot.' + id) === raw, 'and opening it changed nothing');
  bundle.apply(bundle.merge(bundle.collect(), { v: 1, slots: {}, index: [], graveyard: [], people: [], deleted: {} }));
  check(disk.get('frombirth.slot.' + id) === raw, 'a combine (as cloud saves do) leaves it where it was');
  check(JSON.parse(disk.get('frombirth.index')).some((m) => m.slotId === id), 'and on the list');
  section('an unreadable life is kept, not lost', n);
}

// 7. A life saved but missing from the list (the list did not fit) is found again; an entry with no save is not offered.
{
  const n = problems.length;
  disk.clear();
  const s = live(life({ firstName: 'Fay' }), 12); save.saveGame(s);
  disk.set('frombirth.index', '[]');
  check(save.listSlots().length === 0, 'the lost life is not on the list');
  check(save.recoverLostLives() === 1, 'it is found');
  const m = save.listSlots()[0];
  check(m?.slotId === s.slotId && m.name.startsWith('Fay') && m.age === s.player.age, 'and listed under its own name and age');
  check(save.recoverLostLives() === 0, 'once found, there is nothing more to find');
  disk.set('frombirth.index', JSON.stringify([...JSON.parse(disk.get('frombirth.index')), { slotId: 'life_gone', name: 'Gone', updatedAt: 1 }]));
  check(save.listSlots().length === 2 && save.loadGame('life_gone') === null, 'an entry whose save is gone stays listed (nothing hidden), and does not open');
  section('lives that dropped off the list are found again', n);
}

// 8. A large, long life: the code is verified, much smaller than the save, and loads whole.
{
  const n = problems.length;
  disk.clear();
  const s = live(life({ firstName: 'Gus' }), 70); save.saveGame(s);
  const raw = disk.get('frombirth.slot.' + s.slotId).length;
  const c = await bundle.exportCode();
  check(c.length < raw, `the code (${(c.length / 1e3).toFixed(0)}k characters) is smaller than the save (${(raw / 1e3).toFixed(0)}k)`);
  disk.clear();
  await bundle.importCode(c, 'replace');
  check(save.loadGame(s.slotId)?.player.age === s.player.age, 'and loads whole');
  section(`a long life (age ${s.player.age}) travels whole`, n);
}

// 9. Taking back a year that cannot be read leaves the history as it was.
{
  const n = problems.length;
  const s = save.loadGame(save.listSlots()[0].slotId);
  save.pushUndo(s);
  const key = 'frombirth.undo.' + s.slotId;
  const list = JSON.parse(disk.get(key)); list[list.length - 1] = '{"broken"'; disk.set(key, JSON.stringify(list));
  const raw = disk.get(key);
  check(save.popUndo(s.slotId) === null && disk.get(key) === raw, 'an unreadable earlier year is not taken back, and is not thrown away');
  section('a damaged age-down history is left alone', n);
}

for (const line of ok) console.log(line);
if (problems.length) { console.log(`\n${problems.length} problem(s):`); for (const p of problems) console.log(` - ${p}`); process.exit(1); }
console.log('\nSaved lives are kept safe.');
