// Social media: an account, posting, going viral, buying followers (and
// being found out), and the sponsorship money a big following brings.
import { rng } from '../rng.js';
import { gain, regard } from './fame.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { SOCIAL_FROM } from '../data/eras.js';
import { SOCIAL_AGE, POSTS_PER_YEAR, FOLLOWER_PACKS, FOLLOWER_MILESTONES } from '../data/activities.js';

const MAX_FOLLOWERS = 400000000;
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const social = () => player().social;
const count = (n) => Math.round(n).toLocaleString('en-US');

function acts() {
  const p = player();
  if (p.flags.socialActs?.age !== p.age) p.flags.socialActs = { age: p.age, posts: 0 };
  return p.flags.socialActs;
}

export const canUseSocial = () => store.state.year >= SOCIAL_FROM && player().age >= SOCIAL_AGE && !player().legal.incarceration;
export const hasAccount = () => !!social().handle;
export const postsLeft = () => POSTS_PER_YEAR - acts().posts;

function checkMilestones(before) {
  for (const m of FOLLOWER_MILESTONES) {
    if (before < m && social().followers >= m) milestone(`Reached ${count(m)} followers.`, 'fame');
  }
}

export function createAccount(handle) {
  const clean = String(handle ?? '').trim().replace(/^@+/, '').replace(/\s+/g, '_').slice(0, 20);
  if (!canUseSocial()) return result(false, `You have to be ${SOCIAL_AGE} to open an account.`, 'neutral');
  if (!clean) return result(false, 'You need a name for the account.', 'neutral');
  social().handle = clean;
  social().followers = Math.max(social().followers, rng.int(5, 40));
  const text = `You are online as @${clean}. Your first followers are people you know.`;
  log(text, 'system', 'good');
  return result(true, text);
}

export function post() {
  const p = player();
  const s = social();
  if (!hasAccount()) return result(false, 'You do not have an account.', 'neutral');
  if (postsLeft() <= 0) return result(false, 'You have posted enough for one year. Nobody likes that person.', 'neutral');
  acts().posts += 1;
  s.posts += 1;
  const before = s.followers;
  const reach = (25 + Math.sqrt(s.followers) * 2 + p.hidden.fame * 250) * (0.5 + p.stats.charm / 100) * (0.5 + rng.next());
  const roll = rng.next();
  let text; let tone = 'good';
  if (roll < 0.03 + p.stats.charm / 2500) {
    const gained = Math.round(reach * rng.int(8, 20) + rng.int(500, 8000) + s.followers * rng.int(5, 20) / 100);
    s.followers += gained;
    s.viral += 1;
    p.stats.mood = clamp(p.stats.mood + 10);
    gain({ audience: 'digital', amount: 3, why: 'a post that went viral' });
    text = `Your post went viral. You woke up to ${count(gained)} new followers and a phone too hot to hold.`;
    if (s.viral === 1) milestone('Went viral for the first time.', 'fame');
  } else if (roll < 0.06) {
    const lost = Math.round(s.followers * rng.int(5, 15) / 100);
    s.followers -= lost;
    p.stats.mood = clamp(p.stats.mood - 6);
    tone = 'bad';
    text = `Your post was taken the wrong way by a great many people. You lost ${count(lost)} followers and spent a week not looking at your phone.`;
  } else {
    const gained = Math.round(reach);
    s.followers += gained;
    p.stats.mood = clamp(p.stats.mood + 1);
    text = `You posted. ${count(gained)} new followers.`;
  }
  s.followers = Math.min(s.followers, MAX_FOLLOWERS);
  checkMilestones(before);
  log(text, 'system', tone);
  return result(tone !== 'bad', text, tone);
}

/** @returns {{count:number, cost:number, affordable:boolean}[]} */
export const followerPacks = () => FOLLOWER_PACKS.map((f) => {
  const cost = localMoney(f.cost, country());
  return { count: f.count, cost, affordable: player().finance.cash >= cost };
});

export function buyFollowers(amount) {
  const p = player();
  const s = social();
  const pack = FOLLOWER_PACKS.find((f) => f.count === amount);
  const cost = localMoney(pack.cost, country());
  if (!hasAccount()) return result(false, 'You do not have an account.', 'neutral');
  if (p.finance.cash < cost) return result(false, 'You cannot afford them.', 'neutral');
  p.finance.cash -= cost;
  const before = s.followers;
  s.followers += pack.count;
  s.boughtFollowers += pack.count;
  p.hidden.karma = clamp(p.hidden.karma - 1);
  checkMilestones(before);
  const text = `You paid ${fmtMoney(cost, country())} for ${count(pack.count)} followers. None of them are real, and anyone who looks closely can tell.`;
  log(text);
  return result(true, text, 'neutral');
}

/** Yearly: sponsorship money, a quiet account fading, and fakes being found out. */
export function tickSocial() {
  const p = player();
  const s = social();
  if (!s.handle) return;
  const c = country();
  const real = Math.max(0, s.followers - s.boughtFollowers);
  const posted = p.flags.socialActs?.age === p.age - 1 && p.flags.socialActs.posts > 0;

  if (s.boughtFollowers > 0 && s.boughtFollowers / Math.max(1, s.followers) > 0.25 && rng.chance(0.18)) {
    const purged = Math.min(s.followers, Math.round(s.boughtFollowers * 1.1));
    s.followers -= purged;
    s.boughtFollowers = 0;
    p.stats.mood = clamp(p.stats.mood - 8);
    regard({ favour: -6, why: 'bought followers, found out' });
    log(`Someone ran the numbers on your account and posted the results. ${count(purged)} fake followers vanished overnight, and everyone saw.`, 'system', 'bad');
  }

  if (posted && real >= 10000) {
    const pay = localMoney(real * 0.012, c);
    p.finance.cash += pay;
    p.finance.lifetimeEarned += pay;
    log(`Brands paid you ${fmtMoney(pay, c)} this year to mention their things to your followers.`, 'system', 'good');
  } else if (!posted && p.career.careerId !== 'influencer') {
    s.followers = Math.round(s.followers * 0.96);
  }
}
