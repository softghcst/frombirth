// School clubs (engine/schoollife.js): every club's standing can grow, by the year and by what the player does in it;
// each thing once a year; standing for leader; and performing in any of them builds stage presence.
// Run with: node tests/school-clubs.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const life = await import('../js/engine/schoollife.js');
const { CLUBS } = await import('../js/data/schools.js');
const { CLUB_KIND } = await import('../js/data/education.js');
const kpop = await import('../js/engine/kpop.js');

rng.seed(7);
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m, n) => ok.push(problems.length === n ? m : `(failed) ${m}`);
const P = () => store.state.player;
/** A child who has grown up to this age for real, so they are at school. */
function kid(age = 13) {
  for (;;) {
    do { store.state = createLife({ countryId: 'us' }); } while (P().royal);
    while (P().alive && P().age < age) { advanceYear(); store.state.pendingEvents = []; }
    const p = P();
    if (p.alive && p.education.enrolled && !p.legal.incarceration) { p.education.clubs = []; return p; }
  }
}

{
  const n = problems.length;
  check(CLUBS.every((c) => CLUB_KIND[c.id]), `every school club has a kind, so its standing moves (${CLUBS.filter((c) => !CLUB_KIND[c.id]).map((c) => c.id).join(', ')})`);
  // Dance classes and the musical theater company were stuck at their first standing for good.
  const p = kid(12);
  p.education.clubs = ['dance_class', 'musical_theater'];
  p.talents.dance = 80; p.talents.singing = 80; p.talents.acting = 80;
  p.education.clubLife = { dance_class: { since: 11, standing: 12, role: 'member', record: [] }, musical_theater: { since: 11, standing: 12, role: 'member', record: [] } };
  for (let i = 0; i < 2 && P().alive; i++) { advanceYear(); store.state.pendingEvents = []; }
  const cl = P().education.clubLife;
  if (P().education.clubs.includes('dance_class')) check(cl.dance_class.standing > 12, `dance classes: standing grows with the years (${cl.dance_class.standing})`);
  if (P().education.clubs.includes('musical_theater')) check(cl.musical_theater.standing > 12, `the musical theater company: standing grows with the years (${cl.musical_theater.standing})`);
  section('every club\'s standing moves with the years', n);
}

{
  const n = problems.length;
  const p = kid(13);
  p.education.clubs = ['choir'];
  p.talents.singing = 70;
  const stage0 = kpop.skillsOf().stage;
  const acts = life.clubActions('choir').map((a) => a.id);
  check(acts.includes('practice') && acts.includes('help') && acts.includes('feature'), `a choir member can rehearse, help and ask for a solo (${acts})`);
  const s0 = life.activities().clubs[0].standing;
  check(life.clubAct('choir', 'practice').ok && life.clubAct('choir', 'help').ok, 'rehearsing and helping work');
  check(life.activities().clubs[0].standing > s0, 'and raise the standing in the club');
  check(!life.clubAct('choir', 'practice').ok && life.clubActions('choir').find((a) => a.id === 'practice').done, 'each thing once a year');
  life.clubAct('choir', 'feature');
  check(kpop.skillsOf().stage > stage0, `performing builds stage presence outside idol life (${stage0} to ${kpop.skillsOf().stage})`);
  // Standing for leader: only with some standing, and from 12.
  p.education.clubLife.choir.standing = 95; p.stats.charm = 90;
  check(life.clubActions('choir').some((a) => a.id === 'lead'), 'a member with standing can stand for leader');
  let led = false;
  for (let i = 0; i < 10 && !led; i++) { p.education.clubActs = null; life.clubAct('choir', 'lead'); led = p.education.clubLife.choir.role === 'leader'; p.education.clubLife.choir.standing = 95; }
  check(led && life.activities().clubs[0].role !== 'Member', 'standing for leader can win');
  check(!life.clubActions('choir').some((a) => a.id === 'lead'), 'and a leader does not stand again');
  check(!life.clubActions('chess').length, 'nothing to do in a club you are not in');
  section('things to do in a club: practice, help, a solo, standing for leader; stage presence from performing', n);
}

for (const m of ok) console.log(`ok   ${m}`);
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'Clubs are something to do.');
process.exit(problems.length ? 1 : 0);
