// "Your life this year": the plans that carry on by themselves, and the few
// things to set or celebrate. Shown at the top of the Pursuits tab.
import { player, country } from '../state.js';
import { esc, fmtMoney, localMoney } from '../util.js';
import { messageModal, pickModal, confirmModal } from './modals.js';
import * as plans from '../engine/plans.js';
import { skillOptions } from '../engine/skills.js';
import { accounts } from '../engine/banking.js';
import { openMoments } from './moments.js';

const kv = (a, b) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;

/** The card. Empty for very young children, who have nothing to plan. */
export function thisYearCard() {
  const p = player();
  if (p.age < 5 || !p.alive) return '';
  const going = plans.ongoing(p);
  const buttons = [
    ['hobby', plans.plansOf(p).hobby ? 'Change hobby' : 'Pick a hobby'],
    ...(p.age >= 16 ? [['savings', plans.plansOf(p).savings ? 'Change savings' : 'Save each year']] : []),
    ['moments', 'Occasions and invitations'],
  ];
  return `<div class="card"><h3>Your life this year</h3>
    ${going.map(([a, b]) => kv(a, b)).join('')}
    <div class="btn-stack" style="margin-top:${going.length ? 10 : 2}px">${buttons.map(([id, label]) => `<button class="btn" data-year-plan="${id}">${esc(label)}</button>`).join('')}</div></div>`;
}

async function say(api, r) { api.changed(); await messageModal({ body: r.text, tone: r.tone }); }

/** Handles a tap on the card. */
export async function thisYearAction(id, api) {
  const p = player();
  const c = country();
  const pl = plans.plansOf(p);
  if (id === 'hobby') {
    const opts = skillOptions().flatMap((g) => g.skills).filter((s) => !s.tooYoung && !s.mastered);
    const main = await pickModal({ title: 'Your main passion', body: 'Practiced through every year, from the year\'s own practice time.', options: [...opts.map((s) => ({ value: s.id, label: s.name, sub: s.started ? `${s.levelName} (${s.level}%)` : 'New to you' })), ...(pl.hobby ? [{ value: '__none', label: 'No hobby plan' }] : [])] });
    if (!main) return undefined;
    if (main === '__none') return say(api, plans.setHobby(null));
    const second = await pickModal({ title: 'Something on the side?', cancel: 'Just the one', options: opts.filter((s) => s.id !== main).map((s) => ({ value: s.id, label: s.name })) });
    return say(api, plans.setHobby(main, second));
  }
  if (id === 'savings') {
    const list = accounts().filter((a) => a.closed == null && a.matures == null && !a.locked);
    if (!list.length) return messageModal({ body: 'You need a bank account to save into. You can open one in My Money (tap your bank balance).' });
    const acct = await pickModal({ title: 'Save every year', body: 'A standing deposit from your pocket into an account, each year you can afford it. Goals are set in My Money.', options: [
      ...list.map((a) => ({ value: a.id, label: a.name, sub: a.goal ? `Saving for ${a.goal.name.toLowerCase()}` : '' })), ...(pl.savings ? [{ value: '__none', label: 'Stop the standing deposit' }] : [])] });
    if (!acct) return undefined;
    if (acct === '__none') return say(api, plans.setSavings(null, 0));
    const y = await pickModal({ title: 'How much each year?', options: [500, 2000, 5000, 15000].map((b) => localMoney(b, c)).map((v) => ({ value: v, label: `${fmtMoney(v, c)} a year` })) });
    return y ? say(api, plans.setSavings(acct, y)) : undefined;
  }
  if (id === 'moments') return openMoments(api);
  return undefined;
}

