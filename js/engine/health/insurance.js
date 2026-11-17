// Health insurance as a record: the policy (or public cover) a person has had,
// when it began and ended, and a claim for every bill, showing what was billed,
// what the insurer paid and what the patient paid.
//
// The rules of who is covered and what share they pay come from the existing
// cover model (engine/systems.js), which follows each country's health system,
// the player's job and any cover they buy. This file keeps the history of it.
// Private and employer insurers ask to approve expensive care first and now and
// then refuse; a refusal can be appealed once. Public systems do not refuse.
import { player, country, log } from '../../state.js';
import { localCost, fmtMoney } from '../../util.js';
import { cover } from '../systems.js';
import { healthFactor } from '../policy.js';
import { now, seeded, hashOf } from './util.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });

function book(p) {
  p.health.insurance ??= { policies: [], claims: [] };
  return p.health.insurance;
}

/** What kind of cover this is, in the record's terms. */
function kindOf(k, p) {
  if (p.legal.incarceration) return 'prison';
  if (p.age < 18) return 'child';
  if (!k.covered) return 'none';
  if (k.model.covers === 'everyone') return 'public';
  if (k.bought) return 'private';
  return 'employer';
}
const NAMES = { prison: 'Prison health service', child: 'Covered as a child', none: 'No cover', public: 'Public health system', employer: 'Health cover through work', private: 'Private health insurance' };

/**
 * The policy in force now. When cover changes (a new job, buying or cancelling
 * insurance, moving abroad, turning 18), the old policy is closed and a new one opened.
 */
export function policyNow(p = player()) {
  const ins = book(p);
  const k = cover(p);
  const kind = kindOf(k, p);
  const key = `${p.countryId}:${kind}`;
  const cur = ins.policies.find((x) => !x.endWk);
  if (cur?.key === key) { cur.share = k.share; cur.premium = k.premium ?? 0; return cur; }
  if (cur) cur.endWk = now(p);
  const pol = { id: `pol_${hashOf(p.id, key, now(p)).toString(36)}`, key, kind, name: NAMES[kind], countryId: p.countryId,
    system: k.model.name, share: k.share, premium: k.premium ?? 0, startWk: now(p), endWk: null };
  ins.policies.push(pol);
  if (ins.policies.length > 40) ins.policies.splice(0, ins.policies.length - 40);
  return pol;
}

/** The full price of something before anyone pays any of it. */
export const billedFor = (base, fee = 1) => (base <= 0 ? 0 : Math.round(localCost(base, country()) * healthFactor(country().id) * fee));

/** Bills at or above this (in base units) need the insurer's approval first. */
export const APPROVAL_OVER = 5000;

/**
 * Records a claim for one bill and works out who pays. Returns what the patient
 * owes. Called once per bill (charge() in util.js guards against repeats).
 */
export function claim(ref, base, patientShare, o = {}) {
  const p = player();
  const ins = book(p);
  const pol = policyNow(p);
  const billed = Math.max(patientShare, billedFor(base, o.fee));
  let insurer = Math.max(0, billed - patientShare);
  let status = insurer ? 'paid' : pol.kind === 'none' ? 'no cover' : 'patient share only';
  // Private and employer insurers check expensive care first, and occasionally refuse it.
  if (insurer && ['private', 'employer'].includes(pol.kind) && base >= APPROVAL_OVER && seeded('approve', p.id, ref).chance(0.12)) {
    status = 'refused';
    insurer = 0;
  }
  const c = { id: `clm_${hashOf(p.id, ref).toString(36)}`, ref, wk: now(p), what: o.what ?? ref, policyId: pol.id, billed, insurerPaid: insurer, patientPaid: billed - insurer, status, appealed: false };
  if (!ins.claims.some((x) => x.id === c.id)) ins.claims.push(c);
  if (ins.claims.length > 300) ins.claims.splice(0, ins.claims.length - 300);
  if (status === 'refused') log(`Your insurer refused to pay for ${c.what.toLowerCase()}: you were billed ${fmtMoney(c.patientPaid, country())}. You can appeal in My Health.`, 'system', 'bad');
  return c.patientPaid;
}

/** Appeal a refused claim, once. If it succeeds the insurer's share is refunded. */
export function appeal(claimId, p = player()) {
  const ins = book(p);
  const c = ins.claims.find((x) => x.id === claimId);
  if (!c || c.status !== 'refused') return result(false, 'There is nothing to appeal.', 'neutral');
  if (c.appealed) return result(false, 'You have already appealed this.', 'neutral');
  c.appealed = true;
  const pol = ins.policies.find((x) => x.id === c.policyId);
  const owed = Math.max(0, c.billed - Math.round(c.billed * (pol?.share ?? 1)));
  if (seeded('appeal', p.id, c.id).chance(0.55)) {
    c.status = 'paid on appeal';
    c.insurerPaid = owed;
    c.patientPaid = c.billed - owed;
    p.finance.cash += owed;
    return result(true, `The appeal succeeded. ${fmtMoney(owed, country())} is refunded to you.`, 'good');
  }
  c.status = 'refusal upheld';
  return result(false, 'The insurer upheld its refusal. You could take it further outside the game; here, the bill stands.', 'bad');
}

/** For My Health: the policy now, earlier ones, and recent claims. */
export function coverSummary(p = player()) {
  const ins = book(p);
  const k = cover(p);
  return { now: policyNow(p), how: k.how, canBuy: k.canBuy, bought: k.bought, price: k.price ?? k.premium, policies: [...ins.policies].reverse(),
    claims: [...ins.claims].reverse().slice(0, 30), totals: ins.claims.reduce((t, c) => ({ billed: t.billed + c.billed, insurer: t.insurer + c.insurerPaid, you: t.you + c.patientPaid }), { billed: 0, insurer: 0, you: 0 }) };
}

