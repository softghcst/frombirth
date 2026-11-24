// Moments on a trip: what happens while you are away, and what you do about it. Shown one at a time after "Leave
// Now", one to three a trip depending on how long it is (engine/travel.js tripScenes, beginTrip, chooseTripScene).
//
// GAMEPLAY CONFIGURATION. Costs are fictional base units, turned into local money like every other price.
//
// A scene: id; when: what the trip must be (see engine/travel.js sceneFits): cruise, abroad, plane, partner (someone
// close is along), kids (a child under 13 is along), companion (anyone is along), alone, adult (18+), single,
// talent (a gift at 60+), leisure (not a work trip or a funeral), days (at least); weight: how often it comes up.
// text: {place} where you are (on a cruise, a port of call), {city} the city you traveled to, {country}, {who} someone along,
// {line} the cruise line, {port} a port of call.
// choices: label; cost (paid if chosen, shown on the button); and an outcome, or `risk` with two: odds of the good one.
// An outcome: text; mood, health, intellect, charm (stat changes); bond (with those along); memory (kept with the trip).

export const TRIP_SCENES = [
  // ---------- Getting there ----------
  { id: 'lost_bag', when: { plane: true }, weight: 3,
    text: 'Your suitcase did not come off the carousel in {city}. The airline says it will turn up "within a day or two".',
    choices: [
      { label: 'Buy what you need and get on with the trip', cost: 90, outcome: { text: 'New toothbrush, new shirt, new start. The bag turned up on the third day.', mood: 1 } },
      { label: 'Wait at the airport and argue', outcome: { text: 'Two hours at the desk. They found it, in another city. You lost an afternoon.', mood: -3 } },
      { label: 'Laugh it off and wear the same clothes', outcome: { text: 'You lived in one outfit for two days. It became the story everyone tells.', mood: 2, memory: 'The trip your suitcase took its own holiday.' } },
    ] },
  { id: 'upgrade', when: { plane: true }, weight: 1,
    text: 'At the gate, they ask if anyone would give up their seat for a later flight, with a voucher and an upgrade for their trouble.',
    choices: [
      { label: 'Take the later flight', outcome: { text: 'Four hours later, but in a seat that lay flat. You arrived rested and smug.', mood: 3, memory: 'The free upgrade.' } },
      { label: 'Keep your seat', outcome: { text: 'You landed on time, cramped and content.', mood: 0 } },
    ] },
  // ---------- Out and about ----------
  { id: 'stranger_tour', when: { abroad: true, leisure: true, cruise: false }, weight: 2,
    text: 'A friendly local in {place} offers to show you a side of the city tourists never see. "For a small tip," they add.',
    choices: [
      { label: 'Go with them', risk: { odds: 0.7,
        good: { text: 'Back streets, a rooftop, a bakery with no sign. The best afternoon of the trip.', mood: 5, memory: 'A stranger who showed you the real {place}.' },
        bad: { text: 'The "tour" ended at a cousin\'s shop, and the tip was not small.', mood: -2, money: -60 } } },
      { label: 'Politely say no and explore on your own', outcome: { text: 'You found your own way, slower, and that was fine.', mood: 1 } },
    ] },
  { id: 'street_food', when: { leisure: true }, weight: 3,
    text: 'There is a street stall in {place} with a long line of locals and a smell you cannot walk past.',
    choices: [
      { label: 'Join the line', cost: 8, risk: { odds: 0.8,
        good: { text: 'You still think about it. You went back twice.', mood: 4, memory: 'The best thing you ate in {place} cost almost nothing.' },
        bad: { text: 'Delicious, then a long night. You lost a day to it.', mood: -3, health: -3 } } },
      { label: 'Find a proper restaurant', cost: 45, outcome: { text: 'A good meal, a nice table, nothing to tell anyone about.', mood: 1 } },
    ] },
  { id: 'pickpocket', when: { abroad: true }, weight: 1,
    text: 'On a crowded square in {place}, you feel a hand brush your bag.',
    choices: [
      { label: 'Grab the bag and shout', risk: { odds: 0.6,
        good: { text: 'Whoever it was melted into the crowd empty-handed. Your heart pounded for an hour.', mood: -1 },
        bad: { text: 'Too late: your wallet was gone. A morning at the police station, and the cards to cancel.', mood: -5, money: -120 } } },
      { label: 'Freeze and check your pockets', risk: { odds: 0.4,
        good: { text: 'Everything was still there. You kept a hand on your bag for the rest of the trip.', mood: -1 },
        bad: { text: 'Your phone was gone. So were half the photos.', mood: -6, money: -300 } } },
    ] },
  { id: 'rain', when: { leisure: true, cruise: false }, weight: 2,
    text: 'It has rained in {place} since you arrived, and the forecast says it will not stop.',
    choices: [
      { label: 'Go out in it anyway', outcome: { text: 'Soaked, and the streets were empty and beautiful.', mood: 2, health: -1, memory: '{place} in the rain.' } },
      { label: 'Museums and cafés', cost: 30, outcome: { text: 'Warm rooms, good coffee, a painting you will remember.', mood: 2, intellect: 1 } },
      { label: 'Stay in and rest', outcome: { text: 'You slept more than you have in years. Maybe that was the holiday.', mood: 1, health: 2 } },
    ] },
  { id: 'festival_invite', when: { abroad: true, leisure: true, cruise: false }, weight: 1,
    text: 'The family at the next table invites you to a neighborhood celebration tonight. Nobody will speak your language.',
    choices: [
      { label: 'Go', outcome: { text: 'You danced badly, ate too much and were hugged by a grandmother. You will never forget it.', mood: 6, charm: 1, memory: 'A night with strangers in {place} who did not stay strangers.' } },
      { label: 'Thank them, and turn in early', outcome: { text: 'You slept well. Sometimes you wonder.', mood: 0 } },
    ] },
  { id: 'lost', when: { leisure: true, cruise: false }, weight: 2,
    text: 'Your phone is dead, the map makes no sense, and you have no idea where in {place} you are.',
    choices: [
      { label: 'Ask someone for directions', outcome: { text: 'A shopkeeper walked you halfway back, talking the whole time.', mood: 2, charm: 1 } },
      { label: 'Keep walking and see', risk: { odds: 0.65,
        good: { text: 'You found a square you would never have found on purpose.', mood: 4, memory: 'Getting lost in {place}, on purpose after that.' },
        bad: { text: 'Two hours, sore feet, and a taxi back in the end.', mood: -2, money: -25 } } },
    ] },
  { id: 'souvenir', when: { leisure: true }, weight: 2,
    text: 'In a little shop in {place}, there is something you keep coming back to look at. It is not cheap.',
    choices: [
      { label: 'Buy it', cost: 120, outcome: { text: 'It sits on a shelf at home now, and every time you see it you are back there.', mood: 3, memory: 'Something from {place}, on the shelf at home.' } },
      { label: 'Haggle', risk: { odds: 0.5,
        good: { text: 'Half the price and a handshake. You were proud of yourself for days.', mood: 4, money: -60, charm: 1 },
        bad: { text: 'The shopkeeper did not budge, and you walked out empty-handed.', mood: -1 } } },
      { label: 'Leave it', outcome: { text: 'You thought about it on the way home. Then you forgot.', mood: 0 } },
    ] },
  { id: 'sunburn', when: { leisure: true, days: 3 }, weight: 1,
    text: 'The first proper sun of the year, and you fell asleep by the water in {place}.',
    choices: [
      { label: 'Stay in the shade for the rest of the trip', outcome: { text: 'Pink, sore, and wiser.', mood: -1, health: -1 } },
      { label: 'Aloe, a hat, and back out', outcome: { text: 'You peeled on the flight home and did not care.', mood: 1, health: -2 } },
    ] },
  // ---------- Who you are with ----------
  { id: 'argument', when: { companion: true, leisure: true }, weight: 2,
    text: 'You and {who} cannot agree on what to do today, and it is turning into a real argument.',
    choices: [
      { label: 'Do what {who} wants', outcome: { text: '{who} was happy all day. That was worth it.', mood: 0, bond: 5 } },
      { label: 'Split up for the day', outcome: { text: 'You each did your own thing and had stories to swap at dinner.', mood: 2, bond: 1 } },
      { label: 'Dig in', outcome: { text: 'You won. The evening was quiet, and not the good kind.', mood: -2, bond: -6 } },
    ] },
  { id: 'kids_tired', when: { kids: true }, weight: 2,
    text: 'The children are hot, tired and done with sightseeing. It is not even lunchtime.',
    choices: [
      { label: 'Find a pool, a park or ice cream', cost: 20, outcome: { text: 'An afternoon of splashing and nothing else. They still talk about it.', mood: 3, bond: 4, memory: 'The afternoon the children remember best.' } },
      { label: 'Push on with the plan', outcome: { text: 'You saw it. Nobody else enjoyed it.', mood: -3, bond: -2 } },
    ] },
  { id: 'romantic_dinner', when: { partner: true, leisure: true }, weight: 2,
    text: 'There is a little place with a view over {place}, and a table for two is free tonight.',
    choices: [
      { label: 'Book it', cost: 110, outcome: { text: 'Candles, the lights of the city, and nothing to rush back for.', mood: 4, bond: 7, memory: 'Dinner for two above {place}.' } },
      { label: 'Picnic instead, somewhere with the same view', cost: 20, outcome: { text: 'Bread, cheese, a bottle, and the best seat in town for free.', mood: 4, bond: 6 } },
    ] },
  { id: 'new_friend', when: { alone: true, adult: true, leisure: true }, weight: 2,
    text: 'Another traveler on their own asks if the seat next to you is free, and starts talking.',
    choices: [
      { label: 'Spend the day together', outcome: { text: 'You saw the city with someone who laughed at the same things. You still write.', mood: 4, charm: 1, memory: 'A friend met on the road.' } },
      { label: 'Enjoy the quiet', outcome: { text: 'You had a good chat and went your separate ways.', mood: 1 } },
    ] },
  // ---------- Your gifts ----------
  { id: 'busker', when: { talent: true, leisure: true, cruise: false }, weight: 2,
    text: 'A street performer in {place} spots you watching and waves you up to join in.',
    choices: [
      { label: 'Join in', outcome: { text: 'A crowd gathered. Someone filmed it. For five minutes, {place} knew your name.', mood: 6, charm: 1, memory: 'Performing in the street in {place}.' } },
      { label: 'Shake your head and laugh', outcome: { text: 'You clapped along instead. Part of you wishes you had gone up.', mood: 0 } },
    ] },
  // ---------- At sea ----------
  { id: 'seasick', when: { cruise: true }, weight: 3,
    text: 'The first night at sea, the ship starts to roll, and so does your stomach.',
    choices: [
      { label: 'Go up on deck for fresh air', outcome: { text: 'Wind, stars and a steady horizon. You felt human again by midnight.', mood: 1, memory: 'A night on deck under more stars than you knew there were.' } },
      { label: 'Ask the ship\'s doctor for something', cost: 40, outcome: { text: 'One pill and you slept like a baby. The rest of the week, smooth sailing.', mood: 1, health: 1 } },
      { label: 'Tough it out in the stateroom', outcome: { text: 'A long, long night. You were fine by breakfast, mostly.', mood: -3, health: -1 } },
    ] },
  { id: 'missed_ship', when: { cruise: true }, weight: 2,
    text: 'Ashore in {port}, you lose track of time. All aboard is in twenty minutes, and the ship is across town.',
    choices: [
      { label: 'Pay a taxi whatever it takes', cost: 60, outcome: { text: 'You ran up the gangway as they were pulling it in. The crew applauded.', mood: 2, memory: 'Running for the ship in {port}.' } },
      { label: 'Run for it', risk: { odds: 0.6,
        good: { text: 'Breathless, last aboard, and laughing the whole way.', mood: 3, health: 1, memory: 'Running for the ship in {port}.' } ,
        bad: { text: 'The ship sailed without you. A flight to the next port, a night in a hotel, and a story you will tell forever.', mood: -4, money: -450, memory: 'The day the ship left without you.' } } },
    ] },
  { id: 'captains_dinner', when: { cruise: true }, weight: 1,
    text: 'An invitation slides under the stateroom door: dinner at the captain\'s table, formal dress.',
    choices: [
      { label: 'Dress up and go', cost: 40, outcome: { text: 'Gold braid, stories of storms and icebergs, and a photo with the captain.', mood: 4, charm: 1, memory: 'Dinner at the captain\'s table.' } },
      { label: 'Skip it for the buffet in your sandals', outcome: { text: 'No ties, no small talk, and dessert twice.', mood: 2 } },
    ] },
  { id: 'casino', when: { cruise: true, adult: true }, weight: 2,
    text: 'The ship\'s casino is buzzing, and you have a little holiday money left.',
    choices: [
      { label: 'Try your luck', cost: 50, risk: { odds: 0.35,
        good: { text: 'A lucky run at the tables. You walked away up, and stopped there.', mood: 4, money: 180 },
        bad: { text: 'Gone in twenty minutes. The drinks were free, at least.', mood: -1 } } },
      { label: 'Watch the show instead', outcome: { text: 'Sequins, a live band, and a standing ovation.', mood: 2 } },
    ] },
  { id: 'dolphins', when: { cruise: true }, weight: 2,
    text: 'An announcement at dawn: dolphins off the bow, for anyone awake.',
    choices: [
      { label: 'Throw on a jacket and go', outcome: { text: 'Dozens of them, leaping in the bow wave, pink in the sunrise. Worth every lost minute of sleep.', mood: 5, memory: 'Dolphins at dawn.' } },
      { label: 'Roll over and sleep', outcome: { text: 'You saw the photos at breakfast. Everyone said it was incredible.', mood: -1 } },
    ] },
  { id: 'talent_show', when: { cruise: true, talent: true }, weight: 2,
    text: 'There is a passenger talent show tonight, and the cruise director has heard you are good.',
    choices: [
      { label: 'Sign up', outcome: { text: 'You won. People stopped you in the corridors for the rest of the week.', mood: 6, charm: 2, memory: 'Winning the talent show at sea.' } },
      { label: 'Cheer from the audience', outcome: { text: 'A grandmother sang opera and won. Fair enough.', mood: 1 } },
    ] },
  // ---------- Work ----------
  { id: 'client_dinner', when: { work: true }, weight: 3,
    text: 'The client in {place} insists on taking you out, and it is clear the night will run late.',
    choices: [
      { label: 'Go, and stay to the end', outcome: { text: 'A long night, a sore head, and a deal that felt warmer in the morning.', mood: 1, health: -1, charm: 1 } },
      { label: 'Go, and leave after dinner', outcome: { text: 'Polite, professional, in bed by eleven.', mood: 1 } },
    ] },
];
export const TRIP_SCENE_BY_ID = Object.fromEntries(TRIP_SCENES.map((s) => [s.id, s]));
