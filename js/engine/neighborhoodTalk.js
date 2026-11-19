// What people in a neighborhood know about the player, and how they came to know it (engine/neighborhood.js).
//
// A fact is something that really happened and was seen or heard: the player helped someone, hosted a gathering,
// made a formal complaint, someone moved in with them. Each fact records who knows it and how: they were there
// ('saw'), someone in their household told them ('told'), or it went round the street ('heard'). Facts spread a
// little each year in close-knit places, and fade. Second-hand news can come out wrong: someone moving out of the
// player's place can turn, by the third telling, into a split that never happened. The player can set it straight.
//
// Never known: health, private relationships, anything nobody could have seen. A neighbor's impression of the
// player is the sum of what they really know (and what they wrongly believe), so reputation belongs to people, not to
// the street: the family next door can think well of the player while the far end of the street has never heard of
// them.
import { store } from '../state.js';
import { clamp } from '../util.js';
import { archiveIdOf } from './chronicle.js';
import * as N from './neighborhood.js';

/** Each kind of fact: how it reflects on the player (valence), and how it reads. */
export const FACTS = {
  moved_in: { v: 0, text: 'moved in {at}' },
  helped: { v: 2, text: 'helped {who}' },
  hosted: { v: 1, text: 'hosted a {what}' },
  joined: { v: 1, text: 'joined in at the {what}' },
  ran: { v: 2, text: 'helped run the {what}' },
  project: { v: 2, text: 'helped {what}' },
  complaint: { v: -2, text: 'made a formal complaint about {who}' },
  partner: { v: 0, text: 'has someone new living with them' },
  baby: { v: 0, text: 'has a new baby at home' },
  left: { v: 0, text: 'had someone move out of their place' },
  regular: { v: 1, text: 'is a regular at {what}' },
  job: { v: 0, text: 'works at {what}' },
  split_rumor: { v: -1, text: 'has split up with someone', rumor: true },
};
const HOW = { saw: 1, told: 0.75, heard: 0.5 };

const facts = (state) => (N.hoods(state).facts ??= []);
const me = (state) => archiveIdOf(state.player);

/**
 * Something about the player that these people now know, having seen it. `knowers` are resident ids; anyone else in
 * their households hears it from them. @returns the fact
 */
export function hear(state, hoodId, kind, knowers, words = {}, t = N.nowT(state)) {
  const H = N.hoods(state);
  if (!FACTS[kind] || !hoodId) return null;
  const list = facts(state);
  const by = {};
  for (const id of knowers) if (H.res[id] && N.aliveRes(H.res[id])) by[id] = 'saw';
  if (!Object.keys(by).length) return null;
  H.nf = (H.nf ?? 0) + 1;
  const f = { id: `f${H.nf}`, h: hoodId, about: me(state), k: kind, t, w: words, by, truth: !FACTS[kind].rumor };
  for (const id of Object.keys(by)) for (const m of householdOf(state, id)) f.by[m] ??= 'told';
  list.push(f);
  if (list.length > 400) list.splice(0, list.length - 400);
  return f;
}
function householdOf(state, resId) {
  const H = N.hoods(state);
  const hh = H.hhs[H.res[resId]?.hh];
  return hh?.home ? hh.m.filter((x) => x !== resId && H.res[x] && N.aliveRes(H.res[x]) && N.ageOf(H.res[x], state) >= 8) : [];
}
/** The members of the households living close to a home (who can see what happens there). */
export function watchers(state, homeId, near = 4) {
  return N.around(state, homeId).filter((x) => x.hh && !x.hh.me && !x.hh.fam && x.prox.near >= near).flatMap((x) => x.hh.m).filter((id) => N.hoods(state).res[id]);
}

/** How a fact reads, for the player. */
export const factText = (f) => FACTS[f.k].text.replace(/\{(\w+)\}/g, (_, k) => f.w?.[k] ?? 'someone');

/**
 * A year of talk in one neighborhood: each person who knows something may mention it to someone on their street, more
 * often where neighbors talk more. Second-hand news of someone moving out can become a rumor of a split. Old news fades.
 * From the world and the date only: never from the game's dice.
 */
export function spread(state, hood, y) {
  const H = N.hoods(state);
  const list = facts(state).filter((f) => f.h === hood.id && !f.corrected);
  const r = N.luck(state, `talk/${hood.id}/${y}`);
  const talk = hood.g.cohesion / 300;
  for (const f of list) {
    if (y - N.yearOf(f.t) > 6) continue;
    for (const [id, how] of Object.entries(f.by)) {
      if (how === 'heard' || !r.chance(talk)) continue;
      const r0 = H.res[id];
      const home = H.hhs[r0?.hh]?.home;
      if (!home || r0.dead) continue;
      const ears = N.around(state, home).filter((x) => x.hh && !x.hh.me && !x.hh.fam && x.prox.near >= 3).flatMap((x) => x.hh.m).filter((m) => H.res[m] && !f.by[m] && N.aliveRes(H.res[m]));
      if (!ears.length) continue;
      const to = r.pick(ears);
      // By the third telling, someone moving out is a break-up. It was not.
      if (f.k === 'left' && !f.w?.partner && r.chance(0.3)) {
        const rumor = facts(state).find((x) => x.h === hood.id && x.k === 'split_rumor' && !x.corrected && x.t >= f.t);
        if (rumor) rumor.by[to] ??= 'heard';
        else { H.nf = (H.nf ?? 0) + 1; facts(state).push({ id: `f${H.nf}`, h: hood.id, about: f.about, k: 'split_rumor', t: N.T(y, 11), w: {}, by: { [to]: 'heard' }, truth: false, from: f.id }); }
      } else f.by[to] ??= 'heard';
    }
  }
  // Old news is forgotten, except what mattered.
  const keep = facts(state).filter((f) => f.h !== hood.id || y - N.yearOf(f.t) <= 12 || Math.abs(FACTS[f.k].v) >= 2);
  H.facts = keep;
}

/** What one person thinks of the player from what they know: helping and joining in count for, complaints against. */
export function impression(state, resId, who = me(state)) {
  let v = 0;
  const known = [];
  for (const f of facts(state)) {
    if (f.about !== who || f.corrected || !f.by[resId]) continue;
    v += FACTS[f.k].v * HOW[f.by[resId]];
    known.push(f);
  }
  return { v: Math.round(v * 10) / 10, known };
}

/** What a neighborhood knows about the player: each fact, how many know it, and whether it is true. */
export function knownAbout(state, hoodId) {
  return facts(state).filter((f) => f.h === hoodId && f.about === me(state) && !f.corrected).map((f) => ({
    id: f.id, text: factText(f), truth: f.truth, t: f.t, saw: Object.values(f.by).filter((x) => x === 'saw').length, heard: Object.values(f.by).filter((x) => x !== 'saw').length,
  })).sort((a, b) => b.t - a.t);
}

/** Sets a rumor straight with whoever asked: it is no longer believed by anyone who hears the truth from them. */
export function correct(state, factId, resId) {
  const f = facts(state).find((x) => x.id === factId);
  if (!f || f.truth) return false;
  f.corrected = true;
  return true;
}

/** A wrong story about the player that a neighbor they know has heard: the moment to set it straight. */
export function rumorToSettle(state, hoodId) {
  const H = N.hoods(state);
  for (const f of facts(state)) {
    if (f.h !== hoodId || f.truth || f.corrected || f.about !== me(state)) continue;
    const knowers = Object.keys(f.by).filter((id) => H.res[id] && N.aliveRes(H.res[id]));
    if (knowers.length < 1) continue;
    const friend = knowers.find((id) => state.player.npcIds.includes(id) && state.npcs[id]?.alive);
    return { f, person: friend ?? null, res: friend ? null : knowers[0], count: knowers.length };
  }
  return null;
}

/** People in a neighborhood who think well or badly of the player, from what they know. */
export function opinions(state, hoodId) {
  let good = 0; let bad = 0;
  for (const r of N.residentsOf(state, hoodId)) { const v = impression(state, r.id).v; if (v >= 1) good++; else if (v <= -1) bad++; }
  return { good, bad };
}

export { clamp, store };
