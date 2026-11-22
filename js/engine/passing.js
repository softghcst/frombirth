// When someone in the player's life dies: the illness they really had, when that is what they died of (the rest of the
// causes are engine/relationships.js), and the funeral: going, speaking, or staying away, and how the family takes it.
// The funeral itself is the scene 'close_death' (data/events/family.js); nothing here makes anyone die.
//   npc.flags.cause = 'a heart attack'     npc.flags.funeral = 'attended' | 'spoke' | 'skipped'
import { clamp } from '../util.js';
import { store, player } from '../state.js';

const npcOf = (id) => store.state.npcs[id];
const KIN = ['parent', 'sibling', 'spouse', 'partner', 'child', 'grandparent', 'grandchild', 'stepparent', 'stepchild'];

/** A serious illness they really had, and how a family says it ended their life. */
const BY_CONDITION = { cancer: 'cancer, after a long illness', heart_disease: 'a heart attack', hypertension: 'a stroke', type2_diabetes: 'complications of diabetes', cystic_fibrosis: 'complications of cystic fibrosis', huntingtons: 'Huntington\'s disease' };

/** What they died of when it was an illness they lived with (engine/relationships.js names everything else), or ''. */
export function illnessCause(n) {
  const conds = (n.health?.conds ?? []).filter((c) => c.age <= n.age && BY_CONDITION[c.id]);
  return conds.length ? BY_CONDITION[conds[conds.length - 1].id] : '';
}

/** The family of the one who died who are also in the player's life, alive. */
function mourners(n) {
  const p = player();
  return p.npcIds.map(npcOf).filter((x) => x?.alive && x.id !== n.id && KIN.includes(x.role));
}

/**
 * Going to the funeral (true, or 'speak'), or not (false): how the rest of the family takes it. The scene itself says
 * what it felt like (mood, and so on); this is the family. Once for each death.
 */
export function funeral(npcId, attend) {
  const n = npcOf(npcId);
  if (!n || n.alive || n.flags.funeral) return false;
  n.flags.funeral = attend === 'speak' ? 'spoke' : attend ? 'attended' : 'skipped';
  if (attend) { for (const m of mourners(n)) m.meters.relationship = clamp(m.meters.relationship + (attend === 'speak' ? 4 : 2)); return true; }
  // Family notice who was not there.
  if (KIN.includes(n.role)) for (const m of mourners(n)) m.meters.relationship = clamp(m.meters.relationship - 4);
  return true;
}
