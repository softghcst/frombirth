// The justice system as a job. Each role has its own powers and nothing more:
// a detective investigates and recommends, a lawyer advises and argues, a
// judge rules within the law, a prison officer keeps people safe. Every
// brief is a real case, with real people, in the same records as any other.
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, log, milestone } from '../state.js';
import * as k from './cases.js';
import { currentCareer, adjustPerformance } from './career.js';
import { OFFENSE_BY_ID, SYSTEMS, EVIDENCE } from '../data/justice.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const DUTIES = {
  police: [{ id: 'investigate', label: 'Work a case' }],
  lawyer: [{ id: 'defend', label: 'Take a defence brief' }, { id: 'prosecute', label: 'Take a prosecution brief' }],
  judiciary: [{ id: 'preside', label: 'Hear a case' }],
  corrections: [{ id: 'shift', label: 'Work a shift on the wing' }],
};
const OFFENCES_FOR_BRIEFS = ['theft', 'burglary', 'fraud', 'assault', 'robbery', 'vehicle_theft', 'embezzlement'];

function acts() {
  const p = player();
  if (p.flags.legalActs?.age !== p.age) p.flags.legalActs = { age: p.age };
  return p.flags.legalActs;
}

/** What the player's job lets them do this year. */
export function duties() {
  const p = player();
  const cur = currentCareer();
  if (!cur || p.legal.incarceration) return [];
  return (DUTIES[cur.id] ?? []).map((d) => ({ ...d, done: !!acts()[d.id] }));
}

/** Something that happened, with the people involved, ready for the system to deal with. */
function freshIncident(o = {}) {
  const p = player();
  const off = OFFENSE_BY_ID[o.offenseId ?? rng.pick(OFFENCES_FOR_BRIEFS)];
  const perp = k.civilian(p.countryId, { age: rng.int(18, 55) });
  perp.savings = rng.int(500, 20000);
  const victim = off.victim ? k.civilian(p.countryId) : null;
  const witness = k.civilian(p.countryId);
  // Sometimes the person the evidence points to did not do it.
  const innocent = rng.chance(o.innocent ?? 0.3) ? k.civilian(p.countryId, { age: rng.int(18, 55) }) : null;
  const inc = k.createIncident({ offenseId: off.id, perpetratorId: perp.id, victimId: victim?.id, countryId: p.countryId, city: p.city, witnessIds: [witness.id] });
  const inv = k.openInvestigation(inc, innocent ? { misidentify: innocent.id } : {});
  if (innocent) {
    const w = inv.evidenceIds.map((id) => k.J().evidence[id]).find((e) => e.sourceId === witness.id);
    w.pointsTo = innocent.id;
    w.summary = `${k.nameOf(witness.id)} identifies ${k.nameOf(innocent.id)}.`;
  }
  return { inc, inv, innocentId: innocent?.id ?? null };
}

/** Builds a case ready for court, for a lawyer, a judge or a jury. */
export function freshCase(o = {}) {
  let tries = 0;
  for (;;) {
    const { inc, inv } = freshIncident(o);
    for (let i = 0; i < 4 && k.leading(inv)?.s < k.CHARGE_AT; i++) k.workInvestigation(inv, 0.8);
    const top = k.leading(inv);
    if (o.tainted) inv.evidenceIds.push(k.addEvidence(inc, rng.pick(['physical', 'digital']), top?.id ?? inc.truth.perpetratorId, { lawful: false,
      summary: `Items taken in a search carried out without a warrant point to ${k.nameOf(top?.id ?? inc.truth.perpetratorId)}.` }).id);
    const c = top ? k.decideCharge(inv, top.id) : null;
    if (c || ++tries > 6) return c;
  }
}

// ---------- Police ----------

/** Opens a case file for the player to work, as its investigating officer. */
export function openInvestigationBrief() {
  if (acts().investigate) return null;
  acts().investigate = true;
  const { inv } = freshIncident();
  inv.investigatorIds = [player().id];
  inv.events.push({ year: store.state.year, text: 'The file is yours.' });
  return inv;
}

/** What an investigator can do with this file now. */
export function detectiveOptions(inv) {
  if (!['active', 'suspect'].includes(inv.stage)) return [];
  const used = inv.playerSteps ?? [];
  const out = [];
  if (!used.includes('leads')) out.push({ id: 'leads', label: 'Follow up the leads', sub: 'Records, footage, the laboratory.' });
  if (!used.includes('reinterview')) out.push({ id: 'reinterview', label: 'Go back to the witnesses', sub: 'Memory is not a recording. Test it.' });
  for (const s of inv.suspectIds) {
    const st = k.strength(inv.evidenceIds, s);
    out.push({ id: `charge:${s}`, label: `Refer ${k.nameOf(s)} to the prosecutor`, sub: `The evidence against them is ${k.words4(st)}.` });
  }
  out.push({ id: 'close', label: 'Close the file for now', sub: 'Not enough to name anyone. It can be reopened.' });
  return out;
}

/**
 * One step in an investigation.
 * @returns {{ok:boolean, text:string, tone:string, done?:boolean}}
 */
export function detectiveAct(inv, act) {
  const p = player();
  const inc = k.J().incidents[inv.incidentId];
  (inv.playerSteps ??= []).push(act.split(':')[0]);
  if (act === 'leads') {
    const before = inv.evidenceIds.length;
    k.workInvestigation(inv, 0.6 + p.stats.intellect / 250);
    if (inv.evidenceIds.length === before) k.workInvestigation(inv, 0.8);
    const found = inv.evidenceIds.slice(before).map((id) => k.J().evidence[id]);
    return result(true, found.length ? found.map((e) => e.summary).join(' ') : 'Nothing new. Every lead runs dry.', found.length ? 'good' : 'neutral');
  }
  if (act === 'reinterview') {
    const mistaken = inv.evidenceIds.map((id) => k.J().evidence[id]).filter((e) => ['witness', 'victim'].includes(e.kind) && e.pointsTo !== inc.truth.perpetratorId);
    if (mistaken.length && rng.chance(clamp(0.3 + p.stats.intellect / 160, 0.3, 0.9))) {
      for (const e of mistaken) {
        e.retracted = store.state.year;
        e.reliability = Math.min(e.reliability, 0.2);
        inv.evidenceIds.push(k.addEvidence(inc, e.kind, inc.truth.perpetratorId, { sourceId: e.sourceId, lawful: true,
          summary: `${k.nameOf(e.sourceId)}, asked again with care, is no longer sure, and now describes someone matching ${k.nameOf(inc.truth.perpetratorId)}.` }).id);
      }
      inv.events.push({ year: store.state.year, text: 'A witness corrected their account.' });
      inv.suspectIds = [...new Set([...inv.suspectIds, inc.truth.perpetratorId])];
      return result(true, 'Going back over it slowly, a witness realises they were wrong about who they saw.');
    }
    return result(true, 'The witnesses tell it the same way again.', 'neutral');
  }
  if (act === 'close') {
    inv.stage = 'suspended';
    inv.events.push({ year: store.state.year, text: 'Suspended by the investigating officer.' });
    adjustPerformance(inv.suspectIds.length ? -2 : 1);
    return { ...result(true, 'You file it away. If something new turns up, it can be reopened.', 'neutral'), done: true };
  }
  const suspect = act.split(':')[1];
  inv.stage = 'referred';
  const c = k.decideCharge(inv, suspect);
  if (!c) { adjustPerformance(-3); return { ...result(false, 'The prosecutor reads the file and sends it back: not enough to charge.', 'neutral'), done: true }; }
  k.runToEnd(c);
  const guilty = inc.truth.perpetratorId === suspect;
  const convicted = c.stage === 'sentenced';
  adjustPerformance(guilty ? (convicted ? 8 : 2) : -8);
  if (!guilty && convicted) { p.hidden.karma = clamp(p.hidden.karma - 6); inc.wrongful = true; }
  k.note(p.id, 'work', `Investigated a case of ${OFFENSE_BY_ID[inc.offenseId].name.toLowerCase()}: ${k.nameOf(suspect)} was ${convicted ? 'convicted' : 'not convicted'}.`, c.id);
  return { ...result(guilty && convicted, `${k.nameOf(suspect)} was charged. ${convicted ? 'The court convicted.' : 'The court did not convict.'}${!guilty ? ' Something about the case still bothers you.' : ''}`, guilty === convicted ? 'good' : 'bad'), done: true, caseId: c.id };
}

// ---------- Lawyers ----------

/** A brief: a real case, with the player as counsel for one side. */
export function openCourtBrief(side) {
  if (acts()[side]) return null;
  acts()[side] = true;
  const c = freshCase();
  if (!c) return null;
  k.bailHearing(c);
  if (side === 'defend') {
    k.appoint(c, 'good', player().id);
    c.defenceTier = 'player';
  } else {
    c.prosecutorId = player().id;
    const opt = k.counselOptions(c).find((x) => x.tier === 'public');
    k.appoint(c, 'public', opt.npcId);
  }
  return c;
}

/** Choices for the player as counsel. */
export function counselChoices(c) {
  const sys = SYSTEMS[c.systemId];
  if (c.defenceId === player().id) {
    const out = [{ id: 'trial', label: 'Fight it at trial', sub: 'Test every piece of evidence.' },
      { id: 'challenge', label: 'Fight it, and challenge how the evidence was gathered', sub: 'More work. It matters only if something was done wrong.' }];
    if (k.offer(c)) out.push({ id: 'deal', label: 'Advise your client to take the offer', sub: c.offer.text });
    out.push({ id: 'guilty', label: 'Advise a guilty plea', sub: 'If your client tells you they did it.' });
    return out;
  }
  const out = [{ id: 'proceed', label: 'Prosecute as charged', sub: 'Put the evidence before the court.' }];
  if (sys.plea === 'bargain') out.push({ id: 'offer', label: 'Offer a plea to a lesser charge', sub: 'Certain, and lighter.' });
  out.push({ id: 'drop', label: 'Discontinue the case', sub: 'A prosecutor must not go on with a case the evidence does not support.' });
  return out;
}

/** Runs the case with the player's decision, and judges how the work went. */
export function argue(c, choice) {
  const p = player();
  const inc = k.J().incidents[c.incidentId];
  const guilty = inc.truth.perpetratorId === c.defendantId;
  const before = k.strength(c.evidenceIds, c.defendantId);
  if (c.defenceId === p.id) {
    if (choice === 'challenge') c.effort = 15 + Math.round(p.stats.intellect / 10);
    // A client who did it tells their lawyer; one who did not, says so.
    if (choice === 'guilty' && !guilty) return result(false, 'Your client looks at you and says, again, that they did not do it. You cannot advise them to plead guilty to something they deny.', 'neutral');
    k.runToEnd(c, { plea: choice === 'deal' ? 'deal' : choice === 'guilty' ? 'guilty' : 'notGuilty' });
    const won = c.stage === 'acquitted' || c.stage === 'dismissed' || (c.stage === 'sentenced' && J1(c).type !== 'custody');
    adjustPerformance(won ? 6 : before > 0.85 ? 0 : -3);
    const words = c.stage === 'sentenced' ? `Convicted: ${k.describe(J1(c))}.` : c.stage === 'acquitted' ? 'Not guilty.' : 'The case was dropped.';
    k.note(p.id, 'work', `Defended ${k.nameOf(c.defendantId)}: ${words}`, c.id);
    if (!p.flags.firstBrief) { p.flags.firstBrief = true; milestone('Defended a client in court.', 'career'); }
    return result(won, `${k.nameOf(c.defendantId)}: ${words}`, won ? 'good' : 'neutral');
  }
  if (choice === 'drop') {
    k.move(c, 'dismissed', 'The prosecution offered no evidence.');
    c.verdict = { outcome: 'dismissed', year: store.state.year };
    adjustPerformance(before < 0.7 || !guilty ? 3 : -4);
    k.note(p.id, 'work', `Discontinued the case against ${k.nameOf(c.defendantId)}.`, c.id);
    return result(true, `You discontinued the case against ${k.nameOf(c.defendantId)}.`, 'neutral');
  }
  if (choice === 'offer') k.offer(c);
  else if (c.offer === null) c.offer = { status: 'none' };
  k.runToEnd(c, choice === 'offer' ? { plea: c.offer?.status === 'open' && rng.chance(0.7) ? 'deal' : 'notGuilty' } : {});
  const convicted = c.stage === 'sentenced';
  adjustPerformance(convicted === guilty ? 6 : -4);
  if (convicted && !guilty) p.hidden.karma = clamp(p.hidden.karma - 4);
  const words = convicted ? `Convicted: ${k.describe(J1(c))}.` : 'Not guilty.';
  k.note(p.id, 'work', `Prosecuted ${k.nameOf(c.defendantId)}: ${words}`, c.id);
  return result(convicted, `${k.nameOf(c.defendantId)}: ${words}`, convicted === guilty ? 'good' : 'neutral');
}
const J1 = (c) => k.J().sentences[c.sentenceId];

// ---------- Judges ----------

/** A case for the player to hear. Some contain evidence that was not lawfully obtained. */
export function openBench() {
  if (acts().preside) return null;
  acts().preside = true;
  const c = freshCase({ tainted: rng.chance(0.5) });
  if (!c) return null;
  c.judgeId = player().id;
  // Bail, counsel and a not-guilty plea; the trial itself waits for the judge.
  k.bailHearing(c);
  const opt = k.counselOptions(c).find((x) => x.tier === 'public' && x.ok) ?? k.counselOptions(c).find((x) => x.tier === 'good');
  k.appoint(c, opt.tier, opt.npcId);
  c.plea = 'notGuilty';
  k.move(c, 'trial', 'Not guilty. The case goes to trial.');
  return c;
}

/** Evidence the judge must rule on: unlawfully obtained items, and whether the law leaves any choice. */
export function rulingsNeeded(c) {
  const sys = SYSTEMS[c.systemId];
  return c.evidenceIds.map((id) => k.J().evidence[id]).filter((e) => !e.lawful && e.admissible === null).map((e) => ({
    id: e.id, kind: EVIDENCE[e.kind].name, summary: e.summary, mustExclude: sys.exclusion === 'strict',
  }));
}

/**
 * The trial, with the player's rulings. Where the law requires exclusion, a
 * ruling to admit is not something a judge can make.
 */
export function hear(c, admit) {
  const sys = SYSTEMS[c.systemId];
  const rulings = {};
  for (const r of rulingsNeeded(c)) rulings[r.id] = sys.exclusion === 'strict' ? false : !!admit[r.id];
  // The judge's ruling stands whether or not the defence raised it.
  for (const [id, yes] of Object.entries(rulings)) { const e = k.J().evidence[id]; e.admissible = yes; c.rulings.push({ evidenceId: id, challenged: true, admitted: yes, year: store.state.year, byPlayer: true }); }
  const r = c.stage === 'trial' ? k.trial(c, { deferSentence: true }) : { lines: [] };
  return r;
}

/** The sentences the law allows for this conviction. */
export function sentencingRange(c) {
  const off = OFFENSE_BY_ID[c.verdict.offenseId];
  return { ladder: off.ladder, custody: off.custody, offense: off };
}

/** Passes sentence. The law sets the limits. */
export function passSentence(c, type, years) {
  const p = player();
  const s = k.passSentence(c, { type, years });
  if (!s) return result(false, 'There is nothing to sentence.', 'neutral');
  const inc = k.J().incidents[c.incidentId];
  // A conviction that rests on evidence you let in that should have stayed out may not survive appeal.
  if (c.rulings.some((r) => r.byPlayer && r.admitted)) {
    const a = k.fileAppeal(c, 'procedure', c.defenceId);
    if (a?.outcome === 'conviction quashed') { adjustPerformance(-6); log('The Court of Appeal quashed a conviction from your court: evidence you admitted should have been left out.', 'system', 'bad'); }
  }
  adjustPerformance(inc.truth.perpetratorId === c.defendantId ? 4 : -2);
  k.note(p.id, 'work', `Sentenced ${k.nameOf(c.defendantId)}: ${k.describe(s)}.`, c.id);
  return result(true, `You sentenced ${k.nameOf(c.defendantId)} to ${k.describe(s)}.`, 'neutral');
}
/** A verdict of not guilty from the player's court. */
export function acquittedHere(c) {
  adjustPerformance(1);
  k.note(player().id, 'work', `Presided over the trial of ${k.nameOf(c.defendantId)}: not guilty.`, c.id);
}

// ---------- Prisons and probation ----------

const SHIFTS = [
  { text: 'Two men are squaring up on the landing over a stolen phone card.', choices: [
    { id: 'talk', label: 'Step between them and talk it down', check: 'charm' },
    { id: 'backup', label: 'Call for backup and separate them' },
    { id: 'ignore', label: 'Look the other way', bad: true }] },
  { text: 'A man on your wing asks for help writing to his daughter. He cannot read well.', choices: [
    { id: 'help', label: 'Sit with him after lock-up and help' },
    { id: 'refer', label: 'Put him in touch with the education department' },
    { id: 'ignore', label: 'Tell him it is not your job', bad: true }] },
  { text: 'An inmate tells you, quietly, that he is being threatened.', choices: [
    { id: 'report', label: 'Report it and arrange a move' },
    { id: 'talk', label: 'Have a word with the man making threats', check: 'charm' },
    { id: 'ignore', label: 'Tell him to sort it out himself', bad: true }] },
];
export function shift() {
  if (acts().shift) return null;
  acts().shift = true;
  return rng.pick(SHIFTS);
}
export function handleShift(sh, choiceId) {
  const p = player();
  const ch = sh.choices.find((x) => x.id === choiceId);
  if (ch.bad) { adjustPerformance(-4); p.hidden.karma = clamp(p.hidden.karma - 2); return result(false, 'It was not dealt with. It will come back, worse.'); }
  const ok = !ch.check || rng.chance(clamp(p.stats.charm / 100 + 0.2, 0.2, 0.9));
  adjustPerformance(ok ? 5 : 1);
  if (ok) p.hidden.karma = clamp(p.hidden.karma + 2);
  return result(ok, ok ? 'Handled. Nobody hurt, and the wing settles.' : 'It took longer than it should, but nobody was hurt.', ok ? 'good' : 'neutral');
}
