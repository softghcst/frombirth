// What a team looks like and is called: its name, its home and away jersey colors, and its players' shirt numbers. All
// can be changed by the player in Settings → Teams and jerseys. Colors and numbers are given the first time they are
// needed, from luck keyed to the club and the player, so they never change by themselves.
//
//   org.colors = { home: '#rrggbb', away: '#rrggbb' }      the club's shirts (every team of a club wears them)
//   roster entry .num = 1..99                               unique within the team
import { store } from '../state.js';
import { JERSEY_COLORS, LEVEL_NAMES, sportOf } from '../data/sports.js';
import * as sp from './sports.js';

const { seeded } = sp.internals;
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const HEX = /^#[0-9a-f]{6}$/i;

/** A club's jersey colors: its own, or two different colors given once. */
export function colorsOf(org) {
  if (!org) return { home: JERSEY_COLORS[0][1], away: JERSEY_COLORS[14][1] };
  if (!org.colors) {
    const r = seeded(`colors/${org.id}`);
    const home = r.pick(JERSEY_COLORS)[1];
    const away = r.chance(0.5) ? '#f6f6f2' : r.pick(JERSEY_COLORS.filter(([, c]) => c !== home))[1];
    org.colors = { home, away: away === home ? '#141414' : away };
  }
  return org.colors;
}
/** The name of a jersey color, if it is one of the usual ones. */
export const colorName = (hex) => JERSEY_COLORS.find(([, c]) => c.toLowerCase() === String(hex).toLowerCase())?.[0] ?? null;

/** Shirt numbers for a team: each player keeps theirs; newcomers get a free one. */
export function numbersOf(team) {
  if (!team) return team;
  const used = new Set(team.roster.map((x) => x.num).filter(Boolean));
  for (const x of team.roster) {
    if (x.num) continue;
    const r = seeded(`num/${team.id}/${x.id}`);
    let n = r.int(1, 99);
    for (let i = 0; i < 99 && used.has(n); i++) n = (n % 99) + 1;
    x.num = n; used.add(n);
  }
  return team;
}

/**
 * The leagues of this life, with their teams, for Settings: the player's own leagues first, then the rest, the
 * professional game before university, academies and schools.
 */
export function leagues(state = store.state) {
  const S = sp.ensure(state);
  const order = ['pro', 'elite', 'college', 'academy', 'school', 'club', 'recreational'];
  const mine = new Set(Object.values(S.seasons).filter((s) => s.playerId === state.player.id).map((s) => s.leagueId));
  return Object.values(S.orgs).filter((o) => o.kind === 'league' && o.teamIds?.length)
    .map((lg) => ({ league: lg, sport: sportOf(lg.sportId), level: LEVEL_NAMES[lg.level] ?? lg.level, mine: mine.has(lg.id),
      teams: lg.teamIds.map((id) => S.teams[id]).filter(Boolean).map((t) => ({ team: t, org: sp.orgOf(t.orgId, state) })) }))
    .sort((a, b) => (b.mine - a.mine) || order.indexOf(a.league.level) - order.indexOf(b.league.level) || a.league.name.localeCompare(b.league.name));
}

/** Renames a club. Every team of the club, and the employer a professional club is, take the new name. */
export function renameTeam(orgId, name, state = store.state) {
  const org = sp.orgOf(orgId, state);
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!org) return result(false, 'There is no such team.', 'neutral');
  if (!clean || clean.length > 40) return result(false, 'A team name needs 1 to 40 characters.', 'neutral');
  // Two teams in the same league cannot share a name.
  const S = sp.ensure(state);
  const rivals = Object.values(S.orgs).filter((o) => o.kind === 'league' && org.teamIds.some((id) => o.teamIds?.includes(id)))
    .flatMap((lg) => lg.teamIds.map((id) => S.teams[id]).filter((t) => t && t.orgId !== org.id).map((t) => sp.orgOf(t.orgId, state)?.name.toLowerCase()));
  if (rivals.includes(clean.toLowerCase())) return result(false, `Another team in the league is already called ${clean}.`, 'neutral');
  const was = org.name;
  org.name = clean;
  for (const id of org.teamIds) { const t = S.teams[id]; if (t) t.name = t.group === 'senior' ? clean : `${clean} ${t.group.toUpperCase()}`; }
  const emp = org.employerId ? state.jobs?.employers?.[org.employerId] : null;
  if (emp) emp.name = clean;
  if (state.player.career?.employerId === org.employerId && org.employerId) state.player.career.employer = clean;
  return result(true, `${was} is now ${clean}.`, 'good');
}

/** Sets a club's home and away jersey colors. */
export function setColors(orgId, home, away, state = store.state) {
  const org = sp.orgOf(orgId, state);
  if (!org) return result(false, 'There is no such team.', 'neutral');
  if (!HEX.test(home) || !HEX.test(away)) return result(false, 'Choose two colors.', 'neutral');
  org.colors = { home: home.toLowerCase(), away: away.toLowerCase() };
  return result(true, `${org.name} will wear ${colorName(home)?.toLowerCase() ?? 'their new color'} at home and ${colorName(away)?.toLowerCase() ?? 'their new color'} away.`, 'good');
}

/**
 * Renames a player on a roster. A teammate the player knows is a person in the game, so their name changes everywhere;
 * the player's own name is changed with the rest of their life, not here.
 */
export function renamePlayer(teamId, rosterId, name, state = store.state) {
  const t = sp.teamOf(teamId, state);
  const x = t?.roster.find((y) => y.id === rosterId);
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!x) return result(false, 'There is no such player.', 'neutral');
  if (x.id === state.player.id) return result(false, 'That is you.', 'neutral');
  if (!clean || clean.length > 40 || !/^[\p{L}\p{M}'’ .-]+$/u.test(clean)) return result(false, 'A name needs 1 to 40 letters.', 'neutral');
  const was = x.name;
  x.name = clean;
  const npc = x.npcId ? state.npcs[x.npcId] : null;
  if (npc) {
    const [first, ...rest] = clean.split(' ');
    npc.firstName = first;
    if (rest.length) npc.lastName = rest.join(' ');
  }
  return result(true, `${was} is now ${clean}.`, 'good');
}

/** Sets a player's shirt number, if no one else on the team wears it. */
export function setNumber(teamId, rosterId, num, state = store.state) {
  const t = numbersOf(sp.teamOf(teamId, state));
  const x = t?.roster.find((y) => y.id === rosterId);
  const n = Number(num);
  if (!x) return result(false, 'There is no such player.', 'neutral');
  if (!Number.isInteger(n) || n < 0 || n > 99) return result(false, 'A shirt number is 0 to 99.', 'neutral');
  const other = t.roster.find((y) => y !== x && y.num === n);
  if (other) return result(false, `${other.name} already wears ${n}.`, 'neutral');
  x.num = n;
  return result(true, `${x.name} wears ${n}.`, 'good');
}
