// The same cases, seen from other careers. A forensic scientist (the 'forensics' track) receives real
// laboratory requests from investigations NPC detectives are working, and decides how the
// examination is done and reported; the detective, the prosecutor and the defense read the report
// they write. A journalist can report on what is public: cases in open court, never case files.
//
// These are partial integrations, on purpose: the forensic scientist's work is one request at a time
// on the bench, and the journalist's is the public record. Medical examiners appear in a homicide file
// as findings (casework.js: cause and manner of death, kept apart); a player physician cannot yet issue them.
import { clamp } from '../../util.js';
import { store, player } from '../../state.js';
import { LAB, LAB_RESULTS } from '../../data/investigations.js';
import * as k from '../cases.js';
import { rec, W, now, year, me, nextId, result, seeded } from './core.js';
import { agencyOf, kindsIn, lab } from './agencies.js';
import { openCase, investigation, incidentOf } from './casework.js';
import { publicRecord } from './views.js';

const npc = (id) => store.state.npcs[id] ?? null;
const nm = (id) => (npc(id) ? `${npc(id).firstName} ${npc(id).lastName}` : 'someone');

/** The player's bench, as a forensic scientist: requests waiting on them. */
export function bench(p = player()) {
  const w = W();
  w.bench ??= {};
  return Object.values(w.bench).filter((b) => b.analystId === me(p));
}

/** Once a year, a forensic scientist's laboratory sends them a request from a real case an NPC detective is working. */
export function benchYear(p = player()) {
  if (p.career?.careerId !== 'forensics' || !p.alive) return;
  if (bench(p).some((b) => b.status === 'open')) return;
  const a = agencyOf(kindsIn(p.countryId)[0], p.countryId, p.city);
  const det = a.units[Object.keys(a.units)[0]].memberIds.find((id) => npc(id)?.alive);
  const inv = openCase('burglary', { ownerId: a.id, lead: det });
  const it = inv.file.items.find((x) => x.disciplines.length) ;
  if (!it) return;
  const discipline = it.disciplines[0];
  const id = nextId('bench');
  W().bench[id] = { id, invId: inv.id, itemId: it.id, discipline, analystId: me(p), status: 'open', steps: [], received: now(), detectiveId: det };
  it.custody.push({ at: now(), by: det, act: 'collected and logged' }, { at: now(), by: me(p), act: 'received at the laboratory' });
}

/** What the scientist does with a request: each once. */
export const BENCH_STEPS = {
  condition: { label: 'Review the evidence condition and its custody record' },
  method: { label: 'Choose a suitable method for the material' },
  quality: { label: 'Run the quality controls' },
  limits: { label: 'Assess what the result can and cannot show' },
};
export function benchStep(id, step) {
  const b = W().bench?.[id];
  if (!b || b.status !== 'open' || b.analystId !== me()) return result(false, 'That request is not on your bench.', 'neutral');
  if (b.steps.includes(step)) return result(false, 'Done already.', 'neutral');
  b.steps.push(step);
  const inv = investigation(b.invId);
  const it = inv.file.items.find((x) => x.id === b.itemId);
  const text = { condition: it.integrity === 'gap' ? 'The custody log is missing one transfer signature. You note it in your report: it goes to the defense too.' : 'The item is sealed and its custody record is complete.',
    method: `${LAB[b.discipline].name} suits this material.`, quality: 'The controls ran as expected.', limits: 'You write down what the method cannot tell anyone: it compares material, it does not say how it got there.' }[step];
  return result(true, text, 'neutral');
}
/**
 * Reports a finding. What the material shows was fixed when it was collected; the scientist decides
 * how carefully it is examined and how honestly it is reported. Overstating a result is never rewarded.
 * @param {'careful'|'overstate'} how
 */
export function benchReport(id, how = 'careful') {
  const b = W().bench?.[id];
  if (!b || b.status !== 'open' || b.analystId !== me()) return result(false, 'That request is not on your bench.', 'neutral');
  if (!b.steps.includes('method')) return result(false, 'Choose a method first.', 'neutral');
  const inv = investigation(b.invId);
  const f = inv.file;
  const it = f.items.find((x) => x.id === b.itemId);
  const ev = k.J().evidence[it.evidenceId];
  const p = player();
  const careful = b.steps.includes('quality') && b.steps.includes('limits');
  const r = seeded(`${b.id}/result`);
  const conclusive = r.chance(LAB[b.discipline].conclusive * (careful ? 1.1 : 0.85));
  const outcome = conclusive ? (ev.pointsTo ? 'consistent' : 'inconsistent') : 'inconclusive';
  const shown = how === 'overstate' && outcome === 'inconclusive' ? 'consistent' : outcome;
  let text = `${LAB[b.discipline].name}: ${LAB_RESULTS[shown].toLowerCase()}.`;
  if (shown === 'consistent' && ev.pointsTo) text = `${LAB[b.discipline].name}: the ${it.label.toLowerCase()} is consistent with ${nm(ev.pointsTo)}.${careful ? ' The report sets out the method\'s limits.' : ''}`;
  if (how === 'overstate' && outcome === 'inconclusive') { ev.overstated = true; ev.reliability = Math.min(ev.reliability, 0.3); p.career.performance = clamp(p.career.performance - 10); }
  else p.career.performance = clamp(p.career.performance + (careful ? 5 : 1));
  // The report joins the same case file the detective reads (casework.js), as any laboratory report does.
  f.labs.push({ id: nextId('labreq'), itemId: it.id, discipline: b.discipline, requested: b.received, due: now(), analystId: me(), outcome: outcome === 'consistent' ? 'links' : outcome === 'inconsistent' ? 'excludes' : 'inconclusive',
    status: 'reported', result: shown, text, reported: now(), byPlayer: true, overstated: how === 'overstate' && outcome === 'inconclusive' });
  if (shown === 'consistent' && ev.pointsTo && !inv.evidenceIds.includes(ev.id)) inv.evidenceIds.push(ev.id);
  it.custody.push({ at: now(), by: me(), act: `examined: ${LAB_RESULTS[shown].toLowerCase()}` });
  f.log.push({ at: now(), text: `Laboratory report from ${p.firstName} ${p.lastName}: ${text}` });
  b.status = 'reported';
  return result(true, how === 'overstate' && outcome === 'inconclusive' ? 'You reported a result the work did not support. If it is tested in court, it will not hold, and neither will your credibility.' : `Reported to ${nm(b.detectiveId)}: ${text}`, how === 'overstate' && outcome === 'inconclusive' ? 'bad' : 'good');
}

/** What a journalist can find: the public record of cases in court where they live. Never a case file. */
export function publicCases(p = player()) {
  return Object.values(k.J().investigations).filter((inv) => inv.file && incidentOf(inv).countryId === p.countryId).map(publicRecord).filter(Boolean);
}
