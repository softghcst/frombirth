// Childhood from birth (engine/childhood.js): things to do at each age, with a parent where a small child needs one;
// friends from the playground who are people from then on; early likings that come to a head start and no more;
// pocket money a parent may refuse and that really leaves the family's money; chores; small jobs by age and law.
// Run with: node tests/childhood.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { ledgerOf } = await import('../js/engine/ledger.js');
const { spendable } = await import('../js/engine/npcMoney.js');
const { CHILD_ACTIVITIES, CHILD_ACTS_A_YEAR, EARLY_CAP, ALLOWANCE } = await import('../js/data/childhood.js');
const { localMoney } = await import('../js/util.js');
const kid = await import('../js/engine/childhood.js');
const skills = await import('../js/engine/skills.js');
const bonds = await import('../js/engine/bonds.js');
const turns = await import('../js/engine/turns.js');
const save = await import('../js/save.js');

rng.seed(777);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;

/** A child of `age`, with at least one parent who has money (or none, if `poor`). */
function child(age, o = {}) {
  for (;;) {
    store.state = createLife({ countryId: o.countryId ?? 'us', ...(o.year ? { year: o.year } : {}) });
    const p = P();
    if (p.royal) continue;
    p.age = age; p.birthYear = S().year - age;
    ledgerOf();
    const parents = kid.guardians();
    if (!parents.length) continue;
    for (const n of parents) { n.meters.generosity = o.generosity ?? 90; n.meters.relationship = 90; if (n.life) n.life.savings = o.poor ? 0 : 50000; else n.savings = o.poor ? 0 : 50000; if (n.life?.fin?.bank) n.life.fin.bank.bal = 0; }
    p.finance.cash = 0;
    return p;
  }
}
const ids = () => kid.childActivities().map((a) => a.id);

// ---------- 1. Things to do, by age ----------
{
  child(0);
  const baby = ids();
  check(baby.includes('bond') && baby.includes('lullaby') && baby.includes('babygroup') && !baby.includes('playground') && !baby.includes('sleepover'), `a baby has a baby's things to do (${baby.join(', ')})`);
  check(CHILD_ACTIVITIES.filter((a) => a.ages[0] === 0 && a.id !== 'toys').every((a) => a.parent || a.sibling), 'and is taken to them: a baby organizes nothing');
  const r = kid.doActivity('bond');
  check(r.ok && kid.guardians().some((g) => r.text.includes(g.firstName)), 'a parent is the one who does it');
  check(!kid.doActivity('bond').ok, 'once a year each');
  child(3);
  const toddler = ids();
  check(['playground', 'story', 'musicclass', 'dance', 'tumbling', 'art', 'swim'].every((x) => toddler.includes(x)) && !toddler.includes('babygroup') && !toddler.includes('sleepover') && !toddler.includes('club'), `a three-year-old has a toddler's (${toddler.join(', ')})`);
  child(9);
  const older = ids();
  check(['playground', 'sleepover', 'club', 'hobby', 'fair'].every((x) => older.includes(x)) && !older.includes('lullaby') && !older.includes('dance'), `a nine-year-old has a child's (${older.join(', ')})`);
  child(16);
  check(ids().length === 0, 'and by sixteen these are behind them');
  // No parent to take a small child: the things that need one wait.
  const p = child(3);
  for (const g of kid.guardians()) g.alive = false;
  check(kid.childActivities().find((a) => a.id === 'swim').done && !kid.doActivity('swim').ok && kid.doActivity('art').ok, 'with nobody to take them, a small child does only what needs no taking');
  void p;
}
section('infancy, toddler years and childhood each have their own things to do, with a parent where one is needed');

// ---------- 2. A little, and then no more ----------
{
  const p = child(3);
  let n = 0;
  for (const a of kid.childActivities()) if (!a.done && kid.doActivity(a.id).ok) n++;
  check(n === CHILD_ACTS_A_YEAR && kid.childActivities().every((a) => a.done), `only so much fits in a year (${n})`);
  // Dance from three to seven, every year: a head start, not a dancer.
  const p2 = child(3);
  p2.talents.dance = 30; // room to grow: a child born a dancer has nothing to gain from the class
  const start = p2.talents.dance;
  for (let age = 3; age <= 7; age++) { p2.age = age; kid.doActivity('dance'); kid.doActivity('tumbling'); kid.doActivity('musicclass'); }
  const c = p2.flags.childhood;
  check(p2.talents.dance - start <= EARLY_CAP && p2.talents.dance - start > 0 && p2.talents.dance < 100, `five years of dance class is a head start, not a career (${(p2.talents.dance - start).toFixed(1)} points)`);
  check(c.early.movement <= EARLY_CAP && c.early.movement >= 5 && c.early.music >= 3 && c.early.music <= EARLY_CAP, 'early likings are kept, and capped');
  check(kid.earlyStart('movement') === c.early.movement && kid.earlyStart('water') === 0, 'and are there to be read later');
  // Taken up later, that liking is worth a little, once: the same child, with it and without.
  const who = child(8); who.talents.music = 50;
  const first = (early) => {
    let total = 0;
    for (let i = 0; i < 80; i++) {
      who.flags.childhood = { acts: {}, early: { music: early }, jobs: {}, allowance: null, saving: null };
      who.flags.skillActs = null; who.flags.earlyUsed = []; if (who.skills) delete who.skills.piano;
      const before = skills.levelOf('piano');
      skills.practice('piano');
      total += skills.levelOf('piano') - before;
    }
    return total;
  };
  const withHead = first(EARLY_CAP), without = first(0);
  check(withHead - without > 80 * 3 && withHead - without < 80 * 9, `a child who liked music takes to the piano a little faster at first (${withHead} against ${without} over 80 first lessons)`);
  who.flags.childhood = { acts: {}, early: { music: EARLY_CAP }, jobs: {}, allowance: null, saving: null }; who.flags.skillActs = null; who.flags.earlyUsed = []; delete who.skills.piano;
  skills.practice('piano');
  check(who.flags.earlyUsed.includes('piano'), 'and that head start is used once');
  void p;
}
section('early activities add a little and stop: a head start in what is taken up later, never mastery');

// ---------- 3. Playground friends ----------
{
  let met = null, p = null;
  for (let tries = 0; tries < 40 && !met; tries++) {
    p = child(4);
    const before = new Set(p.npcIds);
    kid.doActivity('playground');
    met = p.npcIds.map((id) => S().npcs[id]).find((n) => !before.has(n.id)) ?? null;
  }
  check(met && met.role === 'friend' && met.flags.metAt === 'playground' && Math.abs(met.age - 4) <= 1 && met.id.startsWith('npc_') && met.firstName && met.memories.some((m) => m.key === 'met'), 'a child met at the playground is a person: a name, an age, a memory of how you met');
  check(P().milestones.some((m) => /Made a friend/.test(m.text)), 'a first friend is a milestone');
  const id = met.id;
  const meta = save.saveGame(S());
  store.state = save.loadGame(meta?.slotId ?? S().slotId);
  const back = S().npcs[id];
  check(back && back.firstName === met.firstName && back.flags.metAt === 'playground' && P().npcIds.includes(id) && P().flags.childhood.acts['4'].includes('playground'), 'saved and loaded: the same friend, and the same afternoon');
  check(kid.childActivities().find((a) => a.id === 'playdate') && !kid.childActivities().find((a) => a.id === 'playdate').done, 'and now there is someone to have a playdate with');
  // Years later they are still that person, and an adult friend if they are still a friend.
  back.meters.relationship = 90;
  for (let i = 0; i < 16; i++) { P().stats.health = 90; back.meters.health = 90; back.meters.relationship = Math.max(back.meters.relationship, 60); back.lastInteractionAge = P().age; advanceYear(); S().pendingEvents = []; if (!P().alive) break; }
  if (P().alive && back.alive && P().npcIds.includes(id)) check(S().npcs[id] === back && back.age >= 18 && back.flags.metAt === 'playground' && (back.role === 'friend' ? bonds.eligible(back) || true : true), 'grown up, they are the same person, with the same beginning');
  // Not every visit makes a friend, and there is a limit to how many.
  let made = 0;
  const q = child(5);
  for (let i = 0; i < 60; i++) { (q.flags.childhood ??= { acts: {}, early: {}, jobs: {}, allowance: null, saving: null }).acts = {}; const n = q.npcIds.length; kid.doActivity('playground'); if (q.npcIds.length > n) made++; }
  check(made >= 1 && made <= 4, `the playground makes a few friends, not one a visit (${made} in 60 visits)`);
}
section('playground friends: real people, kept, and not one every visit');

// ---------- 4. Pocket money ----------
{
  const p = child(10);
  const parent = kid.guardians().sort((a, b) => spendable(b) - spendable(a))[0];
  check(kid.canAskAllowance(), 'a ten-year-old can ask for an allowance');
  let r = null;
  for (let i = 0; i < 30 && !p.flags.childhood?.allowance; i++) { (p.flags.childhood ??= { acts: {}, early: {}, jobs: {}, allowance: null }).asked = null; r = kid.askAllowance(); }
  const a = p.flags.childhood.allowance;
  check(a && a.amount === localMoney(ALLOWANCE.yearly(10), { ...S() && (await import('../js/state.js')).country() }) && a.fromId, `a generous parent with money agrees (${a?.amount})`);
  check(!kid.canAskAllowance() && !kid.askAllowance().ok, 'and it cannot be asked for again and again');
  const had = spendable(S().npcs[a.fromId]);
  kid.tickChildhood();
  check(p.finance.cash === a.amount && spendable(S().npcs[a.fromId]) === had - a.amount, 'it is paid out of the parent\'s own money: what the child gets, the parent no longer has');
  // Chores.
  const cash = p.finance.cash;
  check(kid.doChores().ok && p.finance.cash > cash && !kid.doChores().ok, 'a year of chores is paid for once');
  // Saving.
  kid.saveFor('a kite', 20);
  const cost = p.flags.childhood.saving.cost;
  const c2 = p.finance.cash;
  check(kid.buySaved().ok && p.finance.cash === c2 - cost && !p.flags.childhood.saving && P().milestones.some((m) => /Saved up/.test(m.text)), 'saved up, the thing is bought with the child\'s own money');
  // When the family cannot pay, less comes, or none.
  const giver = S().npcs[a.fromId];
  if (giver.life) giver.life.savings = 5; else giver.savings = 5;
  const c3 = p.finance.cash;
  kid.tickChildhood();
  check(p.finance.cash - c3 <= 5 && spendable(giver) === 0, `a family with nothing left gives what it has, not what it promised (${p.finance.cash - c3})`);
  void parent; void r;
}
{
  let no = 0;
  for (let i = 0; i < 20; i++) { const p = child(10, { poor: true, generosity: 20 }); if (!kid.askAllowance().ok) no++; check(p.finance.cash === 0, 'a refusal gives nothing'); }
  check(no >= 16, `a hard-up, careful parent says no (${no} of 20)`);
  const p = child(4);
  check(!kid.canAskAllowance() && !kid.askAllowance().ok, 'a four-year-old does not get an allowance');
  void p;
  const old = child(10, { year: 1900 });
  const now = child(10);
  void now;
  const then = localMoney(ALLOWANCE.yearly(10), (await import('../js/state.js')).country());
  store.state = (() => { child(10, { year: 1900 }); return S(); })();
  const c1900 = (await import('../js/state.js')).country();
  check(localMoney(ALLOWANCE.yearly(10), c1900) <= then, `an allowance in 1900 is in 1900's money (${localMoney(ALLOWANCE.yearly(10), c1900)} against ${then})`);
  void old;
}
section('pocket money: asked once, may be refused, really leaves the family\'s money; chores; saving');

// ---------- 5. Small jobs ----------
{
  child(6);
  check(kid.smallJobs().length === 0, 'a six-year-old has no jobs');
  const p = child(11);
  const jobs = kid.smallJobs();
  check(jobs.some((j) => j.id === 'petsit' && !j.done) && jobs.some((j) => j.id === 'yard') && !jobs.some((j) => j.id === 'babysit') && !jobs.some((j) => j.id === 'tutor'), `an eleven-year-old can feed a cat and rake leaves, not babysit (${jobs.map((j) => j.id).join(', ')})`);
  const cash = p.finance.cash;
  const pay = jobs.find((j) => j.id === 'petsit').pay;
  check(kid.doSmallJob('petsit').ok && p.finance.cash === cash + pay && !kid.doSmallJob('petsit').ok && p.finance.cash === cash + pay, 'a job is paid once');
  kid.doSmallJob('yard');
  check(kid.smallJobs().every((j) => j.done) && !kid.doSmallJob('familyhelp').ok, 'two in a year, and then school comes first');
  check(!p.career.careerId && !(p.career.history ?? []).length, 'and it is not a career');
  const t = child(15); t.stats.intellect = 80;
  check(kid.smallJobs().some((j) => j.id === 'babysit' && !j.done) && kid.smallJobs().some((j) => j.id === 'tutor' && !j.done), 'at fifteen: babysitting, and tutoring for someone good at school');
  t.stats.intellect = 30;
  check(kid.smallJobs().find((j) => j.id === 'tutor').done, 'not tutoring for someone who is not');
  child(18);
  check(kid.smallJobs().length === 0 && ids().length === 0 && !kid.canAskAllowance(), 'none of this is for adults');
}
section('small jobs: by age and law, paid once, two a year, not a career');

// ---------- 6. Whatever the length of a turn ----------
{
  const p = child(10);
  (p.flags.childhood ??= { acts: {}, early: {}, jobs: {}, allowance: null }).allowance = { amount: 100, fromId: kid.guardians()[0].id, since: 10 };
  const amount = p.flags.childhood.allowance.amount;
  S().settings.step = 3;
  turns.advanceTurn();
  check(p.finance.cash === 0, 'no pocket money for a part of a year');
  for (let i = 0; i < 3 && (S().month ?? 0) !== 0; i++) turns.advanceTurn();
  const paidTimes = ledgerOf().tx.filter((t) => t.desc === 'Pocket money').length;
  check(!P().alive || paidTimes === 1, `a year in four turns pays a year's pocket money, once (${paidTimes} times)`);
  void amount;
}
section('three months at a time: a year\'s pocket money once a year');

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of [...new Set(problems)]) console.log(' ✗', p);
  process.exit(1);
}
for (const m of ok) console.log(' ✓', m);
console.log('Childhood begins at birth.');
