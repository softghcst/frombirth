// The Digital World's year, run from the year processor with the rest of the
// world, in a fixed order. Engagement for posts already settled is never
// rolled again, and money is paid once per ledger key.
import { store, player, log } from '../../state.js';
import { PLATFORMS, PLATFORM_BY_ID, COMM_TECH } from '../../data/digital.js';
import { world, recordEvent, newId } from './core.js';
import { platformStatus, techAvailable, digitalEra, syncInventory } from './tech.js';
import { accountsOf, activeAccountsOf, snapshot, makeAccount, followerCount, cleanHandle, handleTaken } from './accounts.js';
import { tickGroups } from './messaging.js';

useRoutinePublisher(publish);
import { tickCommunities } from './community.js';
import { tickCreators, settleCollab, deliver, useRoutinePublisher } from './creator.js';
import { publish } from './content.js';
import { tickFame } from './civic.js';
import { tickBroadcast } from './broadcast.js';
import { schoolSystems, portfolioStrength } from './school.js';
import { tickPlans, tickGreetings } from './messaging.js';
import { tickReputation } from './reputation.js';
import { tickNpcDigital } from './npc.js';
import { tickStories } from './stories.js';
import { tickProfessional } from './professional.js';

/**
 * Brings older saves into the Digital World without inventing anything. A
 * life saved with the old social-media counter keeps its handle and its
 * followers, as one account on the personal network of its day, with an
 * opening audience and no made-up posts. Safe to run more than once.
 */
export function migrateDigital(state) {
  const p = state.player;
  if (!state.digital) {
    const s = p.social;
    if (s?.handle) {
      const prev = store.state;
      store.state = state;
      const pl = PLATFORMS.find((x) => x.type === 'personal' && platformStatus(x.id, state.year, p.countryId) !== 'unlaunched' && platformStatus(x.id, state.year, p.countryId) !== 'closed') ?? PLATFORM_BY_ID.hearth;
      let h = cleanHandle(s.handle).replace(/[^A-Za-z0-9_.]/g, '').slice(0, 20);
      if (h.length < 3) h = `${h}${p.firstName}`.slice(0, 20);
      if (handleTaken(pl.id, h)) h = `${h.slice(0, 16)}_old`;
      const acc = makeAccount(p.id, pl.id, h, { visibility: 'public', audience: Math.max(0, Math.round(s.followers)), openingAudience: Math.max(0, Math.round(s.followers)) });
      acc.legacyImport = { year: state.year, followers: s.followers, posts: s.posts, viral: s.viral, bought: s.boughtFollowers ?? 0 };
      acc.history = [{ year: state.year, followers: followerCount(acc) }];
      world(state).compat = { accountId: acc.id, synced: Math.round(s.followers) };
      store.state = prev;
    } else world(state);
  }
  const d = state.digital;
  d.archive ??= { ancestors: [] };
  d.arcs ??= {};
  d.offers ??= [];
  d.matches ??= [];
  d.platformLog ??= [];
  return state;
}

/**
 * The old `player.social` numbers, kept so older parts of the game (the
 * creator career, scenes that change followers) still read one truth: the
 * player's main public account. Changes made through the old field since the
 * last sync are applied to that account's audience, with the reason recorded.
 */
export function syncCompat() {
  const p = player();
  const d = world();
  const main = activeAccountsOf(p.id).filter((a) => PLATFORM_BY_ID[a.platformId].audience === 'followers')
    .sort((a, b) => followerCount(b) - followerCount(a))[0];
  if (!main) { p.social.handle = null; return; }
  if (d.compat?.accountId === main.id && typeof d.compat.synced === 'number') {
    const delta = Math.round(p.social.followers - d.compat.synced);
    if (delta) { main.audience = Math.max(0, main.audience + delta); main.externalChanges = (main.externalChanges ?? 0) + delta; }
  }
  p.social.handle = main.handle;
  p.social.followers = followerCount(main);
  p.social.posts = accountsOf(p.id).reduce((s, a) => s + a.postIds.length, 0);
  p.social.viral = Object.values(d.posts).filter((x) => x.authorId === p.id && x.outcome === 'viral').length;
  d.compat = { accountId: main.id, synced: p.social.followers };
}

/** Platform launches, declines and closures in the player's country, as news, and what they mean for the player's accounts. */
function tickPlatforms() {
  const d = world();
  const p = player();
  const y = store.state.year;
  for (const pl of PLATFORMS) {
    const now = platformStatus(pl.id, y, p.countryId);
    const was = platformStatus(pl.id, y - 1, p.countryId);
    if (now === was) continue;
    d.platformLog.push({ year: y, platformId: pl.id, from: was, to: now });
    if (p.age < 10) continue;
    if (now === 'new') log(`A new service called ${pl.name} has arrived: ${pl.blurb.charAt(0).toLowerCase()}${pl.blurb.slice(1)}`);
    if (now === 'declining') log(`People are drifting away from ${pl.name}.`);
    if (now === 'closed') {
      const mine = accountsOf(p.id).filter((a) => a.platformId === pl.id && ['active', 'deactivated'].includes(a.status));
      for (const a of mine) { a.status = 'closed'; a.closedYear = y; }
      if (mine.length) recordEvent({ kind: 'platform_closed', charIds: [p.id], platformId: pl.id, summary: `${pl.name} shut down after ${y - pl.launch} years. Your @${mine[0].handle} account, ${mine[0].postIds.length} posts and all, is archived.`, visibility: 'family', tone: 'neutral' });
      else log(`${pl.name} shut down.`);
    }
  }
  for (const t of COMM_TECH) {
    const key = `tech:${t.id}`;
    if (!d.arcs[key] && techAvailable(t.id) && t.from > -1000) {
      d.arcs[key] = y;
      if (y > t.from + t.span + 15) continue; // long established before this life began paying attention
      if (p.age >= 6) log(`${t.name} ${t.id === 'mobile' || t.id === 'smartphone' ? 'are' : 'is'} reaching ordinary people here: ${t.blurb.charAt(0).toLowerCase()}${t.blurb.slice(1)}`);
    }
  }
}

/** Settles posts published this year that came from a contract or a collaboration. */
function settleThisYear() {
  const d = world();
  for (const x of Object.values(d.posts)) {
    if (x.settled || !x.metrics) continue;
    x.settled = true;
    if (x.contractId) deliver(x);
    if (x.metrics) settleCollab(x);
  }
}

/**
 * One year of the Digital World, in order: the clock has already moved;
 * technology and platforms update; people's own digital lives; the year's
 * posts are settled; groups and communities; creators, money and deals;
 * reputation, safety and well-being; stories; snapshots for history; and the
 * old social numbers brought in line.
 */
export function tickDigital() {
  const state = store.state;
  migrateDigital(state);
  const p = player();
  // Last year's time online, kept before anything starts counting this year's.
  const d0 = world();
  d0.lastYearUse = { year: store.state.year - 1, used: d0.time.year === store.state.year - 1 ? d0.time.used : 0 };
  settleThisYear(); // last year's posts, published since the previous tick
  tickPlatforms();
  tickBroadcast();
  tickNpcDigital();
  tickGroups();
  tickPlans();
  tickGreetings();
  tickCommunities();
  if (digitalEra()) {
    tickCreators();
    tickReputation();
    tickProfessional();
    tickFame();
    tickStories();
  }
  for (const a of accountsOf(p.id)) snapshot(a);
  for (const a of Object.values(world().accounts)) if (a.creator && a.ownerId !== p.id) snapshot(a);
  syncCompat();
  syncInventory(p);
  // A strong portfolio helps in creative careers; the career engine reads this (doorBonus).
  p.flags.portfolio = Math.round(portfolioStrength(p.id) * 100) / 100;
}

export { newId };
