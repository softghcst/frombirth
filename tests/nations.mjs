// Playing for one's country (engine/nations.js): nations strong and weak at each sport, the country an athlete is from,
// the summer and winter games, qualifiers, trials, the federation's invitation, and the World Baseball Classic.
// Run with: node tests/nations.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { SPORTS } = await import('../js/data/sports.js');
const sp = await import('../js/engine/sports.js');
const life = await import('../js/engine/sportsLife.js');
const n = await import('../js/engine/nations.js');
const bb = await import('../js/engine/baseball.js');

rng.seed(20261127);
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const caseOf = (name, fn) => { const k = problems.length; try { fn(); } catch (err) { problems.push(`${name}: threw ${err.stack.split('\n').slice(0, 2).join(' | ')}`); } ok.push(problems.length === k ? name : `(failed) ${name}`); };
const S = () => store.state; const P = () => store.state.player;
const maxOut = (e, v) => { for (const k of Object.keys(e.skills)) { e.ceiling[k] = Math.max(e.ceiling[k], v + 5); e.skills[k] = v; } };
/** An adult athlete from `countryId` with years of club play behind them, in `year`. */
function athlete(countryId, city, sportId, skill, year, level = 'club') {
  store.state = createLife({ countryId, city });
  const p = P(); p.age = 24; p.stats.health = 95; p.talents.sports = 95; p.legal.incarceration = null;
  S().year = year;
  sp.takeUp(sportId);
  const e = sp.entryOf(sportId); maxOut(e, skill);
  e.history.push({ year: year - 4, level, name: 'a club' }); e.level = level; e.seasonsPlayed = 5;
  return e;
}
const invites = (kind = 'gamesInvite') => life.openDecisions().filter((d) => d.kind === kind);

caseOf('some nations are far stronger at a sport, and harder to be picked for', () => {
  check(n.nationStrength('running', 'ke') > n.nationStrength('running', 'us') && n.nationStrength('running', 'us') > n.nationStrength('running', 'eg'), 'Kenya runs best');
  check(n.nationStrength('basketball', 'us') >= 94 && n.nationStrength('table_tennis', 'cn') >= 94 && n.nationStrength('baseball', 'jp') >= 94 && n.nationStrength('soccer', 'br') >= 94, 'the powers: American basketball, Chinese table tennis, Japanese baseball, Brazilian soccer');
  check(n.nationStrength('ice_hockey', 'eg') === 50, 'a sport a country does not play at all is its weakest');
  check(n.selectionBar('basketball', 'us', true) >= 80 && n.selectionBar('basketball', 'eg', true) <= 66, `a place on the American team is far harder to win (${n.selectionBar('basketball', 'us', true)} against ${n.selectionBar('basketball', 'eg', true)})`);
});

caseOf('an athlete plays for the country they are from, not where they live', () => {
  store.state = createLife({ countryId: 'jp', city: 'Tokyo' });
  P().countryId = 'us'; P().city = 'Chicago';
  check(n.nationOf(P()) === 'jp', `born in Japan, living in the United States: Japan (${n.nationOf(P())})`);
});

caseOf('the summer games, the winter games between them, and the sports at neither', () => {
  check(n.gamesOf(SPORTS.soccer, 2028) && !n.gamesOf(SPORTS.soccer, 2026) && n.gamesOf(SPORTS.ice_hockey, 2026)?.season === 'winter' && !n.gamesOf(SPORTS.ice_hockey, 2028), 'soccer in 2028, ice hockey in 2026');
  check(!n.gamesOf(SPORTS.american_football, 2028) && !n.gamesOf(SPORTS.cricket, 2024) && n.gamesOf(SPORTS.cricket, 2028) && !n.gamesOf(SPORTS.baseball, 2024), 'no American football; cricket from 2028; baseball not in 2024');
  check(/^Para /.test(n.gamesOf(SPORTS.para_swimming, 2028).name), 'para sports at the para games');
});

caseOf('qualifiers: the strongest go straight through, the weakest seldom qualify, and each is decided once', () => {
  store.state = createLife({ countryId: 'us', city: 'Chicago' });
  check(n.nationQualified(S(), 'games', 'basketball', 'us', 2028).auto, 'the United States go straight through');
  let weak = 0; let mid = 0;
  for (let y = 1900; y < 2100; y += 4) { if (n.nationQualified(S(), 'games', 'basketball', 'eg', y).qualified) weak++; if (n.nationQualified(S(), 'games', 'basketball', 'gr', y).qualified) mid++; }
  check(weak < mid && weak <= 25, `Egypt qualifies less often than Greece (${weak} against ${mid} of 50)`);
  const a = n.nationQualified(S(), 'games', 'soccer', 'mx', 2032);
  check(n.nationQualified(S(), 'games', 'soccer', 'mx', 2032) === a, 'kept');
});

caseOf('an individual: the trials, the invitation, and the games for their country', () => {
  const e = athlete('ke', 'Nairobi', 'running', 92, 2028);
  n.yearInternational(S(), sp.myAthlete(), e);
  const d = invites()[0];
  check(d && d.nation === 'ke' && /trials/.test(d.text), `a Kenyan runner who made the standard is invited (${d?.text})`);
  const r = life.answer(d.id, 'yes');
  const ev = e.events.map((id) => S().sports.events[id]).find((x) => x?.games);
  check(r.ok && ev && ev.year === 2028 && ev.nation === 'ke' && /World Games 2028/.test(ev.name), `and runs at the World Games for Kenya (${r.text})`);
  n.yearInternational(S(), sp.myAthlete(), e);
  check(!invites().length, 'once a games');
});

caseOf('not good enough for a strong nation: the trials are missed, and told', () => {
  const e = athlete('ke', 'Nairobi', 'running', 74, 2028);
  n.yearInternational(S(), sp.myAthlete(), e);
  check(!invites().length && (e.gamesMissed ?? []).includes(2028) && S().journal.some((j) => /trials/.test(j.text)), 'missed the standard');
  const f = athlete('eg', 'Cairo', 'running', 74, 2028);
  n.yearInternational(S(), sp.myAthlete(), f);
  check(invites().length === 1, 'the same runner from a weaker nation makes its team');
});

caseOf('a team: the nation must qualify, then the player must make the squad; declining is allowed', () => {
  let y = 2028;
  while (!n.nationQualified(createLife({ countryId: 'gr', city: 'Athens' }) && store.state, 'games', 'basketball', 'gr', y).qualified) y += 4;
  const e = athlete('gr', 'Athens', 'basketball', 92, y, 'pro');
  n.nationQualified(S(), 'games', 'basketball', 'gr', y);
  n.yearInternational(S(), sp.myAthlete(), e);
  const d = invites()[0];
  check(d && d.team && d.nation === 'gr', `Greece qualified and want the player (${d?.text})`);
  const r = life.answer(d.id, 'yes');
  const t = e.gamesTeams.find((x) => x.year === y && x.picked);
  check(r.ok && t && t.nation === 'gr' && t.field[0] === 'gr' && t.rounds.length >= 1 && e.caps > 0, `played for Greece (${r.text})`);
  const g = athlete('gr', 'Athens', 'basketball', 92, y, 'pro');
  n.yearInternational(S(), sp.myAthlete(), g);
  life.answer(invites()[0].id, 'no');
  check(g.gamesTeams.some((x) => x.year === y && x.declined) && !g.gamesTeams.some((x) => x.rounds), 'turned down');
  let z = 2028;
  while (n.nationQualified(S(), 'games', 'basketball', 'eg', z).qualified) z += 4;
  const h = athlete('eg', 'Cairo', 'basketball', 92, z, 'pro');
  n.yearInternational(S(), sp.myAthlete(), h);
  check(!invites().length && h.gamesTeams.some((x) => x.year === z && x.notQualified), 'a nation out in the qualifiers takes no one');
});

caseOf('no record, no games', () => {
  store.state = createLife({ countryId: 'ke', city: 'Nairobi' });
  P().age = 24; S().year = 2028;
  sp.takeUp('running'); const e = sp.entryOf('running'); maxOut(e, 95);
  n.yearInternational(S(), sp.myAthlete(), e);
  check(!invites().length, 'a runner who has only run for fun is not invited');
});

caseOf('the World Baseball Classic: the home nation, its qualifier, and amateurs where the nation is small', () => {
  let y = 2030;
  while (!n.nationQualified(createLife({ countryId: 'co', city: 'Bogotá' }) && store.state, 'classic', 'baseball', 'co', y).qualified) y += 4;
  const e = athlete('co', 'Bogotá', 'baseball', 80, y, 'club');
  n.nationQualified(S(), 'classic', 'baseball', 'co', y);
  check(bb.classicYear(y), 'setup: a Classic year');
  n.yearInternational(S(), sp.myAthlete(), e);
  const d = invites('classicInvite')[0];
  check(d && d.nation === 'co', `Colombia want a good club player (${d?.text})`);
  const r = life.answer(d.id, 'yes');
  check(r.ok && bb.record(e).classic.some((x) => x.year === y && x.nation === 'co'), `and he plays (${r.text})`);
  const j = athlete('jp', 'Tokyo', 'baseball', 80, y, 'club');
  n.yearInternational(S(), sp.myAthlete(), j);
  check(!invites('classicInvite').length, 'Japan take big leaguers, not club players');
});

for (const name of ok) console.log(`${name.startsWith('(failed)') ? 'FAIL' : 'ok  '} ${name.replace(/^\(failed\) /, '')}`);
if (problems.length) { console.log(problems.map((x) => `  ✗ ${x}`).join('\n')); process.exit(1); }
console.log('Athletes play for their country, when they are good enough and their country qualifies.');
