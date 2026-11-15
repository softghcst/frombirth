// Scenes from the first years of life through the teens. These fill the
// quieter early years, when little else is going on.
import { st, hid, tal, cash, rel, cond, gpa, addNpc, ok, bad, any, chk, need } from './helpers.js';

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
    text: 'The sweets are at exactly your eye level. {mother} has said no.',
    choices: [
      { label: 'Lie down in the aisle and howl', outcomes: [any('A crowd gathers. {mother} carries you out under one arm, sweets left behind.', 'bad', rel('mother', -4), hid('crazy', 2), st('mood', -3))] },
      { label: 'Ask again, very nicely', check: chk(0.35, { 'stats.charm': 0.7 }), outcomes: [
        ok('Big eyes, a "please", and a small hand on her sleeve. {mother} folds.', st('charm', 3), st('mood', 5)),
        bad('"I said no." You have learned that charm has limits.', st('mood', -2)),
      ] },
      { label: 'Accept it and move on', outcomes: [any('You hold the trolley and say nothing. {mother} buys you one at the till anyway.', 'good', hid('discipline', 4), rel('mother', 3))] },
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
    id: 'bike_without_stabilisers', category: 'childhood', ageRange: [5, 8], once: true, weight: 2,
    text: 'The stabilisers are off. The pavement stretches away downhill.',
    choices: [
      { label: 'Push off and pedal', check: chk(0.55, { 'talents.sports': 0.6 }), outcomes: [
        ok('Wobble, wobble, and then you are simply riding. You do not stop until dark.', tal('sports', 4), st('mood', 8)),
        bad('You meet a hedge at speed. Scratches everywhere, and you get back on.', st('health', -3), hid('willpower', 4)),
      ] },
      { label: 'Ask someone to hold the saddle', outcomes: [any('They run behind you and let go without saying. You only find out at the corner.', 'good', tal('sports', 2), st('mood', 4))] },
      { label: 'Put the stabilisers back on', outcomes: [any('Another summer with four wheels. Nobody minds but you.', 'neutral', st('mood', -2))] },
    ],
  },
  {
    id: 'school_play_tree', category: 'childhood', ageRange: [5, 9], once: true,
    text: 'The class play is cast. You are a tree. You have no lines.',
    choices: [
      { label: 'Be the best tree anyone has seen', outcomes: [any('You sway. You rustle. A parent in the third row is seen to wipe an eye.', 'good', tal('acting', 4), hid('discipline', 2))] },
      { label: 'Add a line of your own on the night', check: chk(0.5, { 'stats.charm': 0.5, 'talents.acting': 0.4 }), outcomes: [
        ok('"I have seen things," says the tree. It gets the biggest laugh of the show.', tal('acting', 5), st('charm', 2)),
        bad('You speak over the lead\'s big moment. The teacher has a word afterwards.', st('mood', -4), gpa(-0.05)),
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
      { label: 'Buy sweets and sell them at school', check: chk(0.5, { 'stats.intellect': 0.4, 'stats.charm': 0.4 }), outcomes: [
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
        ok('A whole packet of biscuits, eaten under a duvet by torchlight.', rel('pal', 5), st('mood', 4)),
        bad('The fourth stair creaks. A parent is waiting at the bottom.', rel('pal', 2), st('mood', -2)),
      ] },
      { label: 'Actually go to sleep', outcomes: [any('{pal} is disappointed, but you are the only one awake for pancakes.', 'neutral', st('health', 1), rel('pal', -1))] },
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
        ok('It hurts for a fortnight and then it does not. You got away with it.', hid('willpower', 3), st('health', -2)),
        bad('It was broken after all. By the time anyone looks, the arm you landed on is too.', cond('broken_arm'), st('health', -6)),
      ] },
      { label: 'Make a new friend of whoever dared you', outcomes: [any('{pal} carries your bag for three weeks out of guilt. It becomes a friendship.', 'good', addNpc('friend', 'pal'), st('health', -3))] },
    ],
  },
];
