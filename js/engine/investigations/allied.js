// The careers around investigations: crime and intelligence analysts, probation officers, victim advocates, court
// reporters, inspector general investigators, compliance investigators and insurance investigators. Each is a real
// track (data/occupations.js, hired through its own door here, not cold off the job board) whose work comes from the
// game's own records: open cases, sentences being served, people harmed, hearings, government and company employers,
// insurance claims. Each piece of work has a sound way to do it and a way that goes wrong; the people whose decision it
// is (a court, a board, a company, the police) make the decisions.
import { clamp } from '../../util.js';
import { store, player } from '../../state.js';
import { CAREER_BY_ID } from '../../data/careers.js';
import { hire, promote } from '../career.js';
import * as k from '../cases.js';
import { cityEmployers, chronicle } from '../employers.js';
import { W, now, year, me, result, seeded, nameOfId } from './core.js';
import { agencyOf, kindsIn } from './agencies.js';
import { openCase, investigation } from './casework.js';
import { npcCourtCase } from './crossover.js';
import { claims } from './local.js';

const npc = (id) => store.state.npcs[id] ?? null;
const nm = (id) => nameOfId(id);
const majors = (p) => p.education.degrees.map((d) => d.majorId).filter(Boolean);
const degree = (p, list) => p.education.degrees.some((d) => d.type === 'university' && (!list || list.includes(d.majorId)));
const detective = (p) => { const a = agencyOf(kindsIn(p.countryId)[0], p.countryId, p.city); return { a, det: Object.values(a.units).flatMap((u) => u.memberIds).find((x) => npc(x)?.alive) }; };
const employersOf = (p, families) => { try { return cityEmployers(p.countryId, p.city).filter((e) => families.includes(e.family)); } catch { return []; } };
const complain = (p, kind, text) => { const id = `complaint_${kind}_${me(p)}_${now()}`; W().complaints[id] = { id, subjectId: me(p), kind, text, invId: null, opened: now(), due: now() + 6, status: 'open', true: true }; };

/**
 * Each career: who can take it up, where the year's work comes from, and the ways to do it.
 * `find(p)` returns { subject, words } from real records, or null. Each option: { label, good, run(p, w) → text }.
 */
export const ALLIED = {
  crime_analyst: {
    name: 'Crime analyst', ranks: ['Crime analyst', 'Senior crime analyst', 'Criminal intelligence analyst', 'Head of analysis'],
    needs: (p) => (degree(p, ['criminology', 'criminal_justice', 'mathematics', 'computer_science', 'economics', 'sociology']) ? '' : 'Needs a degree in criminology, statistics, computing or the social sciences.'),
    find(p) {
      const open = Object.values(k.J().investigations).filter((x) => x.file && !x.file.outcome && x.file.template === 'burglary' && k.J().incidents[x.incidentId]?.city === p.city);
      const { a, det } = detective(p);
      while (open.length < 2) open.push(openCase('burglary', { ownerId: a.id, lead: det }));
      return { subject: open.slice(0, 3).map((x) => x.id), words: `${open.length} open burglaries in ${p.city}` };
    },
    options: [
      { id: 'pattern', label: 'Map the reports: times, places, how the doors were opened', good: true, run(p, w) {
        for (const id of w.subject) investigation(id)?.file?.leads.push({ id: `analysis_${w.id}`, text: 'A crime analyst links this burglary to others nearby: the same hours, the same rear doors. It names nobody.', why: 'Crime analysis', status: 'open', at: now() });
        return 'Your bulletin links the burglaries by time, place and method. Detectives get a pattern to work, not a suspect.';
      } },
      { id: 'profile', label: 'Pick out likely offenders from past arrest records', good: false, run(p) {
        complain(p, 'conduct', 'An analysis named people as likely offenders from past arrests alone.');
        return 'Your list names people for having been arrested before. Officers stop them; none of it is evidence, and a complaint follows.';
      } },
    ],
  },
  probation: {
    name: 'Probation officer', ranks: ['Probation officer', 'Senior probation officer', 'Probation supervisor', 'Chief probation officer'],
    needs: (p) => (degree(p, ['criminal_justice', 'criminology', 'psychology', 'sociology', 'social_work', 'education']) ? '' : 'Needs a degree in criminal justice, psychology, social work or a related field.'),
    find(p) {
      const live = (s) => ['probation', 'suspended', 'community'].includes(s.type) && s.status === 'active' && npc(s.defendantId)?.alive;
      let s = Object.values(k.J().sentences).find((x) => live(x) && !(x.supervisedBy));
      for (let i = 0; i < 6 && !s; i++) { npcCourtCase(p); s = Object.values(k.J().sentences).find((x) => live(x) && !x.supervisedBy); }
      if (!s) return null;
      s.supervisedBy = me(p);
      return { subject: s.id, words: `${nm(s.defendantId)}, serving ${s.type === 'community' ? 'community service' : s.type === 'suspended' ? 'a suspended sentence' : 'probation'}` };
    },
    options: [
      { id: 'support', label: 'Supervise and support: work, housing, the conditions explained', good: true, run(p, w) {
        const s = k.J().sentences[w.subject];
        const done = seeded(`${w.id}/done`).chance(0.75);
        if (s && done) { s.status = 'completed'; s.completedYear = year(); }
        return done ? 'They kept every appointment and found work. The sentence is completed.' : 'They missed one appointment, then came back. You record it, and keep working with them.';
      } },
      { id: 'breach', label: 'Report every small slip to the court as a breach', good: false, run(p, w) {
        const s = k.J().sentences[w.subject];
        if (s) s.breach = { year: year(), by: me(p), minor: true };
        return 'You report a late arrival as a breach. The judge sends it back: the conditions were not broken, and the court\'s time was taken.';
      } },
    ],
  },
  victim_advocate: {
    name: 'Victim advocate', ranks: ['Victim advocate', 'Senior victim advocate', 'Victim services coordinator'],
    needs: (p) => (degree(p) || p.age >= 21 ? '' : 'Needs to be an adult; a degree in social work or psychology helps.'),
    find(p) {
      let inv = Object.values(k.J().investigations).find((x) => x.file && !x.file.outcome && ['family', 'robbery', 'homicide'].includes(x.file.template) && !x.file.advocateId);
      if (!inv) { const { a, det } = detective(p); inv = openCase('family', { ownerId: a.id, lead: det }); }
      inv.file.advocateId = me(p);
      const who = inv.file.template === 'robbery' ? inv.file.reportingId : inv.file.template === 'homicide' ? inv.file.kinId ?? inv.file.reportingId : inv.file.victimId;
      return { subject: inv.id, person: who, words: `${nm(who)}, in ${inv.file.title}` };
    },
    options: [
      { id: 'support', label: 'Explain their rights and choices, and support whatever they decide', good: true, run(p, w) {
        const f = investigation(w.subject)?.file;
        if (f) { f.done.support ??= now(); f.log.push({ at: now(), text: 'A victim advocate explained the process and the person\'s choices. What they decide is theirs.' }); }
        const n = npc(w.person); if (n) n.meters.relationship = clamp(n.meters.relationship + 12);
        return 'You explain what happens next, what they can choose, and where to get help. They choose for themselves.';
      } },
      { id: 'press', label: 'Persuade them that they have to testify', good: false, run(p, w) {
        const n = npc(w.person); if (n) n.meters.relationship = clamp(n.meters.relationship - 15);
        return 'They feel pushed. An advocate works for the person harmed, not for the case; they stop returning your calls.';
      } },
    ],
  },
  court_reporter: {
    name: 'Court reporter', ranks: ['Court reporter', 'Senior court reporter', 'Official court reporter'],
    needs: (p) => (p.education.degrees.some((d) => ['high', 'university', 'certificate', 'technical'].includes(d.type)) ? '' : 'Needs a school-leaving qualification, then shorthand or stenography training.'),
    find(p) {
      let c = Object.values(k.J().cases).find((x) => x.year === year() && x.countryId === p.countryId && !x.transcript);
      if (!c) { const inv = npcCourtCase(p); c = inv && k.J().cases[inv.file.courtCaseId]; }
      if (!c) return null;
      return { subject: c.id, words: `the hearings in the case of ${nm(c.defendantId)}` };
    },
    options: [
      { id: 'verbatim', label: 'Take down every word as it was said, and certify it', good: true, run(p, w) {
        const c = k.J().cases[w.subject];
        if (c) c.transcript = { by: me(p), year: year(), certified: true };
        return 'The transcript is exact: every hesitation, every objection. If there is an appeal, it will be argued on what you wrote.';
      } },
      { id: 'tidy', label: 'Tidy up what the witnesses and lawyers said', good: false, run(p, w) {
        const c = k.J().cases[w.subject];
        if (c) c.transcript = { by: me(p), year: year(), certified: false, altered: true };
        complain(p, 'records', 'A certified transcript did not match the recording of the hearing.');
        return 'Your transcript reads better than the hearing did. When it is compared with the recording, it is not the record any more, and you answer for it.';
      } },
    ],
  },
  inspector_general: {
    name: 'Inspector general investigator', ranks: ['Investigator, office of the inspector general', 'Senior investigator', 'Assistant inspector general', 'Inspector general'],
    needs: (p) => (degree(p) && ((p.career?.experience?.police ?? 0) + (p.career?.experience?.detective ?? 0) + (p.career?.experience?.accountant ?? 0) + (p.career?.experience?.audit ?? 0) + (p.career?.experience?.lawyer ?? 0) >= 3 || (p.investigator?.stats?.years ?? 0) >= 3) ? '' : 'Needs a degree and three years in law enforcement, audit, accounting or law.'),
    find(p) {
      const gov = employersOf(p, ['government']);
      if (!gov.length) return null;
      const e = seeded(`${me(p)}/ig/${year()}`).pick(gov);
      const what = seeded(`${me(p)}/ig/${year()}/what`).pick(['contracts awarded without bids', 'overtime claimed for shifts nobody worked', 'equipment bought and never delivered']);
      return { subject: e.id, company: e.name, truth: seeded(`${me(p)}/ig/${year()}/t`).chance(0.55) ? 'waste' : 'none', words: `${e.name}: ${what}` };
    },
    options: [
      { id: 'independent', label: 'Follow the documents, and report to the legislature whatever they show', good: true, run(p, w) {
        const e = store.state.jobs?.employers?.[w.subject];
        chronicle(e, w.truth === 'waste' ? 'The inspector general reported waste, and the department changed how it buys.' : 'The inspector general looked into a complaint and found the department had followed its rules.');
        return w.truth === 'waste' ? 'The documents show waste. Your report goes to the legislature and is published; the department changes how it buys.' : 'The documents show the rules were followed. You say so, just as plainly.';
      } },
      { id: 'soften', label: 'Let the department head see the draft, and soften it', good: false, run(p) {
        complain(p, 'independence', 'An inspector general\'s report was softened after the agency under review saw a draft.');
        return 'The report is gentler. An inspector general\'s worth is their independence, and a staff member tells the legislature what happened.';
      } },
    ],
  },
  compliance: {
    name: 'Compliance investigator', ranks: ['Compliance investigator', 'Senior compliance investigator', 'Chief compliance officer'],
    needs: (p) => (degree(p, ['law', 'accounting', 'finance', 'business', 'criminal_justice', 'economics']) ? '' : 'Needs a degree in law, accounting, finance or business.'),
    find(p) {
      const cos = employersOf(p, ['corporate', 'retail', 'tech', 'transport', 'health']);
      if (!cos.length) return null;
      const e = seeded(`${me(p)}/comp/${year()}`).pick(cos);
      const caller = k.civilian(p.countryId, { age: 30 + seeded(`${me(p)}/comp/${year()}/a`).int(0, 25), kind: 'civilian' });
      caller.occupation = `Employee at ${e.name}`;
      return { subject: e.id, person: caller.id, words: `a report to ${e.name}'s ethics hotline` };
    },
    options: [
      { id: 'protect', label: 'Investigate the report, and keep the reporter\'s identity confidential', good: true, run(p, w) {
        chronicle(store.state.jobs?.employers?.[w.subject], 'An internal investigation followed a report to the ethics hotline; the company corrected the practice.');
        return 'You look into it without saying who called. The practice is corrected; the person who reported it keeps their job, and their privacy.';
      } },
      { id: 'reveal', label: 'Tell the manager involved who made the report', good: false, run(p, w) {
        const n = npc(w.person); if (n) n.meters.relationship = clamp(n.meters.relationship - 30);
        complain(p, 'retaliation', 'A compliance investigator told a manager who had made a hotline report; the employee was moved to another job.');
        return 'The manager knows who called. Within a month the employee is moved. Retaliation against a whistleblower is a breach of the law, and of the job.';
      } },
    ],
  },
  insurance: {
    name: 'Insurance investigator', ranks: ['Claims investigator', 'Senior investigator', 'Head of special investigations'],
    needs: (p) => ((p.career?.experience?.police ?? 0) + (p.career?.experience?.pi ?? 0) + (p.career?.experience?.detective ?? 0) >= 2 || degree(p) ? '' : 'Needs a degree, or two years of investigative work.'),
    find(p) {
      // A real fire, investigated by the police, and the owner's claim for it.
      let inv = Object.values(k.J().investigations).find((x) => x.file?.template === 'arson' && !x.file.claimReviewed);
      if (!inv) { const { a, det } = detective(p); inv = openCase('arson', { ownerId: a.id, lead: det }); }
      inv.file.claimReviewed = me(p);
      return { subject: inv.id, words: `the insurance claim after ${inv.file.title}`, truth: k.J().incidents[inv.incidentId]?.truth?.hypothesis };
    },
    options: [
      { id: 'verify', label: 'Verify the claim against the fire report, the policy and the records', good: true, run(p, w) {
        const f = investigation(w.subject)?.file;
        if (w.truth === 'insurance' && f) { f.leads.push({ id: `ins_${w.id}`, text: 'The insurer\'s investigator found the business was insured for twice its value a month before the fire, and reported it to the police.', why: 'An insurance investigation', status: 'open', at: now() }); return 'The policy was doubled a month before the fire. You hold the claim and report what you found to the police; deciding what happened is theirs and the court\'s.'; }
        return 'The records match: the claim is paid. A fire is not a fraud because it was expensive.';
      } },
      { id: 'deny', label: 'Deny the claim: fires like this are usually set', good: false, run(p) {
        complain(p, 'bad faith', 'A claim was denied on suspicion alone, without investigation.');
        return 'You deny it on a hunch. The owner sues the insurer for bad faith, and wins; the denial was not an investigation.';
      } },
    ],
  },
};

export const alliedOf = (p = player()) => p.allied ?? null;
/** Why the player cannot take up a career here, or ''. */
export function alliedBlock(id, p = player()) {
  const d = ALLIED[id];
  if (!d) return 'There is no such work.';
  if (alliedOf(p)?.id === id && p.career?.careerId === `ally_${id}`) return 'This is your work.';
  if (p.age < 21) return 'Needs to be 21 or older.';
  return d.needs(p);
}
export function takeUp(id, p = player()) {
  const why = alliedBlock(id, p);
  if (why) return result(false, why, 'neutral');
  const d = ALLIED[id];
  hire(CAREER_BY_ID[`ally_${id}`], 0, 60, 'allied');
  p.career.title = d.ranks[0];
  p.allied = { id, since: year(), work: [], careful: 0, misconduct: 0 };
  return result(true, `You start as ${d.ranks[0].toLowerCase()}.`);
}
/** The year's piece of work, from real records. */
export function alliedYear(p = player()) {
  const A = alliedOf(p);
  if (!A || p.career?.careerId !== `ally_${A.id}` || !p.alive || A.work.some((x) => x.status === 'open')) return [];
  const found = ALLIED[A.id].find(p);
  if (!found) return [];
  const w = { id: `aw_${A.id}_${me(p)}_${year()}`, status: 'open', at: now(), ...found };
  A.work.push(w);
  return [`${ALLIED[A.id].name}: ${found.words}.`];
}
export const openAllied = (p = player()) => (alliedOf(p)?.work ?? []).filter((x) => x.status === 'open');
export function doAllied(workId, optionId, p = player()) {
  const A = alliedOf(p);
  const w = A?.work.find((x) => x.id === workId && x.status === 'open');
  const o = w && ALLIED[A.id].options.find((x) => x.id === optionId);
  if (!o) return result(false, 'That work is done.', 'neutral');
  w.status = 'done'; w.how = optionId;
  if (o.good) { A.careful += 1; p.career.performance = clamp((p.career.performance ?? 50) + 4); }
  else { A.misconduct += 1; p.career.performance = clamp((p.career.performance ?? 50) - 10); }
  return result(true, o.run(p, w), o.good ? 'good' : 'bad');
}
/** Promotion on careful work and a clean record. */
export function alliedCareerYear(p = player()) {
  const A = alliedOf(p);
  if (!A || p.career?.careerId !== `ally_${A.id}`) return [];
  const d = ALLIED[A.id];
  const lvl = p.career.level ?? 0;
  if (lvl < d.ranks.length - 1 && year() - A.since >= (lvl + 1) * 3 && A.careful >= (lvl + 1) * 3 && A.misconduct === 0 && promote()) {
    p.career.title = d.ranks[p.career.level];
    return [`Promoted: ${p.career.title.toLowerCase()}.`];
  }
  return [];
}
export { majors };
