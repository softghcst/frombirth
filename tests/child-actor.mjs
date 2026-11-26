// Child and teen acting: casting looks for a gift, and a gift comes on faster on set; at 13 the parts become a
// teenager's; the pay is modest and a parent manages it until 18, with the US trust share set aside by law; at 18 the
// money is handed over, and money a parent spent can be argued over. Run with: node tests/child-actor.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { CAREER_BY_ID } = await import('../js/data/careers.js');
const career = await import('../js/engine/career.js');
const { tickFinance } = await import('../js/engine/finance.js');
const CE = await import('../js/engine/childEarnings.js');
const { workChoice } = await import('../js/engine/workEvents.js');
const { EVENT_BY_ID } = await import('../js/data/events/index.js');

rng.seed(20261126);
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); else console.log(`ok   ${m}`); };
const CA = CAREER_BY_ID.child_actor;

/** A child at home with a parent, with an acting gift (potential) and how good they are now (talent). */
function kid(countryId = 'us', age = 8, giftLevel = 80, now = 45) {
  do { store.state = createLife({ countryId }); } while (store.state.player.royal || !store.state.player.npcIds.some((id) => store.state.npcs[id]?.role === 'parent' && store.state.npcs[id].alive));
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age; p.flags.livesWithParents = true;
  for (const id of p.npcIds) { const n = store.state.npcs[id]; if (n?.role === 'parent') { n.alive = true; n.flags.abroad = false; } }
  p.potential.acting = giftLevel; p.talents.acting = now;
  p.finance.cash = 0;
  return p;
}

// ---- Who gets cast ----
{
  const rate = (g) => {
    let wins = 0;
    for (let i = 0; i < 300; i++) {
      const p = kid('us', 9, g, Math.round(g * 0.31) + 2); // where a 9-year-old with this gift would be, no lessons
      const r = career.finishApplication('child_actor', [0]);
      if (r.ok && p.career.careerId === 'child_actor') wins += 1;
    }
    return wins / 300;
  };
  const gifted = rate(90);
  const plain = rate(35);
  check(gifted > plain + 0.3, `casting calls back a gifted child far more often (${Math.round(gifted * 100)}% against ${Math.round(plain * 100)}%)`);
  check(plain < 0.25, 'a child with no gift for it is rarely cast');
  kid('us', 6, 85, 21);
  check(career.unmet(CA).length === 0, 'a gifted six-year-old is measured against other six-year-olds, not teenagers');
}
{
  const p = kid();
  for (const id of p.npcIds) { const n = store.state.npcs[id]; if (n?.role === 'parent') n.alive = false; }
  const gp = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.role === 'grandparent' && n.alive);
  if (gp.length) {
    check(!career.unmet(CA).some((x) => /guardian/.test(x)) && CE.managerOf(p)?.role === 'grandparent', 'with no parent, a grandparent can sign for a child');
    check(/^your grand/.test(CE.keeperWord(CE.managerOf(p))), 'and is called a grandparent');
  }
  for (const n of gp) n.alive = false;
  check(career.unmet(CA).some((x) => /guardian/.test(x)), 'a child with nobody to look after them cannot sign up');
}

// ---- A gift comes on faster ----
{
  const grow = (g) => {
    const p = kid('gb', 9, g, 40);
    career.hire(CA, 0, 55, 'cast');
    p.childPay = { managerId: null, style: 'saver', trust: 0, kept: 0, spent: 0, coached: 0, total: 0, released: false };
    const before = p.talents.acting;
    for (let y = 0; y < 3; y++) { p.age += 1; career.tickCareer(); }
    return p.talents.acting - before;
  };
  const fast = grow(95);
  const slow = grow(40);
  check(fast >= slow + 5, `on set, a gift comes on faster (+${fast} against +${slow} in three years)`);
}

// ---- A child can move up: the steps are measured against children of their age too ----
{
  const p = kid('us', 10, 85, 34);
  career.hire(CA, 0, 70, 'cast');
  check(career.nextStep().missing.length === 0, 'a gifted ten-year-old extra can be promoted to bit parts (not asked for an adult\'s acting)');
  let lvl = 0;
  for (let y = 0; y < 6; y++) { p.age += 1; p.career.performance = 75; career.tickCareer(); lvl = p.career.level; }
  check(lvl >= 2, `a gifted child who works well moves up in a few years (level ${lvl} by 16)`);
}

// ---- Teenage parts ----
{
  const p = kid('us', 12, 80, 62);
  career.hire(CA, 2, 60, 'cast');
  check(p.career.title === 'Child actor', 'a 12-year-old is a child actor');
  p.age = 13;
  career.tickCareer();
  check(p.career.title === 'Teen actor', 'at 13 the parts are a teenager\'s: Teen actor');
  check(career.localTitle(CA, 3) === 'Teen star' && CA.name === 'Child and teen acting', 'a teenager is hired as a teen, and the field says so');
}

// ---- Pay: modest, and managed ----
{
  const top = CA.levels[3].pay[1];
  check(top <= 300 && CA.levels[0].pay[1] <= 3, 'a child extra earns pocket money; even a child star earns a fraction of a film star');
  const p = kid('us', 10, 80, 60);
  career.hire(CA, 2, 60, 'cast');
  p.career.salary = 40000;
  tickFinance();
  const cp = p.childPay;
  check(cp && cp.total > 0 && Math.abs(cp.trust - Math.round(cp.total * 0.15)) <= 1, 'in the US, 15% of a child\'s pay goes into a trust nobody can touch');
  check(p.finance.cash <= cp.total * 0.06 + 1, 'the child gets pocket money; the parent manages the rest');
  check(!!store.state.npcs[cp.managerId] && CE.STYLES[cp.style], 'a parent manages the money, in their own way');

  // At 18 it is handed over: the trust and what was kept.
  cp.style = 'spender'; cp.kept = 1000; cp.spent = cp.total - cp.trust - 1000 - Math.round(cp.total * 0.05);
  career.quitCareer?.();
  p.age = 18;
  p.finance.cash = 0;
  const handed = CE.releaseChildPay(p);
  check(handed === cp.trust + 1000 && p.finance.cash >= handed, 'at 18 the trust and what the parent kept are handed over');
  check(p.flags.childMoneyGone === 'parent' && EVENT_BY_ID.child_money_parent && store.state.npcs[cp.managerId].flags.managesChildPay, 'money a parent spent leaves a conversation to be had, with the one who spent it');
  const parent = store.state.npcs[cp.managerId];
  if (parent.life) parent.life.savings = 50000; else parent.savings = 50000;
  const before = p.finance.cash;
  const said = workChoice('childMoney:sue');
  check(p.finance.cash > before && /court/.test(said), 'taking a parent to court can get some of it back');
  check(CE.releaseChildPay(p) === null, 'it is handed over once');
}

// ---- Elsewhere, no trust by law ----
{
  const p = kid('gb', 10, 80, 60);
  career.hire(CA, 2, 60, 'cast');
  p.career.salary = 30000;
  tickFinance();
  check(p.childPay.trust === 0 && p.childPay.total > 0, 'outside the US no share is set aside by law: it is up to the parent');
}

// ---- A parent's nature, as their profile shows it, leans how they handle the money ----
{
  const w1 = CE.styleWeights({ traits: ['gentle'], meters: { generosity: 90, money: 70 } });
  const w2 = CE.styleWeights({ traits: ['sly'], meters: { generosity: 10, money: 20 } });
  const share = (w, k) => w[k] / Object.values(w).reduce((a, b) => a + b, 0);
  check(share(w1, 'saver') > 0.6 && share(w2, 'spender') > 0.4 && share(w2, 'household') > share(w1, 'household'),
    'a generous, gentle parent usually saves it; a sly, tight-fisted one usually spends it; a hard-up family needs more of it');
}

// ---- A coaching parent ----
{
  const p = kid('us', 10, 70, 50);
  career.hire(CA, 1, 60, 'cast');
  p.childPay = { managerId: 'x', style: 'coach', trust: 0, kept: 0, spent: 0, coached: 0, total: 0, released: false };
  const before = p.talents.acting;
  CE.coachingYear(p);
  check(p.talents.acting === before + 2, 'a parent who pays for coaching brings a child\'s acting on');
}

if (problems.length) { for (const m of problems) console.log(`FAIL ${m}`); process.exit(1); }
console.log('Child acting checks out.');
