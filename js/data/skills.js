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
  { id: 'modeling', group: 'performing', name: 'Runway and posing', talent: 'modeling', minAge: 8 },
  { id: 'music_theory', group: 'performing', name: 'Music theory', talent: 'music', minAge: 6 },
  { id: 'magic', group: 'performing', name: 'Magic tricks', helps: 'acting', minAge: 7 },
  { id: 'rap', group: 'performing', name: 'Rapping', helps: 'music', minAge: 8 },
  { id: 'public_speaking', group: 'performing', name: 'Public speaking', minAge: 8, stat: 'charm' },

  { id: 'sports', group: 'body', name: 'Sport', talent: 'sports', minAge: 4 },
  { id: 'martial_arts', group: 'body', name: 'Martial arts', helps: 'sports', minAge: 5, stat: 'health' },
  { id: 'yoga', group: 'body', name: 'Yoga', helps: 'dance', minAge: 8, stat: 'health' },
  { id: 'swimming', group: 'body', name: 'Swimming', helps: 'sports', minAge: 4, stat: 'health' },

  { id: 'cooking', group: 'mind', name: 'Cooking', minAge: 7 },
  { id: 'painting', group: 'mind', name: 'Painting', helps: 'art', minAge: 4 },
  { id: 'drawing', group: 'mind', name: 'Drawing', helps: 'art', minAge: 4 },
  { id: 'writing', group: 'mind', name: 'Creative writing', helps: 'writing', minAge: 8, stat: 'intellect' },
  { id: 'coding', group: 'mind', name: 'Coding', helps: 'tech', minAge: 8, stat: 'intellect' },
  { id: 'robotics', group: 'mind', name: 'Robotics', helps: 'tech', minAge: 9, stat: 'intellect' },
  { id: 'math', group: 'mind', name: 'Math', helps: 'science', minAge: 5, stat: 'intellect' },
  { id: 'science', group: 'mind', name: 'Science experiments', helps: 'science', minAge: 6, stat: 'intellect' },
  { id: 'chess', group: 'mind', name: 'Chess', helps: 'science', minAge: 5, stat: 'intellect' },
  { id: 'photography', group: 'mind', name: 'Photography', helps: 'art', minAge: 10 },
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
  { id: 'italian', group: 'language', name: 'Italian', minAge: 5, stat: 'intellect' },
  { id: 'russian', group: 'language', name: 'Russian', minAge: 5, stat: 'intellect' },
  { id: 'ukrainian', group: 'language', name: 'Ukrainian', minAge: 5, stat: 'intellect' },
  { id: 'dutch', group: 'language', name: 'Dutch', minAge: 5, stat: 'intellect' },
  { id: 'hindi', group: 'language', name: 'Hindi', minAge: 5, stat: 'intellect' },
  { id: 'bengali', group: 'language', name: 'Bengali', minAge: 5, stat: 'intellect' },
  { id: 'urdu', group: 'language', name: 'Urdu', minAge: 5, stat: 'intellect' },
  { id: 'turkish', group: 'language', name: 'Turkish', minAge: 5, stat: 'intellect' },
  { id: 'greek', group: 'language', name: 'Greek', minAge: 5, stat: 'intellect' },
  { id: 'polish', group: 'language', name: 'Polish', minAge: 5, stat: 'intellect' },
  { id: 'swedish', group: 'language', name: 'Swedish', minAge: 5, stat: 'intellect' },
  { id: 'norwegian', group: 'language', name: 'Norwegian', minAge: 5, stat: 'intellect' },
  { id: 'danish', group: 'language', name: 'Danish', minAge: 5, stat: 'intellect' },
  { id: 'finnish', group: 'language', name: 'Finnish', minAge: 5, stat: 'intellect' },
  { id: 'czech', group: 'language', name: 'Czech', minAge: 5, stat: 'intellect' },
  { id: 'slovak', group: 'language', name: 'Slovak', minAge: 5, stat: 'intellect' },
  { id: 'hungarian', group: 'language', name: 'Hungarian', minAge: 5, stat: 'intellect' },
  { id: 'romanian', group: 'language', name: 'Romanian', minAge: 5, stat: 'intellect' },
  { id: 'serbo_croatian', group: 'language', name: 'Serbo-Croatian', minAge: 5, stat: 'intellect' },
  { id: 'vietnamese', group: 'language', name: 'Vietnamese', minAge: 5, stat: 'intellect' },
  { id: 'thai', group: 'language', name: 'Thai', minAge: 5, stat: 'intellect' },
  { id: 'indonesian', group: 'language', name: 'Indonesian', minAge: 5, stat: 'intellect' },
  { id: 'malay', group: 'language', name: 'Malay', minAge: 5, stat: 'intellect' },
  { id: 'tagalog', group: 'language', name: 'Tagalog', minAge: 5, stat: 'intellect' },
  { id: 'swahili', group: 'language', name: 'Swahili', minAge: 5, stat: 'intellect' },
  { id: 'amharic', group: 'language', name: 'Amharic', minAge: 5, stat: 'intellect' },
  { id: 'hebrew', group: 'language', name: 'Hebrew', minAge: 5, stat: 'intellect' },
  { id: 'persian', group: 'language', name: 'Persian', minAge: 5, stat: 'intellect' },
  { id: 'cantonese', group: 'language', name: 'Cantonese', minAge: 5, stat: 'intellect' },
  { id: 'mongolian', group: 'language', name: 'Mongolian', minAge: 5, stat: 'intellect' },
  { id: 'nepali', group: 'language', name: 'Nepali', minAge: 5, stat: 'intellect' },
  { id: 'georgian', group: 'language', name: 'Georgian', minAge: 5, stat: 'intellect' },
  { id: 'kazakh', group: 'language', name: 'Kazakh', minAge: 5, stat: 'intellect' },
  { id: 'estonian', group: 'language', name: 'Estonian', minAge: 5, stat: 'intellect' },
  { id: 'catalan', group: 'language', name: 'Catalan', minAge: 5, stat: 'intellect' },
];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

/** What a level is called. */
export const LEVELS = [[0, 'Beginner'], [20, 'Getting somewhere'], [40, 'Competent'], [60, 'Good'], [80, 'Excellent'], [100, 'Master']];

/** Where each language is the one daily life is lived in. A country in no list needs none. */
export const SPOKEN = {
  spanish: ['es', 'mx', 'ar', 'co', 'cl', 'pe', 'do', 've', 'cu', 'cr', 'sv', 'gt', 'ni', 'pa', 'pr', 'bo', 'ec', 'py', 'uy'],
  french: ['fr', 'be', 'mc', 'ma', 'ht', 'dj', 'cd', 'dz', 'tn', 'ch'],
  japanese: ['jp'],
  mandarin: ['cn', 'sg', 'tw'],
  german: ['de', 'ch', 'at'],
  korean: ['kr'],
  portuguese: ['pt', 'br', 'ao'],
  arabic: ['sa', 'ae', 'qa', 'kw', 'eg', 'jo', 'ma', 'dz', 'tn', 'iq', 'lb', 'sy', 'dj'],
  italian: ['it', 'ch'], russian: ['ru', 'kz'], ukrainian: ['ua'], dutch: ['nl', 'be', 'aw'], hindi: ['in'], bengali: ['bd'],
  urdu: ['pk'], turkish: ['tr'], greek: ['gr'], polish: ['pl'], swedish: ['se'], norwegian: ['no'], danish: ['dk'],
  finnish: ['fi'], czech: ['cz'], slovak: ['sk'], hungarian: ['hu'], romanian: ['ro'], serbo_croatian: ['hr', 'rs'],
  vietnamese: ['vn'], thai: ['th'], indonesian: ['id'], malay: ['my', 'sg'], tagalog: ['ph'], swahili: ['ke', 'ug'],
  amharic: ['et'], hebrew: ['il'], persian: ['ir', 'af'], cantonese: ['hk'], mongolian: ['mn'], nepali: ['np'],
  georgian: ['ge'], kazakh: ['kz'], estonian: ['ee'], catalan: ['ad'],
};

/**
 * What practicing a skill does for someone, in a line, for the Skills screen. Kept to what the game really counts
 * (engine/aptitudes.js for school, degrees and jobs; the clubs, contests and careers that read a skill). Languages
 * are described from where they are spoken (engine/skills.js usesOf).
 */
const MUSIC = 'Grows your music talent: bands, music careers and auditions.';
export const SKILL_USES = {
  piano: MUSIC, guitar: MUSIC, violin: MUSIC, drums: MUSIC, flute: MUSIC, saxophone: MUSIC, trumpet: MUSIC, cello: MUSIC,
  bass: MUSIC, ukulele: MUSIC, harp: MUSIC, accordion: MUSIC, rap: MUSIC,
  singing: 'Your singing talent itself: auditions, choirs, bands and idol careers.',
  dance: 'Your dance talent itself: auditions, dance careers and idol training.',
  acting: 'Your acting talent itself: castings, theater and screen careers, and a little in law and medicine.',
  modeling: 'Your modeling talent itself: agencies, castings and modeling work.',
  music_theory: 'Your music talent itself: songwriting, bands and music careers.',
  magic: 'Grows your acting talent, and makes for a good party trick.',
  public_speaking: 'Law, politics, broadcasting, and debate, mock trial and moot court.',
  sports: 'Your sport talent itself: school teams, trials and a sports career.',
  martial_arts: 'Police, the military, firefighting and sport, and your sport talent.',
  yoga: 'Health, and your dance talent.',
  swimming: 'Health, swim teams, and the police, military and firefighting.',
  cooking: 'Cooking content online, cooking clubs, and food at home.',
  painting: 'Art class, an art degree, and design and art work.',
  drawing: 'Art class, an art degree, and design, animation and art work.',
  photography: 'Art, photography work and freelance shoots, and photos online.',
  writing: 'Literature, writing and journalism degrees, law, the news and books.',
  coding: 'Technology class, a computer science degree, tech jobs, and coding camp and hackathons.',
  robotics: 'Engineering and computer science, the robotics team and robotics competitions.',
  math: 'Math class, math, finance and engineering degrees, and the math olympiad.',
  science: 'Science class, chemistry and biology degrees, medicine and lab work, and the science fair.',
  chess: 'A little for math and law, chess clubs and tournaments.',
  gardening: 'Gardening clubs and community gardens, and a calmer mind.',
  sign_language: 'Talking with deaf friends and family, and employers count it as a language.',
};

