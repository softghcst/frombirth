// Insurance on what the player owns, and on their life.
//
// A policy is a contract with a price, an excess and a limit. A claim is paid
// only for a loss that really happened to the thing insured while the policy
// was in force, and only once. Health cover is separate (engine/systems.js).
// The insurers and their prices are invented (data/money.js).
//   p.finance.policies = [{ id, kind, insurer, assetId?, assetName?, premium, excess, cover, start, status, beneficiaryId?, claims }]
//   p.finance.losses   = [{ id, year, kind, assetId, assetName, amount, what, policyId, claimed }]
import { store, player, country, log } from '../state.js';
import { fmtMoney, localWage } from '../util.js';
import { INSURANCE, INSURERS } from '../data/money.js';
import { book } from './ledger.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const all = () => (player().finance.policies ??= []);
export const policies = () => all().filter((x) => x.status === 'active');
export const pastPolicies = () => all().filter((x) => x.status !== 'active');
export const policyFor = (assetId) => policies().find((x) => x.assetId === assetId) ?? null;
export const lifePolicy = () => policies().find((x) => x.kind === 'life') ?? null;
const kindOf = (asset) => (asset.kind === 'property' ? 'home' : asset.kind === 'vehicle' ? 'motor' : null);

/** The yearly chance an insurer prices a life at: low when young, steep when old. */
const lifeRate = (age) => Math.min(0.25, 0.0008 * Math.exp(0.085 * Math.max(0, age - 30)));

/** What a policy on this would cost today. */
export function quote(kind, { asset, mult } = {}) {
  const p = player();
  const rule = INSURANCE[kind];
  let reason = '';
  if (!rule) return { ok: false, reason: 'Nobody insures that.' };
  if (store.state.year < rule.since) reason = 'Nobody sells this kind of insurance yet.';
  else if (p.age < 18) reason = 'You need to be 18.';
  else if (kind === 'life') {
    if (lifePolicy()) reason = 'You already have life insurance.';
    else if (p.age > 70) reason = 'No insurer will start a policy at your age.';
    const cover = Math.round(localWage(30000, country()) * (mult ?? rule.covers[0]) / 1000) * 1000;
    return { ok: !reason, reason, kind, cover, excess: 0, premium: Math.max(1, Math.round(cover * lifeRate(p.age) * rule.load * (p.stats.health < 40 ? 1.5 : 1))) };
  }
  if (!asset || kindOf(asset) !== kind) reason = 'There is nothing of that kind to insure.';
  else if (policyFor(asset.id)) reason = 'It is already insured.';
  const value = asset?.value ?? 0;
  return { ok: !reason, reason, kind, cover: Math.round(value), excess: Math.round(value * rule.excess), premium: Math.max(1, Math.round(value * rule.premium)) };
}

/** Takes out a policy. The first year's premium is paid at once. */
export function takeOut(kind, opts = {}) {
  const p = player();
  const c = country();
  const q = quote(kind, opts);
  if (!q.ok) return result(false, q.reason, 'neutral');
  if (p.finance.cash < q.premium) return result(false, `The first year costs ${fmtMoney(q.premium, c)}. You do not have it.`, 'neutral');
  if (opts.beneficiaryId && !store.state.npcs[opts.beneficiaryId]?.alive) return result(false, 'Choose someone living.', 'neutral');
  p.finance.cash -= q.premium;
  const insurer = INSURERS[(all().length + p.age) % INSURERS.length];
  all().push({ id: `pol${all().length + 1}_${store.state.year}`, kind, insurer, assetId: opts.asset?.id ?? null, assetName: opts.asset?.name ?? null,
    premium: q.premium, excess: q.excess, cover: q.cover, start: store.state.year, paidYear: store.state.year, status: 'active', beneficiaryId: opts.beneficiaryId ?? null, claims: 0 });
  const what = kind === 'life' ? `your life for ${fmtMoney(q.cover, c)}` : `the ${lower(opts.asset.name)}`;
  const text = `${insurer} insured ${what}. It costs ${fmtMoney(q.premium, c)} a year${q.excess ? `, and you pay the first ${fmtMoney(q.excess, c)} of any claim` : ''}.`;
  log(text, 'system', 'neutral');
  book({ cat: 'insurance', src: 'action', desc: text });
  return result(true, text, 'neutral');
}

export function cancel(id) {
  const x = all().find((y) => y.id === id && y.status === 'active');
  if (!x) return result(false, 'That policy has already ended.', 'neutral');
  x.status = 'ended'; x.end = store.state.year;
  const text = `You cancelled your ${lower(INSURANCE[x.kind].name)} with ${x.insurer}.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/** Names who a life policy pays. With nobody named it pays the estate. */
export function nameBeneficiary(id, npcId) {
  const x = policies().find((y) => y.id === id && y.kind === 'life');
  if (!x) return result(false, 'There is no such policy.', 'neutral');
  const n = npcId ? store.state.npcs[npcId] : null;
  if (npcId && !n?.alive) return result(false, 'Choose someone living.', 'neutral');
  x.beneficiaryId = npcId ?? null;
  return result(true, n ? `Your life insurance will be paid to ${n.firstName} ${n.lastName}.` : 'Your life insurance will be paid to your estate.', 'neutral');
}

/**
 * Something the player owns has been damaged or lost. If it was insured at
 * the time, the loss is written down so that a claim can be made for it.
 * Called by the engines that do the damage, with the value before and after.
 */
export function recordLoss(asset, before, after, what) {
  const amount = Math.round(before - after);
  const pol = policyFor(asset.id);
  if (!pol || amount <= 0) return null;
  const list = (player().finance.losses ??= []);
  const loss = { id: `loss${list.length + 1}_${store.state.year}`, year: store.state.year, kind: pol.kind, assetId: asset.id, assetName: asset.name, amount, what, policyId: pol.id, claimed: false };
  list.push(loss);
  if (list.length > 12) list.shift();
  return loss;
}
/** Losses that could still be claimed for. */
export const openLosses = () => (player().finance.losses ?? []).filter((l) => !l.claimed && store.state.year - l.year <= 2);

/** What the insurer would pay for a loss, and why not if nothing. */
export function assess(lossId) {
  const loss = (player().finance.losses ?? []).find((l) => l.id === lossId);
  if (!loss) return { ok: false, reason: 'There is no record of that loss.', pay: 0 };
  if (loss.claimed) return { ok: false, reason: 'That claim has been settled already.', pay: 0 };
  if (store.state.year - loss.year > 2) return { ok: false, reason: 'It is too late to claim for that.', pay: 0 };
  const pol = all().find((x) => x.id === loss.policyId);
  if (!pol || pol.start > loss.year) return { ok: false, reason: 'It was not insured when it happened.', pay: 0 };
  if (loss.amount <= pol.excess) return { ok: false, reason: `The damage is less than your excess of ${fmtMoney(pol.excess, country())}.`, pay: 0, loss, pol };
  return { ok: true, reason: '', pay: Math.min(pol.cover, loss.amount - pol.excess), loss, pol };
}

/** Makes a claim for a recorded loss. Each loss can be paid once. */
export function claim(lossId) {
  const p = player();
  const c = country();
  const a = assess(lossId);
  if (!a.ok) {
    if (a.loss) a.loss.claimed = true; // looked at, and refused: it cannot be sent in again
    return result(false, a.reason, 'neutral');
  }
  a.loss.claimed = true; a.loss.paid = a.pay;
  a.pol.claims += 1;
  a.pol.premium = Math.round(a.pol.premium * 1.1); // a claim is remembered at renewal
  p.finance.cash += a.pay;
  const text = `${a.pol.insurer} paid ${fmtMoney(a.pay, c)} for the damage to the ${lower(a.loss.assetName)}: the loss of ${fmtMoney(a.loss.amount, c)}, less your excess.`;
  log(text, 'system', 'good');
  book({ cat: 'claim', src: 'action', desc: text });
  return result(true, text);
}

/** Yearly: premiums follow what the thing is worth; a policy that cannot be paid for lapses. */
export function tickInsurance() {
  const p = player();
  const c = country();
  let paid = 0;
  for (const x of policies()) {
    if (x.paidYear === store.state.year) continue;
    if (x.assetId) {
      const asset = p.assets.find((a) => a.id === x.assetId);
      if (!asset) { x.status = 'ended'; x.end = store.state.year; continue; } // sold, or gone
      const rule = INSURANCE[x.kind];
      x.cover = Math.round(asset.value); x.excess = Math.round(asset.value * rule.excess);
      x.premium = Math.max(1, Math.round(asset.value * rule.premium * 1.1 ** x.claims));
    } else if (x.kind === 'life') {
      x.premium = Math.max(x.premium, Math.round(x.cover * lifeRate(p.age) * INSURANCE.life.load));
    }
    if (p.finance.cash < x.premium) {
      x.status = 'lapsed'; x.end = store.state.year;
      log(`You could not pay for your ${lower(INSURANCE[x.kind].name)}. The policy has lapsed.`, 'system', 'bad');
      continue;
    }
    p.finance.cash -= x.premium; x.paidYear = store.state.year; paid += x.premium;
  }
  if (paid) log(`You paid ${fmtMoney(paid, c)} in insurance premiums.`);
}

/**
 * At death: a life policy pays once. To the person named, if they are alive,
 * which keeps it out of the estate; otherwise into the estate.
 * @returns {{to:?string, name:?string, amount:number}|null}
 */
export function settleLife() {
  const p = player();
  const x = lifePolicy();
  if (!x) return null;
  x.status = 'ended'; x.end = store.state.year; x.paidOut = x.cover;
  const n = x.beneficiaryId ? store.state.npcs[x.beneficiaryId] : null;
  if (n?.alive) {
    if (n.life) n.life.savings += x.cover; else n.savings = (n.savings ?? 0) + x.cover;
    return { to: n.id, name: `${n.firstName} ${n.lastName}`, amount: x.cover, how: 'life insurance' };
  }
  p.finance.cash += x.cover;
  book({ cat: 'claim', src: 'estate', desc: `Life insurance paid to the estate by ${x.insurer}` });
  return { to: null, name: null, amount: x.cover, how: 'life insurance' };
}
