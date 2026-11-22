// Skills the player can practice, up to PRACTICE_PER_YEAR sessions a year.
// talent: the session trains one of the six inherited talents directly
//         (the progress bar is the talent itself).
// helps:  a talent that makes this skill come faster, and that grows a
//         little as the skill does (every instrument helps `music`).
// minAge: the youngest a child can start.
// IDs are saved in characters: never rename or remove one, only add.
export const PRACTICE_PER_YEAR = 3;
/** A paid lesson, in base units: one session with half as much again learned. */
export const LESSON_COST = 300;

export const SKILL_GROUPS = [
  { id: 'instrument', name: 'Instruments' },
  { id: 'performing', name: 'Performing' },
  { id: 'body', name: 'Body' },
  { id: 'mind', name: 'Mind and hands' },
  { id: 'language', name: 'Languages' },
];

export const SKILLS = [
  { id: 'piano', group: 'instrument', name: 'Piano', helps: 'music', minAge: 4 },
  { id: 'guitar', group: 'instrument', name: 'Guitar', helps: 'music', minAge: 6 },
  { id: 'violin', group: 'instrument', name: 'Violin', helps: 'music', minAge: 4 },
  { id: 'drums', group: 'instrument', name: 'Drums', helps: 'music', minAge: 5 },
  { id: 'flute', group: 'instrument', name: 'Flute', helps: 'music', minAge: 7 },
  { id: 'saxophone', group: 'instrument', name: 'Saxophone', helps: 'music', minAge: 9 },
  { id: 'trumpet', group: 'instrument', name: 'Trumpet', helps: 'music', minAge: 8 },
  { id: 'cello', group: 'instrument', name: 'Cello', helps: 'music', minAge: 6 },
  { id: 'bass', group: 'instrument', name: 'Bass guitar', helps: 'music', minAge: 9 },
  { id: 'ukulele', group: 'instrument', name: 'Ukulele', helps: 'music', minAge: 4 },
  { id: 'harp', group: 'instrument', name: 'Harp', helps: 'music', minAge: 8 },
  { id: 'accordion', group: 'instrument', name: 'Accordion', helps: 'music', minAge: 8 },

  { id: 'singing', group: 'performing', name: 'Singing', talent: 'singing', minAge: 4 },
  { id: 'dance', group: 'performing', name: 'Dance', talent: 'dance', minAge: 3 },
  { id: 'acting', group: 'performing', name: 'Acting', talent: 'acting', minAge: 4 },
  { id: 'music_theory', group: 'performing', name: 'Music theory', talent: 'music', minAge: 6 },
  { id: 'magic', group: 'performing', name: 'Magic tricks', helps: 'acting', minAge: 7 },
  { id: 'rap', group: 'performing', name: 'Rapping', helps: 'music', minAge: 8 },
  { id: 'public_speaking', group: 'performing', name: 'Public speaking', minAge: 8, stat: 'charm' },

  { id: 'sports', group: 'body', name: 'Sport', talent: 'sports', minAge: 4 },
  { id: 'martial_arts', group: 'body', name: 'Martial arts', helps: 'sports', minAge: 5, stat: 'health' },
  { id: 'yoga', group: 'body', name: 'Yoga', helps: 'dance', minAge: 8, stat: 'health' },
  { id: 'swimming', group: 'body', name: 'Swimming', helps: 'sports', minAge: 4, stat: 'health' },

  { id: 'cooking', group: 'mind', name: 'Cooking', minAge: 7 },
  { id: 'painting', group: 'mind', name: 'Painting', minAge: 4 },
  { id: 'writing', group: 'mind', name: 'Creative writing', minAge: 8, stat: 'intellect' },
  { id: 'coding', group: 'mind', name: 'Coding', minAge: 8, stat: 'intellect' },
  { id: 'chess', group: 'mind', name: 'Chess', minAge: 5, stat: 'intellect' },
  { id: 'photography', group: 'mind', name: 'Photography', minAge: 10 },
  { id: 'gardening', group: 'mind', name: 'Gardening', minAge: 6 },

  { id: 'spanish', group: 'language', name: 'Spanish', minAge: 5, stat: 'intellect' },
  { id: 'french', group: 'language', name: 'French', minAge: 5, stat: 'intellect' },
  { id: 'japanese', group: 'language', name: 'Japanese', minAge: 5, stat: 'intellect' },
  { id: 'mandarin', group: 'language', name: 'Mandarin', minAge: 5, stat: 'intellect' },
  { id: 'german', group: 'language', name: 'German', minAge: 5, stat: 'intellect' },
  { id: 'korean', group: 'language', name: 'Korean', minAge: 5, stat: 'intellect' },
  { id: 'portuguese', group: 'language', name: 'Portuguese', minAge: 5, stat: 'intellect' },
  { id: 'arabic', group: 'language', name: 'Arabic', minAge: 5, stat: 'intellect' },
  { id: 'sign_language', group: 'language', name: 'Sign language', minAge: 5, stat: 'intellect' },
];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

/** What a level is called. */
export const LEVELS = [[0, 'Beginner'], [20, 'Getting somewhere'], [40, 'Competent'], [60, 'Good'], [80, 'Excellent'], [100, 'Master']];

/** Where each language is the one daily life is lived in. A country in no list needs none. */
export const SPOKEN = {
  spanish: ['es', 'mx', 'ar', 'co', 'cl', 'pe', 'do', 've', 'cu', 'cr', 'sv', 'gt', 'ni', 'pa', 'pr', 'bo', 'ec', 'py', 'uy'],
  french: ['fr', 'be', 'mc', 'ma', 'ht', 'dj', 'cd', 'dz', 'tn'],
  japanese: ['jp'],
  mandarin: ['cn', 'sg', 'tw'],
  german: ['de', 'ch', 'at'],
  korean: ['kr'],
  portuguese: ['pt', 'br', 'ao'],
  arabic: ['sa', 'ae', 'qa', 'kw', 'eg', 'jo', 'ma', 'dz', 'tn', 'iq', 'lb', 'sy', 'dj'],
};
