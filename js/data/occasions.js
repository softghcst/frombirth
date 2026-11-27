// What a year can hold besides work and school: birthdays, school dances,
// family occasions, holidays, traditions, invitations and evenings with friends.
//
// From Birth is lived a year at a time, so none of this has a date. Each entry
// says who it is for, when in a life it can happen, and, so that a life set in
// another time or place gets the right things, the first year it exists and the
// countries it belongs to.
//   since      the first year it happens at all (a later historical-eras system can narrow this further)
//   countries  where it is part of life; omitted means everywhere
//   cost       base units, at local prices; `perGuest` is added for each guest
//   bond       how much closer it brings each guest (before the yearly cap)
//   memorable  it goes in the life story

/** Birthdays worth marking for the player or someone close. A child's first, coming of age, the round numbers. */
export const MILESTONE_BIRTHDAYS = [1, 10, 13, 16, 18, 21, 30, 40, 50, 60, 70, 75, 80, 90, 100];
/** Wedding anniversaries with a name. */
export const NAMED_ANNIVERSARIES = { 1: 'paper', 5: 'wood', 10: 'tin', 15: 'crystal', 20: 'china', 25: 'silver', 30: 'pearl', 40: 'ruby', 50: 'golden', 60: 'diamond' };

/** How big to make it. Costs are base units at local prices. */
export const STYLES = {
  small: { name: 'Something small', blurb: 'At home, a few people, a cake.', cost: 40, perGuest: 15, bond: 3, mood: 3 },
  party: { name: 'A proper party', blurb: 'Food, music, and everyone who matters.', cost: 200, perGuest: 35, bond: 5, mood: 6 },
  big: { name: 'Pull out all the stops', blurb: 'A hired hall, a caterer, a night to remember.', cost: 1200, perGuest: 90, bond: 7, mood: 9 },
};

// Who an occasion is for, and whether guests are chosen.
//   for: 'self' | 'npc' (someone close whose occasion it is) | 'family' | 'friends'
export const OCCASIONS = {
  birthday: { name: 'Your birthday', kind: 'birthday', for: 'self', minAge: 2, guests: true, styles: ['small', 'party', 'big'], milestone: true },
  their_birthday: { name: 'A birthday', kind: 'birthday', for: 'npc', minAge: 8, guests: true, styles: ['small', 'party', 'big'], milestone: true },
  anniversary: { name: 'Your wedding anniversary', kind: 'family', for: 'npc', minAge: 18, guests: false, styles: ['small', 'party', 'big'], memorableYears: [10, 25, 40, 50, 60] },
  prom: { name: 'Prom', kind: 'school', for: 'self', since: 1930, countries: 'us ca', minAge: 16, maxAge: 19, guests: 'date', cost: 350, bond: 6, mood: 10, memorable: true,
    blurb: 'The dress or the suit, the photos on the stairs, the music too loud.' },
  formal: { name: 'The school formal', kind: 'school', since: 1960, countries: 'au nz', minAge: 16, maxAge: 19, for: 'self', guests: 'date', cost: 300, bond: 6, mood: 9, memorable: true,
    blurb: 'The last big night of school, in a hired hall.' },
  leavers_ball: { name: 'The leavers\' prom', kind: 'school', since: 2000, countries: 'uk ie', minAge: 16, maxAge: 18, for: 'self', guests: 'date', cost: 250, bond: 5, mood: 9, memorable: true,
    blurb: 'A newer custom here, and everyone goes.' },
  // [default] Homecoming: an American high-school tradition, the football game and the dance; dated here from 1930.
  homecoming: { name: 'Homecoming', kind: 'school', since: 1930, countries: 'us', minAge: 14, maxAge: 18, for: 'self', guests: 'date', cost: 120, bond: 5, mood: 7, memorable: true,
    blurb: 'The game on Friday, the dance on Saturday, and a corsage that wilts by ten.' },
  school_dance: { name: 'The school dance', kind: 'school', since: 1950, countries: 'us ca au nz uk ie', minAge: 12, maxAge: 18, for: 'self', guests: 'friends', cost: 20, bond: 3, mood: 5,
    blurb: 'A gym with the lights down and a playlist someone\'s brother made.' },
  graduation_party: { name: 'A graduation party', kind: 'school', for: 'self', minAge: 15, guests: true, styles: ['small', 'party'], memorable: true },
  visit_grandparents: { name: 'Visit your grandparents', kind: 'family', for: 'family', minAge: 3, guests: false, cost: 30, bond: 6, mood: 4, tradition: true,
    blurb: 'A day at their table, and the same stories as last time, which is the point.' },
  family_reunion: { name: 'A family reunion', kind: 'family', for: 'family', minAge: 21, guests: 'family', styles: ['party', 'big'], tradition: true, memorable: true,
    blurb: 'Everyone, from every branch, in one place.' },
  // Family customs that only exist as traditions: nobody "celebrates" Sunday dinner once. They start when a family
  // decides they will happen every year (engine/moments.js), and `title` names them ({family}: "the Garcias'"; {last}: "Garcia").
  sunday_dinner: { name: 'Sunday dinners', kind: 'family', for: 'family', guests: 'family', traditionOnly: true, tradition: true, cost: 40, perGuest: 8, bond: 3, mood: 3,
    title: "Sunday dinners at the {family}", blurb: 'The same table, the same chairs, most Sundays of the year.' },
  family_trip: { name: 'The family trip', kind: 'family', for: 'family', guests: 'family', traditionOnly: true, tradition: true, since: 1920, cost: 300, perGuest: 90, bond: 5, mood: 6,
    title: 'The {last} family summer trip', blurb: 'The same week every summer, the car packed the night before.' },
  birthday_breakfast: { name: 'Birthday breakfasts', kind: 'family', for: 'family', guests: 'family', traditionOnly: true, tradition: true, cost: 10, perGuest: 3, bond: 2, mood: 3,
    title: 'Birthday breakfasts in bed', blurb: 'Whoever has the birthday stays in bed, and the rest bring it up on a tray.' },
  summers_grandparents: { name: 'Summers with the grandparents', kind: 'family', for: 'family', guests: 'family', traditionOnly: true, tradition: true, cost: 60, bond: 5, mood: 5,
    title: "Summers at the grandparents'", blurb: 'A few weeks every summer at their place, and nobody in a hurry.' },
  family_game_night: { name: 'Family game night', kind: 'family', for: 'family', guests: 'family', traditionOnly: true, tradition: true, since: 1930, cost: 10, bond: 3, mood: 4,
    title: 'Friday game nights', blurb: 'One board game, one table, and an argument about the rules every single week.' },
  sleepover: { name: 'A sleepover', kind: 'social', for: 'friends', minAge: 7, maxAge: 14, guests: 'friends', cost: 25, bond: 5, mood: 6,
    blurb: 'Sleeping bags, too many snacks, nobody asleep before two.' },
  dinner_party: { name: 'A dinner party', kind: 'social', for: 'friends', minAge: 20, guests: 'friends', cost: 60, perGuest: 20, bond: 4, mood: 4,
    blurb: 'A long table and a longer evening.' },
  game_night: { name: 'A games night', kind: 'social', for: 'friends', minAge: 14, guests: 'friends', cost: 15, bond: 3, mood: 4,
    blurb: 'Cards, a board game, and an argument about the rules.' },
};
/** Evenings with friends a year can hold, before it is simply too much. */
export const SOCIAL_PER_YEAR = 4;
/** The most closer anyone can get to the player from occasions in one year. */
export const BOND_CAP = 12;

// ---------- Holidays ----------
// Only the ones people mark at home with family. `countries` lists where it is widely kept.
const XMAS = 'us uk ca au nz ie de fr it es pt nl be at ch se no dk fi pl cz hu ro gr br ar mx co cl pe ve uy py bo ec cr gt ht ni pa sv do cu jm bs bz gy aw pr ph za ng gh ke ug ao cd et ru ua ge rs hr sk ee ad mc';
const EID = 'eg ma dz tn sa ae kw qa jo iq sy lb ir af pk bd id my ng dj';
export const HOLIDAYS = [
  { id: 'new_year', name: 'New Year', blurb: 'Staying up for midnight together.', cost: 40, bond: 3, mood: 4 },
  { id: 'christmas', name: 'Christmas', countries: XMAS, blurb: 'A tree, a long lunch, presents for the children.', cost: 250, perGuest: 30, bond: 5, mood: 6 },
  { id: 'eid', name: 'Eid al-Fitr', countries: EID, blurb: 'The end of the fast: new clothes, visits, a table full of food.', cost: 200, perGuest: 25, bond: 5, mood: 6 },
  { id: 'diwali', name: 'Diwali', countries: 'in np sg my', blurb: 'Lamps in every window, candy, family from across the city.', cost: 180, perGuest: 20, bond: 5, mood: 6 },
  { id: 'lunar_new_year', name: 'Lunar New Year', countries: 'cn tw hk sg my vn kr', blurb: 'The reunion dinner, and red envelopes for the young.', cost: 220, perGuest: 30, bond: 6, mood: 6 },
  { id: 'thanksgiving', name: 'Thanksgiving', countries: 'us ca', since: 1863, blurb: 'A turkey, the whole family, and the same arguments every year.', cost: 150, perGuest: 20, bond: 5, mood: 5 },
  { id: 'hanukkah', name: 'Hanukkah', countries: 'il', blurb: 'Eight nights of candles, and fried food for all of them.', cost: 120, perGuest: 15, bond: 4, mood: 5 },
  { id: 'day_of_dead', name: 'Day of the Dead', countries: 'mx', blurb: 'An altar for the family who have gone, and a meal for the ones who are here.', cost: 100, perGuest: 10, bond: 5, mood: 4 },
  { id: 'carnival', name: 'Carnival', countries: 'br', blurb: 'Four days of music in the street.', cost: 120, bond: 3, mood: 7 },
  { id: 'nowruz', name: 'Nowruz', countries: 'ir af kz', blurb: 'The new year at the spring equinox: a laid table and visits to the elders.', cost: 150, perGuest: 15, bond: 5, mood: 5 },
  { id: 'halloween', name: 'Halloween', countries: 'us ca ie', since: 1950, minAge: 4, maxAge: 13, blurb: 'A costume, a bag, and every door on the street.', cost: 30, bond: 2, mood: 6 },
];

// ---------- Invitations ----------
// What other people ask the player to. The year decides how it arrives.
export const INVITES = [
  { id: 'friend_birthday', name: 'birthday party', from: ['friend', 'classmate'], minAge: 6, gift: 25, bond: 4 },
  { id: 'family_dinner', name: 'family dinner', from: ['parent', 'sibling', 'grandparent'], minAge: 18, gift: 0, bond: 4 },
  { id: 'colleague_drinks', name: 'leaving drinks', from: ['coworker', 'colleague'], minAge: 18, gift: 15, bond: 3 },
  { id: 'wedding', name: 'wedding', from: ['friend', 'sibling', 'relative'], minAge: 16, gift: 120, bond: 7, memorable: true },
];
/**
 * How an invitation arrives: the newest way the time and place have (engine/digital/tech.js decides what has
 * arrived where), and the words for it. Checked in this order.
 */
export const INVITE_WAYS = [
  { id: 'message', tech: 'mobile', minAge: 12, text: 'A message' },
  { id: 'call', tech: 'landline', text: 'A phone call' },
  { id: 'card', tech: 'post', text: 'A card through the door' },
  { id: 'word', tech: null, text: 'Word passed along' },
];

// ---------- Traditions ----------
/** Years a tradition can be skipped in a row before it fades. */
export const TRADITION_LAPSE = 3;
