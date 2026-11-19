// Trades in the leagues with a draft (engine/trades.js), and Puerto Rico's players in the big leagues' draft.
// Run with: node tests/trades.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { SPORTS } = await import('../js/data/sports.js');
const { ROOTS } = await import('../js/data/economy.js');
const sl = await import('../js/engine/sportsLife.js');
const sp = await import('../js/engine/sports.js');
const dr = await import('../js/engine/draft.js');
const tr = await import('../js/engine/trades.js');
const intl = await import('../js/engine/international.js');
ROOTS.familyLeaves = 0; // these lives stay where they began

const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;
const raise = (e, to) => { for (const k of Object.keys(e.skills)) { e.ceiling[k] = Math.max(e.ceiling[k], to); e.skills[k] = Math.max(e.skills[k], to); } };
const contract = (e) => S().sports.contracts[e.contractId];

/** A boy in `country`, grown to `age`, playing `sport`; begun again if the life ends first (rarely, a child dies). */
function boy(country, sport, age) {
  for (;;) {
    let s; do { s = createLife({ countryId: country, gender: 'male' }); } while (s.player.royal);
    store.state = s;
    s.player.talents.sports = 92; s.player.stats.intellect = 60;
    for (let i = 0; i < 7; i++) { s.player.stats.health = 95; advanceYear(); s.pendingEvents = []; }
    sp.takeUp(sport);
    const e = sp.entryOf(sport);
    if (!e) continue;
    e.plan = { type: 'balanced', hours: 12 };
    for (let i = 0; i < 30 && s.player.alive && s.player.age < age; i++) year({});
    if (s.player.alive && s.player.countryId === country && sp.divOf(s.player) === 'men') return e; // these are the men's leagues' rules
  }
}
function year(pick = {}) {
  const p = P(); p.stats.health = 95; p.legal.pending = null; p.legal.incarceration = null;
  for (const x of sp.myAthlete().injuries) x.status = 'healed';
  advanceYear(); S().pendingEvents = [];
  const seen = [];
  for (let round = 0; round < 3; round++) for (const d of sl.openDecisions()) {
    seen.push(d);
    const c = typeof pick[d.kind] === 'function' ? pick[d.kind](d) : pick[d.kind] ?? (d.kind === 'renew' ? 'yes' : d.options.some((o) => o.id === 'no') ? 'no' : d.options.at(-1).id);
    if (c != null) sl.answer(d.id, c);
  }
  return seen;
}
/** A drafted, signed professional in `country`. */
function pro(country, to = 66) {
  for (let tries = 0; tries < 6; tries++) {
    const e = boy(country, 'baseball', 15);
    raise(e, to);
    Object.assign(P().education, { enrolled: true, stage: 'high', expelled: false, droppedOut: false });
    for (let i = 0; i < 5 && !e.contractId; i++) year({ declare: 'yes', draftSign: 'sign', academy: 'no', commit: 'wait', sign: 'no' });
    if (e.contractId) return e;
  }
  return null;
}

// ---------- 1. Puerto Rico ----------
{
  check(sp.proPath(SPORTS.baseball, 'pr') === 'draft' && sp.proPath(SPORTS.baseball, 'do') !== 'draft', 'Puerto Rico\'s players are drafted; the Dominican Republic\'s are signed');
  const e = pro('pr');
  check(e, 'a Puerto Rican high school player is drafted and signs');
  if (e) {
    check(!intl.intlPath(S(), 'baseball') && !e.intl, 'not as an international amateur');
    const d = Object.values(S().sports.drafts).find((x) => x.sport === 'baseball' && x.player?.teamId);
    const club = sp.orgOf(contract(e).orgId);
    check(d?.size === 30 && d.rounds === 20 && club.countryId === 'us', `into the big leagues\' own draft: 30 clubs, 20 rounds, a club in the United States (${d?.size}, ${d?.rounds}, ${club.countryId})`);
    check(dr.draftBoard(S(), d, 1).length >= 30, 'and the draft board is the same one');
  }
}
section('Puerto Rico: in the big leagues\' draft');

// ---------- 2. Trades ----------
for (const country of ['us', 'jp']) {
  // A trade is a matter of luck in any one career (contracts end, careers end): several careers, until one is traded.
  let e = null;
  let traded = null;
  let transfers = 0;
  for (let life = 0; life < 12 && !traded; life++) {
    e = pro(country, country === 'us' ? 80 : 70);
    if (!e) continue;
    for (let i = 0; i < 14 && !traded && P().alive && e.contractId; i++) {
      const k = contract(e);
      const before = { id: k.id, org: k.orgId, salary: k.salary, to: k.to, minor: e.minor ? { ...e.minor } : null };
      raise(e, 70);
      transfers += year({ posting: 'no', transfer: 'yes', mlbOffer: 'no', trade: 'yes' }).filter((d) => d.kind === 'transfer').length;
      if (e.trades?.length) traded = { before, t: e.trades[0] };
    }
  }
  check(e, `${country}: a professional to trade`);
  if (!e) continue;
  check(transfers === 0, `${country}: no club buys a player for a fee in a draft league`);
  check(traded, `${country}: sooner or later a player is traded`);
  if (traded) {
    // The trade as the contracts record it (the rest of that year may have brought a promotion, or worse).
    const { before, t } = traded;
    const all = Object.values(S().sports.contracts);
    const old = all.find((x) => x.id === before.id);
    const k = all.find((x) => x.how === 'trade' && x.from === t.year);
    check(k && k.orgId !== before.org && k.name === t.to, `${country}: the player goes to the new club`);
    check(k && k.salary === before.salary && k.to === Math.max(before.to, t.year + 1), `${country}: on the same pay, for the same years (${before.salary}/${before.to} → ${k?.salary}/${k?.to})`);
    check(old.status === 'ended' && /traded/.test(old.why), `${country}: the old contract ends as a trade (${old.why})`);
    check(!before.minor || !e.minor || e.contractId !== k?.id || e.minor.clubId === k.orgId, `${country}: a minor leaguer goes to the new club's system`);
    check(k && sp.orgOf(k.orgId).countryId === country && (e.contractId !== k.id || P().career.sportContract === k.id), `${country}: and is employed there`);
  }
}
{
  // Ten and five: a veteran may refuse.
  const e = pro('us', 82);
  if (e) {
    const k = contract(e);
    e.minor = null;
    check(!tr.canVeto(S(), e, k), 'a young player cannot refuse a trade');
    e.proYear = S().year - 11; k.from = S().year - 6;
    check(tr.canVeto(S(), e, k), 'ten years in the game and five with the club: he can');
    check(!tr.canVeto(S(), { ...e, id: 'ice_hockey' }, k), 'only in baseball');
  }
  check(e, 'a veteran to test');
}
section('trades: the contract moves as it stands, minor leaguers to the same level, no fees, ten-and-five');

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(' ✗', p);
  process.exit(1);
}
for (const m of ok) console.log(' ✓', m);
console.log('Trades and Puerto Rico hold together.');
