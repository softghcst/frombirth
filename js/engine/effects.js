// The single place where consequences are applied. Events, activities, crimes
// and interactions all describe what happens as Effect[] and send it here.
import { clamp, localMoney, cap } from '../util.js';
import { store, player, country, milestone } from '../state.js';
import { makeNpc, makePet } from './npcFactory.js';
import { addCondition, cureCondition } from './health.js';
import { remember } from './conditions.js';
import { adjustPerformance, scaleSalary, fire, promote } from './career.js';
import { hitProperty } from './realEstate.js';
import { hitVehicle, giveVehicle } from './vehicles.js';
import { npcTransition } from './npcLives.js';
import { sellEverything } from './market.js';
import * as crown from './royalty.js';
import * as pol from './politics.js';
import * as courtLife from './court.js';

/**
 * @param {import('../types.js').Effect[]} effects
 * @param {{cast:Object<string,string>, death?:string, queue?:string[], note?:string}} ctx  cast maps token keys to NPC ids; note is added to the outcome text
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
        if (spec.tag) { npc.flags.tag = spec.tag; npc.flags.title = spec.title; }
        if (spec.memory) remember(npc, spec.memory[0], spec.memory[1]);
        if (e.target) ctx.cast[e.target] = npc.id;
        break;
      }
      case 'removeNpc': {
        const id = ctx.cast[e.target];
        p.npcIds = p.npcIds.filter((n) => n !== id);
        delete store.state.npcs[id];
        break;
      }
      case 'memory':
        remember(store.state.npcs[ctx.cast[e.target]], e.value.key, e.value.text);
        break;
      case 'tag': {
        const npc = store.state.npcs[ctx.cast[e.target]];
        if (npc) { npc.flags.tag = e.value.tag; if (e.value.title) npc.flags.title = e.value.title; }
        break;
      }
      case 'feud': {
        const a = store.state.npcs[ctx.cast[e.target]];
        const b = store.state.npcs[ctx.cast[e.value]];
        if (a && b) { a.flags.feudWith = e.delta ? b.id : null; b.flags.feudWith = e.delta ? a.id : null; }
        break;
      }
      case 'perf':
        adjustPerformance(e.delta);
        if (p.career.careerId) shown.push({ label: 'Performance', delta: e.delta });
        break;
      case 'pay': scaleSalary(e.delta); break;
      case 'fired': fire(e.value); break;
      case 'promoted': promote(); break;
      case 'npcSet': {
        const npc = store.state.npcs[ctx.cast[e.target]];
        if (npc) {
          if (e.value.role) npc.role = e.value.role;
          Object.assign(npc.flags, e.value.flags ?? {});
        }
        break;
      }
      case 'moveCity': {
        const others = c.cities.filter((x) => x !== p.city);
        p.city = others[Math.floor(Math.random() * others.length)] ?? p.city;
        break;
      }
      case 'property': hitProperty(e.target, e.value); break;
      case 'vehicle': hitVehicle(e.delta); break;
      case 'giveVehicle': giveVehicle(e.value); break;
      case 'npcTransition': npcTransition(store.state.npcs[ctx.cast[e.target]], e.value); break;
      case 'sellInvestments': sellEverything(); break;
      case 'image': {
        const before = p.royal?.image;
        crown.shiftImage(e.delta);
        if (p.royal && p.royal.image !== before) shown.push({ label: 'Public image', delta: p.royal.image - before });
        break;
      }
      case 'meetRoyal': {
        const npc = crown.eligibleRoyal();
        crown.startSeeing(npc);
        if (e.target) ctx.cast[e.target] = npc.id;
        break;
      }
      case 'honour': crown.honour(p.flags.honourRank ?? 'knight'); break;
      case 'rivalry': courtLife.shiftRivalry(e.delta); break;
      case 'rivalEnd': courtLife.endRivalry(e.value); break;
      case 'approval': {
        const before = p.politics?.approval;
        pol.shiftApproval(e.delta);
        if (p.politics && p.politics.approval !== before) shown.push({ label: 'Approval', delta: p.politics.approval - before });
        break;
      }
      case 'reelect': ctx.note = pol.reElection().text; break;
      case 'ousted': pol.removed(e.value); break;
      case 'resignOffice': pol.resign(); break;
      case 'prison': {
        const k = p.legal.incarceration;
        if (k) { k[e.target] = clamp(k[e.target] + e.delta); shown.push({ label: e.target === 'respect' ? 'Respect' : 'Conduct', delta: e.delta }); }
        break;
      }
      case 'queue':
        (ctx.queue ??= []).push(e.value);
        break;
      case 'partTimeScale':
        if (p.career.partTime) p.career.partTime.salary = Math.round(p.career.partTime.salary * e.delta);
        break;
      case 'condition': addCondition(e.value); break;
      case 'cure': cureCondition(e.value); break;
      case 'gpa':
        p.education.gpa = Math.round(clamp(p.education.gpa + e.delta, 0, 4) * 100) / 100;
        break;
      case 'legal':
        p.legal.heat = clamp(p.legal.heat + e.delta);
        break;
      case 'followers':
        p.social.followers = Math.max(0, Math.round(p.social.followers * (e.value ?? 1)) + (e.delta ?? 0));
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
