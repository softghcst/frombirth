// The working life around the cases: managing a caseload (setting a priority, asking for support, handing routine
// work to a partner), moving within an agency (a federal transfer, a specialized squad), task force meetings,
// a private agency's staff taking matters on, commendations and high-profile cases, and the work an investigator
// can do after retiring (teaching at an academy, consulting, expert testimony, a memoir from the public record).
//
// All of it works on records that already exist: the investigation's own file, the agency and office records,
// the business engine's staff, the fame profile. Nothing here decides a case.
import { store, player, country } from '../../state.js';
import { clamp, localMoney, fmtMoney } from '../../util.js';
import { FEDERAL, SPECIALTIES, PI_SERVICES } from '../../data/investigations.js';
import * as biz from '../business.js';
import * as fame from '../fame.js';
import * as k from '../cases.js';
import { I, rec, W, now, year, me, result, note, grow, regard, seeded, reputationOf, working, once, dateWords, nameOfId } from './core.js';
import { officeOf, federalCities, office } from './agencies.js';
import { investigation, workLeft, caseStatus, act, steps } from './casework.js';
import { inquiryStep, completeInquiry } from './private.js';

const npc = (id) => store.state.npcs[id];
const nm = (id) => nameOfId(id);
const ACTIVE = ['active', 'suspect', 'awaiting laboratory', 'suspect evaluation'];
/** The player's open cases they can still work. */
export const openCases = (p = player()) => (rec(p)?.caseIds ?? []).map(investigation).filter((inv) => inv?.file && !inv.file.outcome && ACTIVE.includes(caseStatus(inv)));

// ---------- Caseload ----------

const addHours = (f, n) => { f.extra ??= {}; f.extra[year()] = (f.extra[year()] ?? 0) + n; };

/** Sets one case as this year's priority: more hours on it, fewer on the others. */
export function prioritize(invId) {
  const r = rec();
  const inv = investigation(invId);
  if (!working(r) || !inv || !r.caseIds.includes(invId)) return result(false, 'This case is not yours.', 'neutral');
  if (openCases().length < 2) return result(false, 'With one case, it already has all your time.', 'neutral');
  r.priority = { year: year(), invId };
  inv.file.log.push({ at: now(), text: 'Made the priority of the caseload this year.' });
  grow('planning', 1);
  return result(true, `${inv.file.title} comes first this year. The other cases get less of your time.`, 'neutral');
}

/** Asks the supervisor for help on a case: granted when the caseload is heavy or the case is serious, once a year. */
export function requestSupport(invId) {
  const r = rec();
  const inv = investigation(invId);
  if (!working(r) || !inv || !r.caseIds.includes(invId)) return result(false, 'This case is not yours.', 'neutral');
  if (!once(`support:${invId}`, r)) return result(false, 'You asked this year already.', 'neutral');
  const sup = r.people.supervisorId;
  const heavy = openCases().length >= 3;
  const serious = ['homicide', 'missing', 'family'].includes(inv.file.template);
  const roll = seeded(`${invId}/support/${year()}`);
  const yes = (heavy || serious) && roll.chance(0.5 + reputationOf(r) / 200) || roll.chance(0.15);
  if (!yes) { inv.file.log.push({ at: now(), text: 'Asked for support; the unit had nobody to spare.' }); return result(true, `${sup ? nm(sup) : 'Your supervisor'} hears you out, and has nobody to spare this year.`, 'neutral'); }
  const helper = officeOrUnitColleague(r);
  addHours(inv.file, 3);
  inv.file.log.push({ at: now(), text: `Support approved: ${helper ? nm(helper) : 'another investigator'} helps on the file this year.` });
  grow('teamwork', 1); regard('teamwork', 1);
  return result(true, `${sup ? nm(sup) : 'Your supervisor'} agrees. ${helper ? nm(helper) : 'Another investigator'} will help on ${inv.file.title} this year.`);
}
function officeOrUnitColleague(r) {
  const ids = Object.values(W().agencies).flatMap((a) => (a.id === r.job?.agencyId ? Object.values(a.units ?? {}).find((u) => u.specialty === r.job.specialty)?.memberIds ?? [] : []))
    .concat(office(r.job?.officeId)?.agentIds ?? []);
  return ids.find((id) => id !== me() && id !== r.people.partnerId && npc(id)?.alive) ?? null;
}

const ROUTINE = ['scene', 'specialist', 'examiner', 'urgency', 'search', 'timeline', 'family'];
/** Hands the routine work on a case to the partner: they take up to two documented steps, on their own hours. */
export function delegate(invId) {
  const r = rec();
  const inv = investigation(invId);
  if (!working(r) || !inv || !r.caseIds.includes(invId)) return result(false, 'This case is not yours.', 'neutral');
  const partner = r.people.partnerId;
  if (!partner || !npc(partner)?.alive) return result(false, 'You have no partner to hand it to.', 'neutral');
  if (!once(`delegate:${invId}`, r)) return result(false, `${npc(partner).firstName} already took the routine work this year.`, 'neutral');
  const todo = steps(inv).filter((s) => ROUTINE.includes(s.id)).slice(0, 2);
  if (!todo.length) return result(false, 'What is left on this case needs your own judgment.', 'neutral');
  addHours(inv.file, todo.length);
  const done = [];
  for (const s of todo) { const res = act(invId, s.id); if (res.ok) done.push(s.label.toLowerCase()); }
  inv.file.log.push({ at: now(), text: `${nm(partner)} took the routine work: ${done.join('; ')}.` });
  regard('teamwork', 1);
  const n = npc(partner); if (n) n.meters.relationship = clamp(n.meters.relationship + 2);
  return result(true, `${n.firstName} takes it: ${done.join('; ')}. The judgment calls stay with you.`);
}

// ---------- Moving within an agency ----------

/** The squads a federal office has: its agency's jurisdiction, in the cases the game models. */
export const SQUADS = {
  fbi: [['fraud', 'White-collar crime'], ['cyber', 'Cyber'], ['corruption', 'Public corruption'], ['violent', 'Violent crime']],
  dea: [['drugs', 'Enforcement group'], ['diversion', 'Diversion (prescription drugs)']],
  atf: [['firearms', 'Firearms trafficking'], ['arson', 'Arson and explosives']],
};
/** Asks for a transfer to another field office, or a place on a squad. Decided after six months, on the record. */
export function requestMove(kind, target) {
  const p = player();
  const r = rec(p);
  if (!working(r) || r.family !== 'federal' || !r.job.officeId) return result(false, 'Only a serving agent can ask the agency for a move.', 'neutral');
  if (r.move?.status === 'pending') return result(false, `Your request is with the agency until ${dateWords(r.move.due)}.`, 'neutral');
  if (kind === 'office') {
    if (!federalCities().includes(target) || office(r.job.officeId)?.city === target) return result(false, 'That is not a field office you can ask for.', 'neutral');
    if (year() - (r.job.rankSince ?? r.job.since) < 2 && year() - r.job.since < 3) return result(false, 'Agents serve some years in their first office before a transfer is considered.', 'neutral');
  } else if (!SQUADS[r.job.agencyKind]?.some(([id]) => id === target) || r.job.squad === target) return result(false, 'That is not a squad you can ask for.', 'neutral');
  r.move = { kind, target, asked: now(), due: now() + 6, status: 'pending' };
  return result(true, `Your request is in. The agency will answer by ${dateWords(r.move.due)}.`, 'neutral');
}
function settleMove(p, r) {
  const m = r.move;
  if (!m || m.status !== 'pending' || m.due > now()) return [];
  const roll = seeded(`${me(p)}/move/${m.asked}`);
  const study = m.kind === 'squad' && ({ fraud: ['accounting', 'finance'], cyber: ['cybersecurity', 'computer_science'] }[m.target] ?? []).some((x) => p.education.degrees.some((d) => d.majorId === x));
  const yes = roll.chance(0.35 + reputationOf(r) / 250 + (study ? 0.2 : 0));
  m.status = yes ? 'granted' : 'refused';
  if (!yes) { note(m.kind === 'office' ? `Asked for a transfer to ${m.target}; it was not granted this time.` : 'Asked for a place on a squad; it went to someone else this time.', 'career', { log: false }); return [m.kind === 'office' ? `The transfer to ${m.target} was not granted.` : 'The squad place went to someone else.']; }
  if (m.kind === 'squad') {
    r.job.squad = m.target;
    const name = SQUADS[r.job.agencyKind].find(([id]) => id === m.target)[1];
    note(`Joined the ${name.toLowerCase()} squad.`, 'career', { key: `squad:${m.target}:${year()}` });
    return [`You join the ${name.toLowerCase()} squad.`];
  }
  const o = officeOf(r.job.agencyKind, m.target);
  const old = office(r.job.officeId);
  if (old) old.agentIds = old.agentIds.filter((x) => x !== me(p));
  if (!o.agentIds.includes(me(p))) o.agentIds.push(me(p));
  r.job.officeId = o.id; r.job.employerId = o.employerId; p.career.employerId = o.employerId;
  r.people.formerPartnerIds.push(...[r.people.partnerId].filter(Boolean));
  r.people.partnerId = o.agentIds.find((x) => x !== me(p) && npc(x)?.alive) ?? null;
  r.people.supervisorId = o.supervisorIds[0] ?? null;
  r.pendingMove = m.target !== p.city ? m.target : null;
  r.stats.agencies = [...new Set([...r.stats.agencies, o.id])];
  note(`Transferred to ${o.name}.`, 'career', { key: `transfer:${o.id}`, milestone: `Transferred to ${o.name}.` });
  return [`The transfer is granted: ${o.name}.${r.pendingMove ? ' The move is part of the job.' : ''}`];
}

// ---------- Task force meetings ----------

/** A task force's working meeting, once a year: how the player's side works with the other agency. */
export function taskForceMeeting(invId, how) {
  const r = rec();
  const inv = investigation(invId);
  const tf = inv?.file?.taskForceId && W().taskForces[inv.file.taskForceId];
  if (!working(r) || !tf || !r.caseIds.includes(invId)) return result(false, 'There is no task force on this case.', 'neutral');
  if (!once(`tf:${tf.id}`, r)) return result(false, 'The task force met this year already.', 'neutral');
  tf.meetings = [...(tf.meetings ?? []), { at: now(), how }];
  if (how === 'share') {
    addHours(inv.file, 2);
    tf.trust = (tf.trust ?? 50) + 10;
    grow('interagency', 3); regard('teamwork', 2);
    inv.file.log.push({ at: now(), text: 'The task force met: leads and records shared both ways; who does what agreed.' });
    return result(true, 'Everything is on the table. The other agency takes some of the work, and the case moves faster.');
  }
  if (how === 'deconflict') {
    addHours(inv.file, 1);
    tf.trust = (tf.trust ?? 50) + 4;
    grow('interagency', 2);
    inv.file.log.push({ at: now(), text: 'The task force met to deconflict: nobody interviews the same person twice.' });
    return result(true, 'You agree who talks to whom. Nobody tramples anybody else\'s witness.');
  }
  tf.trust = (tf.trust ?? 50) - 15;
  regard('teamwork', -3);
  inv.file.log.push({ at: now(), text: 'The task force met; the department kept its best leads to itself.' });
  if (tf.trust < 30) { tf.status = 'ended'; inv.file.log.push({ at: now(), text: 'The federal side withdrew from the task force.' }); return result(true, 'You keep your best leads back. The other agency notices, and withdraws from the task force.', 'bad'); }
  return result(true, 'You keep your best leads back. The other agency notices.', 'bad');
}

// ---------- A private agency's staff ----------

/** Gives an open matter to a member of the agency's staff, who works it with lawful steps by its due date. */
export function assignInquiry(inquiryId, staffId) {
  const q = W().inquiries[inquiryId];
  if (!q || q.status !== 'open') return result(false, 'That matter is closed.', 'neutral');
  const b = biz.business(q.businessId);
  const s = b && biz.staffOf(b).find((x) => x.id === staffId);
  if (!s) return result(false, 'They do not work for the agency.', 'neutral');
  q.assignedTo = staffId;
  q.assignedDue = now() + (PI_SERVICES[q.service]?.months ?? 2);
  return result(true, `${nm(staffId)} takes the matter on, and will report by ${dateWords(q.assignedDue)}.`, 'neutral');
}
function settleInquiries(p) {
  const out = [];
  for (const q of Object.values(W().inquiries)) {
    if (q.status !== 'open' || !q.assignedTo || q.assignedDue > now()) continue;
    if (!rec(p)?.inquiryIds?.includes(q.id)) continue;
    // Staff take the lawful steps; how well depends on them, not on the player's skills.
    for (const step of ['client', 'public', 'people', 'report']) if (!q.steps.includes(step)) {
      q.steps.push(step);
      const useful = q.truth === 'answer' && step !== 'report' && step !== 'client' && seeded(`${q.id}/${q.assignedTo}/${step}`).chance(0.5);
      if (useful) q.findings.push(step === 'public' ? 'The public records turn up an address.' : 'A former neighbor remembers where they moved.');
    }
    const res = completeInquiry(q.id);
    out.push(`${nm(q.assignedTo)} closed a matter for the agency. ${res.text}`);
  }
  return out;
}

// ---------- Commendations and high-profile cases ----------

const AWARDS = {
  commendation: 'Commendation for thorough, lawful work',
  merit: 'Medal of merit',
  exoneration: 'Recognition for clearing an innocent person',
  investigator: 'Investigator of the year',
};
/** A year's recognition, decided on how the work was done, never on arrest or conviction counts. */
function awardsYear(p, r) {
  if (!working(r) || ['academy', 'federal_training'].includes(r.stage)) return [];
  const out = [];
  // Cases finished since the last year's recognition (the year turns before this runs).
  const closed = r.caseIds.map(investigation).filter((inv) => inv?.file?.outcome && Math.floor(inv.file.outcome.at / 12) >= year() - 1);
  const clean = r.rep.integrity >= 60 && r.rep.ethics >= 55 && !r.discipline.some((d) => d.year >= year() - 3 && d.finding === 'substantiated');
  const give = (id, why) => {
    if (r.stats.awards.some((a) => a.id === id && a.year === year())) return;
    r.stats.awards.push({ id, name: AWARDS[id], year: year(), why });
    note(`${AWARDS[id]}: ${why}`, 'career', { key: `award:${id}:${year()}`, milestone: AWARDS[id], significance: id === 'investigator' ? 2 : 1 });
    out.push(`${AWARDS[id]}.`);
  };
  if (!clean) return out;
  const roll = seeded(`${me(p)}/awards/${year()}`);
  if (closed.some((inv) => inv.file.cleared?.length && inv.file.outcome.kind !== 'convicted') && roll.chance(0.4)) give('exoneration', 'The evidence cleared someone who had been suspected.');
  if (closed.length && roll.chance(0.25 + reputationOf(r) / 400)) give('commendation', 'A case completed thoroughly, lawfully and on the record.');
  if (closed.some((inv) => ['homicide', 'missing', 'corruption'].includes(inv.file.template)) && reputationOf(r) >= 65 && roll.chance(0.3)) give('merit', 'A serious case, carefully done.');
  if (reputationOf(r) >= 75 && r.stats.years >= 5 && roll.chance(0.12)) give('investigator', 'Chosen by peers and supervisors.');
  // A high-profile case in court makes the investigator's name known a little. Publicity is not reputation.
  for (const inv of closed) {
    const c = inv.file.courtCaseId && k.J().cases[inv.file.courtCaseId];
    if (!c || !['homicide', 'corruption'].includes(inv.file.template) || inv.file.publicized) continue;
    inv.file.publicized = year();
    fame.gain({ audience: 'public', amount: 4, lasting: 0.2, why: `Lead investigator in ${inv.file.title}` }, p);
    out.push(`${inv.file.title} was in the news; your name was in it.`);
  }
  return out;
}

// ---------- After retiring ----------

export const SECOND = {
  instructor: { name: 'Academy instructor', text: 'Teaching recruits law, report writing and de-escalation, part-time.', pay: 26000, needs: (r) => r.stats.years >= 10 && reputationOf(r) >= 50 },
  consultant: { name: 'Investigative consultant', text: 'Reviewing case files for agencies, law firms and insurers, by contract.', pay: 34000, needs: (r) => r.stats.years >= 12 && r.skills.reasoning >= 55 },
  expert: { name: 'Expert witness', text: 'Explaining investigative practice to courts, for whichever side asks, within what the evidence shows.', pay: 18000, needs: (r) => r.stats.years >= 15 && r.rep.integrity >= 60 },
  memoir: { name: 'A memoir', text: 'A book about the work, from the public record. Case files and witnesses stay private.', pay: 0, needs: (r) => r.stats.years >= 5, once: true },
};
export function secondOptions(p = player()) {
  const r = rec(p);
  if (!r?.retired) return [];
  return Object.entries(SECOND).map(([id, d]) => ({ id, ...d, block: d.needs(r) ? (d.once && r.second?.memoir ? 'Written already.' : r.second?.role === id ? 'This is your work now.' : '') : 'Needs more years and standing in the work.' }));
}
/** Takes up work after retiring, or writes the memoir (honestly from the public record, or not). */
export function takeSecond(id, how = 'public') {
  const p = player();
  const r = rec(p);
  const d = SECOND[id];
  if (!r?.retired || !d) return result(false, 'This is for after retiring from investigative work.', 'neutral');
  if (!d.needs(r)) return result(false, 'Needs more years and standing in the work.', 'neutral');
  r.second ??= {};
  if (id === 'memoir') {
    if (r.second.memoir) return result(false, 'You wrote it already.', 'neutral');
    r.second.memoir = { year: year(), how };
    if (how === 'files') {
      // Telling what was in case files and witness statements: a breach of the people who trusted the investigation.
      regard('ethics', -10); regard('integrity', -8);
      fame.gain({ audience: 'public', amount: 6, why: 'A memoir that told what case files held' }, p);
      p.finance.cash += localMoney(40000, country());
      note('Published a memoir that told what was in case files.', 'career', { key: 'memoir', milestone: 'Published a memoir' });
      return result(true, 'The book sells. Some of the people in it recognize themselves, and did not agree to be there.', 'bad');
    }
    fame.gain({ audience: 'public', amount: 3, lasting: 0.3, why: 'A memoir about investigative work' }, p);
    p.finance.cash += localMoney(15000, country());
    note('Published a memoir about the work, from the public record.', 'career', { key: 'memoir', milestone: 'Published a memoir' });
    return result(true, 'The book is honest about the work, and keeps faith with the people in it.');
  }
  r.second.role = id;
  r.second.since = year();
  note(`Took up work as ${d.name.toLowerCase()}.`, 'career', { key: `second:${id}:${year()}`, milestone: `${d.name}` });
  return result(true, `${d.name}: ${d.text}`);
}
function secondYear(p, r) {
  const d = r?.retired && SECOND[r.second?.role];
  if (!d || !d.pay || p.age >= 75) return [];
  const pay = localMoney(d.pay, country());
  p.finance.cash += pay;
  if (r.second.role === 'instructor') grow('leadership', 1);
  return [`${d.name}: ${fmtMoney(pay, country())} this year.`];
}

/** What the calendar settles here: transfers and staff matters (also when the hub opens). */
export function settleWorkplace(p = player()) {
  const r = rec(p);
  if (!r) return [];
  return [...settleMove(p, r), ...settleInquiries(p)];
}
/** The year's part: recognition, and the pay of work after retiring. */
export function workplaceYear(p = player()) {
  const r = rec(p);
  if (!r) return [];
  return [...awardsYear(p, r), ...secondYear(p, r)];
}
