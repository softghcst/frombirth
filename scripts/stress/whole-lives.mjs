// Plays many whole ordinary lives, in every country, with the systems running together: scenes answered at random,
// summer programs, lessons, clubs, practice, babies, then the next generation. After each year it checks that nothing
// broke: no exception, no NaN or Infinity anywhere in the player, stats and stress within 0–100, a birthday, the native
// language spoken, NPCs named. Every few years the save is written and read back. Reproducible from its seed.
// Run with: node scripts/stress/whole-lives.mjs [lives] [first-seed]
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: (i) => [...mem.keys()][i], get length() { return mem.size; } };
let seedState = 1;
Math.random = () => { seedState = (seedState + 0x6D2B79F5) >>> 0; let t = seedState; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
let clock = 1_800_000_000_000; Date.now = () => (clock += 17);

const { store } = await import('../../js/state.js');
const { rng } = await import('../../js/rng.js');
const { createLife } = await import('../../js/engine/characterGen.js');
const { advanceYear } = await import('../../js/engine/yearProcessor.js');
const { getEvent, resolveChoice, choiceStates } = await import('../../js/engine/eventEngine.js');
const { saveGame, peekGame } = await import('../../js/save.js');
const { die } = await import('../../js/engine/death.js');
const { continueAs } = await import('../../js/engine/legacy.js');
const { COUNTRIES } = await import('../../js/data/countries.js');
const { nativeLanguages } = await import('../../js/engine/languages.js');
const summer = await import('../../js/engine/summer.js');
const lessons = await import('../../js/engine/lessons.js');
const clubs = await import('../../js/engine/clubs.js');
const skills = await import('../../js/engine/skills.js');
const kids = await import('../../js/engine/children.js');
const { makeNpc } = await import('../../js/engine/npcFactory.js');

const LIVES = Number(process.argv[2] ?? 40);
const FIRST = Number(process.argv[3] ?? 1);
const failures = [];
const stats = { years: 0, scenes: 0, heirs: 0, babies: 0, saves: 0, countries: new Set() };

/** Every number in the player: none NaN or infinite. */
function badNumbers(obj, path = 'player', seen = new Set(), out = []) {
  if (!obj || typeof obj !== 'object' || seen.has(obj) || out.length > 5) return out;
  seen.add(obj);
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && !Number.isFinite(v)) out.push(`${path}.${k}=${v}`);
    else if (v && typeof v === 'object') badNumbers(v, `${path}.${k}`, seen, out);
  }
  return out;
}

function check(tag) {
  const s = store.state; const p = s.player;
  const bad = badNumbers(p);
  if (bad.length) throw new Error(`bad numbers: ${bad.join(', ')}`);
  for (const k of ['health', 'mood', 'intellect', 'charm', 'looks']) if (p.stats[k] != null && (p.stats[k] < 0 || p.stats[k] > 100)) throw new Error(`stat ${k}=${p.stats[k]}`);
  if (p.career?.stress != null && (p.career.stress < 0 || p.career.stress > 100)) throw new Error(`stress ${p.career.stress}`);
  if (!p.birthday) throw new Error('no birthday');
  for (const id of nativeLanguages(p)) if ((p.skills?.[id] ?? 0) < 100) throw new Error(`native ${id} at ${p.skills?.[id]}`);
  for (const id of p.npcIds) { const n = s.npcs[id]; if (n && !n.firstName) throw new Error(`npc ${id} has no name`); }
  if (!Number.isFinite(p.finance.cash)) throw new Error('cash');
}

function answerScenes() {
  for (let guard = 0; guard < 20 && store.state.pendingEvents.length; guard++) {
    const pe = store.state.pendingEvents.shift();
    const ev = getEvent(pe.id);
    if (!ev) continue;
    const open = choiceStates(ev, pe.cast ?? {}).map((c, i) => ({ ...c, i })).filter((c) => c.enabled && !c.hidden);
    if (!open.length) continue;
    resolveChoice(ev, rng.pick(open).i, pe.cast ?? {});
    stats.scenes++;
  }
  store.state.pendingEvents = [];
}

function doThings() {
  const p = store.state.player;
  if (p.age >= 9 && p.age <= 17 && rng.chance(0.5)) { const o = summer.summerOptions().filter((x) => !x.why); if (o.length) summer.goToSummer(rng.pick(o).id); }
  if (rng.chance(0.4)) { const o = lessons.lessonOptions().filter((x) => !x.why); if (o.length) lessons.takeLesson(rng.pick(o).id); }
  if (p.age >= 6 && rng.chance(0.2)) { const all = clubs.clubOptions?.() ?? []; const list = all.flatMap?.((g) => g.clubs ?? []) ?? []; const c = list.find?.((x) => !x.why && !x.member); if (c) clubs.join(c.id); }
  if (p.age >= 5 && rng.chance(0.5)) { const o = skills.skillOptions().flatMap((g) => g.skills).filter((s) => !s.tooYoung && !s.mastered); if (o.length) skills.practice(rng.pick(o).id); }
  if (p.age >= 22 && p.age <= 42 && rng.chance(0.3)) {
    let partner = p.npcIds.map((id) => store.state.npcs[id]).find((n) => n?.alive && ['spouse', 'partner'].includes(n.role));
    // Most lives find someone by now; one that has not is given a partner, so families and heirs get played too.
    if (!partner && p.age >= 26 && !p.npcIds.some((id) => store.state.npcs[id]?.role === 'spouse')) {
      partner = makeNpc({ role: 'spouse', countryId: p.countryId, age: p.age + rng.int(-3, 3), gender: (p.flags.bornAs ?? p.gender) === 'female' ? 'male' : 'female', relationship: 75 });
      store.state.npcs[partner.id] = partner; p.npcIds.push(partner.id);
    }
    if (partner && kids.canConceive?.(partner) !== false) { const r = kids.tryForBaby(partner.id); if (r?.ok) stats.babies++; }
  }
}

function liveOut(tag, maxYears) {
  for (let y = 0; y < maxYears && store.state.player.alive; y++) {
    doThings();
    store.state.pendingEvents ??= [];
    advanceYear();
    answerScenes();
    stats.years++;
    check(tag);
    if (y % 15 === 14) { saveGame(store.state); const back = peekGame(store.state.slotId); if (!back?.player) throw new Error('save did not read back'); stats.saves++; }
  }
}

const ids = Object.keys(COUNTRIES);
for (let i = 0; i < LIVES; i++) {
  const seed = FIRST + i;
  seedState = seed * 7919; rng.seed?.(seed);
  const countryId = ids[(seed * 37) % ids.length];
  const tag = `life ${seed} (${countryId})`;
  try {
    store.state = createLife({ countryId });
    store.state.settings = { ...(store.state.settings ?? {}), step: 12 };
    stats.countries.add(countryId);
    check(tag);
    liveOut(tag, 95);
    // The next generation, if there is one.
    const p = store.state.player;
    if (!p.alive || p.age > 60) {
      if (p.alive) die('natural causes');
      const kid = p.npcIds.map((id) => store.state.npcs[id]).find((n) => n?.alive && n.role === 'child' && n.age >= 1);
      if (kid) { const next = continueAs(kid.id); if (next) { store.state = next; stats.heirs++; check(`${tag} heir`); liveOut(`${tag} heir`, 25); } }
    }
  } catch (e) {
    failures.push(`${tag}, age ${store.state?.player?.age}: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
}
stats.kids = 0;
console.log(`${LIVES} lives in ${stats.countries.size} countries: ${stats.years} years, ${stats.scenes} scenes, ${stats.babies} babies, ${stats.heirs} heirs, ${stats.saves} save round-trips.`);
if (failures.length) { console.log(`FAILURES (${failures.length}):\n - ${failures.join('\n - ')}`); process.exit(1); }
console.log('Every life ran through without breaking.');
