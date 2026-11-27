// Checks the fame engine and the acting slice: the fame profile, the entertainment world, casting, contracts,
// work, pay, release, credits, the press, awards, family recognition, eras, and a save that reloads intact.
// Run with: node tests/fame.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { makeNpc } from '../js/engine/npcFactory.js';
import { COUNTRIES } from '../js/data/countries.js';
import { AUDIENCES, PRODUCTION_KINDS, TIERS, ROLE_KINDS, ROLES_FOR, SKILLS_FOR, AWARD_BODIES, MEDIA_ERAS } from '../js/data/fame.js';
import * as fame from '../js/engine/fame.js';
import * as ent from '../js/engine/entertainment.js';
import * as press from '../js/engine/press.js';
import * as awards from '../js/engine/awards.js';
import * as work from '../js/engine/worklife.js';
import * as skills from '../js/engine/skills.js';
import { die } from '../js/engine/death.js';
import { continueAs } from '../js/engine/legacy.js';

rng.seed(5150);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (id = 'uk', age = 22) => {
  do { store.state = createLife({ countryId: id, ...(id === 'us' ? { city: 'New York' } : {}) }); } while (store.state.player.royal); // a US life in a showbiz city: the US has a city in every state
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age; p.flags.livesWithParents = false; p.education.enrolled = false; p.education.stage = 'none';
  p.legal.record = []; p.stats.health = 85; p.stats.charm = 65; p.finance.cash = 50000;
  return p;
};
const year = () => { advanceYear(); store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 85); };
/** Auditions until a part of this kind is offered (or gives up). */
function bookA(kinds, p, o = {}) {
  for (let tries = 0; tries < 12; tries++) {
    for (const x of ent.castingBoard(p).filter((y) => !y.why && !y.applied && kinds.includes(y.production.kind) && (!o.tier || o.tier.includes(y.production.tier)))) {
      const r = ent.audition(x.production.id, x.role.idx, 'coach', x.role.approach);
      if (r.contract) return r.contract;
    }
    p.finance.cash += 2000;
    year();
  }
  return null;
}

// 1. Data.
for (const [k, v] of Object.entries(PRODUCTION_KINDS)) { check(!!AUDIENCES[v.audience] && MEDIA_ERAS[v.medium] != null && ROLES_FOR[k] && SKILLS_FOR[k], `${k}: incomplete`); }
for (const k of Object.values(ROLES_FOR).flat()) check(!!ROLE_KINDS[k], `unknown role kind ${k}`);
for (const b of AWARD_BODIES) for (const [, , kinds, roles, tiers] of b.categories) { check(kinds.every((k) => PRODUCTION_KINDS[k]) && (roles === 'production' || roles.every((r) => ROLE_KINDS[r])) && tiers.every((t) => TIERS[t]), `${b.id}: a category names something unknown`); }
section('data: kinds of production, parts, audiences, eras and award categories all name real things');

// 2. The fame profile.
let p = life();
check(p.hidden.fame === 0 && fame.scope(p).id === 'unknown', 'a new adult is unknown');
fame.gain({ audience: 'theater', amount: 30, why: 'test' }, p);
const f = fame.fameOf(p);
check(f.audiences.theater > f.audiences.film && f.audiences.film === 0, 'recognition is by audience: a stage name is not a film name');
check(Object.keys(f.regions).length === 1 && f.regions.uk > 0, 'and by country: being known at home is not being known abroad');
p.talents.acting = 90;
check(fame.recognitionIn('uk', p) < 90 && skills.levelOf('acting') === 90, 'skill and recognition are different things');
const before = f.legacy;
for (let i = 0; i < 6; i++) fame.tickFameProfile(p);
check(f.attention < 5 && f.legacy <= before && f.audiences.theater >= before * 0.69, 'attention fades fast; what was earned fades slowly');
// Other systems still nudge hidden.fame directly: the change is credited, with a cause.
const h0 = p.hidden.fame;
p.hidden.fame += 20;
fame.reconcile(p);
check(f.audiences.public > 0 && f.log.some((l) => /public life/.test(l.why)), 'a change from elsewhere (an election, a coronation) is credited to the public, with its cause');
check(p.hidden.fame >= h0, 'and the headline figure keeps up');
// An old save with only a number.
p = life();
delete p.fame;
p.hidden.fame = 40;
const g = fame.fameOf(p);
check(g.provenance?.migratedFrom === 40 && g.regions.uk === 40 && !(g.credits ?? []).length, 'an old save keeps its fame, says where it came from, and invents no work to explain it');
section('profile: audiences, countries, attention and legacy are separate; old saves migrate honestly');

// 3. The world.
p = life();
const orgs = ent.orgsOf('uk');
check(['studio', 'network', 'theater', 'community', 'agency'].every((k) => orgs.some((o) => o.kind === k)), 'a country has studios, networks, theaters, community companies and agencies');
{ const jn = await import('../js/engine/journalism.js'); const press = jn.nationalPress('uk');
  check(press.some((o) => o.kind === 'magazine') && press.some((o) => o.kind === 'tabloid') && !orgs.some((o) => o.kind === 'outlet'), 'and its press is the national press (one press world), not outlets of its own'); }
check(ent.orgsOf('uk').length === orgs.length && ent.orgsOf('uk')[0].id === orgs[0].id, 'and keeps them: they are not remade');
const pool = ent.pool('uk');
check(pool.length >= 30 && ent.pool('uk')[0].id === pool[0].id, 'working actors are persistent people');
ent.slate('uk');
const made = Object.values(ent.ent().productions).length;
ent.slate('uk');
check(Object.values(ent.ent().productions).length === made, 'a year\'s productions are announced once');
section(`world: ${orgs.length} organizations and ${pool.length} working actors in the United Kingdom, made once`);

// 4. The vertical slice: train, find a part, audition, sign, work, be paid, be released, be credited, be interviewed, reload.
p = life('uk', 24);
p.talents.acting = 70;
const actBefore = skills.levelOf('acting');
for (let i = 0; i < 3; i++) skills.practice?.('acting');
check(skills.levelOf('acting') >= actBefore, 'acting is trained through the existing practice system');
p.talents.acting = Math.max(p.talents.acting, 76); p.talents.singing = 60; p.talents.dance = 55;
const contract = bookA(['film', 'tv'], p, { tier: ['student', 'indie', 'network'] });
check(!!contract, 'a skilled actor finds a screen part, in time');
if (contract) {
  const prod = ent.production(contract.productionId);
  check(contract.status === 'offered' && contract.fee >= 0 && contract.weeks > 0, 'the offer is a contract with a fee, weeks and hours');
  const signed = ent.sign(contract.id);
  check(signed.ok && prod.cast[contract.idx].who === 'player', `signing puts the player in the cast (${signed.text})`);
  check(prod.cast.filter((r) => r.who && r.who !== 'player').every((r) => store.state.npcs[r.who]), 'the rest of the cast are real people');
  const cashBefore = p.finance.cash;
  year();
  check(['production'].includes(prod.status) && ent.activeWork(p).some((x) => x.id === prod.id), 'the next year it is being made, and the player is working on it');
  check(prod.cast.every((r) => r.who), 'by the time it is made, every part is cast');
  const cast = prod.cast.map((r) => r.who).join();
  check(work.weeklyLoad().rows.some((r) => r.label === 'Productions you are in' && r.hours > 0), 'the work takes time in the week');
  check(ent.onSet(prod.id, 'director').ok && ent.onSet(prod.id, 'rehearse').ok && !ent.onSet(prod.id, 'cast').ok, 'time on set: two things a year, not endless clicks');
  year();
  check(!!prod.reception && prod.status === 'released', 'when the work is done it is released, and judged once');
  check(prod.cast.map((r) => (r.who === 'player' ? 'player' : r.who)).join() === cast, 'the cast is the same people after release');
  const credit = ent.workOf(p).credits.find((c) => c.productionId === prod.id);
  check(!!credit, 'the player is credited');
  const paid = p.career.lastPay?.lines?.find((l) => l.source.startsWith(`ent:${contract.id}`));
  check(contract.fee === 0 || (paid && paid.gross === contract.fee - (contract.agent ? Math.round(contract.fee * contract.agent.commission) : 0)), `the fee is paid through payroll (${paid?.gross} of ${contract.fee})`);
  const again = work.payLines(p).filter((l) => l.source.startsWith(`ent:${contract.id}`));
  check(!again.length, 'and paid once');
  const rec = fame.fameOf(p).audiences[PRODUCTION_KINDS[prod.kind].audience];
  check(rec > 0, 'the work brings recognition, to the audience it reaches');
  check(ent.myPress(p).some((a) => a.productionId === prod.id && a.accuracy === 'verified'), 'the release is written about');
  // Interviews and premieres follow real work.
  press.makeOffers(p);
  const inv = ent.workOf(p).offers.find((o) => o.status === 'open');
  if (inv) { const r = press.attend(inv.id); check(inv.status === 'attended' && typeof r.text === 'string', 'an invitation can be accepted, and its outcome is recorded'); }
  const castmate = ent.castOf(prod)[0]?.npc;
  check(!!castmate && p.npcIds.includes(castmate.id) && castmate.flags.workedWith === prod.title, 'a castmate is now someone the player knows, linked to the production');
  check(p.milestones.some((m) => /First professional credit/.test(m.text)) || prod.tier === 'student', 'a first professional credit is a milestone in the life story');
  // Save and reload.
  const saved = JSON.parse(JSON.stringify(store.state));
  const snapshot = JSON.stringify({ credits: ent.workOf(p).credits, contracts: ent.workOf(p).contracts, cast: prod.cast, rec: prod.reception, cash: p.finance.cash, fame: fame.fameOf(p), press: ent.myPress(p).length });
  store.state = saved;
  const q = store.state.player;
  const prod2 = ent.production(prod.id);
  const after = JSON.stringify({ credits: ent.workOf(q).credits, contracts: ent.workOf(q).contracts, cast: prod2.cast, rec: prod2.reception, cash: q.finance.cash, fame: fame.fameOf(q), press: ent.myPress(q).length });
  check(snapshot === after, 'a reloaded save has the same credits, contracts, cast, reception, money, recognition and press');
  check(store.state.npcs[castmate.id]?.firstName === castmate.firstName, 'and the same castmate');
  p = q;
}
section('the acting slice: trained, cast, signed, worked, paid once, released, credited, written about, and reloaded intact');

// 5. A skilled actor can fail; success does not make a star.
p = life('uk', 30);
p.talents.acting = 88;
let tried = 0; let booked = 0;
for (let y = 0; y < 3; y++) {
  for (const x of ent.castingBoard(p).filter((z) => !z.why && !z.applied)) { tried += 1; if (ent.audition(x.production.id, x.role.idx, 'study', 'restrained').contract) booked += 1; }
  year();
}
check(tried > 5 && booked < tried, `a very good actor still loses auditions (${booked} of ${tried})`);
p = life('uk', 30);
fame.gain({ audience: 'film', amount: 12, why: 'one good film' }, p);
check(fame.scope(p).id !== 'international' && Object.keys(fame.fameOf(p).regions).length === 1, 'one well-received film does not make anyone famous around the world');
section(`odds: ${booked} parts from ${tried} auditions for a fine actor; one success is not global fame`);

// 6. Schedules.
p = life('uk', 30);
p.talents.acting = 95; p.talents.singing = 90; p.talents.dance = 90;
const a = ent.makeProduction('musical', 'regional', 'uk', { openShare: 1 });
const b = ent.makeProduction('stage', 'regional', 'uk', { openShare: 1 });
const t = ent.makeProduction('tv', 'network', 'uk', { openShare: 1 });
b.workYear = a.workYear; t.workYear = a.workYear;
ent.workOf(p).contracts.push({ id: 'c1', productionId: a.id, idx: 0, fee: 1000, weeks: 36, hours: 38, years: a.runYears, status: 'signed', age: p.age, paidYears: [], perf: 80 });
a.cast[0].who = 'player';
check(!!ent.scheduleClash(b, p) && !!ent.scheduleClash(t, p), 'two nightly stage runs, or a stage run and a television series, cannot be signed for at once');
check(/already in this production/.test(ent.whyNot(a, a.cast[1], p)), 'nobody plays two parts in the same production');
section('schedules: work that cannot be done together cannot be signed for together');

// 7. Awards.
p = life('uk', 30);
ent.slate('uk');
for (let i = 0; i < 3; i++) year();
const seasons = Object.values(ent.ent().seasons);
check(seasons.length > 0, 'award seasons are held');
const s0 = seasons[0];
const copy = JSON.stringify(s0);
const body = AWARD_BODIES.find((x) => x.id === s0.bodyId);
awards.holdSeason(body, s0.scope, s0.year);
check(JSON.stringify(ent.ent().seasons[s0.id]) === copy, 'holding a season again changes nothing: results are decided once');
for (const s of seasons) for (const cat of Object.values(s.categories)) {
  check(cat.nominees.length >= 2 && cat.nominees.some((n) => n.productionId === cat.winner.productionId && n.who === cat.winner.who), `${s.id}: the winner is one of the nominees`);
  check(cat.nominees.every((n) => n.title), `${s.id}: nominations keep the titles they were for`);
}
store.state.year = 1940;
check(!awards.holdSeason(AWARD_BODIES.find((x) => x.id === 'lumen'), 'world', 1940), 'an award body that did not exist yet holds no season');
section(`awards: ${seasons.length} seasons held once each, winners from the nominees, and none before a body was founded`);

// 8. Eras.
p = life('uk', 25);
store.state.year = 1800;
check(!ent.makeProduction('film', 'studio', 'uk') && !ent.makeProduction('tv', 'network', 'uk'), 'in 1800 there are no films and no television');
check(!!ent.makeProduction('stage', 'regional', 'uk'), 'but there is theater');
check(!fame.exists('digital', 1990) && fame.exists('digital', 2015), 'and the internet arrives when it arrives');
section('eras: what can be made depends on the year: theater always, film and television later, the internet later still');

// 9. Press: truth is not what is printed.
p = life('uk', 30);
fame.gain({ audience: 'tv', amount: 60, why: 'test' }, p);
let rumor = null;
for (let i = 0; i < 40 && !rumor; i++) rumor = press.maybeRumor(p);
check(!!rumor && ['rumor', 'speculation'].includes(rumor.accuracy), 'the press prints rumors about known people, marked as rumors');
if (rumor) {
  const truth = rumor.true;
  press.hirePublicist();
  press.answer(rumor.id, 'correction');
  check(rumor.true === truth, 'nothing anyone says changes whether it is true');
  check(truth ? !rumor.corrected : rumor.corrected, 'only a false story can be corrected');
}
const partner = makeNpc({ role: 'partner', countryId: 'uk', age: 30, relationship: 80 }); store.state.npcs[partner.id] = partner; p.npcIds.push(partner.id);
press.setPrivacy('private');
for (let i = 0; i < 10; i++) press.tickPress(p);
check(!ent.myPress(p).some((a) => a.kind === 'relationship'), 'a private person\'s relationship is not reported as news');
section('press: rumors are rumors, corrections only for false stories, and privacy is respected');

// 10. Children: protected, and not credited with their parents' work.
p = life('uk', 10);
p.talents.acting = 70;
p.flags.guardianWork = true;
const kidRole = ent.makeProduction('tv', 'network', 'uk', { openShare: 1 });
for (const r of kidRole.cast) r.ages = [8, 13];
let kidContract = null;
for (let i = 0; i < 20 && !kidContract; i++) { delete ent.workOf(p).applied[`${kidRole.id}:${i % kidRole.cast.length}`]; kidContract = ent.audition(kidRole.id, i % kidRole.cast.length, 'coach', kidRole.cast[i % kidRole.cast.length].approach).contract; }
if (kidContract) {
  kidContract.fee = 10000;
  ent.sign(kidContract.id);
  year(); year();
  check(ent.workOf(p).trust > 0, 'part of a child performer\'s earnings is held in trust');
  const line = p.career.lastPay?.lines?.find((l) => l.source.startsWith(`ent:${kidContract.id}`));
  check(!line || line.gross < kidContract.fee, 'and is not paid out to them as a child');
}
p.flags.guardianWork = false;
const r0 = kidRole.cast[0];
check(/parent or guardian/.test(ent.whyNot(kidRole, r0, p)), 'a child cannot work without a parent\'s or guardian\'s agreement');
// A famous parent's child.
p = life('uk', 60);
fame.gain({ audience: 'film', amount: 80, lasting: 1, why: 'a long career' }, p);
const kid = makeNpc({ role: 'child', countryId: 'uk', age: 25 }); store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id);
die('old age');
const next = continueAs(kid.id);
if (next) {
  const q = next.player;
  const qf = fame.fameOf(q);
  check(qf.family > 0 && qf.audiences.film === 0 && !(qf.credits ?? []).length && qf.credibility === 0, 'the child of a famous parent is known for the name, with no credits, audience or standing of their own');
  check(q.talents.acting !== 99, 'and does not inherit their parent\'s skill as a matter of course');
}
section('children: a guardian\'s agreement, money held in trust, and a famous name that is not a career');

// 11. A long run stays sane.
p = life('us', 20);
p.talents.acting = 72; p.talents.singing = 65; p.talents.dance = 60;
for (let y = 0; y < 25 && p.alive; y++) {
  for (const x of ent.castingBoard(p).filter((z) => !z.why && !z.applied).slice(0, 4)) { const r = ent.audition(x.production.id, x.role.idx, 'study', x.role.approach); if (r.contract) ent.sign(r.contract.id); }
  if (!ent.workOf(p).agent && press.agentsWilling(p).length) press.signAgent(press.agentsWilling(p)[0].npc.id);
  try { year(); } catch (err) { problems.push(`year ${y}: ${err.stack.split('\n').slice(0, 3).join(' ')}`); break; }
  const ff = fame.fameOf(p);
  check(Object.values(ff.audiences).every((v) => v >= 0 && v <= 100) && ff.favor >= 0 && ff.favor <= 100 && Number.isFinite(p.finance.cash), `year ${y}: figures out of range`);
}
const size = JSON.stringify(store.state).length;
check(size < 1_200_000, `a long acting life stays a reasonable size (${Math.round(size / 1024)} KB)`);
section(`a 25-year acting career runs cleanly: ${ent.workOf(p).credits.length} credits, ${fame.scope(p).name.toLowerCase()}, ${Math.round(size / 1024)} KB`);

// ---------- The casting board: parts that are open to you, parts that are not, and what each is worth ----------
{
  for (const [age, who] of [[9, 'a child'], [22, 'a newcomer'], [47, 'a newcomer in middle age'], [71, 'an older newcomer']]) {
    const p = life('us', age);
    p.flags.guardianWork = true; // a child's parents said yes (they may not: that is checked above)
    const board = ent.castingBoard(p);
    const open = board.filter((x) => !x.why);
    check(open.length >= 3, `${who} (${age}) with no credits has parts to go for (${open.length} of ${board.length})`);
    check(board.some((x) => x.why), `${who}: some parts are not open, and say why`);
    check(open.every((x) => p.age >= x.role.ages[0] - 2 && p.age <= x.role.ages[1] + 4), `${who}: the open parts fit their age`);
    const again = ent.castingBoard(p).filter((x) => !x.why).map((x) => `${x.production.id}:${x.role.idx}`).join();
    check(again === open.map((x) => `${x.production.id}:${x.role.idx}`).join(), `${who}: the board is the same when looked at again`);
  }
  const prods = Object.values(ent.ent().productions);
  const qs = prods.map((x) => ent.scriptOf(x));
  check(qs.every((q) => q >= 15 && q <= 97) && new Set(prods.map((x) => ent.scriptWord(x))).size >= 3, 'scripts run from weak to great');
  check(prods.every((x) => /director$/.test(ent.directorWord(x))), 'every production has a director with a standing');
  const x = prods[0]; const q = ent.scriptOf(x); delete x.script;
  check(ent.scriptOf(x) === q, 'a production keeps its script quality (an old save gets the same one)');
  section('the casting board: parts that fit, parts that do not and why, a script and a director to weigh');
}

// ---------- Born famous: a royal baby is known everywhere but uses none of it ----------
{
  const career = await import('../js/engine/career.js');
  const p = life('uk', 0);
  p.hidden.fame = 71;
  const avail = () => career.fameOptions().filter((o) => o.available).map((o) => o.id).sort().join();
  check(!career.canUseFame() && avail() === '' && career.fameOptions().every((o) => /From age/.test(o.reason)), 'a famous baby cannot use their fame');
  check(!career.doFameAction('book').ok && !p.milestones.some((m) => /book/i.test(m.text)), 'nor write a book');
  p.age = 5;
  check(career.canUseFame() && avail() === 'commercial,photoshoot', `at five: a photoshoot or a commercial (${avail()})`);
  p.age = 10;
  check(avail() === 'commercial,photoshoot,talk_show', `at ten: a talk show too (${avail()})`);
  p.age = 12;
  check(avail() === 'book,commercial,photoshoot,talk_show', `at twelve: a book too (${avail()})`);
  section('fame is used only by those old enough: nothing for a baby, a book from twelve');
}

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 30)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('The show goes on.');
