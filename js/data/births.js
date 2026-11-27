// How many babies are born in each country a year, in thousands: rounded recent estimates (about 2020–2024), for the
// birth globe's "how rare is this" (js/ui/birthGlobe.js). Only for show: a random life's country is still drawn at
// random (engine/characterGen.js). GAMEPLAY CONFIGURATION: approximate figures, not statistics to quote.
export const BIRTHS_K = {
  // North America and the Caribbean
  us: 3600, ca: 350, mx: 1800, cu: 90, jm: 30, bs: 4, do: 200, ht: 270, pr: 20, aw: 1.1, bz: 7, gt: 360, sv: 100, ni: 130, cr: 53, pa: 70,
  // South America
  br: 2550, ar: 460, cl: 170, pe: 470, co: 510, ec: 250, bo: 230, uy: 32, py: 135, ve: 450, gy: 15,
  // Europe
  uk: 680, ie: 55, fr: 680, de: 690, it: 380, es: 320, pt: 85, gr: 71, nl: 165, be: 110, ch: 80, at: 77, dk: 57, se: 98, no: 52, fi: 43, ee: 11,
  pl: 270, cz: 91, sk: 52, hu: 85, ro: 160, rs: 60, hr: 33, ua: 190, ru: 1260, mc: 0.3, ad: 0.45,
  // Africa
  eg: 2000, ma: 620, tn: 150, dz: 800, ke: 1500, ug: 1600, et: 3800, ng: 7800, gh: 900, za: 1100, zw: 430, ao: 1300, cd: 4300, dj: 21, mu: 12, sc: 1.6,
  // The Middle East
  tr: 1000, ae: 100, qa: 22, kw: 50, sa: 550, jo: 190, lb: 75, il: 180, sy: 600, iq: 1100, ir: 1050, ge: 45,
  // Asia
  jp: 730, kr: 230, cn: 9000, hk: 33, tw: 135, mn: 65, th: 520, vn: 1400, my: 420, sg: 33, id: 4500, ph: 1700, in: 23000, np: 520, bd: 2900,
  pk: 6300, af: 1450, kz: 400, mv: 7,
  // Oceania
  au: 290, nz: 59, pg: 270, ws: 5, fj: 17, pf: 4,
};
/** Babies born in the whole world a year, in thousands. */
export const WORLD_BIRTHS_K = 132000;

/** The rarity of being born in a country, from the commonest birthplaces to the rarest. */
export const RARITY = [
  { min: 5, name: 'Very common', tone: 'common' },
  { min: 1, name: 'Common', tone: 'common' },
  { min: 0.2, name: 'Uncommon', tone: 'uncommon' },
  { min: 0.03, name: 'Rare', tone: 'rare' },
  { min: 0.005, name: 'Very rare', tone: 'veryrare' },
  { min: 0, name: 'Ultra rare', tone: 'ultra' },
];

/** A country's share of the world's births: the percentage, one in how many babies, and how rare that is. */
export function birthOdds(countryId) {
  const k = BIRTHS_K[countryId];
  if (!k) return null;
  const pct = (k / WORLD_BIRTHS_K) * 100;
  return { pct, oneIn: Math.round(WORLD_BIRTHS_K / k), rarity: RARITY.find((r) => pct >= r.min) };
}
