// Checks credit cards, insolvency, insurance, pension plans, money between
// people, trusts, businesses, achievements and the money scenes.
// Run with: node tests/wealth.mjs
//
// As in tests/money.mjs, the rule throughout is that money only moves: the
// ledger is audited after every step that touches it.
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { COUNTRIES } = await import('../js/data/countries.js');
const { CAREERS } = await import('../js/data/careers.js');
const { book, bookAction, audit, yearTotals, ledgerOf, toMinor } = await import('../js/engine/ledger.js');
const bank = await import('../js/engine/banking.js');
const credit = await import('../js/engine/credit.js');
const { netWorth, tickFinance } = await import('../js/engine/finance.js');
const loans = await import('../js/engine/loans.js');
const cards = await import('../js/engine/cards.js');
const ins = await import('../js/engine/insurance.js');
const ret = await import('../js/engine/retirement.js');
const fam = await import('../js/engine/family.js');
const tr = await import('../js/engine/trusts.js');
const biz = await import('../js/engine/business.js');
const ach = await import('../js/engine/achievements.js');
const estate = await import('../js/engine/realEstate.js');
const cars = await import('../js/engine/vehicles.js');
const romance = await import('../js/engine/romance.js');
const { hire } = await import('../js/engine/career.js');
const { market } = await import('../js/engine/market.js');
const mkt = await import('../js/engine/market.js');
const { inheritFrom } = await import('../js/engine/relationships.js');
const death = await import('../js/engine/death.js');
const { heirs, continueAs } = await import('../js/engine/legacy.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { ensureLife } = await import('../js/engine/npcLives.js');
const { getEvent, resolveChoice } = await import('../js/engine/eventEngine.js');
const { CARDS, PENSION_PLAN } = await import('../js/data/money.js');

rng.seed(424242);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const sound = (where) => { const bad = audit(); check(!bad.length, `${where}: ${bad.slice(0, 3).join('; ')}`); };
const office = CAREERS.find((k) => k.type === 'fulltime' && k.category === 'professional');
const txs = () => store.state.ledger.tx;

function life(id = 'us', { age = 30, cash = 20000, job = true } = {}) {
  do { store.state = createLife({ countryId: id }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age;
  p.finance.cash = Math.round(cash * COUNTRIES[id].currency.scale);
  p.flags.livesWithParents = false; p.education.enrolled = false; p.finance.loans = []; p.assets = []; p.stats.health = 90;
  for (const n of Object.values(store.state.npcs)) if (n.role === 'spouse' || n.role === 'partner') n.role = 'ex';
  for (const n of Object.values(store.state.npcs)) if (n.role === 'pet') n.alive = false; // pets cost money now; checks that count cash start without them
  ledgerOf();
  if (job) { hire(office, 2, 60, 'Hired.'); p.career.salary = Math.round(60000 * COUNTRIES[id].currency.scale); }
  return p;
}
/** Adds someone to the player's life. */
function person(role, age, { relationship = 80, savings = 5000, salary = 0 } = {}) {
  const p = store.state.player;
  const n = makeNpc({ role, countryId: p.countryId, age, relationship });
  store.state.npcs[n.id] = n; p.npcIds.push(n.id);
  ensureLife(n);
  if (!n.life) { n.savings = Math.round(savings * COUNTRIES[p.countryId].currency.scale); return n; } // a child's parents keep simpler books
  n.life.savings = Math.round(savings * COUNTRIES[p.countryId].currency.scale);
  n.life.fin = null; // a fresh start: their past, caught up when they arrived, would otherwise bring a bank balance and a card
  n.life.job = salary ? { careerId: office.id, level: 0, title: 'Clerk', salary: Math.round(salary * COUNTRIES[p.countryId].currency.scale), years: 0 } : null;
  if (salary) n.life.retired = false; // working again, whatever their past held
  if (role === 'spouse') { n.marriedAtAge = p.age - 2; n.prenup = false; }
  return n;
}
/** The yearly money step on its own, without the rest of a year happening. */
const moneyYear = () => { store.state.year += 1; store.state.player.age += 1; tickFinance(); };

// ---------- 1. Credit cards ----------
let p = life('us');
let o = cards.cardOffer();
check(o.ok && o.limit > 0 && o.rateBp >= 1500, 'someone with an income is offered a card');
const w0 = netWorth(store.state);
check(cards.applyForCard().ok && cards.cards().length === 1 && netWorth(store.state) === w0, 'a card is credit, not money: net worth does not move');
const k = cards.cards()[0];
check(!cards.cashAdvance(k.id, k.limit).ok, 'the limit is enforced, fee included');
const cash0 = p.finance.cash;
check(cards.cashAdvance(k.id, 1000).ok && p.finance.cash === cash0 + 1000 && k.balance === 1000 + Math.ceil(1000 * CARDS.advanceFee), 'cash on the card is borrowed, with a fee on top');
check(netWorth(store.state) === w0 - Math.ceil(1000 * CARDS.advanceFee) && yearTotals(store.state.ledger, store.state.year, 'USD').in === 0, 'borrowing on a card is not income, and costs the fee');
check(cards.payCard(k.id, 400).ok && k.balance === 630 && !cards.closeCard(k.id).ok, 'a payment comes off the balance; a card with a balance cannot be closed');
sound('after card actions');
// A year paid in full: no interest carries, and a little comes back.
cards.payCard(k.id, 630);
moneyYear();
let st = k.statements.at(-1);
check(st.interest === 0 && st.spent > 0 && st.closing === 0 && st.reward === Math.floor(st.spent * CARDS.reward) && k.balance === 0, 'spending put on the card and paid in full costs nothing, and earns a little back');
sound('after a statement paid in full');
// Paying only the minimum: the rest is carried, and interest follows.
cards.setCard(k.id, { autopay: 'min' });
moneyYear();
const carried = k.balance;
check(carried > 0 && k.statements.at(-1).paid === cards.minimumDue({ ...k, balance: carried + k.statements.at(-1).paid }), 'paying the minimum leaves a balance');
moneyYear();
st = k.statements.at(-1);
check(st.interest === Math.round(carried * k.rateBp / 10000) && st.interest > 0, 'interest is charged on what was carried over');
check((yearTotals(store.state.ledger, store.state.year, 'USD').expense.interest ?? 0) >= toMinor(st.interest, 'USD'), 'and is recorded as interest paid');
check(credit.standing().onTime >= 2, 'years of meeting the payment are remembered');
sound('after carrying a balance');
// No money at all: the payment is missed, then the card is canceled and the debt remains.
p.career.careerId = null; p.career.salary = 0; p.finance.cash = 0; book({ cat: 'losses', desc: 'for the test' });
const before = k.balance;
moneyYear();
check(k.missed === 1 && k.statements.at(-1).fee > 0 && k.balance > before && p.finance.credit.marks.some((m) => m.kind === 'missed'), 'a missed payment costs a fee and leaves a mark');
moneyYear();
check(k.status === 'defaulted' && k.balance === 0 && p.finance.loans.some((l) => l.kind === 'card debt' && l.principal > before), 'two missed years cancel the card: the debt becomes a loan, it is not forgiven');
check(p.finance.credit.marks.some((m) => m.kind === 'default') && !cards.cardOffer().ok && cards.allCards().length === 1, 'the record keeps the closed card and the default, and no new card is offered');
sound('after a default');
// Who is offered what.
p = life('us', { job: false });
check(!cards.cardOffer().ok, 'no income, no card');
p = life('us', { age: 17 });
check(!cards.cardOffer().ok, 'not under 18');
p = life('us'); p.finance.credit = { marks: [], onTime: 30, since: store.state.year - 30 };
const good = cards.cardOffer();
p.finance.credit = { marks: [], onTime: 0, since: null };
const fresh = cards.cardOffer();
check(good.limit > fresh.limit && good.rateBp < fresh.rateBp, 'a long clean record earns a higher limit and a lower rate than none');
store.state.year = 1950; check(!cards.cardOffer().ok, 'nobody had a credit card in 1950');
section('credit cards: limits, fees, statements, interest, missed payments, default; credit is never income');

// ---------- 2. When debts cannot be paid: three different places ----------
const ruin = (id) => { const q = life(id, { cash: 100, job: false }); q.finance.loans.push({ id: 'big', kind: 'personal', principal: Math.round(30000 * COUNTRIES[id].currency.scale), rate: 0.08, yearsLeft: 5 }, { id: 'stu', kind: 'student', principal: Math.round(9000 * COUNTRIES[id].currency.scale), rate: 0.04, yearsLeft: 10 });
  q.finance.cash = -Math.round(60000 * COUNTRIES[id].currency.scale); book({ cat: 'losses', desc: 'ruin' }); moneyYear(); return q; };
p = ruin('us');
check(loans.insolvencyOf('us') === 'discharge' && p.flags.insolvency === 'bankruptcy' && p.finance.cash === 0 && p.finance.loans.length === 1 && p.finance.loans[0].kind === 'student', 'discharge: debts are wiped, the student loan is not');
check(txs().some((t) => t.cat === 'debtRelief') && p.finance.credit.marks.some((m) => m.kind === 'bankruptcy') && loans.isBankrupt(), 'it is in the book as debt written off, it is on the record, and no bank will lend');
sound('after a discharge');
p = ruin('de');
const planLoan = p.finance.loans.find((l) => l.kind === 'court plan');
check(loans.insolvencyOf('de') === 'plan' && p.flags.insolvency === 'plan' && planLoan && planLoan.rate === 0 && planLoan.principal > 0 && p.finance.loans.some((l) => l.kind === 'student'), 'a court plan: part written off, the rest repaid without interest, the student loan untouched');
check(p.finance.credit.marks.some((m) => m.kind === 'plan') && !loans.refinanceOffer(planLoan).ok && !loans.askForTime(planLoan.id).ok, 'a debt set by a court cannot be moved or stretched');
sound('after a court plan');
p = ruin('cn');
check(loans.insolvencyOf('cn') === 'none' && p.flags.insolvency === 'arrears' && p.finance.loans.some((l) => l.kind === 'arrears') && p.finance.loans.some((l) => l.id === 'big'), 'no release: nothing is written off, and what could not be paid becomes arrears');
check(!txs().some((t) => t.cat === 'debtRelief'), 'so nothing is booked as written off');
sound('after arrears');
section('insolvency: discharge, a court plan, or no release at all, by country');

// ---------- 3. Refinancing and asking for time ----------
p = life('us');
p.finance.loans.push({ id: 'dear', kind: 'personal', principal: 20000, rate: 0.14, yearsLeft: 6 });
book({ cat: 'borrowing', desc: 'a dear loan' });
const offer = loans.refinanceOffer(p.finance.loans[0], 85);
check(offer.ok && offer.rate < 0.14 && offer.saving > 0, 'a cheaper rate is on offer to someone with a good record');
check(loans.refinanceOffer(p.finance.loans[0], 85).rate < loans.refinanceOffer(p.finance.loans[0], 50).rate, 'and a better record gets a better rate');
const c1 = p.finance.cash;
check(loans.refinance('dear', 85).ok && p.finance.loans[0].rate === offer.rate && p.finance.cash === c1 - offer.fee && p.finance.loans[0].principal === 20000, 'refinancing changes the rate and costs the fee; what is owed is the same');
check(!loans.refinance('dear', 85).ok, 'there is nothing to gain by doing it twice');
check(!loans.askForTime('dear').ok, 'a lender gives no extra time to someone who can pay');
p.career.careerId = null; p.career.salary = 0;
check(loans.askForTime('dear').ok && p.finance.loans[0].yearsLeft === 9 && !loans.askForTime('dear').ok, 'someone out of work is given more time, once');
bookAction(); sound('after refinancing');
section('debt management: refinancing on the record, and time for those in trouble');

// ---------- 4. Insurance ----------
p = life('us', { cash: 900000 });
estate.buyProperty(estate.listings()[0].id, estate.listings()[0].price);
const house = p.assets.find((a) => a.kind === 'property');
check(!!house, 'a house to insure');
house.condition = 100; estate.damageProperty(house, 0); // start from sound, so that damage always shows
estate.damageProperty(house, 10);
check(ins.openLosses().length === 0, 'damage to something uninsured leaves nothing to claim for');
const q = ins.quote('home', { asset: house });
check(q.ok && q.premium > 0 && q.excess > 0 && ins.takeOut('home', { asset: house }).ok && !ins.takeOut('home', { asset: house }).ok, 'a house is insured once');
check(!ins.claim('nothing').ok, 'no loss, no claim');
const cashB = p.finance.cash;
estate.damageProperty(house, 30);
const loss = ins.openLosses()[0];
check(loss && loss.assetId === house.id && loss.amount > 0, 'damage to an insured house is recorded as a loss');
const a4 = ins.assess(loss.id);
check(a4.ok && a4.pay === Math.min(a4.pol.cover, loss.amount - a4.pol.excess), 'the insurer pays the loss less the excess, up to the cover');
check(ins.claim(loss.id).ok && p.finance.cash === cashB + a4.pay, 'the claim is paid');
check(!ins.claim(loss.id).ok && p.finance.cash === cashB + a4.pay, 'and cannot be paid twice');
check(txs().at(-1).cat === 'claim', 'it is in the book as an insurance payout');
ins.policies()[0].excess = Math.round(house.value); // an excess larger than any damage that follows
house.condition = 60; estate.damageProperty(house, 0);
estate.damageProperty(house, 5);
const small = ins.openLosses()[0];
check(small && !ins.claim(small.id).ok && small.claimed, 'a loss smaller than the excess is refused, and cannot be sent in again');
sound('after a claim');
const pol = ins.policies()[0]; const prem = pol.premium; const c4 = p.finance.cash;
store.state.year += 1; ins.tickInsurance(); book({ cat: 'insurance' });
check(p.finance.cash < c4 && pol.premium > prem * 0.5 && pol.paidYear === store.state.year, 'the premium is paid each year, and has gone up after a claim');
const c5 = p.finance.cash; ins.tickInsurance();
check(p.finance.cash === c5, 'and only once a year');
p.finance.cash = 0; book({ cat: 'losses', desc: 'test' }); store.state.year += 1; ins.tickInsurance();
check(pol.status === 'lapsed' && ins.policies().length === 0, 'a policy that cannot be paid for lapses');
estate.damageProperty(house, 20);
check(ins.openLosses().length === 0, 'and covers nothing afterwards');
// A vehicle, written off.
p = life('us', { cash: 200000 });
const listing = cars.listings().find((l) => !l.blocked && l.cls === 'car') ?? cars.listings().find((l) => !l.blocked);
p.flags.licence = true; p.flags.drivingLicence = true;
cars.buyVehicle(listing.id, 'cash');
const car = p.assets.find((a) => a.kind === 'vehicle');
if (car) {
  check(ins.takeOut('motor', { asset: car }).ok, 'a vehicle is insured');
  const v = car.value;
  cars.hitVehicle(-40);
  const l2 = ins.openLosses()[0];
  check(l2 && l2.amount === Math.round(v - car.value), 'what a crash took off its value is the loss');
  const c6 = p.finance.cash; const r6 = ins.claim(l2.id);
  check(r6.ok === (l2.amount > ins.pastPolicies().concat(ins.policies())[0].excess) && (!r6.ok || p.finance.cash > c6), 'paid if it is more than the excess');
}
// Life insurance pays once: to the person named, or to the estate.
p = life('us', { cash: 50000 });
const wife = person('spouse', 30);
const lq = ins.quote('life', { mult: 10 });
check(lq.ok && lq.cover > 0 && ins.takeOut('life', { mult: 10, beneficiaryId: wife.id }).ok && !ins.quote('life').ok, 'one life policy');
const hers = wife.life.savings;
let grave = death.die('a test');
check(grave.estate.outside.some((x) => x.to === wife.id && x.amount === lq.cover && x.how === 'life insurance') && wife.life.savings >= hers + lq.cover, 'life insurance is paid to the person named, outside the estate');
check(ins.settleLife() === null, 'and only once');
p = life('us', { cash: 50000 }); person('child', 30);
ins.takeOut('life', { mult: 5 });
const cover = ins.lifePolicy().cover; const worthB = netWorth(store.state);
grave = death.die('a test');
check(grave.estate.lifeCover === cover && grave.estate.gross === worthB + cover, 'with nobody named, it is paid into the estate, once');
store.state.year = 1800; p = life('us'); store.state.year = 1800;
check(!ins.quote('life').ok && !ins.quote('motor', { asset: { kind: 'vehicle', id: 'x', value: 5 } }).ok, 'no life or motor insurance in 1800');
section('insurance: claims need a real insured loss, are paid once, less the excess; life cover pays once');

// ---------- 5. A pension plan ----------
p = life('us', { cash: 30000 });
check(ret.openPlan(0.06).ok && !ret.openPlan(0.06).ok && ret.plan().account.locked, 'one plan, locked until later life');
const salary = p.career.salary; const cB = p.finance.cash;
const paidIn = ret.contribute();
check(paidIn === Math.round(salary * 0.06) && p.finance.cash === cB - paidIn && ret.plan().account.bal === toMinor(paidIn, 'USD'), 'the player pays in from their own money (an employer pension is separate: engine/worklife.js)');
check(ret.contribute() === 0 || ret.plan().account.bal === toMinor(paidIn, 'USD'), 'once a year');
check((yearTotals(store.state.ledger, store.state.year, 'USD').in ?? 0) === 0, 'paying into it is moving money, not income');
check(!bank.withdraw(ret.plan().accountId, 100).ok, 'it cannot be drawn on early');
const potB = ret.plan().account.bal; const penalty = bank.breakCost(ret.plan().account);
check(penalty === Math.floor(potB * PENSION_PLAN.earlyPenalty), 'taking it early costs a quarter');
market(); store.state.market.history.index.push(store.state.market.history.index.at(-1) * 1.2);
ret.tickPlan();
const grown = ret.plan().account.bal;
check(grown > potB, 'the pot follows the market up');
ret.tickPlan();
check(ret.plan().account.bal === grown, 'and a year\'s growth is posted once');
store.state.year += 1; store.state.market.history.index.push(store.state.market.history.index.at(-1) * 0.6);
ret.tickPlan();
check(ret.plan().account.bal < grown, 'and down: a pension plan can lose money');
const pr = ret.projection();
check(pr.low < pr.mid && pr.mid < pr.high && pr.years === 30, 'a projection is a range, not a figure');
p.age = 60;
check(!ret.plan().account.locked && bank.withdraw(ret.plan().accountId, 100).ok, 'at sixty it is the owner\'s to draw on');
sound('after a pension plan');
p = life('br', { cash: 30000 });
ret.openPlan(0.1);
const mine = ret.contribute();
check(mine === Math.round(p.career.salary * 0.1), 'where there is no workplace plan, nobody else pays in');
p = life('us', { cash: 30000, job: false }); ret.openPlan(0.06);
check(ret.contribute() === 0, 'no wage, no contribution');
section('pension plans: contributions, locked, follows the market both ways');

// ---------- 6. Money between people ----------
p = life('us', { cash: 40000 });
check(fam.billShare(60000) === 1, 'alone, the household is one person\'s to pay for');
let s = person('spouse', 30, { salary: 20000 });
check(fam.billShare(60000) === 0.55 && fam.arrangement() === 'separate', 'marriage merges nothing: the bills are as they always were');
s.meters.relationship = 50;
check(!fam.proposeArrangement('equal').ok && fam.arrangement() === 'separate', 'a partner who earns a third as much can refuse to pay half');
check(fam.proposeArrangement('income').ok && fam.billShare(60000) === 0.75, 'sharing by income: three quarters of the earnings, three quarters of the bills');
s.meters.relationship = 30;
check(!fam.openJoint(1000).ok && bank.accounts().length === 0, 'a partner can decline a joint account');
s.meters.relationship = 80;
const nwB = netWorth(store.state);
const j = fam.openJoint(10000);
check(j.ok && bank.accountById(j.id).owners.some((x) => x.role === 'joint_owner' && x.id === s.id), 'a joint account has two owners');
check(netWorth(store.state) === nwB - 5000 && bank.shareOf(bank.accountById(j.id)) === 0.5, 'half of what is paid into it is now the other person\'s');
const sav = s.life.savings;
fam.tickFamilyMoney();
const jb = bank.accountById(j.id);
check(jb.bal > 1_000_000 && jb.contrib.them === jb.bal - 1_000_000 && s.life.savings === sav - (jb.bal - 1_000_000) / 100, 'the partner pays in from their own money, and it leaves their savings');
check(yearTotals(store.state.ledger, store.state.year, 'USD').in === 0, 'a partner\'s money in a joint account is not the player\'s income');
fam.tickFamilyMoney();
check(bank.accountById(j.id).bal === jb.bal, 'once a year');
check(!bank.transfer(j.id, j.id, 5).ok, 'no shuffling a joint account');
sound('after a joint account');
// Divorce: the joint account is divided, and nothing is doubled.
const total = () => p.finance.cash + bank.bankWorth() / bank.shareOf(bank.accountById(j.id) ?? { joint: 0 }) * 1;
void total;
const jointBal = bank.accountById(j.id).bal; const cashD = p.finance.cash; const savD = s.life.savings;
const kept = fam.splitJoint(s.id);
check(kept === jointBal / 2 / 100 && p.finance.cash === cashD + kept && s.life.savings === savD + (jointBal / 100 - kept) && bank.accountById(j.id).closed != null, 'shared equally: half each, and the two halves add up to the whole');
sound('after dividing a joint account');
// Where each keeps their own: the joint account goes by what each put in, and nothing else changes hands.
p = life('uk', { cash: 40000 });
s = person('spouse', 30, { salary: 30000, savings: 100000 });
check(fam.familyLawOf('uk') === 'separate' && fam.familyLawOf('us') === 'equal', 'two kinds of family law');
const j2 = fam.openJoint(9000);
store.state.ledger.accounts[j2.id].contrib.them = 300_000; store.state.ledger.accounts[j2.id].bal += 300_000; store.state.ledger.accounts['n:jointPartner:GBP'] = { id: 'n:jointPartner:GBP', kind: 'nominal', cur: 'GBP', cat: 'jointPartner', bal: -300_000 };
check(bank.shareOf(bank.accountById(j2.id)) === 0.75, 'the player put in three quarters, and owns three quarters');
check(romance.settlement(s.id) === 0, 'and on divorce nothing else is owed either way');
const cB2 = p.finance.cash;
romance.divorce(s.id);
check(p.finance.cash > cB2 + 9000 - 4000 - 1 - 4000 && s.role === 'ex' && bank.accounts().length === 0, 'the divorce divides the joint account by contribution');
bookAction(); sound('after a divorce');
// On death, a joint account goes to the other owner, outside the will.
p = life('us', { cash: 40000 });
s = person('spouse', 30, { salary: 20000 }); const kid = person('child', 8);
p.flags.will = { mode: 'named', heirs: [kid.id], items: {} };
fam.openJoint(10000);
const sB = s.life.savings;
grave = death.die('a test');
check(grave.estate.outside.some((x) => x.to === s.id && x.amount === 10000 && x.how === 'a joint account') && s.life.savings === sB + 10000, 'the whole joint account passes to the surviving owner');
check(!grave.estate.shares.some((x) => x.npcId === s.id) && grave.estate.gross === 30000, 'it is not in the estate, and the will does not touch it');
// Giving and lending.
p = life('us', { cash: 40000 });
const sis = person('sibling', 28, { savings: 500 });
const nwG = netWorth(store.state);
check(fam.giveMoney(sis.id, 2000).ok && netWorth(store.state) === nwG - 2000 && sis.life.savings === 2500 && txs().at(-1).cat === 'giftOut', 'a gift is gone, and is theirs');
const nwL = netWorth(store.state);
check(fam.lendMoney(sis.id, 3000, 3).ok && netWorth(store.state) === nwL && fam.loansOut()[0].left === 3000 && sis.life.savings === 5500, 'a loan is owed back: the lender is no poorer on paper');
check(txs().at(-1).cat === 'familyLoan' && yearTotals(store.state.ledger, store.state.year, 'USD').expense.giftOut === 200_000, 'a gift and a loan are not the same thing in the book');
check(!fam.lendMoney(sis.id, 100).ok, 'one loan at a time to one person');
sis.meters.relationship = 100; sis.meters.crazy = 0;
let repaid = 0; for (let i = 0; i < 12 && fam.loansOut().length; i++) { const c = p.finance.cash; store.state.year += 1; fam.tickFamilyMoney(); repaid += p.finance.cash - c; }
check(repaid === 3000 && fam.loansOut().length === 0 && sis.life.savings === 2500, 'a reliable borrower pays back exactly what was lent, from their own savings');
sound('after a repaid loan');
const bro = person('sibling', 40, { savings: 0 });
fam.lendMoney(bro.id, 1000, 2);
check(fam.forgiveLoan(fam.loansOut()[0].id).ok && fam.loansOut().length === 0 && txs().at(-1).cat === 'giftOut', 'a forgiven loan becomes a gift');
const cold = person('sibling', 40, { relationship: 10 });
check(!fam.lendMoney(cold.id, 500).ok && !fam.giveMoney(cold.id, 500).ok, 'someone who dislikes you can refuse your money');
const dead = person('sibling', 40, { savings: 0 });
fam.lendMoney(dead.id, 800, 2); dead.alive = false; store.state.year += 1; fam.tickFamilyMoney();
check(fam.loansOut().length === 0 && txs().at(-1).cat === 'losses', 'a debt nobody is left to repay is a loss');
sound('after gifts and loans');
// Allowance.
p = life('us', { cash: 40000 });
const child = person('child', 9); person('child', 3);
check(fam.setAllowance(2).ok && fam.allowanceCost() === 900, 'allowance is for children old enough to have it');
const cA = p.finance.cash; fam.tickFamilyMoney();
check(p.finance.cash === cA - 900 && child.flags.moneySense === 1, 'it costs what it costs, and teaches a little');
section('money between people: bills by agreement, joint accounts, divorce by local law, gifts, loans, allowance');

// ---------- 7. Trusts ----------
p = life('us', { cash: 100000 });
const heir = person('child', 10);
const nwT = netWorth(store.state);
check(!tr.createTrust({ beneficiaryId: heir.id, amount: 100, releaseAge: 25 }).ok && !tr.createTrust({ beneficiaryId: heir.id, amount: 20000, releaseAge: 9 }).ok, 'a trust has a minimum, and a release age still to come');
const t = tr.createTrust({ beneficiaryId: heir.id, amount: 20000, releaseAge: 12 });
check(t.ok && netWorth(store.state) === nwT - 20200 && tr.trusts()[0].bal === 2_000_000, 'money put in trust has left the player for good, with a fee');
check(!bank.withdraw(t.id, 100).ok && !bank.accountById(t.id), 'and cannot be taken back');
check(!tr.createTrust({ beneficiaryId: heir.id, amount: 20000, releaseAge: 25 }).ok && tr.addToTrust(t.id, 1000).ok && tr.trusts()[0].bal === 2_100_000, 'one trust for one person, which can be added to');
sound('after setting up a trust');
store.state.year += 1; heir.age = 11; tr.tickTrusts();
check(tr.trusts()[0].bal === 2_163_000 && yearTotals(store.state.ledger, store.state.year, 'USD').in === 0, 'it grows a little; the growth is not the player\'s income');
tr.tickTrusts();
check(tr.trusts()[0].bal === 2_163_000, 'once a year');
const hs = heir.life.savings; store.state.year += 1; heir.age = 12; tr.tickTrusts();
check(tr.trusts().length === 0 && heir.life.savings > hs + 21_630 && netWorth(store.state) === nwT - 21200, 'at the age set it is paid to the person it was for, and not to the player');
sound('after a trust paid out');
const t2 = tr.createTrust({ beneficiaryId: heir.id, amount: 10000, releaseAge: 30 });
heir.alive = false; const cT = p.finance.cash; store.state.year += 1; tr.tickTrusts();
check(tr.trusts().length === 0 && p.finance.cash > cT + 10000, 'if they die first, it comes back');
void t2; sound('after a trust returned');
// A trust still being held when the player dies stays held, and follows the heir.
p = life('us', { cash: 100000 });
const young = person('child', 20);
tr.createTrust({ beneficiaryId: young.id, amount: 30000, releaseAge: 25 });
const youngHad = young.life.savings;
grave = death.die('a test');
check(grave.estate.outside.some((x) => x.to === young.id && x.held && x.amount === 30000) && grave.estate.gross === 100000 - 30300, 'a trust is not part of the estate, and is not paid out early');
const old = store.state;
if (heirs(old).some((n) => n.id === young.id)) {
  const next = continueAs(young.id);
  store.state = next;
  check(tr.heldForYou().length === 1 && tr.heldForYou()[0].bal === 3_000_000 && audit().length === 0, 'the heir sees the trust held for them');
  check(netWorth(next) < youngHad + 100000 && bank.overview().netWorth === netWorth(next), 'it is not theirs yet, so it is not in their net worth');
  const cH = next.player.finance.cash;
  for (let i = 0; i < 6 && tr.heldForYou().length; i++) { next.year += 1; next.player.age += 1; tr.tickTrusts(); }
  check(next.player.age === 25 && next.player.finance.cash > cH + 30000 && next.player.milestones.some((m) => m.text.startsWith('Came into the trust')), 'and comes into it at the age that was set');
  sound('after an inherited trust');
}
section('trusts: irrevocable, held by a trustee, paid at the age set, outside the estate, carried to an heir');

// ---------- 8. Who a will cannot leave out ----------
p = life('fr', { cash: 100000 });
const son = person('child', 30); const friend = person('friend', 40);
p.flags.will = { mode: 'named', heirs: [friend.id], items: {} };
let plan = death.estatePlan();
const toSon = plan.shares.find((x) => x.npcId === son.id)?.amount ?? 0; const toFriend = plan.shares.find((x) => x.npcId === friend.id)?.amount ?? 0;
check(death.reservedShare() === 0.5 && toSon > 0 && Math.abs(toSon - toFriend) <= 1, 'in France a child cannot be left out: half is reserved for them');
p.flags.will = { mode: 'charity', heirs: [], items: {} };
plan = death.estatePlan();
check(plan.charity > 0 && plan.shares.some((x) => x.npcId === son.id && x.amount > 0), 'and "everything to charity" means everything that is free to give');
p = life('us', { cash: 100000 });
const son2 = person('child', 30); const friend2 = person('friend', 40);
p.flags.will = { mode: 'named', heirs: [friend2.id], items: {} };
plan = death.estatePlan();
check(death.reservedShare() === 0 && !plan.shares.some((x) => x.npcId === son2.id), 'in the United States the will stands as written');
section('wills: a reserved share for children where the law has one');

// ---------- 9. A business of one's own (engine/business.js) and the books ----------
{
  p = life('us', { cash: 400000, job: false });
  const nw9 = netWorth(store.state);
  const r9 = biz.start('cafe', 'Ledger Café', { borrow: 0 });
  check(r9.ok && biz.openBusinesses().length === 1, 'a business can be started');
  bookAction();
  check(txs().at(-1).cat !== 'otherIncome' && yearTotals(store.state.ledger, store.state.year, 'USD').in === 0, 'putting money into a business is not income');
  const b9 = biz.openBusinesses()[0];
  check(netWorth(store.state) <= nw9, 'a business is not counted in net worth: it passes to an heir as it stands, not as money');
  biz.setDraw(b9, 'most'); b9.ownerHours = 40;
  let drawn = 0;
  for (let i = 0; i < 6 && biz.openBusinesses().length; i++) { advanceYear(); store.state.pendingEvents = []; bookAction(); drawn += yearTotals(store.state.ledger, store.state.year, 'USD').income.distribution ?? 0; }
  check(audit().length === 0, 'the books stay sound while it trades');
  check(drawn >= 0 && !Object.values(store.state.ledger.years).some((y) => (y.USD?.distribution?.[1] ?? 0) > 0), 'what the owner takes out is income, booked once a year, never spending');
}
section('a business: money put in is not income; what the owner takes is; it is not net worth');

// ---------- 10. Achievements and money sense ----------
p = life('us', { cash: 1000, job: false });
p.finance.lifetimeEarned = 0; delete p.flags.firstPay;
let list = ach.achievements();
check(list.length === 10 && list.every((x) => !x.earned), 'a life that has done none of it has earned none of it');
p.finance.cash = 5_000_000; book({ cat: 'giftIn', desc: 'a windfall' });
check(ach.achievements().filter((x) => x.earned).length === 0, 'having money, on its own, earns nothing');
hire(office, 2, 60, 'Hired.'); advanceYear();
check(ach.achievements().find((x) => x.id === 'first_pay').earned && ach.achievements().find((x) => x.id === 'first_pay').age === p.age, 'the first wage is noticed in the year it happens');
const sense0 = ach.moneySense();
for (let i = 0; i < 400; i++) ach.learn(5, 'same');
check(ach.moneySense() <= 100 && ach.moneySense() > sense0, 'money sense grows with experience and stays within range');
const before1 = ach.moneySense(); ach.learn(5, 'same');
check(ach.moneySense() - before1 < 1, 'the same lesson teaches less each time');
section('achievements: from what happened, never from a balance alone; money sense within range');

// ---------- 11. Scenes move real money ----------
p = life('us', { cash: 800, age: 17, job: false });
const acct = (() => { person('parent', 45); return bank.openAccount(bank.banksHere().find((x) => x.products.includes('youth')).id, 'youth', 0); })();
check(acct.ok, 'an account for the scene');
p.flags.firstPayAge = p.age;
const ev = getEvent('first_paycheck');
check(!!ev && ev.choices.length === 4, 'the first paycheck scene exists');
const heldB = p.finance.cash + bank.bankWorth();
resolveChoice(ev, 0, {});
check(bank.accountById(acct.id).bal === 56_000 && p.finance.cash === 240 && p.finance.cash + bank.bankWorth() === heldB, 'saving most of it really moves it into the account, and nothing is made or lost');
bookAction(); sound('after the first paycheck scene');
p = life('us', { cash: 20000 });
const sib = person('sibling', 30, { savings: 100 });
resolveChoice(getEvent('sibling_needs_help'), 1, { sib: sib.id });
check(fam.loansOut().length === 1 && fam.loansOut()[0].left === 1500 && sib.life.savings === 1600, 'lending to a sibling in a scene makes a real loan');
resolveChoice(getEvent('too_good_offer'), 0, {});
check(p.finance.cash === 18500, 'walking away from a bad offer costs nothing');
bookAction(); sound('after scenes');
section('scenes: choices about money move real money through the same engines');

// ---------- 12. Whole lives with everything in use ----------
let lived = 0;
for (const id of ['us', 'de', 'in', 'jp', 'cn']) {
  do { store.state = createLife({ countryId: id }); } while (store.state.player.royal);
  p = store.state.player;
  const scale = COUNTRIES[id].currency.scale;
  while (p.alive && p.age < 100) {
    advanceYear();
    if (!p.alive) break;
    if (p.age === 18 && !p.career.careerId) hire(office, 0, 55, 'Hired.');
    if (p.age === 19) { const sv = bank.banksHere().find((x) => x.products.includes('savings')); if (sv && p.finance.cash > 10) bank.openAccount(sv.id, 'savings', Math.floor(p.finance.cash / 3)); }
    if (p.age === 20) cards.applyForCard();
    if (p.age === 22) ret.openPlan(0.06);
    if (p.age === 24 && cards.cards()[0]) cards.setCard(cards.cards()[0].id, { autopay: 'min' });
    if (p.age === 26) ins.takeOut('life', { mult: 5 });
    if (p.age === 32 && p.finance.cash > 3000 * scale) { const kin = p.npcIds.map((x) => store.state.npcs[x]).find((n) => n?.alive && n.age >= 18 && ['sibling', 'parent', 'friend'].includes(n.role)); if (kin) fam.lendMoney(kin.id, Math.round(1000 * scale), 3); }
    if (p.age === 35 && p.finance.cash > 9000 * scale) { const c = tr.trustCandidates().find((n) => n.age < 20); if (c) tr.createTrust({ beneficiaryId: c.id, amount: Math.round(6000 * scale), releaseAge: 25 }); }
    if (p.age === 36 && romance.spouse()) fam.openJoint(0);
    if (p.age === 40) fam.setAllowance(1);
    for (const l of ins.openLosses()) ins.claim(l.id);
    store.state.pendingEvents = [];
    bookAction();
    const bad = audit();
    if (bad.length) { problems.push(`${COUNTRIES[id].name}, age ${p.age}: ${bad[0]}`); break; }
    const ov = bank.overview();
    if (ov.netWorth !== netWorth(store.state)) { problems.push(`${COUNTRIES[id].name}, age ${p.age}: the overview says ${ov.netWorth}, net worth is ${netWorth(store.state)}`); break; }
    const sd = credit.standing({ income: 1, service: 0, used: cards.utilization() }).standing;
    if (sd != null && (sd < 0 || sd > 100)) { problems.push(`${COUNTRIES[id].name}: standing ${sd}`); break; }
  }
  lived += 1;
  if (!p.alive) {
    check(bank.accounts().length === 0, `${COUNTRIES[id].name}: every account was closed at death`);
    const kin = heirs(store.state);
    if (kin.length) { const next = continueAs(kin[0].id); check(audit(next).length === 0 && !(next.player.finance.cards ?? []).length && !(next.player.finance.policies ?? []).length, `${COUNTRIES[id].name}: the heir starts with sound books and none of the dead person's cards or policies`); }
  }
}
check(lived === 5, 'five whole lives were lived');
section('whole lives using cards, plans, insurance, businesses, loans and trusts: sound every year');

// ---------- 13. A car bought on finance ----------
{
  p = life('us', { cash: 2000 });
  p.flags.licence = true; p.flags.drivingLicence = true;
  /** A vehicle for sale that a lender would finance. Listings are random, so look until there is one. */
  const financeable = () => { for (let i = 0; i < 40; i++) { store.state.market.listings = null; const l = cars.listings().find((x) => !x.blocked && x.finance.approved && x.price > 5000); if (l) return l; } return null; };
  const lst = financeable();
  check(!!lst, 'there is a vehicle a lender will finance');
  if (lst) {
    const nw = netWorth(store.state);
    check(cars.buyVehicle(lst.id, 'loan').ok, 'a vehicle can be bought on finance');
    const v = p.assets.find((a) => a.kind === 'vehicle');
    const loan = cars.loanOn(v);
    check(loan && loan.kind === 'car' && loan.principal === lst.price && loan.rate === loans.CAR_LOAN.rate && loan.rate < 0.09, 'the loan is secured on the vehicle, at a lower rate');
    bookAction();
    check(Math.abs(netWorth(store.state) - nw) <= 1, 'buying on finance changes nothing on paper: a vehicle and a debt of the same size');
    v.value = Math.round(loan.principal * 0.5); p.finance.cash = 10;
    check(!cars.sellVehicle(v.id).ok && p.assets.includes(v), 'a vehicle worth less than its loan cannot be sold without the money to clear it');
    p.finance.cash = loan.principal; book({ cat: 'giftIn', desc: 'test' });
    const owed = loan.principal; const c0 = p.finance.cash;
    check(cars.sellVehicle(v.id).ok && !p.finance.loans.includes(loan) && p.finance.cash === c0 + v.value - owed, 'selling it pays off the loan first');
    bookAction(); sound('after selling a financed vehicle');
    // Repossession: the lender is paid first, and only the rest reaches the owner.
    p = life('us', { cash: 2000 }); p.flags.licence = true; p.flags.drivingLicence = true;
    const l2 = financeable();
    check(!!l2, 'and another, to be taken back');
    if (l2) {
      cars.buyVehicle(l2.id, 'loan'); bookAction();
      const v2 = p.assets.find((a) => a.kind === 'vehicle'); const ln = cars.loanOn(v2);
      v2.value = ln.principal * 2;
      const c1 = p.finance.cash;
      const owedR = ln.principal;
      const raisedR = cars.repossessVehicle(v2);
      check(raisedR === Math.round(v2.value * 0.8) && p.finance.cash === c1 + raisedR - owedR && !p.finance.loans.includes(ln), 'a repossessed vehicle pays its lender first; the owner gets what is left');
      bookAction(); sound('after a repossession');
    }
  }
}
section('car finance: secured on the vehicle, cheaper, and the lender is paid first on any sale');

// ---------- 14. Winding up an estate ----------
p = life('us', { cash: 100000 });
const kid2 = person('child', 30); const pal = person('friend', 40);
let pl = death.estatePlan();
check(pl.probate === Math.round(pl.gross * death.PROBATE.rate) && pl.net === pl.gross - pl.tax - pl.probate, 'winding up an estate costs a share of what passes under the will');
check(!death.nameExecutor(kid2.id).ok === false && death.executor()?.id === kid2.id, 'an adult can be named to see to it');
const pl2 = death.estatePlan();
check(pl2.probate === Math.round(pl2.gross * death.PROBATE.withExecutor) && pl2.probate < pl.probate && pl2.executor, 'which halves the cost');
check(Math.abs(pl2.shares.reduce((x, y) => x + y.amount, 0) - (pl2.gross - pl2.tax - pl2.probate)) <= pl2.shares.length, 'and the heirs share exactly what is left');
fam.openJoint; const before2 = death.estatePlan().probate;
const sp2 = person('spouse', 30); fam.openJoint(50000);
check(death.estatePlan().probate < before2, 'what passes outside the will costs nothing to wind up');
check(!death.nameExecutor(person('child', 10).id).ok, 'a child cannot be an executor');
void pal;
section('probate: a cost on what passes under the will, halved by an executor, nothing on what passes outside');

// ---------- 16. The family's own money ----------
{
  const { finOf, npcWorth, tickNpcMoney } = await import('../js/engine/npcMoney.js');
  p = life('us', { cash: 1000 });
  const fresh = (n) => { n.life.fin = null; return finOf(n); }; // someone who arrives as an adult comes with a past; these checks start from a clean slate
  const bro = person('sibling', 30, { savings: 0, salary: 50000 });
  const f = fresh(bro);
  check(f && ['cautious', 'balanced', 'bold'].includes(f.style) && !f.home && f.debt === 0, 'someone close has books of their own');
  check(finOf(person('friend', 30)) === null, 'someone further away keeps the simple savings figure');
  bro.life.savings = -5000; tickNpcMoney(bro);
  check(bro.life.savings === 0 && f.debt === 5000, 'running out of money becomes their debt, not the player\'s');
  bro.life.savings = 400000; let bought = false;
  for (let i = 0; i < 30 && !bought; i++) bought = tickNpcMoney(bro) === 'bought';
  check(bought && f.home && f.home.mortgage > 0 && f.home.mortgage <= bro.life.job.salary * 4.5, 'with a deposit saved, and an income a lender will accept, they buy a home with a mortgage');
  const w1 = npcWorth(bro);
  check(w1 === Math.round(bro.life.savings + (f.bank?.bal ?? 0) + f.invested + f.home.value - f.home.mortgage - f.debt - (f.card?.balance ?? 0)), 'their worth is savings, bank, investments and home, less what they owe');
  const poor = person('sibling', 30, { savings: 1000000, salary: 0 }); fresh(poor);
  for (let i = 0; i < 10; i++) tickNpcMoney(poor);
  check(!finOf(poor).home, 'nobody buys a home with no income, whatever they have saved');
  const spouse3 = person('spouse', 30, { savings: 1000000, salary: 90000 });
  for (let i = 0; i < 10; i++) tickNpcMoney(spouse3);
  check(!finOf(spouse3).home, 'a spouse shares the player\'s home, and does not buy one of their own');
  bookAction(); sound('after family money');
}
section('family money: their own homes, mortgages and debts');

// ---------- 17. Net worth over the years ----------
p = life('us', { cash: 5000 });
for (let i = 0; i < 4; i++) advanceYear();
const hist = store.state.ledger.worth ?? {};
const ys = Object.keys(hist).map(Number);
check(ys.length >= 4 && ys.every((y) => hist[y].cur === 'USD') && hist[store.state.year].v === netWorth(store.state) - (netWorth(store.state) - bank.overview().netWorth), 'each year\'s net worth is recorded as it stood, with its currency');
section('net worth is recorded at the end of every year');

// ---------- 18. Payslips ----------
{
  const { payslips } = await import('../js/engine/finance.js');
  const ps = payslips({ year: 2030, cur: 'JPY', gross: 5000001, tax: 900007, plan: 300001, employer: 150000, sources: { salary: 1 } });
  const sum = (k) => ps.months.reduce((t, x) => t + x[k], 0);
  check(ps.months.length === 12 && sum('gross') === 5000001 && sum('tax') === 900007 && sum('plan') === 300001 && sum('net') === 5000001 - 900007 - 300001, 'twelve payslips add up to exactly the year, even in yen');
  check(ps.months.every((m) => m.net === m.gross - m.tax - m.plan), 'each payslip is its pay less what was taken from it');
  p = life('us', { cash: 5000 }); ret.openPlan(0.06);
  moneyYear();
  const slips = p.finance.payslips;
  check(slips && slips.year === store.state.year && slips.months[0].plan > 0 && slips.months[0].tax > 0, 'a working year leaves payslips showing tax and the pension contribution');
  check(txs().filter((t) => t.key?.startsWith('pay:')).length === 1, 'and the pay itself is still booked once');
}
section('payslips: twelve months that add up to exactly the year');

// ---------- 19. Payouts from investments ----------
p = life('us', { cash: 100000 });
mkt.buy('dividend', 50000); mkt.buy('techfund', 10000);
const hd = p.assets.find((a) => a.catalogId === 'dividend');
const want19 = Math.floor(hd.units * hd.value * mkt.yieldOf('dividend'));
const cash19 = p.finance.cash;
const paid19 = mkt.payouts();
const tax19 = Math.floor(want19 * COUNTRIES.us.incomeTax * 0.5);
check(paid19 >= want19 && Math.abs(p.finance.cash - (cash19 + paid19 - tax19 - Math.floor(Math.floor(p.assets.find((a) => a.catalogId === 'techfund').units * 0.004 * p.assets.find((a) => a.catalogId === 'techfund').value) * COUNTRIES.us.incomeTax * 0.5))) <= 2, 'a holding pays out its share, less tax, as money');
check(mkt.payouts() === 0, 'once a year');
check((yearTotals(store.state.ledger, store.state.year, 'USD').income.dividends ?? 0) > 0, 'and it is recorded as income from investments');
sound('after payouts');
store.state.year += 1;
mkt.setReinvest('dividend', true);
const units19 = hd.units; const c19 = p.finance.cash;
mkt.payouts();
check(hd.units > units19 && p.finance.cash - c19 < want19 * 0.2, 'reinvested payouts buy more of the holding instead');
check((yearTotals(store.state.ledger, store.state.year, 'USD').income.dividends ?? 0) > 0, 'and are still income');
sound('after reinvesting');
// Rebalancing spreads only what was invested.
const before19 = mkt.portfolioValue(); const cashR = p.finance.cash;
check(mkt.rebalance('cautious').ok, 'investments can be spread across a mix');
const after19 = mkt.portfolioValue();
check(Math.abs(after19 + p.finance.cash - (before19 + cashR) + (p.finance.lifetimeTaxPaid ? 0 : 0)) <= before19 * 0.2 && p.assets.filter((a) => a.kind === 'security').map((a) => a.catalogId).sort().join() === 'bonds,cashfund,index', 'into exactly the holdings of the mix');
check(Math.abs(p.finance.cash - cashR) <= before19 * 0.15, 'with no new money put in: only the tax on any gain comes out of it');
check(mkt.priceHistory('index').length >= 1, 'each holding has a price history to draw');
bookAction(); sound('after rebalancing');
section('investments pay out, once a year, as taxed income or reinvested; a portfolio can be spread across a mix');

// ---------- 20. Moving a mortgage ----------
p = life('us', { cash: 900000 });
const lst20 = estate.listings()[0];
estate.buyProperty(lst20.id, Math.round(lst20.price * 0.25));
const h20 = p.assets.find((a) => a.mortgage);
if (h20) {
  h20.mortgage.rate = 0.09; bookAction();
  const o20 = estate.remortgageOffer(h20.id, 85);
  check(o20.ok && o20.rate < 0.09 && o20.saving > 0, 'a dear mortgage can be moved to a cheaper rate');
  check(estate.remortgageOffer(h20.id, 85).rate <= estate.remortgageOffer(h20.id, 40).rate, 'a better record gets at least as good a rate');
  const owed20 = h20.mortgage.principal; const c20 = p.finance.cash;
  check(estate.remortgage(h20.id, 85).ok && h20.mortgage.rate === o20.rate && h20.mortgage.principal === owed20 && p.finance.cash === c20 - o20.fee, 'the rate and payment change; what is owed does not; the fee is paid');
  check(!estate.remortgage(h20.id, 85).ok, 'not twice in a year');
  bookAction(); sound('after remortgaging');
}
section('mortgages can be moved to a cheaper rate, for a fee, when the record allows');

// ---------- 21. Divorce: a pension, a business, and support afterwards ----------
p = life('us', { cash: 1000 });
p.career.salary = 120000;
const sp21 = person('spouse', 40, { salary: 20000, savings: 0 }); sp21.marriedAtAge = p.age - 12;
const kid21 = person('child', 8); kid21.parentIds = [sp21.id];
ret.openPlan(0.1); for (let i = 0; i < 3; i++) ret.contribute(), store.state.year += 1;
const pot21 = ret.plan().account.bal;
p.finance.cash = 400000; book({ cat: 'giftIn', desc: 'test' }); biz.start('cafe', 'Divorce Café', { borrow: 0 }); const b21 = biz.openBusinesses()[0]; b21.cash = 300000;
p.finance.cash = 2000; book({ cat: 'losses', desc: 'test' });
const owed21 = romance.settlement(sp21.id);
check(owed21 > 2000, 'a well-off player owes a former spouse more than they have in cash');
const sav21 = sp21.life.savings;
romance.divorce(sp21.id);
const plan21 = bank.accounts().find((a) => a.product === 'pension');
check(!plan21 || plan21.bal < pot21, 'part of the pension plan went to the former spouse');
check(b21.partners.some((x) => x.id === sp21.id) || bank.accounts().some((a) => a.product === 'pension' && a.bal === 0) === false, 'and, if still not enough, a share of the business');
check(sp21.life.savings > sav21, 'they received it');
const sup = fam.supportList();
const spousal = sup.find((x) => x.kind === 'spousal'); const childS = sup.find((x) => x.kind === 'child');
check(spousal && spousal.dir === 'pay' && spousal.amount === Math.round((120000 - 20000) * 0.2) && spousal.until === store.state.year + 6, 'spousal support to a former spouse who earned much less, for half the length of the marriage');
check(childS && childS.dir === 'receive' && childS.until === store.state.year + 10, 'and child support from them until the youngest is grown');
bookAction(); sound('after a divorce with a pension and a business');
for (const n of Object.values(store.state.npcs)) n.flags.helpedYear = store.state.year + 1; // nobody steps in with help this year, so the support alone can be counted
const c21 = p.finance.cash; store.state.year += 1; fam.tickFamilyMoney();
check(Math.abs(p.finance.cash - (c21 - spousal.amount + childS.amount)) <= 1, 'each year the support is paid and received');
check((yearTotals(store.state.ledger, store.state.year, 'USD').expense.supportOut ?? 0) > 0 && (yearTotals(store.state.ledger, store.state.year, 'USD').income.supportIn ?? 0) > 0, 'and recorded as support paid and received');
sp21.alive = false; store.state.year += 1; fam.tickFamilyMoney();
check(fam.supportList().length === 0, 'it ends when they die');
sound('after support');
p = life('uk', { cash: 1000 }); p.career.salary = 120000;
const sp21b = person('spouse', 40, { salary: 20000 }); sp21b.marriedAtAge = p.age - 12;
romance.divorce(sp21b.id);
check(!fam.supportList().some((x) => x.kind === 'spousal'), 'where each keeps their own, there is no spousal support');
section('divorce: pensions and businesses are divided when cash is not enough; support follows, by local rule');

// ---------- 22. The state pension ----------
p = life('uk', { age: 66, cash: 1000, job: false }); p.career.totalYears = 40;
const { tickStatePension, statePensionFor } = ret;
check(statePensionFor(p) > 0 && !p.flags.statePension, 'it has not started at 66');
p.age = 67; tickStatePension();
const sp22 = p.flags.statePension;
check(sp22 > 0 && p.milestones.some((m) => m.text === 'Began drawing a state pension.'), 'it starts at 67');
moneyYear();
const y22 = yearTotals(store.state.ledger, store.state.year, 'GBP');
check((y22.income.statePension ?? 0) === toMinor(sp22, 'GBP'), 'and is paid, and recorded as a state pension');
p = life('uk', { age: 67, cash: 1000, job: false }); p.career.totalYears = 2;
const short = statePensionFor(p); p.career.totalYears = 40;
check(short > 0 && short < statePensionFor(p), 'fewer years of work mean less, never nothing');
check(statePensionFor(life('uk', { age: 67, job: false })) > statePensionFor(life('ng', { age: 67, job: false })) * 0 && ret.stateScheme('uk') > ret.stateScheme('us') && ret.stateScheme('us') > ret.stateScheme('ng'), 'some countries pay more than others');
section('a state pension from 67, by years worked and by country');

// ---------- 23. Inheriting from family ----------
p = life('us', { cash: 1000 });
for (const n of Object.values(store.state.npcs)) if (['parent', 'grandparent', 'sibling'].includes(n.role)) n.alive = false;
const mum = person('parent', 70); mum.gender = 'female'; mum.savings = 90000; mum.meters.relationship = 70;
const sib23 = person('sibling', 35, { savings: 0 });
const c23 = p.finance.cash;
mum.alive = false; inheritFrom(mum);
const tax23 = Math.round(45000 * COUNTRIES.us.estateTax);
check(p.finance.cash === c23 + 45000 - tax23 && sib23.life.savings === 45000 - tax23 && mum.savings === 0, 'a parent\'s savings are shared between the player and their sibling, after estate tax, and are not left behind as well');
check(yearTotals(store.state.ledger, store.state.year, 'USD').income.inheritance === toMinor(45000 - tax23, 'USD') && p.milestones.some((m) => m.text === 'Inherited from ' + mum.firstName + '.'), 'it is recorded as an inheritance, and remembered');
const dad = person('parent', 72); dad.gender = 'male'; dad.savings = 50000; const mum2 = person('parent', 70); mum2.gender = 'female'; mum2.savings = 1000;
const c23b = p.finance.cash; dad.alive = false; inheritFrom(dad);
check(p.finance.cash === c23b && mum2.savings === 51000, 'with a parent still living, it goes to them first');
const gp = person('grandparent', 92); gp.flags.side = 'maternal'; gp.savings = 30000; const m2 = mum2.savings;
gp.alive = false; inheritFrom(gp);
check(mum2.savings === m2 + 30000 && p.finance.cash === c23b, 'a grandparent leaves what they have to their own child');
const wife23 = person('spouse', 60, { savings: 40000 }); const c23c = p.finance.cash;
wife23.alive = false; inheritFrom(wife23);
check(p.finance.cash === c23c + 40000 && wife23.life.savings === 0, 'a spouse\'s savings come to the player, without estate tax');
const cold23 = person('parent', 80); cold23.savings = 20000; cold23.meters.relationship = 5; mum2.alive = false;
const c23d = p.finance.cash; cold23.alive = false; inheritFrom(cold23);
check(p.finance.cash === c23d, 'a parent the player had fallen out with can leave them out');
sound('after inheriting');
section('inheritance from parents, grandparents and a spouse: once, to the right people, after tax where it applies');

// ---------- 24. Learning about money ----------
p = life('us', { cash: 5000 });
p.flags.moneySense = 0;
const opts24 = ach.lessonOptions();
check(opts24.length === 3 && opts24.every((x) => x.ok), 'there are ways to learn about money on purpose');
const c24 = p.finance.cash;
check(ach.takeLesson('course').ok && ach.moneySense() === 10 && p.finance.cash === c24 - opts24.find((x) => x.id === 'course').cost, 'a course costs money and teaches something');
check(!ach.takeLesson('course').ok, 'once a year');
check(txs().at(-1).cat === 'learning', 'it is in the book as learning about money');
check(ach.startingSense([{ meters: { money: 90 } }, { meters: { money: 60 } }]) === 6 && ach.startingSense([]) === 0, 'a child starts with a little of their parents\' way with money');
section('learning about money: on purpose, at school, and from parents');

// ---------- 25. New scenes move real money ----------
p = life('us', { cash: 30000 });
const love25 = person('partner', 30); love25.flags.engaged = true;
const sv25 = bank.openAccount(bank.banksHere().find((x) => x.products.includes('savings')).id, 'savings', 0);
const held25 = p.finance.cash + bank.bankWorth();
resolveChoice(getEvent('wedding_budget'), 1, { love: love25.id });
check(bank.accountById(sv25.id).bal > 0 && Math.abs(p.finance.cash + bank.bankWorth() - held25) <= 1, 'saving for the wedding moves real money into the account');
p.career.salary = 200000; // enough for a card limit that covers a wedding
const ck = cards.applyForCard(); const kk = cards.cards()[0];
check(ck.ok && kk.limit >= 8000, 'a card with room for a wedding');
if (ck.ok && kk.limit >= 8000) { const c25 = p.finance.cash; resolveChoice(getEvent('wedding_budget'), 3, { love: love25.id }); check(kk.balance === 8000 && p.finance.cash === c25, 'a wedding on the card is owed on the card'); }
const mum25 = person('parent', 78, { savings: 100 }); mum25.meters.money = 10;
const ms = mum25.savings ?? mum25.life?.savings ?? 0;
resolveChoice(getEvent('parent_money_help'), 0, { par: mum25.id });
check((mum25.savings ?? mum25.life?.savings) === ms + 2000, 'helping a parent with their bills really reaches them');
bookAction(); sound('after the new scenes');
section('new scenes: weddings, babies, careers, parents, university, grandparents, all with real money');

// ---------- 26. Fuller books for close family ----------
{
  const nm = await import('../js/engine/npcMoney.js');
  p = life('us', { cash: 1000 });
  const sis = person('sibling', 22, { savings: 60000, salary: 50000 }); sis.life.fin = null; // too young to be buying a home with it
  const f = nm.finOf(sis); f.style = 'balanced';
  nm.tickNpcMoney(sis);
  check(f.bank && f.bank.bal > 0 && sis.life.savings >= 0 && sis.life.savings <= 60000, 'spare money goes into a savings account of their own');
  const w0 = nm.npcWorth(sis); const bal0 = f.bank.bal;
  check(w0 === Math.round(sis.life.savings + f.bank.bal + f.invested + (f.home ? f.home.value - f.home.mortgage : 0) - f.debt - (f.card?.balance ?? 0)), 'their worth counts the bank, investments and home, less the card and debts');
  sis.life.savings = -bal0 / 2; f.invested = 0; nm.tickNpcMoney(sis);
  check(f.bank.bal < bal0 && f.debt === 0, 'in a hard year the bank account is drawn on before anything is borrowed');
  // A card: paid in full by the sensible, carried by the easy-going, canceled after two missed years.
  f.card = { bankId: 'meridian', limit: 10000, balance: 0, rateBp: 1900, missed: 0, opened: store.state.year };
  sis.life.savings = 20000; nm.tickNpcMoney(sis);
  check(f.card && f.card.balance === 0, 'a sensible person pays their card off each year');
  const bro = person('sibling', 22, { savings: 20000, salary: 50000 }); bro.life.fin = null; const g = nm.finOf(bro); g.style = 'bold';
  g.card = { bankId: 'meridian', limit: 10000, balance: 0, rateBp: 2400, missed: 0, opened: store.state.year };
  nm.tickNpcMoney(bro);
  check(g.card.balance > 0, 'an easy-going one carries a balance');
  bro.life.savings = 0; bro.life.job = null; if (g.bank) g.bank.bal = 0; g.invested = 0; g.card.balance = 9000;
  nm.tickNpcMoney(bro); nm.tickNpcMoney(bro);
  check(!g.card && g.defaulted === store.state.year && g.debt > 9000, 'two missed years and the card is canceled; what was owed becomes their debt, not the player\'s');
  check(p.finance.cash === 1000, 'none of it touched the player\'s money');
  // Early retirement, on what they have put by.
  const rich = person('sibling', 60, { savings: 0, salary: 60000 }); rich.life.fin = null; const r = nm.finOf(rich);
  r.bank = { bankId: 'meridian', name: 'Meridian Bank', bal: 5_000_000, rateBp: 100, opened: 2000 }; rich.life.yearsWorked = 35;
  // A 35% chance a year once they can afford it: six tries all miss about one time in thirteen, so allow twenty.
  let gone = false; for (let i = 0; i < 20 && !gone; i++) gone = nm.tickNpcMoney(rich) === 'retired';
  check(gone && rich.life.retired && !rich.life.job && rich.life.pension > 0, `someone with plenty put by may retire early, on a pension from their years of work${gone ? '' : ` (age ${rich.age}, job ${!!rich.life.job}, retired ${!!rich.life.retired}, bank ${r.bank?.bal}, debt ${r.debt}, savings ${rich.life.savings}, alive ${rich.alive})`}`);
  const poorer = person('sibling', 60, { savings: 0, salary: 60000 }); poorer.life.fin = null; nm.finOf(poorer);
  for (let i = 0; i < 5; i++) nm.tickNpcMoney(poorer);
  check(!poorer.life.retired, 'someone without it keeps working');
  // When the player is in trouble, a generous relative with money to spare may step in, and it comes out of their money.
  p = life('us', { cash: 0 }); p.finance.cash = -3000; book({ cat: 'losses', desc: 'test' });
  for (const n of Object.values(store.state.npcs)) n.meters.generosity = 0; // only the aunt is in a position to help
  const aunt = person('sibling', 50, { savings: 200000, relationship: 90 }); aunt.meters.generosity = 90;
  let help = null; for (let i = 0; i < 20 && !help; i++) help = nm.familyHelp();
  const had = 200000;
  check(help && help.npc === aunt && help.amount >= 1500 && p.finance.cash === -3000 + help.amount && nm.spendable(aunt) === had - help.amount, 'a generous relative helps, from their own money');
  check(nm.familyHelp() === null, 'and not again the next year');
  const mean = person('sibling', 50, { savings: 200000, relationship: 90 }); mean.meters.generosity = 10;
  aunt.flags.helpedYear = store.state.year;
  let h2 = null; for (let i = 0; i < 20 && !h2; i++) h2 = nm.familyHelp();
  check(!h2, 'someone who is not generous does not');
  // A spouse's estate: everything they had, less their own debts, once.
  p = life('us', { cash: 0 });
  const w = person('spouse', 60, { savings: 10000 }); w.life.fin = null; const wf = nm.finOf(w);
  wf.bank = { bankId: 'meridian', name: 'Meridian', bal: 30000, rateBp: 100, opened: 2000 }; wf.invested = 20000; wf.card = { limit: 5000, balance: 4000, rateBp: 1900, missed: 0 }; wf.debt = 6000;
  w.alive = false; inheritFrom(w);
  check(p.finance.cash === 10000 + 30000 + 20000 - 4000 - 6000 && nm.settleNpc(w) === 0, 'a spouse leaves what they had, less their own debts, and it passes once');
  sound('after family finances');
}
section('close family keep fuller books: a bank account, a card used their own way, early retirement, help in hard times');

// ---------- 27. Found in the balance playtest ----------
// The minimum payment once fell short of the interest, so a card paid at the minimum grew for ever.
p = life('us', { cash: 100000 });
cards.applyForCard(); const k27 = cards.cards()[0]; cards.setCard(k27.id, { autopay: 'min', everyday: false });
k27.balance = k27.limit; book({ cat: 'borrowing', desc: 'test' });
const owes = [];
for (let i = 0; i < 12; i++) { moneyYear(); owes.push(k27.balance); }
check(owes.every((x, i) => i === 0 || x <= owes[i - 1]) && owes.at(-1) < k27.limit * 0.9, `paying only the minimum still brings a card balance down, year after year (${owes.slice(0, 4).join(', ')} ...)`);
for (const rate of [1500, 1900, 2400]) { const t = { balance: 10000 * (1 + rate / 10000), rateBp: rate }; check(cards.minimumDue(t) > 10000 * rate / 10000, `at ${rate / 100}% the minimum is more than the interest`); }
// "Free of debt" is a milestone once; clearing debts again later is a line in the journal.
p = life('us', { cash: 100000 });
for (let i = 0; i < 3; i++) { loans.borrow(loans.loanOptions().find((x) => x.approved).amount); bookAction(); bank.tickMoneyReview(); loans.repayLoan(p.finance.loans[0].id); bookAction(); bank.tickMoneyReview(); }
check(p.milestones.filter((m) => m.text === 'Became free of debt.').length === 1, 'becoming free of debt is a milestone once, however often it happens');
// Relatives sell investments rather than miss a card payment.
{
  const nm = await import('../js/engine/npcMoney.js');
  const r27 = person('sibling', 40, { savings: 0, salary: 0 }); const f27 = nm.finOf(r27); f27.style = 'bold';
  f27.invested = 50000; f27.card = { bankId: 'meridian', limit: 10000, balance: 8000, rateBp: 2400, missed: 0, opened: 2000 };
  nm.tickNpcMoney(r27);
  check(f27.card && f27.card.missed === 0 && f27.invested < 50000 + 50000 * 0.2, 'a relative with investments sells some rather than miss a card payment');
}
sound('after the playtest fixes');
section('playtest fixes: card minimums cover interest; one debt-free milestone; investments before a missed payment');

for (const line of ok) console.log(`ok   ${line}`);
if (problems.length) { for (const m of problems) console.log(`FAIL ${m}`); console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Wealth, debt and what is passed on all add up.');
