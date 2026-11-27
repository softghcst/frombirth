// Callbacks (engine/callbacks.js): people from the player's past come back, years on, because of something that really
// happened between them. Queued only when that history is on the record.
import { any } from './helpers.js';

const cb = (value) => ({ type: 'callback', value });
const scene = (id, ageRange, text, choices) => ({ id, category: 'friends', ageRange, queuedOnly: true, text,
  choices: choices.map(([label, line, value]) => ({ label, outcomes: [any(line, 'neutral', cb(value))] })) });

export default [
  scene('cb_care_wedding', [25, 110], 'An envelope, addressed by hand. {them}, who lived with you in foster care years ago, is getting married, and would like you there.', [
    ['Go to the wedding', 'You buy a new suit of clothes, and go.', 'wed_go'],
    ['Send a gift and a card', 'You send your love, and a gift.', 'wed_gift'],
  ]),
  scene('cb_roommate_job', [22, 60], '{them}, who shared a flat with you years ago, calls out of nowhere. They are senior at their firm now, there is an opening, and they thought of you.', [
    ['Take the job', 'You say yes before they finish the sentence.', 'job_take'],
    ['Say it is not for you', 'You thank them, and say no.', 'job_no'],
  ]),
  scene('cb_school_friend', [25, 110], 'A message from {them}: you were inseparable at school, and then you were not. "I have thought about you a lot. Coffee?"', [
    ['Meet up', 'You say yes.', 'friend_meet'],
    ['Write back', 'You write a long reply instead.', 'friend_reply'],
    ['Leave it', 'You leave it, for now.', 'friend_leave'],
  ]),
  scene('cb_former_step', [29, 51], 'At your birthday party, {them} is at the door: your former step-parent, who was part of your childhood for years, with a present and a slightly nervous smile.', [
    ['Bring them in', 'You hug them, and bring them in.', 'step_glad'],
    ['Thank them for coming', 'You thank them, politely.', 'step_polite'],
  ]),
  scene('cb_stepsib_wedding', [16, 110], '{them} is getting married, and the invitation says you are to sit with the family. You and {them} were not born related; you grew up related anyway.', [
    ['Go', 'You go, and dance.', 'sib_go'],
    ['Send a gift', 'You send a gift and your love.', 'sib_gift'],
  ]),
];
