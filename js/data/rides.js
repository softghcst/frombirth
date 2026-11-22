// Rides out on something you own (engine/vehicles.js ride): how fast each kind goes at each pace, and what can happen
// on the way. An encounter's options each lean on something (a stat, a talent, fighting skill) or on nothing but luck;
// fx are what follows: mood, health, cash (base units), karma, charm, followers, and 'hurt' (an injury), 'lost' (the
// vehicle is gone). {vehicle}, {city} and {move} are filled in. `classes`: the kinds of vehicle it can happen on.
export const PACES = [
  { id: 'leisurely', name: 'Leisurely', speed: 0.6, joy: 0, risk: 0.3 },
  { id: 'cruising', name: 'Cruising', speed: 1, joy: 4, risk: 0.6 },
  { id: 'speedy', name: 'Speedy', speed: 1.45, joy: 8, risk: 1.4 },
];
export const DURATIONS = [15, 30, 45, 60, 90, 120];
/** km/h at a cruising pace. */
export const CRUISE_SPEED = { cycle: 16, bike: 55, car: 50, boat: 25 };
export const RIDES_A_YEAR = 3;

const O = (label, lean, good, bad = good, extra = {}) => ({ label, lean, good, bad, ...extra });
const E = (id, classes, text, options) => ({ id, classes, text, options });
const ALL = ['cycle', 'bike', 'car'];

export const ENCOUNTERS = [
  E('street_race', ALL, 'At a red light in {city}, a crew on tricked-out bikes pulls up beside you and revs. "Race you to the bridge. Loser buys the tacos."', [
    O('Accept the challenge', 'talents.sports', ['You leave them in a cloud of smugness. Free tacos and a nickname you will never live down.', { mood: 8, charm: 1 }], ['You come a very public last, and buy eleven tacos.', { mood: -3, cash: -40 }]),
    O('Politely decline', null, ['"Maybe next time," you say. They roar off to annoy someone else.', { mood: 1 }]),
    O('Lecture them about road safety', 'stats.charm', ['Somehow it lands. One of them thanks you, then rides off exactly as fast.', { karma: 3, mood: 2 }], ['They laugh so hard one of them falls over. It is going online.', { mood: -4 }]),
    O('Ignore them', null, ['You stare straight ahead until the light changes. Power move.', { mood: 1 }]),
  ]),
  E('goose', ['cycle'], 'A goose is standing in the middle of the path. It has seen you. It is not moving. It is hissing.', [
    O('Ride straight through it', 'stats.health', ['The goose respects strength. It steps aside, muttering.', { mood: 4 }], ['The goose does not respect strength. It bites you twice and chases you for half a mile.', { health: -4, mood: -3 }]),
    O('Offer it part of your sandwich', 'stats.charm', ['You and the goose have an understanding now. It escorts you to the end of the path.', { mood: 6, karma: 2 }], ['It takes the sandwich, and then your other sandwich, and then bites you.', { health: -2, mood: -2 }]),
    O('Film it', 'stats.charm', ['"Goose blocks path, refuses to negotiate" gets passed around half the internet.', { followers: 400, mood: 4 }], ['You get eleven seconds of a blurry goose and one of your own scream.', { mood: 1 }]),
    O('Go around the long way', null, ['Twenty extra minutes. The goose wins. The goose always wins.', { mood: -1 }]),
  ]),
  E('shopping_cart', ALL, 'A runaway shopping cart is rolling downhill toward a very expensive parked car. Nobody else has noticed.', [
    O('Chase it down', 'talents.sports', ['You catch it inches from the paintwork. The owner comes out just in time to see, and insists on giving you something for it.', { cash: 50, karma: 4, mood: 6 }], ['You miss by a foot. The crunch echoes. You leave quickly.', { mood: -2 }]),
    O('Film it, just in case', null, ['It stops itself against the curb, which is a terrible video. You delete it.', { mood: 0 }]),
    O('Let fate decide', null, ['Fate decides on the car. You hear about it on the local news.', { mood: 1 }]),
  ]),
  E('chicken_suit', ALL, 'A man in a full chicken costume flags you down. "Is this the way to the audition? I am SO late."', [
    O('Give him directions', 'stats.intellect', ['You send him the right way. Later you see an ad with a dancing chicken in it, and it is him. He nailed it.', { karma: 3, mood: 4 }], ['You send him confidently the wrong way. Somewhere, a chicken is still walking.', { mood: 1 }]),
    O('Ask which audition', 'talents.acting', ['"A commercial." He looks you up and down. "They need a second chicken." You go. You get the part.', { cash: 200, mood: 8 }], ['"Not for you," he says, and flaps away.', { mood: -1 }]),
    O('Keep going', null, ['You leave a confused chicken behind. You think about him for days.', {}]),
  ]),
  E('conga', ALL, 'A wedding party in full formalwear is doing a conga line straight down the middle of the road.', [
    O('Join the conga line', 'talents.dance', ['You end up at the reception, in a photo, and holding a slice of cake. Nobody asks who you are.', { mood: 10, charm: 1 }], ['You knock over the best man. The bride is not amused.', { mood: -2 }]),
    O('Wait for it to pass', null, ['It takes eleven minutes. It is quite nice, honestly.', { mood: 2 }]),
    O('Ring your bell, or honk', null, ['They cheer, as if you are part of it. You sort of are now.', { mood: 3 }]),
  ]),
  E('dog_chase', ['cycle'], 'A large dog has decided you are the most interesting thing in the world, and is gaining on you fast.', [
    O('Pedal like your life depends on it', 'stats.health', ['You outrun it, barely. Your legs will remember this tomorrow.', { health: 2, mood: 3 }], ['It catches up, and only wants to be friends. You are both out of breath.', { mood: 2 }]),
    O('Stop and pet it', 'stats.charm', ['Best decision of the week. Its owner jogs up, apologizing, and you end up chatting for an hour.', { mood: 8 }], ['It was not after pets. It was after your shoe, and it got it.', { mood: -3 }]),
    O('Throw your snack behind you', null, ['Classic. The dog stops for the snack. You ride off a little hungrier.', { mood: 1 }]),
  ]),
  E('wallet', ALL, 'A wallet is lying on the road. It is fat with cash, and there is an ID inside.', [
    O('Return it to the owner', null, ['The owner nearly cries, and insists on a reward you try to refuse.', { karma: 8, cash: 60, mood: 6 }]),
    O('Keep the cash', null, ['It is a good afternoon, financially. You feel strange about it for a while.', { cash: 300, karma: -10, mood: -1 }]),
    O('Hand it in to the police', null, ['The officer looks surprised that anyone still does this.', { karma: 6, mood: 3 }]),
  ]),
  E('wheelie_bet', ['cycle', 'bike'], 'A street performer bets you twenty bucks you cannot hold a wheelie past the lamppost.', [
    O('Pop the wheelie', 'talents.sports', ['Past the lamppost and the next one. The crowd claps. You collect.', { cash: 20, mood: 7 }], ['You make it about a foot and land on your back. The crowd also claps.', { health: -3, cash: -20, mood: -2 }]),
    O('Decline', null, ['"Coward," he says, cheerfully.', {}]),
  ]),
  E('snatch', ALL, 'Someone grabs your {vehicle} at a crossing and tells you to let go of it.', [
    O('Use your {move}', 'martial', ['It is over in a second. The thief is on the ground wondering what happened, and the people watching start clapping.', { mood: 8, karma: 2 }], ['You go for the {move}, and they shove you off and ride away with it.', { mood: -8, lost: true }], { needsMove: true }),
    O('Fight them for it', 'stats.health', ['You hang on and shout until they give up and run.', { mood: 3 }], ['They shove you to the ground and take it.', { health: -6, mood: -8, lost: true }]),
    O('Let it go', null, ['You let go. It is only a vehicle, and you are fine. You report it, for what that is worth.', { mood: -6, lost: true }]),
    O('Yell for help', 'stats.charm', ['Three strangers turn up at once and the thief bolts.', { mood: 4 }], ['Nobody comes. They ride off with it.', { mood: -6, lost: true }]),
  ]),
  E('llama', ALL, 'A man in a bathrobe is sprinting down the road after an escaped llama. "HELP ME CATCH GERALD!"', [
    O('Help catch Gerald', 'talents.sports', ['You corner Gerald by the bakery. The man gives you a hug and a jar of something homemade.', { mood: 8, karma: 4 }], ['Gerald spits on you and escapes into a park. You did your best.', { mood: 2 }]),
    O('Film the chase', 'stats.charm', ['"Man in bathrobe chases llama" is everywhere by night.', { followers: 800, mood: 5 }], ['Your video is mostly your thumb.', {}]),
    O('Keep going', null, ['You hear later that Gerald was caught in a shopping mall.', {}]),
  ]),
  E('drone', ALL, 'A delivery drone follows you for three blocks, then drops a box in front of you. The label just says "FOR YOU".', [
    O('Open it', null, ['It is a coupon for a free pizza and a single, very good cookie.', { mood: 5 }]),
    O('Leave it alone', null, ['Probably wise. You will wonder about it forever.', {}]),
  ]),
  E('flat_tire', ALL, 'Your tire goes flat in the middle of nowhere, and your phone is at four percent.', [
    O('Fix it yourself', 'stats.intellect', ['Twenty minutes, dirty hands, and a feeling of real competence.', { mood: 4 }], ['You make it worse. You walk home.', { mood: -4 }]),
    O('Flag someone down', 'stats.charm', ['A retired mechanic stops, fixes it, and tells you his life story. Lovely man.', { mood: 5 }], ['Nobody stops for an hour.', { mood: -3 }]),
    O('Call home', null, ['Somebody comes to get you, with a speech about phones and charging them.', { mood: -1 }]),
  ]),
  E('celebrity', ALL, 'A famous actor is at the next table at the café where you stop. Nobody else seems to have noticed.', [
    O('Ask for a selfie', 'stats.charm', ['They say yes, and even pull a face for it. The photo does numbers.', { followers: 300, mood: 7 }], ['They say no, politely, and leave soon after.', { mood: -2 }]),
    O('Play it cool', null, ['You give a small nod. They give one back. It is the coolest you have ever been.', { mood: 4, charm: 1 }]),
  ]),
];
export const ENCOUNTER_BY_ID = Object.fromEntries(ENCOUNTERS.map((e) => [e.id, e]));
