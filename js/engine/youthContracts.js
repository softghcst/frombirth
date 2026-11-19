// Soccer's way in, by FIFA's rules and the academies' own: at 16 an academy offers its best a scholarship (England's
// two years of full-time training and study) or a youth contract, and lets the rest go; a first professional contract
// may be signed at 16 (at 17 in England), and runs no more than three years while the player is under 18. Most academy
// players are released at 16 or 18 and never play professionally.
//
//   e.youth = { offered: year, scholar: { from, until } | null, released: year | null }
import { log, milestone } from '../state.js';
import { sportOf } from '../data/sports.js';
import * as sp from './sports.js';
import { internals as life, settle } from './sportsLife.js';

const { overall } = sp.internals;
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
export const YOUTH_SPORTS = ['soccer'];
/** The youngest age for a first professional contract: 17 in England, 16 elsewhere (FIFA). */
export const firstProAge = (p, sportId) => (YOUTH_SPORTS.includes(sportId) ? (p.countryId === 'uk' ? 17 : 16) : 17);
/** FIFA: under 18, a contract runs three years at most. */
export const maxYears = (p, sportId, years) => (YOUTH_SPORTS.includes(sportId) && p.age < 18 ? Math.min(3, years) : years);
const word = (p) => (p.countryId === 'uk' ? 'scholarship' : 'youth contract');

/** The player's year at an academy, after the season (engine/sportsLife.js yearIn). */
export function youthYear(state, a, e) {
  const p = state.player;
  if (!YOUTH_SPORTS.includes(e.id) || e.contractId || sp.proPath(sportOf(e.id), p.countryId) === 'draft') return;
  const Y = (e.youth ??= { offered: null, scholar: null, released: null });
  // The scholar's wage, and the end of it: a professional contract, or released at 18.
  if (Y.scholar) {
    if (state.year < Y.scholar.until) settle(state, `scholar/${e.id}/${state.year}`, life.money(state, p.countryId === 'uk' ? 7000 : 6000), 'salary', `${word(p)[0].toUpperCase()}${word(p).slice(1)}: ${sp.orgOf(e.orgId, state)?.name ?? 'the academy'}`);
    else if (!Y.released) {
      Y.released = state.year; Y.scholar = null;
      leave(state, e, `The ${word(p)} is over, and ${sp.orgOf(e.orgId, state)?.name ?? 'the academy'} did not offer a professional contract. You are released.`);
    }
    return;
  }
  // Sixteen at the academy: kept on, or let go.
  if (e.level !== 'academy' || p.age !== 16 || Y.offered || Y.released) return;
  Y.offered = state.year;
  const org = sp.orgOf(e.orgId, state);
  if (overall(e, p) < 54) {
    Y.released = state.year;
    leave(state, e, `${org?.name ?? 'The academy'} told you at 16 that they will not be offering you a ${word(p)}. You are released, like most boys and girls who get this far.`);
    return;
  }
  life.decide(state, { kind: 'youthDeal', sportId: e.id, key: `youthDeal/${e.id}`, orgId: org?.id,
    text: `${org?.name ?? 'The academy'} offer you a two-year ${word(p)}: full-time training${p.countryId === 'uk' ? ' and a college course' : ''}, a small wage, and the chance of a professional contract at the end of it.`,
    options: [{ id: 'yes', label: `Take the ${word(p)}` }, { id: 'no', label: 'Stay in school instead' }] });
}
function leave(state, e, text) {
  // Released: back to an ordinary club, where a professional club can still find the player.
  sp.internals.leaveOrg(e, state, 'released');
  sp.internals.joinOrg(sp.internals.findOrg(state, sportOf(e.id), 'club'), state, { quiet: true });
  sp.say(state, text, 'bad', { screen: 'sport', id: e.id });
  sp.moment(state, { type: 'released', sportId: e.id, text: 'Released by the academy.', sig: 2 });
}

export const YOUTH_ANSWERS = {
  youthDeal(state, d, choice) {
    const p = state.player;
    const e = sp.entryOf(d.sportId, p.id, state);
    if (!e?.youth) return { ...result(false, 'That has passed.', 'neutral'), close: true };
    if (choice === 'no') { e.youth.released = state.year; sp.internals.leaveOrg(e, state, 'left for school'); sp.internals.joinOrg(sp.internals.findOrg(state, sportOf(e.id), 'club'), state, { quiet: true }); return result(true, 'You left the academy to stay in school.', 'neutral'); }
    e.youth.scholar = { from: state.year, until: state.year + 2 };
    milestone(`Took a ${word(p)} at ${sp.orgOf(d.orgId, state)?.name ?? 'the academy'}.`, 'career');
    log(`You took the ${word(p)}.`, 'system', 'good');
    return result(true, `You signed a ${word(p)} with ${sp.orgOf(d.orgId, state)?.name ?? 'the academy'}.`);
  },
};
