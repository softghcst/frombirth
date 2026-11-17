// Geography that every other system shares: a stable id for every city the
// game knows, where it is on the globe, which landmass it is on, what time it
// is there, what the season is, and which jurisdiction it belonged to in a
// given year. Countries and cities themselves are the World Engine's
// (data/countries.js, data/world.js); nothing here is a second copy of them.
//
//   place id   'jp'            a country (or territory) as a whole
//              'jp/Tokyo'      a city in it
//
// Coordinates come from GeoNames (data/coordinates.js, generated). A city
// GeoNames does not list uses its capital's position, and says so.
import { COUNTRIES } from '../data/countries.js';
import { PLACES } from '../data/world.js';
import { COORDINATES } from '../data/coordinates.js';
import { LANDMASS, ISLANDS, FIXED_LINKS, LANDLOCKED, JURISDICTIONS } from '../data/travel.js';
import { theCountry } from '../util.js';

/** A stable id for a city, or a whole country when no city is given. */
export const placeId = (countryId, city) => (city ? `${countryId}/${city}` : countryId);
/** The parts of a place id. */
export function parsePlace(id) {
  const i = String(id ?? '').indexOf('/');
  return i < 0 ? { countryId: id, city: null } : { countryId: id.slice(0, i), city: id.slice(i + 1) };
}

/** The capital as the game names it in the city list, if it is one of them. */
const capitalCity = (countryId) => {
  const c = COUNTRIES[countryId];
  const cap = COORDINATES[countryId]?.capital;
  return c?.cities.find((n) => cap && (cap === n || cap.startsWith(n))) ?? c?.cities[0] ?? null;
};
export { capitalCity };

/**
 * Where a place is. Exact for cities GeoNames lists; otherwise the capital's
 * position (approx: true); null for a place with no located city at all.
 * @returns {{lat:number, lon:number, approx:boolean}|null}
 */
export function coords(countryId, city) {
  const row = COORDINATES[countryId];
  if (!row) return null;
  const hit = (city && row.cities[city]) || null;
  if (hit) return { lat: hit[0], lon: hit[1], approx: false };
  const cap = row.cities[row.capital] ?? row.cities[capitalCity(countryId)] ?? Object.values(row.cities)[0];
  return cap ? { lat: cap[0], lon: cap[1], approx: true } : null;
}

/** Great-circle distance in km between two places. */
export function distanceKm(a, b) {
  const p = coords(a.countryId, a.city);
  const q = coords(b.countryId, b.city);
  if (!p || !q) return null;
  const rad = (d) => (d * Math.PI) / 180;
  const dlat = rad(q.lat - p.lat);
  const dlon = rad(q.lon - p.lon);
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(rad(p.lat)) * Math.cos(rad(q.lat)) * Math.sin(dlon / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** Which landmass a place is on. */
export function landmass(countryId) {
  for (const [id, list] of Object.entries(LANDMASS)) if (list.includes(countryId)) return id;
  if (ISLANDS.includes(countryId)) return `island:${countryId}`;
  return 'afroeurasia';
}
/** Whether two places can be reached from each other overland in a given year. */
export function overland(a, b, year) {
  const x = landmass(a);
  const y = landmass(b);
  if (x === y) return true;
  return FIXED_LINKS.some(([p, q, since]) => year >= since && ((p === x && q === y) || (p === y && q === x)));
}
export const coastal = (countryId) => !LANDLOCKED.includes(countryId);

/** The UN region of a place (Africa, Americas, Asia, Europe, Oceania). */
export const regionOf = (countryId) => PLACES[countryId]?.unRegion ?? null;
/** The IANA time zone of a place. */
export const timeZoneOf = (countryId) => PLACES[countryId]?.timeZone ?? 'UTC';

/**
 * The local date and time at a place for an instant (milliseconds since the
 * epoch). Uses the platform's time-zone database, so a flight across the
 * date line lands on the date it really is there.
 * @returns {{date:string, time:string, zone:string}}
 */
export function localTime(ms, countryId) {
  const zone = timeZoneOf(countryId);
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, zone };
  } catch {
    const d = new Date(ms).toISOString();
    return { date: d.slice(0, 10), time: d.slice(11, 16), zone: 'UTC' };
  }
}
/** The instant (ms) of a local date and time at a place. */
export function instantAt(date, time, countryId) {
  const guess = Date.parse(`${date}T${time}:00Z`);
  // Adjust by the zone's offset at that moment (twice, for the change of offset near a clock change).
  let t = guess;
  for (let i = 0; i < 2; i++) {
    const l = localTime(t, countryId);
    const shown = Date.parse(`${l.date}T${l.time}:00Z`);
    t += guess - shown;
  }
  return t;
}

/** The season at a place in a month (1-12), from which side of the equator it is on. */
export function season(countryId, month, city) {
  const c = coords(countryId, city);
  if (!c) return null;
  if (Math.abs(c.lat) < 15) return month >= 5 && month <= 10 ? 'the wet season' : 'the dry season';
  const north = c.lat >= 0;
  const s = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][month - 1];
  if (north) return s;
  return { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' }[s];
}
/** Broad climate, from latitude alone. A description for play, not a climate classification. */
export function climate(countryId, city) {
  const c = coords(countryId, city);
  if (!c) return null;
  const lat = Math.abs(c.lat);
  return lat < 23.5 ? 'tropical' : lat < 35 ? 'warm' : lat < 55 ? 'temperate' : 'cold';
}

/**
 * The jurisdiction a place was under in a year: the name to show for a
 * birth, a home or a journey then. Places with no recorded history keep
 * their present name for every year.
 * @returns {{countryId:string, name:string, historical:boolean}}
 */
export function jurisdictionAt(countryId, year, city) {
  const now = COUNTRIES[countryId]?.name ?? countryId;
  const j = JURISDICTIONS[countryId];
  if (!j || year == null) return { countryId, name: now, historical: false };
  const lines = (city && j.cities?.[city]) || j.history;
  // Lines are [last year, name], newest first: the earliest whose last year is not before `year` applies.
  let name = null;
  for (const [until, n] of lines) if (year <= until) name = n;
  return name ? { countryId, name, historical: true } : { countryId, name: now, historical: false };
}

/** A place for a sentence: "Osaka, Japan", or "Leipzig, East Germany (German Democratic Republic)" for 1980. */
export function placeName(countryId, city, year) {
  const j = jurisdictionAt(countryId, year, city);
  const name = j.historical ? j.name : theCountry(j.name).replace(/^the /, 'the ');
  return city ? `${city}, ${name}` : name;
}

/** Projects a position onto a map of the given size (equirectangular). */
export function project(lat, lon, w, h) {
  return { x: Math.round(((lon + 180) / 360) * w * 10) / 10, y: Math.round(((90 - lat) / 180) * h * 10) / 10 };
}
