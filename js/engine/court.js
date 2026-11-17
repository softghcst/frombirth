// Life inside the royal family: rivalries that build over years, and the
// choices around a royal wedding. The family itself is in engine/dynasty.js.
//
// A rivalry is kept on the house: d.rivalry = { id, npcId, stage, heat, nextAt }
//   id     the rival's record in the house
//   stage  how far the story has gone (1 overlooked, 2 allies, 3 in public, then an ending)
//   heat   0–100: how bad it is. The player's choices move it; it decides the ending.
// Who becomes a rival depends on who they are (ambitious, not especially
// loyal), how close they stand to the player in the line, and how the two get on.
import { rng } from '../rng.js';
import { clamp, theCountry } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { makeNpc } from './npcFactory.js';
import * as dyn from './dynasty.js';
import { relationTo } from './succession.js';
import { cloneAppearance } from '../avatar/inherit.js';

const SCENES = { 1: 'rival_overlooked', 2: 'rival_allies', 3: 'rival_public' };

/**
 * Makes a member of the house someone in the player's life (People tab),
 * if they are not already. @returns {object} the NPC
 */
export function bringIntoLife(d, x, me) {
  const st = store.state;
  if (x.npcId && st.npcs[x.npcId]) return st.npcs[x.npcId];
  const c = country();
  const npc = makeNpc({ role: 'relative', countryId: c.id, gender: x.gender, firstName: x.name, lastName: `of ${theCountry(c.name)}`,
    age: dyn.ageOf(x), relationship: rng.int(35, 60), appearance: cloneAppearance(x.look) });
  const kin = me ? relationTo(d.people, me.id, x.id).replace(/^(eldest|second|third|fourth|fifth|sixth) /, '') : 'relative';
  npc.flags.title = kin === 'relative' ? 'Relative' : kin[0].toUpperCase() + kin.slice(1);
  npc.flags.houseId = x.id;
  x.npcId = npc.id;
  st.npcs[npc.id] = npc;
  st.player.npcIds.push(npc.id);
  return npc;
}

/** Who in the family might come to resent the player, most likely first. */
function candidates(d, me) {
  const line = dyn.lineOf(d);
  const mine = line.indexOf(me.id);
  const reigning = me.id === d.monarchId;
  return Object.values(d.people).filter((x) => x.died == null && x.blood && !x.out && !x.isPlayer && x.id !== d.monarchId
    && dyn.ageOf(x) >= 18 && x.t.ambition >= 58 && x.t.loyalty <= 62 && !(d.rivalsPast ?? []).includes(x.id)
    && dyn.closeness(d, me.id, x.id) <= 3 && dyn.generationsUp(d, x.id, me.id) === 0 && dyn.generationsUp(d, me.id, x.id) === 0)
    .filter((x) => {
      const theirs = line.indexOf(x.id);
      // They have to be near enough to mind: just behind the player, or pushed down by them.
      return reigning ? theirs >= 0 && theirs <= 4 : mine >= 0 && theirs >= 0 && Math.abs(theirs - mine) <= 3;
    })
    .filter((x) => { const npc = x.npcId ? store.state.npcs[x.npcId] : null; return !npc || (npc.alive && npc.meters.relationship < 72); });
}

export const rivalry = (d = dyn.house()) => d?.rivalry ?? null;
export const rival = (d = dyn.house()) => (d?.rivalry ? d.people[d.rivalry.id] : null);

/** Moves how bad the rivalry is. */
export function shiftRivalry(delta) {
  const d = dyn.house(player().royal?.countryId);
  if (d?.rivalry) d.rivalry.heat = Math.round(clamp(d.rivalry.heat + delta));
}

/**
 * Ends the rivalry. how: 'peace' (made up), 'cold' (never speak again),
 * 'removed' (the rival is put out of the succession), 'lost' (the rival won the argument).
 */
export function endRivalry(how) {
  const p = player();
  const d = dyn.house(p.royal?.countryId);
  const k = d?.rivalry;
  if (!k) return;
  const x = d.people[k.id];
  const npc = store.state.npcs[k.npcId];
  const name = x ? dyn.nameOf(d, x) : 'your rival';
  (d.rivalsPast ??= []).push(k.id);
  d.rivalry = null;
  if (how === 'peace') {
    if (npc) npc.meters.relationship = clamp(npc.meters.relationship + 30);
    if (x) x.t.loyalty = clamp(x.t.loyalty + 30);
    dyn.chronicle(d, `${name} and ${p.firstName} made their peace after years of quarreling.`, x ? [x.id] : []);
  } else if (how === 'removed') {
    if (npc) npc.meters.relationship = Math.min(npc.meters.relationship, 5);
    if (x) { x.out = 'removed'; x.outYear = store.state.year; }
    dyn.chronicle(d, `${name} was removed from the line of succession after challenging ${p.firstName} and losing.`, x ? [x.id] : []);
    milestone('Saw off a challenge from inside the family.', 'life');
  } else if (how === 'lost') {
    if (npc) npc.meters.relationship = Math.min(npc.meters.relationship, 10);
    dyn.chronicle(d, `${name} challenged ${p.firstName} in public, and came out of it the stronger.`, x ? [x.id] : []);
  } else {
    if (npc) npc.meters.relationship = Math.min(npc.meters.relationship, 12);
    dyn.chronicle(d, `${name} and ${p.firstName} stopped speaking.`, x ? [x.id] : []);
  }
}

/** Yearly: a rivalry may begin, and one under way moves on a step. Called for players born into the house. */
export function tickCourt(d) {
  const p = player();
  const me = dyn.playerPerson(d);
  if (!me || !me.blood || !p.royal || p.age < 17 || p.legal.incarceration) return;
  const year = store.state.year;
  const pend = store.state.pendingEvents;
  const k = d.rivalry;
  if (!k) {
    if ((d.rivalryRest ?? 0) > year || !rng.chance(0.14)) return;
    const pool = candidates(d, me);
    if (!pool.length) return;
    const x = rng.weighted(pool, (c) => Math.max(1, c.t.ambition - c.t.loyalty + 20));
    const npc = bringIntoLife(d, x, me);
    d.rivalry = { id: x.id, npcId: npc.id, stage: 0, heat: 35, nextAt: year };
    d.rivalryRest = year + 18;
  }
  const r = d.rivalry;
  const x = d.people[r.id];
  const npc = store.state.npcs[r.npcId];
  // Death, or leaving the family, ends it without a scene.
  if (!x || x.died != null || x.out || !npc?.alive) { (d.rivalsPast ??= []).push(r.id); d.rivalry = null; return; }
  // How the two get on day to day feeds it, a little.
  r.heat = Math.round(clamp(r.heat + (45 - npc.meters.relationship) / 12));
  if (year < r.nextAt) return;
  const cast = { rival: npc.id };
  if (r.stage < 3) {
    r.stage += 1;
    r.nextAt = year + rng.int(1, 2);
    pend.push({ id: SCENES[r.stage], cast });
    return;
  }
  // The ending depends on everything chosen so far.
  if (r.heat >= 62) pend.push({ id: p.royal.reigning ? 'rival_crisis_crown' : 'rival_crisis', cast });
  else if (r.heat <= 30) pend.push({ id: 'rival_peace', cast });
  else { endRivalry('cold'); log(`You and ${dyn.nameOf(d, x)} no longer speak, except through secretaries. It is quieter, at least.`, 'system', 'neutral'); }
}

// ---------- The wedding ----------

export const WEDDING = {
  scale: [
    { id: 'state', name: 'A full state wedding', sub: 'Carriages, a cathedral, two thousand guests. What the country expects.', image: 8, mood: 2, love: -2, standing: 2 },
    { id: 'modern', name: 'A smaller, modern ceremony', sub: 'Two hundred people you actually know.', image: 3, mood: 6, love: 4, standing: 0 },
    { id: 'private', name: 'A private chapel, family only', sub: 'What the two of you would choose. The public will feel shut out.', image: -6, mood: 9, love: 8, standing: -2 },
  ],
  media: [
    { id: 'live', name: 'Broadcast it live', sub: 'Every moment, to the whole world.', image: 5, mood: -3 },
    { id: 'photos', name: 'Official photographs only', sub: 'A handful of pictures, chosen by you.', image: 0, mood: 2 },
    { id: 'none', name: 'No cameras at all', sub: 'The newspapers will not forgive it quickly.', image: -5, mood: 5 },
  ],
  honeymoon: [
    { id: 'tour', name: 'A tour of the country', sub: 'Half honeymoon, half duty.', image: 5, mood: 1, love: 1 },
    { id: 'island', name: 'A private island', sub: 'Three weeks with nobody watching.', image: -2, mood: 8, love: 6 },
    { id: 'home', name: 'Stay at a family estate', sub: 'Quiet, and close to the in-laws.', image: 1, mood: 3, love: 2 },
  ],
};

/** Applies the choices made for a royal wedding. @returns {{ok:boolean, text:string, tone:string}} */
export function royalWedding(npcId, picks) {
  const p = player();
  const npc = store.state.npcs[npcId];
  const d = dyn.house(p.royal?.countryId);
  if (!p.royal || !npc || !d) return { ok: false, text: '', tone: 'neutral' };
  const chosen = ['scale', 'media', 'honeymoon'].map((k) => WEDDING[k].find((o) => o.id === picks[k]) ?? WEDDING[k][0]);
  let image = 0;
  for (const o of chosen) {
    image += o.image;
    p.stats.mood = clamp(p.stats.mood + (o.mood ?? 0));
    npc.meters.relationship = clamp(npc.meters.relationship + (o.love ?? 0));
    d.standing = clamp(d.standing + (o.standing ?? 0));
  }
  p.royal.image = Math.round(clamp(p.royal.image + image));
  const [scale, media, moon] = chosen;
  const how = image >= 10 ? 'The country takes you to its heart.' : image >= 3 ? 'The country approves.' : image >= -3 ? 'The country shrugs, and wishes you well.' : 'The country feels it was not invited, and says so.';
  const text = `${scale.name}, ${media.name.toLowerCase().replace(/^broadcast it live$/, 'broadcast live').replace(/^official photographs only$/, 'with official photographs only').replace(/^no cameras at all$/, 'with no cameras at all')}, and then ${moon.name.toLowerCase()}. ${how}`;
  // The house's history already has the marriage; add what kind of day it was.
  const entry = [...d.history].reverse().find((h) => h.year === store.state.year && h.ids.includes(npc.flags.houseId) && / married /.test(h.text));
  if (entry) entry.text = entry.text.replace(/\.$/, `: ${scale.name.toLowerCase()}.`);
  log(text, 'system', image >= 0 ? 'good' : 'neutral');
  return { ok: true, text, tone: image >= 0 ? 'good' : 'neutral' };
}
