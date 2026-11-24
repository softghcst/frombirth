// Martial arts: courses of lessons in a style move the player up its ranks, and each new rank brings a named move.
// What they know is what they have when a fight comes: fightEdge is read by crimes done with bare hands and by the
// scrapes a day out can bring (engine/vehicles.js ride encounters).
//
//   p.martial = { [styleId]: { courses, rank, moves: [names] } }   p.flags.martialActs = { age, n }
import { familyPays } from './skills.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { player, country, log, milestone } from '../state.js';
import { STYLES, STYLE_BY_ID, MARTIAL_COURSE, COURSES_A_YEAR } from '../data/martial.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const mine = (p = player()) => (p.martial ??= {});
const acts = () => { const p = player(); if (p.flags.martialActs?.age !== p.age) p.flags.martialActs = { age: p.age, n: 0 }; return p.flags.martialActs; };
export const courseCost = (p = player()) => (familyPays(p) ? 0 : localMoney(MARTIAL_COURSE, country())); // a child's lessons are the family's to pay for, until 18

/** Every style, with where the player is in it. */
export function styles(p = player()) {
  return STYLES.map((s) => {
    const m = mine(p)[s.id];
    return { id: s.id, name: s.name, from: s.from, started: !!m, rank: m ? s.ranks[m.rank] : null, moves: m?.moves ?? [], black: m ? m.rank >= s.ranks.length - 1 : false,
      why: p.age < s.minAge ? `From age ${s.minAge}.` : '' };
  });
}

/** One course of lessons. Every few courses, a new rank and a new move. */
export function takeCourse(id) {
  const p = player();
  const s = STYLE_BY_ID[id];
  if (!s) return result(false, 'No such style.', 'neutral');
  if (p.age < s.minAge) return result(false, `${s.name} is from age ${s.minAge}.`, 'neutral');
  if (p.legal?.incarceration) return result(false, 'Not from a cell.', 'neutral');
  if (acts().n >= COURSES_A_YEAR) return result(false, `${COURSES_A_YEAR} courses a year is all you have time for.`, 'neutral');
  const cost = courseCost(p);
  if (cost && p.finance.cash < cost) return result(false, `A course costs ${fmtMoney(cost, country())}.`, 'neutral');
  if (cost) p.finance.cash -= cost;
  acts().n += 1;
  const m = (mine(p)[id] ??= { courses: 0, rank: 0, moves: [] });
  const first = m.courses === 0;
  m.courses += 1;
  p.stats.health = clamp(p.stats.health + 2);
  p.hidden.discipline = clamp(p.hidden.discipline + 1);
  p.skills ??= {};
  p.skills.martial_arts = Math.min(100, (p.skills.martial_arts ?? 0) + 3);
  const top = s.ranks.length - 1;
  const due = Math.min(top, Math.floor(m.courses / s.perRank));
  let text;
  if (first) {
    m.moves.push(s.moves[0]);
    text = `You started ${s.name.toLowerCase()} as a ${s.ranks[0].toLowerCase()}${/belt|Black|White|Yellow|Orange|Green|Blue|Purple|Brown/.test(s.ranks[0]) ? ' belt' : ''}, and learned your first move: the ${s.moves[0]}.`;
  } else if (due > m.rank) {
    m.rank = due;
    const move = s.moves[Math.min(s.moves.length - 1, m.moves.length)];
    if (!m.moves.includes(move)) m.moves.push(move);
    const belt = COLORS.has(s.ranks[m.rank]);
    text = `You earned a new ${belt ? 'belt' : 'rank'} in ${s.name.toLowerCase()}: ${s.ranks[m.rank]}${belt ? '' : ''}. New move: the ${move}.`;
    if (m.rank === top) { text += ' You are at the top of the style now.'; milestone(`Reached ${s.ranks[top].toLowerCase()}${belt ? ' belt' : ''} in ${s.name.toLowerCase()}.`, 'life'); }
  } else {
    text = `Another course of ${s.name.toLowerCase()}. You are getting sharper; the next ${COLORS.has(s.ranks[m.rank]) ? 'belt' : 'rank'} is close.`;
  }
  log(text, 'system', 'good');
  return { ...result(true, text), rank: s.ranks[m.rank], moves: [...m.moves] };
}
const COLORS = new Set(['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Black']);

/** The best move the player knows, for telling a fight: from the style they have gone furthest in. */
export function bestMove(p = player()) {
  let best = null;
  for (const [id, m] of Object.entries(mine(p))) if (m.moves.length && (!best || m.rank > best.rank || (m.rank === best.rank && m.courses > best.courses))) best = { ...m, id };
  return best ? best.moves[best.moves.length - 1] : null;
}

/** How much the player's training helps in a fight: 0 for none, up to about 0.3 for a black belt in more than one style. */
export function fightEdge(p = player()) {
  const ranks = Object.entries(mine(p)).reduce((s, [id, m]) => s + m.rank / Math.max(1, STYLE_BY_ID[id].ranks.length - 1), 0);
  const moves = Object.values(mine(p)).reduce((s, m) => s + m.moves.length, 0);
  return Math.min(0.32, ranks * 0.14 + moves * 0.01);
}
