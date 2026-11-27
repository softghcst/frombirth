// The single place where consequences are applied. Events, activities, crimes
// and interactions all describe what happens as Effect[] and send it here.
import { unload } from './worklife.js';
import { funeral } from './passing.js';
import { militaryChoice } from './military.js';
import { lawChoice } from './lawPractice.js';
import { rng } from '../rng.js';
import { forgetNpc } from './digital/core.js';
import { decide as campusChoice } from './campus.js';
import { feelingChoice } from './identity.js';
import { ailmentChoice } from './health/ailments.js';
import { workChoice } from './workEvents.js';
import { decide as parentChoice } from './kidschool.js';
import { decide as royalEdChoice } from './royaled.js';
import { decide as schoolChoice } from './schoollife.js';
import { decide as abroadChoice } from './diplomacy.js';
import { decide as abroadArcChoice } from './abroadArcs.js';
import { decide as kinChoice } from './kin.js';
import { decide as scandalChoice } from './scandal.js';
import { justiceScene } from './justiceScenes.js';
import { resignLeadership, faceTheParty, standForVacancy } from './leadership.js';
import { defend } from './campaign.js';
import { decide } from './government.js';
import { decide as digitalChoice } from './digital/stories.js';
import { decide as eraChoice } from './eraScenes.js';
import { togetherChoice } from './together.js';
import { invChoice } from './investigations/drama.js';
import { clamp, localMoney, cap } from '../util.js';
import { store, player, country, milestone } from '../state.js';
import { makeNpc, makePet } from './npcFactory.js';
import { addCondition, cureCondition } from './health/ailments.js';
import { healthEffect } from './health/story.js';
import { sceneChoice as reproChoice } from './health/contraception.js';
import { remember, parentsPay, parentsSpend } from './conditions.js';
import { adjustPerformance, scaleSalary, fire, promote } from './career.js';
import { hitProperty } from './realEstate.js';
import { hitVehicle, giveVehicle } from './vehicles.js';
import { npcTransition } from './npcLives.js';
import { sellEverything } from './market.js';
import * as crown from './royalty.js';
import * as pol from './politics.js';
import * as courtLife from './court.js';
import * as fame from './reputation.js';
import * as throne from './reign.js';
import { moneyEffect } from './moneyEffects.js';
import { sceneChoice as momentChoice } from './moments.js';
import { bondChoice } from './bonds.js';
import { estateChoice } from './estateReview.js';
import { loveChoice } from './loveStories.js';
import { register as registerAnimal, recordHealth } from './animals.js';
import { sceneChoice as animalChoice } from './animalCare.js';
import { lifeChoice } from './animalLife.js';
import { arcChoice } from './animalArcs.js';
import { sportArcChoice } from './sportsArcs.js';
import { disasterChoice } from './disasters.js';
import { hoodChoice } from './neighborhoodLife.js';
import { medicineChoice } from './medicine/drama.js';
import { musicChoice } from './music.js';
import { journalismChoice } from './journalism.js';

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
        // A young child at home does not pay for the family's choices: the parents do.
        if (amt < 0 && parentsPay(p)) { parentsSpend(-amt, p); shown.push({ label: 'Paid by your parents', delta: amt, money: true, family: true }); break; }
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
          ? makePet(p.countryId, p.lastName, undefined, spec.species)
          : makeNpc({ countryId: p.countryId, age: p.age + (spec.ageOffset ?? 0),
            ...(spec.attracted ? { gender: p.flags.interestedIn === 'men' ? 'male' : p.flags.interestedIn === 'women' ? 'female' : undefined } : {}), ...spec });
        store.state.npcs[npc.id] = npc;
        p.npcIds.push(npc.id);
        npc.lastInteractionAge = p.age;
        if (spec.tag) { npc.flags.tag = spec.tag; npc.flags.title = spec.title; }
        if (spec.memory) remember(npc, spec.memory[0], spec.memory[1]);
        // An animal taken in goes on the family's record; the line that tells it is written when the scene ends.
        if (spec.role === 'pet') registerAnimal(npc, { origin: 'found', pending: true });
        if (e.target) ctx.cast[e.target] = npc.id;
        break;
      }
      case 'removeNpc': {
        const id = ctx.cast[e.target];
        forgetNpc(id);
        break;
      }
      case 'animalHealth': recordHealth(ctx.cast[e.target], e.value); break;
      case 'animal': ctx.note = animalChoice(e.value, ctx.cast); break;
      case 'animalLife': ctx.note = lifeChoice(e.value, ctx.cast); break;
      case 'animalArc': ctx.note = arcChoice(e.value, ctx.cast); break;
      case 'sportArc': ctx.note = sportArcChoice(e.value, ctx.cast); break;
      case 'disaster': ctx.note = disasterChoice(e.value, ctx.cast); break;
      case 'hood': { const line = hoodChoice(e.value, ctx.cast); if (line) ctx.note = line; break; }
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
        p.city = others.length ? rng.pick(others) : p.city; // the game's own dice, so a reload replays it
        break;
      }
      case 'property': hitProperty(e.target, e.value); break;
      case 'vehicle': hitVehicle(e.delta); break;
      case 'giveVehicle': giveVehicle(e.value); break;
      case 'npcTransition': npcTransition(store.state.npcs[ctx.cast[e.target]], e.value); break;
      case 'sellInvestments': sellEverything(); break;
      case 'image': {
        const before = p.royal?.image;
        crown.shiftImage(e.delta, ctx.why);
        if (p.royal && p.royal.image !== before) shown.push({ label: 'Public image', delta: p.royal.image - before });
        break;
      }
      case 'meetRoyal': {
        const npc = crown.eligibleRoyal();
        crown.startSeeing(npc);
        if (e.target) ctx.cast[e.target] = npc.id;
        break;
      }
      case 'honor': crown.honor(p.flags.honorRank ?? 'knight'); break;
      case 'family': { const d = fame.shift('family', e.delta, ctx.why); if (d) shown.push({ label: 'Family approval', delta: d }); break; }
      case 'press': { const d = fame.shift('press', e.delta, ctx.why); if (d) shown.push({ label: 'The press', delta: d }); break; }
      case 'story': fame.addStory(e.value.label, e.value.truth, e.value.heat); break;
      case 'coolStory': fame.coolStory(e.delta); break;
      case 'kinOut': crown.kinRenounces(store.state.npcs[ctx.cast[e.target]]); break;
      case 'support': throne.shiftSupport(e.delta); break;
      case 'vote': ctx.note = throne.referendum(e.delta); break;
      case 'exile': { const r = throne.goIntoExile(); ctx.note = r.ok ? '' : 'No country would have you just now. You stay, for the present.'; break; }
      case 'restore': throne.restore(); crown.dress(); break;
      case 'abdicate': if (p.royal?.reigning) crown.renounce(); break;
      case 'rivalry': courtLife.shiftRivalry(e.delta); break;
      case 'rivalEnd': courtLife.endRivalry(e.value); break;
      case 'approval': {
        const before = p.politics?.approval;
        pol.shiftApproval(e.delta);
        if (p.politics && p.politics.approval !== before) shown.push({ label: 'Approval', delta: p.politics.approval - before });
        break;
      }
      case 'reelect': ctx.note = (p.politics && pol.isDemocracy() && !p.politics.ruler ? defend() : pol.reElection()).text; break;
      case 'govt': ctx.note = decide(e.value, ctx.cast); break;
      case 'scandal': ctx.note = scandalChoice(e.value); break;
      case 'justice': ctx.note = justiceScene(e.value, ctx.cast); break;
      case 'kin': ctx.note = kinChoice(e.value, ctx.cast); break;
      case 'music': ctx.note = musicChoice(e.value, ctx.cast); break;
      case 'journalism': ctx.note = journalismChoice(e.value, ctx.cast); break;
      case 'medicine': { const said = medicineChoice(e.value, ctx.cast); if (said) ctx.note = ctx.note ? `${ctx.note} ${said}` : said; break; }
      case 'work': { const said = workChoice(e.value, ctx.cast); if (said) ctx.note = ctx.note ? `${ctx.note} ${said}` : said; break; }
      case 'school': ctx.note = schoolChoice(e.value, ctx.cast); break;
      case 'campus': ctx.note = campusChoice(e.value, ctx.cast); break;
      case 'genderFeeling': ctx.note = feelingChoice(e.value); break;
      case 'ailment': ctx.note = ailmentChoice(e.value, ctx.cast); break;
      case 'unload': ctx.note = unload(e.value); break;
      case 'parent': ctx.note = parentChoice(e.value, ctx.cast); break;
      case 'royalEd': ctx.note = royalEdChoice(e.value, ctx.cast); break;
      case 'abroad': ctx.note = abroadChoice(e.value, ctx.cast); break;
      case 'global': ctx.note = abroadArcChoice(e.value, ctx.cast); break;
      case 'leader': ctx.note = e.value === 'resign' ? resignLeadership().text : e.value === 'stand' ? standForVacancy() : faceTheParty(); break;
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
      case 'repro': { const n = reproChoice(e.value, ctx.cast); if (n) ctx.note = ctx.note ? `${ctx.note} ${n}` : n; break; }
      case 'health': { const n = healthEffect(e.value, ctx); if (n) ctx.note = ctx.note ? `${ctx.note} ${n}` : n; break; }
      case 'cure': cureCondition(e.value); break;
      case 'gpa':
        p.education.gpa = Math.round(clamp(p.education.gpa + e.delta, 0, 4) * 100) / 100;
        break;
      case 'legal':
        p.legal.heat = clamp(p.legal.heat + e.delta);
        break;
      case 'digital': ctx.note = digitalChoice(e.value, ctx.cast); break;
      case 'era': ctx.note = eraChoice(e.value, ctx.cast); break;
      case 'together': ctx.note = togetherChoice(e.value, ctx.cast); break;
      case 'inv': { const note = invChoice(e.value, ctx.cast); if (note) ctx.note = note; break; }
      case 'followers':
        p.social.followers = Math.max(0, Math.round(p.social.followers * (e.value ?? 1)) + (e.delta ?? 0));
        break;
      case 'counter':
        p.counters[e.target] = (p.counters[e.target] ?? 0) + (e.delta ?? 1);
        break;
      case 'money': shown.push(...moneyEffect(e, ctx)); break;
      case 'love': { const note = loveChoice(e.value, ctx.cast); if (note) ctx.note = note; break; }
      case 'funeral': funeral(ctx.cast?.words?.goneId, e.value === 'skip' ? false : e.value === 'speak' ? 'speak' : true); break;
      case 'military': { const note = militaryChoice(e.value); if (note) ctx.note = note; break; }
      case 'law': { const note = lawChoice(e.value); if (note) ctx.note = note; break; }
      case 'estate': { const note = estateChoice(e.value, ctx.cast); if (note) ctx.note = note; break; }
      case 'bond': { const note = bondChoice(e.value, ctx.cast); if (note) ctx.note = note; break; }
      case 'moment': { const note = momentChoice(e.value, ctx.cast); if (note) ctx.note = note; break; }
      case 'milestone': milestone(e.value); break;
      case 'death': ctx.death = e.value; break;
      default: console.warn('Unknown effect', e);
    }
  }
  return shown;
}
