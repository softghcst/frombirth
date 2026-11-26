// The medical professions: specialties and how one qualifies for each, what each qualification
// lets a doctor do, the tests and procedures the game knows (with the years they existed), and
// how training works in each country the game models.
//
// SOURCES AND LIMITS. The United States route is modeled in detail from its broad, well-known
// structure: a bachelor's degree, four years of MD or DO school with licensing exams along the way,
// a national residency match, residency of a set length by specialty, fellowships after it, and a
// separate podiatric (DPM) profession with its own school and residency. Training lengths are the
// usual US lengths. Every other country uses a simplified profile, marked as such: the broad shape of
// its system (direct entry from school, internship or foundation years, specialty training), not its
// exact rules. Years for tests and procedures are broad era gates (roughly when each came into
// ordinary hospital use), not a history of medicine. Nothing here is medical advice: procedures are
// named at the level of a hospital's list, never how they are done, and there are no medicines or doses.

// ---------- Specialties ----------
//
//   id, name, doctor (what one is called), kind: 'residency' | 'fellowship' | 'podiatry'
//   years        training length (a residency's, or a fellowship's own years)
//   after        for a fellowship: the completed residencies (or fellowships) that lead to it
//   surgical     whether the specialty operates
//   play         how its cases play: 'panel' (a list of patients over years), 'acute' (triage and stabilizing),
//                'or' (surgical cases through the operating room), 'reading' (images or tissue, reported to others),
//                'periop' (anesthesia: fitness for a procedure, the plan, the patient through it)
//   procedures   what completing it lets one do (PROCEDURES ids), on top of what it was built on
//   dept         the hospital department it belongs to
//   compete      how hard its training places are to get (0-1)
//   practice     the kind of private practice it can open, if any
//   minYear      the year the specialty exists as a recognized training route (broad)
//   profession   'medicine' | 'podiatry': a podiatrist is not a physician who chose feet
const S = (id, name, doctor, o) => ({ id, name, doctor, kind: 'residency', profession: 'medicine', surgical: false, procedures: [], compete: 0.4, minYear: 1900, ...o });
const F = (id, name, doctor, after, years, o) => S(id, name, doctor, { kind: 'fellowship', after, years, ...o });

export const SPECIALTIES = [
  // Primary residencies (entered from medical school)
  S('family', 'Family Medicine', 'family physician', { years: 3, play: 'panel', dept: 'family', compete: 0.2, procedures: ['office_minor', 'lc_implant'], practice: 'family_clinic', minYear: 1969 }),
  S('internal', 'Internal Medicine', 'internist', { years: 3, play: 'panel', dept: 'medicine', compete: 0.35, procedures: ['office_minor'], practice: 'internal_clinic' }),
  S('pediatrics', 'Pediatrics', 'pediatrician', { years: 3, play: 'panel', dept: 'pediatrics', compete: 0.3, procedures: ['office_minor'], practice: 'pediatric_clinic' }),
  S('emergency', 'Emergency Medicine', 'emergency physician', { years: 3, play: 'acute', dept: 'emergency', compete: 0.45, procedures: ['er_procedure'], minYear: 1979 }),
  S('gensurg', 'General Surgery', 'general surgeon', { years: 5, play: 'or', dept: 'surgery', surgical: true, compete: 0.6, procedures: ['gs_abdominal', 'gs_hernia', 'office_minor'] }),
  S('ortho', 'Orthopedic Surgery', 'orthopedic surgeon', { years: 5, play: 'or', dept: 'orthopedics', surgical: true, compete: 0.8, procedures: ['or_fracture', 'or_arthroscopy', 'or_joint', 'office_minor'], practice: 'ortho_clinic' }),
  S('neurosurg', 'Neurological Surgery', 'neurosurgeon', { years: 7, play: 'or', dept: 'neurosurgery', surgical: true, compete: 0.9, procedures: ['ns_cranial', 'ns_spine'], minYear: 1920 }),
  S('obgyn', 'Obstetrics and Gynecology', 'obstetrician-gynecologist', { years: 4, play: 'or', dept: 'obgyn', surgical: true, compete: 0.55, procedures: ['ob_delivery', 'ob_cesarean', 'gyn_surgery', 'office_minor', 'lc_iud', 'lc_implant', 'tubal'], practice: 'obgyn_clinic' }),
  S('psychiatry', 'Psychiatry', 'psychiatrist', { years: 4, play: 'panel', dept: 'psychiatry', compete: 0.35, practice: 'psychiatry_practice' }),
  S('dermatology', 'Dermatology', 'dermatologist', { years: 4, play: 'panel', dept: 'dermatology', compete: 0.85, procedures: ['derm_biopsy', 'derm_excision', 'office_minor'], practice: 'dermatology_clinic' }),
  S('neurology', 'Neurology', 'neurologist', { years: 4, play: 'panel', dept: 'neurology', compete: 0.4 }),
  S('anesthesiology', 'Anesthesiology', 'anesthesiologist', { years: 4, play: 'periop', dept: 'anesthesiology', compete: 0.5, procedures: ['anes_care'], minYear: 1940 }),
  S('radiology', 'Diagnostic Radiology', 'radiologist', { years: 5, play: 'reading', dept: 'radiology', compete: 0.6, procedures: ['image_guided'] }),
  S('pathology', 'Pathology', 'pathologist', { years: 4, play: 'reading', dept: 'pathology', compete: 0.3 }),
  S('ophthalmology', 'Ophthalmology', 'ophthalmologist', { years: 4, play: 'or', dept: 'ophthalmology', surgical: true, compete: 0.75, procedures: ['oph_cataract', 'oph_laser', 'office_minor'], practice: 'eye_clinic' }),
  S('ent', 'Otolaryngology (ENT)', 'ENT surgeon', { years: 5, play: 'or', dept: 'ent', surgical: true, compete: 0.75, procedures: ['ent_surgery', 'office_minor'] }),
  S('urology', 'Urology', 'urologist', { years: 5, play: 'or', dept: 'urology', surgical: true, compete: 0.7, procedures: ['uro_surgery', 'office_minor', 'vasectomy'] }),
  S('pmr', 'Physical Medicine and Rehabilitation', 'physiatrist', { years: 4, play: 'panel', dept: 'rehabilitation', compete: 0.35, minYear: 1947 }),
  // General practice: a hospital internship, then practice (before residency was the usual route; see ERA.gpEra).
  S('general', 'General Practice', 'general practitioner', { kind: 'gp', years: 1, play: 'panel', dept: 'family', compete: 0, procedures: ['office_minor', 'ob_delivery'], practice: 'family_clinic', minYear: 1800, maxYear: 1968 }),
  // Integrated surgical residencies (entered straight from medical school, in the US)
  S('ct_integrated', 'Integrated Thoracic Surgery', 'cardiothoracic surgeon', { years: 6, play: 'or', dept: 'cardiothoracic', surgical: true, compete: 0.9, grants: 'ctsurg',
    procedures: ['ct_bypass', 'ct_valve', 'ct_thoracic', 'ct_aorta', 'gs_hernia'], minYear: 2008 }),
  S('vascular_integrated', 'Integrated Vascular Surgery', 'vascular surgeon', { years: 5, play: 'or', dept: 'vascular', surgical: true, compete: 0.7, grants: 'vascular',
    procedures: ['vs_repair'], minYear: 2007 }),
  S('plastic_integrated', 'Integrated Plastic Surgery', 'plastic surgeon', { years: 6, play: 'or', dept: 'plastic', surgical: true, compete: 0.9, grants: 'plastic',
    procedures: ['pl_reconstruction', 'pl_cosmetic', 'office_minor'], practice: 'plastic_clinic', minYear: 1990 }),

  // Fellowships: after a completed residency, never straight from medical school.
  F('cardiology', 'Cardiovascular Disease', 'cardiologist', ['internal'], 3, { play: 'panel', dept: 'cardiology', compete: 0.7, procedures: ['card_cath'], practice: 'cardiology_clinic' }),
  F('gi', 'Gastroenterology', 'gastroenterologist', ['internal'], 3, { play: 'panel', dept: 'medicine', compete: 0.75, procedures: ['gi_endoscopy'] }),
  F('pulm_cc', 'Pulmonary and Critical Care', 'pulmonologist', ['internal'], 3, { play: 'acute', dept: 'icu', compete: 0.5, procedures: ['icu_procedure'] }),
  F('nephrology', 'Nephrology', 'nephrologist', ['internal'], 2, { play: 'panel', dept: 'medicine', compete: 0.25 }),
  F('endocrinology', 'Endocrinology', 'endocrinologist', ['internal'], 2, { play: 'panel', dept: 'medicine', compete: 0.35 }),
  F('heme_onc', 'Hematology and Oncology', 'oncologist', ['internal'], 3, { play: 'panel', dept: 'oncology', compete: 0.6 }),
  F('rheumatology', 'Rheumatology', 'rheumatologist', ['internal'], 2, { play: 'panel', dept: 'medicine', compete: 0.4 }),
  F('infectious', 'Infectious Disease', 'infectious disease physician', ['internal'], 2, { play: 'panel', dept: 'medicine', compete: 0.25 }),
  F('neonatology', 'Neonatal-Perinatal Medicine', 'neonatologist', ['pediatrics'], 3, { play: 'acute', dept: 'nicu', compete: 0.4, procedures: ['icu_procedure'], minYear: 1975 }),
  F('peds_cardiology', 'Pediatric Cardiology', 'pediatric cardiologist', ['pediatrics'], 3, { play: 'panel', dept: 'pediatrics', compete: 0.5 }),
  F('critical_care', 'Critical Care Medicine', 'intensivist', ['anesthesiology', 'emergency', 'internal'], 1, { play: 'acute', dept: 'icu', compete: 0.4, procedures: ['icu_procedure'] }),
  F('pain', 'Pain Medicine', 'pain specialist', ['anesthesiology', 'pmr', 'neurology', 'psychiatry'], 1, { play: 'panel', dept: 'anesthesiology', compete: 0.5, procedures: ['pain_procedure'] }),
  // Forensic fellowships: the work is for death investigations and the courts (engine/investigations/forensicMed.js).
  F('forensic_path', 'Forensic Pathology', 'forensic pathologist', ['pathology'], 1, { play: 'reading', dept: 'pathology', compete: 0.3, forensic: 'examiner' }),
  F('forensic_psych', 'Forensic Psychiatry', 'forensic psychiatrist', ['psychiatry'], 1, { play: 'panel', dept: 'psychiatry', compete: 0.35, forensic: 'evaluator' }),
  F('mfm', 'Maternal-Fetal Medicine', 'maternal-fetal medicine specialist', ['obgyn'], 3, { play: 'panel', dept: 'obgyn', compete: 0.5 }),
  // Surgical fellowships
  F('ctsurg', 'Cardiothoracic Surgery', 'cardiothoracic surgeon', ['gensurg'], 2, { play: 'or', dept: 'cardiothoracic', surgical: true, compete: 0.6,
    procedures: ['ct_bypass', 'ct_valve', 'ct_thoracic', 'ct_aorta'], focus: ['cardiac', 'thoracic'], minYear: 1950 }),
  F('ct_heart_transplant', 'Heart Transplantation', 'heart transplant surgeon', ['ctsurg'], 1, { play: 'or', dept: 'cardiothoracic', surgical: true, compete: 0.6, procedures: ['tx_heart'], minYear: 1985 }),
  F('trauma', 'Trauma and Acute Care Surgery', 'trauma surgeon', ['gensurg'], 2, { play: 'or', dept: 'trauma', surgical: true, compete: 0.45,
    procedures: ['tr_emergency', 'icu_procedure'], minYear: 1970 }),
  F('peds_surgery', 'Pediatric Surgery', 'pediatric surgeon', ['gensurg'], 2, { play: 'or', dept: 'peds_surgery', surgical: true, compete: 0.85, procedures: ['ps_surgery'], minYear: 1950 }),
  F('vascular', 'Vascular Surgery', 'vascular surgeon', ['gensurg'], 2, { play: 'or', dept: 'vascular', surgical: true, compete: 0.5, procedures: ['vs_repair'] }),
  F('transplant', 'Abdominal Transplant Surgery', 'transplant surgeon', ['gensurg', 'urology'], 2, { play: 'or', dept: 'transplant', surgical: true, compete: 0.5,
    procedures: ['tx_kidney', 'tx_liver'], minYear: 1965 }),
  F('colorectal', 'Colon and Rectal Surgery', 'colorectal surgeon', ['gensurg'], 1, { play: 'or', dept: 'surgery', surgical: true, compete: 0.5, procedures: ['gs_colorectal'] }),
  F('surg_onc', 'Complex General Surgical Oncology', 'surgical oncologist', ['gensurg'], 2, { play: 'or', dept: 'oncology', surgical: true, compete: 0.6, procedures: ['so_resection'] }),
  F('plastic', 'Plastic Surgery', 'plastic surgeon', ['gensurg', 'ent', 'ortho', 'urology'], 3, { play: 'or', dept: 'plastic', surgical: true, compete: 0.6,
    procedures: ['pl_reconstruction', 'pl_cosmetic'], practice: 'plastic_clinic' }),
  F('ortho_sports', 'Orthopedic Sports Medicine', 'sports orthopedic surgeon', ['ortho'], 1, { play: 'or', dept: 'orthopedics', surgical: true, compete: 0.6, procedures: ['or_ligament'] }),
  F('hand', 'Hand Surgery', 'hand surgeon', ['ortho', 'plastic', 'plastic_integrated', 'gensurg'], 1, { play: 'or', dept: 'orthopedics', surgical: true, compete: 0.5, procedures: ['or_hand'] }),
  F('spine', 'Spine Surgery', 'spine surgeon', ['ortho', 'neurosurg'], 1, { play: 'or', dept: 'orthopedics', surgical: true, compete: 0.5, procedures: ['ns_spine'] }),
  F('foot_ankle', 'Foot and Ankle Orthopedic Surgery', 'foot and ankle surgeon', ['ortho'], 1, { play: 'or', dept: 'orthopedics', surgical: true, compete: 0.4, procedures: ['or_foot'] }),

  // Podiatry: its own school (DPM) and its own residency, not a branch of the MD/DO route.
  S('podiatry', 'Podiatric Medicine and Surgery', 'podiatrist', { kind: 'podiatry', profession: 'podiatry', years: 3, play: 'panel', dept: 'podiatry', compete: 0.3,
    procedures: ['pod_minor', 'pod_forefoot', 'pod_rearfoot'], practice: 'podiatry_clinic', minYear: 1960, focus: ['diabetic_foot', 'sports', 'reconstructive'] }),
];
export const SPECIALTY_BY_ID = Object.fromEntries(SPECIALTIES.map((s) => [s.id, s]));

/** What a completed integrated residency counts as: an integrated thoracic graduate is a cardiothoracic surgeon. */
export const qualifiesAs = (id) => SPECIALTY_BY_ID[id]?.grants ?? id;

/** Primary residencies a medical graduate can apply to (an integrated one only where and when it exists). */
export const PRIMARY = SPECIALTIES.filter((s) => s.kind === 'residency');
export const FELLOWSHIPS = SPECIALTIES.filter((s) => s.kind === 'fellowship');

// ---------- Procedures ----------
//
// Named the way a hospital's list of privileges names them. `minYear`: broad year it came into
// ordinary practice. `risk`: how much can go wrong (0-1), for the outcome model. `major`: needs an
// operating room, an anesthesia team and consent. A resident takes part only under supervision.
const P = (id, name, minYear, risk, o = {}) => ({ id, name, minYear, risk, major: true, ...o });
export const PROCEDURES = [
  P('office_minor', 'Minor office procedure', 1900, 0.02, { major: false }),
  P('er_procedure', 'Emergency department procedure', 1960, 0.05, { major: false }),
  P('icu_procedure', 'Intensive care procedure', 1960, 0.08, { major: false }),
  P('anes_care', 'Anesthesia care for an operation', 1900, 0.04, { major: false, role: 'anesthesia' }),
  P('image_guided', 'Image-guided procedure', 1975, 0.04, { major: false }),
  P('pain_procedure', 'Pain management procedure', 1980, 0.03, { major: false }),
  P('card_cath', 'Cardiac catheterization', 1960, 0.06, { major: false }),
  P('gi_endoscopy', 'Endoscopy', 1970, 0.03, { major: false }),
  P('derm_biopsy', 'Skin biopsy', 1900, 0.01, { major: false }),
  P('derm_excision', 'Excision of a skin lesion', 1900, 0.02, { major: false }),
  P('gs_abdominal', 'Abdominal operation', 1900, 0.12),
  P('gs_hernia', 'Hernia repair', 1900, 0.05),
  P('gs_colorectal', 'Colorectal operation', 1920, 0.15),
  P('so_resection', 'Cancer resection', 1920, 0.18),
  P('or_fracture', 'Operative fracture repair', 1950, 0.08),
  P('or_arthroscopy', 'Arthroscopic joint procedure', 1975, 0.05),
  P('or_joint', 'Joint replacement', 1970, 0.1),
  P('or_ligament', 'Ligament reconstruction', 1980, 0.07),
  P('or_hand', 'Hand surgery', 1950, 0.06),
  P('or_foot', 'Foot and ankle reconstruction', 1960, 0.08),
  P('ns_cranial', 'Cranial operation', 1920, 0.25),
  P('ns_spine', 'Spine operation', 1930, 0.15),
  P('ct_bypass', 'Coronary artery bypass', 1968, 0.15),
  P('ct_valve', 'Heart valve operation', 1960, 0.18),
  P('ct_thoracic', 'Thoracic (lung) operation', 1940, 0.14),
  P('ct_aorta', 'Aortic operation', 1955, 0.2),
  P('tx_heart', 'Heart transplant', 1983, 0.3),
  P('tx_kidney', 'Kidney transplant', 1960, 0.15),
  P('tx_liver', 'Liver transplant', 1983, 0.25),
  P('tr_emergency', 'Emergency trauma operation', 1960, 0.22),
  P('ps_surgery', 'Pediatric operation', 1945, 0.12),
  P('vs_repair', 'Vascular repair', 1955, 0.16),
  P('pl_reconstruction', 'Reconstructive operation', 1945, 0.08),
  P('pl_cosmetic', 'Elective cosmetic operation', 1960, 0.04),
  P('ob_delivery', 'Attended delivery', 1900, 0.04, { major: false }),
  P('ob_cesarean', 'Cesarean delivery', 1940, 0.08),
  P('gyn_surgery', 'Gynecologic operation', 1920, 0.08),
  // Contraception (engine/health/contraception.js is the patient's side of the same care): office procedures, and the
  // permanent methods. Not every physician holds them: family physicians place implants; IUDs are referred to OB-GYN.
  P('lc_iud', 'IUD placement or removal', 1974, 0.01, { major: false }),
  P('lc_implant', 'Contraceptive implant placement or removal', 1990, 0.005, { major: false }),
  P('tubal', 'Tubal sterilization', 1930, 0.03),
  P('vasectomy', 'Vasectomy', 1925, 0.01, { major: false }),
  P('oph_cataract', 'Cataract operation', 1970, 0.03),
  P('oph_laser', 'Eye laser treatment', 1975, 0.02, { major: false }),
  P('ent_surgery', 'Ear, nose and throat operation', 1920, 0.07),
  P('uro_surgery', 'Urologic operation', 1930, 0.08),
  P('pod_minor', 'Minor foot procedure', 1960, 0.02, { major: false }),
  P('pod_forefoot', 'Forefoot surgery', 1970, 0.06),
  P('pod_rearfoot', 'Rearfoot and ankle reconstruction', 1985, 0.1, { needsFocus: 'reconstructive' }),
];
export const PROCEDURE_BY_ID = Object.fromEntries(PROCEDURES.map((x) => [x.id, x]));

// ---------- Diagnostic tests ----------
// Categories only: what kind of look, never how it is done. minYear: broad era gate.
const T = (id, name, minYear, kind) => ({ id, name, minYear, kind });
export const TESTS = [
  T('history_detail', 'A fuller history', 0, 'talk'),
  T('exam_focused', 'Focused examination', 0, 'exam'),
  T('blood_basic', 'Routine blood tests', 1920, 'lab'),
  T('blood_special', 'Specialized blood tests', 1960, 'lab'),
  T('urine', 'Urine tests', 1900, 'lab'),
  T('culture', 'Cultures', 1900, 'lab'),
  T('troponin', 'Cardiac blood markers', 1995, 'lab'),
  T('ecg', 'Electrocardiogram (ECG)', 1915, 'cardiac'),
  T('echo', 'Echocardiogram', 1975, 'cardiac'),
  T('angiogram', 'Coronary angiogram', 1960, 'cardiac'),
  T('xray', 'X-ray', 1900, 'imaging'),
  T('ultrasound', 'Ultrasound', 1970, 'imaging'),
  T('ct', 'CT scan', 1976, 'imaging'),
  T('mri', 'MRI scan', 1985, 'imaging'),
  T('eeg', 'EEG', 1940, 'neuro'),
  T('biopsy', 'Biopsy', 1900, 'tissue'),
  T('endoscopy', 'Endoscopy', 1970, 'scope'),
  T('screening_tool', 'Structured screening questionnaire', 1960, 'talk'),
  T('developmental', 'Developmental assessment', 1950, 'exam'),
  T('dexa', 'Bone density scan', 1988, 'imaging'),
  T('vascular_doppler', 'Vascular Doppler study', 1975, 'imaging'),
  T('gait', 'Gait and biomechanical assessment', 1950, 'exam'),
];
export const TEST_BY_ID = Object.fromEntries(TESTS.map((t) => [t.id, t]));

// ---------- Hospitals ----------
// Kinds of organization a physician works for. `teaching`: runs residency programs. `depts`: the
// departments it has (an academic center has them all; a rural hospital a few).
export const HOSPITAL_KINDS = {
  academic: { name: 'Academic medical center', teaching: true, fellowships: true, resources: 90, payK: 1.05, depts: 'all' },
  regional: { name: 'Regional hospital', teaching: true, fellowships: false, resources: 75, payK: 1, depts: ['emergency', 'medicine', 'surgery', 'orthopedics', 'pediatrics', 'obgyn', 'psychiatry', 'radiology', 'pathology', 'anesthesiology', 'neurology', 'cardiology', 'icu', 'family', 'trauma', 'oncology', 'urology', 'ent', 'ophthalmology', 'rehabilitation', 'neurosurgery', 'cardiothoracic', 'vascular'] },
  community: { name: 'Community hospital', teaching: false, fellowships: false, resources: 60, payK: 0.97, depts: ['emergency', 'medicine', 'surgery', 'orthopedics', 'pediatrics', 'obgyn', 'radiology', 'anesthesiology', 'family', 'icu', 'psychiatry', 'podiatry'] },
  childrens: { name: "Children's hospital", teaching: true, fellowships: true, resources: 85, payK: 1.02, depts: ['pediatrics', 'peds_surgery', 'nicu', 'emergency', 'radiology', 'anesthesiology', 'psychiatry', 'icu'] },
  rural: { name: 'Rural health facility', teaching: false, fellowships: false, resources: 40, payK: 1.08, depts: ['family', 'emergency', 'medicine', 'obgyn'] },
  government: { name: 'Government hospital', teaching: true, fellowships: false, resources: 70, payK: 0.95, depts: ['emergency', 'medicine', 'surgery', 'orthopedics', 'pediatrics', 'obgyn', 'psychiatry', 'radiology', 'pathology', 'anesthesiology', 'icu', 'family', 'trauma', 'rehabilitation', 'neurology', 'cardiology', 'podiatry'] },
  public_health: { name: 'Public health service', teaching: false, fellowships: false, resources: 45, payK: 0.92, depts: ['family', 'medicine', 'pediatrics', 'psychiatry', 'obgyn'] },
  heart: { name: 'Specialty hospital (heart)', teaching: true, fellowships: true, resources: 92, payK: 1.08, depts: ['cardiology', 'cardiothoracic', 'vascular', 'anesthesiology', 'radiology', 'icu'] },
  bone: { name: 'Specialty hospital (orthopedic)', teaching: true, fellowships: true, resources: 88, payK: 1.06, depts: ['orthopedics', 'rehabilitation', 'podiatry', 'anesthesiology', 'radiology', 'neurosurgery'] },
  clinic: { name: 'Physician group clinic', teaching: false, fellowships: false, resources: 50, payK: 1, depts: ['family', 'medicine', 'pediatrics', 'dermatology', 'psychiatry', 'podiatry', 'cardiology', 'neurology', 'rehabilitation'] },
};

/** The department a specialty works in, as a hospital lists it. */
export const DEPARTMENTS = {
  family: 'Family Medicine', medicine: 'Internal Medicine', pediatrics: 'Pediatrics', emergency: 'Emergency Department', surgery: 'General Surgery',
  orthopedics: 'Orthopedics', neurosurgery: 'Neurosurgery', obgyn: 'Obstetrics and Gynecology', psychiatry: 'Psychiatry', dermatology: 'Dermatology',
  neurology: 'Neurology', anesthesiology: 'Anesthesiology', radiology: 'Radiology', pathology: 'Pathology', ophthalmology: 'Ophthalmology', ent: 'Otolaryngology',
  urology: 'Urology', rehabilitation: 'Physical Medicine and Rehabilitation', cardiothoracic: 'Cardiothoracic Surgery', vascular: 'Vascular Surgery',
  plastic: 'Plastic Surgery', cardiology: 'Cardiology', icu: 'Intensive Care', nicu: 'Neonatal Intensive Care', oncology: 'Oncology', trauma: 'Trauma and Acute Care Surgery',
  peds_surgery: 'Pediatric Surgery', transplant: 'Transplant Surgery', podiatry: 'Podiatry',
};

// ---------- Ranks ----------
// A physician's rank at a hospital. `level`: the matching level of the 'doctor' career (data/careers.js),
// so pay runs through the ordinary payroll. Leadership ranks need openings and selection (engine/medicine/careers.js).
export const RANKS = {
  student: { title: 'Medical student', level: null },
  resident: { title: 'Resident', level: 0 },
  chief_resident: { title: 'Chief resident', level: 0 },
  fellow: { title: 'Fellow', level: 0 },
  attending: { title: 'Attending physician', level: 1 },
  experienced: { title: 'Experienced attending', level: 1 },
  vice_chair: { title: 'Vice chair for education', level: 2, leader: true },
  ceo: { title: 'Hospital chief executive', level: 3, leader: true },
  senior: { title: 'Senior attending', level: 2 },
  director: { title: 'Medical director', level: 2, leader: true },
  chief: { title: 'Chief of service', level: 3, leader: true },
  chair: { title: 'Department chair', level: 3, leader: true },
  cmo: { title: 'Chief medical officer', level: 3, leader: true },
};
/** Residents' titles by year of training (PGY), the US words. */
export const RESIDENT_TITLES = ['Intern', 'Junior resident', 'Resident', 'Senior resident', 'Senior resident', 'Senior resident', 'Senior resident', 'Senior resident'];

// ---------- Private practices ----------
// What a physician-owner can open, and who may open it. `needs`: specialties (any) the owner must be
// qualified in. Figures are game economics (local money is scaled by engine/business.js).
export const PRACTICE_TYPES = {
  family_clinic: { name: 'Family medicine clinic', needs: ['family', 'internal', 'general'], demand: 1, equipment: 40000 },
  internal_clinic: { name: 'Internal medicine practice', needs: ['internal'], demand: 0.95, equipment: 40000 },
  pediatric_clinic: { name: 'Pediatric clinic', needs: ['pediatrics'], demand: 1, equipment: 35000 },
  dermatology_clinic: { name: 'Dermatology clinic', needs: ['dermatology'], demand: 1.15, equipment: 70000 },
  psychiatry_practice: { name: 'Psychiatry practice', needs: ['psychiatry'], demand: 1.05, equipment: 15000 },
  ortho_clinic: { name: 'Orthopedic outpatient clinic', needs: ['ortho', 'ortho_sports', 'hand', 'foot_ankle', 'spine'], demand: 1.1, equipment: 120000 },
  podiatry_clinic: { name: 'Podiatry clinic', needs: ['podiatry'], demand: 1, equipment: 45000 },
  cardiology_clinic: { name: 'Cardiology practice', needs: ['cardiology'], demand: 1.1, equipment: 110000 },
  eye_clinic: { name: 'Eye clinic', needs: ['ophthalmology'], demand: 1.05, equipment: 130000 },
  obgyn_clinic: { name: "Women's health practice", needs: ['obgyn', 'mfm'], demand: 1, equipment: 60000 },
  // A group of physicians in different specialties under one roof: any qualified physician may found one.
  specialty_group: { name: 'Specialty group practice', needs: 'any', demand: 1.05, equipment: 90000 },
  plastic_clinic: { name: 'Plastic and reconstructive surgery practice', needs: ['plastic', 'plastic_integrated'], demand: 1.1, equipment: 120000 },
};

// ---------- Era gates ----------
// Broad eras of medical training and practice (Historical Eras). Before the first year listed, the
// thing does not exist in the game.
export const ERA = {
  residencyMatch: 1952, // a national match for residency places (US); before it, places were offered and accepted directly
  boards: 1930, // specialty board certification becomes usual
  doDegree: 1900, // osteopathic schools exist (full practice rights came state by state, later)
  doFullRights: 1973, // by about here every US state licensed osteopathic physicians to practice fully; before, they trained largely in their own (community) hospitals
  dpmDegree: 1960, // the podiatric medical degree in its modern form
  womenInMedicine: 1870, // medical schools that admit women (some earlier, many later)
  womenWidelyAdmitted: 1920,
  // Before about 1940 most doctors (in the US, and in the game everywhere) did a hospital internship and went into
  // general practice; residency was for the minority who specialized. General practice as its own route lasts until
  // family medicine replaces it (1969, the year Family Medicine's residency begins in data/medicine.js).
  gpEra: 1940, gpUntil: 1969, // by about here most medical schools take women, if often in small numbers
};

/**
 * What a hospital of a given year can do, against today's (1). A broad era modifier, not a history:
 * before antibiotics and blood banking (about 1945) and modern intensive care (about 1960), the same
 * hospital had far less to work with; resources and the margin for error scale with it.
 */
export const ERA_CARE = [[1920, 0.55], [1945, 0.68], [1960, 0.8], [1980, 0.9], [9999, 1]];
export const eraCare = (y) => ERA_CARE.find(([until]) => y < until)[1];

// ---------- Jurisdictions ----------
//
//   entry        'graduate' (a bachelor's first) | 'direct' (medical school from secondary school)
//   schoolYears  years of medical school
//   degrees      what the schools award
//   exams        milestone exams in medical school: { id, name, year }
//   license      the exam or step that completes licensure, and when (after `afterTraining` years of training)
//   internship   years of supervised practice before specialty training (0 in the US, where it is the first residency year)
//   selection    how training places are given out
//   ownership    who may own a medical practice: 'physician' (physician-owned only) | 'open'
//   detail       'detailed' | 'simplified' (shown to the player: a simplified profile is the broad shape, not the rules)
// In the game medical school follows a university degree and lasts four years everywhere (data/schools.js). Where
// the real route is direct entry from school (five or six years), the degree years stand in for the early ones:
// `entry` records the real shape for the player to read; it does not change the game's route.
const SIMPLE = { entry: 'direct', schoolYears: 4, degrees: ['MBBS / MD'], exams: [{ id: 'final', name: 'Final medical examinations', year: 4 }],
  license: { name: 'medical registration', afterTraining: 1 }, internship: 1, selection: 'Specialty training applications', ownership: 'open', detail: 'simplified', dpm: false, osteopathic: false };
export const JURISDICTIONS = {
  us: { entry: 'graduate', schoolYears: 4, degrees: ['MD', 'DO'], osteopathic: true, dpm: true,
    exams: [{ id: 'step1', name: 'USMLE Step 1', year: 2 }, { id: 'step2', name: 'USMLE Step 2 CK', year: 4 }],
    license: { name: 'USMLE Step 3 and a state medical license', afterTraining: 1 }, internship: 0,
    selection: 'the residency Match', ownership: 'physician', detail: 'detailed' },
  ca: { ...SIMPLE, entry: 'graduate', schoolYears: 4, degrees: ['MD'], exams: [{ id: 'mccqe1', name: 'MCCQE Part I', year: 4 }],
    license: { name: 'provincial licensure', afterTraining: 2 }, internship: 0, selection: 'the national residency match', ownership: 'physician' },
  uk: { ...SIMPLE, degrees: ['MBBS / MBChB'], exams: [{ id: 'finals', name: 'Medical finals', year: 4 }],
    license: { name: 'full GMC registration', afterTraining: 1 }, internship: 2, selection: 'specialty training recruitment' },
  au: { ...SIMPLE, entry: 'graduate', schoolYears: 4, degrees: ['MD / MBBS'], exams: [{ id: 'finals', name: 'Final examinations', year: 4 }],
    license: { name: 'general registration', afterTraining: 1 }, internship: 1, selection: 'specialty college selection' },
  // Broad shapes only (marked simplified): how long the supervised years after school last before specialty
  // training, and plain words for registration and selection. No exam names, fees or rules are claimed.
  in: { ...SIMPLE, degrees: ['MBBS'], internship: 1, license: { name: 'medical registration', afterTraining: 1 }, selection: 'postgraduate entrance examinations' },
  ph: { ...SIMPLE, entry: 'graduate', degrees: ['MD'], internship: 1, license: { name: 'the physician licensure examination and registration', afterTraining: 1 }, selection: 'residency applications to hospitals' },
  jp: { ...SIMPLE, degrees: ['MD'], internship: 2, license: { name: 'the national medical licensing examination', afterTraining: 0 }, selection: 'the postgraduate training match' },
  de: { ...SIMPLE, degrees: ['Medical degree (state examination)'], internship: 0, license: { name: 'a full license to practice medicine', afterTraining: 0 }, selection: 'applications to hospitals for specialty training' },
  fr: { ...SIMPLE, degrees: ['Doctor of Medicine'], internship: 0, license: { name: 'registration with the medical council', afterTraining: 0 }, selection: 'the national ranking examination' },
  br: { ...SIMPLE, degrees: ['Medical degree'], internship: 0, license: { name: 'registration with the regional medical council', afterTraining: 0 }, selection: 'residency selection examinations' },
  ng: { ...SIMPLE, degrees: ['MBBS'], internship: 1, license: { name: 'full registration with the medical council', afterTraining: 1 }, selection: 'residency applications to teaching hospitals' },
  kr: { ...SIMPLE, degrees: ['MD'], internship: 1, license: { name: 'the national medical licensing examination', afterTraining: 0 }, selection: 'residency selection at teaching hospitals' },
  mx: { ...SIMPLE, degrees: ['Médico cirujano'], internship: 1, license: { name: 'a professional license', afterTraining: 1 }, selection: 'the national residency examination' },
  za: { ...SIMPLE, degrees: ['MBChB'], internship: 2, license: { name: 'registration with the health professions council', afterTraining: 2 }, selection: 'registrar post applications' },
  ie: { ...SIMPLE, degrees: ['MB BCh BAO'], internship: 1, license: { name: 'registration with the medical council', afterTraining: 1 }, selection: 'specialty training applications' },
  nz: { ...SIMPLE, degrees: ['MBChB'], internship: 2, license: { name: 'registration in a general scope', afterTraining: 1 }, selection: 'specialty college selection' },
  default: SIMPLE,
};
export const jurisdiction = (countryId) => JURISDICTIONS[countryId] ?? JURISDICTIONS.default;

/** Premedical activities (before medical school): what each does for an application. */
export const PREMED = [
  { id: 'volunteer', name: 'Volunteer at a hospital', adds: { service: 1 } },
  { id: 'shadow', name: 'Shadow a physician', adds: { exposure: 1 } },
  { id: 'research', name: 'Join a research project', adds: { research: 1 } },
  { id: 'mentor', name: 'Seek an academic mentor', adds: { letters: 1 } },
  { id: 'science_club', name: 'Join a science club', adds: { exposure: 0.5 } },
  { id: 'study_exam', name: 'Study for the entrance exam', adds: { exam: 1 } },
];

/** Clinical rotations (clerkships) in medical school. Each one shows a different kind of medicine. */
export const ROTATIONS = [
  { id: 'internal', name: 'Internal Medicine', specialty: 'internal', shows: 'complex adult patients and long ward rounds' },
  { id: 'surgery', name: 'Surgery', specialty: 'gensurg', shows: 'the operating room, the team, and the early mornings' },
  { id: 'pediatrics', name: 'Pediatrics', specialty: 'pediatrics', shows: 'children, and the parents who bring them' },
  { id: 'obgyn', name: 'Obstetrics and Gynecology', specialty: 'obgyn', shows: 'pregnancy, deliveries and clinic' },
  { id: 'psychiatry', name: 'Psychiatry', specialty: 'psychiatry', shows: 'listening, and assessments that take time' },
  { id: 'family', name: 'Family Medicine', specialty: 'family', shows: 'whole families, and patients known for years' },
  { id: 'emergency', name: 'Emergency Medicine', specialty: 'emergency', shows: 'what arrives without warning, and deciding who comes first' },
  { id: 'neurology', name: 'Neurology', specialty: 'neurology', shows: 'the nervous system, and careful examinations' },
  { id: 'ortho', name: 'Orthopedics (elective)', specialty: 'ortho', shows: 'bones, joints, sports injuries and rehabilitation' },
  { id: 'radiology', name: 'Radiology (elective)', specialty: 'radiology', shows: 'reading the images every other team asks about' },
];

/** The skills a physician builds (0-100). Reputation is built from them, never from survival counts. */
export const SKILLS = {
  reasoning: 'Clinical judgment', communication: 'Patient communication', teamwork: 'Teamwork', professionalism: 'Professionalism',
  technical: 'Procedural skill', management: 'Case management', research: 'Research', leadership: 'Leadership', integrity: 'Professional integrity',
};
