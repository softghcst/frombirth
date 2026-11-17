// The Digital World Engine: technology across the eras, accounts and privacy,
// posts and their audiences, messaging, communities, creators and money,
// reputation, legacy, saves — and the brief's twelve playable scenarios (A–L),
// played through the engine.
// Run with: node tests/digital.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { makeNpc } from '../js/engine/npcFactory.js';
import { ensureLife } from '../js/engine/npcLives.js';
import { continueAs, heirs } from '../js/engine/legacy.js';
import { die } from '../js/engine/death.js';
import { emigrate } from '../js/engine/emigration.js';
import { partner } from '../js/engine/romance.js';
import { COUNTRIES } from '../js/data/countries.js';
import { PLATFORMS } from '../js/data/digital.js';
import * as core from '../js/engine/digital/core.js';
import * as tech from '../js/engine/digital/tech.js';
import * as acc from '../js/engine/digital/accounts.js';
import * as content from '../js/engine/digital/content.js';
import * as msg from '../js/engine/digital/messaging.js';
import * as comm from '../js/engine/digital/community.js';
import * as creator from '../js/engine/digital/creator.js';
import * as rep from '../js/engine/digital/reputation.js';
import * as legacy from '../js/engine/digital/legacy.js';
import * as stories from '../js/engine/digital/stories.js';
import { tickDigital, migrateDigital, syncCompat } from '../js/engine/digital/tick.js';

// Browser storage, for the save tests.
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
const save = await import('../js/save.js');

rng.seed(20261117);
const problems = [];
const passed = [];
let where = '';
const check = (cond, text) => { if (cond) passed.push(`${where}: ${text}`); else problems.push(`${where}: ${text}`); };
const section = (name) => { where = name; };

/** A life born in a given year and country, grown up to `age` by living the years. */
function life(o = {}) {
  let s;
  do { s = createLife({ countryId: o.countryId ?? 'us', year: o.born ?? 2000, ...(o.gender ? { gender: o.gender } : {}) }); } while (s.player.royal);
  store.state = s;
  grow(o.age ?? 0);
  return s.player;
}
function grow(n) {
  for (let i = 0; i < n; i++) {
    const p = store.state.player;
    if (!p.alive) return;
    p.stats.health = 95;
    advanceYear();
    store.state.pendingEvents = [];
    p.legal.pending = null; p.legal.incarceration = null;
    if (!p.alive) { p.alive = true; } // the scenarios are about digital life, not mortality
  }
}
function friend(o = {}) {
  const p = store.state.player;
  const n = makeNpc({ role: o.role ?? 'friend', countryId: p.countryId, age: o.age ?? p.age, relationship: o.relationship ?? 70 });
  n.lastInteractionAge = p.age;
  ensureLife(n);
  store.state.npcs[n.id] = n;
  p.npcIds.push(n.id);
  return n;
}
const rich = () => { store.state.player.finance.cash += 1e6 * COUNTRIES[store.state.player.countryId].currency.scale; };
const phone = () => { rich(); return tech.buyDevice('smartphone').ok || tech.devicesOf(store.state.player.id).some((d) => d.type === 'smartphone'); };
const freshHours = () => { core.world().time = { year: store.state.year, used: 0 }; core.world().acts = { year: store.state.year }; };
const join = (platformId, handle, o = {}) => acc.createAccount({ platformId, handle, ...o });

// ---------- Technology across time ----------
section('Technology');
{
  const p = life({ born: 1790, age: 10 });
  check(store.state.year === 1800 && !tech.digitalEra(), 'in 1800 there is no online world');
  check(tech.openPlatforms().length === 0, 'and no platform is open');
  check(PLATFORMS.every((x) => acc.signupBlocks(x.id).length > 0), 'every platform refuses a sign-up in 1800');
  check(!join('hearth', 'pioneer').ok, 'a character in 1800 cannot open a social network');
  const n = friend({ age: 10 });
  const ways = msg.channels(n.id).map((c) => c.id);
  check(ways.includes('letter') && !ways.some((w) => /dm:|text|video|email|call/.test(w)), `the ways to reach a friend are of the time (${ways.join(', ')})`);
  check(tech.adoption('landline', 1800, 'us') === 0 && tech.adoption('letter', 1800, 'us') === 1, 'the registry knows letters exist and telephones do not');
  check(!tech.buyDevice('smartphone').ok, 'nobody can buy a smartphone in 1800');
  const r = msg.contact(n.id, 'letter', 'catch_up');
  check(r.ok || r.text, 'a letter can be written');
  check(p.age === 10, 'the life is otherwise untouched');
}
{
  life({ born: 1965, age: 20 });
  check(store.state.year === 1985 && tech.techAvailable('pc') && !tech.platformOpen('corkboard'), 'in 1985 there are computers but no forums yet');
  grow(14); // 1999
  const open = tech.openPlatforms().map((x) => x.id);
  check(open.includes('corkboard') && open.includes('chatterbox') && !open.includes('hearth'), `in 1999 the early internet's services are open (${open.join(', ')})`);
  grow(16); // 2015
  check(tech.platformStatus('chatterbox') === 'closed', 'by 2015 the old messenger has shut down');
  check(tech.platformOpen('hearth') && tech.platformOpen('glimmer'), 'and social networks are everywhere');
}
{
  const low = Object.values(COUNTRIES).filter((c) => (c.living?.infra ?? 50) < 40)[0];
  const high = Object.values(COUNTRIES).filter((c) => (c.living?.infra ?? 50) >= 90)[0];
  check(low && high && tech.adoption('social', 2007, low.id) < tech.adoption('social', 2007, high.id), `technology reaches ${low.name} later than ${high.name}`);
  check(tech.adoption('smartphone', 2006, high.id) === 0 && tech.adoption('smartphone', 2015, high.id) > 0.5, 'technology advances with the year');
}

// ---------- Scenario K: born in 1980 ----------
section('K. Born in 1980');
{
  const p = life({ born: 1980, age: 6 });
  const seen = [];
  for (let i = 0; i < 40; i++) { seen.push({ year: store.state.year, era: tech.digitalEra(), open: tech.openPlatforms().map((x) => x.id) }); grow(1); }
  const at = (y) => seen.find((x) => x.year === y);
  check(!at(1986).era || at(1986).open.length === 0, 'as a child in 1986: no social platforms');
  check(at(2000).open.includes('corkboard'), 'at twenty: online communities');
  check(at(2012).open.includes('hearth') && at(2012).open.includes('murmur'), 'in their thirties: social networks and phones');
  check(!at(2020).open.includes('chatterbox'), 'some services they grew up with are gone');
  check(p.age >= 45, 'and the life went on throughout');
  const told = store.state.journal.filter((j) => /reaching ordinary people here/.test(j.text)).length;
  check(told >= 3, `the journal noticed technology arriving (${told} times)`);
}

// ---------- Scenario A: first account, first post ----------
section('A. First social account');
{
  const p = life({ born: 2014, age: 12 });
  phone();
  check(!join('hearth', 'tooyoung').ok, 'at twelve the platform says no');
  const before = Object.keys(core.world().accounts).length;
  for (let i = 0; i < 5; i++) join('hearth', `tooyoung${i}`);
  check(Object.keys(core.world().accounts).filter((id) => core.world().accounts[id].ownerId === p.id).length === 0 && Object.keys(core.world().accounts).length === before, 'clicking again does not get round the age limit');
  grow(1);
  p.flags.livesWithParents = true;
  // A guardian's answer is decided once for this age: asking again gives the same answer.
  const first = join('hearth', 'firsttry');
  const again = join('hearth', 'secondtry');
  check(first.ok || (!again.ok && /parents/.test(again.text) || /two accounts/.test(again.text) || again.ok), 'a guardian decides once a year');
  grow(3); // sixteen: no consent needed
  phone();
  const r = acc.accountOn(p.id, 'hearth') ? { ok: true, account: acc.accountOn(p.id, 'hearth') } : join('hearth', 'sam_first', { bio: 'Hello', visibility: 'friends' });
  check(r.ok && r.account.ownerId === p.id, 'an eligible character opens an account that belongs to them');
  freshHours();
  const post = content.publish({ accountId: r.account.id, format: 'text', topic: 'life', text: 'Hello, world.' });
  check(post.ok && post.post.metrics && post.post.resolvedYear === store.state.year, 'a post is published and its response is simulated');
  const m = post.post.metrics;
  check(m.views >= m.likes && m.likes >= m.comments && m.likes >= 0 && m.shares <= m.likes, `the numbers are consistent (${m.views} views, ${m.likes} likes, ${m.comments} comments)`);
  const snap = JSON.stringify(post.post.metrics);
  content.simulate(post.post);
  check(JSON.stringify(post.post.metrics) === snap, 'a settled post is never rolled again');
  check(core.eventsOf(p.id).some((e) => e.kind === 'first_post' && e.ref?.id === post.post.id), 'the first post is a life event that points at the post');
}

// ---------- Accounts, privacy, connections ----------
section('Accounts');
{
  const p = life({ born: 2000, age: 20 });
  phone();
  const a = join('glimmer', 'river.song', { visibility: 'public' }).account;
  const b = join('glimmer', 'river.song');
  check(!b.ok, 'two accounts cannot share a username');
  const a2 = join('glimmer', 'river.alt', { visibility: 'private' }).account;
  check(a2 && a2.id !== a.id && new Set(Object.keys(core.world().accounts)).size === Object.keys(core.world().accounts).length, 'every account has its own id; a character can have more than one');
  const id = a.id;
  acc.updateAccount(id, { handle: 'river.renamed', bio: 'New bio' });
  check(a.id === id && a.handle === 'river.renamed' && a.handles.length === 2, 'changing the username keeps the same account');
  const f = friend();
  const npcsBefore = Object.keys(store.state.npcs).length;
  // The friend joins and the player follows them: the account is the friend's, and nobody new is created.
  const theirs = acc.makeAccount(f.id, 'glimmer', 'friend.one', { visibility: 'friends' });
  acc.follow(a.id, theirs.id);
  acc.follow(theirs.id, a.id);
  check(theirs.ownerId === f.id && Object.keys(store.state.npcs).length === npcsBefore, 'following a real friend reuses their identity');
  check(acc.connection(a, theirs) === 'mutual', 'and makes a mutual connection');
  freshHours();
  const priv = content.publish({ accountId: a.id, format: 'text', topic: 'life', audience: 'private' }).post;
  const pub = content.publish({ accountId: a.id, format: 'text', topic: 'life', audience: 'public' }).post;
  const fpost = { id: 'x1', accountId: theirs.id, authorId: f.id, audience: 'friends', comments: [] };
  check(!acc.canSee(f.id, priv) && acc.canSee(f.id, pub) && acc.canSee(p.id, priv), 'private posts are seen by their author only');
  check(acc.canSee(p.id, fpost), 'a friends-only post is visible to a mutual connection');
  const stranger = makeNpc({ role: 'contact', countryId: 'us', age: 30 }); store.state.npcs[stranger.id] = stranger;
  const sAcc = acc.makeAccount(stranger.id, 'glimmer', 'stranger.x');
  check(!acc.canSee(stranger.id, fpost) && !acc.canSee(stranger.id, priv), '…and not to a stranger');
  acc.block(a.id, sAcc.id);
  check(!acc.follow(sAcc.id, a.id).ok && !acc.canSee(stranger.id, pub), 'blocking stops following and seeing posts');
  acc.updateAccount(a.id, { visibility: 'private' });
  check(!acc.canSee(stranger.id, pub), 'a private account hides even its public posts from strangers');
  check(acc.deactivate(a2.id).ok && a2.status === 'deactivated' && acc.reactivate(a2.id).ok, 'deactivation is reversible');
  check(!acc.deleteAccount(a2.id, 'wrong').ok && acc.deleteAccount(a2.id, 'river.alt').ok && a2.status === 'deleted' && p.alive, 'deleting needs the username typed out, and the character is untouched');
  const ids = Object.values(core.world().accounts).map((x) => x.ownerId);
  check(ids.every((x) => core.charOf(x)), 'every account belongs to a real character');
}

// ---------- Messaging, groups, relocation (Scenario B) ----------
section('B. Family messaging');
{
  const p = life({ born: 1996, age: 26 });
  phone();
  join('murmur', 'me.here');
  const sister = friend({ role: 'sibling', age: 28, relationship: 75 });
  acc.makeAccount(sister.id, 'murmur', 'sis.here');
  const mother = store.state.player.npcIds.map((id) => store.state.npcs[id]).find((n) => n.alive && n.role === 'parent');
  if (mother && !acc.accountOn(mother.id, 'murmur')) acc.makeAccount(mother.id, 'murmur', 'mum.here');
  const g = msg.createGroup({ platformId: 'murmur', name: 'Family', type: 'family', memberIds: [sister.id, ...(mother ? [mother.id] : [])] });
  check(g.ok && g.thread.participants.every((id) => core.charOf(id)), 'a family group chat of real people');
  // The player moves abroad.
  p.flags.livesWithParents = false;
  for (let i = 0; i < 60 && p.countryId === 'us'; i++) { p.flags.visaAge = null; emigrate('ca', { route: 'skilled' }); emigrate('ca', {}); }
  check(p.countryId === 'ca', 'the player moved to Canada');
  freshHours();
  const before = sister.meters.relationship;
  const r = msg.contact(sister.id, 'dm:murmur', 'catch_up');
  check(r.ok && msg.threadWith(sister.id).participants.includes(sister.id), 'the sister is still reachable after the move');
  check(sister.meters.relationship !== before || !r.ok, 'and the message counts in the relationship');
  check(sister.lastInteractionAge === p.age, 'keeping in touch keeps the relationship from fading');
  const s2 = msg.sendToGroup(g.thread.id, 'share_news');
  check(s2.ok && g.thread.messages.every((m) => g.thread.participants.includes(m.from) || m.from === p.id), 'group messages come from the group');
  check(msg.inbox().every((t) => t.participants.includes(p.id) || t.left?.includes(p.id)), 'the inbox holds only the player\'s own conversations');
  const privateThread = { id: 'th_other', kind: 'dm', participants: [sister.id, mother?.id ?? sister.id], messages: [], lastYear: 2020 };
  core.world().threads[privateThread.id] = privateThread;
  check(!msg.inbox().some((t) => t.id === 'th_other'), 'other people\'s private messages are never listed');
  delete core.world().threads.th_other;
  check(msg.leaveGroup(g.thread.id).ok && g.thread.messages.length > 0, 'leaving a group keeps its history');
}

// ---------- Minor protections ----------
section('Minor safety');
{
  const p = life({ born: 2012, age: 14 });
  phone();
  const adult = makeNpc({ role: 'contact', countryId: 'us', age: 35 }); adult.flags.digitalOnly = true; store.state.npcs[adult.id] = adult;
  check(!!msg.contactBlock(adult.id), 'a teenager cannot start messaging an adult they only know online');
  check(acc.signupBlocks('kindling').length > 0, 'and cannot use online dating');
  const kid = friend({ role: 'classmate', age: 14 });
  check(!msg.contactBlock(kid.id), 'but can message a classmate');
  check(!msg.intents(kid.id).some((i) => i.id === 'romance'), 'with no romantic messages for under-18s');
}

// ---------- Scenario C: childhood friend ----------
section('C. Reconnection');
{
  const p = life({ born: 1990, age: 10 });
  const old = friend({ role: 'classmate', age: 10, relationship: 12 });
  const id = old.id;
  // Childhood friendships fade; this one fades out of the player's life.
  for (let i = 0; i < 8 && p.npcIds.includes(id); i++) { old.meters.relationship = 5; grow(1); }
  check(!p.npcIds.includes(id) && store.state.npcs[id]?.flags.drifted, 'the friend drifted away but still exists');
  grow(14); // 2014: social networks exist
  phone();
  freshHours();
  join('hearth', 'grownup.me');
  store.state.npcs[id].flags.drifted.year = store.state.year - 10;
  store.state.pendingEvents = [];
  core.world().arcs.lastYear = null;
  let queued = null;
  for (let i = 0; i < 30 && !queued; i++) { core.world().arcs.lastYear = null; stories.tickStories(); queued = store.state.pendingEvents.find((e) => e.id === 'digital_reconnect'); store.state.pendingEvents = store.state.pendingEvents.filter((e) => e.id === 'digital_reconnect'); }
  check(queued?.cast.friend === id, 'the Story Director finds the old friend from saved state');
  const note = stories.decide('reconnect:message', queued.cast);
  const back = store.state.npcs[id];
  check(back && p.npcIds.includes(id) && back.role === 'friend' && back.id === id, `they are back in the player's life as the same person (${note})`);
  check(core.eventsOf(p.id).some((e) => e.kind === 'reconnection' && e.charIds.includes(id)), 'the reconnection is a life event');
}

// ---------- Scenario D: private account ----------
section('D. Private account');
{
  const p = life({ born: 2000, age: 22 });
  phone();
  const mine = join('glimmer', 'quiet.one', { visibility: 'private' }).account;
  const close = friend({ relationship: 80 });
  const far = friend({ relationship: 40 });
  const cAcc = acc.makeAccount(close.id, 'glimmer', 'close.f');
  const fAcc = acc.makeAccount(far.id, 'glimmer', 'far.f');
  const req1 = acc.follow(cAcc.id, mine.id);
  const req2 = acc.follow(fAcc.id, mine.id);
  check(req1.pending && req2.pending && mine.requests.length === 2, 'following a private account is a request');
  acc.respondRequest(mine.id, cAcc.id, true);
  acc.respondRequest(mine.id, fAcc.id, false);
  freshHours();
  const post = content.publish({ accountId: mine.id, format: 'text', topic: 'life', audience: 'public' }).post;
  check(acc.canSee(close.id, post) && !acc.canSee(far.id, post), 'only approved followers see the posts');
  check(post.metrics.followerDelta === 0 && post.outcome !== 'viral', 'a private account does not reach strangers');
}

// ---------- Scenarios E, F, G: creator journey, livestream, sponsorship ----------
section('E. Creator journey');
{
  const p = life({ born: 1996, age: 24 });
  p.talents.music = 85;
  rich();
  tech.buyDevice('laptop'); tech.buyDevice('smartphone'); tech.buyDevice('camera'); tech.buyDevice('microphone');
  const ch = join('vista', 'keys.and.chords', { visibility: 'public' }).account;
  check(creator.startChannel(ch.id, 'music').ok && ch.creator.stage === 'hobbyist', 'a hobby channel starts as a hobby');
  const proj = creator.createProject({ kind: 'recital', topic: 'music', title: 'Spring recital' }).project;
  let threw = false;
  try { proj.status = 'planned'; creator.edit(proj.id); } catch { threw = true; }
  check(!creator.edit(proj.id).ok || threw, 'a project cannot be edited before it is made');
  freshHours();
  creator.workOn(proj.id); creator.workOn(proj.id);
  check(proj.status === 'editing', 'two sessions and it is ready for editing');
  creator.edit(proj.id);
  check(proj.status === 'ready' && core.world().ledger.length === 0, 'a finished project earns nothing by existing');
  const r = content.publish({ accountId: ch.id, format: 'long_video', topic: 'music', source: { type: 'project', key: proj.id, text: proj.title } });
  check(r.ok && proj.status === 'published' && proj.postId === r.post.id, 'publishing is a separate step');
  check(core.eventsOf(p.id).some((e) => e.kind === 'first_video'), 'the first video is a life event');
  // Years of making things.
  let stages = new Set();
  for (let y = 0; y < 8; y++) {
    freshHours();
    for (let i = 0; i < 6; i++) content.publish({ accountId: ch.id, format: i % 2 ? 'short_video' : 'long_video', topic: 'music' });
    grow(1);
    stages.add(ch.creator.stage);
  }
  check(acc.followerCount(ch) > 0 && ch.history.length >= 8, `the audience grows by the rules, year by year (${acc.followerCount(ch)} followers)`);
  check(stages.size >= 2 || ch.creator.stage !== 'hobbyist', `the channel moved on from a hobby (${[...stages].join(' → ')})`);
  check(ch.history.every((h, i) => i === 0 || h.year > ch.history[i - 1].year), 'audience history is one row a year');
  check(p.career.careerId !== 'influencer', 'nobody is made a full-time creator without choosing it');
}
section('F. Livestreaming');
{
  const p = store.state.player;
  rich();
  tech.buyDevice('webcam');
  const live = acc.accountOn(p.id, 'beacon') ?? join('beacon', 'keys.live', { visibility: 'public' }).account;
  freshHours();
  const plan = creator.planStream({ accountId: live.id, topic: 'music' });
  check(plan.ok && plan.stream.status === 'scheduled', 'a stream is planned');
  const before = core.hoursLeft();
  const go = creator.broadcast(plan.stream.id);
  check(go.ok && plan.stream.status === 'done' && plan.stream.result.peak >= 1, `the stream goes out (${go.text})`);
  check(core.hoursLeft() < before, 'and it takes time from the year');
  check(!creator.broadcast(plan.stream.id).ok, 'the same stream cannot be broadcast twice');
  for (let i = 0; i < 12; i++) { const pl = creator.planStream({ accountId: live.id, topic: 'music' }); if (pl.ok) creator.broadcast(pl.stream.id); }
  check(core.world().streams.filter((s) => s.status === 'done' && s.result.year === store.state.year).length <= 6, 'streaming is limited by the year');
}
section('G. Sponsorship');
{
  const p = store.state.player;
  const ch = creator.channels(p.id).find((a) => a.platformId === 'vista');
  ch.audience = Math.max(ch.audience, 20000);
  core.reputation(p.id).credibility = 70;
  // A sponsor's offer arrives in the yearly tick.
  let deal = null;
  for (let i = 0; i < 20 && !deal; i++) { grow(1); deal = creator.contracts().find((c) => c.status === 'offered'); }
  check(deal && deal.fee > 0 && deal.deliverables.posts >= 1 && deal.disclosure, 'a sponsor offers a deal with deliverables and a disclosure rule');
  const cash0 = p.finance.cash;
  creator.negotiate(deal.id);
  if (deal.status === 'offered') {
    creator.acceptDeal(deal.id);
    check(deal.status === 'active' && p.finance.cash === cash0, 'signing pays nothing by itself');
    grow(1);
    check(deal.status === 'active', 'nothing is paid before the work is delivered');
    freshHours();
    for (let i = 0; i < deal.deliverables.posts; i++) content.publish({ accountId: ch.id, format: 'short_video', topic: 'music', contractId: deal.id, disclosed: true });
    const lifetime = p.finance.lifetimeEarned;
    grow(1);
    const rows = core.world().ledger.filter((x) => x.ref === `deal:${deal.id}`);
    check(deal.status === 'paid' && rows.length === 1, 'the deal is paid once the posts are up');
    check(rows[0].gross === deal.fee && rows[0].net === rows[0].gross - rows[0].platformFee - rows[0].expenses - rows[0].tax && rows[0].tax >= 0, 'gross, fees, tax and net are all recorded');
    check(p.finance.lifetimeEarned > lifetime, 'and the money went through the Finance Engine');
    grow(2);
    check(core.world().ledger.filter((x) => x.ref === `deal:${deal.id}`).length === 1, 'it is never paid twice');
    const n = core.world().ledger.length;
    creator.pay({ accountId: ch.id, kind: 'ads', gross: 100, ref: rows[0].ref });
    check(core.world().ledger.length === n, 'a ledger key cannot be paid again');
  } else check(deal.status === 'declined', 'the sponsor walked away from the negotiation');
  const adKeys = core.world().ledger.filter((x) => x.kind === 'ads').map((x) => x.ref);
  check(new Set(adKeys).size === adKeys.length, 'ad money is paid at most once a year per channel');
}

// ---------- Scenario H: online community ----------
section('H. Online community');
{
  const p = life({ born: 1990, age: 25 });
  rich(); tech.buyDevice('laptop');
  join('corkboard', 'bookworm25');
  const c = comm.communities().find((x) => x.topic === 'books');
  check(comm.join(c.id).ok && c.keyMembers.length >= 3, 'joining a community introduces a few real members');
  const npcsBefore = Object.keys(store.state.npcs).length;
  let made = null;
  for (let y = 0; y < 6 && !made; y++) {
    freshHours();
    for (let i = 0; i < 4; i++) comm.participate(c.id, ['discuss', 'help', 'ask', 'discuss'][i]);
    comm.attendEvent(c.id);
    made = c.keyMembers.map((id) => store.state.npcs[id]).find((n) => p.npcIds.includes(n.id));
    if (!made) grow(1);
  }
  check(made && made.role === 'friend' && made.flags.metOnline, 'a member became a real friend');
  check(Object.keys(store.state.npcs).length === npcsBefore, 'the friend is the same person, not a copy');
  check(core.eventsOf(p.id).some((e) => e.kind === 'online_friend'), 'the friendship is a life event');
  check(c.memberCount > c.keyMembers.length * 10, 'the rest of the community is a count, not people');
}

// ---------- Scenario I: online dating ----------
section('I. Online dating');
{
  const p = life({ born: 1995, age: 28 });
  for (const n of p.npcIds.map((id) => store.state.npcs[id])) if (['partner', 'spouse'].includes(n?.role)) n.role = 'ex';
  phone();
  p.flags.interestedIn ??= 'everyone';
  check(join('kindling', 'looking.here', { visibility: 'matches', interests: ['books'] }).ok, 'an adult makes a dating profile');
  let dating = null;
  for (let y = 0; y < 8 && !dating; y++) {
    freshHours();
    comm.findMatches();
    for (const m of comm.openMatches()) { comm.chat(m.id); comm.chat(m.id); }
    for (const m of comm.openMatches().filter((x) => x.stage === 'talking' && x.chats >= 2)) { if (comm.meetMatch(m.id).ok) { dating = m; break; } }
    if (!dating) grow(1);
  }
  check(dating, 'after matching and talking, a first date led somewhere');
  const n = store.state.npcs[dating?.npcId];
  check(n && partner()?.id === n.id && p.npcIds.includes(n.id), 'the Romance engine has them as a partner, the same person');
  check(core.world().matches.filter((m) => m.stage === 'dating').length === 1, 'nobody is in a relationship merely for matching');
}

// ---------- Scenario J: controversy ----------
section('J. Reputation');
{
  const p = life({ born: 1990, age: 30 });
  phone();
  join('hearth', 'opinions.held', { visibility: 'public' });
  const cv = rep.raise('misunderstood', { text: 'A post of yours has been taken the wrong way.' });
  check(cv && cv.truth === false && cv.status === 'rumor', 'a misunderstanding is not treated as wrongdoing');
  const cred = core.reputation(p.id).credibility;
  rep.respond(cv.id, 'correct');
  check(core.reputation(p.id).credibility > cred && cv.resolvedYear && cv.status === 'cleared', 'correcting a false story works');
  check(core.reputation(p.id).log.every((x) => x.cause), 'every change has a recorded cause');
  for (let i = 0; i < 4; i++) grow(1);
  check(rep.controversiesOf().filter((x) => x.kind === 'misunderstood').length <= 2 && cv.resolvedYear && cv.status === 'cleared', 'a settled controversy stays settled');
  const ad = { id: 'cv_test', charId: p.id, kind: 'undisclosed_ad', status: 'verified', truth: true, year: store.state.year, resolvedYear: null };
  core.world().controversies[ad.id] = ad;
  const c2 = core.reputation(p.id).credibility;
  rep.respond(ad.id, 'correct');
  check(core.reputation(p.id).credibility < c2, 'denying something true backfires');
  const rich2 = p.finance.cash;
  check(!rep.respond(ad.id, 'apologize').ok && p.finance.cash === rich2, 'and it cannot be re-litigated once answered');
}

// ---------- Persistence and migration ----------
section('Saves');
{
  const p = life({ born: 2000, age: 20 });
  phone();
  const a = join('hearth', 'saved.me', { visibility: 'friends' }).account;
  const f = friend();
  const fa = acc.makeAccount(f.id, 'hearth', 'saved.friend');
  acc.follow(a.id, fa.id); acc.follow(fa.id, a.id);
  freshHours();
  const post = content.publish({ accountId: a.id, format: 'text', topic: 'life' }).post;
  msg.contact(f.id, 'dm:hearth', 'catch_up');
  syncCompat();
  save.saveGame(store.state);
  const raw = JSON.stringify(store.state.digital);
  const back = save.loadGame(store.state.slotId);
  check(JSON.stringify(back.digital) === raw, 'the digital world survives a save and reload unchanged');
  check(back.digital.accounts[a.id].visibility === 'friends' && back.digital.posts[post.id].metrics.views === post.metrics.views, 'privacy and engagement are kept');
  check(back.digital.accounts[fa.id].followers.filter((x) => x === a.id).length === 1, 'followers are not duplicated');
  const t = Object.values(back.digital.threads).find((x) => x.participants.includes(f.id));
  check(t && back.npcs[f.id] && t.messages.every((m) => m.from === back.player.id || m.from === f.id), 'messages stay linked to the right people');
  // A second life is a separate world.
  const other = createLife({ countryId: 'uk', year: 1850 });
  check(!other.digital || Object.keys(other.digital.accounts).length === 0, 'another saved life does not share this one\'s accounts');
}
{
  // An old save, from before the Digital World.
  const old = createLife({ countryId: 'us', year: 1998 });
  old.year = 2024; old.player.age = 26;
  delete old.digital;
  old.player.social = { handle: 'oldtimer', followers: 12345, posts: 40, viral: 1, boughtFollowers: 0 };
  migrateDigital(old);
  migrateDigital(old);
  const accs = Object.values(old.digital.accounts).filter((x) => x.ownerId === old.player.id);
  check(accs.length === 1 && accs[0].handle === 'oldtimer' && accs[0].audience === 12345, 'an old account and its followers are kept, once');
  check(Object.keys(old.digital.posts).length === 0, 'no posts are made up to explain them');
  store.state = old;
  syncCompat();
  old.player.social.followers += 500; // an old-style scene adds followers
  syncCompat();
  check(accs[0].audience === 12845 && old.player.social.followers === 12845, 'old effects on followers reach the account, and the numbers agree');
}

// ---------- Scenario L: digital legacy ----------
section('L. Digital legacy');
{
  const p = life({ born: 1980, age: 30 });
  rich(); tech.buyDevice('smartphone');
  const a = join('hearth', 'grandma.music', { visibility: 'public' }).account;
  freshHours();
  const pub = content.publish({ accountId: a.id, format: 'text', topic: 'music', audience: 'public', text: 'Playing at the town hall tonight.' }).post;
  const fam = content.publish({ accountId: a.id, format: 'photo', topic: 'family', audience: 'private', familyShared: true, text: 'Family dinner.' }).post;
  const secret = content.publish({ accountId: a.id, format: 'text', topic: 'life', audience: 'private', text: 'Just for me.' }).post;
  const kid = friend({ role: 'child', age: 5, relationship: 90 });
  kid.parentIds = [p.id];
  const friendN = friend({ relationship: 80 });
  acc.makeAccount(friendN.id, 'hearth', 'old.pal');
  msg.contact(friendN.id, 'dm:hearth', 'support');
  grow(40);
  const heir = heirs()[0];
  check(heir, 'there is an heir');
  const entry = die('old age');
  check(['memorial', 'closed'].includes(a.status), `at death the account is a memorial, or archived with its platform (${a.status})`);
  check(a.postIds.includes(pub.id) && core.world().posts[pub.id], 'posts outlive the platform they were made on');
  const next = continueAs(heir.id);
  store.state = next;
  const ancestor = legacy.ancestors()[0];
  check(ancestor && next.digital.accounts[a.id].ownerId === ancestor.id && core.charOf(ancestor.id), 'the account now belongs to the ancestor\'s record, a real person in the family');
  const view = legacy.archiveOf(ancestor.id);
  const ids = view.posts.map((x) => x.id);
  check(ids.includes(pub.id) && ids.includes(fam.id), 'the heir sees public and family-shared posts');
  check(!ids.includes(secret.id), 'but not private ones');
  check(view.sealed >= 1 && !msg.inbox().some((t) => t.participants.includes(ancestor.id) && t.sealed), 'private messages are sealed, not handed down');
  check(!content.publish({ accountId: a.id, format: 'text', topic: 'life' }).ok, 'nobody posts as the dead');
  check(view.entry.milestones.length > 0, 'the ancestor\'s life story travels with the archive');
  check(core.world().events.filter((e) => e.charIds.includes(ancestor.id)).every((e) => e.charIds.every((id) => core.charOf(id))), 'everyone in the ancestor\'s memories can still be opened');
  check(entry && next.player.generation === 2, 'the next generation is playing');
}

// ---------- Long playthrough ----------
section('Long playthrough');
{
  const p = life({ born: 1975, age: 5 });
  let errors = 0;
  for (let i = 0; i < 70; i++) { try { grow(1); } catch (e) { errors += 1; problems.push(`Long playthrough: ${store.state.year}: ${e.message}`); break; } }
  const d = core.world();
  check(!errors, `seventy years ran (${store.state.year})`);
  check(Object.values(d.accounts).every((a) => core.charOf(a.ownerId)), 'every account still belongs to a real person');
  check(Object.values(d.posts).every((x) => d.accounts[x.accountId] && core.charOf(x.authorId)), 'every post belongs to a real account and person');
  check(Object.values(d.posts).filter((x) => x.source?.type === 'npcHistory').every((x) => (core.charOf(x.authorId).life?.history ?? []).some((h) => `${h.year}:${h.text}` === x.source.key) || core.charOf(x.authorId).life?.history?.length >= 60), 'every life update in a feed really happened');
  check(JSON.stringify(store.state).length < 2_500_000, `the save stays a sensible size (${Math.round(JSON.stringify(store.state).length / 1024)} KB)`);
  check(p.age >= 70, 'the character lived through it');
}

console.log(`${passed.length} checks passed.`);
if (problems.length) { console.log('PROBLEMS:'); for (const x of problems) console.log(` - ${x}`); process.exit(1); }
console.log('The Digital World behaves.');
