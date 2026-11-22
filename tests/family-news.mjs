// News and things to do with family and friends, BitLife style: a death comes with what they died of and a funeral to
// go to or miss; a relative's shared diagnosis and ordinary illnesses come as news; a child asks their parents for
// lessons; a sleepover is an activity picked from a dropdown, with a scene now and then. Run with: node tests/family-news.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { ensureLife } = await import('../js/engine/npcLives.js');
const { EVENTS } = await import('../js/data/events/index.js');
const { resolveChoice } = await import('../js/engine/eventEngine.js');
const passing = await import('../js/engine/passing.js');
const lessons = await import('../js/engine/lessons.js');
const { LESSONS_A_YEAR } = await import('../js/data/lessons.js');
const together = await import('../js/engine/together.js');
const story = await import('../js/engine/health/story.js');
const { spendable } = await import('../js/engine/npcMoney.js');

rng.seed(Number(process.env.SEED ?? 3));
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;
function life(age, o = {}) {
  do { store.state = createLife({ countryId: 'us' }); } while (S().player.royal);
  const p = P(); p.age = age; p.birthYear = S().year - age; p.flags.livesWithParents = age < 18; p.finance.cash = o.cash ?? 0; p.legal.incarceration = null;
  for (const id of [...p.npcIds]) { const n = S().npcs[id]; if (n && ['parent', 'guardian', 'grandparent', 'friend', 'sibling'].includes(n.role)) { n.alive = false; n.role = 'acquaintance'; } }
  return p;
}
function person(role, age, rel = 70, extra = {}) {
  const n = makeNpc({ role, countryId: 'us', age, relationship: rel, gender: extra.gender ?? 'female' }); ensureLife(n);
  Object.assign(n.meters, extra.meters ?? {});
  S().npcs[n.id] = n; P().npcIds.push(n.id); return n;
}
const rich = (n) => { n.life ??= {}; n.life.savings = 5e6; n.savings = 5e6; n.meters.generosity = 80; };

// ---------- 1. A death: what they died of, and the funeral ----------
{
  life(30);
  const mom = person('parent', 66, 80);
  mom.health = { v: 1, conds: [{ id: 'cancer', age: 60, diagnosed: true }], last: 66 };
  let cancer = 0;
  for (let i = 0; i < 40; i++) if (/cancer/.test(passing.causeOfDeath(mom))) cancer++;
  check(cancer >= 20, `a death follows the illness they really had, mostly (${cancer} of 40 mention cancer)`);
  const young = person('friend', 22, 60);
  const causes = new Set(Array.from({ length: 60 }, () => passing.causeOfDeath(young)));
  check(![...causes].some((c) => /old age|sleep/.test(c)) && causes.size >= 3, `a young friend does not die of old age, and causes vary (${causes.size})`);
  check([...causes].every((c) => /^She /.test(c) && /\.$/.test(c)), 'each is a sentence about them');
  const sis = person('sibling', 34, 70);
  mom.alive = false; mom.flags.diedYear = S().year;
  const said = passing.noteDeath(mom);
  check(mom.flags.diedOf === said && passing.noteDeath(mom) === said, 'the cause is recorded once, and kept');
  const mood = P().stats.mood; const rel = sis.meters.relationship;
  const r = passing.funeral(mom.id, true);
  check(r.ok && mom.flags.funeral === 'attended' && P().stats.mood > mood && sis.meters.relationship > rel, 'going to the funeral helps, and the family is closer for it');
  check(!passing.funeral(mom.id, false).ok, 'and it is decided once');
  const dad = person('parent', 70, 60); dad.alive = false;
  const rel2 = sis.meters.relationship; const mood2 = P().stats.mood;
  passing.funeral(dad.id, false);
  check(dad.flags.funeral === 'skipped' && sis.meters.relationship < rel2 && P().stats.mood < mood2, 'missing a parent\'s funeral: the family notices');
}
section('a death has a cause from their life, and a funeral to go to or miss');

// ---------- 2. Lessons ----------
{
  const p = life(9);
  const mom = person('parent', 38, 80); rich(mom);
  const opts = lessons.lessonOptions();
  check(lessons.asksParents() && opts.some((o) => o.id === 'voice') && opts.some((o) => o.id === 'karate') && opts.some((o) => o.id === 'guitar'), 'a child can ask for voice, karate, guitar and more');
  check(!opts.some((o) => o.id === 'modeling'), 'modeling lessons wait until ten');
  let yes = 0; let tries = 0;
  for (let y = 0; y < 30 && yes < 3; y++) {
    p.flags.lessons.year = {}; // a new year
    const before = spendable(mom); const sing = p.talents.singing;
    const r = lessons.takeLesson('voice'); tries++;
    if (r.ok) { yes++; check(p.talents.singing > sing && spendable(mom) < before && /agreed to pay/.test(r.text), 'yes: the parent pays, and the child gets better'); }
    check(!lessons.takeLesson('voice').ok, 'one voice lesson course a year');
  }
  check(yes >= 2, `a well-off, generous parent mostly says yes (${yes} of ${tries})`);
  p.flags.lessons.year = {};
  for (const id of ['piano', 'karate', 'chess', 'swimming']) lessons.takeLesson(id);
  check(p.flags.lessons.year.ids.length === LESSONS_A_YEAR && lessons.lessonOptions().every((o) => o.why), `a few lessons a year, no more (${LESSONS_A_YEAR})`);
  // A family without the money says no more often.
  let poorYes = 0;
  for (let k = 0; k < 40; k++) { const q = life(10); const d = person('parent', 40, 60); d.life ??= {}; d.life.savings = 0; d.savings = 0; d.meters.generosity = 50; if (lessons.takeLesson('piano').ok) poorYes++; }
  check(poorYes <= 5, `a family with no money to spare says no (${poorYes} of 40)`);
  // An adult signs up and pays.
  const a = life(30, { cash: 100000 });
  check(!lessons.asksParents() && lessons.takeLesson('guitar').ok && a.finance.cash < 100000, 'an adult signs up and pays for themselves');
  const broke = life(30, { cash: 0 });
  check(!lessons.takeLesson('guitar').ok, 'with no money, no lessons');
  check(!lessons.lessonOptions().some((o) => o.id === 'spacecamp'), 'space camp is for children');
}
section('lessons: a child asks a parent, who decides by money and closeness and pays; an adult pays; a few a year');

// ---------- 3. Sleepovers ----------
{
  let queued = 0; let yes = 0;
  for (let k = 0; k < 60; k++) {
    const p = life(10);
    person('parent', 40, 70);
    const pal = person('friend', 10, 90);
    S().pendingEvents = [];
    const opts = together.bondOptions(pal.id, 'with:sleepover');
    const how = together.bondSelect(pal.id, 'with:sleepover');
    if (k === 0) {
      check(opts?.length >= 4 && opts.some((o) => o.value === 'camp') && opts.some((o) => o.value === 'bake'), `a sleepover offers activities to pick (${opts?.map((o) => o.label).join(', ')})`);
      check(how && how.title === 'Sleepover' && /Pick an activity/.test(how.label), 'asked with a dropdown');
    }
    const r = together.doBond(pal.id, 'with:sleepover', 'camp');
    if (r.ok && /backyard/.test(r.text)) yes++;
    if (S().pendingEvents.some((e) => e.id.startsWith('sleepover_') && e.cast.pal === pal.id)) queued++;
  }
  check(yes >= 45, `a close friend mostly comes, and you camp in the backyard (${yes} of 60)`);
  check(queued >= 10 && queued <= 40, `sometimes something happens in the night (${queued} of 60)`);
  const scenes = EVENTS.filter((e) => e.id.startsWith('sleepover_'));
  check(scenes.length === 4 && scenes.every((e) => e.queuedOnly && e.choices.length >= 3), 'four night scenes, each with choices');
  // A scene plays and changes the friendship.
  life(10); const pal = person('friend', 10, 60);
  const ev = EVENTS.find((e) => e.id === 'sleepover_board_game');
  const before = pal.meters.relationship;
  resolveChoice(ev, ev.choices.findIndex((c) => c.label === 'Up the ante'), { pal: pal.id });
  check(pal.meters.relationship < before, 'upping the ante ends in hurtful words');
  S().year = 1970; life(10); const old = person('friend', 10, 80); S().year = 1970;
  check(!together.bondOptions(old.id, 'with:sleepover').some((o) => o.value === 'games'), 'no video games before 1980');
}
section('a sleepover: pick what to do, most friends come, and sometimes the night has a scene');

// ---------- 4. Illness in the family ----------
{
  let ailments = 0; let years = 0; let twice = 0;
  for (let k = 0; k < 30; k++) {
    life(12);
    person('parent', 44, 70); person('parent', 46, 70, { gender: 'male' }); person('sibling', 15, 60);
    for (let y = 0; y < 6; y++) {
      S().pendingEvents = []; S().year += 1;
      for (const id of P().npcIds) { const n = S().npcs[id]; if (n?.alive) n.age += 1; }
      story.tickPeopleHealth();
      const a = S().pendingEvents.filter((e) => e.id === 'kin_ailment');
      years++; if (a.length) ailments++; if (a.length > 1) twice++;
      for (const e of a) check(e.cast.words.ailment && e.cast.words.emoji && /^(father|mother|brother|sister|sibling|parent)$/.test(e.cast.words.role), `an ailment names what and who (${e.cast.words.role}: ${e.cast.words.ailment})`);
    }
  }
  check(ailments > years * 0.15 && ailments < years * 0.45 && twice === 0, `now and then, never more than once a year (${ailments} of ${years} years)`);
  // A shared diagnosis comes as news.
  let news = 0;
  for (let k = 0; k < 60 && !news; k++) {
    life(30);
    const mom = person('parent', 62, 80);
    for (let y = 0; y < 15 && !news; y++) {
      S().pendingEvents = []; S().year += 1; mom.age += 1;
      story.tickPeopleHealth();
      const e = S().pendingEvents.find((x) => x.id === 'kin_diagnosed');
      if (e) { news++; check(e.cast.who === mom.id && e.cast.words.cond && e.cast.words.role === 'mother' && e.cast.words.title, `"Your mother has been diagnosed with ${e.cast.words.cond}."`); }
    }
  }
  check(news, 'a parent\'s shared diagnosis comes as news');
  const n = EVENTS.find((e) => e.id === 'kin_diagnosed');
  check(n.notice?.who === 'who' && n.choices.length === 2, 'shown as a notice with their face');
}
section('a relative\'s diagnosis, and ordinary illnesses, come as news with their face');

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const m of [...new Set(problems)]) console.log(' ✗', m);
  process.exit(1);
}
for (const m of ok) console.log(' ✓', m);
console.log('Family news, lessons and sleepovers hold together.');
