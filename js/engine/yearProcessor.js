// The annual tick. Order matters: the world ages first, then the player's own
// systems run, then the death check, then this year's scenarios are queued.
import { store, player, log } from '../state.js';
import { tickRelationships } from './relationships.js';
import { tickFamily } from './familyGen.js';
import { tickRomance } from './romance.js';
import { tickChildren } from './children.js';
import { tickEducation } from './education.js';
import { tickCareer } from './career.js';
import { tickFinance } from './finance.js';
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
  state.year += 1;
  if (BIRTHDAYS[p.age]) log(BIRTHDAYS[p.age]);

  tickRelationships();
  tickFamily();
  tickRomance();
  tickChildren();
  tickEducation();
  const workDeath = tickCareer();
  if (workDeath) { die(workDeath); return; }
  tickFinance();
  tickHealth();
  p.legal.heat = Math.max(0, p.legal.heat - 10);

  const cause = rollDeath();
  if (cause) { die(cause); return; }

  drawEvents();
}
