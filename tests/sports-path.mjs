// The way from school to the professional game: every sport a country plays at its schools; the university team on
// the University screen (a college program, or a university club elsewhere) won by a tryout; a record that counts for
// scouts, the draft and pay; and almost no way into the professional game without one.
// Run with: node tests/sports-path.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const sp = await import('../js/engine/sports.js');
const life = await import('../js/engine/sportsLife.js');
const draft = await import('../js/engine/draft.js');
const school = await import('../js/engine/schoollife.js');
const { catalog } = await import('../js/engine/university.js');
const { divisionOf } = await import('../js/engine/recruiting.js');

rng.seed(20261127);
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const caseOf = (name, fn) => { const n = problems.length; try { fn(); } catch (err) { problems.push(`${name}: threw ${err.stack.split('\n').slice(0, 2).join(' | ')}`); } ok.push(problems.length === n ? name : `(failed) ${name}`); };
const S = () => store.state; const P = () => store.state.player;
function year(pref = {}) { advanceYear(); S().pendingEvents = []; for (const d of life.openDecisions()) life.answer(d.id, pref[d.kind] && d.options.some((o) => o.id === pref[d.kind]) ? pref[d.kind] : d.options.at(-1).id); }
function grownTo(age, countryId, city) {
  for (;;) {
    store.state = createLife({ countryId, city });
    if (P().royal) continue;
    P().talents.sports = 92; P().stats.health = 90; P().hidden.discipline = 80;
    for (let i = 0; i < age && P().alive; i++) year({ integrity: 'refuse' });
    if (P().alive && P().age === age && !P().legal?.incarceration) return P();
  }
}
const maxOut = (e, v) => { for (const k of Object.keys(e.skills)) { e.ceiling[k] = Math.max(e.ceiling[k], v + 5); e.skills[k] = v; } };
function atUniversity(p, countryId, want = (u) => true) {
  const u = catalog(countryId).find((x) => want(x));
  Object.assign(p.education, { enrolled: true, stage: 'university', schoolId: u.id, schoolName: u.name });
  return u;
}

caseOf('a school plays every sport its country plays, the country\'s favorites first', () => {
  store.state = createLife({ countryId: 'us', city: 'Chicago' });
  const us = school.sportsHere();
  check(us[0] === 'American football' && ['softball', 'golf', 'wrestling', 'ice hockey', 'gymnastics'].every((x) => us.includes(x)), `the United States: ${us.join(', ')}`);
  store.state = createLife({ countryId: 'jp', city: 'Tokyo' });
  const jp = school.sportsHere();
  check(jp[0] === 'baseball' && ['basketball', 'tennis', 'table tennis', 'badminton', 'softball'].every((x) => jp.includes(x)) && !jp.includes('martial arts'), `Japan (judo stands for martial arts): ${jp.join(', ')}`);
  store.state = createLife({ countryId: 'eg', city: 'Cairo' });
  const eg = school.sportsHere();
  check(!['cricket', 'ice hockey', 'American football', 'baseball', 'figure skating'].some((x) => eg.includes(x)) && ['football', 'basketball', 'tennis'].every((x) => eg.includes(x)), `Egypt plays none of the sports it does not play at all: ${eg.join(', ')}`);
  check(eg.every((n) => school.setSport(n).ok) && !school.setSport('cricket').ok, 'every sport offered can be chosen, and no other');
});

caseOf('playing for fun is no record; years for a school or club are', () => {
  store.state = createLife({ countryId: 'uk', city: 'London' });
  for (let i = 0; i < 12; i++) year({ integrity: 'refuse' });
  sp.takeUp('tennis');
  const e = sp.entryOf('tennis');
  check(sp.competitiveYears(e) === 0 && sp.recordOdds(0) === 0.01 && sp.recordScore(e) === -15, 'recreational tennis: no record, one chance in a hundred');
  e.history.push({ year: S().year - 2, level: 'club', name: 'a club' }); e.seasonsPlayed = 3;
  check(sp.competitiveYears(e) >= 2 && sp.recordOdds(sp.competitiveYears(e)) === 1, `years at a club count (${sp.competitiveYears(e)})`);
});

caseOf('a gifted adult who has only played for fun almost never turns professional', () => {
  let offers = 0;
  for (let n = 0; n < 3; n++) {
    grownTo(20, 'uk', 'London');
    sp.takeUp('soccer'); const e = sp.entryOf('soccer'); maxOut(e, 82);
    for (let i = 0; i < 5; i++) {
      advanceYear(); S().pendingEvents = [];
      for (const d of life.openDecisions()) { if (['contract', 'turnPro', 'academy'].includes(d.kind)) offers++; life.answer(d.id, d.options.at(-1).id); }
      e.history = e.history.filter((h) => h.level === 'recreational'); e.orgId = sp.entryOf('soccer').orgId; // never joins a club
    }
  }
  check(offers <= 1, `no club signs someone they have never seen play (${offers} offers in 15 years)`);
});

caseOf('college seasons count: the draft grade, and what a club pays', () => {
  grownTo(21, 'us', 'Chicago');
  sp.takeUp('basketball'); const e = sp.entryOf('basketball'); maxOut(e, 78);
  const none = draft.draftGrade(S(), e);
  e.history.push({ year: S().year - 4, level: 'school', name: 'a high school' }, { year: S().year - 3, level: 'college', name: 'a university' });
  e.seasonsPlayed = 6; e.college = { orgId: null, division: 'D1', start: S().year - 3, played: [S().year - 3, S().year - 2, S().year - 1], redshirt: null, out: {}, transfers: [], nil: [] };
  e.awards = [{ year: S().year - 1, id: 'poy', name: 'Player of the Year' }]; e.scouted = { [S().year - 1]: true, [S().year - 2]: true };
  const record = draft.draftGrade(S(), e);
  check(record - none >= 15, `three D1 seasons, an award and the scouts' reports lift the grade (${none} → ${record})`);
  check(draft.projectedPick(none) > 30 * draft.projectedPick(record) || draft.projectedPick(record) <= 30, `and the pick, which sets the pay (${draft.projectedPick(none)} → ${draft.projectedPick(record)})`);
});

caseOf('the university team: a college program won by a walk-on tryout, a club elsewhere', () => {
  store.state = createLife({ countryId: 'us', city: 'Chicago' });
  for (let i = 0; i < 18; i++) year({ integrity: 'refuse' });
  const p = P();
  const u = atUniversity(p, 'us', (x) => divisionOf(S(), x) === 'D3');
  sp.takeUp('basketball'); const e = sp.entryOf('basketball'); maxOut(e, 70);
  const t = life.universityTeam('basketball');
  check(t.kind === 'college' && !t.onTeam && t.division === 'D3' && !t.why, `a ${u.name} program to try out for (${JSON.stringify({ kind: t.kind, div: t.division, why: t.why })})`);
  const r = life.collegeTryout('basketball');
  check(r.ok && sp.orgOf(sp.entryOf('basketball').orgId)?.kind === 'college' && life.universityTeam('basketball').onTeam, `a good player makes it as a walk-on (${r.text})`);
  check(!life.collegeTryout('basketball').ok, 'once on the team, there is no tryout');
  store.state = createLife({ countryId: 'uk', city: 'London' });
  for (let i = 0; i < 18; i++) year({ integrity: 'refuse' });
  atUniversity(P(), 'uk');
  sp.takeUp('soccer'); const f = sp.entryOf('soccer'); maxOut(f, 60);
  const c = life.universityTeam('soccer');
  check(c.kind === 'club' && /Club$/.test(c.name), `in the United Kingdom, the university's club (${c.name})`);
  const r2 = life.collegeTryout('soccer');
  check(r2.ok && sp.orgOf(sp.entryOf('soccer').orgId)?.key.startsWith('uniclub/') && sp.competitiveYears(sp.entryOf('soccer')) >= 1, `made the club, and it counts on the record (${r2.text})`);
  year({ integrity: 'refuse' });
  check(sp.orgOf(sp.entryOf('soccer').orgId)?.key.startsWith('uniclub/'), 'still on it a year on');
  check(sp.leaveClub('soccer').ok && !sp.entryOf('soccer').uniClub, 'leaving it is leaving it');
  year({ integrity: 'refuse' });
  check(!sp.orgOf(sp.entryOf('soccer').orgId)?.key.startsWith('uniclub/'), 'and the player is not put back on it');
});

caseOf('a walk-on place is not given without a tryout', () => {
  store.state = createLife({ countryId: 'us', city: 'Chicago' });
  for (let i = 0; i < 18; i++) year({ integrity: 'refuse' });
  atUniversity(P(), 'us', (x) => divisionOf(S(), x) === 'D1');
  sp.takeUp('soccer'); maxOut(sp.entryOf('soccer'), 75);
  year({ integrity: 'refuse' });
  check(sp.orgOf(sp.entryOf('soccer').orgId)?.kind !== 'college', 'a year at university, no tryout, not on the team');
});

for (const name of ok) console.log(`${name.startsWith('(failed)') ? 'FAIL' : 'ok  '} ${name.replace(/^\(failed\) /, '')}`);
if (problems.length) { console.log(problems.map((x) => `  ✗ ${x}`).join('\n')); process.exit(1); }
console.log('From school to the professional game, the record counts.');
