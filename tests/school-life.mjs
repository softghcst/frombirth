// The school screen's engine: cliques (who will have you, and the ways in), the nurse, the school dance, the new clubs,
// sports teams, and drama counting toward acting. Run with: node tests/school-life.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { deathRoll } = await import('../js/engine/death.js');
const cl = await import('../js/engine/cliques.js');
const edu = await import('../js/engine/education.js');
const ent = await import('../js/engine/entertainment.js');
const { CLIQUES, CLUB_BY_ID } = await import('../js/data/schools.js');

rng.seed(20261122);
deathRoll.spared = true;
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); };
const year = () => { const p = store.state.player; p.stats.health = Math.max(p.stats.health, 80); advanceYear(); store.state.pendingEvents = []; };
const teen = (age = 13) => {
  let s; do { s = createLife({ countryId: 'us' }); } while (s.player.royal);
  store.state = s;
  while (s.player.age < age) year();
  return s.player;
};

check(CLIQUES.length >= 12 && CLIQUES.every((c) => c.who && c.desc), `a dozen cliques, each saying who it is for (${CLIQUES.length})`);
check(['math_club', 'book_club', 'astronomy', 'animal_rights', 'gaming_club', 'drama', 'musical_theater'].every((id) => CLUB_BY_ID[id]), 'the new clubs are there, with drama and musical theater');

// Who fits where: an athlete with no interest in books suits the jocks, not the nerds; a bookworm the reverse.
{
  const p = teen();
  check(cl.inCliqueYears(), `cliques from middle school (${p.education.stage})`);
  p.talents.sports = 85; p.stats.intellect = 35;
  const jock = cl.fitOf('athletes').fit; const nerd = cl.fitOf('brains').fit;
  check(jock > nerd + 0.2, `an athlete fits the jocks (${jock.toFixed(2)}) far better than the nerds (${nerd.toFixed(2)})`);
  p.talents.sports = 20; p.stats.intellect = 92;
  check(cl.fitOf('brains').fit > cl.fitOf('athletes').fit + 0.2, 'a bookworm the other way round');
  check(cl.fitOf('athletes').why, `and the jocks say why not (${cl.fitOf('athletes').why})`);
  p.talents.sports = 75; p.stats.intellect = 55;
  p.education.clique = 'brains';
  const withRival = cl.fitOf('athletes').fit;
  p.education.clique = null;
  check(withRival < cl.fitOf('athletes').fit, 'sitting with a rival crowd counts against you');
  p.education.standing = 20; const low = cl.fitOf('populars').fit; p.education.standing = 90;
  check(cl.fitOf('populars').fit > low, 'the popular kids care how popular you are');
}

// The ways in: hanging out warms them up; asking can work; twice a year; a leader who is a real classmate.
{
  const p = teen();
  p.talents.sports = 90; p.stats.intellect = 40; p.education.standing = 70; p.stats.charm = 70;
  const leader = cl.leaderOf('athletes');
  check(leader && leader.role === 'classmate', 'each clique is run by a real classmate');
  const before = cl.fitOf('athletes').fit;
  cl.cliqueAct('athletes', 'hangout');
  check(cl.fitOf('athletes').fit > before || p.education.clique === 'athletes', 'hanging out with them makes them likelier to take you');
  let tries = 0;
  while (p.education.clique !== 'athletes' && tries++ < 8) { cl.cliqueAct('athletes', 'ask'); if (p.education.clique !== 'athletes') year(); }
  check(p.education.clique === 'athletes', 'a sporty, popular kid gets in with the jocks in the end');
  check(cl.cliqueAct('athletes', 'ask').ok === false, 'and cannot join twice');
  check(cl.cliqueAct('athletes', 'leave').ok && p.education.clique == null, 'and can leave');
  cl.cliqueAct('band', 'compliment'); cl.cliqueAct('band', 'compliment');
  check(!cl.cliqueAct('band', 'compliment').ok, 'two things a year with cliques');
  const pop = p.education.standing; const rel = cl.leaderOf('populars').meters.relationship;
  year();
  cl.cliqueAct('populars', 'insult');
  check(cl.leaderOf('populars').meters.relationship < rel, 'insulting the leader costs you with them, whatever the room thinks');
  void pop;
}

// The nurse and the dance, once a year each.
{
  const p = teen();
  check(cl.nurse().ok && !cl.nurse().ok, 'the nurse, once a year');
  check(cl.schoolDance().ok && !cl.schoolDance().ok, 'the dance, once a year');
  const kid = teen(8);
  check(!cl.schoolDance().ok, 'no dances in elementary school');
  void p; void kid;
}

// Drama and musical theater count toward acting.
{
  const p = teen(15);
  const before = ent.stageShows(p);
  p.education.clubs.push('drama');
  p.flags.performances = [{ year: 2030, age: 14, show: 'A Midsummer Night\'s Dream', role: 'lead', where: 'school' }];
  check(ent.stageShows(p) === before + 2, `school shows and the drama club count as stage experience (${ent.stageShows(p)})`);
}

// A new school is announced; prom royalty in the last year; a house party in high school.
{
  let s; do { s = createLife({ countryId: 'us' }); } while (s.player.royal);
  store.state = s;
  let seen = null;
  while (s.player.age < 12 && !seen) { advanceYear(); seen = s.pendingEvents.find((e) => e.id === 'school_start' && /Middle/i.test(e.cast.words.stage)); s.pendingEvents = []; }
  check(seen && seen.cast.words.school && seen.cast.words.years === '3', `starting middle school is announced, with its name and years (${JSON.stringify(seen?.cast.words)})`);
  const p = teen(17);
  const { decide } = await import('../js/engine/schoollife.js');
  p.stats.intellect = 99; p.education.standing = 95;
  let wins = 0;
  for (let i = 0; i < 20; i++) { delete p.education.prom; decide('promSmart', { words: { title: 'queen', school: 'Lincoln High' } }); if (p.education.prom.won) wins++; }
  check(wins >= 12, `a brilliant, popular student usually wins with the smart pitch (${wins} of 20)`);
  check(p.milestones.some((m) => /Crowned prom queen at Lincoln High/.test(m.text)), 'the crown is a milestone, with the right title');
  p.stats.intellect = 15; p.education.standing = 20;
  let low = 0;
  for (let i = 0; i < 20; i++) { decide('promSmart', { words: { title: 'queen', school: 'Lincoln High' } }); if (p.education.prom.won) low++; }
  check(low < wins, `the wrong pitch from an unpopular student mostly loses (${low} of 20)`);
  check(cl.houseParty().ok !== undefined && !cl.houseParty().ok, 'a house party, once a year');
  teen(12);
  check(!cl.houseParty().ok, 'not in middle school');
}

if (problems.length) { console.log(`${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('School is a place with people in it.');
