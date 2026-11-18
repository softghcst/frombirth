// End-of-season awards: when a league's season is over, it names its Most Valuable Player, Rookie of the Year and the
// rest (data/sports.js, SEASON_AWARDS); individual sports name a Player of the Year. Decided once, from the season as
// it was played: the player's own games are counted as they happened; everyone else in the league is judged from their
// rating, their team's season and a season line drawn from luck keyed to that season, so a reload never changes a
// winner and the game's own dice are not touched.
//
//   season.awards = [{ id, name, kind, winner: { who, name, teamId, value? } | null, team?: [{ who, name, teamId, pos }] }]
//     who is 'player', a person's id (a teammate the player knows, a coach), or a roster id (a name and a rating).
//   e.awards      = [{ year, id, name, seasonId?, league }]   the player's own, on their record in that sport
//   state.sports.yearAwards['sport/level/year'] = [...]        individual sports, the same shape
import { store, milestone } from '../state.js';
import { clamp } from '../util.js';
import { sportOf, awardsFor, COLLEGE_NAMES, YEAR_AWARDS, AWARD_LINEUPS } from '../data/sports.js';
import * as sp from './sports.js';

const { seeded, overall, coachFor } = sp.internals;
/** Leagues that name awards: the professional game, the national level and university sport. */
export const AWARD_LEVELS = ['pro', 'elite', 'college'];

/** The numbers a player in this position might put up over a season, per game, for someone of this rating. */
function perGame(sport, stat, pos, k) {
  const goalsFor = sport.id === 'ice_hockey' ? 3 : 1.4;
  switch (stat) {
    case 'goals': return goalsFor * (['fwd', 'forward'].includes(pos) ? 0.38 : ['mid', 'defense'].includes(pos) ? 0.16 : pos === 'def' ? 0.06 : 0) * (0.6 + k);
    case 'points': return sport.id === 'ice_hockey' ? goalsFor * (pos === 'forward' ? 0.75 : pos === 'defense' ? 0.4 : 0) * (0.6 + k) : 16 * (0.6 + k) * (pos === 'center' ? 0.95 : 1);
    case 'rebounds': return 6 * (0.5 + k) * (pos === 'center' ? 1.5 : pos === 'forward' ? 1.15 : 0.7);
    case 'clean': return clamp(0.12 + k * 0.3, 0, 0.6);
    case 'hits': return 4 * (0.15 + k * 0.2);
    case 'runs': return 25 * (0.4 + k) * (pos === 'bowler' ? 0.3 : 1);
    case 'wickets': return 1.6 * (0.4 + k) * (pos === 'allrounder' ? 0.6 : 1);
    case 'tries': return (pos === 'back' ? 0.6 : 0.3) * (0.6 + k);
    case 'kills': return 10 * (0.4 + k) * (pos === 'middle' ? 0.8 : 1);
    case 'digs': return 8 * (0.4 + k) * (pos === 'libero' ? 1.6 : 0.8);
    default: return 0;
  }
}
const statOf = (st, stat) => (stat === 'points' && st.points == null ? (st.goals ?? 0) + (st.assists ?? 0) : st[stat] ?? 0);

/**
 * Everyone in the league who could win, each with a score for the season and a season line. The player's line is the
 * one they actually played; everyone else's comes from their rating, how much they would play, and their team's year.
 */
function candidates(state, season, e, team) {
  const S = sp.ensure(state);
  const p = state.player;
  const sport = sportOf(season.sportId);
  const r = seeded(`awards/${season.id}`);
  const table = sp.standings(season);
  const n = table.length;
  const place = Object.fromEntries(table.map((x, i) => [x.teamId, i + 1]));
  const games = (tid) => season.fixtures.filter((f) => f.done && (f.home === tid || f.away === tid)).length;
  const teamBonus = (tid) => ((n - place[tid]) / Math.max(1, n - 1)) * 6 + (season.champion === tid ? 3 : 0);
  const out = [];
  for (const tid of season.teamIds) {
    const t = S.teams[tid];
    if (!t) continue;
    const g = games(tid);
    const slots = Math.max(1, Math.round((sport.teamSize ?? 6) / (sport.positions?.length ?? 1)));
    for (const x of t.roster) {
      if (x.id === p.id) continue;
      // A roster place keeps its own age from the first time it is needed, so "young" and "rookie" mean the same next year.
      x.born ??= state.year - seeded(`born/${x.id}`).int(19, 33);
      const better = t.roster.filter((y) => y.pos === x.pos && y.rating > x.rating).length;
      const role = better < slots ? 'starter' : better < slots + 2 ? 'rotation' : 'bench';
      const share = { starter: 0.92, rotation: 0.55, bench: 0.15 }[role];
      const k = x.rating / 100;
      const line = {};
      for (const a of awardsFor(sport)) if (a.stat) line[a.stat] = Math.round(perGame(sport, a.stat, x.pos, k) * g * share * r.normal(1, 0.18) * 10) / 10;
      if (line.hits != null) line.atBats = Math.round(4 * g * share);
      out.push({ who: x.npcId ?? x.id, name: x.name, teamId: tid, pos: x.pos, role, games: Math.round(g * share), line, age: state.year - x.born,
        rookie: (x.since ?? state.year) === state.year, rating: x.rating, prev: x.ratedLast ?? x.rating,
        score: x.rating * (0.55 + share * 0.45) + teamBonus(tid) + r.normal(0, 3.5) });
    }
  }
  // The player: the season they played.
  const mine = [...season.fixtures, ...season.playoffs].filter((f) => f.me?.played);
  if (mine.length) {
    const st = e.stats[state.year] ?? {};
    const line = {};
    for (const a of awardsFor(sport)) if (a.stat) line[a.stat] = statOf(st, a.stat);
    if (line.hits != null) line.atBats = st.atBats ?? mine.length * 4;
    const avg = mine.reduce((s, f) => s + f.me.rating, 0) / mine.length;
    const share = Math.min(1, mine.length / Math.max(1, games(team.id)));
    const earlier = Object.values(S.seasons).filter((s) => s.playerId === p.id && s.level === season.level && s.year < season.year && s.sportId === season.sportId);
    const lastAvg = e.lastAvgRating ?? null;
    out.push({ who: 'player', name: `${p.firstName} ${p.lastName}`, teamId: team.id, pos: e.position, role: season.role, games: mine.length, line, age: p.age,
      rookie: !earlier.length, rating: overall(e, p), prev: lastAvg == null ? null : lastAvg, avg,
      comeback: sp.myAthlete(state).injuries.some((i) => i.sportId === e.id && i.year === state.year - 1 && i.severity >= 35),
      score: (overall(e, p) + (avg - 6.5) * 6) * (0.55 + share * 0.45) + teamBonus(team.id) });
  }
  return { out, place, n, r };
}

const top = (list, by) => list.reduce((b, x) => (b == null || by(x) > by(b) ? x : b), null);
const named = (c, value) => (c ? { who: c.who, name: c.name, teamId: c.teamId, ...(value != null ? { value } : {}) } : null);

/**
 * Names a finished team season's awards, once. @returns {object[]} the awards the player won
 */
export function seasonAwards(state, season, e, team) {
  if (season.awards || !AWARD_LEVELS.includes(season.level)) return [];
  const sport = sportOf(season.sportId);
  const college = season.level === 'college';
  const { out, place, r } = candidates(state, season, e, team);
  const fit = (a) => out.filter((c) => !a.pos || a.pos.includes(c.pos));
  // The women's game names some of them its own way.
  const women = sp.orgOf(state.sports.teams[team.id]?.orgId, state)?.div === 'women';
  const WOMEN = { 'Sixth Man of the Year': 'Sixth Player of the Year', 'Best Defenseman': 'Best Defender' };
  const awards = [];
  for (const a of awardsFor(sport)) {
    const name = college && COLLEGE_NAMES[a.id] ? COLLEGE_NAMES[a.id] : women && WOMEN[a.name] ? WOMEN[a.name] : a.name;
    const pool = fit(a).filter((c) => c.games >= 3);
    let winner = null; let teamList = null;
    if (a.kind === 'best' || a.kind === 'pos') winner = named(top(pool, (c) => c.score));
    else if (a.kind === 'rookie') winner = named(top(pool.filter((c) => c.rookie), (c) => c.score));
    else if (a.kind === 'young') winner = named(top(pool.filter((c) => c.age <= (college ? 19 : 21)), (c) => c.score));
    else if (a.kind === 'bench') winner = named(top(pool.filter((c) => c.role !== 'starter'), (c) => c.score));
    else if (a.kind === 'improved') winner = named(top(pool.filter((c) => c.prev != null), (c) => (c.who === 'player' ? (c.avg - c.prev) * 6 : c.rating - c.prev) + r.normal(0, 1)));
    else if (a.kind === 'comeback') {
      // The player, back from a long injury; otherwise someone else in the league was (a name, from this season's luck).
      const me = pool.find((c) => c.who === 'player' && c.comeback && c.score >= 70);
      winner = named(me ?? (r.chance(0.8) ? r.pick(pool.filter((c) => c.who !== 'player' && c.role === 'starter')) : null));
    } else if (a.kind === 'stat') {
      const value = (c) => (a.per ? (a.stat === 'hits' ? (c.line.hits ?? 0) / Math.max(1, c.line.atBats ?? 1) : (c.line[a.stat] ?? 0) / Math.max(1, c.games)) : c.line[a.stat] ?? 0);
      const eligible = a.per ? pool.filter((c) => c.games >= 8) : pool;
      const w = top(eligible, value);
      if (w) winner = named(w, a.per ? Math.round(value(w) * (a.stat === 'hits' ? 1000 : 10)) / (a.stat === 'hits' ? 1000 : 10) : Math.round(value(w)));
    } else if (a.kind === 'coach') {
      // Most beyond what was expected of them before the season; a title counts for a little more.
      const tid = top(season.teamIds, (t) => (season.preview[t] ?? 0) - place[t] + (season.champion === t ? 2 : 0) + r.next() * 0.1);
      const org = sp.orgOf(state.sports.teams[tid]?.orgId, state);
      const coach = org ? coachFor(state, org) : null;
      if (coach) winner = { who: coach.id, name: coach.name, teamId: tid };
    } else if (a.kind === 'team') {
      // The best at each position, as many as the sport lines up there.
      const even = Math.max(1, Math.round((sport.teamSize ?? 6) / (sport.positions?.length ?? 1)));
      teamList = (sport.positions ?? [[null]]).flatMap(([pos]) => out.filter((c) => c.pos === pos && c.games >= 3).sort((x, y) => y.score - x.score).slice(0, AWARD_LINEUPS[sport.id]?.[pos] ?? even))
        .map((c) => ({ ...named(c), pos: c.pos }));
    }
    awards.push({ id: a.id, name, kind: a.kind, ...(a.stat ? { stat: a.stat, per: !!a.per } : {}), winner, ...(teamList ? { team: teamList } : {}) });
  }
  season.awards = awards;
  // Ratings as they stood, so next year's "most improved" has something to measure from.
  for (const tid of season.teamIds) for (const x of state.sports.teams[tid]?.roster ?? []) x.ratedLast = x.rating;
  const mine = [...season.fixtures, ...season.playoffs].filter((f) => f.me?.played);
  if (mine.length) e.lastAvgRating = mine.reduce((s, f) => s + f.me.rating, 0) / mine.length;
  return record(state, e, awards, { seasonId: season.id, league: season.name.replace(/ \d{4}$/, '') });
}

/** Puts the player's own awards on their record, once each, and tells them. @returns {object[]} */
function record(state, e, awards, o) {
  const won = awards.filter((a) => a.winner?.who === 'player' || a.team?.some((x) => x.who === 'player'));
  for (const a of won) {
    const key = `${state.year}/${o.seasonId ?? o.key}/${a.id}`;
    e.awards ??= [];
    if (e.awards.some((x) => x.key === key)) continue;
    e.awards.push({ key, year: state.year, id: a.id, name: a.name, kind: a.kind, seasonId: o.seasonId ?? null, league: o.league });
    const big = ['best', 'rookie', 'young'].includes(a.kind);
    const what = a.kind === 'team' ? `Named in the ${o.league} ${a.name}` : `${a.name}, ${o.league}`;
    milestone(`${what}, ${state.year}.`, 'career');
    sp.moment(state, { type: 'award', sportId: e.id, text: `${what}.`, sig: big ? 3 : 2, seasonId: o.seasonId ?? null, key: `award/${key}` });
  }
  const shown = awards.filter((a) => a.winner).slice(0, 4).map((a) => `${a.name}: ${a.winner.who === 'player' ? 'you' : a.winner.name}`).join('; ');
  if (shown) sp.say(state, `${o.league} awards, ${state.year}. ${shown}.${won.length ? ` ${won.length === 1 ? 'One of them is yours' : `${won.length} of them are yours`}.` : ''}`, won.length ? 'good' : 'neutral', o.seasonId ? { screen: 'season', id: o.seasonId } : { screen: 'sport', id: e.id });
  return won;
}

/**
 * An individual sport's year: Player of the Year, Newcomer of the Year, Comeback Player of the Year, for professionals
 * and national-squad athletes. Measured by the Pathways Rating, the titles and any medal, against the best of the rest,
 * who are named. @returns {object[]} the awards the player won
 */
export function yearAwards(state, e, sum) {
  if (!AWARD_LEVELS.includes(e.level) || e.level === 'college') return [];
  const S = sp.ensure(state);
  const key = `${e.id}/${e.level}/${state.year}`;
  S.yearAwards ??= {};
  if (S.yearAwards[key]) return [];
  const p = state.player;
  const r = seeded(`yearAwards/${key}/${p.countryId}`);
  const names = sp.internals.rosterNames(r, p.countryId, 3);
  const titles = e.titles.filter((t) => t.year === state.year).length;
  const mine = e.pr + titles * 45 + (sum.medal === 'gold' ? 140 : sum.medal ? 70 : 0);
  // The first season played at this level is a newcomer's season.
  e.firstSeasonAt ??= {};
  e.firstSeasonAt[e.level] ??= state.year;
  const firstPro = e.firstSeasonAt[e.level] === state.year;
  const back = sp.myAthlete(state).injuries.some((i) => i.sportId === e.id && i.year === state.year - 1 && i.severity >= 35);
  const rival = [Math.round(r.normal(e.level === 'pro' ? 1840 : 1720, 70)), Math.round(r.normal(e.level === 'pro' ? 1560 : 1460, 60)), 0];
  const awards = YEAR_AWARDS.map((a, i) => {
    const can = a.kind === 'best' || (a.kind === 'rookie' && firstPro) || (a.kind === 'comeback' && back && titles > 0);
    const playerWins = can && (a.kind === 'comeback' || mine > rival[i]);
    return { id: a.id, name: a.name, kind: a.kind, winner: playerWins ? { who: 'player', name: `${p.firstName} ${p.lastName}` } : a.kind === 'comeback' && !r.chance(0.7) ? null : { who: `rival_${key}_${i}`, name: names[i] } };
  });
  S.yearAwards[key] = awards;
  return record(state, e, awards, { key, league: `${sportOf(e.id).name} ${e.level === 'pro' ? 'tour' : 'national'}` });
}
