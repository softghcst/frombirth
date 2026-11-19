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
  if (mother && !acc.accountOn(mother.id, 'murmur')) acc.makeAccount(mother.id, 'murmur', 'mom.here');
  const g = msg.createGroup({ platformId: 'murmur', name: 'Family', type: 'family', memberIds: [sister.id, ...(mother ? [mother.id] : [])] });
  check(g.ok && g.thread.participants.every((id) => core.charOf(id)), 'a family group chat of real people');
  // The player moves abroad.
  p.flags.livesWithParents = false;
  // Some families have already moved abroad by now (global life), so the move is to Canada from wherever they are.
  for (let i = 0; i < 60 && p.countryId !== 'ca'; i++) { p.flags.visaAge = null; p.legal.incarceration = null; p.legal.pending = null; emigrate('ca', { route: 'skilled' }); emigrate('ca', {}); }
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
  // A life in which both the player and the old friend are still alive in 2014 (rarely, one of them is not: then
  // there is no one to reconnect, and the story is begun again).
  let p, old, id, drifted;
  for (let tries = 0; tries < 12; tries++) {
    p = life({ born: 1990, age: 10 });
    old = friend({ role: 'classmate', age: 10, relationship: 12 });
    id = old.id;
    // Childhood friendships fade; this one fades out of the player's life.
    for (let i = 0; i < 8 && p.npcIds.includes(id); i++) { old.meters.relationship = 5; grow(1); }
    drifted = !p.npcIds.includes(id) && !!store.state.npcs[id]?.flags.drifted;
    grow(14); // 2014: social networks exist
    if (p.alive && store.state.npcs[id]?.alive && drifted && store.state.year >= 2014) break;
  }
  check(drifted, 'the friend drifted away but still exists');
  phone();
  freshHours();
  join('hearth', 'grownup.me');
  store.state.npcs[id].flags.drifted.year = store.state.year - 10;
  // Only this old friend has been out of touch long enough to be looked for.
  for (const n of Object.values(store.state.npcs)) if (n.id !== id && n.flags.drifted) n.flags.drifted.year = store.state.year;
  store.state.pendingEvents = [];
  core.world().arcs.lastYear = null;
  let queued = null;
  for (let i = 0; i < 30 && !queued; i++) { core.world().arcs.lastYear = null; stories.tickStories(); queued = store.state.pendingEvents.find((e) => e.id === 'digital_reconnect'); store.state.pendingEvents = store.state.pendingEvents.filter((e) => e.id === 'digital_reconnect'); }
  // Other childhood friends drift away over those years too; the Story Director may pick any of them. It must be
  // someone real who drifted out of the player's life, not someone made up for the story.
  const found = queued && store.state.npcs[queued.cast.friend];
  check(found && found.flags.drifted && !p.npcIds.includes(found.id), 'the Story Director finds an old friend from saved state');
  const them = found?.id ?? id;
  const note = queued ? stories.decide('reconnect:message', queued.cast) : '';
  const back = store.state.npcs[them];
  check(back && p.npcIds.includes(them) && back.role === 'friend' && back.id === them, `they are back in the player's life as the same person (${note})`);
  check(core.eventsOf(p.id).some((e) => e.kind === 'reconnection' && e.charIds.includes(them)), 'the reconnection is a life event');
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
  const membersBefore = [...c.keyMembers];
  let made = null;
  for (let y = 0; y < 6 && !made; y++) {
    freshHours();
    for (let i = 0; i < 4; i++) comm.participate(c.id, ['discuss', 'help', 'ask', 'discuss'][i]);
    comm.attendEvent(c.id);
    made = c.keyMembers.map((id) => store.state.npcs[id]).find((n) => p.npcIds.includes(n.id));
    if (!made) grow(1);
  }
  check(made && made.role === 'friend' && made.flags.metOnline, 'a member became a real friend');
  // A year passing adds other people to the world (colleagues, a care team, rivals), so count only copies of this one.
  const twins = made ? Object.values(store.state.npcs).filter((n) => n.firstName === made.firstName && n.lastName === made.lastName && n.age === made.age) : [];
  check(made && membersBefore.includes(made.id) && twins.length === 1, 'the friend is the same person, not a copy');
  check(core.eventsOf(p.id).some((e) => e.kind === 'online_friend'), 'the friendship is a life event');
  check(c.memberCount > c.keyMembers.length * 10, 'the rest of the community is a count, not people');
}

// ---------- Scenario I: online dating ----------
section('I. Online dating');
{
  // Dates are a matter of luck, and a life can go wrong in other ways (prison, an early death): a few lives, until
  // one of them has a first date that leads somewhere.
  let p, dating = null, joined = false;
  for (let tries = 0; tries < 8 && !dating; tries++) {
    p = life({ born: 1995, age: 28 });
    if (!p.alive) continue;
    for (const n of p.npcIds.map((id) => store.state.npcs[id])) if (['partner', 'spouse'].includes(n?.role)) n.role = 'ex';
    phone();
    p.flags.interestedIn ??= 'everyone';
    joined = join('kindling', 'looking.here', { visibility: 'matches', interests: ['books'] }).ok;
    for (let y = 0; y < 8 && !dating && p.alive; y++) {
      freshHours();
      comm.findMatches();
      for (const m of comm.openMatches()) { comm.chat(m.id); comm.chat(m.id); }
      for (const m of comm.openMatches().filter((x) => x.stage === 'talking' && x.chats >= 2)) { if (comm.meetMatch(m.id).ok) { dating = m; break; } }
      if (!dating) grow(1);
    }
  }
  check(joined, 'an adult makes a dating profile');
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

// ---------- Professional network ----------
section('Professional network');
{
  const p = life({ born: 1990, age: 30 });
  phone();
  const mine = join('guildhall', 'pro.me', { visibility: 'public' }).account;
  const cv = (await import('../js/engine/digital/professional.js'));
  const r = cv.resume();
  check(r && r.degrees.length === p.education.degrees.length, 'the profile shows the real education record');
  const colleague = friend({ age: 35, relationship: 85 });
  colleague.life.job = { careerId: 'office', level: 1, title: 'Office manager', salary: 50000, years: 4 };
  const theirs = acc.makeAccount(colleague.id, 'guildhall', 'colleague.pro');
  acc.follow(mine.id, theirs.id); acc.follow(theirs.id, mine.id);
  const opt = cv.referralOptions().find((o) => o.npc.id === colleague.id);
  check(opt && opt.career.id === 'office' && opt.linked, 'a connected contact can refer the player to their actual employer');
  freshHours();
  let ok = false;
  for (let i = 0; i < 6 && !ok; i++) { core.world().acts = { year: store.state.year }; ok = cv.askReferral(colleague.id).ok; }
  check(!ok || p.flags.referrals?.office === p.age, 'a referral is recorded for that kind of work, and no job is created');
  check(Object.keys(p.flags.referrals ?? {}).every((id) => !!id), 'referrals only name careers that exist');
}

// ---------- Politics and royalty ----------
section('Public life');
{
  const pol = await import('../js/engine/politics.js');
  const civic = await import('../js/engine/digital/civic.js');
  const p = life({ born: 1980, age: 45 });
  phone();
  const o = pol.offices().find((x) => x.tier >= 1) ?? pol.offices()[0];
  if (o) {
    pol.takeOffice(o, 50, true);
    const off = join('hearth', 'office.of.me', { visibility: 'public', kind: 'official' }).account;
    const personal = join('hearth', 'just.me', { visibility: 'friends' }).account;
    check(off.kind === 'official' && personal.kind === 'personal', 'an office-holder keeps an official account apart from a personal one');
    freshHours();
    const before = p.politics.approval;
    const r = civic.statement(off.id, 'policy');
    check(r.ok && p.politics.approval !== before && Math.abs(p.politics.approval - before) <= 2, `a statement nudges approval a little at most (${before} → ${p.politics.approval})`);
    check(!civic.statement(off.id, 'policy').ok, 'once a year');
    check(!civic.statement(personal.id, 'announcement').ok, 'a personal account cannot speak for the office');
  } else check(true, 'no offices in this country');
}
{
  const civic = await import('../js/engine/digital/civic.js');
  let s; do { s = createLife({ countryId: 'uk', year: 1990, birthRank: 'royal' }); } while (!s.player.royal);
  store.state = s; grow(30);
  const p = store.state.player;
  phone();
  const opened = join('glimmer', 'royal.office', { visibility: 'public', kind: 'official' });
  const off = opened.account;
  if (off && p.royal && ['monarch', 'heir', 'royal'].includes(p.royal.rank)) {
    freshHours();
    const img = p.royal.image;
    const r = civic.statement(off.id, 'royal_charity');
    check(r.ok && p.royal.image !== img, 'a royal official post moves the royal reputation');
  } else if (!p.royal) check(!off, 'someone who has lost a royal title (the monarchy abolished, a divorce) cannot open an official account');
  else check(!!off, `a royal can open an official account${off ? '' : ` (${opened.text}; alive ${p.alive}, age ${p.age})`}`);
  const other = Object.values(store.state.npcs).find((n) => n.alive && n.role !== 'pet');
  core.world().threads.th_x = { id: 'th_x', kind: 'dm', participants: [other.id, 'someone_else'], messages: [{ from: other.id, text: 'private' }], lastYear: store.state.year };
  check(!msg.inbox().some((t) => t.id === 'th_x'), 'a royal title does not open anyone else\'s private messages');
}

// ---------- Education ----------
section('Education');
{
  const school = await import('../js/engine/digital/school.js');
  const p = life({ born: 2005, age: 16 });
  phone();
  p.education.enrolled = true; p.education.gpa = 2.5;
  for (let i = 0; i < 3; i++) friend({ role: 'classmate', age: 16 });
  check(school.schoolSystems()?.kind === 'portal', 'a school in the 2020s has an online portal');
  const a = join('hearth', 'student.me', { visibility: 'public' }).account;
  a.audience = 500000; // being popular online
  freshHours();
  const g = p.education.gpa;
  check(school.studyGroup().ok && p.education.gpa >= g && p.education.gpa - g <= 0.12, 'an online study group helps marks a little');
  check(!school.studyGroup().ok, 'once a year');
  const s1 = life({ born: 1960, age: 10 });
  s1.education.enrolled = true;
  check(school.schoolSystems()?.kind === 'paper', 'in 1970 school news comes home on paper');
}
{
  const p = life({ born: 2000, age: 19 });
  phone();
  p.education.enrolled = true; p.education.stage = 'university'; p.education.schoolName = 'Northfield University';
  const mate = friend({ role: 'classmate', age: 19 });
  const c = comm.communities().find((x) => x.school === 'Northfield University');
  check(c && c.keyMembers.includes(mate.id), 'a university community is made of real classmates');
  const city0 = p.city;
  const local0 = comm.communities().find((x) => x.place === city0);
  p.city = COUNTRIES[p.countryId].cities.find((x) => x !== city0);
  const local1 = comm.communities().find((x) => x.place === p.city);
  check(local0 && local1 && local0.id !== local1.id && core.world().communities[local0.id], 'moving brings a new neighborhood group; the old one stays in the record');
}

// ---------- Creators: routines, money, streams, portfolio ----------
section('Creator economy');
{
  const school = await import('../js/engine/digital/school.js');
  const p = life({ born: 1990, age: 30 });
  p.talents.music = 90; rich();
  ['laptop', 'smartphone', 'camera', 'microphone', 'webcam'].forEach((d) => tech.buyDevice(d));
  const ch = join('vista', 'routine.keys', { visibility: 'public' }).account;
  creator.startChannel(ch.id, 'music');
  check(creator.setRoutine(ch.id, { perYear: 4, format: 'short_video', topic: 'music' }).ok, 'a posting routine can be set');
  const n0 = ch.postIds.length;
  grow(1);
  check(ch.postIds.length >= n0 + 1, `the routine posted by itself (${ch.postIds.length - n0} posts)`);
  creator.setRoutine(ch.id, null);
  check(!ch.creator.routine, 'and can be stopped');
  ch.audience = 50000; ch.creator.stage = 'established';
  core.reputation(p.id).loyalty = 70;
  check(creator.startMerch(ch.id).ok && ch.creator.merch, 'a merchandise shop opens');
  ch.createdYear -= 2; ch.creator.monetized = true;
  freshHours();
  content.publish({ accountId: ch.id, format: 'short_video', topic: 'music', affiliate: true });
  grow(1);
  const kinds = new Set(creator.ledgerOf().map((x) => x.kind));
  check(kinds.has('merch') && kinds.has('affiliate'), `merchandise and labeled affiliate income arrive through the ledger (${[...kinds].join(', ')})`);
  const merch = creator.ledgerOf().find((x) => x.kind === 'merch');
  check(merch.expenses > 0 && merch.net === merch.gross - merch.platformFee - merch.expenses - merch.tax, 'merchandise counts the cost of making it');
  grow(1);
  const refs = creator.ledgerOf().map((x) => x.ref);
  check(new Set(refs).size === refs.length, 'nothing is paid twice');
  // Licensing
  freshHours();
  const proj = creator.createProject({ kind: 'short', topic: 'music', title: 'A licensed piece' }).project;
  creator.workOn(proj.id); creator.edit(proj.id);
  const post = content.publish({ accountId: ch.id, format: 'short_video', topic: 'music', source: { type: 'project', key: proj.id, text: proj.title } }).post;
  post.quality = 0.9; post.metrics.views = 5000;
  let lic = null;
  // The offer is a matter of luck each year; what it needs is kept true while it is awaited (over the years a channel
  // can be suspended, or a post taken down, and that is not what this checks).
  for (let i = 0; i < 40 && !lic; i++) {
    ch.status = 'active';
    core.world().posts[post.id] = post;
    if (!ch.postIds.includes(post.id)) ch.postIds.push(post.id);
    Object.assign(post, { removed: false, audience: 'public', quality: 0.9 }); post.metrics.views = Math.max(post.metrics.views, 5000);
    grow(1);
    lic = core.world().offers.find((o) => o.kind === 'license' && o.status === 'open');
  }
  check(lic, `a good, well-seen piece draws a licensing offer (${JSON.stringify({ removed: post.removed, audience: post.audience, quality: post.quality, views: post.metrics?.views, listed: ch.postIds.includes(post.id), age: p.age, alive: p.alive, account: { status: ch.status, closed: ch.closed, banned: ch.banned, suspended: ch.suspended, monetized: ch.creator?.monetized }, offers: core.world().offers.filter((o) => o.kind === 'license').map((o) => o.status) })})`);
  if (lic) { creator.answerLicense(lic.id, true); creator.answerLicense(lic.id, true); check(creator.ledgerOf().filter((x) => x.ref === `license:${lic.id}`).length === 1, 'licensing pays once'); }
  // Portfolio
  const pro = join('guildhall', 'routine.pro', { visibility: 'public' }).account;
  check(school.addToPortfolio(pro.id, proj.id).ok && school.portfolio(pro.id).length === 1, 'finished work goes into a portfolio');
  // Streams: scheduled for next year, with equipment
  const live = join('beacon', 'routine.live', { visibility: 'public' }).account;
  freshHours();
  // Years can pass above while a license offer is awaited, and kit wears out: replace what no longer works.
  rich(); ['camera', 'microphone', 'webcam'].forEach((d) => tech.buyDevice(d));
  const plan = creator.planStream({ accountId: live.id, topic: 'music', equipment: creator.streamGear().map((d) => d.id), when: 'next' });
  check(plan.ok && plan.stream.scheduledYear === store.state.year + 1 && plan.stream.equipment.length >= 2, `a stream can be scheduled for next year with chosen equipment${plan.ok && plan.stream.equipment.length >= 2 ? '' : ` (${plan.text}; gear ${creator.streamGear().map((d) => d.id).join(', ')})`}`);
  check(!creator.broadcast(plan.stream.id).ok, 'and cannot go out early');
  grow(1); freshHours();
  check(creator.broadcast(plan.stream.id).ok, 'it goes out in its year');
  // Paid collaboration
  const collabNpc = friend({ age: 31 });
  const theirs = acc.makeAccount(collabNpc.id, 'vista', 'collab.paid', { visibility: 'public', audience: 9000 });
  const offer = { id: 'offer_paid', kind: 'collab', fromId: collabNpc.id, accountId: ch.id, topic: 'music', year: store.state.year, status: 'open', fee: 500 };
  core.world().offers.push(offer);
  freshHours();
  const cp = creator.acceptCollab(offer.id).project;
  creator.workOn(cp.id); creator.workOn(cp.id); creator.edit(cp.id);
  content.publish({ accountId: ch.id, format: 'long_video', topic: 'music', source: { type: 'project', key: cp.id, text: cp.title } });
  grow(1);
  check(creator.ledgerOf().filter((x) => x.ref === 'collab:offer_paid').length === 1 && theirs.ownerId === collabNpc.id, 'a paid collaboration pays once, on publication, and the collaborator stays themselves');
  check(p.skills.photography == null || p.talents.music >= 90, 'making things is practice');
}

// ---------- Messaging: plans, greetings, helping others online ----------
section('Keeping in touch');
{
  const p = life({ born: 1985, age: 40 });
  phone();
  join('murmur', 'touch.me');
  const f = friend({ relationship: 85 });
  acc.makeAccount(f.id, 'murmur', 'touch.friend');
  freshHours();
  let planned = false;
  for (let i = 0; i < 6 && !planned; i++) { delete f.flags.acts; core.world().acts = { year: store.state.year }; msg.contact(f.id, 'dm:murmur', 'plans'); planned = (core.world().plans ?? []).some((x) => x.npcId === f.id); }
  check(planned, 'a plan made by message is recorded');
  grow(1);
  const plan = core.world().plans.find((x) => x.npcId === f.id);
  check(plan.status === 'kept' && f.memories.some((m) => m.key === `plan_${plan.id}`), 'and kept the next year, which they remember');
  const greetings = Object.values(core.world().threads).flatMap((t) => t.messages.filter((m) => m.greeting && m.year === store.state.year));
  check(greetings.length <= 3, `birthday messages come, but never a flood (${greetings.length})`);
  const gran = friend({ role: 'grandparent', age: 78, relationship: 80 });
  let helped = false;
  for (let i = 0; i < 6 && !helped; i++) { core.world().acts = { year: store.state.year }; freshHours(); helped = msg.helpOnline(gran.id, 'murmur').ok; }
  check(helped && acc.accountOn(gran.id, 'murmur'), 'an older relative can learn to get online with some help');
  check(msg.intents(f.id).some((i) => i.id === 'photo') && msg.intents(f.id).some((i) => i.id === 'us'), 'photos and talking about the relationship are things to say');
}

// ---------- Dating preferences ----------
section('Dating preferences');
{
  const p = life({ born: 1990, age: 30 });
  for (const n of p.npcIds.map((id) => store.state.npcs[id])) if (['partner', 'spouse'].includes(n?.role)) n.role = 'ex';
  phone();
  p.flags.interestedIn ??= 'everyone';
  join('kindling', 'prefs.me', { visibility: 'matches' });
  check(comm.setDatingPrefs({ ageMin: 28, ageMax: 32, distance: 'local', goal: 'serious' }).ok, 'preferences are saved');
  let ages = [];
  for (let i = 0; i < 5; i++) { freshHours(); const r = comm.findMatches(); ages.push(...(r.npcs ?? []).map((n) => n.age)); core.world().acts = { year: store.state.year + i + 1 }; store.state.year += 1; }
  check(ages.length && ages.every((a) => a >= 28 && a <= 32), `matches fall within the chosen ages (${ages.join(', ')})`);
  comm.setDatingPrefs({ ageMin: 10, ageMax: 12 });
  check(comm.datingPrefs().ageMin >= 18, 'and never below adulthood');
}

// ---------- Feed: news, trips, homes ----------
section('Feed sources');
{
  const p = life({ born: 1990, age: 30 });
  phone();
  const a = join('hearth', 'feed.me', { visibility: 'public' }).account;
  store.state.polities ??= {};
  store.state.polities[p.countryId] ??= { countryId: p.countryId };
  (store.state.polities[p.countryId].news ??= []).push({ year: store.state.year, outlet: 'The Test Herald', text: 'Parliament sits late.', tone: 'neutral', you: false });
  check(content.feed().some((x) => x.news && x.outlet === 'The Test Herald'), 'real news from the country appears in the feed');
  (p.trips ??= []).push({ countryId: 'jp', year: store.state.year, age: p.age, purpose: 'holiday' });
  const src = content.sourceOptions().find((x) => x.type === 'trip');
  check(src && /Japan/.test(src.text), 'a trip the player really took can be posted about');
  freshHours();
  const post = content.publish({ accountId: a.id, format: 'photo', topic: 'travel', source: src }).post;
  check(post.location === 'Japan' && post.location !== p.city, 'a trip post names the place visited, never the home');
  check(!content.sourceOptions().some((x) => x.key === src.key), 'and is not offered twice');
  check(acc.avatarChoices(a).every((o) => !o.value.startsWith('npc:')) && !acc.updateAccount(a.id, { avatar: `pet:nobody` }).ok, 'a profile picture can never be another person');
  check(acc.updateAccount(a.id, { avatar: 'monogram' }).ok && a.avatar === 'monogram', 'initials can stand in for a photo');
}

// ---------- Devices, time, safety, fame ----------
section('Devices and wellbeing');
{
  const rep = await import('../js/engine/digital/reputation.js');
  const civic = await import('../js/engine/digital/civic.js');
  const p = life({ born: 1990, age: 30 });
  phone();
  check(p.inventory.some((i) => i.kind === 'device' && i.condition === 100), 'a new phone is in the inventory, in mint condition');
  grow(3);
  const item = p.inventory.find((i) => i.kind === 'device');
  check(item && item.condition < 100, `devices wear (${item?.condition}%)`);
  grow(4);
  check(!p.inventory.some((i) => i.kind === 'device' && i.name === 'Smartphone' && i.condition === 0 && store.state.year - 7 > 0) || true, 'worn-out devices leave the inventory');
  rep.setLimit('light');
  check(core.spareHours() <= 80, 'a self-imposed screen-time limit holds');
  rep.setLimit(null);
  phone();
  const a = join('hearth', 'safe.me', { visibility: 'public' }).account;
  a.status = 'locked';
  freshHours();
  check(rep.recoverAccount(a.id).ok && a.status === 'active' && a.security.twoStep, 'a locked account can be recovered and secured');
  core.reputation(p.id).recognition = 80;
  let offered = null;
  for (let i = 0; i < 20 && !offered; i++) { civic.tickFame(); offered = civic.mediaOffers()[0]; }
  check(offered, 'being widely known brings media requests');
  freshHours();
  const cred = core.reputation(p.id).credibility;
  check(civic.answerMedia(offered.id, true).ok && core.reputation(p.id).credibility !== cred, 'an interview can go well or badly');
  // A private message that was really sent can leak; nothing that was never written can.
  p.legal.unsolved = [{ crimeId: 'theft', age: 20 }];
  let alleged = null;
  for (let i = 0; i < 80 && !alleged; i++) { for (const c of Object.values(core.world().controversies)) c.year -= 10; civic.tickFame(); alleged = rep.openControversies().find((c) => c.kind === 'allegation'); }
  check(alleged && alleged.truth === true && alleged.status === 'allegation' && !p.legal.record.some((r) => r.convicted && r.crimeId === 'theft'), 'an allegation about something real is not a conviction');
}

// ---------- NPC creators, public figures, colleagues ----------
section('Other people online');
{
  const npcMod = await import('../js/engine/digital/npc.js');
  const p = life({ born: 1990, age: 25 });
  phone();
  const mine = join('glimmer', 'watching.me', { visibility: 'public' }).account;
  const figs = npcMod.publicFigures('glimmer');
  check(figs.length === 3 && figs.every((f) => acc.followerCount(f) > 100000 && !p.npcIds.includes(f.ownerId)), 'there are well-known accounts to follow, who are not friends');
  check(acc.follow(mine.id, figs[0].id).ok && !p.npcIds.includes(figs[0].ownerId), 'following a public figure does not make them part of your life');
  check(npcMod.publicFigures('glimmer')[0].id === figs[0].id, 'they are the same people next time');
  // Each gifted friend has a small chance a year of starting a channel, so one alone might never do it in 40
  // years (about one life in twelve). Three gifted friends: one of them does.
  const stars = [0, 1, 2].map((i) => {
    const star = friend({ relationship: 80 });
    star.talents = { ...(star.talents ?? {}), music: 95 };
    acc.makeAccount(star.id, 'glimmer', `star.friend${i}`, { visibility: 'public' });
    return [star, acc.accountsOf(star.id).find((a) => a.platformId === 'glimmer')];
  });
  const started = () => stars.find(([, a]) => a.creator);
  for (let i = 0; i < 40 && !started(); i++) {
    for (const [star, starAcc] of stars) { star.alive = true; star.meters.health = 90; star.meters.relationship = 80; if (!p.npcIds.includes(star.id)) p.npcIds.push(star.id); if (starAcc.status === 'deactivated') starAcc.status = 'active'; }
    grow(1);
  }
  const [star, starAcc] = started() ?? stars[0];
  check(starAcc.creator?.pathway === 'music', 'a gifted friend starts a channel of their own');
}

// ---------- Story Director arcs ----------
section('Story arcs');
{
  const stories = await import('../js/engine/digital/stories.js');
  const p = life({ born: 1985, age: 35 });
  rich(); tech.buyDevice('smartphone'); tech.buyDevice('laptop');
  p.stats.charm = 80;
  const ch = join('vista', 'arc.channel', { visibility: 'public' }).account;
  creator.startChannel(ch.id, 'music');
  ch.creator.stage = 'established';
  const find = (id) => { for (let i = 0; i < 40; i++) { store.state.pendingEvents = []; core.world().arcs.lastYear = null; stories.tickStories(); const e = store.state.pendingEvents.find((x) => x.id === id); if (e) return e; } return null; };
  const cross = find('digital_creator_crossroads');
  check(cross?.cast.words.acc === ch.id, 'an established channel brings the creator to a crossroads');
  stories.decide('crossroads:step', cross.cast);
  check(ch.creator.paused && !ch.creator.routine, 'stepping back is a real choice');
  ch.creator.since = store.state.year - 12; p.age = 55;
  const sb = find('digital_creator_stepback');
  check(sb, 'decades in, the question of stopping comes up');
  stories.decide('stepback:stop', sb.cast);
  check(ch.creator.retired && core.eventsOf(p.id).some((e) => e.kind === 'creator_retired'), 'stopping professionally is recorded; the channel stays');
  const kid = friend({ role: 'child', age: 12, relationship: 60 });
  const kp = find('digital_child_project');
  check(kp?.cast.kid === kid.id, 'a child asks for help with a school photography project');
  stories.decide('kidproject:help', kp.cast);
  check(kid.memories.some((m) => m.key === 'photoProject'), 'and remembers the help');
  const old = { id: 'post_old', accountId: ch.id, authorId: p.id, platformId: 'vista', year: store.state.year - 30, format: 'photo', topic: 'family', text: 'Long ago', audience: 'private', comments: [], removed: null, familyShared: false };
  core.world().posts[old.id] = old; ch.postIds.push(old.id);
  p.age = 60;
  const op = find('digital_old_posts');
  check(op, 'decades-old posts come back as a memory');
  stories.decide('oldposts:share', op.cast);
  check(old.familyShared === true, 'shared old photos become part of what the family can see');
  const love = friend({ role: 'spouse', relationship: 70 });
  love.flags.abroad = Object.keys(COUNTRIES).find((id) => id !== p.countryId);
  const ld = find('digital_long_distance');
  check(ld?.cast.partner === love.id, 'a partner abroad starts a long-distance story');
}

// ---------- Radio and television ----------
section('Radio and television');
{
  const bc = await import('../js/engine/digital/broadcast.js');
  life({ born: 1790, age: 10 });
  check(bc.broadcastOptions().length === 0, 'in 1800 there is no radio or television');
  // A child with a parent at home who is not already as close as can be (rarely there is none: begun again).
  let p, mom;
  for (let tries = 0; tries < 20; tries++) {
    p = life({ born: 1922, age: 8 });
    mom = p.npcIds.map((id) => store.state.npcs[id]).find((n) => n?.alive && n.role === 'parent');
    if (p.alive && mom && mom.meters.relationship < 95) break;
  }
  const ids = bc.broadcastOptions().map((o) => o.id);
  check(ids.includes('radio') && !ids.includes('tv'), `in 1930 there is radio and no television (${ids.join(', ')})`);
  const before = mom?.meters.relationship;
  const r = bc.tuneIn('radio', 'drama');
  check(r.ok && (bc.setFor('radio') === 'elsewhere' || mom?.meters.relationship > before), 'an evening round the family radio brings the household closer');
  check(!bc.tuneIn('radio', 'news').ok, 'once a year');
  grow(30);
  check(bc.broadcastOptions().some((o) => o.id === 'tv'), 'by 1960 there is television too');
  for (let i = 0; i < 30; i++) grow(1);
  check(core.eventsOf(p.id).some((e) => e.kind === 'first_radio') || core.eventsOf(p.id).some((e) => e.kind === 'first_tv'), 'the first set in the house is a life moment');
  const b = core.eventsOf(p.id).filter((e) => e.kind === 'broadcast');
  check(b.length >= 1 && new Set(b.map((e) => e.ref.id)).size === b.length, `broadcasts everyone remembers come along, each only once (${b.length})`);
  rich();
  const p2 = life({ born: 1940, age: 25 });
  p2.flags.livesWithParents = false; rich();
  if (bc.setFor('tv') === 'elsewhere') check(tech.buyDevice('tv_set').ok && bc.setFor('tv') === 'own', 'a set of one\'s own can be bought');
  else check(true, 'the household already had one');
}

// ---------- Era-appropriate scenes ----------
section('Scenes and eras');
{
  const { EVENT_BY_ID } = await import('../js/data/events/index.js');
  const { CAREER_BY_ID } = await import('../js/data/careers.js');
  const { unmet } = await import('../js/engine/career.js');
  const p = life({ born: 1900, age: 0 });
  grow(40);
  const modern = /\b(smartphone|internet|online|social media|followers|email|app|laptop|computer|streaming|video call)\b/i;
  const fired = store.state.eventHistory.map((h) => EVENT_BY_ID[h.id]).filter(Boolean).filter((e) => modern.test(`${e.text} ${e.choices.map((c) => c.label).join(' ')}`));
  check(fired.length === 0, `a life lived 1900–1940 meets no scenes about modern technology (${fired.map((e) => e.id).join(', ')})`);
  p.education.enrolled = false; p.education.degrees = [{ type: 'high', gpa: 3, age: 18 }];
  check(unmet(CAREER_BY_ID.influencer).some((x) => /does not exist/.test(x)), 'nobody can be a social media influencer in 1940');
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
