// Forensic psychology outside the courtroom (a psychologist, not a physician: the forensic psychiatrist is in
// forensicMed.js). A licensed psychologist (a doctorate in psychology) can take up forensic work:
//
//   consultations   a detective asks about an open case: what the behavior at the scene suggests. The psychologist
//                   describes behavior; naming a person goes beyond what the method can do, and can send a case the
//                   wrong way
//   risk            a parole board asks for a risk assessment of a real prisoner serving a real sentence. A
//                   structured, validated assessment is the standard; the board decides
//   officer care    an officer after a critical incident. Support is confidential; what the department may be told
//                   is only fitness for duty, and only with the officer's knowledge
//
// Each piece of work is made from real records and decided by the people whose decision it is.
import { clamp } from '../../util.js';
import { store, player } from '../../state.js';
import { CAREER_BY_ID } from '../../data/careers.js';
import { hire, promote } from '../career.js';
import * as k from '../cases.js';
import { W, now, year, me, result, seeded, nameOfId } from './core.js';
import { agencyOf, kindsIn } from './agencies.js';
import { npcCourtCase } from './crossover.js';

const npc = (id) => store.state.npcs[id] ?? null;
const nm = (id) => nameOfId(id);
const RANKS = ['Forensic psychologist', 'Senior forensic psychologist', 'Director of forensic psychology'];

export const psychRecord = (p = player()) => p.forensicPsych ?? null;
/** Why a person cannot take up forensic psychology, or ''. */
export function psychBlock(p = player()) {
  if (psychRecord(p)?.active) return 'You practice forensic psychology.';
  const doc = p.education.degrees.some((d) => d.type === 'doctorate' && d.majorId === 'psychology');
  if (!doc) return 'Needs a doctorate in psychology, and a license to practice.';
  if (p.age < 26) return 'Needs the supervised years after the doctorate.';
  return '';
}
export function startPractice(p = player()) {
  const why = psychBlock(p);
  if (why) return result(false, why, 'neutral');
  hire(CAREER_BY_ID.forensic_psych, 0, 60, 'license');
  p.career.title = RANKS[0];
  p.forensicPsych = { active: true, since: year(), work: [], careful: 0, overreach: 0, breaches: 0 };
  return result(true, 'You are licensed, and take up forensic work: consultations for detectives, risk assessments for the parole board, and care for officers after hard days.');
}

/** The year's work, from real records: one of each kind, where there is one. */
export function psychYear(p = player()) {
  const F = psychRecord(p);
  if (!F?.active || p.career?.careerId !== 'forensic_psych' || !p.alive) return [];
  const out = [];
  if (F.work.some((x) => x.status === 'open')) return out;
  const a = agencyOf(kindsIn(p.countryId)[0], p.countryId, p.city);
  // A consultation on an open case a detective is working.
  const open = Object.values(k.J().investigations).find((inv) => inv.file && !inv.file.outcome && inv.file.leadId !== me(p) && ['homicide', 'robbery', 'arson'].includes(inv.file.template) && !F.work.some((x) => x.invId === inv.id));
  if (open) { F.work.push({ id: `pw_${open.id}`, kind: 'consult', invId: open.id, status: 'open', at: now() }); out.push(`A detective asks for your view on ${open.file.title}.`); }
  // A risk assessment for the parole board: a real prisoner, serving a real custodial sentence.
  let sen = Object.values(k.J().sentences).find((s) => s.type === 'custody' && s.status === 'active' && npc(s.defendantId)?.alive && !F.work.some((x) => x.sentenceId === s.id));
  // Few burglaries end in prison: the board's cases are serious ones, as many as it takes for someone to be inside.
  for (let i = 0; i < 20 && !sen; i++) { const inv = npcCourtCase(p, { serious: true }); const c = inv && k.J().cases[inv.file.courtCaseId]; const s = c?.sentenceId && k.J().sentences[c.sentenceId]; if (s?.type === 'custody') sen = s; }
  if (sen) { F.work.push({ id: `pw_${sen.id}`, kind: 'risk', sentenceId: sen.id, personId: sen.defendantId, status: 'open', at: now() }); out.push(`The parole board asks for a risk assessment of ${nm(sen.defendantId)}.`); }
  // An officer after a critical incident.
  const officer = (a.officerIds ?? []).map(npc).find((n) => n?.alive && !F.work.some((x) => x.personId === n.id));
  if (officer) { F.work.push({ id: `pw_${officer.id}_${year()}`, kind: 'officer', personId: officer.id, status: 'open', at: now() }); out.push(`${nm(officer.id)}, an officer, is referred to you after a critical incident.`); }
  return out;
}
export const openWork = (p = player()) => (psychRecord(p)?.work ?? []).filter((x) => x.status === 'open');

export const OPTIONS = {
  consult: [['Describe what the behavior suggests, and say what it cannot tell anyone', 'behavior'], ['Tell the detective which of their persons of interest fits', 'name']],
  risk: [['A structured, validated assessment, with an interview and the records', 'structured'], ['An interview, and your clinical impression', 'impression']],
  officer: [['Confidential support; tell the department only whether they are fit for duty, with the officer\'s knowledge', 'confidential'], ['Report what they told you to their supervisor', 'report']],
};
/** Does a piece of work. The psychologist decides how; the detective, the board and the department decide what follows. */
export function doWork(id, how, p = player()) {
  const F = psychRecord(p);
  const w = F?.work.find((x) => x.id === id && x.status === 'open');
  if (!w) return result(false, 'That work is done.', 'neutral');
  if (!OPTIONS[w.kind].some(([, v]) => v === how)) return result(false, 'That is not how this is done.', 'neutral');
  w.status = 'done'; w.how = how; w.done = now();
  if (w.kind === 'consult') {
    const inv = Object.values(k.J().investigations).find((x) => x.id === w.invId);
    const f = inv?.file;
    if (how === 'behavior') {
      F.careful += 1;
      f?.leads.push({ id: `psych_${w.id}`, text: 'A forensic psychologist\'s view: the scene suggests someone who knew the place, and was not in a hurry. It describes behavior; it names nobody.', why: 'A consultation', status: 'open', at: now() });
      f?.log.push({ at: now(), text: `${p.firstName} ${p.lastName}, a forensic psychologist, described what the behavior at the scene suggests, and its limits.` });
      return result(true, 'You describe what the scene suggests, and say plainly that it cannot point to a person. The detective has something to think about, not a suspect.');
    }
    F.overreach += 1;
    const pick = f?.poi[0];
    if (f && pick) f.log.push({ at: now(), text: `A forensic psychologist said ${nm(pick)} "fits the profile". A profile is not evidence; the investigation leaned toward them anyway.` });
    p.career.performance = clamp(p.career.performance - 6);
    return result(true, pick ? `You tell the detective ${nm(pick)} fits. It is not something the method can tell anyone, and the case now leans toward them.` : 'There is nobody to name. The detective is disappointed.', 'bad');
  }
  if (w.kind === 'risk') {
    const s = k.J().sentences[w.sentenceId];
    const roll = seeded(`${w.id}/risk`);
    const level = roll.pick(['low', 'moderate', 'high']);
    w.finding = how === 'structured' ? level : roll.pick(['low', 'high']);
    if (how === 'structured') F.careful += 1; else F.overreach += 1;
    // The board decides; a careful assessment is what it gives weight to.
    const release = w.finding === 'low' ? roll.chance(how === 'structured' ? 0.75 : 0.5) : w.finding === 'moderate' ? roll.chance(0.35) : roll.chance(0.1);
    if (s) { s.parole = { year: year(), decision: release ? 'released on parole' : 'parole refused', assessment: w.finding, by: me(p) }; if (release) s.status = 'parole'; }
    w.result = release ? 'released on parole' : 'parole refused';
    return result(true, `Your assessment: ${w.finding} risk${how === 'structured' ? ', with the instrument\'s limits set out' : ', on impression'}. The board decided: ${w.result}.`, how === 'structured' ? 'good' : 'neutral');
  }
  const n = npc(w.personId);
  if (how === 'confidential') {
    F.careful += 1;
    if (n) n.meters.relationship = clamp(n.meters.relationship + 10);
    w.result = 'fit for duty, after support';
    return result(true, `${n ? n.firstName : 'The officer'} talks, over several sessions. You tell the department one thing: they are fit to return to duty. The rest stays between you.`);
  }
  F.breaches += 1;
  p.career.performance = clamp(p.career.performance - 15);
  const cid = `complaint_psych_${w.id}`;
  W().complaints[cid] = { id: cid, subjectId: me(p), kind: 'confidentiality', text: 'A psychologist told a supervisor what an officer said in confidential sessions.', invId: null, opened: now(), due: now() + 6, status: 'open', true: true };
  if (n) n.meters.relationship = clamp(n.meters.relationship - 30);
  return result(true, `You tell their supervisor what ${n ? n.firstName : 'the officer'} said. They find out. A complaint goes to the licensing board.`, 'bad');
}
/** Promotion on careful work and no overreach or breach. */
export function psychCareerYear(p = player()) {
  const F = psychRecord(p);
  if (!F?.active || p.career?.careerId !== 'forensic_psych') return [];
  const lvl = p.career.level ?? 0;
  if (lvl < 2 && year() - F.since >= (lvl + 1) * 4 && F.careful >= (lvl + 1) * 3 && F.overreach === 0 && F.breaches === 0 && promote()) {
    p.career.title = RANKS[p.career.level];
    return [`Promoted: ${p.career.title.toLowerCase()}.`];
  }
  return [];
}
export { RANKS };
