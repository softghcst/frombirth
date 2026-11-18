// Checks owning a business: who may start one, its own money, staff who are real people, the yearly accounts,
// the owner paid once through payroll, time, partners, selling, failing, handing on, and inheritance.
// Run with: node tests/business.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { makeNpc } from '../js/engine/npcFactory.js';
import { CAREER_BY_ID } from '../js/data/careers.js';
import { FAMILY_BY_ID } from '../js/data/occupations.js';
import { PROGRAMMES, TRADE_BY_ID } from '../js/data/schools.js';
import { BUSINESS_TYPES, BUSINESS_BY_ID, FROM_SERVICE, DRAWS } from '../js/data/business.js';
import { SERVICE_BY_ID } from '../js/data/freelance.js';
import * as biz from '../js/engine/business.js';
import * as work from '../js/engine/worklife.js';
import * as career from '../js/engine/career.js';
import * as market from '../js/engine/employers.js';
import * as record from '../js/engine/careerRecord.js';
import { die } from '../js/engine/death.js';
import { continueAs } from '../js/engine/legacy.js';

rng.seed(8128);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (id = 'us', age = 32, cash = 500000) => {
  do { store.state = createLife({ countryId: id }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age; p.flags.livesWithParents = false; p.education.enrolled = false; p.education.stage = 'none';
  p.legal.record = []; p.stats.health = 85; p.stats.intellect = 68; p.hidden.discipline = 62; p.finance.cash = cash;
  p.education.degrees.push({ type: 'high', gpa: 3.2, age: 18 });
  work.career();
  return p;
};
const year = () => { advanceYear(); store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 85); };
const staffUp = (b, n) => { for (let i = 0; i < n; i++) biz.hire(b, 0); };

// 1. The kinds of business.
const ids = new Set();
for (const t of BUSINESS_TYPES) {
  check(!ids.has(t.id), `duplicate business ${t.id}`); ids.add(t.id);
  check(!!FAMILY_BY_ID[t.family] && !!CAREER_BY_ID[t.track], `${t.id}: unknown family or track`);
  check(t.startup > 0 && t.perHead > t.wage * (1 + t.cogs), `${t.id}: a member of staff could never pay for themselves`);
  check(t.cogs > 0 && t.cogs < 0.6, `${t.id}: odd cost of supplies`);
  if (t.needs.trade) check(!!TRADE_BY_ID[t.needs.trade], `${t.id}: unknown trade`);
  if (t.needs.programme) check(!!PROGRAMMES[t.needs.programme], `${t.id}: unknown programme`);
  for (const id of Object.keys(t.needs.experience ?? {})) check(!!CAREER_BY_ID[id], `${t.id}: experience in an unknown career ${id}`);
}
for (const [s, b] of Object.entries(FROM_SERVICE)) check(!!SERVICE_BY_ID[s] && !!BUSINESS_BY_ID[b], `freelance ${s} grows into an unknown business ${b}`);
section(`kinds: ${BUSINESS_TYPES.length} businesses, each tied to a real field, trade or licence`);

// 2. Who may start one.
let p = life();
check(biz.startBlock(BUSINESS_BY_ID.electrical).length > 0, 'an electrical firm needs an electrician');
check(biz.startBlock(BUSINESS_BY_ID.clinic).length > 0 && biz.startBlock(BUSINESS_BY_ID.law_firm).length > 0, 'a clinic needs a doctor, a law practice a lawyer');
check(!biz.startBlock(BUSINESS_BY_ID.cafe), 'anyone may open a café');
p.finance.cash = 100;
check(!biz.start('cafe').ok && !biz.businesses().length, 'not without the money');
p = life('us', 16);
check(biz.startBlock(BUSINESS_BY_ID.cafe).length > 0, 'not at sixteen');
p = life();
career.hire(CAREER_BY_ID.diplomacy, 0, 60, 'Test.');
check(!biz.start('cafe').ok, 'a diplomat may not run a business on the side');
p = life();
career.hire(CAREER_BY_ID.corporate, 7, 70, 'Test.');
check(!biz.businesses().length && /chief executive/i.test(work.career().title), 'a chief executive does not own their employer');
section('starting: the right qualification, the money, the age, and a contract that allows it');

// 3. Its own money; the owner paid once, through payroll.
p = life();
p.education.degrees.push({ type: 'apprenticeship', majorId: 'electrician', gpa: 3, age: 21 });
work.career().experience.electrician = 8;
const cashBefore = p.finance.cash;
let r = biz.start('electrical', 'Sparks & Co.', { borrow: 0 });
check(r.ok, `an electrician can open a firm (${r.text})`);
let b = biz.openBusinesses()[0];
const cost = biz.figures(BUSINESS_BY_ID.electrical).startup;
check(p.finance.cash === cashBefore - cost, 'the owner pays the cost of opening, once');
check(market.employer(b.employerId)?.owned && !market.board().some((x) => x.employerId === b.employerId), 'it is on the map as an employer, and does not advertise on its own');
check(work.weeklyLoad().rows.some((x) => x.kind === 'business' && x.hours === b.ownerHours), 'running it takes hours in the week');
const personal = p.finance.cash;
year();
check(b.last && b.last.revenue > 0 && b.years === 1, 'the business had a year, with accounts');
check(b.last.profit === b.last.revenue - b.last.wages - b.last.rent - b.last.supplies - b.last.overhead - b.last.interest, 'the accounts add up');
const pay = work.career().lastPay;
const line = pay.lines.find((l) => l.source === `biz:${b.id}`);
check(b.last.drawn > 0 ? line?.gross === b.last.drawn : !line, `what the owner took out came through payroll (${line?.gross} of ${b.last.drawn})`);
check(b.payoutPaid && !work.payLines(p).some((l) => l.source === `biz:${b.id}`), 'and is not owed twice');
check(p.finance.cash < personal + b.last.revenue, 'the takings are the company\'s, not the owner\'s');
// Taking spare cash out goes through payroll too.
const spare = biz.spareCash(b);
if (spare > 100) {
  const w = biz.withdraw(b, Math.floor(spare / 2));
  check(w.ok && work.payLines(p).some((l) => l.source === `biz:${b.id}`), 'money taken out is paid with the year\'s income');
  check(!biz.withdraw(b, b.cash * 5).ok, 'more than the business has cannot be taken');
}
section('money: the company has its own account, and the owner is paid from profit, once, with tax');

// 3b. Tax on profit, by country, with losses carried forward.
{
  const { PROFIT_TAX } = await import('../js/data/business.js');
  const { typicalWage } = await import('../js/engine/systems.js');
  const { COUNTRIES } = await import('../js/data/countries.js');
  for (const id of Object.keys(PROFIT_TAX)) check(!!COUNTRIES[id] && PROFIT_TAX[id].rate >= 0 && PROFIT_TAX[id].rate < 0.5 && (PROFIT_TAX[id].small ?? 0) <= PROFIT_TAX[id].rate, `profit tax for ${id} is out of range`);
  const band = typicalWage(COUNTRIES.uk) * 3;
  const big = biz.profitTax(band * 4, 'uk');
  check(big.tax === Math.round(band * 0.19 + band * 3 * 0.25), `a large British profit pays the small rate on the first slice and the main rate on the rest (${big.tax})`);
  check(biz.profitTax(1000, 'ae').tax === 0 && biz.profitTax(-5000, 'us').tax === 0, 'small profits in the Emirates, and losses anywhere, pay nothing');
  const loss = biz.profitTax(-30000, 'us', 0);
  check(loss.carry === 30000, 'a loss is carried forward');
  const next = biz.profitTax(50000, 'us', loss.carry);
  check(next.taxable === 20000 && next.tax === Math.round(20000 * 0.21) && next.carry === 0, `and set against the next profit (${next.taxable} taxable)`);
  const part = biz.profitTax(10000, 'us', 30000);
  check(part.tax === 0 && part.carry === 20000, 'a profit smaller than the losses carried pays nothing, and uses some of them up');
  // In the accounts.
  p = life();
  biz.start('cafe', 'Taxed Café');
  b = biz.openBusinesses()[0];
  staffUp(b, 2);
  let paidSome = false;
  for (let i = 0; i < 6 && b.status === 'open'; i++) {
    const carry = b.lossCarry ?? 0;
    year();
    if (!b.last) continue;
    const expect = biz.profitTax(b.last.profit, b.countryId, carry);
    check(b.last.tax === expect.tax && b.lossCarry === expect.carry, `year ${i}: the business paid the tax its accounts owe (${b.last.tax} against ${expect.tax})`);
    check(b.last.drawn <= Math.max(0, b.last.afterTax), 'the owner is paid only from what is left after tax');
    if (b.last.tax > 0) paidSome = true;
  }
  check(paidSome || b.status !== 'open', 'a profitable business pays tax');
  // A sole trader is taxed once, as income.
  p = life();
  p.education.degrees.push({ type: 'apprenticeship', majorId: 'electrician', gpa: 3, age: 21 });
  work.career().experience.electrician = 8;
  biz.start('electrical', 'Solo Sparks');
  const solo = biz.openBusinesses()[0];
  year(); year();
  check(solo.last && solo.last.tax === 0 && solo.draw === 'most', 'someone working alone pays no profit tax, and takes most of the profit as income');
  check(b.taxPaid >= 0, 'the business keeps a record of the tax it has paid');
}
section('tax: profit is taxed where the business is, at a small-profit rate first, after earlier losses; the owner takes what is left');

// 4. Staff are people.
// Whether one café lasts four years is partly luck (competition and setbacks), so open up to five: a staffed café
// must be able to survive, and the rest of this section follows the first one that does.
let firstId = null; let survived = 0; let tried = 0;
for (; tried < 5 && !survived; tried++) {
  p = life();
  biz.start('cafe', 'The Test Café');
  b = biz.openBusinesses()[0];
  const cands = biz.candidates(b);
  check(cands.length === 3 && biz.candidates(b)[0] === cands[0], 'three applicants a year, the same three however often you look');
  staffUp(b, 3);
  const team = biz.staffOf(b);
  check(team.length === 3 && team.every((s) => s.npc.life?.job?.employerId === b.employerId && p.npcIds.includes(s.id)), 'people taken on are real, and work there');
  firstId = team[0].id;
  biz.setManager(b, firstId);
  check(biz.managerOf(b)?.id === firstId && biz.staffOf(b).find((s) => s.manager).wage > biz.staffOf(b).find((s) => !s.manager).wage * 1.2, 'a manager can be appointed, on a manager\'s wage');
  for (let i = 0; i < 4 && b.status === 'open'; i++) year();
  if (b.status === 'open') survived += 1;
}
check(survived === 1, `a café with three staff can survive its first years (none of ${tried} did)`);
check(!!store.state.npcs[firstId], 'staff persist from year to year');
const gone = biz.staffOf(b)[0];
if (gone) { biz.letGo(b, gone.id); check(store.state.npcs[gone.id] && !gone.npc.life.job && !biz.staffOf(b).some((s) => s.id === gone.id), 'someone let go is out of work, and still a person the owner knows'); }
const friend = makeNpc({ role: 'friend', countryId: p.countryId, age: 30, relationship: 95 }); store.state.npcs[friend.id] = friend; p.npcIds.push(friend.id);
let joined = false;
for (let i = 0; i < 12 && !joined; i++) { b.acts = null; joined = biz.hireKnown(b, friend.id).ok; }
check(joined && friend.role === 'friend' && friend.flags.employeeOf === b.id, 'a friend can be brought into the business, and stays a friend');
section('staff: applicants, managers, friends in the business, all persistent people');

// 5. Too many wages and too little custom ends it; the debts are real.
p = life('us', 32, 600000);
biz.start('restaurant', 'Overreach', { borrow: 0 });
p.education.degrees.push({ type: 'x', gpa: 3, age: 20 });
if (!biz.openBusinesses().length) { work.career().experience.kitchen = 5; biz.start('restaurant', 'Overreach'); }
b = biz.openBusinesses()[0];
b.others = 25;
const mine = p.finance.cash;
year(); year();
check(b.status === 'failed', `a business that cannot pay its wages fails (${b.status})`);
check(p.finance.cash < mine + biz.figures(BUSINESS_BY_ID.restaurant).startup * 0.2, `the owner is not made richer by it (${p.finance.cash - mine})`);
check(biz.businesses().includes(b) && b.history.some((h) => /went under/.test(h.text)), 'its record is kept after it has gone');
check(market.employer(b.employerId).closed, 'and the employer is closed');
section('failure: unpaid wages close the doors, and the record remains');

// 6. Partners and selling.
p = life();
p.education.degrees.push({ type: 'apprenticeship', majorId: 'plumber', gpa: 3, age: 21 });
work.career().experience.plumber = 10;
biz.start('plumbing', 'Pipework');
b = biz.openBusinesses()[0];
for (let i = 0; i < 3; i++) year();
const rich = makeNpc({ role: 'friend', countryId: p.countryId, age: 45, relationship: 98 }); store.state.npcs[rich.id] = rich; p.npcIds.push(rich.id);
rich.meters.money = 95;
let partnered = false;
for (let i = 0; i < 20 && !partnered; i++) { b.acts = null; partnered = biz.takePartner(b, rich.id).ok; }
check(partnered && b.stake === 0.75 && b.partners[0].id === rich.id, 'a friend can buy a quarter of it');
const outBefore = b.last?.drawn;
year();
check(b.last.drawn <= Math.round(Math.max(0, b.last.afterTax) * DRAWS[b.draw].share * 0.75) + 1, `the owner's share of what is paid out follows their stake (${b.last.drawn} of ${b.last.afterTax}, was ${outBefore})`);
let sold = false;
const before = p.finance.cash;
for (let i = 0; i < 30 && !sold; i++) { b.acts = null; sold = biz.sell(b).ok; }
check(sold && b.status === 'sold' && p.finance.cash > before, 'it can be sold, for money');
check(!market.employer(b.employerId).closed && !market.employer(b.employerId).owned, 'and carries on under someone else');
year();
check(!work.career().lastPay?.lines.some((l) => l.source === `biz:${b.id}`), 'a sold business pays its old owner nothing more');
record.checkAchievements(p);
check(work.career().achievements.some((a) => a.id === 'entrepreneur') && work.career().achievements.some((a) => a.id === 'sold_up'), 'running one for years, and selling it, are milestones');
section('partners and sale: a stake can be sold, and the whole thing too');

// 7. Handing on, and inheritance.
p = life('us', 68);
biz.start('bakery', 'The Family Bakery');
b = biz.openBusinesses()[0];
staffUp(b, 2);
biz.setManager(b, biz.staffOf(b)[0].id);
b.cash += 200000; // well funded: this is a test of inheritance, not of trading
for (let i = 0; i < 2; i++) year();
check(b.status === 'open', `the bakery is still trading when its owner dies (${b.status})`);
const kid = makeNpc({ role: 'child', countryId: p.countryId, age: 38, relationship: 90 }); store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id);
const other = makeNpc({ role: 'child', countryId: p.countryId, age: 35, relationship: 90 }); store.state.npcs[other.id] = other; p.npcIds.push(other.id);
check(biz.heirsFor(b).length === 2, 'grown children can be considered');
biz.nameHeir(b, kid.id);
const bizName = b.name;
const managerId = biz.managerOf(b)?.id;
die('old age');
const next = continueAs(kid.id);
check(!!next, 'the heir carries on');
if (next) {
  const got = next.player.businesses.find((x) => x.name === bizName);
  check(!!got && got.status === 'open' && got.stake === 1, 'the named heir owns the business');
  check(!!got && (got.ownerHours <= 10), 'owning it did not put them in the manager\'s chair');
  check(!!got && (!next.npcs[managerId]?.alive || got.staff.some((s) => s.manager && s.id === managerId)), 'whoever ran it is still running it');
  check((next.careerRecord ?? []).some((rec) => (rec.businesses ?? []).some((x) => x.name === bizName)), 'the family record remembers who founded it');
  year();
  check(got?.years >= 3 && got?.last, 'and it trades on under the new owner');
}
// A child who was not named gets nothing by default when another was.
p = life('us', 70);
biz.start('shop', 'Corner Shop');
b = biz.openBusinesses()[0];
const a1 = makeNpc({ role: 'child', countryId: p.countryId, age: 40, relationship: 90 }); store.state.npcs[a1.id] = a1; p.npcIds.push(a1.id);
const a2 = makeNpc({ role: 'child', countryId: p.countryId, age: 37, relationship: 90 }); store.state.npcs[a2.id] = a2; p.npcIds.push(a2.id);
biz.nameHeir(b, a2.id);
die('old age');
const n2 = continueAs(a1.id);
check(!!n2 && !n2.player.businesses.length, 'a child is not handed a business that was left to their sibling');
// Handing over in life.
p = life('us', 66);
biz.start('bookshop', 'Old Pages');
b = biz.openBusinesses()[0];
const heir = makeNpc({ role: 'child', countryId: p.countryId, age: 30, relationship: 99 }); store.state.npcs[heir.id] = heir; p.npcIds.push(heir.id);
let given = false;
for (let i = 0; i < 20 && !given; i++) given = biz.handOver(b, heir.id).ok;
check(given && b.status === 'family' && b.ownerNpcId === heir.id && !work.weeklyLoad().rows.some((x) => x.kind === 'business'), 'it can be handed over in life, and the owner\'s hours are their own again');
year();
check(['family', 'closed'].includes(b.status) && !work.career().lastPay?.lines.some((l) => l.source === `biz:${b.id}`), 'the old owner is no longer paid from it');
section('generations: named heirs inherit ownership, not the manager\'s chair; a business can be given in life');

// 8. Old saves, and a long run.
p = life();
delete p.businesses;
check(Array.isArray(biz.businesses(p)) && !biz.openBusinesses(p).length, 'a save from before businesses has none, and plays on');
year();
let size = 0;
for (const type of ['cafe', 'shop', 'cleaning']) {
  p = life('us', 28, 300000);
  biz.start(type);
  b = biz.openBusinesses()[0];
  staffUp(b, type === 'cleaning' ? 1 : 2);
  for (let i = 0; i < 40 && p.alive; i++) {
    try { year(); } catch (err) { problems.push(`${type} year ${i}: ${err.stack.split('\n').slice(0, 3).join(' ')}`); break; }
    for (const x of biz.businesses()) check(Number.isFinite(x.cash) && x.reputation >= 0 && x.reputation <= 100 && x.debt >= 0, `${type}: figures went wrong in year ${i}`);
    if (b.status === 'open' && b.last?.demand > b.last?.heads * 1.3 && b.cash > 0) biz.hire(b, 0);
  }
  size = Math.max(size, JSON.stringify(store.state.player.businesses).length);
}
check(size < 60000, `a business stays small in the save (${Math.round(size / 1024)} KB)`);
section(`long runs: three businesses over forty years, figures always sane; ${Math.round(size / 1024)} KB at most`);

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 30)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('Open for business.');
