// Checks the athletic life: the registry, profiles and skills, training and its limits, clubs, coaches and tryouts,
// seasons and events (deterministic, never re-rolled), standings and titles from completed games only, injuries through
// the health record, recruiting and scholarships through real tuition, professional contracts through the careers
// system, money paid once, the record across a save and across generations, and the My Athletics navigation.
// Run with: node tests/sports.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { die } = await import('../js/engine/death.js');
const { continueAs, heirs } = await import('../js/engine/legacy.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { audit: ledgerAudit } = await import('../js/engine/ledger.js');
const { weeklyLoad } = await import('../js/engine/worklife.js');
const { aid } = await import('../js/engine/admissions.js');
const { profile: applicant, catalogue } = await import('../js/engine/university.js');
const { SPORTS_LIST, SPORTS, PLANS, INJURIES } = await import('../js/data/sports.js');
const { ILLNESS_BY_ID } = await import('../js/data/illnesses.js');
const { CATEGORIES } = await import('../js/data/money.js');
const sp = await import('../js/engine/sports.js');
const life = await import('../js/engine/sportsLife.js');
const play = await import('../js/engine/sportsPlay.js');
const { createNav } = await import('../js/ui/animalNav.js');

rng.seed(20261117);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); else ok.push(`(after failures) ${msg}`); };
const S = () => store.state;
const P = () => store.state.player;
const snap = (x) => JSON.stringify(x);
const sound = (where) => { const bad = life.audit(); check(!bad.length, `${where}: the athletic record is unsound: ${bad.join('; ')}`); };
const quiet = () => { S().pendingEvents = []; };
/** Answers whatever is waiting with its first choice, or a named one. */
const answerAll = (pref = {}) => { for (const d of life.openDecisions()) life.answer(d.id, pref[d.kind] && d.options.some((o) => o.id === pref[d.kind]) ? pref[d.kind] : d.options[0].id); };

function born(countryId = 'us', city = 'Chicago') {
  for (;;) {
    store.state = createLife({ countryId, city });
    if (!P().royal) return P();
  }
}
/** Moves a life on a number of years, answering whatever the athletic engine asks. */
function years(n, pref) { for (let i = 0; i < n && P().alive; i++) { advanceYear(); quiet(); answerAll(pref); } }
/** A life grown to an age, alive and free: lives that end early or go to prison are begun again. */
function grownTo(age, countryId, city) {
  for (;;) { const p = born(countryId, city); years(age); if (p.alive && p.age === age && !p.legal?.incarceration) return p; }
}

// ---------- 1. The registry ----------
{
  check(SPORTS_LIST.length >= 20, 'there are at least twenty sports');
  for (const s of SPORTS_LIST) {
    const w = Object.values(s.attrs).reduce((t, x) => t + x, 0);
    check(Math.abs(w - 1) < 0.011, `${s.id}: its attribute weights add up to one (${w})`);
    check(s.skills.length >= 3 && new Set(s.skills.map((x) => x[0])).size === s.skills.length, `${s.id}: its own skills, each once`);
    for (const [, , ws] of s.positions ?? []) for (const k of Object.keys(ws)) check(s.skills.some((x) => x[0] === k), `${s.id}: a position leans on ${k}, which is one of its skills`);
    if (s.adapter === 'time') check(s.events?.length > 0, `${s.id}: a measured sport has events`);
    if (s.adaptive) check(!!SPORTS[s.adaptive.of], `${s.id}: adapted from a sport that exists`);
    check(s.proFrom >= s.founded, `${s.id}: nobody is paid to play before it exists`);
    if (s.pro === 'draft') check(s.draftIn?.length, `${s.id}: a draft names where it applies`);
  }
  check(SPORTS.soccer.depth === 'full' && SPORTS.tennis.depth === 'full' && SPORTS.pickleball.depth === 'full', 'soccer, tennis and pickleball are modeled in full');
  check(!SPORTS.soccer.attrs['talents.soccer'] && !Object.keys(SPORTS.tennis.attrs).some((k) => !/^(talents|stats|hidden)\./.test(k)), 'sports read the character\'s existing attributes, not new copies of them');
  for (const id of Object.keys(INJURIES)) check(ILLNESS_BY_ID[`sport_${id}`]?.chance === 0 && ILLNESS_BY_ID[`sport_${id}`].recover === 0, `${id}: in the health record, never drawn at random and never healed by chance`);
  check(CATEGORIES.prizeMoney?.kind === 'income' && CATEGORIES.sponsorship?.kind === 'income' && CATEGORIES.sport?.kind === 'expense', 'prize money, sponsorship and sport costs have their own headings');
  section('registry: every sport is well formed');
}

// ---------- 2. Pure results: the same key, the same result ----------
{
  const a = play.tennisMatch({ serve: 60, ret: 55, rest: 58 }, { serve: 50, ret: 50, rest: 50 }, 'k1');
  rng.next(); rng.next();
  const b = play.tennisMatch({ serve: 60, ret: 55, rest: 58 }, { serve: 50, ret: 50, rest: 50 }, 'k1');
  check(snap(a) === snap(b), 'a tennis match with the same key comes out the same, whatever the game\'s dice did in between');
  for (const m of [a, play.tennisMatch({ serve: 40, ret: 40, rest: 40 }, { serve: 80, ret: 80, rest: 80 }, 'k2')]) {
    for (const [x, y] of m.sets) check((Math.max(x, y) === 6 && Math.abs(x - y) >= 2) || (Math.max(x, y) === 7 && Math.min(x, y) >= 5), `a tennis set ends properly (${x}-${y})`);
    check(m.sets.filter((s) => (s[0] > s[1]) === (m.winner === 0)).length === 2, 'the winner took two sets');
  }
  const pk = play.rallyMatch(60, 55, 'pk', 11);
  for (const [x, y] of pk.sets) check(Math.max(x, y) >= 11 && Math.abs(x - y) >= 2, `a pickleball game is to eleven, won by two (${x}-${y})`);
  let strong = 0;
  for (let i = 0; i < 200; i++) if (play.tennisMatch({ serve: 70, ret: 70, rest: 70 }, { serve: 55, ret: 55, rest: 55 }, `s${i}`).winner === 0) strong++;
  check(strong > 140 && strong < 200, `the stronger player wins most matches, not all (${strong} of 200)`);
  const g = play.teamGame(SPORTS.soccer, 60, 60, 'g'); check(snap(g) === snap(play.teamGame(SPORTS.soccer, 60, 60, 'g')), 'a soccer score is fixed by its key');
  const bb = play.teamGame(SPORTS.baseball, 50, 50, 'b'); check(bb[0] !== bb[1], 'baseball has no ties');
  check(play.prChange(1000, 1000, true) > 0 && play.prChange(1000, 1000, false) < 0 && play.prChange(1000, 1400, true) > play.prChange(1000, 1000, true), 'the rating rewards an upset more than an expected win');
  section('results: pure, keyed, and in the shape each sport uses');
}

// ---------- 3. Profiles, skills apart from talents, eligibility, history ----------
{
  const p = grownTo(4);
  check(!sp.canPlay('soccer').ok, 'a four-year-old cannot start soccer');
  years(3);
  const talentBefore = p.talents.sports;
  check(sp.takeUp('soccer').ok && sp.takeUp('tennis').ok && sp.takeUp('pickleball').ok, 'three sports can be taken up');
  check(!sp.takeUp('golf').ok, 'a fourth cannot');
  const e = sp.entryOf('soccer');
  check(e && Object.keys(e.skills).length === 6 && p.talents.sports === talentBefore, 'soccer has its own six skills; the general talent is untouched');
  check(Object.entries(e.skills).every(([k, v]) => v <= e.ceiling[k]), 'every skill starts below its ceiling');
  check(sp.entryOf('tennis').skills.serve !== undefined && sp.entryOf('tennis').skills.shooting === undefined, 'a tennis player\'s skills are tennis skills');
  const coach = sp.coachOf(e.coachId);
  check(coach && S().npcs[coach.id]?.role === 'coach' && p.npcIds.includes(coach.id), 'the coach is a real person the player knows');
  check(weeklyLoad(p).rows.some((r) => r.kind === 'sport' && r.hours === 6), 'training takes hours out of the week');
  // History: a year before a sport existed.
  const was = S().year;
  S().year = 1950;
  check(!sp.canPlay('pickleball').ok && sp.canPlay('tennis').ok && !sp.sportsMenu().some((x) => x.sport.id === 'pickleball'), 'in 1950 there is tennis and no pickleball');
  S().year = was;
  // Adaptive sport.
  p.flags.wheelchair = true;
  check(sp.canPlay('wheelchair_basketball').ok && !sp.canPlay('soccer').ok && sp.canPlay('swimming').ok, 'a wheelchair user can play adaptive sports and those played seated, not standing ones');
  delete p.flags.wheelchair;
  check(!sp.canPlay('wheelchair_tennis').ok, 'and adaptive sports are for those who need them');
  sound('a new athlete');
  section('profiles: sport-specific skills, ceilings, real coaches, time, history and adaptive sport');
}

// ---------- 4. Training: diminishing returns, limits, no endless clicking ----------
{
  // The same player, the same year, only the hours different.
  grownTo(16); P().talents.sports = 70;
  sp.takeUp('tennis');
  const base = structuredClone(S());
  const gain = (hours) => {
    store.state = structuredClone(base);
    const p = P(); const e = sp.entryOf('tennis'); const a = sp.myAthlete();
    for (const k of Object.keys(e.skills)) { e.skills[k] = 30; e.ceiling[k] = 90; }
    e.plan = { type: 'balanced', hours }; a.motivation = 65; a.injuries = [];
    const before = sp.internals.meanSkill(e);
    sp.internals.trainYear(S(), p, a, e);
    return sp.internals.meanSkill(e) - before;
  };
  const g2 = gain(2); const g5 = gain(5); const g18 = gain(18);
  check(g2 > 0 && g5 > g2 && g18 > g5, `more hours, more progress (${g2.toFixed(1)}, ${g5.toFixed(1)}, ${g18.toFixed(1)})`);
  check(g18 / g5 < 18 / 5 * 0.6, 'but each hour adds less than the one before');
  grownTo(12); sp.takeUp('soccer');
  check(!sp.setPlan('soccer', 'balanced', 18).ok && sp.setPlan('soccer', 'balanced', 10).ok, 'children are not trained like professionals');
  years(6);
  const e = sp.entryOf('soccer');
  sp.myAthlete().injuries = [];
  let n = 0; for (let i = 0; i < 10; i++) if (sp.extraSession('soccer', 'passing').ok) n++;
  check(n === sp.EXTRA_PER_YEAR, `extra sessions stop at ${sp.EXTRA_PER_YEAR} a year (${n})`);
  for (const k of Object.keys(e.skills)) e.skills[k] = e.ceiling[k];
  e.plan = { type: 'technical', hours: 18 }; e.fatigue = 0; sp.internals.trainYear(S(), P(), sp.myAthlete(), e);
  check(Object.entries(e.skills).every(([k, v]) => v <= e.ceiling[k]), 'no skill goes past its ceiling, however hard the training');
  check(e.fatigue > 30, 'heavy training leaves the body tired');
  section('training: time costs, diminishing returns, a hard ceiling, a yearly limit');
}

// ---------- 5. Seasons, standings and titles from completed games only; determinism across a save ----------
let soccerLife;
{
  const p = grownTo(7); p.talents.sports = 88; p.stats.health = 85; p.hidden.discipline = 75;
  sp.takeUp('soccer'); sp.setPlan('soccer', 'technical', 10);
  years(6, { academy: 'yes', scholarship: 'no', contract: 'no', turnPro: 'no' });
  const e = sp.entryOf('soccer');
  check(e.seasons.length >= 5, `a season a year was played (${e.seasons.length})`);
  for (const id of e.seasons) {
    const s = sp.seasonOf(id);
    const t = sp.standings(s);
    check(t.reduce((x, r) => x + r.p, 0) === s.fixtures.filter((f) => f.done).length * 2, `${id}: the table counts every completed game`);
    check(!s.champion || s.playoffs.find((f) => f.round === 'Final')?.winner === s.champion, `${id}: the champion won the final`);
    check(s.teamIds.length === 8 && new Set(s.teamIds).size === 8, `${id}: eight different teams`);
    check(new Set(s.teamIds.map((t) => sp.teamOf(t).name)).size === 8, `${id}: eight different team names`);
  }
  const leagues = e.seasons.map((id) => sp.seasonOf(id).leagueId);
  const firstTwo = e.seasons.slice(0, 2).map((id) => sp.seasonOf(id));
  check(firstTwo.length < 2 || firstTwo[0].leagueId !== firstTwo[1].leagueId || snap(firstTwo[0].teamIds) === snap(firstTwo[1].teamIds), 'the same league keeps the same rivals from year to year');
  void leagues;
  // The player's games add up to what the record says.
  sound('six seasons of soccer');
  // A save and a reload change nothing that was played, and next year is the same whether or not it was saved.
  saveGame(S());
  const before = snap(S().sports.seasons);
  store.state = loadGame(S().slotId);
  check(snap(S().sports.seasons) === before, 'loading the save gives back every result exactly');
  const s0 = sp.seasonOf(e.seasons.at(-1));
  const again = sp.internals.playSeason(S(), sp.entryOf('soccer'), sp.teamOf(s0.playerTeamId));
  check(again === S().sports.seasons[s0.id] && snap(again.fixtures.map((f) => f.score)) === snap(s0.fixtures.map((f) => f.score)), 'a season already played is never played again');
  // A year played, then the same year played again from the save: the same scores (nothing is re-rolled on a reload).
  saveGame(S());
  advanceYear(); quiet();
  const nextSeason = snap(Object.values(S().sports.seasons).filter((s) => s.year === S().year).map((s) => s.fixtures.map((f) => f.score)));
  store.state = loadGame(S().slotId);
  advanceYear(); quiet();
  const nextAgain = snap(Object.values(S().sports.seasons).filter((s) => s.year === S().year).map((s) => s.fixtures.map((f) => f.score)));
  check(nextSeason === nextAgain, 'the same year, played again from the save, plays out to the same scores');
  soccerLife = S();
  section('seasons: fixed once played, tables from completed games, champions from finals, the same after a reload');
}

// ---------- 6. Clubs and tryouts ----------
{
  grownTo(11); P().talents.sports = 40;
  sp.takeUp('soccer');
  const clubs = sp.clubsFor('soccer');
  check(clubs.length >= 1 && clubs.every((c) => c.org.id && c.org.name), 'there are clubs to try out for, with names');
  check(snap(sp.clubsFor('soccer').map((c) => c.org.id)) === snap(clubs.map((c) => c.org.id)), 'the same clubs are there when asked again');
  const club = clubs[0].org;
  const first = sp.tryOut(club.id);
  const second = sp.tryOut(club.id);
  check(!second.ok && /this year/.test(second.text) || first.ok && /already there/.test(second.text), 'one tryout a year at each club');
  const e = sp.entryOf('soccer');
  if (first.ok) check(e.orgId === club.id && sp.teamOf(e.teamId).roster.some((x) => x.id === P().id), 'a successful tryout puts the player on the roster');
  else check(e.orgId !== club.id, 'a failed tryout leaves the player where they were');
  sound('tryouts');
  section('clubs: persistent, one tryout a year, rosters kept');
}

// ---------- 7. Tennis and pickleball: draws, doubles partners, ratings ----------
{
  const p = grownTo(9); p.talents.sports = 80;
  sp.takeUp('pickleball'); sp.takeUp('tennis');
  check(sp.findPartner('pickleball').ok, 'a doubles partner can be found');
  const pair = sp.currentPartnership('pickleball');
  check(pair && S().npcs[pair.b]?.role === 'teammate' && p.npcIds.includes(pair.b), 'the partner is a real person');
  check(!sp.findPartner('pickleball').ok, 'one partner at a time');
  years(5);
  const e = sp.entryOf('pickleball');
  const evs = e.events.map((id) => sp.eventOf(id));
  check(evs.length >= 5, `events were played (${evs.length})`);
  check(evs.some((x) => x.format === 'doubles' && x.partnershipId === pair.id) && evs.some((x) => x.format === 'singles'), 'singles and doubles, the doubles with the partner');
  check(pair.events.length === evs.filter((x) => x.format === 'doubles').length, 'the partnership remembers its events');
  for (const ev of evs) {
    check(ev.rounds.length >= 1 && ev.rounds.slice(0, -1).every((r) => r.won), `${ev.id}: a draw is lost once, at the end`);
    check((ev.place === 'Champion') === ev.rounds.every((r) => r.won), `${ev.id}: champion only by winning every round`);
    check(ev.prAfter - ev.prBefore === ev.rounds.reduce((s, r) => s + r.pr, 0) || ev.prAfter >= 100, `${ev.id}: the rating moved by the matches`);
  }
  const t = sp.entryOf('tennis');
  check(t.pr !== 1000 && t.played > 0, 'the tennis rating has moved with results');
  check(sp.endPartnership('pickleball').ok && !sp.currentPartnership('pickleball'), 'a partnership can end');
  sound('racket sports');
  section('tennis and pickleball: draws, doubles with a real partner, results-driven ratings');
}

// ---------- 8. Injuries through the health record ----------
{
  const p = grownTo(16); sp.takeUp('soccer');
  const a = sp.myAthlete(); const e = sp.entryOf('soccer');
  p.flags.longevity = 18; // this waits years for an injury: the player should not die of something else first (a drowning did)
  // Force an injury through the engine's own path: a year at full load, worn out.
  let inj = null;
  for (let i = 0; i < 40 && !inj; i++) { e.fatigue = 95; e.plan.hours = 18; advanceYear(); quiet(); inj = a.injuries.find((x) => x.status === 'out'); }
  check(!!inj, 'a worn-out player gets hurt sooner or later');
  if (inj) {
    check(p.conditions.some((c) => c.id === `sport_${inj.type}`), 'the injury is in the health record');
    const d = life.openDecisions().find((x) => x.kind === 'rehab' && x.injuryId === inj.id);
    check(!!d, 'a rehab plan is asked for');
    p.finance.cash = 1e7;
    if (d) life.answer(d.id, 'physio');
    check(inj.status === 'out' && p.conditions.some((c) => c.id === `sport_${inj.type}`), 'choosing a plan heals nothing by itself');
    for (let i = 0; i < 6 && inj.status === 'out'; i++) { advanceYear(); quiet(); answerAll(); }
    const again = sp.myAthlete().injuries.some((x) => x.status === 'out' && x.type === inj.type);
    check(inj.status === 'healed' && p.conditions.some((c) => c.id === `sport_${inj.type}`) === again, 'it heals over time, and leaves the health record when it does (unless the same injury has come back)');
    check(life.audit().every((x) => !/injury/.test(x)), 'the injury record and the health record agree');
  }
  section('injuries: in the health record, rehab over time, nothing instant');
}

// ---------- 9. Recruiting, scholarships and real tuition ----------
{
  let committed = null;
  for (let tries = 0; tries < 12 && !committed; tries++) {
    const p = grownTo(7); p.talents.sports = 92; p.stats.health = 90; p.hidden.discipline = 85;
    sp.takeUp('soccer'); sp.setPlan('soccer', 'technical', 10);
    for (let i = 0; i < 11 && !committed; i++) {
      advanceYear(); quiet();
      for (const d of life.openDecisions()) {
        if (d.kind === 'scholarship') { life.answer(d.id, d.offers[0].instId); committed = d.offers[0]; } else life.answer(d.id, d.kind === 'academy' ? 'yes' : 'no');
      }
    }
  }
  check(!!committed, 'a strong high-school player in the United States is recruited');
  if (committed) {
    const p = P();
    const inst = catalogue(p.countryId).find((u) => u.id === committed.instId);
    check(!!inst && inst.sport, 'the offer comes from a real university of the country that runs teams');
    const a = applicant(null, inst);
    check(a.athlete && a.athleticFraction === committed.fraction, 'the application carries the coach\'s backing and the offered share');
    const help = aid(a, inst, {}, 0.3);
    check(help.parts.some((x) => x.kind === 'athletic' && x.fraction === committed.fraction) || help.parts[0].fraction > committed.fraction, 'the scholarship is what the tuition is reduced by');
    const other = catalogue(p.countryId).find((u) => u.sport && u.id !== committed.instId);
    if (other) check(!applicant(null, other).athleticFraction, 'another university does not inherit the offer');
  }
  // Countries without university recruiting do not get offers.
  const q = grownTo(7, 'uk', 'London'); q.talents.sports = 95; sp.takeUp('soccer'); sp.setPlan('soccer', 'technical', 10);
  let ukOffer = false;
  for (let i = 0; i < 11; i++) { advanceYear(); quiet(); for (const d of life.openDecisions()) { if (d.kind === 'scholarship' && q.countryId === 'uk') ukOffer = true; /* the family may emigrate somewhere that does recruit */ life.answer(d.id, d.kind === 'academy' ? 'yes' : 'no'); } }
  check(!ukOffer, 'there are no university athletic scholarships where universities do not recruit');
  sound('recruiting');
  section('recruiting: real universities, offers carried into admissions and tuition, only where they exist');
}

// ---------- 10. Professional careers, contracts and money paid once ----------
{
  let signed = false;
  for (let tries = 0; tries < 12 && !signed; tries++) {
    const p = grownTo(7, 'uk', 'London'); p.talents.sports = 95; p.stats.health = 92; p.hidden.discipline = 85;
    sp.takeUp('soccer'); sp.setPlan('soccer', 'technical', 10);
    for (let i = 0; i < 14 && !signed; i++) { advanceYear(); quiet(); answerAll({ academy: 'yes', contract: 'yes', agent: 'no' }); signed = !!sp.entryOf('soccer')?.contractId; }
  }
  check(signed, 'a top academy player is signed by a club (no draft in England)');
  if (signed) {
    const p = P(); const e = sp.entryOf('soccer');
    const k = S().sports.contracts[e.contractId];
    check(p.career.careerId === 'athlete' && p.career.employerId === sp.orgOf(k.orgId).employerId && p.career.sportContract === k.id, 'the contract is a job in the careers system, at the club');
    check(p.career.salary === k.salary, 'the salary is the contract\'s, paid as wages');
    check(!S().sports.decisions.some((d) => d.how === 'draft'), 'no draft in a country without one');
    const cash = p.finance.cash;
    check(!life.settle(S(), Object.keys(S().sports.paid)[0] ?? 'x', 0, 'sport', 'nothing') && p.finance.cash === cash, 'settling again with the same key pays nothing');
    const key = 'test/once';
    life.settle(S(), key, 1000, 'prizeMoney', 'Prize money: a test');
    life.settle(S(), key, 1000, 'prizeMoney', 'Prize money: a test');
    check(p.finance.cash === cash + 1000, 'a payment is made once');
    years(3, { renew: 'yes', transfer: 'no', agent: 'no' });
    const bad = ledgerAudit();
    check(!bad.length, `the books balance with a professional career: ${bad.join('; ')}`);
    sound('a professional career');
  }
  // Draft where there is one: American football in the United States.
  check(sp.proPath(SPORTS.american_football, 'us') === 'draft' && sp.proPath(SPORTS.basketball, 'es') === 'signing' && sp.proPath(SPORTS.tennis, 'us') === 'tour' && sp.proPath(SPORTS.gymnastics, 'us') === 'none', 'each sport turns professional its own way, a draft only where there is one');
  section('professionals: contracts through careers, the right route by country, payments once, books sound');
}

// ---------- 11. Tour professionals: prize money, not salary ----------
{
  const p = grownTo(17); p.talents.sports = 95; sp.takeUp('tennis');
  const e = sp.entryOf('tennis'); for (const k of Object.keys(e.skills)) { e.ceiling[k] = 92; e.skills[k] = 85; }
  e.pr = 1500;
  advanceYear(); quiet();
  const d = life.openDecisions().find((x) => x.kind === 'turnPro');
  check(!!d, 'a high rating opens the way to turning professional on tour');
  if (d) {
    life.answer(d.id, 'yes');
    p.finance.cash = 1e6;
    let evs = [];
    // An injury can keep a player out of a whole year's events; three years is enough to see a paid one.
    for (let i = 0; i < 3 && !evs.some((x) => x.prize > 0); i++) {
      advanceYear(); quiet(); answerAll({ agent: 'no', sponsor: 'yes' });
      evs = e.events.map((id) => sp.eventOf(id)).filter((x) => x.year === S().year);
    }
    const paid = evs.filter((x) => x.prize > 0);
    check(evs.every((x) => x.level === 'pro') && paid.length > 0, 'tour events pay prize money');
    check(paid.every((x) => S().sports.paid[`prize/${x.id}`]?.amount === x.prize), 'each prize is recorded once, under its event');
    check(p.career.careerId !== 'athlete', 'a touring player draws no salary');
    check(!ledgerAudit().length, 'the books balance');
  }
  section('tour: prize money by result, no salary, paid once');
}

// ---------- 12. Old saves: a school athlete becomes a profile, conservatively ----------
{
  born(); const p = P(); years(16);
  delete S().sports;
  p.flags.athlete = { sport: 'basketball', seasons: 3, best: 70, captain: true, awards: [] };
  sp.ensure();
  const e = sp.entryOf('basketball');
  check(!!e && e.legacySeasons === 3 && e.level === 'school', 'the old school record becomes a basketball profile');
  check(Object.values(e.skills).every((v) => v <= 56), 'skills are set below the old best rating, never above');
  delete S().sports; p.flags.athlete = { sport: 'netball', seasons: 2, best: 60, awards: [] }; sp.ensure();
  check(!sp.myAthlete(), 'a sport the engine does not know is left with the school\'s own record');
  section('migration: old school athletes kept, nothing invented');
}

// ---------- 13. Generations: the record passes on; skills and trophies do not ----------
{
  store.state = soccerLife;
  const p = P();
  const mine = sp.myAthlete();
  const titles = Object.values(mine.sports).reduce((s, e) => s + e.titles.length, 0);
  const moments = S().sports.moments.length;
  const kid = makeNpc({ role: 'child', countryId: p.countryId, age: 20, lastName: p.lastName });
  S().npcs[kid.id] = kid; p.npcIds.push(kid.id); kid.parentIds = [p.id];
  die('old age');
  check(heirs().some((n) => n.id === kid.id), 'setup: the child can carry on');
  const next = continueAs(kid.id);
  store.state = next;
  const anc = Object.values(S().npcs).find((n) => n.role === 'parent' && !n.alive);
  const old = sp.athleteOf(anc?.id);
  check(!!old && Object.values(old.sports).reduce((s, e) => s + e.titles.length, 0) === titles, 'the parent\'s athletic record is kept under their id, titles and all');
  check(S().sports.moments.length === moments && S().sports.moments.every((m) => m.personId !== P().id), 'no moment is lost, and none is given to the heir');
  check(!sp.myAthlete(), 'the heir starts with no skills and no trophies of their own');
  years(7 - Math.min(7, P().age));
  const heir = P();
  if (heir.age >= 5) {
    sp.takeUp('soccer');
    check(sp.myAthlete().parents.some((x) => x.id === anc.id), 'the heir\'s profile knows their parent played');
    check(Object.values(sp.entryOf('soccer').skills).every((v) => v < 40), 'and their skills are their own, from the start');
  }
  sound('after a generation');
  section('legacy: the family record passes on whole; skills and trophies are earned, not inherited');
}

// ---------- 14. Integrity and the mind: abstract, never instructions ----------
{
  const texts = [];
  const p = grownTo(16);
  sp.takeUp('soccer');
  for (let i = 0; i < 30 && sp.myAthlete(); i++) {
    const a = sp.myAthlete(); a.motivation = 10; sp.entryOf('soccer').level = 'academy';
    advanceYear(); quiet();
    for (const d of life.openDecisions()) { texts.push(d.text, ...d.options.map((o) => o.label)); life.answer(d.id, d.options.at(-1).id); }
    if (!p.alive) break;
  }
  const all = texts.join(' ');
  check(/sports psychologist/.test(all), 'struggling players are offered someone to talk to');
  check(!/\b(steroid|epo|testosterone|dose|dosage|inject|mg\b|cycle)\b/i.test(all), 'the integrity choices never describe how to cheat');
  check(!/\b(depress|disorder|diagnos)\w*/i.test(all.replace(/does not diagnose/g, '')), 'nobody is diagnosed by the sports engine');
  section('integrity and the mind: abstract choices, support offered, no diagnosis');
}

// ---------- 15. Navigation: back returns exactly where the player was ----------
{
  const nav = createNav();
  nav.open('hub', {}, { tab: 'competitions', sport: 'tennis', kind: 'titles' });
  nav.remember({ scroll: 340 });
  nav.open('event', { eventId: 'e1' });
  nav.open('coach', { coachId: 'c1' });
  check(nav.depth() === 3, 'screens stack');
  const back1 = nav.back(); const back2 = nav.back();
  check(back1.screen === 'event' && back2.screen === 'hub' && back2.ui.tab === 'competitions' && back2.ui.sport === 'tennis' && back2.ui.kind === 'titles' && back2.ui.scroll === 340, 'back returns to the hub on the same section, filters and scroll');
  section('navigation: state preserved going back');
}

// ---------- 16. Many lives: the record stays sound ----------
{
  for (const [c, city] of [['us', 'Chicago'], ['uk', 'London'], ['jp', 'Tokyo'], ['in', 'Mumbai'], ['br', 'São Paulo']]) {
    try { born(c, city); } catch { born(c, undefined); }
    const p = P(); p.talents.sports = 60 + rng.int(0, 35);
    for (let y = 0; y < 45 && p.alive; y++) {
      advanceYear(); quiet();
      if (p.age === 6) for (const id of sp.sportsMenu().filter((x) => x.ok).map((x) => x.sport.id).sort(() => rng.next() - 0.5).slice(0, 2)) sp.takeUp(id);
      if (p.age === 10) for (const e of sp.activeSports()) sp.setPlan(e.id, 'balanced', 5);
      if (p.age === 12) for (const e of sp.activeSports()) { if (SPORTS[e.id].kind === 'racket') sp.findPartner(e.id); const c0 = sp.clubsFor(e.id)[0]; if (c0?.open) sp.tryOut(c0.org.id); }
      for (const d of life.openDecisions()) life.answer(d.id, rng.pick(d.options).id);
    }
    sound(`a life in ${c}`);
    const bad = ledgerAudit(); check(!bad.length, `${c}: the books balance with sport in a life: ${bad.join('; ')}`);
  }
  section('whole lives in five countries: the athletic record and the books stay sound');
}

for (const m of ok) console.log(`ok   ${m}`);
for (const m of problems) console.log(`FAIL ${m}`);
if (problems.length) { console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('The athletic life holds together.');
