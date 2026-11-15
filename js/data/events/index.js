// Event registry. Each category lives in its own file; add new files here.
import childhood from './childhood.js';
import school from './school.js';
import teen from './teen.js';
import adult from './adult.js';
import elder from './elder.js';
import musical from './stories/musical.js';

/** @type {import('../../types.js').GameEvent[]} */
export const EVENTS = [...childhood, ...school, ...teen, ...adult, ...elder, ...musical];
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
