// The hospital tag a baby is given: the day, the time, how much they weighed and how long they were, the doctor and the
// hospital. Shown when the player's child is born (ui/birthTag.js), and kept: on a child's page, and the player's own on
// the Self tab.
//
//   person.birthInfo = { date, time, weightOz, lengthIn, doctor, place, city, countryId, atHome, room }
//
// Size at birth runs in families: a baby's weight and length lean toward their parents' own (a parent whose size at
// birth was never recorded is given one, the same every time, from their id). Boys are a little heavier, twins
// lighter. All of it comes from the people's ids, not the game's dice, so it never changes what else happens.
import { store } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { birthdayFor, isoDate, birthdayOf, starSign } from './birthday.js';

/** Average size at birth, and how much it varies (ounces, inches). */
export const AT_BIRTH = { weight: 120, weightSd: 15, boy: 4, twin: -22, length: 19.7, lengthSd: 0.9, heritable: 0.45 };
/** Where pounds and inches are what a birth is told in; elsewhere it is grams and centimeters. */
const IMPERIAL = new Set(['us', 'uk', 'ca', 'ie', 'au', 'nz', 'pr', 'bs', 'jm']);
/** Before this year most children were born at home, with a midwife. */
const HOME_BIRTHS_UNTIL = 1935;

/** Draws from a person's id: the same numbers every time. */
function seeded(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let s = h >>> 0;
  const next = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    normal: () => { const u = Math.max(1e-9, next()); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next()); },
  };
}

/** A person's own size at birth: as recorded, or given them from their id. */
export function sizeAtBirth(person) {
  if (person?.birthInfo?.weightOz) return { weightOz: person.birthInfo.weightOz, lengthIn: person.birthInfo.lengthIn };
  const r = seeded(`size:${person?.id ?? 'x'}`);
  const boy = person?.gender === 'male' ? AT_BIRTH.boy : 0;
  return { weightOz: Math.round(AT_BIRTH.weight + boy + r.normal() * AT_BIRTH.weightSd), lengthIn: Math.round((AT_BIRTH.length + r.normal() * AT_BIRTH.lengthSd) * 4) / 4 };
}

/** A baby's size: leaning toward their parents' own, a little heavier for a boy, lighter for a twin. */
export function inheritSize(id, gender, parents = [], twin = false) {
  // `twin`: true for twins, or how many were born together (3 for triplets): each more makes them smaller.
  const more = twin === true ? 1 : Math.max(0, (Number(twin) || 1) - 1);
  const r = seeded(`born:${id}`);
  const known = parents.filter(Boolean).map(sizeAtBirth);
  const dev = (k, mean) => (known.length ? known.reduce((t, s) => t + (s[k] - mean), 0) / known.length : 0);
  const weight = AT_BIRTH.weight + (gender === 'male' ? AT_BIRTH.boy : 0) + more * AT_BIRTH.twin
    + AT_BIRTH.heritable * dev('weightOz', AT_BIRTH.weight + 2) + r.normal() * AT_BIRTH.weightSd * 0.85;
  const length = AT_BIRTH.length - more * 0.6 + AT_BIRTH.heritable * dev('lengthIn', AT_BIRTH.length) + r.normal() * AT_BIRTH.lengthSd * 0.85;
  return { weightOz: Math.round(Math.max(more ? 40 : 64, Math.min(176, weight))), lengthIn: Math.round(Math.max(more ? 15 : 16.5, Math.min(23, length)) * 4) / 4 };
}

// Hospital names, by country: a few that sound like the place. {city} is the city, {saint} a saint, {name} a surname.
const SAINTS = ['Mary', 'Joseph', 'Luke', 'Francis', 'Anne', 'Vincent', 'Elizabeth', 'Catherine', 'Michael', 'John', 'Thomas', 'Margaret', 'Jude', 'Agnes'];
const HOSPITALS = {
  us: ["St. {saint}'s Hospital", '{city} General Hospital', '{city} Memorial Hospital', 'Mercy Medical Center', 'Good Samaritan Hospital', '{name} Memorial Hospital', "{city} Women's and Children's Hospital", 'Presbyterian Hospital of {city}', 'Baptist Medical Center'],
  uk: ["St {saint}'s Hospital", '{city} Royal Infirmary', '{city} General Hospital', "Queen Charlotte's Maternity Unit", "{city} Women's Hospital", 'The Royal {city} Hospital'],
  ie: ["St {saint}'s Hospital", 'The Rotunda', '{city} University Hospital', "National Maternity Hospital, Holles Street"],
  ca: ["St. {saint}'s Hospital", '{city} General Hospital', "{city} Women's College Hospital", 'Royal Victoria Hospital'],
  au: ["Royal {city} Women's Hospital", "St {saint}'s Hospital", '{city} Base Hospital', "King Edward Memorial Hospital"],
  nz: ['{city} Hospital', "St {saint}'s Hospital", "National Women's Hospital"],
  fr: ['Hôpital Saint-{saint}', 'Maternité de {city}', 'Centre Hospitalier de {city}', 'Clinique {name}'],
  es: ['Hospital Universitario de {city}', 'Hospital San {saint}', 'Hospital General de {city}', 'Clínica {name}'],
  mx: ['Hospital General de {city}', 'Hospital Ángeles {city}', 'Clínica de la Mujer', 'Hospital San {saint}'],
  de: ['Klinikum {city}', 'St.-{saint}-Krankenhaus', 'Frauenklinik {city}', 'Universitätsklinikum {city}'],
  it: ['Ospedale San {saint}', 'Policlinico di {city}', 'Ospedale Civile di {city}'],
  pt: ['Hospital de Santa {saint}', 'Maternidade de {city}', 'Hospital de {city}'],
  br: ['Hospital Santa {saint}', 'Maternidade de {city}', 'Hospital São {saint}', 'Hospital Municipal de {city}'],
  jp: ['{city} Red Cross Hospital', '{city} Municipal Hospital', '{city} University Hospital', '{name} Maternity Clinic'],
  kr: ['{city} National University Hospital', '{name} Women’s Clinic', '{city} Medical Center'],
  cn: ['{city} Maternity and Child Health Hospital', "{city} People's Hospital", '{city} Union Hospital'],
  in: ['{city} Civil Hospital', '{name} Nursing Home', 'Apollo Hospital, {city}', 'Government Maternity Hospital, {city}'],
};
const GENERIC = ['{city} General Hospital', '{city} Maternity Hospital', '{city} Central Hospital', '{city} University Hospital'];
const SAINT_FOR = { fr: ['Joseph', 'Louis', 'Antoine', 'Vincent'], es: ['Rafael', 'Juan', 'Carlos', 'José'], it: ['Raffaele', 'Giovanni', 'Paolo', 'Camillo'],
  pt: ['Maria', 'Marta', 'Luzia'], br: ['Casa', 'Paulo', 'Lucas', 'José'], de: ['Josef', 'Elisabeth', 'Marien', 'Vinzenz'], mx: ['José', 'Javier', 'Ángel'] };

/** A hospital where the family lives: one name per city, the same for every child born there. */
export function hospitalIn(countryId, city) {
  const r = seeded(`hospital:${countryId}:${city}`);
  const last = COUNTRIES[countryId]?.names?.last?.length ? COUNTRIES[countryId].names.last : ['Harper'];
  const fill = (t) => t.replace('{city}', city ?? COUNTRIES[countryId]?.name ?? '').replace('{saint}', r.pick(SAINT_FOR[countryId] ?? SAINTS))
    .replace('{name}', r.pick(last).replace(/_/g, ' '));
  return fill(r.pick(HOSPITALS[countryId] ?? GENERIC));
}

/**
 * The tag for a birth. `date` is the day (ISO); `parents`, the two people whose size the baby leans toward.
 * @returns the birthInfo kept on the person
 */
export function makeBirthInfo(person, { date, countryId, city, parents = [], twin = false }) {
  const r = seeded(`tag:${person.id}`);
  const year = Number(String(date).slice(0, 4));
  const atHome = year < HOME_BIRTHS_UNTIL;
  const last = COUNTRIES[countryId]?.names?.last ?? ['Harper'];
  const surname = r.pick(last).replace(/_/g, ' ');
  const hour = r.int(0, 23); const minute = r.int(0, 59);
  const size = inheritSize(person.id, person.gender, parents, twin);
  return {
    date, time: `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`,
    weightOz: size.weightOz, lengthIn: size.lengthIn,
    doctor: atHome ? `${r.pick(['Mrs.', 'Nurse'])} ${surname}, midwife` : `Dr. ${surname}`,
    place: atHome ? 'At home' : hospitalIn(countryId, city), city, countryId, atHome,
    room: atHome ? null : `${r.int(1, 6)}${String(r.int(1, 40)).padStart(2, '0')}`,
  };
}

/** How a birth's size is told where it happened: "7 lbs 8 oz" and "20 in", or "3.40 kg" and "51 cm". */
export function sizeWords(info) {
  if (IMPERIAL.has(info.countryId)) {
    const lbs = Math.floor(info.weightOz / 16);
    return { weight: `${lbs} lbs ${info.weightOz % 16} oz`, length: `${String(info.lengthIn).replace(/\.0+$/, '').replace('.25', ' ¼').replace('.5', ' ½').replace('.75', ' ¾')} in`, lbs, oz: info.weightOz % 16, imperial: true };
  }
  return { weight: `${(info.weightOz * 28.3495 / 1000).toFixed(2)} kg`, length: `${Math.round(info.lengthIn * 2.54)} cm`, imperial: false };
}

/** A person's birthday as the game keeps it ({ m, d }), from their tag's date. */
export const birthdayFromDate = (date) => ({ m: Number(String(date).slice(5, 7)) - 1, d: Number(String(date).slice(8, 10)) });

/** The player's own tag, made the first time it is asked for: their mother and father are the parents they were born to. */
export function playerBirthInfo(p = store.state.player) {
  if (p.birthInfo) return p.birthInfo;
  const b = birthdayOf(p);
  const parents = (p.npcIds ?? []).map((id) => store.state.npcs[id]).filter((n) => n?.role === 'parent' && !n.flags?.step).slice(0, 2);
  p.birthInfo = makeBirthInfo(p, { date: isoDate(p.birthYear, b.m, b.d), countryId: p.birthCountryId ?? p.countryId, city: p.birthCity ?? p.city, parents });
  return p.birthInfo;
}

/** A day during the year just lived, for a child born in it: never after the player's birthday that ended it. */
export function dayInYearJustLived(id, state = store.state) {
  const b = birthdayOf(state.player);
  const start = Date.parse(`${isoDate(state.year - 1, b.m, b.d)}T12:00:00Z`);
  const end = Date.parse(`${isoDate(state.year, b.m, b.d)}T12:00:00Z`);
  const days = Math.max(1, Math.round((end - start) / 864e5));
  return new Date(start + seeded(`day:${id}`).int(0, days - 1) * 864e5).toISOString().slice(0, 10);
}

export { starSign, birthdayFor };

// ---------- The back of the tag: a keepsake, filled in by the nurses ----------

const BIRTHSTONES = [['Garnet', '❤️'], ['Amethyst', '💜'], ['Aquamarine', '🩵'], ['Diamond', '💎'], ['Emerald', '💚'], ['Pearl', '🤍'],
  ['Ruby', '❤️'], ['Peridot', '💚'], ['Sapphire', '💙'], ['Opal', '🤍'], ['Topaz', '🧡'], ['Turquoise', '🩵']];
const FLOWERS = [['Carnation', '🌸'], ['Violet', '🪻'], ['Daffodil', '🌼'], ['Daisy', '🌼'], ['Lily of the Valley', '🤍'], ['Rose', '🌹'],
  ['Larkspur', '🪻'], ['Poppy', '🌺'], ['Aster', '🪻'], ['Marigold', '🌼'], ['Chrysanthemum', '🌼'], ['Holly', '🌿']];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** How a day of each season was, for the line about the day. */
const SKY = { winter: ['a frosty', 'a cold', 'a gray'], spring: ['a breezy', 'a bright', 'a showery'], summer: ['a sunny', 'a warm', 'a golden'],
  fall: ['a crisp', 'a windy', 'a leafy'], wet: ['a rainy', 'a stormy'], dry: ['a sunny', 'a dusty'], monsoon: ['a rainy', 'a pouring'],
  after: ['a fresh', 'a green'], hot: ['a scorching', 'a sweltering'], cool: ['a cool', 'a mild'], mild: ['a mild', 'a soft'] };
const STAMPS = ['Certified Cutie', '100% Snuggly', 'Ten Fingers · Ten Toes', 'Extra Cuddly', 'Head Nurse Approved', 'Brand New', 'Handle With Love', 'Officially Adorable'];
/** What the nurses noticed, by what the baby was born with: the strongest gift speaks first. */
const NOTES = {
  music: ['Hums along to the monitors!', 'Already keeping time with one foot'],
  singing: ['A set of lungs on this one!', 'Sang the whole ward awake'],
  dance: ['Wiggled all night long', 'Never stops moving those feet'],
  sports: ['Kicked their way into the world!', 'The strongest grip in the nursery'],
  acting: ['Quite the little drama star', 'Pulls faces for every visitor'],
  intellect: ['Looks around like they are taking notes', 'Wide awake and curious about everything'],
  charm: ['Already charming the whole ward', 'Smiles at anyone who comes near'],
  calm: ['Slept through absolutely everything', 'The calmest baby on the floor'],
};

/** "Tuesday": the day of the week of a date. */
export const weekdayOf = (date) => WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];

/**
 * The back of a tag: the day, the birthstone and flower of the month, a note from the nurses, who the baby takes
 * after, a stamp and the sign-off. `parents` are the two people the baby was born to, where known.
 */
export function keepsake(person, parents = [], seasonOf = () => null, snowy = false) {
  const info = person.birthInfo;
  const r = seeded(`keepsake:${person.id}`);
  const month = Number(info.date.slice(5, 7)) - 1;
  const season = seasonOf(month);
  const sky = season === 'winter' && snowy ? 'a snowy' : r.pick(SKY[season] ?? ['a lovely']);
  const t = person.talents ?? {};
  const best = Object.entries({ music: t.music, singing: t.singing, dance: t.dance, sports: t.sports, acting: t.acting })
    .filter(([, v]) => v != null).sort((a, b) => b[1] - a[1])[0];
  const stats = person.stats ?? person.meters ?? {};
  const kind = best && best[1] >= 55 ? best[0] : (stats.intellect ?? 0) >= 70 ? 'intellect' : (stats.charm ?? 0) >= 70 ? 'charm' : 'calm';
  return {
    day: `Born on ${sky} ${weekdayOf(info.date)}`,
    stone: BIRTHSTONES[month], flower: FLOWERS[month],
    note: r.pick(NOTES[kind]),
    looks: takesAfter(person, parents, r),
    stamp: r.pick(STAMPS), stampTilt: r.int(-12, 8),
    signoff: info.atHome ? `With love, ${info.doctor.replace(/, midwife$/, '')}` : `With love, the nurses of Ward ${r.int(2, 9)}`,
    bracelet: `#${String(r.int(1, 99)).padStart(2, '0')}-${String(r.int(1000, 9999))}`,
    bars: Array.from({ length: 14 }, () => r.int(1, 3)),
  };
}

/** "Has Mom's nose & Dad's eyes": the features a baby was born with that match a parent's. */
function takesAfter(person, parents, r) {
  const mine = person.appearance?.inherited;
  const known = parents.filter((x) => x?.appearance?.inherited);
  if (!mine || !known.length) return null;
  const WORDS = { eyes: 'eyes', eyeColor: 'eye color', nose: 'nose', lips: 'smile', brows: 'eyebrows', hairColor: 'hair', head: 'face shape' };
  // Mom and Dad where one of each; otherwise their names.
  const genders = known.map((x) => x.gender);
  const call = (x) => (known.length === 2 && genders.includes('female') && genders.includes('male') ? (x.gender === 'female' ? 'Mom' : 'Dad') : x.firstName);
  const found = [];
  for (const x of known) {
    const theirs = x.appearance.inherited;
    const same = Object.keys(WORDS).filter((k) => theirs[k] && theirs[k] === mine[k] && !found.some((f) => f.key === k));
    if (same.length) { const key = same[r.int(0, same.length - 1)]; found.push({ key, who: call(x) }); }
  }
  if (!found.length) return 'Looks like nobody else: all their own!';
  return `Has ${found.map((f) => `${f.who}'s ${WORDS[f.key]}`).join(' & ')}`;
}
