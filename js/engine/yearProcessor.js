// The annual tick. Order matters: the world ages first, then the player's own
// systems run, then the death check, then this year's scenarios are queued.
import { store, player, log, milestone } from '../state.js';
import { tickRelationships } from './relationships.js';
import { tickAnimals } from './animals.js';
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
import { tickEconomy, tickMoves } from './economy.js';
import { tickStatus, tickApart } from './immigration.js';
import { emigrate } from './emigration.js';
import { tickSchoolFunding } from './edlegacy.js';
import { tickRoyalEducation } from './royaled.js';
import { tickProperties } from './realEstate.js';
import { tickVehicles } from './vehicles.js';
import { tickHealth } from './health.js';
import { rollDeath, die } from './death.js';
import { drawEvents } from './eventEngine.js';

const BIRTHDAYS = {
  13: 'You are officially a teenager.',
  18: 'You are an adult now. The world expects things.',
  30: 'You turned thirty.',
  50: 'Half a century. You turned fifty.',
  65: 'You reached sixty-five.',
  100: 'You turned one hundred years old!',
};

/** Advances one year. Check player().alive and state.pendingEvents afterwards. */
export function advanceYear() {
  const state = store.state;
  const p = player();
  if (!p.alive) return;

  p.age += 1;
  if (p.age === 100) { milestone('Turned 100.', 'life'); log('You are 100 years old. A card arrives from the head of state, and the local paper sends a photographer.', 'system', 'good'); }
  if (p.age === 110) milestone('Turned 110.', 'life');
  state.year += 1;
  if (BIRTHDAYS[p.age]) log(BIRTHDAYS[p.age]);

  tickRelationships();
  tickFamily();
  tickRomance();
  tickChildren();
  tickLives();
  tickEducation();
  const workDeath = tickCareer();
  if (workDeath) { die(workDeath); return; }
  tickMarket();
  tickProperties();
  const roadDeath = tickVehicles();
  if (roadDeath) { die(roadDeath); return; }
  tickFinance();
  tickHealth();
  tickPrison();
  tickSocial();
  tickIdentity();
  tickLiving();
  tickRoyalty();
  tickPolitics();
  tickScandal();
  // The country's politics move on whether or not the player takes any part. The news reaches those old enough to follow it.
  const happened = tickPolity(polity(p.countryId)).sort((a, b) => b.weight - a.weight).slice(0, 3);
  if (p.age >= 14) for (const n of happened) log(n.text, 'system', n.tone);
  afterGeneral();
  tickKin();
  tickAlumni();
  tickApplications();
  grandfather();
  tickFx();
  tickCover();
  tickRules();
  tickEconomy();
  tickMoves();
  tickApart();
  { const back = tickStatus(); if (back) emigrate(back, { forced: true }); }
  tickSchoolFunding();
  tickKids();
  tickRoyalEducation();
  { const learned = tickLanguages(); if (learned) log(learned, 'system', 'good'); }
  for (const n of tickLocal()) log(n.text, 'system', n.tone);
  tickActivism();
  tickCrime();
  tickAnimals(); // last, so the record sees the year as it ended: who died, who moved, who is left to care

  const cause = rollDeath();
  if (cause) { die(cause); return; }

  drawEvents();
}
