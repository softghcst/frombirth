// Cases in the real local world. A business case happens at a real employer of the city (engine/employers.js), whose
// own history records it; a cyber case's reporting person may have real accounts in Digital Life (engine/digital),
// named in the file; a witness may be a real resident of one of the city's neighborhoods (engine/neighborhood.js),
// the same person the player could meet next door. A police officer can go to a neighborhood's community meeting.
//
// Nothing here uses the game's dice: places and people are chosen by stable keys, so a case is the same on every load
// and the dice of the case itself are untouched.
import { store, player } from '../../state.js';
import { cityEmployers, chronicle } from '../employers.js';
import { hoods, residentsOf, materialize, ageOf } from '../neighborhood.js';
import { activeAccountsOf } from '../digital/accounts.js';
import { PLATFORM_BY_ID } from '../../data/digital.js';
import { rec, now, year, result, regard, grow, seeded, once, working } from './core.js';
import { investigation, caseStatus } from './casework.js';

const FAMILIES = { burglary: ['retail', 'hospitality', 'trades'], fraud: ['corporate', 'retail', 'trades', 'transport'], cyber: ['retail', 'tech'],
  arson: ['retail', 'hospitality', 'trades'] };

/** A real employer of the city where a business case happens, or null (then the case keeps its own place names). */
export function realBusiness(tid, countryId, city, key) {
  if (!FAMILIES[tid]) return null;
  let list;
  try { list = cityEmployers(countryId, city); } catch { return null; }
  const fit = list.filter((e) => FAMILIES[tid].includes(e.family));
  const pool = fit.length ? fit : list.filter((e) => !['government', 'safety'].includes(e.family));
  if (!pool.length) return null;
  return seeded(`${key}/place`).pick(pool);
}
/** A real resident of one of the city's neighborhoods, made a full person (the same one the player could meet). */
export function neighborWitness(countryId, city, key, exclude = []) {
  const H = hoods();
  const list = Object.values(H.list).filter((h) => h.c === countryId && h.city === city);
  const people = list.flatMap((h) => residentsOf(store.state, h.id)).filter((r) => ageOf(r) >= 16 && !exclude.includes(r.id) && !String(r.id).startsWith('@'));
  if (!people.length) return null;
  const pick = seeded(`${key}/neighbor`).pick(people);
  const n = materialize(store.state, pick.id);
  if (!n?.alive) return null;
  n.flags.justice ??= { caseIds: [] };
  return n;
}
/** Ties a new case to its place: the employer's history, the reporting person's real accounts. */
export function placeCase(inv, o) {
  const f = inv.file;
  if (o.employer) {
    f.employerId = o.employer.id;
    chronicle(o.employer, `Reported ${f.template === 'fraud' ? 'money missing from its accounts' : f.template === 'cyber' ? 'customers\' accounts taken over' : f.template === 'arson' ? 'a fire on its premises' : 'a break-in'} to the police.`);
  }
  if (f.template === 'cyber') {
    let accts = [];
    try { accts = activeAccountsOf(f.reportingId); } catch { accts = []; }
    const a = accts[0];
    if (a) {
      f.digital = { accountId: a.id, platformId: a.platformId, handle: a.handle };
      f.log.push({ at: now(), text: `The reporting person's own account, @${a.handle} on ${PLATFORM_BY_ID[a.platformId]?.name ?? a.platformId}, was among those taken over.` });
    }
  }
}

// ---------- Community meetings ----------

/** Neighborhoods in the player's city that hold a community meeting this year. */
export function meetingsHere(p = player()) {
  return Object.values(hoods().list).filter((h) => h.c === p.countryId && h.city === p.city).slice(0, 4);
}
/**
 * A police officer at a neighborhood's community meeting, once a year. Listening is what earns trust; a tip about an
 * open case may come from it, as a lead to follow (never as evidence: a lead is checked like any other).
 */
export function communityMeeting(hoodId, how = 'listen') {
  const p = player();
  const r = rec(p);
  if (!working(r) || r.family === 'federal' || r.family === 'private') return result(false, 'Community meetings are for the local police.', 'neutral');
  const h = hoods().list[hoodId];
  if (!h || h.city !== p.city) return result(false, 'That neighborhood is not in your city.', 'neutral');
  if (!once(`community:${hoodId}`, r)) return result(false, 'You went to this neighborhood\'s meeting this year.', 'neutral');
  r.community ??= {};
  const before = r.community[hoodId] ?? 50;
  const delta = how === 'listen' ? 8 : how === 'present' ? 3 : -6;
  r.community[hoodId] = Math.max(0, Math.min(100, before + delta));
  if (how === 'listen') { grow('interviewing', 1); regard('teamwork', 1); }
  if (how === 'defend') regard('ethics', -1);
  const H = hoods();
  (H.log ??= []).push({ t: now(), h: hoodId, k: 'meeting', text: `${p.firstName} ${p.lastName}, a police officer, came to the community meeting.` });
  // A tip, sometimes, for an open case in the city: a lead, checked like any other.
  const open = (r.caseIds ?? []).map(investigation).filter((inv) => inv?.file && !inv.file.outcome && ['active', 'suspect'].includes(caseStatus(inv)));
  const tipCase = open.find((inv) => seeded(`${inv.id}/${hoodId}/${year()}/tip`).chance(how === 'listen' ? 0.35 + r.community[hoodId] / 400 : 0.1));
  let tip = '';
  if (tipCase) {
    tipCase.file.leads.push({ id: `tip_${hoodId}_${year()}`, text: `At the ${h.name} community meeting, someone mentioned seeing something the night of ${tipCase.file.title}. It needs checking.`, why: 'A tip at a community meeting', status: 'open', at: now() });
    tip = ` Afterwards someone takes you aside about ${tipCase.file.title}: a lead to check, not a fact.`;
  }
  const text = { listen: `You mostly listen: parking, speeding on the main road, a burglary two streets over. People notice that you wrote it down.`,
    present: 'You present the year\'s figures. A few questions; polite applause.', defend: 'You defend the department on every complaint. The room cools.' }[how];
  return result(true, text + tip, how === 'defend' ? 'bad' : 'good');
}
