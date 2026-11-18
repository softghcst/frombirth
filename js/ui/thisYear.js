// "Your life this year": the plans that carry on by themselves, and the few
// things to set or celebrate. Shown at the top of the Pursuits tab.
import { player, country } from '../state.js';
import { esc, fmtMoney, localMoney } from '../util.js';
import { messageModal, pickModal, confirmModal } from './modals.js';
import * as plans from '../engine/plans.js';
import { skillOptions } from '../engine/skills.js';
import { accounts } from '../engine/banking.js';

const kv = (a, b) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;

/** The card. Empty for very young children, who have nothing to plan. */
export function thisYearCard() {
  const p = player();
  if (p.age < 5 || !p.alive) return '';
  const going = plans.ongoing(p);
  const celebrate = plans.occasions(p).filter((o) => !o.done);
  const buttons = [
    ['hobby', plans.plansOf(p).hobby ? 'Change your hobby focus' : 'Choose a hobby focus'],
    ...(p.age >= 16 ? [['savings', plans.plansOf(p).savings ? 'Change your yearly saving' : 'Save something every year']] : []),
    ...(celebrate.length ? [['celebrate', 'Celebrate something']] : []),
    ...(p.age >= 18 ? [['traditions', 'Family traditions']] : []),
  ];
  return `<div class="card"><h3>Your life this year</h3>
    ${going.length ? going.map(([a, b]) => kv(a, b)).join('') : '<p class="muted">Nothing is carrying on by itself yet. Plans you set here go on every year until you change them.</p>'}
    <div class="btn-stack" style="margin-top:10px">${buttons.map(([id, label]) => `<button class="btn" data-year-plan="${id}">${esc(label)}</button>`).join('')}</div>
    <p class="muted" style="margin-top:8px">These happen as you live the year, when you press Live another year.</p></div>`;
}

async function say(api, r) { api.changed(); await messageModal({ body: r.text, tone: r.tone }); }

/** Handles a tap on the card. */
export async function thisYearAction(id, api) {
  const p = player();
  const c = country();
  const pl = plans.plansOf(p);
  if (id === 'hobby') {
    const opts = skillOptions().flatMap((g) => g.skills).filter((s) => !s.tooYoung && !s.mastered);
    const main = await pickModal({ title: 'Your main passion', body: 'Practised through every year, from the year\'s own practice time.', options: [...opts.map((s) => ({ value: s.id, label: s.name, sub: s.started ? `${s.levelName} (${s.level}%)` : 'New to you' })), ...(pl.hobby ? [{ value: '__none', label: 'No hobby plan' }] : [])] });
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
  if (id === 'celebrate') {
    const occ = await pickModal({ title: 'What are you celebrating?', options: plans.occasions(p).map((o) => ({ value: o.id, label: o.name, disabled: o.done, sub: o.done ? 'Already celebrated this year.' : '' })) });
    if (!occ) return undefined;
    const people = plans.guestsFor();
    const fam = people.filter((n) => !['friend'].includes(n.role));
    const friends = people.filter((n) => n.role === 'friend');
    const g = await pickModal({ title: 'Who is coming?', options: [
      { value: 'family', label: 'Family', sub: fam.map((n) => n.firstName).join(', ') || 'Nobody nearby', disabled: !fam.length },
      { value: 'friends', label: 'Friends', sub: friends.map((n) => n.firstName).join(', ') || 'Nobody yet', disabled: !friends.length },
      { value: 'all', label: 'Everyone', sub: `${people.length} people` }, { value: 'none', label: 'Just me', sub: 'Quietly, your way.' }] });
    if (!g) return undefined;
    const guests = (g === 'family' ? fam : g === 'friends' ? friends : g === 'all' ? people : []).map((n) => n.id);
    const style = await pickModal({ title: 'What kind of celebration?', options: Object.entries(plans.STYLES).map(([k, s]) => ({ value: k, label: s.name, sub: p.age >= 18 ? fmtMoney(localMoney(s.cost, c), c) : 'Your family pays.' })) });
    return style ? say(api, plans.celebrate(occ, guests, style)) : undefined;
  }
  if (id === 'traditions') {
    const active = pl.traditions.filter((t) => t.active);
    const pick = await pickModal({ title: 'Family traditions', body: 'They come round by themselves every year, and carry on after you.', options: [
      ...active.map((t) => ({ value: `stop:${t.id}`, label: `Stop: ${t.name}`, sub: `${t.years} year${t.years === 1 ? '' : 's'}${t.inherited ? `, started by ${t.startedBy}` : ''}` })),
      ...plans.TRADITION_IDEAS.filter(([k]) => !active.some((t) => t.idea === k)).map(([k, name]) => ({ value: `start:${k}`, label: `Start: ${name}` }))] });
    if (!pick) return undefined;
    const [what, key] = pick.split(':');
    if (what === 'stop') return (await confirmModal({ title: 'Stop this tradition?', body: 'It stays in the family\'s history.', yes: 'Stop it' })) ? say(api, plans.stopTradition(key)) : undefined;
    const style = await pickModal({ title: 'How do you keep it?', options: Object.entries(plans.STYLES).map(([k, s]) => ({ value: k, label: s.name, sub: `${fmtMoney(localMoney(s.cost, c), c)} a year` })) });
    return style ? say(api, plans.startTradition(key, style)) : undefined;
  }
  return undefined;
}

