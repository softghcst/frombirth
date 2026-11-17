// Checks the ledger, banking, goals, budget and lending record. Run with: node tests/money.mjs
//
// The rule being tested throughout: money moves, it is never made or lost by
// the bookkeeping. Every transaction balances, the ledger always agrees with
// the game's own cash and debts, and nothing is posted twice.

// Saving and loading need somewhere to keep things.
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] };
Object.defineProperty(globalThis.localStorage, Symbol.iterator, { value: () => disk.keys() });

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { COUNTRIES } = await import('../js/data/countries.js');
const { CAREERS } = await import('../js/data/careers.js');
const ledger = await import('../js/engine/ledger.js');
const { Money, toMinor, fromMinor, book, bookAction, post, audit, yearTotals, ledgerOf, compact, KEEP_YEARS } = ledger;
const bank = await import('../js/engine/banking.js');
const credit = await import('../js/engine/credit.js');
const { netWorth } = await import('../js/engine/finance.js');
const loans = await import('../js/engine/loans.js');
const mkt = await import('../js/engine/market.js');
const estate = await import('../js/engine/realEstate.js');
const fx = await import('../js/engine/currency.js');
const { hire, retire } = await import('../js/engine/career.js');
const partTime = await import('../js/engine/partTime.js');
const { emigrate } = await import('../js/engine/emigration.js');
const death = await import('../js/engine/death.js');
const { heirs, continueAs } = await import('../js/engine/legacy.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { decimalsOf, BANKS, PRODUCTS, CATEGORIES } = await import('../js/data/money.js');

rng.seed(20261117);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const sound = (where) => { const bad = audit(); check(!bad.length, `${where}: ${bad.slice(0, 3).join('; ')}`); };
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

/** A fresh adult with a given amount of everyday money and nothing else. */
function life(id = 'us', { age = 30, cash = 20000 } = {}) {
  do { store.state = createLife({ countryId: id }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age;
  p.finance.cash = Math.round(cash * COUNTRIES[id].currency.scale);
  p.flags.livesWithParents = age < 18; p.education.enrolled = false; p.finance.loans = []; p.assets = [];
  for (const n of Object.values(store.state.npcs)) if (n.role === 'spouse' || n.role === 'partner') n.role = 'ex';
  ledgerOf();
  return p;
}
const office = CAREERS.find((k) => k.type === 'fulltime' && k.category === 'professional');
const bankWith = (product) => bank.banksHere().find((b) => b.products.includes(product));
const txs = () => store.state.ledger.tx;
const held = () => { const p = store.state.player; return p.finance.cash + bank.bankWorth(); };

// ---------- 1. Money itself ----------
check(toMinor(12.34, 'USD') === 1234 && toMinor(1234, 'JPY') === 1234 && toMinor(1.234, 'KWD') === 1234, 'two, no and three decimal places');
check(decimalsOf('KRW') === 0 && decimalsOf('EUR') === 2 && fromMinor(1234, 'JPY') === 1234 && fromMinor(1234, 'USD') === 12.34, 'smallest units turn back into whole ones');
check(toMinor(0.1 + 0.2, 'USD') === 30, 'a float that is not quite 0.3 is still thirty cents');
check(Money.add(Money.of(100, 'USD'), Money.of(250, 'USD')).minor === 350 && Money.sub(Money.of(100, 'USD'), Money.of(250, 'USD')).minor === -150, 'adding and taking away');
check(Money.cmp(Money.of(1, 'EUR'), Money.of(2, 'EUR')) === -1, 'comparing');
check(throws(() => Money.add(Money.of(100, 'USD'), Money.of(100, 'EUR'))) && throws(() => Money.cmp(Money.of(1, 'USD'), Money.of(1, 'JPY'))), 'two currencies cannot be added or compared without an exchange');
check(throws(() => Money.of(1.5, 'USD')) && throws(() => toMinor(1e20, 'USD')), 'fractions of a cent and absurd sums are refused');
const parts = Money.allocate(10000, [1, 1, 1]);
check(parts.reduce((s, x) => s + x, 0) === 10000 && Math.max(...parts) - Math.min(...parts) <= 1, 'a sum shared three ways still adds up to itself');
check(Money.bp(9_000_000_000_000_000, 500) === 450_000_000_000_000, 'interest on a vast sum is exact');
const yen = Money.exchange(Money.of(10000, 'USD'), 'JPY', 150);
check(yen.code === 'JPY' && yen.minor === 15000, 'a hundred dollars at 150 is fifteen thousand yen, with no cents');
check(Money.exchange(Money.of(999, 'JPY'), 'USD', 1 / 150).minor === 666, 'changing money rounds down, never up');
section('money: smallest units, no mixing of currencies, exact shares and interest');

// ---------- 2. The book balances, and cannot be written in twice ----------
let p = life('us');
sound('a new ledger');
const L0 = store.state.ledger;
check(L0.accounts['wallet:USD'].bal === 2_000_000 && txs().length === 1 && txs()[0].cat === 'opening', 'a life that already has money opens with one entry saying so');
check(post(L0, { year: store.state.year, age: 30, cat: 'other', desc: 'lopsided', entries: [['wallet:USD', -500]] }).ok === false, 'a transaction that does not balance is refused');
check(post(L0, { year: store.state.year, age: 30, cat: 'other', desc: 'nowhere', entries: [['wallet:USD', -500], ['nope', 500]] }).ok === false, 'an entry on an account that does not exist is refused');
check(L0.accounts['wallet:USD'].bal === 2_000_000, 'a refused transaction changes nothing');
p.finance.cash -= 120;
const t1 = book({ cat: 'leisure', desc: 'A night out', key: 'night-out' });
check(t1 && t1.entries.length === 2 && L0.accounts['wallet:USD'].bal === 1_988_000 && L0.accounts['n:leisure:USD'].bal === 12_000, 'spending is booked as money leaving for somewhere');
check(book({ cat: 'leisure', desc: 'A night out' }) === null, 'with nothing changed, nothing is booked');
const n0 = txs().length;
const again = post(L0, { year: store.state.year, age: 30, cat: 'leisure', desc: 'A night out', key: 'night-out', entries: [['wallet:USD', -12000], ['n:leisure:USD', 12000]] });
check(again.ok && again.dup && txs().length === n0 && L0.accounts['wallet:USD'].bal === 1_988_000, 'the same key posts once, however often it is tried');
sound('after spending');
section('ledger: every transaction balances; refused ones change nothing; a key posts once');

// ---------- 3. Banking ----------
p = life('us');
check(bank.banksHere().length >= 2 && bank.banksHere().every((b) => BANKS.includes(b)), 'there are banks here');
const sv = bankWith('savings');
const before = held();
let r = bank.openAccount(sv.id, 'savings', 5000);
check(r.ok && bank.accounts().length === 1 && p.finance.cash === 15000 && bank.accounts()[0].bal === 500_000, 'opening an account moves the deposit out of everyday money');
check(held() === before && p.milestones.some((m) => m.text === 'Opened a first bank account.'), 'nothing was gained or lost by it, and it is remembered');
const sid = r.id;
check(!bank.deposit(sid, 999999).ok && !bank.deposit(sid, 12.5).ok && !bank.deposit(sid, -5).ok && p.finance.cash === 15000, 'you cannot pay in what you do not have, or a fraction, or a negative');
check(bank.deposit(sid, 1000).ok && p.finance.cash === 14000 && bank.accountById(sid).bal === 600_000, 'paying in');
check(!bank.withdraw(sid, 7000).ok && bank.withdraw(sid, 2000).ok && p.finance.cash === 16000 && bank.accountById(sid).bal === 400_000, 'taking out, but not more than is there');
const cu = bankWith('current');
const cid = bank.openAccount(cu.id, 'current', 0).id;
const nw = netWorth(store.state);
check(bank.transfer(sid, cid, 1500).ok && bank.accountById(sid).bal === 250_000 && bank.accountById(cid).bal === 150_000 && netWorth(store.state) === nw, 'moving between accounts changes neither everyday money nor net worth');
const moved = txs().at(-1);
check(moved.cat === 'transfer' && CATEGORIES.transfer.kind === 'transfer' && yearTotals(store.state.ledger, store.state.year, 'USD').in === 0, 'a transfer is not income');
check(!bank.transfer(sid, sid, 10).ok && !bank.transfer(sid, cid, 99999).ok, 'not to itself, and not more than is there');
check(held() === before, 'through all of it, the money held is what it was');
// Who may open what.
check(/\$5,000\b/.test(r.text) && !/\$5,000\.00/.test(r.text), `amounts are written out whole (${r.text})`);
check(!bank.eligible('youth').ok && !bank.eligible('student').ok, 'an adult who is not studying is offered neither a child\'s account nor a student\'s');
check(bank.accounts()[0].owners.length === 1 && bank.accounts()[0].owners[0].role === 'owner' && bank.accounts()[0].owners[0].id === p.id, 'the account belongs to the person who opened it');
// A fixed deposit.
const tb = bankWith('term2');
check(!bank.openAccount(tb.id, 'term2', 10).ok, 'a fixed deposit needs its minimum');
const tid = bank.openAccount(tb.id, 'term2', 3000).id;
check(!bank.withdraw(tid, 100).ok && !bank.deposit(tid, 100).ok && bank.accountById(tid).locked, 'a fixed deposit is locked');
const cost = bank.breakCost(bank.accountById(tid));
const c0 = p.finance.cash;
check(cost > 0 && bank.closeAccount(tid).ok && toMinor(p.finance.cash - c0, 'USD') === 300_000 - cost && bank.accountById(tid).closed != null, 'breaking it early pays out the rest, less a year of interest');
check(!bank.deposit(tid, 10).ok && !bank.closeAccount(tid).ok && bank.closedAccounts().length === 1, 'a closed account stays closed, and stays on record');
sound('after banking');
section('banking: open, pay in, take out, move, close; ownership; fixed deposits; nothing made or lost');

// A child needs a guardian; the guardian does not own the money.
p = life('uk', { age: 12, cash: 300 });
const yb = bankWith('youth');
r = bank.openAccount(yb.id, 'youth', 100);
const hasParent = Object.values(store.state.npcs).some((n) => n.alive && (n.role === 'parent' || n.role === 'grandparent'));
check(r.ok === hasParent, 'a child opens an account only with a parent or guardian');
if (r.ok) {
  const a = bank.accountById(r.id);
  check(a.owners.find((o) => o.role === 'custodian') && a.owners.find((o) => o.role === 'owner').id === p.id, 'the child owns it; the parent is a custodian, not an owner');
  check(!bank.eligible('savings').ok && !bank.eligible('term2').ok, 'a child is not offered adult accounts');
  for (const n of Object.values(store.state.npcs)) if (n.role === 'parent' || n.role === 'grandparent') n.alive = false;
  check(!bank.eligible('youth').ok, 'with no guardian, no new account');
}
section('banking: children need a guardian, who is not an owner');

// ---------- 4. Interest, month by month, once ----------
p = life('us', { cash: 50000 });
const hb = bankWith('savings');
const iid = bank.openAccount(hb.id, 'savings', 10000).id;
const rate = bank.accountById(iid).rateBp;
let want = 1_000_000; for (let m = 0; m < 12; m++) want += Number(BigInt(want) * BigInt(rate) / 120000n);
bank.tickBanking();
const intTax = Math.floor((want - 1_000_000) * COUNTRIES.us.incomeTax * 0.5);
check(bank.accountById(iid).bal === want - intTax && want > 1_000_000 + 1_000_000 * rate / 10000, `twelve months of interest, compounding, less the tax on it (${bank.accountById(iid).bal} against ${want - intTax})`);
bank.tickBanking();
check(bank.accountById(iid).bal === want - intTax, 'the same year\'s interest is not paid, or taxed, twice');
check(yearTotals(store.state.ledger, store.state.year, 'USD').expense.tax === intTax && intTax > 0, 'the tax on interest is recorded as tax');
check(yearTotals(store.state.ledger, store.state.year, 'USD').income.interestIncome === want - 1_000_000, 'interest is income, and is recorded as such');
sound('after interest');
section('interest: monthly, compounding, exact, and paid once a year');

// ---------- 5. The first working slice, start to finish (the 25 steps) ----------
disk.clear();
p = life('us', { age: 16, cash: 400 });                                   // 1. a real character
p.flags.firstPay = false;
let o = bank.overview();                                                    // 2-3. My Money shows what they have
check(o.cash === 400 && o.netWorth === netWorth(store.state), 'the overview shows the character\'s actual money');
const g = Object.values(store.state.npcs).find((n) => n.role === 'parent');
if (!g) { const any = Object.values(store.state.npcs)[0]; any.role = 'parent'; any.alive = true; }
r = bank.openAccount(bankWith('youth').id, 'youth', 0);                      // 4. an account they are allowed
check(r.ok, `a sixteen-year-old can open a young saver account (${r.text})`);
const young = r.id;
check(bank.deposit(young, 300).ok && p.finance.cash === 100, 'existing money moved into it');   // 5.
let tries = 0;                                                               // 6-7. a job, through the careers engine
while (!p.career.partTime && tries++ < 60) { const j = partTime.jobOptions().find((x) => x.available); if (j) partTime.takeJob(j.id); else store.state.yearActs = null; if (!p.career.partTime) { p.flags.yearActs = null; advanceYear(); } }
check(!!p.career.partTime, 'hired for a part-time job');
const payBefore = txs().filter((t) => t.key?.startsWith('pay:')).length;
const heldBefore = held();
advanceYear();                                                              // 8, 14-15. a year passes: pay arrives
const pay = txs().filter((t) => t.key?.startsWith('pay:'));
check(pay.length === payBefore + 1, 'the year\'s pay is posted once');        // 9.
const wage = p.career.partTime?.salary ?? 0;
const yt = yearTotals(store.state.ledger, store.state.year, 'USD');
check((yt.income.partTime ?? 0) > 0, 'the pay is recorded as wages earned');
check(p.milestones.some((m) => m.text === 'Received a first paycheck.'), 'the first paycheck is a milestone');   // 19.
check(p.milestones.filter((m) => m.text === 'Received a first paycheck.').length === 1, 'and only the first');
sound('after the first year of work');
// 10. an actual living expense: an adult's year.
while (p.age < 19) advanceYear();
p.flags.livesWithParents = false; p.education.enrolled = false;
let y2 = null;   // a year in work (people are sometimes laid off: try again)
for (let i = 0; i < 8 && !(y2?.income.salary > 0 && y2?.expense.tax > 0); i++) { if (!p.career.careerId) hire(office, 0, 60, 'Hired.'); advanceYear(); y2 = yearTotals(store.state.ledger, store.state.year, 'USD'); }
check((y2.expense.housing ?? 0) > 0 && (y2.expense.living ?? 0) > 0, 'rent and everyday spending were paid and recorded');
check((y2.income.salary ?? 0) > 0 && (y2.expense.tax ?? 0) > 0, 'salary and the tax on it are recorded separately');
check(y2.in - (y2.income.salary ?? 0) - (y2.income.partTime ?? 0) - (y2.income.interestIncome ?? 0) - (y2.income.giftIn ?? 0) - (y2.income.otherIncome ?? 0) - (y2.income.gigs ?? 0) - (y2.income.winnings ?? 0) - (y2.income.rentIncome ?? 0) - (y2.income.pension ?? 0) === 0, 'income is made of real sources only');
// 11-13. a goal, money saved towards it, progress.
p.finance.cash += 0;
const acct = bank.accounts()[0];
check(acct.product === 'savings' && acct.owners.length === 1, 'at 18 the young saver account became an ordinary one, the owner\'s alone');
p.finance.cash = Math.max(p.finance.cash, 3000); book({ cat: 'giftIn', desc: 'A gift, for the test' });
r = bank.addGoal({ kind: 'car', target: Math.floor(fromMinor(acct.bal, 'USD')) + 2000, accountId: acct.id });
check(r.ok && bank.goalList()[0].status === 'active' && bank.goalList()[0].share < 1, 'a goal is tied to an account and starts unmet');
check(!bank.addGoal({ kind: 'travel', target: 500, accountId: acct.id }).ok, 'one goal to an account');
const goalsDone = () => p.milestones.filter((m) => m.text.startsWith('Saved up for')).length;
bank.deposit(acct.id, 1000);
check(bank.goalList()[0].status === 'active' && goalsDone() === 0, 'part of the money is not the goal');
bank.deposit(acct.id, 1000);
check(bank.goalList()[0].status === 'completed' && goalsDone() === 1, 'the goal is met when the money is really there');   // 13, 19-20.
bank.checkGoals(); bank.withdraw(acct.id, 500);
check(bank.goalList()[0].status === 'completed' && goalsDone() === 1, 'a goal once met stays met, and is recorded once');
// 14-18. another year; balances, history and net worth.
const cashWas = p.finance.cash; const txWas = txs().length;
advanceYear();
check(txs().length > txWas && p.finance.cash !== cashWas, 'a year of income and bills moved the money');
o = bank.overview();
check(o.netWorth === netWorth(store.state) && o.assets - o.liabilities === o.cash + o.foreign + o.bank + o.investments + o.property + o.vehicles + o.other - o.loans - o.mortgages, 'net worth is assets less debts, and the parts add up to it');
check(o.bank === bank.bankWorth() && o.bank > 0, 'money in the bank is counted, once');
sound('after the goal and another year');
// 21-25. save, reload, and nothing has moved.
const snap = JSON.stringify(store.state.ledger);
const worthWas = netWorth(store.state); const heldWas = held(); const countWas = txs().length; const slot = store.state.slotId;
check(saveGame(store.state), 'the game saves');
store.state = loadGame(slot);
p = store.state.player;
check(JSON.stringify(store.state.ledger) === snap, 'every account and every transaction came back exactly');
check(txs().length === countWas && new Set(txs().map((t) => t.id)).size === countWas, 'no transaction was added or doubled by loading');
check(netWorth(store.state) === worthWas && held() === heldWas, 'no money was made or lost by loading');
check(bookAction() === null, 'opening the books again books nothing');
check(p.milestones.some((m) => m.text.startsWith('Saved up for')), 'the milestone is still in the life story');
sound('after reload');
void heldBefore; void wage;
section('the first slice: account, job, pay, bills, goal, a year, net worth, save and reload');

// ---------- 6. Borrowing is not income; repaying is not all spending ----------
p = life('us', { cash: 5000 });
hire(office, 2, 60, 'Hired.');
const nw0 = netWorth(store.state);
const amount = loans.loanOptions().find((x) => x.approved)?.amount;
check(!!amount && loans.borrow(amount).ok, 'the bank lends to someone with an income');
bookAction();
const lt = txs().at(-1);
check(lt.cat === 'borrowing' && lt.entries.length === 2 && netWorth(store.state) === nw0, 'a loan adds cash and a debt of the same size: net worth does not move');
check(yearTotals(store.state.ledger, store.state.year, 'USD').in === 0, 'borrowed money is not income');
const debtId = Object.keys(store.state.ledger.accounts).find((k) => k.startsWith('debt:'));
check(store.state.ledger.accounts[debtId].bal === -toMinor(amount, 'USD'), 'the debt is in the ledger as money owed');
const owedBefore = p.finance.loans[0].principal; const cashB = p.finance.cash;
advanceYear();
const repay = txs().find((t) => t.desc === 'Loan repayments' && t.year === store.state.year);
const owedNow = p.finance.loans[0]?.principal ?? 0;
const offDebt = repay.entries.find(([id]) => id === debtId)[1];
const interest = repay.entries.find(([id]) => id.startsWith('n:interest'))[1];
const paid = -repay.entries.find(([id]) => id === 'wallet:USD')[1];
check(offDebt === toMinor(owedBefore - owedNow, 'USD') && interest > 0 && paid === offDebt + interest, 'a repayment is split into what came off the debt and what was interest');
check(yearTotals(store.state.ledger, store.state.year, 'USD').expense.interest >= interest, 'only the interest is spending');
check(owedNow >= 0 && owedNow < owedBefore, 'the debt goes down, and never below nothing');
check(credit.standing().onTime === 1, 'a year of paying on time is remembered');
// Paying it off.
p.finance.cash = owedNow + 1000; book({ cat: 'giftIn', desc: 'for the test' });
const id0 = p.finance.loans[0].id;
check(loans.repayLoan(id0).ok && !loans.repayLoan(id0).ok, 'a loan can be paid off once');
bookAction();
check(store.state.ledger.accounts[debtId].bal === 0 && store.state.ledger.accounts[debtId].closed === store.state.year && txs().at(-1).cat === 'debt', 'the debt is cleared and closed, and its record is kept');
advanceYear();
check(p.milestones.some((m) => m.text === 'Became free of debt.'), 'being free of debt is noticed when it is true');
void cashB;
sound('after borrowing and repaying');
section('debt: a loan is cash and a liability; repayments split principal from interest; history kept');

// ---------- 7. Investing: buying is not spending, a rise is not cash ----------
p = life('us', { cash: 30000 });
hire(office, 1, 60, 'Hired.');
const w0 = netWorth(store.state);
check(!mkt.buy('index', 999999).ok && mkt.buy('index', 10000).ok, 'you cannot invest money you do not have');
check(netWorth(store.state) === w0 && txs().at(-1).cat === 'investments' && p.finance.cash === 20000, 'buying turns cash into a holding: net worth does not move');
check(yearTotals(store.state.ledger, store.state.year, 'USD').out === 0, 'and is not counted as spending');
const own = mkt.holding('index'); own.value *= 2;
check(p.finance.cash === 20000 && book() === null && netWorth(store.state) > w0, 'a rise in value is not cash, and puts nothing in the ledger');
check(!mkt.sell('nimbus', 1).ok, 'you cannot sell what you do not hold');
mkt.sell('index', 1);
const st = txs().at(-1);
check(st.cat === 'investments' && st.entries.some(([id, amt]) => id === 'n:tax:USD' && amt > 0) && p.finance.cash > 20000, 'selling brings the money back, with the tax on the gain shown apart');
sound('after investing');
section('investing: needs the money, needs the holding; gains on paper are not cash');

// ---------- 8. Other currencies ----------
p = life('us', { cash: 50000 });
fx.exchange('USD', 'JPY', 10000);
const xt = book() ?? txs().at(-1); bookAction();
const ex = txs().find((t) => t.cat === 'exchange');
check(!!ex && ex.entries.some(([id]) => id === 'fx:USD') && ex.entries.some(([id]) => id === 'fx:JPY') && ex.entries.some(([id, a]) => id === 'wallet:JPY' && a === p.finance.accounts.JPY), 'an exchange goes through a clearing account in each currency, and keeps both amounts');
check(store.state.ledger.accounts['wallet:JPY'].bal === p.finance.accounts.JPY && Number.isInteger(p.finance.accounts.JPY), 'yen are held in whole yen');
void xt;
sound('after an exchange');
// A life in a currency with no small change, and one with three places.
for (const id of ['jp', 'kw', 'kr']) {
  p = life(id, { cash: 40000 });
  hire(office, 1, 60, 'Hired.');
  const b = bankWith('savings');
  const opened = bank.openAccount(b.id, 'savings', Math.round(10000 * COUNTRIES[id].currency.scale)); const a = opened.id;
  if (id === 'kr') check(opened.text.includes('₩10,000,000'), `ten million won is written as ten million won (${opened.text})`);
  for (let i = 0; i < 6 && p.alive; i++) advanceYear();
  if (p.alive) { sound(`six years in ${COUNTRIES[id].name}`); check(Number.isSafeInteger(bank.accountById(a).bal) && bank.accountById(a).cur === COUNTRIES[id].currency.code, `an account in ${COUNTRIES[id].currency.code} keeps whole smallest units`); }
}
// Moving country: the account keeps its currency and is not lost.
p = life('us', { cash: 80000 });
hire(office, 1, 60, 'Hired.');
const usAcct = bank.openAccount(bankWith('savings').id, 'savings', 20000).id;
const worthBefore = netWorth(store.state);
r = emigrate('mx', { keep: 0.25 });
if (r.ok) {
  bookAction();
  sound('after emigrating');
  const a = bank.accountById(usAcct);
  check(a && a.cur === 'USD' && a.bal === 2_000_000, 'the account abroad is still there, still in dollars, untouched');
  check(store.state.ledger.home === 'MXN' && txs().some((t) => t.cat === 'exchange'), 'the move is in the book as an exchange, not as income or spending');
  const after = netWorth(store.state);
  check(Math.abs(after - worthBefore * 10) < worthBefore * 10 * 0.2, `net worth carried over at about the rate (${after} against ${worthBefore * 10})`);
  check(bank.withdraw(usAcct, 1000).ok && p.finance.accounts.USD >= 1000, 'money taken out of it arrives as dollars, not pesos');
  check(!bank.deposit(usAcct, 1e9).ok, 'and only dollars can be paid in');
  sound('after using the account from abroad');
}
section('currencies: exchanges through clearing; yen, dinars and won; accounts survive a move abroad');

// ---------- 9. Running out: the bank's money goes first, and trouble is remembered ----------
p = life('us', { cash: 3000 });
const saver = bank.openAccount(bankWith('savings').id, 'savings', 2500).id;
p.finance.cash = -1200; book({ cat: 'other', desc: 'a bad year' });
const tookFrom = bank.accountById(saver).bal;
check(bank.coverShortfall() === 1200 && p.finance.cash === 0 && bank.accountById(saver).bal === tookFrom - 120_000, 'savings cover an overdraft before anything else happens');
sound('after covering a shortfall');
p = life('us', { cash: 100 });
p.finance.cash = -90000; book({ cat: 'other', desc: 'a catastrophe' });
advanceYear();
const s9 = credit.standing();
check(s9.marks.length >= 1 && (s9.standing == null || (s9.standing >= 0 && s9.standing <= 100)), 'serious trouble leaves a mark, and the standing stays between 0 and 100');
if (s9.marks.some((m) => m.kind === 'bankruptcy')) check(txs().some((t) => t.cat === 'debtRelief'), 'debts written off are in the book as that, not as earnings');
sound('after a collapse');
// Places keep different records.
check(credit.creditModelOf('us') === 'file' && credit.creditModelOf('de') === 'registry' && credit.creditModelOf('cu') === 'bank', 'three ways of keeping a record');
p = life('cu'); p.finance.credit = { marks: [{ year: store.state.year, age: 30, kind: 'forcedSale' }], onTime: 9, since: store.state.year - 9 };
check(credit.standing().standing === null && credit.standing().band === null && !credit.recentDefault(), 'where no shared record is kept, no number is invented');
p = life('de'); p.finance.credit = { marks: [{ year: store.state.year, age: 30, kind: 'forcedSale' }], onTime: 9, since: store.state.year - 9 };
check(credit.standing().standing === null && credit.standing().band === 'Listed' && credit.recentDefault(), 'a register of defaults lists trouble and gives no number');
p = life('us');
check(credit.standing().band === 'No record yet' && credit.standing().standing === null, 'no history, no standing');
p.finance.credit = { marks: [], onTime: 40, since: store.state.year - 40 };
check(credit.standing().standing === 90, 'a long clean record is good, within the range');
p.finance.credit.marks.push({ year: store.state.year, age: 30, kind: 'bankruptcy' }, { year: store.state.year, age: 30, kind: 'forcedSale' }, { year: store.state.year, age: 30, kind: 'forcedSale' }, { year: store.state.year, age: 30, kind: 'forcedSale' }, { year: store.state.year, age: 30, kind: 'forcedSale' });
check(credit.standing().standing >= 0 && credit.standing().standing <= 15, 'and a ruinous one is poor, never below nothing');
hire(office, 2, 60, 'Hired.');
check(loans.loanOptions().every((x) => !x.approved), 'lenders who can see a recent default will not lend');
section('hardship and the lending record: savings first; marks from real events; no invented scores');

// ---------- 10. Budget: planned against actual ----------
p = life('us', { cash: 20000 });
hire(office, 1, 60, 'Hired.');
advanceYear();
let b = bank.budgetView();
check(b.income > 0 && b.spent > 0 && b.left === b.income - b.spent && b.rows.some((x) => x.cat === 'housing' && x.actual > 0), 'the budget shows what was actually earned and spent');
check(bank.setLimit('housing', 1).ok && !bank.setLimit('salary', 100).ok && !bank.setLimit('housing', -4).ok, 'limits are for spending, and are whole amounts');
const lines = store.state.journal.length;
advanceYear();
check(store.state.journal.slice(lines).some((e) => e.text.startsWith('You spent more than you planned on')), 'going over a limit is noticed at the end of the year');
bank.setLimit('housing', null);
b = bank.budgetView();
check(b.rows.find((x) => x.cat === 'housing').limit === null, 'a limit can be removed');
section('budget: real income and spending against the limits set');

// ---------- 11. A whole life, and the next one ----------
let lives = 0; let deaths = 0;
for (const id of ['us', 'uk', 'jp', 'br', 'in', 'de']) {
  do { store.state = createLife({ countryId: id }); } while (store.state.player.royal);
  p = store.state.player;
  let opened = null;
  while (p.alive && p.age < 105) {
    advanceYear();
    if (!p.alive) break;
    if (p.age === 18 && !p.career.careerId) hire(office, 0, 55, 'Hired.');
    if (p.age === 20 && !opened && bankWith('savings') && p.finance.cash > 100) opened = bank.openAccount(bankWith('savings').id, 'savings', Math.floor(p.finance.cash / 2)).id ?? null;
    if (p.age > 20 && p.age % 3 === 0 && opened && bank.accountById(opened)?.closed == null && p.finance.cash > 1000) bank.deposit(opened, Math.floor(p.finance.cash / 4));
    if (p.age === 30 && p.finance.cash > 2000) mkt.buy('index', Math.floor(p.finance.cash / 3));
    if (p.age === 66 && !p.career.retired && p.career.careerId) retire();
    store.state.pendingEvents = [];
    bookAction();
    const bad = audit();
    if (bad.length) { problems.push(`${COUNTRIES[id].name}, age ${p.age}: ${bad[0]}`); break; }
    if (store.state.ledger.tx.length > 760) { problems.push(`${COUNTRIES[id].name}: the ledger grew to ${store.state.ledger.tx.length} transactions`); break; }
  }
  lives += 1;
  const L = store.state.ledger;
  check(L.tx.every((t) => t.year > store.state.year - KEEP_YEARS - 1), `${COUNTRIES[id].name}: old transactions are dropped, year by year`);
  check(p.age < 30 || Object.keys(L.years).some((y) => Number(y) < store.state.year - KEEP_YEARS), `${COUNTRIES[id].name}: yearly totals outlive the transactions they came from`);
  if (!p.alive) {
    deaths += 1;
    const grave = store.lastObituary;
    check(bank.accounts().length === 0 && bank.bankWorth() === 0, `${COUNTRIES[id].name}: at death every account was closed into the estate`);
    check(death.die('again') === grave, `${COUNTRIES[id].name}: a death is settled once`);
    const kin = heirs(store.state);
    if (kin.length) {
      const old = store.state; const who = kin[0];
      const share = grave.estate.shares.find((s) => s.npcId === who.id)?.amount ?? 0;
      const next = continueAs(who.id);
      check(!!next?.ledger && audit(next).length === 0, `${COUNTRIES[id].name}: the heir's books open sound`);
      check(next.familyMoney?.length === (old.familyMoney?.length ?? 0) + 1 && next.familyMoney.at(-1).name === `${p.firstName} ${p.lastName}`, `${COUNTRIES[id].name}: the family's history gains the one who died`);
      check(next.familyMoney.at(-1).shares.length === grave.estate.shares.length && !('tx' in next.familyMoney.at(-1)), `${COUNTRIES[id].name}: who got what is kept; the private accounts are not`);
      const inh = next.ledger.accounts[`n:inheritance:${next.ledger.home}`]?.bal ?? 0;
      check(-inh <= toMinor(Math.max(0, next.player.finance.cash), next.ledger.home) && (share > 0) === (inh < 0 || next.player.finance.cash <= 0), `${COUNTRIES[id].name}: the heir's inheritance is no more than they were left`);
      check(!Object.values(next.ledger.accounts).some((a) => a.kind === 'bank'), `${COUNTRIES[id].name}: the dead person's accounts are not handed to the heir as they were`);
    }
  }
}
check(lives === 6 && deaths >= 4, `whole lives were lived (${deaths} of ${lives} ended)`);
section(`whole lives in six countries: the book stays sound every year, to the death and into the next life`);

// ---------- 12. An old save ----------
do { store.state = createLife({ countryId: 'uk' }); } while (store.state.player.royal);
p = store.state.player; p.age = 44; p.finance.cash = 8123; p.finance.lifetimeEarned = 400000;
p.finance.loans = [{ id: 'loan_old', kind: 'personal', principal: 3000, rate: 0.08, yearsLeft: 4 }];
p.finance.accounts = { EUR: 250 };
delete store.state.ledger; delete p.flags.firstPay;
const oldWorth = (() => { const s = store.state; return s.player.finance.cash - 3000; })();
saveGame(store.state);
const raw = JSON.parse(disk.get(`pathways.slot.${store.state.slotId}`));
check(!raw.ledger, 'the old save has no ledger');
store.state = loadGame(store.state.slotId); p = store.state.player;
check(!!store.state.ledger && txs().length === 1 && txs()[0].cat === 'opening' && txs()[0].src === 'migration', 'an old save opens with one opening entry, marked as carried over');
check(p.finance.cash === 8123 && p.finance.loans[0].principal === 3000 && p.finance.accounts.EUR === 250, 'cash, debt and foreign money are exactly as they were');
check(p.finance.cash - 3000 === oldWorth && store.state.ledger.accounts['wallet:GBP'].bal === 812_300 && store.state.ledger.accounts['debt:loan_old:GBP'].bal === -300_000 && store.state.ledger.accounts['wallet:EUR'].bal === 25_000, 'the ledger starts from the same figures, each in its own currency');
check(p.flags.firstPay === true && yearTotals(store.state.ledger, store.state.year, 'GBP').in === 0 && yearTotals(store.state.ledger, store.state.year, 'GBP').out === 0, 'no past income or bills were invented');
sound('a migrated save');
saveGame(store.state); store.state = loadGame(store.state.slotId);
check(txs().length === 1, 'loading again adds nothing');
section('old saves: one opening balance, the same wealth and debt, no invented history');

// ---------- 13. Compaction keeps balances ----------
p = life('us', { cash: 1000 });
for (let y = 0; y < 12; y++) { store.state.year += 1; p.finance.cash += 100; book({ cat: 'giftIn', desc: 'yearly' }); compact(store.state.ledger, store.state.year); }
check(txs().length === KEEP_YEARS && store.state.ledger.accounts['wallet:USD'].bal === 220_000, 'old transactions go; the balance they led to stays');
check(post(store.state.ledger, { year: store.state.year - 9, age: 30, cat: 'other', desc: 'late', entries: [['wallet:USD', -1], ['n:giftIn:USD', 1]] }).ok === false, 'a closed year cannot be written in');
check(yearTotals(store.state.ledger, store.state.year - 10, 'USD').in === 10_000, 'and its totals can still be read');
sound('after compaction');
section('compaction: history shortens, balances and yearly totals do not change');

for (const line of ok) console.log(`ok   ${line}`);
if (problems.length) { for (const m of problems) console.log(`FAIL ${m}`); console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Every unit of money is accounted for.');
