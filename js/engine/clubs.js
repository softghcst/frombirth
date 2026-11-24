// Clubs and classes (data/clubs.js): joined once and kept, year after year, until left, lapsed, grown out of, or left
// behind in a move. Each year a membership costs its dues (a child's are paid at home), adds a little to what it is
// about (a stat, a skill), and may bring a new friend. A member can stand for the committee, and later to run it.
//
//   p.clubs = { now: { [id]: { id, since, years, rank (0 member, 1 committee, 2 the top), countryId, friends: [npcId],
//                              stood: year } }, past: [{ id, from, to, rank, why }] }
import { familyPays } from './skills.js';
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { remember } from './conditions.js';
import { may } from './rules.js';
import { CLUBS, CLUB_BY_ID, CLUB_KINDS, MAX_CLUBS, CLUB_RANKS, clubTitle } from '../data/clubs.js';
import { SKILL_BY_ID, SKILLS } from '../data/skills.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
export const clubsOf = (p = player()) => (p.clubs ??= { now: {}, past: [] });
/** "A chess club" → "the chess club". */
const the = (c) => c.name.replace(/^(A|An|The) /, 'the ');
/** What a membership's rank is called. */
export const rankName = (c, rank) => (rank >= 2 ? c.top : CLUB_RANKS[rank]);
/** Dues a year, in local money: nothing for a child, whose family pays until 18. */
export const duesOf = (c, p = player()) => (familyPays(p) ? 0 : localMoney(c.dues, country()));

/** Why the player cannot join this club now, or ''. */
export function whyNot(c, p = player()) {
  const mine = clubsOf(p).now;
  if (p.legal.incarceration) return 'Not from prison.';
  if (mine[c.id]) return 'You are a member.';
  if (p.age < c.minAge) return `From age ${c.minAge}`;
  if (c.maxAge && p.age > c.maxAge) return `Up to age ${c.maxAge}`;
  if (c.needs === 'drink' && !may('drink').ok) return 'Only for those old enough to drink.';
  if (c.needs === 'kids' && !p.npcIds.some((id) => { const n = store.state.npcs[id]; return n?.alive && n.role === 'child' && n.age < 12; })) return 'For parents of young children.';
  if (c.needs === 'instrument' && !SKILLS.some((s) => s.group === 'instrument' && (p.skills?.[s.id] ?? 0) >= 40)) return 'You need to play an instrument fairly well (practice one in Skills).';
  if (Object.keys(mine).length >= MAX_CLUBS) return `${MAX_CLUBS} is as many as anyone has time for. Leave one first.`;
  const dues = duesOf(c, p);
  if (dues && p.finance.cash < dues) return `The first year's dues are ${fmtMoney(dues, country())}.`;
  return '';
}

/** Clubs that exist in this year, grouped, each with whether the player can join. */
export function clubOptions(p = player()) {
  const y = store.state.year;
  return CLUB_KINDS.map((k) => ({ ...k, clubs: CLUBS.filter((c) => c.kind === k.id && y >= c.from && !(c.maxAge && p.age > c.maxAge + 10))
    .map((c) => ({ club: c, dues: duesOf(c, p), why: whyNot(c, p) })) })).filter((k) => k.clubs.length);
}

/** The player's memberships now, for showing. */
export function memberships(p = player()) {
  return Object.values(clubsOf(p).now).map((m) => ({ ...m, club: CLUB_BY_ID[m.id], rankName: rankName(CLUB_BY_ID[m.id], m.rank) })).filter((m) => m.club);
}

export function join(id) {
  const p = player();
  const c = CLUB_BY_ID[id];
  if (!c || store.state.year < c.from) return result(false, 'There is no such club here.', 'neutral');
  const why = whyNot(c, p);
  if (why) return result(false, why, 'neutral');
  const dues = duesOf(c, p);
  p.finance.cash -= dues;
  clubsOf(p).now[id] = { id, since: store.state.year, years: 0, rank: 0, countryId: p.countryId, friends: [], paid: store.state.year };
  const text = `You joined ${the(c)}.${dues ? ` The first year's dues: ${fmtMoney(dues, country())}.` : ''} ${c.blurb}`;
  log(text, 'system', 'good');
  return result(true, text);
}

function end(p, m, why, text, tone = 'neutral') {
  const c = CLUB_BY_ID[m.id];
  delete clubsOf(p).now[m.id];
  clubsOf(p).past.push({ id: m.id, from: m.since, to: store.state.year, rank: m.rank, why });
  if (text) log(text, 'system', tone);
  return c;
}

export function leave(id) {
  const p = player();
  const m = clubsOf(p).now[id];
  if (!m) return result(false, 'You are not a member.', 'neutral');
  const c = end(p, m, 'left');
  const text = `You left ${the(c)}${m.years ? ` after ${m.years} ${m.years === 1 ? 'year' : 'years'}` : ''}.${m.rank ? ` Someone else is ${rankName(c, m.rank).toLowerCase()} now.` : ''}`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/** What the player could stand for next in this club, and whether they may yet. */
export function nextRank(id, p = player()) {
  const m = clubsOf(p).now[id];
  const c = CLUB_BY_ID[id];
  if (!m || m.rank >= 2) return null;
  const want = m.rank + 1;
  const needYears = want === 1 ? 1 : 3;
  const why = m.years < needYears ? `After ${needYears} ${needYears === 1 ? 'year' : 'years'} as a member.` : m.stood === store.state.year ? 'There is one vote a year.' : p.age < 14 ? 'When you are older.' : '';
  return { rank: want, name: rankName(c, want), why };
}

/** Stands for the committee, or to run the club. Once a year; charm and loyalty count. */
export function standFor(id) {
  const p = player();
  const m = clubsOf(p).now[id];
  const c = CLUB_BY_ID[id];
  const next = nextRank(id, p);
  if (!m || !next) return result(false, 'There is nothing higher to stand for.', 'neutral');
  if (next.why) return result(false, next.why, 'neutral');
  m.stood = store.state.year;
  const chance = clamp(0.3 + (p.stats.charm - 50) / 90 + m.years * 0.05 - (next.rank === 2 ? 0.1 : 0), 0.1, 0.92);
  if (!rng.chance(chance)) {
    const text = `You stood for ${next.rank === 2 ? next.name.toLowerCase() : 'the committee'} of ${the(c)}. The vote went another way this year.`;
    log(text, 'system', 'neutral');
    return result(false, text, 'neutral');
  }
  m.rank = next.rank;
  p.stats.charm = clamp(p.stats.charm + 1);
  p.stats.mood = clamp(p.stats.mood + 3);
  const text = next.rank === 2 ? `The members voted for you: you are ${c.top.toLowerCase()} of ${the(c)}.` : `You were voted onto the committee of ${the(c)}.`;
  if (next.rank === 2) milestone(`${c.top} of ${the(c)}.`, 'life');
  log(text, 'system', 'good');
  return result(true, text);
}

/** A year's nudge to a stat or talent: less as it gets high. */
function grow(p, path, n) {
  const [a, b] = path.split('.');
  const obj = p[a];
  if (!obj || obj[b] == null) return;
  const room = (100 - obj[b]) / 50;
  const add = n * Math.min(1, room);
  obj[b] = clamp(obj[b] + (add >= 1 ? Math.round(add) : rng.chance(add) ? 1 : 0));
}

/** A year of practice at the club's skill: a session's worth, a little less. */
function practiceAt(p, id) {
  const s = SKILL_BY_ID[id];
  if (!s || p.age < s.minAge) return;
  const before = s.talent ? p.talents[s.talent] ?? 0 : p.skills?.[id] ?? 0;
  if (before >= 100) return;
  const gain = Math.max(1, Math.round(rng.int(2, 4) * (1 - before / 135)));
  if (s.talent) { p.talents[s.talent] = clamp(before + gain); p.flags.practiced = [...new Set([...(p.flags.practiced ?? []), id])]; }
  else { p.skills ??= {}; p.skills[id] = Math.min(100, before + gain); }
}

/** The year in every club: dues, what it adds, the people, and memberships that end. */
export function tickClubs() {
  const p = player();
  if (!p?.alive) return;
  const C = clubsOf(p);
  for (const m of Object.values(C.now)) {
    const c = CLUB_BY_ID[m.id];
    if (!c) { delete C.now[m.id]; continue; }
    if (p.legal.incarceration) { end(p, m, 'prison', `Your membership of ${the(c)} lapsed while you were inside.`); continue; }
    if (m.countryId !== p.countryId) { end(p, m, 'moved', `You left ${the(c)} behind when you moved.`); continue; }
    if (c.maxAge && p.age > c.maxAge) { end(p, m, 'grew', `You grew out of ${the(c)}. ${m.years} years of it.`); continue; }
    // Dues for the year to come (the first year's were paid on joining).
    if (m.paid !== store.state.year) {
      const dues = duesOf(c, p);
      if (dues && p.finance.cash < dues) { end(p, m, 'dues', `You could not keep up the dues, and your membership of ${the(c)} lapsed.`); continue; }
      p.finance.cash -= dues;
      m.paid = store.state.year;
    }
    m.years += 1;
    for (const [path, n] of Object.entries(c.grows)) grow(p, path, n + (m.rank >= 1 && path === 'stats.charm' ? 1 : 0));
    if (c.skill) practiceAt(p, c.skill);
    let line = c.year;
    if (m.friends.length < 3 && rng.chance(c.friend)) {
      const age = p.age < 18 ? clamp(p.age + rng.int(-2, 2), Math.max(6, c.minAge), 17) : Math.max(c.minAge, 18, p.age + rng.int(-10, 12));
      const pal = makeNpc({ role: 'friend', countryId: p.countryId, age, relationship: rng.int(45, 65) });
      store.state.npcs[pal.id] = pal;
      p.npcIds.push(pal.id);
      pal.lastInteractionAge = p.age;
      remember(pal, `club_${c.id}`, `You met at ${the(c)}.`);
      m.friends.push(pal.id);
      line += ` You and ${pal.firstName} have become friends.`;
    }
    log(`${clubTitle(c)}: ${line}`, 'system', 'good');
  }
}
