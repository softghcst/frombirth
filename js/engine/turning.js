// Turning points: the scenes at which a life could go one of two very
// different ways. At these, the player is offered "What if?": a copy of the
// moment kept as a second timeline (save.js, forkGame).
import { renderText } from './eventEngine.js';

// A scene is a turning point if it says so (`turning: true`) or is on this
// list: the offers, proposals, betrayals, departures and reckonings on which
// lives divide. Ordinary days are left out on purpose.
const TURNING = new Set(`research_offer part_time_offer headhunter headhunter_call boss_leaving burnout understudy_on midlife_itch
  they_propose moving_in temptation their_secret ex_returns spouse_job_away spouse_dream kid_decides parent_needs_care new_baby_talk
  brand_offer set_or_school kid_comes_out kid_is_trans call_up_papers everyone_is_leaving exam_answers hot_tip market_panic informant
  seen_something palace_invitation coronation_day heirs_dilemma tell_all_offer monarch_signs_law royal_secret_love royal_love_found_out
  heir_refuses_training child_wants_other_life child_wants_to_renounce heir_marries_for_love referendum_crown after_the_crown
  restoration_offer palace_coup_whisper pol_term_ends dip_crisis kin_wants_politics scandal_rumor scandal_story pol_leadership_open
  pol_leader_defeated pol_removal_vote pol_uprising mt_callbacks musical_must_choose summer_two_offers the_audition cosmo_focus
  editor_calls`.split(/\s+/));

export const turningPoint = (ev) => ev.turning === true || (ev.turning !== false && ev.choices.length >= 2 && TURNING.has(ev.id));

/** The moment in a few words, for the list of timelines. */
export function turningNote(ev, cast) {
  const text = renderText(ev.text, cast).replace(/\s+/g, ' ').trim();
  const first = text.split(/(?<=[.!?])\s/)[0];
  return first.length > 90 ? `${first.slice(0, 87).trimEnd()}…` : first;
}
