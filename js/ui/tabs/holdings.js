// Holdings tab: money, where you live, property, vehicles, investments and
// loans, with everything you can do about each.
import { store, player, country } from '../../state.js';
import { esc, fmtMoney } from '../../util.js';
import { netWorth } from '../../engine/finance.js';
import * as estate from '../../engine/realEstate.js';
import * as cars from '../../engine/vehicles.js';
import * as mkt from '../../engine/market.js';
import * as bank from '../../engine/loans.js';
import { INVEST_AMOUNTS, BANK_LOAN } from '../../data/securities.js';
import { localMoney } from '../../util.js';
import { meterHtml } from '../meter.js';
import { openModal, messageModal, pickModal, confirmModal } from '../modals.js';

const GLYPH = { car: '🚗', bike: '🏍️', boat: '⛵', plane: '✈️', property: '🏠', fund: '📈', stock: '📈', crypto: '🪙' };
const pct = (x) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;
const kv = (rows) => rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');

async function report(api, r) {
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

// ---------- Property ----------

async function browseProperty(api) {
  const c = country();
  const p = player();
  if (p.age < 18) return messageModal({ body: 'You need to be 18 to buy property.' });
  const list = estate.listings();
  const listing = await pickModal({
    title: 'Property for sale',
    body: `New listings every year. Buying costs 2% in fees. You have ${fmtMoney(p.finance.cash, c)}.`,
    options: list.map((l) => ({ value: l, label: `${l.name}: ${fmtMoney(l.price, c)}`, sub: `Condition: ${l.state} (${l.condition}%).` })),
  });
  if (!listing) return undefined;

  const t = estate.mortgageTerms(listing.price);
  const cash = p.finance.cash - listing.fees;
  const needed = Math.max(t.minDeposit, listing.price - t.maxLoan);
  const options = [];
  if (t.available && needed < listing.price) {
    for (const share of [0.1, 0.25, 0.5]) {
      const deposit = Math.max(needed, Math.round(listing.price * share));
      if (deposit >= listing.price || options.some((o) => o.value === deposit)) continue;
      const loan = listing.price - deposit;
      options.push({ value: deposit, label: `Mortgage with ${fmtMoney(deposit, c)} down`, disabled: cash < deposit,
        sub: `Borrow ${fmtMoney(loan, c)} at ${(t.rate * 100).toFixed(1)}% over ${t.years} years: ${fmtMoney(bank.yearlyPayment(loan, t.rate, t.years), c)} a year.` });
    }
  }
  options.push({ value: listing.price, label: 'Pay cash', disabled: cash < listing.price, sub: `${fmtMoney(listing.price, c)} plus ${fmtMoney(listing.fees, c)} in fees.` });
  const deposit = await pickModal({
    title: listing.name,
    body: t.available
      ? `On your household income a lender will offer up to ${fmtMoney(t.maxLoan, c)}, with at least ${fmtMoney(t.minDeposit, c)} down.`
      : t.reason,
    options,
  });
  if (deposit == null) return undefined;
  return report(api, estate.buyProperty(listing.id, deposit));
}

function openProperty(a, api) {
  const c = country();
  const p = player();
  const isHome = p.homeId === a.id;
  const rows = [
    ['Worth', fmtMoney(a.value, c)],
    ['You paid', `${fmtMoney(a.purchasePrice, c)} at age ${a.boughtAtAge}`],
    ['Mortgage', a.mortgage ? `${fmtMoney(a.mortgage.principal, c)} left, ${fmtMoney(a.mortgage.payment, c)} a year for ${a.mortgage.yearsLeft} more years` : 'None'],
    ['Use', isHome ? 'You live here' : a.tenant ? `Let at ${fmtMoney(a.tenant.rent, c)} a year` : 'Standing empty'],
    ['Running costs', `${fmtMoney(Math.round(a.value * estate.propertyTypeOf(a).upkeep), c)} a year`],
  ];
  const acts = [];
  if (!isHome && !a.tenant) acts.push(['movein', 'Move in'], ['let', `Find a tenant (about ${fmtMoney(estate.rentFor(a), c)} a year)`]);
  if (isHome) acts.push(['moveout', 'Move out and rent somewhere']);
  if (a.tenant) acts.push(['evict', 'Give the tenant notice']);
  if (a.condition < 95) acts.push(['renovate', `Renovate (${fmtMoney(estate.renovationCost(a.id), c)})`]);
  if (a.mortgage) acts.push(['payoff', `Pay off the mortgage (${fmtMoney(a.mortgage.principal, c)})`]);
  acts.push(['sell', `Sell (you would keep ${fmtMoney(estate.saleProceeds(a), c)})`]);

  const m = openModal(`
    <h2>${esc(a.name)}</h2>
    ${kv(rows)}
    <div style="margin:12px 0 16px">${meterHtml('Condition', a.condition, true)}</div>
    <div class="btn-stack">
      ${acts.map(([id, label]) => `<button class="btn ${id === 'sell' || id === 'evict' ? 'danger' : ''}" data-act="${id}">${esc(label)}</button>`).join('')}
      <button class="btn" data-close>Close</button>
    </div>`, { dismissable: true });
  m.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) return m.close();
    const id = e.target.closest('[data-act]')?.dataset.act;
    if (!id) return undefined;
    m.close();
    if (id === 'sell') {
      const yes = await confirmModal({ title: `Sell the ${a.name.charAt(0).toLowerCase() + a.name.slice(1)}?`, body: `After fees${a.mortgage ? ' and the mortgage' : ''} you would keep ${fmtMoney(estate.saleProceeds(a), c)}.`, yes: 'Sell', danger: true });
      return yes ? report(api, estate.sellProperty(a.id)) : undefined;
    }
    const run = { movein: () => estate.moveIn(a.id), moveout: () => estate.moveOut(), let: () => estate.letOut(a.id),
      evict: () => estate.evict(a.id), renovate: () => estate.renovate(a.id), payoff: () => estate.payOffMortgage(a.id) }[id];
    return report(api, run());
  });
}

// ---------- Vehicles ----------

async function browseVehicles(api) {
  const c = country();
  const p = player();
  const listing = await pickModal({
    title: 'Vehicles for sale',
    body: `New and used, different every year. You have ${fmtMoney(p.finance.cash, c)}.`,
    options: cars.listings().map((l) => ({ value: l, label: `${GLYPH[l.cls]} ${l.name}: ${fmtMoney(l.price, c)}`, disabled: !!l.blocked,
      sub: l.blocked || `Condition ${l.condition}%.` })),
  });
  if (!listing) return undefined;
  const how = await pickModal({
    title: listing.name,
    options: [
      { value: 'cash', label: `Pay ${fmtMoney(listing.price, c)} in cash`, disabled: p.finance.cash < listing.price },
      { value: 'loan', label: 'Buy it on finance', disabled: !listing.finance.approved,
        sub: listing.finance.approved ? `${fmtMoney(listing.finance.payment, c)} a year for ${BANK_LOAN.years} years.` : listing.finance.reason },
    ],
  });
  return how ? report(api, cars.buyVehicle(listing.id, how)) : undefined;
}

function openVehicle(a, api) {
  const c = country();
  const m = openModal(`
    <h2>${GLYPH[a.vehicleClass]} ${esc(a.name)}</h2>
    ${kv([['Worth', fmtMoney(a.value, c)], ['You paid', fmtMoney(a.purchasePrice, c)], ['Age', `${a.age} ${a.age === 1 ? 'year' : 'years'}`]])}
    <div style="margin:12px 0 16px">${meterHtml('Condition', a.condition, true)}</div>
    <div class="btn-stack">
      <button class="btn" data-act="out">Take it out</button>
      ${a.condition < 95 ? `<button class="btn" data-act="service">Service it (${fmtMoney(cars.serviceCost(a), c)})</button>` : ''}
      <button class="btn danger" data-act="sell">Sell for ${fmtMoney(a.value, c)}</button>
      <button class="btn" data-close>Close</button>
    </div>`, { dismissable: true });
  m.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return m.close();
    const id = e.target.closest('[data-act]')?.dataset.act;
    if (!id) return undefined;
    m.close();
    return report(api, { out: () => cars.takeOut(a.id), service: () => cars.service(a.id), sell: () => cars.sellVehicle(a.id) }[id]());
  });
}

// ---------- Investments ----------

async function tradeSecurity(api, q) {
  const c = country();
  const cash = player().finance.cash;
  const options = INVEST_AMOUNTS.map((a) => localMoney(a, c)).filter((a) => a <= cash)
    .map((a) => ({ value: ['buy', a], label: `Buy ${fmtMoney(a, c)}` }));
  if (q.held) {
    options.push({ value: ['sell', 0.5], label: `Sell half (${fmtMoney(q.held / 2, c)})` },
      { value: ['sell', 1], label: `Sell all (${fmtMoney(q.held, c)})` });
  }
  if (!options.length) return messageModal({ body: 'You do not have enough spare cash to invest.' });
  const choice = await pickModal({
    title: q.name,
    body: `${q.blurb} Price ${fmtMoney(q.price, c)}, ${pct(q.change)} this year.${q.held ? ` You hold ${fmtMoney(q.held, c)} (${pct(q.gain)} overall).` : ''}`,
    options,
  });
  if (!choice) return undefined;
  return report(api, choice[0] === 'buy' ? mkt.buy(q.id, choice[1]) : mkt.sell(q.id, choice[1]));
}

async function browseMarket(api) {
  const c = country();
  if (player().age < 18) return messageModal({ body: 'You need to be 18 to invest.' });
  const q = await pickModal({
    title: 'The market',
    body: 'Prices move once a year. Funds are steady; single companies swing; coins can do anything.',
    options: mkt.quotes().map((x) => ({ value: x, label: `${GLYPH[x.kind]} ${x.name}`,
      sub: `${fmtMoney(x.price, c)} · ${pct(x.change)} this year${x.held ? ` · you hold ${fmtMoney(x.held, c)}` : ''}` })),
  });
  return q ? tradeSecurity(api, q) : undefined;
}

// ---------- Borrowing ----------

async function borrowMoney(api) {
  const c = country();
  const amount = await pickModal({
    title: 'Borrow from the bank',
    body: `${Math.round(BANK_LOAN.rate * 100)}% a year over ${BANK_LOAN.years} years. The bank looks at your income and what you already owe.`,
    options: bank.loanOptions().map((o) => ({ value: o.amount, label: fmtMoney(o.amount, c), disabled: !o.approved,
      sub: o.approved ? `${fmtMoney(o.payment, c)} a year.` : o.reason })),
  });
  return amount ? report(api, bank.borrow(amount)) : undefined;
}

export default {
  id: 'holdings', title: 'Holdings', short: 'Holdings',
  icon: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  render(el, api) {
    const p = player();
    const c = country();
    const f = p.finance;
    const debt = f.loans.reduce((s, l) => s + l.principal, 0) + p.assets.reduce((s, a) => s + (a.mortgage?.principal ?? 0), 0);
    const home = estate.home();
    const living = home ? `In your ${home.name.charAt(0).toLowerCase() + home.name.slice(1)}` : p.flags.livesWithParents ? 'With your family'
      : p.education.enrolled && p.age >= 18 ? 'Student housing' : p.age >= 18 ? 'Renting' : 'With your family';

    const actions = [];
    if (p.age >= 18) actions.push(['property', 'Browse property'], ['market', 'Invest'], ['borrow', 'Borrow money']);
    if (p.age >= 17) actions.push(['vehicles', 'Browse vehicles']);
    if (cars.canTakeDrivingTest()) actions.push(['driving', 'Take driving lessons and the test']);
    if (cars.canLearnToFly() && p.age >= 21) actions.push(['flying', 'Learn to fly']);

    const row = (a, glyph, sub, value) => `
      <button class="row" data-asset="${a.id}">
        <div class="avatar glyph">${glyph}</div>
        <div class="main"><strong>${esc(a.name)}</strong><small>${esc(sub)}</small></div>
        <div class="side">${fmtMoney(value, c)}</div>
      </button>`;
    const props = estate.properties().map((a) => row(a, GLYPH.property,
      `${p.homeId === a.id ? 'Your home' : a.tenant ? 'Let to a tenant' : 'Empty'} · condition ${Math.round(a.condition)}%${a.mortgage ? ' · mortgaged' : ''}`, a.value)).join('');
    const vehs = cars.vehicles().map((a) => row(a, GLYPH[a.vehicleClass], `${a.age} yr old · condition ${Math.round(a.condition)}%`, a.value)).join('');
    const invs = mkt.quotes().filter((q) => q.held).map((q) => `
      <button class="row" data-security="${q.id}">
        <div class="avatar glyph">${GLYPH[q.kind]}</div>
        <div class="main"><strong>${esc(q.name)}</strong><small>${pct(q.change)} this year · ${pct(q.gain)} since you bought</small></div>
        <div class="side">${fmtMoney(q.held, c)}</div>
      </button>`).join('');
    const loans = f.loans.map((l) => `
      <div class="kv"><span>${esc(l.kind.charAt(0).toUpperCase() + l.kind.slice(1))} loan, ${l.yearsLeft} yr left</span>
        <span>${fmtMoney(l.principal, c)} ${l.kind !== 'student' || !p.education.enrolled ? `<button class="btn small" data-repay="${l.id}" ${f.cash < l.principal ? 'disabled' : ''} style="display:inline-flex;margin-left:6px">Pay off</button>` : ''}</span></div>`).join('');

    el.innerHTML = `
      <div class="card">
        <h3>Money</h3>
        ${kv([['Cash', fmtMoney(f.cash, c)], ['Debts', fmtMoney(debt, c)]])}
        <div class="kv"><span>Net worth</span><span><strong>${fmtMoney(netWorth(store.state), c)}</strong></span></div>
        ${kv([['Where you live', living], ['Lifetime earnings', fmtMoney(f.lifetimeEarned, c)], ['Lifetime tax paid', fmtMoney(f.lifetimeTaxPaid, c)],
    [`Income tax (${c.name})`, `${Math.round(c.incomeTax * 100)}%`],
    ...(bank.isBankrupt() ? [['Bankrupt until age', String(p.flags.bankruptUntil)]] : [])])}
      </div>
      ${actions.length ? `<div class="btn-stack" style="margin-bottom:14px">${actions.map(([id, label]) => `<button class="btn" data-go="${id}">${esc(label)}</button>`).join('')}</div>` : ''}
      ${props ? `<div class="section-label">Property</div>${props}` : ''}
      ${vehs ? `<div class="section-label">Vehicles</div>${vehs}` : ''}
      ${invs ? `<div class="section-label">Investments</div>${invs}` : ''}
      ${loans ? `<div class="card" style="margin-top:14px"><h3>Loans</h3>${loans}</div>` : ''}
      ${!props && !vehs && !invs ? '<p class="empty">You do not own any property, vehicles or investments.</p>' : ''}`;

    el.onclick = (e) => {
      const go = e.target.closest('[data-go]')?.dataset.go;
      if (go) {
        return { property: () => browseProperty(api), vehicles: () => browseVehicles(api), market: () => browseMarket(api),
          borrow: () => borrowMoney(api), driving: () => report(api, cars.takeDrivingTest()), flying: () => report(api, cars.learnToFly()) }[go]();
      }
      const repay = e.target.closest('[data-repay]')?.dataset.repay;
      if (repay) return report(api, bank.repayLoan(repay));
      const sec = e.target.closest('[data-security]')?.dataset.security;
      if (sec) return tradeSecurity(api, mkt.quotes().find((q) => q.id === sec));
      const id = e.target.closest('[data-asset]')?.dataset.asset;
      const a = p.assets.find((x) => x.id === id);
      if (a) return a.kind === 'property' ? openProperty(a, api) : openVehicle(a, api);
      return undefined;
    };
  },
};
