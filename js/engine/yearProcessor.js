// The annual tick. Order matters: the world ages first, then the player's own
// systems run, then the death check, then this year's scenarios are queued.
import { store, player, log, milestone } from '../state.js';
import { tickRelationships } from './relationships.js';
import { tickFamily } from './familyGen.js';
import { tickRomance } from './romance.js';
import { tickChildren } from './children.js';
import { tickLives } from './npcLives.js';
import { tickEducation } from './education.js';
import { tickCareer } from './career.js';
import { tickFinance } from './finance.js';
import { tickMarket } from './market.js';
import { tickCrime } from './justice.js';
import { tickPrison } from './prison.js';
import { tickSocial } from './social.js';
import { tickIdentity } from './identity.js';
import { tickLiving } from './living.js';
import { tickRoyalty } from './royalty.js';
import { tickPolitics } from './politics.js';
import { polity, tickPolity } from './polity.js';
import { afterGeneral } from './leadership.js';
import { tickScandal } from './scandal.js';
import { tickKin } from './kin.js';
import { tickActivism } from './activism.js';
import { tickLocal } from './local.js';
import { tickLanguages } from './languages.js';
import { tickAlumni } from './schooling.js';
import { tickApplications } from './university.js';
import { grandfather } from './adulted.js';
import { tickKids } from './kidschool.js';
import { tickFx } from './currency.js';
import { tickRules } from './rules.js';
import { tickCover } from './systems.js';
import { tickEconomy, tickMoves, familyLeaves, ties } from './economy.js';
import { tickStatus, tickApart } from './immigration.js';
import { emigrate } from './emigration.js';
import { tickSchoolFunding } from './edlegacy.js';
import { tickRoyalEducation } from './royaled.js';
import { tickProperties } from './realEstate.js';
import { tickVehicles } from './vehicles.js';
import { tickHealth } from './health.js';
import { finishCareYear, healthYear } from './health/index.js';
import { rollDeath, die } from './death.js';
import { livePlans } from './plans.js';
import { snapshot } from './yearSummary.js';
import { drawEvents } from './eventEngine.js';

const BIRTHDAYS = {
  13: 'You are officially a teenager.',
  18: 'You are an adult now. The world expects things.',
  30: 'You turned thirty.',
  50: 'Half a century. You turned fifty.',
  65: 'You reached sixty-five.',
  100: 'You turned one hundred years old!',
};

/**
 * The registered yearly subsystems, in the order they run. Each runs once per
 * world year: `state.yearMarks[id]` records the year it last ran, so nothing
 * can age, pay, charge or reward twice for the same year. A step that returns
 * a cause of death ends the year there.
 */
export const YEARLY = [
  ['relationships', tickRelationships], ['family', tickFamily], ['romance', tickRomance], ['children', tickChildren],
  ['npcLives', tickLives], ['education', tickEducation], ['career', tickCareer], ['market', tickMarket], ['property', tickProperties],
  ['vehicles', tickVehicles], ['finance', tickFinance], ['illness', tickHealth], ['health', () => healthYear(player())], ['prison', tickPrison],
  ['social', tickSocial], ['identity', tickIdentity], ['living', tickLiving], ['royalty', tickRoyalty], ['politics', tickPolitics], ['scandal', tickScandal],
  ['polity', () => {
    const p = player();
    // The country's politics move on whether or not the player takes any part. The news reaches those old enough to follow it.
    const happened = tickPolity(polity(p.countryId)).sort((a, b) => b.weight - a.weight).slice(0, 3);
    if (p.age >= 14) for (const n of happened) log(n.text, 'system', n.tone);
    // Politics also goes on in countries the player has lived in and still has ties to.
    for (const id of ties()) if (id !== p.countryId && store.state.polities?.[id]) tickPolity(store.state.polities[id]);
    afterGeneral();
  }],
  ['kin', tickKin], ['alumni', tickAlumni], ['applications', tickApplications], ['grandfather', grandfather], ['fx', tickFx], ['cover', tickCover],
  ['rules', tickRules], ['economy', tickEconomy], ['moves', tickMoves],
  ['familyLeaves', () => { const to = familyLeaves(); if (to) emigrate(to, { forced: true, family: true }); }],
  ['apart', tickApart], ['status', () => { const back = tickStatus(); if (back) emigrate(back, { forced: true }); }],
  ['schoolFunding', tickSchoolFunding], ['kids', tickKids], ['royalEducation', tickRoyalEducation],
  ['languages', () => { const learned = tickLanguages(); if (learned) log(learned, 'system', 'good'); }],
  ['local', () => { for (const n of tickLocal()) log(n.text, 'system', n.tone); }], ['activism', tickActivism], ['crime', tickCrime],
];
const DEADLY = new Set(['career', 'vehicles']);

/**
 * Runs every registered yearly step that has not yet run for the current world
 * year. Running it again for the same year does nothing.
 * @returns {string|null} a cause of death, if a step ended the life
 */
export function runYearSteps(state = store.state) {
  const marks = (state.yearMarks ??= {});
  for (const [id, step] of YEARLY) {
    if (marks[id] === state.year) continue;
    marks[id] = state.year;
    const death = step();
    if (DEADLY.has(id) && death) return death;
  }
  return null;
}

/** Advances one year. Check player().alive and state.pendingEvents afterwards. */
export function advanceYear() {
  const state = store.state;
  const p = player();
  if (!p.alive) return;

  // What the year started from, for the yearly life update (engine/yearSummary.js).
  const before = snapshot(state);
  // Plans that carry on by themselves are lived through the year that is ending, once.
  const planLines = livePlans(p);
  // The care calendar runs out the weeks left in this year before it turns.
  finishCareYear(p);
  p.age += 1;
  if (p.age === 100) { milestone('Turned 100.', 'life'); log('You are 100 years old. A card arrives from the head of state, and the local paper sends a photographer.', 'system', 'good'); }
  if (p.age === 110) milestone('Turned 110.', 'life');
  state.year += 1;
  if (BIRTHDAYS[p.age]) log(BIRTHDAYS[p.age]);
  state.yearReport = { before, planLines, year: state.year };

  const death = runYearSteps(state);
  if (death) { die(death); return; }

  const cause = rollDeath();
  if (cause) { die(cause); return; }

  drawEvents();
}
