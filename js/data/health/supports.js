// Support needs, assistive technology, accommodations and home accessibility.
//
// The model follows the WHO International Classification of Functioning,
// Disability and Health (ICF): a person's condition, what they need, the
// devices they choose, and the barriers in their surroundings are separate
// things. Removing a barrier changes what someone can take part in; it does
// not change the person or their condition.
//
// A support need can be recorded with no diagnosis behind it at all.

/** settings: where the need shows up. barrier: how much an unmet need gets in the way there (game tuning, 0–1). */
export const NEEDS = {
  step_free: { name: 'Step-free access', settings: { school: 0.6, work: 0.6, home: 0.8, transport: 0.6 }, meets: ['ramp', 'step_free_entry', 'lift'] },
  wheelchair: { name: 'Wheelchair', settings: { school: 0.3, work: 0.3, home: 0.4, transport: 0.4 }, device: true, meets: ['wheelchair', 'power_chair'] },
  prosthesis: { name: 'Prosthetic or adapted equipment', settings: { work: 0.2, home: 0.2 }, device: true, meets: ['prosthesis', 'adapted_tools'], optional: true },
  sign_language: { name: 'Sign language', settings: { school: 0.7, work: 0.5, transport: 0.1 }, meets: ['interpreter', 'signing_school'] },
  captions: { name: 'Captions and written information', settings: { school: 0.4, work: 0.3 }, meets: ['captions'] },
  visual_alerts: { name: 'Visual alerts', settings: { home: 0.3, work: 0.2 }, meets: ['visual_alerts'] },
  hearing_aid: { name: 'Hearing technology', settings: { school: 0.3, work: 0.3 }, device: true, meets: ['hearing_aid', 'cochlear_implant', 'captions'], optional: true },
  screen_reader: { name: 'Screen reader', settings: { school: 0.6, work: 0.6 }, device: true, meets: ['screen_reader'] },
  braille: { name: 'Braille', settings: { school: 0.4 }, meets: ['braille_display', 'accessible_materials'] },
  cane: { name: 'Long cane or guide dog', settings: { transport: 0.5 }, device: true, meets: ['white_cane', 'guide_dog'], optional: true },
  magnifier: { name: 'Magnification', settings: { school: 0.3, work: 0.3 }, device: true, meets: ['magnifier', 'screen_reader'] },
  accessible_materials: { name: 'Accessible materials', settings: { school: 0.5, work: 0.3 }, meets: ['accessible_materials'] },
  reading_tools: { name: 'Reading tools', settings: { school: 0.4, work: 0.2 }, meets: ['text_to_speech', 'accessible_materials'] },
  calculator: { name: 'A calculator and number aids', settings: { school: 0.35, work: 0.1 }, meets: ['calculator_use'] },
  typing: { name: 'Typing instead of handwriting', settings: { school: 0.35 }, meets: ['laptop_use'] },
  extra_time: { name: 'Extra time', settings: { school: 0.35, work: 0.1 }, meets: ['extra_time'] },
  organization: { name: 'Organization support', settings: { school: 0.35, work: 0.3 }, meets: ['planner_tools', 'check_ins', 'flexible_deadlines'] },
  quiet_space: { name: 'A quiet place to work', settings: { school: 0.25, work: 0.25 }, meets: ['quiet_room', 'remote_work'] },
  sensory: { name: 'Sensory adjustments', settings: { school: 0.35, work: 0.3, transport: 0.2 }, meets: ['ear_defenders', 'quiet_room', 'remote_work'] },
  clear_communication: { name: 'Clear, direct communication', settings: { school: 0.3, work: 0.3 }, meets: ['written_instructions'] },
  routine: { name: 'Predictable routines', settings: { school: 0.25, work: 0.2 }, meets: ['advance_notice'] },
  understanding: { name: 'People who understand', settings: { school: 0.15, work: 0.15 }, meets: ['staff_briefing'] },
  flexible_hours: { name: 'Flexible hours', settings: { work: 0.3, school: 0.15 }, meets: ['flexible_hours', 'remote_work'] },
  learning_support: { name: 'Learning support', settings: { school: 0.5, work: 0.3 }, meets: ['learning_assistant', 'job_coach'] },
  supported_living: { name: 'Support at home', settings: { home: 0.4 }, meets: ['support_worker'] },
  adapted_furniture: { name: 'Adapted furniture and fittings', settings: { home: 0.3, work: 0.2 }, meets: ['adapted_furniture'] },
};

/**
 * Devices a person owns. Preference matters: nobody is made to use one.
 * from: when it was available. cost in base units (before cover).
 */
export const DEVICES = {
  wheelchair: { name: 'Manual wheelchair', cost: 900, from: 1800, kind: 'mobility' },
  power_chair: { name: 'Powered wheelchair', cost: 6500, from: 1956, kind: 'mobility' },
  walker: { name: 'Walker', cost: 120, from: 1950, kind: 'mobility' },
  cane_walking: { name: 'Walking stick', cost: 30, from: 1800, kind: 'mobility' },
  prosthesis: { name: 'Prosthesis', cost: 8000, from: 1800, kind: 'mobility' },
  adapted_tools: { name: 'Adapted tools', cost: 300, from: 1900, kind: 'mobility' },
  glasses: { name: 'Glasses', cost: 150, from: 1800, kind: 'vision' },
  white_cane: { name: 'Long white cane', cost: 50, from: 1930, kind: 'vision' },
  guide_dog: { name: 'Guide dog', cost: 0, from: 1931, kind: 'vision' },
  screen_reader: { name: 'Screen reader', cost: 0, from: 1986, kind: 'vision' },
  braille_display: { name: 'Refreshable braille display', cost: 2500, from: 1975, kind: 'vision' },
  magnifier: { name: 'Magnifier', cost: 80, from: 1800, kind: 'vision' },
  hearing_aid: { name: 'Hearing aids', cost: 2000, from: 1952, kind: 'hearing' },
  cochlear_implant: { name: 'Cochlear implant', cost: 40000, from: 1984, kind: 'hearing', surgery: true },
  visual_alerts: { name: 'Visual alert system', cost: 250, from: 1975, kind: 'hearing' },
  text_to_speech: { name: 'Text-to-speech software', cost: 0, from: 1990, kind: 'cognitive' },
  planner_tools: { name: 'Planner and reminder apps', cost: 0, from: 2008, kind: 'cognitive' },
  ear_defenders: { name: 'Noise-canceling headphones', cost: 200, from: 1989, kind: 'sensory' },
  calculator_use: { name: 'Calculator', cost: 15, from: 1972, kind: 'cognitive' },
  laptop_use: { name: 'Laptop for writing', cost: 600, from: 1985, kind: 'cognitive' },
  communication_aid: { name: 'Communication aid', cost: 1500, from: 1980, kind: 'communication' },
};

/** Accommodations a school, college or employer can put in place. setting: where they apply. */
export const ACCOMMODATIONS = {
  extra_time: { name: 'Extra time in exams', settings: ['school'], from: 1975 },
  accessible_materials: { name: 'Accessible materials', settings: ['school', 'work'], from: 1975 },
  interpreter: { name: 'Sign language interpreter', settings: ['school', 'work'], from: 1964 },
  signing_school: { name: 'A school that teaches in sign language', settings: ['school'], from: 1800 },
  captions: { name: 'Captioning', settings: ['school', 'work'], from: 1980 },
  quiet_room: { name: 'A quiet room', settings: ['school', 'work'], from: 1975 },
  flexible_deadlines: { name: 'Flexible deadlines', settings: ['school', 'work'], from: 1975 },
  check_ins: { name: 'Regular check-ins', settings: ['school', 'work'], from: 1975 },
  written_instructions: { name: 'Instructions in writing', settings: ['school', 'work'], from: 1975 },
  advance_notice: { name: 'Advance notice of changes', settings: ['school', 'work'], from: 1975 },
  staff_briefing: { name: 'Staff who have been briefed', settings: ['school', 'work'], from: 1975 },
  learning_assistant: { name: 'A learning support assistant', settings: ['school'], from: 1975 },
  job_coach: { name: 'A job coach', settings: ['work'], from: 1985 },
  flexible_hours: { name: 'Flexible hours', settings: ['work'], from: 1970 },
  remote_work: { name: 'Working from home', settings: ['work'], from: 1995 },
  step_free_entry: { name: 'Step-free entrance', settings: ['school', 'work'], from: 1970 },
  lift: { name: 'Lift access', settings: ['school', 'work'], from: 1900 },
};

/** Home adaptations, with what they cost in base units. They are recorded on the home itself. */
export const HOME_FEATURES = {
  ramp: { name: 'A ramp to the door', cost: 2500, meets: ['step_free'] },
  step_free_entry: { name: 'A level entrance', cost: 6000, meets: ['step_free'] },
  wide_doors: { name: 'Wider doorways', cost: 4000, meets: ['wheelchair'] },
  accessible_bathroom: { name: 'An accessible bathroom', cost: 9000, meets: ['wheelchair', 'step_free'] },
  lift: { name: 'A stairlift or home lift', cost: 12000, meets: ['step_free'] },
  visual_alerts: { name: 'Doorbell and alarm lights', cost: 400, meets: ['visual_alerts'] },
  adapted_furniture: { name: 'Adapted kitchen and fittings', cost: 5000, meets: ['adapted_furniture'] },
  smart_home: { name: 'Voice-controlled lights and locks', cost: 1200, meets: ['step_free'], from: 2014, partial: true },
};
/** What a home needs for someone who uses a wheelchair to live there comfortably. */
export const WHEELCHAIR_HOME = ['step_free', 'wheelchair'];

/** Disability law that requires reasonable adjustments, by year (where the country has data). */
export const ACCESS_LAW = { us: 1990, uk: 1995, au: 1992, ca: 1985, ie: 2005, nz: 1993, de: 2002, fr: 2005, se: 1999, no: 2008, nl: 2003, es: 2003, it: 2006, jp: 2016, kr: 2008, in: 2016, br: 2015, za: 1998, mx: 2011 };
/** Where nothing is recorded: the UN Convention on the Rights of Persons with Disabilities came into force in 2008. */
export const ACCESS_LAW_DEFAULT = 2008;
