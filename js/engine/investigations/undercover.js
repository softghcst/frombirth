// Informants and undercover work, for detectives on drug, firearms and organized-crime cases and federal agents.
//
//   informants   a real person who knows the people in a case and talks to the police, for money or for their own
//                reasons. They are registered with a supervisor and paid from recorded funds, or they are not (and
//                that is misconduct). What they say is a tip: it may be true, or it may be revenge or invention.
//                A tip is never evidence on its own; checked against independent evidence, it can become some. Their
//                identity is protected; exposing it puts them in danger.
//   undercover   a long assignment inside a case: months in a role, within the rules (recordings of what people
//                offer to do, never pushing them to do it). Pushing is entrapment, and the court throws the evidence
//                out. It is dangerous and it weighs on the officer (wellbeing.js).
import { clamp } from '../../util.js';
import { store, player } from '../../state.js';
import * as k from '../cases.js';
import { W, rec, now, year, me, result, seeded, grow, regard, working, nameOfId, dateWords } from './core.js';
import { investigation, incidentOf } from './casework.js';
import { strain } from './wellbeing.js';

const npc = (id) => store.state.npcs[id] ?? null;
const nm = (id) => nameOfId(id);
const ORGANIZED = ['drugs', 'firearms', 'robbery', 'counterfeit'];
const fits = (inv) => inv?.file && ORGANIZED.includes(inv.file.template) && !inv.file.outcome;
const eligible = (r) => working(r) && (r.job.detective || r.family === 'federal');
const complain = (kind, text, invId = null) => { const id = `complaint_${kind}_${now()}_${invId ?? 'x'}`; W().complaints[id] = { id, subjectId: me(), kind, text, invId, opened: now(), due: now() + 6, status: 'open', true: true }; };

// ---------- Informants ----------

/** Recruits someone close to a case's people as an informant: a real person, registered or not. */
export function recruit(invId, how = 'register') {
  const r = rec();
  const inv = investigation(invId);
  if (!eligible(r) || !fits(inv) || inv.file.leadId !== me()) return result(false, 'Informants are for drug, firearms and organized-crime cases you lead.', 'neutral');
  if (inv.file.informantId) return result(false, 'This case has an informant.', 'neutral');
  const inc = incidentOf(inv);
  const person = k.civilian(inc.countryId, { age: 22 + seeded(`${invId}/ci`).int(0, 30), kind: 'civilian' });
  person.flags.informant = { handlerId: me(), registered: how === 'register', since: year(), invId, paid: 0, reliable: seeded(`${invId}/ci/rel`).chance(0.6), exposed: false };
  inv.file.informantId = person.id;
  r.informants = [...(r.informants ?? []), person.id];
  if (how !== 'register') { regard('integrity', -5); complain('informant', 'An officer ran an informant without registering them or recording payments.', invId); return result(true, `${nm(person.id)} will talk to you, off the books. Nobody else knows about them, and that is the problem.`, 'bad'); }
  inv.file.log.push({ at: now(), text: 'A confidential informant was registered with the supervisor. Their name is kept out of the file.' });
  return result(true, `${nm(person.id)} agrees to talk to you. Your supervisor registers them; payments will be recorded. Their name stays out of the case file.`);
}
/** A meeting with the informant: a tip, which may be true. Paid from recorded funds if they are registered. */
export function meetInformant(invId) {
  const inv = investigation(invId);
  const ci = npc(inv?.file?.informantId);
  const f = inv?.file;
  if (!ci?.flags.informant || ci.flags.informant.handlerId !== me()) return result(false, 'There is no informant on this case.', 'neutral');
  if (f.tipAt === year()) return result(false, 'You met them this year.', 'neutral');
  f.tipAt = year();
  const info = ci.flags.informant;
  info.paid += 1;
  const perp = incidentOf(inv).truth.perpetratorId;
  const someone = f.poi.find((x) => x !== perp) ?? f.poi[0];
  const names = info.reliable ? perp ?? someone : someone ?? perp;
  f.tip = { at: now(), pointsTo: names, accurate: !!names && names === perp, corroborated: false };
  f.leads.push({ id: `tip_${invId}_${year()}`, text: `The informant says ${names ? nm(names) : 'nobody they will name'} is behind it. A tip, not evidence: it has to be checked.`, why: 'A confidential informant', status: 'open', at: now() });
  return result(true, `${nm(ci.id)} names ${names ? nm(names) : 'nobody'}. Maybe it is true. Informants have their own reasons.`, 'neutral');
}
/** Checks the tip against independent evidence: if it holds, the surveillance that confirms it is evidence. */
export function corroborate(invId) {
  const inv = investigation(invId);
  const f = inv?.file;
  if (!f?.tip || f.tip.corroborated) return result(false, 'There is no tip to check.', 'neutral');
  f.tip.corroborated = true;
  grow('evidence', 2);
  if (!f.tip.accurate) return result(true, 'Surveillance shows nothing of what the informant described. The tip does not hold; it goes no further.', 'neutral');
  const ev = k.addEvidence(incidentOf(inv), 'physical', f.tip.pointsTo, { lawful: true, summary: `Surveillance confirms what the informant described, independently: ${nm(f.tip.pointsTo)} at the place, at the time.` });
  inv.evidenceIds.push(ev.id);
  if (!f.poi.includes(f.tip.pointsTo)) f.poi.push(f.tip.pointsTo);
  return result(true, 'Independent surveillance confirms it. That is evidence; the tip itself never was.');
}
/** Uses the tip alone as the reason for an order: a court will not accept it. */
export function tipAsBasis(invId) {
  const inv = investigation(invId);
  const f = inv?.file;
  if (!f?.tip) return result(false, 'There is no tip.', 'neutral');
  return result(true, f.tip.corroborated ? 'The corroborated surveillance is in the file: that can support a request.' : 'An uncorroborated tip from an informant is not a lawful basis for an order. Check it first.', 'neutral');
}

// ---------- Undercover ----------

/** Volunteers for an undercover assignment on a case: months in a role. */
export function goUndercover(invId) {
  const r = rec();
  const inv = investigation(invId);
  if (!eligible(r) || !fits(inv) || inv.file.leadId !== me()) return result(false, 'Undercover work is for drug, firearms and organized-crime cases you lead.', 'neutral');
  if (r.undercover?.status === 'active') return result(false, 'You are undercover already.', 'neutral');
  if (r.rep.integrity < 50) return result(false, 'Supervisors approve undercover work only for officers whose record they trust.', 'neutral');
  r.undercover = { invId, start: now(), end: now() + 12, status: 'active', rounds: [], recordings: 0, pushed: 0 };
  inv.file.log.push({ at: now(), text: 'An undercover operation was approved, with a cover officer and a plan, for a year.' });
  return result(true, `Approved. For the next year you are someone else, until ${dateWords(r.undercover.end)}. A cover officer watches your back.`);
}
/** A round of undercover work: within the rules, or pushing someone toward a crime they had not planned. */
export function undercoverRound(how = 'role') {
  const r = rec();
  const u = r?.undercover;
  if (u?.status !== 'active') return result(false, 'You are not undercover.', 'neutral');
  if (u.rounds.some((x) => x.year === year())) return result(false, 'This year\'s work in the role is done.', 'neutral');
  const inv = investigation(u.invId);
  u.rounds.push({ year: year(), how });
  strain(8, 'undercover');
  const exposed = seeded(`${u.invId}/exposed/${year()}`).chance(how === 'push' ? 0.3 : 0.12);
  if (exposed) {
    u.status = 'ended'; u.exposed = now();
    const p = player();
    p.stats.health = clamp(p.stats.health - 12);
    strain(20, 'exposed undercover');
    inv?.file?.log.push({ at: now(), text: 'The undercover officer\'s cover was blown. The cover team got them out.' });
    return result(true, 'Someone recognizes you. The cover team gets you out, hurt but alive. The operation is over.', 'bad');
  }
  const perp = incidentOf(inv).truth.perpetratorId;
  if (how === 'push') {
    u.pushed += 1;
    regard('ethics', -5);
    return result(true, 'You push: you offer the deal, you set the price, you make it easy. The recording shows that too.', 'bad');
  }
  if (perp) u.recordings += 1;
  return result(true, perp ? 'Weeks in the role. Someone offers, on their own, what you came to find. The wire records it.' : 'Weeks in the role. Nobody offers anything: maybe there is nothing to find.', 'neutral');
}
/** The end of an assignment: recordings become evidence; anything pushed for is entrapment, and is out. */
export function endUndercover() {
  const r = rec();
  const u = r?.undercover;
  if (!u || u.status !== 'active' || u.end > now()) return null;
  u.status = 'ended';
  const inv = investigation(u.invId);
  const perp = incidentOf(inv)?.truth?.perpetratorId;
  if (inv && perp && u.recordings) {
    const ev = k.addEvidence(incidentOf(inv), 'digital', perp, { lawful: u.pushed === 0, summary: `Recordings made undercover: ${nm(perp)} offering, unprompted.` });
    if (u.pushed) { ev.tainted = 'entrapment'; ev.summary = 'Recordings made undercover, after the officer pushed for the offer.'; }
    inv.evidenceIds.push(ev.id);
    if (!inv.file.poi.includes(perp)) inv.file.poi.push(perp);
  }
  inv?.file?.log.push({ at: now(), text: `The undercover operation ended. ${u.pushed ? 'The defense will say the offers were the officer\'s idea, and the recordings show it.' : 'What was recorded was offered freely.'}` });
  return `Your undercover assignment is over.${u.pushed ? ' What you pushed for will not stand in court.' : ''}`;
}
/** Exposing an informant (to a colleague who should not know, or in court without need) puts them in danger. */
export function exposeInformant(invId) {
  const ci = npc(investigation(invId)?.file?.informantId);
  if (!ci?.flags.informant) return result(false, 'There is no informant.', 'neutral');
  ci.flags.informant.exposed = now();
  regard('ethics', -8);
  complain('informant', 'An informant\'s identity was disclosed without need.', invId);
  return result(true, `${nm(ci.id)}'s name gets out. They have to leave the city. People who talk to the police stop doing so.`, 'bad');
}
