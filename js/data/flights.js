// What can happen in the air, by cabin and seat (engine/flight.js): a moment halfway through a flight, shown during the
// journey scene (js/ui/journey.js). First class is mostly good; business class a mix; economy a gamble, with the
// window and the aisle each bringing their own. Not every flight has one: long flights more often.
//
//   cabin   which cabins it can happen in        seat   'window' | 'aisle', where it needs one
//   choices [{ label, cost?, outcome | risk: { odds, good, bad } }]
//   outcome { text, mood?, health?, charm?, intellect?, money?, contact?: 'famous'|'business'|'friend', work?, arrive?: 'rested'|'tired' }
// {from} and {to} are the cities. Costs and money are in base units (localized where they are paid).

export const FLIGHT_MOMENTS = [
  // ---------- First class ----------
  { id: 'first_champagne', cabin: ['first'], weight: 3,
    text: 'Somewhere over the ocean, the attendant pours champagne and asks how you would like your steak.',
    choices: [
      { label: 'Medium rare, and another glass', outcome: { text: 'The best meal you have had at thirty thousand feet, or perhaps anywhere.', mood: 4 } },
      { label: 'Just the dessert trolley', outcome: { text: 'You worked through the cheese, the tart and the chocolates, slowly.', mood: 3 } },
      { label: 'Sleep through it', outcome: { text: 'They made up your bed with real sheets. You woke an hour from {to}.', mood: 2, arrive: 'rested' } },
    ] },
  { id: 'first_famous', cabin: ['first'], weight: 2,
    text: 'The person in the next suite looks familiar. Then it comes to you: you have seen them on screens everywhere.',
    choices: [
      { label: 'Say hello', risk: { odds: 0.7,
        good: { text: 'They were lovely, and bored. You talked the whole way. They gave you their number.', mood: 4, charm: 1, contact: 'famous' },
        bad: { text: 'They smiled, put their headphones on, and that was that.', mood: -1 } } },
      { label: 'Leave them in peace', outcome: { text: 'You let them be. At the door they nodded at you, as if to say thank you.', mood: 1 } },
    ] },
  { id: 'first_bed', cabin: ['first'], weight: 3,
    text: 'The lights go down. Your seat turns into a bed, with pajamas and a duvet.',
    choices: [
      { label: 'Sleep properly', outcome: { text: 'Eight hours, flat. You landed in {to} rested, ready for anything.', health: 2, arrive: 'rested' } },
      { label: 'Watch films till dawn', outcome: { text: 'Three films and a bowl of ice cream. Worth it.', mood: 3 } },
    ] },
  { id: 'first_name', cabin: ['first'], weight: 2,
    text: 'The crew knows your name, your drink, and that it is your first time flying like this.',
    choices: [
      { label: 'Ask for the tour of the galley', outcome: { text: 'The chef showed you how they cook up here. You came away with a recipe.', mood: 3, intellect: 1 } },
      { label: 'Stretch out and enjoy it', outcome: { text: 'You stretched out, and let yourself be looked after.', mood: 3 } },
    ] },

  // ---------- Business class ----------
  { id: 'biz_executive', cabin: ['business'], weight: 3,
    text: 'The executive beside you sees what you do for a living on your laptop, and starts asking questions.',
    choices: [
      { label: 'Talk shop', risk: { odds: 0.6,
        good: { text: 'An hour later you had a business card, and an offer to call when you are back.', mood: 2, contact: 'business' },
        bad: { text: 'They mostly wanted to talk about themselves. You learned a lot about their boat.', mood: -1 } } },
      { label: 'Politely put your headphones on', outcome: { text: 'You found a film, and they found someone else to talk to.', mood: 1 } },
    ] },
  { id: 'biz_work', cabin: ['business'], weight: 3,
    text: 'There is a desk, a power socket and nothing to distract you for six hours.',
    choices: [
      { label: 'Get ahead on work', outcome: { text: 'You landed with a week of work done. Your boss will notice.', work: 4, mood: -1 } },
      { label: 'Do nothing at all', outcome: { text: 'You did nothing at all, and it was wonderful.', mood: 3 } },
    ] },
  { id: 'biz_chatty', cabin: ['business'], weight: 2,
    text: 'You want to sleep. The person across the aisle wants to tell you their whole life.',
    choices: [
      { label: 'Listen anyway', outcome: { text: 'Hours of it. They were kind, and you landed exhausted.', charm: 1, arrive: 'tired' } },
      { label: 'Ask the crew for an eye mask', outcome: { text: 'Mask on, seat flat. You got some sleep.', health: 1 } },
    ] },
  { id: 'biz_lounge', cabin: ['business'], weight: 2,
    text: 'Before boarding, the lounge: a buffet, showers, and quiet.',
    choices: [
      { label: 'Shower and eat', outcome: { text: 'You boarded fed and fresh, and slept most of the way.', mood: 2, arrive: 'rested' } },
      { label: 'Try every cocktail', risk: { odds: 0.5,
        good: { text: 'A happy, sleepy flight.', mood: 3 },
        bad: { text: 'You landed in {to} with a headache and no memory of the film.', mood: -2, health: -1 } } },
    ] },

  // ---------- Economy ----------
  { id: 'eco_baby', cabin: ['economy'], weight: 3,
    text: 'The baby in the row behind has decided not to sleep. Neither, now, will you.',
    choices: [
      { label: 'Offer the parents a hand', outcome: { text: 'You walked the baby up and down the aisle until it fell asleep on your shoulder. The parents nearly cried.', mood: 2, charm: 1 } },
      { label: 'Turn the volume up and suffer', outcome: { text: 'It cried from takeoff to landing. You arrived wrecked.', mood: -3, arrive: 'tired' } },
    ] },
  { id: 'eco_armrest', cabin: ['economy'], weight: 3,
    text: 'The person in the middle seat has claimed both armrests, and is not giving them back.',
    choices: [
      { label: 'Reclaim yours, elbow first', risk: { odds: 0.5,
        good: { text: 'A silent war, won. The armrest is yours.', mood: 1 },
        bad: { text: 'Six hours of elbow wrestling. Nobody won.', mood: -3 } } },
      { label: 'Let it go', outcome: { text: 'You let it go. You were cramped, but at peace.', mood: -1 } },
    ] },
  { id: 'eco_recline', cabin: ['economy'], weight: 2,
    text: 'The seat in front reclines all the way back, into your knees, and your dinner.',
    choices: [
      { label: 'Ask them nicely to come up a little', risk: { odds: 0.6,
        good: { text: 'They apologized, and came up. Small victories.', mood: 1 },
        bad: { text: '"I paid for this seat." It stayed back the whole way.', mood: -2 } } },
      { label: 'Eat with your tray at your chin', outcome: { text: 'You ate dinner like a T. rex. It was not dignified.', mood: -2 } },
    ] },
  { id: 'eco_turbulence', cabin: ['economy', 'business'], weight: 2,
    text: 'The seatbelt sign comes on. Then the coffee leaves its cup.',
    choices: [
      { label: 'Grip the armrests and breathe', outcome: { text: 'Twenty bumpy minutes, then smooth air. Your shirt will never be the same.', mood: -2 } },
      { label: 'Make a joke of it with your neighbor', outcome: { text: 'You laughed your way through it, and made a friend for the flight.', mood: 1, charm: 1 } },
    ] },
  { id: 'eco_snacks', cabin: ['economy'], weight: 2,
    text: 'The stranger next to you opens a huge bag of homemade snacks, and holds it out to you.',
    choices: [
      { label: 'Take some, and get talking', outcome: { text: 'The best thing you ate all trip, and a new friend from {to}. You swapped numbers.', mood: 3, contact: 'friend' } },
      { label: 'Say no thank you', outcome: { text: 'You said no thank you. It smelled amazing.', mood: -1 } },
    ] },
  { id: 'eco_overbooked', cabin: ['economy'], weight: 1,
    text: 'The flight is overbooked. They want a volunteer to take the next flight, with a voucher for the trouble.',
    choices: [
      { label: 'Volunteer', outcome: { text: 'A later flight, and a voucher in your pocket.', money: 300, mood: 1 } },
      { label: 'Keep your seat', outcome: { text: 'Someone else volunteered. You flew on time.', mood: 0 } },
    ] },
  { id: 'eco_upgrade', cabin: ['economy'], weight: 1,
    text: 'An attendant crouches by your seat. "There is a free seat up front. Would you like it?"',
    choices: [
      { label: 'Yes, please', outcome: { text: 'You spent the rest of the flight in a seat that lay flat. You landed rested and smug.', mood: 4, arrive: 'rested' } },
      { label: 'Stay with your row', outcome: { text: 'You stayed. Your row cheered when they heard.', mood: 1, charm: 1 } },
    ] },
  // The window: the view, and being trapped.
  { id: 'eco_window_view', cabin: ['economy', 'business'], seat: 'window', weight: 3,
    text: 'Out of your window: the sun coming up over the clouds, gold and pink, for as far as you can see.',
    choices: [
      { label: 'Take a photo', outcome: { text: 'The photo did not do it justice. You will remember it anyway.', mood: 3 } },
      { label: 'Just watch', outcome: { text: 'You watched until the light was all the way up. The best seat on the plane.', mood: 4 } },
    ] },
  { id: 'eco_window_trapped', cabin: ['economy'], seat: 'window', weight: 2,
    text: 'You need the bathroom. Both people between you and the aisle are fast asleep.',
    choices: [
      { label: 'Climb over them', risk: { odds: 0.5,
        good: { text: 'A perfect, silent climb. Nobody woke.', mood: 1 },
        bad: { text: 'You stepped on a foot, then a lap, then a dinner tray. Everyone woke.', mood: -2, charm: -1 } } },
      { label: 'Wait it out', outcome: { text: 'Two hours. You will never drink that much water before a flight again.', mood: -2 } },
    ] },
  // The aisle: legroom, and the trolley.
  { id: 'eco_aisle_trolley', cabin: ['economy'], seat: 'aisle', weight: 3,
    text: 'The drinks trolley clips your elbow, again. But you are first in line for everything.',
    choices: [
      { label: 'Stretch your legs into the aisle anyway', risk: { odds: 0.6,
        good: { text: 'You stretched out, and dodged the trolley every time.', mood: 2 },
        bad: { text: 'The trolley ran over your foot. Twice.', mood: -2, health: -1 } } },
      { label: 'Ask for an extra snack', outcome: { text: 'Being on the aisle has its perks: two snacks, and first pick of dinner.', mood: 2 } },
    ] },
  { id: 'eco_aisle_walk', cabin: ['economy'], seat: 'aisle', weight: 2,
    text: 'Your legs are aching. On the aisle, at least, you can get up whenever you like.',
    choices: [
      { label: 'Walk to the back and stretch', outcome: { text: 'You got chatting to the crew at the back, who gave you a cup of tea.', mood: 2, health: 1 } },
      { label: 'Stay put and sleep', outcome: { text: 'Someone bumped you awake every twenty minutes.', mood: -1, arrive: 'tired' } },
    ] },
];
export const FLIGHT_MOMENT_BY_ID = Object.fromEntries(FLIGHT_MOMENTS.map((m) => [m.id, m]));

/** How likely a flight is to have a moment: short hops seldom, long flights often. */
export const momentChance = (hours) => Math.min(0.85, 0.3 + hours / 20);

/** The seats: rows by cabin, the window and aisle letters. */
export const SEATS = {
  first: { rows: [1, 2], window: ['A', 'K'], aisle: ['A', 'K'] },
  business: { rows: [5, 11], window: ['A', 'K'], aisle: ['C', 'H'] },
  economy: { rows: [21, 48], window: ['A', 'K'], aisle: ['C', 'D', 'G', 'H'] },
};
