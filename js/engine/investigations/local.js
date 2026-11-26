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
import { TEMPLATES } from '../../data/investigations.js';
import { rec, W, now, year, result, regard, grow, seeded, once, working } from './core.js';
import * as k from '../cases.js';
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
  // A fatal collision: the person died in a real hospital of the city; the death is on their record.
  if (TEMPLATES[f.template]?.shared === 'collision' && f.victimId) {
    let hospitals = [];
    try { hospitals = cityEmployers(o.countryId ?? player().countryId, o.city ?? player().city).filter((e) => e.family === 'health'); } catch { hospitals = []; }
    const h = hospitals.length ? seeded(`${inv.id}/hospital`).pick(hospitals) : null;
    const v = store.state.npcs[f.victimId];
    if (v) { v.alive = false; v.flags.diedYear = year(); v.flags.causeOfDeath = 'Struck by a car'; }
    if (h) { f.hospitalId = h.id; f.log.push({ at: now(), text: `${v ? `${v.firstName} ${v.lastName}` : 'The pedestrian'} was taken to ${h.name} and died there that night.` }); }
  }
  // A homicide's victim is dead: their record says so, once, as the game's own death would.
  if (f.template === 'homicide' && f.victimId) { const v = store.state.npcs[f.victimId]; if (v?.alive) { v.alive = false; v.flags.diedYear = year(); v.flags.causeOfDeath = 'Homicide'; } }
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

// ---------- After a fatal collision: the family's claim ----------

/**
 * When a collision investigation ends, the family of the person who died may claim against the driver for the loss:
 * a civil matter, separate from any criminal case. A civil lawyer may take it (engine/lawPractice.js offers it); if
 * nobody does within a year, the driver's insurer settles it. The investigation's outcome is the claim's evidence.
 */
export function claims() { const w = W(); w.claims ??= {}; return w.claims; }
export function settleClaims() {
  const out = [];
  for (const inv of Object.values(k.J().investigations)) {
    const f = inv.file;
    if (!f || TEMPLATES[f.template]?.shared !== 'collision' || !f.outcome || f.claimId) continue;
    const inc = k.J().incidents[inv.incidentId];
    const driver = f.people.find((x) => x.role === 'insider')?.id ?? f.poi[0] ?? inc?.truth?.perpetratorId ?? null;
    if (!driver || !store.state.npcs[f.reportingId]?.alive) { f.claimId = 'none'; continue; }
    const id = `claim_${inv.id}`;
    claims()[id] = { id, invId: inv.id, familyId: f.reportingId, driverId: driver, deceasedId: f.victimId, hospitalId: f.hospitalId ?? null, countryId: inc?.countryId, city: inc?.city,
      outcome: f.outcome.kind, finding: f.outcome.finding ?? null, opened: f.outcome.at ?? now(), due: (f.outcome.at ?? now()) + 12, status: 'open', lawCaseId: null };
    f.claimId = id;
    f.log.push({ at: f.outcome.at ?? now(), text: `${store.state.npcs[f.reportingId].firstName} ${store.state.npcs[f.reportingId].lastName} began a claim against the driver for the loss.` });
  }
  for (const c of Object.values(claims())) {
    if (c.status !== 'open' || c.due > now()) continue;
    c.status = 'settled by insurer';
    const strong = c.outcome === 'convicted';
    c.amount = strong ? 250000 : c.finding === 'accident' ? 0 : 60000;
    const f = k.J().investigations[c.invId]?.file;
    f?.log.push({ at: now(), text: c.amount ? 'The driver\'s insurer settled the family\'s claim.' : 'The insurer refused the family\'s claim: the investigation found it was an accident nobody could have avoided.' });
  }
  return out;
}
/** Claims waiting for a lawyer in a city. */
export const openClaims = (countryId) => Object.values(claims()).filter((c) => c.status === 'open' && !c.lawCaseId && c.countryId === countryId);
