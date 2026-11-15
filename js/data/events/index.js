// Event registry. Each category lives in its own file; add new files here.
import childhood from './childhood.js';
import teen from './teen.js';
import adult from './adult.js';
import elder from './elder.js';

/** @type {import('../../types.js').GameEvent[]} */
export const EVENTS = [...childhood, ...teen, ...adult, ...elder];
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
