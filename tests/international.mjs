// International amateur signings in baseball (engine/international.js): trainers at 12 to 14, handshake deals, signing
// on January 15 at 16 with a bonus out of a pool and the trainer's share, the academy and the Dominican Summer League,
// the minors in the United States; deals falling through; Cuba. Run with: node tests/international.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { INTL_SIGNING } = await import('../js/data/sports.js');
const { ROOTS } = await import('../js/data/economy.js');
const sl = await import('../js/engine/sportsLife.js');
const sp = await import('../js/engine/sports.js');
const intl = await import('../js/engine/international.js');
ROOTS.familyLeaves = 0; // these lives stay where they began

const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;
const overall = (e) => sp.internals.overall(e, P());

/** A boy in `country`, grown to `age`, playing baseball; `boost` raises his skills when he takes it up at 7. A life
 *  that ends before then (rarely, a child dies) is begun again: these checks are about the ones who grow up. */
function boy(country, age, boost = 0, talent = 92) {
  for (;;) {
    let s; do { s = createLife({ countryId: country, gender: 'male' }); } while (s.player.royal);
    store.state = s;
    s.player.talents.sports = talent; s.player.potential = { ...(s.player.potential ?? {}), sports: talent }; s.player.stats.intellect = 60; // the gift too: an ordinary boy is ordinary through and through
    for (let i = 0; i < 7; i++) { s.player.stats.health = 95; advanceYear(); s.pendingEvents = []; }
    sp.takeUp('baseball');
    const e = sp.entryOf('baseball');
    if (!e) continue;
    for (const k of Object.keys(e.skills)) e.skills[k] = Math.min(e.ceiling[k], e.skills[k] + boost);
    e.plan = { type: 'balanced', hours: 10 };
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
    const c = typeof pick[d.kind] === 'function' ? pick[d.kind](d) : pick[d.kind] ?? (d.options.some((o) => o.id === 'no') ? 'no' : d.options.at(-1).id);
    if (c != null) sl.answer(d.id, c);
  }
  return seen;
}
const firstClub = (d) => d.options[0].id;
const paid = (prefix) => Object.entries(S().sports.paid).filter(([k]) => k.startsWith(prefix)).map(([, v]) => v.amount);

// ---------- 1. The trainer ----------
{
  const e = boy('do', 11, 6);
  let offered = null;
  for (let i = 0; i < 4 && !offered; i++) offered = year({ buscon: 'full', handshake: 'no' }).find((d) => d.kind === 'buscon');
  const T = e.intl?.trainer;
  check(offered && P().age >= 12 && P().age <= 15, `a trainer comes for a promising boy of 12 to 14 (offered at ${P().age}: ${!!offered})`);
  check(T && T.cut >= INTL_SIGNING.cut[0] && T.cut <= INTL_SIGNING.cut[1] && /bonus/.test(offered?.text ?? ''), 'and says what share of the bonus he will take (20–35%)');
  check(T && S().npcs[T.npcId]?.gender === 'male' && P().npcIds.includes(T.npcId) && /buscón/.test(S().npcs[T.npcId].flags.title), 'the buscón is a person in the player\'s life');
  const ed = P().education;
  const gpa = ed.gpa;
  year({ handshake: 'no' });
  check(ed.droppedOut || !ed.enrolled || (ed.gpa ?? 0) < (gpa ?? 4), 'training full time costs school: the boy leaves it, or his grades fall');
}
{
  const e = boy('do', 11, 0, 30);
  for (let i = 0; i < 4; i++) year({ buscon: 'full' });
  check(!e.intl?.trainer, 'an ordinary player is not taken in by a trainer');
  const us = boy('us', 13, 10);
  check(!intl.intlPath(S(), 'baseball') && !us.intl, 'in the United States players are drafted, not signed as international amateurs');
}
section('trainers take in boys of 12 to 14, for a share of the bonus; full time costs school');

// ---------- 2. Handshake, signing day, the academy ----------
let signedLife = null;
for (let tries = 0; tries < 6 && !signedLife; tries++) {
  const e = boy('do', 11, 6);
  let shook = null;
  let signing = null;
  for (let i = 0; i < 8 && P().alive && P().age < 16 && !signing; i++) {
    const seen = year({ buscon: 'part', handshake: 'yes', intlSign: firstClub });
    shook ??= seen.find((d) => d.kind === 'handshake');
    signing = seen.find((d) => d.kind === 'intlSign');
  }
  if (!signing) signing = year({ intlSign: firstClub }).find((d) => d.kind === 'intlSign');
  if (shook && signing && e.intl.signed) signedLife = { e, shook, signing };
}
{
  const { e, shook, signing } = signedLife ?? {};
  check(signedLife, 'a promising boy shakes on a deal at 13 to 15, and signs at 16');
  if (signedLife) {
    const X = e.intl;
    check(/handshake/.test(shook.text) && /nothing holds/.test(shook.text), 'the handshake is told for what it is: against the rules and binding no one');
    check(P().age === 16 && /January 15/.test(signing.text), `the signing period opens on January 15, at 16 (signed at ${P().age})`);
    check(X.signed.bonus > 0 && paid('intlBonus/').length === 1 && paid('intlBonus/')[0] === X.signed.bonus, 'the bonus is paid once');
    check(X.trainer && X.signed.toTrainer === Math.round(X.signed.bonus * X.trainer.cut) && paid('trainerCut/')[0] === -X.signed.toTrainer, 'and the trainer takes his share of it, once');
    const club = sp.orgOf(X.signed.orgId);
    check(club?.countryId === 'us' && Object.values(S().sports.orgs).find((x) => x.kind === 'league' && x.teamIds.includes(club.teamIds[0]))?.teamIds.length === 30, 'the club is one of the 30 big league clubs, in the United States');
    check(e.contractId && e.level === 'pro' && P().career.sportContract === e.contractId, 'signing is a professional contract');
    const m = e.minor;
    const dsl = m && sp.orgOf(m.orgId);
    check(m && (m.ladder[m.level] === 'Dominican Summer League' ? dsl.countryId === 'do' : m.level > 0), `a 16-year-old starts at the academy and the Dominican Summer League (${m && m.ladder[m.level]})`);
    // The minors: up the ladder when good enough.
    const before = m?.level ?? 0;
    for (const k of Object.keys(e.skills)) e.skills[k] = e.ceiling[k] = Math.max(e.skills[k], 70);
    for (let i = 0; i < 4 && e.minor?.level === before; i++) year({});
    check(!e.minor || e.minor.level > before, 'a player better than his level goes up it');
  }
}
section('handshake deals at 13 to 15, signing on January 15 at 16, the bonus and the trainer\'s share, the academy and the DSL');

// ---------- 3. Deals fall through ----------
{
  let broke = null;
  for (let tries = 0; tries < 6 && !broke; tries++) {
    const e = boy('do', 11, 6);
    for (let i = 0; i < 6 && P().alive && P().age < 15 && !e.intl?.deal; i++) year({ buscon: 'part', handshake: 'yes' });
    if (!e.intl?.deal) continue;
    // He stops growing: the club backs out.
    for (const k of Object.keys(e.skills)) { e.skills[k] = Math.max(1, e.skills[k] - 20); e.ceiling[k] = e.skills[k]; }
    year({ handshake: 'no' });
    if (P().age < 16 || e.intl.fellThrough.length) broke = e;
  }
  check(broke && broke.intl.fellThrough.length === 1 && !broke.intl.deal && /backed out/.test(broke.intl.fellThrough[0].why), 'a boy who stops growing loses his handshake deal');
}
section('handshake deals fall through');

// ---------- 4. Venezuela; older signings ----------
{
  check(intl.bonusFor(S(), 64, 16) > intl.bonusFor(S(), 56, 16) && intl.bonusFor(S(), 56, 16) > intl.bonusFor(S(), 56, 18) && intl.bonusFor(S(), 45, 16) === 0, 'the better the boy the bigger the bonus; older signings are paid less; some are not signed at all');
  let signed = null;
  for (let tries = 0; tries < 4 && !signed; tries++) {
    const e = boy('ve', 15, 12);
    for (let i = 0; i < 3 && !e.intl?.signed; i++) year({ buscon: 'no', handshake: 'no', intlSign: firstClub });
    if (e.intl?.signed) signed = e;
  }
  check(signed, 'a Venezuelan boy signs too');
  const m = signed?.minor;
  check(!m || m.ladder[m.level] !== 'Dominican Summer League' || sp.orgOf(m.orgId).countryId === 'do', 'and plays the Dominican Summer League in the Dominican Republic');
  // A Dominican too good to ignore is not signed by a club at home before 23.
  const e = boy('do', 17, 0, 60);
  check(!Object.values(S().sports.contracts).some((k) => k.personId === P().id && k.kind === 'pro' && sp.orgOf(k.orgId)?.countryId === 'do'), 'no home club signs a Dominican prospect before the big league clubs can');
  void e;
}
section('Venezuela; bonuses by skill and age; no home signings for prospects');

// ---------- 5. Cuba ----------
{
  const e = boy('cu', 13, 8);
  for (let i = 0; i < 5; i++) year({ buscon: 'full', handshake: 'yes', leaveCuba: 'no' });
  check(e.intl && !e.intl.trainer && !e.intl.deal && !e.intl.signed, `in Cuba there is no trainer, no handshake and no signing`);
  for (const k of Object.keys(e.skills)) e.skills[k] = e.ceiling[k] = Math.max(e.skills[k], 68);
  let asked = null;
  for (let i = 0; i < 3 && !e.intl.left; i++) asked = year({ leaveCuba: 'yes', intlSign: firstClub }).find((d) => d.kind === 'leaveCuba') ?? asked;
  check(asked && /third country/.test(asked.text) && e.intl.left, 'a Cuban player must leave Cuba, and settle elsewhere, to sign');
  check(e.intl.signed && sp.orgOf(e.intl.signed.orgId).countryId === 'us', 'once he has left, a big league club signs him');
}
section('Cuba: leaving first');

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(' ✗', p);
  process.exit(1);
}
for (const m of ok) console.log(' ✓', m);
console.log('International signings hold together.');
