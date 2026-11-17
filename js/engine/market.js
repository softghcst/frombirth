// The stock and crypto market, and the housing market index. Prices are kept
// in base units and move once a year.
import { housingDriftIn } from './economy.js';
import { COUNTRY_LIST } from '../data/countries.js';
import { theCountry } from '../util.js';
import { rng } from '../rng.js';
import { uid, fmtMoney } from '../util.js';
import { store, player, country, log } from '../state.js';
import { SECURITIES, SECURITY_BY_ID } from '../data/securities.js';
import { book, toMinor } from './ledger.js';
import { YIELD, MIXES } from '../data/money.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

/** A standard normal draw from the saved RNG. */
function gauss() {
  const u = Math.max(rng.next(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

/** Makes sure the saved market has every security and a housing index. */
export function market() {
  const m = store.state.market;
  m.prices ??= {};
  m.history ??= {};
  m.housing ??= 1;
  // One housing market per country. Saves from before start every country where the single market stood.
  m.housingBy ??= {};
  for (const s of SECURITIES) {
    m.prices[s.id] ??= s.price;
    m.history[s.id] ??= [s.price];
  }
  return m;
}

/** A country's housing index: 1 where prices began. */
export const housingIndex = (countryId) => { const m = market(); return m.housingBy[countryId] ?? m.housing ?? 1; };

/** Current price of one unit, in local money. */
export const priceOf = (id) => market().prices[id] * country().currency.scale;
export const holding = (id) => player().assets.find((a) => a.kind === 'security' && a.catalogId === id);
export const portfolioValue = () =>
  player().assets.filter((a) => a.kind === 'security').reduce((s, a) => s + a.value * a.units, 0);

/** Everything on the market, with this year's move and what the player holds. */
export function quotes() {
  const m = market();
  return SECURITIES.map((s) => {
    const h = m.history[s.id];
    const prev = h[h.length - 2];
    const own = holding(s.id);
    return { id: s.id, name: s.name, kind: s.kind, blurb: s.blurb, price: priceOf(s.id),
      change: prev ? m.prices[s.id] / prev - 1 : 0,
      held: own ? own.value * own.units : 0,
      gain: own ? (own.value * own.units) / own.costBasis - 1 : 0 };
  });
}

export function buy(id, amount) {
  const p = player();
  const s = SECURITY_BY_ID[id];
  if (p.age < 18) return result(false, 'You need to be 18 to invest.', 'neutral');
  if (amount <= 0 || p.finance.cash < amount) return result(false, 'You do not have that much to invest.', 'neutral');
  const price = priceOf(id);
  p.finance.cash -= amount;
  let own = holding(id);
  if (!own) {
    own = { id: uid('asset'), kind: 'security', catalogId: id, name: s.name, purchasePrice: price, value: price,
      boughtAtAge: p.age, units: 0, costBasis: 0 };
    p.assets.push(own);
  }
  own.units += amount / price;
  own.costBasis += amount;
  own.value = price;
  const text = `You put ${fmtMoney(amount, country())} into ${s.name}.`;
  log(text);
  book({ cat: 'investments', src: 'action', desc: text });
  return result(true, text, 'neutral');
}

/** Sells a share of a holding (1 = all of it). Gains are taxed at half the income-tax rate. */
export function sell(id, fraction = 1) {
  const p = player();
  const c = country();
  const own = holding(id);
  if (!own) return result(false, 'You do not hold any.', 'neutral');
  const units = own.units * fraction;
  const proceeds = units * own.value;
  const cost = own.costBasis * fraction;
  const tax = Math.max(0, Math.round((proceeds - cost) * c.incomeTax * 0.5));
  p.finance.cash += Math.round(proceeds) - tax;
  p.finance.lifetimeTaxPaid += tax;
  own.units -= units;
  own.costBasis -= cost;
  if (fraction >= 1 || own.units * own.value < 1) p.assets = p.assets.filter((a) => a !== own);
  const gain = Math.round(proceeds - cost);
  const text = `You sold ${fmtMoney(proceeds, c)} of ${own.name}: ${gain >= 0 ? `a profit of ${fmtMoney(gain, c)}` : `a loss of ${fmtMoney(-gain, c)}`}${tax ? `, with ${fmtMoney(tax, c)} tax on the gain` : ''}.`;
  log(text, 'system', gain >= 0 ? 'good' : 'bad');
  book({ cat: 'investments', src: 'action', desc: text, split: [['tax', toMinor(tax, c.currency.code)]] });
  return result(true, text, gain >= 0 ? 'good' : 'bad');
}

export function sellEverything() {
  for (const a of player().assets.filter((x) => x.kind === 'security')) sell(a.catalogId, 1);
}

/** Yearly: every price moves; the housing index moves; holdings are revalued. */
export function tickMarket() {
  const p = player();
  const c = country();
  const m = market();
  const before = portfolioValue();
  const mood = gauss(); // the year the whole market had

  for (const s of SECURITIES) {
    const own = holding(s.id);
    if (s.bust && rng.chance(s.bust)) {
      m.prices[s.id] *= 0.03;
      if (own) log(`${s.name} collapsed. Your holding is almost worthless.`, 'system', 'bad');
    } else {
      const z = Math.max(-2.5, Math.min(2.5, 0.55 * s.beta * mood + 0.85 * gauss()));
      // Part of a holding's return is paid out (see payouts); the price grows by that much less.
      m.prices[s.id] = Math.max(0.0001, m.prices[s.id] * Math.exp(s.drift - (YIELD[s.id] ?? 0) - s.vol * s.vol / 2 + s.vol * z));
    }
    m.history[s.id].push(m.prices[s.id]);
    if (m.history[s.id].length > 30) m.history[s.id].shift();
    if (own) own.value = priceOf(s.id);
  }

  // Housing: one market per country, each mostly a slow climb, moved by that country's economy, now and then a slump.
  m.housingMoves = {};
  const owned = new Set(p.assets.filter((a) => a.kind === 'property').map((a) => a.countryId ?? p.countryId));
  for (const k of COUNTRY_LIST) {
    const slump = rng.chance(0.04);
    const move = slump ? -rng.int(12, 25) / 100 : rng.around(0.035, 0.05) + housingDriftIn(k.id);
    m.housingBy[k.id] = Math.round(Math.max(0.3, housingIndex(k.id) * (1 + move)) * 10000) / 10000;
    m.housingMoves[k.id] = move;
    if (slump && owned.has(k.id)) log(`The housing market ${k.id === p.countryId ? '' : `in ${theCountry(k.name)} `}slumped: prices fell ${Math.round(-move * 100)}% this year.`, 'system', 'bad');
  }
  m.housing = housingIndex(p.countryId); // kept for anything that still reads the single figure
  m.housingMove = m.housingMoves[p.countryId];

  if (before > 0) {
    const after = portfolioValue();
    const pct = Math.round((after / before - 1) * 100);
    log(`Your investments ${pct >= 0 ? 'rose' : 'fell'} ${Math.abs(pct)}% this year, to ${fmtMoney(after, c)}.`, 'system', pct >= 0 ? 'good' : 'bad');
  }
}

/** What a holding pays out a year, as a share of its price. */
export const yieldOf = (id) => YIELD[id] ?? 0;

/** Chooses whether a holding's payouts come as money or buy more of it. */
export function setReinvest(id, on) {
  const own = holding(id);
  if (!own) return result(false, 'You do not hold any.', 'neutral');
  own.reinvest = !!on;
  return result(true, on ? `Payouts from ${own.name} will buy more of it.` : `Payouts from ${own.name} will be paid to you.`, 'neutral');
}

/**
 * Yearly, after prices have moved: each holding pays out its share. The money
 * is income, taxed as it is paid at half the income-tax rate; it is either paid
 * to the player or used to buy more of the same holding, as they chose. Once a year.
 */
export function payouts() {
  const p = player();
  const c = country();
  const year = store.state.year;
  let paid = 0; let tax = 0; let reinvested = 0;
  for (const a of p.assets.filter((x) => x.kind === 'security')) {
    if (a.paidOut === year) continue;
    const gross = Math.floor(a.units * a.value * yieldOf(a.catalogId));
    if (gross <= 0) continue;
    const t = Math.floor(gross * c.incomeTax * 0.5);
    a.paidOut = year;
    paid += gross; tax += t;
    if (a.reinvest) { const net = gross - t; a.units += net / a.value; a.costBasis += net; reinvested += net; }
    else p.finance.cash += gross - t;
  }
  if (!paid) return 0;
  p.finance.lifetimeEarned += paid; p.finance.lifetimeTaxPaid += tax;
  // Money reinvested is still money earned: it is booked as a payout, then as a purchase.
  p.finance.cash += reinvested;
  book({ cat: 'dividends', src: 'year', key: `div:${year}`, desc: 'Payouts from your investments, after tax', split: [['tax', toMinor(tax, c.currency.code)]] });
  if (reinvested) { p.finance.cash -= reinvested; book({ cat: 'investments', src: 'year', desc: 'Payouts reinvested' }); }
  log(`Your investments paid out ${fmtMoney(paid, c)}${tax ? `, ${fmtMoney(tax, c)} of it in tax` : ''}${reinvested ? `. ${fmtMoney(reinvested, c)} was put back in` : ''}.`, 'system', 'good');
  return paid;
}

/** What a holding's price has done over the years the market remembers, in local money. */
export const priceHistory = (id) => (market().history[id] ?? []).map((x) => x * country().currency.scale);

/**
 * Spreads everything invested across a ready-made mix. Holdings outside the
 * mix are sold (and any gain taxed as usual); the money is put into the mix in
 * its proportions. Nothing is bought with money the player did not already have invested.
 */
export function rebalance(mixId) {
  const p = player();
  const mix = MIXES[mixId];
  if (!mix) return result(false, 'Choose a mix.', 'neutral');
  if (p.age < 18) return result(false, 'You need to be 18 to invest.', 'neutral');
  const before = p.finance.cash;
  for (const a of [...p.assets.filter((x) => x.kind === 'security')]) sell(a.catalogId, 1);
  const pot = Math.floor(p.finance.cash - before);
  if (pot <= 0) return result(false, 'You have nothing invested to spread.', 'neutral');
  const parts = Object.entries(mix.parts);
  let left = pot;
  parts.forEach(([id, share], i) => { const amt = i === parts.length - 1 ? left : Math.floor(pot * share); left -= amt; if (amt > 0) buy(id, amt); });
  const text = `You spread ${fmtMoney(pot, country())} across a ${mix.name.toLowerCase()} mix: ${parts.map(([id, share]) => `${Math.round(share * 100)}% ${SECURITY_BY_ID[id].name}`).join(', ')}.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}
