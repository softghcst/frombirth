// Lessons a child asks their parents for (an adult signs up and pays). cost: base units for a year of lessons;
// grows: what a year does, before it tapers as a talent gets high; from: the year it exists at all.
export const LESSONS = [
  { id: 'voice', name: 'Voice lessons', emoji: '🎤', ages: [6, 120], cost: 900, grows: { 'talents.singing': 5, 'talents.music': 1 } },
  { id: 'piano', name: 'Piano lessons', emoji: '🎹', ages: [5, 120], cost: 900, grows: { 'talents.music': 5, 'stats.intellect': 1 } },
  { id: 'guitar', name: 'Guitar lessons', emoji: '🎸', ages: [7, 120], cost: 700, grows: { 'talents.music': 5 } },
  { id: 'violin', name: 'Violin lessons', emoji: '🎻', ages: [5, 120], cost: 900, grows: { 'talents.music': 5, 'hidden.discipline': 1 } },
  { id: 'drums', name: 'Drum lessons', emoji: '🥁', ages: [8, 120], cost: 700, grows: { 'talents.music': 4, 'stats.mood': 2 } },
  { id: 'karate', name: 'Karate', emoji: '🥋', ages: [5, 120], cost: 600, grows: { 'talents.sports': 3, 'stats.health': 2, 'hidden.discipline': 2 } },
  { id: 'taekwondo', name: 'Taekwondo', emoji: '🥋', ages: [5, 120], cost: 600, grows: { 'talents.sports': 3, 'stats.health': 2, 'hidden.discipline': 2 } },
  { id: 'ballet', name: 'Ballet', emoji: '🩰', ages: [4, 120], cost: 800, grows: { 'talents.dance': 5, 'stats.health': 1 } },
  { id: 'hiphop', name: 'Hip-hop dance', emoji: '🕺', ages: [7, 120], cost: 600, from: 1985, grows: { 'talents.dance': 5, 'stats.mood': 1 } },
  { id: 'swimming', name: 'Swimming lessons', emoji: '🏊', ages: [4, 120], cost: 400, grows: { 'talents.sports': 2, 'stats.health': 3 } },
  { id: 'tennis', name: 'Tennis lessons', emoji: '🎾', ages: [6, 120], cost: 800, grows: { 'talents.sports': 4, 'stats.health': 1 } },
  { id: 'drama', name: 'Drama classes', emoji: '🎭', ages: [6, 120], cost: 600, grows: { 'talents.acting': 5, 'stats.charm': 1 } },
  { id: 'modeling', name: 'Modeling lessons', emoji: '📸', ages: [10, 120], cost: 900, from: 1950, grows: { 'stats.charm': 3 } },
  { id: 'chess', name: 'Chess club lessons', emoji: '♟️', ages: [6, 120], cost: 300, grows: { 'stats.intellect': 3 } },
  { id: 'coding', name: 'Coding classes', emoji: '💻', ages: [9, 120], cost: 800, from: 1985, grows: { 'stats.intellect': 3 } },
  { id: 'spacecamp', name: 'Astronomy camp', emoji: '🔭', ages: [9, 17], cost: 1200, from: 1982, grows: { 'stats.intellect': 3, 'stats.mood': 5 } },
];
export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
/** How many lessons fit in a year alongside school. */
export const LESSONS_A_YEAR = 3;
