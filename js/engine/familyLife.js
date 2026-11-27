// Living Families & Growing Up: where the five features meet the rest of the game.
//
//   yearProcessor   familyLifeYear()          first of the yearly steps: each month of the year just ended, in order,
//                                             then the year's money (the fostering allowance); lease months are ready
//                                             for finance
//   save.js         migrateFamilyLife(state)  on every load: the record, and repairs to older saves
//   effects.js      familyLifeChoice(value)   a choice in one of the scenes (data/events/stories/familyLife.js)
//   ui              familyActions(npc), familyAct(id, npc)  what can be done with a step relative or a child in care
//
// Turn length: what the player does is done at once, any turn, and dated to the month it was done in (a lease signed
// in month 3 is billed from month 3; a grounding ends in the month it ends; actions are limited per turn). What
// happens by itself is worked out month by month, but at the turn of the year, for every turn length alike: as the
// game's other yearly steps are (engine/turns.js keeps the year's story beats out of the turns between). So a life
// played in 3-, 6- or 12-month turns comes out exactly the same (tests/turns.mjs).
import { store } from '../state.js';
import { LF, processThrough, lived } from './livingFamilies.js';
import * as blended from './blended.js';
import * as teen from './teenLife.js';
import * as home from './independence.js';
import * as love from './engagement.js';
import * as care from './fostering.js';

export { blended, teen, home, love, care };

/** The yearly step: the rest of the months of the year just ended, then its money. */
export function familyLifeYear(state = store.state) {
  processThrough(state);
  care.payAllowance(state);
}

/**
 * On every load, and harmless to repeat. Adds the record to an older save without inventing any of its past, and
 * repairs what older versions left inconsistent:
 * - a partner moved in with (together.js wrote livingTogether; the game reads livesTogether everywhere else),
 * - a marriage from before these features never brings stepchildren afterward,
 * - an engagement already under way is recorded from now.
 */
export function migrateFamilyLife(state = store.state) {
  if (!state?.player?.id || !state.npcs) return;
  const fresh = !state.livingFamilies;
  const f = LF(state);
  // Partners the player was already with when partners' children began to be kept are left as they are (once).
  const firstPartnerKids = !f.partnerKids;
  f.partnerKids = 1;
  for (const id of state.player.npcIds ?? []) {
    const n = state.npcs[id];
    if (!n) continue;
    if (n.role === 'partner' && n.flags?.livingTogether && !n.flags.livesTogether) n.flags.livesTogether = true;
    if (fresh && n.role === 'spouse') n.flags.stepKidsChecked = true;
    if (firstPartnerKids && n.role === 'partner' && n.flags) n.flags.kidsChecked ??= true;
    if (n.role === 'partner' && n.flags?.engaged) (f.love.engagements ??= {})[n.id] ??= { since: lived(state), weddingMonth: null, party: null, told: false };
  }
}

/** A choice in a family scene: 'feature:story:choice'. Returns the line shown after it. */
export function familyLifeChoice(value, cast = {}) {
  const [feature, story, choice] = String(value).split(':');
  const state = store.state;
  switch (feature) {
    case 'blended': return blended.blendedChoice(story, choice, cast, state);
    case 'teen': return teen.teenChoice(story, choice, cast, state);
    case 'home': return home.homeChoice(story, choice, state);
    case 'love': return love.loveSceneChoice(story, choice, cast, state);
    case 'care': return care.careChoice(story, choice, cast, state);
    default: return '';
  }
}

/** What can be done with this person from these features (shown on their page). */
export function familyActions(npc) {
  if (!npc?.alive) return [];
  return [...blended.stepActions(npc), ...care.careActions(npc)];
}
/** Does one of familyActions: ids are 'fl:<feature>:<action>'. */
export function familyAct(id, npc) {
  const [, feature, action] = id.split(':');
  if (feature === 'step') return blended.stepAct(action, npc);
  if (feature === 'care') return care.careAct(action, npc);
  return { ok: false, text: 'Nothing happens.', tone: 'neutral' };
}
