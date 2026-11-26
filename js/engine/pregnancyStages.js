// The months of a pregnancy that goes on: three months in (morning sickness, tiredness), six months in (an aching back,
// swollen feet, the last stretch), and a baby shower. Asked of the player who is pregnant, or, where a partner is, of
// the player beside them. Whether it is a boy or a girl, and how many, is found out at the birth, not before.
//
//   p.flags.pregnancy.months   months since it began (shorter turns count them; yearly turns tell all three at once)
//   p.flags.pregnancy.told     ['3', '6', 'shower'] the scenes already queued
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, log } from '../state.js';

const IDS = ['expecting_3', 'expecting_3_partner', 'expecting_6', 'expecting_6_partner', 'expecting_shower'];
export const STAGE_IDS = new Set(IDS);
const pregnantMe = (p = player()) => (p.flags.bornAs ?? p.gender) === 'female';
const npcOf = (id) => store.state.npcs[id];

function queue(which) {
  const p = player();
  const preg = p.flags.pregnancy;
  if (!preg || (preg.told ?? []).includes(which)) return;
  preg.told = [...(preg.told ?? []), which];
  const them = npcOf(preg.otherId);
  const id = which === 'shower' ? 'expecting_shower' : `expecting_${which}${pregnantMe(p) ? '' : '_partner'}`;
  if (!pregnantMe(p) && !them?.alive && which !== 'shower') return; // nobody to be there for
  store.state.pendingEvents.push({ id, cast: { them: them?.alive ? them.id : undefined, words: { work: workWords(p) } } });
}

/** "work" or "school" or "everything", for the scenes' text. */
function workWords(p) {
  if (p.career?.title) return 'Work';
  if (p.education?.enrolled) return 'School';
  return 'Everything';
}

/**
 * Called once the pregnancy is going on (kept, or could not be ended). On yearly turns the months between are the
 * year itself, so all three are told now, in order; on shorter turns each comes when its month does (monthsPass).
 */
export function pregnancyGoesOn() {
  const p = player();
  const preg = p.flags.pregnancy;
  if (!preg) return;
  preg.months ??= 0;
  if ((store.state.settings?.step ?? 12) >= 12) { queue('3'); queue('6'); queue('shower'); }
  else catchUp(preg);
}
function catchUp(preg) {
  if (!['keep', 'unable'].includes(preg.decided)) return;
  if (preg.months >= 3) queue('3');
  if (preg.months >= 6) { queue('6'); queue('shower'); }
}
/** Shorter turns: the months go by. */
export function monthsPass(step) {
  const preg = player().flags.pregnancy;
  if (!preg) return;
  preg.months = (preg.months ?? 0) + step;
  catchUp(preg);
}
/** A pregnancy that ended: its scenes still waiting are taken away. */
export function dropStageScenes() {
  store.state.pendingEvents = (store.state.pendingEvents ?? []).filter((pe) => !STAGE_IDS.has(pe.id));
}

const stress = (p, d) => { p.career ??= {}; p.career.stress = Math.round(clamp((p.career.stress ?? 30) + d)); };
const perf = (p, d) => { if (p.career?.title && p.career.performance != null) p.career.performance = clamp(p.career.performance + d); };
const bump = (npc, d) => { if (npc?.alive) npc.meters.relationship = clamp(npc.meters.relationship + d); };

/** The choice in one of the scenes. @returns {string} a line added to the outcome */
export function stageChoice(choice, cast = {}) {
  const p = player();
  if (!p.flags.pregnancy) return '';
  const them = npcOf(cast.them) ?? npcOf(p.flags.pregnancy.otherId);
  const c = country();
  switch (choice) {
    // Three months: the player.
    case 'rest': stress(p, -6); perf(p, -3); p.stats.mood = clamp(p.stats.mood + 2); return '';
    case 'doctor': {
      const fee = localMoney(120, c);
      if (p.age >= 18) p.finance.cash = Math.max(0, p.finance.cash - fee);
      p.stats.health = clamp(p.stats.health + 3); stress(p, -3);
      return p.age >= 18 ? `(${fmtMoney(fee, c)}.)` : '';
    }
    case 'push': stress(p, 8); p.stats.health = clamp(p.stats.health - 2); return '';
    // Three months: beside a partner.
    case 'help': bump(them, 6); stress(p, 4); return '';
    case 'appointments': bump(them, 4); p.stats.mood = clamp(p.stats.mood + 2); return '';
    case 'usual': bump(them, -4); return '';
    // Six months: the player.
    case 'cutback': stress(p, -8); perf(p, -4); return '';
    case 'classes': {
      const fee = localMoney(200, c);
      if (p.age >= 18) p.finance.cash = Math.max(0, p.finance.cash - fee);
      p.stats.health = clamp(p.stats.health + 3); p.stats.mood = clamp(p.stats.mood + 3);
      if (them?.alive) bump(them, 3);
      return p.age >= 18 ? `(${fmtMoney(fee, c)}.)` : '';
    }
    case 'fulltilt': {
      stress(p, 10);
      if (rng.chance(0.3)) {
        p.stats.health = clamp(p.stats.health - 4); perf(p, -6);
        p.flags.pregnancy.bedRest = true;
        const line = 'At the next appointment the doctor orders bed rest for the last weeks. You are not to argue.';
        log(line, 'system', 'bad');
        return line;
      }
      return '';
    }
    // Six months: beside a partner.
    case 'nursery': {
      const fee = localMoney(500, c);
      p.finance.cash = Math.max(0, p.finance.cash - fee);
      bump(them, 5); p.stats.mood = clamp(p.stats.mood + 3);
      return `(${fmtMoney(fee, c)} on paint, a crib and a mobile.)`;
    }
    case 'together': bump(them, 6); return '';
    case 'extra': {
      const pay = localMoney(800, c);
      if (p.career?.title) p.finance.cash += pay;
      bump(them, -3); stress(p, 5);
      return p.career?.title ? `(${fmtMoney(pay, c)} put aside.)` : '';
    }
    // The shower.
    case 'big': {
      const fee = localMoney(400, c);
      const gifts = localMoney(900, c);
      p.finance.cash = Math.max(0, p.finance.cash - fee) + gifts;
      p.stats.mood = clamp(p.stats.mood + 8);
      for (const n of Object.values(store.state.npcs)) if (n?.alive && p.npcIds.includes(n.id) && ['parent', 'sibling', 'friend', 'grandparent'].includes(n.role)) bump(n, 3);
      return `The gifts (a stroller, a car seat, a mountain of tiny clothes in every color, for a baby nobody has met yet) come to about ${fmtMoney(gifts, c)} you will not have to spend.`;
    }
    case 'small': p.stats.mood = clamp(p.stats.mood + 5); bump(them, 2); return '';
    case 'skip': return '';
    default: return '';
  }
}
