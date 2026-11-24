// Cruises: the lines, the sailings, the staterooms, and everything that costs extra on board. The numbers behind the
// cruise steps of the trip planner (engine/travel.js, ui/globalLife.js).
//
// GAMEPLAY CONFIGURATION, NOT TRAVEL ADVICE.
//   - The cruise lines are made up. Each stands for a kind of line (value, big-ship family, premium, luxury,
//     expedition, adults only, the old ocean liners), so they behave the way that kind of line does.
//   - Prices are fictional base units, turned into local money like every other price in the game (util.localMoney).
//     Their shape follows how cruises are sold: a fare per person per night for two sharing a stateroom, a single
//     supplement for one, less for a third and fourth guest; port fees and taxes, a daily service charge (gratuities)
//     and every package on top, unless the line includes them.
//   - Years are broad: when a kind of line, stateroom or package became common, not the first of its kind.

/**
 * The lines. tier: what kind of line. perNight: the fare per person per night, two sharing an inside stateroom (base
 * units). gratuity: the daily service charge per person (0 when included). includes: what the fare already covers.
 * kids: 'club' (a kids' club and family staterooms), 'welcome' (children may come, little is laid on for them), or
 * 'adults' (18 and over only). solo: studio staterooms for one, without the single supplement. regions: where it sails.
 * mood: what a week on board does for the traveler, on top of the trip itself.
 */
export const CRUISE_LINES = [
  { id: 'grand_ocean', name: 'Grand Ocean Line', tier: 'Ocean liner', from: 1900, to: 1975, perNight: 95, gratuity: 0, includes: ['gratuities'],
    kids: 'welcome', regions: ['transatlantic', 'med', 'caribbean'], mood: 2,
    blurb: 'Steamer trunks, deck chairs, and dressing for dinner every night.' },
  { id: 'sunward', name: 'Sunward Cruise Line', tier: 'Value', from: 1970, perNight: 62, gratuity: 14, includes: [],
    kids: 'club', regions: ['bahamas', 'caribbean', 'mexico', 'med'], mood: 1,
    blurb: 'Short, cheerful sailings at a good price. The extras are where it adds up.' },
  { id: 'coral_bay', name: 'Coral Bay Cruises', tier: 'Big-ship family', from: 1988, perNight: 92, gratuity: 16, includes: [],
    kids: 'club', solo: true, regions: ['bahamas', 'caribbean', 'alaska', 'med', 'baltic', 'asia', 'australia'], mood: 2,
    blurb: 'Huge ships with waterslides, a climbing wall and a show every night. Solo studios, too.' },
  { id: 'meridian', name: 'Meridian Cruises', tier: 'Premium', from: 1960, perNight: 150, gratuity: 17, includes: [],
    kids: 'welcome', regions: ['caribbean', 'alaska', 'med', 'greek', 'fjords', 'baltic', 'asia', 'australia', 'transatlantic', 'south_america'], mood: 3,
    blurb: 'Mid-sized ships, better food, quieter decks, longer days in port.' },
  { id: 'tidewater', name: 'Tidewater Voyages', tier: 'Adults only', from: 2000, perNight: 165, gratuity: 0, includes: ['gratuities', 'wifi', 'dining'],
    kids: 'adults', regions: ['caribbean', 'med', 'greek', 'baltic'], mood: 4,
    blurb: 'Eighteen and over only. Wi-Fi, tips and every restaurant are in the fare.' },
  { id: 'halcyon', name: 'Halcyon Luxury Cruises', tier: 'Luxury', from: 1975, perNight: 480, gratuity: 0, includes: ['gratuities', 'drinks', 'dining', 'wifi'],
    kids: 'welcome', regions: ['caribbean', 'med', 'greek', 'fjords', 'asia', 'australia', 'transatlantic', 'south_america'], mood: 6,
    blurb: 'Small ships, a butler for every suite, and everything included: drinks, tips, Wi-Fi, every restaurant.' },
  { id: 'aurora', name: 'Aurora Expeditions', tier: 'Expedition', from: 1990, perNight: 430, gratuity: 18, includes: ['dining'],
    kids: 'welcome', regions: ['fjords', 'alaska', 'antarctica'], mood: 7, excursionsIncluded: true,
    blurb: 'Small, ice-strengthened ships, naturalists on board, landings by inflatable boat. Shore trips are in the fare.' },
];
export const CRUISE_LINE_BY_ID = Object.fromEntries(CRUISE_LINES.map((l) => [l.id, l]));

/**
 * The sailings. port: where it leaves from and returns to (a city in data/countries.js). nights. ports: the stops,
 * each a day ashore (sea days are not listed). months: when it sails (northern summer for the fjords and Alaska,
 * southern summer for Antarctica and Australia). from: the year it is first sailed.
 */
export const ITINERARIES = [
  { id: 'bahamas_short', region: 'bahamas', name: 'Bahamas Getaway', port: ['us', 'New York'], nights: 5, from: 1970, months: 'all',
    ports: ['Nassau', 'A private island beach'] },
  { id: 'caribbean_east', region: 'caribbean', name: 'Eastern Caribbean', port: ['pr', 'San Juan'], nights: 7, from: 1960, months: 'all',
    ports: ['St. Thomas', 'St. Maarten', 'Antigua', 'St. Lucia', 'Barbados'] },
  { id: 'caribbean_west', region: 'caribbean', name: 'Western Caribbean and Jamaica', port: ['us', 'New York'], nights: 10, from: 1950, months: 'all',
    ports: ['Ocho Rios', 'Grand Cayman', 'Cozumel', 'Nassau'] },
  { id: 'mexico_riviera', region: 'mexico', name: 'Mexican Riviera', port: ['mx', 'Mérida'], nights: 6, from: 1975, months: 'all',
    ports: ['Cozumel', 'Costa Maya', 'Progreso'] },
  { id: 'alaska_inside', region: 'alaska', name: 'Alaska Inside Passage', port: ['us', 'Seattle'], nights: 7, from: 1960, months: [5, 6, 7, 8, 9],
    ports: ['Juneau', 'Skagway', 'Glacier Bay (scenic cruising)', 'Ketchikan', 'Victoria'] },
  { id: 'alaska_glaciers', region: 'alaska', name: 'Alaska Glaciers, northbound', port: ['ca', 'Vancouver'], nights: 7, from: 1960, months: [5, 6, 7, 8, 9],
    ports: ['Ketchikan', 'Juneau', 'Skagway', 'Hubbard Glacier (scenic cruising)'] },
  { id: 'med_west', region: 'med', name: 'Western Mediterranean', port: ['es', 'Barcelona'], nights: 7, from: 1950, months: [4, 5, 6, 7, 8, 9, 10],
    ports: ['Marseille', 'Florence and Pisa (Livorno)', 'Rome (Civitavecchia)', 'Naples', 'Palma de Mallorca'] },
  { id: 'med_italy', region: 'med', name: 'Italy and the Riviera', port: ['it', 'Rome'], nights: 9, from: 1950, months: [4, 5, 6, 7, 8, 9, 10],
    ports: ['Naples and Capri', 'Messina', 'Valletta', 'Monaco', 'Florence and Pisa (Livorno)'] },
  { id: 'greek_isles', region: 'greek', name: 'Greek Isles', port: ['gr', 'Athens'], nights: 7, from: 1955, months: [4, 5, 6, 7, 8, 9, 10],
    ports: ['Mykonos', 'Santorini', 'Rhodes', 'Ephesus (Kuşadası)', 'Crete'] },
  { id: 'fjords', region: 'fjords', name: 'Norwegian Fjords', port: ['no', 'Bergen'], nights: 8, from: 1950, months: [5, 6, 7, 8, 9],
    ports: ['Geiranger', 'Ålesund', 'Flåm', 'Stavanger'] },
  { id: 'north_cape', region: 'fjords', name: 'North Cape and the Midnight Sun', port: ['no', 'Bergen'], nights: 12, from: 1960, months: [6, 7],
    ports: ['Ålesund', 'Trondheim', 'Tromsø', 'North Cape (Honningsvåg)', 'Lofoten Islands'] },
  { id: 'baltic', region: 'baltic', name: 'Baltic Capitals', port: ['dk', 'Copenhagen'], nights: 9, from: 1960, months: [5, 6, 7, 8, 9],
    ports: ['Stockholm', 'Helsinki', 'Tallinn', 'Riga', 'Gdańsk'] },
  { id: 'asia', region: 'asia', name: 'Southeast Asia', port: ['sg', 'Singapore'], nights: 10, from: 1975, months: [1, 2, 3, 4, 10, 11, 12],
    ports: ['Phuket', 'Penang', 'Ho Chi Minh City', 'Bangkok (Laem Chabang)'] },
  { id: 'australia', region: 'australia', name: 'Australia and New Zealand', port: ['au', 'Sydney'], nights: 12, from: 1965, months: [1, 2, 3, 10, 11, 12],
    ports: ['Milford Sound (scenic cruising)', 'Dunedin', 'Christchurch', 'Wellington', 'Bay of Islands'] },
  { id: 'transatlantic', region: 'transatlantic', name: 'Transatlantic Crossing', port: ['uk', 'London'], nights: 7, from: 1900, months: 'all', oneWay: ['us', 'New York'],
    ports: [] },
  { id: 'south_america', region: 'south_america', name: 'Cape Horn and the Fjords of Chile', port: ['ar', 'Buenos Aires'], nights: 14, from: 1970, months: [1, 2, 3, 11, 12], oneWay: ['cl', 'Valparaíso'],
    ports: ['Montevideo', 'Puerto Madryn', 'Falkland Islands', 'Cape Horn (scenic cruising)', 'Ushuaia', 'Punta Arenas'] },
  { id: 'antarctica', region: 'antarctica', name: 'Antarctic Peninsula', port: ['ar', 'Buenos Aires'], nights: 11, from: 1990, months: [1, 2, 3, 11, 12],
    ports: ['Ushuaia', 'Drake Passage (at sea)', 'Antarctic Peninsula landings', 'South Shetland Islands'] },
];
export const ITINERARY_BY_ID = Object.fromEntries(ITINERARIES.map((i) => [i.id, i]));
/**
 * The country each port of call is in, for passports, visas and stamps (ids in data/countries.js). Scenic cruising,
 * days at sea and Antarctica are no country's; islands the game has no country for (the Virgin Islands, St. Maarten,
 * Antigua, St. Lucia, Barbados, the Caymans, the Falklands) are left out, so they stamp nothing.
 */
export const PORT_COUNTRY = {
  Nassau: 'bs', 'A private island beach': 'bs', 'Ocho Rios': 'jm', Cozumel: 'mx', 'Costa Maya': 'mx', Progreso: 'mx',
  Juneau: 'us', Skagway: 'us', Ketchikan: 'us', Victoria: 'ca',
  Marseille: 'fr', 'Florence and Pisa (Livorno)': 'it', 'Rome (Civitavecchia)': 'it', Naples: 'it', 'Naples and Capri': 'it', Messina: 'it',
  'Palma de Mallorca': 'es', Monaco: 'mc', Mykonos: 'gr', Santorini: 'gr', Rhodes: 'gr', Crete: 'gr', 'Ephesus (Kuşadası)': 'tr',
  Geiranger: 'no', 'Ålesund': 'no', 'Flåm': 'no', Stavanger: 'no', Trondheim: 'no', 'Tromsø': 'no', 'North Cape (Honningsvåg)': 'no', 'Lofoten Islands': 'no',
  Stockholm: 'se', Helsinki: 'fi', Tallinn: 'ee', 'Gdańsk': 'pl', Phuket: 'th', Penang: 'my', 'Ho Chi Minh City': 'vn', 'Bangkok (Laem Chabang)': 'th',
  Dunedin: 'nz', Christchurch: 'nz', Wellington: 'nz', 'Bay of Islands': 'nz', Montevideo: 'uy', 'Puerto Madryn': 'ar', Ushuaia: 'ar', 'Punta Arenas': 'cl',
};
export const REGION_NAMES = { bahamas: 'Bahamas', caribbean: 'Caribbean', mexico: 'Mexico', alaska: 'Alaska', med: 'Mediterranean', greek: 'Greek Isles',
  fjords: 'Norway', baltic: 'Baltic', asia: 'Asia', australia: 'Australia and New Zealand', transatlantic: 'Transatlantic', south_america: 'South America', antarctica: 'Antarctica' };

/**
 * Staterooms. k: the fare against an inside stateroom. sleeps: most guests in one. from: the year they became common.
 * views: what can be chosen for it (data/cruises VIEWS). comfort and mood: what it does for the trip.
 */
export const STATEROOMS = [
  { id: 'inside', name: 'Inside stateroom', k: 1, sleeps: 4, views: ['none'], comfort: 2, mood: 0, blurb: 'No window. Dark and quiet; you will not be in it much.' },
  { id: 'oceanview', name: 'Oceanview stateroom', k: 1.28, sleeps: 4, views: ['window', 'porthole', 'obstructed'], comfort: 3, mood: 1, blurb: 'A window onto the sea.' },
  { id: 'balcony', name: 'Balcony stateroom', k: 1.6, sleeps: 4, from: 1985, views: ['sea', 'obstructed', 'aft', 'promenade'], comfort: 4, mood: 2, blurb: 'Your own small balcony: coffee at sunrise, sea air at night.' },
  { id: 'minisuite', name: 'Mini-suite', k: 2.15, sleeps: 4, from: 1990, views: ['sea', 'aft'], comfort: 4, mood: 3, blurb: 'A bigger room, a sitting area, a bigger balcony and a bathtub.' },
  { id: 'suite', name: 'Suite', k: 3.4, sleeps: 6, views: ['sea', 'aft', 'forward'], comfort: 5, mood: 4, suite: true, blurb: 'Separate bedroom, a large balcony, priority boarding and a concierge.' },
];
export const STATEROOM_BY_ID = Object.fromEntries(STATEROOMS.map((s) => [s.id, s]));
/** The view, and where on the ship. k: against the stateroom's usual fare. */
export const VIEWS = [
  { id: 'none', name: 'No view', k: 1 },
  { id: 'window', name: 'Picture window', k: 1 },
  { id: 'porthole', name: 'Round porthole (low deck)', k: 0.94 },
  { id: 'obstructed', name: 'Partly blocked by lifeboats', k: 0.86 },
  { id: 'sea', name: 'Open sea view, midship', k: 1.04 },
  { id: 'aft', name: 'Aft-facing: the wake behind the ship', k: 1.12 },
  { id: 'forward', name: 'Forward-facing: where the ship is going', k: 1.18 },
  { id: 'promenade', name: 'Over the promenade (people walk past)', k: 0.92 },
];
export const VIEW_BY_ID = Object.fromEntries(VIEWS.map((v) => [v.id, v]));
/** The deck: higher costs a little more; lower and midship sways least in a rough sea. */
export const DECKS = [
  { id: 'low', name: 'Lower deck (least motion)', k: 0.95 },
  { id: 'mid', name: 'Middle deck', k: 1 },
  { id: 'high', name: 'Upper deck (close to the pool deck)', k: 1.06 },
];
export const DECK_BY_ID = Object.fromEntries(DECKS.map((d) => [d.id, d]));
/** For more than two in a stateroom, the third and fourth guests pay this share; one alone pays this many fares. */
export const OCCUPANCY = { extraGuest: 0.42, single: 1.9, soloStudio: 1.3 };

/**
 * What costs extra on board. perDay or perCruise in base units, per person unless perDevice. from: the year it was first
 * sold. adults: only for those of drinking age (21 on a line sailing from the United States, otherwise 18); a drinks
 * package must be bought for every adult in the stateroom if one buys it (the lines' own rule, so it cannot be shared).
 */
export const EXTRAS = [
  { id: 'drinks', name: 'Drinks package (beer, wine, cocktails)', perDay: 72, from: 1995, adults: true, mood: 1,
    blurb: 'Every adult in the stateroom has to buy it if one does.' },
  { id: 'soda', name: 'Soft drinks package (soda, juice, coffee)', perDay: 13, from: 1995, mood: 0, blurb: 'Children, and anyone not on the drinks package.' },
  { id: 'dining', name: 'Specialty dining (steakhouse, sushi, Italian)', perDay: 28, from: 1998, mood: 1, blurb: 'The main dining room and buffet are in the fare; these are not.' },
  { id: 'wifi_basic', name: 'Wi-Fi for messages and social media', perDay: 12, perDevice: true, from: 2005, group: 'wifi', blurb: 'Per device. Slow at sea.' },
  { id: 'wifi_stream', name: 'Wi-Fi fast enough to stream', perDay: 23, perDevice: true, from: 2016, group: 'wifi', blurb: 'Per device, by satellite.' },
  { id: 'excursions', name: 'Shore excursions', perPort: 85, mood: 1, blurb: 'A guided trip in each port you choose. You can also walk off on your own for free.' },
];
export const EXTRA_BY_ID = Object.fromEntries(EXTRAS.map((e) => [e.id, e]));
/** Port fees and taxes per person per night, and the pre-cruise hotel night when the ship leaves from somewhere else. */
export const CRUISE_FEES = { portPerNight: 16, hotelNight: 120 };
/** What the trip can mean: lines of what people remember of a cruise, by kind. */
export const CRUISE_MEMORIES = {
  any: ['Dolphins ran alongside the ship one morning, and the whole deck went quiet.', 'You ate more in a week than in a month at home, and regretted none of it.',
    'A sail-away party on the top deck, the port shrinking behind you.', 'The captain\'s voice over the speakers every noon, with the weather and how deep the sea was.'],
  balcony: ['Coffee on the balcony at sunrise, a new coast every morning.', 'Falling asleep with the balcony door open to the sound of the sea.'],
  suite: ['A butler who remembered how everyone took their coffee.'],
  drinks: ['A drinks package you were determined to get your money\'s worth from.'],
  kids: ['The kids\' club was the highlight, they said; the waterslide, the other.'],
  rough: ['One rough night at sea, and a dining room half empty the next morning.'],
  alaska: ['A glacier calving into the sea, a crack like thunder.'], fjords: ['Cliffs so close to the ship you could almost touch them.'],
  antarctica: ['Penguins, thousands of them, and not a sound but the wind.'], caribbean: ['Water so clear you could see the fish from the pier.'],
  med: ['A whole day in a city you had only seen in films.'], greek: ['White houses and blue domes, and a sunset everyone stopped to watch.'],
};
