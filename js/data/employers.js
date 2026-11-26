// Making up employers: how they are named, how big they are, what they are
// like to work for, and what some cities are known for. All names are
// fictional, built from a country's own surnames and the city's name.
//
// A name pattern uses {S} (a local surname), {S2} (another), {C} (the city)
// and {W} (a word from WORDS for the family).

export const NAME_PATTERNS = {
  corporate: ['{S} & {S2}', '{C} Holdings', '{W} Group', '{S} Partners', '{W} Capital', '{C} Mutual'],
  tech: ['{W} Technologies', '{W} Systems', '{W}soft', '{W} Labs', '{S} Engineering', '{W} Digital'],
  health: ['{C} General Hospital', '{S} Medical Center', '{C} Community Clinic', 'St {S2}\'s Hospital', '{W} Health'],
  law: ['{S}, {S2} & Co.', '{S} Legal', '{S} & {S2} LLP', '{S} Law Chambers', '{S2} Law Group'], // private practices; public offices are named below
  education: ['{C} Academy', '{S} School', '{C} College', '{W} Learning', 'University of {C}'],
  hospitality: ['The {W} Kitchen', '{S}\'s', 'Hotel {C}', 'The {W} Room', '{W} Café', '{C} Grand Hotel'],
  retail: ['{W} Market', '{S} Stores', '{C} Supermarkets', '{W} & Co.', 'The {W} Shop'],
  trades: ['{S} Building', '{S} & Sons', '{C} Construction', '{W} Works', '{S} Contractors'],
  science: ['{W} Institute', '{C} Research Laboratory', '{W} Biosciences', '{S} Laboratories'],
  transport: ['{C} Transit', '{W} Logistics', '{W} Airways', '{C} Freight', '{S} Haulage'],
  safety: ['{C} Fire Service', '{C} Police', '{C} Ambulance Service', '{W} Security'],
  media: ['The {C} {W}', '{W} Media', '{S} Publishing', '{C} Broadcasting', '{W} Studio'],
  arts: ['{W} Pictures', '{C} Theater Company', '{W} Records', '{S} Agency', '{C} Philharmonic', '{W} Studios'],
  beauty: ['{W} Salon', '{S} Hair & Beauty', '{W} Studio'],
  government: ['{C} City Council', 'Department of {W}', '{C} Revenue Office', 'Ministry of {W}', '{C} Post Office'],
  land: ['{S} Farm', '{C} Wildlife Trust', '{W} Fisheries', '{C} Zoo', '{S} Ranch', '{C} Parks'],
  sport: ['{W} Fitness', '{C} Leisure Center', '{C} Athletic Club', '{W} Gym'],
  novelty: ['{W} Water Park', '{C} Funland', '{S} Funeral Home', '{W} Services'],
  military: ['{C} Garrison'],
};

export const WORDS = {
  corporate: ['Meridian', 'Harbor', 'Summit', 'Keystone', 'Northgate', 'Lantern', 'Granite'],
  tech: ['Northstar', 'Quanta', 'Brightline', 'Kestrel', 'Lumen', 'Vector', 'Cobalt', 'Ember'],
  health: ['Willow', 'Hearth', 'Lifespring', 'Meadow'],
  education: ['Beacon', 'Oakfield', 'Riverside', 'Bright Futures'],
  hospitality: ['Copper Pot', 'Olive', 'Juniper', 'Saffron', 'Larder', 'Ember', 'Brass'],
  retail: ['Corner', 'Penny', 'Fresh', 'Harvest', 'Thread', 'Trove'],
  trades: ['Ironbridge', 'Keystone', 'Plumbline', 'Cornerstone', 'Hammer'],
  science: ['Helix', 'Aurora', 'Catalyst', 'Tidewater', 'Fieldstone'],
  transport: ['Swift', 'Waypoint', 'Bluewing', 'Compass', 'Railway'],
  safety: ['Sentinel', 'Guardian', 'Shield'],
  media: ['Herald', 'Gazette', 'Signal', 'Lantern', 'Chronicle'],
  arts: ['Silver Screen', 'Velvet', 'Marquee', 'Spotlight', 'Harmony'],
  beauty: ['Glow', 'Mirror', 'Silk'],
  government: ['Transport', 'Health', 'Education', 'Foreign Affairs', 'Housing', 'Revenue'],
  land: ['Riverbend', 'Northsea', 'Greenfield', 'Wildwood'],
  sport: ['Pulse', 'Peak', 'Stride', 'Anchor'],
  novelty: ['Splash', 'Wild Wave', 'Odd Jobs', 'Curious'],
  military: ['Army'],
};

/** Sizes: how many people work there, how many openings a year, how much it can pay. */
export const SIZES = {
  small: { label: 'Small (under 50 staff)', weight: 5, openings: 0.35, pay: 0.92, layoff: 1.3 },
  medium: { label: 'Medium (50 to 500 staff)', weight: 3, openings: 0.8, pay: 1, layoff: 1 },
  large: { label: 'Large (500 to 5,000 staff)', weight: 1.6, openings: 1.6, pay: 1.06, layoff: 0.8 },
  major: { label: 'Major (over 5,000 staff)', weight: 0.6, openings: 2.6, pay: 1.12, layoff: 0.7 },
};

/** What a place is like to work. Each nudges stress, satisfaction and growth. */
export const CULTURES = {
  supportive: { label: 'Supportive', stress: -6, satisfaction: 8, growth: 0.05, blurb: 'People look out for each other here.' },
  demanding: { label: 'Demanding', stress: 8, satisfaction: -2, growth: 0.12, blurb: 'High standards and long hours; people who do well move up fast.' },
  relaxed: { label: 'Relaxed', stress: -4, satisfaction: 4, growth: -0.04, blurb: 'Steady, friendly, not in a hurry.' },
  chaotic: { label: 'Disorganized', stress: 6, satisfaction: -6, growth: 0, blurb: 'Nobody is quite sure who decides what.' },
  traditional: { label: 'Traditional', stress: 0, satisfaction: 0, growth: 0.02, blurb: 'Things are done the way they have always been done.' },
  creative: { label: 'Creative', stress: 2, satisfaction: 6, growth: 0.04, blurb: 'Ideas are welcome, deadlines are a suggestion.' },
};

/**
 * What some cities are known for. Each entry multiplies how many employers
 * of that family a city has. Capitals get government on top (engine/employers.js).
 */
export const CITY_FOCUS = {
  'us/Seattle': { tech: 2.5, transport: 1.4 }, 'us/Austin': { tech: 2, arts: 1.4 }, 'us/New York': { corporate: 2.2, media: 2, arts: 1.6 },
  'us/Atlanta': { transport: 1.8, media: 1.3 }, 'us/Denver': { land: 1.6, sport: 1.4 }, 'us/Chicago': { corporate: 1.5, transport: 1.5 },
  'uk/London': { corporate: 2.2, media: 1.8, arts: 1.6 }, 'uk/Manchester': { media: 1.4, sport: 1.4 }, 'uk/Bristol': { tech: 1.4, science: 1.4 },
  'ca/Toronto': { corporate: 1.8, tech: 1.4 }, 'ca/Vancouver': { arts: 1.8, tech: 1.4, land: 1.3 }, 'ca/Calgary': { science: 1.5, land: 1.6 },
  'au/Sydney': { corporate: 1.6, hospitality: 1.4 }, 'au/Perth': { science: 1.6, trades: 1.4 }, 'au/Hobart': { land: 1.8 },
  'de/Munich': { tech: 1.8, corporate: 1.4 }, 'de/Berlin': { arts: 1.6, tech: 1.6 }, 'de/Hamburg': { transport: 1.8, media: 1.4 }, 'de/Stuttgart': { tech: 1.8, trades: 1.4 },
  'fr/Paris': { corporate: 1.8, arts: 1.8, beauty: 2 }, 'fr/Toulouse': { tech: 1.8, transport: 1.6 }, 'fr/Marseille': { transport: 1.5, land: 1.3 },
  'jp/Tokyo': { corporate: 2, tech: 1.6 }, 'jp/Kyoto': { hospitality: 1.8, education: 1.4 }, 'jp/Nagoya': { trades: 1.6, tech: 1.4 },
  'in/Bengaluru': { tech: 2.5 }, 'in/Mumbai': { corporate: 1.8, arts: 2 }, 'in/Pune': { tech: 1.6, education: 1.5 },
  'cn/Shenzhen': { tech: 2.5 }, 'cn/Shanghai': { corporate: 2 }, 'br/Rio de Janeiro': { hospitality: 1.8, arts: 1.5 },
  'mx/Monterrey': { trades: 1.6, corporate: 1.4 }, 'it/Milan': { arts: 1.6, beauty: 2, corporate: 1.6 }, 'it/Florence': { hospitality: 1.8, arts: 1.4 },
  'es/Barcelona': { hospitality: 1.8, tech: 1.3 }, 'nz/Queenstown': { hospitality: 2.5, sport: 2, novelty: 1.6 }, 'th/Phuket': { hospitality: 2.5 },
  'id/Denpasar': { hospitality: 2.5 }, 'ch/Zurich': { corporate: 2.2 }, 'ch/Geneva': { government: 2, corporate: 1.6 }, 'sg/Singapore': { corporate: 2, transport: 1.8, tech: 1.6 },
  'ae/Dubai': { hospitality: 1.8, corporate: 1.6, transport: 1.6 }, 'no/Stavanger': { science: 1.6, transport: 1.6 }, 'ke/Nairobi': { tech: 1.4, land: 1.3 },
  'kr/Seoul': { tech: 1.8, arts: 1.6 }, 'za/Cape Town': { hospitality: 1.6, arts: 1.3 }, 'ng/Lagos': { arts: 1.6, corporate: 1.5 },
};

/** How many employers of each family a city keeps track of, before size and focus. */
export const FAMILY_BASE = {
  corporate: 5, tech: 3, health: 3, law: 2, education: 3, hospitality: 6, retail: 6, trades: 4, science: 1.5, transport: 3,
  safety: 1.5, media: 2, arts: 2, beauty: 2, government: 2, land: 2, sport: 2, novelty: 1.5,
};

/** Tracks that most large organizations of any kind employ. */
export const EVERYWHERE = ['admin_support', 'office', 'hr', 'it', 'accountant', 'marketing', 'corporate', 'maintenance', 'security', 'contact_center'];

/**
 * Public legal offices are not firms: a prosecutor works for the prosecutor's office, a public defender for the public
 * defender's, a judge for the court. One office per city, named for where it is. Null for any other job.
 */
export function publicOfficeName(careerId, countryId, city) {
  const us = countryId === 'us';
  const uk = countryId === 'uk';
  return {
    prosecutor: us ? `${city} District Attorney's Office` : uk ? `Crown Prosecution Service, ${city}` : `${city} Public Prosecutor's Office`,
    defender: us ? `${city} Public Defender's Office` : uk ? `Public Defender Service, ${city}` : `${city} Public Legal Aid Office`,
    judiciary: us ? `${city} Superior Court` : uk ? `${city} Crown Court` : `${city} District Court`,
    gov_counsel: us ? `${city} City Law Department` : `${city} Government Legal Office`,
    attorney_general: us ? 'Office of the State Attorney General' : 'Attorney General\'s Office',
    us_attorney: 'United States Attorney\'s Office', solicitor_general: 'Office of the Solicitor General',
    court_clerk: us ? `${city} Superior Court` : uk ? `${city} Crown Court` : `${city} District Court`,
  }[careerId] ?? null;
}
