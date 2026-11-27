// Heritage: where a person's family comes from, as the game draws faces. Each heritage leans a face toward the skin
// tones, hair colors, hair textures and eye colors common among people of that background; every one of them spans a
// wide range, and nothing is ever ruled out (any heritage can be born with any feature, only less often). A person's
// heritage is a share of one or more of these (a child of an East Asian mother and a European father is half each), and
// what they are born with is drawn from the blend.
//
// GAMEPLAY CONFIGURATION, not anthropology or census data. The groupings are broad and the weights are rough leanings
// meant to make a crowd in Seoul, Lagos or Lima look like one; they say nothing about any individual, and players can
// give anyone any face in the editor.
//
// Skin tones are the ids of js/avatarPalettes.js SKIN_TONE_IDS, lightest to deepest:
//   porcelain ivory rose_beige sand beige golden caramel olive tan bronze chestnut umber cocoa espresso sable ebony onyx

/** @typedef {{id:string, label:string, skin:Object<string,number>, hairColor:Object<string,number>,
 *             hairTexture:Object<string,number>, eyeColor:Object<string,number>}} Heritage */

/** @type {Heritage[]} */
export const HERITAGES = [
  { id: 'east_asian', label: 'East Asian',
    skin: { ivory: 10, sand: 18, beige: 26, golden: 24, caramel: 10, olive: 7, tan: 5 },
    hairColor: { black: 78, dark_brown: 22 },
    hairTexture: { straight: 78, wavy: 18, curly: 4 },
    eyeColor: { dark_brown: 74, brown: 26 } },
  { id: 'southeast_asian', label: 'Southeast Asian',
    skin: { beige: 8, golden: 20, caramel: 24, olive: 6, tan: 22, bronze: 16, chestnut: 4 },
    hairColor: { black: 74, dark_brown: 26 },
    hairTexture: { straight: 56, wavy: 30, curly: 12, coily: 2 },
    eyeColor: { dark_brown: 74, brown: 26 } },
  { id: 'south_asian', label: 'South Asian',
    skin: { beige: 4, golden: 10, caramel: 16, olive: 12, tan: 18, bronze: 18, chestnut: 12, umber: 6, cocoa: 4 },
    hairColor: { black: 70, dark_brown: 27, brown: 3 },
    hairTexture: { straight: 34, wavy: 38, curly: 24, coily: 4 },
    eyeColor: { dark_brown: 60, brown: 31, hazel: 5, green: 2, amber: 2 } },
  { id: 'central_asian', label: 'Central Asian',
    skin: { ivory: 6, sand: 16, beige: 24, golden: 22, caramel: 14, olive: 12, tan: 6 },
    hairColor: { black: 56, dark_brown: 32, brown: 9, light_brown: 3 },
    hairTexture: { straight: 64, wavy: 28, curly: 8 },
    eyeColor: { dark_brown: 54, brown: 32, hazel: 9, green: 3, gray: 2 } },
  { id: 'mena', label: 'Middle Eastern & North African',
    skin: { rose_beige: 2, sand: 10, beige: 18, golden: 14, caramel: 14, olive: 24, tan: 12, bronze: 6 },
    hairColor: { black: 48, dark_brown: 38, brown: 11, light_brown: 3 },
    hairTexture: { straight: 22, wavy: 38, curly: 33, coily: 7 },
    eyeColor: { dark_brown: 46, brown: 34, hazel: 11, green: 4, amber: 3, gray: 2 } },
  { id: 'african', label: 'Sub-Saharan African',
    skin: { bronze: 2, chestnut: 10, umber: 16, cocoa: 20, espresso: 20, sable: 14, ebony: 12, onyx: 6 },
    hairColor: { black: 86, dark_brown: 14 },
    hairTexture: { wavy: 4, curly: 24, coily: 72 },
    eyeColor: { dark_brown: 82, brown: 17, amber: 1 } },
  { id: 'european', label: 'European',
    skin: { porcelain: 14, ivory: 22, rose_beige: 22, sand: 16, beige: 14, golden: 4, olive: 7, tan: 1 },
    hairColor: { black: 6, dark_brown: 22, brown: 24, light_brown: 16, auburn: 6, ginger: 5, dark_blonde: 11, blonde: 10 },
    hairTexture: { straight: 46, wavy: 36, curly: 16, coily: 2 },
    eyeColor: { dark_brown: 6, brown: 24, hazel: 16, amber: 3, green: 14, blue: 28, gray: 9 } },
  { id: 'latino', label: 'Latino',
    skin: { rose_beige: 6, sand: 12, beige: 16, golden: 14, caramel: 16, olive: 12, tan: 12, bronze: 8, chestnut: 4 },
    hairColor: { black: 40, dark_brown: 38, brown: 15, light_brown: 4, dark_blonde: 3 },
    hairTexture: { straight: 32, wavy: 36, curly: 24, coily: 8 },
    eyeColor: { dark_brown: 50, brown: 33, hazel: 10, green: 4, amber: 2, blue: 1 } },
  { id: 'indigenous_americas', label: 'Indigenous American',
    skin: { golden: 12, caramel: 24, olive: 4, tan: 26, bronze: 24, chestnut: 10 },
    hairColor: { black: 86, dark_brown: 14 },
    hairTexture: { straight: 76, wavy: 20, curly: 4 },
    eyeColor: { dark_brown: 80, brown: 20 } },
  { id: 'pacific_islander', label: 'Pacific Islander',
    skin: { caramel: 14, olive: 4, tan: 24, bronze: 30, chestnut: 20, umber: 8 },
    hairColor: { black: 72, dark_brown: 26, brown: 2 },
    hairTexture: { straight: 10, wavy: 30, curly: 44, coily: 16 },
    eyeColor: { dark_brown: 74, brown: 26 } },
  { id: 'indigenous_australian', label: 'Aboriginal & Torres Strait Islander',
    skin: { tan: 6, bronze: 18, chestnut: 26, umber: 24, cocoa: 16, espresso: 10 },
    hairColor: { black: 60, dark_brown: 28, brown: 6, light_brown: 3, dark_blonde: 3 },
    hairTexture: { straight: 10, wavy: 34, curly: 44, coily: 12 },
    eyeColor: { dark_brown: 76, brown: 24 } },
];

export const HERITAGE_BY_ID = Object.fromEntries(HERITAGES.map((h) => [h.id, h]));
export const HERITAGE_IDS = HERITAGES.map((h) => h.id);

/**
 * Who is born in each place, as a rough mix: [weight, heritage] pairs, where a heritage is an id or, for people of
 * long-mixed backgrounds, a share of several ({ african: 0.5, european: 0.5 }). Places not listed take their group's
 * default (DEFAULT_BY_GROUP). Rough gameplay leanings, rounded; not census figures.
 */
const EU = [[93, 'european'], [3, 'mena'], [2, 'african'], [2, 'south_asian']];
export const DEFAULT_BY_GROUP = {
  'Europe': EU,
  'Middle East': [[94, 'mena'], [4, 'south_asian'], [2, 'african']],
  'Africa': [[98, 'african'], [2, 'south_asian']],
  'Asia': [[96, 'east_asian'], [4, 'southeast_asian']],
  'Oceania': [[100, 'pacific_islander']],
  'North America': [[80, 'latino'], [12, 'african'], [8, 'european']],
  'South America': [[76, 'latino'], [12, 'european'], [6, 'indigenous_americas'], [6, 'african']],
};

export const COUNTRY_HERITAGE = {
  // North America and the Caribbean
  us: [[58, 'european'], [19, 'latino'], [13, 'african'], [3, 'east_asian'], [2, 'south_asian'], [2, 'southeast_asian'], [2, 'mena'], [1, 'indigenous_americas']],
  ca: [[70, 'european'], [8, 'south_asian'], [8, 'east_asian'], [4, 'african'], [4, 'southeast_asian'], [4, 'indigenous_americas'], [2, 'mena']],
  mx: [[80, 'latino'], [14, 'indigenous_americas'], [6, 'european']],
  gt: [[56, 'latino'], [44, 'indigenous_americas']],
  sv: [[90, 'latino'], [6, 'indigenous_americas'], [4, 'european']],
  ni: [[80, 'latino'], [8, 'african'], [8, 'european'], [4, 'indigenous_americas']],
  cr: [[84, 'latino'], [8, 'european'], [6, 'african'], [2, 'indigenous_americas']],
  pa: [[66, 'latino'], [14, 'african'], [12, 'indigenous_americas'], [8, 'european']],
  bz: [[52, 'latino'], [26, 'african'], [12, 'indigenous_americas'], [6, 'european'], [4, 'south_asian']],
  cu: [[60, 'latino'], [20, 'european'], [20, 'african']],
  do: [[70, 'latino'], [20, 'african'], [10, 'european']],
  pr: [[80, 'latino'], [10, 'african'], [10, 'european']],
  ht: [[96, 'african'], [4, 'latino']],
  jm: [[90, 'african'], [4, { african: 0.5, european: 0.5 }], [2, 'south_asian'], [2, 'east_asian'], [2, 'european']],
  bs: [[90, 'african'], [10, 'european']],
  aw: [[70, 'latino'], [15, 'african'], [15, 'european']],
  // South America
  ar: [[60, 'european'], [36, 'latino'], [4, 'indigenous_americas']],
  bo: [[50, 'latino'], [46, 'indigenous_americas'], [4, 'european']],
  br: [[46, 'latino'], [32, 'european'], [19, 'african'], [2, 'east_asian'], [1, 'indigenous_americas']],
  cl: [[70, 'latino'], [22, 'european'], [8, 'indigenous_americas']],
  co: [[80, 'latino'], [10, 'african'], [6, 'european'], [4, 'indigenous_americas']],
  ec: [[74, 'latino'], [16, 'indigenous_americas'], [6, 'african'], [4, 'european']],
  gy: [[40, 'south_asian'], [30, 'african'], [20, 'latino'], [10, 'indigenous_americas']],
  py: [[92, 'latino'], [4, 'indigenous_americas'], [4, 'european']],
  pe: [[60, 'latino'], [30, 'indigenous_americas'], [6, 'european'], [2, 'east_asian'], [2, 'african']],
  uy: [[70, 'european'], [26, 'latino'], [4, 'african']],
  ve: [[70, 'latino'], [18, 'european'], [8, 'african'], [4, 'indigenous_americas']],
  // Europe (others: DEFAULT_BY_GROUP.Europe)
  uk: [[82, 'european'], [8, 'south_asian'], [4, 'african'], [2, 'east_asian'], [2, 'mena'], [1, 'southeast_asian'], [1, { african: 0.5, european: 0.5 }]],
  fr: [[82, 'european'], [9, 'mena'], [7, 'african'], [1, 'southeast_asian'], [1, 'east_asian']],
  de: [[86, 'european'], [9, 'mena'], [2, 'african'], [2, 'south_asian'], [1, 'east_asian']],
  nl: [[80, 'european'], [7, 'mena'], [5, 'african'], [4, 'southeast_asian'], [2, 'latino'], [2, 'south_asian']],
  be: [[84, 'european'], [9, 'mena'], [6, 'african'], [1, 'south_asian']],
  se: [[84, 'european'], [10, 'mena'], [4, 'african'], [2, 'south_asian']],
  no: [[88, 'european'], [5, 'mena'], [4, 'african'], [3, 'south_asian']],
  dk: [[90, 'european'], [6, 'mena'], [2, 'african'], [2, 'south_asian']],
  ch: [[88, 'european'], [6, 'mena'], [3, 'african'], [3, 'south_asian']],
  at: [[90, 'european'], [8, 'mena'], [2, 'african']],
  es: [[86, 'european'], [7, 'latino'], [5, 'mena'], [2, 'african']],
  it: [[92, 'european'], [4, 'mena'], [2, 'african'], [2, 'south_asian']],
  pt: [[92, 'european'], [5, 'african'], [3, 'latino']],
  ie: [[92, 'european'], [3, 'african'], [3, 'south_asian'], [2, 'east_asian']],
  ru: [[86, 'european'], [10, 'central_asian'], [2, 'east_asian'], [2, 'mena']],
  ua: [[98, 'european'], [2, 'central_asian']],
  pl: [[99, 'european'], [1, 'mena']], cz: [[99, 'european'], [1, 'mena']], sk: [[99, 'european'], [1, 'mena']],
  hu: [[99, 'european'], [1, 'mena']], ro: [[99, 'european'], [1, 'mena']], rs: [[99, 'european'], [1, 'mena']],
  hr: [[99, 'european'], [1, 'mena']], ee: [[96, 'european'], [4, 'central_asian']], fi: [[96, 'european'], [2, 'mena'], [2, 'african']],
  gr: [[94, 'european'], [5, 'mena'], [1, 'south_asian']],
  // Middle East
  ge: [[60, 'european'], [40, 'mena']],
  tr: [[70, 'mena'], [30, 'european']],
  il: [[55, 'mena'], [40, 'european'], [3, 'african'], [2, { mena: 0.5, european: 0.5 }]],
  sa: [[76, 'mena'], [14, 'south_asian'], [6, 'southeast_asian'], [4, 'african']],
  ae: [[30, 'mena'], [50, 'south_asian'], [12, 'southeast_asian'], [4, 'african'], [4, 'european']],
  qa: [[30, 'mena'], [50, 'south_asian'], [12, 'southeast_asian'], [4, 'african'], [4, 'european']],
  kw: [[60, 'mena'], [28, 'south_asian'], [8, 'southeast_asian'], [4, 'african']],
  ir: [[90, 'mena'], [10, 'central_asian']],
  // Africa
  dz: [[96, 'mena'], [4, 'african']], eg: [[96, 'mena'], [4, 'african']], ma: [[96, 'mena'], [4, 'african']], tn: [[96, 'mena'], [4, 'african']],
  dj: [[88, 'african'], [12, 'mena']],
  et: [[100, 'african']],
  za: [[80, 'african'], [9, 'european'], [8, { african: 0.4, european: 0.3, south_asian: 0.15, southeast_asian: 0.15 }], [3, 'south_asian']],
  ke: [[98, 'african'], [2, 'south_asian']], ug: [[98, 'african'], [2, 'south_asian']],
  // Asia
  cn: [[96, 'east_asian'], [3, 'central_asian'], [1, 'southeast_asian']],
  hk: [[92, 'east_asian'], [4, 'southeast_asian'], [2, 'south_asian'], [2, 'european']],
  jp: [[98, 'east_asian'], [1, 'southeast_asian'], [1, 'european']],
  kr: [[98, 'east_asian'], [1, 'southeast_asian'], [1, 'central_asian']],
  tw: [[97, 'east_asian'], [3, 'pacific_islander']],
  mn: [[90, 'east_asian'], [10, 'central_asian']],
  kz: [[70, 'central_asian'], [26, 'european'], [4, 'east_asian']],
  af: [[40, 'central_asian'], [40, 'south_asian'], [20, 'mena']],
  pk: [[92, 'south_asian'], [8, 'central_asian']],
  in: [[99, 'south_asian'], [1, 'east_asian']],
  bd: [[99, 'south_asian'], [1, 'southeast_asian']],
  np: [[80, 'south_asian'], [20, 'east_asian']],
  mv: [[100, 'south_asian']],
  id: [[96, 'southeast_asian'], [3, 'east_asian'], [1, 'pacific_islander']],
  my: [[64, 'southeast_asian'], [24, 'east_asian'], [8, 'south_asian'], [4, 'pacific_islander']],
  ph: [[97, 'southeast_asian'], [2, 'east_asian'], [1, 'european']],
  sg: [[74, 'east_asian'], [14, 'southeast_asian'], [9, 'south_asian'], [3, 'european']],
  th: [[90, 'southeast_asian'], [10, 'east_asian']],
  vn: [[96, 'southeast_asian'], [4, 'east_asian']],
  mu: [[66, 'south_asian'], [28, 'african'], [4, 'east_asian'], [2, 'european']],
  sc: [[88, 'african'], [6, 'south_asian'], [4, 'european'], [2, 'east_asian']],
  // Oceania
  au: [[76, 'european'], [7, 'east_asian'], [5, 'south_asian'], [4, 'southeast_asian'], [3, 'indigenous_australian'], [2, 'mena'], [2, 'pacific_islander'], [1, 'african']],
  nz: [[68, 'european'], [22, 'pacific_islander'], [7, 'east_asian'], [3, 'south_asian']],
  pg: [[100, 'pacific_islander']],
  ws: [[96, 'pacific_islander'], [4, { pacific_islander: 0.5, european: 0.5 }]],
  fj: [[58, 'pacific_islander'], [38, 'south_asian'], [4, 'european']],
  pf: [[80, 'pacific_islander'], [12, 'european'], [8, 'east_asian']],
};
