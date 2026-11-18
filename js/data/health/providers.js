// Health professions and the places they work.
//
// Scope of practice differs between countries and has changed over time; the
// game uses one simplified scope for each profession (what it may assess,
// whether it may prescribe) and an era in which it existed. `diagnoses` lists
// condition groups the profession can formally diagnose; `prescribes` lists
// medicine families. Psychologists do not prescribe in this model (a few US
// states allow it; the game does not). primary care doctors may diagnose common conditions but
// refer on for BPD, bipolar disorder, psychosis and adult ADHD, as NICE advises.

export const PROFESSIONS = {
  gp: { name: 'General practitioner', title: 'Dr.', from: 1800, career: 'Family doctor',
    diagnoses: ['mood', 'anxiety', 'eating', 'chronic', 'sensory'], only: ['mdd', 'gad', 'panic', 'migraine', 'hearing_loss', 'low_vision', 'anorexia', 'bulimia', 'bed', 'asthma', 'hypertension', 'type2_diabetes', 'back_pain'],
    prescribes: ['antidepressant', 'migraine', 'asthma', 'diabetes', 'blood_pressure', 'cardiac'], qual: 'Medical degree, general practice training' },
  psychiatrist: { name: 'Psychiatrist', title: 'Dr.', from: 1808, career: 'Psychiatrist',
    diagnoses: ['mood', 'anxiety', 'trauma', 'ocd', 'personality', 'eating', 'psychotic', 'neurodev'],
    prescribes: ['antidepressant', 'mood_stabilizer', 'antipsychotic', 'adhd'], qual: 'Medical degree, specialist psychiatry training' },
  psychologist: { name: 'Clinical psychologist', title: 'Dr.', from: 1896, career: 'Clinical psychologist',
    diagnoses: ['mood', 'anxiety', 'trauma', 'ocd', 'personality', 'eating', 'neurodev'], prescribes: [],
    qual: 'Doctorate in clinical psychology' },
  therapist: { name: 'Psychotherapist', title: '', from: 1920, career: 'Psychotherapist', diagnoses: [], prescribes: [],
    qual: 'Accredited psychotherapy training' },
  counselor: { name: 'Counselor', title: '', from: 1942, career: 'Counselor', diagnoses: [], prescribes: [], qual: 'Counseling diploma' },
  social_worker: { name: 'Clinical social worker', title: '', from: 1920, career: 'Social worker', diagnoses: [], prescribes: [], qual: 'Social work degree, clinical license' },
  nurse: { name: 'Practice nurse', title: '', from: 1900, career: 'Nurse', diagnoses: [], prescribes: [], qual: 'Nursing degree' },
  psychiatric_nurse: { name: 'Mental health nurse', title: '', from: 1890, career: 'Nurse', diagnoses: [], prescribes: [], qual: 'Nursing degree, mental health specialism' },
  pediatrician: { name: 'Pediatrician', title: 'Dr.', from: 1860, career: 'Pediatrician', diagnoses: ['neurodev', 'mobility', 'genetic'],
    prescribes: ['adhd'], qual: 'Medical degree, pediatric training' },
  neurologist: { name: 'Neurologist', title: 'Dr.', from: 1860, career: 'Neurologist', diagnoses: ['chronic', 'mobility', 'genetic', 'neurodev'], only: ['epilepsy', 'migraine', 'tourette', 'cerebral_palsy', 'huntingtons'],
    prescribes: ['antiseizure', 'migraine', 'mood_stabilizer'], qual: 'Medical degree, neurology training' },
  cardiologist: { name: 'Cardiologist', title: 'Dr.', from: 1920, career: 'Cardiologist', diagnoses: ['chronic'], only: ['heart_disease', 'hypertension'],
    prescribes: ['cardiac', 'blood_pressure'], qual: 'Medical degree, cardiology training' },
  oncologist: { name: 'Oncologist', title: 'Dr.', from: 1950, career: 'Oncologist', diagnoses: ['chronic'], only: ['cancer'], prescribes: [], qual: 'Medical degree, oncology training' },
  doctor: { name: 'Hospital doctor', title: 'Dr.', from: 1800, career: 'Doctor', diagnoses: ['mobility', 'genetic', 'chronic'], prescribes: ['cf', 'factor', 'asthma', 'diabetes', 'blood_pressure', 'cardiac'],
    qual: 'Medical degree' },
  educational_psychologist: { name: 'Educational psychologist', title: 'Dr.', from: 1913, career: 'Educational psychologist',
    diagnoses: ['neurodev'], only: ['dyslexia', 'dyscalculia', 'dysgraphia'], prescribes: [], qual: 'Doctorate in educational psychology' },
  specialist_teacher: { name: 'Specialist teacher', title: '', from: 1935, career: 'Specialist teacher', diagnoses: [], prescribes: [], qual: 'Specialist teaching certificate' },
  occupational_therapist: { name: 'Occupational therapist', title: '', from: 1917, career: 'Occupational therapist',
    diagnoses: [], prescribes: [], qual: 'Occupational therapy degree' },
  physiotherapist: { name: 'Physiotherapist', title: '', from: 1894, career: 'Physiotherapist', diagnoses: [], prescribes: [], qual: 'Physiotherapy degree' },
  speech_therapist: { name: 'Speech and language therapist', title: '', from: 1925, career: 'Speech therapist',
    diagnoses: ['neurodev'], only: ['dld'], prescribes: [], qual: 'Speech and language therapy degree' },
  audiologist: { name: 'Audiologist', title: '', from: 1946, career: 'Audiologist', diagnoses: ['sensory'], only: ['deaf', 'hearing_loss'], prescribes: [], qual: 'Audiology degree' },
  ent: { name: 'Ear, nose and throat surgeon', title: 'Dr.', from: 1870, career: 'Surgeon', diagnoses: ['sensory'], only: ['deaf', 'hearing_loss'], prescribes: [], qual: 'Medical degree, ENT training' },
  ophthalmologist: { name: 'Ophthalmologist', title: 'Dr.', from: 1850, career: 'Ophthalmologist', diagnoses: ['sensory', 'genetic'], only: ['blind', 'low_vision', 'lhon', 'color_vision'], prescribes: [], qual: 'Medical degree, ophthalmology training' },
  optometrist: { name: 'Optometrist', title: '', from: 1900, career: 'Optometrist', diagnoses: ['sensory', 'genetic'], only: ['low_vision', 'color_vision'], prescribes: [], qual: 'Optometry degree' },
};

/** Professions that offer each kind of approach to care, in the order the game approaches them. */
export const APPROACHES = ['Warm and practical', 'Structured and goal-focused', 'Calm and unhurried', 'Direct and plain-spoken', 'Collaborative'];

/**
 * Kinds of facility. Each city gets one of each kind that existed in the year the
 * player first needs it (engine/health/care.js), and keeps it afterward.
 * public: run by the health system (cheaper where care is public).
 */
export const FACILITIES = [
  { id: 'primary', name: (city) => `${city} Medical Practice`, kind: 'Primary care clinic', from: 1800, public: true,
    staff: ['gp', 'nurse'], services: ['checkup', 'assessment', 'prescribing'], access: 0.7 },
  { id: 'mental', name: (city) => `${city} Community Mental Health Service`, kind: 'Mental health clinic', from: 1963, public: true,
    staff: ['psychiatrist', 'psychologist', 'psychiatric_nurse', 'therapist'], services: ['assessment', 'therapy', 'groups', 'prescribing'], access: 0.8, waits: 8 },
  { id: 'dbt', name: (city) => `${city} DBT Program`, kind: 'DBT program', from: 1995, public: true,
    staff: ['psychologist', 'therapist'], dbt: true, services: ['therapy', 'groups'], access: 0.8, waits: 6 },
  { id: 'private', name: (city) => `${city} Psychology Practice`, kind: 'Private therapy practice', from: 1950, public: false,
    staff: ['psychologist', 'therapist', 'counselor'], services: ['assessment', 'therapy', 'groups'], access: 0.6, fee: 1.6 },
  { id: 'psychiatry', name: (city) => `${city} Psychiatry Clinic`, kind: 'Psychiatry practice', from: 1900, public: false,
    staff: ['psychiatrist'], services: ['assessment', 'prescribing'], access: 0.6, fee: 1.5 },
  { id: 'hospital', name: (city) => `${city} General Hospital`, kind: 'Hospital', from: 1800, public: true,
    staff: ['doctor', 'neurologist', 'pediatrician', 'ophthalmologist', 'ent', 'audiologist', 'cardiologist', 'oncologist'], services: ['assessment', 'prescribing', 'specialist', 'admission'], access: 0.9 },
  { id: 'rehab', name: (city) => `${city} Rehabilitation Center`, kind: 'Rehabilitation center', from: 1945, public: true,
    staff: ['physiotherapist', 'occupational_therapist', 'speech_therapist'], services: ['therapy'], access: 1 },
  { id: 'learning', name: (city) => `${city} Learning Support Service`, kind: 'Educational assessment service', from: 1950, public: true,
    staff: ['educational_psychologist', 'specialist_teacher'], services: ['assessment', 'therapy'], access: 0.8 },
  { id: 'community', name: (city) => `${city} Community Center`, kind: 'Community organization', from: 1900, public: true,
    staff: [], services: ['peer'], access: 0.9 },
];
export const FACILITY_BY_ID = Object.fromEntries(FACILITIES.map((f) => [f.id, f]));

/** What a single appointment costs before cover, in base units. */
export const VISIT_COST = { assessment: 350, review: 120, monitoring: 90, checkup: 200, prescription: 25, hospitalWeek: 3500 };
