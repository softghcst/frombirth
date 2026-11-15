// Things to do with your time: the gym, the library, meditation, holidays
// and nights out. Each can be done once a year.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, npcsByRole, log } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { addCondition } from './health.js';
import { remember } from './conditions.js';
import { GYM_COST, NIGHT_OUT_COST, NIGHTLIFE_AGE, HOLIDAYS } from '../data/activities.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

function acts() {
  const p = player();
  if (p.flags.funActs?.age !== p.age) p.flags.funActs = { age: p.age };
  return p.flags.funActs;
}
const once = (key) => { if (acts()[key]) return false; acts()[key] = true; return true; };
const free = () => !player().legal.incarceration;

/** What is on offer right now, for the Pursuits tab. */
export function activityOptions() {
  const p = player();
  const c = country();
  if (!free()) return [];
  const a = [];
  if (p.age >= 12) a.push({ id: 'gym', label: `Go to the gym (${fmtMoney(localMoney(GYM_COST, c), c)} a year)` });
  if (p.age >= 6) a.push({ id: 'library', label: 'Spend time at the library' });
  if (p.age >= 10) a.push({ id: 'meditate', label: 'Meditate' });
  if (p.age >= 18) a.push({ id: 'holiday', label: 'Take a holiday' });
  if (p.age >= NIGHTLIFE_AGE) a.push({ id: 'night', label: `Go out for the night (${fmtMoney(localMoney(NIGHT_OUT_COST, c), c)})` });
  return a.map((x) => ({ ...x, done: !!acts()[x.id] }));
}

export function gym() {
  const p = player();
  const cost = localMoney(GYM_COST, country());
  if (p.finance.cash < cost) return result(false, 'You cannot afford the membership.', 'neutral');
  if (!once('gym')) return result(false, 'You have been going all year.', 'neutral');
  p.finance.cash -= cost;
  if (rng.chance(0.04)) {
    p.stats.health = clamp(p.stats.health - 5);
    const text = 'You went at the weights too hard in week one and pulled something. You spent the rest of the year on the exercise bike, sulking.';
    log(text, 'system', 'bad');
    return result(false, text);
  }
  p.stats.health = clamp(p.stats.health + Math.max(1, Math.round(rng.int(4, 7) * (100 - p.stats.health) / 50)));
  if (p.stats.charm < 75) p.stats.charm = clamp(p.stats.charm + rng.int(1, 2));
  p.stats.mood = clamp(p.stats.mood + 2);
  p.hidden.discipline = clamp(p.hidden.discipline + 1);
  const text = 'Three times a week, all year. You are fitter, and your clothes sit better.';
  log(text, 'system', 'good');
  return result(true, text);
}

export function library() {
  const p = player();
  if (!once('library')) return result(false, 'You have read your way through the year already.', 'neutral');
  p.stats.intellect = clamp(p.stats.intellect + rng.int(3, 5));
  p.stats.mood = clamp(p.stats.mood + 1);
  const text = 'You spent your free hours in the library. You know things now that you did not in January.';
  log(text, 'system', 'good');
  return result(true, text);
}

export function meditate() {
  const p = player();
  if (!once('meditate')) return result(false, 'You already sit every morning.', 'neutral');
  p.stats.mood = clamp(p.stats.mood + rng.int(4, 7));
  p.hidden.willpower = clamp(p.hidden.willpower + 2);
  p.hidden.discipline = clamp(p.hidden.discipline + 1);
  p.hidden.crazy = clamp(p.hidden.crazy - 2);
  const text = 'Ten minutes every morning, watching your own breath. The year feels quieter for it.';
  log(text, 'system', 'good');
  return result(true, text);
}

/** Holidays on offer, and who could come. */
export function holidayOptions() {
  const p = player();
  const c = country();
  return HOLIDAYS.map((h) => {
    const cost = localMoney(h.cost, c);
    return { id: h.id, name: h.name, cost, affordable: p.finance.cash >= cost * (companions().length ? 1 : 1) };
  });
}
/** Family who would come along: a partner and any children at home. */
export const companions = () => [...npcsByRole('spouse'), ...npcsByRole('partner'), ...npcsByRole('child').filter((k) => k.age < 18)];

export function holiday(id, bringFamily) {
  const p = player();
  const c = country();
  const h = HOLIDAYS.find((x) => x.id === id);
  const party = bringFamily ? companions() : [];
  const cost = Math.round(localMoney(h.cost, c) * (1 + party.length * 0.6));
  if (p.finance.cash < cost) return result(false, 'You cannot afford it.', 'neutral');
  if (!once('holiday')) return result(false, 'You have had your holiday this year.', 'neutral');
  p.finance.cash -= cost;
  p.stats.mood = clamp(p.stats.mood + h.mood);
  for (const k of ['health', 'intellect', 'charm']) if (h[k]) p.stats[k] = clamp(p.stats[k] + h[k]);
  for (const n of party) {
    n.meters.relationship = clamp(n.meters.relationship + rng.int(5, 10));
    n.lastInteractionAge = p.age;
    remember(n, `holiday_${id}`, `You went on ${h.name.toLowerCase()} together.`);
  }
  let text = `${h.name}${party.length ? ` with ${party.map((n) => n.firstName).join(', ').replace(/, ([^,]*)$/, ' and $1')}` : ''}. It cost ${fmtMoney(cost, c)} and was worth it.`;
  let tone = 'good';
  if (h.risky && rng.chance(h.risky)) {
    p.stats.health = clamp(p.stats.health - rng.int(8, 18));
    addCondition('broken_arm');
    text += ' On the last day you fell on the descent and broke your arm.';
    tone = 'neutral';
  } else if (rng.chance(0.07)) {
    addCondition('flu');
    p.stats.mood = clamp(p.stats.mood - 4);
    text += ' You spent the last three days of it in bed with something you caught on the plane.';
    tone = 'neutral';
  } else if (!party.length && rng.chance(0.15)) {
    const pal = makeNpc({ role: 'friend', countryId: p.countryId, age: Math.max(18, p.age + rng.int(-5, 5)), relationship: rng.int(50, 70) });
    store.state.npcs[pal.id] = pal;
    p.npcIds.push(pal.id);
    pal.lastInteractionAge = p.age;
    remember(pal, 'metOnHoliday', 'You met on holiday and stayed in touch.');
    text += ` You met ${pal.firstName} there, and swapped numbers.`;
  }
  log(text, 'system', tone);
  return result(true, text, tone);
}

export function nightOut() {
  const p = player();
  const c = country();
  const cost = localMoney(NIGHT_OUT_COST, c);
  if (p.age < NIGHTLIFE_AGE) return result(false, 'You are too young to get in.', 'neutral');
  if (p.finance.cash < cost) return result(false, 'You cannot afford a night out.', 'neutral');
  if (!once('night')) return result(false, 'You have had your big night out this year.', 'neutral');
  p.finance.cash -= cost;
  const roll = rng.next();
  let text; let tone = 'good';
  if (roll < 0.06) {
    p.stats.health = clamp(p.stats.health - rng.int(4, 10));
    p.stats.mood = clamp(p.stats.mood - 4);
    p.legal.heat = clamp(p.legal.heat + 5);
    text = 'Somebody spilled a drink, somebody said something, and you went home with a split lip.';
    tone = 'bad';
  } else if (roll < 0.2) {
    p.stats.mood = clamp(p.stats.mood + 3);
    p.stats.health = clamp(p.stats.health - 2);
    text = 'You remember the first half of the night clearly. The second half, your friends have on video.';
    tone = 'neutral';
  } else if (roll < 0.38) {
    const pal = makeNpc({ role: 'friend', countryId: p.countryId, age: Math.max(18, p.age + rng.int(-4, 6)), relationship: rng.int(45, 65) });
    store.state.npcs[pal.id] = pal;
    p.npcIds.push(pal.id);
    pal.lastInteractionAge = p.age;
    p.stats.mood = clamp(p.stats.mood + 8);
    text = `You danced until the lights came on, and came away with a new friend: ${pal.firstName}.`;
  } else {
    p.stats.mood = clamp(p.stats.mood + rng.int(6, 10));
    p.stats.charm = clamp(p.stats.charm + 1);
    text = 'Good music, good company, and a taxi home with the windows down.';
  }
  log(text, 'system', tone);
  return result(tone !== 'bad', text, tone);
}
