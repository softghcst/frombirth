// More everyday scenes for the long middle of a life (roughly 18 to 60), where the same few scenes used to come round
// too often: errands, friends, small choices of conscience, the body getting older, work days, hobbies. Each is an
// ordinary moment drawn by chance, so it comes as a line in the year's story, not a pop-up (engine/eventEngine.js).
// Scenes tied to a time have their first year in data/history.js SCENE_FROM, or name the technology that ties them.
import { AT } from '../workplaces.js';
import { st, hid, tal, cash, rel, heat, ms, addNpc, ok, bad, any, chk, need, perf } from './helpers.js';

const has = (amount) => need('cashBase', '>=', amount);
const employed = need('employed', '==', true);

/** @type {import('../../types.js').GameEvent[]} */
export default [
  // ---------- Errands and the street ----------
  {
    id: 'bench_wallet', category: 'conscience', ageRange: [14, 90], cooldown: 20,
    text: 'A wallet is lying on a park bench. Inside: an ID card, a photo of two children, and a thick fold of cash.',
    choices: [
      { label: 'Find the owner yourself', outcomes: [any('It takes an afternoon of asking around. The owner had been paying rent with that cash, and hugs you on the doorstep.', 'good', hid('karma', 8), st('mood', 4))] },
      { label: 'Hand it in at the police station', outcomes: [any('A desk sergeant writes your name in a book. A thank-you card arrives a week later.', 'good', hid('karma', 5))] },
      { label: 'Keep the cash, post the wallet back', outcomes: [any('You drop the empty wallet in a mailbox. The money goes quickly, and the photo of the children stays with you longer.', 'bad', cash(150), hid('karma', -8), st('mood', -2))] },
    ],
  },
  {
    id: 'car_wont_start', workplaces: AT.colleagues, category: 'everyday', ageRange: [18, 85], cooldown: 15, requires: [employed],
    text: 'A cold morning, an important day, and the car will not start. It makes a small, sad clicking sound.',
    choices: [
      { label: 'Knock on a neighbor\'s door for a jump start', outcomes: [any('In your bathrobe, with cables. The neighbor turns out to know a lot about engines, and you are only ten minutes late.', 'good', st('charm', 1), st('mood', 1))] },
      { label: 'Call a cab and pay for it', requires: [has(60)], outcomes: [any('Expensive, but you walk in on time.', 'neutral', cash(-40), perf(1))] },
      { label: 'Call in late', outcomes: [any('Your boss says "these things happen" in a voice that suggests they should not.', 'bad', perf(-3), st('mood', -2))] },
    ],
  },
  {
    id: 'bad_haircut', category: 'everyday', ageRange: [15, 80], cooldown: 15,
    text: 'You asked for "just a trim". The person in the mirror disagrees.',
    choices: [
      { label: 'Laugh it off', outcomes: [any('You tell the story better than anyone can tease you about it. It grows back in six weeks.', 'good', st('charm', 1), st('mood', 1))] },
      { label: 'Wear a hat for a month', outcomes: [any('A month of hats. Everyone knows anyway.', 'neutral', st('mood', -2))] },
      { label: 'Go back and complain', check: chk(0.5, { 'stats.charm': 0.4 }), outcomes: [
        ok('They fix it for free and throw in a conditioning treatment.', st('mood', 2)),
        bad('They try to fix it. It gets shorter.', st('mood', -3)),
      ] },
    ],
  },
  {
    id: 'umbrella_stranger', category: 'everyday', ageRange: [16, 85], cooldown: 15,
    text: 'A sudden downpour at the bus stop. The stranger next to you has an umbrella big enough for two, and offers.',
    choices: [
      { label: 'Accept, and make conversation', check: chk(0.5, { 'stats.charm': 0.6 }), outcomes: [
        ok('The bus is twenty minutes late, which turns out to be lucky. You swap numbers: {pal}.', addNpc('friend', 'pal'), st('mood', 4)),
        bad('Twenty minutes of polite silence under one umbrella.', st('mood', 1)),
      ] },
      { label: 'Accept, gratefully and quietly', outcomes: [any('A small kindness from a stranger. It improves the whole day.', 'good', st('mood', 3))] },
      { label: 'Say you like the rain', outcomes: [any('You do not, it turns out. You arrive soaked.', 'neutral', st('mood', -1))] },
    ],
  },
  {
    id: 'stolen_bike', category: 'everyday', ageRange: [12, 75], cooldown: 20,
    text: 'You come out of the store and your bicycle is gone. Only the cut lock is still there.',
    choices: [
      { label: 'Report it and buy a better lock', requires: [has(150)], outcomes: [any('The police give you a reference number and a sympathetic look. The new bike comes with a lock that weighs more than it does.', 'neutral', cash(-150))] },
      { label: 'Search the local secondhand shops', check: chk(0.25, { 'stats.intellect': 0.3 }), outcomes: [
        ok('There it is, in a shop window, with a price tag. The owner gives it back without a fuss once you show him the scratch on the frame.', st('mood', 6), hid('willpower', 2)),
        bad('Three shops, no bike. You walk for a while.', st('health', 1), st('mood', -2)),
      ] },
      { label: 'Take it as a sign to walk more', outcomes: [any('You walk everywhere for a year and feel better for it.', 'good', st('health', 3))] },
    ],
  },
  {
    id: 'pay_it_forward', category: 'everyday', ageRange: [16, 90], cooldown: 15,
    text: 'At the coffee counter, the cashier says the person ahead of you already paid for your order.',
    choices: [
      { label: 'Pay for the person behind you', outcomes: [any('The chain goes on for eleven more customers, the cashier tells you later. A good morning.', 'good', cash(-5), hid('karma', 3), st('mood', 4))] },
      { label: 'Say thank you and enjoy it', outcomes: [any('It is the best coffee you have had all year, for reasons that have nothing to do with the coffee.', 'good', st('mood', 3))] },
      { label: 'Wonder what they wanted', outcomes: [any('Nothing, it seems. You still wonder.', 'neutral')] },
    ],
  },
  {
    id: 'elderly_groceries', category: 'conscience', ageRange: [12, 75], cooldown: 15,
    text: 'An old man is struggling up the hill with four heavy shopping bags, stopping every few steps.',
    choices: [
      { label: 'Carry them home for him', outcomes: [any('He lives at the top of the hill, and tells you about the war all the way there. You leave with a jar of homemade jam.', 'good', hid('karma', 6), st('health', 1), st('mood', 3))] },
      { label: 'Offer to call someone for him', outcomes: [any('His granddaughter comes in her car. He thanks you twice.', 'good', hid('karma', 3))] },
      { label: 'Walk past', outcomes: [any('You look back once from the corner. He is still on the hill.', 'bad', hid('karma', -3), st('mood', -2))] },
    ],
  },
  {
    id: 'snowed_in', category: 'everyday', ageRange: [8, 95], cooldown: 15,
    text: 'You wake to a world gone white and silent. The snow is up to the windowsills, and nothing is moving.',
    choices: [
      { label: 'Dig out the whole street', outcomes: [any('Three hours with a shovel. By noon the whole street is out with you, and someone brings hot chocolate.', 'good', st('health', 2), hid('karma', 3), st('mood', 4))] },
      { label: 'Stay in and cook something slow', outcomes: [any('A stew that takes all day, a book, and nowhere to be. Bliss.', 'good', st('mood', 5))] },
      { label: 'Try to drive anyway', check: chk(0.4, { 'hidden.discipline': 0.3 }), outcomes: [
        ok('You make it, slowly, and you are the only one in the office.', perf(2)),
        bad('You get stuck at the end of the road and have to be pushed out by neighbors.', st('mood', -3)),
      ] },
    ],
  },
  {
    id: 'overcharged_mechanic', category: 'everyday', ageRange: [18, 85], cooldown: 20, requires: [has(300)],
    text: 'The garage calls: the "quick check" has become a list of urgent repairs, and the total is alarming.',
    choices: [
      { label: 'Get a second opinion', check: chk(0.6, { 'stats.intellect': 0.4 }), outcomes: [
        ok('The second garage does the one repair that was actually needed, for a fraction of the price.', cash(-80), st('intellect', 1), st('mood', 2)),
        bad('The second garage agrees with the first. You have paid two inspection fees now.', cash(-320), st('mood', -3)),
      ] },
      { label: 'Pay and trust them', outcomes: [any('The car runs beautifully, and you will never know if it needed all of it.', 'neutral', cash(-300))] },
      { label: 'Learn to do the basics yourself', outcomes: [any('A library book and three weekends. You can change the oil now, and you are unbearably proud of it.', 'good', cash(-40), st('intellect', 2), hid('discipline', 2))] },
    ],
  },
  {
    id: 'unfair_ticket', category: 'everyday', ageRange: [18, 90], cooldown: 15,
    text: 'A parking ticket on your windshield, though you are sure the sign said you could park here.',
    choices: [
      { label: 'Photograph the sign and appeal', check: chk(0.55, { 'stats.intellect': 0.4, 'hidden.willpower': 0.3 }), outcomes: [
        ok('A letter comes back: the ticket is canceled. You frame it, almost.', st('mood', 4), hid('willpower', 2)),
        bad('The appeal is refused, on a technicality about the other sign.', cash(-60), st('mood', -3)),
      ] },
      { label: 'Just pay it', outcomes: [any('Annoying, and over with.', 'neutral', cash(-50))] },
      { label: 'Leave it on the dashboard and forget it', outcomes: [any('You forget it. The fine does not, and doubles.', 'bad', cash(-100), heat(1))] },
    ],
  },
  {
    id: 'street_musician', category: 'everyday', ageRange: [10, 90], cooldown: 12,
    text: 'A street musician outside the station is playing a song you have not heard since you were small.',
    choices: [
      { label: 'Stop and listen to the end', outcomes: [any('You stand there with your coat buttoned wrong, remembering. You put something in the case.', 'good', cash(-5), st('mood', 5))] },
      { label: 'Ask if you can play a song', requires: [need('talents.music', '>=', 40)], outcomes: [any('They hand you the guitar. A small crowd gathers. You split the coins.', 'good', tal('music', 2), st('charm', 2), st('mood', 6))] },
      { label: 'Hurry on to your train', outcomes: [any('The song stays in your head all day anyway.', 'neutral', st('mood', 1))] },
    ],
  },

  {
    id: 'wrong_number', category: 'everyday', ageRange: [18, 90], cooldown: 20,
    text: 'The phone rings: a wrong number. An elderly voice apologizes, then says, a little sadly, that nobody has called them in a week.',
    choices: [
      { label: 'Stay on the line and chat', outcomes: [any('Forty minutes about their late husband, the price of bread and the weather. You promise to call again, and you do.', 'good', hid('karma', 6), st('mood', 3))] },
      { label: 'Help them find the number they wanted', outcomes: [any('You find their nephew\'s number together. They thank you three times.', 'good', hid('karma', 3))] },
      { label: 'Say sorry, wrong number, and hang up', outcomes: [any('It was a wrong number, after all.', 'neutral')] },
    ],
  },
  {
    id: 'park_concert', category: 'everyday', ageRange: [8, 90], cooldown: 12,
    text: 'A free concert in the park on a warm summer evening. Half the town seems to be there with blankets.',
    choices: [
      { label: 'Bring a picnic and stay till the end', outcomes: [any('Music, fireflies, and strangers sharing grapes. One of the best evenings of the year.', 'good', st('mood', 7))] },
      { label: 'Dance near the front', check: chk(0.5, { 'talents.dance': 0.6, 'stats.charm': 0.3 }), outcomes: [
        ok('You dance until your feet hurt, with a crowd of strangers who feel like friends.', tal('dance', 2), st('mood', 8)),
        bad('You dance badly and joyfully. Nobody minds.', st('mood', 5)),
      ] },
      { label: 'Listen from your window', outcomes: [any('The music drifts across the rooftops. Not bad at all.', 'neutral', st('mood', 2))] },
    ],
  },
  {
    id: 'beach_sunburn', category: 'health', ageRange: [10, 80], cooldown: 12,
    text: 'A perfect day at the beach. You forgot the sunscreen, and it is already mid-afternoon.',
    choices: [
      { label: 'Find shade and cover up', outcomes: [any('A slightly pink nose and a lesson remembered.', 'good', st('health', 1), st('mood', 3))] },
      { label: 'Buy sunscreen from the kiosk at twice the price', outcomes: [any('Expensive, and worth it.', 'good', cash(-15), st('mood', 3))] },
      { label: 'Stay out, you never burn', outcomes: [any('You burn. You sleep sitting up for three nights.', 'bad', st('health', -3), st('mood', -3))] },
    ],
  },
  {
    id: 'meteor_shower', category: 'everyday', ageRange: [8, 95], cooldown: 15,
    text: 'The radio says there will be a meteor shower tonight, best seen after two in the morning, far from streetlights.',
    choices: [
      { label: 'Drive out to a dark field and watch', outcomes: [any('A blanket, a flask and forty shooting stars. You make a wish on every one of them.', 'good', st('mood', 7), st('intellect', 1))] },
      { label: 'Set an alarm and watch from the yard', outcomes: [any('You see three, and the neighbor\'s cat sees you.', 'neutral', st('mood', 3))] },
      { label: 'Sleep through it', outcomes: [any('You see the photos in the newspaper.', 'neutral')] },
    ],
  },
  {
    id: 'flat_tire_stranger', category: 'conscience', ageRange: [18, 75], cooldown: 15,
    text: 'A car is stopped on the shoulder with a flat tire. The driver is staring at the jack as if it might explain itself.',
    choices: [
      { label: 'Pull over and change it for them', check: chk(0.6, { 'stats.health': 0.3, 'stats.intellect': 0.3 }), outcomes: [
        ok('Twenty minutes and dirty hands. They try to pay you; you say pass it on.', hid('karma', 6), st('mood', 4)),
        bad('The wheel nuts will not move. You wait together for the tow truck and swap life stories.', hid('karma', 4), st('mood', 2)),
      ] },
      { label: 'Stop and help them find a garage', outcomes: [any('A small help, gratefully taken.', 'good', hid('karma', 3))] },
      { label: 'Drive on', outcomes: [any('Someone else will stop, you tell yourself.', 'neutral', hid('karma', -1))] },
    ],
  },
  {
    id: 'dance_lessons', category: 'everyday', ageRange: [18, 85], cooldown: 15, requires: [has(100)],
    text: 'A dance studio is offering a beginners\' course: salsa on Wednesday nights. No partner needed.',
    choices: [
      { label: 'Sign up', check: chk(0.45, { 'talents.dance': 0.6, 'hidden.discipline': 0.3 }), outcomes: [
        ok('By the end of the course you can lead, follow and spin without falling over. You keep going for years.', cash(-100), tal('dance', 4), st('health', 2), st('mood', 6)),
        bad('Two left feet, and a lot of laughing. You finish the course, and that is enough.', cash(-100), tal('dance', 1), st('mood', 3)),
      ] },
      { label: 'Go to one lesson and see', outcomes: [any('You step on four people, apologize five times and have a surprisingly good night.', 'good', cash(-15), st('mood', 3))] },
      { label: 'Wednesdays are for the sofa', outcomes: [any('And the sofa is grateful.', 'neutral')] },
    ],
  },

  // ---------- Friends and family life ----------
  {
    id: 'wedding_plus_one', category: 'friends', ageRange: [20, 50], cooldown: 12,
    text: 'An old friend is getting married, and the invitation says your name "and guest".',
    choices: [
      { label: 'Go alone and dance with everyone', check: chk(0.5, { 'stats.charm': 0.6 }), outcomes: [
        ok('You end the night at the singles table, which turns out to be the best table. Someone gives you their number: {pal}.', addNpc('friend', 'pal'), st('mood', 6)),
        bad('You spend the night explaining that no, you are not seeing anyone at the moment.', st('mood', -2)),
      ] },
      { label: 'Bring a friend as your guest', outcomes: [any('You win the dance-off as a team. Your friend still talks about it.', 'good', st('mood', 5))] },
      { label: 'Send a gift and stay home', requires: [has(80)], outcomes: [any('A nice gift, and the photos look lovely. You feel a little left out.', 'neutral', cash(-80), st('mood', -1))] },
    ],
  },
  {
    id: 'moving_day_help', category: 'friends', ageRange: [18, 60], cooldown: 12, cast: { pal: 'friend' },
    text: '{pal} is moving to a third-floor apartment with no elevator, and asks if you can help on Saturday.',
    choices: [
      { label: 'Help all day', outcomes: [any('A sofa, a piano, and forty boxes marked "books". {pal} buys pizza and you eat it on the floor among the boxes.', 'good', rel('pal', 10), st('health', 1), st('mood', 2))] },
      { label: 'Come for the last hour with food', outcomes: [any('You arrive with dinner just as the last box is carried up. {pal} is not sure whether to thank you or laugh.', 'neutral', rel('pal', 3))] },
      { label: 'Say your back is bad', outcomes: [any('{pal} says that is fine. They ask someone else next time.', 'bad', rel('pal', -6))] },
    ],
  },
  {
    id: 'forgot_birthday', category: 'friends', ageRange: [16, 80], cooldown: 12, cast: { pal: 'friend' },
    text: 'You see the photos of {pal}\'s birthday dinner and realize, with a sinking feeling, that you forgot it completely.',
    choices: [
      { label: 'Call, apologize, and take them out', requires: [has(60)], outcomes: [any('A late birthday lunch, on you. {pal} says the second celebration was better than the first.', 'good', cash(-60), rel('pal', 6))] },
      { label: 'Send a funny belated card', outcomes: [any('The card is very funny. {pal} forgives you, mostly.', 'neutral', rel('pal', 1))] },
      { label: 'Say nothing and hope they did not notice', outcomes: [any('They noticed.', 'bad', rel('pal', -8))] },
    ],
  },
  {
    id: 'weekend_away', category: 'friends', ageRange: [18, 70], cooldown: 12, requires: [has(300)],
    text: 'Your friends are planning a weekend away together: a cabin by a lake, splitting the cost.',
    choices: [
      { label: 'Go, and plan the whole thing', check: chk(0.55, { 'hidden.discipline': 0.5 }), outcomes: [
        ok('Everything goes to plan: a long walk, a fire, a game that runs past midnight. Everyone thanks you.', cash(-250), st('charm', 2), st('mood', 8)),
        bad('The booking was for the wrong weekend. You all go anyway, to a different, worse cabin, and laugh about it for years.', cash(-300), st('mood', 3)),
      ] },
      { label: 'Go, and let someone else plan it', outcomes: [any('You turn up, eat well, and are back on Monday rested.', 'good', cash(-250), st('mood', 6))] },
      { label: 'Skip it this time', outcomes: [any('The group photos look wonderful.', 'neutral', st('mood', -2))] },
    ],
  },
  {
    id: 'old_teacher', category: 'everyday', ageRange: [22, 70], cooldown: 25,
    text: 'In the supermarket, you recognize your favorite schoolteacher, much older now, studying the price of tomatoes.',
    choices: [
      { label: 'Go and say hello', outcomes: [any('They remember you, or say they do. You tell them what their class meant to you, and they have to look away for a moment.', 'good', hid('karma', 3), st('mood', 5))] },
      { label: 'Smile and nod from the end of the aisle', outcomes: [any('They nod back, uncertainly. You are not sure they knew you.', 'neutral')] },
      { label: 'Hide behind the cereal', outcomes: [any('You are a grown adult hiding from a teacher. You know this.', 'neutral', st('mood', -1))] },
    ],
  },
  {
    id: 'attic_letters', category: 'family', ageRange: [25, 85], cooldown: 30,
    text: 'Clearing out a cupboard, you find a bundle of old letters tied with string, in a grandparent\'s handwriting.',
    choices: [
      { label: 'Read them all, slowly', outcomes: [any('A whole hidden life: a first love, a journey across the sea, a quarrel never made up. You understand your family a little better.', 'good', st('intellect', 1), st('mood', 3), ms('Read the old family letters.'))] },
      { label: 'Give them to the oldest relative', outcomes: [any('Your aunt cries, then laughs, then tells you stories for a whole afternoon.', 'good', hid('karma', 2), st('mood', 3))] },
      { label: 'Put them back unread', outcomes: [any('Some things were meant to be private. You tie the string again carefully.', 'neutral', hid('karma', 1))] },
    ],
  },
  {
    id: 'dinner_party_disaster', category: 'everyday', ageRange: [20, 80], cooldown: 15,
    text: 'You have invited six people to dinner. An hour before they arrive, the main course is burned black.',
    choices: [
      { label: 'Improvise from the cupboard', check: chk(0.45, { 'stats.intellect': 0.3, 'hidden.discipline': 0.3 }), outcomes: [
        ok('Pasta with whatever you had. Everyone asks for the recipe, which you cannot give, because there was none.', st('charm', 2), st('mood', 5)),
        bad('Pasta with whatever you had. It was not enough. Everyone is polite.', st('mood', -2)),
      ] },
      { label: 'Order takeout and confess', requires: [has(80)], outcomes: [any('Honesty and dumplings. It is the most relaxed dinner party you have ever thrown.', 'good', cash(-80), st('charm', 1), st('mood', 4))] },
      { label: 'Serve it anyway and say it is meant to be like that', outcomes: [any('"Charred," you say firmly. Nobody believes you, and everyone eats the bread.', 'neutral', st('mood', -1))] },
    ],
  },
  {
    id: 'neighbor_kid_lemonade', category: 'everyday', ageRange: [18, 90], cooldown: 12,
    text: 'Two small children have set up a stall at the end of the road, selling lemonade that is mostly sugar.',
    choices: [
      { label: 'Buy a cup, and overpay', outcomes: [any('They count your change very seriously and give you a free cookie for being their first customer.', 'good', cash(-3), hid('karma', 2), st('mood', 3))] },
      { label: 'Give them business advice', outcomes: [any('They listen gravely, then raise their prices. You have created a monster.', 'good', st('charm', 1), st('mood', 2))] },
      { label: 'Say no thank you', outcomes: [any('Their faces fall a little. The next person buys two.', 'neutral')] },
    ],
  },

  // ---------- Small choices of conscience ----------
  {
    id: 'seen_shoplifting', category: 'conscience', ageRange: [16, 90], cooldown: 20,
    text: 'In the supermarket, you see a thin teenager slip a loaf of bread and some cheese inside their coat.',
    choices: [
      { label: 'Quietly pay for it at the register', requires: [has(20)], outcomes: [any('You tell the cashier you are paying for the young person ahead. The teenager looks back at you, then away.', 'good', cash(-10), hid('karma', 8))] },
      { label: 'Tell the store manager', outcomes: [any('The teenager is stopped at the door. You watch them hand back the bread, and you are not sure how you feel.', 'neutral', hid('karma', -2))] },
      { label: 'Pretend you saw nothing', outcomes: [any('You think about it on the way home.', 'neutral')] },
    ],
  },
  {
    id: 'blood_drive', category: 'conscience', ageRange: [18, 70], cooldown: 12,
    text: 'There is a blood donation van parked outside your building, with a sign saying stocks are low.',
    choices: [
      { label: 'Give blood', outcomes: [any('A small needle, a cup of tea and a cookie. They tell you your donation could help three people.', 'good', hid('karma', 6), st('health', -1), st('mood', 3))] },
      { label: 'Sign up to give regularly', outcomes: [any('You go every few months. It becomes a quiet routine you are proud of.', 'good', hid('karma', 10), hid('discipline', 2), ms('Became a regular blood donor.'))] },
      { label: 'Walk past, you hate needles', outcomes: [any('You do hate needles. You also feel a small, nagging guilt.', 'neutral')] },
    ],
  },
  {
    id: 'friend_lie_cover', category: 'conscience', ageRange: [18, 70], cooldown: 15, cast: { pal: 'friend' },
    text: '{pal} asks you to tell their partner they were with you last Friday night. They were not.',
    choices: [
      { label: 'Refuse, kindly', outcomes: [any('{pal} is annoyed, then quiet. Whatever it was, they have to sort it out themselves.', 'neutral', rel('pal', -4), hid('karma', 4))] },
      { label: 'Agree, this once', outcomes: [any('You tell the lie. It is easy. You do not like how easy it was.', 'bad', rel('pal', 4), hid('karma', -5))] },
      { label: 'Ask what is really going on', check: chk(0.5, { 'stats.charm': 0.5 }), outcomes: [
        ok('A long, honest talk. {pal} tells their partner the truth themselves, and it goes better than either of you feared.', rel('pal', 8), hid('karma', 4)),
        bad('{pal} tells you to forget they asked.', rel('pal', -3)),
      ] },
    ],
  },
  {
    id: 'charity_run', category: 'conscience', ageRange: [18, 65], cooldown: 15,
    text: 'A friend is collecting sponsors for a charity race and asks if you would like to run it with them.',
    choices: [
      { label: 'Train for it and run', check: chk(0.5, { 'stats.health': 0.5, 'hidden.discipline': 0.4 }), outcomes: [
        ok('Three months of early mornings, and you cross the line with your friend. You raise more than you expected.', st('health', 5), tal('sports', 2), hid('karma', 5), ms('Ran a charity race.')),
        bad('You make it halfway and walk the rest. You still finish, and still raise the money.', st('health', 2), hid('karma', 4)),
      ] },
      { label: 'Sponsor them instead', requires: [has(30)], outcomes: [any('You give generously and cheer from the finish line.', 'good', cash(-30), hid('karma', 3))] },
      { label: 'Say running is not for you', outcomes: [any('Probably true.', 'neutral')] },
    ],
  },

  // ---------- The body getting older ----------
  {
    id: 'first_gray_hair', category: 'health', ageRange: [28, 50], cooldown: 40,
    text: 'In the bathroom mirror, under a bright light: a single gray hair, shining like a wire.',
    choices: [
      { label: 'Pull it out', outcomes: [any('Two more appear the following month, in solidarity.', 'neutral', st('mood', -1))] },
      { label: 'Leave it, it is distinguished', outcomes: [any('You decide you are going to age well. It is a good decision.', 'good', st('mood', 2))] },
      { label: 'Book a visit to the gym', outcomes: [any('You do not see the connection either, but you go, and feel better.', 'good', st('health', 2))] },
    ],
  },
  {
    id: 'dentist_overdue', category: 'health', ageRange: [18, 90], cooldown: 15,
    text: 'A tooth has been twinging for weeks when you drink anything cold. It has been years since you saw a dentist.',
    choices: [
      { label: 'Book an appointment today', requires: [has(120)], outcomes: [any('A small filling, and a lecture about flossing that you have earned.', 'good', cash(-120), st('health', 2))] },
      { label: 'Wait and see', outcomes: [
        { on: 'always', weight: 0.5, tone: 'neutral', text: 'It settles down by itself. You are lucky this time.', effects: [] },
        { on: 'always', weight: 0.5, tone: 'bad', text: 'It gets much worse, on a Sunday. The emergency visit is expensive.', effects: [cash(-300), st('health', -2), st('mood', -4)] },
      ] },
      { label: 'Switch to warm drinks only', outcomes: [any('A creative solution to the wrong problem.', 'neutral', st('mood', -1))] },
    ],
  },
  {
    id: 'cold_wont_go', workplaces: AT.colleagues, category: 'health', ageRange: [18, 70], cooldown: 10, requires: [employed],
    text: 'A cold that has hung around for a week. There is a big day at work tomorrow.',
    choices: [
      { label: 'Stay home and rest properly', outcomes: [any('Two days in bed with soup. You come back well, and nobody else catches it.', 'good', st('health', 2), perf(-1))] },
      { label: 'Go in and push through', outcomes: [any('You get through the day and half the office catches it. They know who started it.', 'bad', st('health', -2), perf(2), st('charm', -1))] },
      { label: 'Work from the sofa', outcomes: [any('A compromise that makes you a worse worker and a worse patient, but only a bit.', 'neutral', st('health', -1))] },
    ],
  },
  {
    id: 'new_diet_trend', category: 'health', ageRange: [18, 70], cooldown: 12,
    text: 'Everyone at the office is on a new diet that promises everything. They want you to join.',
    choices: [
      { label: 'Try it for a month', check: chk(0.4, { 'hidden.discipline': 0.6 }), outcomes: [
        ok('You stick to it for a month, mostly because you said you would. You feel lighter, and very tired of soup.', st('health', 2), hid('discipline', 2)),
        bad('You give up on the fourth day at a birthday party, with cake.', st('mood', 1)),
      ] },
      { label: 'Just eat more vegetables instead', outcomes: [any('Less exciting, and it works better.', 'good', st('health', 2))] },
      { label: 'Say you are happy as you are', outcomes: [any('You are, and it shows.', 'good', st('mood', 2))] },
    ],
  },
  {
    id: 'new_glasses', category: 'health', ageRange: [38, 65], cooldown: 40,
    text: 'You have started holding menus at arm\'s length to read them. A friend gently points this out.',
    choices: [
      { label: 'Get your eyes tested', requires: [has(100)], outcomes: [any('Reading glasses. The world is suddenly full of small print you could not see before.', 'good', cash(-100), st('intellect', 1), st('mood', 1))] },
      { label: 'Buy cheap readers from the pharmacy', outcomes: [any('They work, more or less. You lose six pairs in the first year.', 'neutral', cash(-15))] },
      { label: 'Insist the print is getting smaller', outcomes: [any('A brave position, and nobody agrees with it.', 'neutral', st('mood', -1))] },
    ],
  },

  // ---------- Working days ----------
  {
    id: 'secret_santa', workplaces: AT.colleagues, category: 'work', ageRange: [18, 65], cooldown: 8, requires: [employed],
    text: 'The office gift exchange: you have drawn the name of the coworker you know least, with a ten-dollar limit.',
    choices: [
      { label: 'Find out what they like and get it right', outcomes: [any('A small book on their favorite subject. They light up, and you have lunch together the following week.', 'good', cash(-10), addNpc('coworker', 'pal'), st('charm', 1))] },
      { label: 'Buy chocolate', outcomes: [any('Nobody dislikes chocolate. Safe, sweet and forgotten.', 'neutral', cash(-10))] },
      { label: 'Buy a joke gift', check: chk(0.4, { 'stats.charm': 0.6 }), outcomes: [
        ok('The whole room laughs, including them. A success.', cash(-10), st('charm', 2)),
        bad('Nobody laughs. Especially not them.', cash(-10), st('charm', -2), perf(-1)),
      ] },
    ],
  },
  {
    id: 'office_karaoke', workplaces: AT.colleagues, category: 'work', ageRange: [20, 65], cooldown: 10, requires: [employed],
    text: 'The team night out ends in a karaoke bar. Your boss has already sung twice.',
    choices: [
      { label: 'Sing something bold', check: chk(0.35, { 'talents.singing': 0.8, 'stats.charm': 0.3 }), outcomes: [
        ok('A power ballad, sung with total commitment. Your colleagues will never see you the same way again, in the best way.', tal('singing', 2), st('charm', 2), st('mood', 6)),
        bad('Your voice cracks on the high note and the room cheers anyway.', st('mood', 2)),
      ] },
      { label: 'Do a duet with the boss', outcomes: [any('A memorable night for the team, and a slightly closer one with your boss.', 'good', perf(2), st('mood', 3))] },
      { label: 'Leave early, before anyone hands you a microphone', outcomes: [any('Safe at home by eleven. You see the videos the next morning.', 'neutral')] },
    ],
  },
  {
    id: 'mentoring_new_hire', workplaces: AT.colleagues, category: 'work', ageRange: [26, 65], cooldown: 12, requires: [employed, need('career.performance', '>=', 50)],
    text: 'A nervous new starter on your team keeps asking you questions. Your manager asks if you would show them the ropes.',
    choices: [
      { label: 'Take them under your wing', outcomes: [any('In six months they are good, and they tell everyone who taught them. It reflects well on you.', 'good', perf(4), addNpc('coworker', 'pal'), hid('karma', 3))] },
      { label: 'Help when asked, but no more', outcomes: [any('A fair answer. They find their feet in their own time.', 'neutral')] },
      { label: 'Point them to the manual', outcomes: [any('They read the manual, and ask someone else next time.', 'neutral', perf(-1))] },
    ],
  },

  // ---------- Hobbies and growing ----------
  {
    id: 'night_class', category: 'everyday', ageRange: [20, 80], cooldown: 15, requires: [has(150)],
    text: 'A flyer for evening classes at the local college: languages, painting, carpentry, cooking.',
    choices: [
      { label: 'Learn a language', check: chk(0.5, { 'stats.intellect': 0.5, 'hidden.discipline': 0.4 }), outcomes: [
        ok('A year of Tuesday evenings, and you can order a meal, argue about football and read a newspaper.', cash(-150), st('intellect', 4), ms('Learned a new language at night class.')),
        bad('You stop going in the second term. You can still count to a hundred.', cash(-150), st('intellect', 1)),
      ] },
      { label: 'Take the carpentry class', outcomes: [any('You make a wobbly stool, then a good shelf. You are absurdly proud of the shelf.', 'good', cash(-150), hid('discipline', 2), st('mood', 4))] },
      { label: 'Take the cooking class', outcomes: [any('You learn to make bread, and your friends start coming to dinner more often.', 'good', cash(-150), st('charm', 2), st('mood', 3))] },
      { label: 'Recycle the flyer', outcomes: [any('Maybe next year.', 'neutral')] },
    ],
  },
  {
    id: 'pottery_wheel', category: 'everyday', ageRange: [18, 85], cooldown: 15, requires: [has(100)],
    text: 'A friend has a spare place in a pottery class and talks you into coming along.',
    choices: [
      { label: 'Give it a real go', outcomes: [any('Your first bowl leans like a tired tower. Your tenth one is almost round. You keep both.', 'good', cash(-60), st('mood', 5), hid('discipline', 1))] },
      { label: 'Go once for the fun of it', outcomes: [any('Clay up to your elbows, and a lot of laughing.', 'good', st('mood', 3))] },
      { label: 'Say you are not the artistic type', outcomes: [any('You will never know.', 'neutral')] },
    ],
  },
  {
    id: 'community_garden', category: 'everyday', ageRange: [20, 90], cooldown: 15,
    text: 'A plot has come free at the community garden. The waiting list was three years long, and it is yours if you want it.',
    choices: [
      { label: 'Take it, and grow vegetables', outcomes: [any('Your tomatoes are a triumph, your carrots a tragedy. You know everyone in the garden by the end of summer.', 'good', st('health', 2), st('mood', 4), addNpc('friend', 'pal'))] },
      { label: 'Share it with a neighbor', outcomes: [any('Half the work, half the vegetables, twice the conversation.', 'good', st('mood', 3), hid('karma', 2))] },
      { label: 'Pass it to the next person on the list', outcomes: [any('Someone else\'s happy summer.', 'neutral', hid('karma', 1))] },
    ],
  },
  {
    id: 'bucket_list', category: 'everyday', ageRange: [38, 65], cooldown: 25,
    text: 'A friend\'s sudden illness has you thinking. You sit down one evening and write a list of things you have always wanted to do.',
    choices: [
      { label: 'Do the first thing on the list this year', requires: [has(400)], outcomes: [any('You finally go and see the sea you have only ever seen in pictures. It is everything you hoped.', 'good', cash(-400), st('mood', 8), ms('Crossed something off the list.'))] },
      { label: 'Do the cheapest thing on the list', outcomes: [any('You learn to swim properly, at last. It costs a pair of goggles and a little pride.', 'good', st('health', 3), st('mood', 5))] },
      { label: 'Put the list in a drawer for later', outcomes: [any('Later is a long time. The list waits.', 'neutral')] },
    ],
  },
  {
    id: 'quiz_night', category: 'everyday', ageRange: [18, 85], cooldown: 12,
    text: 'A local bar runs a quiz night. Your friends need one more person for their team.',
    choices: [
      { label: 'Join the team', check: chk(0.4, { 'stats.intellect': 0.7 }), outcomes: [
        ok('You know the capital of Mongolia and the year the zipper was invented. Your team wins a voucher and a bottle of wine.', st('intellect', 2), st('mood', 6)),
        bad('Your team comes ninth of ten, beaten by a table of retired teachers.', st('mood', 2)),
      ] },
      { label: 'Go, but just to watch', outcomes: [any('You whisper all the right answers to no one.', 'neutral', st('mood', 2))] },
      { label: 'Stay home', outcomes: [any('A quiet evening in.', 'neutral')] },
    ],
  },
  {
    id: 'adopt_shelter_cat', category: 'everyday', ageRange: [20, 85], cooldown: 25, requires: [has(100), need('flags.livesWithParents', '!=', true)],
    text: 'A sign at the vet\'s: an older cat at the shelter needs a quiet home. Nobody wants the old ones.',
    choices: [
      { label: 'Go and meet the cat', outcomes: [any('She is gray, grumpy and missing an ear. She sits on your lap within a minute. You call her {pet}.', 'good', cash(-80), addNpc('pet', 'pet', { species: 'cat' }), hid('karma', 5), st('mood', 6))] },
      { label: 'Donate to the shelter instead', outcomes: [any('A small check for food and blankets.', 'good', cash(-40), hid('karma', 2))] },
      { label: 'You are not ready for a pet', outcomes: [any('A fair and honest answer.', 'neutral')] },
    ],
  },
];
