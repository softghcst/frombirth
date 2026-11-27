// Scenes from the neighborhood (engine/neighborhood.js). None is drawn by chance: each is queued when something really
// happens on the player's street (a household moves in, a neighbor organizes something, a friend is moving away) and
// names the real people involved. {person} is the neighbor; other words come with the scene.
//
// A neighbor the player has not met yet is named in the scene's words only. Meeting them is a choice; nothing is
// assumed. `hood: true` scenes play out on their own luck (engine/eventEngine.js), so answering one never changes
// what the game's dice would have done.
import { st, hid, any, cash, need } from './helpers.js';

const hood = (value) => ({ type: 'hood', value });
const adult = [need('age', '>=', 18)];
const teen = [need('age', '>=', 13)];
const base = { category: 'neighborhood', queuedOnly: true, hood: true, cooldown: 0, cast: {} };

export default [
  // ---------- Small everyday moments (data/neighborhoods.js MOMENTS) ----------
  {
    ...base, id: 'hood_new_baby', ageRange: [12, 120],
    text: '{person} and their family have just brought a new baby home. The curtains have been closed for three days.',
    choices: [
      { label: 'Leave a cooked meal on their step', outcomes: [any('A casserole and a note: no need to return the dish. {person} told you later it was the first proper meal they had eaten all week.', 'good', hood({ do: 'meet', rel: 44 }), hid('karma', 2))] },
      { label: 'Knock with a small present', outcomes: [any('A tired, happy face at the door, and a glimpse of a very small person asleep.', 'good', hood({ do: 'meet', rel: 38 }), st('mood', 3))] },
      { label: 'Keep the noise down for a while', outcomes: [any('Nobody notices, which is the point.', 'neutral', hid('karma', 1))] },
    ],
  },
  {
    ...base, id: 'hood_big_game', ageRange: [8, 120],
    text: 'The national team is in the final, and {person} has wheeled a television out onto the front porch for the whole street.',
    choices: [
      { label: 'Bring a chair and snacks', outcomes: [any('Thirty neighbors, one television, and a last-minute goal. {person} hugs strangers. So do you.', 'good', hood({ do: 'meet', rel: 42 }), st('mood', 6))] },
      { label: 'Watch for the first half', outcomes: [any('You catch the first half and the best of the cheering from your kitchen window.', 'neutral', hood({ do: 'meet', rel: 32 }), st('mood', 2))] },
      { label: 'Close the windows and read', outcomes: [any('The cheering comes through the windows anyway.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_lost_pet', ageRange: [6, 120],
    text: '{person} has put up posters on every lamppost: their pet has gone missing, and they look like they have not slept.',
    choices: [
      { label: 'Help search the gardens and alleys', outcomes: [any('You searched until dark. The next morning {person} knocked to say the animal had turned up in a neighbor\'s shed, and hugged you.', 'good', hood({ do: 'meet', rel: 46 }), hid('karma', 2), st('mood', 3))] },
      { label: 'Keep an eye out and tell them anything you see', outcomes: [any('You spotted it three days later, sitting on a wall two streets away. {person} could not thank you enough.', 'good', hood({ do: 'meet', rel: 40 }))] },
      { label: 'Say you hope it turns up', outcomes: [any('{person} nodded and moved on to the next door.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_yard_sale', ageRange: [8, 120],
    text: '{person} is having a yard sale: the whole driveway covered in lamps, books, records and a box marked "free".',
    choices: [
      { label: 'Have a good look, and buy something', outcomes: [any('You came away with something you did not need and are very fond of. {person} told you where every item had come from.', 'good', cash(-10), hood({ do: 'meet', rel: 36 }), st('mood', 3))] },
      { label: 'Help them run it for an hour', requires: teen, outcomes: [any('You learned to haggle, badly. {person} gave you first pick of the free box.', 'good', hood({ do: 'meet', rel: 42 }))] },
      { label: 'Walk past with a wave', outcomes: [any('A wave across the lamps and records.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_storm_tree', ageRange: [10, 120],
    text: 'After a night of wind, a tree is down across {person}\'s drive, and they are standing looking at it with a small saw.',
    choices: [
      { label: 'Get your gloves and help', requires: teen, outcomes: [any('It took the morning and two more neighbors. {person} made everyone lunch.', 'good', hood({ do: 'meet', rel: 44 }), st('health', 1), st('mood', 2))] },
      { label: 'Help them find someone with the right equipment', outcomes: [any('You knew someone who knew someone. The tree was gone by the afternoon.', 'good', hood({ do: 'meet', rel: 38 }))] },
      { label: 'Leave them to it', outcomes: [any('You heard the saw going all morning.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_locked_out', ageRange: [10, 120],
    text: '{person} is standing on their step in the rain, patting their pockets. They have locked themselves out.',
    choices: [
      { label: 'Invite them in to wait in the dry', outcomes: [any('An hour, a towel and a long conversation later, the locksmith arrived. {person} said you are the reason they did not catch a cold.', 'good', hood({ do: 'meet', rel: 44 }), st('mood', 2))] },
      { label: 'Help them find a locksmith', outcomes: [any('You found one who could come straight away. {person} was very grateful.', 'neutral', hood({ do: 'meet', rel: 36 }))] },
      { label: 'Sympathize, and carry on', outcomes: [any('"It happens to everyone," you said. It does.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_book_box', ageRange: [8, 120],
    text: '{person} has put a little book-swap box on a post at the corner: take a book, leave a book.',
    choices: [
      { label: 'Leave a favorite of yours', outcomes: [any('A week later {person} stopped you to say they had read it, and loved it. You have been swapping recommendations since.', 'good', hood({ do: 'meet', rel: 42 }), st('mood', 2))] },
      { label: 'Take one home', outcomes: [any('You took a battered paperback and read it in two nights.', 'good', st('intellect', 1), st('mood', 1))] },
      { label: 'Walk on by', outcomes: [any('You noticed it, and meant to come back.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_new_neighbors', ageRange: [5, 120],
    text: 'A moving van outside {label}: {family} — {who} — is moving in near you.',
    choices: [
      { label: 'Go over and introduce yourself', outcomes: [any('You knocked, said hello and pointed out where the good bakery is. {person} seemed glad of it.', 'good', hood({ do: 'meet', rel: 38 }), st('mood', 2))] },
      { label: 'Take round something to eat, as a welcome', requires: teen, outcomes: [any('A tray of something warm and a note with your name on it. {person} came round the next day to return the tray, and stayed to talk.', 'good', cash(-15), hood({ do: 'meet', rel: 46, help: true }), hid('karma', 2))] },
      { label: 'Invite them over once they are settled', requires: adult, outcomes: [any('They came for dinner two weeks later, tired and grateful. {person} knows your street better now.', 'good', cash(-30), hood({ do: 'meet', rel: 48 }))] },
      { label: 'Give them space to settle in', outcomes: [any('You nodded across the street and let them unpack in peace. There will be time.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_familiar_face', ageRange: [5, 120],
    text: 'Somebody you know lives here: {person}, a few doors from your new place.',
    choices: [
      { label: 'Knock and say hello', outcomes: [any('"Of all the streets!" {person} put the kettle on. It makes the new place feel like home already.', 'good', hood({ do: 'closer', by: 6 }), st('mood', 3))] },
      { label: 'Wave next time you see them', outcomes: [any('A wave, a grin, a promise to catch up properly.', 'neutral', hood({ do: 'closer', by: 2 }))] },
    ],
  },
  {
    ...base, id: 'hood_family_next_door', ageRange: [6, 120],
    text: 'There is a new baby next door: {baby}, the newest of {family}. {person} looks exhausted and very happy.',
    choices: [
      { label: 'Bring round a card and a small present', requires: teen, outcomes: [any('{person} was touched, and showed you the baby, who slept through all of it.', 'good', cash(-20), hood({ do: 'meet', rel: 44 }))] },
      { label: 'Offer to help if they need anything', requires: teen, outcomes: [any('"You might regret saying that," said {person}, laughing. They did not ask for much.', 'good', hood({ do: 'meet', rel: 42, help: true }))] },
      { label: 'Congratulate them in passing', outcomes: [any('A quick "congratulations" over the fence. They beamed.', 'neutral', hood({ do: 'meet', rel: 34 }))] },
    ],
  },
  {
    ...base, id: 'hood_friend_across_street', ageRange: [4, 13],
    text: 'There is a kid your age {where}: {person}, kicking a ball against the wall on their own.',
    choices: [
      { label: 'Ask if you can play too', outcomes: [any('{person} passed you the ball without a word. By the time you were called in, you were friends, or close to it.', 'good', hood({ do: 'meet', rel: 50, kid: true }), st('mood', 4))] },
      { label: 'Watch from the window', outcomes: [any('You watched for a while. Maybe next time.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_community_event', ageRange: [4, 120],
    text: '{person} is organizing a {event} in the neighborhood: {what}.',
    choices: [
      { label: 'Go along', outcomes: [any('A good afternoon. You talked to more neighbors than you had all year.', 'good', hood({ do: 'attend', how: 'attend' }))] },
      { label: 'Offer to help organize it', requires: teen, outcomes: [any('Tables, signs, a cashbox and a lot of tape. {person} could not have done it without you, and says so.', 'good', hood({ do: 'attend', how: 'help' }), st('mood', 2))] },
      { label: 'Give it a miss', outcomes: [any('You heard it from your window. It sounded fun.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_block_party', ageRange: [4, 120],
    text: 'The street is having a {event}. {person} is going door to door with a list of who is bringing what.',
    choices: [
      { label: 'Bring a dish and go', outcomes: [any('Tables end to end down the middle of the street, music from somebody\'s window, and children everywhere.', 'good', cash(-15), hood({ do: 'attend', how: 'attend' }), st('mood', 4))] },
      { label: 'Help set it up', requires: teen, outcomes: [any('You carried tables, strung lights and ended up running the music.', 'good', hood({ do: 'attend', how: 'help' }), st('mood', 3))] },
      { label: 'Stay in', outcomes: [any('It went on until late. Next year, perhaps.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_building_gathering', ageRange: [4, 120],
    text: '{person} has put a note in the lobby: {what}, this weekend. Everyone in the building is welcome.',
    choices: [
      { label: 'Go down and join in', outcomes: [any('You met people you had been passing on the stairs for months.', 'good', hood({ do: 'attend', how: 'attend' }))] },
      { label: 'Bring something and help {person} set up', requires: teen, outcomes: [any('Folding chairs, paper cups, and a long conversation with {person} about the building\'s history.', 'good', hood({ do: 'attend', how: 'help' }))] },
      { label: 'Not this time', outcomes: [any('You could hear the laughter through the floor. Nice to know it is there.', 'neutral')] },
    ],
  },
  // ---------- Each community event in its own words (data/neighborhoods.js COMMUNITY_EVENTS scene) ----------
  {
    ...base, id: 'hood_event_welcome', ageRange: [4, 120],
    text: 'New people have moved onto the street, and {person} is putting together a little {event} so they meet everyone.',
    choices: [
      { label: 'Go and say hello to the new people', outcomes: [any('You were the first to shake their hands. They asked you where the good bakery was, and you told them the truth.', 'good', hood({ do: 'attend', how: 'attend' }))] },
      { label: 'Bake something for the welcome table', requires: teen, outcomes: [any('Your cake was gone in ten minutes. {person} asked for the recipe.', 'good', hood({ do: 'attend', how: 'help' }), cash(-10))] },
      { label: 'Wave from across the street', outcomes: [any('A wave, and a promise to yourself to introduce yourself properly later.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_event_picnic', ageRange: [4, 120],
    text: '{person} is organizing a {event}: blankets on the grass in the park, and everyone bringing something to share.',
    choices: [
      { label: 'Bring something and spread out a blanket', outcomes: [any('Sandwiches traded, a game of catch, and a long lazy afternoon in the sun.', 'good', hood({ do: 'attend', how: 'attend' }), st('mood', 3))] },
      { label: 'Organize the games', requires: teen, outcomes: [any('An egg-and-spoon race, a three-legged race and a tug of war that ended in a heap. {person} said it was the best picnic yet.', 'good', hood({ do: 'attend', how: 'help' }), st('mood', 3))] },
      { label: 'It looks like rain', outcomes: [any('It did not rain.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_event_sale', ageRange: [8, 120],
    text: 'The whole neighborhood is holding a {event}, and {person} is putting up signs on every lamppost.',
    choices: [
      { label: 'Wander round and look at everything', outcomes: [any('You came home with a lamp, a stack of old records and the life stories of four neighbors.', 'good', hood({ do: 'attend', how: 'attend' }), cash(-10))] },
      { label: 'Set out a table of your own things', requires: teen, outcomes: [any('You sold almost everything, haggled like a professional and made a little money.', 'good', hood({ do: 'attend', how: 'help' }), cash(30))] },
      { label: 'Keep your money in your pocket', outcomes: [any('A wise move, and a little sad.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_event_cleanup', ageRange: [6, 120],
    text: '{person} has organized a {event}: gloves, bags and a promise of coffee afterward.',
    choices: [
      { label: 'Grab a bag and join in', outcomes: [any('Three hours, eleven bags and a shopping cart pulled out of the stream. The park looked like new.', 'good', hood({ do: 'attend', how: 'attend' }), hid('karma', 2), st('health', 1))] },
      { label: 'Help organize the teams', requires: teen, outcomes: [any('A clipboard, a map of the area and a lot of cheerful volunteers. It went like clockwork.', 'good', hood({ do: 'attend', how: 'help' }), hid('karma', 2))] },
      { label: 'Leave it to the volunteers', outcomes: [any('The park looked lovely afterward. You noticed.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_event_fundraiser', ageRange: [6, 120],
    text: '{person} is running a {event} for a local cause, with a cake stall and a raffle with some surprisingly good prizes.',
    choices: [
      { label: 'Buy raffle tickets and a slice of cake', outcomes: [any('You did not win the bicycle, but you won a jar of pickles and a lot of goodwill.', 'good', hood({ do: 'attend', how: 'attend' }), cash(-10), hid('karma', 2))] },
      { label: 'Run the raffle', requires: teen, outcomes: [any('You sold tickets to everyone, including people who had not meant to come in. A record amount was raised.', 'good', hood({ do: 'attend', how: 'help' }), hid('karma', 3), st('charm', 1))] },
      { label: 'Put something in the tin and go', outcomes: [any('A small donation, quietly given.', 'neutral', hid('karma', 1))] },
    ],
  },
  {
    ...base, id: 'hood_event_holiday', ageRange: [4, 120],
    text: '{person} is hosting a {event} for the neighborhood: lights strung up, warm drinks and food for everyone.',
    choices: [
      { label: 'Go and bring a dish', outcomes: [any('Lights, songs and far too much food. You walked home warm in every way.', 'good', hood({ do: 'attend', how: 'attend' }), st('mood', 4))] },
      { label: 'Help string the lights', requires: teen, outcomes: [any('A ladder, a tangle of wires and a lot of laughing. When they finally came on, everyone cheered.', 'good', hood({ do: 'attend', how: 'help' }), st('mood', 4))] },
      { label: 'Stay home this year', outcomes: [any('You saw the lights from your window, twinkling down the street.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_event_sports_day', ageRange: [4, 120],
    text: '{person} has organized a {event}: races for the children, a tug of war for the grown-ups and a lot of shouting.',
    choices: [
      { label: 'Enter the tug of war', outcomes: [any('Your team won after a long, red-faced struggle and then fell over together.', 'good', hood({ do: 'attend', how: 'attend' }), st('health', 1), st('mood', 4))] },
      { label: 'Be the referee', requires: teen, outcomes: [any('A whistle, a lot of arguments about the egg-and-spoon rules and nobody seriously hurt. A success.', 'good', hood({ do: 'attend', how: 'help' }), st('charm', 1))] },
      { label: 'Watch from the side', outcomes: [any('You cheered for whoever was losing.', 'neutral', st('mood', 1))] },
    ],
  },
  {
    ...base, id: 'hood_event_meeting', ageRange: [16, 120],
    text: '{person} has called a {event} in the hall about the neighborhood: the roads, the park, and what people want changed.',
    choices: [
      { label: 'Go and listen', outcomes: [any('Two hours, a lot of opinions and some bad coffee. You came away understanding the place better.', 'good', hood({ do: 'attend', how: 'attend' }), st('intellect', 1))] },
      { label: 'Stand up and speak', requires: teen, outcomes: [any('You said what you had been thinking for months. People nodded. {person} wrote it down.', 'good', hood({ do: 'attend', how: 'help' }), st('charm', 2))] },
      { label: 'Read the minutes later', outcomes: [any('Nothing much was decided, the minutes say, at length.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_event_festival', ageRange: [4, 120],
    text: 'It is time for the {event}, and {person} is one of the people running it: stalls, music, and half the town out.',
    choices: [
      { label: 'Spend the whole day there', outcomes: [any('Music, food from every stall and a funnel cake you will remember for years.', 'good', hood({ do: 'attend', how: 'attend' }), cash(-15), st('mood', 5))] },
      { label: 'Volunteer on a stall', requires: teen, outcomes: [any('You sold lemonade for six hours and met what felt like everyone in town.', 'good', hood({ do: 'attend', how: 'help' }), st('charm', 2), st('mood', 3))] },
      { label: 'Avoid the crowds', outcomes: [any('You heard the music drifting over the roofs all afternoon.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_event_harvest', ageRange: [4, 120],
    text: '{person} invites everyone to the {event} in the hall: long tables, home cooking and a speech nobody can hear.',
    choices: [
      { label: 'Go and sit at the long table', outcomes: [any('You sat between two farmers who argued about rain all evening. The pie was magnificent.', 'good', hood({ do: 'attend', how: 'attend' }), st('mood', 4))] },
      { label: 'Help in the kitchen', requires: teen, outcomes: [any('Steam, noise and a mountain of potatoes. You were thanked in the speech, which nobody could hear.', 'good', hood({ do: 'attend', how: 'help' }), st('mood', 3))] },
      { label: 'Not this year', outcomes: [any('A plate was sent round to you anyway, covered in foil.', 'neutral')] },
    ],
  },
  // ---------- Each kind of help a neighbor asks for, in its own words (data/neighborhoods.js NEIGHBOR_NEEDS) ----------
  {
    ...base, id: 'hood_hand_move', ageRange: [14, 120],
    text: '{person} is standing at the bottom of their stairs with a wardrobe, looking at it the way people look at mountains.',
    choices: [
      { label: 'Take the other end', outcomes: [any('Up, round the bend, a scraped knuckle, a lot of "to you, to me". It is in. {person} insisted on making you lunch.', 'good', hood({ do: 'help', how: 'help' }), hid('karma', 2), st('health', 1))] },
      { label: 'Tell them about a cheap moving company', outcomes: [any('Two strong people came the next day. {person} was grateful for the number.', 'neutral', hood({ do: 'help', how: 'suggest' }))] },
      { label: 'Say your back would not survive it', outcomes: [any('{person} laughed and said theirs would not either.', 'neutral', hood({ do: 'help', how: 'decline' }))] },
    ],
  },
  {
    ...base, id: 'hood_hand_meal', ageRange: [14, 120],
    text: '{person} is home after an operation and cannot stand at the stove for long. They mention it, a little embarrassed.',
    choices: [
      { label: 'Bring round a hot meal every few days', outcomes: [any('Soup, a stew, a pie. {person} said it was the thing that got them through.', 'good', hood({ do: 'help', how: 'help' }), hid('karma', 3), st('mood', 2))] },
      { label: 'Set up a schedule with other neighbors', outcomes: [any('Six households, a different dinner every night. {person} has never eaten so well.', 'good', hood({ do: 'help', how: 'suggest' }), hid('karma', 2))] },
      { label: 'Wish them a quick recovery', outcomes: [any('They thanked you, and you meant it.', 'neutral', hood({ do: 'help', how: 'decline' }))] },
    ],
  },
  {
    ...base, id: 'hood_hand_garden', ageRange: [12, 120],
    text: '{person}\'s garden has turned into a jungle, and they admit they do not know where to start.',
    choices: [
      { label: 'Spend a Saturday on it together', outcomes: [any('Brambles out, grass cut, a rose found under it all. {person} sat on the step and cried a little, happily.', 'good', hood({ do: 'help', how: 'help' }), st('health', 1), hid('karma', 2))] },
      { label: 'Recommend a gardener', outcomes: [any('The gardener was good and cheap. {person} was pleased.', 'neutral', hood({ do: 'help', how: 'suggest' }))] },
      { label: 'Say gardening is not your thing', outcomes: [any('Fair enough, said {person}, looking at the brambles.', 'neutral', hood({ do: 'help', how: 'decline' }))] },
    ],
  },
  {
    ...base, id: 'hood_hand_pet', ageRange: [10, 120],
    text: '{person} is going away for a week and asks if you could feed their animals and keep them company.',
    choices: [
      { label: 'Of course', outcomes: [any('A week of feeding, a few walks and a lot of affection. They greeted you every day like an old friend.', 'good', hood({ do: 'help', how: 'help' }), st('mood', 3))] },
      { label: 'Suggest a pet-sitter you know', outcomes: [any('The sitter was wonderful. {person} sent a postcard.', 'neutral', hood({ do: 'help', how: 'suggest' }))] },
      { label: 'Say you will be away too', outcomes: [any('{person} found someone else.', 'neutral', hood({ do: 'help', how: 'decline' }))] },
    ],
  },
  {
    ...base, id: 'hood_hand_errand', ageRange: [12, 120],
    text: '{person} has hurt their ankle and asks, if you are passing the shops, whether you could pick up a few things.',
    choices: [
      { label: 'Pick up everything on the list', outcomes: [any('Milk, bread, cat food and some very specific cookies. {person} pressed a bar of chocolate on you.', 'good', hood({ do: 'help', how: 'help' }), hid('karma', 2))] },
      { label: 'Tell them which shop delivers', outcomes: [any('A delivery the next day. {person} said they had not known that was possible.', 'neutral', hood({ do: 'help', how: 'suggest' }))] },
      { label: 'Say you are not going that way', outcomes: [any('{person} said not to worry.', 'neutral', hood({ do: 'help', how: 'decline' }))] },
    ],
  },
  {
    ...base, id: 'hood_hand_gutter', ageRange: [16, 120],
    text: 'Rain is forecast, and {person}\'s gutters are overflowing with leaves. They are eyeing a wobbly ladder.',
    choices: [
      { label: 'Hold the ladder, or go up yourself', outcomes: [any('A bucket of leaves, a dead bird\'s nest and one alarming wobble. The gutters ran clear when the rain came.', 'good', hood({ do: 'help', how: 'help' }), hid('karma', 2))] },
      { label: 'Find them someone with proper equipment', outcomes: [any('A man with a long pole sorted it in ten minutes.', 'neutral', hood({ do: 'help', how: 'suggest' }))] },
      { label: 'Say you do not do ladders', outcomes: [any('{person} nodded. They do not either, really.', 'neutral', hood({ do: 'help', how: 'decline' }))] },
    ],
  },
  {
    ...base, id: 'hood_hand_kids', ageRange: [16, 120],
    text: '{person} has an evening out they cannot miss, and asks whether you could watch their children for a few hours.',
    choices: [
      { label: 'Say yes', outcomes: [any('Board games, a bedtime story read in silly voices and a quiet house by nine. The children ask for you by name now.', 'good', hood({ do: 'help', how: 'help' }), st('mood', 3))] },
      { label: 'Recommend a teenager you trust', outcomes: [any('The teenager was perfect. {person} was very grateful for the name.', 'neutral', hood({ do: 'help', how: 'suggest' }))] },
      { label: 'Say you are busy that night', outcomes: [any('{person} found someone else.', 'neutral', hood({ do: 'help', how: 'decline' }))] },
    ],
  },
  {
    ...base, id: 'hood_hand_ride', ageRange: [17, 120],
    text: '{person} has a hospital appointment across town and no way of getting there. They ask, hesitantly, about a ride.',
    choices: [
      { label: 'Drive them, and wait', outcomes: [any('An hour in the waiting room together. It was good news, and you drove home with the radio on loud.', 'good', hood({ do: 'help', how: 'help' }), hid('karma', 3))] },
      { label: 'Help them book the hospital transport', outcomes: [any('A van came to the door. {person} had not known it existed.', 'neutral', hood({ do: 'help', how: 'suggest' }))] },
      { label: 'Say you are working that day', outcomes: [any('{person} took a taxi.', 'neutral', hood({ do: 'help', how: 'decline' }))] },
    ],
  },
  {
    ...base, id: 'hood_hand_letter', ageRange: [16, 120],
    text: '{person} knocks with an official letter full of long words, and asks if you could help them understand it.',
    choices: [
      { label: 'Sit down and go through it together', outcomes: [any('It was less frightening than it looked. You filled in the form together, and {person} let out a long breath.', 'good', hood({ do: 'help', how: 'help' }), st('intellect', 1), hid('karma', 2))] },
      { label: 'Point them to the free advice office', outcomes: [any('The advice office sorted it out in twenty minutes.', 'neutral', hood({ do: 'help', how: 'suggest' }))] },
      { label: 'Say it is beyond you too', outcomes: [any('It probably was.', 'neutral', hood({ do: 'help', how: 'decline' }))] },
    ],
  },
  {
    ...base, id: 'hood_hand_tech', ageRange: [12, 120],
    text: '{person} has a brand-new computer still in its box, and a look of deep suspicion.',
    choices: [
      { label: 'Set it up and show them the basics', outcomes: [any('An afternoon of patience. By the end, {person} sent their first message to a grandchild, and was delighted.', 'good', hood({ do: 'help', how: 'help' }), st('mood', 2))] },
      { label: 'Tell them about the free class at the library', outcomes: [any('They went every week and now know more than you do.', 'neutral', hood({ do: 'help', how: 'suggest' }))] },
      { label: 'Say you are no good with computers', outcomes: [any('The box stayed sealed for another month.', 'neutral', hood({ do: 'help', how: 'decline' }))] },
    ],
  },
  {
    ...base, id: 'hood_need_hand', ageRange: [12, 120],
    text: '{person} from down the street asks, a little awkwardly, whether you could help them {need}.',
    choices: [
      { label: 'Of course', outcomes: [any('It took a few hours, and {person} would not stop thanking you.', 'good', hood({ do: 'help', how: 'help' }), hid('karma', 2), st('mood', 2))] },
      { label: 'Suggest someone better placed to help', outcomes: [any('You gave them the number of someone who does it for a living. {person} was grateful for that too.', 'neutral', hood({ do: 'help', how: 'suggest' }))] },
      { label: 'Say kindly that you cannot this time', outcomes: [any('{person} said it was no trouble to ask. It was not.', 'neutral', hood({ do: 'help', how: 'decline' }))] },
    ],
  },
  // ---------- Each kind of disagreement in its own words (data/neighborhoods.js DISAGREEMENTS scene) ----------
  {
    ...base, id: 'hood_dispute_noise', ageRange: [18, 120],
    text: 'Music and voices from {person}\'s place, past midnight, for the third weekend running. You have work in the morning.',
    choices: [
      { label: 'Knock and ask them, nicely, to turn it down', outcomes: [any('You knocked in your pajamas. {person} opened the door with a drink in hand and a guilty look.', 'neutral', hood({ do: 'dispute', how: 'ask' }))] },
      { label: 'Suggest a deal: loud until eleven, quiet after', outcomes: [any('You offered a cut-off time. {person} said they would think about it.', 'neutral', hood({ do: 'dispute', how: 'compromise' }))] },
      { label: 'Put a polite note through their door', outcomes: [any('A short, clear note: you need to sleep, and this cannot go on.', 'neutral', hood({ do: 'dispute', how: 'boundary' }))] },
      { label: 'Call the noise line', outcomes: [any('You made the call. A van came by around one, and the music stopped.', 'neutral', hood({ do: 'dispute', how: 'formal' }))] },
    ],
  },
  {
    ...base, id: 'hood_dispute_parking', ageRange: [18, 120],
    text: 'For the fourth day in a row, {person} has parked right across the front of your house.',
    choices: [
      { label: 'Ask them about it, friendly', outcomes: [any('You caught {person} at their car. They had not realized it bothered you.', 'neutral', hood({ do: 'dispute', how: 'ask' }))] },
      { label: 'Suggest you take turns with the good spot', outcomes: [any('Alternate days for the spot by the tree. {person} laughed, but did not say no.', 'neutral', hood({ do: 'dispute', how: 'compromise' }))] },
      { label: 'Tell them plainly the space is not theirs', outcomes: [any('You said it straight. {person} went a little red.', 'neutral', hood({ do: 'dispute', how: 'boundary' }))] },
      { label: 'Report it to the city', outcomes: [any('A warning notice appeared on the windshield. {person} knows who called.', 'neutral', hood({ do: 'dispute', how: 'formal' }))] },
    ],
  },
  {
    ...base, id: 'hood_dispute_boundary', ageRange: [18, 120],
    text: '{person} has put up a new fence, and you are fairly sure it is a foot onto your side.',
    choices: [
      { label: 'Ask them to look at the old plans with you', outcomes: [any('You spread out the old house papers on the hood of a car together.', 'neutral', hood({ do: 'dispute', how: 'ask' }))] },
      { label: 'Offer to split the difference', outcomes: [any('You suggested the fence stay, with the cost of a hedge shared. {person} is thinking.', 'neutral', hood({ do: 'dispute', how: 'compromise' }))] },
      { label: 'Ask someone from the street they trust to look', outcomes: [any('An old neighbor who remembers the original fence came over to have a look.', 'neutral', hood({ do: 'dispute', how: 'mediate' }))] },
      { label: 'Get a surveyor and a lawyer\'s letter', outcomes: [any('A surveyor came with a measuring wheel. Letters were exchanged.', 'neutral', hood({ do: 'dispute', how: 'formal' }))] },
    ],
  },
  {
    ...base, id: 'hood_dispute_pet', ageRange: [18, 120],
    text: '{person}\'s dog barks from the moment they leave in the morning until they come home at night.',
    choices: [
      { label: 'Tell them, kindly; they may not know', outcomes: [any('{person} had no idea. They looked genuinely upset about it.', 'neutral', hood({ do: 'dispute', how: 'ask' }))] },
      { label: 'Offer to walk the dog at lunchtime', outcomes: [any('An unusual offer. {person} said they would love that, and so would the dog.', 'neutral', hood({ do: 'dispute', how: 'compromise' }))] },
      { label: 'Say clearly it has to stop', outcomes: [any('You said the barking is not something you can live with.', 'neutral', hood({ do: 'dispute', how: 'boundary' }))] },
      { label: 'Complain to the city', outcomes: [any('A letter from the city about the dog. {person} was hurt that you did not knock first.', 'neutral', hood({ do: 'dispute', how: 'formal' }))] },
    ],
  },
  {
    ...base, id: 'hood_dispute_shared', ageRange: [18, 120],
    text: 'The shared hallway is full of {person}\'s things again, and the trash cans are overflowing beside them.',
    choices: [
      { label: 'Ask {person} about it on the stairs', outcomes: [any('A slightly awkward chat on the landing. {person} said they were between storage places.', 'neutral', hood({ do: 'dispute', how: 'ask' }))] },
      { label: 'Propose a cleaning schedule for the whole floor', outcomes: [any('A schedule on the bulletin board, everyone\'s name on it, {person}\'s included.', 'neutral', hood({ do: 'dispute', how: 'compromise' }))] },
      { label: 'Ask the building manager to sort it out', outcomes: [any('The manager sent a friendly note to everyone on the floor.', 'neutral', hood({ do: 'dispute', how: 'mediate' }))] },
      { label: 'Make a formal complaint to the landlord', outcomes: [any('A formal complaint, with photographs.', 'neutral', hood({ do: 'dispute', how: 'formal' }))] },
    ],
  },
  {
    ...base, id: 'hood_dispute_rules', ageRange: [18, 120],
    text: '{person} keeps three bikes in the stairwell, and you have to squeeze past them every time you come home.',
    choices: [
      { label: 'Ask whether they could find somewhere else', outcomes: [any('{person} said there is nowhere else, and asked if you had any ideas.', 'neutral', hood({ do: 'dispute', how: 'ask' }))] },
      { label: 'Suggest the residents club together for a bike rack', outcomes: [any('A bike rack in the courtyard, the cost shared. {person} liked the idea.', 'neutral', hood({ do: 'dispute', how: 'compromise' }))] },
      { label: 'Say they block the fire exit, and must go', outcomes: [any('You put it plainly: it is a safety rule, not a preference.', 'neutral', hood({ do: 'dispute', how: 'boundary' }))] },
      { label: 'Report it to the building\'s management', outcomes: [any('A notice went up in the lobby about the stairwell.', 'neutral', hood({ do: 'dispute', how: 'formal' }))] },
    ],
  },
  {
    ...base, id: 'hood_dispute_tree', ageRange: [18, 120],
    text: '{person}\'s big tree hangs over your garden, dropping leaves, sap and the occasional branch.',
    choices: [
      { label: 'Ask them if it could be trimmed', outcomes: [any('You stood together under the tree. {person} said they love it, and see what you mean.', 'neutral', hood({ do: 'dispute', how: 'ask' }))] },
      { label: 'Offer to share the cost of a tree surgeon', outcomes: [any('Half each for a careful trim. The tree stays, and so does the light.', 'neutral', hood({ do: 'dispute', how: 'compromise' }))] },
      { label: 'Tell them you will cut back what hangs over', outcomes: [any('You said you will trim the branches on your side, as is your right.', 'neutral', hood({ do: 'dispute', how: 'boundary' }))] },
      { label: 'Ask the city about the rules', outcomes: [any('The city sent a leaflet about overhanging trees, and a copy to {person}.', 'neutral', hood({ do: 'dispute', how: 'formal' }))] },
    ],
  },
  {
    ...base, id: 'hood_dispute_smoke', ageRange: [18, 120],
    text: 'Every Sunday {person} burns garden waste, and the smoke drifts straight into your laundry and your windows.',
    choices: [
      { label: 'Ask them about it over the fence', outcomes: [any('{person} had never thought about which way the wind blows.', 'neutral', hood({ do: 'dispute', how: 'ask' }))] },
      { label: 'Suggest they burn only when the wind is the other way', outcomes: [any('A simple deal about the wind. {person} said it seemed fair.', 'neutral', hood({ do: 'dispute', how: 'compromise' }))] },
      { label: 'Tell them it has to stop', outcomes: [any('You said the smoke is making your house smell, and it has to stop.', 'neutral', hood({ do: 'dispute', how: 'boundary' }))] },
      { label: 'Complain to the city', outcomes: [any('A city inspector came round to talk to {person} about bonfires.', 'neutral', hood({ do: 'dispute', how: 'formal' }))] },
    ],
  },
  {
    ...base, id: 'hood_dispute_building', ageRange: [18, 120],
    text: '{person} is having building work done, and the drilling starts at seven every morning, Saturdays included.',
    choices: [
      { label: 'Ask how long it will go on', outcomes: [any('{person} sighed: another two months. They said they are sick of it too.', 'neutral', hood({ do: 'dispute', how: 'ask' }))] },
      { label: 'Ask for a later start on weekends', outcomes: [any('You asked for no drilling before ten on Saturdays. {person} said they would talk to the builders.', 'neutral', hood({ do: 'dispute', how: 'compromise' }))] },
      { label: 'Ask the builders to keep to the proper hours', outcomes: [any('You told the foreman the hours the rules allow.', 'neutral', hood({ do: 'dispute', how: 'boundary' }))] },
      { label: 'Report it to the city', outcomes: [any('The city reminded the builders of the permitted hours.', 'neutral', hood({ do: 'dispute', how: 'formal' }))] },
    ],
  },
  {
    ...base, id: 'hood_dispute_light', ageRange: [18, 120],
    text: '{person} has put up a security light that clicks on whenever a cat walks by, and shines straight into your bedroom.',
    choices: [
      { label: 'Mention it, and ask if it could be angled down', outcomes: [any('{person} came over that evening to see it from your window, and winced.', 'neutral', hood({ do: 'dispute', how: 'ask' }))] },
      { label: 'Offer to help fit a shade on it', outcomes: [any('A small shade on the lamp. You offered to hold the ladder.', 'neutral', hood({ do: 'dispute', how: 'compromise' }))] },
      { label: 'Say it has to be moved', outcomes: [any('You said you cannot sleep with it, and it needs to go.', 'neutral', hood({ do: 'dispute', how: 'boundary' }))] },
      { label: 'Complain to the city about the light', outcomes: [any('A formal complaint about the light.', 'neutral', hood({ do: 'dispute', how: 'formal' }))] },
    ],
  },
  {
    ...base, id: 'hood_dispute_drums', ageRange: [14, 120],
    text: 'Someone at {person}\'s place has taken up the drums, and practices for two hours every evening.',
    choices: [
      { label: 'Ask about it, and when they practice', outcomes: [any('{person} looked embarrassed: their teenager, and a passion that came from nowhere.', 'neutral', hood({ do: 'dispute', how: 'ask' }))] },
      { label: 'Suggest set practice hours, and rubber pads on the drums', outcomes: [any('An hour a day, before eight, with practice pads. {person} said it sounded fair.', 'neutral', hood({ do: 'dispute', how: 'compromise' }))] },
      { label: 'Say the evenings need to be quiet', outcomes: [any('You said that two hours a night is too much.', 'neutral', hood({ do: 'dispute', how: 'boundary' }))] },
      { label: 'Ask someone neutral to help work it out', outcomes: [any('A neighbor you both trust sat you down over coffee to agree on something.', 'neutral', hood({ do: 'dispute', how: 'mediate' }))] },
    ],
  },
  {
    ...base, id: 'hood_disagreement', ageRange: [18, 120],
    text: 'Things have got a little tense with {person} over {about}.',
    choices: [
      { label: 'Suggest a compromise', outcomes: [any('You proposed something that gives each of you a bit of what you want.', 'neutral', hood({ do: 'dispute', how: 'compromise' }))] },
      { label: 'Knock, ask what is going on, and talk it over calmly', outcomes: [any('A slightly awkward doorstep conversation. You asked, and listened.', 'neutral', hood({ do: 'dispute', how: 'ask' }))] },
      { label: 'Ask someone neutral to help sort it out', outcomes: [any('A mediator sat you both down for half an hour.', 'neutral', hood({ do: 'dispute', how: 'mediate' }))] },
      { label: 'Set a clear boundary', outcomes: [any('You told {person} plainly what you would and would not put up with.', 'neutral', hood({ do: 'dispute', how: 'boundary' }))] },
      { label: 'Take it through the proper channels', outcomes: [any('A formal complaint to the landlord, the council or the residents\' association.', 'neutral', hood({ do: 'dispute', how: 'formal' }))] },
    ],
  },
  {
    ...base, id: 'hood_moving_away', ageRange: [5, 120],
    text: '{person} is moving away, to {where}.',
    choices: [
      { label: 'Throw them a goodbye get-together', requires: teen, outcomes: [any('A few neighbors, a cake that said "Don\'t go", and a lot of promises to visit.', 'good', cash(-30), hood({ do: 'moving', how: 'party' }), st('mood', -1))] },
      { label: 'Help them pack and move', requires: teen, outcomes: [any('Boxes, tape and one last cup of tea in an empty kitchen.', 'good', hood({ do: 'moving', how: 'help' }), st('mood', -2))] },
      { label: 'Promise to keep in touch', outcomes: [any('You swapped addresses and meant it.', 'neutral', hood({ do: 'moving', how: 'keep' }), st('mood', -3))] },
    ],
  },
  {
    ...base, id: 'hood_empty_house', ageRange: [8, 120],
    text: '{label} stands empty now. {family} lived there for {years} years.',
    choices: [
      { label: 'Remember them', outcomes: [any('The garden gate, the light in the kitchen window, the way they waved. The street feels different.', 'neutral', hood({ do: 'reflect', by: -2 }))] },
      { label: 'Wonder who will move in', outcomes: [any('Somebody will. Streets go on.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_longtime_resident', ageRange: [14, 120],
    text: '{person} has lived in {hood} for {years} years, and stops you to ask how you are settling in.',
    choices: [
      { label: 'Ask what it used to be like', outcomes: [any('An hour of stories: who lived where, what the shops were, the winter the river froze. {person} remembers it all.', 'good', hood({ do: 'elder', how: 'listen' }), st('mood', 2))] },
      { label: 'Chat politely and be on your way', outcomes: [any('A friendly few minutes.', 'neutral', hood({ do: 'elder', how: 'polite' }))] },
    ],
  },
  {
    ...base, id: 'hood_invitation', ageRange: [5, 120],
    text: '{person} invites you round.',
    choices: [
      { label: 'Go', outcomes: [any('A good time at {person}\'s. You stayed longer than you meant to.', 'good', hood({ do: 'closer', by: 5 }), st('mood', 2))] },
      { label: 'Not this time', outcomes: [any('{person} said another time, then.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_invitation_upstairs', ageRange: [13, 120],
    text: '{person}, from the apartment next to yours, is having a few people round and asks if you would like to come.',
    choices: [
      { label: 'Go', outcomes: [any('Six people in a small kitchen. You learned more about the building in an evening than in a year.', 'good', hood({ do: 'closer', by: 6 }), st('mood', 3))] },
      { label: 'Thank them, but stay in', outcomes: [any('You could hear them through the wall. It sounded nice.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_neighbor_business', ageRange: [8, 120],
    text: '{person} has opened {venue}, a {kind}, in the neighborhood.',
    choices: [
      { label: 'Go on the first day', outcomes: [any('A queue out of the door, and {person} looking terrified and delighted.', 'good', hood({ do: 'business', how: 'visit' }))] },
      { label: 'Tell everyone you know about it', requires: teen, outcomes: [any('Word of mouth works. {person} noticed.', 'good', hood({ do: 'business', how: 'support' }))] },
      { label: 'Maybe later', outcomes: [any('It will still be there.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_old_friend_returns', ageRange: [16, 120],
    text: '{person}, who grew up around here, has moved back, and is living near you again.',
    choices: [
      { label: 'Go round straight away', outcomes: [any('"Look at you!" Years fell away in an afternoon.', 'good', hood({ do: 'closer', by: 10 }), st('mood', 4))] },
      { label: 'Send a note to say welcome back', outcomes: [any('A reply came the same day: "Coffee? Like old times."', 'good', hood({ do: 'closer', by: 5 }))] },
    ],
  },
  {
    ...base, id: 'hood_kindness_returned', ageRange: [12, 120],
    text: '{person} turns up at your door with {help}. "You helped me once," they say. "My turn."',
    choices: [
      { label: 'Accept, gratefully', outcomes: [any('It was exactly what you needed, and you both know it.', 'good', hood({ do: 'closer', by: 5 }), st('mood', 4))] },
      { label: 'Thank them, and say you are fine', outcomes: [any('"The offer stands," says {person}.', 'neutral', hood({ do: 'closer', by: 2 }))] },
    ],
  },
  {
    ...base, id: 'hood_reunion', ageRange: [25, 120],
    text: 'A note from the old days: people from {hood} are getting together, and {names} will be there.',
    choices: [
      { label: 'Go', outcomes: [any('Older faces, the same voices. You talked about the street for hours, and about who is not there any more.', 'good', hood({ do: 'reunion', how: 'go' }), st('mood', 5))] },
      { label: 'Send your best wishes', outcomes: [any('You wrote back with news and a photograph. Two of them replied.', 'neutral', hood({ do: 'reunion', how: 'write' }))] },
    ],
  },
  {
    ...base, id: 'hood_community_project', ageRange: [10, 120],
    text: '{person} wants neighbors to {what}, and is asking who will help.',
    choices: [
      { label: 'Help lead it', requires: [need('age', '>=', 16)], outcomes: [any('Weekends of planning, digging and phone calls. When it is done, people stop to look at it.', 'good', hood({ do: 'project', how: 'lead' }), st('mood', 4))] },
      { label: 'Turn up and help on the day', outcomes: [any('Gloves, a spade, a lot of tea. Good, tired, satisfied.', 'good', hood({ do: 'project', how: 'help' }), st('mood', 2))] },
      { label: 'Wish them luck', outcomes: [any('It happens without you. It is lovely anyway.', 'neutral', hood({ do: 'project', how: 'skip' }))] },
    ],
  },
  {
    ...base, id: 'hood_building_issue', ageRange: [16, 120],
    text: 'In {building}, {issue}. Some of the residents want to do something about it together.',
    choices: [
      { label: 'Go to the residents\' meeting', outcomes: [any('Twenty people in the lobby, one agreed letter, and a deadline for {landlord}.', 'neutral', hood({ do: 'issue', how: 'meeting' }))] },
      { label: 'Add your name to a joint letter', outcomes: [any('You signed, with most of the building.', 'neutral', hood({ do: 'issue', how: 'letter' }))] },
      { label: 'Leave it to the others', outcomes: [any('Someone will sort it out. Probably.', 'neutral', hood({ do: 'issue', how: 'leave' }))] },
    ],
  },
  {
    ...base, id: 'hood_family_that_stayed', ageRange: [12, 120],
    text: '{family} has lived on {street} for {years} years, and their children grew up there. {person} remembers everyone who ever lived on it.',
    choices: [
      { label: 'Ask about the street\'s history', outcomes: [any('Who lived in your home before you, the flood, the summer of the street party. {person} has the photographs.', 'good', hood({ do: 'stayed', how: 'listen' }), st('mood', 2))] },
      { label: 'Say a friendly hello', outcomes: [any('A nod and a wave: the way the street has always done it.', 'neutral', hood({ do: 'stayed', how: 'polite' }))] },
    ],
  },
  {
    ...base, id: 'hood_unexpected_friendship', ageRange: [8, 120],
    text: 'You find out by chance that {person} loves {interest} as much as you do.',
    choices: [
      { label: 'Do it together', outcomes: [any('An afternoon becomes a habit. You did not expect to find this next door.', 'good', hood({ do: 'shared', how: 'together' }), st('mood', 3))] },
      { label: 'Swap a few stories about it', outcomes: [any('A good half hour, and a promise of more.', 'good', hood({ do: 'shared', how: 'talk' }))] },
    ],
  },
  {
    ...base, id: 'hood_different_neighbor', ageRange: [8, 120],
    text: '{person} lives a life a long way from yours, and is into {interest}, which you know nothing about. They offer to show you.',
    choices: [
      { label: 'Say yes', outcomes: [any('An hour in someone else\'s world. You understand them better, and they you.', 'good', hood({ do: 'different', how: 'learn' }), st('mood', 2))] },
      { label: 'Thank them, another time', outcomes: [any('"Any time," says {person}.', 'neutral', hood({ do: 'different', how: 'later' }))] },
    ],
  },
  {
    ...base, id: 'hood_rumor', ageRange: [16, 120],
    text: '{person} asks, carefully, whether it is true that you {rumor}. People on the street have been saying so. It is not true.',
    choices: [
      { label: 'Set it straight, kindly', outcomes: [any('You explain what really happened. {person} is relieved, and says they will put people right.', 'good', hood({ do: 'rumor', how: 'correct' }))] },
      { label: 'Laugh it off', outcomes: [any('You laugh, and say people will talk. It will blow over.', 'neutral', hood({ do: 'rumor', how: 'laugh' }))] },
      { label: 'Say it is nobody\'s business', outcomes: [any('A stiff silence. Fair, but it does not stop the talk.', 'neutral', hood({ do: 'rumor', how: 'private' }))] },
    ],
  },
];
