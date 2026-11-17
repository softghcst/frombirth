// Businesses a person can start and own. Money is in base units (scaled by
// each country's wages and each city's pay and rents, like everything else).
// GAMEPLAY CONFIGURATION: none of this is what a real business costs or earns.
//
//   startup   what it costs to open the doors
//   perHead   what one member of staff can bring in a year at ordinary prices, when there is the custom for it
//   cogs      the share of revenue that goes on stock, materials and supplies
//   rent      premises a year, for one site
//   wage      what an ordinary member of staff is paid a year
//   track     the career track whose experience running it counts towards (and whose staff it hires)
//   needs     what the owner must have: trade, programme (with its licence), cert, or years in any of `experience`
//   solo      can be run with no staff at all
const B = (id, name, family, startup, perHead, cogs, rent, wage, track, needs = {}, o = {}) => ({ id, name, family, startup, perHead, cogs, rent, wage, track, needs, ...o });

export const BUSINESS_TYPES = [
  B('cafe', 'Café', 'hospitality', 45000, 52000, 0.32, 22000, 24000, 'cafe'),
  B('restaurant', 'Restaurant', 'hospitality', 110000, 60000, 0.34, 40000, 27000, 'kitchen', { experience: { kitchen: 3, fine_dining: 2, front_house: 4 } }),
  B('bakery', 'Bakery', 'hospitality', 55000, 50000, 0.3, 20000, 25000, 'pastry'),
  B('bar', 'Bar', 'hospitality', 80000, 58000, 0.3, 30000, 25000, 'bar', { minAge: 21 }),
  B('shop', 'Shop', 'retail', 40000, 62000, 0.5, 20000, 24000, 'retail'),
  B('boutique', 'Clothes boutique', 'retail', 50000, 66000, 0.48, 26000, 25000, 'fashion_retail'),
  B('bookshop', 'Bookshop', 'retail', 35000, 60000, 0.5, 18000, 24000, 'retail'),
  B('salon', 'Hair and beauty salon', 'beauty', 38000, 55000, 0.14, 20000, 28000, 'hair_stylist', { programme: 'cosmetology' }),
  B('electrical', 'Electrical contractor', 'trades', 28000, 82000, 0.22, 8000, 46000, 'electrician', { trade: 'electrician' }, { solo: true }),
  B('plumbing', 'Plumbing firm', 'trades', 26000, 80000, 0.22, 8000, 45000, 'plumber', { trade: 'plumber' }, { solo: true }),
  B('joinery', 'Carpentry workshop', 'trades', 32000, 74000, 0.26, 12000, 42000, 'carpenter', { trade: 'carpenter' }, { solo: true }),
  B('garage', 'Garage', 'trades', 60000, 78000, 0.28, 20000, 44000, 'mechanic', { trade: 'mechanic' }),
  B('builder', 'Building firm', 'trades', 70000, 90000, 0.36, 10000, 40000, 'construction', { experience: { construction: 5, carpenter: 4, electrician: 5, plumber: 5 } }),
  B('landscaper', 'Landscaping business', 'trades', 22000, 60000, 0.18, 6000, 30000, 'landscaping', {}, { solo: true }),
  B('cleaning', 'Cleaning company', 'trades', 12000, 46000, 0.08, 4000, 24000, 'maintenance', {}, { solo: true }),
  B('software_studio', 'Software studio', 'tech', 30000, 130000, 0.06, 14000, 82000, 'software', { experience: { software: 3, data: 3, gamedev: 3 } }, { solo: true, remote: true }),
  B('design_studio', 'Design studio', 'arts', 20000, 85000, 0.06, 12000, 46000, 'graphic', { experience: { graphic: 2, animation: 3, copywriting: 3 } }, { solo: true, remote: true }),
  B('agency', 'Marketing agency', 'corporate', 30000, 95000, 0.08, 16000, 52000, 'marketing', { experience: { marketing: 4, pr: 4, copywriting: 4, social_media: 3 } }, { remote: true }),
  B('accountancy', 'Accountancy practice', 'corporate', 25000, 100000, 0.04, 14000, 58000, 'accountant', { experience: { accountant: 4, audit: 4 } }, { solo: true }),
  B('consultancy', 'Consultancy', 'corporate', 15000, 140000, 0.05, 10000, 85000, 'consulting', { experienceTotal: 10 }, { solo: true, remote: true }),
  B('law_firm', 'Law practice', 'law', 45000, 170000, 0.04, 26000, 60000, 'lawyer', { programme: 'law', experience: { lawyer: 4, prosecutor: 4, defender: 4 } }, { solo: true }),
  B('clinic', 'Medical practice', 'health', 140000, 150000, 0.12, 36000, 52000, 'doctor', { programme: 'medical', experience: { doctor: 4 } }),
  B('dental_practice', 'Dental practice', 'health', 160000, 140000, 0.16, 32000, 50000, 'dentist', { programme: 'dental' }),
  B('vet_practice', 'Veterinary practice', 'land', 130000, 115000, 0.2, 30000, 44000, 'vet', { programme: 'veterinary' }),
  B('gym', 'Fitness studio', 'sport', 70000, 60000, 0.08, 34000, 28000, 'fitness'),
  B('tutoring', 'Tutoring centre', 'education', 18000, 56000, 0.05, 12000, 34000, 'research_asst', { degree: 'university' }, { solo: true }),
  B('photo_studio', 'Photography studio', 'media', 24000, 60000, 0.1, 12000, 30000, 'photography', {}, { solo: true }),
  B('events_co', 'Events company', 'hospitality', 25000, 72000, 0.3, 8000, 34000, 'events', { experience: { events: 3, hotel: 4, front_house: 4 } }, { solo: true }),
  B('haulage', 'Haulage firm', 'transport', 90000, 92000, 0.34, 14000, 44000, 'driver', { experience: { driver: 4, logistics: 3, warehouse: 5 } }),
  B('farm', 'Farm', 'land', 150000, 68000, 0.4, 16000, 27000, 'farming', { experience: { farming: 3, ranching: 3, agri_science: 2 } }),
  B('funeral_home', 'Funeral home', 'novelty', 90000, 85000, 0.22, 24000, 38000, 'funeral', { experience: { funeral: 4 } }),
  B('pi_agency', 'Investigations agency', 'novelty', 15000, 70000, 0.06, 8000, 40000, 'pi', { experience: { pi: 3, police: 6, detective: 3 } }, { solo: true }),
];
export const BUSINESS_BY_ID = Object.fromEntries(BUSINESS_TYPES.map((b) => [b.id, b]));

/** A freelance service that can grow into each kind of business. */
export const FROM_SERVICE = { graphic_design: 'design_studio', coding: 'software_studio', web_dev: 'software_studio', photography: 'photo_studio', cleaning: 'cleaning',
  lawn_care: 'landscaper', tutoring: 'tutoring', personal_training: 'gym', event_staffing: 'events_co', consulting: 'consultancy', social_media: 'agency', writing: 'agency', makeup: 'salon' };

/** Price positions. demand: how much custom it draws; k: what each sale brings in. */
export const PRICING = {
  budget: { label: 'Cheap and busy', demand: 1.3, k: 0.8, rep: -1 },
  standard: { label: 'The going rate', demand: 1, k: 1, rep: 0 },
  premium: { label: 'Premium', demand: 0.72, k: 1.35, rep: 1 },
};

/** How much of the owner's week the business gets. */
export const OWNER_HOURS = [
  { hours: 0, label: 'Hands off', sub: 'Only possible with a manager in charge.' },
  { hours: 10, label: 'An eye on it', sub: 'Ten hours a week. A manager helps a great deal.' },
  { hours: 25, label: 'Half the week', sub: 'Twenty-five hours.' },
  { hours: 45, label: 'Full time', sub: 'Forty-five hours. It is your job.' },
  { hours: 60, label: 'Everything you have', sub: 'Sixty hours. It will show, in the business and in you.' },
];

/** What the owner takes out each year. */
export const DRAWS = {
  none: { label: 'Nothing: leave it all in the business', share: 0 },
  modest: { label: 'A modest wage', share: 0.35 },
  half: { label: 'Half the profit', share: 0.5 },
  most: { label: 'Most of the profit', share: 0.85 },
};

/** Words for naming a business; {S} is the owner's surname, {C} the city. */
export const BUSINESS_NAMES = ['{S}\'s', '{S} & Co.', '{C} {T}', 'The {W} {T}', '{S} {T}', '{W} {T}'];
export const NAME_WORDS = ['Corner', 'Little', 'Golden', 'Harbour', 'Old Mill', 'Bright', 'Honest', 'Riverside', 'Northside', 'Good'];

/** Interest on money the business borrows, and how long it has to repay. */
export const BUSINESS_LOAN = { rate: 0.08, years: 7, most: 1.5 };
