// The armed forces as a life (engine/military.js): a contract and what happens at its end, deployments, medals, and
// national service where the law calls young people up in peacetime too. Plain data: edit freely.

/** How long a contract runs, by way in, and what re-signing pays (base units). */
export const CONTRACT = { enlisted: 4, officer: 4 };
export const REENLIST_BONUS = 12000;
/** Years of tuition paid for veterans who leave with an honorable discharge after a full contract. */
export const VETERAN_EDUCATION_YEARS = 4;

/** Where a unit can be sent: words only. */
export const POSTINGS = ['a base overseas', 'a peacekeeping mission', 'a ship at sea for nine months', 'a disaster relief operation', 'a training exercise abroad', 'a border post', 'a humanitarian mission'];
/** Decorations, in plain words (no country's real medal names). */
export const MEDALS = ['a commendation medal', 'a medal for bravery', 'a service medal for the mission', 'a medal for meritorious service', 'a lifesaving medal'];

/**
 * National service where the law makes it compulsory in peacetime. months: how long; who: 'men' or 'all'; defer:
 * the age a student may put it off to (0: no deferral); civil: whether civilian service may be done instead.
 * Countries with conscription in the rules but not listed here get the default.
 */
export const NATIONAL_SERVICE = {
  default: { months: 12, who: 'men', defer: 24, civil: false },
  kr: { months: 18, who: 'men', defer: 28, civil: false },
  il: { months: 32, who: 'all', defer: 0, civil: true },
  sg: { months: 24, who: 'men', defer: 0, civil: false },
  tw: { months: 12, who: 'men', defer: 24, civil: true },
  ch: { months: 6, who: 'men', defer: 25, civil: true },
  at: { months: 6, who: 'men', defer: 25, civil: true },
  fi: { months: 6, who: 'men', defer: 28, civil: true },
  ee: { months: 8, who: 'men', defer: 27, civil: false },
  no: { months: 12, who: 'all', defer: 25, civil: false },
  se: { months: 9, who: 'all', defer: 25, civil: false },
  dk: { months: 4, who: 'men', defer: 25, civil: true },
  gr: { months: 12, who: 'men', defer: 27, civil: true },
  cy: { months: 14, who: 'men', defer: 24, civil: false },
  tr: { months: 6, who: 'men', defer: 29, civil: false },
  ru: { months: 12, who: 'men', defer: 24, civil: true },
  ua: { months: 12, who: 'men', defer: 24, civil: true },
  eg: { months: 18, who: 'men', defer: 28, civil: false },
  ir: { months: 21, who: 'men', defer: 26, civil: false },
  th: { months: 12, who: 'men', defer: 26, civil: false },
  br: { months: 12, who: 'men', defer: 24, civil: true },
  mx: { months: 12, who: 'men', defer: 24, civil: false },
  co: { months: 18, who: 'men', defer: 24, civil: false },
  cu: { months: 24, who: 'men', defer: 24, civil: false },
  kp: { months: 120, who: 'all', defer: 0, civil: false },
};
