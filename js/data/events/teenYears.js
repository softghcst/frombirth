// Scenes of the teenage years (engine/teenYears.js): prom night, and a friend's offer a teenager has to answer. Each is
// queued only when it is true (a prom date said yes; a real friend made the offer); each choice goes back to the engine.
import { any } from './helpers.js';

const t = (value) => ({ type: 'teenYears', value });
const scene = (id, ageRange, text, story, choices) => ({ id, category: 'family', ageRange, queuedOnly: true, text,
  choices: choices.map(([label, line, choice, tone = 'neutral']) => ({ label, outcomes: [any(line, tone, t(`${story}:${choice}`))] })) });

const pressure = (kind, text, yes) => scene(`teenage_pressure_${kind}`, [14, 17], text, `pressure_${kind}`, [
  [yes, 'You go along with it.', 'yes'],
  ['Say no', 'You say no.', 'no'],
  ['Make an excuse and leave', 'You say you have to be somewhere, and go.', 'leave'],
  ['Tell an adult', 'You tell someone.', 'adult', 'good'],
]);

export default [
  scene('teenage_prom_night', [16, 18], 'Prom night. You and {them} dance until your feet hurt, under a ceiling of balloons in the school gym. Then the music stops, and everyone is asking the same thing: what now?', 'prom', [
    ['Home, before curfew', 'You go home happy.', 'home', 'good'],
    ['Pancakes at the all-night diner', 'You pile into a booth, still dressed up.', 'diner', 'good'],
    ['The after-party', 'Someone knows a house whose owners are away.', 'after'],
  ]),
  pressure('drink', 'At a party, {them} hands you a cup of something that is definitely not juice. "Everyone\'s having one."', 'Drink it'),
  pressure('vape', '{them} offers you a vape behind the sports hall. "It\'s nothing. Just try it."', 'Try it'),
  pressure('dare', '{them} dares you to take something from the corner shop. A few people are watching to see what you do.', 'Do the dare'),
  pressure('skip', '{them} has a plan: skip the afternoon and go to the beach. "Nobody takes the register after lunch."', 'Skip with them'),
];
