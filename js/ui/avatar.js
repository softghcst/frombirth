// Procedural portrait. Changes with age, gender, appearance, mood and
// incarceration. NPCs without stored appearance get one derived from their id.
export const SKIN = ['#f6d7c0', '#eec3a2', '#d9a47c', '#b97f56', '#8f5b3a', '#5f3b26'];
export const HAIR = ['#2a211b', '#5a3a22', '#8a5a2b', '#c99b4f', '#a2422b'];
export const EYES = ['#4a3323', '#33608f', '#4d7240', '#7a6233'];
export const HAIR_STYLE_NAMES = ['Short', 'Fringe', 'Long'];
const SHIRT = ['#4f7f9e', '#8a5f8f', '#5d8a61', '#b5694a', '#56627a', '#a68a3d'];
const PET_GLYPH = { dog: '🐕', cat: '🐈', rabbit: '🐇', parrot: '🦜', hamster: '🐹' };

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function appearanceFromSeed(seed) {
  const h = hash(String(seed));
  return { skin: h % 6, hair: (h >>> 3) % 5, hairStyle: (h >>> 6) % 3, eyes: (h >>> 9) % 4 };
}

export const petGlyph = (species) => PET_GLYPH[species] ?? '🐾';

/**
 * @param {{age:number, gender:string, appearance?:object, seed?:string, jailed?:boolean, mood?:number}} o
 * @returns {string} inline SVG markup
 */
export function avatarSvg(o) {
  const a = o.appearance ?? appearanceFromSeed(o.seed ?? 'x');
  const age = o.age;
  const baby = age < 3;
  const child = age < 13;
  const skin = SKIN[a.skin % SKIN.length];
  const hair = age >= 75 ? '#ebe8e1' : age >= 60 ? '#a9a59d' : HAIR[a.hair % HAIR.length];
  const r = baby ? 17 : child ? 15 : 14;
  const cy = baby ? 31 : 27;
  const long = !baby && (o.gender === 'female' ? a.hairStyle !== 0 : a.hairStyle === 2 && age < 45);
  const balding = !baby && o.gender === 'male' && age >= 55 && a.hairStyle !== 2;
  const shirt = o.jailed ? '#e07b2a' : baby ? '#f1d59c' : SHIRT[(a.eyes + a.hair + a.skin) % SHIRT.length];
  const parts = [];

  if (long) parts.push(`<ellipse cx="32" cy="${cy + 7}" rx="${r + 3}" ry="${r + 9}" fill="${hair}"/>`);
  parts.push(`<path d="M6 66c0-14 11-21 26-21s26 7 26 21z" fill="${shirt}"/>`);
  if (o.jailed) {
    parts.push('<path d="M14 52h36M10 58h44M8 64h48" stroke="#2a211b" stroke-width="2.5" opacity=".55"/>');
  }
  parts.push(`<rect x="27.5" y="${cy + r - 4}" width="9" height="9" rx="3" fill="${skin}"/>`);
  parts.push(`<circle cx="32" cy="${cy}" r="${r}" fill="${skin}"/>`);

  // Hair
  const top = cy - r;
  if (baby) {
    parts.push(`<path d="M30 ${top + 1}q2-6 5-1" stroke="${hair}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`);
  } else if (balding) {
    parts.push(`<circle cx="${32 - r + 1}" cy="${cy - 2}" r="3.5" fill="${hair}"/><circle cx="${32 + r - 1}" cy="${cy - 2}" r="3.5" fill="${hair}"/>`);
  } else {
    const fringe = a.hairStyle === 1 ? cy - r * 0.35 : cy - r * 0.6;
    parts.push(`<path d="M${31 - r} ${cy - 2}A${r + 1} ${r + 1} 0 0 1 ${33 + r} ${cy - 2}Q32 ${fringe} ${31 - r} ${cy - 2}z" fill="${hair}"/>`);
  }

  // Face
  const mood = o.mood ?? 60;
  const curve = mood >= 60 ? 3.5 : mood >= 35 ? 1 : -2.5;
  const eyeY = cy + 1.5;
  const eye = EYES[a.eyes % EYES.length];
  parts.push(`<circle cx="27" cy="${eyeY}" r="2" fill="${eye}"/><circle cx="37" cy="${eyeY}" r="2" fill="${eye}"/>`);
  if (age >= 65 && a.eyes % 2 === 0) {
    parts.push(`<g fill="none" stroke="#2a211b" stroke-width="1"><circle cx="27" cy="${eyeY}" r="3.6"/><circle cx="37" cy="${eyeY}" r="3.6"/><path d="M30.6 ${eyeY}h2.8"/></g>`);
  }
  if (age >= 50) {
    parts.push(`<path d="M25 ${cy - 6}h4M35 ${cy - 6}h4" stroke="#2a211b" stroke-width=".8" opacity=".35"/>`);
  }
  parts.push(`<path d="M27.5 ${cy + 7.5}Q32 ${cy + 7.5 + curve} 36.5 ${cy + 7.5}" stroke="#2a211b" stroke-width="1.5" fill="none" stroke-linecap="round"/>`);
  if (baby) parts.push(`<circle cx="23" cy="${cy + 5}" r="2.6" fill="#e58f7f" opacity=".45"/><circle cx="41" cy="${cy + 5}" r="2.6" fill="#e58f7f" opacity=".45"/>`);

  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${parts.join('')}</svg>`;
}
