// Talents (engine/talentGrowth.js): a gift is inherited and hidden; how good someone is starts low and is built. The
// years bring a talent on to about half the gift; practice takes it further; a gift shows itself, a hint and then for
// certain, sooner for someone who tries; a sport's ceiling comes from the gift. Run with: node tests/talents.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const tg = await import('../js/engine/talentGrowth.js');
const sp = await import('../js/engine/sports.js');

rng.seed(Number(process.env.SEED ?? 4));
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;
const life = (o = {}) => { do { store.state = createLife({ countryId: 'us', ...o }); } while (S().player.royal); return P(); };
const year = () => { const p = P(); p.stats.health = 95; p.legal.pending = null; p.legal.incarceration = null; advanceYear(); S().pendingEvents = []; };

// ---------- 1. Born low, whatever the gift ----------
{
  let worst = 0;
  for (let k = 0; k < 30; k++) { const p = life({ talent: 'sports' }); worst = Math.max(worst, ...Object.values(p.talents)); check(p.potential.sports >= 75, 'a chosen gift is a gift'); }
  check(worst <= 12, `a baby is in single figures (or nearly) at everything, gift or not (highest ${worst})`);
  const p = life({ talent: 'music' });
  check(p.flags.gifts.includes('music') && !S().journal.some((e) => /hints at a gift/.test(e.text)), 'the gift is known to the game, not yet to the player');
}
section('everyone starts low; the gift is hidden');

// ---------- 2. The years bring a talent on, never down ----------
{
  const p = life({ talent: 'sports' });
  const g = p.potential.sports;
  let last = p.talents.sports; let down = false;
  while (p.age < 18 && p.alive) { year(); if (p.talents.sports < last) down = true; last = p.talents.sports; }
  check(!down, 'a talent never falls with the years');
  check(p.talents.sports >= g * 0.4 && p.talents.sports <= g * 0.75, `with little effort a gift of ${g} is about half grown at 18 (${p.talents.sports})`);
  const low = life({}); const lg = low.potential.music;
  while (low.age < 18 && low.alive) year();
  check(low.talents.music <= Math.max(lg * 0.75, 12), `and a small gift stays small (${low.talents.music} of ${lg})`);
  // Practice takes it further and is not undone.
  const q = life({ talent: 'dance' });
  while (q.age < 10) year();
  q.talents.dance = 80; year();
  check(q.talents.dance >= 80, 'practice beyond what the years bring is kept');
}
section('the years bring a talent on toward half the gift; practice takes it further');

// ---------- 3. A gift shows itself ----------
{
  let known = 0; let hints = 0; let lives = 0;
  const tried = []; const idle = [];
  // Enough lives that the comparison below is not decided by one run of the dice (40 could flip it).
  for (let k = 0; k < 80; k++) {
    const p = life({ talent: 'sports' }); lives++;
    const practice = k % 2 === 0;
    let at = null;
    while (p.age < 18 && p.alive) {
      if (practice && p.age >= 4) p.talents.sports = Math.min(100, p.talents.sports + 4);
      year();
      const f = p.flags.found?.sports;
      if (f && at == null) at = p.age;
    }
    if (p.flags.found?.sports) hints++;
    if (p.flags.found?.sports === 'known') known++;
    (practice ? tried : idle).push(at ?? 19);
    check(!Object.entries(p.flags.found ?? {}).some(([id]) => p.potential[id] < 65), 'only real gifts are found');
  }
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  check(hints >= lives * 0.8 && known >= lives * 0.5, `by 18 most gifted children have noticed (${hints} of ${lives}), and many know for certain (${known})`);
  check(mean(tried) < mean(idle), `trying the thing shows it sooner (${mean(tried).toFixed(1)} against ${mean(idle).toFixed(1)})`);
  // Not every gifted child notices by 18 (checked above, most do): take the first who does.
  let p;
  for (let k = 0; k < 8; k++) { p = life({ talent: 'sports' }); while (p.age < 18 && !(p.flags.found?.sports)) year(); if (p.flags.found?.sports) break; }
  check(S().journal.some((e) => /You feel slightly more athletically inclined\./.test(e.text)), 'first a feeling: "You feel slightly more athletically inclined."');
  check(tg.noticed(p).some((x) => x.id === 'sports'), 'and it is on the Talents screen');
}
section('a gift shows itself: a feeling, then for certain; sooner for those who try');

// ---------- 4. What reads the gift ----------
{
  const gifted = life({ talent: 'sports' });
  while (gifted.age < 8) year();
  gifted.potential.sports = 95;
  sp.takeUp('soccer'); const a = sp.entryOf('soccer');
  const plain = life({});
  while (plain.age < 8) year();
  plain.potential.sports = 25; plain.talents.sports = gifted.talents.sports;
  sp.takeUp('soccer'); const b = sp.entryOf('soccer');
  const avg = (e) => Object.values(e.ceiling).reduce((x, y) => x + y, 0) / Object.keys(e.ceiling).length;
  check(a && b && avg(a) > avg(b) + 5, `a sport's ceiling comes from the gift, not from a child's level now (${a && avg(a).toFixed(0)} against ${b && avg(b).toFixed(0)})`);
  // An older save: one number per talent becomes the gift too, and nothing is lowered.
  const old = life({}); delete old.potential; old.talents.music = 70;
  tg.ensurePotential(old);
  check(old.potential.music === 70 && old.talents.music === 70, 'an older save keeps what it had');
}
section('a sport\'s ceiling and older saves');

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const x of [...new Set(problems)]) console.log(' ✗', x);
  process.exit(1);
}
for (const x of ok) console.log(' ✓', x);
console.log('Talents start low, grow, and are found.');
