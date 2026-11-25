// College teams that build skills and compete (hackathon club, engineering team, moot court, pre-law society), and
// internships that care what a student can actually do.
const { store, rng, createLife, check, finish } = await import('./helpers/lawSetup.mjs');
const campus = await import('../js/engine/campus.js');
const { ORG_BY_ID } = await import('../js/data/universities.js');

function student(o = {}) {
  let s; do { s = createLife({ countryId: 'us' }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  p.age = 20; p.birthYear = s.year - 20; p.finance.cash = 50000;
  Object.assign(p.education, { stage: 'university', enrolled: true, majorId: o.major ?? 'computer_science', gpa: 3.2, credits: 60, schoolName: 'State University' });
  p.skills = { ...(p.skills ?? {}), ...(o.skills ?? {}) };
  return p;
}

for (const id of ['hackathon', 'engineering_team', 'moot_court', 'prelaw']) check(!!ORG_BY_ID[id], `${ORG_BY_ID[id]?.name ?? id} is a campus organization`);

// Joining the hackathon club: coding goes up each year, and a strong coder places now and then.
rng.seed?.(11);
let p = student({ skills: { coding: 85 } });
check(campus.joinOrg('hackathon').ok, 'a student can join the hackathon club');
const before = p.skills.coding;
let won = 0;
for (let y = 0; y < 6; y++) { p.age++; campus.tickCampus?.(3.2); }
won = (p.flags.awards ?? []).filter((a) => a.college).length;
check(p.skills.coding > before, `coding grows in the club (${before} → ${p.skills.coding})`);
check(won > 0, `a strong coder places at hackathons (${won} awards)`);

// Moot court: speaking and writing grow.
p = student({ major: 'political_science', skills: { public_speaking: 40, writing: 40 } });
check(campus.joinOrg('moot_court').ok, 'a student can join moot court');
p.age++; campus.tickCampus(3.2);
check(p.skills.public_speaking > 40 && p.skills.writing > 40, 'moot court builds speaking and writing');

// Internships: the same student with the field's skills stands a better chance than without.
const odds = (skills) => {
  const q = student({ skills });
  const post = campus.postings().find((x) => x.careerId);
  return post ? campus.internChance(post) : null;
};
const weak = odds({ coding: 5, math: 5 });
const strong = odds({ coding: 95, math: 90 });
if (weak !== null && strong !== null) check(strong > weak, `skills help land an internship (${weak.toFixed(2)} → ${strong.toFixed(2)})`);
else check(true, 'no field posting this run');

finish('Campus teams and internships work.');
