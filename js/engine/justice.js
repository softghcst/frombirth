// Crime and the courts, from where the player stands: choosing to break the
// law (or not), being investigated, arrested and charged, the case itself,
// the sentence, supervision afterwards, and the record that remains.
//
// The records themselves (incidents, evidence, cases, sentences) are kept by
// engine/cases.js. This file applies their consequences to the player's life.
import { forgetNpc } from './digital/core.js';
import { rule, may } from './rules.js';
import { policingShift } from './policy.js';
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, npcsByRole, log, milestone } from '../state.js';
import { resolve } from './conditions.js';
import { fire, currentCareer } from './career.js';
import { leaveForPrison } from './education.js';
import { CRIMES, CRIME_BY_ID, LIFE_SENTENCE, STRANGERS, METHODS, METHOD_BY_ID } from '../data/crimes.js';
import { OFFENSE_BY_ID, OFFENSES, systemFor, responsibilityAge, WRONGFUL_SUSPICION, courtsFor } from '../data/justice.js';
import * as k from './cases.js';
import { convictionsOf } from './records.js';
import { admit, facilityFor } from './prison.js';
import { shiftImage } from './royalty.js';
import { addStory } from './reputation.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

/** The player's legal state, with every field present. */
export function legal() {
  const l = player().legal;
  l.record ??= [];
  l.history ??= [];
  l.counselIds ??= [];
  l.heat ??= 0;
  l.pending ??= null;
  l.supervision ??= null;
  return l;
}

export const isJailed = () => !!player().legal.incarceration;
/** Adult convictions that count. Juvenile and sealed records do not. */
export const convictions = () => convictionsOf(player());

// ---------- Committing a crime ----------

export function successChance(crime, edge = 0) {
  let chance = crime.base + edge;
  for (const [path, w] of Object.entries(crime.factors)) chance += w * ((Number(resolve(path)) || 0) - 50) / 100;
  return clamp(chance - legal().heat / 400, 0.03, 0.95);
}

/** A handful of strangers who happen to be around this year. */
export function strangerOptions() {
  const p = player();
  if (p.flags.strangers?.age !== p.age) {
    const pool = [...STRANGERS];
    const ids = [];
    while (ids.length < 7 && pool.length) ids.push(pool.splice(rng.int(0, pool.length - 1), 1)[0].id);
    p.flags.strangers = { age: p.age, ids };
  }
  return p.flags.strangers.ids.map((id) => STRANGERS.find((x) => x.id === id)).filter(Boolean)
    .map((x) => ({ id: x.id, name: x.name, note: x.guard >= 0.2 ? 'Well protected.' : x.heat ? 'The police would take it personally.' : x.guard < 0 ? 'Will not see it coming.' : '' }));
}

/** Ways of doing it that are open to the player, with a plain-words read on each. */
export function methodOptions() {
  const murder = CRIME_BY_ID.murder;
  return METHODS.filter((m) => !m.needs || resolve(m.needs)).map((m) => {
    const chance = successChance(murder, m.edge);
    return { id: m.id, name: m.name, blurb: m.blurb,
      odds: chance >= 0.7 ? 'good' : chance >= 0.45 ? 'fair' : chance >= 0.25 ? 'poor' : 'terrible' };
  });
}

/** What a court could do, in plain words. */
function stakes(off) {
  if (off.custody[1] === 0) return 'A fine if convicted.';
  if (off.severity === 1) return 'A caution, a fine or community service, usually.';
  return `Up to ${off.custody[1] >= LIFE_SENTENCE ? 'life' : `${off.custody[1]} years`} in custody if convicted.`;
}

/** Crimes open to the player now, with a plain-words read on the odds. */
export function crimeOptions() {
  const p = player();
  return CRIMES.filter((c) => p.age >= c.minAge).map((c) => {
    const chance = successChance(c);
    return { id: c.id, name: c.name, target: !!c.target,
      odds: chance >= 0.7 ? 'good' : chance >= 0.45 ? 'fair' : chance >= 0.25 ? 'poor' : 'terrible',
      stakes: stakes(OFFENSE_BY_ID[c.offense]) };
  });
}
export const canCommitCrimes = () => player().age >= 8 && !isJailed() && !legal().pending;

/** People the player could turn on. */
export const targets = () => player().npcIds.map((id) => store.state.npcs[id])
  .filter((n) => n?.alive && n.role !== 'pet' && n.age >= 18);

/**
 * @param {string} crimeId
 * @param {string} [targetId]  for crimes against a person: someone the player knows
 * @param {{strangerId?:string, methodId?:string}} [how]  a stranger instead, and the way it is done
 * @returns {{ok:boolean, text:string, tone:string, arrested:boolean}}
 */
export function commitCrime(crimeId, targetId, how = {}) {
  const p = player();
  const c = country();
  const crime = CRIME_BY_ID[crimeId];
  const off = OFFENSE_BY_ID[crime.offense];
  const l = legal();
  if (!canCommitCrimes() || p.age < crime.minAge) return { ...result(false, 'You cannot do that now.', 'neutral'), arrested: false };
  const known = store.state.npcs[targetId];
  const stranger = crime.target && !known ? STRANGERS.find((x) => x.id === how.strangerId) ?? STRANGERS[0] : null;
  const method = crime.target ? METHOD_BY_ID[how.methodId] ?? METHOD_BY_ID.knife : null;
  const who = known ? `${known.firstName} ${known.lastName}` : stranger ? stranger.name.replace(/^an? /, 'The ').replace(/^the /, 'The ') : '';
  const edge = (method?.edge ?? 0) - (stranger?.guard ?? 0) + (method?.id === 'bare_hands' ? (p.stats.health - 50) / 250 : 0);
  const worked = rng.chance(successChance(crime, edge)); // judged on who you were before you did it
  p.counters.crimes += 1;
  p.hidden.karma = clamp(p.hidden.karma + crime.karma);
  p.talents.crime = clamp(p.talents.crime + 2);

  // Whoever was wronged is a person who stays in the world.
  const victim = known ?? (off.victim ? k.civilian(p.countryId, { occupation: stranger ? stranger.name.replace(/^(an?|the) /, '') : undefined }) : null);
  const witnesses = rng.chance(worked ? 0.25 : 0.6) ? [k.civilian(p.countryId).id] : [];
  const inc = k.createIncident({ offenseId: off.id, perpetratorId: p.id, victimId: victim?.id, countryId: p.countryId, city: p.city, witnessIds: witnesses });

  if (worked) {
    const range = stranger?.loot ?? crime.loot;
    const loot = localMoney(rng.int(range[0], range[1]), c);
    p.finance.cash += loot;
    if (victim && loot && typeof victim.savings === 'number') victim.savings = Math.max(0, victim.savings - loot);
    l.heat = clamp(l.heat + crime.heat + (stranger?.heat ?? 0));
    if (crime.mood) p.stats.mood = clamp(p.stats.mood + crime.mood);
    let text = crime.done;
    if (crime.target) {
      victim.alive = false;
      victim.flags.diedYear ??= store.state.year;
      p.counters.kills += 1;
      text = `${method.done.replace(/\{v\}/g, who).replace(/([,a-z] )The /g, '$1the ')} ${crime.done}`;
    }
    if (loot) text += ` You are ${fmtMoney(loot, c)} richer.`;
    // Most wrongs are reported. Some are never noticed.
    if (rng.chance(off.victim ? (off.severity >= 4 ? 1 : 0.7) : 0.3)) k.openInvestigation(inc);
    log(text, 'system', 'neutral');
    return { ...result(true, text, 'neutral'), arrested: false };
  }

  // It went wrong. Either you are caught there and then, or you get away with nothing.
  if (crime.danger && rng.chance(crime.danger)) p.stats.health = clamp(p.stats.health - rng.int(15, 35));
  if (stranger && stranger.guard >= 0.25 && rng.chance(0.3)) p.stats.health = clamp(p.stats.health - rng.int(10, 30)); // they fought back
  const failed = crime.target ? `${who} is still very much alive. ${crime.failed}` : crime.failed;
  if (crime.target) inc.attempted = true;
  if (rng.chance(clamp(crime.caught + (method?.caught ?? 0) + l.heat / 300 + policingShift(p.countryId), 0.05, 0.97))) {
    const inv = k.openInvestigation(inc, { redHanded: true });
    const r = arrestFor(inv, true);
    const text = `${failed} ${r}`;
    log(text, 'system', 'bad');
    return { ...result(false, text), arrested: !!l.pending };
  }
  l.heat = clamp(l.heat + Math.round(crime.heat / 2));
  if (rng.chance(0.4)) k.openInvestigation(inc);
  const text = `${failed} You run, and get away with nothing.`;
  log(text, 'system', 'bad');
  return { ...result(false, text), arrested: false };
}

// ---------- Arrest ----------

/**
 * The police arrest the player and a prosecutor decides on a charge. A child
 * below the age of criminal responsibility cannot be charged at all.
 * @returns {string} what happened, in words
 */
function arrestFor(inv, onTheSpot) {
  const p = player();
  const l = legal();
  const inc = k.J().incidents[inv.incidentId];
  const off = OFFENSE_BY_ID[inc.offenseId];
  if (p.age < responsibilityAge(p.countryId)) {
    k.note(p.id, 'warning', `Taken home by the police after ${off.name.toLowerCase()}. Too young to be charged.`);
    inv.stage = 'closed'; inv.outcome = 'below the age of responsibility';
    for (const parent of npcsByRole('parent')) parent.meters.relationship = clamp(parent.meters.relationship - 6);
    return 'You are too young to be charged. The police take you home, and your parents hear all about it.';
  }
  // A reigning monarch cannot be tried in their own courts. The file is closed, not forgotten.
  if (p.royal?.reigning) {
    inv.stage = 'suspended'; inv.outcome = 'sovereign immunity';
    inv.events.push({ year: store.state.year, text: 'Suspended: the suspect is the reigning monarch.' });
    k.note(p.id, 'immunity', `Investigated over ${off.name.toLowerCase()}; immune from prosecution as the reigning monarch.`);
    shiftImage(-25, 'an accusation the courts cannot hear');
    addStory(`the ${off.name.toLowerCase()} the monarch cannot be tried for`, true, 75);
    return 'As the reigning monarch you cannot be prosecuted in your own courts. The police close the file. The newspapers do not.';
  }
  k.note(p.id, 'arrested', `Arrested on suspicion of ${off.name.toLowerCase()}.`);
  if (!p.flags.everArrested) { p.flags.everArrested = true; milestone('Arrested for the first time.', 'crime'); }
  const c = k.decideCharge(inv, p.id);
  l.heat = Math.max(0, l.heat - 20);
  if (!c) return 'You are questioned for hours, and released without charge.';
  // Children and teenagers who admit a first minor offense can be diverted from court.
  l.pending = { caseId: c.id };
  return onTheSpot ? 'You are under arrest, and charged.' : 'You are charged.';
}

/** Arrests the player for an investigation (used by scenes and tests). */
export const arrest = (inv, onTheSpot = false) => arrestFor(inv, onTheSpot);

/** The open case, if there is one. */
export function pendingCase() {
  if (legal().pending && !legal().pending.caseId) upgradeLegacy();
  const id = legal().pending?.caseId;
  const c = id ? k.J().cases[id] : null;
  if (!c || ['acquitted', 'dismissed', 'sentenced', 'quashed'].includes(c.stage)) return null;
  return c;
}

/** Called once a case reaches its end: applies the sentence to the player's life. */
export function closeCase(c) {
  const p = player();
  const l = legal();
  if (l.pending?.caseId === c.id) l.pending = null;
  if (c.stage === 'acquitted' || c.stage === 'dismissed') {
    p.stats.mood = clamp(p.stats.mood + 10);
    if (c.remand) log('You leave custody the same day.', 'system', 'good');
    return;
  }
  if (c.stage !== 'sentenced' || c.applied) return;
  c.applied = true;
  const s = k.J().sentences[c.sentenceId];
  const off = OFFENSE_BY_ID[s.offenseId];
  // Work that depends on a clean record does not survive a conviction.
  const cur = currentCareer();
  if (cur?.req?.cleanRecord && !c.juvenile && s.type !== 'diversion') fire('dismissed');
  if (s.type === 'custody') {
    if (!p.flags.convicted) { p.flags.convicted = true; milestone(`Convicted of ${off.name.toLowerCase()}.`, 'crime'); }
    if (s.offenseId === 'homicide' && !c.juvenile && rule('deathPenalty', c.countryId) && rng.chance(0.3)) {
      imprison(s.years, off.severity, { caseId: c.id, sentenceId: s.id });
      Object.assign(p.legal.incarceration, { deathRow: true, yearsLeft: LIFE_SENTENCE + 10, security: 'max' });
      s.deathPenalty = true;
      k.note(p.id, 'sentenced', 'Sentenced to death.', c.id);
      return;
    }
    imprison(Math.max(1, s.years - s.credit), off.severity, { caseId: c.id, sentenceId: s.id });
    return;
  }
  if (s.supervision) {
    l.supervision = { kind: s.type, sentenceId: s.id, caseId: c.id, from: store.state.year, until: store.state.year + s.supervision,
      conditions: s.type === 'probation' ? ['Report to a probation officer', 'Commit no further offense'] : ['Commit no further offense'] };
  }
  if (s.type !== 'diversion' && !p.flags.convicted && !c.juvenile) { p.flags.convicted = true; milestone(`Convicted of ${off.name.toLowerCase()}.`, 'crime'); }
  p.stats.mood = clamp(p.stats.mood - 5);
}

/** A new conviction while on probation or a suspended sentence breaks its terms. */
function breach(c) {
  const l = legal();
  const sup = l.supervision;
  if (!sup || c.stage !== 'sentenced' || sup.caseId === c.id) return null;
  const old = k.J().sentences[sup.sentenceId];
  l.supervision = null;
  if (old.type === 'suspended' || old.type === 'probation') {
    const years = Math.max(1, OFFENSE_BY_ID[old.offenseId].custody[0] || 1);
    old.modifications.push({ year: store.state.year, from: 0, to: years, why: 'Breached by a new offense: activated as custody.' });
    old.type = 'custody'; old.years = years;
    return years;
  }
  if (sup.kind === 'parole') return 1;
  return null;
}

/** After the verdict and sentence: everything that follows from them. */
export function afterVerdict(c) {
  const extra = breach(c);
  closeCase(c);
  if (extra) {
    const k2 = player().legal.incarceration;
    if (k2) { k2.yearsLeft += extra; k2.total += extra; }
    else imprison(extra, 2, { caseId: c.id });
    log(`The new conviction breaks the terms of your earlier sentence: ${extra} more year${extra === 1 ? '' : 's'}.`, 'system', 'bad');
  }
}

// ---------- Custody ----------

/**
 * Sends the player into custody at a real facility.
 * @param {number} years
 * @param {number} [severity]
 * @param {{caseId?:string, sentenceId?:string}} [o]
 */
export function imprison(years, severity = 2, o = {}) {
  const p = player();
  const juvenile = p.age < systemFor(p.countryId).adultAge;
  const term = juvenile ? Math.max(1, Math.min(years, systemFor(p.countryId).adultAge + 3 - p.age)) : years;
  if (p.career.careerId) fire('dismissed');
  if (p.career.partTime) p.career.partTime = null;
  if (p.career.sides) p.career.sides = [];
  leaveForPrison();
  const security = juvenile ? 'min' : severity >= 4 ? 'max' : severity >= 3 ? 'med' : 'min';
  p.legal.incarceration = { id: k.newId('custody'), facility: juvenile ? 'juvenile' : 'prison', security,
    yearsLeft: term, total: term, served: 0, respect: 20, conduct: 55, gangId: null, escapeAttempts: 0,
    caseId: o.caseId ?? null, sentenceId: o.sentenceId ?? null, admitted: store.state.year,
    routine: 'study', program: null, studied: {}, job: null, work: [], visits: [], letters: 0, calls: 0, reviews: [], discipline: [], guardians: {} };
  p.stats.mood = clamp(p.stats.mood - 15);
  admit(p.legal.incarceration);
  if (!p.flags.beenInside) { p.flags.beenInside = true; milestone(juvenile ? 'Sent to youth detention.' : 'Sent to prison.', 'crime'); }
  k.note(p.id, 'custody', `Taken into custody${term >= LIFE_SENTENCE ? ' for life' : ` for ${term} year${term === 1 ? '' : 's'}`}.`, o.caseId ?? null);
}

/**
 * Leaves custody. The people met inside stay in the world: friends stay in
 * the player's life, the rest stay where they are.
 * @param {string} [how]
 * @param {{parole?:boolean}} [o]  released early, under supervision for the rest of the term
 */
export function release(how = 'You served your sentence and walked out of the gate.', o = {}) {
  const p = player();
  const cell = p.legal.incarceration;
  if (!cell) return;
  for (const mate of npcsByRole('cellmate')) {
    if (mate.meters.relationship >= 60) { mate.role = 'friend'; mate.flags.metInside = true; }
    else forgetNpc(mate.id);
  }
  if (o.parole && cell.yearsLeft > 0 && cell.yearsLeft < LIFE_SENTENCE) {
    p.legal.supervision = { kind: 'parole', sentenceId: cell.sentenceId, caseId: cell.caseId, from: store.state.year, until: store.state.year + cell.yearsLeft,
      conditions: ['Live at an approved address', 'Meet your supervising officer', 'Commit no further offense'] };
  }
  const s = k.J().sentences[cell.sentenceId];
  if (s && s.status === 'active' && !o.parole) s.status = 'complete';
  if (s) s.released = store.state.year;
  (p.legal.custodyHistory ??= []).push({ id: cell.id, facilityId: cell.facilityId, from: cell.admitted, to: store.state.year, served: cell.served, how: o.parole ? 'parole' : o.escape ? 'escape' : 'release',
    studied: Object.keys(cell.studied ?? {}), job: cell.job });
  p.legal.incarceration = null;
  p.stats.mood = clamp(p.stats.mood + 15);
  // Children placed elsewhere while the player was inside come home, if they are still children.
  const home = Object.keys(cell.guardians ?? {}).map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.age < 18);
  for (const kid of Object.keys(cell.guardians ?? {}).map((id) => store.state.npcs[id]).filter(Boolean)) { delete kid.flags.guardian; delete kid.flags.livesIn; }
  if (home.length && !o.escape) log(`${home.map((n) => n.firstName).join(' and ')} ${home.length === 1 ? 'comes' : 'come'} home to live with you again.`, 'system', 'good');
  log(how, 'system', 'good');
  if (!o.escape) {
    k.note(p.id, 'released', o.parole ? 'Released on parole.' : 'Released from custody.', cell.caseId);
    reenter(cell);
  }
}

/** The first days out: somewhere to live, the people who are still there, a plan. */
function reenter(cell) {
  const p = player();
  const home = [...npcsByRole('spouse'), ...npcsByRole('partner'), ...npcsByRole('parent')].filter((n) => !n.flags.abroad)
    .sort((a, b) => b.meters.relationship - a.meters.relationship)[0];
  let housing;
  if (p.homeId) housing = 'your own home';
  else if (home && home.meters.relationship >= 45) {
    housing = `with ${home.firstName}`;
    if (home.role === 'parent') p.flags.livesWithParents = true;
  } else housing = 'a hostel for people leaving prison';
  p.flags.reentry = { year: store.state.year, housing, steps: [], yearsInside: cell.served };
  if (cell.served >= 1) log(`You leave with a release grant, a bag of your things, and a bed ${housing === 'your own home' ? 'at home' : housing}.`);
  const grant = localMoney(80, country());
  k.pay({ key: `grant:${cell.id}`, kind: 'release_grant', amount: grant, payer: 'state', payee: p.id, caseId: cell.caseId });
}

// ---------- Older saves ----------

const OLD_CRIME = { shoplift: 'shoplifting', pickpocket: 'theft', vandalism: 'criminal_damage', bike_theft: 'theft', burglary: 'burglary', mugging: 'robbery', car_theft: 'vehicle_theft', fraud: 'fraud', bank_robbery: 'armed_robbery', murder: 'homicide' };

/**
 * Brings a life saved before the justice records up to date, once. Crimes the
 * police had not solved become open investigations; an open case becomes a
 * case at the point it had reached; a sentence being served is placed at a
 * facility. Only what the old save recorded is carried over: no trial,
 * hearing or evidence that did not exist is made up. An old open case keeps
 * one summary evidence record, at the strength the old save gave it.
 */
export function upgradeLegacy() {
  const p = player();
  const l = legal();
  if (l.unsolved) {
    for (const u of l.unsolved) {
      const off = OLD_CRIME[u.crimeId] ?? u.crimeId;
      if (!OFFENSE_BY_ID[off]) continue;
      const inc = k.createIncident({ offenseId: off, perpetratorId: p.id, countryId: p.countryId, city: p.city });
      inc.year = p.birthYear + u.age;
      inc.legacy = true;
      const inv = k.openInvestigation(inc);
      inv.opened = inc.year;
      inv.years = Math.max(0, store.state.year - inc.year);
    }
    delete l.unsolved;
  }
  if (l.pending && !l.pending.caseId) {
    const old = l.pending;
    const off = OLD_CRIME[old.crimeId] ?? old.crimeId;
    const inc = k.createIncident({ offenseId: off, perpetratorId: p.id, countryId: p.countryId, city: p.city });
    inc.legacy = true;
    const inv = k.openInvestigation(inc);
    inv.evidenceIds.push(k.addEvidence(inc, old.evidence > 0.7 ? 'officer' : 'witness', p.id, { reliability: old.evidence ?? 0.6, lawful: true,
      summary: 'The case against you, as it stood before these records were kept.' }).id);
    const c = k.openCaseFor(inv, p.id);
    c.legacy = true;
    k.bailHearing(c);
    if (old.lawyer && old.lawyer !== 'self') {
      // The fee was paid under the old save. It is recorded, and not taken again.
      k.J().ledger.push({ id: k.newId('tx'), key: `fee:${c.id}`, kind: 'legal_fee', amount: 0, currency: country().currency.code, caseId: c.id, payer: p.id, payee: 'counsel', year: store.state.year, status: 'paid before these records' });
      const opt = k.counselOptions(c).find((x) => x.tier === old.lawyer);
      if (opt) k.appoint(c, old.lawyer, opt.npcId);
    }
    l.pending = { caseId: c.id };
  }
  const cell = l.incarceration;
  if (cell && !cell.facilityId) {
    Object.assign(cell, { id: cell.id ?? k.newId('custody'), caseId: cell.caseId ?? null, sentenceId: cell.sentenceId ?? null, admitted: cell.admitted ?? store.state.year - (cell.served ?? 0),
      routine: cell.routine ?? 'work', program: null, studied: {}, job: null, work: [], visits: [], letters: 0, calls: 0, reviews: [], discipline: [], guardians: {}, legacy: true });
    const f = facilityFor(p.countryId, cell.facility === 'juvenile' ? 'juvenile' : cell.security);
    cell.facilityId = f.id;
    // The cellmate the old save had is kept, and becomes one of the people there.
    for (const mate of npcsByRole('cellmate')) {
      if (mate.flags.inmate) continue;
      mate.flags.inmate = { facilityId: f.id, offenseId: 'theft', yearsLeft: rng.int(2, 8), interest: 'cards', goal: 'stay out for good', background: 'was there before you', since: store.state.year };
      mate.flags.justice ??= { kind: 'inmate', since: store.state.year, caseIds: [], countryId: p.countryId };
      if (!k.J().people.includes(mate.id)) k.J().people.push(mate.id);
      f.inmateIds.push(mate.id);
    }
  }
}

// ---------- The year ----------

/** Yearly: investigations, supervision, records, the people of the system. */
export function tickCrime() {
  const p = player();
  const l = legal();
  upgradeLegacy();
  const J = k.J();
  ageOfficials();

  // Police work goes on, on cases about the player and on cases the player only saw.
  for (const inv of Object.values(J.investigations)) {
    if (!['active', 'suspect'].includes(inv.stage)) continue;
    const inc = J.incidents[inv.incidentId];
    const mine = inc.truth.perpetratorId === p.id || inv.suspectIds.includes(p.id);
    const r = k.workInvestigation(inv, mine ? l.heat / 100 : 0);
    if (r !== 'charge') continue;
    const top = k.leading(inv);
    if (top.id === p.id) {
      if (isJailed() || l.pending || !p.alive) { inv.stage = 'suspect'; continue; }
      const off = OFFENSE_BY_ID[inc.offenseId];
      const ago = store.state.year - inc.year;
      log(`There is a knock at the door. The police have been investigating ${off.name.toLowerCase()}${ago ? `, ${ago} year${ago === 1 ? '' : 's'} ago` : ''}, and they have come for you.`, 'system', 'bad');
      log(arrestFor(inv, false), 'system', 'bad');
    } else {
      const c = k.decideCharge(inv, top.id);
      if (!c) continue;
      k.runToEnd(c);
      const watched = inc.participants.some((x) => x.id === p.id && x.role === 'witness');
      if (watched) {
        const n = k.nameOf(c.defendantId);
        log(c.stage === 'sentenced' ? `The case you reported came to court. ${n} was convicted.` : `The case you reported came to court. ${n} was not convicted.`, 'system', 'neutral');
        k.note(p.id, 'witness', `Gave evidence in the case against ${n}.`, c.id);
      } else if (inc.truth.perpetratorId === p.id && c.stage === 'sentenced') {
        p.hidden.karma = clamp(p.hidden.karma - 10);
        log(`You read in the paper that ${k.nameOf(c.defendantId)} has been convicted of something you did.`, 'system', 'bad');
      }
    }
  }

  // Immunity ends with the reign: files closed for it can be opened again.
  if (!p.royal?.reigning) {
    for (const inv of Object.values(J.investigations)) {
      if (inv.outcome === 'sovereign immunity' && inv.stage === 'suspended') { inv.stage = 'active'; inv.outcome = null; inv.events.push({ year: store.state.year, text: 'Reopened: the suspect no longer reigns.' }); }
    }
  }

  // A conviction of someone who did not do it: sometimes the truth surfaces.
  for (const c of k.casesOf(p.id)) {
    if (k.seekFreshEvidence(c, isJailed() ? 0.12 : 0.05)) {
      log('A letter arrives from a legal charity that reviews convictions. They have found new evidence in your case, and think you have grounds to appeal.', 'system', 'good');
    }
  }

  // Rarely, and only to someone with nothing open, suspicion falls in the wrong place.
  if (p.age >= 18 && !isJailed() && !l.pending && !p.flags.fugitive && rng.chance(WRONGFUL_SUSPICION)) wronglySuspected();

  // Supervision: reporting each year, then its end.
  const sup = l.supervision;
  if (sup && store.state.year >= sup.until) {
    const s = J.sentences[sup.sentenceId];
    if (s) s.status = 'complete';
    l.supervision = null;
    const what = { probation: 'probation', suspended: 'your suspended sentence', discharge: 'your conditional discharge', parole: 'your parole', diversion: 'the diversion program' }[sup.kind] ?? 'your supervision';
    log(`You have completed ${what}. The conditions no longer apply.`, 'system', 'good');
    k.note(p.id, 'completed', `Completed ${what}.`, sup.caseId);
    if (sup.kind === 'diversion') { const r = l.record.find((x) => x.caseId === sup.caseId); if (r) r.outcome = 'diversion completed'; }
  }
  // Non-custodial sentences that run their course.
  for (const s of Object.values(J.sentences)) {
    if (s.defendantId === p.id && s.status === 'active' && s.type !== 'custody' && !s.supervision && store.state.year > s.year) s.status = 'complete';
  }
  // Juvenile records close at adulthood.
  if (p.age === systemFor(p.countryId).adultAge) for (const r of l.record) if (r.juvenile && !r.sealed) r.sealed = true;
  l.heat = Math.max(0, l.heat - 10);
}

/** Judges, lawyers, police and inmates grow older, retire and die. */
function ageOfficials() {
  const J = k.J();
  const mine = new Set(player().npcIds);
  for (const id of J.people) {
    const n = store.state.npcs[id];
    if (!n?.alive || mine.has(id)) continue;
    n.age += 1;
    const role = n.flags.justice;
    if (role && !role.retired && ['judge', 'prosecutor', 'defence', 'detective', 'officer', 'staff'].includes(role.kind)) {
      role.skill = clamp((role.skill ?? 50) + (rng.chance(0.5) ? 1 : 0));
      if (n.age >= (role.kind === 'judge' ? 70 : 66) && rng.chance(0.4)) { role.retired = store.state.year; n.occupation = `Retired ${n.occupation.toLowerCase()}`; }
    }
    if (n.age >= 75 && rng.chance((n.age - 70) / 120)) { n.alive = false; n.flags.diedYear = store.state.year; }
  }
}

/** Arrested for something someone else did. Rare, and handled carefully. */
function wronglySuspected() {
  const p = player();
  const off = OFFENSE_BY_ID[rng.pick(['burglary', 'theft', 'assault', 'fraud'])];
  const real = k.civilian(p.countryId, { age: rng.int(18, 45), kind: 'civilian' });
  const witness = k.civilian(p.countryId, { kind: 'civilian' });
  const victim = off.victim ? k.civilian(p.countryId, { kind: 'civilian' }) : null;
  const inc = k.createIncident({ offenseId: off.id, perpetratorId: real.id, victimId: victim?.id, countryId: p.countryId, city: p.city, witnessIds: [witness.id] });
  const inv = k.openInvestigation(inc, { misidentify: p.id });
  // The witness is honest, and wrong.
  const wrong = inv.evidenceIds.map((id) => k.J().evidence[id]).find((e) => e.sourceId === witness.id);
  if (wrong) { wrong.pointsTo = p.id; wrong.reliability = Math.min(wrong.reliability, 0.62); wrong.summary = `${k.nameOf(witness.id)} identifies you.`; }
  if (k.strength(inv.evidenceIds, p.id) < k.CHARGE_AT) {
    inv.evidenceIds.push(k.addEvidence(inc, ['fraud'].includes(off.id) ? 'documents' : 'physical', p.id, { reliability: 0.6, lawful: true,
      summary: 'Something found near the scene could be yours.' }).id);
  }
  inc.wrongful = true;
  log(`The police arrive with a warrant. They believe you were involved in ${off.name.toLowerCase()}. You were not.`, 'system', 'bad');
  log(arrestFor(inv, false), 'system', 'bad');
}

// ---------- After a sentence ----------

/** Records that a court could now seal, with when each becomes eligible. */
export function sealOptions() {
  const p = player();
  const sys = k.lawAt(p.countryId);
  return legal().record.filter((r) => r.convicted && !r.sealed && !r.juvenile && !r.exonerated).map((r) => {
    const off = OFFENSE_BY_ID[r.crimeId];
    const s = Object.values(k.J().sentences).find((x) => x.caseId === r.caseId);
    const done = s ? (s.status === 'complete' ? (s.released ?? s.year + (s.supervision || 0)) : null) : r.year + Math.max(1, r.sentenceYears);
    const wait = sys.sealAfter ? sys.sealAfter[off && off.severity >= 3 ? 1 : 0] : null;
    let why = '';
    if (!sys.sealAfter) why = 'Records are not sealed here.';
    else if (off && off.severity >= 4) why = 'Convictions this serious stay on the record.';
    else if (done == null) why = 'The sentence is not yet complete.';
    else if (store.state.year < done + wait) why = `Eligible in ${done + wait - store.state.year} year${done + wait - store.state.year === 1 ? '' : 's'}.`;
    return { caseId: r.caseId, label: `${r.offense ?? off?.name ?? r.crimeId}, age ${r.age}`, ok: !why, why };
  });
}

/** Applies to have a completed conviction sealed. */
export function sealRecord(caseId) {
  const opt = sealOptions().find((x) => x.caseId === caseId);
  if (!opt?.ok) return result(false, opt?.why || 'That record cannot be sealed.', 'neutral');
  const fee = localMoney(300, country());
  if (!k.pay({ key: `seal:${caseId}`, kind: 'court_fee', amount: fee, payer: player().id, payee: 'court', caseId })) return result(false, `The application fee is ${fmtMoney(fee, country())}.`, 'neutral');
  const r = legal().record.find((x) => x.caseId === caseId);
  r.sealed = true;
  r.sealedYear = store.state.year;
  k.note(player().id, 'sealed', `The record of ${(r.offense ?? '').toLowerCase()} was sealed.`, caseId);
  const text = `The ${courtsFor(player().countryId).lower} sealed the record. Most employers will no longer see it, though the history itself is not erased.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** A pardon from a head of state: convictions are forgiven, not erased. */
export function pardon() {
  const l = legal();
  for (const r of l.record) if (r.convicted) { r.pardoned = true; r.pardonedYear = store.state.year; }
  const c = pendingCase();
  if (c) { k.move(c, 'dismissed', 'Discontinued after a pardon.'); c.verdict = { outcome: 'dismissed', year: store.state.year }; }
  l.pending = null;
  l.heat = 0;
  k.note(player().id, 'pardoned', 'Pardoned.');
}

/** Legal status in a few words. */
export function status() {
  const p = player();
  const l = legal();
  if (l.incarceration) return l.incarceration.facility === 'juvenile' ? 'In youth detention' : 'In custody';
  if (p.flags.fugitive) return 'Wanted';
  const c = pendingCase();
  if (c) return c.remand ? 'Held awaiting trial' : 'Awaiting trial';
  if (l.supervision) return { probation: 'On probation', parole: 'On parole', suspended: 'Serving a suspended sentence', discharge: 'Conditionally discharged', diversion: 'In a diversion program' }[l.supervision.kind] ?? 'Under supervision';
  if (convictions().length) return 'Has a criminal record';
  return 'No criminal record';
}

/** Offenses, for anything that lists them. */
export const offenses = () => OFFENSES;
