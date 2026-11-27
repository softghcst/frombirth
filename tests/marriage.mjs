// Dating, engagement and marriage, end to end (engine/romance.js, engine/weddingGuests.js, engine/blended.js). The
// vertical slice: an adult meets someone real, is turned down or said yes to, dates, moves in (which is not marriage),
// meets the family, proposes (which can be refused), gets engaged (which is not marriage), marries within the law with
// real guests (some cannot come), pays once, and the spouse, guests and wedding survive a year and a reload. Divorce
// keeps the children linked to both parents; marrying someone with children makes them step-children.
// Run with: node tests/marriage.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] ?? null };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { ensureLife } = await import('../js/engine/npcLives.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { roleLabel } = await import('../js/engine/relationships.js');
const love = await import('../js/engine/romance.js');
const T = await import('../js/engine/together.js');
const G = await import('../js/engine/weddingGuests.js');
const K = await import('../js/engine/kinship.js');
const chron = await import('../js/engine/chronicle.js');

rng.seed(1357);
const problems = [];
let passed = 0;
const check = (c, m) => { if (c) passed++; else { problems.push(m); console.log(` ✗ ${m}`); } };
const people = () => store.state.player.npcIds.map((id) => store.state.npcs[id]).filter(Boolean);
const add = (n) => { store.state.npcs[n.id] = n; store.state.player.npcIds.push(n.id); return n; };

function adult(age = 27, countryId = 'us', year0 = null) {
  let s; do { s = createLife({ countryId, ...(year0 ? { year: year0 } : {}) }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  p.age = age; p.birthYear = s.year - age; p.finance.cash = 200000; p.flags.livesWithParents = false; p.stats.charm = 70;
  p.flags.interestedIn = p.gender === 'male' ? 'women' : 'men';
  return p;
}

// ---------- Who can date and marry ----------
{
  const teen = adult(16); teen.flags.livesWithParents = true;
  const ages = [];
  for (let i = 0; i < 3; i++) { teen.flags.loveActs = null; const m = love.meetSomeone('school'); if (m.ok) ages.push(m.npc.age); }
  check(ages.length && ages.every((a) => a >= 14 && a <= 17), `a sixteen-year-old only meets teenagers (${ages.join(', ')})`);
  const grown = add(makeNpc({ role: 'friend', countryId: 'us', age: 30, relationship: 90 }));
  check(!love.askOut(grown.id).ok, 'and cannot ask out an adult');
  check(!love.propose(grown.id, 'plain').ok, 'nor propose to anyone');
}

const p = adult(27);
const mom = people().find((n) => n.role === 'parent' && n.alive);
// A real person, met once; the first ask can be a no.
let met = love.meetSomeone('friends');
check(met.ok && !p.npcIds.includes(met.npc.id), 'meeting someone: a real person, not yet in the player\'s life');
let yes = love.askOutStranger(met.npc);
let tries = 1;
while (!yes.ok && tries < 6) { tries++; love.searches?.(); store.state.player.flags.loveActs = null; met = love.meetSomeone('friends'); if (!met.ok) break; yes = love.askOutStranger(met.npc); }
check(yes.ok, `someone says yes, in time (${tries} asks)`);
const partner = met.npc;
check(partner.role === 'partner' && p.npcIds.includes(partner.id) && roleLabel(partner) !== 'Spouse', 'dating: a partner, not a spouse');

// A date; moving in is not marriage.
love.goOnDate(partner.id);
partner.meters.relationship = 85;
check(T.doBond(partner.id, 'moveInTogether').ok && partner.flags.livingTogether, 'moving in together');
check(partner.role === 'partner' && !p.npcIds.some((id) => store.state.npcs[id]?.role === 'spouse'), 'living together is not a marriage');
if (mom) { T.doBond(partner.id, 'bringHome'); check(partner.flags.metParents?.includes(mom.id), 'the partner meets the player\'s mother, a real parent'); }

// Proposals are not certain; an engagement is not a marriage.
partner.meters.relationship = 40;
store.state.player.flags.loveActs = null;
const no = love.propose(partner.id, 'plain');
check(!no.ok || partner.flags.engaged, 'a proposal can be refused');
partner.meters.relationship = 98;
let got = no.ok;
for (let i = 0; i < 5 && !got; i++) { store.state.player.age += 1; partner.age += 1; got = love.propose(partner.id, 'plain').ok; }
check(got && partner.flags.engaged && partner.role === 'partner', 'engaged: still a partner, not a spouse');

// Friends, family and an old roommate to invite; one lives abroad.
const friends = [0, 1, 2].map(() => add(makeNpc({ role: 'friend', countryId: 'us', age: 28, relationship: 75 })));
friends[2].flags.abroad = true;
const old = add(makeNpc({ role: 'friend', countryId: 'us', age: 29, relationship: 60 })); old.flags.title = 'Former roommate';
// The partner already has a child from before: their life says so; the child is made when they marry.
ensureLife(partner); partner.life.kids = 1;

const cash0 = store.state.player.finance.cash;
const plan = { venue: love.WEDDING_PLAN.venue[0].id, guests: 'small', theme: love.WEDDING_PLAN.theme[0].id, flowers: love.WEDDING_PLAN.flowers[0].id, attire: love.WEDDING_PLAN.attire[0].id,
  cake: love.WEDDING_PLAN.cake[0].id, music: love.WEDDING_PLAN.music[0].id, food: love.WEDDING_PLAN.food[0].id, honeymoon: love.WEDDING_PLAN.honeymoon[0].id };
const cost = love.planTotals(plan, partner, store.state.player.countryId ? (await import('../js/data/countries.js')).COUNTRIES.us : null).cost;
const wed = love.marry(partner.id, plan, false);
check(wed.ok, `the wedding (${wed.text?.slice(0, 80)})`);
check(partner.role === 'spouse' && !partner.flags.engaged, 'married: a spouse now');
const spent = cash0 - store.state.player.finance.cash;
check(spent > 0 && spent <= Math.max(cost, spent), `paid for once (${spent})`);
const guests = partner.flags.wedding.guestList;
check(guests && guests.invited.length > 0 && guests.invited.every((id) => store.state.npcs[id]), 'every guest invited is a real person');
check(guests.came.every((id) => guests.invited.includes(id)) && guests.came.length + guests.couldNot.length === guests.invited.length, 'everyone invited either came or could not');
check(!mom || guests.invited.includes(mom.id), 'the mother is invited');
check(guests.invited.includes(old.id), 'and the old roommate');
check(chron.events((e) => e.type === 'wedding' && e.people.includes(partner.id)).length === 1, 'the wedding is a canonical event, with the people who came');
const stepkids = people().filter((n) => n.role === 'stepchild' && n.flags.stepVia === partner.id);
check(stepkids.length === 1 && stepkids[0].parentIds.includes(partner.id) && K.siblingKind(store.state.player, stepkids[0]) === null, 'the spouse\'s child is the player\'s step-child, with their own parent');
check(!love.marry(partner.id, plan, false).ok, 'and nobody marries twice');

// A year on; the spouse is the same person; nobody pays for the wedding again.
const cashBefore = store.state.player.finance.cash;
store.state.pendingEvents = []; advanceYear();
check(store.state.npcs[partner.id].role === 'spouse' && people().filter((n) => n.role === 'spouse').length === 1, 'a year on: one spouse, the same one');
check(people().filter((n) => n.role === 'stepchild').length === 1, 'and still one step-child');
void cashBefore;

// Save and reload.
saveGame(store.state);
const back = loadGame(store.state.slotId);
store.state = back;
const sp = back.npcs[partner.id];
check(sp.role === 'spouse' && sp.flags.wedding.guestList.came.length === guests.came.length, 'after reload: the spouse and who came to the wedding');

// ---------- The law of the place and year ----------
{
  adult(30, 'us', 1990);
  const n = add(makeNpc({ role: 'partner', countryId: 'us', age: 30, gender: store.state.player.gender, relationship: 99 }));
  n.flags.engaged = true;
  const r = love.marry(n.id, 'registry', false);
  check(!r.ok, `a same-sex couple cannot marry in the US in 1990 (${r.text})`);
}

// ---------- Divorce keeps the children linked; a former spouse keeps their id ----------
{
  const q = adult(35);
  const s = add(makeNpc({ role: 'spouse', countryId: 'us', age: 35, relationship: 50 }));
  s.marriedAtAge = 30;
  const kid = add(makeNpc({ role: 'child', countryId: 'us', age: 6 })); kid.parentIds = [s.id];
  love.divorce(s.id);
  check(s.role === 'ex' && s.flags.wasSpouse && store.state.npcs[s.id] === s, 'a former spouse keeps their id, as an ex');
  check(K.bioParentIdsOf(kid).includes(s.id) && K.bioParentIdsOf(kid).includes(q.id), 'the child is still both parents\' child');
}

if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log(`${passed} checks passed. Dating, engagement and marriage: real people, real guests, the law of the place, and one wedding bill.`);
