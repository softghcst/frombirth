// Cliques at school, and a few things a school day holds: the nurse, the school dance. Who a clique takes depends on
// what they care about (data/schools.js CLIQUES): how good you are at it, how popular you are, what puts them off,
// and which crowd you sit with now. Getting in can be asked for, earned by hanging around, or helped (or ruined)
// by what you say to the one who runs it.
//
//   p.education.clique           the clique the player is in, or null
//   p.education.standing         popularity at school, 0–100 (engine/schoollife.js)
//   p.education.cliqueWarm       { [id]: 0–40 }  how used to the player a clique has got
//   p.education.cliqueLeaders    { [id]: npcId } the classmate who runs it
//   p.education.dayActs          { age, cliques, nurse, dance }   this year's
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, npcsByRole, log, milestone } from '../state.js';
import { resolve } from './conditions.js';
import { CLIQUES, CLIQUE_BY_ID } from '../data/schools.js';
import { cureCondition } from './health.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const ed = () => player().education;
const day = () => { const e = ed(); if (e.dayActs?.age !== player().age) e.dayActs = { age: player().age, cliques: 0, nurse: false, dance: false }; return e.dayActs; };
const num = (path) => Math.max(...path.split('|').map((x) => Number(resolve(x)) || 0));
export const popularity = () => Math.round(ed().standing ?? 50);
const bump = (d) => { const e = ed(); e.standing = clamp((e.standing ?? 50) + d); };
const mates = () => npcsByRole('classmate').filter((n) => n.alive && n.flags.schoolId);
/** Cliques exist from middle school. */
export const inCliqueYears = () => { const e = ed(); return e.enrolled && ['middle', 'high'].includes(e.stage); };
/** Most things with cliques can be done twice a year. */
const CLIQUE_ACTS = 2;

/** The classmate who runs a clique: one who cares about what it cares about, kept once chosen. */
export function leaderOf(id) {
  const e = ed();
  e.cliqueLeaders ??= {};
  const c = CLIQUE_BY_ID[id];
  const known = store.state.npcs[e.cliqueLeaders[id]];
  if (known?.alive && known.role === 'classmate') return known;
  if (!c || id === 'loners') return null;
  const pool = mates().filter((n) => !Object.values(e.cliqueLeaders).includes(n.id));
  const n = pool.find((x) => x.flags.interest === c.interest) ?? pool[0] ?? null;
  if (n) e.cliqueLeaders[id] = n.id;
  return n;
}

/** How well the player fits a clique, 0–1, and what stands in the way. */
export function fitOf(id) {
  const c = CLIQUE_BY_ID[id];
  const e = ed();
  if (!c) return { fit: 0, why: '' };
  if (id === 'loners') return { fit: 1, why: '' };
  let fit = 0.55;
  const why = [];
  for (const [path, min] of Object.entries(c.needs)) {
    const v = num(path);
    fit += clamp((v - min) / 60, -0.5, 0.25);
    if (v < min) why.push('not enough in common');
  }
  if (c.pop) { const gap = popularity() - c.pop; fit += clamp(gap / 80, -0.45, 0.1); if (gap < -10) why.push('not popular enough'); }
  for (const [path, max] of Object.entries(c.shuns ?? {})) if (num(path) > max) { fit -= 0.3; why.push('they think you are not their type'); }
  if (e.clique && (c.rivals ?? []).includes(e.clique)) { fit -= 0.25; why.push(`you sit with the ${CLIQUE_BY_ID[e.clique].name.toLowerCase()}`); }
  fit += (e.cliqueWarm?.[id] ?? 0) / 100;
  return { fit: clamp(fit, 0.03, 0.95), why: [...new Set(why)][0] ?? '' };
}

/** The cliques, for the list: each with who it is for, how the player fits, and whether they are in it. */
export function cliqueList() {
  const e = ed();
  return CLIQUES.map((c) => {
    const f = fitOf(c.id);
    return { id: c.id, name: c.name, desc: c.desc, who: c.who, current: e.clique === c.id, fit: f.fit, why: f.why, leader: c.id === 'loners' ? null : leaderOf(c.id) };
  });
}

function join(c) {
  const e = ed();
  e.clique = c.id;
  if (c.id !== 'loners') bump(3);
  const n = leaderOf(c.id);
  if (n) n.meters.relationship = clamp(n.meters.relationship + 6);
  milestone(c.id === 'loners' ? 'Kept to yourself at school.' : `Joined the ${c.name.toLowerCase()} at school.`, 'education');
}

/**
 * Something done about a clique: 'ask' to join; 'hangout' and get used to each other; 'compliment' or 'insult' the
 * one who runs it; 'leave' the one you are in.
 */
export function cliqueAct(id, act) {
  const p = player();
  const e = ed();
  const c = CLIQUE_BY_ID[id];
  if (!c) return result(false, 'There is no such crowd.', 'neutral');
  if (!inCliqueYears()) return result(false, 'Cliques start in middle school.', 'neutral');
  if (act === 'leave') {
    if (e.clique !== id) return result(false, 'You are not one of them.', 'neutral');
    e.clique = null;
    const text = `You stopped sitting with the ${c.name.toLowerCase()}.`;
    log(text);
    return result(true, text, 'neutral');
  }
  if (e.clique === id) return result(false, 'You are already one of them.', 'neutral');
  if (day().cliques >= CLIQUE_ACTS) return result(false, 'That is enough of that for one year.', 'neutral');
  day().cliques += 1;
  const n = leaderOf(id);
  const who = n ? n.firstName : 'their leader';
  e.cliqueWarm ??= {};
  const warm = (d) => { e.cliqueWarm[id] = clamp((e.cliqueWarm[id] ?? 0) + d, 0, 40); };
  const { fit } = fitOf(id);
  let text; let ok = true;
  if (id === 'loners') { join(c); text = 'You put your headphones in and keep to yourself. Nobody minds.'; log(text); return result(true, text, 'neutral'); }
  if (act === 'ask') {
    if (rng.chance(fit)) { join(c); text = `You ask ${who} if you can sit with them. "Sure," they say, and move up. You are one of the ${c.name.toLowerCase()} now.`; }
    else { ok = false; bump(-2); p.stats.mood = clamp(p.stats.mood - 3); text = `You ask ${who} if you can join them. They look at each other. "Maybe not," ${who} says.`; }
  } else if (act === 'hangout') {
    warm(rng.int(12, 22));
    if (n) n.meters.relationship = clamp(n.meters.relationship + 4);
    if (fitOf(id).fit >= 0.8 && rng.chance(0.6)) { join(c); text = `You keep turning up where the ${c.name.toLowerCase()} are, and one day ${who} saves you a seat. You are one of them.`; }
    else text = `You spend more time around the ${c.name.toLowerCase()}. They are getting used to you.`;
  } else if (act === 'compliment') {
    if (n) n.meters.relationship = clamp(n.meters.relationship + 8);
    if (rng.chance(0.2)) { ok = false; warm(-5); text = `You compliment ${who}. It comes out a bit much, and they notice.`; }
    else { warm(8); text = `You tell ${who} something nice and mean it. They seem pleased.`; }
  } else if (act === 'insult') {
    const bold = rng.chance(clamp(0.3 + (popularity() - 50) / 100 + (p.stats.charm - 50) / 200, 0.1, 0.7));
    if (n) n.meters.relationship = clamp(n.meters.relationship - 20);
    if (bold) { bump(5); warm(-15); (e.cliqueWarm.rebels = clamp((e.cliqueWarm.rebels ?? 0) + 10, 0, 40)); text = `You say something cutting about ${who} in front of everyone. It gets a laugh. People notice you, though not the ${c.name.toLowerCase()}, kindly.`; }
    else { ok = false; bump(-6); warm(-20); p.stats.mood = clamp(p.stats.mood - 5); text = `You insult ${who}. It falls flat, and ${who} has the last word. It is all anyone talks about for a week.`; }
  } else return result(false, 'Not that.', 'neutral');
  log(text, 'system', ok ? 'good' : 'bad');
  return result(ok, text);
}

// ---------- A school day ----------

/** The school nurse: a minor complaint seen to, or a lie-down and a note home. Once a year. */
export function nurse() {
  const p = player();
  if (!ed().enrolled || p.age > 18) return result(false, 'You are not at school.', 'neutral');
  if (day().nurse) return result(false, 'You have already been to see the nurse this year.', 'neutral');
  day().nurse = true;
  const minor = (p.conditions ?? []).find((c) => ['flu', 'ear_infection', 'acne', 'cold'].includes(c.id ?? c));
  let text;
  if (minor) { cureCondition(minor.id ?? minor); p.stats.health = clamp(p.stats.health + 3); text = 'The nurse takes a look, gives you something for it, and sends a note home. You feel better within the week.'; }
  else if (p.stats.health < 50) { p.stats.health = clamp(p.stats.health + 4); text = 'The nurse checks you over, tells you to drink more water and get some sleep, and calls home.'; }
  else { p.stats.mood = clamp(p.stats.mood + 2); text = 'You lie down in the nurse\'s office for an hour. Nothing is wrong, and that is nice to hear.'; }
  log(text);
  return result(true, text, 'neutral');
}

/** The school dance: middle and high school, once a year. Who you dance with, if anyone, depends on charm and friends. */
export function schoolDance() {
  const p = player();
  if (!inCliqueYears()) return result(false, 'There are dances in middle and high school.', 'neutral');
  if (day().dance) return result(false, 'There is one dance a year.', 'neutral');
  day().dance = true;
  const pool = mates().filter((n) => Math.abs(n.age - p.age) <= 1);
  const partner = pool.length && rng.chance(clamp(0.3 + (p.stats.charm - 50) / 100 + (popularity() - 50) / 150, 0.1, 0.85)) ? rng.pick(pool) : null;
  let text;
  if (partner) {
    partner.meters.relationship = clamp(partner.meters.relationship + 8);
    bump(2); p.stats.mood = clamp(p.stats.mood + 6);
    text = `You dance with ${partner.firstName} ${partner.lastName} to a slow song nobody will admit they like. It is a good night.`;
  } else if (rng.chance(0.5)) {
    p.stats.mood = clamp(p.stats.mood + 3);
    text = 'You dance with your friends in a big circle all night. Nobody cares what it looks like.';
  } else {
    p.stats.mood = clamp(p.stats.mood - 2);
    text = 'You spend most of the dance by the snack table. The music was good, at least.';
  }
  log(text, 'system', partner ? 'good' : 'neutral');
  return result(true, text, partner ? 'good' : 'neutral');
}
