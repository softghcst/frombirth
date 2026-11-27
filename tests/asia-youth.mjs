// Japan's and Korea's drafts, posting to the big leagues and free agency abroad, Korean military service
// (engine/draft.js, engine/asiaBaseball.js), and soccer's youth contracts (engine/youthContracts.js).
// Run with: node tests/asia-youth.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { COUNTRY_DRAFTS, sportOf } = await import('../js/data/sports.js');
const { ROOTS } = await import('../js/data/economy.js');
const sl = await import('../js/engine/sportsLife.js');
const sp = await import('../js/engine/sports.js');
const { deathRoll } = await import('../js/engine/death.js');
deathRoll.spared = true; // these checks are about contracts, not about dying young
const dr = await import('../js/engine/draft.js');
const asia = await import('../js/engine/asiaBaseball.js');
const youth = await import('../js/engine/youthContracts.js');
ROOTS.familyLeaves = 0; // these lives stay where they began

const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;
const overall = (e) => sp.internals.overall(e, P());
const raise = (e, to) => { for (const k of Object.keys(e.skills)) { e.ceiling[k] = Math.max(e.ceiling[k], to); e.skills[k] = Math.max(e.skills[k], to); } };

/** A boy in `country`, grown to `age`, playing `sport`; begun again if the life ends first (rarely, a child dies). */
function boy(country, sport, age, boost = 0) {
  for (;;) {
    let s; do { s = createLife({ countryId: country, gender: 'male' }); } while (s.player.royal);
    store.state = s;
    s.player.talents.sports = 92; s.player.stats.intellect = 60;
    for (let i = 0; i < 7; i++) { s.player.stats.health = 95; advanceYear(); s.pendingEvents = []; }
    sp.takeUp(sport);
    const e = sp.entryOf(sport);
    if (!e) continue;
    for (const k of Object.keys(e.skills)) e.skills[k] = Math.min(e.ceiling[k], e.skills[k] + boost);
    e.plan = { type: 'balanced', hours: 12 };
    for (let i = 0; i < 30 && s.player.alive && s.player.age < age; i++) year({});
    if (s.player.alive && s.player.countryId === country && sp.divOf(s.player) === 'men') return e; // these are the men's leagues' rules
  }
}
/** One year; decisions answered as `pick` says (a value or a function of the decision), or the cautious default. */
function year(pick = {}) {
  const p = P(); p.stats.health = 95; p.legal.pending = null; p.legal.incarceration = null;
  for (const x of sp.myAthlete().injuries) x.status = 'healed';
  advanceYear(); S().pendingEvents = [];
  const seen = [];
  for (let round = 0; round < 3; round++) for (const d of sl.openDecisions()) {
    seen.push(d);
    // These checks are about academies and contracts: an offer to cheat is always refused.
    const c = typeof pick[d.kind] === 'function' ? pick[d.kind](d) : pick[d.kind] ?? (d.kind === 'integrity' ? 'refuse' : d.kind === 'renew' ? 'yes' : d.options.some((o) => o.id === 'no') ? 'no' : d.options.at(-1).id);
    if (c != null) sl.answer(d.id, c);
  }
  return seen;
}
const homeClub = (e) => sp.orgOf(S().sports.contracts[e.contractId]?.orgId);

// ---------- 1. Japan: the declaration, the draft, lots for the first round ----------
let jpPro = null;
for (let tries = 0; tries < 4 && !jpPro; tries++) {
  const e = boy('jp', 'baseball', 15, 8);
  raise(e, 66);
  let declared = null;
  let signedAt = null;
  for (let i = 0; i < 4 && !e.contractId; i++) {
    const seen = year({ declare: 'yes', draftSign: 'sign', academy: 'no' });
    declared ??= seen.find((d) => d.kind === 'declare');
    if (e.contractId) signedAt = P().age;
  }
  if (e.contractId) jpPro = { e, declared, signedAt, state: S() };
}
{
  const { e, declared, signedAt } = jpPro ?? {};
  check(jpPro, 'a strong Japanese high school player is drafted and signs');
  if (jpPro) {
    check(declared && /declaration/.test(declared.text), 'a high school player must first declare that he wants to turn professional');
    check(signedAt <= 18, `he is drafted out of high school (at ${signedAt})`);
    const d = Object.values(S().sports.drafts).find((x) => x.sport === 'baseball' && x.player?.teamId);
    check(d && d.size === 12 && d.rounds === COUNTRY_DRAFTS.jp.baseball.rounds, `Japan's league has 12 clubs (${d?.size})`);
    check(homeClub(e)?.countryId === 'jp', 'he plays for a Japanese club');
    check(!d.bids || (d.bids.teams.length > 1 && d.bids.teams.includes(d.bids.winner)), 'where several clubs name him first, one of them wins the lots');
  }
}
{
  // Not without the declaration; university players in their fourth year; company players three years on.
  const e = boy('jp', 'baseball', 16, 8);
  raise(e, 66);
  for (let i = 0; i < 3; i++) year({ declare: 'no' });
  check(!e.contractId && !(e.draft?.history ?? []).some((x) => x.pick), 'no club may draft a player who has not declared');
  const p = P();
  p.education.enrolled = true; p.education.stage = 'university'; p.education.yearInStage = 1;
  check(!dr.eligible(S(), e).ok && /fourth year/.test(dr.eligible(S(), e).why), 'a university player waits for his fourth year');
  p.education.yearInStage = 3;
  check(dr.eligible(S(), e).ok && dr.eligible(S(), e).declare, 'and then declares');
}
section('Japan: the declaration, a 12-club draft, lots for the first round, university players in their fourth year');

// ---------- 2. Posting and free agency abroad ----------
{
  const { e } = jpPro ?? {};
  if (e) {
    store.state = jpPro.state;
    raise(e, 82);
    e.proYear = S().year - 7;
    const seen = [];
    for (let i = 0; i < 4 && !seen.some((d) => d.kind === 'posting'); i++) seen.push(...year({ posting: 'yes', mlbOffer: 'sign', declare: 'no' }));
    const posting = seen.find((d) => d.kind === 'posting');
    check(posting, 'a star of seven seasons can ask to be posted');
    const asked = e.asia.posted;
    check(asked.length >= 1, 'and the club answers');
    for (let i = 0; i < 6 && !e.asia.posted.some((x) => x.to); i++) seen.push(...year({ posting: 'yes', mlbOffer: 'sign' }));
    const offered = seen.find((d) => d.kind === 'mlbOffer');
    const club = homeClub(e);
    check(e.asia.posted.some((x) => x.to) && club?.countryId === 'us', 'posted and signed by a big league club');
    check(offered && (/posting fee/.test(offered.text) || /free agent/.test(offered.text)), 'the posting fee is the club\'s');
    const ageThen = offered ? P().age - (S().year - offered.year) : 0;
    check(offered && (offered.how === 'freeAgent' ? !offered.amateur : ageThen >= 25 ? !offered.amateur : offered.amateur), `under 25, a posted player signs under the international amateur rules (${offered?.how}, ${ageThen})`);
  }
  check(asia.postingFee(20e6) === 4e6 && asia.postingFee(40e6) === 5e6 + 2625000 && asia.postingFee(60e6) === 5e6 + 4375000 + 1500000, 'the posting fee: 20% of the first $25 million, 17.5% of the next, 15% after');
}
section('posting: the club\'s consent, the fee, the amateur rules under 25');

// ---------- 3. Korea: the draft and military service ----------
{
  let e = null;
  for (let tries = 0; tries < 4 && !e?.contractId; tries++) {
    e = boy('kr', 'baseball', 15, 8);
    raise(e, 66);
    for (let i = 0; i < 4 && !e.contractId; i++) year({ draftSign: 'sign', academy: 'no' });
  }
  check(e.contractId && homeClub(e)?.countryId === 'kr', 'a Korean high school senior is drafted and signs');
  const d = Object.values(S().sports.drafts).find((x) => x.sport === 'baseball' && x.player?.teamId);
  check(d?.size === 10 && d.rounds === 11, `Korea's league has 10 clubs and 11 rounds (${d?.size}, ${d?.rounds})`);
  // Service: asked from 25; Sangmu for a good professional; back to the club after.
  P().age = 25; raise(e, 70);
  let asked = null;
  for (let i = 0; i < 2 && !e.asia.service; i++) asked = year({ service: 'sangmu', posting: 'no' }).find((d2) => d2.kind === 'service') ?? asked;
  check(asked && e.asia.service?.kind === 'sangmu' && sp.orgOf(e.orgId)?.name === 'Sangmu Phoenix', 'military service before 28: Sangmu takes a good player');
  for (let i = 0; i < 3 && e.asia.service; i++) year({ posting: 'no' });
  check(e.asia.served && !e.asia.service && sp.orgOf(e.orgId)?.name !== 'Sangmu Phoenix', 'service ends, and he goes back to his club');
  // Ordinary service: no games; a medal exempts.
  const e2 = boy('kr', 'baseball', 26, 0);
  e2.asia ??= { posted: [], service: null, served: false, exempt: null };
  e2.medals = [{ year: S().year - 1, medal: 'gold', games: 'the Games' }];
  year({ service: 'regular' });
  check(e2.asia.exempt && !e2.asia.service, 'a medal at the Games exempts him');
  const e3 = boy('kr', 'baseball', 26, 0);
  year({ service: 'regular' });
  check(e3.asia?.service?.kind === 'regular', 'otherwise he serves');
  const before = e3.stats[S().year + 1];
  year({});
  check(!before && !(e3.stats[S().year]?.games), 'and plays no games while he does');
}
section('Korea: a 10-club, 11-round draft; military service, Sangmu, the medal exemption');

// ---------- 4. Soccer: the academy at 16, contracts under 18 ----------
{
  check(youth.firstProAge({ countryId: 'uk' }, 'soccer') === 17 && youth.firstProAge({ countryId: 'br' }, 'soccer') === 16, 'a first professional contract at 17 in England, 16 elsewhere');
  check(youth.maxYears({ age: 16 }, 'soccer', 5) === 3 && youth.maxYears({ age: 19 }, 'soccer', 5) === 5 && youth.maxYears({ age: 16 }, 'baseball', 7) === 7, 'under 18, a soccer contract runs three years at most');
  let kept = null;
  // About two lives in five get this far: twenty tries, so a run of bad luck is not a failure.
  for (let tries = 0; tries < 20 && !kept; tries++) {
    const e = boy('uk', 'soccer', 13, 6);
    let deal = null;
    for (let i = 0; i < 5 && !deal; i++) deal = year({ academy: 'yes', youthDeal: 'yes', contract: 'no' }).find((d) => d.kind === 'youthDeal');
    if (deal && e.youth?.scholar) kept = { e, deal };
  }
  check(kept && /scholarship/.test(kept.deal.text) && P().age === 16, 'at 16 an English academy offers its best a scholarship');
  if (kept) {
    const e = kept.e;
    raise(e, 70);
    let signed = null;
    for (let i = 0; i < 3 && !e.contractId; i++) signed = year({ contract: 'yes' }).find((d) => d.kind === 'contract') ?? signed;
    check(Object.keys(S().sports.paid).some((k) => k.startsWith(`scholar/${e.id}`)), 'a scholar is paid a small wage');
    const k = S().sports.contracts[e.contractId];
    check(k && (k.from - (S().year - P().age) >= 18 || k.to - k.from <= 3), `a first contract before 18 runs three years at most (${k ? `${k.from}–${k.to}` : 'none'}, ${signed?.text ?? 'no offer'})`);
  }
  // Released at 16.
  let released = null;
  for (let tries = 0; tries < 4 && !released; tries++) {
    const e = boy('br', 'soccer', 15, 0);
    if (e.level !== 'academy') { const org = sp.internals.findOrg(S(), sportOf('soccer'), 'academy'); sp.internals.joinOrg(org, S()); }
    for (const k of Object.keys(e.skills)) { e.skills[k] = Math.min(e.skills[k], 40); e.ceiling[k] = 45; }
    for (let i = 0; i < 3 && !e.youth?.released; i++) year({ youthDeal: 'yes' });
    if (e.youth?.released) released = e;
  }
  check(released && released.level !== 'academy' && !released.youth.scholar, 'most are released at 16');
}
section('soccer: scholarships and youth contracts at 16, released or signed, three years at most under 18');

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(' ✗', p);
  process.exit(1);
}
for (const m of ok) console.log(' ✓', m);
console.log('Japan, Korea and the academies hold together.');
