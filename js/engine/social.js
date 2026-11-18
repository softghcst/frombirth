// Social media, as the rest of the game first knew it: one handle and a
// follower count. That is now the Digital World Engine (engine/digital), and
// this module only keeps the old entry points working on top of it, so there
// is one truth about accounts and followers.
import { player } from '../state.js';
import { PLATFORMS } from '../data/digital.js';
import { activeAccountsOf, createAccount as openAccount } from './digital/accounts.js';
import { openPlatforms, platformBlocks } from './digital/tech.js';
import { publish, POSTS_PER_YEAR } from './digital/content.js';
import { acts } from './digital/core.js';
import { syncCompat } from './digital/tick.js';

/** Whether there is any platform the player could join now (era, place, age and devices allowing). */
export const canUseSocial = () => !player().legal.incarceration && openPlatforms().some((pl) => !platformBlocks(pl.id).length);
export const hasAccount = () => activeAccountsOf(player().id).length > 0;
export const postsLeft = () => Math.max(0, POSTS_PER_YEAR - (acts().posts ?? 0));

/** Opens an account on the busiest personal network the player can use. */
export function createAccount(handle) {
  const pl = PLATFORMS.filter((x) => x.type === 'personal' && openPlatforms().includes(x) && !platformBlocks(x.id).length).pop();
  if (!pl) return { ok: false, text: 'There is nowhere you can sign up right now.', tone: 'neutral' };
  const r = openAccount({ platformId: pl.id, handle });
  if (r.ok) syncCompat();
  return r;
}

/** A quick everyday post on the player's main account. */
export function post() {
  const acc = activeAccountsOf(player().id)[0];
  if (!acc) return { ok: false, text: 'You do not have an account.', tone: 'neutral' };
  const r = publish({ accountId: acc.id, format: 'text', topic: 'life' });
  syncCompat();
  return r;
}

/** Followers are not for sale in the Digital World: an audience is earned, one post at a time. */
export const followerPacks = () => [];
export const buyFollowers = () => ({ ok: false, text: 'Followers come from what you post, not from your wallet.', tone: 'neutral' });

/** The yearly work moved to engine/digital/tick.js (tickDigital). */
export function tickSocial() {}
