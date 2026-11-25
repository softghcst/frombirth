// Forensic medicine: a physician who has completed a forensic fellowship (engine/medicine: Forensic
// Pathology after pathology, Forensic Psychiatry after psychiatry) works for death investigations and
// the courts, on the same cases everyone else reads.
//
// The medical examiner (forensic pathologist) receives a death referred by an investigating agency.
// They determine two different things: the cause of death (the injury or disease) and the manner of
// death (natural, accident, homicide, or undetermined). An examination cannot name who did anything;
// there is no such choice. Toxicology takes time. The report becomes the examiner's findings in the
// case file (casework.js), which the detective, the prosecutor and the defense all read.
// Not every coroner is a physician; in the game, the examiner is, and only once qualified.
//
// The forensic psychiatrist evaluates a defendant's competency to stand trial when a court asks.
// It is not therapy: the evaluator works for the court, says so first, and what is said is not
// confidential from the court. A diagnosis is not evidence of guilt, dishonesty or danger; the only
// question is whether the defendant can understand the proceedings and help their lawyer.
// Descriptions are kept clinical and brief; nothing graphic.
import { store, player } from '../../state.js';
import { med, qualified } from '../medicine/core.js';
import * as k from '../cases.js';
import { W, now, year, me, nextId, result, seeded, dateWords, nameOfId } from './core.js';
import { agencyOf, kindsIn } from './agencies.js';
import { openCase, investigation, incidentOf } from './casework.js';
import { freshCase } from '../legalCareers.js';

const nm = (id) => nameOfId(id);

/** Whether the player practices as a forensic pathologist, or a forensic psychiatrist, now. */
export const examinerNow = (p = player()) => { const m = med(p); return !!m && m.license?.status === 'full' && !m.training && qualified(m).includes('forensic_path'); };
export const evaluatorNow = (p = player()) => { const m = med(p); return !!m && m.license?.status === 'full' && !m.training && qualified(m).includes('forensic_psych'); };

const desk = () => { const w = W(); w.forensic ??= {}; return w.forensic; };
export const referrals = (kind, p = player()) => Object.values(desk()).filter((x) => x.kind === kind && x.byId === me(p));

/** Once a year, a qualified examiner or evaluator gets a real referral (made from a real case). */
export function forensicYear(p = player()) {
  if (examinerNow(p) && !referrals('death', p).some((x) => x.status === 'open')) {
    const a = agencyOf(kindsIn(p.countryId)[0], p.countryId, p.city);
    const det = Object.values(a.units)[0].memberIds.find((id) => store.state.npcs[id]?.alive);
    const inv = openCase('homicide', { ownerId: a.id, lead: det });
    const id = nextId('death');
    desk()[id] = { id, kind: 'death', invId: inv.id, byId: me(p), status: 'open', steps: [], tox: null, opened: now(), detectiveId: det };
  }
  if (evaluatorNow(p) && !referrals('competency', p).some((x) => x.status === 'open')) {
    const c = freshCase();
    if (!c) return;
    c.competency = { status: 'ordered', at: now() };
    const roll = seeded(`${c.id}/competent`);
    const id = nextId('eval');
    desk()[id] = { id, kind: 'competency', caseId: c.id, byId: me(p), status: 'open', steps: [], opened: now(), competent: roll.chance(0.85) };
  }
}

// ---------- The medical examiner ----------

export const DEATH_STEPS = {
  referral: { label: 'Review the referral and the circumstances reported', sub: 'What the investigating agency knows, and does not.' },
  history: { label: 'Review the medical history', sub: 'Prescriptions, conditions, recent visits.' },
  examination: { label: 'Carry out the examination', sub: 'Findings recorded clinically.' },
  toxicology: { label: 'Send samples for toxicology', sub: 'About three months.' },
};
/** A step in a death investigation. Each once; toxicology is dated. */
export function deathStep(id, step) {
  const d = desk()[id];
  if (!d || d.kind !== 'death' || d.status !== 'open' || d.byId !== me()) return result(false, 'That referral is not yours.', 'neutral');
  if (d.steps.includes(step)) return result(false, 'Done already.', 'neutral');
  d.steps.push(step);
  const inv = investigation(d.invId);
  const truth = incidentOf(inv).truth.hypothesis;
  if (step === 'toxicology') { d.tox = { due: now() + 3 }; return result(true, `Samples sent. Results by ${dateWords(d.tox.due)}.`, 'neutral'); }
  const text = {
    referral: 'An adult found dead at home; the agency treats the death as suspicious until the examination says otherwise.',
    history: truth === 'not_homicide' ? 'A recent change of dose in a prescribed medicine.' : 'No condition that would explain a sudden death.',
    examination: truth === 'not_homicide' ? 'No injuries of note. The findings fit a medication effect, which toxicology could confirm.' : 'Injuries consistent with blunt force, and not with a fall.',
  }[step];
  return result(true, text, 'neutral');
}
/** Toxicology, once its date comes. */
export function toxicology(id) {
  const d = desk()[id];
  if (!d?.tox) return null;
  if (now() < d.tox.due) return null;
  if (!d.tox.text) {
    const truth = incidentOf(investigation(d.invId)).truth.hypothesis;
    d.tox.text = truth === 'not_homicide' ? 'Toxicology: the medicine was present at a level well above the prescribed dose.' : 'Toxicology: nothing that contributed to the death.';
  }
  return d.tox.text;
}
export const CAUSES = { blunt: 'Blunt force injury', medication: 'Medication toxicity', natural_disease: 'Natural disease', undetermined: 'Undetermined' };
export const MANNERS = { natural: 'Natural', accident: 'Accident', homicide: 'Homicide', undetermined: 'Undetermined' };
/**
 * Signs the report: a cause and, separately, a manner. A manner the findings do not support is refused;
 * "undetermined" is always available. The report joins the case file as the examiner's findings.
 */
export function signDeathReport(id, cause, manner) {
  const d = desk()[id];
  if (!d || d.status !== 'open' || d.byId !== me()) return result(false, 'That referral is not yours.', 'neutral');
  if (!CAUSES[cause] || !MANNERS[manner]) return result(false, 'Choose a cause and a manner.', 'neutral');
  if (!d.steps.includes('examination')) return result(false, 'There is no basis for a report before the examination.', 'neutral');
  const inv = investigation(d.invId);
  const truth = incidentOf(inv).truth.hypothesis;
  const tox = toxicology(d.id);
  const supported = { blunt: truth !== 'not_homicide', medication: truth === 'not_homicide' && !!tox, natural_disease: false, undetermined: true }[cause];
  if (!supported) return result(false, cause === 'medication' && !tox ? 'Medication toxicity needs the toxicology results first.' : 'The findings do not support that cause.', 'neutral');
  if (manner !== 'undetermined' && ((manner === 'homicide') !== (truth !== 'not_homicide') || manner === 'natural')) return result(false, 'The findings do not support that manner of death. "Undetermined" is always an honest answer.', 'neutral');
  d.status = 'signed';
  d.report = { cause, manner, at: now() };
  const f = inv.file;
  const clue = f.clues.find((c) => c.via === 'examiner');
  if (clue) {
    const self = player();
    clue.text = `Medical examiner ${self.firstName} ${self.lastName}: cause of death, ${CAUSES[cause].toLowerCase()}; manner of death, ${MANNERS[manner].toLowerCase()}.`;
    clue.supports = manner === 'homicide' ? ['known', 'stranger'] : manner === 'accident' ? ['not_homicide'] : [];
    clue.against = manner === 'homicide' ? ['not_homicide'] : manner === 'accident' ? ['known', 'stranger'] : [];
    clue.decisive = manner !== 'undetermined';
  }
  f.log.push({ at: now(), text: `The medical examiner's report was signed: cause and manner of death set out separately.` });
  const p = player();
  p.career.performance = Math.min(100, (p.career.performance ?? 50) + (manner === 'undetermined' ? 1 : 4));
  return result(true, `Signed: cause, ${CAUSES[cause].toLowerCase()}; manner, ${MANNERS[manner].toLowerCase()}. ${nm(d.detectiveId)} and anyone the case reaches will read it. The report does not say who was involved: that is not what an examination can tell.`);
}

// ---------- The forensic psychiatrist ----------

export const EVAL_STEPS = {
  role: { label: 'Explain your role and the limits of confidentiality', sub: 'You work for the court, not as their therapist. Done first.' },
  records: { label: 'Review the records the court provided', sub: 'The charge, prior medical records, what counsel has observed.' },
  interview: { label: 'Interview the defendant', sub: 'What they understand about the charge, the court and their lawyer.' },
  testing: { label: 'Use a structured competency assessment', sub: 'A standard set of questions about the proceedings.' },
};
export function evalStep(id, step) {
  const e = desk()[id];
  if (!e || e.kind !== 'competency' || e.status !== 'open' || e.byId !== me()) return result(false, 'That referral is not yours.', 'neutral');
  if (e.steps.includes(step)) return result(false, 'Done already.', 'neutral');
  if (step !== 'role' && !e.steps.includes('role')) return result(false, 'First explain who you are and that this is not confidential from the court. Without that, nothing they say can fairly be used.', 'neutral');
  e.steps.push(step);
  const c = k.J().cases[e.caseId];
  const text = {
    role: `You explain to ${nm(c.defendantId)} that you are an evaluator for the court, not their doctor, and that what they tell you will go into a report.`,
    records: 'The records show no recent assessment of the defendant\'s understanding of the proceedings.',
    interview: e.competent ? `${nm(c.defendantId)} can explain the charge, what a plea is, and what their lawyer is for.` : `${nm(c.defendantId)} cannot yet explain what the charge means or what their lawyer does.`,
    testing: e.competent ? 'The structured assessment finds an adequate understanding.' : 'The structured assessment finds significant gaps in understanding the proceedings.',
  }[step];
  return result(true, text, 'neutral');
}
/** The evaluator's opinion to the court. The court decides; the opinion must rest on the assessment. */
export function reportCompetency(id, opinion) {
  const e = desk()[id];
  if (!e || e.status !== 'open' || e.byId !== me()) return result(false, 'That referral is not yours.', 'neutral');
  if (!['competent', 'not_competent', 'more_time'].includes(opinion)) return result(false, 'Choose an opinion.', 'neutral');
  if (!e.steps.includes('interview')) return result(false, 'An opinion needs at least an interview.', 'neutral');
  const c = k.J().cases[e.caseId];
  const basis = e.steps.includes('testing');
  if (opinion !== 'more_time' && !basis) return result(false, 'A firm opinion needs the structured assessment as well. You can ask the court for more time.', 'neutral');
  e.status = 'reported';
  e.opinion = opinion;
  const right = opinion === 'more_time' || (opinion === 'competent') === e.competent;
  c.competency = { status: opinion === 'not_competent' ? 'restoring' : opinion === 'more_time' ? 'pending' : 'found competent', at: now(), evaluatorId: me(), opinion };
  c.hearings.push({ year: year(), stage: 'competency', court: c.court, text: `A forensic psychiatrist reported on competency to stand trial: ${opinion.replace('_', ' ')}. The court decided accordingly.` });
  const p = player();
  p.career.performance = Math.min(100, Math.max(0, (p.career.performance ?? 50) + (right ? 4 : -5)));
  return result(true, opinion === 'not_competent' ? `The court found ${nm(c.defendantId)} not competent for now: the case waits while they receive treatment. It says nothing about whether they did it.`
    : opinion === 'competent' ? `The court found ${nm(c.defendantId)} competent; the case goes on. A diagnosis, if any, is not evidence of guilt.` : 'The court gave you more time.', right ? 'good' : 'neutral');
}
