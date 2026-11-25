// Hospitals: the medical side of the health employers a city already has (engine/employers.js).
// An employer stays the employer (its name, size, staff, history, its postings for nurses and
// porters); this adds what a physician needs to know about it: what kind of hospital it is,
// whether it trains residents, which departments it has, and who leads them.
//
//   W().hospitals[employerId] = { id, kind, teaching, fellowships, resources, depts[], heads: { dept: npcId }, cmoId }
//
// Every city has at least one teaching hospital: if none of its health employers is one, a
// "{City} General Hospital" is put on the map the first time anyone needs it, and stays.
import { store, player } from '../../state.js';
import { CAREER_BY_ID } from '../../data/careers.js';
import { HOSPITAL_KINDS, DEPARTMENTS, SPECIALTY_BY_ID, RANKS } from '../../data/medicine.js';
import { cityOf } from '../cities.js';
import { cityEmployers, employer, registerEmployer, chronicle } from '../employers.js';
import { staffOf } from '../workplace.js';
import { makeNpc } from '../npcFactory.js';
import { W, seeded } from './core.js';

/** What a hospital is, from its name and its city (the same answer every time). */
function kindOf(e) {
  const big = ['capital', 'largest'].includes(cityOf(e.countryId, e.city)?.kind);
  const r = seeded(`hosp/${e.id}`);
  if (/Clinic/i.test(e.name)) return 'clinic';
  if (/Medical Center/i.test(e.name)) return big || e.size === 'major' ? 'academic' : 'regional';
  if (/General Hospital/i.test(e.name)) return big && e.size !== 'small' ? 'academic' : 'regional';
  if (/Children/i.test(e.name)) return 'childrens';
  if (/Hospital/i.test(e.name)) return r.next() < 0.25 ? 'regional' : 'community';
  return e.size === 'small' ? 'clinic' : 'community';
}

/** The medical record of a hospital employer. */
export function hospital(e) {
  if (typeof e === 'string') e = employer(e);
  if (!e || e.family !== 'health') return null;
  const all = W().hospitals;
  if (!all[e.id]) {
    const kind = e.medKind ?? kindOf(e);
    const k = HOSPITAL_KINDS[kind];
    all[e.id] = { id: e.id, kind, teaching: k.teaching, fellowships: k.fellowships, resources: k.resources,
      depts: k.depts === 'all' ? Object.keys(DEPARTMENTS) : [...k.depts], heads: {}, cmoId: null };
  }
  return all[e.id];
}
export const hospitalName = (id) => employer(id)?.name ?? 'the hospital';
export const kindName = (h) => HOSPITAL_KINDS[h.kind]?.name ?? 'Hospital';

/** The hospitals (and physician clinics) of a city, with their records. Every city has a teaching hospital. */
export function hospitalsIn(countryId = player().countryId, city = player().city) {
  let list = cityEmployers(countryId, city).filter((e) => e.family === 'health');
  if (!list.some((e) => hospital(e).teaching)) {
    const e = registerEmployer({ name: `${city} General Hospital`, family: 'health', tracks: ['doctor', 'nurse', 'surgery'], countryId, city, owned: false });
    e.size = 'large';
    e.medKind = 'regional';
    chronicle(e, `${city} General Hospital opened its residency programs.`);
    list = [...list, e];
  }
  // The rest of a city's health system, made once: a public health service everywhere; in a capital, a government
  // hospital; in the biggest cities, specialty hospitals for the heart and for bones and joints.
  const key = `${countryId}/${city}`;
  const done = (W().citySystems ??= {});
  if (!done[key]) {
    done[key] = true;
    const kind = cityOf(countryId, city)?.kind;
    const add = (name, medKind, size) => { const e = registerEmployer({ name, family: 'health', tracks: ['doctor', 'nurse'], countryId, city, owned: false }); e.size = size; e.medKind = medKind; list = [...list, e]; };
    add(`${city} Public Health Service`, 'public_health', 'medium');
    if (kind === 'capital') add(`${city} Government Hospital`, 'government', 'large');
    if (kind === 'capital' || kind === 'largest') { add(`${city} Heart Institute`, 'heart', 'large'); add(`${city} Orthopedic Hospital`, 'bone', 'medium'); }
    else add(`${city} Rural Health Center`, 'rural', 'small'); // the country around a smaller city is served by a rural facility
  }
  return list.map((e) => ({ e, h: hospital(e) }));
}

/** The department a specialty works in. */
export const deptOf = (specialtyId) => SPECIALTY_BY_ID[specialtyId]?.dept ?? 'medicine';
/** Whether a hospital has a department for this specialty. */
export const hasDept = (h, specialtyId) => h.depts.includes(deptOf(specialtyId));

/** Where a specialty can be trained in this city: teaching hospitals with the department (fellowships: those that run them). */
export function trainingSites(specialtyId, countryId, city) {
  const s = SPECIALTY_BY_ID[specialtyId];
  const all = hospitalsIn(countryId, city).filter(({ h }) => h.teaching && h.kind !== 'clinic');
  let fits = all.filter(({ h }) => hasDept(h, specialtyId) && (s.kind !== 'fellowship' || h.fellowships));
  // A city without the department still trains the specialty at its biggest teaching hospital, which adds it.
  if (!fits.length && all.length) {
    const best = [...all].sort((a, b) => (b.h.kind === 'academic') - (a.h.kind === 'academic') || b.h.resources - a.h.resources)[0];
    if (!best.h.depts.includes(deptOf(specialtyId))) best.h.depts.push(deptOf(specialtyId));
    if (s.kind === 'fellowship') best.h.fellowships = true;
    fits = [best];
  }
  return fits.sort((a, b) => b.h.resources - a.h.resources);
}

/** Hospitals and clinics in the city where a qualified physician in this specialty could work. */
export function workplacesFor(specialtyId, countryId, city) {
  return hospitalsIn(countryId, city).filter(({ h }) => hasDept(h, specialtyId));
}

/** The career (data/careers.js, data/occupations.js) that pays a physician in this specialty. */
export function careerFor(specialtyId) {
  const s = SPECIALTY_BY_ID[specialtyId];
  if (!s) return CAREER_BY_ID.doctor;
  if (s.profession === 'podiatry') return CAREER_BY_ID.podiatrist;
  if (specialtyId === 'psychiatry') return CAREER_BY_ID.psychiatry;
  if (s.surgical && s.id !== 'obgyn' && s.id !== 'ophthalmology') return CAREER_BY_ID.surgery;
  return CAREER_BY_ID.doctor;
}
/** The level of that career a rank is paid at. */
export function levelFor(rank, career) {
  const lv = RANKS[rank]?.level ?? 0;
  return Math.min(lv, career.levels.length - 1);
}

/**
 * The head of a department: a senior physician who is a real person, made the first time the
 * department needs one and kept. They are not in the player's life until the player meets them.
 */
export function deptHead(h, dept) {
  const e = employer(h.id);
  const id = h.heads[dept];
  const n = id ? store.state.npcs[id] : null;
  if (n?.alive && n.life?.job?.employerId === h.id) return n;
  const head = makeNpc({ role: 'colleague', countryId: e.countryId, age: 48 + seeded(`${h.id}/${dept}/${store.state.year}`).int(0, 14), relationship: 45 });
  head.flags.title = `Chief of ${DEPARTMENTS[dept] ?? 'Medicine'}`;
  head.flags.medRank = 'chief';
  head.flags.workedWith = e.name;
  head.occupation = head.flags.title.toLowerCase();
  head.life ??= { edu: { stage: 'done', gpa: 3.5, majorId: 'biology', trade: null, degrees: [], yearsLeft: 0 }, job: null, savings: 0, aspiration: null,
    partnerId: null, together: 0, married: false, kids: 0, history: [] };
  head.life.job = { careerId: 'doctor', level: 3, title: 'Chief of medicine', salary: 0, years: 8, employerId: e.id };
  store.state.npcs[head.id] = head;
  if (!e.staff.includes(head.id)) e.staff.push(head.id);
  h.heads[dept] = head.id;
  return head;
}

/** Physicians the player works with at a hospital (people already in their life first). */
export const colleaguesAt = (hospitalId) => staffOf(employer(hospitalId)).filter((n) => player().npcIds.includes(n.id));
