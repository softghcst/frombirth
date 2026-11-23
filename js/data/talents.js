// Inborn talents: what someone has a gift for before any practice. Each is 0–100, passed down from both parents.
// IDs are saved in characters: never rename or remove one, only add.
//   hidden: kept out of the Talents list (mischief shows in what someone does, not on a chart).
//   added:  came later than the first six; older saves are given one when they load (save.js).
export const TALENTS = [
  { id: 'music', name: 'Music' },
  { id: 'sports', name: 'Sports' },
  { id: 'acting', name: 'Acting' },
  { id: 'singing', name: 'Singing' },
  { id: 'dance', name: 'Dance' },
  { id: 'art', name: 'Art', added: true },
  { id: 'writing', name: 'Writing', added: true },
  { id: 'tech', name: 'Technology', added: true },
  { id: 'science', name: 'Math and Science', added: true },
  { id: 'crime', name: 'Mischief', hidden: true },
];
export const TALENT_BY_ID = Object.fromEntries(TALENTS.map((t) => [t.id, t]));
/** The talents added after the first six. */
export const ADDED_TALENTS = TALENTS.filter((t) => t.added).map((t) => t.id);
/** How a talent is named in a sentence ("a gift for technology"). */
export const talentWord = (id) => (TALENT_BY_ID[id]?.name ?? id).toLowerCase();
