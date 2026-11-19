// STORYLINE: the people in a life, between the player's own actions. Never drawn
// at random: engine/together.js queues these from what is actually happening (an
// affair that comes out, a group of friends, an anniversary that went by), and
// their choices go back to it through the `together` effect.
const b = (value) => ({ type: 'together', value });
const out = (text, ...effects) => [{ on: 'always', text, effects }];

/** @type {import('../../../types.js').GameEvent[]} */
export default [
  // ---------- An affair comes out ----------
  {
    id: 'with_affair_found', category: 'romance', ageRange: [16, 120], queuedOnly: true, cooldown: 0,
    text: 'You know now. {partner} has been seeing someone else, for {time}. {partner} is sitting across from you, waiting for you to say something.',
    choices: [
      { label: 'Forgive them, and try to rebuild', outcomes: out('You said you would try. Neither of you knows yet whether trying is enough.', b('affair:forgive')) },
      { label: 'Go to counseling together', outcomes: out('You found a counselor, and a time each week to say the hard things.', b('affair:counsel')) },
      { label: 'Ask for time apart', outcomes: out('You asked for space. {partner} packed a bag without arguing.', b('affair:space')) },
      { label: 'End it', outcomes: out('You told {partner} it was over.', b('affair:leave')) },
    ],
  },
  {
    id: 'with_affair_confession', category: 'romance', ageRange: [16, 120], queuedOnly: true, cooldown: 0,
    text: '{partner} asks to talk, and cannot look at you. "I have to tell you something. I have been seeing someone. It is over, but you deserve to know."',
    choices: [
      { label: 'Thank them for telling you, and try to rebuild', outcomes: out('It hurt more than anything. But they told you themselves, and that counts for something.', b('affair:forgive')) },
      { label: 'Go to counseling together', outcomes: out('You agreed to try, with help.', b('affair:counsel')) },
      { label: 'End it', outcomes: out('You told {partner} the truth came too late.', b('affair:leave')) },
    ],
  },

  // ---------- Friends, as a group ----------
  {
    id: 'with_circle_night', category: 'friends', ageRange: [8, 120], queuedOnly: true, cooldown: 0,
    text: 'The group chat lights up: {a} wants everyone together this weekend, {b} included. It has been too long.',
    choices: [
      { label: 'Host it at your place', outcomes: out('Everyone came. Someone brought a guitar. It went on until the neighbors knocked.', b('circle:host')) },
      { label: 'Go along', outcomes: out('You went, and laughed more than you had in months.', b('circle:go')) },
      { label: 'Skip it this time', outcomes: out('You sent your apologies. The photos looked fun.', b('circle:skip')) },
    ],
  },
  {
    id: 'with_circle_rift', category: 'friends', ageRange: [10, 120], queuedOnly: true, cooldown: 0,
    text: '{a} and {b} have fallen out, badly, and each of them has asked you to see it their way. The rest of the group is waiting to see what you do.',
    choices: [
      { label: 'Take {a}\'s side', outcomes: out('You backed {a}. {b} has gone quiet in the group.', b('circle:sideA')) },
      { label: 'Take {b}\'s side', outcomes: out('You backed {b}. {a} has not forgiven you.', b('circle:sideB')) },
      { label: 'Get them in a room together', outcomes: out('You got them both to the same table.', b('circle:mediate')) },
      { label: 'Stay out of it', outcomes: out('You stayed out of it, and saw both of them separately for a while.', b('circle:neutral')) },
    ],
  },
  {
    id: 'with_circle_trip', category: 'friends', ageRange: [16, 120], queuedOnly: true, cooldown: 0,
    text: '{a} has an idea: the whole group, away together for a weekend. {b} has already said yes. It would cost about {cost}.',
    choices: [
      { label: 'Count me in', outcomes: out('You went. There are photos nobody is allowed to post.', b('circle:trip')) },
      { label: 'Say you cannot afford it', outcomes: out('You stayed home. {a} said there would be a next time.', b('circle:noTrip')) },
    ],
  },
  {
    id: 'with_circle_news', category: 'friends', ageRange: [16, 120], queuedOnly: true, cooldown: 0,
    text: '{a} has big news for the group: {news}. Everyone is planning something.',
    choices: [
      { label: 'Organize the celebration', outcomes: out('You organized it, and {a} said it was the nicest thing anyone had done for them.', b('circle:celebrate')) },
      { label: 'Send your congratulations', outcomes: out('You sent your love, and a card.', b('circle:card')) },
    ],
  },

  // ---------- An anniversary that went by ----------
  {
    id: 'with_forgot_anniversary', category: 'romance', ageRange: [18, 120], queuedOnly: true, cooldown: 0,
    text: 'It was your {years} wedding anniversary, and you forgot. {spouse} did not. There is a card on the table, unopened, addressed to you.',
    choices: [
      { label: 'Apologize with a real present', outcomes: out('You apologized properly, and the present helped.', b('anniv:gift')) },
      { label: 'Book a weekend away to make up for it', outcomes: out('You booked the weekend that night.', b('anniv:trip')) },
      { label: 'Say sorry, and mean it', outcomes: out('You said sorry. {spouse} said it was fine. It was not, quite.', b('anniv:sorry')) },
      { label: 'Point out that they forgot yours once', outcomes: out('You brought up the time they forgot. That did not help.', b('anniv:defend')) },
    ],
  },
];
