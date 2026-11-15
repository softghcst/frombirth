// Event registry. Each category lives in its own file; add new files here.
import childhood from './childhood.js';
import school from './school.js';
import teen from './teen.js';
import adult from './adult.js';
import elder from './elder.js';
import friends from './friends.js';
import work from './work.js';
import romance from './romance.js';
import family from './family.js';
import familyLives from './familyLives.js';
import money from './money.js';
import prison from './prison.js';
import leisure from './leisure.js';
import early from './early.js';
import everyday from './everyday.js';
import identity from './identity.js';
import musical from './stories/musical.js';
import mentors from './stories/mentors.js';
import paper from './stories/paper.js';

/** @type {import('../../types.js').GameEvent[]} */
export const EVENTS = [...childhood, ...school, ...teen, ...adult, ...elder, ...friends, ...work, ...romance, ...family, ...familyLives, ...money, ...prison, ...leisure, ...early, ...everyday, ...identity, ...musical, ...mentors, ...paper];
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
