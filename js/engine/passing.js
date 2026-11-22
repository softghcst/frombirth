// When someone in the player's life dies: what they died of (told in the notice, and kept), and the funeral, which the
// player may go to or miss. A cause comes from the illness they really had where there was one, and otherwise from what
// is common at their age and in their times; nothing here makes anyone die.
//   npc.flags.diedOf = 'He had a sudden heart attack.'     npc.flags.funeral = 'attended' | 'skipped'
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, log } from '../state.js';

const npcOf = (id) => store.state.npcs[id];
const KIN = ['parent', 'sibling', 'spouse', 'partner', 'child', 'grandparent', 'grandchild', 'stepparent', 'stepchild'];
const he = (n) => (n.gender === 'male' ? 'He' : n.gender === 'female' ? 'She' : 'They');
const his = (n) => (n.gender === 'male' ? 'his' : n.gender === 'female' ? 'her' : 'their');

/** What is common at each age (and, before 1950, what was common then). */
const BY_AGE = {
  young: ['died in a car accident', 'drowned while swimming at the lake', 'was killed in a fall while hiking', 'died in a motorcycle crash', 'died of a sudden aneurysm', 'had a severe allergic reaction'],
  middle: ['had a sudden heart attack', 'died of a stroke', 'lost a long fight with cancer', 'died in a car accident', 'died of an aneurysm', 'died of complications after surgery'],
  old: ['died peacefully in {his} sleep', 'died of heart failure', 'died of a stroke', 'died of pneumonia', 'lost a long fight with cancer', 'died of complications of old age', 'died after a fall at home'],
  past: ['died of tuberculosis', 'died of influenza', 'died of a fever that went through the town'],
};
/** A serious illness they really had, and how it ends a life. */
const BY_CONDITION = { cancer: 'lost a long fight with cancer', heart_disease: 'had a sudden heart attack', hypertension: 'died of a stroke', type2_diabetes: 'died of complications of diabetes', cystic_fibrosis: 'died of complications of cystic fibrosis', huntingtons: 'died of complications of Huntington\'s disease' };

/** A sentence: "He had a sudden heart attack." Taken from their real illness where they had a serious one. */
export function causeOfDeath(n) {
  const conds = (n.health?.conds ?? n.flags?.health?.conds ?? []).filter((c) => c.age <= n.age && BY_CONDITION[c.id]);
  let what;
  if (conds.length && rng.chance(0.75)) what = BY_CONDITION[rng.pick(conds).id];
  else {
    const pool = n.age < 30 ? BY_AGE.young : n.age < 65 ? BY_AGE.middle : BY_AGE.old;
    what = rng.pick(store.state.year < 1950 && rng.chance(0.4) ? BY_AGE.past : pool);
  }
  return `${he(n)} ${what.replace('{his}', his(n))}.`;
}

/** Records the cause at the moment of death (engine/relationships.js), so the notice and the record agree. */
export function noteDeath(n) { n.flags.diedOf ??= causeOfDeath(n); return n.flags.diedOf; }

/** The family of the one who died who are also in the player's life, alive. */
function mourners(n) {
  const p = player();
  return p.npcIds.map(npcOf).filter((x) => x?.alive && x.id !== n.id && KIN.includes(x.role));
}

/** Going to the funeral, or not. Once for each death. */
export function funeral(npcId, attend) {
  const p = player();
  const n = npcOf(npcId);
  if (!n || n.alive || n.flags.funeral) return { ok: false, text: '', tone: 'neutral' };
  n.flags.funeral = attend ? 'attended' : 'skipped';
  const close = KIN.includes(n.role) || n.meters.relationship >= 60;
  if (attend) {
    p.stats.mood = clamp(p.stats.mood + 3);
    for (const m of mourners(n)) m.meters.relationship = clamp(m.meters.relationship + 2);
    const text = `You went to ${n.firstName}'s funeral, and said goodbye properly.${close ? ' It helped, a little, to be with everyone who loved them.' : ''}`;
    log(text, 'system', 'neutral');
    return { ok: true, text, tone: 'neutral' };
  }
  p.stats.mood = clamp(p.stats.mood - 2);
  // Family notice who was not there.
  if (KIN.includes(n.role)) for (const m of mourners(n)) m.meters.relationship = clamp(m.meters.relationship - 4);
  const text = `You did not go to ${n.firstName}'s funeral.${KIN.includes(n.role) ? ' The family noticed.' : ''}`;
  log(text, 'system', 'neutral');
  return { ok: true, text, tone: 'neutral' };
}
