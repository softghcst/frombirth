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
    strong: ['art', 'music', 'theatre', 'english', 'history', 'journalism', 'psychology'],
    blurb: 'A few thousand students, small classes, and teachers who know your name.' },
  { id: 'conservatoire', label: 'Conservatoire', only: true, squeeze: 0.1, bar: 2.0, auditionBar: 72, tuitionMult: 1.4, living: 1.2, merit: 0.5, needAid: 0.6, arts: true, perk: 'mentor', rep: 82,
    names: ['{city} Conservatoire', 'The {place} Academy of Performing Arts'],
    strong: ['music', 'theatre', 'musical_theatre', 'musical_theatre_bfa', 'art'],
    blurb: 'For performers and artists. Everyone was the best in their school; here they are ordinary.' },
  { id: 'open', label: 'Open university', bar: 0, auditionBar: 99, open: true, tuitionMult: 0.45, living: 0, merit: 0, needAid: 0.5, perk: 'home', rep: 45,
    names: ['The {place} Open University'],
    strong: ['business', 'education', 'psychology', 'communications'],
    blurb: 'Takes anyone, of any age, from anywhere, and fits around a job. Nobody will hold your hand.' },
];
export const UNIVERSITY_KIND_BY_ID = Object.fromEntries(UNIVERSITY_KINDS.map((k) => [k.id, k]));

export const UNI_PLACES = ['Ashcombe', 'Marlowe', 'Wexcombe', 'Harrowgate', 'Calder', 'Thornley', 'Aldermoor', 'Penhallow', 'Ravensworth', 'Lindisholm'];
export const UNI_SAINTS = ['St Osric\'s', 'St Hild\'s', 'Trinity', 'All Hallows', 'St Aubyn\'s'];

/** The most places one round of applications can go to. */
export const MAX_APPLICATIONS = 5;

/** How a personal statement can be written. `needs`: what makes the risky ones come off. */
export const STATEMENTS = [
  { id: 'honest', name: 'Write plainly about why you want this', sub: 'Safe. It reads as it is.', value: 1 },
  { id: 'story', name: 'Tell the story of something hard', sub: 'Remembered if it is well told. Awkward if it is not.', risky: true },
  { id: 'polish', name: 'Have it polished until it gleams', sub: 'Smooth, impressive, and like a thousand others.', value: 0 },
];
