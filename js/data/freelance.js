// Freelance services the player can offer. rate is base units an hour at the
// going rate; job is the [fewest, most] hours a typical piece of work takes.
//   skill:   the path that decides quality (and, with reputation, what clients will pay)
//   req:     thresholds to offer it at all; cert / programme: a qualification it needs
//   demand:  how much work there is, 1 = ordinary
//   track:   the career track whose experience this counts towards
// Age limits here are the service's own; the country's working-age law applies on top.
const S = (id, name, rate, job, skill, minAge, o = {}) => ({ id, name, rate, job, skill, minAge, req: {}, demand: 1, ...o });

export const SERVICES = [
  S('babysitting', 'Babysitting', 12, [4, 20], 'hidden.discipline', 13, { demand: 1.3 }),
  S('pet_sitting', 'Pet sitting', 12, [6, 30], 'hidden.discipline', 13),
  S('dog_walking', 'Dog walking', 14, [8, 40], 'stats.health', 12, { demand: 1.2 }),
  S('tutoring', 'Tutoring', 28, [10, 40], 'stats.intellect', 15, { req: { 'stats.intellect': 60 }, track: 'research_asst' }),
  S('lawn_care', 'Lawn care and gardening', 18, [6, 30], 'stats.health', 14, { track: 'landscaping' }),
  S('cleaning', 'House cleaning', 18, [6, 30], 'hidden.discipline', 16, { demand: 1.2 }),
  S('handyman', 'Handyman jobs', 30, [6, 30], 'stats.intellect', 18, { track: 'maintenance' }),
  S('graphic_design', 'Graphic design', 40, [10, 60], 'stats.intellect', 16, { req: { 'stats.intellect': 55 }, track: 'graphic' }),
  S('writing', 'Freelance writing', 35, [8, 50], 'stats.intellect', 16, { req: { 'stats.intellect': 58 }, track: 'copywriting' }),
  S('editing', 'Editing and proofreading', 32, [8, 40], 'stats.intellect', 18, { req: { 'stats.intellect': 62 }, track: 'publishing' }),
  S('translation', 'Translation', 38, [6, 40], 'stats.intellect', 18, { languages: 2 }),
  S('photography', 'Photography', 45, [6, 30], 'stats.charm', 16, { track: 'photography' }),
  S('video_editing', 'Video editing', 42, [10, 60], 'stats.intellect', 16, { req: { 'stats.intellect': 55 }, track: 'production' }),
  S('coding', 'Software contracting', 70, [20, 160], 'stats.intellect', 16, { req: { 'stats.intellect': 65 }, track: 'software' }),
  S('web_dev', 'Website building', 50, [15, 80], 'stats.intellect', 16, { req: { 'stats.intellect': 60 }, track: 'software' }),
  S('personal_training', 'Personal training', 40, [10, 50], 'stats.health', 17, { req: { 'stats.health': 60 }, track: 'fitness' }),
  S('music_lessons', 'Music lessons', 35, [10, 40], 'talents.music', 16, { req: { 'talents.music': 55 } }),
  S('acting_coaching', 'Acting coaching', 40, [8, 30], 'talents.acting', 18, { req: { 'talents.acting': 60 } }),
  S('dance_lessons', 'Dance lessons', 35, [8, 30], 'talents.dance', 16, { req: { 'talents.dance': 58 } }),
  S('virtual_assistant', 'Virtual assistance', 22, [10, 60], 'hidden.discipline', 18, { demand: 1.1, track: 'admin_support' }),
  S('social_media', 'Social media management', 30, [10, 60], 'stats.charm', 16, { track: 'social_media' }),
  S('mystery_shopping', 'Mystery shopping', 16, [3, 12], 'stats.charm', 18, { demand: 0.7 }),
  S('event_staffing', 'Event staffing', 18, [6, 24], 'stats.charm', 17, { demand: 1.1, track: 'events' }),
  S('makeup', 'Event hair and makeup', 45, [4, 16], 'stats.charm', 18, { programme: 'cosmetology' }),
  S('ride_share', 'Ride-share driving', 20, [20, 120], 'hidden.discipline', 21, { demand: 1.4, licence: 'driving', track: 'taxi' }),
  S('consulting', 'Consulting in your old field', 90, [10, 80], 'stats.intellect', 30, { experience: 10 }),
];
export const SERVICE_BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, s]));

/** Price settings the player can choose, as a multiple of the going rate. */
export const RATES = [
  { id: 'budget', label: 'Below the going rate', k: 0.75 },
  { id: 'market', label: 'The going rate', k: 1 },
  { id: 'premium', label: 'Premium', k: 1.35 },
  { id: 'luxury', label: 'Top of the market', k: 1.8 },
];

/** Hours a week the player can offer. */
export const AVAILABILITY = [0, 4, 8, 15, 25, 40];
