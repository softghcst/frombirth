// Teams and jerseys (engine/teamIdentity.js, Settings → Teams and jerseys): every club has a name from its sport's
// kind of nicknames, home and away colors and numbered players with people's names; all of it can be renamed and
// recolored, the change reaches everywhere the team or person is shown, and a save keeps it.
// Run with: node tests/teams.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { hire } = await import('../js/engine/career.js');
const { CAREER_BY_ID } = await import('../js/data/careers.js');
const { MASCOTS, JERSEY_COLORS } = await import('../js/data/sports.js');
const { saveGame, loadGame } = await import('../js/save.js');
const sl = await import('../js/engine/sportsLife.js');
const sp = await import('../js/engine/sports.js');
const kit = await import('../js/engine/teamIdentity.js');

const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);

let s; do { s = createLife({ countryId: 'uk' }); } while (s.player.royal);
store.state = s;
const p = s.player;
p.age = 22; p.education.enrolled = false; p.flags.livesWithParents = false; p.finance.cash = 60000; p.talents.sports = 92;
hire(CAREER_BY_ID.athlete, 2, 70, 'offer');
sl.goPro('soccer');
p.stats.health = 95; advanceYear(); s.pendingEvents = [];
const e = sp.entryOf('soccer');
const team = sp.teamOf(e.teamId);
const org = sp.orgOf(team.orgId);
const L = kit.leagues().find((x) => x.mine);

// ---------- 1. Names, colors, numbers ----------
{
  check(L && L.teams.length >= 8 && L.teams.some((x) => x.team.id === team.id), 'the player\'s league is listed first, with its teams');
  const rivals = L.teams.filter((x) => x.team.id !== team.id);
  check(rivals.every((x) => MASCOTS.soccer.some((m) => x.org.name.replace(/ Women$/, '').endsWith(m))), `rival clubs have soccer's kind of names (${rivals.slice(0, 3).map((x) => x.org.name).join(', ')})`);
  const c = kit.colorsOf(org);
  check(/^#[0-9a-f]{6}$/i.test(c.home) && /^#[0-9a-f]{6}$/i.test(c.away) && c.home !== c.away, 'a club has two different jersey colors');
  check(JSON.stringify(kit.colorsOf(org)) === JSON.stringify(c), 'and keeps them');
  kit.numbersOf(team);
  const nums = team.roster.map((x) => x.num);
  check(nums.every((n) => n >= 1 && n <= 99) && new Set(nums).size === nums.length, 'every player has their own shirt number');
  check(L.teams.every((x) => x.team.roster.every((y) => /^\S+ \S+/.test(y.name))), 'every player on every team has a first and last name');
}
section('every club has a sport\'s kind of name, two jersey colors and numbered players with real names');

// ---------- 2. Renaming and recoloring ----------
{
  const before = store.state.journal.map((j) => j.text).join('|');
  const r = kit.renameTeam(org.id, '  Thornbury   Albion ');
  check(r.ok && org.name === 'Thornbury Albion' && team.name === 'Thornbury Albion', 'a team can be renamed (spaces tidied)');
  check(store.state.jobs.employers[org.employerId]?.name === 'Thornbury Albion', 'a professional club\'s employer takes the new name');
  check(store.state.journal.map((j) => j.text).join('|') === before, 'what was written in the past keeps the name it had then');
  const other = L.teams.find((x) => x.team.id !== team.id).org;
  check(!kit.renameTeam(other.id, 'thornbury albion').ok, 'two teams in a league cannot share a name');
  check(!kit.renameTeam(org.id, '').ok && !kit.renameTeam(org.id, 'x'.repeat(41)).ok, 'a name needs 1 to 40 characters');
  check(kit.setColors(org.id, '#00843d', '#f6f6f2').ok && org.colors.home === '#00843d', 'its colors can be changed');
  check(!kit.setColors(org.id, 'green', '#fff').ok, 'colors must be colors');
}
section('a team can be renamed (once in a league) and recolored; the past keeps its old name');

// ---------- 3. Players ----------
{
  const mate = team.roster.find((x) => x.npcId && store.state.npcs[x.npcId]);
  const stranger = team.roster.find((x) => !x.npcId && x.id !== p.id);
  check(kit.renamePlayer(team.id, stranger.id, 'Marcus Ellery').ok && stranger.name === 'Marcus Ellery', 'a player can be renamed');
  if (mate) {
    check(kit.renamePlayer(team.id, mate.id, 'Kofi Asante-Boateng').ok && store.state.npcs[mate.npcId].firstName === 'Kofi' && store.state.npcs[mate.npcId].lastName === 'Asante-Boateng', 'a teammate the player knows is renamed everywhere');
  }
  const me = team.roster.find((x) => x.id === p.id);
  check(!me || !kit.renamePlayer(team.id, me.id, 'Someone Else').ok, 'the player\'s own name is not changed here');
  check(!kit.renamePlayer(team.id, stranger.id, '1234').ok, 'a name is letters');
  const taken = team.roster.find((x) => x !== stranger).num;
  check(!kit.setNumber(team.id, stranger.id, taken).ok && kit.setNumber(team.id, stranger.id, 0).ok === !team.roster.some((x) => x !== stranger && x.num === 0), 'a number already worn is refused');
}
section('players can be renamed (a teammate everywhere, never the player) and given another number');

// ---------- 4. Kept in the save, and in the next season ----------
{
  saveGame(store.state);
  store.state = loadGame(store.state.slotId);
  const o2 = store.state.sports.orgs[org.id];
  const t2 = store.state.sports.teams[team.id];
  check(o2.name === 'Thornbury Albion' && o2.colors.home === '#00843d' && t2.roster.some((x) => x.name === 'Marcus Ellery'), 'a save keeps the names, colors and numbers');
  store.state.player.stats.health = 95; advanceYear(); store.state.pendingEvents = [];
  const season = Object.values(store.state.sports.seasons).filter((x) => x.playerId === store.state.player.id).sort((a, b) => b.year - a.year)[0];
  check(sp.standings(season).some((x) => sp.teamOf(x.teamId)?.name === 'Thornbury Albion'), 'the next season is played under the new name');
}
section('names, colors and numbers are saved, and the next season is played under them');

console.log(ok.map((x) => `ok  ${x}`).join('\n'));
if (problems.length) { console.log(`\n${problems.length} problem(s):\n${problems.join('\n')}`); process.exit(1); }
console.log('\nEvery team has a name, a jersey and players, and all of them can be changed.');
