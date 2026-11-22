// Scenes during a sleepover (engine/together.js queues one, sometimes, when a friend stays over). {pal} is the friend.
import { any, st, rel, hid } from '../helpers.js';

const scene = (id, text, choices) => ({ id, category: 'The night', ageRange: [6, 15], queuedOnly: true, text,
  choices: choices.map(([label, outcomes]) => ({ label, outcomes })) });

export default [
  scene('sleepover_board_game', 'Past midnight, {pal} digs out the longest board game in the house and says nobody sleeps until somebody wins.', [
    ['Deal me in', [any('Three hours and one argument about the rules later, {pal} wins, and is nearly gracious about it.', 'good', rel('pal', 5), st('mood', 3))]],
    ['Suggest cards instead', [any('A quick card game, then another, then twenty more. It is a good night.', 'good', rel('pal', 3), st('mood', 2))]],
    ['Bet your pocket money', [any('It starts as a joke and ends with sharp words and one of you sleeping in the hall.', 'bad', rel('pal', -6), st('mood', -3))]],
    ['Say you are tired', [any('{pal} sulks for a minute, then is asleep before you are.', 'neutral', rel('pal', -3))]],
  ]),
  scene('sleepover_prank_call', 'It is after midnight, and {pal} has found the phone. "Let\'s prank call someone."', [
    ['Do it', [any('You call a pizza place and order forty anchovies. You laugh until you cry. Nobody finds out.', 'good', rel('pal', 6), st('mood', 5), hid('discipline', -1))]],
    ['Call a teacher', [any('It is funny for about four seconds, until the teacher says your name.', 'bad', rel('pal', 4), st('mood', -2), hid('discipline', -2))]],
    ['Say it is a bad idea', [any('{pal} rolls their eyes, and puts the phone back. Probably for the best.', 'neutral', rel('pal', -2), hid('discipline', 1))]],
  ]),
  scene('sleepover_sneak_out', '{pal} whispers that you should sneak out and walk to the park in the dark. Everyone else is asleep.', [
    ['Sneak out', [any('You make it to the swings and back without anyone waking. It is the best night of the year.', 'good', rel('pal', 8), st('mood', 6), hid('discipline', -2))]],
    ['Stay in', [any('You say no. {pal} says you are boring, and falls asleep five minutes later anyway.', 'neutral', rel('pal', -2), hid('discipline', 1))]],
    ['Wake your parents', [any('Your parents are not pleased with {pal}. Nor, for a while, is {pal} with you.', 'bad', rel('pal', -8))]],
  ]),
  scene('sleepover_secret', 'In the dark, {pal} says there is something they have never told anyone.', [
    ['Listen', [any('{pal} tells you. You promise to keep it, and you do.', 'good', rel('pal', 9), st('mood', 2))]],
    ['Tell a secret back', [any('You tell {pal} one of yours. You are friends in a different way after that night.', 'good', rel('pal', 10), st('mood', 3))]],
    ['Make a joke', [any('You make a joke. {pal} laughs, a bit, and says never mind.', 'neutral', rel('pal', -4))]],
  ]),
];
