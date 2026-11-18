// The medication catalog. Generic names are the ids; brand names are display
// data only. Nothing here is prescribing guidance: there are no doses, and the
// game never shows a player how to take, combine or stop a real medicine.
//
// `from` is the first year the medicine was available for that use in a major
// market (approval histories: FDA, EMA, MHRA). `uses` lists the conditions it
// may be prescribed for, as 'first' (a usual first choice in NICE guidance) or
// 'option' (used in specialist hands). Anything not listed cannot be prescribed
// for that condition: the rule registry (engine/health/rules.js) refuses it.
//
// response: how a simulated course tends to go, as shares of people for whom
// it helps a lot or partly. These are illustrative game settings, chosen to sit
// near the published picture (in the STAR*D trial about a third of people
// reached remission on their first antidepressant), not efficacy figures.
//
// effects: side-effect categories from the medicine's patient information
// (MedlinePlus, NHS). tier 'common' or 'less common' sets how often the game
// rolls them; `fades` means they usually ease over the first weeks.

const SSRI_EFFECTS = [
  { id: 'nausea', cat: 'gastro', label: 'Upset stomach', tier: 'common', fades: true },
  { id: 'sleep', cat: 'sleep', label: 'Changes in sleep', tier: 'common', fades: true },
  { id: 'restless', cat: 'restlessness', label: 'Feeling jittery', tier: 'less common', fades: true },
  { id: 'sexual', cat: 'sexual', label: 'Sexual side effects', tier: 'common', fades: false, adult: true },
  { id: 'tired', cat: 'fatigue', label: 'Tiredness', tier: 'less common', fades: true },
];

/** @type {import('../../types.js').MedicationDef[]} */
export const MEDICATIONS = [
  // ---------- Antidepressants ----------
  { id: 'escitalopram', name: 'Escitalopram', brands: { us: 'Lexapro', default: 'Cipralex' }, cls: 'SSRI', family: 'antidepressant',
    uses: { mdd: 'first', gad: 'first', panic: 'first', social_anxiety: 'first', ocd: 'option', ptsd: 'option', pdd: 'first' },
    from: 2001, minAge: 18, by: ['psychiatrist', 'gp'], onset: [2, 6], adequate: 6, response: { good: 0.38, partial: 0.3 },
    effects: SSRI_EFFECTS, stopping: 'moderate', tags: ['serotonergic'],
    sources: ['MedlinePlus: Escitalopram', 'NICE NG222'] },
  { id: 'sertraline', name: 'Sertraline', brands: { us: 'Zoloft', default: 'Lustral' }, cls: 'SSRI', family: 'antidepressant',
    uses: { mdd: 'first', gad: 'first', panic: 'first', social_anxiety: 'first', ocd: 'first', ptsd: 'first', pdd: 'first' },
    from: 1990, minAge: 18, youth: ['ocd'], by: ['psychiatrist', 'gp'], onset: [2, 6], adequate: 6, response: { good: 0.38, partial: 0.3 },
    effects: SSRI_EFFECTS, stopping: 'moderate', tags: ['serotonergic'],
    sources: ['MedlinePlus: Sertraline', 'NICE NG222', 'NICE NG116'] },
  { id: 'fluoxetine', name: 'Fluoxetine', brands: { us: 'Prozac', default: 'Prozac' }, cls: 'SSRI', family: 'antidepressant',
    uses: { mdd: 'first', bulimia: 'option', ocd: 'first', panic: 'option', pdd: 'first' },
    from: 1986, minAge: 18, youth: ['mdd'], by: ['psychiatrist', 'gp'], onset: [2, 8], adequate: 8, response: { good: 0.36, partial: 0.3 },
    effects: SSRI_EFFECTS, stopping: 'low', tags: ['serotonergic'],
    sources: ['MedlinePlus: Fluoxetine', 'NICE NG134 (depression in children)'] },
  { id: 'venlafaxine', name: 'Venlafaxine', brands: { us: 'Effexor', default: 'Efexor' }, cls: 'SNRI', family: 'antidepressant',
    uses: { mdd: 'option', gad: 'option', social_anxiety: 'option', panic: 'option' },
    from: 1993, minAge: 18, by: ['psychiatrist', 'gp'], onset: [2, 6], adequate: 6, response: { good: 0.38, partial: 0.28 },
    effects: [
      { id: 'nausea', cat: 'gastro', label: 'Upset stomach', tier: 'common', fades: true },
      { id: 'sweating', cat: 'other', label: 'Sweating', tier: 'common', fades: false },
      { id: 'sleep', cat: 'sleep', label: 'Changes in sleep', tier: 'common', fades: true },
      { id: 'sexual', cat: 'sexual', label: 'Sexual side effects', tier: 'common', fades: false, adult: true },
      { id: 'bp', cat: 'other', label: 'Raised blood pressure', tier: 'less common', fades: false },
    ], stopping: 'notable', tags: ['serotonergic'], monitoring: { what: 'blood pressure', every: 26 },
    sources: ['MedlinePlus: Venlafaxine', 'NICE NG222'] },
  { id: 'duloxetine', name: 'Duloxetine', brands: { us: 'Cymbalta', default: 'Cymbalta' }, cls: 'SNRI', family: 'antidepressant',
    uses: { mdd: 'option', gad: 'option' },
    from: 2004, minAge: 18, by: ['psychiatrist', 'gp'], onset: [2, 6], adequate: 6, response: { good: 0.36, partial: 0.3 },
    effects: [
      { id: 'nausea', cat: 'gastro', label: 'Upset stomach', tier: 'common', fades: true },
      { id: 'dry', cat: 'other', label: 'Dry mouth', tier: 'common', fades: false },
      { id: 'tired', cat: 'fatigue', label: 'Tiredness', tier: 'common', fades: true },
      { id: 'appetite', cat: 'appetite', label: 'Less appetite', tier: 'less common', fades: true },
    ], stopping: 'moderate', tags: ['serotonergic'],
    sources: ['MedlinePlus: Duloxetine'] },
  { id: 'bupropion', name: 'Bupropion', brands: { us: 'Wellbutrin', default: 'Wellbutrin' }, cls: 'NDRI', family: 'antidepressant',
    uses: { mdd: 'option' },
    from: 1989, minAge: 18, by: ['psychiatrist', 'gp'], onset: [2, 6], adequate: 6, response: { good: 0.34, partial: 0.3 },
    effects: [
      { id: 'sleep', cat: 'sleep', label: 'Trouble sleeping', tier: 'common', fades: true },
      { id: 'restless', cat: 'restlessness', label: 'Feeling restless', tier: 'common', fades: true },
      { id: 'dry', cat: 'other', label: 'Dry mouth', tier: 'common', fades: false },
    ], stopping: 'low', tags: [], avoidWith: ['epilepsy', 'anorexia', 'bulimia'],
    sources: ['MedlinePlus: Bupropion'] },
  { id: 'mirtazapine', name: 'Mirtazapine', brands: { us: 'Remeron', default: 'Zispin' }, cls: 'NaSSA', family: 'antidepressant',
    uses: { mdd: 'option' },
    from: 1994, minAge: 18, by: ['psychiatrist', 'gp'], onset: [1, 4], adequate: 6, response: { good: 0.36, partial: 0.3 },
    effects: [
      { id: 'drowsy', cat: 'fatigue', label: 'Drowsiness', tier: 'common', fades: true },
      { id: 'appetite', cat: 'appetite', label: 'More appetite', tier: 'common', fades: false },
    ], stopping: 'moderate', tags: [],
    sources: ['MedlinePlus: Mirtazapine'] },

  // ---------- Bipolar disorder ----------
  { id: 'lithium', name: 'Lithium', brands: { default: 'Priadel', us: 'Lithobid' }, cls: 'mood stabilizer', family: 'mood_stabilizer',
    uses: { bipolar_1: 'first', bipolar_2: 'first' },
    from: 1949, minAge: 18, by: ['psychiatrist'], onset: [2, 8], adequate: 26, response: { good: 0.4, partial: 0.3 }, prevents: true,
    effects: [
      { id: 'thirst', cat: 'other', label: 'Thirst', tier: 'common', fades: false },
      { id: 'tremor', cat: 'restlessness', label: 'A fine tremor', tier: 'common', fades: false },
      { id: 'nausea', cat: 'gastro', label: 'Upset stomach', tier: 'less common', fades: true },
    ], stopping: 'notable', tags: ['needs_levels'], monitoring: { what: 'blood levels, kidney and thyroid function', every: 13 },
    sources: ['NICE CG185', 'MedlinePlus: Lithium'] },
  { id: 'lamotrigine', name: 'Lamotrigine', brands: { us: 'Lamictal', default: 'Lamictal' }, cls: 'anticonvulsant', family: 'mood_stabilizer',
    uses: { bipolar_1: 'option', bipolar_2: 'option', epilepsy: 'first' },
    from: 1994, fromFor: { bipolar_1: 2003, bipolar_2: 2003 }, minAge: 18, by: ['psychiatrist', 'neurologist'], onset: [4, 10], adequate: 12, response: { good: 0.38, partial: 0.3 }, prevents: true,
    effects: [
      { id: 'rash', cat: 'other', label: 'A skin rash (to be reported straight away)', tier: 'less common', fades: false, urgent: true },
      { id: 'dizzy', cat: 'other', label: 'Dizziness', tier: 'common', fades: true },
      { id: 'headache', cat: 'other', label: 'Headaches', tier: 'common', fades: true },
    ], stopping: 'moderate', tags: ['slow_start'],
    sources: ['MedlinePlus: Lamotrigine', 'NICE CG185'] },
  { id: 'quetiapine', name: 'Quetiapine', brands: { us: 'Seroquel', default: 'Seroquel' }, cls: 'atypical antipsychotic', family: 'mood_stabilizer',
    uses: { bipolar_1: 'first', bipolar_2: 'option', schizophrenia: 'option' },
    from: 1997, fromFor: { bipolar_1: 2004, bipolar_2: 2006 }, minAge: 18, by: ['psychiatrist'], onset: [1, 4], adequate: 8, response: { good: 0.38, partial: 0.3 }, prevents: true,
    effects: [
      { id: 'drowsy', cat: 'fatigue', label: 'Drowsiness', tier: 'common', fades: true },
      { id: 'weight', cat: 'appetite', label: 'More appetite and weight change', tier: 'common', fades: false },
      { id: 'dizzy', cat: 'other', label: 'Dizziness on standing', tier: 'less common', fades: true },
    ], stopping: 'moderate', tags: ['metabolic'], monitoring: { what: 'weight, blood sugar and cholesterol', every: 26 },
    sources: ['NICE CG185', 'MedlinePlus: Quetiapine'] },
  { id: 'aripiprazole', name: 'Aripiprazole', brands: { us: 'Abilify', default: 'Abilify' }, cls: 'atypical antipsychotic', family: 'antipsychotic',
    uses: { schizophrenia: 'first', bipolar_1: 'option' },
    from: 2002, minAge: 18, by: ['psychiatrist'], onset: [1, 6], adequate: 6, response: { good: 0.4, partial: 0.3 }, prevents: true,
    effects: [
      { id: 'restless', cat: 'restlessness', label: 'Inner restlessness', tier: 'common', fades: true },
      { id: 'nausea', cat: 'gastro', label: 'Upset stomach', tier: 'less common', fades: true },
      { id: 'sleep', cat: 'sleep', label: 'Trouble sleeping', tier: 'less common', fades: true },
    ], stopping: 'moderate', tags: ['metabolic'], monitoring: { what: 'weight, blood sugar and cholesterol', every: 26 },
    sources: ['NICE CG178', 'MedlinePlus: Aripiprazole'] },

  // ---------- ADHD ----------
  { id: 'methylphenidate', name: 'Methylphenidate', brands: { us: 'Ritalin', default: 'Ritalin' }, cls: 'stimulant', family: 'adhd',
    uses: { adhd: 'first' },
    from: 1955, minAge: 6, by: ['psychiatrist', 'pediatrician'], onset: [0, 2], adequate: 4, response: { good: 0.55, partial: 0.25 }, controlled: true,
    effects: [
      { id: 'appetite', cat: 'appetite', label: 'Less appetite', tier: 'common', fades: true },
      { id: 'sleep', cat: 'sleep', label: 'Trouble getting to sleep', tier: 'common', fades: true },
      { id: 'headache', cat: 'other', label: 'Headaches', tier: 'common', fades: true },
      { id: 'heart', cat: 'other', label: 'A faster heart rate', tier: 'less common', fades: false },
    ], stopping: 'low', tags: ['stimulant', 'cardio'], monitoring: { what: 'heart rate, blood pressure, height and weight', every: 26 },
    sources: ['NICE NG87', 'MedlinePlus: Methylphenidate'] },
  { id: 'lisdexamfetamine', name: 'Lisdexamfetamine', brands: { us: 'Vyvanse', default: 'Elvanse' }, cls: 'stimulant', family: 'adhd',
    uses: { adhd: 'first' },
    from: 2007, minAge: 6, by: ['psychiatrist', 'pediatrician'], onset: [0, 2], adequate: 4, response: { good: 0.55, partial: 0.25 }, controlled: true,
    effects: [
      { id: 'appetite', cat: 'appetite', label: 'Less appetite', tier: 'common', fades: true },
      { id: 'sleep', cat: 'sleep', label: 'Trouble getting to sleep', tier: 'common', fades: true },
      { id: 'dry', cat: 'other', label: 'Dry mouth', tier: 'common', fades: false },
      { id: 'heart', cat: 'other', label: 'A faster heart rate', tier: 'less common', fades: false },
    ], stopping: 'low', tags: ['stimulant', 'cardio'], monitoring: { what: 'heart rate, blood pressure, height and weight', every: 26 },
    sources: ['NICE NG87', 'MedlinePlus: Lisdexamfetamine'] },
  { id: 'amphetamine_salts', name: 'Mixed amphetamine salts', brands: { us: 'Adderall', default: 'Adderall' }, cls: 'stimulant', family: 'adhd',
    uses: { adhd: 'option' },
    from: 1996, minAge: 6, by: ['psychiatrist', 'pediatrician'], onset: [0, 2], adequate: 4, response: { good: 0.52, partial: 0.25 }, controlled: true,
    countries: ['us', 'ca'],
    effects: [
      { id: 'appetite', cat: 'appetite', label: 'Less appetite', tier: 'common', fades: true },
      { id: 'sleep', cat: 'sleep', label: 'Trouble getting to sleep', tier: 'common', fades: true },
      { id: 'heart', cat: 'other', label: 'A faster heart rate', tier: 'less common', fades: false },
    ], stopping: 'low', tags: ['stimulant', 'cardio'], monitoring: { what: 'heart rate, blood pressure, height and weight', every: 26 },
    sources: ['MedlinePlus: Amphetamine'] },
  { id: 'atomoxetine', name: 'Atomoxetine', brands: { us: 'Strattera', default: 'Strattera' }, cls: 'non-stimulant', family: 'adhd',
    uses: { adhd: 'option' },
    from: 2002, minAge: 6, by: ['psychiatrist', 'pediatrician'], onset: [2, 8], adequate: 10, response: { good: 0.42, partial: 0.28 },
    effects: [
      { id: 'nausea', cat: 'gastro', label: 'Upset stomach', tier: 'common', fades: true },
      { id: 'tired', cat: 'fatigue', label: 'Tiredness', tier: 'common', fades: true },
      { id: 'appetite', cat: 'appetite', label: 'Less appetite', tier: 'common', fades: true },
    ], stopping: 'low', tags: ['cardio'], monitoring: { what: 'heart rate, blood pressure, height and weight', every: 26 },
    sources: ['NICE NG87', 'MedlinePlus: Atomoxetine'] },
  { id: 'guanfacine', name: 'Guanfacine (extended release)', brands: { us: 'Intuniv', default: 'Intuniv' }, cls: 'non-stimulant', family: 'adhd',
    uses: { adhd: 'option' },
    from: 2009, minAge: 6, maxAge: 17, by: ['psychiatrist', 'pediatrician'], onset: [2, 6], adequate: 8, response: { good: 0.4, partial: 0.28 },
    effects: [
      { id: 'drowsy', cat: 'fatigue', label: 'Drowsiness', tier: 'common', fades: true },
      { id: 'dizzy', cat: 'other', label: 'Dizziness', tier: 'less common', fades: true },
    ], stopping: 'notable', tags: ['cardio'], monitoring: { what: 'heart rate and blood pressure', every: 13 },
    sources: ['NICE NG87', 'MedlinePlus: Guanfacine'] },

  // ---------- Physical conditions ----------
  { id: 'levetiracetam', name: 'Levetiracetam', brands: { us: 'Keppra', default: 'Keppra' }, cls: 'antiseizure', family: 'antiseizure',
    uses: { epilepsy: 'first' },
    from: 1999, minAge: 1, by: ['neurologist'], onset: [1, 4], adequate: 12, response: { good: 0.5, partial: 0.25 }, prevents: true,
    effects: [
      { id: 'tired', cat: 'fatigue', label: 'Tiredness', tier: 'common', fades: true },
      { id: 'mood', cat: 'other', label: 'Feeling irritable', tier: 'less common', fades: false },
    ], stopping: 'notable', tags: [],
    sources: ['NICE NG217', 'MedlinePlus: Levetiracetam'] },
  { id: 'sumatriptan', name: 'Sumatriptan', brands: { us: 'Imitrex', default: 'Imigran' }, cls: 'triptan', family: 'migraine',
    uses: { migraine: 'first' },
    from: 1991, minAge: 18, by: ['gp', 'neurologist'], onset: [0, 1], adequate: 4, response: { good: 0.5, partial: 0.3 },
    effects: [{ id: 'tight', cat: 'other', label: 'Tightness or tingling', tier: 'common', fades: true }],
    stopping: 'low', tags: ['serotonergic'],
    sources: ['NHS: Migraine', 'MedlinePlus: Sumatriptan'] },
  { id: 'cftr_modulator', name: 'Elexacaftor, tezacaftor and ivacaftor', brands: { us: 'Trikafta', default: 'Kaftrio' }, cls: 'CFTR modulator', family: 'cf',
    uses: { cystic_fibrosis: 'first' },
    from: 2019, minAge: 2, by: ['doctor'], onset: [2, 8], adequate: 12, response: { good: 0.7, partial: 0.2 },
    effects: [{ id: 'headache', cat: 'other', label: 'Headaches', tier: 'common', fades: true }],
    stopping: 'low', tags: [], monitoring: { what: 'liver function', every: 26 },
    sources: ['MedlinePlus Genetics: Cystic fibrosis', 'FDA approval, 2019'] },
  // ---------- Long-term physical conditions ----------
  { id: 'salbutamol', name: 'Salbutamol inhaler', brands: { us: 'Ventolin (albuterol)', default: 'Ventolin' }, cls: 'reliever inhaler', family: 'asthma',
    uses: { asthma: 'first' }, from: 1969, minAge: 2, by: ['gp', 'doctor'], onset: [0, 1], adequate: 4, response: { good: 0.5, partial: 0.35 },
    effects: [{ id: 'shaky', cat: 'restlessness', label: 'Shakiness', tier: 'common', fades: true }, { id: 'heart', cat: 'other', label: 'A faster heartbeat', tier: 'less common', fades: true }],
    stopping: 'low', tags: [], sources: ['NICE NG80', 'MedlinePlus: Albuterol'] },
  { id: 'beclometasone', name: 'Beclometasone preventer inhaler', brands: { us: 'Qvar', default: 'Clenil' }, cls: 'inhaled corticosteroid', family: 'asthma',
    uses: { asthma: 'first' }, from: 1972, minAge: 5, by: ['gp', 'doctor'], onset: [1, 4], adequate: 8, response: { good: 0.6, partial: 0.25 }, prevents: true,
    effects: [{ id: 'hoarse', cat: 'other', label: 'A hoarse voice', tier: 'less common', fades: false }, { id: 'thrush', cat: 'other', label: 'A sore mouth (oral thrush)', tier: 'less common', fades: false }],
    stopping: 'low', tags: [], sources: ['NICE NG80', 'MedlinePlus: Beclomethasone oral inhalation'] },
  { id: 'metformin', name: 'Metformin', brands: { us: 'Glucophage', default: 'Glucophage' }, cls: 'biguanide', family: 'diabetes',
    uses: { type2_diabetes: 'first' }, from: 1958, minAge: 10, by: ['gp', 'doctor'], onset: [2, 6], adequate: 12, response: { good: 0.6, partial: 0.25 },
    effects: [{ id: 'gastro', cat: 'gastro', label: 'Upset stomach', tier: 'common', fades: true }, { id: 'taste', cat: 'other', label: 'A metallic taste', tier: 'less common', fades: true }],
    stopping: 'low', tags: [], monitoring: { what: 'blood sugar (HbA1c) and kidney function', every: 26 },
    sources: ['NICE NG28', 'MedlinePlus: Metformin'] },
  { id: 'amlodipine', name: 'Amlodipine', brands: { us: 'Norvasc', default: 'Istin' }, cls: 'calcium channel blocker', family: 'blood_pressure',
    uses: { hypertension: 'first' }, from: 1990, minAge: 18, by: ['gp', 'cardiologist', 'doctor'], onset: [1, 4], adequate: 8, response: { good: 0.6, partial: 0.25 },
    effects: [{ id: 'ankles', cat: 'other', label: 'Swollen ankles', tier: 'common', fades: false }, { id: 'flush', cat: 'other', label: 'Flushing and headaches', tier: 'less common', fades: true }],
    stopping: 'low', tags: [], sources: ['NICE NG136', 'MedlinePlus: Amlodipine'] },
  { id: 'ramipril', name: 'Ramipril', brands: { us: 'Altace', default: 'Tritace' }, cls: 'ACE inhibitor', family: 'blood_pressure',
    uses: { hypertension: 'first', heart_disease: 'option' }, from: 1991, minAge: 18, by: ['gp', 'cardiologist', 'doctor'], onset: [1, 4], adequate: 8, response: { good: 0.6, partial: 0.25 },
    effects: [{ id: 'cough', cat: 'other', label: 'A dry cough', tier: 'common', fades: false }, { id: 'dizzy', cat: 'other', label: 'Dizziness', tier: 'less common', fades: true }],
    stopping: 'low', tags: [], monitoring: { what: 'kidney function and potassium', every: 52 },
    sources: ['NICE NG136', 'MedlinePlus: Ramipril'] },
  { id: 'atorvastatin', name: 'Atorvastatin', brands: { us: 'Lipitor', default: 'Lipitor' }, cls: 'statin', family: 'cardiac',
    uses: { heart_disease: 'first' }, from: 1997, minAge: 18, by: ['gp', 'cardiologist', 'doctor'], onset: [2, 8], adequate: 12, response: { good: 0.55, partial: 0.3 }, prevents: true,
    effects: [{ id: 'aches', cat: 'other', label: 'Muscle aches', tier: 'less common', fades: false }, { id: 'gastro', cat: 'gastro', label: 'Indigestion', tier: 'less common', fades: true }],
    stopping: 'low', tags: [], monitoring: { what: 'cholesterol and liver function', every: 52 },
    sources: ['NICE CG181 / NG238', 'MedlinePlus: Atorvastatin'] },
  { id: 'factor_viii', name: 'Factor VIII', brands: { default: 'Factor VIII concentrate' }, cls: 'clotting factor', family: 'factor',
    uses: { hemophilia_a: 'first' },
    from: 1966, minAge: 0, by: ['doctor'], onset: [0, 1], adequate: 4, response: { good: 0.75, partial: 0.2 }, prevents: true,
    effects: [], stopping: 'low', tags: [],
    sources: ['MedlinePlus: Hemophilia'] },
];

export const MED_BY_ID = Object.fromEntries(MEDICATIONS.map((m) => [m.id, m]));

/** What the game calls a medicine: the generic name, with the local brand alongside where there is one. */
export function medName(m, countryId) {
  const brand = m.brands?.[countryId] ?? m.brands?.default;
  return brand && brand !== m.name ? `${m.name} (${brand})` : m.name;
}

/** Medicine families, for display and for the rules about combining. */
export const FAMILIES = {
  antidepressant: 'Antidepressant', mood_stabilizer: 'Mood stabilizer', antipsychotic: 'Antipsychotic', adhd: 'ADHD medication',
  antiseizure: 'Antiseizure medication', migraine: 'Migraine treatment', cf: 'CFTR modulator', factor: 'Clotting factor replacement',
  asthma: 'Asthma inhaler', diabetes: 'Diabetes medicine', blood_pressure: 'Blood pressure medicine', cardiac: 'Heart medicine',
};
