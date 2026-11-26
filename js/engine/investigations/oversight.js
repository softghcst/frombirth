// Professional oversight: complaints about how investigators do their work, and the unit that
// looks into them. A complaint is an allegation, not a finding. It is investigated by someone with
// no stake in it (never its subject, never their partner), and decided on the evidence: it may be
// substantiated, unsubstantiated, not provable, or show a training issue. Discipline, dismissal and
// prosecution are separate processes; this is only the first.
//
//   W().complaints[id] = { id, subjectId, kind, text, invId, opened, due, status: 'open'|'decided',
//                          investigatorId, finding, action, true }
//   `true` is whether the conduct happened (the world's fact). The finding is what the evidence showed.
import { inForce } from './reform.js';
import { represent, priorRecord } from './unions.js';
import { store, player } from '../../state.js';
import { W, I, rec, now, year, me, nextId, result, note, regard, grow, seeded, reputationOf } from './core.js';
import { agency, staffer } from './agencies.js';
import { quitCareer } from '../career.js';
import { jobEnded } from './careers.js';

const npc = (id) => store.state.npcs[id] ?? null;
const nm = (id) => (id === me() ? 'you' : npc(id) ? `${npc(id).firstName} ${npc(id).lastName}` : 'someone');
export const complaints = () => Object.values(W().complaints);

/** Who may investigate a complaint: not its subject, not their partner, not someone they supervise. */
export function conflicted(c, investigatorId) {
  if (investigatorId === c.subjectId) return 'No one investigates a complaint about themselves.';
  const r = rec();
  if (c.subjectId === me() && (r?.people.partnerId === investigatorId || r?.people.supervisorId === investigatorId)) return 'A partner or supervisor of the person complained about has a conflict of interest.';
  if (investigatorId === me() && (r?.people.partnerId === c.subjectId || r?.people.formerPartnerIds.includes(c.subjectId) || r?.people.classmateIds.includes(c.subjectId))) return 'You know them too well to investigate this fairly. It goes to someone else.';
  return '';
}

/** Complaints about the player, decided by someone else when their date comes. */
export function settleComplaints() {
  const out = [];
  const r = rec();
  for (const c of complaints().filter((x) => x.status === 'open' && x.subjectId === me() && x.due <= now())) {
    if (!c.investigatorId) {
      const a = agency(r?.job?.agencyId);
      // Where the city has a civilian oversight board, residents review it; otherwise the department's own unit (engine/investigations/policing.js).
      const board = a?.oversight?.board;
      const independent = inForce(player().countryId, 'independent'); // national reform: an independent body decides (reform.js)
      const ia = staffer(player().countryId, board || independent ? 'staff' : 'officer', independent ? 'Independent police complaints investigator' : board ? 'Civilian oversight board member' : 'Professional standards investigator', { agencyId: a?.id, role: 'oversight' });
      c.investigatorId = ia.id;
      c.reviewer = independent ? 'independent' : board ? 'board' : 'department';
    }
    const roll = seeded(`${c.id}/finding`);
    c.finding = c.true ? (roll.chance(0.8) ? 'substantiated' : 'insufficient evidence') : (roll.chance(0.85) ? 'unsubstantiated' : 'insufficient evidence');
    c.status = 'decided';
    c.decided = now();
    if (r) {
      r.discipline.push({ year: year(), kind: c.kind, finding: c.finding, complaintId: c.id });
      if (c.finding === 'substantiated') {
        const serious = c.kind === 'disclosure' || c.kind === 'fabrication';
        const repeat = priorRecord(r).length > 1; // records a contract removed do not count (unions.js)
        c.action = serious && repeat ? 'dismissal' : serious ? 'suspension and a final warning' : 'a written reprimand and retraining';
        // A union member is represented: the finding stands; a dismissal may be reduced at arbitration.
        const rep = represent(c, r);
        c.action = rep.action;
        c.union = rep.note;
        r.discipline.at(-1).dismissed = c.action === 'dismissal';
        regard('integrity', -8);
        regard('ethics', -6);
        if (c.action === 'dismissal' && r.job) { jobEnded(player(), r, 'dismissed'); quitCareer(); }
      } else c.action = 'none';
    }
    out.push(`The complaint about you (${c.text.charAt(0).toLowerCase()}${c.text.slice(1)}) was decided by ${nm(c.investigatorId)}: ${c.finding}${c.action && c.action !== 'none' ? `. Action: ${c.action}.` : '.'}${c.union ? ` ${c.union}` : ''}`);
  }
  return out;
}

// ---------- The player as a professional standards investigator ----------

const KINDS = {
  report: 'An officer\'s report is said to differ from what the body camera recorded.',
  evidence: 'An officer is said to have mishandled a piece of evidence.',
  conduct: 'A member of the public says an officer was rude and dismissive during a stop.',
  conflict: 'An officer is said to have worked a case involving their own relative.',
};
/** A complaint for the unit, about an officer in the department. Made once a year for an investigator in that unit. */
export function intake(p = player()) {
  const r = rec(p);
  if (r?.job?.specialty !== 'professional_standards') return null;
  if (complaints().some((c) => c.assignedTo === me() && c.status === 'open')) return null;
  const a = agency(r.job.agencyId);
  const roll = seeded(`${me()}/ia/${year()}`);
  const subject = roll.pick(a.officerIds.filter((id) => !conflicted({ subjectId: id }, me())));
  if (!subject) return null;
  const kind = roll.pick(Object.keys(KINDS));
  const id = nextId('complaint');
  W().complaints[id] = { id, subjectId: subject, kind, text: KINDS[kind], invId: null, opened: now(), due: now() + 6, status: 'open', assignedTo: me(), investigatorId: me(),
    true: roll.chance(0.45), steps: [], evidence: [], finding: null };
  return W().complaints[id];
}
/** Steps in a conduct investigation. Each reveals what the records show, once. */
export const IA_STEPS = {
  records: { label: 'Review the relevant records', sub: 'The report, the log, the recording.' },
  policy: { label: 'Identify the policy that applies', sub: 'What the rule actually required.' },
  complainant: { label: 'Interview the complainant', sub: 'Their account, in their words.' },
  officer: { label: 'Interview the officer', sub: 'They have a representative present and may answer or not.' },
};
export function iaStep(id, step) {
  const c = W().complaints[id];
  if (!c || c.assignedTo !== me() || c.status !== 'open') return result(false, 'That complaint is not yours.', 'neutral');
  if (c.steps.includes(step)) return result(false, 'Done already.', 'neutral');
  c.steps.push(step);
  grow('ethics', 2);
  grow('law', 1);
  const roll = seeded(`${c.id}/${step}`);
  const clear = roll.chance(0.75);
  const text = {
    records: c.true ? (clear ? 'The records do not match the account given.' : 'The records are incomplete for the moment in question.') : 'The records match the officer\'s account.',
    policy: 'The policy is clear about what was required.',
    complainant: c.true ? 'The complainant\'s account is detailed and consistent.' : 'The complainant\'s account changed in the telling; some of it the records contradict.',
    officer: c.true ? (clear ? 'The officer\'s answers do not fit the records.' : 'The officer declined to answer, as was their right.') : 'The officer explained, and the explanation fits the records.',
  }[step];
  c.evidence.push({ step, text, against: c.true && step !== 'policy' && clear });
  return result(true, text, 'neutral');
}
/** Decides a conduct investigation on what it found. The player can only find what the evidence supports. */
export function iaDecide(id, finding) {
  const c = W().complaints[id];
  if (!c || c.assignedTo !== me() || c.status !== 'open') return result(false, 'That complaint is not yours.', 'neutral');
  if (c.steps.length < 2) return result(false, 'Not enough has been looked at to decide anything.', 'neutral');
  const against = c.evidence.filter((e) => e.against).length;
  const supported = { substantiated: against >= 2, unsubstantiated: against === 0 && c.steps.includes('records'), 'insufficient evidence': true, 'training issue': against >= 1 }[finding];
  if (!supported) return result(false, 'The evidence gathered does not support that finding.', 'neutral');
  c.finding = finding;
  c.status = 'decided';
  c.decided = now();
  const right = (finding === 'substantiated') === c.true || finding === 'insufficient evidence';
  regard('integrity', right ? 2 : -1);
  regard('skill', right ? 2 : -1);
  note(`Decided a professional standards case: ${finding}.`, 'career', { log: false });
  return result(true, `Finding: ${finding}. Any discipline is for the chief to decide; criminal charges, if any, for a prosecutor.`, 'neutral');
}
export const reputationAfter = () => reputationOf();
