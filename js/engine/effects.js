// The single place where consequences are applied. Events, activities, crimes
// and interactions all describe what happens as Effect[] and send it here.
import { clamp, localMoney, cap } from '../util.js';
import { store, player, country, milestone } from '../state.js';
import { makeNpc, makePet } from './npcFactory.js';
import { addCondition, cureCondition } from './health.js';

/**
 * @param {import('../types.js').Effect[]} effects
 * @param {{cast:Object<string,string>, death?:string}} ctx  cast maps token keys to NPC ids
 * @returns {{label:string, delta:number, money?:boolean}[]} visible changes for the UI
 */
export function applyEffects(effects, ctx = { cast: {} }) {
  const p = player();
  const c = country();
  const shown = [];

  for (const e of effects) {
    switch (e.type) {
      case 'stat': {
        const before = p.stats[e.target];
        p.stats[e.target] = clamp(before + e.delta);
        const d = p.stats[e.target] - before;
        if (d) shown.push({ label: cap(e.target), delta: d });
        break;
      }
      case 'hidden':
        p.hidden[e.target] = clamp(p.hidden[e.target] + e.delta);
        break;
      case 'talent':
        p.talents[e.target] = clamp(p.talents[e.target] + e.delta);
        break;
      case 'cash': {
        const amt = localMoney(e.delta, c);
        p.finance.cash += amt;
        if (amt > 0) p.finance.lifetimeEarned += amt;
        shown.push({ label: 'Cash', delta: amt, money: true });
        break;
      }
      case 'relationship': {
        const npc = store.state.npcs[ctx.cast[e.target]];
        if (npc?.alive) {
          npc.meters.relationship = clamp(npc.meters.relationship + e.delta);
          npc.lastInteractionAge = p.age;
          shown.push({ label: npc.firstName, delta: e.delta });
        }
        break;
      }
      case 'flag':
        p.flags[e.target] = e.value ?? true;
        break;
      case 'addNpc': {
        const spec = e.value;
        const npc = spec.role === 'pet'
          ? makePet(p.countryId, p.lastName)
          : makeNpc({ countryId: p.countryId, age: p.age + (spec.ageOffset ?? 0), ...spec });
        store.state.npcs[npc.id] = npc;
        p.npcIds.push(npc.id);
        npc.lastInteractionAge = p.age;
        if (e.target) ctx.cast[e.target] = npc.id;
        break;
      }
      case 'removeNpc': {
        const id = ctx.cast[e.target];
        p.npcIds = p.npcIds.filter((n) => n !== id);
        delete store.state.npcs[id];
        break;
      }
      case 'condition': addCondition(e.value); break;
      case 'cure': cureCondition(e.value); break;
      case 'gpa':
        p.education.gpa = Math.round(clamp(p.education.gpa + e.delta, 0, 4) * 100) / 100;
        break;
      case 'legal':
        p.legal.heat = clamp(p.legal.heat + e.delta);
        break;
      case 'followers':
        p.social.followers = Math.max(0, p.social.followers + e.delta);
        break;
      case 'counter':
        p.counters[e.target] = (p.counters[e.target] ?? 0) + (e.delta ?? 1);
        break;
      case 'milestone': milestone(e.value); break;
      case 'death': ctx.death = e.value; break;
      default: console.warn('Unknown effect', e);
    }
  }
  return shown;
}
