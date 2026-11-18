// Scenes from the first years of life through the teens. These fill the
// quieter early years, when little else is going on.
import { st, hid, tal, cash, rel, cond, gpa, addNpc, ok, bad, any, chk, need, perf, followers, giveVehicle } from './helpers.js';

const onSet = need('career.careerId', '==', 'child_actor');

/** @type {import('../../types.js').GameEvent[]} */
export default [
  // ---------- Infancy and the toddler years ----------
  {
    id: 'night_feeds', category: 'infancy', ageRange: [0, 1], once: true, weight: 3, cast: { mother: 'mother' },
    text: 'It is three in the morning. You are awake, and you have opinions about it.',
    choices: [
      { label: 'Scream until someone comes', outcomes: [any('{mother} arrives in under a minute, looking like a ghost. You are fed. The system works.', 'neutral', hid('willpower', 3), rel('mother', -2))] },
      { label: 'Grumble, then settle', outcomes: [any('You work it out on your own. In the morning {mother} tells everyone you slept through.', 'good', hid('discipline', 4), rel('mother', 4))] },
      { label: 'Lie there and study the ceiling', outcomes: [any('The shadows from the street move very slowly. You watch every one of them.', 'neutral', st('intellect', 2))] },
    ],
  },
  {
    id: 'first_steps_self', category: 'infancy', ageRange: [1, 1], once: true, weight: 3,
    text: 'The sofa is here. The coffee table is over there. Between them is open floor.',
    choices: [
      { label: 'Let go and walk', check: chk(0.55, { 'talents.sports': 0.5, 'stats.health': 0.2 }), outcomes: [
        ok('Four steps, unaided, before you sit down hard. The room erupts.', tal('sports', 3), st('mood', 5)),
        bad('One step, then the carpet. You are furious, and you try again tomorrow.', hid('willpower', 3), st('mood', -2)),
      ] },
      { label: 'Crawl. It has always worked', outcomes: [any('You get there faster than anyone walking would have.', 'neutral', hid('discipline', 2))] },
      { label: 'Stay put and point at what you want', outcomes: [any('Somebody brings it to you. You file this away.', 'neutral', st('charm', 2), hid('willpower', -1))] },
    ],
  },
  {
    id: 'vegetable_standoff', category: 'infancy', ageRange: [2, 4], cooldown: 3, cast: { mother: 'mother' },
    text: 'There is something green on your plate. {mother} says you are not leaving the table until it is gone.',
    choices: [
      { label: 'Eat it', outcomes: [any('It is not as bad as it looks, which you will never admit.', 'good', st('health', 2), rel('mother', 2))] },
      { label: 'Refuse, for as long as it takes', check: chk(0.4, { 'hidden.willpower': 0.8 }), outcomes: [
        ok('An hour and ten minutes. {mother} gives in first. You have learned something about power.', hid('willpower', 5), rel('mother', -3)),
        bad('You last twenty minutes, then eat it cold, which is worse.', st('mood', -4), st('health', 1)),
      ] },
      { label: 'Feed it to the floor, quietly', check: chk(0.5, { 'talents.crime': 0.6 }), outcomes: [
        ok('Piece by piece, under the table. Nobody ever knows.', tal('crime', 3)),
        bad('{mother} finds the pile. Tomorrow there is twice as much.', rel('mother', -3), st('mood', -3)),
      ] },
    ],
  },
  {
    id: 'supermarket_meltdown', category: 'infancy', ageRange: [2, 4], cooldown: 3, cast: { mother: 'mother' },
    text: 'The candy is at exactly your eye level. {mother} has said no.',
    choices: [
      { label: 'Lie down in the aisle and howl', outcomes: [any('A crowd gathers. {mother} carries you out under one arm, candy left behind.', 'bad', rel('mother', -4), hid('crazy', 2), st('mood', -3))] },
      { label: 'Ask again, very nicely', check: chk(0.35, { 'stats.charm': 0.7 }), outcomes: [
        ok('Big eyes, a "please", and a small hand on her sleeve. {mother} folds.', st('charm', 3), st('mood', 5)),
        bad('"I said no." You have learned that charm has limits.', st('mood', -2)),
      ] },
      { label: 'Accept it and move on', outcomes: [any('You hold the shopping cart and say nothing. {mother} buys you one at the till anyway.', 'good', hid('discipline', 4), rel('mother', 3))] },
    ],
  },
  {
    id: 'monster_under_bed', category: 'infancy', ageRange: [3, 6], once: true, cast: { father: 'father' },
    text: 'There is something under your bed. You heard it move.',
    choices: [
      { label: 'Shout for {father}', outcomes: [any('{father} checks with a torch, declares it clear, and leaves the landing light on.', 'good', rel('father', 5), st('mood', 3))] },
      { label: 'Look for yourself', check: chk(0.6, { 'hidden.willpower': 0.6 }), outcomes: [
        ok('A slipper, a jigsaw piece and a great deal of dust. You are never afraid of that bed again.', hid('willpower', 6)),
        bad('You get as far as the edge of the mattress and spend the night under the covers.', st('mood', -4)),
      ] },
      { label: 'Negotiate with it', outcomes: [any('You offer it the bottom half of the bed. It seems to accept. You sleep fine.', 'neutral', hid('crazy', 3), st('charm', 2))] },
    ],
  },
  {
    id: 'new_baby_talk', category: 'infancy', ageRange: [3, 5], once: true,
    text: 'A grown-up at nursery asks what you want to be when you are big.',
    choices: [
      { label: '"A doctor"', outcomes: [any('They say that is a lovely idea. You go and bandage a teddy.', 'good', st('intellect', 2))] },
      { label: '"A singer"', outcomes: [any('You demonstrate, at volume, for the rest of the afternoon.', 'good', tal('singing', 3), st('mood', 3))] },
      { label: '"A dinosaur"', outcomes: [any('You are told this is not a job. You do not accept this.', 'neutral', hid('willpower', 3), tal('acting', 2))] },
      { label: '"Rich"', outcomes: [any('The grown-up laughs, then stops, because you did not.', 'neutral', hid('discipline', 3))] },
    ],
  },

  // ---------- Childhood ----------
  {
    id: 'bike_without_stabilizers', category: 'childhood', ageRange: [5, 8], once: true, weight: 2,
    text: 'The stabilizers are off. The sidewalk stretches away downhill.',
    choices: [
      { label: 'Push off and pedal', check: chk(0.55, { 'talents.sports': 0.6 }), outcomes: [
        ok('Wobble, wobble, and then you are simply riding. You do not stop until dark.', tal('sports', 4), st('mood', 8)),
        bad('You meet a hedge at speed. Scratches everywhere, and you get back on.', st('health', -3), hid('willpower', 4)),
      ] },
      { label: 'Ask someone to hold the saddle', outcomes: [any('They run behind you and let go without saying. You only find out at the corner.', 'good', tal('sports', 2), st('mood', 4))] },
      { label: 'Put the stabilizers back on', outcomes: [any('Another summer with four wheels. Nobody minds but you.', 'neutral', st('mood', -2))] },
    ],
  },
  {
    id: 'school_play_tree', category: 'childhood', ageRange: [5, 9], once: true,
    text: 'The class play is cast. You are a tree. You have no lines.',
    choices: [
      { label: 'Be the best tree anyone has seen', outcomes: [any('You sway. You rustle. A parent in the third row is seen to wipe an eye.', 'good', tal('acting', 4), hid('discipline', 2))] },
      { label: 'Add a line of your own on the night', check: chk(0.5, { 'stats.charm': 0.5, 'talents.acting': 0.4 }), outcomes: [
        ok('"I have seen things," says the tree. It gets the biggest laugh of the show.', tal('acting', 5), st('charm', 2)),
        bad('You speak over the lead\'s big moment. The teacher has a word afterward.', st('mood', -4), gpa(-0.05)),
      ] },
      { label: 'Ask for a bigger part', check: chk(0.3, { 'stats.charm': 0.6 }), outcomes: [
        ok('The teacher makes you Second Villager, with a line and a hat.', tal('acting', 3), st('mood', 4)),
        bad('"Every part matters," says the teacher, which means no.', st('mood', -3)),
      ] },
    ],
  },
  {
    id: 'pocket_money_plan', category: 'childhood', ageRange: [7, 11], cooldown: 3,
    text: 'You have {$20} saved in a jar, and the toy shop has a window display.',
    choices: [
      { label: 'Spend it all today', outcomes: [any('It is everything you hoped for, for nearly a week.', 'neutral', st('mood', 5), hid('discipline', -2))] },
      { label: 'Keep saving', outcomes: [any('The jar gets heavier. So do you, with pride.', 'good', cash(10), hid('discipline', 4))] },
      { label: 'Buy candy and sell them at school', check: chk(0.5, { 'stats.intellect': 0.4, 'stats.charm': 0.4 }), outcomes: [
        ok('You double your money by Friday. A teacher shuts the operation down on Monday.', cash(20), st('intellect', 2), tal('crime', 1)),
        bad('You eat most of the stock yourself.', cash(-20), st('health', -1)),
      ] },
    ],
  },
  {
    id: 'sleepover', category: 'childhood', ageRange: [7, 12], cooldown: 4, cast: { pal: 'friend' },
    text: '{pal} is sleeping over. It is midnight and the house is quiet.',
    choices: [
      { label: 'Tell ghost stories', outcomes: [any('Yours is so good that neither of you sleeps. A triumph, in its way.', 'good', rel('pal', 6), tal('acting', 2))] },
      { label: 'Raid the kitchen', check: chk(0.55, { 'talents.crime': 0.5 }), outcomes: [
        ok('A whole packet of cookies, eaten under a duvet by torchlight.', rel('pal', 5), st('mood', 4)),
        bad('The fourth stair creaks. A parent is waiting at the bottom.', rel('pal', 2), st('mood', -2)),
      ] },
      { label: 'Actually go to sleep', outcomes: [any('{pal} is disappointed, but you are the only one awake for pancakes.', 'neutral', st('health', 1), rel('pal', -1))] },
    ],
  },

  {
    id: 'theme_park_day', category: 'childhood', ageRange: [5, 11], cooldown: 5, cast: { mother: 'mother' },
    text: '{mother} wakes you before it is light: the family is going to the theme park, today, and it was a secret until now.',
    choices: [
      { label: 'Run straight to the biggest ride', check: chk(0.5, { 'hidden.willpower': 0.5, 'stats.health': 0.3 }), outcomes: [
        ok('You are exactly tall enough. You scream the whole way round and get straight back in the queue.', st('mood', 12), hid('willpower', 3)),
        bad('You are tall enough, and at the top you wish you were not. {mother} holds the bag.', st('mood', 3), st('health', -1)),
      ] },
      { label: 'Meet every character in the park', outcomes: [any('You collect eleven autographs and hug a seven-foot mouse. Best day of your life so far.', 'good', st('mood', 12), st('charm', 2), rel('mother', 4))] },
      { label: 'Wander off to look at something', outcomes: [any('You are lost for twenty minutes that feel like a year. {mother} does not let go of your hand again.', 'neutral', st('mood', 2), rel('mother', 3), hid('discipline', 2))] },
      { label: 'Eat everything', outcomes: [any('Candy floss, a hot dog, an ice cream and then the teacups. You know how this ends.', 'neutral', st('mood', 6), st('health', -2))] },
    ],
  },

  {
    id: 'first_bike', timing: { yearTurn: true }, category: 'childhood', ageRange: [5, 8], once: true, weight: 3, cast: { father: 'father' },
    text: 'There is a large, badly wrapped, bicycle-shaped present in the hallway on your birthday.',
    choices: [
      { label: 'Tear the paper off', outcomes: [any('It is exactly the one you wanted. {father} spends the afternoon running behind you, holding the saddle.', 'good', giveVehicle('kids_bike'), st('mood', 12), rel('father', 6))] },
      { label: 'Pretend to guess what it is', outcomes: [any('"Is it... a giraffe?" Everyone laughs. It is a bike, and it is yours.', 'good', giveVehicle('kids_bike'), st('mood', 10), st('charm', 2), rel('father', 4))] },
      { label: 'Ask if it could be swapped for a scooter', outcomes: [any('{father}\'s face falls a little. The bike goes back, and a scooter comes home instead.', 'neutral', giveVehicle('kick_scooter'), st('mood', 5), rel('father', -3))] },
    ],
  },

  // ---------- Children who act ----------
  {
    id: 'set_forgot_lines', category: 'on set', ageRange: [5, 17], cooldown: 3, requires: [onSet],
    text: 'Forty adults are waiting, the camera is rolling, and your line has gone completely out of your head.',
    choices: [
      { label: 'Make something up', check: chk(0.45, { 'talents.acting': 0.7, 'stats.charm': 0.3 }), outcomes: [
        ok('What you say is better than the script. The director keeps it.', perf(10), tal('acting', 3), st('mood', 5)),
        bad('What you say makes no sense at all. Take fourteen.', perf(-5), st('mood', -4)),
      ] },
      { label: 'Ask for the line', outcomes: [any('Someone calls it from the dark. You say it perfectly. Nobody minds; it happens to grown-ups too.', 'neutral', tal('acting', 1), hid('discipline', 2))] },
      { label: 'Burst into tears', outcomes: [any('Everything stops for twenty minutes. A kind woman from wardrobe brings you a cookie.', 'bad', perf(-6), st('mood', -5))] },
    ],
  },
  {
    id: 'set_or_school', category: 'on set', ageRange: [8, 17], cooldown: 4, requires: [onSet, need('education.enrolled', '==', true)],
    text: 'The shoot has overrun again. It is either the last week of filming or your end-of-year exams.',
    choices: [
      { label: 'Finish the film', outcomes: [any('You are in every scene of the ending. Your report card says "absent" in four subjects.', 'neutral', perf(10), gpa(-0.25), tal('acting', 2))] },
      { label: 'Sit the exams', outcomes: [any('They shoot round you with a double in a wig. The director is not pleased, and your teachers are.', 'neutral', perf(-10), gpa(0.1), hid('discipline', 3))] },
      { label: 'Do both, on four hours\' sleep', check: chk(0.4, { 'hidden.discipline': 0.6, 'stats.health': 0.4 }), outcomes: [
        ok('Lines in the car, revision in the make-up chair. You pull off both, somehow.', perf(6), gpa(0.05), hid('willpower', 4), st('health', -3)),
        bad('You fall asleep in a take and in an exam, in that order.', perf(-4), gpa(-0.15), st('health', -5)),
      ] },
    ],
  },
  {
    id: 'recognized_at_school', category: 'on set', ageRange: [6, 17], cooldown: 5, requires: [onSet, need('career.level', '>=', 1)],
    text: 'Someone at school has seen you on television. By lunchtime the whole playground is doing your line at you.',
    choices: [
      { label: 'Laugh along and do the line back', outcomes: [any('You do it properly, with the face. They love it. It gets old by Thursday, for them and for you.', 'good', st('charm', 3), followers(200), st('mood', 3))] },
      { label: 'Act as though it is no big deal', check: chk(0.5, { 'stats.charm': 0.6 }), outcomes: [
        ok('You shrug so convincingly that people decide you must be really famous.', st('charm', 2), hid('discipline', 2)),
        bad('It comes across as stuck-up. You eat lunch on your own for a week.', st('mood', -5), st('charm', -2)),
      ] },
      { label: 'Hide in the library', outcomes: [any('The librarian has not seen it and does not care. It is the best hour of your day.', 'neutral', st('intellect', 2), st('mood', -1))] },
    ],
  },
  {
    id: 'stage_parent', category: 'on set', ageRange: [5, 15], once: true, requires: [onSet], cast: { mother: 'mother' },
    text: '{mother} has started coming to every shoot, and telling the director how your scenes should go.',
    choices: [
      { label: 'Ask her to wait in the car', outcomes: [any('She is hurt, and she does it. The set relaxes. So do you.', 'neutral', rel('mother', -6), perf(6))] },
      { label: 'Let her. She only wants the best for you', outcomes: [any('The crew start calling her by a nickname you are not supposed to hear.', 'bad', rel('mother', 4), perf(-6))] },
      { label: 'Tell her how much it means that she comes', outcomes: [any('She cries, and after that she sits quietly at the back with a flask.', 'good', rel('mother', 8), perf(2), st('charm', 2))] },
    ],
  },

  // ---------- The teens ----------
  {
    id: 'growth_spurt', category: 'teen', ageRange: [12, 15], once: true,
    text: 'Nothing fits. You have grown four inches since spring and your voice does what it likes.',
    choices: [
      { label: 'Join a team and use the height', outcomes: [any('You are suddenly useful under a basket. It is a new feeling.', 'good', tal('sports', 4), st('mood', 3))] },
      { label: 'Hide in a hoodie until it is over', outcomes: [any('A year goes by from behind a zip. You come out the other side taller and no worse.', 'neutral', st('charm', -1), st('mood', -2))] },
      { label: 'Own it', check: chk(0.5, { 'stats.charm': 0.6 }), outcomes: [
        ok('New haircut, shoulders back. People notice.', st('charm', 4), st('mood', 4)),
        bad('The haircut was a mistake. It grows out by Christmas.', st('charm', -2)),
      ] },
    ],
  },
  {
    id: 'first_phone', category: 'teen', ageRange: [11, 14], once: true, cast: { mother: 'mother' },
    text: '{mother} hands you your first phone, along with a list of rules.',
    choices: [
      { label: 'Follow the rules', outcomes: [any('Screen off at nine. It is boring, and you sleep well.', 'good', rel('mother', 4), hid('discipline', 3))] },
      { label: 'Follow them when anyone is looking', check: chk(0.5, { 'talents.crime': 0.5, 'stats.intellect': 0.3 }), outcomes: [
        ok('Under the covers until two, every night. Nobody ever knows.', st('mood', 3), st('health', -2), tal('crime', 2)),
        bad('{mother} checks the screen time. The phone lives in a drawer for a month.', rel('mother', -5), st('mood', -5)),
      ] },
      { label: 'Use it to learn something', outcomes: [any('You teach yourself three chords and some of a language from videos.', 'good', st('intellect', 3), tal('music', 3))] },
    ],
  },
  {
    id: 'sprained_ankle', category: 'teen', ageRange: [10, 17], cooldown: 6,
    text: 'You land badly coming off a wall you were told not to climb. Your ankle is already the size of an orange.',
    choices: [
      { label: 'Tell an adult', outcomes: [any('A long evening in a waiting room, a support bandage, and a lecture.', 'neutral', st('health', -2), st('mood', -2))] },
      { label: 'Walk it off and say nothing', check: chk(0.4, { 'stats.health': 0.5 }), outcomes: [
        ok('It hurts for two weeks and then it does not. You got away with it.', hid('willpower', 3), st('health', -2)),
        bad('It was broken after all. By the time anyone looks, the arm you landed on is too.', cond('broken_arm'), st('health', -6)),
      ] },
      { label: 'Make a new friend of whoever dared you', outcomes: [any('{pal} carries your bag for three weeks out of guilt. It becomes a friendship.', 'good', addNpc('friend', 'pal'), st('health', -3))] },
    ],
  },
];
