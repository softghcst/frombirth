// Clubs and classes: what is open at what age and in what year, joining and leaving, dues each year, what a year adds,
// friends made there, standing for the committee and to run it, and memberships that lapse. Run with: node tests/clubs.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k) };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { deathRoll } = await import('../js/engine/death.js');
const { saveGame, loadGame } = await import('../js/save.js');
const cl = await import('../js/engine/clubs.js');
const { CLUBS, CLUB_BY_ID, MAX_CLUBS } = await import('../js/data/clubs.js');
const { SKILL_BY_ID } = await import('../js/data/skills.js');

rng.seed(20261121);
deathRoll.spared = true;
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m) => { if (!problems.length) ok.push(m); };
const life = (age, o = {}) => {
  let s; do { s = createLife({ countryId: o.country ?? 'us', ...(o.year ? { year: o.year } : {}) }); } while (s.player.royal);
  store.state = s; const p = s.player;
  p.age = age; p.birthYear = s.year - age; p.finance.cash = 200000; p.legal.incarceration = null; p.legal.pending = null;
  p.education.enrolled = false; p.education.stage = 'none'; p.flags.livesWithParents = age < 18;
  return p;
};
const year = () => { const p = store.state.player; p.stats.health = Math.max(p.stats.health, 80); advanceYear(); store.state.pendingEvents = []; p.legal.pending = null; p.legal.incarceration = null; };
const open = () => cl.clubOptions().flatMap((k) => k.clubs).filter((x) => !x.why).map((x) => x.club.id);

// The catalog.
check(CLUBS.length >= 35, `plenty of clubs (${CLUBS.length})`);
check(CLUBS.every((c) => !c.skill || SKILL_BY_ID[c.skill]), 'every club skill is a real skill');
check(new Set(CLUBS.map((c) => c.id)).size === CLUBS.length, 'no two clubs share an id');
section(`the catalog: ${CLUBS.length} clubs and classes in six kinds`);

// Who can join what.
life(8);
check(open().includes('scouts') && open().includes('chess') && !open().includes('book') && !open().includes('quiz'), `an eight-year-old: scouts and chess, not a book club or a pub quiz (${open()})`);
const adult = life(30);
check(open().length === 0 && !cl.join('choir').ok, `an adult: clubs and classes are for children and teenagers (${open().length})`);
const teen = life(15);
check(open().length >= 15 && !open().includes('quiz') && !open().includes('coding') && !open().includes('dojo'), `a teenager: plenty, none for adults, none that are Lessons already (${open().length})`);
check(!open().includes('orchestra'), 'an orchestra needs an instrument played fairly well');
teen.skills = { violin: 55 };
check(open().includes('orchestra'), 'and with one, they can join');
void adult;
section('who can join: children and teenagers, by age, by playing an instrument');

// The past: no coding meetups in 1950.
const old = life(14); store.state.year = 1950;
check(!cl.clubOptions().flatMap((k) => k.clubs).some((x) => x.club.id === 'coding' || x.club.id === 'yoga'), 'no coding meetups or yoga classes in 1950');
check(cl.clubOptions().flatMap((k) => k.clubs).some((x) => x.club.id === 'choir'), 'but choirs');
void old;
section('the past: only clubs that existed then');

// Joining, dues, a year's worth, friends, leaving.
{
  const p = life(13);
  p.stats.charm = 40; p.stats.health = 60;
  const cash = p.finance.cash;
  check(cl.join('debate').ok && cl.join('running').ok && cl.join('choir').ok, 'joins three clubs');
  check(p.finance.cash === cash, 'a teenager\'s dues are paid at home');
  check(!cl.join('debate').ok, 'cannot join twice');
  check(cl.join('chess').ok && !cl.join('hiking').ok, `${MAX_CLUBS} at most`);
  const charm = p.stats.charm; const singing = p.talents.singing ?? 0;
  const before = p.finance.cash;
  year();
  check(p.stats.charm > charm, `a year of debating makes them more charming (${charm} → ${p.stats.charm})`);
  check((p.talents.singing ?? 0) > singing, `a year in a choir is singing practice (${singing} → ${p.talents.singing})`);
  void before;
  check(cl.memberships().every((m) => m.years === 1), 'each membership is a year old');
  // Friendships come by chance, year by year: give it up to ten years of membership.
  for (let i = 0; i < 9 && cl.memberships().flatMap((m) => m.friends).length < 2; i++) year();
  const friends = cl.memberships().flatMap((m) => m.friends);
  check(friends.length >= 2 && friends.every((id) => store.state.npcs[id]?.role === 'friend' && p.npcIds.includes(id)), `friends are made at the clubs (${friends.length})`);
  check(cl.leave('chess').ok && !cl.memberships().some((m) => m.id === 'chess') && cl.clubsOf().past.some((x) => x.id === 'chess' && x.why === 'left'), 'leaving is kept on the record');
  saveGame(store.state);
  const back = loadGame(store.state.slotId);
  check(JSON.stringify(back.player.clubs) === JSON.stringify(p.clubs), 'memberships survive a save and reload');
  section('joining, dues each year, what a year adds, friends made there, leaving');
}

// The committee, then the top.
{
  const p = life(14);
  p.stats.charm = 85;
  cl.join('book');
  check(!cl.standFor('book').ok && cl.nextRank('book').why, 'not before a year as a member');
  let rank = 0;
  for (let i = 0; i < 4 && rank < 2; i++) { year(); cl.standFor('book'); rank = cl.clubsOf().now.book?.rank ?? 0; }
  check(rank === 2, `a charming, loyal member is voted onto the committee, then to chair the club (rank ${rank})`);
  check(p.milestones.some((m) => /Chair of the book club/.test(m.text)), 'and it is a milestone');
  check(!cl.standFor('book').ok, 'nothing higher than the top');
  section('the committee, then running the club');
}

// Lapses: dues not paid, prison, growing out of it, moving away.
{
  const p = life(14);
  // With nobody at home to pay them, the next year's dues fall due with no money: the membership lapses.
  for (const id of p.npcIds) { const n = store.state.npcs[id]; if (n && ['parent', 'grandparent', 'guardian'].includes(n.role)) n.alive = false; }
  cl.join('sailing');
  p.finance.cash = 0;
  store.state.year += 1;
  cl.tickClubs();
  check(!cl.clubsOf().now.sailing && cl.clubsOf().past.some((x) => x.id === 'sailing' && x.why === 'dues'), 'unpaid dues: the membership lapses');
  const k = life(16);
  cl.join('scouts');
  year(); year();
  check(!cl.clubsOf().now.scouts && cl.clubsOf().past.some((x) => x.why === 'grew'), 'growing out of the scouts');
  void k;
  const q = life(14);
  cl.join('chess');
  q.legal.incarceration = { years: 2 };
  cl.tickClubs();
  check(!cl.clubsOf().now.chess && cl.clubsOf().past.some((x) => x.why === 'prison'), 'prison: memberships lapse');
  check(cl.whyNot(CLUB_BY_ID.choir) === 'Not from prison.', 'and none can be joined from a cell');
  q.legal.incarceration = null;
  cl.join('choir'); q.countryId = 'uk';
  cl.tickClubs();
  check(!cl.clubsOf().now.choir && cl.clubsOf().past.some((x) => x.why === 'moved'), 'moving abroad: the club is left behind');
  const kid = life(10);
  const cash = kid.finance.cash;
  cl.join('scouts');
  check(kid.finance.cash === cash, 'a child\'s dues are paid at home');
  const grown = life(17);
  cl.join('chess');
  store.state.year += 1; grown.age = 18;
  cl.tickClubs();
  check(!cl.clubsOf().now.chess && cl.clubsOf().past.some((x) => x.why === 'grew'), 'at eighteen, clubs and classes are left behind');
  section('memberships that lapse: dues, prison, growing up, moving away');
}

for (const m of ok) console.log(`ok   ${m}`);
if (problems.length) { console.log(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Clubs and classes hold.');
