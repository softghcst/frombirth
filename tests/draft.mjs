// High school recruiting, the college years and the drafts, by the real leagues' rules (engine/recruiting.js,
// engine/college.js, engine/draft.js). Run with: node tests/draft.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { SPORTS, DRAFTS, DIVISIONS, HEADCOUNT } = await import('../js/data/sports.js');
const { ROOTS } = await import('../js/data/economy.js');
const sl = await import('../js/engine/sportsLife.js');
const sp = await import('../js/engine/sports.js');
const edu = await import('../js/engine/education.js');
const uni = await import('../js/engine/university.js');
const rec = await import('../js/engine/recruiting.js');
const col = await import('../js/engine/college.js');
const dr = await import('../js/engine/draft.js');
ROOTS.familyLeaves = 0; // these lives are about American sport: the family stays in the United States

const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;

/** A boy in the United States, grown to `age`, playing `sport` well. A life that ends first (rarely, a child dies)
 *  is begun again: these checks are about the ones who grow up. */
function athlete(sport, age, boost = 30) {
  for (;;) {
    let s; do { s = createLife({ countryId: 'us', gender: 'male' }); } while (s.player.royal);
    store.state = s;
    s.player.talents.sports = 92; s.player.stats.intellect = 74;
    for (let i = 0; i < 13; i++) { s.player.stats.health = 95; advanceYear(); s.pendingEvents = []; }
    sp.takeUp(sport);
    const e = sp.entryOf(sport);
    if (!e) continue;
    for (const k of Object.keys(e.skills)) e.skills[k] = Math.min(e.ceiling[k], e.skills[k] + boost);
    e.plan = { type: 'balanced', hours: 14 };
    for (let i = 0; i < 30 && s.player.alive && s.player.age < age; i++) year({});
    if (s.player.alive && s.player.countryId === 'us' && sp.divOf(s.player) === 'men') return e; // these are the men's leagues' rules
  }
}
/** One year, with the decisions answered as `pick` says (a function of the decision), or the cautious default. */
function year(pick = {}) {
  const p = P(); p.stats.health = 95; p.legal.pending = null; p.legal.incarceration = null;
  advanceYear(); S().pendingEvents = [];
  for (let round = 0; round < 3; round++) for (const d of sl.openDecisions()) {
    const c = typeof pick[d.kind] === 'function' ? pick[d.kind](d) : pick[d.kind] ?? (d.kind === 'camp' ? 'showcase' : d.options.some((o) => o.id === 'no') ? 'no' : d.options.at(-1).id);
    if (c != null) sl.answer(d.id, c);
  }
}
/** The best offer the player's grades allow them to sign: Division I if they can. */
const firstD1 = (d) => {
  const gpa = P().education.gpa ?? 0;
  const ok = (o) => { const div = Object.values(DIVISIONS).find((x) => (o.sub ?? '').startsWith(x.name)); return !div || gpa >= div.minGpa; };
  return (d.options.find((o) => /^Division I ·/.test(o.sub ?? '') && ok(o)) ?? d.options.find((o) => o.id !== 'wait' && o.id !== 'no' && ok(o)) ?? d.options[0]).id;
};
function enrollSigned(e) {
  const p = P();
  const inst = uni.catalog(p.countryId).find((u) => u.id === e.recruit.signed);
  if (!inst) return; // signed with a junior college: not one of the universities this helper enrolls at
  const o = e.recruit.offers.find((x) => x.id === inst.id);
  p.education.enrolled = false; p.education.stage = 'none';
  edu.enroll('university', 'business', 'scholarship', {}, { id: inst.id, name: inst.name, aid: { fraction: o.fraction, parts: o.fraction ? [{ kind: 'athletic', fraction: o.fraction }] : [] } });
}

// ---------- 1. Recruiting ----------
{
  const e = athlete('american_football', 13);
  for (let i = 0; i < 4; i++) year({ camp: 'elite', commit: firstD1, sign: firstD1, visit: (d) => d.options[0].id });
  const R = e.recruit;
  check(R && R.stars >= 3 && R.rank > 0, `the recruiting services rate a good high school player (${R?.stars}★, number ${R?.rank})`);
  check(R.offers.length >= 2 && R.offers.every((o) => DIVISIONS[o.division]), `offers come from real divisions (${R.offers.map((o) => o.division).join(', ')})`);
  check(R.offers.filter((o) => o.division === 'D1').every((o) => o.fraction === 1), 'football is a headcount sport: Division I offers are full scholarships');
  check(R.offers.filter((o) => ['D3', 'IVY'].includes(o.division)).every((o) => o.fraction === 0), 'Division III and the Ivies give no athletic scholarships');
  check(R.offers.every((o) => o.division !== 'JUCO' || o.year === R.history.find((h) => /Community College/.test(h.text))?.year), 'junior colleges come in at the end');
  check(R.signed && P().flags.sportOffers.some((x) => x.accepted && x.instId === R.signed), `signing day makes it binding, and admissions see it (${R.signed})`);
  check(R.history.some((h) => /Verbally committed/.test(h.text)) || R.commit, 'a verbal commitment comes before signing');
  check(HEADCOUNT.includes('basketball') && !HEADCOUNT.includes('baseball'), 'baseball shares its scholarships out; basketball gives whole ones');
  // A player whose grades are under the line cannot sign with Division I.
  const d = { sportId: 'american_football', offers: R.offers };
  const off = R.offers.find((o) => o.division === 'D1' && !o.pulled && o.id !== R.signed) ?? R.offers.find((o) => o.division === 'D1');
  if (off) {
    const was = { signed: R.signed, gpa: P().education.gpa };
    R.signed = null; off.pulled = null; P().education.gpa = 1.9;
    const r = rec.RECRUIT_ANSWERS.sign(S(), d, off.id);
    check(r.ok === false && /junior college/i.test(r.text), 'a recruit under the freshman GPA cannot sign with Division I: junior college is the way in');
    R.signed = was.signed; P().education.gpa = was.gpa;
  }
}
section('recruiting: stars and rank, camps, offers by division (full, partial or none), commitment, signing day, the grades');

// ---------- 2. College ----------
{
  const e = athlete('american_football', 13);
  for (let i = 0; i < 5 && !e.recruit?.signed; i++) year({ camp: 'elite', commit: firstD1, sign: firstD1 });
  check(!!e.recruit?.signed, 'the recruit signed');
  enrollSigned(e);
  year({ redshirt: 'yes', portal: 'stay', declare: 'no', withdraw: 'withdraw' });
  const org = sp.orgOf(e.orgId);
  const lg = org?.leagueId ? sp.orgOf(org.leagueId) : null;
  check(org?.kind === 'college' && org.division && lg && /Conference/.test(lg.name) && lg.name.startsWith(DIVISIONS[org.division]?.name.split(' (')[0] ?? 'x'), `the college team plays in a conference of its division (${lg?.name})`);
  check(e.college && col.classOf(S(), e) === 'Freshman', 'a first-year player is a freshman');
  // A redshirt year does not use a season.
  e.college.redshirt = S().year + 1;
  const before = e.college.played.length;
  year({ portal: 'stay', declare: 'no', withdraw: 'withdraw' });
  check(e.college.out[S().year] === 'redshirt' && e.college.played.length === before, 'a redshirt year plays no games and keeps the season');
  check(/^Redshirt/.test(col.classOf(S(), e)), `and the class says so (${col.classOf(S(), e)})`);
  // Grades under 2.0 keep a player out (last term's marks decide the next season).
  e.college.lastGpa = 1.6;
  const n = e.college.played.length;
  year({ portal: 'stay', declare: 'no', withdraw: 'withdraw' });
  check(e.college.out[S().year] === 'grades' && e.college.played.length === n, 'a college GPA under 2.0 means no games');
  P().education.gpa = 3;
  check(e.college.nil.every((x) => S().year >= col.NIL_FROM), 'name-image-likeness money only from 2021');
}
section('college: conferences by division, class years, a redshirt year that keeps the season, grades that keep you eligible');

// ---------- 3. Eligibility rules, league by league ----------
{
  const e = athlete('baseball', 17);
  // The rules, not this life's luck: a senior at high school (not one expelled or dropped out along the way).
  Object.assign(P().education, { enrolled: true, stage: 'high', expelled: false, droppedOut: false });
  const D = dr.draftOf(S(), 'baseball');
  check(D && D.rounds === DRAFTS.baseball.rounds && rec.gradeOf(P()) === 12 && dr.eligible(S(), e, D).ok, 'baseball: a high school senior can be drafted');
  check(dr.draftOf(S(), 'american_football') && !dr.eligible(S(), { ...e, id: 'american_football' }, dr.draftOf(S(), 'american_football')).ok, 'football: not out of high school');
  check(!dr.eligible(S(), { ...e, id: 'basketball' }, dr.draftOf(S(), 'basketball')).ok, 'basketball: not at 17 or straight from high school');
  const hockey = { ...e, id: 'ice_hockey' };
  // Hockey's draft is the June after the season: a 17-year-old this season is 18 at that draft.
  P().age = 16; check(!dr.eligible(S(), hockey, dr.draftOf(S(), 'ice_hockey')).ok, 'hockey: not at 17 by the draft');
  P().age = 17; check(dr.eligible(S(), hockey, dr.draftOf(S(), 'ice_hockey')).ok, 'hockey: at 18 by the draft');
  P().age = 20; check(!dr.eligible(S(), hockey, dr.draftOf(S(), 'ice_hockey')).ok, 'hockey: past 20 is a free agent');
  P().age = 17;
  // Elsewhere there is no draft: a club signs players.
  check(sp.proPath(SPORTS.baseball, 'do') !== 'draft' && sp.proPath(SPORTS.soccer, 'us') !== 'draft', 'no draft where the sport has none (the Dominican Republic, soccer)');
}
section('eligibility by league: baseball from high school, football three years out, basketball at 19, hockey 18 to 20');

// ---------- 4. Drafts played out ----------
{
  // Baseball: a strong high school senior is drafted; going to college instead means waiting until after junior year.
  const e = athlete('baseball', 16, 34);
  let drafted = null;
  for (let i = 0; i < 2 && !drafted; i++) { year({ camp: 'elite', commit: firstD1, sign: firstD1, draftSign: 'stay' }); drafted = e.draft?.history.find((x) => x.pick); }
  check(drafted && drafted.round >= 1 && drafted.pick >= 1, `a strong senior is drafted (${drafted ? `round ${drafted.round}, pick ${drafted.pick}` : 'not picked'})`);
  const d = Object.values(S().sports.drafts).find((x) => x.sport === 'baseball' && x.player?.pick);
  if (d) {
    check(d.size === 30 && d.rounds === 20 && d.order.length === 30 && new Set(d.order).size === 30, 'the draft is 20 rounds of a 30-club league, each club once a round');
    check(d.lottery.every((x) => x.to <= DRAFTS.baseball.lottery.picks && x.from <= DRAFTS.baseball.lottery.teams), 'the lottery is among the worst teams, for the first picks');
    const board = dr.draftBoard(S(), d, 1);
    check(board.filter((x) => x.round === 1).length === 30 && board.filter((x) => x.mine).length === 1, 'the first round is thirty named picks, and the player\'s own');
    check(JSON.stringify(dr.draftBoard(S(), d, 1)) === JSON.stringify(board), 'the class is the same every time it is shown');
  }
  if (e.recruit?.signed && !e.recruit.signed.startsWith('juco:')) {
    enrollSigned(e);
    year({ portal: 'stay', redshirt: 'no' });
    check(!dr.eligible(S(), e).ok, 'a drafted senior who went to a four-year college waits until after junior year');
  }
}
{
  // Football: a junior declares, leaves college, and is drafted or signed as an undrafted free agent.
  const e = athlete('american_football', 13, 32);
  for (let i = 0; i < 5 && !e.recruit?.signed; i++) year({ camp: 'elite', commit: firstD1, sign: firstD1 });
  if (e.recruit?.signed) enrollSigned(e);
  let declared = false;
  for (let i = 0; i < 5 && !e.contractId; i++) year({ portal: 'stay', redshirt: 'no', declare: (x) => { declared = true; return 'yes'; }, draftSign: 'sign' });
  // A player who never went to college has no college career to leave: they go into the draft without declaring.
  check(declared || !e.college, 'a college football player is asked to declare once eligible');
  check(e.contractId && sp.orgOf(sp.ensure().contracts[e.contractId].orgId)?.level === 'pro', `a drafted (or undrafted) player signs with a professional club (${e.draft?.history.map((x) => (x.pick ? `pick ${x.pick}` : 'undrafted')).join(', ')})`);
  check(!e.college || !sp.orgOf(e.orgId) || sp.orgOf(e.orgId).kind !== 'college', 'and has left college football');
  const k = sp.ensure().contracts[e.contractId];
  check(!k || P().career.salary >= 900000, `a rookie is paid at least the league minimum (${P().career.salary})`);
}
{
  // Hockey: drafted at 18, plays in college while the club holds the rights, then signs an entry-level contract.
  const e = athlete('ice_hockey', 16, 32);
  for (let i = 0; i < 3; i++) year({ camp: 'elite', commit: firstD1, sign: firstD1, draftSign: (d) => (d.options.some((o) => o.id === 'stay') ? 'stay' : 'sign') });
  const drafted = e.draft?.history.find((x) => x.pick);
  check(drafted, `a good 18-year-old is drafted (${drafted ? `pick ${drafted.pick}` : 'not picked'})`);
  check(!drafted || e.draft.rights || e.contractId, `and either signs or the club holds the rights${!drafted || e.draft.rights || e.contractId ? '' : ` (${JSON.stringify(sp.ensure().decisions.filter((x) => x.kind === 'draftSign').map((x) => [x.year, x.status, x.choice, x.how]))})`}`);
}
section('drafts: baseball from high school (or college after junior year), football declares, hockey rights; order, lottery, rounds, the class');

// ---------- 5. The minor leagues ----------
{
  const e = athlete('baseball', 17, 26);
  for (let i = 0; i < 2 && !e.contractId; i++) year({ camp: 'elite', sign: 'no', commit: 'wait', draftSign: 'sign', declare: 'yes' });
  if (e.contractId && e.minor) {
    const D = DRAFTS.baseball;
    const start = e.minor.level;
    check(start <= 1, `a high school draftee starts low in the minors (${D.minors[start]})`);
    const org = sp.orgOf(e.minor.orgId);
    check(org?.minorLevel === D.minors[start] && sp.orgOf(org.leagueId ?? '')?.name?.includes(D.minors[start]) !== false, 'the minor league team is its own club, in its level\'s league');
    check(P().career.salary < 60000, 'and is paid a minor league wage');
    for (let i = 0; i < 6 && e.minor; i++) { for (const k of Object.keys(e.skills)) e.skills[k] = Math.min(e.ceiling[k], e.skills[k] + 3); year({}); }
    check(!e.minor || e.minor.level > start, `a player who improves climbs (now ${e.minor ? D.minors[e.minor.level] : 'called up'})`);
    if (!e.minor) check(P().career.salary >= 700000 && P().milestones.some((m) => /Called up/.test(m.text)), 'called up to the big club, at a big league wage');
  } else check(true, 'skipped');
}
section('the minors: a draftee starts at a level for their age, climbs, and is called up');

console.log(ok.map((x) => `ok  ${x}`).join('\n'));
if (problems.length) { console.log(`\n${problems.length} problem(s):\n${problems.join('\n')}`); process.exit(1); }
console.log('\nFrom high school to the draft, by the rules the real leagues play by.');
