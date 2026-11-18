// Money balance playtest. Lives many lives with a simple auto-player and prints where the money ends up,
// in years of an ordinary local wage, so that countries can be compared. It changes nothing.
//
//   node scripts/money-playtest.mjs [seed] [countries] [lives per country] [plain|careless]
//   node scripts/money-playtest.mjs 2026 us,uk,de,fr,jp,in,br,ng,mx,au,cn,za 6 careless
//
// plain:    works from 18, a savings account at 20, a pension plan at 25, a card paid in full, retires at 66
// careless: two cards paid at the minimum, the dearest car on finance, the biggest house a lender allows,
//           everything in one volatile share, and the largest bank loan on offer every five years
// Scene choices are picked at random. WHY=1 prints the journal around each insolvency; NOPETS=1 turns off pet costs.
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] };
const R = new URL('../js/', import.meta.url).href;
const { store } = await import(R + 'state.js'); const { rng } = await import(R + 'rng.js');
const { createLife } = await import(R + 'engine/characterGen.js'); const { advanceYear } = await import(R + 'engine/yearProcessor.js');
const { COUNTRIES } = await import(R + 'data/countries.js');
const { getEvent, resolveChoice, choiceStates } = await import(R + 'engine/eventEngine.js');
const { netWorth } = await import(R + 'engine/finance.js');
const { yearTotals, audit, bookAction } = await import(R + 'engine/ledger.js');
const bank = await import(R + 'engine/banking.js'); const cards = await import(R + 'engine/cards.js'); const ret = await import(R + 'engine/retirement.js');
const career = await import(R + 'engine/career.js'); const pt = await import(R + 'engine/partTime.js');
const { npcWorth } = await import(R + 'engine/npcMoney.js');
const { heirs } = await import(R + 'engine/legacy.js');
const { CAREERS } = await import(R + 'data/careers.js');
const { typicalWage } = await import(R + 'engine/systems.js');
const estateE = await import(R + 'engine/realEstate.js'); const cars = await import(R + 'engine/vehicles.js'); const mkt = await import(R + 'engine/market.js');
const CARELESS = process.argv[5] === 'careless';
if (process.env.NOPETS) { const m = await import(R + 'data/money.js'); m.PETS.upkeep = 0; m.PETS.emergency = 0; }

rng.seed(Number(process.argv[2] ?? 2026));
const COUNTRY_IDS = (process.argv[3] ?? 'us,uk,de,fr,jp,in,br,ng,mx,au,cn,za').split(',');
const PER = Number(process.argv[4] ?? 4);
const rows = []; const events = {}; const relatives = [];
const bump = (k, n = 1) => { events[k] = (events[k] ?? 0) + n; };

for (const id of COUNTRY_IDS) for (let k = 0; k < PER; k++) {
  do { store.state = createLife({ countryId: id }); } while (store.state.player.royal);
  const p = store.state.player;
  const w = () => typicalWage(COUNTRIES[p.countryId]); // an ordinary yearly wage where they live
  const r = { id, worth: {}, overdrawnYears: 0, maxDebtToWage: 0, inherited: 0, helped: 0, payouts: 0, cardCarry: 0 };
  while (p.alive && p.age < 110) {
    advanceYear();
    if (!p.alive) break;
    // A plain player: a part-time job at 16, a career at 18 if they can get one, a savings account and a pension plan, retire at 66.
    if (p.age >= 16 && p.age < 18 && !p.career.partTime && pt.canWorkPartTime()) { const j = pt.jobOptions().find((x) => x.available); if (j) pt.takeJob(j.id); }
    if (p.age >= 18 && p.age < 60 && !p.career.careerId && !p.education.enrolled && !p.legal.incarceration) {
      const ok = CAREERS.filter((c) => c.type === 'fulltime' && !career.unmet(c).length);
      if (ok.length && rng.chance(0.6)) career.hire(rng.pick(ok), 0, 55, 'Hired.');
    }
    if (CARELESS) {
      if (p.age === 21) { cards.applyForCard(); cards.applyForCard(); for (const k of cards.cards()) cards.setCard(k.id, { autopay: 'min' }); }
      if (p.age === 24) { p.flags.licence = true; p.flags.drivingLicence = true; const l = cars.listings().filter((x) => !x.blocked && x.finance.approved).sort((a, b) => b.price - a.price)[0]; if (l) cars.buyVehicle(l.id, 'loan'); }
      if (p.age === 30 && !p.homeId) { const L = estateE.listings().sort((a, b) => b.price - a.price); for (const l of L) { const t = estateE.mortgageTerms(l.price); const dep = Math.max(t.minDeposit, l.price - t.maxLoan); if (t.available && dep + l.fees <= p.finance.cash) { if (estateE.buyProperty(l.id, dep).ok) { estateE.moveIn(p.assets.at(-1).id); r.bought = true; } break; } } }
      if (p.age === 32 && p.finance.cash > 1000) mkt.buy('voltaic', Math.floor(p.finance.cash * 0.8));
      if (p.age % 5 === 0 && p.age >= 25 && p.age <= 55) { const o = (await import(R + 'engine/loans.js')).loanOptions().filter((x) => x.approved).at(-1); if (o) (await import(R + 'engine/loans.js')).borrow(o.amount); }
    } else
    if (p.age === 20 && !bank.accounts().length) { const b = bank.banksHere().find((x) => x.products.includes('savings')); if (b) bank.openAccount(b.id, 'savings', Math.max(0, Math.floor(p.finance.cash * 0.3))); }
    if (p.age === 25) ret.openPlan(0.06);
    if (p.age === 23 && rng.chance(0.6)) cards.applyForCard();
    if (p.age >= 66 && p.career.careerId && career.canRetire()) career.retire();
    // Scenes: a random choice among those available.
    while (store.state.pendingEvents.length && p.alive) {
      const pe = store.state.pendingEvents.shift(); const ev = getEvent(pe.id); if (!ev) continue;
      const open = choiceStates(ev, pe.cast).map((c, i) => [c, i]).filter(([c]) => c.enabled);
      if (!open.length) continue;
      const res = resolveChoice(ev, rng.pick(open)[1], pe.cast);
      if (res.death) { p.alive = false; break; }
    }
    if (!p.alive) break;
    if (process.env.WHY && p.milestones.at(-1)?.age === p.age && /bankrupt|plan|arrears/i.test(p.milestones.at(-1).text) && !r.told) { r.told = true; console.log('\n### ' + id + ' age ' + p.age + ' job: ' + (p.career.title ?? 'none') + ', salary ' + p.career.salary); for (const e of store.state.journal.filter((e) => e.age >= p.age - 1)) console.log('   ' + e.age + ' ' + e.text.slice(0, 150)); }
    bookAction();
    if (p.finance.cash < 0) r.overdrawnYears++;
    const debt = p.finance.loans.reduce((s, l) => s + l.principal, 0) + cards.cardDebt();
    r.maxDebtToWage = Math.max(r.maxDebtToWage, debt / w());
    if ([25, 40, 55, 70, 85].includes(p.age)) r.worth[p.age] = netWorth(store.state) / w();
    if (p.age === 55) { const o = bank.overview(); const plan = ret.plan(); r.at55 = { cash: o.cash / w(), bank: (o.bank - (plan ? plan.account.bal / 100 : 0)) / w(), plan: (plan ? plan.account.bal / 100 : 0) / w(), salary: (p.career.salary || 0) / w(), earnedPerYear: p.finance.lifetimeEarned / Math.max(1, p.age - 16) / w(), spent: o.spent / w() }; }
    const t = yearTotals(store.state.ledger, store.state.year, store.state.ledger.home);
    r.inherited += (t.income.inheritance ?? 0) / 100 / w(); r.helped += (t.income.giftIn ?? 0) / 100 / w(); r.payouts += (t.income.dividends ?? 0) / 100 / w();
    if (cards.cardDebt() > 0) r.cardCarry++;
    const bad = audit(); if (bad.length) { bump('AUDIT FAIL'); console.log(id, p.age, bad[0]); break; }
  }
  r.age = p.age; r.alive = p.alive; r.cause = store.lastObituary?.causeOfDeath;
  r.bankrupt = p.milestones.some((m) => /bankrupt|repayment plan|arrears/i.test(m.text));
  r.homeowner = !!r.bought || p.assets.some((a) => a.kind === 'property');
  r.estate = store.lastObituary ? store.lastObituary.estate.gross / w() : null;
  r.statePension = p.flags.statePension ? p.flags.statePension / w() : 0;
  for (const m of p.milestones) if (m.kind === 'money') bump(m.text.replace(/ [A-Z][a-z]+\.$|: .*$/, ''));
  // Relatives' finances, as they stood at the end.
  for (const n of Object.values(store.state.npcs)) { const f = n.life?.fin; if (f && n.age >= 25) relatives.push({ age: n.age, worth: npcWorth(n) / w(), homeEq: f.home ? (f.home.value - f.home.mortgage) / w() : 0, homeVal: f.home ? f.home.value / w() : null, homePaid: f.home ? f.home.paid / w() : null, liquid: ((n.life.savings ?? 0) + (f.bank?.bal ?? 0) + f.invested) / w(), salary: (n.life.job?.salary ?? 0) / w(), home: !!f.home, debt: f.debt / w(), card: f.card?.balance ? f.card.balance / w() : 0, defaulted: !!f.defaulted, retiredEarly: f.history.some((h) => /early/.test(h.text)) }); }
  rows.push(r);
}
const q = (xs, p) => { const s = xs.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) * p)] : null; };
const f1 = (x) => (x == null ? '-' : x.toFixed(1));
const dist = (label, xs) => console.log(`${label.padEnd(34)} n=${String(xs.filter((x) => x != null).length).padStart(3)}  p10 ${f1(q(xs, 0.1)).padStart(7)}  p50 ${f1(q(xs, 0.5)).padStart(7)}  p90 ${f1(q(xs, 0.9)).padStart(7)}`);
console.log(`\n${rows.length} lives. Money is in years of an ordinary local wage.\n`);
for (const a of [25, 40, 55, 70, 85]) dist(`Net worth at ${a}`, rows.map((r) => r.worth[a] ?? null));
dist('Estate at death', rows.map((r) => r.estate));
dist('Age at death', rows.map((r) => r.age));
dist('Years overdrawn in a life', rows.map((r) => r.overdrawnYears));
dist('Highest debt (years of wage)', rows.map((r) => r.maxDebtToWage));
dist('Years carrying a card balance', rows.map((r) => r.cardCarry));
dist('Inherited over a life', rows.map((r) => r.inherited));
dist('Help from family over a life', rows.map((r) => r.helped));
dist('Investment payouts over a life', rows.map((r) => r.payouts));
dist('State pension (share of wage)', rows.map((r) => r.statePension || null));
const pct = (f) => `${Math.round(rows.filter(f).length / rows.length * 100)}%`;
console.log(`\nInsolvent at some point: ${pct((r) => r.bankrupt)}   Owned a home: ${pct((r) => r.homeowner)}   Still alive at 110 cap: ${pct((r) => r.alive)}`);
console.log('\nBy country, median net worth at 55 / estate:');
for (const id of COUNTRY_IDS) { const rs = rows.filter((r) => r.id === id); console.log(`  ${id}  ${f1(q(rs.map((r) => r.worth[55] ?? null), 0.5)).padStart(6)}  ${f1(q(rs.map((r) => r.estate), 0.5)).padStart(6)}`); }
console.log(`\nRelatives (25+), ${relatives.length}:`);
dist('  their net worth', relatives.map((x) => x.worth));
dist('  home equity', relatives.map((x) => x.homeEq)); dist('  home value now', relatives.map((x) => x.homeVal)); dist('  home price paid', relatives.map((x) => x.homePaid)); dist('  savings, bank, investments', relatives.map((x) => x.liquid)); dist('  salary', relatives.map((x) => x.salary || null));
console.log(`  own a home ${Math.round(relatives.filter((x) => x.home).length / relatives.length * 100)}%  in debt ${Math.round(relatives.filter((x) => x.debt > 0).length / relatives.length * 100)}%  carrying a card ${Math.round(relatives.filter((x) => x.card > 0).length / relatives.length * 100)}%  defaulted ${Math.round(relatives.filter((x) => x.defaulted).length / relatives.length * 100)}%  retired early ${Math.round(relatives.filter((x) => x.retiredEarly).length / relatives.length * 100)}%`);
console.log('\nAt 55: where the money is (years of wage)');
for (const k of ['cash', 'bank', 'plan', 'salary', 'earnedPerYear', 'spent']) dist(`  ${k}`, rows.map((r) => r.at55?.[k] ?? null));
const causes = {}; for (const r of rows) causes[r.cause] = (causes[r.cause] ?? 0) + 1;
console.log('\nCauses of death:', Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${v} ${k}`).join(' · '));
console.log('\nMoney milestones across all lives:');
for (const [k, v] of Object.entries(events).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${String(v).padStart(4)}  ${k}`);
