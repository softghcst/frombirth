// The kinds of university a country has. Every institution in the game is
// invented: a country's are made from these patterns the first time they are
// needed, named for its own cities, and then kept (engine/university.js).
// Nothing here describes a real university, its fees or its admissions.
//
//   bar          the school mark (0–4) its entrants usually have
//   squeeze      how far demand outruns places: good applicants are turned away there
//   auditionBar  what it takes on the day, for courses entered by audition
//   tuitionMult  multiplies the country's base university tuition
//   living       multiplies the cost of living away from home there
//   merit        the most it waives for outstanding applicants (share of tuition)
//   needAid      the most it waives for those who could not otherwise come
//   strong       subjects it is known for (teaching there is better)
//   only         it teaches nothing but the subjects it is known for
//   perk         'network' an alumni contact at graduation · 'home' cheap and near family · 'mentor' a professor from day one
//   names        patterns: {city} a city of the country, {place} an invented place, {country} the country
//   private      charges fees even where the state funds university (a conservatory is not the state's)
//   rigor        how much an audition-entered course there is decided on the day: widens the luck in the room
export const UNIVERSITY_KINDS = [
  { id: 'ancient', label: 'Old and very selective', squeeze: 0.4, bar: 3.4, auditionBar: 74, tuitionMult: 1.9, living: 1.25, merit: 0.5, needAid: 1, legacy: true, contextual: true, perk: 'network', rep: 96,
    names: ['{place} University', 'University of {place}'],
    strong: ['engineering', 'mathematics', 'computer_science', 'finance', 'chemistry', 'biology', 'political_science', 'history', 'english'],
    blurb: 'Centuries old, famous everywhere, and very hard to get into. Generous to those who cannot pay; little for anyone else.' },
  { id: 'research', label: 'Major public university', bar: 2.9, auditionBar: 66, tuitionMult: 1.15, living: 1.1, merit: 0.5, needAid: 0.6, sport: true, contextual: true, perk: 'network', rep: 80,
    names: ['University of {city}', '{city} University'],
    strong: ['engineering', 'computer_science', 'biology', 'chemistry', 'business', 'psychology', 'political_science'],
    blurb: 'Huge, well regarded, and good at almost everything. Big lectures, big sports teams.' },
  { id: 'technical', label: 'Technical institute', squeeze: 0.1, bar: 3.0, auditionBar: 99, tuitionMult: 1.2, living: 1.1, merit: 0.75, needAid: 0.5, perk: 'network', rep: 84,
    names: ['{place} Institute of Technology', '{city} Technical University'],
    strong: ['engineering', 'mathematics', 'computer_science', 'chemistry'],
    blurb: 'Laboratories, workshops and long hours. Employers come to it.' },
  { id: 'regional', label: 'Regional university', lenient: 0.6, bar: 1.8, auditionBar: 55, tuitionMult: 0.7, living: 0.9, merit: 1, needAid: 0.7, sport: true, perk: 'home', rep: 55,
    names: ['{city} Metropolitan University', '{city} City University'],
    strong: ['nursing', 'education', 'business', 'criminal_justice', 'psychology', 'communications'],
    blurb: 'Where most of the city\'s nurses, teachers and accountants trained. You can live at home and keep your job.' },
  { id: 'college', label: 'Small college', bar: 2.6, auditionBar: 62, tuitionMult: 1.3, living: 1, merit: 1, needAid: 0.8, contextual: true, perk: 'mentor', rep: 70,
    names: ['{place} College', '{saint} College'],
    strong: ['art', 'music', 'theater', 'english', 'history', 'journalism', 'psychology'],
    blurb: 'A few thousand students, small classes, and teachers who know your name.' },
  { id: 'conservatoire', label: 'Conservatoire', only: true, private: true, squeeze: 0.1, bar: 2.0, auditionBar: 78, tuitionMult: 2.0, living: 1.2, merit: 0.5, needAid: 0.6, arts: true, perk: 'mentor', rep: 82,
    names: ['{city} Conservatoire', 'The {place} Academy of Performing Arts'],
    strong: ['music', 'theater', 'musical_theater', 'musical_theater_bfa', 'art'],
    blurb: 'For performers and artists. Everyone was the best in their school; here they are ordinary.' },
  // Musical theater BFAs: studio all day, shows at night, a panel that sees hundreds for every few places. Most who get
  // in were turned away at least once somewhere. Dearer than any ordinary degree, and the hardest rooms in the game.
  { id: 'mt_elite', label: 'Elite musical theater conservatory', only: true, private: true, squeeze: 0.3, bar: 2.6, auditionBar: 86, tuitionMult: 3.4, living: 1.45, merit: 0.3, needAid: 0.45, arts: true, rigor: 1, perk: 'network', rep: 95,
    names: ['The {place} Conservatory of Musical Theater', '{city} School of Musical Theater'],
    strong: ['musical_theater_bfa', 'musical_theater', 'theater'],
    blurb: 'Famous names came out of its studios. It takes a handful from hundreds, and most of those auditioned before.' },
  { id: 'mt_conservatory', label: 'Musical theater BFA conservatory', only: true, private: true, squeeze: 0.2, bar: 2.4, auditionBar: 82, tuitionMult: 2.6, living: 1.3, merit: 0.4, needAid: 0.5, arts: true, rigor: 1, perk: 'mentor', rep: 84,
    names: ['{city} Conservatory of Performing Arts', 'The {place} School of Performing Arts'],
    strong: ['musical_theater_bfa', 'musical_theater', 'theater', 'music'],
    blurb: 'A serious musical theater BFA: dance every morning, scenes every afternoon. Competitive, and costly.' },
  { id: 'university_bfa', label: 'University with a musical theater BFA', squeeze: 0.12, bar: 2.9, auditionBar: 76, tuitionMult: 2.1, living: 1.15, merit: 0.5, needAid: 0.6, contextual: true, arts: true, rigor: 0.8, perk: 'mentor', rep: 76,
    names: ['{city} University School of Drama', '{saint} College School of the Arts'],
    strong: ['musical_theater_bfa', 'musical_theater', 'theater', 'music', 'art', 'english'],
    blurb: 'A university with a conservatory-style BFA inside it. You need the marks and the audition both.' },
  { id: 'open', label: 'Open university', bar: 0, auditionBar: 99, open: true, tuitionMult: 0.45, living: 0, merit: 0, needAid: 0.5, perk: 'home', rep: 45,
    names: ['The {place} Open University'],
    strong: ['business', 'education', 'psychology', 'communications'],
    blurb: 'Takes anyone, of any age, from anywhere, and fits around a job. Nobody will hold your hand.' },
];
export const UNIVERSITY_KIND_BY_ID = Object.fromEntries(UNIVERSITY_KINDS.map((k) => [k.id, k]));

export const UNI_PLACES = ['Ashcombe', 'Marlowe', 'Wexcombe', 'Harrowgate', 'Calder', 'Thornley', 'Aldermoor', 'Penhallow', 'Ravensworth', 'Lindisholm'];
export const UNI_SAINTS = ['St Osric\'s', 'St Hild\'s', 'Trinity', 'All Hallows', 'St Aubyn\'s'];

/** The most places one round of applications can go to. Audition courses are applied to more widely: nobody counts on one room. */
export const MAX_APPLICATIONS = 5;
export const MAX_APPLICATIONS_AUDITION = 8;
/** The most places that can be set side by side. */
export const MAX_COMPARE = 4;

/**
 * The musical theater BFA programs added to a country's universities, by kind. Countries with a deep performing arts
 * tradition have several; everywhere else has one conservatory and, perhaps, a university with a program.
 */
export const BFA_PLANS = {
  us: ['mt_elite', 'mt_elite', 'mt_elite', 'mt_conservatory', 'mt_conservatory', 'mt_conservatory', 'university_bfa', 'university_bfa', 'university_bfa', 'university_bfa'],
  gb: ['mt_elite', 'mt_elite', 'mt_conservatory', 'mt_conservatory', 'university_bfa'],
  ca: ['mt_elite', 'mt_conservatory', 'university_bfa', 'university_bfa'],
  au: ['mt_elite', 'mt_conservatory', 'university_bfa'],
  ie: ['mt_conservatory', 'university_bfa'], nz: ['mt_conservatory', 'university_bfa'], kr: ['mt_elite', 'mt_conservatory', 'university_bfa'],
  jp: ['mt_conservatory', 'university_bfa'], de: ['mt_conservatory', 'university_bfa'], fr: ['mt_conservatory'],
};
export const BFA_DEFAULT = ['mt_conservatory'];

/** Coaching for an audition: a year of lessons with someone who has sat on the panel. Once a year; it adds up, to a point. */
export const AUDITION_COACHING = { cost: 2400, points: 6, cap: 18, blurb: 'A year of private coaching in your pieces, your movement and the room: worth a few points on the day.' };

/** How a personal statement can be written. `needs`: what makes the risky ones come off. */
export const STATEMENTS = [
  { id: 'honest', name: 'Write plainly about why you want this', sub: 'Safe. It reads as it is.', value: 1 },
  { id: 'story', name: 'Tell the story of something hard', sub: 'Remembered if it is well told. Awkward if it is not.', risky: true },
  { id: 'polish', name: 'Have it polished until it gleams', sub: 'Smooth, impressive, and like a thousand others.', value: 0 },
];

/** Credits a full degree takes. A two-year college course takes half. */
export const DEGREE_CREDITS = 120;
/** How much to take on in a year: the credits attempted, and what it does to marks. */
export const LOADS = [
  { id: 'light', name: 'A light load', credits: 24, mark: 0.2, blurb: 'Fewer courses, better marks, more time for everything else. The degree takes longer.' },
  { id: 'standard', name: 'A standard load', credits: 30, mark: 0, blurb: 'What the timetable expects.' },
  { id: 'part', name: 'Part-time', credits: 20, mark: 0.05, blurb: 'Evenings and weekends, alongside a job. The degree takes six years.' },
  { id: 'heavy', name: 'A heavy load', credits: 40, mark: -0.25, blurb: 'Extra courses. Marks suffer, but it makes up lost ground or finishes early.' },
];
/** Families of subjects: moving within one keeps every credit; moving between them loses a year's worth. */
export const MAJOR_GROUP = { engineering: 'stem', mathematics: 'stem', computer_science: 'stem', chemistry: 'stem', biology: 'stem', nursing: 'health', psychology: 'social',
  political_science: 'social', history: 'humanities', english: 'humanities', journalism: 'humanities', communications: 'humanities', criminal_justice: 'social', education: 'social',
  finance: 'business', business: 'business', art: 'arts', music: 'arts', theater: 'arts', musical_theater: 'arts', musical_theater_bfa: 'arts' };

/**
 * Student organizations. factor: what makes someone good at it. mark: what
 * it does to the year's marks. polExp: political experience a year.
 * only: countries where such a thing exists.
 */
export const ORGS = [
  { id: 'union', name: 'Students\' union', leader: 'President', factor: 'stats.charm', polExp: 1, blurb: 'Elections, motions, and arguments about the bar prices. Where politicians start.' },
  { id: 'society', name: 'Subject society', leader: 'Chair', factor: 'stats.intellect', mark: 0.06, blurb: 'Talks, a journal, and people who love what you are studying.' },
  { id: 'sports', name: 'University sports club', leader: 'Captain', factor: 'talents.sports', yearly: { stats: { health: 2 }, talents: { sports: 2 } }, blurb: 'Training twice a week and a fixture on Wednesdays.' },
  { id: 'drama', name: 'Drama society', leader: 'President', factor: 'talents.acting', stage: true, blurb: 'Three shows a year, cast by audition.' },
  { id: 'paper', name: 'Student newspaper', leader: 'Editor', factor: 'stats.intellect', yearly: { hidden: { discipline: 1 } }, blurb: 'Deadlines, libel worries, and your name in print.' },
  { id: 'debate', name: 'Debating union', leader: 'President', factor: 'stats.charm', polExp: 1, yearly: { stats: { charm: 1 } }, blurb: 'Formal wear and informal cruelty.' },
  { id: 'politics', name: 'Party student branch', leader: 'Chair', factor: 'stats.charm', polExp: 2, needsParty: true, blurb: 'Leaflets, canvassing, and meeting the people who will one day select candidates.' },
  { id: 'volunteers', name: 'Volunteering society', leader: 'Coordinator', factor: 'hidden.karma', yearly: { hidden: { karma: 3 } }, blurb: 'Tutoring, food banks, and a minibus that mostly starts.' },
  { id: 'music', name: 'Orchestra and choir', leader: 'Leader', factor: 'talents.music', yearly: { talents: { music: 2, singing: 1 } }, blurb: 'Rehearsals on Tuesdays, a concert every term.' },
  { id: 'hackathon', name: 'Hackathon club', leader: 'President', factor: 'skills.coding', yearly: { skills: { coding: 4, math: 1 } },
    contest: { name: 'hackathon', paths: { 'skills.coding': 0.6, 'stats.intellect': 0.4 } }, blurb: 'Twenty-four hours, a lot of pizza, and an app that almost works by the demo.' },
  { id: 'engineering_team', name: 'Engineering team', leader: 'Team lead', factor: 'skills.robotics', yearly: { skills: { robotics: 4, math: 2, coding: 1 } },
    contest: { name: 'intercollegiate engineering challenge', paths: { 'skills.robotics': 0.5, 'skills.math': 0.25, 'stats.intellect': 0.25 } }, blurb: 'A solar car, a rover, or a race car, built from nothing in a year.' },
  { id: 'moot_court', name: 'Moot court', leader: 'Captain', factor: 'skills.public_speaking', yearly: { skills: { public_speaking: 4, writing: 2 } },
    contest: { name: 'moot court competition', paths: { 'skills.public_speaking': 0.5, 'skills.writing': 0.25, 'stats.intellect': 0.25 } }, blurb: 'Argue an appeal in front of real judges, and take their questions.' },
  { id: 'prelaw', name: 'Pre-law society', leader: 'President', factor: 'stats.intellect', yearly: { skills: { writing: 2, public_speaking: 1 } }, blurb: 'LSAT study groups, alumni lawyers, and a trip to the state supreme court.' },
  { id: 'greek', name: 'Fraternity or sorority', leader: 'President', factor: 'stats.charm', mark: -0.08, dues: 1200, only: ['us', 'ca', 'ph'], yearly: { stats: { charm: 2, mood: 2 } }, blurb: 'A house, a set of letters, and friends who will answer the phone in thirty years. Dues every year.' },
];
export const ORG_BY_ID = Object.fromEntries(ORGS.map((o) => [o.id, o]));
export const MAX_ORGS = 2;

/** What a roommate is like to live with. line: how they are first described. clash: what the argument is about. */
export const HABITS = [
  { id: 'tidy', line: 'folds everything, including towels', clash: 'the state you leave the kitchen in' },
  { id: 'messy', line: 'has never knowingly washed a mug', clash: 'the dirty dishes, which have begun to grow' },
  { id: 'owl', line: 'comes alive at midnight', clash: 'the noise at three in the morning' },
  { id: 'lark', line: 'is up at six, cheerfully', clash: 'the alarm that goes off at six, every day' },
  { id: 'host', line: 'knows everyone, and invites them round', clash: 'the strangers asleep on the sofa' },
  { id: 'quiet', line: 'says very little, and listens to everything', clash: 'the silence, which has started to feel pointed' },
];
/** Invented employers for internships: one word from each list. */
export const EMPLOYERS = { first: ['Halden', 'Marrow', 'Castell', 'Brightwater', 'Northfold', 'Ostrander', 'Fairlight', 'Tessel', 'Kestrel', 'Lowry'], second: ['& Partners', 'Group', 'Associates', 'Works', 'Institute', 'Trust', 'Laboratories', 'Media', 'Systems', 'Holdings'] };
