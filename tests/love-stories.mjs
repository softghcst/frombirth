// The stories of real relationships (engine/loveStories.js): told only when true, once, at a pace set by the drama
// setting and not by the length of a turn; each choice changes the real relationship; and the teenage pregnancy
// storyline, which is off unless turned on, follows no action, and leaves the young person at school and in charge.
// Run with: node tests/love-stories.mjs
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
const love = await import('../js/engine/romance.js');
const bonds = await import('../js/engine/bonds.js');
const stories = await import('../js/engine/loveStories.js');
const turns = await import('../js/engine/turns.js');

rng.seed(99);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;

function life(age = 30, gender = 'male') {
  do { store.state = createLife({ countryId: 'us', gender }); } while (S().player.royal);
  const p = P();
  p.age = age; p.birthYear = S().year - age; p.gender = gender; delete p.flags.bornAs; delete p.flags.identity;
  p.flags.livesWithParents = age < 18; if (age >= 18) { p.education.enrolled = false; p.education.stage = 'none'; }
  p.flags.interestedIn = 'everyone'; p.stats.charm = 70; p.finance.cash = 500000; p.legal.incarceration = null;
  // Nobody from the generated life is anyone's partner: these scenes set their own.
  for (const id of p.npcIds) { const n = S().npcs[id]; if (n && ['partner', 'spouse'].includes(n.role)) n.role = 'ex'; }
  S().settings = { ...(S().settings ?? {}), drama: 'high' };
  ledgerOf();
  return p;
}
function person(role, age = 30, rel = 80, heart = {}, gender = 'female') {
  const p = P();
  const n = makeNpc({ role, countryId: p.countryId, age, relationship: rel, gender });
  ensureLife(n);
  n.flags.heart = { casual: 60, secrecy: 60, commitment: 60, forgiving: 60, ...heart };
  S().npcs[n.id] = n; p.npcIds.push(n.id);
  return n;
}
const queued = (id) => S().pendingEvents.filter((e) => e.id === id);
const mineOnly = () => { S().pendingEvents = S().pendingEvents.filter((e) => /^(love_|teen_|bond_|romance_compl)/.test(e.id)); };
function play(id, value) {
  const i = S().pendingEvents.findIndex((e) => e.id === id);
  if (i < 0) return null;
  const [q] = S().pendingEvents.splice(i, 1);
  const ev = EVENTS.find((e) => e.id === id);
  const c = ev.choices.findIndex((x) => x.outcomes[0].effects.some((f) => f.value === value));
  return resolveChoice(ev, c, q.cast);
}
/** Tells this year's stories until this one comes up (or does not, in `tries` years of asking). */
function tell(id, tries = 30) {
  for (let i = 0; i < tries && !queued(id).length; i++) { stories.tickLoveStories(); mineOnly(); if (!queued(id).length) { S().year += 1; } }
  return queued(id).length > 0;
}
function begin(npc, type) { const rel = npc.meters.relationship; for (let i = 0; i < 80; i++) { npc.flags.acts = {}; npc.meters.relationship = rel; if (bonds.propose(npc.id, type).ok) return true; } return false; }

// ---------- 1. Only what is true is told ----------
{
  life();
  person('spouse', 30, 85);
  for (let i = 0; i < 12; i++) { stories.tickLoveStories(); S().year += 1; }
  mineOnly();
  check(S().pendingEvents.length === 0, `a quiet marriage has none of these stories, however high the drama is set (${S().pendingEvents.map((e) => e.id).join(', ')})`);
  const all = EVENTS.filter((e) => e.id.startsWith('love_') || e.id.startsWith('teen_'));
  check(all.length === 14 && all.every((e) => e.queuedOnly) && all.filter((e) => e.id.startsWith('love_')).every((e) => e.ageRange[0] === 18), 'the stories are never drawn by chance, and the adult ones are for adults');
}
section('nothing is invented: no relationship, no story');

// ---------- 2. Each story from its own real cause, each choice with its own real effect ----------
{
  life();
  const gf = person('partner', 28, 85, { commitment: 80 });
  gf.flags.since = 28; bonds.primary().start.year = S().year - 2;
  check(tell('love_are_we_exclusive') && queued('love_are_we_exclusive')[0].cast.them === gf.id, 'a girlfriend of a year or more asks whether you are exclusive');
  play('love_are_we_exclusive', 'are_we_exclusive:yes');
  check(bonds.primary().exclusive === true && bonds.promised(), '"only you" is a promise, kept on the record');
  for (let i = 0; i < 10; i++) { stories.tickLoveStories(); S().year += 1; }
  check(!queued('love_are_we_exclusive').length, 'and she does not ask again');
}
{
  life();
  const gf = person('partner', 28, 85, { commitment: 80 });
  bonds.primary().start.year = S().year - 2;
  tell('love_are_we_exclusive');
  play('love_are_we_exclusive', 'are_we_exclusive:notYet');
  check(bonds.primary().exclusive == null && !bonds.promised() && gf.role === 'partner', '"not yet" promises nothing, and she stays or goes as she chooses');
}
{
  life();
  const friend = person('friend', 29, 90, { commitment: 80 });
  check(tell('love_more_than_friends'), 'a close friend who wants more says so');
  play('love_more_than_friends', 'more_than_friends:romance');
  check(friend.role === 'partner' && love.partner().id === friend.id && bonds.primary().npcId === friend.id && S().npcs[friend.id] === friend, 'saying yes makes a couple of the same two people');
}
{
  life();
  const friend = person('friend', 29, 90, { commitment: 80 });
  tell('love_more_than_friends');
  play('love_more_than_friends', 'more_than_friends:platonic');
  check(friend.role === 'friend' && !love.partner(), 'saying no leaves a friendship');
  for (let i = 0; i < 15; i++) { friend.meters.relationship = 95; stories.tickLoveStories(); S().year += 1; }
  check(!queued('love_more_than_friends').length, 'and a no is remembered: the question is not put again');
}
{
  life();
  const friend = person('friend', 29, 90, { casual: 100, commitment: 80 });
  begin(friend, 'fwb');
  const b = bonds.bondWith(friend.id);
  check(!tell('love_unexpected_feelings', 4), 'friends with benefits brings no talk of feelings that nobody has');
  b.arc.feelings = { year: S().year };
  check(tell('love_unexpected_feelings'), 'when one of them does feel more, it is said');
  play('love_unexpected_feelings', 'unexpected_feelings:friends');
  check(b.status === 'ended' && friend.role === 'friend' && b.arc.feelingsAnswered, 'going back to being friends ends the arrangement and keeps the friend');
}
{
  const p = life();
  const friend = person('friend', 29, 90, { casual: 100, commitment: 20 });
  begin(friend, 'casual');
  const b = bonds.bondWith(friend.id);
  check(!tell('love_gift_meaning', 3), 'small presents start no conversation about what they mean');
  b.start.year -= 3; friend.flags.acts = {};
  bonds.give(friend.id, 'earrings');
  // (Asked within the year of the gift: it is this year's gift that is talked about, not one from long ago.)
  let asked = false;
  for (let i = 0; i < 40 && !asked; i++) { stories.tickLoveStories(); mineOnly(); asked = queued('love_gift_meaning').length > 0; }
  check(b.gifts.some((g) => g.id === 'earrings') && asked, 'a lavish one does');
  const rel = friend.meters.relationship;
  play('love_gift_meaning', 'gift_meaning:gift');
  check(friend.meters.relationship >= rel && b.status === 'active', 'someone who wants no promises is glad it was only a gift');
  // The other address.
  const flat = { id: 'asset_flat', kind: 'property', name: 'A flat', value: 200000, condition: 80 };
  p.assets.push(flat);
  check(!tell('love_other_address', 3), 'nobody asks about an arrangement that does not exist');
  for (let i = 0; i < 40 && !flat.occupant; i++) { friend.meters.relationship = 90; bonds.house(friend.id, flat.id); }
  check(flat.occupant && tell('love_other_address'), 'someone living in a place of yours asks what the arrangement is');
  play('love_other_address', 'other_address:reconsider');
  check(!flat.occupant && !friend.flags.housedIn && p.assets.includes(flat), 'asked to go, they go, and the place is still yours');
}
{
  life();
  const wife = person('spouse', 30, 85);
  const other = person('friend', 29, 90, { secrecy: 100, commitment: 0 });
  begin(other, 'secret');
  const b = bonds.bondWith(other.id);
  b.arc.complicated = { year: S().year, choice: 'honest' };
  check(!tell('love_anniversary_hidden', 1), 'no anniversary before a year has passed');
  b.start.year -= 1;
  check(tell('love_anniversary_hidden'), 'a year of a hidden relationship is an anniversary nobody can be told about');
  play('love_anniversary_hidden', 'anniversary_hidden:celebrate');
  check((b.acts[S().year]?.time ?? 0) >= 1 && bonds.knowledge(b, wife.id) === null, 'celebrating it is something done (and so something that might be seen), and tells nobody by itself');
}
{
  life();
  const wife = person('spouse', 30, 30);
  check(tell('love_something_different') && queued('love_something_different')[0].cast.them === wife.id, 'a spouse who feels the distance says so');
  const cash = P().finance.cash;
  play('love_something_different', 'something_different:counseling');
  check(P().finance.cash < cash && wife.meters.relationship > 30 && wife.role === 'spouse', 'counseling costs money and helps: distance is not proof of anything');
}
{
  life();
  const one = person('acquaintance', 30, 80, { casual: 100 });
  begin(one, 'onenight');
  check(!tell('love_one_night_again', 1), 'one night is not followed up at once');
  bonds.pastWith(one.id)[0].start.year -= 2;
  check(tell('love_one_night_again'), 'a year or two on, they may get in touch');
  play('love_one_night_again', 'one_night_again:friends');
  check(one.role === 'friend' && !bonds.bondWith(one.id) && !love.partner(), 'coffee as friends makes a friend, and nothing else');
  for (let i = 0; i < 8; i++) { stories.tickLoveStories(); S().year += 1; }
  check(!queued('love_one_night_again').length, 'and that is asked once');
}
{
  life();
  const wife = person('spouse', 30, 85, { forgiving: 95 });
  const other = person('friend', 29, 90);
  begin(other, 'secret');
  const m = bonds.primary();
  // She found out and left; years pass.
  love.leftBy(wife.id); m.status = 'ended'; m.end = { year: S().year, month: 0, age: P().age, why: 'they left' };
  bonds.end(other.id);
  check(wife.role === 'ex' && !tell('love_one_more_chance', 1), 'an ex does not ask to try again straight away');
  m.end.year -= 3; wife.meters.relationship = 50;
  check(tell('love_one_more_chance'), 'years later, a forgiving one may');
  play('love_one_more_chance', 'one_more_chance:again');
  const again = bonds.primary();
  check(wife.role === 'partner' && again.npcId === wife.id && again.trust === 50 && again.arc.secondChance && bonds.bonds().filter((x) => x.npcId === wife.id).length === 2 && m.status === 'ended', 'trying again is a new beginning with the same person, and the old marriage stays in the record');
  // An old love.
  bonds.pastWith(other.id).at(-1).end.year -= 6;
  check(tell('love_old_love'), 'and someone from long ago may write');
  play('love_old_love', 'old_love:decline');
  for (let i = 0; i < 8; i++) { stories.tickLoveStories(); S().year += 1; }
  check(!queued('love_old_love').length && other.role !== 'partner', 'not answered, they do not write again');
}
section('ten stories, each from its own real cause, each choice changing the real relationship');

// ---------- 3. The pace is the setting's, not the turn's ----------
{
  const count = (drama) => {
    let n = 0;
    for (let k = 0; k < 40; k++) {
      life(); S().settings.drama = drama;
      person('spouse', 30, 30);
      const f = person('friend', 29, 90, { casual: 100, commitment: 80 }); begin(f, 'fwb'); bonds.bondWith(f.id).arc.feelings = { year: S().year };
      stories.tickLoveStories(); mineOnly();
      n += S().pendingEvents.filter((e) => e.id.startsWith('love_')).length;
    }
    return n;
  };
  const low = count('low'), high = count('high');
  check(low < high && high <= 80 && low >= 3, `higher drama tells more of the true stories, never more than two a year (${low} against ${high} in 40 years)`);
  life();
  person('spouse', 30, 30);
  S().settings.step = 3;
  turns.advanceTurn(); mineOnly();
  check(S().pendingEvents.length === 0, 'and none on a part of a year');
}
section('drama sets how many of the true stories are told; a shorter turn tells no more');

// ---------- 4. Fifteen to seventeen ----------
{
  const run = (on, years = 400) => {
    let began = 0;
    for (let k = 0; k < years; k++) {
      const p = life(16, 'female');
      S().settings.sensitiveFamily = on;
      const bf = person('partner', 16, 80, {}, 'male'); delete bf.flags.bornAs;
      stories.tickLoveStories();
      if (p.flags.teenPregnancy) began++;
    }
    return began;
  };
  check(run(false) === 0, 'with sensitive family storylines off (as they are unless turned on), it never begins');
  const on = run(true);
  check(on > 0 && on < 60, `turned on, it is a rare thing (${on} in 400 years of teenage couples)`);
  // No action leads to it: nothing a teenager can choose is intimate.
  const p = life(16, 'female');
  const bf = person('partner', 16, 90, {}, 'male');
  check(bonds.bondActions(bf).length === 0 && !love.romanceActions(bf).some((a) => a.id === 'hookUp') && !bonds.intimate(bf.id).ok && !bonds.propose(bf.id, 'onenight').ok, 'there is no intimate action for anyone under 18, with anyone');
  // The storyline, played through.
  S().settings.sensitiveFamily = true;
  for (let i = 0; i < 4000 && !p.flags.teenPregnancy; i++) stories.tickLoveStories();
  mineOnly();
  const t = p.flags.teenPregnancy;
  const first = EVENTS.find((e) => e.id === 'teen_life_changing');
  check(t && queued('teen_life_changing').length === 1 && p.flags.pregnancy?.teen && p.flags.pregnancy.otherId === bf.id, 'it begins with the news, and a real pregnancy on the health record');
  check(!/sex|slept|night together|intimate/i.test(EVENTS.filter((e) => e.id.startsWith('teen_')).map((e) => e.text + e.choices.map((c) => c.label + c.outcomes.map((o) => o.text).join(' ')).join(' ')).join(' ')), 'and is told without any of how it came about');
  check(first.choices.length === 4 && first.ageRange[0] === 15 && first.ageRange[1] === 17, 'the first choices are about care and support');
  const enrolled = p.education.enrolled; const stage = p.education.stage;
  play('teen_life_changing', 'teenNews:doctor');
  check(queued('teen_who_to_tell').length === 1, 'then: who to tell');
  const said = play('teen_who_to_tell', 'teenTell:nobody');
  check(t.told.length === 0 && queued('teen_school').length === 1 && said, 'telling nobody yet is allowed');
  play('teen_school', 'teenSchool:accommodate');
  check(p.education.enrolled === enrolled && p.education.stage === stage && t.school === 'accommodate' && queued('teen_parenthood').length === 1, 'school goes on: nobody is made to leave');
  play('teen_parenthood', 'teenPlan:raise');
  check(t.plan === 'raise' && !love.spouse() && bf.role === 'partner', 'the decision is hers, and nobody is married off');
  stories.tickLoveStories(); stories.tickLoveStories();
  check(S().pendingEvents.filter((e) => e.id === 'teen_life_changing').length === 0 && Object.keys(p.flags.teenPregnancy).length > 0, 'it happens once in a life, not again');
  const kids = Object.values(S().npcs).filter((n) => n.role === 'child').length;
  p.stats.health = 90; advanceYear();
  const born = Object.values(S().npcs).filter((n) => n.role === 'child' && n.age <= 1 && (n.parentIds ?? []).includes(bf.id));
  check(!p.flags.pregnancy && (born.length === 0 || (born.every((k) => !k.flags.title && k.role === 'child') && Object.values(S().npcs).filter((n) => n.role === 'child').length >= kids)), 'the pregnancy runs its course once; a child born is a child like any other');
  // Family reactions differ.
  let warm = 0, cold = 0;
  for (let k = 0; k < 40; k++) {
    const q = life(16, 'female'); S().settings.sensitiveFamily = true;
    const b2 = person('partner', 16, 80, {}, 'male');
    q.flags.teenPregnancy = { year: S().year, otherId: b2.id, told: [], school: null, plan: null }; q.flags.pregnancy = { dueAge: 17, otherId: b2.id, teen: true };
    S().pendingEvents = [{ id: 'teen_who_to_tell', cast: { them: b2.id } }];
    play('teen_who_to_tell', 'teenTell:parent');
    for (const v of Object.values(q.flags.teenPregnancy.family ?? {})) (v === 'with you' ? warm++ : cold++);
  }
  check(warm > 0 && cold > 0, `parents are who they are: some are with her at once, some need time (${warm} and ${cold})`);
  // Adoption: her decision; the child is a person, placed with another family.
  const q = life(16, 'female'); S().settings.sensitiveFamily = true;
  const b3 = person('partner', 16, 80, {}, 'male');
  q.flags.teenPregnancy = { year: S().year, otherId: b3.id, told: [], school: 'stay', plan: 'adoption' };
  const { makeNpc: mk } = await import('../js/engine/npcFactory.js');
  const baby = mk({ role: 'child', countryId: q.countryId, age: 0, relationship: 80 }); baby.parentIds = [b3.id]; S().npcs[baby.id] = baby; q.npcIds.push(baby.id);
  stories.teenAfterBirth();
  check(baby.flags.placed === S().year && !q.npcIds.includes(baby.id) && S().npcs[baby.id] === baby && !/illegit/i.test(JSON.stringify(baby.flags)), 'a child placed for adoption is still a real person, with no label put on them');
}
section('the teenage pregnancy storyline: off unless turned on, from no action, rare, non-graphic; school goes on; her decisions');

// ---------- 5. Teenagers together ----------
{
  const teen = EVENTS.filter((e) => ['are_we_dating', 'friend_disapproves', 'asking_advice', 'after_graduation'].includes(e.id));
  check(teen.length === 4 && teen.every((e) => e.ageRange[0] >= 14 && e.ageRange[1] <= 18 && e.cast && Object.values(e.cast).every((r) => ['partner', 'friend', 'parent'].includes(r))), 'the scenes of being a teenager with someone need a real boyfriend, girlfriend, friend or parent');
  check(!/sex|intimate|night together/i.test(JSON.stringify(teen)), 'and are about talking, friends and school');
}
section('teenage relationship scenes: real people, age-appropriate');

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of [...new Set(problems)]) console.log(' ✗', p);
  process.exit(1);
}
for (const m of ok) console.log(' ✓', m);
console.log('Every story told is a true one.');
