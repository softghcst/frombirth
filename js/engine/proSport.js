// Professional sport as a career in the public eye (the fame work). The athletic
// life itself, from first lessons to clubs and seasons, is engine/sports.js; the two
// are separate for now and share nothing in the save.
//
// A professional athlete's fame comes only from results the game has
// played out: league seasons with every match decided, tables, top scorers,
// players of the year; tournaments and meets with draws and finals; the World
// Games every four years. The athlete's wage is the career's (engine/career.js);
// this engine adds the sport itself, and never pays anything.
//
//   state.proSport.leagues['cc:sport'] = { id, sport, countryId, name, teams:[Team], seasons:[Season] }
//     Team:   { id, name, city, strength, star (npcId), titles:[year] }
//     Season: { year, table:[[teamId, w, d, l, for, against, pts]], champion, top:{ who, name, teamId, value }, best:{ who, name, teamId } }
//   state.proSport.circuits[sport] = { rivals:[npcId], seasons:[{ year, events:[{ name, city, countryId, winner:{who,name} }], ranking:[{who,name,points}], games? }] }
//   p.sport = { sport, teamId, leagueId, since, seasons:[PlayerSeason], titles:[], medals:[], caps, retiredYear, offer }
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, log, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { SPORTS, TEAM_WORDS, EVENT_WORDS, WORLD_GAMES } from '../data/fame.js';
import { makeNpc } from './npcFactory.js';
import { gain, regard } from './fame.js';
import { registerEmployer } from './employers.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const year = () => store.state.year;
// Kept under its own key in the save: the athletics engine (engine/sports.js) owns state.sports.
const S = () => { const st = store.state; st.proSport ??= { seq: 0, leagues: {}, circuits: {} }; return st.proSport; };
const nextId = (pre) => `${pre}_${(S().seq += 1).toString(36)}`;
const nameOf = (who) => (who === 'player' ? `${player().firstName} ${player().lastName}` : store.state.npcs[who] ? `${store.state.npcs[who].firstName} ${store.state.npcs[who].lastName}` : '');

export const sportOf = (p = player()) => p.sport ?? null;
/**
 * A professional athlete whose career this engine runs. An athlete who came up
 * through the athletic life (engine/sports.js) plays under that engine's own
 * contract (career.sportContract): their seasons, club and pay are its business,
 * and this engine leaves them alone.
 */
export const isAthlete = (p = player()) => p.career?.careerId === 'athlete' && !p.career.sportContract;
export const playedIn = (sport, y = year(), div = 'men') => !!SPORTS[sport] && y >= (div === 'women' ? SPORTS[sport].womenFrom ?? SPORTS[sport].founded : SPORTS[sport].founded);
/** Which side of the sport the player competes in: women's or men's. Non-binary players choose. */
export const divOf = (p = player()) => p.sport?.div ?? p.flags?.sportDiv ?? (p.gender === 'female' ? 'women' : 'men');
const leagueKey = (countryId, sport, div) => (div === 'women' ? `${countryId}:${sport}:women` : `${countryId}:${sport}`);
const circuitKey = (sport, div) => (div === 'women' ? `${sport}:women` : sport);

/** How well the player plays this year: talent, fitness and discipline, on the day. */
export function rating(p = player()) {
  return Math.round(clamp(p.talents.sports * 0.8 + p.stats.health * 0.1 + (p.hidden.discipline ?? 50) * 0.1 - Math.max(0, p.age - 31) * 1.5));
}
const npcRating = (id) => store.state.npcs[id]?.flags.star?.skill.sports ?? 60;

function athleteNpc(countryId, level, div = 'men') {
  const age = rng.int(19, 32);
  const n = makeNpc({ role: 'performer', countryId, age, relationship: rng.int(35, 55), gender: div === 'women' ? 'female' : 'male' });
  n.flags.star = { skill: { sports: Math.round(clamp(rng.around(level, 6), 40, 98)) }, born: year() - age, fame: 0, credits: [], kind: 'athlete' };
  n.occupation = 'professional athlete';
  store.state.npcs[n.id] = n;
  return n;
}

// ---------- Leagues ----------

/** A country's league in a team sport, made once. */
export function league(countryId, sport, div = 'men') {
  const id = leagueKey(countryId, sport, div);
  const L = S().leagues;
  if (!L[id]) {
    const c = COUNTRIES[countryId];
    const def = SPORTS[sport];
    const used = new Set();
    const teams = [];
    for (let i = 0; i < def.teams; i++) {
      const city = c.cities[i % c.cities.length];
      let name;
      do name = `${city} ${rng.pick(TEAM_WORDS)}`; while (used.has(name));
      used.add(name);
      const strength = Math.round(rng.around(70, 9));
      teams.push({ id: nextId('team'), name: div === 'women' ? `${name} Women` : name, city, strength, star: athleteNpc(countryId, strength + 12, div).id, titles: [] });
    }
    L[id] = { id, sport, countryId, div, name: `${def.league.replace('{N}', c.name)}${div === 'women' ? ' (Women)' : ''}`, teams, seasons: [] };
  }
  return L[id];
}
export const team = (leagueId, teamId) => S().leagues[leagueId]?.teams.find((t) => t.id === teamId) ?? null;

/** The circuit of an individual sport: the same rivals, year after year. */
export function circuit(sport, div = 'men') {
  const C = S().circuits;
  const key = circuitKey(sport, div);
  if (!C[key]) {
    const places = Object.keys(COUNTRIES).filter((cc) => COUNTRIES[cc].cities?.length);
    C[key] = { sport, div, rivals: Array.from({ length: 40 }, (_, i) => athleteNpc(rng.pick(places), 92 - i * 0.8, div).id), seasons: [] };
  }
  const c = C[key];
  // Rivals retire; new ones come up.
  c.rivals = c.rivals.filter((id) => { const n = store.state.npcs[id]; return n?.alive && (year() - (n.flags.star?.born ?? 0)) < 36; });
  while (c.rivals.length < 40) c.rivals.push(athleteNpc(rng.pick(Object.keys(COUNTRIES)), rng.around(74, 8), div).id);
  return c;
}

/** Takes up a sport. Needs a professional athlete's career; a team sport places you at a club that fits your level. */
export function chooseSport(sport, div = divOf()) {
  const p = player();
  if (!isAthlete(p)) return result(false, 'You need to be a professional athlete first.', 'neutral');
  if (!playedIn(sport, year(), div)) return result(false, `${div === 'women' ? "Women's " : ''}${SPORTS[sport]?.name.toLowerCase() ?? 'that'} is not played professionally yet.`, 'neutral');
  if (p.sport && p.sport.sport !== sport && !p.sport.retiredYear && p.sport.seasons.length > 0) return result(false, `You are a ${SPORTS[p.sport.sport].name.toLowerCase()} player now.`, 'neutral');
  const def = SPORTS[sport];
  // Coming back to the same sport keeps the record; a new sport starts a new one.
  if (p.sport?.sport === sport && p.sport.div === div) Object.assign(p.sport, { retiredYear: null, offer: null, since: Math.min(p.sport.since, year()) });
  else p.sport = { sport, div, teamId: null, leagueId: null, since: year(), seasons: [], titles: [], medals: [], caps: 0, retiredYear: null, offer: null, injuries: [] };
  if (def.team) {
    const L = league(p.countryId, sport, div);
    const lvl = p.career.level ?? 0;
    const sorted = [...L.teams].sort((a, b) => a.strength - b.strength);
    const t = sorted[clamp(Math.round((lvl / 3) * (sorted.length - 1) + rng.int(-1, 1)), 0, sorted.length - 1)];
    p.sport.teamId = t.id;
    p.sport.leagueId = L.id;
    joinClub(p, t);
    milestone(`Signed for ${t.name}.`, 'career');
    return result(true, `You sign for ${t.name}, in the ${L.name}. The season is played over the year.`);
  }
  circuit(sport, div);
  milestone(`Turned professional in ${def.name.toLowerCase()}.`, 'career');
  return result(true, `You join the ${def.name.toLowerCase()} circuit. ${def.events} events a year, against the same rivals.`);
}

/** The club is the athlete's employer: the career's wage, reviews and layoffs come from it. */
function joinClub(p, t) {
  t.employerId ??= registerEmployer({ name: t.name, family: 'sport', tracks: ['athlete'], countryId: p.countryId, city: t.city, owned: false }).id;
  p.career.employerId = t.employerId;
}

export function acceptTransfer() {
  const p = player();
  const o = p.sport?.offer;
  if (!o) return result(false, 'There is no offer.', 'neutral');
  const t = team(p.sport.leagueId, o.teamId);
  p.sport.teamId = o.teamId;
  p.sport.offer = null;
  joinClub(p, t);
  milestone(`Transferred to ${t.name}.`, 'career');
  return result(true, `You move to ${t.name}.`);
}
export function declineTransfer() { if (player().sport) player().sport.offer = null; return result(true, 'You stay where you are.', 'neutral'); }

// ---------- Injuries ----------

const INJURIES = [['a sprained ankle', 2, 6], ['a pulled hamstring', 3, 8], ['a broken wrist', 6, 12], ['a knee ligament tear', 16, 40], ['a stress fracture', 8, 16], ['a shoulder dislocation', 6, 14], ['a concussion', 2, 8]];

/** Whether the player was hurt this year, and for how long. Age, fitness and contact sports raise the odds. */
function injury(p, def) {
  const odds = clamp(0.1 + Math.max(0, p.age - 27) * 0.012 + (75 - p.stats.health) / 250 + (def.contact ? 0.08 : 0), 0.04, 0.6);
  if (!rng.chance(odds)) return null;
  const [what, lo, hi] = rng.pick(INJURIES);
  const weeks = rng.int(lo, hi);
  p.stats.health = clamp(p.stats.health - Math.round(weeks / 3));
  if (weeks >= 16) p.talents.sports = clamp(p.talents.sports - rng.int(1, 4)); // a bad one leaves its mark
  return { what, weeks };
}

// ---------- Coaching ----------

/** How good a coach the player is: what they know of the game, how they think, and seasons in charge. */
export function coachSkill(p = player()) {
  const played = (p.sport?.seasons.length ?? 0) * 1.5;
  return Math.round(clamp(p.talents.sports * 0.35 + p.stats.intellect * 0.35 + p.stats.charm * 0.1 + played + (p.coach?.seasons.length ?? 0) * 2));
}
export const isCoach = (p = player()) => p.career?.careerId === 'coaching';

/** Clubs that would hire the player as head coach: weaker clubs first, better ones with a record. */
export function coachingJobs(sport, div = divOf(), p = player()) {
  if (!SPORTS[sport]?.team || !playedIn(sport, year(), div)) return [];
  const L = league(p.countryId, sport, div);
  const skill = coachSkill(p);
  return [...L.teams].sort((a, b) => a.strength - b.strength).filter((t) => t.strength <= skill + 15 && t.id !== p.coach?.teamId).slice(0, 4).map((t) => ({ league: L, team: t }));
}

export function takeCoachingJob(sport, teamId, div = divOf()) {
  const p = player();
  if (!isCoach(p)) return result(false, 'You need to be working as a coach.', 'neutral');
  const job = coachingJobs(sport, div, p).find((x) => x.team.id === teamId);
  if (!job) return result(false, 'That club does not want you.', 'neutral');
  p.coach ??= { seasons: [], clubs: [] };
  Object.assign(p.coach, { sport, div, leagueId: job.league.id, teamId, since: year() });
  p.coach.clubs.push({ teamId, name: job.team.name, from: year() });
  job.team.employerId ??= registerEmployer({ name: job.team.name, family: 'sport', tracks: ['coaching', 'athlete'], countryId: p.countryId, city: job.team.city, owned: false }).id;
  p.career.employerId = job.team.employerId;
  milestone(`Became head coach of ${job.team.name}.`, 'career');
  return result(true, `You are the head coach of ${job.team.name}. Results will decide how long for.`);
}

// ---------- Playing a season ----------

function poisson(lambda) { let k = 0; let pr = Math.exp(-lambda); let s = pr; const u = rng.next(); while (u > s && k < 12) { k += 1; pr *= lambda / k; s += pr; } return k; }

function match(sport, a, b) {
  const d = a - b;
  if (sport === 'football') return [poisson(clamp(1.35 + d / 30 + 0.2, 0.2, 4)), poisson(clamp(1.35 - d / 30, 0.2, 4))];
  if (sport === 'rugby') return [Math.max(0, Math.round(rng.around(22 + d / 2 + 2, 9))), Math.max(0, Math.round(rng.around(22 - d / 2, 9)))];
  if (sport === 'cricket') { const x = Math.round(rng.around(250 + d * 3 + 5, 45)); const y = Math.round(rng.around(250 - d * 3, 45)); return rng.chance(0.15) ? [x, x] : [x, y]; } // some matches are drawn
  let x = Math.round(rng.around(92 + d / 1.5 + 2, 12));
  let y = Math.round(rng.around(92 - d / 1.5, 12));
  if (x === y) (rng.chance(0.5) ? x += 3 : y += 3);
  return [x, y];
}

/** Plays a league's season for a year, once. The player's club is stronger or weaker for the player in it. */
function playLeague(L, forYear, p) {
  if (L.seasons.some((s) => s.year === forYear)) return null;
  const def = SPORTS[L.sport];
  const ps = p.sport && !p.sport.retiredYear && p.sport.leagueId === L.id ? p.sport : null;
  const r = ps ? rating(p) : 0;
  const pc = p.coach?.teamId && p.coach.leagueId === L.id && isCoach(p) ? p.coach : null;
  const hurt = ps ? injury(p, def) : null;
  const share = ps ? ([0.15, 0.5, 0.9, 1][p.career.level ?? 0] ?? 0.5) * (hurt ? clamp(1 - hurt.weeks / 40, 0.1, 1) : 1) : 0;
  for (const t of L.teams) t.strength = Math.round(clamp(t.strength + rng.around(0, 3), 45, 95));
  const eff = Object.fromEntries(L.teams.map((t) => [t.id, t.strength + (ps && t.id === ps.teamId ? (r - t.strength) * 0.12 * share : 0) + (pc && t.id === pc.teamId ? (coachSkill(p) - 60) * 0.15 : 0)]));
  const rows = Object.fromEntries(L.teams.map((t) => [t.id, [t.id, 0, 0, 0, 0, 0, 0]]));
  let games = 0;
  for (let round = 0; round < def.rounds; round++) for (const a of L.teams) for (const b of L.teams) {
    if (a.id >= b.id) continue;
    const [home, away] = round % 2 ? [b, a] : [a, b];
    const [x, y] = match(L.sport, eff[home.id], eff[away.id]);
    const H = rows[home.id]; const A = rows[away.id];
    H[4] += x; H[5] += y; A[4] += y; A[5] += x;
    if (x > y) { H[1] += 1; A[3] += 1; } else if (x < y) { A[1] += 1; H[3] += 1; } else { H[2] += 1; A[2] += 1; }
    if (home.id === ps?.teamId || away.id === ps?.teamId) games += 1;
  }
  const PTS = { football: [3, 1], rugby: [4, 2], cricket: [2, 1], basketball: [1, 0] }[L.sport];
  for (const row of Object.values(rows)) row[6] = row[1] * PTS[0] + row[2] * PTS[1];
  const table = Object.values(rows).sort((x, y) => y[6] - x[6] || (y[4] - y[5]) - (x[4] - x[5]) || y[4] - x[4]);
  const champion = table[0][0];
  L.teams.find((t) => t.id === champion).titles.push(forYear);
  // Each club's leading player, and the player's own numbers.
  const perGame = (rt) => ({ football: clamp((rt - 50) / 80, 0.02, 0.8), rugby: clamp((rt - 50) / 70, 0.02, 0.9), cricket: Math.max(4, (rt - 40) * 1.1), basketball: Math.max(2, (rt - 45) * 0.45) }[L.sport]);
  const gamesEach = (L.teams.length - 1) * def.rounds;
  const lines = L.teams.map((t) => { const rt = npcRating(t.star); return { who: t.star, teamId: t.id, value: Math.round(gamesEach * 0.85 * perGame(rt) * rng.around(1, 0.25)), rt }; });
  let mine = null;
  if (ps) {
    const apps = Math.round(games * share * clamp(p.stats.health / 80, 0.3, 1));
    const value = Math.round(apps * perGame(r) * rng.around(1, 0.25));
    mine = { who: 'player', teamId: ps.teamId, value, rt: r, apps };
    lines.push(mine);
  }
  const SCALE = { football: 1, rugby: 1, cricket: 40, basketball: 20 }[L.sport];
  const top = [...lines].sort((a, b) => b.value - a.value)[0];
  const pos = (id) => table.findIndex((row) => row[0] === id) + 1;
  const best = [...lines].sort((a, b) => (b.rt + b.value / SCALE - pos(b.teamId)) - (a.rt + a.value / SCALE - pos(a.teamId)))[0];
  const season = { year: forYear, table, champion, top: { who: top.who, name: nameOf(top.who), teamId: top.teamId, value: top.value }, best: { who: best.who, name: nameOf(best.who), teamId: best.teamId } };
  L.seasons.push(season);
  if (L.seasons.length > 40) L.seasons.shift();
  let coached = null;
  if (pc) {
    coached = { year: forYear, sport: L.sport, teamId: pc.teamId, team: team(L.id, pc.teamId).name, pos: pos(pc.teamId), of: L.teams.length, champion: champion === pc.teamId };
    pc.seasons.push(coached);
  }
  if (!mine) return { season, coached };
  const t = team(L.id, ps.teamId);
  const rec = { year: forYear, sport: L.sport, teamId: ps.teamId, team: t.name, apps: mine.apps, games, stat: mine.value, rating: r, pos: pos(ps.teamId), of: L.teams.length,
    champion: champion === ps.teamId, top: top.who === 'player', best: best.who === 'player', injury: hurt };
  ps.seasons.push(rec);
  if (hurt) (ps.injuries ??= []).push({ year: forYear, ...hurt });
  return { season, rec, coached };
}

/** Plays an individual sport's year: every event, and the World Games when they fall. */
function playCircuit(sport, forYear, p, div = 'men') {
  const C = circuit(sport, div);
  if (C.seasons.some((s) => s.year === forYear)) return null;
  const def = SPORTS[sport];
  const ps = p.sport && !p.sport.retiredYear && p.sport.sport === sport && divOf(p) === div ? p.sport : null;
  if (def.fights) return fightYear(C, forYear, p, ps);
  const hurt = ps ? injury(p, def) : null;
  const missed = hurt ? Math.round(def.events * Math.min(1, hurt.weeks / 40)) : 0;
  const me = ps ? rating(p) : 0;
  const rt = (who) => (who === 'player' ? me + rng.around(0, 3) : npcRating(who) + rng.around(0, 3));
  const points = {};
  const events = [];
  const mine = [];
  const places = Object.keys(COUNTRIES);
  const hold = (name, countryId, big, inField = !!ps) => {
    const pool = [...C.rivals].sort((a, b) => npcRating(b) - npcRating(a) + rng.around(0, 10));
    const field = pool.slice(0, def.field - (inField ? 1 : 0));
    if (inField) field.push('player');
    let winner; let finish = {};
    if (sport === 'tennis') {
      let round = [...field].sort(() => rng.next() - 0.5);
      let r = 0;
      while (round.length > 1) {
        r += 1;
        const next = [];
        for (let i = 0; i < round.length; i += 2) {
          const [a, b] = [round[i], round[i + 1]];
          const pa = 1 / (1 + Math.exp(-(rt(a) - rt(b)) / 6));
          const w = rng.chance(pa) ? a : b;
          finish[w === a ? b : a] = r;
          next.push(w);
        }
        round = next;
      }
      winner = round[0];
      finish[winner] = r + 1;
    } else {
      const order = [...field].sort((a, b) => rt(b) - rt(a));
      winner = order[0];
      order.forEach((w, i) => { finish[w] = field.length - i; });
    }
    for (const [w, f] of Object.entries(finish)) points[w] = (points[w] ?? 0) + Math.round(f * f * (big ? 3 : 1) * 10);
    const city = COUNTRIES[countryId].cities[0];
    events.push({ name, city, countryId, winner: { who: winner, name: nameOf(winner) }, big });
    if (inField) mine.push({ name, city, countryId, won: winner === 'player', place: sport === 'tennis' ? null : field.length + 1 - finish.player, round: sport === 'tennis' ? finish.player : null, rounds: Math.log2(def.field) + 1, big });
    return { finish, winner };
  };
  const inPlay = ps;
  for (let i = 0; i < def.events; i++) {
    const cc = i === 0 && ps ? p.countryId : rng.pick(places);
    // An injured player misses the events of the weeks they are out.
    hold(`${COUNTRIES[cc].cities[0]} ${rng.pick(EVENT_WORDS)}`, cc, false, !!inPlay && i >= missed); // an injured player misses the first events
  }
  let games = null;
  if (forYear >= WORLD_GAMES.founded && forYear % WORLD_GAMES.every === 0) {
    const cc = rng.pick(places);
    const g = hold(`${WORLD_GAMES.name} ${forYear}`, cc, true);
    const order = Object.entries(g.finish).sort((a, b) => b[1] - a[1]).map(([w]) => w);
    games = { host: cc, medals: order.slice(0, 3).map((w) => ({ who: w, name: nameOf(w) })) };
  }
  const ranking = Object.entries(points).sort((a, b) => b[1] - a[1]).map(([who, pts]) => ({ who, name: nameOf(who), points: pts }));
  C.seasons.push({ year: forYear, events, ranking: ranking.slice(0, 10), games });
  if (C.seasons.length > 40) C.seasons.shift();
  if (!ps) return null;
  const rank = ranking.findIndex((x) => x.who === 'player') + 1;
  const wins = mine.filter((m) => m.won).length;
  const medal = games ? games.medals.findIndex((m) => m.who === 'player') : -1;
  const rec = { year: forYear, sport, events: mine, stat: wins, rank, rating: me, medal: medal >= 0 ? ['gold', 'silver', 'bronze'][medal] : null };
  ps.seasons.push(rec);
  for (const m of mine.filter((x) => x.won)) ps.titles.push({ year: forYear, name: m.name });
  if (rec.medal) ps.medals.push({ year: forYear, medal: rec.medal, games: `${WORLD_GAMES.name} ${forYear}` });
  return { rec, games };
}

/** A boxer's year: fights against ranked opponents, and a title fight for the best. */
function fightYear(C, forYear, p, ps) {
  const def = SPORTS[C.sport];
  const ranked = [...C.rivals].sort((a, b) => npcRating(b) - npcRating(a));
  if (!ps) { C.seasons.push({ year: forYear, events: [], ranking: ranked.slice(0, 10).map((who, i) => ({ who, name: nameOf(who), points: 100 - i })) }); return null; }
  const me = rating(p);
  const hurt = injury(p, def);
  const fights = Math.max(0, def.events - (hurt ? Math.round(def.events * Math.min(1, hurt.weeks / 30)) : 0));
  const near = ranked.filter((id) => Math.abs(npcRating(id) - me) <= 10);
  const events = [];
  let wins = 0;
  for (let i = 0; i < fights; i++) {
    const opp = rng.pick(near.length ? near : ranked);
    const won = rng.chance(1 / (1 + Math.exp(-(me - npcRating(opp)) / 5)));
    if (won) wins += 1;
    const cc = rng.pick([p.countryId, store.state.npcs[opp]?.bornIn ?? p.countryId]);
    events.push({ name: `against ${nameOf(opp)}`, opponent: opp, city: COUNTRIES[cc]?.cities[0] ?? '', countryId: cc, won, how: won ? rng.pick(['on points', 'by knockout', 'by stoppage']) : rng.pick(['on points', 'by knockout']) });
  }
  // A title fight for an unbeaten year against the champion.
  const champ = ranked[0];
  let title = false;
  if (fights && wins === fights && me >= npcRating(champ) - 6) {
    title = rng.chance(1 / (1 + Math.exp(-(me - npcRating(champ)) / 5)));
    events.push({ name: `World title fight against ${nameOf(champ)}`, opponent: champ, city: COUNTRIES[p.countryId].cities[0], countryId: p.countryId, won: title, how: title ? 'on points' : 'on points', big: true });
    if (title) wins += 1;
  }
  const score = (who) => (who === 'player' ? (title ? 999 : Math.min(me + wins * 3, npcRating(champ) - 0.5)) : who === champ && title ? npcRating(who) - 1 : npcRating(who)); // the belt decides number one
  const ranking = [...ranked, 'player'].sort((a, b) => score(b) - score(a)).map((who, i) => ({ who, name: nameOf(who), points: Math.round(score(who)), i }));
  C.seasons.push({ year: forYear, events: events.map((e) => ({ name: e.name, city: e.city, countryId: e.countryId, winner: { who: e.won ? 'player' : e.opponent, name: e.won ? nameOf('player') : nameOf(e.opponent) }, big: !!e.big })), ranking: ranking.slice(0, 10) });
  if (C.seasons.length > 40) C.seasons.shift();
  const rec = { year: forYear, sport: C.sport, events: events.map((e) => ({ ...e, opponent: undefined })), fights: events.length, stat: wins, losses: events.length - wins, rank: ranking.findIndex((x) => x.who === 'player') + 1, rating: me, injury: hurt, title };
  ps.seasons.push(rec);
  if (hurt) (ps.injuries ??= []).push({ year: forYear, ...hurt });
  if (title) ps.titles.push({ year: forYear, name: `World ${def.name.toLowerCase()} champion` });
  return { rec };
}

/** Once a year, for the year just lived: the athlete's season, then the coach's. @returns {string[]} */
export function tickSports() {
  const p = player();
  const lines = [...athleteYear(p), ...coachYear(p)];
  return lines;
}

function athleteYear(p) {
  const lines = [];
  if (!p.sport && isAthlete(p) && playedIn('football', year(), divOf(p))) {
    chooseSport('football');
    lines.push('You play football professionally. (A different sport can be chosen in My Fame before your first season.)');
    return lines;
  }
  const ps = p.sport;
  if (!ps) return lines;
  const forYear = year() - 1;
  if (ps.retiredYear) return lines;
  if (!isAthlete(p)) {
    if (ps.seasons.length) { ps.retiredYear = forYear; milestone(`Retired from ${SPORTS[ps.sport].name.toLowerCase()} after ${ps.seasons.length} ${ps.seasons.length === 1 ? 'season' : 'seasons'}.`, 'career'); lines.push(`Your playing days are over: ${ps.seasons.length} seasons of ${SPORTS[ps.sport].name.toLowerCase()}.`); }
    else ps.retiredYear = forYear;
    return lines;
  }
  if (ps.since > forYear) return lines; // nothing played yet
  const def = SPORTS[ps.sport];
  let score = 0;
  if (def.team) {
    const L = S().leagues[ps.leagueId];
    const out = playLeague(L, forYear, p);
    const rec = out?.rec;
    if (!rec) return lines;
    const t = team(L.id, ps.teamId);
    if (rec.injury) lines.push(`You were injured: ${rec.injury.what}, out for ${rec.injury.weeks} weeks.`);
    lines.push(`${t.name} finished ${ordinal(rec.pos)} of ${rec.of} in the ${L.name}${rec.champion ? ', champions' : ''}. You played ${rec.apps} of ${rec.games} games: ${rec.stat} ${def.statName.toLowerCase()}.`);
    score = rec.apps / Math.max(1, rec.games) * 3 + (['goals', 'tries'].includes(def.stat) ? rec.stat * 0.25 : rec.stat / 120) + (rec.champion ? 6 : 0) + (rec.top ? 4 : 0) + (rec.best ? 7 : 0) + (10 - rec.pos) * 0.3;
    if (rec.champion) { ps.titles.push({ year: forYear, name: `${L.name} champions` }); milestone(`Won the ${L.name} with ${t.name}.`, 'career'); }
    if (rec.top) { lines.push(`You were the league's top scorer.`); milestone(`Top scorer in the ${L.name}, ${forYear}.`, 'career'); }
    if (rec.best) { lines.push(`You were named the league's player of the year.`); milestone(`${L.name} player of the year, ${forYear}.`, 'career'); }
    // The national side, for the best.
    if (rec.rating >= 85 && rec.apps >= rec.games * 0.6) {
      const caps = rng.int(3, 9);
      if (!ps.caps) milestone(`First cap for ${COUNTRIES[p.countryId].name}.`, 'career');
      ps.caps += caps;
      lines.push(`You won ${caps} caps for ${COUNTRIES[p.countryId].name}.`);
      score += 4;
    }
    // A bigger club comes calling for a player better than their team.
    const stronger = L.teams.filter((x) => x.strength > t.strength + 4 && x.strength <= rec.rating + 8);
    if (stronger.length && rec.apps >= rec.games * 0.5 && rec.rating > t.strength + 3 && rng.chance(0.5)) {
      const o = rng.pick(stronger);
      ps.offer = { teamId: o.id, year: year() };
      lines.push(`${o.name} want to sign you.`);
    }
  } else {
    const out = playCircuit(ps.sport, forYear, p, divOf(p));
    const rec = out?.rec;
    if (!rec) return lines;
    if (rec.injury) lines.push(`You were injured: ${rec.injury.what}, out for ${rec.injury.weeks} weeks.`);
    if (def.fights) {
      lines.push(`Your year in the ring: ${rec.stat} won, ${rec.losses} lost; ranked ${ordinal(rec.rank)} in the world.`);
      if (rec.title) { lines.push(`You are the world ${def.name.toLowerCase()} champion.`); milestone(`Became world ${def.name.toLowerCase()} champion, ${forYear}.`, 'career'); }
      score = rec.stat * 2.5 - rec.losses + Math.max(0, 12 - rec.rank) * 0.6 + (rec.title ? 16 : 0);
    } else {
      lines.push(`Your ${def.name.toLowerCase()} year: ${rec.events.length} events, ${rec.stat} won, ranked ${rec.rank ? ordinal(rec.rank) : 'outside the top'} in the world.`);
      for (const m of rec.events.filter((e) => e.won)) milestone(`Won the ${m.name}.`, 'career');
      if (rec.medal) { lines.push(`A ${rec.medal} medal at the ${WORLD_GAMES.name}.`); milestone(`${rec.medal[0].toUpperCase()}${rec.medal.slice(1)} medal, ${WORLD_GAMES.name} ${forYear}.`, 'career'); }
      if (rec.rank === 1) milestone(`World number one in ${def.name.toLowerCase()}, ${forYear}.`, 'career');
      score = rec.stat * 3 + (rec.rank ? Math.max(0, 12 - rec.rank) * 0.6 : 0) + (rec.medal === 'gold' ? 14 : rec.medal ? 8 : 0);
    }
  }
  const last = ps.seasons.at(-1);
  // Fame from what happened, nothing else.
  const abroad = def.team ? [] : [...new Set((last.events ?? []).filter((e) => e.won || e.big).map((e) => e.countryId))].filter((c) => c && c !== p.countryId);
  if (score > 0) gain({ audience: 'sports', amount: Math.min(18, score), abroad, reach: 0.4, lasting: 0.3, why: def.team ? `the ${last.year} season` : `the ${last.year} ${def.name.toLowerCase()} year` }, p);
  if (last.best || last.medal === 'gold' || last.rank === 1 || last.title) regard({ credibility: 4, why: 'results' }, p);
  // How the year went is how the job went.
  p.career.performance = clamp(Math.round(p.career.performance * 0.5 + clamp(score * 6 + 30) * 0.5));
  return lines;
}

/** A head coach's season: the club's results are the coach's record. Two bad years and the club lets them go. */
function coachYear(p) {
  const lines = [];
  const pc = p.coach;
  if (!pc?.teamId) return lines;
  if (!isCoach(p)) { pc.teamId = null; return lines; }
  const forYear = year() - 1;
  if (pc.since > forYear) return lines;
  const L = S().leagues[pc.leagueId];
  const out = playLeague(L, forYear, p) ?? null;
  const rec = out?.coached ?? pc.seasons.find((x) => x.year === forYear);
  if (!rec) return lines;
  lines.push(`As head coach of ${rec.team}: ${ordinal(rec.pos)} of ${rec.of}${rec.champion ? ', champions' : ''}.`);
  if (rec.champion) { milestone(`Coached ${rec.team} to the ${L.name} title.`, 'career'); gain({ audience: 'sports', amount: 6, lasting: 0.5, why: `coaching ${rec.team} to the title` }, p); }
  else if (rec.pos <= 3) gain({ audience: 'sports', amount: 2, lasting: 0.2, why: `a strong season coaching ${rec.team}` }, p);
  p.career.performance = clamp(Math.round(p.career.performance * 0.5 + clamp(100 - (rec.pos - 1) * (100 / rec.of)) * 0.5));
  const prev = pc.seasons.filter((x) => x.teamId === pc.teamId).slice(-2);
  if (prev.length === 2 && prev.every((x) => x.pos >= x.of - 1)) {
    lines.push(`${rec.team} have let you go after two seasons at the bottom.`);
    const club = pc.clubs.at(-1); if (club) club.to = forYear;
    pc.teamId = null;
  }
  return lines;
}

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;

/** Every season the player played, oldest first. */
export const career = (p = player()) => p.sport?.seasons ?? [];

/** What a family remembers of an athlete. */
export function summary(p = player()) {
  const s = p.sport;
  if (!s?.seasons.length) return null;
  return { sport: s.sport, seasons: s.seasons.length, titles: s.titles.length, medals: s.medals.map((m) => `${m.medal} ${m.year}`), caps: s.caps,
    teams: [...new Set(s.seasons.map((x) => x.team).filter(Boolean))], best: s.seasons.reduce((b, x) => Math.max(b, x.stat), 0) };
}

/** The sporting world carries into the next generation; the old player's records become an ancestor's. */
export function carrySports(old, next, ancestorId) {
  if (!old.proSport) return;
  next.proSport = old.proSport;
  const who = (x) => (x === 'player' ? ancestorId ?? null : x);
  const keep = new Set();
  for (const L of Object.values(next.proSport.leagues)) {
    for (const t of L.teams) keep.add(t.star);
    for (const s of L.seasons) { s.top.who = who(s.top.who); s.best.who = who(s.best.who); }
  }
  for (const C of Object.values(next.proSport.circuits)) {
    for (const id of C.rivals) keep.add(id);
    for (const s of C.seasons) { for (const e of s.events) e.winner.who = who(e.winner.who); for (const r of s.ranking) r.who = who(r.who); for (const m of s.games?.medals ?? []) m.who = who(m.who); }
  }
  for (const id of keep) if (id && !next.npcs[id] && old.npcs[id]) next.npcs[id] = old.npcs[id];
}
