// (Martial arts have their own belts and moves: engine/martial.js.)
// Lessons a child asks their parents for (an adult signs up and pays). cost: base units for a year of lessons;
// grows: what a year does, before it tapers as a talent gets high; from: the year it exists at all.
// skill: the skill (data/skills.js) a year of lessons trains, so it shows under Skills and counts where that skill
// counts (coding for computer science, for example: engine/aptitudes.js).
export const LESSONS = [
  { id: 'voice', name: 'Voice lessons', emoji: '🎤', ages: [8, 120], cost: 900, skill: 'singing', grows: { 'talents.singing': 5, 'talents.music': 1 } },
  { id: 'piano', name: 'Piano lessons', emoji: '🎹', ages: [5, 120], cost: 900, skill: 'piano', grows: { 'talents.music': 5, 'stats.intellect': 1 } },
  { id: 'guitar', name: 'Guitar lessons', emoji: '🎸', ages: [7, 120], cost: 700, skill: 'guitar', grows: { 'talents.music': 5 } },
  { id: 'violin', name: 'Violin lessons', emoji: '🎻', ages: [5, 120], cost: 900, skill: 'violin', grows: { 'talents.music': 5, 'hidden.discipline': 1 } },
  { id: 'drums', name: 'Drum lessons', emoji: '🥁', ages: [8, 120], cost: 700, skill: 'drums', grows: { 'talents.music': 4, 'stats.mood': 2 } },
  { id: 'ballet', name: 'Ballet', emoji: '🩰', ages: [4, 120], cost: 800, skill: 'dance', grows: { 'talents.dance': 5, 'stats.health': 1 } },
  { id: 'hiphop', name: 'Hip-hop dance', emoji: '🕺', ages: [7, 120], cost: 600, from: 1985, skill: 'dance', grows: { 'talents.dance': 5, 'stats.mood': 1 } },
  { id: 'swimming', name: 'Swimming lessons', emoji: '🏊', ages: [4, 120], cost: 400, skill: 'swimming', grows: { 'talents.sports': 2, 'stats.health': 3 } },
  { id: 'tennis', name: 'Tennis lessons', emoji: '🎾', ages: [6, 120], cost: 800, skill: 'sports', grows: { 'talents.sports': 4, 'stats.health': 1 } },
  { id: 'drama', name: 'Drama classes', emoji: '🎭', ages: [6, 120], cost: 600, skill: 'acting', grows: { 'talents.acting': 5, 'stats.charm': 1 } },
  { id: 'modeling', name: 'Modeling lessons', emoji: '📸', ages: [10, 120], cost: 900, from: 1950, skill: 'modeling', grows: { 'talents.modeling': 5, 'stats.charm': 1 } },
  { id: 'chess', name: 'Chess club lessons', emoji: '♟️', ages: [6, 120], cost: 300, skill: 'chess', grows: { 'stats.intellect': 3, 'talents.science': 1 } },
  { id: 'coding', name: 'Coding classes', emoji: '💻', ages: [9, 120], cost: 800, from: 1985, skill: 'coding', grows: { 'stats.intellect': 2, 'talents.tech': 3 } },
  { id: 'robotics', name: 'Robotics club', emoji: '🤖', ages: [9, 18], cost: 900, from: 1995, skill: 'robotics', grows: { 'talents.tech': 3, 'talents.science': 1 } },
  { id: 'math_tutoring', name: 'Math tutoring', emoji: '➗', ages: [7, 120], cost: 700, skill: 'math', grows: { 'talents.science': 3, 'stats.intellect': 1 } },
  { id: 'art', name: 'Art classes', emoji: '🎨', ages: [5, 120], cost: 600, skill: 'painting', grows: { 'talents.art': 5 } },
  { id: 'writing', name: 'Creative writing workshop', emoji: '✍️', ages: [9, 120], cost: 500, skill: 'writing', grows: { 'talents.writing': 5, 'stats.intellect': 1 } },
  { id: 'spacecamp', name: 'Astronomy camp', emoji: '🔭', ages: [9, 17], cost: 1200, from: 1982, skill: 'science', grows: { 'stats.intellect': 2, 'talents.science': 3, 'stats.mood': 5 } },
];
export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
/** How many lessons fit in a year alongside school. */
export const LESSONS_A_YEAR = 3;
