// Property for sale. Prices are base units (scaled by each country's currency).
// upkeep: yearly running costs as a share of value. yield: yearly rent a
// tenant pays as a share of value. comfort: mood each year you live there.
export const PROPERTY_TYPES = [
  { id: 'trailer', name: 'Trailer home', price: 40000, upkeep: 0.02, yield: 0.08, comfort: 0 },
  { id: 'studio', name: 'Studio flat', price: 120000, upkeep: 0.012, yield: 0.06, comfort: 1 },
  { id: 'condo', name: 'Two-bedroom condo', price: 220000, upkeep: 0.012, yield: 0.055, comfort: 2 },
  { id: 'house', name: 'Family house', price: 380000, upkeep: 0.012, yield: 0.05, comfort: 3 },
  { id: 'townhouse', name: 'Townhouse', price: 680000, upkeep: 0.013, yield: 0.045, comfort: 4 },
  { id: 'country', name: 'Country house', price: 1300000, upkeep: 0.015, yield: 0.04, comfort: 5 },
  { id: 'mansion', name: 'Mansion', price: 4000000, upkeep: 0.02, yield: 0.035, comfort: 7 },
];
export const PROPERTY_BY_ID = Object.fromEntries(PROPERTY_TYPES.map((t) => [t.id, t]));

export const STREETS = ['Elm Street', 'Harbour Road', 'Mill Lane', 'Station Road', 'Orchard Close', 'Kingsway',
  'Willow Crescent', 'Hill View', 'Market Street', 'Chapel Row', 'Riverside', 'Linden Avenue', 'Quarry Lane', 'The Green'];

/** Mortgage terms. deposit is the minimum share of the price paid up front. */
export const MORTGAGE = { rate: 0.055, years: 25, deposit: 0.1, incomeMultiple: 4.5, maxEndAge: 75 };

/** Selling costs (agents and lawyers) as a share of the price. */
export const SELLING_FEE = 0.03;
/** Buying costs (lawyers and surveys) as a share of the price. */
export const BUYING_FEE = 0.02;

/** Yearly living costs in base units: renting somewhere, versus bills in a home you own. */
export const RENT_AND_BILLS = 12000;
export const BILLS_ONLY = 5000;

/** What a buyer who does not live in the country pays on top: lawyers, translation, registration. Gameplay figure. */
export const FOREIGN_BUYER_FEE = 0.03;
