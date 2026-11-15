// The portrait renderer. One function draws every portrait in the game: the
// header, the People tab, the title screen, the creator and the salon.
//
// Everything is drawn on one shared face template, 100 by 100 units:
//   skull top y=17 · brows y=37.5 · eyes at (38,47) and (62,47)
//   nose tip (50,58) · mouth (50,67) · ears x=25 / x=75 · chin about y=79
// Parts are layered in this order: hair behind, shoulders, neck, ears, face,
// eyes, brows, nose, marks, beard, lips, lines of age, hair in front, glasses.
import { normalize, part, hash } from './catalog.js';

const EYE_Y = 47;
const EYE_X = 12.5; // distance of each eye from the centre line
const BROW_Y = 35.8;
// Features are drawn a little larger than life so they read at menu size.
const FEATURE = 1.28;
const SHIRTS = ['#4f7f9e', '#8a5f8f', '#5d8a61', '#b5694a', '#56627a', '#a68a3d', '#3f6b6b', '#9c4f5f'];
const INK = '#2a1d18';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** Mixes two colours: t=0 gives a, t=1 gives b. */
export function mix(a, b, t) {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

let uid = 0;

/** One layer of hair shapes (see parts/hair.js for the shape kinds). */
function hairLayer(shapes, colour, shade) {
  return shapes.map((s) => {
    if (s.d) return `<path d="${s.d}" fill="${colour}"/>`;
    if (s.c) return `<circle cx="${s.c[0]}" cy="${s.c[1]}" r="${s.c[2]}" fill="${colour}"/>`;
    const strand = `<path d="${s.s}" stroke="${colour}" stroke-width="${s.w}" stroke-linecap="round" fill="none"/>`;
    return s.segments ? `${strand}<path d="${s.s}" stroke="${shade}" stroke-width="${s.w}" stroke-dasharray="0.9 4.1" fill="none" opacity=".7"/>` : strand;
  }).join('');
}

/** The mouth: the lip shape's measurements bent by the expression (smile from -1 to 1). */
function lipsSvg(lip, smile, upperCol, lowerCol, scale) {
  const w = lip.width * scale;
  const lipU = lip.upper * scale;
  const lipL = lip.lower * scale;
  const cy = 67;
  const xl = 50 - w;
  const xr = 50 + w;
  const yc = cy - smile * 2.1;
  const mid = cy + smile * 1.9 + 0.7;
  const peak = cy - lipU + smile * 0.3;
  const dip = peak + lip.bow * scale;
  const px = w * 0.3;
  const low = cy + lipL + smile * 0.9;
  const n = (v) => Math.round(v * 100) / 100;
  const upper = `M${n(xl)} ${n(yc)}Q${n(50 - w * 0.72)} ${n(yc - (yc - peak) * 0.3)} ${n(50 - px)} ${n(peak)}Q${n(50 - px * 0.4)} ${n(peak)} 50 ${n(dip)}`
    + `Q${n(50 + px * 0.4)} ${n(peak)} ${n(50 + px)} ${n(peak)}Q${n(50 + w * 0.72)} ${n(yc - (yc - peak) * 0.3)} ${n(xr)} ${n(yc)}Q50 ${n(mid)} ${n(xl)} ${n(yc)}Z`;
  const lower = `M${n(xl)} ${n(yc)}Q50 ${n(mid)} ${n(xr)} ${n(yc)}Q${n(50 + w * 0.6)} ${n(low)} 50 ${n(low)}Q${n(50 - w * 0.6)} ${n(low)} ${n(xl)} ${n(yc)}Z`;
  return `<path d="${lower}" fill="${lowerCol}"/><path d="${upper}" fill="${upperCol}"/>`
    + `<path d="M${n(xl)} ${n(yc)}Q50 ${n(mid)} ${n(xr)} ${n(yc)}" stroke="${INK}" stroke-width=".7" fill="none" stroke-linecap="round" opacity=".75"/>`;
}

/**
 * @param {{age:number, gender?:string, appearance?:object, seed?:string, jailed?:boolean, mood?:number}} o
 *   appearance may be any saved version, or missing; `seed` (the character's
 *   id) fills gaps the same way every time.
 * @returns {string} inline SVG markup
 */
export function avatarSvg(o) {
  const seed = String(o.seed ?? 'x');
  const a = normalize(o.appearance, seed);
  const g = a.inherited;
  const st = a.style;
  const age = o.age ?? 25;
  const baby = age < 2;
  const child = age < 13;
  const out = [];

  // Colours
  const skin = part('skin', g.skin).base;
  const shade = mix(skin, '#3a1c12', 0.22);
  const line = mix(skin, '#2a120c', 0.5);
  const grey = st.hairDye ? 0 : age >= 76 ? 0.92 : age >= 66 ? 0.7 : age >= 56 ? 0.35 : 0;
  const natural = part('hairColor', g.hairColor).hex;
  const hair = mix(st.hairDye ? part('hairDye', st.hairDye).hex : natural, '#e6e3dc', grey);
  const hairShade = mix(hair, '#000000', 0.3);
  const brow = mix(mix(natural, '#e6e3dc', grey * 0.8), '#1c1210', 0.25);
  const lipBase = mix(skin, '#a23f4c', part('skin', g.skin).depth >= 8 ? 0.34 : 0.44);
  const lipCol = st.lipColor && age >= 13 ? part('lipColor', st.lipColor).hex : lipBase;

  // Proportions by age: children have bigger heads and eyes on smaller shoulders.
  const head = baby ? 1.13 : age < 6 ? 1.09 : child ? 1.05 : age < 18 ? 1.02 : 1;
  const eyeK = FEATURE * (baby ? 1.2 : age < 6 ? 1.12 : child ? 1.06 : 1);
  const body = baby ? 0.7 : age < 6 ? 0.78 : child ? 0.86 : age < 18 ? 0.94 : 1;
  const face = part('face', g.face);
  const style = part('hair', st.hair);
  const showHair = !baby && style;

  // --- behind the head ---
  const headOpen = `<g transform="translate(50 54) scale(${head}) translate(-50 -54)">`;
  if (showHair && style.back.length) out.push(`${headOpen}${hairLayer(style.back, hair, hairShade)}</g>`);

  // --- shoulders and neck ---
  const shirt = o.jailed ? '#e07b2a' : baby ? '#f1d59c' : SHIRTS[hash(`${seed}:shirt`) % SHIRTS.length];
  out.push(`<g transform="translate(50 100) scale(${body} 1) translate(-50 -100)">`
    + `<path d="M8 101C8 87 25 83.5 40 80.5L60 80.5C75 83.5 92 87 92 101Z" fill="${shirt}"/>`
    + `<path d="M40 80.5Q50 88.5 60 80.5L58 79H42Z" fill="${mix(shirt, '#000000', 0.22)}"/>`
    + `${o.jailed ? `<path d="M22 88h56M15 94h70M11 99.5h78" stroke="${INK}" stroke-width="2.6" opacity=".5"/>` : ''}</g>`);
  out.push(`<path d="M42 68H58V81.5Q50 87 42 81.5Z" fill="${shade}"/>`);

  // --- the head ---
  out.push(headOpen);
  out.push(`<ellipse cx="25" cy="49" rx="3.7" ry="6" fill="${skin}"/><ellipse cx="75" cy="49" rx="3.7" ry="6" fill="${skin}"/>`
    + `<path d="M24.2 46.5Q22.8 49 24.4 51.8M75.8 46.5Q77.2 49 75.6 51.8" stroke="${line}" stroke-width=".7" fill="none" opacity=".6"/>`);
  out.push(`<path d="${face.d}" fill="${skin}"/>`);

  // cheeks
  const makeup = st.makeup && age >= 13 ? part('makeup', st.makeup) : null;
  const blush = makeup ? makeup.blush : baby ? 0.34 : child ? 0.2 : 0.12;
  out.push(`<ellipse cx="34.5" cy="59" rx="5.2" ry="3.4" fill="#e2726e" opacity="${blush}"/><ellipse cx="65.5" cy="59" rx="5.2" ry="3.4" fill="#e2726e" opacity="${blush}"/>`);

  // eyes
  const eye = part('eyeShape', g.eyeShape);
  const iris = part('eyeColor', g.eyeColor).hex;
  const [ix, iy, ir] = eye.iris;
  for (const side of [1, -1]) {
    const id = `av${++uid}`;
    out.push(`<g transform="translate(${50 + side * EYE_X} ${EYE_Y}) scale(${side * eyeK} ${eyeK})">`
      + `<clipPath id="${id}"><path d="${eye.white}"/></clipPath>`
      + `${makeup?.shadow ? `<path d="${eye.lash}" stroke="${makeup.shadow}" stroke-width="3.4" fill="none" opacity=".45" transform="translate(0 -1.4)"/>` : ''}`
      + `<path d="${eye.white}" fill="#fbf8f3"/>`
      + `<g clip-path="url(#${id})"><circle cx="${ix}" cy="${iy}" r="${ir}" fill="${iris}"/><circle cx="${ix}" cy="${iy}" r="${ir * 0.46}" fill="#15100d"/>`
      + `<circle cx="${ix + 1.1}" cy="${iy - 1.2}" r=".8" fill="#fff" opacity=".9"/></g>`
      + `${eye.fold ? `<path d="${eye.fold}" fill="${mix(skin, shade, 0.55)}"/>` : ''}`
      + `<path d="${eye.lash}${makeup?.liner ? 'l2.2-1.6' : ''}" stroke="${INK}" stroke-width="${makeup?.liner ? 1.7 : 1.15}" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  }

  // brows
  const b = part('brows', g.brows);
  for (const side of [1, -1]) {
    out.push(`<path d="${b.d}" transform="translate(${50 + side * EYE_X} ${BROW_Y - (eyeK - FEATURE) * 6}) scale(${side * 1.22} 1.22)" stroke="${brow}" `
      + `stroke-width="${baby ? b.weight * 0.6 : b.weight}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  }

  // nose
  const nose = part('nose', g.nose);
  const noseK = 1.15 * (baby ? 0.72 : child ? 0.86 : 1);
  out.push(`<g transform="translate(50 58) scale(${noseK}) translate(-50 -58)"><path d="${nose.d}" stroke="${line}" stroke-width="1.15" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".62"/>`
    + `${(nose.dots ?? []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".65" fill="${line}" opacity=".7"/>`).join('')}</g>`);

  // marks
  for (const id of g.marks) {
    const m = part('marks', id);
    out.push((m.dots ?? []).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${m.dark ? INK : line}" opacity="${m.dark ? 0.85 : 0.5}"/>`).join('')
      + (m.strokes ?? []).map((d) => `<path d="${d}" stroke="${line}" stroke-width=".8" fill="none" stroke-linecap="round" opacity=".55"/>`).join(''));
  }

  // facial hair
  const beard = st.facialHair && age >= 16 ? part('facialHair', st.facialHair) : null;
  if (beard) {
    const d = beard.fill.replace(/\{jaw([+-][\d.]+)?\}/g, (_, n) => face.jaw + Number(n ?? 0));
    out.push(`<path d="${d}" fill="${mix(brow, hair, 0.5)}" ${beard.rule ? `fill-rule="${beard.rule}"` : ''} opacity="${beard.sheer ?? 1}"/>`);
  }

  // lips: the shape is inherited, the curve is today's mood
  const smile = Math.max(-0.8, Math.min(1, ((o.mood ?? 62) - 50) / 34));
  out.push(lipsSvg(part('lips', g.lips), smile, mix(lipCol, '#000000', 0.07), mix(lipCol, '#ffffff', 0.08), 1.14 * (baby ? 0.74 : child ? 0.88 : 1)));

  // lines of age
  if (age >= 60) {
    const deep = age >= 75 ? 0.5 : 0.3;
    out.push(`<path d="M40 29.5Q50 27.8 60 29.5M42.5 25.8Q50 24.6 57.5 25.8M41.5 58.5Q39.6 62.5 41.2 67M58.5 58.5Q60.4 62.5 58.8 67M28.5 50.5l2.6 1M71.5 50.5l-2.6 1" `
      + `stroke="${line}" stroke-width=".8" fill="none" stroke-linecap="round" opacity="${deep}"/>`);
  }

  // --- hair in front ---
  if (baby) {
    out.push(`<path d="M46 19Q48 12.5 51.5 16.5M50 18.5Q52.5 11 55.5 16M43.5 20.5Q44 16 47 17.5" stroke="${hair}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`);
  } else if (showHair) {
    out.push(`<g opacity="${style.sheer ?? 1}">${hairLayer(style.front, hair, hairShade)}</g>`);
    out.push((style.lines ?? []).map((d) => `<path d="${d}" stroke="${hairShade}" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".55"/>`).join(''));
  }

  // glasses
  const glasses = st.glasses && age >= 3 ? part('glasses', st.glasses) : null;
  if (glasses) {
    out.push(`<path d="${glasses.d}" stroke="${INK}" stroke-width="${glasses.weight ?? 1.3}" fill="${glasses.tint ? '#35404a' : '#ffffff'}" fill-opacity="${glasses.tint ? 0.35 : 0.12}" stroke-linejoin="round" stroke-linecap="round"/>`);
  }
  out.push('</g>');

  return `<svg viewBox="8 5 84 84" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${out.join('')}</svg>`;
}
