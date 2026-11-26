// Conviction integrity work: a lawyer (or an experienced investigator) at an innocence organization, or a prosecutor
// in a conviction integrity unit, reviews real convictions. It is the Justice Engine's own case and the lawyer's own
// record: the appeal goes to the court that decides it (engine/cases.js fileAppeal), and the matter goes into the
// lawyer's case history (engine/lawSchool.js lawOf().history).
//
// Not a promotion anyone gets: it needs the post. An innocence organization takes admitted lawyers and seasoned
// investigators; a conviction integrity unit is part of a prosecutor's office.
//
//   record       read the trial record: the evidence and what was claimed at trial
//   timeline     rebuild the timeline from the record and the witnesses' own accounts
//   experts      consult experts: which kept items could be tested now, and how
//   reanalysis   ask for eligible items to be tested again (a prosecutor's unit can agree to it; an innocence
//                lawyer asks the court, which may refuse). Results come on their date, and report on evidence only
//   refer        a result pointing to someone else goes to the appeal court as new evidence, which decides; with
//                nothing new, the conviction stands and the matter is closed
import { store, player } from '../../state.js';
import { LAB, LAB_RESULTS } from '../../data/investigations.js';
import * as k from '../cases.js';
import { lawOf, admitted } from '../lawSchool.js';
import { rec, W, now, year, me, result, seeded, nameOfId, dateWords } from './core.js';
import { reviewCandidates, investigation, incidentOf } from './casework.js';
import { npcCourtCase } from './crossover.js';

const nm = (id) => nameOfId(id);
/** An item's label without its own article, to put "the" in front of. */
const bare = (label) => label.toLowerCase().replace(/^(a|an|the) /, '');
export const ORGS = {
  innocence: { name: 'an innocence organization', post: 'Innocence organization', who: 'lawyers and seasoned investigators' },
  ciu: { name: 'the conviction integrity unit', post: 'Conviction integrity unit', who: 'prosecutors' },
};
export const integrityOf = (p = player()) => p.integrity ?? null;

/** Why the player cannot take up a post, or ''. */
export function postBlock(org, p = player()) {
  if (integrityOf(p)?.org === org) return 'This is your post.';
  if (org === 'ciu') return p.career?.careerId === 'prosecutor' && admitted(p) ? '' : 'A conviction integrity unit is part of a prosecutor\'s office: it needs a prosecutor.';
  const lawyer = admitted(p);
  const investigator = (rec(p)?.stats.years ?? 0) >= 8;
  return lawyer || investigator ? '' : 'Needs admission as a lawyer, or eight years of investigative work.';
}
export function takePost(org, p = player()) {
  const why = postBlock(org, p);
  if (why) return result(false, why, 'neutral');
  p.integrity = { org, since: year(), matters: [], exonerations: 0, upheld: 0 };
  return result(true, `You join ${ORGS[org].name}. Convictions are reviewed one at a time, on the record, and the courts decide.`);
}

/** The year's matter: a real conviction whose kept evidence can be tested in a way it was not. */
export function integrityYear(p = player()) {
  const I = integrityOf(p);
  if (!I || !p.alive || I.matters.some((m) => m.status === 'open')) return [];
  let cand = reviewCandidates(p.countryId).find((x) => !I.matters.some((m) => m.invId === x.inv.id));
  // Only real convictions: when there are none with anything to test, the courts' own work may produce one.
  for (let i = 0; i < 8 && !cand; i++) { npcCourtCase(p); cand = reviewCandidates(p.countryId).find((x) => !I.matters.some((m) => m.invId === x.inv.id)); }
  if (!cand) return ['No conviction here has kept evidence that could be tested anew this year.'];
  const inv = cand.inv;
  const c = k.J().cases[inv.file.courtCaseId];
  const m = { id: `im_${inv.id}`, invId: inv.id, caseId: c.id, opened: now(), steps: [], status: 'open', tests: [], outcome: null };
  I.matters.push(m);
  inv.file.log.push({ at: now(), text: `${I.org === 'ciu' ? 'The prosecutor\'s conviction integrity unit' : 'An innocence organization'} opened a review of the conviction of ${nm(c.defendantId)}. The conviction stands meanwhile.` });
  return [`A new matter: ${nm(c.defendantId)}, convicted in ${inv.file.title}, asks for a review.`];
}
export const openMatters = (p = player()) => (integrityOf(p)?.matters ?? []).filter((m) => m.status === 'open');

export const STEPS = {
  record: 'Review the trial record',
  timeline: 'Reconstruct the timeline',
  experts: 'Consult experts on what could be tested',
  reanalysis: 'Request eligible reanalysis',
  refer: 'Refer to the prosecutor or the court',
};
export function step(matterId, id, p = player()) {
  const I = integrityOf(p);
  const m = I?.matters.find((x) => x.id === matterId && x.status === 'open');
  if (!m) return result(false, 'That matter is closed.', 'neutral');
  if (!STEPS[id]) return result(false, 'Nothing to do.', 'neutral');
  if (m.steps.includes(id) && id !== 'refer') return result(false, 'Done already.', 'neutral');
  const inv = investigation(m.invId);
  const f = inv.file;
  const c = k.J().cases[m.caseId];
  if (id === 'record') {
    m.steps.push(id);
    const ev = c.evidenceIds.map((x) => k.J().evidence[x]).filter(Boolean);
    return result(true, `The record: ${nm(c.defendantId)} was convicted of ${(c.charges[0]?.offenseId ?? 'an offense').replace(/_/g, ' ')} on ${ev.length} piece${ev.length === 1 ? '' : 's'} of evidence. ${ev.filter((e) => e.kind === 'witness').length ? 'Eyewitness testimony was part of it.' : 'There was no eyewitness.'}`, 'neutral');
  }
  if (id === 'timeline') {
    if (!m.steps.includes('record')) return result(false, 'Start with the trial record.', 'neutral');
    m.steps.push(id);
    const limited = Object.values(f.witnesses).filter((w) => w.limitation);
    return result(true, limited.length ? `Rebuilt from the record: ${limited.map((w) => `${nm(w.id)} said ${w.limitation}`).join('; ')}. It does not prove anything; it says where to look.` : 'The timeline holds together as it was presented at trial.', 'neutral');
  }
  if (id === 'experts') {
    m.steps.push(id);
    const used = new Set(f.labs.map((l) => `${l.itemId}:${l.discipline}`));
    m.tests = f.items.flatMap((it) => Object.entries(LAB).filter(([d, x]) => x.kinds.includes(it.kind) && year() >= x.from && !used.has(`${it.id}:${d}`)).map(([d]) => ({ itemId: it.id, discipline: d })));
    return result(true, m.tests.length ? `The experts say these could be tested now: ${m.tests.map((t) => `the ${bare(f.items.find((x) => x.id === t.itemId).label)} (${LAB[t.discipline].name.toLowerCase().replace(/\bdna\b/g, "DNA")})`).join('; ')}.` : 'Nothing kept could be tested in a new way.', 'neutral');
  }
  if (id === 'reanalysis') {
    if (!m.steps.includes('experts') || !m.tests.length) return result(false, 'Consult experts first, on what could be tested.', 'neutral');
    m.steps.push(id);
    // A prosecutor's unit can agree to testing; an innocence lawyer asks the court, which decides.
    const granted = I.org === 'ciu' || seeded(`${m.id}/motion`).chance(0.65);
    if (!granted) { m.refused = true; return result(true, 'The court refused the motion for testing: it was not persuaded the results could matter. You may refer the matter on the record as it stands.', 'neutral'); }
    const t = m.tests[0];
    const it = f.items.find((x) => x.id === t.itemId);
    const ev = k.J().evidence[it.evidenceId];
    const r = seeded(`${m.id}/result`);
    const conclusive = r.chance(LAB[t.discipline].conclusive);
    // What the material shows was fixed when it was collected: it points where it points.
    const res = !conclusive ? 'inconclusive' : ev?.pointsTo && ev.pointsTo !== c.defendantId ? 'consistent' : ev?.pointsTo === c.defendantId ? 'consistent' : 'inconsistent';
    m.lab = { itemId: it.id, discipline: t.discipline, due: now() + LAB[t.discipline].months, result: res, pointsTo: conclusive ? ev?.pointsTo ?? null : null };
    f.labs.push({ id: `lab_${m.id}`, itemId: it.id, discipline: t.discipline, requested: now(), due: m.lab.due, status: 'pending', integrity: true });
    return result(true, `${LAB[t.discipline].name} of the ${bare(it.label)} is requested. The result is due by ${dateWords(m.lab.due)}.`, 'neutral');
  }
  // refer
  if (m.lab && m.lab.due > now()) return result(false, `The laboratory result is due by ${dateWords(m.lab.due)}.`, 'neutral');
  if (m.lab) {
    const lab = f.labs.find((x) => x.id === `lab_${m.id}`);
    if (lab && lab.status !== 'reported') { lab.status = 'reported'; lab.reported = now(); lab.result = m.lab.result; lab.text = `${LAB[m.lab.discipline].name}: ${LAB_RESULTS[m.lab.result].toLowerCase()}.`; }
  }
  m.steps.push('refer');
  m.status = 'closed';
  const away = m.lab?.pointsTo && m.lab.pointsTo !== c.defendantId;
  const L = admitted(p) ? lawOf(p) : null;
  if (!away) {
    m.outcome = 'no new evidence';
    I.upheld += 1;
    f.log.push({ at: now(), text: 'The conviction review found nothing that points away from the person convicted. The conviction stands.' });
    L?.history.push({ caseId: c.id, title: `Review: ${f.title}`, kind: 'post-conviction', role: I.org === 'ciu' ? 'prosecution' : 'defense', outcome: 'conviction stands', favorable: 0, trial: false, level: 3, year: year() });
    return result(true, m.lab ? `The result does not point away from ${nm(c.defendantId)}. The conviction stands; the matter is closed.` : `Nothing new to put before the court. The conviction stands; the matter is closed.`, 'neutral');
  }
  // New evidence pointing elsewhere: the appeal court decides (the same case, the same court process).
  const ev = k.addEvidence(incidentOf(inv), 'forensic', m.lab.pointsTo, { lawful: true, summary: `New ${LAB[m.lab.discipline].name.toLowerCase().replace(/\bdna\b/g, "DNA")} of kept evidence points to ${nm(m.lab.pointsTo)}.` });
  ev.reliability = Math.max(ev.reliability, 0.85);
  c.fresh = ev.id;
  const appeal = k.fileAppeal(c, 'new_evidence', I.org === 'ciu' ? c.defenseId : me(p));
  m.outcome = appeal?.outcome ?? 'dismissed';
  if (m.outcome === 'exonerated') I.exonerations += 1;
  f.log.push({ at: now(), text: `The review sent new evidence to the appeal court, which decided: ${m.outcome}.` });
  L?.history.push({ caseId: c.id, title: `Review: ${f.title}`, kind: 'post-conviction', role: I.org === 'ciu' ? 'prosecution' : 'defense', outcome: m.outcome, favorable: m.outcome === 'exonerated' ? 1 : -1, trial: false, level: 4, year: year() });
  return result(true, m.outcome === 'exonerated' ? `The appeal court set the conviction aside. ${nm(c.defendantId)} is free. The first verdict stays on the record, with what came after it.` : `The appeal court heard the new evidence and decided: ${m.outcome}.`, m.outcome === 'exonerated' ? 'good' : 'neutral');
}
