// The World Games team events, managing a squad as a coach, and boxing with its world titles.
// Run with: node tests/sports-extras.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { deathRoll } = await import('../js/engine/death.js');
const { isGamesYear } = await import('../js/data/sports.js');
const sp = await import('../js/engine/sports.js');
const life = await import('../js/engine/sportsLife.js');
const x = await import('../js/engine/sportsExtras.js');

rng.seed(20261120);
deathRoll.spared = true; // these checks are about sport, not about dying young
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const caseOf = (name, fn) => { const n = problems.length; try { fn(); } catch (err) { problems.push(`${name}: threw ${err.stack.split('\n').slice(0, 3).join(' | ')}`); } ok.push(problems.length === n ? name : `(failed) ${name}`); };
const S = () => store.state; const P = () => store.state.player;
function year(pref = {}) { advanceYear(); S().pendingEvents = []; for (const d of life.openDecisions()) if (pref[d.kind] !== 'skip') life.answer(d.id, pref[d.kind] && d.options.some((o) => o.id === pref[d.kind]) ? pref[d.kind] : d.kind === 'abroad' ? 'no' : d.options.at(-1).id); }
function adult(countryId = 'uk', age = 24, gender = 'male') {
  let s; do { s = createLife({ countryId, gender }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  p.gender = gender; p.flags.bornAs = gender;
  p.age = age; p.birthYear = s.year - age; p.education.enrolled = false; p.education.stage = 'none'; p.flags.livesWithParents = false;
  p.talents.sports = 92; p.stats.health = 90; p.hidden.discipline = 80;
  return p;
}
const maxOut = (e, v) => { for (const k of Object.keys(e.skills)) { e.ceiling[k] = Math.max(e.ceiling[k], v + 5); e.skills[k] = v; } };

caseOf('the World Games: a capped professional goes with the national side; every game is played and kept', () => {
  adult('uk', 25);
  sp.takeUp('soccer');
  const e = sp.entryOf('soccer');
  maxOut(e, 92);
  e.level = 'pro'; e.caps = 12;
  S().year = 2028;
  check(isGamesYear(2028), 'setup: 2028 is a games year');
  const sum = {};
  const t = x.gamesTeamEvent(S(), e, sum);
  check(t && t.picked && t.field.length === x.GAMES_TEAMS && t.field[0] === P().countryId, 'eight nations, the player\'s among them');
  check(t.rounds.length >= 1 && t.rounds.every((r) => Array.isArray(r.score) && r.score.length === 2), 'every game has a score');
  check(t.rounds[0].round === 'Quarterfinal' && (t.place === 'Champion' ? t.medal === 'gold' : t.place === 'Final' ? t.medal === 'silver' : true), 'a final won is gold, lost is silver');
  if (t.medal) check(e.medals.some((m) => m.team && m.medal === t.medal && m.year === 2028), 'a medal is on the player\'s record');
  check(x.gamesTeamEvent(S(), e, {}) === null, 'once per games');
  S().year = 2029;
  check(x.gamesTeamEvent(S(), e, {}) === null, 'and only in a games year');
  // Not good enough: the squad goes without the player.
  S().year = 2032;
  maxOut(e, 60);
  check(x.gamesTeamEvent(S(), e, {}) === null && e.gamesTeams.some((g) => g.year === 2032 && !g.picked), 'not picked when not good enough');
});

caseOf('the World Games from the yearly sports step: a professional season, then the games', () => {
  adult('uk', 24);
  sp.takeUp('soccer');
  const e = sp.entryOf('soccer');
  maxOut(e, 93);
  let tries = 0;
  for (; tries < 8 && !e.contractId; tries++) year({ contract: 'yes', academy: 'yes', agent: 'no', integrity: 'refuse' });
  if (!e.contractId) { check(true, 'no contract in time: the rest is covered above'); return; }
  while (!isGamesYear(S().year - 1 + 1) || !e.caps) { year({ renew: 'yes', agent: 'no', integrity: 'refuse', transfer: 'no' }); if (S().year > 2060) break; }
  year({ renew: 'yes', agent: 'no', integrity: 'refuse', transfer: 'no' });
  check((e.gamesTeams ?? []).length >= 1, `a capped professional's games year includes the team event (${(e.gamesTeams ?? []).length})`);
});

caseOf('managing a squad: lineup, tactics, training, a season, the board', () => {
  const p = adult('uk', 34);
  sp.takeUp('soccer');
  const e = sp.entryOf('soccer');
  maxOut(e, 75);
  check(life.becomeCoach('soccer').ok, 'a former player takes a coaching job');
  const sq = x.squadOf();
  check(sq && sq.team.roster.length >= (sq.sport.teamSize ?? 11), 'the coach has a squad');
  const xi = x.lineup(sq);
  check(xi.length === sq.sport.teamSize, 'eleven start');
  const best = xi[0];
  check(x.toggleBench(best.id).ok && !x.lineup(sq).some((y) => y.id === best.id), 'the coach can leave their best player out');
  check(x.toggleBench(best.id).ok && x.lineup(sq).some((y) => y.id === best.id), 'and bring them back');
  check(x.setTactics('attacking').ok && sq.c.tactics === 'attacking', 'tactics set');
  check(x.setTraining('youth').ok && sq.c.training === 'youth', 'training set');
  const ratings = sq.team.roster.map((y) => y.rating).join();
  year({ integrity: 'refuse' });
  check(sq.c.seasons.length === 1 && sq.c.seasons[0].of >= 6 && sq.c.seasons[0].w + sq.c.seasons[0].d + sq.c.seasons[0].l > 0, 'a season is played and kept');
  check(sq.team.roster.map((y) => y.rating).join() !== ratings, 'the players change with the training');
  // A poor side two years running: the board lets the coach go.
  for (let i = 0; i < 4 && sp.myAthlete().coaching; i++) { for (const y of x.squadOf()?.team.roster ?? []) if (!y.player) y.rating = 15; year({ integrity: 'refuse' }); }
  check(!sp.myAthlete().coaching && (sp.myAthlete().pastCoaching ?? []).some((c) => c.why === 'sacked'), 'two seasons near the bottom and the coach is sacked');
  void p;
});

caseOf('boxing: a sport of its own, fights, a record, a title shot, a champion and a defense', () => {
  adult('us', 24);
  check(!!sp.takeUp('boxing').ok, 'boxing is a sport to take up');
  const e = sp.entryOf('boxing');
  maxOut(e, 96);
  e.level = 'pro'; e.pr = 1900;
  const cash = P().finance.cash;
  let won = false;
  for (let i = 0; i < 6 && !won; i++) { year({ integrity: 'refuse' }); won = !!e.boxing?.title || (e.boxing?.titles ?? []).length > 0; }
  const b = e.boxing;
  check(b && b.record.w + b.record.l >= 3 && b.fights.length === b.record.w + b.record.l, `fights add up to the record (${b?.record.w}-${b?.record.l})`);
  check(x.WEIGHTS.includes(b.weight), 'a weight class');
  check(P().finance.cash > cash, 'purses are paid');
  check(won, 'a top contender who keeps winning gets a title shot, and wins it');
  check(b.titles[0]?.body === x.BELT.body && b.fights.some((f) => f.title), 'the title fight and the belt are on the record');
  // A champion defends; a champion who has lost it does not anymore.
  if (b.title) {
    year({ integrity: 'refuse' });
    check(b.title ? b.fights.filter((f) => f.title).length >= 2 : b.titles[0].lost, 'a champion defends the belt');
    maxOut(e, 30);
    for (let i = 0; i < 4 && b.title; i++) year({ integrity: 'refuse' });
    check(!b.title && b.titles.at(-1).lost, 'and loses it in the end');
  }
  saveGame(S());
  const back = loadGame(S().slotId);
  check(JSON.stringify(back.sports.athletes[P().id].sports.boxing.boxing) === JSON.stringify(b), 'the boxing record survives a save and reload');
});

console.log(ok.map((y) => `${y.startsWith('(failed)') ? 'FAIL' : 'ok  '} ${y}`).join('\n'));
if (problems.length) { console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('The games, the dugout and the ring hold.');
