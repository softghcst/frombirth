// Still more everyday scenes, for the ages where the same scenes came round most often in simulated lives: childhood
// (5 to 12), the twenties, the long middle (30 to 49) and later life (50 to 80). Ordinary moments drawn by chance, so
// each comes as a line in the year's story, not a pop-up (engine/eventEngine.js). Scenes tied to a time have their
// first year in data/history.js SCENE_FROM, or name the technology that ties them.
import { AT } from '../workplaces.js';
import { st, hid, tal, cash, rel, ms, addNpc, ok, bad, any, chk, need, perf } from './helpers.js';

const has = (amount) => need('cashBase', '>=', amount);
const employed = need('employed', '==', true);
const ownPlace = need('flags.livesWithParents', '!=', true);

/** @type {import('../../types.js').GameEvent[]} */
export default [
  // ---------- Childhood (5 to 12) ----------
  {
    id: 'kid_treehouse', category: 'childhood', ageRange: [6, 12], cooldown: 30,
    text: 'You and a friend have found a perfect tree at the edge of the park, and a pile of old planks behind a garage.',
    choices: [
      { label: 'Build a treehouse', check: chk(0.5, { 'stats.intellect': 0.3, 'hidden.discipline': 0.4 }), outcomes: [
        ok('It takes the whole summer. It leans a little, the roof leaks, and it is the best place in the world.', st('mood', 8), hid('discipline', 2)),
        bad('It falls down in the first strong wind. You start planning a better one.', st('mood', 1), hid('willpower', 2)),
      ] },
      { label: 'Ask a grown-up to help', outcomes: [any('With a grown-up and a real hammer, it is sturdy, safe and slightly less fun. You use it for years.', 'good', st('mood', 5))] },
      { label: 'Leave the planks alone', outcomes: [any('Someone else builds one there the next year. You wish it had been you.', 'neutral')] },
    ],
  },
  {
    id: 'kid_library_card', category: 'childhood', ageRange: [5, 11], cooldown: 30,
    text: 'You are finally old enough for your own library card, with your name on it in real letters.',
    choices: [
      { label: 'Take out the maximum, every week', outcomes: [any('Seven books a week, read under the covers with a flashlight. The librarian starts saving new ones for you.', 'good', st('intellect', 5), st('mood', 3))] },
      { label: 'Head straight for the comics', outcomes: [any('Comics count. They absolutely count.', 'good', st('intellect', 2), st('mood', 4))] },
      { label: 'Lose the card within a week', outcomes: [any('It turns up a year later in the pocket of a winter coat.', 'neutral')] },
    ],
  },
  {
    id: 'kid_lost_tooth_wobble', category: 'childhood', ageRange: [6, 9], cooldown: 40,
    text: 'Your front tooth is hanging on by a thread, and every grown-up has a different plan for getting it out.',
    choices: [
      { label: 'Wiggle it bravely yourself', outcomes: [any('It comes out in the middle of dinner. You hold it up like a trophy.', 'good', hid('willpower', 2), st('mood', 3))] },
      { label: 'Try the door-and-string trick', check: chk(0.5), outcomes: [
        ok('A slam, a shriek, and there it is. A legend at school for a week.', st('charm', 2), st('mood', 4)),
        bad('The string slips off. The tooth stays. The door is fine.', st('mood', -1)),
      ] },
      { label: 'Refuse to let anyone near it', outcomes: [any('It falls out by itself in an apple, a week later.', 'neutral')] },
    ],
  },
  {
    id: 'kid_rainy_fort', category: 'childhood', ageRange: [5, 10], cooldown: 25,
    text: 'A whole rainy weekend, and nobody is allowed outside. Every cushion in the house is looking at you.',
    choices: [
      { label: 'Build the greatest blanket fort ever made', outcomes: [any('It has three rooms and a flag. You sleep in it both nights.', 'good', st('mood', 6), st('intellect', 1))] },
      { label: 'Put on a show for the family', outcomes: [any('A one-person play, with costume changes. The family applauds, mostly sincerely.', 'good', tal('acting', 2), st('charm', 2))] },
      { label: 'Complain that there is nothing to do', outcomes: [any('You are given chores, which there is always enough of.', 'neutral', hid('discipline', 2), st('mood', -2))] },
    ],
  },
  {
    id: 'kid_bake_sale', category: 'childhood', ageRange: [6, 12], cooldown: 20,
    text: 'The school is holding a bake sale for new library books, and everyone is meant to bring something.',
    choices: [
      { label: 'Bake something yourself', check: chk(0.45, { 'hidden.discipline': 0.4 }), outcomes: [
        ok('Your cookies sell out first. A teacher buys three.', st('mood', 5), hid('karma', 2)),
        bad('The cookies come out flat and very brown. Someone buys them out of kindness.', st('mood', -1), hid('karma', 1)),
      ] },
      { label: 'Run the stall', outcomes: [any('You learn to count change fast and to smile at people who only want to look.', 'good', st('charm', 2), st('intellect', 1))] },
      { label: 'Bring something from the store and say nothing', outcomes: [any('Nobody can tell. You can.', 'neutral')] },
    ],
  },
  {
    id: 'kid_scraped_knee', category: 'childhood', ageRange: [5, 10], cooldown: 15,
    text: 'You come off your bike at speed and land on the sidewalk. Your knee is a mess, and a crowd of kids is watching.',
    choices: [
      { label: 'Get straight back on', outcomes: [any('You ride home with blood on your sock and your head high.', 'good', hid('willpower', 3), st('health', -1))] },
      { label: 'Cry, loudly, and go home', outcomes: [any('A grown-up, a bandage, a cookie. Much better.', 'neutral', st('health', -1), st('mood', 1))] },
      { label: 'Show everyone the scab for a week', outcomes: [any('A celebrity, briefly.', 'good', st('charm', 1))] },
    ],
  },
  {
    id: 'kid_pen_pal', category: 'childhood', ageRange: [8, 12], cooldown: 30, requires: [need('education.enrolled', '==', true)],
    text: 'Your class is matched with a school in another country, and each of you gets a pen pal.',
    choices: [
      { label: 'Write long letters full of questions', outcomes: [any('You write for years. You learn about a place you have never seen, and someone there learns about yours: {pal}.', 'good', addNpc('friend', 'pal'), st('intellect', 3), st('mood', 3))] },
      { label: 'Write once, with a drawing', outcomes: [any('A drawing comes back, of a dog. You keep it.', 'neutral', st('mood', 1))] },
      { label: 'Forget to write back', outcomes: [any('Their second letter sits on your desk for months.', 'neutral')] },
    ],
  },
  {
    id: 'kid_broken_window', category: 'childhood', ageRange: [7, 12], cooldown: 25,
    text: 'Your ball has gone straight through a neighbor\'s window with a terrible crash. Nobody saw who kicked it.',
    choices: [
      { label: 'Knock on their door and own up', outcomes: [any('The neighbor is cross, then impressed. You do odd jobs for them to pay for the glass, and they turn out to be good company.', 'good', hid('karma', 6), hid('discipline', 2))] },
      { label: 'Tell a grown-up at home', outcomes: [any('Your family pays for the glass, and you lose your allowance for a month.', 'neutral', hid('karma', 3), st('mood', -2))] },
      { label: 'Run', outcomes: [any('You get away with it. You avoid that street for a year.', 'bad', hid('karma', -5), st('mood', -2))] },
    ],
  },
  {
    id: 'kid_rock_collection', category: 'childhood', ageRange: [5, 11], cooldown: 30,
    text: 'You have started collecting interesting stones. Your pockets are full, and so is the washing machine filter.',
    choices: [
      { label: 'Learn the names of them all', outcomes: [any('Quartz, granite, a fossil shell. You become the class expert on rocks.', 'good', st('intellect', 4))] },
      { label: 'Paint faces on them', outcomes: [any('A family of forty painted rocks lives on the windowsill.', 'good', st('mood', 4))] },
      { label: 'Move on to a new hobby by Friday', outcomes: [any('The rocks end up in the garden. Some of them are still there.', 'neutral')] },
    ],
  },
  {
    id: 'kid_sports_day', category: 'childhood', ageRange: [5, 12], cooldown: 12, requires: [need('education.enrolled', '==', true)],
    text: 'School sports day: sack race, egg-and-spoon, and the big relay at the end.',
    choices: [
      { label: 'Go all out in the relay', check: chk(0.4, { 'talents.sports': 0.8, 'stats.health': 0.3 }), outcomes: [
        ok('You overtake two runners on the last bend. Your team wins, and you are carried off on shoulders, briefly.', tal('sports', 3), st('mood', 7)),
        bad('You drop the baton. Your team is very understanding, for about an hour.', st('mood', -3)),
      ] },
      { label: 'Enter the egg-and-spoon race', outcomes: [any('You walk slowly and carefully and come third. A ribbon is a ribbon.', 'good', st('mood', 3))] },
      { label: 'Cheer everyone from the side', outcomes: [any('You have the loudest voice on the field.', 'good', st('charm', 1))] },
    ],
  },
  {
    id: 'kid_sleepover_scary', category: 'childhood', ageRange: [8, 12], cooldown: 15,
    text: 'At a friend\'s house, the older kids tell a ghost story in the dark. Everyone is pretending not to be scared.',
    choices: [
      { label: 'Tell an even scarier one', check: chk(0.5, { 'stats.charm': 0.5, 'talents.acting': 0.4 }), outcomes: [
        ok('Somebody screams and the grown-ups come in. You are a legend.', st('charm', 2), tal('acting', 1), st('mood', 4)),
        bad('Nobody is scared. Somebody yawns.', st('mood', -1)),
      ] },
      { label: 'Admit you are scared', outcomes: [any('Three others admit it too. You all sleep with the light on, which is better.', 'good', st('charm', 1), st('mood', 2))] },
      { label: 'Lie awake listening to every creak', outcomes: [any('A long night. The house is very old and very creaky.', 'neutral', st('health', -1))] },
    ],
  },
  {
    id: 'kid_lemonade_stand', category: 'childhood', ageRange: [6, 11], cooldown: 25,
    text: 'It is the hottest day of the summer, and you have a table, a jug and a very good idea.',
    choices: [
      { label: 'Open a lemonade stand', outcomes: [any('A dollar here, two there. By the end of the day you have made enough for a comic and a lot of ice cream.', 'good', cash(8), st('charm', 2), st('mood', 4))] },
      { label: 'Give it away to anyone who looks hot', outcomes: [any('The mail carrier, a jogger, three dogs. Everyone is grateful.', 'good', hid('karma', 4), st('mood', 3))] },
      { label: 'Drink it all yourself', outcomes: [any('A sticky, happy afternoon.', 'neutral', st('mood', 2))] },
    ],
  },
  {
    id: 'kid_pet_sitting', category: 'childhood', ageRange: [8, 12], cooldown: 20,
    text: 'A neighbor going on vacation asks if you would feed their goldfish and water their plants for two weeks.',
    choices: [
      { label: 'Do it perfectly, every day', outcomes: [any('The fish is fat and happy, the plants are thriving, and you are paid a whole twenty dollars.', 'good', cash(20), hid('discipline', 3), hid('karma', 2))] },
      { label: 'Do it most days', outcomes: [any('The fish is fine. One plant is not. The neighbor is too polite to say.', 'neutral', cash(10))] },
      { label: 'Say you are too busy', outcomes: [any('They ask the kid next door, who buys a bike with the money.', 'neutral')] },
    ],
  },
  {
    id: 'kid_school_garden', category: 'childhood', ageRange: [6, 11], cooldown: 25, requires: [need('education.enrolled', '==', true)],
    text: 'Your class is planting a vegetable garden behind the school, and each child gets a row.',
    choices: [
      { label: 'Water it every day', outcomes: [any('Your carrots are small but real. You eat one, mud and all, and it is the best carrot ever grown.', 'good', hid('discipline', 3), st('health', 1), st('mood', 3))] },
      { label: 'Plant the biggest seeds you can find', outcomes: [any('A pumpkin, enormous and lopsided, that the whole class shares at Halloween.', 'good', st('mood', 5))] },
      { label: 'Dig for worms instead', outcomes: [any('You find forty-one. You are not asked to plant anything else.', 'neutral', st('intellect', 1))] },
    ],
  },
  {
    id: 'kid_magic_trick', category: 'childhood', ageRange: [6, 12], cooldown: 25,
    text: 'You have been given a small box of magic tricks: a vanishing coin, a rope that cuts and mends itself.',
    choices: [
      { label: 'Practice until you are perfect', check: chk(0.5, { 'hidden.discipline': 0.5 }), outcomes: [
        ok('At a family party you make a coin vanish from your uncle\'s ear. Nobody can work out how.', tal('acting', 2), st('charm', 3), st('mood', 4)),
        bad('The coin falls out of your sleeve every time. You decide magic is a long road.', st('mood', 1)),
      ] },
      { label: 'Work out how the tricks are done, then tell everyone', outcomes: [any('You ruin magic for your whole class. You are very pleased with yourself.', 'neutral', st('intellect', 2), st('charm', -1))] },
      { label: 'Lose the pieces in a week', outcomes: [any('The rope turns up in the dog\'s bed.', 'neutral')] },
    ],
  },
  {
    id: 'kid_kite_day', category: 'childhood', ageRange: [5, 11], cooldown: 25,
    text: 'A windy day, a hill, and a kite that someone in your family swears they used to fly as a child.',
    choices: [
      { label: 'Run with it until it lifts', outcomes: [any('It climbs and climbs, tugging at your hands. You stay until the light goes.', 'good', st('mood', 6), st('health', 1))] },
      { label: 'Let a grown-up get it up first', outcomes: [any('They run, puffing, and it goes up beautifully. Then they hand you the string.', 'good', st('mood', 4))] },
      { label: 'Fly it near the trees', outcomes: [any('The tree wins. It is still up there, as far as you know.', 'neutral', st('mood', -1))] },
    ],
  },
  {
    id: 'kid_chores_allowance', category: 'childhood', ageRange: [7, 12], cooldown: 25,
    text: 'A new rule at home: chores earn an allowance. There is a chart on the fridge with your name on it.',
    choices: [
      { label: 'Do every chore and save', outcomes: [any('A jar of coins on the shelf, growing. You learn what waiting for something feels like.', 'good', cash(15), hid('discipline', 4))] },
      { label: 'Do the chores and spend it all on candy', outcomes: [any('A sweet, sticky economy.', 'neutral', st('mood', 3), st('health', -1))] },
      { label: 'Negotiate better rates', check: chk(0.4, { 'stats.charm': 0.6 }), outcomes: [
        ok('You argue your way to a raise. A businessperson is born.', cash(20), st('charm', 2)),
        bad('Your rate is cut for cheek.', cash(5)),
      ] },
    ],
  },
  {
    id: 'kid_new_glasses', category: 'childhood', ageRange: [6, 12], cooldown: 40,
    text: 'The eye test says you need glasses. You are certain everyone at school is going to laugh.',
    choices: [
      { label: 'Choose bright, bold frames', outcomes: [any('Nobody laughs. Two people ask where you got them. And the board is suddenly sharp.', 'good', st('intellect', 2), st('mood', 3))] },
      { label: 'Wear them only in class', outcomes: [any('The board is clear, and the playground stays blurry for a while.', 'neutral', st('intellect', 1))] },
      { label: '"Lose" them on purpose', outcomes: [any('They are replaced within a week, and you are in trouble.', 'bad', st('mood', -2))] },
    ],
  },
  {
    id: 'kid_school_choir', category: 'childhood', ageRange: [6, 12], cooldown: 20, requires: [need('education.enrolled', '==', true)],
    text: 'The music teacher needs more voices for the end-of-year concert, and is looking straight at you.',
    choices: [
      { label: 'Join', outcomes: [any('Rehearsals every lunchtime, and on the night, your family waving from the third row.', 'good', tal('singing', 3), st('mood', 4))] },
      { label: 'Offer to help with the lights instead', outcomes: [any('You learn which switch does what, and the show goes on.', 'good', st('intellect', 2))] },
      { label: 'Hide in the bathroom', outcomes: [any('It works, this time.', 'neutral')] },
    ],
  },
  {
    id: 'kid_snow_day', category: 'childhood', ageRange: [5, 12], cooldown: 15,
    text: 'The radio says the schools are closed for snow. A whole free day, and the street is white.',
    choices: [
      { label: 'Build a snowman with the neighbors\' kids', outcomes: [any('He is taller than any grown-up and has a carrot for a nose and a sock for a scarf.', 'good', st('mood', 7), addNpc('friend', 'pal'))] },
      { label: 'Sled down the biggest hill', check: chk(0.6, { 'talents.sports': 0.3 }), outcomes: [
        ok('Fast and wild, and you never fall off once.', st('mood', 8)),
        bad('You fall off a lot. Every time is funnier than the last.', st('mood', 4), st('health', -1)),
      ] },
      { label: 'Stay in by the window with cocoa', outcomes: [any('A cozy day, watching everyone else get cold.', 'good', st('mood', 3))] },
    ],
  },

  {
    id: 'kid_lost_balloon', category: 'childhood', ageRange: [5, 8], cooldown: 30,
    text: 'At the fair, the string slips through your fingers and your red balloon floats up, up, and away over the rooftops.',
    choices: [
      { label: 'Wave goodbye to it', outcomes: [any('You decide it is going on an adventure, and wonder for weeks where it landed.', 'good', st('mood', 2))] },
      { label: 'Cry until a stranger buys you another', outcomes: [any('A kind stranger does exactly that. You hold the new string very, very tightly.', 'neutral', st('mood', 3))] },
      { label: 'Ask how balloons float', outcomes: [any('A grown-up tries to explain helium. You understand about half, and want to know more.', 'good', st('intellect', 2))] },
    ],
  },
  {
    id: 'kid_hide_and_seek', category: 'childhood', ageRange: [5, 10], cooldown: 15,
    text: 'A giant game of hide-and-seek with all the kids on the street. You have found the perfect hiding place.',
    choices: [
      { label: 'Stay hidden no matter what', outcomes: [any('Nobody finds you for an hour. When you come out, the game has long finished and everyone is eating ice pops. You won, though.', 'neutral', hid('willpower', 2), st('mood', 2))] },
      { label: 'Sneak back to base', check: chk(0.5, { 'talents.sports': 0.4 }), outcomes: [
        ok('Home free! You are the hero of the street.', st('mood', 6)),
        bad('Caught three steps from base. So close.', st('mood', 1)),
      ] },
      { label: 'Volunteer to be the seeker', outcomes: [any('You find everyone, including a cat that was not playing.', 'good', st('mood', 4))] },
    ],
  },

  // ---------- The twenties ----------
  {
    id: 'twenties_first_apartment', category: 'adult', ageRange: [18, 30], cooldown: 40, requires: [ownPlace],
    text: 'Your first place of your own: one room, one window, one wobbly table. The key is still shiny.',
    choices: [
      { label: 'Make it beautiful on almost nothing', outcomes: [any('Secondhand curtains, a plant, a lamp from a yard sale. It is small, and it is home.', 'good', cash(-60), st('mood', 6))] },
      { label: 'Throw a housewarming party', outcomes: [any('Twenty people in one room. A neighbor complains, and then joins in.', 'good', st('charm', 2), st('mood', 5))] },
      { label: 'Eat cereal for dinner for a month', outcomes: [any('Freedom tastes of cereal.', 'neutral', st('health', -1), st('mood', 2))] },
    ],
  },
  {
    id: 'twenties_roommate', category: 'adult', ageRange: [18, 30], cooldown: 20, requires: [ownPlace],
    text: 'Your roommate never washes a dish. The sink has become a kind of sculpture.',
    choices: [
      { label: 'Draw up a chore chart', check: chk(0.5, { 'stats.charm': 0.5 }), outcomes: [
        ok('Surprisingly, it works. The sink is visible again.', st('charm', 1), st('mood', 3)),
        bad('The chart is ignored, then used as a coaster.', st('mood', -2)),
      ] },
      { label: 'Put all their dishes on their bed', outcomes: [any('Message received. Things are frosty for a week, then much cleaner.', 'neutral', st('mood', 1))] },
      { label: 'Just wash everything yourself', outcomes: [any('A clean kitchen and a slow-burning grudge.', 'neutral', hid('karma', 1), st('mood', -1))] },
    ],
  },
  {
    id: 'twenties_cooking', category: 'adult', ageRange: [18, 32], cooldown: 25,
    text: 'You realize you can cook exactly three things, and one of them is toast.',
    choices: [
      { label: 'Learn one new recipe a week', check: chk(0.55, { 'hidden.discipline': 0.5 }), outcomes: [
        ok('A year later you can cook for eight people without panicking. Friends start inviting themselves round.', st('health', 2), st('charm', 2), hid('discipline', 2)),
        bad('Week four is a smoke alarm. Week five is takeout.', st('mood', -1)),
      ] },
      { label: 'Call home for the family recipes', outcomes: [any('A long call, a notebook full of instructions in a familiar voice, and a meal that tastes like being small.', 'good', st('mood', 5))] },
      { label: 'Toast is a perfectly good dinner', outcomes: [any('It is, until it is not.', 'neutral', st('health', -1))] },
    ],
  },
  {
    id: 'twenties_concert', category: 'adult', ageRange: [16, 35], cooldown: 12, requires: [has(80)],
    text: 'The band you have loved since you were fifteen is playing in town, and tickets go on sale tomorrow morning.',
    choices: [
      { label: 'Get up early and get tickets', check: chk(0.5), outcomes: [
        ok('Front of the crowd, every word, a voice gone hoarse by the end. Worth it.', cash(-70), st('mood', 9)),
        bad('Sold out in four minutes. You listen to the live recording later, which is not the same.', st('mood', -3)),
      ] },
      { label: 'Go with friends, from the back', outcomes: [any('You cannot see much, and it does not matter at all.', 'good', cash(-50), st('mood', 6))] },
      { label: 'Skip it, they will tour again', outcomes: [any('They do not tour again.', 'neutral', st('mood', -2))] },
    ],
  },
  {
    id: 'twenties_road_trip', category: 'adult', ageRange: [18, 32], cooldown: 20, requires: [has(200)],
    text: 'A friend has a car, a week off and a map. "Where shall we go?"',
    choices: [
      { label: 'Anywhere, no plan', outcomes: [any('Diners, a flat tire, a lake at dawn, a town you will never find again. A week you will talk about forever.', 'good', cash(-180), st('mood', 9), ms('Went on a road trip with no plan.'))] },
      { label: 'Plan every stop', outcomes: [any('Everything goes to plan, which is its own kind of satisfying.', 'good', cash(-180), st('mood', 5), hid('discipline', 1))] },
      { label: 'Say you cannot afford the time', outcomes: [any('They send you photos from every stop.', 'neutral', st('mood', -2))] },
    ],
  },
  {
    id: 'twenties_first_suit', category: 'adult', ageRange: [18, 30], cooldown: 30, requires: [has(150)],
    text: 'You have a job interview next week, and you own nothing that looks remotely like a grown-up.',
    choices: [
      { label: 'Buy one good outfit and look after it', outcomes: [any('It fits, it is yours, and you stand differently in it.', 'good', cash(-150), st('charm', 2), st('mood', 3))] },
      { label: 'Borrow from a friend', outcomes: [any('Slightly too long in the sleeves. You roll them and hope.', 'neutral', st('mood', 1))] },
      { label: 'Go as you are', outcomes: [any('It might not matter. It might.', 'neutral')] },
    ],
  },
  {
    id: 'twenties_big_city', category: 'adult', ageRange: [18, 30], cooldown: 30,
    text: 'A friend who moved to the big city keeps saying you should come and visit. Their couch, they promise, is "basically a bed".',
    choices: [
      { label: 'Go for a long weekend', requires: [has(150)], outcomes: [any('Museums, late nights, a rooftop at dawn. You come home wondering about your own life, in a good way.', 'good', cash(-140), st('mood', 7), st('intellect', 1))] },
      { label: 'Invite them to visit you instead', outcomes: [any('They come, and see your town through new eyes, which helps you see it too.', 'good', st('mood', 4))] },
      { label: 'Keep putting it off', outcomes: [any('"One day," you both say.', 'neutral')] },
    ],
  },
  {
    id: 'twenties_volunteer_abroad', category: 'adult', ageRange: [18, 30], cooldown: 40, requires: [has(500)],
    text: 'A leaflet at the library: volunteers wanted for a summer building a school in another country.',
    choices: [
      { label: 'Sign up', outcomes: [any('A hot, hard, wonderful summer. You learn to mix concrete and say thank you in a new language.', 'good', cash(-450), hid('karma', 8), st('health', 2), ms('Spent a summer building a school abroad.'))] },
      { label: 'Raise money for them instead', outcomes: [any('A sponsored swim and a cake sale. You send off a satisfying check.', 'good', hid('karma', 4))] },
      { label: 'Not this year', outcomes: [any('The leaflet stays pinned to your fridge for a long time.', 'neutral')] },
    ],
  },
  {
    id: 'twenties_learn_drive', category: 'adult', ageRange: [17, 30], cooldown: 30, requires: [has(200)],
    text: 'Everyone you know seems to be able to drive. You have been putting off lessons for years.',
    choices: [
      { label: 'Book lessons and take the test', check: chk(0.55, { 'hidden.discipline': 0.4, 'stats.intellect': 0.3 }), outcomes: [
        ok('You pass first time. The examiner almost smiles.', cash(-200), st('mood', 6), ms('Passed the driving test.')),
        bad('You fail on parallel parking. You pass on the second try, a month later.', cash(-260), st('mood', 2)),
      ] },
      { label: 'Ask a relative to teach you', outcomes: [any('Several tense Sunday afternoons in a parking lot. You learn, and you are both still speaking.', 'good', st('mood', 2))] },
      { label: 'Keep taking the bus', outcomes: [any('You read a lot of books on buses.', 'neutral', st('intellect', 1))] },
    ],
  },
  {
    id: 'twenties_payday_splurge', workplaces: AT.colleagues, category: 'money', ageRange: [18, 32], cooldown: 15, requires: [employed, has(200)],
    text: 'Payday, and for once there is a little left over after the rent.',
    choices: [
      { label: 'Start a savings account', outcomes: [any('A small amount, every month, quietly growing. The beginning of something.', 'good', hid('discipline', 4))] },
      { label: 'Treat yourself to something nice', outcomes: [any('New shoes. You love them.', 'good', cash(-100), st('mood', 5))] },
      { label: 'Take everyone out', outcomes: [any('A big night, a happy table, and a much smaller balance.', 'neutral', cash(-180), st('charm', 2), st('mood', 5))] },
    ],
  },
  {
    id: 'twenties_gym_join', category: 'health', ageRange: [18, 35], cooldown: 15, requires: [has(100)],
    text: 'A gym has opened at the end of your street, with a "first month free" banner across the door.',
    choices: [
      { label: 'Join, and go three times a week', check: chk(0.45, { 'hidden.discipline': 0.7 }), outcomes: [
        ok('It becomes a habit. You feel stronger, sleep better and are slightly smug.', st('health', 5), hid('discipline', 3)),
        bad('You go eight times in the free month and never again. You keep paying for half a year.', cash(-90), st('mood', -1)),
      ] },
      { label: 'Run in the park instead, for free', outcomes: [any('Cold mornings, slowly getting easier.', 'good', st('health', 3))] },
      { label: 'Walk past every day and think about it', outcomes: [any('Thinking about it burns very few calories.', 'neutral')] },
    ],
  },
  {
    id: 'twenties_old_friend_wedding_speech', category: 'friends', ageRange: [22, 35], cooldown: 25, cast: { pal: 'friend' },
    text: '{pal} is getting married and wants you to give a speech. In front of everyone. With a microphone.',
    choices: [
      { label: 'Write something heartfelt', check: chk(0.5, { 'stats.charm': 0.6, 'stats.intellect': 0.3 }), outcomes: [
        ok('Laughter in the right places and a few tears at the end. {pal} hugs you hard.', rel('pal', 12), st('charm', 3), st('mood', 6)),
        bad('Your hands shake and you lose your place, but {pal} squeezes your arm afterward and says it was perfect.', rel('pal', 6), st('mood', 1)),
      ] },
      { label: 'Tell the most embarrassing story you know', outcomes: [any('The room loves it. {pal}\'s new in-laws are less sure.', 'neutral', rel('pal', 2), st('charm', 1))] },
      { label: 'Say you are not a public speaker', outcomes: [any('{pal} understands, and asks someone else. You clap the loudest.', 'neutral', rel('pal', -3))] },
    ],
  },
  {
    id: 'twenties_quarter_life', category: 'adult', ageRange: [24, 30], cooldown: 40,
    text: 'Lying awake one night, you wonder if you are doing anything right with your life.',
    choices: [
      { label: 'Write down what you actually want', outcomes: [any('A short list, surprisingly clear. It points somewhere.', 'good', hid('willpower', 3), st('mood', 3))] },
      { label: 'Call someone older and ask', outcomes: [any('"Nobody knows what they are doing at your age," they say. "Or at mine." It helps.', 'good', st('mood', 4))] },
      { label: 'Decide it will sort itself out', outcomes: [any('It mostly does.', 'neutral')] },
    ],
  },

  // ---------- The long middle (30 to 49) ----------
  {
    id: 'mid_home_repair', category: 'everyday', ageRange: [25, 75], cooldown: 15, requires: [ownPlace],
    text: 'A dripping faucet has been keeping you awake for a week.',
    choices: [
      { label: 'Fix it yourself', check: chk(0.5, { 'stats.intellect': 0.4 }), outcomes: [
        ok('A new washer, ten minutes, and blissful silence. You feel like a genius.', st('mood', 4), st('intellect', 1)),
        bad('It drips faster now, and the handle comes off in your hand. A plumber is called.', cash(-120), st('mood', -3)),
      ] },
      { label: 'Call a plumber', requires: [has(100)], outcomes: [any('Fixed in five minutes, for a sum that makes you consider retraining.', 'neutral', cash(-90))] },
      { label: 'Put a towel under it', outcomes: [any('A towel, then a bucket. The drip wins.', 'neutral', st('mood', -2))] },
    ],
  },
  {
    id: 'mid_class_reunion_online', category: 'friends', ageRange: [30, 55], cooldown: 20,
    text: 'You find an old school friend online. Their life looks perfect in every photo.',
    choices: [
      { label: 'Send a warm message', outcomes: [any('They write back at length. Life, it turns out, has been hard for them too. You arrange to meet.', 'good', addNpc('friend', 'pal'), st('mood', 4))] },
      { label: 'Scroll through every picture', outcomes: [any('An hour later you feel worse about everything. Photos are not lives.', 'bad', st('mood', -4))] },
      { label: 'Close the page', outcomes: [any('A wise move.', 'neutral')] },
    ],
  },
  {
    id: 'mid_midlife_instrument', category: 'everyday', ageRange: [30, 70], cooldown: 25, requires: [has(200)],
    text: 'You have always wanted to play the piano. A secondhand one is for sale down the street, cheap, if you can move it.',
    choices: [
      { label: 'Buy it and take lessons', check: chk(0.45, { 'hidden.discipline': 0.5, 'talents.music': 0.4 }), outcomes: [
        ok('A year later you can play a whole song, badly and with great feeling.', cash(-200), tal('music', 4), st('mood', 6)),
        bad('It becomes a very expensive shelf for photographs.', cash(-200), st('mood', -1)),
      ] },
      { label: 'Learn on a cheap keyboard first', outcomes: [any('Headphones on, late at night. Slowly, it starts to sound like music.', 'good', cash(-60), tal('music', 2), st('mood', 3))] },
      { label: 'Let it go to someone else', outcomes: [any('A family with three children takes it. You hear it through the wall sometimes.', 'neutral')] },
    ],
  },
  {
    id: 'mid_tired_all_time', category: 'health', ageRange: [30, 60], cooldown: 15,
    text: 'You have been tired for weeks: not sleepy, just worn thin.',
    choices: [
      { label: 'See a doctor', requires: [has(50)], outcomes: [any('A blood test, low iron, a simple fix. A month later you feel like yourself again.', 'good', cash(-40), st('health', 4), st('mood', 3))] },
      { label: 'Go to bed an hour earlier every night', outcomes: [any('Dull advice, and it helps more than you expected.', 'good', st('health', 2), hid('discipline', 2))] },
      { label: 'More coffee', outcomes: [any('More coffee, less sleep, more tired. A circle.', 'bad', st('health', -2), st('mood', -2))] },
    ],
  },
  {
    id: 'mid_career_doubt', workplaces: AT.colleagues, category: 'adult', ageRange: [32, 52], cooldown: 25, requires: [employed],
    text: 'On a Sunday evening, you realize you are dreading Monday, and that you have been dreading Mondays for a long time.',
    choices: [
      { label: 'Talk to someone about a change', outcomes: [any('A long conversation with a friend who switched careers at forty. It does not answer anything, but it opens a door.', 'good', hid('willpower', 3), st('mood', 3))] },
      { label: 'Find something to love outside work', outcomes: [any('A Saturday class, a team, a project. Monday is still Monday, but the week is bigger.', 'good', st('mood', 4))] },
      { label: 'Keep your head down', outcomes: [any('The dread settles in like an old coat.', 'neutral', st('mood', -3))] },
    ],
  },
  {
    id: 'mid_parent_call', category: 'family', ageRange: [30, 60], cooldown: 15, cast: { mother: 'mother' },
    text: '{mother} calls for no particular reason, just to chat. You are in the middle of something.',
    choices: [
      { label: 'Stop and talk properly', outcomes: [any('Forty minutes about nothing much. You hang up feeling oddly lighter.', 'good', rel('mother', 6), st('mood', 3))] },
      { label: 'Promise to call back', outcomes: [any('You do call back, two days later. It is fine.', 'neutral', rel('mother', 1))] },
      { label: 'Let it go to voicemail', outcomes: [any('The message is short and cheerful. You keep meaning to call.', 'neutral', rel('mother', -3))] },
    ],
  },
  {
    id: 'mid_car_trouble_trip', category: 'everyday', ageRange: [25, 75], cooldown: 20, requires: [has(200)],
    text: 'On a long drive, the car starts making a noise like a coffee grinder, miles from anywhere.',
    choices: [
      { label: 'Limp to the nearest town', outcomes: [any('A small garage, a slow mechanic, and an unplanned night in a town with one diner. You love it.', 'good', cash(-180), st('mood', 3))] },
      { label: 'Keep driving and hope', check: chk(0.4), outcomes: [
        ok('The noise stops by itself. You will never know.', st('mood', 2)),
        bad('It gets worse, then stops, and so do you. A tow truck, and a much bigger bill.', cash(-400), st('mood', -4)),
      ] },
      { label: 'Call for roadside help', outcomes: [any('Two hours on the shoulder, watching the clouds. Not the worst afternoon.', 'neutral', cash(-60))] },
    ],
  },
  {
    id: 'mid_lost_luggage', category: 'everyday', ageRange: [20, 85], cooldown: 25, requires: [has(300)],
    text: 'You arrive for a trip. Your suitcase does not.',
    choices: [
      { label: 'Fill in the forms and buy the basics', outcomes: [any('Three days in the same clothes and a cheap toothbrush. The bag arrives on the last morning.', 'neutral', cash(-80), st('mood', -2))] },
      { label: 'Make it an adventure', outcomes: [any('You buy a few local clothes from a market and feel like a different person for a week.', 'good', cash(-60), st('mood', 4))] },
      { label: 'Argue at the desk for an hour', check: chk(0.4, { 'stats.charm': 0.5 }), outcomes: [
        ok('A voucher and a promise. The bag is delivered to your door that night.', st('mood', 2)),
        bad('An hour of your vacation, gone, and no bag.', st('mood', -4)),
      ] },
    ],
  },
  {
    id: 'mid_neighbor_noise_baby', category: 'everyday', ageRange: [20, 80], cooldown: 20,
    text: 'The new neighbors\' baby cries through the wall every night at three in the morning.',
    choices: [
      { label: 'Drop round some earplugs and a kind note', outcomes: [any('They are mortified and grateful. You become the neighbors who understand.', 'good', hid('karma', 4), st('mood', 1))] },
      { label: 'Offer to watch the baby for an hour', outcomes: [any('The exhausted parents sleep for the first time in weeks. They will never forget it.', 'good', hid('karma', 8), st('mood', 3))] },
      { label: 'Bang on the wall', outcomes: [any('The baby does not understand. The parents do, and say nothing to you for a year.', 'bad', hid('karma', -4))] },
    ],
  },
  {
    id: 'mid_school_volunteer', category: 'everyday', ageRange: [28, 60], cooldown: 15,
    text: 'The local school needs grown-ups to listen to children read, one afternoon a week.',
    choices: [
      { label: 'Volunteer', outcomes: [any('A small boy who could not read a sentence in September reads you a whole page in June. You walk home grinning.', 'good', hid('karma', 6), st('mood', 5))] },
      { label: 'Donate books instead', outcomes: [any('A box of favorites from your own childhood, given away with a pang.', 'good', hid('karma', 2))] },
      { label: 'Say you do not have the time', outcomes: [any('You probably do not.', 'neutral')] },
    ],
  },
  {
    id: 'mid_spring_clean', category: 'everyday', ageRange: [25, 85], cooldown: 15, requires: [ownPlace],
    text: 'You open a cupboard and an avalanche of things you do not need falls out.',
    choices: [
      { label: 'Clear out everything, ruthlessly', outcomes: [any('Six bags to charity, two to the dump. You feel ten pounds lighter.', 'good', hid('karma', 2), st('mood', 5), hid('discipline', 2))] },
      { label: 'Sell the good things', outcomes: [any('A weekend of selling. A decent sum, and a lot of haggling.', 'good', cash(120), st('mood', 2))] },
      { label: 'Close the cupboard quickly', outcomes: [any('The avalanche waits for next time.', 'neutral')] },
    ],
  },
  {
    id: 'mid_family_tree', category: 'family', ageRange: [30, 85], cooldown: 30,
    text: 'An aunt sends you a page she has been working on for years: your family tree, with gaps.',
    choices: [
      { label: 'Help fill in the gaps', outcomes: [any('Old records, an archive, a cousin you never knew existed. A great-great-grandparent who crossed an ocean alone.', 'good', st('intellect', 3), st('mood', 4), ms('Traced the family tree.'))] },
      { label: 'Frame it for the wall', outcomes: [any('It hangs in the hallway, and visitors always stop to read it.', 'good', st('mood', 2))] },
      { label: 'Put it in a drawer', outcomes: [any('Maybe when you have more time.', 'neutral')] },
    ],
  },
  {
    id: 'mid_stranger_compliment', category: 'everyday', ageRange: [16, 90], cooldown: 12,
    text: 'A stranger on the train leans over and says, "I just wanted to say, that color really suits you."',
    choices: [
      { label: 'Thank them warmly', outcomes: [any('It carries you through the whole day.', 'good', st('mood', 5))] },
      { label: 'Pay a compliment back', outcomes: [any('Two strangers, both smiling, both a little embarrassed. A good morning.', 'good', st('charm', 1), st('mood', 4))] },
      { label: 'Wonder what they wanted', outcomes: [any('Nothing at all. You still wonder.', 'neutral')] },
    ],
  },
  {
    id: 'mid_hospital_visit_friend', category: 'friends', ageRange: [25, 85], cooldown: 15, cast: { pal: 'friend' },
    text: '{pal} is in the hospital for a few days after a minor operation, and says they are bored out of their mind.',
    choices: [
      { label: 'Visit with games and gossip', outcomes: [any('Two hours of cards and terrible hospital tea. {pal} says it was the best part of the week.', 'good', rel('pal', 10), st('mood', 3))] },
      { label: 'Send a care package', outcomes: [any('Magazines, chocolate and a very silly card. {pal} sends a photo of themselves wearing the paper hat.', 'good', cash(-30), rel('pal', 5))] },
      { label: 'Send a message', outcomes: [any('A short message, a short reply.', 'neutral', rel('pal', 1))] },
    ],
  },
  {
    id: 'mid_restaurant_proposal', category: 'everyday', ageRange: [20, 80], cooldown: 15,
    text: 'At the next table in a restaurant, someone is down on one knee. The whole room holds its breath.',
    choices: [
      { label: 'Start the applause', outcomes: [any('They said yes. The whole room cheers, and you started it.', 'good', st('mood', 4))] },
      { label: 'Send a bottle of something over', requires: [has(60)], outcomes: [any('They raise their glasses to you across the room. A small, perfect moment.', 'good', cash(-40), hid('karma', 2), st('mood', 4))] },
      { label: 'Keep eating, politely', outcomes: [any('A private moment, left private.', 'neutral')] },
    ],
  },
  {
    id: 'mid_jury_of_cake', category: 'everyday', ageRange: [18, 90], cooldown: 15,
    text: 'You have been asked to judge the baking competition at the local fair. There are twenty-two cakes.',
    choices: [
      { label: 'Judge fairly and carefully', outcomes: [any('Twenty-two slices. A worthy winner. You do not eat again for two days.', 'good', hid('karma', 2), st('health', -1), st('mood', 4))] },
      { label: 'Give the prize to the oldest baker', outcomes: [any('She is ninety-one, and it is her first win in sixty years of entering. The crowd goes wild.', 'good', hid('karma', 4), st('mood', 5))] },
      { label: 'Find an excuse', outcomes: [any('Someone else gets the cake.', 'neutral')] },
    ],
  },
  {
    id: 'mid_wildlife_garden', category: 'everyday', ageRange: [20, 95], cooldown: 15,
    text: 'A hedgehog has started visiting your garden every evening, snuffling under the bushes.',
    choices: [
      { label: 'Leave out water and a little food', outcomes: [any('It comes back every night, then brings a friend. You start a notebook.', 'good', st('mood', 5), hid('karma', 2))] },
      { label: 'Build it a little shelter', outcomes: [any('A box of leaves under the hedge. It moves in for the winter.', 'good', st('mood', 6))] },
      { label: 'Leave it be', outcomes: [any('It is wild, and happier that way.', 'neutral', st('mood', 1))] },
    ],
  },
  {
    id: 'mid_wrong_bus', category: 'everyday', ageRange: [14, 90], cooldown: 15,
    text: 'Lost in thought, you get on the wrong bus. By the time you notice, you are on the far side of the city.',
    choices: [
      { label: 'Get off and explore', outcomes: [any('A street market, a café, a park you never knew existed. A happy accident.', 'good', st('mood', 5))] },
      { label: 'Ride it back', outcomes: [any('An hour late, and you have seen a lot of the city through a window.', 'neutral', st('mood', -1))] },
      { label: 'Ask the driver for help', outcomes: [any('They point out the right stop, and tell you their own wrong-bus story.', 'good', st('mood', 2))] },
    ],
  },
  {
    id: 'mid_old_flame_sighting', category: 'everyday', ageRange: [28, 75], cooldown: 25,
    text: 'Across a crowded square, you see someone you loved long ago. They have not seen you yet.',
    choices: [
      { label: 'Go and say hello', outcomes: [any('Ten minutes of catching up, warm and a little strange. You both walk away smiling.', 'good', st('mood', 4))] },
      { label: 'Watch them go', outcomes: [any('A small ache, and then the day goes on.', 'neutral', st('mood', -1))] },
      { label: 'Duck into a shop', outcomes: [any('You buy something you do not need, to look busy.', 'neutral', cash(-15))] },
    ],
  },
  {
    id: 'mid_first_aid_course', category: 'health', ageRange: [18, 70], cooldown: 30,
    text: 'A free first aid course is running at the community hall on Saturday.',
    choices: [
      { label: 'Take it', outcomes: [any('You learn what to do when someone collapses, and how to keep calm. You hope you never need it.', 'good', st('intellect', 2), hid('karma', 2), ms('Learned first aid.'))] },
      { label: 'Take it with a friend', outcomes: [any('You practice on each other and cannot stop laughing, but you learn it.', 'good', st('intellect', 1), st('mood', 3))] },
      { label: 'Spend Saturday in bed', outcomes: [any('A restful Saturday.', 'neutral', st('mood', 1))] },
    ],
  },
  {
    id: 'mid_work_trip', workplaces: AT.colleagues, category: 'work', ageRange: [24, 62], cooldown: 12, requires: [employed],
    text: 'Work is sending you to a conference in another city for three days, all paid.',
    choices: [
      { label: 'Go to every session and meet everyone', outcomes: [any('A notebook full of ideas and a pocket full of business cards. You come back with plans.', 'good', perf(5), st('intellect', 2))] },
      { label: 'Go to some sessions and see the city', outcomes: [any('A balance. You learn a little and see a lot.', 'good', perf(1), st('mood', 5))] },
      { label: 'Ask someone else to go instead', outcomes: [any('They come back full of ideas. Your boss notices who went.', 'neutral', perf(-2))] },
    ],
  },
  {
    id: 'mid_coworker_baby', workplaces: AT.colleagues, category: 'work', ageRange: [20, 65], cooldown: 12, requires: [employed],
    text: 'A coworker is going on parental leave, and the team is planning a little surprise.',
    choices: [
      { label: 'Organize the whole thing', outcomes: [any('A cake, a card everyone signed and a tiny hat. The coworker cries.', 'good', st('charm', 2), hid('karma', 3), perf(1))] },
      { label: 'Chip in for the gift', outcomes: [any('A share of a stroller. Everyone feels good.', 'good', cash(-15), hid('karma', 1))] },
      { label: 'Sign the card and go back to work', outcomes: [any('"Congratulations!" in your best handwriting.', 'neutral')] },
    ],
  },
  {
    id: 'mid_desk_plant', workplaces: AT.colleagues, category: 'work', ageRange: [18, 65], cooldown: 15, requires: [employed],
    text: 'The office plant everyone forgets to water is dying, and nobody will take responsibility for it.',
    choices: [
      { label: 'Adopt it', outcomes: [any('Six months later it is enormous. People come by your desk just to see it.', 'good', st('mood', 3), st('charm', 1))] },
      { label: 'Start a watering schedule', outcomes: [any('The schedule lasts two weeks. The plant survives anyway, somehow.', 'neutral', hid('discipline', 1))] },
      { label: 'Let nature take its course', outcomes: [any('It does.', 'neutral')] },
    ],
  },
  {
    id: 'mid_fire_drill', workplaces: AT.colleagues, category: 'work', ageRange: [18, 65], cooldown: 12, requires: [employed],
    text: 'The fire alarm goes off in the middle of the most important meeting of the month. It is probably a drill.',
    choices: [
      { label: 'Lead everyone out calmly', outcomes: [any('It was a drill, and you were the only one who knew where the assembly point was.', 'good', perf(2), st('charm', 1))] },
      { label: 'Finish your sentence first', outcomes: [any('The fire warden gives you a look you will remember.', 'neutral', perf(-1))] },
      { label: 'Use it as a coffee break', outcomes: [any('Twenty minutes in the sunshine with people from other floors. You meet someone interesting.', 'good', st('mood', 3))] },
    ],
  },
  {
    id: 'mid_long_weekend', category: 'everyday', ageRange: [22, 80], cooldown: 12,
    text: 'A long weekend with nothing planned. Three whole days.',
    choices: [
      { label: 'Do absolutely nothing', outcomes: [any('Books, naps, long breakfasts. You go back to the week rested for once.', 'good', st('mood', 5), st('health', 1))] },
      { label: 'Finally tackle the jobs you have been putting off', outcomes: [any('A painted fence, a sorted drawer, a fixed shelf. Satisfying.', 'good', hid('discipline', 3), st('mood', 2))] },
      { label: 'Say yes to every invitation', outcomes: [any('Three parties, two barbecues and a christening. You need another weekend to recover.', 'neutral', st('charm', 2), st('health', -1))] },
    ],
  },
  {
    id: 'mid_photo_album', category: 'everyday', ageRange: [30, 90], cooldown: 20,
    text: 'You come across an old photo album full of faces from twenty years ago.',
    choices: [
      { label: 'Call someone from the photos', outcomes: [any('"I was just thinking about you," they say, which is never quite true and always lovely.', 'good', st('mood', 5))] },
      { label: 'Sit and look for an hour', outcomes: [any('Hairstyles, parties, people long gone. A warm, sad, good hour.', 'neutral', st('mood', 2))] },
      { label: 'Put it back unopened', outcomes: [any('Another day.', 'neutral')] },
    ],
  },
  {
    id: 'mid_sudden_rain_wedding', category: 'everyday', ageRange: [18, 85], cooldown: 20,
    text: 'An outdoor wedding you are attending is hit by a sudden thunderstorm. Everyone runs for the barn.',
    choices: [
      { label: 'Start the dancing in the barn', outcomes: [any('The best wedding anyone has ever been to, everyone agrees, soaked and laughing.', 'good', st('charm', 2), st('mood', 7))] },
      { label: 'Help move the food inside', outcomes: [any('You save the cake. The couple will never forget it.', 'good', hid('karma', 3), st('mood', 3))] },
      { label: 'Stay in the car until it passes', outcomes: [any('Dry, and you miss the best part.', 'neutral')] },
    ],
  },

  {
    id: 'mid_power_of_no', category: 'adult', ageRange: [28, 60], cooldown: 20,
    text: 'You have said yes to so many favors this month that your own life has disappeared under them.',
    choices: [
      { label: 'Start saying no, kindly', check: chk(0.5, { 'hidden.willpower': 0.6 }), outcomes: [
        ok('The first no is the hardest. By the fifth, people still like you, and you have your evenings back.', hid('willpower', 4), st('mood', 5)),
        bad('You say no once, feel terrible, and say yes to two more things to make up for it.', st('mood', -2)),
      ] },
      { label: 'Keep a free evening sacred every week', outcomes: [any('Thursday is yours. Nobody gets Thursday.', 'good', st('mood', 4), hid('discipline', 2))] },
      { label: 'Carry on as before', outcomes: [any('Everyone is grateful. You are exhausted.', 'neutral', hid('karma', 2), st('health', -1))] },
    ],
  },
  {
    id: 'mid_neighbor_wifi_name', category: 'everyday', ageRange: [18, 80], cooldown: 25,
    text: 'You notice your neighbor\'s internet network has been renamed to something very pointed about your music.',
    choices: [
      { label: 'Rename yours with a friendly reply', outcomes: [any('A week of networks trading jokes. You end up meeting on the stairs, laughing.', 'good', st('charm', 2), st('mood', 4))] },
      { label: 'Turn the music down', outcomes: [any('The next day, their network is renamed "Thank You".', 'good', hid('karma', 2), st('mood', 2))] },
      { label: 'Turn it up', outcomes: [any('A long, petty, silent war of network names.', 'neutral', st('mood', -1))] },
    ],
  },

  // ---------- Later life (50 to 80) ----------
  {
    id: 'later_grandkid_question', category: 'later life', ageRange: [55, 90], cooldown: 15, requires: [need('roles', 'has', 'grandchild')],
    text: 'A grandchild asks you, very seriously, what the world was like "in the olden days".',
    choices: [
      { label: 'Tell them a real story from your childhood', outcomes: [any('They listen with their mouth open. Later you hear them telling it to a friend, with improvements.', 'good', st('mood', 6))] },
      { label: 'Say there were dinosaurs', outcomes: [any('They believe you for a whole week.', 'good', st('mood', 4))] },
      { label: 'Say it was much the same, really', outcomes: [any('They look disappointed. You think about it later and realize it was not true.', 'neutral')] },
    ],
  },
  {
    id: 'later_learn_tech', category: 'later life', ageRange: [55, 95], cooldown: 25,
    text: 'Everyone keeps saying you should get a computer and learn to use it properly.',
    choices: [
      { label: 'Take a class at the library', outcomes: [any('Six Thursdays with patient young volunteers. You can now send photographs to the whole family, and do.', 'good', st('intellect', 3), st('mood', 3))] },
      { label: 'Ask a teenager in the family', outcomes: [any('They go much too fast, but you get there. They are surprisingly kind about it.', 'good', st('intellect', 2))] },
      { label: 'You have managed without it so far', outcomes: [any('And you will go on managing.', 'neutral')] },
    ],
  },
  {
    id: 'later_choir_join', category: 'later life', ageRange: [50, 90], cooldown: 25,
    text: 'A community choir meets every Tuesday in the church hall. No auditions, everyone welcome.',
    choices: [
      { label: 'Join', outcomes: [any('You sing alto, badly at first, then not badly at all. Tuesdays become the best night of the week.', 'good', tal('singing', 3), st('mood', 7), addNpc('friend', 'pal'))] },
      { label: 'Go to one of their concerts', outcomes: [any('A lovely evening, and you find yourself humming the songs for days.', 'good', st('mood', 3))] },
      { label: 'Not your kind of thing', outcomes: [any('Fair enough.', 'neutral')] },
    ],
  },
  {
    id: 'later_walking_group', category: 'later life', ageRange: [50, 90], cooldown: 20,
    text: 'A notice in the doctor\'s waiting room: a walking group meets every Saturday morning, all paces welcome.',
    choices: [
      { label: 'Go along', outcomes: [any('Five miles, a lot of talk, and a café at the end. You go every week for years.', 'good', st('health', 4), st('mood', 4), addNpc('friend', 'pal'))] },
      { label: 'Walk on your own instead', outcomes: [any('Your own route, at your own pace. It becomes the best part of the day.', 'good', st('health', 3))] },
      { label: 'Maybe in the spring', outcomes: [any('Spring comes and goes.', 'neutral')] },
    ],
  },
  {
    id: 'later_downsizing_thoughts', category: 'later life', ageRange: [58, 85], cooldown: 25, requires: [ownPlace],
    text: 'The house feels very big these days. You catch yourself looking at smaller places for sale.',
    choices: [
      { label: 'Start sorting a lifetime of things', outcomes: [any('A slow year of letting go, and finding things you had forgotten you loved.', 'good', st('mood', 3), hid('discipline', 2))] },
      { label: 'Ask the family what they think', outcomes: [any('Everyone has an opinion. In the end it is yours that matters.', 'neutral', st('mood', 1))] },
      { label: 'Stay put, it is home', outcomes: [any('Every room has a story. You are not ready to leave them.', 'neutral', st('mood', 1))] },
    ],
  },
  {
    id: 'later_young_neighbor_help', category: 'later life', ageRange: [60, 95], cooldown: 15,
    text: 'The young family next door offers to do your shopping every week, now that the winter is here.',
    choices: [
      { label: 'Accept, gratefully', outcomes: [any('Every Saturday they bring the bags and stay for tea. The children start calling you by a nickname.', 'good', st('mood', 5))] },
      { label: 'Accept, and teach the children to bake in return', outcomes: [any('Your famous recipe, passed on. The kitchen is a mess and full of laughter.', 'good', st('mood', 6), hid('karma', 3))] },
      { label: 'Say you can manage', outcomes: [any('You can. They offer again in the spring.', 'neutral')] },
    ],
  },
  {
    id: 'later_old_hobby', category: 'later life', ageRange: [50, 90], cooldown: 25,
    text: 'Clearing out the attic, you find your old paints, still in their tin from forty years ago.',
    choices: [
      { label: 'Start painting again', outcomes: [any('Your hands remember more than you expected. The kitchen table becomes a studio.', 'good', st('mood', 6), hid('willpower', 2))] },
      { label: 'Give them to a grandchild or young neighbor', outcomes: [any('A small artist is born, covered in paint.', 'good', hid('karma', 3), st('mood', 3))] },
      { label: 'Put them back', outcomes: [any('One day.', 'neutral')] },
    ],
  },
  {
    id: 'later_birthday_surprise', category: 'later life', ageRange: [55, 95], cooldown: 15,
    text: 'You walk into the café for a quiet coffee and a crowd of people jump out shouting "Surprise!"',
    choices: [
      { label: 'Laugh and hug everyone', outcomes: [any('Friends from every part of your life in one room. You keep looking around, amazed.', 'good', st('mood', 9))] },
      { label: 'Pretend you knew all along', outcomes: [any('Nobody believes you. Everyone loves you for trying.', 'good', st('charm', 1), st('mood', 6))] },
      { label: 'Clutch your heart and sit down', outcomes: [any('You are fine. It takes a slice of cake to recover.', 'neutral', st('mood', 4))] },
    ],
  },
  {
    id: 'later_memoir_class', category: 'later life', ageRange: [55, 95], cooldown: 25,
    text: 'The library is running a class on writing your life story for your family.',
    choices: [
      { label: 'Sign up and write it', outcomes: [any('Sixty pages, typed up by a grandchild and copied for the whole family. They read it at Christmas.', 'good', st('intellect', 2), st('mood', 6), ms('Wrote down the story of a life.'))] },
      { label: 'Record yourself telling the stories instead', outcomes: [any('Hours of tapes, in your own voice. The family will treasure them.', 'good', st('mood', 4))] },
      { label: 'Some stories are better left untold', outcomes: [any('You smile and keep them.', 'neutral')] },
    ],
  },
  {
    id: 'later_bus_pass', category: 'later life', ageRange: [60, 70], cooldown: 99,
    text: 'You are now old enough for free bus travel. The pass arrives with a photo of you that you do not recognize.',
    choices: [
      { label: 'Ride every route in the city', outcomes: [any('A summer of exploring: the end of every line, the farthest café, the strangest suburb. A small adventure every week.', 'good', st('mood', 6))] },
      { label: 'Use it to visit friends more often', outcomes: [any('Tuesdays with one, Thursdays with another. Free travel turns into a fuller life.', 'good', st('mood', 4))] },
      { label: 'Keep driving everywhere', outcomes: [any('The pass lives in a drawer.', 'neutral')] },
    ],
  },
  {
    id: 'later_garden_competition', category: 'later life', ageRange: [50, 90], cooldown: 20, requires: [ownPlace],
    text: 'Your town is holding a "best front garden" competition, and your roses are the best they have ever been.',
    choices: [
      { label: 'Enter, and work on it every day', check: chk(0.4, { 'hidden.discipline': 0.6 }), outcomes: [
        ok('First prize, a small trophy and your photo in the local paper.', st('mood', 8), ms('Won the best front garden.')),
        bad('Second place, to a retired gardener with a greenhouse. Next year.', st('mood', 2)),
      ] },
      { label: 'Enter for fun', outcomes: [any('A certificate for "Most Cheerful" and a lot of compliments from passers-by.', 'good', st('mood', 4))] },
      { label: 'Just enjoy the roses', outcomes: [any('They do not need a trophy.', 'good', st('mood', 2))] },
    ],
  },
  {
    id: 'later_old_colleague_lunch', category: 'later life', ageRange: [55, 90], cooldown: 15,
    text: 'An old colleague suggests lunch, "for old times\' sake". You have not seen each other in fifteen years.',
    choices: [
      { label: 'Go, and stay all afternoon', outcomes: [any('All the old stories, a few new ones, and the waiter has to ask you to leave.', 'good', st('mood', 6), addNpc('friend', 'pal'))] },
      { label: 'Go for an hour', outcomes: [any('Pleasant, and strange, how the years have gone.', 'neutral', st('mood', 2))] },
      { label: 'Make an excuse', outcomes: [any('Some chapters are closed.', 'neutral')] },
    ],
  },
  {
    id: 'later_health_check', category: 'health', ageRange: [50, 80], cooldown: 12,
    text: 'A letter from the doctor\'s office invites you for a routine check-up, the kind recommended at your age.',
    choices: [
      { label: 'Go', outcomes: [any('A few tests, a few questions, a clean bill of health and some advice about salt.', 'good', st('health', 3))] },
      { label: 'Go, and ask every question you have saved up', outcomes: [any('A long appointment. You leave reassured and with a list of things to try.', 'good', st('health', 3), st('intellect', 1))] },
      { label: 'Put the letter on the pile', outcomes: [any('It sits there for a year.', 'neutral')] },
    ],
  },
  {
    id: 'later_young_person_advice', category: 'later life', ageRange: [55, 95], cooldown: 15,
    text: 'A young person at a bus stop, clearly upset, asks you if things get better.',
    choices: [
      { label: 'Tell them honestly that they do', outcomes: [any('You talk until the bus comes. They thank you, and you think about them for a long time.', 'good', hid('karma', 5), st('mood', 3))] },
      { label: 'Share a story of your own', outcomes: [any('A hard time from long ago, and how it ended. They smile for the first time.', 'good', hid('karma', 4), st('charm', 1))] },
      { label: 'Say you are sure they will be fine', outcomes: [any('Kind, and not quite enough.', 'neutral')] },
    ],
  },
  {
    id: 'later_cruise_brochure', category: 'later life', ageRange: [55, 85], cooldown: 20, requires: [has(1500)],
    text: 'A brochure arrives for a cruise along a coast you have always wanted to see.',
    choices: [
      { label: 'Book it', outcomes: [any('Two weeks of sea air, small ports and long dinners with strangers who become friends.', 'good', cash(-1400), st('mood', 9), st('health', 1))] },
      { label: 'Take a cheaper trip by train', outcomes: [any('Slower, and lovelier for it.', 'good', cash(-400), st('mood', 5))] },
      { label: 'Stick it on the fridge as a dream', outcomes: [any('It stays there, fading.', 'neutral')] },
    ],
  },
  {
    id: 'later_tea_dance', category: 'later life', ageRange: [60, 95], cooldown: 20,
    text: 'The community center holds a dance every Wednesday afternoon, with a live band and a lot of sequins.',
    choices: [
      { label: 'Go, and dance every dance', outcomes: [any('A waltz, a foxtrot, and something nobody can name. Your feet hurt and your heart is full.', 'good', tal('dance', 2), st('health', 2), st('mood', 7))] },
      { label: 'Go and watch', outcomes: [any('Someone asks you to dance on the third Wednesday. You say yes.', 'good', st('mood', 4))] },
      { label: 'Not for you', outcomes: [any('Wednesdays stay quiet.', 'neutral')] },
    ],
  },
  {
    id: 'later_letter_to_editor', category: 'later life', ageRange: [50, 95], cooldown: 20,
    text: 'Something in the local paper has annoyed you so much that you find yourself drafting a reply at the kitchen table.',
    choices: [
      { label: 'Send it', check: chk(0.5, { 'stats.intellect': 0.6 }), outcomes: [
        ok('They print it, in full. Three people stop you in the street to say you were quite right.', st('mood', 6), st('intellect', 1)),
        bad('They print it, cut in half, so that it says almost the opposite. You write another.', st('mood', -2)),
      ] },
      { label: 'Read it aloud to a friend instead', outcomes: [any('They agree with every word, and that is enough.', 'good', st('mood', 3))] },
      { label: 'Tear it up', outcomes: [any('Writing it was the point.', 'neutral', st('mood', 1))] },
    ],
  },
];
