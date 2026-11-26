// The Living Neighborhood Engine: where people live, who lives around them, and how that changes.
//
// One model, layered on what the save already has:
//   country and city      the player's own (p.countryId, p.city) and the cities of data/countries.js
//   neighborhood          state.hoods.list[id]    a saved instance of a profile (data/neighborhoods.js), in one city
//   block                 state.hoods.blocks[id]  a street of houses, a building of flats, or a lane of farms
//   home                  state.hoods.homes[id]   one dwelling: a house, or a unit in a building. A home the player
//                                                 owns points at the property (p.assets) by `asset`; ownership stays
//                                                 there, with its mortgage and value. The home records who owns it
//                                                 ('player', 'hh' = whoever lives there, 'landlord', 'family') and
//                                                 who lives there now (`hh`), and every household that ever did (`occ`).
//   household             state.hoods.hhs[id]     the people living together. Members are resident ids, the
//                                                 player's relatives' npc ids, or '@<archiveId>' for a player.
//   resident              state.hoods.res[id]     a compact, permanent record of someone who lives (or lived) in a
//                                                 neighborhood: name, birth year, household, work, temperament. The
//                                                 id is an npc id: meeting them makes the full person
//                                                 (state.npcs[id], ui Character Profile) with the same id, face and
//                                                 name. Nobody is made twice and nobody is renamed.
//
// Simulation tiers. Everyone ages by birth year. Neighborhoods where the family lives, or that hold people the
// family knows, are lived through month by month (moves, arrivals, births, deaths, events). One nobody has had
// anything to do with for thirty years is left as it was until someone goes back, when its missing years are lived
// through at once. Only the player's own neighborhood brings scenes. People met become full NPCs; the player's
// relationships with them are the ordinary ones (engine/relationships.js), and nothing here keeps a second copy.
//
// Time. What happens in a neighborhood in a year is worked out once, at the turn of that year, from the world and the
// date (never from the game's dice), as a plan with a month for everything. It is carried out as the calendar passes
// each month: all at once with year-long turns, a season at a time with shorter ones. Three-, six- and twelve-month
// turns therefore come to the same neighborhood, the same people and the same history.
import { store, player } from '../state.js';
import { clamp, cap } from '../util.js';
import { rng } from '../rng.js';
import { COUNTRIES } from '../data/countries.js';
import { PROFILES, HOME_TYPES, PROPERTY_HOODS, PROPERTY_HOME, VENUES, HOOD_NAMES, BUILDING_NAMES, LANDLORDS, SHAPES, MOVE_REASONS, INTERESTS, COMMUNITY_EVENTS, DISAGREEMENTS, FLAT_COUNTRIES, HOME_NAMES, STEP_FREE, BUILDING_ISSUES, PROJECTS, BUSINESS_VENUE } from '../data/neighborhoods.js';
import { needs as accessNeeds, homeRecord as accessHome } from './health/access.js';
import { STREETS } from '../data/properties.js';
import { seeded } from './sportsPlay.js';
import { coastal } from './geo.js';
import { cityOf } from './cities.js';
import { archiveIdOf, recordEvent } from './chronicle.js';
import { parentOccupations } from './history.js';
import { makeNpc } from './npcFactory.js';
import * as Talk from './neighborhoodTalk.js';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** A month as one number: year * 12 + month. */
export const T = (y, m = 0) => y * 12 + m;
const yearOf = (t) => Math.floor(t / 12);
const monthOfT = (t) => ((t % 12) + 12) % 12;
const worldOf = (state) => state?.worldId ?? state?.timeline?.root ?? state?.slotId ?? 'world';
const nowT = (state) => T(state.year, state.month ?? 0);
/** Keyed luck: the same for everyone in this world asking the same thing. Never the game's dice. */
export const luck = (state, key) => seeded(`hood/${worldOf(state)}/${key}`);
/** How many neighborhood scenes one year may bring the player. Neighbors are background, not a to-do list. */
export const SCENES_A_YEAR = 1;
/** Neighborhoods nobody in the family has had anything to do with for this many years rest until someone returns. */
const DORMANT_AFTER = 30;

// ---------- The record ----------

/** The neighborhood record of a save, created (empty) the first time it is asked for. */
export function hoods(state = store.state) {
  const H = (state.hoods ??= {});
  H.v ??= 1;
  H.seq ??= 0;
  H.list ??= {}; H.blocks ??= {}; H.homes ??= {}; H.hhs ??= {}; H.res ??= {};
  H.cur ??= null; // { sig, home, hh, since } where the player lives now
  H.past ??= []; // every residence of everyone in the family: { who, name, home, hood, from, to, why, with, knew }
  H.log ??= []; // the neighborhood chronicle: { t, h, k, text, who?, home?, ev? }
  H.plans ??= {}; // { [hoodId]: { y, ev: [...] } } this year's plan for each living neighborhood
  H.seen ??= {}; // { [storyKey]: t } scenes and stories already told
  H.acts ??= {}; // what the player has done this turn: { at, done: {} }
  H.groups ??= []; // friend groups: { id, name, h, m: [ids], since, to? }
  H.rep ??= {}; // { [hoodId]: { help, inv, host, trouble } } what people there have seen the player do
  H.disputes ??= []; // { id, h, res, kind, t, status }
  H.at ??= null; // the month the neighborhoods have been lived through to (exclusive)
  return H;
}

export const hoodOf = (id, state = store.state) => hoods(state).list[id] ?? null;
export const homeOf = (id, state = store.state) => hoods(state).homes[id] ?? null;
export const hhOf = (id, state = store.state) => hoods(state).hhs[id] ?? null;
export const resOf = (id, state = store.state) => hoods(state).res[id] ?? null;
export const blockOf = (id, state = store.state) => hoods(state).blocks[id] ?? null;
const meId = (p) => `@${archiveIdOf(p)}`;
export const isPlayerRef = (ref) => typeof ref === 'string' && ref.startsWith('@');

// ---------- Profiles and eras ----------

/** Whether a kind of neighborhood exists in a country in a year. */
export function profileAvailable(id, countryId, year) {
  const pr = PROFILES[id];
  if (!pr) return false;
  if (pr.where && !pr.where.includes(countryId)) return false;
  if (pr.coastal && !coastal(countryId)) return false;
  return year >= (pr.fromWhere?.[countryId] ?? pr.from);
}
export const homeTypeAvailable = (type, year) => year >= (HOME_TYPES[type]?.from ?? 0);
export const homeTypeName = (type, countryId) => HOME_NAMES[type]?.[countryId] ?? HOME_TYPES[type]?.nameWhere?.[countryId] ?? HOME_TYPES[type]?.name ?? cap(type);
/** The share of something being so in a year, from a table of [from-year, share] rows, newest first. */
const byYear = (rows, year) => (rows.find(([from]) => year >= from) ?? rows[rows.length - 1])[1];
/** Whether a country's towns and cities are mostly flats. */
export const flatCountry = (countryId) => FLAT_COUNTRIES.includes(countryId);
export const venueAvailable = (kind, year) => { const v = VENUES[kind]; return !!v && year >= (v.from ?? 0) && year <= (v.until ?? 9999); };
/** The name a community event goes by where it happens. */
export const eventName = (kind, countryId) => COMMUNITY_EVENTS[kind]?.names?.[countryId] ?? COMMUNITY_EVENTS[kind]?.name ?? kind;

// ---------- Ages, names, words ----------

export const ageOf = (r, state = store.state) => {
  const n = state.npcs?.[r.id];
  if (n && state.player.npcIds.includes(r.id)) return n.age;
  return Math.max(0, state.year - r.by);
};
export const fullName = (r) => `${r.f} ${r.l}`;
export const aliveRes = (r) => !!r && !r.dead;
/** Someone in a household: a resident, a relative of the player (npc) or the player. */
function personOf(state, ref) {
  if (isPlayerRef(ref)) return { kind: 'player', name: `${state.player.firstName} ${state.player.lastName}`, alive: state.player.alive, age: state.player.age };
  const r = state.hoods?.res?.[ref];
  const n = state.npcs?.[ref];
  if (r) return { kind: 'res', r, name: fullName(r), alive: aliveRes(r) && (n ? n.alive : true), age: ageOf(r, state) };
  if (n) return { kind: 'npc', n, name: `${n.firstName} ${n.lastName}`, alive: n.alive, age: n.age };
  return null;
}
const living = (state, hh) => (hh?.m ?? []).filter((ref) => personOf(state, ref)?.alive);

/** "a couple with two children": what anyone on the street can see about a household. */
export function composition(state, hh) {
  const people = living(state, hh).map((ref) => personOf(state, ref));
  const adults = people.filter((x) => x.age >= 18);
  const kids = people.filter((x) => x.age < 18);
  const n = (k) => ['no', 'one', 'two', 'three', 'four', 'five'][k] ?? String(k);
  if (!people.length) return 'nobody now';
  if (hh.kind === 'roommates' && adults.length >= 2 && !kids.length) return `${n(adults.length)} people sharing`;
  if (hh.kind === 'student') return 'a student';
  const old = adults.filter((x) => x.age >= 65).length;
  const young = adults.length - old;
  let s;
  if (adults.length === 1) s = old ? 'an older person living alone' : kids.length ? 'a parent' : 'someone living alone';
  else if (adults.length === 2 && old === 2) s = 'a retired couple';
  else if (adults.length === 2) s = 'a couple';
  else if (old && young) s = 'three generations';
  else s = `${n(adults.length)} adults`;
  if (kids.length) s += ` with ${kids.length === 1 ? 'a child' : `${n(kids.length)} children`}`;
  return s;
}

// ---------- Where the player lives ----------

/**
 * What kind of home the player has now, from the records that already say so: a property they own and live in
 * (p.homeId), a student hall, the family home (a child, or an adult living with their parents), or a rented place.
 * Null where neighbors do not apply (a palace, a prison cell): the last neighborhood is kept as it was.
 */
export function dwelling(state = store.state) {
  const p = state.player;
  if (!p?.alive || !p.city || !COUNTRIES[p.countryId]) return null;
  if (p.legal?.incarceration) return null;
  if (p.royal && !p.royal.waiting && ['monarch', 'heir', 'royal'].includes(p.royal.rank)) return null;
  const at = { countryId: p.countryId, city: p.city };
  const asset = p.homeId ? p.assets.find((a) => a.id === p.homeId && a.kind === 'property') : null;
  if (asset) return { ...at, kind: 'owned', assetId: asset.id, catalogId: asset.catalogId, sig: `owned|${at.countryId}|${at.city}|${asset.id}` };
  if (p.education?.enrolled && p.education.housing === 'dorm' && p.age >= 16) return { ...at, kind: 'dorm', sig: `dorm|${at.countryId}|${at.city}` };
  if (p.flags.livesWithParents || p.age < 18) return { ...at, kind: 'family', sig: `family|${at.countryId}|${at.city}` };
  return { ...at, kind: 'rent', sig: `rent|${at.countryId}|${at.city}` };
}

/** The home the player lives in now, or null. */
export const currentHome = (state = store.state) => { const H = hoods(state); return H.cur ? H.homes[H.cur.home] ?? null : null; };
export const currentHood = (state = store.state) => { const h = currentHome(state); return h ? H_(state).list[h.h] : null; };
const H_ = (state) => hoods(state);

// ---------- Making neighborhoods ----------

function nameHood(state, r, profileId, city) {
  const used = new Set(Object.values(H_(state).list).filter((x) => x.city === city).map((x) => x.name));
  for (let i = 0; i < 12; i++) {
    let name;
    if (profileId === 'rural') name = r.pick(HOOD_NAMES.rural);
    else if (profileId === 'university') name = r.pick(HOOD_NAMES.university);
    else if (profileId === 'coastal') name = r.pick(HOOD_NAMES.coastal);
    else if (profileId === 'historic') name = r.pick(HOOD_NAMES.historic);
    else if (['downtown', 'urban', 'apartments', 'mixed'].includes(profileId)) name = r.pick(HOOD_NAMES.urban);
    else name = `${r.pick(HOOD_NAMES.first)} ${r.pick(HOOD_NAMES.suffix)}`;
    name = cap(name);
    if (!used.has(name)) return name;
  }
  return `${cap(r.pick(HOOD_NAMES.first))} ${r.pick(HOOD_NAMES.suffix)} ${H_(state).seq}`;
}

/** A new neighborhood of a profile in a city. Its name, character and local places are fixed from then on. */
export function makeHood(state, countryId, city, profileId) {
  const H = hoods(state);
  const id = `h${++H.seq}`;
  const r = luck(state, `make/${id}/${countryId}/${city}`);
  const pr = PROFILES[profileId];
  const year = state.year;
  const gauge = Object.fromEntries(Object.entries(pr.gauge).map(([k, v]) => [k, clamp(Math.round(v + r.int(-12, 12)))]));
  const cityHousing = cityOf(countryId, city).housing ?? 1;
  const hood = { id, c: countryId, city, p: profileId, name: nameHood(state, r, profileId, city), est: Math.max(pr.fromWhere?.[countryId] ?? pr.from, year - r.int(8, 110)),
    g: gauge, cost: Math.round(pr.cost * cityHousing * 100) / 100, blocks: [], venues: [], nr: 0, nh: 0, nb: 0, nv: 0, sim: year - 1, since: year, last: year };
  H.list[id] = hood;
  const kinds = r.shuffle(pr.venues.filter((k) => venueAvailable(k, year))).slice(0, r.int(3, 5));
  for (const k of kinds) addVenue(state, hood, k, r, year - r.int(0, Math.max(0, year - hood.est)));
  return hood;
}

function addVenue(state, hood, kind, r, opened) {
  const v = VENUES[kind];
  const taken = new Set(hood.venues.map((x) => x.name));
  const name = r.shuffle(v.names).find((n) => !taken.has(n)) ?? `${v.name} ${hood.nv + 1}`;
  const venue = { id: `${hood.id}v${++hood.nv}`, k: kind, name, owner: null, from: Math.max(opened, v.from ?? 0), to: null };
  venue.sf = r.chance(byYear(STEP_FREE.venue, opened) * (v.public ? 1.15 : 1)); // a level way in
  hood.venues.push(venue);
  return venue;
}

/** A street, a building or a lane in a neighborhood, with its homes, every one but `keep` lived in or for let. */
function makeBlock(state, hood, homeType, year = state.year, fresh = false) {
  const H = hoods(state);
  const pr = PROFILES[hood.p];
  const r = luck(state, `block/${hood.id}/${hood.nb + 1}`);
  const id = `${hood.id}b${++hood.nb}`;
  const floors = HOME_TYPES[homeType]?.floors;
  const kind = floors ? 'building' : pr.block === 'building' ? 'street' : pr.block;
  const size = r.int(pr.size[0], pr.size[1]);
  const street = r.pick(STREETS);
  const tree = r.pick(HOOD_NAMES.first);
  const block = { id, h: hood.id, kind, homes: [], est: fresh ? year : Math.max(hood.est, year - r.int(5, 90)), n0: r.int(0, 30) * 2 + 1 };
  if (kind === 'building') {
    block.name = r.pick(BUILDING_NAMES).replace('{street}', street).replace('{tree}', tree).replace('{n}', String(r.int(2, 140)));
    block.fl = Math.max(2, Math.ceil(size / 3));
    block.condo = homeType === 'condo';
    block.ll = block.condo ? null : r.pick(LANDLORDS);
    block.areas = r.shuffle(['the courtyard', 'the laundry room', 'the roof terrace', 'the lobby', 'the bike store', 'the garden']).slice(0, 2);
    block.lift = Math.ceil(size / 3) >= 3 && r.chance(byYear(STEP_FREE.lift, block.est));
  } else {
    block.name = street;
  }
  H.blocks[id] = block;
  hood.blocks.push(id);
  // Where towns and cities are mostly flats, more of a street is flats too.
  const types = pr.homes.filter(([t]) => homeTypeAvailable(t, year)).map(([t, w]) => [t, w * (flatCountry(hood.c) && HOME_TYPES[t]?.floors && hood.p !== 'rural' ? 2.5 : 1)]);
  const n = kind === 'building' ? block.fl * 3 : size;
  for (let i = 0; i < n; i++) {
    const t = kind === 'building' ? (homeType === 'student' ? 'student' : homeType === 'condo' ? 'condo' : r.chance(0.15) ? 'shared' : homeType === 'shared' ? 'apartment' : homeType)
      : (i === 0 ? homeType : weightedPick(r, types.filter(([x]) => !HOME_TYPES[x].floors).length ? types.filter(([x]) => !HOME_TYPES[x].floors) : [[homeType, 1]]));
    const home = { id: `${id}u${i + 1}`, h: hood.id, b: id, t: kind === 'building' ? t : t, i: kind === 'building' ? i % 3 : i, occ: [], hh: null, own: 'landlord' };
    if (kind === 'building') { home.fl = Math.floor(i / 3) + 1; home.label = `Apartment ${home.fl}${'ABC'[i % 3]}`; } else home.label = `No. ${block.n0 + i * 2}`;
    // Getting in: a ground-floor flat, a flat in a building with a lift, or a house built or altered to be level.
    home.sf = kind === 'building' ? home.fl === 1 ? r.chance(STEP_FREE.groundFloor) : !!block.lift : r.chance(byYear(STEP_FREE.home, block.est));
    H.homes[home.id] = home;
    block.homes.push(home.id);
  }
  return block;
}
const weightedPick = (r, list) => { const total = list.reduce((s, [, w]) => s + w, 0); let x = r.next() * total; for (const [v, w] of list) { x -= w; if (x <= 0) return v; } return list[list.length - 1][0]; };

/** Fills the empty homes of a block with households, leaving a few to let. `spare` homes are kept empty. */
function populate(state, block, spare = []) {
  const r = luck(state, `populate/${block.id}`);
  const hood = H_(state).list[block.h];
  for (const id of block.homes) {
    if (spare.includes(id)) continue;
    const home = H_(state).homes[id];
    if (home.hh || r.chance(0.12)) continue;
    const hh = makeHousehold(state, hood, home, luck(state, `hh/${home.id}/first`), { since: T(state.year - r.int(0, Math.max(0, Math.min(45, state.year - block.est))), r.int(0, 11)) });
    settleIn(state, home, hh, hh.from, 'lived here');
  }
}

/** A new household of real, named people, for a home. Nobody in it is anyone already in the world. */
export function makeHousehold(state, hood, home, r, o = {}) {
  const H = hoods(state);
  const c = COUNTRIES[hood.c];
  const year = state.year;
  const shapes = SHAPES.map(([s, w]) => [s, w * (home.t === 'student' ? (s === 'single' ? 6 : 0) : HOME_TYPES[home.t]?.floors ? ({ roommates: 2.2, single: 1.6, family: 0.6, multigen: 0.6 }[s] ?? 1) : home.t === 'rural' ? ({ roommates: 0.2, family: 1.3, multigen: 1.6 }[s] ?? 1) : 1)]);
  const shape = o.shape ?? (home.t === 'student' ? 'student' : weightedPick(r, shapes.filter(([, w]) => w > 0)));
  // A family name nobody else on the street has, where the country's list allows: neighbors are not relatives.
  const taken = new Set([state.player?.lastName, ...Object.values(H.hhs).filter((x) => x.h === hood.id && x.to == null).map((x) => x.n)]);
  const last = r.shuffle(c.names.last).find((x) => !taken.has(x)) ?? r.pick(c.names.last);
  const hh = { id: `${hood.id}x${++hood.nh}`, n: last, h: hood.id, home: null, m: [], from: o.since ?? nowT(state), kind: shape, own: false };
  const person = (g, age, lastName = last, extra = {}) => {
    const id = `npc_${hood.id}r${++hood.nr}`;
    const gender = g ?? r.pick(['male', 'female']);
    const pool = c.names[gender] ?? c.names.female;
    const taken = new Set(hh.m.map((x) => H.res[x]?.f));
    const first = r.shuffle(pool).find((n) => !taken.has(n)) ?? r.pick(pool);
    const by = year - age;
    const res = { id, f: first, l: lastName, g: gender, by, hh: hh.id, so: r.pick(['outgoing', 'outgoing', 'reserved', 'reserved', 'busy', 'family']),
      in: r.shuffle(INTERESTS.filter(([, , from]) => !from || year >= from)).slice(0, r.int(1, 2)).map(([k]) => k),
      ls: Math.round(clamp(r.normal(year < 1950 ? 70 : 80, 10), Math.min(52, age + 6), 103)), ...extra };
    if (res.ls <= age) res.ls = age + r.int(2, 15);
    res.job = jobFor(r, age, year, shape);
    if (age >= 4 && age < 18) res.school = r.chance(0.7); // goes to the local school
    H.res[id] = res;
    hh.m.push(id);
    return res;
  };
  const adultAge = (lo, hi) => r.int(lo, hi);
  const kids = (n, parentAge) => { for (let i = 0; i < n; i++) person(null, r.int(0, Math.max(0, Math.min(17, parentAge - 20)))); };
  switch (shape) {
    case 'family': { const a = adultAge(26, 52); person('female', a); person('male', clamp(a + r.int(-4, 5), 22, 70)); kids(r.int(1, 3), a); break; }
    case 'couple': { const a = adultAge(22, 60); person('female', a, r.chance(0.3) ? r.pick(c.names.last) : last); person('male', clamp(a + r.int(-5, 6), 20, 75)); break; }
    case 'single': person(null, adultAge(21, 64)); break;
    case 'retired': { const a = adultAge(64, 86); person('female', a); person('male', clamp(a + r.int(-3, 5), 60, 95)); break; }
    case 'singleParent': { const a = adultAge(24, 50); person(null, a); kids(r.int(1, 2), a); break; }
    case 'roommates': { person(null, adultAge(19, 34)); person(null, adultAge(19, 34), r.pick(c.names.last)); if (r.chance(0.3)) person(null, adultAge(19, 34), r.pick(c.names.last)); break; }
    case 'multigen': { const a = adultAge(32, 55); person(null, a); person(null, clamp(a + r.int(24, 32), 55, 98)); if (r.chance(0.6)) kids(r.int(1, 2), a); break; }
    case 'elder': person(null, adultAge(70, 92)); break;
    case 'student': person(null, adultAge(18, 23), last, { job: 'Student' }); break;
    default: person(null, adultAge(25, 60));
  }
  if (o.kidNear != null && !hh.m.some((id) => Math.abs(ageOf(H.res[id], state) - o.kidNear) <= 2)) {
    // A street with a child near the player's age: one of this family's children is that age.
    const kid = hh.m.map((id) => H.res[id]).find((x) => ageOf(x, state) < 18);
    if (kid) { kid.by = year - clamp(o.kidNear + r.int(-1, 1), 0, 17); kid.school = kid.by <= year - 4; fixParents(H, hh, kid, r); }
  }
  if (r.chance(home.t === 'rural' ? 0.6 : HOME_TYPES[home.t]?.floors ? 0.2 : 0.4)) {
    const s = r.pick(['dog', 'dog', 'cat', 'cat', 'rabbit']);
    hh.pet = { n: r.pick({ dog: ['Biscuit', 'Max', 'Luna', 'Rex', 'Pepper', 'Bella'], cat: ['Mittens', 'Shadow', 'Tiger', 'Mochi', 'Smokey'], rabbit: ['Clover', 'Thumper', 'Hazel'] }[s]), s, by: year - r.int(0, 9) };
  }
  hh.own = home.t === 'student' || shape === 'roommates' ? false : r.chance({ house: 0.72, townhouse: 0.6, duplex: 0.5, rural: 0.8, condo: 0.75, apartment: 0.25, shared: 0, trailer: 0.6 }[home.t] ?? 0.4);
  H.hhs[hh.id] = hh;
  return hh;
}

/** A child made older keeps parents old enough to be theirs. */
function fixParents(H, hh, kid, r) {
  for (const id of hh.m) {
    const a = H.res[id];
    if (!a || a.id === kid.id || a.by > kid.by - 16) {
      if (a && a.id !== kid.id && kid.by - a.by < 18 && (a.by <= kid.by || kid.by - a.by < 18) && hh.m.indexOf(a.id) < hh.m.indexOf(kid.id)) { a.by = kid.by - 18 - r.int(0, 12); if (a.ls < kid.by - a.by + 20) a.ls += 15; }
    }
  }
}

function jobFor(r, age, year, shape) {
  if (age < 16) return null;
  if (age >= 67 || (age >= 62 && r.chance(0.5))) return 'Retired';
  if (age <= 23 && (shape === 'student' || shape === 'roommates' || r.chance(0.4)) && year >= 1900) return 'Student';
  const jobs = parentOccupations(year);
  return r.pick(jobs)?.title ?? 'Worker';
}

/** A household moves into a home: the home's record of who lived there, and who owns it. */
function settleIn(state, home, hh, t, why = 'moved in') {
  if (home.hh && home.hh !== hh.id) leaveHome(state, home, t, 'moved out');
  home.hh = hh.id;
  hh.home = home.id;
  hh.h = home.h;
  if (home.own !== 'player' && home.own !== 'family') home.own = hh.own ? 'hh' : 'landlord';
  home.occ.push({ hh: hh.id, n: hh.n, from: t, to: null, why });
}
/** Whoever lives in a home leaves it: the record keeps them, as having lived there. */
function leaveHome(state, home, t, why = 'moved out') {
  const o = home.occ.find((x) => x.hh === home.hh && x.to == null);
  if (o) { o.to = t; o.left = why; }
  const hh = H_(state).hhs[home.hh];
  if (hh && hh.home === home.id) hh.home = null;
  home.hh = null;
  if (home.own === 'hh') home.own = 'landlord'; // sold on: a new owner until someone moves in
}

// ---------- Choosing where the player lives ----------

/** The kinds of neighborhood that suit a home in a city, best first, as the year allows. */
function profilesFor(state, d, p) {
  const c = d.countryId;
  const y = state.year;
  const city = cityOf(c, d.city);
  const big = city.kind !== 'city' || (COUNTRIES[c]?.cities.length ?? 1) <= 1;
  let list;
  if (d.kind === 'owned') list = PROPERTY_HOODS[d.catalogId] ?? ['suburban', 'smalltown'];
  else if (d.kind === 'dorm') list = ['university'];
  else if (d.kind === 'rent') {
    if (p.education?.enrolled && ['university', 'college', 'grad', 'postgrad'].some((s) => String(p.education.stage ?? '').includes(s))) list = ['university', 'urban', 'apartments'];
    else if (p.age < 30) list = big ? ['urban', 'apartments', 'mixed', 'downtown'] : ['urban', 'smalltown', 'apartments'];
    else list = big ? ['urban', 'apartments', 'mixed', 'suburban'] : ['smalltown', 'suburban', 'urban'];
  } else {
    // The family home: what the family can afford and where they live.
    const r = luck(state, `family/${archiveIdOf(p)}/${c}/${d.city}`);
    const wealth = Math.max(0, ...p.npcIds.map((id) => state.npcs[id]).filter((n) => n?.role === 'parent').map((n) => n.wealth ?? n.meters?.money ?? 40));
    const parents = p.npcIds.map((id) => state.npcs[id]).filter((n) => n?.role === 'parent');
    const farm = parents.some((n) => /farm|shepherd|herd|fisher|planter|rancher/i.test(n.occupation ?? ''));
    if (farm) list = ['rural', 'smalltown'];
    else if (wealth >= 65) list = r.chance(0.5) ? ['suburban', 'historic', 'coastal'] : ['historic', 'suburban'];
    else if (!big) list = r.chance(0.5) ? ['smalltown', 'suburban'] : ['suburban', 'urban'];
    else list = r.chance(flatCountry(c) ? 0.85 : 0.5) ? ['apartments', 'urban', 'mixed'] : ['suburban', 'urban', 'smalltown'];
  }
  if (flatCountry(c) && d.kind === 'rent') list = list.filter((x) => x !== 'suburban').concat(['suburban']);
  const ok = list.filter((x) => profileAvailable(x, c, y));
  return ok.length ? ok : ['urban', 'smalltown'].filter((x) => profileAvailable(x, c, y)).concat(['smalltown']);
}

/** What type of home, in a profile: the property's own, or what the profile mostly has. */
function homeTypeFor(state, d, profileId, p) {
  if (d.kind === 'owned') return PROPERTY_HOME[d.catalogId] ?? 'house';
  if (d.kind === 'dorm') return 'student';
  const pr = PROFILES[profileId];
  const r = luck(state, `type/${archiveIdOf(p)}/${d.sig}/${state.year}`);
  if (d.kind === 'rent' && p.flags?.sharedHousing) return HOME_TYPES.shared && pr.block === 'building' ? 'shared' : 'apartment';
  const options = pr.homes.filter(([t]) => homeTypeAvailable(t, state.year) && t !== 'student' && (d.kind !== 'rent' || t !== 'rural'));
  return options.length ? weightedPick(r, options) : 'house';
}

/** A home for the player in this city: an empty one in a neighborhood that already exists, or a new street. */
export function findHome(state, d, o = {}) {
  const H = hoods(state);
  const p = state.player;
  const profiles = o.profile ? [o.profile] : profilesFor(state, d, p);
  const type = o.type ?? homeTypeFor(state, d, profiles[0], p);
  const floors = !!HOME_TYPES[type]?.floors;
  const here = Object.values(H.list).filter((x) => x.c === d.countryId && x.city === d.city);
  const prefer = o.hood ? [H.list[o.hood]].filter(Boolean) : [...here.filter((x) => x.id === currentHome(state)?.h), ...here].filter((x) => profiles.includes(x.p));
  for (const hood of prefer) {
    wake(state, hood);
    for (const bid of hood.blocks) {
      const b = H.blocks[bid];
      if (floors !== (b.kind === 'building')) continue;
      const empty = b.homes.map((id) => H.homes[id]).filter((h) => !h.hh && h.t === type && h.id !== currentHome(state)?.id && !h.asset);
      // Someone who needs a level way in is offered the homes that have one first.
      const free = (needsStepFree(state) ? empty.find((h) => stepFree(state, h)) : null) ?? empty[0];
      if (free) return free;
    }
    // A street in a neighborhood the player already knows, not yet seen: a new block there.
    if (o.hood || hood.blocks.length < 4) return newBlockHome(state, hood, type, p);
  }
  const hood = makeHood(state, d.countryId, d.city, profiles.find((x) => !here.some((h) => h.p === x)) ?? profiles[0]);
  return newBlockHome(state, hood, type, p);
}

function newBlockHome(state, hood, type, p) {
  const block = makeBlock(state, hood, type);
  const H = hoods(state);
  const r = luck(state, `spot/${block.id}`);
  const homes = block.homes.map((id) => H.homes[id]);
  const fits = homes.filter((h) => h.t === type);
  let mine = (fits.length ? r.pick(fits.slice(Math.min(1, fits.length - 1))) : homes[Math.min(1, homes.length - 1)]);
  if (needsStepFree(state)) mine = fits.find((h) => stepFree(state, h)) ?? mine;
  mine.t = type;
  populate(state, block, [mine.id]);
  // A child moving in: most streets have someone their age.
  const kidAge = p.age < 16 ? p.age : null;
  if (kidAge != null && r.chance(0.75)) {
    const near = homes.filter((h) => h.hh).map((h) => H.hhs[h.hh]).some((hh) => hh.m.some((id) => H.res[id] && Math.abs(ageOf(H.res[id], state) - kidAge) <= 2));
    if (!near) {
      const spot = homes.filter((h) => h.id !== mine.id && !h.hh).concat(homes.filter((h) => h.id !== mine.id && h.hh && ['family', 'singleParent'].includes(H.hhs[h.hh]?.kind)))[0];
      if (spot) {
        if (spot.hh) { const hh = H.hhs[spot.hh]; const kid = hh.m.map((id) => H.res[id]).find((x) => x && ageOf(x, state) < 18); if (kid) { kid.by = state.year - clamp(kidAge + r.int(-1, 1), 0, 17); kid.school = kid.by <= state.year - 4; fixParents(H, hh, kid, r); } }
        else { const hh = makeHousehold(state, hood, spot, luck(state, `hh/${spot.id}/kid`), { shape: 'family', kidNear: kidAge, since: T(state.year - r.int(1, 8), r.int(0, 11)) }); settleIn(state, spot, hh, hh.from, 'lived here'); }
      }
    }
  }
  // A building has someone who looks after it: a manager who lives in, where there is one.
  if (block.kind === 'building' && !block.mgr) {
    const inside = block.homes.map((id) => H.homes[id]).filter((h) => h.hh).flatMap((h) => H.hhs[h.hh].m).map((id) => H.res[id]).filter((x) => x && ageOf(x, state) >= 30 && x.job !== 'Student');
    if (inside.length && !block.condo) { const m = r.pick(inside); block.mgr = m.id; }
  }
  // Local places have owners: someone living here, or someone from elsewhere in the city.
  for (const v of hood.venues) if (!v.owner && !VENUES[v.k].public) {
    const adults = Object.values(H.res).filter((x) => H.hhs[x.hh]?.h === hood.id && aliveRes(x) && ageOf(x, state) >= 25 && ageOf(x, state) < 70 && x.job !== 'Student' && !x.owns);
    if (adults.length && r.chance(0.45)) { const o = r.pick(adults); o.owns = v.id; o.job = `Owner of ${v.name}`; v.owner = o.id; } else {
      const o = makeOutsider(state, hood, r, { job: `Owner of ${v.name}`, owns: v.id });
      v.owner = o.id;
    }
  }
  return mine;
}

/** Someone who works in a neighborhood and lives elsewhere in the city: a resident record with no household there. */
function makeOutsider(state, hood, r, extra, year = state.year) {
  const H = hoods(state);
  const c = COUNTRIES[hood.c];
  const g = r.pick(['male', 'female']);
  const age = r.int(28, 62);
  const res = { id: `npc_${hood.id}r${++hood.nr}`, f: r.pick(c.names[g] ?? c.names.female), l: r.pick(c.names.last), g, by: year - age, hh: null, so: r.pick(['outgoing', 'reserved', 'busy']),
    in: [r.pick(INTERESTS)[0]], ls: Math.round(clamp(r.normal(80, 9), age + 5, 103)), elsewhere: true, h: hood.id, ...extra };
  H.res[res.id] = res;
  return res;
}

// ---------- The player's household ----------

/** Who lives with the player now, from the records that say so. */
function housemates(state, d) {
  const p = state.player;
  const out = [];
  const npcs = p.npcIds.map((id) => state.npcs[id]).filter((n) => n?.alive);
  if (d.kind === 'family') {
    const away = p.flags.parentsStatus === 'separated';
    for (const n of npcs) {
      if (n.role === 'parent' && !(away && n.gender === 'male')) out.push(n.id);
      else if (n.role === 'sibling' && n.age < 18 && !n.flags.abroad) out.push(n.id);
      else if (p.flags.care?.guardianId === n.id) out.push(n.id);
    }
  } else if (d.kind !== 'dorm') {
    for (const n of npcs) {
      if (n.role === 'spouse' || (n.role === 'partner' && n.flags.livingTogether)) out.push(n.id);
      else if (n.role === 'child' && n.age < 18 && !n.flags.abroad && !n.flags.custody) out.push(n.id);
      else if (n.id === hoods(state).roommate) out.push(n.id);
    }
  }
  return out;
}

/** Keeps the player's household as it is: who has moved in with them (a spouse who was a neighbor), and who has not. */
export function syncHousehold(state = store.state) {
  const H = hoods(state);
  const d = dwelling(state);
  if (!H.cur || !d) return;
  const hh = H.hhs[H.cur.hh];
  if (!hh) return;
  const want = [meId(state.player), ...housemates(state, d)];
  const home = H.homes[hh.home];
  // Who moves in and out of the player's home is plain to see from next door (engine/neighborhoodTalk.js).
  // Only the player's own home, as an adult: a sibling leaving the family home is the family's business.
  const seen = (kind, words) => { if (home && hh.me && state.player.age >= 18 && H.cur.since < nowT(state)) Talk.hear(state, home.h, kind, Talk.watchers(state, home.id), words); };
  for (const id of want) if (!hh.m.includes(id) && !isPlayerRef(id)) { const n = state.npcs[id]; seen(n?.role === 'child' && n.age <= 1 ? 'baby' : 'partner', { partner: ['spouse', 'partner'].includes(n?.role) }); }
  for (const id of hh.m) if (!want.includes(id) && !isPlayerRef(id) && personOf(state, id)?.alive) { const n = state.npcs[id]; seen('left', { partner: ['spouse', 'partner', 'ex'].includes(n?.role) || !!n?.flags?.wasSpouse }); }
  for (const id of want) if (!hh.m.includes(id)) {
    // Someone who lived elsewhere in the world moves in: they leave their own household (a neighbor who married the player).
    const r = H.res[id];
    if (r?.hh && r.hh !== hh.id) {
      const old = H.hhs[r.hh];
      old.m = old.m.filter((x) => x !== id);
      note(state, { t: nowT(state), h: old.h, k: 'left', text: `${r.f} ${r.l} moved out to live with ${state.player.firstName}.`, who: id, home: old.home });
      if (!living(state, old).length && old.home) { const home = H.homes[old.home]; old.to = nowT(state); leaveHome(state, home, nowT(state), 'moved out'); }
      r.hh = hh.id;
    }
    hh.m.push(id);
  }
  const keep = new Set(want);
  hh.m = hh.m.filter((id) => keep.has(id));
}

// ---------- Moving ----------

/**
 * Brings the neighborhood record into line with where the player lives now: the first time, after a move made
 * anywhere in the game (buying a house, a new city, leaving home, emigrating), and after the turn of a year. Running it
 * again changes nothing.
 */
export function settle(state = store.state, { quiet = false } = {}) {
  if (!quiet) return settleNow(state);
  // Loading a save only brings the neighborhood up to date: no scene is queued (or used up) by opening a game.
  muted = true;
  try { return settleNow(state); } finally { muted = false; }
}

/** While a save is being loaded: scenes are not queued, and not marked as seen, so they can still come in play. */
let muted = false;

function settleNow(state) {
  if (!state?.player) return null;
  const H = hoods(state);
  H.at ??= nowT(state);
  const d = dwelling(state);
  if (!d) return H.cur;
  if (H.cur?.sig === d.sig && H.homes[H.cur.home]) { syncHousehold(state); return H.cur; }
  // Back to the family home: the parents' household still lives where it did.
  const fam = d.kind === 'family' && H.family ? H.hhs[H.family] : null;
  const famHome = fam?.home && H.homes[fam.home];
  const home = famHome && H.list[famHome.h]?.city === d.city && H.list[famHome.h]?.c === d.countryId && famHome.hh === fam.id ? famHome : findHome(state, d);
  moveInto(state, home, d, null);
  return H.cur;
}

/**
 * The player (and whoever lives with them) moves into a home. The old home keeps the record of their years there.
 * Friendships are untouched: the people stay in the player's life, and acquaintances become former neighbors.
 */
export function moveInto(state, home, d = dwelling(state), why = null) {
  const H = hoods(state);
  const p = state.player;
  const t = nowT(state);
  const me = meId(p);
  const prev = H.cur ? H.homes[H.cur.home] : null;
  const prevHh = H.cur ? H.hhs[H.cur.hh] : null;
  const prevKind = H.cur?.sig?.split('|')[0] ?? null;
  const hood = H.list[home.h];
  wake(state, hood);
  let hh;
  // Who moves: a child moves with the family; an adult leaving home leaves their parents' household where it is.
  if (prevHh && (prevKind === d.kind || (prevKind !== 'family' && d.kind !== 'family'))) {
    hh = prevHh;
    if (prev && prev.hh === hh.id) {
      // Everyone in the household goes: unless they stay (an adult leaving the family home, below).
      leaveHome(state, prev, t, why ?? 'moved away');
    }
  } else {
    if (prevHh) {
      prevHh.m = prevHh.m.filter((x) => x !== me);
      if (!living(state, prevHh).length && prev && prev.hh === prevHh.id) { leaveHome(state, prev, t, 'moved away'); prevHh.to = t; }
    }
    const existing = d.kind === 'family' && H.family && H.hhs[H.family]?.home ? H.hhs[H.family] : null;
    if (existing && H.homes[existing.home]?.h && H.list[H.homes[existing.home].h]?.city === d.city && existing.home === home.id) hh = existing;
    else {
      hh = { id: `${hood.id}x${++hood.nh}`, n: p.lastName, h: hood.id, home: null, m: [], from: t, kind: d.kind === 'family' ? 'family' : 'player', own: d.kind === 'owned', me: true };
      if (d.kind === 'family') { hh.fam = true; H.family = hh.id; }
      H.hhs[hh.id] = hh;
    }
  }
  if (!hh.m.includes(me)) hh.m.push(me);
  if (home.hh && home.hh !== hh.id) {
    const other = H.hhs[home.hh];
    if (other && !other.me && !other.fam) { other.to = t; other.gone = { t, why: 'moved out' }; for (const id of other.m) if (H.res[id]) { H.res[id].hh = null; H.res[id].gone = { t, city: hood.city, c: hood.c }; } }
  }
  if (home.hh !== hh.id) settleIn(state, home, hh, t, why ?? (prev ? 'moved in' : 'lived here'));
  hh.own = d.kind === 'owned';
  if (d.kind === 'owned') { home.own = 'player'; home.asset = d.assetId; } else if (d.kind === 'family') home.own = 'family';
  else if (home.own === 'player') home.own = 'landlord';
  const from = H.cur?.home ?? null;
  H.cur = { sig: d.sig, home: home.id, hh: hh.id, since: t };
  syncHousehold(state);
  // The family's record of where it has lived: everyone moving, each their own line.
  const movers = hh.m.filter((ref) => personOf(state, ref)?.alive && (isPlayerRef(ref) || !H.res[ref]));
  for (const ref of movers) {
    const who = isPlayerRef(ref) ? ref.slice(1) : archiveIdOf(state.npcs[ref]);
    const open = H.past.find((x) => x.who === who && x.to == null);
    if (open && open.home === home.id) continue;
    if (open) { open.to = t; open.knew = knewThere(state, open.hood, ref); }
    H.past.push({ who, name: personOf(state, ref)?.name, home: home.id, hood: hood.id, from: t, to: null, why: why ?? (prev ? 'moved' : 'lived'), with: movers.filter((x) => x !== ref).map((x) => personOf(state, x)?.name).filter(Boolean) });
  }
  // People the player knows who stay behind: friends stay friends; everyone else is now a former neighbor.
  if (prev && prev.h !== home.h) afterMoving(state, prev.h);
  if (prev) markKnown(state, prev.h);
  // Where they have lived (engine/globalStory.js): this neighborhood, beside the city.
  const loc = p.locations?.[p.locations.length - 1];
  if (loc && loc.to == null) { (loc.hoods ??= []); if (!loc.hoods.includes(hood.id)) loc.hoods.push(hood.id); }
  if (prev) Talk.hear(state, hood.id, 'moved_in', Talk.watchers(state, home.id), { at: `to ${home.label}` }, t);
  if (prev || why) {
    const ev = store.state === state ? recordEvent({ key: `hood:move:${archiveIdOf(p)}:${home.id}:${t}`, type: 'home_move', title: `Moved to ${hood.name}`,
      text: `${homeTypeName(home.t, hood.c)} in ${hood.name}, ${hood.city}.`, place: { countryId: hood.c, city: hood.city }, propertyId: home.asset ?? null, significance: 1, privacy: 'family' }) : null;
    note(state, { t, h: hood.id, k: 'player_in', text: `${p.firstName} ${p.lastName}${hh.m.length > 1 ? ' and family' : ''} moved in, to ${home.label} on ${H.blocks[home.b].name}.`, who: me, home: home.id, ev: ev?.id });
  } else note(state, { t, h: hood.id, k: 'player_in', text: `${p.firstName} ${p.lastName} lived at ${home.label} on ${H.blocks[home.b].name}.`, who: me, home: home.id });
  hood.last = state.year;
  // Somebody the player already knows lives here.
  const familiar = knownIn(state, hood.id).filter((n) => n.meters.relationship >= 25);
  if (prev && familiar.length) queueScene(state, 'hood_familiar_face', { person: familiar[0].id }, `face/${familiar[0].id}/${hood.id}`, t);
  return { home, hood, from };
}

/** The people the player has met who live (or lived) in a neighborhood, as full NPCs. */
export function knownIn(state, hoodId, { current = true } = {}) {
  const H = hoods(state);
  return Object.values(H.res).filter((r) => {
    if (!state.npcs[r.id]?.alive) return false;
    const home = H.homes[H.hhs[r.hh]?.home];
    return current ? home?.h === hoodId : true;
  }).map((r) => state.npcs[r.id]).filter((n) => state.player.npcIds.includes(n.id));
}
function knewThere(state, hoodId) {
  return knownIn(state, hoodId).filter((n) => n.meters.relationship >= 45).map((n) => ({ id: n.id, name: `${n.firstName} ${n.lastName}`, role: n.role }));
}
/** Records that everyone met in a neighborhood knew this player: their family's friends, remembered by later generations. */
function markKnown(state, hoodId) {
  const H = hoods(state);
  const me = archiveIdOf(state.player);
  for (const n of knownIn(state, hoodId)) {
    const r = H.res[n.id];
    if (r && n.meters.relationship >= 40) (r.fam ??= {})[me] = n.role === 'friend' ? 'friend' : 'neighbor';
  }
}
function afterMoving(state, hoodId) {
  const p = state.player;
  for (const n of knownIn(state, hoodId)) {
    if (n.role !== 'neighbor') continue;
    if (n.meters.relationship < 45) { p.npcIds = p.npcIds.filter((id) => id !== n.id); n.flags.drifted = { year: state.year, age: p.age, role: 'neighbor' }; }
    else n.flags.title = 'Former neighbor';
  }
}

// ---------- People ----------

/**
 * Makes the full person for a resident: the same id, name, age and household, with a face and meters of their own
 * chosen from their id (so they look the same whenever they are met). Does not put them in the player's life.
 */
export function materialize(state, resId) {
  const H = hoods(state);
  const r = H.res[resId];
  if (!r) return null;
  if (state.npcs[resId]) { const n = state.npcs[resId]; if (!state.player.npcIds.includes(n.id) && n.alive) n.age = ageOf(r, state); return n; }
  const hood = H.list[H.hhs[r.hh]?.h ?? r.h] ?? Object.values(H.list).find((x) => resId.startsWith(`npc_${x.id}r`));
  const saved = rng.state();
  const seq = state.idSeq;
  rng.seed(luck(state, `face/${resId}`).int(1, 2 ** 31 - 2));
  let n;
  try {
    n = makeNpc({ role: 'neighbor', countryId: hood?.c ?? state.player.countryId, age: ageOf(r, state), gender: r.g, firstName: r.f, lastName: r.l, relationship: 30 });
  } finally { rng.seed(saved); state.idSeq = seq; }
  n.id = resId;
  n.occupation = r.job && r.job !== 'Retired' && r.job !== 'Student' ? r.job : null;
  if (r.job === 'Retired') n.flags.retired = true;
  n.flags.hood = { res: true };
  n.alive = !r.dead;
  if (r.dead) n.flags.diedYear = yearOf(r.dead);
  state.npcs[resId] = n;
  return n;
}

/**
 * Brings a resident into the player's life (as a neighbor, unless they are already more). Repeated introductions
 * find the same person: nobody is made twice.
 */
export function befriend(state, resId, rel = null, role = 'neighbor') {
  const p = state.player;
  const n = materialize(state, resId);
  if (!n || !n.alive) return null;
  const r = hoods(state).res[resId];
  if (!p.npcIds.includes(n.id)) {
    p.npcIds.push(n.id);
    if (n.role === 'neighbor' || !n.role) n.role = role;
    // Someone who knew the family before: they say so.
    const knewFamily = Object.keys(r.fam ?? {}).some((who) => who !== archiveIdOf(p));
    n.meters.relationship = clamp(rel ?? (n.meters.relationship || 30) + (knewFamily ? 10 : 0));
    delete n.flags.drifted;
  }
  (r.met ??= {})[archiveIdOf(p)] ??= nowT(state);
  n.lastInteractionAge = p.age;
  return n;
}

// ---------- Getting in ----------

/** Whether the player needs a level way in (step-free access, or a wheelchair), from their own health record. */
export function needsStepFree(state = store.state) {
  try { return accessNeeds(state.player).some((n) => n.id === 'step_free' || n.id === 'wheelchair'); } catch { return false; }
}
/** Whether a home can be reached without steps: as built, or as adapted (the adaptations are the health record's). */
export function stepFree(state, home) {
  if (!home) return false;
  if (home.sf) return true;
  if (home.id === hoods(state).cur?.home) { try { return accessHome(state.player).features.some((f) => ['ramp', 'step_free_entry', 'lift'].includes(f)); } catch { return false; } }
  return false;
}
/** In a building with no lift, a ground-floor home that stands empty, for someone the stairs shut in. */
export function groundFloorOption(state = store.state) {
  const H = hoods(state);
  const home = currentHome(state);
  if (!home || !needsStepFree(state) || stepFree(state, home) || dwelling(state)?.kind !== 'rent') return null;
  const block = H.blocks[home.b];
  if (block.kind !== 'building') return null;
  return block.homes.map((id) => H.homes[id]).find((h) => !h.hh && h.sf && !h.asset) ?? null;
}

/** Children on the player's street who go to the local school and are in the player's year: at most `max`. */
export function neighborKidsFor(state, age, max = 2, { school = true } = {}) {
  if (!state?.hoods || max <= 0) return [];
  const home = currentHome(state);
  if (!home) return [];
  const H = hoods(state);
  return around(state, home.id).filter((x) => x.hh && !x.hh.me && !x.hh.fam).flatMap((x) => x.hh.m).map((id) => H.res[id])
    .filter((r) => r && aliveRes(r) && (!school || r.school) && Math.abs(ageOf(r, state) - age) <= (school ? 1 : 2) && !(state.npcs[r.id] && state.player.npcIds.includes(r.id) && (school ? state.npcs[r.id].role === 'classmate' : true)))
    .slice(0, Math.min(2, max)).map((r) => r.id);
}

// ---------- Proximity ----------

/** How near two homes are, from where they really are. */
export function proximity(state, a, b) {
  const H = hoods(state);
  const x = H.homes[a]; const y = H.homes[b];
  if (!x || !y) return { k: 'elsewhere', word: 'elsewhere', near: 0 };
  if (x.id === y.id) return { k: 'household', word: 'same home', near: 6 };
  if (x.b === y.b) {
    const bl = H.blocks[x.b];
    if (bl.kind === 'building') {
      if (x.fl === y.fl && Math.abs(x.i - y.i) === 1) return { k: 'adjacent', word: 'next door', near: 5 };
      if (x.fl === y.fl) return { k: 'floor', word: 'same floor', near: 4 };
      if (Math.abs(x.fl - y.fl) === 1 && x.i === y.i) return { k: y.fl > x.fl ? 'upstairs' : 'downstairs', word: y.fl > x.fl ? 'upstairs' : 'downstairs', near: 4 };
      return { k: 'building', word: 'same building', near: 3 };
    }
    const gap = Math.abs(x.i - y.i);
    if (bl.kind === 'lane') return gap === 1 ? { k: 'adjacent', word: 'nearest neighbor', near: 4 } : { k: 'street', word: 'down the lane', near: 2 };
    if (gap === 1) return { k: 'adjacent', word: 'next door', near: 5 };
    if (gap === 2) return { k: 'near', word: 'two doors down', near: 4 };
    return { k: 'street', word: 'same street', near: 3 };
  }
  if (x.h === y.h) return { k: 'hood', word: 'same neighborhood', near: 2 };
  if (H.list[x.h]?.city === H.list[y.h]?.city) return { k: 'city', word: 'same city', near: 1 };
  return { k: 'elsewhere', word: 'elsewhere', near: 0 };
}

/** The households around a home, nearest first: [{ home, hh, prox }]. */
export function around(state, homeId) {
  const H = hoods(state);
  const home = H.homes[homeId];
  if (!home) return [];
  const hood = H.list[home.h];
  const out = [];
  for (const bid of hood.blocks) for (const id of H.blocks[bid].homes) {
    if (id === homeId) continue;
    const h = H.homes[id];
    out.push({ home: h, hh: h.hh ? H.hhs[h.hh] : null, prox: proximity(state, homeId, id) });
  }
  return out.sort((a, b) => b.prox.near - a.prox.near || a.home.id.localeCompare(b.home.id));
}

/** Residents living in a neighborhood now (alive, at home). */
export function residentsOf(state, hoodId) {
  const H = hoods(state);
  return Object.values(H.hhs).filter((hh) => hh.home && H.homes[hh.home]?.h === hoodId).flatMap((hh) => hh.m.map((id) => H.res[id]).filter((r) => r && aliveRes(r)));
}

// ---------- The chronicle and scenes ----------

/** Writes a line into the neighborhood chronicle. Only real things: each line points at the people and home it is about. */
export function note(state, e) {
  const H = hoods(state);
  H.log.push(e);
  if (H.log.length > 1000) {
    // The oldest lines about strangers go first; what concerns people the player knew is kept longest.
    const knew = (x) => x.k === 'remembered' || (x.who && (H.res[x.who]?.met || H.res[x.who]?.fam || state.npcs?.[x.who])) || H.hhs[x.hh]?.me || H.hhs[x.hh]?.fam;
    const keep = H.log.slice(0, -200).filter(knew);
    H.log = [...keep.slice(-600), ...H.log.slice(-200)].slice(-1000);
  }
  return e;
}

/**
 * People nobody in the family ever met, who left or died twenty years and more ago, leave no trace but the name on a
 * home's history. Keeps a long life's neighborhoods from growing without end.
 */
export function forget(state = store.state) {
  const H = hoods(state);
  const cutoff = T(state.year - 20);
  const held = new Set([...Object.values(H.blocks).map((b) => b.mgr), ...H.disputes.filter((d) => d.status === 'open').map((d) => d.res)].filter(Boolean));
  const gone = new Set();
  for (const r of Object.values(H.res)) {
    if (r.met || r.fam || r.owns || state.npcs[r.id] || held.has(r.id)) continue;
    const when = r.dead ?? r.gone?.t;
    if (when == null || when > cutoff) continue;
    if (H.hhs[r.hh]?.home) continue;
    gone.add(r.id);
    delete H.res[r.id];
  }
  if (!gone.size) return;
  // Their households stay on record (a home's history and the chronicle point at them), only without them.
  for (const hh of Object.values(H.hhs)) if (hh.m.some((x) => gone.has(x))) hh.m = hh.m.filter((x) => !gone.has(x));
}

/** Scenes that are all, at heart, "a neighbor would like your company": one of these is plenty for a while. */
const COMPANY = new Set(['hood_invitation', 'hood_invitation_upstairs', 'hood_different_neighbor', 'hood_unexpected_friendship', 'hood_kindness_returned', 'hood_block_party', 'hood_building_gathering', 'hood_community_event', 'hood_friend_across_street']);
const sceneSort = (id) => (COMPANY.has(id) ? 'company' : id);

/** Queues one neighborhood scene for the player, once per story key, one a year at most. */
/** Years before the same neighborhood scene can come again, whoever it is about. */
const SCENE_GAP = 10;
/** Years between any two neighborhood scenes: the neighborhood is background, and the rest of life comes first. */
const ANY_GAP = 2;
/** Scenes that are the same story told about a different occasion: one gap for all of them. */
const STORY_OF = { hood_block_party: 'hood_community_event', hood_building_gathering: 'hood_community_event', hood_invitation_upstairs: 'hood_invitation' };

export function queueScene(state, id, cast = {}, key = id, t = nowT(state)) {
  const H = hoods(state);
  if (muted || !state.player.alive) return false;
  if (H.seen[key] != null) return false;
  const thisYear = Object.values(H.seen).filter((x) => yearOf(x) === yearOf(t)).length;
  if (thisYear >= SCENES_A_YEAR) return false;
  // The same sort of scene (another invitation, another neighbor wanting company) not two years running.
  if (H.lastScene?.sort === sceneSort(id) && yearOf(t) - H.lastScene.y <= 1) return false;
  // One neighborhood scene every couple of years at most, whatever it is about.
  if (H.lastScene && yearOf(t) - H.lastScene.y < ANY_GAP) return false;
  // And the same story (another community event, another neighbor needing a hand) not again for ten years.
  H.byId ??= {};
  const story = STORY_OF[id] ?? id;
  if (H.byId[story] != null && yearOf(t) - H.byId[story] < SCENE_GAP) return false;
  H.byId[story] = yearOf(t);
  H.seen[key] = t;
  H.lastScene = { sort: sceneSort(id), y: yearOf(t) };
  // Told in its month (engine/neighborhood.js), so not paced by the Story Director; an everyday moment, told in the life
  // story to answer if the player wants to (engine/eventEngine.js asideOf).
  state.pendingEvents.push({ id, cast, aside: true });
  return true;
}

/**
 * A scene about a resident. Someone the player knows is cast as themselves; someone they have not met is named in the
 * scene's words only, and becomes a person in the save (materialize) only if the player chooses to meet them. That way a
 * scene the player never answers leaves the world exactly as it was.
 */
function queueAbout(state, sceneId, resId, words, key, t) {
  const r = hoods(state).res[resId];
  const knows = state.player.npcIds.includes(resId) && state.npcs[resId]?.alive;
  const cast = knows ? { person: resId, words: { ...words } } : { words: { ...words, person: r.f, res: resId } };
  return queueScene(state, sceneId, cast, key, t);
}

/**
 * Routine neighborhood news (a family moving in, a baby next door, a house standing empty) is a line in the life
 * story, not a scene to answer: scenes are kept for the moments that ask something of the player.
 */
export function tell(state, text, tone = 'neutral', key = null) {
  const H = hoods(state);
  if (key) { if (H.seen[key] != null) return; H.seen[`line:${key}`] = nowT(state); }
  const e = { age: state.player.age, text, kind: 'system', tone, hood: true };
  if (state.month) e.month = state.month;
  state.journal.push(e);
}

// ---------- The year in a neighborhood ----------

/** Whether a neighborhood is being lived through: the family lives there, or knows people who do. */
function active(state, hood) {
  if (!hood) return false;
  if (state.year - (hood.last ?? hood.since) <= DORMANT_AFTER) return true;
  return false;
}
/** Marks the neighborhoods the family is connected to as being lived in this year. */
function touch(state) {
  const H = hoods(state);
  const here = currentHome(state)?.h;
  if (here) H.list[here].last = state.year;
  for (const hh of Object.values(H.hhs)) if ((hh.me || hh.fam) && hh.home && living(state, hh).length) H.list[H.homes[hh.home].h].last = state.year;
  for (const id of state.player.npcIds) { const r = H.res[id]; const hh = r && H.hhs[r.hh]; if (hh?.home) H.list[H.homes[hh.home].h].last = state.year; }
}

/** A neighborhood nobody has had anything to do with for a long time: its missing years are lived through now. */
export function wake(state, hood) {
  if (!hood || active(state, hood)) { if (hood) hood.last = Math.max(hood.last ?? 0, state.year); return; }
  for (let y = (hood.sim ?? state.year - 1) + 1; y < state.year; y++) {
    planYear(state, hood, y);
    for (const e of H_(state).plans[hood.id].ev) apply(state, hood, e, y, true);
  }
  hood.last = state.year;
  // Those who came and went while nobody was looking, and whom nobody met, leave no trace: their homes say only who.
  const H = H_(state);
  for (const r of Object.values(H.res)) if (r.id.startsWith(`npc_${hood.id}r`) && !r.met && !r.fam && (r.dead || r.gone) && !state.npcs[r.id] && !r.owns) {
    const hh = H.hhs[r.hh];
    if (hh && hh.home) continue;
    for (const x of Object.values(H.hhs)) if (x.h === hood.id && x.m.includes(r.id)) x.m = x.m.filter((y) => y !== r.id);
    delete H.res[r.id];
  }
}

/**
 * The year ahead in a neighborhood, decided once: who moves out and in, who is born, who dies, what the neighbors
 * organize. Each with a month. From the world and the date only: never from the game's dice.
 */
export function planYear(state, hood, y) {
  const H = hoods(state);
  const r = luck(state, `year/${hood.id}/${y}`);
  const pr = PROFILES[hood.p];
  const ev = [];
  const age = (res) => y - res.by;
  const p = state.player;
  const mine = (hh) => hh.me || hh.fam;
  const homes = hood.blocks.flatMap((b) => H.blocks[b].homes).map((id) => H.homes[id]);
  const inHood = homes.filter((h) => h.hh).map((h) => H.hhs[h.hh]);
  const leaving = new Set();
  for (const hh of inHood) {
    if (mine(hh)) continue;
    const people = hh.m.map((id) => H.res[id]).filter((x) => x && aliveRes(x));
    if (!people.length) continue;
    const home = H.homes[hh.home];
    const floors = HOME_TYPES[home.t]?.floors;
    const oldest = Math.max(...people.map(age));
    const youngest = Math.min(...people.map(age));
    const tenure = y - yearOf(hh.from);
    let chance = (hh.own ? 0.035 : floors ? 0.13 : 0.08) * (pr.moving ?? 1);
    // Renters feel rising prices first.
    const fiveAgo = (hood.costs ?? []).find(([yy]) => yy === y - 5);
    if (!hh.own && fiveAgo && hood.cost > fiveAgo[1] * 1.12) chance += 0.05;
    if (home.t === 'student') chance = tenure >= 1 ? 0.7 : 0.25;
    if (hh.kind === 'roommates') chance += 0.08;
    if (oldest >= 76) chance += 0.04;
    if (tenure < 2) chance *= 0.4;
    // People in the player's life move as often as anyone, but no more: friendship does not keep them here.
    if (!hh.tenant && r.chance(chance)) { // the player's own tenants come and go with the tenancy (syncAssets)
      const why = home.t === 'student' ? 'study' : oldest >= 70 ? r.pick(['smaller', 'family', 'retire']) : youngest < 12 && people.length >= 3 ? r.pick(['space', 'job', 'family']) : hh.kind === 'roommates' ? r.pick(['together', 'job', 'like']) : r.pick(['job', 'cost', 'like', 'family', 'space']);
      const cities = COUNTRIES[hood.c].cities;
      const where = r.chance(0.55) ? hood.city : r.chance(0.85) && cities.length > 1 ? r.pick(cities.filter((x) => x !== hood.city)) : 'abroad';
      const m = r.int(0, 11);
      ev.push({ m, k: 'leave', hh: hh.id, why, to: where });
      leaving.add(hh.id);
      if (r.chance(0.5) && m < 10) ev.push({ m: r.int(m + 1, 11), k: 'arrive', home: home.id, after: hh.id });
      continue;
    }
    for (const res of people) {
      const a = age(res);
      // Everyone has a life span; it comes when it comes. People the player knows are in the yearly reckoning instead.
      if (y >= res.by + res.ls && !p.npcIds.includes(res.id)) { ev.push({ m: r.int(0, 11), k: 'die', res: res.id }); continue; }
      if (a >= 18 && a <= 26 && people.length > 1 && people.some((o) => age(o) - a >= 16) && r.chance(a >= 22 ? 0.35 : 0.18)) {
        ev.push({ m: a <= 19 ? 8 : r.int(0, 11), k: 'leaveHome', res: res.id, why: a <= 19 && r.chance(0.6) ? 'study' : r.pick(['job', 'like', 'together']), to: r.chance(0.6) ? hood.city : r.pick(COUNTRIES[hood.c].cities) });
      }
      if (res.job && res.job !== 'Retired' && !res.owns && a >= 66) ev.push({ m: r.int(0, 11), k: 'retire', res: res.id });
    }
    const adults = people.filter((x) => age(x) >= 18);
    const couple = adults.filter((x) => age(x) >= 22 && age(x) <= 42).length >= 2 && ['family', 'couple'].includes(hh.kind);
    if (couple && r.chance(0.07)) ev.push({ m: r.int(0, 11), k: 'birth', hh: hh.id });
    if (adults.length === 1 && age(adults[0]) >= 24 && age(adults[0]) <= 48 && ['single', 'singleParent'].includes(hh.kind) && r.chance(0.04)) ev.push({ m: r.int(0, 11), k: 'partner', hh: hh.id });
    if (adults.length >= 2 && ['couple', 'family'].includes(hh.kind) && r.chance(0.012)) ev.push({ m: r.int(0, 11), k: 'split', hh: hh.id, res: r.pick(adults).id });
    if (hh.pet && y - hh.pet.by >= ({ dog: 13, cat: 15, rabbit: 9 }[hh.pet.s] ?? 12) + r.int(-2, 2)) ev.push({ m: r.int(0, 11), k: 'petGone', hh: hh.id });
    else if (!hh.pet && r.chance(0.04)) ev.push({ m: r.int(0, 11), k: 'petNew', hh: hh.id });
  }
  for (const home of homes) if (!home.hh && !home.asset && r.chance(home.t === 'student' ? 0.9 : 0.55)) ev.push({ m: home.t === 'student' ? 8 : r.int(0, 11), k: 'arrive', home: home.id });
  // What the neighbors do together.
  const kinds = Object.entries(COMMUNITY_EVENTS).filter(([, e]) => (!e.blocks || hood.blocks.some((b) => e.blocks.includes(H.blocks[b].kind))) && (!e.profiles || e.profiles.includes(hood.p)) && y >= (e.from ?? 0)).map(([k]) => k);
  const organizers = inHood.filter((hh) => !mine(hh) && !leaving.has(hh.id)).flatMap((hh) => hh.m).map((id) => H.res[id]).filter((x) => x && aliveRes(x) && age(x) >= 25);
  const newcomers = H.log.some((x) => x.h === hood.id && x.k === 'arrived' && x.t >= T(y - 1));
  const choices = kinds.filter((k) => k !== 'welcome' || newcomers);
  const households = inHood.filter((hh) => !mine(hh)).length;
  const count = Math.min(3, r.poisson((pr.events ?? 1.5) * (0.6 + hood.g.cohesion / 125) * Math.min(1, households / 8)));
  const lately = new Set(H.log.filter((x) => x.h === hood.id && x.k === 'event' && x.t >= T(y - 2)).map((x) => x.who));
  for (let i = 0; i < count && organizers.length; i++) {
    // Anyone may organize something; the outgoing more often, and not the same person every time.
    const fresh = organizers.filter((x) => !lately.has(x.id));
    const pool = fresh.length ? fresh : organizers;
    const org = r.pick(pool.filter((x) => x.so === 'outgoing').length && r.chance(0.5) ? pool.filter((x) => x.so === 'outgoing') : pool);
    lately.add(org.id);
    ev.push({ m: r.int(0, 11), k: 'event', kind: r.pick(choices), org: org.id });
  }
  // Local places open and close.
  if (r.chance(0.05)) { const k = r.pick(pr.venues.filter((x) => venueAvailable(x, y) && !hood.venues.some((v) => v.k === x && v.to == null))); if (k) ev.push({ m: r.int(0, 11), k: 'venueOpen', kind: k }); }
  const open = hood.venues.filter((v) => v.to == null && !VENUES[v.k].public);
  for (const v of open) if (!venueAvailable(v.k, y) || r.chance(0.035)) ev.push({ m: r.int(0, 11), k: 'venueClose', venue: v.id });
  // What neighbors start, for a player who lives here.
  const here = currentHome(state);
  if (here?.h === hood.id && p.alive) {
    const near = around(state, here.id).filter((x) => x.hh && !mine(x.hh) && !leaving.has(x.hh.id));
    const known = knownIn(state, hood.id);
    const pAge = p.age + (y - state.year);
    if (known.length && r.chance(0.45)) { const n = r.pick(known); if (H.res[n.id] && n.meters.relationship >= 40 && n.age >= 6) ev.push({ m: r.int(0, 11), k: 'invite', res: n.id }); }
    const nearAdults = near.filter((x) => x.prox.near >= 3).flatMap((x) => x.hh.m).map((id) => H.res[id]).filter((x) => x && aliveRes(x) && age(x) >= 25);
    if (pAge >= 12 && nearAdults.length && r.chance(0.3)) ev.push({ m: r.int(0, 11), k: 'help', res: r.pick(nearAdults).id, need: r.pick(['move', 'meal', 'garden', 'pet', 'errand']) });
    const adjacent = near.filter((x) => x.prox.near >= 4).flatMap((x) => x.hh.m).map((id) => H.res[id]).filter((x) => x && aliveRes(x) && age(x) >= 21);
    if (pAge >= 18 && adjacent.length && r.chance(0.16)) {
      const who = r.pick(adjacent);
      const bk = H.blocks[here.b].kind;
      const opts = Object.entries(DISAGREEMENTS).filter(([, x]) => (!x.blocks || x.blocks.includes(bk)) && y >= (x.from ?? 0) && (!x.pet || H.hhs[who.hh]?.pet)).map(([k]) => k);
      if (opts.length) ev.push({ m: r.int(0, 11), k: 'dispute', res: who.id, kind: r.pick(opts) });
    }
    if (pAge >= 4 && pAge <= 13) {
      const kids = near.flatMap((x) => x.hh.m).map((id) => H.res[id]).filter((x) => x && aliveRes(x) && Math.abs(age(x) - pAge) <= 2 && !state.npcs[x.id]);
      if (kids.length && r.chance(0.5)) ev.push({ m: r.int(3, 8), k: 'kid', res: r.pick(kids).id });
    }
    // Kindness remembered: someone the player once helped may, some years on, do something in return. Never owed.
    const me = archiveIdOf(p);
    const owed = residentsOf(state, hood.id).filter((x) => x.owes?.[me] != null && y - yearOf(x.owes[me]) >= 2 && p.npcIds.includes(x.id) && state.npcs[x.id]?.alive);
    if (owed.length && r.chance(0.25)) ev.push({ m: r.int(0, 11), k: 'kindness', res: r.pick(owed).id });
    // The next generation: the player's own children make friends of their own on the street.
    const mineKids = (H.hhs[H.cur?.hh]?.m ?? []).map((id) => state.npcs[id]).filter((n) => n?.alive && n.role === 'child' && n.age >= 4 && n.age <= 14);
    for (const child of mineKids) {
      const pals = near.flatMap((x) => x.hh.m).map((id) => H.res[id]).filter((x) => x && aliveRes(x) && Math.abs(age(x) - (child.age + (y - state.year))) <= 2 && !(x.pals ?? []).includes(child.id));
      if (pals.length && r.chance(0.3)) ev.push({ m: r.int(0, 11), k: 'kidsFriends', res: r.pick(pals).id, child: child.id });
    }
    const elders = residentsOf(state, hood.id).filter((x) => age(x) >= 70 && y - yearOf(H.hhs[x.hh]?.from ?? T(y)) >= 25 && !state.npcs[x.id]);
    if (pAge >= 14 && elders.length && r.chance(0.2)) ev.push({ m: r.int(0, 11), k: 'elder', res: r.pick(elders).id });
  }
  // The neighborhood itself changes: new homes go up, old ones are done up, prices and how close-knit it is drift.
  const growing = { suburban: 0.05, mixed: 0.04, urban: 0.03, apartments: 0.04, downtown: 0.03, university: 0.03, coastal: 0.02, smalltown: 0.02, rural: 0.01, historic: 0.005, gated: 0.02 }[hood.p] ?? 0.02;
  if (hood.blocks.length < 6 && y >= 1880 && r.chance(growing)) {
    const type = weightedPick(r, pr.homes.filter(([t]) => homeTypeAvailable(t, y) && t !== 'student'));
    ev.push({ m: r.int(0, 11), k: 'build', type });
  }
  const tired = hood.blocks.map((b) => H.blocks[b]).filter((b) => y - (b.renovated ?? b.est) >= 30);
  if (tired.length && r.chance(0.05)) ev.push({ m: r.int(0, 11), k: 'renovate', block: r.pick(tired).id });
  const lastYear = H.log.filter((x) => x.h === hood.id && x.t >= T(y - 1) && x.t < T(y));
  const events = lastYear.filter((x) => x.k === 'event' || x.k === 'hosted' || x.k === 'attended').length;
  const leavers = lastYear.filter((x) => x.k === 'left').length;
  const opened = lastYear.filter((x) => x.k === 'venueOpen' || x.k === 'built').length;
  ev.push({ m: 11, k: 'drift', cost: Math.round((r.normal(0.005, 0.025) + opened * 0.01 - leavers * 0.004) * 1000) / 1000, cohesion: Math.round(clamp(events * 2 - leavers * 1.5 + (50 - hood.g.cohesion) / 10, -6, 6)) });
  if (r.chance(0.08 * (0.5 + hood.g.cohesion / 100))) {
    const org = organizers.length ? r.pick(organizers) : null;
    if (org) ev.push({ m: r.int(2, 9), k: 'project', org: org.id, what: r.pick(PROJECTS) });
  }
  if (here?.h === hood.id && p.alive) {
    const block = H.blocks[here.b];
    const pAge = p.age + (y - state.year);
    if (block.kind === 'building' && pAge >= 16 && r.chance(0.15)) {
      const kinds = Object.entries(BUILDING_ISSUES).filter(([, x]) => (!x.needs || block[x.needs]) && y >= (x.from ?? 0)).map(([k]) => k);
      if (kinds.length) ev.push({ m: r.int(0, 11), k: 'issue', block: block.id, kind: r.pick(kinds) });
    }
    // The family that stayed: a household here for forty years and more, with children born on the street.
    const stayed = Object.values(H.hhs).filter((hh) => hh.home && H.homes[hh.home].h === hood.id && !mine(hh) && y - yearOf(hh.from) >= 40 && hh.m.some((id) => H.res[id] && (H.res[id].bornHere || H.res[id].by >= yearOf(hh.from))));
    if (pAge >= 12 && stayed.length && r.chance(0.3)) ev.push({ m: r.int(0, 11), k: 'stayed', hh: r.pick(stayed).id });
    // An unexpected friendship: a neighbor the player knows turns out to share a passion.
    const me = archiveIdOf(p);
    const sharers = knownIn(state, hood.id).filter((n) => H.res[n.id] && n.role === 'neighbor' && n.meters.relationship >= 35 && sharedWith(state, H.res[n.id]).length);
    if (sharers.length && r.chance(0.35)) { const n = r.pick(sharers); ev.push({ m: r.int(0, 11), k: 'shared', res: n.id, interest: sharedWith(state, H.res[n.id])[0] }); }
    void me;
  }
  ev.sort((a, b) => a.m - b.m);
  H.plans[hood.id] = { y, ev };
  hood.sim = y;
  return H.plans[hood.id];
}

const KIN = (r, state) => composition(state, H_(state).hhs[r.hh] ?? {});

/** One planned thing, carried out when its month comes. Checks first that it can still happen. `quiet`: no scenes. */
function apply(state, hood, e, y, quiet = false) {
  const H = hoods(state);
  const t = T(y, e.m);
  const p = state.player;
  const here = currentHome(state);
  const playerHere = !quiet && here?.h === hood.id && p.alive;
  const near = (homeId) => (here ? proximity(state, here.id, homeId).near : 0);
  const known = (id) => p.npcIds.includes(id) && state.npcs[id]?.alive;
  switch (e.k) {
    case 'leave': {
      const hh = H.hhs[e.hh];
      if (!hh?.home || hh.me || hh.fam) return;
      const home = H.homes[hh.home];
      if (home.h !== hood.id) return;
      const people = hh.m.map((id) => H.res[id]).filter((x) => x && aliveRes(x));
      if (!people.length) return;
      leaveHome(state, home, t, MOVE_REASONS[e.why] ? `moved ${MOVE_REASONS[e.why]}` : 'moved away');
      hh.to = t; hh.gone = { t, why: e.why, to: e.to };
      for (const r of people) { r.hh = hh.id; r.gone = { t, city: e.to === 'abroad' ? null : e.to, c: e.to === 'abroad' ? null : hood.c }; leftHood(state, r, e.to, y); }
      note(state, { t, h: hood.id, k: 'left', text: `The ${hh.n} household left ${home.label}, ${MOVE_REASONS[e.why] ?? 'to live somewhere else'}${e.to === 'abroad' ? ', abroad' : e.to !== hood.city ? `, to ${e.to}` : ''}.`, home: home.id, hh: hh.id });
      const friend = people.find((r) => known(r.id));
      if (playerHere && friend) queueScene(state, 'hood_moving_away', { person: friend.id, words: { where: e.to === 'abroad' ? 'abroad' : e.to === hood.city ? `another part of ${hood.city}` : e.to } }, `away/${friend.id}`, t);
      else if (playerHere && near(home.id) >= 4 && yearOf(t) - yearOf(hh.from) >= 15) tell(state, `The ${hh.n} family moved away from ${home.label} after ${yearOf(t) - yearOf(hh.from)} years. The street feels different.`);
      return;
    }
    case 'arrive': {
      const home = H.homes[e.home];
      if (!home || home.hh || home.asset) return;
      const rr = luck(state, `arrive/${home.id}/${t}`);
      // Sometimes it is somebody who grew up around here, coming back.
      const back = Object.values(H.res).filter((x) => x.gone && !x.dead && x.gone.city === hood.city && (!x.hh || H.hhs[x.hh]?.to != null) && y - x.by >= 22 && y - x.by <= 48 && y - yearOf(x.gone.t) >= 4 && x.id.startsWith(`npc_${hood.id}r`) && !state.npcs[x.id]?.flags?.abroad);
      let hh;
      if (back.length && rr.chance(0.15)) {
        const who = rr.pick(back);
        hh = { id: `${hood.id}x${++hood.nh}`, n: who.l, h: hood.id, home: null, m: [who.id], from: t, kind: 'single', own: rr.chance(0.4), back: true };
        H.hhs[hh.id] = hh;
        who.hh = hh.id; delete who.gone;
      } else {
        const saveYear = state.year;
        state.year = y; // ages as of the year they arrive
        try { hh = makeHousehold(state, hood, home, rr, { since: t }); } finally { state.year = saveYear; }
      }
      settleIn(state, home, hh, t, hh.back ? 'came back' : 'moved in');
      note(state, { t, h: hood.id, k: 'arrived', text: `${hh.back ? `${fullName(H.res[hh.m[0]])}, who grew up here, came back to live at` : `The ${hh.n} household moved into`} ${home.label}${H.blocks[home.b].kind === 'building' ? ` in ${H.blocks[home.b].name}` : ` on ${H.blocks[home.b].name}`}.`, home: home.id, hh: hh.id });
      if (playerHere && near(home.id) >= 3) {
        const head = hh.m.map((id) => H.res[id]).filter((x) => x && y - x.by >= 18)[0] ?? H.res[hh.m[0]];
        const knewThem = hh.back && Object.keys(head.met ?? {}).includes(archiveIdOf(p));
        if (knewThem) queueAbout(state, 'hood_old_friend_returns', head.id, {}, `back/${head.id}`, t);
        else tell(state, `${hh.m.length > 1 ? `The ${hh.n} family` : `Someone new, ${head.f} ${head.l},`} moved in ${proximity(state, here.id, home.id).word === 'next door' ? 'next door' : `at ${home.label}`}: ${composition(state, hh)}. You could go and say hello (My Neighborhood).`);
      }
      return;
    }
    case 'die': {
      const r = H.res[e.res];
      if (!r || r.dead) return;
      if (known(r.id)) return; // the yearly reckoning decides for people the player knows
      r.dead = t;
      if (state.npcs[r.id]) { state.npcs[r.id].alive = false; state.npcs[r.id].flags.diedYear = y; }
      removeFrom(state, r, t, 'died');
      const hh = H.hhs[r.hh];
      note(state, { t, h: hood.id, k: 'died', text: `${fullName(r)} died, at ${y - r.by}.`, who: r.id, home: hh?.home ?? null });
      return;
    }
    case 'leaveHome': {
      const r = H.res[e.res];
      const hh = r && H.hhs[r.hh];
      if (!r || r.dead || !hh?.home || hh.m.length < 2 || r.gone) return;
      hh.m = hh.m.filter((x) => x !== r.id);
      r.hh2 = hh.id; r.hh = null; r.gone = { t, city: e.to, c: hood.c, why: e.why };
      if (e.why === 'study' && r.job !== 'Student') r.job = 'Student';
      leftHood(state, r, e.to, y);
      note(state, { t, h: hood.id, k: 'grownup', text: `${fullName(r)} left home${e.why === 'study' ? ' for university' : e.why === 'together' ? ' to live with a partner' : ''}${e.to !== hood.city ? `, for ${e.to}` : ''}.`, who: r.id, home: hh.home });
      if (playerHere && known(r.id) && state.npcs[r.id].meters.relationship >= 50) queueScene(state, 'hood_moving_away', { person: r.id, words: { where: e.to === hood.city ? `another part of ${hood.city}` : e.to } }, `away/${r.id}`, t);
      return;
    }
    case 'retire': { const r = H.res[e.res]; if (r && !r.dead && r.job && r.job !== 'Retired') { r.job = 'Retired'; if (state.npcs[r.id]) { state.npcs[r.id].occupation = null; state.npcs[r.id].flags.retired = true; } } return; }
    case 'birth': {
      const hh = H.hhs[e.hh];
      if (!hh?.home || hh.gone) return;
      const rr = luck(state, `birth/${hh.id}/${t}`);
      const c = COUNTRIES[hood.c];
      const g = rr.pick(['male', 'female']);
      const id = `npc_${hood.id}r${++hood.nr}`;
      H.res[id] = { id, f: rr.pick(c.names[g] ?? c.names.female), l: hh.n, g, by: y, hh: hh.id, so: rr.pick(['outgoing', 'reserved', 'family']), in: [], ls: Math.round(clamp(rr.normal(82, 9), 55, 104)), school: false, bornHere: true };
      hh.m.push(id);
      if (hh.kind === 'couple') hh.kind = 'family';
      note(state, { t, h: hood.id, k: 'born', text: `A baby, ${H.res[id].f}, was born to the ${hh.n} household.`, who: id, home: hh.home });
      if (playerHere && near(hh.home) >= 4) tell(state, `There is a new baby next door: ${H.res[id].f}, the newest of the ${hh.n} family.`, 'good');
      return;
    }
    case 'partner': {
      const hh = H.hhs[e.hh];
      if (!hh?.home) return;
      const head = hh.m.map((x) => H.res[x]).find((x) => x && aliveRes(x) && y - x.by >= 18);
      if (!head) return;
      const rr = luck(state, `partner/${hh.id}/${t}`);
      const c = COUNTRIES[hood.c];
      const g = rr.chance(0.9) ? (head.g === 'male' ? 'female' : 'male') : head.g;
      const id = `npc_${hood.id}r${++hood.nr}`;
      const a = clamp(y - head.by + rr.int(-5, 5), 21, 70);
      H.res[id] = { id, f: rr.pick(c.names[g] ?? c.names.female), l: rr.chance(0.5) ? hh.n : rr.pick(c.names.last), g, by: y - a, hh: hh.id, so: rr.pick(['outgoing', 'reserved', 'busy', 'family']),
        in: [rr.pick(INTERESTS)[0]], ls: Math.round(clamp(rr.normal(80, 9), a + 5, 103)), job: jobFor(rr, a, y, 'couple') };
      hh.m.push(id);
      hh.kind = hh.kind === 'singleParent' ? 'family' : 'couple';
      note(state, { t, h: hood.id, k: 'joined', text: `${H.res[id].f} ${H.res[id].l} moved in with ${head.f} ${head.l}.`, who: id, home: hh.home });
      return;
    }
    case 'split': {
      const hh = H.hhs[e.hh];
      const r = H.res[e.res];
      if (!hh?.home || !r || r.dead || r.hh !== hh.id || hh.m.filter((x) => H.res[x] && aliveRes(H.res[x]) && y - H.res[x].by >= 18).length < 2) return;
      hh.m = hh.m.filter((x) => x !== r.id);
      r.hh2 = hh.id; r.hh = null; r.gone = { t, city: hood.city, c: hood.c, why: 'separated' };
      leftHood(state, r, hood.city, y);
      hh.kind = hh.m.some((x) => H.res[x] && y - H.res[x].by < 18) ? 'singleParent' : 'single';
      note(state, { t, h: hood.id, k: 'separated', text: `${fullName(r)} moved out of the ${hh.n} household.`, who: r.id, home: hh.home });
      return;
    }
    case 'petGone': { const hh = H.hhs[e.hh]; if (hh?.pet) { note(state, { t, h: hood.id, k: 'pet', text: `${hh.pet.n}, the ${hh.n} household's ${hh.pet.s}, died.`, home: hh.home }); hh.pet = null; } return; }
    case 'petNew': {
      const hh = H.hhs[e.hh];
      if (!hh?.home || hh.pet) return;
      const rr = luck(state, `pet/${hh.id}/${t}`);
      const s = rr.pick(['dog', 'cat']);
      hh.pet = { n: rr.pick(s === 'dog' ? ['Scout', 'Daisy', 'Bruno', 'Poppy', 'Toby'] : ['Socks', 'Nala', 'Oscar', 'Pumpkin']), s, by: y };
      return;
    }
    case 'event': {
      const org = H.res[e.org];
      if (!org || org.dead || !org.hh || H.homes[H.hhs[org.hh]?.home]?.h !== hood.id) return;
      const ev = COMMUNITY_EVENTS[e.kind];
      const id = `${hood.id}e${y}m${e.m}`;
      const repeated = H.log.filter((x) => x.h === hood.id && x.k === 'event' && x.kind === e.kind).length;
      note(state, { t, h: hood.id, k: 'event', kind: e.kind, id, text: `${fullName(org)} organized ${eventName(e.kind, hood.c) === ev.name ? `a ${ev.name.toLowerCase()}` : `a ${eventName(e.kind, hood.c).toLowerCase()}`}: ${ev.text}.`, who: org.id });
      if (repeated === 2) note(state, { t, h: hood.id, k: 'tradition', kind: e.kind, text: `The ${eventName(e.kind, hood.c).toLowerCase()} has become a neighborhood tradition.` });
      const pAge = p.age - (state.year - y);
      if (playerHere && (ev.who !== 'adult' || pAge >= 16) && pAge >= 4) {
        queueAbout(state, e.kind === 'street_party' ? 'hood_block_party' : e.kind === 'building' ? 'hood_building_gathering' : 'hood_community_event', org.id,
          { event: eventName(e.kind, hood.c).toLowerCase(), what: ev.text, eventId: id, kind: e.kind }, `event/${id}`, t);
      }
      return;
    }
    case 'venueOpen': {
      if (hood.venues.some((v) => v.k === e.kind && v.to == null)) return;
      const rr = luck(state, `venue/${hood.id}/${t}`);
      const v = addVenue(state, hood, e.kind, rr, y);
      const owners = residentsOf(state, hood.id).filter((x) => y - x.by >= 25 && y - x.by < 66 && !x.owns && x.job !== 'Student');
      if (!VENUES[e.kind].public) {
        if (owners.length && rr.chance(0.5)) { const o = rr.pick(owners); o.owns = v.id; o.job = `Owner of ${v.name}`; v.owner = o.id; if (state.npcs[o.id]) state.npcs[o.id].occupation = o.job; } else v.owner = makeOutsider(state, hood, rr, { job: `Owner of ${v.name}`, owns: v.id }, y).id;
      }
      const o = H.res[v.owner];
      note(state, { t, h: hood.id, k: 'venueOpen', text: `${v.name}, a new ${VENUES[v.k].name.toLowerCase()}, opened${o ? `, run by ${fullName(o)}` : ''}.`, venue: v.id, who: o?.id });
      if (playerHere && o && (known(o.id) || !o.elsewhere)) queueAbout(state, 'hood_neighbor_business', o.id, { venue: v.name, kind: VENUES[v.k].name.toLowerCase(), venueId: v.id }, `venue/${v.id}`, t);
      return;
    }
    case 'venueClose': {
      const v = hood.venues.find((x) => x.id === e.venue);
      if (!v || v.to != null) return;
      v.to = y;
      const o = H.res[v.owner];
      if (o && o.owns === v.id) { delete o.owns; if (!o.dead && y - o.by < 66) o.job = jobFor(luck(state, `job/${o.id}/${y}`), y - o.by, y, 'single'); }
      note(state, { t, h: hood.id, k: 'venueClose', text: `${v.name} closed${venueAvailable(v.k, y) ? '' : ': nobody needs one any more'}.`, venue: v.id });
      return;
    }
    case 'invite': { const n = state.npcs[e.res]; const r = H.res[e.res]; if (playerHere && n?.alive && known(n.id) && H.homes[H.hhs[r?.hh]?.home]?.h === hood.id) queueScene(state, near(H.hhs[r.hh].home) >= 4 && H.blocks[here.b].kind === 'building' ? 'hood_invitation_upstairs' : 'hood_invitation', { person: n.id }, `invite/${n.id}/${y}`, t); return; }
    case 'help': {
      const r = H.res[e.res];
      if (!playerHere || !r || r.dead || H.homes[H.hhs[r.hh]?.home]?.h !== hood.id) return;
      queueAbout(state, 'hood_need_hand', r.id, { need: { move: 'move a wardrobe up the stairs', meal: 'have a hot meal brought round while they recover from an operation', garden: 'get the garden back under control', pet: 'have someone feed the animals while they are away', errand: 'get a few things from the shops this week' }[e.need] }, `help/${r.id}/${y}`, t);
      return;
    }
    case 'dispute': {
      const r = H.res[e.res];
      if (!playerHere || !r || r.dead || H.homes[H.hhs[r.hh]?.home]?.h !== hood.id) return;
      if (H.disputes.some((x) => x.res === r.id && x.status === 'open')) return;
      const id = `${hood.id}d${t}`;
      H.disputes.push({ id, h: hood.id, res: r.id, kind: e.kind, t, status: 'open' });
      queueAbout(state, 'hood_disagreement', r.id, { about: DISAGREEMENTS[e.kind].text.replace('{who}', r.f), disputeId: id }, `dispute/${id}`, t);
      return;
    }
    case 'kid': {
      const r = H.res[e.res];
      const pAge = p.age - (state.year - y);
      if (!playerHere || !r || r.dead || state.npcs[r.id] || pAge < 4 || pAge > 13) return;
      queueAbout(state, 'hood_friend_across_street', r.id, { where: H.blocks[here.b].kind === 'building' ? 'in the courtyard' : 'across the street' }, `kid/${r.id}`, t);
      return;
    }
    case 'kindness': {
      const n = state.npcs[e.res];
      if (!playerHere || !n?.alive || !known(n.id)) return;
      queueAbout(state, 'hood_kindness_returned', n.id, { help: luck(state, `kind/${n.id}/${t}`).pick(['a casserole and an offer to help with anything', 'a hand with the heavy lifting', 'a lift when the car would not start', 'some very good advice about the landlord', 'a plant for the window, just because']) }, `kind/${n.id}/${y}`, t);
      return;
    }
    case 'kidsFriends': {
      const r = H.res[e.res]; const child = state.npcs[e.child];
      if (!playerHere || !r || r.dead || !child?.alive || (r.pals ?? []).includes(child.id)) return;
      (r.pals ??= []).push(child.id);
      note(state, { t, h: hood.id, k: 'friends', text: `${child.firstName} ${child.lastName} and ${r.f} ${r.l} became friends.`, who: r.id });
      const line = `${child.firstName} has made a friend on the street: ${r.f}, from the ${r.l} household.`;
      state.journal.push({ age: p.age, text: line, kind: 'system', tone: 'good', ...(state.month ? { month: state.month } : {}), hood: true });
      return;
    }
    case 'build': {
      if (hood.blocks.length >= 6) return;
      const block = makeBlock(state, hood, e.type, y, true);
      block.isNew = true;
      for (const id of block.homes) H.homes[id].sf = H.homes[id].sf || y >= 1990; // new building is built level, from the 1990s
      if (block.kind === 'building') block.lift = block.lift || (block.fl >= 3 && y >= 1960);
      note(state, { t, h: hood.id, k: 'built', text: `New ${block.kind === 'building' ? `apartments went up: ${block.name}` : `homes were built on ${block.name}`}, ${block.homes.length} of them.`, block: block.id });
      return;
    }
    case 'renovate': {
      const block = H.blocks[e.block];
      if (!block) return;
      block.renovated = y;
      if (block.kind === 'building' && block.fl >= 3 && y >= 1960 && !block.lift) { block.lift = true; for (const id of block.homes) H.homes[id].sf = true; }
      hood.g.upkeep = clamp(hood.g.upkeep + 4);
      hood.cost = Math.round(hood.cost * 1.03 * 100) / 100;
      note(state, { t, h: hood.id, k: 'renovated', text: `${block.name} was done up${block.lift && block.kind === 'building' ? ', with a lift at last' : ''}.`, block: block.id });
      return;
    }
    case 'drift': {
      const was = hood.cost;
      hood.cost = Math.round(clamp(hood.cost * (1 + e.cost), 0.4, 3) * 100) / 100;
      hood.g.cohesion = clamp(hood.g.cohesion + e.cohesion);
      (hood.costs ??= []).push([y, hood.cost]);
      if (hood.costs.length > 12) hood.costs.shift();
      const five = hood.costs.find(([yy]) => yy === y - 5);
      if (five && hood.cost >= five[1] * 1.15 && !H.log.some((x) => x.h === hood.id && x.k === 'prices' && x.t >= T(y - 5))) note(state, { t, h: hood.id, k: 'prices', text: `Homes in ${hood.name} cost far more than five years ago. Some people who rent are being priced out.` });
      if (five && hood.cost <= five[1] * 0.88 && !H.log.some((x) => x.h === hood.id && x.k === 'prices' && x.t >= T(y - 5))) note(state, { t, h: hood.id, k: 'prices', text: `Homes in ${hood.name} cost less than they did five years ago.` });
      void was;
      return;
    }
    case 'project': {
      const org = H.res[e.org];
      if (!org || org.dead || !org.hh || H.homes[H.hhs[org.hh]?.home]?.h !== hood.id) return;
      const pAge = p.age - (state.year - y);
      if (playerHere && pAge >= 10) queueAbout(state, 'hood_community_project', org.id, { what: e.what }, `project/${hood.id}/${y}`, t);
      else { hood.g.parks = clamp(hood.g.parks + 3); hood.g.cohesion = clamp(hood.g.cohesion + 2); note(state, { t, h: hood.id, k: 'project', text: `Neighbors got together to ${e.what}, led by ${fullName(org)}.`, who: org.id }); }
      return;
    }
    case 'issue': {
      if (!playerHere || here.b !== e.block) return;
      queueScene(state, 'hood_building_issue', { words: { issue: BUILDING_ISSUES[e.kind].text, building: H.blocks[e.block].name, landlord: H.blocks[e.block].ll ?? 'the owners\' committee', issueKind: e.kind } }, `issue/${e.block}/${y}`, t);
      return;
    }
    case 'stayed': {
      const hh = H.hhs[e.hh];
      if (!playerHere || !hh?.home) return;
      const head = hh.m.map((id) => H.res[id]).filter((x) => x && aliveRes(x)).sort((a, b) => a.by - b.by)[0];
      if (!head) return;
      queueAbout(state, 'hood_family_that_stayed', head.id, { family: `the ${hh.n} household`, years: String(y - yearOf(hh.from)), street: H.blocks[H.homes[hh.home].b].name }, `stayed/${hh.id}`, t);
      return;
    }
    case 'shared': {
      const n = state.npcs[e.res];
      if (!playerHere || !n?.alive || !known(n.id)) return;
      queueAbout(state, 'hood_unexpected_friendship', n.id, { interest: INTERESTS.find(([k]) => k === e.interest)?.[1] ?? e.interest }, `shared/${n.id}`, t);
      return;
    }
    case 'elder': {
      const r = H.res[e.res];
      if (!playerHere || !r || r.dead || state.npcs[r.id]) return;
      const years = y - yearOf(H.hhs[r.hh]?.from ?? t);
      queueAbout(state, 'hood_longtime_resident', r.id, { years: String(years), hood: hood.name }, `elder/${r.id}`, t);
      return;
    }
    default:
  }
}

/** Interests the player shares with a resident: from the player's passions, talents and animals, and the resident's own. */
export function sharedWith(state, r) {
  const p = state.player;
  const mine = new Set();
  if ((p.talents?.music ?? 0) >= 55) mine.add('music');
  if ((p.talents?.sports ?? 0) >= 55 || p.sport) mine.add('sport');
  if ((p.stats?.intellect ?? 0) >= 65) { mine.add('books'); mine.add('chess'); }
  if (p.npcIds.some((id) => state.npcs[id]?.role === 'pet') || p.animals) mine.add('animals');
  for (const k of Object.keys(p.passions ?? {})) mine.add(k);
  return (r.in ?? []).filter((k) => mine.has(k));
}

/** Someone leaves a neighborhood. If the player knows them, they are still the same person, somewhere else. */
function leftHood(state, r, to, year = state.year) {
  const n = state.npcs[r.id];
  if (!n) return;
  if (to === 'abroad') n.flags.abroad = true;
  n.flags.movedAway = { year, to };
  if (n.role === 'neighbor') n.flags.title = 'Former neighbor';
}

/** A resident is gone from their household (died): the household and home keep the record. */
function removeFrom(state, r, t, why) {
  const H = hoods(state);
  const hh = H.hhs[r.hh];
  if (!hh) return;
  hh.m = hh.m.filter((x) => x !== r.id);
  if (!living(state, hh).length && hh.home) {
    const home = H.homes[hh.home];
    leaveHome(state, home, t, why === 'died' ? 'the last of them died' : why);
    hh.to = t;
    const here = currentHome(state);
    if (here && here.h === home.h && proximity(state, here.id, home.id).near >= 4 && yearOf(t) - yearOf(hh.from) >= 10) {
      tell(state, `${home.label} stands empty now. The ${hh.n} household lived there for ${yearOf(t) - yearOf(hh.from)} years.`);
    }
  }
}

/** People the player knows who died in the yearly reckoning (engine/relationships.js): their homes and households hear of it. */
function syncDeaths(state) {
  const H = hoods(state);
  for (const r of Object.values(H.res)) {
    if (r.dead) continue;
    const n = state.npcs[r.id];
    if (n && !n.alive) {
      r.dead = T(n.flags.diedYear ?? state.year);
      removeFrom(state, r, r.dead, 'died');
      const hh = H.hhs[r.hh];
      note(state, { t: r.dead, h: hh?.h ?? r.h, k: 'died', text: `${fullName(r)} died, at ${n.age}.`, who: r.id, home: hh?.home ?? null });
    } else if (n && n.alive && !state.player.npcIds.includes(n.id)) n.age = ageOf(r, state);
  }
  // The player's relatives in a household (parents in the family home).
  for (const hh of Object.values(H.hhs)) if ((hh.fam || hh.me) && hh.home && !living(state, hh).length) { const home = H.homes[hh.home]; leaveHome(state, home, nowT(state), 'nobody left'); hh.to = nowT(state); }
}

/**
 * Homes the player owns, as the property records say now: one sold has a new owner and no longer belongs to the
 * family (its history stays); one let to a tenant has a tenant household living in it; one whose tenant has gone stands
 * empty. Ownership itself is never changed here: the property record (p.assets) is the only owner.
 */
function syncAssets(state) {
  const H = hoods(state);
  const p = state.player;
  const t = nowT(state);
  for (const home of Object.values(H.homes)) {
    if (!home.asset) continue;
    const a = p.assets.find((x) => x.id === home.asset && x.kind === 'property');
    const hood = H.list[home.h];
    if (!a) {
      if (home.hh && H.hhs[home.hh]?.tenant) { const hh = H.hhs[home.hh]; leaveHome(state, home, t, 'the house was sold'); hh.to = t; }
      note(state, { t, h: home.h, k: 'sold', text: `${home.label} on ${H.blocks[home.b].name} was sold, and passed out of the ${p.lastName} family.`, home: home.id });
      home.asset = null; home.sold = t;
      if (home.own === 'player') home.own = 'landlord';
      continue;
    }
    if (H.cur?.home === home.id) continue;
    const tenantHh = home.hh ? H.hhs[home.hh] : null;
    if (a.tenant && !home.hh) {
      const hh = makeHousehold(state, hood, home, luck(state, `tenant/${home.id}/${t}`), { since: t });
      hh.tenant = true; hh.own = false;
      settleIn(state, home, hh, t, 'rented it');
      home.own = 'player';
      note(state, { t, h: home.h, k: 'arrived', text: `The ${hh.n} household moved into ${home.label}, as tenants.`, home: home.id, hh: hh.id });
    } else if (!a.tenant && tenantHh?.tenant) {
      leaveHome(state, home, t, 'the tenancy ended'); tenantHh.to = t;
      for (const id of tenantHh.m) if (H.res[id]) H.res[id].gone = { t, city: hood.city, c: hood.c, why: 'tenancy ended' };
      home.own = 'player';
    }
  }
}

/**
 * Lives the neighborhoods through to now: every planned thing whose month has passed, once. Called as the calendar
 * moves (engine/turns.js) and at the turn of the year (engine/yearProcessor.js). Idempotent.
 */
export function catchUp(state = store.state, until = nowT(state)) {
  const H = hoods(state);
  if (H.at == null) { H.at = until; return; }
  while (H.at < until) {
    const y = yearOf(H.at); const m = monthOfT(H.at);
    for (const hood of Object.values(H.list)) {
      if (!active(state, hood)) continue;
      const plan = H.plans[hood.id];
      if (!plan || plan.y !== y) { if ((hood.sim ?? -Infinity) >= y) continue; planYear(state, hood, y); }
      for (const e of H.plans[hood.id].ev) if (e.m === m) apply(state, hood, e, y);
    }
    H.at += 1;
  }
}

/** The turn of a year, early: last year's months lived through, before the yearly reckoning of people. */
export function closeYear(state = store.state) {
  hoods(state);
  catchUp(state, T(state.year, 0));
}

/** The turn of a year, late: who has died, where the player lives now, and the plans for the year ahead. */
export function openYear(state = store.state) {
  const H = hoods(state);
  syncDeaths(state);
  settle(state);
  syncAssets(state);
  touch(state);
  for (const hood of Object.values(H.list)) if (active(state, hood) && (hood.sim ?? -Infinity) < state.year) planYear(state, hood, state.year);
  // A community remembers: ten years on, someone who lived on a street for decades is still talked about.
  for (const r of Object.values(H.res)) {
    if (!r.dead || yearOf(r.dead) !== state.year - 10) continue;
    const hh = H.hhs[r.hh];
    const hoodId = hh?.h;
    if (!hoodId || !active(state, H.list[hoodId]) || yearOf(r.dead) - yearOf(hh.from) < 25) continue;
    if (!H.log.some((x) => x.k === 'remembered' && x.who === r.id)) note(state, { t: T(state.year), h: hoodId, k: 'remembered', text: `Ten years since ${fullName(r)} died. People in ${H.list[hoodId].name} still talk about them.`, who: r.id });
  }
  // A reunion: a neighborhood the player left long ago, where people they knew are still about.
  const me = archiveIdOf(state.player);
  for (const x of H.past.filter((x) => x.who === me && x.to != null && state.year - yearOf(x.to) >= 15)) {
    if (x.hood === currentHome(state)?.h) continue;
    const old = Object.values(H.res).filter((r) => r.met?.[me] != null && !r.dead && r.id.startsWith(`npc_${x.hood}r`) && (!state.npcs[r.id] || state.npcs[r.id].alive));
    if (old.length >= 2 && luck(state, `reunion/${x.hood}/${state.year}`).chance(0.15)) {
      queueScene(state, 'hood_reunion', { words: { hood: H.list[x.hood].name, names: old.slice(0, 3).map((r) => r.f).join(', '), hoodId: x.hood } }, `reunion/${x.hood}/${me}`, T(state.year));
    }
  }
  // Old disagreements fade: nobody is still cross about the bins after two years.
  for (const d of H.disputes) if (d.status === 'open' && state.year - yearOf(d.t) >= 2) d.status = 'faded';
  // People in the same neighborhood see each other without trying: closeness there does not fade from neglect, so
  // neighbors are never a chore to keep up with. An acquaintance who has soured to nothing drops out of the player's
  // life (they are still there, and can be met again).
  const p = state.player;
  const here = currentHome(state);
  for (const n of p.npcIds.map((id) => state.npcs[id]).filter((x) => x?.alive && H.res[x.id])) {
    const home = H.hhs[H.res[n.id].hh]?.home;
    if (here && home && proximity(state, here.id, home).near >= 2) n.lastInteractionAge = Math.max(n.lastInteractionAge ?? -1, p.age - 1);
    if (n.role === 'neighbor' && n.meters.relationship < 10 && !n.flags.tag) { p.npcIds = p.npcIds.filter((id) => id !== n.id); n.flags.drifted = { year: state.year, age: p.age, role: 'neighbor' }; }
  }
    // A year of talk, for the year just lived; and a wrong story going round the player's own street.
  for (const hood of Object.values(H.list)) if (active(state, hood)) Talk.spread(state, hood, state.year - 1);
  if (here) {
    const rumor = Talk.rumorToSettle(state, here.h);
    if (rumor && state.player.age >= 16) {
      const cast = rumor.person ? { person: rumor.person, words: {} } : { words: { person: H.res[rumor.res].f, res: rumor.res } };
      cast.words.rumor = Talk.factText(rumor.f); cast.words.factId = rumor.f.id; cast.words.count = String(rumor.count);
      queueScene(state, 'hood_rumor', cast, `rumor/${rumor.f.id}`, T(state.year));
    }
  }
  // Friend groups: three or more people who live near each other and are friends with the player.
  groups(state);
  forget(state);
}

/** A turn between years: the months just lived, and where the player lives now. */
export function between(state = store.state) {
  hoods(state);
  catchUp(state);
  syncDeaths(state);
  settle(state);
  syncAssets(state);
}
export { syncAssets };

// ---------- Friend groups ----------

/**
 * Children and teenagers on the same street who are all the player's friends become a group of friends: the same
 * friend groups as anywhere else in the game (engine/together.js, `flags.circle`), with their nights out and falling
 * outs. There is no second kind of group for neighbors.
 */
export function groups(state = store.state) {
  const H = hoods(state);
  const p = state.player;
  const here = currentHome(state);
  if (!here || p.age > 19) return;
  const friends = knownIn(state, here.h).filter((n) => n.role === 'friend' && Math.abs(n.age - p.age) <= 4);
  if (friends.length < 2 || friends.some((n) => n.flags.circle)) return;
  const circle = `circle_${friends[0].id}`;
  for (const n of friends) n.flags.circle = circle;
  (p.flags.circles ??= {})[circle] = state.year;
  note(state, { t: nowT(state), h: here.h, k: 'group', text: `${p.firstName}, ${friends.map((n) => n.firstName).join(' and ')} became a group of friends.`, who: meId(p) });
  void H;
}

// ---------- Views ----------

/** Everything the House Chronicle can say about a home: who lived there and when, and who owns it. */
export function homeHistory(state, homeId) {
  const H = hoods(state);
  const home = H.homes[homeId];
  if (!home) return null;
  const hood = H.list[home.h];
  return {
    home, hood, block: H.blocks[home.b],
    households: home.occ.map((o) => ({ ...o, hh: H.hhs[o.hh] ?? null, mine: !!(H.hhs[o.hh]?.me || H.hhs[o.hh]?.fam), people: (H.hhs[o.hh]?.m ?? []).map((ref) => personOf(state, ref)?.name).filter(Boolean) })),
    owner: home.own === 'player' ? 'Your family' : home.own === 'family' ? 'Your family' : home.own === 'hh' ? 'Whoever lives there' : H.blocks[home.b].ll ?? 'A landlord',
    events: H.log.filter((x) => x.home === homeId),
  };
}

/** A property the player owns or owned, as a neighborhood home (for the House Chronicle in engine/globalStory.js). */
export const homeForAsset = (assetId, state = store.state) => Object.values(hoods(state).homes).find((h) => h.asset === assetId) ?? null;

/** The places the whole family has lived, oldest first, with the neighborhood, the household and the neighbors they knew. */
export function placesWeCalledHome(state = store.state) {
  const H = hoods(state);
  return H.past.map((x) => {
    const home = H.homes[x.home]; const hood = H.list[x.hood];
    return { ...x, label: home?.label, type: home ? homeTypeName(home.t, hood?.c) : null, hoodName: hood?.name, city: hood?.city, countryId: hood?.c, current: x.to == null && x.who === archiveIdOf(state.player),
      years: `${yearOf(x.from)}–${x.to == null ? 'now' : yearOf(x.to)}` };
  }).sort((a, b) => a.from - b.from);
}

/** The neighborhood chronicle for one neighborhood, oldest first. */
export const chronicle = (state, hoodId) => hoods(state).log.filter((x) => x.h === hoodId).sort((a, b) => a.t - b.t);
export { yearOf, monthOfT, nowT, personOf, living };

/**
 * A life has ended and the family carries on (engine/legacy.js): the neighborhoods go on as they were. The person who
 * died leaves their home and household (their years there stay on record), and the heir takes their own place: in
 * the same household, if they lived with them.
 */
export function handOver(old, next, heirNpcId) {
  if (!old.hoods) return;
  next.hoods = old.hoods;
  const H = hoods(next);
  const t = T(old.year, old.month ?? 0);
  const dead = `@${archiveIdOf(old.player)}`;
  for (const x of H.past) if (x.who === archiveIdOf(old.player) && x.to == null) { x.to = t; x.why2 = 'died'; }
  const hh = H.cur ? H.hhs[H.cur.hh] : null;
  for (const h of Object.values(H.hhs)) if (h.m.includes(dead)) h.m = h.m.filter((x) => x !== dead);
  // Relatives who live in a household (the family home, the player's own) are the same people: they stay in the world,
  // outside the heir's circle if they are not the heir's family. Someone who only lived there once is history.
  for (const h of Object.values(H.hhs)) {
    for (const ref of h.m) if (!isPlayerRef(ref) && !H.res[ref] && !next.npcs[ref] && old.npcs[ref] && h.home && old.npcs[ref].alive) next.npcs[ref] = old.npcs[ref];
    h.m = h.m.filter((ref) => isPlayerRef(ref) || H.res[ref] || next.npcs[ref] || ref === heirNpcId);
  }
  if (hh) {
    if (heirNpcId && hh.m.includes(heirNpcId)) {
      hh.m = hh.m.map((x) => (x === heirNpcId ? `@${next.player.archiveId ?? heirNpcId}` : x));
      hh.me = false; hh.fam = true; H.family = hh.id;
    }
    if (H.cur?.home && !living(next, hh).length) { leaveHome(next, H.homes[H.cur.home], t, `${old.player.firstName} died`); hh.to = t; }
  }
  if (H.cur?.home) note(next, { t, h: H.homes[H.cur.home].h, k: 'died', text: `${old.player.firstName} ${old.player.lastName} died, at ${old.player.age}.`, who: dead, home: H.cur.home });
  H.cur = null;
  H.seen = {};
}
