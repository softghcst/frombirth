// STORYLINE: digital life. These scenes are never drawn at random: the
// Digital World Engine finds them in saved state (engine/digital/stories.js)
// and queues them, with the real people involved. Their choices go back to the
// same engine through the `digital` effect.
const d = (value) => ({ type: 'digital', value });
const out = (text, ...effects) => [{ on: 'always', text, effects }];

/** @type {import('../../../types.js').GameEvent[]} */
export default [
  {
    id: 'digital_reconnect', category: 'digital', ageRange: [18, 120], queuedOnly: true, cooldown: 0,
    text: 'You came across {friend}\'s profile on {platform}. It has been {years} years since you were last in touch. Would you like to reconnect?',
    choices: [
      { label: 'Send a friendly message', outcomes: out('You wrote a few lines, deleted them, wrote them again, and sent them.', d('reconnect:message')) },
      { label: 'Follow without messaging', outcomes: out('You followed {friend}, and left it at that.', d('reconnect:follow')) },
      { label: 'Leave things as they are', outcomes: out('Some friendships belong to a particular time. You closed the page.', d('reconnect:leave')) },
    ],
  },
  {
    id: 'digital_first_video', category: 'digital', ageRange: [13, 19], queuedOnly: true, once: true,
    text: 'You have been {what} for years now, mostly for yourself. A friend says you should put a video of it on {platform}.',
    choices: [
      { label: 'Post a performance', outcomes: out('You filmed it eleven times and posted the fourth.', d('video:post')) },
      { label: 'Keep it to yourself', outcomes: out('You decided it was yours, for now. Nothing wrong with that.', d('video:keep')) },
    ],
  },
  {
    id: 'digital_ancestor', category: 'digital', ageRange: [8, 120], queuedOnly: true, cooldown: 0,
    text: 'Clearing out an old drawer, you find a note with {ancestor}\'s old usernames on it. Their public posts are still out there, kept in the family archive.',
    choices: [
      { label: 'Look through them', outcomes: out('Photographs, small jokes, the things that mattered to {ancestor} in a year you never saw.', d('ancestor:watch')) },
      { label: 'Not now', outcomes: out('You put the note back. It will keep.', d('ancestor:later')) },
    ],
  },
  {
    id: 'digital_controversy', category: 'digital', ageRange: [13, 120], queuedOnly: true, cooldown: 0,
    text: '{what} How do you respond?',
    choices: [
      { label: 'Correct the record with facts', outcomes: out('You wrote it out carefully, with the facts.', d('cv:correct')) },
      { label: 'Apologise', outcomes: out('You posted an apology.', d('cv:apologize')) },
      { label: 'Get professional advice first', outcomes: out('You called someone who handles this for a living.', d('cv:advice')) },
      { label: 'Say nothing and let it pass', outcomes: out('You stayed off your phone for a week.', d('cv:silence')) },
    ],
  },
  {
    id: 'digital_bullying', category: 'digital', ageRange: [8, 17], queuedOnly: true, cooldown: 0,
    text: 'Someone from school has been posting cruel things about you online. You feel sick every time your phone lights up.',
    choices: [
      { label: 'Tell a parent or another adult you trust', outcomes: out('Saying it out loud was the hardest part.', d('safe:tell')) },
      { label: 'Block and report them', outcomes: out('Block. Report. Done.', d('safe:block')) },
      { label: 'Make your account private', outcomes: out('You locked everything down.', d('safe:private')) },
      { label: 'Take a break from it', outcomes: out('You deleted the app from your phone for a while.', d('safe:break')) },
    ],
  },
];
