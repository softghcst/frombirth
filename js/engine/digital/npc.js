// People's own digital lives. The people closest to the player are simulated
// in detail: they join platforms (or never do), follow people they know, post
// their real news, move on when a platform fades. Further out, people are
// simpler; audiences are only numbers.
import { rng } from '../../rng.js';
import { store, player } from '../../state.js';
import { PLATFORMS, PLATFORM_BY_ID } from '../../data/digital.js';
import { mortalityChance } from '../death.js';
import { makeNpc } from '../npcFactory.js';
import { COUNTRIES } from '../../data/countries.js';
import { world, newId, charOf, LIMITS, referenced, recordEvent } from './core.js';
const isPlayerId = (id) => store.state.player.id === id;
import { platformStatus, isOpen, platformActivity } from './tech.js';
import { accountsOf, activeAccountsOf, accountOn, makeAccount, follow, handleTaken, cleanHandle, followerCount } from './accounts.js';
import { npcUses, lean } from './messaging.js';

/** Detailed simulation: the player's household, closest family and close friends. */
export const DETAILED = ['spouse', 'partner', 'parent', 'sibling', 'child', 'grandchild', 'grandparent', 'friend'];
/** Life events people tend to share, read straight from their own history. */
const SHAREABLE = /graduated|married|had a baby|adopted|promoted|qualified|started work|achieved a lifelong ambition|was accepted|went to .* university/;

export const tierOf = (npc) => (DETAILED.includes(npc.role) || npc.flags?.creator ? 'detailed' : npc.flags?.digitalOnly ? 'aggregate' : 'moderate');

/** A handle for someone, unique on the platform. */
function handleFor(npc, platformId) {
  let h = cleanHandle(`${npc.firstName}.${npc.lastName ?? ''}`.toLowerCase()).replace(/[^a-z0-9_.]/g, '').slice(0, 17) || 'user';
  while (handleTaken(platformId, h)) h = `${h.slice(0, 15)}${rng.int(10, 999)}`;
  return h;
}

/** The personal network this person would pick now: the busiest one that is open where they live. */
function bestPersonal(countryId, type = 'personal') {
  return PLATFORMS.filter((pl) => pl.type === type && isOpen(platformStatus(pl.id, store.state.year, countryId)))
    .sort((a, b) => platformActivity(b.id, store.state.year, countryId) - platformActivity(a.id, store.state.year, countryId))[0] ?? null;
}

/** How someone keeps their account: careful people keep it to friends. */
function visibilityFor(npc, pl) {
  const careful = npc.traits?.some((t) => ['worrier', 'gentle', 'steady'].includes(t)) || npc.age < 18;
  if (careful && pl.privacy.includes('friends')) return 'friends';
  if (careful && pl.privacy.includes('private')) return 'private';
  return pl.privacy.includes('public') ? 'public' : pl.privacy[0];
}

/** Gives someone an account, as they would choose it. */
export function joinPlatform(npc, pl) {
  if (accountOn(npc.id, pl.id) || npc.age < pl.minAge) return null;
  const acc = makeAccount(npc.id, pl.id, handleFor(npc, pl.id), { visibility: visibilityFor(npc, pl), interests: npc.flags?.interest ? [npc.flags.interest] : [], audience: 0 });
  // They follow the player if they are close enough to want to. A private account of the player's becomes a request.
  const p = player();
  const mine = accountOn(p.id, pl.id);
  if (mine && (npc.meters?.relationship ?? 0) >= 35 && !mine.blocked.includes(acc.id)) {
    follow(acc.id, mine.id, { quiet: mine.visibility !== 'private' });
    if (mine.visibility === 'private' && !mine.requests.includes(acc.id) && !mine.followers.includes(acc.id)) mine.requests.push(acc.id);
  }
  // And the people they know who are there already.
  for (const other of p.npcIds) {
    if (other === npc.id) continue;
    const theirs = accountOn(other, pl.id);
    if (theirs && lean(npc.id + other, 'f') < 0.5) follow(acc.id, theirs.id, { quiet: true });
  }
  return acc;
}

/** A post from someone about something that really happened to them this year. */
function shareNews(npc, acc, entry) {
  const d = world();
  if (Object.values(d.posts).some((x) => x.source?.type === 'npcHistory' && x.authorId === npc.id && x.source.key === `${entry.year}:${entry.text}`)) return;
  const text = `I ${entry.text.replace(/\b(his|her|their)\b/g, 'my')}!`;
  const post = {
    id: newId('post'), accountId: acc.id, authorId: npc.id, platformId: acc.platformId, year: entry.year, age: npc.age,
    format: 'text', topic: /married|baby|adopted/.test(entry.text) ? 'family' : /promoted|work|qualified/.test(entry.text) ? 'work' : 'education',
    text, audience: acc.visibility === 'public' ? 'public' : 'friends', source: { type: 'npcHistory', key: `${entry.year}:${entry.text}`, npcId: npc.id },
    aboutIds: [], quality: 0.5, trendId: null, contractId: null, disclosed: null, location: null, familyShared: false, comments: [], removed: null,
  };
  // Their friends' response, as a count: the people react, but they are not simulated one by one.
  const likes = Math.round(acc.followers.length * rng.around(0.6, 0.15) + acc.audience * 0.08);
  post.metrics = { views: Math.round(likes * 2.5) + acc.followers.length, likes, comments: Math.round(likes * 0.15), shares: 0, saves: 0, followerDelta: 0, named: acc.followers.length };
  post.outcome = 'normal';
  post.resolvedYear = store.state.year;
  d.posts[post.id] = post;
  acc.postIds.push(post.id);
  if (acc.postIds.length > LIMITS.postsPerAccount) { const old = acc.postIds.shift(); delete d.posts[old]; }
}

/** Ages people who are in the digital world but not (or no longer) in the player's everyday life. */
function ageOffList() {
  const p = player();
  const listed = new Set(p.npcIds);
  for (const n of Object.values(store.state.npcs)) {
    if (!n.alive || listed.has(n.id) || n.flags?.archived) continue;
    if (!(n.flags?.digitalOnly || n.flags?.drifted || n.flags?.offstage)) continue;
    // Old friends nobody has heard from in forty years, and who appear in no record, are let go to keep the save small.
    if (n.flags.drifted && !n.flags.digitalOnly && store.state.year - n.flags.drifted.year > 40 && !referenced(n.id)) { delete store.state.npcs[n.id]; continue; }
    n.age += 1;
    if (rng.chance(mortalityChance(n.age, n.meters?.health ?? 70))) { n.alive = false; n.flags.diedYear = store.state.year; }
  }
}

/**
 * Public figures on a platform: a handful of well-known creators, real people in the world, created once
 * per platform the player uses. Following one is following a stranger, not making a friend.
 */
export function publicFigures(platformId) {
  const d = world();
  d.figures ??= {};
  const pl = PLATFORM_BY_ID[platformId];
  if (!pl || pl.audience !== 'followers' || !isOpen(platformStatus(platformId))) return [];
  if (!d.figures[platformId]) {
    d.figures[platformId] = [];
    const topics = ['music', 'cooking', 'gaming', 'education', 'sports', 'fashion', 'travel', 'comedy'].filter((t) => t !== 'comedy');
    for (let i = 0; i < 3; i++) {
      const topic = topics[(i * 3 + platformId.length) % topics.length];
      const n = makeNpc({ role: 'contact', countryId: rng.pick(Object.keys(COUNTRIES)), age: rng.int(22, 45), relationship: 30 });
      n.flags.digitalOnly = true; n.flags.creator = topic; n.flags.publicFigure = true; n.flags.interest = topic;
      if (n.bornIn !== store.state.player.countryId) n.flags.abroad = n.bornIn;
      store.state.npcs[n.id] = n;
      const acc = makeAccount(n.id, platformId, handleFor(n, platformId), { visibility: 'public', interests: [topic], audience: rng.int(200000, 3000000) });
      acc.creator = { pathway: topic, stage: 'public', since: Math.max(pl.launch, store.state.year - rng.int(2, 8)), monetized: true, stageHistory: [] };
      d.figures[platformId].push(acc.id);
    }
  }
  return d.figures[platformId].map((id) => d.accounts[id]).filter((a) => a && a.status === 'active');
}

/** Now and then, a well-known creator posts something: their own work, never news about anyone the player knows. */
function figuresPost() {
  for (const ids of Object.values(world().figures ?? {})) {
    for (const id of ids) {
      const acc = world().accounts[id];
      if (!acc || acc.status !== 'active' || !rng.chance(0.5)) continue;
      const post = { id: newId('post'), accountId: acc.id, authorId: acc.ownerId, platformId: acc.platformId, year: store.state.year, age: charOf(acc.ownerId).age,
        format: 'short_video', topic: acc.creator.pathway, text: rng.pick(['New video is up.', 'Thank you for a wonderful year.', 'Behind the scenes of the latest one.', 'Answering your questions.']),
        audience: 'public', source: null, aboutIds: [], quality: 0.8, comments: [], removed: null, outcome: 'normal', resolvedYear: store.state.year,
        metrics: { views: Math.round(acc.audience * rng.around(0.2, 0.05)), likes: Math.round(acc.audience * rng.around(0.03, 0.01)), comments: Math.round(acc.audience * 0.002), shares: 0, saves: 0, followerDelta: 0, named: 0 } };
      world().posts[post.id] = post;
      acc.postIds.push(post.id);
      if (acc.postIds.length > 20) { const old = acc.postIds.shift(); delete world().posts[old]; }
    }
  }
}

/** The year in other people's digital lives. */
export function tickNpcDigital() {
  const p = player();
  ageOffList();
  figuresPost();
  const people = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n && n.role !== 'pet');
  for (const n of people) {
    if (!n.alive) {
      for (const acc of activeAccountsOf(n.id)) { acc.status = 'memorial'; acc.memorialYear = store.state.year; }
      continue;
    }
    const where = typeof n.flags?.abroad === 'string' ? n.flags.abroad : p.countryId;
    const tier = tierOf(n);
    // Accounts on a platform that has shut are closed; people who used it move on.
    for (const acc of activeAccountsOf(n.id)) {
      if (platformStatus(acc.platformId, store.state.year, where) === 'closed') { acc.status = 'closed'; acc.closedYear = store.state.year; }
    }
    // Joining: not everyone does, and people join at different times.
    const pl = bestPersonal(where);
    if (pl && !activeAccountsOf(n.id).some((a) => PLATFORM_BY_ID[a.platformId].type === 'personal') && npcUses(n, pl.tech)) {
      const keen = lean(n.id, `join:${pl.id}`);
      const never = lean(n.id, 'never-online') < (n.age >= 70 ? 0.35 : 0.12);
      if (!never && keen < (tier === 'detailed' ? 0.55 : 0.3) + (store.state.year - pl.launch) * 0.03 && rng.chance(0.5)) joinPlatform(n, pl);
    }
    const chat = bestPersonal(where, 'messaging');
    if (chat && !accountOn(n.id, chat.id) && npcUses(n, chat.tech) && lean(n.id, 'never-online') >= 0.08 && rng.chance(0.6)) joinPlatform(n, chat);
    // Sharing real news.
    if (tier === 'detailed') {
      const acc = activeAccountsOf(n.id).find((a) => ['personal'].includes(PLATFORM_BY_ID[a.platformId].type));
      const sharer = lean(n.id, 'sharer') < 0.7;
      if (acc && sharer) for (const h of (n.life?.history ?? []).filter((x) => x.year === store.state.year && SHAREABLE.test(x.text))) shareNews(n, acc, h);
    }
    // A few gifted people start making things for an audience of their own.
    const gift = ['music', 'singing', 'acting', 'dance', 'sports'].find((k) => (n.talents?.[k] ?? 0) >= 70);
    const stage = activeAccountsOf(n.id).find((a) => PLATFORM_BY_ID[a.platformId].audience === 'followers' && PLATFORM_BY_ID[a.platformId].privacy.includes('public'));
    if (tier === 'detailed' && gift && stage && !stage.creator && n.age >= 15 && rng.chance(0.06)) {
      stage.creator = { pathway: gift, stage: 'hobbyist', since: store.state.year, monetized: false, stageHistory: [{ year: store.state.year, stage: 'hobbyist' }] };
      stage.visibility = 'public';
      if (n.life) n.life.history.push({ age: n.age, year: store.state.year, text: `started sharing ${gift} videos online` });
    }
    if (stage?.creator && !isPlayerId(n.id)) stage.audience = Math.round(stage.audience * rng.around(1.25, 0.2) + rng.int(5, 60) * ((n.talents?.[stage.creator.pathway] ?? 50) / 50));
    // People with a hobby find others who share it.
    const hobby = n.flags?.interest ?? n.life?.hobby;
    if (tier !== 'aggregate' && hobby && n.age >= 13 && rng.chance(0.05)) {
      const c = Object.values(world().communities).find((x) => x.topic === hobby && isOpen(platformStatus(x.platformId)) && !x.place && !x.school);
      if (c && accountOn(n.id, c.platformId) && !world().memberships.some((mm) => mm.communityId === c.id && mm.charId === n.id && !mm.leftYear)) {
        world().memberships.push({ id: newId('mem'), communityId: c.id, charId: n.id, sinceYear: store.state.year, role: 'member', posts: 0, standing: 10, leftYear: null });
      }
    }
    // An online friend who ends up in the player's line of work: the same person, now a colleague in the field.
    if (n.flags?.metOnline && n.life?.job?.careerId && n.life.job.careerId === p.career?.careerId && !n.flags.colleague) {
      n.flags.colleague = store.state.year;
      recordEvent({ kind: 'online_friend_colleague', charIds: [p.id, n.id], ref: { type: 'npc', id: n.id }, summary: `${n.firstName}, whom you met online, now works in the same field as you. Small world.`, visibility: 'family', once: `colleague_${n.id}` });
    }
    // Some people simply stop.
    for (const acc of activeAccountsOf(n.id)) {
      if (rng.chance(n.traits?.includes('worrier') ? 0.02 : 0.006)) { acc.status = 'deactivated'; acc.deactivatedYear = store.state.year; }
    }
  }
  // Wider audiences drift: a following kept on a fading platform thins out.
  for (const acc of Object.values(world().accounts)) {
    if (acc.status !== 'active' || acc.audience <= 0) continue;
    const st = platformStatus(acc.platformId);
    if (st === 'declining') acc.audience = Math.round(acc.audience * 0.9);
    if (st === 'closed') { acc.status = 'closed'; acc.closedYear = store.state.year; }
  }
}

export { accountsOf, followerCount, charOf };
