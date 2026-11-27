// Playing for one's country: the World Games (the summer games every four years, the winter games between them, the
// para games beside the summer ones), the World Baseball Classic, the qualifiers that decide which nations go, and the
// national federations that invite the athletes.
//
// An athlete represents the country they are from: where they were born, while they hold its citizenship, or else a
// country they are a citizen of; not simply where they live. Some nations are far stronger at a sport than others
// (data/sports.js NATION_STRENGTH): their teams win more, and a place on them is harder to win.
//
// The way in, each games year:
//   a team sport    the nation must come through its qualifier (the strongest go straight through), and then the player
//                   must be good enough for its squad;
//   an individual   the player must make the qualifying standard at the national trials;
//   then            the federation invites the player (a decision), who goes or not.
// Only athletes with a competitive record are considered: a professional, the national squad, or two years or more at
// a school, club, academy or university (engine/sports.js competitiveYears).
//
//   state.sports.qualifying['games/soccer/br/2028'] = { qualified, auto, strength }
//   e.gamesTeams = [{ year, picked, notQualified?, declined?, field, rounds, place, medal, nation }]
//   e.gamesMissed = [year]     e.medals = [{ year, medal, games, eventId?, team? }]
//   baseball: e.bb.classic = [{ year, result, nation }]
import { log, milestone } from '../state.js';
import { clamp } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { sportOf, WORLD_GAMES, isGamesYear, isWinterGamesYear, GAMES_SPORTS, NATION_STRENGTH, MEDAL_FOR, playedIn, BASEBALL as B } from '../data/sports.js';
import * as sp from './sports.js';
import { internals as lifeInternals } from './sportsLife.js';
import { held, issuer } from './citizenship.js';
import { seeded } from './sportsPlay.js';
import { gain } from './fame.js';
import { record as bbRecord, classicYear } from './baseball.js';
import { gamesTeamEvent } from './sportsExtras.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const overall = (e, p) => sp.internals.overall(e, p);
const name = (c) => COUNTRIES[c]?.name ?? c;
const decide = (...a) => lifeInternals.decide(...a);
const cap = (s) => `${s[0].toUpperCase()}${s.slice(1)}`;

// ---------- The nation, and how strong it is ----------

/** The country an athlete plays for: their country of birth while they are its citizen, else one they hold. */
export function nationOf(p) {
  const mine = held(p);
  const birth = p.birthCountryId;
  if (birth && COUNTRIES[birth] && (mine.includes(birth) || mine.includes(issuer(birth)))) return birth;
  return mine.find((c) => COUNTRIES[c]) ?? p.countryId;
}

/** How strong a nation is at a sport, 50–95: the strongest nations near the top, the sport's own countries middling. */
export function nationStrength(sportId, countryId) {
  const list = NATION_STRENGTH[sportId] ?? [];
  const i = list.indexOf(countryId);
  if (i >= 0) return Math.round(95 - i * (22 / Math.max(10, list.length)));
  if (sportOf(sportId)?.popular?.includes(countryId)) return 72;
  if (!playedIn(sportId, countryId)) return 50;
  let h = 0; for (const ch of `${countryId}/${sportId}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 56 + (h % 8);
}

/** How good a player must be to be picked: about 62 for a weak nation, about 84 for the strongest. */
export const selectionBar = (sportId, nation, team) => Math.round((team ? 62 : 64) + (nationStrength(sportId, nation) - 58) * 0.56);

/** The games a sport is at in a year (summer, winter or para), or null. */
export function gamesOf(sport, year) {
  if (!sport || GAMES_SPORTS.never.includes(sport.id)) return null;
  if ((GAMES_SPORTS.from[sport.id] ?? WORLD_GAMES.founded) > year || (GAMES_SPORTS.gaps[sport.id] ?? []).includes(year)) return null;
  if (GAMES_SPORTS.winter.includes(sport.id)) return isWinterGamesYear(year) ? { name: `Winter ${WORLD_GAMES.name} ${year}`, season: 'winter' } : null;
  if (!isGamesYear(year)) return null;
  return { name: sport.adaptive ? `Para ${WORLD_GAMES.name} ${year}` : `${WORLD_GAMES.name} ${year}`, season: 'summer' };
}

/**
 * Whether a nation came through the qualifier for a tournament: the three strongest go straight through, the rest
 * qualify more often the stronger they are. Decided once, and kept.
 */
export function nationQualified(state, event, sportId, nation, year = state.year) {
  const S = sp.ensure(state);
  S.qualifying ??= {};
  const k = `${event}/${sportId}/${nation}/${year}`;
  if (S.qualifying[k]) return S.qualifying[k];
  const rank = (NATION_STRENGTH[sportId] ?? []).indexOf(nation);
  const strength = nationStrength(sportId, nation);
  const auto = (rank >= 0 && rank < 3) || (event === 'classic' && B.classicStrong.includes(nation));
  const qualified = auto || seeded(`qualify/${k}`).chance(clamp((strength - 60) / 26, 0.04, 0.96));
  return (S.qualifying[k] = { qualified, auto, strength });
}

// ---------- Each year ----------

/** Who the federations look at: professionals and the national squad, and anyone with a real record who plays well. */
function considered(state, e) {
  if (e.status !== 'active' || e.level === 'recreational' || state.player.age < 14) return false;
  return ['pro', 'elite'].includes(e.level) || sp.competitiveYears(e, state) >= 2;
}

/**
 * After the season: in a games year, the qualifier, the trials and the invitation; in a Classic year, the same for
 * baseball. Called once a year for each sport played (engine/sportsLife.js).
 */
export function yearInternational(state, a, e) {
  const p = state.player;
  const sport = sportOf(e.id);
  if (!sport || !considered(state, e)) return;
  if ((a.injuries ?? []).some((x) => x.sportId === e.id && x.status === 'out')) return; // hurt: not this time
  const nation = nationOf(p);
  const o = overall(e, p);
  const g = gamesOf(sport, state.year);
  if (g) (sport.kind === 'team' ? teamGamesYear : soloGamesYear)(state, e, sport, g, nation, o);
  if (e.id === 'baseball' && classicYear(state.year)) classicTrials(state, e, nation, o);
}

function teamGamesYear(state, e, sport, g, nation, o) {
  e.gamesTeams ??= [];
  if (e.gamesTeams.some((x) => x.year === state.year)) return;
  const bar = selectionBar(sport.id, nation, true);
  const contender = o >= bar - 8 || ['pro', 'elite'].includes(e.level);
  const q = nationQualified(state, 'games', sport.id, nation);
  if (!q.qualified) {
    e.gamesTeams.push({ year: state.year, picked: false, notQualified: true, nation });
    if (contender) sp.say(state, `${name(nation)} lost in the ${sport.name.toLowerCase()} qualifiers: no team at the ${g.name}, so no place for you.`, 'neutral', { screen: 'sport', id: e.id });
    return;
  }
  if (o < bar) {
    e.gamesTeams.push({ year: state.year, picked: false, nation });
    if (contender) sp.say(state, `${name(nation)} ${q.auto ? 'went straight through' : 'came through the qualifiers'} and named their ${sport.name.toLowerCase()} squad for the ${g.name}. You were not in it.`, 'neutral', { screen: 'sport', id: e.id });
    return;
  }
  decide(state, { kind: 'gamesInvite', sportId: e.id, team: true, nation, games: g.name, key: `gamesInvite/${e.id}/${state.year}`,
    text: `${name(nation)} ${q.auto ? 'went straight through to' : 'came through the qualifiers for'} the ${g.name}, and the national federation wants you in the ${sport.name.toLowerCase()} squad.`,
    options: [{ id: 'yes', label: `Play for ${name(nation)}` }, { id: 'no', label: 'Turn it down' }] });
}

function soloGamesYear(state, e, sport, g, nation, o) {
  if ((e.gamesMissed ?? []).includes(state.year) || e.events.some((id) => sp.ensure(state).events[id]?.games && sp.ensure(state).events[id].year === state.year)) return;
  const bar = selectionBar(sport.id, nation, false);
  const contender = o >= bar - 8 || ['pro', 'elite'].includes(e.level);
  if (o < bar) {
    if (contender) {
      (e.gamesMissed ??= []).push(state.year);
      sp.say(state, `The ${name(nation)} trials for the ${g.name}: you ${o >= bar - 3 ? 'missed the qualifying standard by a whisker' : 'did not make the qualifying standard'}, and the selectors picked others.`, 'neutral', { screen: 'sport', id: e.id });
    }
    return;
  }
  decide(state, { kind: 'gamesInvite', sportId: e.id, team: false, nation, games: g.name, key: `gamesInvite/${e.id}/${state.year}`,
    text: `At the ${name(nation)} trials you made the qualifying standard in ${sport.name.toLowerCase()}. The national federation invites you to the ${g.name}.`,
    options: [{ id: 'yes', label: `Compete for ${name(nation)}` }, { id: 'no', label: 'Turn it down' }] });
}

/** The individual games: one event, against the best in the world. */
function soloGames(state, e, d) {
  const sport = sportOf(e.id);
  const ev = sp.internals.playEvent(state, e, 'elite', 'games', { name: d.games });
  if (!e.events.includes(ev.id)) e.events.push(ev.id);
  ev.games = true; ev.nation = d.nation;
  const medal = MEDAL_FOR[ev.place] ?? null;
  if (medal) {
    ev.medal = medal;
    (e.medals ??= []).push({ year: state.year, medal, games: ev.name, eventId: ev.id, nation: d.nation });
    milestone(`${cap(medal)} medal for ${name(d.nation)} in ${sport.name.toLowerCase()}, ${ev.name}.`, 'career');
    sp.moment(state, { type: 'medal', sportId: e.id, text: `${cap(medal)} medal for ${name(d.nation)} at the ${ev.name}.`, sig: 3, eventId: ev.id });
  } else sp.moment(state, { type: 'national', sportId: e.id, text: `Competed for ${name(d.nation)} at the ${ev.name}.`, sig: 2, eventId: ev.id });
  gain({ audience: 'sports', amount: medal === 'gold' ? 12 : medal ? 7 : 2, reach: 0.8, lasting: medal ? 0.6 : 0.2, why: `the ${ev.name}` }, state.player);
  const text = `The ${ev.name}, for ${name(d.nation)}: ${medal ? `a ${medal} medal!` : `you finished ${/^\d/.test(ev.place) ? ev.place : `in the ${ev.place.toLowerCase()}`}.`}`;
  sp.say(state, text, medal ? 'good' : 'neutral', { screen: 'event', id: ev.id });
  return result(true, text, medal ? 'good' : 'neutral');
}

/** The team games: the national side, eight nations, knockout games for the medals (engine/sportsExtras.js). */
function teamGames(state, e, d) {
  const t = gamesTeamEvent(state, e, {}, { nation: d.nation, selected: true, games: d.games });
  if (!t) return result(false, 'The tournament has been played.', 'neutral');
  const caps = seeded(`gamesCaps/${state.player.id}/${e.id}/${state.year}`).int(3, 6);
  if (!e.caps) milestone(`First cap for ${name(d.nation)} in ${sportOf(e.id).name.toLowerCase()}.`, 'career');
  e.caps = (e.caps ?? 0) + caps;
  gain({ audience: 'sports', amount: t.medal === 'gold' ? 12 : t.medal ? 7 : 2, reach: 0.8, lasting: t.medal ? 0.6 : 0.2, why: `the ${d.games}` }, state.player);
  const last = t.rounds.at(-1);
  const text = `The ${d.games}: ${name(d.nation)} ${t.medal ? `won ${t.medal}` : `went out in the ${t.place.toLowerCase()}`}${last ? `, ${last.score.join('–')} against ${name(last.opp)}${last.how}` : ''}.`;
  return result(true, text, t.medal ? 'good' : 'neutral');
}

// ---------- The World Baseball Classic ----------

/** The Classic: the nation through its qualifier (the strongest are invited), then a place on its roster. */
function classicTrials(state, e, nation, o) {
  const R = bbRecord(e);
  if (R.classic.some((x) => x.year === state.year) || R.classicLooked === state.year) return;
  R.classicLooked = state.year;
  const strong = B.classicStrong.includes(nation);
  // A strong nation's roster is big leaguers; elsewhere minor leaguers, and in the smallest the best amateurs too.
  const pro = e.level === 'pro';
  if (!pro && (strong || nationStrength('baseball', nation) >= 80)) return;
  const bar = strong ? 80 : Math.min(76, selectionBar('baseball', nation, true));
  const contender = pro || o >= bar - 6;
  const q = nationQualified(state, 'classic', 'baseball', nation);
  if (!q.qualified) {
    if (contender) sp.say(state, `${name(nation)} did not come through the qualifiers for the World Baseball Classic ${state.year}.`, 'neutral', { screen: 'sport', id: e.id });
    return;
  }
  if (o < bar) {
    if (contender && pro) sp.say(state, `${name(nation)} named their roster for the World Baseball Classic ${state.year}. You were not on it.`, 'neutral', { screen: 'sport', id: e.id });
    return;
  }
  decide(state, { kind: 'classicInvite', sportId: e.id, nation, key: `classicInvite/${e.id}/${state.year}`,
    text: `${name(nation)} ${q.auto ? 'are in' : 'came through the qualifiers for'} the World Baseball Classic ${state.year}, and they want you on the roster.`,
    options: [{ id: 'yes', label: `Play for ${name(nation)}` }, { id: 'no', label: 'Stay with your club' }] });
}

function classic(state, e, d) {
  const p = state.player;
  const R = bbRecord(e);
  if (R.classic.some((x) => x.year === state.year)) return result(false, 'The Classic has been played.', 'neutral');
  const o = overall(e, p);
  const s = nationStrength('baseball', d.nation);
  const r = seeded(`classic/${d.nation}/${state.year}`);
  // How far a nation goes: its strength, and a little the player's own.
  const roll = r.next() * (1 + (92 - s) / 12) - (o - 80) / 200;
  const res = roll < 0.12 ? 'champions' : roll < 0.25 ? 'runners-up' : roll < 0.5 ? 'semifinalists' : roll < 1.1 ? 'out in the quarterfinals' : 'out in the pool round';
  R.classic.push({ year: state.year, result: res, nation: d.nation });
  e.caps = (e.caps ?? 0) + r.int(3, 7);
  const text = `The World Baseball Classic ${state.year}: you played for ${name(d.nation)}, ${res}.`;
  sp.say(state, text, res === 'champions' ? 'good' : 'neutral', { screen: 'sport', id: e.id });
  sp.moment(state, { type: 'national', sportId: e.id, text: `Played for ${name(d.nation)} at the World Baseball Classic${res === 'champions' ? ', and won it' : ''}.`, sig: res === 'champions' ? 3 : 2 });
  if (res === 'champions') milestone(`Won the World Baseball Classic with ${name(d.nation)}.`, 'career');
  gain({ audience: 'sports', amount: res === 'champions' ? 8 : 3, reach: 0.6, lasting: 0.4, why: 'the World Baseball Classic' }, p);
  return result(true, text, res === 'champions' ? 'good' : 'neutral');
}

// ---------- Answers ----------

export const NATIONS_ANSWERS = {
  gamesInvite(state, d, choice) {
    const e = sp.entryOf(d.sportId, state.player.id, state);
    if (!e || e.status !== 'active') return { ...result(false, 'You no longer play it.', 'neutral'), close: true };
    if (choice === 'no') {
      if (d.team) (e.gamesTeams ??= []).push({ year: state.year, picked: true, declined: true, nation: d.nation });
      else (e.gamesMissed ??= []).push(state.year);
      const text = `You turned down the ${d.games}. ${name(d.nation)} went without you.`;
      log(text, 'system', 'neutral');
      return result(true, text, 'neutral');
    }
    return d.team ? teamGames(state, e, d) : soloGames(state, e, d);
  },
  classicInvite(state, d, choice) {
    const e = sp.entryOf(d.sportId, state.player.id, state);
    if (!e || e.status !== 'active') return { ...result(false, 'You no longer play it.', 'neutral'), close: true };
    if (choice === 'no') {
      const text = `You stayed with your club. ${name(d.nation)} played the World Baseball Classic without you.`;
      log(text, 'system', 'neutral');
      return result(true, text, 'neutral');
    }
    return classic(state, e, d);
  },
};
