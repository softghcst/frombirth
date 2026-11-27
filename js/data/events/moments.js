// Scenes about the occasions a family keeps (engine/moments.js). These are
// queued by the engine when the life calls for them, never drawn at random.
import { st, rel, any, need, mem } from './helpers.js';

const moment = (value) => ({ type: 'moment', value });

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'tradition_handover', category: 'family', ageRange: [18, 110], weight: 0, cast: { host: 'tag:never' }, requires: [need('age', '>=', 18)],
    text: '{host} has hosted it for as long as anyone can remember. This year, doing the dishes afterward, they say quietly that they are not sure they can manage it again.',
    choices: [
      { label: 'Offer to host it from now on', outcomes: [any('{host} looks relieved, and then a little sad, and then relieved again. Next year it is at yours.', 'good', moment('takeover'), rel('host', 6), mem('host', 'took_tradition', 'You took over the family\'s tradition when I could not.'))] },
      { label: 'Suggest someone younger takes it on', outcomes: [any('A cousin says yes before anyone else can. It will be different, and it will go on.', 'neutral', moment('cousin'), rel('host', 2))] },
      { label: 'Let it end with them', outcomes: [any('Perhaps some things should stop when the person who started them stops. It is quieter, after.', 'neutral', moment('lapse'), st('mood', -3))] },
    ],
  },
  // Someone in the family suggests doing something every year (engine/moments.js proposeTradition). A child can say
  // yes or roll their eyes and come anyway; only an adult can offer to host.
  offer('holiday', '{host} has an idea: from now on, {holiday} at theirs, every year, the whole family, no excuses.'),
  offer('sunday_dinner', '{host} says the family hardly sees each other anymore. Their idea: Sunday dinner, every week, at their table.'),
  offer('family_trip', '{host} has found a place by the water and wants to go back every summer. "It could be our week," they say.'),
  offer('birthday_breakfast', '{host} brings breakfast in bed on a birthday, a little burned, with a candle in the toast. "Let\'s always do this," they say.'),
  offer('summers_grandparents', '{host} suggests a few weeks at the grandparents\' every summer. There is a lake, apparently, and a dog.'),
  offer('family_game_night', '{host} puts a board game on the table on a Friday night and announces this is a thing now. Every Friday.'),
  {
    id: 'tradition_own_home', category: 'family', ageRange: [18, 110], weight: 0, queuedOnly: true, cast: { host: 'tag:never' }, requires: [need('age', '>=', 18)],
    text: 'Your own place, your own table. You find yourself missing {tradition}, the way {host} always did it.',
    choices: [
      { label: 'Start your own version, at your place', outcomes: [any('You do it your way, with a few of their touches. It feels like yours from the first year.', 'good', moment('own:start'), st('mood', 4), rel('host', 3))] },
      { label: 'Keep going home for theirs', outcomes: [any('Some things belong at the table you grew up at. You will be there.', 'good', rel('host', 4))] },
    ],
  },
];

function offer(kind, text) {
  return {
    id: `tradition_offer_${kind}`, category: 'family', ageRange: [4, 110], weight: 0, queuedOnly: true, cast: { host: 'tag:never' },
    text,
    choices: [
      { label: 'Count me in', outcomes: [any('Every year from now on. Nobody says it out loud, but everyone is pleased.', 'good', moment('offer:join'), rel('host', 4), st('mood', 3))] },
      { label: 'Offer to host it yourself', requires: [need('age', '>=', 18)], outcomes: [any('{host} looks delighted to hand it over. It will be at yours.', 'good', moment('offer:host'), rel('host', 5), st('mood', 3))] },
      { label: 'Not really your thing', outcomes: [any('{host} lets it drop, a little hurt.', 'neutral', moment('offer:no'))] },
    ],
  };
}
