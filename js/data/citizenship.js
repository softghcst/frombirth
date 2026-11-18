// How nationality is acquired and kept, place by place.
//
// GAMEPLAY CONFIGURATION, UNVERIFIED. These lists are the author's best
// understanding of the mid-2020s, simplified to yes or no. Real nationality
// law has conditions, exceptions and dates that are not modeled. Nothing
// here is legal information. docs/WORLD_DATA.md says how to check a row.
//
// A place that is not listed follows the default: citizenship passes from a
// parent, not from being born there; holding more than one is allowed; five
// years' residence before applying.

/** Born on the soil, a citizen: no conditions. Mostly the Americas. */
export const BIRTHRIGHT = new Set(['us', 'ca', 'mx', 'br', 'ar', 'cl', 'pe', 've', 'uy', 'py', 'bo', 'ec', 'cu', 'jm', 'bz', 'gt', 'sv', 'ni', 'pa', 'cr', 'gy', 'pk']);

/** One nationality only: taking this one means giving up the others, and taking another means losing this one. */
// Checked by scripts/verify-laws.py; the United Arab Emirates (2021), Afghanistan (2001) and Ukraine (2025) now allow dual nationality.
export const SINGLE = new Set(['cn', 'in', 'jp', 'sg', 'my', 'id', 'np', 'kz', 'sa', 'kw', 'qa', 'ir', 'cu', 'at', 'ee', 'et', 'cd', 'mn']);

/** Years of residence before an application is heard, where it is not five. */
export const RESIDENCE_YEARS = { ch: 10, at: 10, it: 10, es: 10, dk: 9, jp: 5, de: 5, ca: 3, au: 4, ar: 2, be: 5, ae: 30, qa: 25, kw: 20, sa: 10, mc: 10, ad: 20, cn: 99, hk: 7, my: 10, sg: 10 }; // my and sg from their nationality-law articles; the rest unverified
export const DEFAULT_YEARS = 5;
/** Married to a citizen: fewer years, never none. Marriage alone confers nothing. */
export const SPOUSE_YEARS = 3;
/** The application fee, in base units. */
export const NATURALIZATION_FEE = 1200;
