// Life inside: the yearly grind, respect and conduct, gangs, riots, appeals,
// parole, and breaking out.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { player, country, log, milestone } from '../state.js';
import { release, imprison } from './justice.js';
import { GANGS, ESCAPE_PENALTY, RECAPTURE_PENALTY, LIFE_SENTENCE } from '../data/crimes.js';
import { LAYOUTS } from '../data/prisonLayouts.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
export const cell = () => player().legal.incarceration;
export const gang = () => GANGS.find((g) => g.id === cell()?.gangId) ?? null;
export const isJuvenile = () => cell()?.facility === 'juvenile';

function acts() {
  const p = player();
  if (p.flags.prisonActs?.age !== p.age) p.flags.prisonActs = { age: p.age };
  return p.flags.prisonActs;
}
/** Marks a once-a-year action as used; false if it already was. */
const once = (key) => { if (acts()[key]) return false; acts()[key] = true; return true; };
const bump = (key, d) => { cell()[key] = clamp(cell()[key] + d); };

/** What is on offer inside this year. */
export function prisonActions() {
  const k = cell();
  if (!k) return [];
  const a = [{ id: 'workout', label: 'Work out in the yard' }, { id: 'read', label: 'Read in the library' },
    { id: 'job', label: 'Take a prison job' }];
  if (!isJuvenile()) {
    a.push(k.gangId ? { id: 'leaveGang', label: `Leave ${gang().name}`, danger: true } : { id: 'gang', label: 'Join a gang' });
    a.push({ id: 'riot', label: 'Start a riot', danger: true });
    if (!k.appealed) a.push({ id: 'appeal', label: 'Appeal your sentence' });
  }
  a.push({ id: 'escape', label: 'Attempt an escape', danger: true });
  return a;
}

export function workOut() {
  const p = player();
  if (!once('workout')) return result(false, 'You have already put the hours in this year.', 'neutral');
  p.stats.health = clamp(p.stats.health + 5);
  p.stats.charm = clamp(p.stats.charm + 1);
  bump('respect', 4);
  const text = 'An hour in the yard every day. You are stronger, and people have noticed.';
  log(text, 'system', 'good');
  return result(true, text);
}

export function read() {
  const p = player();
  if (!once('read')) return result(false, 'You have read everything on the trolley this year.', 'neutral');
  p.stats.intellect = clamp(p.stats.intellect + 3);
  p.stats.mood = clamp(p.stats.mood + 2);
  bump('conduct', 5);
  const text = 'You read your way along the library shelf, one spine at a time.';
  log(text, 'system', 'good');
  return result(true, text);
}

export function prisonJob() {
  const p = player();
  if (!once('job')) return result(false, 'You already have your work detail for the year.', 'neutral');
  const pay = localMoney(300, country());
  p.finance.cash += pay;
  p.hidden.discipline = clamp(p.hidden.discipline + 2);
  bump('conduct', 8);
  const text = `A year in the laundry. It pays ${fmtMoney(pay, country())} and the officers know your name for the right reasons.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** @returns {{id, name, blurb, open:boolean, respect:number}[]} */
export const gangOptions = () => GANGS.map((g) => ({ ...g, open: cell().respect >= g.respect }));

export function joinGang(id) {
  const g = GANGS.find((x) => x.id === id);
  if (cell().respect < g.respect) return result(false, `${g.name} will not have you. You need more respect.`, 'neutral');
  cell().gangId = id;
  bump('respect', 10);
  bump('conduct', -10);
  const text = `You are with ${g.name} now. Nobody touches you. The officers have made a note.`;
  log(text);
  return result(true, text, 'neutral');
}

export function leaveGang() {
  const p = player();
  const g = gang();
  if (!g) return result(false, 'You are not in a gang.', 'neutral');
  cell().gangId = null;
  bump('respect', -15);
  const hurt = rng.chance(0.5);
  if (hurt) p.stats.health = clamp(p.stats.health - rng.int(8, 20));
  const text = hurt ? `You walked away from ${g.name}. They let you know what they thought of that in the showers.`
    : `You walked away from ${g.name}. They let you go, for now.`;
  log(text, 'system', hurt ? 'bad' : 'neutral');
  return result(!hurt, text, hurt ? 'bad' : 'neutral');
}

export function startRiot() {
  const p = player();
  const k = cell();
  if (!once('riot')) return result(false, 'The wing is locked down after the last one.', 'neutral');
  const chance = clamp(0.2 + (k.respect - 40) / 100 + (p.talents.crime - 50) / 250 + (k.gangId ? 0.15 : 0), 0.05, 0.85);
  bump('conduct', -30);
  if (rng.chance(chance)) {
    bump('respect', 25);
    p.stats.mood = clamp(p.stats.mood + 6);
    const text = 'The wing goes up at your word. By the time it is put down, everyone inside knows who started it, and nobody can prove it.';
    log(text, 'system', 'neutral');
    return result(true, text, 'neutral');
  }
  const extra = rng.int(1, 3);
  if (k.yearsLeft < LIFE_SENTENCE) { k.yearsLeft += extra; k.total += extra; }
  p.stats.health = clamp(p.stats.health - rng.int(5, 18));
  bump('respect', 5);
  const text = `The riot is over in twenty minutes and you are named as the ringleader. ${extra} more year${extra === 1 ? '' : 's'}, and a month in solitary.`;
  log(text, 'system', 'bad');
  return result(false, text);
}

export const APPEAL_COST = 8000;
export function appeal() {
  const p = player();
  const k = cell();
  const cost = localMoney(APPEAL_COST, country());
  if (k.appealed) return result(false, 'You have already appealed.', 'neutral');
  if (p.finance.cash < cost) return result(false, `An appeal lawyer costs ${fmtMoney(cost, country())}.`, 'neutral');
  p.finance.cash -= cost;
  k.appealed = true;
  if (rng.chance(clamp(0.25 + (k.conduct - 50) / 200, 0.05, 0.6))) {
    const cut = Math.max(1, Math.round(k.yearsLeft * 0.4));
    k.yearsLeft -= cut;
    const text = k.yearsLeft <= 0 ? 'Your appeal succeeded. The conviction is unsafe, and you are free.'
      : `Your appeal succeeded. ${cut} year${cut === 1 ? '' : 's'} came off your sentence.`;
    log(text, 'system', 'good');
    if (k.yearsLeft <= 0) release('The gate opens. Your appeal has set you free.');
    return result(true, text);
  }
  const text = 'Three judges read your appeal and dismissed it in a paragraph.';
  log(text, 'system', 'bad');
  return result(false, text);
}

// ---------- Escape ----------

export const escapeLayout = () => LAYOUTS[{ min: 0, med: 1, max: 2 }[cell().security]];

/** Uses up this year's attempt. @returns {boolean} whether an attempt can start */
export function beginEscape() {
  if (!cell() || !once('escape')) return false;
  cell().escapeAttempts += 1;
  return true;
}

/** Settles an escape attempt once the puzzle is over. */
export function finishEscape(escaped) {
  const p = player();
  const k = cell();
  if (escaped) {
    p.flags.fugitive = { owed: k.yearsLeft, security: k.security };
    p.legal.heat = 100;
    p.counters.escapes += 1;
    release('You are over the wall and running. You are free, and you are wanted.');
    milestone('Escaped from prison.', 'crime');
    return result(true, 'You are out. Every police force in the country has your photograph.');
  }
  if (k.yearsLeft < LIFE_SENTENCE) { k.yearsLeft += ESCAPE_PENALTY; k.total += ESCAPE_PENALTY; }
  bump('conduct', -25);
  bump('respect', 6);
  p.stats.mood = clamp(p.stats.mood - 8);
  const text = `A torch finds you. ${ESCAPE_PENALTY} more years, and a month in solitary to think about it.`;
  log(text, 'system', 'bad');
  return result(false, text);
}

/** Yearly: time served, what the place does to you, parole, release, and life on the run. */
export function tickPrison() {
  const p = player();
  const k = cell();

  // On the run: sooner or later someone recognises you.
  if (!k && p.flags.fugitive) {
    if (rng.chance(0.22)) {
      const owed = p.flags.fugitive.owed + RECAPTURE_PENALTY;
      p.flags.fugitive = null;
      log(`You were recognised and recaptured. You are going back inside, with ${RECAPTURE_PENALTY} years added.`, 'system', 'bad');
      imprison(owed, 3);
    } else {
      p.legal.heat = Math.max(p.legal.heat, 60);
      p.stats.mood = clamp(p.stats.mood - 3);
    }
    return;
  }
  if (!k) return;

  k.yearsLeft -= 1;
  k.served += 1;
  p.counters.yearsJailed += 1;
  p.stats.mood = clamp(p.stats.mood - (k.security === 'max' ? 6 : 4));
  p.stats.health = clamp(p.stats.health - (k.security === 'max' ? 2 : 1));
  const g = gang();
  if (g) {
    bump('respect', g.perYear);
    bump('conduct', g.conduct ?? -4);
    if (g.health) p.stats.health = clamp(p.stats.health + g.health);
    if (g.income) {
      const cut = localMoney(g.income, country());
      p.finance.cash += cut;
      log(`Your share of ${g.name}'s business came to ${fmtMoney(cut, country())} this year.`);
    }
  } else bump('respect', -2);
  bump('conduct', 3);

  if (!g && !isJuvenile() && k.respect < 25 && rng.chance(0.2)) {
    p.stats.health = clamp(p.stats.health - rng.int(6, 16));
    log('With nobody behind you, you were set upon in the yard.', 'system', 'bad');
  }

  if (isJuvenile() && p.age >= 18) return release('You turned eighteen and were released from juvenile detention. Your record is sealed.');
  if (k.yearsLeft <= 0) return release();
  if (k.total < LIFE_SENTENCE && k.served >= Math.ceil(k.total / 2) && k.conduct >= 60 && rng.chance((k.conduct - 40) / 110)) {
    return release(`The parole board looked at your record inside and let you out ${k.yearsLeft} year${k.yearsLeft === 1 ? '' : 's'} early.`);
  }
  return undefined;
}
