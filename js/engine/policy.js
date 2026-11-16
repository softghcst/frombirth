// What the government of a country currently does to ordinary life: the
// levels of its policies, read from the saved political world. Kept apart
// from engine/polity.js (which builds and runs that world) so that money,
// school and health code can ask without pulling the whole of politics in.
import { store } from '../state.js';
import { LEVERS } from '../data/parties.js';

/** What the city and region the player lives in have decided for themselves (engine/local.js), where that is the country asked about. */
function local(countryId, key) {
  const p = store.state?.player;
  if (!p || p.countryId !== countryId) return 0;
  const places = store.state.polities?.[countryId]?.local;
  return (places?.[p.city]?.[key] ?? 0) + (places?.[`region:${p.city}`]?.[key] ?? 0);
}

const level = (countryId, lever) => store.state?.polities?.[countryId]?.policies?.[lever] ?? 0;

/** What is added to (or taken off) the basic rate of income tax, e.g. 0.04. */
export const taxShift = (countryId) => level(countryId, 'tax') * LEVERS.tax.step + local(countryId, 'rates') * 0.01;
/** What tuition is multiplied by. */
export const tuitionFactor = (countryId) => 1 - level(countryId, 'tuition') * LEVERS.tuition.step;
/** What a patient's medical costs are multiplied by. */
export const healthFactor = (countryId) => (1 - level(countryId, 'health') * LEVERS.health.step) * (1 - local(countryId, 'services') * 0.05);
/** What is added to the chance that a crime is solved. */
export const policingShift = (countryId) => level(countryId, 'police') * LEVERS.police.step + local(countryId, 'safety') * 0.03;
/** What rents are multiplied by. */
export const rentFactor = (countryId) => (1 - level(countryId, 'rent') * LEVERS.rent.step) * (1 - local(countryId, 'housing') * 0.04);
