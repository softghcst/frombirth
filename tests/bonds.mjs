// Relationships between adults beyond the one partner (engine/bonds.js): several at once, each its own record; what was
// promised kept apart from what is kept private; who knows kept person by person; the other person's own answer; gifts
// that cost what they cost and buy nothing; how a secret comes out, and what a partner does about it; A Complicated
// Romance and what follows it. Run with: node tests/bonds.mjs
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
const { ROMANTIC_GIFTS } = await import('../js/data/gifts.js');
const love = await import('../js/engine/romance.js');
const bonds = await import('../js/engine/bonds.js');
const turns = await import('../js/engine/turns.js');
const save = await import('../js/save.js');

rng.seed(20261119);
const problems = [];
const ok = [];
// A life in which the player has died is over: nothing after that is a fair test of these relationships, so its
// checks are not counted (a new life begins with the next scenario).
let over = false;
const check = (cond, msg) => { if (!cond && !over) problems.push(msg); };
const section = (msg) => ok.push(problems.length ? `(after failures) ${msg}` : msg);
const S = () => store.state;
const P = () => store.state.player;

/** An adult of `age` with money, in the present day, with nobody yet. */
function life(age = 30) {
  do { store.state = createLife({ countryId: 'us', gender: 'male' }); } while (S().player.royal);
  over = false;
  const p = P();
  p.age = age; p.birthYear = S().year - age; p.flags.livesWithParents = false; p.education.enrolled = false; p.education.stage = 'none';
  p.gender = 'male'; delete p.flags.bornAs; delete p.flags.identity; // these checks need to know who could have a child with whom
  p.flags.interestedIn = 'everyone'; p.stats.health = 90; p.stats.charm = 70; p.finance.cash = 500000; p.legal.incarceration = null;
  ledgerOf();
  return p;
}
/** Somebody in the player's life, with the heart given (what they want from love). */
function person(role, age = 30, rel = 80, heart = {}) {
  const p = P();
  const n = makeNpc({ role, countryId: p.countryId, age, relationship: rel, gender: 'female' });
  ensureLife(n);
  n.flags.heart = { casual: 60, secrecy: 60, commitment: 50, forgiving: 50, ...heart };
  S().npcs[n.id] = n; p.npcIds.push(n.id);
  return n;
}
const spouse = (o = {}) => { const n = person('spouse', 30, 80, o); n.marriedAtAge = 25; n.flags.livesTogether = true; return n; };
/** Asks again (a new year each time, as far as the asking goes) until the answer is yes: for setting a scene. */
function until(npc, fn, tries = 80) {
  const rel = npc.meters.relationship; // each asking as if it were the first: a refusal does not sour the next
  for (let i = 0; i < tries; i++) { npc.flags.acts = {}; npc.meters.relationship = rel; const r = fn(); if (r.ok) return r; }
  return { ok: false, text: 'never' };
}
const begin = (npc, type) => until(npc, () => bonds.propose(npc.id, type));
/** Plays a queued scene: the choice whose effect is `value`. @returns {string|null} what was told */
function play(id, value) {
  const i = S().pendingEvents.findIndex((e) => e.id === id);
  if (i < 0) return null;
  const [q] = S().pendingEvents.splice(i, 1);
  const ev = EVENTS.find((e) => e.id === id);
  const c = ev.choices.findIndex((x) => x.outcomes[0].effects.some((f) => f.value === value));
  const r = resolveChoice(ev, c, q.cast);
  return r?.text ?? r?.outcome?.text ?? '';
}
const queued = (id) => S().pendingEvents.filter((e) => e.id === id);
/** A year in which nothing else is allowed to happen to these people. */
function year() {
  const p = P(); p.stats.health = 90; p.legal.incarceration = null; p.legal.pending = null;
  for (const n of Object.values(S().npcs)) if (n.alive && p.npcIds.includes(n.id) && n.role !== 'pet') { n.meters.health = 90; if (['spouse', 'partner'].includes(n.role)) n.meters.relationship = Math.max(n.meters.relationship, 60); }
  const was = S().year;
  advanceYear();
  if (!p.alive || S().year === was) over = true; // these scenes are about love, not mortality
  // ...nor about the other person dying, or being lost from the player's life, in the middle of one.
  if (bonds.bonds().some((b) => b.type !== 'primary' && (b.end?.why === 'they died' || !S().npcs[b.npcId]?.alive))) over = true;
  S().pendingEvents = S().pendingEvents.filter((e) => /^(bond_|romance_complicated)/.test(e.id));
}

// ---------- 1. A second relationship beside a marriage ----------
{
  const p = life();
  const wife = spouse();
  const friend = person('friend', 29, 85, { secrecy: 90, commitment: 80 });
  check(bonds.bondActions(friend).some((a) => a.id === 'askSecret') && !bonds.bondActions(friend).some((a) => a.id === 'askCasual'), 'a married player may begin a private romance with a friend who is an adult');
  check(bonds.primary().exclusive === true && bonds.promised(), 'a marriage is a promise of exclusivity');
  const r = begin(friend, 'secret');
  const b = bonds.bondWith(friend.id);
  check(r.ok && b && b.type === 'secret' && b.secret && b.status === 'active' && b.npcId === friend.id, 'the friend agrees, and it is a record of its own');
  check(wife.role === 'spouse' && love.spouse().id === wife.id && bonds.primary().id !== b.id && bonds.primary().npcId === wife.id, 'the marriage is still there, and is a different record');
  check(friend.role === 'friend' && S().npcs[friend.id] === friend, 'the friend is the same person as before');
  check(bonds.isAffair(b) && bonds.label(b) === 'Affair', 'breaking a promise of exclusivity is an affair');
  check(bonds.knowledge(b, wife.id) === null && bonds.knowledge(b, friend.id) === 'knows', 'the two in it know; the spouse does not');
  check(p.flags.hadAffair === true, 'and the player knows what they have done');
  // A night together: asked, answered, a line and no more.
  const night = until(friend, () => bonds.intimate(friend.id));
  check(night.ok && /spent the night together/.test(night.text) && night.text.length < 200, 'being intimate is their choice too, and is told in a line');
  check(!bonds.intimate(friend.id).ok, 'once a year counts: it cannot be repeated for more');
  // A gift: paid for once, theirs.
  const cash = p.finance.cash;
  const g = bonds.giftsFor().find((x) => x.id === 'bracelet');
  friend.flags.acts = {};
  const gave = bonds.give(friend.id, 'bracelet');
  check(gave.ok && p.finance.cash === cash - g.price && b.gifts.length === 1 && b.gifts[0].cost === g.price, `a gift costs what it costs, once (${cash - p.finance.cash} of ${g.price})`);
  check(friend.flags.keepsakes?.length === 1 && friend.flags.keepsakes[0].id === 'bracelet', 'and is theirs');
  const again = bonds.give(friend.id, 'necklace');
  check(!again.ok && p.finance.cash === cash - g.price && b.gifts.length === 1, 'a second gift in the year is not taken, and not charged');
  check(b.history.some((h) => h.key === 'began') && b.history.some((h) => h.key === 'gift'), 'what happened is in the relationship\'s history');
  check(S().journal.some((j) => /keep it to yourselves/.test(j.text)), 'and in the life story');
  // Three months, then six: nothing is processed, or found out, on a part of a year.
  const before = JSON.stringify(S().bonds);
  turns.setStep(3); S().settings.step = 3;
  turns.advanceTurn();
  check(JSON.stringify(S().bonds) === before && !S().pendingEvents.some((e) => /^bond_|romance_compl/.test(e.id)), 'a three-month turn brings no extra chance of anything');
  // Save and load.
  const meta = save.saveGame(S());
  const back = save.loadGame(meta?.slotId ?? S().slotId);
  check(back && JSON.stringify(back.bonds) === JSON.stringify(S().bonds) && back.npcs[friend.id].flags.keepsakes.length === 1 && back.player.finance.cash === p.finance.cash, 'saved and loaded: the same relationships, people, gifts and money');
}
section('a private romance beside a marriage: two records, one promise broken, a night, a gift, saved');

// ---------- 2. Private is not cheating; open is not an affair; exclusivity is what was agreed ----------
{
  life();
  const girlfriend = person('partner', 28, 90, { casual: 100 });
  const friend = person('friend', 29, 90);
  check(bonds.primary().exclusive === null && !bonds.promised(), 'a couple who are only dating have promised nothing until they discuss it');
  begin(friend, 'secret');
  const b = bonds.bondWith(friend.id);
  check(b && b.secret && !bonds.isAffair(b) && bonds.label(b) === 'Private relationship', 'a relationship kept private, with no promise broken, is private and not an affair');
  girlfriend.flags.acts = {};
  bonds.discussExclusive(girlfriend.id);
  check(bonds.promised() && bonds.isAffair(b) && bonds.label(b) === 'Affair', 'once exclusivity is agreed, carrying on is one');
  bonds.end(friend.id);
  check(b.status === 'ended' && love.partner().id === girlfriend.id && bonds.pastWith(friend.id).length === 1 && friend.alive, 'one relationship can end while the other goes on, and its history is kept');
}
{
  life();
  const wife = spouse({ casual: 100 });
  wife.meters.relationship = 100;
  const friend = person('friend', 29, 90);
  const opened = until(wife, () => bonds.discussOpen(wife.id));
  check(opened.ok && bonds.primary().open && !bonds.promised(), 'a couple can agree to open their marriage');
  begin(friend, 'casual');
  const b = bonds.bondWith(friend.id);
  check(b && !bonds.isAffair(b) && bonds.label(b) === 'Dating casually' && !P().flags.hadAffair, 'and then seeing someone else is not an affair');
  for (let i = 0; i < 12; i++) { friend.flags.acts = {}; bonds.spendTime(friend.id); bonds.intimate(friend.id); friend.meters.relationship = 90; year(); }
  check(!queued('bond_truth').length && !queued('bond_questions').length && wife.role === 'spouse', 'nobody "finds out" what was agreed to');
}
{
  life();
  const wife = spouse({ casual: 0 });
  let no = 0, stood = true;
  // Asked forty times over (each as if for the first time): nearly always no.
  for (let i = 0; i < 40; i++) { const m = bonds.primary(); m.open = false; m.exclusive = true; wife.flags.acts = {}; wife.meters.relationship = 80; if (!bonds.discussOpen(wife.id).ok) { no++; stood = stood && bonds.promised(); } }
  check(no >= 30 && stood, `a partner who does not want an open relationship says no, and then the promise stands (${no} refusals)`);
}
section('private, open and exclusive are different things; an affair is a broken promise');

// ---------- 3. Adults only; their own answer ----------
{
  const p = life(17);
  const peer = person('friend', 17, 95);
  check(bonds.bondActions(peer).length === 0 && !bonds.propose(peer.id, 'onenight').ok && !bonds.propose(peer.id, 'casual').ok && !bonds.bondWith(peer.id), 'nothing of this is offered to a 17-year-old');
  p.age = 30;
  check(bonds.bondActions(peer).length === 0 && !bonds.propose(peer.id, 'onenight').ok, 'nor with one');
  const sister = person('sibling', 28, 95);
  const report = person('coworker', 28, 95); report.flags.report = true;
  check(!bonds.eligible(sister) && !bonds.eligible(report) && bonds.bondActions(report).length === 0, 'not family, and not someone who works under the player');
  const cold = person('friend', 30, 10, { casual: 0, secrecy: 0, commitment: 100 });
  let yes = 0; for (let i = 0; i < 25; i++) { cold.flags.acts = {}; yes += bonds.propose(cold.id, 'onenight').ok ? 1 : 0; }
  check(yes < 6 && bonds.willing(cold, 'onenight') <= 0.05, `someone who does not want to says no (${yes} of 25)`);
  const taken = person('friend', 30, 80); taken.flags.partnerOf = 'someone';
  const free = person('friend', 30, 80);
  check(bonds.willing(taken, 'casual') < bonds.willing(free, 'casual') - 0.3, 'someone with a partner of their own is far less likely to');
}
section('adults only, never family or a subordinate; the other person can say no');

// ---------- 4. Friends with benefits; one night ----------
{
  life();
  const friend = person('friend', 29, 90, { casual: 95 });
  const colleague = person('coworker', 29, 90, { casual: 95 });
  check(!bonds.propose(colleague.id, 'fwb').ok && bonds.bondActions(friend).some((a) => a.id === 'askFwb') && !bonds.bondActions(colleague).some((a) => a.id === 'askFwb'), 'friends with benefits is something asked of a friend');
  begin(friend, 'fwb');
  const b = bonds.bondWith(friend.id);
  check(b?.type === 'fwb' && friend.role === 'friend' && !love.partner() && b.exclusive !== true && !bonds.isAffair(b), 'it is its own kind of thing: still friends, not a couple, nothing exclusive');
  for (let i = 0; i < 6; i++) year();
  check(b.type === 'fwb' && friend.role === 'friend', 'and does not turn into a romance by itself');
  if (b.status === 'active') { const rel = friend.meters.relationship; bonds.end(friend.id); check(friend.role === 'friend' && friend.meters.relationship >= rel - 5, 'ended, they are friends as before'); }
  const stranger = person('acquaintance', 31, 80, { casual: 100 });
  const one = begin(stranger, 'onenight');
  const rec = bonds.pastWith(stranger.id)[0];
  check(one.ok && rec?.type === 'onenight' && rec.status === 'ended' && !bonds.bondWith(stranger.id) && !love.partner() && stranger.role === 'acquaintance', 'one night is a record, not a relationship');
}
section('friends with benefits stays what it is; one night commits nobody');

// ---------- 5. Gifts ----------
{
  const p = life();
  const friend = person('friend', 29, 90, { commitment: 100 });
  begin(friend, 'casual');
  const b = bonds.bondWith(friend.id);
  let declined = 0, taken = 0;
  for (let i = 0; i < 40; i++) {
    friend.flags.acts = {};
    const cash = p.finance.cash;
    const r = bonds.give(friend.id, 'diamonds');
    if (r.ok) { taken++; check(p.finance.cash < cash, 'a gift taken is paid for'); } else { declined++; check(p.finance.cash === cash, 'a gift handed back costs nothing'); }
  }
  check(declined > 0 && taken > 0 && b.gifts.length === taken, `a lavish gift from a new acquaintance may be handed back (${declined} of 40)`);
  friend.flags.acts = {}; friend.meters.relationship = 10;
  bonds.give(friend.id, 'flowers');
  check(!until(friend, () => bonds.intimate(friend.id), 5).ok || friend.meters.relationship >= 25, 'gifts buy no night: how things stand between them decides');
  p.finance.cash = 10; friend.flags.acts = {};
  check(!bonds.give(friend.id, 'necklace').ok && p.finance.cash === 10, 'nothing is given that cannot be paid for');
  S().year = 1890;
  check(!bonds.giftsFor().some((g) => g.id === 'phone') && bonds.giftsFor().some((g) => g.id === 'flowers') && ROMANTIC_GIFTS.find((g) => g.id === 'phone').from > 1890, 'nothing is sold before it existed');
}
section('gifts: paid once, may be refused, buy nothing, of their time');

// ---------- 6. A Complicated Romance: the four choices ----------
let lives = 0, asked = 0;
function complicated(heart = {}) {
  life();
  const wife = spouse();
  const other = person('friend', 29, 90, { secrecy: 90, commitment: 70, ...heart });
  begin(other, 'secret');
  const b = bonds.bondWith(other.id);
  check(!queued('romance_complicated_001').length, 'the question does not come before there is a history');
  for (let i = 0; i < 14 && !queued('romance_complicated_001').length && b.status === 'active'; i++) { other.meters.relationship = 90; year(); }
  // Rarely one of them dies first, and there is no conversation to have: that life is not counted (but see the tally below).
  lives++;
  if (queued('romance_complicated_001').length) asked++; else over = true;
  return { wife, other, b };
}
{
  const { wife, other, b } = complicated();
  const q = queued('romance_complicated_001');
  check(q.length === 1 && q[0].cast.them === other.id && bonds.since(b.start) >= 1, 'after a year or more, the one kept secret asks where this is going: once, and it is them');
  const ev = EVENTS.find((e) => e.id === 'romance_complicated_001');
  check(ev.queuedOnly && ev.choices.length === 4 && ev.ageRange[0] === 18, 'the scene has its four choices, is for adults, and is never drawn by chance');
  play('romance_complicated_001', 'complicated:honest');
  check(b.arc.complicated.choice === 'honest' && b.arc.answerDue === S().year + 1 && b.status === 'active' && bonds.knowledge(b, wife.id) !== 'knows', 'an honest conversation: nothing decided, an answer owed, nobody told');
  for (let i = 0; i < 3; i++) { other.meters.relationship = 90; year(); }
  check(queued('romance_complicated_001').length === 0, 'the same question is not asked again');
  check(queued('bond_answer').length === 1, `a year on, they need an answer (${JSON.stringify({ status: b.status, end: b.end, arc: b.arc, alive: other.alive, year: S().year, pending: S().pendingEvents.map((e) => e.id) })})`);
  play('bond_answer', 'answer:end');
  check(b.status === 'ended' && other.alive && bonds.pastWith(other.id).length === 1 && b.history.length >= 3, 'letting them go ends it, and the history stays');
  for (let i = 0; i < 4; i++) year();
  check(!queued('bond_answer').length && !queued('romance_complicated_001').length, 'and nothing more is asked about what is over');
}
{
  const { wife, other, b } = complicated();
  play('romance_complicated_001', 'complicated:public');
  check(b.promise?.what === 'public' && b.promise.year === S().year && bonds.knowledge(b, wife.id) === null && wife.role === 'spouse', 'saying it may become public is a promise, and tells nobody');
  other.meters.relationship = 90; year();
  check(queued('bond_promise').length === 1, 'a year later the promise is remembered');
  // (If the marriage has ended by other means in the meantime, there is no spouse left to tell: not this check's business.)
  if (!wife.alive || wife.role !== 'spouse') over = true;
  const told = play('bond_promise', 'promise:keep') ?? '';
  check(bonds.knowledge(b, wife.id) === 'knows' && b.knows[wife.id]?.how === 'you told them yourself' && told.length > 0, 'keeping it means telling the spouse: and now they know, because they were told');
  check(wife.role === 'ex' || bonds.primary()?.arc.rebuilding || bonds.primary()?.open, 'and the spouse does what they will with it');
}
{
  let ended = 0, cooling = 0, calm = 0;
  for (let i = 0; i < 24; i++) {
    const { other, b } = complicated(i % 3 === 0 ? { commitment: 20, secrecy: 30 } : { commitment: 90 });
    if (!queued('romance_complicated_001').length) continue;
    play('romance_complicated_001', 'complicated:notReady');
    if (b.status === 'ended') { ended++; check(/they wanted more/.test(b.end.why) && other.alive, 'they leave for their own reason'); } else if (b.arc.cooling) cooling++; else calm++;
  }
  check(ended > 0 && (cooling > 0 || calm > 0), `not ready for more: some accept it, some need time, some go (${ended} gone, ${cooling} thinking, ${calm} content)`);
}
{
  const { other, b } = complicated();
  play('romance_complicated_001', 'complicated:end');
  check(b.status === 'ended' && b.arc.respectful && other.alive && other.role === 'friend' && love.spouse(), 'ending it respectfully ends that relationship and no other');
}
{
  life();
  spouse();
  for (let i = 0; i < 8; i++) year();
  check(!S().pendingEvents.some((e) => /^bond_|romance_compl/.test(e.id)) && bonds.others().length === 0, 'with no such relationship, no such scene: nothing is invented');
}
over = false;
check(asked >= lives - 3 && asked >= 20, `in nearly every such life the question is asked (${asked} of ${lives})`);
section('A Complicated Romance: asked once by a real person, four choices, follow-ups from what was actually said');

// ---------- 7. Being found out; staying or going ----------
{
  // Nothing done that could be seen, nobody who knows: no discovery, however long.
  life();
  const wife = spouse();
  const other = person('friend', 29, 90, { secrecy: 100, commitment: 0 });
  person('friend', 30, 80); person('sibling', 33, 80);
  begin(other, 'secret');
  const b = bonds.bondWith(other.id);
  b.arc.complicated = { year: S().year, choice: 'honest' }; // the conversation has been had
  for (let i = 0; i < 25 && b.status === 'active'; i++) { other.meters.relationship = 90; b.acts = {}; year(); }
  check(Object.keys(b.knows).length === 0 && wife.role === 'spouse' && !queued('bond_truth').length, 'a secret is not exposed by the calendar: with nothing to see and nobody told, nobody knows');
}
{
  let found = 0, suspected = 0, viaWitness = 0;
  for (let n = 0; n < 14; n++) {
    life();
    const wife = spouse();
    const other = person('friend', 29, 90, { secrecy: 100, commitment: 0 });
    const pal = person('friend', 30, 20); const sib = person('sibling', 33, 30);
    begin(other, 'secret');
    const b = bonds.bondWith(other.id);
    b.arc.complicated = { year: S().year, choice: 'honest' };
    for (let i = 0; i < 20 && b.status === 'active' && !queued('bond_truth').length; i++) {
      other.flags.acts = {}; other.meters.relationship = 90;
      bonds.spendTime(other.id); bonds.intimate(other.id); other.flags.acts = {}; bonds.give(other.id, 'flowers');
      year();
      for (const q of queued('bond_questions')) { suspected++; check(b.knows[wife.id]?.level === 'suspects' && !queued('bond_truth').length, 'a doubt is a question, not proof'); play('bond_questions', 'questions:deny'); void q; }
    }
    const k = b.knows[wife.id];
    if (k?.level === 'knows') {
      found++;
      // Whoever told is on the record: the other person themselves, or someone who knew first.
      const teller = S().npcs[k.fromId];
      void pal; void sib;
      check(k.how && teller && (teller.id === other.id || b.knows[teller.id]?.level === 'knows'), `the spouse knows only by a way that exists: ${k.how}`);
      if (teller && teller.id !== other.id) { viaWitness++; check(b.knows[teller.id].year < k.year, 'someone who saw it first, and told later'); }
    }
  }
  check(found > 0 && suspected > 0, `carried on in plain sight, it is sometimes suspected and sometimes found out (${found} found, ${suspected} doubts, ${viaWitness} told by a witness)`);
}
{
  let stayed = 0, left = 0, rebuilt = 0, gone = 0;
  for (let n = 0; n < 24; n++) {
    life();
    const wife = spouse({ forgiving: n % 2 ? 95 : 10 });
    const other = person('friend', 29, 90);
    begin(other, 'secret');
    const b = bonds.bondWith(other.id);
    const said = bonds.confess(wife.id);
    check(said.ok && bonds.knowledge(b, wife.id) === 'knows' && wife.memories.some((m) => m.key === 'cheated'), 'told the truth, the spouse knows, and remembers');
    const m = bonds.bonds().find((x) => x.npcId === wife.id);
    if (wife.role === 'ex') { left++; check(m.status === 'ended' && m.history.some((h) => h.key === 'found'), 'a spouse who leaves has left: the marriage is over, its history kept'); continue; }
    stayed++;
    check(m.trust < 70 && m.arc.rebuilding && wife.role === 'spouse', 'a spouse who stays has not forgiven: trust is low, and to be rebuilt');
    bonds.end(other.id);
    for (let i = 0; i < 8 && m.arc.rebuilding && wife.role === 'spouse'; i++) year();
    if (m.arc.rebuilt) { rebuilt++; check(m.history.some((h) => h.key === 'found') && m.history.some((h) => h.key === 'rebuilt'), 'rebuilt, the marriage still remembers what happened'); } else if (wife.role === 'ex') gone++;
  }
  check(stayed > 0 && left > 0, `some spouses stay and some go (${stayed} stayed, ${left} left)`);
  check(rebuilt > 0, `trust can come back with time (${rebuilt} rebuilt, ${gone} left later)`);
}
section('discovery only by a real way; suspicion is not proof; reconciliation possible, never promised');

// ---------- 8. Pregnancy: possible, never certain, never doubled ----------
{
  const p = life();
  const other = person('friend', 28, 90, { casual: 100 });
  begin(other, 'casual');
  p.hidden.fertility = 90;
  const run = (n) => { let c = 0; for (let i = 0; i < n; i++) { p.flags.pregnancy = null; other.flags.acts = {}; other.meters.relationship = 90; bonds.intimate(other.id); if (p.flags.pregnancy) c++; } return c; };
  bonds.setBirthControl(true);
  const careful = run(1500);
  bonds.setBirthControl(false);
  const not = run(1500);
  check(not > 30 && not < 400 && careful < not / 2, `a night can lead to a pregnancy, usually does not, and far less often with birth control (${not} and ${careful} in 1500)`);
  p.flags.pregnancy = null;
  for (let i = 0; i < 300 && !p.flags.pregnancy; i++) { other.flags.acts = {}; other.meters.relationship = 90; bonds.intimate(other.id); }
  const first = JSON.stringify(p.flags.pregnancy);
  for (let i = 0; i < 100; i++) { other.flags.acts = {}; bonds.intimate(other.id); }
  check(first !== 'null' && JSON.stringify(p.flags.pregnancy) === first && p.flags.pregnancy.otherId === other.id, 'one pregnancy at a time: more nights do not make another');
  const kids = Object.values(S().npcs).filter((n) => n.role === 'child').length;
  year();
  const born = Object.values(S().npcs).filter((n) => n.role === 'child');
  // (A birth can go wrong, or be twins: what is checked is whose child it is, that the pregnancy is over, and that nobody was married off.)
  check(born.length >= kids && born.slice(kids).every((c) => c.parentIds.includes(other.id)) && !p.flags.pregnancy && !love.spouse(), `the pregnancy runs its course: any child is theirs, and nobody is married off because of it (${born.length - kids} born)`);
  const same = person('friend', 28, 90, { casual: 100 }); same.gender = 'male';
  begin(same, 'casual');
  bonds.setBirthControl(false);
  for (let i = 0; i < 200; i++) { same.flags.acts = {}; same.meters.relationship = 90; bonds.intimate(same.id); }
  check(!p.flags.pregnancy, 'only where two people could have a child together');
}
section('pregnancy: possible, not certain, respects birth control, one at a time');

// ---------- 9. Cars and homes: owning is not living there ----------
{
  const p = life();
  const wife = spouse();
  const other = person('friend', 29, 90, { secrecy: 100, commitment: 0 });
  begin(other, 'secret');
  const b = bonds.bondWith(other.id);
  b.start.year -= 3; // together some years: past the stage where a large gift is too much
  const flat = { id: 'asset_flat', kind: 'property', name: 'A flat on Elm Street', value: 200000, purchasePrice: 200000, condition: 80 };
  const house = { id: 'asset_house', kind: 'property', name: 'A house by the sea', value: 400000, purchasePrice: 400000, condition: 80, mortgage: { principal: 100000, code: 'USD' } };
  const car = { id: 'asset_car', kind: 'vehicle', name: 'Red convertible', value: 30000, purchasePrice: 30000 };
  p.assets.push(flat, house, car);
  check(bonds.givable().map((a) => a.id).sort().join() === 'asset_car,asset_flat' && !bonds.transfer(other.id, house.id).ok && p.assets.includes(house), 'what still has a loan on it cannot be given away');
  // Living there: still the owner's.
  const moved = until(other, () => bonds.house(other.id, flat.id));
  check(moved.ok && flat.occupant?.npcId === other.id && other.flags.housedIn === flat.id && p.assets.includes(flat) && !other.flags.owned, 'someone given a home to live in lives there; it is still the player\'s');
  check(!bonds.spareHomes().includes(flat) && !bonds.house(wife.id, flat.id).ok, 'and nobody else can be put in it');
  check(p.assets.filter((a) => a.kind === 'property').length === 2, 'it is still in the estate');
  const out = bonds.unhouse(flat.id);
  check(out.ok && !flat.occupant && !other.flags.housedIn && p.assets.includes(flat), 'asked to leave, they leave, and nothing changes hands');
  // Made over: theirs.
  p.flags.will = { mode: 'named', heirs: [wife.id], items: { [car.id]: wife.id } };
  const cash = p.finance.cash;
  const gave = until(other, () => bonds.transfer(other.id, car.id));
  const fee = Math.round(30000 * bonds.TRANSFER_FEE);
  check(gave.ok && !p.assets.includes(car) && other.flags.owned?.length === 1 && other.flags.owned[0].id === car.id && p.finance.cash === cash - fee, `a car made over is theirs, and the fees are paid once (${cash - p.finance.cash} of ${fee})`);
  check(!p.flags.will.items[car.id], 'a will cannot leave what was given away');
  check(!bonds.transfer(other.id, car.id).ok && other.flags.owned.length === 1, 'it cannot be given twice');
  bonds.end(other.id);
  check(other.flags.owned.length === 1 && !p.assets.includes(car), 'and it stays theirs when the relationship ends');
  check(wife.role === 'spouse' && bonds.knowledge(b, wife.id) === null, 'none of which tells the spouse anything by itself');
}
section('cars and homes: living there is not owning; a gift made over is theirs for good; loans stay where they are');

// ---------- 10. Going away together ----------
{
  const p = life();
  const other = person('friend', 29, 90);
  begin(other, 'casual');
  const b = bonds.bondWith(other.id);
  const t = bonds.tripsFor()[0];
  const cash = p.finance.cash;
  other.flags.acts = {};
  const went = bonds.trip(other.id, t.id);
  check(p.finance.cash === cash - t.cost && b.history.some((h) => h.key === 'trip') && typeof went.ok === 'boolean', `a trip for two is paid for once (${cash - p.finance.cash} of ${t.cost})`);
  check(!bonds.trip(other.id, t.id).ok && p.finance.cash === cash - t.cost, 'and not charged again');
  let good = 0, bad = 0;
  for (let i = 0; i < 40; i++) { other.flags.acts = {}; other.meters.relationship = 80; (bonds.trip(other.id, t.id).ok ? good++ : bad++); }
  check(good > 0 && bad > 0, `a trip can go well or badly (${good} and ${bad})`);
  other.flags.acts = {}; other.meters.relationship = 10;
  const c2 = p.finance.cash;
  check(!bonds.trip(other.id, t.id).ok && p.finance.cash === c2, 'and they can say no to it, at no cost');
}
section('trips: paid once, may go badly, may be declined');

// ---------- 11. Children in two households ----------
{
  const p = life();
  p.career.salary = 80000;
  const wife = spouse();
  const other = person('friend', 28, 90, { secrecy: 100, commitment: 0 });
  begin(other, 'secret');
  const b = bonds.bondWith(other.id);
  b.arc.complicated = { year: S().year, choice: 'honest' };
  // A child at home, and a child with the other.
  const { newborn } = await import('../js/engine/children.js');
  const kidsBefore = Object.values(S().npcs).filter((n) => n.role === 'child').length;
  const { makeNpc: mk } = await import('../js/engine/npcFactory.js');
  const add = (parent, name) => { const k = mk({ role: 'child', countryId: p.countryId, age: 0, relationship: 80 }); k.firstName = name; k.parentIds = [parent.id]; S().npcs[k.id] = k; p.npcIds.push(k.id); return k; };
  void newborn;
  const home = add(wife, 'Ada');
  const away = add(other, 'Ben');
  other.meters.relationship = 90; b.acts = {};
  year();
  check(home.flags.household === 'player' && !home.flags.livesWith, 'a child of the marriage lives at home');
  check(away.flags.household === other.id && away.flags.livesWith === other.id && b.childIds?.includes(away.id), 'a child with someone the player does not live with lives with their mother');
  const sup = (p.finance.support ?? []).filter((x) => x.childId === away.id);
  check(sup.length === 1 && sup[0].dir === 'pay' && sup[0].kind === 'child' && sup[0].amount === Math.round(80000 * 0.12) && sup[0].until > sup[0].since + 15 && sup[0].until <= sup[0].since + 18, `the player owes support for that child, by the usual share of income (${sup[0]?.amount})`);
  other.meters.relationship = 90; b.acts = {};
  year(); year();
  check((p.finance.support ?? []).filter((x) => x.childId === away.id).length === 1, 'one obligation, not one a year');
  check(bonds.halfSiblings(home, away) && !bonds.halfSiblings(home, home) && Object.values(S().npcs).filter((n) => n.role === 'child').length === kidsBefore + 2, 'the two children are half-siblings, each one person');
  check(bonds.knowsOfChild(away, other.id) && !bonds.knowsOfChild(away, wife.id) && bonds.knowsOfChild(home, wife.id), 'the spouse has not been told about a child of a relationship they do not know of');
  if (wife.role === 'spouse' && b.status === 'active') { bonds.confess(wife.id); check(bonds.knowsOfChild(away, wife.id), 'and knows once they have been told'); }
  check(away.role === 'child' && S().npcs[away.id] === away && away.parentIds.includes(other.id), 'whatever becomes of the adults, the child is the same child');
  const { roleLabel } = await import('../js/engine/relationships.js');
  const sib = person('sibling', 20); sib.flags.half = true;
  check(/^Half-/.test(roleLabel(sib)), 'a half-sibling is called one');
}
section('children across households: where they live, support owed once and yearly, half-siblings, who has been told');

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of [...new Set(problems)]) console.log(' ✗', p);
  process.exit(1);
}
for (const m of ok) console.log(' ✓', m);
console.log('Complicated relationships hold together.');
