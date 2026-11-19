// A will and the people in it (engine/estateReview.js). Queued only when it has really happened; nothing is changed
// in the will by any of these: they ask whether the player wants to look at it.
import { any } from '../helpers.js';

const e = (value) => ({ type: 'estate', value });
const scene = (id, text, choices) => ({ id, category: 'family', ageRange: [18, 120], queuedOnly: true, text,
  choices: choices.map(([label, value, line]) => ({ label, outcomes: [any(line, 'neutral', e(value))] })) });

export default [
  scene('will_beneficiary_died', 'Your Will May Need Updating. {gone}, who is named in your will, has died. {alt} Would you like to review it?', [
    ['Review the will', 'beneficiary:review', 'You get the will out of the drawer.'],
    ['Decide later', 'beneficiary:later', 'Not now.'],
  ]),
  scene('heir_died', 'Your Selected Heir Has Passed Away. You had chosen {gone} as the one you meant to carry on as. Nobody has been chosen in their place.', [
    ['Choose someone else', 'heir:review', 'You think about who it should be.'],
    ['Decide later', 'heir:later', 'Not now.'],
  ]),
  scene('will_review', 'Reviewing a Will. Since you last looked at your will, {why}. It says what it said before.', [
    ['Review the will', 'review:review', 'You get the will out of the drawer.'],
    ['Decide later', 'review:later', 'Not now.'],
  ]),
];
