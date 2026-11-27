// Scenes from foster and kinship care (engine/fostering.js), queued only when they happen, about the real child.
// The plan for a child is the agency's and the court's to make: the carer's choices are about how they care, and what
// they say at a review, never a veto over a child going home.
import { any } from './helpers.js';

const f = (value) => ({ type: 'foster', value });
const scene = (id, ageRange, text, choices) => ({ id, category: 'family', ageRange, queuedOnly: true, text,
  choices: choices.map(([label, line, value]) => ({ label, outcomes: [any(line, 'neutral', f(value))] })) });

export default [
  scene('fc_referral', [21, 90], 'The agency calls. A child of {age}, {kid}, needs somewhere to live: {reason}. The plan is for {kid} to go home when their family is able. Can you take {kid}?', [
    ['Say yes', 'You say yes, and start making up the spare room.', 'ref_yes'],
    ['Say you cannot, this time', 'You tell them honestly that now is not right.', 'ref_no'],
  ]),
  scene('fc_welcome', [21, 90], '{kid} arrives with a caseworker and one bag. What {kid} needs most, the caseworker says quietly: {needs}.', [
    ['Show them their room', 'You show them the room that is theirs now.', 'welcome_room'],
    ['Ask what they like to eat', 'You ask what they would like for dinner.', 'welcome_food'],
    ['Give them some space', 'You let them settle in their own way.', 'welcome_space'],
  ]),
  scene('fc_review', [21, 90], 'The yearly review for {kid}: the caseworker, the reviewer, and a phone line for {kid}\'s family. {said}', [
    ['Tell them how it is going', 'You say what you have seen this year.', 'review_support'],
    ['Raise a concern', 'You raise something that has been worrying you.', 'review_concern'],
  ]),
  scene('fc_permanency', [21, 90], 'The plan for {kid} has changed to a permanent home. {rights} The caseworker asks, carefully, whether you have thought about what you would want.', [
    ['Ask about becoming their guardian', 'You ask what guardianship would mean.', 'perm_guardian'],
    ['Ask about adoption', 'You ask about adoption.', 'perm_adopt'],
    ['Say you need time to think', 'You say you need to think it through.', 'perm_later'],
  ]),
  scene('fc_goodbye', [21, 90], 'It is decided: {kid} is going home. On the last morning the bag is packed again, fuller than when it came.', [
    ['Hug them goodbye', 'You hug them at the door.', 'bye_hug'],
    ['Give them your number', 'You write your number on the inside of the bag.', 'bye_keep'],
  ]),
  scene('kin_care_offer', [21, 95], 'The family needs someone to take {kid} in: there is no parent able to look after them now. You are family. Will you?', [
    ['Take them in', 'You say yes before you have worked out where everyone will sleep.', 'kin_yes'],
    ['Say you cannot', 'You say you cannot, and it costs you to say it.', 'kin_no'],
  ]),
];
