// Checks property across borders and currencies, and tax by place. Run with: node tests/property.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { COUNTRIES } from '../js/data/countries.js';
import { BUYING_FEE, FOREIGN_BUYER_FEE } from '../js/data/properties.js';
import * as estate from '../js/engine/realEstate.js';
import * as fx from '../js/engine/currency.js';
import { netWorth } from '../js/engine/finance.js';
import { estatePlan, willHeirs } from '../js/engine/death.js';
import { estateTax, relationOf } from '../js/engine/inheritance.js';
import { emigrate } from '../js/engine/emigration.js';

rng.seed(31337);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const near = (a, b, tol = 0.02) => Math.abs(a - b) <= Math.max(2, Math.abs(b) * tol);
const life = (id, city, cash = 3e6) => { do { store.state = createLife({ countryId: id, city }); } while (store.state.player.royal); const p = store.state.player; p.age = 40; p.birthYear = store.state.year; store.state.year += 40;
  p.finance.cash = Math.round(cash * COUNTRIES[id].currency.scale); p.flags.livesWithParents = false; p.education.enrolled = false; p.finance.loans = []; p.assets = []; for (const n of Object.values(store.state.npcs)) if (n.role === 'spouse' || n.role === 'partner') n.role = 'ex'; return p; };

// 1. Listings abroad are in the money of the place, and follow its prices and its cities.
let p = life('us', 'Chicago');
const mx = estate.listingsAbroad('mx', 'Oaxaca'); const mxc = estate.listingsAbroad('mx', 'Mexico City');
check(mx.length === 6 && mx.every((l) => l.code === 'MXN' && l.price > 0 && l.fees === Math.round(l.price * (BUYING_FEE + FOREIGN_BUYER_FEE))), 'six listings, priced in pesos, with the foreign buyer\'s fees');
const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const sample = (id, city) => { const all = []; for (let i = 0; i < 40; i++) { store.state.market.abroad = null; for (const l of estate.listingsAbroad(id, city)) all.push(l.price); } return med(all); };
check(sample('mx', 'Mexico City') > sample('mx', 'Oaxaca') * 1.4, 'the capital is dearer than a small city');
const here = (() => { const all = []; for (let i = 0; i < 40; i++) { store.state.market.listings = null; for (const l of estate.listings()) all.push(l.price); } return med(all); })();
check(fx.convert(sample('mx', 'Guadalajara'), 'MXN', 'USD') < here * 0.8, 'a house in Mexico costs less, in dollars, than one in Chicago');
section('listings abroad: local money, local prices, city by city');

// 2. Buying: from the account first, then everyday money at today's rate; money is conserved.
p = life('us', 'Chicago');
fx.exchange('USD', 'MXN', 20000);
let list = estate.listingsAbroad('mx', 'Mérida'); let l = list[1];
const total = l.price + l.fees; const acct = p.finance.accounts.MXN; const cash0 = p.finance.cash; const worth0 = netWorth(store.state);
check(l.quote.fromAccount === Math.min(acct, total) && (l.quote.fromCash > 0) === (total > acct), 'the quote uses the peso account first');
let r = estate.buyAbroad(l.id);
const a = p.assets.find((x) => x.kind === 'property');
check(r.ok && !!a && a.countryId === 'mx' && a.city === 'Mérida' && !a.mortgage && a.paidCode === 'MXN' && a.paidNative === l.price, 'bought outright, recorded where it stands and what was paid');
check((p.finance.accounts.MXN ?? 0) === acct - l.quote.fromAccount && p.finance.cash === cash0 - l.quote.fromCash, 'exactly what was quoted left the accounts');
check(near(a.value, fx.convert(l.price, 'MXN', 'USD'), 0.01), 'it is worth, in dollars, what was paid in pesos');
const lost = worth0 - netWorth(store.state); const feesUsd = fx.convert(l.fees, 'MXN', 'USD') + l.quote.fee;
check(near(lost, feesUsd, 0.03) && lost > 0, `net worth fell by the fees and nothing else (${lost} against ${feesUsd})`);
// Money is changed only when the peso account does not cover it all; when it does, there is no exchange to record.
check(l.quote.fromCash === 0 || (p.finance.fxLog.at(-1).what && p.finance.fxLog.at(-1).received === total - l.quote.fromAccount), 'any money changed for it is in the record');
check(!estate.buyAbroad(l.id).ok, 'a listing can be bought once');
p.finance.cash = 10; store.state.market.abroad = null; list = estate.listingsAbroad('jp', 'Tokyo');
check(list.every((x) => !x.quote.ok) && !estate.buyAbroad(list[0].id).ok && p.finance.cash === 10, 'no money, no purchase, nothing taken');
section('buying abroad: account first, then cash at today\'s rate; only the fees are lost');

// 3. Owning it: valued where it stands, moving with the currency; taxed there; cannot be lived in from here.
p = life('us', 'Chicago'); l = estate.listingsAbroad('mx', 'Mérida')[1]; estate.buyAbroad(l.id); const b = p.assets.find((x) => x.kind === 'property');
check(!estate.moveIn(b.id).ok, 'it cannot be lived in from another country');
check(estate.propertyTaxOn(b) === Math.round(b.value * COUNTRIES.mx.propertyTax), 'property tax is Mexico\'s');
const v0 = b.value; store.state.fx = { ...(store.state.fx ?? {}), MXN: (store.state.fx?.MXN ?? 1) * 1.25 }; estate.damageProperty(b, 0);
check(near(b.value, v0 / 1.25, 0.03), `when the peso weakens by a quarter, the house is worth a fifth less in dollars (${b.value} against ${v0})`);
estate.letOut(b.id); b.tenant.quality = 100; const rent = b.tenant.rent; const t1 = p.finance.lifetimeTaxPaid;
check(b.tenant.code === 'MXN' && Number.isInteger(rent), 'the rent is agreed in pesos');
const pesos0 = p.finance.accounts?.MXN ?? 0; estate.tickProperties();
const taxOnRent = Math.round(rent * COUNTRIES.mx.incomeTax);
check(p.finance.lifetimeTaxPaid > t1 && store.state.journal.some((j) => /Rent from your property abroad/.test(j.text)), 'rent came in and was taxed');
check((p.finance.accounts?.MXN ?? 0) - pesos0 <= rent - taxOnRent, `at Mexico's rate, into the peso account, less local costs (${(p.finance.accounts?.MXN ?? 0) - pesos0} of ${rent - taxOnRent})`);
section('owning abroad: local value and tax, exposure to the currency');

// 4. Selling abroad pays into the account in that currency.
const pes0 = p.finance.accounts?.MXN ?? 0; const cash2 = p.finance.cash; const proceeds = estate.saleProceeds(b);
r = estate.sellProperty(b.id);
check(r.ok && p.finance.cash === cash2 && near((p.finance.accounts.MXN ?? 0) - pes0, proceeds * fx.rate('USD', 'MXN'), 0.01), 'the sale is paid in pesos, into the peso account; dollars are untouched');
check(/paid in MXN/.test(r.text), 'and says so');
section('selling abroad: paid in the money of the place');

// 5. Moving to where the house is: it becomes a home, in local money, with no jump in value.
p = life('us', 'Chicago'); l = estate.listingsAbroad('pt', 'Lisbon')[1]; estate.buyAbroad(l.id); const h = p.assets.find((x) => x.kind === 'property');
const before = fx.convert(h.value, 'USD', 'EUR');
for (let i = 0; i < 60 && p.countryId === 'us'; i++) { p.flags.visaAge = null; emigrate('pt', { city: 'Lisbon' }); }
check(p.countryId === 'pt' && near(h.value, before, 0.03), `after moving there it is valued in euros at the same worth (${h.value} against ${before})`);
check(estate.moveIn(h.id).ok && p.homeId === h.id, 'and can be moved into');
estate.damageProperty(h, 0); check(near(h.value, before, 0.05), 'revaluing it does not move it');
section('moving to it: the same house, now at home');

// 6. Inheritance tax by place.
p = life('us', 'Chicago', 20e6); l = estate.listingsAbroad('jp', 'Osaka')[2]; estate.buyAbroad(l.id); const j = p.assets.find((x) => x.kind === 'property'); j.value = 2e6; // above Japan's allowance, so both countries charge something
let plan = estatePlan();
const jp = plan.taxBy?.find((t) => t.countryId === 'jp'); const us = plan.taxBy?.find((t) => t.countryId === 'us');
const takers = willHeirs().map(([n, share]) => ({ relation: relationOf(n.role), share }));
const fxj = COUNTRIES.jp.currency.scale / COUNTRIES.us.currency.scale;
check(!!jp && near(jp.amount, estateTax(j.value * fxj, COUNTRIES.jp, takers) / fxj, 0.01), `the house in Japan is taxed by Japan, under Japan's scale (${jp?.amount})`);
check(!!us && near(us.amount, 0.4 * (plan.gross - j.value - 15e6), 0.01) && plan.tax === plan.taxBy.reduce((s, t) => s + t.amount, 0), 'the rest is taxed where the owner lived (40% above the US exemption), and the parts add up');
check(plan.net === plan.gross - plan.tax - (plan.probate ?? 0) && plan.tax + (plan.probate ?? 0) <= plan.liquid, 'tax, and the cost of winding up the estate, never exceed what can be paid without selling');
const noAbroad = (() => { const keep = p.assets; p.assets = []; p.finance.cash += j.value; const t = estatePlan().tax; p.assets = keep; p.finance.cash -= j.value; return t; })();
check(near(plan.tax, noAbroad - 0.4 * j.value + jp.amount, 0.01), 'holding it abroad moves that part of the bill from the US to Japan');
p.finance.cash = 100; plan = estatePlan(); check(plan.tax <= Math.max(0, plan.liquid) && plan.taxBy.reduce((s, t) => s + t.amount, 0) <= plan.tax + 2, 'with no cash, each country takes a share of what little there is');
section('inheritance: property abroad is taxed where it stands, the rest where the owner lived');

// 7. A run of years with property abroad does not break anything.
p = life('uk', 'Leeds'); l = estate.listingsAbroad('es', 'Madrid')[0]; estate.buyAbroad(l.id); estate.letOut(p.assets[0].id);
for (let i = 0; i < 25; i++) { try { advanceYear(); } catch (err) { problems.push(`year ${i}: ${err.message}`); break; } store.state.pendingEvents = []; p.legal.pending = null; p.stats.health = 90; const pr = p.assets.find((x) => x.kind === 'property'); if (pr) check(Number.isFinite(pr.value) && pr.value > 0, 'value went bad'); }
check(Number.isFinite(netWorth(store.state)) && Number.isFinite(p.finance.cash), 'money stayed finite over twenty-five years');
section('twenty-five years as a landlord abroad');

// 8. Each country has its own housing market, and loans keep their currency across a move.
{
const m = await import('../js/engine/market.js');
p = life('us', 'Chicago');
for (let i = 0; i < 15; i++) m.tickMarket();
const idx = store.state.market.housingBy;
check(Object.keys(idx).length >= 100 && new Set(Object.values(idx).map((v) => v.toFixed(3))).size > 20, 'housing markets move separately from country to country');
check(store.state.market.housing === m.housingIndex('us'), 'the old single figure follows the country the player lives in');
const avgPrice = () => { let t = 0; let n = 0; for (let i = 0; i < 40; i++) { store.state.market.abroad = null; for (const l of estate.listingsAbroad('mx', 'Mérida')) { t += l.price; n += 1; } } return t / n; };
const before = avgPrice();
store.state.market.housingBy.mx = m.housingIndex('mx') * 2;
const doubled = avgPrice();
check(doubled > before * 1.3, 'a Mexican boom raises Mexican prices');
p = life('us', 'Chicago'); { const { hire } = await import('../js/engine/career.js'); const { CAREERS } = await import('../js/data/careers.js'); hire(CAREERS.find((c) => c.id === 'office'), 2, 70); }
store.state.market.listings = null; const l2 = estate.listings()[1];
const terms = estate.mortgageTerms(l2.price); const dep = Math.max(terms.minDeposit, l2.price - terms.maxLoan);
const bought = estate.buyProperty(l2.id, dep);
const hm = p.assets.find((x) => x.kind === 'property');
if (bought.ok && hm.mortgage) {
  check(hm.mortgage.code === 'USD', 'a mortgage records its currency');
  const principal = hm.mortgage.principal; const owedUsd = estate.owedOn(hm);
  for (let i = 0; i < 60 && p.countryId === 'us'; i++) { p.flags.visaAge = null; emigrate('mx', { city: 'Guadalajara' }); }
  check(p.countryId === 'mx' && hm.mortgage.principal === principal && hm.mortgage.code === 'USD', 'after moving to Mexico the mortgage is still in dollars, unchanged');
  check(Math.abs(estate.owedOn(hm) - fx.convert(owedUsd, 'USD', 'MXN')) <= Math.max(5, estate.owedOn(hm) * 0.01), 'and counted in pesos at today\'s rate');
  estate.tickProperties();
  check(hm.mortgage == null || hm.mortgage.principal < principal, 'payments keep going down in dollars');
  check(Number.isFinite(netWorth(store.state)), 'net worth stays sound');
} else problems.push(`the test mortgage could not be taken out: ${bought.text}`);
section('markets: one housing market per country; mortgages and rent stay in the money they were agreed in');
}

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)]) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('Property and tax hold across borders.');
