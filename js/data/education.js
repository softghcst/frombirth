// Schooling by country: what each stage of school is called and when it
// starts, how work is marked, and what a school-leaver walks away with.
// Also: the subjects taught at each stage, and the kinds of school there are.
// Everything is the game's own simplification, set out so it can be changed.
//
// Inside the game a school life always has three stages, 'elementary',
// 'middle' and 'high', and marks run from 0 to 4. What the player sees is
// the country's own: its names, its starting ages, its way of marking.

const model = (primary, lower, upper, grading, leaving, extra = {}) => ({
  stages: [{ id: 'elementary', name: primary[0], start: primary[1] }, { id: 'middle', name: lower[0], start: lower[1] }, { id: 'high', name: upper[0], start: upper[1] }],
  grading, leaving, dropout: 16, ...extra,
});

const US = model(['Elementary school', 5], ['Middle school', 11], ['High school', 14], 'gpa', 'high-school diploma');
const UK = model(['Primary school', 5], ['Secondary school', 11], ['Sixth form', 16], 'letters', 'A-levels');
const FR = model(['École primaire', 6], ['Collège', 11], ['Lycée', 15], 'twenty', 'baccalauréat');
const DE = model(['Grundschule', 6], ['Gymnasium', 10], ['Oberstufe', 16], 'german', 'Abitur');
const ES = model(['Primary school', 6], ['Secondary school', 12], ['Bachillerato', 16], 'ten', 'bachillerato');
const JP = model(['Elementary school', 6], ['Junior high school', 12], ['Senior high school', 15], 'percent', 'senior high school certificate');
const IN = model(['Primary school', 6], ['Secondary school', 11], ['Higher secondary', 16], 'percent', 'higher secondary certificate');
const AU = model(['Primary school', 5], ['Secondary school', 12], ['Senior secondary', 16], 'percent', 'senior secondary certificate');
const NORDIC = model(['Primary school', 6], ['Lower secondary', 13], ['Upper secondary', 16], 'ten', 'upper secondary certificate');
const DEFAULT = model(['Primary school', 6], ['Lower secondary', 12], ['Upper secondary', 15], 'percent', 'school-leaving certificate');

/** How universities mark, by country. Not listed: a grade-point average. */
const DEGREE_SCHEME = {
  uk: 'honors', ie: 'honors', jm: 'honors', ng: 'honors', ke: 'honors', gh: 'honors', pk: 'honors', my: 'honors', sg: 'honors', au: 'honors', nz: 'honors', za: 'honors',
  fr: 'twenty', be: 'twenty', mc: 'twenty', ma: 'twenty',
  de: 'german', ch: 'german',
  it: 'italy',
  es: 'ten', mx: 'ten', ar: 'ten', co: 'ten', cl: 'ten', pe: 'ten', do: 'ten', ve: 'ten', cu: 'ten', pt: 'ten', br: 'ten', gr: 'ten', nl: 'ten',
  se: 'ects', no: 'ects', dk: 'ects', pl: 'ects',
  in: 'percent',
};
export const degreeScheme = (countryId) => DEGREE_SCHEME[countryId] ?? 'gpa';

/** Which model each country follows. A country not listed uses DEFAULT. */
const BY_COUNTRY = {
  us: US, ca: US, ph: US,
  uk: UK, ie: UK, jm: UK, sg: UK, my: UK, ng: UK, ke: UK, gh: UK, pk: UK,
  fr: FR, be: FR, mc: FR, ma: FR,
  de: DE, ch: DE, nl: DE, pl: DE,
  es: ES, mx: ES, ar: ES, co: ES, cl: ES, pe: ES, do: ES, ve: ES, cu: ES, it: ES, pt: ES, gr: ES, br: ES,
  jp: JP, kr: JP, cn: JP, th: JP, vn: JP,
  in: IN,
  au: AU, nz: AU, za: AU,
  se: NORDIC, no: NORDIC, dk: NORDIC,
};
export const schoolModel = (countryId) => BY_COUNTRY[countryId] ?? DEFAULT;
/** The age at which school ends everywhere in the game. */
export const LEAVING_AGE = 18;

/**
 * Subjects. `from`: the stage at which it starts. `apt`: what natural ability
 * for it draws on (paths on the player, with weights that add up to 1).
 * `club`: clubs that feed an interest in it.
 */
export const SUBJECTS = [
  { id: 'reading', name: 'Reading and writing', until: 'elementary', from: 'elementary', apt: { 'stats.intellect': 1 } },
  { id: 'math', name: 'Mathematics', from: 'elementary', apt: { 'stats.intellect': 1 }, club: ['chess'] },
  { id: 'science', name: 'Science', from: 'elementary', apt: { 'stats.intellect': 1 }, club: ['science_club', 'environment'] },
  { id: 'literature', name: 'Literature', from: 'middle', apt: { 'stats.intellect': 0.8, 'stats.charm': 0.2 }, club: ['paper', 'debate'] },
  { id: 'history', name: 'History', from: 'middle', apt: { 'stats.intellect': 1 }, club: ['debate'] },
  { id: 'languages', name: 'Languages', from: 'middle', apt: { 'stats.intellect': 0.7, 'stats.charm': 0.3 } },
  { id: 'technology', name: 'Technology', from: 'middle', apt: { 'stats.intellect': 1 }, club: ['coding'] },
  { id: 'art', name: 'Art', from: 'elementary', apt: { 'stats.intellect': 0.4, 'stats.charm': 0.6 }, club: ['art_club'] },
  { id: 'music', name: 'Music', from: 'elementary', apt: { 'talents.music': 0.7, 'talents.singing': 0.3 }, club: ['choir', 'band'] },
  { id: 'theater', name: 'Theater', from: 'middle', apt: { 'talents.acting': 0.8, 'stats.charm': 0.2 }, club: ['drama', 'youth_theater', 'musical_theater'] },
  { id: 'pe', name: 'Physical education', from: 'elementary', apt: { 'talents.sports': 0.7, 'stats.health': 0.3 }, club: ['sports_team', 'dance_class'] },
  { id: 'economics', name: 'Economics', from: 'high', apt: { 'stats.intellect': 1 } },
  { id: 'government', name: 'Government', from: 'high', apt: { 'stats.intellect': 0.6, 'stats.charm': 0.4 }, club: ['council', 'debate'] },
];
export const SUBJECT_BY_ID = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));
const ORDER = ['elementary', 'middle', 'high'];
/** The subjects taught at a stage. */
export const subjectsAt = (stage) => SUBJECTS.filter((s) => ORDER.indexOf(s.from) <= ORDER.indexOf(stage) && (!s.until || ORDER.indexOf(stage) <= ORDER.indexOf(s.until)));

/**
 * Kinds of school. fee: base money a year, paid by the family. teach: what
 * the teaching adds to a year's marks. needs: what gets a child in.
 *   wealth  the least a family must be: 'middle' or 'rich'
 *   entry   a test of the child: { path, min }
 * yearly: what a year there does to a child, beyond the lessons.
 * suffix: how such schools are named; {stage} is the country's word for the stage.
 */
export const SCHOOL_KINDS = [
  { id: 'public', name: 'State school', fee: 0, teach: 0, class: 6, suffix: ['{place} {stage}'],
    blurb: 'The local school. Free, mixed, and where most people go.' },
  { id: 'religious', name: 'Faith school', fee: 1500, teach: 0.05, class: 6, yearly: { hidden: { discipline: 1, karma: 1 } }, suffix: ['St {saint}\'s School', 'Holy Cross {stage}'],
    blurb: 'Small fees, assemblies, and firm ideas about behavior.' },
  { id: 'selective', name: 'Selective school', fee: 0, teach: 0.18, class: 6, from: 'middle', needs: { entry: { path: 'stats.intellect', min: 62 } }, yearly: { stats: { mood: -1 } }, suffix: ['{place} Grammar School', '{place} Academy'],
    blurb: 'Free, but there is an entrance test, and the work never lets up.' },
  { id: 'private', name: 'Private school', fee: 11000, teach: 0.15, class: 5, needs: { wealth: 'rich' }, yearly: { stats: { charm: 1 } }, suffix: ['{place} Hall', 'The {place} School'],
    blurb: 'Small classes, good facilities, and fees to match.' },
  { id: 'boarding', name: 'Boarding school', fee: 24000, teach: 0.2, class: 6, from: 'middle', away: true, needs: { wealth: 'rich' }, yearly: { hidden: { willpower: 2 }, stats: { charm: 1 } }, suffix: ['St {saint}\'s College', '{place} College'],
    blurb: 'Home only in the holidays. Old buildings, older rules, friends for life.' },
  { id: 'arts', name: 'Performing arts school', fee: 19000, teach: 0, class: 6, from: 'middle', needs: { entry: { path: 'talents.acting|talents.singing|talents.dance|talents.music', min: 55 } }, favors: ['music', 'theater', 'art'], suffix: ['The {place} School of Performing Arts'],
    blurb: 'Half the timetable is on a stage. Entry by audition, and the fees are steep unless the audition is exceptional.' },
  { id: 'sports', name: 'Sports academy', fee: 15000, teach: -0.05, class: 6, from: 'middle', needs: { entry: { path: 'talents.sports', min: 60 } }, favors: ['pe'], suffix: ['{place} Sports Academy'],
    blurb: 'Training before lessons and after them. Entry by trial, with steep fees unless the trial is exceptional.' },
  { id: 'home', name: 'Taught at home', fee: 0, teach: 0.05, class: 0, suffix: ['home'],
    blurb: 'Lessons at the kitchen table. No bell, no uniform, not many other children.' },
];
SCHOOL_KINDS.push({ id: 'palace', name: 'Palace tutors', fee: 0, teach: 0.12, class: 2, needs: { royal: true }, suffix: ['The Palace Schoolroom', 'The Schoolroom at {place} House', 'The {place} Palace Schoolroom'],
  blurb: 'Lessons at home from tutors chosen by the household. Two companions chosen for you, and few friends of your own choosing.' });
export const KIND_BY_ID = Object.fromEntries(SCHOOL_KINDS.map((k) => [k.id, k]));
/** What a family can pay, a year, by wealth. A school with entry by talent may take off part of its fee for an exceptional one. */
export const FEE_CAP = { poor: 1000, middle: 12000, rich: Infinity };
export const SCHOLARSHIPS = [{ min: 90, off: 1, name: 'a full scholarship' }, { min: 78, off: 0.5, name: 'a half scholarship' }, { min: 66, off: 0.25, name: 'a quarter scholarship' }];

/**
 * The lessons a royal child has that nobody else does: one a year, from eight.
 * `factor`: what decides whether the child takes to it; `gains` apply in full
 * if they do, half if they do not.
 */
export const ROYAL_LESSONS = [
  { id: 'etiquette', name: 'Etiquette and protocol', from: 8, factor: 'hidden.discipline', gains: { 'hidden.discipline': 2, 'stats.charm': 1 },
    sub: 'Forms of address, where to stand, which fork. It shows in public.',
    good: 'A year of protocol: you can now greet an ambassador, a bishop and a nervous child, in that order, without a mistake.', bad: 'A year of protocol. You learned which fork; you also learned to hate the man who teaches it.' },
  { id: 'constitution', name: 'The constitution and the law', from: 12, factor: 'stats.intellect', gains: { 'stats.intellect': 2 },
    sub: 'What the crown may do, what it may not, and why.',
    good: 'A year with a constitutional historian. You understand, now, exactly how little the crown may do, and how much that little matters.', bad: 'A year of constitutional history. Some of it went in.' },
  { id: 'diplomacy', name: 'Diplomacy and state visits', from: 12, factor: 'stats.charm', gains: { 'stats.charm': 2 },
    sub: 'How to be a guest, and how to be a host, on behalf of a country.',
    good: 'A year learning diplomacy from a retired ambassador. You can now make conversation with anyone about anything for twenty minutes.', bad: 'A year of diplomacy lessons. You can be polite for twenty minutes, just.' },
  { id: 'languages', name: 'A foreign language', from: 8, factor: 'stats.intellect', gains: { 'stats.intellect': 1 },
    sub: 'Taught by a native speaker, an hour every day.',
    good: 'A year of lessons with a native speaker, an hour every day, and it has stuck.', bad: 'A year of language lessons, an hour every day. You can order lunch.' },
  { id: 'cadets', name: 'Cadet training', from: 15, factor: 'stats.health', gains: { 'stats.health': 2, 'hidden.discipline': 2, 'hidden.willpower': 2 },
    sub: 'Weekends with the cadet force: drill, map-reading, cold mornings.',
    good: 'A year of weekends with the cadets. You are fitter, and you can read a map in the dark.', bad: 'A year of cold weekends with the cadets, most of them spent wishing you were somewhere else.' },
];

/** Invented names for places and saints, for naming schools. */
export const SCHOOL_PLACES = ['Ashdown', 'Brookfield', 'Elm Park', 'Riverside', 'Oakhill', 'Highfield', 'Westbury', 'Kingsmead', 'Larkhall', 'Thornbury', 'Fernleigh', 'Marlow Road', 'Northgate', 'Castle Hill', 'Greenacre', 'Millbrook'];
export const SCHOOL_SAINTS = ['Aldric', 'Brigid', 'Cuthbert', 'Hilda', 'Oswin', 'Edith', 'Wilfrid', 'Mildred'];

/** What a teacher is like in a classroom. */
export const TEACHING_STYLES = [
  { id: 'warm', name: 'encouraging', interest: 4 },
  { id: 'strict', name: 'strict', discipline: 1 },
  { id: 'inspiring', name: 'inspiring', interest: 7 },
  { id: 'dry', name: 'dry', interest: -3 },
  { id: 'fair', name: 'fair', interest: 1 },
];

/** What a child may come to care about. Not fixed: interests move with what happens. */
export const INTERESTS = [
  { id: 'science', name: 'Science' }, { id: 'math', name: 'Mathematics' }, { id: 'writing', name: 'Writing' }, { id: 'music', name: 'Music' },
  { id: 'theater', name: 'Theater' }, { id: 'art', name: 'Art' }, { id: 'sport', name: 'Sport' }, { id: 'technology', name: 'Technology' },
  { id: 'politics', name: 'Politics' }, { id: 'history', name: 'History' }, { id: 'languages', name: 'Languages' }, { id: 'service', name: 'Helping out' }, { id: 'games', name: 'Games' },
];
/** The circles a school sorts itself into: by what people care about, not by who they are. The last is for everyone else. */
export const CIRCLES = [
  { id: 'academic', name: 'the ones who like the work', interests: ['science', 'math', 'history', 'languages'] },
  { id: 'sport', name: 'the sports crowd', interests: ['sport'] },
  { id: 'stage', name: 'the theater and music lot', interests: ['theater', 'music'] },
  { id: 'makers', name: 'the ones who build things', interests: ['technology', 'games'] },
  { id: 'creative', name: 'the artists and writers', interests: ['art', 'writing'] },
  { id: 'causes', name: 'the ones with a cause', interests: ['politics', 'service'] },
  { id: 'own', name: 'people who go their own way', interests: [] },
];
/** What each club does with its year, which decides how it is played: a season, a production, a competition, an election. */
export const CLUB_KIND = { math_club: 'compete', book_club: 'compete', astronomy: 'compete', animal_rights: 'compete', gaming_club: 'compete', sports_team: 'sport', drama: 'stage', youth_theater: 'stage', musical_theater: 'stage', dance_class: 'compete', council: 'council', paper: 'press', debate: 'compete', chess: 'compete', band: 'compete', choir: 'compete',
  science_club: 'compete', coding: 'compete', art_club: 'compete', environment: 'compete', volunteers: 'compete' };
/** The interest a club belongs to: classmates who share it are the ones found there. */
export const CLUB_INTEREST = { math_club: 'math', book_club: 'writing', astronomy: 'science', animal_rights: 'service', gaming_club: 'games', sports_team: 'sport', drama: 'theater', youth_theater: 'theater', musical_theater: 'theater', council: 'politics', paper: 'writing', debate: 'politics', chess: 'games', band: 'music', choir: 'music',
  science_club: 'science', coding: 'technology', art_club: 'art', environment: 'service', volunteers: 'service', dance_class: 'theater' };
/** The sports schools play, by country. */
export const SPORTS = {
  default: ['football', 'basketball', 'volleyball', 'athletics', 'swimming', 'tennis'],
  us: ['American football', 'basketball', 'baseball', 'soccer', 'track and field', 'swimming', 'tennis', 'volleyball'],
  ca: ['ice hockey', 'basketball', 'soccer', 'track and field', 'swimming', 'volleyball'],
  uk: ['football', 'rugby', 'cricket', 'netball', 'hockey', 'athletics', 'swimming', 'tennis'],
  ie: ['Gaelic football', 'hurling', 'rugby', 'football', 'athletics', 'swimming'],
  au: ['Australian rules football', 'cricket', 'netball', 'rugby', 'swimming', 'athletics', 'tennis'],
  nz: ['rugby', 'cricket', 'netball', 'football', 'swimming', 'athletics'],
  in: ['cricket', 'hockey', 'football', 'badminton', 'athletics', 'kabaddi'],
  pk: ['cricket', 'hockey', 'football', 'badminton', 'athletics'],
  jp: ['baseball', 'football', 'judo', 'kendo', 'swimming', 'athletics', 'volleyball'],
  kr: ['football', 'baseball', 'taekwondo', 'basketball', 'athletics', 'swimming'],
  za: ['rugby', 'cricket', 'football', 'netball', 'athletics', 'swimming'],
  jm: ['athletics', 'football', 'cricket', 'netball', 'swimming'],
};
/** The last stage of school: what everyone takes, and what can be chosen beside it. */
export const CORE_HIGH = ['math', 'science', 'literature', 'languages', 'pe'];
export const ELECTIVES = ['history', 'technology', 'art', 'music', 'theater', 'economics', 'government'];
/** Plays a school might put on. All invented. */
export const PLAYS = ['The Glass Orchard', 'A Winter Crossing', 'The Lamplighter\'s Daughter', 'Nine Days in August', 'The Paper Kingdom', 'Salt and Honey', 'The Clockmaker of Varna', 'Under the Signal Tower', 'A Door in the Hill', 'The Last Ferry Home'];
