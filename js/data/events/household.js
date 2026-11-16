// Scenes of the royal household: the people who work for the player, and
// the houses the family owns. staff_leak is sent by engine/household.js
// when someone on the staff has been talking; {aide} is that person.
import { st, hid, cash, ok, bad, any, chk, need, rel, image, family, press, story, coolStory, support, mem } from './helpers.js';

const royal = need('isRoyal', '==', true);
const has = (amount) => need('cashBase', '>=', amount);
const employs = (post) => need('staffPosts', 'has', post);

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'staff_leak', category: 'royalty', ageRange: [18, 110], queuedOnly: true, cooldown: 1,
    text: 'Something only four people knew is in a newspaper. Three of them are family. The fourth is {aide}, who has worked beside you every day, and who cannot quite meet your eye this morning.',
    choices: [
      { label: 'Ask them, plainly', check: chk(0.5, { 'cast.aide.relationship': 0.9, 'stats.charm': 0.3 }), outcomes: [
        ok('{aide} tells you everything: a journalist, a debt, one stupid lunch. They offer to resign. You tell them to get back to work, and they never give you cause to ask again.', rel('aide', 25), story('a leak from your own household', true, 18), mem('aide', 'forgivenLeak', 'You forgave them for talking to a journalist.')),
        bad('{aide} denies it, smoothly, and you know. So do they. Nothing is the same after.', rel('aide', -15), story('a leak from your own household', true, 30), st('mood', -5)),
      ] },
      { label: 'Dismiss them today', outcomes: [any('{aide} clears a desk in twenty minutes, watched by a policeman. They know a great deal more than they have told, and now they have no reason to keep it.', 'neutral', rel('aide', -40), story('a leak from your own household', true, 25), story('what a dismissed member of your staff is saying', true, 35), press(-3))] },
      { label: 'Say nothing, and tell them nothing more', outcomes: [any('You keep {aide} on, and keep them out of every room that matters. It works. It is a lonely way to run an office.', 'neutral', rel('aide', -8), story('a leak from your own household', true, 22), hid('discipline', 2))] },
    ],
  },
  {
    id: 'secretary_warning', category: 'royalty', ageRange: [18, 110], cooldown: 9, cast: { aide: 'tag:secretary' }, requires: [royal, employs('secretary')],
    text: '{aide} puts your speech for tomorrow back on the desk with one paragraph marked. "It is true," they say. "And if you say it, it will be the only thing anyone hears for a month."',
    choices: [
      { label: 'Cut the paragraph', outcomes: [any('The speech is a little duller and a great deal safer. {aide} was right; you can tell from what the newspapers find to complain about instead.', 'good', rel('aide', 5), image(2))] },
      { label: 'Say it anyway', check: chk(0.4, { 'stats.charm': 0.5, 'royal.image': 0.4 }), outcomes: [
        ok('You say it, plainly, and the room goes quiet. By morning it is being called the bravest thing a royal has said in a generation.', image(10), press(4), family(-6), rel('aide', 3)),
        bad('It is the only thing anyone hears for a month. {aide} does not say so. They do not need to.', image(-8), press(-6), family(-6), story('a speech that went too far', true, 40)),
      ] },
      { label: 'Ask them to rewrite it so it can be said', outcomes: [any('{aide} is up half the night. The paragraph that comes back says the same thing in a way nobody can object to. That is what you pay them for.', 'good', image(4), rel('aide', 6))] },
    ],
  },
  {
    id: 'press_secretary_trade', category: 'royalty', ageRange: [18, 110], cooldown: 10, cast: { aide: 'tag:press' }, requires: [royal, employs('press')],
    text: '{aide} has a proposal. A newspaper has a damaging story about you, half true. They will drop it in exchange for something else: an exclusive about a cousin\'s troubles, which is entirely true.',
    choices: [
      { label: 'Refuse', outcomes: [any('You will not buy your peace with somebody else\'s. The story about you runs. {aide} deals with it, and thinks more of you than before.', 'neutral', story('a half-true story about you', true, 35), hid('karma', 6), rel('aide', 6), family(3))] },
      { label: 'Agree', outcomes: [any('Your story vanishes. Your cousin\'s is on the front page on Sunday. They never find out how it got there, and you never forget.', 'bad', hid('karma', -12), family(-4), coolStory(-20), rel('aide', -3))] },
      { label: 'Give them an interview with you instead', check: chk(0.5, { 'stats.charm': 0.5 }), outcomes: [
        ok('An hour of your time for the story dropped. It is a good interview, and nobody is sold.', image(5), press(5), rel('aide', 4)),
        bad('They take the interview, and run the story the week after.', image(-3), story('a half-true story about you', true, 35), press(-4)),
      ] },
    ],
  },
  {
    id: 'steward_finds_money', category: 'royalty', ageRange: [18, 110], cooldown: 9, cast: { aide: 'tag:steward' }, requires: [need('reigning', '==', true), employs('steward')],
    text: '{aide} has been through the estate books for the last thirty years, and has found that a firm of land agents has been quietly overcharging the family the whole time.',
    choices: [
      { label: 'Recover it, through the courts', outcomes: [any('It takes two years and is settled on the court steps. {aide} brings you the cheque themselves.', 'good', cash(350000), rel('aide', 8), press(-2))] },
      { label: 'Settle quietly for half', outcomes: [any('No court, no headlines, and a cheque by the end of the month.', 'good', cash(170000), rel('aide', 3))] },
      { label: 'Let it go, and change agents', outcomes: [any('You have no wish to see the family\'s accounts read out in court. {aide} thinks it a pity, and says so once.', 'neutral', rel('aide', -4))] },
    ],
  },
  {
    id: 'estate_storm', category: 'royalty', ageRange: [18, 110], cooldown: 9, requires: [need('reigning', '==', true), need('ownsEstate', '==', true)],
    text: 'A storm has brought down four hundred trees in the park of the family castle, and one of them has gone through the roof of the chapel. The estimate arrives, with an apology attached: {$260000}.',
    choices: [
      { label: 'Pay for all of it', requires: [has(260000)], outcomes: [any('The chapel roof goes back on in oak, as it was. The village comes to the rededication, and so does the bishop.', 'good', cash(-260000), support(2), st('mood', 3))] },
      { label: 'Ask the public to help', outcomes: [
        { on: 'always', weight: 0.5, tone: 'good', text: 'An appeal is launched, with your own gift at the top of the list. It is met in six weeks, mostly in small sums.', effects: [cash(-40000), support(4), image(3)] },
        { on: 'always', weight: 0.5, tone: 'bad', text: '"Family worth millions asks pensioners to mend its chapel," says the headline.', effects: [support(-5), image(-6), press(-5), story('asking the public to pay for your chapel', true, 35)] },
      ] },
      { label: 'Make it safe, and leave it', outcomes: [any('A tarpaulin, and scaffolding that stays up for years. Visitors photograph it.', 'neutral', cash(-20000), family(-4))] },
    ],
  },
  {
    id: 'old_retainer', category: 'royalty', ageRange: [20, 100], once: true, requires: [royal, need('royalBy', '==', 'birth')],
    text: 'The woman who has laid out your clothes since you were six is seventy, and has asked to retire. She has nobody, and nowhere to go but a room over a shop.',
    choices: [
      { label: 'Give her a cottage on the estate, for life', outcomes: [any('She cries, and then tells you your collar is crooked. You visit on Sundays. It is the least ceremonious hour of your week.', 'good', hid('karma', 10), st('mood', 6), family(2))] },
      { label: 'Give her a pension', requires: [has(60000)], outcomes: [any('A proper pension, paid from your own account. She writes every Christmas, in the same careful hand that used to label your trunks.', 'good', cash(-60000), hid('karma', 6))] },
      { label: 'Thank her, and let her go', outcomes: [any('There is a presentation, and a clock. You do not see her again. For years, your collar is crooked.', 'neutral', hid('karma', -5), st('mood', -3))] },
    ],
  },
];
