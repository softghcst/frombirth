// Things to do with your time: the gym, the library, meditation, holidays
// and nights out. Each can be done once a year.
import { hasRecord } from './records.js';
import { rule, may } from './rules.js';
import { rightToLive } from './citizenship.js';
import { practise } from './languages.js';
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, theCountry } from '../util.js';
import { store, player, country, npcsByRole, livingNpcs, log, milestone } from '../state.js';
import { stamp } from './emigration.js';
import { makeNpc } from './npcFactory.js';
import { addCondition } from './health.js';
import { remember } from './conditions.js';
import { GYM_COST, NIGHT_OUT_COST, HOLIDAYS, HOLIDAY_KINDS, CABINS, TRIP_STORIES } from '../data/activities.js';
import { COUNTRIES, COUNTRY_LIST } from '../data/countries.js';

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
  if (may('drink').ok) a.push({ id: 'night', label: `Go out for the night (${fmtMoney(localMoney(NIGHT_OUT_COST, c), c)})` });
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
const HOLIDAY_AGES = [3, 15];

/** What a trip costs one person, in local money, allowing for the journey there. */
function tripCost(h) {
  const p = player();
  const far = h.home && h.home !== p.countryId ? h.farMult ?? 1.5 : 1;
  return localMoney(h.cost * far, country());
}

export const holidayKinds = () => HOLIDAY_KINDS;

/** Trips of one kind, priced for one traveller. */
export function holidayOptions(kind) {
  const p = player();
  return HOLIDAYS.filter((h) => !kind || h.kind === kind).map((h) => {
    const cost = tripCost(h);
    return { id: h.id, kind: h.kind, name: h.name, cost, affordable: p.finance.cash >= cost,
      note: h.home && h.home !== p.countryId ? 'Includes the long flight there.' : h.kids ? 'Good with children.' : '' };
  });
}

/** Countries to fly to, and the seats on offer. */
const kinIn = (id) => livingNpcs().filter((n) => n.flags.abroad === id && n.role !== 'pet');
const homeIn = (id) => player().assets.find((a) => a.kind === 'property' && a.countryId === id && !a.tenant);
export const flightDestinations = () => COUNTRY_LIST.filter((c) => c.id !== player().countryId).sort((a, b) => a.name.localeCompare(b.name))
  .map((c) => ({ id: c.id, name: c.name, flag: c.flag, visited: (player().flags.visited ?? []).includes(c.id),
    family: kinIn(c.id).map((n) => n.firstName), ownHome: !!homeIn(c.id) }))
  // Places where your people or your property are come first.
  .sort((a, b) => (b.family.length + (b.ownHome ? 1 : 0)) - (a.family.length + (a.ownHome ? 1 : 0)));
export const cabinOptions = () => CABINS.map((k) => {
  const cost = localMoney(k.cost, country());
  return { id: k.id, name: k.name, blurb: k.blurb, cost, affordable: player().finance.cash >= cost };
});

/** Family who would come along: a partner and any children at home. */
export const companions = () => [...npcsByRole('spouse'), ...npcsByRole('partner'), ...npcsByRole('child').filter((k) => k.age < 18)];

const names = (list) => list.map((n) => n.firstName).join(', ').replace(/, ([^,]*)$/, ' and $1');

/**
 * Takes a holiday. For a flight abroad pass { countryId, cabin } and id 'flight'.
 * @param {string} id  a HOLIDAYS id, or 'flight'
 * @param {boolean} bringFamily
 * @param {{countryId?:string, cabin?:string, purpose?:'holiday'|'family'|'scouting'}} [trip]
 */
export function holiday(id, bringFamily, trip = {}) {
  const p = player();
  const c = country();
  const flying = id === 'flight';
  const dest = flying ? COUNTRIES[trip.countryId] : null;
  const cabin = flying ? CABINS.find((k) => k.id === (trip.cabin ?? 'economy')) : null;
  const h = flying ? { id: 'flight', kind: 'flight', mood: cabin.mood, intellect: 2, charm: cabin.charm, kids: 9,
    name: `Two weeks in ${theCountry(dest?.name ?? '')}, flying ${cabin.name.toLowerCase()}` } : HOLIDAYS.find((x) => x.id === id);
  if (!h || (flying && !dest)) return result(false, 'That trip is not on offer.', 'neutral');
  const party = bringFamily ? companions() : [];
  const ownPlace = flying ? homeIn(dest.id) : null; // no hotel to pay for
  const cost = Math.round((flying ? localMoney(cabin.cost, c) : tripCost(h)) * (1 + party.length * 0.6) * (ownPlace ? 0.6 : 1));
  if (p.finance.cash < cost) return result(false, 'You cannot afford it.', 'neutral');
  if (!once('holiday')) return result(false, 'You have had your holiday this year.', 'neutral');
  const purpose = flying ? (trip.purpose ?? 'holiday') : 'holiday';
  // The border. Gameplay configuration: a criminal record can get a visitor turned round.
  if (flying && !rightToLive(dest.id, p) && hasRecord(p, { sealed: true }) && rng.chance(0.2)) {
    const lost = Math.round(cost / 2);
    p.finance.cash -= lost;
    p.stats.mood = clamp(p.stats.mood - 6);
    (p.trips ??= []).push({ countryId: dest.id, year: store.state.year, age: p.age, purpose, refused: true });
    const text = `At the border in ${theCountry(dest.name)} they looked at your record, and put you on the next flight home. You lost ${fmtMoney(lost, c)} of the fare.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  p.finance.cash -= cost;
  p.counters.holidays = (p.counters.holidays ?? 0) + 1;
  p.stats.mood = clamp(p.stats.mood + h.mood);
  for (const k of ['health', 'intellect', 'charm']) if (h[k]) p.stats[k] = clamp(p.stats[k] + h[k]);
  for (const n of party) {
    const child = n.role === 'child' && n.age >= HOLIDAY_AGES[0] && n.age <= HOLIDAY_AGES[1];
    n.meters.relationship = clamp(n.meters.relationship + (child && h.kids ? h.kids : rng.int(5, 10)));
    n.lastInteractionAge = p.age;
    remember(n, `holiday_${h.id}`, h.kind === 'park' ? `You took them to ${h.name.replace(/^.* at /, '')}.` : `You went away together: ${h.name.toLowerCase()}.`);
  }
  const where = flying ? rng.pick(dest.cities) : null;
  const kin = flying ? kinIn(dest.id) : [];
  for (const n of kin) {
    n.meters.relationship = clamp(n.meters.relationship + rng.int(8, 14));
    n.lastInteractionAge = p.age;
    remember(n, 'visited', 'You flew over to see them.');
  }
  if (kin.length) p.stats.mood = clamp(p.stats.mood + 4);
  if (purpose === 'family') for (const n of kin) n.meters.relationship = clamp(n.meters.relationship + 6);
  if (purpose === 'scouting') p.stats.mood = clamp(p.stats.mood - Math.round(h.mood / 2)); // less of a rest
  const spoke = flying ? practise(dest.id, p) : null;
  let text = `${h.name}${party.length ? `, with ${names(party)}` : ''}. `
    + `${flying ? (ownPlace ? `You stayed in your own ${ownPlace.name.charAt(0).toLowerCase() + ownPlace.name.slice(1)}. ` : `You based yourself in ${where}. `) : ''}`
    + `${kin.length ? `You saw ${names(kin)}, and it was as if you had never been away. ` : ''}`
    + `${purpose === 'scouting' ? `You spent it looking at flats, schools and the price of bread, and talked to people who had made the move. It will count when you apply. ` : rng.pick(TRIP_STORIES[h.thrill ? 'thrill' : h.kind]) + ' '}`
    + `${spoke ? `Your ${spoke} got some use. ` : ''}It cost ${fmtMoney(cost, c)}.`;
  let tone = 'good';
  const smallest = party.filter((n) => n.role === 'child').sort((a, b) => a.age - b.age)[0];

  if (flying) {
    stamp(dest.id, 'visit');
    (p.trips ??= []).push({ countryId: dest.id, city: ownPlace ? null : where, year: store.state.year, age: p.age, purpose, cabin: cabin.id, with: party.length, saw: kin.length });
    const seen = p.flags.visited ?? (p.flags.visited = []);
    if (!seen.includes(dest.id)) {
      seen.push(dest.id);
      const all = COUNTRY_LIST.length - 1;
      if ([5, 10, 20, all].includes(seen.length)) milestone(seen.length === all ? 'Has visited every country on the map.' : `Has visited ${seen.length} countries.`, 'life');
    }
  }

  // What went wrong, if anything. At most one thing.
  if (h.risky && rng.chance(h.risky)) {
    p.stats.health = clamp(p.stats.health - rng.int(8, 18));
    addCondition('broken_arm');
    text += ' On the last day you fell on the descent and broke your arm.';
    tone = 'neutral';
  } else if (h.kind === 'cruise' && rng.chance(0.1)) {
    p.stats.health = clamp(p.stats.health - 3);
    p.stats.mood = clamp(p.stats.mood - 5);
    text += ' Two days of rough sea kept you in your cabin, the color of the wallpaper.';
    tone = 'neutral';
  } else if (h.kind === 'park' && smallest && smallest.age < 4 && rng.chance(0.3)) {
    p.stats.mood = clamp(p.stats.mood - 3);
    text += ` ${smallest.firstName} was too small for nearly every ride, and said so, loudly, all day.`;
    tone = 'neutral';
  } else if (h.kind === 'park' && rng.chance(0.1)) {
    p.stats.mood = clamp(p.stats.mood - 4);
    text += h.thrill ? ' The big ride stopped with you at the top of it for forty minutes.' : ' It rained on the day of the parade, and they ran it anyway.';
    tone = 'neutral';
  } else if (flying && cabin.id !== 'first' && rng.chance(0.1)) {
    p.stats.mood = clamp(p.stats.mood - 4);
    text += ' Your suitcase went somewhere else entirely and caught up with you on day five.';
    tone = 'neutral';
  } else if (rng.chance(0.06)) {
    addCondition('flu');
    p.stats.mood = clamp(p.stats.mood - 4);
    text += ' You spent the last three days of it in bed with something you caught on the way.';
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
  if (!may('drink').ok) return result(false, may('drink').why, 'neutral');
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

/** Trips abroad, newest first, for the passport. */
export function trips(p = player()) {
  const WORD = { holiday: 'Holiday', family: 'Visiting family', scouting: 'Looking with a move in mind' };
  return [...(p.trips ?? [])].reverse().map((t) => ({ ...t, name: COUNTRIES[t.countryId]?.name ?? t.countryId, flag: COUNTRIES[t.countryId]?.flag ?? '', what: t.refused ? 'Refused entry' : WORD[t.purpose] ?? 'Holiday' }));
}
