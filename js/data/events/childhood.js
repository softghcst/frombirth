import { st, hid, tal, cash, rel, flag, cond, heat, count, addNpc, ok, bad, any, chk, need } from './helpers.js';

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'first_word', category: 'childhood', ageRange: [1, 2], once: true, weight: 3,
    cast: { mother: 'mother', father: 'father' },
    text: 'Everyone is leaning over you, waiting. Your first word is on its way.',
    choices: [
      { label: 'Say "Mama"', outcomes: [any('{mother} cries a little and films it four times.', 'good', rel('mother', 8), st('mood', 3))] },
      { label: 'Say "Dada"', outcomes: [any('{father} tells every person he meets for a month.', 'good', rel('father', 8), st('mood', 3))] },
      { label: 'Say "No"', outcomes: [any('A firm "No." The room goes quiet. You have set a tone.', 'neutral', hid('willpower', 6), hid('crazy', 2))] },
      { label: 'Say nothing and stare', outcomes: [any('You hold eye contact until they give up. You are in no rush.', 'neutral', hid('discipline', 4), st('intellect', 2))] },
    ],
  },
  {
    id: 'wall_mural', category: 'childhood', ageRange: [2, 5], weight: 2,
    cast: { mother: 'mother' },
    text: 'You have covered the hallway wall in crayon. {mother} is standing behind you.',
    choices: [
      { label: 'Own up to it', outcomes: [any('{mother} sighs, hands you a sponge, and keeps one corner of it.', 'good', hid('karma', 4), rel('mother', 3))] },
      { label: 'Blame someone else', check: chk(0.4, { 'stats.charm': 0.5, 'talents.acting': 0.4 }), outcomes: [
        ok('You point down the hall with total conviction. It works.', hid('karma', -5), tal('acting', 3)),
        bad('The crayon is still in your hand. No dessert tonight.', hid('karma', -3), st('mood', -5), rel('mother', -4)),
      ] },
      { label: 'Present it as art', check: chk(0.5, { 'stats.charm': 0.6 }), outcomes: [
        ok('You explain the piece. {mother} laughs so hard she forgets to be angry.', st('mood', 5), rel('mother', 4)),
        bad('Your artist statement is not well received.', st('mood', -4)),
      ] },
    ],
  },
  {
    id: 'playground_shove', category: 'childhood', ageRange: [4, 9],
    text: 'A bigger kid shoves you off the swing and takes your turn.',
    choices: [
      { label: 'Shove back', check: chk(0.45, { 'talents.sports': 0.6, 'stats.health': 0.2 }), outcomes: [
        ok('You shove back harder. The swing is yours again.', hid('karma', -2), hid('willpower', 4), st('mood', 4)),
        bad('You bounce off and land in the wood chips.', st('health', -4), st('mood', -5)),
      ] },
      { label: 'Tell a teacher', outcomes: [any('The teacher sorts it out. The kid glares at you for a week.', 'neutral', hid('karma', 2), st('mood', 1))] },
      { label: 'Ask if they want to take turns', check: chk(0.5, { 'stats.charm': 0.7 }), outcomes: [
        ok('It turns out {pal} just wanted someone to play with. You have a new friend.', addNpc('friend', 'pal'), st('mood', 6), hid('karma', 4)),
        bad('They laugh at you and keep swinging.', st('mood', -4)),
      ] },
      { label: 'Walk away', outcomes: [any('You find a better spot on the climbing frame anyway.', 'neutral', hid('discipline', 2))] },
    ],
  },
  {
    id: 'found_wallet', category: 'childhood', ageRange: [6, 12],
    text: 'On the walk home you find a wallet in the gutter with {$40} inside.',
    choices: [
      { label: 'Keep the money', outcomes: [any('You pocket the cash and drop the wallet in a trash can.', 'neutral', cash(40), hid('karma', -8))] },
      { label: 'Hand it in', outcomes: [
        { on: 'always', weight: 2, tone: 'good', text: 'The owner is so relieved they give you {$10} as a reward.', effects: [cash(10), hid('karma', 8), st('mood', 5)] },
        { on: 'always', weight: 1, tone: 'good', text: 'You hand it in at the police station. Nobody thanks you, but it feels right.', effects: [hid('karma', 8), st('mood', 2)] },
      ] },
      { label: 'Take half, hand in the rest', outcomes: [any('A compromise only you know about.', 'neutral', cash(20), hid('karma', -3))] },
    ],
  },
  {
    id: 'lost_tooth', category: 'childhood', ageRange: [5, 8], once: true, weight: 2,
    text: 'Your first tooth falls out at dinner and lands in the mashed potatoes.',
    choices: [
      { label: 'Put it under your pillow', outcomes: [any('In the morning there is {$5} where the tooth was.', 'good', cash(5), st('mood', 4))] },
      { label: 'Stay up to catch whoever takes it', check: chk(0.3, { 'hidden.willpower': 0.6 }), outcomes: [
        ok('You catch a parent red-handed at 2 a.m. You negotiate {$15} for your silence.', cash(15), st('intellect', 3)),
        bad('You fall asleep by nine. The usual {$5} arrives.', cash(5)),
      ] },
      { label: 'Keep the tooth', outcomes: [any('You start a small collection in a matchbox. It unsettles guests.', 'neutral', hid('crazy', 3))] },
    ],
  },
  {
    id: 'spelling_bee', category: 'childhood', ageRange: [7, 11], requires: [need('education.enrolled', '==', true)],
    text: 'Your class is holding a spelling bee and the teacher has put your name down.',
    choices: [
      { label: 'Study every night', check: chk(0.55, { 'stats.intellect': 0.8, 'hidden.discipline': 0.3 }), outcomes: [
        ok('You win on "rhythm". Your name goes on the board for a month.', st('intellect', 4), st('mood', 7), hid('discipline', 3)),
        bad('You go out in round three on "necessary", but the practice stuck.', st('intellect', 3), st('mood', -2)),
      ] },
      { label: 'Wing it', check: chk(0.3, { 'stats.intellect': 0.8 }), outcomes: [
        ok('Somehow you spell everything right. Pure instinct.', st('mood', 6), st('intellect', 1)),
        bad('You are out on the first word. It was "friend".', st('mood', -5)),
      ] },
      { label: 'Fake a sore throat', check: chk(0.5, { 'talents.acting': 0.7 }), outcomes: [
        ok('Your croak is flawless. You spend the bee in the nurse\'s office with a book.', tal('acting', 3), hid('karma', -2)),
        bad('The teacher is not fooled and you have to go first.', st('mood', -4)),
      ] },
    ],
  },
  {
    id: 'stray_dog', category: 'childhood', ageRange: [5, 12], requires: [need('roles', 'lacks', 'pet')],
    cast: { father: 'father' },
    text: 'A scruffy stray has followed you all the way home and is sitting on the doorstep.',
    choices: [
      { label: 'Beg to keep it', check: chk(0.4, { 'stats.charm': 0.5, 'hidden.karma': 0.3 }), outcomes: [
        ok('{father} holds out for nearly a minute. You name your new pet {pet}.', addNpc('pet', 'pet', { species: 'dog' }), st('mood', 10), rel('father', 3)),
        bad('{father} says no and drives it to the shelter. You do not speak at dinner.', st('mood', -6), rel('father', -4)),
      ] },
      { label: 'Feed it and say goodbye', outcomes: [any('It eats your sandwich, licks your hand, and trots off.', 'good', hid('karma', 4), st('mood', 2))] },
      { label: 'Shut the door', outcomes: [any('You hear it whine for a while, then nothing.', 'neutral', hid('karma', -3))] },
    ],
  },
  {
    id: 'sibling_toy', category: 'childhood', ageRange: [3, 10], cast: { sib: 'sibling', mother: 'mother' },
    text: '{sib} has broken your favorite toy and is pretending not to know anything about it.',
    choices: [
      { label: 'Scream the house down', outcomes: [any('{mother} sends you both to your rooms.', 'bad', st('mood', -3), rel('sib', -4), rel('mother', -2))] },
      { label: 'Forgive them', outcomes: [any('{sib} looks surprised, then quietly helps you tape it together.', 'good', hid('karma', 5), rel('sib', 8))] },
      { label: 'Break something of theirs', outcomes: [any('An eye for an eye. Neither of you owns anything intact now.', 'neutral', hid('karma', -5), rel('sib', -8), st('mood', 2))] },
      { label: 'Report it to {mother}', outcomes: [any('{sib} has to give you a toy as payment and holds a grudge.', 'neutral', rel('sib', -3), st('mood', 2))] },
    ],
  },
  {
    id: 'after_school_pick', category: 'childhood', ageRange: [6, 11], once: true, weight: 2,
    text: 'Your parents say you can pick one after-school activity this year.',
    choices: [
      { label: 'Piano lessons', outcomes: [any('Scales, scales, more scales. Slowly it starts to sound like music.', 'good', tal('music', 12), hid('discipline', 4))] },
      { label: 'Football club', outcomes: [any('You come home muddy and starving every Tuesday.', 'good', tal('sports', 12), st('health', 4))] },
      { label: 'Drama group', outcomes: [any('You play Tree Number Two with real commitment.', 'good', tal('acting', 12), st('charm', 3))] },
      { label: 'None. Free time', outcomes: [any('You spend your afternoons doing exactly what you want.', 'neutral', st('mood', 6), hid('discipline', -3))] },
    ],
  },
  {
    id: 'shop_dare', category: 'childhood', ageRange: [7, 12],
    text: 'An older kid dares you to slip a chocolate bar into your sleeve at the corner shop.',
    choices: [
      { label: 'Do it', check: chk(0.5, { 'talents.crime': 0.7, 'hidden.karma': 0.2 }), outcomes: [
        ok('You walk out with it. Your heart is going like a drum.', tal('crime', 5), hid('karma', -6), count('crimes'), heat(5)),
        bad('The shopkeeper grabs your wrist and calls your parents.', hid('karma', -4), st('mood', -8), count('crimes'), heat(15)),
      ] },
      { label: 'Refuse', outcomes: [any('They call you a baby. You buy the chocolate with your own money.', 'neutral', hid('willpower', 4), hid('karma', 2))] },
      { label: 'Dare them to do it first', check: chk(0.5, { 'stats.intellect': 0.6 }), outcomes: [
        ok('They try it, get caught, and never dare you again.', st('intellect', 2), st('mood', 3)),
        bad('They call your bluff and you both leave with nothing.', st('mood', -2)),
      ] },
    ],
  },
  {
    id: 'new_kid', category: 'childhood', ageRange: [6, 11], requires: [need('education.enrolled', '==', true)],
    text: 'A new kid has joined your class and is eating lunch alone.',
    choices: [
      { label: 'Sit with them', outcomes: [any('Their name is {pal} and they know a lot about sharks. You get on well.', 'good', addNpc('friend', 'pal'), hid('karma', 5), st('mood', 4))] },
      { label: 'Leave them be', outcomes: [any('By next week they have found their own group.', 'neutral')] },
      { label: 'Make fun of their lunch', outcomes: [any('A few kids laugh. The new kid does not look up.', 'bad', hid('karma', -8), st('charm', 1))] },
    ],
  },
  {
    id: 'fever_night', category: 'childhood', ageRange: [2, 9], cast: { mother: 'mother' },
    text: 'You wake in the night burning hot with a pounding head.',
    choices: [
      { label: 'Wake {mother}', outcomes: [any('{mother} sits up with you until the fever breaks.', 'good', rel('mother', 4), st('health', -1))] },
      { label: 'Tough it out', check: chk(0.5, { 'stats.health': 0.6 }), outcomes: [
        ok('By morning you feel fine. You tell no one.', hid('willpower', 4)),
        bad('It gets much worse and turns into a proper flu.', cond('flu'), st('health', -6)),
      ] },
      { label: 'Use it to skip school tomorrow', outcomes: [any('A full day of cartoons and soup.', 'neutral', st('mood', 5), hid('discipline', -2))] },
    ],
  },
  {
    id: 'birthday_money', category: 'childhood', ageRange: [5, 12], cooldown: 4,
    text: 'A relative has tucked {$25} into your birthday card.',
    choices: [
      { label: 'Save it', outcomes: [any('It goes in the jar on your shelf.', 'good', cash(25), hid('discipline', 3))] },
      { label: 'Spend it all on candy', outcomes: [any('A glorious afternoon, then a stomach ache.', 'neutral', st('mood', 6), st('health', -2))] },
      { label: 'Give it to charity', outcomes: [any('You drop it in the collection tin at the supermarket.', 'good', hid('karma', 8), st('mood', 3), count('donated', 25))] },
    ],
  },
  {
    id: 'class_hamster', category: 'childhood', ageRange: [6, 10], once: true, requires: [need('education.enrolled', '==', true)],
    text: 'It is your turn to take the class hamster home for the weekend.',
    choices: [
      { label: 'Look after it carefully', outcomes: [any('It returns on Monday slightly fatter and very content.', 'good', hid('discipline', 4), hid('karma', 3))] },
      { label: 'Teach it tricks', check: chk(0.35, { 'stats.intellect': 0.6 }), outcomes: [
        ok('It learns to run through a toilet-roll tube on command. The class is amazed.', st('mood', 6), st('charm', 2)),
        bad('It escapes behind the fridge. You get it back at 3 a.m. with a trail of raisins.', st('mood', -3), st('intellect', 1)),
      ] },
      { label: 'Forget about it', outcomes: [any('You remember on Sunday night. It is alive, but it judges you.', 'bad', hid('karma', -4), st('mood', -3))] },
    ],
  },
];
