// Investigative careers: the agencies, their ranks and assignments, the specialties, the
// laboratory disciplines, the case templates and the rules a jurisdiction sets. Read by
// engine/investigations. Everything here is GAMEPLAY CONFIGURATION, simplified on purpose.
//
// Sources. Where a rule is meant to follow a real organization, SOURCES names the page it is
// meant to follow. These pages could not be fetched from the build environment, so no rule here is
// marked verified: each says `verified: false` and is a simplified gameplay rule until checked
// against the page. Nothing here should be read as an agency's actual requirements.

export const SOURCES = {
  fbi: { org: 'Federal Bureau of Investigation', url: 'https://fbijobs.gov/special-agents', jurisdiction: 'us', verified: false, checked: '2026-11-25',
    note: 'Special agent eligibility, the application stages and basic field training, as simplified for the game.' },
  dea: { org: 'Drug Enforcement Administration', url: 'https://www.dea.gov/careers', jurisdiction: 'us', verified: false, checked: '2026-11-25',
    note: 'Special agent hiring and training, as simplified for the game.' },
  atf: { org: 'Bureau of Alcohol, Tobacco, Firearms and Explosives', url: 'https://www.atf.gov/careers/special-agents', jurisdiction: 'us', verified: false, checked: '2026-11-25',
    note: 'Special agent hiring and training, and the bureau\'s areas of responsibility, as simplified for the game.' },
  bls_police: { org: 'US Bureau of Labor Statistics', url: 'https://www.bls.gov/ooh/protective-service/police-and-detectives.htm', jurisdiction: 'us', verified: false, checked: '2026-11-25',
    note: 'How officers are trained and how detectives are usually chosen from experienced officers.' },
  bls_pi: { org: 'US Bureau of Labor Statistics', url: 'https://www.bls.gov/ooh/protective-service/private-detectives-and-investigators.htm', jurisdiction: 'us', verified: false, checked: '2026-11-25',
    note: 'Private investigators: licensing in most states, and the prior experience many bring.' },
  nij: { org: 'National Institute of Justice', url: 'https://nij.ojp.gov/topics/law-enforcement/investigations/crime-scene', jurisdiction: 'us', verified: false, checked: '2026-11-25',
    note: 'Crime scene documentation and evidence handling, at a high level.' },
  doj_discovery: { org: 'US Department of Justice', url: 'https://www.justice.gov/jm/jm-9-5000-issues-related-trials-and-other-court-proceedings', jurisdiction: 'us', verified: false, checked: '2026-11-25',
    note: 'Disclosure of evidence favorable to the defense and of witness credibility (Brady and Giglio), at a high level.' },
};

/** Where the game's jurisdiction support is deep, simplified, or absent. */
export const COVERAGE = {
  us: 'full', // municipal, county and state agencies; FBI, DEA and ATF; private licensing
  default: 'simplified', // one national or regional police service; no federal careers; simplified private licensing
};
export const coverageOf = (countryId) => COVERAGE[countryId] ?? COVERAGE.default;

// ---------- Investigative skills ----------

/** An investigator's skills. Each is separate: someone can read a ledger well and still be new to homicide. */
export const SKILLS = {
  observation: { name: 'Observation' },
  reasoning: { name: 'Critical reasoning' },
  writing: { name: 'Report writing' },
  evidence: { name: 'Evidence interpretation' },
  interviewing: { name: 'Interview communication' },
  management: { name: 'Case management' },
  timeline: { name: 'Timeline reconstruction' },
  law: { name: 'Legal awareness' },
  ethics: { name: 'Professional ethics' },
  teamwork: { name: 'Teamwork' },
  planning: { name: 'Investigative planning' },
  financial: { name: 'Financial analysis', advanced: true },
  digital: { name: 'Digital evidence', advanced: true },
  forensic: { name: 'Forensic collaboration', advanced: true },
  leadership: { name: 'Leadership', advanced: true },
  interagency: { name: 'Interagency cooperation', advanced: true },
};

/** How a reputation is kept: by separate measures, never by how many people were arrested. */
export const REPUTATION = ['integrity', 'skill', 'reports', 'ethics', 'reliability', 'teamwork', 'leadership'];

// ---------- Agencies ----------

/**
 * Kinds of agency. `ladder` is a list of ranks, each mapped to a level of an existing career track
 * (data/occupations.js) so the ordinary payroll pays it. `assignments` are roles held within a rank
 * (a detective in many US departments is an assignment, not a rank above sergeant).
 */
export const AGENCY_KINDS = {
  municipal: { name: 'Police department', career: 'police', powers: 'police', countries: ['us'],
    name_: (city) => `${city} Police Department`, academyMonths: 6, fieldMonths: 6, probationMonths: 12, minAge: 21, maxAge: null,
    education: 'high', source: 'bls_police' },
  county: { name: 'Sheriff\'s office', career: 'police', powers: 'police', countries: ['us'],
    name_: (city) => `${city} County Sheriff's Office`, academyMonths: 6, fieldMonths: 4, probationMonths: 12, minAge: 21, maxAge: null,
    education: 'high', source: 'bls_police', titles: ['Deputy sheriff trainee', 'Probationary deputy', 'Deputy sheriff', 'Senior deputy'] },
  state: { name: 'State police', career: 'police', powers: 'police', countries: ['us'],
    name_: (city, state) => `${state ?? 'State'} State Police`, academyMonths: 7, fieldMonths: 3, probationMonths: 12, minAge: 21, maxAge: 39,
    education: 'high', source: 'bls_police', titles: ['Trooper cadet', 'Probationary trooper', 'Trooper', 'Senior trooper'] },
  national: { name: 'National police', career: 'police', powers: 'police', countries: null,
    name_: (city, _s, country) => `${country} National Police (${city})`, academyMonths: 9, fieldMonths: 6, probationMonths: 12, minAge: 18, maxAge: null,
    education: 'high', simplified: true },
};

/** Ranks on the police side, and the career level each pays at (the 'police' track). */
export const POLICE_RANKS = {
  recruit: { name: 'Recruit', level: 0, order: 0 },
  probationary: { name: 'Probationary officer', level: 0, order: 1 },
  officer: { name: 'Police officer', level: 0, order: 2 },
  senior: { name: 'Senior officer', level: 0, order: 3 },
  sergeant: { name: 'Sergeant', level: 1, order: 4, leader: true, exam: true, years: 4 },
  lieutenant: { name: 'Lieutenant', level: 2, order: 5, leader: true, exam: true, years: 3 },
  captain: { name: 'Captain', level: 2, order: 6, leader: true, years: 3, appointed: true },
  deputy_chief: { name: 'Deputy chief', level: 3, order: 7, leader: true, years: 4, appointed: true },
  chief: { name: 'Chief of police', level: 3, order: 8, leader: true, years: 3, appointed: true, top: true },
};
/** Detective work is an assignment on the 'detective' track, held at an officer's or sergeant's rank. */
export const DETECTIVE_RANKS = {
  detective: { name: 'Detective', level: 0, order: 0 },
  senior_detective: { name: 'Senior detective', level: 0, order: 1, years: 5 },
  detective_sergeant: { name: 'Detective sergeant', level: 1, order: 2, leader: true, exam: true, years: 4 },
  detective_lieutenant: { name: 'Detective lieutenant', level: 2, order: 3, leader: true, years: 4, appointed: true },
};

/** Investigative units a department may have. Small departments have one general unit. */
export const SPECIALTIES = {
  general: { name: 'General investigations', offenses: ['theft', 'burglary', 'criminal_damage', 'fraud', 'assault', 'vehicle_theft'], minDept: 0 },
  homicide: { name: 'Homicide', offenses: ['homicide', 'manslaughter'], minDept: 2, years: 2, high: true },
  robbery: { name: 'Robbery', offenses: ['robbery', 'armed_robbery'], minDept: 1 },
  property: { name: 'Burglary and property crime', offenses: ['burglary', 'theft', 'vehicle_theft', 'criminal_damage'], minDept: 1 },
  missing: { name: 'Missing persons', inquiry: 'missing', minDept: 1 },
  fraud: { name: 'Fraud and financial crime', offenses: ['fraud', 'embezzlement'], minDept: 1, skill: 'financial' },
  cyber: { name: 'Cybercrime', offenses: ['fraud'], minDept: 2, skill: 'digital', tech: 'web', cyber: true },
  organized: { name: 'Organized crime', offenses: ['armed_robbery', 'fraud'], minDept: 2, years: 3 },
  special_victims: { name: 'Special victims', offenses: ['assault'], minDept: 2, sensitive: true },
  family: { name: 'Domestic and family investigations', offenses: ['assault'], minDept: 1, sensitive: true },
  cold: { name: 'Cold cases', cold: true, minDept: 2, years: 3 },
  corruption: { name: 'Public corruption', offenses: ['embezzlement', 'fraud'], minDept: 2, years: 3 },
  major: { name: 'Major crimes', offenses: ['armed_robbery', 'homicide', 'robbery'], minDept: 2, years: 3, high: true },
  juvenile: { name: 'Juvenile investigations', offenses: ['theft', 'criminal_damage', 'assault'], minDept: 1, sensitive: true },
  arson: { name: 'Arson investigation', offenses: ['criminal_damage'], minDept: 2, years: 2 },
  professional_standards: { name: 'Professional standards', oversight: true, minDept: 1, years: 4 },
};
/** Department size: 0 small (general detectives only), 1 mid, 2 large (dedicated divisions). */
export const DEPT_SIZE = (pop) => (pop >= 2 ? 2 : pop >= 1 ? 1 : 0);

// ---------- Federal agencies (the US only) ----------

/**
 * Each agency has its own jurisdiction, hiring, training and ladder. Ages, education and experience are
 * SIMPLIFIED gameplay rules modeled on the source named (not verified: see SOURCES).
 */
export const FEDERAL = {
  fbi: { name: 'Federal Bureau of Investigation', short: 'FBI', career: 'fbi_agent', source: 'fbi', since: 1908,
    office: (city) => `FBI ${city} Field Office`, academy: 'the FBI Academy, Quantico', academyMonths: 5,
    eligibility: { citizen: 'us', minAge: 23, maxAge: 36, degree: 'university', experienceYears: 2, advancedDegreeYears: 1, cleanRecord: true, fitness: 55 },
    jurisdiction: ['violent', 'financial', 'cyber', 'corruption', 'organized', 'civil_rights', 'counterintelligence', 'counterterrorism'],
    stages: ['eligibility', 'application', 'assessment', 'interview', 'background', 'fitness', 'decision'] },
  dea: { name: 'Drug Enforcement Administration', short: 'DEA', career: 'dea_agent', source: 'dea', since: 1973,
    office: (city) => `DEA ${city} Division`, academy: 'the DEA Training Academy, Quantico', academyMonths: 4,
    eligibility: { citizen: 'us', minAge: 21, maxAge: 36, degree: 'university', experienceYears: 0, cleanRecord: true, fitness: 55 },
    jurisdiction: ['drugs'], stages: ['eligibility', 'application', 'assessment', 'interview', 'background', 'fitness', 'decision'] },
  atf: { name: 'Bureau of Alcohol, Tobacco, Firearms and Explosives', short: 'ATF', career: 'atf_agent', source: 'atf', since: 1972,
    office: (city) => `ATF ${city} Field Division`, academy: 'the Federal Law Enforcement Training Centers, Glynco', academyMonths: 6,
    eligibility: { citizen: 'us', minAge: 21, maxAge: 36, degree: 'university', experienceYears: 0, cleanRecord: true, fitness: 55 },
    jurisdiction: ['firearms', 'explosives', 'arson'], stages: ['eligibility', 'application', 'assessment', 'interview', 'background', 'fitness', 'decision'] },
};
/** Federal ranks, each mapped to a level of the agency's career track. No police titles here. */
export const FEDERAL_RANKS = {
  trainee: { name: 'Special agent trainee', level: 0, order: 0 },
  agent: { name: 'Special agent', level: 0, order: 1 },
  senior_agent: { name: 'Senior special agent', level: 1, order: 2, years: 5 },
  supervisory: { name: 'Supervisory special agent', level: 2, order: 3, leader: true, years: 4, appointed: true },
  asac: { name: 'Assistant special agent in charge', level: 3, order: 4, leader: true, years: 4, appointed: true },
  sac: { name: 'Special agent in charge', level: 3, order: 5, leader: true, years: 4, appointed: true, top: true },
};
/** Majors that federal agencies value, as one kind of qualifying background among others. */
export const FEDERAL_BACKGROUNDS = {
  accounting: ['accounting', 'finance', 'economics', 'business'],
  technology: ['computer_science', 'cybersecurity', 'engineering', 'mathematics'],
  law: ['law'],
  languages: ['languages', 'linguistics'],
  science: ['chemistry', 'biology', 'forensic_science', 'physics'],
};

// ---------- Private investigation ----------

/** Licensing, simplified: in the US most states license private investigators; elsewhere a simplified rule. */
export const PI_LICENSE = {
  us: { name: 'private investigator license', fee: 300, experienceYears: 3, minAge: 21, exam: true, source: 'bls_pi' },
  default: { name: 'private investigation license', fee: 250, experienceYears: 2, minAge: 21, exam: true, simplified: true },
};
/** Experience that counts toward a license: years in these careers. */
export const PI_EXPERIENCE = ['police', 'detective', 'pi', 'fbi_agent', 'dea_agent', 'atf_agent', 'intelligence', 'lawyer', 'prosecutor', 'defender', 'corrections', 'insurance_adjuster'];
/** What a private agency offers, what a client pays, and the hours it takes. */
export const PI_SERVICES = {
  missing: { name: 'Missing person inquiries', fee: 2500, months: 3 },
  background: { name: 'Background inquiries (where permitted)', fee: 900, months: 1 },
  litigation: { name: 'Civil litigation support', fee: 3500, months: 4 },
  insurance: { name: 'Insurance investigations', fee: 2000, months: 2 },
  business: { name: 'Business inquiries', fee: 3000, months: 3 },
};

// ---------- Laboratories ----------

/**
 * What a laboratory can examine, and from when. A discipline that did not exist in a year is not
 * offered (the year, and the Digital World's technology registry for digital work).
 * months: turnaround. conclusive: how often a usable result comes back.
 */
export const LAB = {
  fingerprints: { name: 'Fingerprint examination', from: 1905, months: 2, conclusive: 0.6, evidence: 'forensic', kinds: ['physical'] },
  documents: { name: 'Document examination', from: 1910, months: 2, conclusive: 0.65, evidence: 'documents', kinds: ['documents'] },
  toxicology: { name: 'Toxicology', from: 1920, months: 3, conclusive: 0.7, evidence: 'forensic', kinds: ['physical'], death: true },
  trace: { name: 'Trace evidence', from: 1930, months: 3, conclusive: 0.45, evidence: 'forensic', kinds: ['physical'] },
  dna: { name: 'DNA analysis', from: 1987, months: 4, conclusive: 0.55, evidence: 'forensic', kinds: ['physical'] },
  digital: { name: 'Digital forensics', from: 1995, tech: 'pc', months: 3, conclusive: 0.6, evidence: 'digital', kinds: ['digital'] },
  video: { name: 'Video enhancement', from: 1995, months: 1, conclusive: 0.5, evidence: 'cctv', kinds: ['cctv'] },
  financial: { name: 'Forensic accounting', from: 1950, months: 4, conclusive: 0.7, evidence: 'financial', kinds: ['financial', 'documents'] },
  fire: { name: 'Fire investigation analysis', from: 1950, months: 3, conclusive: 0.5, evidence: 'physical', kinds: ['physical'] },
};
/** What a result can say. Never "guilty": a lab reports on evidence, not on people. */
export const LAB_RESULTS = {
  consistent: 'Consistent with the working hypothesis',
  inconsistent: 'Inconsistent with the working hypothesis',
  inconclusive: 'Inconclusive',
  unable: 'Unable to evaluate (the sample was not suitable)',
  more: 'Requires additional analysis',
};

// ---------- Case templates ----------

/**
 * Case templates. Each makes a real incident (engine/cases.js) with facts set when it is made:
 * the scene, the timeline, who saw what, and which explanations are open. Nothing is added later
 * except by the investigation's own steps. `hypotheses` are the explanations an investigator would
 * weigh; which one is true is the incident's, never shown.
 */
export const TEMPLATES = {
  burglary: { name: 'Burglary', offenseId: 'burglary', specialty: 'property', complexity: 1, place: 'business',
    title: (place) => `The ${place} Burglary`, scene: 'A rear door was forced overnight and equipment is missing.',
    hypotheses: ['outsider', 'insider', 'misreport'], evidence: ['physical', 'cctv', 'witness'], months: 6 },
  robbery: { name: 'Robbery', offenseId: 'robbery', specialty: 'robbery', complexity: 2, place: 'street',
    title: (place) => `The ${place} Robbery`, scene: 'A person was robbed in the street in the evening; their bag was taken.',
    hypotheses: ['stranger', 'known', 'misreport'], evidence: ['victim', 'cctv', 'witness'], months: 6 },
  homicide: { name: 'Suspected homicide', offenseId: 'homicide', specialty: 'homicide', complexity: 3, place: 'home', death: true, minRank: 'senior_detective',
    title: (place) => `The death on ${place}`, scene: 'A person was found dead at home. The circumstances are unclear and the death is being treated as suspicious.',
    hypotheses: ['known', 'stranger', 'not_homicide'], evidence: ['physical', 'witness', 'digital'], months: 12 },
  missing: { name: 'Missing person', inquiry: 'missing', specialty: 'missing', complexity: 2, place: 'home',
    title: (place, who) => `${who}, missing from ${place}`, scene: 'An adult has not been seen for three days. Their family reported it.',
    hypotheses: ['voluntary', 'accident', 'harm'], evidence: ['witness', 'digital', 'financial'], months: 6 },
  fraud: { name: 'Financial fraud', offenseId: 'fraud', specialty: 'fraud', complexity: 2, place: 'business',
    title: (place) => `Accounts at ${place}`, scene: 'A company reports money missing from its accounts. Its bookkeeping is in disorder.',
    hypotheses: ['insider', 'error', 'outsider'], evidence: ['financial', 'documents', 'witness'], months: 9 },
  cyber: { name: 'Online fraud', offenseId: 'fraud', specialty: 'cyber', complexity: 2, place: 'online', tech: 'web', cyber: true,
    title: (place) => `The ${place} account takeover`, scene: 'Customers of a small online shop report money taken through their accounts.',
    hypotheses: ['outsider', 'insider', 'error'], evidence: ['digital', 'financial', 'documents'], months: 9 },
};

/** What each hypothesis says, in the file. */
export const HYPOTHESES = {
  outsider: 'Someone from outside got in without permission.',
  insider: 'Someone with authorized access was responsible.',
  misreport: 'The report itself is mistaken: nothing was taken the way it seems.',
  stranger: 'A stranger did it.',
  known: 'Someone who knew the victim did it.',
  not_homicide: 'The death was not caused by anyone else.',
  voluntary: 'They left of their own accord.',
  accident: 'They have come to harm by accident.',
  harm: 'Someone has harmed them.',
  error: 'It is an error, not a crime: the money was moved, not taken.',
};

/** Questions for a witness. None of them is a trick, and none is forceful. */
export const WITNESS_QUESTIONS = {
  timeline: { label: 'Ask about the timeline', sub: 'When, in what order, how long.' },
  observed: { label: 'Ask what they observed', sub: 'Only what they saw or heard themselves.' },
  uncertainty: { label: 'Ask how sure they are', sub: 'Light, distance, how long they looked.' },
  inconsistency: { label: 'Clarify an inconsistency', sub: 'Something that does not match another account.' },
  more: { label: 'Ask if there is anything else', sub: 'People remember more when they are not rushed.' },
  press: { label: 'Press them hard for a name', sub: 'Leading and forceful. It may get an answer, not the truth.', improper: true },
};

/** Who may see what in a case: the access each role has, enforced in engine/investigations/views.js. */
export const ACCESS = {
  investigator: ['overview', 'timeline', 'people', 'leads', 'evidence', 'statements', 'actions', 'lab', 'legal', 'progress', 'court', 'report'],
  forensic: ['overview', 'lab'],
  prosecutor: ['overview', 'timeline', 'people', 'evidence', 'statements', 'lab', 'legal', 'court', 'report', 'disclosure'],
  defense: ['overview', 'evidence_disclosed', 'statements_disclosed', 'lab_disclosed', 'court'],
  judge: ['overview', 'evidence_submitted', 'court'],
  journalist: ['public'],
  archive: ['public'],
};

// ---------- Places for case titles ----------

export const STREETS = ['Ashford Street', 'Mill Lane', 'Harbor Road', 'Elm Avenue', 'Station Road', 'Linden Court', 'Quarry Hill', 'Orchard Way', 'Canal Street', 'Bellmont Drive'];
export const SHOPS = ['Ashford Street', 'Holloway Hardware', 'Brightwater Electronics', 'Corner Print Shop', 'Riverside Pharmacy', 'Old Town Bicycles'];
