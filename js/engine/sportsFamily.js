// Sport in the family: the athletic lives of the people around the player, kept lightly.
//
// A parent or grandparent may have played when they were young; a brother may take up the sport his sister plays, or
// a different one, or none; the player's own children choose for themselves. Nobody here is a copy of the player:
// interest is each person's own, drawn from their own run of luck, and a parent who played professionally guarantees
// nothing. Relatives' records sit beside the player's in state.sports.athletes, marked `light`: a level reached, the
// seasons played, titles, and the moments worth keeping, without the player's per-skill detail.
//
// Parents also take part in the player's sporting life: they come to games, pay for what children cannot, and say
// so when the cost worries them.
import { store, player } from '../state.js';
import { clamp } from '../util.js';
import { SPORTS_LIST, sportOf } from '../data/sports.js';
import * as sp from './sports.js';

const { seeded, fullName, LEVEL_STRENGTH } = sp.internals;
const RELATIVES = { parent: -1, grandparent: -2, sibling: 0, child: 1, grandchild: 2 };
const LEVEL_ORDER = ['recreational', 'club', 'school', 'academy', 'college', 'elite', 'pro'];
const genOf = (state, n) => (state.player.generation ?? 1) + (RELATIVES[n.role] ?? 0);

/** A light record for a relative. */
function lightRecord(state, n) {
  const S = sp.ensure(state);
  if (S.athletes[n.id]) return S.athletes[n.id];
  const a = { id: n.id, name: fullName(n), gen: genOf(state, n), born: state.year - n.age, countryId: n.bornIn ?? state.player.countryId, light: true,
    sports: {}, primary: null, injuries: [], fame: 0, confidence: 55, motivation: 60, arcs: [], retired: null, agentId: null, coaching: null, parents: [], relation: n.role };
  S.athletes[n.id] = a;
  return a;
}
/** A sport entry in a light record: what level was reached, and for how long. No per-skill detail is invented. */
function lightEntry(a, sportId, since) {
  return (a.sports[sportId] ??= { id: sportId, since, sinceAge: since - a.born, skills: {}, ceiling: {}, pr: 1000, played: 0, wins: 0, losses: 0, draws: 0,
    level: 'recreational', peak: 0, orgId: null, teamId: null, position: null, coachId: null, plan: { type: 'balanced', hours: 0 }, fatigue: 0, form: 50, status: 'active',
    best: {}, titles: [], seasons: [], events: [], stats: {}, history: [], seasonsPlayed: 0 });
}
/** Sports someone could have played in a given year, where they lived. Popular sports there are likelier. */
function sportsIn(year, countryId, r) {
  const open = SPORTS_LIST.filter((s) => s.founded <= year && !s.adaptive && s.kind !== 'fitness');
  const pop = open.filter((s) => s.popular.includes(countryId));
  if (!open.length) return null; // before any organized sport existed (the eras go back to 1800)
  return r.chance(0.7) && pop.length ? r.pick(pop) : r.pick(open);
}

/**
 * Parents and grandparents: whether they played when they were young, and how far they got. Decided once for each,
 * from their own luck; most did not play seriously at all. Their careers are in the past, and written as such.
 */
export function familyPast(state = store.state) {
  const S = sp.ensure(state);
  S.pastDone ??= {};
  for (const id of state.player.npcIds) {
    const n = state.npcs[id];
    if (!n || !['parent', 'grandparent'].includes(n.role) || S.pastDone[n.id] || S.athletes[n.id]) continue;
    S.pastDone[n.id] = 1;
    const r = seeded(`past/${n.id}`);
    if (!r.chance(0.35)) continue;
    const born = state.year - n.age;
    const youth = born + r.int(8, 12);
    const sport = sportsIn(youth, n.bornIn ?? state.player.countryId, r);
    if (!sport || sport.founded > youth || born + 8 > state.year) continue;
    const a = lightRecord(state, n);
    const e = lightEntry(a, sport.id, youth);
    const roll = r.next();
    e.level = roll < 0.03 && born + 20 >= sport.proFrom ? 'pro' : roll < 0.06 ? 'elite' : roll < 0.18 && sport.college.includes(state.player.countryId) ? 'college' : roll < 0.38 ? 'school' : 'club';
    e.peak = Math.round(clamp(LEVEL_STRENGTH[e.level] + r.normal(0, 5), 20, 95));
    e.seasonsPlayed = r.int(3, e.level === 'pro' ? 14 : 9);
    e.status = 'retired';
    e.retiredYear = Math.min(state.year - 1, youth + e.seasonsPlayed);
    if (r.chance(e.level === 'pro' ? 0.6 : 0.3)) e.titles.push({ year: Math.min(e.retiredYear, youth + r.int(1, e.seasonsPlayed)), name: `a ${sport.name.toLowerCase()} title at ${sp.LEVEL_NAMES[e.level]?.toLowerCase() ?? e.level} level`, past: true });
    a.primary = sport.id;
    a.retired = { year: e.retiredYear, age: e.retiredYear - born };
    sp.moment(state, { personId: n.id, name: fullName(n), gen: a.gen, year: youth, age: youth - born, type: 'start', sportId: sport.id, sig: 2,
      text: `Played ${sport.name.toLowerCase()}, reaching ${sp.LEVEL_NAMES[e.level]?.toLowerCase() ?? e.level} level${e.titles.length ? ', with a title to show for it' : ''}.`, key: `past/${n.id}` });
  }
}

/**
 * Siblings and children, every year: some take up a sport, those who play move on or give up, and the notable things
 * are told to the player. Returns the relatives who took up a sport this year (the story of a new generation begins
 * from one of them: engine/sportsArcs.js).
 */
export function tickRelatives(state = store.state) {
  const S = sp.ensure(state);
  const p = state.player;
  const started = [];
  const mine = sp.myAthlete(state);
  for (const id of p.npcIds) {
    const n = state.npcs[id];
    if (!n?.alive || !['sibling', 'child', 'grandchild'].includes(n.role) || n.age < 6) continue;
    const r = seeded(`kin/${n.id}/${state.year}`);
    let a = S.athletes[n.id];
    const playing = a && Object.values(a.sports).find((e) => e.status === 'active');
    // Taking something up. Each person's own interest: a player in the family makes it a little likelier, never certain.
    if (!playing && n.age <= 16 && !(a && Object.values(a.sports).length >= 2)) {
      const nearby = mine && sp.activeSports(p.id, state).length ? 0.04 : 0;
      if (r.chance(0.09 + nearby)) {
        const same = mine?.primary && r.chance(0.25) ? sportOf(mine.primary) : null;
        const sport = same && same.minAge <= n.age && !same.adaptive ? same : sportsIn(state.year, p.countryId, r);
        if (sport && sport.minAge <= n.age) {
          a = lightRecord(state, n);
          const e = lightEntry(a, sport.id, state.year);
          e.talent = Math.round(clamp(r.normal(55, 15), 15, 95)); // their own, not the player's
          a.primary ??= sport.id;
          started.push({ npc: n, sportId: sport.id });
          sp.moment(state, { personId: n.id, name: fullName(n), gen: a.gen, age: n.age, type: 'start', sportId: sport.id, sig: 1, text: `Took up ${sport.name.toLowerCase()}.` });
          if (n.role === 'child' || n.role === 'sibling') sp.say(state, `Your ${n.role === 'child' ? (n.gender === 'female' ? 'daughter' : n.gender === 'male' ? 'son' : 'child') : (n.gender === 'female' ? 'sister' : n.gender === 'male' ? 'brother' : 'sibling')} ${n.firstName} has taken up ${sport.name.toLowerCase()}${same ? ', the same as you' : ''}.`, 'neutral', { screen: 'athlete', id: n.id });
        }
      }
      continue;
    }
    if (!playing) continue;
    // A season of their own: how far they get depends on their own talent and luck.
    const e = playing;
    const sport = sportOf(e.id);
    e.seasonsPlayed += 1;
    e.peak = Math.round(clamp(Math.max(e.peak, (e.talent ?? 50) * Math.min(1, (n.age - 5) / 14) + r.normal(0, 4)), 0, 99));
    const want = e.peak >= 72 && n.age >= 16 ? 'academy' : e.peak >= 55 ? 'club' : n.age >= 12 && e.peak >= 45 ? 'school' : 'recreational';
    if (LEVEL_ORDER.indexOf(want) > LEVEL_ORDER.indexOf(e.level)) {
      e.level = want;
      sp.moment(state, { personId: n.id, name: fullName(n), gen: a.gen, age: n.age, type: 'level', sportId: e.id, sig: 1, text: `Moved up to ${sp.LEVEL_NAMES[want].toLowerCase()} ${sport.name.toLowerCase()}.` });
    }
    // A sibling in the same team sport, at the same level and age group, plays for a rival team in the player's league.
    rivalSibling(state, n, e);
    if (r.chance(0.08 + e.peak / 900)) {
      e.titles.push({ year: state.year, name: `a ${sport.name.toLowerCase()} title`, light: true });
      sp.moment(state, { personId: n.id, name: fullName(n), gen: a.gen, age: n.age, type: 'title', sportId: e.id, sig: 2, text: `Won a ${sport.name.toLowerCase()} title.` });
      if (n.meters.relationship >= 40) sp.say(state, `${n.firstName} won a ${sport.name.toLowerCase()} title this year.`, 'good', { screen: 'athlete', id: n.id });
    }
    // Most people stop, sooner or later. Many at eighteen.
    if (r.chance(n.age >= 18 ? 0.22 : 0.07)) {
      e.status = 'stopped'; e.stoppedYear = state.year;
      sp.moment(state, { personId: n.id, name: fullName(n), gen: a.gen, age: n.age, type: 'stop', sportId: e.id, sig: 1, text: `Stopped playing ${sport.name.toLowerCase()}.` });
    }
  }
  return started;
}

function rivalSibling(state, n, e) {
  if (n.role !== 'sibling') return;
  const mine = sp.entryOf(e.id, state.player.id, state);
  const team = sp.teamOf(mine?.teamId, state);
  const org = sp.orgOf(team?.orgId, state);
  const lg = sp.orgOf(org?.leagueId, state);
  if (!lg || sportOf(e.id).kind !== 'team' || Math.abs(n.age - state.player.age) > 3 || e.level !== mine.level) return;
  if (lg.teamIds.some((t) => sp.teamOf(t, state).roster.some((x) => x.npcId === n.id))) return;
  const rival = lg.teamIds.map((t) => sp.teamOf(t, state)).find((t) => t.id !== team.id);
  if (!rival) return;
  rival.roster.push({ id: `kin_${n.id}`, npcId: n.id, name: fullName(n), pos: null, rating: e.peak, since: state.year });
  e.teamId = rival.id; e.orgId = rival.orgId;
  sp.moment(state, { personId: n.id, name: fullName(n), gen: sp.athleteOf(n.id, state).gen, age: n.age, type: 'join', sportId: e.id, sig: 2, text: `Joined ${rival.name}, a rival of ${fullName(state.player)}'s team.`, people: [n.id], memory: `You ended up on rival teams in the same league: ${rival.name} against yours.` });
  sp.say(state, `${n.firstName} has joined ${rival.name}, in your league. Family dinners are going to be interesting.`, 'neutral', { screen: 'team', id: rival.id });
}

/**
 * Parents in the player's sporting life, once a year while the player is young: they come to games when they can, pay
 * for what children cannot, and worry aloud about the cost when the money is tight. None of it decides how good the
 * player is.
 */
export function parentsYear(state = store.state) {
  const p = state.player;
  if (p.age >= 18 || !sp.activeSports(p.id, state).length) return;
  const parents = p.npcIds.map((id) => state.npcs[id]).filter((n) => n?.alive && n.role === 'parent');
  const main = sp.entryOf(sp.myAthlete(state).primary, p.id, state) ?? sp.activeSports(p.id, state)[0];
  for (const n of parents) {
    const r = seeded(`parent/${n.id}/${state.year}`);
    const keen = n.meters.relationship >= 45 && r.chance(0.7);
    if (keen) n.meters.relationship = clamp(n.meters.relationship + 1);
    const w = n.wealth ?? n.meters.money;
    if (['academy'].includes(main.level) && w < 45 && r.chance(0.5)) sp.say(state, `${n.firstName} worries aloud about the academy fees, then pays them anyway.`, 'neutral', { screen: 'hub', id: 'money' });
  }
  const came = parents.filter((n) => n.meters.relationship >= 45);
  if (came.length && main.titles.some((t) => t.year === state.year)) for (const n of came) sp.moment(state, { type: 'family', sportId: main.id, sig: 2, text: `${n.firstName} was there to see the title won.`, people: [n.id], key: `familytitle/${n.id}/${state.year}`, memory: `They were there, cheering, when you won the title.` });
}

export const relativesOf = (state = store.state) => Object.values(sp.ensure(state).athletes).filter((a) => a.light);
void player;
