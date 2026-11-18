// When things were invented: the first year a career, a service or a kind of
// business exists. The eras themselves (money, prices, laws, events, health,
// schooling by period) are in engine/eras.js and engine/history.js, which are
// the one authority on the year; this file only says what work existed when.
// GAMEPLAY CONFIGURATION.

/** The earliest year a life can begin: the same as the eras cover (the new-life screen asks for any year from then on). */
export const EARLIEST_START = 1800;

/** Careers that need something invented first: the first year they exist. */
export const CAREER_ERAS = {
  software: 1955, it: 1960, data: 1970, dba: 1975, qa: 1970, gamedev: 1975, tech_ic: 1980, cyber: 1990, eng_mgmt: 1960, project_mgmt: 1960,
  influencer: 2006, social_media: 2006, broadcast: 1922, voice: 1925, astronaut: 1961, atc: 1930, cabin: 1930, airport: 1930, pilot: 1920,
  hvac: 1930, tech_writing: 1950, waterslide: 1980, theme_park: 1955, forensics: 1930, ems: 1960, emergency_mgmt: 1970, sfx: 1930, biotech: 1976,
  paralegal: 1970, animation: 1915, dental_hyg: 1920, psychiatry: 1920, counselor: 1950, fin_analysis: 1950, intelligence: 1940, rail: 1830,
};
/** Freelance services that need something invented first. */
export const SERVICE_ERAS = { coding: 1960, web_dev: 1995, social_media: 2006, virtual_assistant: 2000, ride_share: 2012, video_editing: 1990 };
/** Kinds of business that need something invented first. */
export const BUSINESS_ERAS = { software_studio: 1970, design_studio: 1950, gym: 1950, record_label: 1900, production_co: 1910 };
/** Social media, and online life generally. */
export const SOCIAL_FROM = 2006;

export const serviceExists = (id, year) => year >= (SERVICE_ERAS[id] ?? 0);
export const businessExists = (id, year) => year >= (BUSINESS_ERAS[id] ?? 0);
