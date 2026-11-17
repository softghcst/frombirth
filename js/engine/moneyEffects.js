// What a story scene can do with money, beyond handing over cash: save some
// of it, give or lend it to the person in the scene, or teach the player
// something. Every one of these moves real money through the same engines the
// money screens use, so a scene can never make or lose money on its own.
//   { type: 'money', op: 'save',  share }            a share of everyday money into savings
//   { type: 'money', op: 'spend', share }            a share of everyday money, spent
//   { type: 'money', op: 'give',  target, share|base }   to a member of the cast
//   { type: 'money', op: 'lend',  target, base }
//   { type: 'money', op: 'learn', value }            money sense
import { store, player, country } from '../state.js';
import { localMoney } from '../util.js';
import { accounts, deposit } from './banking.js';
import { giveMoney, lendMoney } from './family.js';
import { learn } from './achievements.js';
import { book } from './ledger.js';
import { cards, available } from './cards.js';

export function moneyEffect(e, ctx) {
  const p = player();
  const c = country();
  const shown = [];
  const cash = Math.max(0, Math.floor(p.finance.cash));
  const amount = e.base != null ? (e.card ? localMoney(e.base, c) : Math.min(cash, localMoney(e.base, c))) : Math.floor(cash * (e.share ?? 0));
  if (e.op === 'learn') { learn(e.value ?? 2, `scene:${e.why ?? 'general'}`); return shown; }
  if (!(amount > 0)) return shown;
  if (e.op === 'save') {
    const a = accounts().find((x) => x.matures == null && x.unlockAge == null && !x.joint && x.cur === c.currency.code);
    if (a && deposit(a.id, amount).ok) shown.push({ label: 'Saved', delta: amount, money: true });
    else ctx.note = 'You have no bank account to put it in, so it stays in your pocket.';
  } else if (e.op === 'spend') {
    // On a card, it is borrowed: the card takes it, while there is room, and everyday money is untouched.
    const card = e.card ? cards().find((k) => available(k) >= amount) : null;
    if (card) { card.balance += amount; book({ cat: 'leisure', src: 'scene', desc: e.what ?? 'Something you wanted' }); shown.push({ label: 'On your card', delta: amount, money: true }); return shown; }
    p.finance.cash -= amount;
    book({ cat: 'leisure', src: 'scene', desc: e.what ?? 'Something you wanted' });
    shown.push({ label: 'Cash', delta: -amount, money: true });
  } else if (e.op === 'give' || e.op === 'lend') {
    const n = store.state.npcs[ctx.cast?.[e.target]];
    if (!n?.alive) return shown;
    const r = e.op === 'give' ? giveMoney(n.id, amount) : lendMoney(n.id, amount, e.years ?? 3);
    if (r.ok) { shown.push({ label: e.op === 'give' ? 'Given' : 'Lent', delta: -amount, money: true }); if (e.op === 'give') p.flags.givenBase = (p.flags.givenBase ?? 0) + amount / c.currency.scale; } else ctx.note = r.text;
  }
  return shown;
}
