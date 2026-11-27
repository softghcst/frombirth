// Scenes from moving out (engine/independence.js): queued when they happen, about the people who were there.
import { any, st, rel } from './helpers.js';

export default [
  { id: 'home_first_night', category: 'adult', ageRange: [16, 70], queuedOnly: true,
    text: 'Your first night in a place of your own, in {place}. The boxes are still in the hall. It is very quiet, and every sound is new.',
    choices: [
      { label: 'Call home', outcomes: [any('You call home and say you are fine, which is mostly true. They sound proud.', 'good', st('mood', 4))] },
      { label: 'Unpack everything tonight', outcomes: [any('You unpack until two in the morning. It looks like someone lives here now.', 'good', st('mood', 3))] },
      { label: 'Order food and sit on the floor', outcomes: [any('You eat out of the carton, on the floor, in your own place. It is the best meal in weeks.', 'good', st('mood', 5))] },
    ] },
  { id: 'home_first_night_shared', category: 'adult', ageRange: [16, 70], queuedOnly: true,
    text: 'Your first night in the new place in {place}, with {roommate}. Neither of you has worked out the light switches.',
    choices: [
      { label: 'Cook something together', outcomes: [any('You make pasta with what you have, which is pasta. {roommate} declares it a tradition.', 'good', rel('roommate', 6), st('mood', 3))] },
      { label: 'Agree on the house rules', outcomes: [any('You agree on the dishes, the bathroom and the rent day. It is less awkward than you feared.', 'good', rel('roommate', 3))] },
      { label: 'Go to bed early', outcomes: [any('You say goodnight early. Tomorrow you will find out what living with {roommate} is like.', 'neutral')] },
    ] },
];
