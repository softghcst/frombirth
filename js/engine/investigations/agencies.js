// Agencies: police departments, sheriff's offices, state and national police, and federal field
// offices. Each is an employer in engine/employers.js (its name, staff and history) with an agency
// record beside it: its kind, units, leadership, laboratory and vacancies. Made the first time
// anyone needs one, and kept.
//
//   W().agencies[id] = { id, kind, name, countryId, city, employerId, size, units: { [specialty]: Unit },
//                        chiefId, ftoIds[], officerIds[], labId, vacancies[], history[], reputation }
//   Unit = { specialty, seats, memberIds[], headId }
//   W().offices[id]  = { id, agency: 'fbi'|'dea'|'atf', name, city, countryId, employerId, sacId, squads, agentIds[], labId,
//                        prosecutorIds[], vacancies[] }
//   W().labs[id]     = { id, name, ownerId, analystIds[], since }
//
// The people in them are ordinary NPCs kept with the justice system's officials (engine/cases.js:
// flags.justice), so they age, retire and die like everyone else (engine/justice.js).
import { rng } from '../../rng.js';
import { store, player } from '../../state.js';
import { COUNTRIES } from '../../data/countries.js';
import { regionOf, CITY_ROWS } from '../../data/cities.js';
import { policeName } from '../../data/justice.js';
import { AGENCY_KINDS, SPECIALTIES, DEPT_SIZE, FEDERAL } from '../../data/investigations.js';
import { makeNpc } from '../npcFactory.js';
import { registerEmployer, employer, chronicle } from '../employers.js';
import * as k from '../cases.js';
import { W, nextId, year, seeded, me } from './core.js';
import { coverageOf } from '../../data/investigations.js';

export { coverageOf };

/** How big a city's department is (0 small, 1 mid, 2 large). Gameplay configuration. */
const BIG = { 'us/New York': 2, 'us/Chicago': 2, 'us/Seattle': 1, 'us/Atlanta': 1, 'us/Austin': 1, 'us/Denver': 1, 'us/Orlando': 1 };
export function deptSize(countryId, city) {
  const known = BIG[`${countryId}/${city}`];
  if (known != null) return DEPT_SIZE(known);
  return DEPT_SIZE(COUNTRIES[countryId]?.cities[0] === city ? 2 : 1);
}

/** A justice official of an agency: an NPC who ages and retires with the rest (engine/justice.js). */
export function staffer(countryId, kind, occupation, o = {}) {
  const npc = makeNpc({ role: 'official', countryId, age: o.age ?? rng.int(26, 56), relationship: 40, gender: o.gender });
  npc.occupation = occupation;
  npc.flags.justice = { kind, skill: o.skill ?? rng.int(45, 75), since: year(), caseIds: [], countryId };
  npc.flags.inv = { agencyId: o.agencyId ?? null, role: o.role ?? kind, rank: o.rank ?? null, specialty: o.specialty ?? null };
  store.state.npcs[npc.id] = npc;
  k.J().people.push(npc.id);
  return npc;
}
const alive = (id) => { const n = store.state.npcs[id]; return !!n?.alive && !n.flags.justice?.retired; };

/** The kinds of agency that recruit in a country. */
export function kindsIn(countryId) {
  // A country with its own police structure modeled uses it; the rest have one simplified national service.
  const own = Object.entries(AGENCY_KINDS).filter(([, a]) => a.countries?.includes(countryId)).map(([id]) => id);
  return own.length ? own : Object.entries(AGENCY_KINDS).filter(([, a]) => !a.countries).map(([id]) => id);
}

/** An agency of a kind in a city, made the first time it is asked for. */
export function agencyOf(kind, countryId, city) {
  const w = W();
  const key = `${kind}:${countryId}/${city}`;
  const found = Object.values(w.agencies).find((a) => a.key === key);
  if (found) return refresh(found);
  const def = AGENCY_KINDS[kind];
  const region = CITY_ROWS[countryId]?.[city]?.region ?? regionOf(countryId, city);
  const name = kind === 'national' ? policeName(countryId, city) : def.name_(city, region, COUNTRIES[countryId].name);
  const e = registerEmployer({ name, family: 'safety', tracks: ['police', 'detective', 'forensics'], countryId, city, owned: false });
  e.size = 'large';
  e.culture = 'supportive';
  const size = kind === 'state' ? 1 : deptSize(countryId, city);
  const a = { id: nextId('agency'), key, kind, name, countryId, city, employerId: e.id, size, units: {}, chiefId: null, ftoIds: [], officerIds: [],
    labId: null, vacancies: [], history: [], reputation: 55, simplified: !!def.simplified || coverageOf(countryId) === 'simplified', founded: e.founded };
  w.agencies[a.id] = a;
  // Investigative units: a small department has one general unit; a large one has dedicated divisions.
  for (const [id, s] of Object.entries(SPECIALTIES)) {
    if (s.minDept > size || (id !== 'general' && size === 0)) continue;
    if (id === 'general' && size >= 2) continue;
    a.units[id] = { specialty: id, seats: id === 'general' ? 4 : s.high ? 4 : 3, memberIds: [], headId: null };
  }
  if (!Object.keys(a.units).length) a.units.general = { specialty: 'general', seats: 4, memberIds: [], headId: null };
  const lab = { id: nextId('lab'), name: size >= 2 ? `${name} Crime Laboratory` : `${COUNTRIES[countryId].name} State Crime Laboratory`, ownerId: a.id, analystIds: [], since: year() };
  w.labs[lab.id] = lab;
  a.labId = lab.id;
  chronicle(e, `${name} keeps records from ${year()}.`);
  return refresh(a);
}

/** Fills the seats a department needs with people: a chief, field training officers, officers, detectives, analysts. */
function refresh(a) {
  const c = a.countryId;
  if (!alive(a.chiefId)) a.chiefId = staffer(c, 'officer', AGENCY_KINDS[a.kind]?.chief?.(a.city) ?? 'Chief of police', { agencyId: a.id, rank: 'chief', age: rng.int(48, 62), skill: rng.int(60, 82) }).id;
  a.ftoIds = a.ftoIds.filter(alive);
  while (a.ftoIds.length < 2) a.ftoIds.push(staffer(c, 'officer', 'Field training officer', { agencyId: a.id, rank: 'senior', role: 'fto', age: rng.int(32, 52), skill: rng.int(55, 80) }).id);
  a.officerIds = a.officerIds.filter(alive);
  while (a.officerIds.length < 3) a.officerIds.push(staffer(c, 'officer', 'Police officer', { agencyId: a.id, rank: 'officer' }).id);
  for (const u of Object.values(a.units)) {
    u.memberIds = u.memberIds.filter((id) => id === me() || alive(id));
    if (!alive(u.headId)) u.headId = staffer(c, 'detective', `Detective sergeant, ${SPECIALTIES[u.specialty].name.toLowerCase()}`, { agencyId: a.id, rank: 'detective_sergeant', specialty: u.specialty, age: rng.int(38, 56), skill: rng.int(60, 85) }).id;
    while (u.memberIds.filter((id) => id !== me()).length < Math.max(1, u.seats - 2)) u.memberIds.push(staffer(c, 'detective', 'Detective', { agencyId: a.id, rank: 'detective', specialty: u.specialty, age: rng.int(30, 55) }).id);
  }
  const lab = W().labs[a.labId];
  if (lab) { lab.analystIds = lab.analystIds.filter(alive); while (lab.analystIds.length < 2) lab.analystIds.push(staffer(c, 'staff', 'Forensic scientist', { agencyId: a.id, role: 'analyst', skill: rng.int(55, 85) }).id); }
  return a;
}
export const agency = (id) => (id ? W().agencies[id] ?? null : null);
export const office = (id) => (id ? W().offices[id] ?? null : null);
export const lab = (id) => (id ? W().labs[id] ?? null : null);

/** Agencies recruiting where the player lives (made the first time). */
export function agenciesHere(p = player()) {
  return kindsIn(p.countryId).map((kind) => agencyOf(kind, p.countryId, p.city));
}

/**
 * The vacancies an agency has for a role this year: detective seats in its units, and ranks. Kept on
 * the agency so the same vacancy is seen by everyone who applies, and filled once.
 */
export function vacancies(a, kind) {
  const y = year();
  a.vacancies = a.vacancies.filter((v) => v.status === 'open' ? v.closes >= y : v.year >= y - 8);
  if (kind === 'detective' && !a.vacancies.some((v) => v.kind === 'detective' && v.status === 'open' && v.year === y)) {
    // A seat opens when a unit is short, or when someone leaves: seeded by the agency and the year, so it is the same for every turn length.
    // A seat opens when someone leaves or a unit grows: one or two a year in a department, seeded by the agency and the
    // year so it is the same for every turn length. Units that need experience as a detective (homicide, cold cases)
    // are open only to detectives (careers.applyDetective checks).
    const r = seeded(`${a.id}/detective/${y}`);
    const units = Object.keys(a.units).filter((id) => !SPECIALTIES[id].oversight);
    const n = r.chance(0.85) ? (a.size >= 2 && r.chance(0.5) ? 2 : 1) : 0;
    for (let i = 0; i < n && units.length; i++) {
      const unit = units.splice(Math.floor(r.next() * units.length), 1)[0];
      a.vacancies.push({ id: nextId('vac'), kind: 'detective', unit, year: y, closes: y, status: 'open', applicants: [], filledBy: null });
    }
  }
  return a.vacancies.filter((v) => v.kind === kind && v.status === 'open');
}

// ---------- Federal field offices (the US only) ----------

/** A federal agency's office in a city, made the first time. */
export function officeOf(agencyKey, city, countryId = 'us') {
  const w = W();
  const key = `${agencyKey}:${countryId}/${city}`;
  const found = Object.values(w.offices).find((o) => o.key === key);
  const def = FEDERAL[agencyKey];
  if (found) return refreshOffice(found);
  const name = def.office(city);
  const e = registerEmployer({ name, family: 'government', tracks: [def.career], countryId, city, owned: false });
  e.size = 'major';
  const o = { id: nextId('office'), key, agency: agencyKey, name, city, countryId, employerId: e.id, sacId: null, supervisorIds: [], agentIds: [], labId: null,
    prosecutorIds: [], vacancies: [], history: [], simplified: true };
  const l = { id: nextId('lab'), name: `${def.short} laboratory (serving ${name})`, ownerId: o.id, analystIds: [], since: year() };
  w.labs[l.id] = l;
  o.labId = l.id;
  w.offices[o.id] = o;
  chronicle(e, `${name} keeps records from ${year()}.`);
  return refreshOffice(o);
}
function refreshOffice(o) {
  const c = o.countryId;
  if (!alive(o.sacId)) o.sacId = staffer(c, 'officer', 'Special agent in charge', { agencyId: o.id, rank: 'sac', age: rng.int(46, 58), skill: rng.int(65, 85) }).id;
  o.supervisorIds = o.supervisorIds.filter(alive);
  while (o.supervisorIds.length < 2) o.supervisorIds.push(staffer(c, 'officer', 'Supervisory special agent', { agencyId: o.id, rank: 'supervisory', age: rng.int(38, 54), skill: rng.int(60, 82) }).id);
  o.agentIds = o.agentIds.filter(alive);
  while (o.agentIds.length < 4) o.agentIds.push(staffer(c, 'detective', 'Special agent', { agencyId: o.id, rank: 'agent', age: rng.int(27, 50) }).id);
  // Federal cases are prosecuted by the federal prosecutor's office for the district, not the local one.
  o.prosecutorIds = o.prosecutorIds.filter(alive);
  while (o.prosecutorIds.length < 2) o.prosecutorIds.push(staffer(c, 'prosecutor', 'Assistant United States attorney', { agencyId: o.id, role: 'prosecutor', skill: rng.int(55, 85) }).id);
  const l = W().labs[o.labId];
  if (l) { l.analystIds = l.analystIds.filter(alive); while (l.analystIds.length < 2) l.analystIds.push(staffer(c, 'staff', 'Forensic examiner', { agencyId: o.id, role: 'analyst', skill: rng.int(60, 88) }).id); }
  return o;
}
/** Cities where a federal agency has an office (the US cities the game has). Simplified: see data/investigations.js. */
export const federalCities = () => COUNTRIES.us.cities;

/** The prosecutor who would take a case from this agency or office. */
export function prosecutorFor(ownerId, countryId) {
  const o = office(ownerId);
  if (o) return store.state.npcs[rng.pick(o.prosecutorIds)];
  return k.pick(k.bench(countryId).prosecutors);
}
export const employerOf = (ownerId) => employer(agency(ownerId)?.employerId ?? office(ownerId)?.employerId);
export const ownerName = (ownerId) => agency(ownerId)?.name ?? office(ownerId)?.name ?? 'the agency';
