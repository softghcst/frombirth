// Vehicles for sale. Prices are base units, new.
// dep: value lost each year. maint: yearly running costs as a share of the new
// price. risk: crash risk multiplier. joy: mood when you take it out.
// needs: 'license' (driving) or 'pilot'.
// minAge: who may buy it (17 unless given). Anything without `needs` can be
// ridden or driven without a license.
export const VEHICLE_TYPES = [
  // Pedal and kick power: no license, and the first things a child can own.
  { id: 'balance_bike', cls: 'cycle', name: 'Balance bike', price: 90, dep: 0.2, maint: 0, risk: 0.3, joy: 5, minAge: 3, maxAge: 6 },
  { id: 'kick_scooter', cls: 'cycle', name: 'Kick scooter', price: 60, dep: 0.2, maint: 0, risk: 0.5, joy: 4, minAge: 5 },
  { id: 'kids_bike', cls: 'cycle', name: 'Kids\' bike', price: 180, dep: 0.18, maint: 0.03, risk: 0.5, joy: 6, minAge: 5, maxAge: 11 },
  { id: 'skateboard', cls: 'cycle', name: 'Skateboard', price: 90, dep: 0.15, maint: 0, risk: 1.2, joy: 6, minAge: 8 },
  { id: 'bmx', cls: 'cycle', name: 'BMX', price: 380, dep: 0.15, maint: 0.03, risk: 1.3, joy: 7, minAge: 8 },
  { id: 'mountain_bike', cls: 'cycle', name: 'Mountain bike', price: 900, dep: 0.14, maint: 0.04, risk: 1.0, joy: 6, minAge: 11 },
  { id: 'city_bike', cls: 'cycle', name: 'City bike', price: 450, dep: 0.12, maint: 0.03, risk: 0.5, joy: 3, minAge: 12 },
  { id: 'road_bike', cls: 'cycle', name: 'Road bike', price: 1900, dep: 0.13, maint: 0.04, risk: 0.9, joy: 6, minAge: 13 },
  { id: 'e_bike', cls: 'cycle', name: 'Electric bike', price: 2600, dep: 0.16, maint: 0.04, risk: 0.7, joy: 5, minAge: 14 },
  { id: 'e_scooter', cls: 'cycle', name: 'Electric scooter', price: 700, dep: 0.2, maint: 0.03, risk: 1.1, joy: 4, minAge: 16 },
  { id: 'cargo_bike', cls: 'cycle', name: 'Cargo bike', price: 3800, dep: 0.13, maint: 0.03, risk: 0.5, joy: 4, minAge: 18 },

  // Motorbikes
  { id: 'moped', cls: 'bike', name: 'Moped', price: 2800, dep: 0.14, maint: 0.05, risk: 1.6, joy: 4, minAge: 16 },
  { id: 'scooter_125', cls: 'bike', name: 'Motor scooter', price: 4500, dep: 0.13, maint: 0.05, risk: 1.8, joy: 4, needs: 'license' },
  { id: 'motorbike', cls: 'bike', name: 'Motorbike', price: 11000, dep: 0.12, maint: 0.06, risk: 2.6, joy: 6, needs: 'license' },
  { id: 'tourer', cls: 'bike', name: 'Touring motorbike', price: 24000, dep: 0.11, maint: 0.05, risk: 2.0, joy: 7, needs: 'license' },
  { id: 'superbike', cls: 'bike', name: 'Superbike', price: 32000, dep: 0.14, maint: 0.07, risk: 3.4, joy: 9, needs: 'license' },
  { id: 'quad', cls: 'bike', name: 'Quad bike', price: 9000, dep: 0.12, maint: 0.06, risk: 2.2, joy: 6, minAge: 16 },

  // Cars
  { id: 'city_car', cls: 'car', name: 'City car', price: 13000, dep: 0.14, maint: 0.05, risk: 1, joy: 1, needs: 'license' },
  { id: 'hatchback', cls: 'car', name: 'Hatchback', price: 18000, dep: 0.13, maint: 0.05, risk: 1, joy: 2, needs: 'license' },
  { id: 'family_car', cls: 'car', name: 'Family estate car', price: 28000, dep: 0.13, maint: 0.05, risk: 0.9, joy: 2, needs: 'license' },
  { id: 'minivan', cls: 'car', name: 'People carrier', price: 36000, dep: 0.14, maint: 0.05, risk: 0.8, joy: 2, needs: 'license' },
  { id: 'suv', cls: 'car', name: 'SUV', price: 42000, dep: 0.13, maint: 0.06, risk: 0.9, joy: 3, needs: 'license' },
  { id: 'electric', cls: 'car', name: 'Electric saloon', price: 46000, dep: 0.12, maint: 0.025, risk: 0.9, joy: 3, needs: 'license' },
  { id: 'electric_suv', cls: 'car', name: 'Electric SUV', price: 64000, dep: 0.13, maint: 0.025, risk: 0.8, joy: 4, needs: 'license' },
  { id: 'pickup', cls: 'car', name: 'Pickup truck', price: 38000, dep: 0.11, maint: 0.06, risk: 1.1, joy: 3, needs: 'license' },
  { id: 'off_roader', cls: 'car', name: 'Off-roader', price: 58000, dep: 0.1, maint: 0.07, risk: 1.2, joy: 5, needs: 'license' },
  { id: 'campervan', cls: 'car', name: 'Campervan', price: 70000, dep: 0.09, maint: 0.05, risk: 0.9, joy: 6, needs: 'license' },
  { id: 'convertible', cls: 'car', name: 'Convertible', price: 62000, dep: 0.14, maint: 0.06, risk: 1.4, joy: 6, needs: 'license' },
  { id: 'sports', cls: 'car', name: 'Sports car', price: 95000, dep: 0.15, maint: 0.06, risk: 1.7, joy: 7, needs: 'license' },
  { id: 'classic', cls: 'car', name: 'Classic car', price: 85000, dep: -0.02, maint: 0.08, risk: 1.2, joy: 8, needs: 'license' },
  { id: 'luxury', cls: 'car', name: 'Luxury saloon', price: 150000, dep: 0.16, maint: 0.05, risk: 0.9, joy: 5, needs: 'license' },
  { id: 'limousine', cls: 'car', name: 'Limousine', price: 240000, dep: 0.15, maint: 0.06, risk: 0.7, joy: 6, needs: 'license' },
  { id: 'supercar', cls: 'car', name: 'Supercar', price: 380000, dep: 0.12, maint: 0.06, risk: 2.2, joy: 10, needs: 'license' },
  { id: 'hypercar', cls: 'car', name: 'Hypercar', price: 2600000, dep: 0.04, maint: 0.05, risk: 2.6, joy: 13, needs: 'license' },

  // On the water
  { id: 'dinghy', cls: 'boat', name: 'Sailing dinghy', price: 6000, dep: 0.08, maint: 0.05, risk: 0.9, joy: 5, minAge: 14 },
  { id: 'jet_ski', cls: 'boat', name: 'Jet ski', price: 14000, dep: 0.12, maint: 0.07, risk: 1.6, joy: 7 },
  { id: 'speedboat', cls: 'boat', name: 'Speedboat', price: 55000, dep: 0.08, maint: 0.08, risk: 0.8, joy: 7 },
  { id: 'sailboat', cls: 'boat', name: 'Sailing yacht', price: 160000, dep: 0.06, maint: 0.08, risk: 0.6, joy: 9 },
  { id: 'yacht', cls: 'boat', name: 'Motor yacht', price: 1800000, dep: 0.07, maint: 0.1, risk: 0.4, joy: 12 },
  { id: 'superyacht', cls: 'boat', name: 'Superyacht', price: 45000000, dep: 0.06, maint: 0.1, risk: 0.3, joy: 16 },

  // In the air
  { id: 'light_plane', cls: 'plane', name: 'Light aircraft', price: 220000, dep: 0.05, maint: 0.1, risk: 0.7, joy: 9, needs: 'pilot' },
  { id: 'helicopter', cls: 'plane', name: 'Helicopter', price: 1900000, dep: 0.06, maint: 0.1, risk: 0.8, joy: 11, needs: 'pilot' },
  { id: 'jet', cls: 'plane', name: 'Private jet', price: 14000000, dep: 0.06, maint: 0.08, risk: 0.2, joy: 15, needs: 'pilot' },
];
/** The age from which anyone can buy a vehicle that sets no age of its own. */
export const VEHICLE_AGE = 17;

export const VEHICLE_BY_ID = Object.fromEntries(VEHICLE_TYPES.map((t) => [t.id, t]));

export const COLORS = ['red', 'silver', 'black', 'white', 'blue', 'green', 'gray', 'yellow'];

/** Licenses, in base units. pass: base chance, improved by the stat paths given. */
export const DRIVING_TEST = { fee: 600, minAge: 17, pass: { base: 0.55, factors: { 'stats.intellect': 0.3, 'hidden.discipline': 0.3 } } };
export const FLYING_LESSONS = { fee: 15000, minAge: 18, pass: { base: 0.5, factors: { 'stats.intellect': 0.6, 'hidden.discipline': 0.3 } } };

/** Servicing restores condition; costs this share of the vehicle's new price. */
export const SERVICE_COST = 0.03;
