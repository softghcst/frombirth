// Sport. A professional athlete's fame comes only from results the game has
// played out: league seasons with every match decided, tables, top scorers,
// players of the year; tournaments and meets with draws and finals; the World
// Games every four years. The athlete's wage is the career's (engine/career.js);
// this engine adds the sport itself, and never pays anything.
//
//   state.sports.leagues['cc:sport'] = { id, sport, countryId, name, teams:[Team], seasons:[Season] }
//     Team:   { id, name, city, strength, star (npcId), titles:[year] }
//     Season: { year, table:[[teamId, w, d, l, for, against, pts]], champion, top:{ who, name, teamId, value }, best:{ who, name, teamId } }
//   state.sports.circuits[sport] = { rivals:[npcId], seasons:[{ year, events:[{ name, city, countryId, winner:{who,name} }], ranking:[{who,name,points}], games? }] }
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
const S = () => { const st = store.state; st.sports ??= { seq: 0, leagues: {}, circuits: {} }; return st.sports; };
const nextId = (pre) => `${pre}_${(S().seq += 1).toString(36)}`;
const nameOf = (who) => (who === 'player' ? `${player().firstName} ${player().lastName}` : store.state.npcs[who] ? `${store.state.npcs[who].firstName} ${store.state.npcs[who].lastName}` : '');

export const sportOf = (p = player()) => p.sport ?? null;
export const isAthlete = (p = player()) => p.career?.careerId === 'athlete';
export const playedIn = (sport, y = year()) => !!SPORTS[sport] && y >= SPORTS[sport].founded;

/** How well the player plays this year: talent, fitness and discipline, on the day. */
export function rating(p = player()) {
  return Math.round(clamp(p.talents.sports * 0.8 + p.stats.health * 0.1 + (p.hidden.discipline ?? 50) * 0.1 - Math.max(0, p.age - 31) * 1.5));
}
const npcRating = (id) => store.state.npcs[id]?.flags.star?.skill.sports ?? 60;

function athleteNpc(countryId, level) {
  const age = rng.int(19, 32);
  const n = makeNpc({ role: 'performer', countryId, age, relationship: rng.int(35, 55) });
  n.flags.star = { skill: { sports: Math.round(clamp(rng.around(level, 6), 40, 98)) }, born: year() - age, fame: 0, credits: [], kind: 'athlete' };
  n.occupation = 'professional athlete';
  store.state.npcs[n.id] = n;
  return n;
}

// ---------- Leagues ----------

/** A country's league in a team sport, made once. */
export function league(countryId, sport) {
  const id = `${countryId}:${sport}`;
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
      teams.push({ id: nextId('team'), name, city, strength, star: athleteNpc(countryId, strength + 12).id, titles: [] });
    }
    L[id] = { id, sport, countryId, name: def.league.replace('{N}', c.name), teams, seasons: [] };
  }
  return L[id];
}
export const team = (leagueId, teamId) => S().leagues[leagueId]?.teams.find((t) => t.id === teamId) ?? null;

/** The circuit of an individual sport: the same rivals, year after year. */
export function circuit(sport) {
  const C = S().circuits;
  if (!C[sport]) {
    const places = Object.keys(COUNTRIES).filter((cc) => COUNTRIES[cc].cities?.length);
    C[sport] = { rivals: Array.from({ length: 40 }, (_, i) => athleteNpc(rng.pick(places), 92 - i * 0.8).id), seasons: [] };
  }
  const c = C[sport];
  // Rivals retire; new ones come up.
  c.rivals = c.rivals.filter((id) => { const n = store.state.npcs[id]; return n?.alive && (year() - (n.flags.star?.born ?? 0)) < 36; });
  while (c.rivals.length < 40) c.rivals.push(athleteNpc(rng.pick(Object.keys(COUNTRIES)), rng.around(74, 8)).id);
  return c;
}

/** Takes up a sport. Needs a professional athlete's career; a team sport places you at a club that fits your level. */
export function chooseSport(sport) {
  const p = player();
  if (!isAthlete(p)) return result(false, 'You need to be a professional athlete first.', 'neutral');
  if (!playedIn(sport)) return result(false, `${SPORTS[sport]?.name ?? 'That'} is not played professionally yet.`, 'neutral');
  if (p.sport && p.sport.sport !== sport && !p.sport.retiredYear && p.sport.seasons.length > 0) return result(false, `You are a ${SPORTS[p.sport.sport].name.toLowerCase()} player now.`, 'neutral');
  const def = SPORTS[sport];
  // Coming back to the same sport keeps the record; a new sport starts a new one.
  if (p.sport?.sport === sport) Object.assign(p.sport, { retiredYear: null, offer: null, since: Math.min(p.sport.since, year()) });
  else p.sport = { sport, teamId: null, leagueId: null, since: year(), seasons: [], titles: [], medals: [], caps: 0, retiredYear: null, offer: null };
  if (def.team) {
    const L = league(p.countryId, sport);
    const lvl = p.career.level ?? 0;
    const sorted = [...L.teams].sort((a, b) => a.strength - b.strength);
    const t = sorted[clamp(Math.round((lvl / 3) * (sorted.length - 1) + rng.int(-1, 1)), 0, sorted.length - 1)];
    p.sport.teamId = t.id;
    p.sport.leagueId = L.id;
    joinClub(p, t);
    milestone(`Signed for ${t.name}.`, 'career');
    return result(true, `You sign for ${t.name}, in the ${L.name}. The season is played over the year.`);
  }
  circuit(sport);
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

// ---------- Playing a season ----------

function poisson(lambda) { let k = 0; let pr = Math.exp(-lambda); let s = pr; const u = rng.next(); while (u > s && k < 12) { k += 1; pr *= lambda / k; s += pr; } return k; }

function match(sport, a, b) {
  const d = a - b;
  if (sport === 'football') return [poisson(clamp(1.35 + d / 30 + 0.2, 0.2, 4)), poisson(clamp(1.35 - d / 30, 0.2, 4))];
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
  const share = ps ? [0.15, 0.5, 0.9, 1][p.career.level ?? 0] ?? 0.5 : 0;
  for (const t of L.teams) t.strength = Math.round(clamp(t.strength + rng.around(0, 3), 45, 95));
  const eff = Object.fromEntries(L.teams.map((t) => [t.id, t.strength + (ps && t.id === ps.teamId ? (r - t.strength) * 0.12 * share : 0)]));
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
  for (const row of Object.values(rows)) row[6] = L.sport === 'football' ? row[1] * 3 + row[2] : row[1];
  const table = Object.values(rows).sort((x, y) => y[6] - x[6] || (y[4] - y[5]) - (x[4] - x[5]) || y[4] - x[4]);
  const champion = table[0][0];
  L.teams.find((t) => t.id === champion).titles.push(forYear);
  // Each club's leading player, and the player's own numbers.
  const perGame = (rt) => (L.sport === 'football' ? clamp((rt - 50) / 80, 0.02, 0.8) : Math.max(2, (rt - 45) * 0.45));
  const gamesEach = (L.teams.length - 1) * def.rounds;
  const lines = L.teams.map((t) => { const rt = npcRating(t.star); return { who: t.star, teamId: t.id, value: Math.round(gamesEach * 0.85 * perGame(rt) * rng.around(1, 0.25)), rt }; });
  let mine = null;
  if (ps) {
    const apps = Math.round(games * share * clamp(p.stats.health / 80, 0.3, 1));
    const value = Math.round(apps * perGame(r) * rng.around(1, 0.25));
    mine = { who: 'player', teamId: ps.teamId, value, rt: r, apps };
    lines.push(mine);
  }
  const top = [...lines].sort((a, b) => b.value - a.value)[0];
  const pos = (id) => table.findIndex((row) => row[0] === id) + 1;
  const best = [...lines].sort((a, b) => (b.rt + b.value / (L.sport === 'football' ? 1 : 20) - pos(b.teamId)) - (a.rt + a.value / (L.sport === 'football' ? 1 : 20) - pos(a.teamId)))[0];
  const season = { year: forYear, table, champion, top: { who: top.who, name: nameOf(top.who), teamId: top.teamId, value: top.value }, best: { who: best.who, name: nameOf(best.who), teamId: best.teamId } };
  L.seasons.push(season);
  if (L.seasons.length > 40) L.seasons.shift();
  if (!mine) return { season };
  const t = team(L.id, ps.teamId);
  const rec = { year: forYear, sport: L.sport, teamId: ps.teamId, team: t.name, apps: mine.apps, games, stat: mine.value, rating: r, pos: pos(ps.teamId), of: L.teams.length,
    champion: champion === ps.teamId, top: top.who === 'player', best: best.who === 'player' };
  ps.seasons.push(rec);
  return { season, rec };
}

/** Plays an individual sport's year: every event, and the World Games when they fall. */
function playCircuit(sport, forYear, p) {
  const C = circuit(sport);
  if (C.seasons.some((s) => s.year === forYear)) return null;
  const def = SPORTS[sport];
  const ps = p.sport && !p.sport.retiredYear && p.sport.sport === sport ? p.sport : null;
  const me = ps ? rating(p) : 0;
  const rt = (who) => (who === 'player' ? me + rng.around(0, 3) : npcRating(who) + rng.around(0, 3));
  const points = {};
  const events = [];
  const mine = [];
  const places = Object.keys(COUNTRIES);
  const hold = (name, countryId, big) => {
    const pool = [...C.rivals].sort((a, b) => npcRating(b) - npcRating(a) + rng.around(0, 10));
    const field = pool.slice(0, def.field - (ps ? 1 : 0));
    if (ps) field.push('player');
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
    if (ps) mine.push({ name, city, countryId, won: winner === 'player', place: sport === 'tennis' ? null : field.length + 1 - finish.player, round: sport === 'tennis' ? finish.player : null, rounds: Math.log2(def.field) + 1, big });
    return { finish, winner };
  };
  for (let i = 0; i < def.events; i++) {
    const cc = i === 0 && ps ? p.countryId : rng.pick(places);
    hold(`${COUNTRIES[cc].cities[0]} ${rng.pick(EVENT_WORDS)}`, cc, false);
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

/** Once a year, for the year just lived. @returns {string[]} */
export function tickSports() {
  const p = player();
  const lines = [];
  if (!p.sport && isAthlete(p) && playedIn('football')) {
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
    lines.push(`${t.name} finished ${ordinal(rec.pos)} of ${rec.of} in the ${L.name}${rec.champion ? ', champions' : ''}. You played ${rec.apps} of ${rec.games} games: ${rec.stat} ${def.statName.toLowerCase()}.`);
    score = rec.apps / Math.max(1, rec.games) * 3 + (def.stat === 'goals' ? rec.stat * 0.25 : rec.stat / 120) + (rec.champion ? 6 : 0) + (rec.top ? 4 : 0) + (rec.best ? 7 : 0) + (10 - rec.pos) * 0.3;
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
    const out = playCircuit(ps.sport, forYear, p);
    const rec = out?.rec;
    if (!rec) return lines;
    lines.push(`Your ${def.name.toLowerCase()} year: ${rec.events.length} events, ${rec.stat} won, ranked ${ordinal(rec.rank)} in the world.`);
    for (const m of rec.events.filter((e) => e.won)) milestone(`Won the ${m.name}.`, 'career');
    if (rec.medal) { lines.push(`A ${rec.medal} medal at the ${WORLD_GAMES.name}.`); milestone(`${rec.medal[0].toUpperCase()}${rec.medal.slice(1)} medal, ${WORLD_GAMES.name} ${forYear}.`, 'career'); }
    if (rec.rank === 1) milestone(`World number one in ${def.name.toLowerCase()}, ${forYear}.`, 'career');
    score = rec.stat * 3 + Math.max(0, 12 - rec.rank) * 0.6 + (rec.medal === 'gold' ? 14 : rec.medal ? 8 : 0);
  }
  const last = ps.seasons.at(-1);
  // Fame from what happened, nothing else.
  const abroad = def.team ? [] : [...new Set((last.events ?? []).filter((e) => e.won || e.big).map((e) => e.countryId))].filter((c) => c !== p.countryId);
  if (score > 0) gain({ audience: 'sports', amount: Math.min(18, score), abroad, reach: 0.4, lasting: 0.3, why: def.team ? `the ${last.year} season` : `the ${last.year} ${def.name.toLowerCase()} year` }, p);
  if (last.best || last.medal === 'gold' || last.rank === 1) regard({ credibility: 4, why: 'results' }, p);
  // How the year went is how the job went.
  p.career.performance = clamp(Math.round(p.career.performance * 0.5 + clamp(score * 6 + 30) * 0.5));
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
  if (!old.sports) return;
  next.sports = old.sports;
  const who = (x) => (x === 'player' ? ancestorId ?? null : x);
  const keep = new Set();
  for (const L of Object.values(next.sports.leagues)) {
    for (const t of L.teams) keep.add(t.star);
    for (const s of L.seasons) { s.top.who = who(s.top.who); s.best.who = who(s.best.who); }
  }
  for (const C of Object.values(next.sports.circuits)) {
    for (const id of C.rivals) keep.add(id);
    for (const s of C.seasons) { for (const e of s.events) e.winner.who = who(e.winner.who); for (const r of s.ranking) r.who = who(r.who); for (const m of s.games?.medals ?? []) m.who = who(m.who); }
  }
  for (const id of keep) if (id && !next.npcs[id] && old.npcs[id]) next.npcs[id] = old.npcs[id];
}
