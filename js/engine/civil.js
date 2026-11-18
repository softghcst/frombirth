// Civil justice: disputes between people about money, homes and promises.
// A civil case is never a criminal one. Losing one means paying what a court
// orders; it does not give anyone a criminal record.
//
// Each case keeps the truth of the dispute (whether the claim is good) apart
// from what each side can show, and from what the court decides.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, log } from '../state.js';
import * as k from './cases.js';
import { DISPUTES, courtsFor } from '../data/justice.js';
import { LAWYERS } from '../data/crimes.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const year = () => store.state.year;
export const FILING_FEE = 120;

/** Civil cases the player is a party to, newest first. */
export const myClaims = () => Object.values(k.J().civil).filter((c) => c.claimantId === player().id || c.respondentId === player().id).sort((a, b) => b.year - a.year);
export const openClaims = () => myClaims().filter((c) => !['decided', 'settled', 'withdrawn'].includes(c.stage));

/** Disputes the player could bring now, given their life. */
export function claimOptions() {
  const p = player();
  if (p.age < 18 || p.legal.incarceration) return [];
  const renting = !p.homeId && !p.flags.livesWithParents;
  const worked = p.career.history.length > 0;
  return Object.entries(DISPUTES).map(([id, d]) => {
    let why = '';
    if (['deposit', 'repairs'].includes(id) && !renting) why = 'You are not renting.';
    if (id === 'wages' && !worked) why = 'You have not left a job.';
    if (id === 'rent') why = p.assets.some((a) => a.kind === 'property' && a.tenant) ? '' : 'You have no tenants.';
    if (id === 'boundary' && !p.homeId) why = 'You do not own a home.';
    if (openClaims().some((c) => c.kind === id)) why = 'You already have a case about this.';
    return { id, ...d, ok: !why, why };
  });
}

/**
 * Opens a case. merit: how good the claim really is (the truth of it).
 * @param {{claimantId:string, respondentId:string, kind:string, merit?:number}} o
 */
export function openClaim(o) {
  const d = DISPUTES[o.kind];
  const c = { id: k.newId('civil'), kind: o.kind, name: d.name, claimantId: o.claimantId, respondentId: o.respondentId, countryId: player().countryId,
    court: courtsFor(player().countryId).civil, year: year(), claim: localMoney(rng.int(d.claim[0], d.claim[1]), country()),
    truth: { merit: o.merit ?? rng.next() }, stage: 'complaint', history: [], offer: null, judgment: null, counsel: {} };
  // What each side can show depends on the truth of it, and on the paperwork.
  c.evidence = Math.round(clamp(c.truth.merit * 0.8 + rng.next() * 0.3, 0, 1) * 100) / 100;
  c.history.push({ year: year(), text: `${k.nameOf(c.claimantId)} filed a claim for ${fmtMoney(c.claim, country())}: ${d.name.toLowerCase()}.` });
  k.J().civil[c.id] = c;
  k.note(c.claimantId, 'civil', `Brought a civil claim: ${d.name.toLowerCase()}.`, c.id);
  k.note(c.respondentId, 'civil', `Was sued: ${d.name.toLowerCase()}.`, c.id);
  return c;
}

/** The player brings a claim. The other side is a person who stays in the world. */
export function bringClaim(kind) {
  const p = player();
  const opt = claimOptions().find((x) => x.id === kind);
  if (!opt?.ok) return { ...result(false, opt?.why || 'You cannot bring that claim.', 'neutral'), claim: null };
  const fee = localMoney(FILING_FEE, country());
  const other = k.civilian(p.countryId, { occupation: DISPUTES[kind].against, age: rng.int(30, 70) });
  other.savings = localMoney(rng.int(2000, 40000), country());
  const c = openClaim({ claimantId: p.id, respondentId: other.id, kind, merit: clamp(0.35 + rng.next() * 0.65, 0, 1) });
  if (!k.pay({ key: `filing:${c.id}`, kind: 'court_fee', amount: fee, payer: p.id, payee: 'court', caseId: c.id })) {
    delete k.J().civil[c.id];
    return { ...result(false, `The filing fee is ${fmtMoney(fee, country())}.`, 'neutral'), claim: null };
  }
  respond(c);
  const text = `You filed a claim against ${k.nameOf(other.id)} (${DISPUTES[kind].against.toLowerCase()}) in the ${c.court}.`;
  log(text);
  return { ...result(true, text, 'neutral'), claim: c };
}

/** Someone brings a claim against the player. */
export function claimAgainstPlayer(kind) {
  const p = player();
  const other = k.civilian(p.countryId, { occupation: DISPUTES[kind].against === 'Tenant' ? 'Landlord' : 'Claimant', age: rng.int(30, 70) });
  const c = openClaim({ claimantId: other.id, respondentId: p.id, kind, merit: rng.next() });
  c.stage = 'response';
  log(`${k.nameOf(other.id)} has filed a civil claim against you for ${fmtMoney(c.claim, country())}: ${c.name.toLowerCase()}. It is not a criminal matter.`, 'system', 'bad');
  return c;
}

/** The other side answers: some settle, some fight. */
function respond(c) {
  const offer = c.evidence >= 0.55 && rng.chance(0.6) ? Math.round(c.claim * (0.4 + c.evidence * 0.4)) : 0;
  c.stage = 'response';
  if (offer) {
    c.offer = { amount: offer, from: c.respondentId, year: year() };
    c.history.push({ year: year(), text: `${k.nameOf(c.respondentId)} offered to settle for ${fmtMoney(offer, country())}.` });
  } else c.history.push({ year: year(), text: `${k.nameOf(c.respondentId)} disputes the claim.` });
}

/** A lawyer for a civil claim: in proportion to what is at stake, so it is never more than the claim. */
export const civilFee = (c) => Math.max(localMoney(150, country()), Math.round(c.claim * 0.2));

/** What the player can do now in a case. */
export function claimActions(c) {
  if (['decided', 'settled', 'withdrawn'].includes(c.stage)) return [];
  const mine = c.claimantId === player().id;
  const out = [];
  if (c.offer && c.offer.from !== player().id) out.push({ id: 'accept', label: `Accept the offer of ${fmtMoney(c.offer.amount, country())}` });
  if (!mine && !c.offer) out.push({ id: 'offer', label: `Offer to settle for ${fmtMoney(Math.round(c.claim * 0.5), country())}` });
  if (!c.counsel[player().id]) out.push({ id: 'counsel', label: `Hire a lawyer (${fmtMoney(civilFee(c), country())})` });
  out.push({ id: 'hearing', label: 'Let the court decide' });
  if (mine) out.push({ id: 'withdraw', label: 'Withdraw the claim', danger: true });
  return out;
}

/** @param {'accept'|'offer'|'counsel'|'hearing'|'withdraw'} act */
export function actOnClaim(caseId, act) {
  const c = k.J().civil[caseId];
  const p = player();
  if (!c || !claimActions(c).some((a) => a.id === act)) return result(false, 'That is not possible now.', 'neutral');
  const cty = country();
  if (act === 'counsel') {
    const fee = civilFee(c);
    if (!k.pay({ key: `civil_fee:${c.id}:${p.id}`, kind: 'legal_fee', amount: fee, payer: p.id, payee: 'counsel', caseId: c.id })) return result(false, 'You cannot afford a lawyer.', 'neutral');
    c.counsel[p.id] = true;
    c.history.push({ year: year(), text: 'You instructed a lawyer.' });
    return result(true, 'A lawyer is on your side now. It improves how your case is put, not the facts of it.', 'neutral');
  }
  if (act === 'withdraw') {
    c.stage = 'withdrawn';
    c.history.push({ year: year(), text: 'The claim was withdrawn.' });
    return result(true, 'You withdrew the claim.', 'neutral');
  }
  if (act === 'accept') return settle(c, c.offer.amount);
  if (act === 'offer') {
    const amount = Math.round(c.claim * 0.5);
    // The claimant decides on the strength of their case.
    if (c.evidence < 0.6 && rng.chance(0.7)) return settle(c, amount);
    c.offer = { amount, from: p.id, year: year(), refused: true };
    c.history.push({ year: year(), text: `You offered ${fmtMoney(amount, cty)}. It was refused.` });
    return result(false, 'Your offer was refused. It will go to a hearing.', 'neutral');
  }
  return hearing(c);
}

function settle(c, amount) {
  k.pay({ key: `settlement:${c.id}`, kind: 'settlement', amount, payer: c.respondentId, payee: c.claimantId, caseId: c.id, allowDebt: true });
  c.stage = 'settled';
  c.judgment = { for: c.claimantId, amount, settled: true, year: year() };
  c.history.push({ year: year(), text: `Settled for ${fmtMoney(amount, country())}.` });
  k.note(c.claimantId, 'civil', `Settled ${c.name.toLowerCase()}.`, c.id);
  k.note(c.respondentId, 'civil', `Settled ${c.name.toLowerCase()}.`, c.id);
  const text = `The case is settled: ${fmtMoney(amount, country())} ${c.respondentId === player().id ? 'paid by you' : 'paid to you'}.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/** A judge decides, on the balance of probabilities. */
export function hearing(c) {
  const p = player();
  const lift = (c.counsel[c.claimantId] ? 0.08 : 0) - (c.counsel[c.respondentId] ? 0.08 : 0);
  const won = c.evidence + lift + (rng.next() - 0.5) * 0.2 >= 0.5;
  const amount = won ? Math.round(c.claim * clamp(0.6 + c.evidence * 0.4, 0, 1)) : 0;
  c.stage = 'decided';
  c.judgment = { for: won ? c.claimantId : c.respondentId, amount, year: year() };
  c.history.push({ year: year(), text: won ? `Judgment for the claimant: ${fmtMoney(amount, country())}.` : 'The claim was dismissed.' });
  if (won) k.pay({ key: `judgment:${c.id}`, kind: 'judgment', amount, payer: c.respondentId, payee: c.claimantId, caseId: c.id, allowDebt: true });
  const youWon = c.judgment.for === p.id;
  k.note(p.id, 'civil', `${c.name}: ${youWon ? 'decided in your favor' : 'decided against you'}.`, c.id);
  const text = youWon ? `The ${c.court} found for you${amount ? `: ${fmtMoney(amount, country())}` : ''}.` : `The ${c.court} found against you${amount ? `: you owe ${fmtMoney(amount, country())}` : ''}. It is a civil judgment, not a criminal record.`;
  log(text, 'system', youWon ? 'good' : 'bad');
  return result(youWon, text);
}

/** Yearly: an occasional claim against a renter. */
export function tickCivil() {
  const p = player();
  if (p.age >= 18 && !p.homeId && !p.flags.livesWithParents && !p.legal.incarceration && !openClaims().length && rng.chance(0.015)) claimAgainstPlayer('rent');
}
