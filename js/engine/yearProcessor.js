// The annual tick. Order matters: the world ages first, then the player's own
// systems run, then the death check, then this year's scenarios are queued.
import { store, player, log, milestone, prunePending } from '../state.js';
import { tickRelationships } from './relationships.js';
import { tickAnimals } from './animals.js';
import { tickCare } from './animalCare.js';
import { tickEquestrian } from './equestrian.js';
import { tickLife } from './animalLife.js';
import { tickArcs } from './animalArcs.js';
import { tickSports } from './sportsLife.js';
import { tickDisasters } from './disasters.js';
import { tickBreeding } from './animalBreeding.js';
import { tickFamily } from './familyGen.js';
import { tickRomance } from './romance.js';
import { tickChildren } from './children.js';
import { tickLives } from './npcLives.js';
import { tickEducation } from './education.js';
import { tickWork } from './career.js';
import { tickFinance } from './finance.js';
import { tickCrime } from './justice.js';
import { tickCivil } from './civil.js';
import { tickKinCases } from './kinCases.js';
import { checkCare } from './guardianship.js';
import { tickPrison } from './prison.js';
import { tickDigital } from './digital/tick.js';
import { tickEra } from './eras.js';
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
import { tickStatus, tickApart, tickFamilyStatus } from './immigration.js';
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
import { closeYear } from './travel.js';
import { openGlobalYear, tickGlobalLife } from './globalLife.js';
import { finishYear, startYear } from './moments.js';
import { book, booked } from './ledger.js';
import { tickBanking, tickMoneyReview } from './banking.js';
import { tickPlan, tickStatePension } from './retirement.js';
import { tickMarket, payouts } from './market.js';
import { tickInsurance } from './insurance.js';
import { tickFamilyMoney } from './family.js';
import { tickTrusts } from './trusts.js';
import { tickSense } from './achievements.js';
import * as hood from './neighborhood.js';

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
  // Anything the player did with money since the last year is written down before this one begins.
  ['openWorldYear', openGlobalYear], // the world's own year opens first (engine/globalLife.js)
  ['openBooks', () => { book({ cat: 'auto', src: 'action' }); }],
  // Each part of the year books what it did to the player's money under its own heading (engine/ledger.js).
  ['hoodClose', () => hood.closeYear()], // the neighborhoods' months of the year just lived, before the yearly reckoning of people (engine/neighborhood.js)
  ['relationships', () => booked('auto', 'Family and friends', tickRelationships)],
  ['family', tickFamily],
  ['romance', () => booked('auto', 'Love and marriage', tickRomance)],
  ['children', () => booked('childcare', 'Your children', tickChildren)],
  ['npcLives', tickLives],
  ['education', () => booked('education', 'Fees and the cost of studying', tickEducation)],
  ['career', () => booked('salary', 'Work: bonuses and pay-offs', tickWork)],
  ['market', tickMarket], ['payouts', payouts], ['retirementPlan', tickPlan], ['statePension', tickStatePension], ['property', tickProperties],
  ['vehicles', () => booked('transport', 'Running your vehicles', tickVehicles)],
  ['banking', tickBanking],
  ['insurance', () => booked('insurance', 'Insurance premiums', tickInsurance)],
  ['finance', tickFinance], ['familyMoney', tickFamilyMoney], ['trusts', tickTrusts],
  ['illness', () => booked('health', 'Health', tickHealth)],
  ['health', () => booked('health', 'Health care', () => healthYear(player()))],
  ['prison', () => booked('legal', 'Prison', tickPrison)],
  ['digital', () => booked('auto', 'Digital life', tickDigital)], // platforms, people's digital lives, creators, reputation (engine/digital)
  ['identity', () => booked('health', 'Health and identity', tickIdentity)],
  ['living', () => booked('losses', 'Rising prices and losses', tickLiving)],
  ['disasters', () => booked('losses', 'Storms, floods and other disasters', () => tickDisasters())], // the year's weather (engine/disasters.js)
  ['royalty', () => booked('auto', 'The royal household', tickRoyalty)],
  ['politics', () => booked('auto', 'Politics', tickPolitics)],
  ['scandal', () => booked('auto', 'Scandal', tickScandal)],
  ['polity', () => {
    const p = player();
    // The country's politics move on whether or not the player takes any part. The news reaches those old enough to follow it.
    const happened = tickPolity(polity(p.countryId)).sort((a, b) => b.weight - a.weight).slice(0, 3);
    if (p.age >= 14) for (const n of happened) log(n.text, 'system', n.tone);
    // Politics also goes on in countries the player has lived in and still has ties to: the results are there when they look, or go back.
    for (const id of ties()) if (id !== p.countryId && store.state.polities?.[id]) tickPolity(store.state.polities[id]);
    afterGeneral();
  }],
  ['kin', () => booked('auto', 'Family', tickKin)],
  ['alumni', tickAlumni], ['applications', tickApplications], ['grandfather', grandfather], ['fx', tickFx],
  ['cover', () => booked('insurance', 'Health insurance', tickCover)],
  ['rules', tickRules], ['economy', tickEconomy], ['moves', tickMoves],
  ['familyLeaves', () => { const to = familyLeaves(); if (to) emigrate(to, { forced: true, family: true }); }],
  ['apart', tickApart], ['familyStatus', tickFamilyStatus],
  ['status', () => { const back = tickStatus(); if (back) emigrate(back, { forced: true }); }],
  ['schoolFunding', tickSchoolFunding],
  ['kids', () => booked('education', 'Your children\'s schooling', tickKids)],
  ['royalEducation', tickRoyalEducation],
  ['languages', () => { const learned = tickLanguages(); if (learned) log(learned, 'system', 'good'); }],
  ['local', () => { for (const n of tickLocal()) log(n.text, 'system', n.tone); }],
  ['activism', tickActivism],
  ['courts', () => booked('legal', 'Courts, fines and legal costs', () => { tickCrime(); tickCivil(); tickKinCases(); })],
  ['care', () => booked('auto', 'Who looks after you', checkCare)],
  ['neighborhood', () => hood.openYear()], // who has died, where the player lives now, and the neighborhoods' plans for the year ahead
  ['animals', tickAnimals], // late, so the record sees the year as it ended: who died, who moved, who is left to care
  ['breeding', tickBreeding], // young that are due
  ['animalCare', () => booked('pets', 'Your animals: food, the vet and their care', tickCare)], // what the animals cost, how they fared, and anything that needs a decision
  ['equestrian', tickEquestrian],
  ['animalLife', tickLife], // behavior that begins, and what families argue about
  ['animalArcs', tickArcs], // stories that take years
  ['sport', () => booked('sport', 'Sport', () => tickSports())], // the athletic year: training, seasons and events, and what they cost and paid
  ['travel', () => booked('travel', 'Travel, papers and life abroad', tickGlobalLife)],
  ['closeBooks', () => { book({ cat: 'auto', src: 'year', desc: 'The rest of the year' }); }],
  ['sense', tickSense], ['moneyReview', tickMoneyReview],
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

/** Advances one year. Check player().alive and state.pendingEvents afterward. */
export function advanceYear() {
  const state = store.state;
  const p = player();
  if (!p.alive) return;

  // What the year started from, for the yearly life update (engine/yearSummary.js).
  const before = snapshot(state);
  // Plans that carry on by themselves are lived through the year that is ending, once.
  book({ cat: 'auto', src: 'action' }); // what the player did by hand is written down first
  const planLines = booked('auto', 'Your plans for the year', () => livePlans(p));
  // The care calendar runs out the weeks left in this year before it turns.
  booked('health', 'Health care through the year', () => finishCareYear(p));
  // Trips booked for the year that is ending are taken, and anyone away comes home, before the year turns.
  if (p.travel) closeYear();
  finishYear(); // the year just lived: traditions nobody organized, invitations nobody answered (engine/moments.js)
  p.age += 1;
  if (p.age === 100) { milestone('Turned 100.', 'life'); log('You are 100 years old. A card arrives from the head of state, and the local paper sends a photographer.', 'system', 'good'); }
  if (p.age === 110) milestone('Turned 110.', 'life');
  state.year += 1;
  tickEra(); // Historical Eras: the new year's era, money, laws and events (engine/eras.js)
  if (BIRTHDAYS[p.age]) log(BIRTHDAYS[p.age]);
  state.yearReport = { before, planLines, year: state.year };

  const death = runYearSteps(state);
  if (death) { die(death); return; }

  const cause = rollDeath();
  if (cause) { die(cause); return; }

  prunePending(); // a scene queued earlier in the year may name someone the year has since taken away
  startYear(); // the new year's invitations
  drawEvents();
}
