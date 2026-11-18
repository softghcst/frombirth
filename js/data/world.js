// The world's places as reference data: what each playable place is (a
// country, a territory, a special administrative region), how it relates to
// others, its codes, capital, languages, time zone and form of government.
// Everything a game system needs to say something true about a place without
// knowing it by name. Gameplay numbers (pay, prices, taxes) are elsewhere:
// data/countries.js, data/living.js.
//
// PROVENANCE. Written by hand, then checked field by field against ISO 3166-1,
// ISO 4217 and the Unicode CLDR, the IANA time-zone database and GeoNames by
// scripts/verify-world.py. The results are in data/worldVerification.js (generated);
// each place's `checked` says what was confirmed. Form of government and the status
// sentences have no machine-readable source and remain hand-written.
//
// `group` is the reference grouping used for browsing (it follows a common
// game convention: Georgia and Turkey sit under "Middle East", and Central
// America and the Caribbean under "North America"). `unRegion` is the UN M49
// region, which is the geographic classification.
//
// Row: [iso2, iso3, type, parent, group, unRegion, capital, languages, timeZone, government, status?]
//   type: 'country' | 'territory' | 'special_administrative_region' | 'jurisdiction'
//   parent: the place it is constitutionally tied to, if any
//   status: one neutral sentence, for places that are not ordinary sovereign states (each claim checked against
//           the Wikipedia article on the place; see docs/WORLD_DATA.md)
import { CHECKED } from './worldVerification.js';

const NA = 'North America';
const SA = 'South America';
const EU = 'Europe';
const AF = 'Africa';
const ME = 'Middle East';
const AS = 'Asia';
const OC = 'Oceania';

const ROWS = {
  // ---------- North America (16) ----------
  aw: ['AW', 'ABW', 'territory', 'nl', NA, 'Americas', 'Oranjestad', ['Dutch', 'Papiamento'], 'America/Aruba', 'Parliamentary democracy within a kingdom',
    'A constituent country of the Kingdom of the Netherlands: self-governing at home, with defense and foreign affairs handled by the Kingdom. Its people hold Dutch nationality.'],
  bs: ['BS', 'BHS', 'country', null, NA, 'Americas', 'Nassau', ['English'], 'America/Nassau', 'Parliamentary constitutional monarchy'],
  bz: ['BZ', 'BLZ', 'country', null, NA, 'Americas', 'Belmopan', ['English', 'Spanish', 'Belizean Creole'], 'America/Belize', 'Parliamentary constitutional monarchy'],
  ca: ['CA', 'CAN', 'country', null, NA, 'Americas', 'Ottawa', ['English', 'French'], 'America/Toronto', 'Federal parliamentary constitutional monarchy'],
  cr: ['CR', 'CRI', 'country', null, NA, 'Americas', 'San José', ['Spanish'], 'America/Costa_Rica', 'Presidential republic'],
  cu: ['CU', 'CUB', 'country', null, NA, 'Americas', 'Havana', ['Spanish'], 'America/Havana', 'One-party socialist republic'],
  do: ['DO', 'DOM', 'country', null, NA, 'Americas', 'Santo Domingo', ['Spanish'], 'America/Santo_Domingo', 'Presidential republic'],
  sv: ['SV', 'SLV', 'country', null, NA, 'Americas', 'San Salvador', ['Spanish'], 'America/El_Salvador', 'Presidential republic'],
  gt: ['GT', 'GTM', 'country', null, NA, 'Americas', 'Guatemala City', ['Spanish'], 'America/Guatemala', 'Presidential republic'],
  ht: ['HT', 'HTI', 'country', null, NA, 'Americas', 'Port-au-Prince', ['Haitian Creole', 'French'], 'America/Port-au-Prince', 'Semi-presidential republic'],
  jm: ['JM', 'JAM', 'country', null, NA, 'Americas', 'Kingston', ['English', 'Jamaican Patois'], 'America/Jamaica', 'Parliamentary constitutional monarchy'],
  mx: ['MX', 'MEX', 'country', null, NA, 'Americas', 'Mexico City', ['Spanish'], 'America/Mexico_City', 'Federal presidential republic'],
  ni: ['NI', 'NIC', 'country', null, NA, 'Americas', 'Managua', ['Spanish'], 'America/Managua', 'Presidential republic'],
  pa: ['PA', 'PAN', 'country', null, NA, 'Americas', 'Panama City', ['Spanish'], 'America/Panama', 'Presidential republic'],
  pr: ['PR', 'PRI', 'territory', 'us', NA, 'Americas', 'San Juan', ['Spanish', 'English'], 'America/Puerto_Rico', 'Self-governing territory with an elected governor',
    'An unincorporated territory of the United States with its own elected government. People born there are United States citizens; it has no voting members of Congress and no vote for president.'],
  us: ['US', 'USA', 'country', null, NA, 'Americas', 'Washington, D.C.', ['English'], 'America/New_York', 'Federal presidential republic'],

  // ---------- South America (11) ----------
  ar: ['AR', 'ARG', 'country', null, SA, 'Americas', 'Buenos Aires', ['Spanish'], 'America/Argentina/Buenos_Aires', 'Federal presidential republic'],
  bo: ['BO', 'BOL', 'country', null, SA, 'Americas', 'Sucre (constitutional); La Paz (seat of government)', ['Spanish', 'Quechua', 'Aymara'], 'America/La_Paz', 'Presidential republic'],
  br: ['BR', 'BRA', 'country', null, SA, 'Americas', 'Brasília', ['Portuguese'], 'America/Sao_Paulo', 'Federal presidential republic'],
  cl: ['CL', 'CHL', 'country', null, SA, 'Americas', 'Santiago', ['Spanish'], 'America/Santiago', 'Presidential republic'],
  co: ['CO', 'COL', 'country', null, SA, 'Americas', 'Bogotá', ['Spanish'], 'America/Bogota', 'Presidential republic'],
  ec: ['EC', 'ECU', 'country', null, SA, 'Americas', 'Quito', ['Spanish', 'Kichwa'], 'America/Guayaquil', 'Presidential republic'],
  gy: ['GY', 'GUY', 'country', null, SA, 'Americas', 'Georgetown', ['English', 'Guyanese Creole'], 'America/Guyana', 'Presidential republic with a parliament'],
  py: ['PY', 'PRY', 'country', null, SA, 'Americas', 'Asunción', ['Spanish', 'Guaraní'], 'America/Asuncion', 'Presidential republic'],
  pe: ['PE', 'PER', 'country', null, SA, 'Americas', 'Lima', ['Spanish', 'Quechua'], 'America/Lima', 'Presidential republic'],
  uy: ['UY', 'URY', 'country', null, SA, 'Americas', 'Montevideo', ['Spanish'], 'America/Montevideo', 'Presidential republic'],
  ve: ['VE', 'VEN', 'country', null, SA, 'Americas', 'Caracas', ['Spanish'], 'America/Caracas', 'Federal presidential republic'],

  // ---------- Europe (28) ----------
  ad: ['AD', 'AND', 'country', null, EU, 'Europe', 'Andorra la Vella', ['Catalan'], 'Europe/Andorra', 'Parliamentary co-principality',
    'A sovereign state whose two heads of state, the co-princes, are the Bishop of Urgell and the President of France. It is governed by its own elected parliament.'],
  at: ['AT', 'AUT', 'country', null, EU, 'Europe', 'Vienna', ['German'], 'Europe/Vienna', 'Federal parliamentary republic'],
  be: ['BE', 'BEL', 'country', null, EU, 'Europe', 'Brussels', ['Dutch', 'French', 'German'], 'Europe/Brussels', 'Federal parliamentary constitutional monarchy'],
  hr: ['HR', 'HRV', 'country', null, EU, 'Europe', 'Zagreb', ['Croatian'], 'Europe/Zagreb', 'Parliamentary republic'],
  cz: ['CZ', 'CZE', 'country', null, EU, 'Europe', 'Prague', ['Czech'], 'Europe/Prague', 'Parliamentary republic'],
  dk: ['DK', 'DNK', 'country', null, EU, 'Europe', 'Copenhagen', ['Danish'], 'Europe/Copenhagen', 'Parliamentary constitutional monarchy'],
  ee: ['EE', 'EST', 'country', null, EU, 'Europe', 'Tallinn', ['Estonian'], 'Europe/Tallinn', 'Parliamentary republic'],
  fi: ['FI', 'FIN', 'country', null, EU, 'Europe', 'Helsinki', ['Finnish', 'Swedish'], 'Europe/Helsinki', 'Parliamentary republic'],
  fr: ['FR', 'FRA', 'country', null, EU, 'Europe', 'Paris', ['French'], 'Europe/Paris', 'Semi-presidential republic'],
  de: ['DE', 'DEU', 'country', null, EU, 'Europe', 'Berlin', ['German'], 'Europe/Berlin', 'Federal parliamentary republic'],
  gr: ['GR', 'GRC', 'country', null, EU, 'Europe', 'Athens', ['Greek'], 'Europe/Athens', 'Parliamentary republic'],
  hu: ['HU', 'HUN', 'country', null, EU, 'Europe', 'Budapest', ['Hungarian'], 'Europe/Budapest', 'Parliamentary republic'],
  ie: ['IE', 'IRL', 'country', null, EU, 'Europe', 'Dublin', ['English', 'Irish'], 'Europe/Dublin', 'Parliamentary republic'],
  it: ['IT', 'ITA', 'country', null, EU, 'Europe', 'Rome', ['Italian'], 'Europe/Rome', 'Parliamentary republic'],
  mc: ['MC', 'MCO', 'country', null, EU, 'Europe', 'Monaco', ['French'], 'Europe/Monaco', 'Semi-constitutional monarchy (principality)'],
  nl: ['NL', 'NLD', 'country', null, EU, 'Europe', 'Amsterdam (capital); The Hague (seat of government)', ['Dutch'], 'Europe/Amsterdam', 'Parliamentary constitutional monarchy'],
  no: ['NO', 'NOR', 'country', null, EU, 'Europe', 'Oslo', ['Norwegian'], 'Europe/Oslo', 'Parliamentary constitutional monarchy'],
  pl: ['PL', 'POL', 'country', null, EU, 'Europe', 'Warsaw', ['Polish'], 'Europe/Warsaw', 'Parliamentary republic'],
  pt: ['PT', 'PRT', 'country', null, EU, 'Europe', 'Lisbon', ['Portuguese'], 'Europe/Lisbon', 'Semi-presidential republic'],
  ro: ['RO', 'ROU', 'country', null, EU, 'Europe', 'Bucharest', ['Romanian'], 'Europe/Bucharest', 'Semi-presidential republic'],
  ru: ['RU', 'RUS', 'country', null, EU, 'Europe', 'Moscow', ['Russian'], 'Europe/Moscow', 'Federal semi-presidential republic'],
  rs: ['RS', 'SRB', 'country', null, EU, 'Europe', 'Belgrade', ['Serbian'], 'Europe/Belgrade', 'Parliamentary republic'],
  sk: ['SK', 'SVK', 'country', null, EU, 'Europe', 'Bratislava', ['Slovak'], 'Europe/Bratislava', 'Parliamentary republic'],
  es: ['ES', 'ESP', 'country', null, EU, 'Europe', 'Madrid', ['Spanish'], 'Europe/Madrid', 'Parliamentary constitutional monarchy'],
  se: ['SE', 'SWE', 'country', null, EU, 'Europe', 'Stockholm', ['Swedish'], 'Europe/Stockholm', 'Parliamentary constitutional monarchy'],
  ch: ['CH', 'CHE', 'country', null, EU, 'Europe', 'Bern (federal city)', ['German', 'French', 'Italian', 'Romansh'], 'Europe/Zurich', 'Federal directorial republic'],
  ua: ['UA', 'UKR', 'country', null, EU, 'Europe', 'Kyiv', ['Ukrainian'], 'Europe/Kyiv', 'Semi-presidential republic'],
  uk: ['GB', 'GBR', 'country', null, EU, 'Europe', 'London', ['English'], 'Europe/London', 'Parliamentary constitutional monarchy'],

  // ---------- Africa (13) ----------
  dz: ['DZ', 'DZA', 'country', null, AF, 'Africa', 'Algiers', ['Arabic', 'Tamazight', 'French'], 'Africa/Algiers', 'Semi-presidential republic'],
  ao: ['AO', 'AGO', 'country', null, AF, 'Africa', 'Luanda', ['Portuguese'], 'Africa/Luanda', 'Presidential republic'],
  dj: ['DJ', 'DJI', 'country', null, AF, 'Africa', 'Djibouti City', ['French', 'Arabic', 'Somali', 'Afar'], 'Africa/Djibouti', 'Presidential republic'],
  cd: ['CD', 'COD', 'country', null, AF, 'Africa', 'Kinshasa', ['French', 'Lingala', 'Swahili', 'Kikongo', 'Tshiluba'], 'Africa/Kinshasa', 'Semi-presidential republic',
    'The Democratic Republic of the Congo (capital Kinshasa). Not to be confused with its neighbor the Republic of the Congo (capital Brazzaville), which is a different country.'],
  eg: ['EG', 'EGY', 'country', null, AF, 'Africa', 'Cairo', ['Arabic'], 'Africa/Cairo', 'Semi-presidential republic'],
  et: ['ET', 'ETH', 'country', null, AF, 'Africa', 'Addis Ababa', ['Amharic', 'Oromo', 'Tigrinya', 'Somali'], 'Africa/Addis_Ababa', 'Federal parliamentary republic'],
  ke: ['KE', 'KEN', 'country', null, AF, 'Africa', 'Nairobi', ['Swahili', 'English'], 'Africa/Nairobi', 'Presidential republic'],
  ma: ['MA', 'MAR', 'country', null, AF, 'Africa', 'Rabat', ['Arabic', 'Tamazight', 'French'], 'Africa/Casablanca', 'Semi-constitutional monarchy'],
  ng: ['NG', 'NGA', 'country', null, AF, 'Africa', 'Abuja', ['English', 'Hausa', 'Yoruba', 'Igbo'], 'Africa/Lagos', 'Federal presidential republic'],
  za: ['ZA', 'ZAF', 'country', null, AF, 'Africa', 'Pretoria (executive); Cape Town (legislative); Bloemfontein (judicial)', ['English', 'isiZulu', 'isiXhosa', 'Afrikaans'], 'Africa/Johannesburg', 'Parliamentary republic with an executive president'],
  tn: ['TN', 'TUN', 'country', null, AF, 'Africa', 'Tunis', ['Arabic', 'French'], 'Africa/Tunis', 'Presidential republic'],
  ug: ['UG', 'UGA', 'country', null, AF, 'Africa', 'Kampala', ['English', 'Swahili', 'Luganda'], 'Africa/Kampala', 'Presidential republic'],
  zw: ['ZW', 'ZWE', 'country', null, AF, 'Africa', 'Harare', ['English', 'Shona', 'Ndebele'], 'Africa/Harare', 'Presidential republic'],

  // ---------- "Middle East" reference grouping (12) ----------
  ge: ['GE', 'GEO', 'country', null, ME, 'Asia', 'Tbilisi', ['Georgian'], 'Asia/Tbilisi', 'Parliamentary republic'],
  ir: ['IR', 'IRN', 'country', null, ME, 'Asia', 'Tehran', ['Persian'], 'Asia/Tehran', 'Islamic republic'],
  iq: ['IQ', 'IRQ', 'country', null, ME, 'Asia', 'Baghdad', ['Arabic', 'Kurdish'], 'Asia/Baghdad', 'Federal parliamentary republic'],
  il: ['IL', 'ISR', 'country', null, ME, 'Asia', 'Jerusalem (seat of government; status disputed internationally)', ['Hebrew', 'Arabic'], 'Asia/Jerusalem', 'Parliamentary republic'],
  jo: ['JO', 'JOR', 'country', null, ME, 'Asia', 'Amman', ['Arabic'], 'Asia/Amman', 'Semi-constitutional monarchy'],
  kw: ['KW', 'KWT', 'country', null, ME, 'Asia', 'Kuwait City', ['Arabic'], 'Asia/Kuwait', 'Semi-constitutional monarchy (emirate)'],
  lb: ['LB', 'LBN', 'country', null, ME, 'Asia', 'Beirut', ['Arabic', 'French'], 'Asia/Beirut', 'Parliamentary republic'],
  qa: ['QA', 'QAT', 'country', null, ME, 'Asia', 'Doha', ['Arabic'], 'Asia/Qatar', 'Semi-constitutional monarchy (emirate)'],
  sa: ['SA', 'SAU', 'country', null, ME, 'Asia', 'Riyadh', ['Arabic'], 'Asia/Riyadh', 'Absolute monarchy'],
  sy: ['SY', 'SYR', 'country', null, ME, 'Asia', 'Damascus', ['Arabic'], 'Asia/Damascus', 'Republic under a transitional government'],
  tr: ['TR', 'TUR', 'country', null, ME, 'Asia', 'Ankara', ['Turkish'], 'Europe/Istanbul', 'Presidential republic'],
  ae: ['AE', 'ARE', 'country', null, ME, 'Asia', 'Abu Dhabi', ['Arabic'], 'Asia/Dubai', 'Federal semi-constitutional monarchy'],

  // ---------- Asia (18) ----------
  af: ['AF', 'AFG', 'country', null, AS, 'Asia', 'Kabul', ['Dari', 'Pashto'], 'Asia/Kabul', 'De facto theocratic emirate'],
  bd: ['BD', 'BGD', 'country', null, AS, 'Asia', 'Dhaka', ['Bengali'], 'Asia/Dhaka', 'Parliamentary republic'],
  cn: ['CN', 'CHN', 'country', null, AS, 'Asia', 'Beijing', ['Mandarin'], 'Asia/Shanghai', 'One-party socialist republic'],
  hk: ['HK', 'HKG', 'special_administrative_region', 'cn', AS, 'Asia', 'Hong Kong', ['Cantonese', 'English', 'Mandarin'], 'Asia/Hong_Kong', 'Special administrative region with a chief executive',
    'A Special Administrative Region of the People\'s Republic of China, with its own legal system, currency, immigration controls and passports, separate from those of mainland municipalities.'],
  in: ['IN', 'IND', 'country', null, AS, 'Asia', 'New Delhi', ['Hindi', 'English'], 'Asia/Kolkata', 'Federal parliamentary republic'],
  id: ['ID', 'IDN', 'country', null, AS, 'Asia', 'Jakarta', ['Indonesian'], 'Asia/Jakarta', 'Presidential republic'],
  jp: ['JP', 'JPN', 'country', null, AS, 'Asia', 'Tokyo', ['Japanese'], 'Asia/Tokyo', 'Parliamentary constitutional monarchy'],
  kz: ['KZ', 'KAZ', 'country', null, AS, 'Asia', 'Astana', ['Kazakh', 'Russian'], 'Asia/Almaty', 'Semi-presidential republic'],
  my: ['MY', 'MYS', 'country', null, AS, 'Asia', 'Kuala Lumpur', ['Malay'], 'Asia/Kuala_Lumpur', 'Federal parliamentary elective constitutional monarchy'],
  mn: ['MN', 'MNG', 'country', null, AS, 'Asia', 'Ulaanbaatar', ['Mongolian'], 'Asia/Ulaanbaatar', 'Semi-presidential republic'],
  np: ['NP', 'NPL', 'country', null, AS, 'Asia', 'Kathmandu', ['Nepali'], 'Asia/Kathmandu', 'Federal parliamentary republic'],
  pk: ['PK', 'PAK', 'country', null, AS, 'Asia', 'Islamabad', ['Urdu', 'English'], 'Asia/Karachi', 'Federal parliamentary republic'],
  ph: ['PH', 'PHL', 'country', null, AS, 'Asia', 'Manila', ['Filipino', 'English'], 'Asia/Manila', 'Presidential republic'],
  sg: ['SG', 'SGP', 'country', null, AS, 'Asia', 'Singapore', ['English', 'Malay', 'Mandarin', 'Tamil'], 'Asia/Singapore', 'Parliamentary republic'],
  kr: ['KR', 'KOR', 'country', null, AS, 'Asia', 'Seoul', ['Korean'], 'Asia/Seoul', 'Presidential republic'],
  th: ['TH', 'THA', 'country', null, AS, 'Asia', 'Bangkok', ['Thai'], 'Asia/Bangkok', 'Parliamentary constitutional monarchy'],
  tw: ['TW', 'TWN', 'jurisdiction', null, AS, 'Asia', 'Taipei', ['Mandarin', 'Taiwanese Hokkien', 'Hakka'], 'Asia/Taipei', 'Semi-presidential republic',
    'Governed separately, with its own elected government, laws, currency and passports. Its political status is disputed; the game lists it as a distinct place to live without taking a position on that.'],
  vn: ['VN', 'VNM', 'country', null, AS, 'Asia', 'Hanoi', ['Vietnamese'], 'Asia/Ho_Chi_Minh', 'One-party socialist republic'],

  // ---------- Oceania (4) ----------
  au: ['AU', 'AUS', 'country', null, OC, 'Oceania', 'Canberra', ['English'], 'Australia/Sydney', 'Federal parliamentary constitutional monarchy'],
  pg: ['PG', 'PNG', 'country', null, OC, 'Oceania', 'Port Moresby', ['English', 'Tok Pisin', 'Hiri Motu'], 'Pacific/Port_Moresby', 'Parliamentary constitutional monarchy'],
  nz: ['NZ', 'NZL', 'country', null, OC, 'Oceania', 'Wellington', ['English', 'Māori'], 'Pacific/Auckland', 'Parliamentary constitutional monarchy'],
  ws: ['WS', 'WSM', 'country', null, OC, 'Oceania', 'Apia', ['Samoan', 'English'], 'Pacific/Apia', 'Parliamentary republic'],

  // ---------- Beyond the reference list ----------
  gh: ['GH', 'GHA', 'country', null, AF, 'Africa', 'Accra', ['English', 'Akan'], 'Africa/Accra', 'Presidential republic'],
};

/** The 102 reference places every build must contain, by group. Places outside this list are allowed (see `extra`). */
export const REFERENCE = {
  [NA]: ['aw', 'bs', 'bz', 'ca', 'cr', 'cu', 'do', 'sv', 'gt', 'ht', 'jm', 'mx', 'ni', 'pa', 'pr', 'us'],
  [SA]: ['ar', 'bo', 'br', 'cl', 'co', 'ec', 'gy', 'py', 'pe', 'uy', 've'],
  [EU]: ['ad', 'at', 'be', 'hr', 'cz', 'dk', 'ee', 'fi', 'fr', 'de', 'gr', 'hu', 'ie', 'it', 'mc', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'rs', 'sk', 'es', 'se', 'ch', 'ua', 'uk'],
  [AF]: ['dz', 'ao', 'dj', 'cd', 'eg', 'et', 'ke', 'ma', 'ng', 'za', 'tn', 'ug', 'zw'],
  [ME]: ['ge', 'ir', 'iq', 'il', 'jo', 'kw', 'lb', 'qa', 'sa', 'sy', 'tr', 'ae'],
  [AS]: ['af', 'bd', 'cn', 'hk', 'in', 'id', 'jp', 'kz', 'my', 'mn', 'np', 'pk', 'ph', 'sg', 'kr', 'th', 'tw', 'vn'],
  [OC]: ['au', 'pg', 'nz', 'ws'],
};
export const GROUPS = [NA, SA, EU, AF, ME, AS, OC];
const REFERENCE_IDS = new Set(Object.values(REFERENCE).flat());

/** One word for a place's checks: every covered field confirmed, some not, or never checked. */
function verdict(c) {
  if (!c) return 'compiled';
  const covered = Object.values(c).filter((v) => v.status !== 'unchecked');
  if (covered.some((v) => v.status === 'mismatch')) return 'compiled';
  return covered.every((v) => v.status === 'ok' || v.status === 'review') ? 'verified' : 'partly verified';
}
const TYPE_LABEL = { country: 'Country', territory: 'Territory', special_administrative_region: 'Special administrative region', jurisdiction: 'Self-governing jurisdiction' };

/**
 * @typedef {object} Place
 * @property {string} id            stable id, used in saves; never a display name
 * @property {string} iso2
 * @property {string} iso3
 * @property {'country'|'territory'|'special_administrative_region'|'jurisdiction'} type
 * @property {string} typeLabel
 * @property {?string} parentId     the place it is constitutionally tied to
 * @property {?string} nationalityOf  whose nationality people born here ordinarily hold, when not their own
 * @property {string} group         browsing group
 * @property {string} unRegion      UN M49 region
 * @property {string} capital
 * @property {string[]} languages
 * @property {string} timeZone      principal IANA zone
 * @property {string} government    form of government (reference; who governs in a save is simulation)
 * @property {?string} status       a neutral sentence for places that are not ordinary sovereign states
 * @property {boolean} reference    one of the 102 reference places
 * @property {'verified'|'partly verified'|'compiled'} verification  every field a source covers agrees ('verified'), or some could not be confirmed
 * @property {Object<string,{status:string, note?:string}>} checked  field by field, from scripts/verify-world.py
 */
/** @type {Object<string, Place>} */
export const PLACES = Object.fromEntries(Object.entries(ROWS).map(([id, r]) => [id, {
  id, iso2: r[0], iso3: r[1], type: r[2], typeLabel: TYPE_LABEL[r[2]], parentId: r[3], nationalityOf: r[2] === 'territory' || r[2] === 'special_administrative_region' ? r[3] : null,
  group: r[4], unRegion: r[5], capital: r[6], languages: r[7], timeZone: r[8], government: r[9], status: r[10] ?? null,
  reference: REFERENCE_IDS.has(id), checked: CHECKED[id] ?? {}, verification: verdict(CHECKED[id]), metadataVersion: 1,
}]));

export const place = (id) => PLACES[id] ?? null;
/** Places in a browsing group, in the order of the reference list, with any extras after. */
export const placesIn = (group) => [...(REFERENCE[group] ?? []), ...Object.values(PLACES).filter((p) => !p.reference && p.group === group).map((p) => p.id)];
