// The armed forces (engine/military.js): who can join and how, basic training, deployments with medals and wounds,
// contracts and what happens when they end, veterans' help with college, and national service where the law calls
// young people up in peacetime. Run with: node tests/military.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { EVENTS } = await import('../js/data/events/index.js');
const { resolveChoice } = await import('../js/engine/eventEngine.js');
const mil = await import('../js/engine/military.js');
const { CONTRACT, VETERAN_EDUCATION_YEARS } = await import('../js/data/military.js');

rng.seed(Number(process.env.SEED ?? 11));
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;
function life(age, o = {}) {
  do { store.state = createLife({ countryId: o.country ?? 'us', gender: o.gender ?? 'male' }); } while (S().player.royal);
  const p = P(); p.age = age; p.birthYear = S().year - age; p.gender = o.gender ?? 'male'; delete p.flags.trueGender;
  p.flags.livesWithParents = age < 18; p.education.enrolled = !!o.student; p.education.stage = o.student ? 'university' : 'none';
  p.stats.health = 85; p.hidden.discipline = 70; p.legal.incarceration = null; p.legal.heat = 0; p.finance.cash = 1000;
  if (o.degree) p.education.degrees.push({ type: 'university', majorId: 'history', gpa: 3.2 });
  S().pendingEvents = [];
  return p;
}
const queued = (id) => S().pendingEvents.find((e) => e.id === id);
function play(id, value) {
  const i = S().pendingEvents.findIndex((e) => e.id === id);
  const [q] = S().pendingEvents.splice(i, 1);
  const ev = EVENTS.find((e) => e.id === id);
  return resolveChoice(ev, ev.choices.findIndex((c) => c.outcomes[0].effects.some((f) => f.value === value)), q.cast);
}

// ---------- 1. Joining ----------
{
  life(15);
  check(mil.joinOptions().every((o) => o.why), 'not at fifteen');
  const p = life(19);
  const opts = mil.joinOptions();
  check(!opts.find((o) => o.id === 'enlisted').why && opts.find((o) => o.id === 'officer').why, 'at nineteen you can enlist; officer training needs a degree');
  check(mil.branches().includes('Marine Corps') && mil.branches().includes('Navy'), `a country's own branches (${mil.branches().join(', ')})`);
  const r = mil.join('enlisted', 'Navy');
  const m = mil.serving();
  check(r.ok && m && m.branch === 'Navy' && m.until === S().year + CONTRACT.enlisted && P().career.careerId === 'enlisted', 'enlisting: the Navy, a four-year contract');
  check(queued('mil_basic_training'), 'and basic training first');
  check(!mil.join('enlisted', 'Army').ok, 'one service at a time');
  life(24, { degree: true });
  check(mil.join('officer', 'Air Force').ok && P().career.careerId === 'officer', 'a graduate can go in as an officer');
}
section('joining: from 18, a branch of your own country, a contract, basic training');

// ---------- 2. Basic training ----------
{
  let washed = 0; let top = 0;
  for (let k = 0; k < 60; k++) {
    const p = life(19); p.stats.health = 56; p.hidden.discipline = 20;
    mil.join('enlisted', 'Army');
    play('mil_basic_training', 'basic:steady');
    if (!mil.serving()) washed++;
  }
  for (let k = 0; k < 20; k++) { life(19); mil.join('enlisted', 'Army'); const before = P().career.performance; play('mil_basic_training', 'basic:push'); if (P().career.performance > before + 5) top++; }
  check(washed > 0 && washed < 30, `an unfit recruit who only keeps their head down may wash out (${washed} of 60)`);
  check(top >= 12, `pushing to the front usually stands out (${top} of 20)`);
  life(19); mil.join('enlisted', 'Army'); play('mil_basic_training', 'basic:quit');
  check(!mil.serving() && !P().career.careerId, 'a recruit can ask to leave');
}
section('basic training: push, help, get through, wash out, or leave');

// ---------- 3. Deployments ----------
{
  let medals = 0; let wounds = 0; let n = 0;
  for (let k = 0; k < 80; k++) {
    life(22); mil.join('enlisted', 'Army'); S().pendingEvents = [];
    mil.deploy();
    check(queued('mil_deployment')?.cast.words.place, 'a deployment names where');
    const before = P().stats.health;
    play('mil_deployment', 'deploy:volunteer');
    const m = mil.serving(); n++;
    if (m.medals.length) medals++;
    if (P().stats.health < before) wounds++;
  }
  check(medals > 15 && wounds > 5 && medals + wounds < n, `volunteering: medals (${medals}), wounds (${wounds}), and plain days, out of ${n}`);
  check(mil.serving().deployments === 1, 'and each deployment is counted');
}
section('deployments are scenes: volunteering brings medals and wounds');

// ---------- 4. The end of a contract ----------
{
  let p = life(19); mil.join('enlisted', 'Army'); S().pendingEvents = [];
  S().year = mil.serving().until; mil.tickMilitary();
  check(queued('mil_contract_end'), 'when the contract is up, a decision');
  const cash = p.finance.cash; const until = mil.serving().until;
  play('mil_contract_end', 'contract:reenlist');
  check(p.finance.cash > cash && mil.serving().until > until, 'signing again pays a bonus and runs another term');
  S().year = mil.serving().until; S().pendingEvents = []; mil.tickMilitary();
  play('mil_contract_end', 'contract:officer');
  check(P().career.careerId === 'enlisted', 'no officer training without a degree');
  S().pendingEvents = []; mil.tickMilitary();
  play('mil_contract_end', 'contract:leave');
  check(!mil.serving() && p.flags.veteran && p.flags.vetEducation === VETERAN_EDUCATION_YEARS, 'leaving after a full term: a veteran, with college paid');
  // The benefit pays tuition.
  p.education.enrolled = true; p.education.stage = 'university'; p.education.funding = 'self'; p.education.yearInStage = 0; p.age = 30;
  const lines = S().journal.length;
  p.stats.health = 95; advanceYear();
  check(p.flags.vetEducation === VETERAN_EDUCATION_YEARS - 1 && S().journal.slice(lines).some((e) => /veterans' education benefit/.test(e.text)), 'and the benefit pays a year of tuition');
}
section('contracts end in a choice: sign again, go on to officer training, or leave a veteran with college paid');

// ---------- 5. National service ----------
{
  life(18, { country: 'us' }); mil.tickMilitary();
  check(!queued('mil_national_service'), 'no peacetime call-up in the United States');
  life(18, { country: 'kr', gender: 'female' }); mil.tickMilitary();
  check(!queued('mil_national_service'), 'in South Korea, women are not called up');
  life(18, { country: 'il', gender: 'female' }); mil.tickMilitary();
  check(queued('mil_national_service')?.cast.words.months === '32', 'in Israel, women are too (32 months)');
  let p = life(18, { country: 'kr' }); mil.tickMilitary();
  check(queued('mil_national_service')?.cast.words.months === '18', 'a Korean man of 18 is called up for 18 months');
  play('mil_national_service', 'ns:serve');
  const m = mil.serving();
  check(m?.conscript && m.until === S().year + 2, 'he serves, as a conscript');
  S().year = m.until; S().pendingEvents = []; mil.tickMilitary();
  check(!mil.serving() && p.flags.nationalService === 'served', 'and comes home when it is done');
  p = life(19, { country: 'kr', student: true }); mil.tickMilitary();
  play('mil_national_service', 'ns:defer');
  check(p.flags.nationalService?.deferredTo === 28, 'a student can put it off, until 28');
  p.age = 28; S().pendingEvents = []; mil.tickMilitary();
  check(queued('mil_national_service'), 'and is called up then');
  p = life(18, { country: 'kr' }); mil.tickMilitary();
  play('mil_national_service', 'ns:civil');
  check(!p.flags.nationalService || p.flags.nationalService !== 'civil', 'South Korea has no civilian alternative here');
  p = life(18, { country: 'fi' }); mil.tickMilitary();
  play('mil_national_service', 'ns:civil');
  check(p.flags.nationalService === 'civil', 'Finland does');
  p = life(18, { country: 'kr' }); mil.tickMilitary();
  play('mil_national_service', 'ns:refuse');
  check(p.flags.nationalService === 'refused' && p.legal.heat >= 30, 'refusing goes on the record');
}
section('national service: who is called up, for how long; serve, defer, civilian service, or refuse');

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const x of [...new Set(problems)]) console.log(' ✗', x);
  process.exit(1);
}
for (const x of ok) console.log(' ✓', x);
console.log('The armed forces hold together.');
