// The justice system's records: incidents, investigations, evidence, cases,
// hearings, sentences, appeals and the money that moves because of them.
//
// Everything lives in store.state.justice and survives the end of a life:
//   incidents       what actually happened (truth), and who was there
//   investigations  what the police did and believe
//   evidence        what exists, how reliable it is, whether a court may use it
//   cases           what was charged, what was argued, what the court found
//   sentences       what the court ordered, and every later change to it
//   appeals         each ground argued once, with its decision
//   ledger          every payment, keyed so it is made once only
//
// These are separate on purpose: a verdict never rewrites an incident, an
// arrest is not a charge, and an acquittal is not a conviction. The people
// involved (judges, lawyers, detectives, witnesses) are ordinary NPCs kept in
// store.state.npcs, who age and retire like anyone else.
import { rng } from '../rng.js';
import { clamp, localMoney } from '../util.js';
import { store, player } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { makeNpc } from './npcFactory.js';
import { rule } from './rules.js';
import { LAWYERS } from '../data/crimes.js';
import {
  OFFENSE_BY_ID, SYSTEMS, systemFor, courtFor, courtsFor, policeName, EVIDENCE, EVIDENCE_FROM, LEADS,
  APPEAL_GROUNDS, COLD_AFTER, responsibilityAge,
} from '../data/justice.js';

/**
 * The procedure in force in a country now: its family of procedure, as changed
 * by any law passed since (engine/rules.js). A case keeps the law of the day it
 * was charged.
 */
export function lawAt(countryId) {
  const base = systemFor(countryId);
  const r = (id) => rule(id, countryId, { region: null });
  const jury = r('juryTrials');
  const ed = r('prisonEducation');
  return { ...base, factFinder: jury ? 'jury' : base.factFinder === 'jury' ? 'judge' : base.factFinder,
    juryFrom: jury ? (base.factFinder === 'jury' ? base.juryFrom : 3) : 9, bail: r('cashBail') ? 'money' : 'conditions',
    sealAfter: r('recordSealing') ? base.sealAfter ?? [5, 12] : null,
    schooling: ed === 'minimal' ? Math.min(base.schooling, 0.35) : ed === 'extensive' ? Math.max(base.schooling, 0.75) : clamp(base.schooling, 0.4, 0.69),
    sentencing: r('sentencing'), severity: { lenient: 0.75, standard: 1, tough: 1.3 }[r('sentencing')] };
}
/** The procedure a case is heard under. */
export const procedure = (c) => c.law ?? SYSTEMS[c.systemId];

/** How sure a fact-finder must be to convict. */
export const BURDEN = 0.78;
/** How strong the evidence must look before a prosecutor charges. */
export const CHARGE_AT = 0.6;

// ---------- The store ----------

/** The justice world, created on first use. */
export function J(state = store.state) {
  state.justice ??= { seq: 0, incidents: {}, investigations: {}, evidence: {}, cases: {}, sentences: {}, appeals: {},
    civil: {}, facilities: {}, agencies: {}, benches: {}, people: [], ledger: [] };
  return state.justice;
}
const nextId = (kind) => `${kind}_${++J().seq}`;
/** A new id, unique in this world for good. */
export const newId = nextId;
const year = () => store.state.year;
const ageOf = (id) => (id === player().id ? player().age : store.state.npcs[id]?.age ?? null);

/** A person by id: the player, an NPC, or someone who has since died. */
export function person(id) {
  if (!id) return null;
  if (id === player().id) return player();
  return store.state.npcs[id] ?? Object.values(store.state.npcs).find((n) => n.flags?.wasPlayer === id) ?? null;
}
export function nameOf(id, you = true) {
  if (you && id === player().id) return 'you';
  const n = person(id);
  return n ? `${n.firstName} ${n.lastName}` : 'someone no longer known';
}
const words = (id) => (id === player().id ? 'you' : nameOf(id));

/** Adds to a person's legal history: the player's legal.history, or an NPC's flags.legalHistory. */
export function note(id, kind, text, caseId = null) {
  const entry = { year: year(), age: ageOf(id), kind, text, caseId };
  if (id === player().id) (player().legal.history ??= []).push(entry);
  else { const n = person(id); if (n) (n.flags.legalHistory ??= []).push(entry); }
  return entry;
}

// ---------- People who work in the system ----------

function official(countryId, kind, occupation, o = {}) {
  const npc = makeNpc({ role: 'official', countryId, age: o.age ?? rng.int(29, 58), relationship: 40 });
  npc.occupation = occupation;
  npc.flags.justice = { kind, tier: o.tier ?? null, skill: o.skill ?? rng.int(40, 70), since: year(), caseIds: [], countryId };
  if (o.strict != null) npc.flags.justice.strict = o.strict;
  store.state.npcs[npc.id] = npc;
  J().people.push(npc.id);
  return npc;
}

/** Someone with no other part in the player's life: a witness, a complainant, an inmate. */
export function civilian(countryId, o = {}) {
  const npc = makeNpc({ role: o.role ?? 'official', countryId, age: o.age ?? rng.int(19, 70), relationship: o.relationship ?? 30, gender: o.gender });
  npc.flags.justice = { kind: o.kind ?? 'civilian', since: year(), caseIds: [], countryId };
  if (o.occupation) npc.occupation = o.occupation;
  store.state.npcs[npc.id] = npc;
  J().people.push(npc.id);
  return npc;
}

const active = (id) => { const n = store.state.npcs[id]; return n?.alive && !n.flags.justice?.retired; };

/** The police force for a country, with its officers and detectives. */
export function agency(countryId, city = COUNTRIES[countryId].cities[0]) {
  const a = (J().agencies[countryId] ??= { id: `agency_${countryId}`, countryId, name: policeName(countryId, city), officerIds: [], detectiveIds: [], cases: 0 });
  a.officerIds = a.officerIds.filter(active);
  a.detectiveIds = a.detectiveIds.filter(active);
  while (a.officerIds.length < 3) a.officerIds.push(official(countryId, 'officer', 'Police officer').id);
  while (a.detectiveIds.length < 2) a.detectiveIds.push(official(countryId, 'detective', 'Detective', { skill: rng.int(45, 80), age: rng.int(32, 56) }).id);
  return a;
}

/** Judges, prosecutors and defence lawyers practising in a country. */
export function bench(countryId) {
  const b = (J().benches[countryId] ??= { judges: [], prosecutors: [], defence: { public: [], good: [], star: [] } });
  b.judges = b.judges.filter(active);
  b.prosecutors = b.prosecutors.filter(active);
  while (b.judges.length < 3) b.judges.push(official(countryId, 'judge', 'Judge', { age: rng.int(45, 66), skill: rng.int(60, 85), strict: rng.int(25, 75) }).id);
  while (b.prosecutors.length < 3) b.prosecutors.push(official(countryId, 'prosecutor', 'Prosecutor', { skill: rng.int(45, 80) }).id);
  for (const tier of ['public', 'good', 'star']) {
    const base = LAWYERS.find((x) => x.id === tier).skill;
    b.defence[tier] = b.defence[tier].filter(active);
    while (b.defence[tier].length < (tier === 'star' ? 2 : 3)) {
      b.defence[tier].push(official(countryId, 'defence', tier === 'public' ? 'Legal aid lawyer' : tier === 'star' ? 'Senior defence barrister' : 'Defence lawyer',
        { tier, skill: clamp(base + rng.int(-8, 8)), age: tier === 'star' ? rng.int(45, 64) : rng.int(28, 55) }).id);
    }
  }
  return b;
}
export const pick = (ids) => ids.map((id) => store.state.npcs[id]).sort((a, b) => a.flags.justice.caseIds.length - b.flags.justice.caseIds.length || (rng.next() - 0.5))[0];
export const skillOf = (id) => (id === player().id ? Math.round(player().stats.intellect * 0.45 + (player().career.careerId === 'lawyer' ? 25 : 0)) : person(id)?.flags.justice?.skill ?? 40);

// ---------- Incidents and evidence ----------

/**
 * Records something that happened. The truth stays as written for good.
 * @param {{offenseId:string, perpetratorId:string, victimId?:string, countryId:string, city?:string,
 *          witnessIds?:string[], redHanded?:boolean, latent?:boolean}} o
 *   latent: there is evidence of who really did it that nobody has found yet
 */
export function createIncident(o) {
  const id = nextId('inc');
  const participants = [{ id: o.perpetratorId, role: 'perpetrator' }];
  if (o.victimId) participants.push({ id: o.victimId, role: 'victim' });
  for (const w of o.witnessIds ?? []) participants.push({ id: w, role: 'witness' });
  const inc = { id, offenseId: o.offenseId, year: year(), countryId: o.countryId, city: o.city ?? COUNTRIES[o.countryId].cities[0],
    truth: { perpetratorId: o.perpetratorId }, participants, reported: false, investigationId: null, latent: o.latent ? [] : null };
  J().incidents[id] = inc;
  for (const x of participants) { const n = store.state.npcs[x.id]; if (n?.flags.justice) n.flags.justice.caseIds.push(id); }
  return inc;
}

/**
 * Adds an evidence record. pointsTo is who the evidence implicates, which
 * need not be who did it: a witness can be honestly mistaken.
 */
export function addEvidence(incident, kind, pointsTo, o = {}) {
  const [lo, hi] = EVIDENCE[kind].reliability;
  const ev = { id: nextId('ev'), incidentId: incident.id, kind, sourceId: o.sourceId ?? null, year: year(),
    reliability: Math.round((o.reliability ?? lo + (hi - lo) * rng.next()) * 100) / 100,
    pointsTo, lawful: o.lawful ?? rng.chance(0.93), admissible: null, summary: o.summary ?? summarise(kind, pointsTo, o.sourceId) };
  J().evidence[ev.id] = ev;
  return ev;
}
function summarise(kind, pointsTo, sourceId) {
  const who = pointsTo ? words(pointsTo) : 'someone nobody can name';
  const src = (id) => nameOf(id, false);
  return {
    officer: `An officer at the scene names ${who}.`,
    witness: `${sourceId ? src(sourceId) : 'A witness'} ${pointsTo ? `identifies ${who}` : 'cannot say who it was'}.`,
    victim: `${sourceId ? src(sourceId) : 'The complainant'} describes ${pointsTo ? `someone matching ${who}` : 'someone they did not know'}.`,
    documents: `Paperwork links ${who} to what happened.`,
    financial: `Bank records show money moving to ${who}.`,
    physical: `Items recovered are linked to ${who}.`,
    forensic: `Laboratory results match ${who}.`,
    cctv: `Footage shows someone who resembles ${who}.`,
    digital: `Phone and computer records place ${who} there.`,
    admission: `${who === 'you' ? 'You' : who} told the police what happened.`,
    character: `${sourceId ? src(sourceId) : 'Someone'} speaks for ${who}'s character.`,
  }[kind];
}
const exists = (kind) => !EVIDENCE_FROM[kind] || year() >= EVIDENCE_FROM[kind];

/**
 * How strongly a set of evidence points at one person, 0 to 1. Evidence
 * pointing at someone else raises a doubt.
 */
export function strength(evidenceIds, suspectId, o = {}) {
  let miss = 1;
  let doubt = 0;
  for (const id of evidenceIds) {
    const e = J().evidence[id];
    if (!e || (o.admissibleOnly && e.admissible === false)) continue;
    const w = o.weigh ? o.weigh(e) : e.reliability;
    if (e.pointsTo === suspectId) miss *= 1 - w;
    else if (e.pointsTo && e.kind !== 'character') doubt += w * 0.35;
  }
  return clamp(1 - miss - doubt, 0, 1);
}
export const words4 = (s) => (s >= 0.8 ? 'strong' : s >= 0.55 ? 'substantial' : s >= 0.3 ? 'thin' : 'weak');

// ---------- Investigations ----------

export const INVESTIGATION_STAGES = ['received', 'active', 'suspect', 'referred', 'charged', 'closed', 'suspended'];

/** Opens an investigation into a reported incident. */
export function openInvestigation(inc, o = {}) {
  const a = agency(inc.countryId, inc.city);
  const det = pick(a.detectiveIds);
  const inv = { id: nextId('inv'), incidentId: inc.id, agencyId: a.id, investigatorIds: [det.id], suspectIds: [], witnessIds: [],
    evidenceIds: [], stage: 'received', opened: year(), years: 0, events: [], outcome: null };
  J().investigations[inv.id] = inv;
  inc.reported = true;
  inc.investigationId = inv.id;
  a.cases += 1;
  det.flags.justice.caseIds.push(inv.id);
  inv.events.push({ year: year(), text: `Reported to ${a.name}. ${nameOf(det.id)} is assigned.` });
  const perp = inc.truth.perpetratorId;
  if (o.redHanded) {
    const officer = pick(a.officerIds);
    inv.evidenceIds.push(addEvidence(inc, 'officer', perp, { sourceId: officer.id, lawful: true }).id);
  }
  for (const w of inc.participants.filter((x) => x.role === 'witness' || x.role === 'victim')) {
    inv.witnessIds.push(w.id);
    // Witnesses are not omniscient: most identify the right person, some do not.
    const right = rng.chance(o.redHanded ? 0.95 : 0.78);
    inv.evidenceIds.push(addEvidence(inc, w.role === 'victim' ? 'victim' : 'witness', right ? perp : o.misidentify ?? null, { sourceId: w.id }).id);
  }
  stageTo(inv, 'active');
  review(inv);
  return inv;
}
function stageTo(inv, stage) {
  const allowed = { received: ['active'], active: ['suspect', 'charged', 'closed', 'suspended'], suspect: ['referred', 'charged', 'active', 'closed', 'suspended'],
    referred: ['charged', 'active', 'closed'], suspended: ['active'], charged: [], closed: ['active'] };
  if (!allowed[inv.stage]?.includes(stage)) return false;
  inv.stage = stage;
  return true;
}
/** Puts names to the evidence. */
function review(inv) {
  const ids = [...new Set(inv.evidenceIds.map((id) => J().evidence[id].pointsTo).filter(Boolean))];
  inv.suspectIds = ids.filter((s) => strength(inv.evidenceIds, s) >= 0.3);
  if (inv.suspectIds.length && inv.stage === 'active') stageTo(inv, 'suspect');
}
/** The suspect the evidence points to most strongly, and how strongly. */
export function leading(inv) {
  return inv.suspectIds.map((id) => ({ id, s: strength(inv.evidenceIds, id) })).sort((a, b) => b.s - a.s)[0] ?? null;
}

/**
 * A year of police work. Evidence is found from the truth: the person who did
 * it leaves real traces. Returns 'charge' when the case goes to a prosecutor.
 * @param {number} [push]  extra effort (police attention), 0 to 1
 */
export function workInvestigation(inv, push = 0) {
  if (!['active', 'suspect'].includes(inv.stage)) return null;
  const inc = J().incidents[inv.incidentId];
  const off = OFFENSE_BY_ID[inc.offenseId];
  const det = person(inv.investigatorIds[0]);
  inv.years += 1;
  const chance = clamp(0.25 + ((det?.flags.justice?.skill ?? 50) - 50) / 200 + push * 0.4 + (off.severity >= 4 ? 0.2 : 0), 0.05, 0.85);
  if (rng.chance(chance)) {
    const leads = (LEADS[off.category] ?? LEADS.property).filter(exists);
    const kind = rng.pick(leads);
    const right = rng.chance(['forensic', 'financial', 'documents', 'digital'].includes(kind) ? 0.97 : 0.8);
    const ev = addEvidence(inc, kind, right ? inc.truth.perpetratorId : null);
    inv.evidenceIds.push(ev.id);
    inv.events.push({ year: year(), text: `New evidence: ${EVIDENCE[kind].name.toLowerCase()}.` });
  }
  review(inv);
  const top = leading(inv);
  if (top && top.s >= CHARGE_AT) { stageTo(inv, 'referred'); inv.events.push({ year: year(), text: `File passed to the prosecutor, naming ${nameOf(top.id)}.` }); return 'charge'; }
  if (inv.years >= COLD_AFTER && off.severity < 5) { stageTo(inv, 'closed'); inv.outcome = 'cold'; inv.events.push({ year: year(), text: 'Closed with nobody charged.' }); return 'cold'; }
  return null;
}

// ---------- Arrest and charge ----------

/** The steps a criminal case moves through. Anything else is refused. */
export const CASE_FLOW = {
  charged: ['pretrial', 'dismissed'],
  pretrial: ['plea', 'dismissed'],
  plea: ['trial', 'convicted', 'dismissed'],
  trial: ['convicted', 'acquitted', 'mistrial', 'dismissed'],
  mistrial: ['trial', 'dismissed'],
  convicted: ['sentenced'],
  sentenced: ['quashed', 'retrial'],
  retrial: ['plea'],
  acquitted: [],
  dismissed: [],
  quashed: [],
};

/** Moves a case on, and records the hearing. @returns {boolean} */
export function move(c, stage, text) {
  if (!CASE_FLOW[c.stage]?.includes(stage)) return false;
  c.stage = stage;
  c.hearings.push({ year: year(), stage, court: c.court, text });
  return true;
}

/**
 * A prosecutor decides whether to charge. Returns the case, or null if the
 * evidence is not enough (and the suspect is released without charge).
 */
export function decideCharge(inv, suspectId = leading(inv)?.id) {
  if (!suspectId) return null;
  const inc = J().incidents[inv.incidentId];
  // Nobody is charged twice over the same incident.
  if (Object.values(J().cases).some((c) => c.incidentId === inc.id && c.defendantId === suspectId)) { stageTo(inv, 'charged'); return null; }
  const s = strength(inv.evidenceIds, suspectId);
  if (s < CHARGE_AT - 0.05) {
    note(suspectId, 'released', `Questioned about ${OFFENSE_BY_ID[inc.offenseId].name.toLowerCase()} and released without charge.`);
    stageTo(inv, 'active');
    return null;
  }
  stageTo(inv, 'charged');
  inv.outcome = 'charged';
  return openCase(inc, inv, suspectId);
}

/** Opens a case directly, for a case whose charge was decided before these records were kept. */
export const openCaseFor = (inv, defendantId) => { inv.stage = 'charged'; inv.outcome = 'charged'; return openCase(J().incidents[inv.incidentId], inv, defendantId); };

function openCase(inc, inv, defendantId) {
  const off = OFFENSE_BY_ID[inc.offenseId];
  const age = ageOf(defendantId) ?? 30;
  const sys = lawAt(inc.countryId);
  const juvenile = age < sys.adultAge;
  const b = bench(inc.countryId);
  const prosecutor = pick(b.prosecutors);
  const judge = pick(b.judges);
  const c = { id: nextId('case'), kind: 'criminal', incidentId: inc.id, investigationId: inv.id, countryId: inc.countryId,
    systemId: sys.id, court: courtFor(inc.countryId, off.severity, juvenile), juvenile, defendantId, year: year(), age,
    charges: [{ offenseId: off.id, lesser: off.lesser ?? null }], prosecutorId: prosecutor.id, judgeId: judge.id,
    defenceId: null, defenceTier: null, evidenceIds: [...inv.evidenceIds], stage: 'charged', hearings: [],
    bail: null, remand: false, offer: null, plea: null, trials: 0, verdict: null, sentenceId: null, appealIds: [], fresh: null, rulings: [], law: lawAt(inc.countryId) };
  c.hearings.push({ year: year(), stage: 'charged', court: c.court, text: `Charged with ${off.name.toLowerCase()}.` });
  J().cases[c.id] = c;
  for (const id of [prosecutor.id, judge.id]) person(id)?.flags?.justice?.caseIds.push(c.id);
  note(defendantId, 'charged', `Charged with ${off.name.toLowerCase()}${juvenile ? ', in the youth court' : ''}.`, c.id);
  return c;
}

// ---------- Before trial ----------

const BAIL_BASE = [0, 500, 2500, 10000, 50000];

/**
 * The first hearing: whether the defendant waits for trial at home, on
 * conditions, against money, or in custody. The decision is the court's.
 * @returns {{decision:'released'|'conditions'|'bail'|'remand', amount:number, text:string}}
 */
export function bailHearing(c) {
  if (c.bail) return c.bail;
  const sys = procedure(c);
  const off = OFFENSE_BY_ID[c.charges[0].offenseId];
  const country = COUNTRIES[c.countryId];
  let out;
  if (off.severity >= 5 || (off.severity >= 4 && rng.chance(0.6))) out = { decision: 'remand', amount: 0, text: 'The court refused bail. You will wait for trial in custody.' };
  else if (off.severity <= 1 || c.juvenile) out = { decision: 'released', amount: 0, text: 'Released to wait for the hearing, with a date to come back.' };
  else if (sys.bail === 'money') {
    const amount = localMoney(BAIL_BASE[off.severity], country);
    out = { decision: 'bail', amount, text: 'Bail is set. Pay it, or wait in custody.' };
  } else out = { decision: 'conditions', amount: 0, text: 'Released on conditions: live at your address and report to the police each week.' };
  c.bail = { ...out, paidBy: null, status: out.decision === 'bail' ? 'unpaid' : 'n/a' };
  move(c, 'pretrial', out.text);
  return c.bail;
}

/** Someone posts bail. Refunded when the case ends, if the conditions were kept. */
export function postBail(c, payerId) {
  if (c.bail?.decision !== 'bail' || c.bail.status !== 'unpaid') return false;
  if (!pay({ key: `bail:${c.id}`, kind: 'bail', amount: c.bail.amount, payer: payerId, payee: 'court', caseId: c.id })) return false;
  c.bail.paidBy = payerId;
  c.bail.status = 'held';
  return true;
}
/** Bail could not be paid: the defendant waits in custody. */
export function remand(c) {
  if (c.bail?.decision === 'bail' && c.bail.status === 'unpaid') c.bail.status = 'not paid';
  c.remand = true;
}
function settleBail(c, forfeit = false) {
  if (c.bail?.status !== 'held') return;
  c.bail.status = forfeit ? 'forfeited' : 'refunded';
  if (!forfeit) pay({ key: `bail_refund:${c.id}`, kind: 'bail_refund', amount: c.bail.amount, payer: 'court', payee: c.bail.paidBy, caseId: c.id });
}

/**
 * Who can defend this defendant, with what each costs. The lawyer is a real
 * person; one who has acted for the defendant before is offered first.
 */
export function counselOptions(c) {
  const b = bench(c.countryId);
  const country = COUNTRIES[c.countryId];
  const def = person(c.defendantId);
  const means = def === player() ? player().finance.cash : def?.savings ?? 0;
  const off = OFFENSE_BY_ID[c.charges[0].offenseId];
  const aid = means < localMoney(25000, country) || off.severity >= 4 || c.juvenile;
  const before = (def === player() ? player().legal.counselIds : def?.flags.counselIds) ?? [];
  const out = [];
  const known = before.map((id) => store.state.npcs[id]).find((n) => n?.alive && !n.flags.justice?.retired);
  if (known) {
    const tier = known.flags.justice.tier;
    const cost = localMoney(LAWYERS.find((x) => x.id === tier).cost, country);
    out.push({ tier, npcId: known.id, name: nameOf(known.id), label: `${nameOf(known.id)}, who acted for you before`, cost,
      ok: tier === 'public' ? aid : means >= cost, why: tier === 'public' && !aid ? 'You no longer qualify for legal aid.' : '' });
  }
  for (const x of LAWYERS) {
    if (x.id === 'self') { out.push({ tier: 'self', npcId: c.defendantId, name: 'yourself', label: x.name, cost: 0, ok: true, blurb: x.blurb }); continue; }
    const n = pick(b.defence[x.id]);
    if (n.id === known?.id) continue;
    const cost = localMoney(x.cost, country);
    out.push({ tier: x.id, npcId: n.id, name: nameOf(n.id), label: `${nameOf(n.id)}: ${x.name.toLowerCase()}`, cost, blurb: x.blurb,
      ok: x.aid ? aid : means >= cost, why: x.aid && !aid ? `Legal aid is for those with less than ${localMoney(25000, country).toLocaleString('en-US')} ${country.currency.code}, or facing a serious charge.` : '' });
  }
  return out;
}

/** Appoints counsel. The fee is paid once per case. */
export function appoint(c, tier, npcId) {
  if (c.defenceId) return false;
  const cost = tier === 'self' || tier === 'public' ? 0 : localMoney(LAWYERS.find((x) => x.id === tier).cost, COUNTRIES[c.countryId]);
  if (cost && !pay({ key: `fee:${c.id}`, kind: 'legal_fee', amount: cost, payer: c.defendantId, payee: npcId, caseId: c.id })) return false;
  c.defenceId = npcId;
  c.defenceTier = tier;
  if (tier !== 'self') {
    person(npcId)?.flags?.justice?.caseIds.push(c.id);
    const list = c.defendantId === player().id ? (player().legal.counselIds ??= []) : (person(c.defendantId).flags.counselIds ??= []);
    if (!list.includes(npcId)) list.push(npcId);
  }
  if (c.stage === 'pretrial') move(c, 'plea', tier === 'self' ? 'The defendant will speak for themselves.' : `${nameOf(npcId)} appears for the defence.`);
  return true;
}

/** What the evidence looks like from the defence table. */
export function caseFile(c) {
  return c.evidenceIds.map((id) => J().evidence[id]).map((e) => ({ id: e.id, kind: EVIDENCE[e.kind].name, summary: e.summary,
    against: e.pointsTo === c.defendantId, reliability: e.reliability >= 0.8 ? 'solid' : e.reliability >= 0.6 ? 'fair' : 'shaky',
    excluded: e.admissible === false }));
}
/** Counsel's honest view of the trial: an estimate, not a promise. */
export function advice(c) {
  const s = strength(c.evidenceIds, c.defendantId, { admissibleOnly: true });
  const read = clamp(s + (rng.next() - 0.5) * (1 - skillOf(c.defenceId) / 100) * 0.3, 0, 1);
  return read >= 0.85 ? 'The evidence against you is strong. A trial would be hard to win.'
    : read >= 0.65 ? 'There is a real case to answer. A trial could go either way.'
      : read >= 0.45 ? 'The prosecution has gaps. There is a fair chance at trial.'
        : 'The evidence is weak. Your lawyer thinks it may not survive a trial.';
}

// ---------- Pleas ----------

/** The prosecution's offer, where offers are made. Made once, and kept. */
export function offer(c) {
  if (c.offer !== null) return c.offer.status === 'open' ? c.offer : null;
  const sys = procedure(c);
  const s = strength(c.evidenceIds, c.defendantId, { admissibleOnly: true });
  if (sys.plea !== 'bargain' || s < 0.4 || c.juvenile) { c.offer = { status: 'none' }; return null; }
  const charge = c.charges[0];
  const to = s < 0.85 && charge.lesser ? charge.lesser : charge.offenseId;
  c.offer = { status: 'open', offenseId: to, cap: s < 0.7 ? 0.45 : 0.65, year: year(),
    text: `Plead guilty to ${OFFENSE_BY_ID[to].name.toLowerCase()}${to !== charge.offenseId ? ` instead of ${OFFENSE_BY_ID[charge.offenseId].name.toLowerCase()}` : ''}, and the prosecution will ask for a lighter sentence.` };
  return c.offer;
}

/** What pleading guilty means where this case is heard. */
export function pleaTerms(c) {
  const sys = procedure(c);
  return sys.plea === 'limited' ? 'An admission is taken into account, but the court still examines the case before deciding.'
    : `Pleading guilty means no trial and a conviction. ${Math.round(sys.pleaCredit * 100)}% comes off any custodial term.`;
}

/**
 * Enters a plea. 'deal' accepts the offer, which a judge must still approve.
 * @returns {{stage:string, lines:string[]}}
 */
export function enterPlea(c, plea) {
  if (c.stage !== 'plea') return { stage: c.stage, lines: [] };
  const sys = procedure(c);
  const lines = [];
  if (plea === 'deal') {
    const o = offer(c);
    if (!o) return { stage: c.stage, lines: ['There is no offer to accept.'] };
    if (rng.chance(0.88)) {
      o.status = 'accepted';
      c.plea = 'guilty';
      lines.push(`The judge accepted the agreement. Guilty of ${OFFENSE_BY_ID[o.offenseId].name.toLowerCase()}.`);
      convict(c, o.offenseId, 'plea agreement');
      return { stage: c.stage, lines };
    }
    o.status = 'refused by the court';
    c.hearings.push({ year: year(), stage: 'plea', court: c.court, text: 'The judge refused to approve the plea agreement.' });
    return { stage: c.stage, lines: ['The judge would not approve the agreement. You must plead again.'] };
  }
  c.plea = plea;
  if (plea === 'guilty' && sys.plea !== 'limited') {
    lines.push(`You pleaded guilty to ${OFFENSE_BY_ID[c.charges[0].offenseId].name.toLowerCase()}.`);
    convict(c, c.charges[0].offenseId, 'guilty plea');
    return { stage: c.stage, lines };
  }
  if (plea === 'guilty') {
    const inc = J().incidents[c.incidentId];
    c.evidenceIds.push(addEvidence(inc, 'admission', c.defendantId, { lawful: true, sourceId: c.defendantId }).id);
    lines.push('Your admission is put before the court, which still examines the case.');
  }
  move(c, 'trial', plea === 'guilty' ? 'The court examines the case after an admission.' : 'Not guilty. The case goes to trial.');
  return { stage: c.stage, lines: [...lines, ...trial(c).lines] };
}

// ---------- Trial ----------

/** Who decides guilt in this case. */
export function factFinder(c) {
  const sys = procedure(c);
  if (c.juvenile) return 'judge';
  if (sys.factFinder === 'jury') return OFFENSE_BY_ID[c.charges[0].offenseId].severity >= sys.juryFrom ? 'jury' : 'judge';
  return sys.factFinder;
}

/**
 * The trial. Unlawfully obtained evidence is ruled on first; the defence
 * tests the rest; the fact-finder weighs what is left against the burden of
 * proof. The truth of the incident is never consulted: only the evidence.
 * @param {{admit?:Object<string,boolean>}} [o]  a judge's rulings on contested evidence (player judges)
 * @returns {{stage:string, lines:string[], verdict:?string}}
 */
export function trial(c, o = {}) {
  if (c.stage !== 'trial') return { stage: c.stage, lines: [], verdict: null };
  const sys = procedure(c);
  const lines = [];
  const counsel = clamp((c.defenceId ? skillOf(c.defenceId) : 15) + (c.effort ?? 0));
  const pros = skillOf(c.prosecutorId);
  c.trials += 1;
  // 1. Admissibility.
  for (const id of c.evidenceIds) {
    const e = J().evidence[id];
    if (e.admissible !== null) continue;
    if (e.lawful) { e.admissible = true; continue; }
    const challenged = rng.chance(clamp(counsel / 100 + 0.1, 0.1, 0.95));
    const ruled = o.admit && id in o.admit ? o.admit[id] : null;
    // Where the law requires it, unlawfully obtained evidence is left out once challenged, whoever is judging.
    const out = challenged && (sys.exclusion === 'strict' || ruled === false || (ruled === null && rng.chance(0.6)));
    e.admissible = !out;
    c.rulings.push({ evidenceId: id, challenged, admitted: !out, year: year() });
    if (challenged) lines.push(out ? `The judge left out the ${EVIDENCE[e.kind].name.toLowerCase()}: it was obtained unlawfully.`
      : `The defence challenged the ${EVIDENCE[e.kind].name.toLowerCase()}, but the judge allowed it.`);
  }
  // 2. Testing the evidence: shaky evidence is weakened by good cross-examination.
  const weigh = (e) => {
    const shaky = ['witness', 'victim', 'cctv', 'physical'].includes(e.kind) ? (1 - e.reliability) : 0;
    return clamp(e.reliability - shaky * (counsel / 100) * 0.9 + (pros - 50) / 400, 0.02, 0.98);
  };
  const s = strength(c.evidenceIds, c.defendantId, { admissibleOnly: true, weigh });
  const who = factFinder(c);
  const noise = (rng.next() + rng.next() - 1) * (who === 'jury' ? 0.14 : 0.08);
  const view = s + noise;
  const shaky = c.evidenceIds.map((id) => J().evidence[id]).filter((e) => e.admissible && e.pointsTo === c.defendantId && e.reliability < 0.6);
  if (shaky.length && counsel >= 50) lines.push(`Under cross-examination, ${shaky.length === 1 ? 'one account' : 'some accounts'} against the defendant looked less certain.`);
  const body = who === 'jury' ? 'The jury' : who === 'mixed' ? 'The court, with its lay judges,' : 'The judge';
  // A jury that cannot agree.
  if (who === 'jury' && Math.abs(view - BURDEN) < 0.035) {
    move(c, 'mistrial', 'The jury could not agree on a verdict.');
    lines.push('The jury could not agree. The trial is abandoned.');
    if (c.trials >= 2 || s < 0.7) {
      move(c, 'dismissed', 'The prosecution decided not to try the case a third time.');
      return { ...closeAcquitted(c, 'dismissed', lines, 'After a second jury could not agree, the prosecution dropped the case.'), verdict: 'dismissed' };
    }
    move(c, 'trial', 'A retrial before a new jury.');
    lines.push('The prosecution asks for a retrial, before a new jury.');
    const again = trial(c, o);
    return { ...again, lines: [...lines, ...again.lines] };
  }
  if (view >= BURDEN) {
    const charge = c.charges[0];
    // Convinced of something, but perhaps not of everything the charge requires.
    const partial = charge.lesser && view < BURDEN + 0.1 && rng.chance(0.4);
    const off = partial ? charge.lesser : charge.offenseId;
    lines.push(`${body} found the defendant guilty${partial ? ` of the lesser offence of ${OFFENSE_BY_ID[off].name.toLowerCase()}` : ''}.`);
    convict(c, off, partial ? 'partial verdict' : 'verdict', o.deferSentence);
    return { stage: c.stage, lines, verdict: partial ? 'partial' : 'guilty' };
  }
  lines.push(`${body} was not sure enough to convict. Not guilty.`);
  move(c, 'acquitted', 'Not guilty.');
  return { ...closeAcquitted(c, 'acquitted', lines), verdict: 'acquitted' };
}

function closeAcquitted(c, outcome, lines, text) {
  if (text) lines.push(text);
  c.verdict = { outcome, year: year() };
  settleBail(c);
  record(c, { outcome, convicted: false });
  note(c.defendantId, outcome, outcome === 'acquitted' ? 'Found not guilty.' : 'The case was dropped.', c.id);
  return { stage: c.stage, lines };
}

/** A conviction, by verdict or by plea. Moves straight to sentencing. */
function convict(c, offenseId, how, defer = false) {
  if (c.stage === 'plea' || c.stage === 'trial') move(c, 'convicted', `Convicted of ${OFFENSE_BY_ID[offenseId].name.toLowerCase()} (${how}).`);
  c.verdict = { outcome: 'convicted', offenseId, how, year: year() };
  settleBail(c);
  if (!defer) sentence(c, offenseId, how);
}

/** Sentences a case left waiting after its verdict (a player judge's sentencing hearing). */
export function passSentence(c, ruling) {
  if (c.stage !== 'convicted') return null;
  return sentence(c, c.verdict.offenseId, c.verdict.how, ruling);
}

// ---------- Sentencing ----------

/** Earlier convictions a court may take into account: adult, unsealed, in the last fifteen years. */
function priors(defendantId, caseId) {
  const recs = defendantId === player().id ? player().legal.record : person(defendantId)?.flags.record ?? [];
  return recs.filter((r) => r.convicted && !r.exonerated && !r.juvenile && !r.sealed && r.caseId !== caseId && year() - (r.year ?? year()) <= 15).length;
}

/** The lawful range for an offence: never below or above it. */
export function lawfulRange(offenseId) {
  const off = OFFENSE_BY_ID[offenseId];
  return { ladder: off.ladder, custody: off.custody };
}

/**
 * Chooses a sentence inside the lawful range. Seriousness sets the kind of
 * sentence; priors and pleas move it within its limits, never past them.
 * @param {{type?:string, years?:number}} [ruling]  a player judge's choice, checked against the law
 */
export function sentence(c, offenseId, how, ruling = null) {
  const off = OFFENSE_BY_ID[offenseId];
  const sys = procedure(c);
  const judge = person(c.judgeId);
  const n = priors(c.defendantId, c.id);
  const plea = how === 'guilty plea' || how === 'plea agreement';
  let score = off.severity * 18 + Math.min(n, 3) * 9 + ((judge?.flags.justice?.strict ?? 50) - 50) / 5 - (n === 0 ? 8 : 0) - (c.juvenile ? 12 : 0) + rng.int(-6, 6);
  if (plea) score -= 6;
  score += { lenient: -6, standard: 0, tough: 6 }[sys.sentencing ?? 'standard'];
  const ladder = off.ladder;
  let type = ladder[clamp(Math.floor((score - 10) / 15), 0, ladder.length - 1)];
  if (type === 'diversion' && (n > 0 || c.age >= sys.adultAge + 7)) type = ladder[Math.min(1, ladder.length - 1)];
  let years = 0;
  if (type === 'custody') {
    const [lo, hi] = off.custody;
    const f = clamp((score - off.severity * 18 + 15) / 45, 0, 1);
    years = lo + (hi - lo) * f;
    if (plea) years *= 1 - sys.pleaCredit;
    if (how === 'plea agreement' && c.offer?.cap) years = Math.min(years, lo + (hi - lo) * c.offer.cap);
    years *= sys.severity ?? 1;
    years = Math.min(hi, Math.max(lo === 0 ? 1 : Math.round(lo * (plea ? 1 - sys.pleaCredit : 1)), Math.round(years)));
  }
  if (ruling) {
    // A player judge chooses, but only from what the law allows.
    if (ladder.includes(ruling.type)) type = ruling.type;
    if (type === 'custody') years = clamp(Math.round(ruling.years ?? years), Math.max(1, off.custody[0]), off.custody[1]);
  }
  if (c.juvenile && type === 'custody') years = Math.max(1, Math.min(years, sys.adultAge + 3 - c.age));
  const credit = c.remand && type === 'custody' ? 1 : 0;
  const country = COUNTRIES[c.countryId];
  const s = { id: nextId('sen'), caseId: c.id, defendantId: c.defendantId, offenseId, type, years, credit,
    fine: ['fine', 'discharge', 'community', 'probation', 'suspended'].includes(type) && off.fine ? localMoney(off.fine * (type === 'fine' ? 1 : 0.4), country) : 0,
    hours: type === 'community' ? 60 + off.severity * 40 : 0,
    supervision: type === 'probation' ? Math.max(1, off.severity) : type === 'suspended' ? 2 : type === 'discharge' ? 1 : 0,
    year: year(), status: 'active', modifications: [], juvenile: c.juvenile };
  if (type === 'diversion') s.fine = 0;
  J().sentences[s.id] = s;
  c.sentenceId = s.id;
  move(c, 'sentenced', `Sentenced: ${describe(s)}.`);
  record(c, { outcome: 'convicted', convicted: true, offenseId, sentenceYears: type === 'custody' ? years : 0, sentenceType: type });
  note(c.defendantId, 'convicted', `Convicted of ${off.name.toLowerCase()}. ${cap1(describe(s))}.`, c.id);
  if (s.fine) pay({ key: `fine:${s.id}`, kind: 'fine', amount: s.fine, payer: c.defendantId, payee: 'state', caseId: c.id, allowDebt: true });
  return s;
}
const cap1 = (t) => t.charAt(0).toUpperCase() + t.slice(1);
/** A sentence in plain words. */
export function describe(s) {
  const yrs = (n) => `${n} year${n === 1 ? '' : 's'}`;
  return {
    diversion: 'a diversion programme, with no conviction recorded if it is completed',
    discharge: 'a conditional discharge for a year',
    fine: 'a fine',
    community: `${s.hours} hours of community service`,
    probation: `${yrs(s.supervision)} of probation`,
    suspended: `custody, suspended for ${yrs(s.supervision)}`,
    custody: s.years >= 50 ? 'life in custody' : `${yrs(s.years)} in custody`,
  }[s.type];
}

/** Writes the outcome into the defendant's record. One entry per case. */
function record(c, o) {
  const off = OFFENSE_BY_ID[o.offenseId ?? c.charges[0].offenseId];
  const entry = { caseId: c.id, crimeId: off.id, offense: off.name, year: year(), age: c.age, convicted: !!o.convicted,
    outcome: o.outcome, sentenceYears: o.sentenceYears ?? 0, sentenceType: o.sentenceType ?? null, juvenile: c.juvenile,
    // Diversion leaves no conviction once completed; until then it is recorded as pending completion.
    sealed: false, exonerated: false, countryId: c.countryId };
  if (o.sentenceType === 'diversion') { entry.convicted = false; entry.outcome = 'diverted'; }
  const list = c.defendantId === player().id ? player().legal.record : (person(c.defendantId).flags.record ??= []);
  const at = list.findIndex((r) => r.caseId === c.id);
  if (at >= 0) list[at] = { ...list[at], ...entry };
  else list.push(entry);
}

// ---------- Appeals ----------

/** Grounds this case could be appealed on now. Each ground is argued once. */
export function appealGrounds(c) {
  if (c.stage !== 'sentenced') return [];
  const s = J().sentences[c.sentenceId];
  const used = new Set(c.appealIds.map((id) => J().appeals[id].ground));
  const out = [];
  if (s?.type === 'custody' && !used.has('sentence')) out.push('sentence');
  if (!used.has('procedure') && c.rulings.some((r) => r.admitted && !J().evidence[r.evidenceId].lawful)) out.push('procedure');
  if (c.fresh && !used.has('new_evidence')) out.push('new_evidence');
  return out.map((id) => ({ id, ...APPEAL_GROUNDS[id] }));
}

/**
 * Argues an appeal. The decision follows the merits of the ground, and is
 * final for that ground.
 * @returns {{appeal:Object, outcome:string, text:string}}
 */
export function fileAppeal(c, ground, counselId = c.defenceId) {
  if (!appealGrounds(c).some((g) => g.id === ground)) return null;
  const courts = courtsFor(c.countryId);
  const a = { id: nextId('appeal'), caseId: c.id, ground, year: year(), counselId, court: courts.appeal, status: 'decided', outcome: null };
  const s = J().sentences[c.sentenceId];
  const skill = skillOf(counselId);
  if (ground === 'sentence') {
    const [lo, hi] = OFFENSE_BY_ID[s.offenseId].custody;
    const high = (s.years - lo) / Math.max(1, hi - lo);
    if (rng.chance(clamp(high * 0.6 + (skill - 50) / 250, 0.05, 0.7))) {
      const cut = Math.max(1, Math.round(s.years * 0.3));
      modify(s, -cut, `${courts.appeal} reduced the sentence by ${cut} year${cut === 1 ? '' : 's'}.`);
      a.outcome = 'sentence reduced';
    } else a.outcome = 'dismissed';
  } else if (ground === 'procedure') {
    const tainted = c.evidenceIds.filter((id) => !J().evidence[id].lawful);
    for (const id of tainted) J().evidence[id].admissible = false;
    const left = strength(c.evidenceIds, c.defendantId, { admissibleOnly: true });
    if (left < BURDEN - 0.05) { quash(c, 'quashed', 'The conviction was unsafe without the evidence that should have been left out.'); a.outcome = 'conviction quashed'; }
    else a.outcome = 'dismissed';
  } else if (ground === 'new_evidence') {
    const fresh = J().evidence[c.fresh];
    c.evidenceIds.push(fresh.id);
    fresh.admissible = true;
    const left = strength(c.evidenceIds, c.defendantId, { admissibleOnly: true });
    if (fresh.pointsTo !== c.defendantId && left < BURDEN) { quash(c, 'exonerated', 'New evidence shows the conviction was wrong.'); a.outcome = 'exonerated'; }
    else a.outcome = 'dismissed';
  }
  J().appeals[a.id] = a;
  c.appealIds.push(a.id);
  c.hearings.push({ year: year(), stage: 'appeal', court: courts.appeal, text: `Appeal (${APPEAL_GROUNDS[ground].name.toLowerCase()}): ${a.outcome}.` });
  note(c.defendantId, 'appeal', `Appeal on the ground that ${APPEAL_GROUNDS[ground].name.charAt(0).toLowerCase()}${APPEAL_GROUNDS[ground].name.slice(1)}: ${a.outcome}.`, c.id);
  return { appeal: a, outcome: a.outcome, text: { 'sentence reduced': 'The appeal court reduced your sentence.', dismissed: 'The appeal was dismissed.',
    'conviction quashed': 'The appeal court quashed your conviction.', exonerated: 'The appeal court quashed your conviction. You did not do this, and now the record says so.' }[a.outcome] };
}

/** Changes a sentence, keeping the history of every change. */
export function modify(s, deltaYears, why) {
  const before = s.years;
  s.years = Math.max(0, s.years + deltaYears);
  s.modifications.push({ year: year(), from: before, to: s.years, why });
  const rec = (s.defendantId === player().id ? player().legal.record : person(s.defendantId)?.flags.record ?? []).find((r) => r.caseId === s.caseId);
  if (rec) rec.sentenceYears = s.years;
}

/** Overturns a conviction. The incident and the trial stay as they were. */
function quash(c, outcome, why) {
  move(c, 'quashed', why);
  const s = J().sentences[c.sentenceId];
  if (s) { s.status = 'quashed'; s.modifications.push({ year: year(), from: s.years, to: 0, why }); }
  const list = c.defendantId === player().id ? player().legal.record : person(c.defendantId)?.flags.record ?? [];
  const rec = list.find((r) => r.caseId === c.id);
  if (rec) Object.assign(rec, { convicted: false, outcome, exonerated: outcome === 'exonerated', quashedYear: year() });
  c.verdict = { ...c.verdict, overturned: outcome, overturnedYear: year() };
  if (outcome === 'exonerated') {
    const served = c.defendantId === player().id ? player().legal.incarceration?.served ?? s?.years ?? 0 : 0;
    const comp = localMoney(15000 * Math.max(1, served), COUNTRIES[c.countryId]);
    pay({ key: `compensation:${c.id}`, kind: 'compensation', amount: comp, payer: 'state', payee: c.defendantId, caseId: c.id });
    note(c.defendantId, 'exonerated', 'Exonerated: the conviction was quashed on new evidence.', c.id);
  }
}

/**
 * Evidence that someone else did it, if the truth of the incident left any.
 * Turns up only for convictions of someone who did not do it.
 */
export function seekFreshEvidence(c, chance) {
  if (c.fresh || c.stage !== 'sentenced') return false;
  const inc = J().incidents[c.incidentId];
  if (inc.truth.perpetratorId === c.defendantId || !rng.chance(chance)) return false;
  const kind = exists('forensic') ? 'forensic' : 'witness';
  const ev = addEvidence(inc, kind, inc.truth.perpetratorId, { lawful: true, reliability: 0.9, summary: `New ${EVIDENCE[kind].name.toLowerCase()} points to ${nameOf(inc.truth.perpetratorId)}.` });
  c.fresh = ev.id;
  return true;
}

// ---------- Money ----------

/**
 * Moves money once. The key makes a second call with the same key do nothing.
 * Parties are a character id, or 'court', 'state' for public bodies.
 * @returns {boolean} whether the payment stands (true if it already did)
 */
export function pay({ key, kind, amount, payer, payee, caseId, allowDebt = false }) {
  const ledger = J().ledger;
  if (ledger.some((t) => t.key === key)) return true;
  const p = player();
  const party = (id) => (id === p.id ? p : store.state.npcs[id] ?? null);
  const from = party(payer);
  if (from === p && !allowDebt && p.finance.cash < amount) return false;
  if (from === p) p.finance.cash -= amount;
  else if (from && typeof from.savings === 'number') from.savings = Math.max(0, from.savings - amount);
  const to = party(payee);
  if (to === p) p.finance.cash += amount;
  else if (to && typeof to.savings === 'number') to.savings += amount;
  const country = COUNTRIES[p.countryId];
  ledger.push({ id: nextId('tx'), key, kind, amount, currency: country.currency.code, caseId, payer, payee, year: year(), status: 'paid' });
  return true;
}
/** Payments for one case, in order. */
export const paymentsFor = (caseId) => J().ledger.filter((t) => t.caseId === caseId);

// ---------- Cases nobody needs to play ----------

/**
 * Runs a case to its end without the player: counsel, plea, trial. Used for
 * NPC defendants and for cases the player watches from another role.
 * @param {{plea?:string, counselTier?:string, admit?:Object}} [o]
 */
export function runToEnd(c, o = {}) {
  if (c.stage === 'charged') bailHearing(c);
  if (c.bail?.decision === 'bail' && c.bail.status === 'unpaid') remand(c);
  if (c.stage === 'pretrial') {
    const opt = counselOptions(c).find((x) => x.tier === (o.counselTier ?? 'public') && x.ok) ?? counselOptions(c).find((x) => x.tier === 'self');
    appoint(c, opt.tier, opt.npcId);
  }
  if (c.stage === 'plea') {
    const s = strength(c.evidenceIds, c.defendantId);
    const plea = o.plea ?? (offer(c) && s > 0.75 && rng.chance(0.7) ? 'deal' : s > 0.85 && rng.chance(0.5) ? 'guilty' : 'notGuilty');
    const r = enterPlea(c, plea);
    if (c.stage === 'plea') enterPlea(c, 'notGuilty');
    return r;
  }
  if (c.stage === 'trial') return trial(c, o);
  return { stage: c.stage, lines: [] };
}

/** Whether a person is old enough to be prosecuted at all, where they are. */
export const prosecutable = (age, countryId) => age >= responsibilityAge(countryId);

/** Every case a person has been the defendant in, oldest first. */
export const casesOf = (id) => Object.values(J().cases).filter((c) => c.defendantId === id).sort((a, b) => a.year - b.year);
