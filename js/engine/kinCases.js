// When someone in the player's family is the one in trouble. Rare: a relative
// is investigated and charged (sometimes for something they did not do), the
// player decides how to stand by them, the case runs its course, and a
// sentence is served at a real facility, where the player can visit.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, log } from '../state.js';
import * as k from './cases.js';
import { remember } from './conditions.js';
import { facilityFor } from './prison.js';
import { checkCare } from './guardianship.js';
import { LAWYERS } from '../data/crimes.js';
import { OFFENSE_BY_ID, INMATE_LIVES, responsibilityAge } from '../data/justice.js';

const FAMILY = ['parent', 'sibling', 'spouse', 'partner', 'child', 'grandchild', 'relative', 'inlaw', 'niece', 'grandparent'];
/** A year's chance, for each grown relative. Kept low: most families never see a courtroom. */
export const KIN_CHANCE = 0.003;
const OFFENSES = ['theft', 'fraud', 'assault', 'vehicle_theft', 'burglary', 'embezzlement', 'criminal_damage'];
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const year = () => store.state.year;

/** Relatives inside right now. */
export const inside = (npc) => !!npc?.flags.inmate && !npc.flags.inmate.released;

/** Yearly: now and then, a relative is charged. At most one a year. */
export function tickKinCases() {
  const p = player();
  // A case whose scene was never answered (the life ended mid-way) still reaches its end.
  for (const n of p.npcIds.map((id) => store.state.npcs[id])) {
    if (n?.flags.openCaseId && !store.state.pendingEvents.some((e) => e.cast?.kin === n.id)) standBy('kin_quiet', n.id);
  }
  if (p.legal.incarceration || p.age < 10) return null;
  const kin = p.npcIds.map((id) => store.state.npcs[id])
    .filter((n) => n?.alive && FAMILY.includes(n.role) && n.age >= Math.max(16, responsibilityAge(p.countryId)) && n.age <= 80 && !inside(n) && !n.flags.openCaseId && !n.flags.abroad);
  for (const n of kin) {
    if (rng.chance(KIN_CHANCE * (1 + (n.meters.crazy ?? 30) / 60))) return charge(n);
  }
  return null;
}

/**
 * A relative is charged. Usually they did it; sometimes a witness is wrong.
 * @param {object} n  the relative
 * @param {{offenseId?:string, innocent?:boolean}} [o]
 */
export function charge(n, o = {}) {
  const p = player();
  const off = OFFENSE_BY_ID[o.offenseId ?? rng.pick(OFFENSES)];
  const innocent = o.innocent ?? rng.chance(0.15);
  const doer = innocent ? k.civilian(p.countryId, { age: rng.int(18, 50) }) : n;
  const victim = off.victim ? k.civilian(p.countryId) : null;
  const witness = k.civilian(p.countryId);
  const inc = k.createIncident({ offenseId: off.id, perpetratorId: doer.id, victimId: victim?.id, witnessIds: [witness.id], countryId: p.countryId, city: p.city });
  const inv = k.openInvestigation(inc);
  const w = inv.evidenceIds.map((id) => k.J().evidence[id]).find((e) => e.sourceId === witness.id);
  if (w) { w.pointsTo = n.id; w.summary = `${k.nameOf(witness.id)} identifies ${k.nameOf(n.id)}.`; }
  for (let i = 0; i < 4 && (k.leading(inv)?.id !== n.id || k.leading(inv).s < k.CHARGE_AT); i++) k.workInvestigation(inv, 0.7);
  if (k.strength(inv.evidenceIds, n.id) < k.CHARGE_AT) inv.evidenceIds.push(k.addEvidence(inc, 'physical', n.id, { reliability: 0.6, lawful: true }).id);
  const c = k.decideCharge(inv, n.id);
  if (!c) return null;
  const b = k.bailHearing(c);
  n.flags.openCaseId = c.id;
  const bail = b.decision === 'bail' ? `Bail is set at ${fmtMoney(b.amount, country())}.` : b.decision === 'remand' ? 'They are being held until the trial.' : 'They are home until the trial.';
  store.state.pendingEvents.push({ id: 'kin_charged', cast: { kin: n.id, words: { offense: off.name.toLowerCase(), bail } } });
  return c;
}

/** The player's choice about a relative's case, and the case run to its end. @returns {string} */
export function standBy(choice, kinId) {
  const p = player();
  const n = store.state.npcs[kinId];
  const c = k.J().cases[n?.flags.openCaseId];
  if (!c) return '';
  const lines = [];
  let tier = 'public';
  if (choice === 'kin_lawyer') {
    const cost = localMoney(LAWYERS.find((x) => x.id === 'good').cost, country());
    const lawyer = k.counselOptions(c).find((x) => x.tier === 'good');
    if (lawyer && k.pay({ key: `kin_fee:${c.id}`, kind: 'legal_fee', amount: cost, payer: p.id, payee: lawyer.npcId, caseId: c.id })) {
      c.defenseId = null;
      tier = 'good';
      // Paid by the player: the client still has the lawyer.
      k.J().ledger.push({ id: k.newId('tx'), key: `fee:${c.id}`, kind: 'legal_fee', amount: 0, currency: country().currency.code, caseId: c.id, payer: p.id, payee: lawyer.npcId, year: year(), status: `paid by ${p.firstName}` });
      k.appoint(c, 'good', lawyer.npcId);
      lines.push(`You paid ${fmtMoney(cost, country())} for ${k.nameOf(lawyer.npcId)} to defend them.`);
      n.meters.relationship = clamp(n.meters.relationship + 12);
    } else lines.push('You could not afford a lawyer for them. Legal aid will have to do.');
  }
  if (choice === 'kin_court') {
    if (c.bail?.decision === 'bail' && c.bail.status === 'unpaid') {
      if (k.postBail(c, p.id)) lines.push('You posted their bail.');
      else lines.push('You could not raise the bail.');
    }
    n.meters.relationship = clamp(n.meters.relationship + 10);
    remember(n, 'stoodByInCourt', 'You stood by them in court.');
  }
  if (choice === 'kin_distance') n.meters.relationship = clamp(n.meters.relationship - 12);
  if (c.bail?.decision === 'bail' && c.bail.status === 'unpaid') k.remand(c);
  k.runToEnd(c, { counselTier: tier });
  n.flags.openCaseId = null;
  const s = k.J().sentences[c.sentenceId];
  const who = n.firstName;
  if (c.stage === 'sentenced') {
    lines.push(`${who} was convicted: ${k.describe(s)}.`);
    if (s.type === 'custody') sendInside(n, c, s);
  } else lines.push(c.stage === 'acquitted' ? `${who} was found not guilty.` : `The case against ${who} was dropped.`);
  k.note(p.id, 'family', `${n.firstName} ${n.lastName} was ${c.stage === 'sentenced' ? 'convicted' : c.stage === 'acquitted' ? 'acquitted' : 'cleared'} in the ${c.court}.`, c.id);
  return lines.join(' ');
}

/** A relative begins a sentence: the same facilities, the same people inside. */
function sendInside(n, c, s) {
  const sev = OFFENSE_BY_ID[s.offenseId].severity;
  const f = facilityFor(c.countryId, sev >= 4 ? 'max' : sev >= 3 ? 'med' : 'min');
  n.flags.inmate = { facilityId: f.id, offenseId: s.offenseId, yearsLeft: Math.max(1, s.years - (s.credit ?? 0)), caseId: c.id, kin: true,
    interest: rng.pick(INMATE_LIVES.interests), goal: rng.pick(INMATE_LIVES.goals), background: n.occupation ? `was a ${n.occupation.toLowerCase()}` : 'has a family outside', since: year() };
  if (n.life?.job) n.life.job = null;
  f.inmateIds.push(n.id);
  log(`${n.firstName} is taken to ${f.name}. You can still write, and visit.`, 'system', 'bad');
  checkCare();
}

/** Visiting a relative inside. They decide whether to see you. */
export function visitKin(npcId) {
  const p = player();
  const n = store.state.npcs[npcId];
  if (!inside(n)) return result(false, 'They are not in prison.', 'neutral');
  if (p.legal.incarceration) return result(false, 'You cannot visit from a cell. A letter will have to do.', 'neutral');
  if (n.flags.visitedYear === p.age) return result(false, `You have already been to see ${n.firstName} this year.`, 'neutral');
  n.flags.visitedYear = p.age;
  const f = k.J().facilities[n.flags.inmate.facilityId];
  if (n.meters.relationship < 20 && rng.chance(0.6)) return result(false, `You make the journey to ${f.name}, and ${n.firstName} will not come out to the visits hall.`, 'bad');
  n.meters.relationship = clamp(n.meters.relationship + rng.int(8, 14));
  p.stats.mood = clamp(p.stats.mood + 3);
  remember(n, 'visitedThemInside', 'You came to see them in prison.');
  k.note(p.id, 'family', `Visited ${n.firstName} at ${f.name}.`);
  const text = `An hour across a table at ${f.name}. ${n.firstName} has ${n.flags.inmate.yearsLeft} year${n.flags.inmate.yearsLeft === 1 ? '' : 's'} to go, and has taken up ${n.flags.inmate.interest}.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** Writing to a relative inside. */
export function writeToKin(npcId) {
  const p = player();
  const n = store.state.npcs[npcId];
  if (!inside(n)) return result(false, 'They are not in prison.', 'neutral');
  if (n.flags.wroteYear === p.age) return result(false, `You have written to ${n.firstName} this year.`, 'neutral');
  n.flags.wroteYear = p.age;
  n.meters.relationship = clamp(n.meters.relationship + 5);
  const text = `You write to ${n.firstName}. A reply comes in a few weeks, in careful handwriting.`;
  log(text, 'system', 'good');
  return result(true, text);
}
