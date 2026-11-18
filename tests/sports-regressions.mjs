// Bugs found in review of the athletic life, each kept fixed by a check here.
// Run with: node tests/sports-regressions.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { CAREER_BY_ID } = await import('../js/data/careers.js');
const career = await import('../js/engine/career.js');
const { continueAs, heirs } = await import('../js/engine/legacy.js');
const { die } = await import('../js/engine/death.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { ILLNESSES } = await import('../js/data/illnesses.js');
const edu = await import('../js/engine/education.js');
const sp = await import('../js/engine/sports.js');
const life = await import('../js/engine/sportsLife.js');
const fam = await import('../js/engine/sportsFamily.js');
const { tickHealth } = await import('../js/engine/health.js');
const ui = await import('../js/ui/sports.js');

rng.seed(20261118);
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const caseOf = (name, fn) => { const n = problems.length; try { fn(); } catch (err) { problems.push(`${name}: threw ${err.stack.split('\n').slice(0, 2).join(' | ')}`); } ok.push(problems.length === n ? name : `(failed) ${name}`); };
const S = () => store.state; const P = () => store.state.player;
function year(pref = {}) { advanceYear(); S().pendingEvents = []; for (const d of life.openDecisions()) if (pref[d.kind] !== 'skip') life.answer(d.id, pref[d.kind] && d.options.some((o) => o.id === pref[d.kind]) ? pref[d.kind] : d.options.at(-1).id); }
function years(n, pref) { for (let i = 0; i < n && P().alive; i++) year(pref); }
function grownTo(age, countryId = 'uk', city = 'London', setup = () => {}) {
  for (;;) { store.state = createLife({ countryId, city }); if (P().royal) continue; setup(P()); years(age, { integrity: 'refuse' }); if (P().alive && P().age === age && !P().legal?.incarceration) return P(); }
}
const able = (p) => { p.talents.sports = 92; p.stats.health = Math.max(p.stats.health, 85); p.hidden.discipline = 80; };
const maxOut = (e, v) => { for (const k of Object.keys(e.skills)) { e.ceiling[k] = Math.max(e.ceiling[k], v + 5); e.skills[k] = v; } };
/** A professional soccer player, signed through the engine's own routes. */
function pro() {
  for (;;) {
    grownTo(16, 'uk', 'London', able);
    sp.takeUp('soccer'); const e = sp.entryOf('soccer'); maxOut(e, 80); sp.setPlan('soccer', 'technical', 10);
    for (let i = 0; i < 6 && !e.contractId && P().alive; i++) year({ academy: 'yes', contract: 'yes', agent: 'no', integrity: 'refuse' });
    if (e.contractId && P().alive) return e;
  }
}
const activePro = () => Object.values(S().sports.contracts).filter((k) => k.kind === 'pro' && k.status === 'active' && k.personId === P().id);

caseOf('taking another job ends the sports contract; the new job is not given an athlete\'s title', () => {
  const e = pro();
  career.hire(CAREER_BY_ID.software ?? CAREER_BY_ID.office, 0, 60, 'Hired.');
  year({ integrity: 'refuse' });
  check(activePro().length === 0 && !e.contractId, 'the contract ended');
  check(P().career.careerId !== 'athlete' && !/player|starter/i.test(P().career.title), `the new job keeps its own title (${P().career.title})`);
});

caseOf('an offer cannot be signed by someone who stopped playing', () => {
  let d = null;
  for (let t = 0; t < 30 && !d; t++) {
    grownTo(16, 'uk', 'London', able); sp.takeUp('soccer'); maxOut(sp.entryOf('soccer'), 80);
    for (let i = 0; i < 6 && !d; i++) { year({ contract: 'skip', academy: 'yes', integrity: 'refuse' }); d = life.openDecisions().find((x) => x.kind === 'contract'); }
  }
  check(!!d, 'setup: an offer is open');
  if (!d) return;
  sp.giveUp('soccer');
  const r = life.answer(d.id, 'yes');
  check(!r.ok && activePro().length === 0 && P().career.careerId !== 'athlete', 'the club does not sign a player who has stopped');
});

caseOf('a renewal answered after leaving the club changes nothing', () => {
  const e = pro();
  let d = null;
  for (let i = 0; i < 6 && !d; i++) { year({ renew: 'skip', transfer: 'no', integrity: 'refuse' }); d = life.openDecisions().find((x) => x.kind === 'renew'); }
  check(!!d, 'setup: a renewal is offered');
  if (!d) return;
  career.quitCareer();
  career.hire(CAREER_BY_ID.software ?? CAREER_BY_ID.office, 0, 60, 'Hired.');
  const pay = P().career.salary;
  const r = life.answer(d.id, 'yes');
  check(!r.ok && P().career.salary === pay && activePro().length === 0 && !e.contractId, 'the new job\'s pay is untouched, and the contract is over');
});

caseOf('a professional cannot be moved into an academy', () => {
  const e = pro();
  const academy = sp.internals.findOrg(S(), sp.SPORTS.soccer, 'academy');
  S().sports.decisions.push({ id: 'dec_test', key: 'test/academy', kind: 'academy', sportId: 'soccer', orgId: academy.id, year: S().year, status: 'open', text: '', options: [{ id: 'yes' }, { id: 'no' }] });
  life.answer('dec_test', 'yes');
  check(e.contractId && sp.orgOf(e.orgId).level === 'pro', 'still at the professional club');
});

caseOf('the school team is left when the player leaves it or leaves school', () => {
  let e = null;
  for (let t = 0; t < 20 && !e?.orgId; t++) {
    const p = grownTo(14, 'us', 'Chicago', able); p.education.sport = 'soccer';
    if (edu.joinClub('sports_team').ok) { year(); year(); e = sp.entryOf('soccer'); if (sp.orgOf(e?.orgId)?.kind !== 'school') e = null; }
  }
  check(!!e, 'setup: on a school team');
  if (!e) return;
  edu.quitClub('sports_team');
  year();
  check(sp.orgOf(e.orgId)?.kind !== 'school' && !e.schoolTeamId, 'off the school team after leaving it');
  const now = e.seasons.map((id) => sp.seasonOf(id)).filter((s) => s.year === S().year);
  check(now.every((s) => s.level !== 'school'), 'and no school-league season is played');
});

caseOf('a club player on the school team keeps their club', () => {
  let e = null;
  for (let t = 0; t < 20 && !e; t++) {
    const p = grownTo(14, 'us', 'Chicago', able); p.education.sport = 'soccer';
    sp.takeUp('soccer'); const x = sp.entryOf('soccer'); maxOut(x, 60);
    const club = sp.clubsFor('soccer').find((c) => c.org.level === 'club' && c.open);
    if (club && sp.tryOut(club.org.id).ok && edu.joinClub('sports_team').ok) e = x;
  }
  check(!!e, 'setup: a club player who made the school team');
  if (!e) return;
  const club = e.orgId;
  year({ academy: 'no' });
  check(e.orgId === club && sp.orgOf(e.orgId).level === 'club', 'the club is kept; the school team is a second team');
});

caseOf('an injury keeps the player out of their own games, playoffs included', () => {
  grownTo(17, 'uk', 'London', able); sp.takeUp('soccer'); const e = sp.entryOf('soccer'); maxOut(e, 70);
  year();
  S().year += 1;
  const s = sp.internals.playSeason(S(), e, sp.teamOf(e.teamId), { injury: { from: 0, to: 100 } });
  check([...s.fixtures, ...s.playoffs].every((f) => !f.me?.played), 'out for the whole season means no game played');
});

caseOf('turning professional is asked again after "not now", and asked of an heir', () => {
  grownTo(18, 'us', 'Chicago', able); sp.takeUp('tennis'); const e = sp.entryOf('tennis'); maxOut(e, 80);
  let asked = 0;
  for (let i = 0; i < 3; i++) { e.pr = Math.max(e.pr, 1500); advanceYear(); S().pendingEvents = []; for (const d of life.openDecisions()) { if (d.kind === 'turnPro') asked++; life.answer(d.id, 'no'); } }
  check(asked >= 2, `asked in more than one year (${asked})`);
});

caseOf('after a generation, the heir\'s coach is a person they know', () => {
  grownTo(30, 'uk', 'London', able); sp.takeUp('soccer'); years(2);
  const kid = makeNpc({ role: 'child', countryId: P().countryId, age: 10, lastName: P().lastName }); kid.parentIds = [P().id]; S().npcs[kid.id] = kid; P().npcIds.push(kid.id);
  die('a test');
  check(heirs().some((n) => n.id === kid.id), 'setup: the child carries on');
  store.state = continueAs(kid.id);
  check(S().sports.acts.extra === 0, 'the parent\'s extra sessions are not the heir\'s');
  sp.takeUp('soccer');
  const c = sp.entryOf('soccer').coachId;
  check(S().npcs[c]?.alive && P().npcIds.includes(c), 'the coach is a person in the heir\'s life');
});

caseOf('no competing from prison', () => {
  grownTo(20, 'uk', 'London', able); sp.takeUp('soccer'); year();
  const e = sp.entryOf('soccer');
  const before = e.seasons.length;
  P().legal.incarceration = { years: 3, served: 0, facility: 'test' };
  check(!sp.canPlay('tennis').ok, 'no new sport from prison');
  try { year(); } catch { /* the justice tick may expect more; the sports tick ran first */ }
  check(e.seasons.length === before, 'no season played from prison');
});

caseOf('leaving a university team sticks, and giving up the sport ends the athletic scholarship', () => {
  let p;
  do p = grownTo(19, 'us', 'Chicago', able); while (p.countryId !== 'us'); // a family that emigrated is somewhere universities do not recruit
  sp.takeUp('soccer'); maxOut(sp.entryOf('soccer'), 70);
  const inst = (S().universities ? Object.values(S().universities) : []).find((u) => u.countryId === 'us');
  void inst;
  p.education.enrolled = false; p.education.stage = 'none';
  edu.enrol('university', 'business', 'self', {}, { id: 'uni_us_1', name: 'Test University', aid: { fraction: 0.75, parts: [{ kind: 'athletic', fraction: 0.75 }], keep: 0 } });
  p.flags.sportOffers = [{ instId: 'uni_us_1', name: 'Test University', fraction: 0.75, sportId: 'soccer', accepted: true }];
  year({ contract: 'no' });
  const e = sp.entryOf('soccer');
  check(sp.orgOf(e.orgId)?.kind === 'college', 'setup: on the university team');
  sp.giveUp('soccer');
  check(!(p.education.aidParts ?? []).some((x) => x.kind === 'athletic') && p.education.aid < 0.75, 'giving up the sport ends the athletic part of the scholarship');
  sp.takeUp('soccer'); maxOut(sp.entryOf('soccer'), 70);
  year({ contract: 'no' });
  check(sp.orgOf(sp.entryOf('soccer').orgId)?.kind !== 'college', 'and the player is not put back on the team without asking');
});

caseOf('a doubles partner who has died ends the partnership', () => {
  grownTo(20, 'us', 'Chicago', able); sp.takeUp('pickleball'); sp.findPartner('pickleball');
  const pair = sp.currentPartnership('pickleball');
  S().npcs[pair.b].alive = false;
  check(!sp.currentPartnership('pickleball') && pair.until === S().year && sp.findPartner('pickleball').ok, 'the partnership ends, and a new partner can be found');
});

caseOf('parents\' past titles are not in the future; never-drawn injuries do not use the dice', () => {
  for (let t = 0; t < 30; t++) {
    store.state = createLife({ countryId: 'us', city: 'Chicago' });
    fam.familyPast(S());
    for (const a of Object.values(S().sports?.athletes ?? {})) for (const e of Object.values(a.sports)) for (const x of e.titles) check(x.year <= S().year && x.year <= e.retiredYear, 'a past title is in the past');
  }
  const zero = ILLNESSES.filter((i) => !i.chance);
  check(zero.length >= 6, 'setup: the sports injuries are in the list');
  // The yearly health roll draws for each illness that can happen; one that never can draws nothing.
  store.state = createLife({ countryId: 'us', city: 'Chicago' });
  const real = rng.chance; let zeros = 0;
  rng.chance = (x) => { if (x === 0) zeros++; return real.call(rng, x); };
  try { tickHealth(); } finally { rng.chance = real; }
  check(zeros === 0, `no roll is made for an illness that cannot happen (${zeros})`);
});

caseOf('the money screen shows only this life\'s payments', () => {
  grownTo(25, 'us', 'Chicago', able); sp.takeUp('tennis'); P().finance.cash = 1e6; years(2);
  life.settle(S(), 'test/parent-prize', 5000, 'prizeMoney', 'Prize money: a test');
  const kid = makeNpc({ role: 'child', countryId: P().countryId, age: 18, lastName: P().lastName }); kid.parentIds = [P().id]; S().npcs[kid.id] = kid; P().npcIds.push(kid.id);
  die('a test');
  store.state = continueAs(kid.id);
  sp.takeUp('tennis');
  const out = ui.internals.SCREENS.hub({ screen: 'hub', params: {}, ui: { tab: 'money' } });
  check(/Prize money, all time/.test(out.body) && !/5,000/.test(out.body.split('Payments')[0]) && /None yet/.test(out.body), 'the heir sees none of the parent\'s payments as their own');
});

for (const m of ok) console.log(`ok   ${m}`);
for (const m of problems) console.log(`FAIL ${m}`);
if (problems.length) { console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('The bugs found in review stay fixed.');
