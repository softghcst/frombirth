// STORYLINE: the eras. Never drawn at random: the history engine (engine/eras.js)
// queues these at the right moment, from what is actually happening, and their
// choices go back to it through the `era` effect (engine/eraScenes.js).
const e = (value) => ({ type: 'era', value });
const out = (text, ...effects) => [{ on: 'always', text, effects }];

/** @type {import('../../../types.js').GameEvent[]} */
export default [
  {
    id: 'era_leave_school', category: 'school', ageRange: [10, 17], queuedOnly: true, once: true,
    text: 'You are {age}. Most children your age are leaving school now to start work, and there would be a wage coming into the house.',
    choices: [
      { label: 'Leave school and find work', outcomes: out('You said goodbye to your teacher and started looking for a place.', e('school:leave')) },
      { label: 'Stay on at school', outcomes: out('You stayed. Fewer faces at the desks around you, and more expected of you.', e('school:stay')) },
    ],
  },
];
