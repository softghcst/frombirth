// Baseball in detail (engine/baseball.js, engine/baseballContracts.js): season lines and career totals, roles and
// two-way players, milestones, the All-Star Game, the postseason by name, the pitcher's elbow and innings limits, free
// agency (bids, the qualifying offer, opt-outs, no-trade clauses), extensions, options and waivers, Rule 5, independent
// ball and clubs abroad, winter ball, the Classic, summer leagues and advisers, life abroad, and the Hall of Fame.
// Run with: node tests/baseball.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { BASEBALL, INJURIES, DRAFTS, INTL_SIGNING } = await import('../js/data/sports.js');
const { ILLNESSES } = await import('../js/data/health/ailments.js');
const { ROOTS } = await import('../js/data/economy.js');
const sl = await import('../js/engine/sportsLife.js');
const nations = await import('../js/engine/nations.js');
const sp = await import('../js/engine/sports.js');
const dr = await import('../js/engine/draft.js');
const tr = await import('../js/engine/trades.js');
const bb = await import('../js/engine/baseball.js');
const bc = await import('../js/engine/baseballContracts.js');
ROOTS.familyLeaves = 0; // these lives stay where they began

const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;
const set = (e, to) => { for (const k of Object.keys(e.skills)) { e.ceiling[k] = to; e.skills[k] = to; } };
/** Sets every skill alike so that the player's overall rating (skills and the body behind them) is `target`. */
const aim = (e, target) => { for (let v = 99; v >= 1; v--) { set(e, v); if (sp.internals.overall(e, P()) <= target) return; } };
const contract = (e) => S().sports.contracts[e.contractId];
const club = (e) => sp.orgOf(contract(e)?.orgId);
const money = (v) => sl.internals.money(S(), v);
const paid = (prefix) => Object.entries(S().sports.paid).filter(([k]) => k.startsWith(prefix)).map(([, v]) => v.amount);

/** A boy in `country`, grown to `age`, playing baseball at `pos`; begun again if the life ends first or is not a men's-league one. */
function boy(country, age, pos = 'outfield') {
  for (;;) {
    let s; do { s = createLife({ countryId: country, gender: 'male' }); } while (s.player.royal);
    store.state = s;
    s.player.talents.sports = 92; s.player.stats.intellect = 60;
    for (let i = 0; i < 7; i++) { s.player.stats.health = 95; advanceYear(); s.pendingEvents = []; }
    sp.takeUp('baseball');
    const e = sp.entryOf('baseball');
    if (!e) continue;
    e.position = pos; e.plan = { type: 'balanced', hours: 12 };
    for (let i = 0; i < 30 && s.player.alive && s.player.age < age; i++) year({});
    if (s.player.alive && s.player.countryId === country && sp.divOf(s.player) === 'men') return e; // these are the men's leagues' rules
  }
}
/** One year, healthy and free; decisions answered as `pick` says, or the cautious default. */
function year(pick = {}) {
  const p = P(); p.stats.health = 95; p.legal.pending = null; p.legal.incarceration = null;
  const a = sp.myAthlete();
  for (const x of a?.injuries ?? []) if (x.status === 'out') { x.status = 'healed'; x.healed = S().year; }
  advanceYear(); S().pendingEvents = [];
  const seen = [];
  for (let round = 0; round < 3; round++) for (const d of sl.openDecisions()) {
    seen.push(d);
    // `null` leaves a decision open, for the check to answer itself.
    const c = typeof pick[d.kind] === 'function' ? pick[d.kind](d) : d.kind in pick ? pick[d.kind] : d.kind === 'renew' ? 'yes' : d.options.some((o) => o.id === 'no') ? 'no' : d.options.at(-1).id;
    if (c != null) sl.answer(d.id, c);
  }
  return seen;
}
/** A big leaguer in the United States, of skill `to` (the same in every skill), at `pos`. */
function bigLeaguer(to = 86, pos = 'outfield') {
  for (;;) {
    const e = boy('us', 15, pos);
    set(e, Math.max(to, 78));
    Object.assign(P().education, { enrolled: true, stage: 'high', expelled: false, droppedOut: false });
    for (let i = 0; i < 5 && !e.contractId; i++) year({ draftSign: 'sign', academy: 'no', commit: 'wait', sign: 'no', adviser: 'no' });
    if (!e.contractId) continue;
    e.minor = null; sp.internals.joinOrg(club(e), S());
    set(e, to);
    return e;
  }
}
/** The year his contract runs out and the club offers to renew (a trade that year would put it off: then the next). */
function renewal(e) {
  for (let i = 0; i < 8 && e.contractId; i++) {
    contract(e).to = S().year + 1;
    const d = year({ renew: null, twoWay: 'no', trade: 'no', extension: 'no' }).find((x) => x.kind === 'renew' && x.contractId === e.contractId);
    if (d) return d;
  }
  return null;
}
/** A big leaguer of `age` in the year his club offers to renew: another life if this one's career goes wrong first. */
function upForRenewal(to, pos, age) {
  for (let tries = 0; tries < 8; tries++) {
    const e = bigLeaguer(to, pos);
    P().age = age;
    const renew = renewal(e);
    if (renew && e.contractId) return { e, renew };
  }
  return { e: bigLeaguer(to, pos), renew: null };
}
// A life can go wrong in ways these checks are not about (a ban, a sacking, a year lost to injury). A scenario says
// what it needs with need(); when a life does not provide it, the scenario is begun again with another life. The
// checks themselves are never retried: one that fails in a life that got that far is a failure.
const RETRY = Symbol('retry');
const need = (cond) => { if (!cond) throw RETRY; };
function scenario(name, fn) {
  for (let tries = 0; tries < 10; tries++) {
    const mark = problems.length;
    try { fn(); return; } catch (err) { if (err !== RETRY) throw err; problems.length = mark; }
  }
  problems.push(`${name}: no life got far enough to check`);
}
/** A season in the big leagues, played: the line for it. */
function season(e, pick = {}) {
  need(e.contractId);
  year({ twoWay: 'no', trade: 'no', extension: 'no', ...pick });
  const x = lineOf(e);
  need(e.contractId && x?.top);
  return x;
}
const lineOf = (e) => e.bb.lines.filter((x) => x.year === S().year).at(-1);

// ---------- 1. The season's line, roles, totals, the All-Star Game, October ----------
scenario('a hitter\'s season', () => {
  const e = bigLeaguer(86, 'outfield');
  const x = season(e);
  check(x.level === 'MLB' && x.G > 0 && x.G <= 162, `a big league season is scaled to 162 games (${x.level}, ${x.G})`);
  check(x.AB === Math.round(x.G * 3.8) && x.H <= x.AB && x.HR <= x.H && x.AVG >= 0.24 && x.AVG <= 0.36, `a hitter's line is a hitter's line (${bb.lineText(x)})`);
  check(/home run/.test(bb.lineText(x)) && /RBI/.test(bb.lineText(x)), 'and reads as one');
  const C = e.bb.career;
  check(C.H === x.H && C.HR === x.HR && C.seasons === 1, 'big league seasons add up to career totals');
  check(e.bb.allStar.includes(S().year), 'one of the best players in the league is an All-Star');
  const played = S().sports.seasons[x.seasonId];
  check(played.playoffs.length && played.playoffs.every((f) => Object.values(BASEBALL.rounds.MLB).includes(f.label)) && played.finalName === 'Championship Series', 'the postseason is played by its own names, down to the World Series');
  // Twelve clubs: the best four rest while the other eight play the wild card round.
  const seeds = sp.standings(played).map((t) => t.teamId);
  const wild = played.playoffs.filter((f) => f.round === 'Wild Card');
  const inIt = new Set(played.playoffs.flatMap((f) => [f.home, f.away]));
  check(wild.length === 4 && wild.every((f) => f.label === 'Wild Card Series') && inIt.size === 12 && seeds.slice(0, 12).every((t) => inIt.has(t)), `twelve clubs reach the postseason, and eight of them start in the Wild Card Series (${wild.length} series, ${inIt.size} clubs)`);
  check(wild.every((f) => !seeds.slice(0, 4).includes(f.home) && !seeds.slice(0, 4).includes(f.away)) && wild.every((f) => seeds.indexOf(f.home) < seeds.indexOf(f.away)), 'the best four rest through it, and the better seed is at home');
  const div = played.playoffs.filter((f) => f.round === 'Quarterfinal');
  check(div.length === 4 && div.every((f) => seeds.indexOf(f.home) < 4 && wild.some((w) => w.winner === f.away)) && played.playoffs.length === 11, 'each wild card winner then meets one of the four who waited');
});
scenario('a milestone', () => {
  const e = bigLeaguer(86, 'outfield');
  bb.record(e).career.H = 2999;
  const x = season(e);
  need(x.H > 0);
  check(e.bb.reached.H === 3000 && S().sports.moments.some((m) => /3,000 hits/.test(m.text)), 'career hit number 3,000 is marked');
});
scenario('a two-way player', () => {
  const e = bigLeaguer(86, 'outfield');
  bb.record(e).twoWay = true;
  const two = season(e);
  check(two.AB > 0 && two.IP > 0 && two.GS > 0, `a two-way player has a batting line and a pitching line (${bb.lineText(two)})`);
});
{
  const role = (stamina, stuff, level = 'MLB') => bb.roleFor({ position: 'pitcher', skills: { stamina, stuff } }, level);
  check(role(70, 70) === 'starter' && role(40, 60) === 'reliever' && role(40, 80) === 'closer' && bb.roleFor({ position: 'outfield', skills: {} }, 'MLB') === null, 'starters have the stamina; the best arm in the bullpen closes');
  check(INJURIES.ucl.pitcher && INJURIES.ucl.seasons >= 1 && ILLNESSES.some((i) => i.id === 'sport_ucl'), 'a torn elbow ligament is a pitcher\'s injury, and a year away');
}
scenario('a starter', () => {
  const e = bigLeaguer(84, 'pitcher');
  P().age = 21; // a young arm: the innings limit applies
  const x = season(e);
  check(e.bb.role === 'starter' && x.GS > 0 && x.W + x.L <= x.GS && x.ERA >= 1.5 && x.ERA <= 5.5 && x.K > 0, `a starter's line: starts, a record, an earned run average, strikeouts (${bb.lineText(x)})`);
  check(x.IP <= 110.01 && !!x.capped === (x.IP >= 110), `a young starter is shut down at his innings limit, if his season gets that far (${x.IP})`);
});
scenario('a closer', () => {
  const e = bigLeaguer(84, 'pitcher');
  e.skills.stamina = 30; e.ceiling.stamina = 30;
  const y = season(e);
  need(!sp.myAthlete().injuries.some((i) => i.year === S().year)); // a full season
  check(e.bb.role === 'closer' && y.GS === 0 && y.SV >= 10 && y.IP < 90 && Math.abs(y.IP - y.GP) < 0.01, `a closer's line: saves, an inning at a time (${bb.lineText(y)})`);
});
section('lines and totals, milestones, two-way players, roles, the innings limit, the All-Star Game, October');

// ---------- 2. Free agency, the qualifying offer, opt-outs, no-trade clauses, extensions ----------
{
  const { e, renew } = upForRenewal(86, 'outfield', 26);
  const q = bc.qualifying(S(), e, contract(e), club(e));
  check(q && q.amount === money(BASEBALL.qualifyingOffer) && q.option.id === 'qo', 'the best free agents are made the qualifying offer');
  const list = bc.bids(S(), e, 'us');
  check(list.length >= 2 && new Set(list.map((x) => x.orgId)).size === list.length, `several clubs bid for a star (${list.length})`);
  check(list.every((x) => x.years >= 5 && x.noTrade && x.optOut > S().year && !x.minorDeal), 'with long contracts, an opt-out and a no-trade clause');
  // The contract runs out: sign again, take the qualifying offer, or go to the market.
  const old = club(e);
  check(renew && renew.options.some((o) => o.id === 'qo') && /qualifying offer/.test(renew.text), 'the qualifying offer comes with the offer to stay');
  if (renew) {
    sl.answer(renew.id, 'no');
    const fa = sl.openDecisions().find((d) => d.kind === 'freeAgency');
    check(fa && fa.qo && fa.offers.every((x) => x.orgId !== old.id) && /draft pick/.test(fa.text), 'turning it down opens the market at once, and costs the old club nothing but a pick gained');
    if (fa) {
      const x = fa.offers[0];
      sl.answer(fa.id, x.orgId);
      const nk = contract(e);
      check(nk && nk.orgId === x.orgId && nk.salary === x.salary && nk.to - nk.from === x.years && nk.noTrade && nk.optOut === x.optOut, 'the contract signed is the one offered');
      check(tr.canVeto(S(), e, nk), 'a no-trade clause lets him refuse a trade');
      // Opting out.
      nk.optOut = S().year + 1;
      const out = year({ optOut: null, freeAgency: null, twoWay: 'no', trade: 'no', extension: 'no' }).find((d) => d.kind === 'optOut');
      // Only if the year left him where he was: still on that contract, still good enough to be asked.
      if (nk.status === 'active' && e.contractId === nk.id && P().alive && sp.internals.overall(e, P()) >= 80) {
        check(out, 'in the opt-out year he may leave the contract');
        if (out) { const res = sl.answer(out.id, 'yes'); check(nk.status === 'ended' && nk.why === 'opted out' && sl.openDecisions().some((d) => d.kind === 'freeAgency'), `opting out ends it and opens the market again (${res.text}; ${nk.status}, ${nk.why}; ${sl.openDecisions().map((d) => d.kind).join(',')}; age ${P().age})`); }
      }
    }
  }
}
{
  // Accepting the qualifying offer; an extension.
  const { e, renew } = upForRenewal(82, 'infield', 26);
  const k = contract(e);
  if (renew) sl.answer(renew.id, 'qo');
  check(renew && k.qo && k.salary === money(BASEBALL.qualifyingOffer) && k.to === S().year + 1 && P().career.salary === k.salary, 'accepting it is one more year at the qualifying offer');
  check(!bc.qualifying(S(), e, k, club(e)), 'and it is not offered twice');
  const d = sl.internals.decide(S(), { kind: 'extension', sportId: 'baseball', contractId: k.id, years: 8, salary: k.salary + 1000, key: 'test/extension', text: 'x', options: [{ id: 'yes', label: 'y' }, { id: 'no', label: 'n' }] });
  sl.answer(d.id, 'yes');
  check(k.to === S().year + 8 && k.salary === d.salary && k.extended === true && P().career.salary === d.salary, 'an extension lengthens the contract at the new pay');
}
section('free agency: bids, the qualifying offer, opt-outs, no-trade clauses; extensions');

// ---------- 3. Options and waivers; Rule 5 ----------
{
  const e = bigLeaguer(66, 'infield');
  const a = sp.myAthlete();
  P().age = 25;
  aim(e, 64);
  e.lastRating = 20;
  const first = contract(e);
  first.from = S().year - 2; first.to = S().year + 9;
  const top = DRAFTS.baseball.minors.length - 1;
  for (let i = 0; i < 3; i++) {
    e.minor = null;
    bc.contractHook(S(), a, e, contract(e));
    check(e.minor?.level === top && e.bb.options.length === i + 1, `sent down to Triple-A on option year ${i + 1}`);
    S().year += 1;
  }
  e.minor = null;
  const before = contract(e).id;
  const moved = bc.contractHook(S(), a, e, contract(e));
  const out = sl.openDecisions().find((d) => d.kind === 'outright');
  check(e.bb.options.length === 3 && e.bb.dfa?.length === 1 && (moved ? contract(e).id !== before : !!out), 'out of options: designated for assignment, then claimed on waivers or outrighted');
  if (out) {
    const pay = contract(e).salary;
    sl.answer(out.id, 'yes');
    check(e.minor?.level === top && P().career.salary === pay && e.bb.fortyMan === false, 'an outright assignment keeps the contract\'s pay, off the 40-man roster');
  }
}
{
  const e = bigLeaguer(65, 'infield');
  const a = sp.myAthlete();
  P().age = 22;
  const k = contract(e);
  k.from = S().year - 1; k.to = S().year + 30;
  e.proYear = S().year - 5;
  e.bb.fortyMan = false;
  dr.toMinors(S(), e, club(e), 2);
  aim(e, 66);
  bc.contractHook(S(), a, e, k);
  check(e.bb.fortyMan === true, 'after five seasons a prospect worth keeping is put on the 40-man roster');
  // One not protected can be taken, must stay up all season, and is offered back if he cannot.
  aim(e, 60); e.bb.fortyMan = false;
  const home = club(e);
  let taken = false;
  for (let i = 0; i < 60 && !taken; i++) { S().year += 1; contract(e).to = S().year + 30; taken = bc.contractHook(S(), a, e, contract(e)); }
  check(taken && e.bb.rule5?.fromId === home.id && !e.minor && club(e).id !== home.id && e.bb.exposed.length >= 1, 'left unprotected, he is taken by another club in the Rule 5 draft, onto its big league roster');
  check(taken && P().career.salary >= money(BASEBALL.minimum), 'and paid as a big leaguer');
  if (taken) {
    S().year += 1;
    const back = bc.contractHook(S(), a, e, contract(e));
    check(back && club(e).id === home.id && e.minor && !e.bb.rule5, 'not good enough to stay all season: offered back to his old club, and its minor leagues');
  }
}
section('the 40-man roster: three option years, waivers, outright assignments, the Rule 5 draft');

// ---------- 4. Released: independent ball, Japan and Korea; winter ball; the Classic ----------
{
  const e = bigLeaguer(58, 'infield');
  const a = sp.myAthlete();
  P().age = 28;
  aim(e, 56);
  sl.internals.endContract(S(), contract(e), 'released');
  check(bc.freeAgentYear(S(), a, e), 'a released player still has baseball to turn to');
  const d = sl.openDecisions().find((x) => x.kind === 'secondChance');
  check(d && d.options.some((o) => o.id === 'indy'), 'no organization calls a player this far down: there is independent ball');
  if (d) {
    sl.answer(d.id, 'indy');
    check(club(e)?.minorLevel === 'Independent League' && contract(e).salary === money(15000), 'for a few thousand a month');
    // A season he plays in (an injury drawn by chance can keep him out of a whole one: no line that year).
    let x;
    for (let i = 0; i < 3 && !x; i++) { year({ minorDeal: 'no', trade: 'yes' }); x = lineOf(e); }
    check(x?.level === 'Independent League' && !x.top && !(e.trades ?? []).length, 'its seasons are on the record, not in the big league totals, and nobody trades for him');
    const deal = sl.internals.decide(S(), { kind: 'minorDeal', sportId: 'baseball', orgId: bc.clubIn(S(), 'us', sp.internals.seeded('t')).id, orgName: 'x', key: 'test/minorDeal', text: 'x', options: [{ id: 'yes', label: 'y' }] });
    sl.answer(deal.id, 'yes');
    check(club(e)?.countryId === 'us' && !club(e).minorLevel && e.minor && contract(e).minorDeal, 'a big league organization can buy him out of it, onto a minor league contract');
  }
}
{
  const e = bigLeaguer(68, 'outfield');
  P().age = 29;
  sl.internals.endContract(S(), contract(e), 'released');
  const to = bc.clubIn(S(), 'jp', sp.internals.seeded('jp'));
  const d = sl.internals.decide(S(), { kind: 'secondChance', sportId: 'baseball', key: 'test/abroad', text: 'x', offers: { jp: { orgId: to.id, orgName: to.name, salary: 500000, level: 1, years: 1 } }, options: [{ id: 'jp', label: 'j' }] });
  sl.answer(d.id, 'jp');
  check(club(e)?.countryId === 'jp' && bb.levelOf(club(e)) === 'NPB', 'or he goes to Japan');
  year({ trade: 'no' });
  const x = lineOf(e);
  check(x?.level === 'NPB' && x.G <= 143, `where the season is 143 games (${x?.G})`);
}
{
  check(bb.classicYear(2023) && bb.classicYear(2026) && bb.classicYear(2030) && !bb.classicYear(2027) && !bb.classicYear(2005), 'the Classic is played in its own years');
  check(Object.keys(BASEBALL.winter).includes('do') && !BASEBALL.winter.us, 'winter ball is played in the Caribbean and Mexico, not the United States');
}
section('released: independent ball and back, Japan; the Classic\'s years');

// ---------- 5. Before the draft: a summer league and an adviser ----------
{
  const e = boy('us', 16, 'outfield');
  set(e, 70);
  const R = bb.record(e);
  const g0 = dr.draftGrade(S(), e);
  R.wood = 5;
  check(dr.draftGrade(S(), e) === g0 + 5, 'what a summer with wooden bats showed counts with the scouts');
  R.wood = 0;
  const d = sl.internals.decide(S(), { kind: 'summerBall', sportId: 'baseball', key: 'test/summer', text: 'x', options: [{ id: 'yes', label: 'y' }] });
  sl.answer(d.id, 'yes');
  check(R.summer.length === 1 && R.wood >= -4 && R.wood <= 7 && R.wood === Math.max(-4, Math.min(7, R.summer[0].delta)), 'a summer league is on the record, for better or worse');
  // An adviser: a tenth more bonus, and 4% of it.
  R.adviser = true;
  Object.assign(P().education, { enrolled: true, stage: 'high', expelled: false, droppedOut: false });
  set(e, 78);
  let sign = null;
  for (let i = 0; i < 4 && !sign; i++) sign = year({ draftSign: null, academy: 'no', commit: 'wait', sign: 'no' }).find((x) => x.kind === 'draftSign' && x.how === 'draft');
  check(sign?.deal.adviser && sign.deal.bonus > 0, 'a player with an adviser is drafted on a better bonus');
  if (sign) {
    sl.answer(sign.id, 'sign');
    check(paid('adviser/')[0] === -Math.round(sign.deal.bonus * 0.04), 'and the adviser takes 4% of it when he signs');
  }
}
section('summer leagues with wooden bats; a draft adviser');

// ---------- 6. Signed abroad: money home, English, winter ball ----------
scenario('signed abroad', () => {
  let e = null;
  for (let tries = 0; tries < 6 && !e?.intl?.signed; tries++) {
    e = boy('do', 15, 'outfield');
    set(e, 60);
    for (let i = 0; i < 3 && !e.intl?.signed; i++) year({ buscon: 'no', handshake: 'no', intlSign: (d) => d.options[0].id, remit: null });
  }
  check(e.intl?.signed, 'a Dominican boy signs');
  const remit = sl.openDecisions().find((d) => d.kind === 'remit');
  check(remit && remit.amount === e.intl.signed.bonus - e.intl.signed.toTrainer, 'and is asked what the bonus is for');
  if (remit) {
    const cash = P().finance.cash;
    sl.answer(remit.id, 'house');
    check(paid('remitBonus/')[0] === -Math.min(cash, Math.round(remit.amount * 0.5)) && e.intl.remit === 'yearly', 'half of it buys the family a house, and money goes home each year after');
  }
  need(e.contractId);
  const seen = year({ english: 'yes', winterBall: 'always', twoWay: 'no', trade: 'no' });
  need(e.contractId);
  check(seen.some((d) => d.kind === 'english') && e.intl.study === true && e.intl.english > 5, 'the club teaches English, and it comes with work');
  const before = e.intl.english;
  need(before < 100);
  year({ twoWay: 'no', trade: 'no' });
  need(e.contractId);
  check(e.intl.english > before, 'a little more each year');
  check(seen.some((d) => d.kind === 'winterBall') && e.bb.winter === 'always' && e.bb.winters.length === 2 && paid('winter/').length === 2 && paid('winter/').every((v) => v > 0), `winter ball at home pays a second salary, every winter if he likes (${e.bb.winters.length})`);
  check(paid('remit/').length >= 1 && paid('remit/').every((v) => v < 0), 'and part of the salary goes home');
});
section('signed abroad: the bonus and the family, English, winter ball');

// ---------- 7. The Hall of Fame ----------
{
  const e = bigLeaguer(80, 'outfield');
  sl.internals.endContract(S(), contract(e), 'retired');
  const R = e.bb;
  const last = S().year - 5;
  R.lines = [{ year: last, level: 'MLB', top: true, G: 150, AB: 570, H: 170, HR: 30, RBI: 100, SB: 5, AVG: 0.298 }];
  R.career = { seasons: 18, G: 2700, AB: 10000, H: 3100, HR: 520, RBI: 1700, SB: 150 };
  R.allStar = Array.from({ length: 10 }, (_, i) => last - i);
  e.level = 'pro';
  bb.hallYear(S(), e);
  check(!R.hall && bb.hallScore(e) > 100, 'not while he still plays for a living');
  e.level = 'club';
  S().year -= 1; bb.hallYear(S(), e); check(!R.hall, 'nor until five years after his last big league game');
  S().year += 1; bb.hallYear(S(), e);
  check(R.hall?.elected === S().year && R.hall.votes.length === 1 && R.hall.votes[0].pct >= BASEBALL.hall.elect, `3,000 hits and 500 home runs go in on the first ballot (${R.hall?.votes[0]?.pct}%)`);
  bb.hallYear(S(), e);
  check(R.hall.votes.length === 1, 'once');
  // A good career that is not a great one: on the ballot, and then off it.
  R.hall = null;
  R.career = { seasons: 12, G: 1500, AB: 5600, H: 1500, HR: 180, RBI: 700, SB: 60 };
  R.allStar = [last]; R.honors = []; e.awards = []; e.titles = []; // the numbers alone: no awards, no rings
  for (let i = 0; i < 12 && !R.hall?.dropped && !R.hall?.elected; i++) { bb.hallYear(S(), e); S().year += 1; }
  check(R.hall?.dropped && !R.hall.elected && R.hall.votes.length <= BASEBALL.hall.ballots && R.hall.votes.every((v) => v.pct < BASEBALL.hall.elect), `a good career stays on the ballot at most ten years, and falls off (${R.hall?.votes.length} ballots)`);
  // Too short a career is never on it.
  R.hall = null; R.career.seasons = 6;
  bb.hallYear(S(), e);
  check(!R.hall, 'ten big league seasons to be considered at all');
}
section('the Hall of Fame: five years on, ten ballots, 75%');

// ---------- 8. The Classic, a rehab assignment, the trade deadline, the first year abroad ----------
scenario('the Classic', () => {
  const e = bigLeaguer(88, 'outfield');
  const a = sp.myAthlete();
  need(sp.internals.overall(e, P()) >= 80 && e.level === 'pro');
  const R = bb.record(e);
  const caps = e.caps ?? 0;
  // The Classic is played by invitation: the nation through its qualifier, then a place on the roster (engine/nations.js).
  const classicYear = () => { nations.yearInternational(S(), a, e); for (const d of sl.openDecisions().filter((x) => x.kind === 'classicInvite')) sl.answer(d.id, 'yes'); };
  while (bb.classicYear(S().year)) S().year += 1;
  classicYear();
  check(R.classic.length === 0, 'no Classic in a year without one');
  while (!bb.classicYear(S().year)) S().year += 1;
  classicYear();
  const c = R.classic[0];
  check(R.classic.length === 1 && c.year === S().year && ['champions', 'runners-up', 'semifinalists', 'out in the quarterfinals', 'out in the pool round'].includes(c.result), `one of his country's best plays in the Classic (${c?.result})`);
  check((e.caps ?? 0) > caps && S().sports.moments.some((m) => /World Baseball Classic/.test(m.text)) && S().journal.some((j) => /World Baseball Classic/.test(j.text)), 'with caps for his country, and the story told');
  classicYear();
  check(R.classic.length === 1, 'once a tournament');
  // Not good enough for a strong country's team.
  aim(e, 72);
  S().year += 1; while (!bb.classicYear(S().year)) S().year += 1;
  classicYear();
  check(R.classic.length === 1, 'a strong country leaves an ordinary player at home');
});
scenario('a rehab assignment', () => {
  const e = bigLeaguer(84, 'pitcher');
  const a = sp.myAthlete();
  need(e.contractId && !e.minor);
  const R = bb.record(e);
  const hurt = (o = {}) => a.injuries.push({ id: `test_${a.injuries.length}`, type: 'ucl', sportId: 'baseball', year: S().year - 1, name: 'a torn elbow ligament', severity: 55, left: 0, status: 'healed', healed: S().year, setbacks: 0, ...o });
  hurt({ type: 'strain', name: 'a muscle strain', severity: 12 });
  bb.baseballYear(S(), a, e, {});
  check(R.rehab.length === 0, 'a short injury needs no rehab assignment');
  hurt();
  bb.baseballYear(S(), a, e, {});
  check(R.rehab.length === 1 && R.rehab[0].year === S().year && /elbow/.test(R.rehab[0].injury) && S().journal.some((j) => /rehab assignment/.test(j.text) && /elbow/.test(j.text)), 'back from a long injury, a big leaguer plays a rehab assignment first');
  bb.baseballYear(S(), a, e, {});
  check(R.rehab.length === 1, 'once');
  // A minor leaguer is already in the minors.
  S().year += 1;
  dr.toMinors(S(), e, club(e), 3);
  hurt();
  bb.baseballYear(S(), a, e, {});
  check(R.rehab.length === 1, 'a minor leaguer has no big club to rejoin');
});
scenario('the trade deadline', () => {
  const e = bigLeaguer(80, 'outfield');
  const a = sp.myAthlete();
  season(e);
  /** This year's standings rewritten so the player's club lost (or won) every game; then years pass until a trade. */
  const tradedFrom = (won) => {
    need(e.contractId);
    const tid = club(e).teamIds[0];
    const lg = Object.values(S().sports.orgs).find((x) => x.kind === 'league' && x.teamIds.includes(tid));
    const played = Object.values(S().sports.seasons).filter((x) => x.leagueId === lg.id).sort((x, y) => y.year - x.year)[0];
    need(played);
    for (const f of played.fixtures) { if (f.home === tid) f.score = won ? [5, 0] : [0, 5]; else if (f.away === tid) f.score = won ? [0, 5] : [5, 0]; }
    const table = sp.standings(played).map((t) => t.teamId);
    const n = (e.trades ?? []).length;
    for (let i = 0; i < 600 && (e.trades ?? []).length === n; i++) {
      S().year += 1; played.year = S().year;
      const k = contract(e); k.from = S().year - 2; k.to = S().year + 5;
      tr.tradeYear(S(), a, e, k);
    }
    return { t: e.trades?.[n], table, tid, to: club(e).teamIds[0], said: S().journal.at(-1)?.text ?? '' };
  };
  const sold = tradedFrom(false);
  check(sold.t && sold.table.indexOf(sold.tid) === sold.table.length - 1 && sold.t.deadline === true, 'a club at the bottom in July sells at the trade deadline');
  check(sold.t && sold.table.indexOf(sold.to) < Math.max(2, Math.round(sold.table.length / 4)), `to a club that is in the race (place ${sold.table.indexOf(sold.to) + 1})`);
  check(/At the trade deadline/.test(sold.said) && /out of the race/.test(sold.said) && /chasing the pennant/.test(sold.said), `and it is told that way (${sold.said})`);
  const kept = tradedFrom(true);
  check(kept.t && kept.table.indexOf(kept.tid) === 0 && !kept.t.deadline && !/trade deadline/.test(kept.said), 'a club at the top does not sell its big leaguers in July: a trade from there is a winter one');
  // A contender does deal its prospects at the deadline.
  need(e.contractId);
  dr.toMinors(S(), e, club(e), 3);
  const prospect = tradedFrom(true);
  check(prospect.t?.deadline === true && /chasing the pennant, sent you/.test(prospect.said) && e.minor, `a contender sends a prospect away at the deadline for help now (${prospect.said})`);
});
scenario('the first year abroad', () => {
  let e = null;
  for (let tries = 0; tries < 6 && !e?.intl?.signed; tries++) {
    e = boy('do', 15, 'outfield');
    set(e, 60);
    for (let i = 0; i < 3 && !e.intl?.signed; i++) year({ buscon: 'no', handshake: 'no', intlSign: (d) => d.options[0].id, remit: 'no' });
  }
  need(e.intl?.signed && e.contractId);
  const a = sp.myAthlete();
  const X = e.intl;
  const p = P();
  const reset = (english, usYears) => { Object.assign(X, { english, usYears, study: false }); a.motivation = 60; p.stats.mood = 60; };
  // Still at the academy in the Dominican Republic: at home.
  dr.toMinors(S(), e, club(e), 0, INTL_SIGNING.ladder);
  reset(5, 0);
  bb.baseballYear(S(), a, e, {});
  check(sp.orgOf(e.orgId).countryId === 'do' && X.usYears === 0 && a.motivation === 60 && p.stats.mood === 60, 'at the academy in the Dominican Republic he is still at home');
  // The first season in the United States, without the language.
  dr.toMinors(S(), e, club(e), 1, INTL_SIGNING.ladder);
  reset(5, 0);
  bb.baseballYear(S(), a, e, {});
  check(sp.orgOf(e.orgId).countryId === 'us' && X.usYears === 1 && a.motivation === 54 && p.stats.mood === 56, `the first season in the United States, without English, is a lonely one (motivation ${a.motivation}, mood ${p.stats.mood})`);
  check(S().journal.some((j) => /first season in the United States/.test(j.text) && /lonely year/.test(j.text)), 'and it is told');
  check(X.english > 5 && X.english < 45, 'English comes slowly to one who only gets by');
  // With the language, or after two years, it is not.
  reset(80, 0);
  bb.baseballYear(S(), a, e, {});
  check(X.usYears === 1 && a.motivation === 60 && p.stats.mood === 60, 'a player who has the language is not lonely');
  reset(5, 2);
  bb.baseballYear(S(), a, e, {});
  check(X.usYears === 3 && a.motivation === 60 && p.stats.mood === 60, 'and by the third year it is home enough');
});
section('the Classic; a rehab assignment; the trade deadline, sellers and contenders; the first year abroad');

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(' ✗', p);
  process.exit(1);
}
for (const m of ok) console.log(' ✓', m);
console.log('Baseball holds together.');
