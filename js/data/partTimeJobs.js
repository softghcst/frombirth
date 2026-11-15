// Weekend and after-school jobs for teenagers and students.
// pay is base units per year. Phase 4 folds these into the full career system.
export const PART_TIME_JOBS = [
  { id: 'cafe', title: 'Café assistant', place: 'the café by the station', pay: 3600, minAge: 15,
    hire: { base: 0.65, factors: { 'stats.charm': 0.5, 'hidden.discipline': 0.3 } } },
  { id: 'cinema', title: 'Cinema usher', place: 'the cinema', pay: 3200, minAge: 15,
    hire: { base: 0.7, factors: { 'stats.charm': 0.4 } } },
  { id: 'supermarket', title: 'Shelf stacker', place: 'the supermarket', pay: 4000, minAge: 16,
    hire: { base: 0.75, factors: { 'hidden.discipline': 0.4 } } },
];
export const PART_TIME_BY_ID = Object.fromEntries(PART_TIME_JOBS.map((j) => [j.id, j]));

/** Extra pay for covering a colleague's shift, in base units. */
export const COVER_SHIFT_PAY = 250;
