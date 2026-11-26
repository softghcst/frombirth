// The ordinary job search (work that is not a special career): two ways in.
//
// - This year's openings: a short list, not the whole market. It is drawn once a year from the openings in the
//   player's city (and remote ones in the country), one per line of work, so it reads like a page of the paper.
//   It is longer in a boom and shorter in a recession, and a new list comes with each year.
// - A job recruiter: brings one opening the player qualifies for. Not keen? Ask for another, twice more. After the
//   third look the recruiter has nothing more until next year.
//
// Both are kept on the player, keyed to the year of age (as the rest of the game keys a year's actions), so
// reopening the screen shows the same list and the same pitch, and a save carries them.
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { player } from '../state.js';
import * as market from './employers.js';
import * as hiring from './hiring.js';
import { hiringClimate } from './economy.js';

/** How many looks the recruiter gives in a year: the first, and two more tries. */
export const RECRUITER_LOOKS = 3;

/** How long this year's list is: about 8 in a steady year, 10 in a boom, 5 in a recession. */
export function listSize() {
  return clamp(Math.round(8 + hiringClimate() * 25) + rng.int(-1, 1), 4, 11);
}

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
    const views = varied(pool()).map((x) => hiring.postingView(x.id)).filter(Boolean);
    const n = listSize();
    const can = views.filter((v) => v.eligible);
    const cannot = views.filter((v) => !v.eligible);
    // About two in three are open to the player; the rest show what the market wants.
    const take = can.slice(0, n - Math.min(cannot.length, Math.round(n / 3)));
    const ids = [...take, ...cannot.slice(0, n - take.length)].map((v) => v.post.id);
    p.flags.jobList = { age: p.age, ids };
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
