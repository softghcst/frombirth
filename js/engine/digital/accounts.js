// Social accounts: who owns them (always a real character), what they are
// called (a handle can change; the account's identity never does), who can
// see what, and the connections between accounts — kept apart from real-life
// relationships, which stay in the Relationship Engine.
import { rng } from '../../rng.js';
import { clamp } from '../../util.js';
import { store, player } from '../../state.js';
import { PLATFORM_BY_ID } from '../../data/digital.js';
import { world, newId, charOf, isPlayer, firstOf, acts, result, recordEvent } from './core.js';
import { platformBlocks, platformStatus, isOpen } from './tech.js';

/** People in someone's life whom a guardian has to agree to. Under this age a platform needs a parent's yes. */
export const CONSENT_AGE = 16;

const HANDLE = /^[A-Za-z0-9_.]{3,20}$/;
export const cleanHandle = (h) => String(h ?? '').trim().replace(/^@+/, '').replace(/\s+/g, '_').slice(0, 20);

/** Every account a character owns, any status. */
export const accountsOf = (charId) => Object.values(world().accounts).filter((a) => a.ownerId === charId);
/** Accounts a character can use now. */
export const activeAccountsOf = (charId) => accountsOf(charId).filter((a) => a.status === 'active');
export const accountOn = (charId, platformId) => activeAccountsOf(charId).find((a) => a.platformId === platformId) ?? null;
export const account = (id) => world().accounts[id] ?? null;

/** Everyone who follows an account: named people plus the wider audience, which is a number, not people. */
export const followerCount = (acc) => acc.followers.length + Math.round(acc.audience);

// ---------- Guardians ----------

/**
 * Whether a parent lets a young teenager onto a platform. Decided once per
 * platform per year of age: asking again the same year gets the same answer.
 */
export function guardianConsent(platformId) {
  const p = player();
  if (p.age >= CONSENT_AGE || !p.flags.livesWithParents) return { granted: true, decided: false };
  const d = world();
  d.consent ??= {};
  const key = `${platformId}:${p.age}`;
  if (d.consent[key]) return { ...d.consent[key], decided: true };
  const parents = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role === 'parent');
  const strict = parents.length ? parents.reduce((s, n) => s + (n.strictness ?? 50), 0) / parents.length : 40;
  const granted = rng.chance(clamp(0.35 + (p.age - 13) * 0.2 + (60 - strict) / 120, 0.1, 0.95));
  d.consent[key] = { granted, by: parents[0]?.id ?? null };
  return { granted, decided: true, by: parents[0]?.id ?? null };
}

// ---------- Creating and changing accounts ----------

/** What stops the player opening an account on this platform ([] when nothing does). */
export function signupBlocks(platformId) {
  const why = platformBlocks(platformId);
  const consent = world().consent?.[`${platformId}:${player().age}`];
  if (!why.length && consent && !consent.granted) why.push(`Your parents said no to ${PLATFORM_BY_ID[platformId].name} this year.`);
  return why;
}

/**
 * Opens an account for the player.
 * @param {{platformId:string, handle:string, displayName?:string, bio?:string, visibility?:string,
 *          interests?:string[], notifications?:'all'|'important'|'off', kind?:'personal'|'official'}} o
 */
export function createAccount(o) {
  const p = player();
  const pl = PLATFORM_BY_ID[o.platformId];
  if (!pl) return result(false, 'There is no such service.');
  const blocks = signupBlocks(o.platformId);
  if (blocks.length) return result(false, blocks[0]);
  const handle = cleanHandle(o.handle);
  if (!HANDLE.test(handle)) return result(false, 'A username needs 3 to 20 letters, numbers, dots or underscores.');
  if (handleTaken(o.platformId, handle)) return result(false, `@${handle} is already taken on ${pl.name}.`);
  if (activeAccountsOf(p.id).filter((a) => a.platformId === o.platformId).length >= 2) return result(false, `You already have two accounts on ${pl.name}.`);
  if (o.kind === 'official' && !(p.royal || p.politics)) return result(false, 'Official accounts are for offices and institutions.');
  const consent = guardianConsent(o.platformId);
  if (!consent.granted) return result(false, `You asked your parents about ${pl.name}. They said no, not this year.`);
  const acc = makeAccount(p.id, o.platformId, handle, {
    displayName: (o.displayName ?? `${p.firstName} ${p.lastName}`).slice(0, 40), bio: (o.bio ?? '').slice(0, 160),
    visibility: pl.privacy.includes(o.visibility) ? o.visibility : defaultVisibility(pl, p.age),
    interests: (o.interests ?? []).slice(0, 5), notifications: o.notifications ?? 'important', kind: o.kind ?? 'personal',
    guardianId: p.age < CONSENT_AGE ? consent.by ?? null : null,
  });
  // The first connections are people the player already knows who are on the same platform.
  const known = connectKnown(acc);
  const first = accountsOf(p.id).length === 1;
  const text = `You are on ${pl.name} as @${handle}.${known ? ` ${known} ${known === 1 ? 'person' : 'people'} you know ${known === 1 ? 'is' : 'are'} already there.` : ''}`;
  if (first) recordEvent({ kind: 'first_account', charIds: [p.id], platformId: pl.id, ref: { type: 'account', id: acc.id }, summary: text, visibility: 'family', milestoneText: `Joined ${pl.name}, your first online account.`, once: `first_account_${p.id}` });
  else recordEvent({ kind: 'account', charIds: [p.id], platformId: pl.id, ref: { type: 'account', id: acc.id }, summary: text, visibility: 'private' });
  return result(true, text, 'good', { account: acc });
}

/** Teenagers' accounts start private; adults choose. */
const defaultVisibility = (pl, age) => (age < 18 && pl.privacy.includes('private') ? 'private' : pl.privacy.includes('friends') && age < 18 ? 'friends' : pl.privacy[0]);

export function handleTaken(platformId, handle, except = null) {
  const h = handle.toLowerCase();
  return Object.values(world().accounts).some((a) => a.platformId === platformId && a.id !== except && a.status !== 'deleted' && a.handle.toLowerCase() === h);
}

/** Creates the record. Used for the player and for NPCs alike: the owner is always an existing character id. */
export function makeAccount(ownerId, platformId, handle, o = {}) {
  const c = charOf(ownerId);
  const acc = {
    id: newId('acc'), platformId, ownerId, handle, displayName: o.displayName ?? `${c.firstName} ${c.lastName ?? ''}`.trim(),
    bio: o.bio ?? '', visibility: o.visibility ?? 'public', interests: o.interests ?? [], notifications: o.notifications ?? 'important',
    messages: o.messages ?? 'connections', locationSharing: false, kind: o.kind ?? 'personal', guardianId: o.guardianId ?? null,
    status: 'active', createdYear: store.state.year, createdAge: c.age, handles: [{ handle, from: store.state.year }],
    audience: o.audience ?? 0, following: [], followers: [], requests: [], blocked: [], muted: [], postIds: [],
    history: [{ year: store.state.year, followers: 0 }], creator: null, security: { strong: false, twoStep: false },
    openingAudience: o.openingAudience ?? 0,
  };
  world().accounts[acc.id] = acc;
  return acc;
}

/** Follows each other with the people in the player's life who are already on this platform. */
function connectKnown(acc) {
  let n = 0;
  for (const id of player().npcIds) {
    const npc = store.state.npcs[id];
    if (!npc?.alive || npc.role === 'pet' || npc.meters.relationship < 25) continue;
    const theirs = accountOn(id, acc.platformId);
    if (!theirs || theirs.blocked.includes(acc.id)) continue;
    follow(theirs.id, acc.id, { quiet: true });
    follow(acc.id, theirs.id, { quiet: true });
    n += 1;
  }
  return n;
}

/**
 * Changes a profile. The handle can change; the account id, its posts and its
 * followers do not. @param {object} changes  bio, displayName, handle, visibility, interests, notifications, messages, locationSharing
 */
export function updateAccount(accountId, changes) {
  const acc = account(accountId);
  if (!acc || !isPlayer(acc.ownerId)) return result(false, 'That is not your account.');
  if (acc.status === 'deleted' || acc.status === 'memorial' || acc.status === 'closed') return result(false, 'That account can no longer be changed.');
  const pl = PLATFORM_BY_ID[acc.platformId];
  if (changes.handle != null) {
    const h = cleanHandle(changes.handle);
    if (!HANDLE.test(h)) return result(false, 'A username needs 3 to 20 letters, numbers, dots or underscores.');
    if (h !== acc.handle) {
      if (handleTaken(acc.platformId, h, acc.id)) return result(false, `@${h} is already taken.`);
      acc.handle = h;
      acc.handles.push({ handle: h, from: store.state.year });
    }
  }
  if (changes.bio != null) acc.bio = String(changes.bio).slice(0, 160);
  if (changes.displayName != null && String(changes.displayName).trim()) acc.displayName = String(changes.displayName).trim().slice(0, 40);
  if (changes.visibility != null) {
    if (!pl.privacy.includes(changes.visibility)) return result(false, `${pl.name} does not offer that setting.`);
    acc.visibility = changes.visibility;
  }
  if (changes.interests) acc.interests = changes.interests.slice(0, 5);
  if (changes.notifications) acc.notifications = changes.notifications;
  if (changes.messages) acc.messages = changes.messages;
  if (changes.locationSharing != null) acc.locationSharing = !!changes.locationSharing;
  if (changes.avatar != null) {
    if (!avatarChoices(acc).some((o) => o.value === changes.avatar)) return result(false, 'That cannot be your profile picture.');
    acc.avatar = changes.avatar;
  }
  // Links on a profile point only to the owner's own other accounts: nothing outside the game.
  if (changes.links) acc.links = changes.links.filter((id) => { const o = account(id); return o && o.ownerId === acc.ownerId && o.id !== acc.id; }).slice(0, 4);
  return result(true, 'Profile saved.', 'good', { account: acc });
}

/** Profile pictures someone may use: their own portrait, a pet of theirs, their initials, or a simple symbol. Never another person's face. */
export const SYMBOLS = ['🌿', '🎵', '📷', '⭐', '🌙', '🎨', '⚽', '📚'];
export function avatarChoices(acc) {
  const owner = charOf(acc.ownerId);
  const pets = isPlayer(acc.ownerId) ? player().npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role === 'pet') : [];
  return [{ value: 'portrait', label: 'Your own photo' }, { value: 'monogram', label: `Your initials (${owner.firstName[0]}${(owner.lastName ?? ' ')[0]})` },
    ...pets.map((n) => ({ value: `pet:${n.id}`, label: `${n.firstName}, your ${n.species}`, species: n.species })), ...SYMBOLS.map((s) => ({ value: `symbol:${s}`, label: `A symbol: ${s}` }))];
}

/** Steps away from an account without losing it. */
export function deactivate(accountId) {
  const acc = account(accountId);
  if (!acc || !isPlayer(acc.ownerId) || acc.status !== 'active') return result(false, 'You cannot deactivate that.');
  acc.status = 'deactivated';
  acc.deactivatedYear = store.state.year;
  return result(true, `@${acc.handle} is switched off. Nobody can see it until you come back.`, 'neutral');
}

export function reactivate(accountId) {
  const acc = account(accountId);
  if (!acc || !isPlayer(acc.ownerId) || acc.status !== 'deactivated') return result(false, 'There is nothing to switch back on.');
  if (!isOpen(platformStatus(acc.platformId))) return result(false, `${PLATFORM_BY_ID[acc.platformId].name} is no longer running.`);
  acc.status = 'active';
  return result(true, `@${acc.handle} is back.`, 'good');
}

/**
 * Deletes an account: it and its posts disappear for everyone, for good. The
 * person who owned it is untouched, and moments already in the life story stay
 * there (they are the player's own memories), without the deleted posts.
 * @param {string} confirm  must be the account's handle, typed out
 */
export function deleteAccount(accountId, confirm) {
  const acc = account(accountId);
  if (!acc || !isPlayer(acc.ownerId)) return result(false, 'That is not your account.');
  if (acc.status === 'deleted') return result(false, 'It is already gone.');
  if (cleanHandle(confirm) !== acc.handle) return result(false, 'Type the username exactly to confirm.');
  const years = store.state.year - acc.createdYear;
  acc.status = 'deleted';
  acc.deletedYear = store.state.year;
  for (const id of acc.postIds) { const post = world().posts[id]; if (post) post.removed = 'deleted'; }
  // Nobody follows a deleted account; nobody is followed by one.
  for (const other of Object.values(world().accounts)) {
    other.following = other.following.filter((x) => x !== acc.id);
    other.followers = other.followers.filter((x) => x !== acc.id);
  }
  acc.following = []; acc.followers = []; acc.audience = 0;
  const text = `You deleted @${acc.handle} from ${PLATFORM_BY_ID[acc.platformId].name}.`;
  if (years >= 8) recordEvent({ kind: 'closed_account', charIds: [acc.ownerId], platformId: acc.platformId, summary: `${text} You had had it for ${years} years.`, visibility: 'family', tone: 'neutral' });
  return result(true, text, 'neutral');
}

// ---------- Connections ----------

/**
 * One account follows another. Following a private account sends a request,
 * which the owner accepts or not. Blocked accounts cannot follow.
 */
export function follow(fromId, toId, o = {}) {
  const from = account(fromId);
  const to = account(toId);
  if (!from || !to || from.id === to.id) return result(false, 'You cannot follow that.');
  if (from.platformId !== to.platformId) return result(false, 'They are on a different platform.');
  if (to.status !== 'active' || from.status !== 'active') return result(false, 'That account is not active.');
  if (to.blocked.includes(from.id) || from.blocked.includes(to.id)) return result(false, 'You cannot follow that account.');
  if (from.following.includes(to.id)) return result(false, 'You already follow them.');
  if (to.visibility === 'private' && !o.quiet && !o.accepted) {
    if (!to.requests.includes(from.id)) to.requests.push(from.id);
    // A person decides: closer people say yes.
    if (!isPlayer(to.ownerId)) return answerRequest(to, from);
    return result(true, `You asked to follow @${to.handle}.`, 'neutral', { pending: true });
  }
  from.following.push(to.id);
  if (!to.followers.includes(from.id)) to.followers.push(from.id);
  return result(true, `You follow @${to.handle}.`, 'good');
}

/** An NPC's answer to a follow request on their private account. */
function answerRequest(to, from) {
  const owner = charOf(to.ownerId);
  const knows = owner.meters ? owner.meters.relationship : 50;
  const isKnown = player().npcIds.includes(owner.id);
  to.requests = to.requests.filter((x) => x !== from.id);
  if (isKnown && knows >= 35 && !(player().age < 18 && owner.age >= 18 && !['parent', 'sibling', 'grandparent', 'relative', 'niece', 'inlaw'].includes(owner.role))) {
    from.following.push(to.id);
    to.followers.push(from.id);
    return result(true, `${owner.firstName} accepted your request.`, 'good');
  }
  return result(false, `@${to.handle} keeps their account to people they know well.`, 'neutral');
}

/** The player accepts or declines a request on their private account. */
export function respondRequest(accountId, fromId, accept) {
  const acc = account(accountId);
  if (!acc || !isPlayer(acc.ownerId) || !acc.requests.includes(fromId)) return result(false, 'There is no such request.');
  acc.requests = acc.requests.filter((x) => x !== fromId);
  if (!accept) return result(true, 'Request declined.', 'neutral');
  const from = account(fromId);
  if (from && !from.following.includes(acc.id)) from.following.push(acc.id);
  if (!acc.followers.includes(fromId)) acc.followers.push(fromId);
  return result(true, `@${from?.handle ?? 'someone'} can see your posts now.`, 'good');
}

export function unfollow(fromId, toId) {
  const from = account(fromId);
  const to = account(toId);
  if (!from || !to) return result(false, 'Nothing to undo.');
  from.following = from.following.filter((x) => x !== to.id);
  to.followers = to.followers.filter((x) => x !== from.id);
  return result(true, `You unfollowed @${to.handle}.`, 'neutral');
}

/** Blocking cuts every tie between two accounts: no following, no messages, no comments, no seeing posts. */
export function block(byId, targetId) {
  const by = account(byId);
  const target = account(targetId);
  if (!by || !target) return result(false, 'Nothing to block.');
  if (!by.blocked.includes(target.id)) by.blocked.push(target.id);
  by.following = by.following.filter((x) => x !== target.id);
  by.followers = by.followers.filter((x) => x !== target.id);
  target.following = target.following.filter((x) => x !== by.id);
  target.followers = target.followers.filter((x) => x !== by.id);
  return result(true, `@${target.handle} is blocked. They cannot see your posts or contact you here.`, 'neutral');
}
export function unblock(byId, targetId) {
  const by = account(byId);
  if (!by) return result(false, 'Nothing to unblock.');
  by.blocked = by.blocked.filter((x) => x !== targetId);
  return result(true, 'Unblocked.', 'neutral');
}
/** Muting hides someone from your feed without them knowing. */
export function mute(byId, targetId, on = true) {
  const by = account(byId);
  if (!by) return result(false, 'Nothing to mute.');
  by.muted = by.muted.filter((x) => x !== targetId);
  if (on) by.muted.push(targetId);
  return result(true, on ? 'Muted. You will not see their posts.' : 'Unmuted.', 'neutral');
}

export const blocks = (a, b) => !!(a && b && (a.blocked.includes(b.id) || b.blocked.includes(a.id)));

/**
 * What one account is to another.
 * @returns {'self'|'blocked'|'mutual'|'following'|'follower'|'none'}
 */
export function connection(a, b) {
  if (!a || !b) return 'none';
  if (a.id === b.id) return 'self';
  if (blocks(a, b)) return 'blocked';
  const f = a.following.includes(b.id);
  const g = b.following.includes(a.id);
  return f && g ? 'mutual' : f ? 'following' : g ? 'follower' : 'none';
}

/** Any account of `viewerId` that is mutually connected to `acc` (used for friends-only visibility). */
function viewerMutual(viewerId, acc) {
  return activeAccountsOf(viewerId).some((v) => v.platformId === acc.platformId && connection(v, acc) === 'mutual');
}
function viewerFollows(viewerId, acc) {
  return activeAccountsOf(viewerId).some((v) => v.platformId === acc.platformId && v.following.includes(acc.id) && !blocks(v, acc));
}
function viewerBlocked(viewerId, acc) {
  return accountsOf(viewerId).some((v) => blocks(v, acc));
}

/**
 * Whether a character can see a post. The single rule every screen uses:
 * privacy settings decide actual access, not just what is shown.
 * @param {string} viewerId   a character id
 * @param {object} post
 * @param {{archive?:'public'|'family'}} [o]  reading from the Family Archive, after the owner's death
 */
export function canSee(viewerId, post, o = {}) {
  if (!post || post.removed) return false;
  const acc = account(post.accountId);
  if (!acc || acc.status === 'deleted') return false;
  if (o.archive) {
    // The dead keep their privacy: the family sees what was public, and what was shared with them.
    // (and what they already saw in life, as the dead person's own connection).
    if (o.archive === 'family') return post.audience === 'public' || post.familyShared === true || (post.audience === 'friends' && viewerMutual(viewerId, acc));
    return post.audience === 'public' && acc.visibility === 'public';
  }
  if (acc.ownerId === viewerId) return true;
  if (viewerBlocked(viewerId, acc)) return false;
  if (acc.status === 'deactivated') return false;
  if (acc.status === 'closed') return false;
  const aud = post.audience;
  if (aud === 'private') return false;
  if (aud === 'friends' || aud === 'connections') return viewerMutual(viewerId, acc);
  if (aud === 'followers') return viewerFollows(viewerId, acc);
  // Public posts on a private account are still only for approved followers.
  if (acc.visibility === 'private') return viewerFollows(viewerId, acc);
  if (acc.visibility === 'friends') return viewerMutual(viewerId, acc);
  return true;
}

/** People the player knows (real relationships) who are on this platform and not yet followed. */
export function knownOnPlatform(platformId) {
  const p = player();
  const mine = accountOn(p.id, platformId);
  return p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role !== 'pet')
    .map((n) => ({ npc: n, acc: accountOn(n.id, platformId) }))
    .filter((x) => x.acc && (!mine || !mine.following.includes(x.acc.id)) && !blocks(mine, x.acc));
}

/** Records a year-end follower count, so growth is history, not guesswork. */
export function snapshot(acc) {
  const last = acc.history[acc.history.length - 1];
  const now = followerCount(acc);
  if (last?.year === store.state.year) last.followers = now; else acc.history.push({ year: store.state.year, followers: now });
  if (acc.history.length > 120) acc.history.shift();
}

/** A one-line description of a connection, for the UI. */
export const connectionLabel = { self: 'You', blocked: 'Blocked', mutual: 'Connected', following: 'You follow them', follower: 'Follows you', none: 'Not connected' };

export { firstOf, acts };
