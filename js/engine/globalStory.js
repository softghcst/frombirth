// Views of one world. Places I've Lived, Our Global Story, the House
// Chronicle and a person's geographic history are all read here from the
// same records: the player's residence history (p.locations), everyone
// else's (n.places, engine/globalLife.syncNpcPlaces), the archive of past
// lives, completed trips, and the canonical events (engine/chronicle.js).
// Nothing here is stored: every screen is a projection, so a move recorded
// once appears everywhere at once, with the same ids.
import { store, player } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { coords, jurisdictionAt, placeName } from './geo.js';
import { events, visible, archiveIdOf, archivedPeople, archived, homeOnRecord } from './chronicle.js';
import { held } from './citizenship.js';
import { roleLabel } from './relationships.js';
import { homeForAsset, homeHistory, hoods } from './neighborhood.js';

const GEN = { grandparent: -2, parent: -1, sibling: 0, spouse: 0, partner: 0, ex: 0, relative: 0, cousin: 0, child: 1, niece: 1, grandchild: 2, greatgrandchild: 3, inlaw: 0 };
const year = () => store.state.year;
/** The year someone was born: from their age now, or at death. Unknown for someone whose death year was never recorded. */
const bornYear = (n) => (n.alive ? year() - (n.age ?? 0) : n.flags?.diedYear != null ? n.flags.diedYear - (n.age ?? 0) : null);

/** Everyone in the family's history: the archive, the player, and relatives in the save. */
export function familyPeople(p = player()) {
  const g = p.generation ?? 1;
  const me = archiveIdOf(p);
  const out = new Map();
  for (const a of archivedPeople()) out.set(a.id, { id: a.id, kind: 'archived', name: `${a.firstName} ${a.lastName}`, firstName: a.firstName, generation: a.generation ?? 1, alive: false,
    born: a.born, died: a.died, places: a.places ?? [], trips: a.trips ?? [], appearance: a.appearance, relation: 'Ancestor', citizenships: a.citizenships ?? [] });
  out.set(me, { id: me, kind: 'player', name: `${p.firstName} ${p.lastName}`, firstName: p.firstName, generation: g, alive: p.alive, relation: 'You',
    born: { year: p.birthYear, countryId: p.birthCountryId, city: p.birthCity ?? null }, places: locations(p), trips: (p.travel?.trips ?? []).filter((t) => t.status === 'completed'),
    appearance: p.appearance, citizenships: p.citizenships ?? held(p).map((j) => ({ jurisdictionId: j, acquisitionType: 'birth' })), npcId: null });
  for (const id of p.npcIds) {
    const n = store.state.npcs[id];
    if (!n || n.role === 'pet' || !(n.role in GEN)) continue;
    const aid = archiveIdOf(n);
    if (out.has(aid)) { out.get(aid).npcId = n.id; continue; } // an ancestor who is also in the save (the previous player): the same person
    out.set(aid, { id: aid, kind: 'npc', npcId: n.id, name: `${n.firstName} ${n.lastName}`, firstName: n.firstName, generation: g + GEN[n.role], alive: n.alive, relation: roleLabel(n),
      born: { year: bornYear(n), countryId: n.bornIn ?? null, city: n.birthCity ?? null }, died: n.alive ? null : n.flags?.diedYear ?? null, places: n.places ?? [], trips: [], appearance: n.appearance, citizenships: n.citizenships ?? null });
  }
  return [...out.values()];
}

/** The player's residence history, with the place of birth first. Derived entries (older saves) are marked. */
export function locations(p = player()) {
  if (p.locations?.length) return p.locations;
  const out = [{ countryId: p.birthCountryId, city: p.birthCity ?? null, from: p.birthYear, reason: 'born', derived: true }];
  if (p.countryId !== p.birthCountryId) { out[0].to = p.flags.arrivedYear ?? null; out.push({ countryId: p.countryId, city: p.city, from: p.flags.arrivedYear ?? null, derived: true }); }
  else out[0].city ??= p.city;
  return out;
}

// ---------- Places I've Lived ----------

/**
 * The player's residences, oldest first: where, under which jurisdiction then,
 * from when to when, why they moved, the homes, who came, and what is remembered there.
 */
export function placesLived(p = player()) {
  const me = archiveIdOf(p);
  const all = events((e) => e.people.includes(me) && visible(e, me));
  const list = locations(p);
  return list.map((l, i) => {
    const from = l.from ?? null;
    const to = l.to ?? null;
    const move = l.eventId ? all.find((e) => e.id === l.eventId) : null;
    const inRange = (e) => (e.place?.countryId === l.countryId) && (from == null || e.year >= from) && (to == null || e.year <= to);
    const homes = (l.homes ?? []).map((id) => homeRecord(id, p)).filter(Boolean);
    return {
      index: i, countryId: l.countryId, city: l.city ?? null, from, to, current: i === list.length - 1 && p.alive,
      name: COUNTRIES[l.countryId]?.name ?? l.countryId, flag: COUNTRIES[l.countryId]?.flag ?? '',
      jurisdiction: jurisdictionAt(l.countryId, from ?? year(), l.city), reason: l.reason ?? (i === 0 ? 'born' : null), derived: !!l.derived,
      move: move ? { id: move.id, title: move.title, text: move.text } : null,
      homes, people: move ? move.people.filter((x) => x !== me).map((x) => personName(x)).filter(Boolean) : [],
      neighborhoods: (l.hoods ?? []).map((id) => hoods().list[id]).filter(Boolean).map((h) => ({ id: h.id, name: h.name })),
      memories: all.filter((e) => inRange(e) && e.id !== l.eventId && ['trip', 'travel_memory', 'travel_milestone', 'family_visit', 'birth', 'belonging'].includes(e.type)).slice(0, 8),
    };
  });
}

// ---------- People ----------

export function personName(archiveId) {
  const x = familyPeople().find((y) => y.id === archiveId);
  if (x) return x.name;
  const n = Object.values(store.state.npcs).find((m) => archiveIdOf(m) === archiveId);
  return n ? `${n.firstName} ${n.lastName}` : null;
}

/**
 * One person's geography: birth, every place lived, trips, and the events
 * the viewer may see. Restricted papers stay restricted: an ancestor's
 * nationality history is shown as family history; their applications are not.
 */
export function personHistory(archiveId, p = player()) {
  const me = archiveIdOf(p);
  const x = familyPeople(p).find((y) => y.id === archiveId);
  const n = x?.npcId ? store.state.npcs[x.npcId] : Object.values(store.state.npcs).find((m) => archiveIdOf(m) === archiveId);
  const base = x ?? (n ? { id: archiveId, kind: 'npc', npcId: n.id, name: `${n.firstName} ${n.lastName}`, firstName: n.firstName, alive: n.alive, relation: roleLabel(n),
    born: { year: bornYear(n), countryId: n.bornIn ?? null, city: n.birthCity ?? null }, places: n.places ?? [], trips: [], appearance: n.appearance } : null);
  if (!base) return null;
  const seen = events((e) => (e.subject === archiveId || e.people.includes(archiveId)) && visible(e, me));
  const shared = archiveId === me ? [] : seen.filter((e) => e.people.includes(me) || e.subject === me);
  const memories = n?.memories ?? [];
  return {
    ...base,
    bornName: base.born?.countryId ? placeName(base.born.countryId, base.born.city, base.born.year) : 'Not recorded',
    places: (base.places ?? []).map((l) => ({ ...l, name: COUNTRIES[l.countryId]?.name ?? l.countryId, flag: COUNTRIES[l.countryId]?.flag ?? '', jurisdiction: jurisdictionAt(l.countryId, l.from ?? year(), l.city) })),
    countries: [...new Set((base.places ?? []).map((l) => l.countryId))],
    events: seen.sort((a, b) => a.year - b.year), shared, memories,
    citizenship: base.kind === 'archived' || archiveId === me || base.kind === 'npc'
      ? (base.citizenships ?? []).map((c) => ({ name: COUNTRIES[c.jurisdictionId]?.name ?? c.jurisdictionId, how: c.acquisitionType, since: c.acquiredAt ?? null, lost: c.lostAt ?? null })) : [],
    applicationsPrivate: archiveId !== me,
  };
}

// ---------- Homes ----------

/** A property as the family's history knows it: owned now, or remembered from someone's residence record. */
function homeRecord(id, p = player()) {
  const a = p.assets.find((x) => x.id === id);
  if (a) return { id, name: a.name, countryId: a.countryId ?? p.countryId, city: a.city ?? (a.countryId && a.countryId !== p.countryId ? null : p.city), owned: true, tenant: !!a.tenant };
  const known = homeOnRecord(id);
  if (known) return { id, name: known.name, countryId: known.countryId, city: known.city, owned: false };
  // Known only from a move away from it: it stood where the move started.
  const ev = events((e) => e.propertyId === id)[0];
  const at = ev?.type === 'relocation' ? ev.from : ev?.place;
  return { id, name: 'A former home', countryId: at?.countryId ?? null, city: at?.city ?? null, owned: false };
}

/**
 * The House Chronicle: who lived in a home, when, who owns it now, and what
 * happened there. Ownership and living there are kept apart.
 */
export function homeChronicle(propertyId, p = player()) {
  const home = homeRecord(propertyId, p);
  if (!home) return null;
  const residents = [];
  for (const person of familyPeople(p)) {
    for (const l of person.places ?? []) if ((l.homes ?? []).includes(propertyId)) residents.push({ id: person.id, name: person.name, from: l.from ?? null, to: l.to ?? null, current: person.kind === 'player' && l.to == null });
  }
  if (p.homeId === propertyId && !residents.some((r) => r.id === archiveIdOf(p) && r.current)) residents.push({ id: archiveIdOf(p), name: `${p.firstName} ${p.lastName}`, from: null, to: null, current: true });
  const a = p.assets.find((x) => x.id === propertyId);
  return {
    ...home, where: home.countryId ? placeName(home.countryId, home.city) : 'Unknown',
    owner: a ? 'You' : 'Not owned by you', livedInNow: p.homeId === propertyId, let: !!a?.tenant, bought: a?.boughtAtAge != null ? p.birthYear + a.boughtAtAge : null,
    residents: residents.sort((x, y) => (x.from ?? 0) - (y.from ?? 0)),
    events: events((e) => e.propertyId === propertyId && visible(e)),
    // Where it stands and every household that has lived in it, the family's and others' (engine/neighborhood.js).
    ...neighborhoodOf(propertyId),
  };
}

/** The neighborhood a property stands in, and the households that lived in it, from the neighborhood record. */
function neighborhoodOf(propertyId) {
  const home = homeForAsset(propertyId);
  const h = home ? homeHistory(store.state, home.id) : null;
  if (!h) return {};
  return { neighborhood: { id: h.hood.id, name: h.hood.name, homeId: home.id, label: home.label, street: h.block.name },
    households: h.households.map((o) => ({ name: o.mine ? `Your family (${o.n})` : `The ${o.n} household`, from: Math.floor(o.from / 12), to: o.to == null ? null : Math.floor(o.to / 12), why: o.left ?? null, mine: o.mine })) };
}

// ---------- Our Global Story ----------

const KIND_WORDS = { born: 'Born here', lived: 'Lived here', visited: 'Visited', moved: 'Moved here' };

/**
 * The whole family across places and generations, filtered. Markers are real
 * saved places, positioned from GeoNames; a person known only by country is
 * placed at its capital and marked approximate. No route is drawn that was
 * not traveled: moves connect the places a recorded move connected.
 * @param {{generation?:number|null, person?:string|null, country?:string|null, from?:number|null, to?:number|null, kinds?:string[]}} f
 */
export function globalStory(f = {}, p = player()) {
  const me = archiveIdOf(p);
  const kinds = new Set(f.kinds?.length ? f.kinds : ['born', 'lived', 'visited', 'moved']);
  const people = familyPeople(p);
  const inPeriod = (y1, y2) => (f.from == null || (y2 ?? year()) >= f.from) && (f.to == null || (y1 ?? -Infinity) <= f.to);
  const wanted = people.filter((x) => (f.generation == null || x.generation === f.generation) && (!f.person || x.id === f.person));
  const items = [];
  for (const x of wanted) {
    if (kinds.has('born') && x.born?.countryId && inPeriod(x.born.year, x.born.year)) items.push({ kind: 'born', person: x.id, name: x.name, countryId: x.born.countryId, city: x.born.city, year: x.born.year });
    if (kinds.has('lived')) for (const l of x.places ?? []) if (inPeriod(l.from, l.to)) items.push({ kind: 'lived', person: x.id, name: x.name, countryId: l.countryId, city: l.city ?? null, year: l.from ?? null, to: l.to ?? null, homes: l.homes ?? [] });
    if (kinds.has('visited')) for (const t of x.trips ?? []) {
      const c = t.destination?.countryId ?? t.countryId; const city = t.destination?.city ?? t.city;
      const y = Number(String(t.depart ?? '').slice(0, 4)) || null;
      if (c && inPeriod(y, y)) items.push({ kind: 'visited', person: x.id, name: x.name, countryId: c, city, year: y, tripId: t.id });
    }
  }
  const ids = new Set(wanted.map((x) => x.id));
  const moves = kinds.has('moved') ? events((e) => e.type === 'relocation' && visible(e, me) && (ids.has(e.subject) || e.people.some((q) => ids.has(q))) && inPeriod(e.year, e.year)) : [];
  for (const e of moves) items.push({ kind: 'moved', person: e.subject, name: personName(e.subject), countryId: e.place?.countryId, city: e.place?.city, year: e.year, eventId: e.id, from: e.from ?? null });
  const shown = items.filter((i) => i.countryId && COUNTRIES[i.countryId] && (!f.country || i.countryId === f.country));
  // Markers: one per place, with everything that happened there.
  const markers = new Map();
  for (const i of shown) {
    const key = `${i.countryId}/${i.city ?? ''}`;
    const c = coords(i.countryId, i.city);
    if (!c) continue;
    const m = markers.get(key) ?? { key, countryId: i.countryId, city: i.city, lat: c.lat, lon: c.lon, approx: c.approx || !i.city, kinds: new Set(), people: new Set(), items: [] };
    m.kinds.add(i.kind); m.people.add(i.person); m.items.push(i);
    markers.set(key, m);
  }
  // Lines only for recorded moves, from the place left to the place reached.
  const lines = moves.filter((e) => e.from?.countryId && e.place?.countryId).map((e) => ({ eventId: e.id, from: coords(e.from.countryId, e.from.city), to: coords(e.place.countryId, e.place.city) })).filter((l) => l.from && l.to);
  const timeline = shown.slice().sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
    .map((i) => ({ ...i, label: `${i.name}: ${KIND_WORDS[i.kind]} — ${placeName(i.countryId, i.city, i.year ?? year())}`, where: placeName(i.countryId, i.city, i.year ?? year()) }));
  const generations = [...new Set(people.map((x) => x.generation))].sort((a, b) => a - b);
  return {
    people, generations, timeline, lines,
    markers: [...markers.values()].map((m) => ({ ...m, kinds: [...m.kinds], people: [...m.people], name: placeName(m.countryId, m.city) })),
    countries: [...new Set(items.map((i) => i.countryId).filter((c) => COUNTRIES[c]))].sort((a, b) => COUNTRIES[a].name.localeCompare(COUNTRIES[b].name)),
    international: events((e) => e.type === 'relocation' && e.international && visible(e, me)),
    births: events((e) => e.type === 'birth' && visible(e, me)),
    reunions: events((e) => e.type === 'family_visit' && visible(e, me)),
  };
}

export { archived };
