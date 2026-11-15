// Conditions the yearly health roll can hand out. `chance` is per year within
// the age window; `yearly` is applied every year the condition persists;
// `recover` is the yearly chance it clears up untreated. Phase 8 adds doctors.
export const ILLNESSES = [
  { id: 'flu', name: 'a nasty flu', ages: [0, 120], chance: 0.05, severity: 15,
    yearly: { health: -4, mood: -3 }, recover: 0.95 },
  { id: 'ear_infection', name: 'an ear infection', ages: [1, 10], chance: 0.05, severity: 10,
    yearly: { health: -3, mood: -2 }, recover: 0.95 },
  { id: 'broken_arm', name: 'a broken arm', ages: [4, 70], chance: 0.012, severity: 25,
    yearly: { health: -5, mood: -4 }, recover: 0.9 },
  { id: 'asthma', name: 'asthma', ages: [3, 40], chance: 0.004, severity: 30,
    yearly: { health: -2 }, recover: 0.05, chronic: true },
  { id: 'acne', name: 'stubborn acne', ages: [12, 19], chance: 0.06, severity: 5,
    yearly: { charm: -3, mood: -2 }, recover: 0.4 },
  { id: 'anxiety', name: 'an anxiety disorder', ages: [13, 80], chance: 0.008, severity: 30,
    yearly: { mood: -6 }, recover: 0.2 },
  { id: 'back_pain', name: 'chronic back pain', ages: [30, 120], chance: 0.012, severity: 25,
    yearly: { health: -2, mood: -3 }, recover: 0.15 },
  { id: 'high_bp', name: 'high blood pressure', ages: [40, 120], chance: 0.02, severity: 45,
    yearly: { health: -2 }, recover: 0.05, chronic: true },
  { id: 'diabetes', name: 'type 2 diabetes', ages: [40, 120], chance: 0.008, severity: 55,
    yearly: { health: -3 }, recover: 0, chronic: true },
  { id: 'broken_hip', name: 'a broken hip', ages: [60, 120], chance: 0.01, severity: 60,
    yearly: { health: -9, mood: -6 }, recover: 0.5 },
  { id: 'heart_disease', name: 'heart disease', ages: [50, 120], chance: 0.012, severity: 80,
    yearly: { health: -5 }, recover: 0, chronic: true },
  { id: 'cancer', name: 'cancer', ages: [35, 120], chance: 0.006, severity: 90,
    yearly: { health: -9, mood: -6 }, recover: 0.2 },
  { id: 'depression', name: 'depression', ages: [14, 90], chance: 0.01, severity: 35,
    yearly: { mood: -9, health: -1 }, recover: 0.2 },
  // Never caught: only ever the result of cosmetic surgery going wrong.
  { id: 'botched_surgery', name: 'a botched operation', ages: [0, 0], chance: 0, severity: 20,
    yearly: { mood: -4 }, recover: 0.03, chronic: true },
];

export const ILLNESS_BY_ID = Object.fromEntries(ILLNESSES.map((i) => [i.id, i]));
