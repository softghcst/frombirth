// The first years, from the crib to the first day of school: small scenes, told from the child's side. They give the
// baby and toddler years their own life (engine/eventEngine.js always draws one for a baby). Talents first show here
// too (js/data/events/gifts.js has the scenes that need a gift).
import { st, hid, tal, rel, any, ok, bad, chk, need, mem } from './helpers.js';

const hasSibling = need('roles', 'has', 'sibling');
const hasPet = need('roles', 'has', 'pet');

/** @type {import('../../types.js').GameEvent[]} */
export default [
  // ---------- Babies: the first two years ----------
  {
    id: 'bath_time', category: 'infancy', ageRange: [0, 1], once: true, weight: 3, cast: { mother: 'mother' },
    text: 'Bath time. The water is warm, and there is a yellow duck in it.',
    choices: [
      { label: 'Splash. Splash everything', outcomes: [any('The floor, the walls, {mother}. You have never been happier.', 'good', st('mood', 6), rel('mother', 2))] },
      { label: 'Hold very still and stare at the duck', outcomes: [any('The duck stares back. Neither of you blinks first.', 'neutral', st('intellect', 2))] },
      { label: 'Cry the moment you touch the water', outcomes: [any('Out you come, wrapped in a towel. Bath time is over until further notice.', 'neutral', hid('willpower', 2), st('mood', -2))] },
    ],
  },
  {
    id: 'first_laugh', category: 'infancy', ageRange: [0, 1], once: true, weight: 3, cast: { father: 'father' },
    text: '{father} is pulling the strangest faces at you.',
    choices: [
      { label: 'Laugh, out loud, for the first time', outcomes: [any('A real laugh, from the belly. {father} does the face forty more times.', 'good', st('charm', 3), rel('father', 6), mem('father', 'first_laugh', 'They laughed for the first time at one of your faces.'))] },
      { label: 'Look deeply unimpressed', outcomes: [any('{father} tries a sock puppet. Nothing. You are a tough room.', 'neutral', hid('willpower', 2))] },
    ],
  },
  {
    id: 'teething', category: 'infancy', ageRange: [0, 1], once: true, weight: 3, cast: { mother: 'mother' },
    text: 'Something sharp is coming through your gums, and nobody warned you about it.',
    choices: [
      { label: 'Chew on everything in reach', outcomes: [any('A teething ring, a spoon, the corner of a book, {mother}\'s finger. It helps a little.', 'neutral', hid('willpower', 2))] },
      { label: 'Cry all night about it', outcomes: [any('Nobody in the house sleeps. In the morning there is one small tooth, and everyone is very tired.', 'bad', st('mood', -4), rel('mother', -1))] },
      { label: 'Suffer in dignified silence', outcomes: [any('{mother} only finds out when she sees the tooth. She is amazed, and a little worried.', 'good', hid('discipline', 3))] },
    ],
  },
  {
    id: 'peekaboo', category: 'infancy', ageRange: [0, 1], cooldown: 2, weight: 2, cast: { parent: 'parent' },
    text: '{parent} covers their face with their hands. They are gone. Gone forever.',
    choices: [
      { label: 'Wait. They will come back', outcomes: [any('"Peekaboo!" They came back! This is the best game ever invented.', 'good', st('mood', 5), rel('parent', 3))] },
      { label: 'Panic', outcomes: [any('They come back fast, but it was a close thing. You hold on to their sleeve for the rest of the day.', 'neutral', st('mood', -2), rel('parent', 2))] },
      { label: 'Pull their hands away yourself', outcomes: [any('There they are. You have solved the game, and now it is boring.', 'neutral', st('intellect', 3))] },
    ],
  },
  {
    id: 'pacifier_drop', category: 'infancy', ageRange: [0, 1], cooldown: 2, cast: { mother: 'mother' },
    text: 'Your pacifier has fallen out of the stroller onto the sidewalk.',
    choices: [
      { label: 'Wail until it is back', outcomes: [any('{mother} rinses it with her water bottle and hands it back. Order is restored.', 'neutral', hid('willpower', 2))] },
      { label: 'Find something else to suck on', outcomes: [any('Your own thumb turns out to be right there, and it never falls on the ground.', 'good', hid('discipline', 3))] },
      { label: 'Throw the other toy out too', outcomes: [any('If the pacifier goes, everything goes. {mother} retrieves it all, sighing.', 'neutral', hid('crazy', 2), rel('mother', -1))] },
    ],
  },
  {
    id: 'first_food', category: 'infancy', ageRange: [0, 1], once: true, weight: 3, cast: { parent: 'parent' },
    text: 'There is a spoon coming toward your face. On it: something orange and mashed.',
    choices: [
      { label: 'Open wide', outcomes: [any('Sweet potato. A revelation. You eat the whole bowl and some of the bib.', 'good', st('health', 3), st('mood', 4))] },
      { label: 'Clamp your mouth shut', check: chk(0.5, { 'hidden.willpower': 0.6 }), outcomes: [
        ok('Not one spoonful gets past. {parent} gives up and tries again tomorrow.', hid('willpower', 4)),
        bad('{parent} does the airplane. You cannot resist the airplane. Nobody can.', st('mood', 2), rel('parent', 2)),
      ] },
      { label: 'Taste it, then spit it out', outcomes: [any('Orange everywhere. {parent} takes a photo for the family album anyway.', 'neutral', st('charm', 2))] },
    ],
  },
  {
    id: 'crib_escape', category: 'infancy', ageRange: [1, 2], once: true, cast: { father: 'father' },
    text: 'The bars of your crib are higher than you, but one of them has a foothold.',
    choices: [
      { label: 'Climb out', check: chk(0.35, { 'talents.sports': 0.6, 'hidden.willpower': 0.3 }), outcomes: [
        ok('Over the top and onto the rug. {father} finds you in the kitchen in the morning, eating a banana.', tal('sports', 3), hid('willpower', 3), rel('father', -1)),
        bad('Halfway up, you think better of it and sit down. Tomorrow, maybe.', st('mood', -1)),
      ] },
      { label: 'Call for someone to let you out', outcomes: [any('{father} comes, and stays to read you a story. A better plan.', 'good', rel('father', 3))] },
      { label: 'Go back to sleep', outcomes: [any('The crib is warm. Escape can wait.', 'good', st('health', 2))] },
    ],
  },
  {
    id: 'grandparent_visit', category: 'infancy', ageRange: [0, 2], once: true, weight: 2, cast: { gran: 'grandparent' },
    text: '{gran} has come to visit, and wants to hold you. You have never seen this person before.',
    choices: [
      { label: 'Smile and grab their glasses', outcomes: [any('{gran} laughs so hard they have to sit down. You are their favorite, it is decided.', 'good', st('charm', 3), rel('gran', 6), mem('gran', 'baby_glasses', 'As a baby, they grabbed your glasses and laughed.'))] },
      { label: 'Scream at the stranger', outcomes: [any('You are handed back quickly. {gran} says all babies are like that. They are a little hurt.', 'neutral', rel('gran', -2))] },
      { label: 'Fall asleep on them', outcomes: [any('{gran} does not move for two hours. Their arm goes numb. They say it was the best afternoon in years.', 'good', rel('gran', 5), st('health', 1))] },
    ],
  },
  {
    id: 'doctor_shots', category: 'infancy', ageRange: [0, 1], once: true, weight: 2, cast: { mother: 'mother' },
    text: 'A friendly person in a white coat is holding something small and pointed.',
    choices: [
      { label: 'Cry, loudly and with feeling', outcomes: [any('It is over in a second. You make sure the whole waiting room knows how you feel about it.', 'neutral', st('health', 3), st('mood', -2))] },
      { label: 'Stare at the doctor, betrayed', outcomes: [any('Not a sound. Just a long, wounded look. The doctor apologizes to you personally.', 'neutral', st('health', 3), hid('willpower', 3))] },
      { label: 'Hold on tight to {mother}', outcomes: [any('{mother} holds you through it, and the sticker afterward is excellent.', 'good', st('health', 3), rel('mother', 3))] },
    ],
  },
  {
    id: 'babbling', category: 'infancy', ageRange: [0, 1], once: true, weight: 2, cast: { parent: 'parent' },
    text: '{parent} is talking to you in a silly voice, and waiting for an answer.',
    choices: [
      { label: 'Babble back, at length', outcomes: [any('"Ba-ba-da-ga." {parent} nods, very seriously, as if you have made a good point.', 'good', st('intellect', 3), rel('parent', 3))] },
      { label: 'Blow a raspberry', outcomes: [any('A long, wet one. {parent} blows one back. This goes on for some time.', 'good', st('charm', 2), st('mood', 4))] },
      { label: 'Listen quietly', outcomes: [any('You take it all in. One day you will have a lot to say.', 'neutral', st('intellect', 2))] },
    ],
  },
  {
    id: 'baby_dog', category: 'infancy', ageRange: [0, 2], once: true, requires: [hasPet], cast: { pet: 'pet' },
    text: '{pet} has come to sniff you. {pet} is much bigger than you.',
    choices: [
      { label: 'Grab a handful of fur', outcomes: [any('{pet} puts up with it, like a saint. You will be friends for life.', 'good', st('mood', 5), rel('pet', 6))] },
      { label: 'Laugh at the cold nose', outcomes: [any('The cold nose comes back again and again. It is the funniest thing in the world.', 'good', st('mood', 6))] },
      { label: 'Cry until it goes away', outcomes: [any('{pet} lies down at a respectful distance and keeps watch instead.', 'neutral', rel('pet', 2))] },
    ],
  },
  {
    id: 'big_sibling', category: 'infancy', ageRange: [0, 2], once: true, requires: [hasSibling], cast: { sib: 'sibling' },
    text: '{sib} is leaning over your crib, looking at you very closely.',
    choices: [
      { label: 'Grab their finger', outcomes: [any('You hold on and do not let go. {sib} is suddenly very proud of you.', 'good', rel('sib', 6), mem('sib', 'held_finger', 'As a baby, they held on to your finger and would not let go.'))] },
      { label: 'Sneeze on them', outcomes: [any('{sib} reports this to everyone. It becomes a family story.', 'neutral', st('charm', 2), rel('sib', 1))] },
      { label: 'Cry until they leave', outcomes: [any('{sib} goes off to tell everyone you are boring.', 'neutral', rel('sib', -2))] },
    ],
  },
  {
    id: 'car_ride_sleep', category: 'infancy', ageRange: [0, 1], cooldown: 2, cast: { father: 'father' },
    text: 'You will not sleep. It is late. {father} picks up the car keys.',
    choices: [
      { label: 'Fall asleep before the end of the street', outcomes: [any('{father} drives around the block twelve more times, just to be sure.', 'good', st('health', 2), rel('father', 2))] },
      { label: 'Stay awake out of principle', check: chk(0.4, { 'hidden.willpower': 0.7 }), outcomes: [
        ok('Twenty minutes, then forty. You see the whole city at night, wide awake.', hid('willpower', 4), st('intellect', 1)),
        bad('You last until the highway, and then you are gone.', st('health', 2)),
      ] },
    ],
  },
  {
    id: 'mirror_baby', category: 'infancy', ageRange: [0, 1], once: true,
    text: 'There is a baby in the mirror. It is copying everything you do.',
    choices: [
      { label: 'Kiss the baby', outcomes: [any('The baby kisses you back. The mirror is now covered in kisses.', 'good', st('charm', 2), st('mood', 4))] },
      { label: 'Try to find out where it goes', outcomes: [any('You look behind the mirror. Nobody there. A mystery for another day.', 'neutral', st('intellect', 3))] },
      { label: 'Shout at it', outcomes: [any('It shouts back. You are evenly matched.', 'neutral', hid('willpower', 2))] },
    ],
  },
  {
    id: 'lullaby', category: 'infancy', ageRange: [0, 1], once: true, weight: 2, cast: { parent: 'parent' },
    text: '{parent} is singing you to sleep. They are not a very good singer.',
    choices: [
      { label: 'Drift off', outcomes: [any('By the second verse you are asleep. They sing the third one anyway.', 'good', st('health', 2), rel('parent', 3))] },
      { label: 'Hum along', check: chk(0.3, { 'talents.singing': 0.8, 'talents.music': 0.4 }), outcomes: [
        ok('A little hum, almost in tune. {parent} stops, amazed, and tells everyone you can carry a tune.', tal('singing', 4), tal('music', 2), rel('parent', 3)),
        bad('A gurgle. A lovely gurgle. Not quite a tune.', st('mood', 2)),
      ] },
      { label: 'Stay wide awake to hear the whole thing', outcomes: [any('Seven songs later, {parent} falls asleep before you do.', 'neutral', st('intellect', 1), rel('parent', 2))] },
    ],
  },
  {
    id: 'baby_daycare', category: 'infancy', ageRange: [1, 2], once: true, weight: 2, cast: { mother: 'mother' },
    text: 'A room full of other babies, and {mother} is putting on her coat to leave.',
    choices: [
      { label: 'Cling on and howl', outcomes: [any('She leaves anyway, eyes wet. Ten minutes later you are happily chewing a block.', 'neutral', st('mood', -2), rel('mother', 1))] },
      { label: 'Wave bye-bye', outcomes: [any('You barely notice her go. She is proud of you, and a little sad about it.', 'good', hid('discipline', 3), st('charm', 1))] },
      { label: 'Go and take another baby\'s toy', check: chk(0.5, { 'hidden.willpower': 0.5 }), outcomes: [
        ok('It is yours now. The other baby does not seem to mind.', hid('willpower', 3), st('mood', 2)),
        bad('The other baby takes it back, with interest. You have met your match.', st('mood', -3)),
      ] },
    ],
  },
  {
    id: 'first_birthday_cake', category: 'infancy', ageRange: [1, 1], once: true, weight: 3, cast: { parent: 'parent' },
    text: 'Everyone is singing. There is a cake in front of you with one candle on it, and nobody is stopping you.',
    choices: [
      { label: 'Both hands, straight in', outcomes: [any('Cake in your hair, your ears, your nose. Everyone takes photos. Best day so far.', 'good', st('mood', 7), st('charm', 1))] },
      { label: 'One careful finger', outcomes: [any('A single, delicate taste. Then you push the plate away. You are a person of restraint.', 'neutral', hid('discipline', 4))] },
      { label: 'Cry at all the singing', outcomes: [any('Too many faces, too loud. {parent} takes you somewhere quiet, and you have the cake later in peace.', 'neutral', rel('parent', 3))] },
    ],
  },
  {
    id: 'stroller_world', category: 'infancy', ageRange: [0, 1], cooldown: 2,
    text: 'A walk in the stroller. Trees go past overhead, and a dog, and a bus.',
    choices: [
      { label: 'Point at everything', outcomes: [any('Dog. Bus. Tree. Bird. Another dog. You name the whole world, in your own words.', 'good', st('intellect', 3))] },
      { label: 'Smile at strangers', outcomes: [any('Three people stop to say how sweet you are. You accept this as your due.', 'good', st('charm', 3))] },
      { label: 'Sleep through it', outcomes: [any('You miss the whole thing. It was very relaxing.', 'neutral', st('health', 2))] },
    ],
  },
  {
    id: 'baby_sick_night', category: 'infancy', ageRange: [0, 2], cooldown: 3, cast: { parent: 'parent' },
    text: 'You are hot and miserable, and nothing is right.',
    choices: [
      { label: 'Let {parent} rock you', outcomes: [any('All night in the chair, swaying. By morning the fever has broken, and so has {parent}.', 'good', st('health', 2), rel('parent', 4))] },
      { label: 'Refuse to be comforted', outcomes: [any('A long, hard night for everyone. It passes, the way these things do.', 'bad', st('mood', -3), st('health', -1))] },
    ],
  },
  {
    id: 'first_word_choice', category: 'infancy', ageRange: [1, 1], once: true, weight: 2, cast: { mother: 'mother', father: 'father' },
    text: '{mother} and {father} each think your first word should be their name. They are both leaning in.',
    choices: [
      { label: 'Say "Mama"', outcomes: [any('{mother} is triumphant. {father} demands a recount.', 'good', rel('mother', 5), rel('father', -1))] },
      { label: 'Say "Dada"', outcomes: [any('{father} runs a lap of the living room. {mother} says it does not count.', 'good', rel('father', 5), rel('mother', -1))] },
      { label: 'Say "No"', outcomes: [any('A clear, firm "No". Your parents look at each other. This explains a lot.', 'neutral', hid('willpower', 5))] },
    ],
  },

  // ---------- Toddlers and the years before school ----------
  {
    id: 'why_phase', category: 'infancy', ageRange: [2, 4], once: true, weight: 2, cast: { parent: 'parent' },
    text: 'You have discovered the word "why", and you have a great many questions.',
    choices: [
      { label: 'Why? Why? But why?', outcomes: [any('Twenty-six whys in a row, ending at "because that is how the universe works." You will remember this one.', 'good', st('intellect', 4), rel('parent', -1))] },
      { label: 'Ask one, and really listen to the answer', outcomes: [any('Why is the sky blue? {parent} does their best. You think about it for days.', 'good', st('intellect', 3), rel('parent', 2))] },
    ],
  },
  {
    id: 'potty_training', category: 'infancy', ageRange: [2, 3], once: true, weight: 2, cast: { parent: 'parent' },
    text: 'There is a small plastic seat in the bathroom, and {parent} has great hopes for it.',
    choices: [
      { label: 'Give it a try', check: chk(0.5, { 'hidden.discipline': 0.6 }), outcomes: [
        ok('Success. {parent} cheers like you scored the winning goal. You get a sticker.', hid('discipline', 4), st('mood', 4)),
        bad('Not today. Nearly, but not today.', st('mood', -2)),
      ] },
      { label: 'Wear it as a hat', outcomes: [any('A bold choice. {parent} decides to wait a few more weeks.', 'neutral', hid('crazy', 2), st('charm', 1))] },
      { label: 'Refuse', outcomes: [any('No. Not now, maybe not ever. Diapers are fine.', 'neutral', hid('willpower', 3))] },
    ],
  },
  {
    id: 'cardboard_box', category: 'infancy', ageRange: [2, 5], once: true,
    text: 'A big delivery came today. The present was boring. The box it came in is enormous.',
    choices: [
      { label: 'It is a spaceship', outcomes: [any('You fly to the moon and back three times before lunch.', 'good', st('intellect', 2), st('mood', 5))] },
      { label: 'It is a house, and you live in it now', outcomes: [any('You move in with a blanket and two snacks, and refuse to come out for dinner.', 'good', st('mood', 5), hid('willpower', 1))] },
      { label: 'It is a drum', outcomes: [any('Boom. Boom. BOOM. Everybody hears about the box.', 'neutral', tal('music', 2), st('mood', 3))] },
    ],
  },
  {
    id: 'hide_and_seek_toddler', category: 'infancy', ageRange: [2, 4], cooldown: 2, cast: { parent: 'parent' },
    text: 'Hide and seek. {parent} is counting to ten.',
    choices: [
      { label: 'Hide behind the curtain, feet sticking out', outcomes: [any('{parent} searches everywhere else first, very loudly, before finding you. You win, obviously.', 'good', st('mood', 5), rel('parent', 3))] },
      { label: 'Find a really good spot', check: chk(0.4, { 'talents.crime': 0.6, 'stats.intellect': 0.3 }), outcomes: [
        ok('Inside the laundry basket, under the towels. It takes them fifteen minutes. You are a natural.', tal('crime', 3), st('intellect', 2)),
        bad('You giggle. Instantly found.', st('mood', 2)),
      ] },
      { label: 'Shout "I am in the kitchen!"', outcomes: [any('Found at once. You do not see what the problem is.', 'neutral', st('charm', 1), st('mood', 2))] },
    ],
  },
  {
    id: 'scribble_wall', category: 'infancy', ageRange: [2, 4], once: true, cast: { mother: 'mother' },
    text: 'Someone left the crayons out, and there is a whole white wall in the hallway.',
    choices: [
      { label: 'Draw a family portrait', outcomes: [any('Everyone is there, with very long arms. {mother} is cross, then takes a photo before scrubbing it off.', 'neutral', st('intellect', 2), rel('mother', -1), st('mood', 3))] },
      { label: 'Draw on paper, like you were told', outcomes: [any('A big purple sun. It goes on the fridge, which is where all the best art goes.', 'good', hid('discipline', 3), rel('mother', 2))] },
      { label: 'Eat the red crayon', outcomes: [any('It tastes the way red should taste. Not great.', 'neutral', hid('crazy', 2))] },
    ],
  },
  {
    id: 'park_slide', category: 'infancy', ageRange: [2, 5], cooldown: 3, cast: { parent: 'parent' },
    text: 'The big slide at the park. The big kids go down it head first.',
    choices: [
      { label: 'Head first, like the big kids', check: chk(0.45, { 'talents.sports': 0.5, 'stats.health': 0.3 }), outcomes: [
        ok('Whoosh. Perfect landing. The big kids are impressed, briefly.', tal('sports', 3), st('mood', 5)),
        bad('A face full of sand at the bottom. You get up, spit, and go again.', hid('willpower', 3), st('health', -1)),
      ] },
      { label: 'Sitting down, holding the sides', outcomes: [any('Slow and safe and still thrilling. You do it eleven times.', 'good', st('mood', 4))] },
      { label: 'Go up the slide the wrong way', outcomes: [any('Halfway up, a traffic jam of children forms above you. {parent} has to come and fetch you.', 'neutral', hid('willpower', 2), rel('parent', -1))] },
    ],
  },
  {
    id: 'imaginary_friend', category: 'childhood', ageRange: [3, 6], once: true, cast: { parent: 'parent' },
    text: 'You have a new friend. Nobody else can see them, but they are definitely there.',
    choices: [
      { label: 'Insist they get a seat at dinner', outcomes: [any('{parent} sets an extra place without a word. Your friend is very grateful.', 'good', st('intellect', 2), st('mood', 4), rel('parent', 2))] },
      { label: 'Blame them for the broken vase', check: chk(0.35, { 'talents.crime': 0.6, 'talents.acting': 0.4 }), outcomes: [
        ok('A convincing story. Your friend is sent to their room, and you are not.', tal('acting', 2), tal('crime', 2)),
        bad('{parent} is not fooled. You are both sent to your room.', rel('parent', -2), st('mood', -2)),
      ] },
      { label: 'Keep them a secret', outcomes: [any('Some friends are just for you.', 'neutral', st('intellect', 1))] },
    ],
  },
  {
    id: 'preschool_snack', category: 'childhood', ageRange: [3, 5], once: true,
    text: 'Snack time at preschool. The kid next to you has the good cookies, and you have carrot sticks.',
    choices: [
      { label: 'Offer a trade', check: chk(0.4, { 'stats.charm': 0.7 }), outcomes: [
        ok('Two carrot sticks for one cookie. You are going to be good at business.', st('charm', 3), st('mood', 3)),
        bad('No deal. You eat the carrots and stare at the cookie.', st('mood', -1), st('health', 1)),
      ] },
      { label: 'Share your carrots anyway', outcomes: [any('The kid shares a cookie back. You have made a friend.', 'good', hid('karma', 3), st('charm', 2))] },
      { label: 'Eat your carrots', outcomes: [any('Crunchy, at least.', 'neutral', st('health', 2))] },
    ],
  },
  {
    id: 'thunderstorm_bed', category: 'infancy', ageRange: [2, 6], once: true, cast: { parent: 'parent' },
    text: 'A huge crack of thunder, right over the house. The room lights up white.',
    choices: [
      { label: 'Run to {parent}\'s bed', outcomes: [any('You sleep in the middle, sideways, with your feet in their back. They do not mind, much.', 'good', rel('parent', 4), st('mood', 2))] },
      { label: 'Count the seconds between flash and bang', outcomes: [any('Someone told you about that once. The storm is moving away. You are not scared of it any more.', 'good', st('intellect', 3), hid('willpower', 2))] },
      { label: 'Hide under the covers until morning', outcomes: [any('A long night, but you made it on your own.', 'neutral', hid('willpower', 3), st('mood', -2))] },
    ],
  },
  {
    id: 'lost_in_store', category: 'infancy', ageRange: [3, 5], once: true, cast: { mother: 'mother' },
    text: 'You turn around in the store, and {mother} is gone. The aisles are very tall.',
    choices: [
      { label: 'Find someone who works there', outcomes: [any('A kind woman with a name badge holds your hand and calls over the speakers. {mother} comes running.', 'good', st('intellect', 3), rel('mother', 3))] },
      { label: 'Stand still, like you were told', outcomes: [any('You do not move an inch. {mother} finds you two aisles over, and hugs you too hard.', 'good', hid('discipline', 4), rel('mother', 3))] },
      { label: 'Go exploring', outcomes: [any('You find the toy aisle, then the pet aisle, then a very worried {mother}. Worth it.', 'neutral', hid('willpower', 2), rel('mother', -2), st('mood', 2))] },
    ],
  },
  {
    id: 'bedtime_stall', category: 'infancy', ageRange: [2, 5], cooldown: 3, cast: { parent: 'parent' },
    text: 'It is bedtime. You are not tired. You will never be tired again.',
    choices: [
      { label: 'Ask for one more story', check: chk(0.5, { 'stats.charm': 0.6 }), outcomes: [
        ok('One more turns into three. {parent} falls asleep in the middle of the last one.', st('charm', 2), rel('parent', 2)),
        bad('"Lights out." The negotiations have failed.', st('mood', -2)),
      ] },
      { label: 'A glass of water. And then another one', outcomes: [any('Four glasses of water and a lot of trips to the bathroom later, you finally sleep.', 'neutral', hid('willpower', 2))] },
      { label: 'Go to sleep', outcomes: [any('Out like a light. {parent} cannot believe their luck.', 'good', st('health', 2), rel('parent', 2))] },
    ],
  },
  {
    id: 'puddle_jump', category: 'infancy', ageRange: [2, 5], cooldown: 3, cast: { parent: 'parent' },
    text: 'It has rained, and there is a puddle on the path. A big one. {parent} says "Do not."',
    choices: [
      { label: 'Jump in with both feet', outcomes: [any('The splash is magnificent. So is the walk home, wet to the knees.', 'neutral', st('mood', 6), rel('parent', -1))] },
      { label: 'Walk around it', outcomes: [any('{parent} is so surprised they let you jump in the next one.', 'good', hid('discipline', 3), st('mood', 3))] },
    ],
  },
  {
    id: 'kindergarten_first_day', category: 'childhood', ageRange: [4, 6], once: true, weight: 2, cast: { parent: 'parent' },
    text: 'Your first day of kindergarten. Your backpack is almost as big as you are.',
    choices: [
      { label: 'March straight in', outcomes: [any('You do not even look back. {parent} cries in the car, just a little.', 'good', hid('willpower', 3), st('charm', 2))] },
      { label: 'Hold {parent}\'s hand right up to the door', outcomes: [any('A long goodbye at the door, then in you go. By lunch you have a best friend.', 'good', rel('parent', 3), st('mood', 3))] },
      { label: 'Refuse to let go', outcomes: [any('The teacher has to peel you off. By the afternoon you do not want to go home.', 'neutral', st('mood', -2), rel('parent', 2))] },
    ],
  },
];
