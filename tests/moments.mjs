// Checks the living moments: what a year holds, marked at once, and finished by Age Up.
// Run with: node tests/moments.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { COUNTRIES } = await import('../js/data/countries.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { ensureLife } = await import('../js/engine/npcLives.js');
const { audit, bookAction, ledgerOf } = await import('../js/engine/ledger.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { getEvent, resolveChoice } = await import('../js/engine/eventEngine.js');
const { heirs, continueAs } = await import('../js/engine/legacy.js');
const death = await import('../js/engine/death.js');
const mo = await import('../js/engine/moments.js');
const { OCCASIONS, SOCIAL_PER_YEAR, BOND_CAP } = await import('../js/data/occasions.js');
const { techAvailable } = await import('../js/engine/digital/tech.js');

rng.seed(808);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const item = (key) => mo.thisYear().find((x) => x.key === key);

/** A life at a given age, with nobody in it but who the test adds. */
function life(id = 'us', age = 30, cash = 50000) {
  do { store.state = createLife({ countryId: id }); } while (store.state.player.royal);
  const p = store.state.player;
  p.flags.longevity = 18; p.stats.health = 100; (p.health ??= {}).ailments = []; // these checks follow one life through several years: it should not end by chance partway
  p.age = age; p.birthYear = store.state.year - age; p.flags.livesWithParents = age < 18; p.education.enrolled = false;
  p.finance.cash = Math.round(cash * COUNTRIES[id].currency.scale);
  for (const n of Object.values(store.state.npcs)) n.alive = false;
  p.npcIds = [];
  ledgerOf();
  return p;
}
function person(role, age, relationship = 60) {
  const p = store.state.player;
  const n = makeNpc({ role, countryId: p.countryId, age, relationship });
  store.state.npcs[n.id] = n; p.npcIds.push(n.id); ensureLife(n);
  if (n.life?.fin) n.life.fin = null;
  return n;
}

// ---------- 1. An occasion is resolved at once, in the current year ----------
let p = life('us', 29);
const a = person('friend', 30, 50); const b = person('sibling', 33, 50);
p.age = 30; // a round birthday
let it = item('birthday:you');
check(it && !it.done && it.label === 'Your 30th birthday', 'the player\'s birthday is on this year\'s list');
const year0 = store.state.year; const cash0 = p.finance.cash; const ra = a.meters.relationship;
let r = mo.celebrate({ key: 'birthday:you', guests: [a.id, b.id], style: 'party' });
const expected = mo.costOf(it, 2, 'party');
check(r.ok && r.cost === expected && p.finance.cash === cash0 - expected, 'it costs what it says, at once');
check(store.state.year === year0 && a.meters.relationship === ra + 5, 'in the current year, and the guests are closer straight away');
check(item('birthday:you').done && !mo.celebrate({ key: 'birthday:you', guests: [a.id], style: 'party' }).ok && p.finance.cash === cash0 - expected, 'it is done for this year: a second go is refused, and nothing more is spent');
check(p.milestones.some((m) => m.text === 'Celebrated turning 30.') && a.memories?.length > 0, 'a round birthday goes in the life story, and the guests remember it');
check(store.state.journal.at(-1).text.startsWith('Your 30th birthday'), 'and in the journal');
bookAction(); check(audit().length === 0, 'the books balance after it');
section('an occasion is marked at once, in the current year, and only once');

// ---------- 2. Only people really in the player's life can come ----------
p = life('us', 30);
const real = person('friend', 30);
const stranger = makeNpc({ role: 'friend', countryId: 'us', age: 30 }); store.state.npcs[stranger.id] = stranger; // known to the world, not to the player
r = mo.celebrate({ key: 'social:dinner_party', guests: [real.id, stranger.id, 'nobody', real.id] });
check(r.ok && r.guests.length === 1 && r.guests[0] === real.id, 'guests are persistent characters from the player\'s life, each counted once');
check(mo.guestPool('friends').every((n) => p.npcIds.includes(n.id) && n.alive), 'the guest list is drawn only from the living people in the player\'s life');
section('guests are real, persistent characters');
check(mo.familyPlural('Farkas') === 'Farkases' && mo.familyPlural('Jones') === 'Joneses' && mo.familyPlural('Smith') === 'Smiths' && mo.familyPlural('Church') === 'Churches', 'a family is named as a family: the Farkases, the Joneses, the Smiths');

// ---------- 3. Limits that stop the same thing being clicked for ever ----------
p = life('us', 30);
const friends = [person('friend', 30, 40), person('friend', 31, 40), person('friend', 32, 40)];
let done = 0;
for (const id of ['game_night', 'dinner_party', 'game_night', 'dinner_party']) if (mo.celebrate({ key: `social:${id}`, guests: friends.map((n) => n.id) }).ok) done += 1;
check(done === 2, 'each kind of evening once a year');
check(friends.every((n) => n.meters.relationship <= 40 + BOND_CAP), 'and nobody grows closer than the yearly cap from occasions');
const capped = person('friend', 30, 20);
mo.celebrate({ key: 'birthday:you', guests: [capped.id], style: 'big' });
check(capped.meters.relationship - 20 <= BOND_CAP, 'the cap holds across different occasions too');
check(SOCIAL_PER_YEAR >= 2 && mo.yearState().social === 2, 'evenings are counted against the year');
section('annual limits: once each a year, and a cap on how much closer anyone gets');

// ---------- 4. Age Up finishes the year, without redoing what was done ----------
p = life('us', 40, 100000);
const fam = [person('sibling', 42, 70), person('parent', 68, 70), person('sibling', 38, 70)];
it = item('holiday:christmas');
check(!!it, 'Christmas is kept in the United States');
r = mo.celebrate({ key: 'holiday:christmas', guests: fam.map((n) => n.id), makeTradition: true });
const t = mo.traditions()[0];
check(r.ok && t && t.hostId === 'you' && t.count === 1 && t.lastYear === store.state.year && t.participants.length === 4, 'a holiday can become a family tradition, with its founder, host and family');
check(p.milestones.some((m) => m.text.startsWith('Began a family tradition')), 'and that is in the life story');
const spentBefore = p.finance.cash;
const yearOfIt = store.state.year;
advanceYear(); store.state.pendingEvents = [];
check(t.count === 1 && t.lastYear === yearOfIt, 'Age Up does not keep a tradition again that was kept by hand that year');
check((p.momentsYears ?? []).some((y) => y.year === yearOfIt && y.lines.includes('Celebrate Christmas')), 'the year\'s summary is recorded');
const beforeAuto = p.finance.cash;
advanceYear(); store.state.pendingEvents = [];
check(t.count === 2 && t.lastYear === yearOfIt + 1, 'a tradition nobody organized happens by itself at Age Up, once');
check(store.state.ledger.tx.some((x) => x.desc === t.name && x.year === yearOfIt + 1 && x.cat === 'leisure'), 'and its host pays for it, recorded under its name');
void beforeAuto;
advanceYear(); store.state.pendingEvents = [];
check(t.count === 3, 'once a year, every year');
void spentBefore;
// Skipping: three years running and it fades.
for (let i = 0; i < 3; i++) { check(mo.skipTradition(t.id).ok, 'a tradition can be skipped'); advanceYear(); store.state.pendingEvents = []; }
check(p.alive, 'the life is still going');
check(t.status === 'lapsed' && t.count === 3, 'skipped three years running, it fades, and was not kept in those years');
check(mo.revive(t.id).ok && t.status === 'active', 'a faded tradition can be brought back');
bookAction(); check(audit().length === 0, 'the books balance through all of it');
section('Age Up keeps traditions nobody organized, never twice, and lets skipped ones fade');

// ---------- 5. Invitations ----------
p = life('us', 30, 50000);
const pal = person('friend', 30, 80); const cool = person('friend', 30, 40);
const s = mo.yearState();
s.invites.push({ id: 'inv_a', kind: 'friend_birthday', name: 'birthday party', fromId: pal.id, gift: 25, bond: 4, how: 'message', answer: null },
  { id: 'inv_b', kind: 'friend_birthday', name: 'birthday party', fromId: cool.id, gift: 25, bond: 4, how: 'message', answer: null },
  { id: 'inv_c', kind: 'wedding', name: 'wedding', fromId: pal.id, gift: 120, bond: 7, memorable: true, how: 'message', answer: null });
const c5 = p.finance.cash; const rc = cool.meters.relationship;
check(mo.answerInvite('inv_c', true).ok && p.finance.cash < c5 && pal.memories?.some((m) => m.key === 'invite:inv_c'), 'going to an invitation costs a present, now, and is remembered');
check(!mo.answerInvite('inv_c', true).ok, 'an invitation is answered once');
const c5b = p.finance.cash; const rp = pal.meters.relationship;
advanceYear(); store.state.pendingEvents = [];
check(pal.meters.relationship > rp - 1 && p.finance.cash !== c5b, 'at Age Up a close friend\'s unanswered invitation is gone to');
check(cool.meters.relationship <= rc, 'and a distant one\'s is missed, and noticed');
check(mo.yearState().year === store.state.year && mo.yearState().invites.every((x) => x.answer == null), 'the new year starts with its own invitations');
check(mo.yearState().invites.every((x) => p.npcIds.includes(x.fromId) && store.state.npcs[x.fromId].alive), 'invitations come from people really in the player\'s life');
section('invitations: answered now, or resolved once at Age Up');

// ---------- 6. Save and reload ----------
p = life('us', 45, 100000);
const kin = [person('sibling', 47), person('child', 18), person('parent', 72), person('relative', 50)];
mo.celebrate({ key: 'family_reunion', guests: kin.map((n) => n.id), style: 'party', makeTradition: true });
const mate = person('friend', 44);
check(mo.celebrate({ key: 'social:game_night', guests: [mate.id] }).ok, 'a games night with a friend');
const snapM = JSON.stringify(store.state.moments); const snapT = JSON.stringify(store.state.traditions);
saveGame(store.state); store.state = loadGame(store.state.slotId); p = store.state.player;
check(JSON.stringify(store.state.moments) === snapM && JSON.stringify(store.state.traditions) === snapT, 'what was done this year, and the traditions, come back exactly after a reload');
const tr6 = mo.traditions()[0];
check(!item('family_reunion') && item(`tradition:${tr6.id}`).done && !mo.celebrate({ key: `tradition:${tr6.id}`, guests: [], style: 'party' }).ok && item('social:game_night').done, 'and a reload does not let anything be done again');
check(mo.thisYear().filter((x) => x.occasion === 'family_reunion').length === 1, 'a tradition is listed once, in place of the occasion it grew from');
section('moments and traditions survive a save and reload');

// ---------- 7. Traditions outlive the people who began them ----------
p = life('us', 70, 200000);
const heir = person('child', 40, 80); const grandkid = person('grandchild', 12, 70); const sib = person('sibling', 66, 70);
mo.celebrate({ key: 'holiday:thanksgiving', guests: [heir.id, grandkid.id, sib.id], makeTradition: true });
const t7 = mo.traditions()[0];
death.die('a test');
check(heirs(store.state).some((n) => n.id === heir.id), 'the grown child can carry the family on');
if (heirs(store.state).some((n) => n.id === heir.id)) {
  const next = continueAs(heir.id);
  store.state = next;
  const t7b = mo.traditions()[0];
  check(t7b && t7b.id === t7.id && t7b.founder.name === t7.founder.name && t7b.founded === t7.founded, 'the heir inherits the tradition, with its founder and founding year');
  check(t7b.hostId === 'you' && t7b.participants.includes('you') && !t7b.participants.includes(heir.id), 'the heir hosts it now, as the player');
  check(t7b.history.some((h) => /died/.test(h.text)), 'and its history says what happened');
  advanceYear(); store.state.pendingEvents = [];
  check(t7b.count === 1, 'the year it was kept in is not kept again by the heir');
  next.player.finance.cash = Math.max(next.player.finance.cash, 1e6);
  advanceYear(); store.state.pendingEvents = [];
  check(t7b.count === 2, 'and it carries on in the new life');
}
section('traditions are passed down the family');

// ---------- 8. A host growing old, and the scene that follows ----------
p = life('us', 40, 100000);
const gran = person('grandparent', 79, 80); const cuz = person('relative', 35, 60);
mo.traditions().push({ id: 'trad_x', occasion: 'family_reunion', holiday: null, name: 'The reunion', founded: 1990, founder: { id: gran.id, name: gran.firstName },
  hostId: gran.id, participants: ['you', gran.id, cuz.id], lastYear: 0, count: 30, skipped: [], history: [], status: 'active' });
mo.finishYear();
const q = store.state.pendingEvents.find((x) => x.id === 'tradition_handover');
check(q && q.cast.host === gran.id, 'an old host prompts a scene about who takes it on');
resolveChoice(getEvent('tradition_handover'), 0, q.cast);
check(mo.traditions().find((x) => x.id === 'trad_x').hostId === 'you', 'and choosing to host it makes the player the host');
section('the story moves a tradition on when its host grows old');

// ---------- 9. Time and place ----------
p = life('us', 17); p.education.enrolled = true; p.education.stage = 'high';
check(!!item('prom') && !!item('school_dance'), 'an American at high school has a prom and a dance');
store.state.year = 1920; store.state.moments = null;
check(!item('prom') && !item('school_dance'), 'but not in 1920, before either existed');
p = life('jp', 17); p.education.enrolled = true; p.education.stage = 'high';
check(!item('prom') && !item('holiday:thanksgiving') && !item('holiday:christmas'), 'nor in Japan, where neither is the custom');
check(!!item('holiday:new_year'), 'though New Year is kept everywhere');
p = life('in', 30);
check(!!item('holiday:diwali') && !item('holiday:thanksgiving'), 'Diwali in India');
p = life('us', 30); person('friend', 30, 70);
/** This year's invitations, dealt again until there is at least one. */
const dealtIn = (year) => { store.state.year = year; for (let i = 0; i < 30; i++) { store.state.moments = null; mo.startYear(); if (mo.yearState().invites.length) break; } return mo.yearState().invites; };
const ways = (year) => [...new Set(dealtIn(year).map((x) => x.how))];
check(!techAvailable('mobile', 1985, 'us') && ways(1985).every((h) => h === 'call'), 'in 1985 an invitation comes by telephone, the newest way there was');
check(ways(1880).every((h) => h === 'card'), 'in 1880, as a card by post');
check(ways(1820).every((h) => h === 'word'), 'in 1820, before the postal service here, by word of mouth');
check(ways(2030).every((h) => h === 'message'), 'and today, as a message');
p = life('us', 10); p.flags.livesWithParents = true; person('parent', 40); const kid = person('friend', 10);
const c9 = p.finance.cash;
check(mo.celebrate({ key: 'social:sleepover', guests: [kid.id] }).ok && p.finance.cash === c9, 'a child\'s sleepover is paid for by the family');
check(!item('social:dinner_party'), 'and a ten-year-old does not host dinner parties');
section('what is on offer follows the year, the country and the age');

// ---------- 10. Whole lives: never duplicated, always balanced ----------
for (const id of ['us', 'uk', 'in', 'mx']) {
  // A child can die young; the checks here are about a life's occasions, so a life that ends before five starts again.
  for (let attempt = 0; attempt < 6; attempt++) {
  do { store.state = createLife({ countryId: id }); } while (store.state.player.royal);
  p = store.state.player;
  var seen = new Set();
  while (p.alive && p.age < 90) {
    for (const x of mo.thisYear().filter((y) => !y.done && y.ok && !y.inviteId && !y.traditionId)) {
      const guests = mo.suggestedGuests(x);
      const o = OCCASIONS[x.occasion] ?? {};
      if (rng.chance(0.5)) mo.celebrate({ key: x.key, guests, style: o.styles?.[0], makeTradition: rng.chance(0.3) });
    }
    for (const inv of mo.yearState().invites.filter((v) => v.answer == null)) if (rng.chance(0.5)) mo.answerInvite(inv.id, rng.chance(0.7));
    const keys = mo.yearState().log.map((l) => l.key);
    if (new Set(keys).size !== keys.length) { problems.push(`${id}: something was done twice in ${store.state.year}`); break; }
    const before = Object.fromEntries(mo.traditions().map((tr) => [tr.id, tr.count]));
    advanceYear(); store.state.pendingEvents = [];
    for (const tr of mo.traditions()) if ((tr.count - (before[tr.id] ?? tr.count)) > 1) problems.push(`${id}: ${tr.name} was kept twice in a year`);
    bookAction();
    const bad = audit(); if (bad.length) { problems.push(`${id}, age ${p.age}: ${bad[0]}`); break; }
    seen.add(store.state.year);
  }
  if (seen.size >= 5 || problems.length) break;
  }
  check(seen.size >= 5, `${id}: some years were lived`);
}
section('whole lives: nothing marked twice, traditions at most once a year, the books balanced');

// ---------- 11. Shorter turns: the year is still the year ----------
{
  const turns = await import('../js/engine/turns.js');
  for (const step of [6, 3]) {
    p = life('us', 40, 100000);
    const kin11 = [person('sibling', 42, 60), person('parent', 70, 60), person('sibling', 37, 60)];
    turns.setStep(step);
    const y11 = store.state.year;
    check(mo.celebrate({ key: 'holiday:christmas', guests: kin11.map((n) => n.id), makeTradition: true }).ok, `${step}-month turns: an occasion can be marked`);
    const t11 = mo.traditions()[0];
    const cash11 = p.finance.cash;
    let turnsInYear = 0;
    while (store.state.year === y11 && turnsInYear < 12) { turns.advanceTurn(); store.state.pendingEvents = []; turnsInYear += 1;
      if (store.state.year === y11) check(item('holiday:christmas') === undefined && item(`tradition:${t11.id}`).done && p.finance.cash === cash11, `${step}-month turns: still done, and nothing spent again, partway through the year`); }
    check(turnsInYear === 12 / step, `${step}-month turns: the year takes ${12 / step} turns`);
    check(t11.count === 1 && (p.momentsYears ?? []).filter((x) => x.year === y11).length === 1, `${step}-month turns: the year is finished once, at the turn of the year`);
    for (let i = 0; i < 12 / step; i++) { turns.advanceTurn(); store.state.pendingEvents = []; }
    check(t11.count === 2, `${step}-month turns: the tradition is kept once the next year`);
  }
}
section('with six- or three-month turns, a year\'s occasions still happen once, and Age Up finishes the year once');

// ---------- A baby's year: the family pays, as the screen says ----------
{
  const baby = life('us', 1, 0);
  const mom = person('parent', 30, 90); const dad = person('parent', 32, 90);
  const money = (n) => (n.life ? n.life.savings : n.savings) ?? 0;
  if (mom.life) mom.life.savings = Math.round(5000 * COUNTRIES.us.currency.scale); else mom.savings = Math.round(5000 * COUNTRIES.us.currency.scale);
  const holiday = mo.thisYear().find((x) => x.holiday && x.ok && !x.done);
  check(holiday && mo.costOf(holiday, 0) > 0 && mo.familyPays(), 'a baby at home with parents: the family pays for what the year holds');
  const r = holiday ? mo.celebrate({ key: holiday.key, guests: mo.suggestedGuests(holiday) }) : { ok: false, text: 'no holiday' };
  check(r.ok && baby.finance.cash === 0 && /Your family paid/.test(r.text), `a holiday is marked with no money of the baby's own (${r.text})`);
  // A scene's cost for a young child comes out of the parents' savings, not the child's cash.
  const { applyEffects } = await import('../js/engine/effects.js');
  const before = money(mom) + money(dad);
  applyEffects([{ type: 'cash', delta: -150 }], { cast: {} });
  check(baby.finance.cash === 0 && money(mom) + money(dad) === before - Math.round(150 * COUNTRIES.us.currency.scale), 'a family portrait at age one is paid for by the parents');
  // A teenager pays from their own pocket.
  const teen = life('us', 15, 100);
  person('parent', 45, 80);
  applyEffects([{ type: 'cash', delta: -20 }], { cast: {} });
  check(teen.finance.cash === Math.round(80 * COUNTRIES.us.currency.scale), 'a teenager pays for their own choices');
}
section('a child at home: the family pays for occasions and for scenes, as the screen says; a teenager pays their own way in scenes');

for (const line of ok) console.log(`ok   ${line}`);
if (problems.length) { for (const m of problems) console.log(`FAIL ${m}`); console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Every moment happens once, in its year.');
