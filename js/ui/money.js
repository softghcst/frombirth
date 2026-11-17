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
  ['retire', 'Retirement', (p) => p.age >= 18],
  ['estate', 'Estate', () => last.canWriteWill()],
  ['family', 'Family legacy', () => (store.state.familyMoney ?? []).length > 0],
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
      <div class="main"><strong>${esc(a.name)}</strong><small>${esc(a.bank.name)} · ${a.cur}${a.rateBp ? ` · ${(a.rateBp / 100).toFixed(2)}% a year` : ''}${a.goal ? ` · for ${esc(lower(a.goal.name))}` : ''}</small></div>
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
  const s = credit.standing({ income: loans.householdIncome(), service: loans.debtService() });
  const mortgages = p.assets.filter((a) => a.mortgage);
  const total = p.finance.loans.reduce((x, l) => x + l.principal, 0) + mortgages.reduce((x, a) => x + a.mortgage.principal, 0);
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
    ${total ? `<div class="section-label">What you owe: ${esc(fmtMoney(total, c))}</div>${loanRows}${mortRows}` : '<p class="empty">You owe nothing.</p>'}
    ${p.finance.loans.length > 1 ? `<div class="card"><h3>Which to clear first</h3>
      ${kv([['Highest interest first', order('rate')], ['Smallest first', order('size')]])}
      <p class="muted" style="margin-top:6px">The first costs least in interest. The second gives an early win. Neither suits everyone.</p></div>` : ''}
    ${loans.isBankrupt() ? `<p class="muted mm-note">You are bankrupt until age ${p.flags.bankruptUntil}. No bank will lend to you until then.</p>` : ''}
    ${p.age >= 18 ? '<div class="btn-stack"><button class="btn" data-link="borrow">Borrow money</button></div>' : ''}`;
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
  const k = sys.cover();
  return `<div class="card"><h3>Health cover</h3>
      ${kv([['System here', k.model.name], ['Are you covered?', k.covered ? 'Yes' : 'No'], ['Your share of a bill', `${Math.round(k.share * 100)}%`], ...(k.premium ? [['What it costs you a year', fmtMoney(k.premium, c)]] : [])])}
      <p class="muted" style="margin-top:6px">${esc(k.how)}</p></div>
    <p class="muted mm-note">Health cover is the only insurance in Pathways so far. It is arranged when you see the doctor, from the Self tab.</p>`;
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
    <p class="muted mm-note">Pensions come from the years you have worked (Work tab). Anything more is what you save or invest yourself: a savings goal for retirement is one way to keep track.</p>`;
}

function estateHtml() {
  const c = country();
  const e = last.estatePlan();
  const things = (s) => (s.items.length ? ` + ${s.items.map((it) => lower(it.name)).join(', ')}` : '');
  const inBank = bank.bankWorth();
  return `<div class="card"><h3>Your will</h3>
      <p class="muted" style="margin-bottom:8px">${esc(last.willSummary())}</p>
      ${e.gross <= 0 && !e.shares.length ? kv([['If you died today', 'There would be nothing to leave']]) : kv([
    ['Everything, less debts', fmtMoney(e.gross, c)], ['Estate tax', fmtMoney(e.tax, c)],
    ...e.shares.map((s) => [`${s.name} (${s.role.toLowerCase()})`, `${fmtMoney(s.amount, c)}${things(s)}`]),
    ...(e.charity ? [['To charity', fmtMoney(e.charity, c)]] : []), ...(e.lost ? [['Lost in the garden', fmtMoney(e.lost, c)]] : []), ...(e.toState ? [['To the state', fmtMoney(e.toState, c)]] : [])])}
    </div>
    <div class="card"><h3>What happens to your accounts</h3>
      <p class="muted">${inBank ? `Your bank accounts hold ${esc(fmtMoney(inBank, c))}. ` : ''}When you die they are closed and the money joins the rest of your estate, once. Debts are paid from the estate; nobody inherits them as their own. Property and vehicles pass on as they are.</p></div>
    <div class="btn-stack"><button class="btn" data-link="will">Change your will</button></div>`;
}

function familyHtml() {
  const list = [...(store.state.familyMoney ?? [])].reverse();
  return list.map((f) => `<div class="card"><h3>${esc(f.name)}</h3>
      <p class="muted" style="margin-bottom:8px">${f.born} to ${f.died} · generation ${f.generation}</p>
      ${kv([...(f.netWorth != null ? [['Left behind, less debts', fx.fmt(f.netWorth, f.cur)]] : []), ['Earned in their lifetime', fx.fmt(f.earned, f.cur)],
    ...(f.tax ? [['Estate tax paid', fx.fmt(f.tax, f.cur)]] : []), ...(f.charity ? [['Left to charity', fx.fmt(f.charity, f.cur)]] : []),
    ...(f.homes.length ? [['Property owned at the end', f.homes.join(', ')]] : []),
    ...f.shares.map((s) => [`${s.you ? 'To you' : `To ${s.name}`} (${s.role.toLowerCase()})`, `${fx.fmt(s.amount, f.cur)}${s.items.length ? ` + ${s.items.map(lower).join(', ')}` : ''}`])])}
      ${f.milestones.length ? `<div style="margin-top:8px">${kv(f.milestones.map((m) => [`Age ${m.age}`, m.text]))}</div>` : ''}</div>`).join('')
    + '<p class="muted mm-note">What is recorded here is what happened: amounts are in the money of the time and place. The private detail of their accounts was not passed on.</p>';
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
    ...a.owners.map((o) => [o.role === 'owner' ? 'Owner' : 'Custodian (not an owner)', who(o)]), ...(a.goal ? [['Saving for', a.goal.name]] : [])])}
    <div class="section-label">Recent activity</div>
    ${mine.length ? mine.map((t) => { const amt = t.entries.filter(([x]) => x === id).reduce((s, [, n]) => s + n, 0); return `<div class="mm-tx"><div class="main"><strong>${esc(t.desc)}</strong><small>${t.year}, age ${t.age}</small></div><div class="amt ${amt >= 0 ? 'in' : 'out'}">${amt > 0 ? '+' : ''}${esc(ex(amt, a.cur))}</div></div>`; }).join('') : '<p class="muted">Nothing yet.</p>'}
    <div class="btn-stack" style="margin-top:14px">
      ${a.matures == null ? '<button class="btn" data-do="in">Pay in</button>' : ''}
      ${!a.locked && a.bal > 0 ? '<button class="btn" data-do="out">Take out</button>' : ''}
      ${!a.locked && a.bal > 0 && bank.accounts().length > 1 ? '<button class="btn" data-do="move">Move to another account</button>' : ''}
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
      { value: 'all', label: `Pay it all off: ${fmtMoney(l.principal, c)}`, disabled: frozen || p.finance.cash < l.principal }] });
  if (!act) return undefined;
  if (act === 'schedule') return messageModal({ title: 'Year by year', body: s.rows.slice(0, 12).map((r) => `Year ${r.year}: pay ${fmtMoney(r.payment, c)} (${fmtMoney(r.interest, c)} interest), ${fmtMoney(r.left, c)} left.`).join(' ') + (s.rows.length > 12 ? ' …' : '') });
  if (act === 'all') return loans.repayLoan(id);
  const n = await askAmount({ title: 'Pay off how much?', max: Math.min(p.finance.cash, l.principal), cur: c.currency.code });
  return n ? loans.payDown(id, n) : undefined;
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
    goals: goalsHtml, retire: retireHtml, estate: estateHtml, family: familyHtml, history: () => historyHtml(filter) };

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
    const link = on('[data-link]')?.dataset.link;
    if (link && links[link]) { await links[link](api); return settle(null); }
    const act = on('[data-act]')?.dataset.act;
    if (act === 'open') return settle(await openAccountFlow());
    if (act === 'between') return settle(await betweenFlow());
    if (act === 'goal') return settle(await goalFlow());
    return undefined;
  });
  render();
}
