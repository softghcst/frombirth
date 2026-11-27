// The flight itself, on a trip by air: a boarding pass with a seat (by the window or on the aisle, chosen in economy
// and business; first class has its suite), and sometimes a moment halfway there (data/flights.js), shown during the
// journey scene (js/ui/journey.js). First class is mostly good; business class a mix; economy a gamble. What happens
// counts: mood and health, someone met (a new contact), work got done, money from a voucher, and arriving rested or
// worn out.
//
//   trip.flight = { number, seat, side: 'window'|'aisle', moment: id|null, decided: true, chosen?: index, text?, arrive? }
import { rng } from '../rng.js';
import { clamp, localMoney } from '../util.js';
import { store, player, country } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { CABINS } from '../data/activities.js';
import { MODE_BY_ID } from '../data/travel.js';
import { FLIGHT_MOMENTS, FLIGHT_MOMENT_BY_ID, momentChance, SEATS } from '../data/flights.js';
import { makeNpc } from './npcFactory.js';
import { tripById } from './travel.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });

/** Whether the trip goes by air (its first leg, or the way it was planned). */
export function byAir(trip) {
  const mode = trip?.itinerary?.out?.[0]?.mode ?? trip?.mode;
  return !!mode && MODE_BY_ID[mode]?.over === 'air';
}
const cabinOf = (trip) => (CABINS.some((c) => c.id === trip.cabin) ? trip.cabin : 'economy');
const cityOf = (place) => place?.city ?? COUNTRIES[place?.countryId]?.name ?? '';
const words = (text, trip) => text.replace(/\{to\}/g, cityOf(trip.destination)).replace(/\{from\}/g, cityOf(trip.origin));

/** The boarding pass: flight number, cabin, and the seat once chosen. Made once per trip. */
export function boardingPass(tripId, p = player()) {
  const trip = tripById(tripId, p);
  if (!trip || !byAir(trip)) return null;
  const cabin = cabinOf(trip);
  const f = (trip.flight ??= {});
  if (!f.number) {
    const code = (cityOf(trip.origin).replace(/[^A-Za-z]/g, '').slice(0, 1) + cityOf(trip.destination).replace(/[^A-Za-z]/g, '').slice(0, 1)).toUpperCase() || 'FB';
    f.number = `${code} ${rng.int(100, 989)}`;
  }
  if (cabin === 'first' && !f.seat) { f.side = 'window'; f.seat = `${rng.int(1, 2)}A`; } // a suite, by the window
  const hours = (trip.itinerary?.out ?? []).reduce((s, l) => s + (l.hours ?? 0), 0);
  return { number: f.number, cabin, cabinName: CABINS.find((c) => c.id === cabin).name, seat: f.seat ?? null, side: f.side ?? null,
    chooseSeat: cabin !== 'first' && !f.seat, from: cityOf(trip.origin), to: cityOf(trip.destination), hours: Math.round(hours * 10) / 10 };
}

/** Picks a seat by the window or on the aisle. */
export function chooseSeat(tripId, side, p = player()) {
  const trip = tripById(tripId, p);
  if (!trip || !byAir(trip)) return result(false, 'This trip is not by air.', 'neutral');
  const f = (trip.flight ??= {});
  if (f.seat) return result(false, `Your seat is ${f.seat}.`, 'neutral');
  const s = SEATS[cabinOf(trip)];
  const row = rng.int(s.rows[0], s.rows[1]);
  f.side = side === 'aisle' ? 'aisle' : 'window';
  f.seat = `${row}${rng.pick(f.side === 'aisle' ? s.aisle : s.window)}`;
  return result(true, `Seat ${f.seat}, ${f.side === 'aisle' ? 'on the aisle' : 'by the window'}.`, 'neutral');
}

/**
 * Whether this flight has a moment halfway, and which: decided once, from the cabin, the seat and how long the flight
 * is. @returns {?{id, text, choices: string[]}}
 */
export function flightMoment(tripId, p = player()) {
  const trip = tripById(tripId, p);
  if (!trip || !byAir(trip)) return null;
  const f = (trip.flight ??= {});
  if (!f.decided) {
    f.decided = true;
    const cabin = cabinOf(trip);
    const hours = (trip.itinerary?.out ?? []).reduce((s, l) => s + (l.hours ?? 0), 0) || 3;
    const pool = FLIGHT_MOMENTS.filter((m) => m.cabin.includes(cabin) && (!m.seat || m.seat === f.side));
    f.moment = pool.length && rng.chance(momentChance(hours)) ? rng.weighted(pool, (m) => m.weight).id : null;
  }
  const m = FLIGHT_MOMENT_BY_ID[f.moment];
  if (!m || f.chosen != null) return null;
  return { id: m.id, text: words(m.text, trip), choices: m.choices.map((c) => words(c.label, trip)) };
}

/** Someone met in the air: a new contact, kept among the people the player knows. */
function meet(kind, trip, p) {
  const where = kind === 'famous' ? rng.pick(['us', 'uk', 'fr', 'kr', 'jp', 'br', 'in'].filter((c) => COUNTRIES[c])) : trip.destination.countryId;
  const n = makeNpc({ role: 'acquaintance', countryId: where, age: rng.int(kind === 'friend' ? 18 : 30, kind === 'friend' ? 60 : 62) });
  n.occupation = { famous: rng.pick(['Film star', 'Singer', 'Television presenter', 'Athlete']), business: 'Executive', friend: n.occupation }[kind] ?? n.occupation;
  n.flags.title = `Met on a flight to ${cityOf(trip.destination)}`;
  if (kind === 'famous') n.flags.famous = true;
  n.meters.relationship = kind === 'friend' ? 55 : 45;
  n.lastInteractionAge = p.age;
  store.state.npcs[n.id] = n;
  p.npcIds.push(n.id);
  return n;
}

/** Answers the moment: what happens, and what it changes. */
export function chooseFlightMoment(tripId, index, p = player()) {
  const trip = tripById(tripId, p);
  const f = trip?.flight;
  const m = FLIGHT_MOMENT_BY_ID[f?.moment];
  const ch = m?.choices[index];
  if (!ch || f.chosen != null) return result(false, 'That moment has passed.', 'neutral');
  const c = country();
  const before = { mood: p.stats.mood, health: p.stats.health, intellect: p.stats.intellect, charm: p.stats.charm, cash: p.finance.cash };
  const good = ch.risk ? rng.chance(ch.risk.odds) : true;
  const o = ch.risk ? (good ? ch.risk.good : ch.risk.bad) : ch.outcome;
  for (const k of ['mood', 'health', 'intellect', 'charm']) if (o[k]) p.stats[k] = clamp(p.stats[k] + o[k]);
  if (o.arrive === 'rested') { p.stats.health = clamp(p.stats.health + 2); p.stats.mood = clamp(p.stats.mood + 1); }
  if (o.arrive === 'tired') { p.stats.health = clamp(p.stats.health - 1); p.stats.mood = clamp(p.stats.mood - 1); }
  if (o.money > 0) p.finance.cash += localMoney(o.money, c);
  if (o.work && p.career?.careerId && !p.career.retired) p.career.performance = clamp((p.career.performance ?? 50) + o.work);
  let text = words(o.text, trip);
  const met = o.contact ? meet(o.contact, trip, p) : null;
  if (met) text += ` ${met.firstName} ${met.lastName} is now one of your contacts.`;
  if (o.arrive) text += o.arrive === 'rested' ? ' You arrive rested.' : ' You arrive worn out.';
  f.chosen = index; f.text = text; f.arrive = o.arrive ?? null;
  (trip.notes ??= []).push(text);
  const changes = [['Mood', 'mood'], ['Health', 'health'], ['Intellect', 'intellect'], ['Charm', 'charm']]
    .map(([label, k]) => ({ label, delta: Math.round(p.stats[k] - before[k]) })).filter((x) => x.delta);
  if (p.finance.cash !== before.cash) changes.push({ label: 'Money', delta: p.finance.cash - before.cash, money: true });
  return result(true, text, changes.some((x) => x.delta < 0 && !x.money) && !changes.some((x) => x.delta > 0) ? 'bad' : 'good', { changes, contact: met?.id ?? null });
}
