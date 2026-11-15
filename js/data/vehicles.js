// Vehicles for sale. Prices are base units, new.
// dep: value lost each year. maint: yearly running costs as a share of the new
// price. risk: crash risk multiplier. joy: mood when you take it out.
// needs: 'licence' (driving) or 'pilot'.
export const VEHICLE_TYPES = [
  { id: 'hatchback', cls: 'car', name: 'Hatchback', price: 18000, dep: 0.13, maint: 0.05, risk: 1, joy: 2, needs: 'licence' },
  { id: 'family_car', cls: 'car', name: 'Family estate car', price: 28000, dep: 0.13, maint: 0.05, risk: 0.9, joy: 2, needs: 'licence' },
  { id: 'electric', cls: 'car', name: 'Electric saloon', price: 46000, dep: 0.12, maint: 0.025, risk: 0.9, joy: 3, needs: 'licence' },
  { id: 'pickup', cls: 'car', name: 'Pickup truck', price: 38000, dep: 0.11, maint: 0.06, risk: 1.1, joy: 3, needs: 'licence' },
  { id: 'sports', cls: 'car', name: 'Sports car', price: 95000, dep: 0.15, maint: 0.06, risk: 1.7, joy: 7, needs: 'licence' },
  { id: 'luxury', cls: 'car', name: 'Luxury saloon', price: 150000, dep: 0.16, maint: 0.05, risk: 0.9, joy: 5, needs: 'licence' },
  { id: 'supercar', cls: 'car', name: 'Supercar', price: 380000, dep: 0.12, maint: 0.06, risk: 2.2, joy: 10, needs: 'licence' },
  { id: 'motorbike', cls: 'bike', name: 'Motorbike', price: 11000, dep: 0.12, maint: 0.06, risk: 2.6, joy: 6, needs: 'licence' },
  { id: 'speedboat', cls: 'boat', name: 'Speedboat', price: 55000, dep: 0.08, maint: 0.08, risk: 0.8, joy: 7 },
  { id: 'yacht', cls: 'boat', name: 'Yacht', price: 1800000, dep: 0.07, maint: 0.1, risk: 0.4, joy: 12 },
  { id: 'light_plane', cls: 'plane', name: 'Light aircraft', price: 220000, dep: 0.05, maint: 0.1, risk: 0.7, joy: 9, needs: 'pilot' },
  { id: 'jet', cls: 'plane', name: 'Private jet', price: 14000000, dep: 0.06, maint: 0.08, risk: 0.2, joy: 15, needs: 'pilot' },
];
export const VEHICLE_BY_ID = Object.fromEntries(VEHICLE_TYPES.map((t) => [t.id, t]));

export const COLOURS = ['red', 'silver', 'black', 'white', 'blue', 'green', 'grey', 'yellow'];

/** Licences, in base units. pass: base chance, improved by the stat paths given. */
export const DRIVING_TEST = { fee: 600, minAge: 17, pass: { base: 0.55, factors: { 'stats.intellect': 0.3, 'hidden.discipline': 0.3 } } };
export const FLYING_LESSONS = { fee: 15000, minAge: 18, pass: { base: 0.5, factors: { 'stats.intellect': 0.6, 'hidden.discipline': 0.3 } } };

/** Servicing restores condition; costs this share of the vehicle's new price. */
export const SERVICE_COST = 0.03;
