// The ordinary job search (work that is not a special career): two ways in.
//
// - This year's openings: a list of about a dozen, not the whole market. It is drawn once a year from the openings in
//   the player's city (and remote ones in the country), one per line of work, so it reads like a page of the paper.
//   It is longer in a boom and shorter in a recession, and most of it is new each year. Prominent openings (at a
//   large employer, or a senior post) stay: they are held open and kept on the list for up to three years.
// - A job recruiter: brings one opening the player qualifies for. Not keen? Ask for another, twice more. After the
//   third look the recruiter has nothing more until next year.
//
// Both are kept on the player, keyed to the year of age (as the rest of the game keys a year's actions), so
// reopening the screen shows the same list and the same pitch, and a save carries them.
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { player, store } from '../state.js';
import * as market from './employers.js';
import * as hiring from './hiring.js';
import { hiringClimate } from './economy.js';

/** How many looks the recruiter gives in a year: the first, and two more tries. */
export const RECRUITER_LOOKS = 3;

/** How long this year's list is: about 12 in a steady year, 14 in a boom, 9 in a recession. */
export function listSize() {
  return clamp(Math.round(12 + hiringClimate() * 25) + rng.int(-1, 1), 6, 16);
}

/** How many years a prominent opening stays on the list (and open), counting the year it first appears. */
export const PROMINENT_YEARS = 3;
/** At most this many prominent openings carry over from one year's list to the next. */
const CARRY_MAX = 5;
/** A prominent opening: at a large or major employer, or a senior post. */
export function prominent(post) {
  const e = market.employer(post?.employerId);
  return !!post && !post.partTime && (post.level >= 2 || ['large', 'major'].includes(e?.size));
}
/** Whether an opening can be listed for the player where they live now. */
const local = (post, p) => post.countryId === p.countryId && (post.city === p.city || post.remote === 'remote');

/** Openings the player could be shown: here, and remote work anywhere in the country. */
function pool() {
  const seen = new Set();
  return [...market.board({ scope: 'here' }), ...market.board({ scope: 'remote' })].filter((x) => !seen.has(x.id) && seen.add(x.id));
}

/** One opening per line of work, shuffled. */
function varied(posts) {
  const by = new Map();
  for (const x of shuffle([...posts])) if (!by.has(x.careerId)) by.set(x.careerId, x);
  return [...by.values()];
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * This year's openings, as postingViews: the ones the player can apply for first, then a few they cannot yet (with
 * why), so there is something to aim for. Openings someone else takes during the year stay on the list, marked filled.
 * @returns {object[]}
 */
export function yearList(p = player()) {
  if (p.flags.jobList?.age !== p.age) {
    const now = store.state.year;
    // Prominent openings from last year's list stay while they are held.
    const carried = (p.flags.jobList?.ids ?? []).map((id) => market.posting(id))
      .filter((x) => x && market.isOpen(x) && x.featuredUntil >= now && local(x, p)).slice(0, CARRY_MAX);
    const kept = new Set(carried.map((x) => x.careerId));
    const last = new Set(p.flags.jobList?.ids ?? []); // the rest of last year's list makes way for new openings
    const views = varied(pool().filter((x) => !kept.has(x.careerId) && !last.has(x.id))).map((x) => hiring.postingView(x.id)).filter(Boolean);
    const n = Math.max(0, listSize() - carried.length);
    const can = views.filter((v) => v.eligible);
    const cannot = views.filter((v) => !v.eligible);
    // About two in three are open to the player; the rest show what the market wants.
    const take = can.slice(0, n - Math.min(cannot.length, Math.round(n / 3)));
    const fresh = [...take, ...cannot.slice(0, n - take.length)].map((v) => v.post);
    // A prominent opening, newly listed, is held open for a few years: nobody else takes it, and it does not lapse.
    for (const x of fresh) {
      if (!prominent(x)) continue;
      x.listed = now;
      x.featuredUntil = now + PROMINENT_YEARS - 1;
      x.expires = Math.max(x.expires, x.featuredUntil);
    }
    p.flags.jobList = { age: p.age, ids: [...carried, ...fresh].map((x) => x.id) };
  }
  return p.flags.jobList.ids.map((id) => hiring.postingView(id)).filter(Boolean)
    .sort((a, b) => b.eligible - a.eligible || a.post.title.localeCompare(b.post.title));
}

/** The recruiter's year: looks used, what is being pitched, what has been shown. */
function desk(p = player()) {
  if (p.flags.jobRecruiter?.age !== p.age) p.flags.jobRecruiter = { age: p.age, used: 0, current: null, shown: [] };
  return p.flags.jobRecruiter;
}

/** Where the recruiter stands this year. */
export function recruiter(p = player()) {
  const d = desk(p);
  const view = d.current ? hiring.postingView(d.current) : null;
  return { left: RECRUITER_LOOKS - d.used, used: d.used, view, done: d.used >= RECRUITER_LOOKS };
}

/**
 * Asks the recruiter for an opening (the first look, or another try). Only work the player qualifies for, mostly in
 * their city, never one already on this year's list or already shown. A look is used only when something is found.
 * @returns {{ok:boolean, text?:string, view?:object, left:number}}
 */
export function recruiterLook(p = player()) {
  const d = desk(p);
  if (d.used >= RECRUITER_LOOKS) return { ok: false, text: 'The recruiter has nothing more for you this year. Try again next year.', left: 0 };
  const skip = new Set([...d.shown, ...(p.flags.jobList?.age === p.age ? p.flags.jobList.ids : [])]);
  const shownTracks = new Set(d.shown.map((id) => market.posting(id)?.careerId));
  const fits = (posts) => shuffle(posts.filter((x) => !skip.has(x.id))).map((x) => hiring.postingView(x.id)).filter((v) => v?.eligible);
  const here = fits(market.board({ scope: 'here' }));
  const wide = fits(market.board({ scope: 'country' }));
  const fresh = (vs) => vs.find((v) => !shownTracks.has(v.post.careerId)) ?? vs[0];
  const view = (rng.chance(0.75) && fresh(here)) || fresh(wide) || fresh(here);
  if (!view) return { ok: false, text: 'The recruiter looked, and has nothing that fits you right now.', left: RECRUITER_LOOKS - d.used };
  d.used += 1;
  d.current = view.post.id;
  d.shown.push(view.post.id);
  return { ok: true, view, left: RECRUITER_LOOKS - d.used };
}

/** A recruiter puts in a word: a little help with the interview. */
export const RECRUITER_BONUS = 0.05;
