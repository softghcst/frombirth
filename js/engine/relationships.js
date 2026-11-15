// NPC aging, mortality, relationship decay, and the basic interactions.
// Phase 5 adds the full interaction set (gifts, arguments, romance, family).
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, livingNpcs, log } from '../state.js';
import { mortalityChance } from './death.js';

export function roleLabel(npc) {
  if (npc.role === 'parent') return npc.gender === 'male' ? 'Father' : 'Mother';
  if (npc.role === 'sibling') return npc.gender === 'male' ? 'Brother' : 'Sister';
  if (npc.role === 'child') return npc.gender === 'male' ? 'Son' : 'Daughter';
  if (npc.role === 'pet') return `Pet ${npc.species}`;
  return npc.role.charAt(0).toUpperCase() + npc.role.slice(1);
}

const DECAY = { parent: 1, sibling: 2, friend: 4, classmate: 5, coworker: 4, partner: 4,
  spouse: 3, child: 1, pet: 1, enemy: 0, ex: 0, boss: 2, cellmate: 3 };

export function tickRelationships() {
  const p = player();
  for (const npc of livingNpcs()) {
    npc.age += 1;

    // Mortality
    const dies = npc.role === 'pet'
      ? npc.age >= npc.lifespan || rng.chance(0.01)
      : rng.chance(mortalityChance(npc.age, npc.meters.health));
    if (dies) {
      npc.alive = false;
      const who = `${roleLabel(npc).toLowerCase()} ${npc.firstName}`;
      const close = npc.meters.relationship;
      log(`Your ${who} died at age ${npc.age}.`, 'system', 'bad');
      p.stats.mood = clamp(p.stats.mood - Math.round(8 + close / 5));
      continue;
    }
    if (npc.role !== 'pet' && npc.age > 60) {
      npc.meters.health = clamp(npc.meters.health - rng.int(0, 3));
    }

    // Decay: closeness fades unless you put time in. Children at home are spared.
    const neglected = npc.lastInteractionAge < p.age - 1;
    const atHome = p.flags.livesWithParents && (npc.role === 'parent' || npc.role === 'sibling' || npc.role === 'pet');
    if (neglected && !atHome) {
      npc.meters.relationship = clamp(npc.meters.relationship - (DECAY[npc.role] ?? 2));
    }
    if ((npc.role === 'friend' || npc.role === 'classmate') && npc.meters.relationship < 10) {
      log(`You and ${npc.firstName} drifted apart.`);
      p.npcIds = p.npcIds.filter((id) => id !== npc.id);
      delete store.state.npcs[npc.id];
    }
  }
}

export const INTERACTIONS = {
  spendTime: { label: 'Spend time', minAge: 3 },
  talk: { label: 'Have a conversation', minAge: 4 },
};

/** @returns {{ok:boolean, text:string}} */
export function interact(npcId, action) {
  const p = player();
  const npc = store.state.npcs[npcId];
  if (!npc?.alive) return { ok: false, text: 'They are gone.' };
  if (p.age < INTERACTIONS[action].minAge) return { ok: false, text: 'You are too young for that.' };
  npc.flags.acts ??= {};
  if (npc.flags.acts[action] === p.age) {
    return { ok: false, text: `You already did that with ${npc.firstName} this year.` };
  }
  npc.flags.acts[action] = p.age;
  npc.lastInteractionAge = p.age;

  let gain; let text;
  if (action === 'spendTime') {
    gain = rng.int(3, 9);
    text = npc.role === 'pet'
      ? `You spent the afternoon with ${npc.firstName}. Tail-level approval.`
      : `You spent time with ${npc.firstName}.`;
    p.stats.mood = clamp(p.stats.mood + rng.int(1, 4));
  } else {
    const rapport = (p.stats.charm + npc.meters.relationship) / 200;
    const went = rng.chance(0.35 + rapport * 0.6);
    gain = went ? rng.int(2, 7) : -rng.int(1, 5);
    text = went
      ? `You and ${npc.firstName} had a good talk.`
      : `Your conversation with ${npc.firstName} turned awkward.`;
  }
  npc.meters.relationship = clamp(npc.meters.relationship + gain);
  log(text, 'system', gain >= 0 ? 'good' : 'bad');
  return { ok: true, text };
}
