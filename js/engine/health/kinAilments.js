// The people around the player get ailments too: a flu, an ear infection, a broken arm, a broken hip. The same
// ailments as the player's own (data/health/ailments.js), at the same ages and rates, kept in each person's health
// record (npc.health.ailments, beside their long-term conditions in npc.health.conds). Most pass without a word.
// A few become a scene: a parent with a small child who is ill, a relative's broken hip, and for a physician, the
// relative who calls the doctor in the family first (data/events/health.js, data/events/stories/medicine.js).
//
//   npc.health.ailments = [{ id, age, year }]
import { seeded } from './util.js';
import { store, player, log, country } from '../../state.js';
import { clamp, fmtMoney } from '../../util.js';
import { ILLNESSES, ILLNESS_BY_ID } from '../../data/health/ailments.js';
import { LEGACY_IDS } from '../../data/health/conditions.js';
import { TREATMENTS } from '../../data/activities.js';
import { careCost } from './visits.js';

const year = () => store.state.year;
/** Ailments a scene is about: those that need a doctor, or someone to look after them. */
const SERIOUS = ['broken_arm', 'broken_hip'];
const CHILDHOOD = ['flu', 'ear_infection', 'broken_arm'];

/** Someone's current ailments. */
export const kinAilments = (n) => n?.health?.ailments ?? [];
export const kinHas = (n, id) => kinAilments(n).some((a) => a.id === id);
const plain = (id) => ILLNESS_BY_ID[id]?.name ?? 'an illness';
function clear(n, id) {
  if (n?.health?.ailments) n.health.ailments = n.health.ailments.filter((a) => a.id !== id);
}
function medActive() {
  const m = player().medicine;
  return m && (m.job || m.training || m.clinicIds?.length) ? m : null;
}

/**
 * One year of someone's ailments: last year's clear up (or not), and perhaps a new one. Called from the Health
 * Engine's yearly step for the people closest to the player (engine/health/story.js tickPeopleHealth).
 * @param {(id:string, cast:object, o?:object)=>void} beat the Story Director's storyBeat
 */
export function kinAilmentYear(n, beat) {
  const h = n?.health;
  if (!h || !n.alive) return null;
  // Their own dice, by person and year: the rest of the game's rolls are not moved by who in the family caught a cold.
  const r = seeded('kinAilment', n.id, year(), h.ailRolls = (h.ailRolls ?? 0) + 1);
  h.ailments = (h.ailments ?? []).filter((a) => a.year >= year() || !r.chance(ILLNESS_BY_ID[a.id]?.recover ?? 1));
  if (h.ailments.length >= 2) return null;
  let got = null;
  for (const def of ILLNESSES) {
    if (LEGACY_IDS[def.id] || !def.chance || n.age < def.ages[0] || n.age > def.ages[1] || kinHas(n, def.id)) continue;
    if (!r.chance(def.chance)) continue;
    got = { id: def.id, age: n.age, year: year() };
    h.ailments.push(got);
    break;
  }
  if (got) sceneFor(n, got, beat);
  return got;
}

function sceneFor(n, a, beat) {
  const p = player();
  const close = n.meters.relationship >= 30;
  const serious = SERIOUS.includes(a.id) || (a.id === 'flu' && (n.age < 2 || n.age >= 75));
  const words = { ailment: plain(a.id), ailmentId: a.id };
  const m = medActive();
  // A physician in the family: the call comes to them first.
  if (m && serious && close && (m.scenes.familyAilment ?? -99) < year() - 2) {
    m.scenes.familyAilment = year();
    beat('med_family_ailment', { who: n.id, words }, { source: 'medicine' });
    return;
  }
  if (a.id === 'broken_hip') {
    n.flags.inHospital = year();
    if (close) log(`${n.firstName} has fallen and broken a hip, and is in the hospital.`, 'system', 'bad');
    if (close && p.age >= 12) beat('kin_broken_hip', { who: n.id, words }, { source: 'health' });
    return;
  }
  // A parent with a small child who is ill.
  if (n.role === 'child' && n.age < 12 && p.age >= 16 && CHILDHOOD.includes(a.id) && (p.flags.kidSickYear ?? -99) < year() - 1) {
    p.flags.kidSickYear = year();
    beat('kin_child_sick', { kid: n.id, words }, { source: 'health' });
  }
}

/** What it costs the player to take someone to the doctor about an ailment. */
export const kinVisitCost = (id) => careCost(TREATMENTS[id]?.cost ?? 80);

/**
 * The player's choice in one of those scenes. No scene decides how anyone fares beyond whether they were seen.
 * @param {string} how  doctor | home | school (a child); visit | home | pay | card (a broken hip);
 *                      seen | look | self (a physician's relative)
 */
export function kinAilmentChoice(how, n, id) {
  const p = player();
  if (!n) return '';
  const rel = (d) => { n.meters.relationship = clamp(n.meters.relationship + d); };
  const stress = (d) => { if (p.health?.wellbeing) p.health.wellbeing.stress = clamp(p.health.wellbeing.stress + d); };
  switch (how) {
    case 'doctor': {
      const cost = kinVisitCost(id);
      if (cost > p.finance.cash) { rel(2); return `The appointment would cost ${fmtMoney(cost, country())}, more than you have. You look after ${n.firstName} at home, and it passes in its own time.`; }
      p.finance.cash -= cost;
      clear(n, id);
      rel(4);
      return cost ? `The doctor sees ${n.firstName} the same day. It cost ${fmtMoney(cost, country())}.` : `The doctor sees ${n.firstName} the same day.`;
    }
    case 'home':
      rel(n.role === 'child' ? 6 : 10);
      stress(n.role === 'child' ? 2 : 6);
      if (p.career?.careerId && p.career.performance != null) p.career.performance = clamp(p.career.performance - 1);
      if (n.role !== 'child') clear(n, id);
      return '';
    case 'school': rel(-4); return '';
    case 'visit': rel(8); stress(2); return '';
    case 'pay': {
      const cost = careCost(3000);
      if (cost > p.finance.cash) { rel(4); return `Help at home costs more than you have. You do what you can yourself.`; }
      p.finance.cash -= cost;
      clear(n, id);
      rel(5);
      return cost ? `It cost ${fmtMoney(cost, country())}.` : '';
    }
    case 'card': rel(-2); return '';
    case 'seen': clear(n, id); rel(5); return '';
    case 'look': clear(n, id); rel(3); return '';
    case 'self': clear(n, id); rel(2); return '';
    default: return '';
  }
}
