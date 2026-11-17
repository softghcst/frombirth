// Life in a particular country: what the place does to the player each
// year, depending on how well off they are, and what its laws allow.
// The figures come from data/living.js.
import { rule, lawsOf } from './rules.js';
import { expectedPay } from './worklife.js';
import { MONARCHIES } from '../data/royalty.js';
import { rng } from '../rng.js';
import { clamp, fmtMoney, theCountry } from '../util.js';
import { store, player, country, livingNpcs, log } from '../state.js';
import { LIVING, HAZARDS, CRISES, INFLATION, grade } from '../data/living.js';
import { netWorth } from './finance.js';
import { addCondition } from './health.js';
import { damageProperty, properties } from './realEstate.js';

export const livingIn = (c = country()) => LIVING[c.id];
export const laws = (c = country()) => lawsOf(c.id);
export const crisis = (c = country()) => CRISES[LIVING[c.id].crisis] ?? null;

/**
 * How well off the player is for where they live: 'poor' | 'middle' | 'rich'.
 * Children are as well off as the parents they live with.
 */
export function wealthTier() {
  const p = player();
  const c = country();
  if (p.age < 18 || p.flags.livesWithParents) {
    const parents = livingNpcs().filter((n) => n.role === 'parent');
    if (parents.length) {
      const w = parents.reduce((s, n) => s + (n.wealth ?? n.meters.money), 0) / parents.length;
      return w >= 68 ? 'rich' : w >= 36 ? 'middle' : 'poor';
    }
  }
  // Judged against local prices: the same money goes further where things cost less.
  const k = c.currency.scale * c.living.costK;
  const worth = netWorth(store.state) / k;
  const income = (expectedPay() || 0) / k;
  if (worth >= 400000 || income >= 160000) return 'rich';
  if (worth >= 15000 || income >= 30000) return 'middle';
  return 'poor';
}
export const tierName = (t = wealthTier()) => ({ poor: 'Struggling', middle: 'Getting by comfortably', rich: 'Wealthy' })[t];

/** The standard of health care this person can actually reach: the rich go private. */
export function careQuality() {
  const L = livingIn();
  const t = wealthTier();
  return t === 'rich' ? Math.max(L.health, 88) : t === 'middle' ? Math.max(L.health, Math.min(78, L.health + 12)) : L.health;
}

/** Whether the law lets the player leave the country. */
export function mayLeave() {
  const p = player();
  const ban = crisis()?.exitBan;
  const male = (p.flags.bornAs ?? p.gender) === 'male' && p.gender !== 'female';
  if (ban && male && p.age >= ban[0] && p.age <= ban[1]) return { ok: false, reason: `Men between ${ban[0]} and ${ban[1]} are not allowed to leave ${theCountry(country().name)} while the war lasts.` };
  return { ok: true, reason: '' };
}

/** A plain-words picture of the country, for the Self tab, the creator and the move-abroad list. */
export function summary(c = country()) {
  const L = LIVING[c.id];
  const pay = L.wage >= 0.85 ? 'high' : L.wage >= 0.5 ? 'middling' : L.wage >= 0.18 ? 'low' : 'very low';
  const prices = L.cost >= 1.05 ? 'high' : L.cost >= 0.7 ? 'middling' : L.cost >= 0.4 ? 'low' : 'very low';
  const k = CRISES[L.crisis];
  return {
    rows: [
      ['Pay', pay], ['Prices', prices], ['Safety', grade(L.safety)], ['Health care', grade(L.health)],
      ['Power and water', grade(L.infra)], ['Stability', grade(L.stability)],
      ['Rising prices', { low: 'steady', high: 'fast', extreme: 'out of control' }[L.inflation]],
      ['Natural hazards', L.hazards.map((h) => HAZARDS[h].name).join(', ') || 'few'],
      ...(MONARCHIES[c.id] ? [['Head of state', `a monarchy${MONARCHIES[c.id].maleOnly ? '; only men inherit the throne' : ''}`]] : []),
      ['Same-sex marriage', rule('sameSexMarriage', c.id) ? 'legal' : 'not recognized'],
      ...(rule('lgbt', c.id) === 'hostile' ? [['Being gay or transgender', 'against the law, or treated as if it were']] : []),
      ['Gambling', rule('gambling', c.id) ? 'legal' : 'illegal'],
      ...(rule('alcohol', c.id) ? [] : [['Alcohol', 'banned']]),
      ['Military service', rule('conscription', c.id) ? 'compulsory for young men' : 'voluntary'],
      ['Death penalty', rule('deathPenalty', c.id) ? 'in use' : 'none'],
    ],
    crisis: k ? { name: k.name, blurb: k.blurb } : null,
    short: `Pay ${pay}, prices ${prices}, safety ${grade(L.safety)}${k ? `. ${k.name}` : ''}`,
  };
}

const TIER_LINE = { rich: ' Your money kept the worst of it away from you.', middle: '', poor: ' With nothing to fall back on, it hit you hard.' };

/** Yearly: what living here did to the player this year. */
export function tickLiving() {
  const p = player();
  const c = country();
  const L = livingIn();
  const tier = wealthTier();
  const shield = { rich: 0.4, middle: 1, poor: 1.5 }[tier];
  if (p.legal.incarceration) return;
  const moodBefore = p.stats.mood;

  // A new country is taken in once.
  if (p.flags.livingSeen !== c.id) {
    p.flags.livingSeen = c.id;
    const k = crisis();
    if (k && p.age >= 6) log(`${k.blurb}`, 'system', 'bad');
  }

  // Money in the bank loses value where prices run away. The rich keep theirs in things, not cash.
  const rate = INFLATION[L.inflation] * (tier === 'rich' ? 0.5 : 1);
  if (rate && p.age >= 18 && p.finance.cash > 0) {
    const lost = Math.round(p.finance.cash * rate * rng.around(1, 0.3));
    if (lost > 0) {
      p.finance.cash -= lost;
      log(`Prices rose again. What you keep in cash buys ${fmtMoney(lost, c)} less than it did a year ago. Property and investments held their value.`, 'system', 'bad');
    }
  }

  // The ongoing crisis
  const k = crisis();
  if (k && p.age >= 6) {
    // People get used to almost anything: the weight is felt in the bad years, not every year.
    if (rng.chance(0.5)) {
      p.stats.mood = clamp(p.stats.mood + Math.round(k.mood * (tier === 'rich' ? 0.5 : 1)));
      if (k.yearly) log(k.yearly, 'system', 'bad');
    }
    if (k.shortages && rng.chance(k.shortages * shield / 1.5)) {
      p.stats.health = clamp(p.stats.health - rng.int(2, 5));
      log(`There was not enough to eat for part of the year, and no medicine to be had.${TIER_LINE[tier]}`, 'system', 'bad');
    }
    if (k.danger && rng.chance(k.danger * (tier === 'poor' ? 1.3 : 1))) {
      p.stats.health = clamp(p.stats.health - rng.int(15, 40));
      log('A strike landed on your street. You were pulled out of the rubble alive.', 'system', 'bad');
    }
    if (k.damage) for (const a of properties().filter((x) => (x.countryId ?? c.id) === c.id)) if (rng.chance(k.damage)) { damageProperty(a, rng.int(20, 50)); log(`Your ${a.name.charAt(0).toLowerCase() + a.name.slice(1)} was damaged in the fighting.`, 'system', 'bad'); }
  }

  // Power and water
  if (L.infra < 60 && rng.chance((60 - L.infra) / 60)) {
    if (tier === 'rich') log('The power was off for weeks at a time this year. Your generator ran; the street was dark.', 'system', 'neutral');
    else { p.stats.mood = clamp(p.stats.mood - (tier === 'poor' ? 3 : 2)); log(`The power and water were off for weeks at a time this year.${tier === 'poor' ? ' You carried water up the stairs in buckets.' : ''}`, 'system', 'bad'); }
  }

  // Crime finds people who cannot buy their way out of its path, and targets those who look worth robbing.
  if (p.age >= 10 && rng.chance((100 - L.safety) / 100 * 0.14 * (tier === 'poor' ? 1.3 : tier === 'rich' ? 0.6 : 1))) {
    const cash = Math.max(0, p.finance.cash);
    const taken = Math.round(cash * rng.int(tier === 'rich' ? 1 : 3, tier === 'rich' ? 4 : 12) / 100);
    p.finance.cash -= taken;
    p.stats.mood = clamp(p.stats.mood - 6);
    const hurt = rng.chance(0.25);
    if (hurt) p.stats.health = clamp(p.stats.health - rng.int(5, 18));
    log(`You were robbed${hurt ? ' and beaten' : ''} ${rng.pick(['on the way home', 'at a traffic light', 'in your own doorway', 'on the bus'])}.${taken ? ` They took ${fmtMoney(taken, c)}.` : ''}`, 'system', 'bad');
  }

  // The land and the weather
  for (const id of L.hazards) {
    const h = HAZARDS[id];
    if (!rng.chance(h.chance)) continue;
    let text = h.strike;
    if (h.health) p.stats.health = clamp(p.stats.health + Math.round(h.health * shield));
    if (h.mood) p.stats.mood = clamp(p.stats.mood + Math.round(h.mood * shield));
    if (h.damage) {
      const mine = properties().filter((x) => (x.countryId ?? c.id) === c.id);
      if (mine.length) {
        const a = rng.pick(mine);
        damageProperty(a, Math.round(h.damage * (tier === 'rich' ? 0.6 : 1)));
        text += ` Your ${a.name.charAt(0).toLowerCase() + a.name.slice(1)} was damaged${tier === 'rich' ? ', though the insurance will cover much of it' : ''}.`;
      } else if (tier === 'poor' && p.age >= 18 && rng.chance(0.4)) {
        const lost = Math.round(Math.max(0, p.finance.cash) * 0.3);
        p.finance.cash -= lost;
        text += ` The place you rent was badly hit, and you lost most of what you owned${lost ? ` (${fmtMoney(lost, c)})` : ''}.`;
      }
    }
    if (h.injury && rng.chance(h.injury * shield)) {
      p.stats.health = clamp(p.stats.health - rng.int(8, 22));
      if (rng.chance(0.4)) addCondition('broken_arm');
      text += ' You were hurt.';
    }
    p.stats.mood = clamp(p.stats.mood - 3);
    log(`${text}${h.damage || h.injury ? TIER_LINE[tier] : ''}`, 'system', 'bad');
    break; // one disaster a year is enough
  }

  // People adapt. Hard conditions wear a mood down, but on their own they do not grind it to nothing.
  if (p.stats.mood < 32 && p.stats.mood < moodBefore) p.stats.mood = Math.min(moodBefore, 32);

  // Sanctions and mobilisation: a call-up paper, for men of the right age.
  if (k?.callUp && p.gender === 'male' && p.age >= 18 && p.age <= 50 && !p.flags.calledUp && rng.chance(k.callUp)) {
    p.flags.calledUp = true;
    store.state.pendingEvents.push({ id: 'call_up_papers', cast: {} });
  }
}
