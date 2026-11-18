// Health, time off, life online and life abroad.
import { st, hid, cash, rel, flag, cond, ok, bad, any, chk, need, addNpc, mem } from './helpers.js';

/** Multiplies the player's followers, e.g. 0.8 to lose a fifth. */
const audience = (value) => ({ type: 'followers', value });

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'doctors_orders', category: 'health', ageRange: [42, 80], once: true,
    text: 'At a routine appointment, the doctor puts down the chart and says, kindly, that the next ten years depend on what you do in the next one.',
    choices: [
      { label: 'Change how you live', check: chk(0.5, { 'hidden.discipline': 0.7, 'hidden.willpower': 0.4 }), outcomes: [
        ok('You walk every morning and stop pretending the cookies do not count. By the next appointment the numbers have moved.', st('health', 10), st('mood', 4), hid('discipline', 4)),
        bad('You manage three weeks. It is three weeks more than nothing.', st('health', 2)),
      ] },
      { label: 'Nod, and carry on', outcomes: [any('You have heard it before.', 'neutral', st('health', -4))] },
      { label: 'Find a different doctor', outcomes: [any('The new one says the same thing, in a nicer office.', 'neutral', cash(-300), st('mood', -1))] },
    ],
  },
  {
    id: 'low_winter', category: 'health', ageRange: [16, 85], cooldown: 12, requires: [need('stats.mood', '<=', 30)],
    text: 'It has been months since anything felt like much. You are getting through the days, and that is all.',
    choices: [
      { label: 'Tell someone how bad it is', outcomes: [any('Saying it out loud does not fix it. It does make it something two people know about.', 'good', st('mood', 9), hid('willpower', 2))] },
      { label: 'Push through on your own', check: chk(0.35, { 'hidden.willpower': 0.8 }), outcomes: [
        ok('Slowly, without any one day you could point to, it lifts.', st('mood', 6)),
        bad('It settles in, and it does not lift.', cond('depression'), st('mood', -5)),
      ] },
      { label: 'Stay in bed', outcomes: [any('The days run together.', 'bad', cond('depression'), st('health', -3))] },
    ],
  },
  {
    id: 'gym_regular', category: 'leisure', ageRange: [16, 70], cooldown: 10, requires: [need('stats.health', '>=', 70)],
    text: 'Someone at the gym you see every week nods at you, and asks whether you want to train together.',
    choices: [
      { label: 'Say yes', outcomes: [any('{pal} turns out to be a hard taskmaster and very good company.', 'good', addNpc('friend', 'pal'), st('health', 3), st('mood', 4))] },
      { label: 'Say you prefer to train alone', outcomes: [any('They nod, no offense taken, and go back to their set.', 'neutral')] },
    ],
  },
  {
    id: 'post_backlash', category: 'online', ageRange: [13, 80], cooldown: 6, requires: [need('social.followers', '>=', 5000)],
    text: 'Something you posted years ago has been dug up, and a great many strangers have opinions about it this morning.',
    choices: [
      { label: 'Apologize plainly', check: chk(0.6, { 'stats.charm': 0.5 }), outcomes: [
        ok('Short, direct, no excuses. It blows over in a week, and some people like you more.', audience(0.97), st('mood', -2), hid('karma', 2)),
        bad('The apology gets taken apart line by line.', audience(0.8), st('mood', -7)),
      ] },
      { label: 'Say nothing and wait', outcomes: [any('It is somebody else\'s turn by Thursday.', 'neutral', audience(0.9), st('mood', -4))] },
      { label: 'Double down', check: chk(0.3, { 'stats.charm': 0.6 }), outcomes: [
        ok('Half of them leave. A different, louder half arrives.', audience(1.3), hid('crazy', 3), hid('karma', -3)),
        bad('It gets much worse.', audience(0.55), st('mood', -10), hid('karma', -3)),
      ] },
    ],
  },
  {
    id: 'brand_offer', category: 'online', ageRange: [16, 70], cooldown: 5, requires: [need('social.followers', '>=', 25000)],
    text: 'A company you have never heard of offers {$3000} for one post about a slimming tea. The ingredients list is short and alarming.',
    choices: [
      { label: 'Take the money', outcomes: [any('You post it. A few people say it made them ill.', 'neutral', cash(3000), hid('karma', -6), audience(0.96))] },
      { label: 'Say no, and say why', outcomes: [any('Your followers like that you turned it down. Better brands notice too.', 'good', hid('karma', 4), audience(1.05), st('mood', 3))] },
      { label: 'Ignore the email', outcomes: [any('They find someone else.', 'neutral')] },
    ],
  },
  {
    id: 'homesick', category: 'abroad', ageRange: [18, 95], once: true, weight: 3,
    requires: [need('flags.emigratedAge', '>=', 1)],
    text: 'A year into your new country, a smell from an open window stops you in the street. It is exactly the smell of the kitchen you grew up in.',
    choices: [
      { label: 'Ring home', outcomes: [any('You talk for two hours about nothing. It helps, and it makes it worse, in about equal measure.', 'good', st('mood', 5))] },
      { label: 'Go and find the people from home who live here', outcomes: [any('There is a café, it turns out, and everyone in it has the same story as you. {pal} buys you a coffee.', 'good', addNpc('friend', 'pal'), st('mood', 7))] },
      { label: 'Decide this is home now', outcomes: [any('You learn the names of the streets, and then the people on them.', 'good', hid('willpower', 4), st('mood', 2))] },
    ],
  },
  {
    id: 'lost_passport', category: 'leisure', ageRange: [18, 85], cooldown: 12, requires: [need('cashBase', '>=', 500)],
    text: 'At the airport on the way home from a trip, you reach into your bag and your passport is not where it always is.',
    choices: [
      { label: 'Retrace every step', check: chk(0.5, { 'stats.intellect': 0.5 }), outcomes: [
        ok('It is in the seat pocket of the taxi, and the driver is still outside.', st('mood', 4)),
        bad('It is gone. Two days and {$400} at the embassy.', cash(-400), st('mood', -5)),
      ] },
      { label: 'Go straight to the embassy', outcomes: [any('Forms, a photo booth, and a new flight. It costs {$400}.', 'neutral', cash(-400), st('mood', -3))] },
    ],
  },
];
