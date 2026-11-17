// Immigration routes: the numbers behind engine/immigration.js.
//
// GAMEPLAY CONFIGURATION. Real immigration rules differ by country, change
// often and are far more detailed. These are deliberately simple and the
// same shape everywhere, so that the choice between routes is what matters.
// Nothing here describes or predicts a real visa.

/**
 * Areas whose citizens may live and work in each other's countries.
 * Simplified: the European area lists the members among the game's places
 * (European Union, plus Norway and Switzerland by their agreements with it).
 * UNVERIFIED against current treaties.
 */
export const FREE_MOVEMENT = [
  { id: 'europe', name: 'European free movement', members: ['at', 'be', 'hr', 'cz', 'dk', 'ee', 'fi', 'fr', 'de', 'gr', 'hu', 'ie', 'it', 'nl', 'pl', 'pt', 'ro', 'sk', 'es', 'se', 'no', 'ch'] },
  { id: 'tasman', name: 'Trans-Tasman arrangement', members: ['au', 'nz'] },
];

/** Careers employers abroad go looking for. */
export const WANTED = ['doctor', 'nurse', 'dentist', 'pharmacist', 'engineer', 'software', 'scientist', 'teacher', 'vet', 'academic'];

export const ROUTE = {
  fee: 6000,            // visas and lawyers, in base units (the same as before routes existed)
  studyFunds: 12000,    // what a student must show for the first year
  investStake: 300000,  // what an investor must bring
  workYears: 4,
  studyYears: 4,
  protectionYears: 3,
  settledAfter: 5,      // years on a temporary status before it can become permanent
};
