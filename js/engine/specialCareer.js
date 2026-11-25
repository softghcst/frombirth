// Special careers: acting, music, dance, modeling, writing, sports, K-pop and politics. Each is a career, and a life has
// one at a time. Playing a sport for fun, singing in the shower or writing in a notebook are open to anyone; what
// makes it a career (an audition, a band or a record, a professional contract, a publisher, a trainee contract, a
// run for office) claims the special career, and while one is held the others wait until it is left.
//
//   p.flags.special = { id, since } | null        p.flags.specialPast = [{ id, from, to }]
import { store, player, log } from '../state.js';
import { myAct, leaveAct } from './music.js';
import { retire as retireSport } from './sportsLife.js';
import { trainee, leaveTraining } from './kpop.js';
import { quitCareer } from './career.js';
import { workOf } from './entertainment.js';
import { isModel } from './modeling.js';
import { danceOf } from './dance.js';
import { writingOf, published } from './publishing.js';
import { inOffice } from './politics.js';

export const SPECIAL_CAREERS = [
  { id: 'acting', name: 'Acting', noun: 'an actor', ico: 'star', blurb: 'Auditions, roles on stage and screen, an agent, awards.' },
  { id: 'music', name: 'Music', noun: 'a musician', ico: 'sparkle', blurb: 'A solo act or a band: songs, records, gigs and tours.' },
  { id: 'dance', name: 'Dance', noun: 'a dancer', ico: 'sparkle', blurb: 'Auditions, gigs, competitions and tours.' },
  { id: 'modeling', name: 'Modeling', noun: 'a model', ico: 'star', blurb: 'An agency, castings, bookings.' },
  { id: 'writing', name: 'Writing', noun: 'an author', ico: 'book', blurb: 'Books, a literary agent, publishers and the lists.' },
  { id: 'sports', name: 'Sports', noun: 'a professional athlete', ico: 'trophy', blurb: 'College, the pros or the tour, seasons and contracts.' },
  { id: 'kpop', name: 'K-pop Idol', noun: 'an idol', ico: 'star', blurb: 'Auditions, training, a debut and a group.' },
  { id: 'politics', name: 'Politics', noun: 'a politician', ico: 'compass', blurb: 'Parties, campaigns and office.' },
];
export const SPECIAL_BY_ID = Object.fromEntries(SPECIAL_CAREERS.map((c) => [c.id, c]));

/** What an older save was already doing, for a life that has no special career recorded yet. */
function inferred(p, state) {
  if (inOffice()) return 'politics';
  const a = state.sports?.athletes?.[p.id];
  if (a && Object.values(a.sports ?? {}).some((e) => e.status === 'active' && ['pro', 'elite', 'college'].includes(e.level))) return 'sports';
  if (p.idol && (p.idol.traineeId || p.idol.groupId)) return 'kpop';
  // (Read only where there is a fame record already: nothing is created just by looking.)
  if (p.fame && myAct(p)) return 'music';
  if (p.fame && (workOf(p).credits.length || workOf(p).contracts.some((c) => c.status === 'signed'))) return 'acting';
  if (isModel(p)) return 'modeling';
  if (p.fame?.dance && danceOf(p).gigs.length) return 'dance';
  if (p.fame?.writing && (writingOf(p).agent || published(p).length)) return 'writing';
  return null;
}

/** The special career this life has now, or null. */
export function current(p = player(), state = store.state) {
  if (p.flags.special === undefined) {
    const id = p === state.player ? inferred(p, state) : null;
    p.flags.special = id ? { id, since: state.year } : null;
  }
  return p.flags.special?.id ?? null;
}

/** Why this career cannot be taken up now, or ''. */
export function whyNot(id, p = player(), state = store.state) {
  const now = current(p, state);
  if (!now || now === id) return '';
  return `You are ${SPECIAL_BY_ID[now].noun}. One special career at a time: leave ${SPECIAL_BY_ID[now].name.toLowerCase()} first.`;
}

/**
 * Takes this career up, if it is free to be: called by whatever makes it a career (an audition, a band, a contract).
 * @returns {string} '' when it is this life's career now, or why not
 */
export function claim(id, p = player(), state = store.state) {
  const why = whyNot(id, p, state);
  if (why) return why;
  if (!p.flags.special) p.flags.special = { id, since: state.year };
  return '';
}

/** Leaves the special career, so another can be taken up. What was built (credits, records, fans) is kept. */
export function leave(p = player(), state = store.state) {
  const now = current(p, state);
  if (!now) return { ok: false, text: 'You have no special career to leave.', tone: 'neutral' };
  // What cannot simply be walked away from.
  if (now === 'politics' && inOffice()) return { ok: false, text: 'You hold office. Resign first (on the Politics card), or serve out your term.', tone: 'neutral' };
  if (now === 'kpop' && p.idol?.groupId && !trainee(p)) return { ok: false, text: 'You are under contract with your group. You can leave when the contract is up.', tone: 'neutral' };
  // Winding down: the act, the professional sport, the trainee program, the modeling job.
  if (now === 'music' && myAct(p)) leaveAct();
  if (now === 'sports') {
    const a = state.sports?.athletes?.[p.id];
    for (const e of Object.values(a?.sports ?? {})) if (e.status === 'active' && ['pro', 'elite', 'college'].includes(e.level)) retireSport(e.id, state);
  }
  if (now === 'kpop' && trainee(p)) leaveTraining();
  if (now === 'modeling' && isModel(p)) quitCareer();
  // (Winding down may already have closed it: leaving the act does.)
  release(now, p, state);
  const text = `You stepped away from ${SPECIAL_BY_ID[now].name.toLowerCase()}. Whatever you built is still yours; another special career is open to you now.`;
  log(text, 'system', 'neutral');
  return { ok: true, text, tone: 'neutral' };
}

/** Called when what made the career ends on its own (the act is left, the last pro sport retired from, office lost). */
export function release(id, p = player(), state = store.state) {
  if (p.flags.special?.id !== id) return;
  (p.flags.specialPast ??= []).push({ id, from: p.flags.special.since, to: state.year });
  p.flags.special = null;
}
