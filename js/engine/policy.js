// What the government of a country currently does to ordinary life: the
// levels of its policies, read from the saved political world. Kept apart
// from engine/polity.js (which builds and runs that world) so that money,
// school and health code can ask without pulling the whole of politics in.
import { store } from '../state.js';
import { LEVERS } from '../data/parties.js';

const level = (countryId, lever) => store.state?.polities?.[countryId]?.policies?.[lever] ?? 0;

/** What is added to (or taken off) the basic rate of income tax, e.g. 0.04. */
export const taxShift = (countryId) => level(countryId, 'tax') * LEVERS.tax.step;
/** What tuition is multiplied by. */
export const tuitionFactor = (countryId) => 1 - level(countryId, 'tuition') * LEVERS.tuition.step;
/** What a patient's medical costs are multiplied by. */
export const healthFactor = (countryId) => 1 - level(countryId, 'health') * LEVERS.health.step;
/** What rents are multiplied by. */
export const rentFactor = (countryId) => 1 - level(countryId, 'rent') * LEVERS.rent.step;
