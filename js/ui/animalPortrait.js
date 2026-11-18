// Portraits of the family's animals, drawn from what the record says each one
// looks like: species, coat, pattern, eyes, ears, coat length. The same animal
// is drawn the same way all its life; only the muzzle greys with age.
// A species with no drawing of its own gets a plain paw: no likeness is claimed.
import { COAT_COLOURS, EYE_COLOURS } from '../data/animals.js';
import { esc } from '../util.js';

const hex = (name, fallback = '#8d8c8a') => COAT_COLOURS[name] ?? fallback;
function shade(colour, by) {
  const n = parseInt(colour.slice(1), 16);
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * (1 + by))));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}
const eye = (x, y, colour, r = 3.1, slit = false) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${colour}"/>`
  + (slit ? `<ellipse cx="${x}" cy="${y}" rx="${r * 0.3}" ry="${r * 0.85}" fill="#151210"/>` : `<circle cx="${x}" cy="${y}" r="${r * 0.55}" fill="#151210"/>`)
  + `<circle cx="${x - r * 0.3}" cy="${y - r * 0.35}" r="${r * 0.22}" fill="#fff" opacity=".9"/>`;

function dog(ap, c1, c2, dark, eyes, old) {
  const ears = { drop: `<path d="M17 17C8 18 6 31 10 41c4 3 9-1 10-8z" fill="${dark}"/><path d="M47 17c9 1 11 14 7 24-4 3-9-1-10-8z" fill="${dark}"/>`,
    up: `<path d="M16 24 13 5l14 9z" fill="${dark}"/><path d="M48 24 51 5 37 14z" fill="${dark}"/>`,
    half: `<path d="M16 24 12 8l15 6z" fill="${dark}"/><path d="M12 8l9 1-4 7z" fill="${shade(dark, -0.2)}"/><path d="M48 24 52 8 37 14z" fill="${dark}"/><path d="M52 8l-9 1 4 7z" fill="${shade(dark, -0.2)}"/>`,
    tuft: '' }[ap.ears] ?? '';
  const fluff = ap.length === 'long' ? `<circle cx="14" cy="38" r="6" fill="${c1}"/><circle cx="50" cy="38" r="6" fill="${c1}"/><circle cx="19" cy="46" r="5" fill="${c1}"/><circle cx="45" cy="46" r="5" fill="${c1}"/>` : '';
  const mark = { patched: `<path d="M33 14c9 0 15 6 15 14 0 5-5 7-9 5-4-2-7-9-6-19z" fill="${c2}"/>`,
    blaze: `<path d="M29 13h6l2 20h-10z" fill="${c2}"/>`,
    saddle: `<path d="M14 26c0-9 8-14 18-14s18 5 18 14c-5-4-11-5-18-5s-13 1-18 5z" fill="${shade(c1, -0.45)}"/>`,
    socks: '' }[ap.pattern] ?? '';
  const muzzle = ap.pattern === 'socks' || ap.pattern === 'blaze' || ap.pattern === 'saddle' ? c2 ?? shade(c1, 0.35) : shade(c1, 0.22);
  return `${ap.ears === 'drop' ? '' : ears}${fluff}<ellipse cx="32" cy="32" rx="18" ry="19" fill="${c1}"/>${mark}${ap.ears === 'drop' ? ears : ''}
    <ellipse cx="32" cy="42" rx="10.5" ry="8.5" fill="${muzzle}"/>${old ? '<ellipse cx="32" cy="42" rx="10.5" ry="8.5" fill="#fff" opacity=".45"/>' : ''}
    ${eye(24.5, 30, eyes)}${eye(39.5, 30, eyes)}
    <ellipse cx="32" cy="38.5" rx="4" ry="3" fill="#1c1917"/><path d="M32 41.5v3.5m0 0c-2 2.5-5 2.5-6.5.5m6.5-.5c2 2.5 5 2.5 6.5.5" stroke="#1c1917" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
}

function cat(ap, c1, c2, dark, eyes, old) {
  const pointed = ap.pattern === 'pointed';
  const earFill = pointed ? '#4a3a30' : dark;
  const tuft = ap.ears === 'tuft' ? `<path d="M16 6l-2-4m36 4 2-4" stroke="${earFill}" stroke-width="1.6" stroke-linecap="round"/>` : '';
  const mark = { tabby: `<path d="M32 13v9m-6-8 1.5 8m10.500-8-1.500 8M13 34h6m-5 5 5-1m32-4h-6m5 5-5-1" stroke="${shade(c1, -0.5)}" stroke-width="1.7" stroke-linecap="round" fill="none"/>`,
    bicolour: `<path d="M32 27c7 5 14 9 17 13-2 7-9 11-17 11s-15-4-17-11c3-4 10-8 17-13z" fill="${c2 ?? '#f1ede4'}"/>`,
    tortoiseshell: `<path d="M15 26c2-8 9-12 15-12-2 7-6 12-15 12z" fill="#d98a3d"/><path d="M36 15c7 1 12 6 13 13-7 0-11-5-13-13z" fill="#2b2724"/><path d="M22 44c3-3 7-3 9 0-2 4-7 4-9 0z" fill="#d98a3d"/>`,
    calico: `<path d="M32 27c7 5 14 9 17 13-2 7-9 11-17 11s-15-4-17-11c3-4 10-8 17-13z" fill="#f1ede4"/><path d="M15 26c2-8 9-12 15-12-2 7-6 12-15 12z" fill="#d98a3d"/><path d="M36 15c7 1 12 6 13 13-7 0-11-5-13-13z" fill="#2b2724"/>`,
    pointed: '<ellipse cx="32" cy="38" rx="9" ry="8" fill="#4a3a30" opacity=".8"/>' }[ap.pattern] ?? '';
  const fluff = ap.length === 'long' ? `<path d="M13 36l-6 3 5 2-4 4 7 0zm38 0 6 3-5 2 4 4-7 0z" fill="${c1}"/>` : '';
  return `<path d="M15 26 12 6l15 9z" fill="${earFill}"/><path d="M49 26 52 6 37 15z" fill="${earFill}"/><path d="M16 21 15 11l7 5zm32 0 1-10-7 5z" fill="#e8a9a0" opacity=".85"/>${tuft}${fluff}
    <ellipse cx="32" cy="33" rx="19" ry="17.5" fill="${c1}"/>${mark}${old ? '<ellipse cx="32" cy="41" rx="8" ry="6" fill="#fff" opacity=".35"/>' : ''}
    ${eye(24, 31, eyes, 3.6, true)}${eye(40, 31, eyes, 3.6, true)}
    <path d="M30 38.500h4l-2 2.500z" fill="#d98a8a"/><path d="M32 41v2m0 0c-1.500 2-4 2-5 .5m5-.5c1.500 2 4 2 5 .5" stroke="#3a302a" stroke-width="1.100" fill="none" stroke-linecap="round"/>
    <path d="M22 41 10 39m12 4-12 2m32-4 12-2m-12 4 12 2" stroke="${shade(c1, c1 === '#f1ede4' ? -0.35 : 0.6)}" stroke-width=".8" stroke-linecap="round" opacity=".8"/>`;
}

function rabbit(ap, c1, c2, dark, eyes, old) {
  const ears = ap.ears === 'drop'
    ? `<path d="M18 22C8 22 5 36 9 48c4 3 8 0 9-6z" fill="${dark}"/><path d="M46 22c10 0 13 14 9 26-4 3-8 0-9-6z" fill="${dark}"/>`
    : `<path d="M22 24C17 14 18 3 23 1c5 2 7 12 5 23z" fill="${dark}"/><path d="M42 24c5-10 4-21-1-23-5 2-7 12-5 23z" fill="${dark}"/><path d="M23.500 20c-2-7-2-13 0-15 2 2 3 8 2 15zm17 0c2-7 2-13 0-15-2 2-3 8-2 15z" fill="#e8a9a0" opacity=".8"/>`;
  const mark = ap.pattern === 'patched' ? `<path d="M34 20c8 0 12 5 12 11-5 2-12-2-12-11z" fill="${c2}"/>` : ap.pattern === 'blaze' ? `<path d="M29.500 19h5l1.500 15h-8z" fill="${c2}"/>` : '';
  return `${ears}<ellipse cx="32" cy="37" rx="17" ry="16" fill="${c1}"/>${mark}<ellipse cx="32" cy="45" rx="8" ry="6" fill="${shade(c1, 0.25)}"/>${old ? '<ellipse cx="32" cy="45" rx="8" ry="6" fill="#fff" opacity=".4"/>' : ''}
    ${eye(23.500, 35, eyes, 3)}${eye(40.500, 35, eyes, 3)}<path d="M30 42h4l-2 2.200z" fill="#d98a8a"/><path d="M32 44.200v2.300m-3 1.500c1.500-1.500 4.500-1.500 6 0" stroke="#3a302a" stroke-width="1.100" fill="none" stroke-linecap="round"/>`;
}

function parrot(ap, c1, c2, dark, eyes) {
  return `<path d="M32 6c-3-4-9-3-10 1 4 0 7 2 8 5z" fill="${dark}"/><ellipse cx="31" cy="33" rx="18" ry="20" fill="${c1}"/>
    ${ap.pattern === 'blaze' ? `<path d="M17 24c3-8 9-11 15-11 5 0 10 3 12 8-9-3-19-2-27 3z" fill="${c2}"/>` : ''}
    <ellipse cx="37" cy="29" rx="7" ry="6.500" fill="#f4efe6"/>${eye(38, 29, eyes, 2.600)}
    <path d="M44 32c8 1 11 7 8 15-2 5-7 6-9 3 3-2 4-6 2-9z" fill="#3b3631"/><path d="M43 34c4 1 6 4 5 8-3 0-5-3-5-8z" fill="#57504a"/>
    <path d="M18 44c3 4 8 6 13 6" stroke="${dark}" stroke-width="1.500" fill="none" stroke-linecap="round" opacity=".6"/>`;
}

function hamster(ap, c1, c2, dark, eyes, old) {
  return `<circle cx="17" cy="17" r="6.500" fill="${dark}"/><circle cx="47" cy="17" r="6.500" fill="${dark}"/><circle cx="17" cy="17" r="3.500" fill="#e8a9a0"/><circle cx="47" cy="17" r="3.500" fill="#e8a9a0"/>
    <ellipse cx="32" cy="35" rx="21" ry="18" fill="${c1}"/>${ap.pattern === 'patched' ? `<path d="M14 30c2-8 9-13 18-13-1 9-7 14-18 13z" fill="${c2}"/>` : ''}
    <ellipse cx="21" cy="42" rx="9" ry="7" fill="#f6efe2"/><ellipse cx="43" cy="42" rx="9" ry="7" fill="#f6efe2"/>${old ? '<ellipse cx="32" cy="42" rx="14" ry="6" fill="#fff" opacity=".3"/>' : ''}
    ${eye(24.500, 31, eyes, 2.600)}${eye(39.500, 31, eyes, 2.600)}<ellipse cx="32" cy="38" rx="2.200" ry="1.700" fill="#d98a8a"/><path d="M32 39.700v2.300" stroke="#3a302a" stroke-width="1.100" stroke-linecap="round"/>`;
}

function horse(ap, c1, c2, dark, eyes, old, kind) {
  const mane = shade(c1, c1 === '#f1ede4' || c1 === '#e9d8b4' ? -0.25 : -0.5);
  const long = kind === 'donkey';
  const ears = long ? `<path d="M22 18C17 8 18 0 22-2c4 3 5 11 4 20z" fill="${dark}"/><path d="M40 18c5-10 4-18 0-20-4 3-5 11-4 20z" fill="${dark}"/>`
    : `<path d="M22 17 20 4l8 9z" fill="${dark}"/><path d="M41 17 43 4l-8 9z" fill="${dark}"/>`;
  const blaze = ap.pattern === 'blaze' || ap.pattern === 'socks' ? `<path d="M29 16h5l2.500 26-5 6-5-6z" fill="${c2}"/>` : ap.pattern === 'patched' ? `<path d="M33 16c7 2 9 10 8 18-6-2-9-9-8-18z" fill="${c2}"/>` : '';
  return `<path d="M21 16c-7 4-9 16-6 30l5 2c0-10 1-22 5-30z" fill="${mane}"/>${ears}
    <path d="M20 22c0-7 5-11 11.500-11S43 15 43 22c0 9 2 15 2 22 0 8-6 13-13.500 13S18 52 18 44c0-7 2-13 2-22z" fill="${c1}"/>${blaze}
    <path d="M26 12c2-4 9-4 11 0-1 5-3 8-5.500 9-2.500-1-4.500-4-5.500-9z" fill="${mane}"/>
    <ellipse cx="31.500" cy="48" rx="11" ry="8.500" fill="${long ? '#e9e2d4' : shade(c1, -0.18)}"/>${old ? '<ellipse cx="31.500" cy="48" rx="11" ry="8.500" fill="#fff" opacity=".35"/>' : ''}
    ${eye(22.500, 28, eyes, 2.700)}${eye(40.500, 28, eyes, 2.700)}
    <ellipse cx="27" cy="49" rx="1.700" ry="2.400" fill="#2a2420"/><ellipse cx="36" cy="49" rx="1.700" ry="2.400" fill="#2a2420"/>`;
}
function fish(ap, c1, c2) {
  return `<path d="M50 32 62 20v24z" fill="${shade(c1, -0.2)}"/><path d="M28 18c4-7 12-8 16-4-4 1-8 4-10 8z" fill="${shade(c1, -0.2)}"/>
    <ellipse cx="30" cy="32" rx="23" ry="14" fill="${c1}"/>${ap.pattern === 'patched' ? `<path d="M30 19c8 1 14 6 16 13-8 2-15-3-16-13z" fill="${c2}"/>` : ''}
    <path d="M24 32c5 4 5 9 0 12" stroke="${shade(c1, -0.3)}" stroke-width="1.500" fill="none"/><circle cx="15" cy="29" r="3.600" fill="#fff"/><circle cx="14.500" cy="29" r="1.900" fill="#151210"/>
    <circle cx="6" cy="20" r="1.500" fill="none" stroke="#9cc3d6" stroke-width="1"/><circle cx="10" cy="13" r="2.200" fill="none" stroke="#9cc3d6" stroke-width="1"/>`;
}
function fowl(ap, c1, c2, dark, eyes, old, kind) {
  const duck = kind === 'duck';
  return `${duck ? '' : '<path d="M27 12c0-5 4-6 5-2 1-5 6-5 6 0 3-3 6 0 4 4l-13 2z" fill="#c8382c"/>'}
    <ellipse cx="32" cy="34" rx="17" ry="19" fill="${c1}"/>${ap.pattern === 'patched' ? `<path d="M20 44c6-6 18-6 24 0-4 6-20 6-24 0z" fill="${c2}"/>` : ''}
    ${eye(25, 29, eyes, 2.400)}${eye(39, 29, eyes, 2.400)}
    ${duck ? '<path d="M22 36c3-3 17-3 20 0 0 5-5 7-10 7s-10-2-10-7z" fill="#e3a235"/>' : '<path d="M27 34h10l-5 8z" fill="#e3a235"/><path d="M29 44c0 4 2 6 3 6s3-2 3-6z" fill="#c8382c"/>'}`;
}
function goat(ap, c1, c2, dark, eyes, old) {
  return `<path d="M24 16C20 8 21 2 25 1c1 5 2 10 4 14z" fill="#8b8172"/><path d="M40 16c4-8 3-14-1-15-1 5-2 10-4 14z" fill="#8b8172"/>
    <path d="M17 22 5 20c1 6 6 9 13 8z" fill="${dark}"/><path d="M47 22l12-2c-1 6-6 9-13 8z" fill="${dark}"/>
    <path d="M19 24c0-7 6-11 13-11s13 4 13 11c0 8-3 13-4 19-1 6-4 9-9 9s-8-3-9-9c-1-6-4-11-4-19z" fill="${c1}"/>${ap.pattern === 'patched' ? `<path d="M32 13c7 0 12 4 13 10-7 1-12-3-13-10z" fill="${c2}"/>` : ''}
    <ellipse cx="32" cy="44" rx="7.500" ry="6" fill="${shade(c1, 0.22)}"/>${old ? '<ellipse cx="32" cy="44" rx="7.500" ry="6" fill="#fff" opacity=".35"/>' : ''}<path d="M29 51c1 6 2 8 3 9 1-1 2-3 3-9z" fill="${shade(c1, 0.3)}"/>
    <ellipse cx="24" cy="29" rx="3" ry="2.400" fill="${eyes}"/><rect x="22" y="28.300" width="4" height="1.400" rx=".7" fill="#151210"/><ellipse cx="40" cy="29" rx="3" ry="2.400" fill="${eyes}"/><rect x="38" y="28.300" width="4" height="1.400" rx=".7" fill="#151210"/>
    <path d="M30 43h4l-2 2z" fill="#3a302a"/>`;
}
function sheep(ap, c1, c2, dark, eyes) {
  const face = c1 === '#f1ede4' || c1 === '#e9d8b4' ? '#3b3632' : shade(c1, -0.35);
  const wool = [[18, 22], [26, 14], [38, 14], [46, 22], [50, 34], [14, 34], [20, 46], [44, 46], [32, 11]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${c1}"/>`).join('');
  return `${wool}<path d="M17 30 8 32c2 5 6 6 10 4z" fill="${face}"/><path d="M47 30l9 2c-2 5-6 6-10 4z" fill="${face}"/>
    <path d="M21 30c0-6 5-9 11-9s11 3 11 9c0 7-2 12-3 16-1 5-4 7-8 7s-7-2-8-7c-1-4-3-9-3-16z" fill="${face}"/>
    <circle cx="25.500" cy="33" r="2.600" fill="#f4efe6"/><circle cx="25.500" cy="33" r="1.400" fill="#151210"/><circle cx="38.500" cy="33" r="2.600" fill="#f4efe6"/><circle cx="38.500" cy="33" r="1.400" fill="#151210"/>
    <path d="M30 45h4l-2 2.200zm2 2.200v2.300" fill="#e8a9a0" stroke="#e8a9a0" stroke-width="1"/>`;
}
function ferret(ap, c1, c2, dark, eyes, old) {
  return `<circle cx="18" cy="18" r="6" fill="${dark}"/><circle cx="46" cy="18" r="6" fill="${dark}"/><circle cx="18" cy="18" r="3" fill="#e8a9a0"/><circle cx="46" cy="18" r="3" fill="#e8a9a0"/>
    <path d="M14 30c0-10 8-16 18-16s18 6 18 16c0 12-8 22-18 22S14 42 14 30z" fill="${c1}"/><path d="M16 27c6-4 26-4 32 0-1 6-7 9-16 9s-15-3-16-9z" fill="#3b2f27" opacity=".75"/>
    <ellipse cx="32" cy="43" rx="8" ry="7" fill="#f4efe6"/>${old ? '<ellipse cx="32" cy="43" rx="8" ry="7" fill="#fff" opacity=".4"/>' : ''}
    ${eye(24.500, 30, eyes, 2.400)}${eye(39.500, 30, eyes, 2.400)}<ellipse cx="32" cy="40" rx="2.400" ry="1.800" fill="#d98a8a"/><path d="M32 41.800v2.200" stroke="#3a302a" stroke-width="1.100" stroke-linecap="round"/>`;
}
function lizard(ap, c1, c2, dark, eyes, old, kind) {
  const beard = kind === 'bearded_dragon' ? `<path d="M14 40 9 44l7 1-4 5 8-1-1 6 7-4 2 6 4-6 3 6 3-6 3 5 2-6 6 4-1-6 8 1-4-5 7-1-5-4z" fill="${dark}"/>` : '';
  const spots = ap.pattern === 'patched' ? [[24, 22], [38, 20], [31, 30], [20, 32], [42, 31]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.400" fill="${shade(c1, -0.45)}"/>`).join('') : '';
  return `${beard}<path d="M10 34c0-13 10-22 22-22s22 9 22 22c0 6-5 10-22 10S10 40 10 34z" fill="${c1}"/>${spots}
    <path d="M14 38c6 3 30 3 36 0" stroke="${shade(c1, -0.3)}" stroke-width="1.400" fill="none" stroke-linecap="round"/>
    ${eye(21, 27, eyes, 3.600, true)}${eye(43, 27, eyes, 3.600, true)}<circle cx="29" cy="35" r=".9" fill="#2a2420"/><circle cx="35" cy="35" r=".9" fill="#2a2420"/>`;
}
function snake(ap, c1, c2, dark, eyes) {
  const band = ap.pattern !== 'solid' ? `<path d="M12 46c6-4 10-4 14 0M38 46c6-4 10-4 14 0M24 20c4-3 12-3 16 0" stroke="${c2}" stroke-width="4" fill="none" stroke-linecap="round"/>` : '';
  return `<path d="M6 52c8-10 22-10 26-2s18 8 26-2" stroke="${c1}" stroke-width="12" fill="none" stroke-linecap="round"/>${band}
    <ellipse cx="32" cy="26" rx="15" ry="11" fill="${c1}"/><path d="M22 20c4-3 16-3 20 0" stroke="${shade(c1, -0.3)}" stroke-width="1.500" fill="none"/>
    ${eye(26, 25, eyes, 2.600, true)}${eye(38, 25, eyes, 2.600, true)}<path d="M32 36v4m0 0-2 3m2-3 2 3" stroke="#c8382c" stroke-width="1.200" fill="none" stroke-linecap="round"/>`;
}
function tortoise(ap, c1, c2, dark, eyes, old) {
  const shell = shade(c1, -0.25);
  const plates = [[32, 38], [22, 42], [42, 42], [27, 48], [37, 48]].map(([x, y]) => `<path d="M${x - 5} ${y}l5-4 5 4-2 5h-6z" fill="${shade(c1, 0.15)}" stroke="${shade(c1, -0.5)}" stroke-width=".8"/>`).join('');
  return `<ellipse cx="32" cy="46" rx="22" ry="14" fill="${shell}"/>${plates}
    <path d="M24 30c0-9 4-15 8-15s8 6 8 15c0 3-4 5-8 5s-8-2-8-5z" fill="#9a8f6e"/>${old ? '<path d="M24 30c0-9 4-15 8-15s8 6 8 15" fill="#fff" opacity=".2"/>' : ''}
    <circle cx="28.500" cy="23" r="1.800" fill="#151210"/><circle cx="35.500" cy="23" r="1.800" fill="#151210"/><path d="M29 29c2 1.500 4 1.500 6 0" stroke="#3a302a" stroke-width="1.100" fill="none" stroke-linecap="round"/>`;
}
const as = (fn, kind) => (...args) => fn(...args, kind);
const DRAW = { dog, cat, rabbit, parrot, hamster, guinea_pig: hamster, rat: hamster, budgie: parrot, ferret, fish, horse: as(horse, 'horse'), pony: as(horse, 'pony'), donkey: as(horse, 'donkey'),
  chicken: as(fowl, 'chicken'), duck: as(fowl, 'duck'), goat, sheep, mouse: hamster,
  leopard_gecko: as(lizard, 'gecko'), bearded_dragon: as(lizard, 'bearded_dragon'), corn_snake: snake, tortoise };
const SCALE = { small: 0.86, medium: 0.94, large: 1 };

/**
 * @param {object} animal  a record from engine/animals.js
 * @param {{senior?:boolean}} [o]
 * @returns {string} inline SVG, or a paw where the species has no drawing
 */
export function animalPortraitSvg(animal, o = {}) {
  const draw = DRAW[animal.speciesId];
  const label = `${animal.name}, ${animal.speciesId}`;
  if (!draw) return `<span role="img" aria-label="${esc(label)}">🐾</span>`;
  const ap = animal.appearance;
  const c1 = hex(ap.coat);
  const c2 = ap.second ? hex(ap.second, '#f1ede4') : shade(c1, 0.4);
  const k = SCALE[ap.size] ?? 0.94;
  const body = draw(ap, c1, c2, shade(c1, -0.22), EYE_COLOURS[ap.eyes] ?? '#5a3b22', !!o.senior);
  return `<svg viewBox="0 0 64 64" role="img" aria-label="${esc(label)}"><g transform="translate(${32 - 32 * k} ${34 - 32 * k}) scale(${k})">${body}</g></svg>`;
}
