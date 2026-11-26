// Talents beyond the arts (art, writing, technology, math and science); lessons that train a real skill and count where
// it counts (coding for computer science); and a child's lessons paid for at home, with no price on them, until 18.
// Run with: node tests/talents-lessons.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { TALENTS, ADDED_TALENTS } = await import('../js/data/talents.js');
const lessons = await import('../js/engine/lessons.js');
const skills = await import('../js/engine/skills.js');
const apt = await import('../js/engine/aptitudes.js');
const martial = await import('../js/engine/martial.js');
const clubs = await import('../js/engine/clubs.js');
const { CLUBS } = await import('../js/data/clubs.js');
const career = await import('../js/engine/career.js');
const { CAREERS } = await import('../js/data/careers.js');
const uni = await import('../js/engine/university.js');
const { assess } = await import('../js/engine/admissions.js');
const { readFileSync } = await import('node:fs');

rng.seed(20261123);
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m) => ok.push(problems.length ? `(after problems) ${m}` : m);

const life = (age, year = 2020) => {
  do { store.state = createLife({ countryId: 'us', year: year - age }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; store.state.year = year;
  for (const n of Object.values(store.state.npcs)) if (n.role === 'parent') {
    n.alive = true; n.meters.generosity = 100; n.meters.relationship = 100; n.savings = 1e7; if (n.life) n.life.savings = 1e7;
  }
  p.flags.livesWithParents = age < 18;
  return p;
};
const lessonsFresh = () => { const l = store.state.player.flags.lessons; if (l) l.year = { age: -1, ids: [] }; };

// ---------- More talents ----------
{
  const p = life(10);
  check(ADDED_TALENTS.length === 6 && ADDED_TALENTS.every((id) => Number.isInteger(p.talents[id]) && p.talents[id] >= 0 && p.talents[id] <= 100), `a new life has art, writing, technology, math and science, persuasion and modeling (${JSON.stringify(p.talents)})`);
  const shown = TALENTS.filter((t) => !t.hidden).map((t) => t.name);
  check(shown.length === 11 && shown.includes('Persuasion') && shown.includes('Modeling') && shown.includes('Technology') && shown.includes('Math and Science') && !shown.includes('Mischief'), `eleven talents are shown, mischief is not (${shown.join(', ')})`);
  const n = makeNpc({ role: 'parent', countryId: 'us', age: 40 }); // the people whose talents the game keeps
  check(ADDED_TALENTS.every((id) => Number.isInteger(n.talents[id])), 'other people have them too');
  // Families pass them down: two gifted parents, a child who leans the same way.
  const kids = [];
  for (let i = 0; i < 40; i++) {
    const s = createLife({ countryId: 'us', year: 2000 });
    kids.push(s.player.potential.tech); // the gift: what a newborn could become, not where a baby starts
  }
  const mean = kids.reduce((a, b) => a + b, 0) / kids.length;
  check(mean > 10 && mean < 60, `technology varies from life to life (average ${Math.round(mean)})`);
  const gifted = createLife({ countryId: 'us', year: 2000, talent: 'tech' }).player;
  check(gifted.potential.tech >= 75 && gifted.talents.tech < 20, `a chosen gift for technology is a real gift, and the baby still starts low (${gifted.potential.tech}, now ${gifted.talents.tech})`);
  section('talents: art, writing, technology, math and science, for everyone; mischief stays off the chart');
}

// ---------- Older saves ----------
{
  const p = life(30);
  for (const who of [p, ...Object.values(store.state.npcs)]) for (const id of ADDED_TALENTS) delete who.talents?.[id];
  const id = store.state.slotId;
  saveGame(store.state);
  const a = loadGame(id).player.talents;
  const b = loadGame(id).player.talents;
  check(ADDED_TALENTS.every((k) => Number.isInteger(a[k])), 'a life saved before them is given them on loading');
  check(ADDED_TALENTS.every((k) => a[k] === b[k]), 'and the same ones every time it loads');
  section('older saves: given the new talents once, the same on every load');
}

// ---------- Lessons, and who pays ----------
{
  const p = life(10);
  const cash = p.finance.cash;
  check(lessons.asksParents() && skills.familyPays(), 'a child with parents asks them');
  const r = lessons.takeLesson('coding');
  check(r.ok && !/[$£€]|\d{3}/.test(r.text), `no price on what parents pay for (${r.text})`);
  check(p.finance.cash === cash, 'and none of it comes out of the child\'s money');
  check(p.skills.coding > 0 && skills.practiced().some((s) => s.id === 'coding'), `the classes are in coding: it is on the skills list (${p.skills.coding}%)`);
  const piano = lessons.takeLesson('piano');
  check(!piano.ok || (p.skills.piano > 0), 'piano lessons teach piano');
  p.age = 17; lessonsFresh();
  check(skills.familyPays() && martial.courseCost() === 0, 'at 17 the family still pays, martial arts included');
  const club = CLUBS.find((c) => (c.dues ?? 0) > 0);
  check(!club || clubs.duesOf(club) === 0, 'and club dues');
  p.age = 18; p.flags.livesWithParents = false; p.finance.cash = 1e5; lessonsFresh();
  check(!skills.familyPays() && martial.courseCost() > 0, 'from 18 it is your own money');
  const own = lessons.takeLesson('coding');
  check(own.ok && /\$\d/.test(own.text), `and the price is shown (${own.text.slice(0, 60)})`);
  const src = readFileSync(new URL('../js/ui/tabs/pursuits.js', import.meta.url), 'utf8');
  check(/\$\{ask \? '' : ` · \$\{fmtMoney\(o\.cost, c\)\}`\}/.test(src), 'the list of lessons hides prices while parents pay');
  const ui = readFileSync(new URL('../js/ui/identity.js', import.meta.url), 'utf8');
  check(ui.includes('>Practice Skills</button>') && !ui.includes('Practice a skill'), 'the button says Practice Skills');
  section('lessons: parents asked and no price until 18; then your own money, and the price; the button says Practice Skills');
}

// ---------- Where coding counts ----------
{
  const p = life(16);
  p.talents.tech = 0; p.talents.science = 0; p.talents.art = 0; p.talents.writing = 0; p.skills = {}; // nothing to start from
  p.potential = { ...p.potential, tech: 80, science: 50, art: 50, writing: 50 }; // a knack for it, fixed, so the dice of birth do not decide it
  const none = apt.majorEdge('computer_science');
  for (let y = 0; y < 6; y++) { p.age = 10 + y; lessonsFresh(); lessons.takeLesson('coding'); }
  for (let i = 0; i < 6; i++) { skills.practice('coding'); }
  const some = apt.majorEdge('computer_science');
  check(none === 0 && some >= 0.3, `years of coding are a head start in computer science (${none} to ${some}, coding ${p.skills.coding}%)`);
  check(apt.subjectEdge('technology') > 0 && apt.subjectEdge('art') === 0, 'and in Technology at school, not in Art');
  check(apt.workEdge(CAREERS.find((c) => c.id === 'software')) > 0, 'and with tech employers');
  check(apt.strongest(apt.MAJOR_EDGE.computer_science) === 'coding', 'named as coding when it is mentioned');
  // Admissions: the same application, with and without the coding, at the same place.
  p.age = 17; p.education.enrolled = true; p.education.stage = 'high'; p.education.gpa = 3.3;
  const inst = uni.catalog('us')[0];
  const withIt = uni.profile('computer_science', inst);
  const keep = { ...p.skills }; const t0 = { ...p.talents }; p.skills = {}; p.talents.tech = 0; p.talents.science = 0;
  const without = uni.profile('computer_science', inst);
  p.skills = keep; p.talents = t0;
  check(withIt.skill > without.skill && without.skill === 0 && withIt.skillWhat === 'coding', `an admissions office sees the coding (${withIt.skill} vs ${without.skill})`);
  const major = { id: 'computer_science', minGpa: 2.5 };
  const a1 = assess(withIt, inst, major, 0); const a0 = assess(without, inst, major, 0);
  check(a1.score > a0.score && a1.reasons.some((r) => /coding/.test(r)), `and weighs it: a better score, and says why (${a0.score} to ${a1.score})`);
  section('coding counts: computer science admissions and marks, Technology at school, tech jobs');
}

console.log(ok.map((m) => `ok   ${m}`).join('\n'));
if (problems.length) { console.log('PROBLEMS:'); for (const m of problems) console.log(` - ${m}`); console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Talents and lessons hold.');
