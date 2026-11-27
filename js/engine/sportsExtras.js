// Three parts of the athletic life beyond the player's own club and events:
//
//   The World Games team events. In a games year the national side of each club sport goes to the World Games: eight
//   nations, a quarterfinal, a semifinal and a final, every game played (sportsPlay.teamGame). A player is picked if
//   they are capped and good enough; a medal is the team's and theirs.
//
//   Managing a squad. A coach of a club sport (sportsLife.becomeCoach) runs its first team: who starts, how the side
//   plays (tactics), what training stresses. The season is played game by game against the league; the players grow
//   (or fade) with the training; the board judges the coach by the table, and a good coach is wanted by bigger clubs.
//     a.coaching = { sportId, since, orgId, tactics, training, benched:[rosterId], seasons:[{year, place, of, w, d, l}], warned }
//
//   Boxing. A sport of its own (data/sports.js), with weight classes and a world title of a fictional sanctioning body.
//   A professional boxer fights a few times a year against ranked opponents; the record (wins, losses, knockouts) and
//   the rating set their rank; the top contenders get a title shot; a champion defends the belt until someone takes it.
//     e.boxing = { weight, record:{ w, l, ko }, rank, title:{ since, defenses } | null, fights:[...], titles:[...] }
//
// Everything that is luck in a competition comes from seeded runs keyed to the competition (sportsPlay.seeded), like
// the rest of the sports engine: a reload never re-rolls a result, and the game's own dice are not touched.
import { store, milestone } from '../state.js';
import { clamp } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { sportOf, WORLD_GAMES } from '../data/sports.js';
import * as sp from './sports.js';
import * as life from './sportsLife.js';
import { teamGame, bout, seeded, edge } from './sportsPlay.js';
import { nationOf, gamesOf, nationStrength as nationPower } from './nations.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const overall = (e, p) => sp.internals.overall(e, p);
const name = (c) => COUNTRIES[c]?.name ?? c;

// ---------- The World Games: team events ----------

export const GAMES_TEAMS = 8;
/** How strong a nation's side is in a sport: the sport's big countries are stronger; the player lifts their own. */
function nationStrength(sport, countryId, r) {
  return Math.round(clamp(nationPower(sport.id, countryId) + r.normal(0, 3), 50, 97)); // data/sports.js NATION_STRENGTH
}
/** A knockout game: a score, and if level, extra time and then penalties (or a shoot-out), the stronger more often. */
function knockout(sport, a, b, key) {
  const [x, y] = teamGame(sport, a, b, key);
  if (x !== y) return { score: [x, y], won: x > y, how: '' };
  const r = seeded(`${key}/decider`);
  const won = r.chance(edge(a, b, 14));
  return { score: [x, y], won, how: sport.adapter === 'goals' ? ' on penalties' : ' after extra time' };
}
/**
 * The World Games in a team sport, for the player's nation (engine/nations.js nationOf). Played when the player has
 * accepted the federation's invitation (o.selected, o.nation, o.games); called without them, a capped professional is
 * picked on their game alone.
 * @returns {?object} the tournament, or null if not picked or not a games year
 */
export function gamesTeamEvent(state, e, sum, opt = {}) {
  const p = state.player;
  const sport = sportOf(e.id);
  if (!gamesOf(sport, state.year) || sport.kind !== 'team') return null;
  if (!opt.selected && (e.level !== 'pro' || !(e.caps > 0))) return null;
  const key = `gamesTeam/${p.id}/${e.id}/${state.year}`;
  e.gamesTeams ??= [];
  if (e.gamesTeams.some((g) => g.year === state.year)) return null;
  const o = overall(e, p);
  if (!opt.selected && o < 80) {
    e.gamesTeams.push({ year: state.year, picked: false });
    sp.say(state, `${name(nationOf(p))} named their ${sport.name.toLowerCase()} squad for the ${WORLD_GAMES.name}. You were not in it.`, 'neutral', { screen: 'sport', id: e.id });
    return null;
  }
  const r = seeded(key);
  const home = opt.nation ?? nationOf(p);
  const others = r.shuffle((sport.popular ?? []).filter((c) => c !== home && COUNTRIES[c]));
  const rest = r.shuffle(Object.keys(COUNTRIES).filter((c) => c !== home && !others.includes(c)));
  const field = [home, ...others, ...rest].slice(0, GAMES_TEAMS);
  const power = Object.fromEntries(field.map((c) => [c, nationStrength(sport, c, r)]));
  power[home] = Math.round(clamp(power[home] + (o - 78) / 3, 50, 97));
  const t = { year: state.year, picked: true, field, rounds: [], place: null, medal: null, division: sp.divOf(p), nation: home };
  let alive = true;
  let pool = field.filter((c) => c !== home);
  const ROUNDS = ['Quarterfinal', 'Semifinal', 'Final'];
  for (const [i, round] of ROUNDS.entries()) {
    if (!alive) break;
    // The draw keeps the strongest apart: the opponent is drawn from the stronger half of those left, later rounds harder.
    pool.sort((x, y) => power[y] - power[x]);
    const opp = i === 0 ? pool[pool.length - 1 - r.int(0, 2)] : pool[r.int(0, Math.min(1, pool.length - 1))];
    pool = pool.filter((c) => c !== opp);
    const g = knockout(sport, power[home], power[opp], `${key}/${round}`);
    t.rounds.push({ round, opp, score: g.score, won: g.won, how: g.how });
    if (!g.won) {
      alive = false;
      t.place = round;
      // Beaten in a semifinal: the bronze medal game.
      if (round === 'Semifinal') {
        const third = pool[r.int(0, Math.max(0, pool.length - 1))] ?? opp;
        const b = knockout(sport, power[home], power[third], `${key}/bronze`);
        t.rounds.push({ round: 'Bronze medal game', opp: third, score: b.score, won: b.won, how: b.how });
        if (b.won) { t.medal = 'bronze'; t.place = 'Bronze'; }
      }
    } else if (round === 'Final') { t.medal = 'gold'; t.place = 'Champion'; }
  }
  if (t.place === 'Final') t.medal = 'silver';
  e.gamesTeams.push(t);
  sum.gamesTeam = t.medal ?? t.place;
  const games = opt.games ?? gamesOf(sport, state.year).name;
  if (t.medal) {
    (e.medals ??= []).push({ year: state.year, medal: t.medal, games, team: true });
    milestone(`${t.medal[0].toUpperCase()}${t.medal.slice(1)} medal with ${name(home)} in ${sport.name.toLowerCase()}, ${games}.`, 'career');
    sp.moment(state, { type: 'medal', sportId: e.id, text: `${t.medal[0].toUpperCase()}${t.medal.slice(1)} with ${name(home)} at the ${games}.`, sig: 3 });
  }
  const last = t.rounds.at(-1);
  sp.say(state, `The ${games}: ${name(home)} ${t.medal ? `won ${t.medal}` : `went out in the ${t.place.toLowerCase()}`}${last ? `, ${last.score.join('–')} against ${name(last.opp)}${last.how}` : ''}.`, t.medal ? 'good' : 'neutral', { screen: 'sport', id: e.id });
  return t;
}

// ---------- Managing a squad ----------

export const TACTICS = {
  attacking: { name: 'Attacking', blurb: 'Numbers forward. More goals both ways.', vsStrong: -2, vsWeak: 4 },
  balanced: { name: 'Balanced', blurb: 'Steady. No surprises.', vsStrong: 0, vsWeak: 1 },
  defensive: { name: 'Defensive', blurb: 'Hard to beat. Hard to watch.', vsStrong: 3, vsWeak: -2 },
};
export const TRAINING = {
  fitness: { name: 'Fitness', blurb: 'Fewer late collapses; older players last.', grow: { young: 0.5, prime: 1, old: 1.5 } },
  technique: { name: 'Technique', blurb: 'Everyone gets a little better at the game.', grow: { young: 1.5, prime: 1, old: 0.3 } },
  youth: { name: 'Youth development', blurb: 'The young players come on fast; the first team waits.', grow: { young: 3, prime: 0.3, old: 0 } },
};
/** The squad the player coaches, if they coach a club sport. */
export function squadOf(state = store.state) {
  const a = sp.myAthlete(state);
  const c = a?.coaching;
  if (!c) return null;
  const sport = sportOf(c.sportId);
  if (sport.kind !== 'team') return null;
  const org = sp.orgOf(c.orgId, state);
  if (!org) return null;
  const team = sp.internals.teamFor(state, org, { ...state.player, age: 30 });
  c.tactics ??= 'balanced';
  c.training ??= 'technique';
  c.benched ??= [];
  c.seasons ??= [];
  return { c, sport, org, team };
}
/** Who starts: the best of those not left out, as many as the sport puts on the field. */
export function lineup(sq) {
  const n = sq.sport.teamSize ?? 11;
  return sq.team.roster.filter((x) => !x.player && !sq.c.benched.includes(x.id)).sort((x, y) => y.rating - x.rating).slice(0, n);
}
export function setTactics(id, state = store.state) {
  const sq = squadOf(state);
  if (!sq || !TACTICS[id]) return result(false, 'You do not coach a side.', 'neutral');
  sq.c.tactics = id;
  return result(true, `${TACTICS[id].name} from now on.`, 'neutral');
}
export function setTraining(id, state = store.state) {
  const sq = squadOf(state);
  if (!sq || !TRAINING[id]) return result(false, 'You do not coach a side.', 'neutral');
  sq.c.training = id;
  return result(true, `Training this year: ${TRAINING[id].name.toLowerCase()}.`, 'neutral');
}
/** Leaves a player out of the side, or brings them back. A squad needs enough players to field a team. */
export function toggleBench(rosterId, state = store.state) {
  const sq = squadOf(state);
  if (!sq) return result(false, 'You do not coach a side.', 'neutral');
  const x = sq.team.roster.find((y) => y.id === rosterId);
  if (!x) return result(false, 'Not in the squad.', 'neutral');
  if (sq.c.benched.includes(rosterId)) { sq.c.benched = sq.c.benched.filter((y) => y !== rosterId); return result(true, `${x.name} is back in contention.`, 'neutral'); }
  const n = sq.sport.teamSize ?? 11;
  if (sq.team.roster.filter((y) => !y.player && !sq.c.benched.includes(y.id)).length <= n) return result(false, 'You need enough players to field a side.', 'neutral');
  sq.c.benched.push(rosterId);
  return result(true, `${x.name} is out of the side for now.`, 'neutral');
}
/** The side's strength for a game: the starters, the coach, and how the tactics suit the opponent. */
function sideStrength(sq, coachQuality, oppStrength) {
  const xi = lineup(sq);
  const base = xi.reduce((s, x) => s + x.rating, 0) / Math.max(1, xi.length);
  const t = TACTICS[sq.c.tactics];
  return base + (coachQuality - 50) / 10 + (oppStrength > base ? t.vsStrong : t.vsWeak);
}
/**
 * A coach's season: every fixture against the league's other teams, home and away, a table, the players growing with
 * the training, and the board's verdict. Called once a year from the sports year.
 * @returns {string[]} lines for the journal
 */
export function coachSeason(state) {
  const sq = squadOf(state);
  if (!sq || sq.c.since >= state.year) return [];
  const { c, sport, org, team } = sq;
  const lived = state.year - 1;
  if (c.seasons.some((x) => x.year === lived)) return [];
  const coach = sp.ensure(state).coaches[state.player.id];
  const q = coach?.quality ?? 50;
  const lg = sp.internals.leagueFor(state, org, team);
  const rivals = lg.teamIds.filter((id) => id !== team.id).map((id) => sp.ensure(state).teams[id]).filter(Boolean);
  const key = `coach/${state.player.id}/${org.id}/${lived}`;
  const table = Object.fromEntries([team, ...rivals].map((t) => [t.id, { id: t.id, name: t.name, w: 0, d: 0, l: 0, pts: 0 }]));
  let g = 0;
  for (const op of rivals) for (const leg of ['home', 'away']) {
    const os = sp.internals.teamStrength(op) + (leg === 'home' ? -1 : 1);
    const ms = sideStrength(sq, q, os) + (leg === 'home' ? 1.5 : 0);
    const [a, b] = teamGame(sport, ms, os, `${key}/${op.id}/${leg}/${g++}`);
    const me = table[team.id]; const them = table[op.id];
    if (a > b) { me.w++; them.l++; me.pts += 3; } else if (a < b) { me.l++; them.w++; them.pts += 3; } else { me.d++; them.d++; me.pts++; them.pts++; }
  }
  // The other fixtures, played quickly between the rivals, so the table is complete.
  for (const x of rivals) for (const y of rivals) {
    if (x === y) continue;
    const [a, b] = teamGame(sport, sp.internals.teamStrength(x), sp.internals.teamStrength(y), `${key}/${x.id}/${y.id}`);
    const tx = table[x.id]; const ty = table[y.id];
    if (a > b) { tx.w++; ty.l++; tx.pts += 3; } else if (a < b) { tx.l++; ty.w++; ty.pts += 3; } else { tx.d++; ty.d++; tx.pts++; ty.pts++; }
  }
  const order = Object.values(table).sort((x, y) => y.pts - x.pts || y.w - x.w);
  const place = order.findIndex((x) => x.id === team.id) + 1;
  const mine = table[team.id];
  c.seasons.push({ year: lived, place, of: order.length, w: mine.w, d: mine.d, l: mine.l, pts: mine.pts, league: lg.name });
  // The players grow (or fade) with the training and their age.
  const tr = TRAINING[c.training];
  const rg = seeded(`${key}/growth`);
  for (const x of team.roster) {
    if (x.player) continue;
    const age = x.age ?? (x.age = rg.int(18, 34));
    const band = age <= 22 ? 'young' : age <= 29 ? 'prime' : 'old';
    const drift = band === 'old' ? -1.5 : band === 'young' ? 1 : 0;
    x.rating = Math.round(clamp(x.rating + drift + tr.grow[band] * (q / 60) + rg.normal(0, 1.2), 10, 97));
    x.age = age + 1;
  }
  const lines = [`${org.name}, ${lived}: ${place}${['th', 'st', 'nd', 'rd'][place] ?? 'th'} of ${order.length} in the ${lg.name} (${mine.w} won, ${mine.d} drawn, ${mine.l} lost).`];
  if (place === 1) { milestone(`Coached ${org.name} to the ${lg.name} title.`, 'career'); lines.push('Champions. The players throw you in the air.'); coach && (coach.quality = Math.round(clamp(q + 3))); }
  // The board: a bottom-three finish is a warning; two in a row and the coach is let go.
  const bottom = place > order.length - 3;
  if (bottom) {
    c.warned = (c.warned ?? 0) + 1;
    if (c.warned >= 2) { lines.push(`The board at ${org.name} have let you go after two seasons near the bottom.`); endCoaching(state, 'sacked'); return lines; }
    lines.push(`The board at ${org.name} expect better next season.`);
  } else c.warned = 0;
  // A good coach is wanted: a bigger club calls.
  if (place <= 2 && rg.chance(0.35)) {
    const bigger = sp.internals.findOrg(state, sport, 'club', { n: rg.int(1, 3), strength: 6 });
    if (bigger.id !== org.id) {
      life.internals.decide(state, { kind: 'coachOffer', sportId: sport.id, orgId: bigger.id, orgName: bigger.name, key: `coachOffer/${state.player.id}/${state.year}`,
        text: `${bigger.name} want you as their coach: a stronger squad, and higher expectations.`, options: [{ id: 'yes', label: `Go to ${bigger.name}` }, { id: 'no', label: `Stay at ${org.name}` }] });
    }
  }
  return lines;
}
/** Moves to another club as its coach (an offer taken). */
export function moveCoaching(state, orgId) {
  const sq = squadOf(state);
  if (!sq) return result(false, 'You do not coach a side.', 'neutral');
  const org = sp.orgOf(orgId, state);
  sq.c.orgId = orgId; sq.c.benched = []; sq.c.warned = 0; sq.c.since = state.year;
  const coach = sp.ensure(state).coaches[state.player.id];
  if (coach) { coach.orgId = orgId; coach.history.push({ year: state.year, orgId, text: `Took over at ${org.name}.` }); }
  milestone(`Became the coach of ${org.name}.`, 'career');
  return result(true, `You are the coach of ${org.name} now.`);
}
function endCoaching(state, why) {
  const a = sp.myAthlete(state);
  if (!a?.coaching) return;
  (a.pastCoaching ??= []).push({ ...a.coaching, to: state.year, why });
  a.coaching = null;
}

// ---------- Boxing ----------

export const WEIGHTS = ['Flyweight', 'Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Light heavyweight', 'Heavyweight'];
export const BELT = { body: 'World Ring Council', from: 1921 };
const FIGHTS_A_YEAR = 3;
/** A boxer's record, made the first time they fight as a professional. Their weight follows their build. */
export function boxerOf(e, p = store.state.player) {
  if (e.boxing) return e.boxing;
  const r = seeded(`weight/${p.id}`);
  const base = p.gender === 'female' ? 2 : 4;
  e.boxing = { weight: WEIGHTS[clamp(base + r.int(-2, 3), 0, WEIGHTS.length - 1)], record: { w: 0, l: 0, ko: 0 }, rank: null, title: null, fights: [], titles: [] };
  return e.boxing;
}
/** Where a boxer stands in their division: from their rating and their record. 1 is the top contender. */
function rankOf(e, b) {
  // An unbeaten prospect climbs in about two dozen fights; losses cost more than wins gain.
  return Math.max(1, Math.round(45 - b.record.w * 2.5 - b.record.ko + b.record.l * 4 - (e.pr - 1500) / 20));
}
/**
 * A professional boxer's year: a few fights against ranked opponents, a title shot for a top contender, and title
 * defenses for a champion. Purses are paid like prize money (sportsLife.settle).
 */
export function boxingYear(state, a, e, sum) {
  const p = state.player;
  const b = boxerOf(e, p);
  const div = sp.divOf(p);
  const me = overall(e, p);
  const fights = FIGHTS_A_YEAR - (a.injuries.some((x) => x.status === 'out' && x.sportId === e.id) ? 2 : 0);
  for (let i = 0; i < fights; i++) {
    const key = `fight/${p.id}/${e.id}/${state.year}/${i}`;
    const r = seeded(key);
    b.rank = rankOf(e, b);
    const titleFight = state.year >= BELT.from && (b.title || (b.rank <= 3 && i === fights - 1));
    const opp = { name: `${r.pick(COUNTRIES[r.pick([p.countryId, 'us', 'mx', 'uk', 'ph', 'jp'])]?.names?.[div === 'women' ? 'female' : 'male'] ?? ['Alex'])} ${r.pick(COUNTRIES[p.countryId].names.last)}`,
      skill: Math.round(clamp((b.title ? 84 : titleFight ? 86 : 60 + (60 - b.rank) * 0.4) + r.normal(0, 4), 40, 97)) };
    const res = bout(me, opp.skill, key);
    const won = res.winner === 0;
    const ko = /stoppage|before the final/.test(res.how);
    const f = { year: state.year, opp: opp.name, oppSkill: opp.skill, won, how: res.how.replace('by submission', 'by stoppage').replace('by pin', 'by stoppage'), title: titleFight ? `${b.weight} title` : null };
    b.fights.push(f);
    if (b.fights.length > 60) b.fights.shift();
    if (won) { b.record.w++; if (ko) b.record.ko++; sum.wins = (sum.wins ?? 0) + 1; } else { b.record.l++; sum.losses = (sum.losses ?? 0) + 1; }
    e.played += 1; if (won) e.wins += 1; else e.losses += 1;
    e.pr = Math.max(100, e.pr + Math.round((won ? 1 : -1) * (12 + Math.max(0, opp.skill - me) / 2)));
    const purse = life.internals.money(state, Math.round((titleFight ? 400000 : 15000 + Math.max(0, 60 - b.rank) * 2500) * (won ? 1.2 : 1)));
    life.settle(state, `purse/${key}`, purse, 'prizeMoney', `Purse: ${opp.name}${titleFight ? ' (title fight)' : ''}`);
    if (a.agentId) life.settle(state, `agent/purse/${key}`, -Math.round(purse * life.agentCut(a)), 'sport', 'Your agent\'s share');
    if (titleFight) {
      if (won && !b.title) {
        b.title = { since: state.year, defenses: 0 };
        b.titles.push({ year: state.year, weight: b.weight, body: BELT.body });
        milestone(`Won the ${BELT.body} ${b.weight.toLowerCase()} title.`, 'career');
        sp.moment(state, { type: 'title', sportId: e.id, text: `${BELT.body} ${b.weight.toLowerCase()} champion.`, sig: 3 });
        sp.say(state, `You beat ${opp.name} ${f.how} and are the ${BELT.body} ${b.weight.toLowerCase()} champion of the world.`, 'good', { screen: 'sport', id: e.id });
      } else if (won && b.title) {
        b.title.defenses++;
        sp.say(state, `A title defense against ${opp.name}: won ${f.how}. ${b.title.defenses} ${b.title.defenses === 1 ? 'defense' : 'defenses'} now.`, 'good', { screen: 'sport', id: e.id });
      } else if (!won && b.title) {
        b.titles.at(-1).lost = state.year;
        b.titles.at(-1).defenses = b.title.defenses;
        sp.say(state, `${opp.name} beat you ${f.how}. The ${b.weight.toLowerCase()} title is theirs now.`, 'bad', { screen: 'sport', id: e.id });
        b.title = null;
      } else sp.say(state, `A title shot against the champion, ${opp.name}: you lost ${f.how}.`, 'bad', { screen: 'sport', id: e.id });
    }
  }
  b.rank = b.title ? 0 : rankOf(e, b);
  sum.games = fights; sum.role = 'starter';
  sum.boxing = { record: `${b.record.w}-${b.record.l} (${b.record.ko} KO)`, rank: b.rank, champion: !!b.title };
  sp.say(state, `${state.year}: ${b.record.w} wins, ${b.record.l} losses, ${b.record.ko} by knockout. ${b.title ? `${BELT.body} ${b.weight.toLowerCase()} champion.` : `Ranked ${b.rank} at ${b.weight.toLowerCase()}.`}`, 'neutral', { screen: 'sport', id: e.id });
}
