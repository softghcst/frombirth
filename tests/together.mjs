// Checks the things the player can do with the people in their life, by role:
// parents, siblings, friends, partners, children, grandparents.
// Run with: node tests/together.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] ?? null };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { COUNTRIES } = await import('../js/data/countries.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { ensureLife } = await import('../js/engine/npcLives.js');
const { ledgerOf, audit, bookAction } = await import('../js/engine/ledger.js');
const { saveGame, loadGame } = await import('../js/save.js');
const H = await import('../js/engine/history.js');
const B = await import('../js/engine/together.js');

rng.seed(4242);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };

/** A life at a given age and year, with nobody in it but who the test adds. */
function life(age = 30, { year = null, cash = 50000, home = age < 18 } = {}) {
  do { store.state = createLife({ countryId: 'us', ...(year ? { year: year - age } : {}) }); } while (store.state.player.royal);
  const p = store.state.player;
  for (let i = 0; i < age; i++) { p.stats.health = 95; advanceYear(); store.state.pendingEvents = []; if (!p.alive) p.alive = true; p.legal.incarceration = null; p.legal.pending = null; }
  p.flags.livesWithParents = home;
  p.finance.cash = Math.round(cash * COUNTRIES[p.countryId].currency.scale);
  for (const n of Object.values(store.state.npcs)) n.alive = false;
  p.npcIds = [];
  ledgerOf();
  return p;
}
function person(role, age, relationship = 70, extra = {}) {
  const p = store.state.player;
  const n = makeNpc({ role, countryId: p.countryId, age, relationship });
  Object.assign(n.flags, extra);
  store.state.npcs[n.id] = n; p.npcIds.push(n.id); ensureLife(n);
  return n;
}
const ids = (n) => B.bondActions(n).map((a) => a.id.replace('with:', ''));

// ---------- 1. The catalog ----------
{
  const groups = new Set(B.GROUPS.map(([g]) => g));
  check(B.BONDS.length >= 60, `there are many things to do (${B.BONDS.length})`);
  check(B.BONDS.every((b) => groups.has(b.group) && b.roles.length && typeof b.run === 'function'), 'every action has a group, roles, and a way to do it');
  check(new Set(B.BONDS.map((b) => b.id)).size === B.BONDS.length, 'every action has its own id');
  for (const role of ['parent', 'sibling', 'friend', 'partner', 'spouse', 'child', 'grandparent']) check(B.BONDS.filter((b) => b.roles.includes(role)).length >= 6, `${role}s have at least six things of their own`);
}
section('the catalog: over sixty actions, grouped, each with roles; every role has its own');

// ---------- 2. Each role, at the ages that suit it ----------
{
  let p = life(5);
  const mom = person('parent', 32); const bro = person('sibling', 8); const pal = person('friend', 5);
  check(ids(mom).includes('hug') && ids(mom).includes('story') && !ids(mom).includes('car') && !ids(mom).includes('callHome'), 'at five: a hug and a story from a parent, not the car keys or calling home');
  check(ids(bro).includes('play') && !ids(bro).includes('drinks'), 'at five: playing with a brother, not drinks');
  check(ids(pal).includes('hangOut') && B.bondActions(pal).find((a) => a.id === 'with:hangOut').label === 'Play at the playground', 'a five-year-old\'s friend: the playground');
  check(!ids(mom).some((id) => ['trip', 'moveIn', 'payBill'].includes(id)), 'a child cannot take a parent on a trip or pay their bills');

  p = life(16);
  const dad = person('parent', 45);
  check(['curfew', 'party', 'sneakOut', 'crush', 'teach'].every((id) => ids(dad).includes(id)) && !ids(dad).includes('hug'), 'at sixteen: curfews, parties, sneaking out, a first crush');
  check(!ids(dad).includes('car'), 'no borrowing the car without a license');
  p.flags.canDrive = true;
  check(ids(dad).includes('car'), 'and with one, you can ask');

  p = life(35, { home: false });
  const old = person('parent', 66, 50); const sis = person('sibling', 33); const wife = person('spouse', 34); const kid = person('child', 6); const gran = person('grandparent', 88);
  wife.marriedAtAge = 22;
  check(['callHome', 'visitHome', 'trip', 'moveIn', 'advice', 'familyHistory', 'introduce'].every((id) => ids(old).includes(id)), 'grown up: calling home, visits, a trip, moving them in, advice, the family history, meeting your spouse');
  check(['drinks', 'helpMove', 'lend', 'secret'].every((id) => ids(sis).includes(id)), 'grown siblings: a drink, a move, a loan, a secret');
  check(['cuddle', 'cook', 'future', 'renewVows', 'confess', 'checkPhone'].every((id) => ids(wife).includes(id)), 'a spouse of thirteen years: cooking, the future, renewing vows, honesty and jealousy');
  check(['readTo', 'teachKid', 'specialDay'].every((id) => ids(kid).includes(id)) && !ids(kid).includes('theTalk'), 'a six-year-old: reading, a bike, a day out; not "the talk" yet');
  check(['visitGrand', 'oldDays', 'recipe', 'techHelp'].every((id) => ids(gran).includes(id)), 'a grandparent: visits, the old days, the family recipe, help with technology');
  check(B.keepsTrust(old) && B.keepsTrust(wife) && !B.keepsTrust(sis), 'parents and partners keep a trust meter; siblings do not');
}
section('each role offers what suits the ages of both people');

// ---------- 3. Every action runs, with every option, and only once a year ----------
{
  const setups = [
    [6, true, [['parent', 34], ['parent', 36], ['sibling', 9], ['friend', 6], ['grandparent', 70]]],
    [15, true, [['parent', 44], ['sibling', 12], ['friend', 15], ['classmate', 15], ['partner', 15], ['grandparent', 78]]],
    [30, false, [['parent', 64], ['sibling', 28], ['friend', 30], ['friend', 29], ['partner', 29], ['child', 4], ['grandparent', 90]]],
    [50, false, [['parent', 78], ['sibling', 47], ['friend', 50], ['spouse', 49], ['child', 22], ['child', 14], ['grandchild', 3]]],
  ];
  const seen = new Set();
  let runs = 0; let threw = [];
  for (const [age, home, people] of setups) {
    const p = life(age, { home });
    const list = people.map(([role, a]) => person(role, a, 60));
    for (const n of list) if (n.role === 'spouse') n.marriedAtAge = age - 15;
    for (const n of list) if (n.role === 'parent' && age >= 30) n.meters.health = 40;
    for (const n of list) if (n.life && n.role === 'sibling') n.life.kids = 1;
    p.flags.canDrive = age >= 18;
    for (const n of list) {
      for (const a of B.bondActions(n)) {
        const opts = B.bondOptions(n.id, a.id);
        const choices = opts ? opts.filter((o) => !o.disabled).map((o) => o.value) : [undefined];
        for (const choice of choices) {
          if (!n.alive || !p.npcIds.includes(n.id)) break;
          if (n.flags.acts) delete n.flags.acts[a.id];
          try {
            const r = B.doBond(n.id, a.id, choice);
            runs += 1; seen.add(a.id);
            if (typeof r.text !== 'string' || !r.text.length || /undefined|NaN|\[object/.test(r.text)) problems.push(`${a.id}${choice ? `/${choice}` : ''} said "${r.text}"`);
            if (r.ok && n.alive && p.npcIds.includes(n.id)) {
              const again = B.doBond(n.id, a.id, choice);
              if (again.ok) problems.push(`${a.id} could be done twice in one year`);
            }
          } catch (e) { threw.push(`${a.id}: ${e.message}`); }
        }
        if (p.finance.cash < 1000) p.finance.cash = 1_000_000;
      }
    }
    for (const n of Object.values(store.state.npcs)) {
      for (const [k, v] of Object.entries(n.meters ?? {})) if (typeof v !== 'number' || v < 0 || v > 100 || Number.isNaN(v)) problems.push(`${n.firstName}'s ${k} is ${v}`);
    }
    bookAction();
    const bad = audit();
    check(!bad.length, `the books balance after a year of everything (${bad.slice(0, 2).join('; ')})`);
  }
  check(!threw.length, `nothing breaks (${threw.slice(0, 3).join('; ')})`);
  const never = B.BONDS.map((b) => b.id).filter((id) => !seen.has(`with:${id}`));
  check(never.filter((id) => !id.startsWith('godchild')).length <= 9, `almost every action was reached by these lives (${runs} runs; not reached: ${never.join(', ') || 'none'})`);
}
section('every action runs with every option, says something sensible, keeps meters in range, and happens once a year');

// ---------- 4. What actions do ----------
{
  let p = life(10);
  const mom = person('parent', 38, 70);
  mom.meters.money = 70;
  if (mom.life) mom.life.savings = Math.round(20000 * COUNTRIES.us.currency.scale);
  const cash0 = p.finance.cash; const savings0 = mom.life?.savings ?? 0;
  let got = false;
  for (let i = 0; i < 30 && !got; i++) { if (mom.flags.acts) delete mom.flags.acts['with:pocketMoney']; const r = B.doBond(mom.id, 'with:pocketMoney'); got = /allowance/.test(r.text); }
  check(got && p.finance.cash > cash0 && (!mom.life || mom.life.savings < savings0), 'pocket money comes from a parent\'s own money');
  const t0 = B.trustOf(mom);
  for (let i = 0; i < 12; i++) { if (mom.flags.acts) delete mom.flags.acts['with:lie']; B.doBond(mom.id, 'with:lie'); }
  check(B.trustOf(mom) < t0, `lying wears down a parent's trust (${t0} to ${B.trustOf(mom)})`);

  p = life(16);
  const dad = person('parent', 46);
  B.doBond(dad.id, 'with:teach', 'drive');
  check(p.flags.drivePractice === 1 && dad.memories?.some((m) => m.key === 'taughtDriving'), 'a parent teaches you to drive, and it is remembered');

  p = life(28, { home: false });
  const pal = person('friend', 29, 90);
  if (pal.life) { pal.life.job = { careerId: 'nurse', level: 0, title: 'Nurse', salary: 50000, years: 2 }; }
  let referred = false;
  for (let i = 0; i < 10 && !referred && pal.life; i++) { if (pal.flags.acts) delete pal.flags.acts['with:askHelp']; B.doBond(pal.id, 'with:askHelp', 'reference'); referred = p.flags.referrals?.nurse === p.age; }
  check(!pal.life || referred, 'a friend can put in a word at work, and hiring counts it');

  const other = person('friend', 30, 60);
  B.doBond(pal.id, 'with:introduceFriends');
  check(other.flags.circle === pal.flags.circle || /did not click/.test(store.state.journal.at(-1)?.text ?? ''), 'introducing friends makes a group, or does not');

  B.doBond(pal.id, 'with:drift');
  check(!p.npcIds.includes(pal.id) && store.state.npcs[pal.id]?.flags.drifted, 'letting a friendship fade: they leave your life, but still exist');

  p = life(40, { home: false });
  const gran = person('grandparent', 80);
  B.doBond(gran.id, 'with:recipe');
  check(p.flags.familyRecipe?.from === gran.id && gran.memories?.some((m) => m.key === 'recipe'), 'a grandparent\'s recipe becomes the family\'s');
  const partner = person('partner', 38, 80);
  const par = person('parent', 68, 70);
  B.doBond(partner.id, 'with:bringHome');
  check(partner.flags.metParents?.includes(par.id) && !B.bondActions(partner).some((a) => a.id === 'with:bringHome'), 'bringing a partner home happens once per parent');
}
section('pocket money, trust, driving lessons, references, friend groups, drifting apart, recipes and meeting the parents all do what they say');

// ---------- 5. The era shapes what you can do ----------
{
  life(30, { year: 1885, home: false });
  const ma = person('parent', 60);
  const pal = person('friend', 30);
  const wife = person('partner', 30);
  const label = (n, id) => B.bondActions(n).find((a) => a.id === `with:${id}`)?.label;
  check(label(ma, 'callHome') === 'Write home', 'in 1885, you write home');
  check(!B.bondActions(pal).some((a) => ['with:message', 'with:videoCall'].includes(a.id)), 'and there are no messages or video calls');
  check(label(wife, 'nightIn') === 'Read together by the fire', 'an evening in is by the fire');
  check(label(pal, 'hangOut') === 'Meet for coffee', 'grown friends meet for coffee in any age');
  life(30, { home: false });
  const mother = person('parent', 60);
  const wife2 = person('partner', 30);
  check(B.bondActions(mother).find((a) => a.id === 'with:callHome')?.label === 'Call home' && B.bondActions(mother).some((a) => a.id === 'with:videoCall'), 'today, you call home, or video call');
  check(B.bondActions(wife2).find((a) => a.id === 'with:nightIn')?.label === 'Movie night at home', 'and an evening in is a movie');
  check(H.getEra(store.state.year).id === 'now', 'today is Modern Day');
}
section('the times decide: letters before telephones, the fire before the radio, video calls only when they exist');

// ---------- 6. Saved and loaded ----------
{
  const p = life(30, { home: false });
  const wife = person('spouse', 31, 70);
  B.doBond(wife.id, 'with:confess');
  const t = B.trustOf(wife);
  saveGame(store.state);
  const back = loadGame(store.state.slotId);
  store.state = back;
  const w = back.npcs[wife.id];
  check(w && B.trustOf(w) === t && !B.doBond(w.id, 'with:confess').ok, 'trust and "done this year" survive a save');
  p.age += 1;
  store.state.player.age += 1;
  check(B.doBond(w.id, 'with:confess').ok, 'and next year it can be done again');
}
section('trust and yearly limits are saved with the life');

// ---------- 7. Affairs, friend groups, a forgotten anniversary, a godchild ----------
{
  const { getEvent, resolveChoice } = await import('../js/engine/eventEngine.js');
  const mo = await import('../js/engine/moments.js');
  const play = (id, pick) => { const q = store.state.pendingEvents.find((e) => e.id === id); if (!q) return null; store.state.pendingEvents = store.state.pendingEvents.filter((e) => e !== q); return resolveChoice(getEvent(id), pick, q.cast); };

  // A partner who strays: found out, and the player decides.
  let p = life(35, { home: false });
  let wife = person('spouse', 34, 30); wife.marriedAtAge = 25; wife.meters.crazy = 80; wife.flags.friction = 3;
  let started = false;
  for (let i = 0; i < 200 && !started; i++) { store.state.pendingEvents = []; B.tickTogether(); started = !!wife.flags.affair; }
  check(started, 'an unhappy partner can start an affair');
  let out = false;
  for (let i = 0; i < 60 && !out && wife.flags.affair; i++) { store.state.pendingEvents = []; B.tickTogether(); out = store.state.pendingEvents.some((e) => e.id.startsWith('with_affair')); }
  check(out || !wife.flags.affair, 'and sooner or later it comes out, or quietly ends');
  // Found by looking through their phone.
  p = life(35, { home: false });
  wife = person('spouse', 34, 60); wife.marriedAtAge = 25; wife.flags.affair = { since: store.state.year - 2 };
  let found = false;
  for (let i = 0; i < 40 && !found; i++) { if (wife.flags.acts) delete wife.flags.acts['with:checkPhone']; store.state.pendingEvents = []; B.doBond(wife.id, 'with:checkPhone'); found = store.state.pendingEvents.some((e) => e.id === 'with_affair_found'); }
  check(found && B.trustOf(wife) < 60, 'looking through a cheating partner\'s phone can find it, and trust falls');
  const r = play('with_affair_found', 0);
  check(r && !wife.flags.affair && wife.flags.hadAffair && wife.role === 'spouse', 'forgiving: the affair is over, remembered, and the marriage goes on');
  wife.flags.affair = { since: store.state.year - 1 };
  B.doBond(wife.id, 'with:askFaithful');
  if (wife.flags.affair?.out) { play('with_affair_found', 3); check(wife.role === 'ex' || wife.role === 'spouse' && p.flags.annulAge === p.age, 'ending it: a divorce'); }
  // An open relationship has no affairs.
  p = life(30, { home: false });
  const open = person('partner', 30, 10); open.flags.open = store.state.year; open.meters.crazy = 100;
  for (let i = 0; i < 300; i++) B.tickTogether();
  check(!open.flags.affair, 'an open relationship has no affairs');

  // A group of friends has scenes of its own.
  p = life(25, { home: false });
  const f1 = person('friend', 25, 70); const f2 = person('friend', 26, 70); const f3 = person('friend', 24, 70);
  for (let i = 0; i < 20 && (!f1.flags.circle || f2.flags.circle !== f1.flags.circle); i++) { if (f1.flags.acts) delete f1.flags.acts['with:introduceFriends']; B.doBond(f1.id, 'with:introduceFriends'); }
  check(f1.flags.circle && f2.flags.circle === f1.flags.circle && p.flags.circles?.[f1.flags.circle], 'introduced friends become a group');
  const kinds = new Set();
  for (let i = 0; i < 80; i++) { store.state.pendingEvents = []; B.tickTogether(); for (const e of store.state.pendingEvents) if (e.id.startsWith('with_circle')) kinds.add(e.id); }
  check(kinds.size >= 3, `the group has its own scenes: nights out, falling out, trips, news (${[...kinds].join(', ')})`);
  store.state.pendingEvents = [{ id: 'with_circle_rift', cast: { a: f1.id, b: f2.id, words: {} } }];
  const before = f1.meters.relationship;
  play('with_circle_rift', 0);
  check(f1.meters.relationship > before, 'taking a friend\'s side brings you closer to them');

  // A forgotten anniversary.
  p = life(40, { home: false });
  const husband = person('spouse', 41, 70); husband.marriedAtAge = 30;
  let asked = false;
  for (let i = 0; i < 10 && !asked; i++) { store.state.pendingEvents = []; mo.finishYear(); asked = store.state.pendingEvents.some((e) => e.id === 'with_forgot_anniversary'); }
  check(asked, 'an anniversary that went by unmarked becomes a scene');
  const rel0 = husband.meters.relationship;
  store.state.pendingEvents = [{ id: 'with_forgot_anniversary', cast: { spouse: husband.id, words: { years: '10th' } } }];
  play('with_forgot_anniversary', 3);
  check(husband.meters.relationship < rel0, 'blaming them for forgetting yours makes it worse');

  // A godchild.
  p = life(30, { home: false });
  const sis = person('sibling', 32, 90);
  if (sis.life) sis.life.kids = 1; else sis.life = { kids: 1 };
  let god = null;
  for (let i = 0; i < 20 && !god; i++) { if (sis.flags.acts) delete sis.flags.acts['with:godparent']; B.doBond(sis.id, 'with:godparent'); god = Object.values(store.state.npcs).find((n) => n.flags.godchild && n.flags.parentId === sis.id); }
  check(god && p.npcIds.includes(god.id) && /^God(son|daughter|child)$/.test(god.flags.title) && god.lastName === sis.lastName, 'a godchild is a real child in your life, your sibling\'s, with your sibling\'s name');
  check(god && ids(god).some((id) => id.startsWith('godchild')), 'and has things of their own to do with you');
  if (god) { god.age = 8; check(B.doBond(god.id, 'with:godchildDay').ok, 'a day out with your godchild'); }
}
section('partners can stray and be found out; friend groups have scenes; a forgotten anniversary comes up; a godchild is a real child');

for (const line of ok) console.log(`ok   ${line}`);
if (problems.length) { for (const m of problems) console.log(`FAIL ${m}`); console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Everyone in a life has something to do with you.');
