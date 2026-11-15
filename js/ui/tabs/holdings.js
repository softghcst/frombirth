// Holdings tab: money, debts and owned assets. Phase 6 adds buying and selling.
import { store, player, country } from '../../state.js';
import { esc, fmtMoney } from '../../util.js';
import { netWorth } from '../../engine/finance.js';

export default {
  id: 'holdings', title: 'Holdings', short: 'Holdings',
  icon: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  render(el) {
    const p = player();
    const c = country();
    const f = p.finance;
    const debt = f.loans.reduce((s, l) => s + l.principal, 0);

    const assets = p.assets.length
      ? p.assets.map((a) => `
          <div class="row"><div class="main"><strong>${esc(a.name)}</strong>
            <small>${esc(a.kind)}${a.condition != null ? ` · condition ${Math.round(a.condition)}%` : ''}</small></div>
            <div class="side">${fmtMoney(a.value * (a.units ?? 1), c)}</div></div>`).join('')
      : '<p class="empty">You do not own any property, vehicles or investments.</p>';

    const loans = f.loans.map((l) => `
      <div class="kv"><span>${esc(l.kind)} loan, ${l.yearsLeft} yr left</span><span>${fmtMoney(l.principal, c)}</span></div>`).join('');

    el.innerHTML = `
      <div class="card">
        <h3>Money</h3>
        <div class="kv"><span>Cash</span><span>${fmtMoney(f.cash, c)}</span></div>
        <div class="kv"><span>Debts</span><span>${fmtMoney(debt, c)}</span></div>
        <div class="kv"><span>Net worth</span><span><strong>${fmtMoney(netWorth(store.state), c)}</strong></span></div>
        <div class="kv"><span>Lifetime earnings</span><span>${fmtMoney(f.lifetimeEarned, c)}</span></div>
        <div class="kv"><span>Lifetime tax paid</span><span>${fmtMoney(f.lifetimeTaxPaid, c)}</span></div>
        <div class="kv"><span>Income tax rate (${esc(c.name)})</span><span>${Math.round(c.incomeTax * 100)}%</span></div>
      </div>
      ${loans ? `<div class="card"><h3>Loans</h3>${loans}</div>` : ''}
      <div class="section-label">Assets</div>
      ${assets}`;
  },
};
