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

  {
    id: 'era_call_up', category: 'history', ageRange: [18, 35], queuedOnly: true, cooldown: 0,
    text: 'The letter came this morning: you are called up to serve in {war}.',
    choices: [
      { label: 'Report for service', outcomes: out('You packed a small bag and reported on the day.', e('callup:serve')) },
      { label: 'Ask for an exemption for essential work', outcomes: out('You put your case to the tribunal.', e('callup:exempt')) },
      { label: 'Object on grounds of conscience', outcomes: out('You told the tribunal you would not fight, and why.', e('callup:object')) },
    ],
  },
  {
    id: 'era_war_news', category: 'history', ageRange: [6, 120], queuedOnly: true, cooldown: 0,
    text: 'The family gathers every evening for news of {war}. Everyone knows someone who has gone.',
    choices: [
      { label: 'Write to the people you know who are away', outcomes: out('You wrote letters, and some came back.', e('warnews:write')) },
      { label: 'Volunteer to help at home', outcomes: out('You did what you could: collecting, knitting, carrying, waiting.', e('warnews:help')) },
      { label: 'Keep your head down and get on with things', outcomes: out('Life went on, as much as it could.', e('warnews:carry')) },
    ],
  },
  {
    id: 'era_hard_times', category: 'history', ageRange: [14, 120], queuedOnly: true, cooldown: 0,
    text: 'Since the crash, work is scarce and money scarcer. There are lines for bread in the town.',
    choices: [
      { label: 'Tighten your belt and save what you can', outcomes: out('Thin soup, mended clothes, and a little put by.', e('hard:save')) },
      { label: 'Share what you have with neighbors worse off', outcomes: out('You had little, and gave some of it anyway.', e('hard:share')) },
      { label: 'Take any odd job going', outcomes: out('A day here, a day there.', e('hard:work')) },
    ],
  },
  {
    id: 'era_peace', category: 'history', ageRange: [6, 120], queuedOnly: true, cooldown: 0,
    text: '{war} is over. The bells are ringing and the streets are full.',
    choices: [
      { label: 'Celebrate in the streets', outcomes: out('Strangers hugged you. Somebody had a trumpet.', e('peace:celebrate')) },
      { label: 'Remember the people who did not come back', outcomes: out('You lit a candle, and stayed home.', e('peace:remember')) },
    ],
  },
];
