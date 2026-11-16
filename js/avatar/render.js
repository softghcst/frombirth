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
const EYE_X = 13; // distance of each eye from the centre line
const BROW_Y = 32.6;
// The house style: a big head on small shoulders, large eyes, bold outlines
// and rosy cheeks. Features are drawn larger than life and sit a little low
// on the face, so they read at menu size.
const FEATURE = 1.22; // eye width
const EYE_TALL = 1.34; // eyes are stretched taller than they are wide, which rounds and softens every shape
const FEATURES_DOWN = 3;
const OUTLINE = 1.5;
const SHIRTS = ['#4f7f9e', '#8a5f8f', '#5d8a61', '#b5694a', '#56627a', '#a68a3d', '#3f6b6b', '#9c4f5f'];
const INK = '#2a1d18';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** Mixes two colours: t=0 gives a, t=1 gives b. */
export function mix(a, b, t) {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

let uid = 0;

/**
 * One layer of hair shapes (see parts/hair.js for the shape kinds). The whole
 * layer is drawn twice: once with a thick outline, then again without, so
 * overlapping curls share a single outline round their edge.
 */
function hairLayer(shapes, colour, shade) {
  const draw = (edge) => shapes.map((s) => {
    const stroke = edge ? ` stroke="${INK}" stroke-width="${OUTLINE * 2}" stroke-linejoin="round"` : '';
    if (s.d) return `<path d="${s.d}" fill="${colour}"${stroke}/>`;
    if (s.c) return `<circle cx="${s.c[0]}" cy="${s.c[1]}" r="${s.c[2]}" fill="${colour}"${stroke}/>`;
    if (edge) return `<path d="${s.s}" stroke="${INK}" stroke-width="${s.w + OUTLINE * 2}" stroke-linecap="round" fill="none"/>`;
    const strand = `<path d="${s.s}" stroke="${colour}" stroke-width="${s.w}" stroke-linecap="round" fill="none"/>`;
    return s.segments ? `${strand}<path d="${s.s}" stroke="${shade}" stroke-width="${s.w}" stroke-dasharray="0.9 4.1" fill="none" opacity=".7"/>` : strand;
  }).join('');
  return draw(true) + draw(false);
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
  const edge = `stroke="${INK}" stroke-width="${OUTLINE}" stroke-linejoin="round"`;

  // Colours
  const tone = part('skin', g.skin);
  const skin = tone.base;
  const shade = mix(skin, '#3a1c12', 0.22);
  const line = mix(skin, '#2a120c', 0.55);
  const grey = st.hairDye ? 0 : age >= 76 ? 0.92 : age >= 66 ? 0.7 : age >= 56 ? 0.35 : 0;
  const natural = part('hairColor', g.hairColor).hex;
  const hair = mix(st.hairDye ? part('hairDye', st.hairDye).hex : natural, '#e6e3dc', grey);
  const hairShade = mix(hair, '#000000', 0.3);
  const brow = mix(mix(natural, '#e6e3dc', grey * 0.8), '#1c1210', 0.25);
  const lipBase = mix(skin, '#b8444f', tone.depth >= 8 ? 0.36 : 0.46);
  const lipCol = st.lipColor && age >= 13 ? part('lipColor', st.lipColor).hex : lipBase;
  const cheek = mix(skin, '#f0506a', tone.depth >= 7 ? 0.42 : 0.5);

  // Proportions by age: the younger, the bigger the head and eyes and the smaller the shoulders.
  const head = baby ? 1.1 : age < 6 ? 1.08 : child ? 1.05 : age < 18 ? 1.02 : 1;
  const eyeK = FEATURE * (baby ? 1.12 : age < 6 ? 1.08 : child ? 1.04 : 1);
  const body = baby ? 0.6 : age < 6 ? 0.66 : child ? 0.72 : age < 18 ? 0.8 : 0.86;
  // A baby's face is round whatever shape it will grow into.
  const face = baby ? part('face', 'round') : part('face', g.face);
  const style = part('hair', st.hair);
  const showHair = !baby && style;

  // --- behind the head ---
  const headOpen = `<g transform="translate(50 56) scale(${head}) translate(-50 -56)">`;
  if (showHair && style.back.length) out.push(`${headOpen}${hairLayer(style.back, hair, hairShade)}</g>`);

  // --- shoulders ---
  const shirt = o.jailed ? '#e07b2a' : baby ? '#f6dfa6' : SHIRTS[hash(`${seed}:shirt`) % SHIRTS.length];
  out.push(`<g transform="translate(50 104) scale(${body} 1) translate(-50 -100)">`
    + `<path d="M8 101C8 87 25 83.5 40 80.5L60 80.5C75 83.5 92 87 92 101Z" fill="${shirt}" ${edge}/>`
    + `<path d="M40 80.5Q50 89 60 80.5" fill="${skin}" ${edge}/>`
    + `${o.jailed ? `<path d="M22 88h56M15 94h70" stroke="${INK}" stroke-width="2.6" opacity=".5"/>` : ''}</g>`);

  // --- the head ---
  out.push(headOpen);
  out.push(`<ellipse cx="25" cy="50" rx="4" ry="5.6" fill="${skin}" ${edge}/><ellipse cx="75" cy="50" rx="4" ry="5.6" fill="${skin}" ${edge}/>`
    + `<path d="M24.4 48Q23.2 50 24.6 52.2M75.6 48Q76.8 50 75.4 52.2" stroke="${line}" stroke-width=".8" fill="none" opacity=".6"/>`);
  out.push(`<path d="${face.d}" fill="${skin}" ${edge}/>`);

  // facial hair sits on the jaw, under the features
  const beard = st.facialHair && age >= 16 ? part('facialHair', st.facialHair) : null;
  if (beard) {
    const d = beard.fill.replace(/\{jaw([+-][\d.]+)?\}/g, (_, n) => face.jaw + Number(n ?? 0));
    out.push(`<g transform="translate(0 ${FEATURES_DOWN * 0.6})"><path d="${d}" fill="${mix(brow, hair, 0.5)}" ${beard.rule ? `fill-rule="${beard.rule}"` : ''} opacity="${beard.sheer ?? 1}"/></g>`);
  }

  // --- the features, set a little low on the face ---
  out.push(`<g transform="translate(0 ${FEATURES_DOWN})">`);

  // rosy cheeks
  const makeup = st.makeup && age >= 13 ? part('makeup', st.makeup) : null;
  const blush = Math.min(0.85, (makeup ? makeup.blush + 0.3 : baby ? 0.7 : child ? 0.6 : 0.48));
  out.push(`<circle cx="33" cy="58.5" r="4.4" fill="${cheek}" opacity="${blush}"/><circle cx="67" cy="58.5" r="4.4" fill="${cheek}" opacity="${blush}"/>`);

  // eyes
  const eye = part('eyeShape', g.eyeShape);
  const iris = part('eyeColor', g.eyeColor).hex;
  const [ix, iy, ir0] = eye.iris;
  const ir = ir0 * 1.12;
  for (const side of [1, -1]) {
    const id = `av${++uid}`;
    out.push(`<g transform="translate(${50 + side * EYE_X} ${EYE_Y}) scale(${side * eyeK} ${eyeK * EYE_TALL})">`
      + `<clipPath id="${id}"><path d="${eye.white}"/></clipPath>`
      + `${makeup?.shadow ? `<path d="${eye.lash}" stroke="${makeup.shadow}" stroke-width="3.4" fill="none" opacity=".45" transform="translate(0 -1.4)"/>` : ''}`
      + `<path d="${eye.white}" fill="#fffdf9"/>`
      + `<g clip-path="url(#${id})"><ellipse cx="${ix}" cy="${iy}" rx="${ir}" ry="${ir / EYE_TALL * 1.12}" fill="${iris}"/><ellipse cx="${ix}" cy="${iy}" rx="${ir * 0.56}" ry="${ir * 0.56 / EYE_TALL * 1.12}" fill="#15100d"/>`
      + `<ellipse cx="${ix + 1.2}" cy="${iy - 1.2}" rx="1.15" ry="${1.15 / EYE_TALL}" fill="#fff"/><ellipse cx="${ix - 1.2}" cy="${iy + 1}" rx=".55" ry="${0.55 / EYE_TALL}" fill="#fff" opacity=".85"/></g>`
      + `${eye.fold ? `<path d="${eye.fold}" fill="${mix(skin, shade, 0.55)}"/>` : ''}`
      + `<path d="${eye.lash}${makeup?.liner ? 'l2.2-1.6' : ''}" stroke="${INK}" stroke-width="${makeup?.liner ? 1.5 : 1.05}" fill="none" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></g>`);
  }

  // brows
  const b = part('brows', g.brows);
  for (const side of [1, -1]) {
    out.push(`<path d="${b.d}" transform="translate(${50 + side * EYE_X} ${BROW_Y - (eyeK - FEATURE) * 5}) scale(${side * 1.08} 0.8)" stroke="${brow}" `
      + `stroke-width="${(baby ? 0.4 : 0.66) * b.weight}" opacity="${baby ? 0.6 : 0.92}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  }

  // nose: small, so the eyes and mouth do the talking
  const nose = part('nose', g.nose);
  const noseK = baby ? 0.55 : child ? 0.68 : 0.8;
  out.push(`<g transform="translate(50 58.5) scale(${noseK}) translate(-50 -58)"><path d="${nose.d}" stroke="${line}" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>`
    + `${(nose.dots ?? []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".7" fill="${line}" opacity=".7"/>`).join('')}</g>`);

  // marks
  for (const id of g.marks) {
    const m = part('marks', id);
    out.push((m.dots ?? []).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r * 1.15}" fill="${m.dark ? INK : line}" opacity="${m.dark ? 0.85 : 0.55}"/>`).join('')
      + (m.strokes ?? []).map((d) => `<path d="${d}" stroke="${line}" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".6"/>`).join(''));
  }

  // the mouth: the lip shape is inherited, the curve is today's mood. A baby has a dummy instead.
  const smile = Math.max(-0.7, Math.min(1.25, ((o.mood ?? 62) - 38) / 30));
  if (age < 1) {
    out.push(`<ellipse cx="50" cy="67" rx="7.4" ry="4.8" fill="#8fd0ea" ${edge}/><circle cx="50" cy="66.6" r="2.3" fill="#fbf7ee" stroke="${INK}" stroke-width=".9"/>`
      + `<circle cx="50" cy="72.6" r="3.2" fill="none" stroke="#3f97bd" stroke-width="1.7"/>`);
  } else {
    out.push(lipsSvg(part('lips', g.lips), smile, mix(lipCol, '#000000', 0.07), mix(lipCol, '#ffffff', 0.08), baby ? 0.56 : child ? 0.66 : 0.76));
  }

  // lines of age
  if (age >= 60) {
    const deep = age >= 75 ? 0.5 : 0.3;
    out.push(`<path d="M40 26.5Q50 24.8 60 26.5M42.5 22.8Q50 21.6 57.5 22.8M40.5 58.5Q38.6 62.5 40.2 67M59.5 58.5Q61.4 62.5 59.8 67" `
      + `stroke="${line}" stroke-width=".9" fill="none" stroke-linecap="round" opacity="${deep}"/>`);
  }

  // glasses
  const glasses = st.glasses && age >= 3 ? part('glasses', st.glasses) : null;
  if (glasses) {
    out.push(`<g transform="translate(50 47) scale(1.14) translate(-50 -47)"><path d="${glasses.d}" stroke="${INK}" stroke-width="${glasses.weight ?? 1.3}" fill="${glasses.tint ? '#35404a' : '#ffffff'}" fill-opacity="${glasses.tint ? 0.35 : 0.12}" stroke-linejoin="round" stroke-linecap="round"/></g>`);
  }
  out.push('</g>'); // features

  // --- hair in front ---
  if (baby) {
    out.push(`<path d="M45.5 18.5Q47 10.5 51.5 15.5M50 17.5Q53 9.5 56.5 15M42.5 20.5Q43 15 46.5 17" stroke="${hairShade}" stroke-width="2.1" fill="none" stroke-linecap="round"/>`);
  } else if (showHair) {
    out.push(`<g opacity="${style.sheer ?? 1}">${hairLayer(style.front, hair, hairShade)}</g>`);
    out.push((style.lines ?? []).map((d) => `<path d="${d}" stroke="${hairShade}" stroke-width="1" fill="none" stroke-linecap="round" opacity=".55"/>`).join(''));
    // a little shine
    if (style.front.length && !style.sheer) out.push('<path d="M37.5 18.6l3.6-1.9M43.6 15.6l2.6-.9" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>');
  }
  out.push('</g>'); // head

  return `<svg viewBox="6 3 88 88" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${out.join('')}</svg>`;
}
