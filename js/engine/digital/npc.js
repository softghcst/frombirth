// People's own digital lives. The people closest to the player are simulated
// in detail: they join platforms (or never do), follow people they know, post
// their real news, move on when a platform fades. Further out, people are
// simpler; audiences are only numbers.
import { rng } from '../../rng.js';
import { store, player } from '../../state.js';
import { PLATFORMS, PLATFORM_BY_ID } from '../../data/digital.js';
import { mortalityChance } from '../death.js';
import { world, newId, charOf, LIMITS, referenced } from './core.js';
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

/** The year in other people's digital lives. */
export function tickNpcDigital() {
  const p = player();
  ageOffList();
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
