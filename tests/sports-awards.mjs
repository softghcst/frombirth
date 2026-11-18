// End-of-season awards (engine/sportsAwards.js): every league names its awards once, each sport its own (MVP, Rookie
// of the Year, Golden Boot, Sixth Man, Pitcher of the Year...), the player's own season decides their chances, the
// winners are real people and teams in that league, a reload changes nothing, and what the player wins is on their record.
// Run with: node tests/sports-awards.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { hire } = await import('../js/engine/career.js');
const { CAREER_BY_ID } = await import('../js/data/careers.js');
const { SPORTS, SPORTS_LIST, SEASON_AWARDS, awardsFor, AWARD_LINEUPS } = await import('../js/data/sports.js');
const { saveGame, loadGame } = await import('../js/save.js');
const sl = await import('../js/engine/sportsLife.js');
const sp = await import('../js/engine/sports.js');
const aw = await import('../js/engine/sportsAwards.js');
const fame = await import('../js/engine/fame.js');

const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);

function pro(sport, cc = 'us', o = {}) {
  let s; do { s = createLife({ countryId: cc, ...(o.gender ? { gender: o.gender } : {}) }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  if (o.gender) p.gender = o.gender;
  p.age = 22; p.education.enrolled = false; p.flags.livesWithParents = false; p.finance.cash = 60000; p.talents.sports = o.talent ?? 95;
  hire(CAREER_BY_ID.athlete, 2, 70, 'offer');
  const r = sl.goPro(sport);
  if (!r.ok) throw new Error(r.text);
  const e = sp.entryOf(sport);
  if (o.star) for (const k of Object.keys(e.skills)) e.skills[k] = e.ceiling[k] = 97;
  return p;
}
const year = () => {
  const p = store.state.player;
  p.stats.health = 95; p.legal.pending = null; p.legal.incarceration = null;
  advanceYear(); store.state.pendingEvents = [];
  for (const d of sl.openDecisions()) sl.answer(d.id, d.kind === 'retire' ? 'no' : d.kind === 'integrity' ? 'refuse' : (d.options.find((x) => x.id === 'yes') ?? d.options[0]).id);
};
const seasonsOf = (sport) => Object.values(store.state.sports.seasons).filter((x) => x.playerId === store.state.player.id && x.sportId === sport && x.level === 'pro').sort((a, b) => a.year - b.year);

// ---------- 1. Every team sport has its awards ----------
{
  for (const s of SPORTS_LIST.filter((x) => x.kind === 'team')) {
    const list = awardsFor(s);
    check(list.some((a) => a.kind === 'best') && list.some((a) => ['rookie', 'young'].includes(a.kind)) && list.some((a) => a.kind === 'team'), `${s.name}: a best player, a newcomer's award and a team of the season`);
    for (const a of list.filter((x) => x.pos)) check(a.pos.every((pos) => s.positions.some((x) => x[0] === pos)), `${s.name}: ${a.name} is for positions the sport has`);
    if (AWARD_LINEUPS[s.id]) check(Object.keys(AWARD_LINEUPS[s.id]).every((pos) => s.positions.some((x) => x[0] === pos)), `${s.name}: the team of the season lines up in the sport's positions`);
  }
  const names = (id) => awardsFor(SPORTS[id]).map((a) => a.name);
  check(['Player of the Season', 'Young Player of the Season', 'Golden Boot', 'Golden Glove'].every((n) => names('soccer').includes(n)), 'soccer: Player of the Season, Young Player, Golden Boot, Golden Glove');
  check(['Most Valuable Player', 'Rookie of the Year', 'Defensive Player of the Year', 'Sixth Man of the Year', 'Most Improved Player', 'Scoring Title'].every((n) => names('basketball').includes(n)), 'basketball: MVP, Rookie, Defensive Player, Sixth Man, Most Improved, Scoring Title');
  check(['Pitcher of the Year', 'Batting Title'].every((n) => names('baseball').includes(n)) && names('american_football').includes('Comeback Player of the Year') && names('ice_hockey').includes('Best Goaltender'), 'baseball, American football and hockey have their own');
  check(Object.keys(SEASON_AWARDS).length >= 10, 'ten team sports have their own lists');
}
section('every team sport names its own awards: a best player, a newcomer, its statistics and positions, a team of the season');

// ---------- 2. A basketball career: awards every season, from the season played ----------
{
  const p = pro('basketball', 'us', { star: true, gender: 'male' });
  const e = sp.entryOf('basketball');
  for (let y = 0; y < 8 && p.alive; y++) year();
  const seasons = seasonsOf('basketball');
  check(seasons.length >= 6 && seasons.every((s) => Array.isArray(s.awards) && s.awards.length === awardsFor(SPORTS.basketball).length), `every professional season names its awards (${seasons.length} seasons)`);
  for (const s of seasons) {
    for (const a of s.awards.filter((x) => x.winner)) check(s.teamIds.includes(a.winner.teamId), `${s.year} ${a.name}: the winner plays (or coaches) in this league`);
    const mvp = s.awards.find((a) => a.id === 'mvp');
    check(mvp?.winner, `${s.year}: there is an MVP`);
    const first = s.awards.find((a) => a.kind === 'team');
    check(first.team.length === 5 && new Set(first.team.map((x) => x.who)).size === 5, `${s.year}: the All-League First Team is five different players`);
    const scoring = s.awards.find((a) => a.id === 'scoring');
    if (scoring.winner?.who === 'player') check(Math.abs(scoring.winner.value - Math.round((e.stats[s.year].points / s.fixtures.concat(s.playoffs).filter((f) => f.me?.played).length) * 10) / 10) < 0.11, `${s.year}: the scoring title is the points the player actually scored`);
    // Asked again, a season's awards do not change.
    const before = JSON.stringify(s.awards);
    check(aw.seasonAwards(store.state, s, e, sp.teamOf(s.playerTeamId)).length === 0 && JSON.stringify(s.awards) === before, `${s.year}: awards are named once`);
  }
  const mine = e.awards ?? [];
  check(mine.every((a) => { const s = store.state.sports.seasons[a.seasonId]; const x = s?.awards.find((y) => y.id === a.id); return x && (x.winner?.who === 'player' || x.team?.some((t) => t.who === 'player')); }), 'every award on the player\'s record is one they won');
  check(new Set(mine.map((a) => a.key)).size === mine.length, 'no award is recorded twice');
  check(mine.filter((a) => a.id === 'rookie').length <= 1 && mine.filter((a) => a.id === 'rookie').every((a) => a.year === seasons[0].year), 'Rookie of the Year only in the first professional season');
  check(mine.some((a) => a.id === 'mvp'), `a star wins the MVP at least once (${mine.filter((a) => a.kind !== 'team').map((a) => `${a.year} ${a.name}`).join(', ') || 'none'})`);
  check(mine.filter((a) => a.id === 'mvp').every((a) => p.milestones.some((m) => m.text.startsWith(`Most Valuable Player`))), 'winning it is a milestone');
  check(fame.fameOf(p).log.some((l) => l.audience === 'sports'), 'awards are part of a name with sports fans');
}
section('basketball: awards every season, winners from the league, the player\'s numbers decide their own, named once, on the record');

// ---------- 3. A reload names the same winners ----------
{
  pro('soccer', 'uk');
  year();
  saveGame(store.state);
  const slot = store.state.slotId;
  year();
  const first = JSON.stringify(seasonsOf('soccer').at(-1)?.awards);
  store.state = loadGame(slot);
  year();
  check(first && JSON.stringify(seasonsOf('soccer').at(-1)?.awards) === first, 'living the same season again after a reload names the same winners');
  const s = seasonsOf('soccer').at(-1);
  check(s.awards.find((a) => a.kind === 'team').team.length === 11, 'the Team of the Season is an eleven');
  check(['boot', 'glove'].every((id) => s.awards.find((a) => a.id === id)?.winner?.value >= 0), 'the Golden Boot and Golden Glove say how many');
}
section('soccer: a reload names the same winners; the Team of the Season is an eleven');

// ---------- 4. Women's leagues, and university sport ----------
{
  pro('basketball', 'us', { gender: 'female' });
  year();
  const s = seasonsOf('basketball').at(-1);
  check(s.awards.some((a) => a.name === 'Sixth Player of the Year') && !s.awards.some((a) => a.name === 'Sixth Man of the Year'), 'the women\'s game names its sixth player');
  const college = structuredClone(s); college.id = `${s.id}_c`; college.level = 'college'; delete college.awards;
  store.state.sports.seasons[college.id] = college;
  aw.seasonAwards(store.state, college, sp.entryOf('basketball'), sp.teamOf(s.playerTeamId));
  check(college.awards.some((a) => a.name === 'Player of the Year') && college.awards.some((a) => a.name === 'Freshman of the Year'), 'university sport has its Player of the Year and Freshman of the Year');
  delete store.state.sports.seasons[college.id];
}
section('the women\'s game and university sport name their awards their own way');

// ---------- 5. Individual sports: the year's honors ----------
{
  pro('tennis', 'us', { star: true });
  const e = sp.entryOf('tennis');
  for (let y = 0; y < 5; y++) year();
  const years = Object.entries(store.state.sports.yearAwards ?? {}).filter(([k]) => k.startsWith('tennis/pro/'));
  check(years.length >= 4 && years.every(([, list]) => list.length === 3 && list[0].name === 'Player of the Year' && list[0].winner), `a professional tennis year names a Player of the Year (${years.length} years)`);
  check((e.awards ?? []).filter((a) => a.id === 'newcomer').every((a) => a.year === e.firstSeasonAt.pro), 'Newcomer of the Year only in the first professional year');
  check(years.every(([, list]) => list.filter((a) => a.winner?.who === 'player').every((a) => (e.awards ?? []).some((x) => x.id === a.id && x.year === Number(list && years.find(([, l]) => l === list)[0].split('/')[2])))), 'what the player wins is on their record');
}
section('tennis: Player of the Year, Newcomer and Comeback each year, the newcomer only once');

console.log(ok.map((x) => `ok  ${x}`).join('\n'));
if (problems.length) { console.log(`\n${problems.length} problem(s):\n${problems.join('\n')}`); process.exit(1); }
console.log('\nEvery season ends with its awards.');
