// Renovations: what can be added to a home the player owns (engine/renovations.js).
//
// A home only takes what would really fit it: a studio has no room for a home theater, a condo has no yard for a
// pool. And it only takes so much: `SPACE` is how many renovations each kind of home holds (an extension adds one).
//
//   fits        the property types it can go in (data/properties.js)
//   cost        share of the home's worth the work costs, at an ordinary contractor; `min` is the least it costs, in base units
//   value       how much it adds to the home's worth, as a share. Always less than it costs: a renovation is for
//               living with, and a home is not a money machine
//   comfort     mood each year, while you live there (the home's own comfort and these together: engine/realEstate.js)
//   upkeep      change to the yearly running costs, as a share of worth (solar panels save; a pool costs)
//   from/until  the years it exists (central heating before 1920 is not a thing you can buy)
//   space       renovations it takes up (an extension makes one more)

const ALL = ['trailer', 'studio', 'condo', 'house', 'townhouse', 'country', 'mansion'];
const ROOMS = ['condo', 'house', 'townhouse', 'country', 'mansion']; // more than one room
const HOUSES = ['house', 'townhouse', 'country', 'mansion']; // a whole building of your own
const YARD = ['house', 'country', 'mansion']; // with a garden or grounds big enough for it
const BIG = ['country', 'mansion'];

/** How many renovations each kind of home has room for. */
export const SPACE = { trailer: 1, studio: 2, condo: 3, house: 6, townhouse: 5, country: 8, mansion: 10 };

/** @type {{id:string,name:string,icon:string,blurb:string,fits:string[],cost:number,min:number,value:number,comfort:number,upkeep?:number,from?:number,until?:number,space?:number}[]} */
export const RENOVATIONS = [
  // Everyday improvements
  { id: 'indoor_bathroom', name: 'Indoor bathroom', icon: '🛁', blurb: 'No more trips outside in the cold.', fits: ALL, cost: 0.05, min: 1500, value: 0.06, comfort: 3, until: 1945 },
  { id: 'central_heating', name: 'Central heating', icon: '🔥', blurb: 'Warm in every room, all winter.', fits: ALL, cost: 0.04, min: 3000, value: 0.03, comfort: 2, from: 1920 },
  { id: 'kitchen', name: 'New kitchen', icon: '🍳', blurb: 'Counters, cupboards and a stove worth cooking on.', fits: ALL, cost: 0.07, min: 9000, value: 0.045, comfort: 2 },
  { id: 'bathroom', name: 'Bathroom remodel', icon: '🚿', blurb: 'New tiles, a proper shower, and the end of the leak.', fits: ALL, cost: 0.05, min: 6000, value: 0.03, comfort: 1, from: 1940 },
  { id: 'air_conditioning', name: 'Air conditioning', icon: '❄️', blurb: 'Cool through the worst of summer.', fits: ALL, cost: 0.03, min: 3500, value: 0.015, comfort: 1, upkeep: 0.001, from: 1955 },
  { id: 'soundproofing', name: 'Soundproofing', icon: '🔇', blurb: 'The neighbors stop hearing you, and you stop hearing them.', fits: ['studio', 'condo', 'townhouse'], cost: 0.03, min: 4000, value: 0.01, comfort: 1, from: 1960 },
  { id: 'walk_in_closet', name: 'Walk-in closet', icon: '👗', blurb: 'Every shoe in sight.', fits: ROOMS, cost: 0.03, min: 5000, value: 0.015, comfort: 1, from: 1950 },
  { id: 'home_office', name: 'Home office', icon: '💻', blurb: 'A door that closes, and a desk that is only a desk.', fits: ROOMS, cost: 0.03, min: 4000, value: 0.015, comfort: 1, from: 1980 },
  { id: 'smart_home', name: 'Smart home', icon: '📱', blurb: 'Lights, locks and heating from your phone.', fits: ALL, cost: 0.02, min: 3000, value: 0.01, comfort: 1, from: 2014 },
  { id: 'solar_panels', name: 'Solar panels', icon: '☀️', blurb: 'The roof pays some of the bills.', fits: HOUSES, cost: 0.05, min: 12000, value: 0.025, comfort: 0, upkeep: -0.003, from: 1978 },
  { id: 'nursery', name: 'Nursery', icon: '🧸', blurb: 'A small room, painted soft, ready for someone small.', fits: ROOMS, cost: 0.02, min: 3000, value: 0.005, comfort: 1 },
  // Fun rooms
  { id: 'man_cave', name: 'Man cave', icon: '🛋️', blurb: 'A big chair, a bigger screen, a mini fridge, and a sign on the door.', fits: HOUSES, cost: 0.04, min: 8000, value: 0.01, comfort: 2, from: 1970 },
  { id: 'home_theater', name: 'Home theater', icon: '🎬', blurb: 'Tiered seats, a projector, and the good sound.', fits: HOUSES, cost: 0.06, min: 15000, value: 0.015, comfort: 2, from: 1985 },
  { id: 'game_room', name: 'Game room', icon: '🎱', blurb: 'A pool table, a dartboard, and arguments about the rules.', fits: HOUSES, cost: 0.04, min: 8000, value: 0.01, comfort: 2 },
  { id: 'home_gym', name: 'Home gym', icon: '🏋️', blurb: 'No membership, no excuses.', fits: ROOMS, cost: 0.03, min: 6000, value: 0.01, comfort: 1, from: 1975 },
  { id: 'music_studio', name: 'Music studio', icon: '🎸', blurb: 'Treated walls, good microphones, and somewhere loud to be.', fits: HOUSES, cost: 0.05, min: 12000, value: 0.01, comfort: 2, from: 1965 },
  { id: 'finished_basement', name: 'Finished basement', icon: '🪜', blurb: 'The room under the house becomes a room.', fits: ['house', 'country', 'mansion'], cost: 0.06, min: 15000, value: 0.04, comfort: 1 },
  { id: 'workshop', name: 'Workshop and garage', icon: '🔧', blurb: 'A bench, a vise, and every tool on a hook.', fits: HOUSES, cost: 0.04, min: 8000, value: 0.02, comfort: 1 },
  { id: 'library', name: 'Home library', icon: '📚', blurb: 'Shelves to the ceiling, and a ladder to reach them.', fits: BIG, cost: 0.03, min: 15000, value: 0.015, comfort: 2 },
  { id: 'wine_cellar', name: 'Wine cellar', icon: '🍷', blurb: 'Cool, dark, and racked to the ceiling.', fits: BIG, cost: 0.03, min: 20000, value: 0.015, comfort: 1 },
  // Outside
  { id: 'garden', name: 'Landscaped garden', icon: '🌷', blurb: 'Beds, a lawn worth lying on, and a vegetable patch.', fits: YARD, cost: 0.03, min: 5000, value: 0.025, comfort: 2 },
  { id: 'treehouse', name: 'Treehouse', icon: '🌳', blurb: 'A rope ladder, a trapdoor, and a sign that says no adults.', fits: YARD, cost: 0.01, min: 2000, value: 0.003, comfort: 1 },
  { id: 'hot_tub', name: 'Hot tub', icon: '♨️', blurb: 'Warm water under the stars.', fits: YARD, cost: 0.02, min: 6000, value: 0.005, comfort: 1, upkeep: 0.001, from: 1970 },
  { id: 'pool', name: 'Swimming pool', icon: '🏊', blurb: 'Summer starts the day it is filled.', fits: YARD, cost: 0.08, min: 30000, value: 0.03, comfort: 2, upkeep: 0.003, from: 1950 },
  { id: 'tennis_court', name: 'Tennis court', icon: '🎾', blurb: 'Your own court, and no waiting for one.', fits: BIG, cost: 0.04, min: 50000, value: 0.015, comfort: 1 },
  // Bigger
  { id: 'extension', name: 'Extension', icon: '🏗️', blurb: 'A new room built on: more space, and room for one more renovation.', fits: ['house', 'country', 'mansion'], cost: 0.12, min: 40000, value: 0.08, comfort: 1, space: -1 },
  { id: 'guest_suite', name: 'Guest suite', icon: '🛏️', blurb: 'A room with its own bathroom, for whoever comes to stay.', fits: BIG, cost: 0.04, min: 25000, value: 0.025, comfort: 1 },
];
export const RENOVATION_BY_ID = Object.fromEntries(RENOVATIONS.map((r) => [r.id, r]));

/**
 * Contractors. Every city has one of each kind, by its own name. A better firm costs more and more often does the
 * work well; a cheap one is a gamble. `odds` are the chances of a great job, a good one, and a poor one.
 */
export const CONTRACTOR_TIERS = [
  { id: 'budget', price: 0.75, stars: [2.4, 3.2], odds: { great: 0.08, good: 0.55, poor: 0.37 }, say: 'Cheap, and you get what you pay for. Often.',
    names: ['QuickFix Builders', 'Handy Brothers', 'Bargain Build Co.', 'Weekend Renovations', 'Corner Cut Contractors', 'A-1 Fix-It', 'Low Bid Building'] },
  { id: 'solid', price: 1, stars: [3.8, 4.4], odds: { great: 0.22, good: 0.68, poor: 0.10 }, say: 'Fair prices, careful work, and they call back.',
    names: ['Cornerstone Renovations', 'True Level Construction', 'Oak & Iron Builders', 'Plumb Line Homes', 'Keystone Remodeling', 'Brick & Beam'] },
  { id: 'premium', price: 1.45, stars: [4.6, 5], odds: { great: 0.5, good: 0.48, poor: 0.02 }, say: 'Expensive, and worth it: the work is beautiful and on time.',
    names: ['Sterling Craft Builders', 'Hallmark Design & Build', 'Northlight Interiors', 'Atelier Home Studio', 'Whitestone Fine Homes', 'Meridian Master Builders'] },
];
/** What taking a renovation out costs, as a share of what putting it in costs. */
export const REMOVE_COST = 0.15;
/** The most mood all of a home's renovations together add a year, so no home becomes a cure for everything. */
export const COMFORT_CAP = 6;
