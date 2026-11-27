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
    ...base, id: 'hood_wrong_parcel', ageRange: [10, 120],
    text: 'A parcel for {person} has been left at your door by mistake. It rattles a little.',
    choices: [
      { label: 'Take it round to them', outcomes: [any('{person} had been waiting for it all week. They asked you in for a cup of something, and you stayed longer than you meant to.', 'good', hood({ do: 'meet', rel: 40 }), st('mood', 2))] },
      { label: 'Leave a note through their door', outcomes: [any('{person} came to collect it that evening, with thanks and a chocolate bar.', 'neutral', hood({ do: 'meet', rel: 34 }))] },
      { label: 'Leave it on their step', outcomes: [any('It was gone by the morning. You hope it was them who took it.', 'neutral')] },
    ],
  },
  {
    ...base, id: 'hood_power_cut', ageRange: [6, 120],
    text: 'The power goes off along the whole street one evening. Through the window you can see {person} on their step with a torch, looking up and down the road.',
    choices: [
      { label: 'Go out and see if everyone is all right', outcomes: [any('Half the street was out. Someone brought candles, someone brought a guitar, and {person} told stories about the last time this happened.', 'good', hood({ do: 'meet', rel: 40 }), st('mood', 4))] },
      { label: 'Check on {person} in particular', outcomes: [any('They were fine, and glad someone thought to ask. You sat on their step until the lights came back.', 'good', hood({ do: 'meet', rel: 44 }), hid('karma', 1))] },
      { label: 'Light a candle and wait it out inside', outcomes: [any('An evening of candlelight and no screens. It was oddly nice.', 'neutral', st('mood', 1))] },
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
  {
    ...base, id: 'hood_need_hand', ageRange: [12, 120],
    text: '{person} from down the street asks, a little awkwardly, whether you could help them {need}.',
    choices: [
      { label: 'Of course', outcomes: [any('It took a few hours, and {person} would not stop thanking you.', 'good', hood({ do: 'help', how: 'help' }), hid('karma', 2), st('mood', 2))] },
      { label: 'Suggest someone better placed to help', outcomes: [any('You gave them the number of someone who does it for a living. {person} was grateful for that too.', 'neutral', hood({ do: 'help', how: 'suggest' }))] },
      { label: 'Say kindly that you cannot this time', outcomes: [any('{person} said it was no trouble to ask. It was not.', 'neutral', hood({ do: 'help', how: 'decline' }))] },
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
