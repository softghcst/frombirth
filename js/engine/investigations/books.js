// Financial review from the accounting side: a corporate accountant at their own employer, an external auditor at a
// client company, a forensic accountant engaged on a real fraud investigation. Each engagement is about a real
// company of the city (engine/employers.js) and a documented discrepancy in its books.
//
// What is behind the discrepancy was fixed when it arose: a bookkeeping error, a failed investment (a loss, not a
// crime), or a fraud. The professional decides how carefully to look and what to conclude; concluding fraud from a
// discrepancy alone is not a finding. A referral of a real fraud to the authorities opens a police investigation of
// the same company; the professional never gets records except through their engagement or the case.
import { clamp } from '../../util.js';
import { store, player } from '../../state.js';
import * as k from '../cases.js';
import { cityEmployers, chronicle } from '../employers.js';
import { W, now, year, me, result, seeded } from './core.js';
import { agencyOf, kindsIn } from './agencies.js';
import { openCase, investigation } from './casework.js';

const ROLES = { accountant: 'corporate', audit: 'audit' };
/** What kind of financial professional the player is now, if any: their employer's accountant, an auditor, or a forensic accountant. */
export function bookRole(p = player()) {
  if (ROLES[p.career?.careerId]) return (p.career.yearsInRole ?? 0) >= 3 && p.books?.forensic ? 'forensic' : ROLES[p.career.careerId];
  return null;
}
const B = (p = player()) => { p.books ??= { engagements: [], forensic: false, findings: 0, careful: 0, unfounded: 0 }; return p.books; };
export const engagements = (p = player()) => (p.books?.engagements ?? []).filter((e) => e.status === 'open');

/** Qualifies as a forensic accountant (a credential on top of accounting experience): later engagements come from fraud cases. */
export function qualifyForensic(p = player()) {
  if (!ROLES[p.career?.careerId]) return result(false, 'This is for accountants and auditors.', 'neutral');
  if (B(p).forensic) return result(false, 'You are qualified.', 'neutral');
  if ((p.career.yearsInRole ?? 0) < 3) return result(false, 'Forensic accounting asks for some years of accounting first.', 'neutral');
  B(p).forensic = year();
  return result(true, 'You qualify in forensic accounting. Lawyers and investigators can engage you on fraud cases now.');
}

/** The year's engagement, about a real company and a documented discrepancy in its books. */
export function booksYear(p = player()) {
  const role = bookRole(p);
  if (!role || !p.alive || engagements(p).length) return [];
  const roll = seeded(`${me(p)}/books/${year()}`);
  let e = null;
  let invId = null;
  if (role === 'forensic') {
    // A fraud case being worked in the city: the forensic accountant is engaged on its records.
    const inv = Object.values(k.J().investigations).find((x) => x.file && x.file.template === 'fraud' && !x.file.outcome && x.file.employerId && !B(p).engagements.some((g) => g.invId === x.id));
    if (inv) { invId = inv.id; e = store.state.jobs?.employers?.[inv.file.employerId] ?? null; }
  }
  if (!e && role === 'corporate') e = store.state.jobs?.employers?.[p.career.employerId] ?? null;
  if (!e) { let list = []; try { list = cityEmployers(p.countryId, p.city).filter((x) => x.family !== 'government'); } catch { list = []; } e = list.length ? roll.pick(list) : null; }
  if (!e) return [];
  const truth = invId ? (investigation(invId).file && k.J().incidents[investigation(invId).incidentId].truth.hypothesis === 'insider' ? 'fraud' : 'error') : roll.pick(['error', 'error', 'loss', 'fraud']);
  const what = roll.pick(['payments to a supplier nobody at the company has heard of', 'a year-end figure that does not match the bank statements', 'an investment written down to nothing', 'expense claims that grew every quarter']);
  const g = { id: `bk_${me(p)}_${year()}`, employerId: e.id, company: e.name, role, invId, what, truth, steps: [], status: 'open', opened: now(), conclusion: null };
  B(p).engagements.push(g);
  return [`${role === 'audit' ? 'An audit' : role === 'forensic' ? 'A forensic engagement' : 'A question in the books'} at ${e.name}: ${what}.`];
}

export const BOOK_STEPS = {
  discrepancy: 'Review the documented discrepancy',
  verify: 'Verify the records against their sources',
  request: 'Request the information you are authorized to see',
  expert: 'Seek an expert review',
};
export function bookStep(id, step, p = player()) {
  const g = B(p).engagements.find((x) => x.id === id && x.status === 'open');
  if (!g) return result(false, 'That engagement is closed.', 'neutral');
  if (!BOOK_STEPS[step]) return result(false, 'Nothing to do.', 'neutral');
  if (g.steps.includes(step)) return result(false, 'Done already.', 'neutral');
  g.steps.push(step);
  const t = g.truth;
  if (step === 'discrepancy') return result(true, `The discrepancy is real: ${g.what}. What it means is another question.`, 'neutral');
  if (step === 'verify') return result(true, { error: 'Traced to source documents, it is a posting error: an amount entered twice, and a correction never made.', loss: 'The records are accurate. The money was invested, and the investment failed.', fraud: 'The records do not trace: invoices with no deliveries behind them.' }[t], 'neutral');
  if (step === 'request') {
    // Only what the engagement (or the case) gives access to.
    if (g.role === 'forensic' && g.invId) {
      const f = investigation(g.invId)?.file;
      const ok = f?.auths?.some((a) => a.kind === 'records' && a.decision === 'granted');
      if (!ok) return result(true, 'The bank records need a court order in the case. The investigator has not got one yet; you work with what was lawfully obtained.', 'neutral');
    }
    return result(true, { error: 'The bank confirms one payment, not two.', loss: 'The board minutes record the decision to invest, and the risk.', fraud: 'The payments went to an account opened by someone inside the company.' }[t], 'neutral');
  }
  return result(true, { error: 'The expert agrees: an error, not a scheme.', loss: 'The expert says: a bad decision, made openly. Not a crime.', fraud: 'The expert says the pattern is deliberate.' }[t], 'neutral');
}
export const CONCLUSIONS = { error: 'A bookkeeping error, to be corrected', loss: 'A genuine loss on an investment', fraud: 'Possible fraud: refer it' };
/** Prepares findings, recommends correction, and refers a possible fraud to the authority. */
export function concludeBooks(id, conclusion, p = player()) {
  const b = B(p);
  const g = b.engagements.find((x) => x.id === id && x.status === 'open');
  if (!g || !CONCLUSIONS[conclusion]) return result(false, 'That engagement is closed.', 'neutral');
  g.status = 'closed'; g.conclusion = conclusion; g.closed = now();
  const e = store.state.jobs?.employers?.[g.employerId];
  const supported = g.steps.includes('verify') && (conclusion !== 'fraud' || g.steps.includes('request'));
  const right = conclusion === g.truth;
  if (supported && right) { b.careful += 1; p.career.performance = clamp((p.career.performance ?? 50) + 5); }
  if (!supported || !right) p.career.performance = clamp((p.career.performance ?? 50) - (conclusion === 'fraud' ? 8 : 3));
  if (conclusion !== 'fraud') {
    chronicle(e, `${g.role === 'audit' ? 'An audit' : 'A review'} found ${conclusion === 'error' ? 'a bookkeeping error, corrected' : 'a loss on an investment'}.`);
    return result(true, `Your findings: ${CONCLUSIONS[conclusion].toLowerCase()}. You recommend corrective action.${right ? '' : ' (It was not the whole story: someone may find that later.)'}`, right ? 'good' : 'neutral');
  }
  // A referral: the authority decides whether to investigate. A real fraud opens a real police investigation.
  b.findings += 1;
  if (!right) {
    b.unfounded += 1;
    chronicle(e, 'Reported to the authorities for possible fraud; the inquiry found none.');
    return result(true, `You referred it as possible fraud. The authorities looked, and found ${g.truth === 'error' ? 'a bookkeeping error' : 'a failed investment'}. A discrepancy is not proof of intent; the company's name was in the papers for nothing.`, 'bad');
  }
  if (g.invId) {
    const f = investigation(g.invId).file;
    f.leads.push({ id: `books_${g.id}`, text: `A forensic accountant's findings: ${g.what}; the payments went to an account opened from inside the company.`, why: 'Forensic accounting', status: 'open', at: now() });
    f.log.push({ at: now(), text: `${p.firstName} ${p.lastName}, a forensic accountant, reported findings on the company's records.` });
    return result(true, 'Your findings go to the investigator on the case, as an expert report. What the prosecutor does with it is theirs to decide.');
  }
  const a = agencyOf(kindsIn(p.countryId)[0], p.countryId, p.city);
  const det = Object.values(a.units).flatMap((u) => u.memberIds).find((x) => store.state.npcs[x]?.alive);
  const inv = openCase('fraud', { ownerId: a.id, lead: det, place: g.company, truth: 'insider' });
  inv.file.employerId = g.employerId;
  inv.file.log.push({ at: now(), text: `Referred by ${p.firstName} ${p.lastName}, ${g.role === 'audit' ? 'the company\'s external auditor' : 'an accountant at the company'}.` });
  g.referredInvId = inv.id;
  chronicle(e, 'Reported to the police for possible fraud, after a review of its accounts.');
  return result(true, `The police open an investigation: ${inv.file.title}. You will be a witness, not the investigator.`);
}
