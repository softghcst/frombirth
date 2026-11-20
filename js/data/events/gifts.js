// Scenes that come from a gift: a talent of 65 or more (the gifts a life starts with, engine/characterGen.js). They
// run from the toddler years to the edge of the teens, so a gift shows early and can be leaned into, or let go.
import { st, hid, tal, rel, any, ok, bad, chk, need, mem } from './helpers.js';

const gift = (talent, level = 65) => need(`talents.${talent}`, '>=', level);

/** @type {import('../../types.js').GameEvent[]} */
export default [
  // ---------- Music ----------
  {
    id: 'gift_music_pots', category: 'talent', ageRange: [2, 4], once: true, weight: 3, requires: [gift('music')], cast: { parent: 'parent' },
    text: 'You have the pots and pans out on the kitchen floor, and you are hitting them in a rhythm. A real one.',
    choices: [
      { label: 'Keep the beat going', outcomes: [any('Ten minutes, never once off the beat. {parent} stops trying to take the spoon away and starts listening.', 'good', tal('music', 5), st('mood', 4), rel('parent', 2))] },
      { label: 'Make it louder', outcomes: [any('A glorious racket. The neighbors bang on the wall, which you take as applause.', 'neutral', tal('music', 2), st('mood', 5), rel('parent', -1))] },
      { label: 'Get bored and go play with the dog', outcomes: [any('The pots go back in the cupboard. The rhythm stays somewhere in you.', 'neutral', st('mood', 2))] },
    ],
  },
  {
    id: 'gift_music_piano', category: 'talent', ageRange: [5, 9], once: true, weight: 3, requires: [gift('music')], cast: { parent: 'parent' },
    text: 'There is an old piano at a relative\'s house. You sit down and pick out the tune from a cartoon, by ear, first try.',
    choices: [
      { label: 'Ask for lessons', outcomes: [any('{parent} finds a teacher. You practice without being told to, which nobody can quite believe.', 'good', tal('music', 6), hid('discipline', 3), rel('parent', 2))] },
      { label: 'Just play for fun', outcomes: [any('Every visit, you head straight for the piano. You learn a dozen songs that way, by ear.', 'good', tal('music', 4), st('mood', 4))] },
      { label: 'Close the lid. Pianos are for old people', outcomes: [any('You never touch it again. The ear for it does not go away, though.', 'neutral', st('mood', 1))] },
    ],
  },
  {
    id: 'gift_music_recital', category: 'talent', ageRange: [8, 12], once: true, weight: 2, requires: [gift('music', 75)], cast: { parent: 'parent' },
    text: 'Your music teacher wants you to play a solo at the school concert, in front of everyone.',
    choices: [
      { label: 'Play it', check: chk(0.5, { 'talents.music': 1.0, 'hidden.willpower': 0.3 }), outcomes: [
        ok('Not one wrong note. The hall goes quiet, and then it does not. {parent} is on their feet.', tal('music', 6), st('charm', 3), st('mood', 6), rel('parent', 3), mem('parent', 'recital', 'You played a solo at the school concert, and it was perfect.')),
        bad('Your hands shake and you lose your place in the middle. You finish it anyway. People clap, kindly.', tal('music', 3), hid('willpower', 4), st('mood', -3)),
      ] },
      { label: 'Say you would rather play in the group', outcomes: [any('You play with everyone else, and quietly carry the whole section.', 'neutral', tal('music', 3))] },
    ],
  },

  // ---------- Sports ----------
  {
    id: 'gift_sports_ball', category: 'talent', ageRange: [2, 4], once: true, weight: 3, requires: [gift('sports')], cast: { father: 'father' },
    text: '{father} rolls a ball across the yard. You stop it with your foot and kick it straight back to him.',
    choices: [
      { label: 'Do it again, harder', outcomes: [any('Back and forth until it is dark. {father} has already started talking about teams.', 'good', tal('sports', 5), st('health', 2), rel('father', 3))] },
      { label: 'Run off with the ball', outcomes: [any('He cannot catch you. Nobody can catch you, it turns out.', 'good', tal('sports', 3), st('mood', 4))] },
      { label: 'Sit on the ball', outcomes: [any('A very comfortable ball. Sports can wait.', 'neutral', st('mood', 2))] },
    ],
  },
  {
    id: 'gift_sports_race', category: 'talent', ageRange: [5, 9], once: true, weight: 3, requires: [gift('sports')],
    text: 'Field day at school. In the running race, you are already well ahead at the halfway line.',
    choices: [
      { label: 'Run as fast as you can', outcomes: [any('You win by a mile. The gym teacher writes your name down on a clipboard.', 'good', tal('sports', 5), st('health', 2), st('charm', 2))] },
      { label: 'Slow down so your friend can catch up', outcomes: [any('You cross the line together, holding hands. The teacher saw how fast you were anyway.', 'good', hid('karma', 4), tal('sports', 2), st('charm', 2))] },
      { label: 'Show off and run backward', check: chk(0.4, { 'talents.sports': 0.8 }), outcomes: [
        ok('Backward, and you still win. Legendary.', tal('sports', 3), st('charm', 3), st('mood', 4)),
        bad('You trip over your own feet and come last, to a lot of laughter.', st('mood', -4), hid('willpower', 2)),
      ] },
    ],
  },
  {
    id: 'gift_sports_tryout', category: 'talent', ageRange: [8, 12], once: true, weight: 2, requires: [gift('sports', 75)], cast: { parent: 'parent' },
    text: 'A coach from a club team saw you play and asks if you want to try out. Practice would be three evenings a week.',
    choices: [
      { label: 'Go for it', check: chk(0.55, { 'talents.sports': 1.0 }), outcomes: [
        ok('You make the team, and you are the youngest on it. {parent} becomes a very loud parent on the sidelines.', tal('sports', 7), st('health', 3), hid('discipline', 3), rel('parent', 2)),
        bad('Not this year: the coach says come back next season, and means it.', tal('sports', 3), hid('willpower', 4), st('mood', -3)),
      ] },
      { label: 'Keep it for fun with friends', outcomes: [any('You play in the park instead. You are still the best one there.', 'neutral', tal('sports', 2), st('mood', 3))] },
    ],
  },

  // ---------- Acting ----------
  {
    id: 'gift_acting_impressions', category: 'talent', ageRange: [3, 6], once: true, weight: 3, requires: [gift('acting')], cast: { parent: 'parent' },
    text: 'At dinner you do an impression of your grandfather. It is far too accurate.',
    choices: [
      { label: 'Do the whole family', outcomes: [any('Everyone, one after another. The table is in tears. Nobody is safe.', 'good', tal('acting', 5), st('charm', 3), st('mood', 5))] },
      { label: 'Stop when {parent} gives you the look', outcomes: [any('You stop. Later {parent} asks you to do it again, privately, and laughs until they cry.', 'good', tal('acting', 3), rel('parent', 3))] },
    ],
  },
  {
    id: 'gift_acting_play', category: 'talent', ageRange: [6, 10], once: true, weight: 3, requires: [gift('acting')],
    text: 'The class play. The teacher has given you one line as the third sheep, and you want more.',
    choices: [
      { label: 'Make the one line unforgettable', outcomes: [any('"Baa." The way you say it brings the house down. The teacher rewrites the second act around you.', 'good', tal('acting', 6), st('charm', 3))] },
      { label: 'Learn everyone else\'s lines too', outcomes: [any('When the lead gets the flu, you step in, word perfect.', 'good', tal('acting', 5), st('intellect', 2), hid('discipline', 2))] },
      { label: 'Be a good sheep', outcomes: [any('You do your one line well and enjoy watching the others.', 'neutral', tal('acting', 1), st('mood', 2))] },
    ],
  },

  // ---------- Singing ----------
  {
    id: 'gift_singing_car', category: 'talent', ageRange: [3, 6], once: true, weight: 3, requires: [gift('singing')], cast: { parent: 'parent' },
    text: 'A song comes on the radio in the car, and you sing along. {parent} turns the radio down to hear you better.',
    choices: [
      { label: 'Sing louder', outcomes: [any('Every word, every note. {parent} misses the exit and does not care.', 'good', tal('singing', 5), st('mood', 5), rel('parent', 3))] },
      { label: 'Go shy and stop', outcomes: [any('"Keep going," {parent} says. You do not, not today. But you sing in the bath every night after that.', 'neutral', tal('singing', 2))] },
    ],
  },
  {
    id: 'gift_singing_choir', category: 'talent', ageRange: [6, 11], once: true, weight: 3, requires: [gift('singing')],
    text: 'The choir teacher stops the whole rehearsal, points at you, and says "You. Sing that again. Alone."',
    choices: [
      { label: 'Sing it', check: chk(0.5, { 'talents.singing': 1.0, 'hidden.willpower': 0.3 }), outcomes: [
        ok('Your voice fills the room. The teacher gives you the solo at the winter concert.', tal('singing', 6), st('charm', 3), st('mood', 5)),
        bad('Your voice cracks on the high note. The teacher says "Lovely. Again next week."', tal('singing', 3), hid('willpower', 3), st('mood', -2)),
      ] },
      { label: 'Pretend it was someone else', outcomes: [any('Nobody believes you, but they let it go. For now.', 'neutral', tal('singing', 1))] },
    ],
  },

  // ---------- Dance ----------
  {
    id: 'gift_dance_kitchen', category: 'talent', ageRange: [2, 5], once: true, weight: 3, requires: [gift('dance')], cast: { parent: 'parent' },
    text: 'Music is playing in the kitchen. You cannot keep still. You never can, when there is music.',
    choices: [
      { label: 'Dance until you fall over', outcomes: [any('Spinning, stomping, a move nobody taught you. {parent} joins in, badly.', 'good', tal('dance', 5), st('mood', 6), rel('parent', 3))] },
      { label: 'Make up a routine and perform it', outcomes: [any('You make everyone sit on the sofa for the show. It is three songs long, with an intermission.', 'good', tal('dance', 4), tal('acting', 2), st('charm', 2))] },
    ],
  },
  {
    id: 'gift_dance_class', category: 'talent', ageRange: [5, 10], once: true, weight: 3, requires: [gift('dance')], cast: { parent: 'parent' },
    text: 'There is a dance school on the corner. Through the window, kids your age are learning a routine. You are copying it on the sidewalk.',
    choices: [
      { label: 'Beg to join', check: chk(0.5, { 'talents.dance': 0.8, 'stats.charm': 0.3 }), outcomes: [
        ok('{parent} takes you in. The teacher watches you for one minute and says "Saturday, nine o\'clock."', tal('dance', 6), hid('discipline', 3), st('mood', 5)),
        bad('The classes are full until spring. You practice in your room every night until then.', tal('dance', 3), hid('willpower', 3)),
      ] },
      { label: 'Keep dancing on your own', outcomes: [any('You learn from music videos, in the living room, with the furniture pushed back.', 'neutral', tal('dance', 3), st('mood', 3))] },
    ],
  },

  // ---------- Crime: a gift for getting away with things ----------
  {
    id: 'gift_crime_cookie_jar', category: 'talent', ageRange: [3, 6], once: true, weight: 3, requires: [gift('crime')], cast: { parent: 'parent' },
    text: 'The cookie jar is on the top shelf. {parent} is in the next room. You have worked out how the chairs could be arranged.',
    choices: [
      { label: 'Do it, and leave no trace', check: chk(0.55, { 'talents.crime': 0.9 }), outcomes: [
        ok('Two cookies, the chair back in place, the lid on straight. {parent} counts the cookies twice and cannot work it out.', tal('crime', 5), st('intellect', 2), hid('karma', -2)),
        bad('Caught on the chair, one hand in the jar. A long talk follows.', rel('parent', -2), st('mood', -2), hid('karma', -1)),
      ] },
      { label: 'Ask for one instead', outcomes: [any('"After dinner." Fine. You wait, and you get it, and it tastes honest.', 'good', hid('karma', 3), hid('discipline', 2))] },
    ],
  },
  {
    id: 'gift_crime_hiding', category: 'talent', ageRange: [6, 10], once: true, weight: 2, requires: [gift('crime')],
    text: 'Someone broke the classroom window with a ball. You saw who did it, and you also know exactly how to make sure nobody finds out it was your friend.',
    choices: [
      { label: 'Cover for your friend', check: chk(0.5, { 'talents.crime': 0.9, 'talents.acting': 0.3 }), outcomes: [
        ok('A story so smooth the teacher thanks you for your help. Your friend owes you, forever.', tal('crime', 5), tal('acting', 2), hid('karma', -3)),
        bad('The story has a hole in it. You are both kept in at recess for a week.', st('mood', -3), hid('karma', -2)),
      ] },
      { label: 'Tell your friend to own up', outcomes: [any('They do. It is not so bad. You both learn that the truth is usually easier.', 'good', hid('karma', 4), st('charm', 2))] },
      { label: 'Stay out of it', outcomes: [any('Not your window, not your problem.', 'neutral', hid('discipline', 1))] },
    ],
  },
];
