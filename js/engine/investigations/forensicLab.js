// The forensic scientist's working life (the 'forensics' track), around the bench in crossover.js: a discipline of
// their own, a laboratory with a backlog of requests from real cases, a yearly proficiency test that keeps the
// laboratory accredited, promotion up the track, and expert testimony in court on the reports they wrote.
//
// What the material shows was fixed when it was collected; what the scientist decides is which request comes first,
// how carefully the work is done, and how honestly it is reported and defended. A report that went beyond the work
// is found out under cross-examination, and the cases it touched are reviewed.
import { clamp } from '../../util.js';
import { store, player } from '../../state.js';
import { LAB, LAB_RESULTS } from '../../data/investigations.js';
import * as k from '../cases.js';
import { promote } from '../career.js';
import { W, now, year, me, nextId, result, seeded, nameOfId } from './core.js';
import { agencyOf, kindsIn } from './agencies.js';
import { openCase, investigation, incidentOf } from './casework.js';
import { bench } from './crossover.js';
import { budgetOf } from './policing.js';

const npc = (id) => store.state.npcs[id] ?? null;
const nm = (id) => nameOfId(id);
const TERMINAL = ['sentenced', 'acquitted', 'dismissed', 'quashed'];
const RANKS = ['Crime scene technician', 'Forensic investigator', 'Senior forensic scientist', 'Head of forensics'];

/** The scientist's own record, kept on the player. */
export function labRecord(p = player()) {
  if (p.career?.careerId !== 'forensics' && !p.forensicLab) return null;
  p.forensicLab ??= { discipline: null, since: year(), proficiency: [], accredited: true, reports: 0, careful: 0, overstated: 0, testified: 0, exposed: 0, reviews: [], policy: 'age' };
  return p.forensicLab;
}
/** The disciplines a scientist can specialize in this year. */
export const disciplinesNow = () => Object.entries(LAB).filter(([, d]) => year() >= d.from).map(([id, d]) => ({ id, name: d.name }));
export function specialize(id, p = player()) {
  const L = labRecord(p);
  if (!L) return result(false, 'This is for forensic scientists.', 'neutral');
  if (L.discipline) return result(false, `You specialize in ${LAB[L.discipline].name.toLowerCase().replace(/\bdna\b/g, "DNA")}.`, 'neutral');
  if (!LAB[id] || year() < LAB[id].from) return result(false, 'That discipline is not practiced yet.', 'neutral');
  L.discipline = id;
  if (id === 'digital') p.career.title = (p.career.level ?? 0) >= 2 ? 'Senior digital forensic examiner' : 'Digital forensic examiner';
  return result(true, `You train in ${LAB[id].name.toLowerCase().replace(/\bdna\b/g, "DNA")}. Most of your requests will be in it now.`);
}

// ---------- The backlog ----------

const KINDS = ['burglary', 'robbery', 'homicide', 'arson', 'collision', 'fraud'];
/** The requests that reach the laboratory this year: more when the department's budget is tight, from real cases. */
export function labYear(p = player()) {
  const L = labRecord(p);
  if (!L || p.career?.careerId !== 'forensics' || !p.alive) return [];
  const a = agencyOf(kindsIn(p.countryId)[0], p.countryId, p.city);
  const budget = budgetOf(a).level; // -1 cut, 0 level, 1 increase
  const roll = seeded(`${me(p)}/lab/${year()}`);
  const n = Math.max(1, 3 - budget + roll.int(0, 1));
  const out = [];
  // What was left from last year is still waiting: overdue now.
  const waiting = bench(p).filter((b) => b.status === 'open');
  for (const b of waiting) if (b.due && b.due < now() && !b.overdue) { b.overdue = true; const inv = investigation(b.invId); inv?.file?.log.push({ at: now(), text: `The laboratory request for ${inv.file.items.find((x) => x.id === b.itemId)?.label.toLowerCase() ?? 'an item'} is overdue: the case waits.` }); }
  if (L.suspended === year()) return ['Off casework this year, until the corrective plan is done.'];
  if (waiting.length >= 6) return [`Your bench has ${waiting.length} requests waiting. No new ones are sent until it clears.`];
  for (let i = 0; i < n; i++) {
    const det = Object.values(a.units).flatMap((u) => u.memberIds).find((id) => npc(id)?.alive);
    const tid = roll.pick(KINDS.filter((t) => t !== 'collision' || year() >= 1950));
    const inv = openCase(tid, { ownerId: a.id, lead: det });
    const items = inv.file.items.filter((x) => x.disciplines.length);
    const it = items.find((x) => L.discipline && x.disciplines.includes(L.discipline)) ?? items[0];
    if (!it) continue;
    const discipline = L.discipline && it.disciplines.includes(L.discipline) ? L.discipline : it.disciplines[0];
    const id = nextId('bench');
    W().bench[id] = { id, invId: inv.id, itemId: it.id, discipline, analystId: me(p), status: 'open', steps: [], received: now(), due: now() + LAB[discipline].months + 1, detectiveId: det, serious: ['homicide', 'collision', 'robbery'].includes(tid) };
    it.custody.push({ at: now(), by: det, act: 'collected and logged' }, { at: now(), by: me(p), act: 'received at the laboratory' });
    out.push(`A request from ${inv.file.title}: ${LAB[discipline].name.toLowerCase().replace(/\bdna\b/g, "DNA")}.`);
  }
  return out;
}
/** The bench in the order the laboratory works it: by age, or serious cases first. */
export function queue(p = player()) {
  const L = labRecord(p);
  const list = bench(p).filter((b) => b.status === 'open');
  return L?.policy === 'serious' ? list.sort((x, y) => Number(!!y.serious) - Number(!!x.serious) || x.received - y.received) : list.sort((x, y) => x.received - y.received);
}
/** How the laboratory takes its requests. A head of forensics sets it for everyone; others for their own bench. */
export function setPolicy(policy, p = player()) {
  const L = labRecord(p);
  if (!L || !['age', 'serious'].includes(policy)) return result(false, 'Nothing to set.', 'neutral');
  L.policy = policy;
  return result(true, policy === 'serious' ? 'Violent crimes and deaths go to the front of the queue. The burglaries wait longer.' : 'Requests are worked in the order they came in. Nobody jumps the queue.', 'neutral');
}

// ---------- Proficiency and accreditation ----------

/**
 * The yearly proficiency test: a blind sample, answer unknown. Done carefully it is usually passed; rushing it, or
 * looking for the answer, is not passing it. A failure is disclosed, and the scientist's recent reports are reviewed.
 */
export function proficiency(how = 'careful', p = player()) {
  const L = labRecord(p);
  if (!L || p.career?.careerId !== 'forensics') return result(false, 'This is for forensic scientists.', 'neutral');
  if (L.proficiency.some((x) => x.year === year())) return result(false, 'You sat this year\'s test.', 'neutral');
  if (how === 'peek') {
    L.proficiency.push({ year: year(), passed: false, peeked: true });
    L.accredited = false;
    L.suspended = year();
    p.career.performance = clamp(p.career.performance - 20);
    return result(true, 'You asked a colleague what the answer was. The quality manager found out. The test is failed, and the laboratory reports it to its accrediting body.', 'bad');
  }
  const roll = seeded(`${me(p)}/proficiency/${year()}`);
  const passed = roll.chance(how === 'careful' ? 0.9 : 0.65);
  L.proficiency.push({ year: year(), passed });
  if (passed) { p.career.performance = clamp(p.career.performance + 3); return result(true, 'Passed. The sample was what you said it was, and your notes show how you got there.'); }
  // A failure: recent reports are looked at again.
  L.suspended = year();
  const recent = bench(p).filter((b) => b.status === 'reported' && b.reportedAt >= now() - 24);
  L.reviews.push({ year: year(), why: 'proficiency', cases: recent.map((b) => b.invId) });
  return result(true, `Failed. You are taken off casework until a corrective plan is done, and ${recent.length} recent report${recent.length === 1 ? ' is' : 's are'} reviewed. It is disclosed to the prosecutors and defense on those cases.`, 'bad');
}

/** The year's step for the track: promotion on years, careful work and passed tests; accreditation restored. */
export function careerYear(p = player()) {
  const L = labRecord(p);
  if (!L || p.career?.careerId !== 'forensics') return [];
  const out = [];
  const passes = L.proficiency.filter((x) => x.year >= year() - 3 && x.passed).length;
  if (!L.accredited && passes >= 1 && L.proficiency.at(-1)?.passed) { L.accredited = true; out.push('The laboratory\'s accreditation is restored.'); }
  const lvl = p.career.level ?? 0;
  const years = year() - (L.since ?? year());
  const need = [2, 5, 10][lvl];
  if (need != null && years >= need && passes >= Math.min(2, lvl + 1) && L.careful >= (lvl + 1) * 2 && L.overstated === 0 && L.accredited) {
    if (promote()) { p.career.title = L.discipline === 'digital' && p.career.level < 3 ? (p.career.level >= 2 ? 'Senior digital forensic examiner' : 'Digital forensic examiner') : RANKS[p.career.level] ?? p.career.title; out.push(`Promoted: ${p.career.title.toLowerCase()}.`); }
  }
  return out;
}

// ---------- In court ----------

/**
 * A report the scientist wrote, in a case that went to court: the scientist is called to explain it. The defense
 * asks what the method can show, about contamination, whether the scientist knew who the suspect was, and whether a
 * "match" is certain. Honest answers keep the scientist's word good; overclaiming is found out, and an overstated
 * report brings the cases it touched under review.
 */
export function courtDates(p = player()) {
  return bench(p).filter((b) => b.status === 'reported' && !b.testified).map((b) => {
    const inv = investigation(b.invId);
    const c = inv?.file?.courtCaseId && k.J().cases[inv.file.courtCaseId];
    return c && !TERMINAL.includes(c.stage) ? { b, inv, c } : null;
  }).filter(Boolean);
}
/** After a report, the detective may take the case to the prosecutor; a charge brings the scientist to court. */
export function reportToCourt(b) {
  const inv = investigation(b.invId);
  const f = inv?.file;
  if (!f || f.courtCaseId || !seeded(`${b.id}/court`).chance(0.4)) return null;
  const inc = incidentOf(inv);
  for (const c of f.clues.filter((x) => ['scene', 'specialist', 'records'].includes(x.via) && !x.found)) {
    c.found = true; c.at = now();
    if (c.pointsTo && c.evKind) { const ev = k.addEvidence(inc, c.evKind, c.pointsTo, { lawful: true, summary: c.text }); inv.evidenceIds.push(ev.id); }
  }
  f.report = { at: now(), complete: true, omitted: [] };
  const suspect = f.poi[0];
  if (!suspect || k.strength(inv.evidenceIds, suspect) < k.CHARGE_AT * 0.8) return null;
  const c = k.openCaseFor(inv, suspect);
  f.courtCaseId = c.id;
  c.trialDue = now() + 6;
  return c;
}
export const FORENSIC_CROSS = [
  { id: 'method', q: '"Is your method validated for this kind of material?"', options: [['Say what the validation covers, and what it does not', 'honest'], ['Say it is accepted science, and leave it there', 'claim']] },
  { id: 'contamination', q: '"Could the sample have been contaminated?"', options: [['Explain the controls, and what they would and would not catch', 'honest'], ['Say contamination is impossible in your laboratory', 'claim']] },
  { id: 'bias', q: '"When you examined it, did you know who the police suspected?"', options: [['Say what you were told, and when', 'honest'], ['Say it made no difference', 'claim']] },
  { id: 'certainty', q: '"So it is a match. Certain?"', options: [['Say "consistent with", and what that means', 'honest'], ['Say yes, it is certain', 'claim']] },
];
export function testify(benchId, answers = {}, p = player()) {
  const L = labRecord(p);
  const b = W().bench?.[benchId];
  if (!L || !b || b.analystId !== me(p) || b.testified) return result(false, 'You are not called on this report.', 'neutral');
  const inv = investigation(b.invId);
  const c = inv?.file?.courtCaseId && k.J().cases[inv.file.courtCaseId];
  if (!c || TERMINAL.includes(c.stage)) return result(false, 'There is no trial on this report.', 'neutral');
  b.testified = now();
  L.testified += 1;
  const claims = FORENSIC_CROSS.filter((x) => answers[x.id] === 'claim').length;
  const lab = inv.file.labs.find((x) => x.byPlayer && x.itemId === b.itemId);
  const ev = k.J().evidence[inv.file.items.find((x) => x.id === b.itemId)?.evidenceId];
  const lines = FORENSIC_CROSS.map((x) => `${x.q} ${answers[x.id] === 'claim' ? 'You overstate it. The defense\'s own expert is in the room.' : 'You answer within what the science can say.'}`);
  if (lab?.overstated || claims >= 2) {
    // Found out: the report or the testimony went beyond the work. The court weighs it that way; the cases are reviewed.
    if (ev) ev.reliability = Math.min(ev.reliability, 0.25);
    L.exposed += 1;
    p.career.performance = clamp(p.career.performance - 12);
    L.reviews.push({ year: year(), why: lab?.overstated ? 'overstated report' : 'testimony', cases: bench(p).filter((x) => x.status === 'reported').map((x) => x.invId) });
    inv.file.log.push({ at: now(), text: `In court, ${p.firstName} ${p.lastName}'s ${lab?.overstated ? 'report was shown to go beyond the work behind it' : 'testimony went beyond what the method can show'}. The laboratory is reviewing their other cases.` });
    return result(true, `${lines.join(' ')} The defense expert takes it apart. Every case you reported is reviewed.`, 'bad', { lines });
  }
  p.career.performance = clamp(p.career.performance + 4);
  inv.file.log.push({ at: now(), text: `${p.firstName} ${p.lastName} explained the laboratory's findings in court, and their limits.` });
  return result(true, `${lines.join(' ')} The jury hears what the evidence is, and what it is not.`, 'good', { lines });
}
/** After a report is written: bookkeeping for the track (careful reports count toward promotion). */
export function afterReport(b, how) {
  const L = labRecord();
  if (!L) return;
  b.reportedAt = now();
  L.reports += 1;
  if (how === 'overstate') L.overstated += 1;
  else if (b.steps.includes('quality') && b.steps.includes('limits')) L.careful += 1;
  if (b.overdue) { const inv = investigation(b.invId); inv?.file?.log.push({ at: now(), text: 'The laboratory report arrived late.' }); }
  reportToCourt(b);
}
export { RANKS, LAB_RESULTS };
