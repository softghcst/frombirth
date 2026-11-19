// Working-time law and standard benefits, by country.
//
// GAMEPLAY CONFIGURATION, SIMPLIFIED AND UNVERIFIED. One value per place for
// things that in reality depend on contracts, sectors, collective agreements
// and exceptions. Nothing here is legal or employment advice. Places not
// listed use DEFAULT. Keyed by the same country ids as data/countries.js.
// The state pension age is not here: it is the rule engine's retirementAge.
//
//   workAge         youngest age for ordinary paid work
//   minorHours      most weekly hours of paid work under 18 (during the school year)
//   maxHours        working hours a week above which employers may not ask for more
//   leaveDays       paid holiday a full-time employee is owed a year
//   parentalWeeks   paid parental leave, in weeks
//   pension         share of pay an employer puts toward a pension (0–0.15)
//   sickPay         whether ordinary employees are paid while off sick
//   unemployment    share of previous pay paid for a while after losing a job (0 = none)
export const DEFAULT = { workAge: 16, minorHours: 20, maxHours: 60, leaveDays: 20, parentalWeeks: 14, pension: 0.04, sickPay: true, unemployment: 0.4 };

export const WORK_LAW = {
  us: { workAge: 14, minorHours: 18, leaveDays: 10, parentalWeeks: 0, pension: 0.04, sickPay: false, unemployment: 0.4 },
  ca: { workAge: 14, leaveDays: 10, parentalWeeks: 35, pension: 0.04 },
  uk: { workAge: 13, minorHours: 12, maxHours: 48, leaveDays: 28, parentalWeeks: 39, pension: 0.03 },
  ie: { workAge: 14, minorHours: 8, maxHours: 48, leaveDays: 20, parentalWeeks: 26 },
  fr: { workAge: 16, minorHours: 35, maxHours: 48, leaveDays: 25, parentalWeeks: 16, pension: 0.1, unemployment: 0.6 },
  de: { workAge: 15, minorHours: 8, maxHours: 48, leaveDays: 24, parentalWeeks: 58, pension: 0.09, unemployment: 0.6 },
  it: { workAge: 16, maxHours: 48, leaveDays: 20, parentalWeeks: 21, pension: 0.09 },
  es: { workAge: 16, maxHours: 48, leaveDays: 22, parentalWeeks: 16, pension: 0.08 },
  nl: { workAge: 13, minorHours: 12, maxHours: 48, leaveDays: 20, parentalWeeks: 16, pension: 0.1 },
  se: { workAge: 13, maxHours: 48, leaveDays: 25, parentalWeeks: 68, pension: 0.1, unemployment: 0.7 },
  no: { workAge: 13, maxHours: 48, leaveDays: 25, parentalWeeks: 49, pension: 0.05 },
  dk: { workAge: 13, maxHours: 48, leaveDays: 25, parentalWeeks: 52, pension: 0.08 },
  fi: { workAge: 14, maxHours: 48, leaveDays: 25, parentalWeeks: 58, pension: 0.1 },
  ch: { workAge: 13, maxHours: 50, leaveDays: 20, parentalWeeks: 14, pension: 0.08 },
  au: { workAge: 13, leaveDays: 20, parentalWeeks: 22, pension: 0.115 },
  nz: { workAge: 14, leaveDays: 20, parentalWeeks: 26, pension: 0.03 },
  jp: { workAge: 15, maxHours: 60, leaveDays: 10, parentalWeeks: 52, pension: 0.09 },
  kr: { workAge: 15, maxHours: 52, leaveDays: 15, parentalWeeks: 52, pension: 0.045 },
  cn: { workAge: 16, maxHours: 60, leaveDays: 5, parentalWeeks: 14, pension: 0.16, unemployment: 0.3 },
  in: { workAge: 14, maxHours: 60, leaveDays: 12, parentalWeeks: 26, pension: 0.12, sickPay: false, unemployment: 0 },
  br: { workAge: 16, maxHours: 44, leaveDays: 30, parentalWeeks: 17, pension: 0.08, unemployment: 0.5 },
  mx: { workAge: 15, maxHours: 48, leaveDays: 12, parentalWeeks: 12, pension: 0.05, unemployment: 0 },
  ar: { workAge: 16, maxHours: 48, leaveDays: 14, parentalWeeks: 13, pension: 0.1 },
  za: { workAge: 15, maxHours: 45, leaveDays: 15, parentalWeeks: 17, pension: 0.05, unemployment: 0.38 },
  ng: { workAge: 15, maxHours: 60, leaveDays: 6, parentalWeeks: 12, pension: 0.1, sickPay: false, unemployment: 0 },
  ke: { workAge: 16, maxHours: 52, leaveDays: 21, parentalWeeks: 13, pension: 0.06, unemployment: 0 },
  eg: { workAge: 15, maxHours: 48, leaveDays: 15, parentalWeeks: 17, pension: 0.11, unemployment: 0 },
  sa: { workAge: 15, maxHours: 48, leaveDays: 21, parentalWeeks: 10, pension: 0.09, unemployment: 0.6 },
  ae: { workAge: 15, maxHours: 48, leaveDays: 30, parentalWeeks: 9, pension: 0, unemployment: 0.6 },
  ru: { workAge: 16, maxHours: 40, leaveDays: 28, parentalWeeks: 20, pension: 0.22, unemployment: 0.3 },
  ph: { workAge: 15, maxHours: 48, leaveDays: 5, parentalWeeks: 15, pension: 0.09, unemployment: 0 },
  sg: { workAge: 13, maxHours: 44, leaveDays: 7, parentalWeeks: 16, pension: 0.17, unemployment: 0 },
  il: { workAge: 15, maxHours: 42, leaveDays: 12, parentalWeeks: 15, pension: 0.065 },
  tr: { workAge: 15, maxHours: 45, leaveDays: 14, parentalWeeks: 16, pension: 0.15 },
  pl: { workAge: 15, maxHours: 48, leaveDays: 20, parentalWeeks: 52, pension: 0.1 },
  pt: { workAge: 16, maxHours: 48, leaveDays: 22, parentalWeeks: 20, pension: 0.24 },
  gr: { workAge: 15, maxHours: 48, leaveDays: 20, parentalWeeks: 17, pension: 0.13 },
};

/** Whether a weekly load leaves time for a life. Hours a week, everything counted. */
export const LOAD = { comfortable: 45, heavy: 55, crushing: 68, impossible: 84 };

/** Study hours a week, by how someone is enrolled. */
export const STUDY_HOURS = { school: 32, fullTime: 30, partTime: 12 };

/** Commute, hours a week each way combined, by the kind of city. */
export const COMMUTE = { capital: 7, largest: 6, city: 4 };
