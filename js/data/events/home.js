// Scenes a renovated home brings (engine/renovations.js tickHomeLife): the pool in summer, the garden at harvest.
// Sent by the engine, never drawn at random.
import { st, hid, rel, cash, any, ok, bad, chk, ms } from './helpers.js';

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'home_pool_party', category: 'friends', ageRange: [10, 110], weight: 0, queuedOnly: true, cast: { friend: 'tag:never' },
    text: 'Summer, and the pool is warm by noon. {friend} asks, not very subtly, whether you are having people over.',
    choices: [
      { label: 'Throw a pool party', outcomes: [any('Music, too many towels, someone pushed in fully dressed. {friend} stays until the lights come on in the water.', 'good', rel('friend', 6), st('mood', 6), cash(-60))] },
      { label: 'Just {friend} and you, a lazy afternoon', outcomes: [any('Floating, talking about nothing, the sun going down. The best kind of day.', 'good', rel('friend', 4), st('mood', 4))] },
      { label: 'A quiet swim on your own', outcomes: [any('Lengths in the early morning, before anyone is up. Your shoulders thank you.', 'good', st('mood', 3), st('health', 1))] },
    ],
  },
  {
    id: 'home_harvest', category: 'everyday', ageRange: [6, 110], weight: 0, queuedOnly: true, castGiven: true, cast: {},
    text: 'The garden has outdone itself this year: more tomatoes than anyone can eat, beans climbing the fence, and one marrow that is frankly showing off.',
    choices: [
      { label: 'Share it round the neighbors', outcomes: [any('Bags on doorsteps all down the street. People wave at you differently now.', 'good', hid('karma', 2), st('mood', 3))] },
      { label: 'Enter the best of it at the fair', check: chk(0.3, { 'skills.gardening': 0.6, 'trait.green_thumb': 0.5 }), outcomes: [
        ok('First prize, a rosette and your name in the local paper. You pretend it is nothing. It is not nothing.', st('mood', 8), ms('Won first prize at the fair for something you grew.')),
        bad('Highly commended. The winner has been growing marrows for forty years and it shows.', st('mood', 1))] },
      { label: 'Keep it all for the kitchen', outcomes: [any('Jars of it lined up on every shelf. Winter will taste of this summer.', 'good', st('mood', 3), st('health', 1))] },
    ],
  },
];
