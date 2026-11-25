// The cases lawyers handle: one persistent record per matter, kept in the justice world beside the Justice Engine's
// own records (engine/cases.js). A criminal matter is the Justice Engine's case, linked by justiceCaseId: the verdict
// and the defendant's record are written there, once. Family, child, immigration, civil and transactional matters
// live here. Every client, witness, judge and opposing lawyer is a persistent character.
//
// A case moves through its stages as game months pass (the absolute month in engine/lawSchool.js), never by button
// presses. Routine work happens by itself; decisions that matter wait for the player: a filing, a negotiation, a day in
// court. A day in court that the player does not attend within six months is handled routinely, at the case's level of
// preparation, and only on a later turn than the one it fell due in, so a long turn never takes the chance away.
import { rng } from '../rng.js';
import { clamp, localCost, fmtMoney } from '../util.js';
import { store, player, country, log } from '../state.js';
import * as k from './cases.js';
import { freshCase } from './legalCareers.js';
import { lawOf, nowM, gain, profileFor, canon } from './lawSchool.js';
import { CASE_TEMPLATES, SPECIALTY_BY_ID, ETHICS, COMPLEXITY, LEGAL_CAREERS } from '../data/law.js';
import { OFFENSE_BY_ID } from '../data/justice.js';
import { COUNTRIES } from '../data/countries.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const ORG_A = ['Harlow', 'Brightwater', 'Cedar', 'Northgate', 'Ridgeway', 'Kestrel', 'Summit', 'Bluepoint'];
const ORG_B = ['Supplies', 'Holdings', 'Foods', 'Logistics', 'Industries', 'Retail', 'Partners', 'Systems'];
const orgName = () => `${rng.pick(ORG_A)} ${rng.pick(ORG_B)}`;

// ---------- The store ----------

/** All lawyers' cases in this world, by id. */
export function LC(state = store.state) { const j = k.J(state); j.lawCases ??= {}; j.lawSeq ??= 0; return j.lawCases; }
export const caseById = (id) => LC()[id] ?? null;
const nameOf = (id) => { const n = store.state.npcs[id]; return n ? `${n.firstName} ${n.lastName}` : id ?? ''; };
const first = (id) => store.state.npcs[id]?.firstName ?? '';
const fill = (s, c) => String(s ?? '').replace(/\{(\w+)\}/g, (m, key) => c.vars?.[key] ?? m);
export const note = (c, text) => c.history.push({ m: nowM(), year: store.state.year, text });

/** The roles a lawyer can hold in a case, by the side they are on. */
const ROLE_FOR = { criminal: { defense: 'defense', prosecution: 'prosecution' }, family: 'petitioner', child: 'childAttorney', immigration: 'applicant', civil: 'plaintiff', transaction: 'counsel' };
export const ROLE_NAME = { defense: 'Defense counsel', prosecution: 'Prosecutor', petitioner: 'Counsel for the petitioner', childAttorney: 'Attorney for the child',
  juvenileDefense: 'Juvenile defense counsel', applicant: 'Counsel for the applicant', plaintiff: 'Counsel for the plaintiff', counsel: 'Lead counsel', agency: 'Counsel for the agency', clinic: 'Student attorney (supervised)' };

/** A party: a persistent person, kept in the justice world's people. */
function party(countryId, o = {}) {
  const n = k.civilian(countryId, { age: o.age ?? rng.int(24, 62), kind: o.kind ?? 'party', role: 'official', gender: o.gender });
  if (o.firstName) n.firstName = o.firstName;
  if (o.lastName) n.lastName = o.lastName;
  n.flags.title = o.title ?? n.flags.title;
  return n;
}

/**
 * Opens a case. The template decides its kind and stages; the role, who the lawyer works for.
 * @param {string} templateId  data/law.js CASE_TEMPLATES
 * @param {{role?:string, countryId?:string, supervisorId?:string, lawyerId?:string, clinic?:boolean, fee?:string, assigned?:boolean}} o
 */
export function createCase(templateId, o = {}) {
  const T = CASE_TEMPLATES[templateId];
  if (!T) throw new Error(`No case template ${templateId}`);
  const p = player();
  const countryId = o.countryId ?? p.countryId;
  const prof = profileFor(countryId);
  LC(); // the store and its counter exist before the first id is drawn
  const id = `lc_${++k.J().lawSeq}`;
  const role = o.role ?? (T.kind === 'criminal' ? 'defense' : T.role ?? (T.gov ? 'agency' : ROLE_FOR[T.kind]));
  const c = { id, templateId, kind: T.kind, level: T.level, countryId, opened: nowM(), openedYear: store.state.year, role, lawyerId: o.lawyerId ?? p.id,
    supervisorId: o.supervisorId ?? null, clinic: !!o.clinic, assigned: !!o.assigned, specialty: o.specialty ?? null,
    track: o.track ?? (o.clinic ? 'clinic' : LEGAL_CAREERS.includes(p.career?.careerId) ? p.career.careerId : null), // the job it was done in
    stages: T.stages.map(([s, months]) => ({ s, months })), stageIdx: 0, due: nowM() + T.stages[0][1],
    jury: !!T.jury && (T.kind === 'criminal' ? prof.juries.criminal : T.kind === 'civil' ? prof.juries.civil : false), forum: T.forum,
    vars: {}, parties: {}, evidence: [], witnesses: [], filings: [], deadlines: [], hearings: [], tasks: {}, research: null,
    negotiation: { offers: [], accepted: null }, court: null, awaiting: null, outcome: null, appeal: null, errors: [], ethics: null,
    fee: { model: o.fee ?? (role === 'prosecution' || role === 'agency' || o.assigned || o.clinic ? 'salary' : (SPECIALTY_BY_ID[o.specialty]?.fees ?? ['flat'])[0]), paid: false, amount: 0 },
    history: [], confidential: true, done: false };
  // The people in it.
  const bench = k.bench(countryId);
  c.judgeId = T.forum === 'none' ? null : k.pick(bench.judges).id;
  if (T.kind === 'criminal') {
    const jc = freshCase({ offenseId: T.offense });
    if (jc) {
      c.justiceCaseId = jc.id;
      c.parties.defendantId = jc.defendantId;
      const d = store.state.npcs[jc.defendantId];
      if (T.fixedClient && d) { d.firstName = T.fixedClient.firstName; d.lastName = T.fixedClient.lastName; d.age = T.fixedClient.age; }
      if (jc.judgeId) c.judgeId = jc.judgeId;
      if (role === 'defense') { c.clientId = jc.defendantId; c.otherCounselId = jc.prosecutorId ?? k.pick(bench.prosecutors).id; jc.defenseId = p.id; }
      else { c.clientId = null; c.otherCounselId = k.pick(bench.defense.good).id; jc.prosecutorId = p.id; }
    } else {
      const d = party(countryId, T.fixedClient ?? {});
      c.parties.defendantId = d.id;
      c.clientId = role === 'defense' ? d.id : null;
      c.otherCounselId = role === 'defense' ? k.pick(bench.prosecutors).id : k.pick(bench.defense.good).id;
    }
    c.vars.client = nameOf(c.parties.defendantId);
    c.vars.charge = OFFENSE_BY_ID[T.offense]?.name ?? T.offense;
  } else {
    // A returning client is the same person, with their history intact.
    const client = (o.clientId && store.state.npcs[o.clientId]?.alive) ? store.state.npcs[o.clientId] : party(countryId, { title: 'Client' });
    c.clientId = role === 'agency' ? null : client.id;
    c.vars.client = nameOf(client.id);
    if (['family', 'child'].includes(T.kind)) {
      const other = party(countryId, { title: T.kind === 'family' ? 'Spouse' : 'Parent' });
      other.flags.spouseId = client.id; client.flags.spouseId = other.id; // a marriage on the record, between two real people
      c.parties.otherId = other.id;
      c.vars.other = nameOf(other.id);
      const kid = party(countryId, { age: rng.int(6, 15), title: 'Child' });
      kid.flags.parentIds = [client.id, other.id];
      c.parties.childId = kid.id;
      c.vars.child = first(kid.id);
      c.vars.childAge = String(kid.age);
      if (T.kind === 'child') { c.clientId = kid.id; c.vars.client = nameOf(kid.id); }
      c.vars.years = String(rng.int(6, 22));
      c.otherCounselId = party(countryId, { title: 'Opposing counsel', kind: 'lawyer', age: rng.int(30, 60) }).id;
    } else if (T.kind === 'immigration') {
      c.vars.relation = rng.pick(['mother', 'father', 'spouse', 'brother', 'sister']);
      c.vars.years = String(rng.int(6, 18));
      c.parties.agency = T.forum === 'immigration' ? 'the immigration court' : 'the immigration agency';
      c.otherCounselId = T.forum === 'immigration' ? party(countryId, { title: 'Government counsel', kind: 'lawyer' }).id : null;
      const home = Object.keys(COUNTRIES).filter((x) => x !== countryId);
      client.flags.originCountryId = rng.pick(home); // where the client came from: a real country in the world
    } else if (T.kind === 'transaction') {
      c.vars.clientOrg = `${orgName()}`;
      c.vars.otherOrg = `${orgName()}`;
      c.vars.deceased = `${client.lastName} senior`;
      client.flags.title = templateId === 'acquisition' || templateId === 'supply_deal' ? `General counsel, ${c.vars.clientOrg}` : 'Client';
      c.otherCounselId = templateId === 'will' ? null : party(countryId, { title: 'Opposing counsel', kind: 'lawyer' }).id;
    } else {
      c.vars.otherOrg = orgName();
      c.vars.clientOrg = T.title.includes('{clientOrg}') ? orgName() : c.vars.otherOrg;
      c.otherCounselId = party(countryId, { title: T.gov || T.forum === 'tax' ? 'Government counsel' : 'Opposing counsel', kind: 'lawyer', age: rng.int(30, 60) }).id;
      // A dispute between two people (a boundary between neighbors) has a person on the other side.
      if (`${T.title}${T.summary}`.includes('{other}')) { const o2 = party(countryId, { title: 'Neighbor' }); c.parties.otherId = o2.id; c.vars.other = nameOf(o2.id); }
    }
    c.vars.city = p.city ?? COUNTRIES[countryId]?.cities?.[0] ?? '';
    c.vars.address = `${rng.int(12, 980)} ${rng.pick(['Oak', 'Maple', 'Hill', 'River', 'Station', 'Park', 'Church', 'Mill'])} ${rng.pick(['Street', 'Road', 'Lane', 'Avenue'])}`;
  }
  c.title = fill(T.title, c);
  c.summary = fill(T.summary, c);
  c.evidence = T.evidence.map((e) => ({ ...e, label: fill(e.label, c), reviewed: false, status: e.admissibility === 'ok' ? 'admitted' : 'disputed', reliability: e.reliability }));
  c.witnesses = (T.witnesses ?? []).map((w) => ({ ...w, npcId: party(countryId, { title: w.role, kind: 'witness' }).id, examined: false }));
  for (const w of c.witnesses) if (store.state.npcs[w.npcId]) store.state.npcs[w.npcId].flags.justice.caseIds.push(id);
  // A filing deadline for the first stage that needs one.
  const fileAt = c.stages.findIndex((s) => ['filing', 'pretrial', 'pleadings', 'drafting', 'review', 'diligence'].includes(s.s));
  if (fileAt >= 0) c.deadlines.push({ id: 'filing', label: fill(T.motion?.name ?? 'Main filing', c), due: c.opened + c.stages.slice(0, fileAt + 1).reduce((s, x) => s + x.months, 0), met: null });
  note(c, `Opened: ${c.title}. ${ROLE_NAME[c.role] ?? 'Counsel'}${c.clinic ? ', under supervision' : ''}.`);
  LC()[id] = c;
  lawOf(p).caseIds.push(id);
  return c;
}

// ---------- Reading a case ----------

export const template = (c) => CASE_TEMPLATES[c.templateId];
export const stageOf = (c) => c.stages[c.stageIdx]?.s ?? 'closed';
export const STAGE_NAME = { intake: 'Intake', discovery: 'Discovery', pretrial: 'Pretrial motions', trial: 'Trial', verdict: 'Verdict', hearing: 'Hearing', filing: 'Filing',
  disclosure: 'Financial disclosure', negotiation: 'Negotiation', judgment: 'Judgment', evaluation: 'Custody evaluation', review: 'Case review', services: 'Family services',
  interview: 'Interview', decision: 'Decision', demand: 'Demand letter', pleadings: 'Pleadings', drafting: 'Drafting', signing: 'Signing', done: 'Done', inventory: 'Inventory',
  distribution: 'Distribution', diligence: 'Due diligence', closing: 'Closing', closed: 'Closed', record: 'The trial record', briefing: 'Briefing', argument: 'Oral argument' };
/** The side's evidence: for the defense, what favors the client; for a prosecutor, what the state relies on. */
const ours = (c, e) => (c.role === 'prosecution' ? e.favors === 'other' : e.favors === 'client');
const DECIDING = ['trial', 'hearing', 'interview', 'argument', 'decision', 'judgment', 'verdict', 'closing', 'signing', 'distribution', 'done'];
/** Where a case is held, in words. */
export function forumName(c) {
  return { trial: 'Trial court', family: 'Family court', juvenile: 'Juvenile court', agency: 'Agency review', immigration: 'Immigration court', tribunal: 'Employment tribunal', probate: 'Probate court', tax: 'Tax tribunal', appeal: 'Court of Appeal', none: 'No court: a transaction' }[c.forum] ?? 'Court';
}
/** Strength of each side's case from the evidence still in it: weight × reliability, for what is admitted. */
export function strength(c) {
  let mine = 0; let theirs = 0;
  for (const e of c.evidence) {
    if (e.status === 'excluded') continue;
    const v = e.weight * e.reliability / 100;
    if (ours(c, e)) mine += v; else theirs += v;
  }
  return { mine, theirs, share: mine / Math.max(0.1, mine + theirs) };
}
/** What the player can do on the case now. Each is done once; routine parts are done anyway as months pass. */
export function actions(c) {
  if (c.done) return [];
  const st = stageOf(c);
  const T = template(c);
  const out = [];
  if (c.clientId && !c.tasks.interview) out.push({ id: 'interview', label: c.kind === 'child' ? `Meet ${first(c.clientId)}` : 'Interview the client' });
  if (!c.tasks.review) out.push({ id: 'review', label: 'Review the evidence' });
  if (!c.research) out.push({ id: 'research', label: 'Research the law' });
  const filed = c.filings.some((f) => f.main);
  if (T.motion && !filed && !DECIDING.includes(st)) out.push({ id: 'file', label: `Prepare: ${fill(T.motion.name, c)}` });
  if (canNegotiate(c)) out.push({ id: 'negotiate', label: c.kind === 'criminal' ? (c.role === 'defense' ? 'Discuss a plea' : 'Consider a plea offer') : c.kind === 'transaction' ? 'Negotiate terms' : 'Discuss a settlement' });
  if (c.role === 'prosecution' && !c.tasks.charging) out.push({ id: 'charging', label: 'Review the charges' });
  if (c.awaiting) out.push({ id: 'court', label: c.kind === 'transaction' ? 'Close the deal' : c.awaiting.what === 'trial' ? 'Go to trial' : 'Attend the hearing' });
  if (c.ethics && !c.ethics.resolved) out.push({ id: 'ethics', label: 'A difficult request' });
  return out;
}
// A deal can be struck in the stages for it, and right up to the door of the court: however long the turns, the chance
// to settle or plead is there before a hearing or trial.
const canNegotiate = (c) => !c.done && !c.negotiation.accepted && (template(c).settle || c.kind === 'criminal')
  && (['negotiation', 'pretrial', 'discovery', 'disclosure', 'evaluation', 'review', 'diligence', 'inventory', 'services'].includes(stageOf(c)) || !!c.awaiting)
  && !c.negotiation.offers.some((o) => o.m === nowM());

// ---------- Working a case ----------

const skillIn = (ids) => { const L = lawOf(player()); return ids.reduce((s, id) => s + (L.skills[id] ?? 10), 0) / ids.length; };

/** Interviewing the client: their account (not necessarily the whole truth), and what they want. */
export function interview(c) {
  if (c.tasks.interview) return result(false, 'You have met them.', 'neutral');
  c.tasks.interview = nowM();
  const n = store.state.npcs[c.clientId];
  if (n) n.meters.relationship = clamp(n.meters.relationship + 8);
  gain(player(), { counseling: 2 });
  const T = template(c);
  const stance = c.kind === 'criminal' ? (rng.chance(0.75) ? 'insists they did not do it' : 'is not sure how much to tell you') : c.kind === 'child' ? 'tells you, in their own words, what they want' : 'wants this settled fairly, and quickly';
  c.clientAccount = `${first(c.clientId)} ${stance}.`;
  const hidden = c.evidence.find((e) => ours(c, e) && !e.reviewed);
  if (hidden && rng.chance(0.5 + skillIn(['counseling']) / 200)) { hidden.reviewed = true; hidden.fromClient = true; }
  note(c, `Met the client. ${c.clientAccount}`);
  return result(true, `${c.clientAccount}${hidden?.fromClient ? ` They mention something useful: ${hidden.label.charAt(0).toLowerCase()}${hidden.label.slice(1)}.` : ''}`, 'neutral', { account: c.clientAccount, stated: T.summary });
}
/** Going through the evidence: each item's reliability and whether it can be challenged. Evaluated, never made up. */
export function review(c) {
  if (c.tasks.review) return result(false, 'You have been through it.', 'neutral');
  c.tasks.review = nowM();
  for (const e of c.evidence) e.reviewed = true;
  gain(player(), { evidence: 2, analysis: 1 });
  const weak = c.evidence.filter((e) => !ours(c, e) && (e.reliability < 60 || e.admissibility === 'challengeable'));
  note(c, 'Reviewed the evidence.');
  return result(true, weak.length ? `Worth a closer look: ${weak.map((e) => e.label.charAt(0).toLowerCase() + e.label.slice(1)).join('; ')}.` : 'Nothing in the file looks weak.', 'neutral');
}
/** The research question. A right answer makes the filing and the argument stronger; a wrong one costs a little. */
export function researchQuestion(c) { const T = template(c); return T.research ? { text: fill(T.research.text, c), options: T.research.options.map((o) => fill(o, c)), right: T.research.right, why: fill(T.research.why, c) } : null; }
export function research(c, answer) {
  if (c.research) return result(false, 'You have researched it.', 'neutral');
  const rq = researchQuestion(c);
  const right = answer === rq.right;
  c.research = { m: nowM(), right };
  gain(player(), { research: right ? 3 : 1, interpretation: 1 });
  note(c, right ? 'Research found the issue that decides the case.' : 'Research went down the wrong path.');
  return result(right, right ? rq.why : `Not quite. ${rq.why}`, right ? 'good' : 'neutral', { why: rq.why });
}
/** The filing's choices: the strongest supported argument, a weak one, conceding, or delay. */
export function filingOptions(c) { const T = template(c); return T.motion ? { name: fill(T.motion.name, c), options: T.motion.options.map(([t, kind]) => ({ text: fill(t, c), kind })) } : null; }
/**
 * Files the main document. Its quality comes from research, writing and the argument chosen; a judge rules on it.
 * An argument with no legal basis is not filed as if it were: the court strikes it, and it is noticed.
 */
export function file(c, kind, o = {}) {
  if (c.filings.some((f) => f.main)) return result(false, 'It is filed.', 'neutral');
  const T = template(c);
  const L = lawOf(player());
  const quality = clamp((kind === 'strong' ? 0.55 : kind === 'weak' ? 0.25 : kind === 'concede' ? 0.4 : 0.1) + (c.research?.right ? 0.15 : 0) + skillIn(['writing', 'research']) / 300 + (o.routine ? -0.1 : 0), 0, 1);
  // Routine work is done in the months it was due, not on the day the turn ends.
  const when = o.at ?? nowM();
  const f = { id: `f${c.filings.length + 1}`, main: true, name: fill(T.motion.name, c), kind, quality: Math.round(quality * 100) / 100, m: when, routine: !!o.routine, ruling: null };
  if (c.supervisorId) f.reviewedBy = c.supervisorId; // a supervisor read it first
  f.how = store.state.year < 1990 ? 'on paper, by hand at the clerk\'s office' : store.state.year < 2005 ? 'on paper, by post or courier' : 'electronically';
  c.filings.push(f);
  const dl = c.deadlines.find((d) => d.id === 'filing' && d.met == null);
  if (dl) dl.met = when <= dl.due;
  gain(player(), { writing: 2, drafting: c.kind === 'transaction' ? 2 : 0, procedure: 1 });
  let text;
  const target = c.evidence.find((e) => e.id === T.motion.target);
  if (kind === 'improper') {
    L.rep.integrity = clamp(L.rep.integrity - 4);
    f.ruling = 'struck';
    text = 'The judge struck the motion: it had no legal basis. It will be remembered.';
  } else if (kind === 'delay') {
    c.due += 2; f.ruling = 'granted';
    text = 'The court gave you two more months.';
  } else if (kind === 'concede') {
    f.ruling = 'n/a';
    text = 'Filed. You conceded the point.';
  } else {
    // A judge rules on the merits: a strong, well-researched filing usually succeeds, never always; and judges make mistakes.
    const judge = store.state.npcs[c.judgeId];
    const jskill = judge?.flags.justice?.skill ?? 70;
    const merit = kind === 'strong' && (!target || target.admissibility === 'challengeable' || target.favors !== (c.role === 'prosecution' ? 'other' : 'client'));
    const granted = rng.chance(clamp(merit ? 0.45 + quality * 0.5 : 0.1 + quality * 0.2, 0.05, 0.92));
    f.ruling = granted ? 'granted' : 'denied';
    if (merit && !granted && rng.chance(0.5 + (75 - jskill) / 100)) c.errors.push({ kind: 'motion', text: `The ${f.name.toLowerCase()} was denied though it had merit.` });
    if (granted && target) {
      if (target.admissibility === 'challengeable' && !ours(c, target)) target.status = 'excluded';
      else if (!ours(c, target)) target.reliability = Math.round(target.reliability * 0.6);
    }
    if (granted && c.kind !== 'criminal' && kind === 'strong') c.bonus = (c.bonus ?? 0) + 0.06;
    text = granted ? (target && target.status === 'excluded' ? `Granted. The ${target.label.toLowerCase()} is out of the case.` : 'Granted.') : 'Denied.';
  }
  c.hearings.push({ m: nowM(), kind: 'motion', result: f.ruling });
  note(c, `${f.name}: ${text}`);
  return result(f.ruling === 'granted' || f.ruling === 'n/a', text, f.ruling === 'struck' ? 'bad' : f.ruling === 'granted' ? 'good' : 'neutral', { filing: f });
}

/** For a prosecutor: the charges, reviewed against the evidence. A case that does not hold should be dropped. */
export function reviewCharges(c, decision) {
  if (c.role !== 'prosecution') return result(false, 'Not your decision.', 'neutral');
  if (c.tasks.charging) return result(false, 'Done.', 'neutral');
  c.tasks.charging = nowM();
  const s = strength(c).share;
  const L = lawOf(player());
  if (decision === 'dismiss') {
    gain(player(), { ethics: 2 });
    if (s < 0.5) L.rep.integrity = clamp(L.rep.integrity + 3);
    return close(c, { kind: 'dismissed', text: 'You dropped the charges: the evidence did not support them.', favorable: s < 0.5 ? 0.6 : -0.2 });
  }
  if (decision === 'reduce') { c.reduced = true; note(c, 'Proceeding on a lesser charge.'); return result(true, 'You proceed on a lesser charge the evidence clearly supports.', 'neutral'); }
  if (s < 0.4) { L.rep.integrity = clamp(L.rep.integrity - 2); c.weakPush = true; }
  note(c, 'Proceeding on the charges as filed.');
  return result(true, s < 0.4 ? 'You go ahead, though the evidence is thin.' : 'The evidence supports the charges. You go ahead.', 'neutral');
}

// ---------- Negotiation ----------

/** What the other side would offer now: built from the evidence, not from who is richer or louder. */
export function currentOffer(c) {
  const s = strength(c).share + (c.bonus ?? 0);
  const T = template(c);
  if (c.kind === 'criminal') {
    const off = OFFENSE_BY_ID[T.offense];
    const lesser = off?.severity >= 3 ? 'a lesser charge' : 'a reduced charge with no custody';
    return c.role === 'defense'
      ? { text: `The prosecutor offers a plea to ${lesser}.`, value: s, kind: 'plea' }
      : { text: `The defense will plead to ${lesser}.`, value: s, kind: 'plea' };
  }
  if (c.kind === 'family') return { text: T.kind === 'family' && c.templateId === 'divorce' ? `${first(c.parties.otherId)} offers ${Math.round(clamp(40 + s * 25, 35, 62))}% of the shared property to ${first(c.clientId)}.` : `${first(c.parties.otherId)} proposes a shared parenting plan.`, value: s, kind: 'settlement', share: Math.round(clamp(40 + s * 25, 35, 62)) };
  if (c.kind === 'child') return { text: c.templateId === 'juvenile' ? 'The prosecutor agrees to diversion if the damage is repaired.' : 'The agency proposes services at home, with reviews every three months.', value: s, kind: 'agreement' };
  if (c.kind === 'transaction') return { text: c.templateId === 'acquisition' ? 'The seller will give an indemnity and take 4% off the price.' : 'The other side agrees to mutual notice of three months.', value: s, kind: 'terms' };
  const claim = localCost(c.templateId === 'injury' ? 60000 : c.templateId === 'dismissal' ? 45000 : 18000, COUNTRIES[c.countryId]);
  return { text: `They offer ${fmtMoney(Math.round(claim * clamp(s * 0.9, 0.2, 0.85)), COUNTRIES[c.countryId])} to settle.`, value: s, kind: 'settlement', amount: Math.round(claim * clamp(s * 0.9, 0.2, 0.85)), claim };
}
/** Accept or decline what is offered. A client may refuse a deal the lawyer recommends: their case, their decision. */
export function negotiate(c, accept) {
  if (!canNegotiate(c)) return result(false, 'There is nothing on the table now.', 'neutral');
  const offer = currentOffer(c);
  c.negotiation.offers.push({ m: nowM(), text: offer.text, accepted: !!accept });
  gain(player(), { negotiation: 2, counseling: 1 });
  if (!accept) { note(c, `Declined: ${offer.text}`); return result(true, 'You turned it down. The case goes on.', 'neutral'); }
  const client = store.state.npcs[c.clientId];
  if (client && c.kind === 'criminal' && c.clientAccount?.includes('insists') && rng.chance(0.55)) {
    note(c, `${first(c.clientId)} refused the plea: they want their day in court.`);
    return result(false, `${first(c.clientId)} will not plead to something they say they did not do. Their decision: the case goes on.`, 'neutral');
  }
  c.negotiation.accepted = { m: nowM(), ...offer };
  if (c.kind === 'criminal') {
    const jc = c.justiceCaseId ? k.J().cases[c.justiceCaseId] : null;
    if (jc) k.pleaFrom(jc);
    return close(c, { kind: 'plea', text: 'A plea agreement, accepted in court.', favorable: c.role === 'defense' ? (offer.value > 0.55 ? 0.2 : 0.5) : 0.4 });
  }
  if (c.kind === 'transaction') { c.bonus = (c.bonus ?? 0) + 0.1; note(c, 'Terms agreed.'); return result(true, 'Terms agreed. What is left is signing.', 'good'); }
  return close(c, { kind: 'settlement', text: `${offer.text} Agreed.`, favorable: clamp(offer.value, 0.2, 0.8), amount: offer.amount ?? 0 });
}

// ---------- The courtroom ----------

/** What a day in court asks of the player, built from the case file. Not every proceeding has every phase. */
export function courtroom(c) {
  if (!c.awaiting) return null;
  const T = template(c);
  const pros = c.role === 'prosecution';
  const generic = {
    opening: pros ? [['Lay out the evidence plainly, piece by piece', 'evidence'], ['Promise the jury a confession they will not hear', 'overpromise'], ['Keep it short', 'brief']]
      : c.kind === 'family' || c.kind === 'child' ? [['Put the child\'s needs and the facts first', 'evidence'], ['Attack the other parent', 'improper'], ['Keep it brief', 'brief']]
      : c.kind === 'immigration' ? [['Walk the judge through the documents and the law', 'evidence'], ['Say the law is unfair', 'merits'], ['Keep it brief', 'brief']]
      : [['Walk through the documents that prove the claim', 'evidence'], ['Promise a huge award', 'overpromise'], ['Keep it brief', 'brief']],
    closing: [['Go through the evidence, and what the law asks', 'evidence'], ['Appeal to sympathy', 'sympathy'], ['Attack the other side personally', 'improper']],
  };
  const phases = [];
  if (c.forum === 'appeal') {
    // An appeal is argued on the record before a panel of judges: no witnesses, no jury, and questions from the bench.
    phases.push({ id: 'opening', title: 'Oral argument', options: [['Lead with the error in the record, and why it changed the result', 'evidence'], ['Argue the jury got the facts wrong', 'merits'], ['Keep it short and rely on the brief', 'brief']].map(([t, v]) => ({ text: t, v })) });
    phases.push({ id: 'bench', title: 'A question from the bench', text: 'A judge interrupts: "Counsel, the jury heard other evidence. Why would the email have changed anything?"', options: [['Answer directly: point to what only the email showed', 'strong'], ['Steer back to your outline', 'dodge'], ['Say the judge has misread the record', 'rude']].map(([t, v]) => ({ text: t, v })) });
    phases.push({ id: 'closing', title: 'Rebuttal', options: [['Answer their best point, briefly', 'evidence'], ['Repeat your opening', 'sympathy'], ['Accuse the trial judge of bias', 'improper']].map(([t, v]) => ({ text: t, v })) });
    return { title: c.title, what: 'hearing', jury: false, judge: nameOf(c.judgeId), opposing: nameOf(c.otherCounselId), phases };
  }
  if (c.jury) phases.push({ id: 'jury', title: 'Jury selection', text: 'Twelve people from the community, questioned by both sides and the judge.', options: [['Ask about experience with the police and with eyewitnesses', 'fair'], ['Try to keep off anyone who looks like a homeowner', 'improper'], ['Accept the first twelve', 'quick']].map(([t, v]) => ({ text: t, v })) });
  if (c.kind !== 'transaction') phases.push({ id: 'opening', title: c.kind === 'immigration' || c.kind === 'family' || c.kind === 'child' ? 'Your statement to the court' : 'Opening statement', options: (pros ? generic.opening : T.opening ?? generic.opening).map(([t, v]) => ({ text: fill(t, c), v })) });
  if (T.objection && !pros) phases.push({ id: 'objection', title: 'An objection?', text: fill(T.objection.text, c), options: T.objection.options.map(([t, v]) => ({ text: t, v })), valid: T.objection.valid });
  if (pros && c.kind === 'criminal') phases.push({ id: 'objection', title: 'An objection?', text: 'Defense counsel asks your witness: "You have hated my client for years, haven\'t you, and you are lying now?"', options: [['Object: argumentative', 'argumentative'], ['Object: hearsay', 'hearsay'], ['Let it go', 'none']].map(([t, v]) => ({ text: t, v })), valid: 'argumentative' });
  const crossW = T.cross && !pros ? c.witnesses.find((w) => w.id === T.cross.witness) : null;
  if (crossW) phases.push({ id: 'cross', title: `Cross-examination: ${nameOf(crossW.npcId)}, ${crossW.role.toLowerCase()}`, text: fill(T.cross.text, c), options: T.cross.options.map(([t, v]) => ({ text: fill(t, c), v })), good: crossW.weakness });
  else if (pros && c.kind === 'criminal') phases.push({ id: 'direct', title: 'Direct examination of your witness', text: `${nameOf(c.witnesses[0]?.npcId)} takes the stand.`, options: [['Short, open questions that let them tell it', 'open'], ['Lead them through it word by word', 'leading'], ['Skip them', 'skip']].map(([t, v]) => ({ text: t, v })) });
  else if (c.witnesses.some((w) => w.side === 'client')) phases.push({ id: 'direct', title: 'Direct examination', text: `${nameOf(c.witnesses.find((w) => w.side === 'client').npcId)} takes the stand for your side.`, options: [['Short, open questions that let them tell it', 'open'], ['Lead them through it word by word', 'leading'], ['Skip them', 'skip']].map(([t, v]) => ({ text: t, v })) });
  if (c.kind === 'transaction') phases.push({ id: 'closing', title: 'Closing the deal', options: [['Check every condition is met, then sign', 'evidence'], ['Sign tonight and fix problems later', 'rushed'], ['Walk away', 'walk']].map(([t, v]) => ({ text: t, v })) });
  else phases.push({ id: 'closing', title: 'Closing argument', options: (pros ? generic.closing : T.closing ?? generic.closing).map(([t, v]) => ({ text: fill(t, c), v })) });
  return { title: c.title, what: c.awaiting.what, jury: c.jury, judge: nameOf(c.judgeId), opposing: nameOf(c.otherCounselId), phases };
}
const PHASE_POINTS = {
  jury: { fair: 0.02, quick: 0, improper: -0.04 },
  opening: { burden: 0.04, theory: 0.05, evidence: 0.05, brief: 0.02, overpromise: -0.05, merits: -0.02, improper: -0.06 },
  direct: { open: 0.04, leading: -0.02, skip: 0 },
  bench: { strong: 0.06, dodge: -0.02, rude: -0.06 },
  closing: { evidence: 0.06, burden: 0.05, sympathy: 0, improper: -0.07, rushed: -0.08, walk: 0 },
};
/**
 * The day in court. Each phase moves the result a little; the evidence still in the case, the burden of proof and the
 * other side's skill move it more; and there is always some doubt about how a jury or judge will see it.
 * @param {Object<string,string>} answers  phase id → the value chosen
 */
export function argue(c, answers = {}, o = {}) {
  const day = courtroom(c);
  if (!day) return result(false, 'There is no hearing now.', 'neutral');
  const L = lawOf(player());
  const lines = [];
  let adv = 0;
  for (const ph of day.phases) {
    const a = answers[ph.id] ?? (o.routine ? (ph.id === 'objection' ? 'none' : ph.id === 'cross' ? 'repeat' : ph.options[0].v) : ph.options[0].v);
    if (ph.id === 'objection') {
      if (a === 'none') { if (ph.valid) adv -= 0.03; lines.push('You let the question stand.'); }
      else if (a === ph.valid) {
        adv += 0.05; lines.push('Objection sustained. The answer is struck.');
        const hearsay = c.evidence.find((e) => !ours(c, e) && e.status !== 'excluded' && e.weight >= 3);
        if (hearsay && ph.valid === 'hearsay') hearsay.reliability = Math.round(hearsay.reliability * 0.85);
      } else { adv -= 0.03; L.rep.advocacy = clamp(L.rep.advocacy - 1); lines.push('Overruled. The judge looks at you over their glasses.'); }
      continue;
    }
    if (ph.id === 'cross') {
      const w = c.witnesses.find((x) => x.weakness === ph.good);
      if (a === ph.good) {
        // The witness is not destroyed; the answer shows what the file already shows.
        const hit = c.evidence.filter((e) => !ours(c, e) && e.status !== 'excluded').sort((x, y) => y.weight * y.reliability - x.weight * x.reliability)[0];
        if (hit) hit.reliability = Math.round(hit.reliability * (0.55 + rng.next() * 0.2));
        adv += 0.04;
        lines.push(rng.chance(0.6) ? 'The witness admits it was dark, and they were far away. They still say it looked like your client.' : 'The witness hesitates, then corrects one detail of their earlier statement.');
        if (w) w.examined = 'shaken';
      } else if (a === 'improper') { adv -= 0.05; L.rep.integrity = clamp(L.rep.integrity - 2); lines.push('The judge stops the question: it is not relevant, and it is not fair.'); }
      else { lines.push('The witness repeats their account, firmly. Nothing new comes out.'); if (w) w.examined = 'held'; }
      continue;
    }
    const pts = PHASE_POINTS[ph.id]?.[a] ?? 0;
    adv += pts;
    if (ph.id === 'opening') lines.push(pts > 0.03 ? 'Your opening is clear, and grounded in the file.' : pts < 0 ? 'You promised more than the evidence can give. The jury will remember.' : 'A short opening.');
    if (ph.id === 'closing') lines.push(pts > 0.03 ? 'You close on the evidence, and on what the law asks.' : pts < 0 ? 'Your closing goes too far.' : 'An even closing.');
    if (ph.id === 'jury' && pts < 0) L.rep.integrity = clamp(L.rep.integrity - 1);
    if (ph.id === 'closing' && a === 'walk' && c.kind === 'transaction') return close(c, { kind: 'abandoned', text: 'You advised the client to walk away from the deal.', favorable: 0.2 });
  }
  gain(player(), { oral: 3, procedure: 2, cross: answers.cross ? 2 : 0, examination: answers.direct ? 2 : 0, strategy: 2 }, o.routine ? 0.4 : 1);
  return decide(c, adv, lines, o);
}

/** The ruling or verdict: evidence first, then the advocacy, the skill on each side, and the doubt in any judgment. */
function decide(c, adv, lines, o = {}) {
  const s = strength(c);
  const mine = clamp(skillIn(['oral', 'strategy', 'evidence', 'procedure']), 0, 100);
  const theirs = store.state.npcs[c.otherCounselId]?.flags.justice?.skill ?? 55;
  const prepared = (c.tasks.review ? 0.02 : -0.02) + (c.research?.right ? 0.03 : 0) + (c.tasks.interview ? 0.01 : 0);
  const edge = clamp(adv, -0.18, 0.2) + (mine - theirs) / 500 + prepared + (c.bonus ?? 0) + (o.routine ? -0.03 : 0);
  const noise = (rng.next() - 0.5) * 0.24;
  const T = template(c);
  let out;
  if (c.kind === 'criminal') {
    // The prosecution must prove its case. The share of the remaining evidence that points to guilt, moved by advocacy.
    const proof = (c.role === 'prosecution' ? s.share + edge : (1 - s.share) - edge) + noise + (c.reduced ? 0.06 : 0);
    const bar = c.jury ? 0.56 : 0.54;
    const convicted = proof >= bar;
    const jc = c.justiceCaseId ? k.J().cases[c.justiceCaseId] : null;
    if (jc) k.verdictFrom(jc, convicted, c.jury ? 'jury verdict' : 'verdict at trial');
    const forClient = c.role === 'prosecution' ? convicted : !convicted;
    lines.push(c.jury ? `The jury was out for ${rng.int(2, 9)} hours.` : 'The judge took a day to decide.');
    lines.push(convicted ? `Guilty of ${(OFFENSE_BY_ID[T.offense]?.name ?? 'the charge').toLowerCase()}.` : 'Not guilty.');
    out = { kind: convicted ? 'convicted' : 'acquitted', text: lines.at(-1), favorable: forClient ? 1 : -1, trial: true };
    if (c.role === 'prosecution' && c.weakPush && convicted) c.errors.push({ kind: 'weak', text: 'A conviction on thin evidence.' });
  } else {
    const share = s.share + edge + noise;
    const won = share >= 0.5;
    const kindMap = { family: won ? 'orders' : 'orders', child: won ? 'orders' : 'orders', immigration: won ? 'approved' : 'denied', civil: c.forum === 'appeal' ? (won ? 'reversed' : 'affirmed') : won ? 'judgment' : 'judgment_against', transaction: won ? 'closed' : 'closed_risk' };
    const text = {
      family: c.templateId === 'divorce' ? (won ? 'The court divided the property fairly, counting the account that was hidden.' : 'The court divided the property; the hidden account was not proved.')
        : won ? `The court adopted a parenting plan built around ${c.vars.child}'s school and routines.` : `The court adopted the other parent's plan, with time for ${first(c.clientId)}.`,
      child: c.templateId === 'juvenile' ? (won ? `${c.vars.child} was diverted: the damage repaired, and no formal finding.` : `A formal finding, with supervision for ${c.vars.child}.`)
        : won ? `${c.vars.child} stays at home, with family services and regular reviews, as they wished.` : `${c.vars.child} is placed with a relative for now, with reviews to bring them home.`,
      immigration: won ? (c.templateId === 'removal' ? 'Relief granted: the client may stay.' : 'Approved.') : (c.templateId === 'removal' ? 'Relief denied. An appeal is possible.' : 'Denied. It can be appealed or filed again.'),
      civil: c.forum === 'appeal' ? (won ? 'Reversed: the case goes back for a new trial, with the email in evidence.' : 'Affirmed: the appeal court found the error, if any, made no difference.')
        : c.forum === 'tax' ? (won ? 'The tribunal agreed: the payments were gifts, not income.' : 'The tribunal upheld the tax assessment.')
        : c.forum === 'agency' && c.templateId === 'permit_case' ? (won ? 'The permit was sent back for stricter limits and monitoring.' : 'The permit was issued as drafted.')
        : won ? 'Judgment for your client.' : 'Judgment for the other side.',
      transaction: won ? 'Signed and closed, with the risks covered.' : 'Signed, though some risk was left in the agreement.',
    }[c.kind];
    lines.push(text);
    out = { kind: kindMap[c.kind], text, favorable: won ? 1 : -0.5, trial: c.forum === 'trial', amount: c.kind === 'civil' && won ? currentOffer(c).claim : 0 };
    if (c.kind === 'transaction' && !won) c.risk = 'A liability left uncovered in the agreement.';
  }
  return close(c, out, lines);
}

// ---------- Ethics ----------

/** A request that tests a lawyer's duties, raised once in some cases. */
export function ethicsScene(c) {
  if (!c.ethics || c.ethics.resolved) return null;
  const E = ETHICS.find((x) => x.id === c.ethics.id);
  return { text: fill(E.text, c), options: E.options.map(([t, v]) => ({ text: t, v })) };
}
export function resolveEthics(c, v) {
  const sc = ethicsScene(c);
  if (!sc) return result(false, 'Nothing to decide.', 'neutral');
  const L = lawOf(player());
  c.ethics.resolved = { m: nowM(), v };
  if (v === 'improper') {
    L.rep.integrity = clamp(L.rep.integrity - 12);
    L.misconduct = (L.misconduct ?? 0) + 1;
    c.errors.push({ kind: 'misconduct', text: 'Evidence or confidences were mishandled.' });
    note(c, 'Professional misconduct.');
    if (L.misconduct >= 2 || rng.chance(0.35)) return discipline(L.misconduct >= 4 ? 'disbarred' : L.misconduct >= 3 ? 'suspended' : 'reprimand');
    return result(false, 'Nobody notices, this time. You will.', 'bad');
  }
  L.rep.integrity = clamp(L.rep.integrity + (v === 'proper' ? 4 : 2));
  gain(player(), { ethics: 3 });
  if (v === 'proper' && c.clientId) { const n = store.state.npcs[c.clientId]; if (n) n.meters.relationship = clamp(n.meters.relationship - 4); }
  note(c, v === 'proper' ? 'Followed professional duties.' : 'Asked a supervisor for guidance.');
  return result(true, v === 'proper' ? 'You did what the rules require. Not everyone was pleased.' : 'Your supervisor tells you what the rules require, and you do it.', 'good');
}
/** Professional discipline, in proportion: a reprimand, a suspension; disbarment only for repeated serious misconduct. */
export function discipline(level) {
  const L = lawOf(player());
  (L.discipline ??= []).push({ level, m: nowM(), year: store.state.year });
  if (level === 'suspended') { L.suspendedUntil = nowM() + 12; canon(`law:suspended:${player().id}:${nowM()}`, 'Suspended from practice', 'Suspended for a year by the bar for professional misconduct.', { privacy: 'public', sig: 2 }); }
  if (level === 'disbarred') { L.bar.disbarred = nowM(); (player().flags.licenses ?? []).splice((player().flags.licenses ?? []).indexOf('law'), 1); canon(`law:disbarred:${player().id}`, 'Disbarred', 'Struck off for serious professional misconduct.', { privacy: 'public', sig: 3 }); }
  const text = { reprimand: 'The bar issued a formal reprimand.', suspended: 'The bar suspended you from practice for a year.', disbarred: 'You were disbarred.' }[level];
  log(text, 'system', 'bad');
  return result(false, text, 'bad');
}

// ---------- Outcomes ----------

/** Closes a case once: the outcome, the fee, the client, skills and reputation, and the record. */
export function close(c, out, lines = []) {
  if (c.done) return result(false, 'This case is closed.', 'neutral', { outcome: c.outcome });
  const p = player();
  const L = lawOf(p);
  c.done = true;
  c.awaiting = null;
  c.outcome = { ...out, m: nowM(), year: store.state.year };
  c.stageIdx = c.stages.length;
  note(c, `Outcome: ${out.text}`);
  // A will drafted and signed is the client's will from now on, on their own record.
  if (c.templateId === 'will' && out.favorable > 0 && c.clientId && store.state.npcs[c.clientId]) store.state.npcs[c.clientId].flags.will = { year: store.state.year, by: p.id, caseId: c.id, guardianNamed: true };
  // The client remembers how they were treated as much as how it ended.
  const n = store.state.npcs[c.clientId];
  if (n) { n.meters.relationship = clamp(n.meters.relationship + (out.favorable > 0 ? 12 : out.favorable > -0.6 ? 2 : -6) + (c.tasks.interview ? 4 : -4)); n.flags.formerClientOf = p.id; n.flags.lastCaseId = c.id; }
  L.rep.clients = clamp(L.rep.clients + (n ? (n.meters.relationship - 50) / 25 : 0));
  L.rep.preparation = clamp(L.rep.preparation + (c.tasks.review && c.research ? 2 : -1));
  L.rep.advocacy = clamp(L.rep.advocacy + (out.trial ? (out.favorable > 0 ? 2 : 0.5) : 0));
  L.rep.recognition = clamp(L.rep.recognition + (c.level >= 4 ? 2 : 0.3));
  gain(p, { management: 1, analysis: 1 });
  // The fee, once. Salaried lawyers are paid by their employer (the career engine); a private practice bills.
  if (!c.fee.paid) {
    c.fee.paid = true;
    if (c.fee.model !== 'salary') {
      const c0 = COUNTRIES[c.countryId];
      const base = localCost([0, 1500, 4000, 9000, 22000, 60000][c.level], c0);
      const amount = c.fee.model === 'contingency' ? Math.round((out.amount ?? 0) * 0.3) : base;
      c.fee.amount = amount;
      if (amount > 0 && L.firm?.own) { L.firm.revenue = (L.firm.revenue ?? 0) + amount; }
      else if (amount > 0) { L.billed = (L.billed ?? 0) + amount; }
    }
  }
  const isFirst = !L.history.filter((h) => !h.clinic).length;
  L.history.push({ caseId: c.id, title: c.title, kind: c.kind, role: c.role, outcome: c.outcome.kind, favorable: out.favorable, trial: !!out.trial, level: c.level, year: store.state.year, clinic: c.clinic, track: c.track });
  // What the family archive may keep: a public trial is public record; a client's private matter is not. The details
  // stay restricted to the lawyer; descendants see that there was a case, not whose.
  const open = out.trial && ['criminal', 'civil'].includes(c.kind);
  if (isFirst && !c.clinic) canon(`law:firstCase:${p.id}`, 'Your first case', open ? `${c.title}: ${out.text}` : `A ${c.kind === 'transaction' ? 'transaction' : `${c.kind} matter`}, as ${(ROLE_NAME[c.role] ?? 'counsel').toLowerCase()}.`, { privacy: 'family', sig: 2 });
  if (c.level >= 4 && !c.clinic) canon(`law:major:${c.id}`, open ? `A major case: ${c.title}` : 'A major confidential matter', open ? out.text : 'Details are confidential to the client.', { privacy: open ? 'public' : 'family', sig: 3 });
  canon(`law:case:${c.id}`, c.title, out.text, { privacy: 'restricted', sig: 1, milestone: false });
  // Appeals: a final judgment against the client can be taken up, on the record, within six months.
  if (out.favorable < 0 && ['criminal', 'civil', 'immigration', 'family'].includes(c.kind) && out.kind !== 'plea') c.appealable = { until: nowM() + 6 };
  return result(out.favorable > 0, [...lines, out.text].filter((x, i, a) => a.indexOf(x) === i).join(' '), out.favorable > 0 ? 'good' : out.favorable < -0.4 ? 'bad' : 'neutral', { outcome: c.outcome, lines });
}

// ---------- Appeals ----------

/** The Justice Engine's case behind a criminal matter, if any. */
const justiceCase = (c) => (c.justiceCaseId ? k.J().cases[c.justiceCaseId] : null);
/**
 * Grounds on the record: an error a higher court can review. Not a second trial. A criminal conviction is appealed
 * through the Justice Engine itself (engine/cases.js), on its grounds, so there is only ever one appeal outcome.
 */
export function appealGrounds(c) {
  if (!c.appealable || c.appeal || nowM() > c.appealable.until) return [];
  const jc = justiceCase(c);
  if (jc && c.role === 'defense') return k.appealGrounds(jc).map((g) => ({ id: g.id, text: g.name ?? g.id, merit: null, justice: true }));
  const g = c.errors.filter((e) => e.kind !== 'misconduct').map((e) => ({ id: e.kind, text: e.text, merit: 0.55 }));
  g.push({ id: 'facts', text: 'The decision was wrong on the facts', merit: 0.08 });
  return g;
}
const FROM_JUSTICE = { 'sentence reduced': 'modified', 'conviction quashed': 'reversed', exonerated: 'reversed', dismissed: 'affirmed' };
/** Files an appeal. The appeal is its own docket, linked to the judgment it reviews, decided on the record. */
export function fileAppeal(c, groundId, brief = 'focused') {
  const g = appealGrounds(c).find((x) => x.id === groundId);
  if (!g) return result(false, 'There are no grounds, or the time to appeal has passed.', 'neutral');
  const appeal = { id: `${c.id}_appeal`, of: c.id, judgment: c.outcome.kind, ground: g.id, m: nowM(), due: nowM() + 6, brief, outcome: null };
  gain(player(), { appellate: 3, writing: 2 });
  if (g.justice) {
    const r = k.fileAppeal(justiceCase(c), g.id, player().id);
    appeal.decided = FROM_JUSTICE[r?.outcome] ?? 'affirmed';
    appeal.justiceAppealId = r?.appeal?.id ?? null;
  } else {
    const chance = clamp(g.merit + (brief === 'focused' ? 0.1 : -0.05) + skillIn(['appellate', 'writing']) / 400, 0.03, 0.85);
    appeal.decided = rng.chance(chance) ? (rng.chance(0.5) ? 'reversed' : 'remanded') : 'affirmed';
  }
  c.appeal = appeal;
  note(c, `Appeal filed: ${g.text.toLowerCase()}.`);
  return result(true, 'Your appeal is filed. The appeal court will decide it on the record, in about six months.', 'neutral', { appeal });
}

// ---------- Time ----------

/** Moves every open case on to the present month. Run each turn and at the turn of the year (engine/lawPractice.js). */
export function progressCases(p = player()) {
  const now = nowM();
  const L = lawOf(p);
  const open = L.caseIds.map(caseById).filter((c) => c && !c.done);
  const load = open.reduce((s, c) => s + c.level, 0);
  for (const c of open) {
    let guard = 0;
    while (!c.done && !c.awaiting && c.due <= now && guard++ < 12) advanceStage(c, load, p);
    // A day in court left unattended for six months is handled routinely, never in the turn it fell due.
    if (c.awaiting && !c.done && now - c.awaiting.since >= 6 && c.awaiting.turn !== now) {
      note(c, 'You were not there to make the decisions: the case was handled routinely.');
      if (c.kind === 'transaction') argue(c, {}, { routine: true });
      else argue(c, {}, { routine: true });
    }
  }
  // Appeals decided after their months.
  for (const c of L.caseIds.map(caseById).filter((x) => x?.appeal && !x.appeal.outcome && x.appeal.due <= now)) {
    c.appeal.outcome = c.appeal.decided;
    note(c, `Appeal ${c.appeal.outcome}.`);
    L.history.push({ caseId: c.appeal.id, title: `Appeal: ${c.title}`, kind: 'appeal', role: c.role, outcome: c.appeal.outcome, favorable: c.appeal.outcome === 'affirmed' ? -1 : 1, trial: false, level: c.level, year: store.state.year });
    log(`The appeal court ${c.appeal.outcome === 'affirmed' ? 'affirmed the judgment in' : c.appeal.outcome === 'reversed' ? 'reversed the judgment in' : 'sent back for a new hearing'} ${c.title}.`, 'system', c.appeal.outcome === 'affirmed' ? 'bad' : 'good');
  }
}
/** One stage ends and the next begins. Routine work is done along the way, at the case's level of care. */
function advanceStage(c, load, p) {
  const st = stageOf(c);
  const T = template(c);
  const L = lawOf(p);
  // A filing due now is done by routine if the lawyer did not do it, unless they are swamped.
  const dl = c.deadlines.find((d) => d.met == null && d.due <= c.due);
  if (dl) {
    const swamped = load > capacity(p) * 1.4;
    if (!c.filings.some((f) => f.main) && T.motion) {
      if (swamped) { dl.met = false; L.rep.reliability = clamp(L.rep.reliability - 5); c.bonus = (c.bonus ?? 0) - 0.08; note(c, `Missed the deadline: ${dl.label}.`); log(`You missed a filing deadline in ${c.title}. The client is not happy.`, 'system', 'bad'); }
      else file(c, 'strong', { routine: true, at: dl.due }); // the routine version of the main argument, less sharp than the player's own, done on time
    }
    if (dl.met == null) dl.met = true;
  }
  // Ethics: once, in some cases, early on.
  if (!c.ethics && c.stageIdx === 1 && !c.clinic && rng.chance(0.18)) {
    const pool = ETHICS.filter((e) => !e.prosecutor || c.role === 'prosecution');
    c.ethics = { id: rng.pick(pool).id, m: nowM() };
  }
  c.stageIdx += 1;
  const next = c.stages[c.stageIdx];
  if (!next) return;
  note(c, `${STAGE_NAME[next.s] ?? next.s}.`);
  if (DECIDING.includes(next.s) && !['done', 'closing', 'distribution', 'signing'].includes(next.s) || (c.kind === 'transaction' && ['signing', 'closing', 'done', 'distribution'].includes(next.s))) {
    // A decision that is the player's: it waits for them.
    c.awaiting = { what: next.s === 'trial' ? 'trial' : 'hearing', since: c.due, turn: nowM() };
    c.due += next.months;
    return;
  }
  c.due += next.months;
}
/** How many complexity points of open cases a lawyer can carry well: more with experience and staff. */
export function capacity(p = player()) {
  const L = lawOf(p);
  return 6 + Math.min(6, L.history.length / 8) + (L.firm?.staff?.length ?? 0) * 3;
}
/** Open complexity points against capacity. */
export function workload(p = player()) {
  const L = lawOf(p);
  const open = L.caseIds.map(caseById).filter((c) => c && !c.done);
  return { open: open.length, points: open.reduce((s, c) => s + c.level, 0), capacity: capacity(p) };
}

/** A short line for lists. */
export const caseLine = (c) => `${c.title} · ${COMPLEXITY[c.level]} · ${c.done ? 'Closed' : STAGE_NAME[stageOf(c)] ?? stageOf(c)}${c.awaiting && !c.done ? ' · needs you' : ''}`;
export const roleName = (c) => ROLE_NAME[c.role] ?? 'Counsel';
