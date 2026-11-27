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
export const BIRTHRIGHT = new Set(['us', 'ca', 'mx', 'br', 'ar', 'cl', 'pe', 've', 'uy', 'py', 'bo', 'ec', 'cu', 'jm', 'bz', 'gt', 'sv', 'ni', 'pa', 'cr', 'gy', 'pk', 'fj']);

/** One nationality only: taking this one means giving up the others, and taking another means losing this one. */
// Checked by scripts/verify-laws.py; the United Arab Emirates (2021), Afghanistan (2001) and Ukraine (2025) now allow dual nationality.
export const SINGLE = new Set(['cn', 'in', 'jp', 'sg', 'my', 'id', 'np', 'kz', 'sa', 'kw', 'qa', 'ir', 'cu', 'at', 'ee', 'et', 'cd', 'mn', 'ad', 'ge', 'mc']);

/** Years of residence before an application is heard, where it is not five. */
// Checked against "Naturalization" rev 1384638556 (Malaysia: its nationality-law article, 10 years); see scripts/verify-laws.py.
export const RESIDENCE_YEARS = { mv: 12, sc: 10, ch: 10, at: 10, it: 10, es: 10, dk: 8, jp: 5, de: 5, ca: 3, au: 4, ar: 2, be: 5, ae: 30, qa: 25, kw: 15, sa: 10, mc: 10, ad: 20, cn: 99, hk: 7, my: 10, sg: 10, ao: 10, bo: 3, br: 4, bs: 10, co: 7, cr: 7, cz: 10, dj: 10, do: 7, dz: 7, ee: 8, eg: 10, et: 4, fi: 8, ge: 10, gr: 7, gt: 10, gy: 7, hr: 8, hu: 8, il: 3, in: 12, iq: 10, jo: 15, ke: 7, ng: 15, ni: 4, no: 8, np: 15, pg: 8, ph: 10, pl: 10, pt: 10, ro: 8, rs: 6, se: 8, sk: 8, ug: 20, ve: 10 };
export const DEFAULT_YEARS = 5;
/** Married to a citizen: fewer years, never none. Marriage alone confers nothing. */
export const SPOUSE_YEARS = 3;
/**
 * Where the law gives a spouse of a citizen its own shorter wait (checked against "Naturalization" rev 1384638556; see
 * scripts/verify-laws.py). Marriage still grants nothing by itself: there is an application, and a test. Thailand waives
 * the residence requirement for spouses; the Philippines' reduced wait is for the husband of a Filipina.
 */
export const SPOUSE_YEARS_IN = { br: 1, fi: 5, ie: 3, it: 2, jp: 3, kr: 3, mx: 2, ph: 5, pt: 3, ru: 3, th: 0, us: 3, uy: 3 };
/** The application fee, in base units. */
export const NATURALIZATION_FEE = 1200;
