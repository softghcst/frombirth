// Scenes about weather and other disasters (engine/disasters.js). None is drawn by chance: each is queued when a real
// disaster in the world of the game calls for it, and names it. {what} is the disaster ("Hurricane Cora", "the flood").
import { st, hid, rel, any, cash } from './helpers.js';

const disaster = (value) => ({ type: 'disaster', value });

export default [
  {
    // Turns shorter than a year: a storm, flood or fire seen coming, a turn ahead.
    id: 'disaster_forecast', category: 'disaster', ageRange: [18, 120], queuedOnly: true, between: { queued: true }, // its own luck, like every turn's scene cooldown: 0, cast: {},
    text: 'The forecasts are all about {what}, expected to hit in {when}. The shops are already running out of water and batteries.',
    choices: [
      { label: 'Prepare properly: board up, sandbag, stock up, and stay', outcomes: [any('You spend a weekend on it, and the house looks like a fortress.', 'neutral', cash(-60), disaster({ do: 'prep', how: 'ready' }))] },
      { label: 'Leave for somewhere safer until it passes', outcomes: [any('You pack the car and go inland to stay with friends.', 'neutral', cash(-200), disaster({ do: 'prep', how: 'evacuated' }))] },
      { label: 'It will probably miss us', outcomes: [any('You carry on as normal, and keep half an eye on the news.', 'neutral', disaster({ do: 'prep', how: 'stayed' }))] },
    ],
  },
  {
    id: 'disaster_aftermath', category: 'disaster', ageRange: [8, 120], queuedOnly: true, cooldown: 0, cast: {},
    text: '{after}',
    choices: [
      { label: 'Help the neighbors', outcomes: [any('Hard work, sore backs and a lot of sandwiches. You know everyone on the street by name now.', 'good', st('mood', 4), hid('karma', 3), st('health', -1))] },
      { label: 'Give to the relief fund', outcomes: [any('It is not much, but it is something, and it goes straight to the people who lost the most.', 'good', cash(-100), hid('karma', 2), st('mood', 2))] },
      { label: 'Volunteer at the shelter', outcomes: [any('Blankets, hot drinks and long nights. Some of the stories stay with you.', 'good', hid('karma', 4), st('mood', 1))] },
      { label: 'Keep your head down and get on with things', outcomes: [any('You get back to normal as fast as you can.', 'neutral')] },
    ],
  },
  {
    id: 'disaster_far_away', category: 'disaster', ageRange: [12, 120], queuedOnly: true, cooldown: 0, cast: { person: 'friend' }, castGiven: true,
    text: 'The news is full of {what} in {where}, and {person} lives there.',
    choices: [
      { label: 'Keep calling until you get through', outcomes: [any('Hours of busy tones, and then {person}\'s voice, tired and safe. You both cry a little.', 'good', rel('person', 8), st('mood', 2))] },
      { label: 'Send money to help', outcomes: [any('{person} says it will help with the repairs, and that they will never forget it.', 'good', cash(-300), rel('person', 10))] },
      { label: 'Wait for news', outcomes: [any('A message comes three days later: they are fine. The waiting was the worst part.', 'neutral', rel('person', 2))] },
    ],
  },
];
