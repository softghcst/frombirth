// When a pregnancy is announced it is a decision (engine/pregnancyChoice.js): go on with it, or not. Asked of anyone,
// the pregnant person's own choice (a partner's is hers, and the player only says what they hope), it has real costs
// and consequences, it is harder to act on where it is against the law, and it is told without anything described.
// Run with: node tests/pregnancy-choice.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { ensureLife } = await import('../js/engine/npcLives.js');
const { EVENTS } = await import('../js/data/events/index.js');
const { resolveChoice } = await import('../js/engine/eventEngine.js');
const { ledgerOf } = await import('../js/engine/ledger.js');
const kids = await import('../js/engine/children.js');
const love = await import('../js/engine/romance.js');
const choice = await import('../js/engine/pregnancyChoice.js');
const stories = await import('../js/engine/loveStories.js');

rng.seed(Number(process.env.SEED ?? 7));
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;

function life(age, gender, countryId = 'us') {
  do { store.state = createLife({ countryId, gender }); } while (S().player.royal);
  const p = P();
  p.age = age; p.birthYear = S().year - age; p.gender = gender; delete p.flags.bornAs; delete p.flags.identity;
  p.flags.livesWithParents = age < 18; if (age >= 18) { p.education.enrolled = false; p.education.stage = 'none'; }
  p.finance.cash = 500000; p.legal.incarceration = null; p.stats.health = 90; p.stats.mood = 60; p.flags.pregnancy = null;
  for (const id of p.npcIds) { const n = S().npcs[id]; if (n && ['partner', 'spouse'].includes(n.role)) n.role = 'ex'; }
  ledgerOf();
  return p;
}
function person(role, age, gender, rel = 80, heart = {}) {
  const p = P();
  const n = makeNpc({ role, countryId: p.countryId, age, relationship: rel, gender });
  ensureLife(n); delete n.flags.bornAs;
  n.flags.heart = { casual: 60, secrecy: 60, commitment: 60, forgiving: 60, ...heart };
  S().npcs[n.id] = n; p.npcIds.push(n.id);
  return n;
}
const queued = (id) => S().pendingEvents.filter((e) => e.id === id);
function play(id, value) {
  const i = S().pendingEvents.findIndex((e) => e.id === id);
  if (i < 0) return null;
  const [q] = S().pendingEvents.splice(i, 1);
  const ev = EVENTS.find((e) => e.id === id);
  const c = ev.choices.findIndex((x) => x.outcomes[0].effects.some((f) => f.value === value));
  return resolveChoice(ev, c, q.cast);
}
const children = () => Object.values(S().npcs).filter((n) => n.role === 'child').length;

// ---------- 1. The news is a choice, for anyone ----------
{
  const p = life(28, 'female');
  const m = person('partner', 30, 'male');
  const said = kids.conceive(m, false);
  check(p.flags.pregnancy && queued('pregnancy_choice').length === 1 && !queued('pregnancy_partner').length, 'when a woman is told she is pregnant she is asked what to do');
  const ev = EVENTS.find((e) => e.id === 'pregnancy_choice');
  check(ev.choices.length === 2 && /keep/i.test(ev.choices[0].label) && /keep/i.test(ev.choices[1].label) && ev.choices.every((c) => c.label.length <= 16), 'the two answers are short enough to tap: "Keep the baby" and "Don\'t keep it"');
  check(said && queued('pregnancy_choice')[0].cast.words.who === said, 'the news is told as it came');
  const q = life(30, 'male');
  const w = person('partner', 28, 'female');
  kids.conceive(w, true);
  check(queued('pregnancy_partner').length === 1 && !queued('pregnancy_choice').length, 'a man whose partner is pregnant is asked too: what he hopes, not what she does');
  check(EVENTS.find((e) => e.id === 'pregnancy_partner').choices.length === 3 && EVENTS.find((e) => e.id === 'pregnancy_partner').choices.every((c) => c.label.length <= 18), 'with three short things to say, each fitting a button');
  // Every way a pregnancy can begin asks.
  const r = life(30, 'female'); const s = person('partner', 30, 'male', 95);
  S().pendingEvents = []; let hooked = false;
  for (let i = 0; i < 4000 && !hooked; i++) { s.flags.acts = {}; r.flags.pregnancy = null; S().pendingEvents = []; love.hookUp(s.id); hooked = !!r.flags.pregnancy; }
  check(hooked && queued('pregnancy_choice').length === 1, 'also when it was not planned');
  S().pendingEvents = []; r.flags.pregnancy = null;
  const t = life(30, 'female'); const u = person('spouse', 30, 'male', 95); let tried = false;
  for (let i = 0; i < 400 && !tried; i++) { u.flags.acts = {}; t.flags.pregnancy = null; S().pendingEvents = []; kids.tryForBaby(u.id); tried = !!t.flags.pregnancy; }
  check(tried && queued('pregnancy_choice').length === 1, 'and when it was planned');
}
section('announced to anyone, however it began: the player\'s choice, or what they hope for a partner');

// ---------- 2. Going on with it ----------
{
  const p = life(28, 'female'); const m = person('partner', 30, 'male', 85);
  kids.conceive(m, false);
  const mood = p.stats.mood;
  const note = play('pregnancy_choice', 'pregnancy:keep');
  check(p.flags.pregnancy?.decided === 'keep' && p.stats.mood >= mood && note, 'going on with it is recorded, with no price and no penalty');
  const before = children();
  for (let i = 0; i < 3 && !children() > before; i++) { p.stats.health = 95; advanceYear(); S().pendingEvents = []; }
  check(children() > before && !p.flags.pregnancy, 'and the baby is born');
}
section('going on with it: the baby is born');

// ---------- 3. Not continuing ----------
{
  const p = life(28, 'female'); const m = person('partner', 30, 'male', 85, { commitment: 80 });
  kids.conceive(m, false);
  const cash = p.finance.cash; const mood = p.stats.mood; const rel = m.meters.relationship; const before = children();
  const note = play('pregnancy_choice', 'pregnancy:end');
  check(!p.flags.pregnancy && p.flags.pregnancyEnded === S().year && note, 'not continuing ends the pregnancy and is recorded');
  check(p.finance.cash === cash - choice.cost() && choice.cost() > 0, `it costs what it costs (${choice.cost()}) and is in the books`);
  check(p.stats.mood < mood && m.meters.relationship < rel, 'it weighs on her, and on a partner who hoped for the baby');
  for (let i = 0; i < 3; i++) { p.stats.health = 95; advanceYear(); S().pendingEvents = []; }
  check(children() === before, 'and no baby is born');
  check(!/abortion|surgery|procedure|bleed/i.test(note), 'it is told without any detail');
  // Alone, no partner at all.
  const q = life(34, 'female'); kids.conceive(person('friend', 35, 'male', 50), false);
  q.flags.pregnancy.otherId = 'gone'; play('pregnancy_choice', 'pregnancy:end');
  check(!q.flags.pregnancy, 'it works the same when the other parent is gone');
}
section('not continuing: ends it, costs money, has consequences, no baby, nothing described');

// ---------- 4. Where it is against the law ----------
{
  life(28, 'female', 'ph');
  const abroad = choice.cost() / (store.state.countries?.ph?.rate ?? 1);
  check(choice.restricted('ph') && !choice.restricted('us') && choice.restricted() && choice.cost() > 0, 'a few countries restrict it, and the country the player lives in is checked');
  void abroad;
  const p = life(28, 'female', 'ph'); const m2 = person('partner', 30, 'male');
  kids.conceive(m2, false);
  p.finance.cash = 50;
  const note = play('pregnancy_choice', 'pregnancy:end');
  check(p.flags.pregnancy?.decided === 'unable' && /not allowed|more than you have/i.test(note?.text ?? ''), 'without the money to travel, the pregnancy goes on, and the player is told why');
  const r = life(28, 'female', 'ph'); kids.conceive(person('partner', 30, 'male'), false);
  const cash = (r.finance.cash = 900000000);
  const told = play('pregnancy_choice', 'pregnancy:end');
  check(!r.flags.pregnancy && /travel/i.test(told?.text ?? '') && r.finance.cash === cash - choice.cost(), 'with the money, she travels, and pays for it');
  const us = life(28, 'female', 'us'); kids.conceive(person('partner', 30, 'male'), false); const usCash = us.finance.cash; play('pregnancy_choice', 'pregnancy:end');
  check(usCash - us.finance.cash === choice.cost() && choice.cost() < choice.FEE_ABROAD, 'at home it costs far less than going abroad');
}
section('where it is against the law it means traveling, and costs more');

// ---------- 5. A partner's decision is hers ----------
{
  const trial = (hope) => {
    let kept = 0, ended = 0;
    for (let k = 0; k < 150; k++) {
      const p = life(30, 'male'); const w = person('partner', 28, 'female', 75);
      kids.conceive(w, false);
      play('pregnancy_partner', `pregnancy:${hope}`);
      if (p.flags.pregnancy?.decided === 'keep') kept++; else if (!p.flags.pregnancy) ended++;
    }
    return { kept, ended };
  };
  const a = trial('keep'), b = trial('end'), c = trial('support');
  check(a.kept + a.ended === 150 && b.kept + b.ended === 150 && c.kept + c.ended === 150, 'she always decides, one way or the other');
  check(a.kept > b.kept && c.kept > b.kept && a.ended > 0 && b.kept > 0, `what he hopes weighs, but does not decide (hoped to keep: ${a.kept} kept; stand by: ${c.kept}; hoped not: ${b.kept})`);
  const p = life(30, 'male'); const w = person('partner', 28, 'female', 75); kids.conceive(w, false);
  const rel = w.meters.relationship;
  let seen = false;
  for (let k = 0; k < 40 && !seen; k++) { S().pendingEvents = [{ id: 'pregnancy_partner', cast: { them: w.id } }]; p.flags.pregnancy = { dueAge: 31, otherId: w.id }; w.meters.relationship = rel; w.flags.heart.commitment = 90; play('pregnancy_partner', 'pregnancy:end'); seen = p.flags.pregnancy?.decided === 'keep' && w.meters.relationship < rel; S().pendingEvents = []; }
  check(seen, 'a partner who keeps the baby against his wishes holds it against him a little');
}
section('a partner decides; what the player hopes weighs but does not decide');

// ---------- 6. Teenagers ----------
{
  const p = life(16, 'female'); const bf = person('partner', 16, 'male', 90);
  p.flags.teenPregnancy = { year: S().year, otherId: bf.id, told: [], school: 'stay', plan: null };
  p.flags.pregnancy = { dueAge: 17, otherId: bf.id, teen: true };
  S().pendingEvents = [{ id: 'teen_parenthood', cast: { them: bf.id } }];
  const ev = EVENTS.find((e) => e.id === 'teen_parenthood');
  check(ev.choices.some((c) => c.outcomes[0].effects.some((f) => f.value === 'teenPlan:end')), 'the young person has the choice too, among the others');
  const cash = p.finance.cash; const enrolled = p.education.enrolled;
  play('teen_parenthood', 'teenPlan:end');
  check(!p.flags.pregnancy && p.flags.teenPregnancy.done && p.flags.teenPregnancy.plan === 'ended' && p.education.enrolled === enrolled, 'it ends the pregnancy, closes the storyline and school goes on');
  check(choice.cost() === 0 && p.finance.cash === cash, 'a young person is not left to pay for it');
  check(!/sex|slept|night together|intimate/i.test(JSON.stringify(EVENTS.filter((e) => ['pregnancy_choice', 'pregnancy_partner', 'teen_parenthood'].includes(e.id)))), 'and nothing is told of how it came about');
  const q = life(16, 'male'); const gf = person('partner', 16, 'female', 80);
  q.flags.teenPregnancy = { year: S().year, otherId: gf.id, told: [], school: null, plan: null }; q.flags.pregnancy = { dueAge: 17, otherId: gf.id, teen: true };
  S().pendingEvents = [{ id: 'teen_parenthood', cast: { them: gf.id } }];
  play('teen_parenthood', 'teenPlan:end');
  check(!q.flags.pregnancy || q.flags.pregnancy.decided === 'keep', 'for a boy whose girlfriend is pregnant it is her decision, not his');
}
section('teenagers have the choice too; school goes on; nobody pays; a boyfriend only says what he hopes');

// ---------- 7. How a teenager looks after themselves ----------
{
  const p = life(13, 'female');
  check(stories.teenSafety().length === 0, 'nothing is offered before 14');
  const rate = (setup, n = 6000) => {
    let began = 0;
    for (let k = 0; k < n; k++) {
      const q = life(16, 'female'); S().settings = { ...(S().settings ?? {}), drama: 'high', sensitiveFamily: true };
      const bf = person('partner', 16, 'male', 80);
      setup(q);
      stories.tickLoveStories();
      if (q.flags.teenPregnancy) began++;
    }
    return began;
  };
  const none = rate(() => {});
  const learned = rate((q) => { stories.doTeenSafety('class'); stories.doTeenSafety('care'); });
  check(none > 20 && learned < none / 3, `a young person who has been to health class and seen a doctor is far less likely to meet the storyline (${none} without, ${learned} with)`);
  const q = life(16, 'female');
  const opts = stories.teenSafety();
  check(opts.length === 3 && opts.every((o) => !o.done) && stories.doTeenSafety('care').ok && !stories.doTeenSafety('care').ok, 'three things are offered, each once');
  check(opts.map((o) => o.label).join(' ').split(/\s+/).every((w) => !/sex|intimate|condom/i.test(w)), 'described as looking after yourself, with nothing about how it comes about');
  const cash = q.finance.cash;
  check(q.finance.cash === cash, 'all of it is free');
  const orphan = life(16, 'female'); for (const id of orphan.npcIds) { const n = S().npcs[id]; if (n && (n.role === 'parent' || n.role === 'guardian')) n.alive = false; }
  check(!stories.doTeenSafety('talk').ok || stories.teenSafety().find((o) => o.id === 'talk').why === '', 'a talk needs someone to talk to');
}
section('a teenager can look after themselves: health class, a talk, a private doctor; each makes the storyline less likely');

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(' ✗', p);
  process.exit(1);
}
for (const m of ok) console.log(' ✓', m);
console.log('Pregnancy choices hold together.');
