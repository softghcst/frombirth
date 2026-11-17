// My Money: everything the player has and owes, in one place. Every figure
// on it is read from the life as it stands: the ledger, the bank accounts,
// the debts, the holdings and the will. Nothing here is an example.
import { store, player, country } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import { openModal, messageModal, pickModal, confirmModal, inputModal } from './modals.js';
import * as bank from '../engine/banking.js';
import { fmtExact } from '../engine/banking.js';
import * as loans from '../engine/loans.js';
import * as credit from '../engine/credit.js';
import * as mkt from '../engine/market.js';
import * as sys from '../engine/systems.js';
import * as last from '../engine/death.js';
import * as fx from '../engine/currency.js';
import { canRetire, pensionEstimate } from '../engine/career.js';
import { netWorth } from '../engine/finance.js';
import { ledgerOf, effect, yearTotals, fromMinor, KEEP_YEARS } from '../engine/ledger.js';
import { CATEGORIES, GOAL_KINDS, PRODUCTS } from '../data/money.js';
import { SECURITY_KINDS } from '../data/securities.js';
import * as cards from '../engine/cards.js';
import * as ins from '../engine/insurance.js';
import * as ret from '../engine/retirement.js';
import * as fam from '../engine/family.js';
import * as tr from '../engine/trusts.js';
import * as biz from '../engine/business.js';
import * as ach from '../engine/achievements.js';
import { roleLabel } from '../engine/relationships.js';
import { INSURANCE, INSOLVENCY, PENSION_PLAN, CARDS } from '../data/money.js';

/** An exact amount, without the small change when there is none. */
const ex = (minor, cur) => fmtExact(minor, cur).replace(/\.0+$/, '');
const kv = (rows) => rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const pct = (x) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;
const bar = (share, tone = '') => `<span class="mm-bar ${tone}" role="img" aria-label="${Math.round(Math.max(0, Math.min(1, share)) * 100)} per cent"><i style="width:${Math.round(Math.max(0, Math.min(1, share)) * 100)}%"></i></span>`;
const units = (minor, cur) => fromMinor(minor, cur);
/** A round amount in any currency. */
const money = (n, cur) => fx.fmt(n, cur);

/** Asks for a whole amount up to a limit. Resolves the amount, or null. */
async function askAmount({ title, body, max, cur, least = 1 }) {
  max = Math.floor(max);
  if (max < least) { await messageModal({ body: least > 1 ? `It takes at least ${money(least, cur)}.` : 'There is nothing to move.' }); return null; }
  const round = (n) => { const m = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, n))) - 1); return Math.floor(n / m) * m; };
  const picks = [...new Set([0.1, 0.25, 0.5].map((s) => round(max * s)).filter((n) => n >= least && n < max))];
  const choice = await pickModal({ title, body, options: [
    ...picks.map((n) => ({ value: n, label: money(n, cur) })),
    { value: max, label: `All of it: ${money(max, cur)}` },
    { value: 'other', label: 'Another amount' }] });
  if (choice == null) return null;
  if (choice !== 'other') return choice;
  const text = await inputModal({ title, label: `How much? (${least > 1 ? `${money(least, cur)} to ` : 'up to '}${money(max, cur)})`, maxLength: 15 });
  if (text == null) return null;
  const n = Math.floor(Number(text.replace(/[^0-9.]/g, '')));
  if (!(n >= least) || n > max) { await messageModal({ body: `Choose an amount between ${money(least, cur)} and ${money(max, cur)}.` }); return null; }
  return n;
}

// ---------- Sections ----------

const SECTIONS = [
  ['overview', 'Overview', () => true],
  ['accounts', 'Accounts', () => true],
  ['budget', 'Budget', (p) => p.age >= 16],
  ['debt', 'Credit & debt', (p) => p.age >= 18 || p.finance.loans.length > 0],
  ['invest', 'Investments', (p) => p.age >= 18 || p.assets.some((a) => a.kind === 'security')],
  ['cover', 'Insurance', (p) => p.age >= 18],
  ['goals', 'Goals', () => true],
  ['household', 'Household', (p) => p.age >= 18],
  ['business', 'Business', (p) => p.age >= 18 || biz.businesses().length > 0],
  ['retire', 'Retirement', (p) => p.age >= 18],
  ['estate', 'Estate', () => last.canWriteWill()],
  ['family', 'Family legacy', () => (store.state.familyMoney ?? []).length > 0],
  ['awards', 'Milestones', (p) => p.age >= 14],
  ['history', 'History', () => true],
];

function txRow(L, t) {
  const { net, moved } = effect(L, t);
  const cur = Object.keys(net)[0] ?? Object.keys(moved)[0] ?? L.home;
  const n = net[cur] ?? 0;
  const inside = n === 0;
  const amount = inside ? `↔ ${ex(moved[cur] ?? 0, cur)}` : `${n > 0 ? '+' : ''}${ex(n, cur)}`;
  return `<div class="mm-tx"><div class="main"><strong>${esc(t.desc)}</strong><small>${esc(CATEGORIES[t.cat]?.name ?? t.cat)} · ${t.year}, age ${t.age}</small></div>
    <div class="amt ${inside ? '' : n > 0 ? 'in' : 'out'}">${esc(amount)}</div></div>`;
}

function overviewHtml() {
  const c = country();
  const o = bank.overview();
  const L = ledgerOf();
  const stat = (label, value, cls = '') => `<div class="mm-stat ${cls}"><small>${esc(label)}</small><strong>${esc(fmtMoney(value, c))}</strong></div>`;
  const goals = bank.goalList().filter((g) => g.status === 'active');
  const recent = L.tx.slice(-5).reverse();
  const own = o.property + o.vehicles + o.other;
  return `
    <div class="mm-grid">
      ${stat('Everyday money', o.cash, o.cash < 0 ? 'neg' : '')}
      ${stat('In the bank', o.bank)}
      ${o.foreign ? stat('In other currencies', o.foreign) : ''}
      ${stat('Investments', o.investments)}
      ${stat('Property and vehicles', own)}
      ${o.business ? stat('Your businesses', o.business) : ''}
      ${o.lent ? stat('Owed to you', o.lent) : ''}
      ${stat('Debts', o.liabilities, o.liabilities ? 'neg' : '')}
    </div>
    <div class="card mm-worth"><small>Net worth</small><strong class="${o.netWorth < 0 ? 'neg' : ''}">${esc(fmtMoney(netWorth(store.state), c))}</strong>
      <p class="muted">Everything you have, less everything you owe. Property, vehicles and investments are counted at what they would fetch today: an estimate, and not money you can spend.</p></div>
    <div class="card"><h3>This year so far</h3>
      ${kv([['Money in', fmtMoney(o.income, c)], ['Money out', fmtMoney(o.spent, c)], ['A month, on average', `${fmtMoney(o.income / 12, c)} in · ${fmtMoney(o.spent / 12, c)} out`]])}
      <p class="muted" style="margin-top:6px">Borrowing, moving money between your accounts and buying things you still own are not counted as money in or out.</p></div>
    ${goals.length ? `<div class="card"><h3>What you are saving for</h3>${goals.map((g) => `<div class="mm-line"><span>${esc(g.name)}</span><span>${esc(ex(g.saved, g.cur))} of ${esc(ex(g.target, g.cur))}</span></div>${bar(g.share, 'good')}`).join('')}</div>` : ''}
    <div class="card"><h3>Lately</h3>${recent.length ? recent.map((t) => txRow(L, t)).join('') : '<p class="muted">Nothing has moved yet.</p>'}</div>`;
}

function accountsHtml() {
  const p = player();
  const c = country();
  const list = bank.accounts();
  const holdings = fx.balances().filter((b) => !b.home);
  const rows = list.map((a) => `
    <button class="row" data-account="${a.id}">
      <div class="avatar glyph">${a.matures != null ? '🔒' : a.product === 'current' || a.product === 'student' ? '💳' : '🏦'}</div>
      <div class="main"><strong>${esc(a.name)}</strong><small>${esc(a.bank.name)} · ${a.cur}${a.rateBp ? ` · ${(a.rateBp / 100).toFixed(2)}% a year` : ''}${a.goal ? ` · for ${esc(lower(a.goal.name))}` : ''}${a.joint ? ` · ${Math.round(a.share * 100)}% yours` : ''}${a.beneficiary ? ' · someone named on it' : ''}</small></div>
      <div class="side">${esc(ex(a.bal, a.cur))}</div>
    </button>`).join('');
  const closed = bank.closedAccounts();
  const can = bank.offers().some((o) => o.products.some((x) => x.ok));
  return `
    <div class="card"><h3>Everyday money</h3>
      ${kv([[`Cash (${c.currency.code})`, fmtMoney(p.finance.cash, c)], ...holdings.map((b) => [`Held in ${b.code}`, `${fx.fmt(b.amount, b.code)} (about ${fmtMoney(b.worth, c)})`])])}
      <p class="muted" style="margin-top:6px">What you spend from. Wages arrive here and bills leave from here.</p></div>
    ${rows ? `<div class="section-label">Your bank accounts</div>${rows}` : `<p class="empty">You have no bank account${p.age < 7 ? ' yet. You are a little young.' : '.'}</p>`}
    <div class="btn-stack">
      <button class="btn primary" data-act="open" ${can ? '' : 'disabled'}>Open an account</button>
      ${list.length > 1 ? '<button class="btn" data-act="between">Move money between accounts</button>' : ''}
    </div>
    ${closed.length ? `<div class="card" style="margin-top:14px"><h3>Closed accounts</h3>${kv(closed.map((a) => [`${a.name} (${a.cur})`, `opened ${a.opened}, closed ${a.closed}`]))}</div>` : ''}
    <p class="muted mm-note">The banks in Pathways are invented, and so are their rates.</p>`;
}

function budgetHtml() {
  const c = country();
  const b = bank.budgetView();
  const top = Math.max(1, ...b.rows.map((r) => Math.max(r.actual, r.limit ?? 0)));
  const rows = b.rows.map((r) => `
    <button class="mm-budget" data-limit="${r.cat}">
      <span class="mm-line"><span>${esc(r.name)}</span><span>${esc(fmtMoney(r.actual, c))}${r.limit != null ? ` of ${esc(fmtMoney(r.limit, c))}` : ''}</span></span>
      ${bar(r.limit != null ? r.actual / Math.max(1, r.limit) : r.actual / top, r.limit != null && r.actual > r.limit ? 'bad' : '')}
    </button>`).join('');
  return `
    <div class="card"><h3>${b.year}: money in</h3>
      ${b.incomeBy.length ? kv(b.incomeBy.map((x) => [x.name, fmtMoney(x.amount, c)])) : '<p class="muted">Nothing has come in this year.</p>'}
      <div class="kv"><span>Total</span><span><strong>${esc(fmtMoney(b.income, c))}</strong></span></div></div>
    <div class="card"><h3>${b.year}: money out</h3>
      ${rows || '<p class="muted">Nothing has been spent this year.</p>'}
      ${b.fixed.length ? `<div style="margin-top:8px">${kv(b.fixed.map((x) => [x.name, fmtMoney(x.actual, c)]))}</div>` : ''}
      <div class="kv"><span>Total</span><span><strong>${esc(fmtMoney(b.spent, c))}</strong></span></div>
      <p class="muted" style="margin-top:6px">Tap a line to set the most you mean to spend on it in a year. You will be told at the end of each year how you did.</p></div>
    <div class="card"><h3>What was left</h3>
      ${kv([['Money in, less money out', fmtMoney(b.left, c)], ['Moved into bank accounts', fmtMoney(b.saved, c)]])}</div>`;
}

function debtHtml() {
  const p = player();
  const c = country();
  const s = standingNow();
  const mortgages = p.assets.filter((a) => a.mortgage);
  const total = p.finance.loans.reduce((x, l) => x + l.principal, 0) + mortgages.reduce((x, a) => x + a.mortgage.principal, 0) + cards.cardDebt();
  const cardRows = cards.cards().map((k) => `<button class="row" data-card="${k.id}"><div class="avatar glyph">💳</div>
      <div class="main"><strong>${esc(k.name)}</strong><small>${(k.rateBp / 100).toFixed(1)}% on what is carried · limit ${esc(fmtMoney(k.limit, c))} · ${k.autopay === 'full' ? 'paid in full' : 'minimum paid'} each year</small></div>
      <div class="side">${esc(fmtMoney(k.balance, c))}</div></button>`).join('');
  const offer = cards.cardOffer();
  const law = INSOLVENCY[loans.insolvencyOf()];
  const loanRows = p.finance.loans.map((l) => {
    const sch = loans.loanSchedule(l);
    return `<button class="row" data-loan="${l.id}"><div class="avatar glyph">📄</div>
      <div class="main"><strong>${esc(l.kind.charAt(0).toUpperCase() + l.kind.slice(1))} loan</strong><small>${(l.rate * 100).toFixed(1)}% a year · ${l.yearsLeft} ${l.yearsLeft === 1 ? 'year' : 'years'} left · about ${esc(fmtMoney(sch.rows[0]?.payment ?? 0, c))} this year</small></div>
      <div class="side">${esc(fmtMoney(l.principal, c))}</div></button>`;
  }).join('');
  const mortRows = mortgages.map((a) => `<div class="row"><div class="avatar glyph">🏠</div>
      <div class="main"><strong>Mortgage: ${esc(lower(a.name))}</strong><small>${(a.mortgage.rate * 100).toFixed(1)}% · ${a.mortgage.yearsLeft} years left · ${esc(fmtMoney(a.mortgage.payment, c))} a year · secured on the property</small></div>
      <div class="side">${esc(fmtMoney(a.mortgage.principal, c))}</div></div>`).join('');
  const order = (rule) => loans.payoffOrder(rule).map((l) => `${l.kind} (${fmtMoney(l.principal, c)}, ${(l.rate * 100).toFixed(0)}%)`).join(' → ');
  return `
    <div class="card"><h3>Your standing with lenders</h3>
      <p class="muted" style="margin-bottom:8px">${esc(s.line)}</p>
      ${s.standing != null ? `<div class="mm-line"><span>Pathways standing</span><span><strong>${s.standing} of 100 · ${esc(s.band)}</strong></span></div>${bar(s.standing / 100, s.standing >= 65 ? 'good' : s.standing < 45 ? 'bad' : '')}` : s.band ? kv([[s.name, s.band]]) : ''}
      ${kv([['Years of paying on time', String(s.onTime)], ...s.marks.slice(-5).reverse().map((m) => [`${m.year}, age ${m.age}`, credit.markName(m.kind)])])}
      <p class="muted" style="margin-top:6px">${s.standing != null ? 'This is a measure made up for the game, from what has actually happened in this life. It is not a real credit score and predicts nothing outside the game.' : 'There is no number here, because nobody keeps one.'}</p></div>
    ${total || cardRows ? `<div class="section-label">What you owe: ${esc(fmtMoney(total, c))}</div>${cardRows}${loanRows}${mortRows}` : '<p class="empty">You owe nothing.</p>'}
    ${p.finance.loans.length > 1 ? `<div class="card"><h3>Which to clear first</h3>
      ${kv([['Highest interest first', order('rate')], ['Smallest first', order('size')]])}
      <p class="muted" style="margin-top:6px">The first costs least in interest. The second gives an early win. Neither suits everyone.</p></div>` : ''}
    ${loans.isBankrupt() ? `<p class="muted mm-note">You are bankrupt until age ${p.flags.bankruptUntil}. No bank will lend to you until then.</p>` : ''}
    ${p.age >= 18 ? `<div class="btn-stack"><button class="btn" data-link="borrow">Borrow money</button>
      <button class="btn" data-act="card" ${offer.ok ? '' : 'disabled'}>Apply for a credit card${offer.ok ? `<small style="display:block;font-weight:400">${esc(offer.name)}, limit ${esc(fmtMoney(offer.limit, c))}, ${(offer.rateBp / 100).toFixed(1)}% a year</small>` : `<small style="display:block;font-weight:400">${esc(offer.reason)}</small>`}</button></div>` : ''}
    <div class="card" style="margin-top:14px"><h3>If you could not pay</h3><p class="muted">${esc(law.name)}. ${esc(law.line)}</p>
      <p class="muted" style="margin-top:6px">A rule made for the game, not a description of the law anywhere.</p></div>`;
}

function investHtml() {
  const c = country();
  const held = mkt.quotes().filter((q) => q.held);
  const assets = player().assets.filter((a) => a.kind === 'security');
  const cost = assets.reduce((s, a) => s + a.costBasis, 0);
  const value = mkt.portfolioValue();
  const byKind = SECURITY_KINDS.map((k) => ({ name: k.name, value: held.filter((q) => q.kind === k.id).reduce((s, q) => s + q.held, 0) })).filter((k) => k.value > 0);
  const rows = held.map((q) => { const a = assets.find((x) => x.catalogId === q.id); return `
    <div class="mm-tx"><div class="main"><strong>${esc(q.name)}</strong><small>Paid ${esc(fmtMoney(a.costBasis, c))} · ${pct(q.change)} this year</small></div>
      <div class="amt ${q.gain >= 0 ? 'in' : 'out'}">${esc(fmtMoney(q.held, c))}<small>${pct(q.gain)}</small></div></div>`; }).join('');
  return `
    ${held.length ? `<div class="card"><h3>Your holdings</h3>
      ${kv([['Worth today', fmtMoney(value, c)], ['What you paid', fmtMoney(cost, c)], [value >= cost ? 'Gain, on paper' : 'Loss, on paper', fmtMoney(Math.abs(value - cost), c)]])}
      <p class="muted" style="margin:6px 0 10px">A gain on paper is not money until you sell, and can be gone by next year.</p>${rows}</div>
    <div class="card"><h3>How it is spread</h3>${byKind.map((k) => `<div class="mm-line"><span>${esc(k.name)}</span><span>${Math.round(k.value / value * 100)}%</span></div>${bar(k.value / value)}`).join('')}</div>`
    : '<p class="empty">You hold no investments. Nobody has to.</p>'}
    <div class="btn-stack"><button class="btn" data-link="invest">Go to the market</button></div>
    <p class="muted mm-note">The market in Pathways is a simulation with invented companies. Prices move once a year, down as well as up.</p>`;
}

function coverHtml() {
  const c = country();
  const p = player();
  const k = sys.cover();
  const list = ins.policies();
  const losses = ins.openLosses();
  const who = (id) => { const n = store.state.npcs[id]; return n ? `${n.firstName} ${n.lastName}` : 'your estate'; };
  const rows = list.map((x) => `<button class="row" data-policy="${x.id}"><div class="avatar glyph">${x.kind === 'home' ? '🏠' : x.kind === 'motor' ? '🚗' : '🕊️'}</div>
      <div class="main"><strong>${esc(INSURANCE[x.kind].name)}${x.assetName ? `: ${esc(lower(x.assetName))}` : ''}</strong><small>${esc(x.insurer)} · ${x.kind === 'life' ? `pays ${esc(fmtMoney(x.cover, c))} to ${esc(who(x.beneficiaryId))}` : `you pay the first ${esc(fmtMoney(x.excess, c))}`}</small></div>
      <div class="side">${esc(fmtMoney(x.premium, c))}<br>a year</div></button>`).join('');
  const lossRows = losses.map((l) => { const a = ins.assess(l.id); return `<button class="row" data-loss="${l.id}"><div class="avatar glyph">📋</div>
      <div class="main"><strong>${l.year}: the ${esc(lower(l.assetName))}</strong><small>${esc(l.what)} · a loss of ${esc(fmtMoney(l.amount, c))} · ${a.ok ? `a claim would pay ${esc(fmtMoney(a.pay, c))}` : esc(a.reason)}</small></div>
      <div class="side">Claim</div></button>`; }).join('');
  const insurable = p.assets.filter((a) => (a.kind === 'property' || a.kind === 'vehicle') && !ins.policyFor(a.id));
  return `<div class="card"><h3>Health cover</h3>
      ${kv([['System here', k.model.name], ['Are you covered?', k.covered ? 'Yes' : 'No'], ['Your share of a bill', `${Math.round(k.share * 100)}%`], ...(k.premium ? [['What it costs you a year', fmtMoney(k.premium, c)]] : [])])}
      <p class="muted" style="margin-top:6px">${esc(k.how)} It is arranged when you see the doctor, from the Self tab.</p></div>
    ${lossRows ? `<div class="section-label">Losses you can claim for</div>${lossRows}` : ''}
    ${rows ? `<div class="section-label">Your policies</div>${rows}` : '<p class="empty">You have no other insurance.</p>'}
    <div class="btn-stack">
      ${insurable.length ? '<button class="btn" data-act="insure">Insure a property or vehicle</button>' : ''}
      ${ins.quote('life').ok ? '<button class="btn" data-act="life">Take out life insurance</button>' : ''}
    </div>
    <p class="muted mm-note">A claim is paid only for damage that really happened to the thing insured, while it was insured, and only once. Insurance takes some risks off you; it does not take them all.</p>`;
}

function goalsHtml() {
  const list = bank.goalList();
  const label = { active: 'Saving', paused: 'Paused', completed: 'Reached', abandoned: 'Given up' };
  const rows = list.map((g) => `
    <button class="mm-budget" data-goal="${g.id}" ${g.status === 'completed' || g.status === 'abandoned' ? 'disabled' : ''}>
      <span class="mm-line"><span><strong>${esc(g.name)}</strong></span><span>${label[g.status]}${g.status === 'completed' ? ` in ${g.doneYear}` : ''}</span></span>
      <span class="mm-line"><span class="muted">${g.account && g.account.closed == null ? `${esc(g.account.name)}, ${esc(g.account.bank.name)}` : 'Its account is closed'}${g.deadlineAge ? ` · by age ${g.deadlineAge}` : ''}</span><span>${esc(ex(g.saved, g.cur))} of ${esc(ex(g.target, g.cur))}</span></span>
      ${bar(g.share, g.status === 'completed' ? 'good' : '')}
    </button>`).join('');
  return `${rows ? `<div class="card">${rows}</div>` : '<p class="empty">You are not saving for anything in particular.</p>'}
    <div class="btn-stack"><button class="btn primary" data-act="goal" ${bank.accounts().some((a) => !a.goal) ? '' : 'disabled'}>Save for something</button></div>
    <p class="muted mm-note">A goal is tied to one bank account, and is reached when the money is really in it. ${bank.accounts().some((a) => !a.goal) ? '' : 'Open an account to save into first.'}</p>`;
}

function retireHtml() {
  const p = player();
  const c = country();
  const o = bank.overview();
  const k = p.career;
  const own = Math.max(0, o.cash) + o.bank + o.investments;
  const pension = k.retired ? k.pensionPerYear : pensionEstimate();
  const gap = Math.max(0, o.spent - pension);
  return `<div class="card"><h3>${k.retired ? 'Your retirement' : 'If you stopped work today'}</h3>
      ${kv([[k.retired ? 'Pension' : 'Pension you have earned so far', `${fmtMoney(pension, c)} a year`],
    ...(k.retired ? [] : [['Could you retire now?', canRetire() ? 'Yes' : k.careerId ? 'Not yet' : 'You have no job to retire from']]),
    ['Money of your own', fmtMoney(own, c)], ['What a year costs you now', fmtMoney(o.spent, c)],
    ['A year, less the pension', fmtMoney(gap, c)],
    ['Your own money would last', gap <= 0 ? 'The pension covers it' : o.spent ? `about ${Math.floor(own / gap)} ${Math.floor(own / gap) === 1 ? 'year' : 'years'}` : 'No spending recorded yet']])}
      <p class="muted" style="margin-top:6px">A rough sum, not a promise: it takes this year's spending and today's prices, and assumes nothing changes. Things change. Property is left out, because you have to live somewhere.</p></div>
    ${planHtml()}
    <p class="muted mm-note">The pension above comes from the years you have worked (Work tab). A plan of your own is on top of it.</p>`;
}

function planHtml() {
  const c = country();
  const pl = ret.plan();
  const can = ret.canOpenPlan();
  if (!pl) return `<div class="card"><h3>A pension plan of your own</h3>
      <p class="muted">A share of your pay goes in each year and is invested. ${ret.planKind() === 'workplace' ? `While you hold a full-time job your employer adds half as much again, on the first ${Math.round(PENSION_PLAN.matchUpTo * 100)}% of your pay. ` : 'Nobody else pays in here. '}It is locked until you are ${PENSION_PLAN.unlockAge}, and it can fall as well as rise.</p>
      <div class="btn-stack" style="margin-top:10px"><button class="btn primary" data-act="plan" ${can.ok ? '' : 'disabled'}>Start a pension plan${can.ok ? '' : `<small style="display:block;font-weight:400">${esc(can.reason)}</small>`}</button></div></div>`;
  const pr = ret.projection();
  return `<div class="card"><h3>Your pension plan</h3>
      ${kv([['In the plan', ex(pl.account.bal, pl.account.cur)], ['You pay in', pl.current ? `${Math.round(pl.rate * 100)}% of your pay` : `Nothing: it is in ${pl.account.cur}, from where you used to live`],
    ...(pr.yearly ? [['Going in each year', fmtMoney(pr.yearly, c)]] : []), ['Invested', `${Math.round(ret.equityShare(player().age) * 100)}% shares, the rest bonds`],
    [pl.account.locked ? `Locked until you are ${PENSION_PLAN.unlockAge}` : 'Yours to draw on', pl.account.locked ? `${pr.years} ${pr.years === 1 ? 'year' : 'years'} to go` : 'From Accounts']])}
      ${pr.years > 0 ? `<div class="section-label">What it might be at ${pr.at}</div>
      ${kv([['If it barely grows', fx.fmt(pr.low, pl.account.cur)], ['If it grows steadily', fx.fmt(pr.mid, pl.account.cur)], ['If the markets are kind', fx.fmt(pr.high, pl.account.cur)]])}
      <p class="muted" style="margin-top:6px">Three guesses, not a forecast. They assume your pay and what you put in stay as they are. The real figure will be none of these.</p>` : ''}
      ${pl.current ? '<div class="btn-stack" style="margin-top:10px"><button class="btn" data-act="planrate">Change how much you pay in</button></div>' : ''}</div>`;
}

function estateHtml() {
  const c = country();
  const e = last.estatePlan();
  const things = (s) => (s.items.length ? ` + ${s.items.map((it) => (it.kind === 'business' ? it.name : lower(it.name))).join(', ')}` : '');
  const inBank = bank.bankWorth();
  return `<div class="card"><h3>Your will</h3>
      <p class="muted" style="margin-bottom:8px">${esc(last.willSummary())}</p>
      ${e.gross <= 0 && !e.shares.length ? kv([['If you died today', 'There would be nothing to leave']]) : kv([
    ['Everything, less debts', fmtMoney(e.gross, c)], ['Estate tax', fmtMoney(e.tax, c)],
    ...e.shares.map((s) => [`${s.name} (${s.role.toLowerCase()})`, `${fmtMoney(s.amount, c)}${things(s)}`]),
    ...(e.charity ? [['To charity', fmtMoney(e.charity, c)]] : []), ...(e.lost ? [['Lost in the garden', fmtMoney(e.lost, c)]] : []), ...(e.toState ? [['To the state', fmtMoney(e.toState, c)]] : [])])}
    </div>
    <div class="card"><h3>What happens to your accounts</h3>
      <p class="muted">${inBank ? `Your bank accounts hold ${esc(fmtMoney(inBank, c))}. ` : ''}When you die they are closed. An account held jointly, or with someone named on it, goes straight to that person; the rest joins your estate, once. Debts are paid from the estate; nobody inherits them as their own. Property, vehicles and businesses pass on as they are.</p></div>
    ${outsideHtml()}
    <div class="btn-stack"><button class="btn" data-link="will">Change your will</button>
      ${tr.trustCandidates().length ? '<button class="btn" data-act="trust">Set up a trust</button>' : ''}</div>
    <p class="muted mm-note">${last.reservedShare() ? `The law here keeps ${Math.round(last.reservedShare() * 100)}% of an estate for your children, whatever a will says. ` : ''}Trusts and reserved shares are simple rules made for the game, not the law of any country.</p>`;
}

function outsideHtml() {
  const c = country();
  const name = (id) => { const n = store.state.npcs[id]; return n?.alive ? `${n.firstName} ${n.lastName}` : null; };
  const rows = [];
  for (const a of bank.accounts()) { const to = name(a.joint ?? a.beneficiary); if (to && a.bal) rows.push([`${a.name}: ${ex(a.bal, a.cur)}`, `to ${to}${a.joint ? ', the other owner' : ''}`]); }
  const life = ins.lifePolicy();
  if (life) rows.push([`Life insurance: ${fmtMoney(life.cover, c)}`, name(life.beneficiaryId) ? `to ${name(life.beneficiaryId)}` : 'into your estate']);
  const trusts = tr.trusts().map((t) => `<button class="row" data-trust="${t.id}"><div class="avatar glyph">🗝️</div>
      <div class="main"><strong>${esc(t.name)}</strong><small>Theirs at ${t.releaseAge}${name(t.beneficiaryId) ? ` (now ${store.state.npcs[t.beneficiaryId].age})` : ''} · held by a trustee · not yours any more</small></div>
      <div class="side">${esc(ex(t.bal, t.cur))}</div></button>`).join('');
  const held = tr.heldForYou().map((t) => [`${t.name}: ${ex(t.bal, t.cur)}`, `yours at ${t.releaseAge}`]);
  return `${rows.length ? `<div class="card"><h3>Outside your will</h3>${kv(rows)}<p class="muted" style="margin-top:6px">These go straight to the person named, whatever your will says.</p></div>` : ''}
    ${trusts ? `<div class="section-label">Trusts you have set up</div>${trusts}` : ''}
    ${held.length ? `<div class="card"><h3>Held in trust for you</h3>${kv(held)}<p class="muted" style="margin-top:6px">Not yours yet, and not counted in what you are worth.</p></div>` : ''}`;
}

function familyHtml() {
  const list = [...(store.state.familyMoney ?? [])].reverse();
  return list.map((f) => `<div class="card"><h3>${esc(f.name)}</h3>
      <p class="muted" style="margin-bottom:8px">${f.born} to ${f.died} · generation ${f.generation}</p>
      ${kv([...(f.netWorth != null ? [['Left behind, less debts', fx.fmt(f.netWorth, f.cur)]] : []), ['Earned in their lifetime', fx.fmt(f.earned, f.cur)],
    ...(f.tax ? [['Estate tax paid', fx.fmt(f.tax, f.cur)]] : []), ...(f.charity ? [['Left to charity', fx.fmt(f.charity, f.cur)]] : []),
    ...(f.homes.length ? [['Property owned at the end', f.homes.join(', ')]] : []), ...((f.businesses ?? []).length ? [['Businesses owned at the end', f.businesses.join(', ')]] : []),
    ...(f.outside ?? []).map((x) => [`${x.you ? 'To you' : `To ${x.name}`}, by ${x.how}`, fx.fmt(x.amount, f.cur)]),
    ...f.shares.map((s) => [`${s.you ? 'To you' : `To ${s.name}`} (${s.role.toLowerCase()})`, `${fx.fmt(s.amount, f.cur)}${s.items.length ? ` + ${s.items.map(lower).join(', ')}` : ''}`])])}
      ${f.milestones.length ? `<div style="margin-top:8px">${kv(f.milestones.map((m) => [`Age ${m.age}`, m.text]))}</div>` : ''}</div>`).join('')
    + '<p class="muted mm-note">What is recorded here is what happened: amounts are in the money of the time and place. The private detail of their accounts was not passed on.</p>';
}

function householdHtml() {
  const p = player();
  const c = country();
  const s = store.state.npcs[p.npcIds.find((id) => store.state.npcs[id]?.alive && store.state.npcs[id].role === 'spouse')] ?? null;
  const law = fam.familyLaw();
  const how = fam.ARRANGEMENTS[fam.arrangement()];
  const mine = (p.career.salary || 0) + (p.career.partTime?.salary || 0);
  const out = fam.loansOut().map((l) => `<button class="row" data-lent="${l.id}"><div class="avatar glyph">🤝</div>
      <div class="main"><strong>${esc(l.name)}</strong><small>${esc(fmtMoney(l.amount, c))} in ${l.year}, over ${l.years} ${l.years === 1 ? 'year' : 'years'}${l.missed ? ` · nothing paid for ${l.missed} ${l.missed === 1 ? 'year' : 'years'}` : ''}</small></div>
      <div class="side">${esc(fmtMoney(l.left, c))}<br>owing</div></button>`).join('');
  const kids = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role === 'child' && n.age >= 5 && n.age < 18);
  return `${s ? `<div class="card"><h3>You and ${esc(s.firstName)}</h3>
      ${kv([['How you share the bills', how.name], ['Your share of the household', `${Math.round(Math.min(1, fam.billShare(mine)) * 100)}%`], [`${s.firstName} earns`, s.life?.job?.salary ? `${fmtMoney(s.life.job.salary, c)} a year` : 'Nothing at present'],
    ['If you divorced', law.name]])}
      <p class="muted" style="margin-top:6px">${esc(how.line)} ${esc(law.line)} Marrying merged nothing: what was yours is yours, and what is ${esc(s.firstName)}'s is not yours to spend.</p>
      <div class="btn-stack" style="margin-top:10px"><button class="btn" data-act="arrange">Suggest another way to share the bills</button>
        ${fam.jointAccounts().some((a) => a.joint === s.id) ? '' : '<button class="btn" data-act="joint">Open a joint account</button>'}</div></div>` : ''}
    ${out ? `<div class="section-label">Money you have lent</div>${out}` : ''}
    <div class="btn-stack"><button class="btn" data-act="give">Give money to someone</button><button class="btn" data-act="lend">Lend money to someone</button></div>
    ${kids.length ? `<div class="card" style="margin-top:14px"><h3>Pocket money</h3>
      ${kv([['Now', fam.ALLOWANCES[fam.allowance()].name], ['Costs you', `${fmtMoney(fam.allowanceCost(), c)} a year`], ['For', kids.map((k) => k.firstName).join(', ')]])}
      <p class="muted" style="margin-top:6px">Money of their own to look after teaches a child something. It does not decide what they will be like with money.</p>
      <div class="btn-stack" style="margin-top:10px"><button class="btn" data-act="allowance">Change it</button></div></div>` : ''}
    <p class="muted mm-note">Other people's money is theirs. They can turn a gift or a loan down, and a loan is repaid only if they are able and willing.</p>`;
}

function businessHtml() {
  const c = country();
  const rows = biz.businesses().map((a) => `<button class="row" data-biz="${a.id}"><div class="avatar glyph">🏪</div>
      <div class="main"><strong>${esc(a.name)}</strong><small>${esc(biz.businessLine(a))}</small></div>
      <div class="side">${esc(fmtMoney(a.value, c))}</div></button>`).join('');
  const can = biz.startOptions().some((o) => o.ok);
  return `${rows || '<p class="empty">You do not own a business.</p>'}
    <div class="btn-stack"><button class="btn primary" data-act="startbiz" ${can ? '' : 'disabled'}>Start a business</button></div>
    <p class="muted mm-note">A business has money of its own. What it takes in is not yours until you take profit out, and what you take out is taxed. Most years are ordinary, some are bad, and a business that runs out of money closes: you lose what you put in, and nothing more. The figure shown is an estimate of what your share would fetch.</p>`;
}

function awardsHtml() {
  const list = ach.achievements();
  const v = ach.moneySense();
  return `<div class="card"><h3>What you understand about money</h3>
      <div class="mm-line"><span>${esc(ach.senseWord(v))}</span><span>${v} of 100</span></div>${bar(v / 100)}
      <p class="muted" style="margin-top:6px">Picked up from living with money: earning it, budgeting, saving for something, getting into trouble and out again. It helps you see through a bad offer and argue with a bank. It is not cleverness, and it makes nobody rich.</p></div>
    <div class="card"><h3>Milestones</h3>
      ${list.map((a) => `<div class="mm-tx"><div class="main"><strong>${a.earned ? '✓ ' : ''}${esc(a.name)}</strong><small>${esc(a.blurb)}</small></div><div class="amt ${a.earned ? 'in' : ''}">${a.earned ? `age ${a.age}` : '—'}</div></div>`).join('')}
      <p class="muted" style="margin-top:8px">Each is worked out from what has actually happened in this life. They are things that can happen, not a score: plenty of good lives have none of them.</p></div>`;
}

function historyHtml(filter) {
  const L = ledgerOf();
  const cur = L.home;
  const kind = (t) => { const k = CATEGORIES[t.cat]?.kind; const n = Object.values(effect(L, t).net)[0] ?? 0; return k === 'transfer' ? 'moves' : n >= 0 ? 'in' : 'out'; };
  const list = [...L.tx].reverse().filter((t) => filter === 'all' || kind(t) === filter).slice(0, 80);
  const years = Object.keys(L.years).map(Number).sort((a, b) => b - a).slice(0, 40)
    .map((y) => { const t = yearTotals(L, y, cur); return [String(y), `${fx.fmt(units(t.in, cur), cur)} in · ${fx.fmt(units(t.out, cur), cur)} out`]; });
  const chips = [['all', 'Everything'], ['in', 'Money in'], ['out', 'Money out'], ['moves', 'Moves and loans']];
  return `<div class="mm-chips" role="group" aria-label="Show">${chips.map(([id, name]) => `<button class="mm-chip ${filter === id ? 'on' : ''}" data-filter="${id}" aria-pressed="${filter === id}">${name}</button>`).join('')}</div>
    <div class="card">${list.length ? list.map((t) => txRow(L, t)).join('') : '<p class="muted">Nothing to show.</p>'}</div>
    ${years.length ? `<div class="card"><h3>Year by year (${cur})</h3>${kv(years)}
      <p class="muted" style="margin-top:6px">Each movement is kept for ${KEEP_YEARS} years. After that only the year's totals remain.</p></div>` : ''}`;
}

// ---------- Actions ----------

async function openAccountFlow() {
  const c = country();
  const cur = c.currency.code;
  const offers = bank.offers().filter((o) => o.products.length);
  if (!offers.length) return messageModal({ body: 'No bank here will open an account for you.' });
  const o = await pickModal({ title: 'Which bank?', body: 'These have branches where you live.',
    options: offers.map((x) => ({ value: x, label: x.bank.name, sub: x.bank.blurb, disabled: !x.products.some((pr) => pr.ok) })) });
  if (!o) return undefined;
  const pr = await pickModal({ title: o.bank.name, options: o.products.map((x) => ({ value: x, label: `${x.name}${x.rateBp ? `: ${(x.rateBp / 100).toFixed(2)}% a year` : ''}`, disabled: !x.ok,
    sub: x.ok ? `${x.blurb}${x.minimum ? ` Needs ${money(x.minimum, cur)} to open.` : ''}${x.fee ? ` Costs ${money(x.fee, cur)} a year.` : ''}` : x.reason })) });
  if (!pr) return undefined;
  let amount = 0;
  const have = Math.floor(player().finance.cash);
  if (pr.minimum > have) return messageModal({ body: `It needs ${money(pr.minimum, cur)} to open. You have ${fmtMoney(have, c)}.` });
  if (have >= Math.max(1, pr.minimum)) {
    const first = pr.minimum ? 'pay' : await pickModal({ title: 'Pay something in now?', options: [{ value: 'pay', label: 'Yes', sub: `You have ${fmtMoney(have, c)}.` }, { value: 'none', label: 'No, open it empty' }] });
    if (!first) return undefined;
    if (first === 'pay') { amount = await askAmount({ title: 'Opening deposit', body: PRODUCTS[pr.id].term ? 'It cannot be added to or taken out until it matures.' : undefined, max: have, cur, least: Math.max(1, pr.minimum) }); if (amount == null) return undefined; }
  }
  return bank.openAccount(o.bank.id, pr.id, amount);
}

async function betweenFlow(fromId = null) {
  const list = bank.accounts().filter((a) => !a.locked);
  const from = fromId ? bank.accountById(fromId) : await pickModal({ title: 'Move money from', options: list.filter((a) => a.bal > 0).map((a) => ({ value: a, label: `${a.name}, ${a.bank.name}`, sub: ex(a.bal, a.cur) })) });
  if (!from) return undefined;
  const targets = bank.accounts().filter((a) => a.id !== from.id && a.cur === from.cur && a.matures == null);
  if (!targets.length) return messageModal({ body: 'You have no other account in the same currency to move it to.' });
  const to = await pickModal({ title: 'Move it to', options: targets.map((a) => ({ value: a, label: `${a.name}, ${a.bank.name}`, sub: `${ex(a.bal, a.cur)}${a.goal ? ` · for ${lower(a.goal.name)}` : ''}` })) });
  if (!to) return undefined;
  const n = await askAmount({ title: 'How much?', max: units(from.bal, from.cur), cur: from.cur });
  return n ? bank.transfer(from.id, to.id, n) : undefined;
}

/** One account: its terms, what has happened in it, and what can be done with it. */
function accountDetail(id, done) {
  const a = bank.accountById(id);
  const L = ledgerOf();
  const mine = L.tx.filter((t) => t.entries.some(([x]) => x === id)).slice(-8).reverse();
  const who = (o) => (o.id === player().id ? 'You' : (() => { const n = store.state.npcs[o.id]; return n ? `${n.firstName} ${n.lastName}` : 'Someone'; })());
  const cost = bank.breakCost(a);
  const m = openModal(`
    <h2>${esc(a.name)}</h2>
    ${kv([['Bank', a.bank.name], ['Balance', ex(a.bal, a.cur)], ['Currency', a.cur], ['Interest', a.rateBp ? `${(a.rateBp / 100).toFixed(2)}% a year, added month by month` : 'None'],
    ...(a.feeMinor ? [['Yearly charge', ex(a.feeMinor, a.cur)]] : []), ...(a.capMinor ? [['Holds at most', ex(a.capMinor, a.cur)]] : []),
    ...(a.matures != null ? [['Locked until', String(a.matures)]] : []), ['Opened', `${a.opened}, at age ${a.openedAge}`],
    ...a.owners.map((o) => [o.role === 'owner' ? 'Owner' : o.role === 'joint_owner' ? 'Joint owner' : 'Custodian (not an owner)', who(o)]), ...(a.joint ? [['Your share', `${Math.round(a.share * 100)}%`]] : []),
    ...(a.beneficiary && store.state.npcs[a.beneficiary]?.alive ? [['If you die, it goes to', who({ id: a.beneficiary })]] : []), ...(a.goal ? [['Saving for', a.goal.name]] : [])])}
    <div class="section-label">Recent activity</div>
    ${mine.length ? mine.map((t) => { const amt = t.entries.filter(([x]) => x === id).reduce((s, [, n]) => s + n, 0); return `<div class="mm-tx"><div class="main"><strong>${esc(t.desc)}</strong><small>${t.year}, age ${t.age}</small></div><div class="amt ${amt >= 0 ? 'in' : 'out'}">${amt > 0 ? '+' : ''}${esc(ex(amt, a.cur))}</div></div>`; }).join('') : '<p class="muted">Nothing yet.</p>'}
    <div class="btn-stack" style="margin-top:14px">
      ${a.matures == null ? '<button class="btn" data-do="in">Pay in</button>' : ''}
      ${!a.locked && a.bal > 0 ? '<button class="btn" data-do="out">Take out</button>' : ''}
      ${!a.locked && a.bal > 0 && bank.accounts().length > 1 ? '<button class="btn" data-do="move">Move to another account</button>' : ''}
      ${a.joint ? '' : `<button class="btn" data-do="name">${a.beneficiary ? 'Change who gets it if you die' : 'Name who gets it if you die'}</button>`}
      <button class="btn danger" data-do="close">${a.locked ? `Break the deposit (costs ${esc(ex(cost, a.cur))})` : 'Close the account'}</button>
      <button class="btn" data-close>Back</button>
    </div>`, { dismissable: true, onDismiss: () => done(null) });
  m.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) { m.close(); return done(null); }
    const act = e.target.closest('[data-do]')?.dataset.do;
    if (!act) return undefined;
    m.close();
    const wallet = a.cur === country().currency.code ? player().finance.cash : player().finance.accounts?.[a.cur] ?? 0;
    if (act === 'in') { const n = await askAmount({ title: `Pay into your ${lower(a.name)}`, body: a.cur === country().currency.code ? undefined : `Only ${a.cur} can be paid in. You hold ${money(Math.floor(wallet), a.cur)}.`, max: a.capMinor ? Math.min(wallet, units(a.capMinor - a.bal, a.cur)) : wallet, cur: a.cur }); return done(n ? bank.deposit(id, n) : null); }
    if (act === 'out') { const n = await askAmount({ title: `Take out of your ${lower(a.name)}`, max: units(a.bal, a.cur), cur: a.cur }); return done(n ? bank.withdraw(id, n) : null); }
    if (act === 'move') return done(await betweenFlow(id));
    if (act === 'name') { const who = await pickModal({ title: 'If you die, this account goes to', body: 'Straight to them, outside your will.', options: [{ value: 0, label: 'Nobody named', sub: 'It passes under your will with everything else.' }, ...adults().concat(player().npcIds.map((x) => store.state.npcs[x]).filter((n) => n?.alive && n.age < 18 && n.role === 'child')).map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: roleLabel(n) }))] }); return done(who == null ? null : bank.nameOnAccount(id, who || null)); }
    const sure = await confirmModal({ title: a.locked ? 'Break the deposit?' : `Close your ${lower(a.name)}?`, yes: a.locked ? 'Break it' : 'Close it', danger: true,
      body: `${a.bal ? `${ex(a.bal - cost, a.cur)} goes back to your everyday money${cost ? `, and ${ex(cost, a.cur)} of interest is lost` : ''}. ` : ''}${a.goal ? `Saving for ${lower(a.goal.name)} is paused. ` : ''}The account's history is kept.` });
    return done(sure ? bank.closeAccount(id) : null);
  });
}

async function goalFlow() {
  const free = bank.accounts().filter((a) => !a.goal);
  const k = await pickModal({ title: 'What for?', options: GOAL_KINDS.map((x) => ({ value: x, label: x.name, sub: x.blurb })) });
  if (!k) return undefined;
  const a = free.length === 1 ? free[0] : await pickModal({ title: 'Save into which account?', body: 'One goal to an account, so the money cannot be counted twice.',
    options: free.map((x) => ({ value: x, label: `${x.name}, ${x.bank.name}`, sub: `${ex(x.bal, x.cur)}${x.rateBp ? ` · ${(x.rateBp / 100).toFixed(2)}%` : ''}` })) });
  if (!a) return undefined;
  const cur = a.cur;
  const same = cur === country().currency.code;
  const base = same ? bank.suggestedTarget(k.id) : null;
  const target = await pickModal({ title: `How much for ${lower(k.name)}?`, body: k.id === 'emergency' && same ? 'Three months of what you spend is a common aim.' : undefined, options: [
    ...(base ? [0.5, 1, 2].map((s) => ({ value: Math.round(base * s), label: money(Math.round(base * s), cur) })) : []), { value: 'other', label: 'Another amount' }] });
  if (target == null) return undefined;
  let amount = target;
  if (target === 'other') {
    const text = await inputModal({ title: 'How much?', label: `In ${cur}`, maxLength: 15 });
    amount = Math.floor(Number((text ?? '').replace(/[^0-9.]/g, '')));
    if (!(amount > 0)) return undefined;
  }
  const p = player();
  const by = await pickModal({ title: 'By when?', options: [{ value: 0, label: 'No date' }, ...[1, 3, 5, 10].map((n) => ({ value: p.age + n, label: `By age ${p.age + n}`, sub: `${n} ${n === 1 ? 'year' : 'years'} from now` }))] });
  if (by == null) return undefined;
  return bank.addGoal({ kind: k.id, target: amount, accountId: a.id, deadlineAge: by || null });
}

async function editGoal(id) {
  const g = bank.goalList().find((x) => x.id === id);
  if (!g) return undefined;
  const act = await pickModal({ title: g.name, body: `${ex(g.saved, g.cur)} of ${ex(g.target, g.cur)}.`, options: [
    ...(g.account && g.account.closed == null && !g.account.locked ? [{ value: 'pay', label: 'Pay into it now' }] : []),
    { value: 'target', label: 'Change the amount' },
    g.status === 'paused' ? { value: 'active', label: 'Take it up again', disabled: !g.account || g.account.closed != null, sub: !g.account || g.account.closed != null ? 'Its account is closed.' : undefined } : { value: 'paused', label: 'Pause it' },
    { value: 'abandoned', label: 'Give it up', sub: 'The money stays where it is. The record of the goal is kept.' }] });
  if (!act) return undefined;
  if (act === 'pay') {
    const wallet = g.cur === country().currency.code ? player().finance.cash : player().finance.accounts?.[g.cur] ?? 0;
    const n = await askAmount({ title: `Towards ${lower(g.name)}`, max: wallet, cur: g.cur });
    return n ? bank.deposit(g.accountId, n) : undefined;
  }
  if (act === 'target') {
    const text = await inputModal({ title: 'A new amount', label: `In ${g.cur}`, value: String(Math.round(units(g.target, g.cur))), maxLength: 15 });
    const n = Math.floor(Number((text ?? '').replace(/[^0-9.]/g, '')));
    return n > 0 ? bank.updateGoal(id, { target: n }) : undefined;
  }
  return bank.updateGoal(id, { status: act });
}

async function limitFlow(cat) {
  const c = country();
  const row = bank.budgetView().rows.find((r) => r.cat === cat);
  const now = row?.actual ?? 0;
  const pick = await pickModal({ title: CATEGORIES[cat].name, body: `This year so far: ${fmtMoney(now, c)}.${row?.limit != null ? ` Your limit is ${fmtMoney(row.limit, c)}.` : ''}`, options: [
    ...(now ? [{ value: now, label: `No more than this year: ${fmtMoney(now, c)}` }, { value: Math.round(now * 0.9), label: `A tenth less: ${fmtMoney(now * 0.9, c)}` }, { value: Math.round(now * 0.75), label: `A quarter less: ${fmtMoney(now * 0.75, c)}` }] : []),
    { value: 'other', label: 'Another amount' }, ...(row?.limit != null ? [{ value: 'none', label: 'No limit' }] : [])] });
  if (pick == null) return undefined;
  if (pick === 'none') return bank.setLimit(cat, null);
  if (pick !== 'other') return bank.setLimit(cat, pick);
  const text = await inputModal({ title: 'A yearly limit', label: `In ${c.currency.code}`, maxLength: 15 });
  if (text == null) return undefined;
  return bank.setLimit(cat, Math.floor(Number(text.replace(/[^0-9.]/g, ''))) || 0);
}

async function loanFlow(id) {
  const c = country();
  const p = player();
  const l = p.finance.loans.find((x) => x.id === id);
  if (!l) return undefined;
  const s = loans.loanSchedule(l);
  const frozen = l.kind === 'student' && p.education.enrolled;
  const act = await pickModal({ title: `${l.kind.charAt(0).toUpperCase() + l.kind.slice(1)} loan`,
    body: `${fmtMoney(l.principal, c)} owed at ${(l.rate * 100).toFixed(1)}%. If nothing changes: ${s.rows.length} more ${s.rows.length === 1 ? 'year' : 'years'}, ${fmtMoney(s.paid, c)} paid in all, of which ${fmtMoney(s.interest, c)} is interest.${frozen ? ' Nothing is due while you are studying.' : ''}`,
    options: [{ value: 'schedule', label: 'See it year by year' },
      { value: 'extra', label: 'Pay some of it off now', disabled: frozen || p.finance.cash < 1, sub: frozen ? 'Not while you are studying.' : `You have ${fmtMoney(p.finance.cash, c)}.` },
      { value: 'all', label: `Pay it all off: ${fmtMoney(l.principal, c)}`, disabled: frozen || p.finance.cash < l.principal },
      (() => { const o = loans.refinanceOffer(l, standingNow().standing); return { value: 'refi', label: 'Move it to a cheaper rate', disabled: !o.ok, sub: o.ok ? `${(o.rate * 100).toFixed(1)}% instead of ${(l.rate * 100).toFixed(1)}%. Fee ${fmtMoney(o.fee, c)}; saves about ${fmtMoney(o.saving, c)} if nothing changes.` : o.reason }; })(),
      { value: 'time', label: 'Ask the lender for more time', disabled: !!l.eased, sub: l.eased ? 'They have already given you more time.' : 'For when the payments are more than you can manage. Smaller payments, more interest in the end.' }] });
  if (!act) return undefined;
  if (act === 'schedule') return messageModal({ title: 'Year by year', body: s.rows.slice(0, 12).map((r) => `Year ${r.year}: pay ${fmtMoney(r.payment, c)} (${fmtMoney(r.interest, c)} interest), ${fmtMoney(r.left, c)} left.`).join(' ') + (s.rows.length > 12 ? ' …' : '') });
  if (act === 'all') return loans.repayLoan(id);
  if (act === 'refi') return loans.refinance(id, standingNow().standing);
  if (act === 'time') return loans.askForTime(id);
  const n = await askAmount({ title: 'Pay off how much?', max: Math.min(p.finance.cash, l.principal), cur: c.currency.code });
  return n ? loans.payDown(id, n) : undefined;
}

const standingNow = () => credit.standing({ income: loans.householdIncome(), service: loans.debtService(), used: cards.utilisation() });

/** Picks someone the player already knows. Resolves the person, or null. */
async function pickPerson(title, list, body) {
  if (!list.length) { await messageModal({ body: 'There is nobody to choose.' }); return null; }
  return pickModal({ title, body, options: list.map((n) => ({ value: n, label: `${n.firstName} ${n.lastName}`, sub: `${roleLabel(n)}, age ${n.age}` })) });
}
const adults = () => player().npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.age >= 18 && n.role !== 'pet' && n.role !== 'boss');

async function cardFlow(id) {
  const c = country();
  const p = player();
  const k = cards.cardById(id);
  if (!k) return undefined;
  const st = k.statements.at(-1);
  const act = await pickModal({ title: k.name,
    body: `You owe ${fmtMoney(k.balance, c)} of a ${fmtMoney(k.limit, c)} limit. Anything not paid off is charged ${(k.rateBp / 100).toFixed(1)}% a year.${st ? ` Last statement (${st.year}): ${fmtMoney(st.spent, c)} spent, ${fmtMoney(st.interest, c)} interest${st.fee ? `, ${fmtMoney(st.fee, c)} late fee` : ''}, ${fmtMoney(st.paid, c)} paid${st.reward ? `, ${fmtMoney(st.reward, c)} back` : ''}.` : ''}`,
    options: [
      { value: 'pay', label: 'Make a payment', disabled: !k.balance || p.finance.cash < 1, sub: k.balance ? `The least the next statement will ask for is ${fmtMoney(cards.minimumDue(k), c)}.` : 'Nothing is owing.' },
      { value: 'auto', label: k.autopay === 'full' ? 'Pay only the minimum each year' : 'Pay it off in full each year', sub: k.autopay === 'full' ? 'The rest is carried over, with interest.' : 'No interest, as long as you have the money.' },
      { value: 'every', label: k.everyday ? 'Keep it for emergencies only' : 'Use it for everyday spending', sub: k.everyday ? 'It is used only when your money runs out.' : `Your spending goes through it. Paid in full, ${Math.round(CARDS.reward * 100)}% comes back.` },
      { value: 'cash', label: 'Take cash out on it', disabled: cards.available(k) < 10, sub: `Costs ${Math.round(CARDS.advanceFee * 100)}% at once, and is borrowed money.` },
      { value: 'limit', label: 'Ask for a higher limit' },
      { value: 'close', label: 'Close the card', disabled: k.balance > 0, sub: k.balance > 0 ? 'Pay it off first.' : 'Its history stays on your record.' }] });
  if (!act) return undefined;
  if (act === 'pay') { const n = await askAmount({ title: 'Pay how much?', max: Math.min(p.finance.cash, k.balance), cur: c.currency.code }); return n ? cards.payCard(id, n) : undefined; }
  if (act === 'cash') { const n = await askAmount({ title: 'How much cash?', max: Math.floor(cards.available(k) / (1 + CARDS.advanceFee)), cur: c.currency.code }); return n ? cards.cashAdvance(id, n) : undefined; }
  if (act === 'auto') return cards.setCard(id, { autopay: k.autopay === 'full' ? 'min' : 'full' });
  if (act === 'every') return cards.setCard(id, { everyday: !k.everyday });
  if (act === 'limit') return cards.askForLimit(id);
  return cards.closeCard(id);
}

async function insureFlow() {
  const c = country();
  const p = player();
  const list = p.assets.filter((a) => (a.kind === 'property' || a.kind === 'vehicle') && !ins.policyFor(a.id));
  const a = await pickModal({ title: 'Insure what?', options: list.map((x) => { const q = ins.quote(x.kind === 'property' ? 'home' : 'motor', { asset: x });
    return { value: x, label: x.name, disabled: !q.ok, sub: q.ok ? `${fmtMoney(q.premium, c)} a year · you pay the first ${fmtMoney(q.excess, c)} of a claim` : q.reason }; }) });
  return a ? ins.takeOut(a.kind === 'property' ? 'home' : 'motor', { asset: a }) : undefined;
}
async function lifeFlow() {
  const c = country();
  const mult = await pickModal({ title: 'Life insurance', body: INSURANCE.life.blurb, options: INSURANCE.life.covers.map((m) => { const q = ins.quote('life', { mult: m });
    return { value: m, label: `Cover of ${fmtMoney(q.cover, c)}`, sub: `${fmtMoney(q.premium, c)} a year now. It rises as you get older.`, disabled: !q.ok || player().finance.cash < q.premium }; }) });
  if (!mult) return undefined;
  const who = await pickModal({ title: 'Who is it paid to?', options: [{ value: 0, label: 'My estate', sub: 'It is shared out under your will.' },
    ...adults().concat(player().npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.age < 18 && n.role === 'child')).map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: `${roleLabel(n)}. Paid straight to them, outside your will.` }))] });
  if (who == null) return undefined;
  return ins.takeOut('life', { mult, beneficiaryId: who || null });
}
async function policyFlow(id) {
  const x = ins.policies().find((y) => y.id === id);
  if (!x) return undefined;
  const act = await pickModal({ title: INSURANCE[x.kind].name, body: `${x.insurer}. ${fmtMoney(x.premium, country())} a year. ${x.claims ? `${x.claims} ${x.claims === 1 ? 'claim' : 'claims'} made.` : 'No claims made.'}`,
    options: [...(x.kind === 'life' ? [{ value: 'name', label: 'Change who it is paid to' }] : []), { value: 'cancel', label: 'Cancel the policy' }] });
  if (act === 'cancel') return (await confirmModal({ title: 'Cancel it?', body: 'You will not be covered from today. Nothing already paid comes back.', yes: 'Cancel the policy', danger: true })) ? ins.cancel(id) : undefined;
  if (act === 'name') { const who = await pickModal({ title: 'Who is it paid to?', options: [{ value: 0, label: 'My estate' }, ...adults().map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: roleLabel(n) }))] }); return who == null ? undefined : ins.nameBeneficiary(id, who || null); }
  return undefined;
}

const rateOptions = () => PENSION_PLAN.rates.map((r) => ({ value: r, label: r ? `${Math.round(r * 100)}% of your pay` : 'Nothing for now',
  sub: r ? `About ${fmtMoney((player().career.salary || 0) * r, country())} a year from you${ret.employerMatch(player().career.salary || 0, r) ? `, and ${fmtMoney(ret.employerMatch(player().career.salary || 0, r), country())} from your employer` : ''}.` : 'What is in the plan stays invested.' }));
async function planFlow(change) {
  const r = await pickModal({ title: change ? 'How much to pay in' : 'Start a pension plan', body: `It comes out of your pay each year and cannot be touched until you are ${PENSION_PLAN.unlockAge}.`, options: rateOptions().filter((x) => change || x.value) });
  if (r == null) return undefined;
  return change ? ret.setPlanRate(r) : ret.openPlan(r);
}

async function arrangeFlow() {
  const how = await pickModal({ title: 'Sharing the bills', body: 'Your partner has to agree.', options: Object.entries(fam.ARRANGEMENTS).map(([id, a]) => ({ value: id, label: a.name, sub: a.line, disabled: id === fam.arrangement() })) });
  return how ? fam.proposeArrangement(how) : undefined;
}
async function jointFlow() {
  const sure = await confirmModal({ title: 'Open a joint account?', body: `It will belong to both of you. ${fam.familyLaw().id === 'equal' ? 'Here, half of whatever is in it is your partner\'s, whoever paid it in.' : 'Here, each of you owns what you put in.'} If one of you dies it passes to the other, outside any will.`, yes: 'Ask them' });
  if (!sure) return undefined;
  const n = Math.floor(player().finance.cash) >= 1 ? await askAmount({ title: 'Pay something in to open it', max: player().finance.cash, cur: country().currency.code }) : 0;
  return n == null ? undefined : fam.openJoint(n);
}
async function giveFlow(lend) {
  const c = country();
  const n = await pickPerson(lend ? 'Lend to whom?' : 'Give to whom?', adults(), lend ? 'They can say no. A loan is paid back only if they are able and willing.' : 'A gift is theirs to keep.');
  if (!n) return undefined;
  const amount = await askAmount({ title: `${lend ? 'Lend' : 'Give'} ${n.firstName} how much?`, max: player().finance.cash, cur: c.currency.code });
  if (!amount) return undefined;
  if (!lend) return fam.giveMoney(n.id, amount);
  const years = await pickModal({ title: 'To be paid back over', options: [1, 3, 5].map((y) => ({ value: y, label: `${y} ${y === 1 ? 'year' : 'years'}`, sub: `${fmtMoney(Math.ceil(amount / y), c)} a year, no interest` })) });
  return years ? fam.lendMoney(n.id, amount, years) : undefined;
}
async function lentFlow(id) {
  const l = fam.loansOut().find((x) => x.id === id);
  if (!l) return undefined;
  const sure = await confirmModal({ title: 'Let it go?', body: `${fmtMoney(l.left, country())} is still owing. If you forgive it, it becomes a gift.`, yes: 'Forgive the debt' });
  return sure ? fam.forgiveLoan(id) : undefined;
}
async function allowanceFlow() {
  const level = await pickModal({ title: 'Pocket money', options: fam.ALLOWANCES.map((a, i) => ({ value: i, label: a.name, sub: i ? `${fmtMoney(fam.allowanceCost(i), country())} a year in all` : undefined })) });
  return level == null ? undefined : fam.setAllowance(level);
}

async function trustFlow() {
  const c = country();
  const n = await pickPerson('A trust for whom?', tr.trustCandidates().filter((x) => x.age < 40 && !tr.trusts().some((t) => t.beneficiaryId === x.id)), 'Money you put in is no longer yours, and you cannot take it back. A trustee holds it until they reach the age you set.');
  if (!n) return undefined;
  const ages = [18, 21, 25, 30].filter((a) => a > n.age);
  if (!ages.length) ages.push(n.age + 1);
  const age = await pickModal({ title: `When should it be ${n.firstName}'s?`, options: ages.map((a) => ({ value: a, label: `At ${a}`, sub: `${a - n.age} ${a - n.age === 1 ? 'year' : 'years'} from now` })) });
  if (!age) return undefined;
  const amount = await askAmount({ title: 'How much to put in?', body: `Setting it up costs ${Math.round(tr.TRUST.fee * 100)}% on top.`, max: Math.floor(player().finance.cash / (1 + tr.TRUST.fee)), cur: c.currency.code });
  return amount ? tr.createTrust({ beneficiaryId: n.id, amount, releaseAge: age }) : undefined;
}
async function trustAdd(id) {
  const amount = await askAmount({ title: 'Add to the trust', body: 'It cannot be taken back.', max: player().finance.cash, cur: country().currency.code });
  return amount ? tr.addToTrust(id, amount) : undefined;
}

async function startBizFlow() {
  const c = country();
  const t = await pickModal({ title: 'Start a business', body: 'Half of what you put in is spent setting up. The rest becomes the business\'s own money.', options: biz.startOptions().map((o) => ({ value: o, label: `${o.name}: ${fmtMoney(o.cost, c)}`, disabled: !o.ok,
    sub: o.ok ? `${o.swing > 0.8 ? 'Wild swings from year to year' : o.swing > 0.5 ? 'Uneven from year to year' : 'Fairly steady'} · does best with ${o.skill === 'charm' ? 'charm' : 'a good head'}` : o.reason })) });
  return t ? biz.startBusiness(t.id) : undefined;
}
async function bizFlow(id) {
  const c = country();
  const a = biz.businessById(id);
  if (!a) return undefined;
  const lastProfit = a.profits.at(-1);
  const act = await pickModal({ title: a.name,
    body: `${biz.businessLine(a)}. In its till: ${fmtMoney(a.till, c)} (the business's money, not yours). ${a.takings ? `Last year it took in ${fmtMoney(a.takings, c)} and ${lastProfit >= 0 ? `made ${fmtMoney(lastProfit, c)}` : `lost ${fmtMoney(-lastProfit, c)}`}. ` : 'It has not traded a full year yet. '}Your share might fetch about ${fmtMoney(a.value, c)}.`,
    options: [
      { value: 'payout', label: 'What happens to the profit', sub: a.payout === 0 ? 'It all stays in the business.' : a.payout === 1 ? 'You take all you can.' : 'You take half.' },
      a.manager === 'you' ? { value: 'hire', label: 'Hire a manager', sub: 'They take a share of what they make. You keep your time.' } : { value: 'run', label: 'Run it yourself', disabled: a.inherited && !a.learned, sub: a.inherited && !a.learned ? 'You own it, but have never run it.' : 'More of the profit, if you are good at it.' },
      ...(a.inherited && !a.learned ? [{ value: 'learn', label: 'Spend a year learning the business' }] : []),
      { value: 'fund', label: 'Put more of your own money in', disabled: player().finance.cash < 1 },
      { value: 'stake', label: 'Sell part of it to an investor', disabled: a.value <= 0 || a.stake <= 0.3 },
      { value: 'sell', label: `Sell it (about ${fmtMoney(biz.salePrice(a), c)})`, disabled: a.value <= 0 }] });
  if (!act) return undefined;
  if (act === 'payout') { const v = await pickModal({ title: 'The profit', options: [{ value: 0, label: 'Leave it all in the business', sub: 'It grows, and is safer in a bad year.' }, { value: 0.5, label: 'Take half' }, { value: 1, label: 'Take all you can', sub: 'Taxed as your income.' }] }); return v == null ? undefined : biz.setBusiness(id, { payout: v }); }
  if (act === 'hire') return biz.setBusiness(id, { manager: 'hired' });
  if (act === 'run') return biz.setBusiness(id, { manager: 'you' });
  if (act === 'learn') return biz.learnBusiness(id);
  if (act === 'fund') { const n = await askAmount({ title: 'Put in how much?', body: 'It becomes the business\'s money.', max: player().finance.cash, cur: c.currency.code }); return n ? biz.fundBusiness(id, n) : undefined; }
  if (act === 'stake') { const f = await pickModal({ title: 'Sell how much?', options: [0.1, 0.25, 0.4].filter((x) => x < a.stake - 0.2).map((x) => ({ value: x, label: `${Math.round(x * 100)}% of the business`, sub: `For about ${fmtMoney(a.value * (x / a.stake) * 0.9, c)}. You would own ${Math.round((a.stake - x) * 100)}%.` })) }); return f ? biz.sellStake(id, f) : undefined; }
  return (await confirmModal({ title: `Sell ${a.name}?`, body: `You would get about ${fmtMoney(biz.salePrice(a), c)}, less tax on any gain.`, yes: 'Sell', danger: true })) ? biz.sellBusiness(id) : undefined;
}

// ---------- The screen ----------

/**
 * @param {{changed:Function}} api    the shell: call after anything changes
 * @param {{invest:Function, borrow:Function, will:Function}} links  screens that already exist elsewhere
 */
export function openMyMoney(api, links = {}) {
  let tab = 'overview';
  let filter = 'all';
  const m = openModal('<div class="mm" data-mm></div>', { dismissable: true });
  m.el.classList.add('mm-modal');
  const root = m.el.querySelector('[data-mm]');
  const body = { overview: overviewHtml, accounts: accountsHtml, budget: budgetHtml, debt: debtHtml, invest: investHtml, cover: coverHtml,
    goals: goalsHtml, household: householdHtml, business: businessHtml, retire: retireHtml, estate: estateHtml, family: familyHtml, awards: awardsHtml, history: () => historyHtml(filter) };

  function render() {
    const p = player();
    const shown = SECTIONS.filter(([, , on]) => on(p));
    if (!shown.some(([id]) => id === tab)) tab = 'overview';
    root.innerHTML = `
      <div class="mm-head"><div><h2>My Money</h2><p class="muted">Make your choices. Build your future.</p></div>
        <button class="icon-btn" data-close aria-label="Close My Money">✕</button></div>
      <nav class="mm-nav" aria-label="My Money sections">${shown.map(([id, name]) => `<button class="mm-chip ${id === tab ? 'on' : ''}" data-tab="${id}" ${id === tab ? 'aria-current="page"' : ''}>${esc(name)}</button>`).join('')}</nav>
      <div class="mm-body">${body[tab]()}</div>`;
    root.querySelector('.mm-chip.on')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  /** After an action: save, redraw, and say what happened if it needs saying. */
  async function settle(r) {
    api.changed();
    if (!player().alive) return m.close();
    render();
    if (r && r.text && (!r.ok || r.tell !== false)) await messageModal({ body: r.text, tone: r.tone });
    return undefined;
  }

  root.addEventListener('click', async (e) => {
    const on = (sel) => e.target.closest(sel);
    if (on('[data-close]')) return m.close();
    if (on('[data-tab]')) { tab = on('[data-tab]').dataset.tab; return render(); }
    if (on('[data-filter]')) { filter = on('[data-filter]').dataset.filter; return render(); }
    if (on('[data-account]')) return accountDetail(on('[data-account]').dataset.account, settle);
    if (on('[data-goal]')) return settle(await editGoal(on('[data-goal]').dataset.goal));
    if (on('[data-limit]')) return settle(await limitFlow(on('[data-limit]').dataset.limit));
    if (on('[data-loan]')) return settle(await loanFlow(on('[data-loan]').dataset.loan));
    if (on('[data-card]')) return settle(await cardFlow(on('[data-card]').dataset.card));
    if (on('[data-policy]')) return settle(await policyFlow(on('[data-policy]').dataset.policy));
    if (on('[data-loss]')) return settle(ins.claim(on('[data-loss]').dataset.loss));
    if (on('[data-lent]')) return settle(await lentFlow(on('[data-lent]').dataset.lent));
    if (on('[data-trust]')) return settle(await trustAdd(on('[data-trust]').dataset.trust));
    if (on('[data-biz]')) return settle(await bizFlow(on('[data-biz]').dataset.biz));
    const link = on('[data-link]')?.dataset.link;
    if (link && links[link]) { await links[link](api); return settle(null); }
    const act = on('[data-act]')?.dataset.act;
    if (act === 'open') return settle(await openAccountFlow());
    if (act === 'between') return settle(await betweenFlow());
    if (act === 'goal') return settle(await goalFlow());
    const flows = { card: () => cards.applyForCard(), insure: insureFlow, life: lifeFlow, plan: () => planFlow(false), planrate: () => planFlow(true), arrange: arrangeFlow, joint: jointFlow,
      give: () => giveFlow(false), lend: () => giveFlow(true), allowance: allowanceFlow, trust: trustFlow, startbiz: startBizFlow };
    if (flows[act]) return settle(await flows[act]());
    return undefined;
  });
  render();
}
