// What a working member of a royal family may not do. Royals do not take paid or commercial work: no commercials,
// no auditions for parts, no paid dance gigs, no endorsements, no reality television. (Amateur things are fine: a
// royal may compete as an amateur, as real ones do in sport.) Stepping back from royal life lifts it.
// Kept apart from engine/royalty.js so the work engines can ask without importing the crown.
import { player } from '../state.js';
import { ROYAL_RANKS } from '../data/royalty.js';

/** Whether the player is a working royal (born into or married into the royal family, not stepped back). */
export const workingRoyal = (p = player()) => !!p.royal && ROYAL_RANKS.includes(p.royal.rank);

/** Why the player may not take paid or commercial work, or ''. */
export const royalWorkBan = (p = player()) => (workingRoyal(p)
  ? 'Members of the royal family do not take paid or commercial work. Stepping back from royal life would change that.' : '');
